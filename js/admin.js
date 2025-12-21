// js/admin.js
import { auth, db, firebasePromise } from './firebase-app.js';
import { onAuthStateChanged } from './firebase-init.js';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from './firebase-init.js';
import { postWithIdToken } from './screening-serverside.js';

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let currentTab = 'ppdt'; // 'ppdt' or 'oir'

// --- UTILS ---
function convertDriveLink(url) {
    if (!url) return null;
    let id = null;
    const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) id = match1[1];
    const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) id = match2[1];
    return id ? `https://lh3.googleusercontent.com/d/${id}` : url;
}

// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Wait for Firebase
    try {
        await firebasePromise;
    } catch (e) {
        console.error("Firebase Init Error:", e);
        document.getElementById('admin-content').innerHTML = `<p style="color:red">Error connecting to database.</p>`;
        return;
    }

    // 2. Auth Listener
    onAuthStateChanged(auth, user => {
        const warningEl = document.getElementById('login-warning');
        const contentEl = document.getElementById('admin-content');
        if (user) {
            warningEl.style.display = 'none';
            contentEl.style.display = 'block';
            loadCatalog(currentTab);
        } else {
            warningEl.style.display = 'block';
            contentEl.style.display = 'none';
        }
    });

    // --- TABS ---
    document.getElementById('tab-ppdt').addEventListener('click', () => switchTab('ppdt'));
    document.getElementById('tab-oir').addEventListener('click', () => switchTab('oir'));

    function switchTab(tab) {
        currentTab = tab;
        document.getElementById('tab-ppdt').className = tab === 'ppdt' ? 'tab-btn active' : 'tab-btn';
        document.getElementById('tab-oir').className = tab === 'oir' ? 'tab-btn active' : 'tab-btn';
        loadCatalog(tab);
    }

    // --- PPDT SINGLE UPLOAD ---
    const linkInput = document.getElementById('drive-link');
    const previewImg = document.getElementById('img-preview');
    if (linkInput) {
        linkInput.addEventListener('input', () => {
            const direct = convertDriveLink(linkInput.value);
            if (direct) {
                previewImg.src = direct;
                previewImg.style.display = 'block';
            } else {
                previewImg.style.display = 'none';
            }
        });
    }

    document.getElementById('add-ppdt-btn')?.addEventListener('click', async () => {
        const rawUrl = linkInput.value;
        const desc = document.getElementById('img-desc').value;
        const statusEl = document.getElementById('ppdt-single-status');
        const btn = document.getElementById('add-ppdt-btn');

        if (!rawUrl) return;

        btn.disabled = true; btn.textContent = "Adding...";
        try {
            const response = await postWithIdToken('/api/add-catalog-item', {
                appId: APP_ID,
                collectionName: 'ppdt_catalog',
                items: { path: convertDriveLink(rawUrl), originalLink: rawUrl, description: desc || "No description" }
            });
            if (!response.ok) throw new Error(await response.text());
            
            statusEl.textContent = "Success!"; statusEl.className = "status-msg status-success";
            linkInput.value = ""; document.getElementById('img-desc').value = ""; previewImg.style.display = 'none';
            if (currentTab === 'ppdt') loadCatalog('ppdt');
        } catch (e) {
            statusEl.textContent = "Error: " + e.message; statusEl.className = "status-msg status-error";
        } finally {
            btn.disabled = false; btn.textContent = "Add Single Image";
        }
    });

    // --- PPDT BULK UPLOAD ---
    document.getElementById('ppdt-bulk-btn')?.addEventListener('click', () => {
        handleBulkUpload('ppdt-json-file', 'ppdt-bulk-btn', 'ppdt-bulk-status', 'ppdt_catalog', (item) => {
             const rawUrl = item.link || item.url || item.path;
             if (!rawUrl) return null;
             return {
                 path: convertDriveLink(rawUrl),
                 originalLink: rawUrl,
                 description: item.description || item.desc || "Imported Image"
             };
        });
    });

    // --- OIR BULK UPLOAD ---
    document.getElementById('oir-bulk-btn')?.addEventListener('click', () => {
        handleBulkUpload('oir-json-file', 'oir-bulk-btn', 'oir-bulk-status', 'oir_catalog', (item) => {
             if (!item.question || !item.options || !item.answer) return null;
             return {
                 question: item.question,
                 options: item.options,
                 answer: item.answer,
                 type: item.type || 'general'
             };
        });
    });
});

function handleBulkUpload(inputId, btnId, statusId, collectionName, transformFn) {
    const fileInput = document.getElementById(inputId);
    const statusEl = document.getElementById(statusId);
    const btn = document.getElementById(btnId);

    if (!fileInput.files.length) {
        statusEl.textContent = "Select a JSON file first."; statusEl.className = "status-msg status-error"; return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    btn.disabled = true; statusEl.textContent = "Reading..."; statusEl.className = "status-msg";

    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!Array.isArray(json)) throw new Error("JSON must be an array.");

            const itemsToUpload = [];
            for (const item of json) {
                const processed = transformFn(item);
                if (processed) itemsToUpload.push(processed);
            }

            if (itemsToUpload.length === 0) throw new Error("No valid items found.");

            statusEl.textContent = `Uploading ${itemsToUpload.length} items...`;
            
            const response = await postWithIdToken('/api/add-catalog-item', {
                appId: APP_ID,
                collectionName: collectionName,
                items: itemsToUpload
            });

            if (!response.ok) throw new Error(await response.text());

            statusEl.textContent = `Success! Added ${itemsToUpload.length} items.`;
            statusEl.className = "status-msg status-success";
            fileInput.value = "";
            if (currentTab === (collectionName === 'ppdt_catalog' ? 'ppdt' : 'oir')) loadCatalog(currentTab);

        } catch (err) {
            statusEl.textContent = "Error: " + err.message;
            statusEl.className = "status-msg status-error";
        } finally {
            btn.disabled = false;
        }
    };
    reader.readAsText(file);
}

async function loadCatalog(type) {
    const listEl = document.getElementById('catalog-list');
    if (!listEl) return;
    
    listEl.innerHTML = '<div class="loader"></div>';
    const collectionName = type === 'ppdt' ? 'ppdt_catalog' : 'oir_catalog';

    try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', collectionName));
        
        if (querySnapshot.empty) {
            listEl.innerHTML = '<p>Catalog is empty.</p>';
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (type === 'ppdt') {
                html += `
                    <div style="display:flex; gap:1rem; align-items:center; background:var(--dark-bg); padding:1rem; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">
                        <img src="${data.path}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;" onerror="this.style.display='none'">
                        <div style="flex:1;">
                            <p style="font-weight:600; font-size:0.9rem;">${data.description}</p>
                            <a href="${data.originalLink}" target="_blank" style="font-size:0.8rem; color:var(--primary-blue);">Link</a>
                        </div>
                    </div>`;
            } else {
                html += `
                    <div style="background:var(--dark-bg); padding:1rem; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">
                        <p style="font-weight:600; font-size:0.95rem; margin-bottom:0.5rem;">${data.question}</p>
                        <p style="font-size:0.85rem; color:var(--text-secondary);">Ans: ${data.answer} | Type: ${data.type}</p>
                    </div>`;
            }
        });
        listEl.innerHTML = html;

    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--error-red);">Failed to load catalog.</p>';
    }
}
