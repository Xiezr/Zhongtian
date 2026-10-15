# -*- coding: utf-8 -*-
"""v89.38 故事库接线：卷 72~77（35 篇 · 地理锚点收官批）
① index.html +6 script
② smoke-test.js +6 require + 两条卷断言（地理锚点全部满额收官 + 抽篇走满）
③ e2e-test.js VOL89 表 +6 行
幂等：已应用则 SKIP。
"""
import io, os, sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, src):
    tmp = p + '.tmp8938'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if new in src and old not in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


# ---------- ① index.html：+6 script ----------
edit(R + r'\index.html',
     '<script src="story/vol-70.js"></script>\n<script src="story/vol-71.js"></script>',
     '<script src="story/vol-70.js"></script>\n<script src="story/vol-71.js"></script>\n'
     '<script src="story/vol-72.js"></script>\n<script src="story/vol-73.js"></script>\n'
     '<script src="story/vol-74.js"></script>\n<script src="story/vol-75.js"></script>\n'
     '<script src="story/vol-76.js"></script>\n<script src="story/vol-77.js"></script>',
     'index.html +vol-72~77')

# ---------- ② smoke：+6 require ----------
edit(R + r'\smoke-test.js',
     "  require('./story/vol-71.js');\n",
     "  require('./story/vol-71.js');\n"
     "  require('./story/vol-72.js');\n  require('./story/vol-73.js');\n  require('./story/vol-74.js');\n"
     "  require('./story/vol-75.js');\n  require('./story/vol-76.js');\n  require('./story/vol-77.js');\n",
     'smoke +require ×6')

# ---------- ② smoke：v89.38 两条断言 ----------
V8938 = u"""  /* v89.38：地理锚点收官批（卷 72~77 · 35 篇 · 全部地理锚点满额） */
  check('故事库：卷 72~77（35 篇就位 · 地理锚点全部满额收官）', (function () {
    /* 收官断言（下限 ≥）：ext 4×10 · 城池 20/30/40/50 —— v89.38 起为终态 */
    var okA = GAME.SG.anchor('ext', 'farm').length >= 10
      && GAME.SG.anchor('ext', 'forest').length >= 10
      && GAME.SG.anchor('ext', 'quarry').length >= 10
      && GAME.SG.anchor('ext', 'mine').length >= 10
      && GAME.SG.anchor('city', 'capital').length >= 20
      && GAME.SG.anchor('city', 'zhou').length >= 30
      && GAME.SG.anchor('city', 'jun').length >= 40
      && GAME.SG.anchor('city', 'county').length >= 50;
    var NEW = ['city-county-43','city-jun-33','city-zhou-23','city-capital-16','ext-forest-08','ext-quarry-08',
               'city-jun-34','city-zhou-24','city-county-44','city-county-45','ext-farm-09','ext-mine-09',
               'city-jun-35','city-zhou-25','city-county-46','city-county-47','ext-farm-10','ext-forest-09',
               'city-jun-36','city-zhou-26','city-county-48','city-county-49','ext-quarry-09','ext-mine-10',
               'city-jun-37','city-jun-38','city-jun-39','city-jun-40','city-zhou-27','city-zhou-28',
               'city-county-50','city-zhou-29','city-zhou-30','ext-forest-10','ext-quarry-10'];
    var okAll = true;
    NEW.forEach(function (sid) {
      var st = GAME.SG.one(sid);
      if (!st) { okAll = false; return; }
      var rk = GAME.SG.rankCount(st);
      if (rk < 5 || rk > 7) okAll = false;
      if ((st.endings || []).length !== 3) okAll = false;
    });
    return okA && okAll;
  })());

  /* v89.38：卷 72~77 抽篇走满（《赊刀》《县志》· e1） */
  check('故事库：卷 72~77 抽篇走满至结局（《赊刀》《县志》）', (function () {
    var pathTo = function (st, endId) {
      var idx = {}, first = (st.nodes || [])[0];
      (st.nodes || []).forEach(function (n) { idx[n.id] = n; });
      if (!first) return null;
      var seen = {}, q = [[first.id, []]];
      seen[first.id] = 1;
      while (q.length) {
        var cur = q.shift(), node = idx[cur[0]], path = cur[1];
        if (!node) continue;
        var ops = node.o || [];
        for (var i = 0; i < ops.length; i++) {
          if (ops[i].to === endId) return path.concat(i);
          if (idx[ops[i].to] && !seen[ops[i].to]) {
            seen[ops[i].to] = 1;
            q.push([ops[i].to, path.concat(i)]);
          }
        }
      }
      return null;
    };
    var walkTo = function (sid, endId) {
      var st = GAME.SG.one(sid);
      var path = st ? pathTo(st, endId) : null;
      if (!path) return null;
      var r = GAME.SG.begin(sid);
      if (!r.ok) return null;
      for (var i = 0; i < path.length; i++) GAME.SG.choose(path[i]);
      return GAME.SG._run;
    };
    var w1 = walkTo('city-county-43', 'e1');
    var w2 = walkTo('city-county-50', 'e1');
    return !!w1 && w1.phase === 'end' && w1.ending.id === 'e1'
      && !!w2 && w2.phase === 'end' && w2.ending.id === 'e1';
  })());

})();
"""

SMOKE_ANCHOR = u"""    var w3 = walkTo('wild-zhaoze-20', 'e1');
    return !!w1 && w1.phase === 'end' && w1.ending.id === 'e1'
      && !!w2 && w2.phase === 'end' && w2.ending.id === 'e1'
      && !!w3 && w3.phase === 'end' && w3.ending.id === 'e1';
  })());

})();
"""
SMOKE_NEW = u"""    var w3 = walkTo('wild-zhaoze-20', 'e1');
    return !!w1 && w1.phase === 'end' && w1.ending.id === 'e1'
      && !!w2 && w2.phase === 'end' && w2.ending.id === 'e1'
      && !!w3 && w3.phase === 'end' && w3.ending.id === 'e1';
  })());

""" + V8938
edit(R + r'\smoke-test.js', SMOKE_ANCHOR, SMOKE_NEW, 'smoke v89.38 两断言')

# ---------- ③ e2e：VOL89 表 +6 行 ----------
edit(R + r'\e2e-test.js',
     u"      ['v89.37', 'city-zhou-18'], ['v89.37', 'city-capital-17'], ['v89.37', 'city-zhou-22']\n    ];",
     u"      ['v89.37', 'city-zhou-18'], ['v89.37', 'city-capital-17'], ['v89.37', 'city-zhou-22'],\n"
     u"      ['v89.38', 'city-county-43'], ['v89.38', 'city-jun-34'], ['v89.38', 'ext-farm-10'],\n"
     u"      ['v89.38', 'city-county-49'], ['v89.38', 'city-zhou-27'], ['v89.38', 'city-county-50']\n    ];",
     'e2e VOL89 +6 行')

print('ALL OK')
