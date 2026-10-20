// adaptive resolution (js/utils/adaptiveResolution.js): the aurora's cost grows with the number of pixels, so when
// frames get slow the canvas renders at fewer pixels per CSS pixel, and climbs back up once there's room again.
// the steps it can take, from full (1 pixel per CSS pixel, as before) down to the lowest; the aurora is soft, so
// the lower steps are hard to see
export const ADAPTIVE_PIXEL_RATIOS = [1, 0.85, 0.7, 0.6];
// seconds the average frame time is smoothed over
export const ADAPTIVE_SMOOTHING = 0.5;
// average frame time (seconds) above which a frame counts as slow (about 48 fps), below which as fast (about 55 fps)
export const ADAPTIVE_SLOW = 1 / 48;
export const ADAPTIVE_FAST = 1 / 55;
// seconds of slow frames before stepping down, and of fast frames before trying a step up
export const ADAPTIVE_DOWN_AFTER = 1;
export const ADAPTIVE_UP_AFTER = 4;
// a step up that has to be undone within this many seconds didn't hold: the wait before the next try doubles,
// up to ADAPTIVE_UP_AFTER_MAX (with vsync the frame time can't show the headroom, so stepping up is a guess)
export const ADAPTIVE_UP_FAILED = 5;
export const ADAPTIVE_UP_AFTER_MAX = 60;
// seconds ignored at the start (shaders compiling, assets arriving) and after every change (the resize hitches)
export const ADAPTIVE_WARMUP = 3;
export const ADAPTIVE_SETTLE = 0.5;
