import { MUSIC_TRACKS, MUSIC_VOLUME } from '../constants/audio.js';

// background music that never stops: when a track ends the next one starts, after the last comes the first.
// a plain <audio> element streams the files instead of decoding them into memory like THREE.Audio
export const createBackgroundMusic = ({ gui }) => {
  const audio = new Audio();
  audio.volume = MUSIC_VOLUME;
  let index = Math.floor(Math.random() * MUSIC_TRACKS.length);

  const playTrack = () => {
    audio.src = `${import.meta.env.BASE_URL}${MUSIC_TRACKS[index]}`;
    audio.play().catch((error) => console.warn('Background music could not play', error));
  };
  audio.addEventListener('ended', () => {
    index = (index + 1) % MUSIC_TRACKS.length;
    playTrack();
  });

  // browsers block sound until the page has had input: start on the first click, touch or key
  const start = () => {
    window.removeEventListener('pointerdown', start);
    window.removeEventListener('keydown', start);
    playTrack();
  };
  window.addEventListener('pointerdown', start);
  window.addEventListener('keydown', start);

  if (gui) {
    const folder = gui.addFolder('Music');
    folder.add(audio, 'volume', 0, 1, 0.01);
    folder.add({ next: () => audio.dispatchEvent(new Event('ended')) }, 'next').name('next track');
  }

  // the rune menu's volume slider and mute-all use it
  return { audio };
};
