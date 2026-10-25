// Three views: 0 chase, 1 bridge, 2 map (centred on the body you are orbiting). Chase follows the
// ship's rotation with a short lag and returns behind the ship 1.2 s after you stop looking around
// (unless Look is on). With the landing legs down, chase blends into a landing view: off to the side
// and above, upright to the local vertical, looking down past the hull at the ground below the legs.
import * as THREE from 'three';
import {SHIP_SCALE, BRIDGE_PITCH, CHASE, R, MOON_R} from './config.js';
import {clamp, smooth} from './util.js';
import {cam, icam} from './engine.js';
import {S, O, talAgl, moonPos, radialOut, STAND_H} from './physics.js';
import {W} from './world.js';
import {IN} from './input.js';

const camQ = new THREE.Quaternion(), tQ = new THREE.Quaternion(), tE2 = new THREE.Euler(0, 0, 0, 'YXZ');
const off = new THREE.Vector3(), look = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), dirV = new THREE.Vector3(), camU = new THREE.Vector3(), mP = new THREE.Vector3();
const vert = new THREE.Vector3(), side = new THREE.Vector3(), landDir = new THREE.Vector3(), lOff = new THREE.Vector3(), lLook = new THREE.Vector3();
const chaseOff = new THREE.Vector3(...CHASE), CAM_CLEAR = 40; // the chase camera stays at least this far above Tal's ground
const LAND_D = 700; // landing view: distance from the ship's centre (metres, times zoom)
let snap = true, landOn = false;
export function snapCamera() { snap = true; }

// Landing view, written into lOff (camera position) and lLook (target), both relative to the ship.
// The camera sits on the ship's deck side when it stands on its tail (behind it when level), low and close
// near the ground, higher and looking more steeply down while there is still height to lose. On a portrait
// screen it stands further back and frames the ship lower, clear of the readouts.
function landingView(dt) {
  radialOut(vert);
  side.set(0, 1, 0).applyQuaternion(S.quat).add(dirV.set(0, 0, 1).applyQuaternion(S.quat)); side.addScaledVector(vert, -side.dot(vert));
  if (side.lengthSq() > 1e-4) {
    side.normalize();
    if (snap || !landOn) landDir.copy(side); else landDir.lerp(side, 1 - Math.exp(-dt * 1.5));
  }
  landDir.addScaledVector(vert, -landDir.dot(vert)).normalize();
  const port = cam.aspect < 1, k = smooth(150, 2500, O.clear), el = clamp(0.26 + 0.79 * k + S.camPitch, -0.2, 1.45);
  const D = LAND_D * S.camZoom * (port ? 1.4 : 1), aim = port ? 60 : 90;
  lOff.copy(landDir).applyAxisAngle(vert, S.camYaw).multiplyScalar(Math.cos(el) * D).addScaledVector(vert, Math.sin(el) * D);
  lLook.copy(vert).multiplyScalar(-(aim + (STAND_H - aim) * k));
}

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
    const orb = clamp((Math.abs(yawV) + Math.abs(S.camPitch)) / 0.5, 0, 1);
    fwd.set(0, 0, -1).applyQuaternion(camQ); up.set(0, 1, 0).applyQuaternion(camQ);
    look.set(0, 0, 0).addScaledVector(fwd, 1260 * (1 - orb)).addScaledVector(up, 63 * (1 - orb));
    const b = O.dom === 1 ? smooth(0, 1, S.legs) : 0; // blend into the landing view as the legs come down
    if (b > 0) { landingView(dt); off.lerp(lOff, b); look.lerp(lLook, b); up.lerp(vert, b); if (up.lengthSq() < 1e-4) up.copy(vert); up.normalize(); }
    landOn = b > 0;
    // Never underground: lift the camera straight up from Tal's surface if it would dip below it.
    camU.copy(S.pos).add(off); const agl = talAgl(camU, S.t);
    if (agl < CAM_CLEAR) off.addScaledVector(camU.sub(moonPos(S.t, mP)).normalize(), CAM_CLEAR - agl);
    cam.position.copy(off); cam.up.copy(up); cam.lookAt(look);
  } else if (mode === 1) {
    S.camYaw = clamp(S.camYaw, -1.4, 1.4); S.camPitch = clamp(S.camPitch, -0.9, 0.8);
    cam.position.copy(ship.eye).multiplyScalar(SHIP_SCALE).applyQuaternion(S.quat);
    tE2.set(S.camPitch + BRIDGE_PITCH, S.camYaw, 0, 'YXZ'); tQ.setFromEuler(tE2);
    cam.quaternion.copy(S.quat).multiply(tQ); icam.quaternion.copy(tQ);
    fov = cam.aspect < 1 ? 88 : 74;
  } else {
    const tal = O.dom === 1; if (tal) moonPos(S.t, mP).sub(S.pos); else mP.copy(W.world.position);
    dirV.set(Math.cos(S.mapPitch) * Math.sin(S.mapYaw), Math.sin(S.mapPitch), Math.cos(S.mapPitch) * Math.cos(S.mapYaw));
    cam.position.copy(mP).addScaledVector(dirV, (tal ? MOON_R : R) * 4 * S.mapZoom); cam.up.set(0, 1, 0); cam.lookAt(mP); fov = 50;
  }
  snap = false;
  cam.fov = fov; cam.updateProjectionMatrix();
  if (mode === 1) { icam.fov = fov; icam.updateProjectionMatrix(); }
}
