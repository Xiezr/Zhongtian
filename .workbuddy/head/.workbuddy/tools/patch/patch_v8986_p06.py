# -*- coding: utf-8 -*-
"""v89.86 整改 · P-06 故事「稍后阅读」
   现状：逸闻触发即全屏弹出（实测 25 分钟 7 次，打断连续操作）。
   修法：触发的逸闻入「待阅」+ 顶栏「史册」徽标 +1；从史册页「待阅逸闻」区再读。
        读一篇移出一篇；另有「忽略」。手动阅读仍走同一全屏阅读器。
"""
import io
import os
import sys

ST = r'E:\Deepseekdb\js\state.js'
UI = r'E:\Deepseekdb\js\ui.js'
MA = r'E:\Deepseekdb\js\main.js'
HT = r'E:\Deepseekdb\index.html'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ① state.js · 待阅清单（唯一出口）
edit(ST, r"""  GAME.SG.one = function (sid) {
    var all = GAME.SG.list();
    for (var i = 0; i < all.length; i++) if (all[i].id === sid) return all[i];
    return null;
  };""",
     r"""  GAME.SG.one = function (sid) {
    var all = GAME.SG.list();
    for (var i = 0; i < all.length; i++) if (all[i].id === sid) return all[i];
    return null;
  };

  /* v89.86（整改 P-06）：**待阅**清单 —— 触发的逸闻不再全屏弹出（实测 25 分钟触发 7 次，
     全屏层反复打断操作流）；改为入待阅 + 顶栏「史册」徽标 +1，从史册页「待阅逸闻」再读。
     入档（s.sgPending，懒初始化，不动 SAVE_VERSION）；上限 30 条（超限先删最旧）。 */
  GAME.SG.pending = function () {
    var s = GAME.state;
    if (!s) return [];
    if (!s.sgPending) s.sgPending = [];
    return s.sgPending;
  };
  GAME.SG.defer = function (sid) {
    var st = GAME.SG.one(sid);
    if (!st) return { ok: false, msg: '没有这篇故事' };
    var list = GAME.SG.pending();
    for (var i = 0; i < list.length; i++) {
      if (list[i].sid === sid) return { ok: true, dup: true, st: st, n: list.length };
    }
    var a = st.anchor || {};
    list.push({ sid: sid, title: st.title || sid, kind: a.kind || '', kid: a.id || '', at: U.now() });
    while (list.length > 30) list.shift();
    return { ok: true, n: list.length, st: st };
  };
  GAME.SG.takePending = function (sid) {
    var s = GAME.state;
    if (!s || !s.sgPending) return null;
    var idx = -1;
    s.sgPending.forEach(function (x, i) { if (x.sid === sid) idx = i; });
    if (idx < 0) return null;
    return s.sgPending.splice(idx, 1)[0];
  };""",
     'P-06 · 待阅清单')

# ② index.html · 史册徽标
edit(HT, r"""    <div class="tab" data-view="story"><i class="ti" data-nav="story"></i>史册</div>""",
     r"""    <div class="tab" data-view="story"><i class="ti" data-nav="story"></i>史册<span class="tab-badge hidden" id="tab-badge-story"></span></div>""",
     'P-06 · 史册徽标')

# ③ ui.js · syncBadges 挂徽标
edit(UI, r"""    var docTab = document.querySelector('#topnav .tab[data-view="reports"]');
    if (docTab) docTab.classList.toggle('fresh', (GAME.state.repUnread || 0) > 0);
  };""",
     r"""    var docTab = document.querySelector('#topnav .tab[data-view="reports"]');
    if (docTab) docTab.classList.toggle('fresh', (GAME.state.repUnread || 0) > 0);
    /* v89.86（整改 P-06）：待阅逸闻 —— 顶栏「史册」徽标（触发的逸闻不再全屏弹出） */
    var elS = $('#tab-badge-story');
    if (elS) {
      var ns = (GAME.SG && GAME.SG.pending) ? GAME.SG.pending().length : 0;
      elS.textContent = ns > 99 ? '99+' : ns;
      elS.classList.toggle('hidden', ns <= 0);
    }
  };""",
     'P-06 · syncBadges')

# ④ ui.js · 触发改入待阅 + 待阅区
edit(UI, r"""  /* 概率奇遇：点开建筑 / 地块后掷骰；命中则在面板之上开卷（弹窗不关） */
  ui.sgTryTrigger = function (kind, id) {
    if (!GAME.SG || !GAME.SG.roll || !id) return false;
    var r = GAME.SG.roll(kind, id);
    if (!r.fire) return false;
    ui.openStory(r.sid, true);
    return true;
  };
  /* v89.31 · 动作触发：战事 / 营造 / 民生 / 成长等动作结算后调用（见 GAME.SG.ACT 表）；
     命中即从「相关建筑」池里抽一篇，在当前画面（含弹窗）之上开卷（叠层语义）。 */
  ui.sgTryAct = function (key, ctx) {
    if (!GAME.SG || !GAME.SG.rollAct || !key) return false;
    var r = GAME.SG.rollAct(key, ctx);
    if (!r.fire) return false;
    ui.openStory(r.sid, true);
    return true;
  };""",
     r"""  /* v89.86（整改 P-06）：触发的逸闻**入待阅**（不再全屏弹出 —— 实测 25 分钟触发 7 次，
     全屏层反复打断操作流）。点了史册页的「待阅逸闻」再开卷；顶栏徽标 +1 提示。
     同一篇已在待阅中则不重复入列、不再提示（徽标不变）。 */
  ui.sgDefer = function (sid) {
    var r = GAME.SG.defer(sid);
    if (!r.ok) return false;
    ui.syncBadges();
    if (ui.view === 'story') GAME.refreshView();      /* 正停在史册页 → 顺手刷新待阅列表 */
    if (!r.dup) ui.toast('📖 得逸闻一则《' + r.st.title + '》—— 已入待阅（史册 → 待阅逸闻）');
    return true;
  };
  /* 概率奇遇：点开建筑 / 地块后掷骰；命中入待阅（v89.86 起不再直接开卷） */
  ui.sgTryTrigger = function (kind, id) {
    if (!GAME.SG || !GAME.SG.roll || !id) return false;
    var r = GAME.SG.roll(kind, id);
    if (!r.fire) return false;
    return ui.sgDefer(r.sid);
  };
  /* v89.31 · 动作触发：战事 / 营造 / 民生 / 成长等动作结算后调用（见 GAME.SG.ACT 表）；
     命中即入待阅（v89.86 起不再直接开卷）。 */
  ui.sgTryAct = function (key, ctx) {
    if (!GAME.SG || !GAME.SG.rollAct || !key) return false;
    var r = GAME.SG.rollAct(key, ctx);
    if (!r.fire) return false;
    return ui.sgDefer(r.sid);
  };
  /* v89.86（整改 P-06）：待阅区（史册页顶部；有才出）—— 阅读 / 忽略 */
  ui.sgPendingHTML = function () {
    var list = (GAME.SG && GAME.SG.pending) ? GAME.SG.pending() : [];
    if (!list.length) return '';
    return '<div class="story-card">' +
      '<div class="gold-heading">📖 待阅逸闻（' + list.length + '）' +
        ui.help('触发的逸闻不再全屏弹出（免得打断操作）。\n在此逐条阅读；读一篇移出一篇，「忽略」直接移除。') + '</div>' +
      list.map(function (x) {
        return '<div class="res-line"><span class="lbl">《' + U.escape(x.title) + '》</span>' +
          '<span class="val"><button class="btn sm gold" data-action="story-read" data-sid="' + x.sid + '">阅读</button> ' +
          '<button class="btn sm" data-action="story-drop" data-sid="' + x.sid + '">忽略</button></span></div>';
      }).join('') +
      '</div>';
  };
  ui.sgReadPending = function (sid) {
    var rec = GAME.SG.takePending(sid);
    if (!rec) { ui.toast('该逸闻已不在待阅'); ui.syncBadges(); GAME.refreshView(); return; }
    ui.syncBadges();
    ui.openStory(sid, false);
  };
  ui.sgDropPending = function (sid) {
    GAME.SG.takePending(sid);
    ui.syncBadges();
    ui.toast('已从待阅移除');
    GAME.refreshView();
  };""",
     'P-06 · 触发改入待阅')

# ⑤ ui.js · 史册页插入待阅区
edit(UI, r"""    return '<div class="ui-page">' +
      '<div class="story-grid"><div>' + sky + goalHtml + '</div><div>' + power + titleHtml + '</div></div>' +
      chronHtml +
      '</div>';
  };""",
     r"""    return '<div class="ui-page">' +
      ui.sgPendingHTML() +
      '<div class="story-grid"><div>' + sky + goalHtml + '</div><div>' + power + titleHtml + '</div></div>' +
      chronHtml +
      '</div>';
  };""",
     'P-06 · 史册页待阅区')

# ⑥ main.js · 阅读/忽略动作
edit(MA, r"""      case 'story-pick': ui.sgPick(Number(el.dataset.i)); break;""",
     r"""      case 'story-pick': ui.sgPick(Number(el.dataset.i)); break;
      /* v89.86（整改 P-06）：待阅逸闻 —— 阅读（移出并开卷）/ 忽略 */
      case 'story-read': ui.sgReadPending(el.dataset.sid); break;
      case 'story-drop': ui.sgDropPending(el.dataset.sid); break;""",
     'P-06 · main 动作')

print('DONE')
