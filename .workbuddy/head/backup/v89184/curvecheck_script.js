var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data','state','questdata','systems','domain','map','battle','tactic','icons','gicons','bitmaps','portraits','story','ui','main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
console.log('=== 方案A 生产版曲线（vs 预演 planA 逐点对照）===');
function planA(s) {
  if (s <= 4000) return 0.8 * s / (s + 800);
  return 0.8 * 4000 / 4800 + (s - 4000) / 1000 * 0.025;
}
var allok = true;
[0, 500, 1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15395, 20000].forEach(function (s) {
  var prod = G.staHpPct(s);
  var want = planA(s);
  var ok = Math.abs(prod - want) < 1e-9;
  if (!ok) allok = false;
  console.log('  s=' + String(s).padEnd(7) + '生产=' + (prod * 100).toFixed(2) + '%  预演=' + (want * 100).toFixed(2) + '%  ' + (ok ? '✓' : '✗'));
});
console.log(allok ? '全部逐点一致 ✓' : '存在偏差 ✗');
/* 界面文案读取 */
console.log('');
console.log('=== 六维文案（GEN_DIMS）===');
G.ui.GEN_DIMS.forEach(function (d) { if (d.k === 'sta') console.log('体力: ' + d.use + '（' + d.use.length + ' 字）'); });
/* 满配将领体验（找天授 Lv240 挂倚天） */
var YT11 = ['yt_helm','yt_neck','yt_should','yt_chest','yt_back','yt_waist','yt_arm','yt_feet','yt_ring','yt_pend','yt_sword'];
var SLOTS11 = ['head','neck','shoulder','chest','back','waist','arm','feet','ring','pendant','weapon'];
var g = G.makeGeneral('满', 240, 'idle', null, false, 'tian', 'balance');
g.tong = 190; g.yw = 190; g.zm = 190; g.nz = 190;
g.equip = {};
SLOTS11.forEach(function (s2, i) { g.equip[s2] = { id: YT11[i], enh: 10 }; });
g.equip.mount = { id: 'jueying', enh: 10 };
G.setStaNow(g, G.staMax(g));
console.log('');
console.log('满配将：体力=' + G.staNow(g) + ' · hpMult=×' + (1 + G.staHpBonus(g)).toFixed(3)
  + '（旧曲线为 ×1.760）');
process.exit(0);
