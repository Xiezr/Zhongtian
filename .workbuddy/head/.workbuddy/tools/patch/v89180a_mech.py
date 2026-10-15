# v89.180a 补丁：拆械特性（data.js 标签+字段 / tactic.js fireOnce / battle.js 评分器 / ui.js 两处展示）
# 纪律：读→改（逐处 count==1 断言）→写（newline='' 保 LF）→ 自检
import io, sys

P = 'E:/Deepseekdb/'
def read(p):
    return io.open(P + p, 'r', encoding='utf-8', newline='').read()
def write(p, s):
    io.open(P + p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, s, old, new, cnt=1):
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + ' (expect ' + str(cnt) + ')'
    return s.replace(old, new)

# ============================================================
# 1. data.js —— 器械标签 + 床弩拆械字段 + 表头注释
# ============================================================
s = read('js/data.js')

# 1a. 床弩行：加 mech + vsMech + desc
s = rep('D1 chuangnu',
    s,
    "    chuangnu: { id: 'chuangnu', name: '床弩', ab: '弩', icon: '🏹', hp: 5400, atk: 500, def: 160, range: 1400, spd: 120, gather: 2, load: 20, pop: 3, time: 2910, cost: { grain: 7500, wood: 3000, iron: 1800 }, craft: true, unlock: { junying: 8, shuyuan: 8, gongjiangzuofang: 3 }, desc: '强力远程，攻城利器（工匠作坊制造）' },",
    "    chuangnu: { id: 'chuangnu', name: '床弩', ab: '弩', icon: '🏹', hp: 5400, atk: 500, def: 160, range: 1400, spd: 120, gather: 2, load: 20, pop: 3, time: 2910, cost: { grain: 7500, wood: 3000, iron: 1800 }, craft: true, mech: true, vsMech: 2, unlock: { junying: 8, shuyuan: 8, gongjiangzuofang: 3 }, desc: '强力远程，拆械破车，攻城必带（工匠作坊制造）' },")

# 1b. 冲车行：加 mech
s = rep('D2 chongche',
    s,
    "    chongche: { id: 'chongche', name: '冲车', ab: '冲', icon: '🚩', hp: 36000, atk: 620, def: 600, range: 50, spd: 160, gather: 2, load: 25, pop: 5, time: 4370, cost: { grain: 12000, wood: 6000, iron: 1500 }, craft: true, unlock: { junying: 9, shuyuan: 8, gongjiangzuofang: 5 }, desc: '重甲巨车，城墙杀手（工匠作坊制造）' },",
    "    chongche: { id: 'chongche', name: '冲车', ab: '冲', icon: '🚩', hp: 36000, atk: 620, def: 600, range: 50, spd: 160, gather: 2, load: 25, pop: 5, time: 4370, cost: { grain: 12000, wood: 6000, iron: 1500 }, craft: true, mech: true, unlock: { junying: 9, shuyuan: 8, gongjiangzuofang: 5 }, desc: '重甲巨车，城墙杀手（工匠作坊制造）' },")

# 1c. 投石车行：加 mech
s = rep('D3 toudan',
    s,
    "    toudan:  { id: 'toudan', name: '投石车', ab: '投', icon: '🪨', hp: 6600, atk: 950, def: 200, range: 1600, spd: 100, gather: 2, load: 30, pop: 4, time: 5830, cost: { grain: 15000, wood: 5000, stone: 8000, iron: 1200 }, craft: true, unlock: { junying: 10, shuyuan: 10, gongjiangzuofang: 7 }, desc: '攻950射程1600，攻城巨炮（工匠作坊制造）' },",
    "    toudan:  { id: 'toudan', name: '投石车', ab: '投', icon: '🪨', hp: 6600, atk: 950, def: 200, range: 1600, spd: 100, gather: 2, load: 30, pop: 4, time: 5830, cost: { grain: 15000, wood: 5000, stone: 8000, iron: 1200 }, craft: true, mech: true, unlock: { junying: 10, shuyuan: 10, gongjiangzuofang: 7 }, desc: '攻950射程1600，攻城巨炮（工匠作坊制造）' },")

# 1d. 辎重车行：加 mech
s = rep('D4 zhouche',
    s,
    "    zhouche: { id: 'zhouche', cat: 'cav', name: '辎重车', ab: '辎', icon: '🛺', hp: 4200, atk: 10, def: 60, range: 10, spd: 150, gather: 1, load: 20000, pop: 4, time: 110, cost: { grain: 1800, wood: 1500, iron: 350 }, unlock: { junying: 5 }, desc: '专属运资，负重冠绝全军' },",
    "    zhouche: { id: 'zhouche', cat: 'cav', name: '辎重车', ab: '辎', icon: '🛺', hp: 4200, atk: 10, def: 60, range: 10, spd: 150, gather: 1, load: 20000, pop: 4, time: 110, cost: { grain: 1800, wood: 1500, iron: 350 }, mech: true, unlock: { junying: 5 }, desc: '专属运资，负重冠绝全军' },")

# 1e. 表头注释（插在 v89.163 注释段之后、DATA.TROOPS = { 之前）
anchor = "  DATA.TROOPS = {\n    minfu:"
note = """  /* ============================================================
   * v89.180（老板「补床弩拆器械特性」）：**拆械**（单点特性，非克制系统）
   * ------------------------------------------------------------
   * v89.179 克制全撤后，"冲车同人口无解"失去旧答案（原靠床弩克器械 ×3 对位）。
   * 本轮按老板定调补回 —— 形态从"方向表"改为**兵种专属特性**：
   *   · 器械标签 `mech: true`（冲车 / 投石车 / 辎重车 / 床弩 —— 与原方向表同集合）；
   *   · 床弩特性 `vsMech: N`（对器械类目标的**最终伤害**倍率；唯一消费点 =
   *     tactic.fireOnce —— 主动攻击与反击共用本函数，自动全覆盖）；
   *   · 与"克制"的区别：**单向、单兵种、不构成矩阵**（其余任何对位仍纯纸面数值）。
   * 标定见 probe_v89180c（倍率扫描：同人口床弩 vs 冲车 / 投石车）。
   * ============================================================ */
  DATA.TROOPS = {
    minfu:"""
s = rep('D5 表头注释', s, anchor, note)

write('js/data.js', s)
print('data.js OK')

# ============================================================
# 2. tactic.js —— fireOnce 挂拆械（主动攻击 + 反击共用）
# ============================================================
s = read('js/tactic.js')

s = rep('T1 helper',
    s,
    """    function fireOnce(shooter, enemyUnits, ctx) {
      var perA = T.perAtk(shooter, { sieging: !!opts.sieging, siegeMult: ctx.siegeMult });
      var av = perA * shooter.count * (ctx.decay || 1);""",
    """    function fireOnce(shooter, enemyUnits, ctx) {
      var perA = T.perAtk(shooter, { sieging: !!opts.sieging, siegeMult: ctx.siegeMult });
      /* v89.180（老板 1「补床弩拆器械特性」）：**拆械**唯一出口 ——
         床弩兵种表 `vsMech`（对器械的最终伤害倍率）× 目标兵种表 `mech` 标签。
         主动攻击与反击都走 fireOnce，故此处一处即全覆盖；其余对位零影响。 */
      var _shT180 = DATA.TROOPS[shooter.id] || {};
      var mechMulOf = function (tgId) {
        if (!_shT180.vsMech || !tgId) return 1;
        var _vt180 = DATA.TROOPS[tgId];
        return (_vt180 && _vt180.mech) ? _shT180.vsMech : 1;
      };
      var av = perA * shooter.count * (ctx.decay || 1);""")

s = rep('T2 single eff', s, "        var eff0 = av * cf0 * holdMul0;",
        "        var eff0 = av * cf0 * holdMul0 * mechMulOf(tg0.id);")
s = rep('T3 loop eff', s, "        var eff = av * cf * holdMul;",
        "        var eff = av * cf * holdMul * mechMulOf(tg.id);")

write('js/tactic.js', s)
print('tactic.js OK')

# ============================================================
# 3. battle.js —— 智能评分器同尺
# ============================================================
s = read('js/battle.js')
s = rep('B1 killF',
    s,
    """      var hold = (e.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
      var killF = perA * u.count * cf * hold / perHp;""",
    """      var hold = (e.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
      /* v89.180：拆械 —— 评分器与实战共用一把尺（床弩打器械的 killF 乘 vsMech） */
      var _st180 = DATA.TROOPS[u.id] || {};
      var _et180 = DATA.TROOPS[e.id] || {};
      var mechF180 = (_st180.vsMech && _et180.mech) ? _st180.vsMech : 1;
      var killF = perA * u.count * cf * hold * mechF180 / perHp;""")
write('js/battle.js', s)
print('battle.js OK')

# ============================================================
# 4. ui.js —— 募兵卡悬停 + 战场悬停 各加一行
# ============================================================
s = read('js/ui.js')
s = rep('U1 募兵卡',
    s,
    """          '<div class="tip-l">人口 ' + t.pop + ' · 单兵耗时 ' + U.dur(t.time) + '</div>' +""",
    """          '<div class="tip-l">人口 ' + t.pop + ' · 单兵耗时 ' + U.dur(t.time) + '</div>' +
          /* v89.180（老板 1）：拆械特性（床弩专属 · 有才显示） */
          (t.vsMech ? '<div class="tip-l">拆械 对器械伤害 ×' + t.vsMech + '</div>' : '') +""")
s = rep('U2 战场悬停',
    s,
    """    h += '<div class="tip-l">全军防御 <b>' + U.fmt(f.totalDef) + '</b></div>';""",
    """    h += '<div class="tip-l">全军防御 <b>' + U.fmt(f.totalDef) + '</b></div>';
    /* v89.180（老板 1）：拆械特性行（床弩专属 · 有才显示） */
    var _tt180 = DATA.TROOPS[u.id];
    if (_tt180 && _tt180.vsMech) h += '<div class="tip-l">拆械 对器械伤害 ×' + _tt180.vsMech + '</div>';""")
write('js/ui.js', s)
print('ui.js OK')
print('ALL DONE')
