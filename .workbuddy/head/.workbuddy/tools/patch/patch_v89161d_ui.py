# -*- coding: utf-8 -*-
"""v89.161 补丁 D：界面出口（金"全境通用"· 费用悬停注 · 折损周期的现实时间换算）
+ 调运清单去金（金无需运输）。"""
import io, sys

R = 'E:/Deepseekdb/'


def rep(path, tag, old, new, guard):
    s = io.open(R + path, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-46s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 锚点命中 %d 次' % (tag, n)
    io.open(R + path, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-46s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ── ① 金：悬停写明"全境通用" ──
rep('js/ui.js', 'ui · 金悬停写全境通用',
    """      var amtTip = (k === 'gold')
        ? ('黄金：货币，不受仓储上限约束' + '\\n现有 ' + U.numText(val, 0))""",
    """      var amtTip = (k === 'gold')
        ? ('黄金：**全境通用**（各城共用这一口池子 —— 任何城池的建造 / 募兵 / 花销都从这里扣）'
          + '\\n货币，不受仓储上限约束；无需运输。'
          + '\\n现有 ' + U.numText(val, 0))""",
    '黄金：**全境通用**')

# ── ② 费用悬停：注明金的通用口径（只在费用含金时出现） ──
rep('js/ui.js', 'ui · 费用悬停注金通用',
    """    if (jp.length) lines.push(jp.join(' · '));
    return lines.join('\\n') || '—';
  };""",
    """    if (jp.length) lines.push(jp.join(' · '));
    /* v89.161（老板 5）：费用里含金时注明口径 —— 金全境通用，货品按本城结算 */
    if (cost.gold) lines.push('（金：全境通用 · 粮木石铁：按本城结算）');
    return lines.join('\\n') || '—';
  };""",
    '（金：全境通用 · 粮木石铁：按本城结算）')

# ── ③ 折损周期的现实时间换算（唯一出口）—— 老板问「10 倍速下现实多长」 ──
rep('js/ui.js', 'ui · 折损周期现实换算出口',
    """  ui.buildCostTip = function (cost) {""",
    """  /* v89.161：逾溢折损周期的**现实时间换算**（唯一出口）——
     老板问「10 倍速下现实时间是多长」：一段"1 游戏日"在 10× 下 = 2.4 现实小时。
     这里按当前倍速换算，悬停/面板直接读它（改数据只改 DATA.OVERFLOW，文案自动跟）。 */
  ui.rotPeriodRealText = function () {
    var C = (typeof DATA !== 'undefined' && DATA.OVERFLOW) || {};
    var ts = Math.max(1, GAME.timeScale());
    var sec = ((C.periodGameHours == null ? 24 : C.periodGameHours) * 3600) / ts;
    var txt;
    if (sec >= 5400) txt = (Math.round(sec / 360) / 10) + ' 小时';
    else if (sec >= 90) txt = Math.round(sec / 60) + ' 分钟';
    else txt = Math.round(sec) + ' 秒';
    return txt + '（@' + ts + '×）';
  };

  ui.buildCostTip = function (cost) {""",
    'ui.rotPeriodRealText = function')

# ── ④ 侧栏悬停：折损行带现实换算 ──
rep('js/ui.js', 'ui · 侧栏折损行带现实换算',
    """          + (_pct >= 100 ? ('\\n· ⚠️ 已超上限：超出部分每游戏日折损 '
              + Math.round(((DATA.OVERFLOW || {}).ratio == null ? 0.25 : DATA.OVERFLOW.ratio) * 100) + '%（'
              + (((DATA.OVERFLOW || {}).events) || []).map(function (e) { return e.name; }).join(' / ') + '）') : '')""",
    """          + (_pct >= 100 ? ('\\n· ⚠️ 已超上限：超出部分每游戏日折损 '
              + Math.round(((DATA.OVERFLOW || {}).ratio == null ? 0.25 : DATA.OVERFLOW.ratio) * 100) + '%'
              + '（现实约 ' + ui.rotPeriodRealText() + '）（'
              + (((DATA.OVERFLOW || {}).events) || []).map(function (e) { return e.name; }).join(' / ') + '）') : '')""",
    '（现实约 \' + ui.rotPeriodRealText()')

# ── ⑤ 仓库面板：折损行带现实换算 ──
rep('js/ui.js', 'ui · 仓库折损行带现实换算',
    """    var rotNote = '<div class="note-warn" style="margin-top:6px;">⚠️ 逾溢折损：超出仓容上限的部分，每 '
      + ((_C160.periodGameHours || 24) / 24) + ' 游戏日折损 '""",
    """    var rotNote = '<div class="note-warn" style="margin-top:6px;">⚠️ 逾溢折损：超出仓容上限的部分，每 '
      + ((_C160.periodGameHours || 24) / 24) + ' 游戏日（现实约 ' + ui.rotPeriodRealText() + '）折损 '""",
    '游戏日（现实约 \' + ui.rotPeriodRealText()')

# ── ⑥ 调运清单去金（金无需运输） ──
rep('js/domain.js', 'domain · 运输清单去金',
    """  /* 可运输的资源：人口不在其列（人口随城池自然增长，不靠搬运） */
  GAME.TRANSPORT_KEYS = DATA.RES_ORDER;   /* v89.134：派生自资源集唯一数据源 */""",
    """  /* 可运输的资源：人口不在其列（人口随城池自然增长，不靠搬运）。
     v89.161（老板 5）：**金也不在其列** —— 金是玩家层级通用资源（唯一池 s.gold），
     运金等于"从池子搬到池子"，途中还要白白损耗一截（改前正是这样静默漏账）。 */
  GAME.TRANSPORT_KEYS = DATA.RES_ORDER.filter(function (k) { return k !== 'gold'; });""",
    "GAME.TRANSPORT_KEYS = DATA.RES_ORDER.filter")

print('\nD 段完成。')
