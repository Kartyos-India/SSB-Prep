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

    // --- INTERNAL QUESTION BANK ---
    const questionBank = [
        // Verbal Reasoning
        { "q": "Which word does not belong with the others?", "options": ["Apple", "Banana", "Rose", "Cherry"], "answer": "Rose" },
        { "q": "Book is to Reading as Fork is to:", "options": ["Drawing", "Writing", "Eating", "Stirring"], "answer": "Eating" },
        { "q": "Find the two words, one from each group, that are the closest in meaning: (Group A: Talk, Walk, Sing) (Group B: Run, Whisper, Dance)", "options": ["Walk & Run", "Sing & Dance", "Talk & Whisper"], "answer": "Talk & Whisper" },
        { "q": "If FRIEND is coded as HUMJTK, how is CANDLE written in that code?", "options": ["EDRIRL", "DEQJQM", "ESJFME", "FYOBOC"], "answer": "EDRIRL" },
        { "q": "Arrange the words in a meaningful sequence: 1. Police 2. Punishment 3. Crime 4. Judge 5. Judgement", "options": ["3, 1, 4, 5, 2", "3, 1, 2, 4, 5", "1, 2, 4, 3, 5", "5, 4, 3, 2, 1"], "answer": "3, 1, 4, 5, 2" },
        // ... (Many more questions would be here)

        // Numerical Aptitude
        { "q": "What is the next number in the series: 2, 6, 12, 20, 30, ...?", "options": ["42", "40", "36", "48"], "answer": "42" },
        { "q": "A man buys an article for Rs. 27.50 and sells it for Rs. 28.60. Find his gain percent.", "options": ["3%", "4%", "5%", "6%"], "answer": "4%" },
        { "q": "If 3 men or 6 boys can do a piece of work in 10 days, how many days will it take for 6 men and 2 boys to do the same work?", "options": ["4", "5", "6", "8"], "answer": "6" },
        
        // Picture-Based Reasoning
        { "q": "Which figure completes the pattern? [Image: A 2x2 grid with 3 quadrants filled, one is empty]", "options": ["Image Option A", "Image Option B", "Image Option C", "Image Option D"], "answer": "Image Option C" },
        { "q": "Find the odd one out among the figures. [Image: Four shapes, three are polygons, one is a circle]", "options": ["Figure A", "Figure B", "Figure C", "Figure D"], "answer": "Figure D" }
    ];
    
    // For demonstration, let's create a larger pool by duplicating and slightly modifying questions.
    // In a real application, you would have 200 unique questions.
    let fullBank = [];
    for(let i = 0; i < 20; i++) {
        fullBank.push(...questionBank);
    }
    fullBank = fullBank.slice(0, 200);


    // --- RANDOMIZATION LOGIC ---
    try {
        // Shuffle the entire bank
        for (let i = fullBank.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fullBank[i], fullBank[j]] = [fullBank[j], fullBank[i]];
        }

        // Select the first 50 questions
        const selectedQuestions = fullBank.slice(0, 50);

        // Return the selected questions
        response.status(200).json(selectedQuestions);

    } catch (error) {
        console.error("Error generating OIR questions:", error);
        response.status(500).json({ error: 'Failed to generate OIR questions.', details: error.message });
    }
}

