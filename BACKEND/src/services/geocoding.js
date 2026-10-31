// Resolves human-readable places through the openrouteservice geocoding API.
const GEOCODING_URL = 'https://api.openrouteservice.org/geocode/search';
const DELHI_FOCUS = { latitude: 28.6139, longitude: 77.209 };
const DELHI_BOUNDARY = {
  minLatitude: 28.4,
  minLongitude: 76.84,
  maxLatitude: 28.89,
  maxLongitude: 77.35,
};
const MIN_CONFIDENCE = 0.5;
const GENERIC_PLACE_TERMS = new Set([
  'at',
  'in',
  'near',
  'the',
  'metro',
  'station',
  'road',
  'rd',
  'street',
  'st',
  'lane',
  'marg',
]);

function queryPlaceTerms(query) {
  const placeName = query.split(',')[0];

  return placeName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((term) => term && !GENERIC_PLACE_TERMS.has(term));
}

function textTerms(value) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function isWithinDelhi(feature) {
  const [longitude, latitude] = feature.geometry?.coordinates ?? [];
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= DELHI_BOUNDARY.minLongitude &&
    longitude <= DELHI_BOUNDARY.maxLongitude &&
    latitude >= DELHI_BOUNDARY.minLatitude &&
    latitude <= DELHI_BOUNDARY.maxLatitude
  );
}

function resultRelevance(feature, placeTerms) {
  const properties = feature.properties ?? {};
  const countryCode =
    typeof properties.country_a === 'string'
      ? properties.country_a.toUpperCase()
      : '';
  const country =
    typeof properties.country === 'string'
      ? properties.country.toLowerCase()
      : '';
  const isIndia =
    countryCode === 'IND' || countryCode === 'IN' || country === 'india';
  const confidence = properties.confidence;

  if (
    !isIndia ||
    !isWithinDelhi(feature) ||
    !Number.isFinite(confidence) ||
    confidence < MIN_CONFIDENCE
  ) {
    return null;
  }

  const searchableTerms = new Set(
    [properties.name, properties.label]
    .filter((value) => typeof value === 'string')
      .flatMap(textTerms),
  );
  const matchedTerms = placeTerms.filter((term) =>
    searchableTerms.has(term),
  ).length;
  const queryMatch = matchedTerms / placeTerms.length;

  if (queryMatch < 0.75) {
    return null;
  }

  const layer = properties.layer;
  const layerPreference =
    layer === 'venue'
      ? 0.1
      : layer === 'address'
        ? 0.05
        : layer === 'street'
          ? -0.05
          : layer === 'locality'
            ? -0.1
            : 0;

  return confidence * 0.55 + queryMatch * 0.35 + layerPreference;
}

function removeMetroQualifier(query) {
  return query
    .replace(/\bmetro(?:\s+station)?\b/gi, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/^,|,$/g, '')
    .trim();
}

async function geocodeQuery(query, apiKey) {
  const url = new URL(GEOCODING_URL);
  // The provider can return ambiguous matches for "Delhi"; this suffix targets New Delhi.
  const searchText = query.replace(
    /,\s*Delhi(?:,\s*India)?$/i,
    ', New Delhi, India',
  );
  url.searchParams.set('text', searchText);
  url.searchParams.set('size', '10');
  url.searchParams.set('boundary.country', 'IND');
  url.searchParams.set(
    'boundary.rect.min_lat',
    String(DELHI_BOUNDARY.minLatitude),
  );
  url.searchParams.set(
    'boundary.rect.min_lon',
    String(DELHI_BOUNDARY.minLongitude),
  );
  url.searchParams.set(
    'boundary.rect.max_lat',
    String(DELHI_BOUNDARY.maxLatitude),
  );
  url.searchParams.set(
    'boundary.rect.max_lon',
    String(DELHI_BOUNDARY.maxLongitude),
  );
  url.searchParams.set('focus.point.lat', String(DELHI_FOCUS.latitude));
  url.searchParams.set('focus.point.lon', String(DELHI_FOCUS.longitude));

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

  const placeTerms = queryPlaceTerms(query);
  if (placeTerms.length === 0) {
    return null;
  }

  const feature = Array.isArray(data.features)
    ? data.features
        .map((candidate) => ({
          candidate,
          relevance: resultRelevance(candidate, placeTerms),
        }))
        .filter((result) => result.relevance !== null)
        .sort((first, second) => second.relevance - first.relevance)[0]
        ?.candidate ?? null
    : null;
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

async function geocodePlace(query) {
  const apiKey = process.env.HEIGIT_API_KEY;

  if (!apiKey) {
    const error = new Error('HEIGIT_API_KEY is not set');
    error.code = 'MISSING_API_KEY';
    throw error;
  }

  const originalResult = await geocodeQuery(query, apiKey);
  if (originalResult) {
    return originalResult;
  }

  const fallbackQuery = removeMetroQualifier(query);
  if (fallbackQuery === query) {
    return null;
  }

  return geocodeQuery(fallbackQuery, apiKey);
}

module.exports = { geocodePlace };
