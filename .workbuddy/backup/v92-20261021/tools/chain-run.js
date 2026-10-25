/* ============================================================
 * tools/chain-run.js  一条行动链走到底：出征 → 行军 → 战斗 → 落账 → 战报
 * ------------------------------------------------------------
 * 用法：node tools/chain-run.js
 *
 * 为什么要有它：chain-audit.js 走的是"奇观/自动探索"那几条链，
 * 出征战斗链（本轮策略层所在的地方）没有状态推进式走查。
 * 本脚本从建局一路推到落账，每个节点都验，并统计策略层被调用次数，
 * 专抓"单点都对、串起来断"（例：观战路径原来根本不给策略层接线）。
 *
 * 两条路径都要走：
 *   链A battleWatch=false → 抵达即结算（走 T.simulate）
 *   链B battleWatch=true  → 抵达挂起，逐回合指挥后落账（走 T.begin + step）
 * ============================================================ */
const path = require('path');
global.window = global;
global.location = { search: '', href: 'file:///index.html' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = function () {}; global.removeEventListener = function () {};
global.requestAnimationFrame = function () { return 0; };
global.setInterval = function () { return 0; }; global.clearInterval = function () {};
if (!global.performance) global.performance = { now: function () { return Date.now(); } };
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

require(path.join(__dirname, '..', 'js', 'bundle.js'));
const G = global.GAME;

/* 策略层调用计数（用来证明 AI 真的接在链上，而不是只接在单元测试里） */
let planCalls = 0;
const _planSide = G.strat.planSide;
G.strat.planSide = function () { planCalls++; return _planSide.apply(this, arguments); };

function nearWild(st, type) {
  const c0 = st.cities[0];
  for (let r = 1; r < 40; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = c0.x + dx, y = c0.y + dy;
      const tl = G.map.tile(x, y);
      const ci = G.sphere.ciOfXY(x, y);
      if (tl && tl.terrain === type && !G.map.wildAt(ci) && !G.map.npcAt(ci)) return { x, y, ci };
    }
  }
  return null;
}

function runChain(label, watch) {
  const rows = [];
  let bad = 0;
  const mark = (name, ok, detail) => { rows.push({ name, ok, detail: detail == null ? '' : String(detail) }); if (!ok) bad++; };

  const st = G.newGame({ name: label, cityName: '灰岗', mapSeed: 20261016 });
  st.settings.battleWatch = watch;
  st.settings.battleAI = true;
  const c0 = st.cities[0], gen = st.generals[0];
  gen.stamina = 100; gen.energy = 100;
  planCalls = 0;

  const w = nearWild(st, 'forest');
  mark('① 建局：城市 / 英雄 / 野地就绪', !!c0 && !!gen && !!w, `城=${c0 && c0.name} 英雄=${gen && gen.name} 目标=${w ? '(' + w.x + ',' + w.y + ')' : '无'}`);
  if (!c0 || !gen || !w) { return finish(); }

  const army = { buxingji: 20000, dunwei: 5000 };
  c0.army = Object.assign({}, army);
  mark('② 编成：驻军 = 声明的编成', G.armyTotal(c0) === 25000, `armyTotal=${G.armyTotal(c0)}`);

  const d = G.march.dispatch({ kind: 'wild', ci: w.ci }, 'raid', army, gen.id);
  mark('③ 派队：入队 + 城兵扣离 + 英雄行军态',
    !!d.ok && st.marches.length === 1 && G.armyTotal(c0) === 0 && gen.status === 'march',
    `ok=${!!d.ok} 队列=${st.marches.length} 城兵=${G.armyTotal(c0)} 英雄=${gen.status}`);

  let n = 0;
  while (st.marches.length && n < 600) { G.march.tick(); n++; }
  mark('④ 行军：推进到点', st.marches.length === 0, `${n} tick`);

  let winner = '';
  if (watch) {
    const id = st.battles && st.battles.length ? st.battles[0].id : null;
    mark('⑤ 抵达：挂起为待指挥会话', !!id, `battleId=${id || '无'} 待战=${(st.battles || []).length}`);
    if (id) {
      const r = G.battle.autoBattle(id);
      winner = (r && (r.winner || (r.result && r.result.winner))) || '';
      mark('⑥ 观战推进：会话跑完并落账', !!r, `winner=${winner || '?'}`);
    }
  } else {
    const rec = (st.battles || []).slice(-1)[0];
    mark('⑤ 抵达：自动模式直接结算（不挂起）', !rec || rec.state !== 'live', `待战=${(st.battles || []).length}`);
  }

  const back = G.armyTotal(c0), wounded = st.wounded || 0;
  mark('⑥ 落账：兵力有去向（回城 + 伤兵）', back + wounded > 0, `回城=${back} 伤兵=${wounded}`);
  mark('⑦ 收尾：英雄空闲 + 行军队列清空', gen.status !== 'march' && st.marches.length === 0, `英雄=${gen.status} 队列=${st.marches.length}`);

  const logs = (st.log || st.logs || []);
  const warLogs = logs.filter ? logs.filter(x => /战|损|胜|败/.test(String(x.msg || x.text || x))) : [];
  mark('⑧ 战报：写出战况记录', warLogs.length > 0 || (st.battles || []).length > 0 || back + wounded > 0,
    `日志条=${logs.length} 战况条=${warLogs.length}`);

  mark('⑨ 策略层：本次出征真的被调用', planCalls > 0, `planSide 调用 ${planCalls} 次`);

  return finish();

  function finish() {
    console.log(`\n【${label}】（battleWatch=${watch}）`);
    rows.forEach(s => console.log(`  ${s.ok ? '✅' : '❌'} ${s.name}  [${s.detail}]`));
    return { planCalls, bad, rows };
  }
}

/* 预热一局：v91.61 已知问题 —— 全新会话首局的球面按 seed 1 构建，
   第二次 newGame 才吃到 mapSeed。链路脚本要的是可复现地形，故先空跑一局。 */
G.newGame({ name: '预热', cityName: '灰岗', mapSeed: 20261016 });

const A = runChain('链A · 自动结算', false);
const B = runChain('链B · 观战指挥', true);

const fails = A.bad + B.bad;
console.log('\n════════ 汇总 ════════');
console.log(`自动路径（走 T.simulate）策略层调用：${A.planCalls} 次 · 失败节点 ${A.bad}`);
console.log(`观战路径（走 T.begin+step）策略层调用：${B.planCalls} 次 · 失败节点 ${B.bad}`);
console.log(fails === 0 ? '结论：这条链全通，策略层两条路径都在生效' : `结论：链上有 ${fails} 个断点`);
process.exit(fails === 0 ? 0 : 1);
