// Simple streaming music player using HTMLAudioElement.
export function createMusicPlayer({ tracks = [], volume = 0.8, onTrackChange = null } = {}) {
  let audio = null;
  let playlist = Array.isArray(tracks) ? tracks.slice() : [];
  let currentIndex = 0;
  let started = false;
  let currentVolume = clamp(volume, 0, 1);
  const handleTrackChange = typeof onTrackChange === "function" ? onTrackChange : null;
  let currentSrc = "";
  let pendingSeek = null;

  function start() {
    if (started || playlist.length === 0) {
      return false;
    }

    audio = new Audio();
    audio.preload = "none";
    audio.volume = currentVolume;
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", applyPendingSeek);
    audio.addEventListener("canplay", applyPendingSeek);

    started = true;
    playIndex(currentIndex);
    return true;
  }

  function handleEnded() {
    if (!audio || playlist.length === 0) {
      return;
    }

    currentIndex = (currentIndex + 1) % playlist.length;
    playIndex(currentIndex);
  }

  function playIndex(index) {
    if (!audio) {
      return;
    }

    const src = playlist[index];
    if (!src) {
      return;
    }

    audio.src = src;
    currentSrc = src;
    if (handleTrackChange) {
      handleTrackChange(src);
    }
    audio.play().catch(() => {});
  }

  function setTracks(nextTracks) {
    playlist = Array.isArray(nextTracks) ? nextTracks.slice() : [];
    currentIndex = 0;
    if (started && audio) {
      playIndex(currentIndex);
    }
  }

  function setVolume(nextVolume) {
    currentVolume = clamp(nextVolume, 0, 1);
    if (audio) {
      audio.volume = currentVolume;
    }
  }

  function getState() {
    return {
      src: currentSrc || playlist[currentIndex] || "",
      time: audio ? audio.currentTime || 0 : 0,
    };
  }

  function setPlayback({ src, time } = {}) {
    if (!playlist.length) {
      return false;
    }

    const target = findTrackIndex(src, playlist);
    if (target >= 0) {
      currentIndex = target;
      currentSrc = playlist[currentIndex];
    }

    if (typeof time === "number" && Number.isFinite(time) && time >= 0) {
      pendingSeek = time;
    }

    if (started && audio) {
      playIndex(currentIndex);
      applyPendingSeek();
    }

    return true;
  }

  function pickRandom({ excludeSrc = "" } = {}) {
    if (!playlist.length) {
      return false;
    }

    if (playlist.length === 1) {
      currentIndex = 0;
    } else {
      const excludeIndex = findTrackIndex(excludeSrc, playlist);
      let nextIndex = excludeIndex;
      let guard = 0;
      while (nextIndex === excludeIndex && guard < 10) {
        nextIndex = Math.floor(Math.random() * playlist.length);
        guard += 1;
      }
      if (nextIndex === excludeIndex) {
        nextIndex = (excludeIndex + 1) % playlist.length;
      }
      currentIndex = nextIndex;
    }

    if (started && audio) {
      playIndex(currentIndex);
    } else {
      currentSrc = playlist[currentIndex] || "";
      if (handleTrackChange && currentSrc) {
        handleTrackChange(currentSrc);
      }
    }

    return true;
  }

  function applyPendingSeek() {
    if (!audio || pendingSeek === null) {
      return;
    }

    const seekTime = Math.max(0, pendingSeek);
    pendingSeek = null;
    try {
      audio.currentTime = seekTime;
    } catch (_error) {
      // Ignore seek errors before metadata.
    }
  }

  return {
    start,
    setTracks,
    setVolume,
    getState,
    setPlayback,
    pickRandom,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function stripQuery(src) {
  return String(src || "").split("?")[0];
}

function findTrackIndex(src, playlist) {
  if (!src) {
    return -1;
  }

  const target = stripQuery(src);
  for (let i = 0; i < playlist.length; i += 1) {
    if (stripQuery(playlist[i]) === target) {
      return i;
    }
  }

  return -1;
}
