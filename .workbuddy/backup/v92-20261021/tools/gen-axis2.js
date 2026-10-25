/* 将领 vs 编成：谁在决定胜负（只读探针，不改引擎）
   修正 v2：装备 atk 的百分比是 atk/1000（每 10 点 +1%），
   而武力是每点 +0.05% → 等效武器 atk A 需要 yw = 2A（不是 20A）。
   度量改用「能打赢多少守军」（单调、不饱和），避免守军被打光后全部顶到 100%。
*/
const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0;
global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() {
  return {
    tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } },
    addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; }
  };
}
const cache = {};
global.document = {
  createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [],
  getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete'
};
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'axis2', cityName: '灰岗', mapSeed: 20261016 });

let K = 1;
const raw = G.genAttrs;
G.genAttrs = function (g) {
  const a = raw.call(G, g);
  if (K === 1) return a;
  const o = Object.assign({}, a);
  o.atkPct = (a.atkPct || 0) * K;
  o.defPct = (a.defPct || 0) * K;
  if (K === 0) { o.spd = 0; o.sta = 0; o.staMax = 0; }
  return o;
};
function mkGen(o) {
  return Object.assign({ id: 'g', name: 't', level: 1, tong: 100, yw: 0, zm: 0, nz: 0, speed: 20, sta: 400, staMax: 400, equip: {}, attach: [] }, o);
}
/* 武器 atk A → yw = A*2（atkPct = A/1000）*/
const genW = A => mkGen({ yw: A * 2 });
const G_NONE = null;
const WEAPONS = [['无将', 0], ['q1 260', 260], ['q3 1400', 1400], ['q4 2800', 2800], ['q5 5200', 5200], ['q6 9000', 9000]];

function comp(shares, pop) {
  const out = {};
  for (const id in shares) {
    const t = D.TROOPS[id];
    out[id] = Math.max(1, Math.round(shares[id] * pop / t.pop));
  }
  return out;
}
const C = {
  '纯主战': comp({ zhuzhan: 1 }, 100000),
  '纯炮兵': comp({ huopao: 1 }, 100000),
  '纯泰坦': comp({ taitan: 1 }, 100000),
  '纯轰炸': comp({ wuren: 1 }, 100000),
  '主战70+炮30': comp({ zhuzhan: 0.7, huopao: 0.3 }, 100000),
  '坦40+炮60': comp({ taitan: 0.4, huopao: 0.6 }, 100000),
  '主战+炮+轰': comp({ zhuzhan: 1 / 3, huopao: 1 / 3, wuren: 1 / 3 }, 100000),
};

/* 能打赢多少守军（守军固定为纯主战编成，按人口线性放大） */
function capacity(atk, gen, defShares) {
  const probe = n => {
    const def = comp(defShares, n);
    const r = G.tactic.simulate(atk, gen, def, 0, null, { kind: 'wild', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 10000, hi = 3000000;
  for (let i = 0; i < 20; i++) {
    const m = Math.floor((lo + hi) / 2);
    if (probe(m)) lo = m; else hi = m;
  }
  return lo;
}

const a0 = raw.call(G, genW(9000));
console.log('=== 校验 ===');
console.log('  武器 atk 9000 → atkPct', a0.atkPct.toFixed(2), '= 攻击 ×' + (1 + a0.atkPct).toFixed(1));
console.log('  武器 atk 1400 → atkPct', raw.call(G, genW(1400)).atkPct.toFixed(2), '= 攻击 ×' + (1 + raw.call(G, genW(1400)).atkPct).toFixed(1));

console.log('\n=== A 轴：同一编成(10万人口)，只换武器 → 能打赢多少守军(万人口) ===');
console.log('  编成'.padEnd(16) + WEAPONS.map(w => w[0].padStart(10)).join(''));
for (const n of ['纯主战', '纯炮兵', '坦40+炮60']) {
  const row = WEAPONS.map(([, a]) => (K = 1, capacity(C[n], a > 0 ? genW(a) : G_NONE, { zhuzhan: 1 }) / 10000).toFixed(1).padStart(10));
  console.log(('  ' + n).padEnd(16) + row.join(''));
}

console.log('\n=== B 轴：同一武器，只换编成（守军=纯主战）===');
console.log('  编成'.padEnd(16) + WEAPONS.map(w => w[0].padStart(10)).join(''));
for (const n of Object.keys(C)) {
  const row = WEAPONS.map(([, a]) => (K = 1, capacity(C[n], a > 0 ? genW(a) : G_NONE, { zhuzhan: 1 }) / 10000).toFixed(1).padStart(10));
  console.log(('  ' + n).padEnd(16) + row.join(''));
}

console.log('\n=== 两轴的撬动幅度（同编成换武器 vs 同武器换编成）===');
for (const [label, list, gname, g] of [
  ['换武器：纯炮兵 无将→q6', ['纯炮兵'], null, null],
  ['换编成：无将 纯主战→坦40+炮60', null, '无将', G_NONE],
  ['换编成：q6 纯主战→坦40+炮60', null, 'q6', genW(9000)],
]) {
  if (list) {
    const lo = (K = 1, capacity(C['纯炮兵'], G_NONE, { zhuzhan: 1 }) / 10000);
    const hi = (K = 1, capacity(C['纯炮兵'], genW(9000), { zhuzhan: 1 }) / 10000);
    console.log('  ' + label.padEnd(34), lo.toFixed(1) + ' → ' + hi.toFixed(1), ' ×' + (hi / lo).toFixed(1));
  } else {
    const lo = (K = 1, capacity(C['纯主战'], g, { zhuzhan: 1 }) / 10000);
    const hi = (K = 1, capacity(C['坦40+炮60'], g, { zhuzhan: 1 }) / 10000);
    console.log('  ' + label.padEnd(34), lo.toFixed(1) + ' → ' + hi.toFixed(1), ' ×' + (hi / lo).toFixed(1));
  }
}

console.log('\n=== k=0（彻底去将）后：编成能否重新决定胜负 ===');
K = 0;
console.log('  编成'.padEnd(16) + '去将后能打赢(万)'.padStart(16));
const k0 = {};
for (const n of Object.keys(C)) k0[n] = capacity(C[n], G_NONE, { zhuzhan: 1 }) / 10000;
Object.keys(k0).sort((a, b) => k0[b] - k0[a]).forEach(n => console.log(('  ' + n).padEnd(16) + k0[n].toFixed(1).padStart(16)));
K = 1;
