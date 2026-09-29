# v89.176 补丁 C：界面层 —— ① 战场/沙盘三线+标尺抽共享出口（统一化）
#   ② 兵牌接敌角标（bt/sd 共用 contactForecast）③ 顶栏损失读数+撤退预警
#   ④ 沙盘单元补 spd/start ⑤ 智能行显示"阵型·规则"、撤退行
import io

ROOT = 'E:/Deepseekdb/'
def read(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def write(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(f, tag, old, new, cnt=1):
    s = read(f)
    c = s.count(old)
    assert c == cnt, tag + ' 锚点命中 ' + str(c) + ' 次（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    write(f, s)
    print('[ok] ' + tag)

U = 'js/ui.js'
H = 'index.html'

# ============================================================
# C1 沙盘单元补 spd/start（两处 cp 同形，一次替换 2 处）
# ============================================================
rep(U, 'C1 sd 单元补字段',
"""      return { id: u.id, name: u.name, count: u.count, adv: u.adv,
        er: (u.er != null ? u.er : (u.range || 0)), range: u.range || 0,
        stance: u.stance || 'advance', target: u.target || '', act: '', lastTgt: '' };""",
"""      /* v89.176：补 `spd`（接敌预测的推进预演要读）与 `start`（损失读数）——
         与 snapUnits/unitsInit 的字段清单对齐（v89.151 手写清单漏字段的同族教训：
         打包函数漏一个字段 = 一个功能静默失真）。 */
      return { id: u.id, name: u.name, count: u.count, adv: u.adv, spd: u.spd || 0,
        start: (u.start != null ? u.start : u.count),
        er: (u.er != null ? u.er : (u.range || 0)), range: u.range || 0,
        stance: u.stance || 'advance', target: u.target || '', act: '', lastTgt: '' };""", cnt=2)

# ============================================================
# C2 三线抽共享出口（fieldLinesHTML）+ sdLineHTML 转发
# ============================================================
rep(U, 'C2 fieldLinesHTML + sdLineHTML 转发',
"""  ui.sdLineHTML = function (st, sb) {
    var D = sb.field || 1;
    var fr = ui.sdFrontsOf(st, sb);
    var contact = fr.contact || !!fr.broke;
    var aPct = um01(ui.sdPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD);
    var dPct = um01(ui.sdPct('def', fr.dFront, D) - ui.SD_FL_AHEAD);
    var cPct = fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : um01(ui.sdAxisPct(fr.mid, D)));
    function el(cls, id, pct, label, show) {
      return '<div class="sd-fl ' + cls + (show ? '' : ' hide') + '" id="' + id + '"' +
        ' style="left:' + (Math.round(pct * 10) / 10) + '%;"><span>' + label + '</span></div>';
    }
    return el('atk', 'sd-fl-a', aPct, ui.sdSideName(sb, 'atk') + '前线', !contact)
      + el('def', 'sd-fl-d', dPct, ui.sdSideName(sb, 'def') + '前线', !contact)
      + el('hit' + (fr.broke ? ' broke' : ''), 'sd-fl-c', cPct,
        fr.broke ? ui.sdSideName(sb, fr.broke) + '被攻入腹地' : '接触线', contact);
  };""",
"""  /* ============================================================
   * v89.176（老板「公文战报里的沙盘与战场沙盘进行一下统一化」）：
   * **战场三线**的唯一出口 —— 实时战场（bt-field）与战报沙盘（sd-field）
   * 共用同一份渲染（同一把 GAME.tactic.frontsOf 口径）：
   *   · 未接触：两条虚线各在本军最前部队前方；
   *   · 已接触：合成一条实线（接触线，画在两线中点）；
   *   · 一方被歼：线推到该方出发线（"被攻入腹地"）。
   * `nameOf(side)` 给称谓（战场固定"我军/敌军"；沙盘随视角）；
   * `pfx` = id 前缀（'sd-fl' / 'bt-fl' —— 两个弹窗各自独立，不抢 id）。
   * 入参 units 只须 {count, adv, er}（快照与沙盘态都满足）。
   * ============================================================ */
  ui.fieldLinesHTML = function (nameOf, atkUnits, defUnits, D, pfx) {
    var fr = GAME.tactic.frontsOf(atkUnits || [], defUnits || [], D || 1);
    var contact = fr.contact || !!fr.broke;
    var aPct = um01(ui.btPosPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD);
    var dPct = um01(ui.btPosPct('def', fr.dFront, D) - ui.SD_FL_AHEAD);
    var cPct = fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : um01(ui.sdAxisPct(fr.mid, D)));
    function el(cls, id, pct, label, show) {
      return '<div class="sd-fl ' + cls + (show ? '' : ' hide') + '" id="' + id + '"' +
        ' style="left:' + (Math.round(pct * 10) / 10) + '%;"><span>' + label + '</span></div>';
    }
    return el('atk', pfx + '-a', aPct, nameOf('atk') + '前线', !contact)
      + el('def', pfx + '-d', dPct, nameOf('def') + '前线', !contact)
      + el('hit' + (fr.broke ? ' broke' : ''), pfx + '-c', cPct,
        fr.broke ? nameOf(fr.broke) + '被攻入腹地' : '接触线', contact);
  };
  /* v89.176：**战场标尺**的唯一出口（沙盘/战场共用）——两端出发线 + 纵深读数 */
  ui.fieldScaleHTML = function (nameOf, D) {
    return '<div class="sd-scale"><span>' + nameOf('atk') + '出发线</span><span>纵深 '
      + U.numText(D || 0, 0) + '</span><span>' + nameOf('def') + '出发线</span></div>';
  };
  ui.sdLineHTML = function (st, sb) {
    /* v89.176：转发到共享出口（输出与改前逐字一致 —— 仅供既有断言/调用方兼容） */
    return ui.fieldLinesHTML(function (sd2) { return ui.sdSideName(sb, sd2); },
      st.atk, st.def, sb.field || 1, 'sd-fl');
  };""")

# ============================================================
# C3 sdFieldHTML：接敌角标 + 标尺走共享出口
# ============================================================
rep(U, 'C3a sd 令牌接敌角标',
"""    function tok(u, side, i) {
      return '<div class="sd-tok ' + side + '" id="sd-k-' + side + '-' + u.id + '"' +""",
"""    /* v89.176：接敌角标（与战场同源：contactForecast）——下一回合将交手的令牌亮圈 */
    var sdInc = {};
    try {
      var fcSd = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(st.atk, st.def, D) : null;
      if (fcSd) sdInc = fcSd.engage || {};
    } catch (e) { sdInc = {}; }
    function tok(u, side, i) {
      return '<div class="sd-tok ' + side + (sdInc[side + '|' + u.id] ? ' incoming' : '') + '" id="sd-k-' + side + '-' + u.id + '"' +""")

rep(U, 'C3b sd 标尺共享',
"""      '<div class="sd-ground"' + tex + '></div>' + lenes + toks + ui.sdLineHTML(st, sb) + wallTxt +
      '<div class="sd-scale"><span>' + ui.sdSideName(sb, 'atk') + '出发线</span><span>纵深 ' +
        U.numText(D, 0) + '</span><span>' + ui.sdSideName(sb, 'def') + '出发线</span></div>' +
      '</div>';""",
"""      '<div class="sd-ground"' + tex + '></div>' + lenes + toks + ui.sdLineHTML(st, sb) + wallTxt +
      ui.fieldScaleHTML(function (sd2) { return ui.sdSideName(sb, sd2); }, D) +
      '</div>';""")

# ============================================================
# C4 btFieldHTML：接敌角标 + 三线 + 标尺
# ============================================================
rep(U, 'C4a bt 接敌集合',
"""    function uHTML(u, idx, side, denom) {""",
"""    /* v89.176（老板「谁在下一回合接敌」）：接敌预测一次算好 ——
       兵牌角标（本函数）与顶栏读数（btLossHTML）读同一个出口（contactForecast）。 */
    var _inc176 = {};
    try {
      var _fc176 = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(snap.atk || [], snap.def || [], D) : null;
      if (_fc176) _inc176 = _fc176.engage || {};
    } catch (e) { _inc176 = {}; }
    function uHTML(u, idx, side, denom) {""")

rep(U, 'C4b bt 令牌角标',
"""      return '<div class="bt-unit ' + side + ' ' + _sh150 + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +""",
"""      return '<div class="bt-unit ' + side + ' ' + _sh150 + (u.count > 0 ? '' : ' dead')
        + (_inc176[side + '|' + u.id] ? ' incoming' : '') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +""")

rep(U, 'C4c bt 三线+标尺',
"""    return '<div class="bt-field' + ((Math.max(nA, nD) > 8) ? ' dense' : '') + '" id="bt-field">'
      + atkH + defH + cast + '</div>';""",
"""    return '<div class="bt-field' + ((Math.max(nA, nD) > 8) ? ' dense' : '') + '" id="bt-field">'
      + atkH + defH + cast
      /* v89.176（老板「沙盘与战场沙盘统一化」）：与战报沙盘共用三线 + 标尺
         （同一把 frontsOf 口径；line/scale 的唯一出口在 fieldLinesHTML/fieldScaleHTML） */
      + ui.fieldLinesHTML(ui.btSideName, snap.atk || [], snap.def || [], D, 'bt-fl')
      + ui.fieldScaleHTML(ui.btSideName, D) + '</div>';""")

# ============================================================
# C5 损失读数 + 角标同步 + 顶栏接入
# ============================================================
rep(U, 'C5a 新出口组（loss/标记同步）',
"""  /* 上部分整块（左我军 · 中战场 · 右敌军） */""",
"""  /* ============================================================
   * v89.176（老板「减少伤亡很重要」+「让问题记录和暴露，以便分析和改进」）：
   * **损失读数**（唯一出口）——从快照的 start↔count 算双方损失率
   * （v89.151 起快照带 start）；无 start（老快照/桩数据）→ 返回 null 不渲染。
   * ============================================================ */
  ui.btLossOf = function (snap) {
    if (!snap) return null;
    function sum(list) {
      var s0 = 0, s1 = 0, has = false;
      (list || []).forEach(function (u) {
        if (u.start == null) return;
        has = true; s0 += u.start || 0; s1 += u.count || 0;
      });
      return (has && s0 > 0) ? { pct: (s0 - s1) / s0, s0: s0, s1: s1 } : null;
    }
    var a = sum(snap.atk), d = sum(snap.def);
    return (a || d) ? { a: a, d: d } : null;
  };
  /* 顶栏损失 span：常态 / .warn（近撤退线）/ .danger（达线）；含接敌计数（与角标同源） */
  ui.btLossHTML = function (rec, snap) {
    var L = ui.btLossOf(snap);
    if (!L) return '';
    var aPct = L.a ? Math.round(L.a.pct * 100) : 0;
    var dPct = L.d ? Math.round(L.d.pct * 100) : 0;
    var incN = 0;
    try {
      var fc = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast((snap && snap.atk) || [], (snap && snap.def) || [],
            (snap && snap.field) || 1) : null;
      Object.keys((fc && fc.engage) || {}).forEach(function (kq) {
        if (kq.indexOf('atk|') === 0) incN++;
      });
    } catch (e) { incN = 0; }
    var ra = GAME.battle.retreatAtOf(), wa = GAME.battle.warnAtOf();
    var cls = (aPct / 100 >= ra) ? ' danger' : ((aPct / 100 >= wa) ? ' warn' : '');
    var tip = '我军损失 ' + aPct + '%（撤退线 ' + Math.round(ra * 100) + '% —— 到线且非名城目标将自动撤退）'
      + ' · 敌军损失 ' + dPct + '%' + (incN ? ' · 下一回合 ' + incN + ' 支将交手' : '');
    return '<span class="bt-loss' + cls + '" id="bt-loss" title="' + U.escape(tip) + '">📉 我损 '
      + aPct + '% · 敌损 ' + dPct + '%' + (incN ? ' · ⚔ ' + incN : '') + '</span>';
  };
  /* 接敌角标随回合同步（btAfterStep 调）——预测重算 + DOM 类增删（与初绘同出口） */
  ui.btMarkIncoming = function (snap) {
    if (!snap || !document.querySelectorAll) return;
    var D = snap.field || 1;
    var inc = {};
    try {
      var fc = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(snap.atk || [], snap.def || [], D) : null;
      inc = (fc && fc.engage) || {};
    } catch (e) { inc = {}; }
    [['atk', snap.atk || []], ['def', snap.def || []]].forEach(function (pair) {
      pair[1].forEach(function (u) {
        var fu = document.querySelector('#bt-field .bt-unit[data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (fu && fu.classList) fu.classList.toggle('incoming', !!inc[pair[0] + '|' + u.id]);
      });
    });
  };

  /* 上部分整块（左我军 · 中战场 · 右敌军） */""")

rep(U, 'C5b 顶栏加 loss span',
"""        ui.btSmartHTML(rec) +
        ui.btGapTextOf(rec, snap) +
      '</span>' +""",
"""        ui.btSmartHTML(rec) +
        ui.btGapTextOf(rec, snap) +
        ui.btLossHTML(rec, snap) +
      '</span>' +""")

rep(U, 'C5c btAfterStep 同步',
"""    var smEl = document.querySelector('#modal-root .bt-smart');
    if (smEl) {
      var smNew = ui.btSmartHTML(rec);
      if (smNew && smEl.outerHTML !== undefined) smEl.outerHTML = smNew;
    }""",
"""    var smEl = document.querySelector('#modal-root .bt-smart');
    if (smEl) {
      var smNew = ui.btSmartHTML(rec);
      if (smNew && smEl.outerHTML !== undefined) smEl.outerHTML = smNew;
    }
    /* v89.176：损失读数与接敌角标随回合同步（顶栏不整体重建 —— 与 bt-smart 同规） */
    var _snap176 = r.snap || rec.snapLast || null;
    var lsEl = document.getElementById('bt-loss');
    if (lsEl && _snap176) {
      var lsNew = ui.btLossHTML(rec, _snap176);
      if (lsNew) lsEl.outerHTML = lsNew;
      else if (lsEl.parentNode) lsEl.parentNode.removeChild(lsEl);
    }
    if (_snap176) ui.btMarkIncoming(_snap176);""")

# ============================================================
# C6 智能行：显示"阵型 · 规则"；撤退行
# ============================================================
rep(U, 'C6 智能行升级',
"""      var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[sn175.rule] || sn175.rule || '静态表';
      var det175 = (sn175.notes || []).slice(0, 4).join('；');
      if ((sn175.notes || []).length > 4) det175 += ' 等 ' + sn175.notes.length + ' 项';
      frag.appendChild(ui.btLogItem('🤖 智能调兵完成（' + (sn175.n
        ? ('调整 ' + sn175.n + ' 项：' + det175) : '维持阵型')
        + '）· 采用「' + rc175 + '」· 开始回合战斗', 'smart'));""",
"""      var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[sn175.rule] || sn175.rule || '静态表';
      /* v89.176（老板「总体策略」）：阵型模式并入策略名（"错落有致 · 静态表"） */
      var mc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.modeCN || {})[sn175.mode] || '';
      var strat175 = mc175 ? (mc175 + ' · ' + rc175) : rc175;
      /* v89.176：保兵撤退行（损失达线 · 本波收兵）——与"智能调兵完成"并列的可见事件 */
      if (sn175.retreat) {
        frag.appendChild(ui.btLogItem('🏳️ 智能撤退：' + ((sn175.notes || []).join('；')
          || '损失达线') + ' —— 残部带回 · 本波收兵（破防按半计）', 'smart'));
        return;
      }
      var det175 = (sn175.notes || []).slice(0, 4).join('；');
      if ((sn175.notes || []).length > 4) det175 += ' 等 ' + sn175.notes.length + ' 项';
      frag.appendChild(ui.btLogItem('🤖 智能调兵完成（' + (sn175.n
        ? ('调整 ' + sn175.n + ' 项：' + det175) : '维持阵型')
        + '）· 采用「' + strat175 + '」· 开始回合战斗', 'smart'));""")

# ============================================================
# C7 沙盘顶栏加损失读数
# ============================================================
rep(U, 'C7 sd 损失读数',
"""        '<span id="sd-side-txt">' + ui.sdSideTotals(st, sb) + '</span>' +""",
"""        '<span id="sd-side-txt">' + ui.sdSideTotals(st, sb) + '</span>' +
        /* v89.176（老板「减少伤亡」）：沙盘**损失读数**（与战场同源口径：start↔count） */
        '<span id="sd-loss">' + ui.sdLossHTML(st, sb) + '</span>' +""")

rep(U, 'C7b sdLossHTML 定义',
"""  ui.sdSideTotals = function (st, sb) {""",
"""  /* v89.176：沙盘损失读数（我方/敌方损失 %）——无 start 的旧沙盘态 → 空串不渲染 */
  ui.sdLossHTML = function (st, sb) {
    function calc(list) {
      var s0 = 0, s1 = 0, has = false;
      (list || []).forEach(function (u) {
        if (u.start == null) return;
        has = true; s0 += u.start || 0; s1 += u.count || 0;
      });
      return (has && s0 > 0) ? Math.round((s0 - s1) / s0 * 100) : null;
    }
    var aP = calc(st.atk), dP = calc(st.def);
    if (aP == null && dP == null) return '';
    var mineA = ui.sdOurSide(sb) === 'atk';
    return '· 损失 我 <b id="sd-loss-m">' + ((mineA ? aP : dP) == null ? 0 : (mineA ? aP : dP))
      + '%</b> / 敌 <b id="sd-loss-f">' + ((mineA ? dP : aP) == null ? 0 : (mineA ? dP : aP)) + '%</b>';
  };
  ui.sdSideTotals = function (st, sb) {""")

# ============================================================
# C8 CSS（接敌角标 + 损失读数三态）
# ============================================================
rep(H, 'C8 CSS',
"""  .bt-unit.dead .bt-ico { filter: grayscale(1) brightness(.7); }""",
"""  .bt-unit.dead .bt-ico { filter: grayscale(1) brightness(.7); }
  /* v89.176（老板「谁在下一回合接敌」+「减少伤亡…撤退线」）：
     ① 兵牌接敌角标（战场 + 沙盘共用）：下一回合将交手的部队亮一圈琥珀描边；
     ② 顶栏损失读数（#bt-loss）三态：常态 / .warn（近撤退线）/ .danger（达线）。 */
  .bt-unit.incoming, .sd-tok.incoming {
    box-shadow: 0 0 0 2px rgba(var(--amber-rgb), .9), 0 0 8px rgba(var(--amber-rgb), .45); }
  #bt-loss { color: var(--text-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }
  #bt-loss.warn { color: var(--amber); }
  #bt-loss.danger { color: var(--red-light); font-weight: 700; }""")

print('DONE-C')
