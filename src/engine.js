// Renderer, cameras, sky and global lights.
// Floating origin: the ship sits at the render origin and the universe moves around it (see world.js).
// The sky (sun disc here; stars and the Milky Way in sky.js) is a separate scene drawn first with no
// depth, so it is always behind everything.
import * as THREE from 'three';
import {SUN_I, SUN_DIR, SHIP} from './config.js';
import {glowTex} from './util.js';

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
export const skyG = new THREE.Group(); skyScene.add(skyG); // follows the camera; stars are added by sky.js
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({color: 0xfff6e4, toneMapped: false, depthTest: false, depthWrite: false}));
sunDisc.position.copy(sunDir).multiplyScalar(2900); skyG.add(sunDisc); // 0.53° wide, like our Sun
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex([[0, 'rgba(255,248,230,1)'], [0.1, 'rgba(255,225,180,0.55)'], [0.35, 'rgba(255,190,120,0.1)'], [1, 'rgba(255,150,80,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false}));
sunGlow.scale.set(520, 520, 1); sunGlow.position.copy(sunDisc.position); skyG.add(sunGlow);

// ---- lights (the ship is always near the origin, so the shadow box only has to fit the ship) ----
// The box is a little wider than the ship; its depth reaches the ground about 1 km below at a low sun.
export const sunLight = new THREE.DirectionalLight(0xfff3e0, SUN_I);
sunLight.castShadow = true; sunLight.shadow.mapSize.set(2048, 2048);
{ const sc = sunLight.shadow.camera, half = 0.8 * SHIP.length; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 3000; }
sunLight.shadow.bias = -0.00004; sunLight.shadow.normalBias = 0.04;
sunLight.position.copy(sunDir).multiplyScalar(300); scene.add(sunLight); scene.add(sunLight.target);
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
