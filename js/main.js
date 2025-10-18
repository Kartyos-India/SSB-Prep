// js/main.js
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from './firebase-init.js';
import { firebaseReady, auth } from './firebase-app.js';

// --- DOM ELEMENTS ---
const headerBar = document.getElementById('header-bar');

let headerRenderPromise;

// --- RENDER FUNCTIONS ---
function renderHeader(user) {
    // Ensure the headerBar element exists before trying to modify it.
    if (!headerBar) {
        console.error("Header element #header-bar not found in the DOM.");
        return;
    }

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Determine which navigation links should be disabled if the user is not logged in
    const isPerformanceDisabled = !user ? 'disabled' : '';
    
    const navHTML = `
        <nav class="header-nav">
            <a href="index.html" class="${currentPage === 'index.html' ? 'active' : ''}">Home</a>
            <a href="screening.html" class="${currentPage === 'screening.html' ? 'active' : ''}">Screening</a>
            <a href="psychology.html" class="${currentPage === 'psychology.html' ? 'active' : ''}">Psychology</a>
            <a href="gto.html" class="${currentPage === 'gto.html' ? 'active' : ''}">GTO</a>
            <a href="performance.html" class="nav-link ${currentPage === 'performance.html' ? 'active' : ''} ${isPerformanceDisabled}">My Performance</a>
        </nav>
    `;

    const authHTML = user ? `
        <div class="user-menu">
            <div class="user-info">
                <img src="${user.photoURL || 'https://via.placeholder.com/32'}" alt="User Avatar" onerror="this.onerror=null;this.src='https://via.placeholder.com/32';">
                <span>${user.displayName || user.email}</span>
            </div>
            <button id="logout-btn" class="auth-btn">Logout</button>
        </div>
    ` : `
        <button id="login-btn" class="auth-btn">Login</button>
    `;

    headerBar.innerHTML = `
        <a href="index.html" class="header-logo">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>SSB Prep Platform</span>
        </a>
        ${navHTML}
        <div class="header-auth">
            ${authHTML}
        </div>
    `;

    // Attach event listeners after rendering
    if (user) {
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    } else {
        document.getElementById('login-btn').addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => console.error("Auth Error:", error));
        });
    }

    // Disable auth-required links on the homepage if logged out
    if (!user && currentPage === 'index.html') {
        document.querySelectorAll('a[data-requires-auth="true"]').forEach(link => {
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.6';
            link.title = 'Please log in to access this feature.';
        });
    }
}

// --- INITIALIZATION ---
async function main() {
    // This function ensures the header is rendered reliably.
    // It's exported as a promise so other scripts can wait for it to complete.
    if (headerRenderPromise) return headerRenderPromise;

    headerRenderPromise = new Promise(async (resolve, reject) => {
        try {
            // Wait for Firebase to be ready before doing anything auth-related.
            await firebaseReady;
            
            // Set up the listener that re-renders the header whenever auth state changes.
            onAuthStateChanged(auth, (user) => {
                renderHeader(user);
                resolve(); // Resolve the promise once the header has been rendered for the first time.
            });
        } catch (error) {
            console.error("💥 Failed to start application:", error);
            // Even if Firebase fails, render a logged-out header.
            renderHeader(null); 
            resolve(); // Resolve so the app doesn't hang, but show a logged-out state.
            // We don't reject here because we still want to render a usable page.
        }
    });
    return headerRenderPromise;
}

// Export the main function's promise so other scripts (like screening.js) can wait for it.
export const appInitialized = main();

