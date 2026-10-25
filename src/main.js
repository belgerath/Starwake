// Starwake entry point: wires modules together and runs the frame loop.
import './style.css';
import {WARPS} from './config.js';
import {clamp} from './util.js';
import {renderer, scene, skyScene, skyG, cam, icam, sunDir} from './engine.js';
import {S, O, initOrbit, orbInfo, stepFlight, maxWarpIdx, setNotifier} from './physics.js';
import {W, buildWorld, updateWorld, updateRocks, updatePrediction, resetPrediction} from './world.js';
import {updateBridge} from './ship/bridge.js';
import {updateCamera, snapCamera} from './camera.js';
import {initInput, readInput} from './input.js';
import {initHud, initMarkers, updateHud, updateMarkers, refreshUI, toast, setStatus, setReady, hideIntro, showIntro} from './hud.js';

let ready = false;

function launch() { S.launched = true; S.paused = false; hideIntro(); }
function togglePause() { if (S.paused) { launch(); return; } S.paused = true; S.warpIdx = 0; showIntro('Resume'); }
function setMode(m) {
  S.camMode = m; S.camYaw = 0; S.camPitch = 0;
  if (m === 2) { S.mapYaw = Math.atan2(S.pos.x, S.pos.z); S.mapPitch = clamp(Math.asin(S.pos.y / S.pos.length()) + 0.45, -1.4, 1.4); resetPrediction(); }
  snapCamera();
}
function cycleCam() { setMode((S.camMode + 1) % 3); }
function toggleHold(h) { S.hold = S.hold === h ? null : h; }
function warpStep(d) {
  const max = maxWarpIdx(), want = clamp(S.warpIdx + d, 0, WARPS.length - 1);
  if (want > max) { toast('warp', 'Time warp is limited this close to a surface.'); S.warpIdx = max; } else S.warpIdx = want;
}
const actions = {launch, togglePause, setMode, cycleCam, toggleHold, warpStep, isReady: () => ready};

setNotifier(toast);
initInput(actions);
initHud(actions);

let last = 0, rt = 0;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; rt += dt;
  if (S.launched && !S.paused) stepFlight(dt, readInput(dt));
  else { orbInfo(); S.inPitch *= 0.9; S.inYaw *= 0.9; }
  updateWorld(dt, rt);
  updateCamera(dt, rt);
  updateRocks();
  updatePrediction(dt);
  skyG.position.copy(cam.position);
  renderer.clear(); renderer.render(skyScene, cam); renderer.clearDepth(); renderer.render(scene, cam);
  if (S.camMode === 1) { updateBridge(W.bridge, dt, rt); renderer.clearDepth(); renderer.render(W.bridge.IS, icam); }
  refreshUI(); updateHud(); updateMarkers();
  requestAnimationFrame(frame);
}

setTimeout(() => { // let the intro card paint before the GPU bakes the planet
  try { buildWorld(); } catch (err) { console.error(err); setStatus('Could not build the world on this device.'); return; }
  initOrbit(sunDir); setMode(0); initMarkers(actions);
  ready = true; setReady();
  if (new URLSearchParams(location.search).has('debug')) window.starwake = {S, O, actions, W};
  requestAnimationFrame(frame);
}, 40);
