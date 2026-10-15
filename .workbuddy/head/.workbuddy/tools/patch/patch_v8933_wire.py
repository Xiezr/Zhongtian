# -*- coding: utf-8 -*-
"""v89.33 接线：志异线样张三卷（vol-51 练功 / vol-52 灵异 / vol-53 志怪 · 18 篇）
① index.html 追加 3 个 script 装载
② smoke-test.js 追加 require + 两条卷断言（卷 51~53 / 志异线标记+无书核查+走满一篇）
③ e2e-test.js VOL89 表追加 3 行
每条改动做「命中==1」断言 + 落盘回查。
"""
import io, os, sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(R + '\\' + p, encoding='utf-8', newline='').read()


def write(p, src):
    tmp = R + '\\' + p + '.tmp8933'
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
    '<script src="story/vol-50.js"></script>',
    '<script src="story/vol-50.js"></script>\n'
    '<script src="story/vol-51.js"></script>\n'
    '<script src="story/vol-52.js"></script>\n'
    '<script src="story/vol-53.js"></script>',
    'script ×3')], 'index.html 装载')

# ---------- ② smoke-test.js · require ----------
edit('smoke-test.js', [(
    "  require('./story/vol-50.js');",
    "  require('./story/vol-50.js');\n"
    "  /* v89.33：题材线④志异样张（卷 51~53 · 18 篇 · 练功 / 灵异 / 志怪）随卷加载 */\n"
    "  require('./story/vol-51.js');\n"
    "  require('./story/vol-52.js');\n"
    "  require('./story/vol-53.js');",
    'require ×3')], 'smoke requires')

# ---------- ② smoke-test.js · 断言 ----------
SMOKE_BLOCK = u"""  /* v89.33：题材线④志异样张（卷 51~53 · 18 篇 · 练功/灵异/志怪） */
  check('故事库：卷 51~53（18 篇就位 · 段数 5~7 · 3 结局 · 锚点齐备）', (function () {
    var NEW = ['bld-xiaochang-09', 'wild-hill-16', 'city-county-19', 'bld-cangku-09', 'city-county-20', 'bld-junying-10',
               'city-county-21', 'city-jun-21', 'city-county-22', 'bld-minfang-09', 'wild-hill-17', 'wild-desert-14',
               'wild-forest-15', 'wild-lake-15', 'bld-minfang-10', 'wild-hill-18', 'bld-fenghuotai-08', 'wild-zhaoze-12'];
    if (GAME.SG.list().length < 317) return false;
    var okA = GAME.SG.anchor('wild', 'forest').length >= 14
      && GAME.SG.anchor('wild', 'zhaoze').length >= 12
      && GAME.SG.anchor('city', 'county').length >= 22
      && GAME.SG.anchor('building', 'cangku').length >= 9
      && GAME.SG.anchor('building', 'fenghuotai').length >= 8;
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

  /* v89.33：志异线标记（异人/术人/志怪）· 本线不发书 · 《石言》走满（留白底线） */
  check('故事库：志异线标记（异人/术人/志怪）· 不发书 · 《石言》走满', (function () {
    var tagOf = function (sid) {
      var st = GAME.SG.one(sid);
      return st ? (st.tags || []).join('|') : '';
    };
    var okTag = tagOf('bld-cangku-09').indexOf('异人') >= 0
      && tagOf('city-county-21').indexOf('术人') >= 0
      && tagOf('wild-forest-15').indexOf('志怪') >= 0;
    /* 本线三卷 18 篇一律不发书（reward 白名单外扩后仍守线内红线） */
    var NEW = ['bld-xiaochang-09', 'wild-hill-16', 'city-county-19', 'bld-cangku-09', 'city-county-20', 'bld-junying-10',
               'city-county-21', 'city-jun-21', 'city-county-22', 'bld-minfang-09', 'wild-hill-17', 'wild-desert-14',
               'wild-forest-15', 'wild-lake-15', 'bld-minfang-10', 'wild-hill-18', 'bld-fenghuotai-08', 'wild-zhaoze-12'];
    var okNoBook = true;
    NEW.forEach(function (sid) {
      var st = GAME.SG.one(sid);
      if (!st) { okNoBook = false; return; }
      (st.endings || []).forEach(function (e) {
        var it = (e.reward || {}).item;
        if (it && String(it).indexOf('book_') === 0) okNoBook = false;
      });
    });
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
    var w = walkTo('wild-zhaoze-12', 'e1');
    var okWalk = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1';
    return okTag && okNoBook && okWalk;
  })());


})();
"""

edit('smoke-test.js', [(
    "    var okBook = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1'\n"
    "      && (s.items.book_wuqin || 0) === pre + 1;\n"
    "    return okTag && okBook;\n"
    "  })());\n"
    "\n"
    "\n"
    "})();\n",
    "    var okBook = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1'\n"
    "      && (s.items.book_wuqin || 0) === pre + 1;\n"
    "    return okTag && okBook;\n"
    "  })());\n"
    "\n"
    + SMOKE_BLOCK,
    'v89.33 断言 ×2')], 'smoke 断言')

# ---------- ③ e2e-test.js · VOL89 表 ----------
edit('e2e-test.js', [(
    "      ['v89.32', 'city-county-16'], ['v89.32', 'city-jun-18'], ['v89.32', 'wild-zhaoze-11']\n"
    "    ];",
    "      ['v89.32', 'city-county-16'], ['v89.32', 'city-jun-18'], ['v89.32', 'wild-zhaoze-11'],\n"
    "      ['v89.33', 'bld-cangku-09'], ['v89.33', 'city-county-21'], ['v89.33', 'wild-zhaoze-12']\n"
    "    ];",
    'VOL89 +3 行')], 'e2e VOL89')

print('ALL OK')
