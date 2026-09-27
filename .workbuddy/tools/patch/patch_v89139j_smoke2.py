# -*- coding: utf-8 -*-
"""v89.139 批八：smoke 五条断言跟随（斥候速度项 / 纯近战接敌 / 箭塔判据 / CSS 两处列宽）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ① 斥候：不参战 → 速度项也不计
rep("""      /* 斥候（nocombat）不参战，也不该把战场撑大/撑快 */
      && D(one('chihou'), one('yibing')) === eff('chihou', 'yibing')
      && spd('chihou') > spd('yibing');""",
"""      /* 斥候（nocombat）不参战，也不该把战场撑大/撑快：
         只带斥候 vs 只带义兵，与"义兵 vs 义兵"逐项相等（速度项也不计斥候）。 */
      && D(one('chihou'), one('yibing')) === eff('yibing', 'yibing')
      && spd('chihou') > spd('yibing');""",
    '斥候速度项')

# ② 纯近战接敌断言：field 不再等于 FIELD_MIN
rep("""  var fq = firstAtk(a), fc = firstAtk(b);
  return a.field === G.tactic.FIELD_MIN && b.field === G.tactic.FIELD_MIN
    && fq >= 1 && fc >= 1 && fq < fc && a.rounds > 1 && b.rounds > 1;
})(), '轻骑第 ' + '?' + ' 回合接敌（长枪更晚）');""",
"""  var fq = firstAtk(a), fc = firstAtk(b);
  /* v89.139：纵深不再等于 FIELD_MIN —— 速度下限接管（轻骑 3600 / 长枪 1500），
     但"快者先接敌"的口径不变（这条正是速度参与距离后要守住的语义）。 */
  return a.field === G.tactic.battlefieldOf({ qingji: 800 }, { yibing: 800 }, 0, {})
    && b.field === G.tactic.battlefieldOf({ changqiang: 800 }, { yibing: 800 }, 0, {})
    && a.field > b.field
    && fq >= 1 && fc >= 1 && fq < fc && a.rounds > 1 && b.rounds > 1;
})(), '轻骑 ' + G.tactic.battlefieldOf({ qingji: 800 }, { yibing: 800 }, 0, {})
    + ' / 长枪 ' + G.tactic.battlefieldOf({ changqiang: 800 }, { yibing: 800 }, 0, {}) + ' 纵深');""",
    '纯近战接敌')

# ③ 箭塔撑宽：判据改为"与 max(纯近战, 箭塔射程项) 恒等"
rep("""    /* v89.95：纵深有 FIELD_MIN 兜底 → "箭塔撑宽"的比例判据改为"确实更宽" */
    return city > melee * 1.3 && city0 === melee
      && city === Math.round(T.wallFireRangeRaw(200, 8)) + T.FIELD_MARGIN;""",
"""    /* v89.95：纵深有 FIELD_MIN 兜底 → "箭塔撑宽"的比例判据改为"确实更宽"。
       v89.139：纵深再加"速度下限"项（两边同值）→ 判据改为**恒等式**：
       攻城纵深 = max(同配野战的纵深, 箭塔射程 + MARGIN)（箭塔仍无条件参与比较）。 */
    return city >= melee && city0 === melee
      && city === Math.max(melee, Math.round(T.wallFireRangeRaw(200, 8)) + T.FIELD_MARGIN);""",
    '箭塔撑宽')

# ④⑤ CSS 两处列宽
rep("""    check('⑧ 上部分三列：左右各 1/6、中间 2/3（CSS grid 1fr 4fr 1fr · v89.117 再压缩）', (function () {
      return /\\.bt-board \\{ display: grid; grid-template-columns: 1fr 4fr 1fr;/.test(h96)""",
"""    check('⑧ 上部分三列：v89.139 两侧改 2 列网格 → 列宽 1.5fr 3fr 1.5fr（v89.117 曾为 1fr 4fr 1fr）', (function () {
      return /\\.bt-board \\{ display: grid; grid-template-columns: 1\\.5fr 3fr 1\\.5fr;/.test(h96)
        && /\\.bt-cards \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\);/.test(h96)""",
    'CSS ⑧ 列宽')

rep("""    check('⑦ 三列 1fr 4fr 1fr（左右各 1/6、中 2/3）',
      /\\.bt-board \\{ display: grid; grid-template-columns: 1fr 4fr 1fr;/.test(h97));""",
"""    check('⑦ 三列 1.5fr 3fr 1.5fr（v89.139：两侧 2 列网格，各占 1/4）',
      /\\.bt-board \\{ display: grid; grid-template-columns: 1\\.5fr 3fr 1\\.5fr;/.test(h97));""",
    'CSS ⑦ 列宽')

assert '\r\n' not in s
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert '1.5fr 3fr 1.5fr' in chk and 'eff(\'yibing\', \'yibing\')' in chk, '落盘校验失败'
print('✅ smoke-test.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
