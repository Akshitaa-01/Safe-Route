// Resolves user-entered places before requesting provider-generated alternatives.
const { geocodePlace } = require('../services/geocoding');
const { getWalkingDirections } = require('../services/heigit');
const { getSafetyPointsAlongRoute } = require('../services/safetyAnalysis');
const { calculateSafetyScore } = require('../services/safetyScore');
const { sendServiceError } = require('../utils/handleServiceError');

function calculateTimeScore(fastestDuration, durationSeconds) {
  if (
    fastestDuration === null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  return Math.min(100, Math.round((100 * fastestDuration) / durationSeconds));
}

function calculateFinalScore(
  safetyScore,
  timeScore,
  safetyWeight,
  timeWeight,
) {
  if (!Number.isFinite(safetyScore) || !Number.isFinite(timeScore)) {
    return null;
  }

  return Math.round(safetyWeight * safetyScore + timeWeight * timeScore);
}

function rankRoutes(routes) {
  const sortedRoutes = [...routes].sort((first, second) => {
    const firstHasScore = Number.isFinite(first.finalScore);
    const secondHasScore = Number.isFinite(second.finalScore);
    if (!firstHasScore) return secondHasScore ? 1 : 0;
    if (!secondHasScore) return -1;
    return second.finalScore - first.finalScore;
  });

  let rank = 0;
  let hasRecommendedRoute = false;
  return sortedRoutes.map((route) => {
    if (!Number.isFinite(route.finalScore)) {
      return { ...route, rank: null, recommended: false };
    }

    rank += 1;
    const recommended = !hasRecommendedRoute;
    hasRecommendedRoute ||= recommended;
    return { ...route, rank, recommended };
  });
}

function toPublicRoute(route) {
  return {
    id: route.id,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    geometry: route.geometry,
    safetyScore: route.safetyScore,
    safetyMetrics: route.safetyMetrics,
    timeScore: route.timeScore,
    finalScore: route.finalScore,
    rank: route.rank,
    recommended: route.recommended,
  };
}

async function createRoutes(req, res) {
  const startQuery =
    typeof req.body?.start === 'string' ? req.body.start.trim() : '';
  const destinationQuery =
    typeof req.body?.destination === 'string'
      ? req.body.destination.trim()
      : '';
  const requestedSafetyWeight = req.body?.safetyWeight;

  if (
    requestedSafetyWeight !== undefined &&
    (typeof requestedSafetyWeight !== 'number' ||
      !Number.isFinite(requestedSafetyWeight) ||
      requestedSafetyWeight < 0 ||
      requestedSafetyWeight > 1)
  ) {
    return res.status(400).json({
      error: 'safetyWeight must be a number between 0 and 1',
    });
  }

  const safetyWeight = requestedSafetyWeight ?? 0.5;
  const timeWeight = 1 - safetyWeight;

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

    const walkingRoutes = await getWalkingDirections(start, destination);
    const validDurations = walkingRoutes
      .map((route) => route.durationSeconds)
      .filter((duration) => Number.isFinite(duration) && duration > 0);
    const fastestDuration =
      validDurations.length > 0 ? Math.min(...validDurations) : null;
    const routesWithSafetyPoints = await Promise.all(
      walkingRoutes.map(async (route) => {
        const { matchedPoints } = await getSafetyPointsAlongRoute(route.geometry);
        const { safetyScore, metrics } = calculateSafetyScore(matchedPoints);
        const timeScore = calculateTimeScore(
          fastestDuration,
          route.durationSeconds,
        );

        return {
          ...route,
          matchedSafetyPoints: matchedPoints,
          safetyScore,
          safetyMetrics: metrics,
          timeScore,
          finalScore: calculateFinalScore(
            safetyScore,
            timeScore,
            safetyWeight,
            timeWeight,
          ),
        };
      }),
    );
    const routes = rankRoutes(routesWithSafetyPoints).map(toPublicRoute);

    return res.json({
      profile: 'foot-walking',
      start,
      destination,
      weights: { safety: safetyWeight, time: timeWeight },
      routes,
    });
  } catch (error) {
    return sendServiceError(res, error);
  }
}

module.exports = { createRoutes };
