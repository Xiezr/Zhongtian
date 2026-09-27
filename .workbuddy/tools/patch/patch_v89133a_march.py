# -*- coding: utf-8 -*-
"""v89.133 补丁 P1a：军务页签体系 + 出征页（第 9/11 条）+ 校场退役（第 10 条）
- MARCH_TABS：+ 'act'（出征）；'exp'→出征战术、'def'→防守战术
- 新 ui.actTargetsOf / ui.marchActHTML（出征页 = 军事行动入口；目标范围写清楚）
- 校场面板（openXiaochang）退役；演武/阅兵迁到出征战术页尾（ui.trainBlockHTML）
- jieyue-xc 入口随校场面板迁到出征页；main.js 同步
跑：python .workbuddy/tools/patch/patch_v89133a_march.py
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

# ============ 1) 页签体系 ============
old_tabs = "  ui.MARCH_TABS = [['over', '军务总览'], ['exp', '出征'], ['def', '防守'], ['beacon', '烽火'], ['affairs', '军务处']];\n"
new_tabs = ("  /* v89.133（v89.128 第二批第 9 条）：菜单改名 + 新增「出征」——\n"
            "     exp = 出征战术（原「出征」改）、def = 防守战术（原「防守」改）、act = 出征（新）。 */\n"
            "  ui.MARCH_TABS = [['over', '军务总览'], ['act', '出征'], ['exp', '出征战术'], ['def', '防守战术'], ['beacon', '烽火'], ['affairs', '军务处']];\n")
ui = rep1(ui, old_tabs, new_tabs, '1 页签')

# ============ 2) marchesHTML 分派加 'act' ============
old_disp = "    if (tab === 'exp') return '<div class=\"ui-page\">' + ui.marchTabHTML() + ui.marchExpHTML() + '</div>';\n"
new_disp = ("    if (tab === 'act') return '<div class=\"ui-page\">' + ui.marchTabHTML() + ui.marchActHTML() + '</div>';\n"
            "    if (tab === 'exp') return '<div class=\"ui-page\">' + ui.marchTabHTML() + ui.marchExpHTML() + '</div>';\n")
ui = rep1(ui, old_disp, new_disp, '2 分派')

# ============ 3) 新：出征页（act）= 军事行动入口 ============
old_anchor = ("  /* —— 出征页：附近目标 + 在途 —— */\n"
              "  /* —— 出征页（v89.109 · 老板「军务的出征菜单不是给地址栏的，而是设置出征战术的地方」）：\n")
new_act = r'''  /* ============================================================
   * v89.133（v89.128 第二批第 9/11 条 · 老板）：「增加一个新的'出征'菜单 ——
   *   这个菜单就是点击野地进行出征行动（掠夺，占领等）后弹出的军队行动界面，
   *   直接引用这个界面作为功能即可」＋「出征界面作为一切军事行动的入口，包括对外出征
   *   或对内的城池/野地间操作。出征目标目前提供的是哪些目标，一定距离内吗」。
   * ------------------------------------------------------------
   * 口径：**出征页 = 一切军事行动的入口** —— 先选目标（下拉），再进军队行动界面
   *   （`ui.openExpModal` **原样引用** —— 不另造第二套编队界面）。
   * 目标范围（回答老板「一定距离内吗」）：
   *   · 我方野地 / 我方城池 —— **全境**（不限距离）；
   *   · 同县普通城池 —— 同县（不限距离）；
   *   · 野外据点 —— 当前城 **14 格内**（半径在 `expTargetCandidates` 唯一出口里）;
   *   · 其余任意目标（名城 / 远据点 / 中立野地）—— **地图点选**（本页给指路，不另列）。
   * ============================================================ */
  ui._actTarget = 0;
  ui.actTargetsOf = function (c) {
    var s = GAME.state, list = [];
    /* ① 我方野地（全境）—— 驻军 / 采集 / 撤回都从这里发起 */
    (s.wilds || []).forEach(function (w) {
      var t = DATA.TERRAIN[w.type] || { name: w.type };
      var gn = GAME.wildGarrisonTotal(w.garrison);
      list.push({ tg: { kind: 'wild', x: w.x, y: w.y },
        label: '🌾 ' + t.name + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）'
          + (gn > 0 ? '　· 驻军 ' + U.numText(gn, 0) : '　· 无驻军') });
    });
    /* ② 既有候选出口（我方城池 / 同县普通城池 / 14 格内据点）—— openExpModal 会归一 'own' */
    (ui.expTargetCandidates(c, null) || []).forEach(function (tg) {
      list.push({ tg: tg, label: ui.expTargetLabel(tg) });
    });
    return list;
  };
  ui.marchActHTML = function () {
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    var list = ui.actTargetsOf(c);
    if (ui._actTarget >= list.length) ui._actTarget = 0;
    var cap = GAME.battle.marchCapOf(c);
    var xcLv = GAME.buildingLevel(c, 'xiaochang') || 0;
    var jx = GAME.jieyueExpandOf(c, 'xc');
    var _jxTxt = (jx.used >= jx.max)
      ? '本城已满 ' + jx.used + '/' + jx.max
      : '本城 ' + jx.used + '/' + jx.max + '　持符 ' + GAME.jieyueOf();
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '一切军事行动的入口：选目标 → 进军队行动界面（编队 / 战术 / 计略都在里面）</div>' +
      '<div class="story-card"><div class="gold-heading">⚔️ 出征 · 目标' +
        ui.help('目标来源：\n· 我方野地 / 我方城池 —— 全境（不限距离）；\n'
          + '· 同县普通城池 —— 同县；\n· 野外据点 —— 本城 14 格内；\n'
          + '· 其余目标（名城 / 远据点 / 中立野地）—— 地图点选。\n'
          + '选定后进入**军队行动界面**（与地图点野地弹出的是同一个界面）。') + '</div>' +
      '<div class="exp-sel" style="margin:6px 0 4px;"><label>目标</label>' +
        '<select data-action="exp-act-target">' +
          (list.length ? list.map(function (o, i) {
            return '<option value="' + i + '"' + (i === ui._actTarget ? ' selected' : '') + '>' +
              U.escape(o.label) + '</option>';
          }).join('') : '<option value="">（暂无可选目标）</option>') +
        '</select>' +
        '<button class="btn gold" data-action="exp-act-go"' + (list.length ? '' : ' disabled') +
          '>进入军队行动 →</button></div>' +
      '<div class="ui-sub">目标范围：我方野地 / 我方城池 —— <b>全境</b>；同县普通城池 —— 同县；'
        + '野外据点 —— 本城 <b>14 格内</b>；其余目标（名城 / 远据点 / 中立野地）→ '
        + '<b>在地图上点选</b>（点野地 / 据点 / 名城即弹出同一界面）。</div></div>' +
      /* v89.132 的节钺 · 校场扩编入口原在校场面板 —— v89.133 校场面板退役，入口迁到这里 */
      '<div class="story-card"><div class="gold-heading">🪓 编制 · 出战能力' +
        ui.help('出征容量 = 校场等级 × 1 万 × 加成；节钺 · 校场扩编每次 +1 万人马'
          + '（等效校场 +1 级，每城至多 ' + ((DATA.JIEYUE || {}).xcMax || 2) + ' 次）。\n'
          + '节钺来源：首占名城 / 爵位赏赐（黄金买不到）。') + '</div>' +
      '<div class="res-line"><span class="lbl">本城出征容量</span><span class="val">' +
        U.numText(cap, 0) + ' 人马' + (xcLv > 0 ? '（校场 Lv' + xcLv + ' + 扩编 ' + (c.jieyueXc || 0) + '）'
          : '（尚无校场）') + '</span></div>' +
      '<div class="auto-line"><button class="btn" data-action="jieyue-xc" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 校场扩编（' + _jxTxt + '）</button>' +
        '<span class="ui-sub">出征容量 +1 万人马（等效校场 +1 级）</span></div></div>';
  };
  /* —— 出征页（v89.109 · 老板「军务的出征菜单不是给地址栏的，而是设置出征战术的地方」）：
'''
ui = rep1(ui, old_anchor, new_act, '3 出征页')

# ============ 4) 校场面板退役 → 练兵块 ============
i, e = func_span(ui, 'ui.openXiaochang = function () {', 'openXiaochang')
# 连带它上方的注释行 + 函数行缩进一起替换
head = "  /* 校场（v21 · 需求 1）：出征 + 伤兵营 */\n  "
assert ui[max(0, i - len(head)):i] == head, '校场头注释不在预期位置: ' + repr(ui[max(0, i - len(head)):i])
i = i - len(head)
new_xc = r'''  /* ⛔ v89.133（v89.128 第二批第 10 条 · 老板）：「校场不要现在的界面功能，点击建筑功能
     直接进入'军务'界面」—— 校场面板（openXiaochang）整条退役：
       · 出征 / 出征战术 → 「军务 · 出征 / 出征战术」页（main.js 的 open-xiaochang 改跳转）；
       · 伤兵营 → 「军务 · 军务处」（v89.116 起的唯一落点）；
       · 演武 / 阅兵（v89.80 练兵）→ 迁到「出征战术」页尾（见 ui.trainBlockHTML）。 */
  /* 练兵块（演武 / 阅兵）—— 校场面板退役后的新家：出征战术页尾（练兵 = 出征前的准备）。
     按钮与每日次数口径一字未动（xc-spar / xc-review / xcSparDoneToday）。 */
  ui.trainBlockHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!c) return '';
    var lv = GAME.buildingLevel(c, 'xiaochang') || 0;
    if (!lv) return '';
    var PX = GAME.xcCfg();
    var cand = (s.generals || []).filter(function (g) {
      return !GAME.isLordGeneral(g) && g.status !== 'march';
    }).sort(function (a, b) { return (b.level || 1) - (a.level || 1); });
    if (!ui._xcGen || !cand.some(function (g) { return g.id === ui._xcGen; })) {
      ui._xcGen = cand.length ? cand[0].id : '';
    }
    var sparCost = GAME.xcSparCostOf(lv);
    var sparDone = !ui._xcGen || GAME.xcSparDoneToday(ui._xcGen);
    var reviewDone = GAME.xcReviewDoneToday();
    return '<div class="story-card"><div class="gold-heading">🥋 练兵 · 校场 Lv' + lv +
        ui.help('演武：耗金 + 体力 → 得"本级所需经验"的 ' +
          Math.round((PX.sparExpPct || 0.08) * 100) + '%，**每位将领每日一次**。\n' +
          '阅兵：耗金粮 → 民心 +' + (PX.reviewHearts || 4) + '，**每日一次**。\n' +
          '君主修行另在君主面板（练功 / 突破）。') + '</div>' +
      '<div class="exp-sel" style="margin:4px 0 0;"><label>将领</label>' +
        '<select data-action="xc-gen-pick">' +
          (cand.length ? cand.map(function (g) {
            return '<option value="' + g.id + '"' + (g.id === ui._xcGen ? ' selected' : '') + '>' +
              U.escape(g.name) + '（Lv' + (g.level || 1) + ' · 体' + Math.round(GAME.staNow(g)) +
              (GAME.xcSparDoneToday(g.id) ? ' · 今日已演武' : '') + '）</option>';
          }).join('') : '<option value="">（城中暂无空闲将领）</option>') +
        '</select>' +
        '<button class="btn gold" data-action="xc-spar"' +
          (sparDone || !cand.length ? ' disabled' : '') + '>' +
          (sparDone ? '✅ 今日已演武'
            : '🎯 演武（金 ' + U.fmt(sparCost.gold) + ' · 体 ' + (PX.sparSta || 5) + '）') + '</button>' +
        '<button class="btn gold" data-action="xc-review"' + (reviewDone ? ' disabled' : '') + '>' +
          (reviewDone ? '✅ 今日已阅兵'
            : '🎖 阅兵（金 ' + U.fmt(PX.reviewGold || 0) + ' · 粮 ' + U.fmt(PX.reviewGrain || 0) + '）') + '</button>' +
      '</div></div>';
  };'''
ui = ui[:i] + new_xc + ui[e:]

# ============ 5) 建筑功能标签（校场） ============
old_lbl = '    xiaochang: { label: "🏹 出征 · 练兵 · 伤兵", act: "open-xiaochang" },\n'
new_lbl = '    xiaochang: { label: "🏹 进入军务（出征 · 练兵 · 伤兵）", act: "open-xiaochang" },\n'
ui = rep1(ui, old_lbl, new_lbl, '5 校场标签')

# 自检
for sent in ['ui.marchActHTML = function', 'ui.actTargetsOf = function', 'ui.trainBlockHTML = function',
             "['act', '出征']", "'exp', '出征战术'", "'def', '防守战术'"]:
    assert ui.count(sent) >= 1, '丢失哨兵: ' + sent
assert ui.count('ui.openXiaochang') == 0, 'openXiaochang 残留'
assert ui.count('data-action="xiaochang-exp"') == 0, '校场面板按钮残留'
assert ui.count("woundedBlock('xiaochang')") == 0, '校场伤兵块残留'
wr('js/ui.js', ui)

# ============ main.js ============
mj = rd('js/main.js')

old_c1 = ("      case 'open-xiaochang': ui.openXiaochang(); break;\n"
          "      /* v21：伤兵营现在开在**弹窗**里（校场 / 行军队列）。refreshAll 只重绘\n")
new_c1 = ("      /* v89.133（v89.128 第二批第 10 条）：「校场不要现在的界面功能，点击建筑功能\n"
          "         直接进入'军务'界面」—— 校场面板退役，点建筑功能 = 切到军务视图。 */\n"
          "      case 'open-xiaochang': ui.setView('marches'); ui._marchTab = 'over'; break;\n"
          "      /* v21：伤兵营现在开在**弹窗**里（校场 / 行军队列）。refreshAll 只重绘\n")
mj = rep1(mj, old_c1, new_c1, 'm1 校场落点')

old_c2 = ("      case 'xiaochang-exp': ui.closeModal(); ui.setView('map'); break;\n")
assert mj.count(old_c2) == 1, 'xiaochang-exp 锚点'
mj = mj.replace(old_c2, "      /* ⛔ v89.133 退役：'xiaochang-exp'（校场面板的「出兵地图」）—— 面板退役，\n"
                        "         出兵入口 = 地图点选 / 「军务 · 出征」页。 */\n")

old_c3 = "      case 'xc-spar': { var _xs = GAME.xcSpar(ui._xcGen); ui.toast(_xs.msg); ui.openXiaochang(); break; }\n"
new_c3 = ("      /* v89.133：练兵块迁到「出征战术」页尾 —— 重开面板改重绘当前视图 */\n"
          "      case 'xc-spar': { var _xs = GAME.xcSpar(ui._xcGen); ui.toast(_xs.msg); GAME.refreshView(); break; }\n")
mj = rep1(mj, old_c3, new_c3, 'm3 xc-spar')

old_c4 = "      case 'xc-review': { var _xr = GAME.xcReview(); ui.toast(_xr.msg); ui.openXiaochang(); break; }\n"
new_c4 = "      case 'xc-review': { var _xr = GAME.xcReview(); ui.toast(_xr.msg); GAME.refreshView(); break; }\n"
mj = rep1(mj, old_c4, new_c4, 'm4 xc-review')

old_c5 = ("      case 'jieyue-xc': {\n"
          "        var _jxR = GAME.jieyueExpand('xc', el.dataset.city);\n"
          "        ui.toast((_jxR.ok ? '🪓 ' : '⚠️ ') + _jxR.msg);\n"
          "        if (_jxR.ok) { GAME.refreshAll(); ui.openXiaochang(); }\n"
          "        break;\n"
          "      }\n")
new_c5 = ("      case 'jieyue-xc': {\n"
          "        var _jxR = GAME.jieyueExpand('xc', el.dataset.city);\n"
          "        ui.toast((_jxR.ok ? '🪓 ' : '⚠️ ') + _jxR.msg);\n"
          "        /* v89.133：入口在「军务 · 出征」页 —— refreshAll 重绘当前视图即可 */\n"
          "        if (_jxR.ok) GAME.refreshAll();\n"
          "        break;\n"
          "      }\n"
          "      /* v89.133（v89.128 第二批第 9/11 条）：出征页 —— 选目标 / 进军队行动 / 练兵选将 */\n"
          "      case 'exp-act-target': ui._actTarget = Number(el.value) || 0; break;\n"
          "      case 'exp-act-go': {\n"
          "        var _atl = ui.actTargetsOf(GAME.currentCity());\n"
          "        var _at = _atl[Number(ui._actTarget) || 0];\n"
          "        if (!_at) { ui.toast('请先选择目标'); break; }\n"
          "        ui.openExpModal(_at.tg);\n"
          "        break;\n"
          "      }\n"
          "      case 'xc-gen-pick': ui._xcGen = el.value; GAME.refreshView(); break;\n")
mj = rep1(mj, old_c5, new_c5, 'm5 jieyue-xc + 新动作')

assert mj.count('openXiaochang') == 0, 'main 里 openXiaochang 残留'
wr('js/main.js', mj)
print('OK · ui.js', len(ui), '· main.js', len(mj))
