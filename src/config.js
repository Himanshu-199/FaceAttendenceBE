import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function number(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number, got "${raw}"`);
  return value;
}

export const config = {
  port: number('PORT', 4000),
  mongoUri: process.env.MONGO_URI || '',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Face descriptors are 128-number vectors; we compare them by Euclidean distance.
  // Lower distance = more similar. Similarity % shown in the UI is (1 - distance) * 100.
  //
  // MATCH_THRESHOLD: the most distance allowed for an attendance check to count as a match.
  // face-api's default is 0.6, but in testing different people scored as close as 0.46,
  // so 0.45 (= 55% similarity) is the default here. Tune it with your own camera and lighting.
  matchThreshold: number('MATCH_THRESHOLD', 0.45),
  // SAME_PERSON_THRESHOLD: at registration, the left/right images must be at most this far from
  // the front image. Looser than the match threshold because head turns raise the distance.
  samePersonThreshold: number('SAME_PERSON_THRESHOLD', 0.6),

  uploadsDir: path.join(rootDir, 'uploads'),
  maxImageBytes: number('MAX_IMAGE_MB', 5) * 1024 * 1024,
};

export const ANGLES = ['front', 'left', 'right'];
