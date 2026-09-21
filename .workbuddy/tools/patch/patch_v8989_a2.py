# -*- coding: utf-8 -*-
"""
v89.89 · A2 离线结算报告（分类弹窗）

① state.js：offlineCatchup 补算**前后快照**（纯读取）→ 归集 GAME._offlineReport
   （资源净变 / 队列完成数 / 新增战报 / 伤兵 / 行军消息 / 超限折算说明）
② ui.js：ui.offlineReportHTML + ui.openOfflineReport（分类弹窗）
   + ui.enterLoaded 里 off >= 60 自动弹出（toast 轻提示保留）
"""
import io, sys

R = 'E:\\Deepseekdb\\'
ok_all = True

def patch(path, pairs, tag):
    global ok_all
    s = io.open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print('[FAIL] %s 锚点命中 %d 次（应 1）：%s' % (tag, n, old[:80].replace('\n', '\\n')))
            ok_all = False
            return
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('[OK] %s' % tag)

# ============================================================
# ① state.js：快照 + 归集
# ============================================================
patch(R + 'js\\state.js', [
    # 1a. 函数开头插入快照工具与前快照
    ("""    var s = GAME.state;
    if (!s) return 0;
    secReal = Math.max(0, secReal);
    if (secReal <= 5) return 0;
    /* v89.86（整改 P-17）：先按「离线推进上限」分流 —— 上限内的照常全保真补算；
       超限段只做五折折算（资源/供奉），其余系统不再推进。0 日=不限。 */""",
     """    var s = GAME.state;
    if (!s) return 0;
    secReal = Math.max(0, secReal);
    if (secReal <= 5) return 0;
    /* v89.89（A2）：归来报告 —— 补算**前后快照**（纯读取），归集为分类数据，
       供「归来报告」弹窗消费。只加"拿数"，不碰任何结算逻辑。 */
    var _oRepSnap = function () {
      var res = {};
      GAME.RES_KEYS.forEach(function (k) { res[k] = 0; });
      (s.cities || []).forEach(function (ct) {
        GAME.RES_KEYS.forEach(function (k) { res[k] += (ct.res && ct.res[k]) || 0; });
      });
      return {
        res: res,
        build: (s.queues.build || []).length,
        tech: (s.queues.tech || []).length,
        train: (s.queues.train || []).length,
        rep: (s.reports || []).length,
        wounded: s.wounded || 0,
      };
    };
    var _snapA = _oRepSnap();
    /* v89.86（整改 P-17）：先按「离线推进上限」分流 —— 上限内的照常全保真补算；
       超限段只做五折折算（资源/供奉），其余系统不再推进。0 日=不限。 */"""),
    # 1b. 尾部归集（在 rushAll 段记录消息 + return 前归集）
    ("""    if (GAME.march && GAME.march.rushAll) {
      var mr = GAME.march.rushAll();
      if (mr.ok) GAME.log('（离线期间）' + mr.msg);
    }
    if (GAME.story && GAME.story.recordOffline) GAME.story.recordOffline(secReal);
    return secReal;
  };""",
     """    var _marchMsg = '';
    if (GAME.march && GAME.march.rushAll) {
      var mr = GAME.march.rushAll();
      if (mr.ok) { GAME.log('（离线期间）' + mr.msg); _marchMsg = mr.msg; }
    }
    if (GAME.story && GAME.story.recordOffline) GAME.story.recordOffline(secReal);
    /* v89.89（A2）：归集归来报告（快照差 → 分类数据；纯读取） */
    var _snapB = _oRepSnap();
    var _delta = {};
    GAME.RES_KEYS.forEach(function (k) {
      _delta[k] = Math.round((_snapB.res[k] || 0) - (_snapA.res[k] || 0));
    });
    var _newRep = (s.reports || []).slice(0, Math.max(0, _snapB.rep - _snapA.rep));
    GAME._offlineReport = {
      secReal: secReal,
      applied: Math.round(applied),
      overflow: Math.round(overflow),
      capDays: GAME.offlineCapDays(),
      res: _delta,
      done: {
        build: Math.max(0, _snapA.build - _snapB.build),
        tech: Math.max(0, _snapA.tech - _snapB.tech),
        train: Math.max(0, _snapA.train - _snapB.train),
      },
      reports: _newRep.slice(0, 6).map(function (r) { return r.title || ''; }),
      reportsN: _newRep.length,
      wounded: Math.round((_snapB.wounded || 0) - (_snapA.wounded || 0)),
      marchMsg: _marchMsg,
    };
    return secReal;
  };"""),
], 'state.js 快照归集')

# ============================================================
# ② ui.js：报告弹窗 + 触发
# ============================================================
patch(R + 'js\\ui.js', [
    # 2a. 弹窗实现（插在 enterLoaded 之前）
    ("""  /* 载入完成后的统一入口：doContinue（主档）与 doLoadSlot（任意槽位）共用，
     免得"进游戏要做的几件事"写成两份（本项目最忌的失效模式）。 */
  ui.enterLoaded = function (label) {""",
     """  /* ============================================================
   * v89.89（A2）：离线「归来报告」—— 分类弹窗
   * ------------------------------------------------------------
   * 数据源 = GAME._offlineReport（offlineCatchup 补算前后快照归集，纯读取）。
   * 分四段：资源净变 / 在办完成 / 战报与事件 / 军务摘要。
   * 触发：ui.enterLoaded 里 off >= 60 秒时自动弹（toast 轻提示同时保留）。
   * 不进存档（会话级展示物；下次归来必有一份新的）。
   * ============================================================ */
  ui.offlineReportHTML = function () {
    var rp = GAME._offlineReport;
    if (!rp) return '';
    var durTxt = rp.secReal >= 3600 ? (rp.secReal / 3600).toFixed(1) + ' 时'
                                    : Math.round(rp.secReal / 60) + ' 分';
    var gDays = rp.applied * GAME.timeScale() / 86400;
    var head = '离城 ' + durTxt + ' · 推演 ' + (gDays >= 1 ? Math.round(gDays) + ' 游戏日' : '不足 1 游戏日');
    if (rp.overflow > 0 && rp.capDays > 0) {
      head += '（推进上限 ' + rp.capDays + ' 日；超出 ' +
        (rp.overflow >= 3600 ? (rp.overflow / 3600).toFixed(1) + ' 时' : Math.round(rp.overflow / 60) + ' 分') +
        ' 已五折折算）';
    }
    var h = '<div class="gold-heading">🕰️ 归来报告</div>' +
      '<div class="note">' + head + '</div>';

    /* ① 资源净变（全城合计） */
    var resRows = '';
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {
      var d = rp.res[k] || 0;
      if (!d) return;
      resRows += '<div class="res-line"><span class="lbl">' + (ui.RES_ICON[k] || '') + ' ' +
        (ui.RES_NAME[k] || k) + '</span><span class="val" style="color:' +
        (d > 0 ? 'var(--green-ok)' : 'var(--red-light)') + ';">' +
        (d > 0 ? '+' : '') + U.numText(d, 0) + '</span></div>';
    });
    h += ui.sealH('资源净变', '全城合计') +
      (resRows || '<div class="q-empty">资源无变化。</div>');

    /* ② 在办完成 */
    var dn = [];
    if (rp.done.build) dn.push('🏗️ 建造完工 ' + rp.done.build + ' 项');
    if (rp.done.tech) dn.push('📚 研究完成 ' + rp.done.tech + ' 项');
    if (rp.done.train) dn.push('⚔️ 募兵完成 ' + rp.done.train + ' 队');
    h += ui.sealH('在办完成') +
      (dn.length ? '<div class="op-hint">' + dn.join('　·　') + '</div>'
                 : '<div class="q-empty">无事办结。</div>');

    /* ③ 战报与事件 */
    var rpRows = rp.reports.map(function (t) {
      return '<div class="op-hint">• ' + U.escape(t || '') + '</div>';
    }).join('');
    h += ui.sealH('战报与事件', rp.reportsN ? '新增 ' + rp.reportsN + ' 份' : '') +
      (rpRows || '<div class="q-empty">天下无事。</div>') +
      (rp.reportsN > rp.reports.length
        ? '<div class="ui-sub">……共 ' + rp.reportsN + ' 份，详见「公文」。</div>' : '');

    /* ④ 军务摘要 */
    var mil = [];
    if (rp.wounded) {
      mil.push('<div class="res-line"><span class="lbl">🩹 伤兵</span><span class="val" style="color:' +
        (rp.wounded > 0 ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
        (rp.wounded > 0 ? '+' : '') + U.numText(rp.wounded, 0) + '</span></div>');
    }
    if (rp.marchMsg) mil.push('<div class="op-hint">🚩 ' + U.escape(rp.marchMsg) + '</div>');
    if (mil.length) h += ui.sealH('军务') + mil.join('');

    h += '<div class="modal-foot"><button class="btn gold" data-action="close-modal">知道了</button></div>';
    return h;
  };
  ui.openOfflineReport = function () {
    if (!GAME._offlineReport) return;
    ui.openModal(ui.offlineReportHTML());
  };

  /* 载入完成后的统一入口：doContinue（主档）与 doLoadSlot（任意槽位）共用，
     免得"进游戏要做的几件事"写成两份（本项目最忌的失效模式）。 */
  ui.enterLoaded = function (label) {"""),
    # 2b. 触发（toast 后自动弹）
    ("""    ui.toast((label || '📂 已载入存档') + (GAME._scaleMigrated ? ' · 时间倍率已提升' : '') +
      (offTxt ? '　' + offTxt : ''));
  };""",
     """    ui.toast((label || '📂 已载入存档') + (GAME._scaleMigrated ? ' · 时间倍率已提升' : '') +
      (offTxt ? '　' + offTxt : ''));
    /* v89.89（A2）：离线归来 → 弹分类「归来报告」（toast 只是轻提示；报告是明细） */
    if (off >= 60 && GAME._offlineReport) ui.openOfflineReport();
  };"""),
], 'ui.js 归来报告')

print('DONE' if ok_all else 'HAS-FAILURES')
sys.exit(0 if ok_all else 1)
