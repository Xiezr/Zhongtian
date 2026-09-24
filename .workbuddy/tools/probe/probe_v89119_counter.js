'use strict';
/* ============================================================
 * probe_v89119_counter.js — 反击时序取证（v89.119）
 * ------------------------------------------------------------
 * 老板：「反击应该在敌方出手后，而不是己方移动后直接反击，回合记录稍微调整。
 *   我方移动，出手，对方反击（如有）；对方移动，出手，我方相应反击（如有）。
 *   反击和对方出手记录在同一行」
 *
 * 本探针把「引擎逐条事件」与「ui.btRoundLines 的行」并排打出来，
 * 用来判断老板看到的是哪一种现象：
 *   A. 反击发生在"我方出手"后（引擎现状），但**行**的呈现方式不对；
 *   B. 反击真的发生在"我方只移动、没出手"之后（真 bug）；
 *   C. 反击的**归属行**是"被打者自己的行动行"，与老板期望的上下文不同。
 * ============================================================ */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic',
 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
G.newGame({ name: '时序', cityName: '许都' });   /* STORY 系加成要读 state，必须建局 */

function showEvents(label, r) {
  console.log('\n===== ' + label + ' =====');
  (r.roundsLog || []).forEach(function (rr) {
    console.log('第 ' + rr.r + ' 回合　（我 ' + rr.a + ' / 敌 ' + rr.d + '　间距 ' + rr.gap + '）');
    (rr.events || []).forEach(function (e) {
      var s = '  [' + e.kind + '] ' + e.side + ' ' + (e.name || e.id);
      if (e.step != null) s += ' step=' + e.step + ' gap=' + e.gap;
      if (e.target) s += ' → ' + e.target;
      if (e.kill != null) s += ' 歼 ' + e.kill;
      if (e.destroy != null) s += ' 拆' + e.destroy + '(余' + e.left + ')';
      console.log(s);
    });
    /* 回合记录（界面那半）—— 与事件流并排看 */
    var lines = G.ui.btRoundLines(rr, rr.snap);
    lines.forEach(function (L) {
      console.log('    └ ' + (L.indent ? '·'.repeat(L.indent / 14) : '') + L.txt);
    });
  });
}

/* ---------- 场景 1：慢弓手 vs 快刀盾（刀盾 275 > 弓手 250）----------
   期望：刀盾推进到近处才打得到弓手；弓手 1200 射程从第 1 回合就能射。
   → 会看到"弓手打刀盾（刀盾够不着、无反击）"与"刀盾打弓手（弓手反击）"。 */
var r1 = G.tactic.simulate({ gongjian: 4000 }, null, { daodun: 6000 }, 0, null,
  { kind: 'wild' });
showEvents('场景1：攻=弓手4000 · 守=刀盾6000', r1);

/* ---------- 场景 2：双方弓手互射（都能反击） ---------- */
var r2 = G.tactic.simulate({ gongjian: 3000 }, null, { gongjian: 3000 }, 0, null,
  { kind: 'wild' });
showEvents('场景2：弓手3000 对 弓手3000', r2);

/* ---------- 场景 3：混编（骑兵快 → 弓手慢，看"行的归属"） ---------- */
var r3 = G.tactic.simulate({ gongjian: 3000, changqiang: 5000 }, null,
  { qingji: 4000, daodun: 5000 }, 0, null, { kind: 'wild' });
showEvents('场景3：攻=弓+枪 · 守=轻骑+刀盾', r3);

/* ---------- 附：引擎纪要（战报正文那半） ---------- */
console.log('\n===== 场景3 引擎纪要 =====');
(r3.log || []).forEach(function (s) { console.log('  ' + s); });

process.exit(0);
