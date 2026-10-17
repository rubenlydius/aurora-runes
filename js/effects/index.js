import { createRuneLabel } from './runeLabel.js';
import { createSowilo } from './sowilo.js';

// connects recognised gestures to effects: js/gestures/gestureInput.js dispatches a "gesture" event
// (detail { name, score }) on every match, this looks up the effect by name (case-insensitive).
// new effect: write js/effects/<rune>.js returning a trigger function, add it to `effects` below
export const createEffects = ({ uniforms, gui }) => {
  const label = createRuneLabel({ gui });

  const effects = {
    sowilo: createSowilo({ uniforms, gui }),
  };

  window.addEventListener('gesture', (event) => {
    const { name } = event.detail;
    // feedback on any match, also for names without an effect yet
    label.show(name);
    // unknown names are ignored
    effects[name.toLowerCase()]?.(event.detail);
  });
};
