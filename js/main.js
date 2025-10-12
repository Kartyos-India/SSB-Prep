// This script runs on ALL pages to handle authentication and dynamic header content.

// Import necessary Firebase functions from our central init file
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from './firebase-init.js';

// --- DOM Elements ---
const authLoader = document.getElementById('auth-loader');
const pageContent = document.getElementById('page-content'); // Note: This ID is not on the new homepage, which is fine.
const headerRight = document.getElementById('header-right');
const mainLoginBtn = document.getElementById('main-login-btn'); // New button from index.html

// --- Firebase Auth Initialization ---
const auth = getAuth();

// --- Core Functions ---

/**
 * Handles the sign-in process using Google's popup.
 */
function signIn() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => {
        console.error("Authentication Error:", error);
        alert("Could not sign in. Please try again.");
    });
}

/**
 * Handles the sign-out process.
 */
function logOut() {
    signOut(auth).catch(error => {
        console.error("Sign Out Error:", error);
    });
}

/**
 * Updates the header and main login button UI based on the user's authentication state.
 * @param {object|null} user - The Firebase user object, or null if logged out.
 */
function updateUI(user) {
    if (user) {
        // --- User is LOGGED IN ---
        // Update header
        headerRight.innerHTML = `
            <span class="hidden sm:inline">${user.displayName || user.email}</span>
            <button id="logout-btn" class="secondary-btn">Logout</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', logOut);
        
        // Hide the main login button if it exists
        if (mainLoginBtn) mainLoginBtn.classList.add('hidden');

    } else {
        // --- User is LOGGED OUT ---
        // Update header
        headerRight.innerHTML = `
            <button id="login-btn" class="primary-btn">Login</button>
        `;
        document.getElementById('login-btn').addEventListener('click', signIn);

        // Show the main login button if it exists
        if (mainLoginBtn) {
            mainLoginBtn.classList.remove('hidden');
            mainLoginBtn.addEventListener('click', signIn);
        }
    }
}

/**
 * Hides the initial loader in the header.
 */
function hideAuthLoader() {
    if (authLoader) authLoader.classList.add('hidden');
}

// --- Main Execution Logic ---

// Listen for changes in authentication state (login/logout)
onAuthStateChanged(auth, (user) => {
    console.log("Auth state changed. User:", user ? user.uid : "Logged out");
    hideAuthLoader();
    updateUI(user);
    
    // This function can be used on other pages to show content after auth check
    if (typeof showPageContent === 'function') {
        showPageContent();
    }
});

