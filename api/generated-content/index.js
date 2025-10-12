import { Buffer } from 'buffer';

// Helper for Groq API (for all text-based tasks)
async function queryGroqText(prompt, apiKey) {
  const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.1-8b-instant",
    temperature: 0.7,
    response_format: { type: "json_object" },
  };
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Groq API Error: ${errorBody.error.message}`);
  }
  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}

// Helper for Stability AI API (for images)
async function queryStabilityAIImage(data, apiKey) {
    const apiUrl = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";
    const { prompt } = data;
    const payload = {
        text_prompts: [
            { text: prompt, weight: 1.0 },
            { text: "blurry, low quality, colored, modern, digital, photograph, watermark, signature", weight: -1.0 }
        ],
        cfg_scale: 7,
        height: 768,
        width: 1344,
        samples: 1,
        steps: 30,
        sampler: "K_DPM_2_ANCESTRAL",
    };
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Accept": "image/png" },
        body: JSON.stringify(payload),
    });
    return response;
}

// --- Main Serverless Function Handler ---
export default async function handler(request, response) {
  const { type, prompt, data } = request.body;
  const STABILITY_AI_API_KEY = process.env.STABILITY_AI_API_KEY;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const FIREBASE_CONFIG = process.env.__firebase_config;

  try {
    switch (type) {
      case 'get-config':
        if (!FIREBASE_CONFIG) {
          return response.status(500).json({ error: 'Firebase configuration is not set on the server.' });
        }
        try {
            const config = JSON.parse(FIREBASE_CONFIG);
            return response.status(200).json(config);
        } catch (error) {
            return response.status(500).json({ error: 'Server-side Firebase configuration is not valid JSON.' });
        }
      case 'image':
        // Image generation logic...
        break;
      case 'wat':
        // WAT logic...
        break;
      // Add other cases as needed
      default:
        return response.status(400).json({ error: 'Invalid request type' });
    }
  } catch (error) {
    console.error("Server-side error:", error);
    return response.status(500).json({ error: `An internal server error occurred: ${error.message}` });
  }
}

