import gsap from 'gsap';

import { SOWILO_DAY_AMOUNT, SOWILO_RAMP_IN, SOWILO_HOLD, SOWILO_RAMP_OUT } from '../constants/effects.js';

// Sowilo (sun): a brief midnight sun. Only animates dayAmount; the sky, water and lighting follow it
export const createSowilo = ({ uniforms, gui }) => {
  const params = {
    dayAmount: SOWILO_DAY_AMOUNT,
    rampIn: SOWILO_RAMP_IN,
    hold: SOWILO_HOLD,
    rampOut: SOWILO_RAMP_OUT,
  };
  const day = uniforms.dayAmount;

  let timeline = null;
  const trigger = () => {
    // triggered while active: continue from the current value, only the remaining part of the ramp
    const remaining = Math.max(1 - day.value / params.dayAmount, 0);
    timeline?.kill();
    timeline = gsap.timeline()
      .to(day, { value: params.dayAmount, duration: params.rampIn * remaining, ease: 'sine.inOut' })
      .to(day, { value: 0, duration: params.rampOut, ease: 'sine.inOut', delay: params.hold });
  };

  if (gui) {
    const folder = gui.addFolder('Sowilo (sun)');
    folder.add({ trigger }, 'trigger').name('trigger');
    folder.add(params, 'dayAmount', 0, 1, 0.01).name('day amount');
    folder.add(params, 'rampIn', 0.1, 5, 0.05).name('ramp in (s)');
    folder.add(params, 'hold', 0, 10, 0.1).name('hold (s)');
    folder.add(params, 'rampOut', 0.1, 10, 0.05).name('ramp out (s)');
  }

  return trigger;
};
