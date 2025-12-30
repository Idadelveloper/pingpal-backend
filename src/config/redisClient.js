const redis = require('redis');
require('dotenv').config();

// Use environment variables or default to localhost
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

const client = redis.createClient({
    url: `redis://${redisHost}:${redisPort}`
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log(`Connected to Redis at ${redisHost}`));

// Connect immediately
(async () => {
    await client.connect();
})();

// CRITICAL: You must export the client so other files can use it!
module.exports = client;