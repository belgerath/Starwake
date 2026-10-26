// The hangar's overlay and controls: where you are, credits and hold, what to do next, name tags over
// Inspector Drab and Mama Gorrit, the cards you talk through (game.js), speech bubbles from the crowd, and
// Undock. One finger (or the mouse) turns the view, two fingers or the wheel zoom, a tap talks to whoever
// is under it. Loaded on demand with hangar.js, the first time you ask to dock.
import {$, clamp} from '../util.js';
import {G, talk, choose, holdText, goal} from '../game.js';
import {H, loadHangar as build, updateHangar, renderHangar, defaultView, focus, orbit, zoom, pick, screenOf, officerCome, officerLeave, officerHome, gesture, settle} from './hangar.js';

export {build as loadHangar, settle};
let hooks = null, open = null, sayAt = null, sayT = 0, wired = false, arriveT = 0;

// hooks: {undock(), save(), pause(), sound(name)}
export function enter(h) {
  hooks = h; if (!wired) wire();
  $('hud').hidden = true; $('hangar').hidden = false; fade();
  closeCard(); sayAt = null; $('hgSay').hidden = true;
  officerHome(); defaultView(true); arriveT = G.cleared ? 0 : 1.5;
  refresh(); hooks.save();
}
export function exit() { closeCard(); $('hangar').hidden = true; $('hud').hidden = false; }
// One frame: the crowd, the camera, the picture, then the tags and bubbles that follow people.
export function frame(dt) {
  if (arriveT > 0 && (arriveT -= dt) <= 0 && !G.cleared) officerCome(() => { if (!G.cleared && !open) { focus('customs'); talkTo('customs'); } });
  updateHangar(dt); renderHangar(); place(dt);
}

function wire() {
  wired = true;
  $('hgUndock').addEventListener('click', () => { snd('click'); hooks.undock(); });
  $('hgHelp').addEventListener('click', () => hooks.pause());
  $('hgCustoms').addEventListener('click', () => { snd('click'); focus('customs'); talkTo('customs'); });
  $('hgTrader').addEventListener('click', () => { snd('click'); focus('trader'); talkTo('trader'); });
  $('hgLook').addEventListener('click', () => { snd('click'); closeCard(); defaultView(); });
  for (const k of ['customs', 'trader']) $('hgTag-' + k).addEventListener('click', () => { snd('click'); focus(k); talkTo(k); });
  // Gestures on the view.
  const el = $('hgView'), pts = new Map(); let pinch = 0, moved = 0, downT = 0;
  const spread = () => { const a = [...pts.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
  el.addEventListener('pointerdown', e => { try { el.setPointerCapture(e.pointerId); } catch (_) {} pts.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (pts.size === 1) { moved = 0; downT = performance.now(); } if (pts.size === 2) pinch = spread(); });
  el.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) { moved += Math.abs(dx) + Math.abs(dy); orbit(dx, dy); }
    else if (pts.size === 2) { moved = 99; const d = spread(); if (pinch > 0 && d > 0) zoom(pinch / d); pinch = d; }
  });
  const end = e => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size === 0 && moved < 10 && performance.now() - downT < 500) tap(e.clientX, e.clientY);
    if (pts.size < 2) pinch = 0;
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.001)); }, {passive: false});
  el.addEventListener('contextmenu', e => e.preventDefault());
}

// A tap: talk to Drab or Gorrit, hear a line from anyone else.
function tap(x, y) {
  const a = pick(x, y); if (!a) { closeCard(); return; }
  if (a.key) { snd('click'); focus(a.key); talkTo(a.key); return; }
  if (a.say) { sayAt = a; sayT = 4.5; $('hgSay').textContent = a.say; $('hgSay').hidden = false; snd('blip'); }
}

// ---- cards ----
function talkTo(key) { show(key, talk(key)); }
function show(key, c) {
  open = key; const card = $('hgCard'); card.hidden = false; $('hangar').classList.add('talking');
  $('hgRole').textContent = c.role; $('hgWho').textContent = c.who; $('hgText').textContent = c.text; $('hgQuote').textContent = c.quote;
  const box = $('hgOpts'); box.textContent = '';
  for (const o of c.options) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'launch' + (o.main ? '' : ' alt'); b.textContent = o.label;
    b.addEventListener('click', () => pickOption(key, o.id)); box.appendChild(b);
  }
  box.firstChild && box.firstChild.focus({preventScroll: true});
}
function pickOption(key, id) {
  const was = {cleared: G.cleared, credits: G.credits, sold: G.sold};
  const next = choose(key, id, Math.random);
  if (key === 'customs' && !was.cleared && G.cleared) { snd('stamp'); gesture('customs', 'yes'); hooks.save(); }
  if (key === 'trader' && G.credits > was.credits) { snd('coins'); gesture('trader', 'wave'); hooks.save(); }
  else if (id === 'haggle') { snd('click'); gesture('trader', next && /Hah!/.test(next.quote) ? 'yes' : 'no'); }
  else snd('click');
  refresh();
  if (next) show(key, next);
  else { const back = open === 'customs' && G.cleared; closeCard(); if (back) defaultView(); }
}
function closeCard() { if (open === 'customs' && G.cleared) officerLeave(); open = null; $('hgCard').hidden = true; $('hangar').classList.remove('talking'); }

function refresh() {
  $('hgCredits').textContent = G.credits.toLocaleString('en-US'); $('hgHold').textContent = holdText(); $('hgGoal').textContent = goal();
  $('hgCustoms').classList.toggle('ok', G.cleared); $('hgTrader').classList.toggle('ok', G.sold);
}
const snd = n => hooks && hooks.sound && hooks.sound(n);
function fade() { const f = $('hgFade'); f.classList.remove('out'); void f.offsetWidth; f.classList.add('out'); }

// Name tags over the two people you can talk to, and the speech bubble over whoever spoke.
const pos = {x: 0, y: 0};
function place(dt) {
  for (const k of ['customs', 'trader']) {
    const a = H.people[k], el = $('hgTag-' + k), p = a && screenOf(a, pos);
    const show = !!p && p.x > -40 && p.x < innerWidth + 40 && p.y > 0 && p.y < innerHeight; el.hidden = !show; if (!show) continue;
    el.style.transform = `translate(${p.x.toFixed(0)}px,${p.y.toFixed(0)}px) translate(-50%,-100%)`;
  }
  if (sayAt) {
    sayT -= dt; const p = screenOf(sayAt, pos), el = $('hgSay');
    if (sayT <= 0 || !p) { sayAt = null; el.hidden = true; return; }
    const w = el.offsetWidth, x = clamp(p.x, w / 2 + 8, innerWidth - w / 2 - 8);
    el.style.transform = `translate(${x.toFixed(0)}px,${p.y.toFixed(0)}px) translate(-50%,-100%)`;
  }
}
