// JavaScript port of the GLSL noise in shaders.js (NOISE). Terrain meshes, collision and radar
// altitude use it, so it must give the same numbers as the GPU bake: keep the two in sync.
//
// The discrete parts (lattice hashing, gradient choice) copy the GPU's float32 arithmetic exactly
// with Math.fround; the smooth parts run in doubles, which differ from the GPU by far less than a
// metre of terrain. No three.js and no DOM here, so a Web Worker can import it.
const f32 = Math.fround;
const C6 = f32(1 / 6), C3 = f32(1 / 3), I289 = f32(1 / 289);
const N7 = f32(0.142857142857), NSX = f32(N7 * 2), NSY = f32(f32(N7 * 0.5) - 1);

const mod289 = x => x - Math.floor(f32(x * I289)) * 289;
const permute = x => mod289((x * 34 + 1) * x);

// One simplex corner: gradient from the permutation value p, falloff from the offset (x, y, z).
function corner(p, x, y, z) {
  let m = 0.6 - (x * x + y * y + z * z); if (m <= 0) return 0;
  const j = p - 49 * Math.floor(f32(f32(p * N7) * N7));
  const xi = Math.floor(f32(j * N7)), yi = Math.floor(j - 7 * xi);
  let gx = xi * NSX + NSY, gy = yi * NSX + NSY; const gz = 1 - Math.abs(gx) - Math.abs(gy);
  // Same exact-integer test as the GLSL (see the comment there), not the sign of gz.
  if (Math.abs(4 * xi - 13) + Math.abs(4 * yi - 13) + (xi + yi >= 10 ? 0.5 : 0) >= 14.5) { gx -= Math.floor(gx) * 2 + 1; gy -= Math.floor(gy) * 2 + 1; }
  m *= m;
  return m * m * (1.79284291400159 - 0.85373472095314 * (gx * gx + gy * gy + gz * gz)) * (gx * x + gy * y + gz * z);
}

// 3D simplex noise (Ashima Arts / Ian McEwan), roughly -1..1.
export function snoise(vx, vy, vz) {
  const s = (vx + vy + vz) * C3;
  let ix = Math.floor(vx + s), iy = Math.floor(vy + s), iz = Math.floor(vz + s);
  const t = (ix + iy + iz) * C6;
  const x0 = vx - ix + t, y0 = vy - iy + t, z0 = vz - iz + t;
  const gx = x0 >= y0 ? 1 : 0, gy = y0 >= z0 ? 1 : 0, gz = z0 >= x0 ? 1 : 0;
  const i1x = Math.min(gx, 1 - gz), i1y = Math.min(gy, 1 - gx), i1z = Math.min(gz, 1 - gy);
  const i2x = Math.max(gx, 1 - gz), i2y = Math.max(gy, 1 - gx), i2z = Math.max(gz, 1 - gy);
  ix = mod289(ix); iy = mod289(iy); iz = mod289(iz);
  const p0 = permute(permute(permute(iz) + iy) + ix);
  const p1 = permute(permute(permute(iz + i1z) + iy + i1y) + ix + i1x);
  const p2 = permute(permute(permute(iz + i2z) + iy + i2y) + ix + i2x);
  const p3 = permute(permute(permute(iz + 1) + iy + 1) + ix + 1);
  return 42 * (corner(p0, x0, y0, z0) + corner(p1, x0 - i1x + C6, y0 - i1y + C6, z0 - i1z + C6) +
               corner(p2, x0 - i2x + C3, y0 - i2y + C3, z0 - i2z + C3) + corner(p3, x0 - 0.5, y0 - 0.5, z0 - 0.5));
}

export function fbm(x, y, z, oct) {
  let s = 0, a = 0.5;
  for (let i = 0; i < oct; i++) { s += a * snoise(x, y, z); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; z = z * 2.03 + 3.4; a *= 0.5; }
  return s;
}

// Cell hash in [0,1)³: pcg3d in uint32 arithmetic, bit for bit the same as hash3() in the GLSL.
let hx = 0, hy = 0, hz = 0;
function hash3(x, y, z) {
  x = Math.imul(x, 1664525) + 1013904223 | 0; y = Math.imul(y, 1664525) + 1013904223 | 0; z = Math.imul(z, 1664525) + 1013904223 | 0;
  x = x + Math.imul(y, z) | 0; y = y + Math.imul(z, x) | 0; z = z + Math.imul(x, y) | 0;
  x ^= x >>> 16; y ^= y >>> 16; z ^= z >>> 16;
  x = x + Math.imul(y, z) | 0; y = y + Math.imul(z, x) | 0; z = z + Math.imul(x, y) | 0;
  hx = (x >>> 8) / 16777216; hy = (y >>> 8) / 16777216; hz = (z >>> 8) / 16777216;
}

// Crater field: one crater in some cells of a unit grid (density is the fraction of cells that get
// one). Shallow bowl (floor -0.9 rad), steep inner wall up to the rim crest (+0.35 rad), continuous.
export function craters(px, py, pz, density) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), fx = px - ix, fy = py - iy, fz = pz - iz;
  let h = 0;
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    hash3(ix + x, iy + y, iz + z); if (hz > density) continue;
    const ex = x + hx - fx, ey = y + hy - fy, ez = z + hz - fz, rad = 0.18 + 0.3 * hx, t = Math.sqrt(ex * ex + ey * ey + ez * ez) / rad;
    if (t < 1) { const t2 = t * t, t4 = t2 * t2, t8 = t4 * t4; h += (1.25 * (0.3 * t2 + 0.7 * t8 * t8) - 0.9) * rad; }
    else if (t < 2.3) h += rad * 0.35 * Math.exp(-(t - 1) * (t - 1) * 12); // beyond, under 1e-8 of a cell
  }
  return h;
}

// Simple bowl craters for detail below the bake (JS only, no GLSL twin): parabolic bowl about a tenth
// as deep as it is wide, a low raised rim, inner walls up to about 22°. Some are worn shallower.
// Heights in cell units, like craters().
export function bowls(px, py, pz, density) {
  const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), fx = px - ix, fy = py - iy, fz = pz - iz;
  let h = 0;
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    hash3(ix + x, iy + y, iz + z); if (hz > density) continue;
    const ex = x + hx - fx, ey = y + hy - fy, ez = z + hz - fz, rad = 0.15 + 0.3 * hx, d2 = ex * ex + ey * ey + ez * ez;
    if (d2 > 4.84 * rad * rad) continue; // beyond 2.2 radii the rim has died away
    const t = Math.sqrt(d2) / rad, k = rad * (0.4 + 0.6 * hy);
    h += t < 1 ? k * (0.2 * t * t - 0.15) : k * 0.05 * Math.exp(-(t - 1) * (t - 1) * 8);
  }
  return h;
}
