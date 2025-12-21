// js/psychology.js
import { appInitialized } from './main.js';
import { auth, db } from './firebase-app.js';
import { collection, addDoc, serverTimestamp } from './firebase-init.js';
import { getNewTestContent, getUnseenBatch, markContentAsSeen } from './content-manager.js';

const pageContent = document.getElementById('page-content');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- STATE ---
let testInterval;
let currentTestType = null;
let currentItemIndex = 0;
let testItems = [];
let userResponses = [];

// --- UTILS ---
function playBell() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

function enterTestMode() {
    document.body.classList.add('test-in-progress');
    try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
}

function exitTestMode() {
    document.body.classList.remove('test-in-progress');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (testInterval) clearInterval(testInterval);
}

// --- MENU ---
export function renderPsychMenu() {
    pageContent.innerHTML = `
        <div class="page-title-section">
            <h1>Psychology Battery</h1>
            <p>Stage II Tests: Uncover your subconscious personality traits.</p>
        </div>
        <div class="test-choice-container">
            <div class="choice-card" id="start-tat">
                <h3>TAT</h3>
                <p>Thematic Apperception Test<br><small>11 Images + 1 Blank</small></p>
            </div>
            <div class="choice-card" id="start-wat">
                <h3>WAT</h3>
                <p>Word Association Test<br><small>60 Words, 15s each</small></p>
            </div>
            <div class="choice-card" id="start-srt">
                <h3>SRT</h3>
                <p>Situation Reaction Test<br><small>60 Situations, 30 mins</small></p>
            </div>
        </div>
    `;

    document.getElementById('start-tat').addEventListener('click', () => startTAT());
    document.getElementById('start-wat').addEventListener('click', () => startWAT());
    document.getElementById('start-srt').addEventListener('click', () => startSRT());
}

// --- TAT (Thematic Apperception Test) ---
async function startTAT() {
    pageContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading TAT Set...</p></div>`;
    try {
        // Fetch 11 images
        const images = await getUnseenBatch('tat', 11);
        // Add blank slide at the end
        testItems = [...images, { id: 'blank', path: 'blank', description: 'Blank Slide' }];
        
        currentTestType = 'TAT';
        currentItemIndex = 0;
        userResponses = new Array(12).fill(""); // Store stories
        
        runTATSlide();
    } catch (e) {
        console.error(e);
        alert("Failed to load TAT: " + e.message);
        renderPsychMenu();
    }
}

function runTATSlide() {
    enterTestMode();
    const item = testItems[currentItemIndex];
    const isBlank = item.id === 'blank';
    
    // 1. Observation Phase (30s) - Skipped for Blank? Usually blank is just writing.
    // Standard TAT: 30s View -> 4m Write. For Blank: 4m Write directly.
    
    if (isBlank) {
        runTATWriting(item);
        return;
    }

    playBell();
    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header"><h2>TAT ${currentItemIndex + 1}/12: Observe</h2></div>
            <p class="timer-display" id="tat-timer">30s</p>
            <img src="${item.path}" style="max-height:60vh; border-radius:8px; border:1px solid #444;">
        </div>
    `;

    let timeLeft = 30;
    testInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('tat-timer').textContent = `${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(testInterval);
            runTATWriting(item);
        }
    }, 1000);
}

function runTATWriting(item) {
    playBell();
    const isBlank = item.id === 'blank';
    let timeLeft = 240; // 4 minutes

    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header">
                <h2>TAT ${currentItemIndex + 1}/12: Write Story</h2>
                <button id="abort-btn" class="oir-nav-btn abort">Abort</button>
            </div>
            <p class="timer-display" id="tat-write-timer">4:00</p>
            ${!isBlank ? `<div style="opacity:0.5; margin-bottom:10px;">Context: Image previously shown</div>` : `<div>Write a story of your choice.</div>`}
            <textarea id="tat-input" placeholder="Start writing..." style="height:300px;"></textarea>
            <div class="start-test-container">
                <button id="next-tat-btn" class="start-btn">Next Slide</button>
            </div>
        </div>
    `;

    document.getElementById('abort-btn').addEventListener('click', () => { exitTestMode(); renderPsychMenu(); });
    
    // Auto-focus
    const input = document.getElementById('tat-input');
    input.focus();

    const finishSlide = () => {
        clearInterval(testInterval);
        userResponses[currentItemIndex] = input.value;
        currentItemIndex++;
        if (currentItemIndex < testItems.length) {
            runTATSlide();
        } else {
            finishPsychTest('TAT');
        }
    };

    document.getElementById('next-tat-btn').addEventListener('click', finishSlide);

    testInterval = setInterval(() => {
        timeLeft--;
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        if(document.getElementById('tat-write-timer'))
            document.getElementById('tat-write-timer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            finishSlide();
        }
    }, 1000);
}


// --- WAT (Word Association Test) ---
async function startWAT() {
    pageContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading WAT Words...</p></div>`;
    try {
        // Fetch 60 words
        testItems = await getUnseenBatch('wat', 60);
        currentTestType = 'WAT';
        currentItemIndex = 0;
        userResponses = new Array(60).fill("");
        
        runWATWord();
    } catch (e) {
        console.error(e);
        alert("Failed to load WAT: " + e.message);
        renderPsychMenu();
    }
}

function runWATWord() {
    enterTestMode();
    const wordItem = testItems[currentItemIndex];
    let timeLeft = 15;

    // Bell only at start of set usually, or every word? Usually continuous. 
    // We'll play a soft blip every word to alert user.
    playBell(); 

    pageContent.innerHTML = `
        <div class="ppdt-phase-container">
            <div class="ppdt-header">
                <h2>WAT ${currentItemIndex + 1}/60</h2>
                <button id="abort-btn" class="oir-nav-btn abort">Abort</button>
            </div>
            <p class="timer-display" id="wat-timer" style="color:var(--primary-blue)">15s</p>
            
            <div style="margin: 3rem 0; font-size: 3rem; font-weight: 700; text-transform: uppercase; letter-spacing: 2px;">
                ${wordItem.text || wordItem.word}
            </div>

            <input type="text" id="wat-input" placeholder="Type sentence here..." autocomplete="off" style="width:100%; padding:1rem; font-size:1.2rem; background:var(--dark-bg); border:1px solid var(--border-color); color:white; border-radius:8px;">
            <p style="margin-top:10px; color:var(--text-secondary); font-size:0.9rem;">Press Enter or wait for timer</p>
        </div>
    `;

    document.getElementById('abort-btn').addEventListener('click', () => { exitTestMode(); renderPsychMenu(); });
    
    const input = document.getElementById('wat-input');
    input.focus();

    const nextWord = () => {
        clearInterval(testInterval);
        userResponses[currentItemIndex] = input.value;
        currentItemIndex++;
        if (currentItemIndex < testItems.length) {
            runWATWord();
        } else {
            finishPsychTest('WAT');
        }
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nextWord();
    });

    testInterval = setInterval(() => {
        timeLeft--;
        const el = document.getElementById('wat-timer');
        if(el) el.textContent = `${timeLeft}s`;
        if (timeLeft <= 0) nextWord();
    }, 1000);
}


// --- SRT (Situation Reaction Test) ---
async function startSRT() {
    pageContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Loading SRT Situations...</p></div>`;
    try {
        // Fetch 60 situations
        testItems = await getUnseenBatch('srt', 60);
        currentTestType = 'SRT';
        userResponses = new Array(60).fill("");
        
        // SRT is usually a booklet. We will show 10 per page or all list?
        // Let's do a scrolling list for better UX on web.
        runSRTPage();
    } catch (e) {
        console.error(e);
        alert("Failed to load SRT: " + e.message);
        renderPsychMenu();
    }
}

function runSRTPage() {
    enterTestMode();
    // 30 Minutes Total
    let timeLeft = 30 * 60; 

    const generateList = () => {
        return testItems.map((item, idx) => `
            <div class="srt-item" style="background:var(--medium-dark-bg); padding:1.5rem; border-radius:8px; margin-bottom:1.5rem; border:1px solid var(--border-color);">
                <p style="font-weight:600; margin-bottom:0.5rem; font-size:1.1rem;">${idx + 1}. ${item.text || item.situation}</p>
                <input type="text" class="srt-input" data-idx="${idx}" placeholder="Your reaction..." style="width:100%; padding:0.8rem; background:var(--dark-bg); border:1px solid var(--border-color); color:white; border-radius:4px;">
            </div>
        `).join('');
    };

    pageContent.innerHTML = `
        <div class="app-container" style="max-width:800px; padding-top:2rem;">
            <div style="position:sticky; top:0; background:var(--dark-bg); padding:1rem 0; border-bottom:1px solid var(--border-color); z-index:10; display:flex; justify-content:space-between; align-items:center;">
                <h2>SRT Test</h2>
                <div style="font-size:1.5rem; font-weight:700; color:var(--primary-blue);" id="srt-timer">30:00</div>
                <button id="srt-submit-btn" class="start-btn" style="padding:0.5rem 1rem;">Submit Test</button>
            </div>
            <div style="margin-top:2rem;">
                ${generateList()}
            </div>
        </div>
    `;

    testInterval = setInterval(() => {
        timeLeft--;
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        const el = document.getElementById('srt-timer');
        if(el) el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) finishSRT();
    }, 1000);

    document.getElementById('srt-submit-btn').addEventListener('click', () => {
        if(confirm("Submit SRT Test?")) finishSRT();
    });
}

function finishSRT() {
    clearInterval(testInterval);
    // Collect all inputs
    document.querySelectorAll('.srt-input').forEach(input => {
        const idx = input.dataset.idx;
        userResponses[idx] = input.value;
    });
    finishPsychTest('SRT');
}


// --- FINISH & SAVE ---
async function finishPsychTest(type) {
    exitTestMode();
    pageContent.innerHTML = `<div class="loader-container"><div class="loader"></div><p>Saving ${type} Results...</p></div>`;

    if (auth.currentUser) {
        try {
            // Save logic
            // We save the array of responses + references to IDs
            await addDoc(collection(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'tests'), {
                testType: type,
                responses: userResponses,
                itemIds: testItems.map(i => i.id),
                timestamp: serverTimestamp()
            });
            
            // Mark as seen
            await markContentAsSeen(type.toLowerCase(), testItems.map(i => i.id));
            
            pageContent.innerHTML = `
                <div class="page-title-section">
                    <h1>${type} Completed</h1>
                    <p style="color:var(--success-green);">Results saved successfully.</p>
                    <button id="menu-btn" class="start-btn" style="margin-top:20px;">Back to Menu</button>
                </div>
            `;
            document.getElementById('menu-btn').addEventListener('click', renderPsychMenu);

        } catch (e) {
            console.error(e);
            alert("Error saving results: " + e.message);
            renderPsychMenu();
        }
    } else {
        alert("Test completed! (Not saved - Login required)");
        renderPsychMenu();
    }
}

// --- INIT ---
(async function() {
    await appInitialized;
    if(pageContent) renderPsychMenu();
})();
