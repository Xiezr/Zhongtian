/* v89.192 探针D：观战补历史（_makeEnv 收集 + 补渲染数据完整性）
 * 场景：战斗后台推进 3 回合 → 中途"打开观战" → 校验：
 *   ① _makeEnv(rec, steps) 收集到 3 步、每步有 r/gap/events/snap
 *   ② 步的回合序与 rec.round 一致（1,2,3）
 *   ③ 不传收集参 = 旧行为（返回 env，无副作用）
 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME;
G.newGame({ name: 'watch192', region: '司隶', mapSeed: 20260931 });
G.state.world.weather = 'clear';
var st = G.state;
st.settings = st.settings || {}; st.settings.battleWatch = true;   /* 观战开（挂起式） */

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
    if (lv0 >= 1 && lv0 <= 3) tgt = { x: xx, y: yy, lv: lv0 };
  }
}
console.log('目标野地 = ' + tgt.x + ',' + tgt.y + ' Lv' + tgt.lv);

/* 发兵 → 挂起 */
var g0 = (st.generals || [])[0]; g0.cityId = c0.id; g0.status = 'idle';
c0.army = { yibing: 800 };
G.setStaNow(g0, 200); g0.energy = 200;
var d0 = G.march.dispatch({ kind: 'wild', x: tgt.x, y: tgt.y, name: '试野地', lv: tgt.lv,
  terrain: 'plain' }, 'raid', { yibing: 800 }, g0.id, null, null, null);
console.log('dispatch ok=' + (d0 && d0.ok) + ' pending=' + (d0 && d0.pending));
(st.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
G.march.tick();
var rec = (st.battles || [])[0];
console.log('挂起记录 = ' + (rec ? rec.id + ' state=' + rec.state + ' round=' + rec.round : '(无)'));

/* 后台推进 3 回合（模拟"玩家没进观战、战斗照打"） */
for (var i = 0; i < 3; i++) G.battle.stepBattle(rec.id);
console.log('推进后 round=' + rec.round + ' history=' + rec.history.length);

/* ① 收集重放 */
var steps = [];
G.battle._makeEnv(rec, steps);
console.log('收集 steps.length =', steps.length, '（应=3）');
steps.forEach(function (s) {
  console.log('  步 r=' + s.r + ' gap=' + s.gap + ' events=' + (s.events || []).length
    + ' snap=' + (s.snap ? ('atk' + (s.snap.atk || []).length + '/def' + (s.snap.def || []).length) : 'null'));
});
var ok1 = steps.length === 3 && steps[0].r === 1 && steps[2].r === 3
  && steps.every(function (s) { return s.snap && s.events; });
console.log('① 收集完整性：' + (ok1 ? '✅' : '❌'));

/* ② 不传参 = 旧行为 */
var env2 = G.battle._makeEnv(rec);
console.log('② 不传参返回 env：' + (env2 && env2.snap ? '✅（snap 可用）' : '❌'));

/* ③ 与实时会话同源：临时 env 的最终态 == 权威会话态 */
var auth = G._bsess[rec.id];
var s1 = env2.snap(), s2 = auth.snap();
function total(arr) { return (arr || []).reduce(function (n, u) { return n + u.count; }, 0); }
var same = total(s1.atk) === total(s2.atk) && total(s1.def) === total(s2.def);
console.log('③ 重放态与权威会话同源：' + (same ? '✅' : '❌')
  + '（临时 atk' + total(s1.atk) + '/def' + total(s1.def) + ' vs 权威 atk' + total(s2.atk) + '/def' + total(s2.def) + '）');

/* 清理：把战斗跑到结束避免悬挂 */
try { G.battle.autoBattle(rec.id); } catch (e) {}
process.exit(0);
