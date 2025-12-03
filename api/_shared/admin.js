// api/_shared/admin.js
// Shared Admin SDK initializer.
// Automatically fixes Vercel newline issues in private keys.

import admin from 'firebase-admin';

let inited = false;

function initAdmin() {
  if (inited) return admin;

  // 1. If already initialized by another function in the same instance, return it.
  if (admin.apps.length > 0) {
    inited = true;
    return admin;
  }

  // 2. Read config
  const raw = process.env.FIREBASE_ADMIN_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!raw) {
    console.error('❌ FIREBASE_ADMIN_CONFIG is missing.');
    return admin; // Return uninitialized admin (will fail later gracefully)
  }

  try {
    const cred = JSON.parse(raw);
    
    // --- CRITICAL FIX FOR VERCEL ---
    // Replace literal "\n" characters with actual newlines if they exist
    if (cred.private_key) {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }
    // -------------------------------

    admin.initializeApp({
      credential: admin.credential.cert(cred)
    });
    
    console.log("✅ Firebase Admin Initialized.");
    inited = true;
    return admin;
  } catch (err) {
    console.error('❌ Admin Init Failed:', err.message);
    return admin;
  }
}

export default initAdmin();
