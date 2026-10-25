// Starwake entry point: wires modules together and runs the frame loop.
import './style.css';
import {WARPS, R, MOON_R} from './config.js';
import {clamp} from './util.js';
import {renderer, scene, skyScene, skyG, cam, icam, sunDir} from './engine.js';
import {S, O, initOrbit, initTalOrbit, orbInfo, stepFlight, maxWarpIdx, setNotifier, talAgl, talGroundVel, moonPos, hasCheckpoint, restoreCheckpoint, setHover} from './physics.js';
import {W, buildWorld, updateWorld, updateTerrain, updateRocks, updatePrediction, resetPrediction} from './world.js';
import {buildSky, updateSky} from './sky.js';
import {updateBridge} from './ship/bridge.js';
import {updateCamera, snapCamera} from './camera.js';
import {initInput, readInput} from './input.js';
import {initHud, initMarkers, updateHud, updateMarkers, refreshUI, toast, setStatus, setReady, hideIntro, showIntro, showCrash, hideCrash} from './hud.js';

let ready = false, crashShown = false;

function launch() { if (S.crash) return; S.launched = true; S.paused = false; hideIntro(); }
// Testing shortcut: a low orbit around Tal (from the intro card or the pause card).
function startTal() { initTalOrbit(sunDir); setMode(0); launch(); }
function togglePause() { if (S.crash) return; if (S.paused) { launch(); return; } S.paused = true; S.warpIdx = 0; showIntro('Resume'); }
// After a crash: Try again from the checkpoint (15 km up on the way down, or the last landing), or Back to orbit.
function retry() { if (!restoreCheckpoint()) { backToOrbit(); return; } hideCrash(); crashShown = false; snapCamera(); launch(); }
function backToOrbit() { hideCrash(); crashShown = false; startTal(); }
function setMode(m) {
  S.camMode = m; S.camYaw = 0; S.camPitch = 0;
  if (m === 2) { // start the map looking down on the ship from above the body it orbits
    const p = O.dom === 1 ? S.pos.clone().sub(moonPos(S.t, new S.pos.constructor())) : S.pos;
    S.mapYaw = Math.atan2(p.x, p.z); S.mapPitch = clamp(Math.asin(p.y / p.length()) + 0.45, -1.4, 1.4); resetPrediction();
  }
  snapCamera();
}
function cycleCam() { setMode((S.camMode + 1) % 3); }
function toggleHold(h) { if (!S.hover) S.hold = S.hold === h ? null : h; }
// Hover: belly thrusters, low over Tal. Starts at hover thrust; switching it off cuts the thrust.
function toggleHover() {
  if (S.hover) { setHover(false); return; }
  if (setHover(true)) toast('hover', 'Hover on. Thrust lifts the ship; let go of the stick and it levels out.');
  else toast('hoverNo', 'Hover works low over Tal, below 20 km.');
}
function warpStep(d) {
  const max = maxWarpIdx(), want = clamp(S.warpIdx + d, 0, WARPS.length - 1);
  if (want > max) { toast('warp', 'Time warp is limited this close to a surface.'); S.warpIdx = max; } else S.warpIdx = want;
}
const actions = {launch, startTal, retry, backToOrbit, togglePause, setMode, cycleCam, toggleHold, toggleHover, warpStep, isReady: () => ready};

setNotifier(toast);
initInput(actions);
initHud(actions);

// ?debug: frame rate and terrain numbers under the readouts, for checking performance on a phone.
let dbg = null, dbgT0 = 0, dbgN = 0, dbgTris = 0, dbgCalls = 0;
function updateDebug(now) {
  dbgN++; const el = (now - dbgT0) / 1000; if (el < 0.5) return;
  const t = W.terrain.stats();
  dbg.textContent = `${Math.round(dbgN / el)} fps · ${(el / dbgN * 1000).toFixed(1)} ms · ${(dbgTris / 1000).toFixed(0)}k tris · ${dbgCalls} draws · chunks ${t.drawn}/${t.built} · queue ${t.queued + t.inFlight} · level ${t.deepest}`;
  dbgT0 = now; dbgN = 0;
}

let last = 0, rt = 0, skyBodies = null;
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; rt += dt;
  if (S.launched && !S.paused) stepFlight(dt, readInput(dt));
  else { orbInfo(); S.inPitch *= 0.9; S.inYaw *= 0.9; }
  if (S.crash && !crashShown) { crashShown = true; showCrash(S.crash, hasCheckpoint()); }
  updateWorld(dt, rt);
  updateCamera(dt, rt);
  updateTerrain(cam);
  W.moon.getWorldPosition(skyBodies[1].pos); updateSky(dt, cam, skyBodies);
  updateRocks();
  updatePrediction(dt);
  skyG.position.copy(cam.position);
  renderer.clear(); renderer.render(skyScene, cam); renderer.clearDepth(); renderer.render(scene, cam);
  if (dbg) { dbgTris = renderer.info.render.triangles; dbgCalls = renderer.info.render.calls; updateDebug(now); }
  if (S.camMode === 1) { updateBridge(W.bridge, dt, rt); renderer.clearDepth(); renderer.render(W.bridge.IS, icam); }
  refreshUI(); updateHud(); updateMarkers();
  requestAnimationFrame(frame);
}

setTimeout(() => { // let the intro card paint before the GPU bakes the planet
  try { buildSky(); buildWorld(); } catch (err) { console.error(err); setStatus('Could not build the world on this device.'); return; }
  skyBodies = [{pos: W.world.position, radius: R, albedo: 1}, {pos: new S.pos.constructor(), radius: MOON_R, albedo: 0.55}];
  initOrbit(sunDir); setMode(0); initMarkers(actions);
  ready = true; setReady();
  if (new URLSearchParams(location.search).has('debug')) {
    window.starwake = {S, O, actions, W, cam, talAgl, talGroundVel, moonPos, orbInfo};
    dbg = document.createElement('div'); dbg.id = 'dbg'; document.getElementById('hud').appendChild(dbg);
  }
  requestAnimationFrame(frame);
}, 40);
