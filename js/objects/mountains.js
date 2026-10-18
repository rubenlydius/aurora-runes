import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { MOUNTAINS } from '../constants/scene.js';

// mountain ridge on the far side of the fjord: the same model placed several times (see MOUNTAINS)
export const createMountains = async ({ gui } = {}) => {
  const loader = new GLTFLoader();
  // BASE_URL is '/aurora-runes/' on GitHub Pages, so never use a root-absolute path here
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/mountains.glb`);

  const group = new THREE.Group();
  group.name = 'Mountains';
  const folder = gui?.addFolder('Mountains');
  const round = (value) => Math.round(value * 100) / 100;

  // one outer group per mountain holds its placement (constants, sliders), like the ship
  const mountains = MOUNTAINS.map((placement, index) => {
    const mountain = new THREE.Group();
    mountain.name = `Mountain ${index + 1}`;
    // clone() shares the geometry and materials, only the objects are copied
    mountain.add(index === 0 ? gltf.scene : gltf.scene.clone());
    mountain.position.set(placement.position.x, placement.position.y, placement.position.z);
    mountain.rotation.y = placement.rotationY;
    mountain.scale.setScalar(placement.scale);
    group.add(mountain);

    if (folder) {
      const sub = folder.addFolder(`Mountain ${index + 1}`);
      sub.add(mountain.position, 'x', -400, 400, 1).name('position x');
      sub.add(mountain.position, 'y', placement.position.y - 20, placement.position.y + 20, 0.1).name('position y');
      sub.add(mountain.position, 'z', -900, 100, 1).name('position z');
      sub.add(mountain.rotation, 'y', -Math.PI, Math.PI, 0.01).name('rotation y');
      // scale is a Vector3, the slider drives all three axes through one value
      const params = { scale: placement.scale };
      sub.add(params, 'scale', 1, 100, 0.5).onChange((value) => mountain.scale.setScalar(value));
    }
    return mountain;
  });

  if (folder) {
    const actions = {
      // prints the current placements as a constant, ready to paste into js/constants/scene.js
      logValues: () => {
        const lines = mountains.map(({ position: { x, y, z }, rotation, scale }) =>
          `  { position: { x: ${round(x)}, y: ${round(y)}, z: ${round(z)} }, rotationY: ${round(rotation.y)}, scale: ${round(scale.x)} },`);
        console.log(['export const MOUNTAINS = [', ...lines, '];'].join('\n'));
      },
    };
    folder.add(actions, 'logValues').name('log values');
  }

  return group;
};
