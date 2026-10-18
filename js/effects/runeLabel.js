import gsap from 'gsap';

import { RUNE_LABEL_FADE_IN, RUNE_LABEL_HOLD, RUNE_LABEL_FADE_OUT, RUNE_LABEL_OPACITY } from '../constants/effects.js';

// subtle rune name near the top of the screen, fades in and out on each match
export const createRuneLabel = ({ gui }) => {
  const params = {
    fadeIn: RUNE_LABEL_FADE_IN,
    hold: RUNE_LABEL_HOLD,
    fadeOut: RUNE_LABEL_FADE_OUT,
    opacity: RUNE_LABEL_OPACITY,
  };

  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'fixed',
    top: '12%',
    left: '50%',
    transform: 'translateX(-50%)',
    font: '300 1.6rem/1 Georgia, serif',
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
    color: '#e8f4ff',
    textShadow: '0 0 12px rgba(150, 230, 210, 0.5)',
    opacity: 0,
    pointerEvents: 'none',
    userSelect: 'none',
  });
  document.body.appendChild(label);

  let timeline = null;
  const show = (name) => {
    label.textContent = name;
    // a new match restarts from the current opacity, no jump
    timeline?.kill();
    timeline = gsap.timeline()
      .to(label, { opacity: params.opacity, duration: params.fadeIn, ease: 'sine.out' })
      .to(label, { opacity: 0, duration: params.fadeOut, ease: 'sine.in', delay: params.hold });
  };

  if (gui) {
    const folder = gui.addFolder('Rune label');
    folder.add(params, 'fadeIn', 0, 3, 0.05).name('fade in (s)');
    folder.add(params, 'hold', 0, 5, 0.05).name('hold (s)');
    folder.add(params, 'fadeOut', 0, 3, 0.05).name('fade out (s)');
    folder.add(params, 'opacity', 0, 1, 0.01);
  }

  return { show };
};
