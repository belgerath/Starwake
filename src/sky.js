// The sky: about 13,000 stars with the spread of brightness and colour of the real dark sky, the
// Milky Way as a faint glow (baked once into a cube map), and an exposure that dims both when something
// bright fills the view, as eyes and cameras do. Everything sits in the sky scene (engine.js), which is
// drawn first, with no depth, around the camera.
import * as THREE from 'three';
import {TAU} from './config.js';
import {rng, clamp, smooth} from './util.js';
import {skyG, sunDir, DPR} from './engine.js';
import {bake} from './bake.js';
import {MILKY_WAY, SKY_VERT, SKY_FRAG, STAR_VERT, STAR_FRAG} from './shaders.js';

const V3 = THREE.Vector3;
// The galaxy's pole and the direction of its centre (universe frame). Chosen so that from the start
// orbit the Milky Way's core sits just above Veyra's limb, ahead and a little left, with the band
// climbing to the upper right; the sun is over 100° away from the core.
const galN = new V3(-0.3315, -0.5585, -0.7604).normalize(), galC = new V3(0.21, 0.7421, -0.6366).normalize(), galE = new V3().crossVectors(galN, galC);

const N_STARS = 13000, MAG_MIN = -1.4, MAG_MAX = 7.0, STAR_R = 2800;
// Star colour by B-V colour index, hot blue-white to cool orange, softened toward white as the eye sees it.
const BV = [[-0.3, 0.62, 0.72, 1.0], [0.0, 0.80, 0.86, 1.0], [0.3, 0.96, 0.96, 1.0], [0.6, 1.0, 0.95, 0.86], [1.0, 1.0, 0.86, 0.68], [1.5, 1.0, 0.74, 0.48], [2.0, 1.0, 0.62, 0.36]];
function bvColor(bv, out, o) {
  let k = 0; while (k < BV.length - 2 && bv > BV[k + 1][0]) k++;
  const [b0, r0, g0, c0] = BV[k], [b1, r1, g1, c1] = BV[k + 1], t = clamp((bv - b0) / (b1 - b0), 0, 1);
  out[o] = 0.75 * (r0 + (r1 - r0) * t) + 0.25; out[o + 1] = 0.75 * (g0 + (g1 - g0) * t) + 0.25; out[o + 2] = 0.75 * (c0 + (c1 - c0) * t) + 0.25;
}

const uniforms = {exposure: {value: 1}, pxScale: {value: DPR}};
let mwIntensity = null;

export function buildSky() {
  const r = rng(7), gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(TAU * r());
  const pos = new Float32Array(N_STARS * 3), col = new Float32Array(N_STARS * 3), mag = new Float32Array(N_STARS), d = new V3();
  // Magnitudes: the number of stars brighter than m grows about 2.8 times per magnitude, so most are faint.
  const u0 = Math.pow(10, 0.45 * (MAG_MIN - MAG_MAX));
  for (let i = 0; i < N_STARS; i++) {
    const m = MAG_MAX + Math.log10(u0 + (1 - u0) * r()) / 0.45;
    // Fainter stars crowd toward the galaxy's plane; bright ones are mostly nearby, so spread evenly.
    if (r() < 0.15 + 0.5 * (m - MAG_MIN) / (MAG_MAX - MAG_MIN)) {
      const lat = gauss() * 0.2, lon = r() * TAU;
      d.copy(galC).multiplyScalar(Math.cos(lon) * Math.cos(lat)).addScaledVector(galE, Math.sin(lon) * Math.cos(lat)).addScaledVector(galN, Math.sin(lat));
    } else { const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z); d.set(s * Math.cos(a), z, s * Math.sin(a)); }
    d.normalize().multiplyScalar(STAR_R); pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z;
    // B-V: hot A and F stars around 0.2, cool K giants around 1.1, a few in between and at the ends.
    const t = r(), bv = t < 0.45 ? 0.15 + gauss() * 0.25 : t < 0.85 ? 1.1 + gauss() * 0.25 : 0.6 + gauss() * 0.3;
    bvColor(clamp(bv, -0.3, 2.0), col, i * 3); mag[i] = m;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('starColor', new THREE.BufferAttribute(col, 3)); g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({uniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false}));
  stars.frustumCulled = false; stars.renderOrder = -1; skyG.add(stars);

  const mw = bake(512, MILKY_WAY, {gN: {value: galN}, gC: {value: galC}});
  mwIntensity = {value: 0.19};
  const glow = new THREE.Mesh(new THREE.SphereGeometry(STAR_R * 1.02, 48, 24), new THREE.ShaderMaterial({uniforms: {map: {value: mw.texture}, exposure: uniforms.exposure, intensity: mwIntensity},
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthTest: false, depthWrite: false}));
  glow.frustumCulled = false; glow.renderOrder = -2; skyG.add(glow);
}

// Exposure: how much of the view is taken by sunlit Veyra or Tal sets how bright the sky can look,
// gently (never below half), and the sun itself in view washes it out almost entirely. It adapts over
// a second or two. bodies: [{pos (render space), radius, albedo}].
const camDir = new V3(), tv = new V3();
let exposure = 1;
// Fraction of a circular view of angular radius v covered by a disc of angular radius a at angle th.
function coverage(th, a, v) {
  if (th >= a + v) return 0; if (a >= th + v) return 1;
  const full = Math.min(1, (a * a) / (v * v)); if (th + a <= v) return full;
  return full * clamp((a + v - th) / (2 * Math.min(a, v)), 0, 1);
}
export function updateSky(dt, cam, bodies) {
  cam.getWorldDirection(camDir);
  const v = Math.atan(Math.tan(cam.fov * Math.PI / 360) * Math.hypot(1, cam.aspect));
  let b = 0;
  for (const {pos, radius, albedo} of bodies) {
    tv.subVectors(pos, cam.position); const dist = tv.length();
    const cover = dist <= radius ? 1 : coverage(camDir.angleTo(tv), Math.asin(radius / dist), v);
    b += cover * albedo * (0.5 - 0.5 * tv.normalize().dot(sunDir)); // lit fraction of the side we see
  }
  const sun = 1 - smooth(v * 0.9, v + 0.25, camDir.angleTo(sunDir)); // the sun in view
  const target = Math.max(0.5, 1 / (1 + 1.2 * b)) * (1 - 0.85 * sun);
  exposure += (target - exposure) * (1 - Math.exp(-dt * 1.5));
  uniforms.exposure.value = exposure;
}
