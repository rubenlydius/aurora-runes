import * as THREE from 'three/webgpu';
import { wgslFn, uniform, float, vec4, positionLocal, output, agxToneMapping } from 'three/tsl';
import gsap from 'gsap';

import { createEmbers } from './embers.js';
import spreadShader from '../shaders/spread/fragment.wgsl?raw';
import {
  KENAZ_SOUND,
  KENAZ_VOLUME,
  KENAZ_SAIL_MATERIALS,
  KENAZ_ORIGIN,
  KENAZ_BURN_DURATION,
  KENAZ_HOLD,
  KENAZ_REFORM_DURATION,
  KENAZ_FIRE_FADE,
  KENAZ_EDGE_COLOR,
  KENAZ_EDGE_INTENSITY,
  KENAZ_REFORM_GLOW,
  KENAZ_CHAR_COLOR,
  KENAZ_EDGE_WIDTH,
  KENAZ_NOISE_STRENGTH,
  KENAZ_NOISE_SCALE,
  KENAZ_LIGHT_COLOR,
  KENAZ_LIGHT_INTENSITY,
  KENAZ_LIGHT_FLICKER,
  KENAZ_EMBER_MAX,
  KENAZ_EMBER_COUNT,
  KENAZ_EMBER_COLOR,
  KENAZ_EMBER_SIZE,
  KENAZ_EMBER_RISE,
  KENAZ_EMBER_LIFETIME,
} from '../constants/effects.js';

const random = THREE.MathUtils.randFloat;
// world units the fire light sits in front of the cloth, toward the camera: a point light right on a
// surface lights it with near-infinite intensity (decay 2)
const LIGHT_OFFSET = 0.5;

// Kenaz (fire): "the sail burns". A ragged burning front spreads from the bottom centre of the sail
// (js/shaders/spread/fragment.wgsl), with a flickering light and embers following it and a fire sound;
// then the sail grows back with a soft glow. One GSAP timeline times it
export const createKenaz = ({ uniforms, scene, camera, listener, getSail, gui }) => {
  const params = {
    volume: KENAZ_VOLUME,
    originX: KENAZ_ORIGIN.x,
    originY: KENAZ_ORIGIN.y,
    originZ: KENAZ_ORIGIN.z,
    burnDuration: KENAZ_BURN_DURATION,
    hold: KENAZ_HOLD,
    reformDuration: KENAZ_REFORM_DURATION,
    fireFade: KENAZ_FIRE_FADE,
    edgeIntensity: KENAZ_EDGE_INTENSITY,
    reformGlow: KENAZ_REFORM_GLOW,
    lightIntensity: KENAZ_LIGHT_INTENSITY,
    flicker: KENAZ_LIGHT_FLICKER,
    emberCount: KENAZ_EMBER_COUNT,
    emberRise: KENAZ_EMBER_RISE,
    emberLifetime: KENAZ_EMBER_LIFETIME,
  };

  // --- spread shader inputs, shared by all cloth meshes (each mesh adds its own baseColor) ---
  const spread = {
    spreadProgress: uniform(0),
    spreadOrigin: uniform(new THREE.Vector3()),
    spreadSize: uniform(1),
    noiseScale: uniform(KENAZ_NOISE_SCALE),
    noiseStrength: uniform(KENAZ_NOISE_STRENGTH),
    edgeWidth: uniform(KENAZ_EDGE_WIDTH),
    // Color.set() converts the hex (sRGB) to linear, the shader works in linear like the lighting
    edgeColor: uniform(new THREE.Color(KENAZ_EDGE_COLOR)),
    edgeIntensity: uniform(KENAZ_EDGE_INTENSITY),
    charColor: uniform(new THREE.Color(KENAZ_CHAR_COLOR)),
    // fire: burnt cloth is cut away
    discardBurnt: uniform(1),
    // a circle growing around the origin
    planar: uniform(0),
  };
  const spreadFn = wgslFn(spreadShader);

  // the cloth meshes and their local bounding box, set once the ship has loaded
  let cloth = null;
  const box = new THREE.Box3();

  // the origin constants are fractions of the box: turn them into a local point, and measure the
  // distance to the farthest corner (the shader divides by it, so progress 1 always covers the whole sail)
  const updateOrigin = () => {
    const origin = spread.spreadOrigin.value;
    origin.set(
      THREE.MathUtils.lerp(box.min.x, box.max.x, params.originX),
      THREE.MathUtils.lerp(box.min.y, box.max.y, params.originY),
      THREE.MathUtils.lerp(box.min.z, box.max.z, params.originZ),
    );
    let size = 0;
    for (let i = 0; i < 8; i++) {
      const corner = new THREE.Vector3(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      );
      size = Math.max(size, corner.distanceTo(origin));
    }
    spread.spreadSize.value = size;
  };

  // swap the cloth's materials for lit ones driven by the spread shader
  const setupSail = (sail) => {
    cloth = [];
    box.makeEmpty();
    sail.traverse((child) => {
      if (!child.isMesh || !KENAZ_SAIL_MATERIALS.includes(child.material.name)) return;
      cloth.push(child);
      child.geometry.computeBoundingBox();
      // the cloth meshes share one local space (they're parts of the same glTF mesh)
      box.union(child.geometry.boundingBox);

      const original = child.material;
      // the shader's inputs: the shared uniforms, this mesh's own color and the vertex's local position
      const inputs = { localPos: positionLocal, baseColor: uniform(original.color.clone()), ...spread };
      // part 0: vec4(surface color, opacity), part 1: vec4(edge glow, 0)
      const surface = spreadFn({ ...inputs, part: float(0) });
      const glow = spreadFn({ ...inputs, part: float(1) });

      const material = new THREE.MeshStandardNodeMaterial({
        name: original.name,
        roughness: original.roughness,
        metalness: original.metalness,
        side: original.side,
        // fragments with opacity at or below this are discarded: the burnt-away holes
        alphaTest: 0.5,
      });
      // how the outputs plug into the lit material:
      // colorNode    the albedo, replaces material.color: lit by the scene lights like the original cloth
      material.colorNode = surface.xyz;
      // opacityNode  replaces material.opacity; 0 behind the front, so alphaTest cuts it out (the material
      //              stays opaque, no transparency sorting needed)
      material.opacityNode = surface.w;
      // emissiveNode light the surface gives off itself, added after the lighting: the glowing front
      material.emissiveNode = glow.xyz;
      // the same per-material AgX tone mapping the rest of the ship gets (js/utils/toneMapping.js)
      material.outputNode = vec4(agxToneMapping(output.rgb, uniforms.exposure), output.a);
      child.material = material;
    });
    if (cloth.length === 0) console.warn('Kenaz: no sail cloth found, check KENAZ_SAIL_MATERIALS');
    updateOrigin();
  };

  // --- fire light, embers, sound ---
  const light = new THREE.PointLight(KENAZ_LIGHT_COLOR, 0, 0, 2);
  const embers = createEmbers({ max: KENAZ_EMBER_MAX, color: KENAZ_EMBER_COLOR, size: KENAZ_EMBER_SIZE });
  scene.add(light, embers.object);

  const sound = new THREE.Audio(listener);
  sound.setLoop(true);
  new THREE.AudioLoader().load(
    `${import.meta.env.BASE_URL}${KENAZ_SOUND}`,
    (buffer) => sound.setBuffer(buffer),
    undefined,
    (error) => console.error('Kenaz: could not load the fire sound', error),
  );

  // 0 = no fire, 1 = full fire: light, embers and sound volume follow it
  const fire = { value: 0 };

  // the front's distance from the origin in local units (same formula as step 4 in the shader)
  const frontRadius = () => {
    const strength = spread.noiseStrength.value;
    const edge = Math.max(spread.edgeWidth.value, 0.0001);
    const front = THREE.MathUtils.lerp(-0.5 * strength - 0.5 * edge, 1 + 0.5 * strength + 2 * edge, spread.spreadProgress.value);
    return front * spread.spreadSize.value;
  };

  // light: on the sail, above the origin at the height the front's arc reaches on average
  // (the centre of a half circle's arc is at 2/π ≈ 0.64 of its radius), toward the camera
  const lightPoint = new THREE.Vector3();
  const updateLight = () => {
    const origin = spread.spreadOrigin.value;
    const height = THREE.MathUtils.clamp(0.64 * frontRadius(), 0, box.max.y - origin.y);
    lightPoint.set(origin.x, origin.y + height, origin.z);
    cloth[0].localToWorld(lightPoint);
    light.position.copy(camera.position).sub(lightPoint).setLength(LIGHT_OFFSET).add(lightPoint);
  };

  // embers: a random point on the front's ring, on the cloth (false if the point is outside the sail)
  const local = new THREE.Vector3();
  const spawnEmber = (target) => {
    const origin = spread.spreadOrigin.value;
    const size = spread.spreadSize.value;
    for (let attempt = 0; attempt < 3; attempt++) {
      // a little in and out of the ring, like the noise does to the front
      const radius = frontRadius() - 0.5 * spread.edgeWidth.value * size
        + random(-0.5, 0.5) * spread.noiseStrength.value * size;
      if (radius <= 0) return false;
      const angle = random(0, Math.PI * 2);
      local.set(origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, origin.z);
      if (local.x < box.min.x || local.x > box.max.x || local.y < box.min.y || local.y > box.max.y) continue;
      target.copy(cloth[0].localToWorld(local));
      return true;
    }
    return false;
  };

  // every frame (GSAP's ticker, also outside the timeline so the debug scrubbing works): wait for the
  // ship, then flicker the light, move the embers, set the volume
  let flicker = 1;
  let embersAlive = 0;
  gsap.ticker.add((time, deltaMs) => {
    if (!cloth) {
      const sail = getSail();
      if (sail) setupSail(sail);
      return;
    }
    if (cloth.length === 0) return;
    const delta = Math.min(deltaMs / 1000, 0.1);

    // random jitter around 1, smoothed so it flickers instead of strobing
    flicker += (random(1 - params.flicker, 1 + params.flicker) - flicker) * 0.35;
    light.intensity = params.lightIntensity * fire.value * flicker;
    if (fire.value > 0) updateLight();

    // skip the buffer uploads once the fire is out and the last ember has died
    if (fire.value > 0 || embersAlive > 0) {
      embersAlive = embers.update(delta, {
        count: params.emberCount,
        amount: fire.value,
        rise: params.emberRise,
        lifetime: params.emberLifetime,
        spawn: spawnEmber,
      });
    }

    sound.setVolume(params.volume * fire.value);
  });

  let timeline = null;
  const trigger = () => {
    if (listener.context.state === 'suspended') listener.context.resume();
    if (!cloth || cloth.length === 0) {
      console.warn('Kenaz: the ship (sail) has not loaded yet');
      return;
    }
    // retriggered: continue from where the front is now (also halfway through reforming)
    timeline?.kill();
    const remaining = 1 - spread.spreadProgress.value;
    timeline = gsap.timeline({
      onComplete: () => {
        if (sound.isPlaying) sound.stop();
      },
    });
    timeline
      // burn: full glow, the fire comes up, the front crosses the sail at a steady pace
      .to(spread.edgeIntensity, { value: params.edgeIntensity, duration: 0.3 }, 0)
      .to(fire, { value: 1, duration: params.fireFade * (1 - fire.value), ease: 'sine.out' }, 0)
      .to(spread.spreadProgress, { value: 1, duration: params.burnDuration * remaining, ease: 'none' }, 0)
      .addLabel('burnt')
      // the sail is gone: the fire dies out
      .to(fire, { value: 0, duration: params.fireFade, ease: 'sine.in' }, 'burnt')
      // hold, then reform: the front runs back to the origin with a soft glow, the cloth returns behind it
      .set(spread.edgeIntensity, { value: params.reformGlow }, `burnt+=${params.hold}`)
      .to(spread.spreadProgress, { value: 0, duration: params.reformDuration, ease: 'sine.inOut' }, `burnt+=${params.hold}`)
      .set(spread.edgeIntensity, { value: params.edgeIntensity });
    if (sound.buffer && !sound.isPlaying) sound.play();
  };

  if (gui) {
    const colors = {
      edge: `#${spread.edgeColor.value.getHexString()}`,
      char: `#${spread.charColor.value.getHexString()}`,
      light: `#${light.color.getHexString()}`,
      ember: `#${embers.material.color.getHexString()}`,
    };
    const folder = gui.addFolder('Kenaz (fire)');
    folder.add({ trigger }, 'trigger').name('trigger');
    // scrubbing stops a running burn
    folder.add(spread.spreadProgress, 'value', 0, 1, 0.001).name('spread progress').listen()
      .onChange(() => {
        timeline?.kill();
        fire.value = 0;
        if (sound.isPlaying) sound.stop();
      });
    folder.add(params, 'originX', 0, 1, 0.01).name('origin x (0..1)').onChange(updateOrigin);
    folder.add(params, 'originY', 0, 1, 0.01).name('origin y (0..1)').onChange(updateOrigin);
    folder.add(params, 'originZ', 0, 1, 0.01).name('origin z (0..1)').onChange(updateOrigin);
    folder.add(params, 'burnDuration', 0.5, 20, 0.1).name('burn duration (s)');
    folder.add(params, 'hold', 0, 10, 0.1).name('hold (s)');
    folder.add(params, 'reformDuration', 0.5, 10, 0.1).name('reform duration (s)');
    folder.add(params, 'fireFade', 0.1, 5, 0.05).name('fire fade (s)');
    folder.addColor(colors, 'edge').name('edge color').onChange((value) => spread.edgeColor.value.set(value));
    folder.add(params, 'edgeIntensity', 0, 30, 0.1).name('edge intensity')
      .onChange((value) => { spread.edgeIntensity.value = value; });
    folder.add(params, 'reformGlow', 0, 30, 0.1).name('reform glow');
    folder.addColor(colors, 'char').name('char color').onChange((value) => spread.charColor.value.set(value));
    folder.add(spread.edgeWidth, 'value', 0, 0.3, 0.005).name('edge width');
    folder.add(spread.noiseStrength, 'value', 0, 1, 0.01).name('noise strength');
    folder.add(spread.noiseScale, 'value', 0.5, 30, 0.1).name('noise scale');
    folder.addColor(colors, 'light').name('light color').onChange((value) => light.color.set(value));
    folder.add(params, 'lightIntensity', 0, 200, 0.5).name('light intensity');
    folder.add(params, 'flicker', 0, 1, 0.01).name('light flicker');
    folder.add(params, 'emberCount', 0, KENAZ_EMBER_MAX, 1).name('ember count');
    folder.addColor(colors, 'ember').name('ember color').onChange((value) => embers.material.color.set(value));
    folder.add(embers.material, 'size', 0.02, 2, 0.01).name('ember size');
    folder.add(params, 'emberRise', 0, 3, 0.05).name('ember rise speed');
    folder.add(params, 'emberLifetime', 0.2, 6, 0.1).name('ember lifetime (s)');
    folder.add(params, 'volume', 0, 2, 0.01);
  }

  return trigger;
};
