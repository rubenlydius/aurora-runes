// three-step tutorial overlay (markup in index.html, styled and animated in css/style.css).
// opened by js/script.js after the loading screen while no rune is discovered, and from the "?" button in
// the menu. While open it covers the canvas (no drawing) and keeps Space from starting a gesture
export const createTutorial = () => {
  const $tutorial = document.querySelector('.tutorial');
  const $close = document.querySelector('.tutorial__close');
  const $note = document.querySelector('.tutorial__note');
  const $help = document.querySelector('.help-button');

  // no mouse (touch only): drawing runes needs Space, so suggest a desktop
  $note.hidden = window.matchMedia('(any-pointer: fine)').matches;

  let open = false;
  const setOpen = (value) => {
    open = value;
    $tutorial.hidden = !open;
    if (open) $close.focus();
  };

  $close.addEventListener('click', () => setOpen(false));
  $help.addEventListener('click', () => setOpen(true));

  // capture phase on window: runs before the menu's Escape and the gesture input's Space listeners
  window.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.code === 'Escape') {
      event.stopImmediatePropagation();
      if (!event.repeat) setOpen(false);
    } else if (event.code === 'Space') {
      // no gesture while open
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  return { open: () => setOpen(true), isOpen: () => open };
};
