import * as THREE from 'three/webgpu';
import { instancedBufferAttribute } from 'three/tsl';

const random = THREE.MathUtils.randFloat;

// soft round dot for each ember: white with a radial alpha falloff (the material color tints it)
const createDotTexture = () => {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

// small glowing particles that rise, wander and fade. Unlit and additive, drawn as one instanced Sprite:
// WebGPU draws real points only 1 pixel wide, so each ember is a camera-facing quad with a size.
// Positions are world space, updated in JS every frame
export const createEmbers = ({ max, color, size }) => {
  const positions = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
  const alphas = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  positions.setUsage(THREE.DynamicDrawUsage);
  alphas.setUsage(THREE.DynamicDrawUsage);
  // per ember: seconds left (<= 0 = dead), its total lifetime, velocity
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max).fill(1);
  const velocity = new Float32Array(max * 3);

  const material = new THREE.PointsNodeMaterial({
    color,
    map: createDotTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  material.size = size;
  // each instance reads its own position and brightness
  material.positionNode = instancedBufferAttribute(positions);
  material.opacityNode = instancedBufferAttribute(alphas);

  const object = new THREE.Sprite(material);
  object.count = max;
  // the embers move all over the place, skip culling
  object.frustumCulled = false;

  const spawnPoint = new THREE.Vector3();

  // spawn(target): writes a world-space start point into target, returns false when there's nowhere to spawn
  // amount: 0..1, how strongly dead embers come back (0 = none, the living ones still finish their life).
  // returns how many embers are alive
  const update = (delta, { count, amount, rise, lifetime, spawn }) => {
    const p = positions.array;
    const a = alphas.array;
    let alive = 0;
    for (let i = 0; i < max; i++) {
      const i3 = i * 3;
      if (life[i] <= 0) {
        a[i] = 0;
        // over the slider's count, or not lucky this frame: stay dead
        if (i >= count || Math.random() > amount * delta * 4 || !spawn(spawnPoint)) continue;
        p[i3] = spawnPoint.x;
        p[i3 + 1] = spawnPoint.y;
        p[i3 + 2] = spawnPoint.z;
        velocity[i3] = random(-0.15, 0.15);
        velocity[i3 + 1] = rise * random(0.6, 1.3);
        velocity[i3 + 2] = random(-0.15, 0.15);
        maxLife[i] = lifetime * random(0.6, 1.2);
        life[i] = maxLife[i];
      }
      life[i] -= delta;
      alive += 1;
      // wander sideways a little, like they're carried by the hot air
      velocity[i3] += random(-1, 1) * delta * 0.6;
      velocity[i3 + 2] += random(-1, 1) * delta * 0.6;
      p[i3] += velocity[i3] * delta;
      p[i3 + 1] += velocity[i3 + 1] * delta;
      p[i3 + 2] += velocity[i3 + 2] * delta;
      // t: 1 at birth, 0 at death; quick fade in, slow fade out, with a twinkle
      const t = Math.max(life[i] / maxLife[i], 0);
      a[i] = Math.min((1 - t) * 8, 1) * t * random(0.6, 1);
    }
    positions.needsUpdate = true;
    alphas.needsUpdate = true;
    return alive;
  };

  return { object, material, update };
};
