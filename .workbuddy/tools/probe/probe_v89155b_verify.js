/* probe_v89155b_verify.js —— v89.155 五条需求**验证版**探针
   ① 公文铺满分页（docPerOf）② 采集消息归位（autoGatherTick 真跑）
   ③ 召回三态按钮 ④ 内置排序标号（商城真渲染顺序）⑤ 容量显式化 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var P = 0, F = 0;
function ck(name, cond, extra) {
  if (cond) { P++; console.log('  ✓ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { F++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

G.newGame({ name: '验', cityName: '许都', region: '碎垣', mapSeed: 20260927 });
if (!G.state.map.grid) G.map.generate();
var st = G.state, c = st.cities[0];
G.ui._cityId = c.id;

console.log('=== ① 公文铺满分页 ===');
var u = fs.readFileSync(R + 'js/ui.js', 'utf8');
ck('docPerOf 出口存在 + 三处消费 + 分页登记', u.indexOf('ui.docPerOf = function') >= 0
  && (u.match(/ui\.docPerOf\(/g) || []).length === 5);
var perSysAll = G.ui.docPerOf('sys');          /* 默认 _msgTag='all'（含摘要） */
var perSysTag = (function () { var bk = G.ui._msgTag; G.ui._msgTag = 'gather'; var v = G.ui.docPerOf('sys'); G.ui._msgTag = bk; return v; })();
var perWar = G.ui.docPerOf('war');
console.log('    per: sys(全部)=' + perSysAll + ' sys(单标签)=' + perSysTag + ' war=' + perWar + '（旧固定 15 / 10）');
ck('系统页每页 > 15（铺满，含摘要档）', perSysAll > 15 && perSysAll <= 26, 'per=' + perSysAll);
ck('系统页单标签 ≥ 22', perSysTag >= 22, 'per=' + perSysTag);
ck('战报页每页 > 10（铺满）', perWar > 10 && perWar <= 22, 'per=' + perWar);
ck('旧值保留为兜底（MSG_PER/DOC_PER 仍定义）', G.ui.MSG_PER === 15 && G.ui.DOC_PER === 10);
ck('行高常量实测量在册', G.ui.DOC_LINE_H.sys > 24 && G.ui.DOC_LINE_H.sys < 26 && G.ui.DOC_LINE_H.war > 33 && G.ui.DOC_LINE_H.war < 34);

console.log('=== ② 采集消息归位（自动采集 → 采集收获） ===');
st.settings.autoGather = true;
st.wilds = st.wilds || [];
var wk = { x: c.x + 9, y: c.y + 9 };
st.wilds = st.wilds.filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
st.wilds.push({ x: wk.x, y: wk.y, type: 'lake', level: 8, day: 0, startDay: 0 });
var gen = st.generals[0];
var bakGen = { status: gen.status, cityId: gen.cityId };
G.map.wildAt(wk.x, wk.y).garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
G.startGather(wk.x, wk.y, { changqiang: 5000 }, { cityId: c.id });
var g0 = G.gatherList()[0];
g0.elapsed = 24 * 3600;
var before = G.msgFeedOf().length;
G.autoGatherTick();
var feed = G.msgFeedOf();
var autoMsg = null;
feed.forEach(function (r) { if (String(r.msg || '').indexOf('自动采集/收获') >= 0) autoMsg = r; });
ck('autoGatherTick 真跑出「自动采集/收获」消息', !!autoMsg, autoMsg ? autoMsg.msg.slice(0, 40) : '(无)');
ck('该消息 sub = gather（原误落军情）', !!autoMsg && G.msgSubOf(autoMsg) === 'gather');
ck('该消息 kind = sys（不再混进战报）', !!autoMsg && autoMsg.k === 'sys');
/* 采集关键词全部归 gather */

console.log('=== ③ 召回三态按钮 ===');
var hasGar = G.wildGarrisonTotal(G.wildGarrisonAt(wk.x, wk.y)) > 0;
var hRed = G.ui.wildWdBtnHTML(wk.x, wk.y, { xs: true });
G.ui._wdArm138 = wk.x + ',' + wk.y;
var hGold = G.ui.wildWdBtnHTML(wk.x, wk.y, { xs: true });
G.ui._wdArm138 = null;
var hGreen = G.ui.wildWdBtnHTML(wk.x, wk.y, { xs: true, hasGar: false });
console.log('    红: ' + hRed.slice(0, 110));
console.log('    黄: ' + hGold.slice(0, 110));
console.log('    绿: ' + hGreen.slice(0, 110));
ck('有驻军 = 红（btn xs red）', hRed.indexOf('btn xs red') >= 0 && hRed.indexOf('🏳️ 召回') >= 0);
ck('上膛 = 黄（btn xs gold + 再点一次）', hGold.indexOf('btn xs gold') >= 0 && hGold.indexOf('再点一次') >= 0);
ck('无驻军 = 绿（btn xs green + disabled）', hGreen.indexOf('btn xs green') >= 0 && hGreen.indexOf('disabled') >= 0);
ck('三态都保留 data-action + 坐标（禁用态也给）', hRed.indexOf('data-action="wild-withdraw"') >= 0
  && hGreen.indexOf('data-action="wild-withdraw"') >= 0 && hGreen.indexOf('data-x="' + wk.x + '"') >= 0);
/* main.js 上膛链路 */
var m = fs.readFileSync(R + 'js/main.js', 'utf8');
ck('上膛超时常量在册（DATA.WD_ARM_MS = 2000）', DATA.WD_ARM_MS === 2000);
ck('case 用超时回落 + 就地重绘（wdRepaint）', m.indexOf('ui._wdArmTimer155 = setTimeout') >= 0 && m.indexOf('ui.wdRepaint(_wx155, _wy155)') >= 0);
ck('执行后不再弹地块面板（无 openLandModal）', (function () {
  var i = m.indexOf("case 'wild-withdraw': {");
  var seg = m.slice(i, i + 1800);
  return seg.indexOf('openLandModal') < 0 && seg.indexOf('GAME.refreshAll()') >= 0;
})());
ck('不再有长 toast（「一大段说明」退役）', m.indexOf('兵与将随之回城，采集进度作废') < 0);
ck('地块面板同步走同一出口（lblMode=g）', u.indexOf("ui.wildWdBtnHTML(x, y, { hasGar: true, lblMode: 'g' })") >= 0
  && u.indexOf("'🏳️ 召回驻军'") >= 0);

console.log('=== ④ 内置排序标号（商城真渲染顺序） ===');
/* 抓 shopHTML 的卡片顺序 */
G.ui._shopCat = 'prod_buff';
var html = G.ui.shopHTML();
var order = [];
var re = /data-action="shop-buy" data-item="([a-z_0-9]+)"/g, mm;
while ((mm = re.exec(html))) order.push(mm[1]);
console.log('    prod_buff 顺序 = ' + order.join(' → '));
var expGrain = ['shennongchu', 'shennongling', 'houji'];
ck('粮食系（grain）三件相邻且由小到大', (function () {
  var idx = expGrain.map(function (id) { return order.indexOf(id); });
  return idx[0] >= 0 && idx[1] === idx[0] + 1 && idx[2] === idx[1] + 1;
})(), order.join(','));
/* 军事页 */
G.ui._shopCat = 'military_buff';
html = G.ui.shopHTML();
order = [];
re = /data-action="shop-buy" data-item="([a-z_0-9]+)"/g;
while ((mm = re.exec(html))) order.push(mm[1]);
console.log('    military_buff 顺序 = ' + order.join(' → '));
ck('攻击系（atk 单键）四鼓相邻且由小到大', (function () {
  var exp = ['xianzhenzhangu', 'pozhengu', 'xuezhanqi', 'mieguogu'];
  var idx = exp.map(function (id) { return order.indexOf(id); });
  return idx.every(function (v, i) { return i === 0 ? v >= 0 : v === idx[i - 1] + 1; });
})());
ck('复合件（攻+防系）自成一族相邻（不劈开四鼓）', (function () {
  var exp = ['gongshou_fu', 'quanjun_ling', 'wanquan_ce', 'tianshi_ling'];
  var idx = exp.map(function (id) { return order.indexOf(id); });
  return idx.every(function (v, i) { return i === 0 ? v >= 0 : v === idx[i - 1] + 1; });
})());
/* 珠宝页（价格序） */
G.ui._shopCat = 'jewel';
html = G.ui.shopHTML();
order = [];
re = /data-action="shop-buy" data-item="([a-z_0-9]+)"/g;
while ((mm = re.exec(html))) order.push(mm[1]);
var prices = order.map(function (id) { var it = null; DATA.ITEMS.forEach(function (x) { if (x.id === id) it = x; }); return it ? it.price : 0; });
ck('珠宝按价格由小到大（前 10 位单调）', prices.slice(0, 10).every(function (v, i) { return i === 0 || v >= prices[i - 1]; }), prices.slice(0, 8).join(','));
/* 标号出口 */
ck('标号 = 族×1000+档（派生正确）', (function () {
  var a = null, b = null, j1 = null;
  DATA.ITEMS.forEach(function (x) {
    if (x.id === 'xianzhenzhangu') a = x;
    if (x.id === 'mieguogu') b = x;
    if (x.id === 'bengzhu') j1 = x;
  });
  return G.ui.itemFamOf(a) === 1010 && G.ui.itemPowOf(a) === 100
    && G.ui.itemOrdOf(b) > G.ui.itemOrdOf(a)
    && G.ui.itemFamOf(j1) === 5010 && G.ui.itemOrdOf(j1) === 5010002;
})());

console.log('=== ⑤ 资源建筑容量显式化 ===');
var grid = G.extGridOf(c);
var keep5 = grid[5] ? JSON.parse(JSON.stringify(grid[5])) : null;
grid[5] = { id: 'e6', type: 'farm', lv: 6 };
var one = G.extStoreCapOneOf(grid[5]);
console.log('    farm Lv6 单块贡献 = ' + one + '；期望 = 6×2e6/6 = ' + Math.round(6 * DATA.BASE_STORE / DATA.EXT_STORE_DIV));
ck('单块贡献出口 = lv×BASE/DIV', one === Math.round(6 * DATA.BASE_STORE / DATA.EXT_STORE_DIV));
ck('空地块贡献为 0', G.extStoreCapOneOf({ type: null, lv: 0 }) === 0);
/* 已建面板含"另加仓储上限" */
G.ui.closeAllModals();
var ph = '';
var _om = G.ui.openModal; G.ui.openModal = function (h) { ph = h; };
G.ui.openExtModal(5);
G.ui.openModal = _om;
ck('已建面板含「另加仓储上限 +值」', ph.indexOf('另加仓储上限') >= 0 && ph.indexOf(U.fmt(one)) >= 0);
/* 空地 tip */
grid[5] = { id: 'e6', type: null, lv: 0 };
ph = '';
G.ui.openModal = function (h) { ph = h; };
G.ui.openExtModal(5);
G.ui.openModal = _om;
var tipM = ph.match(/title="([^"]*辟田[^"]*)"/) || ph.match(/title="([^"]*农田[^"]*)"/);
var tip = tipM ? tipM[1] : '';
console.log('    空地 tip = ' + tip);
ck('空地 tip 不含 undefined（desc 已补）', ph.indexOf('undefined') < 0 && tip.indexOf('辟田垦殖') >= 0);
ck('空地 tip 含「每级另加仓储上限」', tip.indexOf('每级另加仓储上限') >= 0);
/* 资源行悬停 */
ck('资源行悬停含「其中城外堆场」（源码）', u.indexOf('其中城外堆场 +') >= 0);
grid[5] = keep5;

/* 还原 */
G.map.wildAt(wk.x, wk.y).garrison = null;
st.wilds = st.wilds.filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
gen.status = bakGen.status; gen.cityId = bakGen.cityId;
st.settings.autoGather = false;

console.log('\n结果：' + P + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
