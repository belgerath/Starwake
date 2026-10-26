// HTML overlay: flight readouts, markers (Veyra, Tal, Tumbledown, the Halberd) and motion markers,
// flight-computer buttons, toasts, the docking prompt, and the intro, docked and crash cards.
// UI state is read from S/O every frame (with change checks), so physics never needs to call the HUD.
import * as THREE from 'three';
import {WARPS, MOON_R, SHIP, STATION} from './config.js';
import {fmt, clamp, $} from './util.js';
import {app, cam} from './engine.js';
import {S, O, relVel} from './physics.js';
import {W} from './world.js';

const V3 = THREE.Vector3;
let markers = [];
let trackH = 160;

// ---- toast ----
const toastEl = $('toast'); let toastT = 0; const toastLast = {};
export function toast(key, msg) {
  const now = performance.now(); if (now - (toastLast[key] || -1e9) < 6000) return; toastLast[key] = now;
  toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 3200);
}

// ---- wiring ----
export function initHud(actions) {
  $('camBtn').addEventListener('click', () => { if (S.launched) actions.cycleCam(); });
  $('helpBtn').addEventListener('click', () => { if (S.launched) actions.togglePause(); });
  $('holdPro').addEventListener('click', () => actions.toggleHold('pro'));
  $('holdRetro').addEventListener('click', () => actions.toggleHold('retro'));
  $('hoverBtn').addEventListener('click', () => { if (S.launched) actions.toggleHover(); });
  $('vmPro').addEventListener('click', () => { if (S.launched) actions.toggleHold('pro'); });
  $('vmRetro').addEventListener('click', () => { if (S.launched) actions.toggleHold('retro'); });
  $('warpUp').addEventListener('click', () => actions.warpStep(1));
  $('warpDn').addEventListener('click', () => actions.warpStep(-1));
  $('launchBtn').addEventListener('click', actions.launch);
  $('talBtn').addEventListener('click', actions.startTal);
  $('newBtn').addEventListener('click', actions.newGame);
  $('dockYes').addEventListener('click', actions.requestDock);
  $('dockNo').addEventListener('click', actions.declineDock);
  $('undockBtn').addEventListener('click', actions.undock);
  $('retryBtn').addEventListener('click', actions.retry);
  $('orbitBtn').addEventListener('click', actions.backToOrbit);
  const track = $('thrTrack');
  const showTouch = () => { $('touch').hidden = false; $('keysTouch').hidden = false; $('keysKb').hidden = true; trackH = track.clientHeight || trackH; };
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) showTouch();
  addEventListener('touchstart', showTouch, {once: true, passive: true});
  addEventListener('resize', () => { trackH = track.clientHeight || trackH; });
  document.addEventListener('gesturestart', e => e.preventDefault());
}

// Tappable markers: tap to have the flight computer face that body or ship. tag() gives the label, or null to
// hide the marker (Tumbledown within 3,000 km and not while docked, with the speed relative to it within 100 km;
// the Halberd within 300 km).
const distTxt = m => m < 1000 ? fmt(m) + ' m' : (m < 100e3 ? (m / 1000).toFixed(1) : fmt(m / 1000)) + ' km';
export function initMarkers(actions) {
  const bodies = [{name: 'Veyra', key: 'planet', mesh: W.planet, radius: W.planet.geometry.parameters.radius, tag: () => S.camMode === 2 ? 'Veyra' : 'Veyra · ' + fmt(Math.max(0, O.altPlanet) / 1000) + ' km'},
                  {name: 'Tal', key: 'moon', mesh: W.moon, radius: MOON_R, tag: () => 'Tal · ' + fmt(Math.max(0, O.altMoon) / 1000) + ' km'},
                  {name: STATION.name, key: 'station', mesh: W.station.root, radius: STATION.ringR, tag: () => O.stDist < 3e6 && !S.dock ? STATION.name + ' · ' + distTxt(O.stDist) + (O.stDist < 100e3 ? ' · ' + fmt(O.stSpeed) + ' m/s' : '') : null},
                  {name: 'the Halberd', key: 'halberd', mesh: W.halberd.root, radius: 200, tag: () => O.hbDist < 300e3 && !S.dock ? 'Halberd · ' + distTxt(O.hbDist) : null}];
  markers = bodies.map(b => {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'marker'; el.setAttribute('aria-label', 'Turn to face ' + b.name);
    el.innerHTML = '<span class="ring"></span><span class="tag"></span>';
    el.addEventListener('click', () => { if (!S.launched) return; actions.toggleHold(b.key); if (S.hold === b.key) toast('lock', 'Turning to face ' + b.name + '.'); });
    $('markers').appendChild(el); return {b, el, tag: el.querySelector('.tag')};
  });
}

export function setStatus(text) { $('status').textContent = text; }
// Ready to fly: Continue (and New game) when there is a saved game, otherwise Launch.
export function setReady(saved) { $('status').hidden = true; $('launchBtn').textContent = saved ? 'Continue' : 'Launch'; $('launchBtn').hidden = false; $('newBtn').hidden = !saved; $('talBtn').hidden = false; }
export function hideIntro() { $('intro').hidden = true; $('newBtn').hidden = true; $('launchBtn').blur(); $('talBtn').blur(); }
export function showIntro(btnLabel) { $('launchBtn').textContent = btnLabel; $('intro').hidden = false; }
// The docking prompt, while Tumbledown is in range; the docked card, while sitting in the bay.
export function setDockAsk(on) { const el = $('dockAsk'); if (el.hidden === !on) return; el.hidden = !on; $('dockAskText').textContent = STATION.name + ' in range'; }
export function setDocked(on) { if ($('docked').hidden === !on) return; $('docked').hidden = !on; if (on) $('undockBtn').focus({preventScroll: true}); else $('undockBtn').blur(); }
// Crash card: what went wrong, Try again (from the checkpoint, when there is one) and Back to orbit.
export function showCrash(msg, canRetry) {
  $('crashMsg').textContent = msg; $('retryBtn').hidden = !canRetry; $('crash').hidden = false;
  (canRetry ? $('retryBtn') : $('orbitBtn')).focus({preventScroll: true});
}
export function hideCrash() { $('crash').hidden = true; $('retryBtn').blur(); $('orbitBtn').blur(); }

// ---- per-frame UI state ----
const MODES = ['Chase', 'Cockpit', 'Map'];
let uiKey = '';
export function refreshUI() {
  const key = S.hold + '|' + S.warpIdx + '|' + S.camMode + '|' + S.hover + '|' + O.surf;
  if (key === uiKey) return; uiKey = key;
  $('holdPro').setAttribute('aria-pressed', S.hold === 'pro'); $('holdRetro').setAttribute('aria-pressed', S.hold === 'retro');
  // Hover is offered low over Tal; while hovering the ship levels itself, so the holds are off.
  $('hoverRow').hidden = !O.surf && !S.hover; $('hoverBtn').setAttribute('aria-pressed', S.hover);
  $('holdPro').disabled = $('holdRetro').disabled = S.hover;
  $('vmPro').classList.toggle('lock', S.hold === 'pro'); $('vmRetro').classList.toggle('lock', S.hold === 'retro');
  for (const m of markers) m.el.classList.toggle('lock', S.hold === m.b.key);
  const w = WARPS[S.warpIdx]; $('warpVal').textContent = fmt(w) + '×'; $('wlab').classList.toggle('on', w > 1);
  $('camBtn').textContent = MODES[S.camMode]; $('readouts').hidden = S.camMode === 1; $('lookBtn').hidden = S.camMode === 2;
}

const kmTxt = m => m === Infinity ? 'Escape' : (m < 0 ? '−' : '') + fmt(Math.abs(m) / 1000);
const slow = v => Math.abs(v) < 10 ? Math.abs(v).toFixed(1) : fmt(Math.abs(v)); // a decimal when it matters, near the ground
// Touchdown light with the gear down: green when a touchdown now would be safe, otherwise what is wrong.
// The same light shows the docking run.
const DOCKING = {approach: 'Docking: on approach', in: 'Docking: into the bay', docked: 'Docked', out: 'Undocking'};
const READY = {legs: 'Gear coming down', hover: 'Hover to land', ok: 'Ready to land', fast: 'Descent too fast', drift: 'Drifting sideways', tilt: 'Not level', steep: 'Ground too steep'};
let lastHud = '';
// Two sets of readouts: orbital (speed, altitude, apoapsis, periapsis), and low over Tal, relative to
// the ground (ground speed, height of the ship's lowest point above the ground, horizontal speed, time
// to impact) with a braking cue, then the touchdown light once the gear is down.
export function updateHud() {
  const g = O.surf, pc = Math.round(S.throttle * 100), pos = S.throttle;
  const s = fmt(O.speed), a = g ? (O.clear < 1e4 ? fmt(Math.max(0, O.clear)) : fmt(O.clear / 1000)) : fmt(O.alt / 1000);
  const v = (O.vv < -0.05 ? '−' : '+') + (g ? slow(O.vv) : fmt(Math.abs(O.vv)));
  const ap = g ? slow(O.hs) : kmTxt(O.ap), pe = g ? (O.impact === Infinity ? 'None' : fmt(O.impact)) : kmTxt(O.pe);
  const cue = O.brake < 60 ? (O.brake <= 0 ? 'Brake now' : 'Brake in ' + Math.ceil(O.brake) + ' s') : '';
  const land = S.dock ? DOCKING[S.dock.phase] : S.landed ? 'Landed' : (g && S.legsDown && !cue && O.ready ? READY[O.ready] : '');
  const hover = S.hover ? Math.min(1, O.g / SHIP.aLift) : -1; // mark on the slider where lift balances gravity
  const key = [g, s, a, v, ap, pe, pc, pos.toFixed(3), O.name, cue, land, hover.toFixed(2), trackH].join('|'); if (key === lastHud) return; lastHud = key;
  $('spdLab').textContent = g ? 'Ground speed' : 'Speed'; $('spd').textContent = s;
  $('altLab').textContent = g ? 'Height' : 'Altitude · ' + O.name; $('alt').textContent = a; $('altU').textContent = g && O.clear < 1e4 ? 'm' : 'km';
  $('vsp').textContent = v;
  $('apLab').textContent = g ? 'Horizontal' : 'Apoapsis'; $('ap').textContent = ap; $('apU').textContent = g ? 'm/s' : 'km'; $('apU').hidden = !g && O.ap === Infinity;
  $('peLab').textContent = g ? 'Impact in' : 'Periapsis'; $('pe').textContent = pe; $('peU').textContent = g ? 's' : 'km'; $('peU').hidden = g && O.impact === Infinity;
  $('pe').classList.toggle('warn', g ? O.impact < 30 : O.pe < 0);
  $('cue').hidden = !cue; $('cue').textContent = cue; $('cue').classList.toggle('now', cue === 'Brake now');
  $('land').hidden = !land; $('land').textContent = land; $('land').classList.toggle('ok', !!S.dock || land === 'Landed' || land === READY.ok);
  // Thrust: the main engine, or the lift thrusters while hovering.
  $('thrName').textContent = S.hover ? 'Lift' : 'Throttle'; $('thrPct').textContent = pc + '%'; $('thrBar').style.width = (pos * 100) + '%';
  $('thrLab').textContent = S.hover ? 'Lift' : 'Thrust';
  const travel = Math.max(0, trackH - 44);
  $('thrKnob').style.transform = 'translateY(' + (-pos * travel) + 'px)'; $('thrFillT').style.height = (pos * travel + 30) + 'px';
  $('thrHover').hidden = hover < 0; if (hover >= 0) $('thrHover').style.transform = 'translateY(' + (-(22 + hover * travel)) + 'px)';
}

// ---- markers ----
const AVOID = ['readouts', 'cue', 'land', 'dockAsk']; // HUD boxes a marker pinned to the screen edge moves out of, left to right
const pv = new V3(), cv = new V3(), tV = new V3(), dirV = new V3(), zero = new V3(), sp1 = {x: 0, y: 0, behind: false};
function screenOf(p, out) {
  cv.copy(p).applyMatrix4(cam.matrixWorldInverse); const behind = cv.z > 0; tV.copy(p).project(cam);
  out.x = (tV.x * 0.5 + 0.5) * app.clientWidth; out.y = (-tV.y * 0.5 + 0.5) * app.clientHeight; out.behind = behind; return out;
}
function placeEl(el, p) {
  screenOf(p, sp1); const w = app.clientWidth, h = app.clientHeight;
  if (sp1.behind || sp1.x < 0 || sp1.x > w || sp1.y < 0 || sp1.y > h) { el.hidden = true; return; }
  el.hidden = false; el.style.transform = 'translate(' + sp1.x.toFixed(1) + 'px,' + sp1.y.toFixed(1) + 'px)';
}
export function updateMarkers() {
  const w = app.clientWidth, h = app.clientHeight, half = Math.tan(cam.fov * Math.PI / 360);
  const apB = app.getBoundingClientRect(), boxes = [], placed = [];
  for (const id of AVOID) { const el = $(id); if (el.hidden) continue; const b = el.getBoundingClientRect(); boxes.push({l: b.left - apB.left, r: b.right - apB.left, t: b.top - apB.top, b: b.bottom - apB.top}); }
  for (const m of markers) {
    const tag = m.b.tag(); if (tag === null) { m.el.hidden = true; continue; }
    m.b.mesh.getWorldPosition(pv); const dist = pv.distanceTo(cam.position); const pxR = (m.b.radius / Math.max(dist, m.b.radius + 0.01)) / half * (h / 2);
    screenOf(pv, sp1); let x = sp1.x, y = sp1.y; if (sp1.behind) { x = w - x; y = h - y; }
    const on = !sp1.behind && x >= 0 && x <= w && y >= 0 && y <= h;
    m.el.hidden = false; let edge = false;
    if (!on) { // pin to the screen edge in the body's direction
      edge = true; const cx = w / 2, cy = h / 2, pad = 44; let dx = x - cx, dy = y - cy; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) dy = 1;
      const s = Math.min((cx - pad) / Math.max(Math.abs(dx), 1e-6), (cy - pad) / Math.max(Math.abs(dy), 1e-6)); x = cx + dx * s; y = cy + dy * s;
      // Clear of the readouts, braking cue and touchdown light: below them on the left edge, to their right on the top edge.
      for (const b of boxes) if (x > b.l - 24 && x < b.r + 24 && y > b.t - 24 && y < b.b + 24) { if (x - pad < 1) y = b.b + 34; else x = b.r + 60; }
      // The whole label on screen (its width estimated from the monospace font), and apart from the markers
      // already placed, so labels on the same edge do not overlap.
      const half = tag.length * 3.3 + 12, side = Math.abs(y - cy) < cy - pad - 1; x = clamp(x, half, w - half);
      for (let k = 0; k < 4; k++) {
        if (!placed.some(p => Math.abs(p.x - x) < 150 && Math.abs(p.y - y) < 44)) break;
        if (side) y += y > h - 110 ? -48 : 48; else x += x > w - 200 ? -160 : 160;
      }
    } else if (pxR > 10 && (pxR < 70 || S.camMode === 2)) y -= pxR + 16;
    placed.push({x, y}); m.el.classList.toggle('edge', edge); m.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
    m.tag.textContent = tag;
  }
  const vmPro = $('vmPro'), vmRetro = $('vmRetro'), shipMk = $('shipMk');
  if (S.camMode === 2) { vmPro.hidden = vmRetro.hidden = true; placeEl(shipMk, zero); }
  else {
    shipMk.hidden = true; relVel(dirV);
    if (dirV.lengthSq() < 1) { vmPro.hidden = vmRetro.hidden = true; }
    else { dirV.normalize(); placeEl(vmPro, pv.copy(cam.position).addScaledVector(dirV, 1e5)); placeEl(vmRetro, pv.copy(cam.position).addScaledVector(dirV, -1e5)); }
  }
}
