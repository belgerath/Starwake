// The player's ship: a small, battered transport about 35 m long, built from primitives in metres
// (nose along −z, deck along +y). A saucer hull with two cargo prongs at the front, a cockpit pod on the
// right, a wide engine glowing across the back, four lift thrusters and the landing gear under the belly,
// and two small gun turrets (top and bottom). Same interface as the Halberd's model (see world.js).
import * as THREE from 'three';
import {SHIP} from '../config.js';
import {lin, rng, glowTex} from '../util.js';
import {panelTextures, boxUV, bbox} from './destroyer.js';

const UV = 6; // metres per hull panel texture tile
// Saucer profile (radius, height), bottom centre to top centre. The rim is at 12 m.
const PROFILE = [[0, -2.4], [4, -2.35], [7, -2.15], [9.5, -1.75], [11.2, -1.05], [11.9, -0.3], [12, 0.2], [11.7, 0.85], [10.4, 1.4], [8, 1.85], [5, 2.15], [2, 2.3], [0, 2.32]];
// Height of the hull's top (or bottom) surface at radius r.
function surfY(r, top) {
  const pts = top ? PROFILE.slice(6).reverse() : PROFILE.slice(0, 7);
  for (let i = 0; i < pts.length - 1; i++) { const [r0, y0] = pts[i], [r1, y1] = pts[i + 1]; if (r >= r0 && r <= r1) return y0 + (y1 - y0) * (r - r0) / (r1 - r0); }
  return pts[pts.length - 1][1];
}
// Texture coordinates projected from above, for the flat saucer surfaces.
function planarUV(g) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / UV; uv[i * 2 + 1] = p.getZ(i) / UV; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

export function buildTransport() {
  const root = new THREE.Group(), vis = new THREE.Group(); root.add(vis);
  const T = panelTextures();
  const std = (hex, metal, rough) => new THREE.MeshStandardMaterial({map: T.map, roughnessMap: T.rough, bumpMap: T.map, bumpScale: 0.06, color: lin(hex), metalness: metal, roughness: rough});
  const hullM = std(0xe4ded2, 0.3, 0.85), plateM = std(0xb8b2a6, 0.35, 0.85), darkM = std(0x3a3e45, 0.5, 0.75), rustM = std(0x8a5236, 0.25, 0.9);
  const accentM = new THREE.MeshStandardMaterial({color: lin(0xffb14a), metalness: 0.25, roughness: 0.55, emissive: lin(0x2a1600)});
  const glassM = new THREE.MeshStandardMaterial({color: lin(0x0b1622), emissive: lin(0x3c6f96), emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.15});
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = vis) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  const box = (w, h, d, b = 0.04) => bbox(w, h, d, b, UV);

  // Saucer hull.
  add(planarUV(new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 72)), hullM, 0, 0, 0);
  // Cargo prongs: top-view outline (x, z) extruded 2.2 m tall.
  const prong = s => {
    const pts = [[1.5, -7.5], [5.4, -7.5], [5.0, -15], [4.3, -20.2], [3.4, -21], [1.5, -21]], sh = new THREE.Shape();
    pts.forEach(([x, z], i) => i ? sh.lineTo(s * x, -z) : sh.moveTo(s * x, -z));
    const g = new THREE.ExtrudeGeometry(sh, {depth: 2.0, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, steps: 1});
    g.rotateX(-Math.PI / 2); g.translate(0, -1.0, 0); return boxUV(g, UV);
  };
  [-1, 1].forEach(s => {
    add(prong(s), hullM, 0, 0, 0);
    add(box(2.6, 0.08, 1.2), accentM, s * 3.4, 1.12, -18.8);                      // amber band near the tip
    add(box(2.4, 0.1, 6.5), plateM, s * 3.4, 1.12, -12.5);                         // plating along the top
    for (let k = 0; k < 4; k++) add(box(0.5, 0.3, 0.5), darkM, s * 5.1, 0.2, -9.5 - k * 2.4); // clamps on the outer side
  });
  add(box(2.6, 1.2, 0.8), darkM, 0, 0.2, -11.6);                                   // cargo door between the prongs

  // Cockpit pod on the right, with a connecting tube. Hidden from inside (the cockpit view draws its own interior).
  const hideInCockpit = [];
  const pod = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = add(geo, mat, x, y, z, rx, ry, rz); hideInCockpit.push(m); return m; };
  pod(new THREE.CylinderGeometry(1.0, 1.0, 3.8, 16), plateM, 8.6, 0.5, -6.6, 0, 0, Math.PI / 2);
  pod(new THREE.CylinderGeometry(1.45, 1.45, 6.5, 24), hullM, 10.6, 0.5, -9.2, Math.PI / 2, 0, 0);
  pod(new THREE.CylinderGeometry(0.7, 1.45, 1.6, 24), glassM, 10.6, 0.5, -13.25, -Math.PI / 2, 0, 0);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pod(new THREE.BoxGeometry(0.08, 0.08, 1.7), darkM, 10.6 + Math.cos(a) * 1.08, 0.5 + Math.sin(a) * 1.08, -13.2, Math.sin(a) * 0.45, -Math.cos(a) * 0.45, 0); }
  pod(new THREE.TorusGeometry(1.46, 0.09, 8, 28), darkM, 10.6, 0.5, -12.45);
  pod(new THREE.TorusGeometry(0.72, 0.07, 8, 20), darkM, 10.6, 0.5, -14.05);

  // Top: trench lines and greebles, rust patches, the gun turret, the radar dish.
  const gr = rng(23);
  for (let i = 0; i < 14; i++) {
    const a = (i + 0.5) / 14 * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) < 0) continue; // keep the front between the prongs clear
    for (let r = 3.6; r < 10.6; r += 1.7) {
      const y = surfY(r + 0.6, true), slope = Math.atan2(surfY(r, true) - surfY(r + 1.2, true), 1.2);
      const m = add(box(0.3, 0.14, 1.35, 0.03), gr() < 0.75 ? darkM : plateM, Math.sin(a) * (r + 0.6), y + 0.03, Math.cos(a) * (r + 0.6), 0, a, 0);
      m.rotateX(slope);
    }
  }
  for (let i = 0; i < 46; i++) {
    const a = gr() * Math.PI * 2, r = 3 + gr() * 7.5, w = 0.3 + gr() * 1.2, h = 0.1 + gr() * 0.35, d = 0.3 + gr() * 1.4;
    add(box(w, h, d, 0.03), gr() < 0.35 ? darkM : gr() < 0.08 ? rustM : plateM, Math.sin(a) * r, surfY(r, true) + h / 2 - 0.05, Math.cos(a) * r, 0, a, 0);
  }
  for (let i = 0; i < 3; i++) { const a = gr() * Math.PI * 2, r = 4 + gr() * 6; add(box(1.4 + gr() * 1.6, 0.05, 1 + gr() * 1.5, 0.02), rustM, Math.sin(a) * r, surfY(r, true) + 0.02, Math.cos(a) * r, 0, a, 0); }
  function turret(y, s) {
    const g = new THREE.Group(); g.position.set(0, y, 0.5); vis.add(g);
    add(new THREE.CylinderGeometry(2.4, 2.6, 0.35, 32), darkM, 0, 0, 0, 0, 0, 0, g);
    add(new THREE.SphereGeometry(0.85, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), plateM, 0, s * 0.15, 0, s < 0 ? Math.PI : 0, 0, 0, g);
    [-0.25, 0.25].forEach(x => add(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), darkM, x, s * 0.5, -1.6, -Math.PI / 2, 0, 0, g));
    return g;
  }
  turret(surfY(0, true) + 0.12, 1); turret(surfY(0, false) - 0.12, -1);
  const dish = new THREE.Group(); dish.position.set(5, surfY(5.8, true), -3); vis.add(dish);
  add(new THREE.CylinderGeometry(0.12, 0.18, 1.0, 8), darkM, 0, 0.5, 0, 0, 0, 0, dish);
  const dm = add(new THREE.SphereGeometry(1.5, 20, 8, 0, Math.PI * 2, 0, 0.75), plateM.clone(), 0, 1.15, 0, -0.5, 0, 0, dish); dm.material.side = THREE.DoubleSide;
  const strobe = add(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({color: 0xffffff, toneMapped: false}), 0, 1.25, 0, 0, 0, 0, dish);

  // Belly: panels, the gear bays, the lift thrusters.
  for (let i = 0; i < 10; i++) { const a = gr() * Math.PI * 2, r = 3 + gr() * 6; add(box(1 + gr() * 1.5, 0.08, 0.8 + gr() * 1.4, 0.02), gr() < 0.5 ? darkM : plateM, Math.sin(a) * r, surfY(r, false) - 0.03, Math.cos(a) * r, 0, a, 0); }
  const glowM = (hex) => new THREE.MeshBasicMaterial({color: lin(hex), toneMapped: false});
  const fade = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 128; const g = c.getContext('2d'); const gd = g.createLinearGradient(0, 0, 0, 128); gd.addColorStop(0, '#000'); gd.addColorStop(0.55, '#444'); gd.addColorStop(1, '#fff'); g.fillStyle = gd; g.fillRect(0, 0, 4, 128); return new THREE.CanvasTexture(c); })();
  const glowT = glowTex([[0, 'rgba(220,245,255,1)'], [0.2, 'rgba(120,200,255,0.55)'], [0.6, 'rgba(60,140,255,0.1)'], [1, 'rgba(40,100,255,0)']]);
  // A flame: an additive cone from p along direction d; its length is scaled each frame (world.js).
  const flame = (p, d, r, list, op) => {
    const g = new THREE.ConeGeometry(r, 1, 16, 1, true); g.translate(0, 0.5, 0); // base at the origin, tip 1 m along +y
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: lin(0x8fd4ff), alphaMap: fade, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false}));
    m.position.copy(p); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); m.userData.op = op; vis.add(m); list.push(m); return m;
  };
  const sprite = (p, size, list) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: glowT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false})); sp.position.copy(p); sp.scale.set(size, size, 1); sp.userData.base = size; vis.add(sp); list.push(sp); return sp; };
  const lift = {flames: [], glows: [], len: 5};
  for (const [x, z] of [[4.5, 4.5], [-4.5, 4.5], [4.5, -4.5], [-4.5, -4.5]]) {
    const y = surfY(Math.hypot(x, z), false) - 0.06;
    add(new THREE.CylinderGeometry(0.95, 1.05, 0.25, 20), darkM, x, y + 0.05, z);
    add(new THREE.CircleGeometry(0.75, 20), glowM(0x9fdcff), x, y - 0.08, z, Math.PI / 2, 0, 0);
    flame(new THREE.Vector3(x, y - 0.1, z), new THREE.Vector3(0, -1, 0), 0.65, lift.flames, 0.75);
    sprite(new THREE.Vector3(x, y - 0.6, z), 3.2, lift.glows);
  }
  // Landing gear: a strut and a pad under each foot, sliding out of the belly. setLegs(k): 0 stowed, 1 down.
  const legs = [];
  for (const [x, , z] of SHIP.feet) {
    const top = surfY(Math.hypot(x, z), false), g = new THREE.Group(); g.position.set(x, top, z); vis.add(g);
    add(box(1.9, 0.08, 1.9, 0.02), darkM, x, top - 0.02, z);
    const sg = new THREE.CylinderGeometry(0.22, 0.26, 1, 10); sg.translate(0, -0.5, 0);
    const strut = add(sg, plateM, 0, 0, 0, 0, 0, 0, g);
    const pad = add(new THREE.CylinderGeometry(0.85, 0.95, 0.16, 16), darkM, 0, 0, 0, 0, 0, 0, g);
    const full = top - SHIP.feet[0][1] - 0.16; // strut length that puts the pad's bottom on the contact point
    legs.push({g, strut, pad, full});
  }
  const setLegs = k => { const e = k * k * (3 - 2 * k); for (const l of legs) { l.g.visible = k > 0; const L = 0.3 + (l.full - 0.3) * e; l.strut.scale.y = L; l.pad.position.y = -L - 0.08; } };
  setLegs(0);

  // Engine: a wide glowing band across the back of the rim, with flames and glows behind it.
  const engM = glowM(0xbfeaff);
  add(new THREE.CylinderGeometry(12.06, 12.06, 1.25, 48, 1, true, -0.95, 1.9), engM, 0, 0.22, 0);
  [-0.68, 0.98].forEach(y => add(new THREE.CylinderGeometry(12.1, 12.1, 0.12, 48, 1, true, -0.98, 1.96), darkM, 0, y, 0));
  for (let k = 0; k < 9; k++) { const a = -0.88 + k * 0.22; add(new THREE.BoxGeometry(0.12, 1.3, 0.12), darkM, Math.sin(a) * 12.1, 0.22, Math.cos(a) * 12.1, 0, a, 0); }
  const flames = [], glows = [];
  const back = new THREE.Vector3(0, 0, 1); // thrust goes straight back: a sheet of soft, overlapping flames along the band
  for (let k = 0; k < 13; k++) { const a = -0.84 + k * 0.14; flame(new THREE.Vector3(Math.sin(a) * 12.1, 0.22, Math.cos(a) * 12.1), back, 0.85, flames, 0.32); }
  [-0.55, 0, 0.55].forEach(a => sprite(new THREE.Vector3(Math.sin(a) * 13, 0.22, Math.cos(a) * 13), 7, glows));
  const eLight = new THREE.PointLight(0x7cc8ff, 2.5, 60, 2); eLight.position.set(0, 0.5, 16); vis.add(eLight);

  // Lights and windows.
  const nav = [];
  [[-12.08, 0.3, 0, 0xff3b30], [12.08, 0.3, 0, 0x30ff7a], [0, 1.6, 9.6, 0xffffff]].forEach(([x, y, z, c]) => nav.push(add(new THREE.SphereGeometry(0.12, 8, 6), glowM(c), x, y, z)));
  const winPos = []; const wr = rng(31);
  for (let a = 0.35; a < 2.4; a += 0.11) { if (wr() < 0.35) continue; winPos.push([Math.sin(a) * 12.02, 0.45, Math.cos(a) * 12.02, a]); }
  const winI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.32, 0.18, 0.05), new THREE.MeshBasicMaterial({color: new THREE.Color(1.0, 0.78, 0.5), toneMapped: false}), winPos.length);
  const o3 = new THREE.Object3D(); winPos.forEach((p, i) => { o3.position.set(p[0], p[1], p[2]); o3.rotation.set(0, p[3], 0); o3.updateMatrix(); winI.setMatrixAt(i, o3.matrix); }); vis.add(winI);

  vis.traverse(m => { if (m.isMesh && m.material && m.material.isMeshStandardMaterial) { m.castShadow = true; m.receiveShadow = true; } });
  const mats = new Set(); vis.traverse(m => { if (m.isMesh && m.material && m.material.isMeshStandardMaterial) mats.add(m.material); });
  return {root, vis, flames, glows, lift, hideInCockpit, strobe, dish, nav, eLight, setLegs, mats: [...mats], eye: new THREE.Vector3(...SHIP.eye), flameLen: 5};
}
