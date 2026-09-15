# -*- coding: utf-8 -*-
"""v75 · 客栈招募界面（老板五条）—— UI 层补丁

老板原文：
  客栈的招募界面大一点，尽量所有候选都能在同一页，美人灯标识去掉，
  候选将领的成长+2/级这个备注也去掉，改成鼠标悬停在资质上时浮现备注，
  尽量单个将领一行显示。地下的各资质四维，成长和概率也不显示

改动：
  U1  openInn：候选行两行 → 单行；去掉美人标与行内成长备注；改走 openShell（xxl 档）
  U2  rankBadge：title 追加「每级属性成长 +N。」（成长备注全站收进悬停）
  U3  rankTable：整块退役（资质一览不再显示）
  U4  modalShell 注释：尺寸档位表更新（含 xxl）
  H1  CSS：新增 .modal-xxl（980×800）
  H2  CSS：.inn-* 单行版式（.inn-info 退役；列表不再自带滚动）
  H3  CSS：.inn-avatar 第二处规则同步 30px
  H4  CSS：.tag-beauty 整条退役
  H5  CSS：.rk-box/.rk-row 整条退役
  H6  CSS：弹窗尺寸注释块补 xxl 说明
"""
import io, sys

UI = r'E:\Deepseekdb\js\ui.js'
HTML = r'E:\Deepseekdb\index.html'


def patch(path, old, new, tag):
    # 幂等：new（或其 CRLF 变体）已在文件里 → 跳过
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t or new.replace('\n', '\r\n') in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    cands = []
    if old in t:
        cands.append((old, new))
    else:
        old_c, new_c = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
        if old_c in t:
            cands.append((old_c, new_c))
    if not cands:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    old2, new2 = cands[0]
    c = t.count(old2)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, c))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


# ============================================================
# U1a · openInn 候选行：两行 → 单行（去美人标 / 去行内成长备注）
# ============================================================
patch(
    UI,
    """    var rows = list.map(function (c) {
      var can = chk.ok && (s.res.gold || 0) >= c.cost;
      return '<div class="inn-card' + (can ? '' : ' off') + '">' +
        '<div class="inn-avatar">' + ui.faceOf(
          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 40) + '</div>' +
        '<div class="inn-info">' +
          '<div class="inn-name">' + U.escape(c.name) +
            (c.hero ? ' <span class="tag-hero">史实名将</span>' : '') +
            (c.beauty ? ' <span class="tag-beauty">美人</span>' : '') +
            ' <span style="color:var(--text-dim);font-size:var(--fs-cap);font-weight:400;">Lv' + c.level + '</span>' +
            ' ' + ui.rankBadge(c) + '</div>' +
          '<div class="inn-attrs">统率 <b>' + c.tong + '</b>　内政 <b>' + c.nz + '</b>　勇武 <b>' + c.yw + '</b>　智谋 <b>' + c.zm + '</b>' +
            ' <span style="color:var(--text-dim);">｜成长 +' + GAME.rankOf(c).grow + '/级</span></div>' +
        '</div>' +
        '<div class="inn-act">' +
          '<div class="inn-cost' + ((s.res.gold || 0) >= c.cost ? '' : ' short') + '">' + U.fmt(c.cost) + ' 金</div>' +
          '<button class="btn sm' + (can ? ' gold' : '') + '" data-action="inn-recruit" data-id="' + c.id + '"' +
            (can ? '' : ' disabled') + '>' + (c.beauty ? '相亲' : '招募') + '</button>' +
        '</div></div>';
    }).join('') || '<div style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">客栈中暂无贤士，稍候再来。</div>';""",
    """    /* v75（老板）：「尽量单个将领一行显示」「候选将领的成长 +2/级这个备注也去掉」
       「美人灯标识去掉」——候选行改**单行**：头像 · 姓名（含 Lv）· 资质徽章 · 四维 · 价格/按钮。
       成长备注不再写在行内，收进资质徽章悬停（见 ui.rankBadge 的 title）。 */
    var rows = list.map(function (c) {
      var can = chk.ok && (s.res.gold || 0) >= c.cost;
      return '<div class="inn-card' + (can ? '' : ' off') + '">' +
        '<span class="inn-avatar">' + ui.faceOf(
          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 30) + '</span>' +
        '<span class="inn-name">' + U.escape(c.name) +
          (c.hero ? ' <span class="tag-hero">史实名将</span>' : '') +
          ' <span class="inn-lv">Lv' + c.level + '</span></span>' +
        ui.rankBadge(c) +
        '<span class="inn-attrs">统率 <b>' + c.tong + '</b>　内政 <b>' + c.nz + '</b>　勇武 <b>' + c.yw + '</b>　智谋 <b>' + c.zm + '</b></span>' +
        '<span class="inn-act">' +
          '<span class="inn-cost' + ((s.res.gold || 0) >= c.cost ? '' : ' short') + '">' + U.fmt(c.cost) + ' 金</span>' +
          '<button class="btn sm' + (can ? ' gold' : '') + '" data-action="inn-recruit" data-id="' + c.id + '"' +
            (can ? '' : ' disabled') + '>' + (c.beauty ? '相亲' : '招募') + '</button>' +
        '</span></div>';
    }).join('') || '<div style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">客栈中暂无贤士，稍候再来。</div>';""",
    'U1a 候选行单行化',
)

# ============================================================
# U1b · openInn 弹窗本体：openModal → openShell（xxl 档；无资质一览）
# ============================================================
patch(
    UI,
    """    ui.openModal(
      '<div class="gold-heading">🍶 客栈 · Lv' + lv + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">' +
        '每级 1 位候选　|　' + U.escape(city.name) + ' 招贤馆空位 ' + usedIn + '/' + cap +
        '　|　' + leftTxt + '</div>' +
      (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + '</div>') +
      '<div class="inn-list">' + rows + '</div>' +
      '<div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button class="btn sm" data-action="inn-reroll">另请一批（' + U.fmt(GAME.innRefreshCost()) + ' 金）</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>' +
      '<div class="rk-box">' + ui.rankTable(lv) + '</div>'
    );""",
    """    /* v75（老板）：「客栈的招募界面大一点，尽量所有候选都能在同一页」
       「地下的各资质四维，成长和概率也不显示」——
       ① 改走三段式（v19 的 m-head / m-body / m-foot）：标题与按钮固定，只有候选区滚动
          （旧版「列表 414px 上限 + 面板滚动」两道滚动条并存，这里收敛成一处）；
       ② 尺寸用新档 xxl（980×800）：14 位候选（客栈 Lv12 + 满级专精 2）真机一页装下；
       ③ 资质一览（rk-box / rankTable）整块退役。 */
    ui.openShell({
      title: '🍶 客栈 · Lv' + lv,
      sub: '每级 1 位候选　|　' + U.escape(city.name) + ' 招贤馆空位 ' + usedIn + '/' + cap +
        '　|　' + leftTxt,
      body:
        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + '</div>') +
        '<div class="inn-list">' + rows + '</div>',
      foot: '<div class="m-foot">' +
        '<button class="btn sm" data-action="inn-reroll">另请一批（' + U.fmt(GAME.innRefreshCost()) + ' 金）</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      size: 'xxl'
    });""",
    'U1b 弹窗改 openShell（xxl）',
)

# ============================================================
# U2 · rankBadge：悬停备注追加成长（全站口径一致）
# ============================================================
patch(
    UI,
    """    return '<span class="rank-badge r-' + rk.id + '" title="' + U.escape(rk.desc || '') + '">' +
      rk.name + ' ' + '★'.repeat(rk.star) + (style ? ' · ' + style : '') + '</span>';""",
    """    /* v75（老板）：「成长 +2/级这个备注也去掉，改成鼠标悬停在资质上时浮现备注」——
       成长备注收进徽章悬停（desc 里本就有等级上限）；将领清单 / 派遣 / 解雇弹窗同步受益。 */
    return '<span class="rank-badge r-' + rk.id + '" title="' + U.escape(rk.desc || '') +
      '每级属性成长 +' + rk.grow + '。">' +
      rk.name + ' ' + '★'.repeat(rk.star) + (style ? ' · ' + style : '') + '</span>';""",
    'U2 徽章悬停带成长',
)

# ============================================================
# U3 · rankTable 退役
# ============================================================
patch(
    UI,
    """  /* 资质一览（客栈面板用：让玩家知道自己在赌什么） */
  ui.rankTable = function (lv) {
    var ws = GAME.rankWeights(lv), total = 0;
    ws.forEach(function (x) { total += x.w; });
    return ws.slice().reverse().map(function (x) {
      var pct = (x.w / total * 100);
      var pctTxt = pct >= 1 ? pct.toFixed(1) + '%' : pct.toFixed(2) + '%';
      return '<div class="rk-row"><span class="rank-badge r-' + x.rank.id + '">' + x.rank.name + '</span>' +
        '<span class="rk-base">四维 ' + x.rank.base[0] + '~' + x.rank.base[1] + '</span>' +
        '<span class="rk-grow">成长 +' + x.rank.grow + '/级</span>' +
        '<span class="rk-pct">' + pctTxt + '</span></div>';
    }).join('');
  };""",
    """  /* v75（老板）：「地下的各资质四维，成长和概率也不显示」——
     资质一览（ui.rankTable / .rk-box）整块退役：候选行的资质徽章 + 悬停备注已够用。 */""",
    'U3 rankTable 退役',
)

# ============================================================
# U4 · modalShell 注释：尺寸档位表更新
# ============================================================
patch(
    UI,
    """   * 统一：标题栏 / 内容区 / 操作栏三段式；尺寸走四档固定值
   *   sm 460×430 · 默认 660×620 · lg 900×640 · xl 1120×700""",
    """   * 统一：标题栏 / 内容区 / 操作栏三段式；尺寸走固定档位（与 CSS 同源）
   *   sm 440×420 · 默认 660×620 · lg 860×600 · xl 960×700 · xxl 980×800（v75 客栈）""",
    'U4 注释档位表',
)

# ============================================================
# H1 · CSS：新增 .modal-xxl
# ============================================================
patch(
    HTML,
    """  .modal-xl { width: 960px; height: 700px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }""",
    """  .modal-xl { width: 960px; height: 700px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }
  /* xxl（v75 客栈招募）：980×800 —— 老板「大一点，尽量所有候选同一页」。
     单行候选（行高 ~40px）× 14 位 + 三段式标题/按钮，真机实测一页装下；兜底同其余档位。 */
  .modal-xxl { width: 980px; height: 800px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }""",
    'H1 新增 .modal-xxl',
)

# ============================================================
# H2 · CSS：.inn-* 单行版式
# ============================================================
patch(
    HTML,
    """  /* ============ 客栈 / 市集 / 仓储 / 招贤馆 ============ */
  /* v74：46vh → 414px（= 900 画布的 46%）—— 内部滚动的上限不再随窗口高度浮动 */
  .inn-list { max-height: 414px; overflow-y: auto; padding-right: 4px; }
  .inn-card { display: flex; align-items: center; gap: 10px; padding: 8px 10px; margin-bottom: 6px;
    background: rgba(var(--sh-rgb),.2); border: 1px solid var(--gold-dark); border-radius: 7px; }
  .inn-card.off { opacity: .55; }
  .inn-avatar { font-size: 26px; width: 34px; text-align: center; }
  .inn-info { flex: 1; min-width: 0; }
  .inn-name { font-size: var(--fs-lead); font-weight: 700; color: var(--gold-light); }
  .inn-attrs { font-size: var(--fs-sub); color: var(--text-dim); margin-top: 3px; letter-spacing: .3px; }
  .inn-attrs b { color: var(--text); font-weight: 700; }
  .inn-act { text-align: right; flex: 0 0 auto; }
  .inn-cost { font-size: var(--fs-sub); color: var(--gold); margin-bottom: 4px; }
  .inn-cost.short { color: var(--red-light); }""",
    """  /* ============ 客栈 / 市集 / 仓储 / 招贤馆 ============ */
  /* v75（老板）：候选改**单行紧凑**版式（「尽量单个将领一行显示」）。
     列表不再自带滚动 —— 整页滚动只留 .m-body 一处，避免旧版"列表 + 面板"双滚动条。 */
  .inn-list { padding-right: 4px; }
  .inn-card { display: flex; align-items: center; gap: 10px; padding: 4px 10px; margin-bottom: 4px;
    background: rgba(var(--sh-rgb),.2); border: 1px solid var(--gold-dark); border-radius: 7px; }
  .inn-card.off { opacity: .55; }
  .inn-avatar { font-size: 20px; width: 30px; text-align: center; }
  .inn-name { font-size: var(--fs-lead); font-weight: 700; color: var(--gold-light); white-space: nowrap; flex: none; }
  .inn-lv { color: var(--text-dim); font-size: var(--fs-cap); font-weight: 400; }
  .inn-attrs { font-size: var(--fs-sub); color: var(--text-dim); letter-spacing: .3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0; }
  .inn-attrs b { color: var(--text); font-weight: 700; }
  .inn-act { display: flex; align-items: center; gap: 10px; flex: none; margin-left: auto; }
  .inn-cost { font-size: var(--fs-sub); color: var(--gold); white-space: nowrap; }
  .inn-cost.short { color: var(--red-light); }""",
    'H2 inn 单行版式',
)

# ============================================================
# H3 · CSS：.inn-avatar 第二处规则同步
# ============================================================
patch(
    HTML,
    """  .inn-avatar { width: 42px; display: flex; align-items: center; justify-content: center; }""",
    """  .inn-avatar { width: 30px; display: flex; align-items: center; justify-content: center; }""",
    'H3 头像列同步 30px',
)

# ============================================================
# H4 · CSS：.tag-beauty 退役
# ============================================================
patch(
    HTML,
    """  .tag-hero { font-size: var(--fs-cap); padding: 1px 5px; border-radius: 3px; background: var(--sep-gold); color: var(--gold-light); }
  .tag-beauty { font-size: var(--fs-cap); padding: 1px 5px; border-radius: 3px; background: rgba(212,83,126,.22); color: var(--beauty); }""",
    """  .tag-hero { font-size: var(--fs-cap); padding: 1px 5px; border-radius: 3px; background: var(--sep-gold); color: var(--gold-light); }
  /* v75（老板）：「美人灯标识去掉」—— .tag-beauty 整条退役（界面不再产出该标）。 */""",
    'H4 美人标退役',
)

# ============================================================
# H5 · CSS：.rk-box/.rk-row 退役
# ============================================================
patch(
    HTML,
    """  .rk-box { margin-top: 10px; padding: 8px 10px; background: rgba(var(--sh-rgb),.24); border: 1px solid var(--gold-dark); border-radius: 7px; }
  .rk-row { display: flex; align-items: center; gap: 8px; font-size: var(--fs-sub); color: var(--text-dim); padding: 3px 0; }
  .rk-row .rk-base { flex: 0 0 118px; }
  .rk-row .rk-grow { flex: 0 0 92px; color: var(--green-ok); }
  .rk-row .rk-pct  { margin-left: auto; font-weight: 700; color: var(--gold-light); font-variant-numeric: tabular-nums; }""",
    """  /* v75（老板）：「地下的各资质四维，成长和概率也不显示」——
     资质一览（.rk-box / .rk-row）随 rankTable 一并退役。 */""",
    'H5 资质一览 CSS 退役',
)

# ============================================================
# H6 · CSS：弹窗尺寸注释块补 xxl
# ============================================================
patch(
    HTML,
    """  /* v19：附属窗口**尺寸规范化** —— 四档固定尺寸，不随内容多少伸缩。
     内容少则留白、内容多则内部滚动，连续打开多个面板时视觉稳定。
     所有档位都受 vw/vh 上限约束，保证任何视口下都不会超出边界。 */""",
    """  /* v19：附属窗口**尺寸规范化** —— 固定尺寸档位（v75 起五档：+xxl），不随内容多少伸缩。
     内容少则留白、内容多则内部滚动，连续打开多个面板时视觉稳定。
     所有档位都受 vw/vh 上限约束，保证任何视口下都不会超出边界。 */""",
    'H6 尺寸注释补 xxl',
)

print('\n全部落盘完成。')
