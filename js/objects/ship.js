import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { SHIP_POSITION, SHIP_ROTATION_Y, SHIP_SCALE } from '../constants/scene.js';

// Viking ship model from Poly Pizza, the sail is a separate object so rune effects can target it
export const createShip = async ({ gui } = {}) => {
  const loader = new GLTFLoader();
  // BASE_URL is '/aurora-runes/' on GitHub Pages, so never use a root-absolute path here
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/viking-ship.glb`);

  const ship = gltf.scene;
  ship.name = 'Ship';
  ship.position.set(SHIP_POSITION.x, SHIP_POSITION.y, SHIP_POSITION.z);
  ship.rotation.y = SHIP_ROTATION_Y;
  ship.scale.setScalar(SHIP_SCALE);

  // kept for later (Kenaz burns the sail)
  const sail = ship.getObjectByName('Sail');
  if (!sail) console.warn('ship.js: no object named "Sail" in viking-ship.glb');

  if (gui) {
    const folder = gui.addFolder('Ship');
    folder.add(ship.position, 'x', -40, 40, 0.1).name('position x');
    folder.add(ship.position, 'y', SHIP_POSITION.y - 3, SHIP_POSITION.y + 3, 0.05).name('position y');
    folder.add(ship.position, 'z', -100, 0, 0.1).name('position z');
    folder.add(ship.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rotation y');
    // scale is a Vector3, the slider drives all three axes through one value
    const params = { scale: SHIP_SCALE };
    folder.add(params, 'scale', 0.1, 5, 0.05).onChange((value) => ship.scale.setScalar(value));
  }

  return { ship, sail };
};
