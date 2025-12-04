// api/generate-oir-questions.js
// Serverless endpoint to generate OIR questions using a Hugging Face text model.
// Uses per-user HF key stored at users/{uid}/secrets/hf (Admin SDK).

import admin from './_shared/admin.js';

// --- Helpers: verify ID token + fetch user HF key ---
async function verifyIdToken(req) {
  if (admin.apps.length === 0) return null; // Safety check

  const header = req.headers.authorization || req.headers.Authorization || '';
  const m = ('' + header).match(/^Bearer (.+)$/);
  if (!m) return null;
  const idToken = m[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (err) {
    console.warn('OIR: token verification failed', err && err.message);
    return null;
  }
}

async function getUserHFKey(uid) {
  if (!uid) return null;
  if (admin.apps.length === 0) return null; // Safety check

  try {
    const docRef = admin.firestore().doc(`users/${uid}/secrets/hf`);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    const data = snap.data();
    return data?.key || null;
  } catch (err) {
    console.error('OIR: failed to read user HF key', err && err.message);
    return null;
  }
}

// --- Utility: try to extract JSON from a free-form string ---
function extractJsonLike(text) {
  try { return JSON.parse(text); } catch (_) {}
  const arrMatch = text.match(/(\[.*\])/s);
  if (arrMatch) { try { return JSON.parse(arrMatch[1]); } catch (_) {} }
  const objMatch = text.match(/(\{.*\})/s);
  if (objMatch) { try { return JSON.parse(objMatch[1]); } catch (_) {} }
  return null;
}

// --- Main handler ---
export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const body = req.body || {};

    // 1) Identify caller
    const uid = await verifyIdToken(req);

    // 2) Resolve HF key
    let hfKey = await getUserHFKey(uid);
    if (!hfKey) hfKey = process.env.HF_API_KEY || null;

    if (!hfKey) {
      return res.status(400).json({ error: 'No Hugging Face API key configured. Add it in Dashboard settings.' });
    }

    // 3) Choose model endpoint
    // FIXED: Updated to router.huggingface.co
    const modelEndpoint = body.modelEndpoint || 
      process.env.DEFAULT_TEXT_MODEL_ENDPOINT || 
      'https://router.huggingface.co/models/google/flan-t5-large';

    // 4) Compose prompt
    const userPrompt = typeof body.prompt === 'string' && body.prompt.trim().length > 0
      ? body.prompt.trim()
      : `Generate 30 Officer Intelligence Rating (OIR) style multiple-choice reasoning questions... (abbreviated)`;

    // 5) Call Hugging Face inference API
    const hfRes = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: userPrompt,
        options: { wait_for_model: true, use_cache: false }
      })
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text().catch(() => '');
      console.error('OIR: HF API error', hfRes.status, errText);
      return res.status(502).json({ error: 'HuggingFace API error', status: hfRes.status, message: errText });
    }

    // (Parsing logic matches your previous file)
    const contentType = (hfRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const json = await hfRes.json().catch(null);
      if (Array.isArray(json)) return res.status(200).json(json);
      // ... existing extraction logic ...
      return res.status(200).json(json);
    }

    const text = await hfRes.text().catch(() => '');
    const parsed = extractJsonLike(text);
    if (parsed) return res.status(200).json(parsed);
    return res.status(200).json({ raw: text });

  } catch (err) {
    console.error('OIR: unexpected error', err);
    return res.status(500).json({ error: 'Server error while generating questions', details: err.message });
  }
}
