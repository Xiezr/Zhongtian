/* ============================================================
 * AI 选动作重标探针（v91.96）
 * 背景：动作三角打开后，§164③ 镜像局交换比 1.28 → 0.78（智能方案反而更差）。
 * 原因：smartStanceOf 是按旧口径「驻守 −50%」调的 —— 现在驻守要付 −20% 输出。
 * 做法：不动源文件，在探针里 monkeypatch 出几个候选规则，用同一面镜子比。
 * ============================================================ */
const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function el() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; },
    querySelector() { return el(); }, querySelectorAll() { return []; },
    getContext() { const n = () => {}; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const _c = {};
global.document = { createElement: el, querySelector: (s) => (_c[s] = _c[s] || el()), querySelectorAll: () => [], getElementById: (id) => (_c['#' + id] = _c['#' + id] || el()), addEventListener() {}, readyState: 'complete' };
require('E:/Deepseekdb/js/bundle.js');
const G = window.GAME, D = G.DATA, T = G.tactic;
G.newGame({ name: 'ai', cityName: '灰岗', mapSeed: 20261020 });

const MIRROR = { buxingji: 1000, dunwei: 400, daodanche: 400, fujiche: 200, zhuzhan: 100, wuren: 40, huopao: 20 };

function runMirror() {
  function one(smart) {
    const env = T.begin(JSON.parse(JSON.stringify(MIRROR)), null, JSON.parse(JSON.stringify(MIRROR)), 0, null, { stances: {} });
    const rec = { side: 'atk', cmd: {} };
    let guard = 0;
    while (!env.over && guard++ < 36) {
      if (smart) G.battle.smartApply(rec, env);
      const st = env.step(); if (!st) break;
    }
    const fin = env.finish();
    let aL = 0, dL = 0;
    for (const k in fin.atkLossBy) aL += fin.atkLossBy[k];
    for (const k in fin.defLossBy) dL += fin.defLossBy[k];
    return { aL: aL, dL: dL };
  }
  const off = one(false), on = one(true);
  const rOff = off.aL > 0 ? off.dL / off.aL : 0;
  const rOn = on.aL > 0 ? on.dL / on.aL : 0;
  return { off, on, rOff, rOn };
}

const ORIG = G.battle.smartStanceOf;
const rows = [];
function trial(name, fn) {
  G.battle.smartStanceOf = fn || ORIG;
  const r = runMirror();
  rows.push({ name, ...r });
  console.log(name.padEnd(26) + ' off=' + r.rOff.toFixed(2) + ' → on=' + r.rOn.toFixed(2)
    + '（我损 ' + r.off.aL + '→' + r.on.aL + '，敌损 ' + r.off.dL + '→' + r.on.dL + '）'
    + (r.rOn > r.rOff * 2 && r.on.aL < r.off.aL * 0.5 ? '  ✅' : '  ❌'));
}

console.log('== 镜像局交换比（判据 rOn > 2×rOff 且 我损减半）==');
trial('A 现行（hold 站位 + 风筝退）');

/* B：只有"射程窗口"才站桩；够不着就压上；不再风筝后退 */
trial('B 安全窗口才守·不后退', function (u, gap, plan, mode, ctx) {
  plan = plan || G.battle.smartPlanOf(); mode = mode || 'echelon';
  if (mode === 'turtle') return 'hold';
  if (mode === 'charge') return 'advance';
  const er = (u.er != null ? u.er : (u.range || 0));
  if (mode === 'line') return (gap <= er) ? 'hold' : 'advance';
  if (mode === 'spear' && plan.fastestId && u.id === plan.fastestId) return 'advance';
  if ((u.range || 0) >= 500) {
    if (gap > er * (plan.rangeK || 1)) return 'advance';
    /* 站桩只在"敌够不着我"时成立：威胁线内（下回合能被打到）→ 压上去，用满额输出换 */
    if (ctx && gap <= ctx.threat) return 'advance';
    return 'hold';
  }
  const isCav = (u.spd || 0) >= 400;
  const k = isCav ? (plan.gapCav != null ? plan.gapCav : 250) : (plan.gapInf != null ? plan.gapInf : 250);
  return (gap <= k) ? 'hold' : 'advance';
});

/* C：全推进（最朴素的对照：三角打开后"不动"到底值不值） */
trial('C 全推进（对照）', function () { return 'advance'; });

/* D：B 但近战不提前停（贴到底），只有远程站桩 */
trial('D 远程站桩·近战全冲', function (u, gap, plan, mode, ctx) {
  plan = plan || G.battle.smartPlanOf(); mode = mode || 'echelon';
  const er = (u.er != null ? u.er : (u.range || 0));
  if ((u.range || 0) >= 500) {
    if (gap > er * (plan.rangeK || 1)) return 'advance';
    if (ctx && gap <= ctx.threat) return 'advance';
    return 'hold';
  }
  return 'advance';
});
G.battle.smartStanceOf = ORIG;
