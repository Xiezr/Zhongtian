# -*- coding: utf-8 -*-
"""v89.229c11：smoke 收尾 7 处（闸门变量名 / 卡计数 / 夹具去重 / 机动判据 / 搬运夹具）"""
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


# ① 采集负重闸：G 在 smoke 里是 GAME（无 loadMul）→ 走 DATA.GATHER
rep('i1 采集闸倍率取 DATA.GATHER',
    "  var cap8 = Math.round(G.gatherLoadOf(g15) * (G.loadMul || 0));",
    "  var cap8 = Math.round(G.gatherLoadOf(g15) * (DATA.GATHER.loadMul || 1));",
    "DATA.GATHER.loadMul || 1));")

# ② §120⑦：D94 在该段不可见 → DATA
rep('i2 §120⑦ 取 DATA 而非 D94',
    "      var capTie = Math.round(3000 * D94.TROOPS.zhuzhan.load * (D94.GATHER.loadMul || 1));",
    "      var capTie = Math.round(3000 * DATA.TROOPS.zhuzhan.load * (DATA.GATHER.loadMul || 1));",
    "var capTie = Math.round(3000 * DATA.TROOPS.zhuzhan.load")

# ③ 侦察夹具剩余三处重复键
rep('i3 侦察夹具去重（余 3 处）',
    "garrison: { buxingji: 100, buxingji: 40 }",
    "garrison: { buxingji: 100, dunwei: 40 }",
    "garrison: { buxingji: 100, dunwei: 40 }",
    cnt=3)

# ④ 募兵卡计数：data-troop 也出现在两个按钮上 → 用卡类名计数
rep('i4 募兵卡计数改类名（主段）',
    """    var cards = (html.match(/data-troop="/g) || []).length;""",
    """    var cards = (html.match(/class="troop-card/g) || []).length;   /* 两个按钮也带 data-troop → 按卡类名数 */""",
    "两个按钮也带 data-troop → 按卡类名数")

rep('i5 募兵卡计数改类名（实测段）',
    """    return ok1 === exp1 && (h1.match(/data-troop="/g) || []).length === ids1.length;""",
    """    return ok1 === exp1 && (h1.match(/class="troop-card/g) || []).length === ids1.length;""",
    'class="troop-card/g) || []).length === ids1.length;')

# ⑤ 搬运计划：辎重加大到 5000 → 载重 6000−5000 = 1000（与旧口径同值 · factor<1 才成立）
rep('i6 搬运计划夹具（辎重 5000）',
    """      /* 去程辎重挤占运力：100 步行机 6000 载重（承长矛手 60）× − 4000 辎重 = 2000 */
      var Dv = G.battle.haulPlanOf({ army: { buxingji: 100 }, result: { atkRemain: 100 },
        cargo: { grain: 4000 }, loot: loot });""",
    """      /* 去程辎重挤占运力：100 步行机 6000 载重（承长矛手 60）− 5000 辎重 = 1000
         （v89.229：旧夹具 4000 辎重配 50 负重刚好触发超载；负重升到 60 后要加码辎重，
          否则 cap 2000 > 战利品重量 1500 → factor 恒 1，"超载缩水"这一态测不到） */
      var Dv = G.battle.haulPlanOf({ army: { buxingji: 100 }, result: { atkRemain: 100 },
        cargo: { grain: 5000 }, loot: loot });""",
    "cargo: { grain: 5000 }, loot: loot });")

rep('i7 搬运计划 cap 期望回 1000',
    """        && Dv.cap === 2000 && Dv.kept <= Dv.cap && Dv.kept > 0 && Dv.factor < 1;""",
    """        && Dv.cap === 1000 && Dv.kept <= Dv.cap && Dv.kept > 0 && Dv.factor < 1;""",
    "&& Dv.cap === 1000 && Dv.kept")

# ⑥ 机动：自行火炮射程 ≥ 纵深 → 1 步开火（不是更慢）
rep('i8 机动判据：器械 1 步开火',
    """    && st('buxingji', 1399) < st('huopao', 1399)   /* 射程 ≥ 纵深 → 1 步开火（器械不受纵深拖累） */""",
    """    && st('huopao', 1399) === 1                   /* 射程 1600 ≥ 纵深 1399 → 1 步即开火（不受纵深拖累） */
    && st('daodanche', 1399) === 1""",
    "st('huopao', 1399) === 1                   /* 射程 1600")

rep('i9 机动重复的 daodanche 判据合并',
    """    && st('huopao', 1399) === 1                   /* 射程 1600 ≥ 纵深 1399 → 1 步即开火（不受纵深拖累） */
    && st('daodanche', 1399) === 1
    /* 纵深越小，步数越少（单调） */
    && st('buxingji', 1399) > st('buxingji', 249)
    && st('daodanche', 1399) === 1;""",
    """    && st('huopao', 1399) === 1                   /* 射程 1600 ≥ 纵深 1399 → 1 步即开火（不受纵深拖累） */
    /* 纵深越小，步数越少（单调） */
    && st('buxingji', 1399) > st('buxingji', 249)
    && st('daodanche', 1399) === 1;""",
    "&& st('buxingji', 1399) > st('buxingji', 249)\n    && st('daodanche', 1399) === 1;")

# ---------------------------------------------------------------- 自检
def braces(p):
    s = rd(p)
    return len(re.findall(r'(?<![\\^])\{', s)) - len(re.findall(r'(?<![\\^])\}', s))


b0 = braces(os.path.join(ROOT, '.workbuddy', 'backup', 'v89229c9', 'smoke-test.js'))
b1 = braces(P)
LOG.append('花括号差值 当前=%d 基线=%d（裸计数含字符串/正则括号，只看是否变化）' % (b1, b0))
if b1 != b0:
    LOG.append('!!! 括号差值变化')
s = rd(P)
LOG.append('文件长度=' + str(len(s)))
if 'buxingji: 40 }' in s:
    LOG.append('!!! 仍有重复键残留')

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c11_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
