/* v89.98d：A2 三跑综合提取 → digest_rush.md */
'use strict';
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var d = R + '.workbuddy/tmp/playtest600/';
var out = [];
function ap(s) { out.push(s); }
function fmt(v) { v = Number(v) || 0; if (Math.abs(v) >= 1e8) return (v / 1e8).toFixed(2) + '亿'; if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(1) + '万'; return String(Math.round(v)); }
function jl(p) { if (!fs.existsSync(p)) return []; return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); }

var TAGS = ['rushA_1x', 'rushA_120x', 'rushA_600x'];
var D = {};
TAGS.forEach(function (tag) {
  var p = d + tag + '/';
  D[tag] = {
    final: JSON.parse(fs.readFileSync(p + 'rush_final.json', 'utf8')),
    snaps: jl(p + 'snapshots.jsonl'),
    battles: jl(p + 'battles.jsonl'),
    events: jl(p + 'events.jsonl'),
    log: fs.readFileSync(p + 'run.log', 'utf8')
  };
});

ap('# v89.98 三倍速对照数据（同 seed · 同 18.75 游戏年 · A2 脑）');
ap('');

/* ---------- 1. 终局对照 ---------- */
ap('## 1. 终局对照');
ap('| 指标 | 1×（300 现实小时） | 120×（2.5 小时） | 600×（0.5 小时） |');
ap('|---|---|---|---|');
function row(label, fn) {
  ap('| ' + label + ' | ' + TAGS.map(function (t) { return fn(D[t]); }).join(' | ') + ' |');
}
row('城池数', function (x) { return x.final.cities.length; });
row('总军力', function (x) { return x.final.cities.reduce(function (a, c) { return a + c.army; }, 0); });
row('人口（四资源仅粮/金/人口均值）', function (x) { return x.final.cities.reduce(function (a, c) { return a + c.pop; }, 0); });
row('金（城内合计）', function (x) { return fmt(x.final.cities.reduce(function (a, c) { return a + c.gold; }, 0)); });
row('累计卖金', function (x) { return fmt(x.final.gold.sold); });
row('卖金笔数', function (x) { return x.final.gold.sales; });
row('单笔均额', function (x) { return x.final.gold.sales ? fmt(x.final.gold.sold / x.final.gold.sales) : '0'; });
row('声望', function (x) { return x.final.rep; });
row('爵位', function (x) { return '第 ' + x.final.rank + ' 档'; });
row('围攻派兵', function (x) { return x.final.rush.sieRep + ' 次（下城 ' + x.final.rush.sieWin + '）'; });
row('体力道具用量', function (x) { return x.final.rush.sta || 0; });
row('通商券', function (x) { return x.final.rush.coupon || 0; });
row('战斗数', function (x) { return x.battles.length; });
row('战斗胜利', function (x) { return x.battles.filter(function (b) { return b.winner === 'atk'; }).length; });
row('建筑位（主城）', function (x) { return x.final.cities[0].slots; });
ap('');

/* ---------- 2. 逐年曲线（每 3 游戏年） ---------- */
ap('## 2. 逐年曲线（军/金/建筑等级和/将领等级和）');
ap('| 年 | 1× | 120× | 600× |');
ap('|---|---|---|---|');
[1, 3, 6, 9, 12, 15, 18.75].forEach(function (Y) {
  var cells = TAGS.map(function (t) {
    var best = null;
    D[t].snaps.forEach(function (s) { if (best === null || Math.abs(s.y - Y) < Math.abs(best.y - Y)) best = s; });
    if (!best) return '-';
    var bl = 0; for (var k in (best.bl || {})) bl += best.bl[k];
    return '军' + Math.round(best.army) + ' 金' + fmt((best.res || {}).gold)
      + ' 建' + bl + ' 将Lv' + (best.genLv || 0);
  });
  ap('| ' + Y + 'y | ' + cells.join(' | ') + ' |');
});
ap('');

/* ---------- 3. 1×：市场折价行为 ---------- */
ap('## 3. 1× 卖金行为（物多价贱实测）');
var sells = [];
D.rushA_1x.events.forEach(function (o) {
  if (o.msg && o.msg.indexOf('市易') >= 0) {
    var m = /售出 ([\d.]+)(万?)\s*得金 ([\d.]+)([k万]?)。今日已售 ([\d.]+)(万?)\s*金 · 汇率 ×([\d.]+)/.exec(o.msg);
    if (m) {
      var amt = Number(m[1]) * (m[2] === '万' ? 1e4 : 1);
      var got = Number(m[3]) * (m[4] === 'k' ? 1e3 : (m[4] === '万' ? 1e4 : 1));
      sells.push({ t: o.t, amt: amt, got: got, rate: Number(m[7]), today: Number(m[5]) * (m[6] === '万' ? 1e4 : 1) });
    }
  }
});
ap('总笔数 ' + sells.length + ' · 累计卖 ' + fmt(sells.reduce(function (a, x) { return a + x.amt; }, 0))
  + ' 单位 · 得金 ' + fmt(sells.reduce(function (a, x) { return a + x.got; }, 0)));
var buckets = { '贴保价(≥0.9)': 0, '(0.5~0.9)': 0, '(0.2~0.5)': 0, '触底(≤0.2)': 0 };
sells.forEach(function (x) {
  if (x.rate >= 0.9) buckets['贴保价(≥0.9)']++; else if (x.rate >= 0.5) buckets['(0.5~0.9)']++;
  else if (x.rate >= 0.2) buckets['(0.2~0.5)']++; else buckets['触底(≤0.2)']++;
});
ap('汇率分布：' + JSON.stringify(buckets));
var step = Math.max(1, Math.floor(sells.length / 10));
ap('样本（每 1/10 取一条）：');
for (var i = 0; i < sells.length; i += step) {
  var s = sells[i];
  ap('  @' + (s.t / 3600).toFixed(1) + 'h（y' + (s.t / 57600).toFixed(1) + '）汇率 ×' + s.rate + ' · 售 ' + fmt(s.amt) + ' 得 ' + fmt(s.got) + ' · 当日已售 ' + fmt(s.today));
}
ap('');

/* ---------- 4. 120× 的逆袭细节 ---------- */
ap('## 4. 120× 的逆袭：3 城 / Lv100 / 军 2147 的来源');
var L120 = D.rushA_120x.log.split('\n');
['筑第二城', '筑第三城', '首次出征', '首次占领', '灵草升档', '里程碑'].forEach(function (k) {
  L120.forEach(function (l) { if (l.indexOf(k) >= 0) ap('  ' + l.slice(0, 160)); });
});
ap('');

/* ---------- 5. 1× 的里程碑与卡点 ---------- */
ap('## 5. 1× 的里程碑与卡点');
var L1 = D.rushA_1x.log.split('\n');
['⏭', '🏆', '首次出征', '据点已下', '围攻线点火', '放弃', '首次占领'].forEach(function (k) {
  L1.forEach(function (l) { if (l.indexOf(k) >= 0) ap('  ' + l.slice(0, 160)); });
});
ap('');
ap('## 6. 三跑的战斗记录（尾部 6 条）');
TAGS.forEach(function (t) {
  ap('**' + t + '**：');
  D[t].battles.slice(-6).forEach(function (b) {
    ap('  y' + b.y + ' ' + b.mode + ' ' + (b.winner === 'atk' ? '胜' : '败')
      + ' ' + (b.rounds || '?') + '回合 损' + (b.atkLoss || 0) + ' 敌损' + (b.defLoss || 0) + ' 目标' + (b.target || '').slice(0, 20));
  });
});

fs.writeFileSync(d + 'digest_rush.md', out.join('\n'), 'utf8');
console.log('done lines=' + out.length);
