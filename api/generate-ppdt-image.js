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

        const prompt = `A hazy, ambiguous, black and white photograph showing a thought-provoking and unclear situation. The scene must contain at least three human figures. At least one of these figures must be a ${gender}. The image should be suitable for a psychological test, open to many interpretations. Do not include any text or words in the image. Style: realistic, grainy, mysterious, out of focus background.`;

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
                width: 512,
                steps: 30,
                samples: 1,
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
