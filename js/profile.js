// js/profile.js
// Handles saving, testing, and deleting a user's HuggingFace API key.
// Uses: { firebasePromise, auth, db } from ./firebase-app.js
//        Firestore helpers from ./firebase-init.js
//        postWithIdToken from ./screening-serverside.js (for server calls with ID token)

import { firebasePromise, auth, db } from './firebase-app.js';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from './firebase-init.js';
import { postWithIdToken } from './screening-serverside.js';

const inputEl = document.getElementById('hf-api-key');
const saveBtn = document.getElementById('hf-save-btn');
const testBtn = document.getElementById('hf-test-btn');
const deleteBtn = document.getElementById('hf-delete-btn');
const statusEl = document.getElementById('hf-status');

function setStatus(text, type = '') {
  statusEl.textContent = text;
  statusEl.className = 'status' + (type === 'ok' ? ' ok' : type === 'err' ? ' err' : '');
}

// Ensure DOM loaded and firebase initialized
(async function init() {
  try {
    await firebasePromise;
  } catch (err) {
    console.warn('profile: firebase init failed', err);
    setStatus('Firebase initialization failed (check console).', 'err');
    // Still continue — UI can show sign-in prompt
  }

  // Hook auth changes
  if (auth) {
    auth.onAuthStateChanged(user => {
      if (user) {
        loadKeyPlaceholder(user.uid).catch(e => {
          console.warn('profile: load placeholder failed', e);
        });
      } else {
        // not signed in
        inputEl.value = '';
        inputEl.placeholder = 'Sign in to save your HuggingFace key';
        setStatus('Sign in to manage your HuggingFace key.');
      }
    });
  }

  // Attach button handlers
  if (saveBtn) saveBtn.addEventListener('click', handleSave);
  if (testBtn) testBtn.addEventListener('click', handleTest);
  if (deleteBtn) deleteBtn.addEventListener('click', handleDelete);

  // If already signed in when page loads, try to load placeholder
  if (auth && auth.currentUser) {
    try { await loadKeyPlaceholder(auth.currentUser.uid); } catch(e) { /* ignore */ }
  }
})();

// Load placeholder and status (do NOT show raw key)
async function loadKeyPlaceholder(uid) {
  if (!uid) {
    inputEl.placeholder = 'Sign in to save your HuggingFace key';
    setStatus('Sign in to manage your HuggingFace key.');
    return;
  }
  try {
    setStatus('Checking saved key...');
    const ref = doc(db, 'users', uid, 'secrets', 'hf');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      inputEl.value = ''; // never pre-fill the real key
      inputEl.placeholder = 'Key saved (hidden). Paste to replace.';
      setStatus('Key present for this account.', 'ok');
    } else {
      inputEl.value = '';
      inputEl.placeholder = 'Paste your HuggingFace key here to save';
      setStatus('No key saved yet.');
    }
  } catch (err) {
    console.error('profile.loadKeyPlaceholder error', err);
    setStatus('Failed to check key (see console).', 'err');
  }
}

// Save key
async function handleSave(e) {
  e && e.preventDefault();
  setStatus('Saving key...');
  try {
    if (!auth || !auth.currentUser) throw new Error('Sign in required.');
    const rawKey = inputEl.value ? inputEl.value.trim() : '';
    if (!rawKey) throw new Error('Paste your HuggingFace key in the input before saving.');

    // Save to Firestore under users/{uid}/secrets/hf
    const uid = auth.currentUser.uid;
    const ref = doc(db, 'users', uid, 'secrets', 'hf');
    await setDoc(ref, { key: rawKey, updatedAt: serverTimestamp() });

    inputEl.value = ''; // clear input to avoid accidental exposure
    inputEl.placeholder = 'Key saved (hidden). Paste to replace.';
    setStatus('Saved successfully.', 'ok');
  } catch (err) {
    console.error('profile.save error', err);
    setStatus('Save failed: ' + (err.message || err), 'err');
  }
}

// Test key by invoking server endpoint with ID token
async function handleTest(e) {
  e && e.preventDefault();
  setStatus('Testing key...');
  try {
    if (!auth || !auth.currentUser) throw new Error('Sign in required to test key.');
    const uid = auth.currentUser.uid;
    const ref = doc(db, 'users', uid, 'secrets', 'hf');
    const snap = await getDoc(ref);
    if (!snap.exists() || !snap.data().key) throw new Error('No key found. Save one first.');

    // Use server endpoint with ID token - server will fetch the saved key
    // We use a small prompt that expects a JSON array with a single question to validate
    const testPrompt = 'Return a single JSON array of one question like [{"question":"Is this a test?","options":["A","B","C","D"],"answer":0}]';
    const resp = await postWithIdToken('/api/generate-oir-questions', { prompt: testPrompt });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Server test request failed: ${resp.status} ${txt}`);
    }
    // Attempt to parse response; success if 200 returned
    const json = await resp.json().catch(() => null);
    // If server returns something, treat as success (we could further validate structure)
    setStatus('Key test succeeded. Server accepted the key and returned a response.', 'ok');
  } catch (err) {
    console.error('profile.test error', err);
    setStatus('Test failed: ' + (err.message || err), 'err');
  }
}

// Delete key
async function handleDelete(e) {
  e && e.preventDefault();
  if (!confirm('Delete your saved HuggingFace key from this account? This cannot be undone.')) return;
  setStatus('Deleting key...');
  try {
    if (!auth || !auth.currentUser) throw new Error('Sign in required.');
    const uid = auth.currentUser.uid;
    const ref = doc(db, 'users', uid, 'secrets', 'hf');
    await deleteDoc(ref);
    inputEl.value = '';
    inputEl.placeholder = 'Key removed. Paste a new one to save.';
    setStatus('Key deleted.', 'ok');
  } catch (err) {
    console.error('profile.delete error', err);
    setStatus('Delete failed: ' + (err.message || err), 'err');
  }
}
