import * as THREE from 'three/webgpu';
import RAPIER from '@dimforge/rapier3d-compat';

// Rapier physics, used by the Hagalaz hail (js/effects/hagalaz.js).
//
// How it fits together:
// - Rapier is a physics engine compiled to WebAssembly. The -compat package has the .wasm inlined as
//   base64, so Vite and GitHub Pages need no extra setup; RAPIER.init() decodes and starts it (async).
// - The world holds rigid bodies (things that move: position, rotation, velocity) and colliders (the
//   shapes attached to them that touch each other). Body types used here:
//     dynamic                    moved by the simulation (gravity, collisions): the hailstones
//     kinematic (position based) moved by us, every frame: the ship hull, which floats and rocks in JS.
//                                Rapier derives its velocity from the move, so hail bounces off it properly
// - Rapier knows nothing about three.js: we copy the ship's pose into Rapier before each step, and the
//   hailstones' poses back into three.js after it.
// - Fixed timestep: the simulation always advances in steps of exactly 1/60 s, whatever the frame rate.
//   Frame time is collected in an accumulator and spent in whole steps (0, 1 or more per frame), so the
//   physics behaves the same on a 30 Hz laptop and a 144 Hz monitor.

// seconds per physics step
const FIXED_STEP = 1 / 60;
// at most this many steps per frame: after a long stall (tab in the background) skip time instead of
// running hundreds of steps to catch up, which would stall the next frame too ("spiral of death")
const MAX_STEPS = 5;

const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const relative = new THREE.Matrix4();
const inverse = new THREE.Matrix4();

export const createPhysics = async ({ scene, gui }) => {
  await RAPIER.init();

  // gravity in world units per second², the scene is roughly in metres
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_STEP;

  // kinematic bodies that follow a three.js object: [{ body, object }]
  const followers = [];
  // called once per frame after stepping, with the frame's delta (the hail syncs its meshes here)
  const listeners = [];
  let accumulator = 0;

  // copy a three.js object's world position and rotation into its kinematic body. "Next": Rapier
  // moves the body there during the coming step and gives it the matching velocity
  const follow = ({ body, object }) => {
    object.updateWorldMatrix(true, false);
    object.matrixWorld.decompose(position, quaternion, scale);
    body.setNextKinematicTranslation(position);
    body.setNextKinematicRotation(quaternion);
  };

  // a trimesh (triangle mesh) collider from all the meshes inside `object`, on a kinematic body that
  // follows the object. Trimeshes have no inside, they're a shell of triangles: fine for fixed or kinematic
  // bodies, the hailstones are balls. Rapier colliders can't be scaled, so the object's world scale is
  // baked into the vertices; its position and rotation go on the body
  const addKinematicTrimesh = (object) => {
    object.updateWorldMatrix(true, true);
    object.matrixWorld.decompose(position, quaternion, scale);
    inverse.copy(object.matrixWorld).invert();

    const vertices = [];
    const indices = [];
    const vertex = new THREE.Vector3();
    object.traverse((child) => {
      if (!child.isMesh) return;
      // child vertices -> the object's own space (cancel the object's world transform), then scale
      relative.multiplyMatrices(inverse, child.matrixWorld);
      const offset = vertices.length / 3;
      const positions = child.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(relative).multiply(scale);
        vertices.push(vertex.x, vertex.y, vertex.z);
      }
      const index = child.geometry.index;
      const count = index ? index.count : positions.count;
      for (let i = 0; i < count; i++) indices.push(offset + (index ? index.getX(i) : i));
    });

    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(quaternion),
    );
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices)), body);
    followers.push({ body, object });
    return body;
  };

  const onUpdate = (listener) => listeners.push(listener);

  // --- debug: Rapier's own view of the colliders as wireframe lines ---
  const debug = { colliders: false };
  const debugLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicNodeMaterial({ vertexColors: true, fog: false, depthTest: false, transparent: true }),
  );
  debugLines.frustumCulled = false;
  debugLines.renderOrder = 999;
  debugLines.visible = false;
  scene.add(debugLines);

  const updateDebugLines = () => {
    // vertices: xyz per line end, colors: rgba per line end
    const { vertices, colors } = world.debugRender();
    debugLines.geometry.dispose();
    debugLines.geometry = new THREE.BufferGeometry();
    debugLines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    debugLines.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  };

  // from the render loop, every frame
  const update = (delta) => {
    accumulator = Math.min(accumulator + delta, FIXED_STEP * MAX_STEPS);
    let steps = 0;
    while (accumulator >= FIXED_STEP) {
      // kinematic bodies first, so the step moves them to where the ship is now
      followers.forEach(follow);
      world.step();
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    for (const listener of listeners) listener(delta, steps);
    debugLines.visible = debug.colliders;
    if (debug.colliders) updateDebugLines();
  };

  if (gui) {
    const folder = gui.addFolder('Physics');
    folder.add(debug, 'colliders').name('show colliders');
  }

  return { RAPIER, world, addKinematicTrimesh, onUpdate, update };
};
