// api/get-firebase-config.js
export default async function handler(request, response) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  try {
    const firebaseConfigString = process.env.__firebase_config;

    if (!firebaseConfigString) {
      console.error("Vercel environment variable '__firebase_config' not found.");
      return response.status(500).json({ 
        error: "Server configuration error: Firebase environment variable not found."
      });
    }
    
    // Attempt to parse the JSON string
    const config = JSON.parse(firebaseConfigString);
    
    // Validate that the parsed object has the necessary keys
    if (!config.apiKey || !config.authDomain || !config.projectId) {
      console.error("Firebase config is missing required fields (apiKey, authDomain, projectId).");
      return response.status(500).json({ error: "Invalid Firebase configuration object." });
    }
    
    // If everything is successful, send the config
    return response.status(200).json(config);
    
  } catch (error) {
    // This block will catch errors from JSON.parse() if the string is malformed
    console.error("Failed to parse Firebase config JSON:", error.message);
    return response.status(500).json({ 
      error: 'Failed to parse Firebase configuration. Check the format of the environment variable.',
      details: error.message
    });
  }
}
