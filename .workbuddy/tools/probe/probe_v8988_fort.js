/* v89.88 探针：需求1~3（野外城池：等级分布 / 守军×10 / 满配） */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';

eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));

['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});

var G = global.GAME, U = G.utils, DATA = G.DATA;
var PASS = 0, FAIL = 0;
function ck(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

var st = G.newGame({ name: 'x', cityName: '许都' });
if (!st.map.grid) G.map.generate();
G.state = st;

var DAY = G.questDayIndex();
var W = DATA.MAP_W;

/* ============================================================
 * 一、等级分布（构造性配额）
 * ============================================================ */
console.log('=== 一、等级分布：8/9/10 各 30% + 1~7 均分 10% ===');
var t0 = Date.now();
var cand = G.map._fortCandidates();
var tBuild = Date.now() - t0;
t0 = Date.now();
var tbl = G.map._fortLevelTable(DAY);
var tDay = Date.now() - t0;
var n = cand.length;
console.log('     候选 ' + n + ' 座 · 候选枚举 ' + tBuild + 'ms · 当日配额 ' + tDay + 'ms');

var cnt = {};
Object.keys(tbl).forEach(function (k) { cnt[tbl[k]] = (cnt[tbl[k]] || 0) + 1; });
var levels = Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; });
console.log('     分布：' + levels.map(function (l) { return 'Lv' + l + '×' + cnt[l]; }).join(' '));

var r8 = cnt[8] / n, r9 = cnt[9] / n, r10 = cnt[10] / n;
ck('Lv8 ≈ 30%', Math.abs(r8 - 0.30) <= 0.002, (r8 * 100).toFixed(2) + '%');
ck('Lv9 ≈ 30%', Math.abs(r9 - 0.30) <= 0.002, (r9 * 100).toFixed(2) + '%');
ck('Lv10 ≈ 30%', Math.abs(r10 - 0.30) <= 0.002, (r10 * 100).toFixed(2) + '%');
var lowN = 0; levels.forEach(function (l) { if (l <= 7) lowN += cnt[l]; });
ck('1~7 级合计 ≈ 10%', Math.abs(lowN / n - 0.10) <= 0.002, (lowN / n * 100).toFixed(2) + '%');
var lowCounts = levels.filter(function (l) { return l <= 7; }).map(function (l) { return cnt[l]; });
var lowMin = Math.min.apply(null, lowCounts), lowMax = Math.max.apply(null, lowCounts);
ck('1~7 级内**均分**（每档差 ≤ 1）', lowMax - lowMin <= 1, lowMin + '~' + lowMax);
ck('等级上限为 10、无 0/11 级', levels[0] >= 1 && levels[levels.length - 1] <= 10);

/* 同日确定性：连续两次取表逐点一致 */
var tbl2 = (function () {
  var bak = G.map._fortLv; G.map._fortLv = null;      /* 强制重建 */
  var t = G.map._fortLevelTable(DAY);
  G.map._fortLv = bak;
  return t;
})();
var same = true, checked = 0;
Object.keys(tbl).forEach(function (k) {
  if (checked >= 4000) return; checked++;
  if (tbl[k] !== tbl2[k]) same = false;
});
ck('同日两次构建逐点一致（确定性）', same && checked >= 4000, checked + ' 格比对');

/* 逐日重掷：次日等级确有变化（且分布仍成立） */
(function () {
  var tblN = G.map._fortLevelTable(DAY + 1);
  var diff = 0, tot = 0;
  Object.keys(tbl).forEach(function (k) {
    if (tot >= 5000) return; tot++;
    if (tbl[k] !== tblN[k]) diff++;
  });
  ck('次日等级确有变化（每日重掷）', diff / tot > 0.5, (diff / tot * 100).toFixed(1) + '% 变化');
  var cN = {};
  Object.keys(tblN).forEach(function (k) { cN[tblN[k]] = (cN[tblN[k]] || 0) + 1; });
  ck('次日分布同样成立（配额不靠运气）',
    Math.abs(cN[10] / n - 0.30) <= 0.002 && Math.abs(cN[9] / n - 0.30) <= 0.002, 'Lv10 ' + (cN[10] / n * 100).toFixed(2) + '%');
})();

/* ============================================================
 * 二、哈希等价（内联版 == U.rng 版，逐位）
 * ============================================================ */
console.log('=== 二、_fortHash 内联版逐位等价 ===');
(function () {
  var bad = 0, tested = 0;
  for (var x = 5; x < 60; x += 3) {
    for (var y = 5; y < 60; y += 3) {
      var h = (x * 73856093 ^ y * 19349663 ^ ((st.map.seed || 1) * 2654435761) ^ (7 * 83492791)) >>> 0;
      var want = U.rng(h)();
      var got = G.map._fortHash(x, y, 7);
      tested++;
      if (want !== got) bad++;
    }
  }
  ck('逐点与 U.rng(h)() 位级一致', bad === 0 && tested > 300, tested + ' 点 · 差异 ' + bad);
})();

/* ============================================================
 * 三、守军 ×10 且恒超同级野地
 * ============================================================ */
console.log('=== 三、守军：×10 且恒超同级野地 ===');
function fortTotal(lv) {
  var g = G.map.fortGarrison(lv), t = 0;
  for (var k in g) t += g[k];
  return t;
}
function wildMax(lv) {
  var arr = DATA.WILD_DEFENSE[lv] || [], t = 0;
  arr.forEach(function (e) { t += e.max; });
  return t;
}
(function () {
  ck('Lv1 守军 500（= 50 × 10）', fortTotal(1) === 500, String(fortTotal(1)));
  var mono = true;
  for (var lv = 2; lv <= 10; lv++) if (fortTotal(lv) <= fortTotal(lv - 1)) mono = false;
  ck('守军随等级单调递增（1~10）', mono,
    'Lv1 ' + fortTotal(1) + ' → Lv10 ' + fortTotal(10));
  var allAbove = true, detail = [];
  for (var l2 = 1; l2 <= 10; l2++) {
    var wm = wildMax(l2), ft = fortTotal(l2);
    detail.push('L' + l2 + ':' + ft + '>' + wm);
    if (!(ft > wm)) allAbove = false;
  }
  ck('**每一级**都 ≥ 同级野地上限（"总归要比野地兵多"）', allAbove, detail.join(' '));
})();

/* ============================================================
 * 四、满配：建筑 / 城墙 / 城防 / 人口 随等级到顶
 * ============================================================ */
console.log('=== 四、满配（Lv8/9/10 建筑全到级） ===');
(function () {
  var ok = true, msg = [];
  [8, 9, 10].forEach(function (lv) {
    var f = { x: 100, y: 100, level: lv, name: '探针堡', kind: 'fort' };
    var p = G.fortPlanOf(f);
    var cp = G.cityPlanOf(lv);
    var cellsOk = cp.cells.every(function (c) { return !c.build || c.build.lvl === lv; });
    msg.push('Lv' + lv + ' 建筑Lv' + p.buildLv + '/墙' + p.wallLv + '/防' + p.def + '/人口' + p.popCap);
    if (!(p.level === lv && p.buildLv === lv && p.wallLv === lv && cellsOk)) ok = false;
  });
  ck('Lv8/9/10 布局全到级（建筑·城墙·格内 lvl）', ok, msg.join(' · '));
  var f10 = { x: 100, y: 100, level: 10, name: '探针堡', kind: 'fort' };
  ck('Lv10 城防 = 10 + 10×4 = 50', G.fortDefOf(f10) === 50, String(G.fortDefOf(f10)));
  var p10 = G.fortPlanOf(f10);
  ck('Lv10 城墙 = Lv10（不占格）', p10.wallLv === 10);
  ck('Lv10 人口上限 > Lv8', p10.popCap > G.fortPlanOf({ x: 1, y: 1, level: 8, name: 'x', kind: 'fort' }).popCap,
    G.fortPlanOf({ x: 1, y: 1, level: 8, name: 'x', kind: 'fort' }).popCap + ' → ' + p10.popCap);
})();

/* ============================================================
 * 五、资源满配（战利品曲线 + 档位次序 + 侦查口径对齐）
 * ============================================================ */
console.log('=== 五、资源满配 ===');
(function () {
  var bak = Math.random;
  Math.random = function () { return 0.5; };
  try {
    function grain(tier, lv) { return G.battle.genLoot({ type: tier, level: lv, x: 1, y: 1 }, 1).grain; }
    var f1 = grain('fort', 1), f8 = grain('fort', 8), f10 = grain('fort', 10);
    ck('据点 Lv1→Lv10 曲线放大（≈15 倍）', f10 / f1 > 12 && f10 / f1 < 18,
      f1 + ' → ' + f10 + '（×' + (f10 / f1).toFixed(1) + '）');
    ck('档位次序：jun@7 > fort@3', grain('jun', 7) > grain('fort', 3),
      grain('fort', 3) + ' < ' + grain('jun', 7));
    ck('档位次序：capital@10 > fort@10（上限口径不破）', grain('capital', 10) > f10,
      f10 + ' < ' + grain('capital', 10));
  } finally { Math.random = bak; }

  /* 侦查口径 = 实际结算基准（cityResMul.raid），不再虚报 */
  var t = G.battle.resolveTarget({ kind: 'fort', x: cand.length ? (cand[0] % W) : 40, y: cand.length ? ((cand[0] / W) | 0) : 40 });
  ck('探针据点可解析', t.ok === true, t.ok ? (t.name + ' Lv' + t.lv) : t.msg);
  var rep = G.battle.resReportOf(t);
  var battleSrc = fs.readFileSync(path.join(R, 'js', 'battle.js'), 'utf8');
  var i = battleSrc.indexOf("if (t.kind === 'fort' && GAME.battle.genLoot)");
  var seg = battleSrc.substr(i, 900);
  /* ⚠️ 负向判据先剥注释再判（注释里写"原读 wildResMul"会自命中） */
  var segCode = seg.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ck('侦查口径对齐 cityResMul.raid（0.5，非 wild 1.2）',
    segCode.indexOf('cityResMul') >= 0 && segCode.indexOf('wildResMul') < 0,
    '赋值行：' + (segCode.match(/var mul = [^\n]{0,70}/) || [''])[0]);
  ck('侦查报告渲染（掠夺可得）', !!rep && rep.title.indexOf('掠夺可得') >= 0,
    rep ? rep.title : '无');
})();

/* ============================================================
 * 六、拔除 → 次日重置（等级表保留，今日消失）
 * ============================================================ */
console.log('=== 六、拔除/重置 ===');
(function () {
  var fx = cand[3] % W, fy = (cand[3] / W) | 0;
  var f = G.map.fortAt(fx, fy);
  ck('取一座候选据点', !!f, f ? (f.name + ' Lv' + f.level) : '无');
  G.map.razeFort(fx, fy);
  ck('拔除后今日消失', G.map.fortAt(fx, fy) === null);
  ck('次日等级表仍有它（位置固定）', G.map._fortLevelAt(DAY + 1, fx, fy) > 0);
  delete st.fortsRazed[fx + ',' + fy];
  ck('清掉记录后立刻回来（同日同等级）', !!G.map.fortAt(fx, fy) && G.map.fortAt(fx, fy).level === f.level);
})();

console.log('\n========== 探针结果：' + PASS + ' 通过 / ' + FAIL + ' 失败 ==========');
process.exit(FAIL ? 1 : 0);
