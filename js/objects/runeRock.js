import * as THREE from 'three/webgpu';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

import { createRuneTextures } from '../menu/runeTexture.js';
import { MENU_GROOVE_COLOR } from '../constants/menu.js';

const raycaster = new THREE.Raycaster();
const rayOrigin = new THREE.Vector3();
const towardRock = new THREE.Vector3(0, 0, -1);
const decalSize = new THREE.Vector3();
const inverse = new THREE.Matrix4();
// the decal faces the menu camera, which looks straight down -z
const facingCamera = new THREE.Euler();
// the decal is lifted this far off the rock (world units, along the surface normals): lying exactly on it,
// the stone pokes through at the creases between its faces (z-fighting), polygonOffset alone isn't enough
const DECAL_LIFT = 0.004;

// one rock of the rune menu, with its rune carved in (a decal) and a light for when it glows.
// group (position, hover) > holder (scale, per-model rotation) > model; the decal and light are children
// of the group, so they hover with it
export const createRuneRock = ({ model, glyph, glowColor, lightDistance }) => {
  const group = new THREE.Group();
  group.name = `Rune rock ${glyph.name}`;
  const holder = new THREE.Group();
  holder.add(model);
  group.add(holder);
  // the hover raycast finds the mesh, this leads back to the rock
  model.traverse((child) => {
    child.userData.runeRock = glyph.name;
  });
  let rockMesh = null;
  model.traverse((child) => {
    if (!rockMesh && child.isMesh) rockMesh = child;
  });

  const textures = createRuneTextures(glyph);
  const material = new THREE.MeshStandardMaterial({
    color: MENU_GROOVE_COLOR,
    roughness: 0.95,
    metalness: 0,
    // only the groove is visible, and only the groove glows
    alphaMap: textures.mask,
    transparent: true,
    depthWrite: false,
    normalMap: textures.normal,
    emissive: glowColor,
    emissiveMap: textures.mask,
    emissiveIntensity: 0,
    // drawn on top of the rock's surface without z-fighting
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });
  const decal = new THREE.Mesh(new THREE.BufferGeometry(), material);
  decal.name = 'Rune decal';
  group.add(decal);

  // faint glow in front of the rock, off (0) until the rune is discovered. Always in the scene, so
  // discovering a rune doesn't change the number of lights (that would recompile the materials)
  const light = new THREE.PointLight(glowColor, 0, lightDistance, 2);
  group.add(light);

  // projects the rune onto the side facing the camera. DecalGeometry works in world space: the result
  // is moved into the group's own space, so it follows the hover. Called again when the rotation or
  // size changes (debug sliders)
  const carve = (runeSize) => {
    group.updateMatrixWorld(true);
    // where a ray toward the rock's center first hits its front
    group.getWorldPosition(rayOrigin);
    rayOrigin.z += 10;
    raycaster.set(rayOrigin, towardRock);
    const hit = raycaster.intersectObject(rockMesh, false)[0];
    if (!hit) {
      console.warn(`Rune rock ${glyph.name}: no surface found for the rune`);
      return;
    }
    // depth: deep enough for a slightly curved face, not so deep it reaches the back of the rock
    decalSize.set(runeSize, runeSize, runeSize * 0.5);
    const geometry = new DecalGeometry(rockMesh, hit.point, facingCamera, decalSize);
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(
        i,
        positions.getX(i) + normals.getX(i) * DECAL_LIFT,
        positions.getY(i) + normals.getY(i) * DECAL_LIFT,
        positions.getZ(i) + normals.getZ(i) * DECAL_LIFT,
      );
    }
    geometry.applyMatrix4(inverse.copy(group.matrixWorld).invert());
    decal.geometry.dispose();
    decal.geometry = geometry;
  };

  return { group, holder, material, light, carve };
};
