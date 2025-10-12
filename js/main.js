import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- DOM ELEMENTS ---
const headerRight = document.getElementById('header-right');
const headerCenter = document.getElementById('header-center');
const pageContent = document.getElementById('page-content');
const authLoader = document.getElementById('auth-loader');

let auth; // Firebase Auth instance

// --- RENDER FUNCTIONS ---

/**
 * Renders the main navigation links in the header for a logged-in user.
 */
function renderAuthenticatedNav() {
    // Determine the current page to set the 'active' class
    const currentPage = window.location.pathname.split('/').pop();

    headerCenter.innerHTML = `
        <a href="screening.html" class="nav-link ${currentPage === 'screening.html' ? 'active' : ''}">Screening</a>
        <a href="psychology.html" class="nav-link ${currentPage === 'psychology.html' ? 'active' : ''}">Psychology</a>
        <a href="gto.html" class="nav-link ${currentPage === 'gto.html' ? 'active' : ''}">GTO</a>
        <a href="performance.html" class="nav-link ${currentPage === 'performance.html' ? 'active' : ''}">My Performance</a>
    `;
}

/**
 * Handles the UI state when a user is successfully authenticated.
 * @param {object} user - The Firebase user object.
 */
function handleAuthenticatedUser(user) {
    // Display user info and logout button
    headerRight.innerHTML = `
        <span class="text-sm text-gray-400">${user.displayName || user.email}</span>
        <button id="logout-btn" class="action-btn logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    // Render the main navigation links
    renderAuthenticatedNav();

    // Show the main content of the page
    if (pageContent) {
        pageContent.classList.remove('hidden');
    }
}

/**
 * Handles the UI state when no user is logged in.
 */
function handleNoUser() {
    // Display login button
    const loginButtonHTML = `
        <button id="login-btn" class="action-btn login-btn">Login to Begin</button>
    `;
    headerRight.innerHTML = loginButtonHTML;
    
    // Attach event listener for the login button
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => {
                console.error("Authentication Error:", error);
            });
        });
    }

    // Clear any navigation links
    headerCenter.innerHTML = '';

    // Show the main content (as it might contain guest-friendly content)
    if (pageContent) {
        pageContent.classList.remove('hidden');
    }
}

// --- INITIALIZATION ---

/**
 * Fetches Firebase config from the backend and initializes the app.
 * MUST be called before any other Firebase functions.
 */
async function initializeFirebaseApp() {
    try {
        // Fetch the config from our secure serverless function
        const response = await fetch('/api/generate-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'get-config' })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to fetch Firebase config.");
        }
        const firebaseConfig = await response.json();

        // Initialize the Firebase app with the fetched config
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app); // Set the global auth instance

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        if (authLoader) {
            authLoader.textContent = "Config Error";
        }
        // If initialization fails, prevent further execution
        throw error;
    }
}

/**
 * Main function that runs on page load.
 */
async function main() {
    try {
        await initializeFirebaseApp();
        
        // Now that Firebase is initialized, set up the auth state listener
        onAuthStateChanged(auth, (user) => {
            if (authLoader) authLoader.classList.add('hidden');
            
            if (user) {
                handleAuthenticatedUser(user);
            } else {
                handleNoUser();
            }
        });

    } catch (error) {
        console.error("Failed to start the application.", error);
        // Handle failure to initialize Firebase (e.g., show a persistent error message)
    }
}

// --- START THE APP ---
main();

