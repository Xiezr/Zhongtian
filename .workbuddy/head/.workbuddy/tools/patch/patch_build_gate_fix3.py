# -*- coding: utf-8 -*-
"""v68 修正 3：第 54 节测试自身的 bug —— free54 需能"避开已在用的格"。

现象：被前置拒掉的格仍空，下一次 free54() 会取到同一个位置，
于是"客栈建在招贤馆的格上"等连锁错位（3 条断言失败、1 条假绿）。
"""
import io
import os
import sys

SMOKE = os.path.join(r'E:\Deepseekdb', 'smoke-test.js')

F_OLD = """    var free54 = function () {
      for (var i = 0; i < c54.cells.length; i++) {
        var x = c54.cells[i];
        if (!x.official && !x.build && !x.pending) return i;
      }
      return -1;
    };"""

F_NEW = """    var free54 = function (except) {
      /* except：本次要保留的格 —— 被前置拒掉的格仍是空位，不排除会重复取到同一格 */
      for (var i = 0; i < c54.cells.length; i++) {
        var x = c54.cells[i];
        if (i === except) continue;
        if (!x.official && !x.build && !x.pending) return i;
      }
      return -1;
    };"""

PLAN = [
    (F_OLD, F_NEW, 'free54 加 except'),
    ('      var k1 = free54();', '      var k1 = free54(z1);', 'k1 避开 z1'),
    ('      var t2 = free54();', '      var t2 = free54(t1);', 't2 避开 t1'),
    ('      var ck2 = free54();', '      var ck2 = free54(ck1);', 'ck2 避开 ck1'),
]


def main():
    t = io.open(SMOKE, 'rb').read().decode('utf-8')
    if 'var free54 = function (except)' in t:
        print('· 已修，跳过（幂等）')
        return 0
    crlf0 = t.count('\r\n')
    done = []
    for old, new, tag in PLAN:
        c = t.count(old)
        if c != 1:
            print('✗ [%s] 锚点命中 %d 次' % (tag, c))
            return 1
        t = t.replace(old, new, 1)
        done.append(tag)
    out = t.encode('utf-8')
    if out.count(b'\r\n') != crlf0:
        print('✗ 行尾被改写')
        return 1
    io.open(SMOKE, 'wb').write(out)
    print('本次改动: %d 处 —— %s' % (len(done), ' / '.join(done)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
