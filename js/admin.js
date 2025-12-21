// js/admin.js
import { auth, db, firebasePromise } from './firebase-app.js';
import { onAuthStateChanged, collection, getDocs, deleteDoc, doc } from './firebase-init.js';
import { postWithIdToken } from './screening-serverside.js';

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

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
        if (!user) { document.body.innerHTML = "<h2 style='text-align:center; padding:50px;'>Login Required</h2>"; return; }
        
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
                    return item; // Structure already matches
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

async function loadCatalog(type) {
    const listEl = document.getElementById(`list-${type}`);
    listEl.innerHTML = "Loading...";
    
    try {
        const snapshot = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', `${type}_catalog`));
        if (snapshot.empty) { listEl.innerHTML = "Empty Catalog"; return; }
        
        listEl.innerHTML = `<p>${snapshot.size} items found.</p>`;
        // In real app, render list here...
    } catch(e) {
        listEl.innerHTML = "Error loading list.";
    }
}
