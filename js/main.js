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
            signInWithPopup(auth, provider).catch(error => console.error("Auth Error:", error));
        });
    }
    headerCenter.innerHTML = ''; // No nav links if not logged in
    if (pageContent) pageContent.classList.remove('hidden');
}

// --- INITIALIZATION ---
async function initializeFirebaseApp() {
    try {
        console.log("Fetching Firebase config from Vercel environment...");
        
        const response = await fetch('/api/get-firebase-config', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
        }
        
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig.apiKey) {
            throw new Error("Invalid Firebase config received from server");
        }

        console.log("Firebase config loaded successfully");
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        if (authLoader) {
            authLoader.innerHTML = `Config Error<br><span style="font-size: 0.8rem; color: #ffb8b8;">${error.message}</span>`;
        }
        throw error;
    }
}

async function main() {
    try {
        await initializeFirebaseApp();
        onAuthStateChanged(auth, (user) => {
            if (authLoader) authLoader.classList.add('hidden');
            if (user) {
                handleAuthenticatedUser(user);
            } else {
                handleNoUser();
            }
        });
    } catch (error) {
        console.error("Failed to start the application.", error.message);
    }
}

main();
