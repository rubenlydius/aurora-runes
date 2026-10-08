import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { SHIP_POSITION, SHIP_ROTATION_Y, SHIP_SCALE, SHIP_ROCKING } from '../constants/scene.js';

// Viking ship model from Poly Pizza, the sail is a separate object so rune effects can target it
export const createShip = async ({ gui } = {}) => {
  const loader = new GLTFLoader();
  // BASE_URL is '/aurora-runes/' on GitHub Pages, so never use a root-absolute path here
  // const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/viking-ship.glb`);
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/viking_ship3.glb`);

  // the outer group holds the placement (constants, sliders), the model inside it rocks
  const ship = new THREE.Group();
  ship.name = 'Ship';
  const model = gltf.scene;
  // yaw is on the outer group, so roll (z, the hull's long axis) and pitch (x) stay in the ship's own axes
  ship.add(model);
  ship.position.set(SHIP_POSITION.x, SHIP_POSITION.y, SHIP_POSITION.z);
  ship.rotation.y = SHIP_ROTATION_Y;
  ship.scale.setScalar(SHIP_SCALE);

  // kept for later (Kenaz burns the sail)
  const sail = ship.getObjectByName('Sail');
  if (!sail) console.warn('ship.js: no object named "Sail" in the ship model');

  const rocking = { ...SHIP_ROCKING };

  const update = (time) => {
    const t = time * rocking.speed;
    // two sines at unrelated speeds per motion, so it never repeats like a metronome
    model.rotation.z = rocking.roll * (Math.sin(t) * 0.7 + Math.sin(t * 0.63 + 1.7) * 0.3);
    model.rotation.x = rocking.pitch * (Math.sin(t * 0.81 + 0.4) * 0.7 + Math.sin(t * 0.47 + 2.9) * 0.3);
    model.position.y = rocking.bob * (Math.sin(t * 0.9 + 1.1) * 0.7 + Math.sin(t * 0.55 + 0.3) * 0.3);
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
  }

  return { ship, sail, update };
};
