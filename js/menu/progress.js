import { PROGRESS_STORAGE_KEY } from '../constants/menu.js';

// saved progress: the discovered runes and the audio settings, all under one localStorage key.
// storage can be blocked (private mode, settings): then everything still works, it just isn't saved
const load = () => {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Could not read the saved progress', error);
    return {};
  }
};

export const createProgress = () => {
  const saved = load();
  const discovered = new Set(Array.isArray(saved.discovered) ? saved.discovered : []);
  // null = not set yet, the music keeps its default volume
  let musicVolume = typeof saved.musicVolume === 'number' ? saved.musicVolume : null;
  let muted = saved.muted === true;

  const save = () => {
    try {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify({ discovered: [...discovered], musicVolume, muted }));
    } catch (error) {
      console.warn('Could not save the progress', error);
    }
  };

  return {
    isDiscovered: (name) => discovered.has(name),
    // true when the rune is new
    discover: (name) => {
      if (discovered.has(name)) return false;
      discovered.add(name);
      save();
      return true;
    },
    // forgets the runes, keeps the audio settings
    reset: () => {
      discovered.clear();
      save();
    },
    getMusicVolume: (fallback) => musicVolume ?? fallback,
    setMusicVolume: (value) => {
      musicVolume = value;
      save();
    },
    isMuted: () => muted,
    setMuted: (value) => {
      muted = value;
      save();
    },
  };
};
