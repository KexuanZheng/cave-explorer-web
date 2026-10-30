// 生成质量测试：
//   1) 每一局都必须"不砸墙就赢不了"（明面星星 < 5）
//   2) 砸开木墙后必须能赢
//   3) 高难度金库是双层，砸一层还不够
const path = require('path');
const { makeEnv } = require('./stub');

const env = makeEnv(path.join(__dirname, '..', 'v2', 'game.js'));
const { run } = env;

const W = 20, H = 12;
const idx = (x, y) => y * W + x;

// 独立实现的 BFS：openSet 里的木墙视为已砸开
function reachableGold(w, openSet) {
  const t = w.slice();
  for (const c of openSet) t[c] = 0;

  const snake = (x, y) => x >= 0 && x < W && y >= 0 && y < H && w[idx(x, y)] === 3;
  const deadly = (x, y) => snake(x, y) || snake(x - 1, y) || snake(x + 1, y) || snake(x, y - 1) || snake(x, y + 1);

  const seen = new Array(W * H).fill(false);
  const q = [0];
  seen[0] = true;
  let gold = 0;
  while (q.length) {
    const i = q.shift();
    if (t[i] === 2) gold++;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = idx(nx, ny);
      if (seen[ni]) continue;
      if (t[ni] === 1 || t[ni] === 3 || t[ni] === 4) continue;
      if (deadly(nx, ny)) continue;
      seen[ni] = true;
      q.push(ni);
    }
  }
  return gold;
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

const N = 150;

for (const key of ['low', 'mid', 'high']) {
  const cfg = run(`DIFFS['${key}']`);
  let noHammer = 0, withHammer = 0, openWrong = 0, outerWrong = 0, goldWrong = 0, goldAdjacent = 0;
  let notNook = 0, losBad = 0, sectorBad = 0, tooClose = 0;
  let minAll = Infinity;

  for (let i = 0; i < N; i++) {
    const w = run(`generateWorld(DIFFS['${key}'])`);
    const vault = run('lastVault');

    const goldTotal = w.filter((v) => v === 2).length;
    if (goldTotal !== cfg.gold) goldWrong++;

    const goldCells = [];
    for (let g = 0; g < W * H; g++) if (w[g] === 2) goldCells.push(g);

    // 明面星星必须在墙角，且同一行/列时中间要有墙
    const inBox = (i) => {
      const x = i % W, y = (i / W) | 0;
      return x >= vault.box.x0 && x <= vault.box.x1 && y >= vault.box.y0 && y <= vault.box.y1;
    };
    const openStars = goldCells.filter((g) => !inBox(g));
    for (const g of openStars) {
      const x = g % W, y = (g / W) | 0;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) { n++; continue; }
        if (w[ny * W + nx] === 1 || w[ny * W + nx] === 4) n++;
      }
      if (n < 2) notNook++;
    }
    const sectorOf = (i) => {
      const x = i % W, y = (i / W) | 0;
      return (x < W / 2 ? 0 : 1) + (y < H / 2 ? 0 : 2);
    };
    if (new Set(openStars.map(sectorOf)).size !== openStars.length) sectorBad++;

    const distFrom = (start) => {
      const d = new Array(W * H).fill(-1);
      const q = [start];
      d[start] = 0;
      while (q.length) {
        const cur = q.shift();
        const cx = cur % W, cy = (cur / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const ni = ny * W + nx;
          if (d[ni] !== -1) continue;
          if (w[ni] === 1 || w[ni] === 3 || w[ni] === 4) continue;
          const snake = (qx, qy) => qx >= 0 && qx < W && qy >= 0 && qy < H && w[qy * W + qx] === 3;
          if (snake(nx, ny) || snake(nx - 1, ny) || snake(nx + 1, ny) || snake(nx, ny - 1) || snake(nx, ny + 1)) continue;
          d[ni] = d[cur] + 1;
          q.push(ni);
        }
      }
      return d;
    };
    for (let a = 0; a < openStars.length; a++) {
      const da = distFrom(openStars[a]);
      for (let b = a + 1; b < openStars.length; b++) {
        if (da[openStars[b]] !== -1 && da[openStars[b]] < 6) tooClose++;
      }
    }

    for (let a = 0; a < openStars.length; a++) {
      for (let b = a + 1; b < openStars.length; b++) {
        const ax = openStars[a] % W, ay = (openStars[a] / W) | 0;
        const bx = openStars[b] % W, by = (openStars[b] / W) | 0;
        if (ax !== bx && ay !== by) continue;
        let blocked = false;
        if (ax === bx) {
          for (let y = Math.min(ay, by) + 1; y < Math.max(ay, by); y++) {
            if (w[y * W + ax] === 1 || w[y * W + ax] === 4) blocked = true;
          }
        } else {
          for (let x = Math.min(ax, bx) + 1; x < Math.max(ax, bx); x++) {
            if (w[ay * W + x] === 1 || w[ay * W + x] === 4) blocked = true;
          }
        }
        if (!blocked) losBad++;
      }
    }

    // 星星之间不能相邻（否则一步能连吃好几个）
    for (let a = 0; a < goldCells.length; a++) {
      for (let b = a + 1; b < goldCells.length; b++) {
        const ax = goldCells[a] % W, ay = (goldCells[a] / W) | 0;
        const bx = goldCells[b] % W, by = (goldCells[b] / W) | 0;
        if (Math.abs(ax - bx) + Math.abs(ay - by) < 2) goldAdjacent++;
      }
    }

    const g0 = reachableGold(w, []);
    if (g0 >= cfg.target) noHammer++;       // 不砸墙就能赢 → 不合格
    if (g0 !== cfg.open) openWrong++;

    const gAll = reachableGold(w, vault.rings.flat());
    if (gAll < cfg.target) withHammer++;    // 砸墙也赢不了 → 不合格
    minAll = Math.min(minAll, gAll);

    // 只砸外层：双层金库此时仍进不去
    const gOuter = reachableGold(w, vault.rings[0]);
    if (vault.layers === 2) {
      if (gOuter >= cfg.target) outerWrong++;
    } else {
      if (gOuter < cfg.target) outerWrong++;
    }
  }

  console.log(`[${cfg.name}] 生成 ${N} 局（明面星星 ${cfg.open}，金库 ${cfg.gold - cfg.open}，${cfg.vault.layers} 层）`);
  check('不砸墙一定赢不了', noHammer === 0, `${noHammer} 局可以无锤通关`);
  check('明面星星数正确', openWrong === 0, `${openWrong} 局数量不对`);
  check('砸开木墙一定能赢', withHammer === 0, `${withHammer} 局砸墙也赢不了`);
  check('星星总数正确', goldWrong === 0, `${goldWrong} 局数量不对`);
  check('星星之间不相邻', goldAdjacent === 0, `${goldAdjacent} 对相邻`);
  check('明面星星都在墙角', notNook === 0, `${notNook} 颗不在墙角`);
  check('同一行/列的星星之间有墙', losBad === 0, `${losBad} 对没墙`);
  check('每颗星在不同象限', sectorBad === 0, `${sectorBad} 局有重复`);
  check('星星之间走路距离 ≥ 6', tooClose === 0, `${tooClose} 对太近`);
  check('层数与难度匹配', outerWrong === 0, `${outerWrong} 局层数不对`);
  console.log(`  全部砸开后可收集 ${minAll} 颗（≥ ${cfg.target}）`);
}

console.log('\n[难度参数]');
const low = run(`DIFFS['low']`), high = run(`DIFFS['high']`);
check('低难度金库 1 层', low.vault.layers === 1);
check('高难度金库 2 层', high.vault.layers === 2);
check('高难度蛇更多', high.snake > low.snake, `${low.snake} vs ${high.snake}`);
check('高难度明面星星更少', high.open < low.open, `${low.open} vs ${high.open}`);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
