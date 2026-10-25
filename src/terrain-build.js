// Builds one chunk of Tal's ground: a GRID × GRID patch of a cube-sphere face, heights from tal.js.
// Pure (no DOM, no three.js objects), so it runs in a Web Worker (terrain-worker.js) or on the main
// thread. Positions are relative to the chunk's centre to keep float32 precise; see terrain.js.
import {MOON_R, TERRAIN_GRID as G} from './config.js';
import {talHeight} from './tal.js';

// Cube faces: outward normal n and in-face axes u, v with u × v = n, so grid triangles wind
// counter-clockwise seen from outside.
export const FACES = [
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
const Q = Math.PI / 4;

// Unit direction for face coordinates (a, b) in [-1, 1]. The tan warp keeps chunks close to equal size.
export function faceDir(face, a, b, out) {
  const [n, u, v] = FACES[face], ta = Math.tan(a * Q), tb = Math.tan(b * Q);
  const x = n[0] + u[0] * ta + v[0] * tb, y = n[1] + u[1] * ta + v[1] * tb, z = n[2] + u[2] * ta + v[2] * tb, l = Math.hypot(x, y, z);
  out[0] = x / l; out[1] = y / l; out[2] = z / l; return out;
}

// Chunk (level, ix, iy) of a face covers a in [a0, a0 + s] and b in [b0, b0 + s]; level 0 is the whole face.
export function chunkSpan(level, ix, iy) { const s = 2 / 2 ** level; return [-1 + ix * s, -1 + iy * s, s]; }
// Edge length in metres (on the mean sphere).
export const chunkSize = level => 2 / 2 ** level * Q * MOON_R;

// Vertex layout: G × G grid, then a skirt (one ring of vertices hanging below the edge, hiding
// cracks where a chunk meets a neighbour of a different level).
const PERIM = 4 * (G - 1);
export const NVERT = G * G + PERIM;
const perim = [];
for (let i = 0; i < G - 1; i++) perim.push(i);                         // bottom, left to right
for (let j = 0; j < G - 1; j++) perim.push(j * G + G - 1);             // right, upwards
for (let i = G - 1; i > 0; i--) perim.push((G - 1) * G + i);           // top, right to left
for (let j = G - 1; j > 0; j--) perim.push(j * G);                     // left, downwards

// Triangle indices, the same for every chunk. Skirts are wound both ways so they show from any side.
export function chunkIndex() {
  const idx = [];
  for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) { const a = j * G + i, b = a + 1, c = a + G, d = c + 1; idx.push(a, b, c, b, d, c); }
  for (let k = 0; k < PERIM; k++) {
    const a = perim[k], b = perim[(k + 1) % PERIM], sa = G * G + k, sb = G * G + (k + 1) % PERIM;
    idx.push(a, sa, b, b, sa, sb, a, b, sa, b, sb, sa);
  }
  return new Uint16Array(idx);
}

// Returns {pos, nor} (Float32Array, NVERT × 3, body frame, pos relative to centre), centre (metres,
// body frame), radius (bounding sphere about the centre) and minH / maxH (ground height range).
export function buildChunk(face, level, ix, iy) {
  const [a0, b0, s] = chunkSpan(level, ix, iy), B = G + 2, step = s / (G - 1), d = [0, 0, 0];
  faceDir(face, a0 + s / 2, b0 + s / 2, d);
  const cx = d[0] * MOON_R, cy = d[1] * MOON_R, cz = d[2] * MOON_R;
  // Sample one ring beyond the edge too, so normals on the edge match the neighbouring chunk's.
  const P = new Float64Array(B * B * 3); let minH = Infinity, maxH = -Infinity;
  for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) {
    faceDir(face, a0 + (i - 1) * step, b0 + (j - 1) * step, d);
    const h = talHeight(d[0], d[1], d[2]), r = MOON_R + h, k = (j * B + i) * 3;
    P[k] = d[0] * r; P[k + 1] = d[1] * r; P[k + 2] = d[2] * r;
    if (i > 0 && j > 0 && i <= G && j <= G) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
  }
  const pos = new Float32Array(NVERT * 3), nor = new Float32Array(NVERT * 3); let rad2 = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const k = ((j + 1) * B + i + 1) * 3, o = (j * G + i) * 3;
    pos[o] = P[k] - cx; pos[o + 1] = P[k + 1] - cy; pos[o + 2] = P[k + 2] - cz;
    const r2 = pos[o] ** 2 + pos[o + 1] ** 2 + pos[o + 2] ** 2; if (r2 > rad2) rad2 = r2;
    const xp = k + 3, xm = k - 3, yp = k + B * 3, ym = k - B * 3;
    const ux = P[xp] - P[xm], uy = P[xp + 1] - P[xm + 1], uz = P[xp + 2] - P[xm + 2];
    const vx = P[yp] - P[ym], vy = P[yp + 1] - P[ym + 1], vz = P[yp + 2] - P[ym + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
    nor[o] = nx / nl; nor[o + 1] = ny / nl; nor[o + 2] = nz / nl;
  }
  const depth = 20 + chunkSize(level) * 0.015;
  for (let k = 0; k < PERIM; k++) {
    const g = perim[k] * 3, o = (G * G + k) * 3, px = pos[g] + cx, py = pos[g + 1] + cy, pz = pos[g + 2] + cz, l = Math.hypot(px, py, pz);
    pos[o] = pos[g] - px / l * depth; pos[o + 1] = pos[g + 1] - py / l * depth; pos[o + 2] = pos[g + 2] - pz / l * depth;
    nor[o] = nor[g]; nor[o + 1] = nor[g + 1]; nor[o + 2] = nor[g + 2];
  }
  return {pos, nor, center: [cx, cy, cz], radius: Math.sqrt(rad2) + depth, minH, maxH};
}
