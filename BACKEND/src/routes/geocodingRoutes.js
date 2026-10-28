// Registers place-geocoding endpoints and delegates request handling to controllers.
const express = require('express');
const { geocode } = require('../controllers/geocodingController');

const router = express.Router();

router.get('/geocode', geocode);

module.exports = router;
