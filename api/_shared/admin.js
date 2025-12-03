// api/_shared/admin.js
// Shared Admin SDK initializer for serverless functions.
// Expects FIREBASE_ADMIN_CONFIG env var to contain the service account JSON string.
//
// Note: Do NOT log secrets or the contents of the env var anywhere.

import admin from 'firebase-admin';

let inited = false;

function initAdmin() {
  if (inited) return admin;
  const raw = process.env.FIREBASE_ADMIN_CONFIG || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw) {
    console.warn('FIREBASE_ADMIN_CONFIG is not set. Admin SDK will not be initialized.');
    // We still export admin (calls will fail if used).
    inited = true;
    return admin;
  }

  try {
    const cred = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(cred)
    });
    inited = true;
    return admin;
  } catch (err) {
    console.error('Failed to parse FIREBASE_ADMIN_CONFIG (admin.js).', err);
    inited = true;
    return admin;
  }
}

export default initAdmin();
