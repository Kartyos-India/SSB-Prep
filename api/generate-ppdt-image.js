// api/generate-ppdt-image.js
export default async function handler(request, response) {
    // Standard CORS and OPTIONS method handling
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }
     if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const stabilityApiKey = process.env.STABILITY_AI_API_KEY;
        if (!stabilityApiKey) {
            throw new Error("STABILITY_AI_API_KEY environment variable not set.");
        }
        
        const { gender } = request.body;
        if (!gender || (gender !== 'male' && gender !== 'female')) {
            return response.status(400).json({ error: 'Gender must be "male" or "female".' });
        }

        // Updated prompt for a sketch-like, Indian rural scene
        const prompt = `A black and white ink line drawing, clear and simple sketch. An ambiguous situation is happening in a rural Indian village setting. The scene must contain at least three people. At least one of these people must be a ${gender}. The image should be suitable for a psychological test and open to many interpretations. Do not include any text or words in the image. Style: simple sketch, black and white, Indian context.`;

        const stabilityResponse = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${stabilityApiKey}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: 512,
                width: 768, // Using a wider aspect ratio
                steps: 30,
                samples: 1,
                style_preset: "line-art" // Using a style preset for sketch-like images
            }),
        });

        if (!stabilityResponse.ok) {
            const errorBody = await stabilityResponse.text();
            throw new Error(`Stability API error: ${stabilityResponse.status} ${errorBody}`);
        }

        const data = await stabilityResponse.json();
        const imageBase64 = data.artifacts[0].base64;

        response.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error("Error generating PPDT image:", error);
        response.status(500).json({ error: 'Failed to generate PPDT image.', details: error.message });
    }
}

