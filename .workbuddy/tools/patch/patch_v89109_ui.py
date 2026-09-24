# -*- coding: utf-8 -*-
"""v89.109：UI 层 —— 战术分侧渲染 + 军务出征/防守页改造 + main 动作支持 side"""
import io, os, shutil
BK = r'E:/Deepseekdb/.workbuddy/backup'

# ============================================================
# A) ui.js —— 块1：chip / 块渲染 / 弹窗
# ============================================================
pu = r'E:/Deepseekdb/js/ui.js'
shutil.copy2(pu, os.path.join(BK, 'ui.v89108.js'))
u = io.open(pu, encoding='utf-8').read()

i1 = u.index('  ui.TAC_PER = 4;')
# 终点：openTacticModal 结束（'/* ③ 资源栏' 之前）
j1 = u.index('  /* ③ 资源栏', i1)

blockA = '''  ui.TAC_PER = 4;                    // 弹窗每页 4 个兵种（页面内嵌不分页，全列）
  /* 战术 chip —— side 必填（v89.109 起战术分侧：atk = 出征 / def = 防守）。
     ⚠️ `data-g` 必须带 side 前缀：出征页与防守页的 chip 若同名，互斥组会串台。 */
  ui.tacticChip = function (side, troop, field, val, label, on) {
    side = side === 'def' ? 'def' : 'atk';
    return '<span class="chip' + (on ? ' on' : '') + '" data-action="tactic-set"' +
      ' data-side="' + side + '"' +
      ' data-troop="' + troop + '" data-g="tac-' + side + '-' + field + '-' + troop + '"' +
      ' data-f="' + field + '" data-v="' + val + '">' + label + '</span>';
  };
  /* 会出现在战场上的兵种（与 tactic.unitsOf 的判据一致：非 nocombat）——
     斥候不上阵、指挥它没有意义，所以战术表里也不该有它。 */
  ui.tacticTroopIds = function () {
    return Object.keys(DATA.TROOPS).filter(function (id) { return !DATA.TROOPS[id].nocombat; });
  };
  /* 单兵种战术块（页面与弹窗共用 —— **唯一渲染口**，改样式只改这一处）。
     未设置时高亮该侧**默认**（防守侧 = 攻城固守；出征侧 = 前进）——
     "高亮的就是下场时生效的"，不留给玩家"我到底设没设"的疑问。 */
  ui.tacticBlockOf = function (side, id) {
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
    return '<div class="tac-block">' +
      '<div class="tac-row">' +
        '<span class="tac-name">' + (tr.icon || '') + ' ' + tr.name + '</span>' +
        '<span class="chips">' + DATA.STANCES.map(function (st) {
          return ui.tacticChip(side, id, 's', st.id, st.icon + st.name, curS === st.id);
        }).join('') +
        (isDef ? ui.tacticChip(side, id, 'sortie', '1', '🏇 出城迎战', sortieOn) : '') +
        '</span>' +
      '</div>' +
      '<div class="tac-row"><span class="tac-k">目标</span><span class="chips">' +
        tgt.map(function (o) {
          return ui.tacticChip(side, id, 't', o.v, o.label, curT === o.v);
        }).join('') + '</span></div>' +
      '</div>';
  };
  /* 全表（页面内嵌用） */
  ui.tacticBlockHTML = function (side) {
    return ui.tacticTroopIds().map(function (id) { return ui.tacticBlockOf(side, id); }).join('');
  };
  ui.openTacticModal = function (side) {
    side = side === 'def' ? 'def' : 'atk';
    var isDef = side === 'def';
    var ids = ui.tacticTroopIds();
    var pg = ui.modalPage('tactic' + side, ids, ui.TAC_PER, function () { ui.openTacticModal(side); });
    var body = pg.slice.map(function (id) { return ui.tacticBlockOf(side, id); }).join('');
    ui.openShell({
      title: isDef ? '🛡️ 防守战术' : '⚔️ 出征战术',
      sub: '当前：' + GAME.tacticSummary(side) + ui.help(
        '每兵种：**动作**（前进 / 防御 / 后退）+ **目标**（敌方某一兵种，或攻城时的**箭塔**）。' +
        (isDef ? '\\n防守侧另有「**出城迎战**」：出城部队前出到城墙之外 —— 攻方必须先把它打完，\\n才够得着城墙（拆不了工事）；它也吃不到城墙护佑（风险与收益都归自己）。' : '') +
        '\\n动作决定**初始站位**：前进 = 第一排（100）、防御 = 第二排（50）、后退 = 第三排（0）。\\n' +
        '· **前进**：每回合向敌阵推进（推进到刚好能开火就停）\\n' +
        '· **防御**：原地不动，**受到的伤害减半**（远程原地对射就是选它）\\n' +
        '· **后退**：每回合向己方后撤，用来躲开箭塔的**双倍攻击区**\\n' +
        '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转为打守军）。\\n' +
        (isDef ? '我方城池被攻打时用**你设的这套**；NPC 守方用默认（攻城固守 / 野地迎击）。'
               : '守方（NPC 城池 / 野地）用默认动作：攻城时固守（依城而战），野地时迎击。')),
      body: body + pg.pager,
      foot: '<div class="m-foot">' +
        '<button class="btn" data-action="tactic-reset" data-side="' + side + '">恢复默认</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>' +
      '</div>',
    });
  };
'''
u = u[:i1] + blockA + u[j1:]

# ============================================================
# B) ui.js —— 块2：出征页（战术设置 + 在途）与防守页（体检 + 防守战术）
# ============================================================
i2 = u.index('  ui.marchExpHTML = function () {')
j2 = u.index('  /* —— 军务处：伤病 / 兵源 / 军心', i2)

blockB = '''  /* —— 出征页（v89.109 · 老板「军务的出征菜单不是给地址栏的，而是设置出征战术的地方」）：
     主体 = **出征战术设置**（全兵种 × 动作 × 首选歼敌目标）；在途队列保留（召回/急行军在那儿）。
     "近处可打目标"列表已删 —— 出征目标在地图上点选（城池 / 据点 / 野地）。 —— */
  ui.marchExpHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    var ms = (s.marches || []).map(function (m) {
      return '<tr><td>' + U.escape(m.name) + '</td><td>' + U.escape(m.modeId) + '</td>' +
        '<td class="num">' + U.numText(GAME.armyTotal({ army: m.army }), 0) + '</td>' +
        '<td class="ctr"><button class="btn sm" data-action="march-rush" data-id="' + m.id + '">急行军</button>' +
        '<button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td></tr>';
    }).join('');
    return '<div class="story-card"><div class="gold-heading">⚔️ 出征 · 战术' +
      ui.help('每兵种的动作与目标 —— 出征弹窗里点「逐兵种」也回到这一套设置（同一份数据）。\\n' +
        '这里是**出征战术**：你出兵时生效；防守战术在「防守」页单独设。') +
      '</div>' + ui.tacticBlockHTML('atk') + '</div>' +
      '<div class="story-card"><div class="gold-heading">🚩 在途（' + (s.marches || []).length + '）' +
      ui.help('出征目标在地图上点选（城池 / 据点 / 野地），或从城池界面出兵。') +
      '</div>' +
      (ms ? '<table class="tbl"><thead><tr><th>目标</th><th>方式</th><th class="num">兵力</th>' +
        '<th class="ctr">操作</th></tr></thead><tbody>' + ms + '</tbody></table>'
        : '<div class="q-empty">没有行军队列。</div>') + '</div>';
  };
  /* —— 防守页：逐城防御体检 + **防守战术设置**（v89.109） —— */
  ui.marchDefHTML = function () {
    var s = GAME.state;
    var rows = (s.cities || []).map(function (ct) {
      var army = GAME.armyTotal(ct);
      var wall = ct.wallLv || 0;
      var towers = GAME.towerCountOf ? (GAME.towerCountOf(ct) || 0) : 0;
      var guard = GAME.guardOf ? GAME.guardOf(ct) : null;
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      var risks = [];
      if (army <= 0) risks.push('无驻军');
      if (wall <= 0) risks.push('无城墙');
      if (!guard) risks.push('未任命守将');
      return '<tr><td>' + U.escape(ct.name) + '</td>' +
        '<td class="num">' + U.numText(army, 0) + '</td>' +
        '<td class="num">' + (wall > 0 ? 'Lv' + wall : '—') + '</td>' +
        '<td class="num">' + towers + '</td>' +
        '<td>' + (guard ? U.escape(guard.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td class="num">' + U.numText(def, 0) + '</td>' +
        '<td style="color:' + (risks.length ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
          (risks.length ? risks.join(' · ') : '齐备') + '</td></tr>';
    }).join('');
    return '<div class="story-card"><div class="gold-heading">🛡️ 防守 · 全境体检' +
      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 城墙/守将加成)（与来袭结算同一出口 defensePowerOf）。\\n' +
        '"齐备"= 有驻军 + 有城墙 + 有守将；缺哪项就在那行里点出来。') +
      '</div>' + (rows ? '<table class="tbl"><thead><tr><th>城池</th><th class="num">驻军</th><th class="num">城墙</th>' +
        '<th class="num">箭塔</th><th>守将</th><th class="num">防御力</th><th>风险</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="q-empty">尚无城池。</div>') + '</div>' +
      '<div class="story-card"><div class="gold-heading">⚔️ 防守战术' +
      ui.help('我方城池被攻打时，守军按**这套设置**作战（NPC 守方不用你的设置）。\\n' +
        '「**出城迎战**」= 该兵种前出城墙之外迎敌：攻方必须先把它打完，才够得着城墙拆工事；\\n' +
        '但它也吃不到城墙护佑 —— 是把前线前移的进攻性防御，代价与收益都归自己。') +
      '</div>' + ui.tacticBlockHTML('def') + '</div>';
  };
'''
u = u[:i2] + blockB + u[j2:]

io.open(pu + '.tmp', 'w', encoding='utf-8', newline='').write(u)
os.replace(pu + '.tmp', pu)
print('ui.js 两块已替换')

# ============================================================
# C) main.js —— tactic-set / tactic-reset 支持 side + sortie 开关
# ============================================================
pm = r'E:/Deepseekdb/js/main.js'
shutil.copy2(pm, os.path.join(BK, 'main.v89108.js'))
m = io.open(pm, encoding='utf-8').read()

a3 = """      case 'tactic-set': {
        /* 点选即存：同组互斥只切 class、不重绘（与全站点选一致） */
        var tg = el.dataset.g;
        if (tg) {
          var same = document.querySelectorAll('[data-action="tactic-set"][data-g="' + tg + '"]');
          for (var ti = 0; ti < same.length; ti++) same[ti].classList.toggle('on', same[ti] === el);
        }
        var tp = {};
        if (el.dataset.f === 's') tp.s = el.dataset.v;
        else if (el.dataset.f === 't') tp.t = el.dataset.v;
        GAME.setTactic(el.dataset.troop, tp);
        break;
      }
      case 'tactic-reset': {
        var rrT = GAME.clearTactics();
        ui.toast(rrT.msg);
        ui.openTacticModal();
        break;
      }"""
b3 = """      case 'tactic-set': {
        /* v89.109：战术分侧（atk = 出征 / def = 防守）—— chip 带 data-side */
        var tSide = el.dataset.side === 'def' ? 'def' : 'atk';
        /* 「出城迎战」= 开关（不是互斥组）：取反 → 就地切视觉，不重绘整页 */
        if (el.dataset.f === 'sortie') {
          var TT = GAME.tacticsOf(tSide)[el.dataset.troop] || {};
          GAME.setTactic(tSide, el.dataset.troop, { sortie: !TT.sortie });
          el.classList.toggle('on');
          break;
        }
        /* 点选即存：同组互斥只切 class、不重绘（与全站点选一致） */
        var tg = el.dataset.g;
        if (tg) {
          var same = document.querySelectorAll('[data-action="tactic-set"][data-g="' + tg + '"]');
          for (var ti = 0; ti < same.length; ti++) same[ti].classList.toggle('on', same[ti] === el);
        }
        var tp = {};
        if (el.dataset.f === 's') tp.s = el.dataset.v;
        else if (el.dataset.f === 't') tp.t = el.dataset.v;
        GAME.setTactic(tSide, el.dataset.troop, tp);
        break;
      }
      case 'tactic-reset': {
        var rSide = el.dataset.side === 'def' ? 'def' : 'atk';
        var rrT = GAME.clearTactics(rSide);
        ui.toast(rrT.msg);
        /* 弹窗里点的 → 重开弹窗；页面内嵌的 → 就地重绘视图 */
        if (document.querySelector('#modal-root .tac-block')) ui.openTacticModal(rSide);
        else GAME.refreshView();
        break;
      }"""
assert a3 in m, 'C 未命中'
m = m.replace(a3, b3, 1)
io.open(pm + '.tmp', 'w', encoding='utf-8', newline='').write(m)
os.replace(pm + '.tmp', pm)
print('main.js 已更新')
