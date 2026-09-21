# -*- coding: utf-8 -*-
"""
v89.89 · B1 任务一键全领 + D4 战报筛选与收藏

① ui.js：
   · tasksHTML 「可领取奖励」块加「一键全领」按钮
   · reportsHTML 战报段：筛选 chips（全部/胜/败/⭐收藏）+ 行内收藏星标
   · ui.setRepFilter / ui.toggleRepFav（会话级筛选态 + 随档收藏）
② main.js：doClaimAllQuests 出口 + 三个 action 分发
③ index.html：.db-fav 样式
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
            print('[FAIL] %s 锚点命中 %d 次（应 1）：%s' % (tag, n, old[:100].replace('\n', '\\n')))
            ok_all = False
            return
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('[OK] %s' % tag)

# ============================================================
# ① ui.js
# ============================================================
patch(R + 'js\\ui.js', [
    # 1a. B1：一键全领按钮（readyBlock）
    ("""    var readyBlock = readyItems.length
      ? '<div class="q-sec q-sec-ready"><span class="q-sec-t">✅ 可领取奖励</span>'
        + '<span class="q-sec-n">' + readyItems.length + ' 项</span></div>'
        + '<div class="q-list">' + readyItems.map(readyRowHtml).join('') + '</div>'
      : '';""",
     """    var readyBlock = readyItems.length
      ? '<div class="q-sec q-sec-ready"><span class="q-sec-t">✅ 可领取奖励</span>'
        + '<span class="q-sec-n">' + readyItems.length + ' 项</span>'
        /* v89.89（B1 · 100+ 轮实玩期待）：一键全领 —— 逐条复用「领取」同一对出口
           （claimQuest / claimRandomQuest），汇总一条 toast，不新造结算路径。 */
        + '<button class="btn gold sm" style="margin-left:auto;" data-action="quest-claim-all">'
        + '一键全领</button></div>'
        + '<div class="q-list">' + readyItems.map(readyRowHtml).join('') + '</div>'
      : '';"""),
    # 1b. D4：战报筛选 + 收藏（reportsHTML 战报段整体替换）
    ("""    /* ---- 战报列表 ---- */
    /* v43（老板要求）：战报**分页** —— 原来整卷列出，打过几十场仗以后
       这一页就是一条望不到头的清单。每页 8 份，翻页走底部固定条。 */
    var rPg = ui.pageOf('rep', s.reports.length, ui.DOC_PER);
    var repTable = s.reports.length
      ? s.reports.slice(rPg.from, rPg.to).map(function (r, i) {
          var idx = rPg.from + i;
          var d = new Date(r.t);
          /* v39（需求 4）：去框 —— 不再有底色/边框/圆角，也不用每行一个「查看」按钮
           （按钮本身就是一个个小框）。整行可点，右侧给一个"查看 ›"文字提示。 */
        return '<div class="doc-bar' + (r.win ? ' win' : '') + '" data-action="view-report" data-i="' + idx + '">' +
            '<span class="db-t">' + U.escape(r.title) + '</span>' +
            '<span class="db-d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
              U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
            '<span class="db-go">查看 ›</span></div>';
        }).join('')
      : '<div class="q-empty">尚无战报。出征与攻城的战果会记在这里。</div>';
    if (s.reports.length > ui.DOC_PER) ui.pagerHTML('rep', s.reports.length, ui.DOC_PER);""",
     """    /* ---- 战报列表 ---- */
    /* v43（老板要求）：战报**分页** —— 原来整卷列出，打过几十场仗以后
       这一页就是一条望不到头的清单。每页 8 份，翻页走底部固定条。
       v89.89（D4 · 100+ 轮实玩期待）：加**筛选**（全部/胜/败/收藏）与**收藏**（⭐/☆）。
       口径：筛选先于分页（页数随筛选结果算）；收藏存 s.reports[].fav —— 与战报同
       一条目，随档自动持久（不另立存储）；筛选态为会话级（ui._repFilter）。 */
    var rf = ui._repFilter;
    if (['all', 'win', 'lose', 'fav'].indexOf(rf) < 0) rf = 'all';
    var repIdx = [];                                  /* 命中的**真实索引**（保原顺序） */
    s.reports.forEach(function (r, i) {
      if (rf === 'win' && !r.win) return;
      if (rf === 'lose' && r.win) return;
      if (rf === 'fav' && !r.fav) return;
      repIdx.push(i);
    });
    var repChips = [['all', '全部'], ['win', '🏆 胜'], ['lose', '⚔️ 败'], ['fav', '⭐ 收藏']]
      .map(function (c) {
        return '<span class="ch' + (rf === c[0] ? ' active' : '') +
          '" data-action="rep-filter" data-v="' + c[0] + '">' + c[1] + '</span>';
      }).join('');
    var rPg = ui.pageOf('rep', repIdx.length, ui.DOC_PER);
    var repTable = repIdx.length
      ? repIdx.slice(rPg.from, rPg.to).map(function (ri) {
          var r = s.reports[ri];
          var d = new Date(r.t);
          /* v39（需求 4）：去框 —— 不再有底色/边框/圆角，也不用每行一个「查看」按钮
           （按钮本身就是一个个小框）。整行可点，右侧给一个"查看 ›"文字提示。 */
        return '<div class="doc-bar' + (r.win ? ' win' : '') + '" data-action="view-report" data-i="' + ri + '">' +
            '<span class="db-t">' + U.escape(r.title) + '</span>' +
            '<span class="db-d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
              U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
            '<span class="db-fav' + (r.fav ? ' on' : '') + '" data-action="rep-fav" data-i="' + ri +
              '" title="' + (r.fav ? '取消收藏' : '收藏该战报') + '">' + (r.fav ? '⭐' : '☆') + '</span>' +
            '<span class="db-go">查看 ›</span></div>';
        }).join('')
      : '<div class="q-empty">' + (rf === 'all' ? '尚无战报。出征与攻城的战果会记在这里。'
          : '此筛选下无战报。') + '</div>';
    if (repIdx.length > ui.DOC_PER) ui.pagerHTML('rep', repIdx.length, ui.DOC_PER);"""),
    # 1c. chips 挂到「战报」分区标题下
    ("""      ui.sealH('战报', '共 ' + s.reports.length + ' 份') +
      repTable +""",
     """      ui.sealH('战报', '共 ' + s.reports.length + ' 份') +
      '<div class="msg-channels">' + repChips + '</div>' +
      repTable +"""),
    # 1d. 筛选态常量 + 两个出口（放在 DOC_PER 定义旁）
    ("""  ui.DOC_PER = 8;      /* 战报每页 */""",
     """  ui.DOC_PER = 8;      /* 战报每页 */
  ui._repFilter = 'all';   /* v89.89（D4）：战报筛选态（会话级；all/win/lose/fav） */

  /* v89.89（D4）：战报筛选切换 —— 切筛选回第 1 页（清页码，避免停在空页） */
  ui.setRepFilter = function (v) {
    if (['all', 'win', 'lose', 'fav'].indexOf(v) < 0) return;
    ui._repFilter = v;
    ui._pages['rep'] = 1;
    ui.renderView('reports');
  };
  /* v89.89（D4）：收藏切换 —— 存进战报条目自身（s.reports[].fav，随档持久） */
  ui.toggleRepFav = function (i) {
    var s = GAME.state, r = (s.reports || [])[i];
    if (!r) return;
    r.fav = !r.fav;
    ui.toast(r.fav ? '已收藏该战报（「⭐ 收藏」筛选里可见）' : '已取消收藏');
    ui.renderView('reports');
  };"""),
], 'ui.js B1 一键全领 + D4 筛选收藏')

# ============================================================
# ② main.js
# ============================================================
patch(R + 'js\\main.js', [
    # 2a. 动作分发（claim-quest 旁）
    ("""      case 'claim-quest': GAME.doClaimQuest(el.dataset.q); break;""",
     """      case 'claim-quest': GAME.doClaimQuest(el.dataset.q); break;
      /* v89.89（B1）：任务一键全领 */
      case 'quest-claim-all': GAME.doClaimAllQuests(); break;"""),
    # 2b. 筛选/收藏分发（view-report 旁）
    ("""      case 'view-report': ui.viewReport(Number(el.dataset.i)); break;""",
     """      case 'view-report': ui.viewReport(Number(el.dataset.i)); break;
      /* v89.89（D4）：战报筛选 / 收藏 */
      case 'rep-filter': ui.setRepFilter(el.dataset.v); break;
      case 'rep-fav': ui.toggleRepFav(Number(el.dataset.i)); break;"""),
    # 2c. 一键全领出口
    ("""  GAME.doClaimQuest = function (qid) {
    var r = GAME.claimQuest(qid);
    ui.toast(r.msg);
    GAME.refreshAll();
  };""",
     """  GAME.doClaimQuest = function (qid) {
    var r = GAME.claimQuest(qid);
    ui.toast(r.msg);
    GAME.refreshAll();
  };
  /* v89.89（B1 · 100+ 轮实玩期待）：任务一键全领 ——
     逐条复用 claimQuest / claimRandomQuest 同一对出口（既有校验/结算/防重领全保留），
     汇总一条 toast；不新造批量结算路径（"第二次结算"是本项目最经典失效模式）。 */
  GAME.doClaimAllQuests = function () {
    var s = GAME.state;
    var n = 0;
    (DATA.QUESTS || []).forEach(function (q) {
      if (!GAME.questReady(q)) return;
      var r = GAME.claimQuest(q.id);
      if (r.ok) n++;
    });
    (s.quests.pool || []).slice().forEach(function (entry) {
      if (!GAME.randQuestReady(entry)) return;
      var r = GAME.claimRandomQuest(entry.id);
      if (r.ok) n++;
    });
    ui.toast(n ? ('一键领取 ' + n + ' 项任务奖励') : '暂无可领取的任务奖励');
    if (n) { ui.renderView('tasks'); GAME.refreshAll(); }
  };"""),
], 'main.js doClaimAllQuests + 分发')

# ============================================================
# ③ index.html：.db-fav 样式
# ============================================================
patch(R + 'index.html', [
    ("""  .doc-bar:hover .db-go { opacity: 1; }""",
     """  .doc-bar:hover .db-go { opacity: 1; }
  /* v89.89（D4）：战报收藏星标 */
  .doc-bar .db-fav { flex: none; font-size: var(--fs-sub); color: var(--text-dim);
    opacity: .7; cursor: pointer; transition: opacity .12s; }
  .doc-bar .db-fav:hover { opacity: 1; }
  .doc-bar .db-fav.on { opacity: 1; }"""),
], 'index.html db-fav 样式')

print('DONE' if ok_all else 'HAS-FAILURES')
sys.exit(0 if ok_all else 1)
