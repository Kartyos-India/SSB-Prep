// This script ONLY runs on screening.html

const pageContent = document.getElementById('page-content');

// --- OIR Test State Variables ---
let oirQuestions = [];
let currentOIRIndex = 0;
let oirResponses = {};
let oirTimer = null;
let oirTimeLeft = 0;

// --- PPDT Test State Variables ---
let ppdtTestType = '';
let ppdtUserGender = '';
let ppdtGeneratedImage = null;
let ppdtViewingTimer = null;
let ppdtWritingTimer = null;
let ppdtNarrationTimer = null;
let ppdtMediaRecorder = null;
let ppdtRecordedChunks = [];
let ppdtStoryText = '';

// --- OIR Test Logic ---

// This function starts the OIR test
function initializeOIRTest() {
    // Generate 50 questions using Groq API (fallback to mock data if API fails)
    generateOIRQuestions().then(questions => {
        oirQuestions = questions;
        currentOIRIndex = 0;
        oirResponses = {};
        oirTimeLeft = 1800; // 30 minutes for 50 questions
        
        startOIRTimer();
        renderOIRQuestion();
    }).catch(error => {
        console.error('Error generating OIR questions:', error);
        // Fallback to mock questions
        oirQuestions = generateMockOIRQuestions(50);
        currentOIRIndex = 0;
        oirResponses = {};
        oirTimeLeft = 1800;
        
        startOIRTimer();
        renderOIRQuestion();
    });
}

async function generateOIRQuestions() {
    try {
        // This would be replaced with actual Groq API call
        // For now, using enhanced mock data
        return generateMockOIRQuestions(50);
    } catch (error) {
        throw error;
    }
}

function generateMockOIRQuestions(count) {
    const questionTemplates = [
        {
            type: 'verbal',
            template: (i) => ({
                q: `Which word is different from the others? (Q${i})`,
                options: ["Happy", "Joyful", "Pleased", "Angry"],
                answer: "Angry",
                explanation: "All others are synonyms for happiness."
            })
        },
        {
            type: 'numerical',
            template: (i) => ({
                q: `What comes next: 2, 6, 18, 54, __? (Q${i})`,
                options: ["108", "162", "216", "270"],
                answer: "162",
                explanation: "Multiply by 3 each time."
            })
        },
        {
            type: 'spatial',
            template: (i) => ({
                q: `Which shape completes the pattern? (Q${i})`,
                options: ["Square", "Circle", "Triangle", "Hexagon"],
                answer: "Triangle",
                explanation: "Pattern alternates between polygons and circles."
            })
        },
        {
            type: 'logical',
            template: (i) => ({
                q: `If all roses are flowers and some flowers fade quickly, then: (Q${i})`,
                options: [
                    "All roses fade quickly",
                    "Some roses fade quickly", 
                    "No roses fade quickly",
                    "Some roses may fade quickly"
                ],
                answer: "Some roses may fade quickly",
                explanation: "We cannot definitively conclude about roses from the given information."
            })
        }
    ];
    
    const questions = [];
    for (let i = 0; i < count; i++) {
        const template = questionTemplates[i % questionTemplates.length];
        questions.push(template.template(i + 1));
    }
    return questions;
}

function startOIRTimer() {
    if (oirTimer) clearInterval(oirTimer);
    
    oirTimer = setInterval(() => {
        oirTimeLeft--;
        updateOIRTimerDisplay();
        
        if (oirTimeLeft <= 0) {
            clearInterval(oirTimer);
            submitOIRTest();
        }
    }, 1000);
}

function updateOIRTimerDisplay() {
    const minutes = Math.floor(oirTimeLeft / 60);
    const seconds = oirTimeLeft % 60;
    const timerElement = document.getElementById('oir-timer');
    if (timerElement) {
        timerElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// This function displays the current OIR question and options
function renderOIRQuestion() {
    if (currentOIRIndex < 0) currentOIRIndex = 0;
    if (currentOIRIndex >= oirQuestions.length) currentOIRIndex = oirQuestions.length - 1;

    const question = oirQuestions[currentOIRIndex];

    pageContent.innerHTML = `
        <div class="text-center mb-6">
            <h2 class="text-3xl font-bold">OFFICER INTELLIGENCE RATING TEST</h2>
            <p class="text-gray-500 mt-2">Question ${currentOIRIndex + 1} of ${oirQuestions.length}</p>
            <div id="oir-timer" class="timer-display">Time: 30:00</div>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-md border max-w-2xl mx-auto space-y-6">
            <div id="oir-question-container" class="space-y-4">
                <p class="text-lg text-gray-700 font-semibold">${question.q}</p>
                <div class="space-y-2">
                    ${question.options.map((opt, idx) => `
                        <label class="block bg-gray-50 p-3 rounded-md border cursor-pointer hover:bg-gray-100 transition-colors">
                            <input type="radio" name="oir_q_option" value="${opt}" class="mr-3" 
                                   ${oirResponses[currentOIRIndex] === opt ? 'checked' : ''}>
                            <span class="option-text">${String.fromCharCode(65 + idx)}. ${opt}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="flex justify-between pt-4 border-t border-gray-200">
                <button id="oir-prev-btn" class="back-btn py-2 px-4 rounded-lg ${currentOIRIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''}">← Previous</button>
                <button id="oir-next-btn" class="primary-btn py-2 px-4 rounded-lg">Next →</button>
                <button id="oir-finish-btn" class="primary-btn py-2 px-4 rounded-lg hidden">Finish Test</button>
            </div>
        </div>
    `;

    updateOIRTimerDisplay();

    // Show/hide navigation buttons
    document.getElementById('oir-prev-btn').classList.toggle('hidden', currentOIRIndex === 0);
    document.getElementById('oir-next-btn').classList.toggle('hidden', currentOIRIndex === oirQuestions.length - 1);
    document.getElementById('oir-finish-btn').classList.toggle('hidden', currentOIRIndex !== oirQuestions.length - 1);

    // Attach event listeners
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
    if (oirTimer) {
        clearInterval(oirTimer);
        oirTimer = null;
    }

    // Save the answer for the very last question
    const selectedOption = document.querySelector('input[name="oir_q_option"]:checked');
    if (selectedOption) {
        oirResponses[currentOIRIndex] = selectedOption.value;
    }

    let score = 0;
    const results = oirQuestions.map((q, index) => {
        const userAnswer = oirResponses[index];
        const isCorrect = userAnswer === q.answer;
        if (isCorrect) score++;
        
        return {
            question: q.q,
            userAnswer,
            correctAnswer: q.answer,
            isCorrect,
            explanation: q.explanation
        };
    });

    const percentage = (score / oirQuestions.length) * 100;
    
    // Save to Firebase
    saveOIRResults(score, percentage, results);

    // Display results
    displayOIRResults(score, percentage, results);
}

function displayOIRResults(score, percentage, results) {
    pageContent.innerHTML = `
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold">OIR Test Complete</h2>
            <div class="score-display mt-4">
                <div class="text-4xl font-bold ${percentage >= 70 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}">
                    ${score}/${oirQuestions.length}
                </div>
                <div class="text-xl ${percentage >= 70 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}">
                    ${percentage.toFixed(1)}%
                </div>
                <div class="mt-2 text-gray-600">
                    ${percentage >= 70 ? 'Excellent!' : percentage >= 50 ? 'Good attempt!' : 'Keep practicing!'}
                </div>
            </div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md max-w-4xl mx-auto">
            <h3 class="text-xl font-bold border-b pb-2 mb-4">Detailed Review</h3>
            <div class="space-y-4 max-h-96 overflow-y-auto">
                ${results.map((result, index) => `
                    <div class="p-4 rounded-lg border ${result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <p class="font-semibold">${index + 1}. ${result.question}</p>
                                <div class="mt-2 space-y-1 text-sm">
                                    <p>Your answer: <span class="${result.isCorrect ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}">${result.userAnswer || 'No Answer'}</span></p>
                                    ${!result.isCorrect ? `
                                        <p>Correct answer: <span class="text-green-700 font-medium">${result.correctAnswer}</span></p>
                                        <p class="text-gray-600">Explanation: ${result.explanation}</p>
                                    ` : ''}
                                </div>
                            </div>
                            <span class="ml-4 px-2 py-1 rounded text-xs font-medium ${result.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                ${result.isCorrect ? 'Correct' : 'Incorrect'}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="text-center mt-8">
            <button id="back-to-menu" class="primary-btn py-3 px-8 rounded-lg font-semibold text-lg">Back to Screening Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu').addEventListener('click', renderScreeningMenu);
}

async function saveOIRResults(score, percentage, results) {
    try {
        const user = await getCurrentUser();
        if (user) {
            const testData = {
                userId: user.uid,
                testType: 'oir',
                score: score,
                percentage: percentage,
                totalQuestions: oirQuestions.length,
                responses: results,
                timestamp: new Date().toISOString(),
                timeSpent: 1800 - oirTimeLeft
            };
            
            // Save to Firebase
            const docRef = await firebase.firestore().collection('userPerformance').add(testData);
            console.log('OIR results saved with ID: ', docRef.id);
        }
    } catch (error) {
        console.error('Error saving OIR results:', error);
    }
}

// --- PPDT Test Logic ---

function initializePPDT() {
    showTestTypeModal();
}

function showTestTypeModal() {
    const modal = document.getElementById('testTypeModal');
    modal.classList.remove('hidden');
    
    // Add event listeners to test type buttons
    document.querySelectorAll('.test-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            ppdtTestType = e.target.dataset.type;
            modal.classList.add('hidden');
            showGenderModal();
        });
    });
    
    // Close modal
    document.querySelector('#testTypeModal .close-modal').addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

function showGenderModal() {
    const modal = document.getElementById('genderModal');
    modal.classList.remove('hidden');
    
    // Add event listeners to gender buttons
    document.querySelectorAll('.gender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            ppdtUserGender = e.target.closest('.gender-btn').dataset.gender;
            modal.classList.add('hidden');
            startPPDTTest();
        });
    });
    
    // Close modal
    document.querySelector('#genderModal .close-modal').addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

async function startPPDTTest() {
    try {
        // Generate PPDT image
        const imageUrl = await generatePPDTImage();
        ppdtGeneratedImage = imageUrl;
        
        // Start image viewing phase
        startImageViewingPhase();
        
    } catch (error) {
        console.error('Error starting PPDT test:', error);
        alert('Error starting PPDT test. Please try again.');
    }
}

async function generatePPDTImage() {
    // For now, using placeholder images. Replace with Stability AI API call
    const placeholderImages = [
        'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3?w=400',
        'https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=400',
        'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400'
    ];
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return placeholderImages[Math.floor(Math.random() * placeholderImages.length)];
}

function startImageViewingPhase() {
    pageContent.innerHTML = `
        <div class="text-center mb-6">
            <h2 class="text-3xl font-bold">PICTURE PERCEPTION TEST</h2>
            <p class="text-gray-500 mt-2">Observe the image carefully for 30 seconds</p>
            <div id="viewing-timer" class="timer-display">30</div>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto">
            <div class="ppdt-image-container">
                <img id="ppdt-image" src="${ppdtGeneratedImage}" alt="PPDT Test Image" class="ppdt-image">
            </div>
            <div class="mt-6 text-center text-gray-600">
                <p>You have 30 seconds to observe this image. After that, you'll have 4.5 minutes to write your story.</p>
            </div>
        </div>
    `;

    let viewingTimeLeft = 30;
    const timerElement = document.getElementById('viewing-timer');
    
    ppdtViewingTimer = setInterval(() => {
        viewingTimeLeft--;
        timerElement.textContent = viewingTimeLeft;
        
        if (viewingTimeLeft <= 0) {
            clearInterval(ppdtViewingTimer);
            startStoryWritingPhase();
        }
    }, 1000);
}

function startStoryWritingPhase() {
    pageContent.innerHTML = `
        <div class="text-center mb-6">
            <h2 class="text-3xl font-bold">WRITE YOUR STORY</h2>
            <p class="text-gray-500 mt-2">You have 4 minutes 30 seconds to write your story</p>
            <div id="writing-timer" class="timer-display">4:30</div>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-md max-w-4xl mx-auto">
            <div class="mb-4">
                <img src="${ppdtGeneratedImage}" alt="PPDT Test Image" class="ppdt-image-small mx-auto">
            </div>
            <textarea 
                id="story-textarea" 
                placeholder="Write your story based on the image you observed. Include characters, situation, and outcome..."
                class="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
            <div class="mt-4 text-center">
                <button id="finish-writing" class="primary-btn py-3 px-8 rounded-lg font-semibold">Finish Writing</button>
            </div>
        </div>
    `;

    let writingTimeLeft = 270; // 4.5 minutes
    const timerElement = document.getElementById('writing-timer');
    
    ppdtWritingTimer = setInterval(() => {
        writingTimeLeft--;
        const minutes = Math.floor(writingTimeLeft / 60);
        const seconds = writingTimeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (writingTimeLeft <= 0) {
            clearInterval(ppdtWritingTimer);
            finishWritingPhase();
        }
    }, 1000);

    document.getElementById('finish-writing').addEventListener('click', finishWritingPhase);
}

function finishWritingPhase() {
    if (ppdtWritingTimer) {
        clearInterval(ppdtWritingTimer);
    }
    
    ppdtStoryText = document.getElementById('story-textarea').value;
    startNarrationPhase();
}

async function startNarrationPhase() {
    pageContent.innerHTML = `
        <div class="text-center mb-6">
            <h2 class="text-3xl font-bold">STORY NARRATION</h2>
            <p class="text-gray-500 mt-2">You have 1 minute to narrate your story</p>
            <div id="narration-timer" class="timer-display">1:00</div>
        </div>
        <div class="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto">
            <div class="video-container mb-4">
                <video id="video-preview" autoplay muted class="w-full rounded-lg border"></video>
            </div>
            <div class="text-center space-y-4">
                <button id="start-recording" class="primary-btn py-3 px-8 rounded-lg font-semibold">
                    <i class="fas fa-record-vinyl mr-2"></i>Start Recording
                </button>
                <button id="stop-recording" class="secondary-btn py-3 px-8 rounded-lg font-semibold hidden">
                    <i class="fas fa-stop mr-2"></i>Stop Recording
                </button>
            </div>
            <div class="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 class="font-semibold mb-2">Your Story:</h4>
                <p class="text-gray-700">${ppdtStoryText || 'No story written.'}</p>
            </div>
        </div>
    `;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoPreview = document.getElementById('video-preview');
        videoPreview.srcObject = stream;

        setupRecording(stream);
    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Camera access is required for narration. Please allow camera permissions.');
    }
}

function setupRecording(stream) {
    ppdtMediaRecorder = new MediaRecorder(stream);
    ppdtRecordedChunks = [];

    ppdtMediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            ppdtRecordedChunks.push(event.data);
        }
    };

    ppdtMediaRecorder.onstop = () => {
        saveRecording();
    };

    document.getElementById('start-recording').addEventListener('click', () => {
        ppdtMediaRecorder.start();
        document.getElementById('start-recording').classList.add('hidden');
        document.getElementById('stop-recording').classList.remove('hidden');
        startNarrationTimer();
    });

    document.getElementById('stop-recording').addEventListener('click', () => {
        ppdtMediaRecorder.stop();
        if (ppdtNarrationTimer) {
            clearInterval(ppdtNarrationTimer);
        }
    });
}

function startNarrationTimer() {
    let narrationTimeLeft = 60;
    const timerElement = document.getElementById('narration-timer');
    
    ppdtNarrationTimer = setInterval(() => {
        narrationTimeLeft--;
        timerElement.textContent = `0:${narrationTimeLeft.toString().padStart(2, '0')}`;
        
        if (narrationTimeLeft <= 0) {
            clearInterval(ppdtNarrationTimer);
            ppdtMediaRecorder.stop();
        }
    }, 1000);
}

async function saveRecording() {
    const blob = new Blob(ppdtRecordedChunks, { type: 'video/webm' });
    
    try {
        const user = await getCurrentUser();
        if (user) {
            // Save to Firebase Storage
            const storageRef = firebase.storage().ref();
            const videoRef = storageRef.child(`ppdt-narrations/${user.uid}/${Date.now()}.webm`);
            await videoRef.put(blob);
            const videoUrl = await videoRef.getDownloadURL();

            // Save test data to Firestore
            await savePPDTResults(videoUrl);
            
            // Start review phase
            startReviewPhase(videoUrl);
        }
    } catch (error) {
        console.error('Error saving recording:', error);
    }
}

async function savePPDTResults(videoUrl) {
    try {
        const user = await getCurrentUser();
        if (user) {
            const testData = {
                userId: user.uid,
                testType: 'ppdt',
                testConfig: {
                    type: ppdtTestType,
                    gender: ppdtUserGender
                },
                imageUrl: ppdtGeneratedImage,
                story: ppdtStoryText,
                narrationUrl: videoUrl,
                timestamp: new Date().toISOString()
            };
            
            await firebase.firestore().collection('userPerformance').add(testData);
        }
    } catch (error) {
        console.error('Error saving PPDT results:', error);
    }
}

function startReviewPhase(videoUrl) {
    let currentReviewStep = 1;
    
    function showReviewStep(step) {
        const steps = {
            1: {
                title: 'Review - Audio Only',
                content: `<audio controls class="w-full"><source src="${videoUrl}" type="video/webm">Your browser does not support the audio element.</audio>`,
                button: 'Next: Body Language Review'
            },
            2: {
                title: 'Review - Body Language (Muted)',
                content: `<video controls muted class="w-full rounded-lg"><source src="${videoUrl}" type="video/webm">Your browser does not support the video element.</video>`,
                button: 'Next: Complete Review'
            },
            3: {
                title: 'Review - Complete Presentation',
                content: `<video controls class="w-full rounded-lg"><source src="${videoUrl}" type="video/webm">Your browser does not support the video element.</video>`,
                button: 'Finish Review'
            }
        };
        
        const stepData = steps[step];
        
        pageContent.innerHTML = `
            <div class="text-center mb-6">
                <h2 class="text-3xl font-bold">STORY REVIEW</h2>
                <p class="text-gray-500 mt-2">Step ${step}/3: ${stepData.title}</p>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-md max-w-2xl mx-auto">
                <h3 class="text-xl font-bold mb-4">${stepData.title}</h3>
                <div class="review-content mb-6">
                    ${stepData.content}
                </div>
                ${step === 3 ? `
                    <div class="story-review mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 class="font-semibold mb-2">Your Written Story:</h4>
                        <p class="text-gray-700">${ppdtStoryText}</p>
                    </div>
                ` : ''}
                <div class="text-center">
                    <button id="next-review-step" class="primary-btn py-3 px-8 rounded-lg font-semibold">
                        ${stepData.button}
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('next-review-step').addEventListener('click', () => {
            if (step < 3) {
                currentReviewStep++;
                showReviewStep(currentReviewStep);
            } else {
                completePPDTTest();
            }
        });
    }
    
    showReviewStep(1);
}

function completePPDTTest() {
    pageContent.innerHTML = `
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold">PPDT Test Complete!</h2>
            <div class="mt-6 bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto">
                <i class="fas fa-check-circle text-green-500 text-4xl mb-4"></i>
                <p class="text-green-800 font-semibold">Your PPDT test has been successfully completed and saved.</p>
            </div>
        </div>
        <div class="text-center">
            <button id="back-to-menu" class="primary-btn py-3 px-8 rounded-lg font-semibold text-lg">Back to Screening Menu</button>
        </div>
    `;
    document.getElementById('back-to-menu').addEventListener('click', renderScreeningMenu);
}

// --- Utility Functions ---

async function getCurrentUser() {
    return new Promise((resolve) => {
        const unsubscribe = firebase.auth().onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        });
    });
}

// --- Main Menu for Screening Page ---

function renderScreeningMenu() {
    pageContent.innerHTML = `
        <div class="text-center">
            <h2 class="text-4xl font-bold">SCREENING TESTS</h2>
            <p class="text-gray-500 mt-2">Select a test module to begin your screening preparation.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-8">
            <!-- OIR Test Card -->
            <div class="choice-card p-6 text-center flex flex-col rounded-lg hover:shadow-lg transition-shadow">
                <div class="icon-container mb-4">
                    <i class="fas fa-brain text-4xl text-blue-600"></i>
                </div>
                <h3 class="text-xl font-bold mt-3">Officer Intelligence Rating (OIR)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">50 questions testing verbal, numerical, spatial, and logical reasoning abilities. Time limit: 30 minutes.</p>
                <button id="start-oir" class="w-full primary-btn font-bold py-3 mt-6 rounded-lg hover:scale-105 transition-transform">
                    START OIR TEST
                </button>
            </div>
            
            <!-- PPDT Card -->
            <div class="choice-card p-6 text-center flex flex-col rounded-lg hover:shadow-lg transition-shadow">
                <div class="icon-container mb-4">
                    <i class="fas fa-image text-4xl text-green-600"></i>
                </div>
                <h3 class="text-xl font-bold mt-3">Picture Perception & Discussion Test (PPDT)</h3>
                <p class="text-gray-500 mt-2 flex-grow text-sm">Observe an image, write a story in 4.5 minutes, and narrate it in 1 minute. Includes video recording.</p>
                <button id="start-ppdt" class="w-full primary-btn font-bold py-3 mt-6 rounded-lg hover:scale-105 transition-transform">
                    START PPDT
                </button>
            </div>
        </div>
        
        <!-- Performance Dashboard Link -->
        <div class="text-center mt-12">
            <a href="performance.html" class="secondary-btn py-3 px-6 rounded-lg font-semibold inline-flex items-center">
                <i class="fas fa-chart-line mr-2"></i>View My Performance
            </a>
        </div>
    `;

    // Attach event listeners to the start buttons
    document.getElementById('start-oir').addEventListener('click', initializeOIRTest);
    document.getElementById('start-ppdt').addEventListener('click', initializePPDT);
}

// --- Initial Execution ---

// This is the first thing that runs when the screening.html page loads.
if (pageContent) {
    // Wait for Firebase auth to be ready
    setTimeout(() => {
        pageContent.classList.remove('hidden');
        renderScreeningMenu();
    }, 1000);
}
