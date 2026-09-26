# -*- coding: utf-8 -*-
"""v89.128 补丁 C：城墙回环城槽 —— 界面层与转正提取
   domain.js：slotKey/slotEq（槽位键归一）+ 5 处比较点归一
   ui.js：openBuildModal 槽化 + 未建城墙面板 + 菜单剔城墙 + isoBoard 调用/实装 + 拆除确认 + 移动排除 + 取消失效修复
   main.js：open-wall 重写 + confirm/demolish/cancel/rush 的键归一
   battle.js：攻占转正 / 据点转正两处「城墙格 → 环城槽」提取
"""
import io

R = 'E:/Deepseekdb/'
n_all = 0


def do_file(fname, edits):
    global n_all
    P = R + 'js/' + fname
    s = io.open(P, encoding='utf-8').read()
    orig = s
    for old, new, tag in edits:
        assert s.count(old) == 1, '[%s] %s 锚点 %d 个' % (fname, tag, s.count(old))
        s = s.replace(old, new)
        n_all += 1
        print('  ✓ [%s] %s' % (fname, tag))
    assert s != orig

    def bal(x):
        return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))
    assert bal(s) == bal(orig), '[%s] 括号盈亏变化 %s vs %s' % (fname, bal(s), bal(orig))
    io.open(P, 'w', encoding='utf-8').write(s)


# ════════════ domain.js ════════════
domain_edits = [
    # ① slotKey / slotEq（放在 cellOf 之前，与它同族）
    (
        """  GAME.cellOf = function (city, key) {""",
        """  /* v89.128：槽位键的**归一出口** —— 'wall' 原样；其余一律 Number。
     （UI 的 dataset 值恒为字符串，队列里存的是数字 —— 比较与入参都走这里，
      不许散落各处的 Number()/===，那正是"某些入口静默失效"的来源。） */
  GAME.slotKey = function (v) {
    return (v === 'wall') ? 'wall' : Number(v);
  };
  /* 槽位相等：'wall' 或数字（含字符串数字形态）之间安全比较 */
  GAME.slotEq = function (a, b) {
    return a === b || String(a) === String(b);
  };
  GAME.cellOf = function (city, key) {""",
        '① slotKey/slotEq',
    ),
    # ② cancelRefundOf 比较
    (
        "          ? (x.gridIndex === idx && (x.type === 'build' || x.type === 'upgrade') && (!cur || !x.cityId || x.cityId === cur.id))",
        "          ? (GAME.slotEq(x.gridIndex, idx) && (x.type === 'build' || x.type === 'upgrade') && (!cur || !x.cityId || x.cityId === cur.id))",
        '② cancelRefundOf 比较',
    ),
    # ③ demolishAt 清队列比较
    (
        "      return !(q.cityId === cityId && q.gridIndex === gridIndex);",
        "      return !(q.cityId === cityId && GAME.slotEq(q.gridIndex, gridIndex));",
        '③ demolishAt 清队列',
    ),
    # ④ queueAt 比较
    (
        "      if (kind === 'city' && (q.type === 'build' || q.type === 'upgrade') && Number(q.gridIndex) === Number(ref)) out = q;",
        "      if (kind === 'city' && (q.type === 'build' || q.type === 'upgrade') && GAME.slotEq(q.gridIndex, ref)) out = q;",
        '④ queueAt',
    ),
    # ⑤ buildQueueOf 比较
    (
        "      if (q.cityId === cityId && Number(q.gridIndex) === Number(gridIndex)) out = q;",
        "      if (q.cityId === cityId && GAME.slotEq(q.gridIndex, gridIndex)) out = q;",
        '⑤ buildQueueOf',
    ),
    # ⑥ buildProgress 比较
    (
        "          ? (q.gridIndex === idx && (q.type === 'build' || q.type === 'upgrade') && sameCity)",
        "          ? (GAME.slotEq(q.gridIndex, idx) && (q.type === 'build' || q.type === 'upgrade') && sameCity)",
        '⑥ buildProgress',
    ),
]
print('domain.js:')
do_file('domain.js', domain_edits)

# ════════════ ui.js ════════════
ui_edits = [
    # ① openBuildModal 入口槽化
    (
        """  ui.openBuildModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();
    var cell = c.cells[idx];
    ui._curGrid = idx;""",
        """  ui.openBuildModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();
    var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' = 环城槽（不占格） */
    ui._curGrid = idx;""",
        '① openBuildModal 槽化',
    ),
    # ② 未建城墙面板（插在正常建筑分支之前）
    (
        """    }
    if (cell.build) {
      var b = DATA.BUILDINGS[cell.build.id];
      /* v68 · 逐步探索：卡在官府等级上时，'已满级' 会误导 —— 用前置检查给出准确原因 */""",
        """    }
    if (!cell.build && idx === 'wall') {
      /* v89.128（老板）：「城墙以**环城一圈的城墙结构**作为一个建筑（地位与城内建筑同），
         而不是占据城内一个地块」—— 城墙不占格，没有"空地可选"，入口 = 环城热区；
         这里给「修建」面板（造价 / 前置 / 说明）。 */
      var wb128 = DATA.BUILDINGS.chengqiang;
      var wcost128 = wb128.buildCost;
      if (GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('buildCost')) wcost128 = GAME.applyBuildCostDiscount(wcost128);
      wcost128 = GAME.cityDefCostOf('chengqiang', wcost128);
      var wpre128 = GAME.buildPrereqOf(c, 'chengqiang', 1);
      var wcan128 = GAME.canAfford(wcost128) && wpre128.ok;
      var wsub128 = !wpre128.ok ? ui.prereqText(c, wpre128)
        : (GAME.canAfford(wcost128) ? ('耗：' + GAME.costString(wcost128) + '（城防技术已折扣）') : '材料不足');
      ui.openModal(
        '<div class="gold-heading">🧱 城墙（未修建）</div>' +
        (wb128.desc ? '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' + U.escape(wb128.desc) + '</div>' : '') +
        '<div class="ui-sub" style="text-align:center;margin-bottom:10px;">环城一圈的城墙结构 · 不占城内地块 · 与城内建筑同一套管理</div>' +
        '<div class="bldg-bottom"><div class="bldg-acts">' +
          '<button class="btn gold bldg-act"' + (wcan128 ? '' : ' disabled') +
            ' data-action="confirm-build" data-idx="wall" data-build="chengqiang">🏗 修建城墙<span class="ba-sub">' +
            U.escape(wsub128) + '</span></button>' +
        '</div><div class="bldg-foot">' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">耐久 100×N 万 · 守军防御 +10N% · 远程射程 +3N%</span>' +
        '</div></div>');
      return;
    }
    if (cell.build) {
      var b = DATA.BUILDINGS[cell.build.id];
      /* v68 · 逐步探索：卡在官府等级上时，'已满级' 会误导 —— 用前置检查给出准确原因 */""",
        '② 未建城墙面板',
    ),
    # ③ 建造菜单剔城墙
    (
        "      var all = DATA.BUILD_ORDER.map(function (bid) {",
        "      /* v89.128：城墙不占格 —— 不在\"空格菜单\"里（入口 = 环城热区），从候选剔除 */\n"
        "      var all = DATA.BUILD_ORDER.filter(function (bid) { return bid !== 'chengqiang'; }).map(function (bid) {",
        '③ 菜单剔城墙',
    ),
    # ④ isoBoard 调用（有墙才画墙；热区常在）
    (
        "    var board = ui.isoBoard(COLS, ROWS, cells, { wall: true, wallAction: 'open-wall' });",
        "    /* v89.128：环城一圈 = **城墙建筑的视觉** —— 修了才画；热区常在（未建时点它=修建） */\n"
        "    var board = ui.isoBoard(COLS, ROWS, cells, { wall: !!(c.wall && c.wall.build), wallHit: true, wallAction: 'open-wall' });",
        '④ isoBoard 调用',
    ),
    # ⑤ isoBoard 实装：wall（画墙）与 wallHit（热区）分离
    (
        """      + (opt.wall ? ui.isoWallSVG(cols, rows) : '')
      + inner
      + (opt.wall ? ui.wallHitHTML(cols, rows, opt.wallAction) : '')""",
        """      + (opt.wall ? ui.isoWallSVG(cols, rows) : '')
      + inner
      + (opt.wallHit ? ui.wallHitHTML(cols, rows, opt.wallAction) : '')""",
        '⑤ isoBoard wall/wallHit 分离',
    ),
    # ⑥ openDemolishConfirm 槽化
    (
        """    } else {
      var cell = c.cells[idx];
      if (!cell || !cell.build) { ui.toast('该地块无建筑'); return; }""",
        """    } else {
      var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' 槽同样生效 */
      if (!cell || !cell.build) { ui.toast('该地块无建筑'); return; }""",
        '⑥ openDemolishConfirm',
    ),
    # ⑦ 移动按钮排除城墙
    (
        """          (b.id === 'guanfu' ? ''
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +""",
        """          (b.id === 'guanfu' || b.id === 'chengqiang' ? ''   /* v89.128：城墙不占格，无"互换"可言 */
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +""",
        '⑦ 移动排除城墙',
    ),
    # ⑧ openCancelBuildAsk 的 idx 写出修复（'wall' 曾被洗成 0）
    (
        """      + '<button class="btn red" data-action="cancel-build-do" data-kind="' + kind + '" data-idx="' + (idx == null || isNaN(Number(idx)) ? 0 : Number(idx)) + '">确定取消</button>'""",
        """      + '<button class="btn red" data-action="cancel-build-do" data-kind="' + kind + '" data-idx="' + idx + '">确定取消</button>'   /* v89.128：'wall' 原样透传（旧写法把非数字洗成 0） */""",
        '⑧ 取消 idx 透传',
    ),
]
print('ui.js:')
do_file('ui.js', ui_edits)

# ════════════ main.js ════════════
main_edits = [
    # ① open-wall 重写
    (
        """      case 'open-wall': {
        /* v89.126：城墙占格后，环城热区点击 = 打开城墙格的**通用建筑面板**；
           未建城墙 → 找一格空地打开建造菜单（选「城墙」）。 */
        var _cw126 = GAME.currentCity();
        var _wi126 = GAME.wallCellIdxOf ? GAME.wallCellIdxOf(_cw126) : -1;
        if (_wi126 >= 0) { ui.openBuildModal(_wi126); break; }
        var _free126 = -1;
        (((_cw126 || {}).cells) || []).forEach(function (x, i) {
          if (_free126 < 0 && !x.build && !x.pending && !x.official) _free126 = i;
        });
        if (_free126 >= 0) { ui.openBuildModal(_free126); ui.toast('在空地上选择「城墙」即可修建'); }
        else ui.toast('城内已无空地可建城墙（先拆一处或扩建）');
        break;
      }""",
        """      case 'open-wall': {
        /* v89.128（老板「城墙以环城一圈的结构作为一个建筑」）：环城热区点击 =
           打开**环城槽**的面板（已建 → 升级/拆除；未建 → 修建）。不占格、不找空地。 */
        ui.openBuildModal('wall');
        break;
      }""",
        '① open-wall 重写',
    ),
    # ② confirm-build
    (
        "      case 'confirm-build': GAME.doBuild(Number(el.dataset.idx), el.dataset.build); break;",
        "      case 'confirm-build': GAME.doBuild(GAME.slotKey(el.dataset.idx), el.dataset.build); break;",
        '② confirm-build',
    ),
    # ③ confirm-upgrade
    (
        "      case 'confirm-upgrade': GAME.doUpgrade(Number(el.dataset.idx)); break;",
        "      case 'confirm-upgrade': GAME.doUpgrade(GAME.slotKey(el.dataset.idx)); break;",
        '③ confirm-upgrade',
    ),
    # ④ demolish-ask
    (
        "      case 'demolish-ask': ui.openDemolishConfirm(el.dataset.kind, Number(el.dataset.idx)); break;",
        "      case 'demolish-ask': ui.openDemolishConfirm(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;",
        '④ demolish-ask',
    ),
    # ⑤ demolish-do
    (
        "      case 'demolish-do': GAME.doDemolishDo(el.dataset.kind, Number(el.dataset.idx)); break;",
        "      case 'demolish-do': GAME.doDemolishDo(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;",
        '⑤ demolish-do',
    ),
    # ⑥ cancel-build-ask
    (
        "      case 'cancel-build-ask': ui.openCancelBuildAsk(el.dataset.kind, Number(el.dataset.idx)); break;",
        "      case 'cancel-build-ask': ui.openCancelBuildAsk(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;",
        '⑥ cancel-build-ask',
    ),
    # ⑦ cancel-build-do
    (
        "      case 'cancel-build-do': GAME.doCancelBuild(el.dataset.kind, Number(el.dataset.idx)); break;",
        "      case 'cancel-build-do': GAME.doCancelBuild(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;",
        '⑦ cancel-build-do',
    ),
    # ⑧ rush-build 重开面板
    (
        "        if (GAME.queueAt('city', el.dataset.idx)) ui.openBuildModal(Number(el.dataset.idx));",
        "        if (GAME.queueAt('city', el.dataset.idx)) ui.openBuildModal(GAME.slotKey(el.dataset.idx));",
        '⑧ rush-build',
    ),
    # ⑨ rush-ov
    (
        "        var _q2 = GAME.buildQueueOf(el.dataset.ci, Number(el.dataset.gi));",
        "        var _q2 = GAME.buildQueueOf(el.dataset.ci, GAME.slotKey(el.dataset.gi));",
        '⑨ rush-ov',
    ),
]
print('main.js:')
do_file('main.js', main_edits)

# ════════════ battle.js ════════════
battle_edits = [
    # ① 攻占转正：城墙格 → 环城槽
    (
        """    newCity.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
    /* v89.126：城墙等级随 `sh.cells` 一起继承（占格后不再有独立 wallLv 字段） */
    newCity.def = npcCity.def || 0;""",
        """    newCity.extGrid = sh.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
    /* v89.128：城墙从影子格**提取到环城槽**（玩家侧不占格）——影子计划仍含城墙格，
       转正时在这里归一，那一格释放回可建造状态。 */
    newCity.wall = { build: null, pending: null };
    (function () {
      var _wl128 = 0;
      newCity.cells.forEach(function (c) {
        if (c.build && c.build.id === 'chengqiang') {
          _wl128 = Math.max(_wl128, c.build.lvl || 0);
          c.build = null; c.pending = null;
        }
      });
      if (_wl128 > 0) newCity.wall.build = { id: 'chengqiang', lvl: _wl128 };
    })();
    newCity.def = npcCity.def || 0;""",
        '① 攻占转正提取',
    ),
    # ② 据点转正：城墙格 → 环城槽
    (
        """      city.extGrid = shadow.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
      /* v89.126：城墙等级随 `shadow.cells` 一起继承 */
    }""",
        """      city.extGrid = shadow.extGrid.map(function (e) { return { id: e.id, type: e.type, lv: e.lv }; });
      /* v89.128：城墙从影子格提取到环城槽（同占城转正，玩家侧不占格） */
      city.wall = { build: null, pending: null };
      (function () {
        var _wl128 = 0;
        city.cells.forEach(function (c) {
          if (c.build && c.build.id === 'chengqiang') {
            _wl128 = Math.max(_wl128, c.build.lvl || 0);
            c.build = null; c.pending = null;
          }
        });
        if (_wl128 > 0) city.wall.build = { id: 'chengqiang', lvl: _wl128 };
      })();
    }""",
        '② 据点转正提取',
    ),
]
print('battle.js:')
do_file('battle.js', battle_edits)

print('patch C OK · 共 %d 处' % n_all)
