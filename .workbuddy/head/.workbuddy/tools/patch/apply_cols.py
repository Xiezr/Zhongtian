# -*- coding: utf-8 -*-
"""v67 补丁 A：侧栏「资源 / 驻军」两列数字各自成列、拉开间距。
老板原话：「资源与统计那里太拥挤了，分一下列，总数和生产速度挨太近」。
实测基线（1440×900）：存量 [91,169] 与 增速 [175,237] 只隔 **6px**；
驻军行「数量」与「耗粮」也只隔 6px（flex gap）。
做法（一处集中，全站这两个行族共用同一套口径）：
  · 列间距 6 → 8px，两列之间加**发丝竖线**（--line）把"增速/耗粮"独立成一列；
  · 存量列 78 → 74、增速列 62 → 72（给「+1,234.5/秒」留够；实测行宽 251 仍有余量）。
"""
import io

H = r'E:\Deepseekdb\index.html'
h = io.open(H, 'r', encoding='utf-8', newline='').read()
report = []

def rep(old, new, tag, cnt=1, path=H):
    global h
    if path != H:
        s = io.open(path, 'r', encoding='utf-8', newline='').read()
        assert s.count(old) == cnt, (tag, s.count(old))
        io.open(path, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
        report.append(('OK  ', tag, ''))
        return
    assert h.count(old) == cnt, (tag, h.count(old))
    h = h.replace(old, new)
    report.append(('OK  ', tag, ''))

# ① 资源行：列宽与列间距
rep("""#res-bar .res-line .val {
    display: grid; grid-template-columns: 78px 62px 1.1em;
    align-items: center; justify-content: end; column-gap: 6px;
    min-width: 0; position: relative;
  }""",
"""#res-bar .res-line .val {
    /* v67（老板）：「总数和生产速度挨太近，分一下列」——
       存量 | 增速 各自成列：列宽定死 + 列间距 8px + 增速列左侧一条发丝竖线。
       实测（1440×900）：两列之间从 6px 拉到 8px + 8px 内边距 + 1px 竖线。 */
    display: grid; grid-template-columns: 74px 72px 1.1em;
    align-items: center; justify-content: end; column-gap: 8px;
    min-width: 0; position: relative;
  }""",
    '资源行 .val 列宽/间距')

rep("""#res-bar .res-line .amt {
    font-variant-numeric: tabular-nums; text-align: right; justify-self: end;
    /* v65（老板）：「规划一下显示得齐整一点」——
       定宽 + 右对齐，各行的数字右缘对齐（小数点在视觉上成一列）；
       76px 是给「1234.6万」这种最长串留的（短写后 4 位整数也已够）。 */
    min-width: 78px;
  }""",
"""#res-bar .res-line .amt {
    font-variant-numeric: tabular-nums; text-align: right; justify-self: end;
    /* v65（老板）：「规划一下显示得齐整一点」——
       定宽 + 右对齐，各行的数字右缘对齐（小数点在视觉上成一列）。
       v67：列宽 78 → 74（与增速列一起重排，见上面 .val 的注释）。 */
    min-width: 74px;
  }""",
    '资源行 .amt 定宽')

rep("""#res-bar .num-rate { font-variant-numeric: tabular-nums; min-width: 62px; text-align: right; display: inline-block; }""",
"""/* v67：增速列自成一体 —— 左侧发丝竖线 + 内边距，宽度 62 → 72（容「+1,234.5/秒」） */
#res-bar .num-rate { font-variant-numeric: tabular-nums; min-width: 72px; text-align: right; display: inline-block; }""",
    '资源行 .num-rate 定宽')

rep("""#res-bar .res-line .rate-wrap { flex: none; }""",
"""#res-bar .res-line .rate-wrap {
    flex: none;
    /* v67（老板）：「分一下列」—— 增速列与存量列之间走一条发丝竖线 */
    border-left: 1px solid var(--line);
    padding-left: 8px;
  }""",
    '资源行 .rate-wrap 竖线')

# ② 驻军行：改成网格三列，同样加竖线
rep(""".gb-row { display: flex; align-items: center; gap: 6px; font-size: var(--fs-sub);
    padding: 2px 0; border-bottom: 1px dashed var(--line); }""",
""".gb-row { /* v67（老板）：「分一下列」—— 数量与耗粮各自成列，中间发丝竖线 */
    display: grid; grid-template-columns: 1fr 62px 74px; align-items: center; gap: 8px;
    font-size: var(--fs-sub);
    padding: 2px 0; border-bottom: 1px dashed var(--line); }""",
    '驻军行改网格')

rep(""".gb-row .gb-c { color: var(--gold-light); font-variant-numeric: tabular-nums; }""",
""".gb-row .gb-c { color: var(--gold-light); font-variant-numeric: tabular-nums;
    text-align: right; }""",
    '驻军数量右对齐')

rep(""".gb-row .gb-f { color: var(--text-dim); font-size: var(--fs-cap); min-width: 74px; text-align: right; }""",
""".gb-row .gb-f { color: var(--text-dim); font-size: var(--fs-cap);
    text-align: right; border-left: 1px solid var(--line); padding-left: 8px; }""",
    '驻军耗粮列加竖线')

io.open(H, 'w', encoding='utf-8', newline='').write(h)

# ③ 测试里钉住列宽的断言同步（判的是"等宽右对齐"，具体数字随本次重排）
S = r'E:\Deepseekdb\smoke-test.js'
rep("""  check('产量列等宽右对齐', /#res-bar \\.num-rate \\{[\\s\\S]{0,120}min-width: 62px; text-align: right/.test(hS32));""",
    """  check('产量列等宽右对齐', /#res-bar \\.num-rate \\{[\\s\\S]{0,120}min-width: 72px; text-align: right/.test(hS32));""",
    'smoke32 产量列宽断言', path=S)

rep("""    /#res-bar \\.res-line \\.amt \\{[\\s\\S]{0,120}tabular-nums/.test(hS33)
    && /min-width: 76px/.test(hS33) && /min-width: 62px/.test(hS33));""",
    """    /#res-bar \\.res-line \\.amt \\{[\\s\\S]{0,120}tabular-nums/.test(hS33)
    /* v67：列宽重排为 74 / 72（存量 / 增速），仍要求"定宽 + 右对齐" */
    && /min-width: 74px/.test(hS33) && /min-width: 72px/.test(hS33));""",
    'smoke33 资源列宽断言', path=S)

rep("""    return css.indexOf('min-width: 78px') >= 0 && css.indexOf('text-align: right') >= 0""",
    """    return css.indexOf('min-width: 74px') >= 0 && css.indexOf('text-align: right') >= 0""",
    'smoke49 .amt 定宽断言', path=S)

print('')
for st, tag, extra in report:
    print('%s  %-30s %s' % (st, tag, extra))
