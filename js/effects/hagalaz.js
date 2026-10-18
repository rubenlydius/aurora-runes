import * as THREE from 'three/webgpu';
import { vec4, output, agxToneMapping } from 'three/tsl';
import gsap from 'gsap';

import { createSplashes } from './splashes.js';
import { rawColorFromHex } from '../objects/lighting.js';
import { WATER_LEVEL } from '../constants/water.js';
import {
  HAGALAZ_SOUND,
  HAGALAZ_VOLUME,
  HAGALAZ_SKY_BRIGHTNESS,
  HAGALAZ_SKY_TINT,
  HAGALAZ_SKY_RAMP_IN,
  HAGALAZ_DURATION,
  HAGALAZ_RATE_RAMP,
  HAGALAZ_SKY_RAMP_OUT,
  HAGALAZ_RATE,
  HAGALAZ_CAP,
  HAGALAZ_CAP_MAX,
  HAGALAZ_SPAWN_AREA,
  HAGALAZ_SPAWN_WIDE,
  HAGALAZ_SPAWN_WIDE_SCALE,
  HAGALAZ_FALL_SPEED,
  HAGALAZ_WIND,
  HAGALAZ_SIZE_MIN,
  HAGALAZ_SIZE_MAX,
  HAGALAZ_RESTITUTION,
  HAGALAZ_FRICTION,
  HAGALAZ_REST_TIME,
  HAGALAZ_MELT_TIME,
  HAGALAZ_COLOR,
  HAGALAZ_EMISSIVE,
  HAGALAZ_EMISSIVE_INTENSITY,
} from '../constants/effects.js';

const random = THREE.MathUtils.randFloat;
const lerp = THREE.MathUtils.lerp;

// a stone counts as landed once it moves slower than this (world units per second) for REST_DELAY seconds
const REST_SPEED = 0.3;
const REST_DELAY = 0.3;
// a stone that never settles (e.g. keeps rolling on the rocking deck) starts melting after this many seconds
const MAX_AGE = 12;
// ice is about 900 kg/m³; only matters for how stones push each other around
const DENSITY = 900;

// stone states
const FREE = 0;
const FALLING = 1;
const MELTING = 2;

// one lumpy stone shape for all instances: an icosphere with every vertex pushed in or out a little.
// The geometry is non-indexed (each triangle has its own copies of its corners), so the push comes from
// a hash of the position: copies of the same corner move together and the surface stays closed
const createStoneGeometry = () => {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    const hash = Math.abs(Math.sin(vertex.x * 12.9898 + vertex.y * 78.233 + vertex.z * 37.719) * 43758.5453) % 1;
    vertex.multiplyScalar(0.85 + hash * 0.3);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  // faceted normals: catches the light in small flashes, like ice
  geometry.computeVertexNormals();
  return geometry;
};

// Hagalaz (hail): "hailstorm". The sky darkens, hailstones fall as Rapier rigid bodies, bounce off the ship
// (a kinematic trimesh, js/physics/world.js), settle on the deck and melt, or splash into the water.
// One GSAP timeline drives the mood and the spawn rate; the physics runs every frame in the render loop
export const createHagalaz = ({ uniforms, scene, camera, water, physics, listener, gui }) => {
  const { RAPIER, world } = physics;
  const params = {
    volume: HAGALAZ_VOLUME,
    skyBrightness: HAGALAZ_SKY_BRIGHTNESS,
    skyRampIn: HAGALAZ_SKY_RAMP_IN,
    duration: HAGALAZ_DURATION,
    rateRamp: HAGALAZ_RATE_RAMP,
    skyRampOut: HAGALAZ_SKY_RAMP_OUT,
    rate: HAGALAZ_RATE,
    cap: HAGALAZ_CAP,
    ...HAGALAZ_SPAWN_AREA,
    wide: HAGALAZ_SPAWN_WIDE,
    wideScale: HAGALAZ_SPAWN_WIDE_SCALE,
    fallSpeed: HAGALAZ_FALL_SPEED,
    wind: HAGALAZ_WIND,
    sizeMin: HAGALAZ_SIZE_MIN,
    sizeMax: HAGALAZ_SIZE_MAX,
    restitution: HAGALAZ_RESTITUTION,
    friction: HAGALAZ_FRICTION,
    restTime: HAGALAZ_REST_TIME,
    meltTime: HAGALAZ_MELT_TIME,
  };
  const stormTint = rawColorFromHex(HAGALAZ_SKY_TINT);

  // --- the stones: one InstancedMesh, one pooled rigid body + ball collider per instance ---
  const material = new THREE.MeshStandardNodeMaterial({
    color: HAGALAZ_COLOR,
    roughness: 0.25,
    metalness: 0,
    emissive: HAGALAZ_EMISSIVE,
    emissiveIntensity: HAGALAZ_EMISSIVE_INTENSITY,
  });
  // the same per-material AgX tone mapping the ship gets (js/utils/toneMapping.js)
  material.outputNode = vec4(agxToneMapping(output.rgb, uniforms.exposure), output.a);
  const mesh = new THREE.InstancedMesh(createStoneGeometry(), material, HAGALAZ_CAP_MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // the stones are spread all over, skip culling (the bounding sphere would be stale anyway)
  mesh.frustumCulled = false;
  scene.add(mesh);

  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const stones = Array.from({ length: HAGALAZ_CAP_MAX }, (_, index) => {
    // dynamic: moved by gravity and collisions. CCD (continuous collision detection): small, fast balls
    // can jump straight through the thin hull between two steps; CCD checks the path in between.
    // Created disabled: a disabled body costs nothing in the simulation until a stone is spawned with it
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setEnabled(false).setCcdEnabled(true));
    // a ball collider; the radius is set per spawn. Restitution = bounciness, friction = grip on the deck
    const collider = world.createCollider(
      RAPIER.ColliderDesc.ball(HAGALAZ_SIZE_MIN).setDensity(DENSITY),
      body,
    );
    mesh.setMatrixAt(index, hidden);
    return { body, collider, state: FREE, radius: 1, age: 0, still: 0, melt: 0 };
  });
  let alive = 0;

  const splashes = createSplashes({ max: 300, color: 0xb8d0e8, size: 0.12 });
  scene.add(splashes.object);

  // --- sound ---
  const sound = new THREE.Audio(listener);
  sound.setLoop(true);
  new THREE.AudioLoader().load(
    `${import.meta.env.BASE_URL}${HAGALAZ_SOUND}`,
    (buffer) => sound.setBuffer(buffer),
    undefined,
    (error) => console.error('Hagalaz: could not load the hail sound', error),
  );

  // --- spawning and recycling ---
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const spawn = (stone) => {
    const ship = uniforms.shipPosition.value;
    // most stones over the ship, some over the wider fjord
    const spread = Math.random() < params.wide ? params.wideScale : 1;
    const x = ship.x + params.offsetX + random(-0.5, 0.5) * params.width * spread;
    const z = ship.z + params.offsetZ + random(-0.5, 0.5) * params.depth * spread;
    // a little height variation so they don't arrive as one flat sheet
    const y = WATER_LEVEL + params.height + random(0, 3);

    stone.radius = random(params.sizeMin, params.sizeMax);
    stone.collider.setRadius(stone.radius);
    stone.collider.setRestitution(params.restitution);
    stone.collider.setFriction(params.friction);
    // setRadius doesn't update the mass, set the density again so it's recomputed for the new size
    stone.collider.setDensity(DENSITY);

    const { body } = stone;
    body.setTranslation({ x, y, z }, false);
    body.setRotation(quaternion.setFromEuler(euler.set(random(0, 6.3), random(0, 6.3), random(0, 6.3))), false);
    body.setLinvel({ x: random(-1, 1) * params.wind, y: -params.fallSpeed, z: random(-1, 1) * params.wind }, false);
    body.setAngvel({ x: random(-5, 5), y: random(-5, 5), z: random(-5, 5) }, false);
    body.setEnabled(true);
    body.wakeUp();

    stone.state = FALLING;
    stone.age = 0;
    stone.still = 0;
    stone.melt = 0;
    alive += 1;
  };

  const recycle = (stone, index) => {
    stone.body.setEnabled(false);
    // parked out of sight: the collider debug view still draws disabled bodies
    stone.body.setTranslation({ x: 0, y: -1000, z: 0 }, false);
    stone.state = FREE;
    mesh.setMatrixAt(index, hidden);
    alive -= 1;
  };

  // --- mood and rate, animated by the timeline ---
  // storm: 0 = normal sky, 1 = dark storm sky; rate: 0..1 of the peak spawn rate;
  // sound: 0..1 volume, follows the rate one fall time later (when the stones arrive)
  const mood = { storm: 0, rate: 0, sound: 0 };
  const calm = { brightness: 1, tint: new THREE.Color(1, 1, 1) };
  const applyMood = () => {
    uniforms.skyBrightness.value = lerp(calm.brightness, params.skyBrightness, mood.storm);
    uniforms.skyTint.value.lerpColors(calm.tint, stormTint, mood.storm);
    sound.setVolume(params.volume * mood.sound);
  };

  // --- every frame, after the physics steps (js/physics/world.js) ---
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let spawnBudget = 0;
  physics.onUpdate((delta) => {
    splashes.update(delta);
    if (alive === 0 && mood.rate === 0) return;

    // spawn: whole stones per frame from a running budget, while there's room under the cap
    spawnBudget += params.rate * mood.rate * delta;
    for (let i = 0; i < stones.length && spawnBudget >= 1 && alive < params.cap; i++) {
      if (stones[i].state !== FREE) continue;
      spawn(stones[i]);
      spawnBudget -= 1;
    }
    // no room: drop the rest instead of saving them up
    spawnBudget = Math.min(spawnBudget, 1);

    stones.forEach((stone, index) => {
      if (stone.state === FREE) return;
      const { body } = stone;
      const t = body.translation();
      stone.age += delta;

      // into the water (which moves with the swell): splash and recycle. The water isn't a collider
      const waterY = WATER_LEVEL + water.waveHeightAt(t.x, t.z, camera.position);
      if (t.y < waterY) {
        splashes.splash(t.x, waterY, t.z, stone.radius / params.sizeMax);
        recycle(stone, index);
        return;
      }

      if (stone.state === FALLING) {
        // landed: slow (or asleep: Rapier stops simulating bodies that have stopped) for a moment
        const v = body.linvel();
        const slow = body.isSleeping() || Math.hypot(v.x, v.y, v.z) < REST_SPEED;
        stone.still = slow ? stone.still + delta : 0;
        if (stone.still > REST_DELAY + params.restTime || stone.age > MAX_AGE) stone.state = MELTING;
      } else {
        stone.melt += delta / params.meltTime;
        if (stone.melt >= 1) {
          recycle(stone, index);
          return;
        }
      }

      // copy the body's pose to the instance; melting shrinks it, sinking it so it stays on the deck
      const size = stone.radius * (1 - stone.melt);
      position.set(t.x, t.y - (stone.radius - size), t.z);
      const r = body.rotation();
      quaternion.set(r.x, r.y, r.z, r.w);
      matrix.compose(position, quaternion, scale.setScalar(size));
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  let timeline = null;
  const trigger = () => {
    if (listener.context.state === 'suspended') listener.context.resume();
    // the normal sky to return to, read when the effect starts from a clear sky (so debug tweaks are kept)
    if (mood.storm === 0) {
      calm.brightness = uniforms.skyBrightness.value;
      calm.tint.copy(uniforms.skyTint.value);
    }
    // retriggered: continue from the current darkness and rate
    timeline?.kill();
    const skyIn = params.skyRampIn * (1 - mood.storm);
    const rateRamp = Math.min(params.rateRamp, params.duration / 2);
    const rateUp = rateRamp * (1 - mood.rate);
    // when the rate starts dropping
    const rateDown = skyIn + rateUp + params.duration - 2 * rateRamp;
    // seconds a stone takes to reach the water from the middle of the spawn height (start speed + gravity:
    // h = v·t + g·t²/2, solved for t), so the sound starts and ends as the stones land, not as they spawn
    const h = params.height + 1.5;
    const fall = (Math.sqrt(params.fallSpeed ** 2 + 2 * 9.81 * h) - params.fallSpeed) / 9.81;
    timeline = gsap.timeline({
      onUpdate: applyMood,
      onComplete: () => {
        if (sound.isPlaying) sound.stop();
      },
    });
    timeline
      // the sky darkens, then the hail starts
      .to(mood, { storm: 1, duration: skyIn, ease: 'sine.inOut' }, 0)
      .to(mood, { rate: 1, duration: rateUp, ease: 'sine.in' }, skyIn)
      // full rate for the rest of the duration, then it eases off
      .to(mood, { rate: 0, duration: rateRamp, ease: 'sine.out' }, rateDown)
      // the sound does the same, one fall time later
      .to(mood, { sound: 1, duration: rateRamp * (1 - mood.sound), ease: 'sine.in' }, skyIn + fall)
      .to(mood, { sound: 0, duration: rateRamp, ease: 'sine.out' }, rateDown + fall)
      // the sky clears once the hail stops
      .to(mood, { storm: 0, duration: params.skyRampOut, ease: 'sine.inOut' }, rateDown + rateRamp);
    if (sound.buffer && !sound.isPlaying) sound.play();
  };

  if (gui) {
    const colors = {
      tint: `#${stormTint.getHexString(THREE.LinearSRGBColorSpace)}`,
      stone: `#${material.color.getHexString()}`,
      emissive: `#${material.emissive.getHexString()}`,
    };
    const folder = gui.addFolder('Hagalaz (hail)');
    folder.add({ trigger }, 'trigger').name('trigger');
    folder.add(params, 'skyBrightness', 0, 1, 0.01).name('sky brightness');
    folder.addColor(colors, 'tint').name('sky tint')
      .onChange((value) => stormTint.setStyle(value, THREE.LinearSRGBColorSpace));
    folder.add(params, 'skyRampIn', 0.1, 5, 0.05).name('sky ramp in (s)');
    folder.add(params, 'duration', 0.5, 20, 0.1).name('hail duration (s)');
    folder.add(params, 'rateRamp', 0, 5, 0.05).name('rate ramp (s)');
    folder.add(params, 'skyRampOut', 0.1, 5, 0.05).name('sky ramp out (s)');
    folder.add(params, 'rate', 1, 300, 1).name('stones per second');
    folder.add(params, 'cap', 0, HAGALAZ_CAP_MAX, 1).name('max stones');
    folder.add(params, 'offsetX', -30, 30, 0.5).name('spawn offset x');
    folder.add(params, 'offsetZ', -30, 30, 0.5).name('spawn offset z');
    folder.add(params, 'height', 2, 40, 0.5).name('spawn height');
    folder.add(params, 'width', 1, 60, 0.5).name('spawn width');
    folder.add(params, 'depth', 1, 60, 0.5).name('spawn depth');
    folder.add(params, 'wide', 0, 1, 0.01).name('wide share');
    folder.add(params, 'wideScale', 1, 6, 0.1).name('wide area (×)');
    folder.add(params, 'fallSpeed', 0, 30, 0.5).name('fall speed');
    folder.add(params, 'wind', 0, 10, 0.1).name('wind');
    folder.add(params, 'sizeMin', 0.01, 0.5, 0.005).name('size min');
    folder.add(params, 'sizeMax', 0.01, 0.5, 0.005).name('size max');
    folder.add(params, 'restitution', 0, 1, 0.01).name('restitution (bounce)');
    folder.add(params, 'friction', 0, 2, 0.01);
    folder.add(params, 'restTime', 0, 10, 0.1).name('rest time (s)');
    folder.add(params, 'meltTime', 0.1, 10, 0.1).name('melt time (s)');
    folder.addColor(colors, 'stone').name('stone color').onChange((value) => material.color.set(value));
    folder.addColor(colors, 'emissive').name('glow color').onChange((value) => material.emissive.set(value));
    folder.add(material, 'emissiveIntensity', 0, 3, 0.01).name('glow intensity');
    folder.add(params, 'volume', 0, 2, 0.01);
  }

  return trigger;
};
