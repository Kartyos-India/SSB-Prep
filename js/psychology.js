// This script ONLY runs on psychology.html

const pageContent = document.getElementById('page-content');

// This function will be called when a test button is clicked.
// For now, it just shows a placeholder message.
function initializeTest(testType) {
    alert(`${testType} test is not yet implemented.`);
}

// Function to show the main menu of all Psychology tests
function renderPsychologyMenu() {
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">PSYCHOLOGY TESTS</h2>
            <p class="text-gray-500 mt-2">Select a test to begin your assessment.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto pt-8">
            <!-- TAT Card -->
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Thematic Apperception Test (TAT)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Write stories based on ambiguous pictures to reveal your underlying motives and concerns.</p>
                <button class="w-full primary-btn font-bold py-3 mt-6 rounded-lg" data-test="TAT">
                    START TAT
                </button>
            </div>
            
            <!-- WAT Card -->
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Word Association Test (WAT)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Respond with the first thought that comes to mind after seeing a series of words.</p>
                <button class="w-full primary-btn font-bold py-3 mt-6 rounded-lg" data-test="WAT">
                    START WAT
                </button>
            </div>

            <!-- SRT Card -->
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Situation Reaction Test (SRT)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Provide your spontaneous reaction to a set of everyday situations.</p>
                <button class="w-full primary-btn font-bold py-3 mt-6 rounded-lg" data-test="SRT">
                    START SRT
                </button>
            </div>
        </div>
    `;

    // Add event listeners to all the "START" buttons
    pageContent.querySelectorAll('button[data-test]').forEach(button => {
        button.addEventListener('click', () => {
            initializeTest(button.dataset.test);
        });
    });
}

// Initial render when the psychology.html page loads
if (pageContent) {
    renderPsychologyMenu();
}
