import * as THREE from 'three/webgpu';

import {
  KEY_LIGHT_POSITION,
  KEY_LIGHT_INTENSITY,
  KEY_LIGHT_PULSE_AMOUNT,
  KEY_LIGHT_PULSE_SPEED,
  KEY_LIGHT_FLASH_INTENSITY,
  HEMI_SKY_COLOR,
  HEMI_GROUND_COLOR,
  HEMI_INTENSITY,
  FOG_COLOR,
  FOG_DENSITY,
} from '../constants/lighting.js';
import {
  SUN_AZIMUTH,
  SUN_ELEVATION,
  DAWN_HORIZON_COLOR,
  SUN_LIGHT_COLOR,
  SUN_LIGHT_INTENSITY,
  DAY_HEMI_SKY_COLOR,
  DAY_HEMI_INTENSITY,
} from '../constants/day.js';

// distance of the sun light from the origin, along sunDirection (only the direction matters)
const SUN_LIGHT_DISTANCE = 50;

// azimuth / elevation in degrees -> unit direction, azimuth 0 = -z, 90 = +x
export const sunDirectionFrom = (azimuth, elevation, target = new THREE.Vector3()) => {
  const az = THREE.MathUtils.degToRad(azimuth);
  const el = THREE.MathUtils.degToRad(elevation);
  return target.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
};

// the sky shader uses the dawn colors as-is (sRGB values), so store them without linear conversion
const rawColor = (value) => new THREE.Color().setStyle(value, THREE.LinearSRGBColorSpace);
const rawHex = (color) => `#${color.getHexString(THREE.LinearSRGBColorSpace)}`;
export const rawColorFromHex = (hex) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

// night lighting: aurora key light, dim fill light and fog (no shadows),
// plus the midnight sun: a warm sun light, fill and fog that follow dayAmount
export const createLighting = ({ auroraColor, exposure, skyBrightness, dayAmount, sunDirection, dawnHorizonColor, dawnZenithColor, sunGlowSize, flashAmount, gui }) => {
  const params = {
    keyIntensity: KEY_LIGHT_INTENSITY,
    pulseAmount: KEY_LIGHT_PULSE_AMOUNT,
    pulseSpeed: KEY_LIGHT_PULSE_SPEED,
    keyFlash: KEY_LIGHT_FLASH_INTENSITY,
    hemiIntensity: HEMI_INTENSITY,
    sunAzimuth: SUN_AZIMUTH,
    sunElevation: SUN_ELEVATION,
    sunIntensity: SUN_LIGHT_INTENSITY,
    dayHemiIntensity: DAY_HEMI_INTENSITY,
  };
  // night and day values the fill light and fog blend between
  const blend = {
    hemiSky: new THREE.Color(HEMI_SKY_COLOR),
    dayHemiSky: new THREE.Color(DAY_HEMI_SKY_COLOR),
    fog: new THREE.Color(FOG_COLOR),
    // the horizon color as a linear Color, so the fog matches the sky shader's (converted) horizon
    dayFog: new THREE.Color(DAWN_HORIZON_COLOR),
  };

  const keyLight = new THREE.DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
  // share the uniform's Color object, so changing auroraColor also recolors the light
  keyLight.color = auroraColor.value;
  // shines from here toward its target, the origin
  keyLight.position.set(KEY_LIGHT_POSITION.x, KEY_LIGHT_POSITION.y, KEY_LIGHT_POSITION.z);

  const hemiLight = new THREE.HemisphereLight(HEMI_SKY_COLOR, HEMI_GROUND_COLOR, HEMI_INTENSITY);

  // midnight sun: off at night, its intensity follows dayAmount
  const sunLight = new THREE.DirectionalLight(SUN_LIGHT_COLOR, 0);
  sunDirectionFrom(params.sunAzimuth, params.sunElevation, sunDirection.value);

  const fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

  // set by rune effects: a tint multiplied onto the key light's aurora color (white = unchanged, Isa), a hue
  // offset on that color (fraction of the color wheel, 0 = unchanged, Dagaz), a multiplier on the key light's
  // intensity (1 = unchanged, Dagaz) and on the fill light's (1 = unchanged, Isa). The key light gets its own
  // Color for this, so tinting it doesn't recolor the aurora uniform it used to share
  const adjust = { keyTint: new THREE.Color(1, 1, 1), keyHue: 0, keyScale: 1, hemiScale: 1 };
  keyLight.color = new THREE.Color();

  const update = (time) => {
    keyLight.color.copy(auroraColor.value).multiply(adjust.keyTint);
    // skipped at 0: the HSL round trip would change the color by a tiny rounding error
    if (adjust.keyHue !== 0) keyLight.color.offsetHSL(adjust.keyHue, 0, 0);
    // the key light is the aurora's light, so it dims with the sky (skyBrightness, 1 = normal; Hagalaz darkens it)
    keyLight.intensity = params.keyIntensity * skyBrightness.value * (1 + params.pulseAmount * Math.sin(time * params.pulseSpeed))
      // lightning flash, flashAmount is animated by the Thurisaz timeline
      + params.keyFlash * flashAmount.value;
    keyLight.intensity *= adjust.keyScale;

    const day = dayAmount.value;
    sunLight.position.copy(sunDirection.value).multiplyScalar(SUN_LIGHT_DISTANCE);
    sunLight.intensity = params.sunIntensity * day;
    hemiLight.color.lerpColors(blend.hemiSky, blend.dayHemiSky, day);
    hemiLight.intensity = THREE.MathUtils.lerp(params.hemiIntensity, params.dayHemiIntensity, day) * adjust.hemiScale;
    // distant fog takes on the horizon color, so it doesn't stay a dark band against the bright sky
    fog.color.lerpColors(blend.fog, blend.dayFog, day);
  };

  if (gui) {
    // lil-gui shows colors as sRGB hex strings, Color.set() converts them back to linear
    const colors = {
      aurora: `#${auroraColor.value.getHexString()}`,
      hemiSky: `#${blend.hemiSky.getHexString()}`,
      hemiGround: `#${hemiLight.groundColor.getHexString()}`,
      fog: `#${blend.fog.getHexString()}`,
      dawnHorizon: rawHex(dawnHorizonColor.value),
      dawnZenith: rawHex(dawnZenithColor.value),
      sunLight: `#${sunLight.color.getHexString()}`,
      dayHemiSky: `#${blend.dayHemiSky.getHexString()}`,
    };

    const folder = gui.addFolder('Lighting');
    folder.addColor(colors, 'aurora').name('aurora color').onChange((value) => auroraColor.value.set(value));
    folder.add(params, 'keyIntensity', 0, 10, 0.05).name('key intensity');
    folder.add(params, 'pulseAmount', 0, 1, 0.01).name('pulse amount');
    folder.add(params, 'pulseSpeed', 0, 3, 0.01).name('pulse speed');
    folder.add(params, 'keyFlash', 0, 30, 0.1).name('key flash intensity');
    folder.add(keyLight.position, 'x', -100, 100, 1).name('key position x');
    folder.add(keyLight.position, 'y', 0, 100, 1).name('key position y');
    folder.add(keyLight.position, 'z', -150, 50, 1).name('key position z');
    folder.addColor(colors, 'hemiSky').name('fill sky color').onChange((value) => blend.hemiSky.set(value));
    folder.addColor(colors, 'hemiGround').name('fill ground color').onChange((value) => hemiLight.groundColor.set(value));
    folder.add(params, 'hemiIntensity', 0, 3, 0.01).name('fill intensity');
    folder.add(exposure, 'value', 0, 4, 0.01).name('exposure (lit only)');
    folder.addColor(colors, 'fog').name('fog color').onChange((value) => blend.fog.set(value));
    folder.add(fog, 'density', 0, 0.05, 0.0005).name('fog density');

    const updateSunDirection = () => sunDirectionFrom(params.sunAzimuth, params.sunElevation, sunDirection.value);
    const dayFolder = gui.addFolder('Midnight sun');
    // listen(): follows along while Sowilo animates it
    dayFolder.add(dayAmount, 'value', 0, 1, 0.01).name('day amount').listen();
    dayFolder.add(params, 'sunAzimuth', -180, 180, 1).name('sun azimuth (°)').onChange(updateSunDirection);
    dayFolder.add(params, 'sunElevation', -5, 45, 0.5).name('sun elevation (°)').onChange(updateSunDirection);
    dayFolder.add(sunGlowSize, 'value', 0.01, 0.5, 0.005).name('sun glow size');
    dayFolder.addColor(colors, 'dawnHorizon').name('horizon color').onChange((value) => {
      dawnHorizonColor.value.copy(rawColor(value));
      blend.dayFog.set(value);
    });
    dayFolder.addColor(colors, 'dawnZenith').name('zenith color').onChange((value) => dawnZenithColor.value.copy(rawColor(value)));
    dayFolder.addColor(colors, 'sunLight').name('sun light color').onChange((value) => sunLight.color.set(value));
    dayFolder.add(params, 'sunIntensity', 0, 10, 0.05).name('sun light intensity');
    dayFolder.addColor(colors, 'dayHemiSky').name('day fill sky color').onChange((value) => blend.dayHemiSky.set(value));
    dayFolder.add(params, 'dayHemiIntensity', 0, 3, 0.01).name('day fill intensity');
  }

  return { lights: [keyLight, hemiLight, sunLight], fog, adjust, update };
};
