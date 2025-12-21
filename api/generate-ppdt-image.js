// api/generate-ppdt-image.js
import admin from './_shared/admin.js';

async function verifyIdToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

async function getUserHFKey(uid) {
  if (!uid || admin.apps.length === 0) return null;
  try {
    const snap = await admin.firestore().doc(`users/${uid}/secrets/hf`).get();
    return snap.exists ? snap.data().key : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const uid = await verifyIdToken(req);
    let hfKey = await getUserHFKey(uid);
    if (!hfKey) hfKey = process.env.HF_API_KEY;

    if (!hfKey) {
      return res.status(500).json({ error: "HF_API_KEY missing" });
    }

    // ✅ KNOWN WORKING MODEL
    const MODEL =
      "https://router.huggingface.co/models/stabilityai/stable-diffusion-2";

    const prompt =
      req.body?.prompt ||
      "Black and white realistic photograph for SSB PPDT test, one main character, ambiguous situation, outdoor scene";

    const hfRes = await fetch(MODEL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true },
      }),
    });

    if (!hfRes.ok) {
      const err = await hfRes.text();
      return res.status(502).json({ error: err });
    }

    const buffer = Buffer.from(await hfRes.arrayBuffer());
    const base64 = buffer.toString("base64");

    return res.status(200).json({
      image: base64,
      format: "image/png",
    });

  } catch (err) {
    console.error("PPDT ERROR:", err);
    return res.status(500).json({
      error: "PPDT image generation failed",
      details: err.message,
    });
  }
}
