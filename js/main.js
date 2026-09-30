/**
 * main.js - Entry point. Wires together menu, game, background, sound, soundtrack, music player,
 * and settings.
 */

import { loadSettings, saveSettings, DEFAULT_SETTINGS,
         describeArr, describeFrames, describeDcd, describeSoftDrop, describeVolume, describeCrossfade,
         describeEnum, describeOpacity, describePreviewCount, describeLockDelay,
         describeGameStyle, describeSoundtrack, describeStatsDisplay,
         getConstraint } from './settings.js';
import { describeSkin, SKINS } from './skins.js';
import { createBackground, describeScene, CASUAL_SCENES } from './background.js';
import { describeWeather } from './scenes/atmosphere.js';
import { createSoundEngine } from './sound.js';
import { createMusicPlayer } from './music-player.js';
import { createMusicEngine } from './music.js';
import { createAmbience } from './ambience.js';
import { createTouchControls } from './touch.js';
import { createMenuSystem } from './menu.js';
import { createGame } from './game.js';

// --- State ---
const settings = loadSettings();
let settingsListenersBound = false;
let currentGame = null;
let soundEngine = null;

// --- DOM References ---
const gameContainer = document.getElementById('game-container');
const menuContainer = document.getElementById('menu-container');
const settingsPanel = document.getElementById('settings-panel');
const settingsToggle = document.getElementById('settings-toggle');
const settingsClose = document.getElementById('settings-close');
const musicPlayerContainer = document.getElementById('music-player-container');

const playfield = document.getElementById('playfield');
const ambience = createAmbience(settings);
const background = createBackground(
    document.getElementById('bg-canvas'), document.getElementById('bg-layer'), settings, {
        onScene: info => ambience.setScene(info.sounds),
        onStrike: strike => ambience.strike(strike.distance),
    });
background.showMenu();

const canvases = {
    board: document.getElementById('board-canvas'),
    hold: document.getElementById('hold-canvas'),
    next: document.getElementById('next-canvas'),
};

// --- Sound Engine ---
try {
    soundEngine = createSoundEngine(settings);
} catch (e) {
    console.warn('Sound engine failed to initialize:', e);
}

// --- Music Player ---
let musicPlayer = null;
if (musicPlayerContainer) {
    musicPlayer = createMusicPlayer(musicPlayerContainer, settings);
}

// --- Soundtrack ---
const music = createMusicEngine(settings);
if (musicPlayer) music.setSuppressor(() => musicPlayer.isPlaying());

/** Menu music: calm unless the player picked a fixed soundtrack. */
function menuTrack() {
    const choice = settings.soundtrack || 'auto';
    if (choice === 'off') return null;
    return choice === 'auto' ? 'calm' : choice;
}

// Browsers only allow audio after a user gesture, so start on the first click or key.
function unlockAudio() {
    music.unlock();
    ambience.unlock();
    document.removeEventListener('pointerdown', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
}
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('keydown', unlockAudio);
music.setTrack(menuTrack());

// --- Menu System ---
const menu = createMenuSystem(menuContainer);

menu.onModeSelect((modeId) => {
    menu.hideAll();
    gameContainer.classList.remove('game-hidden');
    startNewGame(modeId);
    if (soundEngine) soundEngine.play('menuSelect');
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
    gameContainer.classList.add('game-hidden');
    music.setTempoScale(1);
    music.setTrack(menuTrack());
    background.showMenu();
});

// --- Touch controls ---
const touchControls = createTouchControls(
    [document.getElementById('touch-controls'), document.getElementById('touch-pause')], settings);

/** Layout sizes in CSS pixels before scaling. The touch layout has narrower side columns. */
const LAYOUT = { height: 780, width: 700, touchWidth: 590, touchButtons: 176 };

/**
 * Scale the playfield down so the board, stats and spawn rows all fit. With touch
 * controls in portrait, the playfield sits at the top and leaves room for the buttons.
 */
function fitGame() {
    const touch = touchControls.refresh();
    const portrait = touch && window.innerHeight >= window.innerWidth;
    document.body.classList.toggle('touch-portrait', portrait);
    const height = window.innerHeight - 16 - (portrait ? LAYOUT.touchButtons : 0);
    const width = window.innerWidth - (touch ? 8 : 16);
    const scale = Math.min(1, height / LAYOUT.height, width / (touch ? LAYOUT.touchWidth : LAYOUT.width));
    gameContainer.style.transform = scale < 1 ? `scale(${scale})` : '';
}
window.addEventListener('resize', fitGame);
window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', fitGame);
fitGame();

// Show main menu on load
gameContainer.classList.add('game-hidden');
menu.showScreen('main');

// --- Game Start ---
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
            menu.showScreen('pause');
        },
        onLevelUp(level) {
            background.onLevel(modeId, level);
        },
    });

    // Store mode id for restart
    currentGame._modeId = modeId;
    currentGame.start();
}

const SOUND_PACK_LABELS = { ulol: 'uloltris', arcade: 'Arcade (Jstris-style)', bubbly: 'Bubbly (PPT-style)' };
function describeSoundPack(val) {
    return SOUND_PACK_LABELS[val] || val;
}

// --- Settings Panel ---
function buildSettingsUI() {
    const tabContainer = settingsPanel.querySelector('.settings-tabs');
    const contentContainer = settingsPanel.querySelector('.settings-tab-content');
    if (!tabContainer || !contentContainer) return;

    const tabs = [
        { id: 'handling', label: 'HANDLING', settings: [
            { key: 'arr', label: 'ARR', type: 'range', describe: describeArr },
            { key: 'das', label: 'DAS', type: 'range', describe: describeFrames },
            { key: 'dcd', label: 'DCD', type: 'range', describe: describeDcd },
            { key: 'sdf', label: 'SDF', type: 'range', describe: describeSoftDrop },
            { key: 'cancelDasOnDirectionChange', label: 'CANCEL DAS ON TURN', type: 'toggle' },
            { key: 'preferSoftDrop', label: 'PREFER SOFT DROP', type: 'toggle' },
        ]},
        { id: 'audio', label: 'AUDIO', settings: [
            { key: 'masterVolume', label: 'MASTER', type: 'range', describe: describeVolume },
            { key: 'sfxVolume', label: 'SFX', type: 'range', describe: describeVolume },
            { key: 'musicVolume', label: 'MUSIC', type: 'range', describe: describeVolume },
            { key: 'sfxMuted', label: 'MUTE SFX', type: 'toggle' },
            { key: 'musicMuted', label: 'MUTE MUSIC', type: 'toggle' },
            { key: 'ambience', label: 'SCENE SOUNDS', type: 'toggle' },
            { key: 'ambienceVolume', label: 'SCENE SOUND VOLUME', type: 'range', describe: describeVolume },
            { key: 'soundPack', label: 'SOUND PACK', type: 'enum', values: ['ulol', 'arcade', 'bubbly'], describe: describeSoundPack },
            { key: 'soundtrack', label: 'SOUNDTRACK', type: 'enum', values: ['auto', 'calm', 'competitive', 'intense', 'off'], describe: describeSoundtrack },
            { key: 'crossfadeDuration', label: 'CROSSFADE', type: 'range', describe: describeCrossfade },
        ]},
        { id: 'visual', label: 'VISUAL', settings: [
            { key: 'blockSkin', label: 'BLOCK SKIN', type: 'enum', values: SKINS, describe: describeSkin },
            { key: 'statsDisplay', label: 'STATS DISPLAY', type: 'enum', values: ['off', 'time', 'speed', 'efficiency', 'versus'], describe: describeStatsDisplay },
            { key: 'background', label: 'BACKGROUND', type: 'enum', values: ['on', 'dim', 'off'], describe: describeEnum },
            { key: 'casualScene', label: 'CASUAL SCENE', type: 'enum', values: ['cycle', ...CASUAL_SCENES], describe: describeScene },
            { key: 'weather', label: 'WEATHER', type: 'enum', values: ['default', 'cycle', 'sunny', 'cloudy', 'sunset', 'rain', 'thunder', 'night', 'nightthunder'], describe: describeWeather },
            { key: 'ghostOpacity', label: 'GHOST OPACITY', type: 'range', describe: describeOpacity },
            { key: 'showActionText', label: 'CLEAR TEXT', type: 'toggle' },
        ]},
        { id: 'effects', label: 'FX', settings: [
            { key: 'boardBounce', label: 'BOARD BOUNCE', type: 'enum', values: ['off','low','medium','high'], describe: describeEnum },
            { key: 'placeImpact', label: 'PLACE IMPACT', type: 'enum', values: ['off','low','medium','high'], describe: describeEnum },
            { key: 'clearEffects', label: 'CLEAR EFFECTS', type: 'enum', values: ['off','low','medium','high'], describe: describeEnum },
            { key: 'screenShake', label: 'SCREEN SHAKE', type: 'enum', values: ['off','low','medium','high'], describe: describeEnum },
        ]},
        { id: 'gameplay', label: 'GAME', settings: [
            { key: 'gameStyle', label: 'GAME STYLE', type: 'enum', values: ['modern', 'battle'], describe: describeGameStyle },
            { key: 'nextPreviewCount', label: 'NEXT PIECES', type: 'range', describe: describePreviewCount },
            { key: 'lockDelay', label: 'LOCK DELAY', type: 'range', describe: describeLockDelay },
            { key: 'touchControls', label: 'TOUCH CONTROLS', type: 'enum', values: ['auto', 'on', 'off'], describe: describeEnum },
        ]},
    ];

    // Build tab buttons
    tabContainer.innerHTML = '';
    tabs.forEach((tab, i) => {
        const btn = document.createElement('button');
        btn.className = `settings-tab-btn ${i === 0 ? 'active' : ''}`;
        btn.textContent = tab.label;
        btn.dataset.tab = tab.id;
        btn.type = 'button';
        tabContainer.appendChild(btn);
    });

    // Build tab content
    contentContainer.innerHTML = '';
    tabs.forEach((tab, i) => {
        const section = document.createElement('div');
        section.className = `settings-tab-section ${i === 0 ? 'active' : ''}`;
        section.dataset.tab = tab.id;

        for (const s of tab.settings) {
            const row = document.createElement('label');
            row.className = 'setting-row';

            if (s.type === 'range') {
                const c = getConstraint(s.key);
                row.innerHTML = `
                    <span class="setting-name">${s.label}</span>
                    <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${settings[s.key]}" data-key="${s.key}">
                    <span class="setting-readout" data-readout="${s.key}">${s.describe(settings[s.key])}</span>
                `;
            } else if (s.type === 'toggle') {
                row.innerHTML = `
                    <span class="setting-name">${s.label}</span>
                    <button type="button" class="setting-toggle ${settings[s.key] ? 'on' : ''}" data-toggle="${s.key}">
                        ${settings[s.key] ? 'ON' : 'OFF'}
                    </button>
                `;
            } else if (s.type === 'enum') {
                const options = s.values.map(v =>
                    `<option value="${v}" ${settings[s.key] === v ? 'selected' : ''}>${s.describe(v)}</option>`
                ).join('');
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

    // Add reset button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'menu-btn settings-reset-btn';
    resetBtn.textContent = 'RESET DEFAULTS';
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => {
        // Mutate in place: the game, input, sound and music modules hold this same object.
        Object.assign(settings, DEFAULT_SETTINGS);
        saveSettings(settings);
        buildSettingsUI();
        fitGame();
    });
    contentContainer.appendChild(resetBtn);

    // The containers persist across rebuilds, so their listeners are bound only once.
    if (settingsListenersBound) return;
    settingsListenersBound = true;

    // Tab switching
    tabContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.settings-tab-btn');
        if (!btn) return;
        tabContainer.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
        contentContainer.querySelectorAll('.settings-tab-section').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        const section = contentContainer.querySelector(`[data-tab="${btn.dataset.tab}"]`);
        if (section) section.classList.add('active');
        if (soundEngine) soundEngine.play('menuMove');
    });

    // Setting change handlers
    contentContainer.addEventListener('input', (e) => {
        const input = e.target;
        const key = input.dataset.key;
        if (!key) return;

        const tab = tabs.find(t => t.settings.some(s => s.key === key));
        const settingDef = tab?.settings.find(s => s.key === key);
        if (!settingDef) return;

        const val = Number(input.value);
        settings[key] = val;
        saveSettings(settings);

        const readout = contentContainer.querySelector(`[data-readout="${key}"]`);
        if (readout && settingDef.describe) {
            readout.textContent = settingDef.describe(val);
        }
    });

    contentContainer.addEventListener('click', (e) => {
        // Toggle buttons
        const toggleBtn = e.target.closest('[data-toggle]');
        if (toggleBtn) {
            const key = toggleBtn.dataset.toggle;
            settings[key] = !settings[key];
            saveSettings(settings);
            toggleBtn.classList.toggle('on', settings[key]);
            toggleBtn.textContent = settings[key] ? 'ON' : 'OFF';
            if (soundEngine) soundEngine.play('menuMove');
        }
    });

    contentContainer.addEventListener('change', (e) => {
        const select = e.target.closest('[data-enum]');
        if (select) {
            const key = select.dataset.enum;
            settings[key] = select.value;
            saveSettings(settings);
            // In a game, the engine picks the track every frame; on the menu, switch here.
            if (key === 'soundtrack' && !currentGame?.isRunning()) music.setTrack(menuTrack());
            if (key === 'soundPack') soundEngine?.play('rotate');
            if (key === 'touchControls') fitGame();
            if (key === 'casualScene' || key === 'weather') background.refresh();

            const tab = tabs.find(t => t.settings.some(s => s.key === key));
            const settingDef = tab?.settings.find(s => s.key === key);
            const readout = contentContainer.querySelector(`[data-readout="${key}"]`);
            if (readout && settingDef?.describe) {
                readout.textContent = settingDef.describe(select.value);
            }
            if (soundEngine) soundEngine.play('menuMove');
        }
    });
}

// Build settings UI on load
buildSettingsUI();

// Settings panel open/close
function setSettingsOpen(open) {
    settingsPanel.classList.toggle('open', open);
    settingsPanel.setAttribute('aria-hidden', String(!open));
}

settingsToggle.addEventListener('click', () => {
    const isOpen = settingsPanel.classList.contains('open');
    setSettingsOpen(!isOpen);
    if (soundEngine) soundEngine.play('menuMove');
});

settingsClose.addEventListener('click', () => {
    setSettingsOpen(false);
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && settingsPanel.classList.contains('open')) {
        setSettingsOpen(false);
        e.stopPropagation();
    }
});

// Open settings from menu
document.addEventListener('uloltris-open-settings', () => {
    setSettingsOpen(true);
});

// Music player toggle button
const musicToggle = document.getElementById('music-toggle');
if (musicToggle && musicPlayer) {
    musicToggle.addEventListener('click', () => {
        musicPlayer.toggle();
        if (soundEngine) soundEngine.play('menuMove');
    });
}
