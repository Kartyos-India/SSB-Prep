import { Buffer } from 'buffer';

// --- Main Serverless Function Handler ---
export default async function handler(request, response) {
  console.log("Backend function /api/generate-content STARTED.");

  // Set CORS headers
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (request.method === 'OPTIONS') {
    console.log("Responding to OPTIONS preflight request.");
    response.status(200).end();
    return;
  }

  try {
    const { type } = request.body;
    console.log(`Request received for type: '${type}'`);

    const FIREBASE_CONFIG = process.env.__firebase_config;

    if (type === 'get-config') {
      if (!FIREBASE_CONFIG) {
        console.error("CRITICAL ERROR: '__firebase_config' environment variable not found on server.");
        return response.status(500).json({ error: 'Firebase configuration environment variable is not set on the server.' });
      }
      
      console.log("Found FIREBASE_CONFIG variable. Attempting to parse...");
      // Log only the first few characters for security
      console.log("Variable starts with:", FIREBASE_CONFIG.substring(0, 30) + "...");

      try {
        const config = JSON.parse(FIREBASE_CONFIG);
        console.log("Successfully parsed Firebase config. Sending to client.");
        return response.status(200).json(config);
      } catch (error) {
        console.error("CRITICAL ERROR: Failed to parse FIREBASE_CONFIG. It is not valid JSON.", error.message);
        return response.status(500).json({ error: 'Server-side Firebase configuration is malformed. Make sure it is a single line with no line breaks.' });
      }
    }

    // --- Placeholder for other API types ---
    console.warn(`Request type '${type}' is not a valid API endpoint.`);
    return response.status(400).json({ error: `Invalid request type: ${type}` });

  } catch (error) {
      console.error("An unexpected error occurred in the handler:", error);
      return response.status(500).json({ error: 'An internal server error occurred.' });
  }
}

