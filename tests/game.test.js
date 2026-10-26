// The first run's rules: customs at Tumbledown, then selling the glowmoss.
import {describe, it, expect, beforeEach} from 'vitest';
import {G, START, CARGO, TIP, resetGame, talk, choose, onUndock, holdText, goal, gameState, loadGameState} from '../src/game.js';

const full = START.hold.glowmoss * CARGO.glowmoss.price;
const ids = c => c.options.map(o => o.id);

describe('the first run', () => {
  beforeEach(() => resetGame());

  it('starts with credits and contraband in the hold', () => {
    expect(G.credits).toBe(START.credits); expect(holdText()).toBe('8 crates of glowmoss');
    expect(goal()).toMatch(/^Clear customs/);
  });
  it('the trader will not deal before customs', () => {
    expect(ids(talk('trader'))).toEqual(['close']); expect(choose('trader', 'sell')).toBe(null);
    expect(G.credits).toBe(START.credits); expect(G.hold.glowmoss).toBe(8);
  });
  it('every customs answer clears you; the tip costs credits and raises the trader\'s offer', () => {
    for (const id of ['none', 'parts']) { resetGame(); expect(choose('customs', id).options).toHaveLength(1); expect(G.cleared).toBe(true); expect(G.credits).toBe(START.credits); }
    resetGame(); expect(ids(talk('customs'))).toContain('tip');
    choose('customs', 'tip'); expect(G.cleared).toBe(true); expect(G.credits).toBe(START.credits - TIP);
    expect(talk('trader').options[0].label).toBe(`Sell for ${Math.round(full * 1.1).toLocaleString('en-US')} credits`);
  });
  it('selling pays and empties the hold, and the first run is done', () => {
    choose('customs', 'none'); expect(goal()).toMatch(/^Sell the glowmoss/);
    choose('trader', 'sell'); expect(G.credits).toBe(START.credits + full); expect(G.hold.glowmoss).toBe(0); expect(G.sold).toBe(true);
    expect(holdText()).toBe('Empty'); expect(goal()).toMatch(/^First run done/); expect(ids(talk('trader'))).toEqual(['close']);
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
  });
});
