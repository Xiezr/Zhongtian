/* v89.192 探针B：smoke §94 载重场景的战斗翻转诊断（含回滚对照）
 * 用法：node probe_v89192b_load.js [before|after]
 *   after  = 当前引擎（射程回落修复后）
 *   before = 需要先把 backup 的 tactic.js 拷进来（脚本不做拷贝，由命令行控制）
 * 场景：300 义兵 掠夺 沼泽 Lv3 野地（原 smoke 摆局）→ 打印战斗全过程
 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;
var TAG = process.argv[2] || 'after';

G.newGame({ name: 'load192', region: '烬环', mapSeed: 20260931 });
G.state.world.weather = 'clear';
var st = G.state;
st.settings = st.settings || {}; st.settings.battleWatch = false;

/* 找城边低等级野地 —— 完全复刻 smoke §94 的扫描法（wildLevelNow 1~3 第一格） */
if (!st.map.grid) G.map.generate();
var c0 = st.cities[0], tgt = null, CMAX = GAME.COORD_MAX || 499;
for (var dx = -6; dx <= 6 && !tgt; dx++) {
  for (var dy = -6; dy <= 6 && !tgt; dy++) {
    if (!dx && !dy) continue;
    var xx = c0.x + dx, yy = c0.y + dy;
    if (xx < 0 || yy < 0 || xx > CMAX || yy > CMAX) continue;
    var tl = G.map.tile(xx, yy);
    if (!tl || tl.terrain === 'city') continue;
    var lv0 = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
    var ter0 = (tl || {}).terrain;
    /* 优先沼泽 Lv3（smoke 失败日志的靶），否则 Lv3 任意 */
    if (lv0 === 3 && ter0 === 'swamp') { tgt = { x: xx, y: yy, lv: lv0 }; break; }
    if (lv0 === 3 && !tgt) tgt = { x: xx, y: yy, lv: lv0 };
  }
}
if (!tgt) tgt = { x: c0.x + 2, y: c0.y, lv: 1 };
console.log('[' + TAG + '] 目标野地 = ' + tgt.x + ',' + tgt.y + ' Lv' + tgt.lv
  + ' terrain=' + ((G.map.tile(tgt.x, tgt.y) || {}).terrain));

/* 守军实况 */
var wd2 = G.wildDefenseAt(tgt.x, tgt.y, tgt.lv);
console.log('[' + TAG + '] 守军:', JSON.stringify(wd2.army), ' 守将=' + (wd2.gen ? (wd2.gen.name + ' Lv' + wd2.gen.level) : '无'));

/* 直打（ingredients 与 smoke 同）：dispatch raid */
var g0 = (st.generals || [])[0]; g0.cityId = c0.id; g0.status = 'idle';
var lastR = null;
var _exp0 = G.battle.expedition;
G.battle.expedition = function () { lastR = _exp0.apply(this, arguments); return lastR; };
c0.army = { yibing: 300 };
G.setStaNow(g0, 200); g0.energy = 200;
var d0 = G.march.dispatch({ kind: 'wild', x: tgt.x, y: tgt.y, name: '试野地', lv: tgt.lv,
  terrain: 'plain' }, 'raid', { yibing: 300 }, g0.id, null, null, null);
console.log('[' + TAG + '] dispatch ok=' + (d0 && d0.ok) + ' msg=' + ((d0 && d0.msg) || '-'));
(st.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
G.march.tick();
var r = lastR;
console.log('[' + TAG + '] 战斗结果: ' + (r ? JSON.stringify({
  ok: r.ok, win: r.win, msg: r.msg,
  rounds: r.result && r.result.rounds,
  atkLoss: r.result && r.result.atkLoss, defLoss: r.result && r.result.defLoss,
  mine: r.loss && r.loss.mine, foe: r.loss && r.loss.foe,
  haul: r.gains && r.gains.haul ? { f: r.gains.haul.factor, lost: r.gains.haul.lost } : null,
}) : '(null)'));
/* 战报逐回合 */
var rep = (st.reports || [])[0];
if (rep) {
  console.log('[' + TAG + '] 战报标题=' + (rep.title || rep.target && rep.target.name));
  var txt = Array.isArray(rep.body) ? rep.body.join('\n') : String(rep.body || '');
  console.log(txt.split('\n').slice(0, 40).join('\n'));
}
process.exit(0);
