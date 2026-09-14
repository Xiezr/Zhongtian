/* v43 战斗数值探针：复现"2000 铁骑兵一轮只打死 80 个长枪兵"。
   打印兵种属性 → 单轮杀伤的每一项中间量 → 判定是否被单轮上限卡住。 */
global.window = global;
global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
function makeEl() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    getContext() { var noop = function () {}; return { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop, drawImage: noop, clearRect: noop, fillRect: noop, strokeRect: noop, beginPath: noop, arc: noop, ellipse: noop, save: noop, restore: noop, clip: noop, rect: noop, translate: noop, scale: noop, rotate: noop, fill: noop, stroke: noop, moveTo: noop, lineTo: noop, closePath: noop, quadraticCurveTo: noop, bezierCurveTo: noop, fillText: noop, strokeText: noop, setLineDash: noop, measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), createPattern: () => null, roundRect: noop }; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const _c = {};
global.document = { createElement: makeEl, querySelector(s) { return _c[s] || (_c[s] = makeEl()); }, querySelectorAll: () => [], addEventListener() {}, readyState: 'complete', _cache: _c };
global.requestAnimationFrame = f => f && f();
global.location = { search: '', href: 'file:///index.html' };
global.addEventListener = function () {}; global.removeEventListener = function () {};
global.getComputedStyle = () => ({ getPropertyValue: () => '' });
global.innerWidth = 1440; global.innerHeight = 900;

['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui'].forEach(m => require('E:/Deepseekdb/js/' + m + '.js'));

const G = window.GAME, D = G.DATA, T = G.tactic;

console.log('===== 一、相关兵种属性 =====');
const want = /铁骑|长枪|弓箭|轻骑/;
Object.keys(D.TROOPS).forEach(id => {
  const t = D.TROOPS[id];
  if (want.test(t.name || '')) {
    console.log('%s  (%s)  atk=%s def=%s hp=%s range=%s spd=%s pop=%s craft=%s',
      (t.name || '').padEnd(5), id.padEnd(14), t.atk, t.def, t.hp, t.range, t.spd, t.pop, !!t.craft);
  }
});
console.log('\nCLASH =', JSON.stringify(D.CLASH), ' COUNTER_MULT =', D.COUNTER_MULT);
console.log('COUNTER =', JSON.stringify(D.COUNTER));
console.log('VOLLEY_CAP =', T.VOLLEY_CAP, ' MARCH_UNIT =', T.MARCH_UNIT);

G.newGame({ cityName: '探针城' });
const s = G.state;

function probe(atkArmy, defArmy, kind, label) {
  console.log('\n===== ' + label + ' =====');
  console.log('攻方 ' + JSON.stringify(atkArmy) + '   守方 ' + JSON.stringify(defArmy) + '  (kind=' + kind + ')');
  const gen = s.generals[0] || null;
  const r = T.simulate(atkArmy, gen, defArmy, 0, null, { kind: kind || 'wild' });
  (r.log || []).slice(0, 8).forEach(function (line) { console.log('  ' + line); });
  console.log('  → winner=' + r.winner + '  我剩 ' + r.atkRemain + ' 敌剩 ' + r.defRemain
    + '  共 ' + r.rounds + ' 回合  我方损失 ' + r.atkLoss + '  守方损失 ' + r.defLoss);
  return r;
}

/* 用户描述的场景：2000 铁骑 vs 小股守军 */
probe({ tieji: 2000 }, { changqiang: 240 }, 'wild', '场景 A：2000 铁骑 vs 240 长枪兵');
probe({ tieji: 2000 }, { changqiang: 240, gongbing: 120 }, 'wild', '场景 B：2000 铁骑 vs 240 长枪 + 120 弓兵');
probe({ tieji: 2000 }, { changqiang: 2000 }, 'wild', '场景 C：2000 铁骑 vs 2000 长枪（对等）');

/* 单轮杀伤的中间量分解 */
console.log('\n===== 二、单轮杀伤中间量分解（场景 A 的第一次攻击）=====');
(function () {
  const u = T.unitsOf({ tieji: 2000 }, 'atk', s.generals[0])[0];
  const e = T.unitsOf({ changqiang: 240 }, 'def', null)[0];
  const perA = T.perAtk(u, {});
  const perD = T.perDef(e);
  const perHp = T.perHp(e, null);
  const clash = T.clashFactor(perA, perD);
  const av = perA * u.count;
  const eff = av * clash;
  const raw = Math.floor(eff / perHp);
  const cap = Math.max(1, Math.ceil(e.count * T.VOLLEY_CAP));
  console.log('  单兵攻击 perA      = ' + perA.toFixed(2));
  console.log('  攻方数量           = ' + u.count);
  console.log('  攻击总值 av        = ' + av.toFixed(0));
  console.log('  守方单兵防御 perD  = ' + perD.toFixed(2));
  console.log('  对冲系数 clash     = ' + clash.toFixed(3) + '  (2A/(A+D) = ' + (2 * perA / (perA + perD)).toFixed(3) + ')');
  console.log('  有效攻击 eff       = ' + eff.toFixed(0));
  console.log('  守方单兵生命 perHp = ' + perHp.toFixed(2));
  console.log('  自然杀伤 floor(eff/perHp) = ' + raw);
  console.log('  单轮上限 ceil(240×1/3)    = ' + cap + '   <<<< 若 raw 远大于此，说明被上限截断');
  console.log('  实际杀伤 = min(raw, cap)  = ' + Math.min(raw, cap));
})();
