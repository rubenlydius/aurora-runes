import * as THREE from 'three/webgpu';

import { CAMERA_POSITION, CAMERA_TARGET, CAMERA_FOV } from '../constants/camera.js';

// temporary fixed view, step 3 adds the cursor drift
export const createCamera = ({ far }) => {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, far);
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
  return camera;
};

// debug only: sliders for position, target and fov; OrbitControls keeps working alongside them
export const addCameraGui = ({ gui, camera, controls }) => {
  controls.target.set(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
  controls.update();

  const round = (value) => Math.round(value * 100) / 100;
  const vector = (v) => `{ x: ${round(v.x)}, y: ${round(v.y)}, z: ${round(v.z)} }`;
  const actions = {
    // prints the current view as constants, ready to paste into js/constants/camera.js
    logValues: () => {
      console.log([
        `export const CAMERA_POSITION = ${vector(camera.position)};`,
        `export const CAMERA_TARGET = ${vector(controls.target)};`,
        `export const CAMERA_FOV = ${round(camera.fov)};`,
      ].join('\n'));
    },
  };

  const folder = gui.addFolder('Camera');
  // listen() refreshes the sliders every frame, so they follow along while you orbit
  folder.add(camera.position, 'x', -50, 50, 0.01).name('position x').listen();
  folder.add(camera.position, 'y', -1.9, 20, 0.01).name('position y').listen();
  folder.add(camera.position, 'z', -50, 50, 0.01).name('position z').listen();
  folder.add(controls.target, 'x', -50, 50, 0.01).name('target x').listen();
  folder.add(controls.target, 'y', -20, 20, 0.01).name('target y').listen();
  folder.add(controls.target, 'z', -50, 50, 0.01).name('target z').listen();
  folder.add(camera, 'fov', 20, 100, 0.5).onChange(() => camera.updateProjectionMatrix());
  folder.add(actions, 'logValues').name('log values');
};
