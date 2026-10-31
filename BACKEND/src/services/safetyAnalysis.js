const SafetyPoint = require('../models/SafetyPoint');

const PROXIMITY_RADIUS_METERS = 500;
const SAMPLE_SPACING_METERS = 250;
const QUERY_BATCH_SIZE = 10;
const EARTH_RADIUS_METERS = 6371008.8;

function invalidGeometry(message) {
  const error = new TypeError(message);
  error.code = 'INVALID_ROUTE_GEOMETRY';
  return error;
}

function distanceBetweenCoordinates(first, second) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const [firstLongitude, firstLatitude] = first;
  const [secondLongitude, secondLatitude] = second;
  const latitudeDifference = toRadians(secondLatitude - firstLatitude);
  const longitudeDifference = toRadians(secondLongitude - firstLongitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(firstLatitude)) *
      Math.cos(toRadians(secondLatitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function sampleRoute(coordinates) {
  const samples = [coordinates[0]];

  // Sampling along every segment catches points near route middles, not just endpoints.
  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1];
    const end = coordinates[index];
    const segmentDistance = distanceBetweenCoordinates(start, end);
    const steps = Math.max(
      1,
      Math.ceil(segmentDistance / SAMPLE_SPACING_METERS),
    );

    for (let step = 1; step <= steps; step += 1) {
      const fraction = step / steps;
      samples.push([
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ]);
    }
  }

  return samples;
}

async function getSafetyPointsAlongRoute(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    throw invalidGeometry('Route geometry is required');
  }

  if (geometry.type !== 'LineString') {
    throw invalidGeometry('Route geometry must be a GeoJSON LineString');
  }

  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    throw invalidGeometry('Route LineString coordinates must not be empty');
  }

  if (geometry.coordinates.length < 2) {
    throw invalidGeometry(
      'Route LineString must contain at least two coordinates',
    );
  }

  const coordinates = geometry.coordinates.map((coordinate) => {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1]) ||
      coordinate[0] < -180 ||
      coordinate[0] > 180 ||
      coordinate[1] < -90 ||
      coordinate[1] > 90
    ) {
      throw invalidGeometry(
        'Each route coordinate must contain valid [longitude, latitude] values',
      );
    }

    return [coordinate[0], coordinate[1]];
  });

  const samples = sampleRoute(coordinates);
  const matchedPoints = new Map();

  // MongoDB's 2dsphere index efficiently finds demo points within the radius of each sample.
  for (let index = 0; index < samples.length; index += QUERY_BATCH_SIZE) {
    const batch = samples.slice(index, index + QUERY_BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sample) =>
        SafetyPoint.find({
          location: {
            $near: {
              $geometry: { type: 'Point', coordinates: sample },
              $maxDistance: PROXIMITY_RADIUS_METERS,
            },
          },
        })
          .select(
            'name location lighting footTraffic incidentRisk emergencyProximity',
          )
          .lean(),
      ),
    );

    for (const points of results) {
      for (const point of points) {
        const id = point._id.toString();
        if (!matchedPoints.has(id)) {
          matchedPoints.set(id, {
            name: point.name,
            location: point.location,
            lighting: point.lighting,
            footTraffic: point.footTraffic,
            incidentRisk: point.incidentRisk,
            emergencyProximity: point.emergencyProximity,
          });
        }
      }
    }
  }

  // SafetyPoint metrics are simulated hackathon demo data, not official statistics.
  return { matchedPoints: Array.from(matchedPoints.values()) };
}

module.exports = { getSafetyPointsAlongRoute };
