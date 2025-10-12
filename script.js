// --- Firebase Module Imports ---
// These are passed via the global window object from the external script imports in index.html
const { 
    initializeApp, getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
    getFirestore, collection, addDoc, query, getDocs, doc, getDoc, orderBy
} = window.FirebaseModules;


// --- Global State and Service Management (from shared.js) ---
let app, auth, db;
let userId;

// --- DOM Elements (from shared.js) ---
const authLoader = document.getElementById('auth-loader');
const mainContent = document.getElementById('main-content');
const topNav = document.getElementById('top-nav');
const headerRight = document.getElementById('header-right');
const arenaContainer = document.querySelector('.arena-container'); 

// --- Test State Flags ---
let isTestActive = false; // Tracks if a test is currently running
let ppdtMediaStream = null; // Reference to the PPDT media stream

// --- Fullscreen Utility Functions (Unchanged) ---
function enterFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
        document.documentElement.msRequestFullscreen();
    }
}

function exitFullscreenProgrammatically() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { 
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { 
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

function handleFullscreenChange() {
    if (isTestActive && !document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        alert("Warning: Exiting full screen mode has aborted the test. Please use the 'Abort Test' button if you wish to exit without losing data.");
        abortTest(); 
    }
}

function setupFullscreenListener(shouldAdd) {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    document.removeEventListener('MSFullscreenChange', handleFullscreenChange);

    if (shouldAdd) {
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }
}


// --- Firebase Initialization (Unchanged) ---
async function initializeAppWithRemoteConfig() {
    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get-config' })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to fetch Firebase config from server.");
        }
        const firebaseConfig = await response.json();

        if (!firebaseConfig.apiKey) {
            throw new Error("Invalid Firebase config received from server.");
        }
        
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        return { auth, db };

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        if(authLoader) {
             authLoader.innerHTML = `<p class="text-red-500 text-lg font-semibold">Configuration Error</p><p class="text-yellow-400 mt-2">${error.message}</p>`;
        }
        return {};
    }
}

// --- Navigation and Utility Functions ---

function showScreen(screenId) {
    if (mainContent) {
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-screen="${screenId}"]`);
        if(activeLink) activeLink.classList.add('active');

        Array.from(mainContent.children).forEach(child => child.classList.add('hidden'));
        const screen = document.getElementById(screenId);
        if(screen) screen.classList.remove('hidden');
    }
}

function renderLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) return;
    
    loginScreen.innerHTML = `
        <div class="text-center mb-10">
            <h2 class="text-4xl md:text-5xl font-bold text-gray-700">WELCOME, CANDIDATE</h2>
            <p class="text-gray-500 mt-2">Sign in to track your progress.</p>
        </div>
        <div class="max-w-xs mx-auto space-y-4">
            <button id="google-signin-btn" class="w-full primary-btn font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3">
                <svg class="w-6 h-6" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 36.49 44 30.823 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
                Sign in with Google
            </button>
        </div>`;
    
    document.getElementById('google-signin-btn').addEventListener('click', (e) => {
        e.preventDefault(); 
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => console.error(error));
    });
}

function handleAuthState(user) {
    if (authLoader) authLoader.classList.add('hidden');
    
    if (user) {
        userId = user.uid; // Set global userId
        if (headerRight) {
            headerRight.innerHTML = `
                <span class="text-gray-200">${user.displayName || user.email}</span>
                <button id="logout-btn" class="back-btn py-1 px-3 rounded-lg bg-white text-gray-700">Logout</button>
            `;
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        }
        if (topNav) {
             if (window.innerWidth >= 640) {
                 topNav.classList.remove('hidden');
             } else {
                 topNav.classList.add('hidden');
             }
        }

        if (document.getElementById('login-screen').classList.contains('hidden') && 
            document.getElementById('home-screen').classList.contains('hidden')) {
            renderHomeScreen();
        }
        
    } else {
        exitFullscreenProgrammatically(); 
        setupFullscreenListener(false); 

        if (headerRight) headerRight.innerHTML = `
            <button id="mobile-menu-btn" class="sm:hidden p-2 rounded-lg bg-blue-700 text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
        `;
        const mobileBtn = document.getElementById('mobile-menu-btn');
        if (mobileBtn) setupMobileMenuToggle(mobileBtn);
        
        if (topNav) topNav.classList.add('hidden');
        renderLoginScreen();
        showScreen('login-screen');
    }
}

function getTemplateContent(templateId) {
    const template = document.getElementById('templates').querySelector(`#${templateId}`);
    return template ? template.content.cloneNode(true) : null;
}

function addGoBackButton(screenElement, targetScreenFunction) {
    const header = screenElement.querySelector('.text-center');
    if (header) {
        const backButton = document.createElement('button');
        backButton.className = 'back-btn py-1 px-3 rounded-lg absolute top-4 left-4 font-bold bg-gray-200 text-gray-700';
        backButton.textContent = '← Back';
        backButton.addEventListener('click', targetScreenFunction);
        header.style.position = 'relative'; 
        header.prepend(backButton);
    }
}

/**
 * Aborts the current test, cleans up resources, and returns to the appropriate menu.
 */
function abortTest() {
    isTestActive = false; // Disable warning
    clearInterval(timerInterval); // Stop any running timer
    
    // Attempt to stop media stream if active (for PPDT)
    if (ppdtMediaStream) {
        ppdtMediaStream.getTracks().forEach(track => track.stop());
        ppdtMediaStream = null;
    }

    exitFullscreenProgrammatically();
    setupFullscreenListener(false); 
    
    if (topNav) topNav.classList.remove('hidden');

    if (appState.testType === 'PPDT') {
        renderPPDTSettingsScreen();
    } else if (['TAT', 'WAT', 'SRT'].includes(appState.testType)) {
        renderPsychologyMenu();
    } else if (appState.testType === 'OIR') {
        renderScreeningMenu(); // Return to Screening Menu for OIR
    } else {
        renderHomeScreen();
    }
}

// Function to inject the Abort button into the current test stage
function addAbortButtonToStage(screen) {
    const stageHeader = screen.querySelector('.flex.justify-between.items-center');
    const h2 = stageHeader ? stageHeader.querySelector('h2') : null;
    
    if (h2) {
        const abortBtn = document.createElement('button');
        abortBtn.className = 'back-btn py-1 px-3 rounded-lg text-sm ml-4 inline-block primary-btn';
        abortBtn.textContent = 'Abort Test';
        abortBtn.addEventListener('click', abortTest);
        h2.appendChild(abortBtn); 
    }
}

// --- Home Screen Logic ---
function renderHomeScreen() {
    const homeScreen = document.getElementById('home-screen');
    // FIX: Load the new structured home-screen-template
    const template = getTemplateContent('home-screen-template');
    
    if (template) {
        homeScreen.innerHTML = '';
        homeScreen.appendChild(template);
    } else {
         homeScreen.innerHTML = `<div class="text-center mt-20"><p class="text-red-500 font-semibold">Error: Home Screen Template Missing.</p></div>`;
    }
    
    // Attach event listeners for selection buttons inside the template
    homeScreen.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetAction = btn.getAttribute('onclick');
            if (targetAction.includes('renderScreeningMenu')) renderScreeningMenu();
            if (targetAction.includes('renderPsychologyMenu')) renderPsychologyMenu();
            if (targetAction.includes('renderGTOPlaceholderScreen')) renderGTOPlaceholderScreen();
        });
    });
    
    showScreen('home-screen');
}


// --- Dropdown Navigation Handlers ---

function handleTestSelection(e) {
    e.preventDefault();
    const target = e.target.closest('a');
    if (!target) return;
    
    // Close all dropdowns
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    
    const screenId = target.dataset.screen;
    const testType = target.dataset.testType;
    const action = target.dataset.action;

    if (screenId === 'ppdt-settings-screen') {
        renderPPDTSettingsScreen();
    } else if (screenId === 'gto-placeholder-screen') {
        renderGTOPlaceholderScreen();
    } else if (action === 'start-test' && testType === 'OIR') {
        initializeOIRTest();
    } else if (['TAT', 'WAT', 'SRT'].includes(testType)) {
        initializePsyTest({ testType: testType });
    }
    
    // Close mobile menu if open
    if (topNav && window.innerWidth < 640) topNav.classList.add('hidden');
}

function setupMobileMenuToggle(mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        topNav.classList.toggle('hidden');
        
        // Hide all inner dropdowns when the main menu opens/closes
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    });
}

// Global functions for direct calls from HTML (e.g., onclick="renderScreeningMenu()")
window.renderScreeningMenu = renderScreeningMenu;
window.renderPsychologyMenu = renderPsychologyScreen; 
window.renderGTOPlaceholderScreen = renderGTOPlaceholderScreen;
window.handleTestSelection = handleTestSelection;


// --- OIR Test Logic ---
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};
const OIR_QUESTION_COUNT = 10; 

function initializeOIRTest() {
    isTestActive = true;
    if (topNav) topNav.classList.add('hidden');
    setupFullscreenListener(true); 
    enterFullscreen(); 
    
    const screen = document.getElementById('test-screen');
    screen.innerHTML = '';
    const template = getTemplateContent('oir-test-screen-template');
    if (template) {
        screen.appendChild(template);
    }

    // Mock Questions (In a real app, this would fetch from the server)
    oirQuestions = [
        { q: "If A = 1 and B = 2, then Z = ?", options: ["24", "25", "26", "27"], answer: "26" },
        { q: "Which number completes the series: 2, 4, 8, 16, __?", options: ["20", "24", "32", "40"], answer: "32" },
        { q: "Find the odd one out: Car, Bus, Bicycle, Ship.", options: ["Car", "Bus", "Bicycle", "Ship"], answer: "Ship" },
        { q: "If 'BIRD' is coded as 'CISC', how is 'FLOWER' coded?", options: ["GMQWFQ", "G M P X F R", "GMPXFR", "E K N X D Q"], answer: "GMPXFR" },
        { q: "The next letter in the series: A, C, E, G, __?", options: ["H", "I", "J", "K"], answer: "I" },
        { q: "Which word does not belong: Apple, Banana, Potato, Orange?", options: ["Apple", "Banana", "Potato", "Orange"], answer: "Potato" },
        { q: "How many months have 28 days?", options: ["One", "Two", "All", "None"], answer: "All" },
        { q: "If you reorganize the letters 'CIFAIP C', you get the name of a/an:", options: ["Country", "City", "Ocean", "River"], answer: "Ocean" },
        { q: "If 1/3 of a number is 6, what is the number?", options: ["18", "12", "9", "3"], answer: "18" },
        { q: "Which figure comes next in the sequence?", options: ["A", "B", "C", "D"], answer: "C" },
    ];
    
    currentOIRIndex = 0;
    oirResponses = {};
    renderOIRQuestion();
    
    document.getElementById('oir-next-btn').addEventListener('click', handleOIRNavigation);
    document.getElementById('oir-prev-btn').addEventListener('click', handleOIRNavigation);
    document.getElementById('oir-finish-btn').addEventListener('click', submitOIRTest);

    showScreen('test-screen');
}

function renderOIRQuestion() {
    if (currentOIRIndex < 0) currentOIRIndex = 0;
    if (currentOIRIndex >= oirQuestions.length) currentOIRIndex = oirQuestions.length - 1;

    const container = document.getElementById('oir-question-container');
    const question = oirQuestions[currentOIRIndex];

    container.innerHTML = `
        <p class="text-lg text-gray-700 font-semibold">Question ${currentOIRIndex + 1}/${oirQuestions.length}: ${question.q}</p>
        <div class="space-y-2">
            ${question.options.map((opt, index) => `
                <label class="block bg-gray-50 p-3 rounded-md border cursor-pointer hover:bg-gray-100">
                    <input type="radio" name="oir_q${currentOIRIndex}" value="${opt}" class="mr-2" ${oirResponses[currentOIRIndex] === opt ? 'checked' : ''}> ${opt}
                </label>
            `).join('')}
        </div>
    `;

    const prevBtn = document.getElementById('oir-prev-btn');
    const nextBtn = document.getElementById('oir-next-btn');
    const finishBtn = document.getElementById('oir-finish-btn');

    prevBtn.classList.toggle('hidden', currentOIRIndex === 0);
    nextBtn.classList.toggle('hidden', currentOIRIndex === oirQuestions.length - 1);
    finishBtn.classList.toggle('hidden', currentOIRIndex !== oirQuestions.length - 1);
}

function handleOIRNavigation(e) {
    const action = e.target.id;
    
    // Save current response before moving
    const selectedOption = document.querySelector(`input[name="oir_q${currentOIRIndex}"]:checked`);
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    if (action === 'oir-next-btn') {
        currentOIRIndex++;
    } else if (action === 'oir-prev-btn') {
        currentOIRIndex--;
    }
    renderOIRQuestion();
}

function submitOIRTest() {
    isTestActive = false;
    exitFullscreenProgrammatically();
    setupFullscreenListener(false);
    if (topNav) topNav.classList.remove('hidden');

    // Final save of last question
    const selectedOption = document.querySelector(`input[name="oir_q${currentOIRIndex}"]:checked`);
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    let score = 0;
    const verificationList = oirQuestions.map((q, index) => {
        const userAnswer = oirResponses[index];
        const isCorrect = userAnswer === q.answer;
        if (isCorrect) score++;

        return `
            <div class="p-4 rounded-lg shadow ${isCorrect ? 'bg-green-100 border border-green-400' : 'bg-red-100 border border-red-400'}">
                <p class="font-bold text-gray-800">${index + 1}. ${q.q}</p>
                <p class="mt-1 text-sm">Your Answer: <span class="${isCorrect ? 'text-green-600' : 'text-red-600 font-bold'}">${userAnswer || 'No Answer'}</span></p>
                <p class="text-sm">Correct Answer: <span class="text-green-600 font-bold">${q.answer}</span></p>
            </div>
        `;
    }).join('');

    const reviewScreen = document.getElementById('review-screen');
    reviewScreen.innerHTML = `
        <div class="text-center mb-10">
            <h2 class="text-4xl md:text-5xl font-bold text-gray-700">OIR TEST COMPLETE</h2>
            <p class="text-3xl font-semibold mt-4 ${score > oirQuestions.length / 2 ? 'text-green-600' : 'text-red-600'}">Your Score: ${score} / ${oirQuestions.length}</p>
            <p class="text-gray-500 mt-2">Review the detailed answers below.</p>
        </div>
        <div class="space-y-4 max-w-3xl mx-auto">
            <h3 class="text-2xl font-bold text-gray-700 border-b pb-2">Verification Report</h3>
            ${verificationList}
        </div>
        <button class="primary-btn font-bold py-3 px-8 rounded-lg mt-8" onclick="renderScreeningMenu()">Return to Screening Menu</button>
    `;
    showScreen('review-screen');
}

function renderScreeningMenu() {
    const screeningScreen = document.getElementById('ppdt-settings-screen');
    
    screeningScreen.innerHTML = `
        <div class="space-y-8">
            <div class="text-center">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-700">SCREENING TESTS</h2>
                <p class="text-gray-500 mt-2">Select a test module below.</p>
            </div>
            <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                 <div class="choice-card p-6 text-center flex flex-col items-center cursor-pointer" onclick="initializeOIRTest()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    <h3 class="text-xl font-bold text-gray-700 mt-3">OIR TEST</h3>
                    <p class="text-gray-500 mt-2 flex-grow text-sm">Officer Intelligence Rating: Aptitude Test.</p>
                    <button class="w-full primary-btn font-bold py-3 px-6 rounded-lg text-lg mt-6" onclick="initializeOIRTest()">START OIR</button>
                </div>

                <div class="choice-card p-6 text-center flex flex-col items-center cursor-pointer" onclick="renderPPDTSettingsScreen()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <h3 class="text-xl font-bold text-gray-700 mt-3">PPDT</h3>
                    <p class="text-gray-500 mt-2 flex-grow text-sm">Picture Perception and Discussion Test.</p>
                    <button class="w-full primary-btn font-bold py-3 px-6 rounded-lg text-lg mt-6" onclick="renderPPDTSettingsScreen()">CONFIGURE PPDT</button>
                </div>
            </div>
        </div>`;
    
    addGoBackButton(screeningScreen, renderHomeScreen);
    showScreen('ppdt-settings-screen');
}


// --- REST OF THE CODE (Unchanged for brevity, but included in the full script) ---

// --- Unified Test State and Timers ---
let timerInterval;

function formatTime(s) { /* ... same code ... */ }
function startTimer(duration, displayElement, onComplete) { /* ... same code ... */ }

// PPDT Logic
let ppdtMediaRecorder, ppdtRecordedChunks = [], ppdtVideoUrl = null, ppdtCurrentImageUrl = '';

function setupPPDTVideoControls(reviewVideo) { /* ... same code ... */ }
function showPPDTReview() { /* ... same code ... */ }
async function beginPPDTNarration(duration, timerDisplay) { /* ... same code ... */ }
async function generateAndLoadPPDTImage(onLoadCallback) { /* ... same code ... */ }
function runPPDTTestStage() { /* ... same code ... */ }
function initializePPDTTest(config) { /* ... same code ... */ }
function renderPPDTSettingsScreen() { /* ... same code ... */ }


// Psychology Logic
let testData = []; 
let testResponses = [];

function renderPsychologyScreen() { /* ... same code ... */ }
async function initializePsyTest(config) { /* ... same code ... */ }
function runPsyTestStage() { /* ... same code ... */ }
function setupPsyTestStageContent(config) { /* ... same code ... */ }
function finishPsyTest() { /* ... same code ... */ }
async function generateAndLoadTATImage(onLoadCallback) { /* ... same code ... */ }
function showPsyReview() { /* ... same code ... */ }
async function savePsyTestToFirebase(aiFeedback) { /* ... same code ... */ }
async function getAIFeedback() { /* ... same code ... */ }

// Account Logic
async function showPastTests() { /* ... same code ... */ }
async function viewPastTest(testId) { /* ... same code ... */ }


// --- Main Execution Logic ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Firebase services
    const { auth: initializedAuth, db: initializedDb } = await initializeAppWithRemoteConfig();

    if (initializedAuth && initializedDb) {
        auth = initializedAuth;
        db = initializedDb;
        
        // 2. Set up Nav Link Listeners
        topNav.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Ensure clicks on dropdown *containers* don't trigger simple navigation
                if (link.closest('.group')) return;
                
                e.preventDefault();
                const targetScreen = link.dataset.screen;
                if (!userId) {
                    renderLoginScreen();
                    showScreen('login-screen');
                    return; 
                }
                
                if (targetScreen === 'home-screen') {
                    renderHomeScreen();
                } else if (targetScreen === 'gto-placeholder-screen') {
                    renderGTOPlaceholderScreen();
                } else if (targetScreen === 'past-tests-screen') {
                    showPastTests();
                }

                // Close the mobile menu after selection
                if (topNav && window.innerWidth < 640) topNav.classList.add('hidden');
            });
        });

        // 3. Setup Dropdown Toggles and Handlers (for nested links)
        document.querySelectorAll('.dropdown-item').forEach(link => {
            link.addEventListener('click', handleTestSelection);
        });
        
        // Setup Mobile Menu Toggle (Hamburger button)
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        if (mobileMenuBtn) {
            mobileMenuBtn.addEventListener('click', () => {
                topNav.classList.toggle('hidden');
            });
        }
        
        // 4. Start Authentication Listener
        onAuthStateChanged(auth, handleAuthState);
    }
});

window.addEventListener('beforeunload', (e) => {
    if (isTestActive) {
        const message = 'You are currently in a test. Your progress (including unsaved WAT/SRT responses) will be lost if you leave or refresh.';
        e.preventDefault();
        e.returnValue = message;
        return message;
    }
});
