// "Auroras" by nimitz — https://www.shadertoy.com/view/XtGGRt
import * as THREE from 'three/webgpu';
import { uniform, texture } from 'three/tsl';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { DEBUG } from './constants/debug.js';
import { createSky, SKY_RADIUS } from './objects/sky.js';
import { createWater } from './objects/water.js';
import { createShip } from './objects/ship.js';
import { createMountains } from './objects/mountains.js';
import { createCamera, createLookAround } from './objects/camera.js';
import { createLighting, rawColorFromHex } from './objects/lighting.js';
import { applyToneMapping } from './utils/toneMapping.js';
import { AURORA_COLOR, TONE_MAPPING_EXPOSURE } from './constants/lighting.js';
import { SHIP_REFLECTION } from './constants/scene.js';
import { SUN_GLOW_SIZE, DAWN_HORIZON_COLOR, DAWN_ZENITH_COLOR } from './constants/day.js';
import { POINTER_BOOST, POINTER_PULL, POINTER_CORE, POINTER_CREATE, POINTER_TRAIL } from './constants/aurora.js';
import { createAuroraPointer, createTrailTexture } from './interaction/auroraPointer.js';
import { createGestureInput } from './gestures/gestureInput.js';
import { createEffects } from './effects/index.js';
import { createBackgroundMusic } from './audio/backgroundMusic.js';
import { createPhysics } from './physics/world.js';

const $canvas = document.getElementById('webgl');
let renderer, camera, scene, stats;
let sky, water, ship, sail, shipUpdate, lighting, auroraPointer, physics;
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
  // pointer glow in the aurora (sky and its reflection), driven by js/interaction/auroraPointer.js
  pointerPoint: uniform(new THREE.Vector2()),
  pointerStrength: uniform(0),
  // radius and core size are set every frame, scaled for the pointer's distance
  pointerRadius: uniform(1),
  pointerBoost: uniform(POINTER_BOOST),
  pointerPull: uniform(POINTER_PULL),
  pointerCore: uniform(POINTER_CORE),
  pointerCoreSize: uniform(0.1),
  pointerCreate: uniform(POINTER_CREATE),
  pointerTrail: uniform(POINTER_TRAIL),
  // the trail's recorded path (one texel per point) and how many points are in use
  pointerTrailPoints: texture(createTrailTexture()),
  pointerTrailCount: uniform(1),
  // shared mood of the sky and its reflection, animated by the rune effects (defaults = unchanged)
  skyBrightness: uniform(1),
  skyTint: uniform(new THREE.Color(1, 1, 1)),
  auroraSpeed: uniform(1),
  // what the aurora animates with: summed up from auroraSpeed every frame, so speed changes stay smooth
  auroraTime: uniform(0),
  // midnight sun: 0 = night, 1 = full dawn sky (aurora and stars gone); also drives the lighting
  dayAmount: uniform(0),
  // set from the azimuth / elevation constants in js/objects/lighting.js
  sunDirection: uniform(new THREE.Vector3(0, 0, -1)),
  dawnHorizonColor: uniform(rawColorFromHex(DAWN_HORIZON_COLOR)),
  dawnZenithColor: uniform(rawColorFromHex(DAWN_ZENITH_COLOR)),
  sunGlowSize: uniform(SUN_GLOW_SIZE),
  // lightning: 0 = none, pulses during a Thurisaz strike (sky, water and key light follow it)
  flashAmount: uniform(0),
};

// async: Rapier's WebAssembly has to start before the scene does
const init = async () => {
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

  // Rapier physics world (Hagalaz hail), stepped in draw()
  physics = await createPhysics({ scene, gui });

  // the sky and water shaders ignore lights, only the lit materials (ship) use them
  lighting = createLighting({ ...uniforms, gui });
  scene.add(...lighting.lights);
  scene.fog = lighting.fog;

  sky = createSky(uniforms);
  scene.add(sky);

  // shares the sky's uniforms, so the reflection moves in sync
  water = createWater({ ...uniforms, gui });
  scene.add(water.mesh);

  // the model loads asynchronously, the scene keeps rendering in the meantime
  createShip({ gui })
    .then((result) => {
      ship = result.ship;
      sail = result.sail;
      shipUpdate = result.update;
      applyToneMapping(ship, { renderer, exposure: uniforms.exposure });
      scene.add(ship);
      // the hull (with mast and oars) and the sail as colliders that follow the floating ship
      const hull = ship.getObjectByName('Viking_Ship');
      if (hull) physics.addKinematicTrimesh(hull);
      else console.warn('No "Viking_Ship" object in the ship model, the hail falls through it');
      if (sail) physics.addKinematicTrimesh(sail);
    })
    .catch((error) => console.error('Could not load the Viking ship', error));

  // same as the ship: loads asynchronously, lit and tone mapped like it
  createMountains({ gui })
    .then((mountains) => {
      applyToneMapping(mountains, { renderer, exposure: uniforms.exposure });
      scene.add(mountains);
    })
    .catch((error) => console.error('Could not load the mountains', error));

  if (DEBUG) {
    // Shift + drag turns the camera in place
    createLookAround({ camera, canvas: $canvas, gui });

    const reflectionFolder = gui.addFolder('Ship reflection');
    reflectionFolder.add(shipReflection, 'strength', 0, 1, 0.01);
    reflectionFolder.add(shipReflection, 'width', 0.1, 5, 0.05).name('half width');
    reflectionFolder.add(shipReflection, 'length', 0.1, 10, 0.05).name('half length');

    // fps counter, click it to switch to frame time (ms)
    stats = new Stats();
    document.body.appendChild(stats.dom);
  }

  // in debug mode Shift + drag looks around, so the aurora pointer ignores those drags
  auroraPointer = createAuroraPointer({ canvas: $canvas, camera, uniforms, shiftLooksAround: DEBUG, gui });

  // $P recognition of the spacebar drawings; record mode in debug
  createGestureInput({ canvas: $canvas, debug: DEBUG, gui });
  // recognised runes -> effects
  createEffects({ uniforms, scene, camera, water, getSail: () => sail, physics, gui });
  // starts on the first input, rotates through the tracks
  createBackgroundMusic({ gui });

  window.addEventListener('resize', resize);
  resize();

  renderer.setAnimationLoop(draw);
};

const draw = () => {
  timer.update();
  uniforms.iTime.value = timer.getElapsed();
  const delta = timer.getDelta();
  uniforms.auroraTime.value += delta * uniforms.auroraSpeed.value;
  water.update(delta);
  lighting.update(uniforms.iTime.value);
  auroraPointer.update(delta);

  // the dark patch follows the ship (and its sliders), and stays off until the model has loaded
  if (ship) {
    // the ship floats on the swell
    shipUpdate(
      uniforms.iTime.value,
      (x, z) => water.waveHeightAt(x, z, uniforms.iTime.value, camera.position),
      water.waves.height.value,
    );
    uniforms.shipPosition.value.copy(ship.position);
    uniforms.shipRotation.value = ship.rotation.y;
    uniforms.shipReflectionSize.value.set(shipReflection.width, shipReflection.length).multiplyScalar(ship.scale.x);
    uniforms.shipReflectionStrength.value = shipReflection.strength;
  }

  // fixed-step physics after the ship has moved, so the hull collider follows it
  physics.update(delta);

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
