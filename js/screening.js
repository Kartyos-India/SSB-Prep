// js/screening.js - Manages the entire screening test flow, including custom question uploads.

// Import Firebase services for saving results
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

        <!-- New Custom Question Bank Section -->
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

            // Remove header row if it exists
            if (json.length > 0 && json[0][0].toLowerCase().includes('question')) {
                json.shift();
            }

            const customQuestions = json.map(row => {
                if (row.length < 6 || row.some(cell => cell === null || cell === undefined)) {
                    return null; // Skip incomplete rows
                }
                return {
                    q: row[0],
                    options: [row[1], row[2], row[3], row[4]],
                    answer: row[5]
                };
            }).filter(q => q !== null); // Filter out any null (skipped) rows

            if (customQuestions.length === 0) {
                 throw new Error("No valid questions found. Please check the file format and content.");
            }

            // Save to localStorage
            localStorage.setItem('customOIRQuestions', JSON.stringify(customQuestions));
            
            statusDiv.textContent = `Successfully loaded ${customQuestions.length} custom questions! They will be included in your next OIR test.`;
            statusDiv.className = 'upload-status success';

        } catch (error) {
            console.error("Error processing Excel file:", error);
            statusDiv.textContent = `Error: ${error.message}`;
            statusDiv.className = 'upload-status error';
        }
    };
    
    reader.onerror = () => {
        statusDiv.textContent = 'Error reading the file.';
        statusDiv.className = 'upload-status error';
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
        // Step 1: Fetch default questions from the API
        const response = await fetch('/api/generate-oir-questions');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'The server returned an error.');
        }
        let defaultQuestions = await response.json();

        // Step 2: Get custom questions from localStorage
        let customQuestions = [];
        const customQuestionsJSON = localStorage.getItem('customOIRQuestions');
        if (customQuestionsJSON) {
            customQuestions = JSON.parse(customQuestionsJSON);
        }

        // Step 3: Merge and shuffle the question pools
        const combinedPool = [...defaultQuestions, ...customQuestions];

        // Fisher-Yates shuffle algorithm
        for (let i = combinedPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [combinedPool[i], combinedPool[j]] = [combinedPool[j], combinedPool[i]];
        }

        // Step 4: Select the final 50 questions for the test
        oirQuestions = combinedPool.slice(0, 50);
        
        if (oirQuestions.length < 50) {
            console.warn(`Warning: Only ${oirQuestions.length} questions available for the test.`);
        }

        // Reset test state and render the first question
        currentOIRIndex = 0;
        oirResponses = {};
        renderOIRQuestion();
        startOIRTimer();
    } catch (error) {
        console.error("Failed to initialize OIR Test:", error);
        renderErrorPage("Could not load the OIR test questions.", error.message);
    }
}


// --- All other functions (renderOIRQuestion, startOIRTimer, renderPPDTSetup, etc.) remain the same ---
// (Paste the existing functions from the previous version of screening.js here)
// ...

// --- UTILITY AND RENDER FUNCTIONS ---
function renderErrorPage(title, message) {
    pageContent.innerHTML = `
        <div class="page-title-section text-center">
            <h1 class="error-title">${title}</h1>
            <p>${message}</p>
            <button id="back-to-menu-btn" class="oir-nav-btn">Back to Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}

// Ensure this file is loaded after the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initial render of the screening page menu.
    if (pageContent) {
        renderScreeningMenu();
    }
});

