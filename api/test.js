// api/test.js
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  response.status(200).json({ 
    message: "API is working!",
    timestamp: new Date().toISOString()
  });
}
