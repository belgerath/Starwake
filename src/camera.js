// Three views: 0 chase, 1 bridge, 2 map. Chase follows the ship's rotation with a short lag and
// returns behind the ship 1.2 s after you stop looking around (unless Look is on).
import * as THREE from 'three';
import {SHIP_SCALE, BRIDGE_PITCH, CHASE, R} from './config.js';
import {clamp} from './util.js';
import {cam, icam} from './engine.js';
import {S, talAgl, moonPos} from './physics.js';
import {W} from './world.js';
import {IN} from './input.js';

const camQ = new THREE.Quaternion(), tQ = new THREE.Quaternion(), tE2 = new THREE.Euler(0, 0, 0, 'YXZ');
const off = new THREE.Vector3(), look = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), dirV = new THREE.Vector3(), camU = new THREE.Vector3(), mP = new THREE.Vector3();
const chaseOff = new THREE.Vector3(...CHASE), CAM_CLEAR = 40; // the chase camera stays at least this far above Tal's ground
let snap = true;
export function snapCamera() { snap = true; }

export function updateCamera(dt, rt) {
  const mode = S.camMode, ship = W.ship;
  for (const m of ship.towerHide) m.visible = mode !== 1; // hide the bridge tower when you're inside it
  if (mode !== 2 && !IN.looking && !IN.lookOn && performance.now() - IN.lastLook > 1200) {
    const k = 1 - Math.exp(-dt * 2.2); S.camYaw -= S.camYaw * k; S.camPitch -= S.camPitch * k;
  }
  S.camYaw = Math.atan2(Math.sin(S.camYaw), Math.cos(S.camYaw));
  let fov = 62;
  if (mode === 0) {
    if (snap) camQ.copy(S.quat); else camQ.slerp(S.quat, 1 - Math.exp(-dt * 3));
    const yawV = S.camYaw + (S.launched ? 0 : Math.sin(rt * 0.25) * 0.55);
    off.copy(chaseOff); off.z += S.boostAmt * 2; off.multiplyScalar(SHIP_SCALE * S.camZoom);
    tE2.set(S.camPitch, yawV, 0, 'YXZ'); tQ.setFromEuler(tE2); off.applyQuaternion(tQ).applyQuaternion(camQ);
    // Never underground: lift the camera straight up from Tal's surface if it would dip below it.
    camU.copy(S.pos).add(off); const agl = talAgl(camU, S.t);
    if (agl < CAM_CLEAR) off.addScaledVector(camU.sub(moonPos(S.t, mP)).normalize(), CAM_CLEAR - agl);
    cam.position.copy(off);
    const orb = clamp((Math.abs(yawV) + Math.abs(S.camPitch)) / 0.5, 0, 1);
    fwd.set(0, 0, -1).applyQuaternion(camQ); up.set(0, 1, 0).applyQuaternion(camQ);
    cam.up.copy(up); look.set(0, 0, 0).addScaledVector(fwd, 1260 * (1 - orb)).addScaledVector(up, 63 * (1 - orb)); cam.lookAt(look);
  } else if (mode === 1) {
    S.camYaw = clamp(S.camYaw, -1.4, 1.4); S.camPitch = clamp(S.camPitch, -0.9, 0.8);
    cam.position.copy(ship.eye).multiplyScalar(SHIP_SCALE).applyQuaternion(S.quat);
    tE2.set(S.camPitch + BRIDGE_PITCH, S.camYaw, 0, 'YXZ'); tQ.setFromEuler(tE2);
    cam.quaternion.copy(S.quat).multiply(tQ); icam.quaternion.copy(tQ);
    fov = cam.aspect < 1 ? 88 : 74;
  } else {
    dirV.set(Math.cos(S.mapPitch) * Math.sin(S.mapYaw), Math.sin(S.mapPitch), Math.cos(S.mapPitch) * Math.cos(S.mapYaw));
    cam.position.copy(W.world.position).addScaledVector(dirV, R * 4 * S.mapZoom); cam.up.set(0, 1, 0); cam.lookAt(W.world.position); fov = 50;
  }
  snap = false;
  cam.fov = fov; cam.updateProjectionMatrix();
  if (mode === 1) { icam.fov = fov; icam.updateProjectionMatrix(); }
}
