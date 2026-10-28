const mongoose = require('mongoose');

async function connectDB() {
  const  MONGODB_URI  = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');
}

module.exports = connectDB;
