const express = require('express');
const geocodingRoutes = require('./routes/geocodingRoutes');
const directionsRoutes = require('./routes/directionsRoutes');

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SafeRoute API' });
});

app.use('/api', geocodingRoutes);
app.use('/api', directionsRoutes);

module.exports = app;