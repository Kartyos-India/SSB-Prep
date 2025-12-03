// api/generate-oir-questions.js
// Serverless endpoint that generates OIR questions via a Hugging Face text model using
// the caller's HF key stored under users/{uid}/secrets/hf.
//
// Similar flow to the image endpoint: verify id token, read user key, call HF, return JSON/text.

import admin from './_shared/admin.js';

// Helpers (same as in generate-ppdt-image.js)
async function verifyIdTokenFromHeader(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const m = ('' + authHeader).match(/^Bearer (.+)$/);
  if (!m) return null;
  const idToken = m[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (err) {
    console.warn('generate-oir-questions: token verify failed', err && err.message);
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
    console.error('generate-oir-questions: failed to read user HF key', err && err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  // Allow caller to specify a modelEndpoint in body; otherwise use env default or a safe default.
  const modelEndpoint = body.modelEndpoint || process.env.DEFAULT_TEXT_MODEL_ENDPOINT || 'https://api-inference.huggingface.co/models/google/flan-t5-large';
  // Build prompt: either caller provided or construct based on payload
  const prompt = body.prompt || "Generate 5 OIR-style multiple-choice reasoning questions with 4 options each. Return JSON array with fields: question, options (array), answer (index).";

  const uid = await verifyIdTokenFromHeader(req);
  let hfKey = await getUserHFKey(uid);
  if (!hfKey) hfKey = process.env.HF_API_KEY || null;

  if (!hfKey) {
    return res.status(400).json({ error: 'No Hugging Face API key configured for this user. Add it in your profile.' });
  }

  try {
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
      console.error('generate-oir-questions: HF responded with error', hfRes.status, txt && txt.substring ? txt.substring(0, 200) : txt);
      return res.status(502).json({ error: 'Hugging Face API error', status: hfRes.status, message: txt });
    }

    const contentType = (hfRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json') || contentType.includes('text')) {
      const json = await hfRes.json().catch(async () => {
        // If not parseable as JSON, return text
        const txt = await hfRes.text().catch(() => '');
        return { text: txt };
      });
      return res.status(200).json(json);
    }

    // If HF returns something else, try to return the body as JSON or text
    const txt = await hfRes.text().catch(() => '');
    return res.status(200).json({ raw: txt });
  } catch (err) {
    console.error('generate-oir-questions: unexpected error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error' });
  }
}
