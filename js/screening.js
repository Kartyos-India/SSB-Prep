// js/screening.js - Manages the entire screening test flow.

// Get the main content area of the page.
const pageContent = document.getElementById('page-content');

/**
 * Renders the initial menu where the user chooses between OIR and PPDT tests.
 */
function renderScreeningMenu() {
    // Set the HTML for the main menu.
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>Screening Tests</h1>
            <p>Stage I of the SSB consists of the Officer Intelligence Rating (OIR) test and the Picture Perception & Discussion Test (PPDT).</p>
        </div>
        <div class="test-choice-container">
            <div class="choice-card" id="start-oir-test">
                <h3>OIR Test</h3>
                <p>A series of verbal and non-verbal reasoning questions to assess your intelligence rating.</p>
            </div>
            <div class="choice-card" id="setup-ppdt-test">
                <h3>PPDT</h3>
                <p>Observe a picture, write a story, and prepare for the group discussion.</p>
            </div>
        </div>
    `;

    // Add event listeners to the new menu buttons.
    document.getElementById('start-oir-test').addEventListener('click', initializeOIRTest);
    document.getElementById('setup-ppdt-test').addEventListener('click', renderPPDTSetup);
}

/**
 * Renders the configuration screen for the PPDT test.
 * This is called when the user clicks the "PPDT" choice from the main menu.
 */
function renderPPDTSetup() {
    // The entire HTML for the PPDT setup form.
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>PPDT Configuration</h1>
            <p>Set up your Picture Perception & Discussion Test practice session.</p>
        </div>
        <div class="test-setup-card">
            <!-- Step 1: Gender Selection -->
            <div class="setup-step">
                <h2>Step 1: Select Your Gender</h2>
                <p>This helps in generating a relevant PPDT image.</p>
                <div class="option-group">
                    <label>
                        <input type="radio" name="gender" value="male" class="setup-option">
                        <div class="option-button">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                            <span>Male</span>
                        </div>
                    </label>
                    <label>
                        <input type="radio" name="gender" value="female" class="setup-option">
                        <div class="option-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="12" x2="12" y2="12"/></svg>
                            <span>Female</span>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Step 2: PPDT Mode Selection -->
            <div class="setup-step">
                <h2>Step 2: Choose PPDT Mode</h2>
                <p>Select whether you want a timed or untimed experience for the story writing part.</p>
                <div class="option-group">
                    <label>
                        <input type="radio" name="ppdt-mode" value="timed" class="setup-option">
                        <div class="option-button">
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span>Timed</span>
                        </div>
                    </label>
                    <label>
                        <input type="radio" name="ppdt-mode" value="untimed" class="setup-option">
                        <div class="option-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            <span>Untimed</span>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Step 3: Timer Visibility (Conditional) -->
            <div class="setup-step" id="timer-visibility-step" style="display: none;">
                <h2>Step 3: Timer Visibility</h2>
                <p>Choose if the timer should be visible during the timed test.</p>
                <div class="option-group">
                    <label>
                        <input type="radio" name="timer-visibility" value="visible" class="setup-option">
                        <div class="option-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            <span>Visible</span>
                        </div>
                    </label>
                    <label>
                        <input type="radio" name="timer-visibility" value="invisible" class="setup-option">
                        <div class="option-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            <span>Invisible</span>
                        </div>
                    </label>
                </div>
            </div>
            <div class="start-test-container">
                <button id="start-screening-test" class="start-btn" disabled>Start PPDT</button>
            </div>
        </div>
    `;

    // Now that the setup form is on the page, attach the interactive logic to it.
    attachPPDTSetupLogic();
}

/**
 * Attaches all the necessary event listeners and logic for the PPDT setup form.
 * This is separated so it can be called only when the form is actually on the page.
 */
function attachPPDTSetupLogic() {
    const ppdtModeRadios = document.querySelectorAll('input[name="ppdt-mode"]');
    const timerVisibilityStep = document.getElementById('timer-visibility-step');
    const startTestButton = document.getElementById('start-screening-test');
    const allOptions = document.querySelectorAll('.setup-option');

    function validateSelections() {
        const selectedGender = document.querySelector('input[name="gender"]:checked');
        const selectedPpdtMode = document.querySelector('input[name="ppdt-mode"]:checked');
        const selectedTimerVisibility = document.querySelector('input[name="timer-visibility"]:checked');

        let isReady = false;
        if (selectedGender && selectedPpdtMode) {
            if (selectedPpdtMode.value === 'untimed') {
                isReady = true;
            } else if (selectedPpdtMode.value === 'timed' && selectedTimerVisibility) {
                isReady = true;
            }
        }
        startTestButton.disabled = !isReady;
    }

    function handlePPDTModeChange() {
        const selectedPpdtMode = document.querySelector('input[name="ppdt-mode"]:checked');
        if (selectedPpdtMode && selectedPpdtMode.value === 'timed') {
            timerVisibilityStep.style.display = 'block';
        } else {
            timerVisibilityStep.style.display = 'none';
        }
    }

    ppdtModeRadios.forEach(radio => radio.addEventListener('change', handlePPDTModeChange));
    allOptions.forEach(option => option.addEventListener('change', validateSelections));
    
    // Logic for the start button will be added in the next step.
    startTestButton.addEventListener('click', () => {
        alert("Starting PPDT test... (functionality to be added)");
    });

    handlePPDTModeChange();
    validateSelections();
}

/**
 * Placeholder function for starting the OIR test.
 */
function initializeOIRTest() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>OIR Test</h1>
            <p>Loading questions...</p>
        </div>
        
    `;
    alert("Starting OIR test... (functionality to be added)");
}

// --- INITIAL EXECUTION ---
// When the screening page loads, the first thing we do is show the main menu.
renderScreeningMenu();

