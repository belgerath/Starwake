// The hangar: bay 3 of Tumbledown seen from inside, its own scene drawn instead of space while docked.
// The Mudlark stands on its pad; around it aliens walk set paths, stop, chat, dance and fly, droids work,
// a cargo lift and a crane move. Inspector Drab (customs) walks over when you arrive; Mama Gorrit (trader)
// keeps her stall. Metres, y up, the pad's centre at the origin, the ship's nose toward the back wall (−z).
// Pure layout lives in paths.js; the models and their credits in models.js and CREDITS.md.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {renderer, app} from '../engine.js';
import {SHIP} from '../config.js';
import {lin, rng, clamp} from '../util.js';
import {buildTransport} from '../ship/transport.js';
import {panelTextures} from '../ship/destroyer.js';
import {load, make} from './models.js';
import {HALL, LOOPS, OFFICER, SPOTS, along, pathLength} from './paths.js';

const PEOPLE = ['astronaut', 'alien_big'];
const CROWD = ['yeti', 'orc_brute', 'demon_blue', 'pirate', 'worker', 'mech', 'mushroom_imp', 'slime_green', 'slime_pink', 'slime_horned', 'crab', 'robot_walker', 'skeleton_crew', 'blob_alien', 'mushroom_king', 'robot_large', 'jelly_flyer', 'ghost', 'robot_flyer'];
const PROPS = ['chest', 'crystal', 'tent', 'barrels', 'barrels_rail', 'machine_generator', 'machine_barrelLarge', 'machine_wireless', 'desk_computerScreen', 'desk_chair', 'structure_detailed', 'stairs', 'platform_large', 'craft_cargoA', 'craft_miner', 'rover', 'satelliteDish', 'gate_complex', 'turret_double'];
export const MODELS = [...PEOPLE, ...CROWD, ...PROPS];

// Who is in the hangar and what they do. walk: a loop from paths.js (at = start fraction, v = m/s, rev = the
// other way round); idle: a spot and a direction to face; dance; fly: a circle in the air. say: what they
// tell you when tapped.
const CAST = [
  {m: 'yeti', h: 2.6, walk: 'ring', at: 0.1, v: 1.0, say: 'The yeti hums a song about home. Home is very cold.'},
  {m: 'orc_brute', h: 2.3, walk: 'market', at: 0, v: 1.1, say: 'Buying? Selling? Fighting? I do all three.'},
  {m: 'demon_blue', h: 2.4, walk: 'cross', at: 0.3, v: 1.2, say: 'Don\'t stare. It\'s rude where I come from.'},
  {m: 'pirate', h: 1.9, walk: 'cross', at: 0.72, v: 1.0, say: 'Space is just a bigger sea. The parrot disagrees.'},
  {m: 'worker', h: 1.8, walk: 'cargo', at: 0.2, v: 1.2, say: 'Mind the lift. It bites.'},
  {m: 'mech', h: 3.4, walk: 'cargo', at: 0.7, v: 0.9, say: 'The loader beeps politely and keeps on lifting.'},
  {m: 'mushroom_imp', h: 1.0, walk: 'ring', at: 0.6, v: 0.8, rev: true, say: 'It squeaks and puffs out a small cloud of spores.'},
  {m: 'slime_green', h: 0.9, walk: 'market', at: 0.5, v: 0.7, say: 'The slime grins at you. You decide not to shake hands.'},
  {m: 'slime_pink', h: 0.8, walk: 'back', at: 0.2, v: 0.6, say: 'It wobbles at you. That might be a greeting.'},
  {m: 'crab', h: 0.9, walk: 'back', at: 0.65, v: 0.9, rev: true, say: 'The crab clicks something that sounds like a price.'},
  {m: 'robot_walker', h: 1.4, walk: 'ring', at: 0.35, v: 1.3, say: 'Bay 3 is clean. Bay 3 is very clean.'},
  {m: 'skeleton_crew', h: 1.8, idle: [-24, 18], face: [-20, 22], emotes: ['yes', 'no'], say: 'I came here with a full crew. Long story.'},
  {m: 'slime_horned', h: 1.0, idle: [-20, 22], face: [-24, 18], emotes: ['yes', 'no', 'jump'], say: 'Don\'t smile at Drab. Makes him suspicious.'},
  {m: 'blob_alien', h: 1.0, dance: [27, 7], face: [10, 30], say: 'It dances to music only it can hear.'},
  {m: 'mushroom_king', h: 2.4, idle: [37, 15], face: [20, 15], emotes: ['yes'], say: 'Spore and Sons. Fungus and futures. Mostly fungus.'},
  {m: 'robot_large', h: 2.2, idle: [-27, 21], face: [0, 0], emotes: [], say: 'Its red eye follows you all the way across the deck.'},
  {m: 'jelly_flyer', h: 1.4, fly: [33, -9, 10, 5.5, 0.22], say: 'It drifts past, humming softly.'},
  {m: 'ghost', h: 1.5, fly: [-6, 28, 7, 4.5, -0.3], say: 'Nobody knows how I got on the manifest.'},
  {m: 'robot_flyer', h: 1.1, fly: [0, 0, 10, 10.5, 0.35], say: 'The drone is scanning your hull. It seems impressed by the dents.'},
];

export const H = {scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(55, 1, 0.1, 600), built: false, agents: [], people: {}, picks: []};
let ship = null, lift = null, trolley = null, rover = null, blink = [], t = 0;
const R = rng(31);

// ---- building ----
// Loads the models (onProgress(0..1)) and builds the hangar once. Later calls return at once.
export async function loadHangar(onProgress) {
  if (H.built) { onProgress && onProgress(1); return; }
  await Promise.all([load(MODELS, onProgress), document.fonts ? document.fonts.load('64px Michroma').catch(() => {}) : null]);
  if (H.built) return;
  build(); H.built = true;
}

function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4; return tx; }
// A sign: lines of [text, size px, colour], glowing like neon unless paint is set. w×h metres.
function sign(lines, w, h, {paint = false, px = 1024} = {}) {
  const ph = Math.round(px * h / w);
  const tx = canvasTex(px, ph, (g, W, Hh) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; const total = lines.reduce((s, l) => s + l[1] * 1.25, 0); let y = (Hh - total) / 2;
    for (const [text, size, col] of lines) {
      g.font = `${size}px Michroma, "Arial Black", sans-serif`; y += size * 0.625;
      if (!paint) { g.shadowColor = col; g.shadowBlur = size * 0.45; g.fillStyle = col; g.fillText(text, W / 2, y); g.shadowBlur = size * 0.15; }
      g.fillStyle = paint ? col : '#fff8ee'; g.globalAlpha = paint ? 0.85 : 0.9; g.fillText(text, W / 2, y); g.globalAlpha = 1; y += size * 0.625;
    }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tx, transparent: true, depthWrite: false, toneMapped: paint}));
}
const shadowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const shadowMat = new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false});
function blob(r) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * r, 2 * r), shadowMat); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 1; return m; }

function build() {
  const S = H.scene; S.background = new THREE.Color(0x0b0d11);
  const pm = new THREE.PMREMGenerator(renderer); S.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  const T = panelTextures();
  const tile = (rx, ry) => { const map = T.map.clone(), rough = T.rough.clone(); for (const x of [map, rough]) { x.repeat.set(rx, ry); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.needsUpdate = true; } return {map, rough}; };
  const std = (hex, tx, metal = 0.3, rough = 0.85) => new THREE.MeshStandardMaterial({color: lin(hex), map: tx ? tx.map : null, roughnessMap: tx ? tx.rough : null, metalness: metal, roughness: rough, envMapIntensity: 0.5});
  const glow = hex => new THREE.MeshBasicMaterial({color: lin(hex), toneMapped: false});
  const add = (geo, mat, x, y, z, ry = 0, parent = S) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m; };
  const put = (name, h, x, z, ry = 0, y = 0) => { const o = make(name, h); if (!o) return null; o.root.position.set(x, y, z); o.root.rotation.y = ry; S.add(o.root); return o; };

  // ---- the hall: floor, walls, pillars, lights, gantry, doors ----
  const {x: HX, z: HZ, h: HY} = HALL;
  const deck = canvasTex(512, 512, (g, w, h) => {
    const r = rng(7); g.fillStyle = '#7a7d82'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, s = 20 + r() * 90, gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(40,38,34,${0.05 + r() * 0.1})`); gr.addColorStop(1, 'rgba(40,38,34,0)'); g.fillStyle = gr; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
    for (const [x, y, ww, hh] of [[0, 0, 512, 256], [0, 256, 256, 256], [256, 256, 256, 256]]) {
      g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x + 4, y + 4, ww - 8, 3); g.fillStyle = 'rgba(0,0,0,0.35)'; g.strokeStyle = 'rgba(30,30,32,0.75)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, ww - 4, hh - 4);
      g.fillStyle = 'rgba(30,30,32,0.6)'; for (const [bx, by] of [[x + 14, y + 14], [x + ww - 14, y + 14], [x + 14, y + hh - 14], [x + ww - 14, y + hh - 14]]) { g.beginPath(); g.arc(bx, by, 4, 0, Math.PI * 2); g.fill(); }
    }
  });
  deck.wrapS = deck.wrapT = THREE.RepeatWrapping; deck.repeat.set(2 * HX / 8, 2 * HZ / 8);
  const floor = add(new THREE.PlaneGeometry(2 * HX, 2 * HZ), new THREE.MeshStandardMaterial({map: deck, color: lin(0x9a9ca0), metalness: 0.3, roughness: 0.75, envMapIntensity: 0.4}), 0, 0, 0); floor.rotation.x = -Math.PI / 2;
  const wallM = std(0x6e737b, tile(22, 5)), ceilM = std(0x2c3036, tile(18, 14), 0.4, 0.9);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2 * HX, HY, 2 * HZ), [wallM, wallM, ceilM, new THREE.MeshBasicMaterial({visible: false}), wallM, wallM].map(m => { m.side = THREE.BackSide; return m; }));
  shell.position.y = HY / 2; S.add(shell);
  const darkM = std(0x353a42, tile(1, 4), 0.5, 0.7);
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, HY, 3), darkM, 14), m4 = new THREE.Matrix4(); let n = 0;
  for (const x of [-HX + 1.2, HX - 1.2]) for (let z = -39; z <= 39; z += 13) { m4.makeTranslation(x, HY / 2, z); pillars.setMatrixAt(n++, m4); }
  pillars.count = n; S.add(pillars);
  const stripM = glow(0xe8f2ff);
  for (const x of [-36, -12, 12, 36]) add(new THREE.BoxGeometry(1.4, 0.3, 2 * HZ - 10), stripM, x, HY - 0.2, 0);
  const amberM = glow(0xffb14a);
  for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.3, 0.25, 2 * HZ - 6), amberM, s * (HX - 0.2), 0.7, 0); add(new THREE.BoxGeometry(2 * HX - 6, 0.25, 0.3), amberM, 0, 0.7, s * (HZ - 0.2)); }
  for (const z of [-18, 18]) add(new THREE.BoxGeometry(2 * HX, 1.6, 1.2), darkM, 0, HY - 5, z);
  trolley = new THREE.Group(); trolley.position.set(0, HY - 5, -18); S.add(trolley);
  add(new THREE.BoxGeometry(4, 2.2, 3), std(0xb08a3e, null, 0.4, 0.6), 0, -1.6, 0, 0, trolley);
  // The doors you came in by, closed behind the ship, with red warning lights.
  const doorTex = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#3a3e45'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a2d32'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
    g.save(); g.beginPath(); g.rect(0, h * 0.82, w, h * 0.12); g.clip(); g.fillStyle = '#ffb14a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1c20';
    for (let x = -80; x < w + 80; x += 60) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 30, h); g.lineTo(x + 90, h * 0.8); g.lineTo(x + 60, h * 0.8); g.closePath(); g.fill(); } g.restore();
  });
  const doorM = new THREE.MeshStandardMaterial({map: doorTex, metalness: 0.4, roughness: 0.7, envMapIntensity: 0.4});
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(36, 22, 1), doorM, s * 18.2, 11, HZ - 0.6);
  add(new THREE.BoxGeometry(76, 2, 1.6), std(0xffb14a, null, 0.2, 0.5), 0, 23, HZ - 0.6);
  for (const x of [-26, 0, 26]) { const b = add(new THREE.SphereGeometry(0.6, 12, 8), glow(0xff3b30), x, 25, HZ - 1.2); blink.push(b); }
  const bay = sign([['BAY 3', 220, '#d8d2c4']], 38, 12, {paint: true}); bay.position.set(0, 17, -HZ + 0.15); S.add(bay);
  const welcome = sign([['TUMBLEDOWN', 90, '#ff8fb8'], ['BERTHS · TRADE · NO QUESTIONS ASKED', 34, '#9fd4ff']], 30, 6); welcome.position.set(0, 27, HZ - 1.4); welcome.rotation.y = Math.PI; S.add(welcome);

  // ---- floor paint: the pad, a stripe band by the doors ----
  const paintM = new THREE.MeshStandardMaterial({color: lin(0xd89a3a), roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2});
  const ring = add(new THREE.RingGeometry(16.4, 17.4, 72), paintM, 0, 0.02, 0); ring.rotation.x = -Math.PI / 2;
  for (const [w, d] of [[30, 0.8], [0.8, 30]]) { const l = add(new THREE.PlaneGeometry(w, d), paintM, 0, 0.02, 0); l.rotation.x = -Math.PI / 2; }
  const stripeTex = canvasTex(1024, 64, (g, w, h) => { g.fillStyle = '#ffb14a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1c20'; for (let x = -64; x < w + 64; x += 64) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 32, h); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.closePath(); g.fill(); } });
  stripeTex.wrapS = THREE.RepeatWrapping; stripeTex.repeat.set(6, 1);
  const band = add(new THREE.PlaneGeometry(2 * HX - 10, 2.2), new THREE.MeshStandardMaterial({map: stripeTex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2}), 0, 0.02, HZ - 9); band.rotation.x = -Math.PI / 2;

  // ---- the Mudlark on its pad, gear down, engines cold ----
  ship = buildTransport(); ship.root.position.set(0, -SHIP.feet[0][1], 0); ship.setLegs(1);
  for (const m of [...ship.flames, ...ship.glows]) m.visible = false; if (ship.eLight) ship.eLight.visible = false;
  for (const m of ship.mats) m.envMapIntensity = 0.7;
  S.add(ship.root); S.add(blob(15));

  // ---- customs: a booth with a window and a scanner gate on the walkway ----
  const [bx, bz] = SPOTS.booth;
  add(new THREE.BoxGeometry(10, 4.4, 7), std(0x3b4a5c, tile(2, 1), 0.4, 0.7), bx, 2.2, bz);
  add(new THREE.BoxGeometry(10.6, 0.5, 7.6), std(0x9fd4ff, null, 0.3, 0.5), bx, 4.6, bz);
  add(new THREE.BoxGeometry(0.2, 1.6, 5.4), new THREE.MeshStandardMaterial({color: lin(0x9fd4ff), transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.2}), bx + 5.05, 2.6, bz);
  put('desk_computerScreen', 1.2, bx + 3.6, bz, Math.PI / 2, 0); put('desk_chair', 1.0, bx + 2.2, bz + 1, -Math.PI / 2);
  put('satelliteDish', 2.6, bx - 2.5, bz - 2, 0.6, 4.85); put('machine_wireless', 2, bx - 3, bz + 5, 0.3);
  const customs = sign([['CUSTOMS', 120, '#9fd4ff']], 12, 3); customs.position.set(bx + 2, 7, bz + 3.9); customs.rotation.y = 0.5; S.add(customs);
  const papers = sign([['Have your papers ready.', 40, '#c9d2dc'], ['Or don\'t.', 40, '#c9d2dc']], 4.2, 1.3, {paint: true}); papers.position.set(bx + 5.12, 1.2, bz - 2.2); papers.rotation.y = Math.PI / 2; S.add(papers);
  put('gate_complex', 5.2, SPOTS.gate[0], SPOTS.gate[1], 0.13);
  const cl = new THREE.PointLight(0x9fd4ff, 1.3, 36, 2); cl.position.set(bx + 7, 7, bz + 3); S.add(cl);

  // ---- the market: Mama Gorrit's stall, and Spore and Sons ----
  const [sx, sz] = SPOTS.stall;
  put('tent', 4.6, sx + 6.5, sz, -Math.PI / 2);
  add(new THREE.BoxGeometry(2.2, 1.1, 9), std(0x6b4a2e, null, 0.1, 0.8), sx - 2.6, 0.55, sz); add(new THREE.BoxGeometry(2.6, 0.15, 9.4), std(0xa8794a, null, 0.1, 0.7), sx - 2.6, 1.17, sz);
  put('chest', 1.0, sx - 2.6, sz - 3, Math.PI / 2, 1.25); put('chest', 1.1, sx + 2, sz + 6, 0.4);
  const crys = [put('crystal', 1.2, sx - 2.6, sz + 3, 0.3, 1.25), put('crystal', 2.2, sx + 2.5, sz - 6.5, 1.1), put('crystal', 1.7, sx + 4, sz + 5.5, 2)];
  for (const c of crys) if (c) c.root.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = lin(0x6a1fb0); o.material.emissiveIntensity = 0.6; } });
  put('barrels', 1.6, sx + 2, sz - 6.5, 0.5);
  const gorrit = sign([['GORRIT\'S', 120, '#ffb14a'], ['WE BUY ANYTHING', 52, '#ff8fb8']], 10, 3.4); gorrit.position.set(sx + 3, 7.4, sz); gorrit.rotation.y = -Math.PI / 2; S.add(gorrit);
  const gl = new THREE.PointLight(0xffb14a, 1.0, 30, 2); gl.position.set(sx - 7, 9, sz); S.add(gl);
  const [s2x, s2z] = SPOTS.stall2;
  put('tent', 5, s2x + 2, s2z, -Math.PI / 2 + 0.3); put('crystal', 1.2, s2x - 2.5, s2z + 3, 0.5); put('barrels', 1.4, s2x - 1, s2z - 4, 1);
  const spore = sign([['SPORE & SONS', 80, '#b9f06e'], ['FUNGUS AND FUTURES', 40, '#d8d2c4']], 8, 2.2); spore.position.set(s2x - 3, 6.4, s2z); spore.rotation.y = -Math.PI / 2 + 0.3; S.add(spore);

  // ---- cargo: barrels, machines, a scaffold with a lift; parked small craft; turrets by the doors ----
  const [cx, cz] = SPOTS.cargo;
  put('structure_detailed', 9, cx - 3, cz + 2, 0); put('stairs', 4.5, cx + 3.5, cz + 2, -Math.PI / 2);
  lift = put('platform_large', 0.5, cx - 3, cz + 2); if (lift) { lift.root.scale.setScalar(1); const b = put('barrels_rail', 1.6, 0, 0); if (b) { S.remove(b.root); b.root.position.y = 0.5; lift.root.add(b.root); } }
  put('machine_barrelLarge', 3.2, cx + 4, cz - 4, 0.4); put('machine_barrelLarge', 3.2, cx - 5, cz - 5, -0.3); put('machine_generator', 2.4, cx + 6, cz + 7, 1.2);
  put('barrels', 1.6, cx - 7, cz + 6, 0.2); put('barrels', 1.6, cx + 1, cz - 7.5, 2.1);
  put('craft_cargoA', 5.5, SPOTS.craftA[0], SPOTS.craftA[1], 0.6); put('craft_miner', 5, SPOTS.craftB[0], SPOTS.craftB[1], -2.4);
  put('turret_double', 3.6, -48, 40, Math.PI); put('turret_double', 3.6, 48, 40, Math.PI);
  rover = put('rover', 2.2, 0, 0); if (rover) rover.s = 30;

  // ---- light ----
  S.add(new THREE.HemisphereLight(lin(0xbfd2ee), lin(0x4a4038), 0.75));
  const key = new THREE.DirectionalLight(0xfff1dc, 0.7); key.position.set(20, 40, 25); S.add(key);
  const pad = new THREE.PointLight(0xffe2bf, 1.0, 50, 2); pad.position.set(0, 24, 4); S.add(pad);

  // ---- people ----
  for (const c of CAST) addAgent(c);
  H.people.customs = addAgent({m: 'astronaut', h: 1.9, hide: ['pistol'], idle: OFFICER.home, face: [0, -11], key: 'customs'});
  H.people.trader = addAgent({m: 'alien_big', h: 2.9, idle: [SPOTS.stall[0], SPOTS.stall[1]], face: [0, SPOTS.stall[1]], key: 'trader'});
  resize();
}

// ---- people ----
const turnTo = (a, x, z, dt) => { const want = Math.atan2(x, z), r = a.o.root.rotation; let d = want - r.y; d = Math.atan2(Math.sin(d), Math.cos(d)); r.y += d * Math.min(1, dt * 6); };
function addAgent(c) {
  const o = make(c.m, c.h, {hide: c.hide || []}); if (!o) return null;
  const a = {c, o, key: c.key || null, say: c.say || null, s: 0, dir: c.rev ? -1 : 1, mode: 'idle', timer: 3 + R() * 20, shadow: blob(Math.max(0.5, c.h * 0.32))};
  H.scene.add(o.root);
  if (c.fly) { H.scene.add(a.shadow); a.ang = R() * Math.PI * 2; o.play('flying_idle') || o.play('idle'); }
  else o.root.add(a.shadow);
  if (c.walk) { a.path = LOOPS[c.walk]; a.s = (c.at || 0) * pathLength(a.path); a.mode = 'walk'; walkAnim(a); }
  if (c.idle || c.dance) { const p = c.idle || c.dance; o.root.position.set(p[0], 0, p[1]); if (c.face) o.root.rotation.y = Math.atan2(c.face[0] - p[0], c.face[1] - p[1]); }
  if (c.dance) o.play('dance');
  // An invisible upright cylinder to tap.
  const pick = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.7, c.h * 0.35), Math.max(0.7, c.h * 0.35), c.h * 1.1, 8), new THREE.MeshBasicMaterial({visible: false}));
  pick.position.y = c.h * 0.55; pick.userData.agent = a; o.root.add(pick); H.picks.push(pick);
  H.agents.push(a); return a;
}
function walkAnim(a) { a.o.play('walk', {speed: clamp(a.c.v / (0.6 * a.c.h), 0.6, 1.8)}); }

// Inspector Drab walks to the Mudlark and calls arrived() there, or walks back to the booth.
let officerDone = null; const OFFICER_V = 1.7;
export function officerCome(arrived) {
  const a = H.people.customs; if (!a) { arrived && arrived(); return; }
  a.mode = 'route'; a.path = OFFICER.route; a.s = 0; a.dir = 1; officerDone = arrived; walkAnim({...a, c: {...a.c, v: OFFICER_V}});
}
export function officerLeave() {
  const a = H.people.customs; if (!a) return;
  const out = a.mode === 'route' ? a.dir > 0 : !!a.face; if (!out) return; // already home, or on the way back
  if (a.mode !== 'route') a.s = pathLength(OFFICER.route, false);
  a.mode = 'route'; a.path = OFFICER.route; a.dir = -1; a.face = null; officerDone = null; walkAnim({...a, c: {...a.c, v: OFFICER_V}});
}
export function officerHome() {
  const a = H.people.customs; if (!a) return;
  a.mode = 'idle'; a.face = null; officerDone = null; a.o.root.position.set(OFFICER.home[0], 0, OFFICER.home[1]); a.o.root.rotation.y = Math.atan2(0 - OFFICER.home[0], -11 - OFFICER.home[1]); a.o.play('idle');
}
// One gesture, then back to idling: 'wave', 'yes', 'no'.
export function gesture(key, name) { const a = H.people[key]; if (a && a.o.play(name, {once: true})) { a.mode = 'emote'; a.timer = 2.2; } }

const P = {x: 0, z: 0, dx: 0, dz: 1};
function stepAgent(a, dt) {
  const c = a.c, r = a.o.root;
  if (a.mode === 'walk') {
    a.s += a.dir * c.v * dt; along(a.path, a.s, true, P); r.position.set(P.x, 0, P.z); turnTo(a, a.dir * P.dx, a.dir * P.dz, dt);
    if ((a.timer -= dt) < 0) { a.mode = 'pause'; a.timer = 2 + R() * 4; a.o.play(R() < 0.25 ? 'wave' : 'idle', {once: false}) || a.o.play('idle'); }
  } else if (a.mode === 'pause') {
    if ((a.timer -= dt) < 0) { a.mode = 'walk'; a.timer = 12 + R() * 30; walkAnim(a); }
  } else if (a.mode === 'route') {
    const L = pathLength(a.path, false); a.s = clamp(a.s + a.dir * OFFICER_V * dt, 0, L); along(a.path, a.s, false, P); r.position.set(P.x, 0, P.z); turnTo(a, a.dir * P.dx, a.dir * P.dz, dt);
    if ((a.dir > 0 && a.s >= L) || (a.dir < 0 && a.s <= 0)) {
      a.mode = 'idle'; a.timer = 6; a.o.play('idle');
      if (a.dir > 0) { a.face = H.cam.position; const done = officerDone; officerDone = null; done && done(); } else a.face = null;
    }
  } else if (c.fly) {
    const [x, z, rad, y, w] = c.fly; a.ang += w * dt; const s = Math.sign(w);
    r.position.set(x + rad * Math.cos(a.ang), y + 0.35 * Math.sin(t * 1.3 + x), z + rad * Math.sin(a.ang)); turnTo(a, -s * Math.sin(a.ang), s * Math.cos(a.ang), dt);
    a.shadow.position.set(r.position.x, 0.03, r.position.z);
  } else if (a.mode === 'emote') {
    if ((a.timer -= dt) < 0) { a.mode = 'idle'; a.timer = 6 + R() * 10; a.o.play('idle'); }
  } else if (a.mode === 'idle') {
    if (a.face) turnTo(a, a.face.x - r.position.x, a.face.z - r.position.z, dt);
    if (c.emotes && c.emotes.length && (a.timer -= dt) < 0) { const e = c.emotes[Math.floor(R() * c.emotes.length)]; if (a.o.play(e, {once: true})) { a.mode = 'emote'; a.timer = 2.4; } else a.timer = 8; }
  }
  if (a.o.mixer) a.o.mixer.update(dt);
}

// ---- camera: orbit a target; drag to turn, pinch or wheel to zoom, focus() glides to a person ----
const V = {yaw: 0.3, pitch: 0.26, dist: 40, target: new THREE.Vector3(0, 3, 2)};
const goal = {on: false, yaw: 0, pitch: 0, dist: 0, target: new THREE.Vector3()};
export function defaultView(snap = false) { const tall = H.cam.aspect < 1; Object.assign(goal, {on: true, yaw: 0.3, pitch: tall ? 0.42 : 0.26, dist: tall ? 50 : 40}); goal.target.set(0, tall ? 1 : 3, 2); if (snap) snapView(); }
export function settle() { snapView(); } // jumps to where the camera is gliding (for headless checks)
function snapView() { if (goal.on) { V.yaw = goal.yaw; V.pitch = goal.pitch; V.dist = goal.dist; V.target.copy(goal.target); goal.on = false; } }
// Looks at someone a few metres away: Gorrit from in front of her stall, Drab from beyond him with the
// Mudlark behind. The person sits beside the card (left of it in landscape, above it in portrait).
export function focus(key) {
  const a = H.people[key]; if (!a) return; const p = a.o.root.position;
  const yaw = key === 'customs' ? Math.atan2(p.x, p.z) : a.o.root.rotation.y;
  Object.assign(goal, {on: true, yaw, pitch: key === 'trader' ? 0.24 : 0.17, dist: (key === 'trader' ? 5.5 : 6.5) + a.c.h}); goal.target.set(p.x, a.c.h * 0.6, p.z);
  if (app.clientWidth > app.clientHeight) goal.target.add(right.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(goal.dist * 0.3));
  else goal.target.y -= goal.dist * 0.2;
}
const right = new THREE.Vector3();
export function orbit(dx, dy) { goal.on = false; V.yaw -= dx * 0.006; V.pitch = clamp(V.pitch + dy * 0.004, 0.04, 1.2); }
export function zoom(f) { goal.on = false; V.dist = clamp(V.dist * f, 6, 70); }
const ang = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; };
function updateCamera(dt) {
  if (goal.on) {
    const k = 1 - Math.exp(-dt * 3.5); V.yaw = ang(V.yaw, goal.yaw, k); V.pitch += (goal.pitch - V.pitch) * k; V.dist += (goal.dist - V.dist) * k; V.target.lerp(goal.target, k);
    if (Math.abs(goal.dist - V.dist) < 0.05 && V.target.distanceTo(goal.target) < 0.05) goal.on = false;
  }
  const cp = Math.cos(V.pitch), p = H.cam.position;
  p.set(V.target.x + V.dist * Math.sin(V.yaw) * cp, V.target.y + V.dist * Math.sin(V.pitch), V.target.z + V.dist * Math.cos(V.yaw) * cp);
  p.x = clamp(p.x, -HALL.x + 3, HALL.x - 3); p.z = clamp(p.z, -HALL.z + 3, HALL.z - 3); p.y = clamp(p.y, 1.2, HALL.h - 3);
  // Not inside the Mudlark: push out from its hull, a flattened sphere around the pad.
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
  a.o.root.getWorldPosition(sp); sp.y += a.c.h * 1.04; sp.project(H.cam);
  if (sp.z > 1) return null; out.x = (sp.x + 1) / 2 * app.clientWidth; out.y = (1 - sp.y) / 2 * app.clientHeight; return out;
}

// ---- per frame ----
export function resize() { H.cam.aspect = app.clientWidth / Math.max(1, app.clientHeight); H.cam.fov = H.cam.aspect < 1 ? 70 : 55; H.cam.updateProjectionMatrix(); }
export function updateHangar(dt) {
  t += dt;
  for (const a of H.agents) stepAgent(a, dt);
  if (lift) lift.root.position.y = 3.6 - 3.4 * Math.cos(t * 0.3);
  if (trolley) trolley.position.x = 38 * Math.sin(t * 0.05);
  if (rover) { rover.s += 2.2 * dt; along(LOOPS.cargo, -rover.s, true, P); rover.root.position.set(P.x + 3.5 * -P.dz, 0, P.z + 3.5 * P.dx); rover.root.rotation.y = Math.atan2(-P.dx, -P.dz); }
  const on = (t % 1.6) < 0.5; for (const b of blink) b.visible = on;
  if (ship) { ship.strobe.visible = (t % 1.6) < 0.12; ship.dish.rotation.y += dt * 0.8; }
  if (app.clientWidth / Math.max(1, app.clientHeight) !== H.cam.aspect) resize();
  updateCamera(dt);
}
export function renderHangar() { renderer.clear(); renderer.render(H.scene, H.cam); }
