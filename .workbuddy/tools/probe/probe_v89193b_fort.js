/* v89.193 探针B：前哨格实况 + 现行前哨机制全貌
   ① 前哨格（terrain='city'）点击走哪条分发、面板显示什么（是否有据点情报）
   ② TERRAIN 表含不含 'city'
   ③ 衰减机制（decayTo 语义）
   ④ 现行 forts 结构（无归属城）与 claimFort 入参 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, D = G.DATA, U = G.utils;

G.newGame({ name: '前哨探针', region: '司隶' });
if (!G.state.map.grid) G.map.generate();
var c0 = G.state.cities[0];

console.log('=== ① TERRAIN 表 ===');
console.log('keys:', Object.keys(D.TERRAIN).join(','));
console.log("TERRAIN['city'] =", JSON.stringify(D.TERRAIN.city || null));

console.log('\n=== ② 造一个前哨（走 claimFort 真实出口）===');
/* 找附近一处 fort */
var hit = null;
for (var r = 2; r <= 40 && !hit; r++) {
  for (var dy = -r; dy <= r && !hit; dy++) for (var dx = -r; dx <= r && !hit; dx++) {
    var f = G.map.fortAt(c0.x + dx, c0.y + dy);
    if (f) hit = f;
  }
}
console.log('附近据点:', hit ? (hit.name + ' Lv' + hit.level + ' @' + hit.x + ',' + hit.y) : '(无)');
if (hit) {
  var rr = G.claimFort({ kind: 'fort', fort: hit, x: hit.x, y: hit.y }, null, c0, {});
  console.log('claimFort:', JSON.stringify(rr).slice(0, 220));
  var key = hit.x + ',' + hit.y;
  console.log('s.forts[' + key + '] =', JSON.stringify(G.fortsOf()[key]));
  console.log('  → 记录字段含 cityId（归属城）吗:', 'cityId' in (G.fortsOf()[key] || {}) ? '有' : '❌ 没有（每城上限无从谈起）');
  var tl = G.map.tile(hit.x, hit.y);
  console.log('该格 terrain =', tl && tl.terrain);

  console.log('\n=== ③ 前哨格点击分发（map.pick 等价逻辑） ===');
  var pick = G.map.pick;   /* jsdom 桩下 rect 全 0 —— 直接走判定函数链 */
  var own = G.map.ownCityAt(hit.x, hit.y);
  var npc = G.map.npcAt(hit.x, hit.y);
  var w2 = G.map.wildAt(hit.x, hit.y);
  var f2 = G.map.fortAt(hit.x, hit.y);
  console.log('ownCityAt =', own ? own.name : null, '| npcAt =', npc ? npc.name : null,
    '| wildAt =', w2 ? '有' : null, '| fortAt =', f2 ? '有' : null);
  console.log('  → pick 会落到 kind =', own ? 'player' : (npc ? 'npc' : (w2 ? 'wild' : (f2 ? 'fort' : 'land'))));

  console.log('\n=== ④ 前哨格打开面板（openLandModal 渲染检查） ===');
  try {
    G.ui.openLandModal(hit.x, hit.y);
    var html = (G.ui._maskEl && G.ui._maskEl.innerHTML) || '';
    console.log('面板渲染: ok · 长度', html.length);
    console.log('  含「据点情报」:', html.indexOf('据点情报') >= 0);
    console.log('  含「侦查」按钮:', html.indexOf('侦查') >= 0);
    console.log('  含「占领」按钮:', html.indexOf('🚩 占领') >= 0);
    console.log('  含「掠夺」按钮:', html.indexOf('🔥 掠夺') >= 0);
    console.log('  含「守军约」:', html.indexOf('守军约') >= 0);
    console.log('  标题:', (html.match(/gold-heading">([^<]*)</) || [])[1]);
    G.ui.closeAllModals();
  } catch (e) { console.log('面板渲染 ❌ 异常:', e.message); }

  console.log('\n=== ⑤ fortAuraAt 对前哨格自身 ===');
  console.log('fortAuraAt(前哨格) =', JSON.stringify(G.fortAuraAt(hit.x, hit.y) || null).slice(0, 120));
  console.log('fortAuraAt(前哨+3格) =', JSON.stringify(G.fortAuraAt(hit.x + 3, hit.y) || null).slice(0, 120));
}

console.log('\n=== ⑥ 衰减机制 ===');
console.log('DATA.WILD_GARRISON =', JSON.stringify(D.WILD_GARRISON || {}).slice(0, 300));
console.log('DATA.FORT_AURA.decayTo =', (D.FORT_AURA || {}).decayTo);
/* 找 decayWilds 实现体 */
var src = fs.readFileSync(path.join(R, 'js/domain.js'), 'utf8');
var i0 = src.indexOf('GAME.decayWilds = function');
console.log('decayWilds 前 900 字:');
console.log(src.slice(i0, i0 + 900));

process.exit(0);
