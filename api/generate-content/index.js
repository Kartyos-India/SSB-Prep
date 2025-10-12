// --- Firebase Module Imports ---
const { 
    initializeApp, getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
    getFirestore, collection, addDoc, query, getDocs, doc, getDoc, orderBy
} = window.FirebaseModules;

// --- Global State ---
let app, auth, db, userId;
let isTestActive = false;
let ppdtMediaStream = null;

// --- DOM Elements ---
const authLoader = document.getElementById('auth-loader');
const mainContent = document.getElementById('main-content');
const topNav = document.getElementById('top-nav');
const headerRight = document.getElementById('header-right');

// --- Utility Functions ---
function getTemplateContent(templateId) {
    const template = document.getElementById(templateId);
    return template ? template.content.cloneNode(true) : null;
}

function showScreen(screenId) {
    if (!mainContent) return;
    Array.from(mainContent.children).forEach(child => child.classList.add('hidden'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.remove('hidden');

    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.querySelector(`.nav-link[data-screen="${screenId}"]`);
    if(activeLink) activeLink.classList.add('active');
}

function addGoBackButton(screenElement, targetScreenFunction) {
    const backButton = document.createElement('button');
    backButton.className = 'back-btn py-1 px-3 rounded-lg absolute top-4 left-4 font-bold bg-gray-200 text-gray-700';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', targetScreenFunction);
    screenElement.prepend(backButton);
}

// --- Firebase Initialization ---
async function initializeAppWithRemoteConfig() {
    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get-config' })
        });
        if (!response.ok) throw new Error("Failed to fetch Firebase config.");
        
        const firebaseConfig = await response.json();
        if (!firebaseConfig.apiKey) throw new Error("Invalid Firebase config.");

        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        return { auth, db };
    } catch (error) {
        console.error("Firebase Init Error:", error);
        if(authLoader) authLoader.innerHTML = `<p class="text-red-500">${error.message}</p>`;
        return {};
    }
}

// --- Authentication Logic ---
function renderLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) return;
    
    loginScreen.innerHTML = `
        <div class="text-center mb-10">
            <h2 class="text-4xl md:text-5xl font-bold text-gray-700">WELCOME, CANDIDATE</h2>
            <p class="text-gray-500 mt-2">Sign in to begin.</p>
        </div>
        <button id="google-signin-btn" class="mx-auto primary-btn font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-3">
            Sign in with Google
        </button>`;
    
    document.getElementById('google-signin-btn').addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(console.error);
    });
    showScreen('login-screen');
}

function handleAuthState(user) {
    if (authLoader) authLoader.classList.add('hidden');
    if (user) {
        userId = user.uid;
        headerRight.innerHTML = `
            <span>${user.displayName || user.email}</span>
            <button id="logout-btn" class="back-btn py-1 px-3 rounded-lg">Logout</button>`;
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        topNav.classList.remove('hidden');
        renderHomeScreen();
    } else {
        userId = null;
        headerRight.innerHTML = '';
        topNav.classList.add('hidden');
        renderLoginScreen();
    }
}

// --- Screen Rendering Logic ---
function renderHomeScreen() {
    const homeScreen = document.getElementById('home-screen');
    homeScreen.innerHTML = '';
    const template = getTemplateContent('home-screen-template');
    if (template) {
        homeScreen.appendChild(template);
        homeScreen.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                if (window[action]) window[action]();
            });
        });
    }
    showScreen('home-screen');
}

function renderScreeningMenu() {
    // Placeholder for the full screening menu (like PPDT settings)
    renderPPDTSettingsScreen();
}

function renderPsychologyMenu() {
    const psychScreen = document.getElementById('psychology-screen');
    psychScreen.innerHTML = '';
    const template = getTemplateContent('psychology-screen-template');
    if (template) {
        psychScreen.appendChild(template);
        addGoBackButton(psychScreen, renderHomeScreen);
        psychScreen.querySelectorAll('button[data-test-type]').forEach(button => {
            button.addEventListener('click', () => {
                initializePsyTest({ testType: button.dataset.testType });
            });
        });
    }
    showScreen('psychology-screen');
}

function renderGTOPlaceholderScreen() {
    const gtoScreen = document.getElementById('gto-placeholder-screen');
    gtoScreen.innerHTML = '';
    const template = getTemplateContent('gto-placeholder-screen-template');
    if (template) {
        gtoScreen.appendChild(template);
        addGoBackButton(gtoScreen, renderHomeScreen);
        gtoScreen.querySelector('button[data-action="renderHomeScreen"]').addEventListener('click', renderHomeScreen);
    }
    showScreen('gto-placeholder-screen');
}

function renderPPDTSettingsScreen() {
    const ppdtScreen = document.getElementById('ppdt-settings-screen');
    ppdtScreen.innerHTML = '<h2>PPDT Settings</h2><p>PPDT functionality to be built here.</p>';
    addGoBackButton(ppdtScreen, renderHomeScreen);
    showScreen('ppdt-settings-screen');
}

// --- Test Initialization and Logic ---
function initializeOIRTest() {
    const testScreen = document.getElementById('test-screen');
    testScreen.innerHTML = '';
    const template = getTemplateContent('oir-test-screen-template');
    if(template) {
        testScreen.appendChild(template);
        // Add OIR logic here
    }
    showScreen('test-screen');
}

function initializePsyTest(config) {
    const testScreen = document.getElementById('test-screen');
    testScreen.innerHTML = `<h2>Psychology Test: ${config.testType}</h2><p>Test content for ${config.testType} would go here.</p>`;
    addGoBackButton(testScreen, renderPsychologyMenu);
    showScreen('test-screen');
}

// --- Event Listeners and Main Execution ---
function setupNavigation() {
    topNav.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (!target) return;
        e.preventDefault();

        const screen = target.dataset.screen;
        const testType = target.dataset.testType;
        const action = target.dataset.action;

        if (screen === 'home-screen') renderHomeScreen();
        if (screen === 'gto-placeholder-screen') renderGTOPlaceholderScreen();
        if (screen === 'ppdt-settings-screen') renderPPDTSettingsScreen();
        
        if (action === 'start-test' && testType === 'OIR') initializeOIRTest();
        if (['TAT', 'WAT', 'SRT'].includes(testType)) initializePsyTest({ testType });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const { auth, db } = await initializeAppWithRemoteConfig();
    if (auth && db) {
        setupNavigation();
        onAuthStateChanged(auth, handleAuthState);
    }
});

// Make functions globally accessible for onclick attributes if needed
window.renderHomeScreen = renderHomeScreen;
window.renderScreeningMenu = renderScreeningMenu;
window.renderPsychologyMenu = renderPsychologyMenu;
window.renderGTOPlaceholderScreen = renderGTOPlaceholderScreen;


