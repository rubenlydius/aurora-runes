import * as THREE from 'three/webgpu';

import { createRuneLabel } from './runeLabel.js';
import { createSowilo } from './sowilo.js';
import { createThurisaz } from './thurisaz.js';
import { createLaguz } from './laguz.js';
import { createKenaz } from './kenaz.js';
import { createHagalaz } from './hagalaz.js';
import { createGebo } from './gebo.js';
import { createIsa } from './isa.js';
import { createDagaz } from './dagaz.js';
import { createTiwaz } from './tiwaz.js';

// connects recognised gestures to effects: js/gestures/gestureInput.js dispatches a "gesture" event
// (detail { name, score }) on every match, this looks up the effect by name (case-insensitive).
// new effect: write js/effects/<rune>.js returning a trigger function, add it to `effects` below.
// returns state the render loop reads: shipFreeze (Isa holds the ship still), auroraFreeze (Isa stops the aurora),
// and the shared audio listener (the rune menu's mute-all)
export const createEffects = ({ uniforms, scene, camera, water, lighting, getShip, getSail, physics, gui }) => {
  const label = createRuneLabel({ gui });
  // one audio listener on the camera for all effect sounds
  const listener = new THREE.AudioListener();
  camera.add(listener);

  const effects = {
    sowilo: createSowilo({ uniforms, gui }),
    thurisaz: createThurisaz({ uniforms, scene, camera, listener, getSail, gui }),
    laguz: createLaguz({ uniforms, water, listener, gui }),
    kenaz: createKenaz({ uniforms, scene, camera, listener, getSail, gui }),
    hagalaz: createHagalaz({ uniforms, scene, camera, water, physics, listener, gui }),
    gebo: createGebo({ uniforms, camera, scene, gui }),
    dagaz: createDagaz({ uniforms, lighting, listener, gui }),
    tiwaz: createTiwaz({ uniforms, scene, camera, lighting, listener, gui }),
  };
  // Isa also hands back the ship's freeze state
  const isa = createIsa({ uniforms, water, lighting, getShip, listener, gui });
  effects.isa = isa.trigger;

  window.addEventListener('gesture', (event) => {
    const { name } = event.detail;
    // feedback on any match, also for names without an effect yet
    label.show(name);
    // unknown names are ignored
    effects[name.toLowerCase()]?.(event.detail);
  });

  return { shipFreeze: isa.shipFreeze, auroraFreeze: isa.auroraFreeze, listener };
};
