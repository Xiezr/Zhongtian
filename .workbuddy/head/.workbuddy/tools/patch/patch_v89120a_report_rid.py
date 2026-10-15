# -*- coding: utf-8 -*-
"""v89.120 补丁 A：战报身份 rid 化（根治「战报异常跳转」）

病根：界面把"渲染那一刻的数组索引"写进行上（data-i）与闭包里
（modalPage 的 rlog 回调 `viewReportText(i)`），而 state.reports 是**会被
unshift 位移**的可变数组（新战报永远插在最前），列表页又不随主循环重绘 ——
旧索引于是指向位移后的另一份报告（实测：掠报正文点「下页」弹出侦察报告）。

修法：给每份报告一个**稳定身份 rid**（自增号、随档走、惰性赋号兼容老档），
行与回调一律带 rid；`GAME.repByRid` 是唯一的"按身份取报告"出口。

执行：python .workbuddy/tools/patch/patch_v89120a_report_rid.py
"""
import io
import os
import sys

R = 'E:/Deepseekdb/'
REPL = []          # [(path, old, new, label)]


def edit(path, old, new, label):
    REPL.append((R + path, old, new, label))


# ================================================================
# ① js/state.js —— 唯一出口组（插在 GAME.msgsOf 之后）
# ================================================================
edit('js/state.js',
     """  /* 公文页取用：按类别过滤（页签、计数、正文三处同源，别再各筛一遍） */
  GAME.msgsOf = function (kind) {
    var out = [];
    var list = GAME.msgLog();
    for (var i = 0; i < list.length; i++) {
      if (GAME.msgKindOf(list[i]) === kind) out.push(list[i]);
    }
    return out.reverse();                     /* 新消息在前 */
  };
""",
     """  /* 公文页取用：按类别过滤（页签、计数、正文三处同源，别再各筛一遍） */
  GAME.msgsOf = function (kind) {
    var out = [];
    var list = GAME.msgLog();
    for (var i = 0; i < list.length; i++) {
      if (GAME.msgKindOf(list[i]) === kind) out.push(list[i]);
    }
    return out.reverse();                     /* 新消息在前 */
  };

  /* ============================================================
   * v89.120（老板「战报有异常跳转」）：报告身份 = **rid**（自增号），
   *   不再是"数组下标"。
   * ------------------------------------------------------------
   * 病根：界面把"渲染那一刻的数组索引"写进行上（data-i）与闭包里
   *   （modalPage 的 rlog 回调 `viewReportText(i)`），而 `state.reports`
   *   是**会被 unshift 位移**的可变数组（新战报永远插在最前）、
   *   列表页又不随主循环重绘 —— 旧索引于是指向位移后的另一份报告
   *   （实测：点掠报正文的「下页」/列表行，弹出的却是侦察报告）。
   * 修法：每份报告一个**稳定身份 rid**，行与闭包都带 rid，
   *   `repByRid` 是唯一的"按身份取报告"出口 —— 数组怎么变都不再错位。
   * 老档兼容：首次访问惰性赋号（rid 随存档走 —— savePayload 整档序列化）。
   * 被裁掉的报告 rid 不复用（自增号只增不减）。
   * ============================================================ */
  GAME.repRidOf = function (r) {
    if (!r || typeof r !== 'object') return 0;
    if (!r.rid) {
      var s = GAME.state || (GAME.state = {});
      s.repSeq = (s.repSeq || 0) + 1;
      r.rid = s.repSeq;
    }
    return r.rid;
  };
  GAME.repByRid = function (rid) {
    rid = Number(rid) || 0;
    if (!rid) return null;
    var list = (GAME.state && GAME.state.reports) || [];
    for (var i = 0; i < list.length; i++) {
      if (GAME.repRidOf(list[i]) === rid) return list[i];
    }
    return null;
  };
""",
     'state.js 加 repRidOf/repByRid')

# ================================================================
# ② js/ui.js —— 行渲染（data-i → data-rid；签名去掉索引参）
# ================================================================
edit('js/ui.js',
     """  /* 一条报告行（战报页 / 侦查页共用；侦查不给收藏 —— 回报是"看过就够"的东西） */
  ui.docRepRowHTML = function (r, i, withFav) {
    var d = new Date(r.t);
    return '<div class="doc-bar' + (r.win ? ' win' : '') + '" data-action="view-report" data-i="' + i + '">' +
      '<span class="db-t">' + (r.underdog ? '🏅 ' : '') + U.escape(r.title) + '</span>' +
      '<span class="db-d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      (withFav ? '<span class="db-fav' + (r.fav ? ' on' : '') + '" data-action="rep-fav" data-i="' + i +
        '" title="' + (r.fav ? '取消收藏' : '收藏该战报') + '">' + (r.fav ? '⭐' : '☆') + '</span>' : '') +
      '<span class="db-go">' + (withFav ? '查看 ›' : '展开 ›') + '</span></div>';
  };""",
     """  /* 一条报告行（战报页 / 侦查页共用；侦查不给收藏 —— 回报是"看过就够"的东西）
     v89.120：行上带 **data-rid**（稳定身份），不再带"渲染时刻的数组下标" ——
     列表在弹窗期间不重绘、而 reports 会被 unshift 位移，旧索引会指到别的报告
     （老板实测：点掠报弹出侦察报告）。取号走唯一出口 GAME.repRidOf。 */
  ui.docRepRowHTML = function (r, withFav) {
    var d = new Date(r.t);
    var rid = GAME.repRidOf(r);
    return '<div class="doc-bar' + (r.win ? ' win' : '') + '" data-action="view-report" data-rid="' + rid + '">' +
      '<span class="db-t">' + (r.underdog ? '🏅 ' : '') + U.escape(r.title) + '</span>' +
      '<span class="db-d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      (withFav ? '<span class="db-fav' + (r.fav ? ' on' : '') + '" data-action="rep-fav" data-rid="' + rid +
        '" title="' + (r.fav ? '取消收藏' : '收藏该战报') + '">' + (r.fav ? '⭐' : '☆') + '</span>' : '') +
      '<span class="db-go">' + (withFav ? '查看 ›' : '展开 ›') + '</span></div>';
  };""",
     'ui.docRepRowHTML 改 data-rid')

edit('js/ui.js',
     """      var pg = ui.pageOf('docwar', hit.length, ui.DOC_PER);
      var real = GAME.state.reports || [];
      var rows = hit.slice(pg.from, pg.to).map(function (r) {
        return ui.docRepRowHTML(r, real.indexOf(r), true);
      }).join('');""",
     """      var pg = ui.pageOf('docwar', hit.length, ui.DOC_PER);
      var rows = hit.slice(pg.from, pg.to).map(function (r) {
        return ui.docRepRowHTML(r, true);      /* v89.120：身份走 rid，不再传数组下标 */
      }).join('');""",
     '战报列表调用点')

edit('js/ui.js',
     """      var pg2 = ui.pageOf('docscout', sc.length, ui.DOC_PER);
      var real2 = GAME.state.reports || [];
      sc.slice(pg2.from, pg2.to).forEach(function (r) { rows += ui.docRepRowHTML(r, real2.indexOf(r), false); });""",
     """      var pg2 = ui.pageOf('docscout', sc.length, ui.DOC_PER);
      sc.slice(pg2.from, pg2.to).forEach(function (r) { rows += ui.docRepRowHTML(r, false); });""",
     '侦查列表调用点')

# ================================================================
# ③ js/ui.js —— _repView → _repId
# ================================================================
edit('js/ui.js',
     """  ui._repView = 0;
  ui._repRp = function () {
    var s = GAME.state;
    var r = (s.reports || [])[ui._repView];
    return (r && r.replay && r.replay.frames && r.replay.frames.length) ? r.replay : null;
  };""",
     """  ui._repId = 0;                 /* v89.120：当前查看的战报**身份**（rid），不再是数组下标 */
  ui._repRp = function () {
    var r = GAME.repByRid(ui._repId);
    return (r && r.replay && r.replay.frames && r.replay.frames.length) ? r.replay : null;
  };""",
     '_repView→_repId')

# ================================================================
# ④ js/ui.js —— openSandbox
# ================================================================
edit('js/ui.js',
     """  ui.openSandbox = function (ri) {
    var rep = GAME.state.reports[ri];
    if (!rep) return;
    ui.replayStop();
    ui.sdStop();
    ui._repView = ri;
    var sb = (GAME.battle.sandboxOf ? GAME.battle.sandboxOf(rep) : null);
    if (!sb || !sb.frames.length) { ui.viewReportText(ri); return; }
    ui._sd = { ri: ri, rep: rep, sb: sb, i: 0, timer: null, mode: 'replay', sim: null };""",
     """  ui.openSandbox = function (rid) {
    var rep = GAME.repByRid(rid);
    if (!rep) return;
    ui.replayStop();
    ui.sdStop();
    ui._repId = rid;
    var sb = (GAME.battle.sandboxOf ? GAME.battle.sandboxOf(rep) : null);
    if (!sb || !sb.frames.length) { ui.viewReportText(rid); return; }
    ui._sd = { rid: rid, rep: rep, sb: sb, i: 0, timer: null, mode: 'replay', sim: null };""",
     'openSandbox 改 rid')

# ================================================================
# ⑤ js/ui.js —— viewReportText
# ================================================================
edit('js/ui.js',
     """  ui.viewReportText = function (i) {
    var r = GAME.state.reports[i];
    if (!r) return;""",
     """  ui.viewReportText = function (rid) {
    var r = GAME.repByRid(rid);              /* v89.120：按稳定身份取（数组位移不再错位） */
    if (!r) return;""",
     'viewReportText 取报告')

edit('js/ui.js',
     """    ui._repView = i;""",
     """    ui._repId = rid;""",
     'viewReportText 记身份')

edit('js/ui.js',
     """      var pgL = ui.modalPage('rlog', rlog, 3, function () { ui.viewReportText(i); });""",
     """      /* v89.120：回调捕获 **rid**（不是渲染时刻的下标）—— 点「下页」重开时
         即使 reports 已被 unshift 位移，打开的还是同一份战报。 */
      var pgL = ui.modalPage('rlog', rlog, 3, function () { ui.viewReportText(rid); });""",
     'rlog 回调改 rid')

edit('js/ui.js',
     """        '<button class="btn gold" data-action="open-sandbox" data-i="' + i + '">🎬 打开沙盘回放（逐兵种逐帧）</button>' +""",
     """        '<button class="btn gold" data-action="open-sandbox" data-rid="' + rid + '">🎬 打开沙盘回放（逐兵种逐帧）</button>' +""",
     '沙盘入口按钮改 data-rid')

# ================================================================
# ⑥ js/ui.js —— viewReport（分发）
# ================================================================
edit('js/ui.js',
     """  ui.viewReport = function (i) {
    var r = GAME.state.reports[i];
    if (!r) return;
    if (r.sandbox && GAME.battle && GAME.battle.sandboxOf) {
      var sb = null;
      try { sb = GAME.battle.sandboxOf(r); } catch (e) { sb = null; }
      if (sb && sb.frames.length) { ui.openSandbox(i); return; }
    }
    ui.viewReportText(i);
  };""",
     """  ui.viewReport = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    if (r.sandbox && GAME.battle && GAME.battle.sandboxOf) {
      var sb = null;
      try { sb = GAME.battle.sandboxOf(r); } catch (e) { sb = null; }
      if (sb && sb.frames.length) { ui.openSandbox(rid); return; }
    }
    ui.viewReportText(rid);
  };""",
     'viewReport 改 rid')

# ================================================================
# ⑦ js/ui.js —— toggleRepFav
# ================================================================
edit('js/ui.js',
     """  ui.toggleRepFav = function (i) {
    var s = GAME.state, r = (s.reports || [])[i];
    if (!r) return;""",
     """  ui.toggleRepFav = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;""",
     'toggleRepFav 改 rid')

# ================================================================
# ⑧ js/main.js —— 五个动作
# ================================================================
edit('js/main.js',
     """      case 'view-report': ui.viewReport(Number(el.dataset.i)); break;""",
     """      case 'view-report': ui.viewReport(Number(el.dataset.rid)); break;   /* v89.120：身份 rid */""",
     'main view-report')

edit('js/main.js',
     """      case 'open-sandbox': ui.openSandbox(Number(el.dataset.i)); break;""",
     """      case 'open-sandbox': ui.openSandbox(Number(el.dataset.rid)); break;  /* v89.120：身份 rid */""",
     'main open-sandbox')

edit('js/main.js',
     """      case 'sd-text': ui.viewReportText(ui._repView); break;""",
     """      case 'sd-text': ui.viewReportText(ui._repId); break;   /* v89.120：_repId（rid） */""",
     'main sd-text')

edit('js/main.js',
     """      case 'rep-fav': ui.toggleRepFav(Number(el.dataset.i)); break;""",
     """      case 'rep-fav': ui.toggleRepFav(Number(el.dataset.rid)); break;      /* v89.120：身份 rid */""",
     'main rep-fav')

edit('js/main.js',
     """        var _sr = (GAME.state.reports || [])[ui._repView];""",
     """        var _sr = GAME.repByRid(ui._repId);        /* v89.120：身份 rid */""",
     'main scout-open')

# ================================================================
# 执行：先全量预检（唯一性），再逐个替换，最后净括号校验 + 落盘
# ================================================================
def main():
    files = {}
    for p, old, new, label in REPL:
        if p not in files:
            files[p] = io.open(p, encoding='utf-8').read()
    bad = 0
    for p, old, new, label in REPL:
        n = files[p].count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次 → 中止' % (label, n))
            bad += 1
    if bad:
        return 1
    print('预检通过：%d 处锚点全部唯一' % len(REPL))
    for p, old, new, label in REPL:
        files[p] = files[p].replace(old, new, 1)
        print('  ✓ %s' % label)
    # 写后自检：残留检查
    ui = files[R + 'js/ui.js']
    mj = files[R + 'js/main.js']
    st = files[R + 'js/state.js']
    checks = [
        ('ui.js 残留 _repView', ui.count('_repView') == 0),
        ('ui.js 残留 reports[ui._repView]', 'reports[ui._repView]' not in ui),
        ('ui.js 残留 data-i="\' + i + (docBar)', 'data-action="view-report" data-i=' not in ui),
        ('main.js 残留 _repView', mj.count('_repView') == 0),
        ('state.js 有 repRidOf', 'GAME.repRidOf = function' in st),
        ('state.js 有 repByRid', 'GAME.repByRid = function' in st),
        ('ui.js 有 _repId', '_repId' in ui),
    ]
    for label, ok in checks:
        print(('  ✓ ' if ok else '  !! ') + label)
        if not ok:
            return 1
    for p, s in files.items():
        o = (s.count('{'), s.count('}'))
        tmp = p + '.tmp120a'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（{ } = %d/%d）' % (p.split('/')[-1], o[0], o[1]))
    print('补丁 A 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
