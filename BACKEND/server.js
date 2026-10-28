require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`SafeRoute API listening on port ${port}`);
    });
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.name}`);
    console.error('Check MONGODB_URI and confirm the database is reachable.');
    process.exitCode = 1;
  }
}

startServer();
