import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import { HttpError } from '../utils/httpError.js';

// face-api ships CommonJS builds for Node. The WASM build runs TensorFlow in WebAssembly,
// so there is no native TensorFlow binary to compile (works the same on Windows, macOS, Linux).
const require = createRequire(import.meta.url);
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
require('@tensorflow/tfjs-backend-wasm'); // registers the 'wasm' backend with TensorFlow.js

const MODEL_DIR = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');

// Longest side of stored and analysed images. Webcam frames are usually smaller than this already.
const MAX_SIDE = 800;

const detectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 5 });

let modelsReady;

/** Load the detector, landmark and recognition models once. Safe to call repeatedly. */
export function initFaceModels() {
  modelsReady ??= (async () => {
    await faceapi.tf.setBackend('wasm');
    await faceapi.tf.ready();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_DIR),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_DIR),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR),
    ]);
  })();
  return modelsReady;
}

function labelFor(angle) {
  return angle ? `${angle[0].toUpperCase()}${angle.slice(1)} image` : 'Image';
}

/**
 * Applies EXIF rotation, shrinks large photos and re-encodes as JPEG.
 * The result is what we store on disk and what we run detection on.
 */
export async function normalizeImage(buffer, angle) {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    throw new HttpError(400, `${labelFor(angle)}: could not read the file. Use a JPG, PNG or WebP image.`, {
      angle,
    });
  }
}

async function toTensor(jpegBuffer) {
  const { data, info } = await sharp(jpegBuffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return faceapi.tf.tensor3d(data, [info.height, info.width, 3], 'int32');
}

/**
 * Detects exactly one face in a normalized image and returns its 128-number descriptor.
 * Throws a 422 HttpError when there is no face or more than one.
 */
export async function extractFace(jpegBuffer, angle) {
  await initFaceModels();
  const tensor = await toTensor(jpegBuffer);
  try {
    const detections = await faceapi
      .detectAllFaces(tensor, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      const hint =
        angle === 'left' || angle === 'right'
          ? ' Turn your head only part of the way (about 30°) so both eyes stay visible.'
          : ' Face the camera in good light and fill more of the frame.';
      throw new HttpError(422, `${labelFor(angle)}: no face detected.${hint}`, { angle, code: 'NO_FACE' });
    }
    if (detections.length > 1) {
      throw new HttpError(422, `${labelFor(angle)}: more than one face detected. Only one person should be in frame.`, {
        angle,
        code: 'MULTIPLE_FACES',
      });
    }

    const [face] = detections;
    return {
      descriptor: Array.from(face.descriptor),
      detectionScore: Math.round(face.detection.score * 1000) / 1000,
    };
  } finally {
    tensor.dispose();
  }
}
