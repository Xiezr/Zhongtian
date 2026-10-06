/* v89.196 探针E：藏珍阁 v2 成就型（老板 7）
   ① 73 件全可解析条件（类型/数值/文案）
   ② 未解锁 → collectBuy 拒（不扣金）
   ③ 达成条件 → 可激活（扣金 + 入藏 + 系列声望）
   ④ 一键集齐：有未解锁件 → 拒（说明原因）
   ⑤ 全解锁 → 一键集齐成功
   ⑥ 条件池取值出口逐一可读 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '探针E96', region: '司隶' });
var s = G.state;

console.log('══════ ① 73 件条件全解析 ══════');
var n = 0, bad = 0;
D.COLLECT.series.forEach(function (sr) {
  sr.items.forEach(function (it) {
    var cd = G.collectCondOf(it.id);
    n++;
    if (!cd) { bad++; console.log('  ⚠ ' + it.id + ' 无条件'); return; }
  });
});
console.log('  共 ' + n + ' 件，无条件 ' + bad + ' 件');
/* 抽打印几件看文本 */
['col_zhangliao', 'col_guanyu', 'col_zhouyu', 'col_yanliang'].forEach(function (id) {
  var cd = G.collectCondOf(id);
  console.log('  ' + id + ' → ' + (cd ? (cd.text + '（' + cd.cur + '/' + cd.n + '，met=' + cd.met + '）') : '无'));
});

console.log('\n══════ ② 未解锁 → 拒（不扣金）══════');
G.goldAdd(20000000 - G.goldOf());
var g0 = G.goldOf();
var r1 = G.collectBuy('col_zhangliao');   /* 条件：胜场 ≥2，新局 0 胜 */
console.log('  ' + r1.msg);
console.log('  扣金=' + (g0 - G.goldOf()) + '（应 0）　ok=' + r1.ok + '（应 false）');

console.log('\n══════ ③ 达成条件 → 激活 ══════');
s.stats = s.stats || {}; s.stats.wins = 5;
var cd2 = G.collectCondOf('col_zhangliao');
console.log('  造局后 met=' + cd2.met + '（' + cd2.cur + '/' + cd2.n + '）');
var r2 = G.collectBuy('col_zhangliao');
console.log('  ' + (r2.ok ? '入藏成功' : ('FAIL ' + r2.msg)) + '　扣金 ' + U.fmt(120000));

console.log('\n══════ ④ 一键集齐（有未解锁件）→ 拒 ══════');
var r3 = G.collectBuySeries('wei5');
console.log('  ' + r3.msg);

console.log('\n══════ ⑤ 全解锁 → 一键集齐 ══════');
/* 把全部条件类型拉满 */
s.stats.wins = 999; s.stats.conquer = 999; s.stats.wilds = 999; s.stats.gathers = 999;
s.stats.scouts = 999; s.stats.forts = 999; s.stats.recruited = 999; s.stats.trades = 999;
s.stats.forgedCount = 999; s.stats.trained = 999999; s.stats.buildDone = 999;
s.rank = 9; s.rep = 99999;
if (G.lordGeneralOf()) G.lordGeneralOf().level = 300;
var r4 = G.collectBuySeries('wei5');
console.log('  ' + (r4.ok ? ('集齐成功：' + JSON.stringify(r4)) : ('FAIL ' + r4.msg)));
var done = G.collectSeriesDoneOf('wei5');
console.log('  wei5 完成度 ' + done.have + '/' + done.total + ' done=' + done.done);

console.log('\n══════ ⑥ 条件池取值出口 ══════');
Object.keys(G.COLLECT_COND_TYPES).forEach(function (t) {
  console.log('  ' + t.padEnd(10) + ' = ' + G.collectCondValOf(t) + '（' + G.COLLECT_COND_TYPES[t].name + '）');
});

console.log('\n完成。');
process.exit(0);
