import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { RUNE_GLYPHS } from '../constants/runeGlyphs.js';
import { MUSIC_VOLUME } from '../constants/audio.js';
import {
  MENU_ROCK_MODELS,
  MENU_ROCK_TIP,
  MENU_ROCK_SPINS,
  MENU_ROCK_OFFSETS,
  MENU_ROCK_SCALES,
  MENU_RUNE_SCALES,
  MENU_ROCK_UNDER_RUNE,
  MENU_ROCK_LAYOUT,
  MENU_HOVER,
  MENU_RUNE_SIZE,
  MENU_GLOW_COLOR,
  MENU_GLOW,
  MENU_LIGHT,
  MENU_AMBIENT,
  MENU_KEY_LIGHT,
  MENU_DIM_OPACITY,
  MENU_CAMERA,
  MENU_LABEL_OFFSET,
} from '../constants/menu.js';
import { createRuneRock } from '../objects/runeRock.js';
import { createMenuHud } from '../ui/menuHud.js';
import { createProgress } from './progress.js';

// the rune menu: its own scene and camera, rendered on top of the main scene while open (see draw() in
// js/script.js). Nine rocks with the runes carved in; discovered runes glow, and clicking one replays its
// effect. A rune is discovered the first time its gesture is drawn ("gesture" event, js/gestures/gestureInput.js).
// listener: the effects' AudioListener, music: the background music's <audio> element (mute-all covers both)
export const createRuneMenu = ({ renderer, listener, music, gui }) => {
  const progress = createProgress();
  const hud = createMenuHud({ buttonGlyph: RUNE_GLYPHS.find((glyph) => glyph.name === 'Dagaz') });

  const layout = { ...MENU_ROCK_LAYOUT };
  const hover = { ...MENU_HOVER };
  const glow = { ...MENU_GLOW, runeSize: MENU_RUNE_SIZE };
  const lightParams = { ...MENU_LIGHT };
  // per rock (RUNE_GLYPHS order): spin around the flat side, shift from the grid, scale
  const spins = [...MENU_ROCK_SPINS];
  const offsets = MENU_ROCK_OFFSETS.map((offset) => ({ ...offset }));
  const scales = [...MENU_ROCK_SCALES];
  const runeScales = [...MENU_RUNE_SCALES];
  // moves the model only, the rune (carved where the grid point meets the rock) stays put
  const underRune = MENU_ROCK_UNDER_RUNE.map((offset) => ({ ...offset }));
  const glowColor = new THREE.Color(MENU_GLOW_COLOR);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(MENU_CAMERA.fov, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(0, 0, MENU_CAMERA.distance);
  // in the scene, so its child (the dim plane) is rendered
  scene.add(camera);

  // dims the main scene: a dark see-through plane filling the view behind the rocks
  const dimDistance = MENU_CAMERA.distance + 2;
  const dim = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: MENU_DIM_OPACITY, depthWrite: false }),
  );
  dim.position.z = -dimDistance;
  dim.renderOrder = -1;
  camera.add(dim);

  scene.add(new THREE.AmbientLight(MENU_AMBIENT.color, MENU_AMBIENT.intensity));
  const keyLight = new THREE.DirectionalLight(MENU_KEY_LIGHT.color, MENU_KEY_LIGHT.intensity);
  keyLight.position.set(MENU_KEY_LIGHT.position.x, MENU_KEY_LIGHT.position.y, MENU_KEY_LIGHT.position.z);
  scene.add(keyLight);

  const rocksGroup = new THREE.Group();
  scene.add(rocksGroup);
  // [{ glyph, modelIndex, phase, ...createRuneRock() }], filled once the models are loaded
  const rocks = [];

  // 3x3 grid, row by row from the top left, plus each rock's own shift and scale
  const placeRocks = () => {
    rocksGroup.position.y = layout.y;
    rocks.forEach((rock, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      rock.baseY = (1 - row) * layout.spacingY + offsets[index].y;
      rock.group.position.set((column - 1) * layout.spacingX + offsets[index].x, rock.baseY, 0);
      rock.holder.scale.setScalar(layout.scale * scales[index]);
      rock.holder.position.set(underRune[index].x, underRune[index].y, 0);
    });
  };
  // XYZ order: the spin (y) turns the model around its flat side first, then the tip (x) faces it to the camera
  const applyRotation = (rock) => {
    rock.holder.rotation.set(MENU_ROCK_TIP, spins[rock.index], 0);
  };
  // rotation and size change where the rune lands: project it again
  const carveAll = () => {
    scene.updateMatrixWorld(true);
    for (const rock of rocks) rock.carve(glow.runeSize * runeScales[rock.index]);
  };

  const loader = new GLTFLoader();
  const loaded = Promise.all(
    MENU_ROCK_MODELS.map((path) => loader.loadAsync(`${import.meta.env.BASE_URL}${path}`)),
  )
    .then(async (gltfs) => {
      RUNE_GLYPHS.forEach((glyph, index) => {
        // shifted by the row, so neighbours in a row and a column are never the same model
        const modelIndex = (index + Math.floor(index / 3)) % gltfs.length;
        const gltf = gltfs[modelIndex];
        // the first use of a model takes the original, the others are clones (they share geometry and materials)
        const isFirstUse = !rocks.some((rock) => rock.modelIndex === modelIndex);
        const model = isFirstUse ? gltf.scene : gltf.scene.clone();
        const rock = createRuneRock({ model, glyph, glowColor, lightDistance: lightParams.distance });
        rock.glyph = glyph;
        rock.modelIndex = modelIndex;
        rock.index = index;
        // spread over the cycle, so the rocks don't hover in step
        rock.phase = index * 2.4;
        rocks.push(rock);
        rocksGroup.add(rock.group);
        applyRotation(rock);
      });
      placeRocks();
      carveAll();
      // compile the menu's materials now, so the first open doesn't stutter
      await renderer.compileAsync(scene, camera);
    })
    .catch((error) => console.error('Could not load the rune rocks', error));

  // --- open / close ---

  let open = false;
  const setOpen = (value) => {
    open = value;
    hud.setOpen(open);
    hovered = null;
  };
  hud.$button.addEventListener('click', () => setOpen(!open));
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && !event.repeat) setOpen(!open);
  });
  // no drawing while the menu is open: the layer already keeps the pointer off the canvas, this keeps
  // Space from starting a gesture. Capture phase on window runs before the other Space listeners
  window.addEventListener('keydown', (event) => {
    if (!open || event.code !== 'Space') return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });

  // --- hover and click ---

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const labelPoint = new THREE.Vector3();
  let hovered = null;

  hud.$layer.addEventListener('pointermove', (event) => {
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(rocksGroup, true).find((h) => h.object.userData.runeRock);
    hovered = hit ? rocks.find((rock) => rock.glyph.name === hit.object.userData.runeRock) : null;
    hud.$layer.style.cursor = hovered && progress.isDiscovered(hovered.glyph.name) ? 'pointer' : '';
    if (!hovered) hud.hideLabel();
  });
  hud.$layer.addEventListener('pointerleave', () => {
    hovered = null;
    hud.hideLabel();
  });
  hud.$layer.addEventListener('click', () => {
    if (!hovered || !progress.isDiscovered(hovered.glyph.name)) return;
    const { name } = hovered.glyph;
    setOpen(false);
    // the same event a drawn rune sends, so js/effects/index.js plays it (and shows its name)
    window.dispatchEvent(new CustomEvent('gesture', { detail: { name, score: 1 } }));
  });

  // --- discovering ---

  window.addEventListener('gesture', (event) => {
    const glyph = RUNE_GLYPHS.find((g) => g.name.toLowerCase() === event.detail.name.toLowerCase());
    if (!glyph || !progress.discover(glyph.name)) return;
    hud.pulseButton();
  });

  // --- audio settings ---

  const applyAudio = () => {
    const muted = progress.isMuted();
    music.volume = progress.getMusicVolume(MUSIC_VOLUME);
    music.muted = muted;
    // every effect sound goes through this listener
    listener.setMasterVolume(muted ? 0 : 1);
    hud.setAudio({ volume: music.volume, muted });
  };
  applyAudio();
  hud.$volume.addEventListener('input', () => {
    progress.setMusicVolume(Number(hud.$volume.value));
    applyAudio();
  });
  hud.$mute.addEventListener('click', () => {
    progress.setMuted(!progress.isMuted());
    applyAudio();
  });

  // --- every frame (only while open) ---

  let time = 0;
  const update = (delta) => {
    time += delta;
    // breathing pulse 0..1, shared by all discovered runes
    const pulse = 0.5 + 0.5 * Math.sin(time * glow.speed * Math.PI * 2);
    for (const rock of rocks) {
      rock.group.position.y = rock.baseY + Math.sin(time * hover.speed * Math.PI * 2 + rock.phase) * hover.height;
      const discovered = progress.isDiscovered(rock.glyph.name);
      rock.material.emissiveIntensity = discovered ? THREE.MathUtils.lerp(glow.min, glow.max, pulse) : 0;
      rock.light.intensity = discovered ? lightParams.intensity * (0.5 + 0.5 * pulse) : 0;
      rock.light.position.z = lightParams.offset;
    }
    // the label follows the hovered rock
    if (hovered) {
      hovered.group.getWorldPosition(labelPoint);
      labelPoint.y -= MENU_LABEL_OFFSET;
      labelPoint.project(camera);
      hud.showLabel(
        { ...hovered.glyph, discovered: progress.isDiscovered(hovered.glyph.name) },
        (labelPoint.x * 0.5 + 0.5) * window.innerWidth,
        (-labelPoint.y * 0.5 + 0.5) * window.innerHeight,
      );
    }
  };

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    // a bit bigger than the view at that distance, so the edges never show
    const height = 2 * dimDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1;
    dim.scale.set(height * camera.aspect, height, 1);
  };
  resize();

  if (gui) {
    const folder = gui.addFolder('Rune menu');
    folder.add({ toggle: () => setOpen(!open) }, 'toggle').name('open / close (Esc)');
    folder.add({ reset: () => progress.reset() }, 'reset').name('reset progress');
    folder.add(layout, 'spacingX', 0.5, 3, 0.01).name('spacing x').onChange(placeRocks);
    folder.add(layout, 'spacingY', 0.5, 3, 0.01).name('spacing y').onChange(placeRocks);
    folder.add(layout, 'y', -1, 1, 0.01).name('grid height').onChange(placeRocks);
    folder.add(layout, 'scale', 0.5, 6, 0.05).name('rock scale').onChange(() => {
      placeRocks();
      carveAll();
    });
    folder.add(glow, 'runeSize', 0.1, 1.5, 0.01).name('rune size').onChange(carveAll);
    folder.add(hover, 'height', 0, 0.3, 0.005).name('hover height');
    folder.add(hover, 'speed', 0, 1, 0.01).name('hover speed (Hz)');
    folder.addColor({ color: `#${glowColor.getHexString()}` }, 'color').name('glow color').onChange((value) => {
      glowColor.set(value);
      for (const rock of rocks) {
        rock.material.emissive.copy(glowColor);
        rock.light.color.copy(glowColor);
      }
    });
    folder.add(glow, 'min', 0, 5, 0.05).name('glow min');
    folder.add(glow, 'max', 0, 5, 0.05).name('glow max');
    folder.add(glow, 'speed', 0, 2, 0.01).name('pulse speed (Hz)');
    folder.add(lightParams, 'intensity', 0, 5, 0.01).name('light intensity');
    folder.add(lightParams, 'offset', 0, 2, 0.01).name('light distance in front');
    folder.add(dim.material, 'opacity', 0, 1, 0.01).name('dim opacity');

    // per rock: spin, shift and scale, then paste the logged values into js/constants/menu.js.
    // the shift moves the whole rock (the rune moves along); spin, scale and "rock under rune" change the
    // surface under the rune, so it's carved again
    const rocksFolder = folder.addFolder('Rocks');
    const round = (value) => Math.round(value * 100) / 100;
    rocksFolder.add({
      log: () => console.log([
        `export const MENU_ROCK_SPINS = [${spins.map(round).join(', ')}];`,
        `export const MENU_ROCK_OFFSETS = [\n${offsets.map(({ x, y }) => `  { x: ${round(x)}, y: ${round(y)} },`).join('\n')}\n];`,
        `export const MENU_ROCK_SCALES = [${scales.map(round).join(', ')}];`,
        `export const MENU_RUNE_SCALES = [${runeScales.map(round).join(', ')}];`,
        `export const MENU_ROCK_UNDER_RUNE = [\n${underRune.map(({ x, y }) => `  { x: ${round(x)}, y: ${round(y)} },`).join('\n')}\n];`,
      ].join('\n')),
    }, 'log').name('log rocks');
    RUNE_GLYPHS.forEach((glyph, index) => {
      const sub = rocksFolder.addFolder(glyph.name);
      const reshape = () => {
        const rock = rocks[index];
        if (!rock) return;
        applyRotation(rock);
        placeRocks();
        carveAll();
      };
      sub.add(spins, String(index), -Math.PI, Math.PI, 0.01).name('spin').onChange(reshape);
      sub.add(offsets[index], 'x', -1, 1, 0.01).name('shift x').onChange(placeRocks);
      sub.add(offsets[index], 'y', -1, 1, 0.01).name('shift y').onChange(placeRocks);
      sub.add(scales, String(index), 0.3, 2, 0.01).name('scale').onChange(reshape);
      sub.add(runeScales, String(index), 0.3, 2, 0.01).name('rune scale').onChange(carveAll);
      // the rock slides under its rune, so the rune is carved again on the new surface
      sub.add(underRune[index], 'x', -0.5, 0.5, 0.01).name('rock under rune x').onChange(reshape);
      sub.add(underRune[index], 'y', -0.5, 0.5, 0.01).name('rock under rune y').onChange(reshape);
      sub.close();
    });
    folder.close();
  }

  return { scene, camera, loaded, update, resize, isOpen: () => open, discoveredCount: progress.discoveredCount };
};
