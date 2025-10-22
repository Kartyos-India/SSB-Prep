// js/screening.js - Manages the entire screening test flow, including OIR and PPDT.

import { appInitialized } from './main.js';
import { auth, db } from './firebase-app.js';
// Import necessary Firestore functions
import { collection, addDoc, serverTimestamp, doc, setDoc, getDoc } from './firebase-init.js';

const pageContent = document.getElementById('page-content');
// Define appId globally within this script
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';


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
let oirInitialTimeLeft = 1800; // 30 minutes in seconds


// --- MAIN MENU ---
function renderScreeningMenu() {
    sessionStorage.removeItem('oirTestState'); // Clear any previous test state
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
                <h2>Custom Question Bank (OIR)</h2>
                <span class="beta-tag">Beta</span>
            </div>
            <p>Upload your own OIR questions from an Excel file (.xlsx) to store them in your account and include them in your practice tests. (Login Required)</p>
            <div class="upload-area">
                <input type="file" id="excel-file-input" accept=".xlsx" style="display: none;">
                <button id="upload-excel-btn" class="upload-btn"><span>Choose Excel File</span></button>
                <span id="file-name-display" class="file-name">No file selected.</span>
            </div>
            <div id="upload-status" class="upload-status"></div>
            <p class="format-info"><strong>Required Format:</strong> 6 columns in order: Question, Option A, B, C, D, Correct Answer.</p>
        </div>
    `;
    // Attach event listeners for the menu
    document.getElementById('start-oir-test').addEventListener('click', initializeOIRTest);
    document.getElementById('setup-ppdt-test').addEventListener('click', renderPPDTSetup);
    
    // Attach event listeners for the file upload
    const fileInput = document.getElementById('excel-file-input');
    const uploadButton = document.getElementById('upload-excel-btn');
    const fileNameDisplay = document.getElementById('file-name-display');
    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            handleExcelUpload(file); // Let the handler manage login check
        }
    });
}


// --- PPDT TEST FLOW (No changes from previous version) ---
function renderPPDTSetup() {
    // ... (rest of PPDT setup rendering) ...
     pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>PPDT Configuration</h1>
            <p>Set up your Picture Perception & Discussion Test practice session.</p>
        </div>
        <div class="test-setup-card">
            <div class="setup-step">
                <h2>Step 1: Select Your Gender</h2>
                <p>This will be used for your narration practice.</p>
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
    // ... (rest of PPDT setup logic) ...
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
    // ... (rest of PPDT initialization) ...
     pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Loading PPDT image...</p></div>`;
    try {
        const response = await fetch('/api/generate-ppdt-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender: settings.gender })
        });
        if (!response.ok) throw new Error(`API failed: ${await response.text()}`);
        const data = await response.json();
        ppdtImageUrl = data.imageUrl;
        if (!ppdtImageUrl) throw new Error("No image URL was returned from the API.");
        runPPDTObservationPhase(settings);
    } catch (error) {
        renderErrorPage("Could not load PPDT image.", error.message);
    }
}

function runPPDTObservationPhase(settings) {
    // ... (rest of PPDT observation) ...
     enterTestMode();
    let timeLeft = 30;
    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header">
                <h2>Observe the Picture</h2>
                <button id="ppdt-abort-btn" class="oir-nav-btn abort">Abort Test</button>
            </div>
            <p class="timer-display" id="ppdt-timer">${timeLeft} seconds remaining</p>
            <img src="${ppdtImageUrl}" alt="PPDT Image" class="ppdt-image" crossOrigin="anonymous">
        </div>`;

    document.getElementById('ppdt-abort-btn').addEventListener('click', abortPPDTTest);

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
    // ... (rest of PPDT writing) ...
     pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header">
                <h2>Write Your Story</h2>
                <button id="ppdt-abort-btn" class="oir-nav-btn abort">Abort Test</button>
            </div>
            <p>You can type your story below or write it on a piece of paper.</p>
            <div id="ppdt-writing-timer" class="timer-display"></div>
            <textarea id="ppdt-story-textarea" placeholder="Start typing your story here..."></textarea>
            <div id="ppdt-writing-controls" class="start-test-container"></div>
        </div>`;

    document.getElementById('ppdt-abort-btn').addEventListener('click', abortPPDTTest);

    let timeLeft = 270; // 4.5 minutes
    const timerDisplay = document.getElementById('ppdt-writing-timer');
    const controls = document.getElementById('ppdt-writing-controls');
    const updateTimer = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
    };

    if (settings.mode === 'timed') {
        if (settings.timerVisible) updateTimer();
        else timerDisplay.textContent = "Timed Mode (Hidden Timer)";
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
    // ... (rest of PPDT narration) ...
    ppdtStoryText = document.getElementById('ppdt-story-textarea')?.value || "Story written on paper.";

    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header">
                <h2>Narrate Your Story</h2>
                <button id="ppdt-abort-btn" class="oir-nav-btn abort">Abort Test</button>
            </div>
            <p>Please allow camera and microphone access. You have 1 minute to narrate.</p>
            <div class="video-container" id="video-container"><p>Waiting for permissions...</p></div>
            <p class="timer-display" id="ppdt-narration-timer"></p>
            <button id="start-narration-btn" class="start-btn">Start Narration</button>
        </div>`;

    document.getElementById('ppdt-abort-btn').addEventListener('click', abortPPDTTest);
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
    // ... (rest of PPDT review) ...
    exitTestMode();
    const videoUrl = URL.createObjectURL(videoBlob);
    const isUserLoggedIn = !!auth.currentUser;

    pageContent.innerHTML = `
        <div class="page-title-section"><h1>Review Your PPDT</h1></div>
        <div class="ppdt-review-grid">
            <div class="review-item-card">
                <h3>Original Image</h3>
                <img src="${ppdtImageUrl}" alt="PPDT Image" class="ppdt-image" crossOrigin="anonymous">
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
                // We save the hosted URL, which is more efficient than storing Base64
                await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'tests'), { // Updated path
                    testType: 'PPDT', imageUrl: ppdtImageUrl, story: ppdtStoryText, timestamp: serverTimestamp()
                });
                btn.textContent = 'Saved!'; btn.classList.add('success');
            } catch (error) {
                console.error("Error saving PPDT:", error);
                btn.textContent = 'Save Failed'; btn.classList.add('error');
            }
        });
    } else {
        document.getElementById('login-to-save-btn').addEventListener('click', () => {
            alert("Please log in via the header to save your test results.");
        });
    }
    document.getElementById('redo-ppdt-btn').addEventListener('click', renderPPDTSetup);
}

function abortPPDTTest() {
    // ... (rest of PPDT abort) ...
    showAbortModal(() => {
        clearInterval(ppdtTimerInterval);
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        exitTestMode();
        renderScreeningMenu();
    });
}


// --- OIR TEST & UTILITY FUNCTIONS ---

/**
 * Handles parsing and SAVING the uploaded Excel file TO FIRESTORE
 */
async function handleExcelUpload(file) {
    const statusDiv = document.getElementById('upload-status');
    
    // Check if user is logged in BEFORE reading the file
    if (!auth.currentUser) {
        statusDiv.textContent = 'Error: Please log in to upload custom questions.';
        statusDiv.className = 'upload-status error visible';
        // Clear the file input visually
        document.getElementById('file-name-display').textContent = 'No file selected.';
        document.getElementById('excel-file-input').value = ''; 
        return;
    }
    
    statusDiv.textContent = 'Processing file...';
    statusDiv.className = 'upload-status visible'; // Show processing message

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // header: 1 ensures rows are arrays
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); 
            
            if (json.length < 1) throw new Error("File is empty.");
            
            // Basic header check (optional but good practice)
            if (String(json[0][0]).toLowerCase().includes('question')) {
                 json.shift(); // Remove header row if present
            }
            
            const customQuestions = json.map(row => {
                // Validate that the first 6 columns exist and are not empty/null
                if (!row || row.length < 6 || row.slice(0, 6).some(cell => cell == null || String(cell).trim() === '')) {
                    console.warn("Skipping invalid row:", row); // Log skipped rows
                    return null; 
                }
                // Convert row data to the expected question object format
                return { 
                    q: String(row[0]).trim(), 
                    options: [String(row[1]).trim(), String(row[2]).trim(), String(row[3]).trim(), String(row[4]).trim()], 
                    answer: String(row[5]).trim() 
                };
            }).filter(Boolean); // filter(Boolean) removes null entries resulting from invalid rows

            if (customQuestions.length === 0) throw new Error("No valid questions found. Check file format (6 columns required).");

            // --- Save to Firestore ---
            const userId = auth.currentUser.uid;
            // Define the specific document path for this user's custom OIR questions
            const docRef = doc(db, 'artifacts', appId, 'users', userId, 'oirCustomData', 'questions'); 
            
            // Use setDoc to OVERWRITE the document with the new questions array.
            // Using { merge: true } could be used to add fields without overwriting, 
            // but for a question list, overwriting is usually simpler.
            // Consider using updateDoc with arrayUnion if you want to ADD questions 
            // without duplicates, but that's more complex if users re-upload.
            await setDoc(docRef, { questionsList: customQuestions }); 

            statusDiv.textContent = `Successfully saved ${customQuestions.length} custom questions to your account!`;
            statusDiv.className = 'upload-status success visible';

        } catch (error) {
            console.error("Error processing or saving Excel file:", error); // Log detailed error
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'upload-status error visible';
        } finally {
             // Clear the file input regardless of success/failure after processing
             document.getElementById('excel-file-input').value = '';
        }
    };
    reader.onerror = () => {
        statusDiv.textContent = 'Error reading the file.';
        statusDiv.className = 'upload-status error visible';
        document.getElementById('excel-file-input').value = ''; // Clear input on read error
    };
    reader.readAsArrayBuffer(file);
}


function enterTestMode() { /* ... unchanged ... */ 
    document.body.classList.add('test-in-progress');
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    } catch (err) {
        console.warn("Fullscreen request failed:", err.message);
    }
}
function exitTestMode() { /* ... unchanged ... */ 
    document.body.classList.remove('test-in-progress');
    try {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    } catch (err) {
        console.warn("Exit fullscreen request failed:", err.message);
    }
    sessionStorage.removeItem('oirTestState');
    clearInterval(oirTimerInterval);
    clearInterval(ppdtTimerInterval); // Ensure PPDT timers are cleared too
}
function saveOIRTestState() { /* ... unchanged ... */ 
    const state = { questions: oirQuestions, responses: oirResponses, currentIndex: currentOIRIndex, timeLeft: oirInitialTimeLeft };
    sessionStorage.setItem('oirTestState', JSON.stringify(state));
}
function showAbortModal(onConfirm) { /* ... unchanged ... */ 
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Abort Test?</h3>
            <p>Are you sure you want to abort this test? All your progress will be lost.</p>
            <div class="modal-actions">
                <button id="modal-cancel" class="modal-btn cancel">Cancel</button>
                <button id="modal-confirm" class="modal-btn confirm">Abort</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('modal-cancel').addEventListener('click', () => document.body.removeChild(modal));
    document.getElementById('modal-confirm').addEventListener('click', () => {
        document.body.removeChild(modal);
        onConfirm();
    });
}
function abortOIRTest() { /* ... unchanged ... */ 
     showAbortModal(() => {
        exitTestMode();
        renderScreeningMenu();
    });
}

/**
 * Starts the OIR test (or resumes), NOW INCLUDES FIRESTORE FETCH
 */
async function initializeOIRTest() {
    // Check for a saved state (e.g., from a page reload)
    const savedState = sessionStorage.getItem('oirTestState');
    if (savedState) {
        // Resume existing test
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

    // --- Start a New Test ---
    pageContent.innerHTML = `<div class="page-title-section"><div class="loader"></div><p>Generating your test...</p></div>`;
    try {
        // 1. Fetch default questions from the Groq API
        const response = await fetch('/api/generate-oir-questions');
        if (!response.ok) throw new Error(`API error fetching default questions: ${response.status}`);
        let defaultQuestions = await response.json();
        if (!Array.isArray(defaultQuestions)) throw new Error("Invalid default question format from API.");

        // 2. Fetch custom questions from Firestore (if logged in)
        let customQuestions = [];
        const user = auth.currentUser;
        if (user) {
            const userId = user.uid;
            const docRef = doc(db, 'artifacts', appId, 'users', userId, 'oirCustomData', 'questions');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().questionsList) {
                customQuestions = docSnap.data().questionsList;
                console.log(`Loaded ${customQuestions.length} custom questions from Firestore.`);
            } else {
                console.log("No custom questions found in Firestore for this user.");
            }
        } else {
             console.log("User not logged in, using only default questions.");
        }

        // 3. Combine and Shuffle
        const combinedPool = [...defaultQuestions, ...customQuestions];
        if (combinedPool.length === 0) throw new Error("No questions available from any source.");

        // Fisher-Yates shuffle
        for (let i = combinedPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [combinedPool[i], combinedPool[j]] = [combinedPool[j], combinedPool[i]];
        }
        
        // Select 50 questions (or fewer if total is less than 50)
        oirQuestions = combinedPool.slice(0, 50); 
        console.log(`Starting test with ${oirQuestions.length} questions.`);


        // 4. Initialize Test State
        currentOIRIndex = 0;
        oirResponses = {};
        oirInitialTimeLeft = 1800; // Reset timer for new test
        
        // 5. Start Test
        saveOIRTestState(); // Save the initial state immediately
        enterTestMode();
        renderOIRQuestion();
        startOIRTimer();
    } catch (error) {
        console.error("Error initializing OIR Test:", error); // Log the full error
        renderErrorPage("Could not load OIR questions.", error.message);
    }
}

// ... (renderOIRQuestion, saveOIRResponse, navigateOIR, startOIRTimer remain unchanged) ...
function renderOIRQuestion() { /* ... unchanged ... */ 
    if (currentOIRIndex >= oirQuestions.length || !oirQuestions[currentOIRIndex] || !oirQuestions[currentOIRIndex].q) {
        // Add extra logging for debugging
        console.error("Attempted to render invalid question index or data:", currentOIRIndex, oirQuestions[currentOIRIndex]);
        return renderErrorPage("Question Error", "Could not load the current question. The data might be corrupted or missing.");
    }
    const question = oirQuestions[currentOIRIndex];
     // Basic validation
    if (!question.options || !Array.isArray(question.options) || question.options.length !== 4) {
         console.error("Invalid options for question:", currentOIRIndex, question);
         return renderErrorPage("Question Error", "Invalid options format for the current question.");
    }
    
    pageContent.innerHTML = `
        <div class="oir-test-container">
            <div class="oir-header">
                <div class="oir-progress">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</div>
                <div class="oir-timer">Time Left: <span id="timer-display">...</span></div>
                <button id="oir-abort-btn" class="oir-nav-btn abort">Abort Test</button>
            </div>
            <div class="oir-question-card">
                 {/* Sanitize question text */}
                <p class="oir-question-text">${question.q.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                <div class="oir-options">
                    {/* Sanitize options text */}
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
function saveOIRResponse() { /* ... unchanged ... */ 
    const selected = document.querySelector('input[name="oir-option"]:checked');
    if (selected) oirResponses[currentOIRIndex] = selected.value;
    saveOIRTestState();
}
function navigateOIR(direction) { /* ... unchanged ... */ 
    saveOIRResponse();
    if (direction === 'next' && currentOIRIndex < oirQuestions.length - 1) currentOIRIndex++;
    else if (direction === 'prev' && currentOIRIndex > 0) currentOIRIndex--;
    saveOIRTestState(); // Save state after index change
    renderOIRQuestion();
}
function startOIRTimer() { /* ... unchanged ... */ 
     let timeLeft = oirInitialTimeLeft;
    const timerDisplay = document.getElementById('timer-display');
    const updateTimer = () => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        // Check if timerDisplay still exists before updating
        if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        oirInitialTimeLeft = timeLeft; // Update global state for session storage
    };
    updateTimer(); // Call once immediately
    
    // Clear any existing timer before starting a new one
    clearInterval(oirTimerInterval); 
    
    oirTimerInterval = setInterval(() => {
        timeLeft--;
        updateTimer();
        saveOIRTestState(); // Save state every second
        if (timeLeft <= 0) {
            submitOIRTest(); // Automatically submit when time runs out
        }
    }, 1000);
}

/**
 * Submits the OIR test, NOW SAVES TO CORRECT FIRESTORE PATH
 */
async function submitOIRTest() {
    saveOIRResponse();
    // Clear timer immediately to prevent multiple submissions if async takes time
    clearInterval(oirTimerInterval); 
    
    let score = oirQuestions.reduce((acc, q, i) => acc + (oirResponses[i] === q.answer ? 1 : 0), 0);
    try {
        const user = auth.currentUser;
        if (user) {
            // Use the correct path including appId
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tests'), { 
                testType: 'OIR Test', score, total: oirQuestions.length, timestamp: serverTimestamp()
            });
        }
    } catch (error) { console.error("Error saving OIR results:", error); }
    
    exitTestMode(); // Ensure test mode is exited
    renderOIRResults(score);
}

// ... (renderOIRResults remains unchanged) ...
function renderOIRResults(score) { /* ... unchanged ... */ 
    pageContent.innerHTML = `
        <div class="page-title-section"><h1>OIR Test Results</h1></div>
        <div class="oir-results-summary">
            <h2>Your Score</h2>
            <p class="score">${score} / ${oirQuestions.length}</p>
        </div>
        <div class="oir-answer-review">
             {/* Sanitize answers */}
            ${oirQuestions.map((q, index) => `
                <div class="review-item ${oirResponses[index] === q.answer ? 'correct' : 'incorrect'}">
                    <p><strong>Q${index + 1}:</strong> ${q.q.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                    <p>Your Answer: ${oirResponses[index] ? oirResponses[index].replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'No Answer'}</p>
                    ${oirResponses[index] !== q.answer ? `<p>Correct Answer: ${q.answer.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : ''}
                </div>
            `).join('')}
        </div>
         <div class="start-test-container"><button id="back-to-menu-btn" class="oir-nav-btn">Back to Screening Menu</button></div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}
// ... (renderErrorPage remains unchanged) ...
function renderErrorPage(title, message) { /* ... unchanged ... */ 
     exitTestMode(); // Ensure we're not stuck in test mode if an error occurs
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
/**
 * Main entry point for the screening page.
 * Waits for the header to be ready, then renders the correct content.
 */
async function initializePage() {
    try {
        await appInitialized; // Wait for main.js to render header and initialize auth
        
        // Check if we are resuming an OIR test
        if (sessionStorage.getItem('oirTestState')) {
            initializeOIRTest(); // Resume the test directly
        } else if (pageContent) {
            renderScreeningMenu(); // Show the main menu
        }
    } catch (error) {
        console.error("Failed to initialize screening page:", error);
        if(pageContent) pageContent.innerHTML = `<p style="text-align: center; color: var(--error-red);">Error loading page. Please refresh.</p>`;
    }
}

// Start the page logic
initializePage();

