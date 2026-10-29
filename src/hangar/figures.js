// The hangar's people and machines, built from primitives (no files): robed and hooded figures, armoured
// guards, drones. Metres, feet at y = 0, facing +z. A figure is {root, body, head, armL, armR, h, ...};
// animate(f, dt, speed) walks it (bob, sway, swinging sleeves) or lets it breathe, gesture() nods, shakes
// its head or raises an arm. Faces stay in the hood's shadow; some show two faint blue eyes.
import * as THREE from 'three';
import {lin} from '../util.js';

// Cloth: vertical folds, darker toward a dusty hem (v = 0 at the hem on the lathe shapes below).
const clothTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
  for (let x = 0; x < 128; x++) { const k = 0.72 + 0.2 * Math.sin(x / 128 * Math.PI * 14) + 0.08 * Math.sin(x / 128 * Math.PI * 38); g.fillStyle = `rgb(${255 * k | 0},${255 * k | 0},${255 * k | 0})`; g.fillRect(x, 0, 1, 128); }
  const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(70,52,34,0.75)'); gr.addColorStop(0.25, 'rgba(70,52,34,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; return t;
})();
const mats = new Map();
const cloth = hex => { if (!mats.has(hex)) mats.set(hex, new THREE.MeshStandardMaterial({color: lin(hex), map: clothTex, roughness: 1, metalness: 0})); return mats.get(hex); };
const metal = (hex, rough = 0.45) => new THREE.MeshStandardMaterial({color: lin(hex), roughness: rough, metalness: 0.75});
const glow = hex => new THREE.MeshBasicMaterial({color: lin(hex), toneMapped: false});
const shadeM = new THREE.MeshBasicMaterial({color: 0x050403});

// Shapes, for a figure 1.8 m tall (scaled to its height).
const lathe = (pts, n = 12) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
const ROBE = lathe([[0.42, 0.01], [0.39, 0.12], [0.33, 0.48], [0.28, 0.88], [0.25, 1.12], [0.25, 1.3], [0.27, 1.39], [0.24, 1.46], [0.15, 1.51], [0.07, 1.54]]);
const MANTLE = lathe([[0.36, 0.62], [0.34, 0.9], [0.31, 1.18], [0.31, 1.36], [0.27, 1.45], [0.16, 1.52]]);
const COLLAR = new THREE.CylinderGeometry(0.17, 0.2, 0.34, 12, 1, true);
// The hood: a sphere opened at the front, stretched up into a soft point.
const HOOD = new THREE.SphereGeometry(0.17, 14, 10, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, 0, Math.PI * 0.74);
const FACE = new THREE.SphereGeometry(0.115, 10, 8);
const EYE = new THREE.SphereGeometry(0.011, 6, 4);
const SLEEVE = new THREE.CylinderGeometry(0.055, 0.1, 0.64, 8, 1, true);
const STAFF = new THREE.CylinderGeometry(0.018, 0.024, 2.15, 6);
const LAMP = new THREE.OctahedronGeometry(0.07, 0);
[ROBE, MANTLE, SLEEVE].forEach(g => g.computeVertexNormals());

const LOOKS = {
  local: {robe: [0x5a4a3c, 0x4a4036, 0x6a5844, 0x3e3830], mantle: [0x7a6248, 0x5c4c3c, null, null], eyes: 0.5},
  pilgrim: {robe: [0x8a7a64, 0x7a705e, 0x6e6452], mantle: [null], eyes: 0},
  merchant: {robe: [0x6a3e2c, 0x5c4030, 0x4e3a2a], mantle: [0x8a6236, 0x76502e], eyes: 0.3},
  proctor: {robe: [0x111013], mantle: [0x1d1b21], eyes: 0},
  factor: {robe: [0x3a2218], mantle: [0x6a3a22], eyes: 1},
  wright: {robe: [0x2a2724], mantle: [0x4a3a2a], eyes: 0},
};

// A robed figure. opts: {look, h, seed (0..1), staff, lamp, mask, hunch}.
export function figure({look = 'local', h = 1.8, seed = Math.random(), staff = false, lamp = false, mask = false, hunch = 0} = {}) {
  const L = LOOKS[look], pick = (arr, k) => arr[Math.floor(((seed * 7.31 + k) % 1) * arr.length)];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.setScalar(h / 1.8);
  const robeM = cloth(pick(L.robe, 0.1)), mantleHex = pick(L.mantle, 0.6);
  const add = (geo, mat, parent = body, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; parent.add(m); return m; };
  const robe = add(ROBE, robeM); robe.scale.set(1.12, 1, 0.82);
  if (mantleHex !== null && mantleHex !== undefined) { const m = add(MANTLE, cloth(mantleHex)); m.scale.set(1.18, 1, 0.9); }
  if (look === 'proctor') { const c = add(COLLAR, cloth(0x1d1b21)); c.position.y = 1.6; c.material.side = THREE.DoubleSide; }
  // Head: hood, a face lost in shadow, sometimes eyes, the Proctor's mask. Pivots at the neck.
  const head = new THREE.Group(); head.position.y = 1.5; body.add(head);
  const hood = add(HOOD, cloth(mantleHex || pick(L.robe, 0.1)), head); hood.position.set(0, 0.15, -0.015); hood.scale.set(1, 1.28, 1.12); hood.material.side = THREE.DoubleSide;
  add(FACE, shadeM, head, false).position.set(0, 0.13, 0.005);
  if (mask) { const m = add(new THREE.BoxGeometry(0.15, 0.075, 0.03), metal(0x8a7448, 0.35), head, false); m.position.set(0, 0.15, 0.1); const s = add(new THREE.BoxGeometry(0.11, 0.008, 0.01), glow(0xd8b878), head, false); s.position.set(0, 0.16, 0.117); }
  else if (((seed * 13.7) % 1) < L.eyes) for (const x of [-0.036, 0.036]) add(EYE, glow(0x5aa8ff), head, false).position.set(x, 0.155, 0.108);
  // Sleeves hang from the shoulders and swing from there.
  const arm = side => { const a = new THREE.Group(); a.position.set(side * 0.26, 1.4, 0.02); body.add(a); const s = add(SLEEVE, robeM, a); s.position.set(0, -0.31, 0.03); s.rotation.x = 0.08; a.rotation.z = side * 0.1; return a; };
  const armL = arm(1), armR = arm(-1);
  if (staff) { const s = add(STAFF, metal(look === 'proctor' ? 0x3a3530 : 0x4a3a28, 0.7), armR); s.position.set(0, -0.35, 0.12); s.rotation.x = -0.08;
    const top = add(LAMP, glow(look === 'proctor' ? 0x9fd4ff : 0xffb14a), armR, false); top.position.set(0, 0.74, 0.1); top.scale.setScalar(look === 'proctor' ? 0.7 : 0.5); }
  if (lamp) { const l = add(LAMP, glow(0xffa040), armL, false); l.position.set(0, -0.78, 0.12); }
  body.rotation.x = hunch;
  return {root, body, head, armL, armR, h, phase: seed * 10, t: seed * 10, hunch, gest: null, walk: 0};
}

// An armoured guard: tall, dark, a helmet with a thin visor, a long weapon grounded at its side.
export function guard({h = 2.25, seed = Math.random()} = {}) {
  const f = figure({look: 'proctor', h, seed});
  const darkM = metal(0x1f1e22, 0.5), add = (geo, mat, parent, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  f.head.clear();
  add(new THREE.CylinderGeometry(0.13, 0.15, 0.3, 10), darkM, f.head, 0, 0.13, 0);
  add(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), darkM, f.head, 0, 0.28, 0);
  add(new THREE.BoxGeometry(0.16, 0.012, 0.02), glow(0xb06a3a), f.head, 0, 0.17, 0.142).castShadow = false;
  for (const s of [-1, 1]) { const p = add(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), darkM, f.body, s * 0.25, 1.38, 0); p.scale.set(1.1, 0.6, 1); }
  add(new THREE.BoxGeometry(0.42, 0.42, 0.06), darkM, f.body, 0, 1.18, 0.2);
  const w = add(new THREE.CylinderGeometry(0.025, 0.025, 2.5, 6), metal(0x2a2a2e), f.armR, 0, -0.1, 0.16);
  add(new THREE.BoxGeometry(0.06, 0.34, 0.02), metal(0x6a6a70, 0.3), w, 0, 1.38, 0);
  f.armR.rotation.x = -0.12; f.still = true;
  return f;
}

// A drone: a black sphere with fins round its waist and one red eye.
export function drone() {
  const root = new THREE.Group(), m = metal(0x15171b, 0.35);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), m); b.castShadow = true; root.add(b);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 6, 20), m); ring.rotation.x = Math.PI / 2; root.add(ring);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glow(0xff3b30)); eye.position.z = 0.42; root.add(eye);
  return {root, eye, h: 1};
}

// One frame. speed in m/s (0 standing). Gestures play over whatever else is happening.
export function animate(f, dt, speed) {
  f.t += dt; const moving = Math.min(1, speed / 0.5);
  f.walk += (moving - f.walk) * Math.min(1, dt * 4); const w = f.walk;
  if (speed > 0) f.phase += dt * speed / 0.75 * Math.PI;
  const s = Math.sin(f.phase);
  f.body.position.y = w * 0.035 * Math.abs(Math.cos(f.phase));
  f.body.rotation.z = w * 0.03 * s; f.body.rotation.x = f.hunch + w * 0.06;
  f.armL.rotation.x = w * 0.32 * s; f.armR.rotation.x = f.still ? -0.12 : -w * 0.32 * s;
  const breathe = 1 + 0.007 * Math.sin(f.t * 1.7); f.body.scale.y = f.body.scale.x * breathe;
  f.head.rotation.set(0, 0, 0);
  const g = f.gest; if (!g) return;
  g.t += dt; const k = g.t / g.len;
  if (k >= 1) { f.gest = null; return; }
  const env = Math.sin(Math.PI * k);
  if (g.name === 'yes') f.head.rotation.x = 0.28 * env * Math.abs(Math.sin(k * Math.PI * 2));
  else if (g.name === 'no') f.head.rotation.y = 0.35 * env * Math.sin(k * Math.PI * 4);
  else if (g.name === 'raise') f.armR.rotation.x = -1.5 * env;
}
// 'yes' (a nod), 'no' (a slow shake of the head), 'raise' (the right arm comes up).
export function gesture(f, name) { f.gest = {name, t: 0, len: name === 'raise' ? 1.8 : 1.2}; }
