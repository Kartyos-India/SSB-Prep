// api/_shared/admin.js
// Shared Admin SDK initializer.
// Automatically fixes Vercel newline issues in private keys.

import admin from 'firebase-admin';

let inited = false;

function initAdmin() {
  if (inited) return admin;

  // 1. If already initialized, use existing instance
  if (admin.apps.length > 0) {
    inited = true;
    return admin;
  }

  // 2. Read config from Environment Variable
  const raw = process.env.FIREBASE_ADMIN_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!raw) {
    console.error('❌ FIREBASE_ADMIN_CONFIG is missing.');
    return admin; 
  }

  try {
    const cred = JSON.parse(raw);
    
    // --- CRITICAL FIX FOR VERCEL ---
    // This block fixes the "502" error by repairing the private key formatting
    if (cred.private_key) {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }
    // -------------------------------

    admin.initializeApp({
      credential: admin.credential.cert(cred)
    });
    
    console.log("✅ Firebase Admin Initialized successfully.");
    inited = true;
    return admin;
  } catch (err) {
    console.error('❌ Admin Init Failed:', err.message);
    return admin;
  }
}

export default initAdmin();
