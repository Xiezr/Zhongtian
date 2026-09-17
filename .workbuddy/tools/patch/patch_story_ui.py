#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_story_ui.py -- wire the text-game reader into js/ui.js

4 changes (each anchor must match exactly once):
  1) append: ui.SG_KIND / ui.SG_BLOCK / ui.openStoryList / ui.openStory /
             ui.sgRender / ui.sgHTML / ui.sgPick / ui.sgClose
  2) building modal : add a story button inside the function .op-row
  3) wild modal     : append a story block after the jianghu block
  4) city panel     : append a story block at the end of body

Style discipline: NO font-size / font-weight declarations are added here.
Titles reuse existing shared-rule classes (.gold-heading / .side-title);
body size uses inline var(--fs-*) tokens, same as the rest of ui.js.

NOTE: this file deliberately avoids backslash escapes (newlines via chr(10)),
      so that no escape can be eaten on the way to disk.
Idempotent: skips when ui.SG_BLOCK already exists.
"""
import io

P = r'E:\Deepseekdb\js\ui.js'
A = chr(10)

BLOCK = u"""
  /* ============================================================
   * Text game reader (content layer: story/vol-*.js; engine: GAME.SG)
   * Entries: building modal / wild modal / city panel.
   * Full-screen layer #story-fx, same spec as #scene-fx (body, z=1500).
   * ============================================================ */
  ui.SG_KIND = { building: '城内', ext: '城外', wild: '野地', city: '城池', misc: '世事' };

  /* entry block: returns '' when the anchor has no story (no empty shell) */
  ui.SG_BLOCK = function (kind, id, name) {
    if (!GAME.SG) return '';
    var rows = GAME.SG.anchor(kind, id);
    if (!rows.length) return '';
    var done = 0;
    rows.forEach(function (r) { if (r.done.length) done++; });
    return '<div class="op-zone">' +
      '<div class="op-zone-t">逸闻 · 此地故事（' + done + ' / ' + rows.length + '）</div>' +
      '<div class="op-row">' +
        '<button class="btn gold" data-action="story-list" data-kind="' + kind + '" data-id="' + id +
          '" data-name="' + U.escape(name || '') + '">📖 听一段故事</button>' +
        '<span class="op-hint">纯叙事 · 走到结局即得赏赐，不影响战斗与数值结算</span>' +
      '</div></div>';
  };

  /* story list (modal, reuses openShell) */
  ui.openStoryList = function (kind, id, name) {
    var rows = GAME.SG ? GAME.SG.anchor(kind, id) : [];
    var body = rows.length ? rows.map(function (r) {
      var total = (r.st.endings || []).length;
      var tag = r.done.length ? ('已读 ' + r.done.length + ' / ' + total) : '未读';
      return '<div class="res-line" style="align-items:center;gap:10px;">' +
        '<span class="lbl" style="flex:0 0 auto;">' + U.escape(r.st.title) + '</span>' +
        '<span class="ui-sub" style="flex:0 0 auto;">' + tag + '</span>' +
        '<span style="flex:1 1 auto;color:var(--text-dim);font-size:var(--fs-sub);">' +
          U.escape(r.st.hook || '') + '</span>' +
        '<button class="btn gold sm" data-action="story-open" data-sid="' + r.st.id + '">' +
          (r.done.length ? '再读' : '阅读') + '</button></div>';
    }).join('') : '<div class="q-empty">此处暂无故事（故事库按锚点铺开，逐步补齐）。</div>';
    ui.openShell({
      title: '📖 ' + U.escape(name || '逸闻'),
      sub: (ui.SG_KIND[kind] || '') + '　共 ' + rows.length + ' 篇　·　走到任一结局即得赏赐',
      size: 'xl',
      body: body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* open one story (full-screen reader) */
  ui.openStory = function (sid) {
    var r = GAME.SG.begin(sid);
    if (!r.ok) { ui.toast(r.msg); return; }
    ui.closeModal();
    ui.sgRender();
  };
  ui.sgRender = function () {
    var run = GAME.SG._run;
    if (!run) return;
    var el = document.getElementById('story-fx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-fx';
      el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.innerHTML = ui.sgHTML();
    el.scrollTop = 0;
  };
  /* 幕 / 结局两态；正文换行交给 .sgr-text 的 white-space: pre-wrap（不转 <br>） */
  ui.sgHTML = function () {
    var run = GAME.SG._run;
    if (!run) return '';
    var st = run.st;
    var h = '<div class="sgr-wrap">' +
      '<div class="sgr-banner">' +
        '<span class="ui-sub">' + (ui.SG_KIND[(st.anchor || {}).kind] || '逸闻') + '</span>' +
        '<span class="gold-heading sgr-title">' + U.escape(st.title) + '</span>' +
        '<span class="ui-sub">' + (run.phase === 'end' ? '终' : ('第 ' + (run.path.length + 1) + ' 幕')) + '</span>' +
        '<button class="btn sm" data-action="story-exit">' + (run.phase === 'end' ? '收起' : '掩卷') + '</button>' +
      '</div>';
    if (run.phase === 'end') {
      var e = run.ending || {};
      var g = run.got || { got: [] };
      var grade = e.grade === 'win' ? '善终' : (e.grade === 'lose' ? '遗憾' : '将就');
      h += '<div class="sgr-end sgr-g-' + (e.grade || 'win') + '">' +
        '<div class="side-title">' + grade + '</div>' +
        '<div class="sgr-text">' + U.escape(e.t || '') + '</div>' +
        (g.got && g.got.length ? '<div class="sgr-got">' + g.got.map(function (x) {
          return '<span class="sgr-gv"><i>' + U.escape(x.k) + '</i>' + U.numText(x.v, 0) + '</span>';
        }).join('') + '<span class="sgr-note">' + (g.first ? '初读此结局' : '重读') + '　已阅 ' +
          g.done + ' / ' + g.total + ' 个结局</span></div>' : '') +
        '<div class="sgr-ops"><button class="btn gold" data-action="story-exit">回到城中</button></div>' +
        '</div></div>';
      return h;
    }
    var node = GAME.SG.nodeOf(run, run.nodeId);
    if (!node) return h + '<div class="q-empty">幕文缺失</div></div>';
    h += '<div class="side-title">' + U.escape(node.s || '') + '</div>' +
      '<div class="sgr-text">' + U.escape(node.t || '') + '</div>' +
      '<div class="sgr-ops">' + (node.o || []).map(function (op, i) {
        return '<button class="btn sgr-opt" data-action="story-pick" data-i="' + i + '">' +
          '<span class="sgr-l">' + U.escape(op.l || '') + '</span>' +
          (op.d ? '<span class="sgr-d">' + U.escape(op.d) + '</span>' : '') + '</button>';
      }).join('') + '</div></div>';
    return h;
  };
  ui.sgPick = function (i) {
    var r = GAME.SG.choose(i);
    if (!r.ok) { ui.toast(r.msg); return; }
    ui.sgRender();
  };
  ui.sgClose = function () {
    var el = document.getElementById('story-fx');
    if (el) el.style.display = 'none';
    GAME.SG.close();
    if (GAME.refreshAll) GAME.refreshAll();
  };
"""

EDIT2_OLD = u"""              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button></div>' +
          '</div>') : ''; })() +"""
EDIT2_NEW = u"""              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>' +
              ui.SG_BLOCK('building', b.id, b.name) + '</div>' +
          '</div>') : ''; })() +"""

EDIT3_OLD = u"""      wsurvLine + ui.jianghuHTML(x, y) +
      stat + ops +"""
EDIT3_NEW = u"""      wsurvLine + ui.jianghuHTML(x, y) + ui.SG_BLOCK('wild', tile.terrain, ter.name) +
      stat + ops +"""

EDIT4_OLD = u"""        })() : ''),
      foot: '<div class="m-foot">' +
        (isOwn
          ? '<button class="btn gold" data-action="city-enter" data-city="' + city.id + '">进入城池</button>' +"""
EDIT4_NEW = u"""        })() : '') + ui.SG_BLOCK('city', city.type, city.name),
      foot: '<div class="m-foot">' +
        (isOwn
          ? '<button class="btn gold" data-action="city-enter" data-city="' + city.id + '">进入城池</button>' +"""

EDITS = [(EDIT2_OLD, EDIT2_NEW), (EDIT3_OLD, EDIT3_NEW), (EDIT4_OLD, EDIT4_NEW)]

src = io.open(P, encoding='utf-8', newline='').read()
if u'ui.SG_BLOCK = function' in src:
    print('ui.js already contains SG_BLOCK -- skip (idempotent)')
    raise SystemExit(0)

for i, (old, new) in enumerate(EDITS, 1):
    n = src.count(old)
    if n != 1:
        print('ANCHOR %d matched %d times (expected 1) -- aborted, file untouched' % (i, n))
        raise SystemExit(1)
    src = src.replace(old, new)
    print('entry %d wired' % i)

END = A + '})();' + A
if not src.endswith(END):
    print('tail shape mismatch -- aborted')
    raise SystemExit(1)
src = src[:-len(END)] + BLOCK + '})();' + A
io.open(P, 'w', encoding='utf-8', newline='').write(src)

chk = io.open(P, encoding='utf-8', newline='').read()
ok = (u'ui.SG_BLOCK = function' in chk) and chk.endswith('})();' + A)
ok = ok and chk.count(u"ui.SG_BLOCK('building'") == 1
ok = ok and chk.count(u"ui.SG_BLOCK('wild'") == 1
ok = ok and chk.count(u"ui.SG_BLOCK('city'") == 1
print('ui.js written (%d chars) -- verify %s' % (len(chk), 'PASS' if ok else 'FAIL'))
raise SystemExit(0 if ok else 1)
