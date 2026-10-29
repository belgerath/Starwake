// Everything in the universe that gets drawn: Veyra (surface, clouds, atmosphere), the ring and
// its local rocks, Tal (terrain.js), the orbit lines for map view, the player's ship (ship/transport.js),
// Tumbledown station (station.js) and the Halberd (ship/destroyer.js).
//
// Floating origin: W.world is placed at -S.pos every frame, so the ship is always at the render
// origin and nearby geometry keeps full float precision. Physics stays in the universe frame.
import * as THREE from 'three';
import {R, ATM_TOP, MOON_R, MOON_A, SPIN, GM, RING_IN, RING_OUT, RING_H, SUN_I, SHIP, STATION, NPRED, ROCK_MAX, ROCK_CELL, ROCK_VIS, TAU, TAL_SEED, TAL_RELIEF} from './config.js';
import {clamp, smooth, lin, glowTex, hash, makeNoise} from './util.js';
import {scene, sunDir, sunLight, hemi, makeEnv, renderer, cam} from './engine.js';
import {bake} from './bake.js';
import {PLANET_H, PLANET_ALB, NORMAL_PASS, CLOUD_PASS, MOON_H, MOON_ALB, SURF_VERT, PLANET_FRAG, CLOUD_FRAG, ATMO_FRAG, RING_FRAG} from './shaders.js';
import {S, O, ST, HB, lvlhQuat, qTilt, qTiltInv, eqN, moonQ, omegaP, moonTh, predictPath, radialOut, sunlitFactor} from './physics.js';
import {createTerrain} from './terrain.js';
import {buildTransport} from './ship/transport.js';
import {buildDestroyer} from './ship/destroyer.js';
import {buildStation} from './station.js';
import {buildOutposts} from './outposts.js';
import {buildBridge} from './ship/bridge.js';

const V3 = THREE.Vector3;
export const W = {predPos: new Float32Array(NPRED * 3)};

// Ring density profile, 0..1 across the ring's width. Mirrors ringDens() in RING_FRAG; keep them in sync.
export function ringDensJS(u) {
  if (u < 0 || u > 1) return 0; const edge = smooth(0, 0.04, u) * (1 - smooth(0.95, 1, u));
  let prof = 0.16 + (0.95 - 0.16) * smooth(0.22, 0.3, u); prof = prof + (0.55 - prof) * smooth(0.585, 0.6, u);
  const b = prof * (0.78 + 0.12 * Math.sin(u * 91 + 0.4) + 0.1 * Math.sin(u * 233 + 2.1) + 0.08 * Math.sin(u * 577) + 0.06 * Math.sin(u * 1531 + 1));
  const gap = 1 - 0.95 * Math.exp(-Math.pow((u - 0.615) / 0.013, 2)) - 0.8 * Math.exp(-Math.pow((u - 0.88) / 0.003, 2));
  return clamp(edge * b * gap, 0, 1);
}

function rockGeo(seed, det) {
  const g = new THREE.IcosahedronGeometry(1, det || 1); const p = g.attributes.position; const f = makeNoise(seed);
  for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; const s = 1 + 0.38 * f(x, y, z, 3, 1.8); p.setXYZ(i, x * s, y * s, z * s); }
  g.computeVertexNormals(); return g;
}

export function buildWorld() {
  const coarseDev = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const PS = coarseDev ? 768 : 1024; // planet cube map size per face
  const env = makeEnv(); scene.environment = env;
  const pH = bake(PS, PLANET_H, {seed: {value: new V3(3.1, 7.7, 1.3)}, bias: {value: -0.04}}, true);
  const pA = bake(PS, PLANET_ALB, {H: {value: pH.texture}, seed: {value: new V3(3.1, 7.7, 1.3)}});
  const pN = bake(PS, NORMAL_PASS, {H: {value: pH.texture}, k: {value: 0.025}, flatSea: {value: 1}});
  pH.dispose();
  const pC = bake(512, CLOUD_PASS, {seed: {value: new V3(8.2, 2.4, 5.9)}});
  const mH = bake(512, MOON_H, {seed: {value: new V3(...TAL_SEED)}}, true);
  const mA = bake(512, MOON_ALB, {H: {value: mH.texture}});
  const mN = bake(512, NORMAL_PASS, {H: {value: mH.texture}, k: {value: TAL_RELIEF / MOON_R}, flatSea: {value: 0}});
  mH.dispose();
  const surfMat = (a, n, c, atm, str) => new THREE.ShaderMaterial({uniforms: {albedoMap: {value: a.texture}, normalMap: {value: n.texture}, cloudMap: {value: c ? c.texture : a.texture}, hasClouds: {value: c ? 1 : 0}, hasOcean: {value: str > 0 ? 1 : 0}, cloudDelta: {value: 0}, sunI: {value: SUN_I}, atmoStrength: {value: str}, sunDir: {value: sunDir}, atmoColor: {value: new V3(...atm)}, objRot: {value: new THREE.Matrix3()}}, vertexShader: SURF_VERT, fragmentShader: PLANET_FRAG, extensions: {derivatives: true}});

  W.world = new THREE.Group(); scene.add(W.world);
  W.tiltG = new THREE.Group(); W.tiltG.quaternion.copy(qTilt); W.world.add(W.tiltG);
  W.spinG = new THREE.Group(); W.tiltG.add(W.spinG);
  W.planet = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 160), surfMat(pA, pN, pC, [0.32, 0.55, 1.0], 1)); W.spinG.add(W.planet);
  W.cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.0018, 256, 160), new THREE.ShaderMaterial({uniforms: {cloudMap: {value: pC.texture}, sunDir: {value: sunDir}, sunI: {value: SUN_I}, objRot: {value: new THREE.Matrix3()}}, vertexShader: SURF_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide}));
  W.cloudMesh.renderOrder = 1; W.spinG.add(W.cloudMesh);
  W.atmo = new THREE.Mesh(new THREE.SphereGeometry(R + ATM_TOP, 160, 120), new THREE.ShaderMaterial({uniforms: {center: {value: new V3()}, sunDir: {value: sunDir}, cDay: {value: new V3(0.28, 0.55, 1.0)}, cSet: {value: new V3(1.0, 0.42, 0.18)}, Rp: {value: R}, Ra: {value: R + ATM_TOP}, intensity: {value: 1.6}}, vertexShader: SURF_VERT, fragmentShader: ATMO_FRAG, blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false}));
  W.atmo.renderOrder = 2; W.world.add(W.atmo);
  const rg = new THREE.RingGeometry(RING_IN, RING_OUT, 720, 8); rg.rotateX(-Math.PI / 2);
  W.ringMat = new THREE.ShaderMaterial({uniforms: {center: {value: new V3()}, L: {value: sunDir}, ringN: {value: eqN.clone()}, Rp: {value: R}, Rin: {value: RING_IN}, Rout: {value: RING_OUT}, sunI: {value: SUN_I}, fade: {value: 1}}, vertexShader: SURF_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, extensions: {derivatives: true}});
  W.ring = new THREE.Mesh(rg, W.ringMat); W.ring.renderOrder = 3; W.tiltG.add(W.ring);
  const moonPlane = new THREE.Group(); moonPlane.quaternion.copy(qTiltInv).multiply(moonQ); W.tiltG.add(moonPlane); // = physics' moonQ
  W.moonPivot = new THREE.Group(); moonPlane.add(W.moonPivot);
  // W.moon is Tal's body frame (tal.js heights and talQuat() live here); the ground is terrain chunks in it.
  W.moon = new THREE.Group(); W.moon.position.set(MOON_A, 0, 0); W.moonPivot.add(W.moon);
  W.terrain = createTerrain(W.moon, mA.texture, mN.texture);
  W.outposts = buildOutposts(W.moon); W.outpostTarget = null; // main.js sets the delivery's outpost
  const mpts = []; for (let i = 0; i <= 360; i++) { const a = i / 360 * TAU; mpts.push(new V3(MOON_A * Math.cos(a), 0, -MOON_A * Math.sin(a))); }
  W.moonLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(mpts), new THREE.LineBasicMaterial({color: 0x8ea2b6, transparent: true, opacity: 0.4, depthWrite: false})); W.moonLine.frustumCulled = false; moonPlane.add(W.moonLine);
  const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.BufferAttribute(W.predPos, 3).setUsage(THREE.DynamicDrawUsage)); og.setDrawRange(0, 0);
  W.orbitLine = new THREE.Line(og, new THREE.LineBasicMaterial({color: lin(0xffb14a), toneMapped: false, depthWrite: false, transparent: true})); W.orbitLine.frustumCulled = false; W.world.add(W.orbitLine);
  W.rocks = new THREE.InstancedMesh(rockGeo(55, 2), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.95, metalness: 0.05, flatShading: true}), ROCK_MAX);
  W.rocks.frustumCulled = false; W.rocks.count = 0; W.rocks.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(W.rocks);
  W.ship = buildTransport(); scene.add(W.ship.root);
  // Tumbledown and the Halberd sit in W.world at their universe positions (three.js composes matrices in
  // doubles, so near the ship they stay precise). The Halberd's engines are cold.
  W.station = buildStation(); W.world.add(W.station.root);
  W.halberd = buildDestroyer(); W.world.add(W.halberd.root); W.halberd.eLight.visible = false;
  for (const m of [...W.halberd.flames, ...W.halberd.glows]) m.visible = false;
  W.heatSpr = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTex([[0, 'rgba(255,240,210,1)'], [0.25, 'rgba(255,150,60,0.7)'], [0.6, 'rgba(255,80,20,0.15)'], [1, 'rgba(255,60,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, opacity: 0}));
  W.heatSpr.visible = false; scene.add(W.heatSpr);
  W.bridge = buildBridge(env);
  return W;
}

const peq = new V3(), tV = new V3(), vAir = new V3(), qSt = new THREE.Quaternion();
const skyOut = new THREE.Color(0x000000), groundOut = new THREE.Color(0x6d8db8), bayLamp = new THREE.Color(0xa88a64), bayFloor = new THREE.Color(0x2a2118); // bay 3: dim and warm, like the hangar
// How far inside Tumbledown's bay the ship is (0 outside, 1 well in).
function insideBay() {
  if (O.stDist > 3000) return 0;
  tV.subVectors(S.pos, ST.pos).applyQuaternion(lvlhQuat(ST, qSt).invert());
  const {bay, hubLen} = STATION;
  return Math.abs(tV.x) < bay.w / 2 && Math.abs(tV.y) < bay.h / 2 ? smooth(hubLen / 2 + 10, hubLen / 2 - 50, tV.z) : 0;
}
// Per-frame: place the universe around the ship, spin bodies, update lighting and effects.
export function updateWorld(dt, rt) {
  W.world.position.copy(S.pos).negate();
  W.spinG.rotation.y = SPIN * S.t; W.cloudMesh.rotation.y = -0.2 * SPIN * S.t; W.planet.material.uniforms.cloudDelta.value = -W.cloudMesh.rotation.y;
  W.moonPivot.rotation.y = moonTh(S.t);
  W.outposts.update(rt, W.outpostTarget);
  const ship = W.ship;
  ship.root.quaternion.copy(S.quat); ship.setLegs(S.legs); ship.dish.rotation.y += dt * 0.8; ship.strobe.visible = (rt % 1.6) < 0.12; ship.nav[2].visible = (rt % 1.2) < 0.6;
  W.station.root.position.copy(ST.pos); lvlhQuat(ST, W.station.root.quaternion); W.station.update(S.t, S.bay, rt);
  W.halberd.root.position.copy(HB.pos); lvlhQuat(HB, W.halberd.root.quaternion); W.halberd.root.visible = O.hbDist < 300e3 && S.camMode !== 2;
  scene.updateMatrixWorld();
  for (const m of [W.planet, W.cloudMesh]) m.material.uniforms.objRot.value.setFromMatrix4(m.matrixWorld);
  W.terrain.updateUniforms(W.moon, cam, renderer.domElement.height);
  W.atmo.material.uniforms.center.value.copy(W.world.position); W.ringMat.uniforms.center.value.copy(W.world.position);
  // Fade the ring sheet when flying through it, where individual rocks take over.
  peq.copy(S.pos).applyQuaternion(qTiltInv); const rs = Math.hypot(peq.x, peq.z);
  W.ringMat.uniforms.fade.value = (S.camMode !== 2 && rs > RING_IN - 30e3 && rs < RING_OUT + 30e3) ? smooth(12e3, 50e3, Math.abs(peq.y)) : 1;
  // Lighting: eclipse, planet-shine from below, reflections off when in shadow. Inside Tumbledown's bay the
  // sun does not reach: it fades out and the bay's lamps (a warm light from overhead) take over.
  S.lit = sunlitFactor(sunDir);
  const inside = insideBay();
  sunLight.intensity = SUN_I * S.lit * (1 - 0.94 * inside); radialOut(tV); hemi.position.copy(tV);
  const sub = tV.copy(S.pos).normalize().dot(sunDir); hemi.intensity = 0.55 * clamp(sub * 1.5 + 0.35, 0, 1) * Math.pow(R / S.pos.length(), 2) * (1 - inside) + 0.7 * inside;
  hemi.color.copy(skyOut).lerp(bayLamp, inside); hemi.groundColor.copy(groundOut).lerp(bayFloor, inside);
  for (const m of ship.mats) m.envMapIntensity = (0.12 + 0.88 * S.lit) * (1 - 0.8 * inside);
  // Engine and lift thruster flames, sized by what each is pushing (1 = full throttle, 2 = Boost).
  const engines = (f, flames, glows, len) => {
    for (const fl of flames) { fl.visible = f > 0.01; fl.scale.y = len * (0.15 + f * 0.9 + Math.random() * 0.06); fl.material.opacity = fl.userData.op * (0.6 + Math.min(f, 1) * 0.4); }
    for (const g of glows) { const s = g.userData.base * (0.25 + Math.min(f, 2) * 0.55 + Math.random() * 0.04); g.scale.set(s, s, 1); }
  };
  const f = S.aMain / SHIP.aMain; engines(f, ship.flames, ship.glows, ship.flameLen);
  if (ship.lift) engines(S.aLift / SHIP.aLift, ship.lift.flames, ship.lift.glows, ship.lift.len);
  ship.eLight.intensity = 2.5 * Math.min(f, 2);
  if (S.heat > 0.01 && S.camMode !== 2) {
    vAir.crossVectors(omegaP, S.pos); vAir.subVectors(S.vel, vAir).normalize();
    W.heatSpr.visible = true; W.heatSpr.position.copy(vAir).multiplyScalar(0.6 * SHIP.length);
    const hs = 1.75 * SHIP.length * (0.4 + 0.6 * Math.sqrt(S.heat)); W.heatSpr.scale.set(hs, hs, 1); W.heatSpr.material.opacity = Math.min(1, S.heat * 1.2);
  } else W.heatSpr.visible = false;
  W.orbitLine.visible = W.moonLine.visible = S.camMode === 2;
  ship.root.visible = S.camMode !== 2;
}

// Ring rocks near the ship. The ring is divided into rows (radius) and cells (angle); each row
// orbits rigidly at its own Keplerian rate and each cell hashes to a few rocks, so the field is
// the same every time you return and costs nothing when you are elsewhere.
const dmy = new THREE.Object3D(), rc3 = new THREE.Color(), rockP = new V3();
export function updateRocks() {
  const rocks = W.rocks; rocks.count = 0; if (S.camMode === 2) return;
  const CELL = ROCK_CELL, VIS = ROCK_VIS;
  peq.copy(S.pos).applyQuaternion(qTiltInv);
  const rs = Math.hypot(peq.x, peq.z), ys = peq.y;
  if (Math.abs(ys) > VIS + RING_H || rs < RING_IN - VIS || rs > RING_OUT + VIS) return;
  const ths = Math.atan2(-peq.z, peq.x), ir0 = Math.floor((rs - VIS) / CELL), ir1 = Math.floor((rs + VIS) / CELL), K = Math.ceil(VIS / CELL) + 1;
  let n = 0;
  outer: for (let ir = ir0; ir <= ir1; ir++) {
    const rc = (ir + 0.5) * CELL; if (rc < RING_IN || rc > RING_OUT) continue;
    const dens = ringDensJS((rc - RING_IN) / (RING_OUT - RING_IN)); if (dens < 0.02) continue;
    const nth = Math.floor(TAU * rc / CELL), om = Math.sqrt(GM / (rc * rc * rc));
    let f = ((ths - om * S.t) / TAU) % 1; if (f < 0) f += 1; const ic = Math.floor(f * nth);
    for (let j = -K; j <= K; j++) {
      const it = ((ic + j) % nth + nth) % nth; const cnt = Math.floor(dens * 3.2 + hash(ir, it, 0));
      for (let m = 0; m < cnt; m++) {
        const h1 = hash(ir, it, m * 8 + 1), h2 = hash(ir, it, m * 8 + 2), h3 = hash(ir, it, m * 8 + 3), h4 = hash(ir, it, m * 8 + 4), h5 = hash(ir, it, m * 8 + 5), h6 = hash(ir, it, m * 8 + 6);
        const rr = ir * CELL + h1 * CELL, th = (it + h2) / nth * TAU + om * S.t;
        rockP.set(rr * Math.cos(th), (h3 - 0.5) * 2 * RING_H, -rr * Math.sin(th)).applyQuaternion(qTilt).sub(S.pos);
        const d = rockP.length(); if (d > VIS) continue;
        let s = h4 < 0.03 ? 250 + h5 * 700 : 5 * Math.exp(h5 * 3.7); s *= 1 - smooth(VIS * 0.7, VIS, d);
        dmy.position.copy(rockP); dmy.rotation.set(h1 * 6.28 + S.t * 0.01 * (h6 - 0.5), h3 * 6.28, h5 * 6.28); dmy.scale.set(s * (0.8 + h6 * 0.5), s * (0.6 + h2 * 0.5), s); dmy.updateMatrix();
        rocks.setMatrixAt(n, dmy.matrix); const v = 0.62 + h6 * 0.4; rc3.setRGB(v, v * (0.93 + h2 * 0.06), v * (0.84 + h4 * 0.12)); rocks.setColorAt(n, rc3);
        if (++n >= ROCK_MAX) break outer;
      }
    }
  }
  rocks.count = n; rocks.instanceMatrix.needsUpdate = true; if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
}

// After the camera moves: refine Tal's ground around it.
const camBody = new V3();
export function updateTerrain(cam) { W.terrain.update(W.moon.worldToLocal(camBody.copy(cam.position))); }

let predT = 1e9;
export function resetPrediction() { predT = 1e9; }
// Map view only: refresh the predicted orbit 4 times a second.
export function updatePrediction(dt) {
  if (S.camMode !== 2) return; predT += dt; if (predT < 0.25) return; predT = 0;
  const n = predictPath(W.predPos, NPRED);
  W.orbitLine.geometry.setDrawRange(0, n); W.orbitLine.geometry.attributes.position.needsUpdate = true;
}
