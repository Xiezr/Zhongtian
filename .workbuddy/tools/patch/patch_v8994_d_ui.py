# -*- coding: utf-8 -*-
"""v89.94 Patch D —— js/ui.js：
① 军师估算（区间 + 情报等级）；② 战法三选 UI；③ 战场撤退键；④ 战报回放播放器 + 以少胜多。
所有替换带断言，幂等（命中即跳过）。"""
import io

P = 'js/ui.js'
src = io.open(P, encoding='utf-8').read()
orig = src
n_ok = 0


def rep(old, new, tag, limit=1):
    global src, n_ok
    if new in src:
        print('SKIP(已打): ' + tag)
        return
    assert old in src, 'ANCHOR MISSING [' + tag + ']'
    src = src.replace(old, new, limit)
    n_ok += 1
    print('OK: ' + tag)


# ---------- ① closeModal 顺带停回放 ----------
rep(
"""  ui.closeModal = function () {
    /* v89.87：关战场界面 = 转后台（清倒计时 timer、恢复 rec.anim 防后台停摆） */
    if (ui.btTeardown) ui.btTeardown();""",
"""  ui.closeModal = function () {
    /* v89.87：关战场界面 = 转后台（清倒计时 timer、恢复 rec.anim 防后台停摆） */
    if (ui.btTeardown) ui.btTeardown();
    if (ui.replayStop) ui.replayStop();      /* v89.94：关窗即停战报回放（不留空转定时器） */""",
'closeModal 停回放')

# ---------- ② 军师估算：expPowerOf 改区间 ----------
rep(
"""  ui.expPowerOf = function () {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var city = GAME.currentCity();
    if (!tp || !city) return null;
    var mine = 0, n = 0;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) || 0 : 0;
      n += v;
      mine += v * tp(id);
    });
    var res = ui._expRes;
    var def = 0;
    if (res) {
      var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
      var wall = (res.def || 0) / div;
      for (var k in (res.garrison || {})) def += tp(k) * (res.garrison[k] || 0);
      def = Math.round(def * (1 + wall));
    }
    return { mine: Math.round(mine), def: def, n: n, ratio: def > 0 ? mine / def : null };
  };""",
"""  /* v89.94（B2 · E2）：情报等级 → 估算误差（±）—— 侦察技巧越高，区间越窄。
     Lv0 ±55% / Lv3 ±34% / Lv6 ±13% / Lv8+ ±10%（下限 10%：军师也不是神仙）。 */
  ui.expEstErrOf = function (lv) {
    lv = Math.max(0, Number(lv) || 0);
    return Math.max(0.10, Math.min(0.55, 0.55 - 0.07 * lv));
  };
  /* 军师估算（v89.94 · E2 改造）：**不再给一键正解** —— 给人一个区间。
     · 点估计 = 兵种加权（与来袭/家底同一把尺），守方含城防；
     · 围攻目标（据点/县城）：守军与城防按**当前守备值**折算（与战斗入参同一出口）；
     · 误差 ±err 由侦察技巧等级决定 —— 情报越细，区间越窄，"判断"才有价值。 */
  ui.expPowerOf = function () {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var city = GAME.currentCity();
    if (!tp || !city) return null;
    var mine = 0, n = 0;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) || 0 : 0;
      n += v;
      mine += v * tp(id);
    });
    var res = ui._expRes;
    var def = 0, sgS = null;
    if (res) {
      var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
      var wall = (res.def || 0) / div;
      var base = 0;
      for (var k in (res.garrison || {})) base += tp(k) * (res.garrison[k] || 0);
      if (GAME.siegeScopeOf && GAME.siegeScopeOf(res)) {
        sgS = GAME.siegeScaleOf(res);
        base *= sgS.garrison;                 /* 守军随破防衰减 */
        wall *= sgS.def;                      /* 城防同步衰减 */
      }
      def = Math.round(base * (1 + wall));
    }
    var lv = (GAME.battle.intelTiersOf ? GAME.battle.intelTiersOf().lv : 0);
    var err = ui.expEstErrOf(lv);
    var out = {
      mine: Math.round(mine), def: def, n: n,
      ratio: def > 0 ? mine / def : null,
      intelLv: lv, err: err,
      lo: def > 0 ? Math.round(def * (1 - err)) : 0,
      hi: def > 0 ? Math.round(def * (1 + err)) : 0,
      siege: sgS ? { hold: sgS.hold } : null,
    };
    out.ratioLo = out.hi > 0 ? mine / out.hi : null;   /* 最坏情形（守军偏强） */
    out.ratioHi = out.lo > 0 ? mine / out.lo : null;   /* 最好情形（守军偏弱） */
    return out;
  };""",
'军师估算（区间）')

# ---------- ③ 预估行：改成区间 + 凶险提示 + 围攻状态 ----------
rep(
"""      if (pow73) {
        /* v89.86（P-23）：战力比改读唯一出口 ui.expPowerOf（确认闸共用同一口径） */
        var pw74 = ui.expPowerOf ? ui.expPowerOf() : null;
        if (pw74 && pw74.def > 0 && pw74.mine > 0) {
          var ratio74 = pw74.ratio;
          var lv74 = ratio74 >= 1.6 ? ['兵力充足', 'var(--green-ok)']
            : ratio74 >= 1.0 ? ['势均力敌', 'var(--gold-light)']
            : ratio74 >= 0.6 ? ['兵力偏少', 'var(--amber, #e0a83c)']
            : ['兵力悬殊', 'var(--red-light)'];
          pow73.innerHTML = '⚔️ 战力估算　我方 <b style="color:var(--blue-info)">' + U.numText(pw74.mine, 0) +
            '</b>　vs　守军 <b style="color:var(--red-light)">' + U.numText(pw74.def, 0) + '</b>' +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '（' +
            (Math.round(ratio74 * 100) / 100) + ' : 1）</span>' +
            '<span style="opacity:.6;">　估算口径：兵种属性加权，守方含城防</span>';
        } else {
          pow73.innerHTML = '⚔️ 战力估算　' + ((pw74 && pw74.mine > 0) ? '守军兵力未知' : '填入兵力后显示对比');
        }
      }""",
"""      if (pow73) {
        /* v89.94（B2 · E2）：**军师估算** —— 给区间不给答案（误差随侦察技巧收窄）。
           区间跨过 1:1 时提示"凶险"：胜则可入史册 —— 把"势均力敌"框成机会而非劝退。 */
        var pw74 = ui.expPowerOf ? ui.expPowerOf() : null;
        function _two74(x) { return x == null ? '—' : (Math.round(x * 100) / 100); }
        if (pw74 && pw74.def > 0 && pw74.mine > 0) {
          var rLo = pw74.ratioLo, rHi = pw74.ratioHi;
          var lv74 = (rLo != null && rLo >= 1.6) ? ['兵力充足', 'var(--green-ok)']
            : (rLo != null && rLo >= 1.0) ? ['势均力敌 · 胜负由临阵决断', 'var(--gold-light)']
            : (rHi != null && rHi < 0.6) ? ['兵力悬殊', 'var(--red-light)']
            : ['兵力偏少', 'var(--amber, #e0a83c)'];
          pow73.innerHTML = '⚔️ 军师估算　我方 <b style="color:var(--blue-info)">' + U.numText(pw74.mine, 0) +
            '</b>　vs　守军 约 <b style="color:var(--red-light)">' + U.numText(pw74.def, 0) + '</b>' +
            '<span style="opacity:.7;">（误差 ±' + Math.round(pw74.err * 100) + '%）</span>' +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '</span>' +
            '<br><span style="opacity:.75;">区间：我 1 : ' + _two74(rLo) + ' ~ 1 : ' + _two74(rHi)
            + '　·　情报 Lv' + pw74.intelLv + '（升侦察技巧可收窄）</span>'
            + ((rLo != null && rLo < 1 && rHi != null && rHi >= 0.9)
              ? '<br><span style="color:var(--gold-light);font-weight:700;">⚑ 此战凶险：胜则可入史册</span>' : '')
            + (pw74.siege ? '<br><span style="opacity:.75;">🧱 围攻：守备 ' + Math.round(pw74.siege.hold)
              + '%（守军与城防已按此衰减）</span>' : '');
        } else {
          pow73.innerHTML = '⚔️ 军师估算　' + ((pw74 && pw74.mine > 0) ? '守军兵力未知（先派侦察）' : '填入兵力后显示对比');
        }
      }""",
'预估行改区间')

# ---------- ④ 战法三选：函数 + 插入出征方式格 ----------
rep(
"""  ui.expDeleteTactic = function (id) {
    var s = GAME.state; s.tacticSets = (s.tacticSets || []).filter(function (t) { return t.id !== id; }); ui.openTacticSets();   /* v89.86：预设管理 */
  };""",
"""  ui.expDeleteTactic = function (id) {
    var s = GAME.state; s.tacticSets = (s.tacticSets || []).filter(function (t) { return t.id !== id; }); ui.openTacticSets();   /* v89.86：预设管理 */
  };

  /* ============================================================
   * v89.94（B2 · E2）：战法三选（强攻 / 围困 / 奇袭）—— 出兵前最后一次决断
   * ------------------------------------------------------------
   * 选中即写入随军 `opts.ops`（与计略同一通道：出发校验 → 抵达生效）。
   * 不可用项置灰、悬停写明原因（唯一判据 GAME.opsConfigIssueOf）。
   * ============================================================ */
  ui._expOps = 'assault';
  ui.expOpsLockOf = function (id) {
    return GAME.opsConfigIssueOf(id, ui._expRes, ui._expScheme || null);
  };
  ui.expOpsChipsHTML = function () {
    var cur = GAME.opsIdOf(ui._expOps);
    return (DATA.OPS || []).map(function (o) {
      var lock = ui.expOpsLockOf(o.id);
      return '<span class="ch' + (cur === o.id ? ' active' : '') + ((lock && o.id !== cur) ? ' off' : '') +
        '" data-action="exp-ops" data-v="' + o.id + '" title="' + U.escape(lock || o.desc) + '">' +
        o.icon + ' ' + o.name + '</span>';
    }).join('');
  };
  ui.expOpsNoteHTML = function () {
    var o = GAME.opsOf(GAME.opsIdOf(ui._expOps));
    var out = o.desc;
    var t = ui._expRes;
    if (t && GAME.siegeScopeOf && GAME.siegeScopeOf(t)) {
      out += '<br>🧱 ' + GAME.siegeTextOf(t) + '　占领＝围攻（每波破防、守备归零即下城）；掠夺不破防。';
    }
    return out;
  };
  ui.expOpsBlockHTML = function () {
    return '<div class="exp-ops-row"><span class="exp-ops-lab">战法</span>' +
      '<span id="exp-ops">' + ui.expOpsChipsHTML() + '</span></div>' +
      '<div class="exp-info exp-info-l" id="exp-ops-note" style="color:var(--text-dim);margin:2px 0 0;">' +
      ui.expOpsNoteHTML() + '</div>';
  };
  ui.setExpOps = function (id) {
    var lock = ui.expOpsLockOf(id);
    if (lock && GAME.opsIdOf(id) !== GAME.opsIdOf(ui._expOps)) { ui.toast('⚠️ ' + lock); return; }
    ui._expOps = GAME.opsIdOf(id);
    var box = document.getElementById('exp-ops');
    if (box) box.innerHTML = ui.expOpsChipsHTML();
    var note = document.getElementById('exp-ops-note');
    if (note) note.innerHTML = ui.expOpsNoteHTML();
    ui.updateExpMarch();          /* 围困改行军时长 → 预估行实时刷新（同一出口） */
  };""",
'战法三选函数')

rep(
"""    html += '<div class="exp-sec exp-a-modes"><div class="exp-sec-t">出征方式</div>' + modeSelHTML + fortModeNote + '</div>';""",
"""    html += '<div class="exp-sec exp-a-modes"><div class="exp-sec-t">出征方式</div>' + modeSelHTML + fortModeNote
      + ui.expOpsBlockHTML() + '</div>';""",
'战法插入出征方式格')

# 计略变更 → 战法（奇袭须有计略）联动刷新
rep(
"""  ui.setExpScheme = function (sid) {
    ui._expScheme = sid || null;
    ui.setExpSchemeLabel();
    var box = $('#exp-scheme-box'); if (box) box.innerHTML = ui.expSchemePanelHTML();
    var sel = document.getElementById('exp-scheme-sel');
    if (sel && sel.value !== (ui._expScheme || '')) sel.value = ui._expScheme || '';
  };""",
"""  ui.setExpScheme = function (sid) {
    ui._expScheme = sid || null;
    ui.setExpSchemeLabel();
    var box = $('#exp-scheme-box'); if (box) box.innerHTML = ui.expSchemePanelHTML();
    var sel = document.getElementById('exp-scheme-sel');
    if (sel && sel.value !== (ui._expScheme || '')) sel.value = ui._expScheme || '';
    /* v89.94（E2）：计略变 → 战法解锁态跟着变（奇袭须有计略；撤了计略则奇袭置灰） */
    if (ui.setExpOps) ui.setExpOps(ui._expOps);
  };""",
'计略↔战法联动')

# ---------- ⑤ 战场：撤退键 ----------
rep(
"""      foot: '<button class="btn gold" data-action="bt-done">✅ 完成回合</button>' +
        '<button class="btn" data-action="bt-auto">⏩ 自动战斗</button>' +
        '<button class="btn" data-action="close-modal">后台运行</button>',""",
"""      foot: '<button class="btn gold" data-action="bt-done">✅ 完成回合</button>' +
        '<button class="btn" data-action="bt-auto">⏩ 自动战斗</button>' +
        '<button class="btn" data-action="bt-retreat">🏳️ 撤退</button>' +
        '<button class="btn" data-action="close-modal">后台运行</button>',""",
'战场撤退键')
rep(
"""    ui._bt = { id: id, lastRound: snap.round || rec.round || 0, playing: false, timer: null };""",
"""    ui._bt = { id: id, lastRound: snap.round || rec.round || 0, playing: false, timer: null };
    ui._btRetreatArmed = false;                   /* v89.94：撤退两段确认，开界面即复位 */""",
'撤退二次确认复位')

# ---------- ⑥ 战报详情：以少胜多 / 围攻 / 回放 ----------
rep(
"""  ui.viewReport = function (i) {
    var r = GAME.state.reports[i];
    if (!r) return;
    var html = '<div class="gold-heading">' + U.escape(r.title) + '</div>' +""",
"""  ui.viewReport = function (i) {
    var r = GAME.state.reports[i];
    if (!r) return;
    if (ui.replayStop) ui.replayStop();           /* v89.94：换一份战报 → 先停旧回放 */
    ui._repView = i;
    var html = '<div class="gold-heading">' + U.escape(r.title) + '</div>' +""",
'viewReport 记索引')

rep(
"""    var sc = r.scene;
    if (sc) {
      html += ui.sealH('战斗场景', '战场纵深 ' + U.numText(sc.field, 0)
        + '　·　共 ' + sc.rounds + ' 回合　·　▓ 部队　· 间距　▕▏ 两军间距');""",
"""    /* v89.94（B2 · E3）：以少胜多（以弱胜强才值得晒）+ 围攻战果（还差多少） */
    if (r.underdog) html += '<div class="rp-under">🏅 以少胜多 —— 此役以弱胜强，宜入简册</div>';
    if (r.siege) {
      html += '<div class="rp-under">🧱 围攻：本波破防 ' + r.siege.chip + '% → 守备余 '
        + Math.round(r.siege.hold) + '%（第 ' + r.siege.waves + ' 波'
        + (r.siege.broke ? ' · 城垣已破' : ' · 守军退守内城') + '）</div>';
    }
    var _rp94 = r.replay;
    if (_rp94 && _rp94.frames && _rp94.frames.length) {
      ui._rep = { i: 0, timer: null };
      html += ui.replaySectionHTML(_rp94);        /* v89.94：分回合回放（逐帧/播放/关键帧） */
    }
    var sc = r.scene;
    if (sc && !(_rp94 && _rp94.frames && _rp94.frames.length)) {
      html += ui.sealH('战斗场景', '战场纵深 ' + U.numText(sc.field, 0)
        + '　·　共 ' + sc.rounds + ' 回合　·　▓ 部队　· 间距　▕▏ 两军间距');""",
'战报详情接回放')

# ---------- ⑦ 回放播放器（放在 viewReport 之前） ----------
rep(
"""  ui.viewReport = function (i) {""",
"""  /* ============================================================
   * v89.94（B2 · E3）：战报**分回合回放** —— 逐帧 / 播放 / 关键帧跳转
   * ------------------------------------------------------------
   * 数据 = report.replay（关键帧 ≤10：首 2 + 尾 2 + 首杀/破塔/折半/最烈）。
   * 播放是**客户端演示**（不驱动任何结算，纯看）；关窗即停（closeModal 钩子）。
   * 收藏仍在列表页（⭐，v89.89 已做）—— 回放与收藏各管一段。
   * ============================================================ */
  ui._repView = 0;
  ui._repRp = function () {
    var s = GAME.state;
    var r = (s.reports || [])[ui._repView];
    return (r && r.replay && r.replay.frames && r.replay.frames.length) ? r.replay : null;
  };
  ui.replayFrameHTML = function (rp, i) {
    var f = rp.frames[i];
    if (!f) return '';
    return '<div class="bt-row"><span class="bt-r">' + f.r + '</span>' +
      '<span class="bt-strip">' + String(f.s || '').replace(/▓/g, '<i>▓</i>').replace(/·/g, '<u>·</u>') + '</span>' +
      '<span class="bt-n">我 ' + U.fmt(f.a) + '　敌 ' + U.fmt(f.d) + '</span>' +
      '<span class="bt-g">间距 ' + U.numText(f.gap, 0) + '</span></div>' +
      '<div class="rp-ev">' + (f.ev ? U.escape(f.ev) : '（本回合两军推进）') + '</div>';
  };
  ui.replaySectionHTML = function (rp) {
    var keys = (rp.key || []).map(function (k) {
      return '<span class="ch rp-key" data-action="rep-jump" data-v="' + k.r + '">' +
        U.escape(k.text) + ' · 第' + k.r + '回</span>';
    }).join('');
    return ui.sealH('分回合回放', '共 ' + rp.rounds + ' 回合 · 存档 ' + rp.frames.length + ' 关键帧'
        + (rp.retreat ? ' · 主动撤退' : '')) +
      '<div class="rp-box" id="rep-fbox">' + ui.replayFrameHTML(rp, 0) + '</div>' +
      '<div class="rp-ctl">' +
        '<button class="btn sm" data-action="rep-prev">⏮ 上一帧</button>' +
        '<button class="btn sm gold" id="rep-play" data-action="rep-play">▶ 播放</button>' +
        '<button class="btn sm" data-action="rep-next">下一帧 ⏭</button>' +
        '<input type="range" id="rep-range" class="rp-range" min="0" max="' + (rp.frames.length - 1) + '" value="0" step="1">' +
        '<span class="rp-pos" id="rep-pos">1 / ' + rp.frames.length + '</span>' +
      '</div>' +
      '<div class="rp-keys">关键帧：' + keys + '</div>';
  };
  ui.replaySet = function (i) {
    var rp = ui._repRp();
    if (!rp) return;
    i = Math.max(0, Math.min(rp.frames.length - 1, i));
    if (!ui._rep) ui._rep = { i: 0, timer: null };
    ui._rep.i = i;
    var box = document.getElementById('rep-fbox');
    if (box) box.innerHTML = ui.replayFrameHTML(rp, i);
    var rg = document.getElementById('rep-range');
    if (rg) rg.value = i;
    var pos = document.getElementById('rep-pos');
    if (pos) pos.textContent = (i + 1) + ' / ' + rp.frames.length;
  };
  ui.replayStep = function (d) { ui.replaySet((ui._rep ? ui._rep.i : 0) + d); };
  ui.replayStop = function () {
    if (ui._rep && ui._rep.timer) clearInterval(ui._rep.timer);
    if (ui._rep) ui._rep.timer = null;
    var b = document.getElementById('rep-play');
    if (b) b.textContent = '▶ 播放';
  };
  ui.replayToggle = function () {
    var rp = ui._repRp();
    if (!rp) return;
    if (ui._rep && ui._rep.timer) { ui.replayStop(); return; }
    if (!ui._rep) ui._rep = { i: 0, timer: null };
    if (ui._rep.i >= rp.frames.length - 1) ui.replaySet(0);
    ui._rep.timer = setInterval(function () {
      var rr = ui._repRp();
      if (!rr || !ui._rep || ui._rep.i >= rr.frames.length - 1) { ui.replayStop(); return; }
      ui.replaySet(ui._rep.i + 1);
    }, 700);
    var b = document.getElementById('rep-play');
    if (b) b.textContent = '⏸ 暂停';
  };
  ui.replayJump = function (roundNo) {
    var rp = ui._repRp();
    if (!rp) return;
    var best = 0, bd = Infinity;
    rp.frames.forEach(function (f, i) { var d = Math.abs(f.r - roundNo); if (d < bd) { bd = d; best = i; } });
    ui.replaySet(best);
  };

  ui.viewReport = function (i) {""",
'回放播放器')

# ---------- ⑧ 战报列表：以少胜多徽记 ----------
rep(
"""            '<span class="db-t">' + U.escape(r.title) + '</span>' +""",
"""            '<span class="db-t">' + (r.underdog ? '🏅 ' : '') + U.escape(r.title) + '</span>' +""",
'列表以少胜多徽记')

if src != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(src)
    print('PATCHED ui.js D  (%d 处)' % n_ok)
else:
    print('NOCHANGE')
