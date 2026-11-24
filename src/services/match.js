export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/** Similarity as a percentage with one decimal: distance 0 → 100%, distance ≥ 1 → 0%. */
export function toSimilarity(distance) {
  return Math.round(Math.max(0, Math.min(1, 1 - distance)) * 1000) / 10;
}

const round4 = (n) => Math.round(n * 10000) / 10000;

/**
 * Compares one probe descriptor with each stored face of a user.
 * The best (closest) stored angle decides the overall result, since the probe is a single pose.
 */
export function compareWithFaces(probe, faces, threshold) {
  const comparisons = faces.map((face) => {
    const distance = euclideanDistance(probe, face.descriptor);
    return { angle: face.angle, distance: round4(distance), similarity: toSimilarity(distance) };
  });
  const best = comparisons.reduce((a, b) => (b.distance < a.distance ? b : a));
  return {
    matched: best.distance <= threshold,
    similarity: best.similarity,
    distance: best.distance,
    bestAngle: best.angle,
    comparisons,
  };
}

/** Smallest distance between any of `descriptors` and any stored face of `faces`. */
export function closestDistance(descriptors, faces) {
  let min = Infinity;
  for (const d of descriptors) {
    for (const face of faces) {
      min = Math.min(min, euclideanDistance(d, face.descriptor));
    }
  }
  return min;
}
