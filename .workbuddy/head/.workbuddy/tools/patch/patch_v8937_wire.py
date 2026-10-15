# -*- coding: utf-8 -*-
"""v89.37 接线：故事库卷 66~71（36 篇）入位后的四处接线

  · index.html  追加 6 个 <script src="story/vol-6N.js">
  · smoke-test.js  追加 6 个 require + 两组卷断言（就位/段数/结局/不发书 + 走满抽验）
  · e2e-test.js    VOL89 表追加 6 行（v89.37 · 每卷代表篇）
"""
import io, os, sys

R = r'E:\Deepseekdb'
H = R + r'\index.html'
SM = R + r'\smoke-test.js'
E2 = R + r'\e2e-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8937'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    k = src.count(old)
    if k == 1:
        write(p, src.replace(old, new, 1))
        assert new in read(p), '落盘回查失败：' + tag
        print('OK  ' + tag)
        return
    if k == 0 and new in src:
        print('SKIP（已应用） ' + tag)
        return
    print('FAIL [%s] 命中 %d 次' % (tag, k)); sys.exit(1)


# ---------- 0) 入位（容错：已入位则跳过） ----------
for n in (66, 67, 68, 69, 70, 71):
    a = R + r'\story\vol-%d.part.js' % n
    b = R + r'\story\vol-%d.js' % n
    if os.path.exists(a):
        os.replace(a, b)
        print('OK  入位 vol-%d.js' % n)

# ---------- 1) index.html ----------
edit(H,
     u'<script src="story/vol-65.js"></script>',
     u'''<script src="story/vol-65.js"></script>
<script src="story/vol-66.js"></script>
<script src="story/vol-67.js"></script>
<script src="story/vol-68.js"></script>
<script src="story/vol-69.js"></script>
<script src="story/vol-70.js"></script>
<script src="story/vol-71.js"></script>''',
     'index.html 载入卷 66~71')

# ---------- 2) smoke require ----------
edit(SM,
     u"  require('./story/vol-65.js');",
     u'''  require('./story/vol-65.js');
  require('./story/vol-66.js');
  require('./story/vol-67.js');
  require('./story/vol-68.js');
  require('./story/vol-69.js');
  require('./story/vol-70.js');
  require('./story/vol-71.js');''',
     'smoke require 卷 66~71')

# ---------- 3) smoke 卷断言（插在 §81 收口 })(); 之前） ----------
NEW_BLOCK = u'''  /* v89.37：铺量八批（卷 66~71 · 36 篇 · 江湖六/修炼六/四夷七/志异六/都城二/郡县二） */
  check('故事库：卷 66~71（36 篇就位 · 野地六地形全满 20 · 城池计数）', (function () {
    var okA = GAME.SG.anchor('wild', 'caoyuan').length >= 20
      && GAME.SG.anchor('wild', 'zhaoze').length >= 20
      && GAME.SG.anchor('wild', 'forest').length >= 20
      && GAME.SG.anchor('wild', 'desert').length >= 20
      && GAME.SG.anchor('wild', 'lake').length >= 20
      && GAME.SG.anchor('wild', 'hill').length >= 20
      && GAME.SG.anchor('city', 'capital').length >= 19
      && GAME.SG.anchor('city', 'zhou').length >= 22
      && GAME.SG.anchor('city', 'jun').length >= 32
      && GAME.SG.anchor('city', 'county').length >= 42
      && GAME.SG.anchor('ext', 'farm').length >= 8
      && GAME.SG.anchor('ext', 'mine').length >= 8;
    var NEW = ['city-county-36','city-county-37','city-zhou-14','city-zhou-15','wild-zhaoze-17','wild-forest-20',
               'wild-caoyuan-18','wild-zhaoze-18','wild-desert-20','city-county-38','city-jun-28','city-zhou-16',
               'wild-caoyuan-19','wild-caoyuan-20','wild-zhaoze-19','city-county-39','city-jun-29','city-zhou-17',
               'ext-farm-08','ext-mine-08','city-county-40','city-jun-30','city-zhou-18','wild-zhaoze-20',
               'city-capital-17','city-capital-18','city-capital-19','city-capital-20','city-zhou-19','city-zhou-20',
               'city-jun-31','city-jun-32','city-county-41','city-county-42','city-zhou-21','city-zhou-22'];
    var okAll = true, okBook = true;
    NEW.forEach(function (sid) {
      var st = GAME.SG.one(sid);
      if (!st) { okAll = false; return; }
      var rk = GAME.SG.rankCount(st);
      if (rk < 5 || rk > 7) okAll = false;
      if ((st.endings || []).length !== 3) okAll = false;
      (st.endings || []).forEach(function (e) {
        var it = e.reward && e.reward.item;
        if (it && /^book_/.test(it)) okBook = false;
      });
    });
    return okA && okAll && okBook;   /* 本批 36 篇线内一律不发书 */
  })());

  /* v89.37：卷 66 / 70 / 69 抽篇走满（《换冬》《冰窖》《数雾》· e1） */
  check('故事库：卷 66~71 抽篇走满至结局（段数校验）', (function () {
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
    var w1 = walkTo('wild-caoyuan-19', 'e1');
    var w2 = walkTo('city-capital-17', 'e1');
    var w3 = walkTo('wild-zhaoze-20', 'e1');
    return !!w1 && w1.phase === 'end' && w1.ending.id === 'e1'
      && !!w2 && w2.phase === 'end' && w2.ending.id === 'e1'
      && !!w3 && w3.phase === 'end' && w3.ending.id === 'e1';
  })());
'''

edit(SM,
     u'''    return ok1 && ok2;
  })());


})();''',
     u'''    return ok1 && ok2;
  })());

''' + NEW_BLOCK + u'''
})();''',
     'smoke 卷 66~71 断言')

# ---------- 4) e2e VOL89 表 ----------
edit(E2,
     u"""      ['v89.35', 'wild-forest-19'], ['v89.35', 'city-capital-10'], ['v89.35', 'city-county-34']
    ];""",
     u"""      ['v89.35', 'wild-forest-19'], ['v89.35', 'city-capital-10'], ['v89.35', 'city-county-34'],
      ['v89.37', 'city-county-36'], ['v89.37', 'wild-caoyuan-18'], ['v89.37', 'city-zhou-17'],
      ['v89.37', 'city-zhou-18'], ['v89.37', 'city-capital-17'], ['v89.37', 'city-zhou-22']
    ];""",
     'e2e VOL89 追加 6 行')

print()
print('ALL OK —— v89.37 接线补丁执行完毕')
