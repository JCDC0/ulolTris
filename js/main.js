/**
 * main.js - Entry point. Wires together menu, game, sound, music player, and settings.
 */

import { loadSettings, saveSettings, DEFAULT_SETTINGS,
         describeArr, describeFrames, describeDcd, describeSoftDrop, describeVolume, describeCrossfade,
         describeEnum, describeOpacity, describePreviewCount, describeLockDelay,
         getConstraint } from './settings.js';
import { createSoundEngine } from './sound.js';
import { createMusicPlayer } from './music-player.js';
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
});

// Show main menu on load
gameContainer.classList.add('game-hidden');
menu.showScreen('main');

// --- Game Start ---
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
            menu.showScreen('pause');
        },
    });

    // Store mode id for restart
    currentGame._modeId = modeId;
    currentGame.start();
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
            { key: 'crossfadeDuration', label: 'CROSSFADE', type: 'range', describe: describeCrossfade },
        ]},
        { id: 'visual', label: 'VISUAL', settings: [
            { key: 'screenShake', label: 'SCREEN SHAKE', type: 'enum', values: ['off','low','medium','high'], describe: describeEnum },
            { key: 'particleDensity', label: 'PARTICLES', type: 'enum', values: ['off','low','medium','high'], describe: describeEnum },
            { key: 'ghostOpacity', label: 'GHOST OPACITY', type: 'range', describe: describeOpacity },
            { key: 'showActionText', label: 'ACTION TEXT', type: 'toggle' },
        ]},
        { id: 'gameplay', label: 'GAME', settings: [
            { key: 'nextPreviewCount', label: 'NEXT PIECES', type: 'range', describe: describePreviewCount },
            { key: 'lockDelay', label: 'LOCK DELAY', type: 'range', describe: describeLockDelay },
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
