import { Router } from 'express';
import { config } from '../config.js';
import { upload } from '../middleware/upload.js';
import { Attendance } from '../models/Attendance.js';
import { User } from '../models/User.js';
import { extractFace, normalizeImage } from '../services/face.js';
import { compareWithFaces, toSimilarity } from '../services/match.js';
import { removePath, saveImage, toUrl } from '../services/storage.js';
import { HttpError } from '../utils/httpError.js';

export const attendanceRouter = Router();

/**
 * POST /api/attendance/verify
 * multipart/form-data: identifier (email or employee ID), image
 *
 * Compares the captured face with the employee's stored front/left/right faces.
 * Always returns the match scores; records attendance only when the face matches.
 */
attendanceRouter.post('/verify', upload.single('image'), async (req, res) => {
  const identifier = String(req.body?.identifier ?? '').trim();
  if (!identifier) {
    throw new HttpError(400, 'Enter your email or employee ID.', {
      fields: { identifier: 'Enter your email or employee ID.' },
    });
  }
  if (!req.file) {
    throw new HttpError(400, 'Capture or upload a photo of your face.');
  }

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { empId: identifier.toUpperCase() }],
  });
  if (!user) {
    throw new HttpError(404, 'No employee is registered with that email or employee ID.', {
      fields: { identifier: 'Not registered.' },
    });
  }

  const image = await normalizeImage(req.file.buffer);
  const { descriptor } = await extractFace(image);
  const result = compareWithFaces(descriptor, user.faces, config.matchThreshold);

  let attendance = null;
  if (result.matched) {
    const record = new Attendance({
      user: user._id,
      similarity: result.similarity,
      distance: result.distance,
      matchedAngle: result.bestAngle,
    });
    record.imagePath = `attendance/${record.id}.jpg`;
    try {
      await saveImage(record.imagePath, image);
      await record.save();
    } catch (err) {
      await removePath(record.imagePath);
      throw err;
    }
    attendance = { id: record.id, markedAt: record.createdAt };
  }

  const storedImages = Object.fromEntries(user.faces.map((face) => [face.angle, toUrl(face.imagePath)]));

  res.json({
    matched: result.matched,
    similarity: result.similarity,
    distance: result.distance,
    bestAngle: result.bestAngle,
    comparisons: result.comparisons.map((c) => ({ ...c, imageUrl: storedImages[c.angle] })),
    threshold: { distance: config.matchThreshold, similarity: toSimilarity(config.matchThreshold) },
    user: user.toPublic(),
    attendance,
  });
});

/** GET /api/attendance?limit=50 — most recent check-ins first. */
attendanceRouter.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
  const records = await Attendance.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'username email empId')
    .lean();

  res.json({
    records: records.map((r) => ({
      id: r._id,
      markedAt: r.createdAt,
      similarity: r.similarity,
      distance: r.distance,
      matchedAngle: r.matchedAngle,
      imageUrl: toUrl(r.imagePath),
      user: r.user ? { username: r.user.username, email: r.user.email, empId: r.user.empId } : null,
    })),
  });
});
