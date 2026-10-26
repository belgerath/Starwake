// Loading the hangar's models (public/hangar, CC0, see CREDITS.md): Quaternius characters (meshopt-compressed,
// skinned and animated) and Kenney Space Kit props (flat unlit colours, turned into lit materials here).
// load() fetches each file once; make() returns a fresh copy scaled to a height in metres, standing on y = 0.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {SkeletonUtils} from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const url = name => import.meta.env.BASE_URL + 'hangar/' + name + '.glb';

// Loads every name in parallel; onProgress(fraction) after each. Resolves when all are in (failures included,
// so one missing file leaves a gap instead of an empty hangar); rejects only if none loaded.
export async function load(names, onProgress = () => {}) {
  let done = 0, ok = 0;
  await Promise.all(names.map(n => (cache.has(n) ? Promise.resolve(cache.get(n)) : loader.loadAsync(url(n)).then(g => { prepare(g); cache.set(n, g); return g; }))
    .then(() => { ok++; }, err => console.warn('hangar model', n, err))
    .finally(() => onProgress(++done / names.length))));
  if (!ok) throw new Error('No hangar models could be loaded');
}
export const has = name => cache.has(name);

// Unlit (Kenney) materials become standard ones so the hangar's lights shape them; everything casts no shadow.
function prepare(g) {
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const out = mats.map(m => m.isMeshBasicMaterial ? new THREE.MeshStandardMaterial({color: m.color, map: m.map, roughness: 0.7, metalness: 0.15, vertexColors: m.vertexColors}) : m);
    o.material = Array.isArray(o.material) ? out : out[0];
    if (o.isSkinnedMesh) o.frustumCulled = false; // the bind-pose bounds are not where the animated mesh is
  });
}

// What is drawn, approximately: each skinned mesh moved rigidly with its first bone (exact at the rest pose),
// other meshes as they are. Skinned bounds alone are off by the armature's scale in these files.
function drawnBox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4();
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    b.copy(o.geometry.boundingBox);
    if (o.isSkinnedMesh) { const sk = o.skeleton; m.multiplyMatrices(sk.bones[0].matrixWorld, sk.boneInverses[0]).premultiply(o.bindMatrixInverse).premultiply(o.matrixWorld).multiply(o.bindMatrix); }
    else m.copy(o.matrixWorld);
    box.union(b.applyMatrix4(m));
  });
  return box;
}

// A copy of a loaded model, scaled so it is `height` metres tall and standing on y = 0, inside a group that
// can be moved and turned. Returns {root, model, mixer, clips, play(name), height} or null if not loaded.
export function make(name, height, {hide = []} = {}) {
  const g = cache.get(name); if (!g) return null;
  const model = g.animations.length ? SkeletonUtils.clone(g.scene) : g.scene.clone(true);
  model.traverse(o => { if (o.isMesh && hide.some(h => o.name.toLowerCase().includes(h))) o.visible = false; });
  const mixer = g.animations.length ? new THREE.AnimationMixer(model) : null;
  const idle = g.animations.length ? clipFor(g.animations, 'idle') : null;
  if (idle) { mixer.clipAction(idle).play(); mixer.update(0); }
  const box = drawnBox(model), h = box.max.y - box.min.y, k = h > 1e-6 ? height / h : 1;
  model.scale.multiplyScalar(k); model.position.y = -box.min.y * k;
  const root = new THREE.Group(); root.add(model);
  let current = idle ? mixer.clipAction(idle) : null;
  // Cross-fades to the clip whose name ends in `want` (idle, walk, wave, ...); once plays it a single time.
  function play(want, {fade = 0.3, speed = 1, once = false} = {}) {
    const c = mixer && clipFor(g.animations, want); if (!c) return false;
    const a = mixer.clipAction(c); a.timeScale = speed;
    if (a === current && !once) return true;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.play();
    if (current && current !== a) current.crossFadeTo(a, fade, false);
    current = a; return true;
  }
  return {root, model, mixer, play, height, clips: g.animations.map(a => a.name)};
}

// The clip whose last name part is `want` (case-insensitive), e.g. "CharacterArmature|Walk" or
// "HumanArmature|Man_Walk" for 'walk', "Flying_Idle" for 'flying_idle'; plain 'idle' prefers exact matches.
export function clipFor(anims, want) {
  const w = want.toLowerCase(), last = a => a.name.toLowerCase().split('|').pop();
  return anims.find(a => last(a) === w) || anims.find(a => last(a).endsWith('_' + w)) || null;
}
