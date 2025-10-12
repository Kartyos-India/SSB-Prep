import { Buffer } from 'buffer';

async function queryGroqText(prompt, apiKey) {
  const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.1-8b-instant", 
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

export default async function handler(request, response) {
  const { type, prompt, data } = request.body;
  
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const FIREBASE_CONFIG = process.env.__firebase_config;

  try {
    switch (type) {
      case 'get-config':
        if (!FIREBASE_CONFIG) {
          return response.status(500).json({ error: 'Firebase configuration is not set on the server.' });
        }
        try {
            return response.status(200).json(JSON.parse(FIREBASE_CONFIG));
        } catch (e) {
            return response.status(500).json({ error: 'Server-side Firebase config is not valid JSON.' });
        }
      // Add other cases for 'wat', 'srt', 'feedback', 'image' here
      default:
        return response.status(400).json({ error: 'Invalid request type' });
    }
  } catch (error) {
    console.error("Server-side error:", error);
    return response.status(500).json({ error: `An internal server error occurred: ${error.message}` });
  }
}
