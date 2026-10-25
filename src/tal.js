// Tal's shape in JavaScript: the same height function the GPU bakes into Tal's maps (MOON_H in
// shaders.js), so terrain meshes, collision and radar altitude match what you see from orbit.
// Directions are unit vectors in Tal's body frame (the frame of W.moon). No DOM, so a worker can use it.
import {MOON_R, TAL_SEED, TAL_RELIEF} from './config.js';
import {snoise, fbm, craters, bowls} from './noise.js';

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

// Detail below what the baked maps can show (their texels are about 5 km): bowl craters on grids of
// 20 km down to 200 m cells (craters about 9 km to 70 m across), and roughness from 3 km down to 40 m.
// JS only, so the view from orbit is unchanged.
const CRATER_CELLS = [20000, 8000, 3200, 1300, 520, 210], CRATER_DENSITY = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7];
const ROUGH_WAVES = [3000, 1300, 560, 240, 100, 42], ROUGH_SLOPE = 0.012;
const fade = (lo, hi, x) => { const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo))); return t * t * (3 - 2 * t); };

// spacing is the distance between terrain mesh vertices: detail too fine for it is left out (it
// would only alias) and fades in over a factor of about 3, so a chunk carries what it can draw.
// 0 means everything, for physics.
export function talDetail(x, y, z, spacing = 0) {
  let h = 0;
  for (let k = 0; k < CRATER_CELLS.length; k++) {
    const cell = CRATER_CELLS[k], w = spacing ? fade(1.2, 3.5, cell * 0.3 / spacing) : 1; if (w === 0) break;
    const f = MOON_R / cell, o = 37.1 * (k + 1);
    h += w * cell * bowls(x * f + o, y * f - o, z * f + 0.5 * o, CRATER_DENSITY[k]);
  }
  for (let k = 0; k < ROUGH_WAVES.length; k++) {
    const lam = ROUGH_WAVES[k], w = spacing ? fade(2.5, 6, lam / spacing) : 1; if (w === 0) break;
    const f = MOON_R / lam, o = 91.3 * (k + 1);
    h += w * lam * ROUGH_SLOPE * snoise(x * f + o, y * f + 0.7 * o, z * f - o);
  }
  return h;
}

// Ground height in metres above Tal's mean radius (MOON_R) for a unit direction. Physics uses the full
// detail; terrain chunks pass their vertex spacing.
export const talHeight = (x, y, z, spacing = 0) => talBase(x, y, z) * TAL_RELIEF + talDetail(x, y, z, spacing);
