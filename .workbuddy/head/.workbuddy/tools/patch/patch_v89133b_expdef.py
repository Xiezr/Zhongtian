# -*- coding: utf-8 -*-
"""v89.133 补丁 P1b：出征战术页（第 13 条）+ 防守双小页（第 14 条）+ 烽火（第 15 条）
- ui.tacticBlockOf：chip 按钮组 → **下拉框**（select，change 走全局委托）+ 两列网格
- ui.tacticChip / ui.tacticBlockHTML：chip 退役；全表包 .tac-grid（两列）
- ui.marchExpHTML：去掉在途行军队列；接上练兵块（trainBlockHTML）
- ui.marchDefHTML：页内两小页（全境防御 / 防守战术，ui._defSub）
- 烽火页：删指路备注行
- main.js：tactic-set 支持 select/checkbox；change 委托扩展 checkbox；新增 def-sub
- index.html：.tac-grid / .tac-line / .def-tabs 样式
跑：python .workbuddy/tools/patch/patch_v89133b_expdef.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ': 锚点命中 ' + str(n) + ' 次'
    return s.replace(old, new)

def func_span(s, sig, tag):
    i = s.find(sig)
    assert i >= 0, tag + ' 未找到'
    assert s.count(sig) == 1, tag + ' 签名不唯一'
    j = s.find('{', i)
    depth = 0
    k = j
    while k < len(s):
        c = s[k]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                break
        k += 1
    end = s.find(';', k)
    assert end > 0 and s[k:end + 1].strip() == '};', tag + ' 尾部异常: ' + repr(s[k:end + 1])
    return i, end + 1

ui = rd('js/ui.js')

# ============ 1) tacticBlockOf → 下拉式 ============
i, e = func_span(ui, 'ui.tacticBlockOf = function (side, id) {', 'tacticBlockOf')
new_blk = r'''ui.tacticBlockOf = function (side, id) {
    side = side === 'def' ? 'def' : 'atk';
    var isDef = side === 'def';
    var tr = DATA.TROOPS[id];
    var set = GAME.tacticsOf(side)[id] || {};
    var curS = set.s || (isDef ? 'hold' : 'advance');
    var curT = (typeof set.t === 'string') ? set.t : '';
    var sortieOn = !!set.sortie;
    var ids = ui.tacticTroopIds();
    var tgt = [{ v: '', label: '自动' }].concat(ids.map(function (x) {
      return { v: x, label: DATA.TROOPS[x].name };
    })).concat([{ v: DATA.TARGET_WALL, label: '⚙️ ' + DATA.WALL_TOWER.name }]);
    /* ============================================================
     * v89.133（v89.128 第二批第 13 条 · 老板）：「军务中出征战术，动作和目标均以下拉框
     *   显示，不直接全部列出，分左右两列显示」——
     *   chip 按钮组（一排 3~6 个）→ **原生 select**；行内只留「名称 · 动作 · 目标」（防守侧 + 出城）。
     * 一份实现两处宿主：**出征战术页**与**页内弹窗**（openTacticModal 复用本函数）——
     *   change 由 main.js 的全局委托转 GAME.action（与页内其它 select 同一机制）。
     * ============================================================ */
    var sel = function (k, cur, opts) {
      return '<select class="city-select tl-sel" data-action="tactic-set" data-tside="' + side +
        '" data-troop="' + id + '" data-f="' + k + '">' +
        opts.map(function (o) {
          return '<option value="' + o.v + '"' + (cur === o.v ? ' selected' : '') + '>' +
            U.escape(o.label) + '</option>';
        }).join('') + '</select>';
    };
    return '<div class="tac-line">' +
      '<span class="tl-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</span>' +
      sel('s', curS, DATA.STANCES.map(function (st) { return { v: st.id, label: st.icon + st.name }; })) +
      sel('t', curT, tgt) +
      (isDef ? '<label class="tl-sortie" title="出城迎战：出城部队前出到城墙之外 —— 攻方必须先把它打完，'
        + '才够得着城墙；它也吃不到城墙护佑">' +
        '<input type="checkbox" data-action="tactic-set" data-tside="' + side + '" data-troop="' + id +
        '" data-f="sortie"' + (sortieOn ? ' checked' : '') + '>出城</label>' : '') +
      '</div>';
  };'''
ui = ui[:i] + new_blk + ui[e:]

# ============ 2) tacticChip 退役 ============
i, e = func_span(ui, 'ui.tacticChip = function (side, troop, field, val, label, on) {', 'tacticChip')
tomb = ("  /* ⛔ v89.133 退役：`tacticChip`（chip 按钮组）—— 第 13 条改下拉框后无调用点。\n"
        "     原实现：`<span class=\"chip\" data-action=\"tactic-set\" data-f=… data-v=…>`（v89.109 版）。 */\n")
ui = ui[:i] + tomb + ui[e:]

# ============ 3) tacticBlockHTML 包两列网格 ============
old_tb = ("  ui.tacticBlockHTML = function (side) {\n"
          "    return ui.tacticTroopIds().map(function (id) { return ui.tacticBlockOf(side, id); }).join('');\n"
          "  };\n")
new_tb = ("  ui.tacticBlockHTML = function (side) {\n"
          "    /* v89.133（第 13 条）：**分左右两列** —— 每个兵种一行（名称 · 动作 · 目标）。 */\n"
          "    return '<div class=\"tac-grid\">' +\n"
          "      ui.tacticTroopIds().map(function (id) { return ui.tacticBlockOf(side, id); }).join('') + '</div>';\n"
          "  };\n")
ui = rep1(ui, old_tb, new_tb, '3 tacticBlockHTML')

# ============ 4) marchExpHTML 重写 ============
i, e = func_span(ui, 'ui.marchExpHTML = function () {', 'marchExpHTML')
new_exp = r'''ui.marchExpHTML = function () {
    /* ============================================================
     * v89.133（v89.128 第二批第 13 条 · 老板）：「军务中出征战术……**不要在途的行军队列**」——
     *   在途队列本页撤除（在途信息仍在「军务总览 · ④ 行军」段，一处不丢）。
     * 页面 = 出征战术（两列下拉）+ 练兵块（校场面板退役后演武/阅兵的新家）。
     * ============================================================ */
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    return '<div class="story-card"><div class="gold-heading">⚔️ 出征战术' +
      ui.help('每兵种两栏下拉：**动作**（前进 / 防御 / 后退 —— 决定初始站位与推进方式）＋ '
        + '**目标**（敌方某一兵种 / 箭塔 / 自动）。\n'
        + '动作：前进 = 每回合推进（到射程即停）；防御 = 原地不动、**受伤减半**；'
        + '后退 = 每回合后撤（躲箭塔双倍攻击区）。\n'
        + '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转打守军）。\n'
        + '这里是**出征战术**：你出兵时生效；防守战术在「防守战术」页单独设。') + '</div>' +
      ui.tacticBlockHTML('atk') + '</div>' +
      ui.trainBlockHTML();
  };'''
ui = ui[:i] + new_exp + ui[e:]

# ============ 5) marchDefHTML 重写（双小页） ============
i, e = func_span(ui, 'ui.marchDefHTML = function () {', 'marchDefHTML')
new_def = r'''ui._defSub = 'over';
  ui.marchDefHTML = function () {
    /* ============================================================
     * v89.133（v89.128 第二批第 14 条 · 老板）：「军务的防守战术，在底下分两个小页面
     *   （避免后边城池过多，显示不过来），第一个是目前的全境体检，改名为**全境防御**
     *   （按目前方式显示城池清单）。第二个是**防守战术**，参考调整后的出征战术缩略显示」。
     * 两小页共用页内切换（ui._defSub）—— 城多时体检表再长，也不再与战术设置互相顶屏。
     * ============================================================ */
    var s = GAME.state;
    var sub = ui._defSub === 'tac' ? 'tac' : 'over';
    var tabs = '<div class="def-tabs">' +
      [['over', '🛡️ 全境防御'], ['tac', '⚔️ 防守战术']].map(function (t) {
        return '<span class="dt' + (sub === t[0] ? ' on' : '') + '" data-action="def-sub" data-v="' + t[0] +
          '">' + t[1] + '</span>';
      }).join('') + '</div>';
    if (sub === 'tac') {
      return tabs + '<div class="story-card"><div class="gold-heading">⚔️ 防守战术' +
        ui.help('我方城池被攻打时，守军按**这套设置**作战（NPC 守方不用你的设置）。\n'
          + '每兵种两栏下拉：动作 + 目标，与出征战术同一套控件。\n'
          + '「**出城迎战**」= 该兵种前出城墙之外迎敌：攻方必须先把它打完，才够得着城墙拆工事；\n'
          + '但它也吃不到城墙护佑 —— 是把前线前移的进攻性防御，代价与收益都归自己。') + '</div>' +
        ui.tacticBlockHTML('def') + '</div>';
    }
    var rows = (s.cities || []).map(function (ct) {
      var army = GAME.armyTotal(ct);
      var wall = GAME.buildingLevel(ct, 'chengqiang') || 0;   /* v89.126：城墙占格后同一读法 */
      var towers = GAME.towerCountOf ? (GAME.towerCountOf(ct) || 0) : 0;
      var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(ct) : null;   /* v89.116：函数名笔误修正 */
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      var risks = [];
      if (army <= 0) risks.push('无驻军');
      if (wall <= 0) risks.push('无城墙');
      if (!guard) risks.push('未任命守将');
      /* v89.113：城主缺席 = 内政/智谋加成为零（城池面板会写明），体检里点出来 */
      var mayor = GAME.mayorGeneralOf ? GAME.mayorGeneralOf(ct) : null;
      if (!mayor) risks.push('未任命城主');
      return '<tr><td>' + U.escape(ct.name) + '</td>' +
        '<td class="num">' + U.numText(army, 0) + '</td>' +
        '<td class="num">' + (wall > 0 ? 'Lv' + wall : '—') + '</td>' +
        '<td class="num">' + towers + '</td>' +
        '<td>' + (mayor ? U.escape(mayor.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td>' + (guard ? U.escape(guard.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td class="num">' + U.numText(def, 0) + '</td>' +
        '<td style="color:' + (risks.length ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
          (risks.length ? risks.join(' · ') : '齐备') + '</td></tr>';
    }).join('');
    return tabs + '<div class="story-card"><div class="gold-heading">🛡️ 全境防御' +
      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 城墙/城主智谋加成)（与来袭结算同一出口 defensePowerOf）。\n'
        + '城主（文治）= 内政→产量/建造、智谋→研究/城防；守将（武功）= 勇武→征兵、战时对阵。\n'
        + '"齐备"= 有驻军 + 有城墙 + 有城主 + 有守将；缺哪项就在那行里点出来。') +
      '</div>' + (rows ? '<table class="tbl"><thead><tr><th>城池</th><th class="num">驻军</th><th class="num">城墙</th>' +
        '<th class="num">箭塔</th><th>城主</th><th>守将</th><th class="num">防御力</th><th>风险</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="q-empty">尚无城池。</div>') + '</div>';
  };'''
ui = ui[:i] + new_def + ui[e:]

# ============ 6) 烽火页删备注行 ============
old_note = ("    /* ⓪ v89.118（老板需求 3）：规则块与烽火流水**已迁至「自动化 · 外敌来犯」**——\n"
            "       本页只留「预警（排期表）+ 布防」，此处给一行指路（信息不丢，位置换了）。 */\n"
            "    out += '<div class=\"ui-sub\" style=\"text-align:center;margin:-2px 0 8px;\">' +\n"
            "      '📜 来犯的触发与规则、烽火流水 → 「自动化 · 外敌来犯」（本页只留预警与布防）</div>';\n")
new_note = ("    /* v89.133（v89.128 第二批第 15 条 · 老板）：「军方的烽火，去掉这种备注行」——\n"
            "       指路行退役（规则与流水仍在「自动化 · 外敌来犯」，位置没变，只是不再占页头）。 */\n")
ui = rep1(ui, old_note, new_note, '6 烽火备注行')

# 自检
for sent in ["ui.tacticBlockOf = function (side, id) {", 'class="tac-grid"', "ui._defSub = 'over'",
             'data-action="def-sub"', 'ui.trainBlockHTML()', 'data-f="sortie"', '🏹 进入军务']:
    assert ui.count(sent) >= 1, '丢失哨兵: ' + sent
assert ui.count('tacticChip') == 1, 'tacticChip 只应剩墓碑'
assert ui.count('🚩 在途') == 0, '在途卡片未删净'
assert ui.count('⓪ v89.118') == 0, '烽火备注行未删净'
wr('js/ui.js', ui)

# ============ 7) main.js ============
mj = rd('js/main.js')

old_ts = ("      case 'tactic-set': {\n"
          "        /* v89.109：战术分侧（atk = 出征 / def = 防守）—— chip 带 data-side */\n"
          "        var tSide = el.dataset.tside === 'def' ? 'def' : 'atk';\n"
          "        /* 「出城迎战」= 开关（不是互斥组）：取反 → 就地切视觉，不重绘整页 */\n"
          "        if (el.dataset.f === 'sortie') {\n"
          "          var TT = GAME.tacticsOf(tSide)[el.dataset.troop] || {};\n"
          "          GAME.setTactic(tSide, el.dataset.troop, { sortie: !TT.sortie });\n"
          "          el.classList.toggle('on');\n"
          "          break;\n"
          "        }\n"
          "        /* 点选即存：同组互斥只切 class、不重绘（与全站点选一致） */\n"
          "        var tg = el.dataset.g;\n"
          "        if (tg) {\n"
          "          var same = document.querySelectorAll('[data-action=\"tactic-set\"][data-g=\"' + tg + '\"]');\n"
          "          for (var ti = 0; ti < same.length; ti++) same[ti].classList.toggle('on', same[ti] === el);\n"
          "        }\n"
          "        var tp = {};\n"
          "        if (el.dataset.f === 's') tp.s = el.dataset.v;\n"
          "        else if (el.dataset.f === 't') tp.t = el.dataset.v;\n"
          "        GAME.setTactic(tSide, el.dataset.troop, tp);\n"
          "        break;\n"
          "      }\n")
new_ts = ("      case 'tactic-set': {\n"
          "        /* v89.133（第 13 条）：控件 chip → **select / checkbox** ——\n"
          "           值分别读 el.value / el.checked；旧 chip 的「就地切 class」不再需要\n"
          "           （原生控件自管选中态）。data-f：s=动作 · t=目标 · sortie=出城迎战。 */\n"
          "        var tSide = el.dataset.tside === 'def' ? 'def' : 'atk';\n"
          "        if (el.dataset.f === 'sortie') {\n"
          "          var TT = GAME.tacticsOf(tSide)[el.dataset.troop] || {};\n"
          "          var _sv = (el.tagName === 'INPUT') ? !!el.checked : !TT.sortie;\n"
          "          GAME.setTactic(tSide, el.dataset.troop, { sortie: _sv });\n"
          "          if (el.tagName !== 'INPUT') el.classList.toggle('on');\n"
          "          break;\n"
          "        }\n"
          "        var tp = {};\n"
          "        var _tv = (el.tagName === 'SELECT') ? el.value : el.dataset.v;\n"
          "        if (el.dataset.f === 's') tp.s = _tv;\n"
          "        else if (el.dataset.f === 't') tp.t = _tv;\n"
          "        GAME.setTactic(tSide, el.dataset.troop, tp);\n"
          "        break;\n"
          "      }\n")
mj = rep1(mj, old_ts, new_ts, 'm7 tactic-set')

old_del = ("    document.addEventListener('change', function (e) {\n"
           "      var el = e.target;\n"
           "      if (el && el.tagName === 'SELECT' && el.getAttribute && el.getAttribute('data-action')) {\n"
           "        GAME.action(el.getAttribute('data-action'), el);\n"
           "      }\n"
           "    });\n")
new_del = ("    document.addEventListener('change', function (e) {\n"
           "      var el = e.target;\n"
           "      /* v89.133：复选框同走动作表（战术「出城迎战」是首个勾选项） */\n"
           "      var _hit = el && el.getAttribute && el.getAttribute('data-action') &&\n"
           "        (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type === 'checkbox'));\n"
           "      if (_hit) GAME.action(el.getAttribute('data-action'), el);\n"
           "    });\n")
mj = rep1(mj, old_del, new_del, 'm8 change 委托')

# def-sub case（挂在 march-tab 附近）
old_mt = "      case 'march-tab': ui._marchTab = el.dataset.v || 'over'; GAME.refreshView(); break;\n"
assert mj.count(old_mt) == 1, 'march-tab 锚点'
new_mt = (old_mt +
          "      /* v89.133（第 14 条）：防守页内两小页（全境防御 / 防守战术） */\n"
          "      case 'def-sub': ui._defSub = el.dataset.v === 'tac' ? 'tac' : 'over'; GAME.refreshView(); break;\n")
mj = mj.replace(old_mt, new_mt)

assert mj.count("case 'def-sub'") == 1
wr('js/main.js', mj)

# ============ 8) index.html：CSS ============
html = rd('index.html')
anchor = "  .exp-mode-select { font-weight: 700; }\n"
assert html.count(anchor) == 1, 'CSS 锚点'
css = anchor + (
    "\n"
    "  /* ============ v89.133（第 13 条）：出征/防守战术 —— 下拉框 + 两列 ============ */\n"
    "  .tac-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);\n"
    "    gap: 0 var(--sp-4); }\n"
    "  .tac-line { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-1) 0;\n"
    "    border-bottom: 1px dashed rgba(var(--gold-rgb), .12); }\n"
    "  .tl-name { flex: none; width: 88px; font-size: var(--fs-sub); white-space: nowrap;\n"
    "    overflow: hidden; text-overflow: ellipsis; }\n"
    "  .tac-line .tl-sel { flex: 1 1 0; }\n"
    "  .tl-sortie { flex: none; font-size: var(--fs-cap); color: var(--text-dim);\n"
    "    display: inline-flex; align-items: center; gap: 2px; cursor: pointer; }\n"
    "  /* 防守页内两小页（第 14 条）：全境防御 / 防守战术 */\n"
    "  .def-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-3); }\n"
    "  .def-tabs .dt { padding: 2px var(--sp-4); border-radius: 999px; cursor: pointer;\n"
    "    font-size: var(--fs-sub); color: var(--text-dim);\n"
    "    border: 1px solid rgba(var(--gold-soft-rgb), .30); }\n"
    "  .def-tabs .dt:hover { border-color: rgba(var(--gold-soft-rgb), .6); }\n"
    "  .def-tabs .dt.on { color: var(--ink-on-gold); font-weight: 700;\n"
    "    background: linear-gradient(180deg, var(--gold-light), var(--gold-dark));\n"
    "    border-color: var(--gold-light); }\n")
html = rep1(html, anchor, css, 'CSS')
wr('index.html', html)
print('OK · ui.js', len(ui), '· main.js', len(mj), '· index.html', len(html))
