const METRIC_NAMES = [
  'lighting',
  'footTraffic',
  'incidentRisk',
  'emergencyProximity',
];

function noSafetyData() {
  return { safetyScore: null, metrics: null };
}

function calculateSafetyScore(matchedSafetyPoints) {
  if (matchedSafetyPoints == null || matchedSafetyPoints.length === 0) {
    return noSafetyData();
  }

  if (!Array.isArray(matchedSafetyPoints)) {
    throw new TypeError('matchedSafetyPoints must be an array');
  }

  const totals = Object.fromEntries(METRIC_NAMES.map((name) => [name, 0]));

  matchedSafetyPoints.forEach((point, index) => {
    if (!point || typeof point !== 'object' || Array.isArray(point)) {
      throw new TypeError(`matchedSafetyPoints[${index}] must be an object`);
    }

    for (const name of METRIC_NAMES) {
      const value = point[name];
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new TypeError(
          `matchedSafetyPoints[${index}].${name} must be a number from 0 to 100`,
        );
      }

      totals[name] += value;
    }
  });

  const averages = Object.fromEntries(
    METRIC_NAMES.map((name) => [
      name,
      totals[name] / matchedSafetyPoints.length,
    ]),
  );
  const metrics = {
    lighting: averages.lighting,
    footTraffic: averages.footTraffic,
    incidentRisk: averages.incidentRisk,
    incidentSafety: 100 - averages.incidentRisk,
    emergencyProximity: averages.emergencyProximity,
  };

  
  const weightedScore =
    0.3 * metrics.lighting +
    0.25 * metrics.footTraffic +
    0.25 * metrics.incidentSafety +
    0.2 * metrics.emergencyProximity;

  return {
    safetyScore: Math.round(Math.min(100, Math.max(0, weightedScore))),
    metrics,
  };
}

module.exports = { calculateSafetyScore };
