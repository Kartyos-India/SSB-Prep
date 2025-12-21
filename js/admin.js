// js/admin.js
import { auth, db } from './firebase-app.js';
import { onAuthStateChanged } from './firebase-init.js';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from './firebase-init.js';

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- UTILS ---
function convertDriveLink(url) {
    if (!url) return null;
    let id = null;
    // Match standard drive URL patterns
    const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match1) id = match1[1];
    const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match2) id = match2[1];

    if (id) {
        // Use lh3.googleusercontent.com for direct image access
        return `https://lh3.googleusercontent.com/d/${id}`;
    }
    return url;
}

// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', async () => {
    
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

    // --- SINGLE IMAGE PREVIEW ---
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

    // --- SINGLE ADD BUTTON ---
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
                await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ppdt_catalog'), {
                    path: directUrl,
                    originalLink: rawUrl,
                    description: desc || "No description",
                    timestamp: serverTimestamp(),
                    active: true
                });
                statusEl.textContent = "Success!";
                statusEl.className = "status-msg status-success";
                linkInput.value = "";
                document.getElementById('img-desc').value = "";
                previewImg.style.display = 'none';
                loadCatalog();
            } catch (e) {
                statusEl.textContent = "Error: " + e.message;
                statusEl.className = "status-msg status-error";
            } finally {
                addBtn.disabled = false;
                addBtn.textContent = "Add Single Image";
            }
        });
    }

    // --- BULK UPLOAD HANDLER ---
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
                    
                    let successCount = 0;
                    let failCount = 0;

                    for (const item of json) {
                        // Accept 'link', 'url', or 'path' keys
                        const rawUrl = item.link || item.url || item.path;
                        const desc = item.description || item.desc || "Imported Image";

                        if (!rawUrl) {
                            failCount++;
                            continue;
                        }

                        const directUrl = convertDriveLink(rawUrl);
                        
                        try {
                            await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'ppdt_catalog'), {
                                path: directUrl,
                                originalLink: rawUrl,
                                description: desc,
                                timestamp: serverTimestamp(),
                                active: true
                            });
                            successCount++;
                        } catch (err) {
                            console.error("Upload failed for item:", item, err);
                            failCount++;
                        }
                        
                        // Update progress UI
                        statusEl.textContent = `Progress: ${successCount + failCount} / ${json.length}`;
                    }

                    statusEl.textContent = `Complete! Added: ${successCount}, Failed: ${failCount}`;
                    statusEl.className = successCount > 0 ? "status-msg status-success" : "status-msg status-error";
                    loadCatalog(); 

                } catch (err) {
                    statusEl.textContent = "Invalid JSON: " + err.message;
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
                    <img src="${data.path}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
                    <div style="flex:1;">
                        <p style="font-weight:600; font-size:0.9rem;">${data.description}</p>
                        <a href="${data.originalLink}" target="_blank" style="font-size:0.8rem; color:var(--primary-blue);">Original Link</a>
                    </div>
                    <button class="delete-btn" data-id="${doc.id}" style="background:transparent; border:1px solid var(--error-red); color:var(--error-red); padding:0.4rem 0.8rem; border-radius:4px; cursor:pointer;">Remove</button>
                </div>
            `;
        });
        
        listEl.innerHTML = html;

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if(!confirm("Remove this image?")) return;
                const id = e.target.dataset.id;
                await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'ppdt_catalog', id));
                loadCatalog();
            });
        });

    } catch (e) {
        listEl.innerHTML = '<p style="color:var(--error-red);">Failed to load catalog.</p>';
        console.error(e);
    }
}
