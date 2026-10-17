// midnight sun (dayAmount > 0), all tweakable with lil-gui in debug mode
// colors are hex (sRGB); the dawn colors are used as-is by the sky shader and converted for the fog

// sun direction: degrees clockwise from straight ahead (-z) seen from above, and degrees above the horizon.
export const SUN_AZIMUTH = 11;
export const SUN_ELEVATION = 14.5;
// size of the sun glow's bright core, in radians (0.07 is about 4°)
export const SUN_GLOW_SIZE = 0.07;

// dawn gradient: warm gold at the horizon (also the sun glow's and the fog's color), pale blue higher up
export const DAWN_HORIZON_COLOR = 0xffb866;
export const DAWN_ZENITH_COLOR = 0x9fc4e8;

// warm directional light from the sun direction, its intensity at dayAmount 1
export const SUN_LIGHT_COLOR = 0xffc27a;
export const SUN_LIGHT_INTENSITY = 3;
// the fill light at dayAmount 1: warmer and brighter than at night
export const DAY_HEMI_SKY_COLOR = 0xc9b48a;
export const DAY_HEMI_INTENSITY = 1.6;
