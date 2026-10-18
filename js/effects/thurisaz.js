import * as THREE from 'three/webgpu';
import gsap from 'gsap';

import { createBoltLine, setBoltPath } from './lightningBolt.js';
import { sunDirectionFrom } from '../objects/lighting.js';
import {
  THURISAZ_SOUND,
  THURISAZ_SOUND_OFFSET,
  THURISAZ_SOUND_LENGTH,
  THURISAZ_SOUND_FADE,
  THURISAZ_BOLT_COLOR,
  THURISAZ_BOLT_WIDTH,
  THURISAZ_DISTANT_BOLT_WIDTH,
  THURISAZ_BOLT_JAGGEDNESS,
  THURISAZ_BOLT_DETAIL,
  THURISAZ_BOLT_HEIGHT,
  THURISAZ_BOLT_SPREAD,
  THURISAZ_STRIKE_LIGHT_COLOR,
  THURISAZ_STRIKE_LIGHT_INTENSITY,
  THURISAZ_FLASH,
  THURISAZ_CLOSE_DELAY,
  THURISAZ_CLOSE_VOLUME,
  THURISAZ_DISTANT_COUNT_MIN,
  THURISAZ_DISTANT_COUNT_MAX,
  THURISAZ_DISTANT_DELAY_MIN,
  THURISAZ_DISTANT_DELAY_MAX,
  THURISAZ_DISTANT_BRIGHTNESS,
  THURISAZ_DISTANT_FLASH,
  THURISAZ_DISTANT_DURATION,
  THURISAZ_DISTANT_FLICKERS,
  THURISAZ_RIDGE_AZIMUTH_MIN,
  THURISAZ_RIDGE_AZIMUTH_MAX,
  THURISAZ_RIDGE_DISTANCE,
  THURISAZ_RIDGE_ELEVATION,
  THURISAZ_DISTANT_BOLT_HEIGHT,
  THURISAZ_DISTANT_THUNDER_DELAY_MIN,
  THURISAZ_DISTANT_THUNDER_DELAY_MAX,
  THURISAZ_DISTANT_VOLUME,
  THURISAZ_DISTANT_FILTER_FREQUENCY,
} from '../constants/effects.js';

// the slider allows up to this many distant bolts, one line and one sound each
const MAX_DISTANT = 7;

const random = THREE.MathUtils.randFloat;
const randomInt = THREE.MathUtils.randInt;

// lightning flicker: on, then `flickers` dips and returns, then fade out (value 0..1);
// `duration` stretches all of it (1 = the main bolt's length, about 0.4 s)
const addPulse = (timeline, pulse, at, { duration = 1, flickers = 1 } = {}) => {
  const keyframes = [{ value: 1, duration: 0.03 * duration }];
  for (let i = 0; i < flickers; i++) {
    keyframes.push(
      { value: random(0.1, 0.4), duration: random(0.04, 0.08) * duration },
      { value: random(0.7, 1), duration: 0.04 * duration },
    );
  }
  keyframes.push({ value: 0, duration: random(0.25, 0.4) * duration, ease: 'power2.out' });
  timeline.to(pulse, { keyframes }, at);
};

// Thurisaz (thunder): a bolt strikes the ship's mast with close thunder, then 1-3 smaller bolts along the
// (stand-in) ridge with muffled distant thunder. One GSAP timeline per strike times everything
export const createThurisaz = ({ uniforms, scene, camera, getSail, gui }) => {
  const params = {
    strikeIntensity: THURISAZ_STRIKE_LIGHT_INTENSITY,
    flash: THURISAZ_FLASH,
    closeDelay: THURISAZ_CLOSE_DELAY,
    closeVolume: THURISAZ_CLOSE_VOLUME,
    distantMin: THURISAZ_DISTANT_COUNT_MIN,
    distantMax: THURISAZ_DISTANT_COUNT_MAX,
    distantDelayMin: THURISAZ_DISTANT_DELAY_MIN,
    distantDelayMax: THURISAZ_DISTANT_DELAY_MAX,
    distantBrightness: THURISAZ_DISTANT_BRIGHTNESS,
    distantFlash: THURISAZ_DISTANT_FLASH,
    thunderDelayMin: THURISAZ_DISTANT_THUNDER_DELAY_MIN,
    thunderDelayMax: THURISAZ_DISTANT_THUNDER_DELAY_MAX,
    distantVolume: THURISAZ_DISTANT_VOLUME,
    filterFrequency: THURISAZ_DISTANT_FILTER_FREQUENCY,
    soundOffset: THURISAZ_SOUND_OFFSET,
    soundLength: THURISAZ_SOUND_LENGTH,
    soundFade: THURISAZ_SOUND_FADE,
    distantDuration: THURISAZ_DISTANT_DURATION,
    distantFlickers: THURISAZ_DISTANT_FLICKERS,
    jaggedness: THURISAZ_BOLT_JAGGEDNESS,
  };
  const boltOptions = () => ({ detail: THURISAZ_BOLT_DETAIL, jaggedness: params.jaggedness });

  // --- bolts and the strike light ---
  const main = { line: createBoltLine(THURISAZ_BOLT_COLOR, THURISAZ_BOLT_WIDTH), pulse: { value: 0 } };
  const distant = Array.from({ length: MAX_DISTANT }, () => ({
    line: createBoltLine(THURISAZ_BOLT_COLOR, THURISAZ_DISTANT_BOLT_WIDTH),
    pulse: { value: 0 },
  }));
  const strikeLight = new THREE.PointLight(THURISAZ_STRIKE_LIGHT_COLOR, 0, 0, 2);
  scene.add(main.line, ...distant.map((bolt) => bolt.line), strikeLight);

  // --- audio: one listener on the camera, one sound for the close thunder, one per distant bolt ---
  const listener = new THREE.AudioListener();
  camera.add(listener);
  const closeSound = new THREE.Audio(listener);
  const distantSounds = distant.map(() => {
    const sound = new THREE.Audio(listener);
    const filter = listener.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = params.filterFrequency;
    sound.setFilter(filter);
    return sound;
  });
  new THREE.AudioLoader().load(
    `${import.meta.env.BASE_URL}${THURISAZ_SOUND}`,
    (buffer) => [closeSound, ...distantSounds].forEach((sound) => sound.setBuffer(buffer)),
    undefined,
    (error) => console.error('Thurisaz: could not load the thunder sound', error),
  );
  const play = (sound, volume) => {
    if (!sound.buffer) return;
    if (sound.isPlaying) sound.stop();
    // skip the silence at the start of the file, stop after soundLength seconds
    sound.offset = params.soundOffset;
    sound.duration = params.soundLength;
    // full volume, then a linear fade to 0 over the last soundFade seconds (no click at the cut)
    const gain = sound.gain.gain;
    const now = sound.context.currentTime;
    const fade = Math.min(params.soundFade, params.soundLength);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(volume, now);
    gain.setValueAtTime(volume, now + params.soundLength - fade);
    gain.linearRampToValueAtTime(0, now + params.soundLength);
    sound.play();
  };

  // --- targets ---
  const sailBox = new THREE.Box3();
  // top centre of the sail's world bounding box = top of the mast (read at strike time: the ship rocks)
  const getMastTop = () => {
    const sail = getSail();
    if (!sail) return null;
    sail.updateWorldMatrix(true, false);
    sailBox.setFromObject(sail);
    const center = sailBox.getCenter(new THREE.Vector3());
    return new THREE.Vector3(center.x, sailBox.max.y, center.z);
  };
  // stand-in for the mountain ridge: a random point just above the horizon, far from the camera
  const getRidgePoint = () => {
    const azimuth = random(THURISAZ_RIDGE_AZIMUTH_MIN, THURISAZ_RIDGE_AZIMUTH_MAX);
    return sunDirectionFrom(azimuth, THURISAZ_RIDGE_ELEVATION)
      .multiplyScalar(THURISAZ_RIDGE_DISTANCE)
      .add(camera.position);
  };

  // every frame of a strike: bolt brightness, sky flash and strike light from the pulses
  const apply = () => {
    main.line.material.opacity = main.pulse.value;
    let flash = main.pulse.value * params.flash;
    for (const bolt of distant) {
      bolt.line.material.opacity = bolt.pulse.value * params.distantBrightness;
      flash += bolt.pulse.value * params.distantFlash;
    }
    uniforms.flashAmount.value = flash;
    strikeLight.intensity = main.pulse.value * params.strikeIntensity;
  };
  const reset = () => {
    for (const bolt of [main, ...distant]) {
      bolt.pulse.value = 0;
      bolt.line.visible = false;
    }
    apply();
  };

  let timeline = null;
  const trigger = () => {
    // browsers start audio suspended until the page has had input; a drawn rune counts
    if (listener.context.state === 'suspended') listener.context.resume();
    timeline?.kill();
    reset();
    timeline = gsap.timeline({ onUpdate: apply, onComplete: reset });

    // main bolt: from high above, slightly to the side, down to the mast top
    const mastTop = getMastTop();
    if (mastTop) {
      const start = mastTop.clone().add(new THREE.Vector3(
        random(-THURISAZ_BOLT_SPREAD, THURISAZ_BOLT_SPREAD),
        THURISAZ_BOLT_HEIGHT,
        random(-THURISAZ_BOLT_SPREAD, THURISAZ_BOLT_SPREAD),
      ));
      setBoltPath(main.line, start, mastTop, boltOptions());
      strikeLight.position.copy(mastTop);
      timeline.set(main.line, { visible: true }, 0);
      addPulse(timeline, main.pulse, 0);
      timeline.call(() => play(closeSound, params.closeVolume), null, random(0, params.closeDelay));
    } else {
      console.warn('Thurisaz: the ship (sail) has not loaded yet, only distant bolts');
    }

    // distant bolts along the ridge, each with its own muffled thunder later
    const count = randomInt(Math.min(params.distantMin, params.distantMax), Math.max(params.distantMin, params.distantMax));
    for (let i = 0; i < count; i++) {
      const bolt = distant[i];
      const target = getRidgePoint();
      const start = target.clone().add(new THREE.Vector3(
        random(-0.2, 0.2) * THURISAZ_DISTANT_BOLT_HEIGHT,
        THURISAZ_DISTANT_BOLT_HEIGHT,
        random(-0.2, 0.2) * THURISAZ_DISTANT_BOLT_HEIGHT,
      ));
      setBoltPath(bolt.line, start, target, boltOptions());
      const at = random(params.distantDelayMin, params.distantDelayMax);
      timeline.set(bolt.line, { visible: true }, at);
      addPulse(timeline, bolt.pulse, at, { duration: params.distantDuration, flickers: params.distantFlickers });
      const thunderAt = at + random(params.thunderDelayMin, params.thunderDelayMax);
      timeline.call(() => play(distantSounds[i], params.distantVolume), null, thunderAt);
    }
  };

  if (gui) {
    const colors = { strikeLight: `#${strikeLight.color.getHexString()}` };
    const folder = gui.addFolder('Thurisaz (thunder)');
    folder.add({ trigger }, 'trigger').name('trigger');
    folder.addColor(colors, 'strikeLight').name('strike light color').onChange((value) => strikeLight.color.set(value));
    folder.add(params, 'strikeIntensity', 0, 500, 1).name('strike light intensity');
    folder.add(params, 'flash', 0, 3, 0.01).name('sky flash');
    folder.add(params, 'jaggedness', 0, 0.4, 0.005).name('bolt jaggedness');
    folder.add(main.line.material, 'linewidth', 0.5, 15, 0.5).name('bolt width (px)');
    folder.add({ width: THURISAZ_DISTANT_BOLT_WIDTH }, 'width', 0.5, 15, 0.5).name('distant bolt width (px)')
      .onChange((value) => distant.forEach((bolt) => { bolt.line.material.linewidth = value; }));
    folder.add(params, 'soundOffset', 0, 2, 0.01).name('sound start offset (s)');
    folder.add(params, 'soundLength', 0.5, 20, 0.1).name('sound length (s)');
    folder.add(params, 'soundFade', 0, 5, 0.05).name('sound fade out (s)');
    folder.add(params, 'closeDelay', 0, 0.5, 0.01).name('close thunder delay (s)');
    folder.add(params, 'closeVolume', 0, 2, 0.01).name('close volume');
    folder.add(params, 'distantMin', 0, MAX_DISTANT, 1).name('distant bolts min');
    folder.add(params, 'distantMax', 0, MAX_DISTANT, 1).name('distant bolts max');
    folder.add(params, 'distantDelayMin', 0, 3, 0.05).name('distant delay min (s)');
    folder.add(params, 'distantDelayMax', 0, 3, 0.05).name('distant delay max (s)');
    folder.add(params, 'distantBrightness', 0, 1, 0.01).name('distant brightness');
    folder.add(params, 'distantFlash', 0, 3, 0.01).name('distant sky flash');
    folder.add(params, 'distantDuration', 0.5, 6, 0.1).name('distant duration (×)');
    folder.add(params, 'distantFlickers', 0, 6, 1).name('distant flickers');
    folder.add(params, 'thunderDelayMin', 0, 5, 0.05).name('distant thunder delay min (s)');
    folder.add(params, 'thunderDelayMax', 0, 5, 0.05).name('distant thunder delay max (s)');
    folder.add(params, 'distantVolume', 0, 2, 0.01).name('distant volume');
    folder.add(params, 'filterFrequency', 50, 5000, 10).name('distant low-pass (Hz)')
      .onChange((value) => distantSounds.forEach((sound) => { sound.getFilter().frequency.value = value; }));
  }

  return trigger;
};
