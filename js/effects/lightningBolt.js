import * as THREE from 'three/webgpu';
import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

const axis = new THREE.Vector3();
const side = new THREE.Vector3();

// jagged bolt from start to end by midpoint displacement: each level splits every segment in two and
// pushes the new midpoint sideways (perpendicular to the bolt), with half the offset of the level before.
// only midpoints move, so the bolt always ends exactly at `end`
const createBoltPoints = (start, end, { detail, jaggedness }) => {
  let points = [start.clone(), end.clone()];
  axis.subVectors(end, start).normalize();
  let offset = start.distanceTo(end) * jaggedness;

  for (let level = 0; level < detail; level++) {
    const next = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const mid = points[i - 1].clone().lerp(points[i], 0.5);
      side.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).projectOnPlane(axis).normalize();
      mid.addScaledVector(side, (Math.random() * 2 - 1) * offset);
      next.push(mid, points[i]);
    }
    points = next;
    offset *= 0.5;
  }
  return points;
};

// an unlit line for a bolt, hidden until a strike shows it; opacity is its brightness.
// Line2 (three's "fat" lines) because plain WebGPU lines are always 1 pixel wide; width is in pixels
export const createBoltLine = (color, width) => {
  const material = new THREE.Line2NodeMaterial({
    color,
    linewidth: width,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const line = new Line2(new LineGeometry(), material);
  line.visible = false;
  // the geometry changes every strike and a bolt is only visible for a moment: skip culling
  line.frustumCulled = false;
  return line;
};

// new shape for an existing bolt line
export const setBoltPath = (line, start, end, options) => {
  line.geometry.dispose();
  const points = createBoltPoints(start, end, options);
  line.geometry = new LineGeometry().setPositions(points.flatMap((point) => [point.x, point.y, point.z]));
};
