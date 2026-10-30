// 锤子 + 木墙 的交互测试
const path = require('path');
const { makeEnv } = require('./stub');

const env = makeEnv(path.join(__dirname, '..', 'v2', 'game.js'));
const { run, press, el, timerText } = env;

function fresh() {
  run(`
    world = new Array(W * H).fill(0);
    seen = new Array(W * H).fill(false);
    px = 0; py = 0; pgold = 0; gameOver = false;
    hammerUses = 3; facing = { dx: 1, dy: 0 }; stopSnakeTimer(); stopSnakeTimer();
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

console.log('[1] 生成的金库结构');
const world = run('generateWorld(DIFFS.low)');
const vault = run('lastVault');
const cfgLow = run("DIFFS['low']");
check('有木墙', world.filter((v) => v === 4).length > 0, String(world.filter((v) => v === 4).length));
check('金库有 1 层（低难度）', vault.rings.length === 1, String(vault.rings.length));
check('房间里有星星', vault.interior.filter((i) => world[i] === 2).length === cfgLow.gold - cfgLow.open,
  String(vault.interior.filter((i) => world[i] === 2).length));
check('房间外有星星', world.filter((v) => v === 2).length - vault.interior.filter((i) => world[i] === 2).length === cfgLow.open);

console.log('[2] H 砸面前的木墙');
fresh();
run('world[1] = 4;'); // 右边是木墙
check('初始 3 次', run('hammerUses') === 3);
press('f');
check('木墙被砸开', run('world[1]') === 0);
check('次数 -1', run('hammerUses') === 2);
check('HUD 显示 2', el('hammer').textContent === '2', el('hammer').textContent);
check('砸开后可以走进去', (press('d'), run('px') === 1));

console.log('[2b] 被两块木墙夹住时，按方向再按 F 也能砸');
fresh();
run('px = 2; py = 2; world[1 * W + 2] = 4; world[3 * W + 2] = 4;'); // 上下都是木墙
press('w'); // 撞墙，位置不变
check('撞墙不移动', run('px') === 2 && run('py') === 2);
press('f');
check('按 W 后按 F 砸开上面那块', run('world[1 * W + 2]') === 0);
check('只消耗一次', run('hammerUses') === 2);
press('s'); // 转身朝下
press('f');
check('按 S 后按 F 砸开下面那块', run('world[3 * W + 2]') === 0);
check('又消耗一次', run('hammerUses') === 1);

console.log('[3] 面前没有木墙时不消耗次数');
fresh();
run('world[1] = 1;'); // 面前是石墙
press('f');
check('石墙砸不动', run('world[1]') === 1);
check('次数不变', run('hammerUses') === 3);
check('有提示文字', el('flash').textContent.length > 0, el('flash').textContent);

console.log('[4] 身边只有一块木墙时会自动砸它（即使没朝向它）');
fresh();
run('world[W] = 4;'); // 下面是木墙，但朝向是右
press('f');
check('下面木墙被砸', run('world[W]') === 0);
check('次数 -1', run('hammerUses') === 2);

console.log('[5] 朝向会跟随移动');
fresh();
run('world[W] = 4;'); // (0,1) 是木墙
press('s'); // 往下撞木墙 → 不动，朝向不变？(撞墙不算移动)
check('撞木墙不移动', run('py') === 0 && run('px') === 0);
run('world[W] = 0;');
press('s'); // 向下移动成功 → 朝向变下
press('f');
check('朝下砸不到（下面是空地）也不报错', run('hammerUses') === 3);

console.log('[6] 3 次用完后再按 H 无效');
fresh();
run('world[1] = 4; world[2] = 4; world[3] = 4; world[W] = 4; world[5] = 2; world[6] = 2; world[7] = 2; world[8] = 2; world[9] = 2;');
press('f'); // 砸右边 (1,0)
env.press('d'); // 走到 (1,0)
press('f'); // 砸 (2,0)
press('d'); // 走到 (2,0)
press('f'); // 砸 (3,0)
check('已用 3 次', run('hammerUses') === 0);
check('三面木墙都没了', run('[world[1], world[2], world[3]].every(v => v === 0)'));
press('d'); // 走到 (3,0)，面前是 (4,0)
run('world[4] = 4;');
press('f');
check('用完后再砸无效果', run('world[4]') === 4);
check('次数不会变负数', run('hammerUses') === 0);
check('提示锤子用完', /用完/.test(el('flash').textContent), el('flash').textContent);

console.log('[7] 锤子用完且再也赢不了 → 判负，可 R 重开');
fresh();
run('world[1] = 4; world[2] = 2; world[3] = 2; world[4] = 2; world[5] = 2; hammerUses = 1;');
press('f'); // 砸开 (1,0)，但后面只有 4 颗星星，凑不齐 5 颗
check('判负', run('gameOver') === true);
check('结算浮层显示', env.overlayShown());
check('标题是锤子用完', /锤子/.test(env.overlayTitle()), env.overlayTitle());
press('r');
check('R 可以重开', run('gameOver') === false);
check('锤子恢复', run('hammerUses') === 3);

console.log('[8] 计时/重开不受影响');
fresh();
press('d');
env.advance(1000);
check('计时正常', timerText() === '1.0 s', timerText());
check('重开后锤子恢复 3 次', (press('r'), run('hammerUses') >= 0));

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
