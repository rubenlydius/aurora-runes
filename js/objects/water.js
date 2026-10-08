import * as THREE from 'three/webgpu';
import { wgslFn, uniform, positionWorld, cameraPosition, screenCoordinate, colorSpaceToWorking } from 'three/tsl';

import {
  WATER_LEVEL,
  WATER_SIZE,
  WATER_BASE_COLOR,
  RIPPLE_STRENGTH,
  RIPPLE_SCALE,
  RIPPLE_SPEED,
  RIPPLE_FADE_DISTANCE,
} from '../constants/water.js';
import waterFragmentShader from '../shaders/water/fragment.wgsl?raw';
import auroraFragmentShader from '../shaders/aurora/fragment.wgsl?raw';

// calm fjord water that reflects the aurora sky, rippled in the fragment shader only
export const createWater = ({ iTime, iResolution, shipPosition, shipRotation, shipReflectionSize, shipReflectionStrength }) => {
  const geometry = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE);
  // water main function first, the aurora code after it as helpers
  const water = wgslFn(waterFragmentShader + '\n' + auroraFragmentShader);

  // setRGB in the working color space stores the values as-is, the shader treats them as sRGB
  const baseColor = uniform(new THREE.Color().setRGB(...WATER_BASE_COLOR));
  const rippleStrength = uniform(RIPPLE_STRENGTH);
  const rippleScale = uniform(RIPPLE_SCALE);
  const rippleSpeed = uniform(RIPPLE_SPEED);
  const rippleFadeDistance = uniform(RIPPLE_FADE_DISTANCE);

  const material = new THREE.MeshBasicNodeMaterial();
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
      rippleSpeed,
      rippleFadeDistance,
      shipPosition,
      shipRotation,
      shipReflectionSize,
      shipReflectionStrength,
    }),
    THREE.SRGBColorSpace,
  );

  const mesh = new THREE.Mesh(geometry, material);
  // PlaneGeometry stands upright, lay it flat facing up
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = WATER_LEVEL;
  return mesh;
};
