// Renderer, cameras, sky and global lights.
// Floating origin: the ship sits at the render origin and the universe moves around it (see world.js).
// The sky (stars, sun disc) is a separate scene drawn first with no depth, so it is always behind everything.
import * as THREE from 'three';
import {TAU, SUN_I, SUN_DIR} from './config.js';
import {rng, glowTex} from './util.js';

export const app = document.getElementById('app');
export const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true});
export const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR); renderer.autoClear = false;
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
export const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
app.insertBefore(renderer.domElement, app.firstChild);
export const canvas = renderer.domElement;

export const scene = new THREE.Scene();
export const skyScene = new THREE.Scene();
export const cam = new THREE.PerspectiveCamera(62, 1, 0.5, 2e10);
export const icam = new THREE.PerspectiveCamera(74, 1, 0.01, 10); // bridge interior camera
icam.position.set(0, 0.16, 0.2);

function resize() {
  const w = app.clientWidth || innerWidth, h = app.clientHeight || innerHeight;
  renderer.setSize(w, h, false); cam.aspect = icam.aspect = w / h;
  cam.updateProjectionMatrix(); icam.updateProjectionMatrix();
}
if (window.ResizeObserver) new ResizeObserver(resize).observe(app); else addEventListener('resize', resize);
resize();

export const sunDir = new THREE.Vector3(...SUN_DIR).normalize();

// ---- sky ----
export const skyG = new THREE.Group(); skyScene.add(skyG);
function starPoints(pos, col, size) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({size: size * DPR, sizeAttenuation: false, vertexColors: true, depthWrite: false, depthTest: false, transparent: true, toneMapped: false}));
}
function starLayer(n, size, seed, bright) {
  const r = rng(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1; const l = Math.hypot(x, y, z) || 1;
    pos[i * 3] = x / l * 3000; pos[i * 3 + 1] = y / l * 3000; pos[i * 3 + 2] = z / l * 3000;
    const t = r(), b = bright * (0.3 + r() * 0.7); let cr = 1, cg = 1, cb = 1;
    if (t < 0.15) { cg = 0.86; cb = 0.7; } else if (t < 0.32) { cr = 0.76; cg = 0.86; }
    col[i * 3] = cr * b; col[i * 3 + 1] = cg * b; col[i * 3 + 2] = cb * b;
  }
  return starPoints(pos, col, size);
}
function starBand(n, seed) { // faint galactic band
  const r = rng(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.05, 0.4, 0.2)); const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU; const g = (r() + r() + r() + r() - 2) * 0.13;
    v.set(Math.cos(a), g, Math.sin(a)).normalize().applyQuaternion(q).multiplyScalar(3000);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    const b = 0.18 + r() * 0.35 * (1 - Math.abs(g) * 4); col[i * 3] = b * 0.95; col[i * 3 + 1] = b * 0.93; col[i * 3 + 2] = b;
  }
  return starPoints(pos, col, 1.0);
}
skyG.add(starBand(9000, 21)); skyG.add(starLayer(4500, 1.2, 11, 0.8)); skyG.add(starLayer(500, 2.2, 12, 1));
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({color: 0xfff6e4, toneMapped: false, depthTest: false, depthWrite: false}));
sunDisc.position.copy(sunDir).multiplyScalar(2900); skyG.add(sunDisc); // 0.53° wide, like our Sun
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex([[0, 'rgba(255,248,230,1)'], [0.1, 'rgba(255,225,180,0.55)'], [0.35, 'rgba(255,190,120,0.1)'], [1, 'rgba(255,150,80,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false}));
sunGlow.scale.set(520, 520, 1); sunGlow.position.copy(sunDisc.position); skyG.add(sunGlow);

// ---- lights (the ship is always near the origin, so the shadow box stays small) ----
export const sunLight = new THREE.DirectionalLight(0xfff3e0, SUN_I);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
{ const sc = sunLight.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 10; sc.far = 6000; }
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.4;
sunLight.position.copy(sunDir).multiplyScalar(3000); scene.add(sunLight); scene.add(sunLight.target);
export const hemi = new THREE.HemisphereLight(0x000000, 0x6d8db8, 0); // planet-shine from below
scene.add(hemi);
scene.add(new THREE.AmbientLight(0xffffff, 0.015));

// Small environment map so metal hull panels pick up a sun highlight and blue planet-shine.
export function makeEnv() {
  const es = new THREE.Scene(); const g = new THREE.SphereGeometry(50, 32, 16); const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) { const y = g.attributes.position.getY(i) / 50; const k = Math.max(0, -y); c[i * 3] = 0.004 + 0.03 * k; c[i * 3 + 1] = 0.006 + 0.06 * k; c[i * 3 + 2] = 0.012 + 0.12 * k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, side: THREE.BackSide})));
  const s = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 8), new THREE.MeshBasicMaterial()); s.material.color.setRGB(60, 55, 48); s.position.copy(sunDir).multiplyScalar(40); es.add(s);
  const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(es, 0.02).texture; pm.dispose(); return t;
}
