import * as THREE from 'three/webgpu';

import {
  KEY_LIGHT_POSITION,
  KEY_LIGHT_INTENSITY,
  KEY_LIGHT_PULSE_AMOUNT,
  KEY_LIGHT_PULSE_SPEED,
  HEMI_SKY_COLOR,
  HEMI_GROUND_COLOR,
  HEMI_INTENSITY,
  FOG_COLOR,
  FOG_DENSITY,
} from '../constants/lighting.js';

// night lighting: aurora key light, dim fill light and fog (no shadows)
export const createLighting = ({ auroraColor, exposure, gui }) => {
  const params = {
    keyIntensity: KEY_LIGHT_INTENSITY,
    pulseAmount: KEY_LIGHT_PULSE_AMOUNT,
    pulseSpeed: KEY_LIGHT_PULSE_SPEED,
  };

  const keyLight = new THREE.DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
  // share the uniform's Color object, so changing auroraColor also recolors the light
  keyLight.color = auroraColor.value;
  // shines from here toward its target, the origin
  keyLight.position.set(KEY_LIGHT_POSITION.x, KEY_LIGHT_POSITION.y, KEY_LIGHT_POSITION.z);

  const hemiLight = new THREE.HemisphereLight(HEMI_SKY_COLOR, HEMI_GROUND_COLOR, HEMI_INTENSITY);

  const fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

  const update = (time) => {
    keyLight.intensity = params.keyIntensity * (1 + params.pulseAmount * Math.sin(time * params.pulseSpeed));
  };

  if (gui) {
    // lil-gui shows colors as sRGB hex strings, Color.set() converts them back to linear
    const colors = {
      aurora: `#${auroraColor.value.getHexString()}`,
      hemiSky: `#${hemiLight.color.getHexString()}`,
      hemiGround: `#${hemiLight.groundColor.getHexString()}`,
      fog: `#${fog.color.getHexString()}`,
    };

    const folder = gui.addFolder('Lighting');
    folder.addColor(colors, 'aurora').name('aurora color').onChange((value) => auroraColor.value.set(value));
    folder.add(params, 'keyIntensity', 0, 10, 0.05).name('key intensity');
    folder.add(params, 'pulseAmount', 0, 1, 0.01).name('pulse amount');
    folder.add(params, 'pulseSpeed', 0, 3, 0.01).name('pulse speed');
    folder.add(keyLight.position, 'x', -100, 100, 1).name('key position x');
    folder.add(keyLight.position, 'y', 0, 100, 1).name('key position y');
    folder.add(keyLight.position, 'z', -150, 50, 1).name('key position z');
    folder.addColor(colors, 'hemiSky').name('fill sky color').onChange((value) => hemiLight.color.set(value));
    folder.addColor(colors, 'hemiGround').name('fill ground color').onChange((value) => hemiLight.groundColor.set(value));
    folder.add(hemiLight, 'intensity', 0, 3, 0.01).name('fill intensity');
    folder.add(exposure, 'value', 0, 4, 0.01).name('exposure (lit only)');
    folder.addColor(colors, 'fog').name('fog color').onChange((value) => fog.color.set(value));
    folder.add(fog, 'density', 0, 0.05, 0.0005).name('fog density');
  }

  return { lights: [keyLight, hemiLight], fog, update };
};
