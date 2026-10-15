# -*- coding: utf-8 -*-
"""v89.30 接线补丁：卷 39~44（36 篇）装载 + smoke 断言 + e2e VOL89 表

改动面：
  1. index.html  —— vol-38 之后追加 6 个 <script>
  2. smoke-test.js —— require 卷 39~44；§81 追加两条断言（就位/主题标记+秘籍）
  3. e2e-test.js —— VOL89 表追加 6 行（v89.30）
惯例：一次一处、命中数==1 断言、原子落盘、落盘回查。
"""
import io
import os
import sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(R + '\\' + p, encoding='utf-8', newline='').read()


def write(p, src):
    full = R + '\\' + p
    tmp = full + '.tmp8930'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, full)


def crlf_of(src):
    return '\r\n' if '\r\n' in src[:4000] else '\n'


def edit(p, pairs, tag):
    src = read(p)
    nl = crlf_of(src)
    for old, new, name in pairs:
        old = old.replace('\n', nl)
        new = new.replace('\n', nl)
        n = src.count(old)
        if n != 1:
            print('FAIL [%s -> %s] 命中 %d 次' % (tag, name, n))
            sys.exit(1)
        src = src.replace(old, new, 1)
    write(p, src)
    back = read(p)
    for old, new, name in pairs:
        new = new.replace('\n', nl)
        assert new in back, '%s / %s 落盘回查失败' % (tag, name)
    print('OK  ' + tag)


# ---------- 1. index.html ----------
edit('index.html', [
    ('''<script src="story/vol-38.js"></script>''',
     '''<script src="story/vol-38.js"></script>
<script src="story/vol-39.js"></script>
<script src="story/vol-40.js"></script>
<script src="story/vol-41.js"></script>
<script src="story/vol-42.js"></script>
<script src="story/vol-43.js"></script>
<script src="story/vol-44.js"></script>''', 'script×6'),
], 'index.html 装载卷 39~44')

# ---------- 2. smoke-test.js ----------
SMOKE_REQ_OLD = """  /* v89.28：题材线（卷 35~38 · 24 篇 · 江湖 / 修炼 / 四夷·北西 / 四夷·南东）随卷加载 */
  require('./story/vol-35.js');
  require('./story/vol-36.js');
  require('./story/vol-37.js');
  require('./story/vol-38.js');"""

SMOKE_REQ_NEW = SMOKE_REQ_OLD + """
  /* v89.30：铺量六批（卷 39~44 · 36 篇 · 江湖二辑 / 修炼二辑 / 四夷三辑 / 县城·野地·城外线）随卷加载 */
  require('./story/vol-39.js');
  require('./story/vol-40.js');
  require('./story/vol-41.js');
  require('./story/vol-42.js');
  require('./story/vol-43.js');
  require('./story/vol-44.js');"""

SMOKE_TAIL_OLD = """    return okTag && okBook;
  })());


})();
/* ============================================================
 * 82. v89.7 · 头像可更换 + 供奉公文静默（老板）"""

SMOKE_TAIL_NEW = """    return okTag && okBook;
  })());

  /* v89.30：铺量六批（卷 39~44 · 36 篇 · 江湖二辑/修炼二辑/四夷三辑/县城线/野地线/城外线） */
  check('故事库：卷 39~44（36 篇就位 · 段数 5~7 · 3 结局 · 锚点齐备）', (function () {
    var NEW = ['bld-kezhan-09', 'bld-zhaoxianguan-09', 'bld-yizhan-10', 'wild-hill-10', 'wild-lake-10', 'wild-forest-09',
               'bld-shuyuan-10', 'wild-hill-11', 'wild-lake-11', 'wild-zhaoze-09', 'wild-desert-09', 'wild-forest-10',
               'wild-caoyuan-08', 'wild-desert-10', 'city-jun-08', 'bld-honglusi-09', 'wild-hill-12', 'bld-majiu-09',
               'city-county-07', 'city-county-08', 'city-county-09', 'city-jun-09', 'city-jun-10', 'city-zhou-07',
               'wild-zhaoze-10', 'wild-desert-11', 'wild-hill-13', 'wild-lake-12', 'wild-caoyuan-09', 'wild-forest-11',
               'ext-farm-07', 'ext-forest-07', 'ext-quarry-07', 'ext-mine-07', 'city-capital-06', 'city-zhou-08'];
    if (GAME.SG.list().length < 263) return false;
    var okA = GAME.SG.anchor('building', 'kezhan').length >= 9
      && GAME.SG.anchor('wild', 'zhaoze').length >= 10
      && GAME.SG.anchor('city', 'county').length >= 9
      && GAME.SG.anchor('ext', 'mine').length >= 7;
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

  /* v89.30：题材标记（江湖/修炼/边务）与《残页》秘籍奖赏入袋（book_sunzi） */
  check('故事库：题材标记（江湖/修炼/边务）与《残页》秘籍奖赏入袋（book_sunzi）', (function () {
    var tagOf = function (sid) {
      var st = GAME.SG.one(sid);
      return st ? (st.tags || []).join('|') : '';
    };
    var okTag = tagOf('bld-kezhan-09').indexOf('江湖') >= 0
      && tagOf('wild-desert-09').indexOf('修炼') >= 0
      && tagOf('wild-caoyuan-08').indexOf('边务') >= 0;
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
    var pre = s.items.book_sunzi || 0;
    var w = walkTo('bld-shuyuan-10', 'e1');
    var okBook = !!w && w.phase === 'end' && !!w.ending && w.ending.id === 'e1'
      && (s.items.book_sunzi || 0) === pre + 1;
    return okTag && okBook;
  })());


})();
/* ============================================================
 * 82. v89.7 · 头像可更换 + 供奉公文静默（老板）"""

edit('smoke-test.js', [
    (SMOKE_REQ_OLD, SMOKE_REQ_NEW, 'require 卷 39~44'),
    (SMOKE_TAIL_OLD, SMOKE_TAIL_NEW, '§81 断言×2'),
], 'smoke-test.js')

# ---------- 3. e2e-test.js ----------
E2E_OLD = """      ['v89.28', 'bld-shuyuan-09'], ['v89.28', 'wild-zhaoze-08']
    ];"""
E2E_NEW = """      ['v89.28', 'bld-shuyuan-09'], ['v89.28', 'wild-zhaoze-08'],
      ['v89.30', 'bld-kezhan-09'], ['v89.30', 'wild-desert-09'], ['v89.30', 'wild-hill-12'],
      ['v89.30', 'city-county-07'], ['v89.30', 'wild-lake-12'], ['v89.30', 'ext-mine-07']
    ];"""

edit('e2e-test.js', [
    (E2E_OLD, E2E_NEW, 'VOL89 表 +6 行'),
], 'e2e-test.js')

print('ALL OK')
