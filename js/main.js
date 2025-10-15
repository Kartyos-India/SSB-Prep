// js/main.js
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from './firebase-init.js';
import { firebaseReady, auth } from './firebase-app.js';

// --- DOM ELEMENTS ---
const headerRight = document.getElementById('header-right');
const headerCenter = document.getElementById('header-center');
const pageContent = document.getElementById('page-content');
const authLoader = document.getElementById('auth-loader');
const testCards = document.querySelectorAll('.test-card');

// --- RENDER FUNCTIONS ---

/**
 * DOCUMENTATION:
 * Renders the main navigation links for an authenticated user.
 * The styling is updated to match the new, simpler design.
 */
function renderAuthenticatedNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    // The links are simpler now, with a bold blue color for the active link.
    headerCenter.innerHTML = `
        <a href="/index.html" class="${currentPage === 'index.html' ? 'text-blue-600 font-bold' : ''}">Home</a>
        <a href="/screening.html" class="${currentPage === 'screening.html' ? 'text-blue-600 font-bold' : ''}">Screening</a>
        <a href="/psychology.html" class="${currentPage === 'psychology.html' ? 'text-blue-600 font-bold' : ''}">Psychology</a>
        <a href="/gto.html" class="${currentPage === 'gto.html' ? 'text-blue-600 font-bold' : ''}">GTO</a>
        <a href="/performance.html" class="${currentPage === 'performance.html' ? 'text-blue-600 font-bold' : ''}">Performance</a>
    `;
}

/**
 * DOCUMENTATION:
 * Configures the UI for a logged-in user.
 */
function handleAuthenticatedUser(user) {
    headerRight.innerHTML = `
        <button id="logout-btn" class="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-gray-50 hover:bg-gray-100">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    
    renderAuthenticatedNav();
    updateCardAccess(true);
    if (pageContent) pageContent.classList.remove('hidden');
}

/**
 * DOCUMENTATION:
 * Configures the UI for a logged-out user.
 */
function handleNoUser() {
    headerRight.innerHTML = `<button id="login-btn" class="px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">Login</button>`;
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => {
                console.error("Authentication Error:", error);
                loginBtn.textContent = "Failed";
                setTimeout(() => { loginBtn.textContent = "Login"; }, 2000);
            });
        });
    }
    headerCenter.innerHTML = `
        <a href="/index.html" class="text-blue-600 font-bold">Home</a>
        <p class="text-gray-400">Login to access all modules</p>
    `;
    updateCardAccess(false); 
    if (pageContent) pageContent.classList.remove('hidden');
}

/**
 * DOCUMENTATION:
 * Updates the clickable state of test cards based on login status.
 * It checks for the `data-requires-auth` attribute we added in the HTML.
 * @param {boolean} isLoggedIn - True if the user is authenticated, false otherwise.
 */
function updateCardAccess(isLoggedIn) {
    testCards.forEach(card => {
        const requiresAuth = card.dataset.requiresAuth === 'true';

        // Store original href if it doesn't exist
        if (!card.dataset.originalHref) {
            card.dataset.originalHref = card.getAttribute('href');
        }

        if (requiresAuth && !isLoggedIn) {
            card.setAttribute('href', '#'); // Prevent navigation
            card.style.cursor = 'not-allowed';
            card.classList.add('opacity-60');
            card.title = 'You must be logged in to access this module.'; // Tooltip on hover
        } else {
            // Restore original properties if the user logs in
            card.setAttribute('href', card.dataset.originalHref);
            card.style.cursor = 'pointer';
            card.classList.remove('opacity-60');
            card.title = '';
        }
    });
}


// --- INITIALIZATION ---
async function main() {
    try {
        await firebaseReady;
        onAuthStateChanged(auth, (user) => {
            if (authLoader) authLoader.style.display = 'none';
            if (user) {
                handleAuthenticatedUser(user);
            } else {
                handleNoUser();
            }
        });
    } catch (error) {
        console.error("💥 Failed to initialize application:", error);
        if (authLoader) {
             authLoader.innerHTML = `<span class="text-red-500 text-xs font-semibold">Error</span>`;
        }
        if (pageContent) pageContent.classList.remove('hidden');
        handleNoUser();
    }
}

// Start the application.
main();

