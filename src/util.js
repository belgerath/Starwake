import * as THREE from 'three';

export const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const fmt = n => Math.round(n).toLocaleString('en-US');
export const lin = h => new THREE.Color(h).convertSRGBToLinear();
export const $ = id => document.getElementById(id);

// Seeded PRNG (mulberry32). Same seed, same sequence: keeps generated content stable between sessions.
export function rng(s) {
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Integer hash to [0,1). Used for per-cell content such as ring rocks.
export function hash(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function glowTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(s => gr.addColorStop(s[0], s[1])); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

// Value noise used for rock shapes (CPU side).
export function makeNoise(seed) {
  function h(x, y, z) { let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(seed, 144665)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n = n ^ (n >>> 16); return (n & 0xffff) / 65535; }
  function vn(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const a = h(xi, yi, zi), b = h(xi + 1, yi, zi), c = h(xi, yi + 1, zi), d = h(xi + 1, yi + 1, zi), e = h(xi, yi, zi + 1), f = h(xi + 1, yi, zi + 1), g = h(xi, yi + 1, zi + 1), k = h(xi + 1, yi + 1, zi + 1);
    const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (k - g) * u; const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
    return (y1 + (y2 - y1) * w) * 2 - 1;
  }
  return function (x, y, z, oct, f0) { let s = 0, a = 0.5, f = f0; for (let i = 0; i < oct; i++) { s += a * vn(x * f + 11.3, y * f + 23.7, z * f + 37.1); f *= 2.07; a *= 0.5; } return s; };
}
