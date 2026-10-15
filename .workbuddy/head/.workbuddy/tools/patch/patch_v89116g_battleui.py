# -*- coding: utf-8 -*-
"""v89.116 补丁 G：实时战斗界面重排（老板需求 8）+ 敌方默认目标口径

老板原话：「实时战斗界面，上部分：最左边及最右边四分之一为双方兵种列表，
数量显示及行动设置，前进驻守撤退通过下拉框选择，不要直接列出，节省空间。
中间二分之一显示战场，战场中不直接只显示兵种图标，不显示数量，
数量直接在左右兵种列表的图标下。敌方兵种默认前进且目标为自身兵种。
战场间距似乎不对，确认间距规则。战况回合播报放在下部分，行动和战果写在同一行，
避免太多行」

落法：
  · 上部分 = `1fr 2fr 1fr` 三列（左我军 / 中战场 / 右敌军）；
  · 战场令牌**只画图标**（数量移到左右列表的图标下，id 不变 → btSyncCounts 照旧）；
  · 动作改**下拉框**（前进/驻守/后退），目标仍是下拉框；
  · 敌方默认：动作=前进、**目标=我方同兵种**（引擎级默认，见 tactic.unitsOf 的 foeArmy）；
  · 战况播报移到底部，**一回合一行**（行动 + 战果同行）；
  · 间距读数修正：开打前不再把"纵深"当"间距"显示（原 `snap.field` 兜底是错的）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


# ============================================================
# ① 引擎：NPC 侧的默认目标 = 我方同兵种
# ============================================================
edit('js/tactic.js',
     """      var tc = (ctx && ctx.override && ctx.override[id])
        || (GAME.tacticOf ? GAME.tacticOf(side, id, ctx) : null);
      var stance = tc ? tc.s : 'advance';""",
     """      var tc = (ctx && ctx.override && ctx.override[id])
        || (GAME.tacticOf ? GAME.tacticOf(side, id, ctx) : null);
      var stance = tc ? tc.s : 'advance';
      /* v89.116（老板「敌方兵种默认前进且目标为自身兵种」）——
         **NPC 那一侧**（`ctx.foeArmy` 有值 = 对面就是玩家）若没指定目标，
         默认打**与我方同兵种**的那支部队（我方没有该兵种 → 保持"任意"）。
         为什么放在引擎里：默认值必须进 `unitsInit`（战报配方就是从它重跑的），
         放在界面里改 = 沙盘重跑与史实不一致（verify 会红）。
         只给 NPC 侧：玩家部队的默认值由「出征 / 防守战术」给，不被这里改写。 */
      var tgt = tc ? (tc.t || '') : '';
      if (!tgt && ctx && ctx.foeArmy && (ctx.foeArmy[id] || 0) > 0) tgt = id;""",
     'tactic.js NPC 默认目标')

edit('js/tactic.js',
     """        stance: stance,
        target: tc ? tc.t : '',""",
     """        stance: stance,
        target: tgt,""",
     'tactic.js target 用 tgt')

edit('js/tactic.js',
     """    var atk = T.unitsOf(atkArmy, 'atk', atkGen,
      { sieging: !!opts.sieging, override: stances.atk || null });
    var def = T.unitsOf(defArmy, 'def', defGen,
      /* v89.109：`playerDef` = 守方是**我方城池**（防御战）→ 读玩家「防守战术」设置；
         NPC 守方不传（仍用默认动作）—— 见 GAME.tacticOf 的 def 分支。 */
      { sieging: !!opts.sieging, playerDef: !!opts.playerDef, override: stances.def || null });""",
     """    /* v89.116：`foeArmy` 传"对面那支军队" —— 引擎据它给 **NPC 侧**一个默认目标
       （同兵种）。玩家在哪一侧由 `playerDef` 决定：默认玩家是攻方 → NPC 是守方。 */
    var atk = T.unitsOf(atkArmy, 'atk', atkGen,
      { sieging: !!opts.sieging, override: stances.atk || null,
        foeArmy: opts.playerDef ? defArmy : null });
    var def = T.unitsOf(defArmy, 'def', defGen,
      /* v89.109：`playerDef` = 守方是**我方城池**（防御战）→ 读玩家「防守战术」设置；
         NPC 守方不传（仍用默认动作）—— 见 GAME.tacticOf 的 def 分支。 */
      { sieging: !!opts.sieging, playerDef: !!opts.playerDef, override: stances.def || null,
        foeArmy: opts.playerDef ? null : atkArmy });""",
     'tactic.js begin 传 foeArmy')

# ============================================================
# ② 战场界面：三列布局
# ============================================================
edit('js/ui.js',
     """  /* ---- 顶部条 ---- */
  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    return '<div class="bt-top">' +
      '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
      '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
      '<span id="bt-gap">间距 ' + U.numText(rec.gapLast == null ? (snap.field || 0) : rec.gapLast, 0) + '</span>' +
      '<span class="bt-hint">设置完点「完成回合」立即结算；到点自动结算</span>' +
      '</div>';
  };""",
     """  /* 间距读数（唯一出口）：**开打前**也要给真间距，不能拿"纵深"顶替 ——
     v89.116（老板「战场间距似乎不对，确认间距规则」）实证：
       旧代码 `rec.gapLast == null ? snap.field : rec.gapLast` 在第一帧之前
       显示的是**纵深 1400**（整片战场），而真实间距是 1400−100−100 = **1200**。
     间距规则（引擎 frontsOf 唯一出口）：
       posA = 我方最前推进度；posD = 纵深 − 敌方最前推进度；
       gap = max(0, posD − posA)；两军各自推进到"进入自己有效射程"就停 → gap 会稳定在
       较近战的一方射程上（长枪对长枪实测稳定在 50）。 */
  ui.btGapOf = function (rec, snap) {
    if (rec && rec.gapLast != null) return rec.gapLast;
    try { return GAME.tactic.frontsOf(snap.atk || [], snap.def || [], snap.field || 1).gap; }
    catch (e) { return null; }
  };
  /* ---- 顶部条 ---- */
  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    var gp = ui.btGapOf(rec, snap);
    return '<div class="bt-top">' +
      '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
      '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
      '<span id="bt-gap" title="两军最前线之间的距离（纵深 − 双方推进度）；推进到进入射程即停">间距 '
        + (gp == null ? '—' : U.numText(gp, 0)) + '</span>' +
      '<span class="bt-hint">动作/目标用左侧下拉框设置；点「完成回合」立即结算，到点自动结算</span>' +
      '</div>';
  };""",
     'ui.js btTopHTML 间距口径')

edit('js/ui.js',
     """  /* ---- 战场条：双方单位卡（绝对定位，left 过渡即位移动画） ---- */
  ui.btFieldHTML = function (snap) {
    var D = snap.field || 1;
    /* v89.103：两军共用一条距离轴 → 交战时会在同一 x 上照面。
       于是敌方每队**下移半行**（21px）——"我方第 i 队 vs 敌方第 i 队"上下相邻，
       兵牌不会互相遮住，接触时看起来就是"贴上了"。 */
    function uHTML(u, idx, side) {
      return '<div class="bt-unit ' + side + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;top:' + (idx * 42 + (side === 'def' ? 21 : 0)) + 'px;">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<span class="bt-nm">' + U.escape(u.name) + '</span>' +
        '<b class="bt-n" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b></div>';
    }
    var atkH = (snap.atk || []).map(function (u, i) { return uHTML(u, i, 'atk'); }).join('');
    var defH = (snap.def || []).map(function (u, i) { return uHTML(u, i, 'def'); }).join('');
    var cast = snap.towers
      ? '<div class="bt-castle">🏯 箭塔 <b id="bt-tower">' + snap.towers.left + '</b> / ' + snap.towers.start + '</div>'
      : '';
    var h = Math.max(2, Math.max((snap.atk || []).length, (snap.def || []).length)) * 42 + 21 + 14;
    return '<div class="bt-field" id="bt-field" style="height:' + h + 'px;">' + atkH + defH + cast + '</div>';
  };""",
     """  /* ---- 战场条：**只画兵种图标**（数量在两侧列表的图标下 —— 老板需求 8） ---- */
  ui.btFieldHTML = function (snap) {
    var D = snap.field || 1;
    /* v89.103：两军共用一条距离轴 → 交战时会在同一 x 上照面。
       于是敌方每队**下移半行**（21px）——"我方第 i 队 vs 敌方第 i 队"上下相邻，
       兵牌不会互相遮住，接触时看起来就是"贴上了"。
       v89.116：令牌内容收敛为**一枚图标** —— 名称与数量都不在场上（数量看左右列表）。 */
    function uHTML(u, idx, side) {
      return '<div class="bt-unit ' + side + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'title="' + U.escape(u.name) + '" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;top:' + (idx * 42 + (side === 'def' ? 21 : 0)) + 'px;">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span></div>';
    }
    var atkH = (snap.atk || []).map(function (u, i) { return uHTML(u, i, 'atk'); }).join('');
    var defH = (snap.def || []).map(function (u, i) { return uHTML(u, i, 'def'); }).join('');
    var cast = snap.towers
      ? '<div class="bt-castle">🏯 箭塔 <b id="bt-tower">' + snap.towers.left + '</b> / ' + snap.towers.start + '</div>'
      : '';
    var h = Math.max(2, Math.max((snap.atk || []).length, (snap.def || []).length)) * 42 + 21 + 14;
    return '<div class="bt-field" id="bt-field" style="height:' + h + 'px;">' + atkH + defH + cast + '</div>';
  };

  /* ============================================================
   * v89.116（老板需求 8）：两侧兵种列表（各占 1/4）
   * ------------------------------------------------------------
   * 一行 = 图标 + **图标下的数量** + 动作下拉 + 目标下拉。
   *  · 我方（atk）：两个下拉都可改（动作 = 前进 / 驻守 / 后退；目标 = 敌方兵种 / 箭塔）；
   *  · 敌方（def）：**只读**，默认动作=前进、目标=我方同兵种（引擎级默认，见 tactic.unitsOf）。
   * 动作从"三个并排按钮"改成**一个下拉框**（老板：「不要直接列出，节省空间」）——
   * 下拉走既有 `change → GAME.action` 分发（main.js），动作名 `bt-stance` 不变。
   * ============================================================ */
  ui.btSideHTML = function (snap, side) {
    var foeList = (side === 'atk') ? (snap.def || []) : (snap.atk || []);
    var mine = (side === 'atk');
    var rows = ((side === 'atk') ? (snap.atk || []) : (snap.def || [])).map(function (u) {
      var alive = u.count > 0;
      var stOpts = ['advance', 'hold', 'retreat'].map(function (s) {
        return '<option value="' + s + '"' + ((u.stance || 'advance') === s ? ' selected' : '') + '>'
          + ui.btStanceName[s] + '</option>';
      }).join('');
      var tOpts = '<option value="">目标：任意</option>';
      foeList.forEach(function (d) {
        tOpts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>目标：'
          + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        tOpts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '')
          + '>目标：城防箭塔</option>';
      }
      return '<div class="bt-rrow' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        '<span class="bt-ric" title="' + U.escape(u.name) + '">' +
          '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
          '<b class="bt-rn" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
          '<i class="bt-rnm">' + U.escape(u.name) + '</i></span>' +
        (mine
          ? '<select class="bt-sel" data-action="bt-stance" data-troop="' + u.id + '" id="bt-s-' + u.id + '">'
              + stOpts + '</select>' +
            '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '" id="bt-t-' + u.id + '">'
              + tOpts + '</select>'
          : '<span class="bt-ro">' + (ui.btStanceName[u.stance] || u.stance) + '</span>' +
            '<span class="bt-ro">' + (u.target === DATA.TARGET_WALL ? '目标：城头箭塔'
              : (u.target ? ('目标：' + U.escape(((foeList.filter(function (x) { return x.id === u.target; })[0] || {}).name || u.target)))
                : '目标：任意')) + '</span>') +
        '</div>';
    }).join('');
    return '<div class="bt-side ' + (mine ? 'mine' : 'foe') + '" id="bt-side-' + side + '">' +
      '<div class="bt-side-h">' + ui.btSideName(side) + '（' + ((side === 'atk') ? (snap.atk || []) : (snap.def || [])).length + ' 队）</div>' +
      (rows || '<div class="q-empty">无</div>') + '</div>';
  };
  /* 上部分整块（左我军 · 中战场 · 右敌军） */
  ui.btBoardHTML = function (snap) {
    return '<div class="bt-board" id="bt-board">' +
      ui.btSideHTML(snap, 'atk') + ui.btFieldHTML(snap) + ui.btSideHTML(snap, 'def') + '</div>';
  };""",
     'ui.js 战场三列')

edit('js/ui.js',
     """  ui.battlefieldHTML = function (rec) {
    var ses = GAME._bsess && GAME._bsess[rec.id];
    var snap = rec.snapLast || (ses ? ses.snap() : null) ||
      { round: rec.round || 0, field: 0, atk: [], def: [], towers: null };
    return ui.btTopHTML(rec, snap) + ui.btFieldHTML(snap) +
      '<div class="bt-log" id="bt-log"></div>' + ui.btCmdHTML(rec, snap);
  };""",
     """  ui.battlefieldHTML = function (rec) {
    var ses = GAME._bsess && GAME._bsess[rec.id];
    var snap = rec.snapLast || (ses ? ses.snap() : null) ||
      { round: rec.round || 0, field: 0, atk: [], def: [], towers: null };
    /* v89.116（老板需求 8）：上 = 三列（兵种列表 · 战场 · 兵种列表）；
       下 = **战况回合播报**（一回合一行，行动与战果同行）。 */
    return ui.btTopHTML(rec, snap) + ui.btBoardHTML(snap) +
      '<div class="bt-log" id="bt-log"></div>';
  };""",
     'ui.js battlefieldHTML 布局')

# 指令写入：刷新三列（原来刷 #bt-cmd）
edit('js/ui.js',
     """    var box = document.getElementById('bt-cmd');
    var snap = rec.snapLast || (ses ? ses.snap() : null);
    if (box && snap) box.outerHTML = ui.btCmdHTML(rec, snap);
  };""",
     """    var box = document.getElementById('bt-board');
    var snap = rec.snapLast || (ses ? ses.snap() : null);
    if (box && snap) box.outerHTML = ui.btBoardHTML(snap);
  };""",
     'ui.js btSetCmd 刷新三列')

# 数量同步：改到两侧列表
edit('js/ui.js',
     """  ui.btSyncCounts = function (snap) {
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.getElementById('bt-n-' + pair[0] + '-' + u.id);
        if (el) el.textContent = U.fmt(u.count);
      });
    });
  };""",
     """  ui.btSyncCounts = function (snap) {
    /* v89.116：数量在**两侧列表**（图标下），战场只画图标 —— id 不变，逻辑照旧 */
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.getElementById('bt-n-' + pair[0] + '-' + u.id);
        if (el) el.textContent = U.fmt(u.count);
        var row = document.querySelector('#bt-board [data-row="' + pair[0] + '-' + u.id + '"]');
        if (row && row.classList) row.classList.toggle('dead', !(u.count > 0));
      });
    });
  };""",
     'ui.js btSyncCounts 两侧')

# ============================================================
# ③ 战况播报：一回合一行
# ============================================================
edit('js/ui.js',
     """  ui.btPlay = function (rec, r, bt) {
    bt.playing = true;
    rec.anim = true;                             /* 动画期间倒计时暂停 */
    var snap = r.snap || ((GAME._bsess[rec.id]) ? GAME._bsess[rec.id].snap() : null);
    if (snap) ui.btPlace(snap);                  /* ① 位置过渡（CSS transition） */
    var evs = (r.events || []).slice();
    var i = 0;
    function fin() {
      if (ui._bt && ui._bt.id === rec.id) ui._bt.playing = false;
      if (snap) ui.btSyncCounts(snap);
      rec.anim = false;
    }
    function next() {
      if (!ui._bt || ui._bt.id !== rec.id || i >= evs.length) { fin(); return; }
      ui.btEvent(evs[i++]);
      setTimeout(next, 400);
    }
    setTimeout(next, 620);
  };""",
     """  ui.btPlay = function (rec, r, bt) {
    bt.playing = true;
    rec.anim = true;                             /* 动画期间倒计时暂停 */
    var snap = r.snap || ((GAME._bsess[rec.id]) ? GAME._bsess[rec.id].snap() : null);
    if (snap) ui.btPlace(snap);                  /* ① 位置过渡（CSS transition） */
    var evs = (r.events || []).slice();
    /* v89.116（老板需求 8）：「战况回合播报放在下部分，行动和战果写在同一行，避免太多行」
       —— 一个回合**只写一行**（先把该回合的逐条事件压成一句话），
       逐条事件仍逐条播（只做受击闪烁），不再一行一条地刷屏。 */
    ui.btRoundLine(r, snap);
    var i = 0;
    function fin() {
      if (ui._bt && ui._bt.id === rec.id) ui._bt.playing = false;
      if (snap) ui.btSyncCounts(snap);
      rec.anim = false;
    }
    function next() {
      if (!ui._bt || ui._bt.id !== rec.id || i >= evs.length) { fin(); return; }
      ui.btEvent(evs[i++], true);                /* true = 静默（不写日志，只闪烁） */
      setTimeout(next, 260);
    }
    setTimeout(next, 620);
  };

  /* ---- 一回合一行：行动 + 战果（老板：「行动和战果写在同一行」）----
     结构：第 N 回合　[我] 动作…　→ 战果…　｜　[敌] 动作…　→ 战果…
     同一兵种的"前进"合并成一条；"攻击"合并成"X → Y 歼 N"；
     一回合一行 = 30 回合也只看 30 行（旧版一回合十几行）。 */
  ui.btRoundLine = function (r, snap) {
    var evs = (r && r.events) || [];
    function sideTxt(side) {
      var move = [], atk = [], hurt = [];
      var foeName = {};
      ((side === 'atk' ? (snap && snap.def) : (snap && snap.atk)) || []).forEach(function (u) { foeName[u.id] = u.name; });
      evs.forEach(function (e) {
        if (e.side !== side) return;
        if (e.kind === 'move') move.push(e.name + ' 进 ' + U.numText(e.step, 0));
        else if (e.kind === 'retreat') move.push(e.name + ' 退 ' + U.numText(e.step, 0));
        else if (e.kind === 'attack' || e.kind === 'counter') {
          atk.push(e.name + ' → ' + (e.target || foeName[e.targetId] || '敌') + ' 歼 ' + U.numText(e.kill, 0));
        } else if (e.kind === 'tower') atk.push(e.name + ' 拆箭塔 ' + U.numText(e.destroy, 0) + '（余 ' + U.numText(e.left, 0) + '）');
        else if (e.kind === 'wall') hurt.push('城头 → ' + (e.target || '我军') + ' 歼 ' + U.numText(e.kill, 0));
      });
      var bits = move.concat(atk, hurt);
      return bits.length ? bits.join(' · ') : '待命';
    }
    var line = '第 ' + ((r && r.r) || 0) + ' 回合　[我] ' + sideTxt('atk') + '　｜　[敌] ' + sideTxt('def')
      + '　·　间距 ' + U.numText((r && r.gap) || 0, 0);
    ui.btLogPush(line, 'round');
  };
  /* 往播报窗推一行（统一入口：所有写日志的地方都走它） */
  ui.btLogPush = function (line, cls) {
    var log = document.getElementById('bt-log');
    if (!log || !line) return;
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    d.textContent = line;
    log.appendChild(d);
    while (log.children.length > 12) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  };""",
     'ui.js 一回合一行播报')

edit('js/ui.js',
     """  /* 单条事件：战报流一行 + 目标闪烁 */
  ui.btEvent = function (e) {
    var line = '';""",
     """  /* 单条事件：目标闪烁（`quiet` = 只闪不写日志 —— 日志已由 ui.btRoundLine 压成一行） */
  ui.btEvent = function (e, quiet) {
    var line = '';""",
     'ui.js btEvent 签名')

edit('js/ui.js',
     """    var log = document.getElementById('bt-log');
    if (log) {
      var d = document.createElement('div');
      d.className = 'bt-ev ' + e.kind;
      d.textContent = line;
      log.appendChild(d);
      while (log.children.length > 40) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
  };""",
     """    if (quiet) return;
    ui.btLogPush(line, e.kind);
  };""",
     'ui.js btEvent 日志出口')

# 间距读数：btAfterStep 也走唯一出口
edit('js/ui.js',
     """    var gp = document.getElementById('bt-gap');
    if (gp) gp.textContent = '间距 ' + U.numText(r.gap, 0);""",
     """    var gp = document.getElementById('bt-gap');
    if (gp) gp.textContent = '间距 ' + U.numText(r.gap, 0);
    /* v89.116：位移动画后再次对齐间距读数（r.gap 与 frontsOf 同源，此处只做同值确认） */""",
     'ui.js btAfterStep 间距注释')

# ============================================================
# ④ main.js：bt-stance 读下拉的值
# ============================================================
edit('js/main.js',
     """      case 'bt-stance': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) ui.btSetCmd(rec, el.dataset.troop, { s: el.dataset.s });
      })(); break;""",
     """      case 'bt-stance': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        /* v89.116：动作改**下拉框**（老板「不要直接列出，节省空间」）——
           值从 `el.value` 取；仍兼容旧的按钮形态（el.dataset.s）。 */
        if (rec) ui.btSetCmd(rec, el.dataset.troop, { s: el.value || el.dataset.s });
      })(); break;""",
     'main.js bt-stance 读下拉值')

# ---------------- 执行 ----------------
def main():
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
        b = io.open(bak + os.path.basename(p), encoding='utf-8').read()
        d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
        if d0 != 0:
            print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
            return 1
        tmp = p + '.tmp116g'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(p), d0))
    print('补丁 G 完成')
    return 0


sys.exit(main())
