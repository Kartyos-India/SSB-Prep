// js/performance.js
// Combined logic for Performance History and Profile/Settings management.

import { onAuthStateChanged, collection, query, getDocs, orderBy, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from './firebase-init.js';
import { firebasePromise, auth, db } from './firebase-app.js';
import { postWithIdToken } from './screening-serverside.js';

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

            <!-- Right Column: Settings / API Key -->
            <div class="dashboard-section" id="settings-section">
                <h2 id="settings">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Settings
                </h2>
                <div class="profile-form">
                    <label for="hf-api-key">HuggingFace API Key</label>
                    <input id="hf-api-key" class="api-key-input" type="text" placeholder="Loading status..." autocomplete="off" />
                    <div class="small-note">Saved privately. Required for AI features.</div>
                    
                    <div class="profile-actions">
                        <button id="hf-save-btn" class="profile-btn primary">Save</button>
                        <button id="hf-test-btn" class="profile-btn secondary">Test</button>
                        <button id="hf-delete-btn" class="profile-btn danger">Delete</button>
                    </div>
                    <div id="hf-status" class="status-msg"></div>
                </div>
            </div>
        </div>
    `;

    // Initialize Sub-Components
    loadPerformanceHistory(user.uid);
    initializeProfileSettings(user.uid);
}

// --- MODULE 1: PERFORMANCE HISTORY ---
async function loadPerformanceHistory(userId) {
    const container = document.getElementById('performance-list-container');
    try {
        // Updated path: artifacts/{appId}/users/{uid}/tests
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
            
            let resultHtml = '';
            if (data.testType === 'PPDT') {
                resultHtml = `<span class="test-score neutral">Completed</span>`;
            } else if (typeof data.score === 'number') {
                const percentage = (data.score / data.total) * 100;
                const scoreClass = percentage >= 60 ? 'pass' : 'fail';
                resultHtml = `<span class="test-score ${scoreClass}">${data.score}/${data.total}</span>`;
            } else {
                resultHtml = `<span class="test-score neutral">N/A</span>`;
            }

            return `
                <div class="test-result-card">
                    <div class="test-info">
                        <h3>${data.testType || 'Practice Test'}</h3>
                        <p class="test-date">${date}</p>
                    </div>
                    ${resultHtml}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading performance:", error);
        container.innerHTML = `<p style="color:var(--error-red);">Failed to load history.</p>`;
    }
}

// --- MODULE 2: PROFILE SETTINGS (HF KEY) ---
async function initializeProfileSettings(userId) {
    const inputEl = document.getElementById('hf-api-key');
    const statusEl = document.getElementById('hf-status');

    function setStatus(text, type = '') {
        statusEl.textContent = text;
        statusEl.className = 'status-msg' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
    }

    // 1. Load current status (exists or not)
    try {
        const ref = doc(db, 'users', userId, 'secrets', 'hf'); // Keep original path for secrets for compatibility
        const snap = await getDoc(ref);
        if (snap.exists()) {
            inputEl.placeholder = '•••••••••••••••• (Saved)';
            setStatus('Key is saved and ready.', 'ok');
        } else {
            inputEl.placeholder = 'Paste your HF_xxx key here';
            setStatus('No key saved.');
        }
    } catch (e) {
        console.warn('Profile load error:', e);
        inputEl.placeholder = 'Error checking status';
    }

    // 2. Event Handlers
    document.getElementById('hf-save-btn').addEventListener('click', async () => {
        const rawKey = inputEl.value.trim();
        if (!rawKey) return setStatus('Please paste a key first.', 'err');
        
        setStatus('Saving...');
        try {
            await setDoc(doc(db, 'users', userId, 'secrets', 'hf'), { 
                key: rawKey, 
                updatedAt: serverTimestamp() 
            });
            inputEl.value = '';
            inputEl.placeholder = '•••••••••••••••• (Saved)';
            setStatus('Key saved successfully!', 'ok');
        } catch (err) {
            setStatus('Save failed: ' + err.message, 'err');
        }
    });

    document.getElementById('hf-test-btn').addEventListener('click', async () => {
        setStatus('Testing key with AI server...');
        try {
            // Simple prompt to check connectivity
            const testPrompt = 'Return a single JSON array of one question like [{"question":"Is this a test?","options":["A","B","C","D"],"answer":0}]';
            const resp = await postWithIdToken('/api/generate-oir-questions', { prompt: testPrompt });
            if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
            setStatus('Test successful! Key is working.', 'ok');
        } catch (err) {
            setStatus('Test failed: ' + err.message, 'err');
        }
    });

    document.getElementById('hf-delete-btn').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to remove your API key? AI features will stop working.')) return;
        setStatus('Deleting...');
        try {
            await deleteDoc(doc(db, 'users', userId, 'secrets', 'hf'));
            inputEl.placeholder = 'Paste your HF_xxx key here';
            setStatus('Key deleted.', 'ok');
        } catch (err) {
            setStatus('Delete failed: ' + err.message, 'err');
        }
    });
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await firebasePromise;
        onAuthStateChanged(auth, renderDashboard);
    } catch (error) {
        console.error("Dashboard Init Error:", error);
        pageContent.innerHTML = `<div class="dashboard-section"><p style="color:var(--error-red)">System Error: Could not connect to database.</p></div>`;
    }
});
