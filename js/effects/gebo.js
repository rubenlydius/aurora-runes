import * as THREE from 'three/webgpu';
import gsap from 'gsap';

import { createMeteors } from './meteors.js';
import { sunDirectionFrom } from '../objects/lighting.js';
import {
  GEBO_COUNT,
  GEBO_DURATION,
  GEBO_AZIMUTH_MIN,
  GEBO_AZIMUTH_MAX,
  GEBO_ELEVATION_MIN,
  GEBO_ELEVATION_MAX,
  GEBO_DIRECTION_MIN,
  GEBO_DIRECTION_MAX,
  GEBO_DIRECTION_VARIATION,
  GEBO_SPEED,
  GEBO_LENGTH,
  GEBO_WIDTH,
  GEBO_LIFETIME_MIN,
  GEBO_LIFETIME_MAX,
  GEBO_HEAD_COLOR,
  GEBO_TAIL_COLOR,
  GEBO_BRIGHTNESS,
  GEBO_PAUSE,
  GEBO_FINALE_AZIMUTH,
  GEBO_FINALE_ELEVATION,
  GEBO_FINALE_SIZE,
  GEBO_FINALE_LENGTH,
  GEBO_FINALE_NECK,
  GEBO_FINALE_SPEED,
  GEBO_FINALE_LIFETIME,
  GEBO_FINALE_BRIGHTNESS,
  GEBO_FINALE_FLASH,
} from '../constants/effects.js';

const random = THREE.MathUtils.randFloat;
const toRad = THREE.MathUtils.degToRad;
// the slider allows up to this many meteors in one shower (+1 for the finale)
const MAX_METEORS = 100;

const up = new THREE.Vector3(0, 1, 0);
const view = new THREE.Vector3();
const east = new THREE.Vector3();
const north = new THREE.Vector3();

// Gebo (gift): "gift of shooting stars". A meteor shower over the upper sky, sparse at first and denser
// toward the end, then a pause and one big, slow, bright meteor with a soft flash. One GSAP timeline
export const createGebo = ({ uniforms, camera, scene, gui }) => {
  const params = {
    count: GEBO_COUNT,
    duration: GEBO_DURATION,
    azimuthMin: GEBO_AZIMUTH_MIN,
    azimuthMax: GEBO_AZIMUTH_MAX,
    elevationMin: GEBO_ELEVATION_MIN,
    elevationMax: GEBO_ELEVATION_MAX,
    directionMin: GEBO_DIRECTION_MIN,
    directionMax: GEBO_DIRECTION_MAX,
    variation: GEBO_DIRECTION_VARIATION,
    speed: GEBO_SPEED,
    length: GEBO_LENGTH,
    width: GEBO_WIDTH,
    lifetimeMin: GEBO_LIFETIME_MIN,
    lifetimeMax: GEBO_LIFETIME_MAX,
    brightness: GEBO_BRIGHTNESS,
    headColor: `#${new THREE.Color(GEBO_HEAD_COLOR).getHexString()}`,
    tailColor: `#${new THREE.Color(GEBO_TAIL_COLOR).getHexString()}`,
    pause: GEBO_PAUSE,
    finaleAzimuth: GEBO_FINALE_AZIMUTH,
    finaleElevation: GEBO_FINALE_ELEVATION,
    finaleSize: GEBO_FINALE_SIZE,
    finaleLength: GEBO_FINALE_LENGTH,
    finaleNeck: GEBO_FINALE_NECK,
    finaleSpeed: GEBO_FINALE_SPEED,
    finaleLifetime: GEBO_FINALE_LIFETIME,
    finaleBrightness: GEBO_FINALE_BRIGHTNESS,
    finaleFlash: GEBO_FINALE_FLASH,
  };

  const meteors = createMeteors({ max: MAX_METEORS + 1 });
  scene.add(meteors.mesh);
  // every frame (GSAP's ticker): move the meteors that are flying
  gsap.ticker.add((time, deltaMs) => meteors.update(Math.min(deltaMs / 1000, 0.1), camera.position));

  // a meteor starting at azimuth / elevation (degrees), travelling `direction` degrees on the sky
  // (0 = to the right, 90 = up), with sizes in degrees
  const start = new THREE.Vector3();
  const travel = new THREE.Vector3();
  const launch = ({ azimuth, elevation, direction, speed, length, width, neck, life, brightness }) => {
    sunDirectionFrom(azimuth, elevation, start);
    // the sky's local "right" (east) and "up" (north) at the start point, both tangent to the sphere
    east.crossVectors(start, up).normalize();
    north.crossVectors(east, start).normalize();
    const angle = toRad(direction);
    travel.copy(east).multiplyScalar(Math.cos(angle)).addScaledVector(north, Math.sin(angle));
    meteors.launch({
      start,
      travel,
      speed: toRad(speed),
      length: toRad(length),
      width: toRad(width),
      neck,
      life,
      brightness,
      headColor: params.headColor,
      tailColor: params.tailColor,
    });
  };

  // this shower's direction (degrees), picked on trigger; and whether it travels to the left
  const shower = { direction: -35, leftward: false };
  // the start azimuths are set up for a rightward shower: mirror them around the view's centre when it
  // goes left, so the meteors start on the right and cross the view instead of leaving it straight away
  const showerAzimuth = (azimuth) => {
    if (!shower.leftward) return azimuth;
    camera.getWorldDirection(view);
    // same convention as sunDirectionFrom: 0 = -z, 90 = +x
    const viewAzimuth = THREE.MathUtils.radToDeg(Math.atan2(view.x, -view.z));
    return 2 * viewAzimuth - azimuth;
  };

  const launchShowerMeteor = () => launch({
    azimuth: showerAzimuth(random(params.azimuthMin, params.azimuthMax)),
    elevation: random(params.elevationMin, params.elevationMax),
    direction: shower.direction + random(-params.variation, params.variation),
    speed: params.speed * random(0.8, 1.2),
    length: params.length * random(0.7, 1.2),
    width: params.width,
    life: random(params.lifetimeMin, params.lifetimeMax),
    brightness: params.brightness * random(0.6, 1),
  });

  const launchFinale = () => {
    launch({
      azimuth: showerAzimuth(params.finaleAzimuth),
      elevation: params.finaleElevation,
      direction: shower.direction,
      speed: params.speed * params.finaleSpeed,
      length: params.length * params.finaleLength,
      width: params.width * params.finaleSize,
      neck: params.finaleNeck,
      life: params.finaleLifetime,
      brightness: params.brightness * params.finaleBrightness,
    });
  };

  // flashAmount (shared with Thurisaz): a soft sky flash and key light lift (js/objects/lighting.js)
  const flash = { value: 0 };
  const applyFlash = () => {
    uniforms.flashAmount.value = flash.value;
  };

  let timeline = null;
  const trigger = () => {
    // retriggered: start a new shower, meteors already flying finish on their own
    timeline?.kill();
    if (flash.value > 0) {
      flash.value = 0;
      applyFlash();
    }
    // one random direction for the whole shower, finale included
    shower.direction = random(Math.min(params.directionMin, params.directionMax), Math.max(params.directionMin, params.directionMax));
    shower.leftward = Math.cos(toRad(shower.direction)) < 0;
    timeline = gsap.timeline();

    // spawn times: t = duration · √(i / count). Early on the square root climbs fast, so the gaps are
    // long (sparse); later it flattens, so the gaps shrink (denser)
    const count = Math.round(params.count);
    for (let i = 0; i < count; i++) {
      const at = params.duration * Math.sqrt((i + random(0, 1)) / count);
      timeline.call(launchShowerMeteor, null, at);
    }

    // finale after the pause: the big meteor, and the flash peaking about a third into its life
    const finaleAt = params.duration + params.pause;
    const rise = params.finaleLifetime * 0.3;
    timeline
      .call(launchFinale, null, finaleAt)
      .to(flash, { value: params.finaleFlash, duration: rise, ease: 'sine.inOut', onUpdate: applyFlash }, finaleAt)
      .to(flash, { value: 0, duration: params.finaleLifetime - rise, ease: 'sine.inOut', onUpdate: applyFlash }, '>');
  };

  if (gui) {
    const folder = gui.addFolder('Gebo (shooting stars)');
    folder.add({ trigger }, 'trigger').name('trigger');
    folder.add(params, 'count', 1, MAX_METEORS, 1).name('meteor count');
    folder.add(params, 'duration', 0.5, 15, 0.1).name('shower duration (s)');
    folder.add(params, 'azimuthMin', -180, 180, 1).name('azimuth min (°)');
    folder.add(params, 'azimuthMax', -180, 180, 1).name('azimuth max (°)');
    folder.add(params, 'elevationMin', 0, 89, 1).name('elevation min (°)');
    folder.add(params, 'elevationMax', 0, 89, 1).name('elevation max (°)');
    folder.add(params, 'directionMin', -180, 180, 1).name('direction min (°)');
    folder.add(params, 'directionMax', -180, 180, 1).name('direction max (°)');
    folder.add(shower, 'direction', -180, 180, 1).name('this shower (°)').listen().disable();
    folder.add(params, 'variation', 0, 45, 1).name('direction variation (°)');
    folder.add(params, 'speed', 1, 120, 1).name('speed (°/s)');
    folder.add(params, 'length', 0.5, 40, 0.5).name('length (°)');
    folder.add(params, 'width', 0.02, 1, 0.01).name('width (°)');
    folder.add(params, 'lifetimeMin', 0.1, 3, 0.05).name('lifetime min (s)');
    folder.add(params, 'lifetimeMax', 0.1, 3, 0.05).name('lifetime max (s)');
    folder.add(params, 'brightness', 0, 5, 0.05);
    folder.addColor(params, 'headColor').name('head color');
    folder.addColor(params, 'tailColor').name('tail color');
    folder.add(params, 'pause', 0, 5, 0.05).name('pause before finale (s)');
    folder.add(params, 'finaleAzimuth', -180, 180, 1).name('finale azimuth (°)');
    folder.add(params, 'finaleElevation', 0, 89, 1).name('finale elevation (°)');
    folder.add(params, 'finaleSize', 1, 10, 0.1).name('finale size (×)');
    folder.add(params, 'finaleLength', 0.5, 5, 0.1).name('finale length (×)');
    folder.add(params, 'finaleNeck', 0.5, 4, 0.05).name('finale neck (×)');
    folder.add(params, 'finaleSpeed', 0.1, 2, 0.05).name('finale speed (×)');
    folder.add(params, 'finaleLifetime', 0.5, 6, 0.1).name('finale lifetime (s)');
    folder.add(params, 'finaleBrightness', 0.5, 5, 0.05).name('finale brightness (×)');
    folder.add(params, 'finaleFlash', 0, 1, 0.01).name('finale flash');
  }

  return trigger;
};
