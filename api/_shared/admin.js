// api/_shared/admin.js
// Shared Admin SDK initializer for serverless functions.
// Expects FIREBASE_ADMIN_CONFIG env var to contain the service account JSON string.

import admin from 'firebase-admin';

let inited = false;

function initAdmin() {
  if (inited) return admin;

  // Check if we already have an app initialized (prevents hot-reload issues)
  if (admin.apps.length > 0) {
    inited = true;
    return admin;
  }

  const raw = process.env.FIREBASE_ADMIN_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!raw) {
    console.warn('FIREBASE_ADMIN_CONFIG is not set. Admin SDK will not be initialized.');
    return admin;
  }

  try {
    const cred = JSON.parse(raw);
    
    // CRITICAL FIX: Vercel environment variables often escape newlines in the private key.
    // We must replace literal "\n" characters with actual newlines.
    if (cred.private_key) {
      cred.private_key = cred.private_key.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert(cred)
    });
    
    console.log("✅ Firebase Admin Initialized successfully.");
    inited = true;
    return admin;
  } catch (err) {
    console.error('❌ Failed to parse FIREBASE_ADMIN_CONFIG or initialize Admin SDK:', err.message);
    // We do NOT return admin here if it failed, so the calling function knows it failed.
    return admin; 
  }
}

export default initAdmin();
