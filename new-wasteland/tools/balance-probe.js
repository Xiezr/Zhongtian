/* ============================================================
 * tools/balance-probe.js — 编成平衡探针
 * ------------------------------------------------------------
 * 只问一个问题：换编成，结果会不会变？
 * 如果四种偏科编成打同一块地的结果差不多，编成就是死的。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
  { url: 'https://local.test/', runScripts: 'outside-only', pretendToBeVisual: true });
const W = dom.window;
['js/data.js', 'js/state.js', 'js/engine.js'].forEach((f) => {
  W.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
});

const ST = W.STATE;
const EN = W.ENGINE;
ST.newWorld(20261021);
const S = ST.S();

/* ---------- 早期：编制 8 ---------- */
const EARLY = {
  '默认 8 步行机': { buxingji: 8 },
  '火力 2 东风': { huopao: 2 },
  '火力 2 自走炮+1 重机': { daodanche: 2, zhongjiqiang: 1 },
  '装甲 2 主战': { zhuzhan: 2 },
  '装甲 1 泰坦+3 步行机': { taitan: 1, buxingji: 3 },
  '侦察 1 伏击+6 步行机': { fujiche: 1, buxingji: 6 },
  '运输 1 运输+4 步行机': { yunshu: 1, buxingji: 4 },
};

/* ---------- 后期：编制 18（第 5 年） ---------- */
const LATE = {
  '满编 火力（4 东风+2 步）': { huopao: 4, buxingji: 2 },
  '满编 装甲（3 主战+3 电磁）': { zhuzhan: 3, dianci: 3 },
  '满编 混编（2 东风+2 主战+2 伏击）': { huopao: 2, zhuzhan: 2, fujiche: 2 },
  '满编 运输（3 运输+2 东风）': { yunshu: 3, huopao: 2 },
};

const TARGETS = [
  { n: '荒原d1', t: 'plain', s: null },
  { n: '林地d2', t: 'forest', s: null },
  { n: '沙地d3', t: 'desert', s: null },
  { n: '物资站d3', t: 'plain', s: 'warehouse' },
  { n: '重镇d5', t: 'plain', s: 'bigcity' },
  { n: '旧都d7', t: 'plain', s: 'capital' },
];

function mkTeam(army) {
  const t = { id: 'X', name: '探', army: JSON.parse(JSON.stringify(army)), men: 0, vets: 0 };
  t.men = ST.countMen(t.army);
  return t;
}

/* 跑 40 次取平均「死几个人」；半数以上全灭就记「败」 */
function run(army, tg) {
  let sum = 0, wipe = 0;
  const men = ST.countMen(army);
  for (let i = 0; i < 40; i++) {
    const t = mkTeam(army);
    const r = EN._fight(t, { type: tg.t, site: tg.s, lit: true, owner: null });
    if (r.level === 'wipe') { wipe++; sum += men; } else { sum += r.killed; }
  }
  return wipe >= 20 ? '败' : (sum / 40).toFixed(1) + '人';
}

function runNum(army, tg) {
  const v = run(army, tg);
  return v === '败' ? 99 : parseFloat(v);
}

function table(title, builds, targets) {
  console.log('\n' + title);
  console.log(''.padEnd(26) + '容量 火力 装甲 侦察 运输 补给 ' + targets.map((x) => x.n.padStart(9)).join(''));
  Object.keys(builds).forEach((k) => {
    const a = builds[k];
    const st = ST.armyStats(a);
    console.log(
      k.padEnd(26) +
      String(ST.armyPop(a)).padStart(4) +
      String(st.fire).padStart(5) +
      String(st.armor).padStart(5) +
      String(st.scout).padStart(5) +
      String(st.haul).padStart(5) +
      String(ST.maxSupplyOf(a)).padStart(5) + ' ' +
      targets.map((tg) => run(a, tg).padStart(9)).join('')
    );
  });
}

console.log('=================================================');
console.log(' 编成平衡探针（数字 = 平均死几个人；败 = 全灭）');
console.log('=================================================');

table('【早期 · 编制 8】', EARLY, TARGETS);

S.winters = 5;
table('【后期 · 编制 ' + ST.capacityNow() + '（第 5 年）】', LATE, TARGETS);

/* ---------- 判据 ---------- */
console.log('\n---------------- 判据 ----------------');
function spread(builds, tg) {
  const vals = Object.keys(builds).map((k) => runNum(builds[k], tg)).filter((v) => v < 99);
  if (vals.length < 2) return null;
  return Math.max(...vals) - Math.min(...vals);
}
const s1 = spread(EARLY, TARGETS[4]);
const s2 = spread(EARLY, TARGETS[3]);
const s3 = spread(EARLY, TARGETS[2]);
console.log('早期 打重镇：最好与最差编成相差 ' + (s1 == null ? '—' : s1.toFixed(1)) + ' 人');
console.log('早期 打物资站：相差 ' + (s2 == null ? '—' : s2.toFixed(1)) + ' 人');
console.log('早期 打沙地：相差 ' + (s3 == null ? '—' : s3.toFixed(1)) + ' 人');
const ok = [s1, s2, s3].some((v) => v != null && v >= 1);
console.log(ok ? '✅ 编成有取舍（至少一处差 ≥1 人）' : '❌ 编成没有意义');
