import * as THREE from 'three/webgpu';
import { wgslFn, uniform, float, vec4, positionLocal, output, agxToneMapping } from 'three/tsl';
import gsap from 'gsap';

import spreadShader from '../shaders/spread/fragment.wgsl?raw';
import { rawColorFromHex } from '../objects/lighting.js';
import { WATER_LEVEL } from '../constants/water.js';
import {
  ISA_FREEZE_DURATION,
  ISA_HOLD,
  ISA_THAW_DURATION,
  ISA_ORIGIN,
  ISA_RADIUS,
  ISA_CURVE,
  ISA_EDGE_NOISE,
  ISA_ICE_COLOR,
  ISA_ICE_TINT,
  ISA_ICE_BLUR,
  ISA_CRACK_STRENGTH,
  ISA_CRACK_SCALE,
  ISA_FROST_DURATION,
  ISA_SHIP_STOP,
  ISA_FROST_EDGE_COLOR,
  ISA_FROST_EDGE_INTENSITY,
  ISA_FROST_COLOR,
  ISA_FROST_AMOUNT,
  ISA_FROST_EDGE_WIDTH,
  ISA_FROST_NOISE_STRENGTH,
  ISA_FROST_NOISE_SCALE,
  ISA_KEY_TINT,
  ISA_HEMI_BOOST,
} from '../constants/effects.js';

const lerp = THREE.MathUtils.lerp;
const white = new THREE.Color(1, 1, 1);

// --- sound hooks: Isa has no audio yet. Add sounds here later, the timeline already calls these ---
const hooks = {
  // the freeze starts (water front, frost and aurora slowing begin)
  onFreezeStart: () => {},
  // the thaw starts (fronts go back, aurora speeds up again)
  onThawStart: () => {},
};

// Isa (ice): "the fjord freezes". Ice spreads over the water from the shore (water shader, freezeAmount),
// frost climbs the ship from its waterline (spread shader, planar), the ship stops moving, the aurora freezes
// in place (auroraSpeed 0, the aurora runs on accumulated time so it holds still instead of jumping), the
// light turns colder. Then the ice and frost fade away together (no fronts going back). One GSAP timeline
export const createIsa = ({ uniforms, water, lighting, getShip, gui }) => {
  const params = {
    freezeDuration: ISA_FREEZE_DURATION,
    hold: ISA_HOLD,
    thawDuration: ISA_THAW_DURATION,
    frostDuration: ISA_FROST_DURATION,
    shipStop: ISA_SHIP_STOP,
    frostAmount: ISA_FROST_AMOUNT,
    frostEdgeIntensity: ISA_FROST_EDGE_INTENSITY,
    hemiBoost: ISA_HEMI_BOOST,
  };

  // --- water ice: set the water shader's ice uniforms from the constants ---
  const ice = water.ice;
  ice.iceOrigin.value.set(ISA_ORIGIN.x, ISA_ORIGIN.z);
  ice.iceRadius.value = ISA_RADIUS;
  ice.iceCurve.value = ISA_CURVE;
  ice.iceNoise.value = ISA_EDGE_NOISE;
  // display values, stored as-is like the water's base color
  ice.iceColor.value.copy(rawColorFromHex(ISA_ICE_COLOR));
  ice.iceTint.value = ISA_ICE_TINT;
  ice.iceBlur.value = ISA_ICE_BLUR;
  ice.crackStrength.value = ISA_CRACK_STRENGTH;
  ice.crackScale.value = ISA_CRACK_SCALE;

  // --- ship frost: the spread shader on the hull (with mast and oars), its own uniforms (not Kenaz's) ---
  const frost = {
    spreadProgress: uniform(0),
    spreadOrigin: uniform(new THREE.Vector3()),
    // a level rising (and sinking) from the waterline instead of a circle
    planar: uniform(1),
    spreadSize: uniform(1),
    noiseScale: uniform(ISA_FROST_NOISE_SCALE),
    noiseStrength: uniform(ISA_FROST_NOISE_STRENGTH),
    edgeWidth: uniform(ISA_FROST_EDGE_WIDTH),
    edgeColor: uniform(new THREE.Color(ISA_FROST_EDGE_COLOR)),
    edgeIntensity: uniform(ISA_FROST_EDGE_INTENSITY),
    // frost covers the wood, it doesn't remove it
    discardBurnt: uniform(0),
  };
  const frostColor = new THREE.Color(ISA_FROST_COLOR);
  const spreadFn = wgslFn(spreadShader);
  // per hull mesh: its original color and its own frosted color (charColor) = original blended toward frost.
  // frostFade: 1 = full frost, 0 = melted (the thaw fades the frosted color and the icy edge out)
  let hullMeshes = null;
  const frostFade = { value: 1 };
  const updateFrostColors = () => {
    if (!hullMeshes) return;
    for (const { baseColor, charColor } of hullMeshes) {
      charColor.value.copy(baseColor.value).lerp(frostColor, params.frostAmount * frostFade.value);
    }
    frost.edgeIntensity.value = params.frostEdgeIntensity * frostFade.value;
  };

  const setupHull = (hull) => {
    hullMeshes = [];
    const box = new THREE.Box3();
    hull.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.computeBoundingBox();
      // the hull's meshes share one local space (parts of the same glTF mesh)
      box.union(child.geometry.boundingBox);

      const original = child.material;
      const baseColor = uniform(original.color.clone());
      const charColor = uniform(new THREE.Color());
      const inputs = { localPos: positionLocal, baseColor, charColor, ...frost };
      const material = new THREE.MeshStandardNodeMaterial({
        name: original.name,
        roughness: original.roughness,
        metalness: original.metalness,
        side: original.side,
      });
      // part 0: surface color (lit like the original), part 1: the icy edge's glow (emissive).
      // No opacity: frost never cuts anything away
      material.colorNode = spreadFn({ ...inputs, part: float(0) }).xyz;
      material.emissiveNode = spreadFn({ ...inputs, part: float(1) }).xyz;
      // the same per-material AgX tone mapping the rest of the ship gets (js/utils/toneMapping.js)
      material.outputNode = vec4(agxToneMapping(output.rgb, uniforms.exposure), output.a);
      child.material = material;
      hullMeshes.push({ baseColor, charColor });
    });
    updateFrostColors();

    // origin: the waterline (world y = WATER_LEVEL) in the hull's local space, centred on the hull
    hull.updateWorldMatrix(true, false);
    const center = box.getCenter(new THREE.Vector3());
    const waterline = hull.worldToLocal(hull.localToWorld(center.clone()).setY(WATER_LEVEL));
    frost.spreadOrigin.value.set(center.x, waterline.y, center.z);
    // planar: the farthest level from the waterline, up (mast top) or down (keel)
    frost.spreadSize.value = Math.max(box.max.y - waterline.y, waterline.y - box.min.y);
  };

  // wait for the ship (it loads asynchronously), then set up the frost once
  const waitForShip = () => {
    const hull = getShip()?.getObjectByName('Viking_Ship');
    if (!hull) return;
    gsap.ticker.remove(waitForShip);
    setupHull(hull);
  };
  gsap.ticker.add(waitForShip);

  // --- state the timeline animates ---
  // shipFreeze: 0..1, read by the ship's update (js/script.js -> js/objects/ship.js); cold: light mood 0..1
  const shipFreeze = { value: 0 };
  const mood = { cold: 0 };
  const coolTint = new THREE.Color(ISA_KEY_TINT);
  const applyMood = () => {
    lighting.adjust.keyTint.lerpColors(white, coolTint, mood.cold);
    lighting.adjust.hemiScale = lerp(1, params.hemiBoost, mood.cold);
    updateFrostColors();
  };
  // after the thaw: back to unfrozen, with the fades reset for the next time
  const reset = () => {
    ice.freezeAmount.value = 0;
    ice.iceFade.value = 1;
    frost.spreadProgress.value = 0;
    frostFade.value = 1;
    updateFrostColors();
  };
  // the aurora speed to return to, read when the effect starts from unfrozen
  let calmAuroraSpeed = 1;

  // freezeAmount at which the water front reaches the ship (front radius = radius · freeze^curve)
  const freezeAtShip = () => {
    const ship = uniforms.shipPosition.value;
    const distance = Math.hypot(ship.x - ice.iceOrigin.value.x, ship.z - ice.iceOrigin.value.y);
    return Math.min(Math.pow(distance / ice.iceRadius.value, 1 / ice.iceCurve.value), 1);
  };

  let timeline = null;
  const trigger = () => {
    if (ice.freezeAmount.value === 0) calmAuroraSpeed = uniforms.auroraSpeed.value;
    // retriggered: continue from the current state, only the remaining part of each ramp
    timeline?.kill();
    const freeze = ice.freezeAmount.value;
    const shipAt = freezeAtShip();
    // the freeze runs linearly (the curve is in the shader), so the front reaches the ship at a known time
    const freezeTime = params.freezeDuration * (1 - freeze);
    const shipTime = Math.max(shipAt - freeze, 0) * params.freezeDuration;
    const thawAt = freezeTime + params.hold;

    timeline = gsap.timeline({ onUpdate: applyMood, onComplete: reset });
    timeline
      .call(hooks.onFreezeStart, null, 0)
      // retriggered during a thaw: bring the fading ice and frost back first
      .to(ice.iceFade, { value: 1, duration: 1 - ice.iceFade.value, ease: 'sine.out' }, 0)
      .to(frostFade, { value: 1, duration: 1 - frostFade.value, ease: 'sine.out' }, 0)
      // freeze: the water front spreads, the aurora slows to a standstill, the light cools
      .to(ice.freezeAmount, { value: 1, duration: freezeTime, ease: 'none' }, 0)
      .to(uniforms.auroraSpeed, { value: 0, duration: freezeTime, ease: 'sine.inOut' }, 0)
      .to(mood, { cold: 1, duration: freezeTime, ease: 'sine.inOut' }, 0)
      // when the ice reaches the ship: frost climbs it, its motion eases to a stop
      .to(frost.spreadProgress, { value: 1, duration: params.frostDuration * (1 - frost.spreadProgress.value), ease: 'sine.out' }, shipTime)
      .to(shipFreeze, { value: 1, duration: params.shipStop * (1 - shipFreeze.value), ease: 'sine.out' }, shipTime)
      // hold, then thaw: the ice and frost fade away everywhere at once, the ship comes loose, the aurora
      // speeds up again, the light warms (reset() then clears the fronts for the next freeze)
      .call(hooks.onThawStart, null, thawAt)
      .to(ice.iceFade, { value: 0, duration: params.thawDuration, ease: 'sine.inOut' }, thawAt)
      .to(frostFade, { value: 0, duration: params.thawDuration, ease: 'sine.inOut' }, thawAt)
      .to(shipFreeze, { value: 0, duration: params.thawDuration, ease: 'sine.in' }, thawAt)
      .to(uniforms.auroraSpeed, { value: calmAuroraSpeed, duration: params.thawDuration, ease: 'sine.inOut' }, thawAt)
      .to(mood, { cold: 0, duration: params.thawDuration, ease: 'sine.inOut' }, thawAt);
  };

  if (gui) {
    const colors = {
      ice: `#${ice.iceColor.value.getHexString(THREE.LinearSRGBColorSpace)}`,
      frostEdge: `#${frost.edgeColor.value.getHexString()}`,
      frost: `#${frostColor.getHexString()}`,
      keyTint: `#${coolTint.getHexString()}`,
    };
    // scrubbing stops a running freeze
    const stop = () => timeline?.kill();
    const folder = gui.addFolder('Isa (ice)');
    folder.add({ trigger }, 'trigger').name('trigger');
    folder.add(ice.freezeAmount, 'value', 0, 1, 0.001).name('freeze amount').listen().onChange(stop);
    folder.add(frost.spreadProgress, 'value', 0, 1, 0.001).name('frost progress').listen().onChange(stop);
    folder.add(params, 'freezeDuration', 0.5, 15, 0.1).name('freeze duration (s)');
    folder.add(params, 'hold', 0, 15, 0.1).name('hold (s)');
    folder.add(params, 'thawDuration', 0.5, 15, 0.1).name('thaw duration (s)');
    folder.add(ice.iceOrigin.value, 'x', -100, 100, 0.5).name('ice origin x');
    folder.add(ice.iceOrigin.value, 'y', -100, 100, 0.5).name('ice origin z');
    folder.add(ice.iceRadius, 'value', 10, 1500, 1).name('ice radius');
    folder.add(ice.iceCurve, 'value', 0.5, 5, 0.05).name('ice front curve');
    folder.add(ice.iceNoise, 'value', 0, 3, 0.01).name('ice front noise');
    folder.addColor(colors, 'ice').name('ice color')
      .onChange((value) => ice.iceColor.value.setStyle(value, THREE.LinearSRGBColorSpace));
    folder.add(ice.iceTint, 'value', 0, 1, 0.005).name('ice tint');
    folder.add(ice.iceBlur, 'value', 0, 1, 0.005).name('ice blur');
    folder.add(ice.crackStrength, 'value', 0, 2, 0.01).name('crack strength');
    folder.add(ice.crackScale, 'value', 0.02, 2, 0.01).name('crack scale');
    folder.add(params, 'frostDuration', 0.2, 10, 0.1).name('frost duration (s)');
    folder.add(params, 'shipStop', 0.1, 5, 0.05).name('ship stop (s)');
    folder.addColor(colors, 'frostEdge').name('frost edge color').onChange((value) => frost.edgeColor.value.set(value));
    folder.add(params, 'frostEdgeIntensity', 0, 10, 0.05).name('frost edge intensity').onChange(updateFrostColors);
    folder.addColor(colors, 'frost').name('frost color').onChange((value) => {
      frostColor.set(value);
      updateFrostColors();
    });
    folder.add(params, 'frostAmount', 0, 1, 0.01).name('frost amount').onChange(updateFrostColors);
    folder.add(frost.edgeWidth, 'value', 0, 0.3, 0.005).name('frost edge width');
    folder.add(frost.noiseStrength, 'value', 0, 1, 0.01).name('frost noise strength');
    folder.add(frost.noiseScale, 'value', 0.5, 30, 0.1).name('frost noise scale');
    folder.addColor(colors, 'keyTint').name('key light tint').onChange((value) => coolTint.set(value));
    folder.add(params, 'hemiBoost', 0.5, 4, 0.05).name('fill light boost (×)');
  }

  return { trigger, shipFreeze };
};
