import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { attendanceRouter } from './routes/attendance.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json());
  // Stored face images and check-in photos. Anyone who can reach the API can load these URLs.
  app.use('/uploads', express.static(config.uploadsDir));

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/users', usersRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  app.use(errorHandler);
  return app;
}
