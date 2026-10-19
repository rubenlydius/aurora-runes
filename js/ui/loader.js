import * as THREE from 'three/webgpu';

import { AURORA_COLOR } from '../constants/lighting.js';
import { LOADER_MIN_TIME } from '../constants/loader.js';

// the full-screen Vegvísir overlay from index.html, styled in css/style.css
export const createLoader = () => {
  const $loader = document.querySelector('.loader');
  // the CSS glow uses the same green as the aurora light
  document.documentElement.style.setProperty('--aurora-green', `#${AURORA_COLOR.toString(16).padStart(6, '0')}`);

  // every three.js loader without a manager of its own (GLTF models, AudioLoader sounds) reports to the
  // default one: onLoad fires once all files that started have finished (or failed)
  const assetsLoaded = new Promise((resolve) => {
    THREE.DefaultLoadingManager.onLoad = resolve;
  });

  // fades out after the minimum time, then leaves the DOM
  const hide = async () => {
    const remaining = LOADER_MIN_TIME - performance.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    $loader.addEventListener('transitionend', () => $loader.remove(), { once: true });
    $loader.classList.add('loader--hidden');
  };

  // no WebGPU: the overlay stays, the spin stops and a message explains why
  const showUnsupported = () => {
    $loader.classList.add('loader--unsupported');
    const $message = document.createElement('p');
    $message.className = 'loader__message';
    $message.textContent = 'This experience needs WebGPU. Open it in a recent version of Chrome or Edge.';
    $loader.appendChild($message);
  };

  return { assetsLoaded, hide, showUnsupported };
};
