/* ============================================================
 * v89.116 探针②：战场间距规则实测（老板「战场间距似乎不对，确认间距规则」）
 * ------------------------------------------------------------
 * 打印：战场纵深 D / 每回合逐兵种 adv / 共享轴前线 posA·posD / gap / contact，
 * 以及界面 btTopHTML 在"开打前"显示的间距值（这处是嫌疑点）。
 * 跑法：node .workbuddy/tools/probe/probe_v89116_gap.js
 * ============================================================ */
'use strict';
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'domain', 'map', 'battle', 'tactic', 'ui'].forEach(function (f) {
  require(path.join(R, 'js', f + '.js'));
});
var G = global.GAME, DATA = G.DATA, U = G.utils;
G.state = G.newGame({ name: '探', cityName: '许都' });

console.log('===== 常量 =====');
console.log('FIELD_MIN=' + G.tactic.FIELD_MIN + '  FIELD_MARGIN=' + G.tactic.FIELD_MARGIN
  + '  MARCH_CAP_FRAC=' + G.tactic.MARCH_CAP_FRAC + '  MARCH_UNIT=' + G.tactic.MARCH_UNIT
  + '  SORTIE_ADV=' + G.tactic.SORTIE_ADV + '  STANCE_ROW=' + JSON.stringify(G.tactic.STANCE_ROW));

/* ---- 近战对近战（无墙） ---- */
function run(atk, def, opts, label) {
  console.log('\n===== ' + label + ' =====');
  var env = G.tactic.begin(atk, null, def, (opts && opts.defVal) || 0, null, opts || {});
  var s0 = env.snap();
  var fr0 = G.tactic.frontsOf(s0.atk, s0.def, s0.field);
  console.log('  纵深 D=' + s0.field + '　初始：posA=' + fr0.posA + ' posD=' + fr0.posD
    + ' gap=' + fr0.gap + ' contact=' + fr0.contact + '（reach ' + fr0.reach + '）');
  s0.atk.forEach(function (u) { console.log('    [我] ' + u.name + ' adv=' + u.adv + ' range=' + u.range); });
  s0.def.forEach(function (u) { console.log('    [敌] ' + u.name + ' adv=' + u.adv + ' range=' + u.range); });
  /* 界面在"开打前"读的那两个值 */
  console.log('  界面 btTopHTML 的开打前间距 = ' + (1400) + '（rec.gapLast==null → 落回 snap.field）');
  var n = 0;
  while (!env.over && n++ < 8) {
    var st = env.step();
    if (!st) break;
    var fr = G.tactic.frontsOf(st.snap.atk, st.snap.def, s0.field);
    var advs = st.snap.atk.map(function (u) { return u.name + ' ' + u.adv; }).join(' | ');
    console.log('  第 ' + st.r + ' 回合：gap=' + Math.round(fr.gap) + '（剧情 r.gap=' + Math.round(st.gap)
      + '）　我前线 ' + fr.posA + ' / 敌前线 ' + fr.posD + '　contact=' + fr.contact
      + '　我军 adv: ' + advs);
  }
  var fin = env.finish();
  console.log('  结束：' + fin.rounds + ' 回合　我损 ' + fin.atkLoss + ' / 敌损 ' + fin.defLoss + '　胜方 ' + fin.winner);
}

run({ changqiang: 3000 }, { changqiang: 3000 }, { kind: 'wild' }, '纯近战 长枪 3000 vs 3000（无墙）');
run({ gongjian: 3000 }, { changqiang: 3000 }, { kind: 'wild' }, '弓 3000 vs 枪 3000（远程拉纵深）');
run({ changqiang: 3000 }, { changqiang: 3000 },
  { kind: 'city', sieging: true, towers: 0, defVal: 400, playerDef: true, wallLv: 3 },
  '守城（有城防、无箭塔）');
console.log('  ↑ 守城时守方默认动作 = ' + DATA.STANCE_DEFAULT.siege + '（STANCE_ROW=' + G.tactic.STANCE_ROW[DATA.STANCE_DEFAULT.siege] + '）');
console.log('    攻方默认动作 = ' + DATA.STANCE_DEFAULT.atk + '（STANCE_ROW=' + G.tactic.STANCE_ROW[DATA.STANCE_DEFAULT.atk] + '）');

/* ---- 结论汇总 ---- */
console.log('\n===== 口径小结 =====');
console.log('  ① 初始 adv：前进=100 / 驻守=50 / 后退=0 / 出城迎战=200（固定值，与纵深 D 无关）');
console.log('  ② 纵深 D = max(1400, 最远射程 + ' + G.tactic.FIELD_MARGIN + ')');
console.log('  ③ 前线 posA=advA，posD=D−advD；gap=max(0,posD−posA)；contact = gap ≤ 双方最前单位的射程');
console.log('  ④ 界面：btPosPct 把 adv→4%~96%；开打前 rec.gapLast 为空 → 顶栏落回 snap.field（纵深）');
console.log('     ⚠ 这就是"间距不对"：开打前显示的是**纵深 1400**，而不是真实间距 ' + (1400 - 200));
console.log('  ⑤ 单位间距：同侧同动作的部队 adv 相同 → 屏上横向重叠（靠 top 分行区分）');

process.exit(0);
