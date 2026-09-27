'use strict';
/* v89.159 探针 A：复现「民房 3 级 · 官府 4 级 · 却说需官府 5 级」——
   查 buildPrereqOf 对多座建筑（民房有 2 座）用的 next 是「全城最高级+1」还是「本座+1」。 */
var fs = require('fs'), path = require('path');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain'].forEach(function (f) {
  require(path.join('E:/Deepseekdb/js/', f + '.js'));
});
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: '探159', cityName: '许都', region: '豫州', mapSeed: 20260959 });
var s = G.state;
var c = G.currentCity();
console.log('城 =', c.name, '· type =', c.type, '· 主城?', !!G.isMainCity(c), '· lift =', G.rankBuildCapOf(c));

function setLv(id, lv, onlyIdx) {
  (c.cells || []).forEach(function (cell, i) {
    if (cell.build && cell.build.id === id) {
      if (onlyIdx == null || i === onlyIdx) cell.build.lvl = lv;
    }
  });
}
function lvOf(id) { return G.buildingLevel(c, id); }
function cellIdxOf(id) {
  var out = [];
  (c.cells || []).forEach(function (cell, i) { if (cell.build && cell.build.id === id) out.push(i); });
  return out;
}
function dump(tag) {
  console.log('\n----- ' + tag + ' -----');
  console.log('民房格 =', JSON.stringify(cellIdxOf('minfang')), '· buildingLevel(民房) =', lvOf('minfang'),
    '· 官府 =', lvOf('guanfu'));
  var pre = G.buildPrereqOf(c, 'minfang');
  console.log('buildPrereqOf(minfang) 不带 nextLv →', JSON.stringify(pre));
  var ci = cellIdxOf('minfang');
  if (ci.length) {
    ci.forEach(function (i) {
      var pre2 = G.buildPrereqOf(c, 'minfang', (c.cells[i].build.lvl || 0) + 1);
      console.log('  格 ' + i + '（Lv' + c.cells[i].build.lvl + '）带 nextLv  →', JSON.stringify(pre2));
    });
  }
  console.log('buildCapOf(minfang) =', G.buildCapOf(c, 'minfang'));
}

/* S1：单座民房 Lv3 · 官府 Lv4 —— 预期可升 */
setLv('guanfu', 4);
setLv('minfang', 3);
dump('S1 单座民房 Lv3 · 官府 Lv4');

/* S2：两座民房，一座已 Lv4、另一座 Lv3 —— 点 Lv3 那座（老板场景） */
var ci = cellIdxOf('minfang');
if (ci.length >= 2) {
  c.cells[ci[0]].build.lvl = 4;
  c.cells[ci[1]].build.lvl = 3;
}
dump('S2 民房 4 级 + 3 级混存 · 官府 Lv4');
var r2 = G.upgradeAt(c.id, ci.length >= 2 ? ci[1] : 0);
console.log('upgradeAt(那座 Lv3 民房) →', JSON.stringify(r2));

/* S3：两座都是 Lv3 —— 点任一座 */
if (ci.length >= 2) { c.cells[ci[0]].build.lvl = 3; c.cells[ci[1]].build.lvl = 3; }
dump('S3 两座民房都 Lv3 · 官府 Lv4');
console.log('upgradeAt →', JSON.stringify(G.upgradeAt(c.id, ci[0] || 0)));

/* S4：官府总闸体检 —— 民房 4 级想升 5（官府 4）应被拦，且文案应为"需官府 Lv5" */
s.queues.build.length = 0;
c.cells.forEach(function (cell) { if (cell.build && cell.build.id === 'minfang') cell.build.lvl = 4; });
dump('S4 民房全 Lv4（= 官府 4）· 再升');
console.log('upgradeAt(Lv4 民房) →', JSON.stringify(G.upgradeAt(c.id, ci[0] || 0)));
process.exit(0);
