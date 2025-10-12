// This file's purpose is to import the Firebase modules and make them available
// to other scripts that need them.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    getDocs, 
    doc, 
    getDoc, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// We export all the functions we imported so that other scripts (like main.js)
// can import them from this file.
export {
    initializeApp,
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    getFirestore,
    collection,
    addDoc,
    query,
    getDocs,
    doc,
    getDoc,
    orderBy
};

