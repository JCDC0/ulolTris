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
    soundtrack: "auto",
    // 'auto', 'calm', 'competitive', 'intense', 'chip', 'off'
    // Visual
    screenShake: "medium",
    // 'off', 'low', 'medium', 'high'
    boardBounce: "medium",
    // board springs on hard drops, clears and wall bumps
    placeImpact: "medium",
    // drop trail, landing flash and dust when a piece locks
    clearEffects: "medium",
    // particles and flashes for line clears, T-spins, B2B, perfect clears
    statsDisplay: "time",
    // 'off', 'time', 'speed', 'efficiency', 'versus'
    background: "on",
    // 'on', 'dim', 'off'
    casualScene: "cycle",
    // 'cycle' or one of CASUAL_SCENES
    classicScene: "cycle",
    // 'cycle' (by level) or one of CLASSIC_SCENES
    classicFont: "og",
    // Classic HUD font: 'og' (8-bit pixel font) or 'ulol' (the uloltris fonts)
    ghostOpacity: 40,
    // 0-100
    showActionText: true,
    blockSkin: "ulol",
    // one of SKINS in skins.js
    soundPack: "ulol",
    // 'ulol', 'arcade' (Jstris-style), 'bubbly' (PPT-style), 'nes' (8-bit)
    // Gameplay
    nextPreviewCount: 5,
    // 1-6
    lockDelay: 500,
    // ms
    gameStyle: "modern",
    // 'modern' (TETR.IO, Jstris) or 'battle' (Tetris 99, PPT)
    classicStartLevel: 0
    // Classic mode: level to begin on, 0-19
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
    nextPreviewCount: { min: 1, max: 6, step: 1 },
    lockDelay: { min: 100, max: 2e3, step: 50 },
    classicStartLevel: { min: 0, max: 19, step: 1 }
  };
  var ENUMS = {
    screenShake: ["off", "low", "medium", "high"],
    boardBounce: ["off", "low", "medium", "high"],
    placeImpact: ["off", "low", "medium", "high"],
    clearEffects: ["off", "low", "medium", "high"],
    statsDisplay: ["off", "time", "speed", "efficiency", "versus"],
    background: ["on", "dim", "off"],
    casualScene: ["cycle", "bamboo", "wheat", "village", "castle", "ocean", "neon"],
    classicScene: ["cycle", "blocks", "ulol", "domes"],
    classicFont: ["og", "ulol"],
    soundtrack: ["auto", "calm", "competitive", "intense", "chip", "off"],
    gameStyle: ["modern", "battle"],
    blockSkin: ["ulol", "classic", "glossy", "flat", "neon"],
    soundPack: ["ulol", "arcade", "bubbly", "nes"]
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
  function describeGameStyle(val) {
    return val === "battle" ? "Battle (T99 / PPT)" : "Modern (TETR.IO / Jstris)";
  }
  function describeSoundtrack(val) {
    if (val === "auto") return "Auto (by mode)";
    return val === "chip" ? "Chiptune (8-bit)" : describeEnum(val);
  }
  function describeClassicFont(val) {
    return val === "og" ? "OG (8-bit pixel font)" : "uloltris";
  }
  function describeStartLevel(level) {
    return `Level ${level}`;
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
  function effectLevel(settings2, key) {
    switch (settings2[key]) {
      case "off":
        return 0;
      case "low":
        return 0.45;
      case "high":
        return 1.8;
      default:
        return 1;
    }
  }
  var STATS_LABELS = {
    off: "Off",
    time: "Time",
    speed: "Speed (PPS, APM)",
    efficiency: "Efficiency (finesse)",
    versus: "Versus (VS score)"
  };
  function describeStatsDisplay(val) {
    return STATS_LABELS[val] || val;
  }

  // js/piece.js
  var COLS = 10;
  var VISIBLE_ROWS = 20;
  var BUFFER_ROWS = 40;
  var BLOCK_SIZE = 30;
  var SHAPES = {
    I: { matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: "#3fd9b8" },
    J: { matrix: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: "#5d55e0" },
    L: { matrix: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: "#ef8a3c" },
    O: { matrix: [[1, 1], [1, 1]], color: "#f2cb46" },
    S: { matrix: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: "#94d64a" },
    T: { matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: "#cf5ce0" },
    Z: { matrix: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: "#ec4a5c" }
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
  function getSpawnPos(matrix) {
    let lastFilledRow = 0;
    matrix.forEach((row, y) => {
      if (row.some((v) => v !== 0)) lastFilledRow = y;
    });
    return {
      x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2),
      y: BUFFER_ROWS - VISIBLE_ROWS - 1 - lastFilledRow
    };
  }
  var SPAWN_ROWS = 3;
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

  // js/classic.js
  var NES_FPS = 60.0988;
  var NES_FRAME_MS = 1e3 / NES_FPS;
  var SOFT_DROP_FRAMES = 2;
  var GRAVITY_FRAMES = [48, 43, 38, 33, 28, 23, 18, 13, 8, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3];
  function classicGravityFrames(level) {
    if (level < GRAVITY_FRAMES.length) return GRAVITY_FRAMES[Math.max(0, level)];
    return level < 29 ? 2 : 1;
  }
  function classicGravityMs(level) {
    return classicGravityFrames(level) * NES_FRAME_MS;
  }
  var CLASSIC_LINE_POINTS = [0, 40, 100, 300, 1200];
  var CLEAR_ACTIONS = [null, "single", "double", "triple", "tetris"];
  var CLEAR_NAMES = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS"];
  function calculateClassicScore(lines, level) {
    const n = Math.max(0, Math.min(4, lines));
    return {
      points: CLASSIC_LINE_POINTS[n] * (level + 1),
      action: CLEAR_ACTIONS[n],
      actionName: CLEAR_NAMES[n],
      combo: 0,
      b2b: false,
      b2bCount: 0,
      perfectClear: false,
      isClearAction: n > 0,
      allActions: n > 0 ? [CLEAR_NAMES[n]] : []
    };
  }
  function classicFirstLevelUp(startLevel) {
    return Math.min(startLevel * 10 + 10, Math.max(100, startLevel * 10 - 50));
  }
  function classicLevel(lines, startLevel) {
    const first = classicFirstLevelUp(startLevel);
    if (lines < first) return startLevel;
    return startLevel + 1 + Math.floor((lines - first) / 10);
  }
  function classicLevelProgress(lines, startLevel) {
    const first = classicFirstLevelUp(startLevel);
    if (lines < first) return lines / first;
    return (lines - first) % 10 / 10;
  }
  var NES_ORDER = ["T", "J", "Z", "O", "S", "L", "I"];
  function nextClassicPiece(prev, rand = Math.random) {
    let i = Math.floor(rand() * 8);
    if (i === 7 || NES_ORDER[i] === prev) i = Math.floor(rand() * 7);
    return NES_ORDER[i];
  }
  function fillClassicQueue(queue, last = null, minSize = 7, rand = Math.random) {
    while (queue.length < minSize) {
      queue.push(nextClassicPiece(queue.length ? queue[queue.length - 1] : last, rand));
    }
  }
  var rotate180 = (m) => rotateMatrix(rotateMatrix(m, 1), 1);
  var SPAWN_MATRICES = {
    I: SHAPES.I.matrix,
    J: rotate180(SHAPES.J.matrix),
    L: rotate180(SHAPES.L.matrix),
    O: SHAPES.O.matrix,
    S: SHAPES.S.matrix,
    T: rotate180(SHAPES.T.matrix),
    Z: SHAPES.Z.matrix
  };
  var TWO_STATE = /* @__PURE__ */ new Set(["I", "S", "Z"]);
  function classicMatrix(shape) {
    return SPAWN_MATRICES[shape];
  }
  function getClassicSpawnPos(matrix) {
    const top = Math.max(0, matrix.findIndex((row) => row.some((v) => v !== 0)));
    return {
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: BUFFER_ROWS - VISIBLE_ROWS - top
    };
  }
  function tryRotateClassic(player, arena, collide2, dir) {
    if (player.shape === "O") return { success: false, kickIndex: -1 };
    const matrix = player.matrix;
    const rotation = player.rotation;
    if (TWO_STATE.has(player.shape)) {
      player.matrix = rotateMatrix(matrix, rotation === 0 ? 1 : -1);
      player.rotation = rotation === 0 ? 1 : 0;
    } else {
      player.matrix = rotateMatrix(matrix, dir);
      player.rotation = (rotation + dir + 4) % 4;
    }
    if (collide2(arena, player)) {
      player.matrix = matrix;
      player.rotation = rotation;
      return { success: false, kickIndex: -1 };
    }
    return { success: true, kickIndex: 0 };
  }
  var NES_PALETTES = [
    ["#3cbcfc", "#0058f8"],
    ["#b8f818", "#00a800"],
    ["#f8a8f8", "#b800b8"],
    ["#6888fc", "#6844fc"],
    ["#58f898", "#e40058"],
    ["#58f898", "#6888fc"],
    ["#f87858", "#7c7c7c"],
    ["#9878f8", "#a80020"],
    ["#3cbcfc", "#a80020"],
    ["#fca044", "#d82800"]
  ];
  function nesPalette(level) {
    return NES_PALETTES[(level % NES_PALETTES.length + NES_PALETTES.length) % NES_PALETTES.length];
  }
  var NES_BLOCK_ART = {
    light: [
      "WWWWWWW.",
      "W111111.",
      "W1WW111.",
      "W1WW111.",
      "W111111.",
      "W111111.",
      "W111111.",
      "........"
    ],
    dark: [
      "WWWWWWW.",
      "W222222.",
      "W2WW222.",
      "W2WW222.",
      "W222222.",
      "W222222.",
      "W222222.",
      "........"
    ],
    ring: [
      "WWWWWWW.",
      "WWWWWWW.",
      "WW1111W.",
      "WW1111W.",
      "WW1111W.",
      "WW1111W.",
      "WWWWWWW.",
      "........"
    ]
  };
  var NES_BLOCK_KIND = { T: "light", O: "light", I: "light", J: "dark", S: "dark", Z: "ring", L: "ring" };
  function paintNesBlock(ctx, x, y, size, kind, palette) {
    const colors = { ".": "#000000", W: "#ffffff", 1: palette[0], 2: palette[1] };
    const art = NES_BLOCK_ART[kind];
    const edge = (i) => Math.round(i * size / 8);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        ctx.fillStyle = colors[art[row][col]];
        ctx.fillRect(x + edge(col), y + edge(row), edge(col + 1) - edge(col), edge(row + 1) - edge(row));
      }
    }
  }

  // js/skins.js
  var SKINS = ["ulol", "classic", "glossy", "flat", "neon"];
  var SKIN_LABELS = {
    ulol: "uloltris (pixel bevel)",
    classic: "Classic (Jstris-style bevel)",
    glossy: "Glossy (PPT-style)",
    flat: "Flat",
    neon: "Neon outline"
  };
  function describeSkin(val) {
    return SKIN_LABELS[val] || val;
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function shade(hex, amount) {
    const [r, g, b] = hexToRgb(hex);
    const t = amount > 0 ? 255 : 0;
    const k = Math.abs(amount);
    const mix2 = (c) => Math.round(c + (t - c) * k);
    return `rgb(${mix2(r)}, ${mix2(g)}, ${mix2(b)})`;
  }
  var PAINTERS = {
    /** Pixel bevel with an inset square, sized in whole pixels so it stays crisp. */
    ulol(ctx, s, color) {
      const b = Math.max(2, Math.round(s / 10));
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = shade(color, 0.35);
      ctx.fillRect(0, 0, s, b);
      ctx.fillStyle = shade(color, 0.2);
      ctx.fillRect(0, b, b, s - b);
      ctx.fillStyle = shade(color, -0.35);
      ctx.fillRect(0, s - b, s, b);
      ctx.fillStyle = shade(color, -0.2);
      ctx.fillRect(s - b, 0, b, s - b);
      const inset = Math.round(s * 0.27);
      const w = Math.max(1, Math.round(s / 15));
      ctx.strokeStyle = shade(color, 0.22);
      ctx.lineWidth = w;
      ctx.strokeRect(inset + w / 2, inset + w / 2, s - inset * 2 - w, s - inset * 2 - w);
    },
    /** Thick 3D bevel: light top-left triangle, dark bottom-right, flat face. */
    classic(ctx, s, color) {
      const b = Math.round(s * 0.18);
      ctx.fillStyle = shade(color, 0.45);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.fill();
      ctx.fillStyle = shade(color, -0.45);
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(s, s);
      ctx.lineTo(0, s);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(b, b, s - b * 2, s - b * 2);
    },
    /** Rounded candy block with a vertical gradient and a specular highlight. */
    glossy(ctx, s, color) {
      const r = s * 0.22;
      const pad = Math.max(1, s * 0.03);
      const path = () => {
        ctx.beginPath();
        ctx.roundRect(pad, pad, s - pad * 2, s - pad * 2, r);
      };
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, shade(color, 0.3));
      g.addColorStop(0.55, color);
      g.addColorStop(1, shade(color, -0.35));
      path();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.strokeStyle = shade(color, -0.5);
      ctx.stroke();
      const hl = ctx.createLinearGradient(0, pad, 0, s * 0.5);
      hl.addColorStop(0, "rgba(255,255,255,0.75)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.ellipse(s * 0.5, s * 0.3, s * 0.32, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = hl;
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(s * 0.3, s * 0.27, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
    },
    flat(ctx, s, color) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, s - Math.max(1, s / 15), s, Math.max(1, s / 15));
    },
    neon(ctx, s, color) {
      const w = Math.max(2, Math.round(s / 10));
      ctx.fillStyle = shade(color, -0.75);
      ctx.fillRect(0, 0, s, s);
      ctx.shadowColor = color;
      ctx.shadowBlur = s / 4;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.strokeRect(w, w, s - w * 2, s - w * 2);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = shade(color, 0.6);
      ctx.lineWidth = 1;
      ctx.strokeRect(w + 0.5, w + 0.5, s - w * 2 - 1, s - w * 2 - 1);
    }
  };
  var cache = /* @__PURE__ */ new Map();
  function nesBlockSprite(shape, level, size) {
    const key = `nes|${shape}|${(level % NES_PALETTES.length + NES_PALETTES.length) % NES_PALETTES.length}|${size}`;
    let sprite = cache.get(key);
    if (!sprite) {
      sprite = document.createElement("canvas");
      sprite.width = size;
      sprite.height = size;
      paintNesBlock(sprite.getContext("2d"), 0, 0, size, NES_BLOCK_KIND[shape] || "light", nesPalette(level));
      cache.set(key, sprite);
    }
    return sprite;
  }
  function blockSprite(skin, color, size) {
    const key = `${skin}|${color}|${size}`;
    let sprite = cache.get(key);
    if (!sprite) {
      sprite = document.createElement("canvas");
      sprite.width = size;
      sprite.height = size;
      (PAINTERS[skin] || PAINTERS.ulol)(sprite.getContext("2d"), size, color);
      cache.set(key, sprite);
    }
    return sprite;
  }

  // js/scenes/pixel.js
  var W = 320;
  var H = 180;
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function layer(w = W, h = H) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function px(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  var BAYER = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];
  function ditherGradient(ctx, x, y, w, h, colors) {
    const bands = colors.length - 1;
    const rgb = colors.map(parseColor);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let row = 0; row < h; row++) {
      const pos = row / Math.max(1, h - 1) * bands;
      const i = Math.min(bands - 1, Math.floor(pos));
      const frac = pos - i;
      for (let col = 0; col < w; col++) {
        const c = frac > (BAYER[y + row & 3][x + col & 3] + 0.5) / 16 ? rgb[i + 1] : rgb[i];
        const o = (row * w + col) * 4;
        d[o] = c[0];
        d[o + 1] = c[1];
        d[o + 2] = c[2];
        d[o + 3] = 255;
      }
    }
    const tmp = layer(w, h);
    tmp.ctx.putImageData(img, 0, 0);
    ctx.drawImage(tmp.canvas, x, y);
  }
  function parseColor(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function hazeBand(ctx, y0, y1, hex, alpha, density) {
    const [r, g, b] = parseColor(hex);
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    const mid = (y0 + y1) / 2;
    const half = (y1 - y0) / 2;
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
      const k = 1 - Math.abs((y - mid) / half);
      const cover = k * k * density;
      for (let x = 0; x < W; x++) {
        if (cover <= (BAYER[y & 3][x & 3] + 0.5) / 16) continue;
        const o = (y * W + x) * 4;
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = b;
        d[o + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function disc(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
  }
  function glow(ctx, cx, cy, r, color, strength = 0.5) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d > 1) continue;
        const threshold = (BAYER[cy + dy & 3][cx + dx & 3] + 0.5) / 16;
        if ((1 - d) * strength > threshold) px(ctx, cx + dx, cy + dy, color);
      }
    }
  }
  function ridge(ctx, baseY, amp, color, seed, { freq = 0.02, jag = 0, w = W } = {}) {
    const r = rng(seed);
    const phases = [r() * 10, r() * 10, r() * 10];
    let spike = 0;
    ctx.fillStyle = color;
    for (let x = 0; x < w; x++) {
      if (jag && x % 6 === 0) spike = (r() - 0.5) * jag;
      const y = baseY - Math.sin(x * freq + phases[0]) * amp - Math.sin(x * freq * 2.3 + phases[1]) * amp * 0.45 - Math.sin(x * freq * 5.1 + phases[2]) * amp * 0.15 + spike;
      ctx.fillRect(x, Math.round(y), 1, H - Math.round(y));
    }
  }
  function cloud(ctx, x, y, size, light, dark, seed) {
    const r = rng(seed);
    const puffs = [];
    const count = 5 + Math.floor(size / 3);
    for (let i = 0; i < count; i++) {
      const along = i / (count - 1) * 2 - 1;
      const pr = size * (0.5 + (1 - Math.abs(along)) * 0.55 + r() * 0.2);
      puffs.push([x + along * size * 2, y - (1 - Math.abs(along)) * size * 0.35 + r() * 2, pr]);
    }
    const floor = Math.round(y + size * 0.45);
    const draw = (color, grow, lift) => {
      ctx.fillStyle = color;
      for (const [cx, cy, pr] of puffs) {
        const rx = pr * 1.35 * grow;
        const ry = pr * 0.75 * grow;
        for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
          const yy = Math.round(cy + dy - lift);
          if (yy > floor - lift) continue;
          const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - dy * dy / (ry * ry))));
          ctx.fillRect(Math.round(cx - half), yy, half * 2 + 1, 1);
        }
      }
    };
    draw(dark, 1, 0);
    draw(light, 0.92, 2);
  }
  function wrap(v, span) {
    return (v % span + span) % span;
  }

  // js/scenes/bamboo.js
  function stalk(ctx, r, x, w, colors) {
    const top = -2;
    rect(ctx, x, top, w, H, colors.body);
    if (w >= 3) rect(ctx, x, top, 1, H, colors.light);
    if (w >= 6) rect(ctx, x + w - 1, top, 1, H, colors.dark);
    let y = 6 + r() * 14;
    while (y < H) {
      rect(ctx, x - 1, y, w + 2, 1, colors.node);
      if (w >= 5) rect(ctx, x, y + 1, w, 1, colors.light);
      y += 14 + r() * 10;
    }
  }
  function leafCluster(ctx, r, x, y, color, tip, count, scale) {
    for (let i = 0; i < count; i++) {
      const dir = r() < 0.5 ? -1 : 1;
      const len = Math.round((5 + r() * 6) * scale);
      const droop = 0.35 + r() * 0.35;
      const oy = y + r() * 6;
      for (let k = 0; k < len; k++) {
        const lx = x + dir * k;
        const ly = oy + k * droop;
        px(ctx, lx, ly, k === len - 1 ? tip : color);
        if (k > 1 && k < len - 2 && scale > 1) px(ctx, lx, ly + 1, color);
      }
    }
  }
  function forestLayer(seed, count, widths, colors, leafColors, leafScale) {
    const { canvas, ctx } = layer();
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      const x = Math.round((i + r() * 0.8) * (W / count));
      const w = widths[0] + Math.floor(r() * (widths[1] - widths[0] + 1));
      stalk(ctx, r, x, w, colors);
      let y = 10 + r() * 30;
      while (y < H - 30) {
        leafCluster(ctx, r, x + (r() < 0.5 ? 0 : w), y, leafColors[0], leafColors[1], 2 + Math.floor(r() * 3), leafScale);
        y += 22 + r() * 30;
      }
    }
    return canvas;
  }
  function mistLayer(y0, y1, color, alpha, density) {
    const { canvas, ctx } = layer();
    hazeBand(ctx, y0, y1, color, alpha, density);
    return canvas;
  }
  var bamboo_default = {
    id: "bamboo",
    name: "Bamboo Rain",
    create() {
      const sky = layer();
      ditherGradient(sky.ctx, 0, 0, W, H, ["#132226", "#1b302f", "#26413a", "#355848", "#4a7058"]);
      const far = forestLayer(
        11,
        26,
        [2, 2],
        { body: "#557d63", light: "#63907a", dark: "#4a6f57", node: "#46694f" },
        ["#5f8a6c", "#79a283"],
        1
      );
      const mistFar = mistLayer(60, 170, "#96bea8", 0.35, 1);
      const mid = forestLayer(
        23,
        14,
        [3, 4],
        { body: "#2f5a37", light: "#4b7f4d", dark: "#244a2b", node: "#1f3f25" },
        ["#3d7440", "#63a058"],
        1.5
      );
      const mistNear = mistLayer(120, 200, "#78a08c", 0.28, 0.9);
      const near = forestLayer(
        37,
        5,
        [7, 9],
        { body: "#14291a", light: "#23422a", dark: "#0d1d11", node: "#0a170d" },
        ["#18351e", "#2a5230"],
        2.2
      );
      const ground = layer();
      rect(ground.ctx, 0, H - 8, W, 8, "#0c170f");
      const gr = rng(5);
      for (let x = 0; x < W; x += 2) {
        const h = 1 + Math.floor(gr() * 4);
        rect(ground.ctx, x, H - 8 - h, 1, h, gr() < 0.5 ? "#16301c" : "#1f3d24");
      }
      const r = rng(99);
      const drops = Array.from({ length: 190 }, () => ({
        x: r() * (W + 60),
        y: r() * H,
        speed: 110 + r() * 70,
        len: 3 + Math.floor(r() * 4),
        color: r() < 0.3 ? "rgba(220, 240, 245, 0.55)" : "rgba(170, 210, 220, 0.35)"
      }));
      const leaves = Array.from({ length: 7 }, () => ({ x: r() * W, y: r() * H, speed: 6 + r() * 6, phase: r() * 6 }));
      return {
        draw(ctx, t) {
          ctx.drawImage(sky.canvas, 0, 0);
          ctx.drawImage(far, 0, 0);
          ctx.drawImage(mistFar, Math.round(Math.sin(t * 0.05) * 6), 0);
          ctx.drawImage(mid, 0, 0);
          for (const l of leaves) {
            const y = wrap(l.y + t * l.speed, H + 10) - 5;
            const x = wrap(l.x + Math.sin(t * 0.8 + l.phase) * 10 - t * 2, W);
            rect(ctx, x, y, 2, 1, "#7fb068");
            px(ctx, x + (Math.sin(t * 3 + l.phase) > 0 ? 2 : -1), y + 1, "#5e9150");
          }
          ctx.drawImage(mistNear, Math.round(Math.sin(t * 0.08 + 1) * 10), 0);
          ctx.drawImage(near, 0, 0);
          ctx.drawImage(ground.canvas, 0, 0);
          for (const d of drops) {
            const y = wrap(d.y + t * d.speed, H + 10) - 5;
            const x = wrap(d.x - y * 0.25 - t * 4, W + 60) - 30;
            ctx.fillStyle = d.color;
            for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(x + k * 0.25), Math.round(y - k), 1, 1);
          }
          const sr = rng(Math.floor(t * 12));
          for (let i = 0; i < 10; i++) {
            const sx = Math.floor(sr() * W);
            px(ctx, sx - 1, H - 9, "rgba(200, 230, 235, 0.6)");
            px(ctx, sx + 1, H - 9, "rgba(200, 230, 235, 0.6)");
            px(ctx, sx, H - 10, "rgba(200, 230, 235, 0.4)");
          }
        }
      };
    }
  };

  // js/scenes/wheat.js
  var HORIZON = 118;
  var wheat_default = {
    id: "wheat",
    name: "Golden Field",
    create() {
      const sky = layer();
      ditherGradient(sky.ctx, 0, 0, W, HORIZON + 4, ["#2a1b40", "#4e2a5a", "#8c3b5f", "#cc5d5b", "#ec935d", "#f7c374"]);
      glow(sky.ctx, 232, 100, 34, "#fbd98f", 0.55);
      disc(sky.ctx, 232, 100, 15, "#ffe9ad");
      disc(sky.ctx, 232, 100, 12, "#fff3cc");
      const clouds = layer(W * 2, 90);
      const cr = rng(7);
      for (let i = 0; i < 9; i++) {
        cloud(clouds.ctx, cr() * W * 2, 18 + cr() * 50, 6 + cr() * 7, "#f8bf9c", "#c97c80", 100 + i);
      }
      const hills = layer();
      ridge(hills.ctx, HORIZON - 2, 5, "#7a3c5a", 3, { freq: 0.018 });
      ridge(hills.ctx, HORIZON + 4, 3, "#5a2e4c", 8, { freq: 0.03 });
      const tr = rng(12);
      for (let i = 0; i < 14; i++) {
        const x = tr() * W;
        const y = HORIZON - 1 + tr() * 3;
        rect(hills.ctx, x, y - 3, 3, 3, "#4a2440");
        rect(hills.ctx, x + 1, y - 5, 1, 2, "#4a2440");
      }
      const field = layer();
      ditherGradient(field.ctx, 0, HORIZON + 2, W, H - HORIZON - 2, ["#9c6530", "#b67a36", "#cd913d", "#bf853a", "#a86f30"]);
      const rows = [];
      for (let i = 0; i < 16; i++) {
        const depth = i / 15;
        rows.push({
          y: HORIZON + 6 + Math.pow(depth, 1.35) * (H - HORIZON - 2),
          spacing: depth < 0.3 ? 2 : depth < 0.7 ? 3 : 4,
          head: 1 + Math.round(depth * 4),
          stem: 2 + Math.round(depth * 10),
          amp: 0.4 + depth * 2.2,
          offset: i * 1.7
        });
      }
      const r = rng(31);
      const birds = Array.from({ length: 4 }, (_, i) => ({ x: r() * W, y: 26 + r() * 40, speed: 9 + r() * 6, phase: i }));
      const motes = Array.from({ length: 24 }, () => ({ x: r() * W, y: HORIZON + r() * 60, s: 2 + r() * 3, p: r() * 6 }));
      return {
        draw(ctx, t) {
          ctx.drawImage(sky.canvas, 0, 0);
          ctx.drawImage(clouds.canvas, -Math.round(wrap(t * 2, W)), 0);
          ctx.drawImage(clouds.canvas, W * 2 - Math.round(wrap(t * 2, W)), 0);
          ctx.drawImage(hills.canvas, 0, 0);
          for (const b of birds) {
            const x = wrap(b.x - t * b.speed, W + 20) - 10;
            const y = Math.round(b.y + Math.sin(t * 0.7 + b.phase) * 3);
            const up = Math.floor(t * 5 + b.phase) % 2 === 0;
            px(ctx, x, y, "#3a1c38");
            px(ctx, x - 1, y + (up ? -1 : 1), "#3a1c38");
            px(ctx, x + 1, y + (up ? -1 : 1), "#3a1c38");
            px(ctx, x - 2, y + (up ? -1 : 1), "#3a1c38");
            px(ctx, x + 2, y + (up ? -1 : 1), "#3a1c38");
          }
          ctx.drawImage(field.canvas, 0, 0);
          for (const row of rows) {
            const gust = Math.sin(t * 0.35) * 0.5 + 0.5;
            for (let x = (row.offset | 0) % row.spacing; x < W; x += row.spacing) {
              const sway = Math.round(Math.sin(t * 1.6 - x * 0.045 + row.offset) * row.amp * (0.6 + gust * 0.6));
              const top = Math.round(row.y - row.stem);
              rect(ctx, x + Math.round(sway / 2), top + row.head, 1, row.stem - row.head, "#9a6a2c");
              rect(ctx, x + sway, top, row.head > 3 ? 2 : 1, row.head, "#efc15a");
              px(ctx, x + sway, top - 1, "#ffe39a");
            }
          }
          for (const m of motes) {
            const y = wrap(m.y - t * m.s, 70) + HORIZON - 10;
            const x = wrap(m.x + Math.sin(t + m.p) * 6 + t * 3, W);
            if (Math.sin(t * 2 + m.p) > -0.2) px(ctx, x, y, "#fff1b8");
          }
        }
      };
    }
  };

  // js/scenes/village.js
  var GROUND = 150;
  function pine(ctx, x, base, h, color) {
    for (let i = 0; i < h; i++) {
      const half = Math.floor(i / h * (h * 0.4)) + (i % 3 === 0 ? 0 : 1);
      rect(ctx, x - half, base - h + i, half * 2 + 1, 1, color);
    }
    rect(ctx, x, base, 1, 2, color);
  }
  function house(ctx, x, w, h, wall2, wallDark, roof, roofDark, r, windows, chimneys) {
    const top = GROUND - h;
    rect(ctx, x, top, w, h, wall2);
    rect(ctx, x + w - 2, top, 2, h, wallDark);
    for (let y = top + 3; y < GROUND; y += 4) rect(ctx, x, y, w - 2, 1, wallDark);
    const roofH = Math.round(w * 0.45);
    for (let i = 0; i < roofH; i++) {
      const inset = Math.round((roofH - i) * (w / 2 + 3) / roofH);
      rect(ctx, x - 3 + inset, top - roofH + i, w + 6 - inset * 2, 1, i % 3 === 0 ? roofDark : roof);
    }
    if (r() < 0.8) {
      const cx = x + Math.round(w * (0.2 + r() * 0.5));
      const cTop = top - Math.round(roofH * 0.7) - 4;
      rect(ctx, cx, cTop, 3, 8, "#3a2e34");
      rect(ctx, cx - 1, cTop, 5, 1, "#2a2026");
      chimneys.push({ x: cx + 1, y: cTop - 1, phase: r() * 10 });
    }
    rect(ctx, x + Math.round(w / 2) - 2, GROUND - 7, 4, 7, "#2a1c16");
    const winY = top + 4;
    for (let wx = x + 3; wx + 4 < x + w - 2; wx += 8) {
      if (Math.abs(wx + 2 - (x + w / 2)) < 4 && h < 20) continue;
      rect(ctx, wx - 1, winY - 1, 6, 6, "#3a2a22");
      windows.push({ x: wx, y: winY, seed: r() });
    }
  }
  var village_default = {
    id: "village",
    name: "Night Village",
    create() {
      const base = layer();
      const b = base.ctx;
      ditherGradient(b, 0, 0, W, 135, ["#060919", "#0b112e", "#131b42", "#1d2756", "#2b3466"]);
      glow(b, 58, 34, 22, "#1e2a58", 0.7);
      disc(b, 58, 34, 11, "#f2ecd0");
      px(b, 54, 31, "#d9d0ac");
      rect(b, 60, 36, 2, 2, "#d9d0ac");
      px(b, 63, 30, "#d9d0ac");
      rect(b, 55, 38, 2, 1, "#d9d0ac");
      ridge(b, 122, 12, "#121937", 21, { freq: 0.013, jag: 3 });
      ridge(b, 134, 5, "#18203f", 22, { freq: 0.025 });
      const tr = rng(4);
      for (let i = 0; i < 26; i++) pine(b, Math.round(tr() * W), 136 + Math.round(tr() * 6), 7 + Math.round(tr() * 7), "#0e1530");
      rect(b, 0, GROUND, W, H - GROUND, "#171b2a");
      ditherGradient(b, 0, GROUND, W, H - GROUND, ["#1a1f30", "#141824"]);
      for (let x2 = 0; x2 < W; x2++) {
        const y = GROUND + 12 + Math.round(Math.sin(x2 * 0.03) * 3);
        rect(b, x2, y, 1, 6, (x2 >> 2) % 2 ? "#2a2c3c" : "#262838");
      }
      const r = rng(8);
      const windows = [];
      const chimneys = [];
      const walls = [["#6b4a3a", "#57392c"], ["#7a5d47", "#624a38"], ["#5c4a5a", "#4a3a48"], ["#6d5c49", "#584a3a"]];
      const roofs = [["#7a2f38", "#5e2129"], ["#34467a", "#26345c"], ["#5b3a2a", "#462a1e"], ["#2f5a4a", "#224438"]];
      let x = 8;
      while (x < W - 20) {
        const w = 22 + Math.floor(r() * 12);
        const h = 15 + Math.floor(r() * 10);
        const [wall2, wallDark] = walls[Math.floor(r() * walls.length)];
        const [roof, roofDark] = roofs[Math.floor(r() * roofs.length)];
        house(b, x, w, h, wall2, wallDark, roof, roofDark, r, windows, chimneys);
        x += w + 10 + Math.floor(r() * 16);
      }
      const lamps = [52, 150, 262].map((lx) => ({ x: lx, y: GROUND - 14 }));
      for (const l of lamps) {
        glow(b, l.x, l.y, 10, "#4a3f46", 1.6);
        glow(b, l.x, l.y, 6, "#8a6a44", 1.4);
        rect(b, l.x, l.y, 1, 14, "#1e1a22");
        rect(b, l.x - 1, l.y - 3, 3, 3, "#ffe08a");
      }
      const sr = rng(77);
      const stars = Array.from({ length: 70 }, () => ({ x: Math.floor(sr() * W), y: Math.floor(sr() * 100), p: sr() * 10, big: sr() < 0.1 }));
      const flies = Array.from({ length: 12 }, () => ({ x: sr() * W, y: GROUND - 6 + sr() * 14, p: sr() * 10 }));
      return {
        draw(ctx, t) {
          ctx.drawImage(base.canvas, 0, 0);
          for (const s of stars) {
            const tw = Math.sin(t * 1.5 + s.p);
            if (tw < -0.4) continue;
            const c = tw > 0.6 ? "#ffffff" : "#8f9fe0";
            px(ctx, s.x, s.y, c);
            if (s.big && tw > 0.5) {
              px(ctx, s.x - 1, s.y, "#6f7fc0");
              px(ctx, s.x + 1, s.y, "#6f7fc0");
              px(ctx, s.x, s.y - 1, "#6f7fc0");
              px(ctx, s.x, s.y + 1, "#6f7fc0");
            }
          }
          for (const w of windows) {
            const off = Math.sin(Math.floor(t / 4) * 13.7 + w.seed * 91) > 0.82;
            const flicker = Math.sin(t * 7 + w.seed * 50) > 0.92;
            rect(ctx, w.x, w.y, 4, 4, off ? "#1c1a2a" : flicker ? "#ffe7a4" : "#ffc75e");
            if (!off) rect(ctx, w.x, w.y + 2, 4, 1, "#e8a646");
          }
          for (const c of chimneys) {
            for (let k = 0; k < 7; k++) {
              const age = wrap(t * 0.35 + k / 7 + c.phase, 1);
              const sx = Math.round(c.x + Math.sin(age * 5 + k) * 2 + age * 10);
              const sy = Math.round(c.y - age * 30);
              const size = 1 + Math.round(age * 3);
              ctx.fillStyle = `rgba(150, 156, 184, ${(1 - age) * 0.55})`;
              ctx.fillRect(sx, sy, size, size);
            }
          }
          for (const f of flies) {
            if (Math.sin(t * 2.5 + f.p) < 0.2) continue;
            px(ctx, f.x + Math.sin(t * 0.6 + f.p) * 18, f.y + Math.sin(t * 1.3 + f.p * 2) * 5, "#d8ff7a");
          }
        }
      };
    }
  };

  // js/scenes/castle.js
  var STONE = "#5e5c7c";
  var STONE_DARK = "#48466a";
  var STONE_LIGHT = "#77759a";
  var ROOF = "#7c2b4c";
  var ROOF_DARK = "#5e1f3a";
  function stoneBlock(ctx, x, y, w, h) {
    rect(ctx, x, y, w, h, STONE);
    rect(ctx, x, y, 1, h, STONE_LIGHT);
    rect(ctx, x + w - 1, y, 1, h, STONE_DARK);
    for (let row = y + 3, n = 0; row < y + h; row += 3, n++) {
      rect(ctx, x, row, w, 1, STONE_DARK);
      for (let bx = x + (n % 2 ? 2 : 4); bx < x + w - 1; bx += 5) px(ctx, bx, row - 1, STONE_DARK);
    }
  }
  function crenels(ctx, x, y, w) {
    for (let cx = x; cx < x + w; cx += 3) rect(ctx, cx, y - 2, 2, 2, STONE);
  }
  function tower(ctx, x, top, w, base, flags) {
    stoneBlock(ctx, x, top, w, base - top);
    const roofH = Math.round(w * 1.3);
    for (let i = 0; i < roofH; i++) {
      const half = Math.round(i / roofH * (w / 2 + 2));
      rect(ctx, x + w / 2 - half, top - roofH + i, half * 2, 1, i % 4 === 0 ? ROOF_DARK : ROOF);
    }
    rect(ctx, x + Math.round(w / 2) - 1, top + 6, 2, 3, "#ffcf6b");
    rect(ctx, x + Math.round(w / 2) - 1, top + 16, 2, 3, "#ffcf6b");
    flags.push({ x: x + Math.round(w / 2), y: top - roofH - 6 });
  }
  var castle_default = {
    id: "castle",
    name: "Dusk Castle",
    create() {
      const sky = layer();
      ditherGradient(sky.ctx, 0, 0, W, 150, ["#181231", "#321c4d", "#582757", "#923963", "#c95c5e", "#e8895b"]);
      glow(sky.ctx, 74, 122, 30, "#f5a36d", 0.5);
      disc(sky.ctx, 74, 122, 14, "#f7c08a");
      const clouds = layer(W * 2, 100);
      const cr = rng(17);
      for (let i = 0; i < 8; i++) cloud(clouds.ctx, cr() * W * 2, 16 + cr() * 60, 4 + cr() * 5, "#b35f7c", "#7c3d68", 300 + i);
      const land = layer();
      const l = land.ctx;
      ridge(l, 128, 14, "#3a2150", 41, { freq: 0.016, jag: 5 });
      ridge(l, 150, 6, "#2a1a42", 42, { freq: 0.02 });
      l.fillStyle = "#20163a";
      for (let x = 0; x < W; x++) {
        const d = (x - 205) / 95;
        const y = Math.round(128 + d * d * 40);
        l.fillRect(x, Math.min(y, H), 1, H);
      }
      const flags = [];
      const baseY = 132;
      stoneBlock(l, 168, 108, 76, baseY - 108);
      crenels(l, 168, 108, 76);
      rect(l, 198, 116, 16, 16, "#1a1226");
      for (let i = 0; i < 8; i++) rect(l, 198 + i, 116 - Math.round(Math.sqrt(64 - (i - 8) ** 2) / 2), 16 - i * 2, 1, "#1a1226");
      tower(l, 160, 90, 12, baseY, flags);
      tower(l, 240, 90, 12, baseY, flags);
      tower(l, 199, 74, 14, 108, flags);
      crenels(l, 160, 90, 12);
      crenels(l, 240, 90, 12);
      for (const wx of [176, 186, 222, 232]) rect(l, wx, 116, 2, 3, "#ffcf6b");
      const tr = rng(51);
      for (let i = 0; i < 12; i++) {
        const x = i < 6 ? tr() * 90 : W - tr() * 60;
        const h = 14 + tr() * 22;
        for (let k = 0; k < h; k++) {
          const half = Math.round(k / h * h * 0.33);
          rect(l, x - half, H - h - 4 + k, half * 2 + 1, 1, "#120d1f");
        }
      }
      rect(l, 0, H - 5, W, 5, "#120d1f");
      const sr = rng(3);
      const stars = Array.from({ length: 22 }, () => ({ x: Math.floor(sr() * W), y: Math.floor(sr() * 50), p: sr() * 10 }));
      const bats = Array.from({ length: 5 }, (_, i) => ({ cx: 205 + (sr() - 0.5) * 60, cy: 70 + sr() * 20, rx: 30 + sr() * 30, p: i * 1.3 }));
      return {
        draw(ctx, t) {
          ctx.drawImage(sky.canvas, 0, 0);
          for (const s of stars) if (Math.sin(t + s.p) > 0) px(ctx, s.x, s.y, "#f0d8f0");
          const cx = Math.round(wrap(t * 3, W));
          ctx.drawImage(clouds.canvas, -cx, 0);
          ctx.drawImage(clouds.canvas, W * 2 - cx, 0);
          ctx.drawImage(land.canvas, 0, 0);
          for (const f of flags) {
            rect(ctx, f.x, f.y, 1, 7, "#2a2030");
            for (let c = 0; c < 7; c++) {
              const dy = Math.round(Math.sin(t * 6 - c * 0.9) * 0.9);
              rect(ctx, f.x + 1 + c, f.y + dy, 1, 3, c % 2 ? "#ec4a5c" : "#d93a4e");
            }
          }
          for (const b of bats) {
            const x = Math.round(b.cx + Math.cos(t * 0.5 + b.p) * b.rx);
            const y = Math.round(b.cy + Math.sin(t * 0.9 + b.p) * 10);
            const up = Math.floor(t * 8 + b.p) % 2 === 0;
            rect(ctx, x, y, 2, 1, "#140f22");
            px(ctx, x - 1, y + (up ? -1 : 0), "#140f22");
            px(ctx, x + 2, y + (up ? -1 : 0), "#140f22");
            px(ctx, x - 2, y + (up ? -2 : 1), "#140f22");
            px(ctx, x + 3, y + (up ? -2 : 1), "#140f22");
          }
        }
      };
    }
  };

  // js/scenes/ocean.js
  var HORIZON2 = 106;
  var ocean_default = {
    id: "ocean",
    name: "Open Sea",
    create() {
      const sky = layer();
      ditherGradient(sky.ctx, 0, 0, W, HORIZON2, ["#2b69be", "#4585d4", "#65a2e2", "#8cc0ee", "#bddff7", "#e6f4fc"]);
      glow(sky.ctx, 250, 32, 26, "#fff4c4", 0.6);
      disc(sky.ctx, 250, 32, 11, "#fffbe6");
      const clouds = layer(W * 2, HORIZON2);
      const cr = rng(61);
      for (let i = 0; i < 8; i++) cloud(clouds.ctx, cr() * W * 2, 20 + cr() * 60, 5 + cr() * 7, "#ffffff", "#c8dff2", 500 + i);
      const sea = layer();
      ditherGradient(sea.ctx, 0, HORIZON2, W, H - HORIZON2, ["#56afe0", "#3690c8", "#2676b0", "#1c5e96", "#154c7e"]);
      rect(sea.ctx, 0, HORIZON2, W, 1, "#8fcaec");
      for (let i = 0; i < 26; i++) {
        const h = Math.round(Math.sin(i / 26 * Math.PI) * 5);
        rect(sea.ctx, 60 + i, HORIZON2 - h, 1, h, "#5a86a8");
      }
      const isle = layer();
      const s = isle.ctx;
      for (let x = -10; x < 90; x++) {
        const d = (x - 35) / 50;
        const h = Math.max(0, Math.round((1 - d * d) * 16));
        if (h > 0) {
          rect(s, x, H - h, 1, h, "#e9d59c");
          rect(s, x, H - h, 1, 1, "#f7e8bd");
          if (h > 3) rect(s, x, H - 2, 1, 2, "#cdb77c");
        }
      }
      for (let i = 0; i < 34; i++) {
        const tx = Math.round(36 + Math.sin(i / 34 * 1.4) * 10);
        rect(s, tx, H - 14 - i, 3, 1, i % 3 === 0 ? "#6e4424" : "#8a5a30");
      }
      const topX = 46, topY = H - 49;
      const frond = (dir, len, droop, color) => {
        for (let k = 0; k < len; k++) {
          const fx = topX + dir * k;
          const fy = topY + Math.round(k * k * droop);
          rect(s, fx, fy, 2, 1, color);
          if (k % 2 === 0 && k > 2) px(s, fx, fy + 1, color);
        }
      };
      frond(-1, 18, 0.05, "#2f8a3a");
      frond(1, 20, 0.045, "#2f8a3a");
      frond(-1, 14, 0.09, "#4fb04a");
      frond(1, 15, 0.08, "#4fb04a");
      frond(1, 10, 0.18, "#3a9a40");
      frond(-1, 9, 0.2, "#3a9a40");
      disc(s, topX, topY + 2, 2, "#6b4424");
      const r = rng(19);
      const waves = [];
      for (let i = 0; i < 90; i++) {
        const depth = r();
        waves.push({
          x: r() * W,
          y: HORIZON2 + 3 + Math.round(depth * depth * (H - HORIZON2 - 6)),
          len: 2 + Math.round(depth * 8),
          speed: (4 + depth * 10) * (r() < 0.5 ? 1 : -1),
          p: r() * 6,
          color: depth < 0.4 ? "#a8dcf6" : "#7fc2ea"
        });
      }
      const gulls = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 40 + r() * 30, speed: 7 + r() * 5, p: i }));
      return {
        draw(ctx, t) {
          ctx.drawImage(sky.canvas, 0, 0);
          const cx = Math.round(wrap(t * 2.5, W));
          ctx.drawImage(clouds.canvas, -cx, 0);
          ctx.drawImage(clouds.canvas, W * 2 - cx, 0);
          ctx.drawImage(sea.canvas, 0, 0);
          for (const w of waves) {
            const x = wrap(w.x + t * w.speed, W + 20) - 10;
            if (Math.sin(t * 1.2 + w.p) < -0.6) continue;
            rect(ctx, x, w.y, w.len, 1, w.color);
          }
          const gr = rng(Math.floor(t * 8));
          for (let i = 0; i < 14; i++) {
            const y = HORIZON2 + 2 + Math.floor(gr() * 50);
            const spread = 4 + (y - HORIZON2) * 0.4;
            px(ctx, 250 + Math.round((gr() - 0.5) * spread * 2), y, "#ffffff");
          }
          const bx = Math.round(wrap(t * 4 + 40, W + 60) - 30);
          const by = Math.round(HORIZON2 + 8 + Math.sin(t * 1.5));
          rect(ctx, bx, by, 14, 2, "#7a3a28");
          rect(ctx, bx + 1, by + 2, 12, 1, "#5a2a1c");
          rect(ctx, bx + 6, by - 13, 1, 13, "#3a2a20");
          for (let i = 0; i < 11; i++) {
            rect(ctx, bx + 7, by - 12 + i, Math.round(i * 0.6), 1, "#f4f1e8");
            rect(ctx, bx + 5 - Math.round(i * 0.35), by - 10 + i, Math.round(i * 0.35), 1, "#dcd6c8");
          }
          rect(ctx, bx - 2, by + 3, 18, 1, "rgba(255,255,255,0.35)");
          for (const g of gulls) {
            const x = wrap(g.x + t * g.speed, W + 20) - 10;
            const y = Math.round(g.y + Math.sin(t * 0.8 + g.p) * 4);
            const up = Math.floor(t * 4 + g.p) % 2 === 0;
            px(ctx, x, y, "#f4f6fa");
            px(ctx, x - 1, y + (up ? -1 : 0), "#f4f6fa");
            px(ctx, x + 1, y + (up ? -1 : 0), "#f4f6fa");
            px(ctx, x - 2, y + (up ? -1 : 1), "#aab4c4");
            px(ctx, x + 2, y + (up ? -1 : 1), "#aab4c4");
          }
          ctx.drawImage(isle.canvas, 0, 0);
          for (let x = -10; x < 90; x += 3) {
            const d = (x - 35) / 50;
            const h = Math.max(0, Math.round((1 - d * d) * 16));
            if (h > 0 && h < 6 && Math.sin(t * 2 + x) > 0) px(ctx, x, H - h - 1, "#ffffff");
          }
        }
      };
    }
  };

  // js/scenes/neon.js
  var HORIZON3 = 118;
  var SHAPES2 = [
    [[1, 1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 1], [1, 1, 0]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 1, 0], [0, 1, 1]]
  ];
  var COLORS = ["#3ff5d0", "#ff4fb4", "#ffd84a", "#7a6bff", "#9bff5a", "#ff7a3a"];
  function rotate(m) {
    return m[0].map((_, i) => m.map((row) => row[i]).reverse());
  }
  function drawPiece(ctx, shape, x, y, cell, color, alpha) {
    ctx.globalAlpha = alpha;
    shape.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      const cx = Math.round(x + c * cell);
      const cy = Math.round(y + r * cell);
      rect(ctx, cx, cy, cell, 1, color);
      rect(ctx, cx, cy + cell - 1, cell, 1, color);
      rect(ctx, cx, cy, 1, cell, color);
      rect(ctx, cx + cell - 1, cy, 1, cell, color);
      if (cell >= 6) rect(ctx, cx + 2, cy + 2, cell - 4, cell - 4, "rgba(255,255,255,0.12)");
    }));
    ctx.globalAlpha = 1;
  }
  var neon_default = {
    id: "neon",
    name: "Neon Fall",
    create() {
      const base = layer();
      ditherGradient(base.ctx, 0, 0, W, HORIZON3, ["#05030d", "#0b0620", "#170a34", "#2a0d47", "#46125a"]);
      ditherGradient(base.ctx, 0, HORIZON3, W, H - HORIZON3, ["#1a0628", "#0c0416", "#06020c"]);
      glow(base.ctx, 160, HORIZON3, 60, "#5a1a6a", 0.45);
      rect(base.ctx, 0, HORIZON3, W, 1, "#ff4fb4");
      const r = rng(71);
      const pieces = Array.from({ length: 18 }, () => {
        let shape = SHAPES2[Math.floor(r() * SHAPES2.length)];
        for (let k = Math.floor(r() * 4); k > 0; k--) shape = rotate(shape);
        const cell = r() < 0.35 ? 7 : r() < 0.6 ? 5 : 4;
        return {
          shape,
          cell,
          x: r() * (W - 30),
          y: r() * H,
          speed: 6 + cell * 2.2 + r() * 6,
          color: COLORS[Math.floor(r() * COLORS.length)],
          p: r() * 6
        };
      }).sort((a, b) => a.cell - b.cell);
      const stars = Array.from({ length: 40 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * (HORIZON3 - 10)), p: r() * 6 }));
      return {
        draw(ctx, t) {
          ctx.drawImage(base.canvas, 0, 0);
          for (const s of stars) if (Math.sin(t * 2 + s.p) > 0.3) px(ctx, s.x, s.y, "#b9a8ff");
          ctx.fillStyle = "rgba(255, 79, 180, 0.55)";
          for (let i = 0; i < 12; i++) {
            const z = wrap(i - t * 1.4, 12) / 12;
            const y = HORIZON3 + Math.round(Math.pow(z, 2.2) * (H - HORIZON3));
            ctx.globalAlpha = 0.25 + z * 0.75;
            ctx.fillRect(0, y, W, 1);
          }
          ctx.globalAlpha = 0.5;
          for (let i = -12; i <= 12; i++) {
            const bottomX = 160 + i * 34;
            for (let y = HORIZON3 + 1; y < H; y += 1) {
              const k = (y - HORIZON3) / (H - HORIZON3);
              ctx.fillRect(Math.round(160 + (bottomX - 160) * k), y, 1, 1);
            }
          }
          ctx.globalAlpha = 1;
          for (const p of pieces) {
            const y = wrap(p.y + t * p.speed, H + 50) - 40;
            const x = p.x + Math.sin(t * 0.3 + p.p) * 3;
            drawPiece(ctx, p.shape, x, y - p.cell * 3, p.cell, p.color, 0.15);
            drawPiece(ctx, p.shape, x, y - p.cell * 1.5, p.cell, p.color, 0.3);
            drawPiece(ctx, p.shape, x, y, p.cell, p.color, 1);
          }
        }
      };
    }
  };

  // js/scenes/city.js
  var ROAD = 150;
  function skyline(ctx, seed, count, minH, maxH, body, windowColors, litChance, winStep) {
    const r = rng(seed);
    const lit = [];
    let x = -4;
    while (x < W) {
      const w = 12 + Math.floor(r() * 22);
      const h = minH + Math.floor(r() * (maxH - minH));
      const top = ROAD - h;
      rect(ctx, x, top, w, h, body);
      if (r() < 0.3) rect(ctx, x + Math.floor(w / 2), top - 6, 1, 6, body);
      for (let wy = top + 3; wy < ROAD - 3; wy += winStep) {
        for (let wx = x + 2; wx < x + w - 2; wx += winStep) {
          if (r() < litChance) {
            const c = windowColors[Math.floor(r() * windowColors.length)];
            px(ctx, wx, wy, c);
            lit.push({ x: wx, y: wy, c, p: r() * 100 });
          }
        }
      }
      x += w + Math.floor(r() * 4);
      if (count-- <= 0) break;
    }
    return lit;
  }
  var city_default = {
    id: "city",
    name: "Midnight Circuit",
    create() {
      const base = layer();
      const b = base.ctx;
      ditherGradient(b, 0, 0, W, ROAD, ["#04030c", "#08071e", "#120c32", "#1f1348", "#3a1a5e", "#5a2266"]);
      glow(b, 262, 32, 24, "#2c2466", 0.8);
      disc(b, 262, 32, 13, "#ece8ff");
      disc(b, 266, 29, 11, "#d6d0f4");
      skyline(b, 3, 40, 40, 90, "#141236", ["#2e2d6a", "#3a3a7a"], 0.25, 3);
      const midLit = skyline(b, 9, 30, 25, 70, "#1b1744", ["#ffd27a", "#7ad0ff", "#ff9ad0"], 0.18, 4);
      const signs = [];
      const nr = rng(15);
      let x = 6;
      while (x < W) {
        const w = 16 + Math.floor(nr() * 20);
        const h = 18 + Math.floor(nr() * 40);
        rect(b, x, ROAD - h, w, h, "#0b0920");
        if (nr() < 0.6) signs.push({ x: x + 2 + Math.floor(nr() * (w - 6)), y: ROAD - h + 4, h: 6 + Math.floor(nr() * 10), c: nr() < 0.5 ? "#ff4fa8" : "#4ff0ff", p: nr() * 10 });
        x += w + 6 + Math.floor(nr() * 14);
      }
      rect(b, 0, ROAD, W, H - ROAD, "#0e0c1c");
      rect(b, 0, ROAD, W, 2, "#3a3560");
      rect(b, 0, ROAD + 14, W, 1, "#2a2548");
      rect(b, 0, H - 8, W, 8, "#08070f");
      for (let px0 = 10; px0 < W; px0 += 40) rect(b, px0, H - 8, 4, 8, "#1a1830");
      const antennas = [];
      const ar = rng(27);
      for (let i = 0; i < 6; i++) antennas.push({ x: Math.floor(ar() * W), y: 60 + Math.floor(ar() * 40), p: ar() * 6 });
      const r = rng(44);
      const cars = Array.from({ length: 16 }, () => {
        const right = r() < 0.55;
        return {
          right,
          x: r() * W,
          speed: (90 + r() * 90) * (right ? 1 : -1),
          y: right ? ROAD + 5 + Math.floor(r() * 3) : ROAD + 10 + Math.floor(r() * 3),
          len: 6 + Math.floor(r() * 10)
        };
      });
      return {
        draw(ctx, t) {
          ctx.drawImage(base.canvas, 0, 0);
          for (const w of midLit) {
            if (Math.sin(t * 0.3 + w.p) > 0.97) px(ctx, w.x, w.y, "#1b1744");
          }
          for (const a of antennas) {
            if (Math.sin(t * 3 + a.p) > 0.3) px(ctx, a.x, a.y, "#ff3b3b");
          }
          for (const s of signs) {
            const on = Math.sin(t * 9 + s.p) > -0.85 || Math.sin(t * 0.7 + s.p) > 0;
            if (!on) continue;
            rect(ctx, s.x, s.y, 2, s.h, s.c);
            ctx.globalAlpha = 0.25;
            rect(ctx, s.x - 1, s.y - 1, 4, s.h + 2, s.c);
            ctx.globalAlpha = 1;
          }
          for (let i = 0; i < 12; i++) {
            const lx = wrap(i * 30 - t * 160, W + 30) - 15;
            rect(ctx, lx, ROAD + 9, 10, 1, "#4a4478");
          }
          for (const c of cars) {
            const x2 = wrap(c.x + t * c.speed, W + 60) - 30;
            for (let k = 0; k < c.len; k++) {
              const tx = c.right ? x2 - k : x2 + k;
              ctx.globalAlpha = 1 - k / c.len;
              px(ctx, tx, c.y, c.right ? "#fff6d8" : "#ff3050");
            }
            ctx.globalAlpha = 1;
            px(ctx, x2, c.y - 1, c.right ? "#ffffff" : "#ff6070");
          }
        }
      };
    }
  };

  // js/scenes/storm.js
  var FLASH_EVERY = 3.4;
  function peaks(ctx, seed, baseY, amp, color, snow) {
    const r = rng(seed);
    const list = [];
    for (let x = -30; x < W + 30; x += 22 + r() * 34) {
      list.push({ x, top: baseY - amp * (0.35 + r() * 0.65), slope: 0.7 + r() * 0.8 });
    }
    const tops = [];
    let jitter = 0;
    for (let x = 0; x < W; x++) {
      if (x % 3 === 0) jitter = Math.round((r() - 0.5) * 2);
      let y = baseY;
      let peak = null;
      for (const p of list) {
        const py = p.top + Math.abs(x - p.x) * p.slope;
        if (py < y) {
          y = py;
          peak = p;
        }
      }
      y = Math.round(y + jitter);
      tops.push(y);
      rect(ctx, x, y, 1, H - y, color);
      if (snow && peak) {
        const depth = Math.round(6 - (y - peak.top) * 0.6 + (r() < 0.3 ? 1 : 0));
        if (depth > 0 && peak.top < baseY - amp * 0.5) rect(ctx, x, y, 1, depth, snow);
      }
    }
    return tops;
  }
  function bolt(ctx, seed, groundY) {
    const r = rng(seed);
    let x = 40 + r() * 240;
    let y = 0;
    const paths = [];
    while (y < groundY) {
      const nx = x + (r() - 0.5) * 12;
      const ny = y + 4 + r() * 8;
      paths.push([x, y, nx, ny]);
      if (r() < 0.18) {
        let bx = nx, by = ny;
        const dir = r() < 0.5 ? -1 : 1;
        for (let k = 0; k < 4; k++) {
          const ex = bx + dir * (3 + r() * 6), ey = by + 3 + r() * 5;
          paths.push([bx, by, ex, ey, true]);
          bx = ex;
          by = ey;
        }
      }
      x = nx;
      y = ny;
    }
    for (const [x0, y0, x1, y1, branch] of paths) {
      const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
      for (let i = 0; i <= steps; i++) {
        const px0 = x0 + (x1 - x0) * (i / steps);
        const py0 = y0 + (y1 - y0) * (i / steps);
        if (!branch) px(ctx, px0 - 1, py0, "#7fa8ff");
        px(ctx, px0, py0, branch ? "#b8d0ff" : "#ffffff");
      }
    }
  }
  var storm_default = {
    id: "storm",
    name: "Thunder Peak",
    create() {
      const sky = layer();
      ditherGradient(sky.ctx, 0, 0, W, H, ["#06080e", "#0b0f19", "#121827", "#1a2234", "#232d42"]);
      const cloudsFar = layer(W * 2, 80);
      const cloudsNear = layer(W * 2, 70);
      const cr = rng(33);
      for (let i = 0; i < 14; i++) cloud(cloudsFar.ctx, cr() * W * 2, 10 + cr() * 50, 7 + cr() * 8, "#1f2638", "#161b29", 700 + i);
      for (let i = 0; i < 10; i++) cloud(cloudsNear.ctx, cr() * W * 2, 4 + cr() * 30, 9 + cr() * 9, "#2a3246", "#1c2231", 800 + i);
      const far = layer();
      peaks(far.ctx, 2, 128, 46, "#161c2b", "#7c889f");
      const lit = layer();
      peaks(lit.ctx, 2, 128, 46, "#39456a", "#dfe6f5");
      const near = layer();
      const nearTop = peaks(near.ctx, 9, 162, 38, "#0a0d15", "#3a4458");
      const r = rng(5);
      const drops = Array.from({ length: 260 }, () => ({
        x: r() * (W + 80),
        y: r() * H,
        speed: 230 + r() * 120,
        len: 4 + Math.floor(r() * 5)
      }));
      return {
        draw(ctx, t) {
          ctx.drawImage(sky.canvas, 0, 0);
          const fx = Math.round(wrap(t * 9, W * 2));
          ctx.drawImage(cloudsFar.canvas, -fx, 0);
          ctx.drawImage(cloudsFar.canvas, W * 2 - fx, 0);
          const n = Math.floor(t / FLASH_EVERY);
          const local = t - n * FLASH_EVERY;
          const offset = rng(n)() * 1.2;
          const since = local - offset;
          const flash = since >= 0 && since < 0.45 ? (1 - since / 0.45) * (Math.sin(since * 60) > -0.3 ? 1 : 0.4) : 0;
          ctx.drawImage(far.canvas, 0, 0);
          if (flash > 0) {
            ctx.globalAlpha = flash * 0.8;
            ctx.drawImage(lit.canvas, 0, 0);
            ctx.globalAlpha = 1;
            if (since < 0.25) bolt(ctx, n * 7 + 1, nearTop[160] - 20);
          }
          const nx = Math.round(wrap(t * 16, W * 2));
          ctx.drawImage(cloudsNear.canvas, -nx, 0);
          ctx.drawImage(cloudsNear.canvas, W * 2 - nx, 0);
          ctx.drawImage(near.canvas, 0, 0);
          ctx.fillStyle = "rgba(160, 182, 214, 0.42)";
          for (const d of drops) {
            const y = wrap(d.y + t * d.speed, H + 10) - 5;
            const x = wrap(d.x - y * 0.45 - t * 30, W + 80) - 40;
            for (let k = 0; k < d.len; k++) ctx.fillRect(Math.round(x + k * 0.45), Math.round(y - k), 1, 1);
          }
          if (flash > 0) {
            ctx.fillStyle = `rgba(200, 220, 255, ${flash * 0.3})`;
            ctx.fillRect(0, 0, W, H);
          }
        }
      };
    }
  };

  // js/scenes/blocks.js
  var CELL = 8;
  var STACK_COLS = 9;
  var STACK_ROWS = 14;
  var LETTERS = Object.keys(SHAPES);
  var cache2 = /* @__PURE__ */ new Map();
  function sprites(p) {
    if (!cache2.has(`s${p}`)) {
      const out = {};
      for (const kind of ["light", "dark", "ring"]) {
        const c = layer(CELL, CELL);
        paintNesBlock(c.ctx, 0, 0, CELL, kind, NES_PALETTES[p]);
        out[kind] = c.canvas;
      }
      cache2.set(`s${p}`, out);
    }
    return cache2.get(`s${p}`);
  }
  function dim(hex, k) {
    const [r, g, b] = parseColor(hex);
    return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
  }
  function buildStack(seed, pieces) {
    const r = rng(seed);
    const board = Array.from({ length: STACK_ROWS }, () => new Array(STACK_COLS).fill(null));
    const fits = (m, x, y) => m.every((row, dy) => row.every((v, dx) => {
      if (!v) return true;
      const bx = x + dx;
      const by = y + dy;
      return bx >= 0 && bx < STACK_COLS && by < STACK_ROWS && (by < 0 || !board[by][bx]);
    }));
    for (let i = 0; i < pieces; i++) {
      const letter = LETTERS[Math.floor(r() * LETTERS.length)];
      let m = SHAPES[letter].matrix;
      for (let k = Math.floor(r() * 4); k > 0; k--) m = rotateMatrix(m, 1);
      const x = Math.floor(r() * (STACK_COLS - m[0].length + 1));
      let y = -m.length;
      if (!fits(m, x, y)) continue;
      while (fits(m, x, y + 1)) y++;
      m.forEach((row, dy) => row.forEach((v, dx) => {
        if (v && y + dy >= 0) board[y + dy][x + dx] = letter;
      }));
    }
    return board;
  }
  function buildLayer(p, stacks) {
    const l = layer();
    const ctx = l.ctx;
    const [light, dark] = NES_PALETTES[p];
    rect(ctx, 0, 0, W, H, "#000000");
    const dot = dim(dark, 0.42);
    const faint = dim(light, 0.16);
    for (let row = 0; row * CELL < H; row++) {
      for (let col = 0; col * CELL < W; col++) {
        const ox = col * CELL + (row % 2 ? 4 : 0);
        rect(ctx, ox + 2, row * CELL + 3, 2, 2, dot);
        if ((row + col) % 5 === 0) rect(ctx, ox + 3, row * CELL + 2, 1, 4, faint);
      }
    }
    const shade2 = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
    shade2.addColorStop(0, "rgba(0,0,0,0)");
    shade2.addColorStop(0.5, "rgba(0,0,0,0.55)");
    shade2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade2;
    ctx.fillRect(0, 0, W, H);
    const s = sprites(p);
    stacks.forEach(({ board, x }) => {
      board.forEach((row, ry) => row.forEach((letter, rx) => {
        if (!letter) return;
        ctx.drawImage(s[NES_BLOCK_KIND[letter]], x + rx * CELL, H - (STACK_ROWS - ry) * CELL);
      }));
    });
    return l.canvas;
  }
  var blocks_default = {
    id: "blocks",
    name: "Retro Blocks",
    create() {
      const stacks = [
        { board: buildStack(5, 34), x: 0 },
        { board: buildStack(12, 34), x: W - STACK_COLS * CELL }
      ];
      const r = rng(91);
      const rows = Math.ceil(H / CELL) + 6;
      const fallers = Array.from({ length: 12 }, (_, i) => ({
        letter: LETTERS[i % LETTERS.length],
        x: Math.floor(r() * (W / CELL - 4)) * CELL,
        speed: 0.9 + r() * 1.8,
        phase: r() * rows,
        turn: 0.25 + r() * 0.35,
        spin: Math.floor(r() * 4)
      }));
      const layers = [];
      return {
        draw(ctx, t, { level = 0 } = {}) {
          const p = (level % NES_PALETTES.length + NES_PALETTES.length) % NES_PALETTES.length;
          if (!layers[p]) layers[p] = buildLayer(p, stacks);
          ctx.drawImage(layers[p], 0, 0);
          const s = sprites(p);
          for (const f of fallers) {
            const step = Math.floor(f.phase + t * f.speed);
            const y = step % rows * CELL - 4 * CELL;
            let m = SHAPES[f.letter].matrix;
            for (let k = (f.spin + Math.floor(step * f.turn)) % 4; k > 0; k--) m = rotateMatrix(m, 1);
            const sprite = s[NES_BLOCK_KIND[f.letter]];
            m.forEach((row, ry) => row.forEach((v, rx) => {
              if (v) ctx.drawImage(sprite, f.x + rx * CELL, y + ry * CELL);
            }));
          }
        }
      };
    }
  };

  // js/scenes/ulol.js
  var HORIZON4 = 140;
  var LETTERS2 = Object.keys(SHAPES);
  var TEAL = "#5ee8c8";
  function buildStack2(seed, cols, rows, pieces) {
    const r = rng(seed);
    const board = Array.from({ length: rows }, () => new Array(cols).fill(null));
    const fits = (m, x, y) => m.every((row, dy) => row.every((v, dx) => {
      if (!v) return true;
      const bx = x + dx;
      const by = y + dy;
      return bx >= 0 && bx < cols && by < rows && (by < 0 || !board[by][bx]);
    }));
    for (let i = 0; i < pieces; i++) {
      const letter = LETTERS2[Math.floor(r() * LETTERS2.length)];
      let m = SHAPES[letter].matrix;
      for (let k = Math.floor(r() * 4); k > 0; k--) m = rotateMatrix(m, 1);
      const x = Math.floor(r() * (cols - m[0].length + 1));
      let y = -m.length;
      if (!fits(m, x, y)) continue;
      while (fits(m, x, y + 1)) y++;
      m.forEach((row, dy) => row.forEach((v, dx) => {
        if (v && y + dy >= 0) board[y + dy][x + dx] = letter;
      }));
    }
    return board;
  }
  function paintStack(ctx, board, x, cell, haze, hazeColor) {
    const tmp = layer();
    board.forEach((row, ry) => row.forEach((letter, rx) => {
      if (!letter) return;
      tmp.ctx.drawImage(blockSprite("ulol", SHAPES[letter].color, cell), x + rx * cell, HORIZON4 - (board.length - ry) * cell);
    }));
    tmp.ctx.globalCompositeOperation = "source-atop";
    tmp.ctx.globalAlpha = haze;
    tmp.ctx.fillStyle = hazeColor;
    tmp.ctx.fillRect(0, 0, W, H);
    ctx.drawImage(tmp.canvas, 0, 0);
  }
  var ulol_default = {
    id: "ulol",
    name: "ulol Night",
    create() {
      const base = layer();
      const b = base.ctx;
      ditherGradient(b, 0, 0, W, HORIZON4, ["#04040b", "#080819", "#10103a", "#1c1160", "#32177a", "#4f2488"]);
      glow(b, 38, 30, 28, "#1b5a66", 0.6);
      disc(b, 38, 30, 12, "#d8fff4");
      disc(b, 41, 27, 10, "#9af3dc");
      disc(b, 35, 32, 2, "#7fdcc4");
      glow(b, 284, 38, 20, "#5a2a7a", 0.6);
      disc(b, 284, 38, 7, "#f0c8f8");
      disc(b, 286, 36, 5, "#d99ae8");
      glow(b, 160, HORIZON4, 70, "#4d2a80", 0.45);
      paintStack(b, buildStack2(31, 64, 9, 110), 0, 5, 0.74, "#3a1f78");
      paintStack(b, buildStack2(37, 12, 11, 34), -4, 8, 0.5, "#2a1a68");
      paintStack(b, buildStack2(41, 12, 11, 34), W - 92, 8, 0.5, "#2a1a68");
      paintStack(b, buildStack2(53, 8, 8, 17), 2, 10, 0.2, "#1a1050");
      paintStack(b, buildStack2(59, 8, 8, 17), W - 82, 10, 0.2, "#1a1050");
      const strip = 48;
      const mirror = layer(W, strip);
      mirror.ctx.save();
      mirror.ctx.translate(0, strip);
      mirror.ctx.scale(1, -1);
      mirror.ctx.drawImage(base.canvas, 0, HORIZON4 - strip, W, strip, 0, 0, W, strip);
      mirror.ctx.restore();
      ditherGradient(b, 0, HORIZON4, W, H - HORIZON4, ["#0d0a2a", "#080620", "#05040f"]);
      rect(b, 0, HORIZON4, W, 1, TEAL);
      const r = rng(7);
      const stars = Array.from({ length: 80 }, () => ({
        x: Math.floor(r() * W),
        y: Math.floor(r() * (HORIZON4 - 40)),
        p: r() * 6,
        c: ["#ffffff", TEAL, "#d9b8ff"][Math.floor(r() * 3)]
      }));
      const lanterns = Array.from({ length: 9 }, () => {
        const letter = LETTERS2[Math.floor(r() * LETTERS2.length)];
        let matrix = SHAPES[letter].matrix;
        for (let k = Math.floor(r() * 4); k > 0; k--) matrix = rotateMatrix(matrix, 1);
        return {
          letter,
          matrix,
          cell: r() < 0.5 ? 5 : 6,
          x: 14 + r() * (W - 60),
          y: r() * H,
          speed: 5 + r() * 7,
          p: r() * 6
        };
      });
      const glints = [{ x: 38, c: "#b6fff0" }, { x: 284, c: "#f0b8ff" }];
      return {
        draw(ctx, t) {
          ctx.drawImage(base.canvas, 0, 0);
          for (const s of stars) if (Math.sin(t * 1.6 + s.p) > -0.2) px(ctx, s.x, s.y, s.c);
          for (let i = 0; i < strip; i += 2) {
            ctx.globalAlpha = 0.5 * (1 - i / strip);
            const dx = Math.round(Math.sin(t * 1.3 + i * 0.55) * (1 + i * 0.05));
            ctx.drawImage(mirror.canvas, 0, i, W, 2, dx, HORIZON4 + 1 + i, W, 2);
          }
          ctx.globalAlpha = 1;
          for (const g of glints) {
            for (let i = 0; i < 9; i++) {
              const y = HORIZON4 + 3 + i * 4 + Math.round(Math.sin(t * 2 + i + g.x) * 1.2);
              const half = 6 - Math.floor(i / 2) + Math.round(Math.sin(t * 3 + i * 2) * 1.5);
              ctx.globalAlpha = 0.65 - i * 0.06;
              rect(ctx, g.x - half, y, half * 2, 1, g.c);
            }
          }
          ctx.globalAlpha = 1;
          for (const l of lanterns) {
            const y = H + 30 - wrap(t * l.speed + l.p * 40, H + 60);
            const x = l.x + Math.sin(t * 0.4 + l.p) * 5;
            const fade = Math.min(1, (H - y) / 40, y / 50 + 0.2);
            if (fade <= 0) continue;
            const w = l.matrix[0].length * l.cell;
            ctx.globalAlpha = 0.4 * fade;
            glow(ctx, Math.round(x + w / 2), Math.round(y + w / 2), 14, SHAPES[l.letter].color, 0.5);
            ctx.globalAlpha = Math.max(0, fade);
            const sprite = blockSprite("ulol", SHAPES[l.letter].color, l.cell);
            l.matrix.forEach((row, ry) => row.forEach((v, rx) => {
              if (v) ctx.drawImage(sprite, Math.round(x + rx * l.cell), Math.round(y + ry * l.cell));
            }));
          }
          ctx.globalAlpha = 1;
        }
      };
    }
  };

  // js/scenes/domes.js
  var GROUND2 = 146;
  var BRICK = "#9c2f3b";
  var BRICK_DARK = "#76222f";
  var BRICK_LIGHT = "#b8454a";
  var CREAM = "#ecdcc0";
  var CREAM_DARK = "#c3ae8e";
  var GOLD = "#f3c94a";
  var GOLD_DARK = "#b8801f";
  var OUTLINE = "#2a1226";
  var WINDOW = "#ffd978";
  var SNOW = "#eef3ff";
  function mix(hex, k) {
    const [r, g, b] = parseColor(hex);
    const t = k > 0 ? 255 : 0;
    const f = Math.abs(k);
    const c = (v) => Math.round(v + (t - v) * f);
    return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
  }
  function onion(ctx, cx, baseY, r, height, a, b, pattern) {
    for (let i = 0; i < height; i++) {
      const u = i / (height - 1);
      const swell = u < 0.28 ? 0.5 + 0.5 * Math.sin(u / 0.28 * Math.PI / 2) : Math.pow(Math.cos((u - 0.28) / 0.72 * Math.PI / 2), 1.3);
      const hw = Math.max(i === height - 1 ? 0 : 1, Math.round(r * swell));
      for (let x = -hw; x <= hw; x++) {
        const side = hw ? x / hw : 0;
        let c = pattern(x, i, side, u) ? a : b;
        if (x === -hw || x === hw) c = OUTLINE;
        else if (side < -0.4) c = mix(c, 0.25);
        else if (side > 0.5) c = mix(c, -0.3);
        px(ctx, cx + x, baseY - i, c);
      }
    }
    const top = baseY - height;
    rect(ctx, cx - 1, top - 1, 3, 2, GOLD);
    rect(ctx, cx, top - 6, 1, 6, GOLD);
    rect(ctx, cx - 2, top - 4, 5, 1, GOLD);
    px(ctx, cx - 1, top - 1, GOLD_DARK);
  }
  var PATTERNS = {
    stripes: (x, i) => (x + i + 40) % 5 < 3,
    diamonds: (x, i) => (x + i + 60) % 6 < 3 === (x - i + 60) % 6 < 3,
    ribs: (x, i, side) => Math.floor((side + 1) * 3) % 2 === 0,
    spiral: (x, i, side, u) => ((side * 1.6 + u * 4) % 1 + 1) % 1 < 0.5
  };
  function drum(ctx, cx, top, h, w, lights) {
    rect(ctx, cx - w, top, w * 2 + 1, h, CREAM);
    rect(ctx, cx + w - 1, top, 2, h, CREAM_DARK);
    rect(ctx, cx - w, top, w * 2 + 1, 1, GOLD);
    for (let x = cx - w + 2; x < cx + w - 1; x += 4) {
      rect(ctx, x, top + 2, 1, h - 3, "#3a1c28");
      lights.push({ x, y: top + 2, w: 1, h: h - 3 });
    }
  }
  function wall(ctx, x, y, w, h) {
    rect(ctx, x, y, w, h, BRICK);
    for (let row = y + 3, n = 0; row < y + h; row += 3, n++) {
      rect(ctx, x, row, w, 1, BRICK_DARK);
      for (let bx = x + (n % 2 ? 2 : 5); bx < x + w; bx += 6) px(ctx, bx, row - 1, BRICK_DARK);
    }
    rect(ctx, x, y, 1, h, BRICK_LIGHT);
    rect(ctx, x + w - 1, y, 1, h, BRICK_DARK);
    rect(ctx, x - 1, y, w + 2, 3, CREAM);
    rect(ctx, x - 1, y + 3, w + 2, 1, CREAM_DARK);
    for (let ax = x + 1; ax + 4 <= x + w; ax += 5) {
      rect(ctx, ax, y - 2, 4, 2, CREAM);
      rect(ctx, ax + 1, y - 3, 2, 1, CREAM);
    }
  }
  function windowArch(ctx, x, y, color) {
    rect(ctx, x - 1, y, 5, 7, "#3a1420");
    rect(ctx, x, y + 2, 3, 4, color);
    px(ctx, x + 1, y + 1, color);
  }
  function tent(ctx, cx, baseY, w, h) {
    for (let i = 0; i < h; i++) {
      const k = i / h;
      const hw = Math.max(1, Math.round(w / 2 * Math.pow(1 - k, 1.15)));
      for (let x = -hw; x <= hw; x++) {
        let c = BRICK;
        const rib = Math.abs(x) <= 0 || Math.abs(x) === Math.round(hw * 0.55);
        if (rib) c = CREAM;
        if (x === -hw) c = BRICK_LIGHT;
        else if (x === hw) c = BRICK_DARK;
        else if (x > hw * 0.4 && !rib) c = BRICK_DARK;
        if (i % 11 === 10) c = CREAM_DARK;
        px(ctx, cx + x, baseY - i, c);
      }
    }
  }
  function fir(ctx, x, baseY, h, color, snow) {
    for (let i = 0; i < h; i++) {
      const hw = Math.round((1 - i / h) * (h / 3.2)) + (i % 5 === 0 ? 1 : 0);
      rect(ctx, x - hw, baseY - i, hw * 2 + 1, 1, color);
      if (i % 5 === 3 && hw > 1) {
        rect(ctx, x - hw, baseY - i, Math.max(1, Math.floor(hw / 2)), 1, snow);
      }
    }
    rect(ctx, x, baseY, 1, 3, "#3a2418");
  }
  function lamp(ctx, x) {
    rect(ctx, x, GROUND2 - 22, 1, 22, "#241a30");
    rect(ctx, x - 1, GROUND2 - 25, 3, 3, "#ffe9a8");
    rect(ctx, x - 2, GROUND2 - 26, 5, 1, "#241a30");
  }
  var domes_default = {
    id: "domes",
    name: "Snow Domes",
    create() {
      const sky = layer();
      const s = sky.ctx;
      ditherGradient(s, 0, 0, W, GROUND2, ["#080a24", "#12154a", "#262a72", "#4b3a88", "#86498a", "#c46472", "#eb9a6c"]);
      glow(s, 252, 40, 24, "#3b3f86", 0.55);
      disc(s, 252, 40, 8, "#f4f6ff");
      disc(s, 255, 38, 6, "#dfe4fa");
      glow(s, 160, GROUND2 - 4, 90, "#d6806c", 0.4);
      const land = layer();
      const l = land.ctx;
      const lights = [];
      rect(l, 0, GROUND2 - 17, W, 17, "#4a3478");
      for (let cx = 0; cx < W; cx += 6) rect(l, cx, GROUND2 - 20, 3, 3, "#4a3478");
      for (const tx of [118, 150, 190, 214]) {
        rect(l, tx - 4, GROUND2 - 38, 9, 38, "#3e2b6c");
        for (let i = 0; i < 10; i++) rect(l, tx - 5 + Math.floor(i / 2), GROUND2 - 39 - i, 11 - Math.floor(i / 2) * 2, 1, "#523a86");
      }
      wall(l, 4, 120, 96, GROUND2 - 120);
      wall(l, 20, 106, 64, 14);
      for (const wx of [14, 28, 42, 62, 76, 90]) {
        windowArch(l, wx, 129, WINDOW);
        lights.push({ x: wx, y: 131, w: 3, h: 4 });
      }
      for (const wx of [30, 40, 60, 70]) {
        windowArch(l, wx - 1, 111, WINDOW);
        lights.push({ x: wx - 1, y: 113, w: 3, h: 4 });
      }
      drum(l, 30, 99, 7, 5, lights);
      onion(l, 30, 99, 7, 17, "#3a6fd0", "#f2f2ff", PATTERNS.spiral);
      drum(l, 74, 99, 7, 5, lights);
      onion(l, 74, 99, 7, 17, "#e8892e", "#ffd84a", PATTERNS.ribs);
      tent(l, 52, 106, 26, 58);
      rect(l, 47, 106, 11, 2, CREAM);
      onion(l, 52, 47, 4, 10, GOLD, GOLD_DARK, PATTERNS.ribs);
      drum(l, 14, 114, 6, 5, lights);
      onion(l, 14, 114, 8, 19, "#2f9e5a", "#e8f2d0", PATTERNS.stripes);
      drum(l, 88, 114, 6, 5, lights);
      onion(l, 88, 114, 8, 19, "#d6453d", "#f3c94a", PATTERNS.diamonds);
      wall(l, 236, 120, 32, GROUND2 - 120);
      for (const wx of [242, 252, 262]) {
        windowArch(l, wx, 129, WINDOW);
        lights.push({ x: wx, y: 131, w: 3, h: 4 });
      }
      drum(l, 245, 114, 6, 4, lights);
      onion(l, 245, 114, 6, 14, "#cc3b44", "#f4f0e0", PATTERNS.stripes);
      drum(l, 259, 114, 6, 4, lights);
      onion(l, 259, 114, 6, 14, "#2c8f6a", "#f4f0e0", PATTERNS.stripes);
      wall(l, 276, 74, 20, GROUND2 - 74);
      for (let wy = 84; wy < 130; wy += 14) {
        windowArch(l, 285, wy, WINDOW);
        lights.push({ x: 285, y: wy + 2, w: 3, h: 4 });
      }
      for (const wx of [279, 291]) {
        rect(l, wx - 1, 74, 4, 8, "#2b1424");
      }
      drum(l, 286, 67, 7, 6, lights);
      onion(l, 286, 67, 8, 19, "#2c5fb8", "#f3c94a", PATTERNS.ribs);
      for (const [x, y, w] of [[3, 117, 98], [19, 103, 66], [235, 117, 34], [275, 71, 22]]) {
        for (let i = 0; i < w; i++) if (i * 7 % 5 !== 0) px(l, x + i, y, SNOW);
      }
      const tr = rng(21);
      for (const tx of [108, 226, 272, 304, 312]) fir(l, tx, GROUND2 + 2, 18 + Math.floor(tr() * 6), "#173a4a", "#dfeaff");
      fir(l, 106, GROUND2 + 3, 12, "#1d4756", "#dfeaff");
      lamp(l, 100);
      lamp(l, 232);
      ditherGradient(l, 0, GROUND2, W, H - GROUND2, ["#dfe6fa", "#b9c5e8", "#8f9cd2", "#6b76b4"]);
      for (let x = 0; x < W; x++) {
        const y = GROUND2 + Math.round(Math.sin(x * 0.09) * 1.5 + Math.sin(x * 0.31) * 0.7);
        rect(l, x, y - 1, 1, 2, "#f4f7ff");
      }
      for (const [sx, sw] of [[4, 96], [236, 32], [276, 20]]) rect(l, sx, GROUND2 + 1, sw, 2, "#aab6e0");
      const r = rng(8);
      const stars = Array.from({ length: 70 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * 80), p: r() * 6 }));
      const sparkles = Array.from({ length: 36 }, () => ({
        x: Math.floor(r() * W),
        y: GROUND2 + 3 + Math.floor(r() * (H - GROUND2 - 4)),
        p: r() * 6
      }));
      const flakes = Array.from({ length: 90 }, (_, i) => ({
        x: r() * W,
        y: r() * H,
        depth: i % 3,
        p: r() * 6
      }));
      return {
        draw(ctx, t) {
          ctx.drawImage(sky.canvas, 0, 0);
          for (const st of stars) if (Math.sin(t * 1.4 + st.p) > -0.3) px(ctx, st.x, st.y, "#e4e8ff");
          ctx.drawImage(land.canvas, 0, 0);
          for (const w of lights) {
            if (Math.sin(t * 0.6 + w.x * 1.7 + w.y) > 0.985) rect(ctx, w.x, w.y, w.w, w.h, "#3a1420");
          }
          for (const sp of sparkles) if (Math.sin(t * 2.2 + sp.p) > 0.8) px(ctx, sp.x, sp.y, "#ffffff");
          glow(ctx, 100, GROUND2 - 24, 12, "#ffd27a", 0.35 + Math.sin(t * 5) * 0.03);
          glow(ctx, 232, GROUND2 - 24, 12, "#ffd27a", 0.35 + Math.sin(t * 5 + 2) * 0.03);
          for (const f of flakes) {
            const speed = 9 + f.depth * 9;
            const y = wrap(f.y + t * speed, H + 4) - 2;
            const x = wrap(f.x + Math.sin(t * 0.8 + f.p) * 6 + t * (2 + f.depth), W);
            ctx.globalAlpha = 0.45 + f.depth * 0.25;
            if (f.depth === 2) rect(ctx, x, y, 2, 2, "#ffffff");
            else px(ctx, x, y, "#ffffff");
          }
          ctx.globalAlpha = 1;
        }
      };
    }
  };

  // js/background.js
  var SCENES = { bamboo: bamboo_default, wheat: wheat_default, village: village_default, castle: castle_default, ocean: ocean_default, neon: neon_default, city: city_default, storm: storm_default, blocks: blocks_default, ulol: ulol_default, domes: domes_default };
  var CASUAL_SCENES = ["bamboo", "wheat", "village", "castle", "ocean", "neon"];
  var CLASSIC_SCENES = ["blocks", "ulol", "domes"];
  var MODE_SCENES = { sprint: "city", blitz: "storm" };
  var FADE_S = 1.6;
  var FRAME_MS2 = 1e3 / 30;
  var MENU_CYCLE_S = 16;
  function describeScene(id) {
    return id === "cycle" ? "Cycle by level" : SCENES[id]?.name || id;
  }
  function createBackground(canvas, layerEl, settings2) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const fadeCanvas = document.createElement("canvas");
    fadeCanvas.width = W;
    fadeCanvas.height = H;
    const fadeCtx = fadeCanvas.getContext("2d");
    const instances = /* @__PURE__ */ new Map();
    let current = null;
    let previous = null;
    let fadeStart = 0;
    let level = 0;
    let menuCycle = false;
    let menuIndex = 0;
    let menuSince = 0;
    let lastDraw = 0;
    const start = performance.now();
    function instance(id) {
      if (!instances.has(id)) instances.set(id, SCENES[id].create());
      return instances.get(id);
    }
    function fit() {
      const scale = Math.max(window.innerWidth / W, window.innerHeight / H);
      canvas.style.width = `${Math.ceil(W * scale)}px`;
      canvas.style.height = `${Math.ceil(H * scale)}px`;
    }
    function show(id) {
      if (!SCENES[id] || id === current) return;
      previous = current;
      current = id;
      fadeStart = (performance.now() - start) / 1e3;
    }
    function casualScene(level2) {
      const pick = settings2.casualScene || "cycle";
      if (pick !== "cycle" && SCENES[pick]) return pick;
      return CASUAL_SCENES[(Math.max(1, level2) - 1) % CASUAL_SCENES.length];
    }
    function classicScene(level2) {
      const pick = settings2.classicScene || "cycle";
      if (pick !== "cycle" && SCENES[pick]) return pick;
      return CLASSIC_SCENES[Math.max(0, level2) % CLASSIC_SCENES.length];
    }
    function frame(now) {
      requestAnimationFrame(frame);
      const mode = settings2.background || "on";
      layerEl.classList.toggle("bg-dim", mode === "dim");
      layerEl.classList.toggle("bg-off", mode === "off");
      if (mode === "off" || document.hidden || !current) return;
      if (now - lastDraw < FRAME_MS2 - 2) return;
      lastDraw = now;
      const t = (now - start) / 1e3;
      if (menuCycle && t - menuSince > MENU_CYCLE_S) {
        menuSince = t;
        menuIndex = (menuIndex + 1) % CASUAL_SCENES.length;
        show(CASUAL_SCENES[menuIndex]);
      }
      instance(current).draw(ctx, t, { level });
      const k = (t - fadeStart) / FADE_S;
      if (previous && k < 1) {
        instance(previous).draw(fadeCtx, t, { level });
        ctx.globalAlpha = 1 - k;
        ctx.drawImage(fadeCanvas, 0, 0);
        ctx.globalAlpha = 1;
      } else {
        previous = null;
      }
    }
    window.addEventListener("resize", fit);
    fit();
    requestAnimationFrame(frame);
    return {
      /** Menu: slowly cycle through the Casual scenes. */
      showMenu() {
        menuCycle = true;
        menuSince = (performance.now() - start) / 1e3;
        show(CASUAL_SCENES[menuIndex]);
      },
      /** A game started: pick the scene for its mode (and the start level, in Classic). */
      showMode(modeId, startLevel = 1) {
        menuCycle = false;
        level = startLevel;
        show(modeId === "og" ? classicScene(level) : MODE_SCENES[modeId] || casualScene(level));
      },
      /** Level changed in Casual or Classic: move to the next scene in the cycle. */
      onLevel(modeId, newLevel) {
        level = newLevel;
        if (modeId === "og") show(classicScene(level));
        else if (!MODE_SCENES[modeId]) show(casualScene(level));
      }
    };
  }

  // js/chip.js
  var cache3 = /* @__PURE__ */ new WeakMap();
  function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function pulseWave(ctx, duty) {
    let byDuty = cache3.get(ctx);
    if (!byDuty) {
      byDuty = /* @__PURE__ */ new Map();
      cache3.set(ctx, byDuty);
    }
    let wave = byDuty.get(duty);
    if (!wave) {
      const harmonics = 48;
      const real = new Float32Array(harmonics + 1);
      const imag = new Float32Array(harmonics + 1);
      for (let n = 1; n <= harmonics; n++) {
        real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
        imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
      }
      wave = ctx.createPeriodicWave(real, imag);
      byDuty.set(duty, wave);
    }
    return wave;
  }

  // js/sound.js
  function createSoundEngine(settingsRef) {
    let ctx = null;
    let masterGain = null;
    let noiseBuffer = null;
    let packOverride = null;
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
    function blip(freq, type, t, len, peak, bendTo) {
      const { osc } = playTone(freq, type, t, len + 0.02, (g, time) => {
        g.setValueAtTime(0, time);
        g.linearRampToValueAtTime(peak, time + 4e-3);
        g.exponentialRampToValueAtTime(1e-3, time + len);
      });
      if (bendTo) osc.frequency.exponentialRampToValueAtTime(bendTo, t + len);
    }
    function thump(t, from, to, len, peak) {
      blip(from, "sine", t, len, peak, to);
    }
    const CHIP_LIFT = 2.4;
    function chip(midi, t, len, peakIn, duty = 0.5, bendTo = null) {
      const peak = peakIn * CHIP_LIFT;
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(pulseWave(ctx, duty));
      const from = midiToHz(midi);
      osc.frequency.setValueAtTime(from, t);
      if (bendTo !== null) {
        const steps = 6;
        for (let i = 1; i <= steps; i++) {
          osc.frequency.setValueAtTime(from + (midiToHz(bendTo) - from) * (i / steps), t + len * i / steps);
        }
      }
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(peak, t);
      gain.gain.setValueAtTime(peak * 0.65, t + len * 0.5);
      gain.gain.setValueAtTime(peak * 0.35, t + len * 0.8);
      gain.gain.setValueAtTime(0, t + len);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(t);
      osc.stop(t + len + 0.01);
      osc.onended = () => gain.disconnect();
    }
    function chipTri(midi, t, len, peak, bendTo = midi) {
      const { osc } = playTone(midiToHz(midi), "triangle", t, len + 0.02, (g, time) => {
        g.setValueAtTime(peak, time);
        g.exponentialRampToValueAtTime(1e-3, time + len);
      });
      osc.frequency.exponentialRampToValueAtTime(midiToHz(bendTo), t + len);
    }
    function chipNoise(t, len, peak, type, from, to = from) {
      playNoise(t, len + 0.01, (g, time) => {
        g.setValueAtTime(peak, time);
        g.setValueAtTime(peak * 0.55, time + len * 0.4);
        g.setValueAtTime(peak * 0.25, time + len * 0.75);
        g.setValueAtTime(0, time + len);
      }, (f, time) => {
        f.type = type;
        f.frequency.setValueAtTime(from, time);
        f.frequency.linearRampToValueAtTime(to, time + len);
      });
    }
    function chipRun(midis, t, gap, len, peak, duty) {
      midis.forEach((m, i) => chip(m, t + i * gap, len, peak, duty));
    }
    const semitone = (base, n) => base * Math.pow(2, n / 12);
    const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    const PACKS = {
      nes: {
        move: (t) => chip(57, t, 0.03, 0.12, 0.25),
        rotate: (t) => chip(72, t, 0.035, 0.13, 0.25, 76),
        softdrop: (t) => chip(52, t, 0.02, 0.09, 0.5),
        harddrop: (t) => {
          chipTri(50, t, 0.12, 0.7, 30);
          chipNoise(t, 0.06, 0.2, "lowpass", 1800);
        },
        lock: (t) => {
          chipTri(46, t, 0.09, 0.7, 36);
          chipNoise(t, 0.03, 0.12, "lowpass", 1200);
        },
        hold: (t) => chipRun([72, 79], t, 0.04, 0.04, 0.1, 0.25),
        clear1: (t) => {
          chipNoise(t, 0.12, 0.1, "bandpass", 3e3, 700);
          chipRun([72, 76, 79], t, 0.05, 0.06, 0.12, 0.5);
        },
        clear2: (t) => {
          chipNoise(t, 0.14, 0.1, "bandpass", 3e3, 700);
          chipRun([72, 76, 79, 84], t, 0.05, 0.06, 0.12, 0.5);
        },
        clear3: (t) => {
          chipNoise(t, 0.16, 0.1, "bandpass", 3e3, 700);
          chipRun([72, 76, 79, 84, 88], t, 0.05, 0.06, 0.12, 0.5);
        },
        clear4: (t) => {
          chipNoise(t, 0.3, 0.14, "bandpass", 4e3, 500);
          chipRun([60, 64, 67, 72, 76, 79, 84, 88, 91, 96], t, 0.045, 0.06, 0.12, 0.25);
          chip(96, t + 0.47, 0.35, 0.12, 0.25);
          chip(84, t + 0.47, 0.35, 0.1, 0.5);
          chipTri(48, t + 0.47, 0.35, 0.35);
        },
        levelUp: (t) => chipRun([76, 79, 84], t, 0.07, 0.07, 0.12, 0.5),
        gameOver: (t) => {
          chipRun([69, 67, 65, 64, 62, 60], t, 0.12, 0.11, 0.13, 0.5);
          chip(57, t + 0.72, 0.5, 0.13, 0.5, 45);
          chipTri(45, t + 0.72, 0.5, 0.35, 33);
        },
        tspin: (t) => chip(60, t, 0.14, 0.12, 0.25, 84),
        tspinClear: (t) => chipRun([67, 72, 76, 79, 84], t, 0.05, 0.07, 0.12, 0.25),
        perfectClear: (t) => {
          chipRun([72, 76, 79, 84, 79, 84, 88, 91, 96], t, 0.06, 0.08, 0.12, 0.25);
          chip(96, t + 0.54, 0.4, 0.12, 0.25);
        },
        combo: (t, n) => chip(72 + Math.min(n || 1, 16), t, 0.05, 0.1, 0.5),
        menuMove: (t) => chip(81, t, 0.02, 0.07, 0.5),
        menuSelect: (t) => chipRun([76, 88], t, 0.05, 0.06, 0.1, 0.5),
        countdownTick: (t) => chip(83, t, 0.03, 0.08, 0.5),
        countdownGo: (t) => chipRun([76, 81, 88], t, 0.06, 0.07, 0.1, 0.5)
      },
      arcade: {
        move: (t) => blip(1200, "square", t, 0.012, 0.08),
        rotate: (t) => blip(900, "square", t, 0.022, 0.08, 1300),
        softdrop: (t) => blip(800, "square", t, 8e-3, 0.05),
        harddrop: (t) => {
          thump(t, 150, 55, 0.09, 0.5);
          playNoise(
            t,
            0.05,
            (g, time) => {
              g.setValueAtTime(0.25, time);
              g.exponentialRampToValueAtTime(0.01, time + 0.05);
            },
            (f) => {
              f.type = "lowpass";
              f.frequency.value = 1500;
            }
          );
        },
        lock: (t) => blip(420, "triangle", t, 0.025, 0.2),
        hold: (t) => {
          blip(700, "square", t, 0.03, 0.07);
          blip(1e3, "square", t + 0.03, 0.03, 0.07);
        },
        clear1: (t) => blip(523, "square", t, 0.08, 0.12),
        clear2: (t) => [523, 659].forEach((f, i) => blip(f, "square", t + i * 0.05, 0.08, 0.12)),
        clear3: (t) => [523, 659, 784].forEach((f, i) => blip(f, "square", t + i * 0.05, 0.08, 0.12)),
        clear4: (t) => [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, "square", t + i * 0.045, 0.1, 0.12)),
        tspin: (t) => blip(300, "square", t, 0.12, 0.1, 900),
        combo: (t, n) => blip(semitone(440, Math.min(n || 1, 20)), "square", t, 0.06, 0.1)
      },
      bubbly: {
        move: (t) => blip(880, "sine", t, 0.03, 0.12, 1100),
        rotate: (t) => {
          blip(600, "sine", t, 0.05, 0.16, 950);
          blip(1200, "triangle", t, 0.04, 0.05, 1900);
        },
        softdrop: (t) => blip(520, "sine", t, 0.02, 0.08),
        harddrop: (t) => {
          thump(t, 320, 90, 0.13, 0.55);
          playNoise(
            t,
            0.09,
            (g, time) => {
              g.setValueAtTime(0.18, time);
              g.exponentialRampToValueAtTime(0.01, time + 0.09);
            },
            (f) => {
              f.type = "bandpass";
              f.frequency.value = 900;
              f.Q.value = 0.8;
            }
          );
        },
        lock: (t) => blip(1300, "sine", t, 0.06, 0.2, 380),
        hold: (t) => blip(420, "sine", t, 0.09, 0.16, 1300),
        clear1: (t) => chime(t, [0, 4], 0.09),
        clear2: (t) => chime(t, [0, 4, 7], 0.08),
        clear3: (t) => chime(t, [0, 4, 7, 12], 0.07),
        clear4: (t) => {
          chime(t, [0, 4, 7, 12, 16, 19, 24], 0.055);
          for (let i = 0; i < 6; i++) blip(semitone(1568, i * 2), "sine", t + 0.35 + i * 0.03, 0.12, 0.05);
        },
        tspin: (t) => {
          blip(400, "triangle", t, 0.2, 0.12, 1600);
          blip(800, "sine", t + 0.05, 0.2, 0.08, 2400);
        },
        combo: (t, n) => {
          const step = MAJOR[Math.min((n || 1) - 1, MAJOR.length - 1)];
          bell(semitone(523, step), t, 0.35, 0.18);
        }
      }
    };
    function bell(freq, t, len, peak) {
      blip(freq, "sine", t, len, peak);
      blip(freq * 2, "sine", t, len * 0.6, peak * 0.3);
    }
    function chime(t, steps, gap) {
      steps.forEach((st, i) => bell(semitone(523, st), t + i * gap, 0.4, 0.16));
    }
    function play(eventName, comboCount) {
      init();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const vol = updateVolume();
      if (vol === 0) return;
      const t = ctx.currentTime;
      const pack = PACKS[packOverride || settingsRef.soundPack];
      if (pack && pack[eventName]) {
        pack[eventName](t, comboCount);
        return;
      }
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
        case "danger":
          [[988, 0], [740, 0.11]].forEach(([freq, offset]) => {
            playTone(freq, "square", t + offset, 0.09, (g, time) => {
              g.setValueAtTime(0.12, time);
              g.linearRampToValueAtTime(0.1, time + 0.07);
              g.linearRampToValueAtTime(0, time + 0.09);
            });
          });
          break;
        case "attack": {
          const lines = Math.min(comboCount || 1, 10);
          playNoise(t, 0.35, (g, time) => {
            g.setValueAtTime(0, time);
            g.linearRampToValueAtTime(0.25 + lines * 0.03, time + 0.05);
            g.exponentialRampToValueAtTime(0.01, time + 0.35);
          }, (f, time) => {
            f.type = "bandpass";
            f.Q.value = 2;
            f.frequency.setValueAtTime(400, time);
            f.frequency.exponentialRampToValueAtTime(2500 + lines * 300, time + 0.3);
          });
          playTone(220, "sawtooth", t, 0.3, (g, time) => {
            g.setValueAtTime(0.08, time);
            g.exponentialRampToValueAtTime(5e-3, time + 0.3);
          }).osc.frequency.exponentialRampToValueAtTime(880, t + 0.3);
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
    function setPack(name) {
      packOverride = name && PACKS[name] ? name : null;
    }
    return {
      play,
      setPack,
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
      const rect2 = elements.progressFill.parentElement.getBoundingClientRect();
      const pos = (e.clientX - rect2.left) / rect2.width;
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
      isPlaying: () => state.isPlaying,
      dispose
    };
  }

  // js/tracks.js
  var A4 = 69;
  var B4 = 71;
  var C5 = 72;
  var D5 = 74;
  var E5 = 76;
  var F5 = 77;
  var G5 = 79;
  var A5 = 81;
  var Gs4 = 68;
  var Gs5 = 80;
  var MELODY_A = [
    [[E5, 0, 4], [B4, 4, 2], [C5, 6, 2], [D5, 8, 4], [C5, 12, 2], [B4, 14, 2]],
    [[A4, 0, 4], [A4, 4, 2], [C5, 6, 2], [E5, 8, 4], [D5, 12, 2], [C5, 14, 2]],
    [[B4, 0, 6], [C5, 6, 2], [D5, 8, 4], [E5, 12, 4]],
    [[C5, 0, 4], [A4, 4, 4], [A4, 8, 4]],
    [[D5, 2, 4], [F5, 6, 2], [A5, 8, 4], [G5, 12, 2], [F5, 14, 2]],
    [[E5, 0, 6], [C5, 6, 2], [E5, 8, 4], [D5, 12, 2], [C5, 14, 2]],
    [[B4, 0, 4], [B4, 4, 2], [C5, 6, 2], [D5, 8, 4], [E5, 12, 4]],
    [[C5, 0, 4], [A4, 4, 4], [A4, 8, 4]]
  ];
  var MELODY_B = [
    [[E5, 0, 8], [C5, 8, 8]],
    [[D5, 0, 8], [B4, 8, 8]],
    [[C5, 0, 8], [A4, 8, 8]],
    [[Gs4, 0, 8], [B4, 8, 8]],
    [[E5, 0, 8], [C5, 8, 8]],
    [[D5, 0, 8], [B4, 8, 8]],
    [[C5, 0, 4], [E5, 4, 4], [A5, 8, 8]],
    [[Gs5, 0, 16]]
  ];
  var FILL = [[E5, 12, 1], [D5, 13, 1], [C5, 14, 1], [B4, 15, 1]];
  var CH = {
    Am: { c: [57, 60, 64], r: 45 },
    Am7: { c: [57, 60, 64, 67], r: 45 },
    Am9: { c: [57, 60, 64, 67, 71], r: 45 },
    Amadd9: { c: [57, 60, 64, 71], r: 45 },
    F: { c: [53, 57, 60], r: 41 },
    Fmaj7: { c: [53, 57, 60, 64], r: 41 },
    E: { c: [52, 56, 59], r: 40 },
    E7: { c: [52, 56, 59, 62], r: 40 },
    E7sus4: { c: [52, 57, 59, 62], r: 40 },
    E7b9: { c: [52, 56, 59, 62, 65], r: 40 },
    Dm: { c: [50, 53, 57], r: 38 },
    Dm9: { c: [50, 53, 57, 60, 64], r: 38 },
    C: { c: [48, 52, 55, 60], r: 36 },
    Cmaj7: { c: [48, 55, 59, 64], r: 36 },
    G: { c: [55, 59, 62], r: 43 },
    G6: { c: [55, 59, 62, 64], r: 43 },
    Bm7b5: { c: [47, 50, 53, 57], r: 35 }
  };
  function harmony(spec) {
    if (Array.isArray(spec)) {
      return [{ at: 0, len: 8, ch: CH[spec[0]] }, { at: 8, len: 8, ch: CH[spec[1]] }];
    }
    return [{ at: 0, len: 16, ch: CH[spec] }];
  }
  var SCALE_PCS = [9, 11, 0, 2, 4, 5, 7];
  function thirdBelow(midi) {
    const pc = (midi % 12 + 12) % 12 === 8 ? 7 : (midi % 12 + 12) % 12;
    const deg = SCALE_PCS.indexOf(pc);
    const target = SCALE_PCS[(deg + 5) % 7];
    let n = midi - 1;
    while ((n % 12 + 12) % 12 !== target) n--;
    return n;
  }
  function melodyEvents(notes, voice, vel, shift = 0) {
    return notes.map(([n, s, l]) => ({ s, l, v: voice, n: n + shift, g: vel }));
  }
  function drum2(voice, steps, vel) {
    return steps.map((s) => ({ s, l: 1, v: voice, n: null, g: vel }));
  }
  function transposeBar(events, semitones) {
    return events.map((e) => e.n === null ? e : { ...e, n: e.n + semitones });
  }
  var CALM_A = ["Am9", "Fmaj7", ["E7sus4", "E7"], "Am7", "Dm9", "Cmaj7", ["Bm7b5", "E7"], "Amadd9"];
  var CALM_B = ["Am9", "G6", "Fmaj7", "E7", "Am9", "G6", "Fmaj7", "E7b9"];
  function calmBacking(spec, withDrums) {
    const events = [];
    for (const seg of harmony(spec)) {
      for (const n of seg.ch.c) {
        events.push({ s: seg.at, l: seg.len === 16 ? 10 : seg.len, v: "epiano", n, g: 0.2 });
        if (seg.len === 16) events.push({ s: 10, l: 6, v: "epiano", n, g: 0.12 });
        events.push({ s: seg.at, l: seg.len, v: "pad", n: n + 12, g: 0.07 });
      }
      events.push({ s: seg.at, l: seg.len === 16 ? 8 : seg.len, v: "softbass", n: seg.ch.r, g: 0.38 });
      if (seg.len === 16) events.push({ s: 8, l: 8, v: "softbass", n: seg.ch.r + 7, g: 0.3 });
    }
    if (withDrums) {
      events.push(...drum2("lofikick", [0, 10], 0.6));
      events.push(...drum2("rim", [8], 0.25));
      events.push(...drum2("brush", [2, 6, 10, 14], 0.12));
    }
    return events;
  }
  function buildCalm() {
    const bars = [];
    bars.push(calmBacking("Am9", false), calmBacking("Fmaj7", false));
    for (let i = 0; i < 8; i++) {
      bars.push([...calmBacking(CALM_A[i], true), ...melodyEvents(MELODY_A[i], "bell", 0.7)]);
    }
    for (let i = 0; i < 8; i++) {
      const shift = i >= 4 ? 12 : 0;
      const mel = melodyEvents(MELODY_A[i], "bell", i >= 4 ? 0.55 : 0.7, shift);
      if (i === 3 || i === 7) mel.push(...melodyEvents(FILL, "bell", 0.4, shift));
      bars.push([...calmBacking(CALM_A[i], true), ...mel]);
    }
    for (let i = 0; i < 8; i++) {
      const arp = harmony(CALM_B[i]).flatMap((seg) => [0, 2, 4, 6].filter((s) => s < seg.len).map((s, k) => ({
        s: seg.at + s,
        l: 2,
        v: "epiano",
        n: seg.ch.c[k % seg.ch.c.length] + 12,
        g: 0.14
      })));
      bars.push([...calmBacking(CALM_B[i], true), ...arp, ...melodyEvents(MELODY_B[i], "bell", 0.65)]);
    }
    for (let i = 0; i < 8; i++) {
      const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
      bars.push([
        ...calmBacking(CALM_A[i], true),
        ...melodyEvents(MELODY_A[i], "bell", 0.65),
        ...melodyEvents(harm, "epiano", 0.16, 12)
      ]);
    }
    return bars.map((b) => transposeBar(b, 3));
  }
  var COMP_A = ["Am", "F", "E", "Am", "Dm", "C", ["G", "E"], "Am"];
  var COMP_B = ["F", "G", "Am", "E", "F", "G", "Am", "E"];
  function compBacking(spec, { fill = false, drums = true } = {}) {
    const events = [];
    for (const seg of harmony(spec)) {
      for (let s = 0; s < seg.len; s += 2) {
        events.push({ s: seg.at + s, l: 2, v: "bass", n: seg.ch.r + (s % 4 === 2 ? 12 : 0), g: 0.36 });
      }
      for (let s = 0; s < seg.len; s++) {
        const tones = seg.ch.c;
        events.push({ s: seg.at + s, l: 1, v: "pluck", n: tones[s % tones.length] + 12, g: 0.16 });
      }
      for (const n of seg.ch.c) events.push({ s: seg.at, l: seg.len, v: "pad", n, g: 0.06 });
    }
    if (drums) {
      events.push(...drum2("kick", [0, 4, 8, 12], 0.8));
      events.push(...drum2("snare", fill ? [4, 12, 13, 14, 15] : [4, 12], 0.55));
      events.push(...drum2("hat", [2, 6, 10, 14], 0.3));
      events.push(...drum2("hat", [1, 3, 5, 7, 9, 11, 13, 15], 0.1));
    }
    return events;
  }
  function buildCompetitive() {
    const bars = [];
    bars.push(compBacking("Am"), compBacking("F", { fill: true }));
    for (let i = 0; i < 8; i++) {
      bars.push([...compBacking(COMP_A[i], { fill: i === 7 }), ...melodyEvents(MELODY_A[i], "lead", 0.46)]);
    }
    for (let i = 0; i < 8; i++) {
      const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
      bars.push([
        ...compBacking(COMP_A[i], { fill: i === 7 }),
        ...melodyEvents(MELODY_A[i], "lead", 0.4, 12),
        ...melodyEvents(harm, "lead", 0.16, 12)
      ]);
    }
    for (let i = 0; i < 8; i++) {
      bars.push([...compBacking(COMP_B[i], { fill: i === 7 }), ...melodyEvents(MELODY_B[i], "lead", 0.44)]);
    }
    for (let i = 0; i < 8; i++) {
      const mel = melodyEvents(MELODY_A[i], "lead", 0.46);
      if (i === 3) mel.push(...melodyEvents(FILL, "lead", 0.24));
      bars.push([...compBacking(COMP_A[i], { fill: i === 7 }), ...mel]);
    }
    return bars.map((b) => transposeBar(b, 5));
  }
  var INT_A = ["Am", "Am", "E", "Am", "Dm", "Am", "E", "Am"];
  var INT_B = ["Am", "E", "Am", "E", "F", "G", "Am", "E"];
  function intenseBacking(spec, { crash = false, fill = false } = {}) {
    const events = [];
    for (const seg of harmony(spec)) {
      for (let s = 0; s < seg.len; s++) {
        const up = s % 8 === 6;
        events.push({ s: seg.at + s, l: 1, v: "bass", n: seg.ch.r + (up ? 12 : 0), g: s % 4 === 0 ? 0.4 : 0.26 });
      }
      for (const s of [0, 3, 6].filter((x) => x < seg.len)) {
        for (const n of seg.ch.c) events.push({ s: seg.at + s, l: 1, v: "stab", n: n + 12, g: 0.13 });
      }
      for (const n of seg.ch.c) events.push({ s: seg.at, l: seg.len, v: "pad", n: n + 12, g: 0.05 });
    }
    events.push(...drum2("kick", [0, 4, 8, 10, 12], 0.85));
    events.push(...drum2("snare", fill ? [4, 10, 11, 12, 13, 14, 15] : [4, 12], 0.6));
    events.push(...drum2("hat", [...Array(16).keys()], 0.14));
    if (crash) events.push(...drum2("crash", [0], 0.35));
    return events;
  }
  function buildIntense() {
    const bars = [];
    for (let i = 0; i < 8; i++) {
      bars.push([
        ...intenseBacking(INT_A[i], { crash: i === 0, fill: i === 7 }),
        ...melodyEvents(MELODY_A[i], "lead", 0.46, -12),
        ...melodyEvents(MELODY_A[i], "lead", 0.12)
      ]);
    }
    for (let i = 0; i < 8; i++) {
      const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
      bars.push([
        ...intenseBacking(INT_A[i], { crash: i === 0, fill: i === 7 }),
        ...melodyEvents(MELODY_A[i], "lead", 0.42),
        ...melodyEvents(harm, "lead", 0.18)
      ]);
    }
    for (let i = 0; i < 8; i++) {
      const chopped = MELODY_B[i].flatMap(([n, s, l]) => {
        const out = [];
        for (let k = 0; k < l; k += 2) out.push([n, s + k, 2]);
        return out;
      });
      bars.push([
        ...intenseBacking(INT_B[i], { crash: i === 0, fill: i === 7 }),
        ...melodyEvents(chopped, "lead", 0.4, -12),
        ...melodyEvents(chopped, "lead", 0.1)
      ]);
    }
    return bars.map((b) => transposeBar(b, 7));
  }
  var CHIP_A = ["Am", "Am", "E", "Am", "Dm", "C", "E", "Am"];
  var CHIP_B = ["Am", "G", "F", "E", "Am", "G", "Am", "E"];
  function chipBacking(spec, { arp = false, drums = "none", fill = false } = {}) {
    const events = [];
    for (const seg of harmony(spec)) {
      for (let s = 0; s < seg.len; s += 2) {
        events.push({ s: seg.at + s, l: 2, v: "chipBass", n: seg.ch.r + (s % 4 === 2 ? 12 : 0), g: 0.52 });
      }
      const tones = seg.ch.c;
      if (arp) {
        for (let s = 0; s < seg.len; s++) {
          events.push({ s: seg.at + s, l: 1, v: "chipHarm", n: tones[s % tones.length] + 12, g: 0.09 });
        }
      } else {
        for (let s = 2; s < seg.len; s += 4) {
          for (const n of tones.slice(1, 3)) events.push({ s: seg.at + s, l: 1, v: "chipHarm", n: n + 12, g: 0.09 });
        }
      }
    }
    if (drums !== "none") {
      events.push(...drum2("chipKick", drums === "full" ? [0, 4, 8, 12] : [0, 8], 0.55));
      events.push(...drum2("chipSnare", fill ? [4, 12, 13, 14, 15] : [4, 12], 0.34));
      events.push(...drum2("chipHat", drums === "full" ? [2, 6, 10, 14] : [], 0.18));
    }
    return events;
  }
  function buildChip() {
    const bars = [];
    for (let i = 0; i < 8; i++) {
      bars.push([...chipBacking(CHIP_A[i]), ...melodyEvents(MELODY_A[i], "chipLead", 0.35)]);
    }
    for (let i = 0; i < 8; i++) {
      const harm = MELODY_A[i].map(([n, s, l]) => [thirdBelow(n), s, l]);
      bars.push([
        ...chipBacking(CHIP_A[i], { drums: "beat", fill: i === 7 }).filter((e) => e.v !== "chipHarm"),
        ...melodyEvents(MELODY_A[i], "chipLead", 0.35),
        ...melodyEvents(harm, "chipHarm", 0.13)
      ]);
    }
    for (let i = 0; i < 8; i++) {
      bars.push([...chipBacking(CHIP_B[i], { arp: true, drums: "beat", fill: i === 7 }), ...melodyEvents(MELODY_B[i], "chipLead", 0.35)]);
    }
    for (let i = 0; i < 8; i++) {
      const mel = melodyEvents(MELODY_A[i], "chipLead", 0.3, 12);
      if (i === 3 || i === 7) mel.push(...melodyEvents(FILL, "chipLead", 0.23, 12));
      bars.push([...chipBacking(CHIP_A[i], { drums: "full", fill: i === 7 }), ...mel]);
    }
    return bars;
  }
  var TRACKS = {
    calm: { bpm: 88, swing: 0.35, delay: 0.3, loopStart: 2, bars: buildCalm() },
    competitive: { bpm: 150, swing: 0, delay: 0.12, loopStart: 2, bars: buildCompetitive() },
    intense: { bpm: 176, swing: 0, delay: 0.08, loopStart: 0, bars: buildIntense() },
    chip: { bpm: 150, swing: 0, delay: 0, loopStart: 0, bars: buildChip() }
  };
  var TRACK_NAMES = Object.keys(TRACKS);

  // js/music.js
  var TICK_MS = 25;
  var LOOKAHEAD_S = 0.2;
  var CROSSFADE_S = 1.5;
  var TRACK_GAIN = 0.3;
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function createNoiseBuffer(ctx) {
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noise;
  }
  function createVoices(ctx, noise) {
    function env(param, t, peak, attack, hold, release) {
      param.setValueAtTime(1e-4, t);
      param.linearRampToValueAtTime(peak, t + attack);
      param.setValueAtTime(peak, t + attack + hold);
      param.exponentialRampToValueAtTime(1e-4, t + attack + hold + release);
      return attack + hold + release;
    }
    function osc(type, freq, t, end, dest, detune = 0) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.detune.value = detune;
      o.connect(dest);
      o.start(t);
      o.stop(end);
      return o;
    }
    function voiceGain(dest, onEnd) {
      const g = ctx.createGain();
      g.connect(dest);
      return { g, done: (node) => {
        node.onended = () => {
          g.disconnect();
          onEnd?.();
        };
      } };
    }
    function noiseBurst(t, dur, vel, dest, filterType, freq, q = 1) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const { g, done } = voiceGain(dest, () => f.disconnect());
      env(g.gain, t, vel, 1e-3, 0, dur);
      src.connect(f);
      f.connect(g);
      src.start(t);
      src.stop(t + dur + 0.02);
      done(src);
    }
    function pulseNote(t, freq, dur, vel, bus, duty) {
      const { g, done } = voiceGain(bus.dry);
      const len = env(g.gain, t, vel, 2e-3, Math.max(0, dur - 0.025), 0.03);
      const o = ctx.createOscillator();
      o.setPeriodicWave(pulseWave(ctx, duty));
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      o.start(t);
      o.stop(t + len);
      done(o);
    }
    return {
      /** FM electric piano: sine carrier, sine modulator at 1:1 with a decaying index. */
      epiano(t, freq, dur, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        const len = env(g.gain, t, vel, 5e-3, Math.max(0, dur - 0.05), 0.6);
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        mod.frequency.value = freq;
        modGain.gain.setValueAtTime(freq * 1.2, t);
        modGain.gain.exponentialRampToValueAtTime(freq * 0.1, t + 0.4);
        mod.connect(modGain);
        const car = osc("sine", freq, t, t + len, g);
        modGain.connect(car.frequency);
        mod.start(t);
        mod.stop(t + len);
        done(car);
      },
      /** Bell: FM at 1:3.5 for a glassy tone, with a delay send. */
      bell(t, freq, dur, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        g.connect(bus.send);
        const len = env(g.gain, t, vel, 3e-3, Math.min(dur, 0.1), 0.9 + dur * 0.5);
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        mod.frequency.value = freq * 3.5;
        modGain.gain.setValueAtTime(freq * 0.8, t);
        modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + 0.8);
        mod.connect(modGain);
        const car = osc("sine", freq, t, t + len, g);
        modGain.connect(car.frequency);
        mod.start(t);
        mod.stop(t + len);
        done(car);
      },
      /** Detuned saws through a slow lowpass. */
      pad(t, freq, dur, vel, bus) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 1400;
        f.connect(bus.dry);
        const { g, done } = voiceGain(f, () => f.disconnect());
        const len = env(g.gain, t, vel, 0.25, Math.max(0, dur - 0.25), 0.5);
        osc("sawtooth", freq, t, t + len, g, -8);
        done(osc("sawtooth", freq, t, t + len, g, 8));
      },
      softbass(t, freq, dur, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        const len = env(g.gain, t, vel, 0.01, Math.max(0, dur - 0.1), 0.25);
        osc("sine", freq, t, t + len, g);
        done(osc("triangle", freq * 2, t, t + len, g));
      },
      bass(t, freq, dur, vel, bus) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.setValueAtTime(1800, t);
        f.frequency.exponentialRampToValueAtTime(300, t + 0.12);
        f.connect(bus.dry);
        const { g, done } = voiceGain(f, () => f.disconnect());
        const len = env(g.gain, t, vel, 4e-3, Math.max(0, dur * 0.7), 0.06);
        osc("sine", freq, t, t + len, g);
        done(osc("square", freq, t, t + len, g));
      },
      pluck(t, freq, dur, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        g.connect(bus.send);
        const len = env(g.gain, t, vel, 2e-3, 0, 0.12);
        done(osc("square", freq, t, t + len, g));
      },
      stab(t, freq, dur, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        const len = env(g.gain, t, vel, 2e-3, 0.03, 0.08);
        osc("sawtooth", freq, t, t + len, g, -10);
        done(osc("sawtooth", freq, t, t + len, g, 10));
      },
      /** Square/saw lead with delayed vibrato. */
      lead(t, freq, dur, vel, bus) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 3200;
        f.connect(bus.dry);
        f.connect(bus.send);
        const { g, done } = voiceGain(f, () => f.disconnect());
        const len = env(g.gain, t, vel, 8e-3, Math.max(0, dur - 0.03), 0.12);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 5.5;
        lfoGain.gain.setValueAtTime(0, t);
        lfoGain.gain.linearRampToValueAtTime(freq * 6e-3, t + 0.25);
        lfo.connect(lfoGain);
        const a = osc("square", freq, t, t + len, g);
        const b = osc("sawtooth", freq, t, t + len, g, 6);
        lfoGain.connect(a.frequency);
        lfoGain.connect(b.frequency);
        lfo.start(t);
        lfo.stop(t + len);
        done(a);
      },
      kick(t, _f, _d, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        env(g.gain, t, vel, 1e-3, 0.02, 0.25);
        const o = osc("sine", 150, t, t + 0.3, g);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        done(o);
      },
      lofikick(t, _f, _d, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        env(g.gain, t, vel, 4e-3, 0.02, 0.3);
        const o = osc("sine", 110, t, t + 0.35, g);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        done(o);
      },
      snare(t, _f, _d, vel, bus) {
        noiseBurst(t, 0.16, vel, bus.dry, "bandpass", 1800, 0.8);
        const { g, done } = voiceGain(bus.dry);
        env(g.gain, t, vel * 0.5, 1e-3, 0, 0.08);
        done(osc("triangle", 190, t, t + 0.1, g));
      },
      rim(t, _f, _d, vel, bus) {
        noiseBurst(t, 0.05, vel, bus.dry, "bandpass", 2500, 4);
      },
      hat(t, _f, _d, vel, bus) {
        noiseBurst(t, 0.035, vel, bus.dry, "highpass", 7500);
      },
      brush(t, _f, _d, vel, bus) {
        noiseBurst(t, 0.12, vel, bus.dry, "bandpass", 5e3, 0.6);
      },
      crash(t, _f, _d, vel, bus) {
        noiseBurst(t, 1.2, vel, bus.dry, "highpass", 4e3);
      },
      // --- 8-bit voices (the chip track) ---
      /** Lead: 50 percent pulse. */
      chipLead(t, freq, dur, vel, bus) {
        pulseNote(t, freq, dur, vel, bus, 0.5);
      },
      /** Second pulse channel: 25 percent duty, thinner, for harmony and stabs. */
      chipHarm(t, freq, dur, vel, bus) {
        pulseNote(t, freq, dur, vel, bus, 0.25);
      },
      /** Triangle bass. */
      chipBass(t, freq, dur, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        const len = env(g.gain, t, vel, 2e-3, Math.max(0, dur - 0.03), 0.03);
        done(osc("triangle", freq, t, t + len, g));
      },
      /** Triangle drum: a quick pitch drop. */
      chipKick(t, _f, _d, vel, bus) {
        const { g, done } = voiceGain(bus.dry);
        env(g.gain, t, vel, 1e-3, 0.03, 0.08);
        const o = osc("triangle", 150, t, t + 0.15, g);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        done(o);
      },
      chipSnare(t, _f, _d, vel, bus) {
        noiseBurst(t, 0.09, vel, bus.dry, "highpass", 1500);
      },
      chipHat(t, _f, _d, vel, bus) {
        noiseBurst(t, 0.03, vel, bus.dry, "highpass", 8e3);
      }
    };
  }
  function createBus(ctx, track, destination) {
    const gain = ctx.createGain();
    gain.gain.value = 1e-4;
    gain.connect(destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 4e-3;
    comp.release.value = 0.15;
    comp.connect(gain);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 60 / track.bpm * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = track.delay;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(comp);
    return { gain, bus: { dry: comp, send: delay }, nodes: [comp, delay, feedback, wet] };
  }
  function scheduleBar(voices, track, bus, events, barStart, tempoScale) {
    const step = 60 / (track.bpm * tempoScale) / 4;
    for (const e of events) {
      let start = e.s;
      if (track.swing && e.s % 4 === 2) start += track.swing;
      voices[e.v]?.(barStart + start * step, e.n === null ? 0 : midiToFreq(e.n), e.l * step, e.g, bus);
    }
    return 16 * step;
  }
  function nextBar(track, bar) {
    return bar + 1 >= track.bars.length ? track.loopStart : bar + 1;
  }
  function createMusicEngine(settingsRef) {
    let ctx = null;
    let out = null;
    let duckGain = null;
    let duckFilter = null;
    let voices = null;
    let timer = null;
    const players = [];
    let wanted = null;
    let paused = false;
    let tempoScale = 1;
    let isSuppressed = () => false;
    function init() {
      if (ctx) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = targetVolume();
      duckGain = ctx.createGain();
      duckFilter = ctx.createBiquadFilter();
      duckFilter.type = "lowpass";
      duckFilter.frequency.value = 18e3;
      duckGain.connect(duckFilter);
      duckFilter.connect(out);
      out.connect(ctx.destination);
      voices = createVoices(ctx, createNoiseBuffer(ctx));
      timer = setInterval(tick, TICK_MS);
    }
    function targetVolume() {
      if (settingsRef.musicMuted) return 0;
      return (settingsRef.masterVolume ?? 100) / 100 * ((settingsRef.musicVolume ?? 100) / 100);
    }
    function createPlayer(name) {
      const track = TRACKS[name];
      const { gain, bus, nodes } = createBus(ctx, track, duckGain);
      return { name, track, gain, bus, nodes, bar: 0, nextBarTime: ctx.currentTime + 0.1, stopping: false };
    }
    function tick() {
      const now = ctx.currentTime;
      const suppressed = isSuppressed();
      const vol = suppressed ? 0 : targetVolume();
      if (Math.abs(out.gain.value - vol) > 1e-3) out.gain.setTargetAtTime(vol, now, 0.05);
      for (const p of players) {
        if (p.stopping || suppressed) continue;
        while (p.nextBarTime < now + LOOKAHEAD_S) {
          if (p.nextBarTime < now - 0.05) p.nextBarTime = now + 0.02;
          p.nextBarTime += scheduleBar(voices, p.track, p.bus, p.track.bars[p.bar], p.nextBarTime, tempoScale);
          p.bar = nextBar(p.track, p.bar);
        }
      }
      if (suppressed) for (const p of players) p.nextBarTime = now + 0.1;
    }
    function fadeTo(p, value, seconds) {
      const now = ctx.currentTime;
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.setValueAtTime(Math.max(p.gain.gain.value, 1e-4), now);
      p.gain.gain.exponentialRampToValueAtTime(Math.max(value, 1e-4), now + seconds);
    }
    function applyTrack() {
      if (!ctx) return;
      for (const p of players) {
        if (p.name !== wanted && !p.stopping) {
          p.stopping = true;
          fadeTo(p, 1e-4, CROSSFADE_S);
          setTimeout(() => {
            p.gain.disconnect();
            p.nodes.forEach((n) => n.disconnect());
            players.splice(players.indexOf(p), 1);
          }, CROSSFADE_S * 1e3 + 3e3);
        }
      }
      if (wanted && !players.some((p) => p.name === wanted && !p.stopping)) {
        const p = createPlayer(wanted);
        players.push(p);
        fadeTo(p, TRACK_GAIN, players.length > 1 ? CROSSFADE_S : 0.3);
      }
    }
    return {
      /** Create the AudioContext. Call from a user gesture (click or key). */
      unlock() {
        init();
        if (ctx.state === "suspended") ctx.resume();
        applyTrack();
      },
      /** Switch to a track ('calm' | 'competitive' | 'intense'), or null for silence. */
      setTrack(name) {
        if (name === wanted) return;
        wanted = name && TRACKS[name] ? name : null;
        applyTrack();
      },
      getTrack() {
        return wanted;
      },
      /** Muffle and lower the music while the game is paused. */
      setPaused(value) {
        if (value === paused) return;
        paused = value;
        if (!ctx) return;
        const now = ctx.currentTime;
        duckGain.gain.setTargetAtTime(value ? 0.35 : 1, now, 0.1);
        duckFilter.frequency.setTargetAtTime(value ? 700 : 18e3, now, 0.1);
      },
      /** Speed up the song slightly (1 = written tempo). Applies from the next bar. */
      setTempoScale(scale) {
        tempoScale = scale;
      },
      /** Silence the soundtrack while this returns true (for example, user music playing). */
      setSuppressor(fn) {
        isSuppressed = fn;
      },
      dispose() {
        if (timer) clearInterval(timer);
        if (ctx) ctx.close();
        ctx = null;
      }
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
      }
    };
  }

  // js/modes.js
  var MODE_SPRINT = "sprint";
  var MODE_BLITZ = "blitz";
  var MODE_CLASSIC = "classic";
  var MODE_OG = "og";
  var BLITZ_MS = 12e4;
  var GAME_STYLES = {
    modern: { name: "MODERN", lineClearDelay: 0, bigHitDelay: 0, entryDelay: 0 },
    battle: { name: "BATTLE", lineClearDelay: 500, bigHitDelay: 1e3, entryDelay: 117 },
    // Classic mode always plays this one: a 20 frame clear animation, then ~12 frames of entry delay.
    classic: { name: "CLASSIC", lineClearDelay: Math.round(20 * NES_FRAME_MS), bigHitDelay: Math.round(20 * NES_FRAME_MS), entryDelay: Math.round(12 * NES_FRAME_MS) }
  };
  var BIG_HIT_LINES = 4;
  var MODE_INFO = {
    [MODE_SPRINT]: {
      name: "40 LINES",
      subtitle: "SPRINT",
      description: "Clear 40 lines as fast as possible.",
      track: "competitive",
      icon: "\u23F1"
    },
    [MODE_BLITZ]: {
      name: "BLITZ",
      subtitle: "2 MINUTES",
      description: "Score as many points as you can before time runs out.",
      track: "intense",
      icon: "\u26A1"
    },
    [MODE_CLASSIC]: {
      name: "CASUAL",
      subtitle: "ENDLESS",
      description: "Relaxed endless play. Gravity rises and the scenery changes as you level up.",
      track: "calm",
      icon: "\u221E"
    },
    [MODE_OG]: {
      name: "CLASSIC",
      subtitle: "OG RULES",
      description: "The original rules: next piece only, no hold, no wall kicks. Points for lines, nothing for T-spins.",
      track: "chip",
      icon: "\u25A3"
    }
  };
  var MODERN_RULES = Object.freeze({
    look: "modern",
    hold: true,
    ghost: true,
    hardDrop: true,
    rotation: "srs",
    spawn: "above",
    lock: "delay",
    randomizer: "bag",
    scoring: "modern",
    attack: true,
    effects: true,
    danger: true,
    finesse: true,
    style: null,
    soundPack: null,
    previewCount: null
  });
  var CLASSIC_RULES = Object.freeze({
    look: "classic",
    hold: false,
    ghost: false,
    hardDrop: false,
    rotation: "classic",
    spawn: "inside",
    lock: "gravity",
    randomizer: "classic",
    scoring: "classic",
    attack: false,
    effects: false,
    danger: false,
    finesse: false,
    style: "classic",
    soundPack: "nes",
    previewCount: 1
  });
  function getRules(modeId) {
    return modeId === MODE_OG ? CLASSIC_RULES : MODERN_RULES;
  }
  function getGravityInterval(level) {
    return Math.max(50, 1e3 - (level - 1) * 90);
  }
  function createModeState(modeId, options = {}) {
    const startLevel = modeId === MODE_OG ? Math.max(0, Math.floor(options.startLevel ?? 0)) : 1;
    const stats = {
      linesCleared: 0,
      score: 0,
      level: startLevel,
      piecesPlaced: 0,
      tSpins: 0,
      tetrises: 0,
      maxCombo: 0,
      perfectClears: 0,
      linesSent: 0,
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
        timer = createCountdown(BLITZ_MS);
        break;
      case MODE_CLASSIC:
      case MODE_OG:
        timer = createStopwatch();
        break;
    }
    return {
      modeId,
      stats,
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
        stats.level = startLevel;
        stats.piecesPlaced = 0;
        stats.tSpins = 0;
        stats.tetrises = 0;
        stats.maxCombo = 0;
        stats.perfectClears = 0;
        stats.linesSent = 0;
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
        } else if (modeId === MODE_OG) {
          stats.level = classicLevel(stats.linesCleared, startLevel);
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
      /** Record garbage lines sent by a clear */
      addAttack(lines) {
        stats.linesSent += lines;
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
      /** Check if the game should end for any reason */
      isFinished() {
        return completed || gameOver;
      },
      /** Get the current gravity interval based on level */
      getDropInterval() {
        if (modeId === MODE_SPRINT) {
          return 1e3;
        }
        if (modeId === MODE_OG) return classicGravityMs(stats.level);
        return getGravityInterval(stats.level);
      },
      /** Fraction (0 to 1) of the way to the next level, for the progress meter */
      getLevelProgress() {
        if (modeId === MODE_OG) return classicLevelProgress(stats.linesCleared, startLevel);
        return stats.linesCleared % 10 / 10;
      },
      /** Get the formatted timer display */
      getTimerDisplay() {
        if (!timer) return "";
        return timer.format();
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
          case MODE_OG:
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
          case MODE_OG:
            return stats.score;
          default:
            return stats.score;
        }
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
      /** Play time in ms (excludes pauses) */
      getElapsedMs() {
        if (!timer) return 0;
        if (modeId === MODE_BLITZ) return BLITZ_MS - timer.getRemaining();
        return timer.getElapsed();
      },
      /**
       * Whether Casual has reached the intense track (level 10+). Sprint and Blitz keep
       * one track for the whole run, so a switch mid-game never breaks their pace.
       */
      isHeated() {
        return modeId === MODE_CLASSIC && stats.level >= 10;
      },
      /** Get results for the game-over screen */
      getResults() {
        const r = { ...stats };
        r.modeId = modeId;
        r.modeName = MODE_INFO[modeId]?.name || modeId;
        r.finalTime = timer ? timer.format() : "";
        r.finalTimePrecise = timer && timer.formatPrecise ? timer.formatPrecise() : r.finalTime;
        const minutes = this.getElapsedMs() / 6e4;
        r.apm = minutes > 0 ? stats.linesSent / minutes : 0;
        r.tetrisRate = stats.linesCleared > 0 ? stats.tetrises * 4 / stats.linesCleared * 100 : 0;
        r.completed = completed;
        r.gameOver = gameOver;
        return r;
      }
    };
  }

  // js/menu.js
  function createClassicIcon() {
    const size = 14;
    const canvas = document.createElement("canvas");
    canvas.width = size * 3;
    canvas.height = size * 2;
    canvas.className = "mode-icon-pixel";
    const ctx = canvas.getContext("2d");
    const palette = nesPalette(0);
    [["light", 0, 0], ["dark", 1, 0], ["ring", 2, 0], ["light", 1, 1]].forEach(([kind, col, row]) => {
      paintNesBlock(ctx, col * size, row * size, size, kind, palette);
    });
    return canvas;
  }
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
    const modesHtml = [MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC, MODE_OG].map((id) => {
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
    modeSelect.querySelector(`[data-mode="${MODE_OG}"] .mode-icon`).replaceChildren(createClassicIcon());
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
      if (results.modeId === MODE_OG) {
        stats.push({ label: "SCORE", value: results.score.toLocaleString(), highlight: true });
        stats.push({ label: "LINES", value: results.linesCleared });
        stats.push({ label: "LEVEL", value: results.level });
        stats.push({ label: "PIECES", value: results.piecesPlaced });
        stats.push({ label: "TETRIS RATE", value: `${Math.round(results.tetrisRate)}%` });
        stats.push({ label: "PPS", value: (results.pps ?? 0).toFixed(2) });
        stats.push({ label: "TIME", value: results.finalTime });
      } else {
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
          stats.push({ label: "QUADS", value: results.tetrises });
        }
        if (results.maxCombo > 0) {
          stats.push({ label: "MAX COMBO", value: results.maxCombo });
        }
        if (results.perfectClears > 0) {
          stats.push({ label: "PERFECT CLEARS", value: results.perfectClears });
        }
        stats.push({ label: "LINES SENT", value: results.linesSent });
        stats.push({ label: "APM", value: results.apm.toFixed(1) });
        stats.push({ label: "PPS", value: (results.pps ?? 0).toFixed(2) });
        stats.push({ label: "FINESSE", value: `${(results.finesse ?? 100).toFixed(1)}%` });
        if (results.modeId !== "sprint") {
          stats.push({ label: "TIME", value: results.finalTime });
        }
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
    "tetris": "QUAD",
    "tspin-mini": "T-SPIN MINI",
    "tspin-mini-single": "T-SPIN MINI SINGLE",
    "tspin-mini-double": "T-SPIN MINI DOUBLE",
    "tspin": "T-SPIN",
    "tspin-single": "T-SPIN SINGLE",
    "tspin-double": "T-SPIN DOUBLE",
    "tspin-triple": "T-SPIN TRIPLE",
    "perfect-clear": "PERFECT CLEAR"
  };
  var ATTACK_TABLE = {
    "single": 0,
    "double": 1,
    "triple": 2,
    "tetris": 4,
    "tspin-mini-single": 0,
    "tspin-mini-double": 1,
    "tspin-single": 2,
    "tspin-double": 4,
    "tspin-triple": 6
  };
  var COMBO_ATTACK = [0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];
  var B2B_ATTACK = 1;
  var PERFECT_CLEAR_ATTACK = 10;
  function calculateAttack(result) {
    if (!result.isClearAction) return 0;
    let lines = ATTACK_TABLE[result.action] || 0;
    if (result.combo > 0) lines += COMBO_ATTACK[Math.min(result.combo, COMBO_ATTACK.length - 1)];
    if (result.b2b) lines += B2B_ATTACK;
    if (result.perfectClear) lines += PERFECT_CLEAR_ATTACK;
    return lines;
  }
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
    const px2 = player.pos.x;
    const py = player.pos.y;
    const corners = [
      [px2, py],
      // top-left
      [px2 + 2, py],
      // top-right
      [px2, py + 2],
      // bottom-left
      [px2 + 2, py + 2]
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
    if (actionType.startsWith("tspin")) return "#e07af0";
    if (actionType === "tetris") return "#5ee8c8";
    if (actionType === "perfect-clear") return "#ffd700";
    if (actionType === "triple") return "#b2e86a";
    if (actionType === "double") return "#f5a45a";
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
  var FIELD_W = 10 * BLOCK_SIZE;
  var BOARD_OFFSET_Y = BUFFER_ROWS - VISIBLE_ROWS;
  function rowToY(row) {
    return (row - BOARD_OFFSET_Y) * BLOCK_SIZE;
  }
  function createParticleSystem(settings2) {
    const particles = [];
    let shakeX = 0;
    let shakeY = 0;
    let shakeDecay = 0;
    let shakeIntensity = 0;
    const place = () => effectLevel(settings2, "placeImpact");
    const clearFx = () => effectLevel(settings2, "clearEffects");
    function add(p) {
      p.maxLife = p.life;
      particles.push(p);
    }
    function triggerShake(intensity) {
      const mul = effectLevel(settings2, "screenShake");
      if (mul === 0) return;
      shakeIntensity = Math.max(shakeIntensity * (shakeDecay / 200), intensity * mul);
      shakeDecay = 200;
    }
    function spawnPlacement(piece, dropRows = 0) {
      const mul = place();
      if (mul === 0) return;
      const color = SHAPES[piece.shape].color;
      const cells = [];
      piece.matrix.forEach((row, y) => row.forEach((v, x) => {
        if (v) cells.push({ x: x + piece.pos.x, y: y + piece.pos.y });
      }));
      for (const c of cells) {
        add({ type: "cell", x: c.x * BLOCK_SIZE, y: rowToY(c.y), life: 140, color: "#ffffff" });
      }
      if (dropRows > 0) {
        const columns = /* @__PURE__ */ new Map();
        for (const c of cells) columns.set(c.x, Math.min(columns.get(c.x) ?? Infinity, c.y));
        for (const [x, topRow] of columns) {
          const bottom = rowToY(topRow);
          const length = Math.min(dropRows, 12) * BLOCK_SIZE;
          add({ type: "trail", x: x * BLOCK_SIZE, y: bottom - length, h: length, life: 180, color });
        }
      }
      const lowest = /* @__PURE__ */ new Map();
      for (const c of cells) lowest.set(c.x, Math.max(lowest.get(c.x) ?? -Infinity, c.y));
      const puffs = Math.round((dropRows > 0 ? 3 : 1) * mul);
      for (const [x, row] of lowest) {
        for (let i = 0; i < puffs; i++) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          add({
            type: "square",
            x: x * BLOCK_SIZE + BLOCK_SIZE / 2 + dir * Math.random() * BLOCK_SIZE / 2,
            y: rowToY(row) + BLOCK_SIZE,
            vx: dir * (0.05 + Math.random() * 0.12),
            vy: -0.05 - Math.random() * 0.1,
            gravity: 4e-4,
            life: 260 + Math.random() * 200,
            size: 2 + Math.random() * 3,
            color: Math.random() < 0.5 ? color : "#d8d8e8"
          });
        }
      }
      if (dropRows > 0) triggerShake(Math.min(1 + dropRows * 0.15, 3.5));
    }
    function spawnLineClear(clearedRows, clearType, arenaSnapshot) {
      const mul = clearFx();
      const isQuad = clearType === "tetris";
      const isTSpin = clearType && clearType.startsWith("tspin");
      const intensity = isQuad ? 2.2 : isTSpin ? 1.8 : 1;
      if (mul > 0) {
        for (const rowY of clearedRows) {
          const y = rowToY(rowY) + BLOCK_SIZE / 2;
          add({ type: "row", x: 0, y: y - BLOCK_SIZE / 2, life: 220, color: "#ffffff" });
          for (let col = 0; col < 10; col++) {
            const cellShape = arenaSnapshot?.[rowY]?.[col];
            const color = SHAPES[cellShape]?.color || "#ffffff";
            const count = Math.floor((2 + Math.random() * 3) * mul * intensity);
            for (let i = 0; i < count; i++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 0.15 + Math.random() * 0.45 * intensity;
              add({
                type: "square",
                x: col * BLOCK_SIZE + BLOCK_SIZE / 2,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.15,
                gravity: 12e-4,
                life: 300 + Math.random() * 400,
                size: 2 + Math.random() * 4,
                color
              });
            }
          }
        }
        if (isQuad) {
          const mid = clearedRows.reduce((s, r) => s + r, 0) / clearedRows.length;
          add({ type: "flash", x: 0, y: rowToY(mid) - BLOCK_SIZE * 2, h: BLOCK_SIZE * 5, life: 220, color: SHAPES.I.color });
        }
      }
      const shake = isQuad ? 8 : isTSpin ? 6 : clearedRows.length >= 2 ? 3 : 1.5;
      triggerShake(shake);
    }
    function spawnTSpin(playerPos) {
      const mul = clearFx();
      if (mul === 0) return;
      const cx = (playerPos.x + 1.5) * BLOCK_SIZE;
      const cy = rowToY(playerPos.y) + 1.5 * BLOCK_SIZE;
      const count = Math.floor(30 * mul);
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 4 + Math.random() * 0.3;
        const speed = 0.3 + Math.random() * 0.5;
        add({
          type: "circle",
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 8e-4,
          life: 400 + Math.random() * 300,
          size: 3 + Math.random() * 4,
          color: SHAPES.T.color
        });
      }
    }
    function spawnAttack(clearedRows, lines) {
      const midRow = clearedRows[Math.floor(clearedRows.length / 2)];
      const startY = rowToY(midRow) + BLOCK_SIZE / 2;
      const color = lines >= 4 ? "#ff4d6d" : "#ffb347";
      const count = Math.min(lines, 10);
      for (let i = 0; i < count; i++) {
        add({
          type: "orb",
          sx: (3 + Math.random() * 4) * BLOCK_SIZE,
          sy: startY + (Math.random() - 0.5) * BLOCK_SIZE,
          tx: FIELD_W + 14,
          ty: Math.max(60, startY - 140),
          x: 0,
          y: 0,
          life: 450 + i * 45,
          size: 8 + Math.min(lines, 6),
          color
        });
      }
      triggerShake(lines >= 4 ? 8 : 4);
    }
    function spawnB2B(clearedRows) {
      const mul = clearFx();
      if (mul === 0) return;
      for (const rowY of clearedRows) {
        const y = rowToY(rowY) + BLOCK_SIZE / 2;
        const count = Math.floor(15 * mul);
        for (let i = 0; i < count; i++) {
          add({
            type: "circle",
            x: Math.random() * FIELD_W,
            y: y + (Math.random() - 0.5) * BLOCK_SIZE * 2,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.15 - Math.random() * 0.2,
            gravity: 6e-4,
            life: 250 + Math.random() * 250,
            size: 2 + Math.random() * 3,
            color: "#ffd700"
          });
        }
      }
    }
    function spawnPerfectClear() {
      const mul = clearFx();
      if (mul > 0) {
        add({ type: "flash", x: 0, y: 0, h: VISIBLE_ROWS * BLOCK_SIZE, life: 400, color: "#ffffff" });
        const colors = Object.values(SHAPES).map((s) => s.color);
        const count = Math.floor(80 * mul);
        for (let i = 0; i < count; i++) {
          add({
            type: "circle",
            x: Math.random() * FIELD_W,
            y: -Math.random() * 100,
            vx: (Math.random() - 0.5) * 0.2,
            vy: 0.2 + Math.random() * 0.3,
            gravity: 4e-4,
            life: 600 + Math.random() * 800,
            size: 2 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }
      }
      triggerShake(10);
    }
    function update(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.type === "orb") {
          const k = 1 - Math.max(0, p.life) / p.maxLife;
          const e = 1 - Math.pow(1 - k, 3);
          p.x = p.sx + (p.tx - p.sx) * e;
          p.y = p.sy + (p.ty - p.sy) * e - Math.sin(k * Math.PI) * 30;
        } else if (p.vx !== void 0) {
          p.vy += (p.gravity ?? 12e-4) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        if (p.life <= 0) particles.splice(i, 1);
      }
      if (shakeDecay > 0) {
        shakeDecay -= dt;
        const intensity = shakeIntensity * Math.max(0, shakeDecay / 200);
        shakeX = (Math.random() - 0.5) * 2 * intensity;
        shakeY = (Math.random() - 0.5) * 2 * intensity;
        if (shakeDecay <= 0) {
          shakeX = 0;
          shakeY = 0;
          shakeIntensity = 0;
        }
      }
    }
    function drawParticles(ctx) {
      for (const p of particles) {
        const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
        ctx.save();
        switch (p.type) {
          case "cell":
            ctx.globalAlpha = alpha * 0.7;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, BLOCK_SIZE, BLOCK_SIZE);
            break;
          case "trail": {
            const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
            g.addColorStop(0, "rgba(255,255,255,0)");
            g.addColorStop(1, p.color);
            ctx.globalAlpha = alpha * 0.45;
            ctx.fillStyle = g;
            ctx.fillRect(p.x + 4, p.y, BLOCK_SIZE - 8, p.h);
            break;
          }
          case "row":
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, FIELD_W, BLOCK_SIZE);
            break;
          case "flash":
            ctx.globalAlpha = alpha * 0.3;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, FIELD_W, p.h);
            break;
          case "orb": {
            const k = 1 - alpha;
            ctx.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 16;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha *= 0.6;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case "circle":
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          default:
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), Math.ceil(p.size), Math.ceil(p.size));
        }
        ctx.restore();
      }
    }
    return {
      spawnPlacement,
      spawnLineClear,
      spawnAttack,
      spawnTSpin,
      spawnB2B,
      spawnPerfectClear,
      update,
      drawParticles,
      /** Current screen shake offset */
      getShake() {
        return { x: shakeX, y: shakeY };
      },
      /** Clear all particles and effects */
      clear() {
        particles.length = 0;
        shakeX = 0;
        shakeY = 0;
        shakeDecay = 0;
        shakeIntensity = 0;
      }
    };
  }

  // js/renderer.js
  var BOARD_OFFSET_Y2 = BUFFER_ROWS - VISIBLE_ROWS;
  var FIELD_W2 = COLS * BLOCK_SIZE;
  var FIELD_H = VISIBLE_ROWS * BLOCK_SIZE;
  var FRAME = 4;
  var FIELD_TOP = SPAWN_ROWS * BLOCK_SIZE;
  var SIDE_BLOCK = 22;
  var SIDE_COLS = 5;
  var BOARD_CANVAS = { width: FIELD_W2 + FRAME * 2, height: FIELD_TOP + FIELD_H + FRAME, fieldTop: FIELD_TOP };
  function lerpColor(a, b, t) {
    const pa = a.match(/\d+/g).map(Number);
    const pb = b.match(/\d+/g).map(Number);
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
  }
  function drawPreview(ctx, sprite, shape, matrix, slotTop, slotHeight, dimmed) {
    let minX = 9, maxX = 0, minY = 9, maxY = 0;
    matrix.forEach((row, y) => row.forEach((v, x) => {
      if (v) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }));
    const w = (maxX - minX + 1) * SIDE_BLOCK;
    const h = (maxY - minY + 1) * SIDE_BLOCK;
    const ox = Math.round((ctx.canvas.width - w) / 2) - minX * SIDE_BLOCK;
    const oy = Math.round(slotTop + (slotHeight - h) / 2) - minY * SIDE_BLOCK;
    const img = sprite(shape, SIDE_BLOCK, dimmed);
    matrix.forEach((row, y) => row.forEach((v, x) => {
      if (v) ctx.drawImage(img, ox + x * SIDE_BLOCK, oy + y * SIDE_BLOCK);
    }));
  }
  function createRenderer(canvases2, settings2, look = "modern") {
    const classic = look === "classic";
    const boardCtx = canvases2.board.getContext("2d");
    const holdCtx = canvases2.hold.getContext("2d");
    const nextCtx = canvases2.next.getContext("2d");
    const fieldTop = classic ? FRAME : FIELD_TOP;
    let previews = settings2.nextPreviewCount || 5;
    canvases2.board.width = BOARD_CANVAS.width;
    canvases2.board.height = classic ? FIELD_H + FRAME * 2 : BOARD_CANVAS.height;
    canvases2.hold.width = SIDE_COLS * SIDE_BLOCK;
    canvases2.hold.height = 3 * SIDE_BLOCK;
    function drawField(danger, time) {
      const ctx = boardCtx;
      ctx.fillStyle = "rgba(7, 7, 13, 0.86)";
      ctx.fillRect(0, 0, FIELD_W2, FIELD_H);
      ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
      for (let x = 1; x < COLS; x++) ctx.fillRect(x * BLOCK_SIZE, 0, 1, FIELD_H);
      for (let y = 1; y < VISIBLE_ROWS; y++) ctx.fillRect(0, y * BLOCK_SIZE, FIELD_W2, 1);
      let frameColor = "rgb(226,229,238)";
      if (danger) {
        const pulse = 0.5 + 0.5 * Math.sin(time / 1e3 * Math.PI * 2);
        frameColor = lerpColor("rgb(120,30,45)", "rgb(255,60,90)", pulse);
        const glow2 = ctx.createLinearGradient(0, 0, 0, BLOCK_SIZE * 6);
        glow2.addColorStop(0, `rgba(255,45,85,${0.18 + pulse * 0.2})`);
        glow2.addColorStop(1, "rgba(255,45,85,0)");
        ctx.fillStyle = glow2;
        ctx.fillRect(0, 0, FIELD_W2, BLOCK_SIZE * 6);
      }
      ctx.fillStyle = frameColor;
      ctx.fillRect(-FRAME, 0, FRAME, FIELD_H + FRAME);
      ctx.fillRect(FIELD_W2, 0, FRAME, FIELD_H + FRAME);
      ctx.fillRect(-FRAME, FIELD_H, FIELD_W2 + FRAME * 2, FRAME);
    }
    function drawClassicField(level) {
      const ctx = boardCtx;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-FRAME, -FRAME, FIELD_W2 + FRAME * 2, FIELD_H + FRAME * 2);
      ctx.fillStyle = nesPalette(level)[0];
      ctx.fillRect(-FRAME / 2, -FRAME / 2, FIELD_W2 + FRAME, FIELD_H + FRAME);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, FIELD_W2, FIELD_H);
    }
    function drawSpawnMarks(shape, danger, time) {
      if (!shape) return;
      const { matrix } = SHAPES[shape];
      const pos = getSpawnPos(matrix);
      const ctx = boardCtx;
      const pulse = danger ? 0.5 + 0.5 * Math.sin(time / 1e3 * Math.PI * 2) : 0;
      ctx.strokeStyle = danger ? `rgba(255, 70, 100, ${0.45 + pulse * 0.4})` : "rgba(255, 255, 255, 0.13)";
      ctx.lineWidth = 2;
      const m = 9;
      matrix.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const px2 = (pos.x + x) * BLOCK_SIZE;
        const py = (pos.y + y - BOARD_OFFSET_Y2) * BLOCK_SIZE;
        ctx.beginPath();
        ctx.moveTo(px2 + m, py + m);
        ctx.lineTo(px2 + BLOCK_SIZE - m, py + BLOCK_SIZE - m);
        ctx.moveTo(px2 + BLOCK_SIZE - m, py + m);
        ctx.lineTo(px2 + m, py + BLOCK_SIZE - m);
        ctx.stroke();
      }));
    }
    function drawMatrix(sprite, matrix, pos, shape) {
      matrix.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const visRow = y + pos.y - BOARD_OFFSET_Y2;
        if (visRow >= -SPAWN_ROWS) boardCtx.drawImage(sprite(shape || v, BLOCK_SIZE), (x + pos.x) * BLOCK_SIZE, visRow * BLOCK_SIZE);
      }));
    }
    function drawGhost(matrix, pos, color, opacity) {
      const ctx = boardCtx;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      matrix.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const visRow = y + pos.y - BOARD_OFFSET_Y2;
        if (visRow >= 0) ctx.fillRect((x + pos.x) * BLOCK_SIZE + 1, visRow * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      }));
      ctx.restore();
    }
    function drawClearFlash(flash) {
      const { rows, progress, big } = flash;
      if (classic) {
        const gone = Math.min(5, Math.floor(progress * 5));
        boardCtx.fillStyle = "#000000";
        for (const row of rows) {
          const y = (row - BOARD_OFFSET_Y2) * BLOCK_SIZE;
          for (let i = 0; i < gone; i++) {
            boardCtx.fillRect((4 - i) * BLOCK_SIZE, y, BLOCK_SIZE, BLOCK_SIZE);
            boardCtx.fillRect((5 + i) * BLOCK_SIZE, y, BLOCK_SIZE, BLOCK_SIZE);
          }
        }
        if (big && Math.floor(progress * 10) % 2 === 0) {
          boardCtx.fillStyle = "rgba(255, 255, 255, 0.55)";
          boardCtx.fillRect(0, 0, FIELD_W2, FIELD_H);
        }
        return;
      }
      const width = FIELD_W2 * (1 - progress);
      for (const row of rows) {
        const y = (row - BOARD_OFFSET_Y2) * BLOCK_SIZE;
        boardCtx.fillStyle = "rgb(7,7,13)";
        boardCtx.fillRect(0, y, FIELD_W2, BLOCK_SIZE);
        boardCtx.globalAlpha = 0.9 - progress * 0.6;
        boardCtx.fillStyle = "#ffffff";
        boardCtx.fillRect((FIELD_W2 - width) / 2, y + 2, width, BLOCK_SIZE - 4);
        boardCtx.globalAlpha = 1;
      }
    }
    function draw(state) {
      const { arena, player, nextQueue, held, particles, shake, danger } = state;
      const time = state.time ?? performance.now();
      const skin = settings2.blockSkin || "ulol";
      const ghostOpacity = (settings2.ghostOpacity ?? 40) / 100 * 0.6;
      const level = state.level ?? 0;
      const sprite = classic ? (shape, size) => nesBlockSprite(shape, level, size) : (shape, size, dimmed) => blockSprite(skin, dimmed ? "#5a5a66" : SHAPES[shape]?.color || "#888", size);
      boardCtx.clearRect(0, 0, canvases2.board.width, canvases2.board.height);
      holdCtx.clearRect(0, 0, canvases2.hold.width, canvases2.hold.height);
      nextCtx.clearRect(0, 0, canvases2.next.width, canvases2.next.height);
      boardCtx.save();
      boardCtx.translate(FRAME + (shake?.x || 0), fieldTop + (shake?.y || 0));
      if (classic) {
        drawClassicField(level);
      } else {
        drawField(danger, time);
        drawSpawnMarks(nextQueue?.[0], danger, time);
      }
      drawMatrix(sprite, arena, { x: 0, y: 0 }, null);
      if (state.flash) drawClearFlash(state.flash);
      if (player && player.matrix) {
        if (state.ghostY !== void 0) {
          drawGhost(player.matrix, { x: player.pos.x, y: state.ghostY }, SHAPES[player.shape].color, ghostOpacity);
        }
        drawMatrix(sprite, player.matrix, player.pos, player.shape);
      }
      if (particles) particles.drawParticles(boardCtx);
      boardCtx.restore();
      const previewMatrix = (shape) => classic ? classicMatrix(shape) : SHAPES[shape].matrix;
      if (held) drawPreview(holdCtx, sprite, held, previewMatrix(held), 0, canvases2.hold.height, state.holdLocked);
      (nextQueue || []).slice(0, previews).forEach((shape, i) => {
        drawPreview(nextCtx, sprite, shape, previewMatrix(shape), i * 3 * SIDE_BLOCK, 3 * SIDE_BLOCK, false);
      });
    }
    function resizeNextCanvas(previewCount) {
      previews = previewCount;
      canvases2.next.width = SIDE_COLS * SIDE_BLOCK;
      canvases2.next.height = previewCount * 3 * SIDE_BLOCK;
    }
    return { draw, resizeNextCanvas };
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
    "Escape"
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
      enabled: true,
      keys: 0,
      // game key presses this game (for KPS and KPP)
      pieceInputs: 0,
      // move and rotate presses for the current piece (finesse)
      pieceSoftDrop: false
      // soft drop used on the current piece (skips finesse)
    };
    const COUNTED = /* @__PURE__ */ new Set([
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown",
      "ArrowUp",
      "KeyX",
      "KeyZ",
      "KeyC",
      "ShiftLeft",
      "ShiftRight",
      "Space"
    ]);
    const FINESSE_KEYS = /* @__PURE__ */ new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "KeyX", "KeyZ"]);
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
      if (COUNTED.has(event.code)) state.keys++;
      if (FINESSE_KEYS.has(event.code)) state.pieceInputs++;
      if (event.code === "ArrowDown") state.pieceSoftDrop = true;
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
      const fixed2 = callbacks.getSoftDropInterval?.();
      if (fixed2 === void 0 && settings2.sdf >= SDF_INFINITE) {
        callbacks.onSoftDrop?.(Infinity);
        return;
      }
      const gravity = callbacks.getGravityInterval?.() ?? 1e3;
      const interval = fixed2 ?? gravity / settings2.sdf;
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
      /** Game key presses so far (moves, rotations, holds, drops). */
      getKeyCount() {
        return state.keys;
      },
      /**
       * Inputs used on the piece that just locked, then start counting the next one.
       * @returns {{ inputs: number, softDrop: boolean }}
       */
      takePieceInputs() {
        const r = { inputs: state.pieceInputs, softDrop: state.pieceSoftDrop || state.downHeld };
        state.pieceInputs = 0;
        state.pieceSoftDrop = false;
        return r;
      },
      /**
       * Release soft drop even if the key is still down; it works again after the key is
       * pressed anew. Classic mode does this on every lock so a held key cannot slam
       * the next piece into the stack.
       */
      cancelSoftDrop() {
        state.downHeld = false;
        state.softDropCharge = 0;
      },
      /** Start counting a fresh piece (after a hold swap). */
      resetPieceInputs() {
        state.pieceInputs = 0;
        state.pieceSoftDrop = false;
      },
      /** Reset the key count (new game). */
      resetCounts() {
        state.keys = 0;
        state.pieceInputs = 0;
        state.pieceSoftDrop = false;
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

  // js/hud.js
  var FEED_SLOTS = ["spin", "clear", "b2b", "combo", "attack"];
  function formatClock(ms) {
    const total = Math.max(0, ms);
    const m = Math.floor(total / 6e4);
    const s = Math.floor(total % 6e4 / 1e3);
    const milli = Math.floor(total % 1e3);
    return { main: `${m}:${String(s).padStart(2, "0")}`, sub: `.${String(milli).padStart(3, "0")}` };
  }
  var fixed = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : 0 .toFixed(d);
  function createHud(settings2, modeId) {
    const isOg = modeId === "og";
    const els = {
      feed: document.getElementById("hud-feed"),
      stats: document.getElementById("hud-stats"),
      under: document.getElementById("hud-under"),
      finesse: document.getElementById("hud-finesse"),
      meter: document.getElementById("hud-meter-fill")
    };
    const last = /* @__PURE__ */ new Map();
    const slots = {};
    if (els.feed) {
      els.feed.innerHTML = FEED_SLOTS.map((k) => `<div class="feed-slot feed-${k}" data-slot="${k}"></div>`).join("");
      for (const k of FEED_SLOTS) slots[k] = els.feed.querySelector(`[data-slot="${k}"]`);
    }
    function setHtml(el, key, html) {
      if (!el || last.get(key) === html) return;
      last.set(key, html);
      el.innerHTML = html;
    }
    function flashSlot(name, html, color) {
      const el = slots[name];
      if (!el) return;
      el.innerHTML = html;
      el.style.color = color || "";
      el.classList.remove("show");
      void el.offsetWidth;
      el.classList.add("show");
    }
    function row(label, value, sub = "", extraClass = "") {
      return `<div class="stat ${extraClass}"><div class="stat-label">${label}</div><div class="stat-value">${value}<span class="stat-sub">${sub}</span></div></div>`;
    }
    return {
      /**
       * Show a clear in the feed.
       * @param {Object} r - scoring result plus { attack, tSpinType }
       */
      onClear(r) {
        if (settings2.showActionText === false) return;
        if (isOg) {
          if (r.action) {
            flashSlot("clear", r.actionName, getActionColor(r.action));
            flashSlot("attack", `+${r.points.toLocaleString()}`, "#ffd24a");
          }
          return;
        }
        if (r.action) {
          const isSpin = r.action.startsWith("tspin");
          const name = r.action === "tetris" ? "QUAD" : ["single", "double", "triple"].find((n) => r.action.endsWith(n))?.toUpperCase() || "";
          if (isSpin) flashSlot("spin", r.action.includes("mini") ? "T-SPIN MINI" : "T-SPIN", getActionColor(r.action));
          if (name) flashSlot("clear", name, isSpin ? "#ffffff" : getActionColor(r.action));
        }
        if (r.perfectClear) flashSlot("clear", "ALL CLEAR", "#ffd700");
        if (r.b2b && r.b2bCount > 0) flashSlot("b2b", `B2B <b>\xD7${r.b2bCount}</b>`, "#ffd24a");
        if (r.combo > 0) flashSlot("combo", `<b>${r.combo}</b> COMBO`, "#7cf29a");
        if (r.attack > 0) flashSlot("attack", `+${r.attack}`, r.attack >= 4 ? "#ff4d6d" : "#ffb347");
      },
      /**
       * Refresh numbers. Cheap to call every frame: the DOM only changes when text does.
       * @param {Object} s - { pieces, lines, level, score, keys, linesSent, elapsedMs,
       *   clockMs, urgent, primaryLabel, primaryValue, progress, finesseJudged, finesseFaults,
       *   tetrises }
       */
      update(s) {
        const mode = settings2.statsDisplay || "time";
        const sec = s.elapsedMs / 1e3;
        const pps = sec > 0 ? s.pieces / sec : 0;
        const apm = sec > 0 ? s.linesSent / (sec / 60) : 0;
        const kps = sec > 0 ? s.keys / sec : 0;
        const app = s.pieces > 0 ? s.linesSent / s.pieces : 0;
        const kpp = s.pieces > 0 ? s.keys / s.pieces : 0;
        const vs = sec > 0 ? s.linesSent / sec * 100 : 0;
        const finessePct = s.finesseJudged > 0 ? (s.finesseJudged - s.finesseFaults) / s.finesseJudged * 100 : 100;
        const clock = formatClock(s.clockMs);
        const timeRow = row("TIME", clock.main, clock.sub, `stat-time${s.urgent ? " urgent" : ""}`);
        const levelRow = modeId === "classic" || isOg ? row("LEVEL", s.level) : "";
        const tetrisRate = s.lines > 0 ? Math.round(s.tetrises * 4 / s.lines * 100) : 0;
        let rows = "";
        if (isOg) {
          if (mode === "off") rows = "";
          else if (mode === "speed") rows = levelRow + row("PPS", fixed(pps)) + row("KPS", fixed(kps)) + timeRow;
          else rows = levelRow + row("LINES", s.lines) + row("TETRIS RATE", `${tetrisRate}%`) + timeRow;
        } else {
          switch (mode) {
            case "off":
              rows = "";
              break;
            case "speed":
              rows = levelRow + row("PPS", fixed(pps)) + row("APM", fixed(apm, 1)) + row("KPS", fixed(kps)) + timeRow;
              break;
            case "efficiency":
              rows = levelRow + row("APP", fixed(app, 3)) + row("KPP", fixed(kpp)) + row("FINESSE", `${fixed(finessePct, 1)}%`) + timeRow;
              break;
            case "versus":
              rows = levelRow + row("APM", fixed(apm, 1)) + row("PPS", fixed(pps)) + row("VS", fixed(vs)) + timeRow;
              break;
            default:
              rows = levelRow + row("PIECES", s.pieces, `, ${fixed(pps)}/S`) + row("LINES", s.lines) + timeRow;
          }
        }
        setHtml(els.stats, "stats", rows);
        const score = isOg ? String(s.primaryValue).padStart(6, "0") : Number(s.primaryValue).toLocaleString();
        setHtml(
          els.under,
          "under",
          `<div class="under-value">${score}</div><div class="under-label">${s.primaryLabel}</div>`
        );
        setHtml(els.finesse, "finesse", mode === "off" || isOg ? "" : `<div class="stat-label">FINESSE</div><div class="stat-value">${s.finesseFaults}<span class="stat-sub">, ${fixed(finessePct)}%</span></div><div class="stat-small">${s.finesseFaults} FAULT${s.finesseFaults === 1 ? "" : "S"}</div>`);
        if (els.meter) {
          const pct = `${Math.round(Math.max(0, Math.min(1, s.progress)) * 1e3) / 10}%`;
          if (last.get("meter") !== pct) {
            last.set("meter", pct);
            els.meter.style.height = pct;
          }
        }
      },
      /** Clear the feed and cached text (new game). */
      reset() {
        last.clear();
        for (const el of Object.values(slots)) {
          el.classList.remove("show");
          el.innerHTML = "";
        }
      }
    };
  }

  // js/bounce.js
  var STIFFNESS = 320;
  var DAMPING = 20;
  var MAX_OFFSET = 18;
  function createBoardBounce(el, settings2) {
    let x = 0, y = 0, vx = 0, vy = 0;
    function apply() {
      if (!el) return;
      if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
        x = y = vx = vy = 0;
        el.style.transform = "";
        return;
      }
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${(x * 0.12).toFixed(3)}deg)`;
    }
    return {
      /** Add velocity in px/s (positive y is down). */
      kick(dx, dy) {
        const mul = effectLevel(settings2, "boardBounce");
        vx += dx * mul;
        vy += dy * mul;
      },
      /** Advance the spring by dt milliseconds. */
      update(dt) {
        const s = Math.min(dt, 50) / 1e3;
        vx += (-STIFFNESS * x - DAMPING * vx) * s;
        vy += (-STIFFNESS * y - DAMPING * vy) * s;
        x = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, x + vx * s));
        y = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, y + vy * s));
        apply();
      },
      reset() {
        x = y = vx = vy = 0;
        apply();
      }
    };
  }

  // js/finesse.js
  var EMPTY = createMatrix(COLS, BUFFER_ROWS);
  var tables = /* @__PURE__ */ new Map();
  function placementKey(matrix, x) {
    let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
    matrix.forEach((row, y) => row.forEach((v, cx) => {
      if (v) {
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }));
    const rows = [];
    for (let y = minY; y <= maxY; y++) {
      rows.push(matrix[y].slice(minX, maxX + 1).map((v) => v ? 1 : 0).join(""));
    }
    return `${rows.join("/")}@${x + minX}`;
  }
  function buildTable(shape) {
    const start = { shape, matrix: SHAPES[shape].matrix, rotation: 0, pos: getSpawnPos(SHAPES[shape].matrix) };
    const best = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    const queue = [[start, 0]];
    const stateKey = (p) => `${p.rotation}|${p.pos.x}|${p.pos.y}`;
    seen.add(stateKey(start));
    const copy = (p) => ({ shape: p.shape, matrix: p.matrix, rotation: p.rotation, pos: { ...p.pos } });
    const move = (p, dir, toWall) => {
      const n = copy(p);
      let moved = false;
      do {
        n.pos.x += dir;
        if (collide(EMPTY, n)) {
          n.pos.x -= dir;
          break;
        }
        moved = true;
      } while (toWall);
      return moved ? n : null;
    };
    const rotate2 = (p, dir) => {
      const n = copy(p);
      return tryRotate(n, EMPTY, collide, dir).success ? n : null;
    };
    while (queue.length) {
      const [p, d] = queue.shift();
      const key = placementKey(p.matrix, p.pos.x);
      if (!best.has(key) || best.get(key) > d) best.set(key, d);
      for (const next of [move(p, -1, false), move(p, 1, false), move(p, -1, true), move(p, 1, true), rotate2(p, 1), rotate2(p, -1)]) {
        if (!next) continue;
        const k = stateKey(next);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([next, d + 1]);
      }
    }
    return best;
  }
  function minimumInputs(shape, matrix, x) {
    if (!tables.has(shape)) tables.set(shape, buildTable(shape));
    return tables.get(shape).get(placementKey(matrix, x)) ?? null;
  }

  // js/game.js
  var BLITZ_MS2 = 12e4;
  var SPRINT_LINES = 40;
  var DANGER_ROWS = 4;
  var DANGER_INTERVAL_MS = 1e3;
  function createGame(config) {
    const { modeId, canvases: canvases2, playfield: playfield2, settings: settings2, soundEngine: soundEngine2, music: music2, onGameOver, onPause, onLevelUp } = config;
    const rules = getRules(modeId);
    const previewCount = () => rules.previewCount ?? (settings2.nextPreviewCount || 5);
    const arena = createMatrix(COLS, BUFFER_ROWS);
    const nextQueue = [];
    let lastShape = null;
    fillNext();
    const modeState = createModeState(modeId, { startLevel: settings2.classicStartLevel });
    const scoringState = createScoringState();
    const particles = createParticleSystem(settings2);
    const renderer = createRenderer(canvases2, settings2, rules.look);
    const hud = createHud(settings2, modeId);
    const bounce = createBoardBounce(playfield2, settings2);
    let finesseJudged = 0;
    let finesseFaults = 0;
    renderer.resizeNextCanvas(previewCount());
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
    const style = GAME_STYLES[rules.style || settings2.gameStyle] || GAME_STYLES.modern;
    let active = false;
    let freezeTimer = 0;
    let flash = null;
    let inDanger = false;
    let dangerTimer = 0;
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
      // Classic soft drop is a fixed speed (never slower than gravity), not the SDF setting
      getSoftDropInterval: rules.lock === "gravity" ? () => Math.min(dropInterval, SOFT_DROP_FRAMES * NES_FRAME_MS) : void 0,
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
      }
    });
    function fillNext() {
      if (rules.randomizer === "classic") fillClassicQueue(nextQueue, lastShape);
      else fillQueue(nextQueue);
    }
    function placeAtSpawn() {
      player.matrix = rules.rotation === "classic" ? classicMatrix(player.shape) : SHAPES[player.shape].matrix;
      player.rotation = 0;
      const spawn = rules.spawn === "inside" ? getClassicSpawnPos(player.matrix) : getSpawnPos(player.matrix);
      player.pos.x = spawn.x;
      player.pos.y = spawn.y;
    }
    function spawnPiece() {
      fillNext();
      player.shape = nextQueue.shift();
      lastShape = player.shape;
      placeAtSpawn();
      player.canHold = true;
      active = true;
      flash = null;
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
      if (!active) return 0;
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
        if (moved < cells && moved >= 3) bounce.kick(dir * (30 + moved * 12), 0);
      }
      return moved;
    }
    function playerRotate(dir) {
      if (!active) return;
      const result = (rules.rotation === "classic" ? tryRotateClassic : tryRotate)(player, arena, collide, dir);
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
      if (!active) return 0;
      let dropped = 0;
      while (dropped < cells && !playerDrop()) {
        dropped++;
      }
      if (dropped > 0) {
        modeState.addScore(dropped);
        playSound("softdrop");
      } else if (rules.lock === "gravity") {
        lockPiece();
      }
      return dropped;
    }
    function hardDrop() {
      if (!active || !rules.hardDrop) return;
      let rows = 0;
      while (!playerDrop()) {
        rows++;
      }
      modeState.addScore(rows * 2);
      playSound("harddrop");
      bounce.kick(0, 50 + Math.min(rows, 20) * 6);
      lockPiece(rows);
    }
    function holdPiece() {
      if (!active || !rules.hold || !player.canHold) return;
      if (player.held === null) {
        player.held = player.shape;
        spawnPiece();
      } else {
        const temp = player.shape;
        player.shape = player.held;
        player.held = temp;
        placeAtSpawn();
        input.cutDas();
      }
      input.resetPieceInputs();
      player.canHold = false;
      dropCounter = 0;
      lockTimer = 0;
      lockMoves = 0;
      lastWasRotation = false;
      lastKickIndex = -1;
      playSound("hold");
    }
    function resetLockTimer() {
      if (rules.lock === "gravity") return;
      if (isGrounded(arena, player)) {
        lockMoves++;
        if (lockMoves < MAX_LOCK_MOVES) {
          lockTimer = 0;
        }
      }
    }
    function lockPiece(dropRows = 0) {
      const lockedOut = player.matrix.every((row, y) => row.every((v) => !v || player.pos.y + y < BUFFER_ROWS - VISIBLE_ROWS));
      const used = input.takePieceInputs();
      if (rules.finesse && !used.softDrop) {
        const min = minimumInputs(player.shape, player.matrix, player.pos.x);
        if (min !== null) {
          finesseJudged++;
          if (used.inputs > min) finesseFaults++;
        }
      }
      const tSpinType = rules.scoring === "modern" ? detectTSpin(arena, player, lastWasRotation, lastKickIndex) : "none";
      const arenaSnapshot = arena.map((row) => [...row]);
      merge(arena, player);
      modeState.addPiece();
      const lockedArena = arena.map((row) => [...row]);
      if (rules.effects) {
        particles.spawnPlacement({
          shape: player.shape,
          matrix: player.matrix.map((row) => [...row]),
          pos: { ...player.pos }
        }, dropRows);
      }
      if (rules.lock === "gravity") input.cancelSoftDrop();
      if (lockedOut) {
        modeState.setGameOver();
        playSound("gameOver");
        endGame();
        return;
      }
      const { linesCleared, clearedRows } = clearLines(arena);
      const scoreResult = rules.scoring === "classic" ? calculateClassicScore(linesCleared, modeState.stats.level) : calculateScore(linesCleared, tSpinType, scoringState, modeState.stats.level, arena);
      if (scoreResult.points > 0) {
        modeState.addScore(scoreResult.points);
      }
      if (linesCleared > 0) {
        const levelBefore = modeState.stats.level;
        modeState.addLines(linesCleared);
        dropInterval = modeState.getDropInterval();
        if (modeState.stats.level > levelBefore) {
          playSound("levelUp");
          onLevelUp?.(modeState.stats.level);
        }
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
      if (rules.effects) {
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
      }
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
      const attack = rules.attack ? calculateAttack(scoreResult) : 0;
      if (attack > 0) {
        modeState.addAttack(attack);
        particles.spawnAttack(clearedRows, attack);
        playSound("attack", attack);
      }
      if (scoreResult.action || scoreResult.perfectClear) hud.onClear({ ...scoreResult, attack });
      if (rules.effects && linesCleared > 0) bounce.kick(0, 60 + linesCleared * 45 + attack * 10);
      updateDanger();
      if (modeState.isCompleted()) {
        endGame();
        return;
      }
      const clearDelay = linesCleared === 0 ? 0 : attack >= BIG_HIT_LINES ? style.bigHitDelay : style.lineClearDelay;
      const wait = clearDelay + style.entryDelay;
      if (wait > 0) {
        active = false;
        freezeTimer = wait;
        flash = clearDelay > 0 ? { arena: lockedArena, rows: clearedRows, duration: clearDelay, elapsed: 0, big: linesCleared >= 4 } : null;
      } else {
        spawnPiece();
      }
    }
    function updateDanger() {
      if (!rules.danger) return;
      const top = arena.findIndex((row) => row.some((v) => v !== 0));
      const danger = top !== -1 && top < BUFFER_ROWS - VISIBLE_ROWS + DANGER_ROWS;
      if (danger && !inDanger) dangerTimer = 0;
      inDanger = danger;
      canvases2.board.classList.toggle("board-danger", inDanger);
    }
    function updateMusic() {
      if (!music2) return;
      const choice = settings2.soundtrack || "auto";
      if (choice === "off") {
        music2.setTrack(null);
        return;
      }
      const heated = choice === "auto" && modeState.isHeated();
      music2.setTrack(heated ? "intense" : choice === "auto" ? MODE_INFO[modeId].track : choice);
      const levelBoost = modeId === "classic" && !heated ? (modeState.stats.level - 1) * 0.012 : 0;
      music2.setTempoScale(1 + Math.min(levelBoost, 0.12));
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
      updateMusic();
      if (inDanger) {
        dangerTimer -= deltaTime;
        if (dangerTimer <= 0) {
          playSound("danger");
          dangerTimer = DANGER_INTERVAL_MS;
        }
      }
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
      if (active) {
        dropCounter += deltaTime;
        if (dropCounter >= dropInterval - 1) {
          const carry = dropCounter - dropInterval;
          playerDrop();
          dropCounter = Math.min(Math.max(carry, 0), dropInterval);
        }
        if (isGrounded(arena, player)) {
          lockTimer += deltaTime;
          const lockDelay = rules.lock === "gravity" ? dropInterval : settings2.lockDelay || 500;
          if (lockTimer >= lockDelay) {
            lockPiece();
          }
        } else {
          lockTimer = 0;
        }
      } else if (running) {
        freezeTimer -= deltaTime;
        if (flash) {
          flash.elapsed += deltaTime;
          if (flash.elapsed >= flash.duration) flash = null;
        }
        if (freezeTimer <= 0) spawnPiece();
      }
      particles.update(deltaTime);
      bounce.update(deltaTime);
      const ghostY = active && rules.ghost ? getGhostY(arena, player) : void 0;
      renderer.draw({
        arena: flash ? flash.arena : arena,
        player: active ? player : null,
        flash: flash ? { rows: flash.rows, progress: flash.elapsed / flash.duration } : null,
        level: modeState.stats.level,
        nextQueue,
        held: player.held,
        holdLocked: !player.canHold,
        danger: inDanger,
        time,
        particles,
        shake: particles.getShake(),
        ghostY
      });
      updateHUD();
      animFrameId = requestAnimationFrame(update);
    }
    function updateHUD() {
      const elapsed = modeState.getElapsedMs();
      const stats = modeState.stats;
      const remaining = BLITZ_MS2 - elapsed;
      hud.update({
        pieces: stats.piecesPlaced,
        lines: stats.linesCleared,
        level: stats.level,
        keys: input.getKeyCount(),
        linesSent: stats.linesSent,
        elapsedMs: elapsed,
        clockMs: modeId === "blitz" ? remaining : elapsed,
        urgent: modeId === "blitz" && remaining <= 1e4,
        primaryLabel: modeState.getPrimaryStatLabel(),
        primaryValue: modeState.getPrimaryStatValue(),
        tetrises: stats.tetrises,
        progress: modeId === "sprint" ? stats.linesCleared / SPRINT_LINES : modeId === "blitz" ? remaining / BLITZ_MS2 : modeState.getLevelProgress(),
        finesseJudged,
        finesseFaults
      });
    }
    function playSound(name, ...args) {
      if (soundEngine2) {
        soundEngine2.play(name, ...args);
      }
    }
    function startGame() {
      arena.forEach((row) => row.fill(0));
      nextQueue.length = 0;
      lastShape = null;
      fillNext();
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
      active = false;
      freezeTimer = 0;
      flash = null;
      inDanger = false;
      canvases2.board.classList.remove("board-danger");
      finesseJudged = 0;
      finesseFaults = 0;
      hud.reset();
      bounce.reset();
      input.resetCounts();
      dropInterval = modeState.getDropInterval();
      renderer.resizeNextCanvas(previewCount());
      soundEngine2?.setPack?.(rules.soundPack);
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
      music2?.setPaused(true);
      if (onPause) onPause();
    }
    function resumeGame() {
      if (!running) return;
      paused = false;
      lastTime = performance.now();
      modeState.resume();
      input.setEnabled(true);
      input.resetState();
      music2?.setPaused(false);
    }
    function endGame() {
      running = false;
      input.setEnabled(false);
      canvases2.board.classList.remove("board-danger");
      setTimeout(() => {
        if (onGameOver) {
          const results = modeState.getResults();
          const sec = modeState.getElapsedMs() / 1e3;
          results.pps = sec > 0 ? results.piecesPlaced / sec : 0;
          results.finesse = finesseJudged > 0 ? (finesseJudged - finesseFaults) / finesseJudged * 100 : 100;
          results.finesseFaults = finesseFaults;
          onGameOver(results);
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
      bounce.reset();
      music2?.setPaused(false);
      soundEngine2?.setPack?.(null);
      canvases2.board.classList.remove("board-danger");
    }
    return {
      start: startGame,
      pause: pauseGame,
      resume: resumeGame,
      destroy,
      isRunning() {
        return running;
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
  var playfield = document.getElementById("playfield");
  var background = createBackground(
    document.getElementById("bg-canvas"),
    document.getElementById("bg-layer"),
    settings
  );
  background.showMenu();
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
  var music = createMusicEngine(settings);
  if (musicPlayer) music.setSuppressor(() => musicPlayer.isPlaying());
  function menuTrack() {
    const choice = settings.soundtrack || "auto";
    if (choice === "off") return null;
    return choice === "auto" ? "calm" : choice;
  }
  function unlockAudio() {
    music.unlock();
    document.removeEventListener("pointerdown", unlockAudio);
    document.removeEventListener("keydown", unlockAudio);
  }
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  music.setTrack(menuTrack());
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
    music.setTempoScale(1);
    music.setTrack(menuTrack());
    background.showMenu();
  });
  var ogFontLoaded = false;
  function applyClassicFont() {
    gameContainer.classList.toggle("og-font", settings.classicFont === "og" && ogFontLoaded);
  }
  document.fonts?.load('16px "Press Start 2P"').then((faces) => {
    ogFontLoaded = faces.length > 0;
    applyClassicFont();
  }).catch(() => {
  });
  function fitGame() {
    const height = gameContainer.classList.contains("mode-og") ? 700 : 780;
    const scale = Math.min(1, (window.innerHeight - 16) / height, (window.innerWidth - 16) / 700);
    gameContainer.style.transform = scale < 1 ? `scale(${scale})` : "";
  }
  window.addEventListener("resize", fitGame);
  fitGame();
  gameContainer.classList.add("game-hidden");
  menu.showScreen("main");
  function startNewGame(modeId) {
    if (currentGame) {
      currentGame.destroy();
    }
    gameContainer.classList.toggle("mode-og", modeId === "og");
    applyClassicFont();
    fitGame();
    background.showMode(modeId, modeId === "og" ? settings.classicStartLevel : 1);
    currentGame = createGame({
      modeId,
      canvases,
      playfield,
      settings,
      soundEngine,
      music,
      onGameOver(results) {
        music.setTempoScale(1);
        music.setTrack(menuTrack());
        menu.showResults(results);
      },
      onPause() {
        menu.showScreen("pause");
      },
      onLevelUp(level) {
        background.onLevel(modeId, level);
      }
    });
    currentGame._modeId = modeId;
    currentGame.start();
  }
  var SOUND_PACK_LABELS = { ulol: "uloltris", arcade: "Arcade (Jstris-style)", bubbly: "Bubbly (PPT-style)", nes: "8-bit (console-style)" };
  function describeSoundPack(val) {
    return SOUND_PACK_LABELS[val] || val;
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
        { key: "soundPack", label: "SOUND PACK", type: "enum", values: ["ulol", "arcade", "bubbly", "nes"], describe: describeSoundPack },
        { key: "soundtrack", label: "SOUNDTRACK", type: "enum", values: ["auto", "calm", "competitive", "intense", "chip", "off"], describe: describeSoundtrack },
        { key: "crossfadeDuration", label: "CROSSFADE", type: "range", describe: describeCrossfade }
      ] },
      { id: "visual", label: "VISUAL", settings: [
        { key: "blockSkin", label: "BLOCK SKIN", type: "enum", values: SKINS, describe: describeSkin },
        { key: "statsDisplay", label: "STATS DISPLAY", type: "enum", values: ["off", "time", "speed", "efficiency", "versus"], describe: describeStatsDisplay },
        { key: "background", label: "BACKGROUND", type: "enum", values: ["on", "dim", "off"], describe: describeEnum },
        { key: "casualScene", label: "CASUAL SCENE", type: "enum", values: ["cycle", ...CASUAL_SCENES], describe: describeScene },
        { key: "classicScene", label: "CLASSIC SCENE", type: "enum", values: ["cycle", ...CLASSIC_SCENES], describe: describeScene },
        { key: "classicFont", label: "CLASSIC FONT", type: "enum", values: ["og", "ulol"], describe: describeClassicFont },
        { key: "ghostOpacity", label: "GHOST OPACITY", type: "range", describe: describeOpacity },
        { key: "showActionText", label: "CLEAR TEXT", type: "toggle" }
      ] },
      { id: "effects", label: "FX", settings: [
        { key: "boardBounce", label: "BOARD BOUNCE", type: "enum", values: ["off", "low", "medium", "high"], describe: describeEnum },
        { key: "placeImpact", label: "PLACE IMPACT", type: "enum", values: ["off", "low", "medium", "high"], describe: describeEnum },
        { key: "clearEffects", label: "CLEAR EFFECTS", type: "enum", values: ["off", "low", "medium", "high"], describe: describeEnum },
        { key: "screenShake", label: "SCREEN SHAKE", type: "enum", values: ["off", "low", "medium", "high"], describe: describeEnum }
      ] },
      { id: "gameplay", label: "GAME", settings: [
        { key: "gameStyle", label: "GAME STYLE", type: "enum", values: ["modern", "battle"], describe: describeGameStyle },
        { key: "nextPreviewCount", label: "NEXT PIECES", type: "range", describe: describePreviewCount },
        { key: "lockDelay", label: "LOCK DELAY", type: "range", describe: describeLockDelay },
        { key: "classicStartLevel", label: "CLASSIC START LEVEL", type: "range", describe: describeStartLevel }
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
        if (key === "soundtrack" && !currentGame?.isRunning()) music.setTrack(menuTrack());
        if (key === "soundPack") soundEngine?.play("rotate");
        if (key === "classicFont") applyClassicFont();
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
