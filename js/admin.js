// js/admin.js
import { auth, firebasePromise } from './firebase-app.js';
import { onAuthStateChanged, collection, getDocs, deleteDoc, doc } from './firebase-init.js';
import { db } from './firebase-app.js'; // Needed for reading the list
import { postWithIdToken } from './screening-serverside.js'; // Import helper for API calls

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- UTILS ---
function convertDriveLink(url) {
    if (!url) return null;
    let id = null;
    const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) id = match1[1];
    const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) id = match2[1];

    if (id) {
        return `https://lh3.googleusercontent.com/d/${id}`;
    }
    return url;
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
            loadCatalog();
        } else {
            warningEl.style.display = 'block';
            contentEl.style.display = 'none';
        }
    });

    // --- PREVIEW HANDLER ---
    const linkInput = document.getElementById('drive-link');
    const previewImg = document.getElementById('img-preview');
    
    if (linkInput) {
        linkInput.addEventListener('input', () => {
            const raw = linkInput.value;
            const direct = convertDriveLink(raw);
            if (direct) {
                previewImg.src = direct;
                previewImg.style.display = 'block';
                previewImg.onerror = () => { previewImg.style.display = 'none'; };
            } else {
                previewImg.style.display = 'none';
            }
        });
    }

    // --- SINGLE ADD BUTTON (Via API) ---
    const addBtn = document.getElementById('add-ppdt-btn');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            const rawUrl = linkInput.value;
            const desc = document.getElementById('img-desc').value;
            const statusEl = document.getElementById('ppdt-status');

            if (!rawUrl) return;

            const directUrl = convertDriveLink(rawUrl);
            addBtn.disabled = true;
            addBtn.textContent = "Adding...";

            try {
                // Call Server API instead of Client SDK
                const response = await postWithIdToken('/api/add-catalog-item', {
                    appId: APP_ID,
                    collectionName: 'ppdt_catalog',
                    items: {
                        path: directUrl,
                        originalLink: rawUrl,
                        description: desc || "No description"
                    }
                });

                if (!response.ok) throw new Error(await response.text());

                statusEl.textContent = "Success!";
                statusEl.className = "status-msg status-success";
                linkInput.value = "";
                document.getElementById('img-desc').value = "";
                previewImg.style.display = 'none';
                loadCatalog();
            } catch (e) {
                console.error("Add Error:", e);
                statusEl.textContent = "Error: " + e.message;
                statusEl.className = "status-msg status-error";
            } finally {
                addBtn.disabled = false;
                addBtn.textContent = "Add Single Image";
            }
        });
    }

    // --- BULK UPLOAD HANDLER (Via API) ---
    const bulkBtn = document.getElementById('bulk-upload-btn');
    if (bulkBtn) {
        bulkBtn.addEventListener('click', () => {
            const fileInput = document.getElementById('bulk-json-file');
            const statusEl = document.getElementById('bulk-status');

            if (!fileInput.files.length) {
                statusEl.textContent = "Please select a JSON file first.";
                statusEl.className = "status-msg status-error";
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();

            bulkBtn.disabled = true;
            bulkBtn.textContent = "Processing...";
            statusEl.textContent = "Reading file...";
            statusEl.className = "status-msg";

            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (!Array.isArray(json)) throw new Error("JSON must be an array of objects.");

                    statusEl.textContent = `Found ${json.length} items. Uploading...`;
                    
                    const itemsToUpload = [];

                    for (const item of json) {
                        const rawUrl = item.link || item.url || item.path;
                        const desc = item.description || item.desc || "Imported Image";

                        if (!rawUrl) continue;

                        itemsToUpload.push({
                            path: convertDriveLink(rawUrl),
                            originalLink: rawUrl,
                            description: desc
                        });
                    }

                    if (itemsToUpload.length === 0) throw new Error("No valid items found.");

                    // Call API with bulk data
                    const response = await postWithIdToken('/api/add-catalog-item', {
                        appId: APP_ID,
                        collectionName: 'ppdt_catalog',
                        items: itemsToUpload
                    });

                    if (!response.ok) throw new Error(await response.text());

                    statusEl.textContent = `Complete! Added: ${itemsToUpload.length}`;
                    statusEl.className = "status-msg status-success";
                    loadCatalog(); 

                } catch (err) {
                    statusEl.textContent = "Upload failed: " + err.message;
                    statusEl.className = "status-msg status-error";
                } finally {
                    bulkBtn.disabled = false;
                    bulkBtn.textContent = "Upload Bulk Data";
                    fileInput.value = "";
                }
            };

            reader.readAsText(file);
        });
    }
});

// Load Catalog (Client Read - Assuming Public Read is allowed)
async function loadCatalog() {
    const listEl = document.getElementById('catalog-list');
    if (!listEl) return;
    
    listEl.innerHTML = '<div class="loader"></div>';

    try {
        const querySnapshot = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ppdt_catalog'));
        
        if (querySnapshot.empty) {
            listEl.innerHTML = '<p>No images found in catalog.</p>';
            return;
        }

        let html = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            html += `
                <div style="display:flex; gap:1rem; align-items:center; background:var(--dark-bg); padding:1rem; border-radius:8px; margin-bottom:1rem; border:1px solid var(--border-color);">
                    <img src="${data.path}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;" onerror="this.src='https://placehold.co/60x60?text=Error'">
                    <div style="flex:1;">
                        <p style="font-weight:600; font-size:0.9rem;">${data.description}</p>
                        <a href="${data.originalLink}" target="_blank" style="font-size:0.8rem; color:var(--primary-blue);">Original Link</a>
                    </div>
                    <!-- Delete button removed because client-delete might also be blocked by rules. 
                         To add delete, we would need a delete API endpoint. -->
                </div>
            `;
        });
        
        listEl.innerHTML = html;

    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--error-red);">Failed to load catalog. (Read Permission Error?)</p>';
        console.error(e);
    }
}
