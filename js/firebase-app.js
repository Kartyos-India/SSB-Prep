// js/firebase-app.js
// This new file will be the single source of truth for Firebase initialization.

import { initializeApp } from './firebase-init.js';
import { getAuth } from './firebase-init.js';
import { getFirestore } from './firebase-init.js';

let app, auth, db;

// This async function fetches the config and initializes Firebase ONCE.
async function initializeFirebase() {
    try {
        const response = await fetch('/api/get-firebase-config');
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        const firebaseConfig = await response.json();
        if (!firebaseConfig.apiKey) {
            throw new Error("Invalid Firebase config received");
        }
        
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        console.log("✅ Firebase initialized successfully from firebase-app.js");

    } catch (error) {
        console.error("❌ Firebase Initialization Failed in firebase-app.js:", error);
        // We throw the error so other modules know initialization failed.
        throw error;
    }
}

// We only want to run initialization once.
const firebasePromise = initializeFirebase();

// We export the initialized services. Other scripts will wait for the promise to resolve.
export { firebasePromise, auth, db };
