'use strict';
/* v89.148 探针：按新口径（露天 = Σlv × BASE_STORE / 6）实算四档满配仓容 → 新 resByTier 值 */
var fs = require('fs'), path = require('path');
eval(fs.readFileSync('.workbuddy/tmp/smoke_env_head.js', 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain'].forEach(function (f) {
  require(path.join('E:/Deepseekdb/js/', f + '.js'));
});
var G = global.GAME, DATA = G.DATA;
G.newGame({ name: '探148', cityName: '许都', region: '豫州', mapSeed: 20260948 });
var s = G.state;
s.techs = s.techs || {};
s.techs.chucun = DATA.TECH_MAX_LV;                       /* 储存技术拉满 */
console.log('EXT_STORE_DIV =', DATA.EXT_STORE_DIV, '· BASE_STORE =', DATA.BASE_STORE);
console.log('旧 resByTier =', JSON.stringify(DATA.NPC_CITY_RES.resByTier));
var out = {};
['capital', 'zhou', 'jun', 'county'].forEach(function (ty) {
  var c = (DATA.NPC_CITIES || []).filter(function (x) { return x.type === ty; })[0];
  if (!c) { console.log(ty + ': 无样本'); return; }
  var sh = G.npcCityShadow(c);
  var fake = G.makeCity({ id: 'cap_' + ty, name: '核' + ty, x: c.x, y: c.y, type: ty });
  fake.cells = sh.cells.map(function (x) {
    return { build: x.build ? { id: x.build.id, lvl: x.build.lvl } : null, pending: null, official: !!x.official };
  });
  fake.col = sh.col; fake.row = sh.row;
  fake.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
  var cap = G.storeCapOf(fake);
  var ext = G.extStoreCapOf(fake);
  var lvSum = 0; (fake.extGrid || []).forEach(function (e) { lvSum += (e.lv || 0); });
  out[ty] = cap;
  console.log(ty + ': 仓容 ' + cap + '（露天 ' + ext + ' · Σlv=' + lvSum
    + ' → 露天占 ' + (ext / cap * 100).toFixed(1) + '%）· 旧值 '
    + DATA.NPC_CITY_RES.resByTier[ty] + ' · 变化 ×' + (cap / DATA.NPC_CITY_RES.resByTier[ty]).toFixed(2));
});
console.log('\n新 resByTier = ' + JSON.stringify(out).replace(/"/g, ''));
process.exit(0);
