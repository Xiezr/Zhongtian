/* v89.98b：A1→A4 演进对照 + A4 里程碑时间线 */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var d = R + '.workbuddy/tmp/playtest600/';
var out = [];
function ap(s) { out.push(s); }
function jl(p) { return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); }
function fmt(v) { v = Number(v) || 0; if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿'; if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万'; return String(Math.round(v)); }

ap('# v89.98b · 1× 300h 最优路径再测评（A1→A4 四轮演进）');
ap('');
ap('## 一、四轮演进（同一 1× 300h 口径 · 同 seed · 每轮只改"脑的决策"）');
ap('');
ap('| 指标 | A1 原始脑 | A2 +体力修正 | A3 停自动出征+幸存者+保价 | A4 +珠宝晋爵+淤积兜底 |');
ap('|---|---|---|---|---|');
var A1 = { cities: 1, army: 161, rank: 0, sold: 2618073, books: 0, lordLv: 20, elites: 6 };
var A2 = { cities: 1, army: 161, rank: 0, sold: 2618073, books: 0, lordLv: 20, elites: 6 };
var A3f = JSON.parse(fs.readFileSync(d + 'rushB_1x/rush_final.json', 'utf8'));
var A4f = JSON.parse(fs.readFileSync(d + 'rushC_1x/rush_final.json', 'utf8'));
function lvTop(tag, n) {
  var l = fs.readFileSync(d + tag + '/run.log', 'utf8');
  var m = /将领前十：([^\n]+)/.exec(l);
  return m ? m[1].slice(0, 200) : '';
}
function row(label, f1, f2, f3, f4) { ap('| ' + label + ' | ' + [f1, f2, f3, f4].join(' | ') + ' |'); }
row('城池数', A1.cities, A2.cities, A3f.cities.length, A4f.cities.length);
row('军力（终态）', A1.army, A2.army, 2169, 1777);
row('爵位', '平民', '平民', '平民', '**上造（晋 2 档）**');
row('累计套现', '262 万', '262 万', '43 万', '151 万');
row('经验书（本）', 0, 0, 4, 9);
row('通商券（次）', 0, 0, 2, 2);
row('围攻派兵', '1（未下城）', '1（未下城）', '1（未下城）', '1（未下城）');
row('顶层将（run.log）', 'Lv20', 'Lv20', 'Lv188', 'Lv171 + 4×Lv140');
ap('');
ap('A4 将领前八：' + lvTop('rushC_1x'));
ap('A3 将领前十：' + lvTop('rushB_1x'));
ap('');

ap('## 二、A4 · 1× 主跑里程碑时间线');
var l4 = fs.readFileSync(d + 'rushC_1x/run.log', 'utf8').split('\n');
['筑第', '晋爵', '珠宝', '围攻', '占地', '占领', '首次', '🚩', '🏆', '🏯', '🏅', '💎', '🪓', '🎫', '💊'].forEach(function (k) {
  l4.forEach(function (l) { if (l.indexOf(k) >= 0 && !/放弃/.test(l)) ap('  ' + l.slice(0, 155)); });
});
ap('');

ap('## 三、A4 逐年曲线（1× vs 120× vs 600×）');
var T3 = ['rushC_1x', 'rushC_120x', 'rushC_600x'];
var S = {}; T3.forEach(function (t) { S[t] = jl(d + t + '/snapshots.jsonl'); });
ap('| 年 | 1× | 120× | 600× |');
ap('|---|---|---|---|');
[1, 3, 6, 9, 12, 15, 18.75].forEach(function (Y) {
  var cells = T3.map(function (t) {
    var b = null;
    S[t].forEach(function (s) { if (b === null || Math.abs(s.y - Y) < Math.abs(b.y - Y)) b = s; });
    if (!b) return '-';
    var bl = 0; for (var k in (b.bl || {})) bl += b.bl[k];
    return '城' + b.cities + ' 军' + Math.round(b.army) + ' 建' + bl + ' Lv' + (b.genLv || 0) + ' 爵' + ((b.rush || {}).rank != null ? b.rush.rank : (b.rank || 0));
  });
  ap('| ' + Y + 'y | ' + cells.join(' | ') + ' |');
});
ap('');

ap('## 四、A4 三跑终局对照');
ap('| 指标 | 1×（300h） | 120×（2.5h） | 600×（0.5h） |');
ap('|---|---|---|---|');
T3.forEach(function () {});
var F = {}; T3.forEach(function (t) { F[t] = JSON.parse(fs.readFileSync(d + t + '/rush_final.json', 'utf8')); });
function r2(label, fn) { ap('| ' + label + ' | ' + T3.map(function (t) { return fn(F[t]); }).join(' | ') + ' |'); }
r2('城池', function (f) { return f.cities.length; });
r2('爵位', function (f) { return '第 ' + f.rank + ' 档'; });
r2('晋爵次数', function (f) { return f.rush.promote; });
r2('累计卖旧币', function (f) { return fmt(f.gold.sold) + '（' + f.gold.sales + ' 笔）'; });
r2('经验书', function (f) { return f.gold.books + ' 本'; });
r2('内功 / 提建', function (f) { return fmt(f.gold.spends.neigong) + ' / ' + fmt(f.gold.spends.build); });
r2('围攻派兵', function (f) { return f.rush.sieRep; });
r2('声望', function (f) { return f.rep; });
r2('总兵（终态）', function (f) { return f.cities.reduce(function (a, c) { return a + c.army; }, 0); });

fs.writeFileSync(d + 'digest_rush_b.md', out.join('\n'), 'utf8');
console.log('done lines=' + out.length);
