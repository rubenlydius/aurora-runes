import { GESTURE_BEND_EDGE } from '../constants/gestures.js';

// Thurisaz vs Laguz: both are a stave with something on its right. $P compares point clouds and can't tell a
// thorn (bent: out and back in) from a branch (straight) when the thorn sits high. The stroke that isn't the
// stave decides: a sharp bend near its middle is Thurisaz, nearly straight is Laguz.
// points: $P Points (X, Y, ID = stroke) in screen pixels

// how vertical a stroke is: 1 = straight down (or up), 0 = sideways
const verticality = (stroke) => {
  const a = stroke[0];
  const b = stroke[stroke.length - 1];
  const length = Math.hypot(b.X - a.X, b.Y - a.Y);
  return length === 0 ? 0 : Math.abs(b.Y - a.Y) / length;
};

// the stroke's turn at the point farthest from its start-end line: degrees (0 = straight) and where it is
// along the stroke (0..1 of its length)
const sharpestTurn = (stroke) => {
  if (stroke.length < 3) return { degrees: 0, at: 0, index: 0 };
  const a = stroke[0];
  const b = stroke[stroke.length - 1];
  const chord = Math.hypot(b.X - a.X, b.Y - a.Y) || 1;
  let farthest = 0;
  let index = 0;
  stroke.forEach((p, i) => {
    const distance = Math.abs((b.X - a.X) * (a.Y - p.Y) - (a.X - p.X) * (b.Y - a.Y)) / chord;
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  });
  const p = stroke[index];
  const toStart = [a.X - p.X, a.Y - p.Y];
  const toEnd = [b.X - p.X, b.Y - p.Y];
  const lengths = Math.hypot(...toStart) * Math.hypot(...toEnd);
  // the angle at p is 180° on a straight line, the turn is what's missing from that
  const angle = lengths === 0 ? Math.PI : Math.acos(Math.min(1, Math.max(-1, (toStart[0] * toEnd[0] + toStart[1] * toEnd[1]) / lengths)));
  let total = 0;
  let upTo = 0;
  for (let i = 1; i < stroke.length; i++) {
    total += Math.hypot(stroke[i].X - stroke[i - 1].X, stroke[i].Y - stroke[i - 1].Y);
    if (i === index) upTo = total;
  }
  return { degrees: 180 - (angle * 180) / Math.PI, at: total === 0 ? 0 : upTo / total, index };
};

// the part that isn't the stave: with several strokes the least vertical one; with one stroke (Laguz is
// usually drawn in one go: branch, corner, stave) it's split at its corner and the less vertical part is kept
const otherStroke = (points) => {
  const strokes = new Map();
  for (const point of points) {
    if (!strokes.has(point.ID)) strokes.set(point.ID, []);
    strokes.get(point.ID).push(point);
  }
  const list = [...strokes.values()].filter((stroke) => stroke.length >= 2);
  if (list.length === 0) return [];
  if (list.length > 1) return list.reduce((least, stroke) => (verticality(stroke) < verticality(least) ? stroke : least));
  const [stroke] = list;
  const { index } = sharpestTurn(stroke);
  const parts = [stroke.slice(0, index + 1), stroke.slice(index)];
  return verticality(parts[0]) < verticality(parts[1]) ? parts[0] : parts[1];
};

// ranked: [{ name, distance, score }] best first. Returns the ranking, reordered when the tie-breaker picks
// the other one, plus what it measured (null when it didn't apply)
export const breakThurisazLaguzTie = (points, ranked, { margin, bendAngle }) => {
  const [first, second] = ranked;
  if (!first || !second) return { ranked, tieBreak: null };
  const pair = [first.name, second.name].sort().join();
  if (pair !== 'Laguz,Thurisaz' || second.distance - first.distance > margin) return { ranked, tieBreak: null };

  const turn = sharpestTurn(otherStroke(points));
  const nearMiddle = turn.at >= GESTURE_BEND_EDGE && turn.at <= 1 - GESTURE_BEND_EDGE;
  const pick = nearMiddle && turn.degrees > bendAngle ? 'Thurisaz' : 'Laguz';
  const tieBreak = { pick, degrees: turn.degrees, at: turn.at };
  if (first.name === pick) return { ranked, tieBreak };
  return { ranked: [second, first, ...ranked.slice(2)], tieBreak };
};
