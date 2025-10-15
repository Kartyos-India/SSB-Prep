// js/screening.js - Manages the entire screening test flow.
import { auth, db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp } from './firebase-init.js';


// Get the main content area of the page.
const pageContent = document.getElementById('page-content');

// --- STATE MANAGEMENT ---
// These variables will hold the state of the OIR test while it's active.
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};
let oirTimerInterval;

/**
 * Renders the initial menu where the user chooses between OIR and PPDT tests.
 */
function renderScreeningMenu() {
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


// --- OIR TEST LOGIC ---

/**
 * Starts the OIR test by fetching questions from our serverless function.
 */
async function initializeOIRTest() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>OIR Test</h1>
            <div class="loader"></div>
            <p style="margin-top: 1rem;">Generating your test questions... Please wait.</p>
        </div>
    `;

    try {
        const response = await fetch('/api/generate-oir-questions');
        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }
        oirQuestions = await response.json();

        if (!Array.isArray(oirQuestions) || oirQuestions.length === 0) {
             throw new Error('Invalid question format received from API.');
        }

        // Reset state and start the test
        currentOIRIndex = 0;
        oirResponses = {};
        startOIRTimer();
        renderOIRQuestion();

    } catch (error) {
        console.error("Failed to initialize OIR test:", error);
        pageContent.innerHTML = `
            <div class="page-title-section">
                <h1>Error</h1>
                <p>Could not load the OIR test questions. Please try again later.</p>
                <button id="back-to-menu" class="start-btn" style="margin-top: 2rem;">Back to Menu</button>
            </div>
        `;
        document.getElementById('back-to-menu').addEventListener('click', renderScreeningMenu);
    }
}

/**
 * Starts the 30-minute countdown timer for the OIR test.
 */
function startOIRTimer() {
    let timeLeft = 1800; // 30 minutes in seconds
    const timerDisplay = document.getElementById('oir-timer');

    oirTimerInterval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (document.getElementById('oir-timer')) {
             document.getElementById('oir-timer').textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (timeLeft <= 0) {
            clearInterval(oirTimerInterval);
            submitOIRTest();
        }
    }, 1000);
}

/**
 * Renders the current OIR question, options, and navigation.
 */
function renderOIRQuestion() {
    const question = oirQuestions[currentOIRIndex];
    
    // The main test UI is rendered only once, then its content is updated.
    if (!document.getElementById('oir-test-container')) {
        pageContent.innerHTML = `
            <div id="oir-test-container">
                <div class="oir-header">
                    <div class="oir-progress">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</div>
                    <div class="oir-timer-box">
                        Time Left: <span id="oir-timer">30:00</span>
                    </div>
                </div>
                <div id="oir-question-content"></div>
            </div>
        `;
    }

    // Update the progress indicator
    document.querySelector('.oir-progress').textContent = `Question ${currentOIRIndex + 1} of ${oirQuestions.length}`;

    // Render the question content
    const questionContent = document.getElementById('oir-question-content');
    questionContent.innerHTML = `
        <div class="oir-question-card">
            <p class="oir-question-text">${currentOIRIndex + 1}. ${question.q}</p>
            <div class="oir-options">
                ${question.options.map((option, index) => `
                    <label>
                        <input type="radio" name="oir_option" value="${option}" ${oirResponses[currentOIRIndex] === option ? 'checked' : ''}>
                        <div class="oir-option-button">
                           <span class="option-letter">${String.fromCharCode(65 + index)}</span> ${option}
                        </div>
                    </label>
                `).join('')}
            </div>
        </div>
        <div class="oir-navigation">
            <button id="oir-prev-btn" class="oir-nav-btn" ${currentOIRIndex === 0 ? 'disabled' : ''}>Previous</button>
            ${currentOIRIndex === oirQuestions.length - 1 
                ? `<button id="oir-finish-btn" class="oir-finish-btn">Finish Test</button>`
                : `<button id="oir-next-btn" class="oir-nav-btn">Next</button>`
            }
        </div>
    `;
    
    // Add event listeners for navigation
    if (document.getElementById('oir-prev-btn')) {
        document.getElementById('oir-prev-btn').addEventListener('click', () => navigateOIR('prev'));
    }
    if (document.getElementById('oir-next-btn')) {
        document.getElementById('oir-next-btn').addEventListener('click', () => navigateOIR('next'));
    }
    if (document.getElementById('oir-finish-btn')) {
        document.getElementById('oir-finish-btn').addEventListener('click', submitOIRTest);
    }
}

/**
 * Handles navigation between OIR questions.
 * @param {'prev' | 'next'} direction The direction to navigate.
 */
function navigateOIR(direction) {
    // Save the current answer before moving
    const selectedOption = document.querySelector('input[name="oir_option"]:checked');
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    if (direction === 'next' && currentOIRIndex < oirQuestions.length - 1) {
        currentOIRIndex++;
    } else if (direction === 'prev' && currentOIRIndex > 0) {
        currentOIRIndex--;
    }
    renderOIRQuestion();
}

/**
 * Submits the test, calculates the score, and displays the review screen.
 */
async function submitOIRTest() {
    clearInterval(oirTimerInterval);
    // Save the very last answer
    const selectedOption = document.querySelector('input[name="oir_option"]:checked');
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    let score = 0;
    oirQuestions.forEach((q, index) => {
        if (oirResponses[index] === q.answer) {
            score++;
        }
    });

    // Save the result to Firebase
    const user = auth.currentUser;
    if (user && db) {
        try {
            await addDoc(collection(db, 'users', user.uid, 'tests'), {
                testType: 'OIR Test',
                score: score,
                total: oirQuestions.length,
                timestamp: serverTimestamp(),
                responses: oirResponses // Optionally save all responses
            });
        } catch (error) {
            console.error("Error saving OIR results to Firestore:", error);
        }
    }

    renderOIRReview(score);
}

/**
 * Renders the final review screen with the score and answer breakdown.
 * @param {number} score The user's final score.
 */
function renderOIRReview(score) {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>OIR Test Complete</h1>
            <p>Your Score: <span class="oir-final-score">${score} / ${oirQuestions.length}</span></p>
        </div>
        <div class="oir-review-container">
            <h2>Answer Review</h2>
            ${oirQuestions.map((q, index) => {
                const userAnswer = oirResponses[index] || "Not Answered";
                const isCorrect = userAnswer === q.answer;
                return `
                    <div class="oir-review-item ${isCorrect ? 'correct' : 'incorrect'}">
                        <p class="review-question-text"><b>${index + 1}. ${q.q}</b></p>
                        <p>Your Answer: <span class="user-answer">${userAnswer}</span></p>
                        ${!isCorrect ? `<p>Correct Answer: <span class="correct-answer">${q.answer}</span></p>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        <div style="text-align: center; margin-top: 2rem;">
            <button id="back-to-menu" class="start-btn">Back to Screening Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu').addEventListener('click', renderScreeningMenu);
}


// --- PPDT SETUP LOGIC (remains the same as before) ---

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
                <div class="option-group">
                    <label>
                        <input type="radio" name="gender" value="male" class="setup-option">
                        <div class="option-button">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z"/></svg>
                            <span>Male</span>
                        </div>
                    </label>
                    <label>
                        <input type="radio" name="gender" value="female" class="setup-option">
                        <div class="option-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
                            <span>Female</span>
                        </div>
                    </label>
                </div>
            </div>
            <div class="setup-step">
                <h2>Step 2: Choose PPDT Mode</h2>
                <p>Select whether you want a timed or untimed experience for the story writing part.</p>
                <div class="option-group">
                    <label>
                        <input type="radio" name="ppdt-mode" value="timed" class="setup-option">
                        <div class="option-button">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Timed</span>
                        </div>
                    </label>
                    <label>
                        <input type="radio" name="ppdt-mode" value="untimed" class="setup-option">
                        <div class="option-button">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            <span>Untimed</span>
                        </div>
                    </label>
                </div>
            </div>
            <div class="setup-step" id="timer-visibility-step" style="display: none;">
                <h2>Step 3: Timer Visibility</h2>
                <p>Choose if the timer should be visible during the timed test.</p>
                <div class="option-group">
                    <label>
                        <input type="radio" name="timer-visibility" value="visible" class="setup-option">
                        <div class="option-button">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span>Visible</span>
                        </div>
                    </label>
                    <label>
                        <input type="radio" name="timer-visibility" value="invisible" class="setup-option">
                        <div class="option-button">
                           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            <span>Invisible</span>
                        </div>
                    </label>
                </div>
            </div>
            <div class="start-test-container">
                <button id="start-screening-test" class="start-btn" disabled>Start PPDT</button>
            </div>
        </div>
    `;
    attachPPDTSetupLogic();
}

function attachPPDTSetupLogic() {
    const ppdtModeRadios = document.querySelectorAll('input[name="ppdt-mode"]');
    const timerVisibilityStep = document.getElementById('timer-visibility-step');
    const startTestButton = document.getElementById('start-screening-test');
    const allOptions = document.querySelectorAll('.setup-option');

    function validateSelections() {
        const selectedGender = document.querySelector('input[name="gender"]:checked');
        const selectedPpdtMode = document.querySelector('input[name="ppdt-mode"]:checked');
        const selectedTimerVisibility = document.querySelector('input[name="timer-visibility"]:checked');

        let isReady = false;
        if (selectedGender && selectedPpdtMode) {
            if (selectedPpdtMode.value === 'untimed') {
                isReady = true;
            } else if (selectedPpdtMode.value === 'timed' && selectedTimerVisibility) {
                isReady = true;
            }
        }
        startTestButton.disabled = !isReady;
    }

    function handlePPDTModeChange() {
        const selectedPpdtMode = document.querySelector('input[name="ppdt-mode"]:checked');
        if (selectedPpdtMode && selectedPpdtMode.value === 'timed') {
            timerVisibilityStep.style.display = 'block';
        } else {
            timerVisibilityStep.style.display = 'none';
        }
    }

    ppdtModeRadios.forEach(radio => radio.addEventListener('change', handlePPDTModeChange));
    allOptions.forEach(option => option.addEventListener('change', validateSelections));
    
    startTestButton.addEventListener('click', () => {
        alert("Starting PPDT test... (functionality to be added)");
    });

    handlePPDTModeChange();
    validateSelections();
}

// --- INITIAL EXECUTION ---
renderScreeningMenu();

