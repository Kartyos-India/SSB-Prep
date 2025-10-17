// js/screening.js - Manages the entire screening test flow, including custom question uploads.

// Import Firebase services, including the firebaseReady promise
import { firebaseReady, auth, db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp } from './firebase-init.js';

const pageContent = document.getElementById('page-content');

// --- OIR TEST STATE (Global) ---
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};
let oirTimerInterval;

// --- INITIAL RENDER ---
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

        <!-- Custom Question Bank Section -->
        <div class="custom-questions-section">
             <div class="section-title-bar">
                <h2>Custom Question Bank</h2>
                <span class="beta-tag">Beta</span>
            </div>
            <p>Upload your own OIR questions from an Excel file (.xlsx) to expand your practice set. The questions you upload are stored only in your browser.</p>
            <div class="upload-area">
                <input type="file" id="excel-file-input" accept=".xlsx" style="display: none;">
                <button id="upload-excel-btn" class="upload-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>Choose Excel File</span>
                </button>
                <span id="file-name-display" class="file-name">No file selected.</span>
            </div>
            <div id="upload-status" class="upload-status"></div>
             <p class="format-info"><strong>Required Format:</strong> The Excel file must have 6 columns in this order: Question, Option A, Option B, Option C, Option D, Correct Answer.</p>
        </div>
    `;

    document.getElementById('start-oir-test').addEventListener('click', initializeOIRTest);
    document.getElementById('setup-ppdt-test').addEventListener('click', renderPPDTSetup);
    
    // Logic for the new upload feature
    const fileInput = document.getElementById('excel-file-input');
    const uploadButton = document.getElementById('upload-excel-btn');
    const fileNameDisplay = document.getElementById('file-name-display');

    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            fileNameDisplay.textContent = file.name;
            handleExcelUpload(file);
        }
    });
}


/**
 * Handles the Excel file upload, parsing, and storage.
 * @param {File} file The Excel file selected by the user.
 */
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

            if (json.length < 1) {
                throw new Error("The Excel file is empty.");
            }

            if (json[0][0] && typeof json[0][0] === 'string' && json[0][0].toLowerCase().includes('question')) {
                json.shift();
            }

            const customQuestions = json.map((row, index) => {
                if (row.length < 6 || row.slice(0, 6).some(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
                    console.warn(`Skipping incomplete row ${index + 1}:`, row);
                    return null; 
                }
                return {
                    q: String(row[0]).trim(),
                    options: [String(row[1]).trim(), String(row[2]).trim(), String(row[3]).trim(), String(row[4]).trim()],
                    answer: String(row[5]).trim()
                };
            }).filter(q => q !== null); 

            if (customQuestions.length === 0) {
                 throw new Error("No valid questions found. Please check the file format: 6 columns are required per question.");
            }

            localStorage.setItem('customOIRQuestions', JSON.stringify(customQuestions));
            
            statusDiv.textContent = `Successfully loaded ${customQuestions.length} custom questions! They will be included in your next OIR test.`;
            statusDiv.className = 'upload-status success visible';

        } catch (error) {
            console.error("Error processing Excel file:", error);
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'upload-status error visible';
        }
    };
    
    reader.onerror = () => {
        statusDiv.textContent = 'Error reading the file.';
        statusDiv.className = 'upload-status error visible';
    };

    reader.readAsArrayBuffer(file);
}


/**
 * Initializes the OIR test. Fetches default questions, merges with custom ones, and starts the test.
 */
async function initializeOIRTest() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>OIR Test</h1>
            <div class="loader"></div>
            <p>Generating your unique test... Please wait.</p>
        </div>
    `;
    try {
        const response = await fetch('/api/generate-oir-questions');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch questions: ${response.status} ${errorText}`);
        }
        let defaultQuestions = await response.json();

        let customQuestions = [];
        const customQuestionsJSON = localStorage.getItem('customOIRQuestions');
        if (customQuestionsJSON) {
            customQuestions = JSON.parse(customQuestionsJSON);
        }

        const combinedPool = [...defaultQuestions, ...customQuestions];

        for (let i = combinedPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [combinedPool[i], combinedPool[j]] = [combinedPool[j], combinedPool[i]];
        }

        oirQuestions = combinedPool.slice(0, 50);
        
        if (oirQuestions.length === 0) {
            throw new Error("No questions available to start the test. Please check the API or upload a custom file.");
        }

        currentOIRIndex = 0;
        oirResponses = {};
        renderOIRQuestion();
        startOIRTimer();
    } catch (error) {
        console.error("Failed to initialize OIR Test:", error);
        renderErrorPage("Could not load the OIR test questions.", error.message);
    }
}


/**
 * Renders the current OIR question on the page.
 */
function renderOIRQuestion() {
    const question = oirQuestions[currentOIRIndex];

    pageContent.innerHTML = `
        <div class="oir-test-container">
            <div class="oir-header">
                <div class="oir-progress">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</div>
                <div class="oir-timer">Time Left: <span id="timer-display">30:00</span></div>
            </div>
            <div class="oir-question-card">
                <p class="oir-question-text">${question.q}</p>
                <div class="oir-options">
                    ${question.options.map((opt, index) => `
                        <label class="oir-option-label">
                            <input type="radio" name="oir-option" value="${opt}" ${oirResponses[currentOIRIndex] === opt ? 'checked' : ''}>
                            ${opt}
                        </label>
                    `).join('')}
                </div>
                <div class="oir-navigation">
                    <button id="oir-prev-btn" class="oir-nav-btn">Previous</button>
                    <button id="oir-next-btn" class="oir-nav-btn">Next</button>
                    <button id="oir-finish-btn" class="oir-nav-btn finish">Finish Test</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('oir-prev-btn').style.visibility = (currentOIRIndex === 0) ? 'hidden' : 'visible';
    document.getElementById('oir-next-btn').style.display = (currentOIRIndex === oirQuestions.length - 1) ? 'none' : 'block';
    document.getElementById('oir-finish-btn').style.display = (currentOIRIndex === oirQuestions.length - 1) ? 'block' : 'none';

    document.getElementById('oir-prev-btn').addEventListener('click', () => navigateOIR('prev'));
    document.getElementById('oir-next-btn').addEventListener('click', () => navigateOIR('next'));
    document.getElementById('oir-finish-btn').addEventListener('click', submitOIRTest);

    const options = document.querySelectorAll('input[name="oir-option"]');
    options.forEach(option => option.addEventListener('change', saveOIRResponse));
}

function saveOIRResponse() {
    const selected = document.querySelector('input[name="oir-option"]:checked');
    if (selected) {
        oirResponses[currentOIRIndex] = selected.value;
    }
}

function navigateOIR(direction) {
    saveOIRResponse();
    if (direction === 'next' && currentOIRIndex < oirQuestions.length - 1) {
        currentOIRIndex++;
        renderOIRQuestion();
    } else if (direction === 'prev' && currentOIRIndex > 0) {
        currentOIRIndex--;
        renderOIRQuestion();
    }
}

function startOIRTimer() {
    let timeLeft = 1800; // 30 minutes in seconds
    const timerDisplay = document.getElementById('timer-display');
    
    oirTimerInterval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        if (timeLeft <= 0) {
            clearInterval(oirTimerInterval);
            submitOIRTest();
        }
    }, 1000);
}

async function submitOIRTest() {
    clearInterval(oirTimerInterval);
    saveOIRResponse();

    let score = 0;
    for (let i = 0; i < oirQuestions.length; i++) {
        if (oirResponses[i] === oirQuestions[i].answer) {
            score++;
        }
    }

    try {
        await firebaseReady;
        const user = auth.currentUser;
        if (user && db) {
            await addDoc(collection(db, 'users', user.uid, 'tests'), {
                testType: 'OIR Test',
                score: score,
                total: oirQuestions.length,
                timestamp: serverTimestamp()
            });
        }
    } catch (error) {
        console.error("Error saving OIR results:", error);
    }
    
    renderOIRResults(score);
}

function renderOIRResults(score) {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>OIR Test Results</h1>
        </div>
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
         <div class="start-test-container">
            <button id="back-to-menu-btn" class="oir-nav-btn">Back to Screening Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}

function renderPPDTSetup() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>PPDT Setup</h1>
            <p>This feature is coming soon!</p>
             <div class="start-test-container">
                <button id="back-to-menu-btn" class="oir-nav-btn">Back to Screening Menu</button>
            </div>
        </div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}


function renderErrorPage(title, message) {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1 class="error-title">Error</h1>
            <p>${title}</p>
            <p>${message}</p>
            <button id="back-to-menu-btn" class="oir-nav-btn">Back to Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}

// *** THE FIX IS HERE ***
// We create an async function to initialize the page.
async function initializePage() {
    try {
        // First, we wait for the main app (and Firebase) to be ready.
        // This ensures main.js has finished rendering the header.
        await firebaseReady;

        // Now that the header is definitely on the page, we can safely
        // render our screening menu.
        if (pageContent) {
            renderScreeningMenu();
        }
    } catch (error) {
        console.error("Failed to initialize the screening page:", error);
        if(pageContent){
            pageContent.innerHTML = `<p>Error loading page. Please try again.</p>`;
        }
    }
}

// We call our new initialization function instead of using a DOMContentLoaded listener.
initializePage();

