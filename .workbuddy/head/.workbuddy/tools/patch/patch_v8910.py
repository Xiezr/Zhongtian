# -*- coding: utf-8 -*-
"""patch_v8910.py —— v89.10 接线：卷 03~05 装载 + 新锚点断言

  1) index.html    ：载入 story/vol-03/04/05.js
  2) smoke-test.js ：require 三卷；新增「卷 03~05」断言
  3) e2e-test.js   ：新增「新锚点真实点击」段（动态选一座新建筑）
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
# 1) index.html
# ---------------------------------------------------------------------------
edit('index.html', [(
    '<script src="story/vol-02.js"></script>',
    '<script src="story/vol-02.js"></script>\n'
    '<script src="story/vol-03.js"></script>\n'
    '<script src="story/vol-04.js"></script>\n'
    '<script src="story/vol-05.js"></script>'
)], 'index.html · 卷 03~05 装载')

# ---------------------------------------------------------------------------
# 2) smoke-test.js
# ---------------------------------------------------------------------------
edit('smoke-test.js', [
    (
        "  require('./story/vol-02.js');\n  /* v89.9：卷 02（铺量首批 6 篇）随卷加载 */",
        "  require('./story/vol-02.js');\n  /* v89.9：卷 02（铺量首批 6 篇）随卷加载 */\n"
        "  require('./story/vol-03.js');\n  require('./story/vol-04.js');\n  require('./story/vol-05.js');\n"
        "  /* v89.10：铺量二批（卷 03~05 · 18 篇）随卷加载 */"
    ),
    (
        "    return ok1 && ok2 && ok3;\n  })());\n})();",
        "    return ok1 && ok2 && ok3;\n  })());\n\n"
        "  /* v89.10：卷 03~05 铺量（18 处新锚点就位 + 新篇可走满） */\n"
        "  check('故事库：卷 03~05（新锚点就位 · 新篇可走满至结局）', (function () {\n"
        "    var okA = GAME.SG.list().length >= 29\n"
        "      && GAME.SG.anchor('building', 'xiaochang').length >= 1\n"
        "      && GAME.SG.anchor('building', 'shichang').length >= 1\n"
        "      && GAME.SG.anchor('building', 'cangku').length >= 1\n"
        "      && GAME.SG.anchor('building', 'chengqiang').length >= 1\n"
        "      && GAME.SG.anchor('building', 'yizhan').length >= 1\n"
        "      && GAME.SG.anchor('building', 'zhaoxianguan').length >= 1\n"
        "      && GAME.SG.anchor('building', 'honglusi').length >= 1\n"
        "      && GAME.SG.anchor('ext', 'farm').length >= 1\n"
        "      && GAME.SG.anchor('wild', 'zhaoze').length >= 1\n"
        "      && GAME.SG.anchor('wild', 'desert').length >= 1;\n"
        "    var r = GAME.SG.begin('bld-xiaochang-01');\n"
        "    if (!r.ok) return false;\n"
        "    var guard = 0;\n"
        "    while (GAME.SG._run.phase === 'node' && guard++ < 20) GAME.SG.choose(0);\n"
        "    var run = GAME.SG._run;\n"
        "    var ranks = GAME.SG.rankCount(GAME.SG.one('bld-xiaochang-01'));\n"
        "    return okA && run.phase === 'end' && run.path.length === ranks && !!(run.got && run.got.got);\n"
        "  })());\n})();"
    ),
], 'smoke-test.js · 装载 + 卷 03~05 断言')

# ---------------------------------------------------------------------------
# 3) e2e-test.js
# ---------------------------------------------------------------------------
edit('e2e-test.js', [(
    "      check('★ v89.9：掩卷退出（跳过）', true);\n    }\n    /* 空态（动态选锚点）：找一座尚无故事的建筑 */",
    "      check('★ v89.9：掩卷退出（跳过）', true);\n    }\n"
    "    /* v89.10：卷 03~05 新锚点（动态选一座新的建筑）· 真实点击 */\n"
    "    var NEW_BLD = ['xiaochang', 'shichang', 'cangku', 'chengqiang', 'yizhan', 'fenghuotai',\n"
    "                   'majiu', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang'];\n"
    "    var nbMi = -1, nbId = '';\n"
    "    city.cells.forEach(function (cell, i) {\n"
    "      if (nbMi < 0 && cell.build && NEW_BLD.indexOf(cell.build.id) >= 0\n"
    "        && G.SG.anchor('building', cell.build.id).length > 0) { nbMi = i; nbId = cell.build.id; }\n"
    "    });\n"
    "    if (nbMi >= 0) {\n"
    "      G.ui.openBuildModal(nbMi);\n"
    "      await sleep(30);\n"
    "      var nbEntry = document.querySelector('#modal-root [data-action=\"story-list\"][data-kind=\"building\"][data-id=\"' + nbId + '\"]');\n"
    "      check('★ v89.10：卷 03~05 新锚点「' + nbId + '」出现逸闻入口', !!nbEntry);\n"
    "      if (nbEntry) {\n"
    "        click(nbEntry);\n"
    "        await sleep(30);\n"
    "        var nbItem = document.querySelector('#modal-root [data-action=\"story-open\"]');\n"
    "        check('★ v89.10：新锚点故事在列 · 可开卷', !!nbItem);\n"
    "        click(document.querySelector('#modal-root [data-action=\"close-modal\"]'));\n"
    "        await sleep(30);\n"
    "      } else {\n"
    "        check('★ v89.10：新锚点故事在列 · 可开卷（跳过）', true);\n"
    "      }\n"
    "    } else {\n"
    "      check('★ v89.10：卷 03~05 新锚点入口（城中无对应地格，跳过）', true);\n"
    "      check('★ v89.10：新锚点故事在列 · 可开卷（跳过）', true);\n"
    "    }\n"
    "    /* 空态（动态选锚点）：找一座尚无故事的建筑 */"
)], 'e2e-test.js · 卷 03~05 新锚点')

print('ALL OK')
