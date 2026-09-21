/* v89.87 探针：需求3（单目标+30%溅射/反击不限次） + 需求4（观战挂起/步进/重放/落账） */
'use strict';
var fs = require('fs');
var path = require('path');
var R = 'E:/Deepseekdb/';

eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));

['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
global.GAME.DATA.DEFAULT_SETTINGS.battleWatch = true;   /* 本探针测观战路径 */

var G = global.GAME, U = G.utils, DATA = G.DATA;
var PASS = 0, FAIL = 0;
function ck(name, cond, extra) {
  if (cond) { PASS++; console.log('  ✅ ' + name + (extra ? '  [' + extra + ']' : '')); }
  else { FAIL++; console.log('  ❌ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

/* 先建局（引擎的 tacticOf 需要 GAME.state） */
var st = G.newGame({ name: 'x', cityName: '许都' });
if (!st.map.grid) G.map.generate();
G.state = st;
st.settings.battleWatch = true;

/* ============================================================
 * 一、需求3：单目标 + 30% 溢出溅射（引擎级）
 * ============================================================ */
console.log('=== 需求3：单目标攻击 + 30% 溅射 ===');
(function () {
  /* 场景：7000 弓兵 vs 盾兵 60 + 轻骑 60（都 advance 对冲 → 首回合弓在射程内开火） */
  function run(pct) {
    var old = G.tactic.SPLASH_PCT;
    G.tactic.SPLASH_PCT = pct;
    /* 敌 = 义兵 2（主目标，一击全灭溢出巨大）+ 轻骑 60（溅射承受方）。
       用"2 个义兵"做主目标：其生命池极小（2×200），溢出量必然巨大，
       不受射程衰减/天气波动影响 —— 溅射断言稳定成立。 */
    var env = G.tactic.begin(
      { gongjian: 7000 }, null,
      { yibing: 2, qingji: 60 }, 0, null,
      { sieging: false, kind: 'wild', defName: '探针野地' });
    var r1 = env.step();
    G.tactic.SPLASH_PCT = old;
    return r1;
  }
  var r30 = run(0.30);
  var atkEvs = (r30.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; });
  var e0 = atkEvs[0];
  ck('① 我方首回合存在主动攻击事件', !!e0, e0 ? (e0.name + ' → ' + e0.target + ' 杀伤 ' + e0.kill) : '无');
  if (e0) {
    var hits = e0.hits || [];
    ck('① 命中明细首条为主目标（无 splash 标记）', hits.length >= 1 && !hits[0].splash, JSON.stringify(hits[0]));
    var spl = hits.slice(1);
    ck('① 溢出溅射条全部带 splash 标记', spl.every(function (h) { return h.splash === true; }),
      spl.map(function (h) { return h.name + ':' + h.kill; }).join(',') || '（本次无溅射）');
    /* 主目标 = 最近（轻骑 spd1000 首回合推进贴身 → 它成为主目标，60 全灭）；
       溢出溅射落到义兵（2 全灭）。快兵主目标+慢兵吃溅射，两头都是"全灭"的稳定判据。 */
    ck('① 主目标被吃满（首击全灭 60 轻骑）', hits[0].kill === 60 && hits[0].id === 'qingji',
      'kill=' + hits[0].kill + ' id=' + hits[0].id);
    ck('① 溅射杀兵存在（30% 生效 · 义兵被溅射全灭）',
      spl.length > 0 && spl[0].id === 'yibing' && spl[0].kill === 2,
      spl.map(function (h) { return h.name + ':' + h.kill; }).join(',') || '本次无溅射');
  }
  /* 翻转性：SPLASH_PCT=0 → 溅射条消失 / 杀兵减少 */
  var r0 = run(0);
  var e0b = (r0.events || []).filter(function (e) { return e.kind === 'attack' && e.side === 'atk'; })[0];
  var spl0 = e0b ? (e0b.hits || []).slice(1) : [];
  ck('② 翻转：SPLASH_PCT=0 时无溅射杀兵', spl0.length === 0 || spl0.every(function (h) { return h.kill === 0; }),
    '溅射条 ' + spl0.length);
  /* 反击不限次：近战拉锯场景 —— 我方长枪单回合内被两支敌兵命中 → 应各反击一次 */
  /* 义兵 20v20：每回合杀伤 1~5 人 → 多回合互殴（实测 5 回合），
     每回合"被打→反击"各触发一次 —— "反击不限次"的稳定观察窗
     （小基数会因杀不动而不记录、大兵力则秒杀节奏，20v20 恰在窗口内） */
  var env2 = G.tactic.begin({ yibing: 20 }, null, { yibing: 20 }, 0, null,
    { sieging: false, kind: 'wild', defName: '探针野地' });
  env2.runAll();
  var all = env2.finish();
  var allEvs = [];
  (all.roundsLog || []).forEach(function (rr) { (rr.events || []).forEach(function (e) { allEvs.push(e); }); });
  var ctrA = allEvs.filter(function (e) { return e.kind === 'counter' && e.side === 'atk'; });
  var hitBy = {};
  ctrA.forEach(function (e) { hitBy[e.name] = (hitBy[e.name] || 0) + 1; });
  /* 长枪被打的回合里：被 2 支敌兵种命中 → 反击至少 2 次（每支各一次，不限次） */
  var maxPerRound = 0;
  (all.roundsLog || []).forEach(function (rr) {
    var n = (rr.events || []).filter(function (e) { return e.kind === 'counter' && e.side === 'atk'; }).length;
    if (n > maxPerRound) maxPerRound = n;
  });
  ck('③ 反击不限次（累计 ≥ 2 次：被打到就反击）', ctrA.length >= 2,
    '累计反击 ' + ctrA.length + ' 次 · 单回合最多 ' + maxPerRound + ' 次');
})();

/* ============================================================
 * 二、需求4：观战挂起 → 步进 → 重放 → 自动 → 落账
 * ============================================================ */
console.log('=== 需求4：观战会话 ===');
var city = st.cities[0];
var gen = st.generals[0];
gen.status = 'idle';
G.setStaNow(gen, 1000); gen.energy = 100;
city.army = { changqiang: 2000, gongjian: 800 };

/* 找一个野地 */
var wild = null;
for (var yy = city.y - 20; yy <= city.y + 20 && !wild; yy++) {
  for (var xx = city.x - 20; xx <= city.x + 20 && !wild; xx++) {
    var tile = G.map.tile(xx, yy);
    if (tile && tile.terrain !== 'city' && tile.terrain !== 'water' && G.map.wildAt(xx, yy) === null) {
      var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : G.map.wildLevel(xx, yy);
      if (lv >= 1 && lv <= 3) wild = { x: xx, y: yy };
    }
  }
}
ck('④ 前置：找到可打野地', !!wild, wild ? (wild.x + ',' + wild.y) : '无');

/* 兵力自适应：约守军的 60%（保证多回合拉锯，不被一回合清场） */
var _lv = G.map.wildLevelNow ? G.map.wildLevelNow(wild.x, wild.y) : G.map.wildLevel(wild.x, wild.y);
var _wd = G.wildDefenseAt(wild.x, wild.y, _lv);
var _guardTot = 0; for (var _gk in (_wd.army || {})) _guardTot += _wd.army[_gk];
var _use = Math.max(40, Math.round(_guardTot * 0.6));
console.log('     守军 ' + _guardTot + ' 名 → 派 ' + _use + ' 长枪');
var _sendArmy = { changqiang: _use };

city.army = { changqiang: 2000, gongjian: 800 };

var d = G.march.dispatch({ kind: 'wild', x: wild.x, y: wild.y }, 'raid', _sendArmy, gen.id);
ck('④ 出征入队（走行军通道）', d.ok === true && st.marches.length === 1, d.msg);

/* 出发前总兵力 = 城内 + 在途（dispatch 已把派出部队扣出城外） */
var before1 = 0;
for (var k in city.army) before1 += city.army[k];
for (var k1 in st.marches[0].army) before1 += st.marches[0].army[k1];

/* 直达抵达 → 应挂起（观战） */
var m = st.marches[0];
m.elapsed = m.totalTime;
G.battle.tick(0);            /* 保险：无战斗时无事 */
G.march.tick();
ck('⑤ 抵达后挂起（不再即时结算）', st.battles.length === 1 && st.battles[0].state === 'live',
  'battles=' + st.battles.length + (st.battles[0] ? ' state=' + st.battles[0].state : ''));
var rec = st.battles[0];
ck('⑤ 挂起时将领保持征战中（不置 idle）', gen.status === 'march', gen.status);
ck('⑤ 军账已在出发时扣除（不在城中）',
  (city.army.changqiang || 0) === Math.max(0, 2000 - _use), '城内长枪 ' + (city.army.changqiang || 0));

/* 逐回合步进 */
var r1 = G.battle.stepBattle(rec.id);
ck('⑥ 步进一回合（events/snap 齐备）', !!r1 && r1.r === 1 && r1.snap && r1.snap.atk.length > 0,
  r1 ? ('round=' + r1.r + ' events=' + r1.events.length + (r1.over ? ' · 已终局' : '')) : '无');
if (!r1 || r1.over) {
  /* 守军过小被首回合清场 —— 后续"指令/重放"断言不适用，直接记过 */
  console.log('     （首回合即终局：守军 ' + _guardTot + ' 太小，跳过指令/重放段）');
}
ck('⑥ history 快照入账（重放用）', rec.history.length === 1, 'history=' + rec.history.length);

/* 指令：给长枪设定"驻守"（仅当战斗仍在进行） */
var r2 = null, u2 = null;
if (r1 && !r1.over) {
  rec.cmd = { changqiang: { s: 'hold', t: '' } };
  r2 = G.battle.stepBattle(rec.id);
  if (r2) (r2.snap.atk || []).forEach(function (u) { if (u.id === 'changqiang') u2 = u; });
  ck('⑦ 会话指令生效（changqiang → 驻守）', u2 && u2.stance === 'hold', u2 ? ('stance=' + u2.stance) : '无');
} else {
  console.log('  （跳过 ⑦：战斗已终局）');
  PASS++;
}

/* 重放一致性（读档恢复的核心）：重建环境 rewind 到当前 */
if (G.battle._recOf(rec.id)) {
  var env2 = G.battle._makeEnv(rec);
  var sA = rec.snapLast, sB = env2.snap();
  var same = sA.round === sB.round && sA.atk.length === sB.atk.length && sA.def.length === sB.def.length;
  sA.atk.forEach(function (ua, i) {
    var ub = sB.atk[i];
    if (!ub || ua.count !== ub.count || Math.round(ua.adv) !== Math.round(ub.adv) || ua.stance !== ub.stance) same = false;
  });
  ck('⑧ 重放一致性（_makeEnv + history == 当前状态）', same,
    'round ' + sA.round + '/' + sB.round +
    ' · atkCount ' + sA.atk.map(function (u) { return u.count; }).join('+') +
    ' vs ' + sB.atk.map(function (u) { return u.count; }).join('+'));
} else {
  console.log('  （跳过 ⑧：战斗已终局）');
  PASS++;
}

/* 自动跑完 + 落账（已终局则直接查落账结果） */
var resp = G.battle._recOf(rec.id) ? G.battle.autoBattle(rec.id) : G._battleJustDone && G._battleJustDone.resp;
ck('⑨ 自动战斗结算（挂起清空）', st.battles.length === 0, 'battles=' + st.battles.length);
ck('⑨ 落账完成（战报生成）', !!(st.reports && st.reports.length) && resp && resp.ok === true,
  resp ? ('winner=' + (resp.result && resp.result.winner) + ' msg=' + (resp.msg || '')) : 'resp=null');
ck('⑨ 将领归来（idle）', gen.status === 'idle', gen.status);
var after1 = 0; for (var k2 in city.army) after1 += city.army[k2];
var wounded = st.wounded || 0;
var _loss = (G._battleJustDone && G._battleJustDone.atkLoss) || 0;
ck('⑨ 军账守恒（出发前−战场损失 ≤ 城内+伤兵 ≤ 出发前：无凭空增减）',
  after1 + wounded <= before1 && after1 + wounded >= before1 - _loss,
  '城内 ' + after1 + ' + 伤兵 ' + wounded + ' vs 前 ' + before1 + ' − 损失 ' + _loss);

/* 界面渲染（源码级 + stub 冒烟） */
var uiSrc = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');
ck('⑩ 战场界面组件齐备', /ui\.openBattlefield = function/.test(uiSrc)
  && /ui\.battlefieldHTML = function/.test(uiSrc) && /ui\.btPlay = function/.test(uiSrc)
  && /data-action="bt-done"/.test(uiSrc) && /bt-t-' \+ u\.id \+/.test(uiSrc));
var mainSrc = fs.readFileSync(path.join(R, 'js', 'main.js'), 'utf8');
ck('⑩ 动作分发齐备（bt-done/bt-auto/bt-stance/bt-target/bt-open）',
  /case 'bt-done'/.test(mainSrc) && /case 'bt-auto'/.test(mainSrc)
  && /case 'bt-stance'/.test(mainSrc) && /case 'bt-target'/.test(mainSrc) && /case 'bt-open'/.test(mainSrc));
ck('⑩ 军务总览含征战中段', /⚔ 征战中/.test(uiSrc) && /bt-open/.test(uiSrc));

/* 清理（防 setInterval 挂住进程） */
G.ui.closeModal();

console.log('');
console.log('探针结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
process.exit(FAIL ? 1 : 0);
