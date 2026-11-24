import { Router } from 'express';
import { ANGLES, config } from '../config.js';
import { upload } from '../middleware/upload.js';
import { User } from '../models/User.js';
import { extractFace, normalizeImage } from '../services/face.js';
import { closestDistance, euclideanDistance } from '../services/match.js';
import { removePath, saveImage } from '../services/storage.js';
import { HttpError } from '../utils/httpError.js';
import { validateRegistration } from '../utils/validate.js';

export const usersRouter = Router();

async function findTakenFields({ username, email, empId }) {
  const existing = await User.find({ $or: [{ username }, { email }, { empId }] }, 'username email empId').lean();
  const fields = {};
  for (const user of existing) {
    if (user.username === username) fields.username = 'This username is already taken.';
    if (user.email === email) fields.email = 'This email is already registered.';
    if (user.empId === empId) fields.empId = 'This employee ID is already registered.';
  }
  return fields;
}

/** Returns the registered user whose face is within the match threshold of any new descriptor. */
async function findUserWithSameFace(descriptors) {
  const users = await User.find({}, 'empId faces.angle faces.descriptor').lean();
  return users.find((user) => closestDistance(descriptors, user.faces) <= config.matchThreshold) ?? null;
}

/**
 * POST /api/users/register
 * multipart/form-data: username, email, empId, front, left, right (images)
 */
usersRouter.post(
  '/register',
  upload.fields(ANGLES.map((name) => ({ name, maxCount: 1 }))),
  async (req, res) => {
    const { values, fields } = validateRegistration(req.body);
    if (Object.keys(fields).length > 0) {
      throw new HttpError(400, 'Please fix the highlighted fields.', { fields });
    }

    const taken = await findTakenFields(values);
    if (Object.keys(taken).length > 0) {
      throw new HttpError(409, 'Some details are already registered.', { fields: taken });
    }

    const missing = ANGLES.filter((angle) => !req.files?.[angle]?.[0]);
    if (missing.length > 0) {
      throw new HttpError(400, `Missing face image: ${missing.join(', ')}.`, { angle: missing[0] });
    }

    // Detect sequentially: face detection is CPU-bound, so parallel calls would not be faster.
    const faces = [];
    for (const angle of ANGLES) {
      const image = await normalizeImage(req.files[angle][0].buffer, angle);
      const { descriptor, detectionScore } = await extractFace(image, angle);
      faces.push({ angle, image, descriptor, detectionScore });
    }

    // All three photos must show the same person.
    const [front, ...sides] = faces;
    for (const side of sides) {
      if (euclideanDistance(front.descriptor, side.descriptor) > config.samePersonThreshold) {
        throw new HttpError(
          422,
          `The ${side.angle} image doesn't look like the same person as the front image. Retake it.`,
          { angle: side.angle, code: 'DIFFERENT_PERSON' },
        );
      }
    }

    // One person must not hold two employee records.
    const duplicate = await findUserWithSameFace(faces.map((f) => f.descriptor));
    if (duplicate) {
      throw new HttpError(409, `This face is already registered under employee ID ${duplicate.empId}.`, {
        angle: 'front',
        code: 'FACE_ALREADY_REGISTERED',
      });
    }

    const user = new User(values);
    const folder = `users/${user.id}`;
    user.faces = faces.map((f) => ({
      angle: f.angle,
      imagePath: `${folder}/${f.angle}.jpg`,
      descriptor: f.descriptor,
      detectionScore: f.detectionScore,
    }));

    try {
      await Promise.all(faces.map((f) => saveImage(`${folder}/${f.angle}.jpg`, f.image)));
      await user.save();
    } catch (err) {
      await removePath(folder);
      throw err;
    }

    res.status(201).json({ user: user.toPublic() });
  },
);
