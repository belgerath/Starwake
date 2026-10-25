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
export const BRAKE_CLEAR = 150;          // the braking cue aims to stop the ship with its stern this high above the ground

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

// Ship: DD-07 Halberd, ~400 m
export const SHIP_SCALE = 28;      // model "ship units" to metres
export const SHIP_MASS = 6e7;
export const CDA = 2400;           // drag coefficient × frontal area
export const A_MAIN = 25;          // main engine at 100% throttle
export const A_BOOST = 50;         // boost (overdrive)
export const A_RETRO = 6;          // forward-facing retro thrusters
// Rotation: [pitch, yaw, roll]. RATE is max turn rate (rad/s), ACC is how fast thrusters start and stop a turn (rad/s²).
// Tuned with Craig: heavy top speed, crisp stop (~1.7° overshoot). Change with care.
export const RATE = [0.14, 0.14, 0.17];
export const ACC = [0.33, 0.33, 0.4];
export const WARPS = [1, 10, 100, 1000];

// Landing on Tal: tail-down, on four legs at the stern.
export const LEG_ALT = 3000;       // the legs come down below this height above the ground (and go up again 15% higher)
export const LEG_TIME = 4;         // seconds to deploy or stow them
export const FINE_MAX = 0.18;      // with the legs down the thrust slider covers 0 to 18% (3× Tal's gravity); Boost is still full
// Touchdown limits: safe under LAND_DOWN m/s down, LAND_SIDE m/s sideways, LAND_TILT° from upright, on ground
// sloping less than LAND_SLOPE°. LAND_DOWN to LAND_HARD m/s down is a hard landing (a warning). Anything else crashes.
export const LAND_DOWN = 3, LAND_HARD = 6, LAND_SIDE = 1.5, LAND_TILT = 8, LAND_SLOPE = 12;
export const CHECKPOINT_ALT = 15e3; // "Try again" restarts here on the way down (or from the last landing)
// Legs and contact points in ship units (×SHIP_SCALE = metres; the nose points along −z, the deck along +y).
// Each leg hinges at the engine block and folds forward along the hull; deployed, its foot pad stands past the
// engine bells. LEG_FEET are the bottoms of the pads, deployed: the points the ship stands on.
export const LEG_HINGES = [[1.6, -1.0, 4.9], [-1.6, -1.0, 4.9], [1.8, 0.55, 4.9], [-1.8, 0.55, 4.9]];
export const LEG_FEET = [[2.5, -2.6, 8.35], [-2.5, -2.6, 8.35], [2.5, 2.4, 8.35], [-2.5, 2.4, 8.35]];
// Points around the hull: any of them touching the ground is a crash.
export const HULL_PTS = [
  [0, -0.3, -7.2], [1.0, -0.3, -4.2], [-1.0, -0.3, -4.2],                                       // bow
  [1.9, -0.3, -1.0], [-1.9, -0.3, -1.0], [2.1, -0.3, 2.5], [-2.1, -0.3, 2.5], [1.9, -0.3, 5.2], [-1.9, -0.3, 5.2], // flanks
  [0, -1.5, -4.0], [0, -1.5, 0], [0, -1.5, 4.0],                                                // keel
  [0, 0.9, -4.5], [0, 3.0, 1.5], [0, 4.0, 1.75],                                                 // deck, bridge, mast
  [1.6, -0.95, 6.3], [-1.6, -0.95, 6.3], [1.6, 0.55, 6.3], [-1.6, 0.55, 6.3],                    // engine block
  [0, -0.25, 7.1], [1.05, -0.25, 7.1], [-1.05, -0.25, 7.1],                                      // engine bells
];

// Direction to the sun (fixed; Veyra's year is long compared with a play session)
export const SUN_DIR = [0.65, 0.32, 1]; // normalised where it is used (engine.js sunDir)

// Rendering
export const SUN_I = 3.0;
export const UVS = 2.4;            // hull panel texture repeat
export const BRIDGE_PITCH = -0.14;
export const RADAR_RANGE = 6e7;
export const CHASE = [0, 4.8, 21.8]; // chase camera offset in ship units
export const NPRED = 2400;         // predicted-orbit points in map view
export const ROCK_MAX = 900, ROCK_CELL = 3000, ROCK_VIS = 18000;
export const MONO = '"IBM Plex Mono",ui-monospace,Menlo,monospace';
