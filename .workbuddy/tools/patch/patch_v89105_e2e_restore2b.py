# -*- coding: utf-8 -*-
"""
v89.105 事故复建 · 批次 2（重写版）：统计页断言整条删除
============================================================
上一版想逐条"改写口径"，但那些断言是多行函数体，用文本锚点改极易破坏结构
（试写时就写出过 `})();` 提前闭合的错误）。

改法换成**语句级删除**：
  统计页整个视图已在 v89.104 退役（老板「统计这个菜单好像没啥用，删掉吧」），
  对着一页不存在的界面留 8 条断言毫无意义 —— 删掉，只留**一条**退役判据。
扫描方式：找到 `check(` 起点 → 括号配平找到该语句的 `);` 结束 → 整条切除。
"""
import io, os, re

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
P = os.path.join(R, 'e2e-test.js')
src = io.open(P, encoding='utf-8').read()

# 要删的断言：首参含这些词的
KILL = ['统计页渲染全境汇总', '统计页列出每座城池', '统计页为竹简卷轴',
        '统计页为分段账册', '账目行为「项目', '黄册为单列']

def find_stmt(text, start):
    """从 `check(` 的 c 位置起，括号配平找语句结尾（返回结束下标，含 `;`）"""
    i = text.index('(', start)
    depth = 0
    j = i
    in_s = None
    while j < len(text):
        c = text[j]
        if in_s:
            if c == '\\':
                j += 2; continue
            if c == in_s:
                in_s = None
        else:
            if c in '\'"`':
                in_s = c
            elif c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    k = j + 1
                    while k < len(text) and text[k] in ' \t':
                        k += 1
                    if k < len(text) and text[k] == ';':
                        return k + 1
                    return j + 1
        j += 1
    raise RuntimeError('未闭合')

removed = 0
while True:
    hit = None
    for kw in KILL:
        idx = src.find("check('" + kw)
        if idx >= 0 and (hit is None or idx < hit):
            hit = idx
    if hit is None:
        break
    # 往前吃掉该行的缩进
    line_start = src.rfind('\n', 0, hit) + 1
    end = find_stmt(src, hit)
    # 往后吃掉行尾换行
    while end < len(src) and src[end] in '\r\n':
        end += 1
    src = src[:line_start] + src[end:]
    removed += 1
print('删除统计页相关断言 %d 条' % removed)

# 补一条退役判据（挂在 v23 统计页那段的位置 —— 用"侧栏资源/驻军分列"作锚点插其后）
anchor = """  /* --- 驻军栏：标题只有两个字 --- */"""
assert anchor in src
NOTE = """  /* ============================================================
   * v89.104（老板「统计这个菜单好像没啥用，删掉吧」）：
   * **统计页（黄册）整个退役** —— 顶栏菜单、视图分发、弹窗入口、账册样式全撤。
   * 原来那 8 条断言（汇总/城池表/卷轴/账册分段/引线/单列）对着一个不存在的页面，
   * 一并删除；这里换成**一条退役判据**：谁把统计页加回来，这条就红。
   * ============================================================ */
  check('统计页已退役（视图分发、菜单入口、账册容器三者都不在册）', (function () {
    var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    return u.indexOf('ui.statsHTML') < 0                /* 视图函数已删 */
      && h.indexOf('data-view="stats"') < 0             /* 菜单入口已删 */
      && h.indexOf('.ledger-sec') < 0;                  /* 账册样式已删 */
  })());

"""
src = src.replace(anchor, NOTE + anchor, 1)
print('已补退役判据 1 条')

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('已写入')
