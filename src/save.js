// Saving the game in the browser: one slot holding physics' snapshot() (the whole flight, Tumbledown and the
// Halberd included). Written on docking, every minute of flight and when the page is hidden; read once at
// start. Storage can be missing, full or blocked (private windows), so every call may quietly do nothing.
import {S, snapshot, restore} from './physics.js';

const KEY = 'starwake.save';

export function saveGame() {
  if (S.crash) return;
  try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (_) {}
}
// Restores the saved game, if there is one that this version can read. Returns whether it did.
export function loadGame() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
  if (!s || s.v !== 1) return false;
  try { restore(s); return true; } catch (_) { return false; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch (_) {} }
