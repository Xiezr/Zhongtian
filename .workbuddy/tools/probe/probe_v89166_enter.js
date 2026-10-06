/* v89.166 探针：「进入城池」→ 菜单全关 + 直接显示城内大界面。
   ① 源码级：两 case 的关闭调用与顺序（改前取证：city-enter 关闭调用 0 次）
   ② 动作序列真调：openCityPanel → closeAllModals → setCity → setView 的产出
   运行：node .workbuddy/tools/probe/probe_v89166_enter.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;

var pass = 0, fail = 0;
function P(n, ok, ex) {
  if (ok) { pass++; console.log('  ✅ ' + n + (ex ? '  [' + ex + ']' : '')); }
  else { fail++; console.log('  ❌ ' + n + (ex ? '  [' + ex + ']' : '')); }
}

console.log('=== ① 源码级：两入口的关闭调用与顺序 ===');
var mjs = fs.readFileSync(R + 'js/main.js', 'utf8');
var segA = mjs.slice(mjs.indexOf("case 'city-enter'"), mjs.indexOf("case 'city-transport'"));
var segB = mjs.slice(mjs.indexOf("case 'lord-city-enter'"), mjs.indexOf("case 'lord-promote'"));
P('city-enter 段含 closeAllModals', /ui\.closeAllModals\(\);/.test(segA));
P('★ closeAllModals 在 setCity 之前（先关菜单、再切城）',
  segA.indexOf('ui.closeAllModals();') >= 0 && segA.indexOf('ui.closeAllModals();') < segA.indexOf('ui.setCity('));
P('lord-city-enter 段含 closeAllModals（两入口统一出口）', /ui\.closeAllModals\(\);/.test(segB));
P('负向：两段无裸 closeModal（单层出口退役）',
  segA.indexOf('ui.closeModal();') < 0 && segB.indexOf('ui.closeModal();') < 0);

console.log('\n=== ② 动作序列真调（与 case 内序列一致）===');
G.newGame({ name: 's166', region: '烬环' });
var st = G.state, c0 = G.currentCity();
G.ui._cityId = c0.id;
if (!st.map.grid) G.map.generate();

G.ui.openCityPanel(c0);
P('openCityPanel 后弹窗在（_maskEl 非空）', G.ui._maskEl !== null, '_maskEl=' + (G.ui._maskEl ? 'el' : 'null'));

G.ui.closeAllModals();
P('★ closeAllModals 后：_maskEl=null · _liveReopen=null · 栈空',
  G.ui._maskEl === null && G.ui._liveReopen === null && (G.ui._modalStack || []).length === 0,
  'mask=' + (G.ui._maskEl ? 'el' : 'null') + ' stack=' + (G.ui._modalStack || []).length);

/* 造第二城（验证"切过去"） */
['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c0)[k] = 200000; });
G.res(c0).gold = 200000;
var c1 = null;
(function () {
  for (var y = 1; y < (DATA.MAP_H || 40) - 1 && !c1; y++) {
    for (var x = 1; x < (DATA.MAP_W || 40) - 1 && !c1; x++) {
      var t = G.map.tile(x, y);
      if (!t || t.terrain !== 'plain') continue;
      var dup = false;
      (st.wilds || []).forEach(function (w) { if (w.x === x && w.y === y) dup = true; });
      if (dup) continue;
      st.wilds.push({ x: x, y: y, type: 'plain', lv: 3 });
      try { G.buildCityAt(x, y); } catch (e) { }
      if (st.cities.length >= 2) c1 = st.cities[1];
    }
  }
})();
P('造局：第二城已建', !!c1, c1 ? c1.name : '未建成');

if (c1) {
  G.ui.setCity(c1.id);
  G.ui.setView('city');
  P('★ setCity + setView 后：view=city · 当前城=目标城',
    G.ui.view === 'city' && G.currentCity().id === c1.id,
    'view=' + G.ui.view + ' city=' + G.currentCity().name);
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
