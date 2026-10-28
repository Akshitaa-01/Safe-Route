// Resolves user-entered places before requesting provider-generated alternatives.
const { geocodePlace } = require('../services/geocoding');
const { getWalkingDirections } = require('../services/heigit');
const { sendServiceError } = require('../utils/handleServiceError');

async function createRoutes(req, res) {
  const startQuery =
    typeof req.body?.start === 'string' ? req.body.start.trim() : '';
  const destinationQuery =
    typeof req.body?.destination === 'string'
      ? req.body.destination.trim()
      : '';

  if (!startQuery || !destinationQuery) {
    return res
      .status(400)
      .json({ error: 'Both start and destination are required' });
  }

  try {
    // Geocode both endpoints concurrently before passing coordinates to routing.
    const [start, destination] = await Promise.all([
      geocodePlace(startQuery),
      geocodePlace(destinationQuery),
    ]);

    if (!start) {
      return res.status(404).json({ error: 'Start location was not found' });
    }
    if (!destination) {
      return res
        .status(404)
        .json({ error: 'Destination location was not found' });
    }

    const routes = await getWalkingDirections(start, destination);
    return res.json({
      profile: 'foot-walking',
      start,
      destination,
      routes,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = { createRoutes };
