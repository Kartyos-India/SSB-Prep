// --- Firebase Module Imports ---
const { 
    initializeApp, getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
    getFirestore
} = window.FirebaseModules;

// --- Global State ---
let app, auth, db, userId;
let isTestActive = false; // Prevents leaving the page during a test
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};

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

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('font-bold', 'text-blue-600');
        if (link.dataset.screen === screenId) {
            link.classList.add('font-bold', 'text-blue-600');
        }
    });
}

function addGoBackButton(screenElement, targetScreenFunction) {
    const backButton = document.createElement('button');
    backButton.className = 'back-btn py-1 px-3 rounded-lg absolute top-4 left-4 font-bold bg-gray-200 text-gray-700';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', targetScreenFunction);
    
    // Ensure the container is positioned to handle the absolute button
    const container = screenElement.querySelector('.text-center');
    if (container) {
        container.style.position = 'relative';
        container.prepend(backButton);
    } else {
        screenElement.style.position = 'relative';
        screenElement.prepend(backButton);
    }
}


// --- Firebase Initialization ---
async function initializeAppWithRemoteConfig() {
    try {
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get-config' })
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || "Failed to fetch Firebase config from server.");
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
        console.error("Firebase Init Error:", error);
        if(authLoader) authLoader.innerHTML = `<p class="text-red-500 font-semibold p-4 text-center">Error: Could not connect to the server. Please check your network and refresh.</p>`;
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
        <div class="flex justify-center">
            <button id="google-signin-btn" class="primary-btn font-bold py-3 px-6 rounded-lg flex items-center gap-3">
                Sign in with Google
            </button>
        </div>`;
    
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
            <button id="logout-btn" class="back-btn py-1 px-3 rounded-lg bg-white text-gray-700">Logout</button>`;
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        topNav.style.display = 'flex';
        renderHomeScreen();
    } else {
        userId = null;
        headerRight.innerHTML = '';
        topNav.style.display = 'none';
        renderLoginScreen();
    }
}

// --- Main Screen Rendering Logic ---
function renderHomeScreen() {
    isTestActive = false;
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
    const screeningScreen = document.getElementById('ppdt-settings-screen');
    screeningScreen.innerHTML = '';
    
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">SCREENING TESTS</h2>
            <p class="text-gray-500 mt-2">Choose a test for Stage I practice.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">OIR TEST</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Officer Intelligence Rating Test.</p>
                <button class="w-full primary-btn font-bold py-3 mt-6 rounded-lg" id="start-oir-btn">START OIR</button>
            </div>
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">PPDT</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Picture Perception & Discussion Test.</p>
                <button class="w-full primary-btn font-bold py-3 mt-6 rounded-lg" id="start-ppdt-settings-btn">CONFIGURE PPDT</button>
            </div>
        </div>
    `;

    addGoBackButton(container, renderHomeScreen);
    screeningScreen.appendChild(container);

    screeningScreen.querySelector('#start-oir-btn').addEventListener('click', initializeOIRTest);
    screeningScreen.querySelector('#start-ppdt-settings-btn').addEventListener('click', renderPPDTSettingsScreen);
    
    showScreen('ppdt-settings-screen');
}


function renderPsychologyMenu() {
    const psychScreen = document.getElementById('psychology-screen');
    psychScreen.innerHTML = '';
    const template = getTemplateContent('psychology-screen-template');
    if (template) {
        const content = template.cloneNode(true);
        addGoBackButton(content.firstElementChild, renderHomeScreen);
        content.querySelectorAll('button[data-test-type]').forEach(button => {
            button.addEventListener('click', () => {
                // Placeholder for now
                alert(`Starting ${button.dataset.testType} test is not implemented yet.`);
            });
        });
        psychScreen.appendChild(content);
    }
    showScreen('psychology-screen');
}

function renderGTOPlaceholderScreen() {
    const gtoScreen = document.getElementById('gto-placeholder-screen');
    gtoScreen.innerHTML = '';
    const template = getTemplateContent('gto-placeholder-screen-template');
    if (template) {
        const content = template.cloneNode(true);
        addGoBackButton(content.firstElementChild, renderHomeScreen);
        content.querySelector('button[data-action="renderHomeScreen"]').addEventListener('click', renderHomeScreen);
        gtoScreen.appendChild(content);
    }
    showScreen('gto-placeholder-screen');
}

function renderPPDTSettingsScreen() {
    const testScreen = document.getElementById('test-screen');
    testScreen.innerHTML = '';
    const template = getTemplateContent('ppdt-settings-template');
    if (template) {
        const content = template.cloneNode(true);
        addGoBackButton(content.firstElementChild, renderScreeningMenu);
        testScreen.appendChild(content);
        // Add event listener for the start button
        testScreen.querySelector('#start-ppdt-btn').addEventListener('click', () => {
             alert('PPDT test logic is not implemented yet.');
        });
    }
    showScreen('test-screen');
}


// --- OIR Test Logic ---

function initializeOIRTest() {
    isTestActive = true;
    oirQuestions = [
        { q: "Which number is the odd one out: 9, 16, 25, 35, 49?", options: ["16", "25", "35", "49"], answer: "35" },
        { q: "If 'CAT' is coded as 'DBU', how is 'DOG' coded?", options: ["EPH", "FQI", "DPG", "EPH"], answer: "EPH" },
        { q: "A man walks 5km East, then 5km South. How far is he from the starting point?", options: ["5 km", "5√2 km", "10 km", "0 km"], answer: "5√2 km" },
        { q: "Complete the series: 3, 7, 15, 31, __?", options: ["62", "63", "64", "59"], answer: "63" },
        { q: "If a watch shows 3:15, what is the angle between the hour and minute hands?", options: ["0 degrees", "7.5 degrees", "15 degrees", "5 degrees"], answer: "7.5 degrees" },
    ];
    currentOIRIndex = 0;
    oirResponses = {};

    const testScreen = document.getElementById('test-screen');
    testScreen.innerHTML = '';
    const template = getTemplateContent('oir-test-template');
    if (template) {
        testScreen.appendChild(template);
        addGoBackButton(testScreen.firstElementChild, renderScreeningMenu);
        testScreen.querySelector('#oir-next-btn').addEventListener('click', handleOIRNavigation);
        testScreen.querySelector('#oir-prev-btn').addEventListener('click', handleOIRNavigation);
        testScreen.querySelector('#oir-finish-btn').addEventListener('click', finishOIRTest);
        renderOIRQuestion();
    }
    showScreen('test-screen');
}

function renderOIRQuestion() {
    if (currentOIRIndex < 0) currentOIRIndex = 0;
    if (currentOIRIndex >= oirQuestions.length) currentOIRIndex = oirQuestions.length - 1;

    const container = document.getElementById('oir-question-container');
    const question = oirQuestions[currentOIRIndex];

    container.innerHTML = `
        <p class="text-lg font-semibold">${currentOIRIndex + 1}. ${question.q}</p>
        <div class="space-y-2 mt-4">
            ${question.options.map(opt => `
                <label class="block bg-gray-100 p-3 rounded-md border cursor-pointer hover:bg-gray-200">
                    <input type="radio" name="oir_option" value="${opt}" class="mr-2" ${oirResponses[currentOIRIndex] === opt ? 'checked' : ''}>
                    ${opt}
                </label>
            `).join('')}
        </div>
    `;
    
    document.getElementById('oir-prev-btn').classList.toggle('hidden', currentOIRIndex === 0);
    document.getElementById('oir-next-btn').classList.toggle('hidden', currentOIRIndex === oirQuestions.length - 1);
    document.getElementById('oir-finish-btn').classList.toggle('hidden', currentOIRIndex !== oirQuestions.length - 1);
}

function handleOIRNavigation(e) {
    const selectedOption = document.querySelector('input[name="oir_option"]:checked');
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    if (e.target.id === 'oir-next-btn') {
        currentOIRIndex++;
    } else if (e.target.id === 'oir-prev-btn') {
        currentOIRIndex--;
    }
    renderOIRQuestion();
}

function finishOIRTest() {
    isTestActive = false;
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

    const reviewScreen = document.getElementById('review-screen');
    reviewScreen.innerHTML = '';
    const template = getTemplateContent('review-screen-template');
    if (template) {
        const content = template.cloneNode(true);
        const reviewContent = content.getElementById('review-content');
        reviewContent.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h3 class="text-2xl font-bold text-center">OIR Result</h3>
                <p class="text-center text-5xl font-bold my-4">${score} / ${oirQuestions.length}</p>
            </div>
        `;
        content.querySelector('button[data-action="renderHomeScreen"]').addEventListener('click', renderHomeScreen);
        reviewScreen.appendChild(content);
    }
    showScreen('review-screen');
}


// --- Event Listeners and Main Execution ---
function setupNavigation() {
    topNav.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (!target) return;
        e.preventDefault();
        const screen = target.dataset.screen;
        
        // Convert screen-name to renderScreenName function name
        const funcName = `render${screen.split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join('')}`;
        if(window[funcName]) {
            window[funcName]();
        } else {
            console.warn(`${funcName} is not a function.`);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const { auth } = await initializeAppWithRemoteConfig();
    if (auth) {
        setupNavigation();
        onAuthStateChanged(auth, handleAuthState);
    }
});

// Make key functions globally accessible for button data-actions
window.renderHomeScreen = renderHomeScreen;
window.renderScreeningMenu = renderScreeningMenu;
window.renderPsychologyMenu = renderPsychologyMenu;
window.renderGTOPlaceholderScreen = renderGTOPlaceholderScreen;

