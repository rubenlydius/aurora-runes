import { AURORA_COLOR } from './lighting.js';

// rune menu (js/menu/runeMenu.js), tweakable with lil-gui in debug mode

// rock models, alternated over the 3x3 grid so each is used three times
export const MENU_ROCK_MODELS = ['models/rock1.glb', 'models/rock2.glb', 'models/rock3.glb'];
// the pebbles lie flat with the flat side up: every rock is tipped a quarter turn so that side faces the camera
export const MENU_ROCK_TIP = Math.PI / 2;
// per rock, in RUNE_GLYPHS order (row by row from the top left): spin around the flat side (radians), so the
// copies of a model don't look identical. The rune stays upright, it's projected from the camera.
// set them with the debug sliders, then paste the logged values here
export const MENU_ROCK_SPINS = [0.67, -0.88, -0.61, -0.97, 2.12, 0.16, -0.87, -2.62, 2.5];
// per rock, same order: shift from its place in the grid (world units) and scale (× the layout's scale).
// set them with the debug sliders too, "log rocks" prints all three lists
export const MENU_ROCK_OFFSETS = [
  { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  { x: -0.06, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
];
export const MENU_ROCK_SCALES = [0.86, 0.79, 0.88, 0.86, 0.8, 0.82, 0.85, 0.84, 0.79];
// per rock, same order: rune size (× MENU_RUNE_SIZE)
export const MENU_RUNE_SCALES = [1.13, 0.95, 0.89, 1.03, 1.07, 1.15, 1.15, 1.11, 1.03];
// per rock, same order: moves only the rock under its rune (world units), the rune stays in place, so the
// runes keep to the grid while you choose which part of the rock they're carved into
export const MENU_ROCK_UNDER_RUNE = [
  { x: -0.02, y: -0.01 }, { x: 0.06, y: 0 }, { x: 0, y: -0.01 },
  { x: 0.02, y: 0 }, { x: 0, y: 0 }, { x: 0.03, y: 0.03 },
  { x: 0.02, y: 0 }, { x: -0.03, y: 0 }, { x: -0.01, y: -0.03 },
];

// grid: distance between the rock centers (world units; the menu camera sees about 4.4 units high) and
// the rocks' scale (the models are about 0.4 wide); y moves the whole grid up (world units)
export const MENU_ROCK_LAYOUT = { spacingX: 1.3, spacingY: 1.23, scale: 2.7, y: 0.15 };
// slow up-and-down hover: distance from the middle (world units) and speed (cycles per second);
// every rock gets its own phase
export const MENU_HOVER = { height: 0.04, speed: 0.15 };

// carved rune: height of the decal on the rock (world units) and the color of the groove
export const MENU_RUNE_SIZE = 0.6;
export const MENU_GROOVE_COLOR = 0x15181c;

// discovered runes glow: color (AURORA_COLOR, also the --aurora-green CSS variable, see js/ui/loader.js),
// emissive intensity at the low and high point of the breathing pulse, and pulses per second
export const MENU_GLOW_COLOR = AURORA_COLOR;
export const MENU_GLOW = { min: 0.5, max: 2, speed: 0.25 };
// faint green point light in front of each discovered rock: intensity at the top of the pulse,
// distance in front of the rock and range (world units)
export const MENU_LIGHT = { intensity: 0.6, offset: 0.5, distance: 2.5 };

// menu lighting: soft fill and a cool key light from the upper left
export const MENU_AMBIENT = { color: 0x8899aa, intensity: 0.8 };
export const MENU_KEY_LIGHT = { color: 0xcfe0ff, intensity: 1.5, position: { x: -3, y: 4, z: 5 } };
// dark plane behind the rocks that dims the scene underneath (0..1)
export const MENU_DIM_OPACITY = 0.7;
export const MENU_CAMERA = { fov: 40, distance: 6 };

// hover label: distance below the rock center (world units)
export const MENU_LABEL_OFFSET = 0.4;

// localStorage key for the discovered runes and the audio settings
export const PROGRESS_STORAGE_KEY = 'aurora-runes:v1';
