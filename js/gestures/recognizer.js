import { Point, PDollarRecognizer } from '../vendor/pdollar.js';
import { GESTURE_TEMPLATES } from '../constants/gestureTemplates.js';
import { GESTURE_MIN_PATH_LENGTH } from '../constants/gestures.js';

// $P changes the array it gets (Resample() splices points into it), so always hand it a copy
const copyPoints = (points) => points.map((point) => new Point(point.X, point.Y, point.ID));

// total drawn length, only measured within strokes (like $P's own PathLength)
const pathLength = (points) => {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].ID === points[i - 1].ID) {
      length += Math.hypot(points[i].X - points[i - 1].X, points[i].Y - points[i - 1].Y);
    }
  }
  return length;
};

// $P recognizer with only our own templates
export const createRecognizer = () => {
  const recognizer = new PDollarRecognizer();
  // remove the 16 built-in demo gestures (don't use DeleteUserGestures(): it resets the list to 16 entries)
  recognizer.PointClouds.length = 0;

  for (const template of GESTURE_TEMPLATES) {
    recognizer.AddGesture(template.name, template.points.map(([x, y, id]) => new Point(x, y, id)));
  }

  // big enough to recognize or save? a click without movement would make $P divide by zero
  const isDrawable = (points) => pathLength(points) >= GESTURE_MIN_PATH_LENGTH;

  // returns { name, score } or null when there are no templates yet
  const recognize = (points) => {
    if (recognizer.PointClouds.length === 0) return null;
    const result = recognizer.Recognize(copyPoints(points));
    return { name: result.Name, score: result.Score };
  };

  // adds a template right away, returns how many templates that name has now
  const addTemplate = (name, points) => recognizer.AddGesture(name, copyPoints(points));

  // number of templates per name, e.g. { name: 3 }
  const countByName = () => {
    const counts = {};
    for (const cloud of recognizer.PointClouds) counts[cloud.Name] = (counts[cloud.Name] ?? 0) + 1;
    return counts;
  };

  // all templates (loaded and recorded) as the contents of js/constants/gestureTemplates.js.
  // stores $P's normalized 32-point clouds, rounded, so the file stays small
  const exportTemplates = () => {
    const round = (value) => Math.round(value * 10000) / 10000;
    const templates = recognizer.PointClouds.map((cloud) => ({
      name: cloud.Name,
      points: cloud.Points.map((point) => [round(point.X), round(point.Y), point.ID]),
    }));
    return [
      '// your own gesture templates, recorded in ?debug record mode: press D there to copy this file\'s contents',
      '// each template: { name, points: [[x, y, strokeId], ...] } (already normalized by $P)',
      `export const GESTURE_TEMPLATES = ${JSON.stringify(templates, null, 2)};`,
      '',
    ].join('\n');
  };

  return { isDrawable, recognize, addTemplate, countByName, exportTemplates };
};
