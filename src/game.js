// The game around the flight: money, the hold and the first run (customs at Tumbledown, then selling the
// contraband). No DOM: the hangar shows these cards, save.js keeps G, tests check the rules.
// A card is {who, role, text, quote, options: [{id, label, main}]}; choose() applies an option and returns
// the reply card (with a single Close), or null when the talk is over.

export const CARGO = {glowmoss: {name: 'glowmoss', unit: 'crate', price: 150}}; // credits per crate at Tumbledown
export const START = {credits: 120, hold: {glowmoss: 8}};
export const TIP = 20, TIP_BONUS = 0.1, HAGGLE_BONUS = 0.15, HAGGLE_ODDS = 0.6;
export const PEOPLE = {
  customs: {who: 'Inspector Drab', role: 'Customs'},
  trader: {who: 'Mama Gorrit', role: 'Trader'},
};

// cleared, tipped and haggled last for one visit (reset on undocking); sold marks the first run as done.
export const G = {credits: 0, hold: {}, cleared: false, tipped: false, haggled: false, offer: 0, sold: false};
export function resetGame() { Object.assign(G, {credits: START.credits, hold: {...START.hold}, cleared: false, tipped: false, haggled: false, offer: 0, sold: false}); }
resetGame();
export function gameState() { return JSON.parse(JSON.stringify(G)); }
export function loadGameState(s) { resetGame(); if (s && typeof s === 'object') Object.assign(G, JSON.parse(JSON.stringify(s))); }
export function onUndock() { G.cleared = G.tipped = G.haggled = false; G.offer = 0; }

const crates = n => n + ' ' + CARGO.glowmoss.unit + (n === 1 ? '' : 's');
export function holdText() { const n = G.hold.glowmoss || 0; return n ? crates(n) + ' of ' + CARGO.glowmoss.name : 'Empty'; }
// What to do next, for the hint under the hangar's title.
export function goal() {
  if (!G.cleared) return 'Clear customs: ' + PEOPLE.customs.who + ' is on the way.';
  if (G.hold.glowmoss) return 'Sell the ' + CARGO.glowmoss.name + ' to ' + PEOPLE.trader.who + ' at the market.';
  return 'First run done. Jobs, upgrades and the bar open in the next update.';
}
const round10 = v => Math.round(v / 10) * 10;
function baseOffer() { return round10((G.hold.glowmoss || 0) * CARGO.glowmoss.price * (G.tipped ? 1 + TIP_BONUS : 1)); }
const card = (key, text, quote, options) => ({...PEOPLE[key], text, quote, options});
const close = [{id: 'close', label: 'Close', main: true}];

export function talk(key) {
  if (key === 'customs') {
    if (G.cleared) return card(key, 'Drab has gone back to the booth and is pretending to read a manifest.', 'You are cleared. Go on, shoo.', close);
    const opts = [{id: 'none', label: 'Nothing to declare', main: true}, {id: 'parts', label: 'Spare parts and souvenirs'}];
    if (G.credits >= TIP) opts.push({id: 'tip', label: `Slip over ${TIP} credits`});
    return card(key, 'Drab shuffles over with a scanner that may or may not be switched on.', 'Welcome to Tumbledown. Anything to declare?', opts);
  }
  if (!G.cleared) return card(key, 'Mama Gorrit runs the busiest stall on the deck.', 'Customs first, sweetie. Drab gets cranky when people skip the queue.', close);
  if (!G.hold.glowmoss) return card(key, 'Mama Gorrit is counting someone else\'s money.', 'Nothing in your hold I want. Come back with something interesting.', close);
  if (!G.offer) G.offer = baseOffer();
  const opts = [{id: 'sell', label: `Sell for ${G.offer.toLocaleString('en-US')} credits`, main: true}];
  if (!G.haggled) opts.push({id: 'haggle', label: 'Haggle'});
  opts.push({id: 'close', label: 'Not yet'});
  const hello = G.tipped ? 'Drab sent you? Then a fair price. ' : '';
  return card(key, `Mama Gorrit sniffs the air as you open the hold: ${holdText()}.`, `${hello}Glowmoss! I can smell it from here. ${G.offer.toLocaleString('en-US')} for the lot.`, opts);
}

// rand is for tests; the game passes Math.random.
export function choose(key, id, rand = Math.random) {
  if (id === 'close') return null;
  if (key === 'customs' && !G.cleared) {
    G.cleared = true;
    if (id === 'tip' && G.credits >= TIP) { G.credits -= TIP; G.tipped = true; G.offer = 0; return card(key, 'The credits vanish. So does the scanner.', 'Very civil of you. Mama Gorrit at the market pays well for souvenirs. Tell her Drab sent you.', close); }
    if (id === 'parts') return card(key, 'A long look at your hold, then a stamp.', `Souvenirs. ${crates(G.hold.glowmoss || 0)} of them. Lovely. Welcome aboard.`, close);
    return card(key, 'Drab stamps something without looking at it.', 'Course not. Nobody ever does. Welcome aboard.', close);
  }
  if (key === 'trader' && G.cleared && G.hold.glowmoss) {
    if (id === 'haggle' && !G.haggled) {
      G.haggled = true; if (!G.offer) G.offer = baseOffer();
      if (rand() < HAGGLE_ODDS) { G.offer = round10(G.offer * (1 + HAGGLE_BONUS)); return {...talk(key), text: 'Mama Gorrit laughs until her stall shakes.', quote: `Hah! You have done this before. ${G.offer.toLocaleString('en-US')}, and not a credit more.`}; }
      return {...talk(key), text: 'Mama Gorrit does not blink.', quote: `Haggle with Mama Gorrit? ${G.offer.toLocaleString('en-US')} is the price, sweetie.`};
    }
    if (id === 'sell') {
      const paid = G.offer || baseOffer(); G.credits += paid; G.hold.glowmoss = 0; G.offer = 0; G.sold = true;
      return card(key, `Her crew hauls the crates away. You are ${paid.toLocaleString('en-US')} credits richer.`, 'Pleasure doing business. Come back when you have more.', close);
    }
  }
  return null;
}
