// HTML overlay: flight readouts, body and motion markers, flight-computer buttons, toasts, intro card.
// UI state is read from S/O every frame (with change checks), so physics never needs to call the HUD.
import * as THREE from 'three';
import {WARPS} from './config.js';
import {fmt, $} from './util.js';
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
  $('vmPro').addEventListener('click', () => { if (S.launched) actions.toggleHold('pro'); });
  $('vmRetro').addEventListener('click', () => { if (S.launched) actions.toggleHold('retro'); });
  $('warpUp').addEventListener('click', () => actions.warpStep(1));
  $('warpDn').addEventListener('click', () => actions.warpStep(-1));
  $('launchBtn').addEventListener('click', actions.launch);
  const track = $('thrTrack');
  const showTouch = () => { $('touch').hidden = false; $('keysTouch').hidden = false; $('keysKb').hidden = true; trackH = track.clientHeight || trackH; };
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) showTouch();
  addEventListener('touchstart', showTouch, {once: true, passive: true});
  addEventListener('resize', () => { trackH = track.clientHeight || trackH; });
  document.addEventListener('gesturestart', e => e.preventDefault());
}

// Tappable body markers: tap to have the flight computer face that body.
export function initMarkers(actions) {
  const bodies = [{name: 'Veyra', key: 'planet', mesh: W.planet, radius: W.planet.geometry.parameters.radius, alt: () => O.altPlanet},
                  {name: 'Tal', key: 'moon', mesh: W.moon, radius: W.moon.geometry.parameters.radius, alt: () => O.altMoon}];
  markers = bodies.map(b => {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'marker'; el.setAttribute('aria-label', 'Turn to face ' + b.name);
    el.innerHTML = '<span class="ring"></span><span class="tag"></span>';
    el.addEventListener('click', () => { if (!S.launched) return; actions.toggleHold(b.key); if (S.hold === b.key) toast('lock', 'Turning to face ' + b.name + '.'); });
    $('markers').appendChild(el); return {b, el, tag: el.querySelector('.tag')};
  });
}

export function setStatus(text) { $('status').textContent = text; }
export function setReady() { $('status').hidden = true; $('launchBtn').hidden = false; }
export function hideIntro() { $('intro').hidden = true; $('launchBtn').blur(); }
export function showIntro(btnLabel) { $('launchBtn').textContent = btnLabel; $('intro').hidden = false; }

// ---- per-frame UI state ----
const MODES = ['Chase', 'Bridge', 'Map'];
let uiKey = '';
export function refreshUI() {
  const key = S.hold + '|' + S.warpIdx + '|' + S.camMode;
  if (key === uiKey) return; uiKey = key;
  $('holdPro').setAttribute('aria-pressed', S.hold === 'pro'); $('holdRetro').setAttribute('aria-pressed', S.hold === 'retro');
  $('vmPro').classList.toggle('lock', S.hold === 'pro'); $('vmRetro').classList.toggle('lock', S.hold === 'retro');
  for (const m of markers) m.el.classList.toggle('lock', S.hold === m.b.key);
  const w = WARPS[S.warpIdx]; $('warpVal').textContent = fmt(w) + '×'; $('wlab').classList.toggle('on', w > 1);
  $('camBtn').textContent = MODES[S.camMode]; $('readouts').hidden = S.camMode === 1; $('lookBtn').hidden = S.camMode === 2;
}

const kmTxt = m => m === Infinity ? 'Escape' : (m < 0 ? '−' : '') + fmt(Math.abs(m) / 1000);
let lastHud = '';
export function updateHud() {
  const s = fmt(O.speed), a = fmt(O.alt / 1000), v = (O.vv < -0.5 ? '−' : '+') + fmt(Math.abs(O.vv)), ap = kmTxt(O.ap), pe = kmTxt(O.pe), pc = Math.round(S.throttle * 100);
  const key = s + a + v + ap + pe + pc + O.name; if (key === lastHud) return; lastHud = key;
  $('spd').textContent = s; $('alt').textContent = a; $('altLab').textContent = 'Altitude · ' + O.name; $('vsp').textContent = v;
  $('ap').textContent = ap; $('apU').hidden = O.ap === Infinity; $('pe').textContent = pe; $('pe').classList.toggle('warn', O.pe < 0);
  $('thrPct').textContent = pc + '%'; $('thrBar').style.width = pc + '%';
  const travel = Math.max(0, trackH - 44);
  $('thrKnob').style.transform = 'translateY(' + (-S.throttle * travel) + 'px)'; $('thrFillT').style.height = (S.throttle * travel + 30) + 'px';
}

// ---- markers ----
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
  for (const m of markers) {
    m.b.mesh.getWorldPosition(pv); const dist = pv.distanceTo(cam.position); const pxR = (m.b.radius / Math.max(dist, m.b.radius + 0.01)) / half * (h / 2);
    screenOf(pv, sp1); let x = sp1.x, y = sp1.y; if (sp1.behind) { x = w - x; y = h - y; }
    const on = !sp1.behind && x >= 0 && x <= w && y >= 0 && y <= h;
    m.el.hidden = false; let edge = false;
    if (!on) { // pin to the screen edge in the body's direction
      edge = true; const cx = w / 2, cy = h / 2, pad = 44; let dx = x - cx, dy = y - cy; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) dy = 1;
      const s = Math.min((cx - pad) / Math.max(Math.abs(dx), 1e-6), (cy - pad) / Math.max(Math.abs(dy), 1e-6)); x = cx + dx * s; y = cy + dy * s;
    } else if (pxR > 10 && (pxR < 70 || S.camMode === 2)) y -= pxR + 16;
    m.el.classList.toggle('edge', edge); m.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)';
    m.tag.textContent = (S.camMode === 2 && m.b.key === 'planet') ? m.b.name : m.b.name + ' · ' + fmt(Math.max(0, m.b.alt()) / 1000) + ' km';
  }
  const vmPro = $('vmPro'), vmRetro = $('vmRetro'), shipMk = $('shipMk');
  if (S.camMode === 2) { vmPro.hidden = vmRetro.hidden = true; placeEl(shipMk, zero); }
  else {
    shipMk.hidden = true; relVel(dirV);
    if (dirV.lengthSq() < 1) { vmPro.hidden = vmRetro.hidden = true; }
    else { dirV.normalize(); placeEl(vmPro, pv.copy(cam.position).addScaledVector(dirV, 1e5)); placeEl(vmRetro, pv.copy(cam.position).addScaledVector(dirV, -1e5)); }
  }
}
