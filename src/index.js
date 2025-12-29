const express = require('express');
const cors = require('cors');
const locationRoutes = require('./routes/locationRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/location', locationRoutes);

// Health Check (for Kubernetes Readiness Probes)
app.get('/', (req, res) => {
    res.send('PingPal Backend is Running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});