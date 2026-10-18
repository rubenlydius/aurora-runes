import * as THREE from 'three/webgpu';
import { instancedBufferAttribute } from 'three/tsl';

const random = THREE.MathUtils.randFloat;
// droplets per splash, how long they live (seconds), gravity on them (world units per second²)
const DROPLETS = 5;
const LIFETIME = 0.45;
const GRAVITY = 9.81;

// tiny water splashes: a few droplets thrown up and falling back, where a hailstone hits the water.
// Like the embers (js/effects/embers.js): one instanced Sprite, unlit and additive, moved in JS, pooled
export const createSplashes = ({ max, color, size }) => {
  const positions = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const alphas = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  positions.setUsage(THREE.DynamicDrawUsage);
  alphas.setUsage(THREE.DynamicDrawUsage);
  const life = new Float32Array(max);
  const velocity = new Float32Array(max * 3);
  // the next droplet slot to use: round robin, a new splash takes over the oldest droplets when full
  let next = 0;
  let alive = 0;

  const material = new THREE.PointsNodeMaterial({
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  material.size = size;
  material.positionNode = instancedBufferAttribute(positions);
  material.opacityNode = instancedBufferAttribute(alphas);

  const object = new THREE.Sprite(material);
  object.count = max;
  object.frustumCulled = false;

  // a splash at world x, y, z, scaled by the stone's size (0..1)
  const splash = (x, y, z, strength = 1) => {
    const p = positions.array;
    for (let n = 0; n < DROPLETS; n++) {
      const i = next;
      next = (next + 1) % max;
      p[i * 3] = x;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = z;
      velocity[i * 3] = random(-0.6, 0.6) * strength;
      velocity[i * 3 + 1] = random(1.2, 2.4) * strength;
      velocity[i * 3 + 2] = random(-0.6, 0.6) * strength;
      life[i] = LIFETIME * random(0.6, 1);
    }
    alive = max;
  };

  const update = (delta) => {
    // nothing in the air: skip the loop and the buffer uploads
    if (alive === 0) return;
    alive = 0;
    const p = positions.array;
    const a = alphas.array;
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) {
        a[i] = 0;
        continue;
      }
      alive += 1;
      life[i] -= delta;
      velocity[i * 3 + 1] -= GRAVITY * delta;
      p[i * 3] += velocity[i * 3] * delta;
      p[i * 3 + 1] += velocity[i * 3 + 1] * delta;
      p[i * 3 + 2] += velocity[i * 3 + 2] * delta;
      a[i] = Math.max(life[i] / LIFETIME, 0);
    }
    positions.needsUpdate = true;
    alphas.needsUpdate = true;
  };

  return { object, splash, update };
};
