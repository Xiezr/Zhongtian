# -*- coding: utf-8 -*-
"""v89.116 补丁 F：待阅逸闻 6×5 + 翻页（需求 1） · 公文去掉烽火页签（需求 6）

需求 1（老板）：「待阅轶闻，名称怎么比阅读和忽略按钮还小呢？设计更紧凑，如5行*6列，
  增加翻页，全部列出，分页显示」
  → 版面 4×5=20 → **6 列 × 5 行 = 30 格**；篇名升到 14px 粗体（按钮降到 .btn.xs 11px）——
    "名称比按钮还小"这条从字号上钉死；超过 30 篇**翻页列全**（底部条翻页，走既有 pageOf/pagerHTML）。
需求 6（老板）：「公文里不要烽火这个板块，烽火相关流水已经存在于军务的烽火中」
  → 类别表加 `doc:false` 标记，公文页签只列有 doc 的类；烽火流水窗口 12 → 24 条，
    并在军务·烽火页写明"烽火不进公文，流水在这里"。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


# ============================================================
# ① 待阅逸闻：6×5 + 翻页
# ============================================================
edit('js/ui.js',
     """  ui.sgPendingHTML = function () {
    /* ============================================================
     * v89.104（老板）：「待阅逸闻可以固定 5 行 4 列，新的待阅逸闻逐渐填补，
     * 目前一行一条好奢侈」——
     * 固定 **4 列 × 5 行 = 20 格**：有货的格子是篇名 + 阅读/忽略，空格子是暗色占位，
     * 一眼看出"还差几篇"；超出的（含折入往事的）在网格下用一行话交代清楚。
     * ============================================================ */
    var list = (GAME.SG && GAME.SG.pending) ? GAME.SG.pending() : [];
    var arch = (GAME.SG && GAME.SG.archived) ? GAME.SG.archived() : [];
    if (!list.length && !arch.length) return '';
    var SLOT = ui.SG_GRID_SLOTS;                     /* 20 格 */
    var cells = '';
    for (var i = 0; i < SLOT; i++) {
      var x = list[i];
      cells += x
        ? '<div class="sg-cell"><span class="sg-t" title="' + U.escape(x.title) + '">《' + U.escape(x.title) + '》</span>' +
          '<span class="sg-a"><button class="btn sm gold" data-action="story-read" data-sid="' + x.sid + '">阅读</button>' +
          '<button class="btn sm" data-action="story-drop" data-sid="' + x.sid + '">忽略</button></span></div>'
        : '<div class="sg-cell empty"><span class="sg-t">待触发</span></div>';
    }
    var html = '<div class="story-card">' +
      '<div class="gold-heading">📖 待阅逸闻（' + list.length + '）' +
        ui.help('触发的逸闻不再全屏弹出（免得打断操作）。\\n在此逐条阅读；读一篇移出一篇，「忽略」直接移除。\\n' +
          '版面固定 4×5 = ' + SLOT + ' 格，新逸闻逐个填补。\\n待阅超过 ' +
          ((GAME.SG && GAME.SG.PENDING_CAP) || 60) + ' 条后，早先的自动折入「往事」——不再丢失，随时可读。') + '</div>' +
      '<div class="sg-grid">' + cells + '</div>';
    if (list.length > SLOT || arch.length) {
      html += '<div class="note" style="margin-top:6px;">' +
        (list.length > SLOT ? ('另有 ' + (list.length - SLOT) + ' 篇待阅未列出（先读完上面这些）；') : '') +
        (arch.length ? ('另有 ' + arch.length + ' 篇早先的逸闻折入「往事」，未读不丢 —— ' +
          '去「故事集」页可按篇回看。') : '') + '</div>';
    }
    return html + '</div>';
  };
  ui.SG_GRID_SLOTS = 20;      /* v89.104：待阅逸闻固定 4 列 × 5 行（老板点名单一出口） */""",
     """  ui.sgPendingHTML = function () {
    /* ============================================================
     * v89.116（老板）：「待阅轶闻，名称怎么比阅读和忽略按钮还小呢？设计更紧凑，
     *   如 5 行*6 列，增加翻页，全部列出，分页显示」
     * ------------------------------------------------------------
     * 三件事：
     *   ① 版面 4×5 = 20 格 → **6 列 × 5 行 = 30 格**（每页 30 篇）；
     *   ② 篇名字号必须**大于**按钮字号（.sg-t = --fs-lead 14px 粗体；
     *      按钮降为 .btn.xs = --fs-cap 11px）—— "名称比按钮还小"从字号上钉死，由 §96 断言守；
     *   ③ 超过一页 → **底部条翻页**（ui.pageOf + ui.pagerHTML，与全站同一套分页口径），
     *      "全部列出"成立：不再有"另有 N 篇未列出"的死角。
     * ============================================================ */
    var list = (GAME.SG && GAME.SG.pending) ? GAME.SG.pending() : [];
    var arch = (GAME.SG && GAME.SG.archived) ? GAME.SG.archived() : [];
    if (!list.length && !arch.length) return '';
    var PER = ui.SG_PER_PAGE;                        /* 30 = 6 列 × 5 行 */
    var pg = ui.pageOf('sg', list.length, PER);
    var cells = '';
    for (var i = 0; i < PER; i++) {
      var x = list[pg.from + i];
      cells += x
        ? '<div class="sg-cell"><span class="sg-t" title="' + U.escape(x.title) + '">《' + U.escape(x.title) + '》</span>' +
          '<span class="sg-a"><button class="btn xs gold" data-action="story-read" data-sid="' + x.sid + '">阅读</button>' +
          '<button class="btn xs" data-action="story-drop" data-sid="' + x.sid + '">忽略</button></span></div>'
        : '<div class="sg-cell empty"><span class="sg-t">待触发</span></div>';
    }
    var html = '<div class="story-card">' +
      '<div class="gold-heading">📖 待阅逸闻（' + list.length + '）' +
        ui.help('触发的逸闻不再全屏弹出（免得打断操作）。\\n在此逐条阅读；读一篇移出一篇，「忽略」直接移除。\\n' +
          '版面固定 6×5 = ' + PER + ' 格一页，新逸闻逐个填补；超过一页用**底部条翻页**看全。\\n待阅超过 ' +
          ((GAME.SG && GAME.SG.PENDING_CAP) || 60) + ' 条后，早先的自动折入「往事」——不再丢失，随时可读。') + '</div>' +
      '<div class="sg-grid">' + cells + '</div>' +
      (pg.maxPage > 1
        ? '<div class="ui-sub" style="text-align:center;margin-top:4px;">第 ' + pg.page + ' / ' + pg.maxPage
          + ' 页（共 ' + list.length + ' 篇 · 每页 ' + PER + ' 篇，翻页在底部条）</div>' : '');
    if (pg.maxPage > 1) ui.pagerHTML('sg', list.length, PER);   /* 底部条翻页（全站同一套） */
    if (arch.length) {
      html += '<div class="note" style="margin-top:6px;">' +
        ('另有 ' + arch.length + ' 篇早先的逸闻折入「往事」，未读不丢 —— ' +
          '去「故事集」页可按篇回看。') + '</div>';
    }
    return html + '</div>';
  };
  ui.SG_GRID_COLS = 6;        /* v89.116：待阅逸闻固定 6 列（老板点名） */
  ui.SG_GRID_ROWS = 5;
  ui.SG_PER_PAGE = ui.SG_GRID_COLS * ui.SG_GRID_ROWS;    /* 30 篇/页（单一出口） */
  ui.SG_GRID_SLOTS = ui.SG_PER_PAGE;                     /* 兼容旧名（= 每页格数） */""",
     'ui.js 待阅逸闻 6×5+翻页')

# ============================================================
# ② 公文类别表：加 doc:false
# ============================================================
edit('js/data.js',
     """  DATA.MSG_KINDS = [
    { id: 'war',    name: '战报', icon: '⚔️', desc: '出征 / 攻城 / 行军 / 调防 / 缴获 —— 战报列表 + 军事流水' },
    { id: 'scout',  name: '侦查', icon: '🔭', desc: '侦查回报：守军 / 守将 / 库藏 / 布防（按侦察技巧分层解锁）' },
    { id: 'beacon', name: '烽火', icon: '🔥', desc: '预警与来袭：犯境预警 / 击退或被破 / 防守计' },
    { id: 'task',   name: '任务', icon: '📜', desc: '任务完成 / 随机任务 / 时代之志与改元' },
    { id: 'sys',    name: '系统', icon: '📣', desc: '内政 / 经济 / 建设 / 江湖与其余提示' }
  ];""",
     """  /* v89.116（老板）：「公文里不要烽火这个板块，烽火相关流水已经存在于军务的烽火中」
     —— 类别表加 `doc:false`（**不进公文页签**，但仍是合法类别）：
     烽火消息照旧按 beacon 归档、照旧在「军务 · 烽火」的流水里列全 ——
     只是公文不再给它一个页签（同一批消息两处入口 = 两处读数）。 */
  DATA.MSG_KINDS = [
    { id: 'war',    name: '战报', icon: '⚔️', desc: '出征 / 攻城 / 行军 / 调防 / 缴获 —— 战报列表 + 军事流水' },
    { id: 'scout',  name: '侦查', icon: '🔭', desc: '侦查回报：守军 / 守将 / 库藏 / 布防（按侦察技巧分层解锁）' },
    { id: 'beacon', name: '烽火', icon: '🔥', doc: false,
      desc: '预警与来袭：犯境预警 / 击退或被破 / 防守计（**流水在军务 · 烽火**，不在公文）' },
    { id: 'task',   name: '任务', icon: '📜', desc: '任务完成 / 随机任务 / 时代之志与改元' },
    { id: 'sys',    name: '系统', icon: '📣', desc: '内政 / 经济 / 建设 / 江湖与其余提示' }
  ];""",
     'data.js 类别表加 doc:false')

edit('js/ui.js',
     """  ui.docTabHTML = function () {
    return '<div class="march-tabs doc-tabs">' + (DATA.MSG_KINDS || []).map(function (k) {""",
     """  /* v89.116：**公文页签只列 doc !== false 的类别**（烽火移出 —— 见 DATA.MSG_KINDS 注释）。
     唯一出口：页签渲染 / 页签切换校验 / 兜底全读它，不在别处写死类名。 */
  ui.docKinds = function () {
    return (DATA.MSG_KINDS || []).filter(function (k) { return k.doc !== false; });
  };
  ui.docTabHTML = function () {
    return '<div class="march-tabs doc-tabs">' + ui.docKinds().map(function (k) {""",
     'ui.js docKinds 唯一出口')

edit('js/ui.js',
     """  ui.setDocTab = function (v) {
    if (!DATA.MSG_KIND_BY[v]) return;""",
     """  ui.setDocTab = function (v) {
    if (!DATA.MSG_KIND_BY[v]) return;
    /* v89.116：不在公文页签里的类别（如 beacon）不许切进去 —— 老档 `_docTab='beacon'
       会在渲染时落到"该板块已移出公文"的说明页；切换则直接拒绝（保持现状）。 */
    var _okTab = ui.docKinds().some(function (k) { return k.id === v; });
    if (!_okTab) { ui._docTab = 'war'; ui._pages['docwar'] = 1; ui.renderView('reports'); return; }""",
     'ui.js setDocTab 校验')

# 公文正文：beacon 走"已移出"说明（老档 / 直调兜底）
edit('js/ui.js',
     """  ui.docBodyHTML = function (id) {
    var K = ui.docTabOf(id);""",
     """  ui.docBodyHTML = function (id) {
    var K = ui.docTabOf(id);
    /* v89.116：不进公文的类别（烽火）—— 直调（老档 _docTab 残留 / 测试）时给一句指引，
       而不是照旧渲染一套烽火流水（那正是老板要撤掉的那块）。 */
    if (K && K.doc === false) {
      return '<div class="q-empty">🔥 「' + U.escape(K.name) + '」已移出公文 —— 预警与来袭流水在' +
        '「军务 · 烽火」页（点上方页签可回到公文其它板块）。</div>';
    }""",
     'ui.js docBodyHTML 兜底')

# ============================================================
# ③ 军务 · 烽火：流水窗口 12 → 24 条 + 口径说明
# ============================================================
edit('js/ui.js',
     """  ui.MARCH_TABS = [['over', '军务总览'], ['exp', '出征'], ['def', '防守'], ['beacon', '烽火'], ['affairs', '军务处']];""",
     """  ui.MARCH_TABS = [['over', '军务总览'], ['exp', '出征'], ['def', '防守'], ['beacon', '烽火'], ['affairs', '军务处']];
  /* v89.116（老板「烽火相关流水已经存在于军务的烽火中」）：烽火流水窗口 ——
     公文不再给烽火页签，这条流水就是它的**唯一落点**，窗口从 12 提到 24 条。 */
  ui.BEACON_FLOW = 24;""",
     'ui.js 烽火流水窗口')

edit('js/ui.js',
     """    var flow = GAME.msgsOf('beacon').slice(0, 12);""",
     """    var flow = GAME.msgsOf('beacon').slice(0, ui.BEACON_FLOW);""",
     'ui.js 烽火流水取值')

edit('js/ui.js',
     """      out += ui.sealH('烽火流水', '最近 ' + flow.length + ' 条') +""",
     """      out += ui.sealH('烽火流水', '最近 ' + flow.length + ' 条 · 烽火的唯一落点（公文不再单列烽火板块）') +""",
     'ui.js 烽火流水标题')

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
        tmp = p + '.tmp116f'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(p), d0))
    print('补丁 F 完成')
    return 0


sys.exit(main())
