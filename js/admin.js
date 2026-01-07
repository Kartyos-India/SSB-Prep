// js/admin.js
import { auth, db, firebasePromise } from './firebase-app.js';
import { onAuthStateChanged } from './firebase-init.js';
import { collection, getDocs, deleteDoc, doc } from './firebase-init.js';
import { postWithIdToken } from './screening-serverside.js';

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let currentTab = 'ppdt'; // 'ppdt' or 'oir'

// UTILS
function convertDriveLink(url) {
    if (!url) return null;
    let id = null;
    const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) id = match1[1];
    const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) id = match2[1];
    return id ? `https://lh3.googleusercontent.com/d/${id}` : url;
}

// MAIN
document.addEventListener('DOMContentLoaded', async () => {
    try { await firebasePromise; } catch(e) { console.error(e); return; }

    onAuthStateChanged(auth, user => {
        const warningEl = document.getElementById('login-warning');
        const contentEl = document.getElementById('admin-content');

        if (!user) {
             // User not logged in
             if (warningEl) warningEl.style.display = 'block';
             if (contentEl) contentEl.style.display = 'none';
             if (warningEl) warningEl.innerHTML = "<h3>Restricted Access</h3><p>Please log in with an authorized account.</p>";
             return;
        }

        // Email Check for Admin
        if (user.email !== 'aman.kartyos@gmail.com') {
            if (warningEl) warningEl.style.display = 'block';
            if (contentEl) contentEl.style.display = 'none';
            if (warningEl) warningEl.innerHTML = "<h3>Access Denied</h3><p>You are not authorized to view this page.</p>";
            return;
        }
        
        // Authorized
        if (warningEl) warningEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
        
        // Initial Load
        loadCatalog('ppdt');
    });

    // Tab Switching
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.admin-card').forEach(c => c.classList.remove('active'));
            const target = btn.dataset.target;
            document.getElementById(`card-${target}`).classList.add('active');
            
            loadCatalog(target);
        });
    });

    // Attach Global Handlers
    window.handleBulk = handleBulk;
    window.handleSingle = handleSingle;
    window.handleSingleOIR = handleSingleOIR; // Added handler for OIR
});

async function handleBulk(type) {
    const fileInput = document.getElementById(`${type}-json`);
    const statusEl = document.getElementById(`status-${type}`);
    
    if (!fileInput.files.length) return alert("Select file first");
    
    statusEl.textContent = "Processing...";
    statusEl.className = "status-msg";

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!Array.isArray(json)) throw new Error("JSON must be array");

            const items = json.map(item => {
                if (type === 'ppdt' || type === 'tat') {
                    const raw = item.link || item.url || item.path;
                    if(!raw) return null;
                    return {
                        path: convertDriveLink(raw),
                        originalLink: raw,
                        description: item.description || "Image"
                    };
                } else if (type === 'wat') {
                    return { word: item.word || item.text };
                } else if (type === 'srt') {
                    return { situation: item.situation || item.text };
                } else if (type === 'oir') {
                    // Support optional image field for OIR
                    const processedItem = { ...item };
                    if (processedItem.image) {
                        processedItem.image = convertDriveLink(processedItem.image);
                    }
                    return processedItem; 
                }
            }).filter(i => i !== null);

            await postWithIdToken('/api/add-catalog-item', {
                appId: APP_ID,
                collectionName: `${type}_catalog`,
                items: items
            });

            statusEl.textContent = `Success! Added ${items.length}`;
            statusEl.className = "status-msg status-success";
            loadCatalog(type);
        } catch (err) {
            statusEl.textContent = "Error: " + err.message;
            statusEl.className = "status-msg status-error";
        }
    };
    reader.readAsText(file);
}

async function handleSingle(type) {
    // Basic implementation for PPDT single only currently
    if (type !== 'ppdt') return;
    const input = document.getElementById('ppdt-single-link');
    const raw = input.value;
    if(!raw) return;

    await postWithIdToken('/api/add-catalog-item', {
        appId: APP_ID,
        collectionName: 'ppdt_catalog',
        items: [{
            path: convertDriveLink(raw),
            originalLink: raw,
            description: "Single Upload"
        }]
    });
    alert("Added!");
    loadCatalog('ppdt');
}

// Handler for Single OIR Question
async function handleSingleOIR() {
    const qText = document.getElementById('oir-q-text').value;
    const qImage = document.getElementById('oir-q-image').value;
    const qOptionsRaw = document.getElementById('oir-q-options').value;
    const qAnswer = document.getElementById('oir-q-answer').value;
    const qType = document.getElementById('oir-q-type').value;
    const statusEl = document.getElementById('oir-single-status');

    if (!qText && !qImage) return alert("Please provide at least Question Text or Image Link.");
    if (!qOptionsRaw || !qAnswer) return alert("Options and Answer are required.");

    // Parse options: split by comma and trim whitespace
    const options = qOptionsRaw.split(',').map(opt => opt.trim()).filter(opt => opt !== "");
    
    if (options.length < 2) return alert("Please provide at least 2 options.");

    statusEl.textContent = "Adding...";
    statusEl.className = "status-msg";

    try {
        const item = {
            question: qText,
            options: options,
            answer: qAnswer,
            type: qType
        };

        if (qImage) {
            item.image = convertDriveLink(qImage);
        }

        await postWithIdToken('/api/add-catalog-item', {
            appId: APP_ID,
            collectionName: 'oir_catalog',
            items: [item]
        });

        statusEl.textContent = "Success!";
        statusEl.className = "status-msg status-success";
        
        // Reset fields
        document.getElementById('oir-q-text').value = "";
        document.getElementById('oir-q-image').value = "";
        document.getElementById('oir-q-options').value = "";
        document.getElementById('oir-q-answer').value = "";
        
        loadCatalog('oir');

    } catch (e) {
        statusEl.textContent = "Error: " + e.message;
        statusEl.className = "status-msg status-error";
    }
}

// --- NEW DELETE HANDLER ---
async function deleteItem(collectionName, docId, btn) {
    if(!confirm("Are you sure you want to delete this item? This action cannot be undone.")) return;

    const originalText = btn.textContent;
    btn.textContent = "Deleting...";
    btn.disabled = true;

    try {
        const response = await postWithIdToken('/api/delete-catalog-item', {
            appId: APP_ID,
            collectionName: collectionName,
            docId: docId
        });

        if (!response.ok) throw new Error(await response.text());

        // Remove element from DOM immediately
        const row = btn.closest('.catalog-item') || btn.closest('div[style*="border-radius:8px"]');
        if (row) row.remove();

    } catch (e) {
        alert("Delete failed: " + e.message);
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function loadCatalog(type) {
    currentTab = type; // Keep track globally
    const listEl = document.getElementById(`list-${type}`);
    listEl.innerHTML = "Loading...";
    const collectionName = type === 'ppdt' ? 'ppdt_catalog' : type === 'tat' ? 'tat_catalog' : type === 'wat' ? 'wat_catalog' : type === 'srt' ? 'srt_catalog' : 'oir_catalog';
    
    try {
        const snapshot = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', collectionName));
        if (snapshot.empty) { listEl.innerHTML = "<p style='color: #888;'>No items found.</p>"; return; }
        
        let html = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            
            // Generate Delete Button
            const deleteBtnHtml = `<button class="delete-btn" data-id="${id}" data-coll="${collectionName}" style="background:transparent; border:1px solid var(--error-red); color:var(--error-red); padding:4px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem; float:right;">Delete</button>`;

            if (type === 'ppdt' || type === 'tat') {
                html += `
                    <div class="catalog-item" style="display:flex; gap:1rem; align-items:center; background:var(--dark-bg); padding:1rem; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">
                        <img src="${data.path}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;" onerror="this.style.display='none'">
                        <div style="flex:1;">
                            <p style="font-weight:600; font-size:0.9rem;">${data.description}</p>
                            <a href="${data.originalLink}" target="_blank" style="font-size:0.8rem; color:var(--primary-blue);">Link</a>
                        </div>
                        ${deleteBtnHtml}
                    </div>`;
            } else {
                html += `
                    <div class="catalog-item" style="background:var(--dark-bg); padding:1rem; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">
                        ${deleteBtnHtml}
                        <p style="font-weight:600; font-size:0.95rem; margin-bottom:0.5rem; padding-right: 60px;">${data.question || data.word || data.situation}</p>
                        ${data.image ? `<img src="${data.image}" style="max-width:100%; height:auto; margin-bottom:0.5rem; border-radius:4px;">` : ''}
                        <p style="font-size:0.85rem; color:var(--text-secondary);">${data.answer ? 'Ans: ' + data.answer : ''}</p>
                    </div>`;
            }
        });
        listEl.innerHTML = html;

        // Attach event listeners to all delete buttons
        listEl.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteItem(btn.dataset.coll, btn.dataset.id, btn);
            });
        });

    } catch(e) {
        console.error(e);
        listEl.innerHTML = "Error loading list.";
    }
}
