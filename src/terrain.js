// Tal's ground: a cube-sphere quadtree of chunks that split as the camera gets closer, so detail
// follows you down. Chunks are built from tal.js (in Web Workers when available), so the ground you
// see is the ground physics collides with. Colours and far-away shading come from Tal's baked maps.
//
// Precision: chunk vertices are relative to the chunk's centre, and three.js composes object
// transforms in doubles, so with the floating origin a chunk near the ship has a small translation
// and float32 on the GPU stays precise near the camera.
import * as THREE from 'three';
import {MOON_R, TAL_MAX_H, TERRAIN_MAX_LEVEL, TERRAIN_SPLIT, TERRAIN_CACHE, SUN_I} from './config.js';
import {buildChunk, chunkIndex, chunkSpan, chunkSize, faceDir} from './terrain-build.js';
import {TERRAIN_VERT, TERRAIN_FRAG} from './shaders.js';
import {sunDir} from './engine.js';

const LO = MOON_R - TAL_MAX_H, HI = MOON_R + TAL_MAX_H;

function makeNode(face, level, ix, iy, parent) {
  const [a0, b0, s] = chunkSpan(level, ix, iy), size = chunkSize(level);
  // Height range: the parent's until this chunk is built (children are only made under built parents).
  const minH = parent ? parent.minH : -TAL_MAX_H, maxH = parent ? parent.maxH : TAL_MAX_H;
  return {face, level, ix, iy, size, dir: faceDir(face, a0 + s / 2, b0 + s / 2, [0, 0, 0]), ang: s * 0.6,
    minH, maxH, state: 0, mesh: null, kids: null, used: 0};
}

export function createTerrain(parent, albedoMap, normalMap) {
  const group = new THREE.Group(); parent.add(group);
  const uniforms = {albedoMap: {value: albedoMap}, normalMap: {value: normalMap}, sunDir: {value: sunDir}, sunI: {value: SUN_I},
    objRot: {value: new THREE.Matrix3()}, moonC: {value: new THREE.Vector3()}, mapFade: {value: new THREE.Vector2(80e3, 200e3)}};
  const material = new THREE.ShaderMaterial({uniforms, vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG, extensions: {derivatives: true}});
  const index = new THREE.BufferAttribute(chunkIndex(), 1);
  const roots = [0, 1, 2, 3, 4, 5].map(f => makeNode(f, 0, 0, 0, null));
  const built = new Set(), queue = new Set(), jobs = new Map();
  let frame = 0, nextId = 1, drawn = [];

  function attach(n, c) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(c.nor, 3)); g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), c.radius);
    const m = new THREE.Mesh(g, material); m.position.fromArray(c.center); m.matrixAutoUpdate = false; m.updateMatrix(); m.visible = false;
    group.add(m); n.mesh = m; n.minH = c.minH; n.maxH = c.maxH; n.state = 2; n.used = frame; built.add(n);
  }
  for (const n of roots) attach(n, buildChunk(n.face, 0, 0, 0)); // Tal must always have something to draw

  // Workers: one or two, leaving a core for the game. Falls back to one chunk per frame on this thread.
  const workers = [];
  try {
    const nw = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < nw; i++) {
      const w = new Worker(new URL('./terrain-worker.js', import.meta.url), {type: 'module'});
      w.busy = 0; w.onmessage = e => { w.busy--; const n = jobs.get(e.data.id); jobs.delete(e.data.id); if (n && n.state === 1) attach(n, e.data); };
      w.onerror = e => console.error('Terrain worker failed:', e.message);
      workers.push(w);
    }
  } catch (err) { console.warn('Terrain workers unavailable, building on the main thread.', err); }

  function request(n) { n.want = frame; if (n.state === 0) { n.state = 1; queue.add(n); } }
  function dispatch(cam) {
    for (const n of queue) if (n.want < frame) { queue.delete(n); n.state = 0; } // no longer needed: you moved on
    if (!queue.size) return;
    // Coarse chunks first, then the nearest.
    const list = [...queue].sort((a, b) => a.level - b.level || dist2(a, cam) - dist2(b, cam));
    if (!workers.length) { const n = list[0]; queue.delete(n); attach(n, buildChunk(n.face, n.level, n.ix, n.iy)); return; }
    for (const n of list) {
      const w = workers.reduce((a, b) => (b.busy < a.busy ? b : a)); if (w.busy >= 2) break;
      const id = nextId++; jobs.set(id, n); queue.delete(n); w.busy++; w.postMessage({id, face: n.face, level: n.level, ix: n.ix, iy: n.iy});
    }
  }

  function dist2(n, cam) { const r = MOON_R + (n.minH + n.maxH) / 2; return (cam.x - n.dir[0] * r) ** 2 + (cam.y - n.dir[1] * r) ** 2 + (cam.z - n.dir[2] * r) ** 2; }
  // Beyond the horizon: the chunk's highest ground cannot be seen over the lowest possible ground.
  function culled(n, cam, camR, horizon) {
    const cosA = (cam.x * n.dir[0] + cam.y * n.dir[1] + cam.z * n.dir[2]) / camR;
    return Math.acos(Math.min(1, Math.max(-1, cosA))) - n.ang > horizon;
  }
  function wantSplit(n, cam) {
    if (n.level >= TERRAIN_MAX_LEVEL) return false;
    const d = Math.sqrt(dist2(n, cam)) - n.size * 0.71 - (n.maxH - n.minH) / 2;
    return n.size / Math.max(d, 1) > TERRAIN_SPLIT;
  }

  // Per frame: cam is the camera position in Tal's body frame (metres).
  function update(cam) {
    frame++; const camR = cam.length();
    const horizon = camR > LO ? Math.acos(LO / camR) + Math.acos(LO / HI) : Math.PI;
    for (const n of drawn) n.mesh.visible = false;
    drawn = [];
    const visit = n => {
      if (culled(n, cam, camR, horizon)) return;
      if (wantSplit(n, cam)) {
        if (!n.kids) n.kids = [0, 1, 2, 3].map(k => makeNode(n.face, n.level + 1, n.ix * 2 + (k & 1), n.iy * 2 + (k >> 1), n));
        let ready = true;
        for (const k of n.kids) if (k.state !== 2 && !culled(k, cam, camR, horizon)) { request(k); ready = false; }
        if (ready) { for (const k of n.kids) visit(k); return; }
      }
      n.mesh.visible = true; n.used = frame; drawn.push(n);
    };
    for (const r of roots) visit(r);
    dispatch(cam);
    if (built.size > TERRAIN_CACHE && frame % 30 === 0) evict();
  }

  // Free the least recently drawn chunks (never the roots); their parents draw until they are rebuilt.
  function evict() {
    const old = [...built].filter(n => n.level > 0 && n.used < frame).sort((a, b) => a.used - b.used);
    for (const n of old.slice(0, built.size - TERRAIN_CACHE * 0.9)) {
      group.remove(n.mesh); n.mesh.geometry.dispose(); n.mesh = null; n.state = 0; built.delete(n);
    }
  }

  // Per frame, after the scene's matrices are updated: Tal's rotation and centre for the shader.
  function updateUniforms(moon) {
    uniforms.objRot.value.setFromMatrix4(moon.matrixWorld); moon.getWorldPosition(uniforms.moonC.value);
  }

  return {group, material, update, updateUniforms, stats: () => ({drawn: drawn.length, built: built.size, queued: queue.size, inFlight: jobs.size, deepest: drawn.reduce((m, n) => Math.max(m, n.level), 0)})};
}
