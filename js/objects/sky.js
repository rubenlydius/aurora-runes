// "Auroras" by nimitz — https://www.shadertoy.com/view/XtGGRt
import * as THREE from 'three/webgpu';
import { wgslFn, positionWorld, cameraPosition, screenCoordinate, colorSpaceToWorking } from 'three/tsl';

import auroraFragmentShader from '../shaders/aurora/fragment.wgsl?raw';

export const SKY_RADIUS = 500;

// inverted sphere around the camera, the aurora shader paints its inside
export const createSky = ({ iTime, iResolution }) => {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 64, 32);
  const aurora = wgslFn(auroraFragmentShader);

  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
  // the shader outputs display-ready (sRGB) colors, convert them to the working color space
  material.colorNode = colorSpaceToWorking(
    aurora({
      rayDir: positionWorld.sub(cameraPosition).normalize(),
      fragCoord: screenCoordinate,
      iTime,
      iResolution,
    }),
    THREE.SRGBColorSpace,
  );

  const mesh = new THREE.Mesh(geometry, material);
  // always drawn first, behind everything else
  mesh.renderOrder = -1;
  return mesh;
};
