# -*- coding: utf-8 -*-
"""v89.116 补丁 B：守城战报接**真沙盘**（老板需求 4）

口径：
  · 配方：atk = 来犯敌军（无将） / def = 我方守军 + 守将 + 城防 + 城墙 + 箭塔
  · `ourSide:'def'` = "哪一边是我"（界面据此把城墙画在右侧、标签反着写、可操作侧换成守方）
  · 顺带修两处静默失效：`sb.place`（地形贴图）从没被携带过；配方缺视角字段
纪律：备份已在 backup/v89116；逐处锚点 count==1；写后与备份比括号净变化。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


# ============================================================
# ① battle.js：配方带视角 / 城墙 / 地形；sandboxOf 把它们带出来
# ============================================================
edit('js/battle.js',
     """      /* 沙盘底图用：目标的地形/种类（纯画面，不参与任何结算） */
      place: extra.place || null,""",
     """      /* 沙盘底图用：目标的地形/种类（纯画面，不参与任何结算） */
      place: extra.place || null,
      /* v89.116（老板「守城的战报沙盘应当通用掠夺战斗的沙盘，并增加右侧（我方守城）
         的城墙示意」）：**视角** —— 沙盘画面上"哪一边是我"。
         'atk'（默认）= 我攻敌守（出征口径）；'def' = 我守敌攻（来袭口径）：
         界面据此把标签、可操作侧、城墙位置整个反过来。
         `wall`：城墙示意（等级 + 箭塔数），只有守城仗才有。 */
      ourSide: (extra.ourSide === 'def') ? 'def' : 'atk',
      wall: extra.wall || null,""",
     'battle.js 配方带视角')

edit('js/battle.js',
     """    return {
      field: init.field || 1, rounds: per.length, maxRounds: init.maxRounds || (GAME.tactic.MAX_ROUNDS || 30),
      ids: ids, init: init, frames: frames, per: per,
      towers: init.towers ? init.towers.start : 0,
      verify: verify,""",
     """    return {
      field: init.field || 1, rounds: per.length, maxRounds: init.maxRounds || (GAME.tactic.MAX_ROUNDS || 30),
      ids: ids, init: init, frames: frames, per: per,
      towers: init.towers ? init.towers.start : 0,
      /* v89.116：视角 / 城墙 / 地形随配方带出 ——
         ⚠️ `place` 此前**从没被携带过**（配方里存了，返回时丢了）：
            界面 `sdFieldHTML` 读 `sb.place` 取野地地形贴图，于是那张贴图一直没生效。 */
      ourSide: (rc.ourSide === 'def') ? 'def' : 'atk',
      wall: rc.wall || null,
      place: rc.place || null,
      verify: verify,""",
     'battle.js sandboxOf 带出')

# ============================================================
# ② state.js：来袭结算建配方 + 战报挂上沙盘
# ============================================================
edit('js/state.js',
     """    var defArmy0 = U.deep(city.army || {});        /* 战前快照（战报与配方用） */
    var result = null;
    try {
      result = GAME.tactic.simulate(ia.army, null, city.army, defVal, guard, {
        kind: 'city', sieging: true, defName: city.name,
        wallLv: wallLv, towers: towers, playerDef: true,
      });
    } catch (e) {""",
     """    var defArmy0 = U.deep(city.army || {});        /* 战前快照（战报与配方用） */
    /* v89.116：结算入参**先落成一个对象** —— 沙盘配方要用**与结算完全同一批输入**
       （另写一份必漂移；`sandboxRecipeOf` 内部会深拷贝，不会与本次结算互相污染）。 */
    var simOpts = {
      kind: 'city', sieging: true, defName: city.name,
      wallLv: wallLv, towers: towers, playerDef: true,
    };
    var result = null;
    try {
      result = GAME.tactic.simulate(ia.army, null, city.army, defVal, guard, simOpts);
    } catch (e) {""",
     'state.js 结算入参落对象')

edit('js/state.js',
     """    /* ---- 战报（v89.109：与出征同规格 —— 公文·战报页可见、可逐回合回放） ---- */
    if (result) {
      try {
        GAME.invasionReport(city, srcName, result, out, ia, defArmy0, guard);""",
     """    /* ---- v89.116（老板「守城的战报沙盘应当通用掠夺战斗的沙盘」）----
       防御战**照给沙盘配方**：视角 atk=来犯敌军 / def=我方守军（含出城迎战部队），
       城墙与箭塔一并入画。此前一律 `sandbox:null`（注释理由是"视角固定攻方，会把双方画反"）
       —— 正确解法是**给视角**，不是不给沙盘。 */
    if (result) {
      try {
        out._sandbox = GAME.battle.sandboxRecipeOf(result, ia.army, null, defArmy0, defVal, guard,
          simOpts, {
            place: { kind: 'city', name: city.name },
            ourSide: 'def',
            wall: { lv: wallLv, towers: towers },
          });
      } catch (e4) {
        out._sandbox = null;
        if (typeof console !== 'undefined' && console.warn) console.warn('[invasion] 沙盘配方异常：', e4);
      }
    }
    /* ---- 战报（v89.109：与出征同规格 —— 公文·战报页可见、可逐回合回放） ---- */
    if (result) {
      try {
        GAME.invasionReport(city, srcName, result, out, ia, defArmy0, guard);""",
     'state.js 建守城沙盘配方')

edit('js/state.js',
     """      scene: GAME.battle.compactScene(r),
      replay: GAME.battle.replayFramesOf(r),
      sandbox: null,          /* 见上方注释：视角固定攻方，防御战暂不适用 */""",
     """      scene: GAME.battle.compactScene(r),
      replay: GAME.battle.replayFramesOf(r),
      /* v89.116：防御战**给沙盘**（`out._sandbox` 由 invasionResolve 建好）——
         视角 `ourSide:'def'`：敌军在左、我军守城在右，城墙画在我方一侧。 */
      sandbox: out._sandbox || null,""",
     'state.js 战报挂沙盘')

# ============================================================
# ③ ui.js：沙盘按视角渲染（标签 / 可操作侧 / 城墙 / 列宽）
# ============================================================
edit('js/ui.js',
     """  /* 侧栏（我方 = 可操作；敌军 = 只读） */
  ui.sdRosterHTML = function (st, sb, side, lane) {
    var list = (side === 'atk') ? st.atk : st.def;
    var foe = (side === 'atk') ? st.def : st.atk;
    var rows = list.map(function (u) {
      var sts = '';
      if (side === 'atk') {
        sts = ['advance', 'hold', 'retreat'].map(function (s) {
          return '<span class="sd-chip' + (u.stance === s ? ' on' : '') + '" data-action="sd-stance"' +
            ' data-t="' + u.id + '" data-s="' + s + '">' + ui.SD_STANCE[s] + '</span>';
        }).join('');
      } else {
        sts = '<span class="sd-chip on ro">' + (ui.SD_STANCE[u.stance] || u.stance) + '</span>';
      }
      var opts = '<option value="">目标：任意</option>';
      foe.forEach(function (d) {
        opts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>' +
          '目标：' + U.escape(d.name) + '</option>';
      });
      if (st.towers > 0) {
        opts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '') +
          '>目标：城防箭塔</option>';
      }
      return '<div class="sd-row" data-row="' + side + '-' + u.id + '">' +
        '<span class="sd-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<b class="sd-cnt" id="sd-c-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
        '<span class="sd-chips">' + sts + '</span>' +
        (side === 'atk'
          /* id 实名在册（sd-t- 前缀，与战场界面同一命名习惯） */
          ? '<select class="sd-sel" id="sd-t-' + u.id + '" data-action="sd-target" data-t="' + u.id + '">' + opts + '</select>'
          : '') +
        '</div>';
    }).join('');
    return '<div class="sd-col ' + (side === 'atk' ? 'sd-mine' : 'sd-foe') + '" style="--lane:' + lane + 'px;">' + rows + '</div>';
  };""",
     """  /* ============================================================
   * v89.116（老板需求 4）：**沙盘视角** —— "哪一边是我"
   * ------------------------------------------------------------
   * 出征口径：我方 = atk（左）。来袭 / 守城口径：我方 = def（右，城墙那一侧）。
   * 一个字段决定四件事：标签（我军/敌军）、可操作侧、城墙画哪边、列宽配比。
   * 唯一出口 = 本函数组，界面各处不许再写死 'atk'。
   * ============================================================ */
  ui.sdOurSide = function (sb) { return (sb && sb.ourSide === 'def') ? 'def' : 'atk'; };
  ui.sdFoeSide = function (sb) { return ui.sdOurSide(sb) === 'atk' ? 'def' : 'atk'; };
  ui.sdIsMine = function (sb, side) { return ui.sdOurSide(sb) === side; };
  /* 显示名：视角中性（"我军"永远指玩家那一侧） */
  ui.sdSideName = function (sb, side) { return ui.sdIsMine(sb, side) ? '我军' : '敌军'; };
  /* 沙盘列宽：可操作的一侧给宽列（左宽右窄 / 左窄右宽，随视角翻） */
  ui.sdBoardCols = function (sb) {
    return ui.sdOurSide(sb) === 'def' ? '190px 1fr 306px' : '306px 1fr 190px';
  };

  /* 侧栏（我方 = 可操作；敌军 = 只读） */
  ui.sdRosterHTML = function (st, sb, side, lane) {
    var list = (side === 'atk') ? st.atk : st.def;
    var foe = (side === 'atk') ? st.def : st.atk;
    var mine = ui.sdIsMine(sb, side);
    var rows = list.map(function (u) {
      var sts = '';
      if (mine) {
        sts = ['advance', 'hold', 'retreat'].map(function (s) {
          return '<span class="sd-chip' + (u.stance === s ? ' on' : '') + '" data-action="sd-stance"' +
            ' data-t="' + u.id + '" data-s="' + s + '">' + ui.SD_STANCE[s] + '</span>';
        }).join('');
      } else {
        sts = '<span class="sd-chip on ro">' + (ui.SD_STANCE[u.stance] || u.stance) + '</span>';
      }
      var opts = '<option value="">目标：任意</option>';
      foe.forEach(function (d) {
        opts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>' +
          '目标：' + U.escape(d.name) + '</option>';
      });
      if (st.towers > 0) {
        opts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '') +
          '>目标：城防箭塔</option>';
      }
      return '<div class="sd-row" data-row="' + side + '-' + u.id + '">' +
        '<span class="sd-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<b class="sd-cnt" id="sd-c-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
        '<span class="sd-chips">' + sts + '</span>' +
        (mine
          /* id 实名在册（sd-t- 前缀，与战场界面同一命名习惯） */
          ? '<select class="sd-sel" id="sd-t-' + u.id + '" data-action="sd-target" data-t="' + u.id + '">' + opts + '</select>'
          /* v89.116：敌军侧也给一行只读的"目标"读数 —— 此前整列不显示目标，
             玩家看不出"它到底在打谁" */
          : '<span class="sd-sel ro">' + (u.target === DATA.TARGET_WALL ? '目标：城防箭塔'
            : (u.target ? ('目标：' + U.escape(((foe.filter(function (x) { return x.id === u.target; })[0] || {}).name || u.target)))
              : '目标：任意')) + '</span>') +
        '</div>';
    }).join('');
    return '<div class="sd-col ' + (mine ? 'sd-mine' : 'sd-foe') + '" style="--lane:' + lane + 'px;">' + rows + '</div>';
  };""",
     'ui.js 沙盘视角+侧栏')

edit('js/ui.js',
     """    return el('atk', 'sd-fl-a', aPct, '我军前线', !contact)
      + el('def', 'sd-fl-d', dPct, '敌军前线', !contact)
      + el('hit' + (fr.broke ? ' broke' : ''), 'sd-fl-c', cPct,
        fr.broke ? '被攻入腹地' : '接触线', contact);""",
     """    return el('atk', 'sd-fl-a', aPct, ui.sdSideName(sb, 'atk') + '前线', !contact)
      + el('def', 'sd-fl-d', dPct, ui.sdSideName(sb, 'def') + '前线', !contact)
      + el('hit' + (fr.broke ? ' broke' : ''), 'sd-fl-c', cPct,
        fr.broke ? ui.sdSideName(sb, fr.broke) + '被攻入腹地' : '接触线', contact);""",
     'ui.js 前线标签')

edit('js/ui.js',
     """    var wallIcon = (sb.towers > 0 && GAME.icons.bitmapSrc && GAME.icons.bitmapSrc('building', 'chengqiang'))
      ? '<img class="sd-wall" src="' + GAME.icons.bitmapSrc('building', 'chengqiang') + '" alt="">' : '';
    var tw = (sb.towers > 0)
      ? '<div class="sd-castle">🏯 箭塔 <b id="sd-tower">' + st.towers + '</b> / ' + sb.towers + '</div>' + wallIcon : '';
    return '<div class="sd-field" id="sd-field" style="height:' + (n * 2 * lane) + 'px;">' +
      '<div class="sd-ground"' + tex + '></div>' + lenes + toks + ui.sdLineHTML(st, sb) + tw +
      '<div class="sd-scale"><span>我军出发线</span><span>纵深 ' + U.numText(D, 0) + '</span><span>敌军出发线</span></div>' +
      '</div>';""",
     """    /* v89.116（老板「增加右侧（我方守城）的城墙示意」）：
       城墙画在**守方那一侧**（共享轴的右端）：
         · 守城仗（ourSide='def'）：那是我方城墙 —— 带上等级文字；
         · 攻城仗（ourSide='atk'）：那是敌方城墙，照旧只画工事。
       城墙**有没有**由 `sb.wall`（守城仗必给）或箭塔数决定 —— 0 级墙 + 0 塔的空城不画。 */
    var hasWall = !!(sb.wall ? (sb.wall.lv > 0 || sb.wall.towers > 0) : (sb.towers > 0));
    var wallImg = (hasWall && GAME.icons.bitmapSrc && GAME.icons.bitmapSrc('building', 'chengqiang'))
      ? '<img class="sd-wall" src="' + GAME.icons.bitmapSrc('building', 'chengqiang') + '" alt="">' : '';
    var wallLv = (sb.wall && sb.wall.lv) || 0;
    var wallTxt = hasWall
      ? '<div class="sd-castle">🧱 ' + (ui.sdOurSide(sb) === 'def' ? '我方城墙' : '敌方城墙')
          + (wallLv > 0 ? ' Lv' + wallLv : '')
          + (sb.towers > 0 ? '　🏯 箭塔 <b id="sd-tower">' + st.towers + '</b> / ' + sb.towers : '')
        + '</div>' + wallImg : '';
    return '<div class="sd-field" id="sd-field" style="height:' + (n * 2 * lane) + 'px;">' +
      '<div class="sd-ground"' + tex + '></div>' + lenes + toks + ui.sdLineHTML(st, sb) + wallTxt +
      '<div class="sd-scale"><span>' + ui.sdSideName(sb, 'atk') + '出发线</span><span>纵深 ' +
        U.numText(D, 0) + '</span><span>' + ui.sdSideName(sb, 'def') + '出发线</span></div>' +
      '</div>';""",
     'ui.js 城墙示意与出发线标签')

edit('js/ui.js',
     """      '<div class="sd-board" id="sd-board">' +
        ui.sdRosterHTML(st, sb, 'atk', lane) +
        ui.sdFieldHTML(st, sb, lane) +
        ui.sdRosterHTML(st, sb, 'def', lane) +
      '</div>' +""",
     """      '<div class="sd-board" id="sd-board" style="grid-template-columns:' + ui.sdBoardCols(sb) + ';">' +
        ui.sdRosterHTML(st, sb, 'atk', lane) +
        ui.sdFieldHTML(st, sb, lane) +
        ui.sdRosterHTML(st, sb, 'def', lane) +
      '</div>' +""",
     'ui.js 沙盘列宽')

edit('js/ui.js',
     """  /* 战况一句话（顶部）：接敌中 / 两军接触 / 被攻入腹地（战斗结束） */
  ui.sdPhaseText = function (fr) {
    if (fr.broke === 'atk') return '💥 我军被攻入腹地';
    if (fr.broke === 'def') return '💥 敌军被攻入腹地';
    if (fr.contact) return '⚔ 两军接触中';
    return '➤ 接敌中';
  };
  ui.sdSideTotals = function (st) {
    var a = 0, d = 0;
    st.atk.forEach(function (u) { a += u.count; });
    st.def.forEach(function (u) { d += u.count; });
    return '我 <b id="sd-ta">' + U.fmt(a) + '</b>　敌 <b id="sd-td">' + U.fmt(d) + '</b>';
  };""",
     """  /* 战况一句话（顶部）：接敌中 / 两军接触 / 被攻入腹地（战斗结束）
     v89.116：口径按**视角**给（守城仗里"被攻入腹地"的是我方守军） */
  ui.sdPhaseText = function (fr, sb) {
    if (fr.broke) return '💥 ' + ui.sdSideName(sb, fr.broke) + '被攻入腹地';
    if (fr.contact) return '⚔ 两军接触中';
    return '➤ 接敌中';
  };
  ui.sdSideTotals = function (st, sb) {
    var a = 0, d = 0;
    st.atk.forEach(function (u) { a += u.count; });
    st.def.forEach(function (u) { d += u.count; });
    var mine = ui.sdOurSide(sb) === 'atk' ? a : d;
    var foe = ui.sdOurSide(sb) === 'atk' ? d : a;
    return '我 <b id="sd-ta">' + U.fmt(mine) + '</b>　敌 <b id="sd-td">' + U.fmt(foe) + '</b>';
  };""",
     'ui.js 战况与总数视角')

edit('js/ui.js',
     """        '<span id="sd-phase">' + ui.sdPhaseText(fr) + '</span>' +
        '<span>帧 <b id="sd-pos">' + sd.i + '</b> / ' + sb.frames.length + '</span>' +
        '<span id="sd-side-txt">' + ui.sdSideTotals(st) + '</span>' +""",
     """        '<span id="sd-phase">' + ui.sdPhaseText(fr, sb) + '</span>' +
        '<span>帧 <b id="sd-pos">' + sd.i + '</b> / ' + sb.frames.length + '</span>' +
        '<span id="sd-side-txt">' + ui.sdSideTotals(st, sb) + '</span>' +""",
     'ui.js 顶部调用点')

# 指令写入 / 推演：都改走"我方那一侧"
edit('js/ui.js',
     """    var u = null;
    sd.cur.atk.forEach(function (x) { if (x.id === tid) u = x; });""",
     """    var u = null;
    /* v89.116：可操作侧 = 视角给的"我方"（守城仗里是 def） */
    (ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def).forEach(function (x) { if (x.id === tid) u = x; });""",
     'ui.js sdSetCmd 视角')

edit('js/ui.js',
     """    var sim = sd.sim, env = sim.env, sb = sd.sb;
    for (var tid in sim.cmds) env.setCmd('atk', tid, sim.cmds[tid]);""",
     """    var sim = sd.sim, env = sim.env, sb = sd.sb;
    var _our = ui.sdOurSide(sb);
    for (var tid in sim.cmds) env.setCmd(_our, tid, sim.cmds[tid]);""",
     'ui.js 推演指令侧')

edit('js/ui.js',
     """    var box = document.getElementById('bt-cmd');
    var snap = rec.snapLast || (ses ? ses.snap() : null);
    if (box && snap) box.outerHTML = ui.btCmdHTML(rec, snap);""",
     """    var box = document.getElementById('bt-cmd');
    var snap = rec.snapLast || (ses ? ses.snap() : null);
    if (box && snap) box.outerHTML = ui.btCmdHTML(rec, snap);""",
     'noop')      # 占位（避免空 EDITS 段）


# ---------------- 执行 ----------------
def main():
    EDITS[:] = [e for e in EDITS if e[3] != 'noop']
    files = {}
    for path, old, new, tag in EDITS:
        p = R + path
        if p not in files:
            files[p] = io.open(p, encoding='utf-8').read()
        s = files[p]
        n = s.count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次（要求 1）→ 中止' % (tag, n))
            return 1
        files[p] = s.replace(old, new, 1)
        print('  ✓ %s' % tag)
    bak = R + '.workbuddy/backup/v89116/'
    for p, s in files.items():
        assert '<<<<<<<' not in s and '>>>>>>>' not in s, p
        b = io.open(bak + os.path.basename(p), encoding='utf-8').read()
        d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
        if d0 != 0:
            print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
            return 1
        tmp = p + '.tmp116b'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(p), d0))
    print('补丁 B 完成')
    return 0


sys.exit(main())
