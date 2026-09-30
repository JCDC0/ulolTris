/**
 * main.js - Entry point. Wires together menu, game, background, sound, soundtrack, music player,
 * and settings.
 */

import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './settings.js';
import { SETTINGS_TABS } from './settings-defs.js';
import { createBackground } from './background.js';
import { createSoundEngine } from './sound.js';
import { createMusicPlayer } from './music-player.js';
import { createMusicEngine } from './music.js';
import { createAmbience } from './ambience.js';
import { createTouchControls } from './touch.js';
import { createMenuSystem } from './menu.js';
import { createGame } from './game.js';
import { MODE_INFO } from './modes.js';
import { musicPlan } from './tracks.js';

// --- State ---
const settings = loadSettings();
let currentGame = null;
let soundEngine = null;
let menu = null;
let sceneTag = '';

// --- DOM References ---
const gameContainer = document.getElementById('game-container');
const menuContainer = document.getElementById('menu-container');
const settingsToggle = document.getElementById('settings-toggle');
const musicPlayerContainer = document.getElementById('music-player-container');

const playfield = document.getElementById('playfield');
const ambience = createAmbience(settings);
const background = createBackground(
    document.getElementById('bg-canvas'), document.getElementById('bg-layer'), settings, {
        onScene: info => {
            ambience.setScene(info.sounds);
            sceneTag = `${info.sceneName.toUpperCase()} / ${info.weatherName.toUpperCase()}`;
            menu?.setSceneTag(sceneTag);
        },
        onStrike: strike => ambience.strike(strike.distance),
        onCue: cue => ambience.cue(cue.kind),
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

/** Menu music: the casual playlist unless the player picked another playlist or one track. */
function playMenuMusic() {
    music.play(musicPlan(settings, 'casual'));
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
playMenuMusic();

// --- Settings ---

/** Change a setting from the menu, save it, and do whatever it needs right away. */
function applySetting(key, value) {
    settings[key] = value;
    saveSettings(settings);
    // In a game the engine picks the track every frame; in the menu, switch here.
    if ((key === 'soundtrack' || key === 'track') && !currentGame?.isRunning()) playMenuMusic();
    if (key === 'soundPack') soundEngine?.play('rotate');
    if (key === 'touchControls') fitGame();
    if (key === 'casualScene' || key === 'weather') background.refresh();
}

/** Play one built-in track on a loop (or 'auto' for the playlist), and stop the listener's own music. */
function pickTrack(id) {
    musicPlayer?.stop();
    applySetting('track', id);
    menu?.refresh();
}

function resetSettings() {
    // Mutate in place: the game, input, sound and music modules hold this same object.
    Object.assign(settings, DEFAULT_SETTINGS);
    saveSettings(settings);
    fitGame();
    background.refresh();
    if (!currentGame?.isRunning()) playMenuMusic();
}

// --- Menu System ---
menu = createMenuSystem(menuContainer, {
    settings,
    tabs: SETTINGS_TABS,
    setSetting: applySetting,
    resetSettings,
    openMusic: () => musicPlayer?.toggle(),
    music: {
        current: () => music.getTrack(),
        userPlaying: () => !!musicPlayer?.isPlaying(),
        pick: pickTrack,
        user: {
            tracks: () => musicPlayer?.getTracks() ?? [],
            index: () => musicPlayer?.getIndex() ?? -1,
            playing: () => !!musicPlayer?.isPlaying(),
            play: i => musicPlayer?.play(i),
            toggle: () => musicPlayer?.pauseToggle(),
            add: () => musicPlayer?.openPicker(),
            clear: () => musicPlayer?.clear(),
        },
    },
    sound: {
        move: () => soundEngine?.play('menuMove'),
        select: () => soundEngine?.play('menuSelect'),
    },
});
menu.setSceneTag(sceneTag);

// The MUSIC tab follows the music: a new track in the playlist, or a change to the listener's own songs
music.onTrack(() => menu.refresh());
musicPlayer?.onChange(() => menu.refresh());

// Songs can be dropped anywhere on the page, not only on the player's drop zone
window.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', e => {
    if (e.defaultPrevented || !e.dataTransfer?.files?.length) return;
    e.preventDefault();
    musicPlayer?.addFiles(e.dataTransfer.files);
});

menu.onModeSelect((modeId) => {
    gameContainer.classList.remove('game-hidden');
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
    gameContainer.classList.add('game-hidden');
    music.setTempoScale(1);
    playMenuMusic();
    background.showMenu();
});

// The gear button opens the settings from anywhere; in a running game it pauses first
settingsToggle.addEventListener('click', () => {
    if (currentGame?.isRunning() && !menu.isOpen()) currentGame.pause();
    menu.openSettings();
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
            playMenuMusic();
            menu.showResults(results);
        },
        onPause() {
            menu.showScreen('pause', { modeName: MODE_INFO[modeId].name });
        },
        onLevelUp(level) {
            background.onLevel(modeId, level);
        },
    });

    // Store mode id for restart
    currentGame._modeId = modeId;
    currentGame.start();
}

// Music player toggle button
const musicToggle = document.getElementById('music-toggle');
if (musicToggle && musicPlayer) {
    musicToggle.addEventListener('click', () => {
        musicPlayer.toggle();
        soundEngine?.play('menuMove');
    });
}
