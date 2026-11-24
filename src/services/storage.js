import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

// Paths stored in MongoDB are relative to the uploads folder and use forward slashes,
// e.g. "users/665f.../front.jpg". They are served at /uploads/<path>.

const absolute = (relativePath) => path.join(config.uploadsDir, ...relativePath.split('/'));

export async function saveImage(relativePath, buffer) {
  const file = absolute(relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
}

export async function removePath(relativePath) {
  await fs.rm(absolute(relativePath), { recursive: true, force: true });
}

export const toUrl = (relativePath) => (relativePath ? `/uploads/${relativePath}` : null);
