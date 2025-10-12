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

// --- FIREBASE CONFIG ---
// Replace this with your actual Firebase config from Firebase Console
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};

// --- INITIALIZATION ---
async function initializeFirebaseApp() {
    try {
        // Try to get config from backend first
        let config = firebaseConfig;
        
        try {
            const response = await fetch('/api/generate-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'get-config' })
            });
            
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const serverConfig = await response.json();
                    if (serverConfig.apiKey) {
                        config = serverConfig;
                        console.log("Using Firebase config from server");
                    }
                }
            }
        } catch (fetchError) {
            console.log("Using default Firebase config");
        }

        if (!config.apiKey || config.apiKey === "your-api-key-here") {
            throw new Error("Please configure Firebase in main.js with your actual Firebase project settings");
        }

        const app = initializeApp(config);
        auth = getAuth(app);
        console.log("Firebase initialized successfully");

    } catch (error) {
        console.error("Firebase Initialization Error:", error);
        if (authLoader) {
            authLoader.innerHTML = `Firebase Error<br><span style="font-size: 0.8rem; color: #ffb8b8;">Check Console</span>`;
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
