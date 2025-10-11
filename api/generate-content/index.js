// This versatile serverless function now handles all AI requests AND
// securely provides the Firebase configuration to the application.

// --- Helper Functions to call APIs ---

// Helper for Groq API (for all text-based tasks)
async function queryGroqText(prompt, apiKey) {
  const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
  
  const payload = {
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.1-8b-instant", // Using a current, supported, and fast model
    temperature: 0.7,
    // This is the key for reliable lists! It forces the model to output valid JSON.
    response_format: { type: "json_object" }, 
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(`Groq API Error: ${errorBody.error.message}`);
  }

  const result = await response.json();
  // The response is a stringified JSON within the content, so we parse it.
  return JSON.parse(result.choices[0].message.content);
}

// Helper for Stability AI API (for images) - REPLACING HUGGING FACE LOGIC
// REPLACE THE EXISTING queryStabilityAIImage FUNCTION WITH THIS:

// REPLACE IT WITH THIS CORRECTED VERSION:
async function queryStabilityAIImage(data, apiKey) {
    // Using a common SDXL endpoint
    const apiUrl = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";
    const { prompt } = data;

    const payload = {
        text_prompts: [
            { text: prompt, weight: 1.0 },
            // Negative prompt to enforce the black & white, non-photographic SSB style
            { text: "blurry, low quality, colored, modern, digital, photograph, watermark, signature", weight: -1.0 } 
        ],
        cfg_scale: 7,
        // FIX: Using the allowed landscape dimension for SDXL, listed as 1152x768
        height: 768,   
        width: 1344,  
        samples: 1,
        steps: 30, 
        sampler: "K_DPM_2_ANCESTRAL", 
    };
    
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${apiKey}`, 
            "Content-Type": "application/json",
            "Accept": "image/png", // Request the image buffer directly
        },
        body: JSON.stringify(payload),
    });

    return response;
}
    
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: { 
            "Authorization": `Bearer ${apiKey}`, 
            "Content-Type": "application/json",
            "Accept": "image/png", // Request the image buffer directly
        },
        body: JSON.stringify(payload),
    });

    return response;
}


// --- Main Serverless Function Handler ---

export default async function handler(request, response) {
  const { type, prompt, data } = request.body;
  
  // NEW KEY: STABILITY_AI_API_KEY replaces HF_API_KEY
  const STABILITY_AI_API_KEY = process.env.STABILITY_AI_API_KEY;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const FIREBASE_CONFIG = process.env.__firebase_config;

  try {
    switch (type) {

      // NEW CASE: Securely provide the Firebase config to the client
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

      // --- IMAGE GENERATION (Now using Stability AI) ---
      case 'image':
        if (!STABILITY_AI_API_KEY) return response.status(500).json({ error: 'Stability AI API key not configured. (Please use STABILITY_AI_API_KEY)' });
        if (!prompt) return response.status(400).json({ error: 'Prompt is required for image generation' });
        
        // Use the new Stability AI helper
        const aiImageResponse = await queryStabilityAIImage({ prompt }, STABILITY_AI_API_KEY);

        if (!aiImageResponse.ok) {
            const errorText = await aiImageResponse.text();
            // Try to parse the error body from the API
            let errorMessage = 'Unknown API Error';
            try {
                 const errorBody = JSON.parse(errorText);
                 errorMessage = errorBody.message || errorBody.errors[0] || errorMessage;
            } catch {
                 errorMessage = errorText;
            }
            return response.status(aiImageResponse.status).json({ error: `Stability AI Error: ${errorMessage}` });
        }
        
        // Stability AI returns the image buffer directly
        const imageBuffer = Buffer.from(await aiImageResponse.arrayBuffer());
        response.setHeader('Content-Type', 'image/png');
        return response.status(200).send(imageBuffer);

      case 'wat':
        if (!GROQ_API_KEY) return response.status(500).json({ error: 'Groq API key not configured.' });
        const watPrompt = "Generate a list of 60 diverse, single, neutral to slightly positive English words for a Word Association Test. Cover themes like relationships, work, emotions, and abstract concepts. CRITICAL: Return a single JSON object with one key: 'words', which holds a JSON array of 60 strings.";
        const watJson = await queryGroqText(watPrompt, GROQ_API_KEY);
        return response.status(200).json(watJson.words);

      case 'srt':
        if (!GROQ_API_KEY) return response.status(500).json({ error: 'Groq API key not configured.' });
        const srtPrompt = "Generate a list of 60 realistic situations for a Situation Reaction Test (SRT) for military officer selection. Each situation must start with 'He...' or 'She...' and end with '...He/She would...'. CRITICAL: Return a single JSON object with one key: 'situations', which holds a JSON array of 60 strings.";
        const srtJson = await queryGroqText(srtPrompt, GROQ_API_KEY);
        return response.status(200).json(srtJson.situations);

      case 'feedback':
        if (!GROQ_API_KEY) return response.status(500).json({ error: 'Groq API key not configured.' });
        if (!data || !data.testType || !data.responses) return response.status(400).json({ error: 'Test data is required for feedback' });
        
        const formattedResponses = data.responses.map(r => `Prompt: "${r.prompt}"\nResponse: "${r.response || 'No response.'}"`).join('\n\n');
        const feedbackPrompt = `You are an expert SSB psychologist. Analyze these ${data.testType} responses based on Officer Like Qualities (OLQs). Provide constructive feedback. Structure your response as a single JSON object with one key: "feedback", where the value is a markdown formatted string containing three sections: "### Overall Analysis", "### Positive Traits Revealed", and "### Areas for Improvement". Be encouraging and professional.\n\nHere are the user's responses:\n\n${formattedResponses}`;
        
        const feedbackJson = await queryGroqText(feedbackPrompt, GROQ_API_KEY);
        return response.status(200).json({ feedback: feedbackJson.feedback });

      default:
        return response.status(400).json({ error: 'Invalid request type' });
    }
  } catch (error) {
    console.error("Server-side error:", error);
    return response.status(500).json({ error: `An internal server error occurred: ${error.message}` });
  }
}


