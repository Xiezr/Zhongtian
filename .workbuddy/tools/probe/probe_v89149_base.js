'use strict';
/* v89.149 探针 A：七条需求的现状取证（Node 侧）
   ① 声望：军力尺（troopPower）量级 + 一场典型战斗的"歼灭军力"→ 声望候选值
   ② 动作设置：每回合可重设？继承？—— 查 rec.cmd / history / setCmd / 界面快照来源
   ③ 兵种一字简称：清单与重名风险
   ④ 默认动作/目标：unitsOf 的两侧默认值现状
   ⑦ 间距读数：读数来源与文案（btTopHTML / sdHTML）
   跑法：node .workbuddy/tools/probe/probe_v89149_base.js */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic',
  'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

G.newGame({ name: '探149', cityName: '许都', region: '碎垣', mapSeed: 20260949 });
var st = G.state;
if (!st.map.grid) G.map.generate();
var city = st.cities[0];
G.ui._cityId = city.id;

console.log('====== ① 军力尺与声望量级 ======');
console.log('POWER.troopWeight = ' + JSON.stringify(DATA.POWER.troopWeight));
var ids = Object.keys(DATA.TROOPS);
console.log('兵种数 = ' + ids.length);
ids.forEach(function (id) {
  console.log('  ' + (id + '            ').slice(0, 14) + (DATA.TROOPS[id].name + '      ').slice(0, 7)
    + ' power=' + String(Math.round(G.story.troopPower(id))).padStart(6));
});

/* 造一场典型战斗：Lv8 野地（守军来自 wildDefenseAt，确定性） */
var wl = null;
for (var rr = 3; rr <= 14 && !wl; rr++) {
  for (var dy = -rr; dy <= rr && !wl; dy++) {
    for (var dx = -rr; dx <= rr && !wl; dx++) {
      var x = city.x + dx, y = city.y + dy, tl = G.map.tile(x, y);
      if (!tl || G.map.wildAt(x, y) || (G.map.npcAt && G.map.npcAt(x, y))) continue;
      var lv = G.map.wildLevelNow(x, y);
      if (!(lv >= 5)) continue;
      var wd = G.wildDefenseAt(x, y, lv);
      if (wd && wd.gen) wl = { x: x, y: y, lv: lv, wd: wd };
    }
  }
}
if (wl) {
  var gen = st.generals[0];
  var atk = { changqiang: 6000, gongjian: 1500 };
  console.log('\n靶 = (' + wl.x + ',' + wl.y + ') Lv' + wl.lv + ' 守将=' + wl.wd.gen.name
    + ' 守军=' + JSON.stringify(wl.wd.army));
  var res = G.tactic.simulate(atk, gen, wl.wd.army, 0, wl.wd.gen, {});
  console.log('  结果 winner=' + res.winner + ' rounds=' + res.rounds
    + ' atkLoss=' + res.atkLoss + ' defLoss=' + res.defLoss);
  console.log('  atkStartBy=' + JSON.stringify(res.atkStartBy));
  console.log('  defStartBy=' + JSON.stringify(res.defStartBy));
  console.log('  defLossBy=' + JSON.stringify(res.defLossBy));
  var tp = function (m) { var s = 0; for (var k in (m || {})) s += G.story.troopPower(k) * (m[k] || 0); return Math.round(s); };
  var myP = tp(res.atkStartBy), foeP = tp(res.defStartBy), killP = tp(res.defLossBy);
  console.log('  我方开局军力=' + myP + ' 敌方开局军力=' + foeP + ' 歼灭军力=' + killP
    + ' ratio(敌/我)=' + (myP > 0 ? (foeP / myP).toFixed(2) : '—'));
  console.log('[候选公式] 声望 = 歼灭军力 / perPower × coef(ratio)：');
  [50000, 120000, 300000, 600000, 1200000].forEach(function (per) {
    var raw = killP / per;
    var coef = Math.max(0.4, Math.min(2, Math.sqrt(foeP / Math.max(1, myP))));
    console.log('  perPower=' + per + ' → base=' + raw.toFixed(2)
      + ' · ×coef(' + coef.toFixed(2) + ') = ' + Math.round(raw * coef));
  });
  console.log('  对照：占城声望 = npcCity.rep（县郡州都各档）；释放俘虏 = n/50；门派任务 480/日');
  console.log('  爵位/年号门槛：声望至 20000（嘉平年号目标）');

  /* ---- ② 挂起战斗：默认指令与"每回合可重设" ---- */
  console.log('\n====== ② 观战挂起：默认指令 / cmd / history ======');
  city.army = { changqiang: 30000, gongjian: 8000 };
  var xc = city.cells.filter(function (c2) { return c2.build && c2.build.id === 'xiaochang'; })[0];
  if (xc) xc.build.lvl = 8;
  gen.stamina = 999; gen.energy = 999;
  var bkWatch = st.settings.battleWatch;
  st.settings.battleWatch = true;
  var r2 = G.battle.expedition({ kind: 'wild', x: wl.x, y: wl.y }, 'occupy', { changqiang: 20000 }, gen.id, {});
  st.settings.battleWatch = bkWatch;
  var rec = null; (st.battles || []).forEach(function (b) { rec = b; });
  if (!rec) { console.log('挂起失败：' + JSON.stringify(r2)); }
  else {
    var ses = G._bsess[rec.id];
    var s0 = ses.snap();
    console.log('rec.cmd（玩家已下指令）=' + JSON.stringify(rec.cmd));
    console.log('初始 atk 侧：' + JSON.stringify(s0.atk.map(function (u) {
      return u.id + ':' + u.stance + '/' + (u.target || '(空)');
    })));
    console.log('初始 def 侧：' + JSON.stringify(s0.def.map(function (u) {
      return u.id + ':' + u.stance + '/' + (u.target || '(空)');
    })));
    /* 改一条指令 → 步进 → 看是否继承 */
    G.ui.btSetCmd(rec, 'changqiang', { s: 'hold', t: 'gongjian' });
    console.log('改 changqiang → hold/gongjian 后 rec.cmd=' + JSON.stringify(rec.cmd));
    var s1 = ses.snap();
    console.log('  会话内 changqiang 现状=' + JSON.stringify(s1.atk.filter(function (u) { return u.id === 'changqiang'; })
      .map(function (u) { return u.stance + '/' + u.target; })));
    G.battle.stepBattle(rec.id);
    console.log('步进 1 回合后：round=' + rec.round + ' gapLast=' + rec.gapLast
      + ' history=' + JSON.stringify(rec.history));
    var s2 = ses.snap();
    console.log('  会话内（步进后）=' + JSON.stringify(s2.atk.map(function (u) {
      return u.id + ':' + u.stance + '/' + (u.target || '(空)');
    })));
    console.log('  未动的 gongjian 是否继承原样 = '
      + JSON.stringify(s2.atk.filter(function (u) { return u.id === 'gongjian'; })
        .map(function (u) { return u.stance + '/' + (u.target || '(空)'); })));
    /* 界面渲染来源：rec.snapLast（上一回合末）vs ses.snap()（含待生效指令） */
    console.log('  rec.snapLast.atk.changqiang.stance = '
      + ((rec.snapLast || { atk: [] }).atk.filter(function (u) { return u.id === 'changqiang'; })[0] || {}).stance
      + '（⚠️ 界面 btSetCmd 重绘读的是它 —— 若与上面不一致就是"改完跳回去"的病根）');
  }

  /* ---- ③ 一字简称 ---- */
  console.log('\n====== ③ 一字简称（按现有 name 首字，查重） ======');
  var seen = {};
  ids.forEach(function (id) {
    var n = DATA.TROOPS[id].name, ch = n.charAt(0);
    console.log('  ' + (n + '        ').slice(0, 6) + ' 首字「' + ch + '」'
      + (seen[ch] ? '  ⚠️ 与 ' + seen[ch] + ' 重' : ''));
    seen[ch] = n;
  });

  /* ---- ④ 默认动作/目标（引擎） ---- */
  console.log('\n====== ④ unitsOf 两侧默认值 ======');
  var uA = G.tactic.unitsOf({ changqiang: 100, gongjian: 100 }, 'atk', gen, { foeArmy: { changqiang: 50 } });
  var uD = G.tactic.unitsOf({ changqiang: 50 }, 'def', null, { foeArmy: { changqiang: 100, gongjian: 100 } });
  console.log('我方（攻，ctx 无 override）: ' + JSON.stringify(uA.map(function (u) { return u.id + ':' + u.stance + '/' + (u.target || '(空)'); })));
  console.log('敌方（守，ctx.foeArmy 有值）: ' + JSON.stringify(uD.map(function (u) { return u.id + ':' + u.stance + '/' + (u.target || '(空)'); })));
  console.log('战术出口 tacticOf(atk, changqiang) = ' + JSON.stringify(G.tacticOf ? G.tacticOf('atk', 'changqiang', {}) : null));
  console.log('G.tacticsOf(atk) = ' + JSON.stringify(G.tacticsOf ? G.tacticsOf('atk') : null));
  console.log('DATA.TARGET_WALL = ' + DATA.TARGET_WALL);
}

/* ---- ⑦ 间距读数 ---- */
console.log('\n====== ⑦ 间距读数文案 ======');
var snapT = { field: 1400, towers: null,
  atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 100, range: 50, stance: 'advance', target: '' }],
  def: [{ id: 'yibing', name: '义兵', count: 100, adv: 100, range: 20, stance: 'advance', target: '' }] };
var topT = G.ui.btTopHTML({ cnt: 60 }, snapT);
var iG = topT.indexOf('bt-gap');
console.log('btTopHTML 左组片段：' + JSON.stringify(topT.slice(0, 260)));
console.log('btGapOf(snap) = ' + G.ui.btGapOf({ gapLast: null }, snapT) + '（纵深 1400 − 100 − 100）');
console.log('sdHTML 里的间距片段？');
var sdT = null;
try { sdT = G.ui.sdHTML && null; } catch (e) { }
console.log('ui.sdHTML 存在 = ' + (typeof G.ui.sdHTML === 'function'));

/* 沙盘帧摘要里的间距（tactic.js） */
var src = fs.readFileSync(R + 'js/tactic.js', 'utf8');
var i1158 = src.indexOf("'两军推进（间距 '");
console.log('tactic.js 帧摘要片段：' + JSON.stringify(src.slice(i1158 - 200, i1158 + 80)));
var i1230 = src.indexOf("'<span class=\\\"bt-g\\\">间距 '");
console.log('tactic.js bt-g 片段：' + JSON.stringify(src.slice(i1230 - 120, i1230 + 70)));

process.exit(0);
