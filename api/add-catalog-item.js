import admin from './_shared/admin.js';

// Helper to verify the user is logged in
async function verifyIdToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  try {
    // 1. Verify User is Logged In
    const uid = await verifyIdToken(req);
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    // 2. Parse Data
    const { items, collectionName, appId } = req.body;
    if (!items || !collectionName || !appId) {
      return res.status(400).json({ error: 'Missing required fields (items, collectionName, appId)' });
    }

    const itemsArray = Array.isArray(items) ? items : [items];
    const db = admin.firestore();
    
    // Path: artifacts/{appId}/public/data/{collectionName}
    const collectionRef = db.collection('artifacts').doc(appId)
                            .collection('public').doc('data')
                            .collection(collectionName);

    // 3. Write Data (Using Batch for efficiency)
    const batch = db.batch();
    
    itemsArray.forEach(item => {
      const docRef = collectionRef.doc(); // Auto-generate ID
      // Add server timestamp and active flag
      const data = {
        ...item,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        active: true,
        createdBy: uid
      };
      batch.set(docRef, data);
    });

    await batch.commit();

    return res.status(200).json({ success: true, count: itemsArray.length });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
