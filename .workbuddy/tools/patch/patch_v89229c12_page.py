# -*- coding: utf-8 -*-
"""v89.229c12：分页残留（_trainTab='inf' / _trainFilter）+ §164② 器械豁免 + §223④ 文案"""
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


def rep(tag, old, new, mark, cnt=1):
    s = rd(P)
    if mark in s:
        LOG.append('[skip] ' + tag); return True
    c = s.count(old)
    if c != cnt:
        LOG.append('[FAIL] ' + tag + ' count=' + str(c) + '/' + str(cnt)); return False
    wr(P, s.replace(old, new)); LOG.append('[ok]   ' + tag); return True


# ① 侦察夹具剩余三处重复键（用行首缩进区分，避开已改好的那处）
rep('j1 侦察夹具（0 级）',
    "      garrison: { buxingji: 100, buxingji: 40 }, guard: null };\n    var sc = G.battle.scoutTarget",
    "      garrison: { buxingji: 100, dunwei: 40 }, guard: null };\n    var sc = G.battle.scoutTarget",
    "      garrison: { buxingji: 100, dunwei: 40 }, guard: null };\n    var sc = G.battle.scoutTarget")

rep('j2 大雾夹具',
    "garrison: { buxingji: 100, buxingji: 40 } };",
    "garrison: { buxingji: 100, dunwei: 40 } };",
    "garrison: { buxingji: 100, dunwei: 40 } };")

rep('j3 满级后侦查夹具',
    "      garrison: { buxingji: 100, buxingji: 40 }, guard: null };\n    var sc = G.battle.scoutTarget(tgt, G.state.generals[0]);",
    "      garrison: { buxingji: 100, dunwei: 40 }, guard: null };\n    var sc = G.battle.scoutTarget(tgt, G.state.generals[0]);",
    "      garrison: { buxingji: 100, dunwei: 40 }, guard: null };\n    var sc = G.battle.scoutTarget(tgt, G.state.generals[0]);")

# ② 悬停断言（§38 第二处 · 行 7117）
rep('j4 悬停内容断言换 g1 页',
    """  check('实测：悬停内容含消耗/幸存者/耗时（耗粮已随军粮维持退役）', (function () {
    /* v81：兵种卡在步兵/机车页（首页是募兵队列） */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    var m = h.match(/<div class="tcard-tip tip-src">([\\s\\S]*?)<\\/div><\\/div>/);""",
    """  check('实测：悬停内容含消耗/幸存者/耗时（耗粮已随军粮维持退役）', (function () {
    /* v81：兵种卡在分组页（首页是募兵队列）；v89.229：组 1 = 后勤支援 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'g1';
    var h = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    var m = h.match(/<div class="tcard-tip tip-src">([\\s\\S]*?)<\\/div><\\/div>/);""",
    "v89.229：组 1 = 后勤支援\n    var bkTab = G.ui._trainTab; G.ui._trainTab = 'g1';")

# ③ 其余分页/退役字段引用
rep('j5 募兵参数（buxingji → g2 页）',
    """    /* v81：兵种卡在步兵/机车页（首页是募兵队列）—— 先切页再渲染 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'inf';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    return !!st && /data-troop="buxingji"/.test(html) && !/data-troop="undefined"/.test(html);""",
    """    /* v81：兵种卡在分组页（首页是募兵队列）—— 先切页再渲染；
       v89.229：步行机在组 2（主力战斗），故切 g2 */
    var bkTab = G.ui._trainTab; G.ui._trainTab = 'g2';
    var html = G.ui.troopsHTML();
    G.ui._trainTab = bkTab;
    return !!st && /data-troop="buxingji"/.test(html) && !/data-troop="undefined"/.test(html);""",
    "步行机在组 2（主力战斗），故切 g2")

rep('j6 兵营页 vs 队列页（g1）',
    """      G.ui._trainFilter = 'normal';
      G.ui._trainBIdx = null;
      G.ui._trainTab = 'inf';
      var inf = G.ui.troopsHTML();""",
    """      G.ui._trainBIdx = null;
      G.ui._trainTab = 'g1';                    /* v89.229：filter 参退役 · 组 1 后勤支援 */
      var inf = G.ui.troopsHTML();""",
    "v89.229：filter 参退役 · 组 1 后勤支援")

rep('j7 极限归因提示（g2 页）',
    """      G8.ui._trainFilter = 'normal'; G8.ui._trainTab = 'inf'; G8.ui._trainSel = 'buxingji';
      var h = G8.ui.troopsHTML();""",
    """      G8.ui._trainTab = 'g2'; G8.ui._trainSel = 'buxingji';
      var h = G8.ui.troopsHTML();""",
    "G8.ui._trainTab = 'g2'; G8.ui._trainSel = 'buxingji';")

rep('j8 幸存者三段条（g2 页）',
    """      var bakTab = G.ui._trainTab, bakFil = G.ui._trainFilter, bakSel = G.ui._trainSel;
      G.ui._trainTab = 'inf'; G.ui._trainFilter = 'normal'; G.ui._trainSel = 'buxingji';
      var ht = G.ui.troopsHTML();""",
    """      var bakTab = G.ui._trainTab, bakSel = G.ui._trainSel;
      G.ui._trainTab = 'g2'; G.ui._trainSel = 'buxingji';   /* v89.229：filter 参退役 · 步行机在组 2 */
      var ht = G.ui.troopsHTML();""",
    "v89.229：filter 参退役 · 步行机在组 2")

rep('j9 幸存者三段条还原语句',
    """      G.ui._trainTab = bakTab; G.ui._trainFilter = bakFil; G.ui._trainSel = bakSel;""",
    """      G.ui._trainTab = bakTab; G.ui._trainSel = bakSel;""",
    "G.ui._trainTab = bakTab; G.ui._trainSel = bakSel;")

rep('j10 危险区顺序（g1 页）',
    """        G.ui._trainBIdx = bi; G.ui._trainFilter = 'normal'; G.ui._trainTab = 'inf';
        var h = G.ui.troopsHTML();""",
    """        G.ui._trainBIdx = bi; G.ui._trainTab = 'g1';
        var h = G.ui.troopsHTML();""",
    "G.ui._trainBIdx = bi; G.ui._trainTab = 'g1';")

# ④ §164②：器械（自行火炮 5830）不参与"常备兵时长最慢"比较
rep('j11 §164② 器械豁免',
    """        && Object.keys(T).every(function (id) { return T[id].time <= T.taitan.time; });""",
    """        /* 器械（自行火炮 5830 / 无人轰炸机 2910）是制造品、不走征兵节奏 → 豁免本次比较 */
        && Object.keys(T).every(function (id) {
          return T[id].craft || T[id].time <= T.taitan.time;
        });""",
    "T[id].craft || T[id].time <= T.taitan.time;")

# ⑤ §223④ desc 逐字
rep('j12 §223④ desc 逐字',
    """        && q223.indexOf("title: '炮火破城'") >= 0 && q223.indexOf('炮火可碎城楼') >= 0""",
    """        && q223.indexOf("title: '炮火破城'") >= 0 && q223.indexOf('炮火之威，可碎城楼') >= 0""",
    "q223.indexOf('炮火之威，可碎城楼')")

# ---------------------------------------------------------------- 自检
def braces(p):
    s = rd(p)
    return len(re.findall(r'(?<![\\^])\{', s)) - len(re.findall(r'(?<![\\^])\}', s))


b0 = braces(os.path.join(ROOT, '.workbuddy', 'backup', 'v89229c9', 'smoke-test.js'))
b1 = braces(P)
LOG.append('花括号差值 当前=%d 基线=%d' % (b1, b0))
if b1 != b0:
    LOG.append('!!! 括号差值变化')
s = rd(P)
for bad in ["_trainTab = 'inf'", 'buxingji: 40 }', '_trainFilter = ']:
    n = s.count(bad)
    LOG.append('残留 %-22s = %d' % (bad, n))

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c12_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
