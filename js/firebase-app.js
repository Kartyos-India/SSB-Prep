// js/firebase-app.js
// This new file is the single source of truth for Firebase initialization.

import { initializeApp } from './firebase-init.js';
import { getAuth } from './firebase-init.js';
import { getFirestore } from './firebase-init.js';

let app, auth, db;
let firebasePromise;

// This function is called to initialize Firebase.
// It ensures initialization only happens once.
async function initializeFirebase() {
    if (firebasePromise) return firebasePromise;

    firebasePromise = new Promise(async (resolve, reject) => {
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
            resolve({ app, auth, db });

        } catch (error) {
            console.error("❌ Firebase Initialization Failed in firebase-app.js:", error);
            reject(error);
        }
    });
    return firebasePromise;
}

// Immediately call initialize and export the promise and services.
// Other scripts will await the promise to ensure Firebase is ready.
export const firebaseReady = initializeFirebase();
export { auth, db };

