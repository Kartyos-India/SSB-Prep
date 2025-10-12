// js/main.js
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut,
    getAuth
} from './firebase-init.js';

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
            signInWithPopup(auth, provider).catch(error => {
                console.error("Auth Error:", error);
                alert("Login failed. Please check console for details.");
            });
        });
    }
    headerCenter.innerHTML = ''; // No nav links if not logged in
    if (pageContent) pageContent.classList.remove('hidden');
}

// --- INITIALIZATION ---
async function initializeFirebaseApp() {
    try {
        console.log("🚀 Initializing Firebase...");
        
        // Get config from Vercel serverless function
        const response = await fetch('/api/get-firebase-config');
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const firebaseConfig = await response.json();
        
        if (!firebaseConfig || !firebaseConfig.apiKey) {
            throw new Error("Invalid Firebase config received from server");
        }

        console.log("✅ Firebase config loaded successfully");
        const { initializeApp } = await import('./firebase-init.js');
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        return true;

    } catch (error) {
        console.error("❌ Firebase Initialization Failed:", error);
        
        if (authLoader) {
            authLoader.innerHTML = `
                <div style="text-align: center;">
                    <div>Firebase Config Error</div>
                    <div style="font-size: 0.8rem; color: #ffb8b8; margin-top: 0.5rem;">
                        ${error.message}<br>
                        <button onclick="window.location.reload()" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #3B82F6; border: none; border-radius: 4px; color: white; cursor: pointer;">
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
        return false;
    }
}

async function main() {
    try {
        const firebaseInitialized = await initializeFirebaseApp();
        
        if (firebaseInitialized) {
            // Firebase initialized successfully
            onAuthStateChanged(auth, (user) => {
                if (authLoader) authLoader.classList.add('hidden');
                if (user) {
                    handleAuthenticatedUser(user);
                } else {
                    handleNoUser();
                }
            });
        } else {
            // Firebase failed to initialize, but still show the page
            if (authLoader) authLoader.classList.add('hidden');
            if (pageContent) pageContent.classList.remove('hidden');
            handleNoUser();
            
            console.warn("App running without Firebase authentication");
        }
    } catch (error) {
        console.error("💥 Failed to start application:", error);
        if (authLoader) authLoader.classList.add('hidden');
        if (pageContent) pageContent.classList.remove('hidden');
        handleNoUser();
    }
}

main();
