// api/generate-oir-questions.js
// Fetches the default OIR questions from Firestore, shuffles them, and returns 50.
// Requires Firebase Admin SDK setup in Vercel environment variables.

// IMPORTANT: You need to set up Firebase Admin SDK for this serverless function.
// 1. Go to Firebase Console -> Project Settings -> Service Accounts.
// 2. Generate a new private key (JSON file).
// 3. Copy the contents of this JSON file.
// 4. In Vercel -> Project Settings -> Environment Variables, create a variable named FIREBASE_ADMIN_CONFIG
// 5. Paste the entire JSON content as the value for FIREBASE_ADMIN_CONFIG.

import admin from 'firebase-admin';

// Initialize Firebase Admin SDK only once
try {
    if (!admin.apps.length) {
        // Get the config string from environment variables
        const serviceAccountString = process.env.FIREBASE_ADMIN_CONFIG;
        if (!serviceAccountString) {
            throw new Error("FIREBASE_ADMIN_CONFIG environment variable not set.");
        }
        // Parse the string into a JSON object
        const serviceAccount = JSON.parse(serviceAccountString);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin SDK Initialized Successfully.");
    }
} catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
    // If Admin SDK fails, the function won't work, but we handle errors below.
}

const db = admin.firestore();

export default async function handler(request, response) {
    // Standard CORS and OPTIONS method handling
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- Determine App ID ---
    // Vercel automatically provides SOME deployment context, but not __app_id like the frontend.
    // If you need appId specific data, you might pass it as a query param or use a known constant.
    // For public data, we might not strictly need it, depending on your structure.
    // Let's assume a default or structure that doesn't rely on runtime appId here.
    // Replace 'default-app-id' if you have a way to determine it or use a fixed one.
    const appId = process.env.VERCEL_PROJECT_ID || 'default-app-id'; // Example fallback

    try {
        // --- Fetch Questions from Firestore ---
        // Path adjusted for public data structure
        const docRef = db.collection('artifacts').doc(appId)
                         .collection('public').doc('data')
                         .collection('oirDefaultQuestions').doc('main');

        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            console.error("Firestore document 'oirDefaultQuestions/main' not found.");
            throw new Error("Default questions not found in the database.");
        }

        const data = docSnap.data();
        if (!data || !Array.isArray(data.questionsList) || data.questionsList.length === 0) {
            console.error("Firestore document 'oirDefaultQuestions/main' has invalid or empty 'questionsList'.");
            throw new Error("Invalid question data format in the database.");
        }

        let allQuestions = data.questionsList;

        // --- Shuffle the array ---
        for (let i = allQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }

        // --- Select the first 50 ---
        const selectedQuestions = allQuestions.slice(0, 50);

        // --- Send response ---
        response.status(200).json(selectedQuestions);

    } catch (error) {
        console.error("Error fetching/processing OIR questions from Firestore:", error);
        // Ensure Admin SDK initialized correctly if this error persists
        if (error.message.includes("initialize")) {
             return response.status(500).json({ error: 'Server configuration error (Firebase Admin SDK).', details: error.message });
        }
        response.status(500).json({ error: 'Failed to generate OIR questions from Firestore.', details: error.message });
    }
}

