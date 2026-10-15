# -*- coding: utf-8 -*-
"""v89.220 补丁 B：调兵（transfer/派驻）不再受目标城练兵场容量限制（老板 2）。

老板原话：「向己方城池派遣时，提示练兵场容量不足。练兵场有什么容量，出征才有出征兵力上限吧」
口径：练兵场容量只作**出征**（从本城发兵）的兵力上限；驻军（调兵/派遣）不受目标城容量限制。
退役三处：① domain.doTransferCargo 发起闸 ② battle._expeditionRun 抵达复验 ③ ui 三个额度出口的 owncity 口径。
"""
import io
R = 'E:/Deepseekdb/'

def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

bad = []

def rep(f, old, new, tag):
    p = R + f
    s = rd(p)
    if old not in s and new in s:
        print('  [skip] %s' % tag); return
    c = s.count(old)
    if c != 1:
        bad.append('%s x%d | %s' % (tag, c, old[:50].replace('\n', '⏎'))); return
    wr(p, s.replace(old, new))
    print('  [ok] %s' % tag)

# ── ① domain.js：发起闸退役 ──
rep('js/domain.js',
    """    /* v89.102（老板）：目标城练兵场容量 —— 与出征**同一把尺、同一个出口**
       （练兵场等级 × 1 万**人马** + 加成链；无练兵场则不设限）。 */
    var cap = GAME.battle.marchCapOf(to);
    var nowMen = GAME.battle.marchMenOf(to.army);
    var addMen = GAME.battle.marchMenOf(army);
    if (cap > 0 && nowMen + addMen > cap) {
      return { ok: false, msg: to.name + ' 练兵场容量不足（需 Lv'
        + GAME.battle.marchCapLvFor(nowMen + addMen) + ' 练兵场）' };
    }
""",
    """    /* ⛔ v89.220（老板 2）：「向己方城池派遣时，提示练兵场容量不足。练兵场有什么容量，
       出征才有出征兵力上限吧」——**目标城容量闸整条退役**：
       练兵场容量只作为**出征**（从本城发兵）的兵力上限（prepare 的 mode.battle 闸）；
       驻军（调兵 / 派遣）不以目标城练兵场容量为限。v89.102～v89.219 曾按"与出征同一把尺"
       给目标城设闸（当时也设了抵达复验）——撤销依据与实测见 docs/v89220。 */
""",
    'domain.doTransferCargo 发起闸')

# ── ② battle.js：抵达复验退役 ──
rep('js/battle.js',
    "     * · 调兵：抵达入城（再验一次目标城练兵场，超容则整体折返）；",
    "     * · 调兵：抵达入城（v89.220 起**不再复验目标城容量** —— 驻军不设容量闸）；",
    'battle 段头注释')

rep('js/battle.js',
    """      /* v89.102：调兵容量与出征**同一把尺**（练兵场等级 × 1 万人马 + 加成链）——
         改前这里只算裸容量（不含专精/年号/增益），比出发时的门更严，
         于是"刚发出的兵，到了自家城门被拦折返"。 */
      var _ocap = GAME.battle.marchCapOf(_to);
      var _np = GAME.battle.marchMenOf(_to.army);
      var _ap = GAME.battle.marchMenOf(atkArmy);
      if (_ocap > 0 && _np + _ap > _ocap) {
        /* 折返（_expArmySettled 保持 false → arrive 兜底原路退回出发城） */
        return { ok: false, msg: _to.name + ' 练兵场容量不足（途中已满编）' };
      }
""",
    """      /* ⛔ v89.220（老板 2）：抵达复验（目标城练兵场容量）随发起闸一并退役 ——
         驻军不受目标城容量限制（见 domain.doTransferCargo 段 / docs/v89220）。 */
""",
    'battle 抵达复验')

# ── ③ ui.js：三个额度出口的 owncity 口径 ──
rep('js/ui.js',
    """   *   · 目标 = 我方城池（调兵 · 辎重）：目标城出征容量 − 目标城现有兵力
   *       （与 expedition 的 owncity 抵达闸同源）；""",
    """   *   · 目标 = 我方城池（调兵 · 辎重）：**不限**（v89.220 老板 2 —— 驻军不受目标城
   *       练兵场容量限制；原"目标城出征容量 − 现有兵力"口径整条退役）；""",
    'ui 段注释-owncity')

rep('js/ui.js',
    """    if (t.kind === 'owncity' && t.city) {
      var cap2 = GAME.battle.marchCapOf(t.city);
      if (!(cap2 > 0)) return null;
      return Math.max(0, cap2 - GAME.battle.marchMenOf(t.city.army));
    }
""",
    """    /* ⛔ v89.220（老板 2）：调兵（owncity）**不受任何练兵场容量限制** —— 显式返回 null
       （不设限），别掉到下面的"本城出征容量"分支（那会变成按出发城容量限制调兵）。 */
    if (t.kind === 'owncity' && t.city) return null;
""",
    'ui expFillCapOf owncity 分支')

rep('js/ui.js',
    """    if (t && t.kind === 'owncity' && t.city) {
      return '上限 = ' + t.city.name + ' 出征容量 ' + U.numText(GAME.battle.marchCapOf(t.city), 0)
        + ' − 现有兵力 ' + U.numText(GAME.battle.marchMenOf(t.city.army), 0) + ' = ' + U.numText(cap, 0);
    }
""",
    '',
    'ui expFillTipOf owncity 分支（死代码清除）')

rep('js/ui.js',
    """       · 己方野地（驻守）：派驻上限余量；己方城池（调兵）：目标城余量；
       · 无练兵场 = 不设上限。 */""",
    """       · 己方野地（驻守）：派驻上限余量；己方城池（调兵）：不设上限（v89.220）；
       · 无练兵场 = 不设上限。 */""",
    'ui expCapLabelOf 注释')

rep('js/ui.js',
    "    if (t && t.kind === 'owncity') return '目标城余量 ' + U.numText(cap, 0);\n",
    '',
    'ui expCapLabelOf owncity 分支（死代码清除）')

rep('js/ui.js',
    "   *   总额度 = ui.expFillCapOf（同一把尺：野地派驻余量 / 目标城余量 / 练兵场容量 / 不限）；",
    "   *   总额度 = ui.expFillCapOf（同一把尺：野地派驻余量 / 出征容量 / 不限；调兵已不限 · v89.220）；",
    'ui expTroopMaxOf 注释')

rep('js/ui.js',
    "    ui.refreshExpCapLabel();        /* v89.156：限额标签随方式刷新（练兵场 / 派驻 / 目标城余量） */",
    "    ui.refreshExpCapLabel();        /* v89.156：限额标签随方式刷新（出征容量 / 派驻 / 不限） */",
    'ui refreshExpCapLabel 注释')

rep('js/ui.js',
    "'<div class=\"op-zone\" style=\"margin-top:8px;\"><div class=\"op-hint\">兵力按<b>行军通道</b>开拨：有行军时间（军务总览可查看/召回），抵达后入编目标城；练兵场容量不足会被拒。</div></div>',",
    "'<div class=\"op-zone\" style=\"margin-top:8px;\"><div class=\"op-hint\">兵力按<b>行军通道</b>开拨：有行军时间（军务总览可查看/召回），抵达后入编目标城（不受目标城练兵场容量限制）。</div></div>',",
    'ui 派驻面板提示文案')

# ── ④ smoke：§123⑥ 标题（三口径 → 口径更新）──
rep('smoke-test.js',
    "    check('§123⑥ 兵力表头「上限」：三口径（野地派驻余量 / 目标城余量 / 练兵场容量）唯一出口', (function () {",
    "    check('§123⑥ 兵力表头「上限」：口径唯一出口（野地派驻余量 / 出征容量；调兵已不限 · v89.220）', (function () {",
    'smoke §123⑥ 标题')

if bad:
    print('❌ 失配：')
    for b in bad: print('   ' + b)
else:
    print('✅ 补丁 B 全部落盘')
