/* 验收：开关关/开两种口径下，野地/据点守将的「属性比 / 守军数 / 战力」 */
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
require('../js/bundle-core.js');
require('../js/bundle-war.js');
require('../js/bundle-ui.js');
const G = window.GAME, D = G.DATA;
const st = G.newGame({ name: 'acc', cityName: '灰岗', mapSeed: 20261016 });

function playerGen(lv) {
  const g = G.makeGeneral('玩家将', lv, 'idle', null, true, 'tian', 'balance');
  G.rankOf(g); G.guardFillOf(g);
  return g;
}
/* 用真实生成入口（wildDefenseAt）取守将，确保走的是引擎链路 */
function wildAt(lv, x) {
  return G.wildDefenseAt(function (a, b) { return 0; } && 0, lv) || null;
}
const ATK = {}; (function () { const t = D.TROOPS.zhuzhan; ATK.zhuzhan = Math.round(100000 / t.pop); })();
const PG = playerGen(240);
function capacity(gen) {
  const probe = n => {
    const def = { zhuzhan: Math.max(1, Math.round(n / D.TROOPS.zhuzhan.pop)) };
    const r = G.tactic.simulate(ATK, PG, def, 0, gen, { kind: 'wild', pid: 1 });
    return r.winner === 'atk';
  };
  let lo = 2000, hi = 4000000;
  for (let i = 0; i < 18; i++) { const m = Math.floor((lo + hi) / 2); if (probe(m)) lo = m; else hi = m; }
  return lo / 10000;
}

/* 取一个真实野地（用球面坐标换 ci） */
const sp = G.sphereOf(1);
const ci = sp && sp.ciOfXY ? sp.ciOfXY(300, 300) : 0;

function run(label) {
  console.log('\n========== ' + label + ' ==========');
  console.log('  野地  守将Lv  资质    属性比  守军数  战力(可打赢守军万人口)');
  for (const wl of [1, 5, 10]) {
    const wd = G.wildDefenseAt(ci, wl);
    if (!wd) { console.log('  Lv' + wl + ' 无野地'); continue; }
    const glv = wd.gen ? wd.gen.level : 0;
    const rk = wd.gen ? (D.GEN_RANK_BY_ID[wd.gen.rank] || {}).name : '无将';
    const P = G.genAttrs(playerGen(glv || 60)).tong;
    const ratio = wd.gen ? (G.genAttrs(wd.gen).tong / P) : 0;
    const cap = capacity(wd.gen);
    console.log('  Lv' + String(wl).padEnd(4) + String(glv).padStart(6) + '  ' + String(rk).padEnd(6)
      + ratio.toFixed(2).padStart(7) + String(wd.total).padStart(9) + cap.toFixed(1).padStart(10));
  }
  /* 据点 */
  const fg = G.map.fortGarrison(10);
  const fTotal = Object.values(fg).reduce((a, b) => a + b, 0);
  console.log('  据点Lv10 守军数 ' + fTotal + '（折损档 ' + JSON.stringify(G.guardBal.fold()) + '）');
}

console.log('玩家将 Lv120 四维基准 = ' + G.genAttrs(playerGen(120)).tong);
st.settings.guardBalance = false;
run('开关关（v91.86 现状）');
st.settings.guardBalance = true;
run('开关开（v91.87 守将≈玩家的 0.8）');
st.settings.guardBalance = false;
