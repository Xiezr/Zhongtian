# -*- coding: utf-8 -*-
"""v89.28 题材线接线：index.html 装载 + smoke 断言 + e2e 真实点击

老板 2026-09-18：「继续，好像缺少点江湖元素。然后可发掘修炼，功法，少数民族，
夷狄等周边地区相关的」→ 卷 35~38（24 篇：江湖 / 修炼 / 四夷·北西 / 四夷·南东）。

本补丁只做三处接线（内容见 story/vol-35~38.js，已入位并通过 check）：
  ① index.html        追加 4 个 <script>（跟在 vol-34 之后）
  ② smoke-test.js     追加 4 个 require + 2 条断言（题材线就位 / 题材标记+功法奖赏入袋）
  ③ e2e-test.js       追加 1 个真实点击块（题材篇入口 → 在列 → 阅读器 → 走满 → 掩卷）

写盘用 temp + os.replace（原子），落盘回查。
"""
import io
import os
import sys

R = r'E:\Deepseekdb'


def read(rel):
    return io.open(os.path.join(R, rel), encoding='utf-8', newline='').read()


def write(rel, src):
    p = os.path.join(R, rel)
    tmp = p + '.tmp8928'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, p)


def eol_of(src):
    return '\r\n' if '\r\n' in src[:3000] else '\n'


# ============================================================ ① index.html
src = read('index.html')
eol = eol_of(src)
anchor = 'story/vol-34.js"></script>'
n = src.count(anchor)
if n != 1:
    print('FAIL [index.html] 锚点命中 %d 次' % n)
    sys.exit(1)
ls = src.rfind('\n', 0, src.index(anchor)) + 1
indent = src[ls:src.index('<', ls)]
block = eol.join([
    indent + '<script src="story/vol-35.js"></script>',
    indent + '<script src="story/vol-36.js"></script>',
    indent + '<script src="story/vol-37.js"></script>',
    indent + '<script src="story/vol-38.js"></script>',
]) + eol
j = src.index(anchor) + len(anchor)
j = src.index('\n', j) + 1
src = src[:j] + block + src[j:]
write('index.html', src)
back = read('index.html')
for k in (35, 36, 37, 38):
    assert ('story/vol-%d.js"></script>' % k) in back, k
print('OK  index.html：卷 35~38 script 已追加')

# ============================================================ ② smoke-test.js
src = read('smoke-test.js')
eol = eol_of(src)

# ②-a  requires
anchor = "  require('./story/vol-34.js');"
n = src.count(anchor)
if n != 1:
    print('FAIL [smoke requires] 锚点命中 %d 次' % n)
    sys.exit(1)
req_block = eol.join([
    anchor,
    "  /* v89.28：题材线（卷 35~38 · 24 篇 · 江湖 / 修炼 / 四夷·北西 / 四夷·南东）随卷加载 */",
    "  require('./story/vol-35.js');",
    "  require('./story/vol-36.js');",
    "  require('./story/vol-37.js');",
    "  require('./story/vol-38.js');",
])
src = src.replace(anchor, req_block, 1)

# ②-b  断言（插在 §81 的 ext 入口检查之后、§81 收口之前）
anchor2 = "    return has.indexOf('story-list') >= 0 && has.indexOf('data-kind=\"ext\"') >= 0 && empty === '';" + eol + "  })());"
n2 = src.count(anchor2)
if n2 != 1:
    print('FAIL [smoke asserts] 锚点命中 %d 次' % n2)
    sys.exit(1)

ASSERT = '''{EOL}
  /* v89.28：题材线（卷 35~38 · 24 篇 · 江湖/修炼/四夷 —— 老板「补江湖元素，发掘修炼功法与四夷」） */
  check('故事库：卷 35~38 题材线（24 篇就位 · 段数 5~7 · 3 结局 · 锚点齐备）', (function () {{
    var NEW = ['bld-kezhan-08', 'bld-shichang-09', 'bld-zhaoxianguan-08', 'wild-forest-06',
               'wild-hill-07', 'wild-lake-07',
               'wild-hill-08', 'wild-lake-08', 'wild-forest-07', 'wild-zhaoze-07',
               'wild-desert-07', 'bld-shuyuan-09',
               'wild-caoyuan-07', 'wild-desert-08', 'wild-hill-09', 'bld-majiu-08',
               'bld-yizhan-09', 'bld-honglusi-08',
               'wild-forest-08', 'wild-zhaoze-08', 'wild-lake-09', 'bld-shichang-10',
               'city-county-06', 'city-jun-07'];
    if (GAME.SG.list().length < 227) return false;
    var okA = GAME.SG.anchor('building', 'kezhan').length >= 8
      && GAME.SG.anchor('wild', 'caoyuan').length >= 7
      && GAME.SG.anchor('wild', 'zhaoze').length >= 8
      && GAME.SG.anchor('city', 'jun').length >= 7;
    var okAll = true;
    NEW.forEach(function (sid) {{
      var st = GAME.SG.one(sid);
      if (!st) {{ okAll = false; return; }}
      var rk = GAME.SG.rankCount(st);
      if (rk < 5 || rk > 7) okAll = false;
      if ((st.endings || []).length !== 3) okAll = false;
    }});
    return okA && okAll;
  }})());

  /* v89.28：题材标记 + 功法奖赏（内功秘籍 · 走满至 win 结局 → s.items 入袋） */
  check('故事库：题材标记（江湖/修炼/边务）与功法秘籍奖赏入袋', (function () {{
    var tagOf = function (sid) {{
      var st = GAME.SG.one(sid);
      return st ? (st.tags || []).join('|') : '';
    }};
    var okTag = tagOf('bld-kezhan-08').indexOf('江湖') >= 0
      && tagOf('bld-shuyuan-09').indexOf('修炼') >= 0
      && tagOf('wild-caoyuan-07').indexOf('边务') >= 0;
    var pathTo = function (st, endId) {{
      var idx = {{}}, first = (st.nodes || [])[0];
      (st.nodes || []).forEach(function (n) {{ idx[n.id] = n; }});
      if (!first) return null;
      var seen = {{}}, q = [[first.id, []]];
      seen[first.id] = 1;
      while (q.length) {{
        var cur = q.shift(), node = idx[cur[0]], path = cur[1];
        if (!node) continue;
        var ops = node.o || [];
        for (var i = 0; i < ops.length; i++) {{
          if (ops[i].to === endId) return path.concat(i);
          if (idx[ops[i].to] && !seen[ops[i].to]) {{
            seen[ops[i].to] = 1;
            q.push([ops[i].to, path.concat(i)]);
          }}
        }}
      }}
      return null;
    }};
    var walkTo = function (sid, endId) {{
      var st = GAME.SG.one(sid);
      var path = st ? pathTo(st, endId) : null;
      if (!path) return null;
      var r = GAME.SG.begin(sid);
      if (!r.ok) return null;
      for (var i = 0; i < path.length; i++) GAME.SG.choose(path[i]);
      return GAME.SG._run;
    }};
    var s = GAME.state;
    var pre1 = s.items.book_yuenv || 0, pre2 = s.items.book_liutao || 0;
    var w1 = walkTo('bld-zhaoxianguan-08', 'e1');
    var w2 = walkTo('bld-shuyuan-09', 'e1');
    var okBook = !!w1 && w1.phase === 'end' && !!w1.ending && w1.ending.id === 'e1'
      && (s.items.book_yuenv || 0) === pre1 + 1
      && !!w2 && w2.phase === 'end' && !!w2.ending && w2.ending.id === 'e1'
      && (s.items.book_liutao || 0) === pre2 + 1;
    return okTag && okBook;
  }})());
'''
src = src.replace(anchor2, anchor2 + ASSERT.format(EOL=eol), 1)
write('smoke-test.js', src)
back = read('smoke-test.js')
assert "require('./story/vol-38.js');" in back and '题材线（24 篇就位' in back
print('OK  smoke-test.js：+4 require · +2 断言')

# ============================================================ ③ e2e-test.js
src = read('e2e-test.js')
eol = eol_of(src)
anchor3 = ("      check('空态：无故事的建筑不出「逸闻」块（全建筑已有故事，跳过）', true);" + eol
           + "    }" + eol + "  })();")
n3 = src.count(anchor3)
if n3 != 1:
    print('FAIL [e2e] 锚点命中 %d 次' % n3)
    sys.exit(1)

E2E = '''    /* v89.28：题材线（卷 35~38 · 24 篇 · 江湖/修炼/四夷）· 建筑篇真实点击一路走满 */
    var THEME_BLD = ['bld-kezhan-08', 'bld-shichang-09', 'bld-zhaoxianguan-08', 'bld-majiu-08',
                     'bld-yizhan-09', 'bld-honglusi-08', 'bld-shuyuan-09', 'bld-shichang-10'];
    var s16Idx = -1, s16Sid = '';
    city.cells.forEach(function (cell, i) {{
      if (s16Idx >= 0 || !cell.build) return;
      var arr = G.SG.anchor('building', cell.build.id);
      for (var k = 0; k < arr.length; k++) {{
        if (THEME_BLD.indexOf(arr[k].st.id) >= 0) {{ s16Idx = i; s16Sid = arr[k].st.id; break; }}
      }}
    }});
    if (s16Idx >= 0) {{
      G.ui.openBuildModal(s16Idx);
      await sleep(30);
      var s16Entry = document.querySelector('#modal-root [data-action="story-list"]');
      check('★ v89.28：题材篇入口（' + s16Sid + '）', !!s16Entry);
      if (s16Entry) {{
        click(s16Entry);
        await sleep(30);
        var s16Item = document.querySelector('#modal-root [data-action="story-open"][data-sid="' + s16Sid + '"]');
        check('★ v89.28：题材新篇在列', !!s16Item);
        if (s16Item) {{
          click(s16Item);
          await sleep(40);
          var fx16 = document.querySelector('#story-fx');
          check('★ v89.28：题材阅读器（壁画两层 · 段进度就位）', !!fx16
            && fx16.querySelectorAll('.sgr-bg').length === 2
            && fx16.textContent.indexOf('第 1 段') >= 0 && /共 [5-7] 段/.test(fx16.textContent));
          var g16 = 0;
          while (fx16 && g16++ < 12) {{
            var pk16 = fx16.querySelector('[data-action="story-pick"]');
            if (!pk16) break;
            click(pk16);
            await sleep(30);
          }}
          check('★ v89.28：题材篇走到结局（结算屏）', !!fx16
            && !!fx16.querySelector('[data-action="story-exit"]'));
          if (fx16 && fx16.querySelector('[data-action="story-exit"]')) {{
            click(fx16.querySelector('[data-action="story-exit"]'));
            await sleep(30);
          }}
          check('★ v89.28：题材篇掩卷退出', !!fx16 && fx16.style.display === 'none');
        }} else {{
          check('★ v89.28：题材新篇阅读器（跳过）', true);
          check('★ v89.28：题材篇走到结局（跳过）', true);
          check('★ v89.28：题材篇掩卷退出（跳过）', true);
        }}
      }} else {{
        check('★ v89.28：题材新篇在列（跳过）', true);
        check('★ v89.28：题材新篇阅读器（跳过）', true);
        check('★ v89.28：题材篇走到结局（跳过）', true);
        check('★ v89.28：题材篇掩卷退出（跳过）', true);
      }}
    }} else {{
      check('★ v89.28：题材篇入口（本城无可读题材建筑，跳过）', true);
      check('★ v89.28：题材新篇在列（跳过）', true);
      check('★ v89.28：题材新篇阅读器（跳过）', true);
      check('★ v89.28：题材篇走到结局（跳过）', true);
      check('★ v89.28：题材篇掩卷退出（跳过）', true);
    }}'''
src = src.replace(anchor3, ("      check('空态：无故事的建筑不出「逸闻」块（全建筑已有故事，跳过）', true);" + eol
                            + "    }" + eol + E2E.format(EOL=eol) + eol + "  })();"), 1)
write('e2e-test.js', src)
back = read('e2e-test.js')
assert 'v89.28：题材篇入口' in back
print('OK  e2e-test.js：+1 真实点击块')

print('ALL OK')
