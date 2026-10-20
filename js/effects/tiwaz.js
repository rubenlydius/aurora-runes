import * as THREE from 'three/webgpu';
import gsap from 'gsap';

import { createMeteors } from './meteors.js';
import { rawColorFromHex } from '../objects/lighting.js';
import {
  TIWAZ_START,
  TIWAZ_LANDING,
  TIWAZ_PEAK_HEIGHT,
  TIWAZ_FLIGHT,
  TIWAZ_SOUND,
  TIWAZ_VOLUME,
  TIWAZ_SOUND_DELAY,
  TIWAZ_IMPACT_SOUND,
  TIWAZ_IMPACT_VOLUME,
  TIWAZ_IMPACT_SOUND_DELAY,
  TIWAZ_WIDTH,
  TIWAZ_TAIL,
  TIWAZ_NECK,
  TIWAZ_BRIGHTNESS,
  TIWAZ_HEAD_COLOR,
  TIWAZ_TAIL_COLOR,
  TIWAZ_HUE_SHIFT,
  TIWAZ_SKY_TINT,
  TIWAZ_LIGHT_HUE,
  TIWAZ_RED_IN,
  TIWAZ_RED_OUT,
  TIWAZ_GLOW_FLASH,
  TIWAZ_GLOW_COLOR,
  TIWAZ_GLOW_INTENSITY,
  TIWAZ_GLOW_HEIGHT,
  TIWAZ_GLOW_IN,
  TIWAZ_GLOW_OUT,
} from '../constants/effects.js';

const lerp = THREE.MathUtils.lerp;
const toRad = THREE.MathUtils.degToRad;
// seconds the tail takes to catch up with the head after the landing
const TAIL_CATCH_UP = 0.4;
// path samples for the debug line
const LINE_SAMPLES = 120;

// Tiwaz (Tyr's spear): a spear of light thrown from near the ship in a high arc, landing far behind the mountain
// ridge. It's a Gebo meteor streak (js/effects/meteors.js) on a world-space arc instead of the sky. The aurora
// flares red while it flies, the key light turns red with it, a warm glow flashes behind the ridge on impact,
// then everything eases back. One GSAP timeline; nothing is created per frame (one pooled streak, one light)
export const createTiwaz = ({ uniforms, scene, camera, lighting, listener, gui }) => {
  const params = {
    flight: TIWAZ_FLIGHT,
    volume: TIWAZ_VOLUME,
    soundDelay: TIWAZ_SOUND_DELAY,
    impactVolume: TIWAZ_IMPACT_VOLUME,
    impactSoundDelay: TIWAZ_IMPACT_SOUND_DELAY,
    peakHeight: TIWAZ_PEAK_HEIGHT,
    width: TIWAZ_WIDTH,
    tail: TIWAZ_TAIL,
    neck: TIWAZ_NECK,
    brightness: TIWAZ_BRIGHTNESS,
    headColor: `#${new THREE.Color(TIWAZ_HEAD_COLOR).getHexString()}`,
    tailColor: `#${new THREE.Color(TIWAZ_TAIL_COLOR).getHexString()}`,
    hueShift: TIWAZ_HUE_SHIFT,
    lightHue: TIWAZ_LIGHT_HUE,
    redIn: TIWAZ_RED_IN,
    redOut: TIWAZ_RED_OUT,
    glowFlash: TIWAZ_GLOW_FLASH,
    glowIntensity: TIWAZ_GLOW_INTENSITY,
    glowHeight: TIWAZ_GLOW_HEIGHT,
    glowIn: TIWAZ_GLOW_IN,
    glowOut: TIWAZ_GLOW_OUT,
  };
  // copies, so the sliders don't change the constants
  const start = new THREE.Vector3(TIWAZ_START.x, TIWAZ_START.y, TIWAZ_START.z);
  const landing = new THREE.Vector3(TIWAZ_LANDING.x, TIWAZ_LANDING.y, TIWAZ_LANDING.z);

  // --- sounds: the whoosh of the throw, the hit of the impact ---
  const load = (file, name) => {
    const audio = new THREE.Audio(listener);
    new THREE.AudioLoader().load(
      `${import.meta.env.BASE_URL}${file}`,
      (buffer) => audio.setBuffer(buffer),
      undefined,
      (error) => console.error(`Tiwaz: could not load the ${name} sound`, error),
    );
    return audio;
  };
  const sound = load(TIWAZ_SOUND, 'spear');
  const impactSound = load(TIWAZ_IMPACT_SOUND, 'impact');

  // --- sound hooks, the timeline calls these ---
  const hooks = {
    // the spear leaves the thrower's hand: the whoosh, shifted by soundDelay (play(delay) waits that many
    // seconds; a negative delay starts now, that far into the file instead)
    onThrow: () => {
      if (!sound.buffer) return;
      if (sound.isPlaying) sound.stop();
      sound.setVolume(params.volume);
      sound.offset = Math.max(-params.soundDelay, 0);
      sound.play(Math.max(params.soundDelay, 0));
    },
    // the impact sound, called impactSoundDelay seconds from the landing (negative = before it)
    onImpactSound: () => {
      if (!impactSound.buffer) return;
      if (impactSound.isPlaying) impactSound.stop();
      impactSound.setVolume(params.impactVolume);
      impactSound.play();
    },
  };

  // the arc: a quadratic Bézier curve, a parabola like a real throw. Its control point sits above the middle,
  // at the height that puts the curve's top (halfway, t = 0.5) at peakHeight: y(0.5) = (y0 + 2·yc + y1) / 4.
  // Followed by its own parameter t (not by length), the spear moves sideways at a steady pace and slows near
  // the top, like something thrown
  const control = new THREE.Vector3();
  const arc = new THREE.QuadraticBezierCurve3(start, control, landing);
  const updateArc = () => {
    control.lerpVectors(start, landing, 0.5);
    control.y = 2 * params.peakHeight - (start.y + landing.y) / 2;
  };
  updateArc();

  // the streak: one pooled Gebo meteor strip (a second slot so a retrigger doesn't cut the last one off)
  const streaks = createMeteors({ max: 2 });
  scene.add(streaks.mesh);
  gsap.ticker.add((time, deltaMs) => streaks.update(Math.min(deltaMs / 1000, 0.1), camera.position));
  // the head's position on the arc, animated by the timeline: 0..1 in flight, then up to 1 + tail while the
  // tail catches up (the path stops at the landing point)
  const flight = { head: 0 };
  const arcPoint = (s, target) => arc.getPoint(Math.min(Math.max(s, 0), 1), target);

  // impact glow: a warm light behind the ridge, off until the spear lands
  const glowLight = new THREE.PointLight(TIWAZ_GLOW_COLOR, 0, 0, 2);
  scene.add(glowLight);

  // --- mood: red: 0..1 (aurora, sky tint, key light), glow: 0..1 (impact flash and light) ---
  const mood = { red: 0, glow: 0 };
  const redTint = rawColorFromHex(TIWAZ_SKY_TINT);
  const calm = { tint: new THREE.Color(1, 1, 1) };
  const apply = () => {
    uniforms.auroraHueShift.value = params.hueShift * mood.red;
    uniforms.skyTint.value.lerpColors(calm.tint, redTint, mood.red);
    lighting.adjust.keyHue = params.lightHue * mood.red;
  };
  // flashAmount is shared (Thurisaz, Gebo): only written while the glow runs
  const applyGlow = () => {
    uniforms.flashAmount.value = params.glowFlash * mood.glow;
    glowLight.intensity = params.glowIntensity * mood.glow;
  };

  let timeline = null;
  const trigger = () => {
    if (listener.context.state === 'suspended') listener.context.resume();
    // the sky tint to return to, read when the effect starts from normal
    if (mood.red === 0) calm.tint.copy(uniforms.skyTint.value);
    // retriggered: a new throw; the last streak finishes on its own, the red continues from where it is
    timeline?.kill();
    if (mood.glow > 0) {
      mood.glow = 0;
      applyGlow();
    }
    glowLight.position.copy(landing).setY(landing.y + params.glowHeight);

    const life = params.flight + TAIL_CATCH_UP + 0.1;
    flight.head = 0;
    timeline = gsap.timeline({ onUpdate: apply });
    timeline
      .call(hooks.onThrow, null, 0)
      .call(() => streaks.launch({
        path: arcPoint,
        headAt: () => flight.head,
        length: params.tail,
        width: toRad(params.width),
        neck: params.neck,
        life,
        // bright all the way, fading only as the tail slides into the landing point
        fadeStart: params.flight / life,
        brightness: params.brightness,
        headColor: params.headColor,
        tailColor: params.tailColor,
      }), null, 0)
      // the flight, at the curve's own pace (see the arc above), then the tail catches up
      .to(flight, { head: 1, duration: params.flight, ease: 'none' }, 0)
      .to(flight, { head: 1 + params.tail, duration: TAIL_CATCH_UP, ease: 'sine.out' }, params.flight)
      // the aurora flares red as it flies
      .to(mood, { red: 1, duration: params.redIn * (1 - mood.red), ease: 'sine.out' }, 0)
      // impact: the glow behind the ridge flares and fades
      .call(hooks.onImpactSound, null, Math.max(params.flight + params.impactSoundDelay, 0))
      .to(mood, { glow: 1, duration: params.glowIn, ease: 'sine.out', onUpdate: applyGlow }, params.flight)
      .to(mood, { glow: 0, duration: params.glowOut, ease: 'sine.inOut', onUpdate: applyGlow }, params.flight + params.glowIn)
      // then the red eases back
      .to(mood, { red: 0, duration: params.redOut, ease: 'sine.inOut' }, params.flight);
  };

  if (gui) {
    // --- debug arc line ---
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicNodeMaterial({ color: 0xffcc33, fog: false, depthTest: false, transparent: true }),
    );
    line.renderOrder = 999;
    line.frustumCulled = false;
    scene.add(line);
    const updateLine = () => {
      updateArc();
      line.geometry.dispose();
      line.geometry = new THREE.BufferGeometry().setFromPoints(arc.getPoints(LINE_SAMPLES));
    };
    updateLine();

    const folder = gui.addFolder('Tiwaz (spear)');
    folder.add({ trigger }, 'trigger').name('trigger');
    folder.add(line, 'visible').name('show arc');
    folder.add(start, 'x', -50, 50, 0.5).name('start x').onChange(updateLine);
    folder.add(start, 'y', -2, 20, 0.1).name('start y').onChange(updateLine);
    folder.add(start, 'z', -60, 10, 0.5).name('start z').onChange(updateLine);
    folder.add(params, 'peakHeight', 10, 400, 1).name('peak height').onChange(updateLine);
    folder.add(landing, 'x', -600, 600, 1).name('landing x').onChange(updateLine);
    folder.add(landing, 'y', -10, 50, 0.5).name('landing y').onChange(updateLine);
    folder.add(landing, 'z', -900, 100, 1).name('landing z').onChange(updateLine);
    folder.add(params, 'flight', 0.5, 8, 0.05).name('flight (s)');
    folder.add(params, 'soundDelay', -2, 3, 0.01).name('sound delay (s)');
    folder.add(params, 'volume', 0, 2, 0.01).name('sound volume');
    folder.add(params, 'impactSoundDelay', -2, 2, 0.01).name('impact sound delay (s)');
    folder.add(params, 'impactVolume', 0, 2, 0.01).name('impact sound volume');
    folder.add(params, 'width', 0.05, 3, 0.01).name('spear width (°)');
    folder.add(params, 'tail', 0.02, 0.6, 0.01).name('tail length');
    folder.add(params, 'neck', 0.5, 4, 0.05).name('neck (×)');
    folder.add(params, 'brightness', 0, 6, 0.05);
    folder.addColor(params, 'headColor').name('head color');
    folder.addColor(params, 'tailColor').name('tail color');
    folder.add(params, 'hueShift', 0, 2, 0.01).name('red hue shift');
    folder.addColor({ tint: `#${redTint.getHexString(THREE.LinearSRGBColorSpace)}` }, 'tint').name('red sky tint')
      .onChange((value) => redTint.setStyle(value, THREE.LinearSRGBColorSpace));
    folder.add(params, 'lightHue', 0, 1, 0.01).name('key light hue');
    folder.add(params, 'redIn', 0.1, 5, 0.05).name('red in (s)');
    folder.add(params, 'redOut', 0.1, 10, 0.05).name('red out (s)');
    folder.add(params, 'glowFlash', 0, 1, 0.01).name('glow sky flash');
    folder.addColor({ color: `#${glowLight.color.getHexString()}` }, 'color').name('glow color')
      .onChange((value) => glowLight.color.set(value));
    folder.add(params, 'glowIntensity', 0, 2000000, 1000).name('glow light intensity');
    folder.add(params, 'glowHeight', 0, 100, 1).name('glow light height');
    folder.add(params, 'glowIn', 0.02, 2, 0.01).name('glow rise (s)');
    folder.add(params, 'glowOut', 0.1, 6, 0.05).name('glow fade (s)');
  }

  return trigger;
};
