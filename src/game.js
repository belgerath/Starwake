// The game around the flight: money, the hold, customs and the Factor at Tumbledown (the first run's sale,
// then delivery jobs to Tal's outposts), Brannoc the shipwright (upgrades and fuel), and a tug when the tanks
// run dry. No DOM: the hangar shows these cards, save.js keeps G, tests check the rules.
// A card is {who, role, text, quote, options: [{id, label, main, off}]}; choose() applies an option and returns
// the next card, or null when the talk is over. off: shown, but not possible now.
import {SHIP, OUTPOSTS, OUTPOST_RANGE} from './config.js';
import {S, towIn} from './physics.js';

export const CARGO = {
  ashroot: {name: 'ashroot', price: 150}, // the first run's contraband, sold to the Factor
  filters: {name: 'air filters'}, drills: {name: 'drill heads'}, water: {name: 'water casks'}, sealed: {name: 'sealed crates'},
};
export const START = {credits: 120, hold: {ashroot: 8}};
export const TIP = 20, TIP_BONUS = 0.1, HAGGLE_BONUS = 0.15, HAGGLE_ODDS = 0.6;
export const FUEL_PRICE = 2;  // credits per 100 m/s of fuel
export const TUG = 300;       // credits for a tow into bay 3 (it may leave you owing), with a quarter tank
export const PEOPLE = {
  customs: {who: 'Proctor Vey', role: 'Customs'},
  trader: {who: 'The Factor', role: 'Broker'},
  wright: {who: 'Brannoc', role: 'Shipwright'},
};
// What Brannoc fits: each part has levels, the first what the Mudlark starts with (from TRANSPORT in config.js).
// v is the part's value at that level (applyShip sets the ship's numbers from it).
export const PARTS = {
  engine: {name: 'Engine', unit: 'm/s²', levels: [{v: SHIP.aMain}, {v: 5.5, price: 1200}, {v: 7.5, price: 2800}]},
  lift: {name: 'Lift', unit: 'm/s²', levels: [{v: SHIP.aLift}, {v: 5, price: 600}, {v: 6.5, price: 1500}]},
  turn: {name: 'Turning', unit: '×', levels: [{v: 1}, {v: 1.3, price: 500}, {v: 1.6, price: 1200}]},
  hold: {name: 'Hold', unit: 'crates', levels: [{v: 8}, {v: 12, price: 700}, {v: 16, price: 1600}]},
  tanks: {name: 'Tanks', unit: 'km/s', levels: [{v: SHIP.tank / 1000}, {v: 26, price: 500}, {v: 34, price: 1200}]},
};
const BASE = {rate: [...SHIP.rate], acc: [...SHIP.acc]};
// The ship's numbers from the parts fitted. Physics reads SHIP as it flies, so this is all an upgrade needs.
export function applyShip() {
  const v = k => PARTS[k].levels[G.parts[k]].v;
  SHIP.aMain = v('engine'); SHIP.aBoost = 2 * SHIP.aMain; SHIP.aLift = v('lift');
  SHIP.rate = BASE.rate.map(r => r * v('turn')); SHIP.acc = BASE.acc.map(a => a * v('turn'));
  SHIP.tank = v('tanks') * 1000;
}

// For the whole game: credits (below 0 when you owe), hold (crates by cargo), parts (levels fitted), sold (the
// first run is done), job (the delivery under way, or null), visits (dockings so far; the work on offer
// follows from it). For one visit (reset on undocking): cleared, tipped, haggled, offer, jobs (on offer now).
export const G = {};
export function resetGame() {
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, {credits: START.credits, hold: {...START.hold}, parts: {engine: 0, lift: 0, turn: 0, hold: 0, tanks: 0}, sold: false, job: null, visits: 0,
    cleared: false, tipped: false, haggled: false, offer: 0, jobs: null});
  applyShip();
}
resetGame();
export function gameState() { return JSON.parse(JSON.stringify(G)); }
export function loadGameState(s) {
  resetGame(); if (!s || typeof s !== 'object') return;
  const parts = {...G.parts, ...(s.parts || {})};
  Object.assign(G, JSON.parse(JSON.stringify(s)), {parts});
  if (G.hold.glowmoss) { G.hold.ashroot = (G.hold.ashroot || 0) + G.hold.glowmoss; delete G.hold.glowmoss; } // the cargo's old name
  applyShip();
}
export function onDock() { G.visits++; }
export function onUndock() { G.cleared = G.tipped = G.haggled = false; G.offer = 0; G.jobs = null; }

const crateTxt = n => n + ' crate' + (n === 1 ? '' : 's');
const used = () => Object.values(G.hold).reduce((a, b) => a + b, 0);
export const holdSize = () => PARTS.hold.levels[G.parts.hold].v;
export function holdText() {
  const parts = Object.entries(G.hold).filter(([, n]) => n > 0).map(([k, n]) => crateTxt(n) + ' of ' + CARGO[k].name);
  return parts.length ? parts.join(', ') : 'Empty';
}
const cr = v => v.toLocaleString('en-US');
const jobText = j => `${crateTxt(j.crates)} of ${CARGO[j.cargo].name} to ${OUTPOSTS[j.to].name}`;
// What to do next, for the line under the hangar's title.
export function goal() {
  if (!G.cleared) return 'Customs first: ' + PEOPLE.customs.who + ' is coming to you.';
  if (G.hold.ashroot) return 'Sell the ' + CARGO.ashroot.name + ' to the Factor in the lower market.';
  if (G.job) return `Deliver ${jobText(G.job)} on Tal, landing within 3 km of it. The flight computer can fly you there.`;
  if (G.credits < 0) return `You owe ${cr(-G.credits)} credits. Take work from the Factor.`;
  return 'Take work from the Factor, or see Brannoc about the ship.';
}

const round10 = v => Math.round(v / 10) * 10;
function baseOffer() { return round10((G.hold.ashroot || 0) * CARGO.ashroot.price * (G.tipped ? 1 + TIP_BONUS : 1)); }
const card = (key, text, quote, options) => ({...PEOPLE[key], text, quote, options});
const close = [{id: 'close', label: 'Close', main: true}];

// The Factor's work this visit: three deliveries, from a seed that changes with each docking.
function rng(s) { return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
export function jobsOnOffer() {
  if (G.jobs) return G.jobs;
  const r = rng(G.visits * 7919 + 17), ids = Object.keys(OUTPOSTS), kinds = ['filters', 'drills', 'water', 'sealed'], out = [];
  for (let i = 0; i < 3; i++) {
    const to = ids[Math.floor(r() * ids.length)], cargo = kinds[Math.floor(r() * kinds.length)], crates = 3 + Math.floor(r() * 6);
    out.push({id: 'job' + i, to, cargo, crates, pay: round10(300 + crates * (cargo === 'sealed' ? 110 : 70) * (0.9 + r() * 0.3))});
  }
  return (G.jobs = out);
}
export const fuelCost = () => Math.ceil(Math.max(0, SHIP.tank - S.fuel) / 100 * FUEL_PRICE);

export function talk(key) {
  if (key === 'customs') {
    if (G.cleared) return card(key, 'The Proctor has gone back to the checkpoint and does not look up.', 'You have passed. Do not make me regret it.', close);
    const opts = [{id: 'none', label: 'Nothing to declare', main: true}, {id: 'parts', label: 'Machine parts'}];
    if (G.credits >= TIP) opts.push({id: 'tip', label: `Pay the berth tithe, ${TIP} credits`});
    return card(key, 'The Proctor comes down from the checkpoint. A mask hides everything but the eyes.', 'Vessel Mudlark. State your cargo.', opts);
  }
  if (key === 'wright') {
    const opts = [], cost = fuelCost();
    if (cost > 0) opts.push({id: 'fuel', label: `Fill the tanks · ${cr(cost)}`, main: true, off: cost > G.credits});
    for (const [k, p] of Object.entries(PARTS)) {
      const next = p.levels[G.parts[k] + 1];
      if (next) opts.push({id: 'up-' + k, label: `${p.name} ${next.v}${p.unit === '×' ? '×' : ' ' + p.unit} · ${cr(next.price)}`, off: next.price > G.credits});
    }
    opts.push({id: 'close', label: 'Not now', main: !opts.length});
    const quote = opts.length > 1 ? 'She flies. Barely. What do you want?' : 'Nothing left to fit. She is as good as I can make her.';
    return card(key, `Brannoc wipes scarred hands on a rag. Fuel ${Math.round(100 * S.fuel / SHIP.tank)}%.`, quote, opts);
  }
  // The Factor.
  if (!G.cleared) return card(key, 'The Factor sits in an alcove between the containers, behind a single lamp.', 'No seal. Come back when the Proctor has seen you.', close);
  if (G.hold.ashroot) {
    if (!G.offer) G.offer = baseOffer();
    const opts = [{id: 'sell', label: `Sell for ${cr(G.offer)} credits`, main: true}];
    if (!G.haggled) opts.push({id: 'haggle', label: 'Ask for more'});
    opts.push({id: 'close', label: 'Not yet'});
    const vey = G.tipped ? 'Vey sent you. ' : '';
    return card(key, `The Factor waits while you list the hold: ${holdText()}.`, `${vey}Ashroot. ${cr(G.offer)} for the lot, and we never met.`, opts);
  }
  if (G.job) return card(key, 'The Factor does not look up.', `${OUTPOSTS[G.job.to].name} is waiting for its ${CARGO[G.job.cargo].name}. So am I.`, close);
  const free = holdSize() - used();
  const opts = jobsOnOffer().map(j => ({id: j.id, label: `${OUTPOSTS[j.to].name} · ${j.crates} ${CARGO[j.cargo].name} · ${cr(j.pay)}`, off: j.crates > free}));
  opts.push({id: 'close', label: 'Not now'});
  return card(key, 'The Factor slides a list across the table.', 'Paid on delivery. Lose the cargo and you owe me.', opts);
}

// rand is for tests; the game passes Math.random.
export function choose(key, id, rand = Math.random) {
  if (id === 'close') return null;
  if (key === 'customs' && !G.cleared) {
    G.cleared = true;
    if (id === 'tip' && G.credits >= TIP) { G.credits -= TIP; G.tipped = true; G.offer = 0; return card(key, 'The tithe is taken. The Proctor leans closer.', 'The Factor, in the lower market. Say I sent you. The price will be fair.', close); }
    if (id === 'parts') return card(key, 'The Proctor looks at the hold for a long moment, then presses the seal to your manifest.', `Machine parts. ${crateTxt(used())} of them. Pass.`, close);
    return card(key, 'A seal is pressed to your manifest without a glance at the hold.', 'Nothing. Of course. Pass.', close);
  }
  if (key === 'wright') {
    if (id === 'fuel') {
      const cost = fuelCost(); if (cost > G.credits) return card(key, 'Brannoc shakes his head.', 'Credits first. Then fuel.', close);
      G.credits -= cost; S.fuel = SHIP.tank; return {...talk(key), text: 'The lines go in. The tanks fill with a long, low groan.'};
    }
    const k = id.startsWith('up-') && id.slice(3), p = k && PARTS[k], next = p && p.levels[G.parts[k] + 1];
    if (!next) return null;
    if (next.price > G.credits) return card(key, 'Brannoc looks at your credit chit and laughs once.', 'Come back richer.', close);
    const before = SHIP.tank; G.credits -= next.price; G.parts[k]++; applyShip(); if (k === 'tanks') S.fuel += SHIP.tank - before; // the new tank space comes full
    return {...talk(key), text: `Two days of noise and welding. ${p.name}: ${next.v} ${p.unit}.`};
  }
  if (key === 'trader' && G.cleared && G.hold.ashroot) {
    if (id === 'haggle' && !G.haggled) {
      G.haggled = true; if (!G.offer) G.offer = baseOffer();
      if (rand() < HAGGLE_ODDS) { G.offer = round10(G.offer * (1 + HAGGLE_BONUS)); return {...talk(key), text: 'A long silence.', quote: `${cr(G.offer)}. Do not ask again.`}; }
      return {...talk(key), text: 'The Factor does not move.', quote: `No. ${cr(G.offer)}.`};
    }
    if (id === 'sell') {
      const paid = G.offer || baseOffer(); G.credits += paid; G.hold.ashroot = 0; G.offer = 0; G.sold = true;
      return card(key, `The crates go down into the dark. You are ${cr(paid)} credits richer.`, 'We never met.', close);
    }
  }
  if (key === 'trader' && G.cleared && !G.hold.ashroot && !G.job) {
    const j = (G.jobs || []).find(x => x.id === id); if (!j || j.crates > holdSize() - used()) return null;
    G.job = {...j}; G.hold[j.cargo] = (G.hold[j.cargo] || 0) + j.crates; G.jobs = G.jobs.filter(x => x !== j);
    return card(key, `${crateTxt(j.crates)} of ${CARGO[j.cargo].name} go into the hold.`, `${OUTPOSTS[j.to].name}. ${cr(j.pay)} when they have them.`, close);
  }
  return null;
}

// Landed on Tal: if this is the job's outpost (within OUTPOST_RANGE), the cargo goes and the pay comes.
// Returns what to say ({title, text}), or null when there is nothing to deliver here.
export function deliver(outpost, dist) {
  const j = G.job; if (!j || !outpost) return null;
  if (dist > OUTPOST_RANGE) return null;
  if (j.to !== outpost) return {title: OUTPOSTS[outpost].name, text: `Nobody here wants your ${CARGO[j.cargo].name}. They are for ${OUTPOSTS[j.to].name}.`, paid: 0};
  G.hold[j.cargo] = Math.max(0, (G.hold[j.cargo] || 0) - j.crates); if (!G.hold[j.cargo]) delete G.hold[j.cargo];
  G.credits += j.pay; G.job = null;
  return {title: OUTPOSTS[outpost].name, text: `Hooded loaders take the ${CARGO[j.cargo].name} without a word. ${cr(j.pay)} credits.`, paid: j.pay};
}
// The tanks are dry: a Tumbledown tug hauls the ship into bay 3 for TUG credits (you may end up owing) and leaves
// a quarter of a tank.
export function callTug() { G.credits -= TUG; S.fuel = Math.max(S.fuel, 0.25 * SHIP.tank); towIn(); }
