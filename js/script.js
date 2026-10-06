// "Auroras" by nimitz — https://www.shadertoy.com/view/XtGGRt
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { DEBUG } from './constants/debug.js';
import { createSky, SKY_RADIUS } from './objects/sky.js';

const $canvas = document.getElementById('webgl');
let renderer, camera, scene, controls;
let sky;
const timer = new THREE.Timer();

// uniforms are TSL nodes, we update their .value every frame
const uniforms = {
  iTime: uniform(0),
  iResolution: uniform(new THREE.Vector2(2, 2)),
};

const init = () => {
  // wgslFn shaders don't run on the WebGL2 fallback
  if (!navigator.gpu) {
    document.body.innerHTML = '<p style="color:#fff;font-family:sans-serif;padding:2rem">This experience needs WebGPU. Open it in Chrome or Edge.</p>';
    document.body.style.background = '#000';
    return;
  }

  renderer = new THREE.WebGPURenderer({ canvas: $canvas, alpha: false });

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, SKY_RADIUS * 2);
  // temporary default view, step 3 replaces it with the fixed cursor-drift camera
  camera.lookAt(0, 0.35, -1);

  scene = new THREE.Scene();

  sky = createSky(uniforms);
  scene.add(sky);

  if (DEBUG) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // orbit a point just in front of the camera, so it mostly rotates in place
    controls.target.set(0, 0.35, -1);
    controls.update();
  }

  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(draw);
};

const draw = () => {
  timer.update();
  uniforms.iTime.value = timer.getElapsed();

  if (controls) controls.update();
  // keep the camera at the center of the sky sphere
  sky.position.copy(camera.position);

  renderer.render(scene, camera);
};

const resize = () => {
  // the aurora raymarches 50 steps per pixel, so cap the pixel ratio
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.getDrawingBufferSize(uniforms.iResolution.value);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};

init();
