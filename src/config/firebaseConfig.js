const admin = require('firebase-admin');
const path = require('path'); // Import the path module
require('dotenv').config();

// 1. Construct the absolute path to the key file
// process.cwd() gets the root folder where you run 'node'
// process.env.GOOGLE_APPLICATION_CREDENTIALS should be './serviceAccountKey.json'
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS 
    ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS) 
    : null;

if (keyPath) {
    try {
        // 2. Require the file using the absolute path
        const serviceAccount = require(keyPath);
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized");
    } catch (error) {
        console.error("ERROR: Could not load serviceAccountKey.json");
        console.error(`Checked path: ${keyPath}`);
        console.error(error.message);
    }
} else {
    console.warn("WARNING: Firebase credentials not found in .env");
}

const db = admin.firestore();
module.exports = { db };