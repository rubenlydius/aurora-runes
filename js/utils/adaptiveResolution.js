import {
  ADAPTIVE_PIXEL_RATIOS,
  ADAPTIVE_SMOOTHING,
  ADAPTIVE_SLOW,
  ADAPTIVE_FAST,
  ADAPTIVE_DOWN_AFTER,
  ADAPTIVE_UP_AFTER,
  ADAPTIVE_UP_FAILED,
  ADAPTIVE_UP_AFTER_MAX,
  ADAPTIVE_WARMUP,
  ADAPTIVE_SETTLE,
} from '../constants/performance.js';

// keeps the frame rate up by lowering the canvas resolution while frames are slow (see js/constants/performance.js).
// Owns renderer.setPixelRatio(): resize() only sets the size, at whatever pixel ratio this picked
export const createAdaptiveResolution = ({ renderer, gui }) => {
  const params = { enabled: true, pixelRatio: ADAPTIVE_PIXEL_RATIOS[0] };
  // index into ADAPTIVE_PIXEL_RATIOS: 0 = full resolution
  let level = 0;
  let average = 1 / 60;
  // seconds the average has been slow / fast in a row
  let slowTime = 0;
  let fastTime = 0;
  // seconds of fast frames needed before the next step up, doubles each time a step up fails
  let upAfter = ADAPTIVE_UP_AFTER;
  let sinceUp = Infinity;
  // seconds left to ignore
  let ignore = ADAPTIVE_WARMUP;

  const setLevel = (value) => {
    level = value;
    params.pixelRatio = ADAPTIVE_PIXEL_RATIOS[level];
    renderer.setPixelRatio(params.pixelRatio);
    slowTime = 0;
    fastTime = 0;
    ignore = ADAPTIVE_SETTLE;
  };
  renderer.setPixelRatio(params.pixelRatio);

  // from the render loop, every frame
  const update = (delta) => {
    if (!params.enabled) return;
    // a stall (tab in the background, a big asset) says nothing about how fast the scene renders
    if (delta > 0.25) return;
    if (ignore > 0) {
      ignore -= delta;
      return;
    }
    // frame-rate independent smoothing, like the aurora pointer's
    average += (delta - average) * (1 - Math.exp(-delta / ADAPTIVE_SMOOTHING));
    sinceUp += delta;
    slowTime = average > ADAPTIVE_SLOW ? slowTime + delta : 0;
    fastTime = average < ADAPTIVE_FAST ? fastTime + delta : 0;

    if (slowTime > ADAPTIVE_DOWN_AFTER && level < ADAPTIVE_PIXEL_RATIOS.length - 1) {
      // the last step up didn't hold: wait longer before trying again
      if (sinceUp < ADAPTIVE_UP_FAILED) upAfter = Math.min(upAfter * 2, ADAPTIVE_UP_AFTER_MAX);
      setLevel(level + 1);
    } else if (fastTime > upAfter && level > 0) {
      sinceUp = 0;
      setLevel(level - 1);
    }
  };

  if (gui) {
    const folder = gui.addFolder('Performance');
    // off: back to full resolution
    folder.add(params, 'enabled').name('adaptive resolution').onChange((value) => {
      if (!value) setLevel(0);
    });
    folder.add(params, 'pixelRatio').name('pixel ratio').listen().disable();
  }

  return { update };
};
