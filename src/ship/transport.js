// The player's ship, the Mudlark: a 35 m transport in the Harkonnen manner, black, faceted and heavy, built
// from primitives in metres (nose along −z, deck along +y). A hull lofted through angular sections from a
// knife-edge nose to a broad stern, blades along the spine, spikes off the chines, swept fins at the stern, a
// raised cockpit with a slit of red light, three hexagonal engines glowing orange, four lift thrusters and the
// landing gear under the belly, small turrets top and bottom. It fits the contact points in TRANSPORT
// (config.js), so it flies and lands exactly as before. Same interface as the Halberd's model (see world.js).
import * as THREE from 'three';
import {SHIP, hullRing} from '../config.js';
import {lin, rng, glowTex} from '../util.js';
import {panelTextures, boxUV, bbox} from './destroyer.js';

const UV = 6; // metres per hull panel texture tile
const SECTIONS = SHIP.sections; // nose to stern (config.js)
// A section's values at any z (linear between the listed ones).
function at(z) {
  for (let i = 0; i < SECTIONS.length - 1; i++) {
    const a = SECTIONS[i], b = SECTIONS[i + 1]; if (z > b.z && i < SECTIONS.length - 2) continue;
    const k = Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z))), o = {z};
    for (const key of ['w', 't', 'c', 'b', 'bw']) o[key] = a[key] + (b[key] - a[key]) * k;
    return o;
  }
}
// Height of the hull's underside at (x, z): the flat belly, then the lower flank up to the chine.
export function hullLowY(x, z) { const s = at(z), ax = Math.abs(x); return ax <= s.bw ? s.b : s.b + (s.c - s.b) * Math.min(1, (ax - s.bw) / (s.w - s.bw)); }
// The hull: faceted quads between the sections, capped at the nose and the stern (flat shading shows the facets).
function hullGeometry() {
  const pos = [], tri = (a, b, c) => pos.push(...a, ...b, ...c), P = SECTIONS.map(hullRing), n = 7;
  for (let i = 0; i < P.length - 1; i++) for (let k = 0; k < n; k++) { const k1 = (k + 1) % n, a0 = P[i][k], a1 = P[i][k1], b0 = P[i + 1][k], b1 = P[i + 1][k1]; tri(a0, b0, b1); tri(a0, b1, a1); }
  for (const [p, front] of [[P[0], true], [P[P.length - 1], false]]) {
    const c = [0, 0, p[0][2]]; p.forEach(q => { c[1] += q[1] / n; });
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; front ? tri(c, p[k], p[k1]) : tri(c, p[k1], p[k]); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return boxUV(g, UV);
}
// A blade: a flat triangle swept back, length L along z, height H, thickness d; its base on y = 0 from z = 0.
function blade(L, H, d) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(L, 0); s.lineTo(L * 0.92, H); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth: d, bevelEnabled: false}); g.translate(0, 0, -d / 2); g.rotateY(-Math.PI / 2); // shape x → +z, extrusion → x
  return boxUV(g, UV);
}

export function buildTransport() {
  const root = new THREE.Group(), vis = new THREE.Group(); root.add(vis);
  const T = panelTextures();
  // Rough and barely metallic: smoother black plate turns white when it mirrors a low sun (landing on Tal).
  const std = (hex, metal, rough) => new THREE.MeshStandardMaterial({map: T.map, bumpMap: T.map, bumpScale: 0.05, color: lin(hex), metalness: metal, roughness: rough, flatShading: true});
  const hullM = std(0x2a2b2f, 0.15, 1), plateM = std(0x3a3b40, 0.3, 0.85), darkM = std(0x141518, 0.2, 0.95), redM = std(0x5a1a12, 0.2, 0.85);
  const glowM = (hex, k = 1) => new THREE.MeshBasicMaterial({color: lin(hex).multiplyScalar(k), toneMapped: false});
  const slitM = new THREE.MeshStandardMaterial({color: lin(0x0c0606), emissive: lin(0xff4a1a), emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2});
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = vis) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  const box = (w, h, d, b = 0.04) => bbox(w, h, d, b, UV);

  // Hull, and a raised keel of darker plates down the spine.
  add(hullGeometry(), hullM, 0, 0, 0);
  for (let z = -12; z < 12; z += 3.2) { const s = at(z + 1.4); add(box(1.4, 0.35, 2.8), darkM, 0, s.t + 0.05, z + 1.4, -Math.atan2(at(z + 2.8).t - at(z).t, 2.8)); }
  // Blades along the spine, tallest amidships, all swept back.
  [[-8, 2.8, 1.6], [-4.5, 3.2, 2.4], [-1, 3.6, 3.1], [2.8, 3.4, 2.6], [5.8, 2.4, 1.5]].forEach(([z, L, H]) => add(blade(L, H, 0.28), darkM, 0, Math.min(at(z).t, at(z + L).t) + 0.1, z));
  // Spikes off the chines, pointing out and back.
  const spike = new THREE.ConeGeometry(0.32, 3.2, 4), up = new THREE.Vector3(0, 1, 0);
  for (const s of [-1, 1]) for (const z of [-12, -6.5, -1]) { const c = at(z); add(spike, darkM, s * (c.w + 1.1), c.c, z + 0.8).quaternion.setFromUnitVectors(up, new THREE.Vector3(s * 0.86, 0.12, 0.5).normalize()); }
  // Swept fins at the stern, angled down, with a dark red edge.
  for (const s of [-1, 1]) {
    const f = new THREE.Shape(); f.moveTo(0, 0); f.lineTo(9, 0); f.lineTo(11, 2.8); f.lineTo(4, 2.8); f.closePath();
    const g = new THREE.ExtrudeGeometry(f, {depth: 0.3, bevelEnabled: false}); g.rotateX(Math.PI / 2); g.rotateY(-Math.PI / 2); boxUV(g, UV);
    add(g, hullM, s * 8.8, -0.2, 1.5, 0, 0, s * 0.12).scale.x = -s; // span outward from the hull, tilted up a little
    add(box(0.3, 0.34, 7), redM, s * 11.55, 0.12, 9, 0, 0, s * 0.12);
  }

  // Cockpit: an angular block on the spine near the nose, with a slit of red-lit glass. Hidden from inside
  // (the cockpit view draws its own interior).
  const hideInCockpit = [];
  const pod = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = add(geo, mat, x, y, z, rx, ry, rz); hideInCockpit.push(m); return m; };
  const ck = at(-11);
  pod(box(3.2, 1.1, 5.2, 0.1), plateM, 0, ck.t + 0.35, -10.6, 0.12);
  pod(box(2.6, 0.18, 0.5, 0.02), slitM, 0, ck.t + 0.55, -13.25, 0.5);
  for (const s of [-1, 1]) pod(box(0.18, 0.12, 2.6, 0.02), slitM, s * 1.62, ck.t + 0.45, -11.4);

  // Lift thrusters and landing gear under the belly.
  const glowT = glowTex([[0, 'rgba(255,220,170,1)'], [0.2, 'rgba(255,150,70,0.55)'], [0.6, 'rgba(255,90,30,0.1)'], [1, 'rgba(255,60,20,0)']]);
  const fade = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const gd = g.createLinearGradient(0, 0, 0, 128); gd.addColorStop(0, '#000'); gd.addColorStop(0.55, '#444'); gd.addColorStop(1, '#fff'); g.fillStyle = gd; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); })();
  // A flame: an additive cone from p along direction d; its length is scaled each frame (world.js).
  const flame = (p, d, r, list, op) => {
    const g = new THREE.ConeGeometry(r, 1, 16, 1, true); g.translate(0, 0.5, 0); // base at the origin, tip 1 m along +y
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: lin(0xffa060), alphaMap: fade, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
    m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); m.userData.op = op; vis.add(m); list.push(m); return m;
  };
  const sprite = (p, size, list) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false})); sp.position.copy(p); sp.scale.set(size, size, 1); sp.userData.base = size; vis.add(sp); list.push(sp); return sp; };
  const lift = {flames: [], glows: [], len: 5}, liftM = glowM(0xff8a40);
  for (const [x, z] of [[4.5, 4.5], [-4.5, 4.5], [4.5, -4.5], [-4.5, -4.5]]) {
    const y = hullLowY(x, z);
    add(new THREE.CylinderGeometry(0.95, 1.05, 0.25, 6), darkM, x, y - 0.05, z);
    add(new THREE.CircleGeometry(0.75, 6), liftM, x, y - 0.19, z, Math.PI / 2, 0, 0);
    flame(new THREE.Vector3(x, y - 0.2, z), new THREE.Vector3(0, -1, 0), 0.65, lift.flames, 0.75);
    sprite(new THREE.Vector3(x, y - 0.7, z), 3.2, lift.glows);
  }
  const legs = [];
  for (const [x, , z] of SHIP.feet) {
    const top = hullLowY(x, z), g = new THREE.Group(); g.position.set(x, top, z); vis.add(g);
    add(box(1.9, 0.1, 1.9, 0.02), darkM, x, top - 0.02, z);
    const sg = new THREE.CylinderGeometry(0.24, 0.28, 1, 6); sg.translate(0, -0.5, 0);
    const strut = add(sg, plateM, 0, 0, 0, 0, 0, 0, g);
    const pad = add(new THREE.CylinderGeometry(0.8, 1.0, 0.16, 6), darkM, 0, 0, 0, 0, 0, 0, g);
    const full = top - SHIP.feet[0][1] - 0.16; // strut length that puts the pad's bottom on the contact point
    legs.push({g, strut, pad, full});
  }
  const setLegs = k => { const e = k * k * (3 - 2 * k); for (const l of legs) { l.g.visible = k > 0; const L = 0.3 + (l.full - 0.3) * e; l.strut.scale.y = L; l.pad.position.y = -L - 0.08; } };
  setLegs(0);

  // Turrets: a hexagonal base and twin barrels, on the spine behind the blades and under the belly.
  function turret(y, z, s) {
    const g = new THREE.Group(); g.position.set(0, y, z); vis.add(g);
    add(new THREE.CylinderGeometry(1.3, 1.5, 0.4, 6), darkM, 0, 0, 0, 0, 0, 0, g);
    add(box(1.4, 0.7, 1.6, 0.06), plateM, 0, s * 0.45, 0, 0, 0, 0, g);
    [-0.3, 0.3].forEach(x => add(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), darkM, x, s * 0.5, -1.7, -Math.PI / 2, 0, 0, g));
    return g;
  }
  turret(at(11.5).t + 0.15, 11.5, 1); turret(at(-4).b - 0.15, -4, -1);
  // A sensor mast on the stern that turns slowly, a red strobe on top.
  const dish = new THREE.Group(); dish.position.set(-3.4, at(10).t * 0.8 + 0.2, 10); vis.add(dish);
  add(new THREE.CylinderGeometry(0.1, 0.16, 1.4, 6), darkM, 0, 0.7, 0, 0, 0, 0, dish);
  add(box(2.6, 0.14, 0.3, 0.02), plateM, 0, 1.45, 0, 0, 0, 0, dish);
  const strobe = add(new THREE.SphereGeometry(0.1, 8, 6), glowM(0xff3b30, 1.5), 0, 1.6, 0, 0, 0, 0, dish);

  // Engines: three hexagonal nozzles in the stern, glowing orange, with flames and glows behind them.
  const st = SECTIONS[SECTIONS.length - 1], engM = glowM(0xff6a2a, 0.6);
  const flames = [], glows = [];
  for (const x of [-4.4, 0, 4.4]) {
    add(new THREE.CylinderGeometry(1.45, 1.6, 1.2, 6), darkM, x, 0.5, st.z + 0.5, Math.PI / 2, 0, 0);
    add(new THREE.CircleGeometry(1.1, 6), engM, x, 0.5, st.z + 1.12, 0, 0, Math.PI / 6); // turned to match the nozzle's corners
    flame(new THREE.Vector3(x, 0.5, st.z + 1.1), new THREE.Vector3(0, 0, 1), 1.0, flames, 0.4);
    sprite(new THREE.Vector3(x, 0.5, st.z + 1.6), 6, glows);
  }
  const eLight = new THREE.PointLight(0xff8a40, 2.5, 60, 2); eLight.position.set(0, 0.5, 18); vis.add(eLight);

  // Lights: red and green on the chines, white at the stern; slits of light along the flanks.
  const nav = [], mid = at(6);
  [[-mid.w - 0.05, mid.c + 0.1, 6, 0xff3b30], [mid.w + 0.05, mid.c + 0.1, 6, 0x30ff7a], [0, st.t + 0.2, st.z - 0.4, 0xffffff]].forEach(([x, y, z, c]) => nav.push(add(new THREE.SphereGeometry(0.12, 8, 6), glowM(c), x, y, z)));
  const winPos = [], wr = rng(31);
  // On the facet between shoulder and chine, 0.51 of the way down; a = the facet's tilt from upright.
  for (const s of [-1, 1]) for (let z = -6; z < 10; z += 1.1) { if (wr() < 0.4) continue; const c = at(z), a = Math.atan2(0.45 * c.w, 0.74 * c.t - c.c); winPos.push([s * (0.78 * c.w + 0.03 * Math.sin(a)), 0.362 * c.t + 0.511 * c.c + 0.03 * Math.cos(a), z, s * a]); }
  const winI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.14, 0.7), glowM(0xff6a2a, 0.7), winPos.length);
  const o3 = new THREE.Object3D(); winPos.forEach((p, i) => { o3.position.set(p[0], p[1], p[2]); o3.rotation.set(0, 0, p[3]); o3.updateMatrix(); winI.setMatrixAt(i, o3.matrix); }); vis.add(winI);

  vis.traverse(m => { if (m.isMesh && m.material && m.material.isMeshStandardMaterial) { m.castShadow = true; m.receiveShadow = true; } });
  const mats = new Set(); vis.traverse(m => { if (m.isMesh && m.material && m.material.isMeshStandardMaterial) mats.add(m.material); });
  // engineGlow: the engines' nozzles and the lift thrusters' discs, for dimming when the engines are cold (the hangar).
  return {root, vis, flames, glows, lift, hideInCockpit, strobe, dish, nav, eLight, setLegs, engineGlow: [engM, liftM], mats: [...mats], eye: new THREE.Vector3(...SHIP.eye), flameLen: 5};
}
