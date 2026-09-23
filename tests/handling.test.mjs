import { createInputHandler } from '../js/input.js';
import { DEFAULT_SETTINGS, normalizeSettings, SDF_INFINITE } from '../js/settings.js';

const F = 1000 / 60;
let clock = 0;
const handlers = {};
globalThis.performance = { now: () => clock };
globalThis.document = { addEventListener: (t, f) => (handlers[t] = f), removeEventListener() {} };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
const key = (type, code) => handlers[type]({ code, repeat: false, preventDefault() {} });

let failures = 0;
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!cond) failures++;
}

function rig(overrides = {}, gravity = 1000) {
  clock = 0;
  const settings = { ...DEFAULT_SETTINGS, ...overrides };
  const log = [];
  const input = createInputHandler(settings, {
    onMove: (dir, cells) => { log.push({ t: clock, kind: 'move', dir, cells }); return 1; },
    onSoftDrop: (cells) => { log.push({ t: clock, kind: 'drop', cells }); return 1; },
    getGravityInterval: () => gravity,
  });
  const runFrames = (n) => { for (let i = 0; i < n; i++) { clock += F; input.update(clock); } };
  return { settings, log, input, runFrames };
}
const frameOf = (t) => Math.round(t / F);

// 1. Tap moves once immediately
{
  const r = rig();
  key('keydown', 'ArrowRight');
  check('tap moves 1 cell on press', r.log.length === 1 && r.log[0].cells === 1 && r.log[0].t === 0);
}

// 2. DAS 10F, ARR 2F: first auto-shift on frame 10, then every 2 frames
{
  const r = rig({ das: 10, arr: 2, dcd: 0 });
  key('keydown', 'ArrowRight');
  r.runFrames(20);
  const auto = r.log.slice(1).map(e => frameOf(e.t));
  check('DAS 10F: first auto-shift at frame 10', auto[0] === 10, 'frames ' + auto.join(','));
  check('ARR 2F: then every 2 frames', auto.join(',') === '10,12,14,16,18,20');
}

// 3. ARR 0 teleports to the wall once DAS is charged
{
  const r = rig({ das: 10, arr: 0, dcd: 0 });
  key('keydown', 'ArrowLeft');
  r.runFrames(9);
  check('ARR 0: nothing before DAS', r.log.length === 1);
  r.runFrames(1);
  check('ARR 0: shift to wall (Infinity) at DAS', r.log[1]?.cells === Infinity && frameOf(r.log[1].t) === 10);
}

// 4. DCD pauses a charged DAS after rotate/spawn
{
  const r = rig({ das: 10, arr: 0, dcd: 5 });
  key('keydown', 'ArrowLeft');
  r.runFrames(12);
  const before = r.log.length;
  r.input.cutDas();
  r.runFrames(5);
  check('DCD 5F: no auto-shift during the cut', r.log.length === before, `${r.log.length - before} moves`);
  r.runFrames(1);
  check('DCD 5F: DAS resumes right after the cut', r.log.length === before + 1);
}
{
  const r = rig({ das: 10, arr: 0, dcd: 0 });
  key('keydown', 'ArrowLeft');
  r.runFrames(12);
  const before = r.log.length;
  r.input.cutDas();
  r.runFrames(1);
  check('DCD 0: off, charged DAS acts on the next frame', r.log.length === before + 1);
}

// 5. Direction change keeps the charge by default
{
  const r = rig({ das: 10, arr: 2, dcd: 0 });
  key('keydown', 'ArrowRight');
  r.runFrames(15);
  key('keydown', 'ArrowLeft');
  const pressIdx = r.log.length - 1;
  r.runFrames(2);
  const lefts = r.log.slice(pressIdx + 1).filter(e => e.dir === -1);
  check('switch direction: charge carries over', r.log[pressIdx].dir === -1 && lefts.length >= 1);
}
{
  const r = rig({ das: 10, arr: 2, dcd: 0, cancelDasOnDirectionChange: true });
  key('keydown', 'ArrowRight');
  r.runFrames(15);
  key('keydown', 'ArrowLeft');
  const pressIdx = r.log.length - 1;
  r.runFrames(9);
  check('cancel DAS on turn: charge resets', r.log.length - 1 === pressIdx);
}
// releasing the newer key falls back to the older held key
{
  const r = rig({ das: 10, arr: 2, dcd: 0 });
  key('keydown', 'ArrowRight');
  key('keydown', 'ArrowLeft');
  key('keyup', 'ArrowLeft');
  check('release newer key: falls back to held direction', r.log.at(-1).dir === 1);
}

// 6. SDF is a gravity multiplier
{
  const r = rig({ sdf: 6 }, 1000);
  key('keydown', 'ArrowDown');
  r.runFrames(60);
  const cells = r.log.filter(e => e.kind === 'drop').reduce((a, e) => a + e.cells, 0);
  check('SDF 6X at 1000ms gravity: 6 cells per second', cells === 6, `${cells} cells`);
}
{
  const r = rig({ sdf: 20 }, 500);
  key('keydown', 'ArrowDown');
  r.runFrames(60);
  const cells = r.log.filter(e => e.kind === 'drop').reduce((a, e) => a + e.cells, 0);
  check('SDF 20X at 500ms gravity: 40 cells per second', cells === 40, `${cells} cells`);
}
{
  const r = rig({ sdf: SDF_INFINITE });
  key('keydown', 'ArrowDown');
  r.runFrames(1);
  check('SDF infinite: floor in one frame', r.log.at(-1).kind === 'drop' && r.log.at(-1).cells === Infinity);
}

// 7. Prefer soft drop orders soft drop before movement within a frame
{
  const r = rig({ das: 1, arr: 0, dcd: 0, sdf: SDF_INFINITE, preferSoftDrop: true });
  key('keydown', 'ArrowDown');
  key('keydown', 'ArrowRight');
  r.runFrames(1);
  const frame = r.log.slice(1).map(e => e.kind).join(',');
  check('prefer soft drop: drop runs before shift', frame === 'drop,move', frame);
}

// 8. Old millisecond settings migrate to frames
{
  const s = normalizeSettings({ arr: 35, das: 120, dcd: 70, sdf: 45 });
  check('migration: ms to frames', s.arr === 2.1 && s.das === 7.2 && s.dcd === 4.2 && s.sdf === 6,
    `arr ${s.arr}F das ${s.das}F dcd ${s.dcd}F sdf ${s.sdf}X`);
  const t = normalizeSettings({ version: 2, arr: 0, das: 6, dcd: 0, sdf: 41 });
  check('version 2 settings load unchanged', t.arr === 0 && t.das === 6 && t.dcd === 0 && t.sdf === 41);
}

console.log(failures ? `\n${failures} FAILED` : '\nAll handling checks passed');
process.exit(failures ? 1 : 0);
