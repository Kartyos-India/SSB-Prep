// This script ONLY runs on performance.html

// Import necessary Firebase functions from our central init file
import { getAuth, onAuthStateChanged } from './firebase-init.js';
import { getFirestore, collection, query, getDocs, orderBy } from './firebase-init.js';

const pageContent = document.getElementById('page-content');

// This function will fetch and display the test data
async function loadPerformanceData(user) {
    if (!user) {
        // If the user is not logged in, show a message
        pageContent.innerHTML = `
            <div class="text-center bg-white p-8 rounded-lg shadow-md">
                <h2 class="text-3xl font-bold text-gray-700">Access Denied</h2>
                <p class="text-gray-500 mt-2">Please log in to view your performance history.</p>
                <a href="index.html" class="primary-btn inline-block mt-6 py-2 px-6 rounded-lg font-semibold">
                    Return to Home
                </a>
            </div>
        `;
        return;
    }

    try {
        const db = getFirestore();
        const userId = user.uid;
        
        // Create a query to get all documents from the user's 'tests' collection, ordered by the most recent
        const testsRef = collection(db, 'users', userId, 'tests');
        const q = query(testsRef, orderBy('timestamp', 'desc'));

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            // If there are no test records, display a message
            pageContent.innerHTML = `
                <div class="text-center">
                    <h2 class="text-3xl font-bold text-gray-700">No Tests Taken Yet</h2>
                    <p class="text-gray-500 mt-2">Your past performance will appear here once you complete a test.</p>
                </div>
            `;
            return;
        }

        // If there are records, build the HTML to display them
        const testResultsHtml = querySnapshot.docs.map(doc => {
            const test = doc.data();
            // Format the timestamp into a readable date
            const date = new Date(test.timestamp.seconds * 1000).toLocaleDateString("en-US", {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            // Display score if it exists, otherwise show 'Completed'
            const scoreInfo = test.score !== undefined ? 
                `<span class="font-bold ${test.score > 3 ? 'text-green-600' : 'text-red-600'}">${test.score}/${test.total}</span>` :
                `<span class="font-bold text-blue-600">Completed</span>`;

            return `
                <div class="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-bold text-gray-800">${test.testType}</h3>
                        <p class="text-sm text-gray-500">${date}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-gray-700">Score: ${scoreInfo}</p>
                        <!-- We can add a "View Details" button here in the future -->
                    </div>
                </div>
            `;
        }).join('');

        // Update the page with the results
        pageContent.innerHTML = `
            <div class="text-center mb-8">
                <h2 class="text-3xl font-bold text-gray-700">My Performance History</h2>
                <p class="text-gray-500 mt-2">A record of all your completed tests.</p>
            </div>
            <div class="max-w-3xl mx-auto space-y-4">
                ${testResultsHtml}
            </div>
        `;

    } catch (error) {
        console.error("Error fetching performance data:", error);
        pageContent.innerHTML = `<div class="text-center text-red-500">Could not load performance data. Please try again later.</div>`;
    }
}

// --- Initial Execution ---
// We wait for the Firebase auth state to be confirmed before trying to load data.
// The `main.js` script handles the initialization.
const auth = getAuth();
onAuthStateChanged(auth, (user) => {
    // The onAuthStateChanged listener in main.js will handle the header,
    // so we just need to focus on loading the page content here.
    loadPerformanceData(user);
});
