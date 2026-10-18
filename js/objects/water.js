import * as THREE from 'three/webgpu';
import { wgslFn, uniform, positionLocal, positionWorld, cameraPosition, screenCoordinate, colorSpaceToWorking } from 'three/tsl';

import {
  WATER_LEVEL,
  WATER_SIZE,
  WATER_BASE_COLOR,
  RIPPLE_STRENGTH,
  RIPPLE_SCALE,
  RIPPLE_SPEED,
  RIPPLE_FADE_DISTANCE,
  WAVE_HEIGHT,
  WAVE_DIRECTION,
  WAVE_LENGTH,
  WAVE_SPEED,
  WAVE_SHARPNESS,
  WAVE_FADE_DISTANCE,
  WATER_SEGMENTS,
} from '../constants/water.js';
import waterFragmentShader from '../shaders/water/fragment.wgsl?raw';
import waterVertexShader from '../shaders/water/vertex.wgsl?raw';
import swellShader from '../shaders/water/swell.wgsl?raw';
import auroraFragmentShader from '../shaders/aurora/fragment.wgsl?raw';

// JS copy of swell() in js/shaders/water/swell.wgsl (keep in sync): the swell's height at world x, z
const swellWave = (x, z, t, angle, lambda, phase, speed, sharpness) => {
  const k = (Math.PI * 2) / lambda;
  const w = Math.sqrt(9.81 * k) * speed;
  const arg = (Math.cos(angle) * x + Math.sin(angle) * z) * k - w * t + phase;
  const s = Math.max((1 + Math.sin(arg)) * 0.5, 0.0001);
  return 2 * Math.pow(s, sharpness) - 1;
};

// fjord water that reflects the aurora sky: rippled in the fragment shader, lifted by the swell in the vertex shader
export const createWater = ({
  iTime,
  iResolution,
  shipPosition,
  shipRotation,
  shipReflectionSize,
  shipReflectionStrength,
  pointerPoint,
  pointerStrength,
  pointerRadius,
  pointerBoost,
  pointerPull,
  pointerCore,
  pointerCoreSize,
  pointerCreate,
  pointerTrail,
  pointerTrailPoints,
  pointerTrailCount,
  skyBrightness,
  skyTint,
  auroraTime,
  dayAmount,
  sunDirection,
  dawnHorizonColor,
  dawnZenithColor,
  sunGlowSize,
  flashAmount,
  auroraIntensity,
  auroraHueShift,
  gui,
}) => {
  // a grid packed toward the center: u in -1..1 maps to sign(u) * u² * half size, so the cells are small near
  // the camera (where the swell is) and large far away; laid flat, so local xz = world xz
  const geometry = new THREE.PlaneGeometry(2, 2, WATER_SEGMENTS, WATER_SEGMENTS);
  const positions = geometry.attributes.position;
  const pack = (u) => Math.sign(u) * u * u * (WATER_SIZE / 2);
  for (let i = 0; i < positions.count; i++) {
    positions.setXY(i, pack(positions.getX(i)), pack(positions.getY(i)));
  }
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingSphere();

  // water main function first, then the swell and the aurora code as helpers
  const water = wgslFn(waterFragmentShader + '\n' + swellShader + '\n' + auroraFragmentShader);
  const waterVertex = wgslFn(waterVertexShader + '\n' + swellShader);

  // setRGB in the working color space stores the values as-is, the shader treats them as sRGB
  const baseColor = uniform(new THREE.Color().setRGB(...WATER_BASE_COLOR));
  const rippleStrength = uniform(RIPPLE_STRENGTH);
  const rippleScale = uniform(RIPPLE_SCALE);
  const rippleSpeed = uniform(RIPPLE_SPEED);
  // what the shader animates with: summed up from rippleSpeed in update(), so speed changes stay smooth
  const rippleTime = uniform(0);
  const rippleFadeDistance = uniform(RIPPLE_FADE_DISTANCE);
  // swell (angles in radians in the shader, degrees in the constants and sliders)
  const waveHeight = uniform(WAVE_HEIGHT);
  const waveDirection = uniform(THREE.MathUtils.degToRad(WAVE_DIRECTION));
  const waveLength = uniform(WAVE_LENGTH);
  const waveSpeed = uniform(WAVE_SPEED);
  const waveSharpness = uniform(WAVE_SHARPNESS);
  const waveFadeDistance = uniform(WAVE_FADE_DISTANCE);
  // ice holding the swell (Isa): 0 = free, 1 = frozen in place. While it rises, the swell's time slows to a stop
  // and its height is held at what it was when the freeze began (Laguz may keep lowering waveHeight meanwhile);
  // when it falls again, the height blends back to waveHeight and the waves move on
  const swellFreeze = { value: 0 };
  let heldHeight = 0;
  // the swell's own time and the height the shaders actually use (waveHeight, or held by the ice)
  const swellTime = uniform(0);
  const swellHeight = uniform(WAVE_HEIGHT);
  const swellUniforms = { waveHeight: swellHeight, waveDirection, waveLength, waveSpeed, waveSharpness, waveFadeDistance };
  // ice (Isa): freezeAmount 0 leaves the water unchanged; js/effects/isa.js sets the rest from its constants
  const iceUniforms = {
    freezeAmount: uniform(0),
    iceOrigin: uniform(new THREE.Vector2()),
    iceRadius: uniform(1),
    iceCurve: uniform(1),
    iceNoise: uniform(0),
    iceFade: uniform(1),
    iceColor: uniform(new THREE.Color(1, 1, 1)),
    iceTint: uniform(0),
    iceBlur: uniform(0),
    crackStrength: uniform(0),
    crackScale: uniform(1),
  };

  const material = new THREE.MeshBasicNodeMaterial();
  material.positionNode = waterVertex({ localPos: positionLocal, camPos: cameraPosition, swellTime, ...swellUniforms });
  // the shader outputs display-ready (sRGB) colors, convert them to the working color space like the sky
  material.colorNode = colorSpaceToWorking(
    water({
      worldPos: positionWorld,
      camPos: cameraPosition,
      fragCoord: screenCoordinate,
      iTime,
      iResolution,
      baseColor,
      rippleStrength,
      rippleScale,
      rippleTime,
      rippleFadeDistance,
      swellTime,
      shipPosition,
      shipRotation,
      shipReflectionSize,
      shipReflectionStrength,
      pointerPoint,
      pointerStrength,
      pointerRadius,
      pointerBoost,
      pointerPull,
      pointerCore,
      pointerCoreSize,
      pointerCreate,
      pointerTrail,
      pointerTrailPoints,
      pointerTrailCount,
      skyBrightness,
      skyTint,
      auroraTime,
      dayAmount,
      sunDirection,
      dawnHorizonColor,
      dawnZenithColor,
      sunGlowSize,
      flashAmount,
      auroraIntensity,
      auroraHueShift,
      ...swellUniforms,
      ...iceUniforms,
    }),
    THREE.SRGBColorSpace,
  );

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = WATER_LEVEL;

  const update = (delta) => {
    rippleTime.value += delta * rippleSpeed.value;
    const freeze = swellFreeze.value;
    // the moment the ice starts to grip: remember the height to hold
    if (freeze === 0) heldHeight = waveHeight.value;
    swellTime.value += delta * (1 - freeze);
    swellHeight.value = THREE.MathUtils.lerp(waveHeight.value, heldHeight, freeze);
  };

  // the swell's height (world units, relative to WATER_LEVEL) at world x, z, exactly like the vertex shader
  const waveHeightAt = (x, z, camPos) => {
    if (swellHeight.value === 0) return 0;
    const t = swellTime.value;
    const a = waveDirection.value;
    const l = waveLength.value;
    const v = waveSpeed.value;
    const sharp = waveSharpness.value;
    const sum = swellWave(x, z, t, a, l, 0, v, sharp)
      + swellWave(x, z, t, a + 0.44, l * 0.62, 1.7, v, sharp) * 0.45
      + swellWave(x, z, t, a - 0.61, l * 0.37, 4.1, v, sharp) * 0.25;
    const fade = Math.exp(-Math.hypot(x - camPos.x, z - camPos.z) / waveFadeDistance.value);
    return sum * (swellHeight.value * fade / 1.7);
  };

  if (gui) {
    const params = { direction: WAVE_DIRECTION };
    const folder = gui.addFolder('Waves (swell)');
    // listen(): follows along while Laguz animates it
    folder.add(waveHeight, 'value', 0, 3, 0.01).name('height').listen();
    folder.add(params, 'direction', -180, 180, 1).name('direction (°)')
      .onChange((value) => { waveDirection.value = THREE.MathUtils.degToRad(value); });
    folder.add(waveLength, 'value', 2, 60, 0.5).name('length');
    folder.add(waveSpeed, 'value', 0, 3, 0.01).name('speed');
    folder.add(waveSharpness, 'value', 1, 4, 0.05).name('crest sharpness');
    folder.add(waveFadeDistance, 'value', 10, 300, 1).name('fade distance');
  }

  // ripple, waves and ice: the uniforms rune effects animate (Laguz, Isa); waveHeightAt: the ship floats on it.
  // waves.height: what Laguz sets; waves.current: the height in use (held while frozen); waves.freeze: Isa's grip
  return {
    mesh,
    ripple: { strength: rippleStrength, speed: rippleSpeed },
    waves: { height: waveHeight, current: swellHeight, freeze: swellFreeze },
    ice: iceUniforms,
    waveHeightAt,
    update,
  };
};
