/* ============================================================
 * 600× 时速测评（v90.15）
 * 用法：NODE_PATH=... node .workbuddy/tools/playtest/r600_playtest.js
 * 在无头 Node 里加载游戏、开新档、时间倍率 600×，推进 N 现实分钟，
 * 逐段采样：资源 / 城池 / 建筑 / 英雄 / 队列 / 异常，最后打印报告。
 * ============================================================ */
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..'); process.chdir(ROOT);

/* 最小 DOM 桩（同 smoke-test.js 口径） */
global.window = global;
global.document = {
  addEventListener: function () {}, removeEventListener: function () {},
  createElement: function () { return { style: {}, appendChild: function () {}, setAttribute: function () {}, getContext: function () { return null; }, classList: { add: function () {}, remove: function () {}, toggle: function () {} } }; },
  querySelector: function () { return null; }, querySelectorAll: function () { return []; },
  getElementById: function () { return null; }, body: { appendChild: function () {}, innerHTML: '' },
  documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
};
global.requestAnimationFrame = function (f) { return f && f(); };
global.location = { search: '', href: 'file:///index.html' };
global.addEventListener = function () {}; global.removeEventListener = function () {};
global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
global.innerWidth = 1440; global.innerHeight = 900;
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.setInterval = function () { return 0; }; global.clearInterval = function () {};

['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic',
 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui']
  .forEach(function (m) { require(path.join(ROOT, 'js', m + '.js')); });

const G = global.GAME, DATA = G.DATA;

/* ---- 开档 ---- */
G.newGame({ name: '测评', cityName: '灰岗', mapSeed: 20261008 });
const s = G.state;
s.settings.timeScale = 600;
console.log('timeScale=' + G.timeScale() + ' settings=' + JSON.stringify(s.settings.timeScale));
console.log('t fields: ' + Object.keys(s).filter(k=>/^(t|time|day|sec|cal|season|year|month)/i.test(k)).join(','));
s.settings.battleWatch = false;
s.settings.autoTrain = true;

/* 造一座训练营 + 设自动征兵目标，让 600× 跑出兵力/队列活动 */
(function () {
  var c0 = s.cities[0];
  var slot = c0.cells.findIndex(function (x) { return !x.build && !x.official; });
  c0.cells[slot].build = { id: 'junying', lvl: 6 };
  c0.res.grain = 5e6; c0.res.wood = 5e6; c0.res.stone = 5e6; c0.res.iron = 5e6; c0.res.pop = 5000;
  G.techSet('lianbing', 1, c0);   /* 解锁步行机组合门槛 */
  var t0 = 'buxingji';
  var cfg = G.autoTrainCfg();
  cfg.targets.buxingji = { min: 50, max: 300 };
  console.log('autoTrain 目标 buxingji 50~300 · canTrain=' + JSON.stringify(G.canTrain('buxingji').ok));
})();


const TS = 600;
const MIN = 60;                            /* 1 游戏分钟 = 60 游戏秒 */

function snap(tag) {
  const c0 = s.cities[0];
  let army = 0; (c0.army && Object.keys(c0.army).forEach(k => army += c0.army[k]));
  let gen = (s.generals || []).length;
  let builds = 0, lvSum = 0;
  (c0.cells || []).forEach(x => { if (x.build) { builds++; lvSum += (x.build.lvl || 1); } });
  return {
    tag, gday: s.world ? Math.round(s.world.elapsed / (24*3600) * 10) / 10 : -1, year: s.world ? s.world.year : -1,
    res: Object.keys(c0.res).reduce((o, k) => (o[k] = Math.round(c0.res[k]), o), {}),
    builds, lvSum, army, gen,
    trainQ: (s.queues.train || []).length, buildQ: (s.queues.build || []).length,
    inv: (s.inventory || []).length, forts: Object.keys(s.forts || {}).length,
  };
}

console.log('===== 600× 时速测评 · 起始 =====');
console.log(JSON.stringify(snap('start')));
const t0 = Date.now();
const STEPS = 10;                          /* 10 段 */
const PER_REAL_MIN = 72;                   /* 每段 72 现实分钟 = 3 游戏日（600×） */
const samples = [];
for (let i = 1; i <= STEPS; i++) {
  G.simulateBulk(PER_REAL_MIN * MIN);      /* 推进 PER_REAL_MIN 现实分钟（600× 下 = 50 游戏时/段） */
  const sp = snap('段' + i);
  samples.push(sp);
  console.log(JSON.stringify(sp));
}
const wallMs = Date.now() - t0;
console.log('===== 完成 =====');
console.log('模拟时长：' + STEPS * PER_REAL_MIN + ' 现实分钟 = ' +
  (STEPS * PER_REAL_MIN * TS / 3600).toFixed(0) + ' 游戏小时 = ' +
  (STEPS * PER_REAL_MIN * TS / 3600 / 24).toFixed(1) + ' 游戏日');
console.log('实墙耗时：' + (wallMs / 1000).toFixed(1) + 's（' + (wallMs / STEPS).toFixed(0) + 'ms/段）');

/* ---- 一致性体检 ---- */
const issues = [];
samples.forEach(x => {
  for (const k in x.res) { if (!isFinite(x.res[k]) || x.res[k] < 0) issues.push(x.tag + ' 资源异常:' + k + '=' + x.res[k]); }
  if (x.army < 0) issues.push(x.tag + ' 兵力为负');
});
(s.generals || []).forEach(g => { if (!isFinite(g.level) || g.level < 1) issues.push('英雄等级异常 ' + g.name + '=' + g.level); });
console.log('===== 异常 =====');
console.log(issues.length ? issues.join('\n') : '无');
