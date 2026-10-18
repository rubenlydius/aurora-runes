import * as THREE from 'three/webgpu';

import { CAMERA_POSITION, CAMERA_TARGET, CAMERA_FOV } from '../constants/camera.js';

// temporary fixed view, step 3 adds the cursor drift
export const createCamera = ({ far }) => {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, 0.1, far);
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(CAMERA_TARGET.x, CAMERA_TARGET.y, CAMERA_TARGET.z);
  // yaw (y) first, then pitch (x): turning left/right never tilts the horizon
  camera.rotation.reorder('YXZ');
  return camera;
};

// debug only: Shift + drag turns the camera in place (position stays put), plus sliders for the view
export const createLookAround = ({ camera, canvas, gui }) => {
  // degrees per dragged pixel
  const sensitivity = 0.15;
  // yaw and pitch in degrees, read from the starting orientation
  const look = {
    yaw: THREE.MathUtils.radToDeg(camera.rotation.y),
    pitch: THREE.MathUtils.radToDeg(camera.rotation.x),
  };
  const apply = () => {
    look.pitch = THREE.MathUtils.clamp(look.pitch, -85, 85);
    camera.rotation.set(THREE.MathUtils.degToRad(look.pitch), THREE.MathUtils.degToRad(look.yaw), 0);
  };

  let dragging = false;
  canvas.addEventListener('pointerdown', (event) => {
    if (!event.shiftKey) return;
    dragging = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    // drag right to look right, drag up to look up
    look.yaw -= event.movementX * sensitivity;
    look.pitch -= event.movementY * sensitivity;
    apply();
  });
  const stop = (event) => {
    if (!dragging) return;
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  const round = (value) => Math.round(value * 100) / 100;
  const vector = (v) => `{ x: ${round(v.x)}, y: ${round(v.y)}, z: ${round(v.z)} }`;
  const actions = {
    // prints the current view as constants, ready to paste into js/constants/camera.js;
    // the target is the point 1 unit in front of the camera
    logValues: () => {
      const target = camera.getWorldDirection(new THREE.Vector3()).add(camera.position);
      console.log([
        `export const CAMERA_POSITION = ${vector(camera.position)};`,
        `export const CAMERA_TARGET = ${vector(target)};`,
        `export const CAMERA_FOV = ${round(camera.fov)};`,
      ].join('\n'));
    },
  };

  const folder = gui.addFolder('Camera (Shift + drag to look around)');
  folder.add(camera.position, 'x', -50, 50, 0.01).name('position x');
  folder.add(camera.position, 'y', -1.9, 20, 0.01).name('position y');
  folder.add(camera.position, 'z', -50, 50, 0.01).name('position z');
  // listen() refreshes these every frame, so they follow along while you drag
  folder.add(look, 'yaw', -180, 180, 0.1).name('yaw (°)').onChange(apply).listen();
  folder.add(look, 'pitch', -85, 85, 0.1).name('pitch (°)').onChange(apply).listen();
  folder.add(camera, 'fov', 20, 100, 0.5).onChange(() => camera.updateProjectionMatrix());
  folder.add(actions, 'logValues').name('log values');
};
