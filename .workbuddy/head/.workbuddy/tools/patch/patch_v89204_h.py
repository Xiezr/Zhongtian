# -*- coding: utf-8 -*-
"""v89.204 批次 H：ui.js —— 需求 2
  H1 pagerInnerHTML / modalPagerHTML 三栏改造（页码固定居中）
  H2 百炼/蕴养卡面成本行 -> 悬停（.ec-cost 退役）
  H3 「套装效果一览」删除（forgeSetNote / openForgeSetInfo / foot 按钮）
"""
import io

P = 'E:/Deepseekdb/js/ui.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def cut(tag, start, end, new, mark):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    i = s.find(start)
    assert i >= 0, tag + ' start not found'
    j = s.find(end, i)
    assert j >= 0, tag + ' end not found'
    j += len(end)
    wr(P, s[:i] + new + s[j:])
    print('[ok] ' + tag)

def rep(tag, old, new, mark, cnt=1):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(P, s.replace(old, new))
    print('[ok] ' + tag)

# ── H1a pagerInnerHTML ──
cut('H1a pagerInnerHTML',
    "  /* 纯函数：只产出分页条的 HTML（供底部条与测试直接调用） */\n  ui.pagerInnerHTML = function (key, total, perPage) {",
    "    return '<div class=\"pager\">' + h + '</div>';\n  };",
    """  /* 纯函数：只产出分页条的 HTML（供底部条与测试直接调用）。
     v89.204（老板 2）：「其页码固定显示位置为居中，其他菜单按钮位置合理排布」——
     三栏 grid（1fr auto 1fr）：左 = 前导导航（首页/上页/数字页）· 中 = 页码信息
     （**恒定居中**）· 右 = 后导导航（下页/末页）。左右等宽 ⇒ 中栏永远落在正中央
     （与两侧按钮多少无关）。同款结构见 modalPagerHTML。 */
  ui.pagerInnerHTML = function (key, total, perPage) {
    var p = ui.pageOf(key, total, perPage);
    if (!total) return '<div class="pager"><span class="pg-info">暂无记录</span></div>';
    if (p.maxPage <= 1) return '<div class="pager"><span class="pg-info">共 ' + total + ' 项</span></div>';
    var btn = function (n, label, extra) {
      return '<button class="btn sm' + (extra || '') + '" data-action="page" data-key="' + key + '" data-n="' + n + '">' + label + '</button>';
    };
    var l = btn(1, '« 首页');
    /* v89.189：分页"到头"不是操作受阻 —— 加 data-no-why，软化器不动它 */
    l += '<button class="btn sm" data-action="page" data-key="' + key + '" data-n="' + (p.page - 1) + '"' + (p.page <= 1 ? ' disabled data-no-why="1"' : '') + '>‹ 上页</button>';
    var lo = Math.max(1, p.page - 2), hi = Math.min(p.maxPage, lo + 4);
    lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) l += btn(i, String(i), i === p.page ? ' gold' : '');
    var r = '<button class="btn sm" data-action="page" data-key="' + key + '" data-n="' + (p.page + 1) + '"' + (p.page >= p.maxPage ? ' disabled data-no-why="1"' : '') + '>下页 ›</button>';
    r += btn(p.maxPage, '末页 »');
    return '<div class="pager"><span class="pg-side l">' + l + '</span>'
      + '<span class="pg-info">第 ' + p.page + '/' + p.maxPage + ' 页 · 共 ' + total + ' 项</span>'
      + '<span class="pg-side r">' + r + '</span></div>';
  };""",
    'pg-side l">\' + l + \'</span>')

# ── H1b modalPagerHTML ──
cut('H1b modalPagerHTML',
    "  /* 弹窗分页条（按钮走 action=mpage → ui.setModalPage） */\n  ui.modalPagerHTML = function (key, total, perPage) {",
    "    return '<div class=\"pager\">' + h + '</div>';\n  };",
    """  /* 弹窗分页条（按钮走 action=mpage → ui.setModalPage）
     v89.204（老板 2）：三栏结构（页码恒定居中）—— 与 ui.pagerInnerHTML 同款。 */
  ui.modalPagerHTML = function (key, total, perPage) {
    var p = ui.pageOf(key, total, perPage);
    var btn = function (n, label, off) {
      /* v89.190（上轮遗留）：分页「到头」加 data-no-why —— 与 ui.pagerHTML 同款白名单，
         否则兜底扫掠会把它们软化成「点了弹原因」（到头不是操作受阻）。 */
      return '<button class="btn sm' + (off ? ' off' : '') + '" data-action="mpage" data-key="' + key + '" data-n="' + n + '"'
        + (off ? ' disabled data-no-why="1"' : '') + '>' + label + '</button>';
    };
    if (!total) return '<div class="pager"><span class="pg-info">暂无记录</span></div>';
    if (p.maxPage <= 1) return '<div class="pager"><span class="pg-info">共 ' + total + ' 项</span></div>';
    var l = btn(1, '« 首页', p.page <= 1) + btn(p.page - 1, '‹ 上页', p.page <= 1);
    var lo = Math.max(1, p.page - 2), hi = Math.min(p.maxPage, lo + 4);
    lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) l += btn(i, String(i), false).replace('class="btn sm"', 'class="btn sm' + (i === p.page ? ' gold' : '') + '"');
    var r = btn(p.page + 1, '下页 ›', p.page >= p.maxPage) + btn(p.maxPage, '末页 »', p.page >= p.maxPage);
    return '<div class="pager"><span class="pg-side l">' + l + '</span>'
      + '<span class="pg-info">第 ' + p.page + '/' + p.maxPage + ' 页 · 共 ' + total + ' 项</span>'
      + '<span class="pg-side r">' + r + '</span></div>';
  };""",
    '与 ui.pagerInnerHTML 同款。 */\n  ui.modalPagerHTML')

# ── H2a 百炼卡面 ──
rep('H2a 百炼卡面',
    """      var setNm = (it.set && DATA.SETS[it.set]) ? ('（' + DATA.SETS[it.set].name + '）') : '';
      return '<div class="enh-card' + (key === ui._enhSel ? ' on' : '') +
          '" data-action="enh-pick" data-key="' + key + '"' +
          ' title="' + U.escape(GAME.eqLabel(inst) + setNm) + '">' +
        '<span class="ec-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="ec-mid">' +
          '<span class="ec-nm"><b>' + U.escape(GAME.eqName(inst)) + (sn ? '·' + sn : '') + '</b>' +
            '<i class="ec-tag">' + U.escape(GAME.qNameOf(it) || '') + '</i></span>' +
          '<span class="ec-lv">+' + lv + ' <i>/' + maxE + '</i></span>' +
          '<span class="ec-cost">' + (cost ? ('下级 ' + GAME.costString(cost)) : '已至满级') + '</span>' +
        '</span></div>';""",
    """      var setNm = (it.set && DATA.SETS[it.set]) ? ('（' + DATA.SETS[it.set].name + '）') : '';
      /* v89.204（老板 2）：「强化界面的资源要求请以悬停显示，而不是直接占用位置」——
         成本行从卡面撤下（.ec-cost 退役），并入悬停文案。 */
      var tipE204 = GAME.eqLabel(inst) + setNm + '　'
        + (cost ? ('下级成本 ' + GAME.costString(cost)) : '已至满级');
      return '<div class="enh-card' + (key === ui._enhSel ? ' on' : '') +
          '" data-action="enh-pick" data-key="' + key + '"' +
          ' title="' + U.escape(tipE204) + '">' +
        '<span class="ec-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="ec-mid">' +
          '<span class="ec-nm"><b>' + U.escape(GAME.eqName(inst)) + (sn ? '·' + sn : '') + '</b>' +
            '<i class="ec-tag">' + U.escape(GAME.qNameOf(it) || '') + '</i></span>' +
          '<span class="ec-lv">+' + lv + ' <i>/' + maxE + '</i></span>' +
        '</span></div>';""",
    'var tipE204 = GAME.eqLabel(inst) + setNm')

# ── H2b 蕴养卡面 ──
rep('H2b 蕴养卡面',
    """      var cost = lv < maxL ? GAME.lingTemperCost(inst) : null;
      return '<div class="enh-card' + (key === ui._lingSel ? ' on' : '') +
          '" data-action="ling-pick" data-key="' + key + '"' +
          ' title="' + U.escape(GAME.eqLabel(inst) + '　每级修炼属性 +' + perLv + '%') + '">' +
        '<span class="ec-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="ec-mid">' +
          '<span class="ec-nm"><b>' + U.escape(GAME.eqName(inst)) + (sn ? '·' + sn : '') + '</b>' +
            '<i class="ec-tag">' + U.escape(GAME.qNameOf(it) || '') + '</i></span>' +
          '<span class="ec-lv">+' + lv + ' <i>/' + maxL + '</i></span>' +
          '<span class="ec-cost">' + (cost ? ('下级 灵气精华 ' + cost) : '已至圆满') + '</span>' +
        '</span></div>';""",
    """      var cost = lv < maxL ? GAME.lingTemperCost(inst) : null;
      /* v89.204（老板 2）：与百炼同款 —— 成本行改悬停（.ec-cost 退役） */
      var tipL204 = GAME.eqLabel(inst) + '　每级修炼属性 +' + perLv + '%　'
        + (cost ? ('下级成本 灵气精华 ' + cost) : '已至圆满');
      return '<div class="enh-card' + (key === ui._lingSel ? ' on' : '') +
          '" data-action="ling-pick" data-key="' + key + '"' +
          ' title="' + U.escape(tipL204) + '">' +
        '<span class="ec-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="ec-mid">' +
          '<span class="ec-nm"><b>' + U.escape(GAME.eqName(inst)) + (sn ? '·' + sn : '') + '</b>' +
            '<i class="ec-tag">' + U.escape(GAME.qNameOf(it) || '') + '</i></span>' +
          '<span class="ec-lv">+' + lv + ' <i>/' + maxL + '</i></span>' +
        '</span></div>';""",
    'var tipL204 = GAME.eqLabel(inst)')

# ── H3a forgeSetNote 删除（墓碑） ──
cut('H3a forgeSetNote',
    "  /* 套装效果一览（打造界面底部）—— 数据全部来自 DATA.SETS，无第二份 */\n  ui.forgeSetNote = function () {",
    "      }).join('');\n  };",
    """  /* \u26d4 v89.204（老板 2）：「打造界面不要'套装效果一览'」——
     ui.forgeSetNote / ui.openForgeSetInfo / 底部按钮 / case 'forge-setinfo' 整条退役。
     沿革：v38 建（打造面板正文）→ v51 移独立小窗（正文腾 105px）→ v89.204 整条删。
     套装**数据**（DATA.SETS）不动 —— 卡面套装名、加成结算照常消费。
     回退点 = v89.203 快照（backup/v89204）。 */""",
    '\u26d4 v89.204（老板 2）：「打造界面不要')

# ── H3b openForgeSetInfo 删除（墓碑） ──
cut('H3b openForgeSetInfo',
    "  /* 套装效果一览（从打造面板正文移到独立小窗）——\n     它是**查得到的参考表**，不是每次打造都要盯着的东西；\n     正文放不下两行卡片的根源就是它那 105px。数据仍只有 DATA.SETS 一份。 */\n  ui.openForgeSetInfo = function () {",
    "      foot: '<div class=\"m-foot\"><button class=\"btn\" data-action=\"close-modal\">关闭</button></div>'\n    });\n  };",
    """  /* \u26d4 v89.204：`ui.openForgeSetInfo`（独立小窗）随「套装效果一览」整条退役 ——
     与 ui.forgeSetNote 同批，沿革见上方墓碑。 */""",
    'ui.openForgeSetInfo`（独立小窗）随')

# ── H3c foot 按钮删除 ──
rep('H3c foot 按钮',
    """        (pool.length ? '<button class="btn" data-action="forge-allset" title="全选当前列表（含本页之外），再点一次取消">⚑ 全选</button>' : '') +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
    """        (pool.length ? '<button class="btn" data-action="forge-allset" title="全选当前列表（含本页之外），再点一次取消">⚑ 全选</button>' : '') +
        /* v89.204（老板 2）：「套装效果一览」按钮随该功能整条退役（见上方墓碑） */
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
    '「套装效果一览」按钮随该功能整条退役')

print('patch H done')
