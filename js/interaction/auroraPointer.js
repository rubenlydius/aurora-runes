import * as THREE from 'three/webgpu';

import {
  AURORA_RAY_ORIGIN,
  AURORA_LAYER_HEIGHT,
  POINTER_RADIUS,
  POINTER_PERSPECTIVE,
  POINTER_CORE_SIZE,
  POINTER_FOLLOW_SPEED,
  POINTER_TRAIL_LIFETIME,
  POINTER_TRAIL_POINTS,
  POINTER_TRAIL_SPACING,
  POINTER_FADE_TIME,
} from '../constants/aurora.js';

// pt (the aurora loop's distance along the ray) at a medium height in the sky, rd.y = 0.3:
// the sizes in the constants are meant for this distance
const REFERENCE_PT = AURORA_LAYER_HEIGHT / (0.3 * 2 + 0.4);

// the trail's path for the shader: a 1-pixel-high float texture, one texel per point
// (r, g = position in noise coordinates, b = age 0..1, a = 1 if this point ends an older, separate
// trail that must not connect to the newer points); float32 so positions stay precise
export const createTrailTexture = () => {
  const data = new Float32Array(POINTER_TRAIL_POINTS * 4);
  const trailTexture = new THREE.DataTexture(data, POINTER_TRAIL_POINTS, 1, THREE.RGBAFormat, THREE.FloatType);
  // read with textureLoad (exact texels), and float32 textures can't be filtered anyway
  trailTexture.minFilter = THREE.NearestFilter;
  trailTexture.magFilter = THREE.NearestFilter;
  trailTexture.needsUpdate = true;
  return trailTexture;
};

// press and drag on the sky: the aurora gathers and brightens around the pointer
export const createAuroraPointer = ({ canvas, camera, uniforms, shiftLooksAround, gui }) => {
  const params = {
    radius: POINTER_RADIUS,
    coreSize: POINTER_CORE_SIZE,
    perspective: POINTER_PERSPECTIVE,
    followSpeed: POINTER_FOLLOW_SPEED,
    trailLifetime: POINTER_TRAIL_LIFETIME,
    fadeTime: POINTER_FADE_TIME,
  };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  // where the pointer is (target) and where the glow is (current, trails behind)
  const target = new THREE.Vector2();
  const current = uniforms.pointerPoint.value;
  // recorded path of the glow, newest first: { x, y, age in seconds, breakBefore }
  const path = [];
  const trailTexture = uniforms.pointerTrailPoints.value;
  // grows each time the path is thinned out, so new points match the coarser spacing
  let spacingScale = 1;

  // the path is full: drop every other point instead of the oldest ones, so a long drawing is never
  // cut short, it just gets a little coarser. Points where a stroke starts or ends are always kept
  const thinPath = () => {
    const kept = path.filter((point, index) =>
      index % 2 === 0
      || index === path.length - 1
      || point.breakBefore
      || path[index + 1]?.breakBefore);
    path.length = 0;
    path.push(...kept);
    spacingScale *= 2;
  };
  // the pointer's pt: large near the horizon (far away), small overhead (close by)
  let targetPt = REFERENCE_PT;
  let currentPt = REFERENCE_PT;
  let pressed = false;
  // while Space is held, nothing fades: the drawn aurora stays on screen
  let holding = false;
  // 0..1, eased in on press and out on release
  let fade = 0;

  // pointer position on screen -> the aurora loop's noise coordinates
  const updateTarget = (event) => {
    const rect = canvas.getBoundingClientRect();
    // normalized device coordinates: -1..1, y pointing up
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    // world-space direction from the camera through the pointer, like the sky shader's rayDir
    raycaster.setFromCamera(ndc, camera);
    const rd = raycaster.ray.direction;
    // below the horizon the shaders mirror the ray (water reflection), so mirror it here too
    const rdY = Math.abs(rd.y);
    // the same "plane" the shader samples: pt = (height - ro.y) / (rd.y * 2 + 0.4), not / rd.y
    const pt = (AURORA_LAYER_HEIGHT - AURORA_RAY_ORIGIN.y) / (rdY * 2 + 0.4);
    // the shader uses bpos.zx: z first, then x
    target.set(AURORA_RAY_ORIGIN.z + pt * rd.z, AURORA_RAY_ORIGIN.x + pt * rd.x);
    targetPt = pt;
  };

  canvas.addEventListener('pointerdown', (event) => {
    // in debug mode, Shift + drag looks around instead
    if (event.shiftKey && shiftLooksAround) return;
    pressed = true;
    // keep receiving move/up events even when the pointer leaves the canvas
    canvas.setPointerCapture(event.pointerId);
    updateTarget(event);
    // every press is a new stroke
    if (fade > 0) {
      // the previous stroke is still fading: end its trail where its glow was, so it fades out
      // there on its own instead of stretching over to the new stroke
      path.unshift({ x: current.x, y: current.y, age: 0, breakBefore: true });
      if (path.length > POINTER_TRAIL_POINTS - 1) thinPath();
    } else {
      // nothing visible anymore: start clean
      path.length = 0;
      spacingScale = 1;
    }
    // the glow starts right at the pointer instead of sliding over from the last spot
    current.copy(target);
    currentPt = targetPt;
  });

  canvas.addEventListener('pointermove', (event) => {
    if (pressed) updateTarget(event);
  });

  const release = (event) => {
    if (!pressed) return;
    pressed = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  // e.g. the browser takes over the touch, or the pen leaves the screen
  canvas.addEventListener('pointercancel', release);

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    // leave Space alone for the debug sliders
    if (event.target.closest?.('.lil-gui')) return;
    // Space would otherwise scroll the page
    event.preventDefault();
    holding = true;
  });
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') holding = false;
  });
  // the keyup is missed when the window loses focus while Space is down
  window.addEventListener('blur', () => {
    holding = false;
  });

  const update = (delta) => {
    // frame-rate independent smoothing: close the same fraction of the gap per second at any fps
    const follow = 1 - Math.exp(-params.followSpeed * delta);
    current.lerp(target, follow);
    currentPt += (targetPt - currentPt) * follow;

    // a fixed size in noise units looks ~6x smaller near the horizon (pt ~2.1) than overhead (pt ~0.35);
    // growing it with pt cancels that out, the exponent keeps a little of the perspective
    const scale = Math.pow(currentPt / REFERENCE_PT, 1 - params.perspective);
    uniforms.pointerRadius.value = params.radius * scale;
    uniforms.pointerCoreSize.value = params.coreSize * scale;

    // trail: age the recorded points and forget the ones older than the lifetime
    // (holding Space freezes their age, so the trail stays until Space is released)
    if (!holding) for (const point of path) point.age += delta;
    while (path.length > 0 && path[path.length - 1].age > params.trailLifetime) path.pop();
    // everything has faded: back to the fine spacing
    if (path.length === 0) spacingScale = 1;
    // record where the glow is whenever it has moved far enough (spacing scaled like the sizes)
    const newest = path[0];
    const moved = newest ? Math.hypot(current.x - newest.x, current.y - newest.y) : Infinity;
    if (pressed && moved > POINTER_TRAIL_SPACING * spacingScale * scale) {
      path.unshift({ x: current.x, y: current.y, age: 0, breakBefore: false });
      // the first texel is the live glow position, so the path gets one less
      if (path.length > POINTER_TRAIL_POINTS - 1) thinPath();
    }
    // texel 0: the glow itself (age 0), then the path from new to old, ages as 0..1
    const data = trailTexture.image.data;
    data[0] = current.x;
    data[1] = current.y;
    data[2] = 0;
    data[3] = 0;
    path.forEach((point, index) => {
      const offset = (index + 1) * 4;
      data[offset] = point.x;
      data[offset + 1] = point.y;
      data[offset + 2] = point.age / params.trailLifetime;
      data[offset + 3] = point.breakBefore ? 1 : 0;
    });
    trailTexture.needsUpdate = true;
    uniforms.pointerTrailCount.value = path.length + 1;

    // fade linearly toward 1 (pressed) or 0 (released), then ease the curve so it starts and ends softly
    const step = delta / params.fadeTime;
    // holding Space: keep the current strength instead of fading out
    if (pressed) fade = Math.min(fade + step, 1);
    else if (!holding) fade = Math.max(fade - step, 0);
    uniforms.pointerStrength.value = fade * fade * (3 - 2 * fade);
  };

  if (gui) {
    const folder = gui.addFolder('Aurora pointer');
    folder.add(params, 'radius', 0.05, 3, 0.01);
    folder.add(params, 'perspective', 0, 1, 0.01);
    folder.add(uniforms.pointerBoost, 'value', 0, 10, 0.05).name('intensity boost');
    folder.add(uniforms.pointerPull, 'value', 0, 10, 0.05).name('magnet pull');
    folder.add(uniforms.pointerCore, 'value', 0, 3, 0.01).name('core intensity');
    folder.add(params, 'coreSize', 0.01, 0.5, 0.005).name('core size');
    folder.add(uniforms.pointerCreate, 'value', 0, 3, 0.01).name('new aurora');
    folder.add(uniforms.pointerTrail, 'value', 0, 3, 0.01).name('trail intensity');
    folder.add(params, 'trailLifetime', 0.1, 3, 0.05).name('trail lifetime (s)');
    folder.add(params, 'followSpeed', 0.5, 30, 0.1).name('follow speed');
    folder.add(params, 'fadeTime', 0.05, 5, 0.05).name('fade time (s)');
  }

  // for the camera drift in step 3: freeze it while this returns true
  const isPressed = () => pressed;

  return { update, isPressed };
};
