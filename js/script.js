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
import { createLighting } from './objects/lighting.js';
import { applyToneMapping } from './utils/toneMapping.js';
import { AURORA_COLOR, TONE_MAPPING_EXPOSURE } from './constants/lighting.js';
import { SHIP_REFLECTION } from './constants/scene.js';

const $canvas = document.getElementById('webgl');
let renderer, camera, scene, controls, stats;
let sky, water, ship, sail, shipUpdate, lighting;
// copy, so the sliders don't change the constants
const shipReflection = { ...SHIP_REFLECTION };
const timer = new THREE.Timer();

// uniforms are TSL nodes, we update their .value every frame
const uniforms = {
  iTime: uniform(0),
  iResolution: uniform(new THREE.Vector2(2, 2)),
  auroraColor: uniform(new THREE.Color(AURORA_COLOR)),
  exposure: uniform(TONE_MAPPING_EXPOSURE),
  // fake ship reflection in the water, follows the ship every frame
  shipPosition: uniform(new THREE.Vector3()),
  shipRotation: uniform(0),
  shipReflectionSize: uniform(new THREE.Vector2(1, 1)),
  shipReflectionStrength: uniform(0),
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

  // the sky and water shaders ignore lights, only the lit materials (ship) use them
  lighting = createLighting({ auroraColor: uniforms.auroraColor, exposure: uniforms.exposure, gui });
  scene.add(...lighting.lights);
  scene.fog = lighting.fog;

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
      shipUpdate = result.update;
      applyToneMapping(ship, { renderer, exposure: uniforms.exposure });
      scene.add(ship);
    })
    .catch((error) => console.error('Could not load the Viking ship', error));

  if (DEBUG) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // also sets the orbit target to the point the camera looks at
    addCameraGui({ gui, camera, controls });

    const reflectionFolder = gui.addFolder('Ship reflection');
    reflectionFolder.add(shipReflection, 'strength', 0, 1, 0.01);
    reflectionFolder.add(shipReflection, 'width', 0.1, 5, 0.05).name('half width');
    reflectionFolder.add(shipReflection, 'length', 0.1, 10, 0.05).name('half length');

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
  lighting.update(uniforms.iTime.value);

  // the dark patch follows the ship (and its sliders), and stays off until the model has loaded
  if (ship) {
    shipUpdate(uniforms.iTime.value);
    uniforms.shipPosition.value.copy(ship.position);
    uniforms.shipRotation.value = ship.rotation.y;
    uniforms.shipReflectionSize.value.set(shipReflection.width, shipReflection.length).multiplyScalar(ship.scale.x);
    uniforms.shipReflectionStrength.value = shipReflection.strength;
  }

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
