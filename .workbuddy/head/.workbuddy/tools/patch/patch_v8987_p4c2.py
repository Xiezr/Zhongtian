# -*- coding: utf-8 -*-
"""v89.87 需求4c-2：战场观战界面（ui.js）——渲染 / 指令 / 动画 / 倒计时 / 结束面板"""
import io

P = r'E:\Deepseekdb\js\ui.js'
src = io.open(P, encoding='utf-8', newline='').read()

anchor = "  ui.marchesHTML = function () {"
assert src.count(anchor) == 1, ('anchor', src.count(anchor))

BLOCK = """  /* ============================================================
   * 战场界面（v89.87 · 老板需求 4）：实时观战 + 逐回合指挥
   * ------------------------------------------------------------
   * · 距离轴战场：左我军 / 右敌军，位置 = 推进度（adv）映射；
   *   CSS `transition: left` 做位移动画 —— 每回合结算后两军"看着走"；
   * · 逐兵种指令：前进 / 驻守 / 后退 + 指定目标（敌方兵种 / 城防箭塔）；
   * · 读秒：`settings.battleSec` 真实秒（默认 60）—— 到点自动结算本回合，
   *   点「完成回合」立即结算（老板需求：完成后立即完成该回合）；
   * · 「自动战斗」一键跑完；关闭 = 转后台（军务总览「征战中」可再进）；
   * · 单例：同一时刻只展示一个战场（其他挂起战斗在军务里切换）。
   * ============================================================ */
  ui._bt = null;                    /* { id, lastRound, playing, timer } */
  ui.btStanceName = { advance: '前进', hold: '驻守', retreat: '后退' };
  ui.btSideName = function (side) { return side === 'atk' ? '我军' : '敌军'; };

  /* ---- 按推进度映射横轴位置（%）：我军 4→46，敌军 96→54 ---- */
  ui.btPosPct = function (side, adv, D) {
    var f = Math.max(0, Math.min(1, (adv || 0) / (D || 1)));
    return side === 'atk' ? (4 + f * 42) : (96 - f * 42);
  };

  /* ---- 顶部条 ---- */
  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    return '<div class="bt-top">' +
      '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
      '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
      '<span id="bt-gap">间距 ' + U.numText(rec.gapLast == null ? (snap.field || 0) : rec.gapLast, 0) + '</span>' +
      '<span class="bt-hint">设置完点「完成回合」立即结算；到点自动结算</span>' +
      '</div>';
  };

  /* ---- 战场条：双方单位卡（绝对定位，left 过渡即位移动画） ---- */
  ui.btFieldHTML = function (snap) {
    var D = snap.field || 1;
    function uHTML(u, idx, side) {
      return '<div class="bt-unit ' + side + '" data-side="' + side + '" data-troop="' + u.id + '" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;top:' + (idx * 42) + 'px;">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<span class="bt-nm">' + U.escape(u.name) + '</span>' +
        '<b class="bt-n" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b></div>';
    }
    var atkH = (snap.atk || []).map(function (u, i) { return uHTML(u, i, 'atk'); }).join('');
    var defH = (snap.def || []).map(function (u, i) { return uHTML(u, i, 'def'); }).join('');
    var cast = snap.towers
      ? '<div class="bt-castle">🏯 箭塔 <b id="bt-tower">' + snap.towers.left + '</b> / ' + snap.towers.start + '</div>'
      : '';
    var h = Math.max(2, Math.max((snap.atk || []).length, (snap.def || []).length)) * 42 + 14;
    return '<div class="bt-field" id="bt-field" style="height:' + h + 'px;">' + atkH + defH + cast + '</div>';
  };

  /* ---- 指令区（我方每兵种一行：动作三选 + 目标） ---- */
  ui.btCmdHTML = function (rec, snap) {
    var defs = snap.def || [];
    var rows = (snap.atk || []).map(function (u) {
      if (u.count <= 0) return '';
      var cmd = (rec.cmd && rec.cmd[u.id]) || {};
      var cur = cmd.s || u.stance || 'advance';
      var curT = (cmd.t !== undefined) ? cmd.t : (u.target || '');
      var sts = ['advance', 'hold', 'retreat'].map(function (s) {
        return '<button class="bt-btn' + (cur === s ? ' on' : '') + '" data-action="bt-stance" ' +
          'data-troop="' + u.id + '" data-s="' + s + '">' + ui.btStanceName[s] + '</button>';
      }).join('');
      var opts = '<option value="">目标：任意</option>';
      defs.forEach(function (d) {
        if (d.count <= 0) return;
        opts += '<option value="' + d.id + '"' + (curT === d.id ? ' selected' : '') + '>目标：' + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        opts += '<option value="' + DATA.TARGET_WALL + '"' + (curT === DATA.TARGET_WALL ? ' selected' : '') + '>目标：城防箭塔</option>';
      }
      return '<div class="bt-cmdrow">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<span class="bt-cmdnm">' + U.escape(u.name) + '</span>' +
        '<span class="bt-cmdst">' + sts + '</span>' +
        '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '">' + opts + '</select>' +
        '</div>';
    }).join('');
    return '<div class="bt-cmd" id="bt-cmd"><div class="bt-cmd-h">逐兵种指令（我方）</div>' +
      (rows || '<div class="q-empty">我军已无可战之兵。</div>') + '</div>';
  };

  ui.battlefieldHTML = function (rec) {
    var ses = GAME._bsess && GAME._bsess[rec.id];
    var snap = rec.snapLast || (ses ? ses.snap() : null) ||
      { round: rec.round || 0, field: 0, atk: [], def: [], towers: null };
    return ui.btTopHTML(rec, snap) + ui.btFieldHTML(snap) +
      '<div class="bt-log" id="bt-log"></div>' + ui.btCmdHTML(rec, snap);
  };

  /* ============ 打开 / 关闭 ============ */
  ui.openBattlefield = function (id) {
    var rec = GAME.battle._recOf(id);
    if (!rec) { ui.toast('战斗已结束（战报见公文）'); return; }
    ui.btTeardown();                             /* 单例：先拆旧的 */
    var ses = GAME._bsess && GAME._bsess[id];
    if (!ses) {
      try {
        GAME._bsess = GAME._bsess || {};
        GAME._bsess[id] = GAME.battle._makeEnv(rec);
        ses = GAME._bsess[id];
      } catch (e) { ui.toast('战斗会话不可用'); return; }
    }
    var snap = rec.snapLast || ses.snap();
    ui._bt = { id: id, lastRound: snap.round || rec.round || 0, playing: false, timer: null };
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    ui.openShell({
      title: '⚔ 战场 · ' + U.escape((rec.target && rec.target.name) || '目标'),
      sub: '战斗待指挥 · 每回合 ' + sec + ' 秒（可提前完成）',
      size: 'xxl',
      body: '<div id="bt-wrap">' + ui.battlefieldHTML(rec) + '</div>',
      foot: '<button class="btn gold" data-action="bt-done">✅ 完成回合</button>' +
        '<button class="btn" data-action="bt-auto">⏩ 自动战斗</button>' +
        '<button class="btn" data-action="close-modal">后台运行</button>',
    });
    ui._bt.timer = setInterval(ui.btTick, 500);
  };

  /* 拆装（关闭界面 / 切换战斗）：恢复 rec.anim，防"动画卡住 → 后台停摆" */
  ui.btTeardown = function () {
    var bt = ui._bt;
    if (!bt) return;
    if (bt.timer) clearInterval(bt.timer);
    var rec = GAME.battle._recOf(bt.id);
    if (rec) rec.anim = false;
    ui._bt = null;
  };

  /* ---- 每 500ms：倒计时数字 + 检测"结算追上来"（后台/自动推进时补播） ---- */
  ui.btTick = function () {
    var bt = ui._bt;
    if (!bt) return;
    var rec = GAME.battle._recOf(bt.id);
    if (!rec) { ui.btShowEnd(bt); return; }
    var cd = document.getElementById('bt-cd');
    if (cd) cd.textContent = Math.max(0, Math.ceil(rec.cnt == null ? 0 : rec.cnt));
    if (!bt.playing && rec.round > bt.lastRound) {
      ui.btAfterStep(rec, { r: rec.round, gap: rec.gapLast, events: rec.evLast || [], snap: rec.snapLast });
    }
  };

  /* ---- 指令写入（chips / 下拉）→ 会话即时生效（本回合结算用得上） ---- */
  ui.btSetCmd = function (rec, troopId, patch) {
    rec.cmd = rec.cmd || {};
    var c = rec.cmd[troopId] = rec.cmd[troopId] || {};
    if (patch && patch.s) c.s = patch.s;
    if (patch && patch.t !== undefined) c.t = patch.t;
    var ses = GAME._bsess && GAME._bsess[rec.id];
    if (ses) ses.setCmd('atk', troopId, c);
    var box = document.getElementById('bt-cmd');
    var snap = rec.snapLast || (ses ? ses.snap() : null);
    if (box && snap) box.outerHTML = ui.btCmdHTML(rec, snap);
  };

  /* ---- 一回合结算后：更新顶栏 → 位移动画 → 逐条事件字幕 ---- */
  ui.btAfterStep = function (rec, r) {
    var bt = ui._bt;
    if (!bt || bt.id !== rec.id) return;
    bt.lastRound = r.r;
    var rd = document.getElementById('bt-round');
    if (rd) rd.textContent = r.r;
    var gp = document.getElementById('bt-gap');
    if (gp) gp.textContent = '间距 ' + U.numText(r.gap, 0);
    ui.btPlay(rec, r, bt);
  };

  ui.btPlay = function (rec, r, bt) {
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
  };

  ui.btPlace = function (snap) {
    var D = snap.field || 1;
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.querySelector('#bt-field [data-side="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (el) el.style.left = ui.btPosPct(pair[0], u.adv, D) + '%';
      });
    });
    if (snap.towers) {
      var tw = document.getElementById('bt-tower');
      if (tw) tw.textContent = snap.towers.left;
    }
  };

  ui.btSyncCounts = function (snap) {
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.getElementById('bt-n-' + pair[0] + '-' + u.id);
        if (el) el.textContent = U.fmt(u.count);
      });
    });
  };

  /* 单条事件：战报流一行 + 目标闪烁 */
  ui.btEvent = function (e) {
    var line = '';
    if (e.kind === 'move') line = '🚶 ' + ui.btSideName(e.side) + ' ' + e.name + ' 前进 ' + U.numText(e.step, 0) + '（间距 ' + U.numText(e.gap, 0) + '）';
    else if (e.kind === 'retreat') line = '↩️ ' + ui.btSideName(e.side) + ' ' + e.name + ' 后退 ' + U.numText(e.step, 0);
    else if (e.kind === 'attack') line = '⚔️ ' + ui.btSideName(e.side) + ' ' + e.name + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    else if (e.kind === 'counter') line = '🛡️ ' + ui.btSideName(e.side) + ' ' + e.name + ' 反击 → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    else if (e.kind === 'tower') line = '🏯 ' + e.name + ' 攻箭塔，摧毁 ' + e.destroy + ' 座（余 ' + e.left + ' / ' + e.total + '）';
    else if (e.kind === 'wall') line = '🏯 城头火力 → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    if (!line) return;
    if (e.targetId) {
      var tEl = document.querySelector('#bt-field [data-side="' + (e.side === 'atk' ? 'def' : 'atk') +
        '"][data-troop="' + e.targetId + '"]');
      if (tEl && tEl.classList) {
        tEl.classList.add('hit');
        setTimeout(function () { tEl.classList.remove('hit'); }, 360);
      }
    }
    var log = document.getElementById('bt-log');
    if (log) {
      var d = document.createElement('div');
      d.className = 'bt-ev ' + e.kind;
      d.textContent = line;
      log.appendChild(d);
      while (log.children.length > 40) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
    }
  };

  /* ---- 结束：战果面板 ---- */
  ui.btShowEnd = function (bt) {
    if (bt && bt.timer) clearInterval(bt.timer);
    if (ui._bt && (!bt || ui._bt.id === bt.id)) ui._bt = null;
    var res = GAME._battleJustDone;
    var body;
    if (res && bt && res.id === bt.id) {
      var head = !res.ok ? '⚑ 战斗中止'
        : (res.winner === 'atk' ? '🎉 我军得胜' : '⚑ 我军失利（战果见战报）');
      body = '<div class="bt-end">' +
        '<div class="bt-end-t">' + head + '</div>' +
        '<div class="bt-end-s">共 ' + (res.rounds || 0) + ' 回合　·　我军损失 ' + U.numText(res.atkLoss || 0, 0) +
          '　·　敌军损失 ' + U.numText(res.defLoss || 0, 0) + '</div>' +
        (res.rolled ? '<div class="bt-end-s">结算异常：大军已原路折返</div>' : '') +
        '<div class="bt-end-s">战报已入公文（「公文」页可回看）。</div></div>';
    } else {
      body = '<div class="bt-end"><div class="bt-end-t">战斗已结束</div>' +
        '<div class="bt-end-s">战报见「公文」页。</div></div>';
    }
    ui.openShell({
      title: '⚔ 战场 · 战果', size: 'sm', body: body,
      foot: '<button class="btn gold" data-action="close-modal">关闭</button>',
    });
  };

  /* finishBattle 的统一回调（battle.js 调用）：界面开着 → 战果面板；否则 toast */
  ui.onBattleDone = function (res) {
    var bt = ui._bt;
    if (bt && bt.id === res.id) { ui.btShowEnd(bt); return; }
    if (!res.ok) { ui.toast('⚠️ 战斗中止，大军折返'); return; }
    ui.toast('⚔️ 战斗结束：' + (res.winner === 'atk' ? '我军得胜' : '我军失利') +
      '（我方损失 ' + U.numText(res.atkLoss || 0, 0) + '，战报见公文）');
  };

  /* ---- 军务总览：征战中段（供 marchesHTML 调用） ---- */
  ui.btPendingBlock = function () {
    var s = GAME.state;
    var list = (s.battles || []).filter(function (b) { return b.state === 'live'; });
    if (!list.length) return null;
    var rows = list.map(function (b) {
      return '<tr><td>⚔ ' + U.escape((b.target && b.target.name) || '目标') + '</td>' +
        '<td class="ctr">第 ' + (b.round || 0) + ' 回合</td>' +
        '<td class="ctr"><button class="btn sm gold" data-action="bt-open" data-id="' + b.id + '">进入战场</button></td></tr>';
    }).join('');
    return { n: list.length,
      html: '<table class="tbl"><thead><tr><th>目标</th><th class="ctr">进度</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table>' };
  };

"""

src = src.replace(anchor, BLOCK + anchor, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('OK ui.js 战场界面（4c2）')
