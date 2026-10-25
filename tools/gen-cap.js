/* ============================================================
 * tools/gen-cap.js  将领「单项属性」理论上限测算（终版）
 * ------------------------------------------------------------
 * 用法：node tools/gen-cap.js > tools/gen-cap.log 2>&1
 *
 * 口径严格按 GAME.genAttrs 的链式顺序（不另写一套公式）：
 *   ① 裸身 = 资质基础(最高 roll × 专长系数) + 等级成长 + 自由点 + 升档奖励 + 血清 + 丹药
 *   ② + 装备（19 槽机甲 / 12 槽基因 · 满强化）+ 套装档位（累计）
 *   ③ + 挂件（遗物）
 *   ④ × (1 + 属性符最大加成)      ← 只乘 ①+②+③
 *   ⑤ + 战技（10 重）
 * 末段用真将跑 GAME.genAttrs 逐维复核（表 vs 实算，差 0 才算过）。
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

require(path.join(__dirname, '..', 'js', 'bundle-core.js'));
require(path.join(__dirname, '..', 'js', 'bundle-war.js'));
require(path.join(__dirname, '..', 'js', 'bundle-ui.js'));
const G = global.GAME;
G.newGame({ name: 'cap', cityName: '灰岗', mapSeed: 20261020 });
const D = G.DATA, S = G.state;

const DIMS = { tong: '指挥', yw: '武力', zm: '谋略', nz: '治理' };
const DIMKEYS = Object.keys(DIMS);
const out = [];
const P = (s) => out.push(s);
const R = Math.round;

const TIAN = D.GEN_RANK_BY_ID.tian;
const MAXLV = TIAN.lvCap;
const ENH_MUL = G.eqEnhMulOf({ id: 'x', enh: D.ENHANCE.max });
const LING_MUL = G.lingTemperMulOf(D.LING_TEMPER.max);
const FREE_LV = (MAXLV - 1) * TIAN.grow;
const FREE_LUMP = Object.keys(D.RANKUP_FREE_PTS).reduce((a, k) => a + D.RANKUP_FREE_PTS[k], 0);
const FREE = FREE_LV + FREE_LUMP;
const AWARD = 'liang ying ming tian'.split(' ').reduce((a, k) => a + (D.RANKUP_AWARD[k] || 0), 0);
const ASCEND = 'liang ying ming tian'.split(' ').reduce((a, k) => a + (D.GEN_RANK_BY_ID[k].ascend || 0), 0);
const DAN = 50;

P('======== 将领单项属性理论上限（Lv' + MAXLV + ' · 天启体 · 满强化 / 满符 / 满战技 / 满丹药）========');
P('');
P('【常量】');
P(`  等级上限 ${MAXLV}（天启体成长 ${TIAN.grow}/级，基础 roll 区间 ${TIAN.base[0]}~${TIAN.base[1]}）`);
P(`  机甲熔铸 +${D.ENHANCE.max} → ×${ENH_MUL.toFixed(2)} · 基因调校 +${D.LING_TEMPER.max} → ×${LING_MUL.toFixed(2)}`);
P(`  自由点 = 升级 ${FREE_LV} + 升档 ${FREE_LUMP} = ${FREE}（四维随便投，可全堆一维）`);
P(`  升档直给 ${AWARD} · 血清 inherit ${ASCEND} · 丹药 ${DAN}（每维上限）`);

/* ---------- 装备：逐槽最强 / 整套最强（取高） ---------- */
function picksOf(dim, track) {
  const slots = track === 'ling' ? D.LING_SLOTS_ID : D.EQUIP_SLOTS;
  const picks = {};
  let sum = 0;
  slots.forEach((slot) => {
    let b = null;
    Object.keys(D.EQUIP).forEach((id) => {
      const it = D.EQUIP[id];
      if (it.slot !== slot) return;
      if (!!it.ling !== (track === 'ling')) return;
      if (!b || (it[dim] || 0) > (b[dim] || 0)) b = it;
    });
    if (b && (b[dim] || 0) > 0) { picks[slot] = b; sum += b[dim]; }
  });
  return { picks, sum };
}
function setTotal(dim) {
  let best = { v: 0, name: '-' };
  Object.keys(D.SETS).forEach((sid) => {
    const items = Object.keys(D.EQUIP).filter((id) => D.EQUIP[id].set === sid && !D.EQUIP[id].ling);
    if (!items.length) return;
    const bySlot = {}; items.forEach((id) => { bySlot[D.EQUIP[id].slot] = D.EQUIP[id]; });
    const n = Object.keys(bySlot).length;
    let v = 0;
    Object.keys(bySlot).forEach((s) => { v += (bySlot[s][dim] || 0); });
    v *= ENH_MUL;
    /* v91.92：套装只取已达成的**最高一档**（与 systems.genSetBonus 同口径），不再逐档累加 */
    const eff = D.SETS[sid].eff;
    let top = 0;
    Object.keys(eff).map(Number).forEach((k) => { if (n >= k && k > top) top = k; });
    if (top) v += (eff[top][dim] || 0);
    if (v > best.v) best = { v, name: D.SETS[sid].name, n };
  });
  return best;
}
const bestRelic = (dim) => (D.BAOJU || []).reduce((a, b) => (((b.eff || {})[dim] || 0) > a.v ? { name: b.name, id: b.id, v: b.eff[dim] || 0 } : a), { name: '-', id: null, v: 0 });
const NG = {}; (D.NEIGONG || []).forEach((n) => { if (n.attr) NG[n.attr] = Math.max(NG[n.attr] || 0, n.per * n.maxLv); });
const ngTop = (dim) => (D.NEIGONG || []).reduce((a, n) => (n.attr === dim ? n : a), null);
const bestBuff = (dim) => (D.ITEMS || []).reduce((a, it) => { const m = it.eff && it.eff[dim + '_mult']; return (m && m > a.m) ? { m, name: it.name } : a; }, { m: 0, name: '无' });
function bestStyle(dim) {
  let id = 'balance', m = 0;
  (D.GEN_STYLES || []).forEach((s) => { if ((s.mul[dim] || 0) > m) { m = s.mul[dim]; id = s.id; } });
  return { id, m };
}

const rows = [];
DIMKEYS.forEach((dim) => {
  const st = bestStyle(dim);
  const base = R(TIAN.base[1] * st.m);
  const growTheo = (dim === 'tong') ? FREE_LV : FREE_LV * 4;          /* 3 维每级共 32 点，极值全投一维 */
  let mul = null; (D.GEN_STYLES || []).forEach((s) => { if (s.id === st.id) mul = s.mul; });
  const gw = mul.yw + mul.zm + mul.nz;
  const growExp = (dim === 'tong') ? FREE_LV : R(FREE_LV * 4 * (mul[dim] / gw));
  const bare = base + growTheo + FREE + AWARD + ASCEND + DAN;
  const bareE = base + growExp + FREE + AWARD + ASCEND + DAN;

  const mech = picksOf(dim, 'sha'), ling = picksOf(dim, 'ling');
  const mechT = Math.max(mech.sum * ENH_MUL, setTotal(dim).v);
  const lingT = ling.sum * LING_MUL;
  const eq = Math.max(mechT, lingT);
  const eqTrack = mechT >= lingT ? '机甲' : '基因';
  const rel = bestRelic(dim), ng = NG[dim] || 0, bf = bestBuff(dim);
  const total = R((bare + eq + rel.v) * (1 + bf.m)) + ng;
  const totalE = R((bareE + eq + rel.v) * (1 + bf.m)) + ng;
  rows.push({ dim, name: DIMS[dim], style: st.id, base, growTheo, bare, bareE, eq, eqTrack, rel, ng, bf, total, totalE });
});

P('');
P('【逐维拆解】');
P(['属性', '专长', '基础', '等级成长', '自由点', '升档+丹', '裸身', '装备', '遗物', '符', '战技', '上限'].join('\t'));
rows.forEach((r) => P([r.name, r.style, r.base, r.growTheo, FREE, AWARD + ASCEND + DAN, r.bare,
  `${R(r.eq)}(${r.eqTrack})`, r.rel.v, `+${R(r.bf.m * 100)}%`, `+${r.ng}`, r.total].join('\t')));

P('');
P('【理论极值 vs 实际可期】');
P(['属性', '理论极值', '实际可期(按专长分布掷点)', '倍数'].join('\t'));
rows.forEach((r) => P([r.name, r.total, r.totalE, (r.total / r.totalE).toFixed(2) + '×'].join('\t')));

/* ---------- 真将复核 ---------- */
P('');
P('【真将复核 · GAME.genAttrs 实算】');
const g = S.generals[0];
g.isLord = true; g.rank = 'tian'; g.level = MAXLV; g.perm = { tong: DAN, nz: DAN, yw: DAN, zm: DAN };
g.status = 'idle';
S.buffs = S.buffs || {}; S.buffs.gens = S.buffs.gens || {};
S.items = S.items || {};

DIMKEYS.forEach((dim) => {
  const r = rows.find((x) => x.dim === dim);
  const res = {};
  ['sha', 'ling'].forEach((track) => {
    g.equipOn = track === 'ling' ? 'ling' : 'sha';
    g.style = r.style;
    DIMKEYS.forEach((d) => { g[d] = (d === dim) ? r.bare : 0; });
    const bag = {};
    const pk = picksOf(dim, track).picks;
    Object.keys(pk).forEach((slot) => { bag[slot] = { id: pk[slot].id, enh: D.LING_TEMPER.max }; });
    if (track === 'ling') { g.lingEquip = bag; g.equip = {}; } else { g.equip = bag; g.lingEquip = {}; }
    const rel = bestRelic(dim);
    g.attach = rel.id ? { bao: rel.id } : null; if (rel.id) S.items[rel.id] = 1;
    const n = ngTop(dim); g.ng = n ? { id: n.id, lv: n.maxLv } : null;
    const bf = bestBuff(dim);
    S.buffs.gens[g.id] = bf.m > 0 ? { chip: { tong_mult: dim === 'tong' ? bf.m : 0, yw_mult: dim === 'yw' ? bf.m : 0, zm_mult: dim === 'zm' ? bf.m : 0, nz_mult: dim === 'nz' ? bf.m : 0, until: Date.now() + 36e5 } } : {};
    res[track] = G.genAttrs(g)[dim];
  });
  const real = Math.max(res.sha, res.ling);
  P(`  ${r.name}：表 ${r.total} · 实算 机甲 ${res.sha} / 基因 ${res.ling} → 差 ${real - r.total}`);
});

/* ---------- 速度 / 体力 ---------- */
P('');
P('【速度 / 体力上限】');
(function () {
  const spdEq = (() => {
    let s = 0;
    D.EQUIP_SLOTS.forEach((slot) => {
      let b = 0;
      Object.keys(D.EQUIP).forEach((id) => {
        const it = D.EQUIP[id];
        if (it.slot === slot && !it.ling) b = Math.max(b, Math.min(6, (it.spd || 0) * ENH_MUL));
      });
      s += b;
    });
    return s;
  })();
  const spdBuf = (D.ITEMS || []).reduce((a, it) => Math.max(a, (it.eff && it.eff.spd) || 0), 0);
  const spdBase = D.GEN_BASE.speed + Math.floor((MAXLV - 1) / (D.SPD_CAP.perLevels || 5));
  P(`  速度：${spdBase}(出身+等级) + ${R(spdEq)}(机甲件，单件封顶 6) + ${spdBuf}(符) = ${spdBase + R(spdEq) + spdBuf}`);

  const g2 = S.generals[0];
  g2.rank = 'tian'; g2.level = MAXLV; g2.nz = rows.find((x) => x.dim === 'nz').bare;
  g2.equip = {}; g2.lingEquip = {}; g2.attach = null; g2.ng = null; g2.equipOn = 'sha';
  D.EQUIP_SLOTS.forEach((slot) => {
    let best = null;
    Object.keys(D.EQUIP).forEach((id) => { const it = D.EQUIP[id]; if (it.slot === slot && !it.ling && (!best || (it.sta || 0) > (best.sta || 0))) best = it; });
    if (best && (best.sta || 0) > 0) g2.equip[slot] = { id: best.id, enh: D.LING_TEMPER.max };
  });
  const staBuff = (D.ITEMS || []).filter((it) => it.type === 'attr_buff').reduce((a, it) => Math.max(a, (it.eff && it.eff.sta) || 0), 0);
  const _relSta = (D.BAOJU || []).reduce((a, b) => Math.max(a, (b.eff && b.eff.sta) || 0), 0);
  const _gRel = Object.assign({}, g2, { attach: { bao: (D.BAOJU || []).reduce((x, b) => ((b.eff && b.eff.sta || 0) > ((x.eff && x.eff.sta) || 0) ? b : x), D.BAOJU[0]).id } });
  S.items[_gRel.attach.bao] = 1;
  S.buffs.gens[g2.id] = { chip: { sta: staBuff, until: Date.now() + 36e5 } };
  P(`  挂件体力：遗物最高 +${_relSta}，staEquipOf 只读装备 → 当前不进体力上限（实算 ${R(G.staMax(_gRel)) - R(G.staMax(g2))}）`);
  P(`  体力上限：${R(G.staBaseMax(g2))}(等级+治理 ${g2.nz} 放大) + ${R(G.staEquipOf(g2))}(装备) = ${R(G.staMax(g2))}`);
})();

/* ---------- 武力极值的派生 ---------- */
P('');
P('【武力极值的派生：全军攻击 %】');
(function () {
  const dim = 'yw', r = rows.find((x) => x.dim === dim);
  const g3 = S.generals[0];
  g3.isLord = true; g3.rank = 'tian'; g3.level = MAXLV; g3.style = r.style;
  g3.perm = { tong: DAN, nz: DAN, yw: DAN, zm: DAN }; g3.equipOn = 'sha'; g3.lingEquip = {};
  DIMKEYS.forEach((d) => { g3[d] = (d === dim) ? r.bare : 0; });
  const bag = {}; const pk = picksOf(dim, 'sha').picks;
  Object.keys(pk).forEach((slot) => { bag[slot] = { id: pk[slot].id, enh: D.LING_TEMPER.max }; });
  g3.equip = bag;
  const rel = bestRelic(dim); g3.attach = { bao: rel.id }; S.items[rel.id] = 1;
  const n = ngTop(dim); g3.ng = { id: n.id, lv: n.maxLv };
  S.buffs.gens[g3.id] = { chip: { yw_mult: 1, until: Date.now() + 36e5 } };
  const A = G.genAttrs(g3);
  P(`  武力 ${A.yw} → 全军攻击 +${R(A.atkPct * 100)}%（武力 ${A.yw}×0.05% = +${(A.yw * 0.0005 * 100).toFixed(0)}%，装备/套装攻击值 ${A.atk} → +${(A.atk / 1000 * 100).toFixed(0)}%）`);
})();

require('fs').writeFileSync(path.join(__dirname, 'gen-cap.log'), out.join('\n') + '\n');
console.log(out.join('\n'));

/* ============================================================
 * 满配价值换算：属性的"上限"不等于"价值"—— 逐维读到实际战斗效果
 * ============================================================ */
(function () {
  const lines = [];
  function build(dim, withBuff, track) {
    const r = rows.find((x) => x.dim === dim);
    const g5 = S.generals[0];
    g5.isLord = true; g5.rank = 'tian'; g5.level = MAXLV; g5.style = r.style;
    g5.perm = { tong: DAN, nz: DAN, yw: DAN, zm: DAN };
    g5.equipOn = track === 'ling' ? 'ling' : 'sha'; g5.lingEquip = {}; g5.equip = {};
    DIMKEYS.forEach((d) => { g5[d] = (d === dim) ? r.bare : 0; });
    const bag = {}; const pk = picksOf(dim, track).picks;
    Object.keys(pk).forEach((slot) => { bag[slot] = { id: pk[slot].id, enh: D.LING_TEMPER.max }; });
    if (track === 'ling') g5.lingEquip = bag; else g5.equip = bag;
    const rel = bestRelic(dim); g5.attach = rel.id ? { bao: rel.id } : null; if (rel.id) S.items[rel.id] = 1;
    const n = ngTop(dim); g5.ng = n ? { id: n.id, lv: n.maxLv } : null;
    const bf = withBuff ? bestBuff(dim) : { m: 0 };
    S.buffs.gens[g5.id] = bf.m > 0 ? { chip: { tong_mult: dim === 'tong' ? bf.m : 0, yw_mult: dim === 'yw' ? bf.m : 0, zm_mult: dim === 'zm' ? bf.m : 0, nz_mult: dim === 'nz' ? bf.m : 0, until: Date.now() + 36e5 } } : {};
    return { g: g5, A: G.genAttrs(g5) };
  }
  const yw = build('yw', true, 'sha'), yw0 = build('yw', false, 'sha');
  const zm = build('zm', true, 'sha'), zm0 = build('zm', false, 'sha');
  const tong = build('tong', true, 'sha'), nz = build('nz', true, 'sha');

  lines.push(`武力 ${yw.A.yw}（无符 ${yw0.A.yw}）→ 全军攻击 +${R(yw.A.atkPct * 100)}%（无符 +${R(yw0.A.atkPct * 100)}%）`);
  lines.push(`  拆分：武力贡献 +${R(yw.A.yw * 0.05)}% · 装备/套装攻击值 ${yw.A.atk} 贡献 +${R(yw.A.atk / 10)}%  → 装备是武力的 ${(yw.A.atk / 10 / (yw.A.yw * 0.05)).toFixed(1)} 倍`);
  lines.push(`谋略 ${zm.A.zm} → 全军防御 +${R(zm.A.defPct * 100)}%（无符 +${R(zm0.A.defPct * 100)}%）· 装备 ${zm.A.def} 贡献 +${R(zm.A.def / 10)}%`);
  const coverCap = R(tong.A.tong * 100);
  lines.push(`指挥 ${tong.A.tong} → 覆盖 ${coverCap.toLocaleString()} 兵/兵种`);
  [1500, 5000, 30000, 50000, 150000].forEach((n) => {
    const need = Math.ceil(n / 100);
    lines.push(`    覆盖 ${n.toLocaleString()} 兵/兵种 只需指挥 ${need.toLocaleString()}（占上限 ${(need / tong.A.tong * 100).toFixed(1)}%）`);
  });
  const sta = R(G.staMax(nz.g));
  lines.push(`治理 ${nz.A.nz} → 体力上限 ${sta.toLocaleString()} → 全军生命 +${R(G.staHpPct(sta) * 100)}%`);
  lines.push(`速度 221 → 单位移速 ×${(1 + 221 / 300).toFixed(2)}（引擎 spd×(1+a.spd/300)）`);
  P(''); P('【满配价值换算】'); lines.forEach((l) => P('  ' + l));
  out[out.length - 0] = out[out.length - 0];
  require('fs').writeFileSync(path.join(__dirname, 'gen-cap.log'), out.join('\n') + '\n');
  console.log('\n' + lines.join('\n'));
})();

/* ---------- 套装档位：只取最高档（天罚套为例 · v91.92 口径） ---------- */
(function () {
  const lines = [];
  const sid = 'divine_zhan', def = D.SETS[sid];
  const n = Object.keys(D.EQUIP).filter((id) => D.EQUIP[id].set === sid).length;
  lines.push(`${def.name}：共 ${n} 件（19 槽全覆盖），档位 3/5/7/11/15/19，**只生效已达成的最高一档**`);
  ['atk', 'yw', 'tong', 'def'].forEach((k) => {
    const ks = Object.keys(def.eff).map(Number).sort((a, b) => a - b);
    const cells = ks.map((t) => `${t}件:${def.eff[t][k] || 0}`);
    lines.push(`  ${k}  ${cells.join(' → ')}`);
  });
  P(''); P('【套装档位 · 取最高档】'); lines.forEach((l) => P('  ' + l));
  require('fs').writeFileSync(path.join(__dirname, 'gen-cap.log'), out.join('\n') + '\n');
  console.log('\n' + lines.join('\n'));
})();
