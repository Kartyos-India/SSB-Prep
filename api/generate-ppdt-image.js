// api/generate-ppdt-image.js
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
  if (admin.apps.length === 0) return null; 

  try {
    const docRef = admin.firestore().doc(`users/${uid}/secrets/hf`);
    const snap = await docRef.get();
    if (!snap.exists) return null;
    return snap.data()?.key || null;
  } catch (err) {
    console.error("🔥 Error fetching user HF key:", err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method must be POST" });

  try {
    // 1. Identify user (optional)
    const uid = await verifyIdToken(req);

    // 2. Get user key OR fallback to Server Env Var (Your Request)
    let hfKey = await getUserHFKey(uid);
    if (!hfKey) hfKey = process.env.HF_API_KEY;

    if (!hfKey) {
      return res.status(500).json({
        error: "Server Configuration Error: No HF_API_KEY found in Vercel environment variables."
      });
    }

    // 3. Resolve model 
    // FIX: Switched to 'runwayml/stable-diffusion-v1-5' which is reliable on the router
    const body = req.body || {};
    const model = body.modelEndpoint ||
      process.env.DEFAULT_PPDT_MODEL ||
      "https://router.huggingface.co/models/runwayml/stable-diffusion-v1-5"; 

    const prompt = body.prompt || `black and white sketch of a scene, realistic, high quality, 4k`;

    // 4. Call Hugging Face
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
      console.error("HF error:", hfResponse.status, errText);
      return res.status(502).json({
        error: "HuggingFace API error",
        status: hfResponse.status,
        message: errText
      });
    }

    const contentType = (hfResponse.headers.get("content-type") || "").toLowerCase();

    // 5A. Binary image → convert to base64
    if (contentType.startsWith("image/")) {
      const arrayBuffer = await hfResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return res.status(200).json({ image: base64, format: contentType });
    }

    // 5B. JSON or text → try to parse
    const json = await hfResponse.json().catch(null);
    
    // Handle array response format
    if (Array.isArray(json) && typeof json[0] === "string") {
         return res.status(200).json({ image: json[0], format: "image/png" });
    }
    if (json?.[0]?.generated_image) {
      return res.status(200).json({ image: json[0].generated_image, format: "image/png" });
    }

    return res.status(200).json(json);

  } catch (err) {
    console.error("PPDT generation failed:", err);
    return res.status(500).json({ error: "Server error generating image", details: err.message });
  }
}
