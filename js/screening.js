// js/screening.js - Manages the entire screening test flow (OIR & PPDT) using static content.

import { appInitialized } from './main.js';
import { auth, db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp } from './firebase-init.js';
import { getNewTestContent, getUnseenBatch, markContentAsSeen } from './content-manager.js';

const pageContent = document.getElementById('page-content');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- GLOBAL STATE ---
let oirTimerInterval;
let ppdtTimerInterval;
let ppdtStoryText = "";
let ppdtCurrentContent = null; // Stores the current image object {id, path, ...}
let oirQuestions = [];
let currentOIRIndex = 0;
let oirScore = 0;

// --- UTILITIES ---
function enterTestMode() {
    document.body.classList.add('test-in-progress');
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => console.warn(err));
        }
    } catch (err) { console.warn(err); }
}

function exitTestMode() {
    document.body.classList.remove('test-in-progress');
    try {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.warn(err));
        }
    } catch (err) { console.warn(err); }
    
    if (oirTimerInterval) clearInterval(oirTimerInterval);
    if (ppdtTimerInterval) clearInterval(ppdtTimerInterval);
}

function renderErrorPage(title, message) {
    exitTestMode(); 
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>An Error Occurred</h1>
            <h3 style="color: var(--error-red); margin-bottom: 10px;">${title}</h3>
            <p style="font-size: 0.95em; color: var(--text-secondary); background: #1f2937; padding: 15px; border-radius: 8px; font-family: monospace;">${message}</p>
            <br>
            <button id="back-to-menu-btn" class="oir-nav-btn">Back to Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}

// --- MAIN MENU ---
export function renderScreeningMenu() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>Screening Tests</h1>
            <p>Stage I of the SSB consists of the Officer Intelligence Rating (OIR) test and the Picture Perception & Discussion Test (PPDT).</p>
        </div>
        <div class="test-choice-container">
            <div class="choice-card" id="start-oir-test">
                <h3>OIR Test</h3>
                <p>A series of verbal and non-verbal reasoning questions to assess your intelligence rating.</p>
            </div>
            <div class="choice-card" id="setup-ppdt-test">
                <h3>PPDT</h3>
                <p>Observe a picture, write a story, and prepare for the group discussion.</p>
            </div>
        </div>
    `;
    document.getElementById('start-oir-test').addEventListener('click', initializeOIRTest);
    document.getElementById('setup-ppdt-test').addEventListener('click', renderPPDTSetup);
}

// --- PPDT LOGIC ---
function renderPPDTSetup() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>PPDT Configuration</h1>
            <p>Set up your Picture Perception & Discussion Test practice session.</p>
        </div>
        <div class="test-setup-card">
            <div class="setup-step">
                <h2>Step 1: Choose Mode</h2>
                <div class="option-group" id="mode-options">
                    <label><input type="radio" name="ppdt-mode" value="timed" class="setup-option"><div class="option-button"><span>Timed (4:30)</span></div></label>
                    <label><input type="radio" name="ppdt-mode" value="untimed" class="setup-option"><div class="option-button"><span>Untimed</span></div></label>
                </div>
            </div>
            <div class="start-test-container">
                <button id="start-ppdt-btn" class="start-btn" disabled>Start PPDT</button>
            </div>
        </div>`;
    
    const startBtn = document.getElementById('start-ppdt-btn');
    
    // Enable button when mode is selected
    document.querySelectorAll('input[name="ppdt-mode"]').forEach(input => {
        input.addEventListener('change', () => startBtn.disabled = false);
    });

    startBtn.addEventListener('click', () => {
        const mode = document.querySelector('input[name="ppdt-mode"]:checked').value;
        initializePPDTTest({ mode });
    });
}

async function initializePPDTTest(settings) {
    pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Fetching Practice Image...</p></div>`;
    
    try {
        // 1. Get Image from JSON catalog via Content Manager
        const content = await getNewTestContent('ppdt');
        ppdtCurrentContent = content; // Store for saving later

        // 2. Start Test
        runPPDTObservationPhase(settings);

    } catch (error) {
        console.error('PPDT Init Error:', error);
        renderErrorPage("Content Load Failed", error.message || "Could not load image library.");
    }
}

function runPPDTObservationPhase(settings) {
    enterTestMode();
    let timeLeft = 30;

    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header"><h2>Observe the Picture</h2></div>
            <p class="timer-display" id="ppdt-timer">${timeLeft}s</p>
            <img src="${ppdtCurrentContent.path}" alt="PPDT Image" class="ppdt-image">
        </div>`;

    ppdtTimerInterval = setInterval(() => {
        timeLeft--;
        const el = document.getElementById('ppdt-timer');
        if(el) el.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(ppdtTimerInterval);
            runPPDTWritingPhase(settings);
        }
    }, 1000);
}

function runPPDTWritingPhase(settings) {
    const isTimed = settings.mode === 'timed';
    let timerHtml = isTimed ? `<p class="timer-display" id="ppdt-write-timer">4:30 remaining</p>` : `<p class="timer-display" style="color:var(--text-secondary)">Untimed Mode</p>`;

    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header"><h2>Write Your Story</h2><button id="abort-btn" class="oir-nav-btn abort">Abort</button></div>
            ${timerHtml}
            <textarea id="ppdt-story-textarea" placeholder="Write your story here..."></textarea>
            <div class="start-test-container"><button id="submit-story-btn" class="start-btn">Submit Story</button></div>
        </div>`;
    
    document.getElementById('abort-btn').addEventListener('click', () => { exitTestMode(); renderScreeningMenu(); });
    document.getElementById('submit-story-btn').addEventListener('click', runPPDTReview);

    if (isTimed) {
        let timeLeft = 270; // 4m 30s
        ppdtTimerInterval = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            const el = document.getElementById('ppdt-write-timer');
            if(el) el.textContent = `${m}:${s.toString().padStart(2, '0')} remaining`;

            if (timeLeft <= 0) {
                clearInterval(ppdtTimerInterval);
                runPPDTReview();
            }
        }, 1000);
    }
}

function runPPDTReview() {
    exitTestMode();
    ppdtStoryText = document.getElementById('ppdt-story-textarea')?.value || "No story written.";
    
    pageContent.innerHTML = `
        <div class="page-title-section"><h1>PPDT Completed</h1></div>
        <div class="ppdt-review-grid">
            <div class="review-item-card"><h3>Image</h3><img src="${ppdtCurrentContent.path}" class="ppdt-image"></div>
            <div class="review-item-card"><h3>Your Story</h3><div class="story-review-text">${ppdtStoryText}</div></div>
        </div>
        <div class="start-test-container">
            <button id="save-btn" class="start-btn">Save Result</button>
            <button id="menu-btn" class="oir-nav-btn">Back to Menu</button>
        </div>`;
        
    document.getElementById('menu-btn').addEventListener('click', renderScreeningMenu);
    document.getElementById('save-btn').addEventListener('click', async () => {
        if (!auth.currentUser) return alert("Please login to save.");
        const btn = document.getElementById('save-btn');
        btn.textContent = 'Saving...'; btn.disabled = true;
        
        try {
            // 1. Save Test Result
            await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'tests'), {
                testType: 'PPDT', 
                imageUrl: ppdtCurrentContent.path,
                contentId: ppdtCurrentContent.id,
                story: ppdtStoryText, 
                timestamp: serverTimestamp()
            });

            // 2. Mark this image as SEEN
            await markContentAsSeen('ppdt', ppdtCurrentContent.id);

            alert("Saved successfully!");
            btn.textContent = 'Saved';
        } catch(e) { 
            console.error(e); 
            alert("Save failed"); 
            btn.textContent = 'Save Result'; btn.disabled = false;
        }
    });
}

// --- OIR TEST LOGIC ---
async function initializeOIRTest() {
    pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Fetching Questions...</p></div>`;
    try {
        // 1. Get 30 Unseen Questions
        oirQuestions = await getUnseenBatch('oir', 30);
        
        currentOIRIndex = 0;
        oirScore = 0;
        enterTestMode();
        renderOIRQuestion();
    } catch(e) {
        renderErrorPage("OIR Setup Failed", e.message);
    }
}

function renderOIRQuestion() {
    if(!oirQuestions[currentOIRIndex]) {
        // End of test
        finishOIRTest();
        return;
    }

    const q = oirQuestions[currentOIRIndex];
    
    pageContent.innerHTML = `
        <div class="oir-test-container">
            <div class="oir-header">
                <span class="oir-progress">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</span>
            </div>
            <div class="oir-question-card">
                <p class="oir-question-text">${q.question}</p>
                <div class="oir-options">
                    ${(q.options||[]).map((o, idx) => `
                        <label class="oir-option-label">
                            <input type="radio" name="opt" value="${o}" data-idx="${idx}"> ${o}
                        </label>`).join('')}
                </div>
                <div class="oir-navigation">
                    <button id="next-btn" class="oir-nav-btn">Next</button>
                </div>
            </div>
        </div>`;

    document.getElementById('next-btn').addEventListener('click', () => {
        const selected = document.querySelector('input[name="opt"]:checked');
        if (selected) {
            // Check answer (Assuming simple string matching or index matching)
            if (selected.value === q.answer) {
                oirScore++;
            }
        }
        
        currentOIRIndex++;
        renderOIRQuestion();
    });
}

function finishOIRTest() {
    exitTestMode();
    
    // Save results automatically if logged in
    const saveResults = async () => {
        if (!auth.currentUser) return;
        try {
            // Save Score
            await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'tests'), {
                testType: 'OIR', 
                score: oirScore,
                total: oirQuestions.length,
                timestamp: serverTimestamp()
            });

            // Mark all these questions as SEEN
            const seenIds = oirQuestions.map(q => q.id);
            await markContentAsSeen('oir', seenIds);
            
        } catch(e) { console.error("Auto-save failed", e); }
    };
    saveResults();

    pageContent.innerHTML = `
        <div class="oir-results-summary">
            <h2>Test Completed</h2>
            <div class="score">${oirScore} / ${oirQuestions.length}</div>
            <p>Your OIR Rating: ${calculateOIRRating(oirScore, oirQuestions.length)}</p>
            <br>
            <button id="menu-btn" class="oir-nav-btn">Back to Menu</button>
        </div>
    `;
    document.getElementById('menu-btn').addEventListener('click', renderScreeningMenu);
}

function calculateOIRRating(score, total) {
    const percentage = (score / total) * 100;
    if (percentage >= 90) return "OIR 1 (Outstanding)";
    if (percentage >= 80) return "OIR 2 (Excellent)";
    if (percentage >= 70) return "OIR 3 (Good)";
    if (percentage >= 60) return "OIR 4 (Average)";
    return "OIR 5 (Below Average)";
}

// --- INIT ---
(async function() {
    await appInitialized;
    if(pageContent) renderScreeningMenu();
})();
