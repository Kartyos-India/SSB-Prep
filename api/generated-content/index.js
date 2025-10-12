// This file acts as a central hub for importing the Firebase SDK modules.
// This allows us to update the Firebase version in one place.

export { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
export { 
    getAuth, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
export { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    getDocs, 
    doc, 
    getDoc, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

