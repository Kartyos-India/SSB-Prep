// js/firebase-init.js
// This file simply imports and re-exports Firebase services
// to make them available as standard JS modules.

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
    orderBy,
    serverTimestamp,
    setDoc,
    deleteDoc // Added deleteDoc for profile management
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
    orderBy,
    serverTimestamp,
    setDoc,
    deleteDoc
};
