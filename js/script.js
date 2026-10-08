// "Auroras" by nimitz — https://www.shadertoy.com/view/XtGGRt
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { DEBUG } from './constants/debug.js';
import { createSky, SKY_RADIUS } from './objects/sky.js';
import { createWater } from './objects/water.js';
import { createShip } from './objects/ship.js';
import { createCamera, addCameraGui } from './objects/camera.js';

const $canvas = document.getElementById('webgl');
let renderer, camera, scene, controls, stats;
let sky, water, ship, sail;
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

  camera = createCamera({ far: SKY_RADIUS * 2 });

  scene = new THREE.Scene();

  // sliders for tweaking constants, only in debug mode
  const gui = DEBUG ? new GUI() : null;

  // temporary dim night light so the ship's lit materials aren't black; the sky and water ignore it
  scene.add(new THREE.HemisphereLight(0x6a7fb0, 0x101018, 0.6));

  sky = createSky(uniforms);
  scene.add(sky);

  // shares the sky's uniforms, so the reflection moves in sync
  water = createWater(uniforms);
  scene.add(water);

  // the model loads asynchronously, the scene keeps rendering in the meantime
  createShip({ gui })
    .then((result) => {
      ship = result.ship;
      sail = result.sail;
      scene.add(ship);
    })
    .catch((error) => console.error('Could not load the Viking ship', error));

  if (DEBUG) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // also sets the orbit target to the point the camera looks at
    addCameraGui({ gui, camera, controls });

    // fps counter, click it to switch to frame time (ms)
    stats = new Stats();
    document.body.appendChild(stats.dom);
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

  if (stats) stats.update();
};

const resize = () => {
  // the aurora raymarches 50 steps per pixel and is soft anyway, so render at 1 pixel per CSS pixel
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.getDrawingBufferSize(uniforms.iResolution.value);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};

init();
