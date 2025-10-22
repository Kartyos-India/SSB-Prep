// api/generate-oir-questions.js
// Reverted to use the Groq API for dynamic question generation.
// Requires GROQ_API_KEY environment variable.

export default async function handler(request, response) {
    // Standard CORS and OPTIONS method handling
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for production if needed
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }
     if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            throw new Error("GROQ_API_KEY environment variable not set.");
        }

        const prompt = `
            Generate exactly 50 Officer Intelligence Rating (OIR) test questions suitable for SSB interviews.
            Include a mix of verbal reasoning (analogies, odd one out), non-verbal/visual reasoning (pattern completion, series), numerical aptitude, and logical deduction.
            For each question, provide ONLY:
            - A "q" field for the question text (string). For visual questions, describe the image/pattern clearly.
            - An "options" field with exactly four possible string answers (array of strings).
            - An "answer" field with the correct string answer (string), which must exactly match one of the options.
            Return the result as a single, valid JSON array containing 50 question objects. Do not include any introductory text, closing text, markdown formatting (like \`\`\`json), or anything outside the JSON array itself.
            Example format: [{"q": "...", "options": ["A", "B", "C", "D"], "answer": "C"}, ...]
        `;

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192', // Or another suitable model
                messages: [{ role: 'user', content: prompt }],
                temperature: 1.1, // Increased temperature for variety
                n: 1, // Generate one response
                response_format: { type: "json_object" } // Request JSON output if supported
            }),
        });

        if (!groqResponse.ok) {
            const errorBody = await groqResponse.text();
            console.error("Groq API Error Response:", errorBody);
            throw new Error(`Groq API error: ${groqResponse.status}`);
        }

        const data = await groqResponse.json();
        const content = data.choices[0]?.message?.content;

        if (!content) {
            throw new Error("Invalid response structure from Groq API (no content).");
        }
        
        // Attempt to parse the content as JSON
        let questions;
        try {
            // Remove potential markdown fences just in case response_format fails
             const cleanedJsonString = content.replace(/^```json\s*|```$/g, '').trim();
             const parsedData = JSON.parse(cleanedJsonString);
             // Groq might wrap the array in an object, e.g., { "questions": [...] }
             // Adapt based on observed API behavior
             if (Array.isArray(parsedData)) {
                 questions = parsedData;
             } else if (parsedData && Array.isArray(parsedData.questions)) {
                 questions = parsedData.questions; // Adjust if the key is different
             } else {
                 throw new Error("Parsed JSON is not an array or expected object structure.");
             }

        } catch (parseError) {
             console.error("Failed to parse Groq response:", content);
             throw new Error(`Failed to parse Groq response JSON: ${parseError.message}`);
        }

        // Validate structure and count
        if (!Array.isArray(questions) || questions.length === 0) {
             throw new Error("API returned invalid or empty question data.");
        }
         if (questions.length !== 50) {
             console.warn(`Groq API returned ${questions.length} questions instead of 50. Using what was provided.`);
             // You might choose to pad or truncate here if 50 is critical, but using what's returned is often okay.
         }

        // Basic validation of the first question structure
        if (!questions[0] || !questions[0].q || !Array.isArray(questions[0].options) || questions[0].options.length !== 4 || !questions[0].answer) {
             console.error("First question structure is invalid:", questions[0]);
             throw new Error("API returned questions with incorrect structure.");
        }


        response.status(200).json(questions);

    } catch (error) {
        console.error("Error in generate-oir-questions handler:", error);
        response.status(500).json({ error: 'Failed to generate OIR questions.', details: error.message });
    }
}

