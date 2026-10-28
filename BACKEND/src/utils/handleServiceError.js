const SERVICE_ERRORS = {
  MISSING_API_KEY: [500, 'HEIGIT_API_KEY is not configured'],
  GEOCODING_FAILED: [502, 'Geocoding request failed'],
  DIRECTIONS_FAILED: [502, 'Walking directions request failed'],
};

function sendServiceError(res, error) {
  const serviceError = SERVICE_ERRORS[error.code];
  if (serviceError) {
    const [status, message] = serviceError;
    return res.status(status).json({ error: message });
  }

  console.error(`SafeRoute request failed: ${error.name}`);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { sendServiceError };
