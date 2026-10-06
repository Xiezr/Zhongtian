/* v89.214 探测：世界观"名词层"资产清单 —— 换皮前的全量清点（只读 v2） */
var path = require('path'), fs = require('fs');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;
function j(x) { return JSON.stringify(x); }
var out = [];
function sec(t) { out.push('\n===== ' + t + ' ====='); }
function dumpMap(key, keys) {
  var t = DATA[key];
  if (!t) { out.push('(' + key + ' 不存在)'); return; }
  out.push(key + ' keys=' + j(Object.keys(t).slice(0, 60)));
  if (keys) {
    out.push(j(Object.keys(t).map(function (k) {
      var e = t[k] || {};
      var row = [k];
      keys.forEach(function (f) { row.push(e[f] !== undefined ? e[f] : ''); });
      return row;
    })));
  }
}
sec('顶层键');
out.push(j(Object.keys(DATA).sort()));
sec('兵种');
dumpMap('TROOPS', ['name', 'cls', 'atk', 'hp', 'desc']);
sec('建筑');
dumpMap('BUILDINGS', ['name', 'desc', 'cost']);
sec('科技');
dumpMap('TECHS', ['name', 'desc']);
sec('内功');
dumpMap('NEIGONG', ['name', 'trait', 'desc']);
sec('套装');
dumpMap('SETS', ['name', 'bonus']);
sec('爵位');
out.push('RANK type=' + typeof DATA.RANK + ' len=' + ((DATA.RANK || []).length || Object.keys(DATA.RANK || {}).length));
out.push(j((DATA.RANK || []).slice ? DATA.RANK.slice(0, 24) : DATA.RANK));
sec('资质/门派/州');
['GEN_RANKS', 'SECTS', 'STATES', 'JUNS', 'REGIONS', 'STATE_NAMES'].forEach(function (k) { dumpMap(k, ['name', 'desc']); });
sec('收藏');
['COLL_SERIES', 'COLL_ITEMS', 'COLLECT'].forEach(function (k) { dumpMap(k, ['name']); });
sec('资源/地块/物品组');
['RES_NAMES', 'RES', 'EXT_BUILDINGS', 'WILD_TYPES', 'ITEM_TYPES'].forEach(function (k) { dumpMap(k, ['name', 'res']); });
sec('story 导出');
out.push(j(Object.keys(G.STORY || {})));
sec('城池名样本');
try { G.map.generate(); var names = (G.state.map.cities || []).map(function (c) { return c.name; }); out.push('n=' + names.length + ' ' + j(names.slice(0, 60))); } catch (e) { out.push('ERR ' + e.message); }
sec('ITEMS 总数/类型分布');
try {
  var by = {}; Object.keys(DATA.ITEMS || {}).forEach(function (k) { var t = (DATA.ITEMS[k] || {}).type; by[t] = (by[t] || 0) + 1; });
  out.push(j(by));
} catch (e2) { out.push('ERR ' + e2.message); }
fs.writeFileSync(R + '.workbuddy/tmp/v89214_tables.txt', out.join('\n'));
console.log('DONE chars=' + out.join('').length);
process.exit(0);
