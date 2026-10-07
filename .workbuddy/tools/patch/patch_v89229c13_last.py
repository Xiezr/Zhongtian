# -*- coding: utf-8 -*-
"""v89.229c13：最后一批残留（侦察夹具 2 处 · v81 队列页 · v84 三页对照）
说明：前一版 j1/j2 的 mark 与既有文本撞车导致误 skip（§105.6），此处改用**行号定位**
（以当前落盘内容为准，锚点取该行独有的长串）。
"""
import io, os, re, sys

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'smoke-test.js')


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


LOG = []
s = rd(P)

# ① 按行号精确改（先打印再改，确保只动目标行）
edits = {
    4520: ("garrison: { buxingji: 100, buxingji: 40 }, guard: null };",
           "garrison: { buxingji: 100, dunwei: 40 }, guard: null };   /* v89.229：夹具去重（旧两兵种合并） */"),
    4587: ("garrison: { buxingji: 100, buxingji: 40 } };",
           "garrison: { buxingji: 100, dunwei: 40 } };   /* v89.229：夹具去重（旧两兵种合并） */"),
}
lines = s.split('\n')
for ln, (old, new) in sorted(edits.items(), reverse=True):
    i = ln - 1
    assert old in lines[i], 'L%d 锚点不符：%s' % (ln, lines[i])
    lines[i] = lines[i].replace(old, new)
    LOG.append('[ok]   L%d 侦察夹具去重' % ln)
s = '\n'.join(lines)

# ② v81 队列页 / 步兵页对照 —— filter 引用清掉 + 分页键换 g1
old81 = """    var keepTab = G.ui._trainTab, keepFilter = G.ui._trainFilter, keepBIdx = G.ui._trainBIdx;"""
new81 = """    var keepTab = G.ui._trainTab, keepBIdx = G.ui._trainBIdx;"""
assert s.count(old81) == 1
s = s.replace(old81, new81); LOG.append('[ok]   v81 keepFilter 退役')

old81b = """      G.ui._trainFilter = 'normal';
      G.ui._trainBIdx = null;
      G.ui._trainTab = 'inf';"""
new81b = """      G.ui._trainBIdx = null;
      G.ui._trainTab = 'g1';                    /* v89.229：filter 参退役 · 组 1 后勤支援 */"""
assert s.count(old81b) == 1
s = s.replace(old81b, new81b); LOG.append('[ok]   v81 切页换 g1')

old81c = """      G.ui._trainTab = keepTab; G.ui._trainFilter = keepFilter; G.ui._trainBIdx = keepBIdx;"""
new81c = """      G.ui._trainTab = keepTab; G.ui._trainBIdx = keepBIdx;"""
assert s.count(old81c) == 1
s = s.replace(old81c, new81c); LOG.append('[ok]   v81 还原语句清 filter')

old81d = """  })(), '步兵页不带队列 / 队列页只带队列');"""
new81d = """  })(), '兵种页不带队列 / 队列页只带队列');"""
assert s.count(old81d) == 1
s = s.replace(old81d, new81d); LOG.append('[ok]   v81 标题口径')

# ③ v84 三页对照（inf/cav → g1/g2/g3）
old84 = """  check('实测：步兵 / 机车页卡面 HTML 均无「拥有」', (function () {
    var bkF = G.ui._trainFilter, bkT = G.ui._trainTab, bkS = G.ui._trainSel;
    G.ui._trainFilter = 'normal';
    var ok = ['inf', 'cav'].every(function (tab) {
      G.ui._trainTab = tab;
      return G.ui.troopsHTML().indexOf('拥有') < 0;
    });
    G.ui._trainFilter = bkF; G.ui._trainTab = bkT; G.ui._trainSel = bkS;
    return ok;
  })());"""
new84 = """  check('实测：三个分组页卡面 HTML 均无「拥有」（v89.229：g1/g2/g3）', (function () {
    var bkT = G.ui._trainTab, bkS = G.ui._trainSel;
    var ok = ['g1', 'g2', 'g3'].every(function (tab) {
      G.ui._trainTab = tab;
      return G.ui.troopsHTML().indexOf('拥有') < 0;
    });
    G.ui._trainTab = bkT; G.ui._trainSel = bkS;
    return ok;
  })());"""
assert s.count(old84) == 1
s = s.replace(old84, new84); LOG.append('[ok]   v84 三页对照')

wr(P, s)

# ---------------------------------------------------------------- 自检
def braces(x):
    return len(re.findall(r'(?<![\\^])\{', x)) - len(re.findall(r'(?<![\\^])\}', x))


b0 = braces(rd(os.path.join(ROOT, '.workbuddy', 'backup', 'v89229c9', 'smoke-test.js')))
b1 = braces(rd(P))
LOG.append('花括号差值 当前=%d 基线=%d' % (b1, b0))
s2 = rd(P)
for bad in ["_trainTab = 'inf'", 'buxingji: 40 }', "_trainFilter = 'normal'", "_trainFilter = bk"]:
    LOG.append('残留 %-26s = %d' % (bad, s2.count(bad)))

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c13_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
