// api/generate-oir-questions.js
import admin from './_shared/admin.js';

async function verifyIdToken(req) {
  if (admin.apps.length === 0) return null;
  const header = req.headers.authorization || req.headers.Authorization || '';
  const m = ('' + header).match(/^Bearer (.+)$/);
  if (!m) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(m[1]);
    return decoded.uid;
  } catch (err) {
    return null;
  }
}

async function getUserHFKey(uid) {
  if (!uid || admin.apps.length === 0) return null;
  try {
    const docRef = admin.firestore().doc(`users/${uid}/secrets/hf`);
    const snap = await docRef.get();
    return snap.exists ? snap.data()?.key : null;
  } catch (err) {
    return null;
  }
}

function extractJsonLike(text) {
  try { return JSON.parse(text); } catch (_) {}
  const arrMatch = text.match(/(\[.*\])/s);
  if (arrMatch) { try { return JSON.parse(arrMatch[1]); } catch (_) {} }
  const objMatch = text.match(/(\{.*\})/s);
  if (objMatch) { try { return JSON.parse(objMatch[1]); } catch (_) {} }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const uid = await verifyIdToken(req);
    let hfKey = await getUserHFKey(uid);
    if (!hfKey) hfKey = process.env.HF_API_KEY;

    if (!hfKey) {
      return res.status(400).json({ error: 'No Hugging Face API key configured.' });
    }

    // FIXED: Updated to router.huggingface.co
    const modelEndpoint = body.modelEndpoint || 
      'https://router.huggingface.co/models/google/flan-t5-large';

    const userPrompt = body.prompt || `Generate 30 Officer Intelligence Rating (OIR) style multiple-choice questions...`;

    const hfRes = await fetch(modelEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${hfKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: userPrompt, options: { wait_for_model: true } })
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      return res.status(502).json({ error: 'HuggingFace API error', message: errText });
    }

    const contentType = (hfRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const json = await hfRes.json();
      return res.status(200).json(json);
    }

    const text = await hfRes.text();
    const parsed = extractJsonLike(text);
    return res.status(200).json(parsed || { raw: text });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
