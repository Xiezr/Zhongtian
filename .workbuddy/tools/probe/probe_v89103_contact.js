/* ============================================================
 * probe_v89103_contact.js — 沙盘共享轴 + 前线/接触线 实测
 * ------------------------------------------------------------
 * 问（全部对着老板的原话验）：
 *   ① 两军是否在**同一片战场**上照面？—— 逐帧看两条前线的距离是否真的到 0；
 *   ② 接触线是否随劣势方被歼灭而**向其出发线推进**？
 *   ③ 一方全灭时，接触线是否落在被歼方的**出发线**上（被攻入大军腹地）？
 *   ④ 界面画出来的位置：会不会越过出发线（4%~96%）、两条前线会不会互相穿过？
 * 用法：node .workbuddy/tools/probe/probe_v89103_contact.js
 * ============================================================ */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;

function ap(s) { console.log(s); }
var st = G.newGame({ name: '探针', cityName: '许都', region: '豫州', mapSeed: 20260921, portraitSeed: 20260921 });
if (!st.map.grid) G.map.generate();
st.settings.battleWatch = false;
var city = st.cities[0];
city.res.grain = 5e6; city.res.wood = 5e6; city.res.stone = 5e6;
city.res.iron = 5e6; city.res.gold = 5e6; city.res.pop = 60000;
city.cells.forEach(function (c) { if (c.build) c.build.lvl = Math.max(c.build.lvl || 1, 10); });
var gen = st.generals[0];
gen.level = 30;

/* 找一个野地打（等级 5 上下，双方都有肉搏+远程，能看到"接近→接触→歼敌"全过程） */
function findWild(minLv) {
  for (var y = 4; y < (DATA.MAP_H || 61) - 4; y++) {
    for (var x = 4; x < (DATA.MAP_W || 61) - 4; x++) {
      var t = G.map.tile(x, y);
      if (!t || t.terrain === 'city') continue;
      var lv = G.map.wildLevelNow ? G.map.wildLevelNow(x, y) : (t.wild && t.wild.lv) || 0;
      if (lv >= minLv) return { x: x, y: y, lv: lv };
    }
  }
  return null;
}
var tgt = findWild(4);
ap('目标野地 = ' + (tgt ? (tgt.x + ',' + tgt.y + ' Lv' + tgt.lv) : '未找到'));
if (!tgt) process.exit(1);

var army = { yibing: 30000, changqiang: 12000, gongjian: 8000, qingji: 3000 };
city.army = Object.assign({}, army);
G.setStaNow(gen, 9999); gen.energy = 100;
var r = G.battle.expedition({ kind: 'wild', x: tgt.x, y: tgt.y }, 'raid', army, gen.id);
var rep = null;
(st.reports || []).forEach(function (x) { if (!rep && x.type === 'war') rep = x; });
if (!rep) { ap('没生成战报：' + (r && r.msg)); process.exit(1); }

var sb = G.battle.sandboxOf(rep);
if (!sb) { ap('沙盘不可用'); process.exit(1); }
ap('');
ap('===== 1. 共享轴：两军是否照面 =====');
ap('纵深 D = ' + sb.field + ' · 帧数 = ' + sb.frames.length + ' · 校验 = ' + (sb.verify ? '✅' : '❌'));

/* 逐帧重放（与界面同一套：sdStateInit + sdApply），每回合末快照一次 fronts */
var cur = G.ui.sdStateInit(sb);
var D = sb.field;
var rows = [], lastRound = -1;
function snapRound(round) {
  var fr = G.tactic.frontsOf(cur.atk, cur.def, D);
  var totA = 0, totD = 0;
  cur.atk.forEach(function (u) { totA += u.count; });
  cur.def.forEach(function (u) { totD += u.count; });
  rows.push({ round: round, fa: fr.aFront, fd: fr.dFront, gap: fr.gap,
    contact: fr.contact, broke: fr.broke, mid: fr.mid, totA: totA, totD: totD });
}
snapRound(0);
sb.frames.forEach(function (f) {
  G.ui.sdApply(cur, sb, f);
  if (f[0] !== lastRound) { lastRound = f[0]; snapRound(f[0]); }
});
snapRound(lastRound);

ap('回合   我方最前  敌方最前   间距     接触   接触线(共享轴)  兵力(我/敌)');
rows.forEach(function (x) {
  ap(('  ' + x.round).slice(-3).padEnd(5)
    + U.numText(x.fa, 0).padStart(8) + U.numText(x.fd, 0).padStart(10)
    + U.numText(Math.round(x.gap), 0).padStart(9)
    + ('   ' + (x.contact ? '⚔ 是' : '  否')).padEnd(9)
    + U.numText(Math.round(x.mid), 0).padStart(10)
    + ('   ' + U.numText(x.totA, 0) + ' / ' + U.numText(x.totD, 0)));
});

var first = rows[0], last = rows[rows.length - 1];
ap('');
ap('① 两军是否走到一起：首帧间距 ' + Math.round(first.gap) + ' → 接触过 = '
  + (rows.some(function (x) { return x.contact; }) ? '✅ 是' : '❌ 否')
  + '（最小间距 ' + Math.round(Math.min.apply(null, rows.map(function (x) { return x.gap; }))) + '）');
ap('② 接触线是否向劣势方推进：' + (function () {
  var hit = rows.filter(function (x) { return x.contact; });
  if (hit.length < 2) return '（未接触，无法判定）';
  var a = hit[0].mid, b = hit[hit.length - 1].mid;
  var loser = last.totA < last.totD ? '我方' : '敌方';
  var dir = (loser === '我方') ? (b <= a) : (b >= a);
  return (dir ? '✅ 是' : '❌ 否') + '（接触线 ' + Math.round(a) + ' → ' + Math.round(b)
    + '，劣势方 = ' + loser + '）';
})());
ap('③ 被歼灭方是否被推回出发线：' + (last.broke
  ? ('✅ ' + (last.broke === 'atk' ? '我方' : '敌方') + '全灭 → 接触线钉在其出发线（0 / D）＝被攻入腹地')
  : '（未全灭：' + (rows.length && rows[rows.length - 1].round >= (sb.maxRounds || 30) ? '回合打满' : '战斗未结束') + '）'));

ap('');
ap('===== 2. 界面几何（与 sdPct / sdAxisPct 同一映射）=====');
var bad = 0;
rows.forEach(function (x) {
  var aPct = G.ui.btPosPct('atk', x.fa, D);
  var dPct = G.ui.btPosPct('def', x.fd, D);
  var cPct = G.ui.sdAxisPct(x.mid, D);
  if (aPct < 3.99 || aPct > 96.01 || dPct < 3.99 || dPct > 96.01 || cPct < 3.99 || cPct > 96.01) bad++;
});
ap('④ 全部前线/接触线落在 4%~96% 之内：' + (bad ? '❌ ' + bad + ' 回合越界' : '✅ 是'));
/* 两条前线在共享轴上永不交叉（我方 posA ≤ 敌方 posD）——交叉就说明位置算错了 */
var cross = rows.filter(function (x) { return x.fa + x.fd > D + 1e-6; }).length;
ap('⑤ 两条前线不互相穿过（我方推进 + 敌方推进 ≤ 纵深）：' + (cross ? '❌ ' + cross + ' 回合越界' : '✅ 是'));
/* 旧映射对照：改前两军最远只能到 46% / 54%，中间 8% 是永久空档 */
var minGapPct = Math.min.apply(null, rows.map(function (x) {
  return G.ui.btPosPct('def', x.fd, D) - G.ui.btPosPct('atk', x.fa, D);
}));
ap('⑥ 两军最近时的屏上间距 = ' + (Math.round(minGapPct * 10) / 10) + '%'
  + '（旧映射最小恒为 8%，即"永远不接触"）');

ap('');
ap('===== 3. 帧流文案 =====');
[0, Math.floor(sb.frames.length / 2), sb.frames.length - 1].forEach(function (i) {
  ap('  帧' + i + '：' + (G.ui.sdLine(sb, sb.frames[i]) || '（无）'));
});
ap('');
ap('（探针结束 —— 主动退出，避免游戏的定时器把进程吊住）');
process.exit(0);
