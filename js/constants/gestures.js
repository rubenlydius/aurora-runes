// drawings with a shorter total path (in screen pixels) are ignored: $P can't normalize a click
export const GESTURE_MIN_PATH_LENGTH = 20;
// a recognition only counts as a match at or above this $P score (0..1); tweakable in debug mode
export const GESTURE_THRESHOLD = 0.8;

// Thurisaz / Laguz tie-breaker (js/gestures/tieBreak.js): $P often mistakes a Thurisaz with a high thorn for
// Laguz. When those two are the best matches and their $P distances (lower = closer, scores are capped at 1)
// differ by at most this margin, the shape decides; tweakable in debug mode
export const GESTURE_TIE_MARGIN = 0.6;
// the non-vertical stroke counts as bent (Thurisaz's thorn) when it turns more than this many degrees near
// its middle; the templates: Thurisaz 84-113°, Laguz 1-10°; tweakable in debug mode
export const GESTURE_BEND_ANGLE = 45;
// "near its middle": the bend is ignored in this fraction of the stroke at each end (a corner left over there
// is part of the stave, not a bend)
export const GESTURE_BEND_EDGE = 0.2;
