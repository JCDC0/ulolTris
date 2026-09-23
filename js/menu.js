/**
 * menu.js - Menu screens: main menu, mode select, pause overlay, game over/results
 */

import { MODE_INFO, MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC } from './modes.js';

/**
 * Create the menu system.
 * All screens are DOM overlays toggled via display.
 *
 * @param {HTMLElement} container - The root container to append screens to
 * @returns {Object} Menu controller
 */
export function createMenuSystem(container) {
    let currentScreen = null;
    let onModeSelectCallback = null;
    let onResumeCallback = null;
    let onRestartCallback = null;
    let onQuitCallback = null;

    // Build screens
    const screens = {};

    // --- MAIN MENU ---
    const mainMenu = createElement('div', 'menu-screen menu-main');
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

    // --- MODE SELECT ---
    const modeSelect = createElement('div', 'menu-screen menu-mode-select');
    const modesHtml = [MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC].map(id => {
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
    }).join('');
    modeSelect.innerHTML = `
        <div class="menu-content">
            <h2 class="menu-heading">SELECT MODE</h2>
            ${modesHtml}
            <button class="menu-btn menu-btn-back" data-action="back">BACK</button>
        </div>
    `;
    screens.modeSelect = modeSelect;
    container.appendChild(modeSelect);

    // --- PAUSE OVERLAY ---
    const pauseOverlay = createElement('div', 'menu-screen menu-pause');
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

    // --- GAME OVER / RESULTS ---
    const resultsScreen = createElement('div', 'menu-screen menu-results');
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

    // Hide all initially
    Object.values(screens).forEach(s => s.style.display = 'none');

    // --- EVENT DELEGATION ---
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        const modeCard = e.target.closest('[data-mode]');

        if (modeCard) {
            const modeId = modeCard.dataset.mode;
            if (onModeSelectCallback) onModeSelectCallback(modeId);
            return;
        }

        if (!btn) return;
        const action = btn.dataset.action;

        switch (action) {
            case 'play':
                showScreen('modeSelect');
                break;
            case 'settings':
                // Settings panel is external; trigger via custom event
                document.dispatchEvent(new CustomEvent('uloltris-open-settings'));
                break;
            case 'back':
                showScreen('main');
                break;
            case 'resume':
                hideAll();
                if (onResumeCallback) onResumeCallback();
                break;
            case 'restart':
                hideAll();
                if (onRestartCallback) onRestartCallback();
                break;
            case 'retry':
                hideAll();
                if (onRestartCallback) onRestartCallback();
                break;
            case 'quit':
                if (onQuitCallback) onQuitCallback();
                showScreen('main');
                break;
        }
    });

    // Keyboard shortcut: any key on main menu goes to play
    document.addEventListener('keydown', (e) => {
        if (currentScreen === 'main' && !e.repeat) {
            if (e.code !== 'Escape' && !e.code.startsWith('F')) {
                showScreen('modeSelect');
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
            screens[name].style.display = 'flex';
            currentScreen = name;
        }
    }

    function hideAll() {
        Object.values(screens).forEach(s => s.style.display = 'none');
        currentScreen = null;
    }

    /**
     * Populate and show the results screen.
     */
    function showResults(results) {
        const titleEl = resultsScreen.querySelector('#results-title');
        const gridEl = resultsScreen.querySelector('#results-grid');

        if (results.completed) {
            titleEl.textContent = results.modeId === 'sprint' ? 'SPRINT COMPLETE!' : 'TIME\'S UP!';
            titleEl.className = 'results-title results-complete';
        } else {
            titleEl.textContent = 'GAME OVER';
            titleEl.className = 'results-title results-gameover';
        }

        // Build stats grid
        const stats = [];

        if (results.modeId === 'sprint') {
            stats.push({ label: 'TIME', value: results.finalTimePrecise || results.finalTime, highlight: true });
        } else {
            stats.push({ label: 'SCORE', value: results.score.toLocaleString(), highlight: true });
        }

        stats.push({ label: 'LINES', value: results.linesCleared });
        stats.push({ label: 'LEVEL', value: results.level });
        stats.push({ label: 'PIECES', value: results.piecesPlaced });

        if (results.tSpins > 0) {
            stats.push({ label: 'T-SPINS', value: results.tSpins });
        }
        if (results.tetrises > 0) {
            stats.push({ label: 'TETRISES', value: results.tetrises });
        }
        if (results.maxCombo > 0) {
            stats.push({ label: 'MAX COMBO', value: results.maxCombo });
        }
        if (results.perfectClears > 0) {
            stats.push({ label: 'PERFECT CLEARS', value: results.perfectClears });
        }

        if (results.modeId !== 'sprint') {
            stats.push({ label: 'TIME', value: results.finalTime });
        }

        gridEl.innerHTML = stats.map(s => `
            <div class="results-stat ${s.highlight ? 'results-stat-highlight' : ''}">
                <span class="results-stat-label">${s.label}</span>
                <span class="results-stat-value">${s.value}</span>
            </div>
        `).join('');

        showScreen('results');
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
        },
    };
}
