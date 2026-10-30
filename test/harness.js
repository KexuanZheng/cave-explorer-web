// 计时 / 重开 / 难度 的行为测试
const path = require('path');
const { makeEnv } = require('./stub');

const env = makeEnv(path.join(__dirname, '..', 'v2', 'game.js'));
const { run, press, el, timerText, overlayShown } = env;

function fresh() {
  run(`
    world = new Array(W * H).fill(0);
    seen = new Array(W * H).fill(false);
    px = 0; py = 0; pgold = 0; gameOver = false; hasKey = false; goal = null;
    keyPos = -1; keySpawned = false; lastVault = null;
    if (keyTimer) { clearInterval(keyTimer); keyTimer = null; }
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

console.log('[1] 初始状态');
fresh();
check('计时显示 0.0 s', timerText() === '0.0 s', timerText());
check('未开始计时', run('started') === false);
check('金币显示 0', el('gold').innerText === '0');

console.log('[2] 撞墙 / 出界不算“开始移动”');
fresh();
run('world[1] = 1;');
press('d');
check('撞墙不移动', run('px') === 0);
check('计时未启动', run('started') === false);
fresh();
press('a'); // 出生点在左边界
check('出界不移动', run('px') === 0 && run('py') === 0);
check('计时未启动', run('started') === false);

console.log('[3] 第一次成功移动后开始计时');
fresh();
press('d');
check('向右移动成功', run('px') === 1);
check('计时已启动', run('started') === true);
env.advance(1500);
check('1.5 s 后显示 1.5 s', timerText() === '1.5 s', timerText());
env.advance(900);
check('2.4 s 后显示 2.4 s', timerText() === '2.4 s', timerText());

console.log('[4] 胜利时冻结时间并显示用时');
fresh();
run('world[1] = 2; pgold = 4; seen.fill(true); render();'); // 右边一颗星（第 5 颗），并点亮全图
press('d');                                 // 吃掉 → 叮铃 + 刷钥匙（计时从此开始）
env.advance(2000);
check('集齐 5 颗会刷出钥匙', run('keySpawned') === true);
check('低难度钥匙在地图正中', run('keyPos') === 10 + 6 * run('W'), String(run('keyPos')));
check('还没捡到钥匙', run('hasKey') === false);

run('world[2] = 6; px = 2; py = 1; facing = { dx: 0, dy: -1 };');
press('f');
check('没钥匙开不了门', run('gameOver') === false);

run('px = keyPos % W; py = (keyPos / W) | 0; checkNewMove();'); // 踩到钥匙
check('捡到钥匙', run('hasKey') === true);
check('捡钥匙不算通关', run('gameOver') === false);

run('world[2] = 6; px = 2; py = 1; facing = { dx: 0, dy: -1 };');
press('f');
check('gameOver = true', run('gameOver') === true);
check('计时已冻结', run('finished') === true);
check('冻结值 = 2000 ms', Math.abs(run('elapsedMs') - 2000) < 1e-6, String(run('elapsedMs')));
check('浮层已显示', overlayShown());
check('标题是胜利', /恭喜/.test(el('overlay-title').textContent), el('overlay-title').textContent);
check('消息含“用时 2.0 s”', /用时 2\.0 s/.test(el('overlay-msg').textContent), el('overlay-msg').textContent);
env.advance(9000);
check('胜利后时间不再增长', timerText() === '2.0 s', timerText());

console.log('[5] 输掉后按 R 重开，难度保持不变');
fresh();
run('world[1] = 0; world[W + 1] = 3;'); // (1,1) 有蛇，走到 (1,0) 会被咬
press('d');
check('被咬死', run('gameOver') === true);
check('浮层已显示', overlayShown());
check('标题是失败', /蛇/.test(el('overlay-title').textContent), el('overlay-title').textContent);
const oldWorld = run('world.slice()').join(',');
press('r');
check('重开后 gameOver = false', run('gameOver') === false);
check('玩家回到出生点', run('px') === 0 && run('py') === 0);
check('金币清零', run('pgold') === 0);
check('计时归零', timerText() === '0.0 s', timerText());
check('浮层隐藏', !overlayShown());
check('世界重新生成', run('world.slice()').join(',') !== oldWorld);
check('重开后可以移动', (press('d'), run('px') === 1));
check('难度未变', run('diffKey') === 'low');

console.log('[6] 进行中按 R 不会重开');
fresh();
press('d');
env.advance(1000);
press('r');
check('位置不变', run('px') === 1);
check('计时继续', run('started') === true && run('finished') === false);
env.advance(600);
check('时间继续走', timerText() === '1.6 s', timerText());

console.log('[7] 难度切换（1/2/3 与按钮）');
fresh();
check('默认低难度', run('diffKey') === 'low');
press('2');
check('按 2 切到中', run('diffKey') === 'mid');
check('HUD 显示“中”', el('diff').textContent === '中', el('diff').textContent);
check('计时重置', timerText() === '0.0 s' && run('started') === false);
check('high 按钮存在', !!el('btn-high'));
el('btn-high').click();
check('点按钮切到高', run('diffKey') === 'high');
check('HUD 显示“高”', el('diff').textContent === '高', el('diff').textContent);
press('1');
check('按 1 回到低', run('diffKey') === 'low');
check('新局世界已生成（有金币）', run('world.filter(v => v === 2).length') >= 5);

console.log('[8] 其它按键不触发计时/重绘');
fresh();
press('x');
check('未开始计时', run('started') === false);
check('位置未变', run('px') === 0);

console.log('[9] 玩家小人');
fresh();
const sp = run('playerSVG()');
check('是 SVG 小人', /player-sprite/.test(sp) && /<svg/.test(sp));
check('带瓶子', /class="bottle"/.test(sp));
check('默认朝右（不镜像）', !/scale\(-1,1\)/.test(sp));

press('d'); // 向右走一步（刚移动完，应该有走路动作类）
check('移动后带走路动画类', /walking/.test(run('playerSVG()')));
env.advance(400); // 站定
check('站定后没有走路动画类', !/walking/.test(run('playerSVG()')));

press('a'); // 向左走
check('朝左时整体镜像', /scale\(-1,1\)/.test(run('playerSVG()')));
press('w'); // 向上
check('朝上时是背面（无脸）', !/cx="13.1" cy="10.3"/.test(run('playerSVG()')));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
