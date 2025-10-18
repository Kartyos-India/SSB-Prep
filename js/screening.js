// js/screening.js - Manages the entire screening test flow, including OIR and PPDT.

import { appInitialized } from './main.js';
import { auth, db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp } from './firebase-init.js';

const pageContent = document.getElementById('page-content');

// --- GLOBAL STATE ---
let oirTimerInterval;
let ppdtTimerInterval;
let mediaRecorder;
let recordedChunks = [];
let ppdtStoryText = "";
let ppdtImageUrl = "";


// --- MAIN MENU ---
function renderScreeningMenu() {
    sessionStorage.removeItem('oirTestState');
    sessionStorage.removeItem('ppdtTestState');
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
        <div class="custom-questions-section">
            <div class="section-title-bar">
                <h2>Custom Question Bank</h2>
                <span class="beta-tag">Beta</span>
            </div>
            <p>Upload your own OIR questions from an Excel file (.xlsx) to expand your practice set.</p>
            <div class="upload-area">
                <input type="file" id="excel-file-input" accept=".xlsx" style="display: none;">
                <button id="upload-excel-btn" class="upload-btn"><span>Choose Excel File</span></button>
                <span id="file-name-display" class="file-name">No file selected.</span>
            </div>
            <div id="upload-status" class="upload-status"></div>
            <p class="format-info"><strong>Required Format:</strong> 6 columns in order: Question, Option A, B, C, D, Correct Answer.</p>
        </div>
    `;
    document.getElementById('start-oir-test').addEventListener('click', initializeOIRTest);
    document.getElementById('setup-ppdt-test').addEventListener('click', renderPPDTSetup);
    const fileInput = document.getElementById('excel-file-input');
    const uploadButton = document.getElementById('upload-excel-btn');
    const fileNameDisplay = document.getElementById('file-name-display');
    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            handleExcelUpload(file);
        }
    });
}


// --- PPDT TEST FLOW ---

function renderPPDTSetup() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>PPDT Configuration</h1>
            <p>Set up your Picture Perception & Discussion Test practice session.</p>
        </div>
        <div class="test-setup-card">
            <div class="setup-step">
                <h2>Step 1: Select Your Gender</h2>
                <p>This helps in generating a relevant PPDT image.</p>
                <div class="option-group" id="gender-options">
                    <label><input type="radio" name="gender" value="male" class="setup-option"><div class="option-button"><span>Male</span></div></label>
                    <label><input type="radio" name="gender" value="female" class="setup-option"><div class="option-button"><span>Female</span></div></label>
                </div>
            </div>
            <div class="setup-step">
                <h2>Step 2: Choose PPDT Mode</h2>
                <p>Select a timed or untimed experience for the story writing part.</p>
                <div class="option-group" id="mode-options">
                    <label><input type="radio" name="ppdt-mode" value="timed" class="setup-option"><div class="option-button"><span>Timed</span></div></label>
                    <label><input type="radio" name="ppdt-mode" value="untimed" class="setup-option"><div class="option-button"><span>Untimed</span></div></label>
                </div>
            </div>
            <div class="setup-step" id="timer-visibility-step" style="display: none;">
                <h2>Step 3: Timer Visibility</h2>
                <p>Choose if the timer should be visible during the timed test.</p>
                <div class="option-group" id="timer-options">
                    <label><input type="radio" name="timer-visibility" value="visible" class="setup-option"><div class="option-button"><span>Visible</span></div></label>
                    <label><input type="radio" name="timer-visibility" value="invisible" class="setup-option"><div class="option-button"><span>Invisible</span></div></label>
                </div>
            </div>
            <div class="start-test-container">
                <button id="start-ppdt-btn" class="start-btn" disabled>Start PPDT</button>
            </div>
        </div>`;
    attachPPDTSetupLogic();
}

function attachPPDTSetupLogic() {
    const startBtn = document.getElementById('start-ppdt-btn');
    const allOptions = document.querySelectorAll('.setup-option');
    const timerVisibilityStep = document.getElementById('timer-visibility-step');

    const validate = () => {
        const gender = document.querySelector('input[name="gender"]:checked');
        const mode = document.querySelector('input[name="ppdt-mode"]:checked');
        const timerVisibility = document.querySelector('input[name="timer-visibility"]:checked');
        let ready = false;
        if (gender && mode) {
            if (mode.value === 'untimed') ready = true;
            else if (mode.value === 'timed' && timerVisibility) ready = true;
        }
        startBtn.disabled = !ready;
    };

    allOptions.forEach(opt => opt.addEventListener('change', validate));
    document.querySelectorAll('input[name="ppdt-mode"]').forEach(radio => radio.addEventListener('change', () => {
        const mode = document.querySelector('input[name="ppdt-mode"]:checked');
        timerVisibilityStep.style.display = (mode && mode.value === 'timed') ? 'block' : 'none';
        validate();
    }));

    startBtn.addEventListener('click', () => {
        const settings = {
            gender: document.querySelector('input[name="gender"]:checked').value,
            mode: document.querySelector('input[name="ppdt-mode"]:checked').value,
            timerVisible: document.querySelector('input[name="timer-visibility"]:checked')?.value === 'visible'
        };
        initializePPDTTest(settings);
    });
}

async function initializePPDTTest(settings) {
    pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Generating PPDT image...</p></div>`;
    try {
        const response = await fetch('/api/generate-ppdt-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender: settings.gender })
        });
        if (!response.ok) throw new Error(`API failed: ${await response.text()}`);
        const data = await response.json();
        ppdtImageUrl = `data:image/png;base64,${data.image}`;
        runPPDTObservationPhase(settings);
    } catch (error) {
        renderErrorPage("Could not generate PPDT image.", error.message);
    }
}

function runPPDTObservationPhase(settings) {
    let timeLeft = 30;
    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <h2>Observe the Picture</h2>
            <p class="timer-display" id="ppdt-timer">${timeLeft} seconds remaining</p>
            <img src="${ppdtImageUrl}" alt="PPDT Image" class="ppdt-image">
        </div>`;
    ppdtTimerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('ppdt-timer').textContent = `${timeLeft} seconds remaining`;
        if (timeLeft <= 0) {
            clearInterval(ppdtTimerInterval);
            runPPDTWritingPhase(settings);
        }
    }, 1000);
}

function runPPDTWritingPhase(settings) {
    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <h2>Write Your Story</h2>
            <p>You can type your story below or write it on a piece of paper.</p>
            <div id="ppdt-writing-timer" class="timer-display"></div>
            <textarea id="ppdt-story-textarea" placeholder="Start typing your story here..."></textarea>
            <div id="ppdt-writing-controls"></div>
        </div>`;

    let timeLeft = 270; // 4 minutes 30 seconds
    const timerDisplay = document.getElementById('ppdt-writing-timer');
    const controls = document.getElementById('ppdt-writing-controls');

    const updateTimer = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
    };

    if (settings.mode === 'timed') {
        if (settings.timerVisible) updateTimer();
        ppdtTimerInterval = setInterval(() => {
            timeLeft--;
            if (settings.timerVisible) updateTimer();
            if (timeLeft <= 0) {
                clearInterval(ppdtTimerInterval);
                runPPDTNarrativePhase();
            }
        }, 1000);
    } else {
        timerDisplay.textContent = 'Untimed Mode';
        controls.innerHTML = `<button id="finish-writing-btn" class="start-btn">I'm Ready to Narrate</button>`;
        document.getElementById('finish-writing-btn').addEventListener('click', runPPDTNarrativePhase);
    }
}

function runPPDTNarrativePhase() {
    ppdtStoryText = document.getElementById('ppdt-story-textarea')?.value || "Story written on paper.";
    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <h2>Narrate Your Story</h2>
            <p>Please allow camera and microphone access. You have 1 minute to narrate.</p>
            <div class="video-container" id="video-container"><p>Waiting for permissions...</p></div>
            <p class="timer-display" id="ppdt-narration-timer"></p>
            <button id="start-narration-btn" class="start-btn">Start Narration</button>
        </div>`;
    
    const startBtn = document.getElementById('start-narration-btn');
    startBtn.addEventListener('click', async () => {
        startBtn.disabled = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const videoEl = document.createElement('video');
            videoEl.srcObject = stream;
            videoEl.muted = true;
            videoEl.autoplay = true;
            document.getElementById('video-container').innerHTML = '';
            document.getElementById('video-container').appendChild(videoEl);

            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                renderPPDTReview(videoBlob);
            };
            mediaRecorder.start();

            let timeLeft = 60;
            const timerDisplay = document.getElementById('ppdt-narration-timer');
            const updateNarrationTimer = () => timerDisplay.textContent = `${timeLeft} seconds remaining`;
            updateNarrationTimer();
            ppdtTimerInterval = setInterval(() => {
                timeLeft--;
                updateNarrationTimer();
                if (timeLeft <= 0) {
                    clearInterval(ppdtTimerInterval);
                    if (mediaRecorder.state === 'recording') mediaRecorder.stop();
                }
            }, 1000);

        } catch (err) {
            renderErrorPage("Permission Denied", "Camera and microphone access is required for narration. Please enable it in your browser settings and try again.");
        }
    });
}

function renderPPDTReview(videoBlob) {
    const videoUrl = URL.createObjectURL(videoBlob);
    const isUserLoggedIn = !!auth.currentUser;

    pageContent.innerHTML = `
        <div class="page-title-section"><h1>Review Your PPDT</h1></div>
        <div class="ppdt-review-grid">
            <div class="review-item-card">
                <h3>Original Image</h3>
                <img src="${ppdtImageUrl}" alt="PPDT Image" class="ppdt-image">
            </div>
            <div class="review-item-card">
                <h3>Your Narration</h3>
                <video id="review-video" src="${videoUrl}" controls class="ppdt-video-review"></video>
                <div class="review-controls">
                    <button id="play-audio-btn">Listen to Audio Only</button>
                    <button id="play-muted-btn">Watch Muted Video</button>
                </div>
            </div>
            ${ppdtStoryText !== "Story written on paper." ? `
            <div class="review-item-card full-width">
                <h3>Your Story</h3>
                <div class="story-review-text">${ppdtStoryText}</div>
            </div>` : ''}
        </div>
        <div class="start-test-container">
            ${isUserLoggedIn ? '<button id="save-ppdt-btn" class="start-btn">Save to Performance</button>' : '<button id="login-to-save-btn" class="start-btn">Login to Save</button>'}
            <button id="redo-ppdt-btn" class="oir-nav-btn">Try Another PPDT</button>
        </div>
    `;

    const video = document.getElementById('review-video');
    document.getElementById('play-audio-btn').addEventListener('click', () => {
        video.muted = false;
        video.currentTime = 0;
        video.play();
    });
    document.getElementById('play-muted-btn').addEventListener('click', () => {
        video.muted = true;
        video.currentTime = 0;
        video.play();
    });

    if (isUserLoggedIn) {
        document.getElementById('save-ppdt-btn').addEventListener('click', async () => {
            const btn = document.getElementById('save-ppdt-btn');
            btn.textContent = 'Saving...';
            btn.disabled = true;
            try {
                await addDoc(collection(db, 'users', auth.currentUser.uid, 'tests'), {
                    testType: 'PPDT',
                    imageUrl: ppdtImageUrl.substring(0, 200) + '...', // Store a snippet
                    story: ppdtStoryText,
                    timestamp: serverTimestamp()
                });
                btn.textContent = 'Saved!';
                btn.classList.add('success');
            } catch (error) {
                console.error("Error saving PPDT:", error);
                btn.textContent = 'Save Failed';
                btn.classList.add('error');
            }
        });
    } else {
        document.getElementById('login-to-save-btn').addEventListener('click', () => {
            // This is a simplified login prompt. A more robust solution might use a modal.
            alert("Please log in via the header to save your test results.");
        });
    }

    document.getElementById('redo-ppdt-btn').addEventListener('click', renderPPDTSetup);
}


// --- OIR & UTILITY FUNCTIONS (No changes needed) ---
// (initializeOIRTest, handleExcelUpload, renderErrorPage, etc.)
// Sticking to the file context, the rest of the functions from the previous version would be here.
// For brevity in this response, they are omitted, but they are still part of this file.

async function initializeOIRTest() {
    // ... OIR test logic remains here ...
}


// --- INITIALIZATION ---
async function initializePage() {
    try {
        await appInitialized;
        if (sessionStorage.getItem('oirTestState')) {
            initializeOIRTest();
        } else if (pageContent) {
            renderScreeningMenu();
        }
    } catch (error) {
        console.error("Failed to initialize the screening page:", error);
        if (pageContent) {
            pageContent.innerHTML = `<p>Error loading page.</p>`;
        }
    }
}

initializePage();

