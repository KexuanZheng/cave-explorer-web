// 诱饵木墙 / 巡逻蛇 / 音效 的测试
const path = require('path');
const { makeEnv } = require('./stub');

const env = makeEnv(path.join(__dirname, '..', 'v2', 'game.js'));
const { run, press, el } = env;

const W = 20, H = 12;
const idx = (x, y) => y * W + x;

function fresh() {
  run(`
    world = new Array(W * H).fill(0);
    seen = new Array(W * H).fill(false);
    px = 0; py = 0; pgold = 0; gameOver = false;
    hammerUses = 3; facing = { dx: 1, dy: 0 }; stopSnakeTimer(); stopSnakeTimer();
    lastVault = null;
    seeAround(0, 0);
    resetTimer();
    render();
  `);
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('[1] 诱饵木墙');
const world = run('generateWorld(DIFFS.high)');
const vault = run('lastVault');
const ringSet = new Set(vault.rings.flat());
const decoyCells = [];
for (let i = 0; i < W * H; i++) if (world[i] === 4 && !ringSet.has(i)) decoyCells.push(i);
check('金库之外还有木墙（诱饵）', decoyCells.length > 0, String(decoyCells.length));
check('诱饵数量合理（≥6 格）', decoyCells.length >= 6, String(decoyCells.length));
check('诱饵离金库有距离', decoyCells.every((i) => {
  const x = i % W, y = (i / W) | 0;
  return !(x >= vault.box.x0 - 2 && x <= vault.box.x1 + 2 && y >= vault.box.y0 - 2 && y <= vault.box.y1 + 2);
}));

console.log('[2] 巡逻蛇：按固定时间移动（与玩家走不走无关）');
fresh();
run('world[5 * W + 5] = 3; startSnakeTimer();'); // 蛇在 (5,5)，启动定时器
const pos0 = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
env.advance(1300); // 时间过去，触发蛇的定时器（玩家一步没走）
const pos1 = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
check('不按键蛇也会动', pos0 !== pos1, `${pos0} -> ${pos1}`);
check('蛇没有消失', run('world.map(v=>v===3).filter(Boolean).length') === 1);
run('stopSnakeTimer()');

console.log('[3] 蛇的走位与玩家位置无关');
function seed(n) {
  run(`(function(){ let s = ${n}; Math.random = function(){ s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })()`);
}

fresh();
run('world[2 * W + 2] = 3;');
seed(7);
run('px = 0; py = 0; stepSnakes();');
const pathA = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];

fresh();
seed(7); // 同一串随机数
run('world[2 * W + 2] = 3; px = 15; py = 8; stepSnakes();');
const pathB = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
check('玩家站在不同位置，蛇的走法完全相同', pathA === pathB, `${pathA} vs ${pathB}`);

console.log('[3b] 蛇巡逻会咬人（不再躲玩家）');
fresh();
// 蛇被墙困在 (1,0)，紧挨着玩家 (0,0)：它要么撞到玩家，要么原地不动，两种情况都该判负
run('world[1] = 3; world[2] = 1; world[W + 1] = 1; px = 0; py = 0; stepSnakes();');
check('贴到玩家就判负', run('gameOver') === true);

console.log('[4] 蛇不会走进金库');
fresh();
const w2 = run('generateWorld(DIFFS.high)');
run('initWorld()'); // 用真实地图
let insideVault = 0;
for (let i = 0; i < 80; i++) {
  press(['d', 's', 'a', 'w'][i % 4]);
  env.advance(900); // 让蛇也动起来
  if (run('gameOver')) { run('gameOver = false'); }
  const v = run('lastVault');
  const pos = run('world.map((x,i)=>x===3?i:-1).filter(i=>i>=0)');
  for (const s of pos) {
    const x = s % W, y = (s / W) | 0;
    if (v && x >= v.box.x0 && x <= v.box.x1 && y >= v.box.y0 && y <= v.box.y1) insideVault++;
  }
}
check('蛇没有进入金库范围', insideVault === 0, String(insideVault));

console.log('[5] 音效（Node 环境下应静默不报错）');
check('播放音效不抛错', run('(Sfx.eat(), Sfx.breakWall(), Sfx.win(), Sfx.lose(), true)') === true);
check('不存在静音开关', run('typeof Sfx.toggleMute') === 'undefined');
check('按键 M 不再触发任何逻辑', (press('m'), run('Sfx.eat(), true')) === true);

console.log('[6] 出生点安全区');
fresh();
run('world[3] = 3;'); // 蛇在 (3,0)，离出生点 3 格
let entered = 0;
for (let i = 0; i < 400 && !run('gameOver'); i++) {
  run('stepSnakes()');
  const pos = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)');
  for (const sp of pos) {
    const x = sp % W, y = (sp / W) | 0;
    if (x <= 2 && y <= 2) entered++;
  }
}
check('蛇从不进入出生点安全区', entered === 0, String(entered));
check('站在出生点不会被咬', run('gameOver') === false);

let badSpawn = 0;
for (let k = 0; k < 40; k++) {
  const w = run("generateWorld(DIFFS['high'])");
  for (let y = 0; y <= 2; y++) {
    for (let x = 0; x <= 2; x++) if (w[y * W + x] === 3) badSpawn++;
  }
}
check('生成时蛇也不在安全区', badSpawn === 0, String(badSpawn));

console.log('[7] 结算文案随机');
const LOSE = run('LOSE_TEXTS');
const WIN = run('WIN_TEXTS');
check('失败文案 4 条', LOSE.length === 4, String(LOSE.length));
check('胜利文案 4 条', WIN.length === 4, String(WIN.length));

const loseSeen = new Set();
for (let i = 0; i < 40; i++) {
  fresh();
  run('world[1] = 3;');
  press('d');
  loseSeen.add(env.overlayMsg().split('\n')[0]);
}
check('失败文案都来自预置列表', [...loseSeen].every((t) => LOSE.includes(t)), [...loseSeen].join(' | '));
check('失败文案会随机变化', loseSeen.size >= 2, `${loseSeen.size} 种`);

const winSeen = new Set();
for (let i = 0; i < 40; i++) {
  fresh();
  run('px = 0; py = 0; pgold = 4; world[1] = 2;');
  press('d');
  winSeen.add(env.overlayMsg().split('\n')[0]);
}
check('胜利文案都来自预置列表', [...winSeen].every((t) => WIN.includes(t)), [...winSeen].join(' | '));
check('胜利文案会随机变化', winSeen.size >= 2, `${winSeen.size} 种`);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
