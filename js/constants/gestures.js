// drawings with a shorter total path (in screen pixels) are ignored: $P can't normalize a click
export const GESTURE_MIN_PATH_LENGTH = 20;
// a recognition only counts as a match at or above this $P score (0..1); tweakable in debug mode
export const GESTURE_THRESHOLD = 0.8;
