// mirrors the aurora shader (aurora() in js/shaders/aurora/fragment.wgsl), keep these in sync with it:
// its fixed ray origin `ro`...
export const AURORA_RAY_ORIGIN = { x: 0, y: 0, z: -6.7 };
// ...and the layer height the pointer is mapped to: 0.8 + pow(i, 1.4) * 0.002 at i = 10,
// around where the loop's sample weights are highest
export const AURORA_LAYER_HEIGHT = 0.85;

// pointer interaction, all tweakable with lil-gui in debug mode
// reach of the magnet, in the aurora's noise coordinates (the visible sky spans a few units),
// at a medium height in the sky; scaled with the pointer's distance, see POINTER_PERSPECTIVE
export const POINTER_RADIUS = 0.3;
// how much the effect still shrinks toward the horizon and grows overhead:
// 0 = same size on screen everywhere, 1 = full perspective (about 6x difference)
export const POINTER_PERSPECTIVE = 0.5;
// extra brightness toward the center: 2 means up to 3x as bright
export const POINTER_BOOST = 0;
// magnet strength: 0 = no pull, 3 squeezes the whole radius hard into the cursor
export const POINTER_PULL = 4.9;
// how much the bright core adds to the aurora's density (the noise itself peaks around 0.55)
export const POINTER_CORE = 0;
// size of the bright core, in the same units as the radius
export const POINTER_CORE_SIZE = 0.01;
// how much new aurora appears around the cursor (on top of what the magnet pulls in)
export const POINTER_CREATE = 0.75;
// brightness of the trail behind the cursor
export const POINTER_TRAIL = 1.32;
// seconds a point of the trail lasts: longer = longer trail behind a moving cursor
export const POINTER_TRAIL_LIFETIME = 1.4;
// maximum number of recorded path points (the shader checks every segment, so keep it modest);
// when a long drawing fills them up, the path is thinned out instead of cut short
export const POINTER_TRAIL_POINTS = 64;
// a new path point is recorded each time the glow has moved this far (noise units, at medium height)
export const POINTER_TRAIL_SPACING = 0.03;
// how quickly the glow catches up with the pointer (per second, higher = less trailing)
export const POINTER_FOLLOW_SPEED = 15;
// seconds to fade the glow in on press and out on release
export const POINTER_FADE_TIME = 1.8;
