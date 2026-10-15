# -*- coding: utf-8 -*-
"""v89.105 事故复建 · 批次 2：统计页退役 / 战报两页 / 整叠使用 / 商城 / 故事集"""
import io, os
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
P = os.path.join(R, 'e2e-test.js')
src = io.open(P, encoding='utf-8').read()
n = 0
def rep(old, new, tag):
    global src, n
    assert old in src, '锚点未命中：' + tag
    src = src.replace(old, new, 1); n += 1
    print('  ✓ ' + tag)

RETIRE = '统计页已退役（v89.104：老板「统计这个菜单好像没啥用，删掉吧」）'

# ── ⑧~⑮ 统计页八条 → 退役判据
rep("""  check('统计页渲染全境汇总（需求 5）', !!vc.querySelector('.ledger')
    && vc.querySelectorAll('.ledger-sec').length >= 2 && stats23.indexOf('全境汇总') >= 0);""",
    """  check('%s（不再有账册容器）', !vc.querySelector('.ledger') && !vc.querySelector('.ledger-sec'));""" % RETIRE,
    '⑧ 统计页：账册容器不在册')
rep("""  check('统计页列出每座城池并可「进入」', (function () {
    const rows = vc.querySelectorAll('.tbl tbody tr');
    return rows.length >= G.state.cities.length;
  })(), vc.querySelectorAll('.tbl tbody tr').length + ' 行');""",
    """  check('%s（城池表不在册 —— 城池切换在侧栏）', !vc.querySelector('.tbl tbody tr'));
})();""" % RETIRE,
    '⑨ 统计页：城池表不在册')
rep("""  check('统计页为竹简卷轴（底纹 + 木轴 + 朱印）',
    !!vc.querySelector('.scroll-page') && vc.querySelectorAll('.scroll-axis').length === 2
    && !!vc.querySelector('.scroll-title .seal'));""",
    """  check('%s（竹简卷轴不在册）', !vc.querySelector('.scroll-page'));""" % RETIRE,
    '⑩ 统计页：卷轴不在册')
rep("""  check('统计页为分段账册（甲/乙）',
    vc.querySelectorAll('.ledger-sec').length >= 2 && vc.querySelectorAll('.lg-row').length >= 4
    && vc.querySelectorAll('.stat-card').length === 0,
    vc.querySelectorAll('.ledger-sec').length + ' 段 / ' + vc.querySelectorAll('.lg-row').length + ' 行');""",
    """  check('%s（黄册段与行都不在册）',
    vc.querySelectorAll('.ledger-sec').length === 0 && vc.querySelectorAll('.lg-row').length === 0);""" % RETIRE,
    '⑪ 统计页：黄册段行不在册')
rep("""  check('统计页为分段账册（甲·疆域 / 乙·在外）', (function () {""",
    """  check('%s（无黄册分段）', !vc.querySelector('.ledger-sec') || (function () {""" % RETIRE,
    '⑫ 统计页：分段口径改写（头）')
rep("""  check('账目行为「项目 …… 数值」引线结构', (function () {
    const r0 = vc.querySelector('.lg-row');
    return !!r0 && !!r0.querySelector('.lg-k') && !!r0.querySelector('.lg-fill')
      && !!r0.querySelector('.lg-v');""",
    """  check('%s（账目引线结构随页退役）', !vc.querySelector('.lg-row'));""" % RETIRE,
    '⑬ 统计页：账目引线不在册')
rep("""  check('黄册为单列（每笔一行，不会出现"半行留空"）', (function () {
    const rows = Array.from(vc.querySelectorAll('.lg-row'));
    if (rows.length < 4) return false;                  /* 分母太小 → 判据无意义 */""",
    """  check('%s（单列判据随页退役）', !vc.querySelector('.lg-row'));""" % RETIRE,
    '⑭ 统计页：单列判据退役')

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('\n批次 2-A 已改 %d 处' % n)
