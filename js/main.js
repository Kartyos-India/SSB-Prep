// js/main.js
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from './firebase-init.js';
import { firebaseReady, auth } from './firebase-app.js';

// --- DOM ELEMENTS ---
const headerRight = document.getElementById('header-right');
const headerCenter = document.getElementById('header-center');
const pageContent = document.getElementById('page-content');
const authLoader = document.getElementById('auth-loader');

// --- RENDER FUNCTIONS ---

/**
 * Updates the UI for an authenticated (logged-in) user.
 * - Renders the full navigation menu.
 * - Shows a personalized logout button.
 * - Enables all test module cards on the page.
 * @param {object} user - The Firebase user object.
 */
function handleAuthenticatedUser(user) {
    // 1. Render the Logout button with user's photo
    headerRight.innerHTML = `
        <div class="user-profile">
            <img src="${user.photoURL}" alt="${user.displayName}" class="user-avatar">
            <span class="user-name">${user.displayName}</span>
        </div>
        <button id="logout-btn" class="action-btn logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    // 2. Render the main navigation
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    headerCenter.innerHTML = `
        <a href="index.html" class="nav-link ${currentPage === 'index.html' ? 'active' : ''}">Home</a>
        <a href="screening.html" class="nav-link ${currentPage === 'screening.html' ? 'active' : ''}">Screening</a>
        <a href="psychology.html" class="nav-link ${currentPage === 'psychology.html' ? 'active' : ''}">Psychology</a>
        <a href="gto.html" class="nav-link ${currentPage === 'gto.html' ? 'active' : ''}">GTO</a>
        <a href="performance.html" class="nav-link ${currentPage === 'performance.html' ? 'active' : ''}">My Performance</a>
    `;

    // 3. Enable all module cards
    document.querySelectorAll('.test-card').forEach(card => {
        card.classList.remove('disabled');
        card.href = card.dataset.href; // Restore the original link
    });
}

/**
 * Updates the UI for a non-authenticated (logged-out) user.
 * - Shows an attractive login button.
 * - Displays a message in the nav area.
 * - Disables module cards that require a login.
 */
function handleNoUser() {
    // 1. Render the Login button
    headerRight.innerHTML = `
        <button id="login-btn" class="action-btn login-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span>Login</span>
        </button>
    `;
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => console.error("Auth Error:", error));
        });
    }

    // 2. Display a message in the navigation area to maintain layout
    headerCenter.innerHTML = `<span class="nav-message">Login to access all modules</span>`;
    
    // 3. Disable cards that require authentication
    document.querySelectorAll('.test-card').forEach(card => {
        if (card.dataset.requiresAuth === 'true') {
            card.classList.add('disabled');
            card.dataset.href = card.href; // Store the original link
            card.removeAttribute('href'); // Disable the link
        }
    });
}

// --- INITIALIZATION ---
async function main() {
    try {
        await firebaseReady;
        
        onAuthStateChanged(auth, (user) => {
            if (authLoader) authLoader.style.display = 'none';
            if (pageContent) pageContent.style.visibility = 'visible';

            if (user) {
                handleAuthenticatedUser(user);
            } else {
                handleNoUser();
            }
        });

    } catch (error) {
        console.error("💥 Failed to start application:", error);
        if (authLoader) authLoader.innerHTML = `<span class="error-text">App failed to load</span>`;
    }
}

// Add a pre-load state to prevent content flash
if (pageContent) pageContent.style.visibility = 'hidden';
main();

