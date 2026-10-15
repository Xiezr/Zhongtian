# -*- coding: utf-8 -*-
"""v89.32 接线：铺量七批（卷 45~50 · 36 篇）
① index.html 追加 6 个 script 装载
② smoke-test.js 追加 require + 两条卷断言（卷 45~50 / 题材标记+book_wuqin）
③ e2e-test.js VOL89 表追加 6 行
每条改动做「命中==1」断言 + 落盘回查。
"""
import io, os, sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(R + '\\' + p, encoding='utf-8', newline='').read()


def write(p, src):
    tmp = R + '\\' + p + '.tmp8932'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, R + '\\' + p)


def edit(p, pairs, tag):
    src = read(p)
    for old, new, name in pairs:
        n = src.count(old)
        if n != 1:
            print('FAIL [%s -> %s] 命中 %d 次' % (tag, name, n))
            sys.exit(1)
        src = src.replace(old, new, 1)
    write(p, src)
    back = read(p)
    for _, new, name in pairs:
        assert new in back, '%s / %s' % (tag, name)
    print('OK  ' + tag)


# ---------- ① index.html ----------
edit('index.html', [(
    '<script src="story/vol-44.js"></script>',
    '<script src="story/vol-44.js"></script>\n'
    '<script src="story/vol-45.js"></script>\n'
    '<script src="story/vol-46.js"></script>\n'
    '<script src="story/vol-47.js"></script>\n'
    '<script src="story/vol-48.js"></script>\n'
    '<script src="story/vol-49.js"></script>\n'
    '<script src="story/vol-50.js"></script>',
    'script ×6')], 'index.html 装载')

# ---------- ② smoke-test.js · require ----------
edit('smoke-test.js', [(
    "  require('./story/vol-44.js');",
    "  require('./story/vol-44.js');\n"
    "  /* v89.32：铺量七批（卷 45~50 · 36 篇 · 江湖三辑 / 修炼三辑 / 四夷四辑 / 县城·郡城·上都线）随卷加载 */\n"
    "  require('./story/vol-45.js');\n"
    "  require('./story/vol-46.js');\n"
    "  require('./story/vol-47.js');\n"
    "  require('./story/vol-48.js');\n"
    "  require('./story/vol-49.js');\n"
    "  require('./story/vol-50.js');",
    'require ×6')], 'smoke requires')

# ---------- ② smoke-test.js · 断言 ----------
SMOKE_BLOCK = u"""  /* v89.32：铺量七批（卷 45~50 · 36 篇 · 江湖三辑/修炼三辑/四夷四辑/县城·郡城·上都线） */
  check('故事库：卷 45~50（36 篇就位 · 段数 5~7 · 3 结局 · 锚点齐备）', (function () {
    var NEW = ['city-county-10', 'wild-hill-14', 'wild-forest-12', 'wild-lake-13', 'city-jun-11', 'wild-desert-12',
               'wild-forest-13', 'wild-hill-15', 'wild-lake-14', 'wild-desert-13', 'wild-caoyuan-10', 'bld-zhaoxianguan-10',
               'wild-caoyuan-11', 'wild-caoyuan-12', 'city-county-11', 'city-jun-13', 'city-zhou-09', 'bld-honglusi-10',
               'city-county-12', 'city-county-13', 'city-county-14', 'city-county-15', 'city-county-16', 'city-county-17',
               'city-jun-14', 'city-jun-15', 'city-jun-16', 'city-jun-17', 'city-jun-18', 'city-jun-19',
               'city-capital-07', 'city-capital-08', 'city-capital-09', 'city-zhou-10', 'wild-zhaoze-11', 'city-county-18'];
    if (GAME.SG.list().length < 299) return false;
    var okA = GAME.SG.anchor('wild', 'caoyuan').length >= 12
      && GAME.SG.anchor('wild', 'zhaoze').length >= 11
      && GAME.SG.anchor('city', 'capital').length >= 9
      && GAME.SG.anchor('city', 'jun').length >= 18
      && GAME.SG.anchor('city', 'county').length >= 18
      && GAME.SG.anchor('building', 'zhaoxianguan').length >= 10;
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

  /* v89.32：题材标记（江湖/修炼/边务）与《旧简》秘籍奖赏入袋（book_wuqin） */
  check('故事库：题材标记（江湖/修炼/边务）与《旧简》秘籍奖赏入袋（book_wuqin）', (function () {
    var tagOf = function (sid) {
      var st = GAME.SG.one(sid);
      return st ? (st.tags || []).join('|') : '';
    };
    var okTag = tagOf('wild-hill-14').indexOf('江湖') >= 0
      && tagOf('wild-desert-13').indexOf('修炼') >= 0
      && tagOf('wild-caoyuan-11').indexOf('边务') >= 0;
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
    var s = GAME.state;
    var pre = s.items.book_wuqin || 0;
    var w = walkTo('bld-zhaoxianguan-10', 'e1');
    var okBook = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1'
      && (s.items.book_wuqin || 0) === pre + 1;
    return okTag && okBook;
  })());


})();
"""

edit('smoke-test.js', [(
    "      && S.indexOf('GAME.SG.rollAct = function') >= 0;\n"
    "  })());\n"
    "\n"
    "\n"
    "})();\n",
    "      && S.indexOf('GAME.SG.rollAct = function') >= 0;\n"
    "  })());\n"
    "\n"
    + SMOKE_BLOCK,
    'v89.32 断言 ×2')], 'smoke 断言')

# ---------- ③ e2e-test.js · VOL89 表 ----------
edit('e2e-test.js', [(
    "      ['v89.30', 'city-county-07'], ['v89.30', 'wild-lake-12'], ['v89.30', 'ext-mine-07']\n"
    "    ];",
    "      ['v89.30', 'city-county-07'], ['v89.30', 'wild-lake-12'], ['v89.30', 'ext-mine-07'],\n"
    "      ['v89.32', 'wild-hill-14'], ['v89.32', 'bld-zhaoxianguan-10'], ['v89.32', 'city-county-11'],\n"
    "      ['v89.32', 'city-county-16'], ['v89.32', 'city-jun-18'], ['v89.32', 'wild-zhaoze-11']\n"
    "    ];",
    'VOL89 +6 行')], 'e2e VOL89')

print('ALL OK')
