# -*- coding: utf-8 -*-
"""v89.211 补丁 C：battle.js onConquer 释放块 → 补建民房"""
import io
R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

s = rd('js/battle.js')
if "v89.211（老板 2）" in s:
    print('[skip] C1 占城释放已改补建')
else:
    old = """    (function () {
      var _wl128 = 0;
      newCity.cells.forEach(function (c) {
        if (c.build && c.build.id === 'chengqiang') {
          _wl128 = Math.max(_wl128, c.build.lvl || 0);
          c.build = null; c.pending = null;
        }
      });
      if (_wl128 > 0) newCity.wall.build = { id: 'chengqiang', lvl: _wl128 };
    })();"""
    new = """    (function () {
      var _wl128 = 0;
      newCity.cells.forEach(function (c) {
        if (c.build && c.build.id === 'chengqiang') {
          _wl128 = Math.max(_wl128, c.build.lvl || 0);
          /* v89.211（老板 2）：城墙格**补建民房**（同等级）—— 原样留空会让"打下的满配城"
             缺一块（老板实测"第五行第六格未建造"即此格，误猜是仓库）。
             同口径见 state.js 读档迁移的释放块 / 存量修复 migrateWallCell211。 */
          c.build = { id: 'minfang', lvl: c.build.lvl || 1 };
          c.pending = null;
        }
      });
      if (_wl128 > 0) newCity.wall.build = { id: 'chengqiang', lvl: _wl128 };
    })();"""
    s = sub1(s, old, new, 'C1')
    wr('js/battle.js', s)
    print('[ok] C1 占城释放补建')
print('DONE')
