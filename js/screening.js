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

// --- OIR TEST STATE ---
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};
let oirInitialTimeLeft = 1800;


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
        const timerEl = document.getElementById('ppdt-timer');
        if(timerEl) timerEl.textContent = `${timeLeft} seconds remaining`;
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

    let timeLeft = 270; 
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
            videoEl.playsInline = true;
            const videoContainer = document.getElementById('video-container');
            videoContainer.innerHTML = '';
            videoContainer.appendChild(videoEl);

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
            renderErrorPage("Permission Denied", "Camera and microphone access is required. Please enable it in your browser settings and try again.");
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
                <div class="story-review-text">${ppdtStoryText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            </div>` : ''}
        </div>
        <div class="start-test-container">
            ${isUserLoggedIn ? '<button id="save-ppdt-btn" class="start-btn">Save to Performance</button>' : '<button id="login-to-save-btn" class="start-btn">Login to Save</button>'}
            <button id="redo-ppdt-btn" class="oir-nav-btn">Try Another PPDT</button>
        </div>
    `;

    const video = document.getElementById('review-video');
    document.getElementById('play-audio-btn').addEventListener('click', () => { video.muted = false; video.currentTime = 0; video.play(); });
    document.getElementById('play-muted-btn').addEventListener('click', () => { video.muted = true; video.currentTime = 0; video.play(); });

    if (isUserLoggedIn) {
        document.getElementById('save-ppdt-btn').addEventListener('click', async () => {
            const btn = document.getElementById('save-ppdt-btn');
            btn.textContent = 'Saving...'; btn.disabled = true;
            try {
                await addDoc(collection(db, 'users', auth.currentUser.uid, 'tests'), {
                    testType: 'PPDT', imageUrl: ppdtImageUrl.substring(0, 200) + '...', story: ppdtStoryText, timestamp: serverTimestamp()
                });
                btn.textContent = 'Saved!'; btn.classList.add('success');
            } catch (error) {
                console.error("Error saving PPDT:", error);
                btn.textContent = 'Save Failed'; btn.classList.add('error');
            }
        });
    } else {
        document.getElementById('login-to-save-btn').addEventListener('click', () => alert("Please log in via the header to save your test results."));
    }
    document.getElementById('redo-ppdt-btn').addEventListener('click', renderPPDTSetup);
}

// --- OIR & UTILITY FUNCTIONS ---
function handleExcelUpload(file) {
    const reader = new FileReader();
    const statusDiv = document.getElementById('upload-status');
    reader.onload = (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (json.length < 1) throw new Error("File is empty.");
            if (String(json[0][0]).toLowerCase().includes('question')) json.shift();
            const customQuestions = json.map(row => {
                if (row.length < 6 || row.slice(0, 6).some(cell => cell == null || String(cell).trim() === '')) return null;
                return { q: String(row[0]), options: [String(row[1]), String(row[2]), String(row[3]), String(row[4])], answer: String(row[5]) };
            }).filter(Boolean);
            if (customQuestions.length === 0) throw new Error("No valid questions found.");
            localStorage.setItem('customOIRQuestions', JSON.stringify(customQuestions));
            statusDiv.textContent = `Loaded ${customQuestions.length} custom questions!`;
            statusDiv.className = 'upload-status success visible';
        } catch (error) {
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'upload-status error visible';
        }
    };
    reader.onerror = () => {
        statusDiv.textContent = 'Error reading file.';
        statusDiv.className = 'upload-status error visible';
    };
    reader.readAsArrayBuffer(file);
}

function enterTestMode() {
    document.body.classList.add('test-in-progress');
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(err => console.error(`Fullscreen error: ${err.message}`));
    }
}

function exitTestMode() {
    document.body.classList.remove('test-in-progress');
    if (document.exitFullscreen) document.exitFullscreen();
    sessionStorage.removeItem('oirTestState');
    clearInterval(oirTimerInterval);
}

function saveOIRTestState() {
    const state = { questions: oirQuestions, responses: oirResponses, currentIndex: currentOIRIndex, timeLeft: oirInitialTimeLeft };
    sessionStorage.setItem('oirTestState', JSON.stringify(state));
}

function abortOIRTest() {
    if (confirm('Are you sure you want to abort this test? Your progress will be lost.')) {
        exitTestMode();
        renderScreeningMenu();
    }
}

async function initializeOIRTest() {
    const savedState = sessionStorage.getItem('oirTestState');
    if (savedState) {
        const state = JSON.parse(savedState);
        oirQuestions = state.questions;
        oirResponses = state.responses;
        currentOIRIndex = state.currentIndex;
        oirInitialTimeLeft = state.timeLeft;
        enterTestMode();
        renderOIRQuestion();
        startOIRTimer();
        return;
    }

    pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Generating your test...</p></div>`;
    try {
        const response = await fetch('/api/generate-oir-questions');
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        let defaultQuestions = await response.json();
        if (!Array.isArray(defaultQuestions)) throw new Error("Invalid question format from API.");

        let customQuestions = JSON.parse(localStorage.getItem('customOIRQuestions') || '[]');
        const combinedPool = [...defaultQuestions, ...customQuestions];
        for (let i = combinedPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [combinedPool[i], combinedPool[j]] = [combinedPool[j], combinedPool[i]];
        }
        oirQuestions = combinedPool.slice(0, 50);
        if (oirQuestions.length === 0) throw new Error("No questions available.");

        currentOIRIndex = 0;
        oirResponses = {};
        oirInitialTimeLeft = 1800;
        
        saveOIRTestState();
        enterTestMode();
        renderOIRQuestion();
        startOIRTimer();
    } catch (error) {
        renderErrorPage("Could not load OIR questions.", error.message);
    }
}

function renderOIRQuestion() {
    if (currentOIRIndex >= oirQuestions.length || !oirQuestions[currentOIRIndex]) {
        return renderErrorPage("Question Error", "Could not load the current question. The data might be corrupted.");
    }
    const question = oirQuestions[currentOIRIndex];
    pageContent.innerHTML = `
        <div class="oir-test-container">
            <div class="oir-header">
                <div class="oir-progress">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</div>
                <div class="oir-timer">Time Left: <span id="timer-display">...</span></div>
                <button id="oir-abort-btn" class="oir-nav-btn abort">Abort Test</button>
            </div>
            <div class="oir-question-card">
                <p class="oir-question-text">${question.q.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                <div class="oir-options">
                    ${question.options.map(opt => `
                        <label class="oir-option-label">
                            <input type="radio" name="oir-option" value="${opt}" ${oirResponses[currentOIRIndex] === opt ? 'checked' : ''}>
                            ${String(opt).replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                        </label>
                    `).join('')}
                </div>
                <div class="oir-navigation">
                    <button id="oir-prev-btn" class="oir-nav-btn">Previous</button>
                    <button id="oir-next-btn" class="oir-nav-btn">Next</button>
                    <button id="oir-finish-btn" class="oir-nav-btn finish">Finish Test</button>
                </div>
            </div>
        </div>`;
    document.getElementById('oir-prev-btn').style.visibility = (currentOIRIndex === 0) ? 'hidden' : 'visible';
    document.getElementById('oir-next-btn').style.display = (currentOIRIndex === oirQuestions.length - 1) ? 'none' : 'block';
    document.getElementById('oir-finish-btn').style.display = (currentOIRIndex === oirQuestions.length - 1) ? 'block' : 'none';
    document.getElementById('oir-abort-btn').addEventListener('click', abortOIRTest);
    document.getElementById('oir-prev-btn').addEventListener('click', () => navigateOIR('prev'));
    document.getElementById('oir-next-btn').addEventListener('click', () => navigateOIR('next'));
    document.getElementById('oir-finish-btn').addEventListener('click', submitOIRTest);
    document.querySelectorAll('input[name="oir-option"]').forEach(opt => opt.addEventListener('change', saveOIRResponse));
}

function saveOIRResponse() {
    const selected = document.querySelector('input[name="oir-option"]:checked');
    if (selected) oirResponses[currentOIRIndex] = selected.value;
    saveOIRTestState();
}

function navigateOIR(direction) {
    saveOIRResponse();
    if (direction === 'next' && currentOIRIndex < oirQuestions.length - 1) currentOIRIndex++;
    else if (direction === 'prev' && currentOIRIndex > 0) currentOIRIndex--;
    saveOIRTestState();
    renderOIRQuestion();
}

function startOIRTimer() {
    let timeLeft = oirInitialTimeLeft;
    const timerDisplay = document.getElementById('timer-display');
    const updateTimer = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        oirInitialTimeLeft = timeLeft;
    };
    updateTimer();
    oirTimerInterval = setInterval(() => {
        timeLeft--;
        updateTimer();
        saveOIRTestState();
        if (timeLeft <= 0) submitOIRTest();
    }, 1000);
}

async function submitOIRTest() {
    saveOIRResponse();
    let score = oirQuestions.reduce((acc, q, i) => acc + (oirResponses[i] === q.answer ? 1 : 0), 0);
    try {
        const user = auth.currentUser;
        if (user) {
            await addDoc(collection(db, 'users', user.uid, 'tests'), {
                testType: 'OIR Test', score, total: oirQuestions.length, timestamp: serverTimestamp()
            });
        }
    } catch (error) { console.error("Error saving OIR results:", error); }
    exitTestMode();
    renderOIRResults(score);
}

function renderOIRResults(score) {
    pageContent.innerHTML = `
        <div class="page-title-section"><h1>OIR Test Results</h1></div>
        <div class="oir-results-summary">
            <h2>Your Score</h2>
            <p class="score">${score} / ${oirQuestions.length}</p>
        </div>
        <div class="oir-answer-review">
            ${oirQuestions.map((q, index) => `
                <div class="review-item ${oirResponses[index] === q.answer ? 'correct' : 'incorrect'}">
                    <p><strong>Q${index + 1}:</strong> ${q.q}</p>
                    <p>Your Answer: ${oirResponses[index] || 'No Answer'}</p>
                    ${oirResponses[index] !== q.answer ? `<p>Correct Answer: ${q.answer}</p>` : ''}
                </div>
            `).join('')}
        </div>
         <div class="start-test-container"><button id="back-to-menu-btn" class="oir-nav-btn">Back to Screening Menu</button></div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}

// *** THIS FUNCTION IS THE FIX FOR THE SECOND ERROR ***
function renderErrorPage(title, message) {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>An Error Occurred</h1>
            <p style="color: var(--error-red);">${title}</p>
            <p style="font-size: 0.9em; color: var(--text-secondary);">${message}</p><br>
            <button id="back-to-menu-btn" class="oir-nav-btn">Back to Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
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
        console.error("Failed to initialize screening page:", error);
        if(pageContent) pageContent.innerHTML = `<p>Error loading page. Please refresh.</p>`;
    }
}

initializePage();

