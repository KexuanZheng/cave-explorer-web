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
    px = 0; py = 0; pgold = 0; gameOver = false; hasKey = false; goal = null;
    keyPos = -1; keySpawned = false;
    if (keyTimer) { clearInterval(keyTimer); keyTimer = null; }
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

console.log('[2] 巡逻节奏：低难度不动，中难度按时间移动');
run("diffKey = 'low'");
fresh();
run('world[5 * W + 5] = 3; initSnakeHomes(); startSnakeTimer();');
const posA = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
env.advance(3000);
const posA2 = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
check('低难度蛇原地不动', posA === posA2, `${posA} -> ${posA2}`);
run('stopSnakeTimer()');

run("diffKey = 'mid'");
fresh();
run('world[5 * W + 5] = 3; initSnakeHomes(); startSnakeTimer();');
const posB = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
env.advance(1600);
const posB2 = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
check('中难度蛇会动', posB !== posB2, `${posB} -> ${posB2}`);
check('蛇没有消失', run('world.map(v=>v===3).filter(Boolean).length') === 1);
run('stopSnakeTimer()');

console.log('[2b] 巡逻范围');
run("diffKey = 'mid'");
fresh();
run('world[10 * W + 10] = 3; initSnakeHomes();');
let far = 0;
for (let i = 0; i < 300; i++) {
  run('stepSnakes()');
  const pos = run('world.map((v,i)=>v===3?i:-1).filter(i=>i>=0)')[0];
  const x = pos % W, y = (pos / W) | 0;
  if (Math.abs(x - 10) + Math.abs(y - 10) > 4) far++;
}
check('蛇不会走出巡逻范围（中难度 4 步）', far === 0, String(far));

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
run("diffKey = 'high'");
fresh();
run('initWorld()'); // 用真实地图（高难度，蛇会移动）
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
run("diffKey = 'low'");
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
  run('world[1] = 2; pgold = 4;');
  press('d');                                       // 第 5 颗星 → 刷钥匙
  run('px = keyPos % W; py = (keyPos / W) | 0; checkNewMove();');   // 捡钥匙
  run('world[2] = 6; px = 2; py = 1; facing = { dx: 0, dy: -1 };');
  press('f');                                       // 开门
  winSeen.add(env.overlayMsg().split('\n')[0]);
}
check('胜利文案都来自预置列表', [...winSeen].every((t) => WIN.includes(t)), [...winSeen].join(' | '));
check('胜利文案会随机变化', winSeen.size >= 2, `${winSeen.size} 种`);

console.log('[8] 钥匙规则');
fresh();
run('world[1] = 2; pgold = 4; seen.fill(true);');
press('d');
check('集齐 5 颗会刷出钥匙', run('keySpawned') === true);
check('低难度钥匙在地图中央', run('keyPos') === 10 + 6 * W, String(run('keyPos')));
check('还没捡到钥匙', run('hasKey') === false);
run('world[2] = 6; px = 2; py = 1; facing = { dx: 0, dy: -1 };');
press('f');
check('没钥匙开不了门', run('gameOver') === false);
run('px = keyPos % W; py = (keyPos / W) | 0; checkNewMove();');
check('踩到钥匙就捡起来', run('hasKey') === true);
check('捡钥匙不算通关', run('gameOver') === false);
run('world[2] = 6; px = 2; py = 1; facing = { dx: 0, dy: -1 };');
press('f');
check('有钥匙开门通关', run('gameOver') === true);


console.log('[9] 蛇不会把星星/门围死');
run("diffKey = 'high'");
fresh();
run('world[5 * W + 5] = 2; world[15 * W + 5] = 2;');
run('world[3 * W + 3] = 3; world[10 * W + 10] = 3;');
run('initSnakeHomes();');
let tooClose = 0, goalClose = 0;
for (let i = 0; i < 400; i++) {
  run('stepSnakes()');
  const r = run(`(() => {
    const gold = [], snakes = [];
    for (let i = 0; i < W * H; i++) {
      if (world[i] === 2) gold.push(i);
      if (world[i] === 3) snakes.push(i);
    }
    let bad = 0;
    for (const a of gold) {
      for (const b of snakes) {
        const d = Math.abs((a % W) - (b % W)) + Math.abs(((a / W) | 0) - ((b / W) | 0));
        if (d <= 2) bad++;
      }
    }
    let badGoal = 0;
    for (const b of snakes) {
      const x = b % W, y = (b / W) | 0;
      for (const g of [GOAL_DOOR]) {
        const gx = g % W, gy = (g / W) | 0;
        if (Math.abs(x - gx) + Math.abs(y - gy) <= 2) badGoal++;
      }
    }
    return { bad, badGoal };
  })()`);
  tooClose += r.bad;
  goalClose += r.badGoal;
  if (run('gameOver')) break;
}
check('蛇从不进入星星周围 2 格', tooClose === 0, String(tooClose));
check('蛇从不进入门周围 2 格', goalClose === 0, String(goalClose));

console.log('[10] 难度锁定');
run("diffKey = 'low'");
fresh();
press('d');
check('开始计时', run('started') === true);
press('2');
check('游戏中按 2 不改难度', run('diffKey') === 'low', String(run('diffKey')));
press('3');
check('游戏中按 3 不改难度', run('diffKey') === 'low', String(run('diffKey')));

console.log('[11] 三档音乐（低=最初版，中/高各一首）');
const bpmL = run("DIFFS.low.bpm"), bpmM = run("DIFFS.mid.bpm"), bpmH = run("DIFFS.high.bpm");
check('三档速度各不相同', bpmL !== bpmM && bpmM !== bpmH && bpmL !== bpmH, `${bpmL}/${bpmM}/${bpmH}`);
check('低难度最慢', bpmL < bpmM && bpmL < bpmH, `${bpmL}/${bpmM}/${bpmH}`);

console.log('[12] 钥匙按难度刷新');
run("diffKey = 'low'");
fresh();
run('world[1] = 2; pgold = 4; seen.fill(true);');
press('d');
const centerCell = 10 + 6 * run('W');
check('低难度钥匙在正中', run('keyPos') === centerCell, String(run('keyPos')));
check('钥匙在可达格子上', run('bfsSafe(world).reach').includes(run('keyPos')) === true);

run("diffKey = 'mid'");
let centerCount = 0;
for (let i = 0; i < 20; i++) {
  fresh();
  run('world[1] = 2; pgold = 4;');
  press('d');
  if (run('keyPos') === centerCell) centerCount++;
}
check('中难度钥匙随机刷新', centerCount < 20, `${centerCount}/20 在正中`);

// 只点亮出生点周围时，钥匙也只会出现在已点亮的格子上
run("diffKey = 'mid'");
fresh();
run('world[1] = 2; pgold = 4;');
press('d');
check('钥匙只刷在已点亮的格子上', run('seen[keyPos]') === true, String(run('keyPos')));

run("diffKey = 'high'");
fresh();
run('world[1] = 2; pgold = 4;');
press('d');
const k0 = run('keyPos');
env.advance(1700);
const k1 = run('keyPos');
check('高难度钥匙会移动', k0 !== k1, `${k0} -> ${k1}`);
const kx0 = k0 % run('W'), ky0 = (k0 / run('W')) | 0;
const kx1 = k1 % run('W'), ky1 = (k1 / run('W')) | 0;
const stepDist = Math.abs(kx0 - kx1) + Math.abs(ky0 - ky1);
check('钥匙是一格一格走（不是瞬移）', stepDist === 1, `${k0} -> ${k1} 距离 ${stepDist}`);
check('移动后仍在已点亮的地方', run('seen[keyPos]') === true);
check('移动后仍然可达', run('bfsSafe(world).reach').includes(k1) === true);
run('stopKeyTimer()');

console.log('[13] 个人纪录');
run("diffKey = 'low'");
run('bests = {};');
check('第一次通关会记录', run('recordWin(5000)') === true);
check('更慢的成绩不覆盖', run('recordWin(8000)') === false);
check('更快的成绩会覆盖', run('recordWin(3000)') === true);
check('纪录值 = 3000', run('bests.low') === 3000, String(run('bests.low')));
run('bests = {};');
fresh();
run('world[1] = 2; pgold = 4; seen.fill(true);');
press('d');
run('px = keyPos % W; py = (keyPos / W) | 0; checkNewMove();');
run('world[2] = 6; px = 2; py = 1; facing = { dx: 0, dy: -1 };');
press('f');
check('真通关后纪录写入 bests', typeof run('bests.low') === 'number', String(run('bests.low')));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
