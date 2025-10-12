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
    console.log("Reading Firebase config from environment...");
    
    const firebaseConfig = process.env.__firebase_config;

    if (!firebaseConfig) {
      console.error("Firebase config environment variable not found");
      return response.status(500).json({ 
        error: 'Firebase configuration not found in environment variables',
        availableVars: Object.keys(process.env)
      });
    }

    console.log("Found Firebase config:", firebaseConfig.substring(0, 50) + "...");
    
    // Clean the config string (remove any semicolons or extra spaces)
    const cleanedConfig = firebaseConfig.replace(/;\s*$/, '').trim();
    
    // Parse the JSON string from environment variable
    const config = JSON.parse(cleanedConfig);
    
    // Validate required fields
    if (!config.apiKey || !config.authDomain || !config.projectId) {
      throw new Error("Missing required Firebase config fields");
    }
    
    console.log("Successfully parsed Firebase config");
    response.status(200).json(config);
    
  } catch (error) {
    console.error("Error in get-firebase-config:", error);
    response.status(500).json({ 
      error: 'Failed to load Firebase configuration',
      details: error.message,
      configReceived: process.env.__firebase_config ? process.env.__firebase_config.substring(0, 100) + "..." : 'No config found'
    });
  }
}
