// The Keep's model (its solids are in keep-shape.js): plain cast concrete in lifts and panels that differ a
// little in tone and darken toward the dust at the foot, a tall gate between two buttresses, a black slot
// running up the face with lamps in it, deep bands with rows of small lit slits, red lights on the crown, and
// a path of lamps from Harrow Rise's pad to the ramp. Its scale and its shadow are the point: next to it the
// Mudlark is a speck. Built straight into buffers, one mesh per material, in Tal's body frame (W.moon).
//
// The sun's shadow map only covers the ship, so the Keep's shadow is worked out per pixel instead (KEEP_SHADE):
// on Tal's ground (TERRAIN_FRAG), on the Keep itself and on the ship and outposts (shadeByKeep).
import * as THREE from 'three';
import {KEEP, KEEP_SOLIDS, KEEP_TO_BODY, KEEP_FROM_BODY, KEEP_SHADE, KEEP_U, PLINTH_TOP} from './keep-shape.js';
import {MOON_R, OUTPOSTS, outpostDir} from './config.js';
import {talHeight} from './tal.js';
import {lin, rng, smooth} from './util.js';
import {canvasTex, blotch, wash, dotTex} from './textures.js';
import {sunDir} from './engine.js';

const V3 = THREE.Vector3;

// Direct sunlight on a MeshStandardMaterial is cut where the Keep hides the sun.
export function shadeByKeep(mat) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, KEEP_U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;\n' + KEEP_SHADE)
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );',
        'getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight ); directLight.color *= keepShade(vKW);'));
  };
  return mat;
}

// Cast concrete, one tile per 32 m: faint board marks, panel joints every 8 m, tie holes, stains.
const concreteTex = () => canvasTex(1024, 1024, (g, w, h) => {
  const r = rng(31); g.fillStyle = '#6c665d'; g.fillRect(0, 0, w, h);
  blotch(g, r, 120, w, h, '40,34,28', 0.04, 0.14, 20, 140); blotch(g, r, 50, w, h, '200,192,178', 0.03, 0.08, 30, 120);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '25,22,18' : '220,212,198'},0.06)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  for (let y = 0; y < h; y += 32) { g.fillStyle = `rgba(30,26,22,${0.05 + r() * 0.05})`; g.fillRect(0, y, w, 2); }
  for (let y = 0; y < h; y += 256) { g.fillStyle = 'rgba(20,17,14,0.45)'; g.fillRect(0, y, w, 4); g.fillStyle = 'rgba(230,222,208,0.08)'; g.fillRect(0, y + 4, w, 2); }
  for (let x = 0; x < w; x += 256) { g.fillStyle = 'rgba(20,17,14,0.4)'; g.fillRect(x, 0, 4, h); }
  g.fillStyle = 'rgba(15,12,10,0.5)'; for (let x = 32; x < w; x += 64) for (let y = 64; y < h; y += 128) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 80; i++) { const x = r() * w, y = r() * h, l = 60 + r() * 400, gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(25,20,16,0.2)'); gr.addColorStop(1, 'rgba(25,20,16,0)'); g.fillStyle = gr; g.fillRect(x, y, 3 + r() * 10, l); }
}, [1, 1]);
// The gate: dark, with light from deep inside along the floor.
const gateTex = () => canvasTex(64, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#6a4a26'); gr.addColorStop(0.03, '#2a1c10'); gr.addColorStop(0.25, '#0b0806'); gr.addColorStop(1, '#030202');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

// Geometry accumulated per material: positions, normals, uvs and (for concrete) colours.
function buffers() {
  const B = {}, get = k => B[k] || (B[k] = {p: [], n: [], uv: [], c: []});
  const tri = (k, a, b, c, n, col, uvs) => {
    const e = new V3().subVectors(b, a).cross(new V3().subVectors(c, a)); if (e.dot(n) < 0) [b, c] = [c, b];
    const o = get(k);
    [a, b, c].forEach((v, i) => {
      o.p.push(v.x, v.y, v.z); o.n.push(n.x, n.y, n.z);
      const cc = Array.isArray(col) ? col[i] : col; o.c.push(cc, cc, cc);
      if (uvs) o.uv.push(...uvs[i]);
      else { const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z); const [u, w] = ay >= ax && ay >= az ? [v.x, v.z] : ax >= az ? [v.z, v.y] : [v.x, v.y]; o.uv.push(u / 32, w / 32); }
    });
  };
  return {B, tri};
}

// The tone of the concrete: darker toward the dust at the foot, each pour (lift) and panel a little different.
const toneAt = (y, rLift, rCell) => (0.45 + 0.55 * smooth(-40, 320, y)) * (0.92 + 0.08 * rLift + 0.06 * rCell);

export function buildKeep(moon) {
  const r = rng(77), {B, tri} = buffers(), faces = {};
  // The solids' faces. Four-sided faces with level top and bottom edges are cut into cells (panels 60 m wide,
  // lifts 40 m high); other faces just darken toward the foot. Faces under the ground are left out.
  for (const [name, s] of Object.entries(KEEP_SOLIDS)) {
    faces[name] = [];
    s.faces.forEach((f, fi) => {
      const n = new V3(...s.planes[fi]); if (n.y < -0.9) return;
      const q = f.map(i => s.verts[i]);
      if (q.length === 4) {
        // Which pair of opposite edges is level, and which of the two is lower.
        const dy = (a, b) => Math.abs(a.y - b.y), pairA = dy(q[0], q[1]) + dy(q[2], q[3]), pairB = dy(q[1], q[2]) + dy(q[3], q[0]);
        let b0, b1, t0, t1;
        if (pairA <= pairB) [b0, b1, t1, t0] = q[0].y + q[1].y <= q[2].y + q[3].y ? [q[0], q[1], q[2], q[3]] : [q[3], q[2], q[1], q[0]];
        else [b0, b1, t1, t0] = q[1].y + q[2].y <= q[3].y + q[0].y ? [q[1], q[2], q[3], q[0]] : [q[0], q[3], q[2], q[1]];
        const F = {b0, b1, t0, t1, n}; faces[name].push(F);
        const nu = Math.max(1, Math.round(b0.distanceTo(b1) / 60)), nv = Math.max(1, Math.round((t0.y - b0.y) / 40));
        const P = (u, v) => new V3().lerpVectors(b0, b1, u).lerp(new V3().lerpVectors(t0, t1, u), v);
        for (let j = 0; j < nv; j++) {
          const rl = r() * 2 - 1;
          for (let i = 0; i < nu; i++) {
            const a = P(i / nu, j / nv), b = P((i + 1) / nu, j / nv), c = P((i + 1) / nu, (j + 1) / nv), d = P(i / nu, (j + 1) / nv), col = toneAt((a.y + d.y) / 2, rl, r() * 2 - 1);
            tri('keep', a, b, c, n, col); tri('keep', a, c, d, n, col);
          }
        }
      } else for (let i = 1; i + 1 < q.length; i++) tri('keep', q[0], q[i], q[i + 1], n, [q[0], q[i], q[i + 1]].map(v => toneAt(v.y, 0, 0)));
    });
  }
  // A point on a face, s metres from its centre line along it, at height y; and a quad there, out metres proud.
  const at = (F, s, y, out) => { const v = (y - F.b0.y) / (F.t0.y - F.b0.y), L = F.b0.distanceTo(F.b1) * (1 - v) + F.t0.distanceTo(F.t1) * v, u = 0.5 + s / L;
    return new V3().lerpVectors(F.b0, F.b1, u).lerp(new V3().lerpVectors(F.t0, F.t1, u), v).addScaledVector(F.n, out); };
  const width = (F, y) => { const v = (y - F.b0.y) / (F.t0.y - F.b0.y); return F.b0.distanceTo(F.b1) * (1 - v) + F.t0.distanceTo(F.t1) * v; };
  // Lamps also get a soft glow (glows: amber, reds: red) so they show as points of light from far off.
  const glows = [], reds = [], halo = (k, p, size) => { if (k === 'glow') glows.push(p.x, p.y, p.z, size); else if (k === 'red') reds.push(p.x, p.y, p.z, size); };
  const quad = (k, F, s, w, y0, y1, out, col = 1, uv = false) => {
    const a = at(F, s - w / 2, y0, out), b = at(F, s + w / 2, y0, out), c = at(F, s + w / 2, y1, out), d = at(F, s - w / 2, y1, out);
    tri(k, a, b, c, F.n, col, uv ? [[0, 0], [1, 0], [1, 1]] : null); tri(k, a, c, d, F.n, col, uv ? [[0, 0], [1, 1], [0, 1]] : null);
    halo(k, new V3().addVectors(a, c).multiplyScalar(0.5).addScaledVector(F.n, 1), w > 3 ? 16 : 7);
  };
  const box = (k, x, y, z, w, h, d) => { halo(k, new V3(x, y, z), k === 'red' ? 30 : 12); const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(), p = g.attributes.position, nn = g.attributes.normal;
    for (let i = 0; i < p.count; i += 3) { const v = [0, 1, 2].map(j => new V3(p.getX(i + j) + x, p.getY(i + j) + y, p.getZ(i + j) + z)); tri(k, v[0], v[1], v[2], new V3(nn.getX(i), nn.getY(i), nn.getZ(i)), k === 'keep' ? 0.6 : 1); } };
  const shaft = faces.shaft.slice(), front = shaft.reduce((a, F) => (F.n.z > a.n.z ? F : a));
  // The gate between the buttresses: a darker surround, the opening, and a heavy lintel.
  quad('keep', front, 0, 98, PLINTH_TOP, 336, 0.5, 0.42); quad('gate', front, 0, 76, PLINTH_TOP, 300, 0.9, 1, true);
  box('keep', 0, 318, at(front, 0, 318, 4.5).z, 100, 36, 9);
  // The slot up the face, with lamps inside it.
  quad('dark', front, 0, 14, 372, 1110, 0.6);
  for (let y = 390, k = 0; y < 1100; y += 26, k++) quad('glow', front, k % 2 ? 3 : -3, 3.5, y, y + 1.6, 0.9);
  // Vertical grooves running the height of the shaft, two either side of the slot and three on each flank.
  for (const F of shaft) {
    const L0 = width(F, 600), gs = F === front ? [-120, -60, 60, 120] : Math.abs(F.n.x) > 0.9 ? [-L0 / 4, 0, L0 / 4] : [];
    for (const s of gs) quad('dark', F, s, 3, 560, 1100, 0.4);
  }
  // Deep bands round the shaft and the crown, with rows of narrow slits above them, about a third of them lit.
  for (const F of shaft) {
    for (const yb of [430, 790]) {
      quad('dark', F, 0, width(F, yb) - 1, yb, yb + 6, 0.5);
      const L = width(F, yb + 16);
      for (let s = -L / 2 + 12; s < L / 2 - 12; s += 11) if (!(F === front && Math.abs(s) < 14)) quad(r() < 0.36 ? 'glow' : 'dark', F, s, 2.4, yb + 14, yb + 22, 0.5);
    }
    const L = width(F, 1070); for (let s = -L / 2 + 10; s < L / 2 - 10; s += 13) if (!(F === front && Math.abs(s) < 14)) quad(r() < 0.25 ? 'glow' : 'dark', F, s, 2.4, 1066, 1074, 0.5);
  }
  // The wing: a parapet line and two rows of slits on its face; vents along the plinth's front.
  const wingF = faces.wing.reduce((a, F) => (F.n.z > a.n.z ? F : a));
  quad('dark', wingF, 0, width(wingF, 226) - 1, 226, 230, 0.5);
  for (const y of [120, 170]) { const L = width(wingF, y); for (let s = -L / 2 + 10; s < L / 2 - 10; s += 9) quad(r() < 0.3 ? 'glow' : 'dark', wingF, s, 2.2, y, y + 7, 0.5); }
  const plF = faces.plinth.reduce((a, F) => (F.n.z > a.n.z ? F : a));
  for (const s of [-270, -210, -150, 150, 210, 270]) quad('dark', plF, s, 22, 8, 22, 0.5);
  // Red lights at the crown's corners and on two masts.
  const crown = KEEP_SOLIDS.crown, top = crown.verts.slice(crown.verts.length / 2);
  top.forEach((v, i) => { if (i % 2 === 0) box('red', v.x * 0.97, v.y + 2, v.z * 0.97, 3, 3, 3); });
  for (const [x, z, h] of [[-40, -10, 110], [55, 18, 80]]) { box('post', x, top[0].y + h / 2, z, 2.4, h, 2.4); box('red', x, top[0].y + h + 2, z, 3.5, 3.5, 3.5); }

  // The path of lamps from the ramp straight out along the Keep's axis, then across to the pad, in pairs 14 m
  // apart, following the ground.
  const od = new V3(...outpostDir(OUTPOSTS[KEEP.outpost])), padL = od.clone().multiplyScalar(MOON_R + talHeight(od.x, od.y, od.z)).applyMatrix4(KEEP_FROM_BODY).setY(0);
  const ground = p => { const b = p.clone().applyMatrix4(KEEP_TO_BODY).normalize(); return b.multiplyScalar(MOON_R + talHeight(b.x, b.y, b.z)).applyMatrix4(KEEP_FROM_BODY); };
  const legs = [[new V3(0, 0, 330), new V3(0, 0, 900)], [new V3(0, 0, 900), padL]];
  legs.forEach(([a, b], i) => {
    const dir = new V3().subVectors(b, a), len = dir.length() - (i ? 160 : 0); dir.normalize(); const side = new V3(-dir.z, 0, dir.x);
    for (let t = i ? 70 : 0; t < len; t += 70) for (const sd of [-7, 7]) {
      const g = ground(a.clone().addScaledVector(dir, t).addScaledVector(side, sd));
      box('post', g.x, g.y + 2.5, g.z, 0.5, 5, 0.5); box('glow', g.x, g.y + 5.4, g.z, 1.4, 0.8, 1.4);
    }
  });

  const M = {
    keep: shadeByKeep(new THREE.MeshStandardMaterial({map: concreteTex(), vertexColors: true, roughness: 0.95, metalness: 0})),
    post: shadeByKeep(new THREE.MeshStandardMaterial({color: lin(0x2a2826), roughness: 0.6, metalness: 0.5})),
    dark: new THREE.MeshBasicMaterial({color: 0x050403}),
    gate: new THREE.MeshBasicMaterial({map: gateTex()}),
    glow: new THREE.MeshBasicMaterial({color: lin(0xffa050).multiplyScalar(0.9), toneMapped: false}),
    red: new THREE.MeshBasicMaterial({color: lin(0xff2a18).multiplyScalar(1.6), toneMapped: false}),
  };
  M.keep.emissiveMap = M.keep.map; // light thrown back from the sunlit ground below, set each frame
  const group = new THREE.Group(); group.matrixAutoUpdate = false; group.matrix.copy(KEEP_TO_BODY); moon.add(group);
  for (const [k, o] of Object.entries(B)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
    if (k === 'keep') g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3));
    const m = new THREE.Mesh(g, M[k]); m.receiveShadow = M[k].isMeshStandardMaterial; group.add(m);
  }
  const pts = (list, hex, k) => {
    const g = new THREE.BufferGeometry(), pos = [];
    for (let i = 0; i < list.length; i += 4) pos.push(list[i], list[i + 1], list[i + 2]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({map: dotTex(), color: lin(hex).multiplyScalar(k), size: list[3], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}));
    group.add(m); return m;
  };
  // Glows sized by kind: the slot's lamps and the path's, the small slits, the red lights.
  const big = [], small = []; for (let i = 0; i < glows.length; i += 4) (glows[i + 3] >= 12 ? big : small).push(glows[i], glows[i + 1], glows[i + 2], glows[i + 3]);
  pts(big, 0xffa050, 0.8); pts(small, 0xffa050, 0.5); const redGlow = pts(reds, 0xff3020, 1.2);
  // Warm light spilling from the gate onto the terrace in front of it.
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(150, 110), wash(0xffa860, 0.5)); spill.rotation.x = -Math.PI / 2; spill.position.set(0, PLINTH_TOP + 0.3, 125); group.add(spill);

  const wp = new V3(), up = new V3();
  // Each frame (after the scene's matrices are updated): visible within KEEP.show, the shadow uniforms, the
  // fill from the ground (only while the sun is up there), the red lights blinking.
  function update(rt, lit) {
    const d = group.getWorldPosition(wp).length(); group.visible = d < KEEP.show; KEEP_U.kOn.value = group.visible ? 1 : 0;
    if (!group.visible) return;
    KEEP_U.kInv.value.copy(group.matrixWorld).invert(); KEEP_U.kSun.value.copy(sunDir).transformDirection(KEEP_U.kInv.value);
    up.set(0, 1, 0).transformDirection(group.matrixWorld);
    M.keep.emissive.copy(lin(0x2c2924)).multiplyScalar(smooth(-0.03, 0.3, up.dot(sunDir)) * lit);
    M.red.visible = redGlow.visible = (rt % 2) < 0.25;
  }
  return {group, update, sun: KEEP_U.kSun.value}; // sun: the direction to the sun in the Keep's frame
}
