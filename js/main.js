// js/main.js
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from './firebase-init.js';
import { firebaseReady, auth } from './firebase-app.js';

// --- DOM ELEMENTS ---
const headerRight = document.getElementById('header-right');
const headerCenter = document.getElementById('header-center');
const pageContent = document.getElementById('page-content');
const authLoader = document.getElementById('auth-loader');

/**
 * Renders the main navigation menu.
 * @param {boolean} isAuthenticated - Whether the user is logged in or not.
 */
function renderNavMenu(isAuthenticated) {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    const navLinks = [
        { href: 'index.html', text: 'Home', requiresAuth: false },
        { href: 'screening.html', text: 'Screening', requiresAuth: true },
        { href: 'psychology.html', text: 'Psychology', requiresAuth: true },
        { href: 'gto.html', text: 'GTO', requiresAuth: true },
        { href: 'performance.html', text: 'My Performance', requiresAuth: true }
    ];

    headerCenter.innerHTML = navLinks.map(link => {
        const isActive = currentPage === link.href;
        const isDisabled = link.requiresAuth && !isAuthenticated;
        
        if (isDisabled) {
            return `<span class="nav-link disabled" title="Please log in to access">${link.text}</span>`;
        }

        return `<a href="${link.href}" class="nav-link ${isActive ? 'active' : ''}">${link.text}</a>`;
    }).join('');
}


/**
 * Updates the UI for an authenticated (logged-in) user.
 * @param {object} user - The Firebase user object.
 */
function handleAuthenticatedUser(user) {
    // New structure with a .user-menu container
    headerRight.innerHTML = `
        <div class="user-menu">
            <div class="user-info">
                <span class="user-name">${user.displayName}</span>
                <img src="${user.photoURL}" alt="User Avatar" class="user-avatar">
            </div>
            <button id="logout-btn" class="action-btn logout-btn">Logout</button>
        </div>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

    renderNavMenu(true);

    document.querySelectorAll('.test-card').forEach(card => {
        card.classList.remove('disabled');
        if (card.dataset.href) {
            card.href = card.dataset.href;
        }
    });
}

/**
 * Updates the UI for a non-authenticated (logged-out) user.
 */
function handleNoUser() {
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

    renderNavMenu(false);

    document.querySelectorAll('.test-card').forEach(card => {
        if (card.dataset.requiresAuth === 'true') {
            card.classList.add('disabled');
            card.dataset.href = card.href;
            card.removeAttribute('href');
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

if (pageContent) pageContent.style.visibility = 'hidden';
main();

