// This script ONLY runs on screening.html

const pageContent = document.getElementById('page-content');

// --- OIR Test State Variables ---
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};

// --- PPDT Placeholder ---
function initializePPDT() {
    alert("PPDT simulation is not yet implemented.");
}

// --- OIR Test Logic ---

// This function starts the OIR test
function initializeOIRTest() {
    // Mock Questions (In a real app, you might fetch these from the server)
    oirQuestions = [
        { q: "If A = 1 and B = 2, what is the value of G?", options: ["6", "7", "8", "5"], answer: "7" },
        { q: "Which number completes the series: 3, 6, 12, 24, __?", options: ["36", "48", "30", "42"], answer: "48" },
        { q: "Find the odd one out: Car, Bus, Bicycle, Ship.", options: ["Car", "Bus", "Bicycle", "Ship"], answer: "Ship" },
        { q: "If you reorganize the letters 'RAPIS', you get the name of a/an:", options: ["Country", "City", "Animal", "River"], answer: "City" },
        { q: "A man walks 5km East, then 5km North. In which direction is he from his starting point?", options: ["North", "East", "North-West", "North-East"], answer: "North-East" },
    ];
    
    currentOIRIndex = 0;
    oirResponses = {};
    renderOIRQuestion(); // Display the first question
}

// This function displays the current OIR question and options
function renderOIRQuestion() {
    if (currentOIRIndex < 0) currentOIRIndex = 0;
    if (currentOIRIndex >= oirQuestions.length) currentOIRIndex = oirQuestions.length - 1;

    const question = oirQuestions[currentOIRIndex];

    pageContent.innerHTML = `
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold">OIR TEST</h2>
            <p class="text-gray-500 mt-2">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</p>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-md border max-w-2xl mx-auto space-y-6">
            <div id="oir-question-container" class="space-y-4">
                <p class="text-lg text-gray-700 font-semibold">${question.q}</p>
                <div class="space-y-2">
                    ${question.options.map(opt => `
                        <label class="block bg-gray-50 p-3 rounded-md border cursor-pointer hover:bg-gray-100">
                            <input type="radio" name="oir_q_option" value="${opt}" class="mr-2" ${oirResponses[currentOIRIndex] === opt ? 'checked' : ''}> ${opt}
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="flex justify-between pt-4 border-t border-gray-200">
                <button id="oir-prev-btn" class="back-btn py-2 px-4 rounded-lg">← Previous</button>
                <button id="oir-next-btn" class="primary-btn py-2 px-4 rounded-lg">Next →</button>
                <button id="oir-finish-btn" class="primary-btn py-2 px-4 rounded-lg hidden">Finish Test</button>
            </div>
        </div>
    `;

    // Show/hide navigation buttons based on the current question index
    document.getElementById('oir-prev-btn').classList.toggle('hidden', currentOIRIndex === 0);
    document.getElementById('oir-next-btn').classList.toggle('hidden', currentOIRIndex === oirQuestions.length - 1);
    document.getElementById('oir-finish-btn').classList.toggle('hidden', currentOIRIndex !== oirQuestions.length - 1);

    // Attach event listeners to the buttons
    document.getElementById('oir-prev-btn').addEventListener('click', () => handleOIRNavigation('prev'));
    document.getElementById('oir-next-btn').addEventListener('click', () => handleOIRNavigation('next'));
    document.getElementById('oir-finish-btn').addEventListener('click', submitOIRTest);
}

// This function handles moving between questions
function handleOIRNavigation(direction) {
    // Save the current answer before moving
    const selectedOption = document.querySelector('input[name="oir_q_option"]:checked');
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    if (direction === 'next') {
        currentOIRIndex++;
    } else if (direction === 'prev') {
        currentOIRIndex--;
    }
    renderOIRQuestion();
}

// This function is called when the user finishes the test
function submitOIRTest() {
    // Save the answer for the very last question
    const selectedOption = document.querySelector('input[name="oir_q_option"]:checked');
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    let score = 0;
    oirQuestions.forEach((q, index) => {
        if (oirResponses[index] === q.answer) {
            score++;
        }
    });

    // Display the review screen
    pageContent.innerHTML = `
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold">OIR Test Complete</h2>
            <p class="text-2xl font-semibold mt-4 ${score >= 3 ? 'text-green-600' : 'text-red-600'}">
                Your Score: ${score} / ${oirQuestions.length}
            </p>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md max-w-2xl mx-auto space-y-4">
            <h3 class="text-xl font-bold border-b pb-2">Answer Review</h3>
            ${oirQuestions.map((q, index) => {
                const userAnswer = oirResponses[index] || "No Answer";
                const isCorrect = userAnswer === q.answer;
                return `
                    <div class="p-3 rounded ${isCorrect ? 'bg-green-50' : 'bg-red-50'}">
                        <p class="font-semibold">${index + 1}. ${q.q}</p>
                        <p class="text-sm">Your answer: <span class="${isCorrect ? 'text-green-700' : 'text-red-700'}">${userAnswer}</span></p>
                        ${!isCorrect ? `<p class="text-sm">Correct answer: <span class="text-green-700">${q.answer}</span></p>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        <div class="text-center mt-8">
            <button id="back-to-menu" class="primary-btn py-2 px-6 rounded-lg font-semibold">Back to Screening Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu').addEventListener('click', renderScreeningMenu);
}

// --- Main Menu for Screening Page ---

// This function displays the choice between OIR and PPDT
function renderScreeningMenu() {
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">SCREENING TESTS</h2>
            <p class="text-gray-500 mt-2">Select a test module to begin.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
            <!-- OIR Test Card -->
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Officer Intelligence Rating (OIR)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">A series of verbal and non-verbal reasoning questions to test your logical ability.</p>
                <button id="start-oir" class="w-full primary-btn font-bold py-3 mt-6 rounded-lg">
                    START OIR TEST
                </button>
            </div>
            
            <!-- PPDT Card -->
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Picture Perception & Discussion Test (PPDT)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Observe an image, write a story, and narrate it. (Simulation coming soon).</p>
                <button id="start-ppdt" class="w-full primary-btn font-bold py-3 mt-6 rounded-lg">
                    START PPDT
                </button>
            </div>
        </div>
    `;

    // Attach event listeners to the start buttons
    document.getElementById('start-oir').addEventListener('click', initializeOIRTest);
    document.getElementById('start-ppdt').addEventListener('click', initializePPDT);
}

// --- Initial Execution ---

// This is the first thing that runs when the screening.html page loads.
if (pageContent) {
    renderScreeningMenu();
}

