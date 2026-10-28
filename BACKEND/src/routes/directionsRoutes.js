// Registers walking-route endpoints and delegates request handling to controllers.
const express = require('express');
const { createRoutes } = require('../controllers/routesController');

const router = express.Router();

router.post('/routes', createRoutes);

module.exports = router;
