// js/main.js - Handles global logic like header rendering and authentication.

import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from './firebase-init.js';
import { firebaseReady, auth } from './firebase-app.js';

const headerBar = document.getElementById('header-bar');
let headerRenderPromise;

function renderHeader(user) {
    if (!headerBar) return;

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isPerformanceDisabled = !user ? 'disabled' : '';

    const navHTML = `
        <nav class="header-nav">
            <a href="index.html" class="${currentPage === 'index.html' ? 'active' : ''}">Home</a>
            <a href="screening.html" class="${currentPage === 'screening.html' ? 'active' : ''}">Screening</a>
            <a href="psychology.html" class="${currentPage === 'psychology.html' ? 'active' : ''}">Psychology</a>
            <a href="gto.html" class="${currentPage === 'gto.html' ? 'active' : ''}">GTO</a>
            <a href="performance.html" class="${currentPage === 'performance.html' ? 'active' : ''} ${isPerformanceDisabled}">My Performance</a>
        </nav>
    `;

    const authHTML = user ? `
        <div class="user-menu">
            <div class="user-info">
                <img src="${user.photoURL || `https://ui-avatars.com/api/?name=${user.email}&background=0D1117&color=E6EDF3`}" alt="User Avatar">
                <span>${user.displayName || user.email}</span>
            </div>
            <button id="logout-btn" class="auth-btn">Logout</button>
        </div>
    ` : `<button id="login-btn" class="auth-btn">Login</button>`;

    headerBar.innerHTML = `
        <a href="index.html" class="header-logo">
            <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span>SSB Prep Platform</span>
        </a>
        ${navHTML}
        <div class="header-auth">${authHTML}</div>
    `;

    if (user) {
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
    } else {
        document.getElementById('login-btn').addEventListener('click', () => {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch(error => console.error("Auth Error:", error));
        });
        if (currentPage === 'index.html') {
             document.querySelectorAll('a[data-requires-auth="true"]').forEach(link => {
                link.style.pointerEvents = 'none';
                link.style.opacity = '0.6';
                link.title = 'Please log in to access this feature.';
            });
        }
    }
}

async function main() {
    if (headerRenderPromise) return headerRenderPromise;
    headerRenderPromise = new Promise(async (resolve) => {
        try {
            await firebaseReady;
            onAuthStateChanged(auth, (user) => {
                renderHeader(user);
                resolve(); 
            });
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            renderHeader(null); 
            resolve();
        }
    });
    return headerRenderPromise;
}

export const appInitialized = main();

