/* ============================================================
 * probe_v89118_elephant.js — 南疆象兵「撤克制 → 正常攻防」标定探针
 * ------------------------------------------------------------
 * 老板令（v89.118 第 2 条）：「象兵不设置克制，正常攻防」——
 *   ＝ 从 COUNTER_ATK/COUNTER_DEF 的长枪条目里删掉 nanjiangxiangbing，
 *     象兵按自身 hp/atk/def 正常打。
 *
 * 本探针量三样（全部走引擎唯一出口 GAME.tactic.simulate）：
 *   ① 现状（有克制）：长枪 vs 象兵 各 600 人口
 *   ② 撤克制（内存改表，不落盘）：同对拼 → 象兵是不是变"无弱点"
 *   ③ 若碾压过头：按候选数值表扫参（hp/atk/def 几档），报各档对拼结果，
 *      给「正常攻防」选一组"强但可打"的数值。
 * 用法：node .workbuddy/tools/probe/probe_v89118_elephant.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'domain', 'map', 'battle', 'tactic'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;
G.newGame({ name: '象', cityName: '许都' });

function duel(a, b, pop, opts) {
  var n = pop || 600;
  var A = {}; A[a] = Math.max(1, Math.floor(n / DATA.TROOPS[a].pop));
  var B = {}; B[b] = Math.max(1, Math.floor(n / DATA.TROOPS[b].pop));
  var r = G.tactic.simulate(A, null, B, 0, null, opts || { kind: 'wild' });
  var aStart = A[a], bStart = B[b];
  function pct(loss, start) { return Math.round(100 * loss / Math.max(1, start)) + '%'; }
  return {
    rounds: r.rounds, winner: r.winner,
    al: r.atkLoss, bl: r.defLoss,
    aPct: pct(r.atkLoss, aStart), bPct: pct(r.defLoss, bStart),
  };
}
function show(tag, a, b, pop) {
  var r = duel(a, b, pop);
  console.log('  ' + pad(tag, 26) + pad(DATA.TROOPS[a].name + ' ×' + Math.floor((pop || 600) / DATA.TROOPS[a].pop), 18)
    + ' vs ' + pad(DATA.TROOPS[b].name + ' ×' + Math.floor((pop || 600) / DATA.TROOPS[b].pop), 18)
    + r.rounds + ' 回合　胜方 ' + (r.winner === 'atk' ? 'A' : 'B')
    + '　A损 ' + U.fmt(r.al) + '(' + r.aPct + ')　B损 ' + U.fmt(r.bl) + '(' + r.bPct + ')');
  return r;
}
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

console.log('===== ① 现状（有克制：长枪拒马 攻×3 / 防×5） =====');
var r0 = show('有克制', 'changqiang', 'nanjiangxiangbing', 600);

console.log('\n===== ② 撤克制（内存改表，不落盘）=====');
/* 撤：把长枪两张表里的 nanjiangxiangbing 删掉 */
delete DATA.COUNTER_ATK.changqiang.nanjiangxiangbing;
delete DATA.COUNTER_DEF.changqiang.nanjiangxiangbing;
var r1 = show('撤克制', 'changqiang', 'nanjiangxiangbing', 600);

console.log('\n----- 撤克制后：象兵 vs 各族代表（各 600 人口）-----');
['daodun', 'gongjian', 'tieji', 'xiliangtieqi', 'chongche', 'qingzhoubing', 'tengjiabing'].forEach(function (x) {
  show('撤克制·对' + DATA.TROOPS[x].name, 'nanjiangxiangbing', x, 600);
});
console.log('  （反过来看：各族 vs 象兵）');
['daodun', 'gongjian', 'tieji', 'xiliangtieqi'].forEach(function (x) {
  show('撤克制·' + DATA.TROOPS[x].name + '攻', x, 'nanjiangxiangbing', 600);
});

console.log('\n===== ③ 候选数值扫参（撤克制前提下，"正常攻防"选一组强但可打的）=====');
/* 基线：hp 18000 / atk 880 / def 400
   候选思路：象兵是 5 pop 重坦 —— 攻防不该同时碾压；给它"高血高防、攻中等"
   （重坦定位），让同人口对拼是"象兵赢但损兵可观"，而不是 0 损碾压。 */
var base = { hp: 18000, atk: 880, def: 400 };
var CANDS = [
  { hp: 18000, atk: 880, def: 400, tag: '原值' },
  { hp: 16000, atk: 620, def: 320, tag: '候选A 血-11% 攻-30% 防-20%' },
  { hp: 15000, atk: 560, def: 300, tag: '候选B 血-17% 攻-36% 防-25%' },
  { hp: 17000, atk: 520, def: 360, tag: '候选C 血-6% 攻-41% 防-10%' },
];
CANDS.forEach(function (c) {
  var t = DATA.TROOPS.nanjiangxiangbing;
  t.hp = c.hp; t.atk = c.atk; t.def = c.def;
  var rq = duel('changqiang', 'nanjiangxiangbing', 600);
  var rd = duel('daodun', 'nanjiangxiangbing', 600);
  var rg = duel('gongjian', 'nanjiangxiangbing', 600);
  var rt = duel('xiliangtieqi', 'nanjiangxiangbing', 600);
  console.log('  ' + pad(c.tag, 28)
    + ' 枪: ' + (rq.winner === 'atk' ? '枪胜' : '象胜') + '(' + rq.bPct + '损)' +
    ' 盾: ' + (rd.winner === 'atk' ? '盾胜' : '象胜') + '(' + rd.bPct + '损)' +
    ' 弓: ' + (rg.winner === 'atk' ? '弓胜' : '象胜') + '(' + rg.bPct + '损)' +
    ' 凉骑: ' + (rt.winner === 'atk' ? '骑胜' : '象胜') + '(' + rt.bPct + '损)');
});
/* 复位（探针不落盘，仅内存） */
var t2 = DATA.TROOPS.nanjiangxiangbing;
t2.hp = base.hp; t2.atk = base.atk; t2.def = base.def;

console.log('\n===== ④ 结论行 =====');
console.log('  有克制：' + (r0.winner === 'atk' ? '长枪胜' : '象兵胜') + '（枪损 ' + r0.aPct + ' / 象损 ' + r0.bPct + '）');
console.log('  撤克制：' + (r1.winner === 'atk' ? '长枪胜' : '象兵胜') + '（枪损 ' + r1.aPct + ' / 象损 ' + r1.bPct + '）');
process.exit(0);
