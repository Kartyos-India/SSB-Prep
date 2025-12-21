export default async function handler(request, response) {
  // Set CORS headers to allow access from your frontend
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  // Returns the environment variable set in Vercel
  // Example value for Drive (using a proxy): https://lh3.googleusercontent.com/d/
  // or a custom CDN url.
  return response.status(200).json({ 
    baseUrl: process.env.STORAGE_BASE_URL || "" 
  });
}
