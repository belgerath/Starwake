// The game's rules: the first run (customs at Tumbledown, then selling the ashroot), then delivery jobs to Tal's
// outposts, Brannoc's upgrades and fuel, and the tug.
import {describe, it, expect, beforeEach} from 'vitest';
import {G, START, CARGO, TIP, TUG, PARTS, resetGame, talk, choose, onDock, onUndock, holdText, holdSize, goal, gameState, loadGameState, deliver, callTug, fuelCost} from '../src/game.js';
import {S} from '../src/physics.js';
import {SHIP, OUTPOSTS} from '../src/config.js';

const full = START.hold.ashroot * CARGO.ashroot.price;
const ids = c => c.options.map(o => o.id);

describe('the first run', () => {
  beforeEach(() => resetGame());

  it('starts with credits and contraband in the hold', () => {
    expect(G.credits).toBe(START.credits); expect(holdText()).toBe('8 crates of ashroot');
    expect(goal()).toMatch(/^Customs first/);
  });
  it('the trader will not deal before customs', () => {
    expect(ids(talk('trader'))).toEqual(['close']); expect(choose('trader', 'sell')).toBe(null);
    expect(G.credits).toBe(START.credits); expect(G.hold.ashroot).toBe(8);
  });
  it('every customs answer clears you; the tip costs credits and raises the trader\'s offer', () => {
    for (const id of ['none', 'parts']) { resetGame(); expect(choose('customs', id).options).toHaveLength(1); expect(G.cleared).toBe(true); expect(G.credits).toBe(START.credits); }
    resetGame(); expect(ids(talk('customs'))).toContain('tip');
    choose('customs', 'tip'); expect(G.cleared).toBe(true); expect(G.credits).toBe(START.credits - TIP);
    expect(talk('trader').options[0].label).toBe(`Sell for ${Math.round(full * 1.1).toLocaleString('en-US')} credits`);
  });
  it('selling pays and empties the hold, and the first run is done', () => {
    choose('customs', 'none'); expect(goal()).toMatch(/^Sell the ashroot/);
    choose('trader', 'sell'); expect(G.credits).toBe(START.credits + full); expect(G.hold.ashroot).toBe(0); expect(G.sold).toBe(true);
    expect(holdText()).toBe('Empty'); expect(goal()).toMatch(/^Take work from the Factor/); expect(ids(talk('trader'))).toEqual(['job0', 'job1', 'job2', 'close']);
  });
  it('haggling works once: sometimes 15% more, never less', () => {
    choose('customs', 'none'); choose('trader', 'haggle', () => 0.1);
    expect(G.offer).toBe(Math.round(full * 1.15 / 10) * 10); expect(ids(talk('trader'))).not.toContain('haggle');
    resetGame(); choose('customs', 'none'); choose('trader', 'haggle', () => 0.9); expect(G.offer).toBe(full);
    choose('trader', 'sell'); expect(G.credits).toBe(START.credits + full);
  });
  it('customs again on the next visit; the save keeps everything', () => {
    choose('customs', 'tip'); choose('trader', 'sell'); const credits = G.credits;
    const saved = JSON.parse(JSON.stringify(gameState()));
    onUndock(); expect(G.cleared).toBe(false); expect(G.tipped).toBe(false);
    resetGame(); loadGameState(saved); expect(G.credits).toBe(credits); expect(G.sold).toBe(true); expect(G.cleared).toBe(true);
    loadGameState(undefined); expect(G.credits).toBe(START.credits); // an older save without a game: a fresh start
    loadGameState({credits: 120, hold: {glowmoss: 8}, cleared: false}); expect(holdText()).toBe('8 crates of ashroot'); // the cargo's old name
  });
});

describe('work, the shipwright and the tug', () => {
  beforeEach(() => { resetGame(); S.fuel = SHIP.tank; choose('customs', 'none'); choose('trader', 'sell'); });
  const job = () => { talk('trader'); return G.jobs.find(j => j.crates <= holdSize()); };

  it('the Factor offers three deliveries a visit; taking one loads the hold', () => {
    const offer = talk('trader').options; expect(offer).toHaveLength(4);
    const j = job(), credits = G.credits; choose('trader', j.id);
    expect(G.job.to).toBe(j.to); expect(G.hold[j.cargo]).toBe(j.crates); expect(G.credits).toBe(credits);
    expect(goal()).toMatch(new RegExp('^Deliver .* to ' + OUTPOSTS[j.to].name));
    expect(ids(talk('trader'))).toEqual(['close']); // one job at a time
    onUndock(); onDock(); expect(G.jobs).toBe(null); expect(G.job.to).toBe(j.to); // the work on offer changes; the job stays
  });
  it('a job too big for the hold cannot be taken', () => {
    G.hold = {filters: holdSize() - 2}; const offer = talk('trader').options; // two crates of space left
    const big = G.jobs.find(j => j.crates > 2); expect(big).toBeTruthy(); expect(offer.find(x => x.id === big.id).off).toBe(true);
    expect(choose('trader', big.id)).toBe(null); expect(G.job).toBe(null);
  });
  it('landing at the right outpost pays; anywhere else does not', () => {
    const j = job(); choose('trader', j.id); const credits = G.credits, other = Object.keys(OUTPOSTS).find(k => k !== j.to);
    expect(deliver(j.to, 5000)).toBe(null); // too far from it
    expect(deliver(other, 100).paid).toBe(0); expect(G.job).not.toBe(null);
    const r = deliver(j.to, 1200); expect(r.paid).toBe(j.pay); expect(r.title).toBe(OUTPOSTS[j.to].name);
    expect(G.credits).toBe(credits + j.pay); expect(G.job).toBe(null); expect(G.hold[j.cargo]).toBeUndefined();
  });
  it('Brannoc fits upgrades that change how the ship flies, if you can pay', () => {
    G.credits = 1000; expect(talk('wright').options.find(o => o.id === 'up-engine').off).toBe(true);
    expect(choose('wright', 'up-engine').quote).toBe('Come back richer.'); expect(SHIP.aMain).toBe(PARTS.engine.levels[0].v);
    G.credits = 5000; choose('wright', 'up-engine'); expect(G.credits).toBe(5000 - PARTS.engine.levels[1].price);
    expect(SHIP.aMain).toBe(5.5); expect(SHIP.aBoost).toBe(11);
    const tank = SHIP.tank; choose('wright', 'up-tanks'); expect(SHIP.tank).toBeGreaterThan(tank); expect(S.fuel).toBe(SHIP.tank); // new space comes full
    choose('wright', 'up-hold'); expect(holdSize()).toBe(12);
    const saved = gameState(); resetGame(); expect(SHIP.aMain).toBe(PARTS.engine.levels[0].v);
    loadGameState(saved); expect(SHIP.aMain).toBe(5.5); expect(holdSize()).toBe(12); // the save keeps what was fitted
  });
  it('fuel costs 2 credits per 100 m/s', () => {
    S.fuel = SHIP.tank - 5000; expect(fuelCost()).toBe(100);
    const credits = G.credits; choose('wright', 'fuel'); expect(S.fuel).toBe(SHIP.tank); expect(G.credits).toBe(credits - 100);
    G.credits = 10; S.fuel = 0; expect(choose('wright', 'fuel').quote).toBe('Credits first. Then fuel.'); expect(S.fuel).toBe(0);
  });
  it('a tug brings you in, even on credit, with a quarter of a tank', () => {
    G.credits = 100; S.fuel = 0; callTug();
    expect(G.credits).toBe(100 - TUG); expect(S.fuel).toBe(SHIP.tank / 4); expect(S.dock.phase).toBe('docked');
    expect(goal()).toMatch(/^You owe 200 credits/);
  });
});
