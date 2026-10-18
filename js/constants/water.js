// height of the fjord surface, the camera sits at y = 0
export const WATER_LEVEL = -2;
// width and depth of the water plane
export const WATER_SIZE = 1000;
// near-black blue, in display (sRGB) values like the rest of the shader output
export const WATER_BASE_COLOR = [0.005, 0.01, 0.02];

// how far the ripples tilt the surface: small keeps the water calm
export const RIPPLE_STRENGTH = 0.045;
// ripples per world unit: higher means smaller ripples
export const RIPPLE_SCALE = 0.3;
// how fast the ripple layers drift
export const RIPPLE_SPEED = 0.4;
// distance (world units) over which the ripples calm down, prevents flicker near the horizon
export const RIPPLE_FADE_DISTANCE = 100;

// swell: real waves that lift the water surface (vertex shader) and the ship, tweakable in debug mode.
// height is 0 at rest (calm, flat water); the Laguz effect raises it
export const WAVE_HEIGHT = 0;
// direction the waves travel, in degrees in the xz plane (0 = +x, 90 = +z); 40 hits the ship mostly side-on
export const WAVE_DIRECTION = 40;
// length of the longest wave (world units), speed multiplier on deep-water speed, crest sharpness (1 = sine)
export const WAVE_LENGTH = 14;
export const WAVE_SPEED = 1;
export const WAVE_SHARPNESS = 1.6;
// distance (world units) over which the waves die down, far water stays flat
export const WAVE_FADE_DISTANCE = 80;
// grid segments of the water plane per side; vertices are packed toward the center (the camera),
// about 0.7 units apart at the ship, coarser far away where the waves have faded
export const WATER_SEGMENTS = 384;
