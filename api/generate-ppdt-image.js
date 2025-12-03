// api/generate-ppdt-image.js
// Serverless endpoint that uses the caller's Hugging Face key (stored in Firestore)
// to call a Hugging Face inference model for image generation.
// Flow:
//  - Validate request method (POST)
//  - Verify Firebase ID token (Authorization: Bearer <idToken>)
//  - Read user's HF key from Firestore (users/{uid}/secrets/hf) via Admin SDK
//  - Fall back to process.env.HF_API_KEY if no user key present (optional)
//  - Call HF model endpoint and return either JSON or base64-encoded image { image: '<base64>', contentType: 'image/png' }

import admin from './_shared/admin.js';

// Node 18+ has global fetch; Vercel node runtimes do. If not present, fallback to node-fetch:
// import fetch from 'node-fetch';

async function verifyIdTokenFromHeader(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const m = ('' + authHeader).match(/^Bearer (.+)$/);
  if (!m) return null;
  const idToken = m[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (err) {
    console.warn('generate-ppdt-image: token verify failed', err && err.message);
    return null;
  }
}

async function getUserHFKey(uid) {
  if (!uid) return null;
  try {
    const docRef = admin.firestore().doc(`users/${uid}/secrets/hf`);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data || !data.key) return null;
    return data.key;
  } catch (err) {
    console.error('generate-ppdt-image: failed to read user HF key', err && err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body safely (Vercel provides parsed req.body for JSON)
  const body = req.body || {};
  const modelEndpoint = body.modelEndpoint || process.env.DEFAULT_IMAGE_MODEL_ENDPOINT || 'https://api-inference.huggingface.co/models/gsdf/Counterfeit-V2.5';
  const prompt = body.prompt || body.text || 'A simple black-and-white line-drawing for a PPDT test scene';
  const uid = await verifyIdTokenFromHeader(req);
  let hfKey = await getUserHFKey(uid);

  if (!hfKey) {
    hfKey = process.env.HF_API_KEY || null; // optional fallback
  }

  if (!hfKey) {
    return res.status(400).json({ error: 'No Hugging Face API key configured for this user. Add it in your profile.' });
  }

  try {
    // Build HF request body. For many image models HF inference accepts { inputs: prompt, options: { wait_for_model: true } }
    // Some models require different payloads; adapt as needed for your chosen model.
    const payload = {
      inputs: prompt,
      options: { wait_for_model: true }
    };

    const hfRes = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!hfRes.ok) {
      const txt = await hfRes.text().catch(() => '');
      console.error('generate-ppdt-image: HF responded with error', hfRes.status, txt && txt.substring ? txt.substring(0, 200) : txt);
      return res.status(502).json({ error: 'Hugging Face API error', status: hfRes.status, message: txt });
    }

    const contentType = (hfRes.headers.get('content-type') || '').toLowerCase();

    if (contentType.startsWith('image/')) {
      // Binary image: return base64
      const arr = await hfRes.arrayBuffer();
      const base64 = Buffer.from(arr).toString('base64');
      return res.status(200).json({ image: base64, contentType });
    }

    // Some HF endpoints return JSON (e.g., array of objects or base64 inside JSON)
    const json = await hfRes.json();
    return res.status(200).json(json);
  } catch (err) {
    console.error('generate-ppdt-image: unexpected error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
}
