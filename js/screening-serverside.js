// js/screening-serverside.js
// Helper to call server endpoints with Firebase ID token in Authorization header.

import { auth } from './firebase-app.js';

export async function postWithIdToken(path, body = {}, opts = {}) {
  if (!auth || !auth.currentUser) {
    throw new Error('Not authenticated. Please sign in.');
  }
  const idToken = await auth.currentUser.getIdToken(true);
  const headers = Object.assign({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`
  }, opts.headers || {});

  const res = await fetch(path, {
    method: opts.method || 'POST',
    headers,
    body: JSON.stringify(body),
    // keep same-origin cookies etc.
    credentials: opts.credentials || 'same-origin'
  });

  return res;
}
