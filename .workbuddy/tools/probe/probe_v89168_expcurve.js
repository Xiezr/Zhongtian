/* v89.168 经验曲线取证：逐级 need / 增量 / 累计 + 异常自查
   运行：node .workbuddy/tools/probe/probe_v89168_expcurve.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
var C = DATA.EXP_CURVE;

console.log('=== 曲线参数 ===');
console.log('  seg1To=' + C.seg1To + '  base=' + C.base + '  quad=' + C.quad + '  topLv=' + C.topLv);
console.log('  needTop=' + C.needTop + '  growth=' + C.growth.toFixed(6) + '（每级 +' + ((C.growth - 1) * 100).toFixed(2) + '%）');
console.log('  total=' + C.total);

/* 用真出口逐级取（g 只要有 level 字段即可） */
function need(lv) { return G.expNeedOf({ level: lv }); }
var rows = [], cum = 0;
for (var lv = 1; lv <= C.topLv; lv++) {
  var nd = need(lv);
  var dt = lv === 1 ? nd : nd - need(lv - 1);
  cum += nd;
  rows.push({ lv: lv, need: nd, delta: dt, cum: cum });
}

console.log('\n=== 关键节点（need / 本级增量 / 累计） ===');
[1, 2, 5, 10, 20, 29, 30, 31, 32, 40, 50, 60, 80, 100, 120, 150, 180, 200, 220, 239, 240].forEach(function (lv) {
  var r = rows[lv - 1];
  console.log('  Lv' + String(lv).padStart(3) + '  need=' + String(r.need).padStart(8)
    + '  Δ=' + String(r.delta).padStart(8) + '  累计=' + String(r.cum).padStart(9));
});

console.log('\n=== 异常自查 ===');
/* ① 增量是否单调递增（应然：越到后面每级需求越大） */
var drops = [];
for (var i = 1; i < rows.length; i++) {
  if (rows[i].delta < rows[i - 1].delta) drops.push({ at: rows[i].lv, prev: rows[i - 1].delta, now: rows[i].delta });
}
console.log('  ① 增量回落（Δ(本) < Δ(上一级)）共 ' + drops.length + ' 处：');
drops.slice(0, 14).forEach(function (d) { console.log('     Lv' + d.at + '：Δ从 ' + d.prev + ' 掉到 ' + d.now); });
if (drops.length > 14) console.log('     …（共 ' + drops.length + ' 处）');

/* ② 分段点前后 */
console.log('  ② 分段点 Lv30→31：need ' + need(30) + ' → ' + need(31) + '（Δ ' + (need(31) - need(30)) + '）· 上一级 Δ = ' + (need(30) - need(29)));

/* ③ 增量最大处与比值 */
var mx = rows[rows.length - 1];
console.log('  ③ 最大单级增量 = ' + mx.delta + '（Lv' + mx.lv + '）· 最小 = ' + rows[0].delta + '（Lv1）· 比 ' + (mx.delta / rows[0].delta).toFixed(0) + '×');

/* ④ 低段占总量比例 */
console.log('  ④ Lv1~30 累计 = ' + rows[29].cum + '（占全曲线 ' + (rows[29].cum / cum * 100).toFixed(3) + '%）');
console.log('     Lv1~100 累计 = ' + rows[99].cum + '（' + (rows[99].cum / cum * 100).toFixed(2) + '%）');
console.log('     Lv100~240 累计 = ' + (cum - rows[99].cum) + '（' + ((cum - rows[99].cum) / cum * 100).toFixed(2) + '%）');

/* ⑤ 与旧v43口径的关系（提一嘴背景不深挖） */
console.log('\n=== 导出前 12 级与末 6 级明细（供文档/图） ===');
rows.slice(0, 12).forEach(function (r) { console.log('  Lv' + r.lv + ' need=' + r.need + ' Δ=' + r.delta); });
rows.slice(-6).forEach(function (r) { console.log('  Lv' + r.lv + ' need=' + r.need + ' Δ=' + r.delta + ' 累计=' + r.cum); });

/* 落一份 JSON 给画图用 */
var out = { param: { seg1To: C.seg1To, base: C.base, quad: C.quad, topLv: C.topLv, needTop: C.needTop, growth: C.growth, total: C.total },
  rows: rows.map(function (r) { return { lv: r.lv, need: r.need, delta: r.delta, cum: r.cum }; }) };
fs.writeFileSync(path.join(R, '.workbuddy/tmp/expcurve_v89168.json'), JSON.stringify(out));
console.log('\nJSON 已落 .workbuddy/tmp/expcurve_v89168.json');
process.exit(0);
