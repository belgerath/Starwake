// Saving the game in the browser: one slot holding physics' snapshot() (the whole flight, Tumbledown and the
// Halberd included) and the game state (money, hold, the first run). Written on docking, on leaving the
// hangar, every minute of flight and when the page is hidden; read once at start. Storage can be missing,
// full or blocked (private windows), so every call may quietly do nothing.
import {S, snapshot, restore} from './physics.js';
import {gameState, loadGameState, resetGame} from './game.js';

const KEY = 'starwake.save';

export function saveGame() {
  if (S.crash) return;
  try { localStorage.setItem(KEY, JSON.stringify({...snapshot(), game: gameState()})); } catch (_) {}
}
// Restores the saved game, if there is one that this version can read. Returns whether it did.
export function loadGame() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
  if (!s || s.v !== 1) return false;
  try { restore(s); loadGameState(s.game); return true; } catch (_) { resetGame(); return false; }
}
export function clearSave() { resetGame(); try { localStorage.removeItem(KEY); } catch (_) {} }
