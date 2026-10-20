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

// Kenaz (fire): the sail burns away from the bottom up (js/shaders/spread/fragment.wgsl), then reforms
export const KENAZ_SOUND = 'sounds/fire.m4a';
export const KENAZ_VOLUME = 0.8;
// which sail meshes burn, by material name: the model's sail is Plane (White) and Plane_1 (Red) cloth,
// Plane_2 (DarkWood) is the mast and yard, which stay
export const KENAZ_SAIL_MATERIALS = ['White', 'Red'];
// where the fire starts, as a fraction of the cloth's local bounding box per axis (0.5, 0, 0.5 = bottom centre)
export const KENAZ_ORIGIN = { x: 0.5, y: 0, z: 0.5 };
// timing (seconds): burn the whole sail, stay burnt, grow back; the fire (light, embers, sound) fades in
// and out over KENAZ_FIRE_FADE
export const KENAZ_BURN_DURATION = 7;
export const KENAZ_HOLD = 3;
export const KENAZ_REFORM_DURATION = 3;
export const KENAZ_FIRE_FADE = 1;
// burn front: glow color and brightness (emissive), the softer glow while the sail reforms, the burnt color
export const KENAZ_EDGE_COLOR = 0xff3000;
export const KENAZ_EDGE_INTENSITY = 2.5;
export const KENAZ_REFORM_GLOW = 1.5;
export const KENAZ_CHAR_COLOR = 0x140b07;
// width of the glowing band and how jagged the front is (fractions of the sail's size), noise bumps across the sail
export const KENAZ_EDGE_WIDTH = 0.08;
export const KENAZ_NOISE_STRENGTH = 0.3;
export const KENAZ_NOISE_SCALE = 6;
// orange point light at the burn front (physical units, decay 2); flicker: random jitter, ± this fraction
export const KENAZ_LIGHT_COLOR = 0xff7a2a;
export const KENAZ_LIGHT_INTENSITY = 25;
export const KENAZ_LIGHT_FLICKER = 0.35;
// embers rising from the front: how many at once (at most KENAZ_EMBER_MAX), color, size, rise speed
// (world units per second) and lifetime (seconds)
export const KENAZ_EMBER_MAX = 400;
export const KENAZ_EMBER_COUNT = 150;
export const KENAZ_EMBER_COLOR = 0xffa040;
export const KENAZ_EMBER_SIZE = 0.25;
export const KENAZ_EMBER_RISE = 0.8;
export const KENAZ_EMBER_LIFETIME = 3;

// Hagalaz (hail): a short hailstorm, the stones are Rapier physics bodies (js/physics/world.js) that bounce
// off the ship, settle on the deck and melt, or splash into the water
export const HAGALAZ_SOUND = 'sounds/hail.m4a';
export const HAGALAZ_VOLUME = 0.8;
// storm mood: sky brightness and a cold grey tint (sRGB values as-is, like the sky shader); the key light
// is the aurora, so it dims along with skyBrightness (js/objects/lighting.js)
export const HAGALAZ_SKY_BRIGHTNESS = 0.6;
export const HAGALAZ_SKY_TINT = 0xc4ccd6;
// timing (seconds): the sky darkens, then hail falls for HAGALAZ_DURATION (the rate ramps up over the
// first and down over the last HAGALAZ_RATE_RAMP seconds), then the sky eases back
export const HAGALAZ_SKY_RAMP_IN = 1;
export const HAGALAZ_DURATION = 5;
export const HAGALAZ_RATE_RAMP = 1.5;
export const HAGALAZ_SKY_RAMP_OUT = 2;
// peak stones per second
export const HAGALAZ_RATE = 80;
// most stones alive at once (a pool: never more meshes or bodies than this); the slider goes up to the max
export const HAGALAZ_CAP = 300;
export const HAGALAZ_CAP_MAX = 600;
// where stones appear: a box centred over the ship (x, z offsets from it, world units), this high above
// the water, this wide and deep; HAGALAZ_SPAWN_WIDE of them fall in a box this many times larger, over the
// rest of the visible water
export const HAGALAZ_SPAWN_AREA = { offsetX: 0, offsetZ: 0, height: 28, width: 14, depth: 30 };
export const HAGALAZ_SPAWN_WIDE = 0.35;
export const HAGALAZ_SPAWN_WIDE_SCALE = 3;
// downward speed when they appear (world units per second), plus up to this much sideways drift
export const HAGALAZ_FALL_SPEED = 8;
export const HAGALAZ_WIND = 5;
// stone radius range (world units)
export const HAGALAZ_SIZE_MIN = 0.05;
export const HAGALAZ_SIZE_MAX = 0.12;
// bounciness (0 = dead stop, 1 = bounces back as high) and grip
export const HAGALAZ_RESTITUTION = 0.7;
export const HAGALAZ_FRICTION = 0.6;
// landed stones: stay this long once at rest (seconds), then melt (shrink away) over HAGALAZ_MELT_TIME
export const HAGALAZ_REST_TIME = 3;
export const HAGALAZ_MELT_TIME = 2;
// stone color (lit, hex sRGB)
export const HAGALAZ_COLOR = 0xdcebff;
// a faint glow of their own (emissive), so the stones stay visible against the dark storm sky
export const HAGALAZ_EMISSIVE = 0x9fc4e8;
export const HAGALAZ_EMISSIVE_INTENSITY = 0.75;

// Gebo (gift): a meteor shower across the upper sky, ending with one big, slow meteor
// how many meteors, over how many seconds (sparse at first, denser toward the end)
export const GEBO_COUNT = 30;
export const GEBO_DURATION = 5;
// where they start: azimuth (degrees, 0 = -z, 90 = +x, like the sun) and elevation ranges; the camera looks
// toward about azimuth 40. The azimuth range is for a shower travelling to the right: for one travelling left
// it's mirrored around the view's centre, so the meteors still cross the view
export const GEBO_AZIMUTH_MIN = -15;
export const GEBO_AZIMUTH_MAX = 70;
export const GEBO_ELEVATION_MIN = 18;
export const GEBO_ELEVATION_MAX = 42;
// travel direction across the sky (degrees: 0 = toward the right, -90 = straight down, -180 = toward the left):
// picked at random in this range on every trigger, the whole shower shares it (± the variation per meteor).
// -150..-30: they come in from anywhere between 10 and 2 o'clock (-90 = from 12, straight down)
export const GEBO_DIRECTION_MIN = -150;
export const GEBO_DIRECTION_MAX = -30;
export const GEBO_DIRECTION_VARIATION = 8;
// speed (degrees of sky per second), streak length and width (degrees), lifetime range (seconds)
export const GEBO_SPEED = 30;
export const GEBO_LENGTH = 9;
export const GEBO_WIDTH = 0.18;
export const GEBO_LIFETIME_MIN = 0.4;
export const GEBO_LIFETIME_MAX = 1;
// head and tail colors (unlit, additive), and a brightness multiplier
export const GEBO_HEAD_COLOR = 0xf2f8ff;
export const GEBO_TAIL_COLOR = 0x7fc8ff;
export const GEBO_BRIGHTNESS = 1.2;
// finale: after this pause, one big meteor starting here, size and length multipliers, slower, longer,
// brighter; plus a sky flash and key light lift (flashAmount) at its peak
export const GEBO_PAUSE = 0.8;
export const GEBO_FINALE_AZIMUTH = 25;
export const GEBO_FINALE_ELEVATION = 38;
export const GEBO_FINALE_SIZE = 3;
export const GEBO_FINALE_LENGTH = 2;
// the finale's trail just behind its head (the neck) is this many times thicker than a normal meteor's
export const GEBO_FINALE_NECK = 1.4;
export const GEBO_FINALE_SPEED = 0.5;
export const GEBO_FINALE_LIFETIME = 2.5;
export const GEBO_FINALE_BRIGHTNESS = 2;
export const GEBO_FINALE_FLASH = 0.25;

// Isa (ice): the fjord freezes from the shore outward, frost climbs the ship from the waterline, the ship and
// the aurora stop moving; then it all thaws
// sound when the freeze starts (about 2.7 s, matches the freeze)
export const ISA_SOUND = 'sounds/ice.mp3';
export const ISA_VOLUME = 0.8;
// timing (seconds): freeze (water front, aurora slowing), hold, thaw (ice and frost fade away, aurora speeds up)
export const ISA_FREEZE_DURATION = 3;
export const ISA_HOLD = 2;
export const ISA_THAW_DURATION = 3;
// water ice (js/shaders/water/fragment.wgsl): where it grows from (world x, z: by the ship), how
// far the front gets (world units), its curve (> 1: slow near the shore, faster far out) and raggedness
export const ISA_ORIGIN = { x: 5, z: -17 };
export const ISA_RADIUS = 500;
export const ISA_CURVE = 4;
export const ISA_EDGE_NOISE = 1.75;
// ice look: bluish white (display values like the water color), how much of it shows on the surface,
// frosted (blurred) reflection, crack brightness and cracks per world unit
export const ISA_ICE_COLOR = 0x50cded;
export const ISA_ICE_TINT = 0.12;
export const ISA_ICE_BLUR = 0.04;
export const ISA_CRACK_STRENGTH = 0.7;
export const ISA_CRACK_SCALE = 0.2;
// ship frost (js/shaders/spread/fragment.wgsl, planar from the waterline): starts when the water ice reaches
// the ship and covers it over ISA_FROST_DURATION; the ship's motion eases to a stop over ISA_SHIP_STOP
export const ISA_FROST_DURATION = 2.5;
export const ISA_SHIP_STOP = 1.2;
// frost front: icy white edge (emissive), the frosted color and how much of it covers the original colors
export const ISA_FROST_EDGE_COLOR = 0xeaf6ff;
export const ISA_FROST_EDGE_INTENSITY = 1.2;
export const ISA_FROST_COLOR = 0xbfdcf2;
export const ISA_FROST_AMOUNT = 0.7;
export const ISA_FROST_EDGE_WIDTH = 0.05;
export const ISA_FROST_NOISE_STRENGTH = 0.15;
export const ISA_FROST_NOISE_SCALE = 8;
// lights while frozen: key light tinted cooler (multiplied onto the aurora color), fill light brighter (ice
// reflects more light)
export const ISA_KEY_TINT = 0xc8dcff;
export const ISA_HEMI_BOOST = 1.5;

// Dagaz (dawn / awakening): an aurora surge, like a substorm. The aurora brightens, speeds up and shifts
// toward pink and violet, dances in a few pulses, then settles
// peak values: aurora brightness (×), hue shift (0 = green, 1 = pink lower edge / violet tops), speed
export const DAGAZ_INTENSITY = 5;
export const DAGAZ_HUE_SHIFT = 1;
export const DAGAZ_SPEED = 5;
// pulses: the aurora beats with the heartbeat sound, one pulse per beat found in the file (its "lub" and
// "dub"); strength: extra brightness at a beat, as a fraction of the peak. Pulse count: only used while the
// sound hasn't loaded, then the pulses fall back to that many random ones
export const DAGAZ_PULSE_COUNT = 5;
export const DAGAZ_PULSE_STRENGTH = 0.5;
// heartbeat: plays from the peak through the hold and fades out while the aurora settles. It's a steady 60 bpm
// lub-dub, the first lub about 0.74 s in: starting 0.6 s into the file puts it just after the peak
export const DAGAZ_HEARTBEAT_SOUND = 'sounds/heartbeat.mp3';
export const DAGAZ_HEARTBEAT_VOLUME = 0.9;
export const DAGAZ_HEARTBEAT_OFFSET = 0.6;
// timing (seconds): build up, hold at the peak (the pulses happen here), ease back
export const DAGAZ_RAMP_IN = 2;
export const DAGAZ_HOLD = 4;
export const DAGAZ_RAMP_OUT = 4;
// key light during the surge: how much of the aurora's extra brightness it follows (1 = all of it, 3× at the
// peak), and how far its hue turns with the aurora's (fraction of the color wheel per unit of hue shift)
export const DAGAZ_LIGHT_FOLLOW = 0.5;
export const DAGAZ_LIGHT_HUE = 0.25;

// Tiwaz (Tyr's spear): a spear of light is thrown from near the ship in a high arc and comes down far behind
// the mountain ridge; the aurora flares red while it flies, a warm glow flashes up behind the ridge on impact
// arc (world units): start near the ship, landing behind the ridge as seen from the camera (mountain 1 is at
// x 223, z -135), and the height of the arc's top above the water
export const TIWAZ_START = { x: 3, y: 0, z: -14 };
export const TIWAZ_LANDING = { x: 340, y: -2, z: -123 };
export const TIWAZ_PEAK_HEIGHT = 90;
// seconds in the air
export const TIWAZ_FLIGHT = 2.5;
// spear whoosh (about 2.1 s, loudest about 1.0 s in): seconds after the throw it starts. 0.25 puts its loudest
// moment on the top of the arc (half the flight); negative starts it right away, that far into the file
export const TIWAZ_SOUND = 'sounds/spear.wav';
export const TIWAZ_VOLUME = 0.8;
export const TIWAZ_SOUND_DELAY = -0.3;
// impact sound (about 4 s, its hit is loudest 0.3 s in): seconds relative to the impact it starts, -0.3 puts
// the hit right on the landing
export const TIWAZ_IMPACT_SOUND = 'sounds/spear_end.wav';
export const TIWAZ_IMPACT_VOLUME = 0.8;
export const TIWAZ_IMPACT_SOUND_DELAY = -0.3;
// spear streak: width (degrees, like the Gebo meteors but larger), tail length (fraction of the arc), neck,
// brightness, head and tail colors
export const TIWAZ_WIDTH = 0.7;
export const TIWAZ_TAIL = 0.1;
export const TIWAZ_NECK = 1.4;
export const TIWAZ_BRIGHTNESS = 2.5;
export const TIWAZ_HEAD_COLOR = 0xf42710;
export const TIWAZ_TAIL_COLOR = 0xff8a3d;
// red aurora: auroraHueShift at full red (2 = every layer deep red, see the aurora shader), a subtle red sky
// tint (sRGB values as-is), and how far the key light's hue turns (fraction of the color wheel: its teal
// green + 0.56 = red); rises over TIWAZ_RED_IN, eases back over TIWAZ_RED_OUT after the impact
export const TIWAZ_HUE_SHIFT = 2;
export const TIWAZ_SKY_TINT = 0xffdcdc;
export const TIWAZ_LIGHT_HUE = 0.56;
export const TIWAZ_RED_IN = 0.8;
export const TIWAZ_RED_OUT = 3;
// impact glow behind the ridge: sky flash (flashAmount) and a warm point light at the landing point, raised a
// little (physical units, decay 2, so it has to be strong at that distance); rise and fade (seconds)
export const TIWAZ_GLOW_FLASH = 0.6;
export const TIWAZ_GLOW_COLOR = 0xff9a50;
export const TIWAZ_GLOW_INTENSITY = 1000000;
export const TIWAZ_GLOW_HEIGHT = 20;
export const TIWAZ_GLOW_IN = 0.15;
export const TIWAZ_GLOW_OUT = 1.5;
