// api/generate-ppdt-image.js
// This function now calls the Hugging Face Inference API to generate an image.
// It uses the HF_API_KEY from your Vercel environment variables.

export default async function handler(request, response) {
    // Standard CORS and OPTIONS method handling
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const hfApiKey = process.env.HF_API_KEY;
        if (!hfApiKey) {
            throw new Error("HF_API_KEY environment variable not set.");
        }

        const { gender } = request.body;
        if (!gender || (gender !== 'male' && gender !== 'female')) {
            return response.status(400).json({ error: 'Gender must be "male" or "female".' });
        }

        // Prompt for a black and white, ambiguous sketch
        const prompt = `A black and white ink line drawing, clear and simple sketch. An ambiguous situation is happening in a rural Indian village setting. The scene must contain at least three people. At least one of these people must be a ${gender}. The image should be suitable for a psychological test and open to many interpretations. Do not include any text or words in the image. Style: simple line art, black and white sketch.`;
        
        const hfResponse = await fetch(
            "https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5",
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: prompt,
                }),
            }
        );

        if (!hfResponse.ok) {
            const errorBody = await hfResponse.text();
            throw new Error(`Hugging Face API error: ${hfResponse.status} ${errorBody}`);
        }

        // The API returns the image as a binary blob
        const imageBlob = await hfResponse.blob();
        
        // We need to convert this blob to a Base64 string to send it as JSON
        const imageBuffer = await imageBlob.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        // Send the Base64 string back in the same format the frontend expects
        response.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error("Error generating PPDT image:", error);
        response.status(500).json({ error: 'Failed to generate PPDT image.', details: error.message });
    }
}

