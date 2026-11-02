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

/* ============================================================ */
const dt = Date.now() - t0;
console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败　（' + dt + ' 毫秒）');
if (FAIL) console.log('\n⚠️ 红 = 你改的那个数据没进公式 —— 先查字段名/缓存/接错模块，别急着调数值。\n');
process.exit(FAIL ? 1 : 0);
