// js/firebase-app.js  — REPLACEMENT
// Centralized Firebase web initialization.
// Exports:
//  - firebasePromise: Promise that resolves when initialization completes
//  - firebaseReady: alias for firebasePromise
//  - auth, db: live bindings (initially null, assigned after init)

import { initializeApp as webInitializeApp, getAuth as webGetAuth, getFirestore as webGetFirestore } from './firebase-init.js';

export let auth = null;
export let db = null;

let _initPromise = null;

async function initializeFirebase() {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Fetch client firebase config from serverless function.
      const res = await fetch('/api/get-firebase-config');
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`get-firebase-config failed: ${res.status} ${text}`);
      }

      const firebaseConfig = await res.json();
      if (!firebaseConfig || !firebaseConfig.apiKey) {
        throw new Error('Invalid Firebase config received from /api/get-firebase-config');
      }

      // Initialize the web SDK using the helper from firebase-init.js
      const app = webInitializeApp(firebaseConfig);
      auth = webGetAuth(app);
      db = webGetFirestore(app);

      console.log('✅ Firebase web SDK initialized (firebase-app.js).');
      return { app, auth, db };
    } catch (err) {
      // Keep the promise rejected for callers to handle
      console.error('❌ Firebase initialization error (firebase-app.js):', err);
      throw err;
    }
  })();

  return _initPromise;
}

export const firebasePromise = initializeFirebase();
export const firebaseReady = firebasePromise; // alias for backward compat
