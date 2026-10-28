// Stores curated locations as points so nearby-route lookups can use MongoDB geospatial queries.
const mongoose = require('mongoose');

const safetyPointSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        // GeoJSON and MongoDB geospatial queries require [longitude, latitude].
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) =>
            coordinates.length === 2 &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90,
          message:
            'Location coordinates must be [longitude, latitude] within valid ranges',
        },
      },
    },
    lighting: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    footTraffic: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    incidentRisk: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    emergencyProximity: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

safetyPointSchema.index({ location: '2dsphere' });

module.exports =
  mongoose.models.SafetyPoint ||
  mongoose.model('SafetyPoint', safetyPointSchema);
