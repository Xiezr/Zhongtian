#!/usr/bin/env node
/* ============================================================
 * fast-test.js —— 数值规则的**毫秒级**验证（约 0.2 秒）
 * ------------------------------------------------------------
 * 为什么要有它：
 *   全量 smoke 4419 条约 9 分钟，gate 全量 691 秒。
 *   而调平衡（改个产量系数 / 兵种血量）最想知道的是**一件事**：
 *   「我改的这个数，生效了吗？」
 *   等 9 分钟才知道，等于没有反馈。
 *
 * 它测什么（关键）：
 *   **不测"数值等于多少"，测"改数据 → 结果必须变"。**
 *   这样你调平衡时它不会红（因为数值本来就该变），
 *   但一旦有人加了缓存/写死了常量/接错了字段，它立刻红。
 *
 * 它不测什么：
 *   流程、界面、存档、战斗全流程 —— 那些归 smoke / e2e。
 *
 * 用法：
 *   node .workbuddy/tools/fast-test.js
 *   退出码 0 = 全过；1 = 有红。
 * ============================================================ */
'use strict';

/* ---------- 最小启动（不用 jsdom：data/rules/battle 都能在裸 node 里跑） ---------- */
global.window = global;
require('../../../js/data.js');
require('../../../js/rules.js');
require('../../../js/battle.js');

const G = global.GAME;
const DATA = G.DATA;
const R = G.rules;

let PASS = 0, FAIL = 0;
const t0 = Date.now();

function t(name, fn) {
  try { fn(); PASS++; console.log('  ✅ ' + name); }
  catch (e) { FAIL++; console.log('  ❌ ' + name + '   [' + (e && e.message) + ']'); }
}
function gt(a, b, m) { if (!(a > b)) throw new Error(m + '：期望 > ' + b + '，实得 ' + a); }
function lt(a, b, m) { if (!(a < b)) throw new Error(m + '：期望 < ' + b + '，实得 ' + a); }
function eq(a, b, m) { if (a !== b) throw new Error(m + '：期望 ' + b + '，实得 ' + a); }
/* 临时改一个数据字段，跑完必还原（哪怕抛异常） */
function withData(obj, key, val, fn) {
  const bak = obj[key];
  const had = Object.prototype.hasOwnProperty.call(obj, key);
  obj[key] = val;
  try { return fn(); }
  finally { if (had) obj[key] = bak; else delete obj[key]; }
}

console.log('\n══ 数值规则快测（改数据 → 结果必须跟着变）══\n');

/* ============================================================
 * ① 兵种战力：DATA.TROOPS 的 hp/atk/def/spd 必须真的进公式
 * ============================================================ */
const TROOP = Object.keys(DATA.TROOPS)[0];
t('troopPower：兵种 hp 翻倍 → 战力必须变大（' + TROOP + '）', () => {
  const before = R.troopPower(TROOP);
  const after = withData(DATA.TROOPS[TROOP], 'hp', DATA.TROOPS[TROOP].hp * 2, () => R.troopPower(TROOP));
  gt(after, before, 'hp 翻倍');
});
t('troopPower：atk 归零 → 战力必须变小', () => {
  const before = R.troopPower(TROOP);
  const after = withData(DATA.TROOPS[TROOP], 'atk', 0, () => R.troopPower(TROOP));
  lt(after, before, 'atk 归零');
});
t('troopPower：未知兵种返回 0（不抛、不返回 NaN）', () => {
  eq(R.troopPower('__不存在__'), 0, '未知兵种');
});
t('troopPower：权重表 DATA.POWER.troopWeight 真的被用', () => {
  const before = R.troopPower(TROOP);
  const after = withData(DATA.POWER.troopWeight, 'hp', DATA.POWER.troopWeight.hp * 3, () => R.troopPower(TROOP));
  gt(after, before, 'hp 权重 ×3');
});

/* ============================================================
 * ② 产量倍率：季节与天气的 grain 加成必须都进
 * ============================================================ */
G.state = { world: { season: 0, weather: 'clear' } };
t('prodMult：季节 grain 加成 0 → 0.5，倍率必须上升', () => {
  const lo = withData(DATA.SEASONS[0], 'grain', 0, () => R.prodMult('grain'));
  const hi = withData(DATA.SEASONS[0], 'grain', 0.5, () => R.prodMult('grain'));
  gt(hi, lo, '季节加成');
});
t('prodMult：天气 grain 加成 0 → 0.5，倍率必须上升', () => {
  const lo = withData(DATA.WEATHERS.clear, 'grain', 0, () => R.prodMult('grain'));
  const hi = withData(DATA.WEATHERS.clear, 'grain', 0.5, () => R.prodMult('grain'));
  gt(hi, lo, '天气加成');
});
t('prodMult：非 grain 资源不受 grain 加成影响（口径隔离）', () => {
  const a = withData(DATA.SEASONS[0], 'grain', 0, () => R.prodMult('wood'));
  const b = withData(DATA.SEASONS[0], 'grain', 0.9, () => R.prodMult('wood'));
  eq(a, b, 'wood 不该被 grain 加成带动');
});
t('prodMult：无 state 时不抛（回落到默认季节天气）', () => {
  const bak = G.state;
  G.state = null;
  try { const v = R.prodMult('grain'); if (!(v > 0)) throw new Error('应 > 0，实得 ' + v); }
  finally { G.state = bak; }
});

/* ============================================================
 * ③ 战斗修正：天气的 archerRange / fire 必须进 combatMod
 * ============================================================ */
t('combatMod：天气 archerRange 0 → 0.5，射程修正必须上升', () => {
  const lo = withData(DATA.WEATHERS.clear, 'archerRange', 0, () => R.combatMod().archerRange);
  const hi = withData(DATA.WEATHERS.clear, 'archerRange', 0.5, () => R.combatMod().archerRange);
  gt(hi, lo, '射程修正');
});
t('combatMod：天气 fire 直接透传（不是 1+fire）', () => {
  const v = withData(DATA.WEATHERS.clear, 'fire', 0.7, () => R.combatMod().fire);
  eq(v, 0.7, 'fire 应原样透传');
});
t('combatMod：scout=false 时 scout 必须为 false（不是被 || 吃掉）', () => {
  const v = withData(DATA.WEATHERS.clear, 'scout', false, () => R.combatMod().scout);
  eq(v, false, 'scout false 被吞');
});

/* ============================================================
 * ④ 季节/天气取值：state.world 变 → 取值必须变
 * ============================================================ */
t('currentSeason：state.world.season 变 → 季节必须跟着变', () => {
  const bak = G.state;
  G.state = { world: { season: 0, weather: 'clear' } };
  const s0 = R.currentSeason();
  G.state.world.season = 1;
  const s1 = R.currentSeason();
  G.state = bak;
  if (s0 === s1) throw new Error('换季后季节没变（可能被缓存）');
});
t('currentWeather：非法 weather 键 → 回落 clear（不抛 undefined）', () => {
  const bak = G.state;
  G.state = { world: { season: 0, weather: '__不存在__' } };
  const w = R.currentWeather();
  G.state = bak;
  if (!w || !w.id) throw new Error('未回落到默认天气');
  eq(w.id, 'clear', '应回落到 clear');
});

/* ============================================================
 * ⑤ 出征人头数：marchMenOf 只数人头
 * ============================================================ */
t('marchMenOf：逐兵种求和且向下取整', () => {
  eq(G.battle.marchMenOf({ a: 100, b: 250 }), 350, '求和');
  eq(G.battle.marchMenOf({ a: 100.9 }), 100, '小数向下取整');
  eq(G.battle.marchMenOf({}), 0, '空军队');
  eq(G.battle.marchMenOf(null), 0, 'null 不抛');
});

/* ============================================================
 * ⑥ 调参护栏（v157.29 · 调参自检第 3 轮）
 * ------------------------------------------------------------
 * 来历：3 轮自检里，"尺子口径错了"出现两次 ——
 *   · ladder_audit 把"需 7.2 座城"判成走不通（多城推进是设计内路径）；
 *   · 造价扫描把 Lv13 的**12 级循环**判成"时间回退"（v89.128 明确设计）。
 * 所以这里锁的不是"某个数等于多少"（那是平衡，会变），
 * 而是**调参时必须成立的关系**；改设计就得改断言，改不了就说明改错了。
 * ============================================================ */
const BIDS = Object.keys(DATA.BUILDINGS).filter(function (id) { return !!DATA.BUILDINGS[id].levelCost; });

t('建造时间：升到 1..12 级逐级不降，且 12 级是全程最长（循环重置点在 13）', () => {
  /* lv 参数 = **升级前等级**：time(lv) 是"升到 lv+1 级"的时长。
     0..10 → 升到 1..11；11 → 升到 12（本档最长）。lv=12 起进入新循环，
     所以这里不拿 11 和 12 比 —— 那是设计，不是回退。 */
  BIDS.forEach(function (id) {
    const seq = [];
    for (let lv = 0; lv <= 11; lv++) seq.push(DATA.buildTimeSec(id, lv));
    for (let i = 1; i < seq.length; i++) {
      if (!(seq[i] >= seq[i - 1])) throw new Error(id + ' 第 ' + i + '→' + (i + 1) + ' 档：' + seq[i - 1] + 's → ' + seq[i] + 's');
    }
    const max = Math.max.apply(null, seq);
    if (seq[11] !== max) throw new Error(id + ' 12 级不是最长：' + seq[11] + 's < ' + max + 's');
  });
});

t('建造时间：12 级循环恒等（lv 与 lv+12 同长 · v89.128 口径）', () => {
  BIDS.forEach(function (id) {
    for (let lv = 0; lv < 33; lv++) {
      const a = DATA.buildTimeSec(id, lv), b = DATA.buildTimeSec(id, lv + 12);
      if (a !== b) throw new Error(id + ' Lv' + lv + '=' + a + 's 但 Lv' + (lv + 12) + '=' + b + 's');
    }
  });
});

t('建造造价：1→12 级每种资源不降（改表时最常见的"越升越便宜"）', () => {
  BIDS.forEach(function (id) {
    const b = DATA.BUILDINGS[id];
    /* lv=0 是"新建"，造价走 buildCost 而不是 levelCost（返回 null）—— 从 1 起比 */
    for (let lv = 1; lv < 12; lv++) {
      const a = b.levelCost(lv), c = b.levelCost(lv + 1);
      if (!a || !c) throw new Error(id + ' Lv' + lv + '/Lv' + (lv + 1) + ' 造价缺失');
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
        const av = a[k] || 0, cv = c[k] || 0;
        if (cv > 0 && cv < av * 0.999) throw new Error(id + ' Lv' + lv + '→' + (lv + 1) + ' ' + k + '：' + Math.round(av) + '→' + Math.round(cv));
      });
    }
  });
});

t('等级数组必须覆盖 MAX_LEVEL_ABS（短了 = 上限 undefined/NaN）', () => {
  const ABS = DATA.MAX_LEVEL_ABS;
  const bad = [];
  Object.keys(DATA.BUILDINGS).forEach(function (id) {
    const b = DATA.BUILDINGS[id];
    ['pop', 'cap', 'speed'].forEach(function (k) {
      if (Array.isArray(b[k]) && b[k].length < ABS) bad.push(id + '.' + k + '=' + b[k].length);
    });
  });
  if (bad.length) throw new Error('不足 ' + ABS + ' 档：' + bad.join(' · '));
});

t('RANK_BONUS 不含 buildCap（唯一出口 = rankBuildCapOf，防第二份口径回潮）', () => {
  const hit = (DATA.RANK_BONUS || []).filter(function (b) { return Object.prototype.hasOwnProperty.call(b, 'buildCap'); });
  if (hit.length) throw new Error('又有 ' + hit.length + ' 档写回了 buildCap —— 调它不会生效');
});

t('兵种造价四资源齐全且为正（缺项 = 白嫖）', () => {
  Object.keys(DATA.TROOPS).forEach(function (id) {
    const c = DATA.TROOPS[id].cost || {};
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) {
      if (!(c[k] > 0)) throw new Error(id + ' 的 cost.' + k + ' = ' + c[k]);
    });
  });
});

/* ============================================================
 * ⑦ 旧币去路（v157.30 · 老板「增加旧币去路」）
 * ------------------------------------------------------------
 * 旧币是唯一"玩家层级通用"的资源，通胀只能靠**去处**消化。
 * 这里锁三条关系，防"看着有去处、其实免费/无效"：
 *   ① Lv9-12 的营造旧币是钉死过的护栏（一字不许动）；
 *   ② Lv13+ 必须严格递增（后期一座城的营造旧币不能和 12 级一个价）；
 *   ③ 挂在名城选项上的旧币出口必须有价、有冷却，且兵种 id 真实存在。
 * ============================================================ */
t('营造旧币：Lv9~12 = 3000/6000/12000/24000（前期护栏不许动）', () => {
  const want = [3000, 6000, 12000, 24000];
  want.forEach((v, i) => {
    const got = DATA.buildGoldAt(9 + i);
    if (got !== v) throw new Error('Lv' + (9 + i) + '：期望 ' + v + '，实得 ' + got);
  });
  if (DATA.buildGoldAt(8) !== 0) throw new Error('Lv8 应为 0（保前期流畅）');
});

t('营造旧币：Lv13 起严格递增，Lv24 ≥ 100 万且不超上限', () => {
  const G0 = DATA.BUILD_GOLD;
  for (let lv = 13; lv <= 24; lv++) {
    const a = DATA.buildGoldAt(lv - 1), b = DATA.buildGoldAt(lv);
    if (!(b > a)) throw new Error('Lv' + lv + ' 没有比 Lv' + (lv - 1) + ' 更贵：' + a + '→' + b);
    if (G0.cap && b > G0.cap) throw new Error('Lv' + lv + ' 超上限：' + b + ' > ' + G0.cap);
  }
  if (DATA.buildGoldAt(24) < 1000000) throw new Error('Lv24 营造旧币只有 ' + DATA.buildGoldAt(24) + '，后期等于免费');
});

t('旧币出口：每个 gold 类名城选项都有价 + 有冷却（防免费无限刷）', () => {
  (DATA.CITY_OPTS || []).forEach((o) => {
    const g = (o.cost || {}).gold || 0;
    if (g <= 0) return;                       /* 非旧币选项不在此列 */
    if (!(o.cdDays >= 1)) throw new Error(o.id + ' 没有冷却日（可无限刷）');
  });
});

t('旧币出口：雇佣民壮的兵种 id 必须真实存在（写错 = 空雇佣）', () => {
  const o = (DATA.CITY_OPTS || []).filter((x) => x.id === 'hire')[0];
  if (!o) throw new Error('缺 hire 选项');
  const tp = o.troops || {};
  const ids = Object.keys(tp);
  if (!ids.length) throw new Error('hire 没写 troops');
  ids.forEach((id) => { if (!DATA.TROOPS[id]) throw new Error('兵种不存在：' + id); });
});

t('旧币出口：收珠的珠宝 id 必须真实存在，且选项 id 不重复', () => {
  const ids = {};
  (DATA.CITY_OPTS || []).forEach((o) => {
    if (ids[o.id]) throw new Error('选项 id 重复：' + o.id);
    ids[o.id] = 1;
  });
  const j = (DATA.CITY_OPTS || []).filter((x) => x.id === 'jewelbuy')[0];
  if (!j) throw new Error('缺 jewelbuy 选项');
  (j.jewelPool || []).forEach((id) => {
    if (!(DATA.ITEM_BY_ID || {})[id]) throw new Error('珠宝不存在：' + id);
  });
});

/* ============================================================ */
const dt = Date.now() - t0;
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败　（' + dt + ' 毫秒）');
if (FAIL) console.log('\n⚠️ 红 = 你改的那个数据没进公式 —— 先查字段名/缓存/接错模块，别急着调数值。\n');
process.exit(FAIL ? 1 : 0);
