// The game around the flight: money, the hold and the first run (customs at Tumbledown, then selling the
// contraband). No DOM: the hangar shows these cards, save.js keeps G, tests check the rules.
// A card is {who, role, text, quote, options: [{id, label, main}]}; choose() applies an option and returns
// the reply card (with a single Close), or null when the talk is over.

export const CARGO = {ashroot: {name: 'ashroot', unit: 'crate', price: 150}}; // credits per crate at Tumbledown
export const START = {credits: 120, hold: {ashroot: 8}};
export const TIP = 20, TIP_BONUS = 0.1, HAGGLE_BONUS = 0.15, HAGGLE_ODDS = 0.6;
export const PEOPLE = {
  customs: {who: 'Proctor Vey', role: 'Customs'},
  trader: {who: 'The Factor', role: 'Broker'},
};

// cleared, tipped and haggled last for one visit (reset on undocking); sold marks the first run as done.
export const G = {credits: 0, hold: {}, cleared: false, tipped: false, haggled: false, offer: 0, sold: false};
export function resetGame() { Object.assign(G, {credits: START.credits, hold: {...START.hold}, cleared: false, tipped: false, haggled: false, offer: 0, sold: false}); }
resetGame();
export function gameState() { return JSON.parse(JSON.stringify(G)); }
export function loadGameState(s) {
  resetGame(); if (!s || typeof s !== 'object') return;
  Object.assign(G, JSON.parse(JSON.stringify(s)));
  if (G.hold.glowmoss) { G.hold.ashroot = (G.hold.ashroot || 0) + G.hold.glowmoss; delete G.hold.glowmoss; } // the cargo's old name
}
export function onUndock() { G.cleared = G.tipped = G.haggled = false; G.offer = 0; }

const crates = n => n + ' ' + CARGO.ashroot.unit + (n === 1 ? '' : 's');
export function holdText() { const n = G.hold.ashroot || 0; return n ? crates(n) + ' of ' + CARGO.ashroot.name : 'Empty'; }
// What to do next, for the line under the hangar's title.
export function goal() {
  if (!G.cleared) return 'Customs first: ' + PEOPLE.customs.who + ' is coming to you.';
  if (G.hold.ashroot) return 'Sell the ' + CARGO.ashroot.name + ' to the Factor in the lower market.';
  return 'First run done. Jobs and upgrades open in the next update.';
}
const round10 = v => Math.round(v / 10) * 10;
const cr = v => v.toLocaleString('en-US');
function baseOffer() { return round10((G.hold.ashroot || 0) * CARGO.ashroot.price * (G.tipped ? 1 + TIP_BONUS : 1)); }
const card = (key, text, quote, options) => ({...PEOPLE[key], text, quote, options});
const close = [{id: 'close', label: 'Close', main: true}];

export function talk(key) {
  if (key === 'customs') {
    if (G.cleared) return card(key, 'The Proctor has gone back to the checkpoint and does not look up.', 'You have passed. Do not make me regret it.', close);
    const opts = [{id: 'none', label: 'Nothing to declare', main: true}, {id: 'parts', label: 'Machine parts'}];
    if (G.credits >= TIP) opts.push({id: 'tip', label: `Pay the berth tithe, ${TIP} credits`});
    return card(key, 'The Proctor comes down from the checkpoint. A mask hides everything but the eyes.', 'Vessel Mudlark. State your cargo.', opts);
  }
  if (!G.cleared) return card(key, 'The Factor sits in an alcove between the containers, behind a single lamp.', 'No seal. Come back when the Proctor has seen you.', close);
  if (!G.hold.ashroot) return card(key, 'The Factor does not look up.', 'You have nothing I want.', close);
  if (!G.offer) G.offer = baseOffer();
  const opts = [{id: 'sell', label: `Sell for ${cr(G.offer)} credits`, main: true}];
  if (!G.haggled) opts.push({id: 'haggle', label: 'Ask for more'});
  opts.push({id: 'close', label: 'Not yet'});
  const vey = G.tipped ? 'Vey sent you. ' : '';
  return card(key, `The Factor waits while you list the hold: ${holdText()}.`, `${vey}Ashroot. ${cr(G.offer)} for the lot, and we never met.`, opts);
}

// rand is for tests; the game passes Math.random.
export function choose(key, id, rand = Math.random) {
  if (id === 'close') return null;
  if (key === 'customs' && !G.cleared) {
    G.cleared = true;
    if (id === 'tip' && G.credits >= TIP) { G.credits -= TIP; G.tipped = true; G.offer = 0; return card(key, 'The tithe is taken. The Proctor leans closer.', 'The Factor, in the lower market. Say I sent you. The price will be fair.', close); }
    if (id === 'parts') return card(key, 'The Proctor looks at the hold for a long moment, then presses the seal to your manifest.', `Machine parts. ${crates(G.hold.ashroot || 0)} of them. Pass.`, close);
    return card(key, 'A seal is pressed to your manifest without a glance at the hold.', 'Nothing. Of course. Pass.', close);
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
  return null;
}
