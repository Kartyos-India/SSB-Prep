// api/generate-oir-questions.js
export default async function handler(request, response) {
    // Standard CORS and OPTIONS method handling
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    try {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            throw new Error("GROQ_API_KEY environment variable not set.");
        }

        const prompt = `
            Generate 50 Officer Intelligence Rating (OIR) test questions suitable for SSB interviews.
            They should be a mix of verbal and non-verbal reasoning.
            For each question, provide:
            - A "q" field for the question text.
            - An "options" field with four possible string answers.
            - An "answer" field with the correct string answer.
            Return the result as a single, valid JSON array of these objects. Do not include any text outside of the JSON array.
            Example format: [{"q": "...", "options": ["A", "B", "C", "D"], "answer": "C"}, ...]
        `;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [{ role: 'user', content: prompt }],
                temperature: 1.2,
            }),
        });

        if (!groqResponse.ok) {
            const errorBody = await groqResponse.text();
            throw new Error(`Groq API error: ${groqResponse.status} ${errorBody}`);
        }

        const data = await groqResponse.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error("Invalid response structure from Groq API.");
        }
        
        // The API might return the JSON within a code block, so we clean it up.
        const cleanedJsonString = content.replace(/```json\n|```/g, '').trim();
        const questions = JSON.parse(cleanedJsonString);

        response.status(200).json(questions);

    } catch (error) {
        console.error("Error generating OIR questions:", error);
        response.status(500).json({ error: 'Failed to generate OIR questions.', details: error.message });
    }
}
