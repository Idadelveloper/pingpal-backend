const express = require('express');
const router = express.Router();
const redisClient = require('../config/redisClient');
const { db } = require('../config/firebaseConfig');

// Middleware to ensure user is still part of the trail
const checkMembership = async (req, res, next) => {
    const { trailId, userId } = req.body; // or req.query

    // 1. Check Firestore Trail Document
    const trailDoc = await db.collection('ping_trails').doc(trailId).get();
    
    if (!trailDoc.exists) return res.status(404).send("Trail ended");
    
    const data = trailDoc.data();

    // 2. Check if user is in 'participants' list and status is 'accepted'
    const isMember = data.participants.some(p => p.userId === userId && p.status === 'accepted');

    if (!isMember) {
        return res.status(403).send("You are no longer part of this PingTrail");
    }

    next(); // User is valid, proceed to chat
};

// 1. SEND MESSAGE (Write)
router.post('/send', checkMembership, async (req, res) => {
    const { trailId, userId, message } = req.body;

    const chatKey = `chat:${trailId}`;
    const msgData = JSON.stringify({
        id: Date.now().toString(),
        userId,
        text: message,
        timestamp: Date.now()
    });

    try {
        // Push to Redis List (Right Push)
        await redisClient.rPush(chatKey, msgData);
        
        // Set Expiration for the whole CHAT, not the message.
        // Logic: Expires 24 hours after last message, or handle via "End Trail" logic.
        await redisClient.expire(chatKey, 86400); 

        res.status(200).send("Message Sent");
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// 2. GET MESSAGES (Read)
router.get('/:trailId', checkMembership, async (req, res) => {
    const { trailId } = req.params;
    const chatKey = `chat:${trailId}`;

    try {
        // Get all messages from the list
        const messages = await redisClient.lRange(chatKey, 0, -1);
        
        // Parse them back to JSON
        const parsedMessages = messages.map(msg => JSON.parse(msg));
        
        res.json(parsedMessages);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// 3. ARCHIVE & END CHAT
router.delete('/:trailId', async (req, res) => {
    const { trailId } = req.params;
    const chatKey = `chat:${trailId}`;

    try {
        // Step A: Fetch all messages from Redis RAM
        const messages = await redisClient.lRange(chatKey, 0, -1);

        if (messages.length > 0) {
            console.log(`Archiving ${messages.length} messages for trail ${trailId}...`);
            
            // Step B: Prepare a Firestore Batch Write (Efficient)
            const batch = db.batch();
            const archiveRef = db.collection('ping_trails').doc(trailId).collection('chat_archive');

            messages.forEach((msgString) => {
                const msg = JSON.parse(msgString);
                // Create a new doc for each message using its unique ID
                const docRef = archiveRef.doc(msg.id.toString());
                batch.set(docRef, msg);
            });

            // Step C: Commit to Database
            await batch.commit();
            console.log("Archive complete.");
        }

        // Step D: Delete from Redis
        await redisClient.del(chatKey);

        res.status(200).send({ status: "Chat archived and closed", count: messages.length });

    } catch (e) {
        console.error("Error ending chat:", e);
        res.status(500).send("Failed to archive chat");
    }
});

module.exports = router;