// This script runs on EVERY page. It handles login, logout, and the header.

// --- Global State ---
let app, auth, db, userId;
const { initializeApp, getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, getFirestore } = window.Firebase;

// --- DOM Elements ---
const authLoader = document.getElementById('auth-loader');
const pageContent = document.getElementById('page-content');
const headerRight = document.getElementById('header-right');

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
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        return { auth, db };
    } catch (error) {
        if(authLoader) authLoader.innerHTML = `<p class="text-red-500 font-semibold p-4 text-center">Could not initialize application.</p>`;
        return {};
    }
}

// --- Authentication Logic ---
function showLoginUI() {
    if (pageContent) {
        pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">PLEASE SIGN IN</h2>
            <p class="text-gray-500 mt-2">Sign in to access the platform features.</p>
            <button id="google-signin-btn" class="primary-btn font-bold py-3 px-6 rounded-lg mt-8">
                Sign in with Google
            </button>
        </div>`;
        document.getElementById('google-signin-btn').addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(console.error);
        });
        pageContent.classList.remove('hidden');
    }
}


function handleAuthState(user) {
    if (authLoader) authLoader.classList.add('hidden');
    if (user) {
        userId = user.uid;
        headerRight.innerHTML = `
            <span>${user.displayName || user.email}</span>
            <button id="logout-btn" class="back-btn py-1 px-3 rounded-lg bg-white text-gray-700">Logout</button>`;
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        
        if (pageContent) pageContent.classList.remove('hidden');

    } else {
        userId = null;
        headerRight.innerHTML = '';
        showLoginUI();
    }
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    const firebase = await initializeAppWithRemoteConfig();
    if (firebase.auth) {
        onAuthStateChanged(firebase.auth, handleAuthState);
    }
});
