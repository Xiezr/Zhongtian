# -*- coding: utf-8 -*-
"""v89.185b · battle.js —— 修复：主动撤退（智能保兵 v89.176 / 手动）与沙盘重跑不同源。
   病根：史实"第 N 回合主动撤退"（retreatBattle → ses.finish），而沙盘重跑只重放 cmds，
   无撤退动作 → 一路打到回合上限 → verify 必 false（智能托管默认开 → 所有智能战报
   的沙盘都显示"与史实不一致"）。回滚对照实验证明这是**既有问题**（非本轮引入），
   本轮实中（e2e 沙盘条红）并一并修复。
   修法：① `rc.result` 带上 `retreat` 标志；② 重跑跑到同一回合数即停（不再 step）。"""
import io

P = 'js/battle.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
orig = s
def rep(tag, old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, tag + ' count=' + str(c)
    s = s.replace(old, new, 1)

# ---- R1. 配方 result 带 retreat 标志 ----
rep('R1',
"""      /* 史实结果（校验沙盘忠实度的锚点，不参与画面） */
      result: { rounds: r.rounds, atkLoss: r.atkLoss, defLoss: r.defLoss },""",
"""      /* 史实结果（校验沙盘忠实度的锚点，不参与画面） */
      /* v89.185b：`retreat` 标志随配方走 —— 史实"主动撤退"（智能保兵 v89.176 / 手动）
         是"提前结束"的动作，重跑必须对齐（见 _sandboxBuild 的 stopAfter），
         否则重跑一路打到回合上限、verify 必 false（智能托管默认开 → 所有智能战报中招）。 */
      result: { rounds: r.rounds, atkLoss: r.atkLoss, defLoss: r.defLoss, retreat: !!r.retreat },""")

# ---- R2. 重跑循环：到撤退回合即停 ----
rep('R2',
"""    var cmds = rc.cmds || null;
    var frames = [], per = [], guard = 0;
    while (!env.over && guard++ < (GAME.tactic.MAX_ROUNDS || 30) + 5) {
      var _ci = per.length;
      if (cmds && cmds[_ci]) {
        for (var _tid in cmds[_ci]) env.setCmd('atk', _tid, cmds[_ci][_tid]);
      }
      var st = env.step();
      if (!st) break;""",
"""    var cmds = rc.cmds || null;
    /* v89.185b：史实为**主动撤退**（result.retreat）→ 重跑到同一回合数（result.rounds）即停 ——
       对齐"这场仗是被提前结束的"，否则重跑打满上限、与史实两回事（verify 必 false）。 */
    var stopAfter = ((rc.result || {}).retreat) ? (((rc.result || {}).rounds) || 0) : 0;
    var frames = [], per = [], guard = 0;
    while (!env.over && guard++ < (GAME.tactic.MAX_ROUNDS || 30) + 5) {
      if (stopAfter && per.length >= stopAfter) break;
      var _ci = per.length;
      if (cmds && cmds[_ci]) {
        for (var _tid in cmds[_ci]) env.setCmd('atk', _tid, cmds[_ci][_tid]);
      }
      var st = env.step();
      if (!st) break;""")

assert s != orig
assert s.count('defLoss: r.defLoss, retreat: !!r.retreat') == 1   # 收窄：3303 行 replay 已有同名片段
assert s.count('var stopAfter = ((rc.result || {}).retreat)') == 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch battle(retreat) OK, len=' + str(len(s)))
