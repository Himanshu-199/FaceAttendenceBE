import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';
import { Attendance } from './models/Attendance.js';
import { User } from './models/User.js';
import { initFaceModels } from './services/face.js';

async function start() {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    console.error(`Could not connect to MongoDB at ${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
    console.error(`  ${err.message}`);
    console.error('  Set MONGO_URI in BE/.env (see .env.example) and make sure MongoDB is running.');
    process.exit(1);
  }
  // Build the unique indexes (username, email, empId) before accepting registrations.
  await Promise.all([User.init(), Attendance.init()]);

  console.log('Loading face recognition models...');
  await initFaceModels();

  createApp().listen(config.port, () => {
    console.log(`API ready on http://localhost:${config.port} (match threshold ${config.matchThreshold})`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
