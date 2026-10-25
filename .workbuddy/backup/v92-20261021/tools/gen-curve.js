/* 三种"装备攻击刻度"下的战力结构对比（只读，不改引擎）
   刻度 0 现状：atkPct = atk / 1000        （q1 260 → +26%，q6 9000 → +900%）
   刻度 1 平方根压缩：atkPct = (atk/1000)^0.6，上限 2.0
   刻度 2 软饱和：atkPct = 2.0 × (1 − e^(−atk/3000))
   输出：每种刻度下「同一编成换武器」与「同一武器换编成」的撬动幅度
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
G.newGame({ name: 'curve', cityName: '灰岗', mapSeed: 20261016 });

/* 当前武器攻击值（由脚本注入） */
let W_ATK = 0;
let CURVE = 'raw';
const raw = G.genAttrs;
G.genAttrs = function (g) {
  const a = raw.call(G, g);
  const o = Object.assign({}, a);
  if (!W_ATK) { o.atkPct = 0; o.defPct = 0; return o; }
  let pct;
  if (CURVE === 'raw') pct = W_ATK / 1000;
  else if (CURVE === 'sqrt') pct = Math.min(2.0, Math.pow(W_ATK / 1000, 0.6));
  else pct = 2.0 * (1 - Math.exp(-W_ATK / 3000));
  o.atkPct = pct;
  return o;
};

function comp(shares, pop) {
  const out = {};
  for (const id in shares) out[id] = Math.max(1, Math.round(shares[id] * pop / D.TROOPS[id].pop));
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
const DEF = { zhuzhan: 1 };

const DUMMY_GEN = { id: 'g', name: 't', level: 1, tong: 100, yw: 0, zm: 0, nz: 0, speed: 20, sta: 400, staMax: 400, equip: {}, attach: [] };
function capacity(atk) {
  const probe = n => {
    const r = G.tactic.simulate(atk, DUMMY_GEN, comp(DEF, n), 0, null, { kind: 'wild', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 8000, hi = 3000000;
  for (let i = 0; i < 18; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) lo = m; else hi = m; }
  return lo;
}

const WEAP = [['无将', 0], ['q1 260', 260], ['q3 1400', 1400], ['q4 2800', 2800], ['q5 5200', 5200], ['q6 9000', 9000]];
const NAMES = ['纯主战', '纯炮兵', '纯泰坦', '纯轰炸', '主战70+炮30', '坦40+炮60', '主战+炮+轰'];

for (const cv of ['raw', 'sqrt', 'sat']) {
  CURVE = cv;
  console.log('\n########## 刻度 = ' + cv + ' ##########');
  const T = {};
  for (const n of NAMES) {
    T[n] = [];
    for (const [, a] of WEAP) { W_ATK = a; T[n].push(capacity(C[n]) / 10000); }
  }
  console.log('  编成'.padEnd(15) + WEAP.map(w => w[0].padStart(9)).join(''));
  for (const n of NAMES) console.log(('  ' + n).padEnd(15) + T[n].map(v => v.toFixed(1).padStart(9)).join(''));

  /* 换武器：纯炮兵 与 坦40+炮60 */
  for (const n of ['纯炮兵', '坦40+炮60']) {
    const lo = T[n][0], hi = T[n][T[n].length - 1];
    console.log('    换武器 ' + n.padEnd(10) + ' ' + lo.toFixed(1) + ' → ' + hi.toFixed(1) + '  ×' + (hi / lo).toFixed(1));
  }
  /* 换编成：无将 / q6，去除最差的轰炸 */
  for (const [label, idx] of [['无将', 0], ['q6', 5]]) {
    const vals = NAMES.filter(n => n !== '纯轰炸').map(n => T[n][idx]);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    console.log('    换编成 ' + label.padEnd(4) + '（不含轰炸） ' + lo.toFixed(1) + ' → ' + hi.toFixed(1) + '  ×' + (hi / lo).toFixed(1));
  }
}
