// Resolves human-readable places through the openrouteservice geocoding API.
const GEOCODING_URL = 'https://api.openrouteservice.org/geocode/search';

async function geocodePlace(query) {
  const apiKey = process.env.HEIGIT_API_KEY;

  if (!apiKey) {
    const error = new Error('HEIGIT_API_KEY is not set');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  const url = new URL(GEOCODING_URL);
  // The provider can return ambiguous matches for "Delhi"; this suffix targets New Delhi.
  const searchText = query.replace(
    /,\s*Delhi(?:,\s*India)?$/i,
    ', New Delhi, India',
  );
  url.searchParams.set('text', searchText);
  url.searchParams.set('size', '1');

  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: apiKey },
    });
  } catch {
    const error = new Error('HeiGIT geocoding request failed');
    error.code = 'GEOCODING_FAILED';
    throw error;
  }

  if (!response.ok) {
    const error = new Error('HeiGIT geocoding request failed');
    error.code = 'GEOCODING_FAILED';
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error('HeiGIT returned an invalid geocoding response');
    error.code = 'GEOCODING_FAILED';
    throw error;
  }

  const feature = data.features?.[0];
  if (!feature) {
    return null;
  }

  const coordinates = feature.geometry?.coordinates;
  // Convert GeoJSON [longitude, latitude] to the service's named coordinate fields.
  const [longitude, latitude] = coordinates ?? [];

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error('HeiGIT returned invalid geocoding coordinates');
    error.code = 'GEOCODING_FAILED';
    throw error;
  }

  return {
    name: feature.properties?.label ?? feature.properties?.name ?? query,
    latitude,
    longitude,
  };
}

module.exports = { geocodePlace };
