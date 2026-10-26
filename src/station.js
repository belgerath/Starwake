// Tumbledown: a huge, ramshackle station for outcasts and misfits, built from primitives in metres in the
// station frame (STATION in config.js: −z along its orbit, +y away from Veyra). A hub along z with the docking
// bay in its +z end behind sliding doors and a neon sign above it, a ring spinning around the middle with
// shacks and lit windows on it, solar wings and a dish at the front, bolted-on modules in mismatched paint,
// red beacons, and two rows of guide lights leading into the bay. update(t, bay, rt) turns the ring (with the
// physics' ringAngle, which the collision uses too), slides the doors (0 shut .. 1 open) and runs the lights.
import * as THREE from 'three';
import {STATION} from './config.js';
import {lin, rng} from './util.js';
import {panelTextures} from './ship/destroyer.js';
import {ringAngle} from './physics.js';

const {hubR, hubLen, ringR, ringTube, spokeR, bay: BAY, wings: WING, dish: DISH} = STATION;
const AFT = hubLen / 2; // the bay end of the hub
const PAINT = [0x8a5236, 0x3d6f6b, 0xb08a3e, 0x8c3b33, 0x8d9097, 0xd8cfb8, 0x6b6f45, 0x4a5a78, 0xa8a196]; // mismatched paint

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
// The hull panel texture, repeated rx × ry times over a surface's texture coordinates.
function tiled(T, rx, ry) {
  const map = T.map.clone(), rough = T.rough.clone();
  for (const t of [map, rough]) { t.repeat.set(rx, ry); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; }
  return {map, rough};
}

export function buildStation() {
  const root = new THREE.Group(), ring = new THREE.Group(); root.add(ring);
  const T = panelTextures(), r = rng(57), o3 = new THREE.Object3D(), col = new THREE.Color(), m4 = new THREE.Matrix4();
  const std = (hex, tex, metal = 0.35, rough = 0.85) => new THREE.MeshStandardMaterial({map: tex ? tex.map : null, roughnessMap: tex ? tex.rough : null, color: lin(hex), metalness: metal, roughness: rough});
  const glow = hex => new THREE.MeshBasicMaterial({color: lin(hex), toneMapped: false});
  const hubM = std(0xc9c3b6, tiled(T, 18, 14)), ringM = std(0xbdb7aa, tiled(T, 90, 4)), darkM = std(0x3b3f46, tiled(T, 6, 6), 0.5, 0.75);
  const plainM = std(0xffffff, tiled(T, 1, 1), 0.25, 0.85); // instanced clutter, coloured per instance
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  // Filled with put(); the colour buffer is made up front (three.js 0.128 would size it from count, which starts at 0).
  const instanced = (geo, mat, n, parent = root) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.count = 0; parent.add(m); return m; };
  const put = (m, matrix, hex) => { m.setMatrixAt(m.count, matrix); m.setColorAt(m.count, col.set(hex).convertSRGBToLinear()); m.count++; };

  // ---- hub: banded, tapering at the front to the dish, the bay end capped around the bay mouth ----
  add(new THREE.CylinderGeometry(hubR, hubR, hubLen, 48, 1, true), hubM, 0, 0, 0, Math.PI / 2);
  for (let z = -AFT + 60; z < AFT - 40; z += 140) add(new THREE.TorusGeometry(hubR + 1.5, 5, 6, 48), darkM, 0, 0, z);
  add(new THREE.CylinderGeometry(hubR * 0.45, hubR, 70, 48), hubM, 0, 0, -AFT - 35, -Math.PI / 2);
  const cap = new THREE.Shape(); cap.absarc(0, 0, hubR, 0, Math.PI * 2, false);
  const hole = new THREE.Path(), hw = BAY.w / 2, hh = BAY.h / 2; hole.moveTo(-hw, -hh); hole.lineTo(-hw, hh); hole.lineTo(hw, hh); hole.lineTo(hw, -hh); hole.closePath(); cap.holes.push(hole);
  add(new THREE.ShapeGeometry(cap, 48), std(0xa9a49a, tiled(T, 1 / 40, 1 / 40)), 0, 0, AFT);
  const amberM = new THREE.MeshStandardMaterial({color: lin(0xffb14a), emissive: lin(0x5a3200), metalness: 0.2, roughness: 0.5});
  add(new THREE.BoxGeometry(BAY.w + 12, 4, 3), amberM, 0, hh + 2, AFT + 1.5); add(new THREE.BoxGeometry(BAY.w + 12, 4, 3), amberM, 0, -hh - 2, AFT + 1.5);
  add(new THREE.BoxGeometry(4, BAY.h + 12, 3), amberM, hw + 2, 0, AFT + 1.5); add(new THREE.BoxGeometry(4, BAY.h + 12, 3), amberM, -hw - 2, 0, AFT + 1.5);

  // ---- the bay: a lit hangar behind the mouth (no wall on the open end), a pad, crates, a gantry ----
  const wallM = std(0x8f8d88, tiled(T, 6, 2)), floorM = std(0x6d6c69, tiled(T, 4, 6)), backM = std(0x7d7b77, tiled(T, 4, 2));
  const bayBox = new THREE.Mesh(new THREE.BoxGeometry(BAY.w, BAY.h, BAY.depth), [wallM, wallM, wallM, floorM, new THREE.MeshBasicMaterial({visible: false}), backM].map(m => { m.side = THREE.BackSide; return m; }));
  bayBox.position.set(0, 0, AFT - BAY.depth / 2); root.add(bayBox);
  const stripM = glow(0xe8f2ff);
  for (const x of [-60, -20, 20, 60]) add(new THREE.BoxGeometry(2.5, 1, BAY.depth - 20), stripM, x, hh - 1, AFT - BAY.depth / 2);
  for (const x of [-hw + 2, hw - 2]) add(new THREE.BoxGeometry(1.5, 0.6, BAY.depth - 10), glow(0xffb14a), x, -hh + 0.5, AFT - BAY.depth / 2);
  const padY = -hh + 0.2, padZ = STATION.pad[2]; // markings on the bay floor
  add(new THREE.RingGeometry(19, 22, 48), glow(0xffb14a), 0, padY, padZ, -Math.PI / 2);
  add(new THREE.BoxGeometry(30, 0.3, 1.5), glow(0xffb14a), 0, padY, padZ); add(new THREE.BoxGeometry(1.5, 0.3, 30), glow(0xffb14a), 0, padY, padZ);
  add(new THREE.BoxGeometry(BAY.w, 4, 6), darkM, 0, hh - 6, AFT - BAY.depth + 60);
  const crates = instanced(new THREE.BoxGeometry(1, 1, 1), plainM, 60);
  for (let i = 0; i < 60; i++) {
    const s = i % 2 ? 1 : -1, w = 8 + r() * 8, h = 5 + r() * 6, d = 10 + r() * 14, stack = Math.floor(r() * 3);
    o3.position.set(s * (hw - 4 - w / 2 - r() * 6), -hh + h / 2 + stack * h, AFT - 20 - r() * (BAY.depth - 50)); o3.rotation.set(0, 0, 0); o3.scale.set(w, h, d); o3.updateMatrix();
    if (Math.abs(o3.position.z - padZ) < 30 && Math.abs(o3.position.x) < 40) continue; // keep the pad clear
    put(crates, o3.matrix, PAINT[Math.floor(r() * PAINT.length)]);
  }

  // ---- doors: two slabs that slide up and down off the bay mouth, hazard stripes where they meet ----
  const doorTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#3a3e45'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2d32'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 3, h);
    g.save(); g.beginPath(); g.rect(0, h - 26, w, 26); g.clip(); g.fillStyle = '#ffb14a'; g.fillRect(0, h - 26, w, 26); g.fillStyle = '#1a1c20';
    for (let x = -40; x < w + 40; x += 36) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 18, h); g.lineTo(x + 44, h - 26); g.lineTo(x + 26, h - 26); g.closePath(); g.fill(); }
    g.restore();
  });
  const doorM = new THREE.MeshStandardMaterial({map: doorTex, metalness: 0.5, roughness: 0.6});
  const doorY = hh / 2 + 1.5, doors = [];
  for (const s of [1, -1]) doors.push(add(new THREE.BoxGeometry(BAY.w + 16, hh + 6, 4), doorM, 0, s * doorY, AFT + 3, 0, 0, s > 0 ? 0 : Math.PI));

  // ---- neon sign on struts above the bay end ----
  const signTex = canvasTex(1024, 200, (g, w, h) => {
    g.fillStyle = '#0b0d12'; g.fillRect(0, 0, w, h); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ffb14a'; g.shadowBlur = 24; g.fillStyle = '#ffd38a'; g.font = '700 104px "Michroma", "Arial Black", sans-serif'; g.fillText(STATION.name.toUpperCase(), w / 2, 84);
    g.shadowColor = '#ff6b9a'; g.shadowBlur = 16; g.fillStyle = '#ffc2d6'; g.font = '500 36px "IBM Plex Mono", monospace'; g.fillText('BERTHS · TRADE · NO QUESTIONS ASKED', w / 2, 164);
  });
  add(new THREE.PlaneGeometry(250, 49), new THREE.MeshBasicMaterial({map: signTex, toneMapped: false}), 0, hubR + 62, AFT - 30);
  for (const x of [-80, 80]) add(new THREE.BoxGeometry(5, 50, 5), darkM, x, hubR + 18, AFT - 32);

  // ---- bolted-on modules, tanks and patches in mismatched paint along the hub ----
  const mods = instanced(new THREE.BoxGeometry(1, 1, 1), plainM, 110), tanks = instanced(new THREE.CylinderGeometry(0.5, 0.5, 1, 16), plainM, 24);
  const radialBasis = (a, rad, along, w, h, d) => { // a box standing on the hub at angle a, z along
    const n = new THREE.Vector3(Math.cos(a), Math.sin(a), 0), t = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0);
    m4.makeBasis(t, n, new THREE.Vector3(0, 0, 1)).scale(new THREE.Vector3(w, h, d)).setPosition(n.multiplyScalar(rad + h / 2)).elements[14] = along; return m4;
  };
  for (let i = 0; i < 110; i++) { const a = r() * Math.PI * 2, h = 8 + r() * 40; put(mods, radialBasis(a, hubR - 2, -AFT + 40 + r() * (hubLen - 120), 14 + r() * 40, h, 18 + r() * 70), PAINT[Math.floor(r() * PAINT.length)]); }
  for (let i = 0; i < 24; i++) { const a = r() * Math.PI * 2, rad = 7 + r() * 8; put(tanks, radialBasis(a, hubR - 1, -AFT + 60 + r() * (hubLen - 160), 2 * rad, 2 * rad, 40 + r() * 50).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), PAINT[Math.floor(r() * PAINT.length)]); }

  // ---- the ring: ribs, shacks and windows on it, spokes, a collar on the hub; it turns as a whole ----
  add(new THREE.TorusGeometry(ringR, ringTube, 12, 192), ringM, 0, 0, 0, 0, 0, 0, ring);
  add(new THREE.TorusGeometry(hubR + 8, 10, 8, 48), darkM, 0, 0, 0, 0, 0, 0, ring);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, mid = (hubR + ringR - ringTube) / 2; add(new THREE.CylinderGeometry(spokeR, spokeR, ringR - ringTube - hubR, 16), darkM, Math.cos(a) * mid, Math.sin(a) * mid, 0, 0, 0, a - Math.PI / 2, ring); }
  const ribs = instanced(new THREE.TorusGeometry(ringTube + 2.5, 3, 6, 24), darkM, 48, ring), zAxis = new THREE.Vector3(0, 0, 1), tq = new THREE.Quaternion();
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; m4.compose(new THREE.Vector3(Math.cos(a) * ringR, Math.sin(a) * ringR, 0), tq.setFromUnitVectors(zAxis, new THREE.Vector3(-Math.sin(a), Math.cos(a), 0)), new THREE.Vector3(1, 1, 1)); ribs.setMatrixAt(ribs.count++, m4); }
  // A point on the ring's surface at angle a around the ring and b around the tube, with its outward normal.
  const onRing = (a, b, lift, outP, outN) => { outN.set(Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)); return outP.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0).addScaledVector(outN, ringTube + lift); };
  const sp = new THREE.Vector3(), sn = new THREE.Vector3(), st = new THREE.Vector3(), sb = new THREE.Vector3();
  const shacks = instanced(new THREE.BoxGeometry(1, 1, 1), plainM, 320, ring);
  for (let i = 0; i < 320; i++) {
    const a = r() * Math.PI * 2, b = (r() * 2 - 1) * 1.15, w = 8 + r() * 24, h = 5 + r() * 20, d = 8 + r() * 24;
    onRing(a, b, h / 2 - 2, sp, sn); st.set(-Math.sin(a), Math.cos(a), 0); sb.crossVectors(st, sn);
    m4.makeBasis(st, sn, sb).scale(sb.set(w, h, d)).setPosition(sp); put(shacks, m4, PAINT[Math.floor(r() * PAINT.length)]);
  }
  const wins = instanced(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({toneMapped: false}), 2600, ring), up = new THREE.Vector3(0, 0, 1);
  const WIN = [0xffc98a, 0xffc98a, 0xffc98a, 0xffe2b0, 0x9fd4ff, 0xff8fb8];
  for (let row = -5; row <= 5; row++) for (let a = 0; a < Math.PI * 2 && wins.count < 2600; a += 0.012) {
    if (r() < 0.55) continue;
    onRing(a + r() * 0.004, row * 0.16, 0.4, sp, sn); m4.compose(sp, tq.setFromUnitVectors(up, sn), sb.set(1, 1, 1)); put(wins, m4, WIN[Math.floor(r() * WIN.length)]);
  }

  // ---- solar wings on trusses, and the dish at the front ----
  const solarTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#101d38'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a4a66'; g.lineWidth = 4; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } });
  solarTex.wrapS = solarTex.wrapT = THREE.RepeatWrapping; solarTex.repeat.set(22, 4);
  const solarM = new THREE.MeshStandardMaterial({map: solarTex, metalness: 0.6, roughness: 0.35});
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(WING.x1 - WING.x0, WING.h, 3), solarM, s * (WING.x0 + WING.x1) / 2, 0, WING.z);
    add(new THREE.BoxGeometry(WING.x1, 8, 8), darkM, s * WING.x1 / 2, 0, WING.z - 5);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(40 + r() * 60, WING.h * 0.4, 3.4), plainM.clone(), s * (WING.x0 + 100 + r() * (WING.x1 - WING.x0 - 200)), (r() - 0.5) * WING.h * 0.5, WING.z).material.color.set(PAINT[Math.floor(r() * PAINT.length)]).convertSRGBToLinear(); // patched panels
  }
  const dishR = 160, dishM = std(0xd6d2c8, null, 0.3, 0.6); dishM.side = THREE.DoubleSide;
  add(new THREE.SphereGeometry(dishR, 40, 10, 0, Math.PI * 2, 0, 0.55), dishM, 0, 0, DISH.z + 20 - dishR, Math.PI / 2);
  add(new THREE.CylinderGeometry(4, 4, 90, 8), darkM, 0, 0, DISH.z - 40, Math.PI / 2);
  add(new THREE.CylinderGeometry(14, 16, 24, 16), darkM, 0, 0, -AFT - 70 - 10, Math.PI / 2);

  // ---- lights: red beacons (on the hub and turning with the ring) and guide lights into the bay ----
  const dot = new THREE.SphereGeometry(1, 8, 6), beaconM = new THREE.MeshBasicMaterial({toneMapped: false});
  const beacons = instanced(dot, beaconM, 8), ringBeacons = instanced(dot, beaconM, 8, ring);
  for (const [x, y, z] of [[WING.x1, 0, WING.z], [-WING.x1, 0, WING.z], [0, 0, DISH.z - 85], [125, hubR + 62, AFT - 30], [-125, hubR + 62, AFT - 30], [0, hubR, -AFT], [0, -hubR, -AFT], [hubR, 0, 0]]) { m4.compose(sp.set(x, y, z), tq.identity(), sb.set(6, 6, 6)); put(beacons, m4, 0xff3b30); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; m4.compose(sp.set(Math.cos(a) * (ringR + ringTube + 4), Math.sin(a) * (ringR + ringTube + 4), 0), tq.identity(), sb.set(6, 6, 6)); put(ringBeacons, m4, 0xff3b30); }
  const NG = 10, guides = instanced(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({toneMapped: false}), 2 * NG);
  for (let i = 0; i < NG; i++) for (const x of [-hw + 10, hw - 10]) { m4.compose(sp.set(x, -hh, AFT + 60 + i * 50), tq.identity(), sb.set(2, 2, 2)); put(guides, m4, 0xffb14a); }

  const dim = new THREE.Color(0x1a0d0a), red = new THREE.Color(0xff3b30).convertSRGBToLinear(), amber = new THREE.Color(0xffb14a).convertSRGBToLinear(), amberDim = amber.clone().multiplyScalar(0.12);
  function update(t, bay, rt) {
    ring.rotation.z = ringAngle(t);
    const e = bay * bay * (3 - 2 * bay), slide = e * (hh + 8);
    doors[0].position.y = doorY + slide; doors[1].position.y = -doorY - slide;
    const on = (rt % 1.8) < 0.18;
    for (const b of [beacons, ringBeacons]) { for (let i = 0; i < b.count; i++) b.setColorAt(i, on ? red : dim); b.instanceColor.needsUpdate = true; }
    for (let i = 0; i < NG; i++) { const lit = ((rt * 1.6 - (NG - 1 - i) * 0.12) % 1.6 + 1.6) % 1.6 < 0.14; for (let k = 0; k < 2; k++) guides.setColorAt(2 * i + k, lit ? amber : amberDim); }
    guides.instanceColor.needsUpdate = true;
  }
  update(0, 0, 0);
  return {root, ring, update};
}
