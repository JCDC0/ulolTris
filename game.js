(() => {
  // js/settings.js
  var STORAGE_KEY = "uloltris-settings";
  var FRAME_MS = 1e3 / 60;
  var SETTINGS_VERSION = 2;
  var SDF_INFINITE = 41;
  var DEFAULT_SETTINGS = {
    // Handling
    arr: 2,
    // frames, 0 = instant
    das: 10,
    // frames
    dcd: 1,
    // frames, 0 = off
    sdf: 6,
    // gravity multiplier, SDF_INFINITE = instant
    cancelDasOnDirectionChange: false,
    preferSoftDrop: false,
    // Audio
    masterVolume: 80,
    sfxVolume: 80,
    musicVolume: 50,
    sfxMuted: false,
    musicMuted: false,
    crossfadeDuration: 2,
    // Visual
    screenShake: "medium",
    // 'off', 'low', 'medium', 'high'
    particleDensity: "medium",
    // 'off', 'low', 'medium', 'high'
    ghostOpacity: 40,
    // 0-100
    showActionText: true,
    boardOpacity: 100,
    // 0-100
    // Gameplay
    nextPreviewCount: 5,
    // 1-6
    lockDelay: 500
    // ms
  };
  var CONSTRAINTS = {
    arr: { min: 0, max: 5, step: 0.1 },
    das: { min: 1, max: 20, step: 0.1 },
    dcd: { min: 0, max: 20, step: 0.1 },
    sdf: { min: 5, max: SDF_INFINITE, step: 1 },
    masterVolume: { min: 0, max: 100, step: 1 },
    sfxVolume: { min: 0, max: 100, step: 1 },
    musicVolume: { min: 0, max: 100, step: 1 },
    crossfadeDuration: { min: 0, max: 5, step: 0.5 },
    ghostOpacity: { min: 0, max: 100, step: 5 },
    boardOpacity: { min: 0, max: 100, step: 5 },
    nextPreviewCount: { min: 1, max: 6, step: 1 },
    lockDelay: { min: 100, max: 2e3, step: 50 }
  };
  var ENUMS = {
    screenShake: ["off", "low", "medium", "high"],
    particleDensity: ["off", "low", "medium", "high"]
  };
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function normalizeSettings(raw) {
    const source = migrateSettings(raw || {});
    const result = { ...DEFAULT_SETTINGS };
    for (const [key, constraint] of Object.entries(CONSTRAINTS)) {
      const val = source[key];
      if (Number.isFinite(val)) {
        result[key] = clamp(val, constraint.min, constraint.max);
      }
    }
    for (const [key, validValues] of Object.entries(ENUMS)) {
      if (validValues.includes(source[key])) {
        result[key] = source[key];
      }
    }
    if (typeof source.sfxMuted === "boolean") result.sfxMuted = source.sfxMuted;
    if (typeof source.musicMuted === "boolean") result.musicMuted = source.musicMuted;
    if (typeof source.showActionText === "boolean") result.showActionText = source.showActionText;
    if (typeof source.cancelDasOnDirectionChange === "boolean") result.cancelDasOnDirectionChange = source.cancelDasOnDirectionChange;
    if (typeof source.preferSoftDrop === "boolean") result.preferSoftDrop = source.preferSoftDrop;
    return result;
  }
  function migrateSettings(source) {
    if (source.version === SETTINGS_VERSION) return source;
    const migrated = { ...source };
    for (const key of ["arr", "das", "dcd"]) {
      if (Number.isFinite(source[key])) {
        migrated[key] = Math.round(source[key] / FRAME_MS * 10) / 10;
      }
    }
    delete migrated.sdf;
    return migrated;
  }
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return normalizeSettings(saved);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
  function saveSettings(settings2) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings2, version: SETTINGS_VERSION }));
  }
  function getConstraint(key) {
    return CONSTRAINTS[key] || null;
  }
  function framesToMs(frames) {
    return frames * FRAME_MS;
  }
  function describeFrames(frames) {
    return `${Number(frames).toFixed(1)}F / ${Math.round(framesToMs(frames))}ms`;
  }
  function describeArr(frames) {
    if (frames === 0) return "0F (instant)";
    return describeFrames(frames);
  }
  function describeDcd(frames) {
    if (frames === 0) return "0F (off)";
    return describeFrames(frames);
  }
  function describeSoftDrop(factor) {
    if (factor >= SDF_INFINITE) return "\u221E (instant)";
    return `${factor}X`;
  }
  function describeVolume(val) {
    return `${val}%`;
  }
  function describeCrossfade(val) {
    if (val === 0) return "Off";
    return `${val}s`;
  }
  function describeEnum(val) {
    return val.charAt(0).toUpperCase() + val.slice(1);
  }
  function describeOpacity(val) {
    return `${val}%`;
  }
  function describePreviewCount(val) {
    return `${val} piece${val !== 1 ? "s" : ""}`;
  }
  function describeLockDelay(ms) {
    return `${ms}ms`;
  }
  function screenShakeMultiplier(settings2) {
    switch (settings2.screenShake) {
      case "off":
        return 0;
      case "low":
        return 0.4;
      case "medium":
        return 1;
      case "high":
        return 1.8;
      default:
        return 1;
    }
  }
  function particleDensityMultiplier(settings2) {
    switch (settings2.particleDensity) {
      case "off":
        return 0;
      case "low":
        return 0.4;
      case "medium":
        return 1;
      case "high":
        return 2;
      default:
        return 1;
    }
  }

  // js/sound.js
  function createSoundEngine(settingsRef) {
    let ctx = null;
    let masterGain = null;
    let noiseBuffer = null;
    function init() {
      if (ctx) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      const bufferSize = ctx.sampleRate;
      noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
    function updateVolume() {
      if (!ctx) return 0;
      if (settingsRef.sfxMuted) {
        masterGain.gain.value = 0;
        return 0;
      }
      const master = (settingsRef.masterVolume !== void 0 ? settingsRef.masterVolume : 100) / 100;
      const sfx = (settingsRef.sfxVolume !== void 0 ? settingsRef.sfxVolume : 100) / 100;
      const volume = master * sfx;
      masterGain.gain.value = volume;
      return volume;
    }
    function playTone(freq, type, startTime, duration, volEnvelope) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      if (typeof freq === "number") {
        osc.frequency.setValueAtTime(freq, startTime);
      } else if (typeof freq === "function") {
        freq(osc.frequency, startTime);
      }
      gain.gain.setValueAtTime(0, startTime);
      if (volEnvelope) {
        volEnvelope(gain.gain, startTime);
      }
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(startTime);
      osc.stop(startTime + duration);
      osc.onended = () => {
        gain.disconnect();
      };
      return { osc, gain };
    }
    function playNoise(startTime, duration, volEnvelope, filterSetup) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      if (volEnvelope) {
        volEnvelope(gain.gain, startTime);
      }
      let lastNode = source;
      if (filterSetup) {
        const filter = ctx.createBiquadFilter();
        filterSetup(filter, startTime);
        lastNode.connect(filter);
        lastNode = filter;
      }
      lastNode.connect(gain);
      gain.connect(masterGain);
      source.start(startTime);
      source.stop(startTime + duration);
      source.onended = () => {
        gain.disconnect();
        if (lastNode !== source) lastNode.disconnect();
      };
    }
    function play(eventName, comboCount) {
      init();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const vol = updateVolume();
      if (vol === 0) return;
      const t = ctx.currentTime;
      switch (eventName) {
        case "move":
          playTone(800, "sine", t, 0.015, (g, time) => {
            g.setValueAtTime(0.4, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.015);
          });
          break;
        case "rotate":
          playTone(1200, "sine", t, 0.02, (g, time) => {
            g.setValueAtTime(0.4, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.02);
          });
          break;
        case "softdrop":
          playTone((f, time) => {
            f.setValueAtTime(600, time);
            f.exponentialRampToValueAtTime(300, time + 0.03);
          }, "sine", t, 0.03, (g, time) => {
            g.setValueAtTime(0.3, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.03);
          });
          break;
        case "harddrop":
          playTone(80, "sine", t, 0.08, (g, time) => {
            g.setValueAtTime(0.8, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.08);
          });
          playNoise(t, 0.08, (g, time) => {
            g.setValueAtTime(0.6, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.08);
          }, (f, time) => {
            f.type = "lowpass";
            f.frequency.setValueAtTime(500, time);
          });
          break;
        case "lock":
          playTone(200, "sine", t, 0.04, (g, time) => {
            g.setValueAtTime(0.6, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.04);
          });
          break;
        case "clear1":
          playTone((f, time) => {
            f.setValueAtTime(523, time);
            f.linearRampToValueAtTime(784, time + 0.15);
          }, "sine", t, 0.15, (g, time) => {
            g.setValueAtTime(0.5, time);
            g.linearRampToValueAtTime(0, time + 0.15);
          });
          break;
        case "clear2":
          playTone(523, "sine", t, 0.08, (g, time) => {
            g.setValueAtTime(0.5, time);
            g.linearRampToValueAtTime(0, time + 0.08);
          });
          playTone(659, "sine", t + 0.08, 0.08, (g, time) => {
            g.setValueAtTime(0.5, time);
            g.linearRampToValueAtTime(0, time + 0.08);
          });
          break;
        case "clear3":
          [523, 659, 784].forEach((freq, i) => {
            playTone(freq, "sine", t + i * 0.06, 0.06, (g, time) => {
              g.setValueAtTime(0.5, time);
              g.linearRampToValueAtTime(0, time + 0.06);
            });
          });
          break;
        case "clear4": {
          const delay = ctx.createDelay();
          delay.delayTime.value = 0.1;
          const feedback = ctx.createGain();
          feedback.gain.value = 0.4;
          delay.connect(feedback);
          feedback.connect(delay);
          delay.connect(masterGain);
          [523, 659, 784, 1046].forEach((freq) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = "square";
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.15, t + 0.05);
            g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.connect(g);
            g.connect(masterGain);
            g.connect(delay);
            osc.start(t);
            osc.stop(t + 0.3);
            osc.onended = () => {
              g.disconnect();
            };
          });
          setTimeout(() => {
            delay.disconnect();
            feedback.disconnect();
          }, 1500);
          break;
        }
        case "tspin": {
          playNoise(t, 0.2, (g, time) => {
            g.setValueAtTime(0.3, time);
            g.linearRampToValueAtTime(0, time + 0.2);
          }, (f, time) => {
            f.type = "bandpass";
            f.frequency.setValueAtTime(400, time);
            f.frequency.linearRampToValueAtTime(2e3, time + 0.2);
          });
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(1400, t);
          lfo.type = "sine";
          lfo.frequency.setValueAtTime(15, t);
          lfoGain.gain.setValueAtTime(30, t);
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t);
          lfo.start(t);
          osc.stop(t + 0.2);
          lfo.stop(t + 0.2);
          osc.onended = () => {
            gain.disconnect();
            lfoGain.disconnect();
          };
          break;
        }
        case "tspinClear": {
          playNoise(t, 0.35, (g, time) => {
            g.setValueAtTime(0.5, time);
            g.linearRampToValueAtTime(0, time + 0.35);
          }, (f, time) => {
            f.type = "bandpass";
            f.frequency.setValueAtTime(400, time);
            f.frequency.linearRampToValueAtTime(3e3, time + 0.35);
          });
          playTone((f, time) => {
            f.setValueAtTime(1400, time);
            f.linearRampToValueAtTime(2e3, time + 0.35);
          }, "sine", t, 0.35, (g, time) => {
            g.setValueAtTime(0.6, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.35);
          });
          break;
        }
        case "combo": {
          const count = Math.min(20, Math.max(1, comboCount || 1));
          const comboFreq = Math.min(1200, 440 + count * 40);
          playTone(comboFreq, "sine", t, 0.06, (g, time) => {
            g.setValueAtTime(0.4, time);
            g.linearRampToValueAtTime(0, time + 0.06);
          });
          break;
        }
        case "b2b":
          for (let i = 0; i < 10; i++) {
            const st = t + Math.random() * 0.15;
            const fr = 800 + Math.random() * 1200;
            playTone(fr, "sine", st, 0.05, (g, time) => {
              g.setValueAtTime(0.2, time);
              g.linearRampToValueAtTime(0, time + 0.05);
            });
          }
          break;
        case "perfectClear": {
          const delay = ctx.createDelay();
          delay.delayTime.value = 0.15;
          const feedback = ctx.createGain();
          feedback.gain.value = 0.3;
          delay.connect(feedback);
          feedback.connect(delay);
          delay.connect(masterGain);
          [523, 659, 784, 1046, 1318].forEach((freq, i) => {
            const st = t + i * 0.05;
            const duration = i === 4 ? 0.3 : 0.1;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.5, st);
            g.gain.linearRampToValueAtTime(0.01, st + duration);
            osc.connect(g);
            g.connect(masterGain);
            g.connect(delay);
            osc.start(st);
            osc.stop(st + duration);
            osc.onended = () => g.disconnect();
          });
          setTimeout(() => {
            delay.disconnect();
            feedback.disconnect();
          }, 1500);
          break;
        }
        case "hold":
          playNoise(t, 0.05, (g, time) => {
            g.setValueAtTime(0.3, time);
            g.linearRampToValueAtTime(0, time + 0.05);
          }, (f, time) => {
            f.type = "bandpass";
            f.frequency.setValueAtTime(600, time);
            f.Q.value = 1;
          });
          break;
        case "gameOver": {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const lfo = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(523.25, t);
          osc.frequency.exponentialRampToValueAtTime(130.81, t + 0.8);
          lfo.type = "sine";
          lfo.frequency.value = 8;
          lfoGain.gain.value = 10;
          lfo.connect(lfoGain);
          lfoGain.connect(osc.frequency);
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(t);
          lfo.start(t);
          osc.stop(t + 0.8);
          lfo.stop(t + 0.8);
          osc.onended = () => {
            g.disconnect();
            lfoGain.disconnect();
          };
          break;
        }
        case "levelUp":
          playTone(523, "sine", t, 0.075, (g, time) => {
            g.setValueAtTime(0.4, time);
            g.linearRampToValueAtTime(0, time + 0.075);
          });
          playTone(1046, "sine", t + 0.075, 0.075, (g, time) => {
            g.setValueAtTime(0.4, time);
            g.linearRampToValueAtTime(0, time + 0.075);
          });
          break;
        case "menuMove":
          playTone(600, "sine", t, 8e-3, (g, time) => {
            g.setValueAtTime(0.15, time);
            g.exponentialRampToValueAtTime(0.01, time + 8e-3);
          });
          break;
        case "menuSelect":
          playTone(440, "sine", t, 0.04, (g, time) => {
            g.setValueAtTime(0.4, time);
            g.linearRampToValueAtTime(0, time + 0.04);
          });
          playTone(880, "sine", t + 0.03, 0.04, (g, time) => {
            g.setValueAtTime(0.4, time);
            g.linearRampToValueAtTime(0, time + 0.04);
          });
          break;
        case "countdownTick":
          playTone(1e3, "sine", t, 0.015, (g, time) => {
            g.setValueAtTime(0.3, time);
            g.exponentialRampToValueAtTime(0.01, time + 0.015);
          });
          break;
        case "countdownGo":
          [440, 880, 1760].forEach((freq, i) => {
            playTone(freq, "sine", t + i * 0.06, 0.08, (g, time) => {
              g.setValueAtTime(0.4, time);
              g.linearRampToValueAtTime(0, time + 0.08);
            });
          });
          break;
      }
    }
    function dispose() {
      if (ctx) {
        ctx.close();
        ctx = null;
        masterGain = null;
        noiseBuffer = null;
      }
    }
    return {
      play,
      dispose
    };
  }

  // js/music-player.js
  function createMusicPlayer(containerEl, settingsRef) {
    const state = {
      playlist: [],
      currentIndex: -1,
      isPlaying: false,
      shuffle: false,
      repeat: 0,
      // 0: off, 1: all, 2: one
      minimized: true,
      activePlayer: 0,
      // 0 or 1 for crossfading
      audioContext: null
    };
    const elements = {};
    const players = [
      { audio: new Audio(), source: null, gain: null },
      { audio: new Audio(), source: null, gain: null }
    ];
    function initAudioContext() {
      if (!state.audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        state.audioContext = new AudioContext();
        players.forEach((p) => {
          p.source = state.audioContext.createMediaElementSource(p.audio);
          p.gain = state.audioContext.createGain();
          p.source.connect(p.gain);
          p.gain.connect(state.audioContext.destination);
          p.audio.addEventListener("ended", onTrackEnded);
        });
      }
      if (state.audioContext.state === "suspended") {
        state.audioContext.resume();
      }
    }
    function buildUI() {
      const wrapper = document.createElement("div");
      wrapper.className = "mp-container mp-minimized";
      elements.wrapper = wrapper;
      const header = document.createElement("div");
      header.className = "mp-header";
      header.style.display = "flex";
      header.style.justifyContent = "space-between";
      header.style.alignItems = "center";
      header.style.marginBottom = "6px";
      const title = document.createElement("h3");
      title.style.margin = "0";
      title.style.fontSize = "14px";
      title.style.letterSpacing = "2px";
      title.style.color = "#c0c0c0";
      title.textContent = "MUSIC PLAYER";
      const closeBtn = document.createElement("button");
      closeBtn.className = "settings-close";
      closeBtn.innerHTML = "&#x00D7;";
      closeBtn.addEventListener("click", toggle);
      header.appendChild(title);
      header.appendChild(closeBtn);
      wrapper.appendChild(header);
      const panel = document.createElement("div");
      panel.className = "mp-panel";
      elements.panel = panel;
      wrapper.appendChild(panel);
      const dropZone = document.createElement("div");
      dropZone.className = "mp-drop-zone";
      const dropText = document.createElement("span");
      dropText.textContent = "Drop audio files here or ";
      dropZone.appendChild(dropText);
      const browseBtn = document.createElement("button");
      browseBtn.textContent = "Browse";
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      fileInput.accept = "audio/*";
      fileInput.style.display = "none";
      browseBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => handleFiles(e.target.files));
      dropZone.appendChild(browseBtn);
      dropZone.appendChild(fileInput);
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("active");
      });
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("active"));
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("active");
        handleFiles(e.dataTransfer.files);
      });
      panel.appendChild(dropZone);
      const nowPlaying = document.createElement("div");
      nowPlaying.className = "mp-now-playing";
      const marquee = document.createElement("div");
      marquee.className = "mp-marquee";
      marquee.textContent = "No track selected";
      elements.nowPlayingText = marquee;
      nowPlaying.appendChild(marquee);
      panel.appendChild(nowPlaying);
      const progressContainer = document.createElement("div");
      progressContainer.className = "mp-progress";
      const progressFill = document.createElement("div");
      progressFill.className = "mp-progress-fill";
      progressFill.style.width = "0%";
      elements.progressFill = progressFill;
      const timeDisplay = document.createElement("div");
      timeDisplay.className = "mp-progress-time";
      timeDisplay.textContent = "00:00 / 00:00";
      elements.timeDisplay = timeDisplay;
      progressContainer.appendChild(progressFill);
      progressContainer.addEventListener("click", seek);
      panel.appendChild(progressContainer);
      panel.appendChild(timeDisplay);
      const transport = document.createElement("div");
      transport.className = "mp-transport";
      const btnShuffle = document.createElement("button");
      btnShuffle.className = "mp-btn";
      btnShuffle.textContent = "\u{1F500}";
      btnShuffle.addEventListener("click", toggleShuffle);
      elements.btnShuffle = btnShuffle;
      const btnPrev = document.createElement("button");
      btnPrev.className = "mp-btn";
      btnPrev.textContent = "\u23EE";
      btnPrev.addEventListener("click", playPrev);
      const btnPlay = document.createElement("button");
      btnPlay.className = "mp-btn";
      btnPlay.textContent = "\u25B6";
      btnPlay.addEventListener("click", togglePlay);
      elements.btnPlay = btnPlay;
      const btnNext = document.createElement("button");
      btnNext.className = "mp-btn";
      btnNext.textContent = "\u23ED";
      btnNext.addEventListener("click", playNext);
      const btnRepeat = document.createElement("button");
      btnRepeat.className = "mp-btn";
      btnRepeat.textContent = "\u21BB";
      btnRepeat.addEventListener("click", toggleRepeat);
      elements.btnRepeat = btnRepeat;
      transport.appendChild(btnShuffle);
      transport.appendChild(btnPrev);
      transport.appendChild(btnPlay);
      transport.appendChild(btnNext);
      transport.appendChild(btnRepeat);
      panel.appendChild(transport);
      const volume = document.createElement("div");
      volume.className = "mp-volume";
      const volIcon = document.createElement("span");
      volIcon.className = "mp-volume-icon";
      volIcon.textContent = settingsRef.musicMuted ? "\u{1F507}" : "\u{1F50A}";
      volIcon.style.cursor = "pointer";
      volIcon.addEventListener("click", () => {
        settingsRef.musicMuted = !settingsRef.musicMuted;
        updateVolume();
      });
      elements.volIcon = volIcon;
      const volSlider = document.createElement("input");
      volSlider.type = "range";
      volSlider.className = "mp-volume-slider";
      volSlider.min = 0;
      volSlider.max = 100;
      volSlider.value = settingsRef.musicVolume;
      volSlider.addEventListener("input", (e) => {
        settingsRef.musicVolume = Number(e.target.value);
        settingsRef.musicMuted = false;
        updateVolume();
      });
      elements.volSlider = volSlider;
      volume.appendChild(volIcon);
      volume.appendChild(volSlider);
      panel.appendChild(volume);
      const playlist = document.createElement("div");
      playlist.className = "mp-playlist";
      elements.playlist = playlist;
      panel.appendChild(playlist);
      containerEl.appendChild(wrapper);
      requestAnimationFrame(updateLoop);
    }
    function formatTime2(seconds) {
      if (isNaN(seconds) || seconds < 0) return "00:00";
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    function handleFiles(files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("audio/")) {
          const url = URL.createObjectURL(file);
          const tempAudio = new Audio(url);
          tempAudio.addEventListener("loadedmetadata", () => {
            const track = {
              name: file.name.replace(/\.[^/.]+$/, ""),
              file,
              url,
              duration: tempAudio.duration
            };
            state.playlist.push(track);
            renderPlaylist();
            if (state.playlist.length === 1 && !state.isPlaying) {
              playTrack(0);
            }
          });
        }
      }
    }
    function renderPlaylist() {
      elements.playlist.innerHTML = "";
      state.playlist.forEach((track, index) => {
        const item = document.createElement("div");
        item.className = "mp-track";
        if (index === state.currentIndex) {
          item.classList.add("playing");
        }
        const nameSpan = document.createElement("span");
        nameSpan.className = "mp-track-name";
        nameSpan.textContent = `${index + 1}. ${track.name}`;
        nameSpan.style.cursor = "pointer";
        nameSpan.addEventListener("click", () => playTrack(index));
        const durSpan = document.createElement("span");
        durSpan.className = "mp-track-duration";
        durSpan.textContent = formatTime2(track.duration);
        const removeBtn = document.createElement("button");
        removeBtn.className = "mp-track-remove";
        removeBtn.textContent = "\xD7";
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          removeTrack(index);
        });
        item.appendChild(nameSpan);
        item.appendChild(durSpan);
        item.appendChild(removeBtn);
        elements.playlist.appendChild(item);
      });
    }
    function removeTrack(index) {
      URL.revokeObjectURL(state.playlist[index].url);
      state.playlist.splice(index, 1);
      if (index === state.currentIndex) {
        if (state.playlist.length === 0) {
          stopPlayback();
        } else {
          playTrack(index % state.playlist.length);
        }
      } else if (index < state.currentIndex) {
        state.currentIndex--;
      }
      renderPlaylist();
    }
    function stopPlayback() {
      const p = players[state.activePlayer];
      p.audio.pause();
      state.isPlaying = false;
      state.currentIndex = -1;
      elements.btnPlay.textContent = "\u25B6";
      elements.nowPlayingText.textContent = "No track selected";
    }
    function playTrack(index, useCrossfade = true) {
      if (state.playlist.length === 0 || index < 0 || index >= state.playlist.length) return;
      initAudioContext();
      const track = state.playlist[index];
      const nextPlayerIdx = (state.activePlayer + 1) % 2;
      const currentPlayer = players[state.activePlayer];
      const nextPlayer = players[nextPlayerIdx];
      nextPlayer.audio.src = track.url;
      nextPlayer.audio.currentTime = 0;
      const vol = getTargetVolume();
      const fadeTime = settingsRef.crossfadeDuration || 0;
      if (useCrossfade && fadeTime > 0 && state.isPlaying) {
        const now = state.audioContext.currentTime;
        currentPlayer.gain.gain.cancelScheduledValues(now);
        currentPlayer.gain.gain.setValueAtTime(currentPlayer.gain.gain.value, now);
        currentPlayer.gain.gain.linearRampToValueAtTime(0.01, now + fadeTime);
        setTimeout(() => currentPlayer.audio.pause(), fadeTime * 1e3 + 100);
        nextPlayer.gain.gain.cancelScheduledValues(now);
        nextPlayer.gain.gain.setValueAtTime(0.01, now);
        nextPlayer.gain.gain.linearRampToValueAtTime(vol, now + fadeTime);
      } else {
        currentPlayer.audio.pause();
        nextPlayer.gain.gain.value = vol;
      }
      nextPlayer.audio.play().catch((e) => console.warn("Playback prevented", e));
      state.activePlayer = nextPlayerIdx;
      state.currentIndex = index;
      state.isPlaying = true;
      elements.btnPlay.textContent = "\u23F8";
      elements.nowPlayingText.textContent = track.name;
      renderPlaylist();
    }
    function togglePlay() {
      if (state.playlist.length === 0) return;
      if (state.currentIndex === -1) {
        playTrack(0);
        return;
      }
      initAudioContext();
      const p = players[state.activePlayer];
      if (state.isPlaying) {
        p.audio.pause();
        state.isPlaying = false;
        elements.btnPlay.textContent = "\u25B6";
      } else {
        p.audio.play();
        state.isPlaying = true;
        elements.btnPlay.textContent = "\u23F8";
      }
    }
    function playNext() {
      if (state.playlist.length === 0) return;
      let nextIndex = state.currentIndex + 1;
      if (state.shuffle) {
        nextIndex = Math.floor(Math.random() * state.playlist.length);
      } else if (nextIndex >= state.playlist.length) {
        nextIndex = 0;
      }
      playTrack(nextIndex);
    }
    function playPrev() {
      if (state.playlist.length === 0) return;
      const p = players[state.activePlayer];
      if (p.audio.currentTime > 3) {
        p.audio.currentTime = 0;
        return;
      }
      let prevIndex = state.currentIndex - 1;
      if (prevIndex < 0) {
        prevIndex = state.playlist.length - 1;
      }
      playTrack(prevIndex);
    }
    function onTrackEnded() {
      if (!state.isPlaying) return;
      if (state.repeat === 2) {
        const p = players[state.activePlayer];
        p.audio.currentTime = 0;
        p.audio.play();
      } else if (state.repeat === 1) {
        playNext();
      } else {
        if (state.currentIndex >= state.playlist.length - 1 && !state.shuffle) {
          stopPlayback();
        } else {
          playNext();
        }
      }
    }
    function seek(e) {
      if (!state.isPlaying || state.currentIndex === -1) return;
      const rect = elements.progressFill.parentElement.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const p = players[state.activePlayer];
      if (p.audio.duration) {
        p.audio.currentTime = pos * p.audio.duration;
      }
    }
    function getTargetVolume() {
      if (settingsRef.musicMuted) return 0;
      const v = settingsRef.musicVolume / 100;
      return v * v;
    }
    function updateVolume() {
      if (!state.audioContext) return;
      const vol = getTargetVolume();
      elements.volIcon.textContent = settingsRef.musicMuted ? "\u{1F507}" : "\u{1F50A}";
      elements.volSlider.value = settingsRef.musicVolume;
      const p = players[state.activePlayer];
      if (p && p.gain) {
        const now = state.audioContext.currentTime;
        p.gain.gain.cancelScheduledValues(now);
        p.gain.gain.setValueAtTime(p.gain.gain.value, now);
        p.gain.gain.linearRampToValueAtTime(vol, now + 0.1);
      }
    }
    function toggleShuffle() {
      state.shuffle = !state.shuffle;
      elements.btnShuffle.classList.toggle("active", state.shuffle);
    }
    function toggleRepeat() {
      state.repeat = (state.repeat + 1) % 3;
      elements.btnRepeat.classList.remove("active");
      elements.btnRepeat.textContent = "\u21BB";
      if (state.repeat === 1) {
        elements.btnRepeat.classList.add("active");
      } else if (state.repeat === 2) {
        elements.btnRepeat.classList.add("active");
        elements.btnRepeat.textContent = "\u{1F502}";
      }
    }
    function updateLoop() {
      if (state.isPlaying && state.currentIndex !== -1) {
        const p = players[state.activePlayer];
        const current = p.audio.currentTime || 0;
        const total = p.audio.duration || 1;
        elements.progressFill.style.width = `${current / total * 100}%`;
        elements.timeDisplay.textContent = `${formatTime2(current)} / ${formatTime2(total)}`;
      }
      requestAnimationFrame(updateLoop);
    }
    function toggle() {
      state.minimized = !state.minimized;
      if (state.minimized) {
        elements.wrapper.classList.add("mp-minimized");
      } else {
        elements.wrapper.classList.remove("mp-minimized");
      }
    }
    function isVisible() {
      return !state.minimized;
    }
    function dispose() {
      if (elements.wrapper && elements.wrapper.parentNode) {
        elements.wrapper.parentNode.removeChild(elements.wrapper);
      }
      state.playlist.forEach((track) => URL.revokeObjectURL(track.url));
      if (state.audioContext) {
        state.audioContext.close();
      }
    }
    buildUI();
    return {
      toggle,
      isVisible,
      dispose
    };
  }

  // js/timer.js
  function formatTime(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1e3);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor(ms % 1e3 / 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
  function formatTimeShort(ms) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.ceil(ms / 1e3);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  function createStopwatch() {
    let elapsed = 0;
    let running = false;
    let startTimestamp = 0;
    return {
      start() {
        if (!running) {
          running = true;
          startTimestamp = performance.now() - elapsed;
        }
      },
      pause() {
        if (running) {
          elapsed = performance.now() - startTimestamp;
          running = false;
        }
      },
      resume() {
        this.start();
      },
      reset() {
        elapsed = 0;
        running = false;
        startTimestamp = 0;
      },
      /** Update and return elapsed time in ms. Call each frame. */
      update() {
        if (running) {
          return performance.now() - startTimestamp;
        }
        return elapsed;
      },
      /** Get current elapsed time without updating */
      getElapsed() {
        if (running) {
          return performance.now() - startTimestamp;
        }
        return elapsed;
      },
      format() {
        return formatTime(this.getElapsed());
      },
      isRunning() {
        return running;
      }
    };
  }
  function createCountdown(durationMs) {
    let remaining = durationMs;
    let running = false;
    let lastUpdate = 0;
    return {
      start() {
        if (!running) {
          running = true;
          lastUpdate = performance.now();
        }
      },
      pause() {
        if (running) {
          remaining -= performance.now() - lastUpdate;
          if (remaining < 0) remaining = 0;
          running = false;
        }
      },
      resume() {
        this.start();
      },
      reset() {
        remaining = durationMs;
        running = false;
        lastUpdate = 0;
      },
      /** Update and return remaining time in ms. Call each frame. */
      update() {
        if (running) {
          const now = performance.now();
          remaining -= now - lastUpdate;
          lastUpdate = now;
          if (remaining < 0) remaining = 0;
        }
        return remaining;
      },
      /** Get remaining time without updating */
      getRemaining() {
        if (running) {
          const r = remaining - (performance.now() - lastUpdate);
          return Math.max(0, r);
        }
        return remaining;
      },
      format() {
        return formatTimeShort(this.getRemaining());
      },
      formatPrecise() {
        return formatTime(this.getRemaining());
      },
      isExpired() {
        return this.getRemaining() <= 0;
      },
      isRunning() {
        return running;
      },
      /** Get total duration for progress calculation */
      getTotalDuration() {
        return durationMs;
      }
    };
  }

  // js/modes.js
  var MODE_SPRINT = "sprint";
  var MODE_BLITZ = "blitz";
  var MODE_CLASSIC = "classic";
  var MODE_INFO = {
    [MODE_SPRINT]: {
      name: "40 LINES",
      subtitle: "SPRINT",
      description: "Clear 40 lines as fast as possible.",
      icon: "\u23F1"
    },
    [MODE_BLITZ]: {
      name: "BLITZ",
      subtitle: "2 MINUTES",
      description: "Score as many points as you can before time runs out.",
      icon: "\u26A1"
    },
    [MODE_CLASSIC]: {
      name: "CLASSIC",
      subtitle: "MARATHON",
      description: "Endless mode with increasing gravity. How far can you go?",
      icon: "\u221E"
    }
  };
  function getGravityInterval(level) {
    return Math.max(50, 1e3 - (level - 1) * 90);
  }
  function createModeState(modeId) {
    const stats = {
      linesCleared: 0,
      score: 0,
      level: 1,
      piecesPlaced: 0,
      tSpins: 0,
      tetrises: 0,
      maxCombo: 0,
      perfectClears: 0,
      allClears: 0,
      startTime: 0
    };
    let timer = null;
    let goalLines = 0;
    let completed = false;
    let gameOver = false;
    switch (modeId) {
      case MODE_SPRINT:
        timer = createStopwatch();
        goalLines = 40;
        break;
      case MODE_BLITZ:
        timer = createCountdown(12e4);
        break;
      case MODE_CLASSIC:
        timer = createStopwatch();
        break;
    }
    return {
      modeId,
      stats,
      timer,
      /** Start the mode timer */
      start() {
        stats.startTime = performance.now();
        if (timer) timer.start();
      },
      /** Pause the mode timer */
      pause() {
        if (timer) timer.pause();
      },
      /** Resume the mode timer */
      resume() {
        if (timer) timer.resume();
      },
      /** Reset everything */
      reset() {
        stats.linesCleared = 0;
        stats.score = 0;
        stats.level = 1;
        stats.piecesPlaced = 0;
        stats.tSpins = 0;
        stats.tetrises = 0;
        stats.maxCombo = 0;
        stats.perfectClears = 0;
        stats.allClears = 0;
        stats.startTime = 0;
        completed = false;
        gameOver = false;
        if (timer) timer.reset();
      },
      /** Update the timer. Call each frame. */
      updateTimer() {
        if (!timer) return;
        timer.update();
        if (modeId === MODE_BLITZ && timer.isExpired && timer.isExpired()) {
          completed = true;
        }
      },
      /** Record lines cleared and update stats */
      addLines(count) {
        stats.linesCleared += count;
        if (modeId === MODE_CLASSIC || modeId === MODE_BLITZ) {
          stats.level = Math.floor(stats.linesCleared / 10) + 1;
        }
        if (modeId === MODE_SPRINT && stats.linesCleared >= goalLines) {
          completed = true;
          if (timer) timer.pause();
        }
      },
      /** Add score points */
      addScore(points) {
        stats.score += points;
      },
      /** Record a piece placement */
      addPiece() {
        stats.piecesPlaced++;
      },
      /** Record a T-spin */
      addTSpin() {
        stats.tSpins++;
      },
      /** Record a Tetris */
      addTetris() {
        stats.tetrises++;
      },
      /** Update max combo */
      updateCombo(combo) {
        if (combo > stats.maxCombo) {
          stats.maxCombo = combo;
        }
      },
      /** Record a perfect clear */
      addPerfectClear() {
        stats.perfectClears++;
      },
      /** Mark as game over (top-out) */
      setGameOver() {
        gameOver = true;
        if (timer) timer.pause();
      },
      /** Check if the game is won (Sprint goal reached or Blitz time expired) */
      isCompleted() {
        return completed;
      },
      /** Check if the game ended by losing (top-out) */
      isGameOver() {
        return gameOver;
      },
      /** Check if the game should end for any reason */
      isFinished() {
        return completed || gameOver;
      },
      /** Get the current gravity interval based on level */
      getDropInterval() {
        if (modeId === MODE_SPRINT) {
          return 1e3;
        }
        return getGravityInterval(stats.level);
      },
      /** Get the formatted timer display */
      getTimerDisplay() {
        if (!timer) return "";
        return timer.format();
      },
      /** Get precise timer display (with centiseconds) */
      getTimerPrecise() {
        if (!timer) return "";
        if (timer.formatPrecise) return timer.formatPrecise();
        return timer.format();
      },
      /** Get lines remaining (Sprint only) */
      getLinesRemaining() {
        if (modeId !== MODE_SPRINT) return null;
        return Math.max(0, goalLines - stats.linesCleared);
      },
      /** Get the primary display stat label for the HUD */
      getPrimaryStatLabel() {
        switch (modeId) {
          case MODE_SPRINT:
            return "LINES LEFT";
          case MODE_BLITZ:
            return "SCORE";
          case MODE_CLASSIC:
            return "SCORE";
          default:
            return "SCORE";
        }
      },
      /** Get the primary display stat value for the HUD */
      getPrimaryStatValue() {
        switch (modeId) {
          case MODE_SPRINT:
            return Math.max(0, goalLines - stats.linesCleared);
          case MODE_BLITZ:
            return stats.score;
          case MODE_CLASSIC:
            return stats.score;
          default:
            return stats.score;
        }
      },
      /** Whether to show score in the HUD (Sprint hides it during play) */
      showsScore() {
        return modeId !== MODE_SPRINT;
      },
      /** Whether the timer counts down (affects display style) */
      isCountdown() {
        return modeId === MODE_BLITZ;
      },
      /** Get Blitz remaining seconds for countdown tick sounds */
      getRemainingSeconds() {
        if (modeId !== MODE_BLITZ || !timer) return null;
        return Math.ceil(timer.getRemaining() / 1e3);
      },
      /** Get results for the game-over screen */
      getResults() {
        const r = { ...stats };
        r.modeId = modeId;
        r.modeName = MODE_INFO[modeId]?.name || modeId;
        r.finalTime = timer ? timer.format() : "";
        r.finalTimePrecise = timer && timer.formatPrecise ? timer.formatPrecise() : r.finalTime;
        r.completed = completed;
        r.gameOver = gameOver;
        return r;
      }
    };
  }

  // js/menu.js
  function createMenuSystem(container) {
    let currentScreen = null;
    let onModeSelectCallback = null;
    let onResumeCallback = null;
    let onRestartCallback = null;
    let onQuitCallback = null;
    const screens = {};
    const mainMenu = createElement("div", "menu-screen menu-main");
    mainMenu.innerHTML = `
        <div class="menu-content">
            <h1 class="menu-title">
                <span class="title-u">u</span><span class="title-lol">lol</span><span class="title-tris">Tris</span>
            </h1>
            <p class="menu-subtitle">A cozy block stacker</p>
            <div class="menu-buttons">
                <button class="menu-btn menu-btn-primary" data-action="play">PLAY</button>
                <button class="menu-btn" data-action="settings">SETTINGS</button>
            </div>
            <div class="menu-footer">
                <span class="menu-hint">Press any key or click PLAY to start</span>
            </div>
        </div>
    `;
    screens.main = mainMenu;
    container.appendChild(mainMenu);
    const modeSelect = createElement("div", "menu-screen menu-mode-select");
    const modesHtml = [MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC].map((id) => {
      const info = MODE_INFO[id];
      return `
            <button class="mode-card" data-mode="${id}">
                <div class="mode-icon">${info.icon}</div>
                <div class="mode-card-text">
                    <h3>${info.name}</h3>
                    <span class="mode-subtitle">${info.subtitle}</span>
                    <p>${info.description}</p>
                </div>
            </button>
        `;
    }).join("");
    modeSelect.innerHTML = `
        <div class="menu-content">
            <h2 class="menu-heading">SELECT MODE</h2>
            ${modesHtml}
            <button class="menu-btn menu-btn-back" data-action="back">BACK</button>
        </div>
    `;
    screens.modeSelect = modeSelect;
    container.appendChild(modeSelect);
    const pauseOverlay = createElement("div", "menu-screen menu-pause");
    pauseOverlay.innerHTML = `
        <div class="menu-content pause-content">
            <h2 class="menu-heading">PAUSED</h2>
            <div class="menu-buttons">
                <button class="menu-btn menu-btn-primary" data-action="resume">RESUME</button>
                <button class="menu-btn" data-action="restart">RESTART</button>
                <button class="menu-btn" data-action="quit">QUIT TO MENU</button>
            </div>
            <span class="menu-hint">Press ESC to resume</span>
        </div>
    `;
    screens.pause = pauseOverlay;
    container.appendChild(pauseOverlay);
    const resultsScreen = createElement("div", "menu-screen menu-results");
    resultsScreen.innerHTML = `
        <div class="menu-content">
            <h2 class="results-title" id="results-title">GAME OVER</h2>
            <div class="results-grid" id="results-grid"></div>
            <div class="menu-buttons">
                <button class="menu-btn menu-btn-primary" data-action="retry">RETRY</button>
                <button class="menu-btn" data-action="quit">MENU</button>
            </div>
        </div>
    `;
    screens.results = resultsScreen;
    container.appendChild(resultsScreen);
    Object.values(screens).forEach((s) => s.style.display = "none");
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      const modeCard = e.target.closest("[data-mode]");
      if (modeCard) {
        const modeId = modeCard.dataset.mode;
        if (onModeSelectCallback) onModeSelectCallback(modeId);
        return;
      }
      if (!btn) return;
      const action = btn.dataset.action;
      switch (action) {
        case "play":
          showScreen("modeSelect");
          break;
        case "settings":
          document.dispatchEvent(new CustomEvent("uloltris-open-settings"));
          break;
        case "back":
          showScreen("main");
          break;
        case "resume":
          hideAll();
          if (onResumeCallback) onResumeCallback();
          break;
        case "restart":
          hideAll();
          if (onRestartCallback) onRestartCallback();
          break;
        case "retry":
          hideAll();
          if (onRestartCallback) onRestartCallback();
          break;
        case "quit":
          if (onQuitCallback) onQuitCallback();
          showScreen("main");
          break;
      }
    });
    document.addEventListener("keydown", (e) => {
      if (currentScreen === "main" && !e.repeat) {
        if (e.code !== "Escape" && !e.code.startsWith("F")) {
          showScreen("modeSelect");
        }
      }
    });
    function createElement(tag, className) {
      const el = document.createElement(tag);
      el.className = className;
      return el;
    }
    function showScreen(name) {
      hideAll();
      if (screens[name]) {
        screens[name].style.display = "flex";
        currentScreen = name;
      }
    }
    function hideAll() {
      Object.values(screens).forEach((s) => s.style.display = "none");
      currentScreen = null;
    }
    function showResults(results) {
      const titleEl = resultsScreen.querySelector("#results-title");
      const gridEl = resultsScreen.querySelector("#results-grid");
      if (results.completed) {
        titleEl.textContent = results.modeId === "sprint" ? "SPRINT COMPLETE!" : "TIME'S UP!";
        titleEl.className = "results-title results-complete";
      } else {
        titleEl.textContent = "GAME OVER";
        titleEl.className = "results-title results-gameover";
      }
      const stats = [];
      if (results.modeId === "sprint") {
        stats.push({ label: "TIME", value: results.finalTimePrecise || results.finalTime, highlight: true });
      } else {
        stats.push({ label: "SCORE", value: results.score.toLocaleString(), highlight: true });
      }
      stats.push({ label: "LINES", value: results.linesCleared });
      stats.push({ label: "LEVEL", value: results.level });
      stats.push({ label: "PIECES", value: results.piecesPlaced });
      if (results.tSpins > 0) {
        stats.push({ label: "T-SPINS", value: results.tSpins });
      }
      if (results.tetrises > 0) {
        stats.push({ label: "TETRISES", value: results.tetrises });
      }
      if (results.maxCombo > 0) {
        stats.push({ label: "MAX COMBO", value: results.maxCombo });
      }
      if (results.perfectClears > 0) {
        stats.push({ label: "PERFECT CLEARS", value: results.perfectClears });
      }
      if (results.modeId !== "sprint") {
        stats.push({ label: "TIME", value: results.finalTime });
      }
      gridEl.innerHTML = stats.map((s) => `
            <div class="results-stat ${s.highlight ? "results-stat-highlight" : ""}">
                <span class="results-stat-label">${s.label}</span>
                <span class="results-stat-value">${s.value}</span>
            </div>
        `).join("");
      showScreen("results");
    }
    return {
      showScreen,
      hideAll,
      showResults,
      getCurrentScreen() {
        return currentScreen;
      },
      isAnyScreenVisible() {
        return currentScreen !== null;
      },
      onModeSelect(callback) {
        onModeSelectCallback = callback;
      },
      onResume(callback) {
        onResumeCallback = callback;
      },
      onRestart(callback) {
        onRestartCallback = callback;
      },
      onQuit(callback) {
        onQuitCallback = callback;
      }
    };
  }

  // js/piece.js
  var COLS = 10;
  var VISIBLE_ROWS = 20;
  var BUFFER_ROWS = 40;
  var BLOCK_SIZE = 30;
  var SHAPES = {
    I: { matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: "#00ffff" },
    J: { matrix: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: "#0055ff" },
    L: { matrix: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: "#ffa500" },
    O: { matrix: [[1, 1], [1, 1]], color: "#ffff00" },
    S: { matrix: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: "#00ff00" },
    T: { matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: "#aa00ff" },
    Z: { matrix: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: "#ff0000" }
  };
  var KICKS = {
    JLSTZ: {
      "0->1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      "1->0": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      "1->2": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
      "2->1": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
      "2->3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
      "3->2": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      "3->0": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
      "0->3": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
    },
    I: {
      "0->1": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "1->0": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "1->2": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
      "2->1": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "2->3": [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
      "3->2": [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
      "3->0": [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
      "0->3": [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
    }
  };
  function rotateMatrix(matrix, dir) {
    const transposed = matrix[0].map((_, i) => matrix.map((row) => row[i]));
    if (dir > 0) return transposed.map((row) => row.reverse());
    return transposed.reverse();
  }
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  function generateBag() {
    return shuffle(["I", "J", "L", "O", "S", "T", "Z"]);
  }
  function fillQueue(queue, minSize = 7) {
    while (queue.length < minSize) {
      queue.push(...generateBag());
    }
  }
  function getNextPiece(queue) {
    fillQueue(queue);
    return queue.shift();
  }
  function getSpawnPos(matrix) {
    const firstFilledRow = matrix.findIndex((row) => row.some((v) => v !== 0));
    return {
      x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2),
      y: BUFFER_ROWS - VISIBLE_ROWS - firstFilledRow
    };
  }
  function tryRotate(player, arena, collide2, dir) {
    const originalMatrix = player.matrix;
    const originalRotation = player.rotation;
    const rotated = rotateMatrix(player.matrix, dir);
    const newRotation = (player.rotation + dir + 4) % 4;
    player.matrix = rotated;
    if (player.shape === "O") {
      player.rotation = newRotation;
      return { success: true, kickIndex: 0 };
    }
    const kickKey = `${originalRotation}->${newRotation}`;
    const kickType = player.shape === "I" ? "I" : "JLSTZ";
    const kickTests = KICKS[kickType][kickKey];
    for (let i = 0; i < kickTests.length; i++) {
      const [xOff, yOff] = kickTests[i];
      player.pos.x += xOff;
      player.pos.y += yOff;
      if (!collide2(arena, player)) {
        player.rotation = newRotation;
        return { success: true, kickIndex: i };
      }
      player.pos.x -= xOff;
      player.pos.y -= yOff;
    }
    player.matrix = originalMatrix;
    player.rotation = originalRotation;
    return { success: false, kickIndex: -1 };
  }

  // js/board.js
  function createMatrix(width, height) {
    const matrix = [];
    for (let i = 0; i < height; i++) {
      matrix.push(new Array(width).fill(0));
    }
    return matrix;
  }
  function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
          return true;
        }
      }
    }
    return false;
  }
  function merge(arena, player) {
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          arena[y + player.pos.y][x + player.pos.x] = player.shape;
        }
      });
    });
  }
  function findFullRows(arena) {
    const rows = [];
    for (let y = 0; y < arena.length; y++) {
      if (arena[y].every((cell) => cell !== 0)) {
        rows.push(y);
      }
    }
    return rows;
  }
  function removeRows(arena, rows) {
    if (rows.length === 0) return 0;
    const sorted = [...rows].sort((a, b) => b - a);
    for (const y of sorted) {
      arena.splice(y, 1);
    }
    const width = arena.length > 0 ? arena[0].length : 10;
    for (let i = 0; i < sorted.length; i++) {
      arena.unshift(new Array(width).fill(0));
    }
    return sorted.length;
  }
  function clearLines(arena) {
    const clearedRows = findFullRows(arena);
    const linesCleared = removeRows(arena, clearedRows);
    return { linesCleared, clearedRows };
  }
  function isMatrixEmpty(arena) {
    return arena.every((row) => row.every((cell) => cell === 0));
  }
  function getGhostY(arena, player) {
    const ghost = { matrix: player.matrix, pos: { ...player.pos } };
    while (!collide(arena, ghost)) {
      ghost.pos.y++;
    }
    ghost.pos.y--;
    return ghost.pos.y;
  }
  function isGrounded(arena, player) {
    const test = { matrix: player.matrix, pos: { x: player.pos.x, y: player.pos.y + 1 } };
    return collide(arena, test);
  }

  // js/scoring.js
  var SCORE_TABLE = {
    "single": 100,
    "double": 300,
    "triple": 500,
    "tetris": 800,
    "tspin-mini": 100,
    "tspin-mini-single": 200,
    "tspin-mini-double": 400,
    "tspin": 400,
    "tspin-single": 800,
    "tspin-double": 1200,
    "tspin-triple": 1600,
    "perfect-clear": 3500
  };
  var B2B_MULTIPLIER = 1.5;
  var COMBO_BONUS = 50;
  var ACTION_NAMES = {
    "single": "SINGLE",
    "double": "DOUBLE",
    "triple": "TRIPLE",
    "tetris": "TETRIS",
    "tspin-mini": "T-SPIN MINI",
    "tspin-mini-single": "T-SPIN MINI SINGLE",
    "tspin-mini-double": "T-SPIN MINI DOUBLE",
    "tspin": "T-SPIN",
    "tspin-single": "T-SPIN SINGLE",
    "tspin-double": "T-SPIN DOUBLE",
    "tspin-triple": "T-SPIN TRIPLE",
    "perfect-clear": "PERFECT CLEAR"
  };
  var DIFFICULT_CLEARS = /* @__PURE__ */ new Set([
    "tetris",
    "tspin-single",
    "tspin-double",
    "tspin-triple",
    "tspin-mini-single",
    "tspin-mini-double"
  ]);
  function createScoringState() {
    return {
      combo: -1,
      // -1 = no active combo; 0 = first consecutive clear
      b2b: -1,
      // -1 = no B2B chain; 0+ = consecutive difficult clears
      lastClearWasDifficult: false
    };
  }
  function detectTSpin(arena, player, wasRotation, kickIndex) {
    if (player.shape !== "T" || !wasRotation) {
      return "none";
    }
    const px = player.pos.x;
    const py = player.pos.y;
    const corners = [
      [px, py],
      // top-left
      [px + 2, py],
      // top-right
      [px, py + 2],
      // bottom-left
      [px + 2, py + 2]
      // bottom-right
    ];
    let filledCorners = 0;
    const cornerFilled = corners.map(([cx, cy]) => {
      if (cy < 0 || cy >= arena.length || cx < 0 || cx >= arena[0].length) {
        filledCorners++;
        return true;
      }
      if (arena[cy][cx] !== 0) {
        filledCorners++;
        return true;
      }
      return false;
    });
    if (filledCorners < 3) {
      return "none";
    }
    const frontCorners = {
      0: [0, 1],
      1: [1, 3],
      2: [2, 3],
      3: [0, 2]
    };
    const [fc1, fc2] = frontCorners[player.rotation];
    const frontBothFilled = cornerFilled[fc1] && cornerFilled[fc2];
    if (frontBothFilled) {
      return "full";
    }
    if (kickIndex >= 4) {
      return "full";
    }
    return "mini";
  }
  function classifyClear(linesCleared, tSpinType) {
    if (linesCleared === 0 && tSpinType === "none") return null;
    if (tSpinType === "full") {
      if (linesCleared === 0) return "tspin";
      if (linesCleared === 1) return "tspin-single";
      if (linesCleared === 2) return "tspin-double";
      if (linesCleared === 3) return "tspin-triple";
    }
    if (tSpinType === "mini") {
      if (linesCleared === 0) return "tspin-mini";
      if (linesCleared === 1) return "tspin-mini-single";
      if (linesCleared === 2) return "tspin-mini-double";
    }
    if (linesCleared === 1) return "single";
    if (linesCleared === 2) return "double";
    if (linesCleared === 3) return "triple";
    if (linesCleared === 4) return "tetris";
    return null;
  }
  function calculateScore(linesCleared, tSpinType, scoringState, level, arena) {
    const result = {
      points: 0,
      action: null,
      actionName: "",
      combo: 0,
      b2b: false,
      b2bCount: 0,
      perfectClear: false,
      isClearAction: linesCleared > 0,
      allActions: []
      // All displayable actions
    };
    const actionType = classifyClear(linesCleared, tSpinType);
    if (!actionType) {
      if (linesCleared === 0 && tSpinType === "none") {
        scoringState.combo = -1;
      }
      return result;
    }
    result.action = actionType;
    result.actionName = ACTION_NAMES[actionType] || "";
    result.allActions.push(result.actionName);
    let basePoints = SCORE_TABLE[actionType] || 0;
    if (linesCleared > 0) {
      scoringState.combo++;
      result.combo = scoringState.combo;
      if (scoringState.combo > 0) {
        const comboBonus = COMBO_BONUS * scoringState.combo;
        basePoints += comboBonus;
        result.allActions.push(`COMBO x${scoringState.combo}`);
      }
    }
    const isDifficult = DIFFICULT_CLEARS.has(actionType);
    if (linesCleared > 0) {
      if (isDifficult) {
        if (scoringState.lastClearWasDifficult) {
          scoringState.b2b++;
          result.b2b = true;
          result.b2bCount = scoringState.b2b;
          basePoints = Math.floor(basePoints * B2B_MULTIPLIER);
          result.allActions.push("BACK-TO-BACK");
        } else {
          scoringState.b2b = 0;
        }
        scoringState.lastClearWasDifficult = true;
      } else {
        scoringState.lastClearWasDifficult = false;
        scoringState.b2b = -1;
      }
    }
    if (linesCleared > 0 && arena && isMatrixEmpty(arena)) {
      result.perfectClear = true;
      basePoints += SCORE_TABLE["perfect-clear"];
      result.allActions.push("PERFECT CLEAR");
    }
    result.points = basePoints * level;
    return result;
  }
  function getActionColor(actionType) {
    if (!actionType) return "#ffffff";
    if (actionType.startsWith("tspin")) return "#aa00ff";
    if (actionType === "tetris") return "#00ffff";
    if (actionType === "perfect-clear") return "#ffd700";
    if (actionType === "triple") return "#00ff00";
    if (actionType === "double") return "#ffa500";
    return "#ffffff";
  }
  function getSoundEvent(result) {
    if (result.perfectClear) return "perfectClear";
    if (result.action && result.action.startsWith("tspin") && result.isClearAction) return "tspinClear";
    if (result.action && result.action.startsWith("tspin")) return "tspin";
    if (result.action === "tetris") return "clear4";
    if (result.action === "triple") return "clear3";
    if (result.action === "double") return "clear2";
    if (result.action === "single") return "clear1";
    return null;
  }

  // js/particles.js
  function createParticleSystem(settings2) {
    const particles = [];
    const actionTexts = [];
    let shakeX = 0;
    let shakeY = 0;
    let shakeDecay = 0;
    let shakeIntensity = 0;
    const BOARD_OFFSET_Y2 = BUFFER_ROWS - VISIBLE_ROWS;
    function densityMul() {
      return particleDensityMultiplier(settings2);
    }
    function shakeMul() {
      return screenShakeMultiplier(settings2);
    }
    function spawnPlacement(piece) {
      const mul = densityMul();
      if (mul === 0) return;
      const color = SHAPES[piece.shape].color;
      piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value === 0) return;
          const worldX = (x + piece.pos.x) * BLOCK_SIZE + BLOCK_SIZE / 2;
          const worldY = (y + piece.pos.y - BOARD_OFFSET_Y2) * BLOCK_SIZE + BLOCK_SIZE / 2;
          if (worldY < -BLOCK_SIZE || worldY > VISIBLE_ROWS * BLOCK_SIZE + BLOCK_SIZE) return;
          const count = Math.floor((4 + Math.random() * 3) * mul);
          for (let i = 0; i < count; i++) {
            const lifetime = 200 + Math.random() * 200;
            particles.push({
              x: worldX,
              y: worldY,
              vx: (Math.random() - 0.5) * 0.4,
              vy: -0.1 - Math.random() * 0.2,
              life: lifetime,
              maxLife: lifetime,
              size: 2 + Math.random() * 4,
              color,
              type: "square"
            });
          }
        });
      });
    }
    function spawnLineClear(clearedRows, clearType, arenaSnapshot) {
      const mul = densityMul();
      if (mul === 0) return;
      const isTetris = clearType === "tetris";
      const isTSpin = clearType && clearType.startsWith("tspin");
      const intensity = isTetris ? 2.5 : isTSpin ? 2 : 1;
      for (const rowY of clearedRows) {
        const visualY = (rowY - BOARD_OFFSET_Y2) * BLOCK_SIZE + BLOCK_SIZE / 2;
        for (let col = 0; col < 10; col++) {
          const cellShape = arenaSnapshot && arenaSnapshot[rowY] ? arenaSnapshot[rowY][col] : null;
          const color = cellShape && SHAPES[cellShape] ? SHAPES[cellShape].color : "#ffffff";
          const worldX = col * BLOCK_SIZE + BLOCK_SIZE / 2;
          const count = Math.floor((3 + Math.random() * 4) * mul * intensity);
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.3 + Math.random() * 0.6 * intensity;
            const lifetime = 300 + Math.random() * 400;
            particles.push({
              x: worldX,
              y: visualY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.2,
              life: lifetime,
              maxLife: lifetime,
              size: 2 + Math.random() * 5,
              color,
              type: "square"
            });
          }
        }
      }
      if (isTetris) {
        const midY = clearedRows.reduce((s, r) => s + r, 0) / clearedRows.length;
        const flashY = (midY - BOARD_OFFSET_Y2) * BLOCK_SIZE + BLOCK_SIZE / 2;
        particles.push({
          x: 10 * BLOCK_SIZE / 2,
          y: flashY,
          vx: 0,
          vy: 0,
          life: 200,
          maxLife: 200,
          size: 10 * BLOCK_SIZE,
          color: "#00ffff",
          type: "flash"
        });
      }
      const shakeAmount = isTetris ? 8 : isTSpin ? 6 : clearedRows.length >= 2 ? 3 : 0;
      if (shakeAmount > 0) {
        triggerShake(shakeAmount);
      }
    }
    function spawnTSpin(playerPos) {
      const mul = densityMul();
      if (mul === 0) return;
      const cx = (playerPos.x + 1.5) * BLOCK_SIZE;
      const cy = (playerPos.y - BOARD_OFFSET_Y2 + 1.5) * BLOCK_SIZE;
      const count = Math.floor(30 * mul);
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 4 + Math.random() * 0.3;
        const speed = 0.3 + Math.random() * 0.5;
        const lifetime = 400 + Math.random() * 300;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: lifetime,
          maxLife: lifetime,
          size: 3 + Math.random() * 4,
          color: "#aa00ff",
          type: "circle"
        });
      }
      triggerShake(6);
    }
    function spawnB2B(clearedRows) {
      const mul = densityMul();
      if (mul === 0) return;
      for (const rowY of clearedRows) {
        const visualY = (rowY - BOARD_OFFSET_Y2) * BLOCK_SIZE + BLOCK_SIZE / 2;
        const count = Math.floor(15 * mul);
        for (let i = 0; i < count; i++) {
          const lifetime = 250 + Math.random() * 250;
          particles.push({
            x: Math.random() * 10 * BLOCK_SIZE,
            y: visualY + (Math.random() - 0.5) * BLOCK_SIZE * 2,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.15 - Math.random() * 0.2,
            life: lifetime,
            maxLife: lifetime,
            size: 2 + Math.random() * 3,
            color: "#ffd700",
            type: "circle"
          });
        }
      }
    }
    function spawnPerfectClear() {
      const mul = densityMul();
      if (mul === 0) return;
      particles.push({
        x: 10 * BLOCK_SIZE / 2,
        y: VISIBLE_ROWS * BLOCK_SIZE / 2,
        vx: 0,
        vy: 0,
        life: 400,
        maxLife: 400,
        size: Math.max(10 * BLOCK_SIZE, VISIBLE_ROWS * BLOCK_SIZE) * 1.5,
        color: "#ffffff",
        type: "flash"
      });
      const count = Math.floor(80 * mul);
      for (let i = 0; i < count; i++) {
        const lifetime = 600 + Math.random() * 800;
        particles.push({
          x: Math.random() * 10 * BLOCK_SIZE,
          y: -Math.random() * 100,
          vx: (Math.random() - 0.5) * 0.2,
          vy: 0.2 + Math.random() * 0.3,
          life: lifetime,
          maxLife: lifetime,
          size: 2 + Math.random() * 4,
          color: ["#ffd700", "#00ffff", "#ff69b4", "#7fff00"][Math.floor(Math.random() * 4)],
          type: "circle"
        });
      }
      triggerShake(10);
    }
    function triggerShake(intensity) {
      const mul = shakeMul();
      if (mul === 0) return;
      shakeIntensity = intensity * mul;
      shakeDecay = 200;
    }
    function addActionText(text, y, color) {
      if (!settings2.showActionText) return;
      const visualY = y !== void 0 ? (y - BOARD_OFFSET_Y2) * BLOCK_SIZE : VISIBLE_ROWS * BLOCK_SIZE / 2;
      actionTexts.push({
        text,
        x: 10 * BLOCK_SIZE / 2,
        y: visualY,
        life: 1200,
        maxLife: 1200,
        color: color || "#ffffff",
        scale: 1.5
      });
    }
    function addActionsFromResult(result, clearedRows) {
      if (!result || !result.allActions || result.allActions.length === 0) return;
      const baseY = clearedRows && clearedRows.length > 0 ? clearedRows[Math.floor(clearedRows.length / 2)] : void 0;
      let yOffset = 0;
      for (const actionName of result.allActions) {
        const color = actionName.includes("PERFECT") ? "#ffd700" : actionName.includes("BACK-TO-BACK") ? "#ffd700" : actionName.includes("COMBO") ? "#00ff88" : getActionColor(result.action);
        const y = baseY !== void 0 ? baseY - yOffset * 1.5 : void 0;
        addActionText(actionName, y, color);
        yOffset++;
      }
    }
    function update(deltaTime) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= deltaTime;
        if (p.type !== "flash") {
          p.vy += 12e-4 * deltaTime;
          p.x += p.vx * deltaTime;
          p.y += p.vy * deltaTime;
        }
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }
      for (let i = actionTexts.length - 1; i >= 0; i--) {
        const t = actionTexts[i];
        t.life -= deltaTime;
        t.y -= 0.03 * deltaTime;
        if (t.life <= 0) {
          actionTexts.splice(i, 1);
        }
      }
      if (shakeDecay > 0) {
        shakeDecay -= deltaTime;
        const progress = Math.max(0, shakeDecay / 200);
        const intensity = shakeIntensity * progress;
        shakeX = (Math.random() - 0.5) * 2 * intensity;
        shakeY = (Math.random() - 0.5) * 2 * intensity;
        if (shakeDecay <= 0) {
          shakeX = 0;
          shakeY = 0;
        }
      }
    }
    function drawParticles(ctx) {
      for (const p of particles) {
        const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.save();
        if (p.type === "flash") {
          ctx.globalAlpha = alpha * 0.3;
          ctx.fillStyle = p.color;
          ctx.fillRect(
            p.x - p.size / 2,
            p.y - p.size / 2,
            p.size,
            p.size
          );
        } else if (p.type === "circle") {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fillRect(
            p.x - p.size / 2,
            p.y - p.size / 2,
            p.size,
            p.size
          );
        }
        ctx.restore();
      }
    }
    function drawActionTexts(ctx) {
      for (const t of actionTexts) {
        const alpha = Math.max(0, Math.min(1, t.life / t.maxLife));
        const scale = 1 + (1 - alpha) * 0.3;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.floor(20 * scale)}px 'Segoe UI', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
        ctx.shadowBlur = 4;
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }
    }
    return {
      spawnPlacement,
      spawnLineClear,
      spawnTSpin,
      spawnB2B,
      spawnPerfectClear,
      addActionText,
      addActionsFromResult,
      triggerShake,
      update,
      drawParticles,
      drawActionTexts,
      /** Get current screen shake offset */
      getShake() {
        return { x: shakeX, y: shakeY };
      },
      /** Clear all particles and effects */
      clear() {
        particles.length = 0;
        actionTexts.length = 0;
        shakeX = 0;
        shakeY = 0;
        shakeDecay = 0;
      }
    };
  }

  // js/renderer.js
  var BOARD_OFFSET_Y = BUFFER_ROWS - VISIBLE_ROWS;
  function drawBlock(ctx, x, y, color, isGhost = false, ghostOpacity = 0.2) {
    if (isGhost) {
      ctx.fillStyle = `rgba(255, 255, 255, ${ghostOpacity * 0.5})`;
      ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = ghostOpacity;
      ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, 4);
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, 4, BLOCK_SIZE);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(x * BLOCK_SIZE, (y + 1) * BLOCK_SIZE - 4, BLOCK_SIZE, 4);
    ctx.fillRect((x + 1) * BLOCK_SIZE - 4, y * BLOCK_SIZE, 4, BLOCK_SIZE);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
  }
  function drawMatrix(ctx, matrix, offset, color, isGhost = false, ghostOpacity = 0.2, isBoard = true) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          const drawY = isBoard ? y + offset.y - BOARD_OFFSET_Y : y + offset.y;
          if (drawY >= 0 || !isBoard) {
            const c = color || (SHAPES[value] ? SHAPES[value].color : "#888");
            drawBlock(ctx, x + offset.x, drawY, c, isGhost, ghostOpacity);
          }
        }
      });
    });
  }
  function drawSideCanvas(ctx, shapeStr, slotTop, slotHeight) {
    if (!shapeStr) return;
    const matrix = SHAPES[shapeStr].matrix;
    const color = SHAPES[shapeStr].color;
    let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      });
    });
    const slotWidth = ctx.canvas.width / BLOCK_SIZE;
    const xOffset = (slotWidth - (maxX - minX + 1)) / 2 - minX;
    const yOffset = slotTop + (slotHeight - (maxY - minY + 1)) / 2 - minY;
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          drawBlock(ctx, x + xOffset, y + yOffset, color);
        }
      });
    });
  }
  function createRenderer(canvases2, settings2) {
    const boardCtx = canvases2.board.getContext("2d");
    const holdCtx = canvases2.hold.getContext("2d");
    const nextCtx = canvases2.next.getContext("2d");
    function draw(state) {
      const { arena, player, nextQueue, held, particles, shake } = state;
      const ghostOpacity = (settings2.ghostOpacity || 40) / 100;
      const previewCount = settings2.nextPreviewCount || 5;
      boardCtx.clearRect(0, 0, canvases2.board.width, canvases2.board.height);
      holdCtx.clearRect(0, 0, canvases2.hold.width, canvases2.hold.height);
      nextCtx.clearRect(0, 0, canvases2.next.width, canvases2.next.height);
      boardCtx.save();
      if (shake) {
        boardCtx.translate(shake.x, shake.y);
      }
      drawMatrix(boardCtx, arena, { x: 0, y: 0 }, null, false, ghostOpacity, true);
      if (player && player.matrix) {
        const ghost = { matrix: player.matrix, pos: { ...player.pos } };
        if (state.ghostY !== void 0) {
          drawMatrix(
            boardCtx,
            player.matrix,
            { x: player.pos.x, y: state.ghostY },
            SHAPES[player.shape].color,
            true,
            ghostOpacity,
            true
          );
        }
        drawMatrix(
          boardCtx,
          player.matrix,
          player.pos,
          SHAPES[player.shape].color,
          false,
          ghostOpacity,
          true
        );
      }
      if (particles) {
        particles.drawParticles(boardCtx);
        particles.drawActionTexts(boardCtx);
      }
      boardCtx.restore();
      if (held) {
        drawSideCanvas(holdCtx, held, 0, canvases2.hold.height / BLOCK_SIZE);
      }
      const visibleNext = nextQueue ? nextQueue.slice(0, previewCount) : [];
      visibleNext.forEach((shapeStr, index) => {
        drawSideCanvas(nextCtx, shapeStr, index * 3 + 0.5, 3);
      });
    }
    function resizeNextCanvas(previewCount) {
      const height = previewCount * 3 * BLOCK_SIZE + BLOCK_SIZE;
      canvases2.next.height = height;
    }
    return {
      draw,
      resizeNextCanvas,
      boardCtx
    };
  }

  // js/input.js
  var EPSILON = 1;
  var GAME_KEYS = /* @__PURE__ */ new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowDown",
    "ArrowUp",
    "Space",
    "KeyZ",
    "KeyX",
    "KeyC",
    "ShiftLeft",
    "ShiftRight",
    "Escape",
    "KeyR",
    "F1"
  ]);
  function createInputHandler(settings2, callbacks) {
    const state = {
      leftHeld: false,
      rightHeld: false,
      downHeld: false,
      activeHorizontal: null,
      // -1 (left) | 1 (right) | null
      dasCharge: 0,
      // ms the active direction has charged
      chargeFrom: 0,
      // timestamp charging was last counted up to
      dcdUntil: 0,
      // DAS charging is paused until this timestamp
      softDropCharge: 0,
      // ms accumulated toward the next soft drop cell
      softDropFrom: 0,
      enabled: true
    };
    function heldFor(dir) {
      return dir < 0 ? state.leftHeld : state.rightHeld;
    }
    function setActiveHorizontal(dir, now) {
      if (state.activeHorizontal === null || settings2.cancelDasOnDirectionChange) {
        state.dasCharge = 0;
      }
      state.activeHorizontal = dir;
      state.chargeFrom = now;
      callbacks.onMove?.(dir, 1);
    }
    function handleHorizontalKey(dir, isDown, now) {
      if (dir < 0) state.leftHeld = isDown;
      else state.rightHeld = isDown;
      if (isDown) {
        if (state.activeHorizontal !== dir) setActiveHorizontal(dir, now);
        return;
      }
      if (state.activeHorizontal === dir) {
        if (heldFor(-dir)) {
          setActiveHorizontal(-dir, now);
        } else {
          state.activeHorizontal = null;
          state.dasCharge = 0;
        }
      }
    }
    function clearHeld() {
      state.leftHeld = false;
      state.rightHeld = false;
      state.downHeld = false;
      state.activeHorizontal = null;
      state.dasCharge = 0;
      state.softDropCharge = 0;
    }
    function onKeyDown(event) {
      if (!state.enabled) return;
      if (GAME_KEYS.has(event.code)) {
        event.preventDefault();
      }
      if (event.repeat) return;
      const now = performance.now();
      switch (event.code) {
        case "ArrowLeft":
          handleHorizontalKey(-1, true, now);
          break;
        case "ArrowRight":
          handleHorizontalKey(1, true, now);
          break;
        case "ArrowDown":
          state.downHeld = true;
          state.softDropCharge = 0;
          state.softDropFrom = now;
          break;
        case "ArrowUp":
        case "KeyX":
          callbacks.onRotateCW?.();
          break;
        case "KeyZ":
          callbacks.onRotateCCW?.();
          break;
        case "KeyC":
        case "ShiftLeft":
        case "ShiftRight":
          callbacks.onHold?.();
          break;
        case "Space":
          callbacks.onHardDrop?.();
          break;
        case "Escape":
          callbacks.onPause?.();
          break;
        case "KeyR":
          callbacks.onRetry?.();
          break;
      }
    }
    function onKeyUp(event) {
      if (GAME_KEYS.has(event.code)) {
        event.preventDefault();
      }
      const now = performance.now();
      switch (event.code) {
        case "ArrowLeft":
          handleHorizontalKey(-1, false, now);
          break;
        case "ArrowRight":
          handleHorizontalKey(1, false, now);
          break;
        case "ArrowDown":
          state.downHeld = false;
          break;
      }
    }
    function updateHorizontal(now) {
      const dir = state.activeHorizontal;
      if (dir === null) return;
      const from = Math.max(state.chargeFrom, state.dcdUntil);
      state.chargeFrom = now;
      if (now <= from) return;
      const das = framesToMs(settings2.das) - EPSILON;
      const arr = framesToMs(settings2.arr);
      const prev = state.dasCharge;
      state.dasCharge += now - from;
      if (state.dasCharge < das) return;
      if (arr === 0) {
        callbacks.onMove?.(dir, Infinity);
        return;
      }
      const shiftsBefore = prev >= das ? Math.floor((prev - das) / arr) + 1 : 0;
      const shiftsAfter = Math.floor((state.dasCharge - das) / arr) + 1;
      if (shiftsAfter > shiftsBefore) {
        callbacks.onMove?.(dir, shiftsAfter - shiftsBefore);
      }
    }
    function updateSoftDrop(now) {
      if (!state.downHeld) return;
      if (settings2.sdf >= SDF_INFINITE) {
        callbacks.onSoftDrop?.(Infinity);
        return;
      }
      const gravity = callbacks.getGravityInterval?.() ?? 1e3;
      const interval = gravity / settings2.sdf;
      state.softDropCharge += now - state.softDropFrom;
      state.softDropFrom = now;
      const cells = Math.floor((state.softDropCharge + EPSILON) / interval);
      if (cells > 0) {
        state.softDropCharge -= cells * interval;
        callbacks.onSoftDrop?.(cells);
      }
    }
    function onBlur() {
      clearHeld();
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return {
      /**
       * Call each frame to process auto-repeat inputs.
       */
      update(now) {
        if (!state.enabled) return;
        if (settings2.preferSoftDrop) {
          updateSoftDrop(now);
          updateHorizontal(now);
        } else {
          updateHorizontal(now);
          updateSoftDrop(now);
        }
      },
      /**
       * Pause DAS charging for DCD frames. Called after a rotation or a new piece.
       */
      cutDas() {
        if (settings2.dcd > 0) {
          state.dcdUntil = performance.now() + framesToMs(settings2.dcd);
        }
      },
      /** Enable or disable input processing */
      setEnabled(enabled) {
        state.enabled = enabled;
        if (!enabled) clearHeld();
      },
      /** Reset all held state */
      resetState() {
        clearHeld();
      },
      /** Clean up event listeners */
      destroy() {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onBlur);
      }
    };
  }

  // js/game.js
  function createGame(config) {
    const { modeId, canvases: canvases2, settings: settings2, soundEngine: soundEngine2, onGameOver, onPause } = config;
    const arena = createMatrix(COLS, BUFFER_ROWS);
    const nextQueue = [];
    fillQueue(nextQueue);
    const modeState = createModeState(modeId);
    const scoringState = createScoringState();
    const particles = createParticleSystem(settings2);
    const renderer = createRenderer(canvases2, settings2);
    renderer.resizeNextCanvas(settings2.nextPreviewCount || 5);
    const player = {
      pos: { x: 0, y: 0 },
      matrix: null,
      shape: null,
      rotation: 0,
      held: null,
      canHold: true
    };
    let dropCounter = 0;
    let dropInterval = modeState.getDropInterval();
    let lastTime = 0;
    let lockTimer = 0;
    let lockMoves = 0;
    const MAX_LOCK_MOVES = 15;
    let running = false;
    let paused = false;
    let animFrameId = null;
    let lastWasRotation = false;
    let lastKickIndex = -1;
    let lastCountdownSecond = -1;
    const input = createInputHandler(settings2, {
      onMove(dir, cells) {
        return playerMove(dir, cells);
      },
      onSoftDrop(cells) {
        return softDrop(cells);
      },
      getGravityInterval() {
        return dropInterval;
      },
      onHardDrop() {
        hardDrop();
      },
      onRotateCW() {
        playerRotate(1);
      },
      onRotateCCW() {
        playerRotate(-1);
      },
      onHold() {
        holdPiece();
      },
      onPause() {
        if (running && !modeState.isFinished()) pauseGame();
      },
      onRetry() {
      }
    });
    function spawnPiece() {
      player.shape = getNextPiece(nextQueue);
      player.matrix = SHAPES[player.shape].matrix;
      player.rotation = 0;
      const spawn = getSpawnPos(player.matrix);
      player.pos.x = spawn.x;
      player.pos.y = spawn.y;
      player.canHold = true;
      lastWasRotation = false;
      lastKickIndex = -1;
      lockTimer = 0;
      lockMoves = 0;
      dropCounter = 0;
      input.cutDas();
      if (collide(arena, player)) {
        modeState.setGameOver();
        playSound("gameOver");
        endGame();
      }
    }
    function playerMove(dir, cells = 1) {
      let moved = 0;
      while (moved < cells && moved < COLS) {
        player.pos.x += dir;
        if (collide(arena, player)) {
          player.pos.x -= dir;
          break;
        }
        moved++;
      }
      if (moved > 0) {
        lastWasRotation = false;
        resetLockTimer();
        playSound("move");
      }
      return moved;
    }
    function playerRotate(dir) {
      const result = tryRotate(player, arena, collide, dir);
      if (result.success) {
        lastWasRotation = true;
        lastKickIndex = result.kickIndex;
        resetLockTimer();
        input.cutDas();
        playSound("rotate");
      }
    }
    function playerDrop() {
      player.pos.y++;
      if (collide(arena, player)) {
        player.pos.y--;
        return true;
      }
      dropCounter = 0;
      lastWasRotation = false;
      return false;
    }
    function softDrop(cells = 1) {
      let dropped = 0;
      while (dropped < cells && !playerDrop()) {
        dropped++;
      }
      if (dropped > 0) {
        modeState.addScore(dropped);
        playSound("softdrop");
      }
      return dropped;
    }
    function hardDrop() {
      let rows = 0;
      while (!playerDrop()) {
        rows++;
      }
      modeState.addScore(rows * 2);
      playSound("harddrop");
      lockPiece();
    }
    function holdPiece() {
      if (!player.canHold) return;
      if (player.held === null) {
        player.held = player.shape;
        spawnPiece();
      } else {
        const temp = player.shape;
        player.shape = player.held;
        player.held = temp;
        player.matrix = SHAPES[player.shape].matrix;
        player.rotation = 0;
        const spawn = getSpawnPos(player.matrix);
        player.pos.x = spawn.x;
        player.pos.y = spawn.y;
        input.cutDas();
      }
      player.canHold = false;
      dropCounter = 0;
      lockTimer = 0;
      lockMoves = 0;
      lastWasRotation = false;
      lastKickIndex = -1;
      playSound("hold");
    }
    function resetLockTimer() {
      if (isGrounded(arena, player)) {
        lockMoves++;
        if (lockMoves < MAX_LOCK_MOVES) {
          lockTimer = 0;
        }
      }
    }
    function lockPiece() {
      const tSpinType = detectTSpin(arena, player, lastWasRotation, lastKickIndex);
      const arenaSnapshot = arena.map((row) => [...row]);
      merge(arena, player);
      modeState.addPiece();
      particles.spawnPlacement({
        shape: player.shape,
        matrix: player.matrix.map((row) => [...row]),
        pos: { ...player.pos }
      });
      const { linesCleared, clearedRows } = clearLines(arena);
      const scoreResult = calculateScore(
        linesCleared,
        tSpinType,
        scoringState,
        modeState.stats.level,
        arena
      );
      if (scoreResult.points > 0) {
        modeState.addScore(scoreResult.points);
      }
      if (linesCleared > 0) {
        modeState.addLines(linesCleared);
        dropInterval = modeState.getDropInterval();
      }
      if (scoreResult.action && scoreResult.action.startsWith("tspin")) {
        modeState.addTSpin();
      }
      if (scoreResult.action === "tetris") {
        modeState.addTetris();
      }
      if (scoreResult.combo > 0) {
        modeState.updateCombo(scoreResult.combo);
      }
      if (scoreResult.perfectClear) {
        modeState.addPerfectClear();
      }
      if (linesCleared > 0) {
        particles.spawnLineClear(clearedRows, scoreResult.action, arenaSnapshot);
      }
      if (tSpinType !== "none" && linesCleared > 0) {
        particles.spawnTSpin(player.pos);
      }
      if (scoreResult.b2b) {
        particles.spawnB2B(clearedRows);
      }
      if (scoreResult.perfectClear) {
        particles.spawnPerfectClear();
      }
      particles.addActionsFromResult(scoreResult, clearedRows);
      const soundEvent = getSoundEvent(scoreResult);
      if (soundEvent) {
        playSound(soundEvent);
      } else if (linesCleared === 0) {
        playSound("lock");
      }
      if (scoreResult.combo > 0) {
        playSound("combo", scoreResult.combo);
      }
      if (scoreResult.b2b) {
        playSound("b2b");
      }
      if (modeState.isCompleted()) {
        endGame();
        return;
      }
      spawnPiece();
    }
    function update(time = 0) {
      if (!running) return;
      const deltaTime = time - lastTime;
      lastTime = time;
      if (paused || modeState.isFinished()) {
        animFrameId = requestAnimationFrame(update);
        return;
      }
      input.update(time);
      modeState.updateTimer();
      if (modeState.isCountdown()) {
        const sec = modeState.getRemainingSeconds();
        if (sec !== null && sec <= 10 && sec !== lastCountdownSecond && sec > 0) {
          lastCountdownSecond = sec;
          playSound("countdownTick");
        }
        if (sec === 0 && lastCountdownSecond !== 0) {
          lastCountdownSecond = 0;
          if (modeState.isCompleted()) {
            endGame();
            animFrameId = requestAnimationFrame(update);
            return;
          }
        }
      }
      dropCounter += deltaTime;
      if (dropCounter > dropInterval) {
        playerDrop();
        dropCounter = 0;
      }
      if (isGrounded(arena, player)) {
        lockTimer += deltaTime;
        const lockDelay = settings2.lockDelay || 500;
        if (lockTimer >= lockDelay) {
          lockPiece();
        }
      } else {
        lockTimer = 0;
      }
      particles.update(deltaTime);
      const ghostY = getGhostY(arena, player);
      renderer.draw({
        arena,
        player,
        nextQueue,
        held: player.held,
        particles,
        shake: particles.getShake(),
        ghostY
      });
      updateHUD();
      animFrameId = requestAnimationFrame(update);
    }
    function updateHUD() {
      const scoreEl = document.getElementById("score-display");
      const linesEl = document.getElementById("lines-display");
      const levelEl = document.getElementById("level-display");
      const timerEl = document.getElementById("timer-display");
      if (scoreEl) {
        if (modeId === "sprint") {
          scoreEl.textContent = Math.max(0, 40 - modeState.stats.linesCleared);
          const label = scoreEl.previousElementSibling;
          if (label) label.textContent = "LINES LEFT";
        } else {
          scoreEl.textContent = modeState.stats.score.toLocaleString();
          const label = scoreEl.previousElementSibling;
          if (label) label.textContent = "SCORE";
        }
      }
      if (linesEl) linesEl.textContent = modeState.stats.linesCleared;
      if (levelEl) levelEl.textContent = modeState.stats.level;
      if (timerEl) {
        timerEl.textContent = modeState.getTimerDisplay();
        if (modeState.isCountdown()) {
          const sec = modeState.getRemainingSeconds();
          timerEl.classList.toggle("timer-urgent", sec !== null && sec <= 10);
        }
      }
    }
    function playSound(name, ...args) {
      if (soundEngine2) {
        soundEngine2.play(name, ...args);
      }
    }
    function startGame() {
      arena.forEach((row) => row.fill(0));
      nextQueue.length = 0;
      fillQueue(nextQueue);
      player.held = null;
      player.canHold = true;
      modeState.reset();
      scoringState.combo = -1;
      scoringState.b2b = -1;
      scoringState.lastClearWasDifficult = false;
      particles.clear();
      dropCounter = 0;
      lockTimer = 0;
      lockMoves = 0;
      lastTime = performance.now();
      lastCountdownSecond = -1;
      dropInterval = modeState.getDropInterval();
      renderer.resizeNextCanvas(settings2.nextPreviewCount || 5);
      spawnPiece();
      modeState.start();
      running = true;
      paused = false;
      input.setEnabled(true);
      input.resetState();
      playSound("countdownGo");
      animFrameId = requestAnimationFrame(update);
    }
    function pauseGame() {
      if (!running || modeState.isFinished()) return;
      paused = true;
      modeState.pause();
      input.setEnabled(false);
      if (onPause) onPause();
    }
    function resumeGame() {
      if (!running) return;
      paused = false;
      lastTime = performance.now();
      modeState.resume();
      input.setEnabled(true);
      input.resetState();
    }
    function endGame() {
      running = false;
      input.setEnabled(false);
      setTimeout(() => {
        if (onGameOver) {
          onGameOver(modeState.getResults());
        }
      }, modeState.isCompleted() ? 800 : 400);
    }
    function destroy() {
      running = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
      }
      input.destroy();
      particles.clear();
    }
    return {
      start: startGame,
      pause: pauseGame,
      resume: resumeGame,
      restart: startGame,
      destroy,
      isRunning() {
        return running;
      },
      isPaused() {
        return paused;
      }
    };
  }

  // js/main.js
  var settings = loadSettings();
  var settingsListenersBound = false;
  var currentGame = null;
  var soundEngine = null;
  var gameContainer = document.getElementById("game-container");
  var menuContainer = document.getElementById("menu-container");
  var settingsPanel = document.getElementById("settings-panel");
  var settingsToggle = document.getElementById("settings-toggle");
  var settingsClose = document.getElementById("settings-close");
  var musicPlayerContainer = document.getElementById("music-player-container");
  var canvases = {
    board: document.getElementById("board-canvas"),
    hold: document.getElementById("hold-canvas"),
    next: document.getElementById("next-canvas")
  };
  try {
    soundEngine = createSoundEngine(settings);
  } catch (e) {
    console.warn("Sound engine failed to initialize:", e);
  }
  var musicPlayer = null;
  if (musicPlayerContainer) {
    musicPlayer = createMusicPlayer(musicPlayerContainer, settings);
  }
  var menu = createMenuSystem(menuContainer);
  menu.onModeSelect((modeId) => {
    menu.hideAll();
    gameContainer.classList.remove("game-hidden");
    startNewGame(modeId);
    if (soundEngine) soundEngine.play("menuSelect");
  });
  menu.onResume(() => {
    if (currentGame) {
      currentGame.resume();
    }
  });
  menu.onRestart(() => {
    const modeId = currentGame?._modeId;
    if (modeId) {
      startNewGame(modeId);
    }
  });
  menu.onQuit(() => {
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    gameContainer.classList.add("game-hidden");
  });
  gameContainer.classList.add("game-hidden");
  menu.showScreen("main");
  function startNewGame(modeId) {
    if (currentGame) {
      currentGame.destroy();
    }
    currentGame = createGame({
      modeId,
      canvases,
      settings,
      soundEngine,
      onGameOver(results) {
        menu.showResults(results);
      },
      onPause() {
        menu.showScreen("pause");
      }
    });
    currentGame._modeId = modeId;
    currentGame.start();
  }
  function buildSettingsUI() {
    const tabContainer = settingsPanel.querySelector(".settings-tabs");
    const contentContainer = settingsPanel.querySelector(".settings-tab-content");
    if (!tabContainer || !contentContainer) return;
    const tabs = [
      { id: "handling", label: "HANDLING", settings: [
        { key: "arr", label: "ARR", type: "range", describe: describeArr },
        { key: "das", label: "DAS", type: "range", describe: describeFrames },
        { key: "dcd", label: "DCD", type: "range", describe: describeDcd },
        { key: "sdf", label: "SDF", type: "range", describe: describeSoftDrop },
        { key: "cancelDasOnDirectionChange", label: "CANCEL DAS ON TURN", type: "toggle" },
        { key: "preferSoftDrop", label: "PREFER SOFT DROP", type: "toggle" }
      ] },
      { id: "audio", label: "AUDIO", settings: [
        { key: "masterVolume", label: "MASTER", type: "range", describe: describeVolume },
        { key: "sfxVolume", label: "SFX", type: "range", describe: describeVolume },
        { key: "musicVolume", label: "MUSIC", type: "range", describe: describeVolume },
        { key: "sfxMuted", label: "MUTE SFX", type: "toggle" },
        { key: "musicMuted", label: "MUTE MUSIC", type: "toggle" },
        { key: "crossfadeDuration", label: "CROSSFADE", type: "range", describe: describeCrossfade }
      ] },
      { id: "visual", label: "VISUAL", settings: [
        { key: "screenShake", label: "SCREEN SHAKE", type: "enum", values: ["off", "low", "medium", "high"], describe: describeEnum },
        { key: "particleDensity", label: "PARTICLES", type: "enum", values: ["off", "low", "medium", "high"], describe: describeEnum },
        { key: "ghostOpacity", label: "GHOST OPACITY", type: "range", describe: describeOpacity },
        { key: "showActionText", label: "ACTION TEXT", type: "toggle" }
      ] },
      { id: "gameplay", label: "GAME", settings: [
        { key: "nextPreviewCount", label: "NEXT PIECES", type: "range", describe: describePreviewCount },
        { key: "lockDelay", label: "LOCK DELAY", type: "range", describe: describeLockDelay }
      ] }
    ];
    tabContainer.innerHTML = "";
    tabs.forEach((tab, i) => {
      const btn = document.createElement("button");
      btn.className = `settings-tab-btn ${i === 0 ? "active" : ""}`;
      btn.textContent = tab.label;
      btn.dataset.tab = tab.id;
      btn.type = "button";
      tabContainer.appendChild(btn);
    });
    contentContainer.innerHTML = "";
    tabs.forEach((tab, i) => {
      const section = document.createElement("div");
      section.className = `settings-tab-section ${i === 0 ? "active" : ""}`;
      section.dataset.tab = tab.id;
      for (const s of tab.settings) {
        const row = document.createElement("label");
        row.className = "setting-row";
        if (s.type === "range") {
          const c = getConstraint(s.key);
          row.innerHTML = `
                    <span class="setting-name">${s.label}</span>
                    <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${settings[s.key]}" data-key="${s.key}">
                    <span class="setting-readout" data-readout="${s.key}">${s.describe(settings[s.key])}</span>
                `;
        } else if (s.type === "toggle") {
          row.innerHTML = `
                    <span class="setting-name">${s.label}</span>
                    <button type="button" class="setting-toggle ${settings[s.key] ? "on" : ""}" data-toggle="${s.key}">
                        ${settings[s.key] ? "ON" : "OFF"}
                    </button>
                `;
        } else if (s.type === "enum") {
          const options = s.values.map(
            (v) => `<option value="${v}" ${settings[s.key] === v ? "selected" : ""}>${s.describe(v)}</option>`
          ).join("");
          row.innerHTML = `
                    <span class="setting-name">${s.label}</span>
                    <select data-enum="${s.key}">${options}</select>
                    <span class="setting-readout" data-readout="${s.key}">${s.describe(settings[s.key])}</span>
                `;
        }
        section.appendChild(row);
      }
      contentContainer.appendChild(section);
    });
    const resetBtn = document.createElement("button");
    resetBtn.className = "menu-btn settings-reset-btn";
    resetBtn.textContent = "RESET DEFAULTS";
    resetBtn.type = "button";
    resetBtn.addEventListener("click", () => {
      Object.assign(settings, DEFAULT_SETTINGS);
      saveSettings(settings);
      buildSettingsUI();
    });
    contentContainer.appendChild(resetBtn);
    if (settingsListenersBound) return;
    settingsListenersBound = true;
    tabContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".settings-tab-btn");
      if (!btn) return;
      tabContainer.querySelectorAll(".settings-tab-btn").forEach((b) => b.classList.remove("active"));
      contentContainer.querySelectorAll(".settings-tab-section").forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      const section = contentContainer.querySelector(`[data-tab="${btn.dataset.tab}"]`);
      if (section) section.classList.add("active");
      if (soundEngine) soundEngine.play("menuMove");
    });
    contentContainer.addEventListener("input", (e) => {
      const input = e.target;
      const key = input.dataset.key;
      if (!key) return;
      const tab = tabs.find((t) => t.settings.some((s) => s.key === key));
      const settingDef = tab?.settings.find((s) => s.key === key);
      if (!settingDef) return;
      const val = Number(input.value);
      settings[key] = val;
      saveSettings(settings);
      const readout = contentContainer.querySelector(`[data-readout="${key}"]`);
      if (readout && settingDef.describe) {
        readout.textContent = settingDef.describe(val);
      }
    });
    contentContainer.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest("[data-toggle]");
      if (toggleBtn) {
        const key = toggleBtn.dataset.toggle;
        settings[key] = !settings[key];
        saveSettings(settings);
        toggleBtn.classList.toggle("on", settings[key]);
        toggleBtn.textContent = settings[key] ? "ON" : "OFF";
        if (soundEngine) soundEngine.play("menuMove");
      }
    });
    contentContainer.addEventListener("change", (e) => {
      const select = e.target.closest("[data-enum]");
      if (select) {
        const key = select.dataset.enum;
        settings[key] = select.value;
        saveSettings(settings);
        const tab = tabs.find((t) => t.settings.some((s) => s.key === key));
        const settingDef = tab?.settings.find((s) => s.key === key);
        const readout = contentContainer.querySelector(`[data-readout="${key}"]`);
        if (readout && settingDef?.describe) {
          readout.textContent = settingDef.describe(select.value);
        }
        if (soundEngine) soundEngine.play("menuMove");
      }
    });
  }
  buildSettingsUI();
  function setSettingsOpen(open) {
    settingsPanel.classList.toggle("open", open);
    settingsPanel.setAttribute("aria-hidden", String(!open));
  }
  settingsToggle.addEventListener("click", () => {
    const isOpen = settingsPanel.classList.contains("open");
    setSettingsOpen(!isOpen);
    if (soundEngine) soundEngine.play("menuMove");
  });
  settingsClose.addEventListener("click", () => {
    setSettingsOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape" && settingsPanel.classList.contains("open")) {
      setSettingsOpen(false);
      e.stopPropagation();
    }
  });
  document.addEventListener("uloltris-open-settings", () => {
    setSettingsOpen(true);
  });
  var musicToggle = document.getElementById("music-toggle");
  if (musicToggle && musicPlayer) {
    musicToggle.addEventListener("click", () => {
      musicPlayer.toggle();
      if (soundEngine) soundEngine.play("menuMove");
    });
  }
})();
