// Tal's terrain mesh (terrain-build.js): chunks must agree with tal.js and with each other, or there
// are holes in the ground and the drawn ground differs from what physics collides with.
import {describe, it, expect} from 'vitest';
import {buildChunk, chunkIndex, NVERT} from '../src/terrain-build.js';
import {talHeight} from '../src/tal.js';
import {MOON_R, TERRAIN_GRID as G} from '../src/config.js';

const abs = (c, i) => [c.pos[i * 3] + c.center[0], c.pos[i * 3 + 1] + c.center[1], c.pos[i * 3 + 2] + c.center[2]];
const edge = c => { const out = []; for (let i = 0; i < G; i++) out.push(abs(c, i), abs(c, (G - 1) * G + i), abs(c, i * G), abs(c, i * G + G - 1)); return out; };
const near = (p, list, tol) => list.some(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < tol);

describe('terrain chunks', () => {
  it('put every vertex on the ground tal.js describes', () => {
    const c = buildChunk(2, 9, 300, 170);
    for (let i = 0; i < G * G; i += 37) {
      const p = abs(c, i), r = Math.hypot(...p);
      expect(Math.abs(r - MOON_R - talHeight(p[0] / r, p[1] / r, p[2] / r))).toBeLessThan(0.5);
    }
  });
  it('share their edges exactly with neighbours on the same face', () => {
    const a = buildChunk(4, 3, 2, 5), b = buildChunk(4, 3, 3, 5);
    const right = [], left = []; for (let j = 0; j < G; j++) { right.push(abs(a, j * G + G - 1)); left.push(abs(b, j * G)); }
    for (let j = 0; j < G; j++) expect(Math.hypot(right[j][0] - left[j][0], right[j][1] - left[j][1], right[j][2] - left[j][2])).toBeLessThan(0.5);
  });
  it('share their edges with the neighbouring cube face', () => {
    const roots = [0, 1, 2, 3, 4, 5].map(f => buildChunk(f, 0, 0, 0)), edges = roots.map(edge);
    for (let f = 0; f < 6; f++) {
      const others = edges.filter((_, g) => g !== f).flat();
      for (const p of edges[f]) expect(near(p, others, 1)).toBe(true);
    }
  });
  it('face outward: triangles wind counter-clockwise and normals point up', () => {
    const c = buildChunk(0, 5, 11, 20), idx = chunkIndex();
    expect(c.pos.length).toBe(NVERT * 3);
    for (let t = 0; t < (G - 1) * (G - 1) * 6; t += 3 * 17) {
      const [p, q, r] = [idx[t], idx[t + 1], idx[t + 2]].map(i => abs(c, i));
      const u = q.map((v, k) => v - p[k]), v = r.map((x, k) => x - p[k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...p);
      expect((n[0] * p[0] + n[1] * p[1] + n[2] * p[2]) / l).toBeGreaterThan(0);
    }
    for (let i = 0; i < G * G; i += 29) {
      const p = abs(c, i), l = Math.hypot(...p);
      expect((c.nor[i * 3] * p[0] + c.nor[i * 3 + 1] * p[1] + c.nor[i * 3 + 2] * p[2]) / l).toBeGreaterThan(0.5);
    }
  });
});
