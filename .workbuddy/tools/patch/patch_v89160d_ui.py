# -*- coding: utf-8 -*-
"""v89.160 补丁 D：界面出口（逾溢折损可见）+ 自动升级文案（取消城内优先 / 顺延）"""
import io, sys

R = 'E:/Deepseekdb/'


def rep(path, tag, old, new, guard):
    s = io.open(R + path, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-44s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 锚点命中 %d 次' % (tag, n)
    io.open(R + path, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-44s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ── ① 侧栏资源悬停：已超上限时写明折损规则（机制可见） ──
rep('js/ui.js', 'ui · 侧栏悬停折损行',
    """          + ((sp && sp.ext > 0) ? ('\\n· 城外堆场：+' + U.amtText(sp.ext) + '（资源建筑按等级所出 · 不吃仓储加成）') : '')
          + '\\n现有 ' + U.numText(val, 0));""",
    """          + ((sp && sp.ext > 0) ? ('\\n· 城外堆场：+' + U.amtText(sp.ext) + '（资源建筑按等级所出 · 不吃仓储加成）') : '')
          /* v89.160（老板 1）：逾溢折损 —— **机制在界面可见**（读数与结算同源 DATA.OVERFLOW） */
          + (_pct >= 100 ? ('\\n· ⚠️ 已超上限：超出部分每游戏日折损 '
              + Math.round(((DATA.OVERFLOW || {}).ratio == null ? 0.25 : DATA.OVERFLOW.ratio) * 100) + '%（'
              + (((DATA.OVERFLOW || {}).events) || []).map(function (e) { return e.name; }).join(' / ') + '）') : '')
          + '\\n现有 ' + U.numText(val, 0));""",
    '已超上限：超出部分每游戏日折损')

# ── ② 仓库面板：加一行"逾溢折损"说明 + 当前超出量 ──
rep('js/ui.js', 'ui · 仓库面板折损说明',
    """    var near = lv > 0 ? '' : '<div class="note-warn">未建仓库：仅保有基础储量 ' + U.fmt(sp.base)
      + '；城外堆场另计 +' + U.fmt(sp.ext) + '，合计 ' + U.fmt(sp.total) + '（超出部分将停止增长）</div>';""",
    """    var near = lv > 0 ? '' : '<div class="note-warn">未建仓库：仅保有基础储量 ' + U.fmt(sp.base)
      + '；城外堆场另计 +' + U.fmt(sp.ext) + '，合计 ' + U.fmt(sp.total) + '（超出部分将停止增长）</div>';
    /* v89.160（老板 1）：逾溢折损（唯一出口 GAME.overflowRotOf / DATA.OVERFLOW）——
       涨不动就罢了，超出上限的部分还会被"天灾"慢慢吃掉：规则与**当前超出量**写在这里。 */
    var _C160 = DATA.OVERFLOW || {};
    var _rotEx160 = GAME.overflowRotOf(GAME.currentCity()).reduce(function (t, x) { return t + x.excess; }, 0);
    var rotNote = '<div class="note-warn" style="margin-top:6px;">⚠️ 逾溢折损：超出仓容上限的部分，每 '
      + ((_C160.periodGameHours || 24) / 24) + ' 游戏日折损 ' + Math.round((_C160.ratio == null ? 0.25 : _C160.ratio) * 100) + '%'
      + '（' + ((_C160.events || []).map(function (e) { return e.name; }).join(' / ')) + '）'
      + '　·　当前超出上限：<b>' + (_rotEx160 > 0 ? U.fmt(_rotEx160) : '无') + '</b></div>';""",
    '逾溢折损：超出仓容上限的部分')

rep('js/ui.js', 'ui · 仓库面板挂上折损行',
    """      near + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>'""",
    """      near + rotNote + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>'""",
    'near + rotNote + rows +')

# ── ③ 自动升级说明文案：取消城内优先 + 顺延 ──
rep('js/ui.js', 'ui · 自动升级说明文案',
    """      body = '<div class="auto-note">按等级从低到高、同级城内优先；受建造队列上限约束。' +
        '资源不足时<b>暂停但不关开关</b>，资源恢复后自动继续；全部满级则停止。' +
        '只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>';""",
    """      body = '<div class="auto-note">按等级从低到高（<b>不再区分城内城外</b>）；受建造队列上限约束。' +
        '某项资源不足就<b>顺延试下一项</b>，全部试遍都升不动才暂停（开关不关，资源恢复后自动继续）；' +
        '全部满级则停止。只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>';""",
    '不再区分城内城外')

# ── ④ main.js 开启提示 ──
rep('js/main.js', 'main · 自动升级开启提示',
    """      ui.toast('🔨 自动升级已开启（按等级从低到高、同级城内优先）');""",
    """      ui.toast('🔨 自动升级已开启（按等级从低到高；某项不足则顺延下一项）');""",
    '某项不足则顺延下一项')

print('\nD 段完成。')
