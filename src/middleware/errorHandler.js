import multer from 'multer';
import { ANGLES, config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

const FIELD_LABELS = { username: 'username', email: 'email', empId: 'employee ID' };

// Express 5 forwards errors thrown in async handlers here automatically.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.details });
  }

  if (err instanceof multer.MulterError) {
    const angle = ANGLES.includes(err.field) ? err.field : undefined;
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round(config.maxImageBytes / 1024 / 1024);
      return res.status(413).json({ error: `Image is too large. The limit is ${mb} MB.`, angle });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: `Unexpected file field "${err.field}".` });
    }
    return res.status(400).json({ error: err.message, angle });
  }

  // Unique index violation: two registrations raced past the pre-check.
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? err.keyPattern ?? {})[0];
    const label = FIELD_LABELS[field] ?? 'value';
    return res.status(409).json({
      error: `This ${label} is already registered.`,
      fields: field ? { [field]: `This ${label} is already registered.` } : undefined,
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
}
