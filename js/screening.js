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
let oirAnswers = {}; // Store user answers: { 0: "Answer", 1: null }
let oirScore = 0;
// New Global for Video
let recordedChunks = [];
let recordedBlob = null;
let mediaRecorder = null;
let stream = null;

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
    
    // Stop camera if active
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
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
    
    const finishWriting = () => {
        ppdtStoryText = document.getElementById('ppdt-story-textarea')?.value || "No story written.";
        clearInterval(ppdtTimerInterval);
        runPPDTNarrationSetup(settings); // Go to Narration instead of Review
    };

    document.getElementById('submit-story-btn').addEventListener('click', finishWriting);

    if (isTimed) {
        let timeLeft = 270; // 4m 30s
        ppdtTimerInterval = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            const el = document.getElementById('ppdt-write-timer');
            if(el) el.textContent = `${m}:${s.toString().padStart(2, '0')} remaining`;

            if (timeLeft <= 0) {
                finishWriting();
            }
        }, 1000);
    }
}

// --- NEW: NARRATION PHASE ---
async function runPPDTNarrationSetup(settings) {
    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header"><h2>Narration Preparation</h2></div>
            <div class="oir-question-card" style="text-align:center;">
                <p style="margin-bottom:1rem; color:var(--text-secondary);">You will now narrate your story. Please enable camera and microphone access.</p>
                <div id="camera-preview-container" style="width:100%; max-width:480px; height:320px; background:#000; margin:0 auto; display:flex; align-items:center; justify-content:center; border-radius:8px; overflow:hidden;">
                    <p style="color:#666;">Waiting for camera...</p>
                    <video id="live-preview" autoplay muted playsinline style="width:100%; height:100%; object-fit:cover; display:none;"></video>
                </div>
                <div class="start-test-container">
                    <button id="enable-cam-btn" class="start-btn">Enable Camera</button>
                    <button id="start-record-btn" class="start-btn" style="display:none; background-color:var(--error-red);">Start Recording</button>
                    <button id="skip-narration-btn" class="oir-nav-btn" style="margin-top:10px;">Skip Narration</button>
                </div>
            </div>
        </div>`;

    document.getElementById('skip-narration-btn').addEventListener('click', runPPDTReview);

    document.getElementById('enable-cam-btn').addEventListener('click', async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const videoEl = document.getElementById('live-preview');
            videoEl.srcObject = stream;
            videoEl.style.display = 'block';
            document.querySelector('#camera-preview-container p').style.display = 'none';
            
            document.getElementById('enable-cam-btn').style.display = 'none';
            document.getElementById('start-record-btn').style.display = 'inline-block';
        } catch (err) {
            console.error("Camera Error:", err);
            alert("Could not access camera. Please check permissions.");
        }
    });

    document.getElementById('start-record-btn').addEventListener('click', runPPDTRecording);
}

function runPPDTRecording() {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
        runPPDTPlayback();
    };

    let timeLeft = 60; // 1 minute for narration
    mediaRecorder.start();

    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header"><h2>Narrating...</h2></div>
            <p class="timer-display" id="record-timer" style="color:var(--error-red);">Recording: 60s</p>
            <div style="width:100%; max-width:480px; height:320px; background:#000; margin:0 auto; border-radius:8px; overflow:hidden; border:2px solid var(--error-red);">
                <video id="recording-preview" autoplay muted playsinline style="width:100%; height:100%; object-fit:cover;"></video>
            </div>
            <div class="start-test-container">
                <button id="stop-record-btn" class="start-btn">Stop Recording</button>
            </div>
        </div>`;
    
    const previewEl = document.getElementById('recording-preview');
    previewEl.srcObject = stream;

    const timerInt = setInterval(() => {
        timeLeft--;
        const el = document.getElementById('record-timer');
        if(el) el.textContent = `Recording: ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timerInt);
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
        }
    }, 1000);

    document.getElementById('stop-record-btn').addEventListener('click', () => {
        clearInterval(timerInt);
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    });
}

function runPPDTPlayback() {
    // Stop camera stream now
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    const videoUrl = URL.createObjectURL(recordedBlob);

    pageContent.innerHTML = `
        <div class="page-title-section"><h1>Self Evaluation</h1></div>
        <div class="ppdt-review-grid" style="grid-template-columns: 1fr;">
            <div class="review-item-card" style="text-align:center;">
                <h3>Your Narration</h3>
                <video id="playback-video" controls src="${videoUrl}" style="width:100%; max-width:480px; border-radius:8px; margin-bottom:1rem;"></video>
                <div style="display:flex; justify-content:center; gap:10px; margin-bottom:1rem;">
                    <button class="oir-nav-btn" onclick="document.getElementById('playback-video').muted=true; document.getElementById('playback-video').play()">Play Muted (Body Language)</button>
                    <button class="oir-nav-btn" onclick="document.getElementById('playback-video').muted=false; document.getElementById('playback-video').play()">Play Audio (Speech)</button>
                </div>
                <a href="${videoUrl}" download="my-narration.webm" class="oir-nav-btn" style="text-decoration:none; display:inline-block;">Download Video</a>
            </div>
        </div>
        <div class="start-test-container">
            <button id="finish-review-btn" class="start-btn">Proceed to Final Review</button>
        </div>`;

    document.getElementById('finish-review-btn').addEventListener('click', runPPDTReview);
}
// --- END NEW NARRATION PHASE ---


function runPPDTReview() {
    exitTestMode();
    // Ensure story is captured if we skipped here directly
    if (!ppdtStoryText && document.getElementById('ppdt-story-textarea')) {
        ppdtStoryText = document.getElementById('ppdt-story-textarea').value;
    }
    
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
        oirAnswers = {}; // Reset answers
        enterTestMode();
        renderOIRQuestion();
    } catch(e) {
        renderErrorPage("OIR Setup Failed", e.message);
    }
}

function renderOIRQuestion() {
    const q = oirQuestions[currentOIRIndex];
    
    // Generate Palette HTML
    let paletteHtml = '<div class="oir-palette" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:15px; justify-content:center;">';
    for (let i = 0; i < oirQuestions.length; i++) {
        let statusClass = 'neutral';
        if (i === currentOIRIndex) statusClass = 'active'; // Current
        else if (oirAnswers[i]) statusClass = 'answered'; // Answered
        else if (oirAnswers[i] === null) statusClass = 'skipped'; // Explicitly skipped (visited but no answer)
        else statusClass = 'unvisited';

        // Styling for palette items
        let style = `
            width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
            border-radius: 4px; font-size: 0.8rem; cursor: pointer; border: 1px solid var(--border-color);
        `;
        
        if (statusClass === 'active') style += 'background: var(--primary-blue); color: #fff; border-color: var(--primary-blue);';
        else if (statusClass === 'answered') style += 'background: var(--success-green); color: #000; border-color: var(--success-green);';
        else if (statusClass === 'skipped') style += 'background: var(--error-red); color: #fff; border-color: var(--error-red);';
        else style += 'background: var(--light-dark-bg); color: var(--text-secondary);';

        paletteHtml += `<div class="palette-item" data-index="${i}" style="${style}">${i + 1}</div>`;
    }
    paletteHtml += '</div>';

    pageContent.innerHTML = `
        <div class="oir-test-container">
            <div class="oir-header" style="flex-direction: column; align-items: normal;">
                 <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span class="oir-progress">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</span>
                    <button id="finish-test-btn" class="oir-nav-btn finish" style="padding: 0.4rem 1rem; font-size: 0.85rem;">Finish Test</button>
                 </div>
                 ${paletteHtml}
            </div>
            <div class="oir-question-card">
                <p class="oir-question-text">${q.question}</p>
                <div class="oir-options">
                    ${(q.options||[]).map((o, idx) => `
                        <label class="oir-option-label">
                            <input type="radio" name="opt" value="${o}" data-idx="${idx}" ${oirAnswers[currentOIRIndex] === o ? 'checked' : ''}> ${o}
                        </label>`).join('')}
                </div>
                <div class="oir-navigation">
                    <button id="prev-btn" class="oir-nav-btn" ${currentOIRIndex === 0 ? 'disabled style="opacity:0.5; cursor:default;"' : ''}>Previous</button>
                    <button id="next-btn" class="oir-nav-btn">Next</button>
                </div>
            </div>
        </div>`;

    // Palette Click
    document.querySelectorAll('.palette-item').forEach(item => {
        item.addEventListener('click', (e) => {
            saveCurrentAnswer();
            currentOIRIndex = parseInt(e.target.dataset.index);
            renderOIRQuestion();
        });
    });

    // Finish Test
    document.getElementById('finish-test-btn').addEventListener('click', () => {
        if (confirm("Are you sure you want to finish the test?")) {
            saveCurrentAnswer();
            finishOIRTest();
        }
    });

    // Previous Button
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentOIRIndex > 0) {
            saveCurrentAnswer();
            currentOIRIndex--;
            renderOIRQuestion();
        }
    });

    // Next Button
    document.getElementById('next-btn').addEventListener('click', () => {
        saveCurrentAnswer();
        if (currentOIRIndex < oirQuestions.length - 1) {
            currentOIRIndex++;
            renderOIRQuestion();
        } else {
            finishOIRTest(); // Last question next finishes test
        }
    });
}

function saveCurrentAnswer() {
    const selected = document.querySelector('input[name="opt"]:checked');
    if (selected) {
        oirAnswers[currentOIRIndex] = selected.value;
    } else {
        // Only mark as skipped (null) if it wasn't already answered. 
        // If they revisit and don't change anything, keep old answer.
        if (oirAnswers[currentOIRIndex] === undefined) {
             oirAnswers[currentOIRIndex] = null;
        }
    }
}

function finishOIRTest() {
    exitTestMode();
    
    // Calculate Score based on oirAnswers
    oirScore = 0;
    oirQuestions.forEach((q, idx) => {
        if (oirAnswers[idx] === q.answer) {
            oirScore++;
        }
    });

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
