/* ============================================================
 * tools/ai-probe.js  策略层（GAME.strat）效果探针
 * ------------------------------------------------------------
 * 用法：node tools/ai-probe.js
 *
 * 目的：证明 v91.77 的策略层**真的在改行为**，且方向合理：
 *   · 同一场仗，battleAI=off（旧：打最近/同兵种） vs on（评分选靶 + 姿态决策）
 *   · 输出双方损失率、回合数、选靶差异
 * 不改任何生产代码，只读 bundle。
 * ============================================================ */
const path = require('path');
global.window = global;
global.location = { search: '', href: 'file:///index.html' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.setInterval = function(){ return 0; };
global.clearInterval = function(){};
global.setTimeout = function(f){ return 0; };
global.addEventListener = function(){};
global.removeEventListener = function(){};
global.requestAnimationFrame = function(f){ return 0; };
if(!global.performance) global.performance = { now: function(){ return Date.now(); } };
global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
function makeEl() {
  return {
    tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() {
      const noop = () => {};
      return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) },
        { get(t, p) { return p in t ? t[p] : noop; } });
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; },
  };
}
const _cache = {};
global.document = {
  createElement: makeEl,
  querySelector: (s) => (_cache[s] = _cache[s] || makeEl()),
  querySelectorAll: () => [],
  getElementById: (id) => (_cache['#' + id] = _cache['#' + id] || makeEl()),
  addEventListener() {}, readyState: 'complete',
};
require(path.join(__dirname, '..', 'js', 'bundle-core.js'));
require(path.join(__dirname, '..', 'js', 'bundle-war.js'));
require(path.join(__dirname, '..', 'js', 'bundle-ui.js'));
const G = global.GAME;
G.state = { settings: { battleAI: false, battleEngine: 'tactic' }, cities: [], wilds: [], forts: [], generals: [], queues: {}, marches: [], battles: [], gathers: [], sieges: [], items: {}, seen: {}, story: {} };
if (!G || !G.battle || !G.strat) { console.error('bundle 未加载或策略层缺失'); process.exit(1); }

function pct(loss, remain) { return ((100 * loss) / Math.max(1, loss + remain)).toFixed(1) + '%'; }
function run(label, atk, def, defVal, opts, ai) {
  G.state = G.state || { settings: {} };
  G.state.settings = G.state.settings || {};
  G.state.settings.battleAI = !!ai;
  G.state.settings.battleEngine = 'tactic';
  const gen = G.makeGeneral('测', 30, 'idle');
  gen.tong = 120; gen.yw = 120; gen.zm = 100; gen.nz = 100;
  const t0 = Date.now();
  const r = G.battle.simulate(atk, gen, def, defVal, null, opts || { kind: 'wild' });
  const ms = Date.now() - t0;
  return {
    label,
    胜负: r.winner === 'atk' ? '攻方胜' : '守方胜',
    攻损: pct(r.atkLoss, r.atkRemain),
    守损: pct(r.defLoss, r.defRemain),
    回合: r.rounds,
    用时: ms + 'ms',
    首回合目标: (r.roundsLog && r.roundsLog[0] ? (r.roundsLog[0].events || []).filter(e => e.kind === 'attack').slice(0, 3).map(e => e.name + '→' + e.target).join(' / ') : ''),
  };
}

const CASES = [
  ['野战：混编攻 vs 纯主战守', { buxingji: 6000, zhuzhan: 3000, dongfeng: 1200 }, { zhuzhan: 9000 }, 0, { kind: 'wild' }],
  ['攻城：炮兵+主战 vs 城防 60', { zhuzhan: 5000, dongfeng: 1500, huopao: 2000 }, { buxingji: 4000, dunwei: 4000 }, 60, { kind: 'city', sieging: true }],
  ['野战：纯近战 vs 纯远程守', { zhuzhan: 8000, kuanglie: 3000 }, { dongfeng: 2000, wuren: 2000 }, 0, { kind: 'wild' }],
];
const rows = [];
for (const [label, atk, def, defVal, opts] of CASES) {
  rows.push(run(label + ' · 旧策略', atk, def, defVal, opts, false));
  rows.push(run(label + ' · 策略层', atk, def, defVal, opts, true));
}
console.log('\n════════ 策略层效果对照（同一场仗，开关 battleAI）════════');
for (const r of rows) {
  console.log(`\n【${r.label}】`);
  console.log(`  ${r.胜负} · 攻损 ${r.攻损} · 守损 ${r.守损} · ${r.回合} 回合 · ${r.用时}`);
  if (r.首回合目标) console.log(`  首回合：${r.首回合目标}`);
}
console.log('\n提示：battleAI 默认关闭；开启方式 = state.settings.battleAI = true');
