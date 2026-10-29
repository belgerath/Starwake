// The hangar: bay 3 of Tumbledown seen from inside, its own scene drawn instead of space while docked.
// A vast concrete hall in haze: buttresses up the walls, a carved back wall with an archway into the
// station, the doors you came in by shut behind the ship with light at the seam, banners, and one shaft of
// light from an opening in the roof onto the Mudlark on its pad. Robed figures walk set paths and stand in
// twos and threes, guards hold the checkpoint, the doors and the arch, drones circle, a hauler works the
// container yard and a crane carries a container overhead. The Proctor (customs) walks over when you
// arrive; the Factor (the broker) waits in an alcove in the lower market. Built in code, no files.
// Metres, y up, the pad's centre at the origin, the ship's nose toward the back wall (−z).
import * as THREE from 'three';
import {renderer, app} from '../engine.js';
import {SHIP} from '../config.js';
import {lin, rng, clamp} from '../util.js';
import {buildTransport} from '../ship/transport.js';
import {figure, guard, drone, animate, gesture as figGesture} from './figures.js';
import {HALL, LOOPS, HAULER, OFFICER, SPOTS, along, pathLength} from './paths.js';
import {canvasTex, blotch, concrete, ribbed, bannerTex, engraving, dotTex, wash as washM, lightShaft} from '../textures.js';

const {x: HX, z: HZ, h: HY} = HALL;
const FOG = 0x30261c;

// Who is in the hangar and what they do. walk: a loop from paths.js (at = start fraction, v = m/s, rev = the
// other way round); idle: a spot and a point to face; guard: a post; drone: a circle in the air
// [x, z, radius, height, rad/s]. say: what they tell you when tapped.
const CAST = [
  {walk: 'ring', at: 0.05, v: 1.1, say: 'Keep walking, offworlder.'},
  {walk: 'ring', at: 0.42, v: 0.8, rev: true, look: 'pilgrim', h: 2.6, staff: true, say: 'We were pilgrims once. Now we are cargo.'},
  {walk: 'ring', at: 0.74, v: 1.2, lamp: true, say: 'Your hull is scarred. Good. Clean ships draw eyes.'},
  {walk: 'long', at: 0.0, v: 1.2, say: 'Three ships did not come back from Tal this cycle.'},
  {walk: 'long', at: 0.24, v: 1.0, look: 'merchant', say: 'The Factor buys. The Factor does not forget.'},
  {walk: 'long', at: 0.5, v: 1.3, staff: true, say: 'The Halberd scans everything now. Everything.'},
  {walk: 'long', at: 0.76, v: 1.1, rev: true, say: 'Do not look at the guards.'},
  {walk: 'market', at: 0.2, v: 0.7, look: 'merchant', say: 'Water costs more than blood on this deck.'},
  {walk: 'market', at: 0.7, v: 0.9, lamp: true, say: 'Say nothing to the Proctor you cannot prove.'},
  {walk: 'doors', at: 0.3, v: 1.0, say: 'The doors open for the station, not for you.'},
  {walk: 'back', at: 0.5, v: 0.6, look: 'pilgrim', h: 2.5, staff: true, say: 'Beyond the arch is the station. Few come back the same.'},
  {idle: [40, 36], face: [37, 39], say: 'We are not talking to you.'},
  {idle: [37, 39], face: [40, 36], look: 'merchant', say: 'Move on.'},
  {idle: [42.5, 39], face: [38.5, 37], h: 1.7, say: 'The ashroot crop failed on Tal. Prices will rise.'},
  {idle: [-41, 31], face: [-38.5, 33.5], look: 'pilgrim', h: 2.6, staff: true, say: 'Silence is also an answer.'},
  {idle: [-38.5, 33.5], face: [-41, 31], lamp: true, say: 'The lamp is for the dark. The dark is everywhere.'},
  {idle: [49, 10], face: [30, 10], look: 'merchant', say: 'Salt, wire, water. No questions.'},
  {idle: [49, -30], face: [30, -30], look: 'merchant', lamp: true, say: 'The Factor is busy. The Factor is always busy.'},
  {guard: [-33, -15], face: [0, -15]}, {guard: [-33, 3], face: [0, 3]},
  {guard: [-14, 66], face: [-14, 0]}, {guard: [14, 66], face: [14, 0]},
  {guard: [-10, -67], face: [-10, 0]}, {guard: [10, -67], face: [10, 0]},
  {drone: [0, 0, 11, 13, 0.3], say: 'The drone turns its red eye on you, then away.'},
  {drone: [20, -20, 30, 30, -0.12], say: 'Far above, a drone records the deck.'},
  {drone: [-28, 28, 20, 36, 0.1], say: 'Far above, a drone records the deck.'},
];
const GUARD_SAY = 'The guard does not answer.';

export const H = {scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(55, 1, 0.1, 700), built: false, agents: [], people: {}, picks: []};
let ship = null, hauler = null, crane = null, shaft = null, dust = null, scan = null, blink = [], t = 0;
const R = rng(31);

// Builds the hangar once (it needs the fonts for its engraving). Later calls return at once.
export async function loadHangar(onProgress) {
  if (!H.built) { if (document.fonts) await document.fonts.load('64px Michroma').catch(() => {}); if (!H.built) { build(); H.built = true; } }
  onProgress && onProgress(1);
}

// ---- textures, drawn once (the shared ones, concrete, banners, engraving, the light shaft, are in textures.js) ----
// Stone slabs, 4 m, each a slightly different shade, with dark joints.
const slabs = () => canvasTex(512, 512, (g, w, h) => {
  const r = rng(5);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const k = 0.85 + r() * 0.15; g.fillStyle = `rgb(${120 * k | 0},${110 * k | 0},${98 * k | 0})`; g.fillRect(i * 256, j * 256, 256, 256); }
  blotch(g, r, 40, w, h, '30,24,18', 0.06, 0.18, 15, 70);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,16,12' : '220,210,190'},0.07)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  g.strokeStyle = 'rgba(12,10,8,0.85)'; g.lineWidth = 5; for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.stroke(); }
}, [2 * HX / 8, 2 * HZ / 8]);
// Sand blown in over the floor: drifts along the walls and in long tongues, clear round the pad.
const sand = () => canvasTex(1024, 1024, (g, w, h) => {
  const r = rng(9);
  for (let i = 0; i < 700; i++) {
    const edge = r() < 0.6, x = edge ? (r() < 0.5 ? r() * 0.12 : 1 - r() * 0.12) * w : r() * w, y = r() * h;
    const cx = (x / w - 0.5) * 2 * HX, cz = (y / h - 0.5) * 2 * HZ; if (Math.hypot(cx, cz) < 24) continue;
    const s = 10 + r() * (edge ? 70 : 40), gr = g.createRadialGradient(x, y, 0, x, y, s);
    gr.addColorStop(0, `rgba(176,140,96,${0.25 + r() * 0.35})`); gr.addColorStop(1, 'rgba(176,140,96,0)'); g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, 0.35 + r() * 0.5); g.translate(-x, -y); g.fillRect(x - s, y - s, 2 * s, 2 * s); g.restore();
  }
});
const shadowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const shadowMat = new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false});
function blob(r) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r), shadowMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.04; m.renderOrder = 1; return m; }

function build() {
  const S = H.scene, fogC = new THREE.Color(FOG).convertSRGBToLinear();
  S.background = new THREE.Color(FOG); S.fog = new THREE.FogExp2(fogC.getHex(), 0.0068);
  // Reflections for the ship's metal: a dark room with a bright opening above and a thin warm seam.
  { const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({color: 0x0b0907, side: THREE.BackSide})));
    const o = new THREE.Mesh(new THREE.CircleGeometry(12, 24), new THREE.MeshBasicMaterial({color: new THREE.Color(4, 3.6, 3), side: THREE.DoubleSide})); o.position.y = 49; o.rotation.x = Math.PI / 2; es.add(o);
    const pm = new THREE.PMREMGenerator(renderer); S.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); }
  const std = (hex, map = null, metal = 0.1, rough = 0.95) => new THREE.MeshStandardMaterial({color: lin(hex), map, metalness: metal, roughness: rough, envMapIntensity: 0.4});
  const glow = (hex, k = 1) => new THREE.MeshBasicMaterial({color: lin(hex).multiplyScalar(k), toneMapped: false});
  const add = (geo, mat, x, y, z, ry = 0, parent = S, {cast = false, recv = true} = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; };
  const many = (geo, mat, list, {cast = false} = {}) => { const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(); list.forEach(([x, y, z, ry = 0, sx = 1, sy = 1, sz = 1], i) => { o.position.set(x, y, z); o.rotation.set(0, ry, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.castShadow = cast; m.receiveShadow = true; S.add(m); return m; };

  // ---- the hall: floor and sand, walls, buttresses with lamp niches, roof beams, the opening above ----
  const floor = add(new THREE.PlaneGeometry(2 * HX, 2 * HZ), std(0x8a8072, slabs(), 0.05, 0.9), 0, 0, 0); floor.rotation.x = -Math.PI / 2;
  const drift = add(new THREE.PlaneGeometry(2 * HX, 2 * HZ), new THREE.MeshStandardMaterial({map: sand(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2}), 0, 0.02, 0); drift.rotation.x = -Math.PI / 2;
  const sideM = std(0x6b6258, concrete([2 * HZ / 24, HY / 24])), endM = std(0x6b6258, concrete([2 * HX / 24, HY / 24])), roofM = std(0x2a2520, concrete([6, 6]));
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2 * HX, HY, 2 * HZ), [sideM, sideM, roofM, new THREE.MeshBasicMaterial({visible: false}), endM, endM].map(m => { m.side = THREE.BackSide; return m; }));
  shell.position.y = HY / 2; shell.receiveShadow = true; S.add(shell);
  const butM = std(0x766c60, concrete([1, HY / 12])), posts = [];
  for (const s of [-1, 1]) for (let z = -63; z <= 63; z += 18) posts.push([s * (HX - 2.5), HY / 2, z]);
  many(new THREE.BoxGeometry(5, HY, 6), butM, posts);
  many(new THREE.BoxGeometry(0.2, 1.0, 0.5), glow(0xffa050, 0.55), posts.map(([x, , z]) => [x - Math.sign(x) * 2.6, 1.4, z]));
  // Each lamp washes the buttress above it and the floor in front of it (painted on, no real lights).
  const wash = (k) => washM(0xff9a40, k);
  const up = new THREE.PlaneGeometry(9, 34).rotateY(Math.PI / 2);
  many(up, wash(0.16), posts.map(([x, , z]) => [x - Math.sign(x) * 2.65, 15, z, x > 0 ? Math.PI : 0])).receiveShadow = false;
  for (const x of [-20, 20]) add(new THREE.PlaneGeometry(14, 46), wash(0.12), x, 26, -HZ + 1.7);
  const pool = wash(0.32);
  const poolGeo = new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2); // lamp light on the floor, painted on
  many(poolGeo, pool, posts.map(([x, , z]) => [x - Math.sign(x) * 5.5, 0.05, z])).receiveShadow = false;
  many(new THREE.BoxGeometry(2 * HX, 4, 3), roofM, [-60, -36, -12, 12, 36, 60].map(z => [0, HY - 2, z]));
  const oculus = add(new THREE.CircleGeometry(7, 40), glow(0xfff0d8, 2.2), 0, HY - 0.05, 0); oculus.rotation.x = Math.PI / 2;
  const rim = add(new THREE.TorusGeometry(7.6, 0.9, 8, 40), std(0x1c1a17), 0, HY - 0.6, 0); rim.rotation.x = Math.PI / 2;
  shaft = lightShaft(7, 22, HY, 0.15); shaft.position.y = HY / 2; S.add(shaft);

  // ---- the doors you came in by (+z): two monolithic leaves, light leaking at the seam ----
  const doorM = std(0x3d3a37, ribbed([6, 1]), 0.6, 0.6);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(46, 64, 3), doorM, s * 23.2, 32, HZ - 1.6);
  add(new THREE.PlaneGeometry(0.5, 64), glow(0xff9a40, 1.5), 0, 32, HZ - 3.15).rotation.y = Math.PI;
  add(new THREE.PlaneGeometry(10, 70), wash(0.2), 0, 32, HZ - 3.2).rotation.y = Math.PI;
  add(new THREE.BoxGeometry(106, 10, 6), butM, 0, 69, HZ - 3); for (const s of [-1, 1]) add(new THREE.BoxGeometry(7, 74, 7), butM, s * 50, 37, HZ - 3.5);
  for (const x of [-12, 12]) blink.push(add(new THREE.SphereGeometry(0.5, 10, 8), glow(0xff3b30, 1.4), x, 66, HZ - 6.5));

  // ---- the back wall (−z): a carved grid, the arch into the station, BAY 3 cut into the stone ----
  const relief = [];
  for (let x = -50; x <= 50; x += 10) for (let y = 12; y <= 76; y += 10) if (!(Math.abs(x) < 16 && y < 56)) relief.push([x, y, -HZ + 0.8]);
  many(new THREE.BoxGeometry(8.4, 8.4, 1.6), std(0x6f675c, concrete([1, 1])), relief);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(5, 40, 6), butM, s * 10.5, 20, -HZ + 3);
  add(new THREE.BoxGeometry(26, 5, 6), butM, 0, 42.5, -HZ + 3);
  add(new THREE.PlaneGeometry(16, 40), new THREE.MeshBasicMaterial({color: 0x030202}), 0, 20, -HZ + 0.3);
  const deep = add(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({map: dotTex(), color: lin(0xff9a40).multiplyScalar(0.35), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}), 0, 2, -HZ + 0.4); deep.scale.set(1.6, 1, 1);
  const bay = add(new THREE.PlaneGeometry(26, 4.9), new THREE.MeshStandardMaterial({map: engraving('BAY 3'), roughness: 0.95, metalness: 0}), 0, 49.5, -HZ + 0.25);
  for (const [x, z, ry, hex] of [[-HX + 0.4, -15, Math.PI / 2, '#3a1612'], [-HX + 0.4, 3, Math.PI / 2, '#3a1612'], [-22, -HZ + 1.75, 0, '#2a2620'], [22, -HZ + 1.75, 0, '#2a2620']]) {
    add(new THREE.PlaneGeometry(5, 30), new THREE.MeshStandardMaterial({map: bannerTex(hex), roughness: 1, side: THREE.DoubleSide}), x, 52, z, ry);
  }

  // ---- the Mudlark on its pad, gear down, engines cold; the pad inlaid in the floor ----
  ship = buildTransport(); ship.root.position.set(0, -SHIP.feet[0][1], 0); ship.setLegs(1);
  for (const m of [...ship.flames, ...ship.glows, ...ship.lift.flames, ...ship.lift.glows]) m.visible = false; if (ship.eLight) ship.eLight.visible = false;
  for (const m of ship.engineGlow) m.color.setRGB(0, 0, 0); // engines cold
  ship.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  for (const m of ship.mats) m.envMapIntensity = 0.6;
  S.add(ship.root); S.add(blob(17));
  const inlay = std(0x2b2926, null, 0.6, 0.45);
  for (const [r0, r1] of [[19.4, 20.2], [5.6, 6.0]]) add(new THREE.RingGeometry(r0, r1, 96), inlay, 0, 0.03, 0).rotation.x = -Math.PI / 2;
  add(new THREE.RingGeometry(20.7, 20.9, 96), glow(0x9a6a2a, 0.5), 0, 0.035, 0).rotation.x = -Math.PI / 2;

  // ---- the checkpoint (−x): a plinth, a monolith of a desk, a cold light from above, a scanner arch ----
  const [kx, kz] = SPOTS.checkpoint;
  add(new THREE.BoxGeometry(9, 1, 14), butM, kx - 1.5, 0.5, kz);
  add(new THREE.BoxGeometry(1.6, 2.4, 5), std(0x1e1d1f, null, 0.5, 0.6), kx + 1, 2.2, kz, 0, S, {cast: true});
  add(new THREE.BoxGeometry(0.05, 0.08, 4.6), glow(0x9fd4ff, 0.7), kx + 1.82, 3.1, kz);
  const ck = new THREE.SpotLight(0xc6d8ff, 2.4, 0, 0.2, 0.7); ck.position.set(kx + 3, 46, kz); ck.target.position.set(kx + 3, 0, kz); S.add(ck, ck.target);
  const [ax, az] = SPOTS.arch, archM = std(0x2a2826, null, 0.5, 0.6);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.2, 8, 1.2), archM, ax + s * 3.6, 4, az, 0, S, {cast: true});
  add(new THREE.BoxGeometry(8.4, 0.9, 1.2), archM, ax, 8.4, az);
  scan = add(new THREE.BoxGeometry(7, 0.05, 0.08), glow(0xff5a3a, 1.2), ax, 4, az);

  // ---- the lower market (+x): containers against the wall, the Factor's alcove under an awning ----
  const contM = [std(0x4a3a2c, ribbed([3, 1], true), 0.4, 0.7), std(0x2e3236, ribbed([3, 1]), 0.5, 0.6), std(0x5a3a26, ribbed([3, 1], true), 0.4, 0.7)];
  const box = (x, y, z, ry, mi, l = 11.5) => add(new THREE.BoxGeometry(5.4, 5, l), contM[mi], x, y, z, ry, S, {cast: true});
  for (const [z, n, mi] of [[-34, 2, 0], [-22, 1, 2], [4, 2, 1], [16, 1, 2], [28, 1, 0]]) for (let k = 0; k < n; k++) box(55, 2.5 + 5 * k, z, 0, (mi + k) % 3);
  const [fx, fz] = SPOTS.factor;
  add(new THREE.BoxGeometry(1.4, 0.9, 3.4), std(0x6a5038, null, 0.1, 0.85), fx - 1.2, 0.45, fz, 0, S, {cast: true});
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.26, 8), glow(0xffa040, 1.2), fx - 1.2, 1.03, fz - 1);
  add(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8), std(0x1c1a17, null, 0.6, 0.5), fx - 1.2, 1.18, fz - 1);
  const lantern = new THREE.PointLight(0xff9a40, 1.8, 20, 2); lantern.position.set(fx - 1.2, 1.6, fz - 1); S.add(lantern);
  const clothM = std(0x5a3a22, null, 0, 1); clothM.side = THREE.DoubleSide;
  add(new THREE.BoxGeometry(8, 0.08, 13), clothM, fx + 4.5, 5.2, fz).rotation.z = 0.22; // an awning off the container tops
  const rug = add(new THREE.PlaneGeometry(6, 9), std(0x4a1a14, null, 0, 1), fx + 1, 0.04, fz); rug.rotation.x = -Math.PI / 2;
  const sackM = std(0x7a6448, null, 0, 1), jarM = std(0x6a4a34, null, 0, 0.8);
  for (const [x, z] of [[47, 13], [47.5, 7], [47, -27], [48, -33], [fx + 2.5, fz + 4]]) for (let i = 0; i < 4; i++) {
    const sx = x + (R() - 0.5) * 3, sz = z + (R() - 0.5) * 3;
    if (R() < 0.6) { const s = add(new THREE.SphereGeometry(0.5, 8, 6), sackM, sx, 0.35, sz, R() * 3, S, {cast: true}); s.scale.set(1, 0.7, 0.8); }
    else add(new THREE.CylinderGeometry(0.25, 0.32, 0.9, 8), jarM, sx, 0.45, sz, 0, S, {cast: true});
  }

  // ---- the container yard (back corner) and its hauler; a crane overhead ----
  const [yx, yz] = SPOTS.yard;
  for (const [dx, dz, n, mi] of [[-4, -6, 3, 0], [4, -6, 2, 1], [-4, 6, 1, 2], [4, 6, 2, 0]]) for (let k = 0; k < n; k++) box(yx + dx, 2.5 + 5 * k, yz + dz, 0, (mi + k) % 3, 10);
  hauler = new THREE.Group(); S.add(hauler); hauler.s = 0;
  const hm = std(0x2c2a27, ribbed([2, 1]), 0.6, 0.6);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.6, 1.6, 9.5), std(0x161514, null, 0.4, 0.8), s * 2.4, 0.8, 0, 0, hauler, {cast: true});
  add(new THREE.BoxGeometry(5.6, 1.6, 9), hm, 0, 2.2, 0, 0, hauler, {cast: true});
  add(new THREE.BoxGeometry(5, 2.6, 3), hm, 0, 4.3, 3.2, 0, hauler, {cast: true});
  add(new THREE.BoxGeometry(4.2, 0.4, 0.05), glow(0x9fd4ff, 0.4), 0, 4.9, 4.72, 0, hauler);
  add(new THREE.BoxGeometry(5.2, 3.6, 5.4), contM[2], 0, 4.8, -1.8, 0, hauler, {cast: true});
  blink.push(add(new THREE.SphereGeometry(0.28, 8, 6), glow(0xffa030, 1.5), 0, 5.8, 3.2, 0, hauler));
  crane = new THREE.Group(); S.add(crane); crane.position.y = 64;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(2, 2, 2 * HZ - 8), roofM, s * (HX - 8), 64, 0);
  const bridge = new THREE.Group(); crane.add(bridge); crane.bridge = bridge;
  add(new THREE.BoxGeometry(2 * HX - 14, 3, 3), std(0x3a342c, null, 0.5, 0.7), 0, 0, 0, 0, bridge);
  const trolley = new THREE.Group(); bridge.add(trolley); crane.trolley = trolley;
  add(new THREE.BoxGeometry(5, 2.4, 4), std(0x3a342c, null, 0.5, 0.7), 0, -2, 0, 0, trolley);
  for (const [cx, cz] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) add(new THREE.CylinderGeometry(0.06, 0.06, 15, 4), std(0x111111), cx, -10.7, cz, 0, trolley);
  add(new THREE.BoxGeometry(5.4, 5, 12), contM[0], 0, -20.7, 0, Math.PI / 2, trolley, {cast: true});
  blink.push(add(new THREE.SphereGeometry(0.3, 8, 6), glow(0xff3b30, 1.4), 0, -23.4, 0, 0, trolley));

  // ---- dust hanging in the light ----
  const N = 1400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const inShaft = i < 1000, y = R() * (inShaft ? HY - 4 : 40), rr = inShaft ? (7 + 15 * (1 - y / HY)) * Math.sqrt(R()) : 20 + R() * 40, a = R() * Math.PI * 2;
    pos.set([Math.cos(a) * rr, y, Math.sin(a) * rr], i * 3); const k = inShaft ? 0.55 + 0.45 * R() : 0.12; col.set([k, k * 0.9, k * 0.75], i * 3);
  }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  dust = new THREE.Points(dg, new THREE.PointsMaterial({size: 0.16, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  dust.frustumCulled = false; S.add(dust);

  // ---- light: little from anywhere but the opening above ----
  S.add(new THREE.HemisphereLight(lin(0xa08a6a), lin(0x2a2118), 1.0));
  // ---- Brannoc's bench under the Mudlark's nose: a slab, an engine part on a stand, tools, a hooded work lamp ----
  const [wx, wz] = SPOTS.wright, ironM = std(0x2a2826, null, 0.6, 0.55);
  add(new THREE.BoxGeometry(4.2, 1, 1.6), std(0x4a4440, null, 0.3, 0.8), wx - 1.5, 0.5, wz, 0.5, S, {cast: true});
  add(new THREE.CylinderGeometry(0.9, 1.1, 2.2, 6), ironM, wx + 1.8, 1.6, wz - 1.2, 0, S, {cast: true}).rotation.z = Math.PI / 2;
  add(new THREE.BoxGeometry(0.4, 0.5, 1.4), ironM, wx + 1.8, 0.25, wz - 1.2, 0, S, {cast: true});
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.5, 0.06, 0.08), ironM, wx - 2.6 + i * 0.5, 1.03, wz - 0.3 + (i % 2) * 0.4, 0.5 + i);
  add(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), ironM, wx - 3.4, 1.3, wz + 0.9);
  add(new THREE.ConeGeometry(0.35, 0.4, 8, 1, true), ironM, wx - 3.1, 2.55, wz + 0.6);
  const bench = new THREE.PointLight(0xffb070, 1.4, 14, 2); bench.position.set(wx - 3.1, 2.3, wz + 0.6); S.add(bench);
  const sun = new THREE.SpotLight(0xffe8c8, 3.4, 0, 0.36, 0.55); sun.position.set(0, HY - 1, 0); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 30; sun.shadow.camera.far = HY + 5; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  S.add(sun, sun.target);
  const seam = new THREE.PointLight(0xff8a30, 0.9, 40, 2); seam.position.set(0, 10, HZ - 6); S.add(seam);

  // ---- people ----
  for (const c of CAST) addAgent(c);
  H.people.customs = addAgent({look: 'proctor', h: 2.15, staff: true, mask: true, idle: OFFICER.home, face: [0, OFFICER.home[1]], key: 'customs'});
  H.people.trader = addAgent({look: 'factor', h: 1.95, hunch: 0.16, idle: [fx + 1.2, fz], face: [0, fz], key: 'trader'});
  H.people.wright = addAgent({look: 'wright', h: 2.05, mask: true, hunch: 0.08, idle: [wx + 0.4, wz + 1.6], face: [0, 0], key: 'wright'});
  resize();
}

// ---- people ----
const turnTo = (a, x, z, dt) => { const want = Math.atan2(x, z), r = a.f.root.rotation; let d = want - r.y; d = Math.atan2(Math.sin(d), Math.cos(d)); r.y += d * Math.min(1, dt * 5); };
function addAgent(c) {
  const f = c.drone ? drone() : c.guard ? guard({seed: R()}) : figure({look: c.look || 'local', h: c.h || 1.75 + R() * 0.3, seed: R(), staff: c.staff, lamp: c.lamp, mask: c.mask, hunch: c.hunch});
  const h = f.h || 1.8, a = {c: {...c, h}, f, key: c.key || null, say: c.say || (c.guard ? GUARD_SAY : null), s: 0, dir: c.rev ? -1 : 1, mode: 'idle', timer: 3 + R() * 20, shadow: blob(c.drone ? 0.9 : 0.55)};
  H.scene.add(f.root);
  if (c.drone) { H.scene.add(a.shadow); a.ang = R() * Math.PI * 2; a.mode = 'fly'; }
  else f.root.add(a.shadow);
  if (c.walk) { a.path = LOOPS[c.walk]; a.s = (c.at || 0) * pathLength(a.path); a.mode = 'walk'; }
  const p = c.idle || c.guard; if (p) { f.root.position.set(p[0], 0, p[1]); if (c.face) f.root.rotation.y = Math.atan2(c.face[0] - p[0], c.face[1] - p[1]); }
  if (c.guard) a.mode = 'post';
  // An invisible shape to tap.
  const pick = new THREE.Mesh(c.drone ? new THREE.SphereGeometry(1.2, 8, 6) : new THREE.CylinderGeometry(0.7, 0.7, h * 1.1, 8), new THREE.MeshBasicMaterial({visible: false}));
  if (!c.drone) pick.position.y = h * 0.55; pick.userData.agent = a; f.root.add(pick); H.picks.push(pick);
  H.agents.push(a); return a;
}

// The Proctor walks to the Mudlark and calls arrived() there, or walks back to the checkpoint.
let officerDone = null; const OFFICER_V = 1.5;
export function officerCome(arrived) {
  const a = H.people.customs; if (!a) { arrived && arrived(); return; }
  a.mode = 'route'; a.path = OFFICER.route; a.s = 0; a.dir = 1; officerDone = arrived;
}
export function officerLeave() {
  const a = H.people.customs; if (!a) return;
  const out = a.mode === 'route' ? a.dir > 0 : !!a.face; if (!out) return; // already back, or on the way
  if (a.mode !== 'route') a.s = pathLength(OFFICER.route, false);
  a.mode = 'route'; a.path = OFFICER.route; a.dir = -1; a.face = null; officerDone = null;
}
export function officerHome() {
  const a = H.people.customs; if (!a) return;
  a.mode = 'idle'; a.face = null; officerDone = null; a.f.root.position.set(OFFICER.home[0], 0, OFFICER.home[1]); a.f.root.rotation.y = Math.PI / 2;
}
// A gesture from the Proctor or the Factor: 'yes' (a nod), 'no' (a shake of the head), 'wave' (a raised arm).
export function gesture(key, name) { const a = H.people[key]; if (a) figGesture(a.f, name === 'wave' ? 'raise' : name); }

const P = {x: 0, z: 0, dx: 0, dz: 1};
function stepAgent(a, dt) {
  const c = a.c, r = a.f.root;
  if (a.mode === 'walk') {
    a.s += a.dir * c.v * dt; along(a.path, a.s, true, P); r.position.set(P.x, 0, P.z); turnTo(a, a.dir * P.dx, a.dir * P.dz, dt); animate(a.f, dt, c.v);
    if ((a.timer -= dt) < 0) { a.mode = 'pause'; a.timer = 3 + R() * 5; if (R() < 0.3) figGesture(a.f, R() < 0.5 ? 'yes' : 'no'); }
  } else if (a.mode === 'pause') {
    animate(a.f, dt, 0); if ((a.timer -= dt) < 0) { a.mode = 'walk'; a.timer = 15 + R() * 35; }
  } else if (a.mode === 'route') {
    const L = pathLength(a.path, false); a.s = clamp(a.s + a.dir * OFFICER_V * dt, 0, L); along(a.path, a.s, false, P); r.position.set(P.x, 0, P.z); turnTo(a, a.dir * P.dx, a.dir * P.dz, dt); animate(a.f, dt, OFFICER_V);
    if ((a.dir > 0 && a.s >= L) || (a.dir < 0 && a.s <= 0)) {
      a.mode = 'idle'; a.timer = 8;
      if (a.dir > 0) { a.face = H.cam.position; const done = officerDone; officerDone = null; done && done(); } else { a.face = null; r.rotation.y = Math.PI / 2; }
    }
  } else if (a.mode === 'fly') {
    const [x, z, rad, y, w] = c.drone; a.ang += w * dt; const s = Math.sign(w);
    r.position.set(x + rad * Math.cos(a.ang), y + 0.4 * Math.sin(t * 1.1 + x), z + rad * Math.sin(a.ang)); turnTo(a, -s * Math.sin(a.ang), s * Math.cos(a.ang), dt);
    a.shadow.position.set(r.position.x, 0.04, r.position.z); a.f.eye.visible = (t + x) % 3 > 0.15;
  } else {
    if (a.face) turnTo(a, a.face.x - r.position.x, a.face.z - r.position.z, dt);
    animate(a.f, dt, 0);
    if (a.mode === 'idle' && !a.key && (a.timer -= dt) < 0) { figGesture(a.f, R() < 0.5 ? 'yes' : 'no'); a.timer = 8 + R() * 14; }
  }
}

// ---- camera: orbit a target; drag to turn, pinch or wheel to zoom, focus() glides to a person ----
const V = {yaw: 0.29, pitch: -0.1, dist: 92, target: new THREE.Vector3(-4, 16, -30)};
const goal = {on: false, yaw: 0, pitch: 0, dist: 0, target: new THREE.Vector3()};
// Low by the doors, looking up past the Mudlark at the back wall; a tall screen stands further back and higher.
export function defaultView(snap = false) {
  const tall = H.cam.aspect < 1;
  Object.assign(goal, {on: true, yaw: tall ? 0.25 : 0.29, pitch: tall ? -0.05 : -0.1, dist: tall ? 86 : 92}); goal.target.set(tall ? 0 : -4, tall ? 20 : 16, tall ? -20 : -30);
  if (snap) snapView();
}
function snapView() { if (goal.on) { V.yaw = goal.yaw; V.pitch = goal.pitch; V.dist = goal.dist; V.target.copy(goal.target); goal.on = false; } }
export function settle() { snapView(); } // jumps to where the camera is gliding (for headless checks)
// Looks at someone a few metres away: the Factor from in front of the alcove, the Proctor from beyond, with
// the Mudlark behind. The person sits beside the card (left of it in landscape, above it in portrait).
const right = new THREE.Vector3();
export function focus(key) {
  const a = H.people[key]; if (!a) return; const p = a.f.root.position;
  const yaw = key === 'customs' ? Math.atan2(p.x, p.z) : a.f.root.rotation.y;
  Object.assign(goal, {on: true, yaw, pitch: key === 'customs' ? 0.1 : 0.3, dist: (key === 'customs' ? 6 : 6.5) + a.c.h}); goal.target.set(p.x, a.c.h * 0.62, p.z);
  if (app.clientWidth > app.clientHeight) goal.target.add(right.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(goal.dist * 0.3));
  else goal.target.y -= goal.dist * 0.2;
}
export function orbit(dx, dy) { goal.on = false; V.yaw -= dx * 0.006; V.pitch = clamp(V.pitch + dy * 0.004, -0.4, 1.2); }
export function zoom(f) { goal.on = false; V.dist = clamp(V.dist * f, 6, 110); }
const ang = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
function updateCamera(dt) {
  if (goal.on) {
    const k = 1 - Math.exp(-dt * 3.5); V.yaw = ang(V.yaw, goal.yaw, k); V.pitch += (goal.pitch - V.pitch) * k; V.dist += (goal.dist - V.dist) * k; V.target.lerp(goal.target, k);
    if (Math.abs(goal.dist - V.dist) < 0.05 && V.target.distanceTo(goal.target) < 0.05) goal.on = false;
  }
  const cp = Math.cos(V.pitch), p = H.cam.position;
  p.set(V.target.x + V.dist * Math.sin(V.yaw) * cp, V.target.y + V.dist * Math.sin(V.pitch), V.target.z + V.dist * Math.cos(V.yaw) * cp);
  p.x = clamp(p.x, -HX + 6, HX - 6); p.z = clamp(p.z, -HZ + 4, HZ - 4); p.y = clamp(p.y, 1.5, HY - 8);
  // Not inside the Mudlark: push out from its hull, a flattened sphere round the pad.
  const sx = p.x, sy = (p.y - 6) * 2.2, sz = p.z, d = Math.hypot(sx, sy, sz); if (d < 16) { const k = 16 / Math.max(d, 1e-3); p.x = sx * k; p.y = 6 + sy * k / 2.2; p.z = sz * k; }
  H.cam.lookAt(V.target);
}

// ---- picking ----
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
// The agent under a screen point (client pixels), or null.
export function pick(x, y) {
  const r = app.getBoundingClientRect(); ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, H.cam); const hit = ray.intersectObjects(H.picks, false)[0];
  return hit ? hit.object.userData.agent : null;
}
// Where an agent's head is on screen, in pixels relative to the app; null when behind the camera.
const sp = new THREE.Vector3();
export function screenOf(a, out) {
  a.f.root.getWorldPosition(sp); sp.y += a.c.drone ? 1 : a.c.h * 1.05; sp.project(H.cam);
  if (sp.z > 1) return null; out.x = (sp.x + 1) / 2 * app.clientWidth; out.y = (1 - sp.y) / 2 * app.clientHeight; return out;
}

// ---- per frame ----
export function resize() { H.cam.aspect = app.clientWidth / Math.max(1, app.clientHeight); H.cam.fov = H.cam.aspect < 1 ? 70 : 55; H.cam.updateProjectionMatrix(); }
export function updateHangar(dt) {
  t += dt;
  for (const a of H.agents) stepAgent(a, dt);
  if (hauler) { hauler.s += 2.4 * dt; along(HAULER, hauler.s, true, P); hauler.position.set(P.x, 0, P.z); hauler.rotation.y = Math.atan2(P.dx, P.dz); }
  if (crane) { crane.bridge.position.z = 36 * Math.sin(t * 0.035); crane.trolley.position.x = 22 * Math.sin(t * 0.05 + 1); }
  if (scan) scan.position.y = 4 + 3.4 * Math.sin(t * 1.3);
  if (shaft) shaft.material.uniforms.time.value = t;
  if (dust) { const p = dust.geometry.attributes.position, a = p.array; for (let i = 0; i < p.count; i++) { let y = a[i * 3 + 1] - dt * 0.05; if (y < 0) y += i < 1000 ? HY - 4 : 40; a[i * 3 + 1] = y; a[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.04; } p.needsUpdate = true; }
  const on = (t % 1.8) < 0.5; for (const b of blink) b.visible = on;
  if (ship) { ship.strobe.visible = (t % 1.6) < 0.12; ship.dish.rotation.y += dt * 0.3; }
  if (app.clientWidth / Math.max(1, app.clientHeight) !== H.cam.aspect) resize();
  updateCamera(dt);
}
export function renderHangar() { renderer.clear(); renderer.render(H.scene, H.cam); }
