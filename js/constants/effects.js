// rune effects, all tweakable with lil-gui in debug mode

// rune name label: seconds to fade in, stay, fade out, and its opacity while shown
export const RUNE_LABEL_FADE_IN = 0.4;
export const RUNE_LABEL_HOLD = 1.2;
export const RUNE_LABEL_FADE_OUT = 0.8;
export const RUNE_LABEL_OPACITY = 0.7;

// Sowilo (midnight sun): dayAmount rises to this over the ramp in, holds, then eases back to the night
export const SOWILO_DAY_AMOUNT = 0.9;
export const SOWILO_RAMP_IN = 2;
export const SOWILO_HOLD = 3;
export const SOWILO_RAMP_OUT = 3;

// Thurisaz (thunder): a bolt strikes the ship's mast, then a few distant bolts along the ridge
// sound, loaded from public/ with BASE_URL; the distant thunder reuses it, quieter and muffled
export const THURISAZ_SOUND = 'sounds/thunder001.wav';
// seconds skipped at the start of the sound: the file is silent for about 0.9 s, its crack peaks at 1.24 s
export const THURISAZ_SOUND_OFFSET = 0.85;
// seconds of the sound that play (the file runs about 22 s), the last THURISAZ_SOUND_FADE of them fading out
export const THURISAZ_SOUND_LENGTH = 4;
export const THURISAZ_SOUND_FADE = 1;
// bolt line color (unlit, so shown as-is)
export const THURISAZ_BOLT_COLOR = 0xdfe8ff;
// stroke width in pixels: main bolt, distant bolts
export const THURISAZ_BOLT_WIDTH = 4;
export const THURISAZ_DISTANT_BOLT_WIDTH = 2;
// jaggedness: sideways offset of the first midpoint as a fraction of the bolt's length (halves per level);
// detail: levels of midpoint splitting, 6 gives 65 points
export const THURISAZ_BOLT_JAGGEDNESS = 0.12;
export const THURISAZ_BOLT_DETAIL = 6;

// main bolt: starts this high above the mast top, up to this far sideways
export const THURISAZ_BOLT_HEIGHT = 40;
export const THURISAZ_BOLT_SPREAD = 8;
// point light at the strike point, flashes with the bolt (physical units, decay 2)
export const THURISAZ_STRIKE_LIGHT_COLOR = 0xcfe0ff;
export const THURISAZ_STRIKE_LIGHT_INTENSITY = 80;
// sky flash (flashAmount) at the main bolt's peak
export const THURISAZ_FLASH = 1;
// close thunder: random delay up to this many seconds, and its volume
export const THURISAZ_CLOSE_DELAY = 0.1;
export const THURISAZ_CLOSE_VOLUME = 1;

// distant bolts: how many, and when (seconds after the strike, random in the range)
export const THURISAZ_DISTANT_COUNT_MIN = 5;
export const THURISAZ_DISTANT_COUNT_MAX = 7;
export const THURISAZ_DISTANT_DELAY_MIN = 0.3;
export const THURISAZ_DISTANT_DELAY_MAX = 0.8;
// how bright the distant bolts are (0..1) and their sky flash
export const THURISAZ_DISTANT_BRIGHTNESS = 0.5;
export const THURISAZ_DISTANT_FLASH = 0.3;
// distant bolts last this many times as long as the main bolt, and flicker this many times
export const THURISAZ_DISTANT_DURATION = 2.5;
export const THURISAZ_DISTANT_FLICKERS = 3;
// where they land: there's no ridge in the scene yet, so these stand in for it. Random azimuth in this
// range (degrees, 0 = -z, 90 = +x, like the sun), this far from the camera, this many degrees above the horizon
export const THURISAZ_RIDGE_AZIMUTH_MIN = -10;
export const THURISAZ_RIDGE_AZIMUTH_MAX = 80;
export const THURISAZ_RIDGE_DISTANCE = 300;
export const THURISAZ_RIDGE_ELEVATION = 1;
// distant bolts start this high above their target
export const THURISAZ_DISTANT_BOLT_HEIGHT = 50;
// distant thunder: delay after each distant bolt (seconds, random in the range), volume, low-pass cutoff (Hz)
export const THURISAZ_DISTANT_THUNDER_DELAY_MIN = 1;
export const THURISAZ_DISTANT_THUNDER_DELAY_MAX = 2;
export const THURISAZ_DISTANT_VOLUME = 0.35;
export const THURISAZ_DISTANT_FILTER_FREQUENCY = 600;

// Laguz (water): a swell rolls through the fjord, the ship rides it (js/objects/ship.js), waves sound along
export const LAGUZ_SOUND = 'sounds/waves002.m4a';
export const LAGUZ_VOLUME = 0.8;
// swell at its peak: wave height (world units, the camera is about 2.2 above the water), and multipliers
// on the normal ripples and aurora speed
export const LAGUZ_WAVE_HEIGHT = 0.9;
export const LAGUZ_RIPPLE_STRENGTH = 2;
export const LAGUZ_RIPPLE_SPEED = 2;
export const LAGUZ_AURORA_SPEED = 2;
// swell timing (seconds): rise, stay, ease back (the sound fades in and out with it, the ship settles with it)
export const LAGUZ_RAMP_IN = 1.5;
export const LAGUZ_HOLD = 3;
export const LAGUZ_RAMP_OUT = 5;
