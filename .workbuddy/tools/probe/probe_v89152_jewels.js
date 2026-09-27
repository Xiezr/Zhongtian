/* v89.152 探针：珠宝体系重设（18 种 / 地形覆盖 / RANK 阶梯 / 面板 4 行 / 老档迁移）
 * 跑法：node .workbuddy/tools/probe/probe_v89152_jewels.js
 */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var pass = 0, fail = 0;
function ck(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

console.log('=== ① 体系：18 种 / 价格唯一升序 / loyalty 递增 ===');
var jewels = DATA.ITEMS.filter(function (x) { return x.type === 'jewel'; });
ck('珠宝 18 种', jewels.length === 18, 'got ' + jewels.length);
var prices = jewels.map(function (j) { return j.price; });
var uniq = {}; prices.forEach(function (p) { uniq[p] = 1; });
ck('价格 18 档且互不相同', Object.keys(uniq).length === 18);
var asc = true; for (var i = 1; i < prices.length; i++) if (prices[i] <= prices[i - 1]) asc = false;
ck('数组顺序 = 价格升序（宝箱/缴获按序切档的前提）', asc);
var loyAsc = true; for (var i2 = 1; i2 < jewels.length; i2++) if (jewels[i2].loyalty <= jewels[i2 - 1].loyalty) loyAsc = false;
ck('loyalty 随价格递增（5 → 100）', loyAsc && jewels[0].loyalty === 5 && jewels[17].loyalty === 100);
var ladder = DATA.jewelLadder();
ck('jewelLadder = 18 档', ladder.length === 18, 'got ' + ladder.length);

console.log('=== ② 地形：6 地形 x 3 种，互不重复（18/18 唯一） ===');
var jt = DATA.GATHER.jewelTable;
var terr = Object.keys(jt);
ck('6 种可采地形', terr.length === 6, terr.join(','));
var allIds = [], threeOk = true;
terr.forEach(function (t) { if (jt[t].length !== 3) threeOk = false; jt[t].forEach(function (id) { allIds.push(id); }); });
ck('每地形 3 种', threeOk);
var uq = {}; allIds.forEach(function (id) { uq[id] = (uq[id] || 0) + 1; });
var dup = Object.keys(uq).filter(function (id) { return uq[id] > 1; });
ck('18 种各归其位（无重复）', allIds.length === 18 && dup.length === 0, 'dup=' + dup.join(','));
var coverAll = jewels.every(function (j) { return allIds.indexOf(j.id) >= 0; });
ck('珠宝表与地形表一一覆盖', coverAll);
jt && terr.forEach(function (t) {
  var names = jt[t].map(function (id) { var it = null; DATA.ITEMS.forEach(function (x) { if (x.id === id) it = x; }); return it.name + '(' + it.price + ')'; });
  console.log('    ' + (DATA.TERRAIN[t].name) + ': ' + names.join(' · '));
});

console.log('=== ③ 门槛：每地形第一档 Lv1；高档需高等级 ===');
var minLv = DATA.GATHER.jewelMinLv;
var tier1ok = terr.every(function (t) { return (minLv[jt[t][0]] || 1) === 1; });
ck('每地形常见档门槛 = 1（任意等级有产出）', tier1ok);
ck('独山玉/夜明珠门槛 8 · 龙涎香/沉香门槛 7', minLv.dushanyu === 8 && minLv.yemingzhu === 8 && minLv.longxianxiang === 7);
var P = G.gatherJewelPick;
var rLow = function () { return 0.9; }, rTop = function () { return 0.05; }, rHit = function () { return 0.01; };
var lv1ok = terr.every(function (t) { return P(t, 1, rLow) !== null; });
ck('实测：每地形 Lv1 都有产出', lv1ok);
var h3 = P('hill', 3, rTop), h8 = P('hill', 8, rTop);
ck('实测：山地 Lv3 只出绿松石（碧玺 5 / 独山玉 8 门槛拦）', h3.id === 'lvsongshi', 'got ' + h3.id);
ck('实测：山地 Lv8 顶级档 = 独山玉', h8.id === 'dushanyu', 'got ' + h8.id);
ck('实测：平地无珠宝', P('plain', 12, rLow) === null);
var anyT = terr.every(function (t) { return P(t, 1, rHit).id === 'yemingzhu'; });
ck('实测：夜明珠全地形（v89.140 机制保留）', anyT);

console.log('=== ④ RANK：18 种全部登场（共同构成爵位需求） ===');
var need = {};
DATA.RANK.forEach(function (rk) { Object.keys(rk.jewel || {}).forEach(function (id) { need[id] = 1; }); });
var miss = jewels.filter(function (j) { return !need[j.id]; });
ck('爵位用到 18 种全部', miss.length === 0, 'missing=' + miss.map(function (j) { return j.name; }).join(','));
var outOfLadder = Object.keys(need).filter(function (id) { return ladder.indexOf(id) < 0; });
ck('爵位需求都在阶梯内', outOfLadder.length === 0);
var jc13 = DATA.jewelCostAt(13), jc45 = DATA.jewelCostAt(45);
ck('建筑 Lv13 珠宝 = 蚌珠（Lv1 野地可采）', jc13 && jc13.bengzhu >= 1, JSON.stringify(jc13));
ck('建筑 Lv45 珠宝档 = ' + Object.keys(jc45 || {}).join(','), !!jc45);
console.log('    Lv13 -> ' + JSON.stringify(jc13) + ' ; Lv24 -> ' + JSON.stringify(DATA.jewelCostAt(24)) + ' ; Lv45 -> ' + JSON.stringify(jc45));

console.log('=== ⑤ 老档迁移：旧 15 种 -> 新 18 种（等值 · 幂等 · 同名安全） ===');
G.newGame({ name: '验', cityName: '许都', region: '豫州', mapSeed: 20260927 });
var s = G.state;
/* 造"老档"：塞旧 15 种 + 一颗新 id（混淆项） */
s.items = { zhenzhu: 10, shanhu: 5, liuli: 3, hupo: 7, manao: 2, shuijing: 4, feicui: 6, yushi: 8,
  yemingzhu: 9, xueshanhu: 1, longyan: 1, lantianyu: 1, fengyu: 1, heshibi: 1, chuanguo: 1,
  chenxiang: 2 /* 新体系 id（不该被碰） */ };
delete s.jewelMig152;
var n = G.migrateJewels152();
console.log('    迁移颗数 = ' + n);
/* 期望（v89.152f 定稿）：14 键等值搬运；**yemingzhu 转正保留**（旧夜明珠 9 颗原地留在新体系）；
   heshibi(150) -> yemingzhu；chuanguo(240) -> dushanyu。 */
var expect = { bengzhu: 10, mila: 5, meiyu: 3, puyu: 7, lvsongshi: 2, yusui: 4, yinchenmu: 6, cuiyu: 8,
  yemingzhu: 10 /* 9 旧夜明珠转正 + 1 和氏璧 */, jiaorenlei: 1, tianzhu: 1, longxianxiang: 1,
  chenxiang: 3 /* 2 + 凤羽 1 */, dushanyu: 1 };
var okAll = true, bad = [];
Object.keys(expect).forEach(function (k) {
  var got = s.items[k] || 0;
  if (got !== expect[k]) { okAll = false; bad.push(k + ': want ' + expect[k] + ' got ' + got); }
});
ck('等值搬运（含夜明珠转正 · 14 键逐项核对）', okAll, bad.join(' | '));
var noDan = (s.items.danbaishi || 0) === 0 && (s.items.bixi || 0) === 0 && (s.items.zijin || 0) === 0;
ck('无旧对应的 4 种新珠宝从零（紫晶/红珊瑚/蛋白石/碧玺）', noDan);
var oldLeft = Object.keys(DATA.JEWEL_MIG152).filter(function (id) { return (s.items[id] || 0) > 0 && !DATA.ITEMS.some(function (x) { return x.id === id; }); });
ck('旧 id 已清零', oldLeft.length === 0, oldLeft.join(','));
var n2 = G.migrateJewels152();
ck('幂等：重复调用 = 0', n2 === 0 && (s.items.chenxiang === 3));

console.log('=== ⑥ 面板：未占（4 行 + 无备注 + 按钮文案）/ 已占（无产出行） ===');
G.map.generate();   /* 地图未生成时 tile 全 null（newGame 不含生成步骤） */
var c0 = G.currentCity();
G.ui._cityId = c0.id;
/* 找一块未占的可采地形（用地图真格；城池坐标是绝对坐标，直接全图扫） */
var map = G.map;
var tx = -1, ty = -1;
for (var r0 = 1; r0 <= 20 && tx < 0; r0++) {
  for (var dx = -r0; dx <= r0 && tx < 0; dx++) {
    for (var dy = -r0; dy <= r0 && tx < 0; dy++) {
      var x = c0.x + dx, y = c0.y + dy;
      var tl = map.tile(x, y);
      if (!tl || !tl.terrain || tl.terrain === 'plain' || tl.terrain === 'city') continue;
      if (map.wildAt(x, y)) continue;
      tx = x; ty = y;
    }
  }
}
ck('找到未占可采格', tx > 0, '(' + tx + ',' + ty + ')');
var html = '';
var _om = G.ui.openModal;
G.ui.openModal = function (hh) { html = hh; };
try { G.ui.openLandModal(tx, ty); } catch (e) { html = 'ERR:' + e.message; }
G.ui.openModal = _om;
var has = function (t) { return html.indexOf(t) >= 0; };
console.log('    未占格 (' + tx + ',' + ty + ') 地形=' + ((map.tile(tx, ty) || {}).terrain));
ck('含"产出"区', has('<div class="op-zone-t">产出</div>'));
ck('四行齐备（资源/产量加成/材料/珠宝）', has('>资源<') && has('>产量加成<') && has('>材料<') && has('>珠宝<'));
ck('无"占领/掠夺"备注行', !has('打下来后军队就地驻守') && !has('打完直接撤军') && !has('Lv0 无驻军位'));
ck('按钮文案 = 占领（不带"并驻守"）', has('data-mode="occupy">🚩 占领</button>'));
ck('三键在弹窗底部（注释在按钮前）', html.lastIndexOf('data-mode="scout"') > html.lastIndexOf('op-zone-t">产出'));
ck('无"此地可采"旧文案', !has('此地可采'));
console.log('    产出区片段:\n' + (html.match(/<div class="op-zone op-zone-eq"><div class="op-zone-t">产出<\/div>[\s\S]*?<\/div><\/div>/) || ['(无)'])[0].split('</div>').join('</div>\n'));

/* 已占面板：加野地记录 -> 不应含产出 4 行 */
s.wilds = s.wilds || [];
s.wilds.push({ x: tx, y: ty, type: map.tile(tx, ty).terrain, level: 5, day: 0, startDay: 0 });
html = '';
G.ui.openModal = function (hh) { html = hh; };
try { G.ui.openLandModal(tx, ty); } catch (e) { html = 'ERR:' + e.message; }
G.ui.openModal = _om;
/* 判据用"标签形态"（危险操作区有"失去产量加成"文案 —— 裸词会误伤） */
ck('已占：无产出行/无"此地可采"', !has('op-zone-t">产出') && !has('此地可采') && !has('>产量加成<') && !has('>材料<') && !has('>珠宝<'));
ck('已占：驻军/采集/地块操作仍在', has('op-zone-t">驻军') && has('op-zone-t">地块操作'));
s.wilds = s.wilds.filter(function (z) { return !(z.x === tx && z.y === ty); });

console.log('\n===== ' + pass + ' pass / ' + fail + ' fail =====');
process.exit(fail ? 1 : 0);
