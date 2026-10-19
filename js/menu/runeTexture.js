import * as THREE from 'three/webgpu';

// canvas textures for a carved rune (js/constants/runeGlyphs.js):
// - mask:   white groove on black. Used as alphaMap (only the groove is visible) and emissiveMap (only the
//           groove glows)
// - normal: tangent-space normal map from a blurred height map, so the groove's walls catch the light
//           like they're cut into the stone

// square canvas size in pixels
const SIZE = 512;
// the glyph's longest side fills this part of the canvas, the rest is margin (no clipping at the edges)
const FILL = 0.8;
// groove width and the softness of its walls, in pixels
const GROOVE_WIDTH = 30;
const WALL_BLUR = 8;
// how steep the walls look
const NORMAL_STRENGTH = 4;

// draws the strokes centered in the canvas, scaled so the longest side fits
const drawStrokes = (context, glyph) => {
  const points = glyph.strokes.flat();
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const scale = (SIZE * FILL) / Math.max(width, height);
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;

  context.lineWidth = GROOVE_WIDTH;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  for (const stroke of glyph.strokes) {
    stroke.forEach(([x, y], index) => {
      const px = SIZE / 2 + (x - centerX) * scale;
      const py = SIZE / 2 + (y - centerY) * scale;
      if (index === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    });
  }
  context.stroke();
};

const createCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return canvas;
};

export const createRuneTextures = (glyph) => {
  // --- mask ---
  const maskCanvas = createCanvas();
  const mask = maskCanvas.getContext('2d');
  mask.fillStyle = '#000';
  mask.fillRect(0, 0, SIZE, SIZE);
  // a little softness, so the groove's edge isn't pixel sharp
  mask.filter = 'blur(1px)';
  mask.strokeStyle = '#fff';
  drawStrokes(mask, glyph);

  // --- height: stone surface white (high), the groove black (low), blurred into sloping walls ---
  const heightCanvas = createCanvas();
  const heightContext = heightCanvas.getContext('2d', { willReadFrequently: true });
  heightContext.fillStyle = '#fff';
  heightContext.fillRect(0, 0, SIZE, SIZE);
  heightContext.filter = `blur(${WALL_BLUR}px)`;
  heightContext.strokeStyle = '#000';
  drawStrokes(heightContext, glyph);
  const heights = heightContext.getImageData(0, 0, SIZE, SIZE).data;

  // --- normal map from the height's slope (central differences) ---
  const normalCanvas = createCanvas();
  const normalContext = normalCanvas.getContext('2d');
  const normals = normalContext.createImageData(SIZE, SIZE);
  const heightAt = (x, y) => {
    const cx = Math.min(SIZE - 1, Math.max(0, x));
    const cy = Math.min(SIZE - 1, Math.max(0, y));
    return heights[(cy * SIZE + cx) * 4] / 255;
  };
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // canvas rows go down, texture v goes up (flipY), so the y slope changes sign
      const nx = -(heightAt(x + 1, y) - heightAt(x - 1, y)) * NORMAL_STRENGTH;
      const ny = (heightAt(x, y + 1) - heightAt(x, y - 1)) * NORMAL_STRENGTH;
      const length = Math.hypot(nx, ny, 1);
      const i = (y * SIZE + x) * 4;
      normals.data[i] = ((nx / length) * 0.5 + 0.5) * 255;
      normals.data[i + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      normals.data[i + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      normals.data[i + 3] = 255;
    }
  }
  normalContext.putImageData(normals, 0, 0);

  const maskTexture = new THREE.CanvasTexture(maskCanvas);
  const normalTexture = new THREE.CanvasTexture(normalCanvas);
  // the decal is seen at a slant on curved rocks, keep the groove crisp
  maskTexture.anisotropy = 4;
  normalTexture.anisotropy = 4;
  return { mask: maskTexture, normal: normalTexture };
};
