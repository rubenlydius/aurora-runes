import * as THREE from 'three/webgpu';

import { SKY_RADIUS } from '../objects/sky.js';

const smoothstep = THREE.MathUtils.smoothstep;
// the meteors fly on a sphere just inside the sky sphere (centred on the camera, like the sky)
const RADIUS = SKY_RADIUS * 0.9;
// each streak is a strip with three cross-sections: head, middle, tail
const SECTIONS = 3;
// where the middle section sits, as a fraction of the streak from the head
const MIDDLE = 0.35;
// round head: a nonagon (9-sided disc) centred on the head, bright in the middle and fading to nothing at
// its rim, so the streak doesn't end in a square edge. Its radius is a fraction of the meteor's width
const CAP_SIDES = 9;
const CAP_RADIUS = 0.6;
// vertices per meteor: two per strip cross-section, then the cap's centre and its rim corners
const STRIP_VERTICES = SECTIONS * 2;
const PER_METEOR = STRIP_VERTICES + 1 + CAP_SIDES;

const head = new THREE.Vector3();
const middle = new THREE.Vector3();
const tail = new THREE.Vector3();
const tangent = new THREE.Vector3();
const side = new THREE.Vector3();
const rim = new THREE.Vector3();
const color = new THREE.Color();

// meteor streaks: thin camera-facing strips (WebGPU lines are only 1 pixel wide), bright at the head and
// fading to nothing at the tail through vertex colors, with a round glowing head (a nonagon). All meteors share one pooled mesh (one draw call):
// a fixed number of strips, unused ones collapsed to a point. Unlit, additive (black adds nothing, so the
// dark tail is see-through), positions rebuilt in JS every frame while any meteor is flying
export const createMeteors = ({ max }) => {
  const vertices = max * PER_METEOR;
  const positions = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3);
  const colors = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3);
  positions.setUsage(THREE.DynamicDrawUsage);
  colors.setUsage(THREE.DynamicDrawUsage);
  const indices = [];
  for (let m = 0; m < max; m++) {
    const first = m * PER_METEOR;
    // strip: two triangles between each pair of neighbouring cross-sections (left/right vertex each)
    for (let s = 0; s < SECTIONS - 1; s++) {
      const a = first + s * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    // cap: a fan of triangles from the centre to each pair of neighbouring rim corners
    const centre = first + STRIP_VERTICES;
    for (let k = 0; k < CAP_SIDES; k++) {
      indices.push(centre, centre + 1 + k, centre + 1 + ((k + 1) % CAP_SIDES));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicNodeMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  // positions change every frame and are spread over the whole sky
  mesh.frustumCulled = false;

  // per meteor: start direction (unit), travel direction (unit, perpendicular to it), angles in radians
  const meteors = Array.from({ length: max }, () => ({
    active: false,
    age: 0,
    life: 1,
    start: new THREE.Vector3(),
    travel: new THREE.Vector3(),
    speed: 0,
    length: 0,
    width: 0,
    neck: 1,
    brightness: 1,
    fadeStart: 0.55,
    path: null,
    headAt: null,
    headColor: new THREE.Color(),
    tailColor: new THREE.Color(),
  }));
  let flying = 0;

  // { start, travel, speed, length, width (radians), neck, life (s), brightness, headColor, tailColor };
  // neck: width multiplier for the trail just behind the head (1 = normal)
  // optional, for a streak on any path instead of across the sky (Tiwaz's spear):
  //   path(s, target)  writes the world point at path position s into target (start, travel, speed unused)
  //   headAt()         the head's current path position, e.g. a value GSAP animates (instead of speed · age)
  //   fadeStart        fraction of the life after which it fades out (default 0.55)
  // takes a free slot, or the oldest meteor when all are in use
  const launch = (options) => {
    let meteor = meteors.find((m) => !m.active);
    if (!meteor) meteor = meteors.reduce((oldest, m) => (m.age / m.life > oldest.age / oldest.life ? m : oldest));
    else flying += 1;
    meteor.active = true;
    meteor.age = 0;
    // (a meteor on its own path has no start, travel or speed)
    if (options.start) meteor.start.copy(options.start);
    if (options.travel) meteor.travel.copy(options.travel);
    meteor.speed = options.speed ?? 0;
    meteor.length = options.length;
    meteor.width = options.width;
    meteor.neck = options.neck ?? 1;
    meteor.life = options.life;
    meteor.brightness = options.brightness;
    meteor.fadeStart = options.fadeStart ?? 0.55;
    meteor.path = options.path ?? null;
    meteor.headAt = options.headAt ?? null;
    meteor.headColor.set(options.headColor);
    meteor.tailColor.set(options.tailColor);
  };

  // point on the meteor's great circle, `angle` radians from its start, in world space around the camera;
  // or, for a meteor with its own path, that path's point
  const pointAt = (meteor, angle, target, cameraPosition) => {
    if (meteor.path) return meteor.path(angle, target);
    return target
      .copy(meteor.start).multiplyScalar(Math.cos(angle))
      .addScaledVector(meteor.travel, Math.sin(angle))
      .multiplyScalar(RADIUS)
      .add(cameraPosition);
  };

  // one cross-section: two vertices (from vertex `index` on), `width` world units apart, sideways to the
  // streak and the view
  const writeSection = (index, point, width, r, g, b, cameraPosition) => {
    side.subVectors(point, cameraPosition).cross(tangent).normalize().multiplyScalar(width / 2);
    positions.setXYZ(index, point.x + side.x, point.y + side.y, point.z + side.z);
    positions.setXYZ(index + 1, point.x - side.x, point.y - side.y, point.z - side.z);
    colors.setXYZ(index, r, g, b);
    colors.setXYZ(index + 1, r, g, b);
  };

  // the round head (from vertex `index` on): centre at the head in the head color, rim corners black.
  // The disc lies across the view, spanned by the streak's direction and its sideways direction
  const writeCap = (index, point, radius, r, g, b, cameraPosition) => {
    side.subVectors(point, cameraPosition).cross(tangent).normalize();
    positions.setXYZ(index, point.x, point.y, point.z);
    colors.setXYZ(index, r, g, b);
    for (let k = 0; k < CAP_SIDES; k++) {
      const angle = (k / CAP_SIDES) * Math.PI * 2;
      rim.copy(point)
        .addScaledVector(side, Math.cos(angle) * radius)
        .addScaledVector(tangent, Math.sin(angle) * radius);
      positions.setXYZ(index + 1 + k, rim.x, rim.y, rim.z);
      colors.setXYZ(index + 1 + k, 0, 0, 0);
    }
  };

  // collapse a meteor's vertices to a point: nothing drawn
  const hide = (first) => {
    for (let i = first; i < first + PER_METEOR; i++) positions.setXYZ(i, 0, 0, 0);
  };

  const update = (delta, cameraPosition) => {
    if (flying === 0) return;
    meteors.forEach((meteor, m) => {
      const first = m * PER_METEOR;
      if (!meteor.active) {
        hide(first);
        return;
      }
      meteor.age += delta;
      const t = meteor.age / meteor.life;
      if (t >= 1) {
        meteor.active = false;
        flying -= 1;
        hide(first);
        return;
      }
      // the head moves along the circle; the tail starts at the start point and trails at most `length`
      // behind, so the streak grows out of its start, then travels
      const headAngle = meteor.headAt ? meteor.headAt() : meteor.speed * meteor.age;
      const tailAngle = Math.max(headAngle - meteor.length, 0);
      pointAt(meteor, headAngle, head, cameraPosition);
      pointAt(meteor, tailAngle, tail, cameraPosition);
      pointAt(meteor, headAngle - (headAngle - tailAngle) * MIDDLE, middle, cameraPosition);
      tangent.subVectors(head, tail).normalize();

      // brightness over its life: quick flare up, then fade out over the second half
      const fade = smoothstep(t, 0, 0.12) * (1 - smoothstep(t, meteor.fadeStart, 1)) * meteor.brightness;
      // widths are angles: world width = angle · distance from the camera, so a streak looks equally thick
      // near and far (on the sky sphere that distance is always RADIUS)
      const width = meteor.width * head.distanceTo(cameraPosition);
      const middleWidth = meteor.width * middle.distanceTo(cameraPosition);
      const tailWidth = meteor.width * tail.distanceTo(cameraPosition);
      // head: half width (its square corners sit inside the round cap's glow) and full color;
      // middle: between head and tail color, dimmer; tail: black. Then the cap over the head
      color.copy(meteor.headColor).multiplyScalar(fade);
      writeSection(first, head, width * 0.5, color.r, color.g, color.b, cameraPosition);
      writeCap(first + STRIP_VERTICES, head, width * CAP_RADIUS, color.r, color.g, color.b, cameraPosition);
      color.lerpColors(meteor.headColor, meteor.tailColor, 0.5).multiplyScalar(fade * 0.35);
      writeSection(first + 2, middle, middleWidth * 0.45 * meteor.neck, color.r, color.g, color.b, cameraPosition);
      writeSection(first + 4, tail, tailWidth * 0.1, 0, 0, 0, cameraPosition);
    });
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  };

  return { mesh, material, launch, update };
};
