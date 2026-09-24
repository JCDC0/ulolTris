/**
 * particles.js - Particles and screen shake drawn on the board canvas.
 *
 * Coordinates are in field pixels: x from the left wall, y from the top of the visible
 * field (negative y is the spawn area above it). Three settings scale the effects
 * independently: placeImpact (locking a piece), clearEffects (line clears and bonuses)
 * and screenShake. Attack orbs always show, because they report the attack.
 */

import { BLOCK_SIZE, VISIBLE_ROWS, BUFFER_ROWS, SHAPES } from './piece.js';
import { effectLevel } from './settings.js';

const FIELD_W = 10 * BLOCK_SIZE;
const BOARD_OFFSET_Y = BUFFER_ROWS - VISIBLE_ROWS;

function rowToY(row) {
    return (row - BOARD_OFFSET_Y) * BLOCK_SIZE;
}

/**
 * Create a particle system.
 *
 * @param {Object} settings - Settings reference (read live)
 */
export function createParticleSystem(settings) {
    const particles = [];
    let shakeX = 0;
    let shakeY = 0;
    let shakeDecay = 0;
    let shakeIntensity = 0;

    const place = () => effectLevel(settings, 'placeImpact');
    const clearFx = () => effectLevel(settings, 'clearEffects');

    function add(p) {
        p.maxLife = p.life;
        particles.push(p);
    }

    function triggerShake(intensity) {
        const mul = effectLevel(settings, 'screenShake');
        if (mul === 0) return;
        shakeIntensity = Math.max(shakeIntensity * (shakeDecay / 200), intensity * mul);
        shakeDecay = 200;
    }

    /**
     * Effects for a piece locking: a trail from where a hard drop started, a white flash
     * on the landed cells, and dust puffing out from under the piece.
     *
     * @param {Object} piece - { shape, matrix, pos }
     * @param {number} [dropRows] - rows fallen in a hard drop (0 for a normal lock)
     */
    function spawnPlacement(piece, dropRows = 0) {
        const mul = place();
        if (mul === 0) return;

        const color = SHAPES[piece.shape].color;
        const cells = [];
        piece.matrix.forEach((row, y) => row.forEach((v, x) => {
            if (v) cells.push({ x: x + piece.pos.x, y: y + piece.pos.y });
        }));

        for (const c of cells) {
            add({ type: 'cell', x: c.x * BLOCK_SIZE, y: rowToY(c.y), life: 140, color: '#ffffff' });
        }

        if (dropRows > 0) {
            const columns = new Map();
            for (const c of cells) columns.set(c.x, Math.min(columns.get(c.x) ?? Infinity, c.y));
            for (const [x, topRow] of columns) {
                const bottom = rowToY(topRow);
                const length = Math.min(dropRows, 12) * BLOCK_SIZE;
                add({ type: 'trail', x: x * BLOCK_SIZE, y: bottom - length, h: length, life: 180, color });
            }
        }

        // Dust from the bottom edge of each lowest cell
        const lowest = new Map();
        for (const c of cells) lowest.set(c.x, Math.max(lowest.get(c.x) ?? -Infinity, c.y));
        const puffs = Math.round((dropRows > 0 ? 3 : 1) * mul);
        for (const [x, row] of lowest) {
            for (let i = 0; i < puffs; i++) {
                const dir = Math.random() < 0.5 ? -1 : 1;
                add({
                    type: 'square',
                    x: x * BLOCK_SIZE + BLOCK_SIZE / 2 + dir * Math.random() * BLOCK_SIZE / 2,
                    y: rowToY(row) + BLOCK_SIZE,
                    vx: dir * (0.05 + Math.random() * 0.12),
                    vy: -0.05 - Math.random() * 0.1,
                    gravity: 0.0004,
                    life: 260 + Math.random() * 200,
                    size: 2 + Math.random() * 3,
                    color: Math.random() < 0.5 ? color : '#d8d8e8',
                });
            }
        }

        if (dropRows > 0) triggerShake(Math.min(1 + dropRows * 0.15, 3.5));
    }

    /**
     * Line clear burst in each cleared row, colored by the blocks that were there.
     */
    function spawnLineClear(clearedRows, clearType, arenaSnapshot) {
        const mul = clearFx();
        const isQuad = clearType === 'tetris';
        const isTSpin = clearType && clearType.startsWith('tspin');
        const intensity = isQuad ? 2.2 : isTSpin ? 1.8 : 1;

        if (mul > 0) {
            for (const rowY of clearedRows) {
                const y = rowToY(rowY) + BLOCK_SIZE / 2;
                add({ type: 'row', x: 0, y: y - BLOCK_SIZE / 2, life: 220, color: '#ffffff' });
                for (let col = 0; col < 10; col++) {
                    const cellShape = arenaSnapshot?.[rowY]?.[col];
                    const color = SHAPES[cellShape]?.color || '#ffffff';
                    const count = Math.floor((2 + Math.random() * 3) * mul * intensity);
                    for (let i = 0; i < count; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 0.15 + Math.random() * 0.45 * intensity;
                        add({
                            type: 'square',
                            x: col * BLOCK_SIZE + BLOCK_SIZE / 2,
                            y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 0.15,
                            gravity: 0.0012,
                            life: 300 + Math.random() * 400,
                            size: 2 + Math.random() * 4,
                            color,
                        });
                    }
                }
            }
            if (isQuad) {
                const mid = clearedRows.reduce((s, r) => s + r, 0) / clearedRows.length;
                add({ type: 'flash', x: 0, y: rowToY(mid) - BLOCK_SIZE * 2, h: BLOCK_SIZE * 5, life: 220, color: SHAPES.I.color });
            }
        }

        const shake = isQuad ? 8 : isTSpin ? 6 : clearedRows.length >= 2 ? 3 : 1.5;
        triggerShake(shake);
    }

    /** Spiral burst around a T-spin. */
    function spawnTSpin(playerPos) {
        const mul = clearFx();
        if (mul === 0) return;
        const cx = (playerPos.x + 1.5) * BLOCK_SIZE;
        const cy = rowToY(playerPos.y) + 1.5 * BLOCK_SIZE;
        const count = Math.floor(30 * mul);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 4 + Math.random() * 0.3;
            const speed = 0.3 + Math.random() * 0.5;
            add({
                type: 'circle', x: cx, y: cy,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 0.0008,
                life: 400 + Math.random() * 300, size: 3 + Math.random() * 4, color: SHAPES.T.color,
            });
        }
    }

    /**
     * Attack orbs from the cleared rows out through the right wall (toward an opponent),
     * one per line sent (up to 10). They stay below the spawn area so they never hide
     * the next piece.
     */
    function spawnAttack(clearedRows, lines) {
        const midRow = clearedRows[Math.floor(clearedRows.length / 2)];
        const startY = rowToY(midRow) + BLOCK_SIZE / 2;
        const color = lines >= 4 ? '#ff4d6d' : '#ffb347';
        const count = Math.min(lines, 10);
        for (let i = 0; i < count; i++) {
            add({
                type: 'orb',
                sx: (3 + Math.random() * 4) * BLOCK_SIZE,
                sy: startY + (Math.random() - 0.5) * BLOCK_SIZE,
                tx: FIELD_W + 14,
                ty: Math.max(60, startY - 140),
                x: 0, y: 0,
                life: 450 + i * 45,
                size: 8 + Math.min(lines, 6),
                color,
            });
        }
        triggerShake(lines >= 4 ? 8 : 4);
    }

    /** Gold sparkles rising from the cleared rows. */
    function spawnB2B(clearedRows) {
        const mul = clearFx();
        if (mul === 0) return;
        for (const rowY of clearedRows) {
            const y = rowToY(rowY) + BLOCK_SIZE / 2;
            const count = Math.floor(15 * mul);
            for (let i = 0; i < count; i++) {
                add({
                    type: 'circle',
                    x: Math.random() * FIELD_W, y: y + (Math.random() - 0.5) * BLOCK_SIZE * 2,
                    vx: (Math.random() - 0.5) * 0.3, vy: -0.15 - Math.random() * 0.2, gravity: 0.0006,
                    life: 250 + Math.random() * 250, size: 2 + Math.random() * 3, color: '#ffd700',
                });
            }
        }
    }

    /** Full-field flash and confetti rain. */
    function spawnPerfectClear() {
        const mul = clearFx();
        if (mul > 0) {
            add({ type: 'flash', x: 0, y: 0, h: VISIBLE_ROWS * BLOCK_SIZE, life: 400, color: '#ffffff' });
            const colors = Object.values(SHAPES).map(s => s.color);
            const count = Math.floor(80 * mul);
            for (let i = 0; i < count; i++) {
                add({
                    type: 'circle',
                    x: Math.random() * FIELD_W, y: -Math.random() * 100,
                    vx: (Math.random() - 0.5) * 0.2, vy: 0.2 + Math.random() * 0.3, gravity: 0.0004,
                    life: 600 + Math.random() * 800, size: 2 + Math.random() * 4,
                    color: colors[Math.floor(Math.random() * colors.length)],
                });
            }
        }
        triggerShake(10);
    }

    function update(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.type === 'orb') {
                // Ease out toward the target, arcing up
                const k = 1 - Math.max(0, p.life) / p.maxLife;
                const e = 1 - Math.pow(1 - k, 3);
                p.x = p.sx + (p.tx - p.sx) * e;
                p.y = p.sy + (p.ty - p.sy) * e - Math.sin(k * Math.PI) * 30;
            } else if (p.vx !== undefined) {
                p.vy += (p.gravity ?? 0.0012) * dt;
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
                case 'cell':
                    ctx.globalAlpha = alpha * 0.7;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, BLOCK_SIZE, BLOCK_SIZE);
                    break;
                case 'trail': {
                    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
                    g.addColorStop(0, 'rgba(255,255,255,0)');
                    g.addColorStop(1, p.color);
                    ctx.globalAlpha = alpha * 0.45;
                    ctx.fillStyle = g;
                    ctx.fillRect(p.x + 4, p.y, BLOCK_SIZE - 8, p.h);
                    break;
                }
                case 'row':
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, FIELD_W, BLOCK_SIZE);
                    break;
                case 'flash':
                    ctx.globalAlpha = alpha * 0.3;
                    ctx.fillStyle = p.color;
                    ctx.fillRect(p.x, p.y, FIELD_W, p.h);
                    break;
                case 'orb': {
                    const k = 1 - alpha;
                    ctx.globalAlpha = k < 0.85 ? 1 : (1 - k) / 0.15;
                    ctx.fillStyle = '#ffffff';
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
                case 'circle':
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
        },
    };
}
