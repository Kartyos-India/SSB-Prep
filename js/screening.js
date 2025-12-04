// js/screening.js - Manages the entire screening test flow, including OIR and PPDT.

import { appInitialized } from './main.js';
import { firebasePromise, auth, db } from './firebase-app.js';
import { postWithIdToken } from './screening-serverside.js';
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from './firebase-init.js';

const pageContent = document.getElementById('page-content');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- GLOBAL STATE ---
let oirTimerInterval;
let ppdtTimerInterval;
let mediaRecorder;
let recordedChunks = [];
let ppdtStoryText = "";
let ppdtImageUrl = "";
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};
let oirInitialTimeLeft = 1800;

// --- UTILITIES ---
function enterTestMode() {
    document.body.classList.add('test-in-progress');
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn("Fullscreen request denied or failed:", err);
            });
        }
    } catch (err) {
        console.warn("Fullscreen not supported:", err);
    }
}

function exitTestMode() {
    document.body.classList.remove('test-in-progress');
    try {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(err => {
                console.warn("Exit fullscreen failed (safe to ignore):", err);
            });
        }
    } catch (err) {
        console.warn("Exit fullscreen error:", err);
    }
    
    if (oirTimerInterval) clearInterval(oirTimerInterval);
    if (ppdtTimerInterval) clearInterval(ppdtTimerInterval);
    sessionStorage.removeItem('oirTestState');
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
function renderScreeningMenu() {
    sessionStorage.removeItem('oirTestState'); 
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
                <h2>Step 1: Select Your Gender</h2>
                <div class="option-group" id="gender-options">
                    <label><input type="radio" name="gender" value="male" class="setup-option"><div class="option-button"><span>Male</span></div></label>
                    <label><input type="radio" name="gender" value="female" class="setup-option"><div class="option-button"><span>Female</span></div></label>
                </div>
            </div>
            
            <div class="setup-step">
                <h2>Step 2: Choose Mode</h2>
                <div class="option-group" id="mode-options">
                    <label><input type="radio" name="ppdt-mode" value="timed" class="setup-option"><div class="option-button"><span>Timed (4:30)</span></div></label>
                    <label><input type="radio" name="ppdt-mode" value="untimed" class="setup-option"><div class="option-button"><span>Untimed</span></div></label>
                </div>
            </div>

            <div class="setup-step" id="timer-visibility-step" style="display: none;">
                <h2>Step 3: Timer Visibility</h2>
                <div class="option-group">
                    <label><input type="radio" name="timer-visibility" value="visible" class="setup-option"><div class="option-button"><span>Show Timer</span></div></label>
                    <label><input type="radio" name="timer-visibility" value="hidden" class="setup-option"><div class="option-button"><span>Hide Timer</span></div></label>
                </div>
            </div>

            <div class="start-test-container">
                <button id="start-ppdt-btn" class="start-btn" disabled>Start PPDT</button>
            </div>
        </div>`;
    
    const startBtn = document.getElementById('start-ppdt-btn');
    const timerStep = document.getElementById('timer-visibility-step');

    // Logic to show/hide timer step and enable start button
    const validate = () => {
        const gender = document.querySelector('input[name="gender"]:checked');
        const mode = document.querySelector('input[name="ppdt-mode"]:checked');
        const timerVis = document.querySelector('input[name="timer-visibility"]:checked');

        let isValid = false;
        if (gender && mode) {
            if (mode.value === 'untimed') isValid = true;
            else if (mode.value === 'timed' && timerVis) isValid = true;
        }
        startBtn.disabled = !isValid;
    };

    // Listen for changes
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            // Handle timer step visibility
            if (e.target.name === 'ppdt-mode') {
                if (e.target.value === 'timed') {
                    timerStep.style.display = 'block';
                    // Reset timer vis selection to force user to choose again or keep logic simple
                } else {
                    timerStep.style.display = 'none';
                }
            }
            validate();
        });
    });

    startBtn.addEventListener('click', () => {
        const gender = document.querySelector('input[name="gender"]:checked').value;
        const mode = document.querySelector('input[name="ppdt-mode"]:checked').value;
        const timerVisInput = document.querySelector('input[name="timer-visibility"]:checked');
        
        const settings = { 
            gender, 
            mode,
            timerVisible: timerVisInput ? timerVisInput.value === 'visible' : true
        };
        initializePPDTTest(settings);
    });
}

async function initializePPDTTest(settings) {
    pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Generating AI Image...<br><span style="font-size:0.8em; color:#888;">This may take up to 30 seconds</span></p></div>`;
    
    try {
        let response;
        const body = { gender: settings.gender };
        
        if (auth && auth.currentUser) {
            response = await postWithIdToken('/api/generate-ppdt-image', body);
        } else {
            response = await fetch('/api/generate-ppdt-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        }

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`API Failed (${response.status}): ${txt}`);
        }

        const data = await response.json();
        let resolvedUrl = null;

        if (data.image) resolvedUrl = data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`;
        else if (data.imageUrl) resolvedUrl = data.imageUrl;

        if (!resolvedUrl) throw new Error('No valid image returned from AI service.');

        ppdtImageUrl = resolvedUrl;
        runPPDTObservationPhase(settings);

    } catch (error) {
        console.error('PPDT Init Error:', error);
        let msg = error.message || String(error);
        if (msg.includes('502')) msg = "AI Service is currently busy or down. Please try again later.";
        renderErrorPage("Image Generation Failed", msg);
    }
}

function runPPDTObservationPhase(settings) {
    enterTestMode();
    let timeLeft = 30;
    
    // Adjust logic if user selected untimed - usually observation is still timed (30s), 
    // but writing is what varies. Standard PPDT is strict 30s observe.
    // Keeping standard 30s observation for now.

    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header"><h2>Observe the Picture</h2></div>
            <p class="timer-display" id="ppdt-timer">${timeLeft}s</p>
            <img src="${ppdtImageUrl}" alt="PPDT Image" class="ppdt-image">
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
    // Determine timer display based on settings
    const isTimed = settings.mode === 'timed';
    const showTimer = settings.timerVisible;
    let timerHtml = '';

    if (isTimed) {
        timerHtml = `<p class="timer-display" id="ppdt-write-timer">${showTimer ? "4:30 remaining" : "Time Running..."}</p>`;
    } else {
        timerHtml = `<p class="timer-display" style="color:var(--text-secondary)">Untimed Mode</p>`;
    }

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
        let timeLeft = 270; // 4 minutes 30 seconds
        ppdtTimerInterval = setInterval(() => {
            timeLeft--;
            
            if (showTimer) {
                const m = Math.floor(timeLeft / 60);
                const s = timeLeft % 60;
                const el = document.getElementById('ppdt-write-timer');
                if(el) el.textContent = `${m}:${s.toString().padStart(2, '0')} remaining`;
            }

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
            <div class="review-item-card"><h3>Image</h3><img src="${ppdtImageUrl}" class="ppdt-image"></div>
            <div class="review-item-card"><h3>Story</h3><div class="story-review-text">${ppdtStoryText}</div></div>
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
            await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'tests'), {
                testType: 'PPDT', imageUrl: 'AI Generated', story: ppdtStoryText, timestamp: serverTimestamp()
            });
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
    pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Generating Questions...</p></div>`;
    try {
        const resp = await fetch('/api/generate-oir-questions', { method: 'POST' });
        if(!resp.ok) throw new Error(await resp.text());
        oirQuestions = await resp.json();
        if(!Array.isArray(oirQuestions)) oirQuestions = oirQuestions.questions || [];
        
        currentOIRIndex = 0;
        enterTestMode();
        renderOIRQuestion();
    } catch(e) {
        renderErrorPage("OIR Generation Failed", e.message);
    }
}

function renderOIRQuestion() {
    if(!oirQuestions[currentOIRIndex]) return;
    const q = oirQuestions[currentOIRIndex];
    pageContent.innerHTML = `
        <div class="oir-test-container">
            <div class="oir-question-card">
                <p class="oir-question-text">${q.question || q.q}</p>
                <div class="oir-options">
                    ${(q.options||[]).map(o => `<label class="oir-option-label"><input type="radio" name="opt" value="${o}"> ${o}</label>`).join('')}
                </div>
                <div class="oir-navigation">
                    <button id="next-btn" class="oir-nav-btn">Next</button>
                </div>
            </div>
        </div>`;
    document.getElementById('next-btn').addEventListener('click', () => {
        if(currentOIRIndex < oirQuestions.length - 1) { currentOIRIndex++; renderOIRQuestion(); }
        else { exitTestMode(); renderScreeningMenu(); }
    });
}

// --- INIT ---
(async function() {
    await appInitialized;
    if(pageContent) renderScreeningMenu();
})();
