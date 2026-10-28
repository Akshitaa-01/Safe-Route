// Replaces only the SafetyPoint collection with the curated demo dataset.
require('dotenv').config();

const mongoose = require('mongoose');
const SafetyPoint = require('../models/SafetyPoint');
const safetyData = require('./safetyData');

async function seedSafetyData() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const documents = safetyData.map((record) => new SafetyPoint(record));
    await Promise.all(documents.map((document) => document.validate()));

    await SafetyPoint.deleteMany({});
    const inserted = await SafetyPoint.insertMany(safetyData);
    console.log(`Seeded ${inserted.length} SafetyPoint records`);
  } finally {
    await mongoose.disconnect();
  }
}

seedSafetyData().catch((error) => {
  console.error(`Safety data seeding failed: ${error.name}`);
  process.exitCode = 1;
});
