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
    // 'auto', 'calm', 'competitive', 'intense', 'off'
    ambience: true,
    // background sounds that match the scene (rain, birds, wind)
    ambienceVolume: 60,
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
    weather: "default",
    // 'default' (each scene's own look), 'cycle' (by level), or one of VARIANTS
    ghostOpacity: 40,
    // 0-100
    showActionText: true,
    blockSkin: "ulol",
    // one of SKINS in skins.js
    soundPack: "ulol",
    // 'ulol', 'arcade' (Jstris-style), 'bubbly' (PPT-style)
    // Gameplay
    nextPreviewCount: 5,
    // 1-6
    lockDelay: 500,
    // ms
    gameStyle: "modern",
    // 'modern' (TETR.IO, Jstris) or 'battle' (Tetris 99, PPT)
    touchControls: "auto"
    // on-screen buttons: 'auto' (touch devices), 'on', 'off'
  };
  var CONSTRAINTS = {
    arr: { min: 0, max: 5, step: 0.1 },
    das: { min: 1, max: 20, step: 0.1 },
    dcd: { min: 0, max: 20, step: 0.1 },
    sdf: { min: 5, max: SDF_INFINITE, step: 1 },
    masterVolume: { min: 0, max: 100, step: 1 },
    sfxVolume: { min: 0, max: 100, step: 1 },
    musicVolume: { min: 0, max: 100, step: 1 },
    ambienceVolume: { min: 0, max: 100, step: 1 },
    crossfadeDuration: { min: 0, max: 5, step: 0.5 },
    ghostOpacity: { min: 0, max: 100, step: 5 },
    nextPreviewCount: { min: 1, max: 6, step: 1 },
    lockDelay: { min: 100, max: 2e3, step: 50 }
  };
  var ENUMS = {
    screenShake: ["off", "low", "medium", "high"],
    boardBounce: ["off", "low", "medium", "high"],
    placeImpact: ["off", "low", "medium", "high"],
    clearEffects: ["off", "low", "medium", "high"],
    statsDisplay: ["off", "time", "speed", "efficiency", "versus"],
    background: ["on", "dim", "off"],
    casualScene: ["cycle", "bamboo", "wheat", "sakura", "village", "falls", "castle", "ocean", "aurora", "neon"],
    weather: ["default", "cycle", "sunny", "cloudy", "sunset", "rain", "thunder", "night", "nightthunder"],
    soundtrack: ["auto", "calm", "competitive", "intense", "off"],
    gameStyle: ["modern", "battle"],
    blockSkin: ["ulol", "classic", "glossy", "flat", "neon"],
    soundPack: ["ulol", "arcade", "bubbly"],
    touchControls: ["auto", "on", "off"]
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
    if (typeof source.ambience === "boolean") result.ambience = source.ambience;
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
    return val === "auto" ? "Auto (by mode)" : describeEnum(val);
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
      const pad2 = Math.max(1, s * 0.03);
      const path = () => {
        ctx.beginPath();
        ctx.roundRect(pad2, pad2, s - pad2 * 2, s - pad2 * 2, r);
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
      const hl = ctx.createLinearGradient(0, pad2, 0, s * 0.5);
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

  // js/scenes/atmosphere.js
  var VARIANTS = ["sunny", "cloudy", "sunset", "rain", "thunder", "night", "nightthunder"];
  var CYCLE_ORDER = ["sunny", "cloudy", "rain", "thunder", "sunset", "night", "nightthunder"];
  var VARIANT_INFO = {
    sunny: {
      name: "Sunny",
      sky: ["#2f7fd0", "#4a97dc", "#6cb0e6", "#93c8ee", "#bfe0f4", "#e2f2f8"],
      lit: 0,
      stars: 0,
      rain: 0,
      storm: false,
      wind: 0.3,
      grade: { sat: 1.04, bright: 1, mul: [1, 1, 1], tint: [255, 240, 200], mix: 0.03 },
      clouds: {
        far: { count: 4, size: [3, 6], light: "#ffffff", dark: "#d5e6f4", y: [40, 100], speed: 1.2 },
        near: { count: 5, size: [5, 10], light: "#ffffff", dark: "#c8dff2", y: [14, 80], speed: 2.5 }
      },
      fog: null
    },
    cloudy: {
      name: "Cloudy",
      sky: ["#76889e", "#8797ab", "#9aa9b9", "#adb9c6", "#c0cad3", "#d2d9de"],
      lit: 0.1,
      stars: 0,
      rain: 0,
      storm: false,
      wind: 0.5,
      grade: { sat: 0.72, bright: 0.9, mul: [0.97, 1, 1.03], tint: [160, 172, 190], mix: 0.08 },
      clouds: {
        far: { count: 9, size: [8, 14], light: "#dfe4e8", dark: "#b3bdc7", y: [4, 75], speed: 3 },
        near: { count: 8, size: [10, 18], light: "#c9d0d6", dark: "#94a0ad", y: [8, 90], speed: 5 }
      },
      fog: { color: "#c8d0d8", alpha: 0.22, density: 0.6 }
    },
    sunset: {
      name: "Sunset",
      sky: ["#2a1b40", "#4e2a5a", "#8c3b5f", "#cc5d5b", "#ec935d", "#f7c374"],
      lit: 0.55,
      stars: 0.15,
      rain: 0,
      storm: false,
      wind: 0.3,
      grade: { sat: 1.05, bright: 0.84, mul: [1.08, 0.86, 0.74], tint: [255, 130, 70], mix: 0.1 },
      clouds: {
        far: { count: 5, size: [3, 6], light: "#e0a0a0", dark: "#a86a80", y: [40, 100], speed: 1.2 },
        near: { count: 8, size: [5, 10], light: "#f8bf9c", dark: "#c97c80", y: [12, 80], speed: 2.5 }
      },
      fog: { color: "#f0a070", alpha: 0.25, density: 0.7 }
    },
    rain: {
      name: "Cloudy (Rain)",
      sky: ["#3d4856", "#4a5664", "#5a6673", "#6b7783", "#7d8892", "#8f9aa3"],
      lit: 0.25,
      stars: 0,
      rain: 0.55,
      storm: false,
      wind: 0.6,
      grade: { sat: 0.55, bright: 0.72, mul: [0.92, 0.98, 1.05], tint: [130, 150, 175], mix: 0.14 },
      clouds: {
        far: { count: 12, size: [10, 18], light: "#8b96a1", dark: "#66717d", y: [0, 60], speed: 4 },
        near: { count: 12, size: [12, 20], light: "#727d89", dark: "#4d5762", y: [0, 70], speed: 7 }
      },
      fog: { color: "#a9b7c2", alpha: 0.32, density: 0.85 }
    },
    thunder: {
      name: "Thunderstorm",
      sky: ["#1a202c", "#252d3b", "#323b4a", "#414b5a", "#535d6b", "#667080"],
      lit: 0.45,
      stars: 0,
      rain: 1,
      storm: true,
      wind: 1.4,
      grade: { sat: 0.42, bright: 0.5, mul: [0.9, 0.96, 1.08], tint: [90, 110, 145], mix: 0.18 },
      clouds: {
        far: { count: 14, size: [10, 18], light: "#3c4554", dark: "#262d3a", y: [0, 60], speed: 6 },
        near: { count: 12, size: [12, 22], light: "#2b3240", dark: "#1b202b", y: [0, 70], speed: 12 }
      },
      fog: { color: "#6c7886", alpha: 0.36, density: 0.9 }
    },
    night: {
      name: "Night",
      sky: ["#050818", "#0a1030", "#101a44", "#182658", "#22336a", "#2e4078"],
      lit: 1,
      stars: 1,
      rain: 0,
      storm: false,
      wind: 0.3,
      grade: { sat: 0.55, bright: 0.34, mul: [0.62, 0.74, 1.18], tint: [40, 60, 120], mix: 0.12 },
      clouds: {
        far: null,
        near: { count: 6, size: [5, 10], light: "#3a4a7e", dark: "#232e5a", y: [14, 80], speed: 2 }
      },
      fog: { color: "#3a4a7a", alpha: 0.25, density: 0.7 }
    },
    nightthunder: {
      name: "Night Thunderstorm",
      sky: ["#04050c", "#080b16", "#0d121f", "#141a28", "#1c2333", "#262e40"],
      lit: 1,
      stars: 0,
      rain: 1,
      storm: true,
      wind: 1.4,
      grade: { sat: 0.4, bright: 0.24, mul: [0.65, 0.75, 1.15], tint: [30, 45, 90], mix: 0.14 },
      clouds: {
        far: { count: 12, size: [10, 18], light: "#20263a", dark: "#131722", y: [0, 60], speed: 6 },
        near: { count: 10, size: [12, 20], light: "#171b28", dark: "#0d0f17", y: [0, 70], speed: 12 }
      },
      fog: { color: "#2a3348", alpha: 0.3, density: 0.8 }
    }
  };
  var STRIKE_PERIOD = { thunder: 6.5, nightthunder: 5.5 };
  var FLASH_S = 0.5;
  function describeWeather(id) {
    if (id === "default") return "Scene default";
    if (id === "cycle") return "Cycle by level";
    return VARIANT_INFO[id]?.name || id;
  }
  function cycleVariant(level) {
    return CYCLE_ORDER[(Math.max(1, level) - 1) % CYCLE_ORDER.length];
  }
  function ambienceFor(scene, variantId) {
    const v = VARIANT_INFO[variantId];
    const s = scene.sounds || {};
    const out = { ...s.always };
    const wet = v.rain > 0;
    const hush = v.storm ? 0 : wet ? 0.25 : 1;
    for (const [name, level] of Object.entries((v.lit >= 0.7 ? s.night : s.day) || {})) {
      if (level * hush > 0) out[name] = Math.max(out[name] || 0, level * hush);
    }
    if (wet && scene.precip !== "snow") out[v.storm ? "storm" : "rain"] = v.storm ? 1 : 0.9;
    if (v.storm) {
      out.thunder = 1;
      out.gale = 0.4;
    }
    const wind = Math.min(1, (out.wind || 0) + v.wind * (v.storm ? 0.2 : 0.5));
    if (wind > 0.05) out.wind = wind;
    if (out.wheat) out.wheat *= 0.55 + 0.45 * Math.min(1, v.wind);
    return out;
  }
  function makeGrade({ sat, bright, mul, tint, mix: mix2 }) {
    if (sat === 1 && bright === 1 && mix2 === 0 && mul.every((m) => m === 1)) return null;
    return (r, g, b) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const out = [r, g, b];
      for (let i = 0; i < 3; i++) {
        let v = lum + (out[i] - lum) * sat;
        v += (tint[i] - v) * mix2;
        out[i] = Math.max(0, Math.min(255, Math.round(v * mul[i] * bright)));
      }
      return out;
    };
  }
  function drawBolt(ctx, seed, x0, groundY, color) {
    const r = rng(seed);
    let x = x0;
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
    for (const [x0p, y0p, x1p, y1p, branch2] of paths) {
      const steps = Math.ceil(Math.max(Math.abs(x1p - x0p), Math.abs(y1p - y0p)));
      for (let i = 0; i <= steps; i++) {
        const bx = x0p + (x1p - x0p) * (i / steps);
        const by = y0p + (y1p - y0p) * (i / steps);
        if (!branch2) px(ctx, bx - 1, by, "#7fa8ff");
        px(ctx, bx, by, branch2 ? "#b8d0ff" : color);
      }
    }
  }
  function createEnv(variantId, meta = {}) {
    const info = VARIANT_INFO[variantId];
    const horizon = meta.horizon ?? 118;
    const cel = { sunX: 232, sunHighY: 34, sunLowY: horizon - 18, moonX: 70, moonY: 34, ...meta.celestial };
    const gradeFn = makeGrade(info.grade);
    const colors = /* @__PURE__ */ new Map();
    const period = STRIKE_PERIOD[variantId] || 0;
    const snow = meta.precip === "snow";
    function strike(n) {
      const r = rng(n * 7919 + 13);
      return { time: n * period + r() * period * 0.7, distance: 0.08 + r() * 0.75, seed: n * 7 + 1, x: 30 + r() * 260 };
    }
    function flashAt(t) {
      if (!period) return { flash: 0, bolt: null };
      let flash = 0;
      let bolt = null;
      const n = Math.floor(t / period);
      for (const k of [n - 1, n]) {
        const s = strike(k);
        const since = t - s.time;
        if (since < 0 || since >= FLASH_S) continue;
        const f = (1 - since / FLASH_S) * (Math.sin(since * 60) > -0.3 ? 1 : 0.4) * (1 - s.distance * 0.6);
        if (f > flash) flash = f;
        if (since < 0.25 && s.distance < 0.6) bolt = s;
      }
      return { flash, bolt };
    }
    const env = {
      id: variantId,
      info,
      meta,
      lit: info.lit,
      rain: info.rain,
      storm: info.storm,
      wind: info.wind,
      night: info.lit >= 0.7,
      /** Where the sun or moon is: { x, y, kind: 'sun' | 'moon' | null }. Set by makeSky(). */
      sun: { x: cel.sunX, y: cel.sunHighY, kind: null },
      /** Grade RGBA pixel data in place (ImageData.data) and return it. */
      gradeData(d) {
        if (!gradeFn) return d;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          const [r, g, b] = gradeFn(d[i], d[i + 1], d[i + 2]);
          d[i] = r;
          d[i + 1] = g;
          d[i + 2] = b;
        }
        return d;
      },
      /** Grade a layer's canvas in place and return it. */
      grade(canvas) {
        if (!gradeFn) return canvas;
        const ctx = canvas.getContext("2d");
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        env.gradeData(img.data);
        ctx.putImageData(img, 0, 0);
        return canvas;
      },
      /** A '#rrggbb' color as graded [r, g, b], for things drawn every frame. */
      rgb(hex) {
        const c = parseColor(hex);
        return gradeFn ? gradeFn(c[0], c[1], c[2]) : c;
      },
      /** A '#rrggbb' color graded, as a CSS rgba() string with the given alpha. */
      rgba(hex, alpha) {
        const [r, g, b] = env.rgb(hex);
        return `rgba(${r},${g},${b},${alpha})`;
      },
      /** A '#rrggbb' color graded, as a CSS string. */
      c(hex) {
        let v = colors.get(hex);
        if (!v) {
          const [r, g, b] = env.rgb(hex);
          v = `rgb(${r},${g},${b})`;
          colors.set(hex, v);
        }
        return v;
      },
      /**
       * The sky: gradient, sun or moon, stars, clouds and lightning.
       * @param {Object} [o] - { horizon, palette, noSun }
       * @returns {{ canvas: HTMLCanvasElement, draw: (ctx, t) => void }} `canvas` is the
       *   still sky (no clouds), which reflections can copy.
       */
      makeSky(o = {}) {
        const hor = o.horizon ?? horizon;
        const still = layer();
        const s = still.ctx;
        ditherGradient(s, 0, 0, W, hor + 4, o.palette || info.sky);
        if (!o.noSun) {
          if (variantId === "sunny") {
            env.sun = { x: cel.sunX, y: cel.sunHighY, kind: "sun" };
            glow(s, cel.sunX, cel.sunHighY, 38, "#f4fbff", 0.5);
            disc(s, cel.sunX, cel.sunHighY, 11, "#fffbe0");
            disc(s, cel.sunX, cel.sunHighY, 9, "#ffffff");
          } else if (variantId === "sunset") {
            env.sun = { x: cel.sunX, y: cel.sunLowY, kind: "sun" };
            glow(s, cel.sunX, cel.sunLowY, 48, "#f5a36d", 0.55);
            disc(s, cel.sunX, cel.sunLowY, 15, "#f7b070");
            disc(s, cel.sunX, cel.sunLowY, 12, "#ffd79a");
          } else if (variantId === "cloudy") {
            glow(s, cel.sunX, cel.sunHighY + 10, 42, "#f4f6f8", 0.4);
          } else if (variantId === "night") {
            env.sun = { x: cel.moonX, y: cel.moonY, kind: "moon" };
            glow(s, cel.moonX, cel.moonY, 28, "#2a3a70", 0.7);
            disc(s, cel.moonX, cel.moonY, 11, "#f2ecd0");
            px(s, cel.moonX - 4, cel.moonY - 3, "#d9d0ac");
            rect(s, cel.moonX + 2, cel.moonY + 1, 2, 2, "#d9d0ac");
            px(s, cel.moonX + 5, cel.moonY - 5, "#d9d0ac");
            rect(s, cel.moonX - 5, cel.moonY + 3, 2, 1, "#d9d0ac");
          } else if (variantId === "nightthunder") {
            glow(s, cel.moonX, cel.moonY, 30, "#2c3446", 0.4);
          }
        }
        const haze = variantId === "sunny" ? "#e2f2f8" : info.sky[info.sky.length - 1];
        hazeBand(s, hor - 22, hor + 4, haze, 0.45, 0.9);
        const rs = rng(4321);
        const stars = info.stars > 0 ? Array.from({ length: Math.round(80 * info.stars) }, () => ({ x: Math.floor(rs() * W), y: Math.floor(rs() * hor * 0.8), p: rs() * 10, big: rs() < 0.1 })) : [];
        const strips = [];
        for (const spec of [info.clouds.far, info.clouds.near]) {
          if (!spec) continue;
          const strip = layer(W * 2, hor);
          const cr = rng(spec.count * 131 + spec.size[1]);
          for (let i = 0; i < spec.count; i++) {
            const y = Math.min(hor - 12, spec.y[0] + cr() * (spec.y[1] - spec.y[0]));
            cloud(strip.ctx, cr() * W * 2, y, spec.size[0] + cr() * (spec.size[1] - spec.size[0]), spec.light, spec.dark, 700 + i * 13);
          }
          strips.push({ canvas: strip.canvas, speed: spec.speed });
        }
        return {
          canvas: still.canvas,
          draw(ctx, t) {
            ctx.drawImage(still.canvas, 0, 0);
            for (const st of stars) {
              const tw = Math.sin(t * 1.5 + st.p);
              if (tw < -0.4) continue;
              px(ctx, st.x, st.y, tw > 0.6 ? "#ffffff" : "#8f9fe0");
              if (st.big && tw > 0.5) {
                px(ctx, st.x - 1, st.y, "#6f7fc0");
                px(ctx, st.x + 1, st.y, "#6f7fc0");
                px(ctx, st.x, st.y - 1, "#6f7fc0");
                px(ctx, st.x, st.y + 1, "#6f7fc0");
              }
            }
            const { flash, bolt } = flashAt(t);
            strips.forEach((st, i) => {
              if (i === strips.length - 1 && bolt) drawBolt(ctx, bolt.seed, bolt.x, hor - 6, "#ffffff");
              const x = Math.round(wrap(t * st.speed, W * 2));
              ctx.drawImage(st.canvas, -x, 0);
              ctx.drawImage(st.canvas, W * 2 - x, 0);
            });
            if (flash > 0) {
              ctx.fillStyle = `rgba(210, 225, 255, ${flash * 0.4})`;
              ctx.fillRect(0, 0, W, hor + 4);
            }
          }
        };
      },
      /**
       * Report lightning strikes that have just happened.
       * @param {number} t - scene time in seconds
       * @param {(strike: { distance: number }) => void} fire
       */
      poll(t, fire) {
        if (!period) return;
        const n = Math.floor(t / period);
        for (const k of [n - 1, n]) {
          if (k <= lastFired) continue;
          const s = strike(k);
          if (t < s.time) continue;
          lastFired = k;
          if (t - s.time < 0.6) fire({ distance: s.distance });
        }
      },
      /** Weather in front of the scene: fog, rain or snow, splashes and the lightning flash. */
      overlay(ctx, t) {
        if (fogLayer) {
          ctx.drawImage(fogLayer, Math.round(Math.sin(t * 0.07) * 8), 0);
        }
        if (particles.length) {
          const slant = info.storm ? 0.5 : 0.25;
          if (snow) {
            for (const p of particles) {
              const y = wrap(p.y + t * p.speed, H + 6) - 3;
              const x = wrap(p.x + Math.sin(t * 0.8 + p.phase) * 6 - t * info.wind * 22, W + 6) - 3;
              ctx.fillStyle = env.c("#eef4ff");
              ctx.globalAlpha = p.alpha;
              ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
            }
            ctx.globalAlpha = 1;
          } else {
            for (const bright of [false, true]) {
              ctx.fillStyle = bright ? dropBright : dropDim;
              for (const p of particles) {
                if (p.bright !== bright) continue;
                const y = wrap(p.y + t * p.speed, H + 10) - 5;
                const x = wrap(p.x - y * slant - t * 4, W + 80) - 40;
                for (let k = 0; k < p.len; k++) ctx.fillRect(Math.round(x + k * slant), Math.round(y - k), 1, 1);
              }
            }
            const [y0, y1] = meta.rainBand || [H - 16, H - 2];
            const sr = rng(Math.floor(t * 10));
            const rings = Math.round(info.rain * 26);
            ctx.fillStyle = splash;
            for (let i = 0; i < rings; i++) {
              const sx = Math.floor(sr() * W);
              const sy = Math.floor(y0 + sr() * (y1 - y0));
              ctx.fillRect(sx - 1, sy, 1, 1);
              ctx.fillRect(sx + 1, sy, 1, 1);
              ctx.fillRect(sx, sy - 1, 1, 1);
            }
          }
        }
        if (period) {
          const { flash } = flashAt(t);
          if (flash > 0) {
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = `rgba(110, 130, 180, ${flash * 0.2})`;
            ctx.fillRect(0, 0, W, H);
            ctx.globalCompositeOperation = "source-over";
          }
        }
      }
    };
    let lastFired = Math.floor(0 / (period || 1)) - 2;
    let fogLayer = null;
    if (info.fog && meta.fog) {
      const f = layer();
      hazeBand(f.ctx, meta.fog[0], meta.fog[1], info.fog.color, info.fog.alpha, info.fog.density);
      fogLayer = f.canvas;
    }
    const particles = [];
    const dropDim = env.night ? "rgba(120, 145, 190, 0.35)" : "rgba(170, 210, 220, 0.35)";
    const dropBright = env.night ? "rgba(170, 190, 230, 0.5)" : "rgba(220, 240, 245, 0.55)";
    const splash = env.night ? "rgba(150, 175, 215, 0.55)" : "rgba(200, 230, 235, 0.6)";
    if (info.rain > 0) {
      const pr = rng(99);
      const count = snow ? Math.round(50 + info.rain * 130) : Math.round(60 + info.rain * 240);
      for (let i = 0; i < count; i++) {
        particles.push(snow ? { x: pr() * W, y: pr() * H, speed: (10 + pr() * 22) * (0.5 + info.rain), phase: pr() * 6, size: pr() < 0.25 ? 2 : 1, alpha: 0.5 + pr() * 0.5 } : {
          x: pr() * (W + 80),
          y: pr() * H,
          speed: (info.storm ? 260 : 150) + pr() * 90,
          len: 3 + Math.floor(pr() * (info.storm ? 6 : 4)),
          bright: pr() < 0.3
        });
      }
    }
    return env;
  }

  // js/scenes/bamboo.js
  var VANISH = { x: 160, y: 96 };
  var CLEARING = {
    sunny: ["#fff4c8", "#ffffff"],
    cloudy: ["#e6ecea", "#f4f8f6"],
    sunset: ["#ffb070", "#ffd9a0"],
    rain: ["#a8c4b4", "#cfe8d8"],
    thunder: ["#788890", "#98a8b0"],
    night: ["#3a5a8a", "#6a8ac0"],
    nightthunder: ["#202a3a", "#303c50"]
  };
  var MIST = {
    sunny: ["#f4fff4", 0.12, 0.8],
    cloudy: ["#dfeee6", 0.28, 0.9],
    sunset: ["#ffc090", 0.22, 0.9],
    rain: ["#96bea8", 0.38, 1],
    thunder: ["#788e86", 0.42, 1],
    night: ["#5a7aa0", 0.28, 0.9],
    nightthunder: ["#3a4a5a", 0.32, 0.9]
  };
  var BEAMS = { sunny: [255, 244, 190, 0.13], sunset: [255, 190, 120, 0.11], night: [150, 180, 255, 0.06] };
  function pathHalf(y) {
    const k = Math.max(0, (y - VANISH.y) / (H - VANISH.y));
    return 4 + k * k * 58 + k * 14;
  }
  function stalk(ctx, r, x, w, bottom, colors) {
    const top = -2;
    rect(ctx, x, top, w, bottom - top, colors.body);
    if (w >= 3) rect(ctx, x, top, 1, bottom - top, colors.light);
    if (w >= 6) rect(ctx, x + w - 1, top, 1, bottom - top, colors.dark);
    let y = 6 + r() * 14;
    while (y < bottom) {
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
  function forestLayer(env, seed, count, widths, floor, colors, leafColors, leafScale) {
    const { canvas, ctx } = layer();
    const r = rng(seed);
    for (let i = 0; i < count; i++) {
      const x = Math.round((i + r() * 0.8) * (W / count));
      const w = widths[0] + Math.floor(r() * (widths[1] - widths[0] + 1));
      const bottom = Math.round(floor[0] + r() * (floor[1] - floor[0]));
      const leaves = [];
      for (let y = 10 + r() * 30; y < bottom - 24; y += 22 + r() * 30) leaves.push([y, r() < 0.5 ? 0 : w]);
      if (Math.abs(x + w / 2 - VANISH.x) < pathHalf(bottom) + w + 3) continue;
      stalk(ctx, r, x, w, bottom, colors);
      for (const [y, side] of leaves) {
        leafCluster(ctx, r, x + side, y, leafColors[0], leafColors[1], 2 + Math.floor(r() * 3), leafScale);
      }
    }
    return env.grade(canvas);
  }
  function mistLayer(env, y0, y1, scale) {
    const [color, alpha, density] = MIST[env.id];
    const { canvas, ctx } = layer();
    hazeBand(ctx, y0, y1, color, alpha * scale, density);
    return canvas;
  }
  function lantern(ctx, x, base) {
    const stone = "#8a968c", dark = "#4c5850", lit = "#b8c4b8";
    rect(ctx, x - 4, base - 2, 9, 2, dark);
    rect(ctx, x - 1, base - 9, 3, 7, stone);
    px(ctx, x - 1, base - 9, lit);
    rect(ctx, x - 3, base - 11, 7, 2, stone);
    rect(ctx, x - 3, base - 16, 7, 5, dark);
    rect(ctx, x - 5, base - 18, 11, 2, stone);
    rect(ctx, x - 5, base - 18, 11, 1, lit);
    rect(ctx, x - 3, base - 20, 7, 2, stone);
    rect(ctx, x - 1, base - 22, 3, 2, stone);
    return { x, y: base - 14 };
  }
  var bamboo_default = {
    id: "bamboo",
    name: "Bamboo Path",
    signature: "rain",
    horizon: 160,
    celestial: { sunX: 210, sunHighY: 20, sunLowY: 64, moonX: 210, moonY: 26 },
    fog: [70, 176],
    rainBand: [H - 22, H - 4],
    sounds: { always: {}, day: { birds: 0.5 }, night: { crickets: 0.5, owl: 0.3 } },
    create(env) {
      const sky = env.makeSky();
      const [wide, core] = CLEARING[env.id];
      const sc = sky.canvas.getContext("2d");
      glow(sc, VANISH.x, VANISH.y - 16, 46, wide, 0.5);
      glow(sc, VANISH.x, VANISH.y - 10, 24, core, 0.6);
      const floor = layer();
      const f = floor.ctx;
      ditherGradient(f, 0, VANISH.y, W, H - VANISH.y, ["#4f8a5a", "#3d7448", "#2e5a38", "#22452b", "#183520"]);
      const path = layer();
      ditherGradient(path.ctx, 0, VANISH.y, W, H - VANISH.y, ["#d0dcc8", "#a8bca4", "#889c84", "#6e8068", "#5a6a52"]);
      const fr = rng(5);
      for (let y = VANISH.y; y < H; y++) {
        const half = pathHalf(y);
        const bend = Math.sin((y - VANISH.y) * 0.045) * 5;
        const left = Math.round(VANISH.x + bend - half);
        const width = Math.round(half * 2);
        f.drawImage(path.canvas, left, y, width, 1, left, y, width, 1);
        px(f, left - 1, y, "#2e5a3a");
        px(f, left + width, y, "#2e5a3a");
        const depth = (y - VANISH.y) / (H - VANISH.y);
        if (Math.floor(Math.pow(depth, 0.55) * 22) !== Math.floor(Math.pow((y + 1 - VANISH.y) / (H - VANISH.y), 0.55) * 22)) {
          rect(f, left + 1, y, width - 2, 1, "#6a7c66");
        }
        for (let x = left; x < left + width; x++) if (fr() < 0.05) px(f, x, y, fr() < 0.5 ? "#b0c4ac" : "#5f7060");
      }
      for (let i = 0; i < 420; i++) {
        const y = VANISH.y + 3 + Math.floor(fr() * (H - VANISH.y - 3));
        const x = Math.floor(fr() * W);
        if (Math.abs(x - VANISH.x) < pathHalf(y) + 6) continue;
        px(f, x, y, fr() < 0.4 ? "#66a05a" : "#265030");
      }
      env.grade(floor.canvas);
      for (const [cx, cy, rx] of [[150, 128, 7], [172, 146, 10], [138, 166, 13], [181, 172, 9]]) {
        for (let dy = -2; dy <= 2; dy++) {
          const half = Math.round(rx * Math.sqrt(1 - dy * dy / 6.5));
          rect(f, cx - half, cy + dy, half * 2, 1, dy < 0 ? env.info.sky[4] : env.info.sky[3]);
        }
      }
      const far = forestLayer(
        env,
        11,
        30,
        [2, 2],
        [VANISH.y + 1, VANISH.y + 10],
        { body: "#6d9f78", light: "#84b590", dark: "#5d8a68", node: "#547c5f" },
        ["#78ab82", "#98c79a"],
        1
      );
      const mistFar = mistLayer(env, 60, 170, 1);
      const mid = forestLayer(
        env,
        23,
        18,
        [3, 4],
        [VANISH.y + 14, VANISH.y + 44],
        { body: "#3d7a44", light: "#5f9c5a", dark: "#2f6238", node: "#295530" },
        ["#4f9450", "#7cc068"],
        1.5
      );
      const mistNear = mistLayer(env, 120, 200, 0.8);
      const near = forestLayer(
        env,
        37,
        7,
        [7, 9],
        [H + 4, H + 4],
        { body: "#1f4a2a", light: "#34703a", dark: "#173820", node: "#132d19" },
        ["#256335", "#3f8a48"],
        2.2
      );
      const front = layer();
      const light = lantern(front.ctx, 108, 158);
      const gr = rng(6);
      for (let x = 0; x < W; x += 2) {
        if (Math.abs(x - VANISH.x) < pathHalf(H) - 6) continue;
        const h = 2 + Math.floor(gr() * 6);
        rect(front.ctx, x, H - h, 1, h, gr() < 0.5 ? "#2a5a30" : "#357040");
      }
      env.grade(front.canvas);
      const r = rng(99);
      const leaves = Array.from({ length: 7 }, () => ({ x: r() * W, y: r() * H, speed: 6 + r() * 6, phase: r() * 6 }));
      const beamSpec = BEAMS[env.id];
      const beams = beamSpec ? Array.from({ length: 6 }, (_, i) => ({ x: 90 + i * 32 + r() * 14, w: 8 + r() * 8, ph: r() * 6 })) : [];
      const flies = Array.from({ length: 12 }, () => ({ x: 90 + r() * 140, y: 110 + r() * 60, p: r() * 10 }));
      const leafA = env.c("#7fb068");
      const leafB = env.c("#5e9150");
      const ring = env.rgba("#e1f5f0", 0.8);
      const ringOld = env.rgba("#c8e6e1", 0.4);
      const wind = 0.4 + env.wind;
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(floor.canvas, 0, 0);
          ctx.drawImage(far, 0, 0);
          ctx.drawImage(mistFar, Math.round(Math.sin(t * 0.05) * 6), 0);
          ctx.drawImage(mid, 0, 0);
          if (env.rain > 0) {
            const slot = Math.floor(t * 6);
            for (let i = 0; i < 16; i++) {
              const sr = rng(slot - i % 3 + i * 131);
              const y = VANISH.y + 8 + Math.floor(sr() * (H - VANISH.y - 8));
              const x = Math.round(VANISH.x + (sr() - 0.5) * 2 * (pathHalf(y) - 3));
              const age = i % 3;
              ctx.fillStyle = age === 0 ? ring : ringOld;
              if (age === 0) ctx.fillRect(x, y - 1, 1, 1);
              ctx.fillRect(x - 1 - age, y, 1, 1);
              ctx.fillRect(x + 1 + age, y, 1, 1);
            }
          }
          for (const l of leaves) {
            const y = wrap(l.y + t * l.speed * wind, H + 10) - 5;
            const x = wrap(l.x + Math.sin(t * 0.8 + l.phase) * 10 - t * 2 * wind, W);
            ctx.fillStyle = leafA;
            ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
            ctx.fillStyle = leafB;
            ctx.fillRect(Math.round(x + (Math.sin(t * 3 + l.phase) > 0 ? 2 : -1)), Math.round(y + 1), 1, 1);
          }
          ctx.drawImage(mistNear, Math.round(Math.sin(t * 0.08 + 1) * 10), 0);
          if (beamSpec) {
            const [br, bg, bb, strength] = beamSpec;
            ctx.globalCompositeOperation = "lighter";
            for (const b of beams) {
              const x0 = b.x + Math.sin(t * 0.15 + b.ph) * 6;
              const pulse = 0.65 + 0.35 * Math.sin(t * 0.4 + b.ph * 2);
              for (let band = 0; band < 6; band++) {
                ctx.fillStyle = `rgba(${br},${bg},${bb},${(strength * pulse * (1 - band * 0.13)).toFixed(3)})`;
                for (let y = band * 30; y < band * 30 + 30; y++) ctx.fillRect(Math.round(x0 + y * 0.4), y, Math.round(b.w), 1);
              }
            }
            ctx.globalCompositeOperation = "source-over";
          }
          ctx.drawImage(front.canvas, 0, 0);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            const flick = Math.sin(t * 9) * Math.sin(t * 5.3) > 0.2;
            rect(ctx, light.x - 2, light.y - 1, 5, 3, flick ? "#ffd27a" : "#f4b85a");
            px(ctx, light.x, light.y, "#fff2c0");
            glow(ctx, light.x, light.y, 14, "#ffb84a", 0.5);
            ctx.globalAlpha = 1;
          }
          if (env.night && env.rain === 0) {
            for (const fl of flies) {
              const on = Math.sin(t * 2.2 + fl.p);
              if (on < 0.1) continue;
              ctx.fillStyle = on > 0.7 ? "#eaff9a" : "#a8d85a";
              ctx.fillRect(Math.round(fl.x + Math.sin(t * 0.6 + fl.p) * 14), Math.round(fl.y + Math.sin(t * 1.3 + fl.p * 2) * 5), 1, 1);
            }
          }
          ctx.drawImage(near, 0, 0);
        }
      };
    }
  };

  // js/scenes/wheat.js
  var HORIZON = 112;
  var LEANS = 4;
  var FAR = { kernel: "#d39a44", light: "#e8b85e", shade: "#ad7834", awn: "#e2b563", stem: "#a8793a" };
  var MID = { kernel: "#c98d3a", light: "#e6b65a", shade: "#93622a", awn: "#d9a851", stem: "#8f6a2c" };
  var NEAR = { kernel: "#e9b44c", light: "#ffe9a0", shade: "#a36a26", awn: "#f3d384", stem: "#b98a36", leaf: "#9c8a34" };
  var SIZES = [
    { kw: 1, kh: 1, pairs: 3, awn: 1, stem: 6, colors: FAR, bend: 2 },
    { kw: 1, kh: 2, pairs: 3, awn: 2, stem: 11, colors: FAR, bend: 3 },
    { kw: 2, kh: 2, pairs: 4, awn: 3, stem: 18, colors: MID, bend: 5 },
    { kw: 2, kh: 3, pairs: 6, awn: 5, stem: 27, colors: NEAR, bend: 8, leaves: true }
  ];
  function stalkGrid(size) {
    const { kw, kh, pairs, awn, stem, colors, bend } = size;
    const earH = pairs * kh + kh + Math.ceil(kh / 2);
    const h = awn + earH + stem;
    const pad2 = bend + awn + kw + 2;
    const w = pad2 * 2 + 1;
    const grid = layer(w, h);
    const g = grid.ctx;
    const cx = pad2;
    const earTop = awn;
    rect(g, cx, earTop + kh, 1, h - earTop - kh, colors.stem);
    if (size.leaves) {
      for (const [dir, from, len] of [[-1, 0.45, 9], [1, 0.62, 7]]) {
        const ly = Math.round(earTop + earH + stem * from);
        for (let k = 1; k <= len; k++) {
          const droop = Math.round((k - len * 0.45) ** 2 * 0.09 - 2);
          px(g, cx + dir * k, ly + droop, k > len - 2 ? colors.shade : colors.leaf);
        }
      }
    }
    const kernel = (x, y, side, bristle) => {
      rect(g, x, y, kw, kh, colors.kernel);
      px(g, side < 0 ? x : x + kw - 1, y, colors.light);
      if (kh > 1) rect(g, x, y + kh - 1, kw, 1, colors.shade);
      if (!bristle) return;
      const tipX = side < 0 ? x : x + kw - 1;
      for (let j = 1; j <= awn; j++) px(g, tipX + side * Math.round(j * 0.45), y - j, colors.awn);
    };
    rect(g, cx, earTop, 1, kh, colors.light);
    for (let j = 1; j <= awn; j++) px(g, cx, earTop - j, colors.awn);
    for (let i = 0; i < pairs; i++) {
      const y = earTop + kh + i * kh;
      kernel(cx - kw, y, -1, i < 2);
      kernel(cx + 1, y + Math.ceil(kh / 2), 1, i < 2);
    }
    return { data: g.getImageData(0, 0, w, h).data, w, h };
  }
  function leanedStalk(env, grid, size, lean) {
    const { data, w, h } = grid;
    const out = layer(w, h);
    const img = out.ctx.createImageData(w, h);
    const amount = lean / LEANS * size.bend;
    for (let y = 0; y < h; y++) {
      const up = (h - y) / h;
      const shift = Math.round(amount * up * up);
      for (let x = 0; x < w; x++) {
        const nx = x + shift;
        if (nx < 0 || nx >= w) continue;
        const from = (y * w + x) * 4;
        const to = (y * w + nx) * 4;
        img.data[to] = data[from];
        img.data[to + 1] = data[from + 1];
        img.data[to + 2] = data[from + 2];
        img.data[to + 3] = data[from + 3];
      }
    }
    env.gradeData(img.data);
    out.ctx.putImageData(img, 0, 0);
    return out.canvas;
  }
  function windmill(ctx, x, y) {
    const wall2 = "#8a7a68", dark = "#5e5044";
    for (let i = 0; i < 12; i++) {
      const half = 2 + Math.floor(i / 4);
      rect(ctx, x - half, y - 12 + i, half * 2, 1, i % 4 === 0 ? dark : wall2);
    }
    rect(ctx, x - 3, y - 15, 6, 3, dark);
    rect(ctx, x - 2, y - 17, 4, 2, "#7a3a34");
    rect(ctx, x - 1, y - 7, 3, 5, "#3a2c22");
  }
  function scarecrow(ctx, x, base) {
    const wood = "#6b4a2a", shirt = "#8a4a3a", shirtDark = "#6a3428", hat = "#c9a04a", straw = "#f0d078";
    rect(ctx, x, base - 24, 2, 24, wood);
    rect(ctx, x - 9, base - 19, 20, 2, wood);
    rect(ctx, x - 3, base - 20, 8, 10, shirt);
    rect(ctx, x + 3, base - 20, 2, 10, shirtDark);
    rect(ctx, x - 1, base - 16, 3, 3, "#4a6a8a");
    rect(ctx, x - 2, base - 26, 6, 5, "#d8c090");
    px(ctx, x - 1, base - 25, "#3a2a1a");
    px(ctx, x + 2, base - 25, "#3a2a1a");
    rect(ctx, x - 4, base - 28, 10, 2, hat);
    rect(ctx, x - 2, base - 31, 6, 3, hat);
    for (const ax of [x - 11, x + 11]) rect(ctx, ax, base - 20, 2, 3, straw);
    for (let k = 0; k < 5; k++) px(ctx, x - 3 + k * 2, base - 10 + k % 2, straw);
  }
  var wheat_default = {
    id: "wheat",
    name: "Golden Field",
    signature: "sunset",
    horizon: HORIZON,
    celestial: { sunX: 232, sunHighY: 30, sunLowY: 96, moonX: 90, moonY: 32 },
    fog: [HORIZON - 6, HORIZON + 34],
    rainBand: [HORIZON + 30, H - 2],
    sounds: { always: { wheat: 1, wind: 0.3 }, day: { birds: 0.5 }, night: { crickets: 0.8 } },
    create(env) {
      const sky = env.makeSky();
      const hills = layer();
      ridge(hills.ctx, HORIZON - 4, 6, "#7ea18c", 3, { freq: 0.018 });
      ridge(hills.ctx, HORIZON + 1, 3, "#5f8c6c", 8, { freq: 0.03 });
      const tr = rng(12);
      for (let i = 0; i < 12; i++) {
        const x = tr() * W;
        const y = HORIZON - 1 + tr() * 2;
        disc(hills.ctx, x, y - 3, 2, "#3f6a48");
        rect(hills.ctx, x, y - 1, 1, 2, "#3f6a48");
      }
      const MILL = { x: 58, y: HORIZON - 2 };
      windmill(hills.ctx, MILL.x, MILL.y);
      env.grade(hills.canvas);
      const field = layer();
      ditherGradient(field.ctx, 0, HORIZON + 1, W, H - HORIZON - 1, ["#d9a04a", "#dfab4c", "#c98a3c", "#9c672c", "#62401f"]);
      const fr = rng(44);
      for (let y = HORIZON + 2; y < HORIZON + 26; y++) {
        const depth = (y - HORIZON) / 26;
        for (let x = 0; x < W; x++) {
          const v = fr();
          if (v < 0.22) px(field.ctx, x, y, "#f2cb70");
          else if (v < 0.4) rect(field.ctx, x, y, 1, 1 + Math.round(depth * 2), "#a8722e");
        }
      }
      env.grade(field.canvas);
      const sprites = SIZES.map((size) => {
        const grid = stalkGrid(size);
        const byLean = [];
        for (let lean = -LEANS; lean <= LEANS; lean++) byLean.push(leanedStalk(env, grid, size, lean));
        return byLean;
      });
      const spriteOx = SIZES.map((size) => size.bend + size.awn + size.kw + 2);
      const crow = layer(40, 40);
      scarecrow(crow.ctx, 20, 38);
      env.grade(crow.canvas);
      const CROW = { x: 244, base: HORIZON + 58 };
      const sr = rng(31);
      const rows = [
        { size: 0, y: HORIZON + 22, gap: 3 },
        { size: 0, y: HORIZON + 27, gap: 3 },
        { size: 1, y: HORIZON + 35, gap: 4 },
        { size: 1, y: HORIZON + 42, gap: 5 },
        { size: 2, y: HORIZON + 54, gap: 7 },
        { size: 2, y: HORIZON + 64, gap: 8 },
        { size: 3, y: H + 8, gap: 15 },
        { size: 3, y: H + 18, gap: 13 }
      ].map((row, i) => {
        const stalks = [];
        for (let x = -4; x < W + 4; x += row.gap) {
          stalks.push({ x: Math.round(x + sr() * row.gap), dy: Math.round(sr() * (2 + row.size * 2)), phase: sr() * 1.2 });
        }
        return { ...row, stalks, offset: i * 1.3 };
      });
      const birds = Array.from({ length: 4 }, (_, i) => ({ x: sr() * W, y: 26 + sr() * 40, speed: 9 + sr() * 6, phase: i }));
      const motes = Array.from({ length: 24 }, () => ({ x: sr() * W, y: HORIZON + sr() * 60, s: 2 + sr() * 3, p: sr() * 6 }));
      const flies = Array.from({ length: 16 }, () => ({ x: sr() * W, y: HORIZON + 24 + sr() * 60, p: sr() * 10 }));
      const ripples = Array.from({ length: 40 }, () => ({ x: sr() * W, y: HORIZON + 3 + Math.floor(sr() * 20), len: 3 + sr() * 8, p: sr() * 6 }));
      const bird = env.c("#2a2030");
      const streak = env.c("#f6d684");
      const mote = env.c("#fff1b8");
      const beam = env.c("#4a3a30");
      const cloth = env.c("#e8dcc0");
      const windScale = 0.45 + env.wind * 0.75;
      const showBirds = !env.night && env.rain === 0;
      const fast = 1.2 + env.wind;
      const sailSpeed = 0.3 + env.wind * 0.9;
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(hills.canvas, 0, 0);
          for (let k = 0; k < 4; k++) {
            const a = t * sailSpeed + k * Math.PI / 2;
            for (let d = 1; d <= 9; d++) {
              const sx = MILL.x + Math.cos(a) * d;
              const sy = MILL.y - 16 + Math.sin(a) * d;
              px(ctx, sx, sy, beam);
              if (d > 3) px(ctx, sx - Math.sin(a), sy + Math.cos(a), cloth);
            }
          }
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            rect(ctx, MILL.x - 1, MILL.y - 11, 2, 2, "#ffcf6b");
            ctx.globalAlpha = 1;
          }
          if (showBirds) {
            ctx.fillStyle = bird;
            for (const b of birds) {
              const x = Math.round(wrap(b.x - t * b.speed, W + 20) - 10);
              const y = Math.round(b.y + Math.sin(t * 0.7 + b.phase) * 3);
              const up = Math.floor(t * 5 + b.phase) % 2 === 0 ? -1 : 1;
              ctx.fillRect(x, y, 1, 1);
              for (const dx of [-2, -1, 1, 2]) ctx.fillRect(x + dx, y + up, 1, 1);
            }
          }
          ctx.drawImage(field.canvas, 0, 0);
          ctx.fillStyle = streak;
          for (const r of ripples) {
            const x = wrap(r.x + t * 14 * fast, W + 20) - 10;
            if (Math.sin(t * 0.9 + r.p) > 0.1) ctx.fillRect(Math.round(x), r.y, Math.round(r.len), 1);
          }
          const gust = 0.55 + 0.45 * Math.sin(t * 0.35);
          rows.forEach((row, index) => {
            if (index === 6) ctx.drawImage(crow.canvas, CROW.x - 20, CROW.base - 38);
            const set = sprites[row.size];
            for (const s of row.stalks) {
              const wave = Math.sin(t * fast * 1.25 - s.x * 0.035 + row.offset + s.phase);
              const lean = Math.round((0.35 + wave * 0.65) * gust * windScale * LEANS);
              const sprite = set[Math.max(-LEANS, Math.min(LEANS, lean)) + LEANS];
              ctx.drawImage(sprite, s.x - spriteOx[row.size], row.y + s.dy - sprite.height);
            }
          });
          if (env.rain === 0 && !env.night) {
            ctx.fillStyle = mote;
            for (const m of motes) {
              const y = wrap(m.y - t * m.s, 70) + HORIZON - 10;
              const x = wrap(m.x + Math.sin(t + m.p) * 6 + t * 3, W);
              if (Math.sin(t * 2 + m.p) > -0.2) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
          }
          if (env.night && env.rain === 0) {
            for (const f of flies) {
              const on = Math.sin(t * 2.2 + f.p);
              if (on < 0.1) continue;
              const x = f.x + Math.sin(t * 0.6 + f.p) * 18;
              const y = f.y + Math.sin(t * 1.3 + f.p * 2) * 5;
              ctx.fillStyle = on > 0.7 ? "#eaff9a" : "#a8d85a";
              ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
          }
        }
      };
    }
  };

  // js/scenes/village.js
  var GROUND = 150;
  var GLASS = "#3f5070";
  function pine(ctx, x, base, h, color, lit) {
    for (let i = 0; i < h; i++) {
      const half = Math.floor(i / h * (h * 0.4)) + (i % 3 === 0 ? 0 : 1);
      rect(ctx, x - half, base - h + i, half * 2 + 1, 1, color);
      if (lit && half > 0) px(ctx, x - half, base - h + i, lit);
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
      rect(ctx, cx, cTop, 3, 8, "#6a5a58");
      rect(ctx, cx - 1, cTop, 5, 1, "#4a3c3c");
      chimneys.push({ x: cx + 1, y: cTop - 1, phase: r() * 10 });
    }
    rect(ctx, x + Math.round(w / 2) - 2, GROUND - 7, 4, 7, "#4a2c20");
    const winY = top + 4;
    for (let wx = x + 3; wx + 4 < x + w - 2; wx += 8) {
      if (Math.abs(wx + 2 - (x + w / 2)) < 4 && h < 20) continue;
      rect(ctx, wx - 1, winY - 1, 6, 6, "#4a3a2c");
      rect(ctx, wx, winY, 4, 4, GLASS);
      px(ctx, wx, winY, "#6a86a8");
      windows.push({ x: wx, y: winY, seed: r() });
    }
  }
  var village_default = {
    id: "village",
    name: "Night Village",
    signature: "night",
    horizon: 135,
    celestial: { sunX: 250, sunHighY: 30, sunLowY: 112, moonX: 58, moonY: 34 },
    fog: [110, 176],
    rainBand: [GROUND + 14, H - 3],
    sounds: { always: {}, day: { birds: 0.7 }, night: { crickets: 1, owl: 0.4 } },
    create(env) {
      const sky = env.makeSky();
      const base = layer();
      const b = base.ctx;
      ridge(b, 122, 12, "#6f9a86", 21, { freq: 0.013, jag: 3 });
      ridge(b, 134, 5, "#5a8a6c", 22, { freq: 0.025 });
      const tr = rng(4);
      for (let i = 0; i < 26; i++) pine(b, Math.round(tr() * W), 136 + Math.round(tr() * 6), 7 + Math.round(tr() * 7), "#2f5a3a", "#4a8a52");
      rect(b, 0, GROUND, W, H - GROUND, "#5f8f4a");
      ditherGradient(b, 0, GROUND, W, H - GROUND, ["#6b9a52", "#557f42"]);
      for (let x2 = 0; x2 < W; x2++) {
        const y = GROUND + 12 + Math.round(Math.sin(x2 * 0.03) * 3);
        rect(b, x2, y, 1, 6, (x2 >> 2) % 2 ? "#c9b48a" : "#bba67c");
      }
      const r = rng(8);
      const windows = [];
      const chimneys = [];
      const walls = [["#c99a76", "#a87c5a"], ["#d9b78e", "#b89670"], ["#b8909e", "#96727f"], ["#cdb894", "#a99878"]];
      const roofs = [["#a83c46", "#7a2830"], ["#4a64a8", "#364a80"], ["#8a5a3a", "#684228"], ["#3f7a5e", "#2c5a44"]];
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
        rect(b, l.x, l.y, 1, 14, "#3a3440");
        rect(b, l.x - 1, l.y - 3, 3, 3, "#9a8a6a");
      }
      env.grade(base.canvas);
      const sr = rng(77);
      const flies = Array.from({ length: 12 }, () => ({ x: sr() * W, y: GROUND - 6 + sr() * 14, p: sr() * 10 }));
      const smoke = env.rgb("#c8ccd8");
      const wind = 4 + env.wind * 10;
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(base.canvas, 0, 0);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            for (const w of windows) {
              const off = Math.sin(Math.floor(t / 4) * 13.7 + w.seed * 91) > 0.82;
              if (off) continue;
              const flicker = Math.sin(t * 7 + w.seed * 50) > 0.92;
              rect(ctx, w.x, w.y, 4, 4, flicker ? "#ffe7a4" : "#ffc75e");
              rect(ctx, w.x, w.y + 2, 4, 1, "#e8a646");
            }
            for (const l of lamps) {
              glow(ctx, l.x, l.y, 10, "#8a6a44", 1.2);
              rect(ctx, l.x - 1, l.y - 3, 3, 3, "#ffe08a");
            }
            ctx.globalAlpha = 1;
          }
          for (const c of chimneys) {
            for (let k = 0; k < 7; k++) {
              const age = wrap(t * 0.35 + k / 7 + c.phase, 1);
              const sx = Math.round(c.x + Math.sin(age * 5 + k) * 2 + age * wind);
              const sy = Math.round(c.y - age * 30);
              const size = 1 + Math.round(age * 3);
              ctx.fillStyle = `rgba(${smoke[0]}, ${smoke[1]}, ${smoke[2]}, ${((1 - age) * 0.55).toFixed(2)})`;
              ctx.fillRect(sx, sy, size, size);
            }
          }
          if (env.night && env.rain === 0) {
            for (const f of flies) {
              if (Math.sin(t * 2.5 + f.p) < 0.2) continue;
              px(ctx, f.x + Math.sin(t * 0.6 + f.p) * 18, f.y + Math.sin(t * 1.3 + f.p * 2) * 5, "#d8ff7a");
            }
          }
        }
      };
    }
  };

  // js/scenes/castle.js
  var SHORE = 146;
  var STONE = "#9b98ae";
  var STONE_LIT = "#cfc5c3";
  var STONE_HI = "#f2e6d8";
  var STONE_DARK = "#6b6885";
  var STONE_DEEP = "#525070";
  var ROOF = "#a63c3c";
  var ROOF_LIT = "#d86058";
  var ROOF_DARK = "#75262c";
  var GLASS2 = "#3a4a6a";
  var WARM = "#ffcf6b";
  var ROCK = "#7a7484";
  var ROCK_LIT = "#b09a9a";
  var ROCK_DARK = "#524e60";
  var PINE = "#2c5a38";
  function cragTop(x) {
    let y;
    if (x < 126) return H;
    if (x < 152) {
      const k = (x - 126) / 26;
      y = SHORE + 2 - k * k * (3 - 2 * k) * 34;
    } else if (x <= 276) {
      y = 114 + Math.sin(x * 0.11) * 1.5;
    } else {
      y = 114 + (x - 276) * 0.62;
    }
    return Math.round(y);
  }
  function wall(ctx, x, top, w, ground) {
    for (let cx = x; cx < x + w; cx++) {
      const base = ground(cx);
      const edge = cx - x;
      const color = edge === 0 ? STONE_HI : edge < Math.max(2, w * 0.22) ? STONE_LIT : edge >= w - 2 ? STONE_DARK : STONE;
      rect(ctx, cx, top, 1, base - top + 1, color);
    }
    for (let row = top + 3, n = 0; row < H; row += 4, n++) {
      for (let cx = x + 1; cx < x + w - 1; cx++) {
        if (row >= ground(cx)) continue;
        if ((cx + n * 3) % 6 === 0) px(ctx, cx, row - 1, STONE_DARK);
        if ((cx * 7 + n * 5) % 11 < 7) px(ctx, cx, row, STONE_DARK);
      }
    }
  }
  function roundTower(ctx, x, top, w, ground, roof, flags, lights) {
    for (let cx = x; cx < x + w; cx++) {
      const k = (cx - x) / (w - 1);
      const color = k < 0.12 ? STONE_HI : k < 0.38 ? STONE_LIT : k < 0.7 ? STONE : k < 0.9 ? STONE_DARK : STONE_DEEP;
      rect(ctx, cx, top, 1, ground(cx) - top + 1, color);
    }
    for (let row = top + 4, n = 0; row < H; row += 4, n++) {
      for (let cx = x + 1; cx < x + w - 1; cx++) {
        if (row < ground(cx) && (cx + n * 2) % 3 !== 0) px(ctx, cx, row, STONE_DARK);
      }
    }
    rect(ctx, x - 1, top, w + 2, 2, STONE);
    rect(ctx, x - 1, top, 2, 2, STONE_HI);
    rect(ctx, x + w - 1, top, 2, 2, STONE_DARK);
    if (roof) {
      const roofH = Math.round(w * 1.25);
      for (let i = 0; i < roofH; i++) {
        const half = (i + 1) / roofH * (w / 2 + 2);
        const left = Math.round(x + w / 2 - half);
        const width = Math.round(half * 2);
        rect(ctx, left, top - roofH + i, width, 1, ROOF);
        rect(ctx, left, top - roofH + i, Math.max(1, Math.round(width * 0.3)), 1, ROOF_LIT);
        rect(ctx, left + Math.round(width * 0.72), top - roofH + i, width - Math.round(width * 0.72), 1, ROOF_DARK);
      }
      flags.push({ x: x + Math.floor(w / 2), y: top - roofH - 7 });
    } else {
      crenels(ctx, x - 1, top, w + 2);
    }
    const mid = x + Math.floor(w / 2);
    for (let wy = top + 7; wy < ground(mid) - 8; wy += 11) slit(ctx, mid, wy, lights);
  }
  function crenels(ctx, x, y, w) {
    for (let cx = x; cx < x + w; cx += 4) {
      rect(ctx, cx, y - 3, 2, 3, cx - x < w * 0.25 ? STONE_LIT : STONE);
      px(ctx, cx, y - 3, STONE_HI);
    }
  }
  function slit(ctx, x, y, lights) {
    rect(ctx, x, y, 1, 3, GLASS2);
    px(ctx, x - 1, y + 1, STONE_DARK);
    px(ctx, x + 1, y + 1, STONE_DARK);
    lights.push({ x, y, w: 1, h: 3 });
  }
  function arch(ctx, x, y, w, h, color) {
    rect(ctx, x, y + w / 2, w, h - w / 2, color);
    for (let i = 0; i < w / 2; i++) {
      const half = Math.round(Math.sqrt((w / 2) ** 2 - (w / 2 - i - 0.5) ** 2));
      rect(ctx, x + w / 2 - half, y + i, half * 2, 1, color);
    }
  }
  function pine2(ctx, x, base, h, body, lit) {
    for (let i = 0; i < h; i++) {
      const half = Math.floor(i / h * (h * 0.36)) + (i % 3 === 0 ? 0 : 1);
      rect(ctx, x - half, base - h + i, half * 2 + 1, 1, body);
      if (lit && half > 0) px(ctx, x - half, base - h + i, lit);
    }
    rect(ctx, x, base, 1, 2, body);
  }
  function cottage(ctx, x, base, w, lights) {
    rect(ctx, x, base - 5, w, 5, "#c9b592");
    rect(ctx, x, base - 5, 1, 5, "#e8d8b4");
    rect(ctx, x + w - 1, base - 5, 1, 5, "#a08c6c");
    for (let i = 0; i < 4; i++) rect(ctx, x - 1 + i, base - 6 - (3 - i), w + 2 - i * 2, 1, i === 3 ? ROOF_DARK : ROOF);
    px(ctx, x + 2, base - 3, GLASS2);
    lights.push({ x: x + 2, y: base - 3, w: 1, h: 1 });
    if (w > 6) {
      px(ctx, x + w - 3, base - 3, GLASS2);
      lights.push({ x: x + w - 3, y: base - 3, w: 1, h: 1 });
    }
  }
  var ROAD = [
    [132, 149, 2],
    [150, 150, 3],
    [176, 151, 4],
    [214, 150, 4],
    [252, 146, 4],
    [278, 139, 3],
    [286, 131, 3],
    [272, 125, 2],
    [250, 121, 2],
    [232, 118, 2],
    [221, 116, 2]
  ];
  var castle_default = {
    id: "castle",
    name: "Dusk Castle",
    signature: "sunset",
    horizon: SHORE + 2,
    celestial: { sunX: 58, sunHighY: 30, sunLowY: 104, moonX: 58, moonY: 34 },
    fog: [96, 150],
    rainBand: [SHORE + 4, H - 24],
    sounds: { always: { water: 0.12 }, day: { birds: 0.4 }, night: { crickets: 0.7, owl: 0.6 } },
    create(env) {
      const sky = env.makeSky();
      const sun = env.sun;
      const far = layer();
      ridge(far.ctx, 122, 16, "#8fa4c8", 41, { freq: 0.014, jag: 5 });
      ridge(far.ctx, 134, 9, "#7488b0", 42, { freq: 0.022, jag: 3 });
      far.ctx.clearRect(0, SHORE, W, H - SHORE);
      env.grade(far.canvas);
      hazeBand(far.ctx, 120, 152, env.info.sky[env.info.sky.length - 1], 0.35, 0.8);
      const land = layer();
      const l = land.ctx;
      const r = rng(51);
      const lights = [];
      const jitter = [];
      for (let x = 0; x < W; x++) jitter.push(x % 3 === 0 ? Math.round((r() - 0.5) * 2) : jitter[x - 1]);
      const ground = (x) => cragTop(x) + (x >= 126 ? jitter[Math.max(0, Math.min(W - 1, x))] : 0);
      for (let x = 126; x < W; x++) {
        const top = ground(x);
        rect(l, x, top, 1, H - top, x < 150 ? ROCK_LIT : x > 268 ? ROCK_DARK : ROCK);
        for (let y = top + 3; y < H; y += 5) {
          const shift = Math.round(Math.sin(x * 0.2 + y) * 1.5);
          px(l, x, y + shift, x < 150 ? ROCK : ROCK_DARK);
        }
        if (x < 150 && x % 2 === 0) px(l, x, top + 1, "#d0b09a");
        if (x >= 150) rect(l, x, top, 1, 2, x % 5 === 0 ? "#6fae56" : "#5f9a4c");
      }
      for (let i = 0; i < 9; i++) {
        const x = 128 + Math.floor(r() * 20);
        const y = ground(x) + 4 + Math.floor(r() * 18);
        rect(l, x, y, 1, 3 + Math.floor(r() * 5), ROCK);
      }
      const flags = [];
      wall(l, 268, 104, 30, ground);
      crenels(l, 268, 104, 30);
      roundTower(l, 294, 98, 9, ground, true, flags, lights);
      roundTower(l, 232, 60, 9, ground, true, flags, lights);
      wall(l, 186, 72, 34, ground);
      crenels(l, 186, 72, 34);
      for (const [wx, wy] of [[193, 80], [203, 80], [213, 80], [198, 92], [208, 92]]) {
        arch(l, wx, wy, 2, 4, GLASS2);
        lights.push({ x: wx, y: wy + 1, w: 2, h: 3 });
      }
      for (let i = 0; i < 10; i++) {
        const left = 203 - i * 1.6;
        const width = 2 + i * 3.2;
        rect(l, left, 59 + i, width, 1, ROOF);
        rect(l, left, 59 + i, Math.max(1, width * 0.3), 1, ROOF_LIT);
        rect(l, left + width * 0.75, 59 + i, width * 0.25 + 1, 1, ROOF_DARK);
      }
      flags.push({ x: 203, y: 51 });
      roundTower(l, 172, 78, 8, ground, true, flags, lights);
      wall(l, 152, 98, 116, ground);
      crenels(l, 152, 98, 116);
      for (const bx of [170, 188, 240, 256]) {
        rect(l, bx, 104, 2, ground(bx) - 104, STONE_LIT);
        rect(l, bx + 2, 104, 1, ground(bx) - 104, STONE_DARK);
      }
      for (const wx of [162, 180, 196, 246, 262]) slit(l, wx, 104, lights);
      roundTower(l, 146, 86, 11, ground, true, flags, lights);
      roundTower(l, 262, 84, 11, ground, false, flags, lights);
      wall(l, 208, 92, 22, ground);
      crenels(l, 208, 92, 22);
      roundTower(l, 204, 88, 6, ground, false, flags, lights);
      roundTower(l, 228, 88, 6, ground, false, flags, lights);
      arch(l, 214, 103, 10, 13, "#241a2c");
      const torches = [[211, 106], [226, 106]];
      for (let i = 0; i < 40; i++) {
        const x = 150 + Math.floor(r() * 146);
        const y = ground(x) - Math.floor(r() * 7);
        px(l, x, y, r() < 0.5 ? "#4a7a44" : "#3f6a3c");
      }
      const hillY = (x) => Math.round(152 + Math.sin(x * 0.021 + 1) * 5 + Math.sin(x * 0.07) * 2 - Math.max(0, x - 120) * 0.035);
      for (let x = 118; x < W; x++) {
        const y = hillY(x);
        rect(l, x, y, 1, H - y, "#3f6f3a");
        px(l, x, y, "#5f9a4c");
      }
      for (let x = 262; x < 292; x++) rect(l, x, 140 - Math.round((x - 262) * 0.05), 1, 3, x % 4 === 0 ? STONE_DARK : "#8e8ba0");
      arch(l, 270, 143, 6, 7, "#2a2438");
      arch(l, 280, 143, 6, 7, "#2a2438");
      for (let i = 0; i < ROAD.length - 1; i++) {
        const [x0, y0, w0] = ROAD[i];
        const [x1, y1, w1] = ROAD[i + 1];
        const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
        for (let s = 0; s <= steps; s++) {
          const k = s / steps;
          const x = x0 + (x1 - x0) * k;
          const y = y0 + (y1 - y0) * k;
          const w = Math.round(w0 + (w1 - w0) * k);
          rect(l, x, y, 2, w, "#b8a684");
          px(l, x, y, "#d4c49c");
        }
      }
      for (let i = 0; i < 26; i++) {
        const x = 130 + Math.floor(r() * 186);
        const top = ground(x);
        const base = top + 8 + Math.floor(r() * 22);
        if (base > hillY(x) - 1 || x > 200 && x < 236) continue;
        pine2(l, x, base, 6 + Math.floor(r() * 5), PINE, "#4a8a52");
      }
      cottage(l, 121, 150, 8, lights);
      cottage(l, 134, 152, 7, lights);
      cottage(l, 108, 149, 6, lights);
      rect(l, 96, 148, 26, H - 148, "#3f6f3a");
      for (let x = 96; x < 122; x++) px(l, x, 148 + Math.round(Math.sin(x * 0.4)), "#5f9a4c");
      env.grade(land.canvas);
      const scene = layer();
      scene.ctx.drawImage(sky.canvas, 0, 0);
      scene.ctx.drawImage(far.canvas, 0, 0);
      scene.ctx.drawImage(land.canvas, 0, 0);
      const lake = layer();
      for (let y = SHORE; y < H; y++) {
        const src = Math.max(0, SHORE - (y - SHORE) * 2 - 1);
        const shift = Math.round(Math.sin(y * 1.7) * 1.2);
        lake.ctx.drawImage(scene.canvas, 0, src, W, 1, shift, y, W, 1);
      }
      lake.ctx.fillStyle = `${env.c("#1c4a70").replace("rgb", "rgba").replace(")", ", 0.5)")}`;
      lake.ctx.fillRect(0, SHORE, W, H - SHORE);
      rect(lake.ctx, 0, SHORE, W, 1, env.c("#3a6a90"));
      const near = layer();
      const n = near.ctx;
      const bankY = (x) => Math.round(172 - Math.sin(x * 0.012 + 0.4) * 5 - Math.max(0, x - 150) * 0.1 + Math.sin(x * 0.09) * 1.5);
      for (let x = 0; x < W; x++) rect(n, x, bankY(x), 1, H, "#1f3f2a");
      for (let i = 0; i < 9; i++) {
        const x = i < 4 ? 4 + r() * 50 : W - 4 - r() * 70;
        pine2(n, Math.round(x), bankY(Math.round(x)) + 1, 20 + Math.floor(r() * 26), "#1c3a26", "#2f5a3a");
      }
      for (let x = 0; x < W; x += 2) if (r() < 0.5) rect(n, x, bankY(x) - 1 - Math.floor(r() * 2), 1, 2, "#1f3f2a");
      env.grade(near.canvas);
      const bats = Array.from({ length: 5 }, (_, i) => ({ cx: 215 + (r() - 0.5) * 60, cy: 52 + r() * 18, rx: 30 + r() * 30, p: i * 1.3 }));
      const swallows = Array.from({ length: 4 }, (_, i) => ({ cx: 215 + (r() - 0.5) * 60, cy: 40 + r() * 16, rx: 40 + r() * 30, p: i * 1.9 }));
      const glints = Array.from({ length: 30 }, () => ({ x: r(), y: SHORE + 2 + Math.floor(r() * 24), p: r() * 6, len: 2 + Math.floor(r() * 5) }));
      const dusk = env.id === "sunset" || env.id === "night";
      const daytime = env.id === "sunny" || env.id === "cloudy";
      const glintColors = env.sun.kind === "moon" ? ["#c8d4ff", "#8a9ad0"] : ["#ffd9a0", "#e8895b"];
      const smoke = env.c("#a8a0b8");
      const critter = env.c("#1a1626");
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(far.canvas, 0, 0);
          ctx.drawImage(lake.canvas, 0, 0);
          if (sun.kind) {
            for (const g of glints) {
              if (Math.sin(t * 1.4 + g.p) < 0.1) continue;
              const spread = 6 + (g.y - SHORE) * 1.1;
              const x = sun.x + (g.x - 0.5) * spread * 2 + Math.sin(t * 0.5 + g.p) * 2;
              rect(ctx, x, g.y, g.len, 1, g.y < SHORE + 10 ? glintColors[0] : glintColors[1]);
            }
          }
          ctx.drawImage(land.canvas, 0, 0);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            ctx.fillStyle = WARM;
            for (const w of lights) ctx.fillRect(w.x, w.y, w.w, w.h);
            arch(ctx, 215, 105, 8, 11, "#e0904a");
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#2a1c2c";
            for (let gx = 216; gx < 223; gx += 2) ctx.fillRect(gx, 105, 1, 11);
            ctx.fillRect(215, 109, 8, 1);
            ctx.globalAlpha = env.lit;
            for (const [tx, ty] of torches) {
              const flick = Math.sin(t * 11 + tx) > 0;
              px(ctx, tx, ty, flick ? "#ffe9a0" : "#ffb84a");
              px(ctx, tx, ty - 1, flick ? "#ffb84a" : "#e8703a");
            }
            ctx.globalAlpha = 1;
            glow(ctx, 219, 117, 7, "#c9784a", 0.45 * env.lit);
          }
          for (const f of flags) {
            rect(ctx, f.x, f.y, 1, 7, "#2a2030");
            const flap = 6 * (0.5 + env.wind * 0.6);
            for (let c = 0; c < 6; c++) {
              const dy = Math.round(Math.sin(t * flap - c * 0.9) * (0.7 + env.wind * 0.5));
              rect(ctx, f.x + 1 + c, f.y + dy, 1, 3, c % 2 ? "#ec4a5c" : "#d93a4e");
            }
          }
          ctx.fillStyle = smoke;
          for (let k = 0; k < 5; k++) {
            const age = wrap(t * 0.35 + k / 5, 1);
            ctx.fillRect(Math.round(124 + Math.sin(age * 6 + k) * 2 + age * (5 + env.wind * 6)), Math.round(141 - age * 14), 1, 1);
          }
          if (dusk && env.rain === 0) {
            ctx.fillStyle = critter;
            for (const b of bats) {
              const x = Math.round(b.cx + Math.cos(t * 0.5 + b.p) * b.rx);
              const y = Math.round(b.cy + Math.sin(t * 0.9 + b.p) * 10);
              const up = Math.floor(t * 8 + b.p) % 2 === 0;
              ctx.fillRect(x, y, 2, 1);
              ctx.fillRect(x - 1, y + (up ? -1 : 0), 1, 1);
              ctx.fillRect(x + 2, y + (up ? -1 : 0), 1, 1);
              ctx.fillRect(x - 2, y + (up ? -2 : 1), 1, 1);
              ctx.fillRect(x + 3, y + (up ? -2 : 1), 1, 1);
            }
          }
          if (daytime) {
            ctx.fillStyle = critter;
            for (const b of swallows) {
              const x = Math.round(b.cx + Math.cos(t * 0.4 + b.p) * b.rx);
              const y = Math.round(b.cy + Math.sin(t * 0.7 + b.p) * 8);
              const up = Math.floor(t * 5 + b.p) % 2 === 0 ? -1 : 1;
              ctx.fillRect(x, y, 1, 1);
              for (const dx of [-2, -1, 1, 2]) ctx.fillRect(x + dx, y + up, 1, 1);
            }
          }
          ctx.drawImage(near.canvas, 0, 0);
        }
      };
    }
  };

  // js/scenes/ocean.js
  var HORIZON2 = 106;
  var ocean_default = {
    id: "ocean",
    name: "Open Sea",
    signature: "sunny",
    horizon: HORIZON2,
    celestial: { sunX: 250, sunHighY: 30, sunLowY: 98, moonX: 250, moonY: 32 },
    fog: [HORIZON2 - 14, HORIZON2 + 40],
    rainBand: [HORIZON2 + 6, H - 6],
    sounds: { always: { surf: 0.7 }, day: { gulls: 0.7 }, night: {} },
    create(env) {
      const sky = env.makeSky();
      const sea = layer();
      ditherGradient(sea.ctx, 0, HORIZON2, W, H - HORIZON2, ["#56afe0", "#3690c8", "#2676b0", "#1c5e96", "#154c7e"]);
      rect(sea.ctx, 0, HORIZON2, W, 1, "#8fcaec");
      for (let i = 0; i < 26; i++) {
        const h = Math.round(Math.sin(i / 26 * Math.PI) * 5);
        rect(sea.ctx, 60 + i, HORIZON2 - h, 1, h, "#5a86a8");
      }
      env.grade(sea.canvas);
      const shine = layer();
      const shineColor = { sunset: ["#ff9a50", 0.5], night: ["#8ab0ff", 0.3], sunny: ["#ffffff", 0.22] }[env.id];
      if (env.sun.kind && shineColor) {
        glow(shine.ctx, env.sun.x, HORIZON2 + 4, 46, shineColor[0], shineColor[1]);
        shine.ctx.clearRect(0, 0, W, HORIZON2 + 1);
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
      env.grade(isle.canvas);
      const r = rng(19);
      const choppy = 0.6 + env.wind * 1.1;
      const waves = [];
      for (let i = 0; i < 90; i++) {
        const depth = r();
        waves.push({
          x: r() * W,
          y: HORIZON2 + 3 + Math.round(depth * depth * (H - HORIZON2 - 6)),
          len: 2 + Math.round(depth * 8),
          speed: (4 + depth * 10) * (r() < 0.5 ? 1 : -1),
          p: r() * 6,
          near: depth < 0.4
        });
      }
      const caps = Array.from({ length: 60 }, () => ({
        x: r() * W,
        y: HORIZON2 + 6 + Math.round(r() * r() * (H - HORIZON2 - 10)),
        p: r() * 6,
        len: 2 + Math.floor(r() * 4)
      }));
      const gulls = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 40 + r() * 30, speed: 7 + r() * 5, p: i }));
      const waveNear = env.c("#a8dcf6");
      const waveFar = env.c("#7fc2ea");
      const white = env.c("#ffffff");
      const hull = env.c("#7a3a28");
      const hullDark = env.c("#5a2a1c");
      const mast = env.c("#3a2a20");
      const sailA = env.c("#f4f1e8");
      const sailB = env.c("#dcd6c8");
      const wake = env.rgba("#ffffff", 0.35);
      const gull = env.c("#f4f6fa");
      const gullTip = env.c("#aab4c4");
      const glitterMain = env.sun.kind === "moon" ? "#dfe8ff" : env.id === "sunset" ? "#ffe0a8" : "#ffffff";
      const glitter = env.rgba(glitterMain, env.sun.kind === "moon" ? 0.7 : 1);
      const showGulls = !env.night && !env.storm;
      const pitch = 1 + env.wind * 2;
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(sea.canvas, 0, 0);
          ctx.drawImage(shine.canvas, 0, 0);
          for (const w of waves) {
            const x = wrap(w.x + t * w.speed * choppy, W + 20) - 10;
            if (Math.sin(t * 1.2 + w.p) < -0.6) continue;
            ctx.fillStyle = w.near ? waveNear : waveFar;
            ctx.fillRect(Math.round(x), w.y, w.len, 1);
          }
          if (env.wind >= 0.9) {
            ctx.fillStyle = white;
            for (const c of caps) {
              const x = wrap(c.x + t * 9 * choppy, W + 10) - 5;
              if (Math.sin(t * 3 + c.p) > 0.2) ctx.fillRect(Math.round(x), c.y, c.len, 1);
            }
          }
          if (env.sun.kind) {
            const gr = rng(Math.floor(t * 8));
            ctx.fillStyle = glitter;
            for (let i = 0; i < 14; i++) {
              const y = HORIZON2 + 2 + Math.floor(gr() * 50);
              const spread = 4 + (y - HORIZON2) * 0.4;
              ctx.fillRect(env.sun.x + Math.round((gr() - 0.5) * spread * 2), y, 1, 1);
            }
          }
          const bx = Math.round(wrap(t * 4 + 40, W + 60) - 30);
          const by = Math.round(HORIZON2 + 8 + Math.sin(t * 1.5) * pitch);
          rect(ctx, bx, by, 14, 2, hull);
          rect(ctx, bx + 1, by + 2, 12, 1, hullDark);
          rect(ctx, bx + 6, by - 13, 1, 13, mast);
          for (let i = 0; i < 11; i++) {
            rect(ctx, bx + 7, by - 12 + i, Math.round(i * 0.6), 1, sailA);
            rect(ctx, bx + 5 - Math.round(i * 0.35), by - 10 + i, Math.round(i * 0.35), 1, sailB);
          }
          ctx.fillStyle = wake;
          ctx.fillRect(bx - 2, by + 3, 18, 1);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            rect(ctx, bx + 6, by - 15, 2, 2, "#ffd27a");
            glow(ctx, bx + 7, by - 14, 8, "#ffb84a", 0.6);
            ctx.globalAlpha = 1;
          }
          if (showGulls) {
            for (const g of gulls) {
              const x = Math.round(wrap(g.x + t * g.speed, W + 20) - 10);
              const y = Math.round(g.y + Math.sin(t * 0.8 + g.p) * 4);
              const up = Math.floor(t * 4 + g.p) % 2 === 0;
              ctx.fillStyle = gull;
              ctx.fillRect(x, y, 1, 1);
              ctx.fillRect(x - 1, y + (up ? -1 : 0), 1, 1);
              ctx.fillRect(x + 1, y + (up ? -1 : 0), 1, 1);
              ctx.fillStyle = gullTip;
              ctx.fillRect(x - 2, y + (up ? -1 : 1), 1, 1);
              ctx.fillRect(x + 2, y + (up ? -1 : 1), 1, 1);
            }
          }
          ctx.drawImage(isle.canvas, 0, 0);
          ctx.fillStyle = white;
          for (let x = -10; x < 90; x += 3) {
            const d = (x - 35) / 50;
            const h = Math.max(0, Math.round((1 - d * d) * 16));
            if (h > 0 && h < 6 && Math.sin(t * 2 * choppy + x) > 0) ctx.fillRect(x, H - h - 1, 1, 1);
          }
        }
      };
    }
  };

  // js/scenes/neon-demo.js
  var COLS = 10;
  var ROWS = 20;
  var KINDS = ["I", "O", "T", "S", "Z", "J", "L"];
  var WELL = COLS - 1;
  var STACK_TOP = ROWS - 4;
  var SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  };
  var rotateCw = (m) => m[0].map((_, i) => m.map((row) => row[i]).reverse());
  var ROTATIONS = Object.fromEntries(KINDS.map((kind) => {
    const list = [];
    let m = SHAPES[kind];
    for (let i = 0; i < 4; i++) {
      const cells = [];
      m.forEach((row, dy) => row.forEach((v, dx) => {
        if (v) cells.push([dx, dy]);
      }));
      list.push({ cells, w: m[0].length, h: m.length });
      m = rotateCw(m);
    }
    return [kind, list];
  }));
  var ORIENTS = Object.fromEntries(KINDS.map((kind) => {
    const seen = /* @__PURE__ */ new Set();
    const list = [];
    ROTATIONS[kind].forEach((o, rot) => {
      const key = o.cells.join(";");
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ ...o, rot });
      }
    });
    return [kind, list];
  }));
  var flatBottom = (o) => Array.from({ length: o.w }, (_, dx) => o.cells.some(([x, y]) => x === dx && y === o.h - 1)).every(Boolean);
  var TOPPERS = KINDS.flatMap((kind) => ORIENTS[kind].filter((o) => o.h <= 2 && flatBottom(o)).map((o) => ({ kind, o })));
  var at = (x, y) => y * COLS + x;
  function fits(board, cells, x, y) {
    return cells.every(([dx, dy]) => {
      const cx = x + dx, cy = y + dy;
      return cx >= 0 && cx < COLS && cy < ROWS && (cy < 0 || board[at(cx, cy)] === 0);
    });
  }
  function landing(board, cells, x) {
    if (!fits(board, cells, x, 0)) return -1;
    let y = 0;
    while (fits(board, cells, x, y + 1)) y++;
    return y;
  }
  function paint(board, move) {
    const v = KINDS.indexOf(move.kind) + 1;
    for (const [dx, dy] of move.o.cells) board[at(move.x + dx, move.y + dy)] = v;
  }
  function shuffle(list, r) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  function tile(board, r) {
    const cover = new Int8Array(COLS * ROWS).fill(-1);
    const pieces = [];
    let nodes = 0;
    const options = KINDS.flatMap((kind) => ORIENTS[kind].map((o) => ({ kind, o })));
    const firstEmpty = () => {
      for (let y = STACK_TOP; y < ROWS; y++) for (let x = 0; x < WELL; x++) if (board[at(x, y)] === 0 && cover[at(x, y)] < 0) return [x, y];
      return null;
    };
    const solve = () => {
      const spot = firstEmpty();
      if (!spot) return true;
      if (++nodes > 4e3) return false;
      const [x, y] = spot;
      for (const { kind, o } of shuffle(options.slice(), r)) {
        const ox = x - o.cells[0][0], oy = y - o.cells[0][1];
        const ok = o.cells.every(([dx, dy]) => {
          const cx = ox + dx, cy = oy + dy;
          return cx >= 0 && cx < WELL && cy >= STACK_TOP && cy < ROWS && board[at(cx, cy)] === 0 && cover[at(cx, cy)] < 0;
        });
        if (!ok) continue;
        for (const [dx, dy] of o.cells) cover[at(ox + dx, oy + dy)] = pieces.length;
        pieces.push({ kind, o, x: ox, y: oy });
        if (solve()) return true;
        pieces.pop();
        for (const [dx, dy] of o.cells) cover[at(ox + dx, oy + dy)] = -1;
      }
      return false;
    };
    return solve() ? pieces : null;
  }
  function dropOrder(board, pieces, r) {
    const filled = board.slice();
    const left = pieces.slice();
    const order = [];
    const supported = (p) => p.o.cells.every(([dx, dy]) => {
      const cx = p.x + dx, cy = p.y + dy + 1;
      return cy >= ROWS || p.o.cells.some(([ex, ey]) => ex === dx && ey === dy + 1) || filled[at(cx, cy)] !== 0;
    });
    while (left.length) {
      const ready = left.filter(supported);
      if (!ready.length) return null;
      const p = ready[Math.floor(r() * ready.length)];
      paint(filled, p);
      order.push(p);
      left.splice(left.indexOf(p), 1);
    }
    return order;
  }
  function planStack(board, r) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const pieces = tile(board, r);
      const order = pieces && dropOrder(board, pieces, r);
      if (order) return order;
    }
    return null;
  }
  function chooseToppers(block, r) {
    const board = block.slice();
    const moves = [];
    const count = r() < 0.5 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      for (let tries = 0; tries < 30; tries++) {
        const { kind, o } = TOPPERS[Math.floor(r() * TOPPERS.length)];
        const x = Math.floor(r() * (COLS - o.w));
        const y = landing(board, o.cells, x);
        if (y < 0 || y > STACK_TOP - 1) continue;
        const holeFree = o.cells.every(([dx, dy]) => dy < o.h - 1 || y + dy + 1 >= ROWS || board[at(x + dx, y + dy + 1)] !== 0);
        if (!holeFree) continue;
        const move = { kind, o, x, y };
        paint(board, move);
        moves.push(move);
        break;
      }
    }
    return moves;
  }
  function afterClear(board) {
    const next = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < STACK_TOP; y++) for (let x = 0; x < COLS; x++) next[at(x, y + 4)] = board[at(x, y)];
    return next;
  }
  function planCycles(r, count) {
    const cycles = [];
    let left = new Uint8Array(COLS * ROWS);
    let stack = planStack(left, r);
    for (let c = 0; c < count; c++) {
      const last = c === count - 1;
      const block = left.slice();
      for (const m of stack) paint(block, m);
      let toppers = [];
      let nextLeft = new Uint8Array(COLS * ROWS);
      let nextStack = null;
      for (let attempt = 0; attempt < 120 && !last; attempt++) {
        toppers = chooseToppers(block, r);
        const after = block.slice();
        for (const m of toppers) paint(after, m);
        nextLeft = afterClear(after);
        nextStack = planStack(nextLeft, r);
        if (nextStack) break;
      }
      if (!last && !nextStack) throw new Error("neon demo: no plan for the next cycle");
      const well = { kind: "I", o: ORIENTS.I.find((o) => o.h === 4), x: WELL, y: STACK_TOP };
      cycles.push({ left, stack, toppers, well, nextLeft });
      left = nextLeft;
      stack = nextStack;
    }
    return cycles;
  }
  function shapeOf(kind) {
    return ROTATIONS[kind][0];
  }
  var easeIn = (u) => u * u;
  var clamp01 = (u) => Math.max(0, Math.min(1, u));
  function createDemo(seed = 9, cycleCount = 6) {
    const r = rng(seed);
    const cycles = planCycles(r, cycleCount);
    const moves = [];
    const events = [];
    const bursts = [];
    let cursor = 0;
    cycles.forEach((cycle, ci) => {
      const board = cycle.left.slice();
      const list = [
        ...cycle.stack.map((m) => ({ ...m, role: "stack" })),
        ...cycle.toppers.map((m) => ({ ...m, role: "topper" })),
        { ...cycle.well, role: "well" }
      ];
      for (const m of list) {
        const spawnX = Math.floor((COLS - ROTATIONS[m.kind][0].w) / 2);
        const steps = m.o.rot === 3 ? [3] : Array.from({ length: m.o.rot }, (_, i) => i + 1);
        const t0 = cursor;
        let t = t0 + 0.16 + r() * 0.08;
        const rotTimes = steps.map(() => {
          const at0 = t;
          t += 0.11;
          return at0;
        });
        const slideAt = t;
        const cols = Math.abs(m.x - spawnX);
        t += cols * 0.05 + 0.05;
        const dropAt = t;
        t += Math.max(0.1, m.y / 55);
        const move = {
          ...m,
          cycle: ci,
          before: board.slice(),
          spawnX,
          steps,
          rotTimes,
          slideAt,
          cols,
          dropAt,
          lockAt: t,
          spawnAt: t0
        };
        moves.push(move);
        rotTimes.forEach((rt) => events.push({ t: rt, kind: "rotate" }));
        if (cols > 0) events.push({ t: slideAt, kind: "move" });
        events.push({ t: dropAt, kind: "drop" }, { t, kind: "lock" });
        paint(board, m);
        cursor = t + 0.14 + r() * 0.2;
        if (m.role === "well") {
          move.clear = { flashEnd: t + 0.6, burstAt: t + 0.6, collapseStart: t + 0.62, collapseEnd: t + 0.95, settled: cycle.toppers.length > 0 };
          move.after = board.slice();
          events.push({ t, kind: "tetris" });
          bursts.push(t + 0.6);
          if (move.clear.settled) events.push({ t: t + 0.95, kind: "land" });
          cursor = t + (ci === cycles.length - 1 ? 1.6 : 1.4);
        }
      }
    });
    const period = cursor;
    events.sort((a, b) => a.t - b.t);
    const scores = [0];
    const scoreAfter = (n) => {
      while (scores.length <= n) {
        const i = scores.length - 1;
        scores.push(scores[i] + 800 * (1 + Math.floor(i * 4 / 10)));
      }
      return scores[n];
    };
    const sparkSeed = rng(seed * 31 + 7);
    const sparkVel = Array.from({ length: COLS * ROWS * 2 }, () => [(sparkSeed() - 0.5) * 30, -6 - sparkSeed() * 22]);
    function frame(t) {
      const loops = Math.floor(t / period);
      const tt = t - loops * period;
      let idx = 0;
      for (let lo = 0, hi = moves.length - 1; lo <= hi; ) {
        const mid = lo + hi >> 1;
        if (moves[mid].spawnAt <= tt) {
          idx = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      const m = moves[idx];
      const out = { cells: [], piece: null, ghost: null, sparks: [], title: 0, next: 0, lines: 0, level: 1, score: 0 };
      const addBoard = (board, from, to, dy = 0, flash = false) => {
        for (let y = from; y < to; y++) for (let x = 0; x < COLS; x++) {
          const v = board[at(x, y)];
          if (v) out.cells.push({ x, y: y + dy, k: v - 1, flash });
        }
      };
      out.next = KINDS.indexOf(moves[(idx + 1) % moves.length].kind);
      if (tt < m.lockAt) {
        addBoard(m.before, 0, ROWS);
        const k = KINDS.indexOf(m.kind);
        let rot = 0;
        m.rotTimes.forEach((rt, i) => {
          if (tt >= rt) rot = m.steps[i];
        });
        const shape = ROTATIONS[m.kind][rot].cells;
        let px2 = m.spawnX;
        let py = 0;
        if (tt >= m.slideAt) {
          const moved = Math.min(m.cols, Math.floor((tt - m.slideAt) / 0.05) + 1);
          px2 = m.spawnX + Math.sign(m.x - m.spawnX) * moved;
        }
        if (tt >= m.dropAt) py = m.y * easeIn(clamp01((tt - m.dropAt) / (m.lockAt - m.dropAt)));
        if (tt >= m.dropAt) px2 = m.x;
        out.piece = { k, cells: shape.map(([dx, dy]) => [px2 + dx, py + dy]) };
        if (tt >= m.slideAt + Math.max(0, m.cols * 0.05) - 0.01) {
          out.ghost = m.o.cells.map(([dx, dy]) => [m.x + dx, m.y + dy]);
        }
      } else if (!m.clear) {
        addBoard(m.before, 0, ROWS);
        const lockedFor = tt - m.lockAt;
        for (const [dx, dy] of m.o.cells) out.cells.push({ x: m.x + dx, y: m.y + dy, k: KINDS.indexOf(m.kind), flash: lockedFor < 0.06 });
      } else {
        const c = m.clear;
        const since = tt - m.lockAt;
        if (tt < c.flashEnd) {
          const flash = Math.floor(since / 0.05) % 2 === 0;
          addBoard(m.after, 0, STACK_TOP);
          addBoard(m.after, STACK_TOP, ROWS, 0, flash);
        } else {
          const u = clamp01((tt - c.collapseStart) / (c.collapseEnd - c.collapseStart));
          addBoard(m.after, 0, STACK_TOP, 4 * easeIn(u));
          const age = tt - c.burstAt;
          if (age < 0.9) {
            for (let y = STACK_TOP; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
              const v = m.after[at(x, y)];
              if (!v) continue;
              for (let s = 0; s < 2; s++) {
                const [vx, vy] = sparkVel[at(x, y) * 2 + s];
                out.sparks.push({ x: x + 0.5 + vx * age / 7, y: y + 0.5 + (vy * age + 38 * age * age) / 7, k: v - 1, a: 1 - age / 0.9 });
              }
            }
          }
        }
        if (since < 1.5) out.title = Math.min(1, since / 0.12) * (since > 1.1 ? (1.5 - since) / 0.4 : 1);
      }
      const done = bursts.filter((b) => b <= tt).length;
      const tetrises = loops * cycles.length + done;
      out.lines = tetrises * 4;
      out.level = 1 + Math.floor(out.lines / 10);
      out.score = scoreAfter(tetrises);
      return out;
    }
    return {
      period,
      cycles,
      moves,
      frame,
      events(t0, t1) {
        const found = [];
        for (let p = Math.floor(t0 / period); p <= Math.floor(t1 / period); p++) {
          for (const e of events) {
            const at0 = p * period + e.t;
            if (at0 > t0 && at0 <= t1) found.push({ t: at0, kind: e.kind });
          }
        }
        return found;
      }
    };
  }

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
  var KIND_COLORS = ["#3ff5d0", "#ffd84a", "#b06bff", "#9bff5a", "#ff4f7a", "#4f8bff", "#ff9a3a"];
  var CELL = 7;
  var BOARD = { x: 232, y: 30 };
  var PANEL = { x: 187, y: 30, w: 39 };
  var GLYPHS = {
    0: "111101101101111",
    1: "010110010010111",
    2: "111001111100111",
    3: "111001111001111",
    4: "101101111001001",
    5: "111100111001111",
    6: "111100111101111",
    7: "111001001001001",
    8: "111101111101111",
    9: "111101111001111",
    T: "111010010010010",
    E: "111100111100111",
    R: "111101111110101",
    I: "111010010010111",
    S: "111100111001111",
    L: "100100100100111",
    N: "111101101101101",
    V: "101101101101010",
    C: "111100100100111",
    O: "111101101101111",
    X: "101101010101101",
    D: "110101101101110"
  };
  function text(ctx, str, x, y, color, scale = 1) {
    ctx.fillStyle = color;
    let cx = x;
    for (const ch of String(str)) {
      const g = GLYPHS[ch];
      if (g) {
        for (let i = 0; i < 15; i++) if (g[i] === "1") ctx.fillRect(cx + i % 3 * scale, y + Math.floor(i / 3) * scale, scale, scale);
      }
      cx += 4 * scale;
    }
  }
  var textWidth = (str, scale = 1) => String(str).length * 4 * scale - scale;
  function cellSprite(color, white) {
    const c = document.createElement("canvas");
    c.width = c.height = CELL;
    const g = c.getContext("2d");
    g.fillStyle = white ? "#ffffff" : color;
    g.fillRect(0, 0, CELL, CELL);
    g.fillStyle = white ? "rgba(255,255,255,0.78)" : "rgba(8,2,20,0.66)";
    g.fillRect(1, 1, CELL - 2, CELL - 2);
    g.globalAlpha = white ? 0 : 0.42;
    g.fillStyle = color;
    g.fillRect(2, 2, CELL - 4, CELL - 4);
    g.globalAlpha = 0.75;
    g.fillStyle = "#ffffff";
    g.fillRect(1, 1, 1, 1);
    return c;
  }
  var LOOKS = {
    sunny: {
      sky: ["#5a6cf0", "#7f84f4", "#b48cf0", "#ee8cd0", "#ffb0b8", "#ffd8a8"],
      floor: ["#b070e8", "#8a50c8", "#6a38a8"],
      grid: "#ffffff",
      horizon: "#ffffff",
      sun: ["#fff6b0", "#ffb0c8", 20],
      glow: 0.7
    },
    cloudy: {
      sky: ["#585888", "#68689a", "#7878a8", "#8a8ab4", "#9e9ec0", "#b2b2cc"],
      floor: ["#6a6a98", "#54547e", "#404068"],
      grid: "#c8c8f0",
      horizon: "#e0e0ff",
      sun: null,
      glow: 0.6
    },
    sunset: {
      sky: ["#0d0221", "#2a0a4a", "#5a1a7a", "#c02a8a", "#ff5a6a", "#ffb04a"],
      floor: ["#2a0a3a", "#160520", "#0a0212"],
      grid: "#ff4fb4",
      horizon: "#ffb04a",
      sun: ["#ffe066", "#ff3f8a", 26],
      glow: 1
    },
    rain: {
      sky: ["#22223c", "#2c2c4a", "#383858", "#444466", "#545476", "#666688"],
      floor: ["#2a2a48", "#1c1c34", "#101022"],
      grid: "#7a8ad0",
      horizon: "#9aaae8",
      sun: null,
      glow: 0.85
    },
    thunder: {
      sky: ["#0a0a16", "#12121f", "#1a1a2a", "#242434", "#30303f", "#3e3e50"],
      floor: ["#16162a", "#0c0c1a", "#06060e"],
      grid: "#8a7aff",
      horizon: "#a89aff",
      sun: null,
      glow: 1
    },
    night: {
      sky: ["#05030d", "#0b0620", "#170a34", "#2a0d47", "#46125a", "#5e1a6a"],
      floor: ["#1a0628", "#0c0416", "#06020c"],
      grid: "#ff4fb4",
      horizon: "#ff4fb4",
      sun: ["#ff9ad0", "#c02a8a", 16],
      glow: 1
    },
    nightthunder: {
      sky: ["#020208", "#05050e", "#0a0a16", "#101020", "#181828", "#222236"],
      floor: ["#0e0a1e", "#08061a", "#040310"],
      grid: "#7a5aff",
      horizon: "#9a7aff",
      sun: null,
      glow: 1
    }
  };
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
  function retroSun(ctx, x, y, r, top, bottom) {
    const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const from = hex(top);
    const to = hex(bottom);
    for (let row = 0; row <= r; row++) {
      const k = row / r;
      if (k > 0.4 && row % 6 < Math.round((k - 0.3) * 5)) continue;
      const dy = row - r;
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      const c = from.map((v, i) => Math.round(v + (to[i] - v) * k));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(x - half, y + dy, half * 2 + 1, 1);
    }
  }
  var neon_default = {
    id: "neon",
    name: "Neon Fall",
    signature: "night",
    horizon: HORIZON3,
    celestial: { sunX: 160, sunHighY: 60, sunLowY: 60, moonX: 160, moonY: 60 },
    fog: [HORIZON3 - 30, HORIZON3 + 40],
    rainBand: [HORIZON3 + 10, H - 4],
    sounds: { always: { hum: 0.35, arcade: 1, cabinets: 0.6 }, day: {}, night: {} },
    create(env) {
      const look = LOOKS[env.id];
      const sky = env.makeSky({ palette: look.sky, noSun: true });
      const sc = sky.canvas.getContext("2d");
      glow(sc, 160, HORIZON3, 60, look.horizon, 0.3);
      if (look.sun) retroSun(sc, 160, HORIZON3, look.sun[2], look.sun[0], look.sun[1]);
      const floor = layer();
      ditherGradient(floor.ctx, 0, HORIZON3, W, H - HORIZON3, look.floor);
      rect(floor.ctx, 0, HORIZON3, W, 1, look.horizon);
      const r = rng(71);
      const pieces = Array.from({ length: 10 }, () => {
        let shape = SHAPES2[Math.floor(r() * SHAPES2.length)];
        for (let k = Math.floor(r() * 4); k > 0; k--) shape = rotate(shape);
        const cell = r() < 0.35 ? 7 : r() < 0.6 ? 5 : 4;
        return {
          shape,
          cell,
          x: r() * 150,
          y: r() * H,
          speed: 6 + cell * 2.2 + r() * 6,
          color: COLORS[Math.floor(r() * COLORS.length)],
          p: r() * 6
        };
      }).sort((a, b) => a.cell - b.cell);
      const rush = 1.4 + env.wind * 0.3;
      const demo = createDemo(9, 6);
      const sprites = KIND_COLORS.map((c) => cellSprite(c, false));
      const flashSprites = KIND_COLORS.map((c) => cellSprite(c, true));
      const ink = look.grid === "#ffffff" ? "#e8f4ff" : look.grid;
      const cellsW = COLS * CELL, cellsH = ROWS * CELL;
      function drawStacker(ctx, t) {
        const f = demo.frame(t);
        const { x: bx, y: by } = BOARD;
        ctx.fillStyle = "rgba(6,2,16,0.5)";
        ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, 100);
        text(ctx, "NEXT", PANEL.x + 5, PANEL.y + 4, ink);
        const shape = shapeOf(KINDS[f.next]);
        const small = 4;
        const sx = PANEL.x + Math.round((PANEL.w - shape.w * small) / 2);
        for (const [dx, dy] of shape.cells) rect(ctx, sx + dx * small, PANEL.y + 13 + dy * small, small - 1, small - 1, KIND_COLORS[f.next]);
        text(ctx, "LINES", PANEL.x + 5, PANEL.y + 32, ink);
        text(ctx, String(f.lines % 1e3).padStart(3, "0"), PANEL.x + 5, PANEL.y + 40, "#ffffff");
        text(ctx, "LEVEL", PANEL.x + 5, PANEL.y + 54, ink);
        text(ctx, String(f.level % 100).padStart(2, "0"), PANEL.x + 5, PANEL.y + 62, "#ffffff");
        text(ctx, "SCORE", PANEL.x + 5, PANEL.y + 76, ink);
        text(ctx, String(f.score % 1e5).padStart(5, "0"), PANEL.x + 5, PANEL.y + 84, "#ffffff");
        ctx.globalAlpha = 0.18 + 0.05 * Math.sin(t * 2.4);
        ctx.fillStyle = ink;
        ctx.fillRect(bx - 3, by - 3, cellsW + 6, cellsH + 6);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(6,2,16,0.72)";
        ctx.fillRect(bx, by, cellsW, cellsH);
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.07;
        for (let x = 1; x < COLS; x++) ctx.fillRect(bx + x * CELL, by, 1, cellsH);
        for (let y = 1; y < ROWS; y++) ctx.fillRect(bx, by + y * CELL, cellsW, 1);
        ctx.globalAlpha = 1;
        ctx.fillRect(bx - 1, by, 1, cellsH + 1);
        ctx.fillRect(bx + cellsW, by, 1, cellsH + 1);
        ctx.fillRect(bx - 1, by + cellsH, cellsW + 2, 1);
        if (f.ghost) {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = ink;
          for (const [x, y] of f.ghost) {
            const cx = bx + x * CELL, cy = by + Math.round(y) * CELL;
            ctx.fillRect(cx, cy, CELL, 1);
            ctx.fillRect(cx, cy + CELL - 1, CELL, 1);
            ctx.fillRect(cx, cy, 1, CELL);
            ctx.fillRect(cx + CELL - 1, cy, 1, CELL);
          }
          ctx.globalAlpha = 1;
        }
        for (const c of f.cells) {
          ctx.drawImage((c.flash ? flashSprites : sprites)[c.k], bx + c.x * CELL, by + Math.round(c.y * CELL));
        }
        if (f.piece) {
          for (const [x, y] of f.piece.cells) ctx.drawImage(sprites[f.piece.k], bx + x * CELL, by + Math.round(y * CELL));
        }
        for (const s of f.sparks) {
          ctx.globalAlpha = Math.max(0, s.a);
          rect(ctx, bx + Math.round(s.x * CELL), by + Math.round(s.y * CELL), 2, 2, s.a > 0.6 ? "#ffffff" : KIND_COLORS[s.k]);
        }
        ctx.globalAlpha = 1;
        if (f.title > 0) {
          const scale = 2;
          const word = "TETRIS";
          const tx = bx + Math.round((cellsW - textWidth(word, scale)) / 2);
          const ty = by + 52 - Math.round((1 - f.title) * 6);
          ctx.globalAlpha = f.title;
          ctx.fillStyle = "rgba(6,2,16,0.75)";
          ctx.fillRect(tx - 4, ty - 4, textWidth(word, scale) + 8, 18);
          text(ctx, word, tx + 1, ty + 1, "#ff2d8a", scale);
          text(ctx, word, tx, ty, Math.floor(t * 12) % 2 ? "#ffffff" : "#ffe066", scale);
          ctx.globalAlpha = 1;
        }
      }
      let lastEventT = null;
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(floor.canvas, 0, 0);
          ctx.fillStyle = look.grid;
          for (let i = 0; i < 12; i++) {
            const z = wrap(i - t * rush, 12) / 12;
            const y = HORIZON3 + Math.round(Math.pow(z, 2.2) * (H - HORIZON3));
            ctx.globalAlpha = (0.25 + z * 0.75) * 0.55;
            ctx.fillRect(0, y, W, 1);
          }
          ctx.globalAlpha = 0.28;
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
            drawPiece(ctx, p.shape, x, y - p.cell * 3, p.cell, p.color, 0.15 * look.glow);
            drawPiece(ctx, p.shape, x, y - p.cell * 1.5, p.cell, p.color, 0.3 * look.glow);
            drawPiece(ctx, p.shape, x, y, p.cell, p.color, Math.min(1, 0.55 + 0.45 * look.glow));
          }
          drawStacker(ctx, t);
        },
        /** Report the stacker's moves since the last call, so the arcade sounds can follow them. */
        events(t, fire) {
          if (lastEventT !== null && t > lastEventT && t - lastEventT < 1) for (const e of demo.events(lastEventT, t)) fire(e);
          lastEventT = t;
        }
      };
    }
  };

  // js/scenes/city.js
  var ROAD2 = 150;
  var CAR_COLORS = ["#d94a4a", "#4a7ad9", "#e8c84a", "#f0f0f0", "#3a3a48", "#4ab86a", "#e88a3a"];
  function skyline(ctx, seed, count, minH, maxH, body, glass, litColors, litChance, winStep) {
    const r = rng(seed);
    const lit = [];
    let x = -4;
    while (x < W) {
      const w = 12 + Math.floor(r() * 22);
      const h = minH + Math.floor(r() * (maxH - minH));
      const top = ROAD2 - h;
      rect(ctx, x, top, w, h, body);
      rect(ctx, x, top, 1, h, glass);
      if (r() < 0.3) rect(ctx, x + Math.floor(w / 2), top - 6, 1, 6, body);
      for (let wy = top + 3; wy < ROAD2 - 3; wy += winStep) {
        for (let wx = x + 2; wx < x + w - 2; wx += winStep) {
          px(ctx, wx, wy, glass);
          if (r() < litChance) lit.push({ x: wx, y: wy, c: litColors[Math.floor(r() * litColors.length)], p: r() * 100 });
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
    signature: "night",
    horizon: ROAD2,
    celestial: { sunX: 262, sunHighY: 32, sunLowY: 70, moonX: 262, moonY: 32 },
    fog: [ROAD2 - 60, ROAD2 + 12],
    rainBand: [ROAD2 + 3, ROAD2 + 16],
    sounds: { always: { city: 1, traffic: 1, hum: 0.25 }, day: {}, night: {} },
    create(env) {
      const sky = env.makeSky();
      const base = layer();
      const b = base.ctx;
      const farLit = skyline(b, 3, 40, 40, 90, "#7f92b4", "#a9c0dc", ["#5a5aa8", "#6a6ab8"], 0.25, 3);
      const midLit = skyline(b, 9, 30, 25, 70, "#5f7398", "#8fb0d4", ["#ffd27a", "#7ad0ff", "#ff9ad0"], 0.18, 4);
      const signs = [];
      const nr = rng(15);
      let x = 6;
      while (x < W) {
        const w = 16 + Math.floor(nr() * 20);
        const h = 18 + Math.floor(nr() * 40);
        rect(b, x, ROAD2 - h, w, h, "#3c4866");
        rect(b, x, ROAD2 - h, 1, h, "#5a6a8a");
        if (nr() < 0.6) signs.push({ x: x + 2 + Math.floor(nr() * (w - 6)), y: ROAD2 - h + 4, h: 6 + Math.floor(nr() * 10), c: nr() < 0.5 ? "#ff4fa8" : "#4ff0ff", p: nr() * 10 });
        x += w + 6 + Math.floor(nr() * 14);
      }
      rect(b, 0, ROAD2, W, H - ROAD2, "#4a4c62");
      rect(b, 0, ROAD2, W, 2, "#9a9cc0");
      rect(b, 0, ROAD2 + 14, W, 1, "#6a6c88");
      rect(b, 0, H - 8, W, 8, "#2a2c3e");
      for (let px0 = 10; px0 < W; px0 += 40) rect(b, px0, H - 8, 4, 8, "#3a3c52");
      env.grade(base.canvas);
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
          y: right ? ROAD2 + 5 + Math.floor(r() * 3) : ROAD2 + 10 + Math.floor(r() * 3),
          len: 6 + Math.floor(r() * 10),
          body: env.c(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)])
        };
      });
      const lane = env.c("#c8cae8");
      const headlight = env.rgb("#fff6d8");
      const tailLight = env.rgb("#ff3050");
      const streak = 0.2 + 0.8 * env.lit;
      const rush = env.rain > 0 ? 0.8 : 1;
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(base.canvas, 0, 0);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            for (const list of [farLit, midLit]) {
              for (const w of list) {
                if (Math.sin(t * 0.3 + w.p) > 0.97) continue;
                px(ctx, w.x, w.y, w.c);
              }
            }
            ctx.globalAlpha = 1;
            if (env.lit > 0.3) {
              for (const a of antennas) if (Math.sin(t * 3 + a.p) > 0.3) px(ctx, a.x, a.y, "#ff3b3b");
              for (const s of signs) {
                const on = Math.sin(t * 9 + s.p) > -0.85 || Math.sin(t * 0.7 + s.p) > 0;
                if (!on) continue;
                ctx.globalAlpha = env.lit;
                rect(ctx, s.x, s.y, 2, s.h, s.c);
                ctx.globalAlpha = 0.25 * env.lit;
                rect(ctx, s.x - 1, s.y - 1, 4, s.h + 2, s.c);
                ctx.globalAlpha = 1;
              }
            }
          }
          ctx.fillStyle = lane;
          for (let i = 0; i < 12; i++) {
            const lx = wrap(i * 30 - t * 160 * rush, W + 30) - 15;
            ctx.fillRect(Math.round(lx), ROAD2 + 9, 10, 1);
          }
          for (const c of cars) {
            const cx = Math.round(wrap(c.x + t * c.speed * rush, W + 60) - 30);
            const rgb = c.right ? headlight : tailLight;
            for (let k = 0; k < c.len; k++) {
              const tx = c.right ? cx - k - 3 : cx + k + 3;
              ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${(streak * (1 - k / c.len)).toFixed(2)})`;
              ctx.fillRect(tx, c.y, 1, 1);
            }
            ctx.fillStyle = c.body;
            ctx.fillRect(cx - 2, c.y - 1, 5, 2);
            const front = c.right ? cx + 2 : cx - 2;
            ctx.fillStyle = c.right ? "#ffffff" : "#ff6070";
            ctx.globalAlpha = 0.5 + 0.5 * env.lit;
            ctx.fillRect(front, c.y - 1, 1, 1);
            ctx.globalAlpha = 1;
          }
        }
      };
    }
  };

  // js/scenes/storm.js
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
  var storm_default = {
    id: "storm",
    name: "Thunder Peak",
    signature: "thunder",
    horizon: 128,
    celestial: { sunX: 250, sunHighY: 26, sunLowY: 92, moonX: 70, moonY: 30 },
    fog: [96, 170],
    rainBand: [150, 176],
    sounds: { always: { wind: 0.3 }, day: {}, night: { owl: 0.2 } },
    create(env) {
      const sky = env.makeSky();
      const far = layer();
      peaks(far.ctx, 2, 128, 46, "#7a8aa8", "#e8f0fa");
      env.grade(far.canvas);
      const near = layer();
      peaks(near.ctx, 9, 162, 38, "#3a4658", "#c8d4e4");
      env.grade(near.canvas);
      const pr = rng(31);
      const pines = layer();
      for (let x = 0; x < W; x += 3 + Math.floor(pr() * 5)) {
        const h = 4 + Math.floor(pr() * 8);
        const y = 172 + Math.floor(pr() * 8);
        for (let i = 0; i < h; i++) rect(pines.ctx, x - Math.floor(i / 3), y - h + i, 1 + Math.floor(i / 3) * 2, 1, "#22342e");
      }
      env.grade(pines.canvas);
      const hut = layer();
      rect(hut.ctx, 250, 166, 12, 8, "#7a5a44");
      for (let i = 0; i < 5; i++) rect(hut.ctx, 248 + i, 161 + i, 16 - i * 2, 1, i === 0 ? "#f2f8ff" : "#a8b8d0");
      rect(hut.ctx, 253, 169, 3, 3, "#3f5070");
      env.grade(hut.canvas);
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          ctx.drawImage(far.canvas, 0, 0);
          ctx.drawImage(near.canvas, 0, 0);
          ctx.drawImage(hut.canvas, 0, 0);
          ctx.drawImage(pines.canvas, 0, 0);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            rect(ctx, 253, 169, 3, 3, "#ffcf6b");
            glow(ctx, 254, 170, 8, "#e8b870", 0.5);
            ctx.globalAlpha = 1;
          }
        }
      };
    }
  };

  // js/scenes/sakura.js
  var PINK = ["#f7b9cf", "#ee8fb2", "#d96a97", "#fde0ea"];
  var SPRING_SKY = ["#6fa8dc", "#8fbfe6", "#b5d6ee", "#dbe6f2", "#f6dfe2", "#fbcfd4"];
  function blossom(ctx, r, x, y, size) {
    const puffs = Array.from({ length: 5 + Math.floor(size / 2) }, () => [
      x + (r() - 0.5) * size * 2.4,
      y + (r() - 0.5) * size * 1.1,
      size * (0.45 + r() * 0.5)
    ]);
    for (const [cx, cy, pr] of puffs) disc(ctx, cx, cy + 2, Math.round(pr), PINK[2]);
    for (const [cx, cy, pr] of puffs) disc(ctx, cx, cy, Math.round(pr), PINK[1]);
    for (const [cx, cy, pr] of puffs) disc(ctx, cx - 1, cy - 1, Math.max(1, Math.round(pr * 0.65)), PINK[0]);
    for (let i = 0; i < size * 3; i++) px(ctx, x + (r() - 0.5) * size * 2.6, y + (r() - 0.6) * size * 1.4, PINK[3]);
  }
  function branch(ctx, r, x, y, angle, length, width, color) {
    const points = [];
    for (let i = 0; i < length; i++) {
      angle += (r() - 0.5) * 0.35;
      x += Math.cos(angle);
      y += Math.sin(angle);
      const w = Math.max(1, Math.round(width * (1 - i / length)));
      rect(ctx, x, y, w, w, color);
      if (i % 6 === 0) points.push([x, y]);
    }
    return points;
  }
  function torii(ctx, x, base) {
    const red = "#d8433c", dark = "#8e2630", lit = "#f0735a", cap = "#3a2a34";
    for (const lx of [x - 9, x + 6]) {
      rect(ctx, lx, base - 22, 3, 22, red);
      rect(ctx, lx, base - 22, 1, 22, lit);
      rect(ctx, lx + 2, base - 22, 1, 22, dark);
      rect(ctx, lx - 1, base - 2, 5, 2, cap);
    }
    rect(ctx, x - 11, base - 18, 22, 2, red);
    rect(ctx, x - 11, base - 17, 22, 1, dark);
    rect(ctx, x - 14, base - 25, 28, 3, red);
    rect(ctx, x - 14, base - 25, 28, 1, lit);
    rect(ctx, x - 15, base - 27, 30, 2, cap);
    rect(ctx, x - 16, base - 28, 2, 1, cap);
    rect(ctx, x + 14, base - 28, 2, 1, cap);
    rect(ctx, x - 1, base - 22, 2, 4, dark);
  }
  var sakura_default = {
    id: "sakura",
    name: "Blossom Shrine",
    signature: "sunny",
    horizon: 150,
    celestial: { sunX: 190, sunHighY: 26, sunLowY: 108, moonX: 190, moonY: 30 },
    fog: [96, 156],
    rainBand: [H - 24, H - 3],
    sounds: { always: { bell: 1, wind: 0.22 }, day: { birds: 1 }, night: { owl: 0.35, crickets: 0.4 } },
    create(env) {
      const sky = env.makeSky(env.id === "sunny" ? { palette: SPRING_SKY } : {});
      const land = layer();
      const l = land.ctx;
      const r = rng(83);
      for (let y = 0; y < 62; y++) {
        const half = 6 + y * 1.25 + Math.sin(y * 0.5) * 1.5;
        rect(l, 92 - half, 58 + y, half * 2, 1, "#8ea3c8");
        if (y < 9) rect(l, 92 - half, 58 + y, half * 2, 1, "#f4f6fb");
        else if (y < 22) {
          for (let x = -half; x < half; x++) {
            if (9 + Math.abs(Math.sin(x * 0.9)) * 12 > y) px(l, 92 + x, 58 + y, "#f4f6fb");
          }
        }
      }
      env.grade(land.canvas);
      hazeBand(l, 96, 132, env.info.sky[env.info.sky.length - 1], 0.7, 0.9);
      const hills = layer();
      const h = hills.ctx;
      ridge(h, 126, 7, "#8aa88e", 21, { freq: 0.02 });
      for (let i = 0; i < 26; i++) disc(h, r() * W, 122 + r() * 8, 2 + Math.floor(r() * 2), r() < 0.6 ? "#eea4bf" : "#f7c4d6");
      ridge(h, 142, 8, "#5f8f68", 22, { freq: 0.016 });
      for (let i = 0; i < 18; i++) {
        const x = r() * W, y = 136 + r() * 8;
        rect(h, x, y, 1, 4, "#4a3a3a");
        disc(h, x, y - 1, 3, "#e98bb0");
        disc(h, x - 1, y - 2, 2, "#f7bfd3");
      }
      const hillY = (x) => Math.round(150 - Math.exp(-(((x - 120) / 70) ** 2)) * 22 + Math.sin(x * 0.05) * 1.5);
      for (let x = 0; x < W; x++) {
        const y = hillY(x);
        rect(h, x, y, 1, H - y, "#3f7a4c");
        rect(h, x, y, 1, 2, "#6cab62");
        if (r() < 0.3) px(h, x, y + 3 + r() * 20, "#57955a");
        if (r() < 0.12) px(h, x, y + 2 + r() * 24, "#f7bfd3");
      }
      for (let i = 0; i < 17; i++) {
        const y = 129 + i * 3;
        const half = 5 + i * 1.3;
        rect(h, 120 - half, y, half * 2, 3, i % 2 ? "#b9b4ae" : "#cfcac2");
        rect(h, 120 - half, y + 2, half * 2, 1, "#8d8890");
      }
      torii(h, 120, 130);
      const lanterns = [98, 142];
      for (const lx of lanterns) {
        rect(h, lx, 138, 3, 7, "#9a96a0");
        rect(h, lx - 1, 135, 5, 3, "#7c7884");
        px(h, lx + 1, 136, "#5a5a66");
        rect(h, lx - 2, 133, 7, 2, "#9a96a0");
      }
      env.grade(hills.canvas);
      l.drawImage(hills.canvas, 0, 0);
      const tree = layer();
      const tc = tree.ctx;
      const tr = rng(19);
      for (let y = 60; y < H; y++) {
        const w = 9 + Math.max(0, y - 150) * 0.5 + Math.sin(y * 0.2) * 1.2;
        const x = 268 + Math.sin(y * 0.035) * 9;
        rect(tc, x, y, w, 1, "#4a2f33");
        rect(tc, x, y, 2, 1, "#7a5350");
        rect(tc, x + w - 2, y, 2, 1, "#2e1c24");
        if (y % 7 === 0) rect(tc, x + 2, y, w * 0.4, 1, "#2e1c24");
      }
      const tips = [];
      for (const [bx, by, ang, len, wd] of [
        [270, 92, -2.75, 120, 5],
        [272, 74, -2.2, 80, 4],
        [276, 66, -1.2, 48, 4],
        [274, 108, -2.95, 84, 3],
        [278, 84, -0.45, 46, 3],
        [270, 120, 3, 50, 2]
      ]) tips.push(...branch(tc, tr, bx, by, ang, len, wd, "#4a2f33"));
      for (const [x, y] of tips) blossom(tc, tr, x, y, 5 + Math.floor(tr() * 5));
      blossom(tc, tr, 290, 58, 12);
      blossom(tc, tr, 250, 46, 10);
      env.grade(tree.canvas);
      const petalColors = PINK.map((c) => env.c(c));
      const petals = Array.from({ length: 46 }, () => ({
        x: r() * W,
        y: r() * H,
        fall: 7 + r() * 9,
        drift: 8 + r() * 10,
        p: r() * 6,
        c: petalColors[Math.floor(r() * 4)]
      }));
      const birds = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 24 + r() * 30, speed: 10 + r() * 6, p: i * 2 }));
      const flies = Array.from({ length: 12 }, () => ({ x: 20 + r() * 200, y: 128 + r() * 26, p: r() * 10 }));
      const bird = env.c("#4a5a78");
      const showBirds = !env.night && env.rain === 0;
      const blow = 0.6 + env.wind * 1.4;
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          if (showBirds) {
            ctx.fillStyle = bird;
            for (const b of birds) {
              const x = Math.round(wrap(b.x + t * b.speed, W + 20) - 10);
              const y = Math.round(b.y + Math.sin(t * 0.8 + b.p) * 3);
              const up = Math.floor(t * 5 + b.p) % 2 === 0 ? -1 : 1;
              ctx.fillRect(x, y, 1, 1);
              ctx.fillRect(x - 1, y + up, 1, 1);
              ctx.fillRect(x + 1, y + up, 1, 1);
            }
          }
          ctx.drawImage(land.canvas, 0, 0);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            for (const lx of lanterns) {
              const flick = Math.sin(t * 9 + lx) > 0;
              rect(ctx, lx, 136, 3, 2, flick ? "#ffe9a0" : "#ffd27a");
              glow(ctx, lx + 1, 137, 9, "#ffb84a", 0.5);
            }
            ctx.globalAlpha = 1;
          }
          if (env.night && env.rain === 0) {
            for (const f of flies) {
              const on = Math.sin(t * 2.2 + f.p);
              if (on < 0.1) continue;
              ctx.fillStyle = on > 0.7 ? "#eaff9a" : "#a8d85a";
              ctx.fillRect(Math.round(f.x + Math.sin(t * 0.6 + f.p) * 14), Math.round(f.y + Math.sin(t * 1.3 + f.p * 2) * 5), 1, 1);
            }
          }
          ctx.drawImage(tree.canvas, 0, 0);
          for (const p of petals) {
            const y = wrap(p.y + t * p.fall * blow, H + 8) - 4;
            const x = wrap(p.x - t * p.drift * blow + Math.sin(t * 1.3 + p.p) * 7, W + 8) - 4;
            const flip = Math.sin(t * 4 + p.p) > 0;
            ctx.fillStyle = p.c;
            ctx.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 2);
          }
        }
      };
    }
  };

  // js/scenes/aurora.js
  var SHORE2 = 128;
  var GLASS3 = "#3f5070";
  var CURTAINS = [
    { y: 34, amp: 11, len: 34, speed: 0.22, freq: 0.021, core: [126, 255, 196], edge: [60, 190, 170] },
    { y: 22, amp: 8, len: 26, speed: -0.16, freq: 0.034, core: [150, 140, 255], edge: [90, 80, 200] }
  ];
  function snowPine(ctx, x, base, h, body, snow) {
    for (let i = 0; i < h; i++) {
      const tier = i % 5;
      const half = Math.floor(i / h * (h * 0.36)) + (tier < 2 ? 0 : 1);
      rect(ctx, x - half, base - h + i, half * 2 + 1, 1, body);
      if (tier === 0 && half > 0) rect(ctx, x - half, base - h + i, half + 1, 1, snow);
    }
    rect(ctx, x, base, 1, 2, body);
  }
  var aurora_default = {
    id: "aurora",
    name: "Northern Lights",
    signature: "night",
    horizon: SHORE2,
    precip: "snow",
    celestial: { sunX: 240, sunHighY: 26, sunLowY: 92, moonX: 70, moonY: 30 },
    fog: [86, 150],
    sounds: { always: { wind: 0.35 }, day: {}, night: { owl: 0.35 } },
    create(env) {
      const sky = env.makeSky();
      const r = rng(404);
      const showLights = env.id === "night";
      const land = layer();
      const l = land.ctx;
      for (const [base, amp, color, seed, freq, jag] of [[112, 14, "#7c92b8", 61, 0.017, 6], [120, 9, "#6a80a8", 62, 0.026, 4]]) {
        const range = layer();
        ridge(range.ctx, base, amp, color, seed, { freq, jag });
        const data = range.ctx.getImageData(0, 0, W, SHORE2).data;
        for (let x = 0; x < W; x++) {
          let y = 0;
          while (y < SHORE2 && data[(y * W + x) * 4 + 3] === 0) y++;
          const depth = 3 + Math.round(Math.sin(x * 0.3) + Math.sin(x * 0.11) * 2);
          for (let k = 0; k < depth; k++) px(range.ctx, x, y + k, k === 0 ? "#f4f8ff" : "#c8d8f0");
        }
        l.drawImage(range.canvas, 0, 0);
      }
      l.clearRect(0, SHORE2, W, H - SHORE2);
      env.grade(land.canvas);
      const lake = layer();
      ditherGradient(lake.ctx, 0, SHORE2, W, H - SHORE2, ["#b8dcf0", "#9cc8e4", "#82b4d8", "#6ca0c8"]);
      env.grade(lake.canvas);
      const near = layer();
      const n = near.ctx;
      const lights = [];
      const shoreY = (x) => Math.round(164 - Math.exp(-(((x - 236) / 60) ** 2)) * 20 + Math.sin(x * 0.04) * 3);
      for (let x = 0; x < W; x++) {
        const y = shoreY(x);
        rect(n, x, y, 1, H - y, "#dce8f8");
        rect(n, x, y, 1, 2, "#ffffff");
        if (r() < 0.25) px(n, x, y + 3 + r() * 14, "#b0c4e4");
      }
      const cabinBase = shoreY(232) + 2;
      rect(n, 220, cabinBase - 12, 26, 12, "#8a5a3e");
      for (let y = cabinBase - 11; y < cabinBase; y += 3) rect(n, 220, y, 26, 1, "#6a4028");
      for (let i = 0; i < 9; i++) rect(n, 217 + (8 - i) * 1.7, cabinBase - 21 + i, 32 - (8 - i) * 3.4, 1, i > 6 ? "#b8c8e0" : "#f2f8ff");
      rect(n, 238, cabinBase - 25, 4, 7, "#5a4038");
      rect(n, 237, cabinBase - 26, 6, 1, "#f2f8ff");
      rect(n, 225, cabinBase - 8, 5, 5, GLASS3);
      rect(n, 227, cabinBase - 8, 1, 5, "#6a4028");
      lights.push({ x: 225, y: cabinBase - 8, w: 5, h: 5 });
      rect(n, 236, cabinBase - 8, 5, 8, "#4a2c20");
      for (let i = 0; i < 14; i++) {
        const x = Math.round(i < 5 ? 6 + r() * 60 : 170 + r() * 146);
        if (x > 212 && x < 254) continue;
        snowPine(n, x, shoreY(x) + 1, 14 + Math.floor(r() * 22), "#245040", "#f2f8ff");
      }
      env.grade(near.canvas);
      const flakes = Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * H, s: 8 + r() * 10, p: r() * 6 }));
      const sparkles = Array.from({ length: 40 }, () => ({ x: Math.floor(r() * W), y: 150 + Math.floor(r() * 28), p: r() * 10 }));
      const smokeColor = env.rgb("#e8eef8");
      const sparkle = env.c("#ffffff");
      const day = !env.night && env.rain === 0 && env.id !== "sunset";
      function curtain(ctx, c, t, mirror) {
        for (let x = 0; x < W; x += 2) {
          const wave = Math.sin(x * c.freq + t * c.speed) * c.amp + Math.sin(x * c.freq * 2.7 - t * c.speed * 1.7) * c.amp * 0.4;
          const bright = 0.45 + 0.55 * Math.sin(x * 0.045 + t * c.speed * 3 + c.y);
          if (bright < 0.12) continue;
          const len = c.len * (0.6 + 0.4 * Math.sin(x * 0.07 - t * 0.31));
          const top = c.y + wave;
          if (mirror) {
            const y = SHORE2 + 2 + (SHORE2 - top - len) * 0.28;
            ctx.fillStyle = `rgba(${c.core}, ${0.16 * bright})`;
            ctx.fillRect(x, Math.round(y), 2, Math.round(len * 0.3));
            continue;
          }
          ctx.fillStyle = `rgba(${c.edge}, ${0.2 * bright})`;
          ctx.fillRect(x, Math.round(top), 2, Math.round(len));
          ctx.fillStyle = `rgba(${c.core}, ${0.4 * bright})`;
          ctx.fillRect(x, Math.round(top + len * 0.55), 2, Math.round(len * 0.45));
          ctx.fillStyle = `rgba(${c.core}, ${0.5 * bright})`;
          ctx.fillRect(x, Math.round(top + len - 3), 2, 3);
        }
      }
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          if (showLights) for (const c of CURTAINS) curtain(ctx, c, t, false);
          ctx.drawImage(land.canvas, 0, 0);
          ctx.drawImage(lake.canvas, 0, 0);
          if (showLights) for (const c of CURTAINS) curtain(ctx, c, t, true);
          ctx.drawImage(near.canvas, 0, 0);
          if (env.lit > 0.05) {
            ctx.globalAlpha = env.lit;
            ctx.fillStyle = "#ffcf6b";
            for (const w of lights) ctx.fillRect(w.x, w.y, w.w, w.h);
            glow(ctx, 227, cabinBase + 4, 9, "#e8b870", 0.4);
            ctx.globalAlpha = 1;
          }
          for (let k = 0; k < 6; k++) {
            const age = wrap(t * 0.3 + k / 6, 1);
            ctx.fillStyle = `rgba(${smokeColor[0]}, ${smokeColor[1]}, ${smokeColor[2]}, ${(0.85 - age * 0.6).toFixed(2)})`;
            ctx.fillRect(Math.round(240 + Math.sin(age * 5 + k) * 2 - age * (8 + env.wind * 8)), Math.round(cabinBase - 27 - age * 22), age > 0.5 ? 2 : 1, 1);
          }
          if (day) {
            ctx.fillStyle = sparkle;
            for (const s of sparkles) if (Math.sin(t * 3 + s.p * 5) > 0.93) ctx.fillRect(s.x, s.y, 1, 1);
          }
          if (env.rain === 0) {
            ctx.fillStyle = sparkle;
            for (const f of flakes) {
              const y = wrap(f.y + t * f.s, H);
              const x = wrap(f.x + Math.sin(t * 0.7 + f.p) * 8 - t * 5, W);
              ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
          }
        }
      };
    }
  };

  // js/scenes/falls.js
  var FALL = { x: 128, w: 30, top: 46, bottom: 138 };
  var POOL = 138;
  function fern(ctx, x, y, len, dir, color, tip) {
    for (let k = 0; k < len; k++) {
      const fx = x + dir * k;
      const fy = y - Math.sin(k / len * Math.PI) * len * 0.45 + k * 0.35;
      px(ctx, fx, fy, k > len - 3 ? tip : color);
      if (k % 2 === 0 && k > 1) {
        const leaf = Math.max(1, Math.round((1 - k / len) * 4));
        rect(ctx, fx, fy + 1, 1, leaf, color);
        rect(ctx, fx, fy - leaf, 1, leaf, color);
      }
    }
  }
  var falls_default = {
    id: "falls",
    name: "Misty Falls",
    signature: "sunny",
    horizon: 100,
    celestial: { sunX: 288, sunHighY: 20, sunLowY: 54, moonX: 288, moonY: 24 },
    fog: [70, 150],
    rainBand: [POOL + 2, H - 8],
    sounds: { always: { water: 1 }, day: { birds: 0.6 }, night: { crickets: 0.4 } },
    create(env) {
      const sky = env.makeSky();
      const land = layer();
      const l = land.ctx;
      const r = rng(77);
      const inFall = (x) => x > FALL.x - 4 && x < FALL.x + FALL.w + 4;
      const cliffTop = (x) => Math.round(46 + Math.sin(x * 0.03) * 5 + Math.sin(x * 0.11 + 1) * 2 + (inFall(x) ? 3 : 0) + Math.max(0, x - 250) * 0.5);
      const joints = [0];
      while (joints[joints.length - 1] < W) joints.push(joints[joints.length - 1] + 9 + Math.floor(r() * 22));
      const tones = ["#7a7488", "#6a657c", "#5c576e", "#4e4a60"];
      let block = 0;
      for (let x = 0; x < W; x++) {
        if (x >= joints[block + 1]) block++;
        const top = cliffTop(x);
        const warp = Math.round(Math.sin(x * 0.05 + block) * 2 + block % 3);
        for (let y = top; y < POOL; y++) {
          const band = Math.floor((y + warp) / 11);
          const edge = (y + warp) % 11;
          const tone = (band * 3 + block * 5) % 3 + (x === joints[block] ? 1 : 0);
          px(l, x, y, edge === 0 ? "#38364a" : edge === 1 ? "#9a94ac" : tones[tone]);
        }
        rect(l, x, top - 2, 1, 5, "#2f7a3f");
      }
      for (let i = 0; i < 60; i++) {
        const x = Math.floor(r() * W);
        const y = cliffTop(x) + 6 + Math.floor(r() * 80);
        if (y < POOL - 2 && !inFall(x)) rect(l, x, y, 2 + Math.floor(r() * 6), 1 + Math.floor(r() * 2), r() < 0.5 ? "#5aaa54" : "#448a48");
      }
      for (let i = 0; i < 80; i++) {
        const x = r() * W;
        if (inFall(x)) continue;
        const y = cliffTop(Math.floor(x));
        disc(l, x, y - 3 - r() * 5, 3 + Math.floor(r() * 4), r() < 0.5 ? "#2f8a3f" : "#3fa44c");
        px(l, x - 1, y - 7 - r() * 4, "#8cd470");
      }
      for (let i = 0; i < 46; i++) {
        const x = Math.floor(r() * W);
        if (x > FALL.x - 6 && x < FALL.x + FALL.w + 6) continue;
        const y = cliffTop(x) + 4 + Math.floor(r() * 50);
        rect(l, x, y, 1, 4 + Math.floor(r() * 16), r() < 0.5 ? "#3f8a44" : "#2f6a3a");
      }
      rect(l, FALL.x - 3, FALL.top, FALL.w + 6, POOL - FALL.top, "#3a3c54");
      env.grade(land.canvas);
      const spray = layer();
      glow(spray.ctx, FALL.x + FALL.w / 2, POOL - 6, 34, "#e6f8f6", 0.75);
      env.grade(spray.canvas);
      const pool = layer();
      ditherGradient(pool.ctx, 0, POOL, W, H - POOL, ["#7fd0c8", "#4fb0b4", "#2f8c9c", "#1f6a80", "#16506a"]);
      env.grade(pool.canvas);
      const front = layer();
      const f = front.ctx;
      for (const [bx, by, br] of [[24, 176, 22], [70, 186, 16], [292, 178, 26], [246, 188, 14]]) {
        disc(f, bx, by, br, "#3a3a48");
        disc(f, bx - 3, by - 3, br - 4, "#55556a");
        for (let k = 0; k < br; k++) px(f, bx - br * 0.7 + r() * br * 1.2, by - br + 2 + r() * 5, "#5aaa54");
      }
      for (let i = 0; i < 16; i++) {
        const x = i < 8 ? r() * 90 : W - r() * 80;
        fern(f, x, H - 6 - r() * 22, 12 + r() * 12, r() < 0.5 ? -1 : 1, "#2a7a3c", "#6fc45a");
      }
      env.grade(front.canvas);
      const span = FALL.bottom - FALL.top;
      const streaks = Array.from({ length: 70 }, () => ({
        x: FALL.x + r() * FALL.w,
        p: r() * 100,
        speed: 60 + r() * 50,
        len: 5 + r() * 12,
        bright: r() < 0.35
      }));
      const mist = Array.from({ length: 34 }, () => ({ a: r() * 6.28, d: r(), p: r() * 6, s: 0.2 + r() * 0.4 }));
      const ripples = Array.from({ length: 26 }, () => ({ x: r() * W, y: POOL + 4 + Math.floor(r() * 30), len: 3 + r() * 9, p: r() * 6 }));
      const birds = Array.from({ length: 3 }, (_, i) => ({ x: r() * W, y: 14 + r() * 20, speed: 9 + r() * 6, p: i * 2 }));
      const flies = Array.from({ length: 14 }, () => ({ x: 20 + r() * 280, y: POOL + 2 + r() * 40, p: r() * 10 }));
      const sheet = env.rgba("#bee8f0", 0.78);
      const lip = env.c("#e8fbff");
      const white = env.c("#ffffff");
      const streakDim = env.c("#8fc8dc");
      const ripple = env.c("#b8ece6");
      const bird = env.c("#2a3a4a");
      const showBirds = !env.night && env.rain === 0;
      const flow = 1 + (env.rain > 0 ? 0.25 : 0);
      return {
        draw(ctx, t) {
          sky.draw(ctx, t);
          if (showBirds) {
            ctx.fillStyle = bird;
            for (const b of birds) {
              const x = Math.round(wrap(b.x + t * b.speed, W + 20) - 10);
              const y = Math.round(b.y + Math.sin(t * 0.8 + b.p) * 3);
              const up = Math.floor(t * 5 + b.p) % 2 === 0 ? -1 : 1;
              ctx.fillRect(x, y, 1, 1);
              ctx.fillRect(x - 1, y + up, 1, 1);
              ctx.fillRect(x + 1, y + up, 1, 1);
            }
          }
          ctx.drawImage(land.canvas, 0, 0);
          ctx.drawImage(pool.canvas, 0, 0);
          ctx.fillStyle = sheet;
          ctx.fillRect(FALL.x, FALL.top, FALL.w, span);
          rect(ctx, FALL.x, FALL.top - 2, FALL.w, 3, lip);
          for (const s of streaks) {
            const y = FALL.top + wrap(s.p + t * s.speed * flow, span);
            rect(ctx, s.x, y, 1, Math.min(s.len, FALL.bottom - y), s.bright ? white : streakDim);
          }
          ctx.fillStyle = ripple;
          for (const rp of ripples) {
            const x = wrap(rp.x + Math.sin(t * 0.4 + rp.p) * 6, W);
            if (Math.sin(t * 1.3 + rp.p) > 0) ctx.fillRect(Math.round(x), rp.y, Math.round(rp.len), 1);
          }
          ctx.drawImage(spray.canvas, 0, 0);
          const base = FALL.x + FALL.w / 2;
          for (const m of mist) {
            const age = wrap(t * m.s + m.p, 1);
            const x = base + Math.cos(m.a) * (FALL.w * 0.5 + age * 26) * (0.4 + m.d);
            const y = POOL + 2 - age * 20 * m.d - Math.abs(Math.sin(m.a)) * 3;
            ctx.fillStyle = env.rgba("#f0fcff", ((1 - age) * 0.75).toFixed(2));
            ctx.fillRect(Math.round(x), Math.round(y), age > 0.4 ? 3 : 2, age > 0.4 ? 2 : 1);
          }
          ctx.fillStyle = white;
          for (let x = FALL.x - 6; x < FALL.x + FALL.w + 6; x += 2) {
            if (Math.sin(t * 7 + x * 1.7) > -0.2) ctx.fillRect(x, POOL - 1 + Math.round(Math.sin(t * 5 + x)), 2, 2);
          }
          if (env.night && env.rain === 0) {
            for (const fl of flies) {
              const on = Math.sin(t * 2.2 + fl.p);
              if (on < 0.1) continue;
              ctx.fillStyle = on > 0.7 ? "#eaff9a" : "#a8d85a";
              ctx.fillRect(Math.round(fl.x + Math.sin(t * 0.6 + fl.p) * 14), Math.round(fl.y + Math.sin(t * 1.3 + fl.p * 2) * 5), 1, 1);
            }
          }
          ctx.drawImage(front.canvas, 0, 0);
        }
      };
    }
  };

  // js/background.js
  var SCENES = { bamboo: bamboo_default, wheat: wheat_default, sakura: sakura_default, village: village_default, falls: falls_default, castle: castle_default, ocean: ocean_default, aurora: aurora_default, neon: neon_default, city: city_default, storm: storm_default };
  var CASUAL_SCENES = ["bamboo", "wheat", "sakura", "village", "falls", "castle", "ocean", "aurora", "neon"];
  var MODE_SCENES = { sprint: "city", blitz: "storm" };
  var FADE_S = 1.6;
  var FRAME_MS2 = 1e3 / 30;
  var MENU_CYCLE_S = 16;
  var KEEP_INSTANCES = 4;
  function describeScene(id) {
    return id === "cycle" ? "Cycle by level" : SCENES[id]?.name || id;
  }
  function createBackground(canvas, layerEl, settings2, hooks = {}) {
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
    let menuCycle = false;
    let menuIndex = 0;
    let menuSince = 0;
    let lastDraw = 0;
    const start = performance.now();
    function instance({ id, variant, key }) {
      let inst = instances.get(key);
      if (!inst) {
        const scene = SCENES[id];
        const env = createEnv(variant, scene);
        const drawing = scene.create(env);
        inst = { env, events: drawing.events, draw(c, t) {
          drawing.draw(c, t);
          env.overlay(c, t);
        } };
        instances.set(key, inst);
        for (const old of instances.keys()) {
          if (instances.size <= KEEP_INSTANCES) break;
          if (old !== current?.key && old !== previous?.key && old !== key) instances.delete(old);
        }
      }
      return inst;
    }
    function fit() {
      const scale = Math.max(window.innerWidth / W, window.innerHeight / H);
      canvas.style.width = `${Math.ceil(W * scale)}px`;
      canvas.style.height = `${Math.ceil(H * scale)}px`;
    }
    function variantFor(id, step) {
      const pick2 = settings2.weather || "default";
      if (VARIANT_INFO[pick2]) return pick2;
      if (pick2 === "cycle" && step !== null) return cycleVariant(step);
      return SCENES[id].signature;
    }
    function show(id, variant) {
      if (!SCENES[id]) return;
      const key = `${id}:${variant}`;
      if (key === current?.key) return;
      previous = current;
      current = { id, variant, key };
      fadeStart = (performance.now() - start) / 1e3;
      hooks.onScene?.({
        id,
        variant,
        sceneName: SCENES[id].name,
        weatherName: VARIANT_INFO[variant].name,
        sounds: ambienceFor(SCENES[id], variant)
      });
    }
    function casualScene(level) {
      const pick2 = settings2.casualScene || "cycle";
      if (pick2 !== "cycle" && SCENES[pick2]) return pick2;
      return CASUAL_SCENES[(Math.max(1, level) - 1) % CASUAL_SCENES.length];
    }
    let warmTimer = 0;
    function showCasual(level) {
      const id = casualScene(level);
      show(id, variantFor(id, level));
      clearTimeout(warmTimer);
      warmTimer = setTimeout(() => {
        const next = casualScene(level + 1);
        const variant = variantFor(next, level + 1);
        instance({ id: next, variant, key: `${next}:${variant}` });
      }, 2500);
    }
    function showMenuScene() {
      const pick2 = settings2.casualScene || "cycle";
      const fixed2 = pick2 !== "cycle" && SCENES[pick2];
      const id = fixed2 ? pick2 : CASUAL_SCENES[menuIndex];
      show(id, variantFor(id, menuIndex + 1));
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
        showMenuScene();
      }
      const inst = instance(current);
      inst.draw(ctx, t);
      if (hooks.onStrike) inst.env.poll(t, hooks.onStrike);
      if (hooks.onCue && inst.events) inst.events(t, hooks.onCue);
      const k = (t - fadeStart) / FADE_S;
      if (previous && k < 1) {
        instance(previous).draw(fadeCtx, t);
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
      /** Menu: slowly cycle through the Casual scenes (or show the chosen one). */
      showMenu() {
        menuCycle = true;
        menuSince = (performance.now() - start) / 1e3;
        showMenuScene();
      },
      /** The scene or weather setting changed in the menu: show it now. */
      refresh() {
        if (menuCycle) showMenuScene();
      },
      /** A game started: pick the scene for its mode. */
      showMode(modeId, level = 1) {
        menuCycle = false;
        const fixed2 = MODE_SCENES[modeId];
        if (fixed2) show(fixed2, variantFor(fixed2, null));
        else showCasual(level);
      },
      /** Casual level changed: move to the next scene in the cycle. */
      onLevel(modeId, level) {
        if (!MODE_SCENES[modeId]) showCasual(level);
      }
    };
  }

  // js/settings-defs.js
  var SOUND_PACK_LABELS = { ulol: "uloltris", arcade: "Arcade (Jstris-style)", bubbly: "Bubbly (PPT-style)" };
  var LEVELS = ["off", "low", "medium", "high"];
  var SETTINGS_TABS = [
    { id: "handling", label: "HANDLING", settings: [
      { key: "arr", label: "ARR", type: "range", describe: describeArr, hint: "Auto repeat rate. Frames between auto-shifts once DAS has charged. 0 slides to the wall at once." },
      { key: "das", label: "DAS", type: "range", describe: describeFrames, hint: "Delayed auto shift. Frames you hold a direction before it starts repeating." },
      { key: "dcd", label: "DCD", type: "range", describe: describeDcd, hint: "DAS cut delay. Pauses DAS charging for this many frames after a rotation or a new piece. 0 is off." },
      { key: "sdf", label: "SDF", type: "range", describe: describeSoftDrop, hint: "Soft drop factor. How many times faster than gravity a held soft drop falls. The top value drops at once." },
      { key: "cancelDasOnDirectionChange", label: "CANCEL DAS ON TURN", type: "toggle", hint: "On: changing direction resets the DAS charge. Off: the charge carries over." },
      { key: "preferSoftDrop", label: "PREFER SOFT DROP", type: "toggle", hint: "On: soft drop runs before sideways movement within a frame." }
    ] },
    { id: "audio", label: "AUDIO", settings: [
      { key: "masterVolume", label: "MASTER", type: "range", describe: describeVolume, hint: "Overall volume for everything." },
      { key: "sfxVolume", label: "SFX", type: "range", describe: describeVolume, hint: "Volume of move, rotate, drop and clear sounds." },
      { key: "musicVolume", label: "MUSIC", type: "range", describe: describeVolume, hint: "Volume of the soundtrack." },
      { key: "ambienceVolume", label: "SCENE SOUND VOLUME", type: "range", describe: describeVolume, hint: "Volume of rain, wind, birds and the other sounds of the scenery." },
      { key: "sfxMuted", label: "MUTE SFX", type: "toggle", hint: "Silence the effect sounds." },
      { key: "musicMuted", label: "MUTE MUSIC", type: "toggle", hint: "Silence the soundtrack." },
      { key: "ambience", label: "SCENE SOUNDS", type: "toggle", hint: "Play the sounds of the scenery: rain, thunder, wind, wheat, water, birds and more." },
      { key: "soundPack", label: "SOUND PACK", type: "enum", values: ["ulol", "arcade", "bubbly"], describe: (v) => SOUND_PACK_LABELS[v] || v, hint: "The set of effect sounds. All are synthesized; none are recordings." },
      { key: "soundtrack", label: "SOUNDTRACK", type: "enum", values: ["auto", "calm", "competitive", "intense", "off"], describe: describeSoundtrack, hint: "Auto plays calm in the menu, Casual and 40 Lines, and intense in Blitz. Or force one track." },
      { key: "crossfadeDuration", label: "PLAYER CROSSFADE", type: "range", describe: describeCrossfade, hint: "Fade between songs in the music player that plays your own files." }
    ] },
    { id: "visual", label: "VISUAL", settings: [
      { key: "blockSkin", label: "BLOCK SKIN", type: "enum", values: SKINS, describe: describeSkin, hint: "How the blocks are drawn." },
      { key: "statsDisplay", label: "STATS DISPLAY", type: "enum", values: ["off", "time", "speed", "efficiency", "versus"], describe: describeStatsDisplay, hint: "Which numbers sit at the bottom left of the board." },
      { key: "background", label: "BACKGROUND", type: "enum", values: ["on", "dim", "off"], describe: describeEnum, hint: "The pixel art scenery behind the game. Dim darkens it; off also silences scene sounds." },
      { key: "casualScene", label: "CASUAL SCENE", type: "enum", values: ["cycle", ...CASUAL_SCENES], describe: describeScene, hint: "Which scene Casual shows. Cycle changes the scene every level." },
      { key: "weather", label: "WEATHER", type: "enum", values: ["default", "cycle", ...VARIANTS], describe: describeWeather, hint: "Scene default gives each scene its own look. Cycle changes the weather every Casual level. Or pick one for every scene." },
      { key: "ghostOpacity", label: "GHOST OPACITY", type: "range", describe: describeOpacity, hint: "How visible the ghost piece is, where the piece will land." },
      { key: "showActionText", label: "CLEAR TEXT", type: "toggle", hint: "Show the name of each clear, T-spin and combo beside the board." }
    ] },
    { id: "effects", label: "FX", settings: [
      { key: "boardBounce", label: "BOARD BOUNCE", type: "enum", values: LEVELS, describe: describeEnum, hint: "The board springs on hard drops, clears and wall bumps." },
      { key: "placeImpact", label: "PLACE IMPACT", type: "enum", values: LEVELS, describe: describeEnum, hint: "Drop trail, landing flash and dust when a piece locks." },
      { key: "clearEffects", label: "CLEAR EFFECTS", type: "enum", values: LEVELS, describe: describeEnum, hint: "Row flashes, bursts, T-spin spirals, sparkles and confetti." },
      { key: "screenShake", label: "SCREEN SHAKE", type: "enum", values: LEVELS, describe: describeEnum, hint: "The board shakes on big clears." }
    ] },
    { id: "gameplay", label: "GAME", settings: [
      { key: "gameStyle", label: "GAME STYLE", type: "enum", values: ["modern", "battle"], describe: describeGameStyle, hint: "Modern spawns the next piece at once. Battle pauses on line clears and adds an entry delay. Read when a game starts." },
      { key: "nextPreviewCount", label: "NEXT PIECES", type: "range", describe: describePreviewCount, hint: "How many upcoming pieces are shown." },
      { key: "lockDelay", label: "LOCK DELAY", type: "range", describe: describeLockDelay, hint: "How long a piece can rest on the stack before it locks." },
      { key: "touchControls", label: "TOUCH CONTROLS", type: "enum", values: ["auto", "on", "off"], describe: describeEnum, hint: "On-screen buttons for phones and tablets. Auto shows them on touch devices." }
    ] }
  ];
  function findSetting(key) {
    for (const tab of SETTINGS_TABS) {
      const def = tab.settings.find((s) => s.key === key);
      if (def) return def;
    }
    return null;
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
    const semitone = (base, n) => base * Math.pow(2, n / 12);
    const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    const PACKS = {
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
      const pack = PACKS[settingsRef.soundPack];
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
          delay.delayTime.value = 0.11;
          const feedback = ctx.createGain();
          feedback.gain.value = 0.3;
          const wet = ctx.createGain();
          wet.gain.value = 0.3;
          delay.connect(feedback);
          feedback.connect(delay);
          delay.connect(wet);
          wet.connect(masterGain);
          const ring = (freq, at2, len, peak) => {
            for (const [ratio, level, decay] of [[1, 1, 1], [2, 0.3, 0.6], [3.01, 0.16, 0.35], [5.4, 0.07, 0.2]]) {
              const osc = ctx.createOscillator();
              const g = ctx.createGain();
              osc.frequency.value = freq * ratio;
              g.gain.setValueAtTime(0, at2);
              g.gain.linearRampToValueAtTime(peak * level, at2 + 3e-3);
              g.gain.exponentialRampToValueAtTime(1e-4, at2 + len * decay);
              osc.connect(g);
              g.connect(masterGain);
              g.connect(delay);
              osc.start(at2);
              osc.stop(at2 + len * decay + 0.02);
              osc.onended = () => g.disconnect();
            }
          };
          [1047, 1319, 1568].forEach((freq, i) => ring(freq, t + i * 0.045, 0.25, 0.2));
          ring(2093, t + 0.135, 1, 0.3);
          ring(3136, t + 0.135, 0.7, 0.1);
          setTimeout(() => {
            delay.disconnect();
            feedback.disconnect();
            wet.disconnect();
          }, 2500);
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
  function drum(voice, steps, vel) {
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
      events.push(...drum("lofikick", [0, 10], 0.6));
      events.push(...drum("rim", [8], 0.25));
      events.push(...drum("brush", [2, 6, 10, 14], 0.12));
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
      events.push(...drum("kick", [0, 4, 8, 12], 0.8));
      events.push(...drum("snare", fill ? [4, 12, 13, 14, 15] : [4, 12], 0.55));
      events.push(...drum("hat", [2, 6, 10, 14], 0.3));
      events.push(...drum("hat", [1, 3, 5, 7, 9, 11, 13, 15], 0.1));
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
    events.push(...drum("kick", [0, 4, 8, 10, 12], 0.85));
    events.push(...drum("snare", fill ? [4, 10, 11, 12, 13, 14, 15] : [4, 12], 0.6));
    events.push(...drum("hat", [...Array(16).keys()], 0.14));
    if (crash) events.push(...drum("crash", [0], 0.35));
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
  var TRACKS = {
    calm: { bpm: 88, swing: 0.35, delay: 0.3, loopStart: 2, bars: buildCalm() },
    competitive: { bpm: 150, swing: 0, delay: 0.12, loopStart: 2, bars: buildCompetitive() },
    intense: { bpm: 176, swing: 0, delay: 0.08, loopStart: 0, bars: buildIntense() }
  };
  var TRACK_NAMES = Object.keys(TRACKS);

  // js/music.js
  var TICK_MS = 25;
  var LOOKAHEAD_S = 0.2;
  var HANDOFF_S = 0.12;
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
    function createPlayer(name, startAt) {
      const track = TRACKS[name];
      const { gain, bus, nodes } = createBus(ctx, track, duckGain);
      gain.gain.value = TRACK_GAIN;
      return { name, track, gain, bus, nodes, bar: 0, nextBarTime: startAt, barStart: null, barLen: 0, stopAt: null };
    }
    function nextBeat(p, now) {
      if (p.barStart === null) return now + 0.1;
      const beat = p.barLen / 4;
      return p.barStart + Math.ceil((now + 0.06 - p.barStart) / beat) * beat;
    }
    function tick() {
      const now = ctx.currentTime;
      const suppressed = isSuppressed();
      const vol = suppressed ? 0 : targetVolume();
      if (Math.abs(out.gain.value - vol) > 1e-3) out.gain.setTargetAtTime(vol, now, 0.05);
      for (const p of players) {
        if (suppressed) continue;
        const until = p.stopAt === null ? now + LOOKAHEAD_S : Math.min(now + LOOKAHEAD_S, p.stopAt);
        while (p.nextBarTime < until) {
          if (p.nextBarTime < now - 0.05) p.nextBarTime = now + 0.02;
          p.barStart = p.nextBarTime;
          p.barLen = scheduleBar(voices, p.track, p.bus, p.track.bars[p.bar], p.nextBarTime, tempoScale);
          p.nextBarTime += p.barLen;
          p.bar = nextBar(p.track, p.bar);
        }
      }
      if (suppressed) {
        for (const p of players) if (p.stopAt === null) p.nextBarTime = now + 0.1;
      }
    }
    function release(p, at2) {
      const now = ctx.currentTime;
      p.stopAt = at2;
      p.gain.gain.cancelScheduledValues(now);
      p.gain.gain.setValueAtTime(TRACK_GAIN, at2);
      p.gain.gain.linearRampToValueAtTime(0, at2 + HANDOFF_S);
      setTimeout(() => {
        p.gain.disconnect();
        p.nodes.forEach((n) => n.disconnect());
        players.splice(players.indexOf(p), 1);
      }, (at2 - now + HANDOFF_S) * 1e3 + 500);
    }
    function applyTrack() {
      if (!ctx) return;
      const now = ctx.currentTime;
      const live = players.find((p) => p.stopAt === null);
      if (live && live.name === wanted) return;
      let startAt = now + 0.1;
      if (live) {
        startAt = wanted && !isSuppressed() ? nextBeat(live, now) : now + 0.05;
        release(live, startAt);
      }
      if (wanted) players.push(createPlayer(wanted, startAt));
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

  // js/ambience-synth.js
  var TAU = Math.PI * 2;
  function stereo(sr, seconds) {
    const n = Math.round(sr * seconds);
    return [new Float32Array(n), new Float32Array(n)];
  }
  function mix(out, start, grain, len, pan) {
    const [left, right] = out;
    const n = left.length;
    const angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
    const gl = Math.cos(angle);
    const gr = Math.sin(angle);
    let j = (start % n + n) % n;
    for (let i = 0; i < len; i++) {
      left[j] += grain[i] * gl;
      right[j] += grain[i] * gr;
      if (++j >= n) j = 0;
    }
  }
  function sineGrain(buf, sr, f0, f1, tau, amp) {
    const len = Math.min(buf.length, Math.ceil(tau * 6 * sr));
    const attack = Math.max(2, Math.round(sr * 3e-4));
    const decay = Math.exp(-1 / (tau * sr));
    let phase = 0;
    let env = amp;
    for (let i = 0; i < len; i++) {
      phase += TAU * (f0 + (f1 - f0) * i / len) / sr;
      buf[i] = Math.sin(phase) * env * Math.min(1, i / attack);
      env *= decay;
    }
    return len;
  }
  function noiseGrain(buf, sr, r, freq, q, attackS, decayS, amp) {
    const len = Math.min(buf.length, Math.ceil((attackS + decayS * 5) * sr));
    const w = TAU * Math.min(freq, sr * 0.45) / sr;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w) / a0;
    const a2 = (1 - alpha) / a0;
    const b0 = alpha / a0;
    const gain = amp * Math.sqrt(q) * 2.2;
    const attack = Math.max(1, attackS * sr);
    const decay = Math.exp(-1 / (decayS * sr));
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, env = 1;
    for (let i = 0; i < len; i++) {
      const x = r() * 2 - 1;
      const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      if (i < attack) buf[i] = y * gain * (i / attack);
      else {
        buf[i] = y * gain * env;
        env *= decay;
      }
    }
    return len;
  }
  function* addBand(ch, sr, r, { rate, hp, lp, level }, breathe, gustPhase) {
    const n = ch.length;
    const shot = new Float32Array(n);
    for (let i = Math.round(rate * n / sr); i > 0; i--) shot[Math.floor(r() * n)] += (r() * 2 - 1) * (0.6 + 0.8 * r() ** 2);
    const kLp = 1 - Math.exp(-TAU * lp / sr);
    const kHp = 1 - Math.exp(-TAU * hp / sr);
    let l1 = 0, l2 = 0, a = 0, b = 0;
    const run = (x) => {
      l1 += (x - l1) * kLp;
      l2 += (l1 - l2) * kLp;
      a += (l2 - a) * kHp;
      const v = l2 - a;
      b += (v - b) * kHp;
      return v - b;
    };
    const warm = Math.min(n, Math.round(sr * 0.25));
    for (let i = n - warm; i < n; i++) run(shot[i]);
    const p1 = r() * TAU, p2 = r() * TAU;
    const c1 = 2 + Math.floor(r() * 2), c2 = 5 + Math.floor(r() * 3), c3 = 13 + Math.floor(r() * 6);
    const p3 = r() * TAU;
    for (let i = 0; i < n; i++) {
      const mod = 1 + breathe * (0.55 * Math.sin(TAU * c1 * i / n + p1 + gustPhase) + 0.35 * Math.sin(TAU * c2 * i / n + p2) + 0.25 * Math.sin(TAU * c3 * i / n + p3));
      ch[i] += run(shot[i]) * level * mod;
      if (i % 65536 === 0) yield;
    }
  }
  function normalize(out, targetRms) {
    let sum = 0;
    for (const ch of out) for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / (out[0].length * out.length)) || 1;
    const k = targetRms / rms;
    for (const ch of out) {
      for (let i = 0; i < ch.length; i++) {
        const v = ch[i] * k;
        const a = Math.abs(v);
        ch[i] = a <= 0.8 ? v : Math.sign(v) * (0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19));
      }
    }
    return out;
  }
  function* rainLoop(sr, { seconds = 6.5, bands = [], breathe = 0.2, ticks = 16, leaves = 8, drips = 1, gusts = 0, seed = 1 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const gustPhase = r() * TAU;
    for (const ch of out) {
      for (const band of bands) {
        yield* addBand(ch, sr, r, band, breathe, gustPhase);
      }
    }
    let sum = 0;
    for (const ch of out) for (let i = 0; i < n; i++) sum += ch[i] * ch[i];
    const k = 1 / (Math.sqrt(sum / (n * out.length)) || 1);
    for (const ch of out) for (let i = 0; i < n; i++) ch[i] *= k;
    const g = new Float32Array(Math.ceil(sr * 0.1));
    let made = 0;
    const when = () => {
      let at2 = Math.floor(r() * n);
      if (gusts > 0) {
        for (let tries = 0; tries < 4; tries++) {
          const wave = 0.5 + 0.5 * Math.sin(TAU * 2 * at2 / n + gustPhase);
          if (r() < 1 - gusts + gusts * wave) break;
          at2 = Math.floor(r() * n);
        }
      }
      return at2;
    };
    const loud = () => 0.25 + 0.75 * r() ** 2;
    for (let i = Math.round(ticks * seconds); i > 0; i--) {
      const len = noiseGrain(g, sr, r, 3e3 + r() * 4200, 2.5 + r() * 2, 2e-4, 12e-4 + r() * 2e-3, loud() * 3.1);
      mix(out, when(), g, len, r() * 2 - 1);
      if (++made % 64 === 0) yield;
    }
    for (let i = Math.round(leaves * seconds); i > 0; i--) {
      const len = noiseGrain(g, sr, r, 1100 + r() * 1500, 1.2 + r(), 6e-4, 4e-3 + r() * 5e-3, loud() * 3.1);
      mix(out, when(), g, len, r() * 2 - 1);
      if (++made % 64 === 0) yield;
    }
    for (let i = Math.round(drips * seconds); i > 0; i--) {
      const at2 = when();
      const pan = r() * 1.6 - 0.8;
      let len = noiseGrain(g, sr, r, 4200, 2, 2e-4, 1e-3, 3);
      mix(out, at2, g, len, pan);
      len = noiseGrain(g, sr, r, 2400 + r() * 1800, 14, 4e-4, 6e-3 + r() * 6e-3, 3.5);
      mix(out, at2, g, len, pan);
    }
    yield;
    return normalize(out, 0.085);
  }
  function gustCurve(n, sr, r, count, widthMin, widthMax) {
    const out = new Float32Array(n);
    for (let k = 0; k < count; k++) {
      const half = (widthMin + r() * (widthMax - widthMin)) * sr;
      const from = Math.floor(r() * n - half);
      const amp = 0.55 + 0.45 * r();
      for (let d = 0; d < half * 2; d++) {
        const i = ((from + d) % n + n) % n;
        out[i] += amp * 0.5 * (1 - Math.cos(Math.PI * d / half));
      }
    }
    for (let i = 0; i < n; i++) out[i] = Math.min(1, out[i]);
    return out;
  }
  function noiseArray(n, r) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
    return out;
  }
  function unitRms(a) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += a[i] * a[i];
    const k = 1 / (Math.sqrt(sum / a.length) || 1);
    for (let i = 0; i < a.length; i++) a[i] *= k;
  }
  function* windLoop(sr, { seconds = 10, seed = 41, gusty = 0.7, howl = 0 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const gust = gustCurve(n, sr, r, Math.max(2, Math.round(seconds / 3)), 1.1, 2.6);
    const phase = [r() * TAU, r() * TAU, r() * TAU];
    const cycles = [Math.max(1, Math.round(seconds * 0.5)), Math.max(2, Math.round(seconds * 1.4))];
    const strength = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const mixed = (1 - gusty) * 0.5 + gusty * gust[i];
      const flutter = 1 + 0.14 * Math.sin(TAU * cycles[1] * i / n + phase[1]) + 0.08 * Math.sin(TAU * cycles[1] * 2.9 * i / n + phase[2]);
      strength[i] = (0.16 + 0.84 * mixed) * flutter;
    }
    const kRum = 1 - Math.exp(-TAU * 110 / sr);
    const warm = Math.min(n, Math.round(sr * 0.6));
    for (let ch = 0; ch < 2; ch++) {
      const x = noiseArray(n, rng(seed * 13 + ch * 101));
      const y = out[ch];
      let low1 = 0, band1 = 0, low2 = 0, band2 = 0, rum1 = 0, rum2 = 0;
      const step = (i) => {
        const s = strength[i];
        const f1 = 2 * Math.sin(Math.PI * (170 + 900 * s ** 1.3) / sr);
        low1 += f1 * band1;
        band1 += f1 * (x[i] - low1 - 0.72 * band1);
        rum1 += (x[i] - rum1) * kRum;
        rum2 += (rum1 - rum2) * kRum;
        let v = band1 * 0.85 + rum2 * 3.2 * s;
        if (howl > 0) {
          const f2 = 2 * Math.sin(Math.PI * (340 + 560 * s + 30 * Math.sin(TAU * cycles[1] * 3 * i / n + phase[0])) / sr);
          low2 += f2 * band2;
          band2 += f2 * (x[i] - low2 - 0.05 * band2);
          v += band2 * howl * 0.9 * s * s;
        }
        return v * s ** 1.15;
      };
      for (let i = n - warm; i < n; i++) step(i);
      for (let i = 0; i < n; i++) {
        const tilt = 1 + (ch === 0 ? 1 : -1) * 0.22 * Math.sin(TAU * cycles[0] * i / n + phase[0]);
        y[i] = step(i) * tilt;
        if (i % 65536 === 0) yield;
      }
    }
    return normalize(out, 0.085);
  }
  function* wheatLoop(sr, { seconds = 11, seed = 7 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const g = new Float32Array(Math.ceil(sr * 0.5));
    const gust = gustCurve(n, sr, r, Math.max(2, Math.round(seconds / 2.4)), 0.9, 2.2);
    let made = 0;
    for (let i = Math.round(200 * seconds); i > 0; i--) {
      const at2 = Math.floor(r() * n);
      const s = gust[at2];
      if (r() > 0.1 + 0.9 * s ** 1.3) continue;
      const len = noiseGrain(g, sr, r, 1600 + r() * 3e3, 0.8 + r() * 0.7, 0.012 + r() * 0.03, 0.035 + r() * 0.08, (0.3 + 0.7 * r()) * (0.3 + 0.7 * s));
      mix(out, at2, g, len, (r() * 2 - 1) * 0.85);
      if (++made % 48 === 0) yield;
    }
    for (let i = Math.round(5 * seconds); i > 0; i--) {
      const at2 = Math.floor(r() * n);
      if (r() > 0.15 + 0.85 * gust[at2]) continue;
      const len = noiseGrain(g, sr, r, 1800 + r() * 1800, 1.2, 2e-3, 0.01 + r() * 0.012, 0.16 * (0.4 + 0.6 * r()));
      mix(out, at2, g, len, (r() * 2 - 1) * 0.85);
      if (++made % 48 === 0) yield;
    }
    yield;
    return normalize(out, 0.05);
  }
  function* surfLoop(sr, { seconds = 30, waves = 3, size = 1, seed = 51 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const slot = n / waves;
    const [left, right] = out;
    const lp = (fc) => 1 - Math.exp(-TAU * fc / sr);
    for (let w = 0; w < waves; w++) {
      const crashAt = Math.floor((w + 0.35 + r() * 0.35) * slot);
      const build = 2.4 + r() * 1.6;
      const wash = 4 + r() * 2.2;
      const big = size * (0.75 + 0.45 * r());
      const p0 = r() < 0.5 ? -0.6 : 0.6;
      const p1 = -p0 * (0.3 + 0.5 * r());
      const length = Math.round((build + wash + 0.8) * sr);
      const start = crashAt - Math.round(build * sr);
      let a1 = 0, a2 = 0;
      let h = 0;
      let c1 = 0, c2 = 0;
      let t1 = 0;
      let w1 = 0, w2 = 0, wh = 0;
      let fz = 0;
      for (let i = 0; i < length; i++) {
        const t = (i - Math.round(build * sr)) / sr;
        const white = r() * 2 - 1;
        let v = 0;
        if (t < 0) {
          const u = Math.max(0, (t + build) / build);
          const e = 0.6 * u ** 2.3;
          a1 += (white - a1) * lp(180 + 700 * u);
          a2 += (a1 - a2) * lp(180 + 700 * u);
          h += (white - h) * lp(1800);
          v += a2 * e * 5 + (white - h) * e * 0.12 * u;
        }
        if (t >= 0) {
          const attack = 1 - Math.exp(-t / 0.035);
          const crash = attack * Math.exp(-t / 0.55);
          const fc = 1100 + 3100 * Math.exp(-t / 0.7);
          c1 += (white - c1) * lp(fc);
          c2 += (c1 - c2) * lp(fc);
          t1 += (white - t1) * lp(240);
          v += c2 * crash * 2.4 + t1 * attack * Math.exp(-t / 0.5) * 4.5;
        }
        if (t >= 0.05) {
          const span = Math.max(0, 1 - t / wash);
          const e = (1 - Math.exp(-t / 0.3)) * span ** 1.7;
          const fc = 900 + 2600 * span;
          w1 += (white - w1) * lp(fc);
          w2 += (w1 - w2) * lp(fc);
          wh += (w2 - wh) * lp(450);
          v += (w2 - wh) * e * 1.5;
          const pops = (420 * span * span + 12) / sr;
          fz += ((r() < pops ? (r() * 2 - 1) * (0.3 + 0.7 * r()) * (0.3 + span) : 0) - fz) * 0.6;
          v += fz * 0.7;
        }
        const k = Math.max(0, Math.min(1, t / wash));
        const pan = t < 0 ? p0 : p0 + (p1 - p0) * k;
        const angle = (pan + 1) * Math.PI / 4;
        const j = ((start + i) % n + n) % n;
        left[j] += v * big * Math.cos(angle);
        right[j] += v * big * Math.sin(angle);
        if (i % 65536 === 0) yield;
      }
    }
    const roarPhase = r() * TAU;
    const kRoar = lp(280);
    for (const ch of out) {
      let a = 0, b = 0;
      for (let i = 0; i < n; i++) {
        a += (r() * 2 - 1 - a) * kRoar;
        b += (a - b) * kRoar;
        ch[i] += b * 0.75 * (1 + 0.35 * Math.sin(TAU * 3 * i / n + roarPhase));
        if (i % 65536 === 0) yield;
      }
    }
    return normalize(out, 0.06);
  }
  var BELL_PARTIALS = [
    [0.5, 0.55, 3.6],
    [1, 1, 4.6],
    [1.19, 0.6, 3.3],
    [1.5, 0.45, 2.6],
    [2, 0.5, 2.3],
    [2.51, 0.22, 1.4],
    [3, 0.2, 1.1],
    [4.15, 0.12, 0.65],
    [5.43, 0.08, 0.42],
    [6.8, 0.05, 0.27]
  ];
  function* bellStrike(sr, { freq = 146.8, seconds = 11, seed = 5 } = {}) {
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const r = rng(seed);
    const [left, right] = out;
    for (const [ratio, level, tau] of BELL_PARTIALS) {
      for (const twin of [0, 1]) {
        const f = freq * ratio * (twin ? 1 + 9e-4 + r() * 32e-4 : 1);
        const w = TAU * f / sr;
        const decay = Math.exp(-1 / (tau * (0.85 + 0.3 * r()) * sr));
        const amp = level * (twin ? 0.7 : 1);
        const c = 2 * decay * Math.cos(w);
        const d2 = decay * decay;
        const attack = Math.max(8, Math.round(sr * (ratio < 1.2 ? 0.012 : 4e-3)));
        const pan = (r() * 2 - 1) * 0.5;
        const gl = Math.cos((pan + 1) * Math.PI / 4);
        const gr = Math.sin((pan + 1) * Math.PI / 4);
        let y1 = amp * decay * Math.sin(w);
        let y2 = 0;
        for (let i = 1; i < n; i++) {
          const v = y1 * (i < attack ? i / attack : 1);
          left[i] += v * gl;
          right[i] += v * gr;
          const y0 = c * y1 - d2 * y2;
          y2 = y1;
          y1 = y0;
          if (i % 131072 === 0) yield;
        }
      }
    }
    const g = new Float32Array(Math.ceil(sr * 0.1));
    const len = noiseGrain(g, sr, r, 900, 0.8, 8e-4, 0.01, 0.6);
    mix(out, 0, g, len, 0);
    const fade = Math.round(sr * 1.5);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const k = n - i < fade ? (n - i) / fade : 1;
      left[i] *= k;
      right[i] *= k;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    const scale = 0.4 / (peak || 1);
    for (let i = 0; i < n; i++) {
      left[i] *= scale;
      right[i] *= scale;
    }
    return out;
  }
  function* thunderClap(sr, { distance = 0.4, seed = 1 } = {}) {
    const r = rng(seed);
    const near = 1 - distance;
    const seconds = 5.5 + r() * 2.5 + distance * 2;
    const out = stereo(sr, seconds);
    const n = out[0].length;
    const env = new Float32Array(n);
    const bumps = [{ t: 0, a: 1, rise: 0.05 + distance * 0.45, fall: 0.9 + r() * 0.5 + distance * 0.7 }];
    for (let k2 = 3 + Math.floor(r() * 4); k2 > 0; k2--) {
      const t = 0.5 + r() * seconds * 0.55;
      bumps.push({ t, a: (0.3 + r() * 0.5) * (1 - t / seconds), rise: 0.15 + r() * 0.4, fall: 0.7 + r() * 1.3 });
    }
    for (const b of bumps) {
      const start = Math.floor(b.t * sr);
      for (let i = start; i < n; i++) {
        const t = (i - start) / sr;
        const v = t < b.rise ? (t / b.rise) ** 1.5 : Math.exp(-(t - b.rise) / b.fall);
        if (t > b.rise && v < 2e-3) break;
        env[i] += v * b.a;
      }
      yield;
    }
    const lp = (fc) => 1 - Math.exp(-TAU * fc / sr);
    const kDeep = lp(105 + near * 80);
    const kBody = lp(300 + near * 250);
    const kSlow = lp(2.5);
    const kOut = lp(330 + near * 450);
    for (const ch of out) {
      const deep = new Float32Array(n);
      let a = 0, b = 0, c = 0, d = 0;
      for (let i = 0; i < n; i++) {
        const w = r() * 2 - 1;
        a += (w - a) * kDeep;
        b += (a - b) * kDeep;
        c += (b - c) * kDeep;
        d += (c - d) * kDeep;
        deep[i] = d;
        if (i % 65536 === 0) yield;
      }
      unitRms(deep);
      const body = new Float32Array(n);
      let e = 0, f = 0;
      for (let i = 0; i < n; i++) {
        const w = r() * 2 - 1;
        e += (w - e) * kBody;
        f += (e - f) * kBody;
        body[i] = f;
      }
      unitRms(body);
      let s1 = 0, s2 = 0, o1 = 0, o2 = 0;
      for (let i = 0; i < n; i++) {
        s1 += (r() * 2 - 1 - s1) * kSlow;
        s2 += (s1 - s2) * kSlow;
        const roll = Math.max(0.25, Math.min(1.7, 0.8 + s2 * 7));
        const fade = Math.min(1, (n - i) / (sr * 1.2));
        const x = Math.tanh(2.1 * (deep[i] + body[i] * 0.5) * env[i] * roll * fade);
        o1 += (x - o1) * kOut;
        o2 += (o1 - o2) * kOut;
        ch[i] = o2;
        if (i % 65536 === 0) yield;
      }
    }
    const g = new Float32Array(Math.ceil(sr * 0.6));
    if (near > 0.25) {
      for (let k2 = 2 + Math.floor(r() * 2); k2 > 0; k2--) {
        const at2 = Math.floor(r() * 0.05 * sr);
        const len2 = noiseGrain(g, sr, r, 350 + r() * 600, 0.7, 4e-4, 4e-3 + r() * 0.012, near * (0.5 + r() * 0.5) * 2.2);
        mix(out, at2, g, Math.min(len2, n - at2), r() * 0.6 - 0.3);
      }
    }
    const low = 42 + r() * 20;
    let len = sineGrain(g, sr, low * 1.25, low * 0.8, 0.22 + near * 0.1, 1.2);
    mix(out, 0, g, Math.min(len, n), 0);
    len = sineGrain(g, sr, low * 2.4, low * 1.8, 0.12, 0.45);
    mix(out, 0, g, Math.min(len, n), 0);
    for (let k2 = 2 + Math.floor(r() * 2); k2 > 0; k2--) {
      const at2 = Math.floor((0.5 + r() * seconds * 0.4) * sr);
      len = sineGrain(g, sr, (low + 6) * 1.1, low * 0.85, 0.3, 0.5 * (1 - at2 / n));
      mix(out, at2, g, Math.min(len, n - at2), r() * 0.8 - 0.4);
    }
    let peak = 0;
    for (const ch of out) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(ch[i]));
    const k = 0.95 * (1 - 0.3 * distance) / (peak || 1);
    for (const ch of out) for (let i = 0; i < n; i++) ch[i] *= k;
    return out;
  }
  var RAIN_KINDS = {
    rain: [
      {
        seconds: 6.1,
        seed: 11,
        breathe: 0.3,
        ticks: 26,
        leaves: 14,
        drips: 2,
        bands: [
          { rate: 19800, hp: 1500, lp: 5e3, level: 0.3 },
          { rate: 8400, hp: 350, lp: 1800, level: 1.12 },
          { rate: 4e3, hp: 100, lp: 500, level: 0.6 }
        ]
      },
      {
        seconds: 7.7,
        seed: 12,
        breathe: 0.32,
        ticks: 18,
        leaves: 11,
        drips: 1.4,
        bands: [
          { rate: 17600, hp: 1600, lp: 5200, level: 0.3 },
          { rate: 9100, hp: 400, lp: 1600, level: 1.11 },
          { rate: 3500, hp: 90, lp: 450, level: 0.6 }
        ]
      }
    ],
    storm: [
      {
        seconds: 5.9,
        seed: 21,
        breathe: 0.5,
        gusts: 0.6,
        ticks: 52,
        leaves: 18,
        drips: 3,
        bands: [
          { rate: 26400, hp: 1500, lp: 5600, level: 0.4 },
          { rate: 11200, hp: 320, lp: 2e3, level: 1.28 },
          { rate: 5e3, hp: 70, lp: 450, level: 1 }
        ]
      },
      {
        seconds: 7.3,
        seed: 22,
        breathe: 0.55,
        gusts: 0.8,
        ticks: 40,
        leaves: 14,
        drips: 2.4,
        bands: [
          { rate: 24200, hp: 1600, lp: 5400, level: 0.4 },
          { rate: 10500, hp: 340, lp: 1900, level: 1.25 },
          { rate: 4500, hp: 60, lp: 400, level: 1.02 }
        ]
      }
    ],
    water: [
      {
        seconds: 6.7,
        seed: 31,
        breathe: 0.08,
        ticks: 5,
        leaves: 0,
        drips: 0,
        bands: [
          { rate: 19800, hp: 500, lp: 5200, level: 0.51 },
          { rate: 9100, hp: 160, lp: 1400, level: 1.06 },
          { rate: 4e3, hp: 60, lp: 320, level: 0.76 }
        ]
      },
      {
        seconds: 8.3,
        seed: 32,
        breathe: 0.1,
        ticks: 4,
        leaves: 0,
        drips: 0,
        bands: [
          { rate: 17600, hp: 600, lp: 5e3, level: 0.51 },
          { rate: 8400, hp: 180, lp: 1300, level: 1.01 },
          { rate: 3500, hp: 60, lp: 300, level: 0.76 }
        ]
      }
    ]
  };

  // js/ambience.js
  var BEDS = ["rain", "storm", "wind", "gale", "wheat", "water", "surf", "hum", "city"];
  var CALLS = ["birds", "crickets", "owl", "gulls", "bell", "traffic", "cabinets"];
  var FLAGS = ["thunder", "arcade"];
  var AMBIENCE_LAYERS = [...BEDS, ...CALLS, ...FLAGS];
  var GLIDE_S = 0.9;
  var TICK_MS2 = 200;
  var LOOKAHEAD_S2 = 0.6;
  var MASTER_GAIN = 0.5;
  var IDLE_S = 8;
  var CLAPS = [[0.12, 1], [0.12, 2], [0.42, 3], [0.42, 4], [0.75, 5], [0.75, 6]];
  var SOUND_LAG_MIN_S = 0.55;
  var SOUND_LAG_S = 3;
  var BELLS = [[146.8, 5], [130.8, 6], [164.8, 7]];
  var FIRST_CALL_S = { bell: [6, 16] };
  var rand = (min, max) => min + Math.random() * (max - min);
  var pick = (list) => list[Math.floor(Math.random() * list.length)];
  function createNoiseBuffer2(ctx) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  function inSlices(gen) {
    return new Promise((resolve) => {
      function step() {
        const start = performance.now();
        let result;
        do {
          result = gen.next();
        } while (!result.done && performance.now() - start < 3);
        if (result.done) resolve(result.value);
        else setTimeout(step, 0);
      }
      step();
    });
  }
  function createSources(ctx, noise) {
    function noiseSource(nodes) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.start(0, Math.random() * 2);
      nodes.push(src);
      return src;
    }
    function filter(type, freq, q, nodes) {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      if (q) f.Q.value = q;
      nodes.push(f);
      return f;
    }
    function gain(value, nodes) {
      const g = ctx.createGain();
      g.gain.value = value;
      nodes.push(g);
      return g;
    }
    function lfo(param, hz, depth, nodes) {
      const o = ctx.createOscillator();
      o.frequency.value = hz;
      const g = gain(depth, nodes);
      o.connect(g);
      g.connect(param);
      o.start();
      nodes.push(o);
    }
    function noisePath(nodes, dest, level, ...filters) {
      let node = noiseSource(nodes);
      for (const f of filters) {
        node.connect(f);
        node = f;
      }
      const g = gain(level, nodes);
      node.connect(g);
      g.connect(dest);
      return g;
    }
    const loops = /* @__PURE__ */ new Map();
    function toBuffer([left, right]) {
      const buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
      buffer.copyToChannel(left, 0);
      buffer.copyToChannel(right, 1);
      return buffer;
    }
    function loop(key, make) {
      if (!loops.has(key)) loops.set(key, inSlices(make()).then(toBuffer));
      return loops.get(key);
    }
    async function loopBed(dest, nodes, isStopped, builders, level) {
      const buffers = await Promise.all(builders.map(([key, make]) => loop(key, make)));
      if (isStopped()) return;
      for (const buffer of buffers) {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.start(0, Math.random() * buffer.duration);
        const g = gain(level, nodes);
        src.connect(g);
        g.connect(dest);
        nodes.push(src);
      }
    }
    const rainBuilders = (kind) => RAIN_KINDS[kind].map((o, i) => [`${kind}${i}`, () => rainLoop(ctx.sampleRate, o)]);
    const wheatBuilders = [
      ["wheat0", () => wheatLoop(ctx.sampleRate, { seconds: 10.4, seed: 7 })],
      ["wheat1", () => wheatLoop(ctx.sampleRate, { seconds: 13.7, seed: 8 })]
    ];
    const windBuilders = [
      ["wind0", () => windLoop(ctx.sampleRate, { seconds: 9.7, seed: 41, gusty: 0.55 })],
      ["wind1", () => windLoop(ctx.sampleRate, { seconds: 12.9, seed: 42, gusty: 0.65 })]
    ];
    const galeBuilders = [
      ["gale0", () => windLoop(ctx.sampleRate, { seconds: 8.3, seed: 43, gusty: 0.9, howl: 0.8 })],
      ["gale1", () => windLoop(ctx.sampleRate, { seconds: 11.1, seed: 44, gusty: 0.95, howl: 0.7 })]
    ];
    const surfBuilders = [
      ["surf0", () => surfLoop(ctx.sampleRate, { seconds: 30.5, waves: 3, size: 1, seed: 51 })],
      ["surf1", () => surfLoop(ctx.sampleRate, { seconds: 38.3, waves: 4, size: 0.7, seed: 52 })]
    ];
    const beds = {
      rain(dest, nodes, isStopped) {
        noisePath(nodes, dest, 0.03, filter("lowpass", 500, 0, nodes));
        return loopBed(dest, nodes, isStopped, rainBuilders("rain"), 0.7);
      },
      storm(dest, nodes, isStopped) {
        noisePath(nodes, dest, 0.05, filter("lowpass", 700, 0, nodes));
        return loopBed(dest, nodes, isStopped, rainBuilders("storm"), 0.7);
      },
      // A breeze that swells and eases, and a gale with heavy gusts and a faint howl
      wind(dest, nodes, isStopped) {
        return loopBed(dest, nodes, isStopped, windBuilders, 0.8);
      },
      gale(dest, nodes, isStopped) {
        return loopBed(dest, nodes, isStopped, galeBuilders, 0.9);
      },
      // Ears and leaves brushing past each other, very quiet, in swells as each gust passes
      wheat(dest, nodes, isStopped) {
        return loopBed(dest, nodes, isStopped, wheatBuilders, 0.45);
      },
      water(dest, nodes, isStopped) {
        noisePath(nodes, dest, 0.3, filter("lowpass", 1500, 0, nodes), filter("highpass", 120, 0, nodes));
        return loopBed(dest, nodes, isStopped, rainBuilders("water"), 0.6);
      },
      // Waves that build, break and wash back down the beach
      surf(dest, nodes, isStopped) {
        return loopBed(dest, nodes, isStopped, surfBuilders, 0.6);
      },
      hum(dest, nodes) {
        for (const [freq, level] of [[55, 0.1], [110.6, 0.04], [165.2, 0.015]]) {
          const o = ctx.createOscillator();
          o.frequency.value = freq;
          const g = gain(level, nodes);
          o.connect(g);
          g.connect(dest);
          o.start();
          nodes.push(o);
          lfo(g.gain, 0.09 + freq / 900, level * 0.4, nodes);
        }
      },
      city(dest, nodes) {
        const g = noisePath(nodes, dest, 0.7, filter("lowpass", 210, 0, nodes));
        lfo(g.gain, 0.05, 0.15, nodes);
      }
    };
    function tone(dest, t, { type = "sine", wave = null, from, to = from, len, peak, attack = 5e-3, pan = 0 }) {
      const o = ctx.createOscillator();
      if (wave) o.setPeriodicWave(wave);
      else o.type = type;
      o.frequency.setValueAtTime(from, t);
      if (to !== from) o.frequency.exponentialRampToValueAtTime(to, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(1e-4, t + len);
      o.connect(g);
      let out = g;
      if (pan && ctx.createStereoPanner) {
        out = ctx.createStereoPanner();
        out.pan.value = pan;
        g.connect(out);
      }
      out.connect(dest);
      o.start(t);
      o.stop(t + len + 0.02);
      o.onended = () => {
        g.disconnect();
        out.disconnect();
      };
      return o;
    }
    function burst(dest, t, len, type, freq, q, shape) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      shape(g.gain, f);
      src.connect(f);
      f.connect(g);
      g.connect(dest);
      src.start(t, Math.random() * 2);
      src.stop(t + len);
      src.onended = () => {
        f.disconnect();
        g.disconnect();
      };
    }
    const pulses = /* @__PURE__ */ new Map();
    function pulse(duty) {
      if (!pulses.has(duty)) {
        const size = 48;
        const real = new Float32Array(size);
        const imag = new Float32Array(size);
        for (let k = 1; k < size; k++) real[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty);
        pulses.set(duty, ctx.createPeriodicWave(real, imag));
      }
      return pulses.get(duty);
    }
    function chipRun(dest, t, notes, { duty = 0.25, peak = 0.05, cutoff = 2600, pan = 0 }) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = cutoff;
      f.connect(dest);
      let end = 0;
      for (const [freq, at2, len] of notes) {
        tone(f, t + at2, { wave: pulse(duty), from: freq, len, peak, attack: 2e-3, pan });
        end = Math.max(end, at2 + len);
      }
      setTimeout(() => f.disconnect(), (t - ctx.currentTime + end + 0.5) * 1e3);
    }
    const cues = {
      move(t, dest) {
        chipRun(dest, t, [[440, 0, 0.022]], { duty: 0.125, peak: 0.03, cutoff: 5e3 });
      },
      rotate(t, dest) {
        chipRun(dest, t, [[660, 0, 0.03], [990, 0.03, 0.03]], { duty: 0.25, peak: 0.04, cutoff: 5e3 });
      },
      drop(t, dest) {
        tone(dest, t, { wave: pulse(0.5), from: 880, to: 160, len: 0.1, peak: 0.05, attack: 2e-3 });
      },
      lock(t, dest) {
        tone(dest, t, { wave: pulse(0.5), from: 150, to: 90, len: 0.07, peak: 0.07, attack: 2e-3 });
        burst(dest, t, 0.04, "bandpass", 2400, 1, (g) => {
          g.linearRampToValueAtTime(0.05, t + 2e-3);
          g.exponentialRampToValueAtTime(1e-4, t + 0.035);
        });
      },
      land(t, dest) {
        tone(dest, t, { wave: pulse(0.5), from: 110, to: 70, len: 0.1, peak: 0.06, attack: 2e-3 });
      },
      // Four rows gone: a rising arpeggio and a held top note, with a bass under it
      tetris(t, dest) {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
        chipRun(dest, t, [...notes.map((f, i) => [f, i * 0.065, 0.07]), [2093, notes.length * 0.065, 0.55]], { duty: 0.25, peak: 0.06, cutoff: 6e3 });
        chipRun(dest, t, [[261.63, 0, 0.2], [523.25, notes.length * 0.065, 0.45]], { duty: 0.5, peak: 0.035, cutoff: 3e3 });
        tone(dest, t, { type: "triangle", from: 130.81, len: 0.5, peak: 0.07, attack: 4e-3 });
      }
    };
    const calls = {
      // Somewhere else in the arcade, other machines: coin, laser, power-up, blips, a jingle, a boom
      cabinets(t, dest) {
        const pan = rand(-0.85, 0.85);
        const far = { duty: pick([0.125, 0.25, 0.5]), peak: rand(0.03, 0.05), cutoff: rand(1800, 3e3), pan };
        const kind = pick(["coin", "laser", "power", "blips", "jingle", "boom"]);
        if (kind === "coin") chipRun(dest, t, [[987.77, 0, 0.07], [1318.51, 0.07, 0.32]], far);
        else if (kind === "laser") {
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.value = far.cutoff;
          f.connect(dest);
          tone(f, t, { wave: pulse(0.5), from: rand(1600, 2200), to: rand(180, 320), len: rand(0.14, 0.26), peak: far.peak, attack: 2e-3, pan });
          setTimeout(() => f.disconnect(), (t - ctx.currentTime + 1) * 1e3);
        } else if (kind === "power") {
          const base = pick([392, 440, 523.25]);
          chipRun(dest, t, [0, 4, 7, 12, 16, 19].map((s, i) => [base * 2 ** (s / 12), i * 0.055, 0.06]), far);
        } else if (kind === "blips") {
          const n = 2 + Math.floor(Math.random() * 3);
          chipRun(dest, t, Array.from({ length: n }, (_, i) => [rand(500, 1400), i * rand(0.09, 0.14), 0.05]), far);
        } else if (kind === "jingle") {
          const scale = [0, 2, 4, 7, 9, 12];
          const base = pick([262, 294, 330]);
          chipRun(dest, t, Array.from({ length: 7 }, (_, i) => [base * 2 ** (pick(scale) / 12), i * 0.12, 0.1]), far);
        } else {
          burst(dest, t, 0.5, "lowpass", 900, 0.7, (g, f) => {
            g.linearRampToValueAtTime(far.peak * 6, t + 0.01);
            g.exponentialRampToValueAtTime(1e-4, t + 0.45);
            f.frequency.exponentialRampToValueAtTime(180, t + 0.45);
          });
        }
        return rand(4, 11);
      },
      birds(t, dest) {
        const pan = rand(-0.7, 0.7);
        const base = rand(2600, 4600);
        const song = Math.random();
        if (song < 0.45) {
          const n = 2 + Math.floor(Math.random() * 4);
          for (let i = 0; i < n; i++) {
            tone(dest, t + i * rand(0.1, 0.15), { from: base, to: base * rand(1.2, 1.5), len: 0.07, peak: 0.22, pan });
          }
        } else if (song < 0.75) {
          const n = 7 + Math.floor(Math.random() * 8);
          for (let i = 0; i < n; i++) {
            tone(dest, t + i * 0.045, { from: base * 1.1, to: base * 0.9, len: 0.035, peak: 0.16, pan });
          }
        } else {
          tone(dest, t, { from: base * 0.9, to: base * 0.8, len: 0.22, peak: 0.18, attack: 0.03, pan });
          tone(dest, t + 0.3, { from: base * 0.72, to: base * 0.66, len: 0.3, peak: 0.18, attack: 0.03, pan });
        }
        return rand(1.2, 5.5);
      },
      crickets(t, dest) {
        const freq = pick([4300, 4650, 4900]);
        const pan = rand(-0.8, 0.8);
        for (let i = 0; i < 3; i++) tone(dest, t + i * 0.05, { from: freq, len: 0.03, peak: 0.2, attack: 4e-3, pan });
        return rand(0.35, 0.8);
      },
      owl(t, dest) {
        const base = rand(330, 390);
        const pan = rand(-0.5, 0.5);
        [0, 0.5, 0.74].forEach((offset, i) => {
          tone(dest, t + offset, { from: base, to: base * 0.93, len: i === 0 ? 0.36 : 0.22, peak: 0.26, attack: 0.05, pan });
        });
        return rand(11, 26);
      },
      gulls(t, dest) {
        const pan = rand(-0.7, 0.7);
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const start = t + i * 0.42;
          const o = tone(dest, start, { type: "triangle", from: 1500, to: 1150, len: 0.36, peak: 0.2, attack: 0.04, pan });
          o.frequency.setValueAtTime(1500, start);
          o.frequency.linearRampToValueAtTime(2050, start + 0.09);
        }
        return rand(6, 15);
      },
      // A temple bell struck far off, once in a long while
      bell(t, dest) {
        const buffer = bells.length ? pick(bells) : null;
        if (!buffer) return 3;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = 0.75;
        src.connect(g);
        g.connect(dest);
        src.start(t);
        src.onended = () => g.disconnect();
        return rand(26, 46);
      },
      // A car passing on the highway
      traffic(t, dest) {
        const len = rand(2.2, 3.6);
        burst(dest, t, len, "bandpass", 260, 0.8, (g, f) => {
          g.linearRampToValueAtTime(0.55, t + len * 0.5);
          g.linearRampToValueAtTime(1e-4, t + len - 0.05);
          f.frequency.linearRampToValueAtTime(620, t + len * 0.5);
          f.frequency.linearRampToValueAtTime(240, t + len);
        });
        return rand(2.5, 7);
      }
    };
    const claps = [];
    let clapsStarted = false;
    const bells = [];
    let bellsStarted = null;
    return {
      bed(name, dest) {
        const nodes = [];
        let stopped = false;
        const ready = Promise.resolve(beds[name](dest, nodes, () => stopped));
        return {
          ready,
          stop() {
            stopped = true;
            for (const n of nodes) {
              try {
                n.stop?.();
              } catch {
              }
              n.disconnect();
            }
          }
        };
      },
      call(name, t, dest) {
        return calls[name](t, dest);
      },
      /** Play one of the stacker's cues ('move', 'rotate', 'drop', 'lock', 'land', 'tetris') at time t. */
      cue(kind, t, dest) {
        cues[kind]?.(t, dest);
      },
      /** Start building the bells. Safe to call again; it only runs once. Resolves when all are ready. */
      prepareBells() {
        if (!bellsStarted) {
          bellsStarted = (async () => {
            for (const [freq, seed] of BELLS) {
              const samples = await inSlices(bellStrike(ctx.sampleRate, { freq, seed }));
              bells.push(toBuffer(samples));
            }
          })();
        }
        return bellsStarted;
      },
      /** Start building the thunderclaps. Safe to call again; it only runs once. */
      prepareClaps() {
        if (clapsStarted) return;
        clapsStarted = true;
        (async () => {
          for (const [distance, seed] of CLAPS) {
            const samples = await inSlices(thunderClap(ctx.sampleRate, { distance, seed }));
            claps.push({ distance, buffer: toBuffer(samples) });
          }
        })();
      },
      /** The built clap closest to a distance (0 overhead, 1 far), or null if none is ready. */
      clapFor(distance) {
        if (!claps.length) return null;
        const near = claps.filter((c) => Math.abs(c.distance - distance) < 0.2);
        return pick(near.length ? near : claps).buffer;
      }
    };
  }
  function createAmbience(settings2) {
    let ctx = null;
    let master = null;
    let sources = null;
    let timer = null;
    let wanted = {};
    const layers = /* @__PURE__ */ new Map();
    function targetVolume() {
      if (!settings2.ambience || settings2.background === "off" || document.hidden) return 0;
      return (settings2.masterVolume ?? 100) / 100 * ((settings2.ambienceVolume ?? 60) / 100) * MASTER_GAIN;
    }
    function ensureLayer(name) {
      if (layers.has(name)) return layers.get(name);
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      const [firstMin, firstMax] = FIRST_CALL_S[name] || [0.3, 2.5];
      const layer2 = { gain: g, level: 0, idleSince: 0, next: ctx.currentTime + rand(firstMin, firstMax) };
      layer2.stop = BEDS.includes(name) ? sources.bed(name, g).stop : () => {
      };
      layers.set(name, layer2);
      if (name === "thunder") sources.prepareClaps();
      if (name === "bell") sources.prepareBells();
      return layer2;
    }
    function apply() {
      if (!ctx) return;
      const now = ctx.currentTime;
      for (const name of AMBIENCE_LAYERS) {
        const level = wanted[name] || 0;
        if (level === 0 && !layers.has(name)) continue;
        const layer2 = ensureLayer(name);
        if (layer2.level === level) continue;
        layer2.level = level;
        layer2.idleSince = level === 0 ? now : 0;
        layer2.gain.gain.setTargetAtTime(level, now, GLIDE_S / 3);
      }
    }
    function tick() {
      const now = ctx.currentTime;
      const vol = targetVolume();
      if (Math.abs(master.gain.value - vol) > 1e-3) master.gain.setTargetAtTime(vol, now, 0.15);
      for (const [name, layer2] of layers) {
        if (layer2.level === 0) {
          if (now - layer2.idleSince > IDLE_S) {
            layer2.stop();
            layer2.gain.disconnect();
            layers.delete(name);
          }
          continue;
        }
        if (!CALLS.includes(name) || vol === 0) continue;
        if (layer2.next < now) layer2.next = now + 0.05;
        while (layer2.next < now + LOOKAHEAD_S2) {
          layer2.next += sources.call(name, layer2.next, layer2.gain) / Math.max(0.3, layer2.level);
        }
      }
    }
    return {
      /** Create the AudioContext. Call from a user gesture (click or key). */
      unlock() {
        if (!ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          ctx = new AudioContext();
          master = ctx.createGain();
          master.gain.value = 0;
          master.connect(ctx.destination);
          sources = createSources(ctx, createNoiseBuffer2(ctx));
          timer = setInterval(tick, TICK_MS2);
        }
        if (ctx.state === "suspended") ctx.resume();
        apply();
      },
      /** Glide to a scene's layers: `{ rain: 1, birds: 0.2 }`. Unknown names are ignored. */
      setScene(levels) {
        wanted = levels || {};
        apply();
      },
      /**
       * Lightning struck. Plays a thunderclap after a delay that grows with distance,
       * if the scene has thunder and a clap has been built.
       * @param {number} distance - 0 (overhead) to 1 (far away)
       */
      strike(distance = 0.4) {
        const layer2 = layers.get("thunder");
        if (!ctx || !layer2 || layer2.level === 0 || targetVolume() === 0) return;
        const buffer = sources.clapFor(distance);
        if (!buffer) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = 1.3 - 0.45 * distance;
        src.connect(g);
        g.connect(layer2.gain);
        src.start(ctx.currentTime + SOUND_LAG_MIN_S + distance * SOUND_LAG_S);
        src.onended = () => g.disconnect();
      },
      /**
       * The Neon Fall stacker did something. Plays its little arcade sound if the scene has them.
       * @param {string} kind - 'move', 'rotate', 'drop', 'lock', 'land' or 'tetris'
       */
      cue(kind) {
        const layer2 = layers.get("arcade");
        if (!ctx || !layer2 || layer2.level === 0 || targetVolume() === 0) return;
        sources.cue(kind, ctx.currentTime + 0.03, layer2.gain);
      },
      dispose() {
        if (timer) clearInterval(timer);
        if (ctx) ctx.close();
        ctx = null;
      }
    };
  }

  // js/touch.js
  function createTouchControls(roots, settings2) {
    const coarse = window.matchMedia?.("(pointer: coarse)");
    const held = /* @__PURE__ */ new Map();
    function send(type, code) {
      document.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
    }
    function press(e) {
      const btn = e.target.closest("[data-key]");
      if (!btn) return;
      e.preventDefault();
      if (held.has(e.pointerId)) return;
      held.set(e.pointerId, btn);
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add("pressed");
      navigator.vibrate?.(8);
      send("keydown", btn.dataset.key);
    }
    function release(e) {
      const btn = held.get(e.pointerId);
      if (!btn) return;
      held.delete(e.pointerId);
      btn.classList.remove("pressed");
      send("keyup", btn.dataset.key);
    }
    for (const root of roots) {
      root.addEventListener("pointerdown", press);
      root.addEventListener("pointerup", release);
      root.addEventListener("pointercancel", release);
      root.addEventListener("lostpointercapture", release);
      root.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    return {
      /**
       * Whether the buttons should show: forced on or off by the setting, otherwise
       * on when the main pointer is a finger. Also sets the `touch-ui` body class.
       */
      refresh() {
        const mode = settings2.touchControls || "auto";
        const active = mode === "on" || mode === "auto" && !!coarse?.matches;
        document.body.classList.toggle("touch-ui", active);
        return active;
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
  var BLITZ_MS = 12e4;
  var GAME_STYLES = {
    modern: { name: "MODERN", lineClearDelay: 0, bigHitDelay: 0, entryDelay: 0 },
    battle: { name: "BATTLE", lineClearDelay: 500, bigHitDelay: 1e3, entryDelay: 117 }
  };
  var BIG_HIT_LINES = 4;
  var MODE_INFO = {
    [MODE_SPRINT]: {
      name: "40 LINES",
      subtitle: "SPRINT",
      description: "Clear 40 lines as fast as possible.",
      track: "calm",
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
        stats.level = 1;
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
        return getGravityInterval(stats.level);
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
      /** Get results for the game-over screen */
      getResults() {
        const r = { ...stats };
        r.modeId = modeId;
        r.modeName = MODE_INFO[modeId]?.name || modeId;
        r.finalTime = timer ? timer.format() : "";
        r.finalTimePrecise = timer && timer.formatPrecise ? timer.formatPrecise() : r.finalTime;
        const minutes = this.getElapsedMs() / 6e4;
        r.apm = minutes > 0 ? stats.linesSent / minutes : 0;
        r.completed = completed;
        r.gameOver = gameOver;
        return r;
      }
    };
  }

  // js/menu.js
  var pad = (n) => String(n + 1).padStart(2, "0");
  var esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  var MODE_DETAIL = {
    [MODE_SPRINT]: { goal: "Clear 40 lines. Your time is your score.", scenery: "Midnight Circuit" },
    [MODE_BLITZ]: { goal: "Score as much as you can in 2 minutes.", scenery: "Thunder Peak" },
    [MODE_CLASSIC]: { goal: "Endless. Gravity rises every 10 lines.", scenery: "Changes every level" }
  };
  var CONTROL_ROWS = [
    ["MOVE", "\u25C0 \u25B6"],
    ["SOFT DROP", "\u25BC"],
    ["HARD DROP", "SPACE"],
    ["ROTATE RIGHT", "\u25B2 or X"],
    ["ROTATE LEFT", "Z"],
    ["HOLD", "C or SHIFT"],
    ["PAUSE", "ESC"]
  ];
  function createMenuSystem(container, options) {
    const { settings: settings2, tabs, setSetting, resetSettings: resetSettings2, openMusic, sound = {} } = options;
    const cb = {};
    const root = document.createElement("div");
    root.className = "ac";
    root.hidden = true;
    root.innerHTML = `
        <div class="ac-shade"></div>
        <header class="ac-head">
            <div class="ac-logo"><span class="title-u">u</span><span class="title-lol">lol</span><span class="title-tris">Tris</span></div>
            <div class="ac-crumbs"></div>
        </header>
        <div class="ac-stage">
            <nav class="ac-tabs" role="tablist"></nav>
            <div class="ac-banner" hidden></div>
            <div class="ac-body">
                <section class="ac-list" role="list"></section>
                <aside class="ac-info"></aside>
            </div>
        </div>
        <footer class="ac-foot"><div class="ac-keys"></div><div class="ac-scene"></div></footer>`;
    container.appendChild(root);
    const el = {
      crumbs: root.querySelector(".ac-crumbs"),
      tabs: root.querySelector(".ac-tabs"),
      banner: root.querySelector(".ac-banner"),
      list: root.querySelector(".ac-list"),
      info: root.querySelector(".ac-info"),
      keys: root.querySelector(".ac-keys"),
      scene: root.querySelector(".ac-scene")
    };
    const state = {
      screen: null,
      // 'main' | 'pause' | 'results' | null (closed)
      tab: 0,
      focus: "list",
      // 'row' (the tabs) or 'list'
      levels: [],
      // stack of { title, nodes, index }
      banner: null,
      // { text, sub, tone }
      lines: null
      // info panel lines that stay whatever is focused (results)
    };
    const level = () => state.levels[state.levels.length - 1];
    const focusable = (n) => n.kind !== "info";
    const firstFocusable = (nodes) => Math.max(0, nodes.findIndex(focusable));
    function settingNode(key) {
      const def = findSetting(key);
      return { kind: def.type, label: def.label, def, info: { title: def.label, text: def.hint } };
    }
    const backNode = () => ({ kind: "action", label: "BACK", hint: "", run: back, info: { title: "BACK", text: "Go back one step." } });
    function briefing(modeId) {
      const info = MODE_INFO[modeId];
      const nodes = [{
        kind: "action",
        label: "START",
        hint: info.name,
        info: { title: "START", text: `Begin ${info.name}.` },
        run: () => {
          hideAll();
          cb.modeSelect?.(modeId);
        }
      }, settingNode("gameStyle")];
      if (modeId === MODE_CLASSIC) nodes.push(settingNode("casualScene"));
      nodes.push(settingNode("weather"), settingNode("nextPreviewCount"), backNode());
      return nodes;
    }
    function modeNodes() {
      return [MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC].map((id) => {
        const info = MODE_INFO[id];
        return {
          kind: "menu",
          label: info.name,
          hint: info.subtitle,
          title: info.name,
          info: {
            title: info.name,
            text: info.description,
            lines: [
              { label: "GOAL", value: MODE_DETAIL[id].goal },
              { label: "MUSIC", value: capital(info.track) },
              { label: "SCENERY", value: MODE_DETAIL[id].scenery }
            ]
          },
          children: () => briefing(id)
        };
      });
    }
    function settingsNodes(withBack) {
      const nodes = tabs.map((tab) => ({
        kind: "menu",
        label: tab.label,
        hint: `${tab.settings.length} options`,
        title: tab.label,
        info: { title: tab.label, text: tab.settings.map((s) => s.label).join(" / ") },
        children: () => [...tab.settings.map((s) => settingNode(s.key)), backNode()]
      }));
      nodes.push({
        kind: "action",
        label: "RESET DEFAULTS",
        hint: "",
        armable: true,
        info: { title: "RESET DEFAULTS", text: "Put every setting back to its default. Press twice to confirm." },
        run() {
          resetSettings2();
          render();
        }
      });
      if (withBack) nodes.push(backNode());
      return nodes;
    }
    function musicNodes() {
      return [{
        kind: "action",
        label: "MUSIC PLAYER",
        hint: "OPEN",
        info: { title: "MUSIC PLAYER", text: "Drop your own songs on the player to play them instead of the soundtrack." },
        run: () => openMusic()
      }, settingNode("soundtrack"), settingNode("musicVolume"), settingNode("musicMuted")];
    }
    function controlNodes() {
      const nodes = CONTROL_ROWS.map(([label, value]) => ({ kind: "info", label, value }));
      nodes.push({ kind: "info", label: "TOUCH", value: "On-screen buttons" });
      return nodes;
    }
    const MAIN_TABS = [
      { label: "PLAY", info: { title: "PLAY", text: "Pick a mode, then set it up before you start." }, children: modeNodes },
      { label: "SETTINGS", info: { title: "SETTINGS", text: "Handling, sound, visuals and game options. Changes save at once." }, children: () => settingsNodes(false) },
      { label: "CONTROLS", info: { title: "CONTROLS", text: "How to play on a keyboard. On phones and tablets, use the on-screen buttons." }, children: controlNodes },
      { label: "MUSIC", info: { title: "MUSIC", text: "Soundtrack options, and a player for your own music." }, children: musicNodes }
    ];
    function rootLevel(tabIndex) {
      const tab = MAIN_TABS[tabIndex];
      const nodes = tab.children();
      return { title: tab.label, nodes, index: firstFocusable(nodes) };
    }
    function valueText(n) {
      if (n.kind === "toggle") return settings2[n.def.key] ? "ON" : "OFF";
      if (n.kind === "range" || n.kind === "enum") {
        const v = settings2[n.def.key];
        return n.def.describe ? n.def.describe(v) : String(v);
      }
      return n.value ?? n.hint ?? "";
    }
    function gaugePercent(n) {
      const c = getConstraint(n.def.key);
      return Math.max(0, Math.min(100, (settings2[n.def.key] - c.min) / (c.max - c.min) * 100));
    }
    function change(n, value) {
      setSetting(n.def.key, value);
      patchRow(level().nodes.indexOf(n));
      renderInfo();
    }
    function adjust(n, dir, big = false) {
      if (n.kind === "toggle") return change(n, !settings2[n.def.key]);
      if (n.kind === "enum") {
        const values = n.def.values;
        const at2 = values.indexOf(settings2[n.def.key]);
        return change(n, values[(at2 + dir + values.length) % values.length]);
      }
      if (n.kind === "range") {
        const c = getConstraint(n.def.key);
        const next = settings2[n.def.key] + dir * c.step * (big ? 5 : 1);
        return change(n, Math.max(c.min, Math.min(c.max, Number(next.toFixed(3)))));
      }
    }
    function setFromGauge(n, clientX, gauge) {
      const c = getConstraint(n.def.key);
      const rect2 = gauge.getBoundingClientRect();
      const k = Math.max(0, Math.min(1, (clientX - rect2.left) / rect2.width));
      const raw = c.min + k * (c.max - c.min);
      const snapped = c.min + Math.round((raw - c.min) / c.step) * c.step;
      const value = Math.max(c.min, Math.min(c.max, Number(snapped.toFixed(3))));
      if (value !== settings2[n.def.key]) change(n, value);
    }
    function activate(n) {
      if (n.kind === "menu") {
        state.levels.push({ title: n.title || n.label, nodes: n.children(), index: 0 });
        const lvl = level();
        lvl.index = firstFocusable(lvl.nodes);
        state.focus = "list";
        sound.select?.();
        render();
      } else if (n.kind === "action") {
        if (n.armable && !n.armed) {
          n.armed = true;
          n.label = "PRESS AGAIN TO CONFIRM";
          sound.move?.();
          return render();
        }
        sound.select?.();
        n.run();
      } else if (n.kind === "toggle" || n.kind === "enum") {
        adjust(n, 1);
        sound.move?.();
      }
    }
    function back() {
      if (state.levels.length > 1) {
        state.levels.pop();
        state.focus = "list";
        sound.move?.();
        render();
      } else if (state.screen === "main" && state.focus === "list") {
        state.focus = "row";
        sound.move?.();
        refreshFocus();
      } else if (state.screen === "pause") {
        hideAll();
        cb.resume?.();
      }
    }
    function selectTab(i) {
      state.tab = (i + MAIN_TABS.length) % MAIN_TABS.length;
      state.levels = [rootLevel(state.tab)];
      render();
    }
    function move(dir) {
      const lvl = level();
      const count = lvl.nodes.length;
      let i = lvl.index;
      for (let step = 0; step < count; step++) {
        i = (i + dir + count) % count;
        if (focusable(lvl.nodes[i])) break;
      }
      if (i !== lvl.index) {
        lvl.index = i;
        sound.move?.();
        refreshFocus();
      }
    }
    function rowHtml(n, i) {
      let right;
      if (n.kind === "range") {
        right = `<span class="ac-ctl"><button class="ac-step" data-step="-1" tabindex="-1" aria-label="Lower">\u25C0</button><span class="ac-gauge"><span class="ac-fill" style="width:${gaugePercent(n)}%"></span></span><button class="ac-step" data-step="1" tabindex="-1" aria-label="Raise">\u25B6</button></span><span class="ac-read">${esc(valueText(n))}</span>`;
      } else if (n.kind === "toggle") {
        right = `<span class="ac-switch${settings2[n.def.key] ? " on" : ""}"><i></i></span><span class="ac-read">${valueText(n)}</span>`;
      } else if (n.kind === "enum") {
        right = `<span class="ac-ctl"><button class="ac-step" data-step="-1" tabindex="-1" aria-label="Previous">\u25C0</button><button class="ac-step" data-step="1" tabindex="-1" aria-label="Next">\u25B6</button></span><span class="ac-read ac-wide">${esc(valueText(n))}</span>`;
      } else if (n.kind === "menu") {
        right = `<span class="ac-read">${esc(n.hint ?? "")}</span><span class="ac-arrow">\u25B6</span>`;
      } else {
        right = `<span class="ac-read">${esc(valueText(n))}</span>`;
      }
      return `<div class="ac-row ack-${n.kind}" role="listitem" data-i="${i}" style="--i:${i}"><span class="ac-num">${pad(i)}</span><span class="ac-label">${esc(n.label)}</span>${right}</div>`;
    }
    function patchRow(i) {
      const n = level().nodes[i];
      const row = el.list.querySelector(`[data-i="${i}"]`);
      if (!n || !row) return;
      const read = row.querySelector(".ac-read");
      if (read) read.textContent = valueText(n);
      if (n.kind === "range") row.querySelector(".ac-fill").style.width = `${gaugePercent(n)}%`;
      if (n.kind === "toggle") row.querySelector(".ac-switch").classList.toggle("on", !!settings2[n.def.key]);
    }
    function renderTabs() {
      el.tabs.innerHTML = MAIN_TABS.map((t, i) => `<button class="ac-tab${i === state.tab ? " on" : ""}" role="tab" data-tab="${i}" style="--i:${i}"><span class="ac-tab-num">${pad(i)}</span><span>${t.label}</span></button>`).join("");
    }
    function renderCrumbs() {
      const parts = state.screen === "main" ? ["MAIN MENU", MAIN_TABS[state.tab].label, ...state.levels.slice(1).map((l) => l.title)] : state.levels.map((l) => l.title);
      el.crumbs.innerHTML = parts.map((p, i) => i === parts.length - 1 ? `<b>${esc(p)}</b>` : esc(p)).join(" <em>//</em> ");
    }
    function renderInfo() {
      const n = state.focus === "row" ? null : level().nodes[level().index];
      const info = n ? n.info || { title: n.label } : MAIN_TABS[state.tab]?.info || {};
      let html = "";
      if (info.title) html += `<div class="ac-info-title">${esc(info.title)}</div>`;
      if (n && (n.kind === "range" || n.kind === "toggle" || n.kind === "enum")) {
        html += `<div class="ac-info-value">${esc(valueText(n))}</div>`;
        if (n.kind === "range") html += `<div class="ac-meter"><i style="width:${gaugePercent(n)}%"></i></div>`;
      }
      if (info.text) html += `<p class="ac-info-text">${esc(info.text)}</p>`;
      const lines = state.lines || info.lines;
      if (lines) {
        html += '<dl class="ac-lines">' + lines.map((l) => `<div${l.big ? ' class="big"' : ""}><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`).join("") + "</dl>";
      }
      el.info.innerHTML = html;
    }
    function refreshFocus() {
      const lvl = level();
      el.list.classList.toggle("idle", state.focus === "row");
      el.list.querySelectorAll(".ac-row").forEach((row, i) => row.classList.toggle("focus", state.focus === "list" && i === lvl.index));
      el.tabs.querySelectorAll(".ac-tab").forEach((tab) => tab.classList.toggle("focus", state.focus === "row"));
      root.querySelector(".ac-row.focus")?.scrollIntoView({ block: "nearest" });
      renderKeys();
      renderInfo();
    }
    function renderKeys() {
      const k = (label) => `<kbd>${label}</kbd>`;
      const onRow = state.focus === "row";
      el.keys.innerHTML = onRow ? `${k("\u25C0")}${k("\u25B6")} CHOOSE &nbsp; ${k("\u25BC")} OPEN` : `${k("\u25B2")}${k("\u25BC")} SELECT &nbsp; ${k("\u25C0")}${k("\u25B6")} ADJUST &nbsp; ${k("ENTER")} CONFIRM &nbsp; ${k("ESC")} BACK`;
    }
    function render() {
      const main = state.screen === "main";
      root.classList.toggle("over", !main);
      el.tabs.hidden = !main;
      el.banner.hidden = main || !state.banner;
      if (main) renderTabs();
      else if (state.banner) {
        el.banner.className = `ac-banner ${state.banner.tone || ""}`;
        el.banner.innerHTML = `<span class="ac-banner-main">${esc(state.banner.text)}</span><span class="ac-banner-sub">${esc(state.banner.sub || "")}</span>`;
      }
      renderCrumbs();
      el.list.innerHTML = level().nodes.map(rowHtml).join("");
      refreshFocus();
    }
    function onKey(e) {
      if (root.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || "")) return;
      const lvl = level();
      const n = state.focus === "list" ? lvl.nodes[lvl.index] : null;
      let handled = true;
      switch (e.code) {
        case "ArrowUp":
          if (state.focus === "list" && state.screen === "main" && state.levels.length === 1 && lvl.index === firstFocusable(lvl.nodes)) {
            state.focus = "row";
            sound.move?.();
            refreshFocus();
          } else if (state.focus === "list") move(-1);
          break;
        case "ArrowDown":
          if (state.focus === "row") {
            state.focus = "list";
            sound.move?.();
            refreshFocus();
          } else move(1);
          break;
        case "ArrowLeft":
          if (state.focus === "row") {
            selectTab(state.tab - 1);
            sound.move?.();
          } else if (n && ["range", "enum", "toggle"].includes(n.kind)) {
            adjust(n, -1, e.shiftKey);
            sound.move?.();
          }
          break;
        case "ArrowRight":
          if (state.focus === "row") {
            selectTab(state.tab + 1);
            sound.move?.();
          } else if (n && ["range", "enum", "toggle"].includes(n.kind)) {
            adjust(n, 1, e.shiftKey);
            sound.move?.();
          }
          break;
        case "Enter":
        case "Space":
        case "NumpadEnter":
          if (state.focus === "row") {
            state.focus = "list";
            sound.select?.();
            refreshFocus();
          } else if (n) activate(n);
          break;
        case "Escape":
        case "Backspace":
          back();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener("keydown", onKey, true);
    root.addEventListener("click", (e) => {
      const tab = e.target.closest(".ac-tab");
      if (tab) {
        state.focus = "row";
        selectTab(Number(tab.dataset.tab));
        sound.move?.();
        return;
      }
      const rowEl = e.target.closest(".ac-row");
      if (!rowEl) return;
      const i = Number(rowEl.dataset.i);
      const n = level().nodes[i];
      if (!n || !focusable(n)) return;
      level().index = i;
      state.focus = "list";
      const step = e.target.closest(".ac-step");
      if (step) {
        adjust(n, Number(step.dataset.step));
        sound.move?.();
        refreshFocus();
      } else if (!e.target.closest(".ac-gauge")) {
        refreshFocus();
        activate(n);
      } else refreshFocus();
    });
    root.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const rowEl = e.target.closest(".ac-row");
      if (!rowEl) return;
      const i = Number(rowEl.dataset.i);
      const n = level().nodes[i];
      if (!n || !focusable(n) || state.focus === "list" && level().index === i) return;
      level().index = i;
      state.focus = "list";
      sound.move?.();
      refreshFocus();
    });
    root.addEventListener("pointerdown", (e) => {
      const gauge = e.target.closest(".ac-gauge");
      if (!gauge) return;
      const n = level().nodes[Number(gauge.closest(".ac-row").dataset.i)];
      if (!n) return;
      e.preventDefault();
      level().index = level().nodes.indexOf(n);
      state.focus = "list";
      refreshFocus();
      setFromGauge(n, e.clientX, gauge);
      const drag = (ev) => setFromGauge(n, ev.clientX, gauge);
      const stop = () => {
        window.removeEventListener("pointermove", drag);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
      };
      window.addEventListener("pointermove", drag);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    });
    function open() {
      root.hidden = false;
      document.body.classList.add("menu-open");
    }
    function hideAll() {
      root.hidden = true;
      state.screen = null;
      document.body.classList.remove("menu-open");
    }
    function showScreen(name, data = {}) {
      if (name === "modeSelect") return showScreen("main", { tab: 0, focus: "list" });
      state.lines = null;
      state.banner = null;
      if (name === "main") {
        state.screen = "main";
        state.tab = data.tab ?? 0;
        state.focus = data.focus ?? "row";
        state.levels = [rootLevel(state.tab)];
      } else if (name === "pause") {
        state.screen = "pause";
        state.focus = "list";
        state.banner = { text: "PAUSED", sub: data.modeName || "", tone: "neutral" };
        state.lines = CONTROL_ROWS.map(([label, value]) => ({ label, value }));
        const nodes = [
          { kind: "action", label: "RESUME", hint: "", info: { title: "RESUME", text: "Back to the game." }, run: () => {
            hideAll();
            cb.resume?.();
          } },
          { kind: "action", label: "RESTART", hint: "", info: { title: "RESTART", text: "Start this mode again from the beginning." }, run: () => {
            hideAll();
            cb.restart?.();
          } },
          { kind: "menu", label: "SETTINGS", hint: "", title: "SETTINGS", info: { title: "SETTINGS", text: "Change handling, sound and visuals without leaving the game." }, children: () => settingsNodes(true) },
          { kind: "action", label: "QUIT TO MENU", hint: "", info: { title: "QUIT TO MENU", text: "Leave this game." }, run: () => {
            cb.quit?.();
            showScreen("main");
          } }
        ];
        state.levels = [{ title: "PAUSED", nodes, index: 0 }];
      }
      open();
      render();
    }
    function showResults(results) {
      state.screen = "results";
      state.focus = "list";
      const won = results.completed;
      state.banner = {
        text: won ? results.modeId === "sprint" ? "SPRINT COMPLETE" : "TIME'S UP" : "GAME OVER",
        sub: results.modeName || "",
        tone: won ? "ok" : "fail"
      };
      const lines = [];
      if (results.modeId === "sprint") lines.push({ label: "TIME", value: results.finalTimePrecise || results.finalTime, big: true });
      else lines.push({ label: "SCORE", value: results.score.toLocaleString(), big: true });
      lines.push({ label: "LINES", value: results.linesCleared }, { label: "LEVEL", value: results.level }, { label: "PIECES", value: results.piecesPlaced });
      if (results.tSpins > 0) lines.push({ label: "T-SPINS", value: results.tSpins });
      if (results.tetrises > 0) lines.push({ label: "QUADS", value: results.tetrises });
      if (results.maxCombo > 0) lines.push({ label: "MAX COMBO", value: results.maxCombo });
      if (results.perfectClears > 0) lines.push({ label: "PERFECT CLEARS", value: results.perfectClears });
      lines.push(
        { label: "LINES SENT", value: results.linesSent },
        { label: "APM", value: results.apm.toFixed(1) },
        { label: "PPS", value: (results.pps ?? 0).toFixed(2) },
        { label: "FINESSE", value: `${(results.finesse ?? 100).toFixed(1)}%` }
      );
      if (results.modeId !== "sprint") lines.push({ label: "TIME", value: results.finalTime });
      state.lines = lines;
      const nodes = [
        { kind: "action", label: "RETRY", hint: "", info: { title: "RETRY", text: "Play this mode again." }, run: () => {
          hideAll();
          cb.restart?.();
        } },
        { kind: "action", label: "CHANGE MODE", hint: "", info: { title: "CHANGE MODE", text: "Pick another mode." }, run: () => {
          cb.quit?.();
          showScreen("main", { tab: 0, focus: "list" });
        } },
        { kind: "menu", label: "SETTINGS", hint: "", title: "SETTINGS", info: { title: "SETTINGS", text: "Adjust handling, sound and visuals." }, children: () => settingsNodes(true) },
        { kind: "action", label: "MAIN MENU", hint: "", info: { title: "MAIN MENU", text: "Back to the title screen." }, run: () => {
          cb.quit?.();
          showScreen("main");
        } }
      ];
      state.levels = [{ title: state.banner.text, nodes, index: 0 }];
      open();
      render();
    }
    function openSettings() {
      if (root.hidden) showScreen("main", { tab: 1, focus: "list" });
      else if (state.screen === "main") {
        if (state.tab !== 1 || state.levels.length > 1) selectTab(1);
        state.focus = "list";
        refreshFocus();
      } else if (!state.levels.some((l) => l.title === "SETTINGS")) {
        const nodes = settingsNodes(true);
        state.levels.push({ title: "SETTINGS", nodes, index: 0 });
        state.focus = "list";
        render();
      }
    }
    return {
      showScreen,
      showResults,
      hideAll,
      openSettings,
      isOpen: () => !root.hidden,
      /** Redraw after settings changed from outside (for example a reset). */
      refresh() {
        if (!root.hidden) render();
      },
      /** The line at the bottom right naming the scene and weather behind the menu. */
      setSceneTag(text2) {
        el.scene.textContent = text2;
      },
      onModeSelect(fn) {
        cb.modeSelect = fn;
      },
      onResume(fn) {
        cb.resume = fn;
      },
      onRestart(fn) {
        cb.restart = fn;
      },
      onQuit(fn) {
        cb.quit = fn;
      }
    };
  }

  // js/piece.js
  var COLS2 = 10;
  var VISIBLE_ROWS = 20;
  var BUFFER_ROWS = 40;
  var BLOCK_SIZE = 30;
  var SHAPES3 = {
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
  function shuffle2(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  function generateBag() {
    return shuffle2(["I", "J", "L", "O", "S", "T", "Z"]);
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
    let lastFilledRow = 0;
    matrix.forEach((row, y) => {
      if (row.some((v) => v !== 0)) lastFilledRow = y;
    });
    return {
      x: Math.floor(COLS2 / 2) - Math.floor(matrix[0].length / 2),
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
      const color = SHAPES3[piece.shape].color;
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
            const color = SHAPES3[cellShape]?.color || "#ffffff";
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
          add({ type: "flash", x: 0, y: rowToY(mid) - BLOCK_SIZE * 2, h: BLOCK_SIZE * 5, life: 220, color: SHAPES3.I.color });
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
          color: SHAPES3.T.color
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
        const colors = Object.values(SHAPES3).map((s) => s.color);
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
  var FIELD_W2 = COLS2 * BLOCK_SIZE;
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
  function drawPreview(ctx, skin, shape, slotTop, slotHeight, dimmed) {
    const { matrix, color } = SHAPES3[shape];
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
    const sprite = blockSprite(skin, dimmed ? "#5a5a66" : color, SIDE_BLOCK);
    matrix.forEach((row, y) => row.forEach((v, x) => {
      if (v) ctx.drawImage(sprite, ox + x * SIDE_BLOCK, oy + y * SIDE_BLOCK);
    }));
  }
  function createRenderer(canvases2, settings2) {
    const boardCtx = canvases2.board.getContext("2d");
    const holdCtx = canvases2.hold.getContext("2d");
    const nextCtx = canvases2.next.getContext("2d");
    canvases2.board.width = BOARD_CANVAS.width;
    canvases2.board.height = BOARD_CANVAS.height;
    canvases2.hold.width = SIDE_COLS * SIDE_BLOCK;
    canvases2.hold.height = 3 * SIDE_BLOCK;
    function cell(ctx, skin, color, col, visRow) {
      ctx.drawImage(blockSprite(skin, color, BLOCK_SIZE), col * BLOCK_SIZE, visRow * BLOCK_SIZE);
    }
    function drawField(danger, time) {
      const ctx = boardCtx;
      ctx.fillStyle = "rgba(7, 7, 13, 0.86)";
      ctx.fillRect(0, 0, FIELD_W2, FIELD_H);
      ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
      for (let x = 1; x < COLS2; x++) ctx.fillRect(x * BLOCK_SIZE, 0, 1, FIELD_H);
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
    function drawSpawnMarks(shape, danger, time) {
      if (!shape) return;
      const { matrix } = SHAPES3[shape];
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
    function drawMatrix(skin, matrix, pos, color) {
      matrix.forEach((row, y) => row.forEach((v, x) => {
        if (!v) return;
        const visRow = y + pos.y - BOARD_OFFSET_Y2;
        if (visRow >= -SPAWN_ROWS) cell(boardCtx, skin, color || SHAPES3[v]?.color || "#888", x + pos.x, visRow);
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
    function draw(state) {
      const { arena, player, nextQueue, held, particles, shake, danger } = state;
      const time = state.time ?? performance.now();
      const skin = settings2.blockSkin || "ulol";
      const ghostOpacity = (settings2.ghostOpacity ?? 40) / 100 * 0.6;
      boardCtx.clearRect(0, 0, canvases2.board.width, canvases2.board.height);
      holdCtx.clearRect(0, 0, canvases2.hold.width, canvases2.hold.height);
      nextCtx.clearRect(0, 0, canvases2.next.width, canvases2.next.height);
      boardCtx.save();
      boardCtx.translate(FRAME + (shake?.x || 0), FIELD_TOP + (shake?.y || 0));
      drawField(danger, time);
      drawSpawnMarks(nextQueue?.[0], danger, time);
      drawMatrix(skin, arena, { x: 0, y: 0 }, null);
      if (state.flash) {
        const { rows, progress } = state.flash;
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
      if (player && player.matrix) {
        const color = SHAPES3[player.shape].color;
        if (state.ghostY !== void 0) drawGhost(player.matrix, { x: player.pos.x, y: state.ghostY }, color, ghostOpacity);
        drawMatrix(skin, player.matrix, player.pos, color);
      }
      if (particles) particles.drawParticles(boardCtx);
      boardCtx.restore();
      if (held) drawPreview(holdCtx, skin, held, 0, canvases2.hold.height, state.holdLocked);
      const count = settings2.nextPreviewCount || 5;
      (nextQueue || []).slice(0, count).forEach((shape, i) => {
        drawPreview(nextCtx, skin, shape, i * 3 * SIDE_BLOCK, 3 * SIDE_BLOCK, false);
      });
    }
    function resizeNextCanvas(previewCount) {
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
       *   clockMs, urgent, primaryLabel, primaryValue, progress, finesseJudged, finesseFaults }
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
        const levelRow = modeId === "classic" ? row("LEVEL", s.level) : "";
        let rows = "";
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
        setHtml(els.stats, "stats", rows);
        setHtml(
          els.under,
          "under",
          `<div class="under-value">${Number(s.primaryValue).toLocaleString()}</div><div class="under-label">${s.primaryLabel}</div>`
        );
        setHtml(els.finesse, "finesse", mode === "off" ? "" : `<div class="stat-label">FINESSE</div><div class="stat-value">${s.finesseFaults}<span class="stat-sub">, ${fixed(finessePct)}%</span></div><div class="stat-small">${s.finesseFaults} FAULT${s.finesseFaults === 1 ? "" : "S"}</div>`);
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
  var EMPTY = createMatrix(COLS2, BUFFER_ROWS);
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
    const start = { shape, matrix: SHAPES3[shape].matrix, rotation: 0, pos: getSpawnPos(SHAPES3[shape].matrix) };
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
    const arena = createMatrix(COLS2, BUFFER_ROWS);
    const nextQueue = [];
    fillQueue(nextQueue);
    const modeState = createModeState(modeId);
    const scoringState = createScoringState();
    const particles = createParticleSystem(settings2);
    const renderer = createRenderer(canvases2, settings2);
    const hud = createHud(settings2, modeId);
    const bounce = createBoardBounce(playfield2, settings2);
    let finesseJudged = 0;
    let finesseFaults = 0;
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
    const style = GAME_STYLES[settings2.gameStyle] || GAME_STYLES.modern;
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
    function spawnPiece() {
      player.shape = getNextPiece(nextQueue);
      player.matrix = SHAPES3[player.shape].matrix;
      player.rotation = 0;
      const spawn = getSpawnPos(player.matrix);
      player.pos.x = spawn.x;
      player.pos.y = spawn.y;
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
      while (moved < cells && moved < COLS2) {
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
      if (!active) return 0;
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
      if (!active) return;
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
      if (!active || !player.canHold) return;
      if (player.held === null) {
        player.held = player.shape;
        spawnPiece();
      } else {
        const temp = player.shape;
        player.shape = player.held;
        player.held = temp;
        player.matrix = SHAPES3[player.shape].matrix;
        player.rotation = 0;
        const spawn = getSpawnPos(player.matrix);
        player.pos.x = spawn.x;
        player.pos.y = spawn.y;
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
      if (!used.softDrop) {
        const min = minimumInputs(player.shape, player.matrix, player.pos.x);
        if (min !== null) {
          finesseJudged++;
          if (used.inputs > min) finesseFaults++;
        }
      }
      const tSpinType = detectTSpin(arena, player, lastWasRotation, lastKickIndex);
      const arenaSnapshot = arena.map((row) => [...row]);
      merge(arena, player);
      modeState.addPiece();
      const lockedArena = arena.map((row) => [...row]);
      particles.spawnPlacement({
        shape: player.shape,
        matrix: player.matrix.map((row) => [...row]),
        pos: { ...player.pos }
      }, dropRows);
      if (lockedOut) {
        modeState.setGameOver();
        playSound("gameOver");
        endGame();
        return;
      }
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
      const attack = calculateAttack(scoreResult);
      if (attack > 0) {
        modeState.addAttack(attack);
        particles.spawnAttack(clearedRows, attack);
        playSound("attack", attack);
      }
      if (scoreResult.action || scoreResult.perfectClear) hud.onClear({ ...scoreResult, attack });
      if (linesCleared > 0) bounce.kick(0, 60 + linesCleared * 45 + attack * 10);
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
        flash = clearDelay > 0 ? { arena: lockedArena, rows: clearedRows, duration: clearDelay, elapsed: 0 } : null;
      } else {
        spawnPiece();
      }
    }
    function updateDanger() {
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
      music2.setTrack(choice === "auto" ? MODE_INFO[modeId].track : choice);
      const levelBoost = modeId === "classic" ? (modeState.stats.level - 1) * 0.012 : 0;
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
      const ghostY = active ? getGhostY(arena, player) : void 0;
      renderer.draw({
        arena: flash ? flash.arena : arena,
        player: active ? player : null,
        flash: flash ? { rows: flash.rows, progress: flash.elapsed / flash.duration } : null,
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
        progress: modeId === "sprint" ? stats.linesCleared / SPRINT_LINES : modeId === "blitz" ? remaining / BLITZ_MS2 : stats.linesCleared % 10 / 10,
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
  var currentGame = null;
  var soundEngine = null;
  var menu = null;
  var sceneTag = "";
  var gameContainer = document.getElementById("game-container");
  var menuContainer = document.getElementById("menu-container");
  var settingsToggle = document.getElementById("settings-toggle");
  var musicPlayerContainer = document.getElementById("music-player-container");
  var playfield = document.getElementById("playfield");
  var ambience = createAmbience(settings);
  var background = createBackground(
    document.getElementById("bg-canvas"),
    document.getElementById("bg-layer"),
    settings,
    {
      onScene: (info) => {
        ambience.setScene(info.sounds);
        sceneTag = `${info.sceneName.toUpperCase()} / ${info.weatherName.toUpperCase()}`;
        menu?.setSceneTag(sceneTag);
      },
      onStrike: (strike) => ambience.strike(strike.distance),
      onCue: (cue) => ambience.cue(cue.kind)
    }
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
    ambience.unlock();
    document.removeEventListener("pointerdown", unlockAudio);
    document.removeEventListener("keydown", unlockAudio);
  }
  document.addEventListener("pointerdown", unlockAudio);
  document.addEventListener("keydown", unlockAudio);
  music.setTrack(menuTrack());
  function applySetting(key, value) {
    settings[key] = value;
    saveSettings(settings);
    if (key === "soundtrack" && !currentGame?.isRunning()) music.setTrack(menuTrack());
    if (key === "soundPack") soundEngine?.play("rotate");
    if (key === "touchControls") fitGame();
    if (key === "casualScene" || key === "weather") background.refresh();
  }
  function resetSettings() {
    Object.assign(settings, DEFAULT_SETTINGS);
    saveSettings(settings);
    fitGame();
    background.refresh();
    if (!currentGame?.isRunning()) music.setTrack(menuTrack());
  }
  menu = createMenuSystem(menuContainer, {
    settings,
    tabs: SETTINGS_TABS,
    setSetting: applySetting,
    resetSettings,
    openMusic: () => musicPlayer?.toggle(),
    sound: {
      move: () => soundEngine?.play("menuMove"),
      select: () => soundEngine?.play("menuSelect")
    }
  });
  menu.setSceneTag(sceneTag);
  menu.onModeSelect((modeId) => {
    gameContainer.classList.remove("game-hidden");
    startNewGame(modeId);
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
  settingsToggle.addEventListener("click", () => {
    if (currentGame?.isRunning() && !menu.isOpen()) currentGame.pause();
    menu.openSettings();
  });
  var touchControls = createTouchControls(
    [document.getElementById("touch-controls"), document.getElementById("touch-pause")],
    settings
  );
  var LAYOUT = { height: 780, width: 700, touchWidth: 590, touchButtons: 176 };
  function fitGame() {
    const touch = touchControls.refresh();
    const portrait = touch && window.innerHeight >= window.innerWidth;
    document.body.classList.toggle("touch-portrait", portrait);
    const height = window.innerHeight - 16 - (portrait ? LAYOUT.touchButtons : 0);
    const width = window.innerWidth - (touch ? 8 : 16);
    const scale = Math.min(1, height / LAYOUT.height, width / (touch ? LAYOUT.touchWidth : LAYOUT.width));
    gameContainer.style.transform = scale < 1 ? `scale(${scale})` : "";
  }
  window.addEventListener("resize", fitGame);
  window.matchMedia?.("(pointer: coarse)").addEventListener?.("change", fitGame);
  fitGame();
  gameContainer.classList.add("game-hidden");
  menu.showScreen("main");
  function startNewGame(modeId) {
    if (currentGame) {
      currentGame.destroy();
    }
    background.showMode(modeId);
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
        menu.showScreen("pause", { modeName: MODE_INFO[modeId].name });
      },
      onLevelUp(level) {
        background.onLevel(modeId, level);
      }
    });
    currentGame._modeId = modeId;
    currentGame.start();
  }
  var musicToggle = document.getElementById("music-toggle");
  if (musicToggle && musicPlayer) {
    musicToggle.addEventListener("click", () => {
      musicPlayer.toggle();
      soundEngine?.play("menuMove");
    });
  }
})();
