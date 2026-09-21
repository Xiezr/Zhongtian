# -*- coding: utf-8 -*-
"""
v89.89 · C4 故事集（回看+收集） + E3 人口三段条

① state.js + domain.js：人口增势提取唯一出口 GAME.popGrowthOf（UI 与 tickOnce 同源）
② ui.js：
   · storyHTML 加「📖 故事集」卡片（按 SG_KIND 五类分组；已读可点重读；未读？？？）
   · troopsHTML 募兵工具条：P-05 单行说明 → 三段条（可征/上限/增势 + 进度条）
③ main.js：case 'story-read-at'
④ index.html：.sg-item / .pop-3 样式
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
# ① 人口增势唯一出口
# ============================================================
patch(R + 'js\\domain.js', [
    ("""  /* --------- 城内建筑统计 --------- */
  GAME.numBuilding = function (city, bid) {""",
     """  /* v89.89（E3 · 100+ 轮实玩期待）：人口增势**唯一出口** ——
     此前公式内联在 tickOnce 里，UI 想显示就得重算一遍（本项目最经典的失效模式）。
     现在两处同源：每小时 0.05% 量级，保底 1。 */
  GAME.popGrowthOf = function (city) {
    var maxPop = GAME.maxPopOf(city);
    return Math.max(1, maxPop * 0.0005);
  };

  /* --------- 城内建筑统计 --------- */
  GAME.numBuilding = function (city, bid) {"""),
], 'domain.js popGrowthOf')

patch(R + 'js\\state.js', [
    ("""    s.cities.forEach(function (city) {
      var maxPop = GAME.maxPopOf(city);
      var growth = Math.max(1, maxPop * 0.0005); // 每小时0.05%量级
      var R = GAME.res(city);""",
     """    s.cities.forEach(function (city) {
      var maxPop = GAME.maxPopOf(city);
      var growth = GAME.popGrowthOf(city);   /* v89.89（E3）：唯一出口（与募兵面板同源） */
      var R = GAME.res(city);"""),
], 'state.js tickOnce 走出口')

# ============================================================
# ② ui.js
# ============================================================
patch(R + 'js\\ui.js', [
    # 2a. 故事集卡片（storyHTML：chronHtml 前插入）
    ("""    var chronHtml =
      '<div class="story-card">' +
        '<div class="gold-heading">📜 史书纪事（' + items.length + ' 条）</div>' +""",
     """    /* v89.89（C4 · 100+ 轮实玩期待）：📖 故事集 —— 已读回看 + 收集进度。
       28 篇读完此前无回看入口（仅当前事件的"重读"）。按锚点类别（SG_KIND 五类）归组；
       未读不剧透（？？？）；点已读篇目直接重读（openStory，不走待阅）。 */
    var allSt = (GAME.SG && GAME.SG.list) ? GAME.SG.list() : [];
    var prS = GAME.SG.progress();
    var kindsOrd = ['building', 'ext', 'wild', 'city', 'misc'];
    var byK = {};
    var readCnt = 0, endGot = 0, endTot = 0;
    allSt.forEach(function (st) {
      var r = prS[st.id] || {};
      var tot = (st.endings || []).length;
      var got = (r.done || []).length;
      var isRead = got > 0 || (r.n || 0) > 0;
      if (isRead) { readCnt++; endGot += got; endTot += tot; }
      var k = ((st.anchor || {}).kind) || 'misc';
      if (kindsOrd.indexOf(k) < 0) k = 'misc';
      (byK[k] = byK[k] || []).push({ st: st, tot: tot, got: got, read: isRead });
    });
    var sgRows = kindsOrd.map(function (k) {
      var arr = (byK[k] || []).slice().sort(function (a, b) {
        if (a.read !== b.read) return a.read ? -1 : 1;      /* 已读在前 */
        return a.st.id < b.st.id ? -1 : 1;
      });
      if (!arr.length) return '';
      var rN = arr.filter(function (x) { return x.read; }).length;
      return '<div class="sg-row"><span class="sg-k">' + (ui.SG_KIND[k] || k) + '</span>' +
        '<span class="sg-items">' + arr.map(function (x) {
          return x.read
            ? '<span class="sg-item" data-action="story-read-at" data-sid="' + x.st.id +
              '" title="重读《' + U.escape(x.st.title) + '》（已阅 ' + x.got + '/' + x.tot + ' 结局）">《' +
              U.escape(x.st.title) + '》<i>' + x.got + '/' + x.tot + '</i></span>'
            : '<span class="sg-item dim" title="尚未得见 —— 随建筑 / 野地 / 城池的首次互动触发">《？？？》</span>';
        }).join('') + '</span><span class="sg-n">' + rN + '/' + arr.length + '</span></div>';
    }).join('');
    var sgCard = allSt.length
      ? '<div class="story-card"><div class="gold-heading">📖 故事集（已读 ' + readCnt + ' / ' + allSt.length +
        ' 篇 · 结局 ' + endGot + ' / ' + endTot + '）' +
        ui.help('点已读篇目可重读（收集全部结局）。\\n未读者不剧透；故事随建筑 / 野地 / 城池首访与世事触发。') +
        '</div>' + sgRows + '</div>'
      : '';

    var chronHtml =
      '<div class="story-card">' +
        '<div class="gold-heading">📜 史书纪事（' + items.length + ' 条）</div>' +"""),
    # 2b. 挂进 return
    ("""    return '<div class="ui-page">' +
      ui.sgPendingHTML() +
      '<div class="story-grid"><div>' + sky + goalHtml + '</div><div>' + power + titleHtml + '</div></div>' +
      chronHtml +
      '</div>';
  };""",
     """    return '<div class="ui-page">' +
      ui.sgPendingHTML() +
      '<div class="story-grid"><div>' + sky + goalHtml + '</div><div>' + power + titleHtml + '</div></div>' +
      sgCard +
      chronHtml +
      '</div>';
  };"""),
    # 2c. E3：募兵工具条人口三段条
    ("""        /* v89.86（整改 P-05）：募兵吃人口的说明常驻（此前零提示，"200→140"一脸问号） */
        (sel ? '<span class="ui-sub">每兵占人口 ' + sel.pop + '（可用 ' + U.numText(Math.floor(s.res.pop || 0), 0) + '）</span>' : '') +""",
     """        /* v89.86（整改 P-05）：募兵吃人口的说明常驻（此前零提示，"200→140"一脸问号）。
           v89.89（E3 · 100+ 轮实玩期待）：升级为**三段条**（可征 / 上限 / 增势）+ 进度条 ——
           人口与兵源的关系一眼可见；增势走 GAME.popGrowthOf 唯一出口（与 tickOnce 同源）。 */
        (sel ? (function () {
          var avail = Math.floor(s.res.pop || 0);
          var capP = GAME.maxPopOf(c) || 0;
          var grow = Math.round(GAME.popGrowthOf(c));
          var pct = capP > 0 ? Math.min(100, Math.round(avail / capP * 100)) : 0;
          return '<span class="pop-3" title="可征＝当前可用人口（募兵从此扣）· 上限＝民房决定 · 增势＝每小时自然增长">' +
            '<span class="p3-k">人口</span>' +
            '<span class="p3-seg ok">可征 <b>' + U.numText(avail, 0) + '</b></span>' +
            '<span class="p3-seg">上限 <b>' + U.numText(capP, 0) + '</b></span>' +
            '<span class="p3-seg">增势 <b>+' + grow + '/时</b></span>' +
            '<span class="p3-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="p3-note">每兵占人口 ' + sel.pop + '</span>' +
            '</span>';
        })() : '') +"""),
], 'ui.js 故事集 + 人口三段条')

# ============================================================
# ③ main.js：story-read-at
# ============================================================
patch(R + 'js\\main.js', [
    ("""      case 'story-read': ui.sgReadPending(el.dataset.sid); break;""",
     """      case 'story-read': ui.sgReadPending(el.dataset.sid); break;
      /* v89.89（C4）：故事集 → 已读重读（不经待阅） */
      case 'story-read-at': ui.openStory(el.dataset.sid, false); break;"""),
], 'main.js story-read-at')

# ============================================================
# ④ index.html：样式
# ============================================================
patch(R + 'index.html', [
    ("""  /* v89.89（A4）：材料产地跳转图标 */
  .mat-go { cursor: pointer; opacity: .55; margin-left: 3px; }
  .mat-go:hover { opacity: 1; }""",
     """  /* v89.89（A4）：材料产地跳转图标 */
  .mat-go { cursor: pointer; opacity: .55; margin-left: 3px; }
  .mat-go:hover { opacity: 1; }
  /* v89.89（C4）：故事集（已读回看 + 收集进度） */
  .sg-row { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; flex-wrap: wrap; }
  .sg-k { flex: none; width: 44px; color: var(--gold-light); font-size: var(--fs-sub); font-weight: 700; }
  .sg-items { flex: 1; display: flex; flex-wrap: wrap; gap: 4px 10px; }
  .sg-item { color: var(--gold-light); font-size: var(--fs-body); cursor: pointer; }
  .sg-item:hover { text-decoration: underline; }
  .sg-item i { font-style: normal; font-size: var(--fs-sub); color: var(--text-dim); margin-left: 2px; }
  .sg-item.dim { color: var(--text-dim); cursor: default; opacity: .55; }
  .sg-item.dim:hover { text-decoration: none; }
  .sg-n { flex: none; font-size: var(--fs-sub); color: var(--text-dim); }
  /* v89.89（E3）：募兵面板人口三段条 */
  .pop-3 { display: inline-flex; align-items: center; gap: 8px; }
  .pop-3 .p3-k { color: var(--text-dim); font-size: var(--fs-sub); }
  .pop-3 .p3-seg { font-size: var(--fs-sub); color: var(--text-dim); }
  .pop-3 .p3-seg b { color: var(--text); font-variant-numeric: tabular-nums; }
  .pop-3 .p3-seg.ok b { color: var(--green-ok); }
  .pop-3 .p3-bar { width: 88px; height: 6px; border-radius: 3px; background: rgba(var(--sh-rgb),.5);
    border: 1px solid var(--line-strong); overflow: hidden; }
  .pop-3 .p3-bar i { display: block; height: 100%; background: var(--green-ok); }
  .pop-3 .p3-note { font-size: var(--fs-sub); color: var(--text-dim); }"""),
], 'index.html sg-item/pop-3 样式')

print('DONE' if ok_all else 'HAS-FAILURES')
sys.exit(0 if ok_all else 1)
