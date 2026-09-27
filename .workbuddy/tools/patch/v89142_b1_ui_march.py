# v89.142 B1：ui.js —— 军务出征页目标 5 类分行 + 底部按钮；两战术页小页按钮移到底部
# 跑法：python .workbuddy/tools/patch/v89142_b1_ui_march.py
import io
P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/ui.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ============ ① 目标候选：actTargetsOf → 5 类分组出口组 ============
old_a = """  ui._actTarget = 0;
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
  };"""
new_a = """  /* ============================================================
   * v89.142（老板 2）：「目标分成 5 类，分行显示：我方城池 / 我方野地 / 名城 /
   *   野地 / 野外据点。进入军事行动这个按钮放在界面底部」
   * ------------------------------------------------------------
   * **分组候选的唯一出口**（渲染 / 提交 / 探针 / 断言全读它，不许各列一份）：
   *   · 我方城池 / 我方野地 —— **全境**（不限距离）；
   *   · 名城（NPC 县·郡·州·都）—— 按距离排序取**最近 N_LIST**处（全图百余座，全列没意义）；
   *   · 野地（中立）—— 本城周边（半径 SCAN）内按距离取**最近 N_LIST**处；
   *   · 野外据点 —— 本城 **14 格内**（与 expTargetCandidates 同一把尺），取最近 N_LIST。
   * 每组带 `total`（截断前的总数）—— 界面用「共 N 处 · 列出最近 24」如实交代，
   * 不给"列了 24 个就以为全图只有 24 个"的假象。
   * 旧的 `ui.actTargetsOf`（v89.133 的"一锅烩扁平列表"）随本需求整条退役。
   * ============================================================ */
  ui.ACT_LIST_N = 24;
  ui.actTargetGroups = function (c) {
    var s = GAME.state;
    c = c || GAME.currentCity();
    if (!c) return [];
    var N = ui.ACT_LIST_N;
    var dist = function (x, y) { return Math.max(Math.abs(x - c.x), Math.abs(y - c.y)); };
    var groups = [
      { key: 'owncity', label: '🏯 我方城池', targets: [] },
      { key: 'ownwild', label: '🌾 我方野地', targets: [] },
      { key: 'npc', label: '🏛️ 名城', targets: [] },
      { key: 'wild', label: '🗺️ 野地', targets: [] },
      { key: 'fort', label: '🏕️ 野外据点', targets: [] },
    ];
    var by = {};
    groups.forEach(function (g) { by[g.key] = g; });
    /* ① 我方城池（全境）—— 派遣 / 运输都从这里发起 */
    (s.cities || []).forEach(function (mc) {
      if (mc.id === c.id) return;
      by.owncity.targets.push({ d: dist(mc.x, mc.y),
        label: '🏯 ' + mc.name + '（己方 · 城池间操作）',
        tg: { kind: 'own', id: mc.id } });
    });
    /* ② 我方野地（全境）—— 驻军 / 采集 / 撤回 */
    (s.wilds || []).forEach(function (w) {
      var t = DATA.TERRAIN[w.type] || { name: w.type };
      var gn = GAME.wildGarrisonTotal(w.garrison);
      by.ownwild.targets.push({ d: dist(w.x, w.y),
        label: '🌾 ' + t.name + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）'
          + (gn > 0 ? '　· 驻军 ' + U.numText(gn, 0) : '　· 无驻军'),
        tg: { kind: 'wild', x: w.x, y: w.y } });
    });
    /* ③ 名城（NPC 城池 —— 县/郡/州/都，按距离取最近 N 处） */
    (s.map.cities || []).forEach(function (nc) {
      by.npc.targets.push({ d: dist(nc.x, nc.y),
        label: ui.expTargetLabel({ kind: 'city', id: nc.id, npc: nc }),
        tg: { kind: 'city', id: nc.id, npc: nc } });
    });
    /* ④ 野地（中立）—— 本城周边扫一圈（半径 20），按距离取最近 N 处。
       排除：我方野地格 / NPC 城池格 / 据点格（那些格子另有归组）。 */
    var SCAN = 20;
    for (var dy = -SCAN; dy <= SCAN; dy++) {
      for (var dx = -SCAN; dx <= SCAN; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
        if (GAME.map.wildAt(x, y)) continue;                        /* 我方野地 → ② */
        if (GAME.map.npcAt && GAME.map.npcAt(x, y)) continue;       /* 名城格 → ③ */
        if (GAME.map.fortAt && GAME.map.fortAt(x, y)) continue;     /* 据点格 → ⑤ */
        var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : 0;
        if (!(lv > 0)) continue;
        by.wild.targets.push({ d: Math.max(Math.abs(dx), Math.abs(dy)),
          label: '🗺️ 野地 Lv' + lv + '（' + x + ',' + y + '）',
          tg: { kind: 'wild', x: x, y: y } });
      }
    }
    /* ⑤ 野外据点（本城 14 格内 —— 与 expTargetCandidates 同一半径） */
    var R = 14;
    for (var fy = -R; fy <= R; fy++) {
      for (var fx = -R; fx <= R; fx++) {
        var fxx = c.x + fx, fyy = c.y + fy;
        if (fxx < 0 || fyy < 0 || fxx >= DATA.MAP_W || fyy >= DATA.MAP_H) continue;
        var f = GAME.map.fortAt ? GAME.map.fortAt(fxx, fyy) : null;
        if (!f) continue;
        by.fort.targets.push({ d: Math.max(Math.abs(fx), Math.abs(fy)),
          label: '🏕️ ' + GAME.fortLabelOf(f) + '（Lv' + (f.level || 1) + '）',
          tg: { kind: 'fort', x: fxx, y: fyy } });
      }
    }
    groups.forEach(function (g) {
      g.targets.sort(function (a, b) { return a.d - b.d; });
      g.total = g.targets.length;
      if (g.targets.length > N) g.targets = g.targets.slice(0, N);
    });
    return groups;
  };
  /* 当前选中的目标（**唯一出口**）：`ui._actPick = {grp, idx}` 由下拉 change 落库，
     按钮与断言都读这里 —— 不许渲染时"看着像选中"而提交时另算一个（v89.30 的教训）。 */
  ui._actPick = null;
  ui.actPickOf = function () {
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
  };"""
rep(old_a, new_a, '①目标分组出口')

# ============ ② marchActHTML：5 类分行 + 底部"进入军事行动" ============
old_b = """  ui.marchActHTML = function () {
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
        ui.help('目标来源：\\n· 我方野地 / 我方城池 —— 全境（不限距离）；\\n'
          + '· 同县普通城池 —— 同县；\\n· 野外据点 —— 本城 14 格内；\\n'
          + '· 其余目标（名城 / 远据点 / 中立野地）—— 地图点选。\\n'
          + '选定后进入**军队行动界面**（与地图点野地弹出的是同一个界面）。') + '</div>' +
      '<div class="exp-sel" style="margin:6px 0 4px;"><label>目标</label>' +
        '<select class="city-select" data-action="exp-act-target">' +
          (list.length ? list.map(function (o, i) {
            return '<option value="' + i + '"' + (i === ui._actTarget ? ' selected' : '') + '>' +
              U.escape(o.label) + '</option>';
          }).join('') : '<option value="">（暂无可选目标）</option>') +
        '</select>' +
        '<button class="btn gold" data-action="exp-act-go"' + (list.length ? '' : ' disabled') +
          '>进入军队行动 →</button></div>' +
      '<div class="ui-sub">目标范围：我方野地 / 我方城池 —— <b>全境</b>；同县普通城池 —— 同县；'
        + '野外据点 —— 本城 <b>14 格内</b>；其余目标（名城 / 远据点 / 中立野地）→ '
        + '<b>在地图上点选</b>（点野地 / 据点 / 名城即弹出同一界面）。</div></div>' +"""
new_b = """  ui.marchActHTML = function () {
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    var groups = ui.actTargetGroups(c);
    var pick = ui.actPickOf();
    var anyTarget = groups.some(function (g) { return g.targets.length > 0; });
    var cap = GAME.battle.marchCapOf(c);
    var xcLv = GAME.buildingLevel(c, 'xiaochang') || 0;
    var jx = GAME.jieyueExpandOf(c, 'xc');
    var _jxTxt = (jx.used >= jx.max)
      ? '本城已满 ' + jx.used + '/' + jx.max
      : '本城 ' + jx.used + '/' + jx.max + '　持符 ' + GAME.jieyueOf();
    /* v89.142（老板 2）：目标**分 5 类、各占一行**（我方城池 / 我方野地 / 名城 /
       野地 / 野外据点）—— 每类一个下拉，选中项落库 ui._actPick；
       「进入军事行动」按钮移到**界面底部**（页面最末）。 */
    var rows = groups.map(function (g) {
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
    }).join('');
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '一切军事行动的入口：选目标 → 进军队行动界面（编队 / 战术 / 计略都在里面）</div>' +
      '<div class="story-card"><div class="gold-heading">⚔️ 出征 · 目标' +
        ui.help('目标按**五类分行**列出：\\n· 我方城池 / 我方野地 —— 全境（不限距离）；\\n'
          + '· 名城（县·郡·州·都）/ 野地（中立）—— 按距离列出最近 ' + ui.ACT_LIST_N + ' 处；\\n'
          + '· 野外据点 —— 本城 14 格内。\\n'
          + '选定后进入**军队行动界面**（与地图点野地弹出的是同一个界面）。') + '</div>' +
      rows +
      '<div class="ui-sub" style="margin-top:4px;">目标范围：我方城池 / 我方野地 —— <b>全境</b>；'
        + '名城 / 野地 —— 按距离取最近 ' + ui.ACT_LIST_N + ' 处；野外据点 —— 本城 <b>14 格内</b>；'
        + '其余远处目标仍可<b>在地图上点选</b>。</div></div>' +"""
rep(old_b, new_b, '②出征页5类分行')

# ②b 底部操作条（插在编制卡之后）
old_c = """      '<div class="auto-line"><button class="btn" data-action="jieyue-xc" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 校场扩编（' + _jxTxt + '）</button>' +
        '<span class="ui-sub">出征容量 +1 万人马（等效校场 +1 级）</span></div></div>';
  };"""
new_c = """      '<div class="auto-line"><button class="btn" data-action="jieyue-xc" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 校场扩编（' + _jxTxt + '）</button>' +
        '<span class="ui-sub">出征容量 +1 万人马（等效校场 +1 级）</span></div></div>' +
      /* v89.142（老板 2）：**「进入军事行动」按钮放界面底部** —— 页面最末的独立操作条；
         上方一行写明"当前选中的是哪个目标"（5 个下拉，必须说清按钮会去哪一个）。 */
      '<div class="ui-sub" style="text-align:center;margin:10px 0 2px;">当前目标：<b>' +
        (pick ? U.escape(pick.label) : '（尚未选择）') + '</b></div>' +
      '<div class="exp-foot" style="justify-content:center;">' +
        '<button class="btn gold" data-action="exp-act-go"' + (anyTarget ? '' : ' disabled') +
          ' style="min-width:240px;font-size:var(--fs-h1);">⚔️ 进入军事行动 →</button></div>';
  };"""
rep(old_c, new_c, '②b底部操作条')

# ============ ③ 出征战术页：小页按钮移到底部 ============
old_d = """      tabs +
      '<div class="ui-sub" style="margin:2px 0 6px;">当前（' +
        (tsub === 'raid' ? '掠夺' : '占领') + '）：' + GAME.tacticSummary(tsub) + '</div>' +
      ui.tacticBlockHTML(tsub) + '</div>';
  };"""
new_d = """      '<div class="ui-sub" style="margin:2px 0 6px;">当前（' +
        (tsub === 'raid' ? '掠夺' : '占领') + '）：' + GAME.tacticSummary(tsub) + '</div>' +
      ui.tacticBlockHTML(tsub) + '</div>' +
      /* v89.142（老板 3）：「掠夺战术和占领战术按钮放在界面底部」
         —— 与防守战术页的小页按钮**位置与图标风格保持一致**（都在卡片下方） */
      tabs;
  };"""
rep(old_d, new_d, '③出征战术页按钮移底')

# ============ ④ 防守战术页：两个分支的小页按钮都移到底部 ============
old_e = """    if (sub === 'tac') {
      return tabs + '<div class="story-card"><div class="gold-heading">⚔️ 防守战术' +
        ui.help('我方城池被攻打时，守军按**这套设置**作战（NPC 守方不用你的设置）。\\n'
          + '每兵种两栏下拉：动作 + 目标，与出征战术同一套控件。\\n'
          + '「**出城迎战**」= 该兵种前出城墙之外迎敌：攻方必须先把它打完，才够得着城墙拆工事；\\n'
          + '但它也吃不到城墙护佑 —— 是把前线前移的进攻性防御，代价与收益都归自己。') + '</div>' +
        ui.tacticBlockHTML('def') + '</div>';
    }"""
new_e = """    if (sub === 'tac') {
      /* v89.142（老板 4）：「防守战术和全境防御按钮放在界面底部」—— 与出征战术页同款位置 */
      return '<div class="story-card"><div class="gold-heading">⚔️ 防守战术' +
        ui.help('我方城池被攻打时，守军按**这套设置**作战（NPC 守方不用你的设置）。\\n'
          + '每兵种两栏下拉：动作 + 目标，与出征战术同一套控件。\\n'
          + '「**出城迎战**」= 该兵种前出城墙之外迎敌：攻方必须先把它打完，才够得着城墙拆工事；\\n'
          + '但它也吃不到城墙护佑 —— 是把前线前移的进攻性防御，代价与收益都归自己。') + '</div>' +
        ui.tacticBlockHTML('def') + '</div>' + tabs;
    }"""
rep(old_e, new_e, '④防守战术页-战术分支')

old_f = """    return tabs + '<div class="story-card"><div class="gold-heading">🛡️ 全境防御' +
      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 城墙/城主智谋加成)（与来袭结算同一出口 defensePowerOf）。\\n'"""
new_f = """    return '<div class="story-card"><div class="gold-heading">🛡️ 全境防御' +
      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 城墙/城主智谋加成)（与来袭结算同一出口 defensePowerOf）。\\n'"""
rep(old_f, new_f, '④防守战术页-体检分支头')

old_g = """        : '<div class="q-empty">尚无城池。</div>') + '</div>';
  };
  /* —— 军务处：两营并列（v89.132 起只此两块；动作全部复用既有出口） —— */"""
new_g = """        : '<div class="q-empty">尚无城池。</div>') + '</div>' + tabs;
  };
  /* —— 军务处：两营并列（v89.132 起只此两块；动作全部复用既有出口） —— */"""
rep(old_g, new_g, '④防守战术页-体检分支尾')

# 自检 + 落盘
assert 'ui.actTargetsOf = function' not in s, '旧扁平出口残留'
assert 'ui.actTargetsOf(c)' not in s, '旧扁平出口被调用'
assert s.count('ui.actTargetGroups = function') == 1
assert s.count('ui.actPickOf = function') == 1
assert s.count("data-action=\"exp-act-pick\"") == 1
assert s.count("data-action=\"exp-act-go\"") == 1
assert 'ui._actTarget' not in s, '旧下标状态残留'
assert '\r\n' not in s, '行尾被写成 CRLF'
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE ui.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
