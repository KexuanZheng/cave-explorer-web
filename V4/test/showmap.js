// 打印几张地图看木墙形状是否随机
const path = require('path');
const { makeEnv } = require('./stub');
const env = makeEnv(path.join(__dirname, '..', 'v2', 'game.js'));
const W = 20, H = 12;

for (const key of ['low', 'high', 'high']) {
  const w = env.run(`generateWorld(DIFFS['${key}'])`);
  const v = env.run('lastVault');
  console.log(`\n=== ${key}  木墙 ${w.filter((x) => x === 4).length} 格, 金库房间 ${v.interior.length} 格, 圈数 ${v.rings.length} ===`);
  let out = '';
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const ch = w[i] === 1 ? '#' : w[i] === 2 ? '$' : w[i] === 3 ? 'S' : w[i] === 4 ? 'W' : (v.interior.includes(i) ? '.' : ' ');
      line += ch;
    }
    out += line + '\n';
  }
  console.log(out);
}
