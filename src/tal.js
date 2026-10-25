// Tal's shape in JavaScript: the same height function the GPU bakes into Tal's maps (MOON_H in
// shaders.js), so terrain meshes, collision and radar altitude match what you see from orbit.
// Directions are unit vectors in Tal's body frame (the frame of W.moon). No DOM, so a worker can use it.
import {TAL_SEED, TAL_RELIEF} from './config.js';
import {fbm, craters} from './noise.js';

const [sx, sy, sz] = TAL_SEED;

// Height as the bake stores it (dimensionless, before 16-bit encoding). Mirrors MOON_H.
export function talBase(x, y, z) {
  const h = fbm(x * 1.8 + sx, y * 1.8 + sy, z * 1.8 + sz, 6) * 0.25
    + craters(x * 3 + sx, y * 3 + sy, z * 3 + sz, 0.5) * 0.8
    + craters(x * 7 + sx * 1.7, y * 7 + sy * 1.7, z * 7 + sz * 1.7, 0.6) * 0.45
    + craters(x * 16 + sx * 2.3, y * 16 + sy * 2.3, z * 16 + sz * 2.3, 0.7) * 0.22
    + craters(x * 38, y * 38, z * 38, 0.75) * 0.1;
  return h * 0.6;
}

// Ground height in metres above Tal's mean radius (MOON_R) for a unit direction.
export const talHeight = (x, y, z) => talBase(x, y, z) * TAL_RELIEF;
