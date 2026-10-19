// the nine runes of the menu, in Elder Futhark order (left to right, top to bottom on the rocks).
// names match the gesture names in js/constants/gestureTemplates.js; meanings are "inspired by"
// readings, not historical claims.
// strokes: straight-line polylines, [[x, y], ...], in the same orientation as the recorded templates
// (x to the right, y DOWN, like the screen). Height is always 1 (y from -0.5 to 0.5), widths and positions
// follow the median of the recorded templates, so the carved rune looks like the one you draw.
export const RUNE_GLYPHS = [
  {
    name: 'Thurisaz',
    meaning: 'Giant: Thor\'s lightning, bane of the giants',
    // the thorn sits in the middle of the stave (the templates draw it lower, the carving keeps the classic form)
    strokes: [
      [[-0.15, -0.5], [-0.15, 0.5]],
      [[-0.15, -0.22], [0.15, 0], [-0.15, 0.22]],
    ],
  },
  {
    name: 'Kenaz',
    meaning: 'Torch: fire that catches and spreads',
    // full height "<", its point halfway
    strokes: [
      [[0.35, -0.5], [-0.35, 0], [0.35, 0.5]],
    ],
  },
  {
    name: 'Gebo',
    meaning: 'Gift: stars falling from the sky',
    strokes: [
      [[-0.5, -0.5], [0.5, 0.5]],
      [[0.5, -0.5], [-0.5, 0.5]],
    ],
  },
  {
    name: 'Hagalaz',
    meaning: 'Hail: a storm of ice from above',
    // the bar runs down from the left stave to the right one
    strokes: [
      [[-0.22, -0.5], [-0.22, 0.5]],
      [[0.22, -0.5], [0.22, 0.5]],
      [[-0.22, -0.1], [0.22, 0.12]],
    ],
  },
  {
    name: 'Isa',
    meaning: 'Ice: the fjord freezes, time stands still',
    strokes: [
      [[0, -0.5], [0, 0.5]],
    ],
  },
  {
    name: 'Sowilo',
    meaning: 'Sun: the midnight sun breaks the night',
    // one zigzag of three strokes, starting top right
    strokes: [
      [[0.17, -0.5], [-0.17, -0.2], [0.17, 0.15], [-0.17, 0.5]],
    ],
  },
  {
    name: 'Tiwaz',
    meaning: 'Týr: the god\'s spear thrown across the sky',
    // arrow: the arms come down about a third of the height
    strokes: [
      [[0, -0.5], [0, 0.5]],
      [[-0.3, -0.13], [0, -0.5], [0.3, -0.13]],
    ],
  },
  {
    name: 'Laguz',
    meaning: 'Water: the sea rises, the fjord swells',
    // the branch drops about a third of the height
    strokes: [
      [[-0.2, -0.5], [-0.2, 0.5]],
      [[-0.2, -0.5], [0.2, -0.16]],
    ],
  },
  {
    name: 'Dagaz',
    meaning: 'Day: the sky awakens',
    // wide bowtie, about 1.5 times as wide as it is tall
    strokes: [
      [[-0.75, -0.5], [-0.75, 0.5]],
      [[0.75, -0.5], [0.75, 0.5]],
      [[-0.75, -0.5], [0.75, 0.5]],
      [[-0.75, 0.5], [0.75, -0.5]],
    ],
  },
];
