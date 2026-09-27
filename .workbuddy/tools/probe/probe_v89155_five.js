/* probe_v89155_five.js —— v89.155 五条需求取证
   ① 公文：消息打标 dump（找"采集收获 vs 系统"重合）+ 每页条数与界面高度
   ② 召回：按钮 HTML / 上膛链路 / 执行后行为
   ③ 产量 vs 时间倍率：ts=1 vs ts=600 的每秒产量比 + 界面读数
   ④ 商城/背包排序：同功能族是否相邻、组内是否按强度升序
   ⑤ 城外资源建筑容量：storeCapOf 差值 vs lv×BASE/6 + 悬停文本是否含堆场
*/
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260927 });
if (!G.state.map.grid) G.map.generate();
var st = G.state, c = st.cities[0];
G.ui._cityId = c.id;

console.log('=== ① 公文：消息打标 dump ===');
/* 造几条采集消息（走真出口） */
st.wilds = st.wilds || [];
var wk = { x: c.x + 7, y: c.y + 7 };
st.wilds = st.wilds.filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
st.wilds.push({ x: wk.x, y: wk.y, type: 'lake', level: 8, day: 0, startDay: 0 });
var gen = st.generals[0];
var bakGen = { status: gen.status, cityId: gen.cityId };
G.map.wildAt(wk.x, wk.y).garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
G.startGather(wk.x, wk.y, { changqiang: 5000 }, { cityId: c.id });
var g0 = G.gatherList()[0];
g0.elapsed = 24 * 3600;
var fr = G.finishGather(g0.id);
console.log('    收获 msg = ' + fr.msg);
/* dump：全部消息的 sub / kind / 前 42 字 */
var feed = G.msgFeedOf();
console.log('    feed 共 ' + feed.length + ' 条；逐条 [sub|kind]：');
var counters = {};
feed.slice(0, 40).forEach(function (r, i) {
  var sub = G.msgSubOf(r);
  counters[sub] = (counters[sub] || 0) + 1;
  if (i < 40) console.log('      ' + i + ' [' + sub + '|' + (r.k || '-') + '] ' + String(r.msg || '').slice(0, 42));
});
console.log('    sub 分布 = ' + JSON.stringify(counters));
/* 采集关键词的消息都落在哪些 sub？（找"重合"） */
var gatherWords = ['采集', '收获', '开采', '采满', '无功而返'];
console.log('    —— 含采集关键词的消息的 sub 分布：');
var gd = {};
feed.forEach(function (r) {
  var m = String(r.msg || '');
  if (gatherWords.some(function (w) { return m.indexOf(w) >= 0; })) {
    var sub = G.msgSubOf(r);
    gd[sub] = (gd[sub] || 0) + 1;
    console.log('      [' + sub + '] ' + m.slice(0, 50));
  }
});
console.log('    关键词消息 sub 分布 = ' + JSON.stringify(gd));

console.log('');
console.log('=== ③ 产量 vs 时间倍率 ===');
var tsBk = st.settings ? st.settings.timeScale : null;
function prodAt(ts) {
  var bk = st.world.timeScale;
  st.world.timeScale = ts;                     /* 试设 */
  var p = G.cityProdPerSec(c);
  st.world.timeScale = bk;
  return p;
}
console.log('    当前 timeScale() = ' + G.timeScale());
var p1 = prodAt(1), p600 = prodAt(600);
console.log('    grain/sec @ts=1   = ' + p1.grain.toFixed(6));
console.log('    grain/sec @ts=600 = ' + p600.grain.toFixed(6));
console.log('    比值 = ' + (p600.grain / (p1.grain || 1e-9)).toFixed(2) + '（=1 则不受倍率影响；=600 则完全随倍率）');
console.log('    界面 /时 读数(ts=600 现状) = ' + U.perHourText(G.cityProdPerSec(c).grain * 3600 / G.timeScale()) + '/时');
console.log('    —— 口径：cityProdPerSec = base(游戏时/小时)/3600 × ts（= 每**现实**秒）');
console.log('    —— U.rateHTML 显示 = ×3600/ts（= 每**游戏**小时）');

console.log('');
console.log('=== ⑤ 城外资源建筑容量 ===');
var cap0 = G.storeCapOf(c);
console.log('    未建时 storeCapOf = ' + cap0 + '（含堆场 ' + G.extStoreCapOf(c) + '）');
var grid = G.extGridOf(c);
var keep = grid[0] ? JSON.parse(JSON.stringify(grid[0])) : null;
grid[0] = { type: 'farm', lv: 4 };
var cap1 = G.storeCapOf(c);
var ex1 = G.extStoreCapOf(c);
console.log('    建 farm Lv4 后 storeCapOf = ' + cap1 + '（含堆场 ' + ex1 + '）');
console.log('    差值 = ' + (cap1 - cap0) + '；期望 = lv×BASE/6 = ' + Math.round(4 * DATA.BASE_STORE / DATA.EXT_STORE_DIV));
console.log('    BASE_STORE = ' + DATA.BASE_STORE + ' EXT_STORE_DIV = ' + DATA.EXT_STORE_DIV);
/* 悬停文本（资源行的 amtTip 由渲染产出——直接搜 ui.js 源码里的文案形态） */
var usrc = fs.readFileSync(R + 'js/ui.js', 'utf8');
console.log('    悬停是否含"堆场"字样 = ' + (usrc.indexOf('堆场') >= 0));
console.log('    ui.js 里 extStoreCapOf 消费点 = ' + (usrc.match(/extStoreCapOf/g) || []).length);
/* openExtModal 已建面板里有没有容量行 */
var i = usrc.indexOf('ui.openExtModal = function');
var seg = usrc.slice(i, i + 4200);
console.log('    openExtModal 已建分支含"仓储/容量/堆场" = '
  + (seg.indexOf('仓储') >= 0 || seg.indexOf('容量') >= 0 || seg.indexOf('堆场') >= 0));
grid[0] = keep;

console.log('');
console.log('=== ④ 商城排序现状（宝物表顺序抽样） ===');
var shop = G.ui.shopItems();
var byType = {};
shop.forEach(function (it) { (byType[it.type] = byType[it.type] || []).push(it); });
Object.keys(byType).forEach(function (t) {
  var arr = byType[t];
  console.log('  type=' + t + '（' + arr.length + ' 件）');
  arr.slice(0, 10).forEach(function (it) {
    console.log('    ' + (it.id + '            ').slice(0, 14) + ' | ' + (it.name + '　　　　').slice(0, 8)
      + ' | price=' + it.price + ' | eff=' + JSON.stringify(it.eff || it.val || it.n || '').slice(0, 40));
  });
});
/* ITEMS 原始顺序里，同 type 是否已被分组？ */
var order = {};
DATA.ITEMS.forEach(function (it, i) { if (!order[it.type]) order[it.type] = [i, i]; else order[it.type][1] = i; });
console.log('  ITEMS 里各 type 的首末下标（看是否成块）：');
Object.keys(order).forEach(function (t) {
  console.log('    ' + t + ': [' + order[t][0] + ',' + order[t][1] + ']');
});

/* 还原 */
G.map.wildAt(wk.x, wk.y).garrison = null;
st.wilds = st.wilds.filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
gen.status = bakGen.status; gen.cityId = bakGen.cityId;
process.exit(0);
