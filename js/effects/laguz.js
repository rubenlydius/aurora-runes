import * as THREE from 'three/webgpu';
import gsap from 'gsap';

import {
  LAGUZ_SOUND,
  LAGUZ_VOLUME,
  LAGUZ_WAVE_HEIGHT,
  LAGUZ_RIPPLE_STRENGTH,
  LAGUZ_RIPPLE_SPEED,
  LAGUZ_AURORA_SPEED,
  LAGUZ_RAMP_IN,
  LAGUZ_HOLD,
  LAGUZ_RAMP_OUT,
} from '../constants/effects.js';

const lerp = THREE.MathUtils.lerp;

// Laguz (water): "the fjord comes alive". A swell rolls in (real waves, js/shaders/water/swell.wgsl), the ship
// rides it and settles as it calms, ripples and aurora speed up, waves sound along. One GSAP timeline times it
export const createLaguz = ({ uniforms, water, listener, gui }) => {
  const params = {
    volume: LAGUZ_VOLUME,
    waveHeight: LAGUZ_WAVE_HEIGHT,
    rippleStrength: LAGUZ_RIPPLE_STRENGTH,
    rippleSpeed: LAGUZ_RIPPLE_SPEED,
    auroraSpeed: LAGUZ_AURORA_SPEED,
    rampIn: LAGUZ_RAMP_IN,
    hold: LAGUZ_HOLD,
    rampOut: LAGUZ_RAMP_OUT,
  };

  const sound = new THREE.Audio(listener);
  sound.setLoop(true);
  new THREE.AudioLoader().load(
    `${import.meta.env.BASE_URL}${LAGUZ_SOUND}`,
    (buffer) => sound.setBuffer(buffer),
    undefined,
    (error) => console.error('Laguz: could not load the waves sound', error),
  );

  // the normal values to return to, read when the effect starts from calm water (so debug tweaks are kept)
  const calm = { waveHeight: 0, rippleStrength: 0, rippleSpeed: 0, auroraSpeed: 1 };
  const readCalm = () => {
    calm.waveHeight = water.waves.height.value;
    calm.rippleStrength = water.ripple.strength.value;
    calm.rippleSpeed = water.ripple.speed.value;
    calm.auroraSpeed = uniforms.auroraSpeed.value;
  };

  // 0 = calm, 1 = full swell
  const state = { swell: 0 };
  const apply = () => {
    const s = state.swell;
    water.waves.height.value = lerp(calm.waveHeight, params.waveHeight, s);
    water.ripple.strength.value = lerp(calm.rippleStrength, calm.rippleStrength * params.rippleStrength, s);
    water.ripple.speed.value = lerp(calm.rippleSpeed, calm.rippleSpeed * params.rippleSpeed, s);
    uniforms.auroraSpeed.value = lerp(calm.auroraSpeed, calm.auroraSpeed * params.auroraSpeed, s);
    // Isa's ice holding the water (waves.freeze > 0, from the moment the freeze starts until the thaw ends)
    // silences the waves: the ice sound takes over. setVolume eases over ~10 ms, so the cut doesn't click
    const frozen = water.waves.freeze.value > 0;
    sound.setVolume(frozen ? 0 : params.volume * s);
  };

  let timeline = null;
  const trigger = () => {
    if (listener.context.state === 'suspended') listener.context.resume();
    if (state.swell === 0) readCalm();
    // retriggered: continue from the current swell, only the remaining part of the rise
    timeline?.kill();
    timeline = gsap.timeline({
      onUpdate: apply,
      onComplete: () => {
        if (sound.isPlaying) sound.stop();
      },
    });
    timeline
      .to(state, { swell: 1, duration: params.rampIn * (1 - state.swell), ease: 'sine.inOut' })
      .to(state, { swell: 0, duration: params.rampOut, ease: 'sine.inOut' }, `>${params.hold}`);
    if (sound.buffer && !sound.isPlaying) sound.play();
  };

  if (gui) {
    const folder = gui.addFolder('Laguz (water)');
    folder.add({ trigger }, 'trigger').name('trigger');
    folder.add(params, 'waveHeight', 0, 3, 0.01).name('wave height');
    folder.add(params, 'rippleStrength', 1, 10, 0.1).name('ripple strength (×)');
    folder.add(params, 'rippleSpeed', 1, 10, 0.1).name('ripple speed (×)');
    folder.add(params, 'auroraSpeed', 1, 10, 0.1).name('aurora speed (×)');
    folder.add(params, 'rampIn', 0.1, 5, 0.05).name('ramp in (s)');
    folder.add(params, 'hold', 0, 10, 0.1).name('hold (s)');
    folder.add(params, 'rampOut', 0.1, 10, 0.05).name('ramp out (s)');
    folder.add(params, 'volume', 0, 2, 0.01);
  }

  return trigger;
};
