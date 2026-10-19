// the HTML parts of the rune menu (markup in index.html, styled in css/style.css): the corner button,
// the full-screen layer that catches the pointer while the menu is open (so nothing is drawn on the
// canvas below it), the hover label, and the sound button with its volume slider above the menu button
export const createMenuHud = ({ buttonGlyph }) => {
  const $button = document.querySelector('.menu-button');
  const $layer = document.querySelector('.menu');
  const $label = document.querySelector('.menu__label');
  const $name = document.querySelector('.menu__name');
  const $meaning = document.querySelector('.menu__meaning');
  const $volume = document.querySelector('.sound__volume');
  const $mute = document.querySelector('.sound__button');

  // the button shows a rune, drawn from the same strokes as the carved ones (y down, like SVG)
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const $svg = document.createElementNS(svgNamespace, 'svg');
  $svg.setAttribute('viewBox', '-1 -0.7 2 1.4');
  $svg.setAttribute('aria-hidden', 'true');
  for (const stroke of buttonGlyph.strokes) {
    const $line = document.createElementNS(svgNamespace, 'polyline');
    $line.setAttribute('points', stroke.map(([x, y]) => `${x},${y}`).join(' '));
    $svg.appendChild($line);
  }
  $button.appendChild($svg);

  const setOpen = (open) => {
    $layer.hidden = !open;
    $button.classList.toggle('menu-button--open', open);
    $button.setAttribute('aria-expanded', String(open));
    if (!open) hideLabel();
  };

  // x, y: screen position of the point below the rock
  const showLabel = ({ name, meaning, discovered }, x, y) => {
    // undiscovered runes keep their secret
    $name.textContent = discovered ? name : '???';
    $meaning.textContent = discovered ? meaning : '';
    $meaning.hidden = !discovered;
    $label.classList.toggle('menu__label--undiscovered', !discovered);
    $label.style.transform = `translate(${x}px, ${y}px) translateX(-50%)`;
    $label.hidden = false;
  };
  const hideLabel = () => {
    $label.hidden = true;
  };

  // restarts the CSS animation, also when it's still running
  const pulseButton = () => {
    $button.classList.remove('menu-button--pulse');
    // reading the layout makes the browser notice the class was gone
    void $button.offsetWidth;
    $button.classList.add('menu-button--pulse');
  };
  $button.addEventListener('animationend', () => $button.classList.remove('menu-button--pulse'));

  const setAudio = ({ volume, muted }) => {
    $volume.value = String(volume);
    // aria-pressed also flattens the bars (css/style.css)
    $mute.setAttribute('aria-pressed', String(muted));
    $mute.setAttribute('aria-label', muted ? 'Unmute all sound' : 'Mute all sound');
  };

  return {
    $button,
    $layer,
    $volume,
    $mute,
    setOpen,
    showLabel,
    hideLabel,
    pulseButton,
    setAudio,
  };
};
