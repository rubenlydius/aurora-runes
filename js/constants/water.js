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
