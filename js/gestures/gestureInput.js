import { Point } from '../vendor/pdollar.js';
import { createRecognizer } from './recognizer.js';

// gesture recognition on the spacebar drawings; listens next to the aurora pointer, doesn't change it.
// one session = one spacebar hold: every stroke drawn while it's held is part of the same gesture
export const createGestureInput = ({ canvas, debug }) => {
  const recognizer = createRecognizer();

  // the current session while Space is held: { points: [Point], strokeId }, otherwise null
  let session = null;
  // a stroke of the current session is being drawn
  let drawing = false;

  // debug state
  let recordMode = false;
  let selectedName = null;
  let lastResult = null;
  const label = debug ? createLabel() : null;

  // --- session: Space down -> strokes -> Space up ---

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    // same rule as the aurora pointer: Space in the debug sliders isn't drawing
    if (event.target.closest?.('.lil-gui')) return;
    event.preventDefault();
    session = { points: [], strokeId: 0 };
  });

  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space' || !session) return;
    const { points } = session;
    session = null;
    drawing = false;
    finishSession(points);
  });

  // the keyup is missed when the window loses focus while Space is down: throw the session away
  window.addEventListener('blur', () => {
    session = null;
    drawing = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    // strokes without Space are ignored
    if (!session) return;
    // same rule as the aurora pointer: in debug mode Shift + drag looks around, it doesn't draw
    if (debug && event.shiftKey) return;
    drawing = true;
    // each stroke gets its own id (1, 2, 3...), $P uses it to tell strokes apart
    session.strokeId += 1;
    session.points.push(new Point(event.clientX, event.clientY, session.strokeId));
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!session || !drawing) return;
    // screen coordinates; $P scales and centers the gesture itself, so size and position don't matter
    session.points.push(new Point(event.clientX, event.clientY, session.strokeId));
  });

  const endStroke = () => {
    drawing = false;
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  // Space released: save (record mode) or recognize
  const finishSession = (points) => {
    if (points.length === 0) return;
    if (!recognizer.isDrawable(points)) {
      console.log('Gesture too small, ignored');
      return;
    }

    if (recordMode) {
      if (!selectedName) {
        console.warn('Record mode: press N to choose a name first, nothing saved');
        return;
      }
      const count = recognizer.addTemplate(selectedName, points);
      console.log(`Saved template "${selectedName}" (${count} for this name)`);
    } else {
      const result = recognizer.recognize(points);
      if (result) {
        lastResult = result;
        console.log(`Gesture: ${result.name} (score ${result.score.toFixed(2)})`);
      } else {
        console.log('No gesture templates loaded yet');
      }
    }
    updateLabel();
  };

  // --- record mode, debug only: R = toggle, N = name, D = export ---

  if (debug) {
    window.addEventListener('keydown', (event) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      // typing in a field (e.g. a lil-gui number) isn't a shortcut
      if (event.target.closest?.('input, textarea, .lil-gui')) return;
      const key = event.key.toLowerCase();

      if (key === 'r') {
        recordMode = !recordMode;
        console.log(`Record mode ${recordMode ? 'on' : 'off'}`);
      } else if (key === 'n') {
        const name = window.prompt('Name to record templates under:', selectedName ?? '');
        if (name && name.trim()) selectedName = name.trim();
      } else if (key === 'd') {
        const text = recognizer.exportTemplates();
        console.log(text);
        navigator.clipboard?.writeText(text)
          .then(() => console.log('Templates copied: paste them into js/constants/gestureTemplates.js'))
          .catch(() => console.warn('Could not copy to the clipboard, copy the log above instead'));
      } else {
        return;
      }
      updateLabel();
    });
  }

  // --- debug label ---

  function updateLabel() {
    if (!label) return;
    const counts = Object.entries(recognizer.countByName())
      .map(([name, count]) => `${name} ×${count}`)
      .join(', ');
    label.textContent = [
      `record mode: ${recordMode ? 'ON' : 'off'}   (R toggle · N name · D export)`,
      `name: ${selectedName ?? '— press N'}`,
      `last: ${lastResult ? `${lastResult.name} (${lastResult.score.toFixed(2)})` : '—'}`,
      `templates: ${counts || 'none'}`,
    ].join('\n');
  }
  updateLabel();
};

// small fixed text box in the bottom-left corner
function createLabel() {
  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'fixed',
    left: '8px',
    bottom: '8px',
    padding: '6px 8px',
    font: '11px/1.4 monospace',
    color: '#cfe',
    background: 'rgba(0, 0, 0, 0.6)',
    whiteSpace: 'pre',
    pointerEvents: 'none',
    zIndex: 10000,
  });
  document.body.appendChild(label);
  return label;
}
