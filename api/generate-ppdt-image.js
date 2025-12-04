// api/generate-ppdt-image.js
// Uses per-user HuggingFace key stored at users/{uid}/secrets/hf
// If missing, falls back to server HF_API_KEY.
// Validates Firebase ID token from Authorization: Bearer <token>
// Supports image models that return raw binary or JSON base64.

import admin from './_shared/admin.js';

// --- Verify Firebase ID Token ---
async function verifyIdToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const match = ("" + header).match(/^Bearer (.+)$/);
  if (!match) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch (err) {
    console.warn("⚠️ PPDT: token verification failed", err.message);
    return null;
  }
}

// --- Fetch per-user HF key from Firestore ---
async function getUserHFKey(uid) {
  if (!uid) return null;
  // Safety check for uninitialized admin
  if (admin.apps.length === 0) return null;

  try {
    const docRef = admin.firestore().doc(`users/${uid}/secrets/hf`);
    const snap = await docRef.get();

    if (!snap.exists) return null;
    const data = snap.data();
    return data?.key || null;
  } catch (err) {
    console.error("🔥 Error fetching user HF key:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method must be POST" });
  }

  // 1. Identify user (optional)
  const uid = await verifyIdToken(req);

  // 2. Get user key OR fallback
  let hfKey = await getUserHFKey(uid);
  if (!hfKey) hfKey = process.env.HF_API_KEY || null;

  if (!hfKey) {
    return res.status(400).json({
      error: "No HuggingFace API key found. Add your key in the Dashboard settings."
    });
  }

  // 3. Resolve model
  // FIXED: Updated domain from api-inference.huggingface.co to router.huggingface.co
  const body = req.body || {};
  const model = body.modelEndpoint ||
    process.env.DEFAULT_PPDT_MODEL ||
    "https://router.huggingface.co/models/gsdf/Counterfeit-V2.5";

  const prompt =
    body.prompt ||
    `A single-scene black-and-white picture for PPDT test.`; // default safe prompt

  try {
    const hfResponse = await fetch(model, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true }
      })
    });

    if (!hfResponse.ok) {
      const errText = await hfResponse.text().catch(() => "");
      console.error("HF error:", hfResponse.status, errText.slice(0, 200));

      return res.status(502).json({
        error: "HuggingFace API error",
        status: hfResponse.status,
        message: errText
      });
    }

    const contentType = (hfResponse.headers.get("content-type") || "").toLowerCase();

    // 4A. Binary image → convert to base64
    if (contentType.startsWith("image/")) {
      const arrayBuffer = await hfResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return res.status(200).json({
        image: base64,
        format: contentType
      });
    }

    // 4B. JSON or text → try to parse
    const json = await hfResponse.json().catch(null);

    // Many HF models return array like: [{ generated_image: "<base64>" }]
    if (json?.[0]?.generated_image) {
      return res.status(200).json({
        image: json[0].generated_image,
        format: "image/png"
      });
    }

    // Some return array of base64 strings
    if (Array.isArray(json) && typeof json[0] === "string") {
      return res.status(200).json({
        image: json[0],
        format: "image/png"
      });
    }

    // Otherwise return raw JSON
    return res.status(200).json(json);
  } catch (err) {
    console.error("PPDT generation failed:", err);
    return res.status(500).json({ error: "Server error generating image", details: err.message });
  }
}
