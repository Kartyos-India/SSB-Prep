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
const arenaContainer = document.querySelector('.arena-container'); // Get the main container

// --- Test State Flags ---
let isTestActive = false; // Tracks if a test is currently running
let ppdtMediaStream = null; // Reference to the PPDT media stream

// --- Fullscreen Utility Functions ---

/**
 * Attempts to enter fullscreen mode for the document body.
 */
function enterFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { // Firefox
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { // Chrome, Safari and Opera
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { // IE/Edge
        document.documentElement.msRequestFullscreen();
    }
}

/**
 * Programmatically exits fullscreen mode.
 */
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

/**
 * Event handler that aborts the test if the user exits fullscreen manually.
 */
function handleFullscreenChange() {
    // Check if the document is NOT in fullscreen mode AND the test is active
    if (isTestActive && !document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        alert("Warning: Exiting full screen mode has aborted the test. Please use the 'Abort Test' button if you wish to exit without losing data.");
        abortTest(); 
    }
}

/**
 * Sets up and removes the fullscreen change listener.
 */
function setupFullscreenListener(shouldAdd) {
    // Ensure cleanup happens first
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


// --- Helper Functions (from shared.js) ---

/**
 * Fetches the Firebase configuration from the serverless function and initializes the app.
 */
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

/**
 * Hides all main content screens and shows the one with the specified ID.
 */
function showScreen(screenId) {
    if (mainContent) {
        // Deactivate all nav links
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        // Activate the link for the current screen
        const activeLink = document.querySelector(`.nav-link[data-screen="${screenId}"]`);
        if(activeLink) activeLink.classList.add('active');

        // Show the screen
        Array.from(mainContent.children).forEach(child => child.classList.add('hidden'));
        const screen = document.getElementById(screenId);
        if(screen) screen.classList.remove('hidden');
    }
}

/**
 * Renders the Google Sign-in button.
 */
function renderLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) return;
    
    loginScreen.innerHTML = `
        <div class="text-center mb-10">
            <h2 class="text-4xl md:text-5xl font-bold text-white">WELCOME, CANDIDATE</h2>
            <p class="text-gray-400 mt-2">Sign in to track your progress.</p>
        </div>
        <div class="max-w-xs mx-auto space-y-4">
            <button id="google-signin-btn" class="w-full glow-btn font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3">
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

/**
 * Updates the header and top navigation based on the user's login state.
 */
function handleAuthState(user) {
    if (authLoader) authLoader.classList.add('hidden');
    
    if (user) {
        userId = user.uid; // Set global userId
        if (headerRight) {
            headerRight.innerHTML = `
                <span class="text-gray-400">${user.displayName || user.email}</span>
                <button id="logout-btn" class="back-btn py-1 px-3 rounded-lg">Logout</button>
            `;
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        }
        if (topNav) topNav.classList.remove('hidden');

        // Render home screen if no other screen is active
        if (document.getElementById('login-screen').classList.contains('hidden') && 
            document.getElementById('home-screen').classList.contains('hidden')) {
            renderHomeScreen();
        }
        
    } else {
        // FIX: Ensure fullscreen is canceled when logging out
        exitFullscreenProgrammatically(); 
        setupFullscreenListener(false); // Remove listener

        if (headerRight) headerRight.innerHTML = '';
        if (topNav) topNav.classList.add('hidden');
        renderLoginScreen();
        showScreen('login-screen');
    }
}

// Helper to get template content
function getTemplateContent(templateId) {
    const template = document.getElementById('templates').querySelector(`#${templateId}`);
    return template ? template.content.cloneNode(true) : null;
}

// Navigation Helper: Adds a back button
function addGoBackButton(screenElement, targetScreenFunction) {
    const header = screenElement.querySelector('.text-center');
    if (header) {
        const backButton = document.createElement('button');
        backButton.className = 'back-btn py-1 px-3 rounded-lg absolute top-4 left-4 font-bold';
        backButton.textContent = '← Back';
        backButton.addEventListener('click', targetScreenFunction);
        header.style.position = 'relative'; // Ensure header can position the button
        header.prepend(backButton);
    }
}

// --- Unified Test State and Timers ---
let appState = {};
let timerInterval;

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

    // Exit Fullscreen mode
    exitFullscreenProgrammatically();
    setupFullscreenListener(false); // Remove listener
    
    // Show navigation bar again
    if (topNav) topNav.classList.remove('hidden');


    // Determine the correct menu to return to
    if (appState.testType === 'PPDT') {
        renderPPDTSettingsScreen();
    } else if (['TAT', 'WAT', 'SRT'].includes(appState.testType)) {
        renderPsychologyScreen();
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
        abortBtn.className = 'back-btn py-1 px-3 rounded-lg text-sm ml-4 inline-block';
        abortBtn.textContent = 'Abort Test';
        abortBtn.addEventListener('click', abortTest);
        h2.appendChild(abortBtn); 
    }
}

// --- Home Screen Logic ---
function renderHomeScreen() {
    const homeScreen = document.getElementById('home-screen');
    homeScreen.innerHTML = `
        <div class="space-y-8">
            <div class="text-center">
                <h2 class="text-4xl md:text-5xl font-bold text-white">CHOOSE YOUR TRAINING MODULE</h2>
                <p class="text-gray-400 mt-2 max-w-2xl mx-auto">Select a module to begin your assessment and training.</p>
            </div>
            <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
                <a href="#" data-screen="ppdt-settings-screen" class="choice-card p-8 rounded-xl flex-1 flex flex-col justify-center items-center text-center no-underline">
                    <h3 class="3xl font-bold text-white">SCREENING TEST</h3>
                    <p class="text-gray-400 mt-2">Practice the Picture Perception & Discussion Test (PPDT).</p>
                </a>
                <a href="#" data-screen="psychology-screen" class="choice-card p-8 rounded-xl flex-1 flex flex-col justify-center items-center text-center no-underline">
                    <h3 class="3xl font-bold text-white">PSYCHOLOGY TESTS</h3>
                    <p class="text-gray-400 mt-2">Hone your skills in TAT, WAT, and SRT with AI feedback.</p>
                </a>
            </div>
        </div>`;
    
    // Attach event listeners for navigation within the home screen
    homeScreen.querySelectorAll('[data-screen]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetScreen = link.dataset.screen;
            
            if (targetScreen === 'ppdt-settings-screen') {
                renderPPDTSettingsScreen();
            } else if (targetScreen === 'psychology-screen') {
                renderPsychologyScreen();
            } else if (targetScreen === 'past-tests-screen') {
                showPastTests();
            }
        });
    });
    
    showScreen('home-screen');
}


// --- Unified Test State and Timers ---
let timerInterval;

// --- Helper Functions (used by all tests) ---
function formatTime(s) {
    return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
}

function startTimer(duration, displayElement, onComplete) {
    clearInterval(timerInterval);
    let timeLeft = duration;
    displayElement.textContent = formatTime(timeLeft);

    // Timer should run unless explicitly set to 'false' (PPDT Free Practice)
    const isTimed = appState.timed === 'true' || appState.testType === 'WAT' || appState.testType === 'SRT'; 

    if (isTimed) {
        timerInterval = setInterval(() => {
            timeLeft--;
            displayElement.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                onComplete();
            }
        }, 1000);
    }
}


// =========================================================================
// --- SCREENING TEST (PPDT) LOGIC (from screening.js) ---
// =========================================================================

let ppdtMediaRecorder, ppdtRecordedChunks = [], ppdtVideoUrl = null, ppdtCurrentImageUrl = '';


function setupPPDTVideoControls(reviewVideo) {
    const audioBtn = document.getElementById('review-audio-btn');
    const mutedBtn = document.getElementById('review-muted-btn');
    const bothBtn = document.getElementById('review-both-btn');
    
    reviewVideo.muted = false;
    reviewVideo.removeAttribute('style'); 

    // Helper to toggle visibility and muting
    const setPlaybackMode = (muted, visible) => {
        reviewVideo.muted = muted;
        if (visible) {
            reviewVideo.classList.remove('hidden');
        } else {
            // Use CSS to hide video feed but keep audio playing
            reviewVideo.classList.add('hidden');
        }
        
        // Ensure playback continues when mode changes
        reviewVideo.play();
    };

    audioBtn.addEventListener('click', () => setPlaybackMode(false, false));
    mutedBtn.addEventListener('click', () => setPlaybackMode(true, true));
    bothBtn.addEventListener('click', () => setPlaybackMode(false, true));
}

function showPPDTReview() {
    isTestActive = false; // Test stage is over, review is safe.
    if (topNav) topNav.classList.remove('hidden'); // Show navbar on review screen
    setupFullscreenListener(false); // Remove fullscreen listener
    exitFullscreenProgrammatically(); // Exit fullscreen on test completion
    
    showScreen('review-screen');
    
    const reviewScreen = document.getElementById('review-screen');
    const template = getTemplateContent('ppdt-review-screen-template');
    reviewScreen.innerHTML = '';
    reviewScreen.appendChild(template);
    
    const reviewImage = document.getElementById('review-image');
    const reviewVideo = document.getElementById('review-video');

    if(reviewImage) reviewImage.src = ppdtCurrentImageUrl;

    if (ppdtRecordedChunks.length > 0) {
        if (ppdtVideoUrl) URL.revokeObjectURL(ppdtVideoUrl);
        const blob = new Blob(ppdtRecordedChunks, { type: 'video/webm' });
        ppdtVideoUrl = URL.createObjectURL(blob);
        if(reviewVideo) reviewVideo.src = ppdtVideoUrl;
        setupPPDTVideoControls(reviewVideo); // Setup controls after source is set
    } else {
        if(reviewVideo) reviewVideo.src = '';
        const controls = document.getElementById('review-controls');
        if(controls) controls.innerHTML = `<p class="text-center text-red-400">No video recorded or recording failed.</p>`;
    }

    document.getElementById('restart-btn').addEventListener('click', () => {
        if (ppdtVideoUrl) URL.revokeObjectURL(ppdtVideoUrl);
        ppdtVideoUrl = null;
        ppdtRecordedChunks = []; 
        renderPPDTSettingsScreen();
    });
}

async function beginPPDTNarration(duration, timerDisplay) {
    const webcamFeed = document.getElementById('webcam-feed');
    const webcamStatus = document.getElementById('webcam-status');

    if (!navigator.mediaDevices || !window.MediaRecorder) {
        webcamStatus.textContent = "Video recording is not supported in this browser.";
        return;
    }
    
    webcamStatus.textContent = "Requesting camera and microphone access...";

    try {
        ppdtMediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        webcamFeed.srcObject = ppdtMediaStream;
        webcamStatus.textContent = "Webcam active. Recording will begin shortly.";

        setTimeout(() => {
            ppdtRecordedChunks = [];
            ppdtMediaRecorder = new MediaRecorder(ppdtMediaStream);
            
            ppdtMediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) ppdtRecordedChunks.push(e.data);
            };

            ppdtMediaRecorder.onstop = () => {
                // Ensure all tracks are stopped ONLY AFTER the mediaRecorder is finished
                if (ppdtMediaStream) {
                    ppdtMediaStream.getTracks().forEach(track => track.stop());
                    ppdtMediaStream = null;
                }
                showPPDTReview();
            };
            
            ppdtMediaRecorder.start();
            webcamStatus.textContent = "Recording...";

            if (appState.timed === 'true') {
                startTimer(duration, timerDisplay, () => {
                    if (ppdtMediaRecorder && ppdtMediaRecorder.state === 'recording') {
                        ppdtMediaRecorder.stop();
                    }
                });
            } else {
                webcamStatus.innerHTML = "Recording... <button id='manual-stop' class='back-btn py-1 px-3 rounded-lg ml-3'>Stop Practice</button>";
                document.getElementById('manual-stop').addEventListener('click', () => {
                    if (ppdtMediaRecorder && ppdtMediaRecorder.state === 'recording') {
                        ppdtMediaRecorder.stop();
                    } else {
                         // Fallback for immediate stop if recording state is missed
                         if (ppdtMediaStream) ppdtMediaStream.getTracks().forEach(track => track.stop());
                         ppdtMediaStream = null;
                         showPPDTReview(); 
                    }
                });
            }
        }, 1500);

    } catch (err) {
        console.error("Webcam/Mic access error:", err);
        webcamStatus.textContent = "Could not access webcam or microphone. Please check browser permissions and refresh.";
        abortTest(); 
    }
}

async function generateAndLoadPPDTImage(onLoadCallback) {
    const imageLoader = document.getElementById('image-loader');
    const testImageEl = document.getElementById('test-image');
    imageLoader.classList.remove('hidden');
    testImageEl.classList.add('hidden');
    
    const gender = appState.gender ?? 'male';
    const heroCharacter = gender === 'male' ? 'a young man between 18 and 32 years old' : 'a young woman between 18 and 32 years old';
    const fullPrompt = `A black and white, ambiguous, hazy pencil sketch for a psychological test. The scene shows a group of people in a neutral situation. There are at least three people. One is ${heroCharacter}. The others are of any age or gender. The mood is neutral, open to interpretation. Focus on character interaction.`;
    
    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'image', prompt: fullPrompt })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to generate image from AI: ${errorText}`);
        }
        const imageBlob = await response.blob();
        if (ppdtCurrentImageUrl) URL.revokeObjectURL(ppdtCurrentImageUrl);
        ppdtCurrentImageUrl = URL.createObjectURL(imageBlob);
        testImageEl.src = ppdtCurrentImageUrl;
        imageLoader.classList.add('hidden');
        testImageEl.classList.remove('hidden');
        onLoadCallback();
    } catch (error) {
        imageLoader.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        clearInterval(timerInterval);
    }
}

function runPPDTTestStage() {
    const screen = document.getElementById('test-screen');
    screen.innerHTML = '';
    const stage = appState.stages[appState.currentItem];
    const templateId = `ppdt-${stage}-stage-template`;
    const template = getTemplateContent(templateId);
    screen.appendChild(template);
    
    addAbortButtonToStage(screen); // Add Abort Button
    
    const timerDisplay = screen.querySelector('#timer-display');
    let duration;

    const timerShouldBeVisible = appState.timerVisible === 'visible';
    if (appState.timed !== 'true' || !timerShouldBeVisible) {
        if(timerDisplay) timerDisplay.classList.add('invisible');
    } else {
        if(timerDisplay) timerDisplay.classList.remove('invisible');
    }
    
    switch(stage) {
        case 'picture':
            duration = 30;
            generateAndLoadPPDTImage(() => {
                if (appState.timed === 'true') {
                    startTimer(duration, timerDisplay, () => { appState.currentItem++; runPPDTTestStage(); });
                } else {
                    const imageContainer = document.getElementById('image-container');
                    imageContainer.innerHTML += `<div class="absolute bottom-6 right-6"><button id="advance-btn" class="glow-btn font-bold py-2 px-6 rounded-lg">Proceed to Story</button></div>`;
                    document.getElementById('advance-btn').addEventListener('click', () => { appState.currentItem++; runPPDTTestStage(); });
                }
            });
            break;
        case 'story':
            duration = 270;
            if (appState.timed === 'true') {
                startTimer(duration, timerDisplay, () => { appState.currentItem++; runPPDTTestStage(); });
            } else {
                const storyContainer = screen.querySelector('.bg-black.bg-opacity-20.p-8');
                storyContainer.innerHTML += `<div class="mt-8"><button id="advance-btn" class="glow-btn font-bold py-3 px-8 rounded-lg">Finished Writing (Proceed to Narration)</button></div>`;
                document.getElementById('advance-btn').addEventListener('click', () => { appState.currentItem++; runPPDTTestStage(); });
            }
            break;
        case 'narration':
            duration = 60;
            beginPPDTNarration(duration, timerDisplay); 
            break;
    }
}

function initializePPDTTest(config) {
    isTestActive = true; // Set flag to true when test starts
    if (topNav) topNav.classList.add('hidden'); // Hide navbar during test
    setupFullscreenListener(true); // Add fullscreen listener
    enterFullscreen(); // Request fullscreen

    appState = {
        ...config,
        userId,
        currentItem: 0,
        stages: ['picture', 'story', 'narration'],
        timerVisible: document.getElementById('timer-visible')?.checked ? 'visible' : 'hidden', 
        gender: document.querySelector('input[name="gender"]:checked')?.value,
    };
    showScreen('test-screen');
    runPPDTTestStage();
}

function renderPPDTSettingsScreen() {
    isTestActive = false;
    if (topNav) topNav.classList.remove('hidden'); // Show navbar
    setupFullscreenListener(false); // Remove listener
    exitFullscreenProgrammatically(); // Exit fullscreen on menu return

    const settingsScreen = document.getElementById('ppdt-settings-screen');
    const template = getTemplateContent('ppdt-settings-screen-template');

    // --- FIX: Safely render template content ---
    if (template) {
        settingsScreen.innerHTML = ''; 
        settingsScreen.appendChild(template);
    
        // Add Back Button (Executed ONLY if template content exists)
        addGoBackButton(settingsScreen, renderHomeScreen);

        settingsScreen.querySelectorAll('[data-test-type="PPDT"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const config = { 
                    ...btn.dataset, 
                    timed: btn.dataset.timed || 'false' 
                };
                initializePPDTTest(config);
            });
        });
    } else {
        // Fallback and error message if template is missing
         settingsScreen.innerHTML = `<div class="text-center mt-20"><p class="text-red-500 font-semibold">Error: PPDT Settings Template Missing. Check HTML structure.</p><button class="glow-btn mt-4" onclick="renderHomeScreen()">Go Home</button></div>`;
    }
    // --- End FIX ---
    
    showScreen('ppdt-settings-screen');
}


// =========================================================================
// --- PSYCHOLOGY TESTS (TAT/WAT/SRT) LOGIC (from psychology.js) ---
// =========================================================================

let testData = []; // Holds AI-generated WAT words or SRT situations
let testResponses = [];

function renderPsychologyScreen() {
    const psychScreen = document.getElementById('psychology-screen');
    const template = getTemplateContent('psychology-screen-template');
    if (template) {
        psychScreen.innerHTML = '';
        psychScreen.appendChild(template);
    }

    // Add Back Button
    addGoBackButton(psychScreen, renderHomeScreen);

    showScreen('psychology-screen');
    
    psychScreen.querySelectorAll('[data-test-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            initializePsyTest({ testType: btn.dataset.testType });
        });
    });
}


async function initializePsyTest(config) {
    isTestActive = true; // Set flag to true when test starts
    if (topNav) topNav.classList.add('hidden'); // Hide navbar during test
    setupFullscreenListener(true); // Add fullscreen listener
    enterFullscreen(); // Request fullscreen

    appState = {
        ...config,
        userId,
        currentItem: 0,
        // Psychology tests are always timed=true
        timed: 'true' 
    };
    testResponses = [];
    testData = [];

    showScreen('test-screen');
    
    const screen = document.getElementById('test-screen');
    screen.innerHTML = `<div class="w-full max-w-md space-y-4 text-center mx-auto mt-20">
        <p class="text-lg text-gray-400">Preparing your ${appState.testType} session...</p>
        <div class="loader mx-auto"></div></div>`;

    try {
        if (appState.testType === 'WAT' || appState.testType === 'SRT') {
            const response = await fetch('/api/generate-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: appState.testType.toLowerCase() })
            });
            if (!response.ok) {
                 const err = await response.json();
                 throw new Error(err.error || 'Failed to fetch test data from AI.');
            }
            const data = await response.json();
            
            // --- AI Response Robustness Check ---
            if (appState.testType === 'WAT') {
                if (!Array.isArray(data) || typeof data[0] !== 'string' || data.length < 5) {
                    throw new Error("AI returned malformed or non-word data. (Expected a list of words, got SRT prompt or invalid JSON.)");
                }
            } else if (appState.testType === 'SRT') {
                 if (!Array.isArray(data) || typeof data[0] !== 'string' || data.length < 5) {
                    throw new Error("AI returned malformed data for SRT. (Expected a list of situations.)");
                }
            }
            // --- End AI Response Robustness Check ---

            testData = data; 
            appState.totalItems = testData.length;
        } else if (appState.testType === 'TAT') {
            appState.totalItems = 12; 
        }
        runPsyTestStage();
    } catch (error) {
        screen.innerHTML = `<div class="text-center mt-20"><p class="text-red-500 text-lg font-semibold">Failed to Prepare Test</p><p class="text-gray-400 mt-2">${error.message}</p><button id="psy-back-btn" class="glow-btn font-bold py-2 px-6 rounded-lg mt-8">Go Back</button></div>`;
        document.getElementById('psy-back-btn').addEventListener('click', renderPsychologyScreen);
    }
}

function runPsyTestStage() {
    const screen = document.getElementById('test-screen');
    screen.innerHTML = ''; 

    let stageConfig = {};
    let isPictureStage = false;
    let templateId = '';

    switch(appState.testType) {
        case 'TAT':
            const tatStage = appState.currentItem % 2 === 0 ? 'picture' : 'story';
            templateId = `tat-${tatStage}-stage-template`;
            const picIndex = Math.floor(appState.currentItem / 2);
            const isBlankSlide = picIndex === 11;
            isPictureStage = tatStage === 'picture' && !isBlankSlide;

            stageConfig = {
                'picture': { 
                    duration: 30, 
                    isBlank: isBlankSlide, 
                    onComplete: () => { 
                        appState.currentItem++; 
                        runPsyTestStage(); 
                    } 
                },
                'story': { 
                    duration: 240, 
                    isBlank: isBlankSlide, 
                    onComplete: () => { 
                        if (picIndex === appState.totalItems - 1) { 
                            showPsyReview();
                        } else {
                            appState.currentItem++;
                            runPsyTestStage();
                        }
                    } 
                }
            }[tatStage];
            appState.currentPicIndex = picIndex;
            break;
        case 'WAT':
            templateId = 'wat-stage-template';
            stageConfig = { duration: 15, onComplete: () => finishPsyTest() };
            break;
        case 'SRT':
            templateId = 'srt-stage-template';
            stageConfig = { duration: 30, onComplete: () => finishPsyTest() };
            break;
    }

    const template = getTemplateContent(templateId);
    screen.appendChild(template);
    
    addAbortButtonToStage(screen); // Add Abort Button

    const progressCounter = screen.querySelector('#test-progress-counter');
    if (progressCounter) {
        const current = appState.testType === 'TAT' ? appState.currentPicIndex + 1 : appState.currentItem + 1;
        progressCounter.textContent = `(${current}/${appState.totalItems})`;
    }
    
    const timerDisplay = screen.querySelector('#timer-display');
    
    if (isPictureStage) {
        generateAndLoadTATImage(() => {
            startTimer(stageConfig.duration, timerDisplay, stageConfig.onComplete);
        });
    } else {
        setupPsyStageContent(stageConfig);
        startTimer(stageConfig.duration, timerDisplay, stageConfig.onComplete); 
    }
}

function setupPsyStageContent(config) {
    switch(appState.testType) {
        case 'TAT':
            if (config.isBlank) {
                 const imageContainer = document.getElementById('image-container');
                 const writeMessage = document.getElementById('write-story-message');
                 const blankMessage = document.getElementById('blank-slide-message');
                 if(imageContainer) imageContainer.classList.add('hidden');
                 if(writeMessage) writeMessage.classList.add('hidden');
                 if(blankMessage) blankMessage.classList.remove('hidden');
            }
            break;
        case 'WAT':
            document.getElementById('wat-word').textContent = testData[appState.currentItem];
            document.getElementById('wat-input').focus();
            break;
        case 'SRT':
            document.getElementById('srt-situation').textContent = testData[appState.currentItem];
            document.getElementById('srt-input').focus();
            break;
    }
}

function finishPsyTest() {
    if (appState.testType === 'WAT' || appState.testType === 'SRT') {
        const input = document.getElementById(`${appState.testType.toLowerCase()}-input`);
        testResponses.push({
            prompt: testData[appState.currentItem],
            response: input.value
        });
        
        appState.currentItem++;

        if (appState.currentItem < appState.totalItems) {
             runPsyTestStage(); 
        } else {
            clearInterval(timerInterval);
            showPsyReview();
        }
    } 
}

async function generateAndLoadTATImage(onLoadCallback) {
    const imageLoader = document.getElementById('image-loader');
    const testImageEl = document.getElementById('test-image');
    imageLoader.classList.remove('hidden');
    testImageEl.classList.add('hidden');

    const fullPrompt = "A black and white, ambiguous, hazy pencil sketch for a psychological test. The scene shows a group of people in a neutral situation. Focus on human emotion and interaction. The image should be open to multiple interpretations.";
    
    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'image', prompt: fullPrompt })
        });

        if (!response.ok) {
             const errorText = await response.text();
             throw new Error(`Failed to generate TAT image: ${errorText}`);
        }
        
        const imageBlob = await response.blob();
        const tempImageUrl = URL.createObjectURL(imageBlob);
        testImageEl.src = tempImageUrl;
        
        imageLoader.classList.add('hidden');
        testImageEl.classList.remove('hidden');
        
        onLoadCallback();
    } catch (error) {
        console.error("TAT Image Generation Error:", error);
        imageLoader.innerHTML = `<p class="text-red-500 font-semibold">Image Generation Failed:</p><p class="text-gray-400 mt-2">${error.message}</p>`;
        clearInterval(timerInterval); 
    }
}

function showPsyReview() {
    isTestActive = false; // Test is complete and review screen is safe.
    if (topNav) topNav.classList.remove('hidden'); // Show navbar on review screen
    setupFullscreenListener(false); // Remove fullscreen listener
    exitFullscreenProgrammatically(); // Exit fullscreen on test completion

    showScreen('review-screen');
    const reviewContainer = document.getElementById('review-screen');
    reviewContainer.innerHTML = '';
    
    const template = getTemplateContent('text-review-template');
    reviewContainer.appendChild(template);
    
    if (appState.testType === 'TAT') {
        document.getElementById('review-title').textContent = `TAT COMPLETE`;
        document.getElementById('review-list').innerHTML = `<p class="text-center text-lg">You have completed the Thematic Apperception Test. (TAT stories are not saved or analyzed on the platform.)</p>`;
        document.getElementById('get-feedback-btn').classList.add('hidden');
        document.getElementById('feedback-container').classList.add('hidden'); 
    } else { 
        document.getElementById('review-title').textContent = `${appState.testType} Review`;
        const list = document.getElementById('review-list');
        
        if (testResponses.length === 0) {
            list.innerHTML = `<p class="text-center text-lg text-red-400">No responses were recorded for this test.</p>`;
        } else {
            list.innerHTML = testResponses.map((item, index) => `
                <div class="p-4 bg-gray-900 rounded-lg border border-gray-700">
                    <p class="text-gray-400 font-semibold">${index + 1}. ${item.prompt}</p>
                    <p class="text-white mt-2 pl-4 border-l-2 border-blue-500">${item.response || 'No response.'}</p>
                </div>
            `).join('');
        }
    }

    document.getElementById('restart-btn').addEventListener('click', renderPsychologyScreen);
    
    const feedbackBtn = document.getElementById('get-feedback-btn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', getAIFeedback);
    }
}

async function savePsyTestToFirebase(aiFeedback) {
    if (!userId || !db) return;

    try {
        const testsCol = collection(db, `users/${userId}/tests`);
        await addDoc(testsCol, {
            testType: appState.testType,
            timestamp: Date.now(),
            responses: testResponses.map(r => ({ prompt: r.prompt, response: r.response })),
            aiFeedback: aiFeedback || null,
        });
        console.log("Test data successfully saved to Firestore.");
    } catch (error) {
        console.error("Error saving test data to Firestore:", error);
    }
}

async function getAIFeedback() {
    const feedbackContainer = document.getElementById('feedback-container');
    const feedbackLoader = document.getElementById('feedback-loader');
    const feedbackContent = document.getElementById('feedback-content');
    const feedbackBtn = document.getElementById('get-feedback-btn');

    feedbackContainer.classList.remove('hidden');
    feedbackLoader.classList.remove('hidden');
    feedbackContent.innerHTML = '';
    feedbackBtn.disabled = true;
    feedbackBtn.textContent = 'Analyzing...';


    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'feedback', 
                data: {
                    testType: appState.testType,
                    responses: testResponses
                }
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to get AI feedback.');
        }

        const result = await response.json();
        const aiFeedback = result.feedback;
        
        feedbackContent.innerHTML = marked.parse(aiFeedback);
        feedbackLoader.classList.add('hidden');
        
        await savePsyTestToFirebase(aiFeedback);
        
        feedbackBtn.textContent = 'Feedback Received (Saved)';
        feedbackBtn.disabled = true;

    } catch (error) {
        console.error("AI Feedback Error:", error);
        feedbackContent.innerHTML = `<p class="text-red-500 font-semibold">AI Analysis Failed:</p><p>${error.message}</p>`;
        feedbackLoader.classList.add('hidden');
        feedbackBtn.disabled = false;
        feedbackBtn.textContent = 'Retry AI Feedback';
    }
}


// =========================================================================
// --- ACCOUNT/HISTORY LOGIC (from account.js) ---
// =========================================================================

async function showPastTests() {
    showScreen('past-tests-screen');
    const pastTestsScreen = document.getElementById('past-tests-screen');
    const template = getTemplateContent('past-tests-screen-template');
    if (template) {
        pastTestsScreen.innerHTML = '';
        pastTestsScreen.appendChild(template);
    }
    
    // Add Back Button
    addGoBackButton(pastTestsScreen, renderHomeScreen);

    const pastTestsList = document.getElementById('past-tests-list');
    pastTestsList.innerHTML = `<div class="loader mx-auto"></div>`;
    
    if (!userId) {
        pastTestsList.innerHTML = `<p class="text-center text-gray-400">Please log in to see your performance history.</p>`;
        return;
    }

    try {
        const testsCol = collection(db, `users/${userId}/tests`);
        const q = query(testsCol, orderBy("timestamp", "desc"));
        const testSnapshot = await getDocs(q);
        
        pastTestsList.innerHTML = '';
        if (testSnapshot.empty) {
            pastTestsList.innerHTML = `<p class="text-center text-gray-400">You have not completed any savable tests yet (WAT or SRT with AI feedback).</p>`;
            return;
        }

        testSnapshot.forEach(doc => {
            const test = doc.data();
            const d = new Date(test.timestamp);
            const testEl = document.createElement('div');
            testEl.className = 'choice-card p-4 flex justify-between items-center cursor-pointer';
            testEl.innerHTML = `
                <div>
                    <h4 class="text-xl font-bold text-white">${test.testType}</h4>
                    <p class="text-sm text-gray-400">${d.toLocaleString()}</p>
                </div>
                <button class="glow-btn text-sm py-2 px-4 rounded-lg">View Report</button>
            `;
            testEl.addEventListener('click', () => viewPastTest(doc.id));
            pastTestsList.appendChild(testEl);
        });
    } catch (error) {
        console.error("Error fetching past tests:", error);
        pastTestsList.innerHTML = `<p class="text-center text-red-500">Could not load test history.</p>`;
    }
}

async function viewPastTest(testId) {
    showScreen('view-test-screen');
    const viewTestScreen = document.getElementById('view-test-screen');
    const template = getTemplateContent('view-test-screen-template');
    
    viewTestScreen.innerHTML = '';
    viewTestScreen.appendChild(template);
    viewTestScreen.querySelector('#review-list').innerHTML = `<div class="loader mx-auto"></div>`;

    document.getElementById('back-to-history-btn').addEventListener('click', showPastTests);

    try {
        const testDoc = await getDoc(doc(db, `users/${userId}/tests`, testId));
        if (testDoc.exists()) {
            const test = testDoc.data();
            
            document.getElementById('review-title').textContent = `${test.testType} Report (${new Date(test.timestamp).toLocaleDateString()})`;
            
            const list = document.getElementById('review-list');
            list.innerHTML = test.responses.map((item, index) => `
                <div class="p-4 bg-gray-900 rounded-lg border border-gray-700">
                    <p class="text-gray-400 font-semibold">${index + 1}. ${item.prompt}</p>
                    <p class="text-white mt-2 pl-4 border-l-2 border-blue-500">${item.response || 'No response.'}</p>
                </div>
            `).join('');

            if (test.aiFeedback) {
                document.getElementById('feedback-container').classList.remove('hidden');
                document.getElementById('feedback-content').innerHTML = marked.parse(test.aiFeedback);
            } else {
                document.getElementById('feedback-container').classList.add('hidden');
            }
        } else {
            throw new Error("Test not found.");
        }
    } catch (error) {
        console.error("Error fetching test detail:", error);
        viewTestScreen.querySelector('#review-list').innerHTML = `<p class="text-center text-red-500">${error.message}</p>`;
    }
}

// --- Main Execution ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Firebase services
    const { auth: initializedAuth, db: initializedDb } = await initializeAppWithRemoteConfig();

    if (initializedAuth && initializedDb) {
        auth = initializedAuth;
        db = initializedDb;
        
        // 2. Set up Nav Link Listeners
        topNav.querySelectorAll('[data-screen]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetScreen = link.dataset.screen;
                if (!userId) {
                    renderLoginScreen();
                    showScreen('login-screen');
                    return; 
                }
                
                if (targetScreen === 'ppdt-settings-screen') {
                    renderPPDTSettingsScreen();
                } else if (targetScreen === 'psychology-screen') {
                    renderPsychologyScreen();
                } else if (targetScreen === 'past-tests-screen') {
                    showPastTests();
                } else if (targetScreen === 'home-screen') {
                    renderHomeScreen();
                }
            });
        });

        // 3. Start Authentication Listener
        onAuthStateChanged(auth, handleAuthState);
    }
});

// NEW FEATURE: Add beforeunload listener at the very end of the file execution
window.addEventListener('beforeunload', (e) => {
    if (isTestActive) {
        // Standard text for browser pop-up
        const message = 'You are currently in a test. Your progress (including unsaved WAT/SRT responses) will be lost if you leave or refresh.';
        
        // This is necessary for some older browsers
        e.preventDefault();
        
        // This is necessary for modern browsers to show the confirmation pop-up
        e.returnValue = message;
        return message;
    }
});
