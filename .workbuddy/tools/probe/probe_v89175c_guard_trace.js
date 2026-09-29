/* v89.175 探针 C：诊断 —— "守方仅远程 hold + 我方追击"的镜像局为何 30 回合清不完
   逐回合打印双方**剩余编成**（非零兵种）+ 关键单位行踪。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, T = G.tactic;
GAME.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });

var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
function org(list) {
  var s = '';
  list.forEach(function (u) { if (u.count > 0) s += u.id.slice(0, 4) + ':' + u.count + '@' + Math.round(u.adv) + ' '; });
  return s || '（全灭）';
}
var env = T.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
/* 守方仅远程 hold */
env.units.def.forEach(function (u) { if ((u.range || 0) >= 500) env.setCmd('def', u.id, { s: 'hold' }); });
var rec = { side: 'atk', cmd: {} };
var PLAN = G.battle.smartPlanOf();
var g = 0;
while (!env.over && g++ < 30) {
  /* 我方智能（追击版） */
  var mine = env.units.atk, foes = env.units.def, D = env.field, eF = 0;
  foes.forEach(function (x) { if (x.count > 0 && x.adv > eF) eF = x.adv; });
  mine.forEach(function (u) {
    if (!(u.count > 0)) return;
    var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
    var gap = D - u.adv - eF;
    var wantS;
    if ((u.range || 0) >= 500) {
      var anyIn = false;
      foes.forEach(function (e) { if (e.count > 0 && (D - u.adv - e.adv) <= u.range) anyIn = true; });
      wantS = anyIn ? 'hold' : 'advance';
    } else {
      var isCav = (u.spd || 0) >= 400;
      wantS = (gap <= (isCav ? 250 : 250)) ? 'hold' : 'advance';
    }
    var wantT = PLAN.targets[u.id] || null;
    var patch = {};
    if (c.s !== wantS) { c.s = wantS; patch.s = wantS; }
    if (wantT != null && c.t !== wantT) { c.t = wantT; patch.t = wantT; }
    if (patch.s || patch.t !== undefined) env.setCmd('atk', u.id, patch);
  });
  env.step();
  console.log('R' + String(g).padStart(2) + ' 我[' + org(env.units.atk).slice(0, 110) + ']');
  console.log('      敌[' + org(env.units.def).slice(0, 110) + ']');
  for (var k in env.units.atk) { }
}
console.log('');
console.log('结束：over=' + env.over + ' 回合=' + g);
process.exit(0);
