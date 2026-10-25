/* 战斗条件全表：把引擎里所有能改战斗结果的通道列出来，并给出可达到的上限 */
const path = require('path');
global.window = global; global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900; global.navigator = { userAgent: 'node' };
global.addEventListener = () => { }; global.removeEventListener = () => { };
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => { };
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() { return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { return false; } }, addEventListener() { }, appendChild() { }, setAttribute(k, v) { this._attrs[k] = v; }, getAttribute() { return null; }, querySelector() { return makeEl(); }, querySelectorAll() { return []; }, getContext() { const n = () => { }; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); }, getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } }; }
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [], getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() { }, readyState: 'complete' };
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
G.newGame({ name: 'fac', cityName: '灰岗', mapSeed: 20261016 });
const P = console.log;

P('=== A. 引擎常数（与玩家无关的固定项）===');
P('  攻防对冲 clashFactor = 2·K·A/(A+D)，K = ' + D.CLASH.K + '（A=D 时 1.00，A≫D 封顶 2K=' + (2 * D.CLASH.K) + '）');
P('  射程衰减：贴身(≤' + G.tactic.CLOSE_RANGE + ') ×' + G.tactic.DECAY_CLOSE +
  ' · 半程内 ×1 · 半程外 ×' + G.tactic.DECAY_FAR + '（射程 <' + G.tactic.DECAY_MIN_RANGE + ' 近战不衰减）');
P('  城头射击 ×' + G.tactic.WALL_FIRE_MUL + ' · 攻城器械对城 ×' + G.tactic.CRAFT_SIEGE_MULT);

P('');
P('=== B. 科技（每条 3%/级，全表求和）===');
const sumTech = t => (D.TECH_ALL || D.TECH).filter(x => x.type === t).reduce((a, x) => a + (x.lv || 0) * (x.per || 0), 0);
for (const t of ['atk', 'def', 'hp']) P('  ' + t.padEnd(4) + ' 满级 +' + (100 * sumTech(t)).toFixed(0) + '%');

P('');
P('=== C. 羁绊（同时只能挂几组？取单组最高）===');
const bmax = k => Math.max(0, ...D.BONDS.map(b => (b.bonus && b.bonus[k]) || 0));
P('  atk +' + (100 * bmax('atk')).toFixed(0) + '% · def +' + (100 * bmax('def')).toFixed(0) +
  '% · lead +' + (100 * bmax('lead')).toFixed(0) + '% · siege +' + (100 * bmax('siege')).toFixed(0) + '%');
P('  ⚠ lead 直接乘在出征上限上 → 上限可从 10 万抬到 ' + (100000 * (1 + bmax('lead')) / 10000) + ' 万');

P('');
P('=== D. 将领（四维 → atkPct/defPct/hpMult/spd/cover）===');
function gen(lv, rank, equip) {
  const g = G.makeGeneral('将', lv, 'idle', null, true, rank, 'balance');
  G.rankOf(g); G.guardFillOf(g);
  if (equip) g.equip = equip;
  return g;
}
P('  等级  资质    atkPct   defPct   血量×   速度    指挥覆盖');
for (const [lv, rk] of [[12, 'ying'], [60, 'ming'], [120, 'tian'], [180, 'tian'], [240, 'tian']]) {
  const g = gen(lv, rk, null);
  const a = G.genAttrs(g);
  P('  ' + String(lv).padEnd(5) + rk.padEnd(7) + (100 * a.atkPct).toFixed(0).padStart(7) + '%' +
    (100 * a.defPct).toFixed(0).padStart(8) + '%' + (G.battle.hpMult ? G.battle.hpMult(g) : 1).toFixed(2).padStart(8) +
    '  +' + ((g.spd || 0) / 3).toFixed(0) + '%' + (g.tong * 100).toFixed(0).padStart(10) + ' 兵');
}
P('');
P('=== E. 装备（16 槽，取全表最高值累加）===');
const eq = Object.values(D.EQUIP || {});
P('  装备件数 ' + eq.length + ' · 槽位 ' + Array.from(new Set(eq.map(e => e.slot))).join('/'));
const maxBy = k => { const m = {}; eq.forEach(e => { if ((e[k] || 0) > (m[e.slot] || 0)) m[e.slot] = e[k] || 0; }); return Object.values(m).reduce((a, b) => a + b, 0); };
P('  满配 atk ' + maxBy('atk') + ' → atkPct +' + (maxBy('atk') / 10).toFixed(0) + '%' +
  ' · def ' + maxBy('def') + ' → defPct +' + (maxBy('def') / 10).toFixed(0) + '%' +
  ' · sta ' + maxBy('sta'));

P('');
P('=== F. 战场/城市/环境 ===');
P('  城防值减伤：defBonus = 目标 defVal（箭塔/城墙/城防建筑累加）→ 伤害 ×(1−defBonus)');
P('  城墙等级 wallLv：走 cityDefense，只对攻城生效；箭塔 towers：城头额外齐射');
P('  出城迎战 sortie：守方前出到墙外，失去城墙保护但先接敌');
P('  星球环境 6 条：' + Object.keys(D.PLANET_ENV).join('/'));
P('  天时 world → combatMod：' + (G.story.combatMod ? G.story.combatMod().toFixed(2) : '-'));
P('');
P('=== G. 出征上限（决定"能带多少兵上场"）===');
P('  容量 = 练兵场等级 × 10000 × (1+专精) × (1+羁绊 lead) × 军事 buff');
const city = G.state.cities[0];
P('  当前城实际容量 ' + G.battle.marchCapOf(city) + '（练兵场 Lv' + (G.buildingLevel(city, 'xiaochang') || 0) + '）');
P('  理论最大：Lv10 练兵场 + 节钺2 + 五锋 lead+50% = ' + Math.round(120000 * 1.5) + ' 人');
