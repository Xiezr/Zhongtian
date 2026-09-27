# -*- coding: utf-8 -*-
# v89.153d：ui.js —— 公文重构（默认系统页 / 战报去军情流水 / 系统页三合一 + 小标签 + 主题色）
import io, re

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
n = 0

def rep(tag, old, new, guard):
    global s, n
    if guard in s:
        print('  skip ' + tag); return
    c = s.count(old)
    assert c == 1, tag + ' count=' + str(c)
    s = s.replace(old, new)
    n += 1
    print('  OK   ' + tag)

# ---------- ① 默认页签 + docCountOf ----------
rep('default-tab',
    u"""  ui._docTab = 'war';""",
    u"""  /* v89.153（老板 1/2）：默认落在「系统」页（页签顺序第一 —— 系统 / 战报 / 侦查）。 */
  ui._docTab = 'sys';""",
    guard=u'默认落在「系统」页')

rep('count-of',
    u"""  ui.docCountOf = function (id) {
    if (id === 'war' || id === 'scout') return ui.docReportsOf(id).length;
    return GAME.msgsOf(id).length;
  };""",
    u"""  ui.docCountOf = function (id) {
    if (id === 'war' || id === 'scout') return ui.docReportsOf(id).length;
    if (id === 'sys') return GAME.msgFeedOf().length;      /* v89.153：三源合一（军情/任务/系统） */
    return GAME.msgsOf(id).length;
  };""",
    guard=u'v89.153：三源合一（军情/任务/系统）')

# ---------- ② 军情流水（WAR_FLOW / warFlowOf）退役 ----------
rep('war-flow-out',
    u"""  /* 军情流水（war 类消息）—— 战报页下半段。
     它是**滚动窗**（msgLog 按 10 游戏天 / ≤800 条裁剪），所以只列最近 N 条；
     要长期留存的是「战报（报告）」，那一段全量 + 分页。 */
  ui.WAR_FLOW = 20;
  ui.warFlowOf = function () { return GAME.msgsOf('war').slice(0, ui.WAR_FLOW); };""",
    u"""  /* ⛔ v89.153（老板 2）：「将战报中的军情……整合到系统菜单下」——
     `ui.WAR_FLOW` / `ui.warFlowOf`（战报页下半段的军情流水）整条退役：
     军情（war 类消息）现在落在**系统页**（`GAME.msgFeedOf` 三源合一 + 「军情」小标签）。 */""",
    guard=u'`ui.WAR_FLOW` / `ui.warFlowOf`（战报页下半段的军情流水）整条退役')

# ---------- ③ setDocTab 回落 ----------
rep('settabs',
    u"""    var _okTab = ui.docKinds().some(function (k) { return k.id === v; });
    if (!_okTab) { ui._docTab = 'war'; ui._pages['docwar'] = 1; ui.renderView('reports'); return; }""",
    u"""    var _okTab = ui.docKinds().some(function (k) { return k.id === v; });
    if (!_okTab) { ui._docTab = 'sys'; ui._pages['docsys'] = 1; ui.renderView('reports'); return; }""",
    guard=u"if (!_okTab) { ui._docTab = 'sys';")

# ---------- ④ 小标签/主题色/消息行 三个新助手（插在 docLinesHTML 之前） ----------
ANCHOR = u"""  /* 消息流水行（烽火 / 任务 / 系统三页共用）：一行 = 时刻 + 文本，按类别上色
     （沿用 .bb-line 既有配色；时刻只到分 —— 一屏 15 行要扫得动） */"""
ADD = u"""  /* ============================================================
   * v89.153（老板 2）：系统页**小标签**（参考战报的 全部/胜/败）+ **主题色**
   * ------------------------------------------------------------
   * 标签 id = `GAME.msgSubOf(rec)` 的返回值（era/weather/build/gather/war/task/sys），
   * 界面三处（chips / 筛选 / 行色）全读它 —— 不另立映射表。
   * 颜色是**数据的属性**：主题色在 DATA.MSG_SUBS，大类色在 DATA.MSG_TAG_COLOR
   * （chips 与消息行都从这读；CSS 里不各写一份）。
   * ============================================================ */
  ui._msgTag = 'all';
  ui.MSG_TAG_ORDER = ['war', 'task', 'era', 'weather', 'build', 'gather', 'sys'];
  ui.msgTagNameOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].name;
    return DATA.MSG_TAG_NAME[tag] || (DATA.MSG_KIND_BY[tag] ? DATA.MSG_KIND_BY[tag].name : tag);
  };
  ui.msgTagColorOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].color;
    return DATA.MSG_TAG_COLOR[tag] || 'var(--text-dim)';
  };
  /* 小标签行：**全部** + 有消息的标签（"只列有货的" —— 与宝物页分类同一口径） */
  ui.msgTagChipsHTML = function (feed) {
    var have = {};
    (feed || []).forEach(function (r) { have[GAME.msgSubOf(r)] = 1; });
    var list = ui.MSG_TAG_ORDER.filter(function (t) { return have[t]; });
    var h = '<div class="msg-channels">' +
      '<span class="ch' + (ui._msgTag === 'all' ? ' active' : '') +
        '" data-action="msg-tag" data-v="all">全部</span>';
    list.forEach(function (t) {
      h += '<span class="ch' + (ui._msgTag === t ? ' active' : '') + '" data-action="msg-tag" data-v="' + t +
        '" style="color:' + ui.msgTagColorOf(t) + '">' + ui.msgTagNameOf(t) + '</span>';
    });
    return h + '</div>';
  };
  /* 一条系统页消息行：时刻 + 文本，**字体颜色 = 主题色**（老板 2「字体颜色不同」） */
  ui.msgLineHTML = function (l) {
    var d = new Date(l.t);
    return '<div class="bb-line" style="color:' + ui.msgTagColorOf(GAME.msgSubOf(l)) + '">' +
      '<span class="bl-t">' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      U.escape(l.msg) + '</div>';
  };
  ui.setMsgTag = function (v) {
    ui._msgTag = v || 'all';
    ui._pages['docsys'] = 1;                    /* 切标签回第 1 页（同页签/背包口径） */
    ui.renderView('reports');
  };
  /* 任务可领取摘要（原「任务」页内容 · v89.153 并入系统页） */
  ui.msgTaskSummaryHTML = function () {
    var s = GAME.state, out = [];
    var sum = GAME.questSummary();
    out.push('<div class="bb-line task" style="color:' + ui.msgTagColorOf('task') + '"><b>任务 · 可领取 ' +
      sum.ready + ' 项</b>（成长 ' + sum.growthReady + ' · 随机 ' + sum.randReady + '）</div>');
    (DATA.QUESTS || []).forEach(function (q) {
      if (!GAME.questDone(q) && GAME.questReady(q)) {
        out.push('<div class="bb-line task" style="color:' + ui.msgTagColorOf('task') + '">· ' +
          U.escape(q.title) + '</div>');
      }
    });
    (s.quests.pool || []).forEach(function (e) {
      var d = GAME.randomQuestDef(e.id);
      if (d && GAME.randQuestReady(e)) {
        out.push('<div class="bb-line task" style="color:' + ui.msgTagColorOf('task') + '">· [随机] ' +
          U.escape(d.title) + '</div>');
      }
    });
    return '<div class="msg-log">' + out.join('') + '</div>';
  };
  /* 消息流水行（烽火 / 侦查页用）：一行 = 时刻 + 文本，按类别上色
     （沿用 .bb-line 既有配色；时刻只到分 —— 一屏 15 行要扫得动） */"""

rep('helpers', ANCHOR, ADD, u'v89.153（老板 2）：系统页**小标签**')

# ---------- ⑤ doc===false 分支（task 特判） ----------
rep('doc-false',
    u"""    if (K && K.doc === false) {
      return '<div class="q-empty">🔥 「' + U.escape(K.name) + '」已移出公文 —— 预警与来袭流水在' +
        '「军务 · 烽火」页（点上方页签可回到公文其它板块）。</div>';
    }""",
    u"""    if (K && K.doc === false) {
      /* v89.153：task 并入系统页；beacon 另有落点（军务 · 烽火）—— 按类别给不同指引 */
      if (K.id === 'task') {
        return '<div class="q-empty">📜 「任务」已并入「系统」页（v89.153）——' +
          '点上方「系统」页签，可选「任务」小标签筛选。</div>';
      }
      return '<div class="q-empty">🔥 「' + U.escape(K.name) + '」已移出公文 —— 预警与来袭流水在' +
        '「军务 · 烽火」页（点上方页签可回到公文其它板块）。</div>';
    }""",
    guard=u'「任务」已并入「系统」页（v89.153）')

# ---------- ⑥ 战报页：删军情流水 ----------
rep('war-page',
    u"""    /* ---- 战报：上半 = 战报（报告 · 筛选 + 分页）；下半 = 军情流水（滚动窗最近 20 条） ---- */
    if (id === 'war') {
      var rf = ui._repFilter;
      if (['all', 'win', 'lose', 'fav'].indexOf(rf) < 0) rf = 'all';
      var allRep = ui.docReportsOf('war');
      var flow = ui.warFlowOf();
      var chips = [['all', '全部'], ['win', '🏆 胜'], ['lose', '⚔️ 败'], ['fav', '⭐ 收藏']]
        .map(function (c) {
          return '<span class="ch' + (rf === c[0] ? ' active' : '') + '" data-action="rep-filter" data-v="' +
            c[0] + '">' + c[1] + '</span>';
        }).join('');
      if (!allRep.length && !flow.length) {
        return '<div class="q-empty">尚无军情 —— 出征 / 攻城 / 行军 / 防守都会记在这里。</div>';
      }
      var hit = allRep.filter(function (r) {
        if (rf === 'win' && !r.win) return false;
        if (rf === 'lose' && r.win) return false;
        if (rf === 'fav' && !r.fav) return false;
        return true;
      });
      var pg = ui.pageOf('docwar', hit.length, ui.DOC_PER);
      var rows = hit.slice(pg.from, pg.to).map(function (r) {
        return ui.docRepRowHTML(r, true);      /* v89.120：身份走 rid，不再传数组下标 */
      }).join('');
      var h = '<div class="msg-channels">' + chips + '</div>' +
        (allRep.length ? (hit.length ? rows : '<div class="q-empty">此筛选下没有战报。</div>')
                       : '<div class="q-empty">尚无战报 —— 出征 / 攻城 / 防守的战果都会记在这里。</div>') +
        (allRep.length ? '<div class="ui-sub">共 ' + allRep.length + ' 份战报 · 收藏 ' +
          allRep.filter(function (r) { return r.fav; }).length + ' 份</div>' : '');
      if (flow.length) {
        h += ui.sealH('军情', '最近 ' + flow.length + ' 条' +
            ui.help('行军 / 抵城 / 调防 / 缴获 / 驻守这类军事流水。\\n消息按最近 ' + GAME.msgDays() +
              ' 游戏天滚动保留，长期留存的是上面的「战报」。')) +
          '<div class="msg-log">' + flow.map(function (m) {
            var d = new Date(m.t);
            return '<div class="bb-line war"><span class="bl-t">' + U.pad(d.getHours()) + ':' +
              U.pad(d.getMinutes()) + '</span>' + U.escape(m.msg) + '</div>';
          }).join('') + '</div>';
      }
      return h;
    }""",
    u"""    /* ---- 战报：**只列战报**（报告 · 筛选 + 分页）——军情流水 v89.153 起在「系统」页 ---- */
    if (id === 'war') {
      var rf = ui._repFilter;
      if (['all', 'win', 'lose', 'fav'].indexOf(rf) < 0) rf = 'all';
      var allRep = ui.docReportsOf('war');
      var chips = [['all', '全部'], ['win', '🏆 胜'], ['lose', '⚔️ 败'], ['fav', '⭐ 收藏']]
        .map(function (c) {
          return '<span class="ch' + (rf === c[0] ? ' active' : '') + '" data-action="rep-filter" data-v="' +
            c[0] + '">' + c[1] + '</span>';
        }).join('');
      if (!allRep.length) {
        return '<div class="q-empty">尚无战报 —— 出征 / 攻城 / 防守的战果都会记在这里' +
          '（军事流水见「系统 · 军情」）。</div>';
      }
      var hit = allRep.filter(function (r) {
        if (rf === 'win' && !r.win) return false;
        if (rf === 'lose' && r.win) return false;
        if (rf === 'fav' && !r.fav) return false;
        return true;
      });
      var pg = ui.pageOf('docwar', hit.length, ui.DOC_PER);
      var rows = hit.slice(pg.from, pg.to).map(function (r) {
        return ui.docRepRowHTML(r, true);      /* v89.120：身份走 rid，不再传数组下标 */
      }).join('');
      return '<div class="msg-channels">' + chips + '</div>' +
        (hit.length ? rows : '<div class="q-empty">此筛选下没有战报。</div>') +
        '<div class="ui-sub">共 ' + allRep.length + ' 份战报 · 收藏 ' +
          allRep.filter(function (r) { return r.fav; }).length + ' 份</div>';
    }""",
    guard=u'战报：**只列战报**（报告 · 筛选 + 分页）')

# ---------- ⑦ 任务页退役 → 系统页（三源合一） ----------
rep('task-page',
    u"""    /* ---- 任务：可领取摘要（沿用旧频道内容）+ 任务类消息 ---- */
    if (id === 'task') {
      var s = GAME.state, out = [];
      var sum = GAME.questSummary();
      out.push('<div class="bb-line task"><b>可领取 ' + sum.ready + ' 项</b>（成长 ' +
        sum.growthReady + ' · 随机 ' + sum.randReady + '）</div>');
      (DATA.QUESTS || []).forEach(function (q) {
        if (!GAME.questDone(q) && GAME.questReady(q)) {
          out.push('<div class="bb-line task">· ' + U.escape(q.title) + '</div>');
        }
      });
      (s.quests.pool || []).forEach(function (e) {
        var d = GAME.randomQuestDef(e.id);
        if (d && GAME.randQuestReady(e)) out.push('<div class="bb-line task">· [随机] ' + U.escape(d.title) + '</div>');
      });
      var tl = ui.docLinesHTML('task');
      return '<div class="msg-log">' + out.join('') + '</div>' + tl;
    }
    /* ---- 烽火 / 系统：消息流水 ---- */
    var rows2 = ui.docLinesHTML(id);
    if (!rows2) {
      return '<div class="q-empty">' + (id === 'beacon'
        ? '烽火未起 —— 敌军来犯前会在这里预警（烽火台等级越高，预警越早）。'
        : '暂无系统提示。') + '</div>';
    }
    return rows2;""",
    u"""    /* ---- 系统：军情 / 任务 / 系统**三源合一** + 小标签筛选（v89.153 老板 2） ---- */
    if (id === 'sys') {
      var feed = GAME.msgFeedOf();
      var tag = ui._msgTag;
      if (tag !== 'all' && !feed.some(function (r) { return GAME.msgSubOf(r) === tag; })) {
        tag = 'all'; ui._msgTag = 'all';          /* 标签失效（消息被滚动清掉）→ 回落"全部" */
      }
      var hit = (tag === 'all') ? feed
        : feed.filter(function (r) { return GAME.msgSubOf(r) === tag; });
      var h = ui.msgTagChipsHTML(feed);
      /* 任务可领取摘要（原「任务」页内容）—— 只在「全部 / 任务」标签下置顶 */
      if (tag === 'all' || tag === 'task') h += ui.msgTaskSummaryHTML();
      if (!feed.length) {
        return h + '<div class="q-empty">暂无消息 —— 军情 / 任务 / 内政与其余提示都会汇总到这里。</div>';
      }
      var pg = ui.pageOf('docsys', hit.length, ui.MSG_PER);
      h += hit.length
        ? '<div class="msg-log">' + hit.slice(pg.from, pg.to).map(ui.msgLineHTML).join('') + '</div>'
        : '<div class="q-empty">此标签下暂无消息。</div>';
      h += hit.length ? '<div class="ui-sub">共 ' + hit.length + ' 条（军情 / 任务 / 系统三源合一 · 按最近 ' +
        GAME.msgDays() + ' 游戏天滚动保留）</div>' : '';
      return h;
    }
    /* ---- 烽火等其余消息类：流水（直调兜底） ---- */
    var rows2 = ui.docLinesHTML(id);
    if (!rows2) {
      return '<div class="q-empty">' + (id === 'beacon'
        ? '烽火未起 —— 敌军来犯前会在这里预警（烽火台等级越高，预警越早）。'
        : '暂无系统提示。') + '</div>';
    }
    return rows2;""",
    guard=u'系统：军情 / 任务 / 系统**三源合一**')

# ---------- ⑧ docPagerReg：去掉 task 特判 ----------
rep('pager-reg',
    u"""  ui.docPagerReg = function (id) {
    var total, per;
    if (id === 'war' || id === 'scout') { total = ui.docCountOf(id); per = ui.DOC_PER; }
    else if (id === 'task') return '';             /* 任务页内容有限，一次列完 */
    else { total = ui.docCountOf(id); per = ui.MSG_PER; }
    if (total > per) ui.pagerHTML('doc' + id, total, per);
    return '';
  };""",
    u"""  ui.docPagerReg = function (id) {
    var total, per;
    if (id === 'war' || id === 'scout') { total = ui.docCountOf(id); per = ui.DOC_PER; }
    else { total = ui.docCountOf(id); per = ui.MSG_PER; }   /* v89.153：task 页退役，系统页照常分页 */
    if (total > per) ui.pagerHTML('doc' + id, total, per);
    return '';
  };""",
    guard=u'v89.153：task 页退役，系统页照常分页')

# ---------- ⑨ reportsHTML 的 help 文案 ----------
rep('help-text',
    u"""      '<div class="gold-heading">📜 公文 · ' + K.name +
        ui.help(K.desc + '\\n各类独立成页，顶部页签切换。\\n战报支持「胜 / 败 / 收藏」筛选与分页。') + '</div>' +""",
    u"""      '<div class="gold-heading">📜 公文 · ' + K.name +
        ui.help(K.desc + '\\n三类独立成页（系统 / 战报 / 侦查），顶部页签切换。\\n' +
          '系统页按小标签筛选：军情 / 任务 / 改元 / 天时 / 建造 / 采集收获。\\n' +
          '战报支持「胜 / 败 / 收藏」筛选与分页。') + '</div>' +""",
    guard=u'三类独立成页（系统 / 战报 / 侦查）')

# ---------- 写盘 + 自检 ----------
def cb(t):
    return (len(re.findall(r'(?<![\\^])\{', t)), len(re.findall(r'(?<![\\^])\}', t)))
_bk = io.open(P, encoding='utf-8', newline='').read()
assert (cb(s)[0] - cb(s)[1]) == (cb(_bk)[0] - cb(_bk)[1]), 'brace imbalance'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert u'ui.warFlowOf = function' not in chk, 'warFlowOf remains (exec form)'
assert chk.count(u'ui.msgLineHTML = function') == 1 and chk.count(u'ui.msgTagChipsHTML = function') == 1
assert u"\n  ui._msgTag = 'all';" in chk and chk.count(u"ui._msgTag = 'all'") == 2
print('OK len %d -> %d (segs %d)' % (orig, len(chk), n))
