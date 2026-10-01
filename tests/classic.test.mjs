import {
    classicGravityFrames, classicGravityMs, calculateClassicScore, classicLevel, classicFirstLevelUp,
    classicLevelProgress, nextClassicPiece, fillClassicQueue, classicMatrix, getClassicSpawnPos,
    tryRotateClassic, NES_PALETTES, NES_BLOCK_ART, NES_BLOCK_KIND, NES_FRAME_MS,
} from '../js/classic.js';
import { collide, createMatrix } from '../js/board.js';
import { SHAPES, COLS, BUFFER_ROWS, VISIBLE_ROWS, tryRotate } from '../js/piece.js';
import { createModeState, getRules, MODE_INFO, GAME_STYLES } from '../js/modes.js';
import { normalizeSettings, DEFAULT_SETTINGS } from '../js/settings.js';

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

let clock = 0;
globalThis.performance = { now: () => clock };

// --- Gravity table (frames per row) ---
const frames = l => classicGravityFrames(l);
check('gravity: level 0 is 48 frames, level 8 is 8, level 9 is 6',
    frames(0) === 48 && frames(8) === 8 && frames(9) === 6);
check('gravity: levels 10-12 are 5, 13-15 are 4, 16-18 are 3',
    [10, 11, 12].every(l => frames(l) === 5) && [13, 14, 15].every(l => frames(l) === 4) && [16, 17, 18].every(l => frames(l) === 3));
check('gravity: levels 19-28 are 2 frames, 29 and up are 1',
    frames(19) === 2 && frames(28) === 2 && frames(29) === 1 && frames(99) === 1);
check('gravity never gets slower with level',
    Array.from({ length: 40 }, (_, l) => frames(l)).every((f, i, a) => i === 0 || f <= a[i - 1]));
check('frames are NTSC length', Math.abs(classicGravityMs(0) - 48 * 1000 / 60.0988) < 1e-9, `${classicGravityMs(0).toFixed(1)} ms`);

// --- Scoring: no T-spins, combos, back-to-back or perfect clear bonuses ---
const pts = (lines, level) => calculateClassicScore(lines, level).points;
check('line points are 40, 100, 300 and 1200 at level 0', pts(1, 0) === 40 && pts(2, 0) === 100 && pts(3, 0) === 300 && pts(4, 0) === 1200);
check('points multiply by level + 1', pts(4, 9) === 12000 && pts(1, 19) === 800 && pts(2, 5) === 600);
check('no lines is worth nothing', pts(0, 7) === 0 && !calculateClassicScore(0, 7).isClearAction);
{
    const r = calculateClassicScore(4, 0);
    check('a result has the shape the HUD and sounds expect',
        r.action === 'tetris' && r.actionName === 'TETRIS' && r.isClearAction && r.combo === 0 && !r.b2b && !r.perfectClear);
}

// --- Level progression ---
check('start level 0: levels up every 10 lines', classicLevel(9, 0) === 0 && classicLevel(10, 0) === 1 && classicLevel(99, 0) === 9 && classicLevel(100, 0) === 10);
check('first level up waits longer on high start levels',
    classicFirstLevelUp(0) === 10 && classicFirstLevelUp(5) === 60 && classicFirstLevelUp(9) === 100 &&
    classicFirstLevelUp(12) === 100 && classicFirstLevelUp(19) === 140);
check('start level 5: stays on 5 until 60 lines, then climbs every 10', classicLevel(59, 5) === 5 && classicLevel(60, 5) === 6 && classicLevel(70, 5) === 7);
check('progress meter runs 0 to 1 within each level', classicLevelProgress(0, 0) === 0 && classicLevelProgress(5, 0) === 0.5 && classicLevelProgress(14, 0) > 0.39 && classicLevelProgress(14, 0) < 0.41);

// --- Randomizer: one reroll on a repeat or the spare slot ---
{
    const seq = values => { let i = 0; return () => values[i++ % values.length]; };
    check('a repeat is rerolled once', nextClassicPiece('T', seq([0.01, 0.3])) === 'Z');
    check('the reroll can still repeat the piece', nextClassicPiece('T', seq([0.01, 0.01])) === 'T');
    check('the spare slot is rerolled', nextClassicPiece(null, seq([0.9, 0.99])) === 'I');
    const q = [];
    fillClassicQueue(q, 'T');
    check('the queue fills to 7 pieces of known shapes', q.length === 7 && q.every(p => p in SHAPES));
    let gaps = 0, last = null;
    for (let i = 0; i < 4000; i++) { const p = nextClassicPiece(last); if (p === last) gaps++; last = p; }
    check('repeats are rarer than the 1 in 7 of pure random', gaps / 4000 < 1 / 7, `${(gaps / 40).toFixed(1)}% repeats`);
}

// --- Spawn orientation, position and rotation ---
const cells = m => m.flatMap((row, y) => row.map((v, x) => (v ? `${x},${y}` : null)).filter(Boolean)).join(' ');
check('T spawns flat side up, stub down', cells(classicMatrix('T')) === '0,1 1,1 2,1 1,2');
check('J spawns with the hook below on the right, L below on the left',
    cells(classicMatrix('J')) === '0,1 1,1 2,1 2,2' && cells(classicMatrix('L')) === '0,1 1,1 2,1 0,2');
check('I, O, S and Z keep their usual spawn shapes',
    ['I', 'O', 'S', 'Z'].every(s => cells(classicMatrix(s)) === cells(SHAPES[s].matrix)));
for (const shape of Object.keys(SHAPES)) {
    const m = classicMatrix(shape);
    const pos = getClassicSpawnPos(m);
    const rows = m.map((r, y) => (r.some(Boolean) ? pos.y + y : null)).filter(v => v !== null);
    const xs = m.flatMap((r, y) => r.map((v, x) => (v ? pos.x + x : null)).filter(v => v !== null));
    const top = BUFFER_ROWS - VISIBLE_ROWS;
    check(`${shape} spawns inside the field on its first row, left of center`,
        Math.min(...rows) === top && Math.max(...rows) <= top + 1 && Math.min(...xs) >= 3 && Math.max(...xs) <= 6,
        `rows ${rows.join(',')} cols ${Math.min(...xs)}-${Math.max(...xs)}`);
}
{
    const arena = createMatrix(COLS, BUFFER_ROWS);
    const piece = shape => ({ shape, matrix: classicMatrix(shape), rotation: 0, pos: getClassicSpawnPos(classicMatrix(shape)) });
    const spins = (shape, dir, n) => {
        const p = piece(shape);
        const seen = [cells(p.matrix)];
        for (let i = 0; i < n; i++) { tryRotateClassic(p, arena, collide, dir); seen.push(cells(p.matrix)); }
        return seen;
    };
    for (const shape of ['T', 'J', 'L']) {
        const s = spins(shape, 1, 4);
        check(`${shape} has four orientations`, new Set(s.slice(0, 4)).size === 4 && s[4] === s[0]);
    }
    for (const shape of ['I', 'S', 'Z']) {
        const cw = spins(shape, 1, 2);
        const ccw = spins(shape, -1, 2);
        check(`${shape} flips between two orientations, either way`, cw[0] !== cw[1] && cw[2] === cw[0] && ccw[1] === cw[1] && ccw[2] === ccw[0]);
    }
    const o = piece('O');
    check('O does not rotate', !tryRotateClassic(o, arena, collide, 1).success);

    // Against the wall, SRS kicks the piece sideways; classic just refuses
    const wallI = () => {
        const p = piece('I');
        tryRotateClassic(p, arena, collide, 1);   // vertical, on column 5
        p.pos.x += 4;                              // slide to the right wall (column 9)
        return p;
    };
    const classicWall = wallI();
    check('classic rotation into a wall fails and leaves the piece alone',
        !tryRotateClassic(classicWall, arena, collide, 1).success && classicWall.rotation === 1);
    const srs = { shape: 'I', matrix: SHAPES.I.matrix, rotation: 0, pos: { x: 3, y: 20 } };
    tryRotate(srs, arena, collide, 1);
    srs.pos.x += 4;
    check('control: SRS kicks the same turn away from the wall', tryRotate(srs, arena, collide, 1).success);
}

// --- Rules and mode state ---
{
    const og = getRules('og');
    check('Classic rules: no hold, ghost or hard drop; no kicks; spawn inside; one next piece',
        !og.hold && !og.ghost && !og.hardDrop && og.rotation === 'classic' && og.spawn === 'inside' && og.previewCount === 1);
    check('Classic rules: classic scoring and none of the modern extras',
        og.scoring === 'classic' && !og.attack && !og.effects && !og.danger && !og.finesse && og.look === 'classic');
    for (const id of ['sprint', 'blitz', 'classic']) {
        const r = getRules(id);
        check(`${id} keeps the modern rules`, r.hold && r.ghost && r.hardDrop && r.rotation === 'srs' && r.scoring === 'modern' && r.look === 'modern');
    }
    check('Classic plays the chip track and has its own game style',
        MODE_INFO.og.music === 'chip' && GAME_STYLES.classic.lineClearDelay > 0 && GAME_STYLES.classic.entryDelay > 0);
    check('Casual keeps the id classic; Classic is og', MODE_INFO.classic.name === 'CASUAL' && MODE_INFO.og.name === 'CLASSIC');

    const m = createModeState('og', { startLevel: 0 });
    m.start();
    check('Classic starts on level 0 with level 0 gravity', m.stats.level === 0 && Math.abs(m.getDropInterval() - classicGravityMs(0)) < 1e-9);
    m.addLines(10);
    check('ten lines make level 1 and speed gravity up', m.stats.level === 1 && m.getDropInterval() < classicGravityMs(0));
    check('Classic never plays the intense playlist', MODE_INFO.og.music !== 'intense');
    m.addLines(90);
    check('level 10 after 100 lines', m.stats.level === 10, `level ${m.stats.level}`);
    m.reset();
    check('reset returns to the start level', m.stats.level === 0 && m.stats.linesCleared === 0);
    const high = createModeState('og', { startLevel: 12 });
    check('a chosen start level is used', high.stats.level === 12 && Math.abs(high.getDropInterval() - classicGravityMs(12)) < 1e-9);
    const casual = createModeState('classic');
    check('control: Casual still starts on level 1', casual.stats.level === 1);

    m.addTetris(); m.addTetris();
    m.addLines(16);
    check('results carry the tetris rate (2 tetrises in 16 lines is 50%)', Math.round(m.getResults().tetrisRate) === 50, `${m.getResults().tetrisRate.toFixed(1)}%`);
}

// --- Settings ---
{
    check('start level is clamped to 0-19', normalizeSettings({ classicStartLevel: 40 }).classicStartLevel === 19 && normalizeSettings({ classicStartLevel: -3 }).classicStartLevel === 0);
    check('defaults: start level 0, OG font, scenes cycle', DEFAULT_SETTINGS.classicStartLevel === 0 && DEFAULT_SETTINGS.classicFont === 'og' && DEFAULT_SETTINGS.classicScene === 'cycle');
    check('unknown scene and font fall back to the defaults',
        normalizeSettings({ classicScene: 'nope', classicFont: 'comic' }).classicScene === 'cycle' && normalizeSettings({ classicFont: 'comic' }).classicFont === 'og');
    check('the new scenes, font, pack and soundtrack are accepted',
        normalizeSettings({ classicScene: 'domes' }).classicScene === 'domes' && normalizeSettings({ classicFont: 'ulol' }).classicFont === 'ulol' &&
        normalizeSettings({ soundPack: 'nes' }).soundPack === 'nes' && normalizeSettings({ soundtrack: 'chip' }).soundtrack === 'chip');
}

// --- Block art ---
{
    check('ten level palettes of two colors', NES_PALETTES.length === 10 && NES_PALETTES.every(p => p.length === 2 && p.every(c => /^#[0-9a-f]{6}$/i.test(c))));
    check('no palette uses the same color twice', NES_PALETTES.every(([a, b]) => a !== b));
    for (const [kind, art] of Object.entries(NES_BLOCK_ART)) {
        check(`${kind} art is 8 x 8 using only known pixels`, art.length === 8 && art.every(r => r.length === 8 && /^[.W12]+$/.test(r)));
    }
    check('every piece has art', Object.keys(SHAPES).every(s => NES_BLOCK_KIND[s] in NES_BLOCK_ART));
    check('the frame time is NTSC', Math.abs(NES_FRAME_MS - 16.639) < 0.001);
}

console.log(failures ? `\n${failures} FAILED` : '\nAll classic checks passed');
process.exit(failures ? 1 : 0);
