#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_story_final.py -- (a) wild entry for UNOWNED tiles, (b) e2e section 81

(a) ui.js: the wild modal has two branches; the first patch covered the OWNED one.
    Add the story block to the unowned branch as well, so 野地 stories are reachable
    BEFORE occupying (same policy as the jianghu block, which shows in both branches).
(b) e2e-test.js: real-DOM path — building modal -> story list -> reader -> ending -> close,
    plus an empty-state check (a building without stories shows no block).

No backslash escapes: single-line anchors only, no regex literals.
Idempotent: each target checks its own marker first.
"""
import io

UI = r'E:\Deepseekdb\js\ui.js'
E2E = r'E:\Deepseekdb\e2e-test.js'
A = chr(10)

UI_OLD = u"""        wsurvLine + ui.jianghuHTML(x, y) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +"""
UI_NEW = u"""        wsurvLine + ui.jianghuHTML(x, y) + ui.SG_BLOCK('wild', tile.terrain, ter.name) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +"""

E2E_ANCHOR = u"""  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

E2E_SECTION = u"""  console.log('');
  console.log('--- 81. 文字游戏 · 故事库（真实点击） ---');
  await (async function () {
    check('★ 故事库已载入（≥5 篇）', !!(G.SG && G.SG.list().length >= 5),
      G.SG ? (G.SG.list().length + ' 篇') : '无');
    var city = G.currentCity();
    var gi = -1;
    city.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'guanfu') gi = i; });
    check('官府地块定位', gi >= 0);
    G.ui.openBuildModal(gi);
    await sleep(30);
    var entry = document.querySelector('#modal-root [data-action="story-list"][data-kind="building"][data-id="guanfu"]');
    check('★ 建筑弹窗出现「逸闻」入口', !!entry);
    click(entry);
    await sleep(30);
    var rd = document.querySelector('#modal-root [data-action="story-open"][data-sid="bld-guanfu-01"]');
    check('★ 故事清单列出《衙前夜审》', !!rd
      && document.querySelector('#modal-root').textContent.indexOf('衙前夜审') >= 0);
    click(rd);
    await sleep(40);
    var fx = document.querySelector('#story-fx');
    check('★ 全屏阅读器打开（第 1 幕 · 选项≥2 · 正文非空）', !!fx
      && fx.textContent.indexOf('第 1 幕') >= 0
      && fx.querySelectorAll('[data-action="story-pick"]').length >= 2
      && fx.textContent.length > 200);
    var guard = 0;
    while (guard++ < 8) {
      var pk = fx.querySelector('[data-action="story-pick"]');
      if (!pk) break;
      click(pk);
      await sleep(25);
    }
    check('★ 走到结局（结算屏 + 回到城中）', !!fx.querySelector('[data-action="story-exit"]')
      && fx.textContent.indexOf('回到城中') >= 0);
    check('★ 阅读进度已入档',
      !!(G.SG.progress()['bld-guanfu-01'] && G.SG.progress()['bld-guanfu-01'].done.length));
    click(fx.querySelector('[data-action="story-exit"]'));
    await sleep(30);
    check('阅读器收起（不阻塞主界面）', fx.style.display === 'none');
    var mi = -1;
    city.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'minfang') mi = i; });
    if (mi >= 0) {
      G.ui.openBuildModal(mi);
      await sleep(30);
      check('空态：无故事的建筑不出「逸闻」块',
        !document.querySelector('#modal-root [data-action="story-list"]'));
      click(document.querySelector('#modal-root [data-action="close-modal"]'));
      await sleep(30);
    }
  })();

"""


def patch(path, edits, marker):
    src = io.open(path, encoding='utf-8', newline='').read()
    if marker in src:
        print('%-14s already patched -- skip' % path.rsplit(chr(92), 1)[-1])
        return True
    for i, (old, new) in enumerate(edits, 1):
        n = src.count(old)
        if n != 1:
            print('  ANCHOR %d in %s matched %d times (expected 1) -- aborted' % (i, path, n))
            return False
        src = src.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    chk = io.open(path, encoding='utf-8', newline='').read()
    ok = marker in chk
    print('%-14s written (%d chars) -- verify %s' % (path.rsplit(chr(92), 1)[-1], len(chk), 'PASS' if ok else 'FAIL'))
    return ok


ok1 = patch(UI, [(UI_OLD, UI_NEW)], u"ui.SG_BLOCK('wild', tile.terrain, ter.name) +\n        '<div style=\"text-align:center;margin-top:14px;")
ok1 = ok1 and (io.open(UI, encoding='utf-8', newline='').read().count(u"ui.SG_BLOCK('wild'") == 2)
print('ui.js wild entries = %d (expect 2: owned + unowned)' % io.open(UI, encoding='utf-8', newline='').read().count(u"ui.SG_BLOCK('wild'"))
ok2 = patch(E2E, [(E2E_ANCHOR, E2E_SECTION + E2E_ANCHOR)], u'81. 文字游戏 · 故事库（真实点击）')
print('ALL %s' % ('PASS' if (ok1 and ok2) else 'FAIL'))
raise SystemExit(0 if (ok1 and ok2) else 1)
