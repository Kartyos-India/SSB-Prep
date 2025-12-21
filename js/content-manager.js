// js/content-manager.js
import { auth, db } from './firebase-app.js';
import { doc, getDoc, setDoc, arrayUnion, serverTimestamp, collection, getDocs } from './firebase-init.js';

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

/**
 * Fetches the catalog of content (images/questions).
 * Strategy: 
 * 1. Try fetching from Firestore (Dynamic Data from Admin Panel)
 * 2. If Firestore is empty/fails, fallback to local JSON (Static Data)
 */
async function fetchContentCatalog(type) {
    let catalog = [];

    // 1. Try Firestore First (Dynamic)
    try {
        if (db) {
            // Collection: artifacts/{appId}/public/data/{type}_catalog
            // Note: Admin saves to 'ppdt_catalog', so we construct the name dynamically
            const catalogName = `${type}_catalog`; 
            const catalogRef = collection(db, 'artifacts', APP_ID, 'public', 'data', catalogName);
            const snapshot = await getDocs(catalogRef);
            
            if (!snapshot.empty) {
                catalog = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`Loaded ${catalog.length} items from Firestore for ${type}`);
            }
        }
    } catch (e) {
        console.warn(`Firestore catalog fetch failed for ${type}, falling back to JSON.`, e);
    }

    // 2. If Firestore gave no results, load local JSON
    if (catalog.length === 0) {
        try {
            const response = await fetch(`data/${type}.json`);
            if (response.ok) {
                catalog = await response.json();
            }
        } catch (e) {
            console.warn(`Local JSON fetch error for ${type}:`, e);
        }
    }

    return catalog;
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
 * Helper to ensure the image path is a valid URL.
 */
function resolveImagePath(itemPath) {
    if (!itemPath) return '';
    // If it's a full URL (Drive link, Cloudinary, etc.), return as is.
    if (itemPath.startsWith('http://') || itemPath.startsWith('https://')) {
        return itemPath;
    }
    // If it's a relative path, assume it's in the public folder.
    return itemPath;
}

/**
 * Gets a SINGLE fresh item (e.g., for PPDT Image).
 */
export async function getNewTestContent(testType) {
    const catalog = await fetchContentCatalog(testType);
    
    if (!catalog || catalog.length === 0) {
        throw new Error("Content catalog is empty. Please add items via Admin Panel or JSON.");
    }

    let seenIds = [];
    if (auth && auth.currentUser) {
        seenIds = await getUserSeenHistory(auth.currentUser.uid, testType);
    }

    // Filter out seen items
    const available = catalog.filter(item => !seenIds.includes(item.id));

    if (available.length === 0) {
        throw new Error("You have completed all available practice sets! Check back later for new uploads.");
    }

    // Pick random
    const randomIndex = Math.floor(Math.random() * available.length);
    const selectedItem = available[randomIndex];

    // Resolve URL (Handle Google Drive links vs Local paths)
    if (selectedItem.path) {
        selectedItem.path = resolveImagePath(selectedItem.path);
    } else if (selectedItem.link) {
        // Handle case where JSON might use 'link' key instead of 'path'
        selectedItem.path = resolveImagePath(selectedItem.link);
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

    // Filter
    const available = catalog.filter(item => !seenIds.includes(item.id));
    
    // Shuffle (Fisher-Yates)
    for (let i = available.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [available[i], available[j]] = [available[j], available[i]];
    }

    let result = available.slice(0, count);
    
    // Fill with seen items if needed (to ensure we always return 'count' questions)
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
