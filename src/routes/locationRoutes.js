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

router.get('/trail/:trailId', async (req, res) => {
    const { trailId } = req.params;

    try {
        // 1. Get the Trail Info from Firestore (Session State)
        // Optimization: You could also cache the "participant list" in Redis 
        // to avoid hitting Firestore even here.
        const trailDoc = await db.collection('ping_trails').doc(trailId).get();
        
        if (!trailDoc.exists) return res.status(404).send("Trail not found");

        const trailData = trailDoc.data();
        
        // Filter only 'accepted' participants
        const participantIds = trailData.participants
            .filter(p => p.status === 'accepted')
            .map(p => p.userId);

        if (participantIds.length === 0) return res.json([]);

        // 2. Multi-Get from Redis (The Research Core)
        // We fetch ALL locations in one go. This is extremely fast.
        const locations = await redisClient.mGet(participantIds);

        // 3. Format Response
        const response = participantIds.map((uid, index) => {
            const locData = locations[index] ? JSON.parse(locations[index]) : null;
            return {
                userId: uid,
                location: locData // Will be null if cache expired (adaptive logic)
            };
        });

        res.json(response);

    } catch (e) {
        console.error(e);
        res.status(500).send("Server Error");
    }
}); 

module.exports = router;