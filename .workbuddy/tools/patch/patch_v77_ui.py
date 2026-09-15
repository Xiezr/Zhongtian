# -*- coding: utf-8 -*-
"""v77 · UI 层：客栈表格 / 君主面板分栏 / 野地下拉框 / 三按钮退役 / 百炼强化 / 内功显示。"""
import io, sys

HTML = r'E:\Deepseekdb\index.html'
UI = r'E:\Deepseekdb\js\ui.js'
MAIN = r'E:\Deepseekdb\js\main.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    old_c = old.replace('\n', '\r\n'); new_c = new.replace('\n', '\r\n')
    if old in t:
        if t.count(old) != 1:
            print('  ✗ %s：锚点命中 %d 次' % (tag, t.count(old))); sys.exit(1)
        t = t.replace(old, new, 1)
    elif old_c in t:
        if t.count(old_c) != 1:
            print('  ✗ %s：锚点(CRLF)命中 %d 次' % (tag, t.count(old_c))); sys.exit(1)
        t = t.replace(old_c, new_c, 1)
    elif (new in t) or (new_c in t):
        print('  · %s：已改过（跳过）' % tag); return
    else:
        print('  ✗ %s：锚点不匹配' % tag); sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s' % tag)


def replace_span(path, start, end_marker, block, tag, done_marker=None):
    """把 [start, end_marker) 之间的整段替换为 block（end_marker 保留）。
    done_marker：完成标记 —— 出现过即视为已改过（幂等跳过）；
    start 已不存在 → 也视为已删（跳过）。"""
    t = io.open(path, encoding='utf-8', newline='').read()
    if done_marker and done_marker in t:
        print('  · %s：已改过（跳过）' % tag); return
    c = t.count(start)
    if c == 0:
        print('  · %s：起点已不存在（按已删除处理）' % tag); return
    if c != 1:
        print('  ✗ %s：起点命中 %d 次' % (tag, c)); sys.exit(1)
    i = t.find(start)
    j = t.find(end_marker, i + len(start))
    if j < 0:
        print('  ✗ %s：找不到段尾' % tag); sys.exit(1)
    t = t[:i] + block + t[j:]
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s（整段替换）' % tag)


# =====================================================================
# ① index.html：城池属性右三按钮退役（建筑信息 / 资源生产 / 附属野地）
# =====================================================================
patch(HTML,
"""            <span class="side-quick">
              <i data-action="open-bldg-info" title="建筑信息">🏗️</i>
              <i data-action="open-prod-info" title="资源生产">⚙️</i>
              <i data-action="open-wilds" title="附属野地">🏕️</i>
            </span>""",
"""            <!-- v77（老板）：「城池属性右边的 3 个按钮以及相应的计算链就不要了
                 （建筑信息，资源生产，附属野地）」——三个入口整条退役。
                 附属野地改从**资源区的下拉框**进（见 #wild-pick-host）。 -->
            <span class="side-quick"></span>""",
'H1 三按钮退役')

# =====================================================================
# ② index.html：资源区加「附属野地」选择器的静态宿主
# =====================================================================
patch(HTML,
"""        <div class="side-block">
          <div class="side-title"><span>资源</span><span class="side-quick" id="res-prod-hint"></span></div>
          <div class="side-body" id="res-bar"></div>""",
"""        <div class="side-block">
          <div class="side-title"><span>资源</span><span class="side-quick" id="res-prod-hint"></span></div>
          <!-- v77（老板）：「资源这里的备注：本城 新城池改成附属野地 下拉框」——
               独立静态节点（同 #city-switch-host 的做法）：主循环每秒重绘资源栏，
               若把下拉框拼进 #res-bar，展开的列表会每秒被合上。 -->
          <div class="wild-pick-host" id="wild-pick-host"></div>
          <div class="side-body" id="res-bar"></div>""",
'H2 野地宿主')

# =====================================================================
# ③ index.html：新增 CSS（客栈表格 / 君主分栏 / 强化列表 / 野地行）
# =====================================================================
patch(HTML,
"""</style>""",
"""  /* ============================================================
     v77（老板）
     ------------------------------------------------------------
     ① 资源区：附属野地下拉框（原「本城 · 城名」表头退役）
     ② 客栈招募：表格版式（表头 + 单行数据，含月俸列）
     ③ 君主面板：左右分栏（左城池列表 / 右信息表）
     ④ 铁匠铺：百炼强化列表
     ============================================================ */
  .wild-pick-host { margin-bottom: 3px; }
  .wild-pick-host .res-line { display: flex; align-items: center; gap: 6px; }
  .wild-select { flex: 1 1 auto; min-width: 0; max-width: 168px; }

  .inn-tbl { margin: 0; }
  .inn-tbl th, .inn-tbl td { padding: 3px 8px; }
  .inn-tbl .inn-face-cell { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .inn-tbl tr.off td { opacity: .55; }
  .inn-tbl .rank-badge { white-space: nowrap; }
  .inn-tbl .inn-act { display: flex; align-items: center; gap: 6px; justify-content: flex-end; white-space: nowrap; }

  .lord-split { display: grid; grid-template-columns: 5fr 6fr; gap: 12px; align-items: start; }
  .lord-city { display: flex; align-items: center; gap: 8px; padding: 5px 8px;
    border: 1px solid var(--sep-gold); border-radius: var(--r-lg); margin-bottom: 5px; }
  .lord-city.cur { border-color: var(--gold-dark); background: rgba(201, 162, 75, .10); }
  .lord-city .ls-nm { color: var(--gold-light); font-weight: 700; white-space: nowrap; }
  .lord-city .ls-meta { color: var(--text-dim); flex: 1 1 auto; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lord-tbl td.k { width: 86px; color: var(--text-dim); white-space: nowrap; }

  .enh-list { display: flex; flex-direction: column; }
  .enh-row { display: flex; align-items: center; gap: 10px;
    padding: 6px 8px; border-bottom: 1px solid var(--sep-gold); }
  .enh-row:last-child { border-bottom: none; }
  .enh-nm { flex: 1 1 auto; min-width: 0; }
  .enh-tag { color: var(--gold-light); font-weight: 700; margin-left: 4px; }
  .enh-cost { color: var(--text-dim); font-size: var(--fs-sub); }
</style>""",
'H3 v77 CSS')

# =====================================================================
# ④ ui.js：资源栏去掉「本城 · 城名」表头（改为空串起笔）
# =====================================================================
patch(UI,
"""    var html = '<div class="res-line res-scope" title="「/秒」为本城产量；存量为本城库存' +
      '（资源归属城池，跨城调拨请用「城池面板 → 资源运输」）"' +
      ' style="border-bottom:1px solid var(--sep-gold);padding-bottom:4px;margin-bottom:3px;">' +
      '<span class="lbl">本城</span>' +
      '<span class="val" style="color:var(--gold-light);font-weight:700;">' +
        /* v71（老板）：只显示城池命名 —— 本城表头同走短名 */
        ui.cityLabelHTML(c, true) + '</span></div>';""",
"""    /* v77（老板）：「资源这里的备注：本城 新城池改成附属野地 下拉框」——
       原「本城 · 城名」表头退役；附属野地选择器在独立静态节点
       #wild-pick-host（ui.renderWildPick 渲染），不会被每秒重绘打断。 */
    var html = '';""",
'U1 资源表头退役')

# =====================================================================
# ⑤ ui.js：renderSide 挂 renderWildPick + 新函数
# =====================================================================
patch(UI,
"""  ui.renderSide = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!s || !c) return;
    ui.renderCityAttrs(c, s);
    ui.renderResBar(c, s);
    ui.renderGarrison(c, s);
  };""",
"""  ui.renderSide = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!s || !c) return;
    ui.renderCityAttrs(c, s);
    ui.renderWildPick(c, s);
    ui.renderResBar(c, s);
    ui.renderGarrison(c, s);
  };

  /* ============================================================
   * 附属野地下拉框（v77 · 老板）
   * ------------------------------------------------------------
   * 资源区一行：「附属野地」+ 下拉框（地形 等级（坐标））+「进入」。
   * 进入 = openWilds（野地界面：加成一览 / 采集队 / 定位）。
   * 签名不变则不重绘 —— 下拉展开与选择不会被每秒刷新合上（同 #city-switch-host 套路）。
   * ============================================================ */
  ui._wildSig = '';
  ui._wildSel = 0;
  ui.renderWildPick = function (c, s) {
    var box = $('#wild-pick-host');
    if (!box) return;
    var wilds = (s && s.wilds) || [];
    var sig = wilds.map(function (w) { return w.x + ',' + w.y + ',' + w.level; }).join('|');
    if (sig === ui._wildSig) return;
    ui._wildSig = sig;
    if (ui._wildSel >= wilds.length) ui._wildSel = 0;
    var sel = ui._wildSel || 0;
    var opts = wilds.map(function (w, i) {
      var t = DATA.TERRAIN[w.type];
      return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
        (t ? t.name : w.type) + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）</option>';
    }).join('') || '<option value="">暂无附属野地</option>';
    box.innerHTML = '<div class="res-line" title="已占野地（官府等级决定上限）。选一块点「进入」查看加成与采集。">' +
      '<span class="lbl">附属野地</span>' +
      '<span class="val" style="display:flex;align-items:center;gap:6px;">' +
        '<select class="city-select wild-select" id="wild-pick" data-action="wild-pick"' +
          (wilds.length ? '' : ' disabled') + '>' + opts + '</select>' +
        '<button class="btn sm gold" data-action="open-wilds">进入</button>' +
      '</span></div>';
  };""",
'U2 野地下拉')

# =====================================================================
# ⑥ ui.js：客栈候选 → 表格
# =====================================================================
patch(UI,
"""    /* v75（老板）：「尽量单个将领一行显示」「候选将领的成长 +2/级这个备注也去掉」
       「美人灯标识去掉」——候选行改**单行**：头像 · 姓名（含 Lv）· 资质徽章 · 四维 · 价格/按钮。
       成长备注不再写在行内，收进资质徽章悬停（见 ui.rankBadge 的 title）。 */
    var rows = list.map(function (c) {
      var can = chk.ok && (s.res.gold || 0) >= c.cost;
      return '<div class="inn-card' + (can ? '' : ' off') + '">' +
        '<span class="inn-avatar">' + ui.faceOf(
          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 28) + '</span>' +
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
"""    /* v77（老板）：「将领招募字太密了，整成列表，表头比如将领，等级，资质，专长，
       统率……俸禄」——候选改**表格**：表头 + 每位一行；
       新增「月俸」列（与月俸体系同源：GAME.genSalaryOf）。
       v75 的两条仍立着：单行显示 / 成长备注只在资质徽章悬停里。 */
    var STYLE_NAME = {};
    (DATA.GEN_STYLES || []).forEach(function (x) { STYLE_NAME[x.id] = x.name; });
    var rows = list.map(function (c) {
      var can = chk.ok && (s.res.gold || 0) >= c.cost;
      return '<tr class="inn-tr' + (can ? '' : ' off') + '">' +
        '<td><span class="inn-face-cell"><span class="inn-avatar">' + ui.faceOf(
          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 28) + '</span>' +
          '<span class="inn-name" style="white-space:nowrap;">' + U.escape(c.name) +
            (c.hero ? ' <span class="tag-hero">史实名将</span>' : '') + '</span></span></td>' +
        '<td class="ctr">Lv' + c.level + '</td>' +
        '<td class="ctr">' + ui.rankBadge(c) + '</td>' +
        '<td class="ctr">' + (STYLE_NAME[c.style] || '均衡') + '</td>' +
        '<td class="num">' + c.tong + '</td>' +
        '<td class="num">' + c.nz + '</td>' +
        '<td class="num">' + c.yw + '</td>' +
        '<td class="num">' + c.zm + '</td>' +
        '<td class="num" title="每 7 游戏日结算一次（等级 + 四维 + 资质定价）">' +
          U.fmt(GAME.genSalaryOf(c)) + '</td>' +
        '<td><span class="inn-act">' +
          '<span class="inn-cost' + ((s.res.gold || 0) >= c.cost ? '' : ' short') + '">' + U.fmt(c.cost) + ' 金</span>' +
          '<button class="btn sm' + (can ? ' gold' : '') + '" data-action="inn-recruit" data-id="' + c.id + '"' +
            (can ? '' : ' disabled') + '>' + (c.beauty ? '相亲' : '招募') + '</button>' +
        '</span></td></tr>';
    }).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">客栈中暂无贤士，稍候再来。</td></tr>';""",
'U3 客栈表格行')

patch(UI,
"""      body:
        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + '</div>') +
        '<div class="inn-list">' + rows + '</div>',""",
"""      body:
        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + '</div>') +
        '<table class="tbl inn-tbl"><thead><tr>' +
          '<th>将领</th><th class="ctr">等级</th><th class="ctr">资质</th><th class="ctr">专长</th>' +
          '<th class="num">统率</th><th class="num">内政</th><th class="num">勇武</th><th class="num">智谋</th>' +
          '<th class="num">月俸</th><th class="ctr">招募</th></tr></thead><tbody>' + rows + '</tbody></table>',""",
'U4 客栈表头')

# =====================================================================
# ⑦ ui.js：君主面板整段重做（左城池列表 / 右信息表）
# =====================================================================
NEW_LORD = """  ui.openLordInfo = function () {
    var s = GAME.state;
    var totalPop = GAME.totalPopCap();   /* v60：全境人口上限（唯一出口） */
    var popNow = GAME.totalPop();
    var heroCount = s.generals.filter(function (g) { return g.hero; }).length;
    var cur = GAME.systems.rankInfo(s.rank);
    var next = GAME.systems.nextRank();
    var chk = next ? GAME.systems.canPromote() : null;
    var curCity = GAME.currentCity() || {};
    /* 晋升条件整句（悬停用）——「现有 / 所需」都带上，鼠标一放一目了然 */
    var condTitle = '已登顶「裂土封王」';
    if (next) {
      var jewParts = Object.keys(next.jewel || {}).map(function (j) {
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === j) it = x; });
        return (it ? it.name : j) + ' ' + ((s.items && s.items[j]) || 0) + '/' + next.jewel[j];
      });
      condTitle = '晋升「' + next.name + '」条件：声望 ' + U.fmt(s.rep) + '/' + U.fmt(next.rep)
        + '　城池 ' + s.cities.length + '/' + next.city
        + '　黄金 ' + U.fmt(s.res.gold || 0) + '/' + U.fmt(next.gold)
        + (jewParts.length ? '　珠宝 ' + jewParts.join('、') : '')
        + (chk && !chk.ok ? '（' + chk.msg + '）' : '（条件已满足）');
    }
    var lg = GAME.lordGeneralOf();
    var salaryTotal = GAME.genSalaryTotal ? GAME.genSalaryTotal() : 0;
    /* v77（老板）：「君主界面分左右两半：左边城池列表（加进入按钮），右边两列信息表
       （姓名+改名 / 爵位+晋升（悬停见条件）/ 声望 / 人口总和 / 将领总和 / 状态）」。
       旧版（单列 + chips + 城池表 + rankBlock）整段退役；爵位区块并入右表。 */
    ui.openShell({
      title: '👤 君主',
      sub: (cur ? cur.name : '平民') + ' · 声望 ' + U.fmt(s.rep) + ' · ' + s.cities.length + ' 城',
      size: 'xl',
      body: '<div class="lord-split">' +
        '<div class="ls-left"><div class="m-sec">城池一览（' + s.cities.length + '）</div>' +
          (s.cities.length
            ? s.cities.map(function (c2) {
                return '<div class="lord-city' + (c2.id === curCity.id ? ' cur' : '') + '">' +
                  '<span class="ls-nm">🏯 ' + U.escape(c2.name) + '</span>' +
                  '<span class="ls-meta">' + (DATA.CITY_TIER[c2.type] || '自建城') +
                    ' · [' + c2.x + ',' + c2.y + '] · 人口上限 ' + U.fmt(GAME.maxPopOf(c2)) + '</span>' +
                  '<button class="btn sm gold" data-action="lord-city-enter" data-city="' + c2.id + '">进入</button>' +
                  '</div>';
              }).join('')
            : '<div class="gb-empty" style="height:110px;">当前无城池</div>') +
        '</div>' +
        '<div class="ls-right"><div class="m-sec">君主信息</div>' +
        '<table class="tbl lord-tbl"><tbody>' +
          '<tr><td class="k">君主姓名</td><td><b>' + U.escape(s.ruler.name) + '</b>　' +
            '<button class="btn sm" data-action="open-rename-lord">改名</button></td></tr>' +
          '<tr><td class="k">爵位</td><td>' + (cur ? cur.name : '平民') +
            ' <span class="ui-sub">（' + (s.rank || 0) + ' / ' + (DATA.RANK.length - 1) + '）</span>　' +
            (next
              ? '<button class="btn sm' + (chk && chk.ok ? ' gold' : '') + '" data-action="lord-promote" title="' +
                  U.escape(condTitle) + '">晋升：' + next.name + '</button>'
              : '<span style="color:var(--gold-light);">已登顶</span>') +
            '</td></tr>' +
          '<tr><td class="k">声望</td><td style="color:var(--green-ok);">' + U.fmt(s.rep) + '</td></tr>' +
          '<tr><td class="k">人口总和</td><td>' + U.fmt(popNow) + ' / ' + U.fmt(totalPop) + '</td></tr>' +
          '<tr><td class="k">将领总和</td><td>' + s.generals.length + '（名将 ' + heroCount + '）</td></tr>' +
          '<tr><td class="k">月俸支出</td><td>' + U.fmt(salaryTotal) + ' 金 / 7 游戏日' +
            ' <span class="ui-sub">（月俸结算时从各城府库扣除）</span></td></tr>' +
          (lg ? '<tr><td class="k">君主领兵</td><td>Lv' + lg.level + ' · ' +
            ui.genStatusName(lg) + '（不可解雇）</td></tr>' : '') +
          '<tr><td class="k">状态</td><td>正常</td></tr>' +
        '</tbody></table></div>' +
      '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  """
replace_span(UI,
    'ui.openLordInfo = function () {',
    '  /* 资源生产弹窗（原版「资源生产」：含开工率调整） */',
    NEW_LORD,
    'U5 君主面板重做',
    done_marker='class="lord-split"')

# =====================================================================
# ⑧ ui.js：开掉 openProdInfo（资源生产）整段
# =====================================================================
replace_span(UI,
    '  /* 资源生产弹窗（原版「资源生产」：含开工率调整） */',
    '  /* ============================================================\n   * 募兵加速（v28 · 需求 8）',
    '',
    'U6 资源生产退役')

# =====================================================================
# ⑨ ui.js：开掉 openBldgInfo（建筑信息）整段
# =====================================================================
replace_span(UI,
    '  /* 建筑信息弹窗（原版「建筑信息」） */',
    '  /* 资源显示名与图标（模块级共享：野地面板 / 采集面板等多处复用） */',
    '',
    'U7 建筑信息退役')

# =====================================================================
# ⑩ ui.js：开掉 rankBlock（爵位区块并入新君主面板）
# =====================================================================
replace_span(UI,
    '  /* --------- 爵位（v25：抽成区块，君主面板与独立视图共用） --------- */',
    '  ui.rankHTML = function () {',
    '  /* v77：爵位区块（rankBlock）已并入新的君主面板（左列表 / 右信息表），退役。 */\n\n  ',
    'U8 rankBlock 退役')

# =====================================================================
# ⑪ ui.js：君主改名弹窗（仿城池改名）
# =====================================================================
patch(UI,
"""      body: '<div class="ui-sub" style="margin-bottom:6px;">新名字（12 字以内）</div>' +
        '<input type="text" id="rename-city-input" maxlength="12" value="' + U.escape(c.name) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-city">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };""",
"""      body: '<div class="ui-sub" style="margin-bottom:6px;">新名字（12 字以内）</div>' +
        '<input type="text" id="rename-city-input" maxlength="12" value="' + U.escape(c.name) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-city">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* v77（老板）：「君主姓名（给一个改名按钮）」—— 与城池改名同一套小弹窗版式。
     域侧唯一出口 GAME.renameLord（同时改 ruler.name 与君主将领 g.name，两处同源）。 */
  ui.openRenameLord = function () {
    var s = GAME.state;
    ui.openShell({
      title: '✎ 君主改名',
      sub: '原名：' + U.escape(s.ruler.name) + '（8 字以内）',
      size: 'sm',
      body: '<input type="text" id="rename-lord-input" maxlength="8" value="' + U.escape(s.ruler.name) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-lord">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };""",
'U9 君主改名弹窗')

# =====================================================================
# ⑫ ui.js：铁匠铺底栏加「百炼强化」入口
# =====================================================================
patch(UI,
"""      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button>' +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button></div>'
    });
  };
  /* 套装效果一览（从打造面板正文移到独立小窗）——""",
"""      foot: '<div class="m-foot"><button class="btn gold" data-action="open-enhance">⚒ 百炼强化</button>' +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  /* 套装效果一览（从打造面板正文移到独立小窗）——""",
'U10 铁匠铺入口')

# =====================================================================
# ⑬ ui.js：openEnhance（百炼强化界面）
# =====================================================================
patch(UI,
"""  /* 排行榜（原版右下功能入口） */""",
"""  /* ============================================================
   * 百炼强化（v77 · 老板「铁匠铺加入装备强化系统，装备可进行强化」）
   * ------------------------------------------------------------
   * 列出**已拥有**的装备种（背包 + 已穿戴；GAME.enhList），每行给下一级成本。
   * 等级与效果都走唯一出口（GAME.enhOf / genEquipBonus），这里只做呈现。
   * ============================================================ */
  ui.openEnhance = function () {
    if (GAME.forgeLevel() <= 0) {
      ui.openShell({
        title: '⚒ 百炼强化', size: 'sm',
        body: '<div class="q-empty">尚未建造铁匠铺。<br>在城内空地上建造「铁匠铺」后即可打造与强化装备。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var ids = GAME.enhList();
    var perLv = Math.round(((DATA.ENHANCE || {}).perLv || 0.08) * 100);
    var rows = ids.map(function (id) {
      var it = DATA.EQUIP[id], lv = GAME.enhOf(id), max = GAME.enhMax();
      var cost = lv < max ? GAME.enhCost(id) : null;
      var okA = cost ? GAME.canAfford(cost) : false;
      return '<div class="enh-row">' +
        '<span class="enh-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="enh-nm">' + U.escape(it.name) +
          (it.set && DATA.SETS[it.set] ? ' <span class="ui-sub">（' + U.escape(DATA.SETS[it.set].name) + '）</span>' : '') +
          '<span class="enh-tag">+' + lv + '</span>' +
          '<div class="enh-cost">' + (cost ? ('下一级 ' + GAME.costString(cost)) : ('已至 +' + max + '（满级）')) +
            '　<span class="ui-sub">每级全属性 +' + perLv + '%（同种装备共享）</span></div></span>' +
        (cost
          ? '<button class="btn sm' + (okA ? ' gold' : '') + '" data-action="enhance-item" data-item="' + id + '"' +
              (okA ? '' : ' disabled') + '>强化 +' + (lv + 1) + '</button>'
          : '<span class="op-done">满级</span>') +
        '</div>';
    }).join('') || '<div class="q-empty">背包与穿戴中还没有可强化的装备（先在左侧打造几件）。</div>';
    ui.openShell({
      title: '⚒ 百炼强化',
      sub: '同种装备共享强化等级（新打造的继承）　满级 +' + GAME.enhMax() + '　黄金 ' + U.numText(GAME.state.res.gold || 0, 0),
      size: 'lg',
      body: '<div class="enh-list">' + rows + '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* 排行榜（原版右下功能入口） */""",
'U11 百炼界面')

# =====================================================================
# ⑭ ui.js：将领档案加「内功」行
# =====================================================================
patch(UI,
"""    var statusTag74 = (g.status && g.status !== 'idle')
      ? '<span class="gp-stag">' + U.escape(ui.genStatusName(g)) +
        (g.cityId && GAME.cityById(g.cityId) ? '·' + U.escape(GAME.cityById(g.cityId).name) : '') + '</span>'
      : '';""",
"""    var statusTag74 = (g.status && g.status !== 'idle')
      ? '<span class="gp-stag">' + U.escape(ui.genStatusName(g)) +
        (g.cityId && GAME.cityById(g.cityId) ? '·' + U.escape(GAME.cityById(g.cityId).name) : '') + '</span>'
      : '';
    /* v77（老板）：内功修炼体系 —— 档案里加一行「内功 · 功法 N 重（属性 +X）」，
       悬停给出特性名与修习规则。加成本体在 GAME.genAttrs（唯一出口）。 */
    var ngLine77 = '';
    if (g.ng && g.ng.id) {
      var ngD77 = null;
      (DATA.NEIGONG || []).forEach(function (x) { if (x.id === g.ng.id) ngD77 = x; });
      if (ngD77) {
        var ATTRS77 = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度' };
        ngLine77 = '<span class="gp-sub gp-ng" title="内功特性「' + ngD77.trait + '」：' +
          ATTRS77[ngD77.attr] + ' +' + ngD77.per + '/重，当前 +' + (ngD77.per * g.ng.lv) +
          '。修习同门秘籍可精进（最高 ' + (ngD77.maxLv || 10) + ' 重），换书即转修。">内功 · <b>' +
          U.escape(ngD77.name) + '</b> ' + g.ng.lv + ' 重（' + ATTRS77[ngD77.attr] + ' +' +
          (ngD77.per * g.ng.lv) + '）</span>';
      }
    }""",
'U12 内功计算')

patch(UI,
"""          '<span class="gp-sub">' + U.escape(rkDesc74) +
            (atCap ? '　<span class="gd-warn">已达资质上限</span>' : '') + '</span>' +
          '<span class="gp-exprow">' +""",
"""          '<span class="gp-sub">' + U.escape(rkDesc74) +
            (atCap ? '　<span class="gd-warn">已达资质上限</span>' : '') + '</span>' +
          ngLine77 +
          '<span class="gp-exprow">' +""",
'U13 内功渲染')

# =====================================================================
# ⑮ ui.js：装备详情加「百炼」行 + 强化入口
# =====================================================================
patch(UI,
"""    html += '<div class="attr"><span class="k">品质</span><span class="v">' + (DATA.Q_NAME[it.q] || "") + ' ' + '★'.repeat(it.q) + '</span></div>';
    html += '<div class="attr"><span class="k">属性</span><span class="v good">' + GAME.equipDesc(it) + '</span></div>';""",
"""    html += '<div class="attr"><span class="k">品质</span><span class="v">' + (DATA.Q_NAME[it.q] || "") + ' ' + '★'.repeat(it.q) + '</span></div>';
    /* v77：百炼强化等级（同种共享）——装备详情一眼可见 */
    var eLv77 = GAME.enhOf ? GAME.enhOf(itemId) : 0;
    if (eLv77) {
      html += '<div class="attr"><span class="k">百炼</span><span class="v good">+' + eLv77 +
        '（装备属性 +' + Math.round(eLv77 * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）</span></div>';
    }
    html += '<div class="attr"><span class="k">属性</span><span class="v good">' + GAME.equipDesc(it) + '</span></div>';""",
'U14 装备详情百炼行')

patch(UI,
"""      html += '<div style="text-align:center;margin-top:10px;"><button class="btn red" data-action="salvage-equip" data-key="' + itemId + '">拆解回收</button></div>';
    } else {
      html += '<div class="note">此件不在背包中（可能正穿在将领身上）。可在「将领」面板卸下。</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 材料详情 */""",
"""      html += '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn sm gold" data-action="open-enhance" style="margin-right:6px;">⚒ 前往铁匠铺强化</button>' +
        '<button class="btn red" data-action="salvage-equip" data-key="' + itemId + '">拆解回收</button></div>';
    } else {
      html += '<div class="note">此件不在背包中（可能正穿在将领身上）。可在「将领」面板卸下。</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 材料详情 */""",
'U15 装备详情强化入口')

# =====================================================================
# ⑯ ui.js：附属野地弹窗高亮所选行（配合下拉框）
# =====================================================================
patch(UI,
"""    var rows = wilds.map(function (w) {
      var t = DATA.TERRAIN[w.type];""",
"""    var rows = wilds.map(function (w, wi) {
      var t = DATA.TERRAIN[w.type];""",
'U16 野地行索引')

patch(UI,
"""      return '<tr><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +""",
"""      return '<tr' + (wi === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +""",
'U17 野地高亮')

# =====================================================================
# ⑰ main.js：事件注册与旧动作退役
# =====================================================================
patch(MAIN,
"""      case 'lord-city-goto': (function () { var el2 = document.getElementById('lord-city-switch'); if (el2) { ui.setCity(el2.value); GAME.refreshAll(); ui.toast('已切换至 ' + el2.options[el2.selectedIndex].text); } })(); break;
""",
"""""",
'M1 撤 lord-city-goto')

patch(MAIN,
"""      /* 原版三段式信息区 & 功能入口 */
      case 'open-lord': ui.openLordInfo(); break;""",
"""      /* 原版三段式信息区 & 功能入口 */
      case 'open-lord': ui.openLordInfo(); break;
      /* v77（老板）：君主面板 —— 进入城池（直跳该城城内界面）/ 晋升 / 改名 */
      case 'lord-city-enter': (function () {
        ui.closeModal();
        ui.setCity(el.dataset.city);
        ui.setView('city');
        GAME.refreshAll();
      })(); break;
      case 'lord-promote': GAME.doLordPromote(); break;
      case 'open-rename-lord': ui.openRenameLord(); break;
      case 'do-rename-lord': GAME.doRenameLord(); break;
      /* v77：附属野地下拉框（资源区）—— 选择即记录，进入按钮开野地界面 */
      case 'wild-pick': ui._wildSel = Number(el.value) || 0; break;""",
'M2 君主新动作')

patch(MAIN,
"""      case 'open-bldg-info': ui.openBldgInfo(); break;
      case 'open-prod-info': ui.openProdInfo(); break;
      case 'open-wilds': ui.openWilds(); break;""",
"""      /* v77（老板）：建筑信息 / 资源生产两个入口随城池属性右三按钮一并退役；
         「附属野地」改由资源区下拉框的「进入」按钮触发（动作名不变）。 */
      case 'open-wilds': ui.openWilds(); break;""",
'M3 三按钮分发退役')

patch(MAIN,
"""      case 'jump-cell': GAME.doJumpCell(Number(el.dataset.idx)); break;
""",
"""""",
'M4 撤 jump-cell')

patch(MAIN,
"""      case 'open-inn': ui.openInn(); break;
      case 'open-forge': ui.openForge(); break;""",
"""      case 'open-inn': ui.openInn(); break;
      case 'open-forge': ui.openForge(); break;
      /* v77：百炼强化（铁匠铺底栏入口 + 装备详情入口） */
      case 'open-enhance': ui.openEnhance(); break;
      case 'enhance-item': GAME.doEnhance(el.dataset.item); break;""",
'M5 强化动作')

patch(MAIN,
"""        if (after === 'city') { ui.setCity(el.dataset.v); GAME.refreshAll(); }
        else if (after === 'workrate') GAME.doSetWorkRate(el.dataset.k, Number(el.dataset.v));
        else if (after === 'region') ui.setCreate();""",
"""        if (after === 'city') { ui.setCity(el.dataset.v); GAME.refreshAll(); }
        /* v77（老板）：资源生产入口退役 —— 开工率调整 UI（after='workrate'）一并下线，
           机制与取值保留在 state.workRate（默认 100%，产物照常计算）。 */
        else if (after === 'region') ui.setCreate();""",
'M6 撤开工率分支')

patch(MAIN,
"""  /* 建筑信息弹窗 → 定位到城内地块 */
  GAME.doJumpCell = function (idx) {
    ui.closeModal();
    ui.setView('city');
    ui.openBuildModal(idx);
  };
  /* 开工率调整（原版资源生产面板） */
  GAME.doSetWorkRate = function (res, v) {
    var s = GAME.state;
    s.workRate = s.workRate || {};
    s.workRate[res] = Number(v);
    ui.toast('开工率已调整为 ' + v + '%');
    GAME.refreshAll();
    ui.openProdInfo();      // 刷新面板显示
  };""",
"""  /* v77（老板）：doJumpCell（建筑信息 → 定位地块）与 doSetWorkRate（开工率调整）
     随「建筑信息 / 资源生产」两个入口退役 —— 城内地块本就点得到，无须跳转器。 */""",
'M7 撤两个旧函数')

patch(MAIN,
"""  GAME.doPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) GAME.refreshAll();
  };""",
"""  GAME.doPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) GAME.refreshAll();
  };
  /* v77（老板）：君主面板 —— 晋升 / 改名（做完就地重开面板，立刻看到新状态） */
  GAME.doLordPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }
  };
  GAME.doRenameLord = function () {
    var inp = document.getElementById('rename-lord-input');
    var r = GAME.renameLord(inp ? inp.value : '');
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }
  };
  /* v77：百炼强化（唯一出口 GAME.enhance） */
  GAME.doEnhance = function (itemId) {
    var r = GAME.enhance(itemId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openEnhance(); }
  };""",
'M8 三个新包装')

print('\nUI 层 v77 补丁执行完毕。')
