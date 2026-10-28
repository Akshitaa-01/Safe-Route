// Handles HTTP validation and response mapping for place geocoding.
const { geocodePlace } = require('../services/geocoding');
const { sendServiceError } = require('../utils/handleServiceError');

async function geocode(req, res) {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    return res.status(400).json({ error: 'A place query is required' });
  }

  try {
    const place = await geocodePlace(query);
    if (!place) {
      return res.status(404).json({ error: 'No matching place was found' });
    }

    return res.json(place);
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = { geocode };
