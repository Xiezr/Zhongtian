/* v89.202b 收藏峰值 —— "达到过即永久解锁"设计验证
   ------------------------------------------------------------
   改前预期：met1=false（物品品种回落 → 已达成条件重新锁上 = 遗留缺陷实证）
   改后预期：met1=true（峰值兜底 · 达成过即保持解锁）。
   同时输出"真实现值"（rawNow）证明回落确实发生（防平凡解）。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var PASS = 0, FAIL = 0;
function chk(tag, cond, extra) {
  if (cond) { PASS++; console.log('  ✓ ' + tag); }
  else { FAIL++; console.log('  ✗ ' + tag + '  [' + (extra || '') + ']'); }
}

var st = G.newGame({ name: 'peak202', cityName: '许都' });
G.state = st;
G.ui._cityId = st.cities[0].id;

/* 找一件 itemKind（藏品种类）条件的藏品 */
var target = null;
((DATA.COLLECT || {}).series || []).forEach(function (sr) {
  (sr.items || []).forEach(function (it) {
    var cd = G.collectCondOf(it.id);
    if (cd && cd.type === 'itemKind' && !target) target = { id: it.id, name: it.name, n: cd.n, sr: sr.name };
  });
});
console.log('目标件：' + (target ? (target.name + '（' + target.sr + '）需藏品种类 ≥ ' + target.n) : '无'));
if (!target) { console.log('无 itemKind 条件件 —— 中止'); process.exit(1); }

/* ① 摆足品种（n + 2 种）→ 读数（峰值记录点）
   ⚠️ 先清空物品池（新局自带物品会干扰"回落"场景 —— 清空才能造出干净对照） */
st.items = {};
for (var i = 0; i < target.n + 2; i++) st.items['pk202_' + i] = 1;
var met0 = G.collectCondMetOf(target.id);
var peak0 = st.collectPeak ? st.collectPeak.itemKind : null;
chk('① 品种拉满 → 条件达成（met=true）', met0 === true, 'met=' + met0 + ' peak=' + peak0);

/* ② 回落：只留 1 种（模拟材料被消耗） */
var keys = Object.keys(st.items).filter(function (k) { return k.indexOf('pk202_') === 0; });
for (var j = 1; j < keys.length; j++) delete st.items[keys[j]];
var rawNow = Object.keys(st.items).length;
console.log('   回落：品种 ' + (target.n + 2) + ' → ' + rawNow + '（真实现值）');

/* ③ 判定与取值口径 */
var met1 = G.collectCondMetOf(target.id);
var valNow = G.collectCondValOf('itemKind');
console.log('   met1=' + met1 + '  valNow(口径值)=' + valNow + '  rawNow(真实现值)=' + rawNow);
chk('② 回落已真实发生（rawNow < n · 防平凡解）', rawNow < target.n, 'raw=' + rawNow + ' n=' + target.n);
chk('③ 峰值兜底：回落后期望保持解锁 met1=true（改前=false 即遗留缺陷实证）', met1 === true, 'met1=' + met1);
chk('④ 取值口径 = 历史最高（≥ n）', valNow >= target.n, 'val=' + valNow);

/* ⑤ 多类型统一口径：rank/rep 等现值类也走峰值出口 */
var src = fs.readFileSync(R + 'js/domain.js', 'utf8');
var fnStart = src.indexOf('GAME.collectCondValOf = function');
var fnEnd = src.indexOf('\n  };', fnStart);
var fn = src.slice(fnStart, fnEnd);
chk('⑤ 现值类全接峰值出口（collectPeakOf 在册）', /collectPeakOf\(type, cur\)/.test(fn), '');
var hasSweep = G.collectPeakSweep ? true : false;
console.log('   collectPeakSweep 存在=' + hasSweep + '（改后应有）');
if (hasSweep) {
  var before = JSON.stringify(st.collectPeak || {});
  G.collectPeakSweep(true);
  var after = JSON.stringify(st.collectPeak || {});
  chk('⑥ 扫掠出口可调（peak 表被刷新）', typeof after === 'string' && after.length > 2,
    'before=' + before.slice(0, 60) + ' after=' + after.slice(0, 60));
}

console.log('\n结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
