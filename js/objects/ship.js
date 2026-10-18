import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { SHIP_POSITION, SHIP_ROTATION_Y, SHIP_SCALE, SHIP_ROCKING, SHIP_FLOAT } from '../constants/scene.js';
import { WATER_LEVEL } from '../constants/water.js';

// Viking ship model from Poly Pizza, the sail is a separate object so rune effects can target it
export const createShip = async ({ gui } = {}) => {
  const loader = new GLTFLoader();
  // BASE_URL is '/aurora-runes/' on GitHub Pages, so never use a root-absolute path here
  // const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/viking-ship.glb`);
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/viking-ship2.glb`);

  // the outer group holds the placement (constants, sliders), the model inside it rocks
  const ship = new THREE.Group();
  ship.name = 'Ship';
  const model = gltf.scene;
  // yaw is on the outer group, so roll (z, the hull's long axis) and pitch (x) stay in the ship's own axes
  // pivot at the waterline (in model units), the ship floats on the swell around it: a boat tips around
  // the waterline, not its keel. The anchor moves the model back down, so it sits where it did before
  const waterline = (WATER_LEVEL - SHIP_POSITION.y) / SHIP_SCALE;
  const pivot = new THREE.Group();
  pivot.name = 'Ship pivot';
  pivot.position.y = waterline;
  const anchor = new THREE.Group();
  anchor.position.y = -waterline;
  anchor.add(model);
  pivot.add(anchor);
  ship.add(pivot);
  ship.position.set(SHIP_POSITION.x, SHIP_POSITION.y, SHIP_POSITION.z);
  ship.rotation.y = SHIP_ROTATION_Y;
  ship.scale.setScalar(SHIP_SCALE);

  // kept for later (Kenaz burns the sail)
  const sail = ship.getObjectByName('Sail');
  if (!sail) console.warn('ship.js: no object named "Sail" in the ship model');

  const rocking = { ...SHIP_ROCKING };
  const float = { ...SHIP_FLOAT };
  const restY = pivot.position.y;
  let lastTime = null;
  // hull sample points in the ship's own xz (model units): bow, stern, starboard (+x), port (-x)
  const sample = new THREE.Vector3();
  const heightUnder = (localX, localZ, heightAt) => {
    sample.set(localX, 0, localZ);
    ship.localToWorld(sample);
    return heightAt(sample.x, sample.z);
  };

  // heightAt(x, z): the swell's height at world x, z (0 on calm water); swellHeight: the current wave height;
  // frozen: 0..1, held by the ice (Isa): the floating stops where it is and the rocking eases out
  const update = (time, heightAt, swellHeight = 0, frozen = 0) => {
    // floating: rise with the average water height, tip toward the water's slope under the hull
    const delta = lastTime === null ? 0 : time - lastTime;
    lastTime = time;
    if (heightAt) {
      const bow = heightUnder(0, float.halfLength, heightAt);
      const stern = heightUnder(0, -float.halfLength, heightAt);
      const starboard = heightUnder(float.halfWidth, 0, heightAt);
      const port = heightUnder(-float.halfWidth, 0, heightAt);
      const scale = ship.scale.x;
      // heights are world units, the pivot lives in model units (inside the scaled group)
      const targetY = restY + ((bow + stern + starboard + port) / 4 + float.lift * swellHeight) / scale;
      // rotation z lifts +x for positive angles, rotation x lowers +z for positive angles
      const targetRoll = Math.atan2(starboard - port, 2 * float.halfWidth * scale);
      const targetPitch = -Math.atan2(bow - stern, 2 * float.halfLength * scale);
      // ease toward the water instead of snapping to it: the ship has weight
      // frozen in: follow less and less, at 1 the pivot stays exactly where the ice caught it
      const follow = (1 - Math.exp(-float.response * delta)) * (1 - frozen);
      pivot.position.y += (targetY - pivot.position.y) * follow;
      pivot.rotation.z += (targetRoll - pivot.rotation.z) * follow;
      pivot.rotation.x += (targetPitch - pivot.rotation.x) * follow;
    }

    const t = time * rocking.speed;
    // the ice also stills the gentle rocking (eases to the upright pose)
    const free = 1 - frozen;
    // two sines at unrelated speeds per motion, so it never repeats like a metronome
    model.rotation.z = free * rocking.roll * (Math.sin(t) * 0.7 + Math.sin(t * 0.63 + 1.7) * 0.3);
    model.rotation.x = free * rocking.pitch * (Math.sin(t * 0.81 + 0.4) * 0.7 + Math.sin(t * 0.47 + 2.9) * 0.3);
    model.position.y = free * rocking.bob * (Math.sin(t * 0.9 + 1.1) * 0.7 + Math.sin(t * 0.55 + 0.3) * 0.3);
  };

  if (gui) {
    const folder = gui.addFolder('Ship');
    folder.add(ship.position, 'x', -40, 40, 0.1).name('position x');
    folder.add(ship.position, 'y', SHIP_POSITION.y - 3, SHIP_POSITION.y + 3, 0.05).name('position y');
    folder.add(ship.position, 'z', -100, 0, 0.1).name('position z');
    folder.add(ship.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rotation y');
    // scale is a Vector3, the slider drives all three axes through one value
    const params = { scale: SHIP_SCALE };
    folder.add(params, 'scale', 0.1, 5, 0.05).onChange((value) => ship.scale.setScalar(value));
    folder.add(rocking, 'roll', 0, 0.2, 0.001).name('rock roll');
    folder.add(rocking, 'pitch', 0, 0.2, 0.001).name('rock pitch');
    folder.add(rocking, 'bob', 0, 0.3, 0.005).name('rock bob');
    folder.add(rocking, 'speed', 0, 3, 0.01).name('rock speed');
    folder.add(float, 'response', 0.1, 10, 0.1).name('float response');
    folder.add(float, 'lift', 0, 2, 0.01).name('float lift');
  }

  return { ship, sail, pivot, update };
};
