import * as THREE from 'three/webgpu';
import gsap from 'gsap';

import {
  DAGAZ_INTENSITY,
  DAGAZ_HUE_SHIFT,
  DAGAZ_SPEED,
  DAGAZ_PULSE_COUNT,
  DAGAZ_PULSE_STRENGTH,
  DAGAZ_RAMP_IN,
  DAGAZ_HOLD,
  DAGAZ_RAMP_OUT,
  DAGAZ_LIGHT_FOLLOW,
  DAGAZ_LIGHT_HUE,
} from '../constants/effects.js';

const lerp = THREE.MathUtils.lerp;
const random = THREE.MathUtils.randFloat;

// Dagaz (day / awakening): "the sky awakens". A strong aurora surge: the aurora brightens, its colors turn
// toward pink and violet, the curtains race (auroraSpeed, on accumulated time so it never jumps), it dances in
// a few irregular pulses at the peak, then settles. The key light follows it. One GSAP timeline
export const createDagaz = ({ uniforms, lighting, gui }) => {
  const params = {
    intensity: DAGAZ_INTENSITY,
    hueShift: DAGAZ_HUE_SHIFT,
    speed: DAGAZ_SPEED,
    pulseCount: DAGAZ_PULSE_COUNT,
    pulseStrength: DAGAZ_PULSE_STRENGTH,
    rampIn: DAGAZ_RAMP_IN,
    hold: DAGAZ_HOLD,
    rampOut: DAGAZ_RAMP_OUT,
    lightFollow: DAGAZ_LIGHT_FOLLOW,
    lightHue: DAGAZ_LIGHT_HUE,
  };

  // --- sound hooks: no audio yet. Add sounds here later, the timeline already calls these ---
  const hooks = {
    // the build-up starts
    onSurgeStart: () => {},
    // the peak is reached, the pulses begin
    onSurgePeak: () => {},
    // the hold is over, the aurora starts settling back
    onSurgeEnd: () => {},
  };

  // surge: 0 = calm, 1 = peak; pulse: extra brightness on top of the peak (fraction of it)
  const state = { surge: 0, pulse: 0 };
  // the aurora speed to return to, read when the effect starts from calm (so other effects' and debug changes stay)
  let calmSpeed = 1;
  const apply = () => {
    const intensity = lerp(1, params.intensity, state.surge) * (1 + state.pulse);
    uniforms.auroraIntensity.value = intensity;
    uniforms.auroraHueShift.value = params.hueShift * state.surge;
    uniforms.auroraSpeed.value = lerp(calmSpeed, params.speed, state.surge);
    // the key light: brighter by part of the aurora's extra brightness, hue turned along with it
    lighting.adjust.keyScale = 1 + (intensity - 1) * params.lightFollow;
    lighting.adjust.keyHue = uniforms.auroraHueShift.value * params.lightHue;
  };

  let timeline = null;
  const trigger = () => {
    if (state.surge === 0) calmSpeed = uniforms.auroraSpeed.value;
    // retriggered: continue from the current surge, only the remaining part of the build-up
    timeline?.kill();
    const rampIn = params.rampIn * (1 - state.surge);
    timeline = gsap.timeline({ onUpdate: apply });
    timeline
      .call(hooks.onSurgeStart, null, 0)
      .to(state, { surge: 1, duration: rampIn, ease: 'sine.inOut' }, 0)
      // any pulse left over from a retrigger settles while it builds up again
      .to(state, { pulse: 0, duration: Math.max(rampIn, 0.2), ease: 'sine.out' }, 0)
      .call(hooks.onSurgePeak, null, rampIn);

    // the dance: irregular pulses spread over the hold, each a quick flare and a slower fade, at random
    // strengths and with random gaps (keyframes run one after another, their durations add up to the hold)
    const count = Math.max(Math.round(params.pulseCount), 0);
    if (count > 0 && params.hold > 0) {
      const slot = params.hold / count;
      const keyframes = [];
      for (let i = 0; i < count; i++) {
        const rise = slot * random(0.15, 0.3);
        const fall = slot * random(0.35, 0.55);
        keyframes.push(
          { pulse: params.pulseStrength * random(0.4, 1), duration: rise, ease: 'sine.out' },
          { pulse: params.pulseStrength * random(0, 0.15), duration: fall, ease: 'sine.inOut' },
          // a short still moment before the next one (the rest of this pulse's slot)
          { pulse: 0, duration: slot - rise - fall, ease: 'sine.inOut' },
        );
      }
      timeline.to(state, { keyframes }, rampIn);
    }

    timeline
      .call(hooks.onSurgeEnd, null, rampIn + params.hold)
      .to(state, { surge: 0, pulse: 0, duration: params.rampOut, ease: 'sine.inOut' }, rampIn + params.hold);
  };

  if (gui) {
    const folder = gui.addFolder('Dagaz (aurora surge)');
    folder.add({ trigger }, 'trigger').name('trigger');
    // live values (listen: they follow the surge), and peak settings
    folder.add(uniforms.auroraIntensity, 'value', 0, 6, 0.01).name('aurora intensity').listen();
    folder.add(uniforms.auroraHueShift, 'value', 0, 2, 0.01).name('aurora hue shift').listen();
    folder.add(params, 'intensity', 1, 6, 0.05).name('peak intensity');
    folder.add(params, 'hueShift', 0, 1.5, 0.01).name('peak hue shift');
    folder.add(params, 'speed', 0, 10, 0.1).name('peak speed');
    folder.add(params, 'pulseCount', 0, 12, 1).name('pulse count');
    folder.add(params, 'pulseStrength', 0, 2, 0.01).name('pulse strength');
    folder.add(params, 'rampIn', 0.1, 10, 0.1).name('build up (s)');
    folder.add(params, 'hold', 0, 15, 0.1).name('hold (s)');
    folder.add(params, 'rampOut', 0.1, 15, 0.1).name('ease back (s)');
    folder.add(params, 'lightFollow', 0, 1, 0.01).name('key light follow');
    folder.add(params, 'lightHue', 0, 1, 0.01).name('key light hue');
  }

  return trigger;
};
