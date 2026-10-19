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
  DAGAZ_HEARTBEAT_SOUND,
  DAGAZ_HEARTBEAT_VOLUME,
  DAGAZ_HEARTBEAT_OFFSET,
} from '../constants/effects.js';

const lerp = THREE.MathUtils.lerp;
const random = THREE.MathUtils.randFloat;

// beat detection: the sound's loudness is measured in 5 ms windows; a beat starts where a window gets louder
// than BEAT_THRESHOLD of the loudest one, and the next can't start within BEAT_GAP seconds (so one thump
// counts once)
const BEAT_WINDOW = 0.005;
const BEAT_THRESHOLD = 0.75;
const BEAT_GAP = 0.15;
// a pulse: flares up in PULSE_RISE seconds, then fades until just before the next beat (at most PULSE_FALL)
const PULSE_RISE = 0.06;
const PULSE_FALL = 0.6;

// the beats in a decoded sound: [{ time (s), strength (0..1, its loudness compared to the loudest beat) }]
const findBeats = (buffer) => {
  const data = buffer.getChannelData(0);
  const size = Math.round(buffer.sampleRate * BEAT_WINDOW);
  const peaks = [];
  for (let start = 0; start < data.length; start += size) {
    let peak = 0;
    for (let i = start; i < Math.min(start + size, data.length); i++) peak = Math.max(peak, Math.abs(data[i]));
    peaks.push(peak);
  }
  const loudest = Math.max(...peaks);
  const beats = [];
  let last = -Infinity;
  peaks.forEach((peak, index) => {
    const time = index * BEAT_WINDOW;
    if (peak < loudest * BEAT_THRESHOLD || time - last < BEAT_GAP) return;
    last = time;
    // the thump's loudness: the loudest window in its first 50 ms
    const thump = Math.max(...peaks.slice(index, index + 10));
    beats.push({ time, strength: thump / loudest });
  });
  return beats;
};

// Dagaz (day / awakening): "the sky awakens". A strong aurora surge: the aurora brightens, its colors turn
// toward pink and violet, the curtains race (auroraSpeed, on accumulated time so it never jumps), and it pulses
// with a heartbeat: every beat in the sound is a flare of the aurora at the moment it's heard. Then it settles.
// The key light follows it. One GSAP timeline
export const createDagaz = ({ uniforms, lighting, listener, gui }) => {
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
    volume: DAGAZ_HEARTBEAT_VOLUME,
    offset: DAGAZ_HEARTBEAT_OFFSET,
  };

  // --- heartbeat sound, and its beats (found once it's loaded) ---
  const heartbeat = new THREE.Audio(listener);
  let beats = null;
  new THREE.AudioLoader().load(
    `${import.meta.env.BASE_URL}${DAGAZ_HEARTBEAT_SOUND}`,
    (buffer) => {
      heartbeat.setBuffer(buffer);
      beats = findBeats(buffer);
    },
    undefined,
    (error) => console.error('Dagaz: could not load the heartbeat sound', error),
  );

  // --- sound hooks, the timeline calls these ---
  const hooks = {
    // the build-up starts
    onSurgeStart: () => {},
    // the peak is reached: the heartbeat starts (offset seconds into the file), the pulses follow its beats
    onSurgePeak: () => {
      if (!heartbeat.buffer) return;
      if (heartbeat.isPlaying) heartbeat.stop();
      const gain = heartbeat.gain.gain;
      gain.cancelScheduledValues(heartbeat.context.currentTime);
      gain.setValueAtTime(params.volume, heartbeat.context.currentTime);
      heartbeat.offset = params.offset;
      heartbeat.play();
    },
    // the hold is over, the aurora starts settling back: the heartbeat fades out with it
    onSurgeEnd: () => {
      if (!heartbeat.isPlaying) return;
      const gain = heartbeat.gain.gain;
      const now = heartbeat.context.currentTime;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + params.rampOut);
    },
  };

  // surge: 0 = calm, 1 = peak; pulse: extra brightness on top of the peak (fraction of it)
  const state = { surge: 0, pulse: 0 };
  // the aurora speed to return to, read when the effect starts from calm (so other effects' and debug changes stay)
  let calmSpeed = 1;
  const apply = () => {
    // the pulses shrink as the surge settles (state.surge), along with the fading heartbeat
    const intensity = lerp(1, params.intensity, state.surge) * (1 + state.pulse * state.surge);
    uniforms.auroraIntensity.value = intensity;
    uniforms.auroraHueShift.value = params.hueShift * state.surge;
    uniforms.auroraSpeed.value = lerp(calmSpeed, params.speed, state.surge);
    // the key light: brighter by part of the aurora's extra brightness, hue turned along with it
    lighting.adjust.keyScale = 1 + (intensity - 1) * params.lightFollow;
    lighting.adjust.keyHue = uniforms.auroraHueShift.value * params.lightHue;
  };

  // one pulse per beat the listener will hear between `from` and `until` (timeline seconds), with the sound
  // starting at `from`, `offset` seconds into the file. Each fades out just before the next beat starts, so
  // two pulses never fight over state.pulse
  const addBeatPulses = (timeline, from, until) => {
    const heard = beats
      .map((beat) => ({ at: from + beat.time - params.offset, strength: beat.strength }))
      .filter((beat) => beat.at >= from && beat.at < until);
    heard.forEach((beat, index) => {
      const next = heard[index + 1]?.at ?? Infinity;
      const fall = Math.min(PULSE_FALL, next - beat.at - PULSE_RISE - 0.01);
      timeline
        .to(state, { pulse: params.pulseStrength * beat.strength, duration: PULSE_RISE, ease: 'sine.out' }, beat.at)
        .to(state, { pulse: 0, duration: Math.max(fall, 0.02), ease: 'sine.in' }, beat.at + PULSE_RISE);
    });
  };

  // without the sound: irregular pulses spread over the hold, each a quick flare and a slower fade, at random
  // strengths and with random gaps (keyframes run one after another, their durations add up to the hold)
  const addRandomPulses = (timeline, from) => {
    const count = Math.max(Math.round(params.pulseCount), 0);
    if (count === 0 || params.hold <= 0) return;
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
    timeline.to(state, { keyframes }, from);
  };

  let timeline = null;
  const trigger = () => {
    if (listener.context.state === 'suspended') listener.context.resume();
    if (state.surge === 0) calmSpeed = uniforms.auroraSpeed.value;
    // retriggered: continue from the current surge, only the remaining part of the build-up
    timeline?.kill();
    const rampIn = params.rampIn * (1 - state.surge);
    const settle = rampIn + params.hold;
    timeline = gsap.timeline({
      onUpdate: apply,
      onComplete: () => {
        if (heartbeat.isPlaying) heartbeat.stop();
      },
    });
    timeline
      .call(hooks.onSurgeStart, null, 0)
      .to(state, { surge: 1, duration: rampIn, ease: 'sine.inOut' }, 0)
      // any pulse left over from a retrigger settles while it builds up again
      .to(state, { pulse: 0, duration: Math.max(rampIn, 0.2), ease: 'sine.out' }, 0)
      .call(hooks.onSurgePeak, null, rampIn);

    // the dance: on the heartbeat (from the peak until the aurora has settled), or random without the sound
    if (beats && heartbeat.buffer) addBeatPulses(timeline, rampIn, settle + params.rampOut);
    else addRandomPulses(timeline, rampIn);

    timeline
      .call(hooks.onSurgeEnd, null, settle)
      .to(state, { surge: 0, duration: params.rampOut, ease: 'sine.inOut' }, settle);
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
    folder.add(params, 'pulseCount', 0, 12, 1).name('pulse count (no sound)');
    folder.add(params, 'pulseStrength', 0, 2, 0.01).name('pulse strength');
    folder.add(params, 'rampIn', 0.1, 10, 0.1).name('build up (s)');
    folder.add(params, 'hold', 0, 15, 0.1).name('hold (s)');
    folder.add(params, 'rampOut', 0.1, 15, 0.1).name('ease back (s)');
    folder.add(params, 'lightFollow', 0, 1, 0.01).name('key light follow');
    folder.add(params, 'lightHue', 0, 1, 0.01).name('key light hue');
    folder.add(params, 'offset', 0, 15, 0.01).name('heartbeat offset (s)');
    folder.add(params, 'volume', 0, 2, 0.01).name('heartbeat volume');
  }

  return trigger;
};
