// js/screening.js - Adds interactivity to the screening test setup page.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT REFERENCES ---
    // Get all the interactive elements from the page that we need to work with.
    const ppdtModeRadios = document.querySelectorAll('input[name="ppdt-mode"]');
    const timerVisibilityStep = document.getElementById('timer-visibility-step');
    const startTestButton = document.getElementById('start-screening-test');
    const allOptions = document.querySelectorAll('.setup-option');

    /**
     * This is the main validation function. It checks if the user has made
     * all the required selections to proceed with the test.
     */
    function validateSelections() {
        // Find which options are currently checked.
        const selectedGender = document.querySelector('input[name="gender"]:checked');
        const selectedPpdtMode = document.querySelector('input[name="ppdt-mode"]:checked');
        const selectedTimerVisibility = document.querySelector('input[name="timer-visibility"]:checked');

        let isReady = false;

        // --- VALIDATION LOGIC ---
        // 1. A gender and PPDT mode must always be selected.
        if (selectedGender && selectedPpdtMode) {
            // 2. If the mode is 'untimed', we are ready to start.
            if (selectedPpdtMode.value === 'untimed') {
                isReady = true;
            }
            // 3. If the mode is 'timed', we also need a timer visibility choice.
            else if (selectedPpdtMode.value === 'timed' && selectedTimerVisibility) {
                isReady = true;
            }
        }

        // Enable or disable the start button based on the validation result.
        startTestButton.disabled = !isReady;
    }

    /**
     * This function handles showing or hiding the "Timer Visibility" step
     * based on the PPDT mode selection.
     */
    function handlePPDTModeChange() {
        const selectedPpdtMode = document.querySelector('input[name="ppdt-mode"]:checked');
        
        if (selectedPpdtMode && selectedPpdtMode.value === 'timed') {
            // If "Timed" is selected, show Step 3.
            timerVisibilityStep.style.display = 'block';
        } else {
            // Otherwise, hide it.
            timerVisibilityStep.style.display = 'none';
        }
    }

    // --- EVENT LISTENERS ---
    // Add an event listener to the PPDT mode radio buttons.
    ppdtModeRadios.forEach(radio => {
        radio.addEventListener('change', handlePPDTModeChange);
    });

    // Add an event listener to EVERY option. Whenever any choice is made,
    // we re-run the validation to check if the start button should be enabled.
    allOptions.forEach(option => {
        option.addEventListener('change', validateSelections);
    });

    // --- INITIAL STATE ---
    // Run the functions once on page load to set the correct initial state.
    handlePPDTModeChange();
    validateSelections();
});

