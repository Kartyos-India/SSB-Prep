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
        availableVars: Object.keys(process.env).filter(key => key.includes('firebase') || key.includes('FIREBASE'))
      });
    }

    console.log("Found Firebase config, parsing...");
    
    // Parse the JSON string from environment variable
    const config = JSON.parse(firebaseConfig);
    
    console.log("Sending Firebase config to client");
    
    // Return the config to the client (without sensitive server-only fields if any)
    response.status(200).json(config);
    
  } catch (error) {
    console.error("Error in get-firebase-config:", error);
    response.status(500).json({ 
      error: 'Failed to load Firebase configuration',
      details: error.message,
      configString: process.env.__firebase_config ? 'Config exists but invalid JSON' : 'Config not found'
    });
  }
}
