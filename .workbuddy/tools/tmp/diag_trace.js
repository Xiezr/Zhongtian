var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA;
function sum(a){var s=0;for(var k in a)s+=a[k];return s;}
var ARMY = {
  minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
  gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
  xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30,
};
G.newGame({ name: 'x', region: '司隶' });

function run(smart, disableFb, trace) {
  var env = G.tactic.begin(JSON.parse(JSON.stringify(ARMY)), null, JSON.parse(JSON.stringify(ARMY)), 0, null, { stances: {} });
  var rec = { side: 'atk', cmd: {} };
  var guard = 0;
  while (!env.over && guard++ < 36) {
    if (smart) {
      if (disableFb) {
        /* 复刻 smartApply 但不做回退（对照实验） */
        var plan = G.battle.smartPlanOf();
        var mine = env.units.atk, theirs = env.units.def;
        var D = env.field || 1, front = 0;
        theirs.forEach(function (x) { if (x.count > 0 && x.adv > front) front = x.adv; });
        rec.cmd = rec.cmd || {};
        mine.forEach(function (u) {
          if (!(u.count > 0)) return;
          var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
          var wantS = G.battle.smartStanceOf(u, D - u.adv - front, plan);
          var wantT = plan.targets[u.id];
          var patch = {};
          if (wantS && c.s !== wantS) { c.s = wantS; patch.s = wantS; }
          if (wantT != null && c.t !== wantT) { c.t = wantT; patch.t = wantT; }
          if (patch.s || patch.t !== undefined) env.setCmd('atk', u.id, patch);
        });
      } else {
        G.battle.smartApply(rec, env);
      }
    }
    var st = env.step();
    if (trace && (guard <= 3 || guard % 6 === 0)) {
      var aFront = 0, dFront = 0;
      env.units.atk.forEach(function (u) { if (u.count > 0 && u.adv > aFront) aFront = u.adv; });
      env.units.def.forEach(function (u) { if (u.count > 0 && u.adv > dFront) dFront = u.adv; });
      var bow = env.units.atk.filter(function (u) { return u.id === 'gongjian'; })[0] || {};
      console.log('  r' + guard + ' aFront=' + aFront + ' dFront=' + dFront + ' 间距=' + (env.field - aFront - dFront)
        + ' | 我弓: ' + bow.stance + '→' + (bow.target || '-') + ' @' + bow.adv
        + ' | 敌损累计=' + sum(env.units.def.reduce(function (o, u) { o[u.id] = ARMY[u.id] - (u.count || 0); return o; }, {})));
    }
    if (!st) break;
  }
  var fin = env.finish();
  return { aL: sum(fin.atkLossBy), dL: sum(fin.defLossBy), r: fin.rounds };
}
console.log('A. 带回退（现状）：', JSON.stringify(run(true, false)));
console.log('B. 无回退（对照）：', JSON.stringify(run(true, true)));
console.log('C. 轨迹（带回退）:');
run(true, false, true);
console.log('D. 轨迹（无回退）:');
run(true, true, true);
process.exit(0);
