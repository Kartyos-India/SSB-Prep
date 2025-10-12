// This script ONLY runs on screening.html
import { getAuth, onAuthStateChanged, getFirestore, collection, addDoc, serverTimestamp } from './firebase-init.js';

const pageContent = document.getElementById('page-content');
let auth, db; // Firebase instances

// --- OIR Test State ---
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};

// --- PPDT Test State ---
let ppdtTimerInterval;
let mediaRecorder;
let recordedChunks = [];


// --- OIR TEST LOGIC ---

async function initializeOIRTest() {
    pageContent.innerHTML = `<div class="text-center"><h2 class="text-2xl font-bold">Generating OIR Test...</h2><p>Please wait a moment.</p></div>`;
    try {
        const response = await fetch('/api/generate-oir-questions');
        if (!response.ok) throw new Error('Failed to fetch questions from the server.');
        
        oirQuestions = await response.json();
        if (oirQuestions.length > 50) {
            oirQuestions = oirQuestions.slice(0, 50); // Ensure we only have 50 questions
        }

        currentOIRIndex = 0;
        oirResponses = {};
        renderOIRQuestion();
    } catch (error) {
        console.error("OIR Initialization Error:", error);
        pageContent.innerHTML = `<div class="text-center text-red-500"><h2 class="text-2xl font-bold">Error</h2><p>Could not generate the OIR test. Please try again later.</p></div>`;
    }
}

function renderOIRQuestion() {
    if (currentOIRIndex < 0 || currentOIRIndex >= oirQuestions.length) return;

    const question = oirQuestions[currentOIRIndex];
    pageContent.innerHTML = `
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold">OIR TEST</h2>
            <p class="text-gray-400 mt-2">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</p>
        </div>
        <div class="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 max-w-2xl mx-auto space-y-6">
            <p class="text-lg text-gray-200 font-semibold">${question.q}</p>
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

function renderPPDTSetup() {
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">PPDT Setup</h2>
            <p class="text-gray-400 mt-2">Configure your test session.</p>
        </div>
        <div class="max-w-md mx-auto mt-8 bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-700 space-y-6">
            <div>
                <label for="gender-select" class="block mb-2 font-semibold text-gray-300">Select Your Gender:</label>
                <select id="gender-select" class="w-full p-3 bg-gray-700 rounded-md border border-gray-600 text-white">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                </select>
            </div>
            <div>
                <label class="block mb-2 font-semibold text-gray-300">Test Mode:</label>
                <div class="space-y-2">
                    <label class="flex items-center bg-gray-700 p-3 rounded-md"><input type="radio" name="ppdt-mode" value="timed-visible" class="mr-3" checked> Timed (Visible Timer)</label>
                    <label class="flex items-center bg-gray-700 p-3 rounded-md"><input type="radio" name="ppdt-mode" value="timed-invisible" class="mr-3"> Timed (Invisible Timer)</label>
                    <label class="flex items-center bg-gray-700 p-3 rounded-md"><input type="radio" name="ppdt-mode" value="untimed" class="mr-3"> Untimed</label>
                </div>
            </div>
            <button id="start-ppdt-btn" class="w-full primary-btn font-bold py-3 mt-6 rounded-lg">Start PPDT</button>
        </div>
    `;

    document.getElementById('start-ppdt-btn').addEventListener('click', () => {
        const gender = document.getElementById('gender-select').value;
        const mode = document.querySelector('input[name="ppdt-mode"]:checked').value;
        startPPDTTest({ gender, mode });
    });
}

async function startPPDTTest(settings) {
    pageContent.innerHTML = `<div class="text-center"><h2 class="text-2xl font-bold">Generating PPDT Image...</h2><p>This may take a moment.</p></div>`;
    
    try {
        const response = await fetch('/api/generate-ppdt-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gender: settings.gender })
        });
        if (!response.ok) throw new Error('Failed to generate image.');
        const data = await response.json();
        const imageUrl = `data:image/png;base64,${data.image}`;
        
        runPPDTFlow(imageUrl, settings);

    } catch (error) {
        console.error("PPDT Image Generation Error:", error);
        pageContent.innerHTML = `<div class="text-center text-red-500"><h2 class="text-2xl font-bold">Error</h2><p>Could not generate the PPDT image. Please try again.</p></div>`;
    }
}

function runPPDTFlow(imageUrl, settings) {
    // Phase 1: Show image for 30 seconds
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
            // Phase 2: Story writing time
            startStoryWritingPhase(imageUrl, settings);
        }
    }, 1000);
}

function startStoryWritingPhase(imageUrl, settings) {
    let timeLeft = 270; // 4.5 minutes
    
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-3xl font-bold">Write Your Story</h2>
            <p class="text-gray-400 mt-2">You have 4 minutes and 30 seconds to write a story based on the picture you saw. Please write it on a piece of paper.</p>
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
    } else { // Untimed mode
         pageContent.innerHTML += `<div class="text-center mt-8"><button id="finish-writing-btn" class="primary-btn">I'm Ready to Narrate</button></div>`;
         document.getElementById('finish-writing-btn').addEventListener('click', () => startNarrationPhase(imageUrl));
    }
}

async function startNarrationPhase(imageUrl) {
    pageContent.innerHTML = `
        <div class="text-center max-w-xl mx-auto">
            <h2 class="text-3xl font-bold">Narrate Your Story</h2>
            <p class="text-gray-400 mt-2">Please allow camera and microphone access. You will have 1 minute to narrate your story.</p>
            <div id="video-container" class="mt-4 bg-black rounded-lg aspect-video flex items-center justify-center text-gray-400">
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
        document.getElementById('video-container').innerHTML = '';
        document.getElementById('video-container').appendChild(videoElement);

        document.getElementById('start-narration-btn').addEventListener('click', () => {
            document.getElementById('start-narration-btn').disabled = true;
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
                // For now, we don't upload, just go to review. Upload will happen if user saves.
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
                    mediaRecorder.stop();
                }
            }, 1000);
        });

    } catch (err) {
        console.error("Error accessing media devices.", err);
        document.getElementById('video-container').innerHTML = `<p class="text-red-500">Error: Could not access camera or microphone. Please check your browser permissions.</p>`;
        document.getElementById('start-narration-btn').disabled = true;
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
    document.getElementById('play-audio-only').addEventListener('click', () => {
        video.muted = false;
        video.play();
        // A simple trick to hide video: we can't just play audio, so we play video but hide it.
        video.style.height = '0px'; 
    });
     document.getElementById('play-video-muted').addEventListener('click', () => {
        video.style.height = 'auto';
        video.muted = true;
        video.play();
    });

    document.getElementById('redo-ppdt-btn').addEventListener('click', renderPPDTSetup);
    document.getElementById('save-ppdt-btn').addEventListener('click', () => {
        // Here you would upload the blob and image to Firebase storage
        // then save the URLs to Firestore. For now, we'll just simulate it.
        alert("Saving functionality is a placeholder. In a real app, this would upload your video and save the results.");
        renderScreeningMenu();
    });
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// --- MAIN MENU for Screening Page ---

function renderScreeningMenu() {
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">SCREENING TESTS</h2>
            <p class="text-gray-400 mt-2">Select a test module to begin.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
            <div class="choice-card p-6 text-center flex flex-col rounded-lg">
                <h3 class="text-xl font-bold mt-3">Officer Intelligence Rating (OIR)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">A 50-question test of verbal and non-verbal reasoning to assess your logical ability.</p>
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
    document.getElementById('start-ppdt').addEventListener('click', renderPPDTSetup);
}

// --- Initial Execution ---
auth = getAuth();
db = getFirestore();
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (pageContent) renderScreeningMenu();
    } else {
        // If not logged in, show a message. main.js handles the login button.
        pageContent.innerHTML = `<div class="text-center"><p class="text-xl">Please log in to access the screening tests.</p></div>`;
    }
});

