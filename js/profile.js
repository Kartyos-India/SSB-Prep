// js/profile.js
// Client-side profile UI code to save a user's Hugging Face API key to Firestore
// Assumes firebase-app.js exports { firebasePromise, auth, db }
// and firebase-init.js exports Firestore helpers: doc, setDoc, getDoc, serverTimestamp

import { firebasePromise, auth, db } from './firebase-app.js';
import { doc, setDoc, getDoc, serverTimestamp } from './firebase-init.js';

async function initProfile() {
  try {
    await firebasePromise;
  } catch (err) {
    console.warn('profile: Firebase init failed; UI may be degraded', err && err.message);
  }

  if (!auth) {
    console.warn('profile: auth not available yet.');
    return;
  }

  // Wait for auth state if not signed in yet
  if (!auth.currentUser) {
    const unsubs = [];
    const waitForLogin = new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(user => {
        if (user) {
          unsub();
          resolve(user);
        }
      });
      unsubs.push(unsub);
      // optional timeout fallback:
      setTimeout(() => resolve(null), 5000);
    });
    const user = await waitForLogin;
    if (!user) {
      // show message to sign in
      const status = document.getElementById('hf-status');
      if (status) status.textContent = 'Please sign in to save your Hugging Face key.';
      return;
    }
  }

  const user = auth.currentUser;
  if (!user) {
    const status = document.getElementById('hf-status');
    if (status) status.textContent = 'Sign in required.';
    return;
  }

  const uid = user.uid;
  const input = document.getElementById('hf-api-key');
  const saveBtn = document.getElementById('hf-save-btn');
  const status = document.getElementById('hf-status');

  // Load existing (if any)
  try {
    const docRef = doc(db, 'users', uid, 'secrets', 'hf');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      // For security: do NOT pre-fill the real key in the input.
      // Optionally display masked placeholder or ask user to paste to replace.
      input.placeholder = 'Key saved (hidden). Paste to replace.';
      // You may indicate when it was updated:
      const d = snap.data();
      if (d && d.updatedAt && status) {
        try {
          const ts = d.updatedAt.toDate ? d.updatedAt.toDate() : new Date(d.updatedAt);
          status.textContent = `Key last updated: ${ts.toLocaleString()}`;
        } catch (e) {
          // ignore
        }
      }
    } else {
      if (status) status.textContent = 'No key saved yet.';
    }
  } catch (err) {
    console.warn('profile: failed to load HF key document', err && err.message);
  }

  saveBtn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const rawKey = input.value ? input.value.trim() : '';
    if (!rawKey) {
      status.textContent = 'Please paste your Hugging Face API key (hf_...) to save.';
      return;
    }

    status.textContent = 'Saving...';
    try {
      const docRef = doc(db, 'users', uid, 'secrets', 'hf');
      await setDoc(docRef, { key: rawKey, updatedAt: serverTimestamp() });
      input.value = ''; // clear input after save
      status.textContent = 'Saved successfully.';
    } catch (err) {
      console.error('profile: failed to save HF key', err && err.message);
      status.textContent = 'Save failed. Check console.';
    }
  });
}

// auto-run when DOM ready
if (document.readyState !== 'loading') {
  initProfile().catch(console.error);
} else {
  document.addEventListener('DOMContentLoaded', () => initProfile().catch(console.error));
}
