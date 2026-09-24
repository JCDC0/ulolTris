/**
 * settings.js - Expanded settings manager with handling, audio, visual, and gameplay tabs.
 * Persists all settings to localStorage.
 */

const STORAGE_KEY = 'uloltris-settings';
const FRAME_MS = 1000 / 60;

/**
 * Version 2 stores ARR, DAS and DCD in frames and SDF as a gravity multiplier, like TETR.IO.
 * Version 1 (no version field) stored all four in milliseconds.
 */
const SETTINGS_VERSION = 2;

/** SDF values at or above this are treated as infinite (instant soft drop). */
export const SDF_INFINITE = 41;

/** Default values for all setting categories */
export const DEFAULT_SETTINGS = {
    // Handling
    arr: 2,                    // frames, 0 = instant
    das: 10,                   // frames
    dcd: 1,                    // frames, 0 = off
    sdf: 6,                    // gravity multiplier, SDF_INFINITE = instant
    cancelDasOnDirectionChange: false,
    preferSoftDrop: false,

    // Audio
    masterVolume: 80,
    sfxVolume: 80,
    musicVolume: 50,
    sfxMuted: false,
    musicMuted: false,
    crossfadeDuration: 2,
    soundtrack: 'auto',        // 'auto', 'calm', 'competitive', 'intense', 'off'

    // Visual
    screenShake: 'medium',     // 'off', 'low', 'medium', 'high'
    boardBounce: 'medium',     // board springs on hard drops, clears and wall bumps
    placeImpact: 'medium',     // drop trail, landing flash and dust when a piece locks
    clearEffects: 'medium',    // particles and flashes for line clears, T-spins, B2B, perfect clears
    statsDisplay: 'time',      // 'off', 'time', 'speed', 'efficiency', 'versus'
    background: 'on',          // 'on', 'dim', 'off'
    casualScene: 'cycle',      // 'cycle' or one of CASUAL_SCENES
    ghostOpacity: 40,          // 0-100
    showActionText: true,
    blockSkin: 'ulol',         // one of SKINS in skins.js
    soundPack: 'ulol',         // 'ulol', 'arcade' (Jstris-style), 'bubbly' (PPT-style)

    // Gameplay
    nextPreviewCount: 5,       // 1-6
    lockDelay: 500,            // ms
    gameStyle: 'modern',       // 'modern' (TETR.IO, Jstris) or 'battle' (Tetris 99, PPT)
};

/** Constraints for numeric settings */
const CONSTRAINTS = {
    arr:              { min: 0, max: 5,  step: 0.1 },
    das:              { min: 1, max: 20, step: 0.1 },
    dcd:              { min: 0, max: 20, step: 0.1 },
    sdf:              { min: 5, max: SDF_INFINITE, step: 1 },
    masterVolume:     { min: 0, max: 100, step: 1 },
    sfxVolume:        { min: 0, max: 100, step: 1 },
    musicVolume:      { min: 0, max: 100, step: 1 },
    crossfadeDuration:{ min: 0, max: 5,   step: 0.5 },
    ghostOpacity:     { min: 0, max: 100, step: 5 },
    nextPreviewCount: { min: 1, max: 6,   step: 1 },
    lockDelay:        { min: 100, max: 2000, step: 50 },
};

/** Valid enum values */
const ENUMS = {
    screenShake: ['off', 'low', 'medium', 'high'],
    boardBounce: ['off', 'low', 'medium', 'high'],
    placeImpact: ['off', 'low', 'medium', 'high'],
    clearEffects: ['off', 'low', 'medium', 'high'],
    statsDisplay: ['off', 'time', 'speed', 'efficiency', 'versus'],
    background: ['on', 'dim', 'off'],
    casualScene: ['cycle', 'bamboo', 'wheat', 'village', 'castle', 'ocean', 'neon'],
    soundtrack: ['auto', 'calm', 'competitive', 'intense', 'off'],
    gameStyle: ['modern', 'battle'],
    blockSkin: ['ulol', 'classic', 'glossy', 'flat', 'neon'],
    soundPack: ['ulol', 'arcade', 'bubbly'],
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Normalize a raw settings object against defaults and constraints.
 */
export function normalizeSettings(raw) {
    const source = migrateSettings(raw || {});
    const result = { ...DEFAULT_SETTINGS };

    // Numeric settings
    for (const [key, constraint] of Object.entries(CONSTRAINTS)) {
        const val = source[key];
        if (Number.isFinite(val)) {
            result[key] = clamp(val, constraint.min, constraint.max);
        }
    }

    // Enum settings
    for (const [key, validValues] of Object.entries(ENUMS)) {
        if (validValues.includes(source[key])) {
            result[key] = source[key];
        }
    }

    // Boolean settings
    if (typeof source.sfxMuted === 'boolean') result.sfxMuted = source.sfxMuted;
    if (typeof source.musicMuted === 'boolean') result.musicMuted = source.musicMuted;
    if (typeof source.showActionText === 'boolean') result.showActionText = source.showActionText;
    if (typeof source.cancelDasOnDirectionChange === 'boolean') result.cancelDasOnDirectionChange = source.cancelDasOnDirectionChange;
    if (typeof source.preferSoftDrop === 'boolean') result.preferSoftDrop = source.preferSoftDrop;

    return result;
}

/**
 * Convert version 1 handling values (milliseconds) to frames. The old SDF was a
 * millisecond interval with no multiplier equivalent, so it resets to the default.
 */
function migrateSettings(source) {
    if (source.version === SETTINGS_VERSION) return source;
    const migrated = { ...source };
    for (const key of ['arr', 'das', 'dcd']) {
        if (Number.isFinite(source[key])) {
            migrated[key] = Math.round((source[key] / FRAME_MS) * 10) / 10;
        }
    }
    delete migrated.sdf;
    return migrated;
}

/**
 * Load settings from localStorage, falling back to defaults.
 */
export function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return normalizeSettings(saved);
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * Save settings to localStorage.
 */
export function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, version: SETTINGS_VERSION }));
}

/**
 * Get the constraint for a setting key.
 */
export function getConstraint(key) {
    return CONSTRAINTS[key] || null;
}

// Formatting helpers for the settings UI

export function framesToMs(frames) {
    return frames * FRAME_MS;
}

export function describeFrames(frames) {
    return `${Number(frames).toFixed(1)}F / ${Math.round(framesToMs(frames))}ms`;
}

export function describeArr(frames) {
    if (frames === 0) return '0F (instant)';
    return describeFrames(frames);
}

export function describeDcd(frames) {
    if (frames === 0) return '0F (off)';
    return describeFrames(frames);
}

export function describeSoftDrop(factor) {
    if (factor >= SDF_INFINITE) return '∞ (instant)';
    return `${factor}X`;
}

export function describeGameStyle(val) {
    return val === 'battle' ? 'Battle (T99 / PPT)' : 'Modern (TETR.IO / Jstris)';
}

export function describeSoundtrack(val) {
    return val === 'auto' ? 'Auto (by mode)' : describeEnum(val);
}

export function describeVolume(val) {
    return `${val}%`;
}

export function describeCrossfade(val) {
    if (val === 0) return 'Off';
    return `${val}s`;
}

export function describeEnum(val) {
    return val.charAt(0).toUpperCase() + val.slice(1);
}

export function describeOpacity(val) {
    return `${val}%`;
}

export function describePreviewCount(val) {
    return `${val} piece${val !== 1 ? 's' : ''}`;
}

export function describeLockDelay(ms) {
    return `${ms}ms`;
}

/**
 * Multiplier for an off/low/medium/high effect setting (screenShake, boardBounce,
 * placeImpact, clearEffects).
 */
export function effectLevel(settings, key) {
    switch (settings[key]) {
        case 'off':    return 0;
        case 'low':    return 0.45;
        case 'high':   return 1.8;
        default:       return 1.0;
    }
}

const STATS_LABELS = {
    off: 'Off', time: 'Time', speed: 'Speed (PPS, APM)', efficiency: 'Efficiency (finesse)', versus: 'Versus (VS score)',
};

export function describeStatsDisplay(val) {
    return STATS_LABELS[val] || val;
}
