// Sound, made with Web Audio from noise and a few oscillators (no files to download). Continuous beds
// follow the ship each frame: the main engine's rumble, the lift thrusters' roar, the hiss of the attitude
// and retro thrusters, the bay doors, and the hangar's murmur and machinery. One-shots for events: clunks,
// a crash, the docking chime, a customs stamp, coins, taps. Browsers only allow sound after a tap or key,
// so nothing starts before one; the on/off choice is remembered in the browser.
const KEY = 'starwake.sound';
let ctx = null, out = null, noise = null, beds = null, on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch (_) {}

export const soundOn = () => on;
export function setSound(v) {
  on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (_) {}
  if (out) out.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.05);
}
function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { ctx = new AC(); } catch (_) { return; }
  out = ctx.createGain(); out.gain.value = on ? 0.9 : 0; out.connect(ctx.destination);
  const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  noise = buf; beds = makeBeds();
}
for (const e of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(e, unlock, true);

// ---- building blocks ----
function src() { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, Math.random() * 2); return s; }
function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

function makeBeds() {
  const b = {};
  // Main engine: low filtered noise and a growling 38 Hz saw, brighter with boost.
  b.engF = filt('lowpass', 180); b.eng = chain(src(), b.engF, gain(1), gain()); b.eng.connect(out);
  b.growl = chain(osc('sawtooth', 38), filt('lowpass', 110), gain()); b.growl.connect(out);
  b.lift = chain(src(), filt('bandpass', 700, 0.6), gain()); b.lift.connect(out);
  b.hiss = chain(src(), filt('highpass', 2600), gain()); b.hiss.connect(out);
  // Bay doors grinding: low noise and a 55 Hz hum.
  b.door = chain(src(), filt('lowpass', 240), gain()); b.door.connect(out);
  b.doorHum = chain(osc('triangle', 55), gain()); b.doorHum.connect(out);
  // The hangar: a crowd's murmur (band-passed noise swelling slowly), a mains hum, a faint high chatter.
  const lfo = osc('sine', 0.17), lfoG = gain(0.35); lfo.connect(lfoG);
  b.crowd = gain(); const cg = gain(0.6); lfoG.connect(cg.gain); chain(src(), filt('bandpass', 420, 0.9), cg, b.crowd); b.crowd.connect(out);
  b.chat = chain(src(), filt('bandpass', 1500, 3), gain()); b.chat.connect(out);
  b.hum = gain(); chain(osc('sine', 60), gain(0.6), b.hum); chain(osc('sine', 120), gain(0.25), b.hum); b.hum.connect(out);
  return b;
}
const level = (g, v, tc = 0.08) => g.gain.setTargetAtTime(v, ctx.currentTime, tc);

// Each frame: main, lift and turn in 0..1, boost and retro as flags, doors moving (0..1), hangar (bool).
export function updateSound(st) {
  if (!beds || ctx.state !== 'running') return;
  const q = st.quiet ? 0 : 1;
  level(beds.eng, q * 0.55 * st.main); beds.engF.frequency.setTargetAtTime(160 + 380 * st.main + (st.boost ? 300 : 0), ctx.currentTime, 0.1);
  level(beds.growl, q * 0.35 * st.main);
  level(beds.lift, q * 0.3 * st.lift);
  level(beds.hiss, q * (0.05 * Math.min(1, st.turn) + (st.retro ? 0.09 : 0)), 0.03);
  level(beds.door, q * 0.4 * st.doors, 0.2); level(beds.doorHum, q * 0.12 * st.doors, 0.2);
  const h = st.hangar ? 1 : 0;
  level(beds.crowd, 0.22 * h, 0.5); level(beds.chat, 0.03 * h, 0.5); level(beds.hum, 0.05 * h, 0.5);
}

// ---- one-shots ----
function env(node, peak, a, d, t0 = ctx.currentTime) { const g = gain(); node.connect(g); g.connect(out); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); return g; }
function tone(type, f, peak, d, t0 = ctx.currentTime, f1 = f) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f1 !== f) o.frequency.exponentialRampToValueAtTime(f1, t0 + d); env(o, peak, 0.005, d, t0); o.start(t0); o.stop(t0 + d + 0.05); }
function burst(type, f, peak, d, t0 = ctx.currentTime, f1 = f) { const s = ctx.createBufferSource(); s.buffer = noise; const b = filt(type, f); b.frequency.setValueAtTime(f, t0); if (f1 !== f) b.frequency.exponentialRampToValueAtTime(f1, t0 + d); s.connect(b); env(b, peak, 0.005, d, t0); s.start(t0, Math.random()); s.stop(t0 + d + 0.05); }
const SHOTS = {
  click: t => tone('sine', 880, 0.08, 0.05, t),
  blip: t => { tone('sine', 520, 0.07, 0.07, t, 780); tone('sine', 780, 0.05, 0.08, t + 0.07, 1040); },
  stamp: t => { burst('lowpass', 400, 0.6, 0.12, t); tone('sine', 95, 0.45, 0.18, t, 60); },
  coins: t => { [1318, 1568, 2093, 1760, 2349].forEach((f, i) => tone('triangle', f, 0.12, 0.3, t + i * 0.07)); burst('highpass', 6000, 0.05, 0.4, t); },
  clunk: t => { tone('sine', 70, 0.6, 0.35, t, 45); burst('lowpass', 600, 0.4, 0.25, t); },
  crash: t => { burst('lowpass', 2400, 0.9, 1.6, t, 90); tone('sawtooth', 50, 0.4, 1.2, t, 25); },
  chime: t => { tone('sine', 660, 0.1, 0.35, t); tone('sine', 990, 0.09, 0.5, t + 0.16); },
  warn: t => { tone('square', 880, 0.04, 0.09, t); tone('square', 880, 0.04, 0.09, t + 0.18); },
};
export function sfx(name) { if (!ctx || ctx.state !== 'running' || !SHOTS[name]) return; SHOTS[name](ctx.currentTime + 0.01); }
