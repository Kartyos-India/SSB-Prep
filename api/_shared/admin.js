// js/main.js
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from './firebase-init.js';
import { firebasePromise, auth, db } from './firebase-app.js';


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
            <a href="performance.html" class="nav-link ${currentPage === 'performance.html' ? 'active' : ''} ${isPerformanceDisabled}">Dashboard</a>
        </nav>
    `;

    const authHTML = user ? `
        <div class="user-menu">
            <div class="user-info">
                <img src="${user.photoURL || 'https://via.placeholder.com/32'}" alt="User Avatar" onerror="this.onerror=null;this.src='https://via.placeholder.com/32';">
                <span>${user.displayName || user.email.split('@')[0]}</span>
            </div>
            <div class="user-links">
                <a href="performance.html#settings">Settings</a>
                <span style="color: #30363D">|</span>
                <button id="logout-btn" class="auth-btn" style="border:none; padding:0; color:var(--text-secondary); font-weight:400;">Logout</button>
            </div>
        </div>
    ` : `
        <button id="login-btn" class="auth-btn">Login</button>
    `;

    headerBar.innerHTML = `
        <a href="index.html" class="header-logo">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>SSB Prep</span>
        </a>
        ${navHTML}
        <div class="header-auth">
            ${authHTML}
        </div>
    `;

    // Attach event listeners after rendering
    if (user) {
        document.getElementById('logout-btn').addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = 'index.html');
        });
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
    if (headerRenderPromise) return headerRenderPromise;

    headerRenderPromise = new Promise(async (resolve, reject) => {
        try {
            // Wait for Firebase to be ready before doing anything auth-related.
            // FIXED: Using firebasePromise because that is what is imported at the top.
            await firebasePromise; 
            
            onAuthStateChanged(auth, (user) => {
                renderHeader(user);
                resolve(); 
            });
        } catch (error) {
            console.error("💥 Failed to start application:", error);
            renderHeader(null); 
            resolve(); 
        }
    });
    return headerRenderPromise;
}

export const appInitialized = main();
