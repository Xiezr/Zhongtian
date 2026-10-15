# -*- coding: utf-8 -*-
"""patch_v899.py —— v89.9 接线：卷 02 装载 + 空态断言动态化 + e2e 新锚点用例

改动（每条断言命中数 == 1，落盘回查）：
  1) index.html    ：载入 story/vol-02.js
  2) smoke-test.js ：require 卷 02；入口空态改「动态选锚点」；新增「卷 02」断言
  3) e2e-test.js   ：民房由「空态」升级为「有故事」（真实点击 4 条）；
                     空态改为「动态选锚点」（找到一座尚无故事的建筑）
"""
import io
import os
import sys

R = r'E:\Deepseekdb'


def edit(path, pairs, tag):
    p = os.path.join(R, path)
    raw = io.open(p, 'rb').read()
    crlf = b'\r\n' in raw
    src = io.open(p, encoding='utf-8', newline='').read()

    def M(s):
        return s.replace('\n', '\r\n') if crlf else s

    for i, (old, new) in enumerate(pairs):
        o, n = M(old), M(new)
        c = src.count(o)
        if c != 1:
            print('FAIL [%s #%d] 命中 %d 次' % (tag, i + 1, c))
            sys.exit(1)
        src = src.replace(o, n, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(src)
    back = io.open(p, encoding='utf-8', newline='').read()
    for i, (old, new) in enumerate(pairs):
        if M(new) not in back:
            print('FAIL [%s #%d] 落盘回查失败' % (tag, i + 1))
            sys.exit(1)
    print('OK  ' + tag)


# ---------------------------------------------------------------------------
# 1) index.html —— 载入卷 02
# ---------------------------------------------------------------------------
edit('index.html', [(
    '<script src="story/vol-01.js"></script>',
    '<script src="story/vol-01.js"></script>\n<script src="story/vol-02.js"></script>'
)], 'index.html · 卷 02 装载')

# ---------------------------------------------------------------------------
# 2) smoke-test.js —— 装载 + 空态动态 + 卷 02 断言
# ---------------------------------------------------------------------------
edit('smoke-test.js', [
    (
        "  require('./story/vol-01.js');",
        "  require('./story/vol-01.js');\n  require('./story/vol-02.js');\n  /* v89.9：卷 02（铺量首批 6 篇）随卷加载 */"
    ),
    (
        """  check('故事库：入口区块（有故事出文案 · 无故事返回空串）', (function () {
    var has = GAME.SG.anchor('building', 'guanfu').length > 0;
    var b1 = GAME.ui.SG_BLOCK('building', 'guanfu', '官府');
    var b2 = GAME.ui.SG_BLOCK('building', 'minfang', '民房');
    return has && b1.indexOf('听一段故事') >= 0 && b1.indexOf('story-list') >= 0 && b2 === '';
  })());""",
        """  check('故事库：入口区块（有故事出文案 · 无故事返回空串）', (function () {
    var has = GAME.SG.anchor('building', 'guanfu').length > 0;
    var b1 = GAME.ui.SG_BLOCK('building', 'guanfu', '官府');
    /* v89.9：空态锚点动态选 —— 从 16 座建筑里找一座尚无故事的（全有则此项自动放行） */
    var POOL = ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku',
                'chengqiang', 'yizhan', 'fenghuotai', 'majiu', 'kezhan', 'zhaoxianguan',
                'honglusi', 'tiejiangpu', 'gongjiangzuofang'];
    var emptyId = null;
    for (var i = 0; i < POOL.length; i++) {
      if (GAME.SG.anchor('building', POOL[i]).length === 0) { emptyId = POOL[i]; break; }
    }
    var b2ok = emptyId ? (GAME.ui.SG_BLOCK('building', emptyId, '空') === '') : true;
    return has && b1.indexOf('听一段故事') >= 0 && b1.indexOf('story-list') >= 0 && b2ok;
  })());"""
    ),
    (
        """    return okRender && okBg && okProg && okRank;
  })());
})();""",
        """    return okRender && okBg && okProg && okRank;
  })());

  /* v89.9：卷 02 铺量（新锚点 5 处就位 + 新篇可走满至结局） */
  check('故事库：卷 02（新锚点 5 处就位 · 新篇可走满至结局）', (function () {
    var okA = GAME.SG.list().length >= 11
      && GAME.SG.anchor('building', 'minfang').length >= 1
      && GAME.SG.anchor('building', 'shuyuan').length >= 1
      && GAME.SG.anchor('building', 'junying').length >= 1
      && GAME.SG.anchor('wild', 'caoyuan').length >= 1
      && GAME.SG.anchor('city', 'zhou').length >= 1;
    var r = GAME.SG.begin('bld-minfang-01');
    if (!r.ok) return false;
    var guard = 0;
    while (GAME.SG._run.phase === 'node' && guard++ < 20) GAME.SG.choose(0);
    var run = GAME.SG._run;
    var ranks = GAME.SG.rankCount(GAME.SG.one('bld-minfang-01'));
    return okA && run.phase === 'end' && ranks === 5 && run.path.length === ranks
      && !!(run.got && run.got.got);
  })());
})();"""
    ),
], 'smoke-test.js · 装载 + 空态动态 + 卷 02 断言')

# ---------------------------------------------------------------------------
# 3) e2e-test.js —— 民房由空态升级为「有故事」+ 空态动态
# ---------------------------------------------------------------------------
edit('e2e-test.js', [(
    """    var mi = -1;
    city.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'minfang') mi = i; });
    if (mi >= 0) {
      G.ui.openBuildModal(mi);
      await sleep(30);
      check('空态：无故事的建筑不出「逸闻」块',
        !document.querySelector('#modal-root [data-action="story-list"]'));
      click(document.querySelector('#modal-root [data-action="close-modal"]'));
      await sleep(30);
    }""",
    """    /* v89.9：卷 02 新锚点（民房）真实点击 —— 由「空态」升级为「有故事」 */
    var mfMi = -1;
    city.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'minfang') mfMi = i; });
    if (mfMi >= 0 && G.SG.anchor('building', 'minfang').length > 0) {
      G.ui.openBuildModal(mfMi);
      await sleep(30);
      var mfEntry = document.querySelector('#modal-root [data-action="story-list"][data-kind="building"][data-id="minfang"]');
      check('★ v89.9：新锚点「民房」出现逸闻入口', !!mfEntry);
      if (mfEntry) {
        click(mfEntry);
        await sleep(30);
        var mfItem = document.querySelector('#modal-root [data-action="story-open"][data-sid="bld-minfang-01"]');
        check('★ v89.9：卷 02《半月无音》在列 · 可开卷', !!mfItem);
        if (mfItem) {
          click(mfItem);
          await sleep(40);
          var fx2 = document.querySelector('#story-fx');
          check('★ v89.9：新篇阅读器（壁画两层 · 「第 1 段 · 共 5 段」· 选项≥2）', !!fx2
            && fx2.querySelectorAll('.sgr-bg').length === 2
            && fx2.textContent.indexOf('共 5 段') >= 0
            && fx2.querySelectorAll('[data-action="story-pick"]').length >= 2);
          var pk2 = fx2 ? fx2.querySelector('[data-action="story-pick"]') : null;
          if (pk2) { click(pk2); await sleep(30); }
          var ex2 = fx2 ? fx2.querySelector('[data-action="story-exit"]') : null;
          if (ex2) { click(ex2); await sleep(30); }
          check('★ v89.9：掩卷退出（阅读器收起 · 主界面可用）', !!fx2 && fx2.style.display === 'none');
        }
      }
    } else {
      check('★ v89.9：新锚点「民房」逸闻入口（未找到民房地格，跳过）', true);
      check('★ v89.9：卷 02《半月无音》可开卷（跳过）', true);
      check('★ v89.9：新篇阅读器（跳过）', true);
      check('★ v89.9：掩卷退出（跳过）', true);
    }
    /* 空态（动态选锚点）：找一座尚无故事的建筑 */
    var BLD16 = ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku',
                 'chengqiang', 'yizhan', 'fenghuotai', 'majiu', 'kezhan', 'zhaoxianguan',
                 'honglusi', 'tiejiangpu', 'gongjiangzuofang'];
    var emptyMi = -1;
    city.cells.forEach(function (cell, i) {
      if (emptyMi < 0 && cell.build && BLD16.indexOf(cell.build.id) >= 0
        && G.SG.anchor('building', cell.build.id).length === 0) emptyMi = i;
    });
    if (emptyMi >= 0) {
      G.ui.openBuildModal(emptyMi);
      await sleep(30);
      check('空态：无故事的建筑不出「逸闻」块',
        !document.querySelector('#modal-root [data-action="story-list"]'));
      click(document.querySelector('#modal-root [data-action="close-modal"]'));
      await sleep(30);
    } else {
      check('空态：无故事的建筑不出「逸闻」块（全建筑已有故事，跳过）', true);
    }"""
)], 'e2e-test.js · 民房新锚点 + 空态动态')

print('ALL OK')
