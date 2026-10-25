// World and ship constants. Everything is in SI units: metres, seconds, m/s, m/s².
// The universe frame is inertial and centred on Veyra; physics never touches render coordinates.
// Plain numbers only (no three.js), so the terrain Web Worker can import this without the library.

export const TAU = Math.PI * 2;

// Veyra (home planet, roughly Earth-sized)
export const R = 6.0e6;            // radius
export const GM = 3.456e14;        // gravity parameter, gives 9.6 m/s² at the surface
export const SPIN = TAU / 72000;   // 20 h sidereal day
export const TILT = 0.41;          // axial tilt, radians
export const ATM_TOP = 150e3;      // top of the atmosphere shell
export const SCALE_H = 8500;       // atmosphere density scale height
export const FLOOR = 15e3;         // hard deck until landing exists

// Tal (moon)
export const MOON_R = 1.64e6;
export const GM_M = 4.03e12;
export const MOON_A = 4.2e7;       // orbit radius
export const MOON_INC = 0.09;      // orbit inclination to Veyra's equator
export const SOI_M = MOON_A * Math.pow(GM_M / GM, 0.4);
export const MOON_N = Math.sqrt((GM + GM_M) / Math.pow(MOON_A, 3));
// Tal's terrain. MOON_H (GPU bake) and tal.js (JS, for meshes and collision) both use these.
export const TAL_SEED = [1.9, 4.4, 6.6];
export const TAL_RELIEF = 0.02 * MOON_R; // metres per unit of baked height, the same relief the normal map shows
export const TAL_MAX_H = 0.35 * TAL_RELIEF; // no ground on Tal is further than this from MOON_R, up or down (about 11.5 km)
export const TAL_START_ALT = 30e3;       // "Start above Tal": circular orbit this high above the mean radius
export const SURFACE_ALT = 20e3;         // below this height above Tal's ground, speeds and holds are relative to the ground
export const BRAKE_CLEAR = 150;          // the braking cue aims to stop the ship's lowest point this high above the ground
export const CUE_ALT = 60e3;             // the braking cue works below this height (a weak engine brakes for minutes)

// Tal's terrain mesh: a cube-sphere quadtree of chunks, each GRID × GRID vertices. A chunk splits
// into four when its size divided by its distance from the camera exceeds SPLIT.
export const TERRAIN_GRID = 33;
export const TERRAIN_MAX_LEVEL = 15;     // chunks 79 m across, 2.5 m between vertices
export const TERRAIN_SPLIT = 1.5;
export const TERRAIN_CACHE = 400;        // chunks kept in memory, including ones not drawn right now

// Ring (equatorial)
export const RING_IN = 1.7 * R;
export const RING_OUT = 2.35 * R;
export const RING_H = 350;         // half-thickness for local rocks

export const WARPS = [1, 10, 100, 1000];

// Ships. Positions are metres in the ship's frame: the nose points along −z, the deck along +y.
const ring = (r, y, n) => Array.from({length: n}, (_, i) => [r * Math.sin(i * TAU / n), y, r * Math.cos(i * TAU / n)]);
// The player's ship: a small, battered transport, about 35 m (name to decide). A saucer hull with two cargo
// prongs at the front, a cockpit pod on the right, a wide engine at the back, lift thrusters and landing gear
// under the belly. Weak to start with; upgrades come later (docs/game-plan.md, phase 4).
export const TRANSPORT = {
  name: 'Transport', length: 35, mass: 4e5, cda: 150, // drag coefficient × frontal area (m²)
  aMain: 4, aBoost: 8, aRetro: 1,  // m/s²: main engine at full throttle (along the nose), Boost, retro thrusters (Space)
  aLift: 4,                        // m/s²: belly lift thrusters at full throttle, in hover mode
  // Rotation [pitch, yaw, roll]: rate is the top turn rate (rad/s), acc how fast thrusters start and stop a turn (rad/s²).
  rate: [0.17, 0.14, 0.24], acc: [0.45, 0.4, 0.6],
  stand: [0, 1, 0],                // lands belly-down: this axis points up when standing on the gear
  gearAlt: 1500,                   // the gear comes down below this height over Tal's ground (up again 15% higher)
  feet: [[6, -6, -6], [-6, -6, -6], [6, -6, 6], [-6, -6, 6]], // bottoms of the gear pads, deployed (diagonals 0-3 and 1-2)
  // Points around the hull: any of them touching the ground is a crash.
  hull: [...ring(12, 0.2, 8), ...ring(8, -2, 6), [0, -2.4, 0], [0, -3.55, 0.5], [0, 3.6, 0.5], [4.5, 3.6, -3],
    [3.6, 0, -21], [-3.6, 0, -21], [3.4, -1.1, -19], [-3.4, -1.1, -19], [10.6, 0.5, -14.1], [10.6, -1.0, -9]],
  // Cameras: chase offset, how far ahead it looks, how far it pulls back with Boost; landing view distance;
  // the least height above Tal's ground; the cockpit eye.
  chase: [0, 11, 50], ahead: 110, boostPull: 4, landView: 65, camClear: 10, eye: [10.6, 0.75, -11.6],
};
export const SHIP = TRANSPORT;     // the ship the player flies
// The Halberd (DD-07), the navy's 400 m destroyer (on patrol from phase 2). Its model is built in ship units
// (×scale = metres), with landing legs at the stern that fold forward along the hull.
export const HALBERD = {
  scale: 28,
  legHinges: [[1.6, -1.0, 4.9], [-1.6, -1.0, 4.9], [1.8, 0.55, 4.9], [-1.8, 0.55, 4.9]],
  legFeet: [[2.5, -2.6, 8.35], [-2.5, -2.6, 8.35], [2.5, 2.4, 8.35], [-2.5, 2.4, 8.35]],
};

// Landing on Tal, belly-down on the landing gear.
export const LEG_TIME = 3;         // seconds to lower or raise the gear
// Touchdown limits: safe under LAND_DOWN m/s down, LAND_SIDE m/s sideways, tilted under LAND_TILT°, on ground
// sloping less than LAND_SLOPE°. LAND_DOWN to LAND_HARD m/s down is a hard landing (a warning). Anything else crashes.
export const LAND_DOWN = 3, LAND_HARD = 6, LAND_SIDE = 1.5, LAND_TILT = 8, LAND_SLOPE = 12;
export const CHECKPOINT_ALT = 15e3; // "Try again" restarts here on the way down (or from the last landing)

// Direction to the sun (fixed; Veyra's year is long compared with a play session)
export const SUN_DIR = [0.65, 0.32, 1]; // normalised where it is used (engine.js sunDir)

// Rendering
export const SUN_I = 3.0;
export const UVS = 2.4;            // hull panel texture repeat
export const BRIDGE_PITCH = -0.14;
export const RADAR_RANGE = 6e7;
export const NPRED = 2400;         // predicted-orbit points in map view
export const ROCK_MAX = 900, ROCK_CELL = 3000, ROCK_VIS = 18000;
export const MONO = '"IBM Plex Mono",ui-monospace,Menlo,monospace';
