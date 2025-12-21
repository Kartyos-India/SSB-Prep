// js/content-manager.js
import { auth, db } from './firebase-app.js';
import { doc, getDoc, setDoc, arrayUnion, serverTimestamp } from './firebase-init.js';

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

let _storageBaseUrl = null;

/**
 * Fetches the Storage Base URL from the server environment variable.
 */
async function getStorageBaseUrl() {
    if (_storageBaseUrl !== null) return _storageBaseUrl;
    try {
        const res = await fetch('/api/get-storage-config');
        if (res.ok) {
            const data = await res.json();
            _storageBaseUrl = data.baseUrl || "";
        } else {
            _storageBaseUrl = "";
        }
    } catch (e) {
        console.warn("Could not fetch storage config, defaulting to empty.", e);
        _storageBaseUrl = "";
    }
    return _storageBaseUrl;
}

/**
 * Fetches the static JSON catalog for a specific test type.
 */
async function fetchContentCatalog(type) {
    try {
        const response = await fetch(`data/${type}.json`);
        if (!response.ok) throw new Error(`Failed to load ${type} data`);
        return await response.json();
    } catch (e) {
        console.error("Content fetch error:", e);
        return [];
    }
}

/**
 * Retrieves the list of content IDs the user has already seen.
 */
async function getUserSeenHistory(uid, testType) {
    if (!db) return [];
    try {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', uid, 'history', testType);
        const snap = await getDoc(docRef);
        return snap.exists() ? (snap.data().seenIds || []) : [];
    } catch (e) {
        console.warn("History fetch error:", e);
        return [];
    }
}

/**
 * Helper to construct the full image URL.
 */
async function resolveImagePath(itemPath) {
    // If it's already a full URL (http/https), return it.
    if (itemPath.startsWith('http://') || itemPath.startsWith('https://')) {
        return itemPath;
    }

    // Otherwise, prepend the base URL from env
    const baseUrl = await getStorageBaseUrl();
    
    // If no base URL and path is relative, assume local public folder
    if (!baseUrl) return itemPath;

    // Remove double slashes if they exist
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = itemPath.startsWith('/') ? itemPath.slice(1) : itemPath;
    
    return `${cleanBase}/${cleanPath}`;
}

/**
 * Gets a SINGLE fresh item (e.g., for PPDT Image).
 */
export async function getNewTestContent(testType) {
    const catalog = await fetchContentCatalog(testType);
    if (!catalog || catalog.length === 0) throw new Error("Content catalog is empty.");

    let seenIds = [];
    if (auth && auth.currentUser) {
        seenIds = await getUserSeenHistory(auth.currentUser.uid, testType);
    }

    // Filter out seen items
    const available = catalog.filter(item => !seenIds.includes(item.id));

    if (available.length === 0) {
        throw new Error("You have completed all available practice sets for this category!");
    }

    // Pick random
    const randomIndex = Math.floor(Math.random() * available.length);
    const selectedItem = available[randomIndex];

    // Resolve the full URL for the image
    if (selectedItem.path) {
        selectedItem.path = await resolveImagePath(selectedItem.path);
    }

    return selectedItem;
}

/**
 * Gets a BATCH of fresh items (e.g., for OIR Questions).
 */
export async function getUnseenBatch(testType, count = 30) {
    const catalog = await fetchContentCatalog(testType);
    
    let seenIds = [];
    if (auth && auth.currentUser) {
        seenIds = await getUserSeenHistory(auth.currentUser.uid, testType);
    }

    const available = catalog.filter(item => !seenIds.includes(item.id));
    
    // Shuffle
    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }

    let result = available.slice(0, count);
    
    // Fill with seen items if we run out
    if (result.length < count) {
        const needed = count - result.length;
        const seenItems = catalog.filter(item => seenIds.includes(item.id));
        // Shuffle seen
        for (let i = seenItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [seenItems[i], seenItems[j]] = [seenItems[j], seenItems[i]];
        }
        result = result.concat(seenItems.slice(0, needed));
    }

    return result;
}

/**
 * Marks content as seen in Firestore.
 */
export async function markContentAsSeen(testType, contentIds) {
    if (!auth || !auth.currentUser) return;
    if (!contentIds) return;

    const idsToSave = Array.isArray(contentIds) ? contentIds : [contentIds];
    if (idsToSave.length === 0) return;

    try {
        const docRef = doc(db, 'artifacts', APP_ID, 'users', auth.currentUser.uid, 'history', testType);
        await setDoc(docRef, {
            seenIds: arrayUnion(...idsToSave),
            lastUpdated: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.error("Failed to update history:", e);
    }
}
