// Gets walking alternatives from the provider; SafeRoute will handle safety ranking.
const DIRECTIONS_URL =
  'https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson';

async function getWalkingDirections(start, destination) {
  const apiKey = process.env.HEIGIT_API_KEY;

  if (!apiKey) {
    const error = new Error('HEIGIT_API_KEY is not set');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  let response;
  try {
    // Use the foot-walking profile; keep credentials in the environment, not source.
    response = await fetch(DIRECTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // GeoJSON/ORS routing requests use [longitude, latitude] coordinate order.
      coordinates: [
        [start.longitude, start.latitude],
        [destination.longitude, destination.latitude],
      ],
      alternative_routes: {
        target_count: 3,
        share_factor: 0.6,
        weight_factor: 1.6,
      },
    }),
    });
  } catch {
    const error = new Error('HeiGIT directions request failed');
    error.code = 'DIRECTIONS_FAILED';
    throw error;
  }

  if (!response.ok) {
    const error = new Error('HeiGIT directions request failed');
    error.code = 'DIRECTIONS_FAILED';
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error('HeiGIT returned an invalid directions response');
    error.code = 'DIRECTIONS_FAILED';
    throw error;
  }

  const routes = Array.isArray(data.features)
    ? data.features.map((feature, index) => ({
      id: index + 1,
      index,
      distanceMeters: feature.properties?.summary?.distance ?? null,
      durationSeconds: feature.properties?.summary?.duration ?? null,
      geometry: feature.geometry ?? null,
      startCoordinates: [start.longitude, start.latitude],
      destinationCoordinates: [destination.longitude, destination.latitude],
    }))
    : [];

  return routes;
}

module.exports = { getWalkingDirections };
