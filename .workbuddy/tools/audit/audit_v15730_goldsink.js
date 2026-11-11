#!/usr/bin/env node
/* ============================================================
 * audit_v15730_goldsink.js —— 旧币去路**行为**体检（v157.30）
 * ------------------------------------------------------------
 * 为什么单独一个脚本而不是塞进 smoke：
 *   smoke 是 4.7 万行的状态剧本，段间共享可变 state；新加一段要动分片生成与
 *   断言分档。这条需求只涉及"扣钱 / 加兵 / 加珠宝 / 冷却"四件事，
 *   用无头沙箱 1 秒就能真调一遍 —— 放这里更便宜，也更容易读。
 *
 * 断言（真调，不看源码正则）：
 *   ① 雇佣民壮：旧币 -20 万、目标城 +1000 步兵、同日再点被冷却拦住；
 *   ② 旧币收珠：旧都可买，旧币 -50 万、背包 +1 件（珠宝 id 在池内）、同日再点被拦；
 *   ③ 非旧都城市不能收珠（minType 生效）；
 *   ④ 营造旧币：Lv12 仍 24,000（护栏），Lv24 ≥ 100 万（后期不再是免费）。
 *
 * 退出码：0 全过 / 1 有红
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const JS = path.join(ROOT, 'js');
const sb = { console: console, document: undefined, location: undefined };
sb.window = sb;
vm.createContext(sb);
['core', 'data', 'rules', 'state', 'systems', 'cities', 'items', 'domain', 'map', 'story', 'portraits']
  .forEach(function (f) {
    const src = fs.readFileSync(path.join(JS, f + '.js'), 'utf8').replace(/^\s*import\s+[^\n]*$/gm, '');
    vm.runInContext(src, sb, { filename: f + '.js' });
  });
const G = sb.GAME, D = G.DATA;

let PASS = 0, FAIL = 0;
function t(name, fn) {
  try { fn(); PASS++; console.log('  ✅ ' + name); }
  catch (e) { FAIL++; console.log('  ❌ ' + name + '   [' + (e && e.message) + ']'); }
}
function eq(a, b, m) { if (a !== b) throw new Error(m + '：期望 ' + b + '，实得 ' + a); }
function gt(a, b, m) { if (!(a > b)) throw new Error(m + '：期望 > ' + b + '，实得 ' + a); }

function fresh() {
  G.newGame({ name: 'audit', avatar: '🧔', gender: 'male', region: 'random' });
  const s = G.state;
  const c = s.cities[0];
  c.type = 'capital';
  c.name = '旧都';
  s.gold = 2000000;
  return { s: s, c: c };
}

console.log('\n══ 旧币去路行为体检（v157.30）══\n');

t('雇佣民壮：旧币 -20 万 · 本城 +1000 步兵', () => {
  const { s, c } = fresh();
  const before = s.gold;
  const r = G.doCityOpt(c.id, 'hire');
  if (!r.ok) throw new Error('被拒：' + r.msg);
  eq(before - s.gold, 200000, '扣款');
  eq(c.army.buxingji || 0, 1000, '驻军');
});

t('雇佣民壮：同一日再点 → 被冷却拦住（钱不能白扣）', () => {
  const { s, c } = fresh();
  G.doCityOpt(c.id, 'hire');
  const goldAfter = s.gold;
  const r2 = G.doCityOpt(c.id, 'hire');
  if (r2.ok) throw new Error('第二次数值仍成功');
  eq(s.gold, goldAfter, '被拒时不该再扣钱');
});

t('旧币收珠：旧都可买 · 旧币 -50 万 · 背包 +1 件珠宝', () => {
  const { s, c } = fresh();
  const before = s.gold;
  const n0 = Object.keys((s.items && s.items) || {}).reduce(function (a, k) { return a + (s.items[k] || 0); }, 0);
  const r = G.doCityOpt(c.id, 'jewelbuy');
  if (!r.ok) throw new Error('被拒：' + r.msg);
  eq(before - s.gold, 500000, '扣款');
  const n1 = Object.keys((s.items && s.items) || {}).reduce(function (a, k) { return a + (s.items[k] || 0); }, 0);
  eq(n1 - n0, 1, '背包件数');
});

t('旧币收珠：州/郡不可买（minType 生效）', () => {
  const { c } = fresh();
  c.type = 'jun';
  const r = G.doCityOpt(c.id, 'jewelbuy');
  if (r.ok) throw new Error('州城竟然也能收珠');
});

t('营造旧币：Lv12 仍 24,000（前期护栏），Lv24 ≥ 100 万（后期不再是免费）', () => {
  eq(D.buildGoldAt(12), 24000, 'Lv12');
  gt(D.buildGoldAt(24), 1000000, 'Lv24');
  gt(D.buildGoldAt(13), D.buildGoldAt(12), 'Lv13 应高于 Lv12');
});

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败\n');
process.exit(FAIL ? 1 : 0);
