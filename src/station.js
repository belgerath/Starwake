// Tumbledown: a vast, brutal station for outcasts and smugglers, built from primitives in metres in the station
// frame (STATION in config.js: −z along its orbit, +y away from Veyra). An octagonal concrete hub along z with
// fins, slit windows and monolithic blocks, the docking bay in its +z end behind heavy doors, a wheel of dark
// ribbed stone turning around the middle with habitation blocks and slits of light, radiator slabs where the
// station's wings are, a spire at the front, red beacons, and guide lights leading into the bay. Inside, bay 3
// is the same place as the hangar (hangar/): concrete buttresses, lamp niches, one shaft of light on the pad.
// Every part stays inside the shapes physics.js collides with. update(t, bay, rt) turns the wheel (with the
// physics' ringAngle, which the collision uses too), slides the doors (0 shut .. 1 open) and runs the lights.
import * as THREE from 'three';
import {STATION} from './config.js';
import {lin, rng} from './util.js';
import {ringAngle} from './physics.js';
import {concrete, ribbed, engraving, bannerTex, wash, lightShaft} from './textures.js';

const {hubR, hubLen, ringR, ringTube, spokeR, bay: BAY, wings: WING, dish: DISH} = STATION;
const AFT = hubLen / 2; // the bay end of the hub
const STONE = [0x4a4640, 0x3d3a36, 0x57514a, 0x45403a, 0x35332f]; // concrete in shades, for the blocks

export function buildStation() {
  const root = new THREE.Group(), ring = new THREE.Group(); root.add(ring);
  const r = rng(57), col = new THREE.Color(), m4 = new THREE.Matrix4();
  const std = (hex, map = null, metal = 0.1, rough = 0.95) => new THREE.MeshStandardMaterial({map, color: lin(hex), metalness: metal, roughness: rough, flatShading: true});
  const glow = (hex, k = 1) => new THREE.MeshBasicMaterial({color: lin(hex).multiplyScalar(k), toneMapped: false});
  const hubM = std(0x6e675e, concrete([8, 10])), ringM = std(0x625c54, concrete([60, 2])), darkM = std(0x2e2c2a, concrete([2, 6]), 0.3, 0.85);
  const blockM = std(0xffffff, concrete([1, 1])); // the blocks, shaded per instance
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = root) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
  // Filled with put(); the colour buffer is made up front (three.js 0.128 would size it from count, which starts at 0).
  const instanced = (geo, mat, n, parent = root) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.count = 0; parent.add(m); return m; };
  const put = (m, matrix, hex) => { m.setMatrixAt(m.count, matrix); m.setColorAt(m.count, col.set(hex).convertSRGBToLinear()); m.count++; };
  const sp = new THREE.Vector3(), sn = new THREE.Vector3(), st = new THREE.Vector3(), sb = new THREE.Vector3(), tq = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);

  // ---- hub: an octagonal prism with collars, long fins, monolithic blocks and slit windows ----
  // (An 8-sided cylinder tipped onto z has its corners at multiples of 45° and its faces in between.)
  add(new THREE.CylinderGeometry(hubR, hubR, hubLen, 8, 1, true), hubM, 0, 0, 0, Math.PI / 2);
  // Collars: octagonal rings round the hub (open in the middle, so they never cut through the bay).
  const octo = rad => Array.from({length: 8}, (_, k) => new THREE.Vector2(rad * Math.cos(k * Math.PI / 4), rad * Math.sin(k * Math.PI / 4)));
  const collar = new THREE.Shape(octo(hubR + 10)); collar.holes.push(new THREE.Path(octo(hubR - 2)));
  const collarG = new THREE.ExtrudeGeometry(collar, {depth: 12, bevelEnabled: false}).translate(0, 0, -6);
  for (let z = -AFT + 45; z < AFT - 30; z += 90) add(collarG, darkM, 0, 0, z);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; add(new THREE.BoxGeometry(6, 34, hubLen - 120), darkM, Math.cos(a) * (hubR + 14), Math.sin(a) * (hubR + 14), -20, 0, 0, a - Math.PI / 2); }
  // A block standing on the hub's face at angle a, z along it.
  const onHub = (a, along, w, h, d) => { const n = sn.set(Math.cos(a), Math.sin(a), 0), t = st.set(-Math.sin(a), Math.cos(a), 0); m4.makeBasis(t, n, zAxis).scale(sb.set(w, h, d)).setPosition(sp.copy(n).multiplyScalar(hubR * 0.93 + h / 2)); m4.elements[14] = along; return m4; };
  const blocks = instanced(new THREE.BoxGeometry(1, 1, 1), blockM, 70);
  for (let i = 0; i < 70; i++) { const a = Math.floor(r() * 8) * Math.PI / 4 + Math.PI / 8, h = 8 + r() * 26; put(blocks, onHub(a, -AFT + 60 + r() * (hubLen - 160), 30 + r() * 30, h, 30 + r() * 90), STONE[Math.floor(r() * STONE.length)]); }
  const slits = instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({toneMapped: false}), 420);
  for (let i = 0; i < 420; i++) { const a = Math.floor(r() * 8) * Math.PI / 4 + Math.PI / 8; put(slits, onHub(a, -AFT + 40 + r() * (hubLen - 120), 10 + r() * 18, 1.6, 0.9), r() < 0.85 ? 0xffb070 : 0xffd9a0); }
  // The front: a taper, then a spire pointing along the orbit (inside the collision's dish sphere).
  const spireL = -AFT - 80 - (DISH.z - DISH.r); // from the taper to the far side of the dish sphere
  add(new THREE.CylinderGeometry(hubR * 0.6, hubR, 80, 8), hubM, 0, 0, -AFT - 40, -Math.PI / 2);
  add(new THREE.ConeGeometry(hubR * 0.6, spireL, 8), darkM, 0, 0, -AFT - 80 - spireL / 2, -Math.PI / 2);

  // ---- the bay end: an octagonal cap round the mouth, a heavy frame with a thin light inset ----
  const cap = new THREE.Shape(); for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4; k ? cap.lineTo(Math.cos(a) * hubR, Math.sin(a) * hubR) : cap.moveTo(Math.cos(a) * hubR, Math.sin(a) * hubR); }
  const hole = new THREE.Path(), hw = BAY.w / 2, hh = BAY.h / 2; hole.moveTo(-hw, -hh); hole.lineTo(-hw, hh); hole.lineTo(hw, hh); hole.lineTo(hw, -hh); hole.closePath(); cap.holes.push(hole);
  add(new THREE.ShapeGeometry(cap), std(0x5e584f, concrete([1 / 60, 1 / 60])), 0, 0, AFT);
  for (const [w, h, x, y] of [[BAY.w + 24, 12, 0, hh + 6], [BAY.w + 24, 12, 0, -hh - 6], [12, BAY.h, hw + 6, 0], [12, BAY.h, -hw - 6, 0]]) add(new THREE.BoxGeometry(w, h, 6), darkM, x, y, AFT + 3);
  for (const [w, h, x, y] of [[BAY.w + 2, 0.8, 0, hh + 1], [BAY.w + 2, 0.8, 0, -hh - 1], [0.8, BAY.h, hw + 1, 0], [0.8, BAY.h, -hw - 1, 0]]) add(new THREE.BoxGeometry(w, h, 0.5), glow(0xffa050, 0.7), x, y, AFT + 6.2);

  // ---- bay 3, inside: the hangar's look (concrete, buttresses, lamp niches, one shaft of light on the pad) ----
  // Unlit, like the hangar: the sun never reaches in, and the light is painted on (washes, a pool under the shaft, haze).
  const bz = AFT - BAY.depth / 2, padY = -hh, padZ = STATION.pad[2];
  const unlit = (hex, map) => new THREE.MeshBasicMaterial({map, color: lin(hex)});
  const wallM = unlit(0x3a3129, concrete([BAY.depth / 24, BAY.h / 24])), endM = unlit(0x3a3129, concrete([BAY.w / 24, BAY.h / 24])), floorM = unlit(0x4a4036, concrete([BAY.w / 12, BAY.depth / 12])), roofM = unlit(0x2a241e, concrete([6, 10]));
  const bayBox = new THREE.Mesh(new THREE.BoxGeometry(BAY.w, BAY.h, BAY.depth), [wallM, wallM, roofM, floorM, new THREE.MeshBasicMaterial({visible: false}), endM].map(m => { m.side = THREE.BackSide; return m; }));
  bayBox.position.set(0, 0, bz); root.add(bayBox);
  const posts = []; for (const s of [-1, 1]) for (let z = AFT - 20; z > AFT - BAY.depth + 10; z -= 30) posts.push([s * (hw - 2.5), z]);
  const butM = unlit(0x463b31, concrete([1, BAY.h / 12])), butt = new THREE.InstancedMesh(new THREE.BoxGeometry(5, BAY.h, 6), butM, posts.length), niches = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1, 0.5), glow(0xffa050, 0.55), posts.length);
  const ups = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 34).rotateY(Math.PI / 2), wash(0xff9a40, 0.16), posts.length), o = new THREE.Object3D();
  posts.forEach(([x, z], i) => {
    const s = Math.sign(x); o.rotation.set(0, 0, 0);
    o.position.set(x, 0, z); o.updateMatrix(); butt.setMatrixAt(i, o.matrix);
    o.position.set(x - s * 2.6, -hh + 1.4, z); o.updateMatrix(); niches.setMatrixAt(i, o.matrix);
    o.position.set(x - s * 2.65, -hh + 15, z); o.rotation.y = s > 0 ? Math.PI : 0; o.updateMatrix(); ups.setMatrixAt(i, o.matrix);
  });
  root.add(butt, niches, ups);
  for (const [r0, r1, m] of [[19.4, 20.2, std(0x2b2926, null, 0.6, 0.45)], [20.7, 20.9, glow(0x9a6a2a, 0.5)], [5.6, 6, std(0x2b2926, null, 0.6, 0.45)]]) add(new THREE.RingGeometry(r0, r1, 72), m, 0, padY + 0.05, padZ, -Math.PI / 2);
  add(new THREE.CircleGeometry(7, 32), glow(0xfff0d8, 1.3), 0, hh - 0.1, padZ, Math.PI / 2); // the opening above the pad
  const shaft = lightShaft(7, 22, BAY.h, 0.15); shaft.position.set(0, 0, padZ); root.add(shaft);
  add(new THREE.PlaneGeometry(70, 70), wash(0xffd9a0, 0.45), 0, padY + 0.03, padZ, -Math.PI / 2); // the pool of light under it
  for (const z of [padZ - 70, padZ + 25, AFT - 25]) add(new THREE.PlaneGeometry(BAY.w, BAY.h * 1.4), wash(0xc89060, 0.05), 0, -6, z); // haze
  const back = AFT - BAY.depth + 0.4;
  add(new THREE.PlaneGeometry(26, 4.9), new THREE.MeshStandardMaterial({map: engraving('BAY 3'), roughness: 0.95}), 0, 14, back);
  for (const x of [-30, 30]) add(new THREE.PlaneGeometry(5, 30), new THREE.MeshStandardMaterial({map: bannerTex('#3a1612'), roughness: 1, side: THREE.DoubleSide}), x, 10, back + 0.2);
  add(new THREE.PlaneGeometry(16, 34), new THREE.MeshBasicMaterial({color: 0x030202}), 0, -hh + 17, back + 0.1); // the arch into the station

  // ---- doors: two heavy ribbed slabs that slide up and down off the bay mouth, light along their edges ----
  const doorM = new THREE.MeshStandardMaterial({map: ribbed([6, 1]), color: lin(0x3d3a37), metalness: 0.6, roughness: 0.6});
  const doorY = hh / 2 + 1.5, doors = [];
  for (const s of [1, -1]) { const d = add(new THREE.BoxGeometry(BAY.w + 16, hh + 6, 4), doorM, 0, s * doorY, AFT + 3, 0, 0, s > 0 ? 0 : Math.PI); add(new THREE.BoxGeometry(BAY.w + 16, 0.6, 0.4), glow(0xff9a40, 0.9), 0, -(hh + 6) / 2 + 0.3, 2.2, 0, 0, 0, d); doors.push(d); }

  // ---- the wheel: ribbed stone with an octagonal section, habitation blocks, slits of light, square spokes ----
  add(new THREE.TorusGeometry(ringR, ringTube, 8, 192), ringM, 0, 0, 0, 0, 0, 0, ring);
  add(new THREE.CylinderGeometry(hubR + 18, hubR + 18, 26, 8), darkM, 0, 0, 0, Math.PI / 2, 0, 0, ring);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, mid = (hubR + ringR - ringTube) / 2; add(new THREE.BoxGeometry(spokeR * 1.5, ringR - ringTube - hubR, spokeR * 1.5), darkM, Math.cos(a) * mid, Math.sin(a) * mid, 0, 0, 0, a - Math.PI / 2, ring); }
  const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(ringTube + 5, 6, 4, 8), darkM, 64); ring.add(ribs);
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; m4.compose(sp.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0), tq.setFromUnitVectors(zAxis, st.set(-Math.sin(a), Math.cos(a), 0)), sb.set(1, 1, 1)); ribs.setMatrixAt(i, m4); }
  // A point on the wheel's surface at angle a around it and b around the tube, with its outward normal.
  const onRing = (a, b, lift, outP, outN) => { outN.set(Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a), Math.sin(b)); return outP.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0).addScaledVector(outN, ringTube + lift); };
  const habs = instanced(new THREE.BoxGeometry(1, 1, 1), blockM, 220, ring);
  for (let i = 0; i < 220; i++) {
    const a = r() * Math.PI * 2, b = (Math.floor(r() * 5) - 2) * 0.42, w = 16 + r() * 30, h = 6 + r() * 20, d = 14 + r() * 16;
    onRing(a, b, h / 2 - 3, sp, sn); st.set(-Math.sin(a), Math.cos(a), 0); sb.crossVectors(st, sn);
    m4.makeBasis(st, sn, sb).scale(sb.set(w, h, d)).setPosition(sp); put(habs, m4, STONE[Math.floor(r() * STONE.length)]);
  }
  const wins = instanced(new THREE.PlaneGeometry(5, 0.8), new THREE.MeshBasicMaterial({toneMapped: false}), 1400, ring);
  for (let row = -4; row <= 4; row++) for (let a = 0; a < Math.PI * 2 && wins.count < 1400; a += 0.016) {
    if (r() < 0.62) continue;
    onRing(a + r() * 0.004, row * 0.19, 0.4, sp, sn); st.set(-Math.sin(a), Math.cos(a), 0); sb.crossVectors(sn, st); // slits run along the wheel
    m4.makeBasis(st, sb, sn).setPosition(sp); put(wins, m4, r() < 0.8 ? 0xffb070 : 0xffd9a0);
  }

  // ---- radiator slabs where the wings are, on heavy beams ----
  const radM = new THREE.MeshStandardMaterial({map: ribbed([24, 2]), color: lin(0x2c2a28), metalness: 0.5, roughness: 0.7});
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(WING.x1 - WING.x0, WING.h, 3), radM, s * (WING.x0 + WING.x1) / 2, 0, WING.z);
    add(new THREE.BoxGeometry(WING.x1, 12, 12), darkM, s * WING.x1 / 2, 0, WING.z - 6);
    for (const y of [-WING.h / 2, WING.h / 2]) add(new THREE.BoxGeometry(WING.x1 - WING.x0, 1.2, 0.6), glow(0xff8a40, 0.35), s * (WING.x0 + WING.x1) / 2, y, WING.z + 1.8);
  }

  // ---- lights: red beacons (on the hub and turning with the wheel) and guide lights into the bay ----
  const dot = new THREE.SphereGeometry(1, 8, 6), beaconM = new THREE.MeshBasicMaterial({toneMapped: false});
  const beacons = instanced(dot, beaconM, 7), ringBeacons = instanced(dot, beaconM, 8, ring);
  for (const [x, y, z] of [[WING.x1, 0, WING.z], [-WING.x1, 0, WING.z], [0, 0, -AFT - 245], [0, hubR + 10, AFT - 10], [0, -hubR - 10, AFT - 10], [hubR + 10, 0, 0], [-hubR - 10, 0, 0]]) { m4.compose(sp.set(x, y, z), tq.identity(), sb.set(5, 5, 5)); put(beacons, m4, 0xff3b30); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; m4.compose(sp.set(Math.cos(a) * (ringR + ringTube + 8), Math.sin(a) * (ringR + ringTube + 8), 0), tq.identity(), sb.set(5, 5, 5)); put(ringBeacons, m4, 0xff3b30); }
  const NG = 10, guides = instanced(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({toneMapped: false}), 2 * NG);
  for (let i = 0; i < NG; i++) for (const x of [-hw + 10, hw - 10]) { m4.compose(sp.set(x, -hh, AFT + 60 + i * 50), tq.identity(), sb.set(2, 2, 2)); put(guides, m4, 0xffb14a); }

  const dim = new THREE.Color(0x140a08), red = new THREE.Color(0xff3b30).convertSRGBToLinear().multiplyScalar(0.8), amber = new THREE.Color(0xffb14a).convertSRGBToLinear(), amberDim = amber.clone().multiplyScalar(0.1);
  function update(t, bay, rt) {
    ring.rotation.z = ringAngle(t);
    const e = bay * bay * (3 - 2 * bay), slide = e * (hh + 8);
    doors[0].position.y = doorY + slide; doors[1].position.y = -doorY - slide;
    shaft.material.uniforms.time.value = rt;
    const on = (rt % 2.2) < 0.2;
    for (const b of [beacons, ringBeacons]) { for (let i = 0; i < b.count; i++) b.setColorAt(i, on ? red : dim); b.instanceColor.needsUpdate = true; }
    for (let i = 0; i < NG; i++) { const lit = ((rt * 1.6 - (NG - 1 - i) * 0.12) % 1.6 + 1.6) % 1.6 < 0.14; for (let k = 0; k < 2; k++) guides.setColorAt(2 * i + k, lit ? amber : amberDim); }
    guides.instanceColor.needsUpdate = true;
  }
  update(0, 0, 0);
  return {root, ring, update};
}
