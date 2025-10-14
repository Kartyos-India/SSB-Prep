// This script ONLY runs on screening.html
import { getAuth, onAuthStateChanged, getFirestore, collection, addDoc, serverTimestamp } from './firebase-init.js';

// --- DOM ELEMENTS (declared globally) ---
let pageContent, genderModal, testTypeModal;

let auth, db; // Firebase instances
let ppdtSettings = {}; // To store user's PPDT choices

// --- OIR Test State ---
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};
let oirTimerInterval;

// --- PPDT Test State ---
let ppdtTimerInterval;
let mediaRecorder;
let recordedChunks = [];


// --- OIR TEST LOGIC ---

async function initializeOIRTest() {
    pageContent.innerHTML = `<div class="text-center"><div class="loader"></div><h2 class="text-2xl font-bold mt-4">Generating OIR Test...</h2><p>Please wait a moment.</p></div>`;
    try {
        const response = await fetch('/api/generate-oir-questions');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch questions: ${response.status} ${errorText}`);
        }
        
        oirQuestions = await response.json();
        if (oirQuestions.length > 50) {
            oirQuestions = oirQuestions.slice(0, 50); // Ensure we only have 50 questions
        }

        // Set up a stable container for the test to prevent the timer from re-rendering
        pageContent.innerHTML = `
            <div id="oir-header">
                <div id="oir-timer-container" class="text-center text-xl font-bold mb-4"></div>
                <div class="text-center mb-8">
                    <h2 class="text-3xl font-bold">OFFICER INTELLIGENCE RATING TEST</h2>
                    <p id="oir-question-progress" class="text-gray-400 mt-2"></p>
                </div>
            </div>
            <div id="oir-question-wrapper"></div>
        `;

        currentOIRIndex = 0;
        oirResponses = {};
        startOIRTimer(); // Start timer
        renderOIRQuestion(); // Initial question render
    } catch (error) {
        console.error("OIR Initialization Error:", error);
        renderErrorPage("Could not generate the OIR test.", error.message);
    }
}

function startOIRTimer() {
    let timeLeft = 1800; // 30 minutes
    const timerContainer = document.getElementById('oir-timer-container');
    
    if (timerContainer) {
        timerContainer.innerHTML = `Time Left: <span class="text-yellow-400">${formatTime(timeLeft)}</span>`;
    }

    oirTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerContainer) {
            const timerDisplay = timerContainer.querySelector('span');
            if (timerDisplay) timerDisplay.textContent = formatTime(timeLeft);
        }
        if (timeLeft <= 0) {
            clearInterval(oirTimerInterval);
            submitOIRTest(); 
        }
    }, 1000);
}


function renderOIRQuestion() {
    if (currentOIRIndex < 0 || currentOIRIndex >= oirQuestions.length) return;

    const question = oirQuestions[currentOIRIndex];
    const questionWrapper = document.getElementById('oir-question-wrapper');
    const progressIndicator = document.getElementById('oir-question-progress');

    if (!questionWrapper || !progressIndicator) return;

    progressIndicator.textContent = `Question ${currentOIRIndex + 1} of ${oirQuestions.length}`;
    
    questionWrapper.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 max-w-2xl mx-auto space-y-6">
            <p class="text-lg text-gray-200 font-semibold">${currentOIRIndex + 1}. ${question.q}</p>
            <div class="space-y-3">
                ${question.options.map(opt => `
                    <label class="block bg-gray-700 p-4 rounded-md border border-gray-600 cursor-pointer hover:bg-gray-600 transition-colors">
                        <input type="radio" name="oir_q_option" value="${opt}" class="mr-3" ${oirResponses[currentOIRIndex] === opt ? 'checked' : ''}> ${opt}
                    </label>
                `).join('')}
            </div>
            <div class="flex justify-between pt-4 border-t border-gray-600">
                <button id="oir-prev-btn" class="back-btn py-2 px-4 rounded-lg">← Previous</button>
                <button id="oir-next-btn" class="primary-btn py-2 px-4 rounded-lg">Next →</button>
                <button id="oir-finish-btn" class="primary-btn py-2 px-4 rounded-lg hidden">Finish Test</button>
            </div>
        </div>
    `;
    
    document.getElementById('oir-prev-btn').style.visibility = currentOIRIndex === 0 ? 'hidden' : 'visible';
    document.getElementById('oir-next-btn').classList.toggle('hidden', currentOIRIndex === oirQuestions.length - 1);
    document.getElementById('oir-finish-btn').classList.toggle('hidden', currentOIRIndex !== oirQuestions.length - 1);

    document.getElementById('oir-prev-btn').addEventListener('click', () => handleOIRNavigation('prev'));
    document.getElementById('oir-next-btn').addEventListener('click', () => handleOIRNavigation('next'));
    document.getElementById('oir-finish-btn').addEventListener('click', submitOIRTest);
}

function handleOIRNavigation(direction) {
    const selectedOption = document.querySelector('input[name="oir_q_option"]:checked');
    if (selectedOption) oirResponses[currentOIRIndex] = selectedOption.value;

    if (direction === 'next' && currentOIRIndex < oirQuestions.length - 1) {
        currentOIRIndex++;
    } else if (direction === 'prev' && currentOIRIndex > 0) {
        currentOIRIndex--;
    }
    renderOIRQuestion();
}

async function submitOIRTest() {
    clearInterval(oirTimerInterval);
    const selectedOption = document.querySelector('input[name="oir_q_option"]:checked');
    if (selectedOption) oirResponses[currentOIRIndex] = selectedOption.value;

    let score = 0;
    oirQuestions.forEach((q, index) => {
        if (oirResponses[index] === q.answer) score++;
    });

    const user = auth.currentUser;
    if (user && db) {
        try {
            await addDoc(collection(db, 'users', user.uid, 'tests'), {
                testType: 'OIR Test',
                score: score,
                total: oirQuestions.length,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error saving OIR results to Firestore:", error);
        }
    }

    renderOIRReview(score);
}

function renderOIRReview(score) {
    pageContent.innerHTML = `
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold">OIR Test Complete</h2>
            <p class="text-2xl font-semibold mt-4 ${score >= 25 ? 'text-green-400' : 'text-red-400'}">
                Your Score: ${score} / ${oirQuestions.length}
            </p>
        </div>
        <div class="bg-gray-800 p-6 rounded-lg shadow-lg max-w-3xl mx-auto space-y-4">
            <h3 class="text-xl font-bold border-b border-gray-600 pb-2">Answer Review</h3>
            <div class="max-h-96 overflow-y-auto pr-2">
                ${oirQuestions.map((q, index) => {
                    const userAnswer = oirResponses[index] || "No Answer";
                    const isCorrect = userAnswer === q.answer;
                    return `
                        <div class="p-3 rounded mb-2 ${isCorrect ? 'bg-green-900' : 'bg-red-900'}">
                            <p class="font-semibold">${index + 1}. ${q.q}</p>
                            <p class="text-sm">Your answer: <span class="${isCorrect ? 'text-green-300' : 'text-red-300'}">${userAnswer}</span></p>
                            ${!isCorrect ? `<p class="text-sm">Correct answer: <span class="text-green-300">${q.answer}</span></p>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="text-center mt-8">
            <button id="back-to-menu" class="primary-btn py-2 px-6 rounded-lg font-semibold">Back to Screening Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu').addEventListener('click', renderScreeningMenu);
}


// --- PPDT TEST LOGIC ---

function initializePPDTModals() {
    genderModal.classList.remove('hidden');

    genderModal.querySelectorAll('.gender-btn').forEach(btn => {
        btn.onclick = () => {
            ppdtSettings.gender = btn.dataset.gender;
            genderModal.classList.add('hidden');
            testTypeModal.classList.remove('hidden');
        };
    });

    testTypeModal.querySelectorAll('.test-type-btn').forEach(btn => {
        btn.onclick = () => {
            ppdtSettings.mode = btn.dataset.type;
            testTypeModal.classList.add('hidden');
            startPPDTTest(ppdtSettings);
        };
    });

    document.querySelectorAll('.modal .close-modal').forEach(span => {
        span.onclick = () => {
            genderModal.classList.add('hidden');
            testTypeModal.classList.add('hidden');
        };
    });
}

async function startPPDTTest(settings) {
    pageContent.innerHTML = `<div class="text-center"><div class="loader"></div><h2 class="text-2xl font-bold mt-4">Generating PPDT Image...</h2><p>This may take a moment.</p></div>`;
    
    try {
        const response = await fetch('/api/generate-ppdt-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender: settings.gender })
        });
         if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to generate image: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        const imageUrl = `data:image/png;base64,${data.image}`;
        
        runPPDTFlow(imageUrl, settings);

    } catch (error) {
        console.error("PPDT Image Generation Error:", error);
        renderErrorPage("Could not generate the PPDT image.", error.message);
    }
}

function runPPDTFlow(imageUrl, settings) {
    let timeLeft = 30;
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-2xl font-bold">Observe the Picture</h2>
            <p class="text-lg text-red-400" id="timer-display">Time left: ${timeLeft}s</p>
            <img src="${imageUrl}" alt="PPDT Picture" class="mx-auto mt-4 rounded-lg shadow-lg max-w-full h-auto" style="max-height: 70vh;">
        </div>
    `;
    
    ppdtTimerInterval = setInterval(() => {
        timeLeft--;
        const timerDisplay = document.getElementById('timer-display');
        if(timerDisplay) timerDisplay.textContent = `Time left: ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(ppdtTimerInterval);
            startStoryWritingPhase(imageUrl, settings);
        }
    }, 1000);
}

function startStoryWritingPhase(imageUrl, settings) {
    let timeLeft = 270; // 4.5 minutes
    
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-3xl font-bold">Write Your Story</h2>
            <p class="text-gray-400 mt-2">You have 4 minutes and 30 seconds to write your story on a piece of paper.</p>
            ${settings.mode !== 'timed-invisible' ? `<p class="text-4xl font-bold mt-6 text-yellow-400" id="story-timer">${formatTime(timeLeft)}</p>` : ''}
        </div>
    `;

    if (settings.mode.startsWith('timed')) {
        ppdtTimerInterval = setInterval(() => {
            timeLeft--;
            const timerDisplay = document.getElementById('story-timer');
            if (timerDisplay) timerDisplay.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(ppdtTimerInterval);
                startNarrationPhase(imageUrl);
            }
        }, 1000);
    } else { 
         pageContent.innerHTML += `<div class="text-center mt-8"><button id="finish-writing-btn" class="primary-btn">I'm Ready to Narrate</button></div>`;
         document.getElementById('finish-writing-btn').addEventListener('click', () => startNarrationPhase(imageUrl));
    }
}

async function startNarrationPhase(imageUrl) {
    pageContent.innerHTML = `
        <div class="text-center max-w-xl mx-auto">
            <h2 class="text-3xl font-bold">Narrate Your Story</h2>
            <p class="text-gray-400 mt-2">Allow camera/mic access. You have 1 minute to narrate.</p>
            <div id="video-container" class="mt-4 bg-black rounded-lg aspect-video flex items-center justify-center text-gray-400 border border-gray-600">
                <p>Waiting for permissions...</p>
            </div>
            <p id="narration-timer" class="text-2xl font-bold my-4"></p>
            <button id="start-narration-btn" class="primary-btn mt-4">Start Narration</button>
        </div>
    `;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.muted = true;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        const videoContainer = document.getElementById('video-container');
        videoContainer.innerHTML = '';
        videoContainer.appendChild(videoElement);

        document.getElementById('start-narration-btn').addEventListener('click', () => {
            document.getElementById('start-narration-btn').disabled = true;
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
                const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                renderPPDTReview(videoBlob, imageUrl);
            };

            mediaRecorder.start();
            
            let timeLeft = 60;
            const timerDisplay = document.getElementById('narration-timer');
            timerDisplay.textContent = formatTime(timeLeft);
            ppdtTimerInterval = setInterval(() => {
                timeLeft--;
                timerDisplay.textContent = formatTime(timeLeft);
                if (timeLeft <= 0) {
                    clearInterval(ppdtTimerInterval);
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }
            }, 1000);
        });

    } catch (err) {
        console.error("Error accessing media devices.", err);
        renderErrorPage("Camera/Microphone Permission Denied.", "Please grant permissions in your browser's site settings and refresh the page to try again.");
    }
}

function renderPPDTReview(videoBlob, imageUrl) {
    const videoUrl = URL.createObjectURL(videoBlob);
    
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-3xl font-bold">Review Your Narration</h2>
        </div>
        <div class="max-w-4xl mx-auto mt-8 grid md:grid-cols-2 gap-8 items-start">
            <div>
                <h3 class="text-xl font-bold mb-2">Original Image</h3>
                <img src="${imageUrl}" class="rounded-lg shadow-lg w-full">
            </div>
            <div>
                <h3 class="text-xl font-bold mb-2">Your Narration</h3>
                <video id="review-video" src="${videoUrl}" controls class="w-full rounded-lg bg-black"></video>
                <div class="mt-4 space-y-2">
                    <p class="font-semibold">Review Tools:</p>
                    <button id="play-audio-only" class="w-full back-btn">Listen to Audio Only</button>
                    <button id="play-video-muted" class="w-full back-btn">Watch Muted Video (Gestures)</button>
                </div>
            </div>
        </div>
        <div class="text-center mt-12">
            <button id="save-ppdt-btn" class="primary-btn py-3 px-8 text-lg">Save Test to Performance</button>
            <button id="redo-ppdt-btn" class="ml-4 back-btn py-3 px-8 text-lg">Try Another PPDT</button>
        </div>
    `;

    const video = document.getElementById('review-video');
    const audioBtn = document.getElementById('play-audio-only');
    const mutedBtn = document.getElementById('play-video-muted');

    audioBtn.addEventListener('click', () => {
        video.style.visibility = 'hidden';
        video.style.height = '0px';
        video.muted = false;
        video.currentTime = 0;
        video.play();
    });
    mutedBtn.addEventListener('click', () => {
        video.style.visibility = 'visible';
        video.style.height = 'auto';
        video.muted = true;
        video.currentTime = 0;
        video.play();
    });
    video.addEventListener('play', () => {
        if (!video.muted) {
             video.style.visibility = 'visible';
             video.style.height = 'auto';
        }
    });

    document.getElementById('redo-ppdt-btn').addEventListener('click', initializePPDTModals);
    document.getElementById('save-ppdt-btn').addEventListener('click', async (event) => {
        const saveButton = event.currentTarget;
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        const user = auth.currentUser;
        if (user && db) {
            try {
                await addDoc(collection(db, 'users', user.uid, 'tests'), {
                    testType: 'PPDT',
                    imageUrl: imageUrl.substring(0, 150) + '...',
                    timestamp: serverTimestamp()
                });
                
                saveButton.textContent = 'Saved!';
                saveButton.className = 'success-btn py-3 px-8 text-lg';
                setTimeout(() => renderScreeningMenu(), 1500);

            } catch(error) {
                console.error("Error saving PPDT result:", error);
                saveButton.textContent = 'Save Failed!';
                saveButton.className = 'error-btn py-3 px-8 text-lg';
                saveButton.disabled = false;
            }
        }
    });
}

// --- UTILITY AND RENDER FUNCTIONS ---

function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function renderErrorPage(title, message) {
    pageContent.innerHTML = `
        <div class="text-center text-red-500 max-w-xl mx-auto">
            <h2 class="text-2xl font-bold mt-8">${title}</h2>
            <p class="mt-4 text-gray-400">${message}</p>
            <div class="mt-8">
                <button id="back-to-menu-btn" class="primary-btn">Back to Screening Menu</button>
            </div>
        </div>
    `;
    document.getElementById('back-to-menu-btn').addEventListener('click', renderScreeningMenu);
}

function renderScreeningMenu() {
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">SCREENING TESTS</h2>
            <p class="text-gray-400 mt-2">Select a test module to begin.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Officer Intelligence Rating (OIR)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">A 50-question test of verbal and non-verbal reasoning. Time Limit: 30 minutes.</p>
                <button id="start-oir" class="w-full primary-btn font-bold py-3 mt-6 rounded-lg">START OIR TEST</button>
            </div>
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Picture Perception & Discussion Test (PPDT)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Observe an AI-generated image, write a story, and narrate it to the camera.</p>
                <button id="start-ppdt" class="w-full primary-btn font-bold py-3 mt-6 rounded-lg">START PPDT</button>
            </div>
        </div>
    `;
    document.getElementById('start-oir').addEventListener('click', initializeOIRTest);
    document.getElementById('start-ppdt').addEventListener('click', initializePPDTModals);
}

// --- Initial Execution ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign elements after DOM is loaded
    pageContent = document.getElementById('page-content');
    genderModal = document.getElementById('genderModal');
    testTypeModal = document.getElementById('testTypeModal');

    auth = getAuth();
    db = getFirestore();
    onAuthStateChanged(auth, (user) => {
        if (pageContent) {
            pageContent.classList.remove('hidden');
        }

        if (user) {
            renderScreeningMenu();
        } else {
            pageContent.innerHTML = `<div class="text-center"><p class="text-xl">Please log in to access the screening tests.</p></div>`;
        }
    });
});

