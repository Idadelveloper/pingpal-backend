const express = require('express');
const router = express.Router();
const redisClient = require('../config/redisClient');
const { db } = require('../config/firebaseConfig');
const { getAdaptiveTTL } = require('../utils/adaptiveCache');

// 1. UPDATE LOCATION (Write Path)
router.post('/update', async (req, res) => {
    const { userId, latitude, longitude, networkType } = req.body;

    if (!userId || !latitude || !longitude) {
        return res.status(400).send("Missing fields");
    }

    const locationData = JSON.stringify({
        lat: latitude,
        lng: longitude,
        timestamp: Date.now()
    });

    // Adaptive Logic: Calculate TTL based on network
    const ttl = getAdaptiveTTL(networkType);

    try {
        // Cache Write (Fast)
        await redisClient.set(userId, locationData, { EX: ttl });
        
        // Database Write (Slow - Async)
        // We don't await this so the user gets a response instantly
        db.collection('locations').doc(userId).set({
            latitude,
            longitude,
            timestamp: new Date()
        }).catch(err => console.error("Firestore Error:", err));

        res.json({ status: "success", ttl_applied: ttl });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// 2. GET LOCATION (Read Path)
router.get('/:friendId', async (req, res) => {
    const { friendId } = req.params;

    try {
        // Step A: Check Redis Cache
        const cachedData = await redisClient.get(friendId);
        if (cachedData) {
            console.log(`Cache HIT: ${friendId}`);
            return res.json(JSON.parse(cachedData));
        }

        // Step B: Cache Miss -> Check Firestore
        console.log(`Cache MISS: ${friendId}`);
        const doc = await db.collection('locations').doc(friendId).get();
        
        if (!doc.exists) {
            return res.status(404).send("Location not found");
        }

        const data = doc.data();
        const responsePayload = {
            lat: data.latitude,
            lng: data.longitude,
            timestamp: data.timestamp
        };

        // Step C: Update Cache (Default safe TTL since we don't know the friend's network)
        await redisClient.set(friendId, JSON.stringify(responsePayload), { EX: 60 });

        res.json(responsePayload);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

module.exports = router;