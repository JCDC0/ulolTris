import { createDemo, landing, COLS, ROWS, KINDS } from '../js/scenes/neon-demo.js';

let failures = 0;
function check(name, cond, detail) {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
    if (!cond) failures++;
}

const at = (x, y) => y * COLS + x;

// The show is replayed piece by piece on a real board: every piece must land exactly where
// it was planned, every Tetris must clear exactly four rows, and the board must end empty.
for (const seed of [9, 10, 11]) {
    const demo = createDemo(seed, 6);
    const problems = [];
    let board = new Uint8Array(COLS * ROWS);
    let cleared = 0;
    for (const m of demo.moves) {
        const cells = m.o.cells;
        if (!cells.every(([dx, dy]) => m.x + dx >= 0 && m.x + dx < COLS && m.y + dy >= 0 && m.y + dy < ROWS)) problems.push(`${m.kind} outside the board`);
        if (landing(board, cells, m.x) !== m.y) problems.push(`cycle ${m.cycle} ${m.role} ${m.kind}: lands on row ${landing(board, cells, m.x)}, planned ${m.y}`);
        if (m.before.some((v, i) => v !== board[i])) problems.push(`cycle ${m.cycle}: snapshot does not match the replay`);
        for (const [dx, dy] of cells) board[at(m.x + dx, m.y + dy)] = KINDS.indexOf(m.kind) + 1;
        if (m.role === 'well') {
            const full = [];
            for (let y = 0; y < ROWS; y++) if (Array.from({ length: COLS }, (_, x) => board[at(x, y)]).every(Boolean)) full.push(y);
            if (full.join() !== '16,17,18,19') problems.push(`cycle ${m.cycle}: cleared rows ${full.join(',') || 'none'}, not a Tetris`);
            cleared += full.length;
            const next = new Uint8Array(COLS * ROWS);
            for (let y = 0; y < 16; y++) for (let x = 0; x < COLS; x++) next[at(x, y + 4)] = board[at(x, y)];
            board = next;
            if (board.some((v, i) => v !== demo.cycles[m.cycle].nextLeft[i])) problems.push(`cycle ${m.cycle}: what falls does not match the plan`);
        }
    }
    check(`seed ${seed}: every piece lands where planned and every cycle is a Tetris`, problems.length === 0, problems.slice(0, 3).join('; '));
    check(`seed ${seed}: the board is empty again when the loop restarts`, board.every(v => v === 0) && cleared === 24);
    check(`seed ${seed}: something is left on top to fall in every cycle but the last`,
        demo.cycles.slice(0, -1).every(c => c.toppers.length > 0) && demo.cycles.at(-1).toppers.length === 0);
    check(`seed ${seed}: a period of about a minute`, demo.period > 40 && demo.period < 120, `${demo.period.toFixed(1)} s`);
}

// Frames: sane at every moment, including across the loop
{
    const demo = createDemo(9, 6);
    const problems = [];
    for (let t = 0; t < demo.period * 2.05; t += 0.033) {
        const f = demo.frame(t);
        if (f.cells.length > 200) problems.push(`${t.toFixed(2)}: ${f.cells.length} cells`);
        for (const c of f.cells) {
            if (!(c.x >= 0 && c.x < COLS && c.y >= -0.01 && c.y < ROWS + 0.01 && c.k >= 0 && c.k < 7)) problems.push(`${t.toFixed(2)}: cell ${JSON.stringify(c)}`);
        }
        if (f.piece && !f.piece.cells.every(([x, y]) => x >= 0 && x < COLS && y >= -0.01 && y < ROWS)) problems.push(`${t.toFixed(2)}: piece outside`);
        for (const s of f.sparks) if (!Number.isFinite(s.x + s.y + s.a)) problems.push(`${t.toFixed(2)}: spark`);
        if (!(f.title >= 0 && f.title <= 1) || !Number.isFinite(f.score)) problems.push(`${t.toFixed(2)}: hud`);
        if (problems.length > 4) break;
    }
    check('frames are well formed for two full loops', problems.length === 0, problems.slice(0, 3).join('; '));

    const first = demo.frame(0.05), later = demo.frame(demo.period + 0.05);
    check('lines, level and score keep counting across loops', later.lines > first.lines && later.score > first.score,
        `${first.lines} lines then ${later.lines}`);
    check('the board is empty at the start of every loop', demo.frame(demo.period - 0.05).cells.length === 0 && demo.frame(demo.period + 0.001).cells.length === 0);

    // At the moment of the Tetris four rows are flashing; afterwards they are gone
    const well = demo.moves.find(m => m.role === 'well' && demo.cycles[m.cycle].toppers.length > 0);
    const during = demo.frame(well.lockAt + 0.13);
    const afterwards = demo.frame(well.clear.collapseEnd + 0.05);
    check('a Tetris flashes exactly four full rows', during.cells.filter(c => c.flash).length === 4 * COLS, `${during.cells.filter(c => c.flash).length} flashing cells`);
    check('a Tetris shows the banner, then leaves only what was on top, fallen four rows',
        during.title > 0.9 && afterwards.cells.length === demo.cycles[well.cycle].toppers.length * 4 && afterwards.cells.every(c => c.y >= 14),
        `${afterwards.cells.length} cells left`);
    check('sparks fly from the cleared rows', demo.frame(well.clear.burstAt + 0.2).sparks.length > 40);
}

// Events: every piece makes its sounds, in order, inside the period, and each Tetris is announced
{
    const demo = createDemo(9, 6);
    const all = demo.events(0, demo.period);
    check('sound events are in order and inside the period', all.every((e, i) => e.t >= 0 && e.t <= demo.period && (i === 0 || e.t >= all[i - 1].t)));
    check('one lock per piece and one fanfare per cycle',
        all.filter(e => e.kind === 'lock').length === demo.moves.length && all.filter(e => e.kind === 'tetris').length === 6);
    const twice = demo.events(0, demo.period * 2);
    check('events repeat every loop', twice.length === all.length * 2 - 0 || Math.abs(twice.length - all.length * 2) <= 1, `${all.length} then ${twice.length}`);
    check('a span with no time in it has no events', demo.events(3, 3).length === 0);
}

check('the same seed gives the same show', createDemo(9, 6).period === createDemo(9, 6).period);

console.log(failures ? `\n${failures} FAILED` : '\nAll neon checks passed');
process.exit(failures ? 1 : 0);
