/* v89.195 探针B：前哨放手（老板 1）行为验证
   ① 真调 claimFort 记录 terrain0
   ② 真调 abandonFort：记录删除 / 地形恢复 / fortsTaken 保留 / 名额释放 / 护持终止
   ③ 边界：无前哨处调用被拒；重复放手被拒
   ④ 上限闭环：5 处满 → 第 6 处被拒（full）→ 放手一处 → 第 6 处可设（名额释放实证）
   ⑤ fortAuraAt 覆盖消失（护持随记录走） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '探针B', region: '烬环' });
if (!G.state.map.grid) G.map.generate();
var s = G.state, c0 = s.cities[0];

/* 找一批可用的空地格（远离城池、地图内） */
function pickCells(n) {
  var out = [], seen = {};
  for (var y = 5; y < 200 && out.length < n; y++) {
    for (var x = 5; x < 200 && out.length < n; x++) {
      if (seen[x + ',' + y]) continue;
      var t = G.map.tile(x, y);
      if (!t || t.terrain === 'city' || t.terrain === 'water' || t.terrain === 'lake') continue;
      if (Math.abs(x - c0.x) < 4 && Math.abs(y - c0.y) < 4) continue;
      var key = x + ',' + y;
      if (s.forts && s.forts[key]) continue;
      seen[key] = 1; out.push({ x: x, y: y });
    }
  }
  return out;
}
function mkTarget(c, lv, name) {
  return { kind: 'fort', fort: { x: c.x, y: c.y, level: lv, name: name || ('测哨' + c.x), kind: 'fort' } };
}

console.log('══════ ① claimFort 记录 terrain0 ══════');
var cells = pickCells(6);
var r1 = G.claimFort(mkTarget(cells[0], 8, '甲哨'), null, c0, {});
var t0 = G.map.tile(cells[0].x, cells[0].y);
var rec0 = G.fortsOf()[cells[0].x + ',' + cells[0].y];
console.log('  claim ok=' + r1.ok + '　rec.terrain0=' + JSON.stringify(rec0 && rec0.terrain0)
  + '　tile.terrain=' + (t0 && t0.terrain) + '（应 city）');

console.log('\n══════ ② 真调 abandonFort ══════');
var f0 = G.fortOwnAt(cells[0].x, cells[0].y);
var eBefore = G.fortEffectOf(f0);
/* 铺一块覆盖内野地，验证护持终止 */
s.wilds.push({ x: cells[0].x + 2, y: cells[0].y, type: 'plain', level: 5, levelDay: G.questDayIndex() });
var aura1 = G.fortAuraAt(cells[0].x + 2, cells[0].y);
console.log('  放手前：覆盖命中=' + !!aura1 + '（半径 ' + eBefore.radius + '）　名额 ' + G.fortsOfCity(c0).length);
var ra = G.abandonFort(cells[0].x, cells[0].y);
console.log('  放手返回：ok=' + ra.ok + '　msg=' + ra.msg);
console.log('  · s.forts 无该键（fortOwnAt null）：' + (G.fortOwnAt(cells[0].x, cells[0].y) === null));
console.log('  · 地形恢复：' + (G.map.tile(cells[0].x, cells[0].y).terrain)
  + '（期望 = terrain0 ' + JSON.stringify(rec0.terrain0) + '）');
console.log('  · fortsTaken 保留（不再生据点）：' + !!((s.fortsTaken || {})[cells[0].x + ',' + cells[0].y])
  + '　fortAt 仍 null：' + (G.map.fortAt(cells[0].x, cells[0].y) === null));
console.log('  · 覆盖终止（野地不再被护持）：' + (G.fortAuraAt(cells[0].x + 2, cells[0].y) === null));
console.log('  · 名额释放：' + G.fortsOfCity(c0).length + '（期望 0）');

console.log('\n══════ ③ 边界 ══════');
var rb = G.abandonFort(cells[0].x, cells[0].y);
console.log('  重复放手被拒：' + (!rb.ok) + '　msg=' + rb.msg);
var rc = G.abandonFort(999, 999);
console.log('  无前哨处被拒：' + (!rc.ok) + '　msg=' + rc.msg);

console.log('\n══════ ④ 上限闭环：5 处满 → 第 6 拒 → 放 1 → 第 6 成 ══════');
/* 先清空本城前哨（探针内部重建，不受前段影响）——否则②已放手一处，测不到"满员被拒" */
Object.keys(G.fortsOf()).forEach(function (k) {
  var f = G.fortsOf()[k];
  if (f && f.cityId === c0.id) delete G.fortsOf()[k];
});
var up5 = pickCells(7);
for (var i = 0; i < 5; i++) {
  var r = G.claimFort(mkTarget(up5[i], 2 + i, '闭环' + i), null, c0, {});
  console.log('  设哨 ' + (i + 1) + '：ok=' + r.ok + '　本城 ' + G.fortsOfCity(c0).length + '/5');
}
var r6 = G.claimFort(mkTarget(up5[5], 9, '第六'), null, c0, {});
console.log('  第 6 处：ok=' + r6.ok + '　full=' + r6.full + '（期望 ok=false full=true）');
var rel = G.abandonFort(up5[0].x, up5[0].y);
console.log('  放手 1 处：ok=' + rel.ok + '　当前名额 ' + G.fortsOfCity(c0).length + '/5');
var r7 = G.claimFort(mkTarget(up5[5], 9, '第六'), null, c0, {});
console.log('  再设第 6 处：ok=' + r7.ok + '　msg=' + r7.msg + '　当前 ' + G.fortsOfCity(c0).length + '/5');

console.log('\n══════ ⑤ 老档（无 terrain0）兜底 ══════');
/* 模拟老档：手工造一个无 terrain0 的前哨 */
var oldKey = cells[3].x + ',' + cells[3].y;
G.fortsOf()[oldKey] = { x: cells[3].x, y: cells[3].y, lv: 5, name: '老哨', day: 0, cityId: c0.id };
G.map.tile(cells[3].x, cells[3].y).terrain = 'city';
var ro = G.abandonFort(cells[3].x, cells[3].y);
console.log('  放手老哨：ok=' + ro.ok + '　地形=' + G.map.tile(cells[3].x, cells[3].y).terrain + '（兜底 plain）');

console.log('\n完成。');
process.exit(0);
