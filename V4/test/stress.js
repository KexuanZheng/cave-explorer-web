// 压测：反复生成，找出是否有可能卡死/极慢的情况
const path = require('path');
const { makeEnv } = require('./stub');

const env = makeEnv(path.join(__dirname, '..', 'v2', 'game.js'));
const { run } = env;

function stress(key, n) {
  let max = 0, sum = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = process.hrtime.bigint();
    run(`generateWorld(DIFFS['${key}'])`);
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    max = Math.max(max, ms);
    sum += ms;
  }
  return { avg: (sum / n).toFixed(2), max: max.toFixed(2), total: ((Date.now() - t0) / 1000).toFixed(1) };
}

for (const k of ['low', 'mid', 'high']) {
  console.log(k, stress(k, 800));
}
