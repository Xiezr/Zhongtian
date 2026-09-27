# -*- coding: utf-8 -*-
"""v89.144 老板 4 条 —— ui.js 补丁（分段落盘 · 幂等守卫）
   ① 斗将顶部固定一行（btDuelLine 唯一出口 + btDuelBarHTML）
   ② 上限/清空挪进每个兵种行（表头改「操作」；新出口 expTroopMaxOf/expTroopTipOf）
   ③ 「军队校场扩容」独立页签（MARCH_TABS + marchExpandHTML 搬家）
   ④ 目标下拉：定宽类名 + 空首项（默认空）+ 去「共 N」备注 + 按钮 disabled 只看 pick
"""
import io, os, sys

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)
steps = []

def save(tag):
    assert '\r\n' not in s, '行尾被写成 CRLF'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag + '  len=' + str(len(s)))

def rep(old, new, tag, done_when=None, count=1):
    """幂等守卫：done_when（新特征串）已在 → 跳过"""
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ============================================================
# ① 斗将顶部固定一行
# ============================================================
rep(
"""  ui.btDuelHTML = function (rec) {
    var d = (rec && rec.sim && rec.sim.duel) || null;
    if (!d || !d.done) return '';
    var side = (d.winner === 'atk') ? '我方' : '敌方';
    var pct = Math.round((d.bonusPct == null ? 0.10 : d.bonusPct) * 100);
    var line = '⚔ 战前斗将：' + (d.rounds || 3) + ' 合，' + side + '将领 ' + (d.winnerName || '') +
      ' 胜（' + (d.wa || 0) + ' : ' + (d.wb || 0) + '）· 其全军 +' + pct + '%（限本战）';
    return '<div class="bt-ev duel">' + U.escape(line) + '</div>';
  };""",
"""  /* v89.144（老板 1）：斗将结果**文案的唯一出口**（顶部固定行与回合战况行同源 —— 改文案只改这里） */
  ui.btDuelLine = function (rec) {
    var d = (rec && rec.sim && rec.sim.duel) || null;
    if (!d || !d.done) return '';
    var side = (d.winner === 'atk') ? '我方' : '敌方';
    var pct = Math.round((d.bonusPct == null ? 0.10 : d.bonusPct) * 100);
    return '⚔ 战前斗将：' + (d.rounds || 3) + ' 合，' + side + '将领 ' + (d.winnerName || '') +
      ' 胜（' + (d.wa || 0) + ' : ' + (d.wb || 0) + '）· 其全军 +' + pct + '%（限本战）';
  };
  ui.btDuelHTML = function (rec) {
    var line = ui.btDuelLine(rec);
    return line ? '<div class="bt-ev duel">' + U.escape(line) + '</div>' : '';
  };
  /* v89.144（老板 1）：「顶部固定一行结果」—— 战场弹窗最顶（在 .bt-top 之上）的常驻一行；
     不再受回合战况 64 行裁剪影响，也不再有"要滚到底才看到"的问题。 */
  ui.btDuelBarHTML = function (rec) {
    var line = ui.btDuelLine(rec);
    return line ? '<div class="bt-duelbar">' + U.escape(line) + '</div>' : '';
  };""",
    '①-1 btDuelLine 唯一出口 + 顶部行 HTML',
    done_when='ui.btDuelBarHTML = function')

rep(
"""    return ui.btTopHTML(rec, snap) + ui.btBoardHTML(snap) +
      '<div class="bt-log" id="bt-log">' + ui.btDuelHTML(rec) + '</div>';""",
"""    return ui.btDuelBarHTML(rec) + ui.btTopHTML(rec, snap) + ui.btBoardHTML(snap) +
      '<div class="bt-log" id="bt-log">' + ui.btDuelHTML(rec) + '</div>';""",
    '①-2 battlefieldHTML 顶部接入斗将行',
    done_when='return ui.btDuelBarHTML(rec) + ui.btTopHTML(rec, snap)')

save('① 斗将顶部行')

# ============================================================
# ② 上限/清空 → 每兵种行
# ============================================================
rep(
"""    var troopBlock =
      '<table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
      '</colgroup><thead><tr>' +
        '<th>兵种</th><th class="num">拥有</th><th class="ctr">出征数量</th><th class="ctr">上限</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).map(function (id) {
        var tr = DATA.TROOPS[id] || {};
        var own = (c.army && c.army[id]) || 0;
        var off = own > 0 ? '' : ' off';
        return '<tr class="et-row' + off + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + own.toLocaleString() + '</td>' +
          '<td class="et-in"><input type="number" id="exp-' + id + '" min="0" max="' + own + '" value="0"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
          '<td class="et-act"><button class="btn sm" data-action="exp-max" data-troop="' + id + '"' +
            (own > 0 ? '' : ' disabled') + '>全</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';""",
"""    /* v89.144（老板 2）：「上限和清空……放在每个兵种行后边，对单独兵种数量进行操作」——
       每行 = [上限][清空] 两键：
         · 上限 = min(该兵种拥有, 总额度 − **其他行**已填)（唯一出口 ui.expTroopMaxOf；
           不限（无校场等）→ 拥有数）；
         · 清空 = 只清该行（不影响其他兵种）。
       分配顺序 = 玩家点哪行算哪行（没有"全局一键分配"，也就无需约定强兵优先之类）。 */
    var troopBlock =
      '<table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
      '</colgroup><thead><tr>' +
        '<th>兵种</th><th class="num">拥有</th><th class="ctr">出征数量</th><th class="ctr">操作</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).map(function (id) {
        var tr = DATA.TROOPS[id] || {};
        var own = (c.army && c.army[id]) || 0;
        var off = own > 0 ? '' : ' off';
        return '<tr class="et-row' + off + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + own.toLocaleString() + '</td>' +
          '<td class="et-in"><input type="number" id="exp-' + id + '" min="0" max="' + own + '" value="0"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
          '<td class="et-act"><button class="btn sm" data-action="exp-max" data-troop="' + id + '"' +
            ' title="' + U.escape(ui.expTroopTipOf(c, id, ui._expMode)) + '"' +
            (own > 0 ? '' : ' disabled') + '>上限</button>' +
            '<button class="btn sm" data-action="exp-zero" data-troop="' + id + '"' +
            (own > 0 ? '' : ' disabled') + '>清空</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';""",
    '②-1 每行 [上限][清空] + 表头改操作',
    done_when='data-action="exp-zero" data-troop=')

rep(
"""    html += '<div class="exp-sec exp-a-troops"><div class="exp-sec-t" style="display:flex;align-items:center;gap:8px;">派遣兵力 · 兵种数量' +
      /* v89.142（老板 6）：表头「全带」→「**上限**」—— 点击按"本次出征的总人数上限"自动填入
         （口径见 ui.expFillCapOf 唯一出口；title 写明本次的算法）。 */
      '<button class="btn sm" data-action="exp-fill-all" title="' + U.escape(ui.expFillTipOf(c, cur.id)) + '">上限</button>' +
      '<button class="btn sm" data-action="exp-clear-all">清空</button></div>';""",
"""    /* v89.144（老板 2）：标题栏的两枚全局键（旧「上限 / 清空」）**整条退役** ——
       两个操作挪进每个兵种行（见 troopBlock），这里只留标题。 */
    html += '<div class="exp-sec exp-a-troops"><div class="exp-sec-t">派遣兵力 · 兵种数量</div>';""",
    '②-2 标题栏两键退役',
    done_when="'<div class=\"exp-sec exp-a-troops\"><div class=\"exp-sec-t\">派遣兵力 · 兵种数量</div>'")

rep(
"""    return '上限 = 本城出征容量 ' + U.numText(cap, 0) + '（校场 ×1万 × 各种加成）';
  };""",
"""    return '上限 = 本城出征容量 ' + U.numText(cap, 0) + '（校场 ×1万 × 各种加成）';
  };
  /* ============================================================
   * v89.144（老板 2）：「上限和清空……放在每个兵种行后边，对单独兵种数量进行操作」
   * ------------------------------------------------------------
   * **行内「上限」的唯一出口**（按钮 / 探针 / 断言都读它）：
   *   该行上限 = min(该兵种拥有, 总额度 − **其他行**已填合计)；
   *   总额度 = ui.expFillCapOf（同一把尺：野地派驻余量 / 目标城余量 / 校场容量 / 不限）；
   *   不限（null）→ 上限 = 该兵种拥有数（旧「全带」语义）。
   * 逐行点「上限」= 玩家自己决定分配顺序（点哪行算哪行）—— 不再有"全局一键分配"，
   * 因此也不存在"强兵优先 / 表序优先"之类需要额外约定的分配序（老板 2 明确不要）。
   * ============================================================ */
  ui.expTroopMaxOf = function (troopId, city, modeId) {
    var ei = document.getElementById('exp-' + troopId);
    var own = ei ? (Number(ei.max) || 0) : 0;
    var cap = ui.expFillCapOf(city || GAME.currentCity(), ui._expRes, modeId);
    if (cap == null) return own;
    var used = 0;
    Object.keys(DATA.TROOPS).forEach(function (id) {
      if (id === troopId) return;
      var o = document.getElementById('exp-' + id);
      if (o) used += Number(o.value) || 0;
    });
    return Math.max(0, Math.min(own, cap - used));
  };
  /* 行内「上限」按钮的悬停说明（数字同源：拥有 + 额度口径，含本次总额度的来源） */
  ui.expTroopTipOf = function (city, troopId, modeId) {
    var ct = city || GAME.currentCity();
    var own = (ct && ct.army && ct.army[troopId]) || 0;
    var cap = ui.expFillCapOf(ct, ui._expRes, modeId);
    if (cap == null) return '上限：该兵种全部拥有数 ' + U.numText(own, 0) + '（本次不设总上限）';
    return '上限 = min(该兵种拥有 ' + U.numText(own, 0) + '，本次总额度 ' + U.numText(cap, 0)
      + ' − 其他兵种已填)。　' + ui.expFillTipOf(ct, modeId);
  };""",
    '②-3 expTroopMaxOf / expTroopTipOf 新出口',
    done_when='ui.expTroopMaxOf = function')

save('② 行内上限清空')

# ============================================================
# ③ 军队校场扩容 → 独立页签（军务总览右边）
# ============================================================
rep(
"""  ui.MARCH_TABS = [['over', '军务总览'], ['act', '出征'], ['exp', '出征战术'], ['def', '防守战术'], ['beacon', '烽火'], ['affairs', '军务处']];""",
"""  /* v89.144（老板 3）：「编制 · 出战能力」改名**军队校场扩容**、整块搬出出征页，
     作为独立页签放在**军务总览右边**。 */
  ui.MARCH_TABS = [['over', '军务总览'], ['expand', '军队校场扩容'], ['act', '出征'], ['exp', '出征战术'], ['def', '防守战术'], ['beacon', '烽火'], ['affairs', '军务处']];""",
    '③-1 MARCH_TABS 插 expand',
    done_when="['expand', '军队校场扩容']")

rep(
"""    if (tab === 'act') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchActHTML() + '</div>';""",
"""    if (tab === 'expand') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchExpandHTML() + '</div>';
    if (tab === 'act') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchActHTML() + '</div>';""",
    '③-2 marchesHTML 分支',
    done_when="if (tab === 'expand') return")

# ③-3 出征页删卡 + 变量
rep(
"""    var anyTarget = groups.some(function (g) { return g.targets.length > 0; });
    var cap = GAME.battle.marchCapOf(c);
    var xcLv = GAME.buildingLevel(c, 'xiaochang') || 0;
    var jx = GAME.jieyueExpandOf(c, 'xc');
    var _jxTxt = (jx.used >= jx.max)
      ? '本城已满 ' + jx.used + '/' + jx.max
      : '本城 ' + jx.used + '/' + jx.max + '　持符 ' + GAME.jieyueOf();""",
"""    /* v89.144（老板 3）：本城出征容量与校场扩编的数据**整块随卡片搬去独立页签**
       （ui.marchExpandHTML）—— 本页只剩"选目标 → 进入军事行动"。 */""",
    '③-3 出征页变量清理',
    done_when='本页只剩"选目标 → 进入军事行动"')

rep(
"""      /* v89.132 的节钺 · 校场扩编入口原在校场面板 —— v89.133 校场面板退役，入口迁到这里 */
      '<div class="story-card"><div class="gold-heading">🪓 编制 · 出战能力' +
        ui.help('出征容量 = 校场等级 × 1 万 × 加成；节钺 · 校场扩编每次 +1 万人马'
          + '（等效校场 +1 级，每城至多 ' + ((DATA.JIEYUE || {}).xcMax || 2) + ' 次）。\\n'
          + '节钺来源：首占名城 / 爵位赏赐（黄金买不到）。') + '</div>' +
      '<div class="res-line"><span class="lbl">本城出征容量</span><span class="val">' +
        U.numText(cap, 0) + ' 人马' + (xcLv > 0 ? '（校场 Lv' + xcLv + ' + 扩编 ' + (c.jieyueXc || 0) + '）'
          : '（尚无校场）') + '</span></div>' +
      '<div class="auto-line"><button class="btn" data-action="jieyue-xc" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 校场扩编（' + _jxTxt + '）</button>' +
        '<span class="ui-sub">出征容量 +1 万人马（等效校场 +1 级）</span></div></div>' +
""",
"""      /* v89.144（老板 3）：原「编制 · 出战能力」卡片已搬去独立页签「军队校场扩容」
         （ui.marchExpandHTML，军务总览右边）。 */
""",
    '③-4 出征页删卡',
    done_when='原「编制 · 出战能力」卡片已搬去独立页签')

# ③-5 marchExpandHTML 新函数（插在 marchExpHTML 之前）
rep(
"""  /* —— 出征页（v89.109 · 老板「军务的出征菜单不是给地址栏的，而是设置出征战术的地方」）：""",
"""  /* ============================================================
   * v89.144（老板 3）：「军务，出征这里，编制·出战能力改成**军队校场扩容**，
   *   整体挪到作为一个单独菜单放在**军务总览右边**」
   * ------------------------------------------------------------
   * 独立页签（march-tab 动作复用）· 内容 = 本城出征容量 + 节钺 · 校场扩编入口。
   * 数据全读既有唯一出口（marchCapOf / buildingLevel / jieyueExpandOf / jieyueOf），
   * 界面不自己算任何口径。
   * ============================================================ */
  ui.marchExpandHTML = function () {
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    var cap = GAME.battle.marchCapOf(c);
    var xcLv = GAME.buildingLevel(c, 'xiaochang') || 0;
    var jx = GAME.jieyueExpandOf(c, 'xc');
    var _jxTxt = (jx.used >= jx.max)
      ? '本城已满 ' + jx.used + '/' + jx.max
      : '本城 ' + jx.used + '/' + jx.max + '　持符 ' + GAME.jieyueOf();
    return '<div class="story-card"><div class="gold-heading">🪓 军队校场扩容' +
        ui.help('出征容量 = 校场等级 × 1 万 × 加成；节钺 · 校场扩编每次 +1 万人马'
          + '（等效校场 +1 级，每城至多 ' + ((DATA.JIEYUE || {}).xcMax || 2) + ' 次）。\\n'
          + '节钺来源：首占名城 / 爵位赏赐（黄金买不到）。') + '</div>' +
      '<div class="res-line"><span class="lbl">本城出征容量</span><span class="val">' +
        U.numText(cap, 0) + ' 人马' + (xcLv > 0 ? '（校场 Lv' + xcLv + ' + 扩编 ' + (c.jieyueXc || 0) + '）'
          : '（尚无校场）') + '</span></div>' +
      '<div class="auto-line"><button class="btn" data-action="jieyue-xc" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 校场扩编（' + _jxTxt + '）</button>' +
        '<span class="ui-sub">出征容量 +1 万人马（等效校场 +1 级）</span></div></div>';
  };

  /* —— 出征页（v89.109 · 老板「军务的出征菜单不是给地址栏的，而是设置出征战术的地方」）：""",
    '③-5 marchExpandHTML 新函数',
    done_when='ui.marchExpandHTML = function')

save('③ 军队校场扩容页签')

# ============================================================
# ④ 目标下拉：固定统一 + 默认空 + 去备注
# ============================================================
rep(
"""    var rows = groups.map(function (g) {
      var sel = (ui._actPick && ui._actPick.grp === g.key) ? ui._actPick.idx : -1;
      var ctrl = g.targets.length
        ? '<select class="city-select" data-action="exp-act-pick" data-grp="' + g.key + '">' +
            g.targets.map(function (o, i) {
              return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
                U.escape(o.label) + '</option>';
            }).join('') + '</select>'
        : '<span class="ui-sub" style="flex:1;">（无）</span>';
      var more = (g.total > g.targets.length)
        ? '<span class="ui-sub" style="white-space:nowrap;">共 ' + g.total + ' · 列最近 ' + g.targets.length + '</span>'
        : '';
      return '<div class="exp-sel" style="margin:4px 0;"><label>' + g.label + '</label>' + ctrl + more + '</div>';
    }).join('');""",
"""    /* v89.144（老板 4）：
       · **固定下拉框位置与长度** —— 5 行用同一结构（.act-row：label 定宽 + 下拉定宽 20 个中文），
         起点一律对齐「我方城池」那行；
       · **默认显示为空** —— 每行首项 = 空 option（不预选）；actPickOf 也不再兜底选第一个；
       · 去掉「共 N · 列最近 24」备注（目标只在（对应行的）下拉框里出现）；
       · 选定后立刻 live 刷新（main.js 的 exp-act-pick → GAME.refreshView）——
         在**另一行**再选一个目标时，原来那一行自动回到空（_actPick 只有一份）。 */
    var rows = groups.map(function (g) {
      var sel = (ui._actPick && ui._actPick.grp === g.key) ? ui._actPick.idx : -1;
      var ctrl = g.targets.length
        ? '<select class="city-select act-sel" data-action="exp-act-pick" data-grp="' + g.key + '">' +
            '<option value=""' + (sel < 0 ? ' selected' : '') + '></option>' +
            g.targets.map(function (o, i) {
              return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
                U.escape(o.label) + '</option>';
            }).join('') + '</select>'
        : '<span class="ui-sub act-none">（无）</span>';
      return '<div class="exp-sel act-row"><label>' + g.label + '</label>' + ctrl + '</div>';
    }).join('');""",
    '④-1 rows 定宽/空首项/去备注',
    done_when='class="city-select act-sel"')

rep(
"""      '<div class="exp-foot" style="justify-content:center;">' +
        '<button class="btn gold" data-action="exp-act-go"' + (anyTarget ? '' : ' disabled') +
          ' style="min-width:240px;font-size:var(--fs-h1);">⚔️ 进入军事行动 →</button></div>';""",
"""      '<div class="exp-foot" style="justify-content:center;">' +
        /* v89.144（老板 4）：按钮可用性只看**是否真的选了目标**（默认空 → 置灰；
           选定后 live 刷新即亮起）。 */
        '<button class="btn gold" data-action="exp-act-go"' + (pick ? '' : ' disabled') +
          ' style="min-width:240px;font-size:var(--fs-h1);">⚔️ 进入军事行动 →</button></div>';""",
    '④-2 按钮 disabled 只看 pick',
    done_when="'<button class=\"btn gold\" data-action=\"exp-act-go\"' + (pick ? '' : ' disabled')")

rep(
"""  ui.actPickOf = function () {
    var groups = ui.actTargetGroups(GAME.currentCity());
    var ok = false;
    if (ui._actPick) {
      groups.forEach(function (g) {
        if (g.key === ui._actPick.grp && g.targets[ui._actPick.idx]) ok = true;
      });
    }
    if (!ok) {
      ui._actPick = null;
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].targets.length) { ui._actPick = { grp: groups[i].key, idx: 0 }; break; }
      }
    }
    if (!ui._actPick) return null;
    var g2 = null;
    groups.forEach(function (x) { if (x.key === ui._actPick.grp) g2 = x; });
    if (!g2 || !g2.targets[ui._actPick.idx]) return null;
    return { tg: g2.targets[ui._actPick.idx].tg, label: g2.targets[ui._actPick.idx].label, grp: g2.key };
  };""",
"""  ui.actPickOf = function () {
    /* v89.144（老板 4）：「默认显示为空」—— **删掉"兜底选第一个有货组第一项"**：
       只有玩家真的在下拉里选过（_actPick 落库）才返回目标；目标失效则自动清空。 */
    if (!ui._actPick) return null;
    var groups = ui.actTargetGroups(GAME.currentCity());
    var g2 = null;
    groups.forEach(function (x) { if (x.key === ui._actPick.grp) g2 = x; });
    if (!g2 || !g2.targets[ui._actPick.idx]) { ui._actPick = null; return null; }
    return { tg: g2.targets[ui._actPick.idx].tg, label: g2.targets[ui._actPick.idx].label, grp: g2.key };
  };""",
    '④-3 actPickOf 去兜底',
    done_when='**删掉"兜底选第一个有货组第一项"**')

save('④ 目标下拉')

print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))
