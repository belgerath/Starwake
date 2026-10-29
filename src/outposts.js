// Outposts on Tal (OUTPOSTS in config.js), built from primitives in metres in Tal's body frame (W.moon): a pad
// ringed with lamps where deliveries land, squat concrete bunkers with slit windows, a dome and a mast with a red
// beacon. The buildings show within NEAR of the ship; the beacon keeps a fixed size on screen so it can be seen
// from orbit (the delivery's outpost always, the others within NEAR_BEACON). No collision: land on the pad.
import * as THREE from 'three';
import {MOON_R, OUTPOSTS, outpostDir} from './config.js';
import {talHeight} from './tal.js';
import {lin, rng, glowTex} from './util.js';
import {concrete} from './textures.js';

const NEAR = 150e3, NEAR_BEACON = 400e3;
const V3 = THREE.Vector3;

export function buildOutposts(moon) {
  const conc = concrete([2, 2]), wallM = new THREE.MeshStandardMaterial({map: conc, color: lin(0x6a625a), roughness: 0.95, metalness: 0.05, flatShading: true});
  const darkM = new THREE.MeshStandardMaterial({map: conc, color: lin(0x34302c), roughness: 0.9, metalness: 0.1});
  const glow = (hex, k = 1) => new THREE.MeshBasicMaterial({color: lin(hex).multiplyScalar(k), toneMapped: false});
  const lampM = glow(0xffa050, 0.9), slitM = glow(0xff9a40, 0.7);
  const beaconT = glowTex([[0, 'rgba(255,200,190,1)'], [0.2, 'rgba(255,60,40,0.9)'], [0.55, 'rgba(255,30,20,0.25)'], [1, 'rgba(255,0,0,0)']]);
  const list = {};
  for (const [key, o] of Object.entries(OUTPOSTS)) {
    const d = new V3(...outpostDir(o)), g = new THREE.Group(), r = rng([...key].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
    g.position.copy(d).multiplyScalar(MOON_R + talHeight(d.x, d.y, d.z)); g.quaternion.setFromUnitVectors(new V3(0, 1, 0), d); moon.add(g);
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = mat.isMeshStandardMaterial; g.add(m); return m; };
    // The pad, sunk a little so uneven ground does not show under it, and its lamps.
    add(new THREE.CylinderGeometry(26, 28, 3, 32), darkM, 0, -1.2, 0);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; add(new THREE.BoxGeometry(0.8, 0.5, 0.8), lampM, Math.cos(a) * 25, 0.5, Math.sin(a) * 25); }
    // Bunkers round it, 70 to 140 m out, each with a band of slit windows; a dome; the mast.
    const n = 4 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const a = (k + r() * 0.5) / n * Math.PI * 2, dist = 70 + r() * 70, w = 18 + r() * 24, h = 7 + r() * 9, dd = 16 + r() * 22, x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      const b = add(new THREE.BoxGeometry(w, h + 4, dd), wallM, x, h / 2 - 2, z, -a);
      const slits = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.5, dd + 0.4), slitM); slits.position.y = h * 0.25; b.add(slits);
    }
    const da = r() * Math.PI * 2; add(new THREE.SphereGeometry(13 + r() * 6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), wallM, Math.cos(da) * 95, -2, Math.sin(da) * 95);
    const ma = da + 2.2, mx = Math.cos(ma) * 60, mz = Math.sin(ma) * 60;
    add(new THREE.CylinderGeometry(0.8, 1.6, 64, 8), darkM, mx, 30, mz);
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({map: beaconT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, sizeAttenuation: false}));
    beacon.position.set(mx, 63, mz); beacon.scale.set(0.035, 0.035, 1); g.add(beacon);
    list[key] = {group: g, beacon, parts: g.children.filter(c => c !== beacon)};
  }
  const wp = new V3();
  // target: the delivery's outpost (its beacon always shows). The ship is at the render origin, so an outpost's
  // world position (getWorldPosition brings the parents' matrices up to date) is its offset from the ship.
  function update(rt, target) {
    const on = (rt % 1.5) < 0.18;
    for (const [key, o] of Object.entries(list)) {
      const d = o.group.getWorldPosition(wp).length(), near = d < NEAR;
      for (const m of o.parts) m.visible = near;
      o.beacon.visible = on && (key === target || d < NEAR_BEACON);
    }
  }
  return {list, update};
}
