// api/generate-oir-questions.js
// Serverless endpoint to generate OIR questions using a Hugging Face text model.
// Uses per-user HF key stored at users/{uid}/secrets/hf (Admin SDK).
// Returns JSON array: [{ question: string, options: [a,b,c,d], answer: indexOrValue }, ...]
// Fallback: returns raw text if parsing fails.

import admin from './_shared/admin.js';

// --- Helpers: verify ID token + fetch user HF key ---
async function verifyIdToken(req) {
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
  // first try direct parse
  try {
    return JSON.parse(text);
  } catch (_) {}

  // attempt to find a JSON array/object substring
  const arrMatch = text.match(/(\[.*\])/s);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[1]); } catch (_) {}
  }
  const objMatch = text.match(/(\{.*\})/s);
  if (objMatch) {
    try { return JSON.parse(objMatch[1]); } catch (_) {}
  }

  return null;
}

// --- Main handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const body = req.body || {};

  // 1) Identify caller (optional)
  const uid = await verifyIdToken(req);

  // 2) Resolve HF key (user -> fallback)
  let hfKey = await getUserHFKey(uid);
  if (!hfKey) hfKey = process.env.HF_API_KEY || null;

  if (!hfKey) {
    return res.status(400).json({ error: 'No Hugging Face API key configured. Add it in Profile.' });
  }

  // 3) Choose model endpoint
  const modelEndpoint = body.modelEndpoint || process.env.DEFAULT_TEXT_MODEL_ENDPOINT || 'https://api-inference.huggingface.co/models/google/flan-t5-large';

  // 4) Compose prompt (encourage strict JSON output)
  const userPrompt = typeof body.prompt === 'string' && body.prompt.trim().length > 0
    ? body.prompt.trim()
    : `Generate 30 Officer Intelligence Rating (OIR) style multiple-choice reasoning questions.
Each question must be returned as a JSON object with the following keys:
- "question": a single concise question sentence.
- "options": an array of exactly 4 answer strings (A, B, C, D).
- "answer": the index (0-3) of the correct option or the exact correct answer string.

Return the result as a JSON array only. Example output:
[
  {"question":"...","options":["A","B","C","D"],"answer":2},
  ...
]`;

  // 5) Call Hugging Face inference API
  try {
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
      // return provider error
      const errText = await hfRes.text().catch(() => '');
      console.error('OIR: HF API error', hfRes.status, errText && errText.slice ? errText.slice(0, 300) : errText);
      return res.status(502).json({ error: 'HuggingFace API error', status: hfRes.status, message: errText });
    }

    const contentType = (hfRes.headers.get('content-type') || '').toLowerCase();

    // If HF returned JSON directly (some models do)
    if (contentType.includes('application/json')) {
      const json = await hfRes.json().catch(null);
      // If it's already an array of Qs, return them
      if (Array.isArray(json)) return res.status(200).json(json);
      // if json.result or json[0].generated_text etc, try to extract text
      if (Array.isArray(json?.outputs) && json.outputs[0]?.generated_text) {
        const extracted = extractJsonLike(json.outputs[0].generated_text);
        if (extracted) return res.status(200).json(extracted);
      }
      // fallback — try to extract JSON from any string fields
      const textCandidates = [];
      const flatten = obj => {
        if (!obj) return;
        if (typeof obj === 'string') textCandidates.push(obj);
        else if (Array.isArray(obj)) obj.forEach(flatten);
        else if (typeof obj === 'object') Object.values(obj).forEach(flatten);
      };
      flatten(json);
      for (const t of textCandidates) {
        const parsed = extractJsonLike(t);
        if (parsed) return res.status(200).json(parsed);
      }
      // otherwise return the raw JSON
      return res.status(200).json(json);
    }

    // If HF returned text (common for text models)
    const text = await hfRes.text().catch(() => '');
    // Try to parse JSON embedded in text
    const parsed = extractJsonLike(text);
    if (parsed) {
      return res.status(200).json(parsed);
    }

    // Could not parse—return raw text for the client to inspect
    return res.status(200).json({ raw: text });

  } catch (err) {
    console.error('OIR: unexpected error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error while generating questions' });
  }
}
