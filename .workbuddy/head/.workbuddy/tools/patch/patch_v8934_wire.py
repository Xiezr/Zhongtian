# -*- coding: utf-8 -*-
"""v89.34 接线补丁：铺量批（卷 54~59 · 36 篇 · 四线齐发）接入 index.html / smoke / e2e。
一条一处、预检命中、落盘回查。"""
import io, os, sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(os.path.join(R, p), encoding='utf-8', newline='').read()


def write(p, src):
    tmp = os.path.join(R, p + '.tmp8934')
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, os.path.join(R, p))


def crlf_of(p):
    d = io.open(os.path.join(R, p), 'rb').read()
    return b'\r\n' in d[:8000]


def edit(p, old, new, tag):
    src = read(p)
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, tag
    print('OK  ' + tag)


# ---------------- 1) index.html：追加 6 个 script ----------------
for n in (54, 55, 56, 57, 58, 59):
    edit('index.html',
         u'<script src="story/vol-53.js"></script>',
         u'<script src="story/vol-53.js"></script>\n<script src="story/vol-54.js"></script>\n<script src="story/vol-55.js"></script>\n<script src="story/vol-56.js"></script>\n<script src="story/vol-57.js"></script>\n<script src="story/vol-58.js"></script>\n<script src="story/vol-59.js"></script>',
         'index.html 装载 54~59')
    break  # 一次追加全部

# ---------------- 2) smoke：require 区追加 ----------------
edit('smoke-test.js',
     u"  require('./story/vol-53.js');",
     u"  require('./story/vol-53.js');\n"
     u"  /* v89.34：铺量批（卷 54~59 · 36 篇 · 江湖四/修炼四/四夷五/志异异物/郡城/县城）随卷加载 */\n"
     u"  require('./story/vol-54.js');\n"
     u"  require('./story/vol-55.js');\n"
     u"  require('./story/vol-56.js');\n"
     u"  require('./story/vol-57.js');\n"
     u"  require('./story/vol-58.js');\n"
     u"  require('./story/vol-59.js');",
     'smoke require 54~59')

# ---------------- 3) smoke：v89.34 卷断言（插在 v89.33 块尾之后、§81 收口之前） ----------------
NEW_IDS = (u"['bld-kezhan-10','bld-xiaochang-10','bld-cangku-10','wild-hill-19','wild-lake-16','wild-forest-14',\n"
           u"               'wild-hill-20','wild-zhaoze-13','wild-lake-17','wild-desert-15','wild-caoyuan-13','bld-tiejiangpu-08',\n"
           u"               'wild-caoyuan-14','wild-desert-16','bld-majiu-10','bld-fenghuotai-09','city-county-23','city-zhou-11',\n"
           u"               'wild-zhaoze-14','wild-forest-16','wild-lake-18','bld-chengqiang-09','bld-gongjiangzuofang-08','city-county-24',\n"
           u"               'city-jun-12','city-jun-20','city-jun-22','city-jun-23','city-jun-24','city-jun-25',\n"
           u"               'city-county-25','city-county-26','city-county-27','city-county-28','city-county-29','city-county-30']")

OLD_TAIL = (u"    var w = walkTo('wild-zhaoze-12', 'e1');\n"
            u"    var okWalk = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1';\n"
            u"    return okTag && okNoBook && okWalk;\n"
            u"  })());\n"
            u"\n"
            u"\n"
            u"})();")

NEW_TAIL = (u"    var w = walkTo('wild-zhaoze-12', 'e1');\n"
            u"    var okWalk = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1';\n"
            u"    return okTag && okNoBook && okWalk;\n"
            u"  })());\n"
            u"\n"
            u"  /* v89.34：四线齐发批（卷 54~59 · 36 篇 · 江湖四/修炼四/四夷五/志异异物/郡城/县城） */\n"
            u"  check('故事库：卷 54~59（36 篇就位 · 锚点计数 · 收官席）', (function () {\n"
            u"    var okA = GAME.SG.anchor('building', 'kezhan').length === 10\n"
            u"      && GAME.SG.anchor('building', 'xiaochang').length === 10\n"
            u"      && GAME.SG.anchor('building', 'cangku').length === 10\n"
            u"      && GAME.SG.anchor('building', 'majiu').length === 10\n"
            u"      && GAME.SG.anchor('wild', 'hill').length === 20\n"
            u"      && GAME.SG.anchor('wild', 'lake').length === 18\n"
            u"      && GAME.SG.anchor('city', 'jun').length === 25\n"
            u"      && GAME.SG.anchor('city', 'county').length === 30;\n"
            u"    var NEW = " + NEW_IDS + u";\n"
            u"    var okAll = true;\n"
            u"    NEW.forEach(function (sid) {\n"
            u"      var st = GAME.SG.one(sid);\n"
            u"      if (!st) { okAll = false; return; }\n"
            u"      var rk = GAME.SG.rankCount(st);\n"
            u"      if (rk < 5 || rk > 7) okAll = false;\n"
            u"      if ((st.endings || []).length !== 3) okAll = false;\n"
            u"    });\n"
            u"    return okA && okAll;\n"
            u"  })());\n"
            u"\n"
            u"  /* v89.34：志异异物卷走满（《木客》留白底线）· 本批 36 篇线内一律不发书 */\n"
            u"  check('故事库：志异异物卷（《木客》走满 · 四线齐发批不发书）', (function () {\n"
            u"    var pathTo = function (st, endId) {\n"
            u"      var idx = {}, first = (st.nodes || [])[0];\n"
            u"      (st.nodes || []).forEach(function (n) { idx[n.id] = n; });\n"
            u"      if (!first) return null;\n"
            u"      var seen = {}, q = [[first.id, []]];\n"
            u"      seen[first.id] = 1;\n"
            u"      while (q.length) {\n"
            u"        var cur = q.shift(), node = idx[cur[0]], path = cur[1];\n"
            u"        if (!node) continue;\n"
            u"        var ops = node.o || [];\n"
            u"        for (var i = 0; i < ops.length; i++) {\n"
            u"          if (ops[i].to === endId) return path.concat(i);\n"
            u"          if (idx[ops[i].to] && !seen[ops[i].to]) {\n"
            u"            seen[ops[i].to] = 1;\n"
            u"            q.push([ops[i].to, path.concat(i)]);\n"
            u"          }\n"
            u"        }\n"
            u"      }\n"
            u"      return null;\n"
            u"    };\n"
            u"    var walkTo = function (sid, endId) {\n"
            u"      var st = GAME.SG.one(sid);\n"
            u"      var path = st ? pathTo(st, endId) : null;\n"
            u"      if (!path) return null;\n"
            u"      var r = GAME.SG.begin(sid);\n"
            u"      if (!r.ok) return null;\n"
            u"      for (var i = 0; i < path.length; i++) GAME.SG.choose(path[i]);\n"
            u"      return GAME.SG._run;\n"
            u"    };\n"
            u"    var NEW = " + NEW_IDS + u";\n"
            u"    var okNoBook = true;\n"
            u"    NEW.forEach(function (sid) {\n"
            u"      var st = GAME.SG.one(sid);\n"
            u"      if (!st) { okNoBook = false; return; }\n"
            u"      (st.endings || []).forEach(function (e) {\n"
            u"        var it = (e.reward || {}).item;\n"
            u"        if (it && String(it).indexOf('book_') === 0) okNoBook = false;\n"
            u"      });\n"
            u"    });\n"
            u"    var w = walkTo('wild-forest-16', 'e1');\n"
            u"    var okWalk = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1';\n"
            u"    return okNoBook && okWalk;\n"
            u"  })());\n"
            u"\n"
            u"\n"
            u"})();")

edit('smoke-test.js', OLD_TAIL, NEW_TAIL, 'smoke v89.34 卷断言')

# ---------------- 4) e2e：VOL89 表加 6 行 ----------------
edit('e2e-test.js',
     u"      ['v89.33', 'bld-cangku-09'], ['v89.33', 'city-county-21'], ['v89.33', 'wild-zhaoze-12']\n    ];",
     u"      ['v89.33', 'bld-cangku-09'], ['v89.33', 'city-county-21'], ['v89.33', 'wild-zhaoze-12'],\n"
     u"      ['v89.34', 'bld-kezhan-10'], ['v89.34', 'wild-forest-16'], ['v89.34', 'city-jun-23'],\n"
     u"      ['v89.34', 'city-county-29'], ['v89.34', 'wild-desert-15'], ['v89.34', 'bld-majiu-10']\n    ];",
     'e2e VOL89 表 +6')

print('ALL OK')
