// Starwake entry point: wires modules together and runs the frame loop.
import './style.css';
import {WARPS, R, MOON_R, STATION, SHIP} from './config.js';
import {clamp} from './util.js';
import {renderer, scene, skyScene, skyG, cam, icam, sunDir} from './engine.js';
import {S, O, ST, HB, initOrbit, initTalOrbit, orbInfo, stepFlight, maxWarpIdx, setNotifier, talAgl, talGroundVel, moonPos, hasCheckpoint, restoreCheckpoint, setHover, requestDock as askToDock, startUndock, outpostPos} from './physics.js';
import {saveGame, loadGame, clearSave} from './save.js';
import {G, onDock, onUndock, deliver, callTug as payTug} from './game.js';
import {startCourse, stepCourse, cancelCourse, courseActive, setCourseHooks} from './course.js';
import {W, buildWorld, updateWorld, updateTerrain, updateRocks, updatePrediction, resetPrediction} from './world.js';
import {buildSky, updateSky} from './sky.js';
import {updateBridge} from './ship/bridge.js';
import {updateCamera, snapCamera} from './camera.js';
import {initInput, readInput, IN} from './input.js';
import {updateSound, sfx, soundOn, setSound, soundDebug} from './sound.js';
import {initHud, initMarkers, updateHud, updateMarkers, refreshUI, toast, setStatus, setReady, hideIntro, showIntro, showCrash, hideCrash, setDockAsk, setDocked, setTugAsk, showDelivered, hideDelivered, showCourses, hideCourses} from './hud.js';

let ready = false, crashShown = false, dockDeclined = false, quietOut = 0, askShown = false, wasDocked = false, saveT = 0, tugQuiet = 0, cardPaused = false;
// The hangar (hangar/ui.js, loaded on demand): HG once it is built; inHangar while it is drawn instead of space.
let HG = null, hgLoading = null, hgPct = 0, hgFailed = false, inHangar = false;

function launch() { if (S.crash) return; S.launched = true; S.paused = false; hideIntro(); }
// Testing shortcut: a low orbit around Tal (from the intro card or the pause card).
function startTal() { cancelCourse(); initTalOrbit(sunDir); setMode(0); launch(); }
function togglePause() { if (S.crash) return; if (S.paused) { launch(); return; } S.paused = true; S.warpIdx = 0; saveGame(); showIntro('Resume'); }
// New game: back to the start orbit behind Tumbledown, the saved game forgotten.
function newGame() { cancelCourse(); clearSave(); initOrbit(sunDir); setMode(0); launch(); }
// After a crash: Try again from the checkpoint (see physics), or Back to orbit (around Tal, or the start orbit).
function retry() { cancelCourse(); if (!restoreCheckpoint()) { backToOrbit(); return; } hideCrash(); crashShown = false; snapCamera(); launch(); }
function backToOrbit() { cancelCourse(); hideCrash(); crashShown = false; if (O.dom === 1) startTal(); else { initOrbit(sunDir); setMode(0); launch(); } }
// Docking at Tumbledown: station control flies the run. Not now hides the offer until you leave its range,
// and after undocking it stays hidden until you are 3 km out.
function requestDock() { if (!askToDock()) return false; cancelCourse(); setDockAsk(false); sfx('chime'); toast('dockOk', `${STATION.name} control: we have you. Sit back.`); preloadHangar(); return true; }
function declineDock() { dockDeclined = true; quietOut = STATION.dockRange * 1.1; setDockAsk(false); }
function undock() {
  if (!startUndock()) return;
  if (inHangar) { HG.exit(); inHangar = false; }
  setDocked(false); dockDeclined = true; quietOut = 3000; saveGame();
}
// Starts fetching and building the hangar while the docking run plays, so it is ready on arrival.
function preloadHangar() {
  if (HG || hgLoading) return;
  hgFailed = false; hgPct = 0;
  hgLoading = import('./hangar/ui.js').then(m => m.loadHangar(p => { hgPct = p; }).then(() => { HG = m; }))
    .catch(err => { console.error(err); hgFailed = true; }).finally(() => { hgLoading = null; });
}
const hangarHooks = {undock, save: saveGame, pause: togglePause, sound: sfx};
function toggleSound() { setSound(!soundOn()); showSound(); }
function showSound() { const b = document.getElementById('soundBtn'); b.textContent = soundOn() ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', soundOn()); }
// Enter: yes to the docking offer, or undock from the bay.
function dockKey() { if (askShown) requestDock(); else if (!inHangar && S.dock && S.dock.phase === 'docked' && S.bay < 0.05) undock(); }
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
// The flight computer's courses: a card to pick one (the game waits while it is open); the course hands over to
// station control at the end, like the docking offer.
function pauseFor(on) { if (on && !S.paused) { cardPaused = true; S.paused = true; } else if (!on && cardPaused) { cardPaused = false; S.paused = false; } }
function openCourses() { pauseFor(true); showCourses(dest => { const why = startCourse(dest); closeCourses(); if (why) toast('course', why); else sfx('chime'); }, () => { cancelCourse('Course cancelled. You have the controls.'); closeCourses(); }, closeCourses); }
function closeCourses() { hideCourses(); pauseFor(false); }
setCourseHooks({dock: requestDock});
// Tanks dry: a tug, or Not now for a minute.
function callTug() { cancelCourse(); payTug(); setTugAsk(false); sfx('clunk'); toast('tug', `A ${STATION.name} tug has you on a line. You owe it ${G.credits < 0 ? 'more than you have' : 'its fee'}.`); preloadHangar(); }
function declineTug() { tugQuiet = 60; setTugAsk(false); }
function closeDelivered() { hideDelivered(); pauseFor(false); }
const actions = {launch, startTal, newGame, retry, backToOrbit, togglePause, setMode, cycleCam, toggleHold, toggleHover, warpStep, requestDock, declineDock, undock, dockKey, toggleSound, openCourses, callTug, declineTug, closeDelivered, isReady: () => ready};

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
// Sound follows the ship: engine and thrusters, the bay doors, the hangar; clunks and the crash as they happen.
const was = {landed: false, crash: null, phase: null, brake: false, bay: 0, w: 0};
// Landing on Tal: delivers the job if this is its outpost (a card, the pay), or says it is the wrong one.
function landed() {
  const r = deliver(O.outpost, O.outpostDist); if (!r) return;
  if (r.paid) { sfx('coins'); pauseFor(true); showDelivered(r.title, r.text + ' Back to Tumbledown for more work.'); saveGame(); }
  else toast('wrongOutpost', r.text);
}
function sounds(dt) {
  const w = S.w.length(), turn = Math.min(1, Math.abs(w - was.w) / Math.max(dt, 1e-3) / 0.3); was.w = w;
  const doors = Math.min(1, Math.abs(S.bay - was.bay) / Math.max(dt, 1e-3) * 8); was.bay = S.bay;
  const flying = S.launched && !S.paused && !S.crash && !inHangar;
  updateSound({main: S.aMain / SHIP.aBoost, lift: S.aLift / SHIP.aLift, turn, boost: IN.boost, retro: IN.retro && !S.dock && !S.landed, doors, hangar: inHangar && !S.paused, quiet: !flying});
  const phase = S.dock ? S.dock.phase : null, brake = O.brake <= 0 && !S.hover;
  if (S.landed && !was.landed) { sfx('clunk'); landed(); }
  if (phase === 'docked' && was.phase === 'in') sfx('clunk');
  if (S.crash && !was.crash) sfx('crash');
  if (brake && !was.brake && flying) sfx('warn');
  was.landed = S.landed; was.crash = S.crash; was.phase = phase; was.brake = brake;
}
function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; rt += dt;
  if (S.launched && !S.paused) {
    stepCourse(dt); const inp = readInput(dt);
    if (courseActive() && (inp.boost || inp.retro)) cancelCourse('Course cancelled. You have the controls.');
    stepFlight(dt, inp);
  }
  else { orbInfo(); S.inPitch *= 0.9; S.inYaw *= 0.9; }
  if (S.crash && !crashShown) { crashShown = true; showCrash(S.crash, hasCheckpoint()); }
  // Docking: offer it in range (time warp stops so the offer is not missed), the docked card in the bay.
  if (O.stDist > quietOut) dockDeclined = false;
  const ask = S.launched && !S.paused && O.dockable && !dockDeclined;
  if (ask && !askShown) S.warpIdx = 0;
  askShown = ask; setDockAsk(ask);
  const docked = !!S.dock && S.dock.phase === 'docked', inBay = docked && S.bay < 0.05;
  if (docked && !wasDocked) { onDock(); saveGame(); } // the Factor's work changes with each docking
  if (!docked && wasDocked) onUndock(); // customs again next visit
  wasDocked = docked;
  // In the bay with the doors shut: into the hangar once it has loaded; until then the docked card says why not.
  if (inBay && !inHangar && !S.paused && S.launched) { if (HG) { inHangar = true; HG.enter(hangarHooks); } else if (!hgFailed) preloadHangar(); }
  if (inHangar && !inBay) { HG.exit(); inHangar = false; }
  setDocked(inBay && !inHangar && !S.paused, hgFailed ? 'The hangar could not load. Check your connection, then undock and dock again.' : `Opening the hangar… ${Math.round(hgPct * 100)}%`);
  // Tanks dry and nowhere to go: offer a tug (Not now hides it for a minute).
  tugQuiet = Math.max(0, tugQuiet - dt); setTugAsk(S.launched && !S.paused && !S.dock && !S.crash && S.fuel < 50 && tugQuiet <= 0);
  W.outpostTarget = G.job ? G.job.to : null;
  // The browser keeps the game: on docking (above), every minute of flight, on pause and when the page is hidden.
  if (S.launched && !S.paused && !S.crash) { saveT += dt; if (saveT > 60) { saveT = 0; saveGame(); } }
  sounds(dt);
  if (inHangar) { HG.frame(dt); requestAnimationFrame(frame); return; } // space keeps its state, unseen
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
  initOrbit(sunDir); const saved = loadGame(); setMode(0); initMarkers(actions);
  ready = true; setReady(saved); showSound();
  addEventListener('visibilitychange', () => { if (document.hidden && S.launched) saveGame(); });
  addEventListener('pagehide', () => { if (S.launched) saveGame(); });
  if (new URLSearchParams(location.search).has('debug')) {
    window.starwake = {S, O, ST, HB, G, actions, W, cam, talAgl, talGroundVel, moonPos, outpostPos, orbInfo, hangar: () => HG, sound: soundDebug};
    dbg = document.createElement('div'); dbg.id = 'dbg'; document.getElementById('hud').appendChild(dbg);
  }
  requestAnimationFrame(frame);
}, 40);
