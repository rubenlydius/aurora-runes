// night lighting, all tweakable with lil-gui in debug mode
// colors are hex (sRGB), three converts them to linear when they're set

// teal-green aurora glow: colors the key light, later also tints the snow and the ship
export const AURORA_COLOR = 0x5ee8b5;

// key light: the aurora, high and mostly overhead, slightly ahead and to the left, so it catches the tops
// and the visible side of the ship (a light fully behind it left the visible side black)
export const KEY_LIGHT_POSITION = { x: -20, y: 40, z: -30 };
export const KEY_LIGHT_INTENSITY = 2.5;
// slow, subtle pulse: intensity swings by this fraction...
export const KEY_LIGHT_PULSE_AMOUNT = 0.1;
// ...at this speed (radians per second, 0.5 is one swing about every 12.5 s)
export const KEY_LIGHT_PULSE_SPEED = 0.5;

// fill light: deep blue-teal from above, almost nothing from below
export const HEMI_SKY_COLOR = 0x2a4a5c;
export const HEMI_GROUND_COLOR = 0x0a0d12;
export const HEMI_INTENSITY = 0.8;

// AgX tone mapping on the lit materials only (sky and water stay untouched)
export const TONE_MAPPING_EXPOSURE = 1.3;

// exponential fog, matched to the sky's horizon color so the far water blends into it
export const FOG_COLOR = 0x070e1d;
export const FOG_DENSITY = 0.006;
