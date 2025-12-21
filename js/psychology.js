// js/performance.js
// Logic for Performance Dashboard (History & Settings)

import { onAuthStateChanged, collection, query, getDocs, orderBy, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from './firebase-init.js';
// FIXED: Import firebasePromise to wait for init
import { firebasePromise, auth, db } from './firebase-app.js';

const pageContent = document.getElementById('page-content');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- MAIN RENDER FUNCTION ---
async function renderDashboard(user) {
    if (!user) {
        pageContent.innerHTML = `
            <div class="text-center bg-gray-800 p-8 rounded-lg shadow-md border border-gray-700 dashboard-section" style="margin-top: 3rem;">
                <h2 style="justify-content:center; border:none;">Access Denied</h2>
                <p class="text-gray-400 mt-2">Please log in to view your dashboard.</p>
                <button id="login-redirect-btn" class="cta-button" style="margin-top: 1rem; border:none; cursor:pointer;">Go to Home</button>
            </div>
        `;
        document.getElementById('login-redirect-btn').addEventListener('click', () => window.location.href = 'index.html');
        return;
    }

    // Skeleton Layout
    pageContent.innerHTML = `
        <div class="page-title-section" style="padding-bottom: 1rem;">
            <h1>My Dashboard</h1>
            <p>Welcome back, ${user.displayName || 'Candidate'}</p>
        </div>
        
        <div class="dashboard-grid">
            <!-- Left Column: Performance History -->
            <div class="dashboard-section" id="performance-section">
                <h2>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    Performance History
                </h2>
                <div id="performance-list-container" class="performance-list">
                    <div class="loader"></div>
                </div>
            </div>

            <!-- Right Column: Settings / Profile -->
            <div class="dashboard-section" id="settings-section">
                <h2 id="settings">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Settings
                </h2>
                <div class="profile-form">
                    <p class="text-gray-400 text-sm mb-4">Manage your account preferences here.</p>
                    <button id="logout-btn-dash" class="profile-btn danger w-full">Logout</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('logout-btn-dash').addEventListener('click', () => auth.signOut());

    // Initialize Sub-Components
    loadPerformanceHistory(user.uid);
}

// --- MODULE 1: PERFORMANCE HISTORY ---
async function loadPerformanceHistory(userId) {
    const container = document.getElementById('performance-list-container');
    try {
        // Path: artifacts/{appId}/users/{uid}/tests
        const testsRef = collection(db, 'artifacts', appId, 'users', userId, 'tests');
        const q = query(testsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `<p style="color:var(--text-secondary); text-align:center; padding: 2rem;">No tests taken yet. <a href="index.html#modules" style="color:var(--primary-blue);">Start one now!</a></p>`;
            return;
        }

        container.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleDateString("en-US", {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Unknown Date';
            
            const uniqueId = doc.id;
            let resultHtml = '';
            let detailsHtml = '';

            // Handle PPDT
            if (data.testType === 'PPDT') {
                resultHtml = `<span class="test-score neutral" style="font-size:0.9rem; cursor:pointer;">View Story ▼</span>`;
                detailsHtml = `
                <div id="details-${uniqueId}" style="display:none; margin-top: 15px; padding-top:15px; border-top:1px solid var(--border-color);">
                    <div style="display:flex; flex-direction:column; gap:15px;">
                        <img src="${data.imageUrl}" style="width: 100%; max-width: 300px; border-radius:8px; border:1px solid var(--border-color);" onerror="this.style.display='none'">
                        <div style="background:var(--dark-bg); padding:1rem; border-radius:8px;">
                            <h4 style="margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.85rem; text-transform:uppercase; letter-spacing:0.05em;">Your Story</h4>
                            <p style="font-size:0.95rem; color:var(--text-primary); white-space: pre-wrap;">${data.story || 'No text saved.'}</p>
                        </div>
                    </div>
                </div>`;
            } 
            // Handle OIR
            else if (data.testType === 'OIR') {
                const percentage = (data.score / data.total) * 100;
                const scoreClass = percentage >= 60 ? 'pass' : 'fail';
                resultHtml = `<span class="test-score ${scoreClass}">${data.score}/${data.total}</span>`;
            } 
            else {
                resultHtml = `<span class="test-score neutral">N/A</span>`;
            }

            return `
                <div class="test-result-card" id="card-${uniqueId}" data-has-details="${!!detailsHtml}">
                    <div class="card-summary" style="display: flex; justify-content: space-between; align-items: center; cursor:${detailsHtml ? 'pointer' : 'default'}">
                        <div class="test-info">
                            <h3>${data.testType || 'Practice Test'}</h3>
                            <p class="test-date">${date}</p>
                        </div>
                        ${resultHtml}
                    </div>
                    ${detailsHtml}
                </div>
            `;
        }).join('');

        // Attach Event Listeners for Accordion
        snapshot.docs.forEach(doc => {
            const card = document.getElementById(`card-${doc.id}`);
            if (card && card.dataset.hasDetails === 'true') {
                card.querySelector('.card-summary').addEventListener('click', () => {
                    const details = document.getElementById(`details-${doc.id}`);
                    if (details.style.display === 'none') {
                        details.style.display = 'block';
                    } else {
                        details.style.display = 'none';
                    }
                });
            }
        });

    } catch (error) {
        console.error("Error loading performance:", error);
        container.innerHTML = `<p style="color:var(--error-red);">Failed to load history.</p>`;
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Auth to Initialize
    try {
        await firebasePromise;
        onAuthStateChanged(auth, renderDashboard);
    } catch(e) {
        console.error("Init failed", e);
    }
});
