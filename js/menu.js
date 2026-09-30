/**
 * menu.js - Menus in the style of Ace Combat: a row of bars to pick from, opening into
 * lists of bars, then into the settings behind them.
 *
 * Main menu: a row of tabs (PLAY, SETTINGS, CONTROLS, MUSIC). The list under the row
 * shows what is behind the chosen tab, and an info panel on the right explains the bar
 * in focus. PLAY lists the modes; a mode opens a briefing (start, game style, scene,
 * weather). SETTINGS lists the settings tabs, each a list of bars that adjust in place:
 * a segmented gauge for numbers, a switch for on and off, arrows for choices.
 *
 * Pause and results use the same bars under a banner. Everything works with the
 * keyboard (arrows, Enter, Escape), the mouse (hover, click, drag a gauge) and touch.
 */

import { MODE_INFO, MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC } from './modes.js';
import { getConstraint } from './settings.js';
import { findSetting } from './settings-defs.js';

const pad = n => String(n + 1).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

const MODE_DETAIL = {
    [MODE_SPRINT]: { goal: 'Clear 40 lines. Your time is your score.', scenery: 'Midnight Circuit' },
    [MODE_BLITZ]: { goal: 'Score as much as you can in 2 minutes.', scenery: 'Thunder Peak' },
    [MODE_CLASSIC]: { goal: 'Endless. Gravity rises every 10 lines.', scenery: 'Changes every level' },
};

const CONTROL_ROWS = [
    ['MOVE', '◀ ▶'], ['SOFT DROP', '▼'], ['HARD DROP', 'SPACE'],
    ['ROTATE RIGHT', '▲ or X'], ['ROTATE LEFT', 'Z'], ['HOLD', 'C or SHIFT'], ['PAUSE', 'ESC'],
];

/**
 * @typedef {Object} MenuOptions
 * @property {Object} settings - shared settings object (read live)
 * @property {Object[]} tabs - SETTINGS_TABS from settings-defs.js
 * @property {(key: string, value: *) => void} setSetting - change and save a setting
 * @property {() => void} resetSettings - restore defaults
 * @property {() => void} openMusic - show or hide the music player
 * @property {{ move?: () => void, select?: () => void }} [sound] - menu sounds
 */

/**
 * Create the menu system.
 * @param {HTMLElement} container - element the menu is added to
 * @param {MenuOptions} options
 * @returns {Object} menu controller
 */
export function createMenuSystem(container, options) {
    const { settings, tabs, setSetting, resetSettings, openMusic, sound = {} } = options;
    const cb = {};

    const root = document.createElement('div');
    root.className = 'ac';
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
        crumbs: root.querySelector('.ac-crumbs'),
        tabs: root.querySelector('.ac-tabs'),
        banner: root.querySelector('.ac-banner'),
        list: root.querySelector('.ac-list'),
        info: root.querySelector('.ac-info'),
        keys: root.querySelector('.ac-keys'),
        scene: root.querySelector('.ac-scene'),
    };

    const state = {
        screen: null,       // 'main' | 'pause' | 'results' | null (closed)
        tab: 0,
        focus: 'list',      // 'row' (the tabs) or 'list'
        levels: [],         // stack of { title, nodes, index }
        banner: null,       // { text, sub, tone }
        lines: null,        // info panel lines that stay whatever is focused (results)
    };

    // --- Nodes ---
    // kind: 'menu' (opens children), 'action' (runs), 'range' | 'toggle' | 'enum' (a
    // setting), 'info' (shown, not focusable)

    const level = () => state.levels[state.levels.length - 1];
    const focusable = n => n.kind !== 'info';
    const firstFocusable = nodes => Math.max(0, nodes.findIndex(focusable));

    function settingNode(key) {
        const def = findSetting(key);
        return { kind: def.type, label: def.label, def, info: { title: def.label, text: def.hint } };
    }

    const backNode = () => ({ kind: 'action', label: 'BACK', hint: '', run: back, info: { title: 'BACK', text: 'Go back one step.' } });

    function briefing(modeId) {
        const info = MODE_INFO[modeId];
        const nodes = [{
            kind: 'action', label: 'START', hint: info.name,
            info: { title: 'START', text: `Begin ${info.name}.` },
            run: () => { hideAll(); cb.modeSelect?.(modeId); },
        }, settingNode('gameStyle')];
        if (modeId === MODE_CLASSIC) nodes.push(settingNode('casualScene'));
        nodes.push(settingNode('weather'), settingNode('nextPreviewCount'), backNode());
        return nodes;
    }

    function modeNodes() {
        return [MODE_SPRINT, MODE_BLITZ, MODE_CLASSIC].map(id => {
            const info = MODE_INFO[id];
            return {
                kind: 'menu', label: info.name, hint: info.subtitle, title: info.name,
                info: {
                    title: info.name, text: info.description,
                    lines: [
                        { label: 'GOAL', value: MODE_DETAIL[id].goal },
                        { label: 'MUSIC', value: capital(info.track) },
                        { label: 'SCENERY', value: MODE_DETAIL[id].scenery },
                    ],
                },
                children: () => briefing(id),
            };
        });
    }

    function settingsNodes(withBack) {
        const nodes = tabs.map(tab => ({
            kind: 'menu', label: tab.label, hint: `${tab.settings.length} options`, title: tab.label,
            info: { title: tab.label, text: tab.settings.map(s => s.label).join(' / ') },
            children: () => [...tab.settings.map(s => settingNode(s.key)), backNode()],
        }));
        nodes.push({
            kind: 'action', label: 'RESET DEFAULTS', hint: '', armable: true,
            info: { title: 'RESET DEFAULTS', text: 'Put every setting back to its default. Press twice to confirm.' },
            run() { resetSettings(); render(); },
        });
        if (withBack) nodes.push(backNode());
        return nodes;
    }

    function musicNodes() {
        return [{
            kind: 'action', label: 'MUSIC PLAYER', hint: 'OPEN',
            info: { title: 'MUSIC PLAYER', text: 'Drop your own songs on the player to play them instead of the soundtrack.' },
            run: () => openMusic(),
        }, settingNode('soundtrack'), settingNode('musicVolume'), settingNode('musicMuted')];
    }

    function controlNodes() {
        const nodes = CONTROL_ROWS.map(([label, value]) => ({ kind: 'info', label, value }));
        nodes.push({ kind: 'info', label: 'TOUCH', value: 'On-screen buttons' });
        return nodes;
    }

    const MAIN_TABS = [
        { label: 'PLAY', info: { title: 'PLAY', text: 'Pick a mode, then set it up before you start.' }, children: modeNodes },
        { label: 'SETTINGS', info: { title: 'SETTINGS', text: 'Handling, sound, visuals and game options. Changes save at once.' }, children: () => settingsNodes(false) },
        { label: 'CONTROLS', info: { title: 'CONTROLS', text: 'How to play on a keyboard. On phones and tablets, use the on-screen buttons.' }, children: controlNodes },
        { label: 'MUSIC', info: { title: 'MUSIC', text: 'Soundtrack options, and a player for your own music.' }, children: musicNodes },
    ];

    function rootLevel(tabIndex) {
        const tab = MAIN_TABS[tabIndex];
        const nodes = tab.children();
        return { title: tab.label, nodes, index: firstFocusable(nodes) };
    }

    // --- Values ---

    function valueText(n) {
        if (n.kind === 'toggle') return settings[n.def.key] ? 'ON' : 'OFF';
        if (n.kind === 'range' || n.kind === 'enum') {
            const v = settings[n.def.key];
            return n.def.describe ? n.def.describe(v) : String(v);
        }
        return n.value ?? n.hint ?? '';
    }

    function gaugePercent(n) {
        const c = getConstraint(n.def.key);
        return Math.max(0, Math.min(100, ((settings[n.def.key] - c.min) / (c.max - c.min)) * 100));
    }

    function change(n, value) {
        setSetting(n.def.key, value);
        patchRow(level().nodes.indexOf(n));
        renderInfo();
    }

    /** Step a setting by dir (-1 or 1). Ranges step by their own step; `big` steps five at a time. */
    function adjust(n, dir, big = false) {
        if (n.kind === 'toggle') return change(n, !settings[n.def.key]);
        if (n.kind === 'enum') {
            const values = n.def.values;
            const at = values.indexOf(settings[n.def.key]);
            return change(n, values[(at + dir + values.length) % values.length]);
        }
        if (n.kind === 'range') {
            const c = getConstraint(n.def.key);
            const next = settings[n.def.key] + dir * c.step * (big ? 5 : 1);
            return change(n, Math.max(c.min, Math.min(c.max, Number(next.toFixed(3)))));
        }
    }

    function setFromGauge(n, clientX, gauge) {
        const c = getConstraint(n.def.key);
        const rect = gauge.getBoundingClientRect();
        const k = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const raw = c.min + k * (c.max - c.min);
        const snapped = c.min + Math.round((raw - c.min) / c.step) * c.step;
        const value = Math.max(c.min, Math.min(c.max, Number(snapped.toFixed(3))));
        if (value !== settings[n.def.key]) change(n, value);
    }

    // --- Actions ---

    function activate(n) {
        if (n.kind === 'menu') {
            state.levels.push({ title: n.title || n.label, nodes: n.children(), index: 0 });
            const lvl = level();
            lvl.index = firstFocusable(lvl.nodes);
            state.focus = 'list';
            sound.select?.();
            render();
        } else if (n.kind === 'action') {
            if (n.armable && !n.armed) {
                n.armed = true;
                n.label = 'PRESS AGAIN TO CONFIRM';
                sound.move?.();
                return render();
            }
            sound.select?.();
            n.run();
        } else if (n.kind === 'toggle' || n.kind === 'enum') {
            adjust(n, 1);
            sound.move?.();
        }
    }

    function back() {
        if (state.levels.length > 1) {
            state.levels.pop();
            state.focus = 'list';
            sound.move?.();
            render();
        } else if (state.screen === 'main' && state.focus === 'list') {
            state.focus = 'row';
            sound.move?.();
            refreshFocus();
        } else if (state.screen === 'pause') {
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

    // --- Rendering ---

    function rowHtml(n, i) {
        let right;
        if (n.kind === 'range') {
            right = `<span class="ac-ctl"><button class="ac-step" data-step="-1" tabindex="-1" aria-label="Lower">◀</button>` +
                `<span class="ac-gauge"><span class="ac-fill" style="width:${gaugePercent(n)}%"></span></span>` +
                `<button class="ac-step" data-step="1" tabindex="-1" aria-label="Raise">▶</button></span>` +
                `<span class="ac-read">${esc(valueText(n))}</span>`;
        } else if (n.kind === 'toggle') {
            right = `<span class="ac-switch${settings[n.def.key] ? ' on' : ''}"><i></i></span><span class="ac-read">${valueText(n)}</span>`;
        } else if (n.kind === 'enum') {
            right = `<span class="ac-ctl"><button class="ac-step" data-step="-1" tabindex="-1" aria-label="Previous">◀</button>` +
                `<button class="ac-step" data-step="1" tabindex="-1" aria-label="Next">▶</button></span>` +
                `<span class="ac-read ac-wide">${esc(valueText(n))}</span>`;
        } else if (n.kind === 'menu') {
            right = `<span class="ac-read">${esc(n.hint ?? '')}</span><span class="ac-arrow">▶</span>`;
        } else {
            right = `<span class="ac-read">${esc(valueText(n))}</span>`;
        }
        return `<div class="ac-row ack-${n.kind}" role="listitem" data-i="${i}" style="--i:${i}">` +
            `<span class="ac-num">${pad(i)}</span><span class="ac-label">${esc(n.label)}</span>${right}</div>`;
    }

    function patchRow(i) {
        const n = level().nodes[i];
        const row = el.list.querySelector(`[data-i="${i}"]`);
        if (!n || !row) return;
        const read = row.querySelector('.ac-read');
        if (read) read.textContent = valueText(n);
        if (n.kind === 'range') row.querySelector('.ac-fill').style.width = `${gaugePercent(n)}%`;
        if (n.kind === 'toggle') row.querySelector('.ac-switch').classList.toggle('on', !!settings[n.def.key]);
    }

    function renderTabs() {
        el.tabs.innerHTML = MAIN_TABS.map((t, i) =>
            `<button class="ac-tab${i === state.tab ? ' on' : ''}" role="tab" data-tab="${i}" style="--i:${i}">` +
            `<span class="ac-tab-num">${pad(i)}</span><span>${t.label}</span></button>`).join('');
    }

    function renderCrumbs() {
        const parts = state.screen === 'main'
            ? ['MAIN MENU', MAIN_TABS[state.tab].label, ...state.levels.slice(1).map(l => l.title)]
            : state.levels.map(l => l.title);
        el.crumbs.innerHTML = parts.map((p, i) => i === parts.length - 1 ? `<b>${esc(p)}</b>` : esc(p)).join(' <em>//</em> ');
    }

    function renderInfo() {
        const n = state.focus === 'row' ? null : level().nodes[level().index];
        const info = n ? (n.info || { title: n.label }) : MAIN_TABS[state.tab]?.info || {};
        let html = '';
        if (info.title) html += `<div class="ac-info-title">${esc(info.title)}</div>`;
        if (n && (n.kind === 'range' || n.kind === 'toggle' || n.kind === 'enum')) {
            html += `<div class="ac-info-value">${esc(valueText(n))}</div>`;
            if (n.kind === 'range') html += `<div class="ac-meter"><i style="width:${gaugePercent(n)}%"></i></div>`;
        }
        if (info.text) html += `<p class="ac-info-text">${esc(info.text)}</p>`;
        const lines = state.lines || info.lines;
        if (lines) {
            html += '<dl class="ac-lines">' + lines.map(l =>
                `<div${l.big ? ' class="big"' : ''}><dt>${esc(l.label)}</dt><dd>${esc(l.value)}</dd></div>`).join('') + '</dl>';
        }
        el.info.innerHTML = html;
    }

    function refreshFocus() {
        const lvl = level();
        el.list.classList.toggle('idle', state.focus === 'row');
        el.list.querySelectorAll('.ac-row').forEach((row, i) => row.classList.toggle('focus', state.focus === 'list' && i === lvl.index));
        el.tabs.querySelectorAll('.ac-tab').forEach(tab => tab.classList.toggle('focus', state.focus === 'row'));
        root.querySelector('.ac-row.focus')?.scrollIntoView({ block: 'nearest' });
        renderKeys();
        renderInfo();
    }

    function renderKeys() {
        const k = label => `<kbd>${label}</kbd>`;
        const onRow = state.focus === 'row';
        el.keys.innerHTML = onRow
            ? `${k('◀')}${k('▶')} CHOOSE &nbsp; ${k('▼')} OPEN`
            : `${k('▲')}${k('▼')} SELECT &nbsp; ${k('◀')}${k('▶')} ADJUST &nbsp; ${k('ENTER')} CONFIRM &nbsp; ${k('ESC')} BACK`;
    }

    function render() {
        const main = state.screen === 'main';
        root.classList.toggle('over', !main);
        el.tabs.hidden = !main;
        el.banner.hidden = main || !state.banner;
        if (main) renderTabs();
        else if (state.banner) {
            el.banner.className = `ac-banner ${state.banner.tone || ''}`;
            el.banner.innerHTML = `<span class="ac-banner-main">${esc(state.banner.text)}</span><span class="ac-banner-sub">${esc(state.banner.sub || '')}</span>`;
        }
        renderCrumbs();
        el.list.innerHTML = level().nodes.map(rowHtml).join('');
        refreshFocus();
    }

    // --- Input ---

    function onKey(e) {
        if (root.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '')) return;
        const lvl = level();
        const n = state.focus === 'list' ? lvl.nodes[lvl.index] : null;
        let handled = true;
        switch (e.code) {
            case 'ArrowUp':
                if (state.focus === 'list' && state.screen === 'main' && state.levels.length === 1 && lvl.index === firstFocusable(lvl.nodes)) {
                    state.focus = 'row';
                    sound.move?.();
                    refreshFocus();
                } else if (state.focus === 'list') move(-1);
                break;
            case 'ArrowDown':
                if (state.focus === 'row') {
                    state.focus = 'list';
                    sound.move?.();
                    refreshFocus();
                } else move(1);
                break;
            case 'ArrowLeft':
                if (state.focus === 'row') { selectTab(state.tab - 1); sound.move?.(); }
                else if (n && ['range', 'enum', 'toggle'].includes(n.kind)) { adjust(n, -1, e.shiftKey); sound.move?.(); }
                break;
            case 'ArrowRight':
                if (state.focus === 'row') { selectTab(state.tab + 1); sound.move?.(); }
                else if (n && ['range', 'enum', 'toggle'].includes(n.kind)) { adjust(n, 1, e.shiftKey); sound.move?.(); }
                break;
            case 'Enter':
            case 'Space':
            case 'NumpadEnter':
                if (state.focus === 'row') { state.focus = 'list'; sound.select?.(); refreshFocus(); }
                else if (n) activate(n);
                break;
            case 'Escape':
            case 'Backspace':
                back();
                break;
            default:
                handled = false;
        }
        if (handled) {
            e.preventDefault();
            // Keep the game's own key handler from seeing it, so Escape cannot resume and pause again
            e.stopPropagation();
        }
    }
    document.addEventListener('keydown', onKey, true);

    root.addEventListener('click', e => {
        const tab = e.target.closest('.ac-tab');
        if (tab) {
            state.focus = 'row';
            selectTab(Number(tab.dataset.tab));
            sound.move?.();
            return;
        }
        const rowEl = e.target.closest('.ac-row');
        if (!rowEl) return;
        const i = Number(rowEl.dataset.i);
        const n = level().nodes[i];
        if (!n || !focusable(n)) return;
        level().index = i;
        state.focus = 'list';
        const step = e.target.closest('.ac-step');
        if (step) {
            adjust(n, Number(step.dataset.step));
            sound.move?.();
            refreshFocus();
        } else if (!e.target.closest('.ac-gauge')) {
            refreshFocus();
            activate(n);
        } else refreshFocus();
    });

    root.addEventListener('pointerover', e => {
        if (e.pointerType !== 'mouse') return;
        const rowEl = e.target.closest('.ac-row');
        if (!rowEl) return;
        const i = Number(rowEl.dataset.i);
        const n = level().nodes[i];
        if (!n || !focusable(n) || (state.focus === 'list' && level().index === i)) return;
        level().index = i;
        state.focus = 'list';
        sound.move?.();
        refreshFocus();
    });

    root.addEventListener('pointerdown', e => {
        const gauge = e.target.closest('.ac-gauge');
        if (!gauge) return;
        const n = level().nodes[Number(gauge.closest('.ac-row').dataset.i)];
        if (!n) return;
        e.preventDefault();
        level().index = level().nodes.indexOf(n);
        state.focus = 'list';
        refreshFocus();
        setFromGauge(n, e.clientX, gauge);
        const drag = ev => setFromGauge(n, ev.clientX, gauge);
        const stop = () => {
            window.removeEventListener('pointermove', drag);
            window.removeEventListener('pointerup', stop);
            window.removeEventListener('pointercancel', stop);
        };
        window.addEventListener('pointermove', drag);
        window.addEventListener('pointerup', stop);
        window.addEventListener('pointercancel', stop);
    });

    // --- Screens ---

    function open() {
        root.hidden = false;
        document.body.classList.add('menu-open');
    }

    function hideAll() {
        root.hidden = true;
        state.screen = null;
        document.body.classList.remove('menu-open');
    }

    /**
     * Show a screen.
     * @param {'main'|'pause'|'modeSelect'} name
     * @param {Object} [data] - main: { tab, focus }; pause: { modeName }
     */
    function showScreen(name, data = {}) {
        if (name === 'modeSelect') return showScreen('main', { tab: 0, focus: 'list' });
        state.lines = null;
        state.banner = null;
        if (name === 'main') {
            state.screen = 'main';
            state.tab = data.tab ?? 0;
            state.focus = data.focus ?? 'row';
            state.levels = [rootLevel(state.tab)];
        } else if (name === 'pause') {
            state.screen = 'pause';
            state.focus = 'list';
            state.banner = { text: 'PAUSED', sub: data.modeName || '', tone: 'neutral' };
            state.lines = CONTROL_ROWS.map(([label, value]) => ({ label, value }));
            const nodes = [
                { kind: 'action', label: 'RESUME', hint: '', info: { title: 'RESUME', text: 'Back to the game.' }, run: () => { hideAll(); cb.resume?.(); } },
                { kind: 'action', label: 'RESTART', hint: '', info: { title: 'RESTART', text: 'Start this mode again from the beginning.' }, run: () => { hideAll(); cb.restart?.(); } },
                { kind: 'menu', label: 'SETTINGS', hint: '', title: 'SETTINGS', info: { title: 'SETTINGS', text: 'Change handling, sound and visuals without leaving the game.' }, children: () => settingsNodes(true) },
                { kind: 'action', label: 'QUIT TO MENU', hint: '', info: { title: 'QUIT TO MENU', text: 'Leave this game.' }, run: () => { cb.quit?.(); showScreen('main'); } },
            ];
            state.levels = [{ title: 'PAUSED', nodes, index: 0 }];
        }
        open();
        render();
    }

    /** Show the results of a finished game. */
    function showResults(results) {
        state.screen = 'results';
        state.focus = 'list';
        const won = results.completed;
        state.banner = {
            text: won ? (results.modeId === 'sprint' ? 'SPRINT COMPLETE' : "TIME'S UP") : 'GAME OVER',
            sub: results.modeName || '',
            tone: won ? 'ok' : 'fail',
        };
        const lines = [];
        if (results.modeId === 'sprint') lines.push({ label: 'TIME', value: results.finalTimePrecise || results.finalTime, big: true });
        else lines.push({ label: 'SCORE', value: results.score.toLocaleString(), big: true });
        lines.push({ label: 'LINES', value: results.linesCleared }, { label: 'LEVEL', value: results.level }, { label: 'PIECES', value: results.piecesPlaced });
        if (results.tSpins > 0) lines.push({ label: 'T-SPINS', value: results.tSpins });
        if (results.tetrises > 0) lines.push({ label: 'QUADS', value: results.tetrises });
        if (results.maxCombo > 0) lines.push({ label: 'MAX COMBO', value: results.maxCombo });
        if (results.perfectClears > 0) lines.push({ label: 'PERFECT CLEARS', value: results.perfectClears });
        lines.push(
            { label: 'LINES SENT', value: results.linesSent },
            { label: 'APM', value: results.apm.toFixed(1) },
            { label: 'PPS', value: (results.pps ?? 0).toFixed(2) },
            { label: 'FINESSE', value: `${(results.finesse ?? 100).toFixed(1)}%` },
        );
        if (results.modeId !== 'sprint') lines.push({ label: 'TIME', value: results.finalTime });
        state.lines = lines;
        const nodes = [
            { kind: 'action', label: 'RETRY', hint: '', info: { title: 'RETRY', text: 'Play this mode again.' }, run: () => { hideAll(); cb.restart?.(); } },
            { kind: 'action', label: 'CHANGE MODE', hint: '', info: { title: 'CHANGE MODE', text: 'Pick another mode.' }, run: () => { cb.quit?.(); showScreen('main', { tab: 0, focus: 'list' }); } },
            { kind: 'menu', label: 'SETTINGS', hint: '', title: 'SETTINGS', info: { title: 'SETTINGS', text: 'Adjust handling, sound and visuals.' }, children: () => settingsNodes(true) },
            { kind: 'action', label: 'MAIN MENU', hint: '', info: { title: 'MAIN MENU', text: 'Back to the title screen.' }, run: () => { cb.quit?.(); showScreen('main'); } },
        ];
        state.levels = [{ title: state.banner.text, nodes, index: 0 }];
        open();
        render();
    }

    /** Open the settings: the SETTINGS tab on the main menu, or a step inside pause and results. */
    function openSettings() {
        if (root.hidden) showScreen('main', { tab: 1, focus: 'list' });
        else if (state.screen === 'main') {
            if (state.tab !== 1 || state.levels.length > 1) selectTab(1);
            state.focus = 'list';
            refreshFocus();
        } else if (!state.levels.some(l => l.title === 'SETTINGS')) {
            const nodes = settingsNodes(true);
            state.levels.push({ title: 'SETTINGS', nodes, index: 0 });
            state.focus = 'list';
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
        setSceneTag(text) {
            el.scene.textContent = text;
        },
        onModeSelect(fn) { cb.modeSelect = fn; },
        onResume(fn) { cb.resume = fn; },
        onRestart(fn) { cb.restart = fn; },
        onQuit(fn) { cb.quit = fn; },
    };
}
