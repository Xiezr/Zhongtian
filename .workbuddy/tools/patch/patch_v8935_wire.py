# -*- coding: utf-8 -*-
"""v89.35 接线补丁：index.html 装载 / smoke 卷断言 / e2e VOL89 表（卷 60~65 · 36 篇）
建筑收官批：16 座城内建筑全部满额 10 篇。
"""
import io, sys, os

def read(p):
    return io.open(p, encoding='utf-8', newline='').read()

def write(p, s):
    tmp = p + '.tmp8935'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)

def edit(p, old, new, tag):
    src = read(p)
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n)); sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, tag
    print('OK  ' + tag)

# ---------- 1) index.html：装载 6 卷 ----------
edit('index.html',
     '<script src="story/vol-59.js"></script>\n',
     '<script src="story/vol-59.js"></script>\n'
     '<script src="story/vol-60.js"></script>\n'
     '<script src="story/vol-61.js"></script>\n'
     '<script src="story/vol-62.js"></script>\n'
     '<script src="story/vol-63.js"></script>\n'
     '<script src="story/vol-64.js"></script>\n'
     '<script src="story/vol-65.js"></script>\n',
     'index.html 装载 vol-60~65')

# ---------- 2) smoke：require ----------
edit('smoke-test.js',
     "  require('./story/vol-59.js');\n",
     "  require('./story/vol-59.js');\n"
     "  /* v89.35：建筑收官批（卷 60~65 · 36 篇 · 江湖五/修炼五/四夷六/志异五/都城/基层）随卷加载 */\n"
     "  require('./story/vol-60.js');\n"
     "  require('./story/vol-61.js');\n"
     "  require('./story/vol-62.js');\n"
     "  require('./story/vol-63.js');\n"
     "  require('./story/vol-64.js');\n"
     "  require('./story/vol-65.js');\n",
     'smoke require +6')

# ---------- 3) smoke：两条卷断言 ----------
SMOKE_NEW = u"""    return okNoBook && okWalk;
  })());

  /* v89.35：建筑收官批（卷 60~65 · 36 篇 · 江湖五/修炼五/四夷六/志异五/都城/基层） */
  check('故事库：卷 60~65（36 篇就位 · 建筑全满额 · 野地城池计数）', (function () {
    var okA = GAME.SG.anchor('building', 'guanfu').length === 10
      && GAME.SG.anchor('building', 'tiejiangpu').length === 10
      && GAME.SG.anchor('building', 'gongjiangzuofang').length === 10
      && GAME.SG.anchor('building', 'chengqiang').length === 10
      && GAME.SG.anchor('building', 'fenghuotai').length === 10
      && GAME.SG.anchor('building', 'junying').length === 10
      && GAME.SG.anchor('wild', 'lake').length === 20
      && GAME.SG.anchor('city', 'capital').length === 15;
    /* 建筑收官：16 座城内建筑全部满额 10 篇 */
    var BLDS = ['guanfu','minfang','shuyuan','junying','xiaochang','shichang','cangku','chengqiang','yizhan',
                'fenghuotai','majiu','kezhan','zhaoxianguan','honglusi','tiejiangpu','gongjiangzuofang'];
    var okFull = true;
    BLDS.forEach(function (b) { if (GAME.SG.anchor('building', b).length !== 10) okFull = false; });
    var NEW = ['bld-tiejiangpu-09','bld-gongjiangzuofang-09','bld-chengqiang-10','wild-forest-17','wild-lake-19','wild-caoyuan-15',
               'bld-tiejiangpu-10','bld-gongjiangzuofang-10','wild-lake-20','wild-zhaoze-15','wild-desert-17','wild-forest-18',
               'bld-fenghuotai-10','bld-junying-09','wild-caoyuan-16','wild-desert-18','city-county-31','city-county-32',
               'bld-guanfu-10','wild-zhaoze-16','wild-forest-19','wild-desert-19','wild-caoyuan-17','city-county-33',
               'city-capital-10','city-capital-11','city-capital-12','city-capital-13','city-capital-14','city-capital-15',
               'city-county-34','city-county-35','city-jun-26','city-jun-27','city-zhou-12','city-zhou-13'];
    var okAll = true;
    NEW.forEach(function (sid) {
      var st = GAME.SG.one(sid);
      if (!st) { okAll = false; return; }
      var rk = GAME.SG.rankCount(st);
      if (rk < 5 || rk > 7) okAll = false;
      if ((st.endings || []).length !== 3) okAll = false;
    });
    return okA && okFull && okAll;
  })());

  /* v89.35：志异五辑走满（《灶灰》留白底线）· 都城线首验（《候门》） */
  check('故事库：志异五辑 + 都城线（走满 e1 · 段数校验）', (function () {
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
    var w1 = walkTo('wild-forest-19', 'e1');
    var ok1 = !!w1 && w1.phase === 'end' && !!w1.ending && w1.ending.id === 'e1';
    var w2 = walkTo('city-capital-10', 'e1');
    var ok2 = !!w2 && w2.phase === 'end' && !!w2.ending && w2.ending.id === 'e1';
    return ok1 && ok2;
  })());


})();"""
OLD_TAIL = u"""    return okNoBook && okWalk;
  })());


})();"""
edit('smoke-test.js', OLD_TAIL, SMOKE_NEW, 'smoke v89.35 两条断言')

# ---------- 4) e2e：VOL89 表追加 6 行 ----------
edit('e2e-test.js',
     "      ['v89.34', 'city-county-29'], ['v89.34', 'wild-desert-15'], ['v89.34', 'bld-majiu-10']\n    ];",
     "      ['v89.34', 'city-county-29'], ['v89.34', 'wild-desert-15'], ['v89.34', 'bld-majiu-10'],\n"
     "      ['v89.35', 'bld-tiejiangpu-09'], ['v89.35', 'bld-tiejiangpu-10'], ['v89.35', 'bld-fenghuotai-10'],\n"
     "      ['v89.35', 'wild-forest-19'], ['v89.35', 'city-capital-10'], ['v89.35', 'city-county-34']\n    ];",
     'e2e VOL89 表 +6 行')

print('ALL OK')
