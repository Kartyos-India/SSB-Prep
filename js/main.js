// js/main.js
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from './firebase-init.js';
// Import the initialized auth instance from our new central module
import { firebasePromise, auth } from './firebase-app.js';

// --- DOM ELEMENTS ---
const headerRight = document.getElementById('header-right');
const headerCenter = document.getElementById('header-center');
const pageContent = document.getElementById('page-content');
const authLoader = document.getElementById('auth-loader');

// --- RENDER FUNCTIONS ---
function renderAuthenticatedNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    headerCenter.innerHTML = `
        <a href="screening.html" class="nav-link ${currentPage === 'screening.html' ? 'active' : ''}">Screening</a>
        <a href="psychology.html" class="nav-link ${currentPage === 'psychology.html' ? 'active' : ''}">Psychology</a>
        <a href="gto.html" class="nav-link ${currentPage === 'gto.html' ? 'active' : ''}">GTO</a>
        <a href="performance.html" class="nav-link ${currentPage === 'performance.html' ? 'active' : ''}">My Performance</a>
    `;
}

function handleAuthenticatedUser(user) {
    headerRight.innerHTML = `
        <span class="text-sm text-gray-400">${user.displayName || user.email}</span>
        <button id="logout-btn" class="action-btn logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    renderAuthenticatedNav();
    if (pageContent) pageContent.classList.remove('hidden');
}

function handleNoUser() {
    headerRight.innerHTML = `<button id="login-btn" class="action-btn login-btn">Login</button>`;
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => {
                console.error("Auth Error:", error);
                // Non-blocking error indication
                loginBtn.textContent = "Login Failed";
                setTimeout(() => { loginBtn.textContent = "Login"; }, 2000);
            });
        });
    }
    headerCenter.innerHTML = ''; // No nav links if not logged in
    if (pageContent) pageContent.classList.remove('hidden');
}

// --- INITIALIZATION ---
async function main() {
    try {
        // Wait for our central Firebase initialization to complete
        await firebasePromise;
        
        // Now that we're sure Firebase is ready, we set up the auth listener.
        onAuthStateChanged(auth, (user) => {
            if (authLoader) authLoader.classList.add('hidden');
            if (user) {
                handleAuthenticatedUser(user);
            } else {
                handleNoUser();
            }
        });

    } catch (error) {
        console.error("💥 Failed to start application:", error);
        if (authLoader) {
             authLoader.innerHTML = `<span class="text-red-400 text-sm">Firebase Failed</span>`;
        }
        if (pageContent) pageContent.classList.remove('hidden');
        handleNoUser();
    }
}

main();
