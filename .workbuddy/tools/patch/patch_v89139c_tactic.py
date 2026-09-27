# -*- coding: utf-8 -*-
"""v89.139 批三：tactic.js —— 战场距离口径（最远射程 + 双方最快速度 × 最少接敌回合）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'tactic.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ── ① FIELD_MIN 注释 + 新常量 ──
rep("""  /* v89.95（B2）：纵深 = 最远射程 + MARGIN，且**不得小于 FIELD_MIN**。
     老板原话：「现在的速度对战斗具有决定性影响（一步到面前，先手打击，
     溅射伤害收场，根本没有回合对战乐趣）」。
     改前 FIELD_MIN=200、MARGIN=199 → 纯近战纵深 249，而长枪速度 300 →
     **第 1 回合就贴脸**，先手方一轮打光对手。现在纵深 ≥1400，
     接敌要走 3~5 回合，速度的收益变成"早到一两回合"而不是"一轮定胜负"。 */
  T.FIELD_MARGIN = 299;
  /* 保底：双方都是近战（长枪 50）时也要留出可推进的间距 → 50 + 199 = 249 */
  T.FIELD_MIN = 1400;""",
"""  /* v89.95（B2）：纵深 = 最远射程 + MARGIN，且**不得小于 FIELD_MIN**。
     老板原话：「现在的速度对战斗具有决定性影响（一步到面前，先手打击，
     溅射伤害收场，根本没有回合对战乐趣）」。
     改前 FIELD_MIN=200、MARGIN=199 → 纯近战纵深 249，而长枪速度 300 →
     **第 1 回合就贴脸**，先手方一轮打光对手。
     ------------------------------------------------------------
     v89.139（老板 1）：「**战场距离不对，考虑兵种速度和最远射程**」——
     旧口径的 1400 是**常数保底**：谁打谁都一样远，于是
       · 民夫互殴（spd 180）要 7.8 回合才接敌，30 回合上限里净走路；
       · 铁骑互冲（spd 600）2.3 回合就贴脸 —— 速度差异只体现为"快的一方先到"，
         但"多久开始打"完全没跟配兵走。
     新口径 = **两个下限取大**：
       ① 最远射程 + MARGIN（原版规则，保证远程方的"进入射程"过程）；
       ② (双方最快单位速度之和) × MARCH_ROUNDS_MIN —— 让接敌**至少走 N 回合**，
          跑的兵终于按自己的脚程说话（民夫 vs 民夫 3 回合、铁骑 vs 铁骑 3 回合）。
     速度口径与引擎推进**同一把尺**（`t.spd × spdMult(t)`，见 unitsOf 的 spd 字段），
     所以"几步接敌"的推算与实战逐回合记录一致。 */
  T.FIELD_MARGIN = 299;
  /* 最少接敌回合（v89.139）：接敌回合 = ⌈D ÷ (vA+vD)⌉ ≥ 本值。
     v89.95 老板要求"接敌要走 3~5 回合" —— 这里把它量化成公式的一部分。 */
  T.MARCH_ROUNDS_MIN = 3;
  /* 绝对保底（防极端小速度配兵把 D 压到"一步贴脸"）——
     v89.139 从 1400 调到 600：真正的保底不再是常数值，而是上面 ② 那条速度下限。 */
  T.FIELD_MIN = 600;""",
    'FIELD_MIN+MARCH_ROUNDS_MIN')

# ── ② battlefieldOf：加速度下限 ──
rep("""  /* 战场距离的唯一出口。`opts.field` 显式给了就用它（旧回放/特殊玩法）。 */
  T.battlefieldOf = function (atkArmy, defArmy, defVal, opts) {
    opts = opts || {};
    if (opts.field) return opts.field;
    var wallR = opts.sieging ? T.wallFireRangeRaw(defVal, opts.wallLv, opts.towers) : 0;
    /* v59：**箭塔是独立火力源 → 它的射程无条件参与"最远射程"比较**。
       改前只把 wallR 借给"守方远程兵"（fieldRangeOf 的 side==='def' 分支），
       于是守军全近战时箭塔撑不起战场 —— 而原版明说"箭塔射程 2500，我在 2600 还被打到"。 */
    var maxR = wallR;
    function scan(army, side) {
      Object.keys(army || {}).forEach(function (id) {
        var t = DATA.TROOPS[id];
        /* 斥候不参战、也不该把战场撑大 */
        if (!t || t.nocombat) return;
        var r = fieldRangeOf(t, side, wallR);
        if (r > maxR) maxR = r;
      });
    }
    scan(atkArmy, 'atk');
    scan(defArmy, 'def');
    return Math.max(T.FIELD_MIN, Math.round(maxR) + T.FIELD_MARGIN);
  };""",
"""  /* 战场距离的唯一出口。`opts.field` 显式给了就用它（旧回放/特殊玩法）。
     v89.139：数值 = max(射程下限, 速度下限, 绝对保底) —— 见 FIELD_MIN 段注释。 */
  T.battlefieldOf = function (atkArmy, defArmy, defVal, opts) {
    opts = opts || {};
    if (opts.field) return opts.field;
    var wallR = opts.sieging ? T.wallFireRangeRaw(defVal, opts.wallLv, opts.towers) : 0;
    /* v59：**箭塔是独立火力源 → 它的射程无条件参与"最远射程"比较**。
       改前只把 wallR 借给"守方远程兵"（fieldRangeOf 的 side==='def' 分支），
       于是守军全近战时箭塔撑不起战场 —— 而原版明说"箭塔射程 2500，我在 2600 还被打到"。 */
    var maxR = wallR;
    /* v89.139：顺带收双方"最快单位速度"（与引擎 unitsOf 的 spd 同一把尺：
       `round(t.spd × spdMult(t))`，将领加成 battle 层已并入 spdMult 的场景除外）。 */
    var fastA = 0, fastD = 0;
    function scan(army, side) {
      Object.keys(army || {}).forEach(function (id) {
        var t = DATA.TROOPS[id];
        /* 斥候不参战、也不该把战场撑大/撑快 */
        if (!t || t.nocombat) return;
        var r = fieldRangeOf(t, side, wallR);
        if (r > maxR) maxR = r;
        var sd = Math.round((t.spd || 0) * spdMult(t));
        if (side === 'atk') { if (sd > fastA) fastA = sd; }
        else { if (sd > fastD) fastD = sd; }
      });
    }
    scan(atkArmy, 'atk');
    scan(defArmy, 'def');
    var spdFloor = Math.round((fastA + fastD) * T.MARCH_ROUNDS_MIN);
    return Math.max(T.FIELD_MIN, Math.round(maxR) + T.FIELD_MARGIN, spdFloor);
  };""",
    'battlefieldOf 速度下限')

# ── ③ stepsToWall：零引用退役（带墓碑） ──
rep("""  /* 推算「几步到接触」—— 现在**接收战场距离本身**（`battlefieldOf` 算出），
     不再接场地种类：距离已经变成双方配兵的函数，"按场地查表"不成立了。
     界面把这条讲清楚，玩家才看得见兵种差异（骑兵 1 步 vs 器械靠射程先开火）。 */
  T.stepsToWall = function (spd, range, D) {
    D = D || T.FIELD_MIN;
    var adv = 0, n = 0;
    /* 循环结束时 `adv + range >= D`，即**已经可以开火**，
       所以步数就是推进次数 n（不是 n+1 —— 多算一步会把轻骑兵的
       "1 步到墙"写成 2 步，与战场上的实际表现对不上）。 */
    while (adv + (range || 0) < D && n < 60) {
      var free = D - (range || 0) - adv;
      if (free <= 0) break;
      adv += Math.min(spd * T.MARCH_UNIT, free);
      n++;
    }
    return Math.max(1, n);
  };""",
"""  /* ⛔ v89.139：`T.stepsToWall`（单侧"几步到墙"推算）**整条退役** ——
     零引用（全仓 grep 只有定义），且它的口径与 v89.103 的**共享轴**几何重复：
     接敌回合的正确算法 = ⌈D ÷ (vA+vD)⌉（双方同推），而它算的是"单侧独自推到开火"。
     新口径见 `battlefieldOf` 的 MARCH_ROUNDS_MIN 段。如需恢复：见 backup/v89139/tactic.js。 */""",
    'stepsToWall 退役')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'T.MARCH_ROUNDS_MIN' in chk and 'spdFloor' in chk, '落盘校验失败'
assert 'T.stepsToWall = function' not in chk, '退役未生效'
print('✅ tactic.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
