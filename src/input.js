// Keyboard, mouse and touch.
//   Touch (chase/bridge): one finger = steering stick wherever it lands (or camera if Look is on);
//     two thumbs = twist like a steering wheel to roll, pinch to zoom.
//   Touch (map): one finger rotates the map, pinch zooms.
//   Mouse: left drag steers, right drag looks, wheel zooms.
// Stick and mouse go through an expo curve so small movements give fine control.
// In hover mode the thrust slider (and W/S) drives the belly lift thrusters instead of the main engine.
import {clamp} from './util.js';
import {app, canvas} from './engine.js';
import {S} from './physics.js';

export const IN = {pitch: 0, yaw: 0, roll: 0, boost: false, retro: false, lookOn: false, looking: false, lastLook: -1e9};

const keys = Object.create(null);
const mouse = {x: 0, y: 0}, joy = {x: 0, y: 0};
let md = null, mlook = null;
const touches = new Map();
let twoG = false, oneLook = false, gestureLock = false, pinch0 = 0, ang0 = 0, rollG = 0, lastP = null, rollT = 0, boostT = false;
const STEER_R = 70;
const dz = v => Math.abs(v) < 0.08 ? 0 : v, expo = v => 0.25 * v + 0.75 * v * v * v;

function appXY(e) { const r = app.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; }
function spread() { const a = [...touches.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
function pairAngle() { const a = [...touches.values()]; return Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x); }
function orbitBy(dx, dy) {
  if (S.camMode === 2) { S.mapYaw -= dx * 0.006; S.mapPitch = clamp(S.mapPitch + dy * 0.005, -1.45, 1.45); }
  else { S.camYaw -= dx * 0.008; S.camPitch = clamp(S.camPitch - dy * 0.006, -1.3, 1.0); }
  IN.lastLook = performance.now();
}
function zoomBy(f) { if (S.camMode === 2) S.mapZoom = clamp(S.mapZoom * f, 0.32, 9); else S.camZoom = clamp(S.camZoom * f, 0.55, 3); }

// actions: {launch, retry, togglePause, setMode, cycleCam, toggleHold, toggleHover, warpStep, dockKey, isReady}
export function initInput(actions) {
  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true; if (e.repeat) return;
    if (e.code === 'Enter' && actions.isReady() && S.paused) { if (S.crash) actions.retry(); else actions.launch(); return; }
    if (!S.launched) return;
    if (e.code === 'Enter') actions.dockKey();
    if (e.code === 'KeyC') actions.cycleCam();
    if (e.code === 'KeyM') actions.setMode(S.camMode === 2 ? 0 : 2);
    if (e.code === 'Escape' || e.code === 'KeyH') actions.togglePause();
    if (e.code === 'KeyF') actions.toggleHold('pro');
    if (e.code === 'KeyR') actions.toggleHold('retro');
    if (e.code === 'KeyG') actions.toggleHover();
    if (e.code === 'KeyP') actions.openCourses();
    if (e.code === 'Period') actions.warpStep(1);
    if (e.code === 'Comma') actions.warpStep(-1);
    if (e.code === 'KeyZ') S.throttle = 1;
    if (e.code === 'KeyX') S.throttle = 0;
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  const fstick = document.getElementById('fstick'), fknob = document.getElementById('fknob');
  canvas.addEventListener('pointerdown', e => {
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (e.pointerType === 'mouse') { if (e.button === 2 || IN.lookOn || S.camMode === 2) mlook = {x: e.clientX, y: e.clientY}; else md = {x: e.clientX, y: e.clientY}; return; }
    if (touches.size >= 2) return;
    const p = appXY(e); touches.set(e.pointerId, {x: p.x, y: p.y, x0: p.x, y0: p.y});
    if (touches.size === 1 && !gestureLock) {
      if (S.camMode === 2 || IN.lookOn) { oneLook = true; lastP = p; }
      else { fstick.hidden = false; fstick.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px)'; fknob.style.transform = ''; joy.x = joy.y = 0; }
    } else if (touches.size === 2) { twoG = true; gestureLock = true; oneLook = false; joy.x = joy.y = 0; fstick.hidden = true; pinch0 = spread(); ang0 = pairAngle(); }
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      if (mlook) { orbitBy(e.clientX - mlook.x, e.clientY - mlook.y); mlook = {x: e.clientX, y: e.clientY}; }
      else if (md) { mouse.x = clamp((e.clientX - md.x) / 140); mouse.y = clamp((e.clientY - md.y) / 140); }
      return;
    }
    const t = touches.get(e.pointerId); if (!t) return; const p = appXY(e); t.x = p.x; t.y = p.y;
    if (twoG && touches.size === 2) {
      const d = spread(); if (pinch0 > 0 && d > 0) zoomBy(pinch0 / d); pinch0 = d;
      if (S.camMode !== 2) { // steering-wheel twist: clockwise rolls right; ~4° dead zone, full rate at ~26°
        let da = pairAngle() - ang0; da = Math.atan2(Math.sin(da), Math.cos(da)); const a = Math.abs(da);
        rollG = a < 0.06 ? 0 : -Math.sign(da) * Math.min(1, (a - 0.06) / 0.4);
      }
    } else if (touches.size === 1 && !gestureLock && oneLook) { orbitBy(p.x - lastP.x, p.y - lastP.y); lastP = p; }
    else if (touches.size === 1 && !gestureLock) {
      let dx = t.x - t.x0, dy = t.y - t.y0; const l = Math.hypot(dx, dy);
      if (l > STEER_R) { dx *= STEER_R / l; dy *= STEER_R / l; }
      joy.x = dx / STEER_R; joy.y = dy / STEER_R; fknob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
  });
  function endPointer(e) {
    if (e.pointerType === 'mouse') { md = null; if (mlook) IN.lastLook = performance.now(); mlook = null; mouse.x = mouse.y = 0; return; }
    if (!touches.delete(e.pointerId)) return;
    if (touches.size < 2 && twoG) { twoG = false; rollG = 0; }
    if (touches.size === 0) { gestureLock = false; joy.x = joy.y = 0; fstick.hidden = true; if (oneLook) IN.lastLook = performance.now(); oneLook = false; }
  }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.001)); }, {passive: false});

  // throttle slider
  const track = document.getElementById('thrTrack'); let thrId = null;
  const setThr = e => { const r = track.getBoundingClientRect(); S.throttle = clamp(1 - (e.clientY - r.top - 19) / (r.height - 38), 0, 1); if (S.throttle < 0.03) S.throttle = 0; };
  track.addEventListener('pointerdown', e => { thrId = e.pointerId; try { track.setPointerCapture(e.pointerId); } catch (_) {} setThr(e); });
  track.addEventListener('pointermove', e => { if (e.pointerId === thrId) setThr(e); });
  const endThr = e => { if (e.pointerId === thrId) thrId = null; };
  track.addEventListener('pointerup', endThr); track.addEventListener('pointercancel', endThr);

  // hold-to-use buttons
  const holdBtn = (id, down, up) => {
    const b = document.getElementById(id);
    b.addEventListener('pointerdown', e => { down(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} });
    const end = () => { up(); b.classList.remove('on'); };
    b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('contextmenu', e => e.preventDefault());
  };
  holdBtn('boostBtn', () => { boostT = true; }, () => { boostT = false; });
  holdBtn('rollL', () => { rollT = 1; }, () => { if (rollT === 1) rollT = 0; });
  holdBtn('rollR', () => { rollT = -1; }, () => { if (rollT === -1) rollT = 0; });

  const lookBtn = document.getElementById('lookBtn');
  lookBtn.addEventListener('click', () => { IN.lookOn = !IN.lookOn; lookBtn.setAttribute('aria-pressed', IN.lookOn); if (!IN.lookOn) IN.lastLook = performance.now(); });
}

// Called once per frame while flying. Returns the control inputs for stepFlight().
export function readInput(dt) {
  let p = 0, y = 0, r = 0;
  if (keys.ArrowUp) p += 1; if (keys.ArrowDown) p -= 1;
  if (keys.KeyA || keys.ArrowLeft) y -= 1; if (keys.KeyD || keys.ArrowRight) y += 1;
  if (keys.KeyQ) r += 1; if (keys.KeyE) r -= 1;
  r += rollT + rollG;
  p += -expo(mouse.y) - expo(dz(joy.y)); y += expo(mouse.x) + expo(dz(joy.x));
  if (keys.KeyW) S.throttle = Math.min(1, S.throttle + dt * 0.5);
  if (keys.KeyS) S.throttle = Math.max(0, S.throttle - dt * 0.5);
  IN.pitch = p; IN.yaw = y; IN.roll = r;
  IN.boost = !!(keys.ShiftLeft || keys.ShiftRight || boostT); IN.retro = !!keys.Space;
  IN.looking = oneLook || !!mlook;
  return IN;
}
