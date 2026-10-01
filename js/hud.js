/**
 * hud.js - The DOM around the board: the clear feed on the left (clear name, B2B,
 * combo, damage), the stats stack at the bottom left, the big number under the board,
 * the progress meter, and finesse under the next queue.
 *
 * The statsDisplay setting picks the stats, like TETR.IO's display option:
 * off, time (pieces, lines, time), speed (PPS, APM, KPS), efficiency (APP, KPP,
 * finesse) or versus (APM, PPS, VS score).
 *
 * Classic mode (`og`) has no attack, finesse or combos. It shows level, lines, tetris
 * rate and time (speed: PPS and KPS), names each clear and its points in the feed, and
 * pads the score under the board to six digits.
 */

import { getActionColor } from './scoring.js';

const FEED_SLOTS = ['spin', 'clear', 'b2b', 'combo', 'attack'];

function formatClock(ms) {
    const total = Math.max(0, ms);
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const milli = Math.floor(total % 1000);
    return { main: `${m}:${String(s).padStart(2, '0')}`, sub: `.${String(milli).padStart(3, '0')}` };
}

const fixed = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : (0).toFixed(d));

/**
 * @param {Object} settings - Settings reference (statsDisplay, showActionText)
 * @param {string} modeId - 'sprint' | 'blitz' | 'classic' | 'og'
 */
export function createHud(settings, modeId) {
    const isOg = modeId === 'og';
    const els = {
        feed: document.getElementById('hud-feed'),
        stats: document.getElementById('hud-stats'),
        under: document.getElementById('hud-under'),
        finesse: document.getElementById('hud-finesse'),
        meter: document.getElementById('hud-meter-fill'),
    };
    const last = new Map();
    const slots = {};

    if (els.feed) {
        els.feed.innerHTML = FEED_SLOTS.map(k => `<div class="feed-slot feed-${k}" data-slot="${k}"></div>`).join('');
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
        el.style.color = color || '';
        el.classList.remove('show');
        void el.offsetWidth; // restart the CSS animation
        el.classList.add('show');
    }

    function row(label, value, sub = '', extraClass = '') {
        return `<div class="stat ${extraClass}"><div class="stat-label">${label}</div>` +
            `<div class="stat-value">${value}<span class="stat-sub">${sub}</span></div></div>`;
    }

    return {
        /**
         * Show a clear in the feed.
         * @param {Object} r - scoring result plus { attack, tSpinType }
         */
        onClear(r) {
            if (settings.showActionText === false) return;
            if (isOg) {
                if (r.action) {
                    flashSlot('clear', r.actionName, getActionColor(r.action));
                    flashSlot('attack', `+${r.points.toLocaleString()}`, '#ffd24a');
                }
                return;
            }
            if (r.action) {
                const isSpin = r.action.startsWith('tspin');
                const name = r.action === 'tetris' ? 'QUAD'
                    : ['single', 'double', 'triple'].find(n => r.action.endsWith(n))?.toUpperCase() || '';
                if (isSpin) flashSlot('spin', r.action.includes('mini') ? 'T-SPIN MINI' : 'T-SPIN', getActionColor(r.action));
                if (name) flashSlot('clear', name, isSpin ? '#ffffff' : getActionColor(r.action));
            }
            if (r.perfectClear) flashSlot('clear', 'ALL CLEAR', '#ffd700');
            if (r.b2b && r.b2bCount > 0) flashSlot('b2b', `B2B <b>×${r.b2bCount}</b>`, '#ffd24a');
            if (r.combo > 0) flashSlot('combo', `<b>${r.combo}</b> COMBO`, '#7cf29a');
            if (r.attack > 0) flashSlot('attack', `+${r.attack}`, r.attack >= 4 ? '#ff4d6d' : '#ffb347');
        },

        /**
         * Refresh numbers. Cheap to call every frame: the DOM only changes when text does.
         * @param {Object} s - { pieces, lines, level, score, keys, linesSent, elapsedMs,
         *   clockMs, urgent, primaryLabel, primaryValue, progress, finesseJudged, finesseFaults,
         *   tetrises }
         */
        update(s) {
            const mode = settings.statsDisplay || 'time';
            const sec = s.elapsedMs / 1000;
            const pps = sec > 0 ? s.pieces / sec : 0;
            const apm = sec > 0 ? s.linesSent / (sec / 60) : 0;
            const kps = sec > 0 ? s.keys / sec : 0;
            const app = s.pieces > 0 ? s.linesSent / s.pieces : 0;
            const kpp = s.pieces > 0 ? s.keys / s.pieces : 0;
            const vs = sec > 0 ? (s.linesSent / sec) * 100 : 0;
            const finessePct = s.finesseJudged > 0 ? ((s.finesseJudged - s.finesseFaults) / s.finesseJudged) * 100 : 100;

            const clock = formatClock(s.clockMs);
            const timeRow = row('TIME', clock.main, clock.sub, `stat-time${s.urgent ? ' urgent' : ''}`);
            const levelRow = modeId === 'classic' || isOg ? row('LEVEL', s.level) : '';
            const tetrisRate = s.lines > 0 ? Math.round((s.tetrises * 4 / s.lines) * 100) : 0;
            let rows = '';
            if (isOg) {
                if (mode === 'off') rows = '';
                else if (mode === 'speed') rows = levelRow + row('PPS', fixed(pps)) + row('KPS', fixed(kps)) + timeRow;
                else rows = levelRow + row('LINES', s.lines) + row('TETRIS RATE', `${tetrisRate}%`) + timeRow;
            } else {
                switch (mode) {
                    case 'off':
                        rows = '';
                        break;
                    case 'speed':
                        rows = levelRow + row('PPS', fixed(pps)) + row('APM', fixed(apm, 1)) + row('KPS', fixed(kps)) + timeRow;
                        break;
                    case 'efficiency':
                        rows = levelRow + row('APP', fixed(app, 3)) + row('KPP', fixed(kpp)) + row('FINESSE', `${fixed(finessePct, 1)}%`) + timeRow;
                        break;
                    case 'versus':
                        rows = levelRow + row('APM', fixed(apm, 1)) + row('PPS', fixed(pps)) + row('VS', fixed(vs)) + timeRow;
                        break;
                    default:
                        rows = levelRow + row('PIECES', s.pieces, `, ${fixed(pps)}/S`) + row('LINES', s.lines) + timeRow;
                }
            }
            setHtml(els.stats, 'stats', rows);

            const score = isOg ? String(s.primaryValue).padStart(6, '0') : Number(s.primaryValue).toLocaleString();
            setHtml(els.under, 'under',
                `<div class="under-value">${score}</div>` +
                `<div class="under-label">${s.primaryLabel}</div>`);

            setHtml(els.finesse, 'finesse', mode === 'off' || isOg ? '' :
                `<div class="stat-label">FINESSE</div>` +
                `<div class="stat-value">${s.finesseFaults}<span class="stat-sub">, ${fixed(finessePct)}%</span></div>` +
                `<div class="stat-small">${s.finesseFaults} FAULT${s.finesseFaults === 1 ? '' : 'S'}</div>`);

            if (els.meter) {
                const pct = `${Math.round(Math.max(0, Math.min(1, s.progress)) * 1000) / 10}%`;
                if (last.get('meter') !== pct) {
                    last.set('meter', pct);
                    els.meter.style.height = pct;
                }
            }
        },

        /** Clear the feed and cached text (new game). */
        reset() {
            last.clear();
            for (const el of Object.values(slots)) {
                el.classList.remove('show');
                el.innerHTML = '';
            }
        },
    };
}
