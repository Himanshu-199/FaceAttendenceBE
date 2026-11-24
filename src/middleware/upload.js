import multer from 'multer';
import { ANGLES, config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Images are kept in memory: they are validated, resized and only then written to disk.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: ANGLES.length },
  fileFilter(req, file, cb) {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    const angle = ANGLES.includes(file.fieldname) ? file.fieldname : undefined;
    return cb(new HttpError(400, 'Only JPG, PNG or WebP images are allowed.', { angle }));
  },
});
