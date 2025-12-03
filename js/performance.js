// This script ONLY runs on performance.html
import { onAuthStateChanged, collection, query, getDocs, orderBy } from './firebase-init.js';
// Import the initialized instances from our new central module
import { firebasePromise, auth, db } from './firebase-app.js';



const pageContent = document.getElementById('page-content');

// This function will fetch and display the test data
async function loadPerformanceData(user) {
    if (!user) {
        pageContent.innerHTML = `
            <div class="text-center bg-gray-800 p-8 rounded-lg shadow-md border border-gray-700">
                <h2 class="text-3xl font-bold text-gray-200">Access Denied</h2>
                <p class="text-gray-400 mt-2">Please log in to view your performance history.</p>
                <a href="index.html" class="primary-btn inline-block mt-6 py-2 px-6 rounded-lg font-semibold">
                    Return to Home
                </a>
            </div>
        `;
        return;
    }

    try {
        const userId = user.uid;
        
        const testsRef = collection(db, 'users', userId, 'tests');
        const q = query(testsRef, orderBy('timestamp', 'desc'));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            pageContent.innerHTML = `
                <div class="text-center">
                    <h2 class="text-3xl font-bold text-gray-200">No Tests Taken Yet</h2>
                    <p class="text-gray-400 mt-2">Your past performance will appear here once you complete a test.</p>
                </div>
            `;
            return;
        }

        const testResultsHtml = querySnapshot.docs.map(doc => {
            const test = doc.data();
            const date = test.timestamp ? new Date(test.timestamp.seconds * 1000).toLocaleDateString("en-US", {
                year: 'numeric', month: 'long', day: 'numeric'
            }) : 'Date not available';

            let scoreInfo;
            if (test.testType === 'PPDT') {
                scoreInfo = `<span class="font-bold text-blue-400">Completed</span>`;
            } else if (test.score !== undefined) {
                const percentage = (test.score / test.total) * 100;
                const scoreColor = percentage >= 50 ? 'text-green-400' : 'text-red-400';
                scoreInfo = `<span class="font-bold ${scoreColor}">${test.score}/${test.total}</span>`;
            } else {
                 scoreInfo = `<span class="font-bold text-gray-400">N/A</span>`;
            }

            return `
                <div class="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-700 flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-bold text-gray-100">${test.testType}</h3>
                        <p class="text-sm text-gray-400">${date}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-gray-300">Result: ${scoreInfo}</p>
                    </div>
                </div>
            `;
        }).join('');

        pageContent.innerHTML = `
            <div class="text-center mb-8">
                <h2 class="text-3xl font-bold text-gray-100">My Performance History</h2>
                <p class="text-gray-400 mt-2">A record of all your completed tests.</p>
            </div>
            <div class="max-w-3xl mx-auto space-y-4">
                ${testResultsHtml}
            </div>
        `;

    } catch (error) {
        console.error("Error fetching performance data:", error);
        pageContent.innerHTML = `
            <div class="text-center">
                <h2 class="text-3xl font-bold text-red-500">Error Loading Data</h2>
                <p class="text-gray-400 mt-2">Could not load performance data. Please try again later.</p>
            </div>
        `;
    }
}

// --- Initial Execution ---
document.addEventListener('DOMContentLoaded', async () => {
     try {
        // Wait for our central Firebase initialization to complete
        await firebasePromise;
        
        onAuthStateChanged(auth, (user) => {
            loadPerformanceData(user);
        });
    } catch (error) {
        console.error("Top-level Firebase initialization failed on performance page:", error);
        if (pageContent) {
            pageContent.innerHTML = `
             <div class="text-center">
                <h2 class="text-3xl font-bold text-red-500">Application Error</h2>
                <p class="text-gray-400 mt-2">Could not connect to Firebase. Please try again later.</p>
            </div>`;
        }
    }
});

