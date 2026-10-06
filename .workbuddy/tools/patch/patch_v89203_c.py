# -*- coding: utf-8 -*-
"""v89.203 批次C：规则变更连带断言重写（§0.7 三件套）
—— ① 晋升用例：门槛改"打满本档"（平民 9 城）
   ② 攻城战斗 4 条：守方默认改 advance 后，跨场景对照实验须**显式固定守方阵位**（控制变量）
      （1754 单调性 / 1832 拆塔 / 1834 阵位间距 / 2090 箭塔火力）"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

def repl_line(s, key, newline):
    """按唯一子串定位行 → 整行替换（保行尾换行）"""
    assert s.count(key) == 1, 'line key count=' + str(s.count(key))
    i = s.index(key)
    l0 = s.rindex('\n', 0, i) + 1
    l1 = s.index('\n', i)
    return s[:l0] + newline + s[l1:]

p_smoke = R + 'smoke-test.js'

# ============================================================
# C1 · 晋升用例：平民档门槛 9 城（旧口径"公士需2城"退役）
# ============================================================
rep('C1a 晋升造局补城', p_smoke,
    "  s.cities.push(G.makeCity({ id: 'p2', name: '分城', x: 280, y: 230 })); // 公士需2城",
    "  /* v89.203（老板 4）：晋升门槛改「打满本档领地上限」——平民档需 9 城\n"
    "     （旧口径\"公士需 2 城\"随规则退役；此处按新门槛摆满，验证其余条件满足即可晋升）。 */\n"
    "  while (s.cities.length < 9) {\n"
    "    s.cities.push(G.makeCity({ id: 'p2_' + s.cities.length, name: '分城' + s.cities.length,\n"
    "      x: 280 + s.cities.length, y: 230 }));\n"
    "  }",
    "晋升门槛改「打满本档领地上限」——平民档需 9 城")

rep('C1b 上造用例标题', p_smoke,
    "'上造需2城未满足'", "'上造需打满 10 城未满足'",
    "'上造需打满 10 城未满足'")

# ============================================================
# C2 · 1754 单调性：c40/c90 显式固定守方 hold（控制变量）
# ============================================================
s = rd(p_smoke)
if s.count('跨场景对照须显式固定守方阵位') >= 1:
    print('[skip] C2 单调性')
else:
    NEW40 = ("  var c40 = G.tactic.simulate(atk, gen, def, 40, null,\n"
             "    /* v89.203：守方默认改「全员前进」后，跨场景对照须显式固定守方阵位（控制变量 · 测城防单因子） */\n"
             "    { kind: 'city', sieging: true, stances: { def: { changqiang: { s: 'hold', t: '' }, gongjian: { s: 'hold', t: '' } } } });")
    NEW90 = ("  var c90 = G.tactic.simulate(atk, gen, def, 90, null,\n"
             "    { kind: 'city', sieging: true, stances: { def: { changqiang: { s: 'hold', t: '' }, gongjian: { s: 'hold', t: '' } } } });")
    s = repl_line(s, 'atk, gen, def, 40, null,', NEW40)
    s = repl_line(s, 'atk, gen, def, 90, null,', NEW90)
    wr(p_smoke, s)
    print('[ok] C2 单调性（c40/c90 固定守方 hold）')

rep('C2b 单调性标题', p_smoke,
    "check('实测：攻城难度随城防值单调上升（野地 < 县城 < 州城）'",
    "check('实测：攻城难度随城防值单调上升（野地 < 县城 < 州城 · 攻城场守方固定 hold[^v89.203]）'",
    "攻城场守方固定 hold[^v89.203]")

# ============================================================
# C3 · 1832 拆塔：显式固定守方 hold（两处同款实验）
# ============================================================
rep('C3 拆塔 opts', p_smoke,
    "{ toudan: 4000 }, gT, { changqiang: 1500 }, 200, null,\n"
    "    { kind: 'city', sieging: true, wallLv: 8 });",
    "{ toudan: 4000 }, gT, { changqiang: 1500 }, 200, null,\n"
    "    /* v89.203：守方固定 hold（控制变量）—— 默认已改「全员前进」，不固定则守军出击、拆塔窗口不再成立 */\n"
    "    { kind: 'city', sieging: true, wallLv: 8, stances: { def: { changqiang: { s: 'hold', t: '' } } } });",
    "v89.203：守方固定 hold（控制变量）", cnt=2)

rep('C3b 拆塔标题', p_smoke,
    "check('实测：指定目标为箭塔可拆，且**拆完自动转打守军**（不许对着空地站到 30 回合）'",
    "check('实测：指定目标为箭塔可拆，且**拆完自动转打守军**（不许对着空地站到 30 回合 · 守方固定 hold[^v89.203]）'",
    "站到 30 回合 · 守方固定 hold")

# ============================================================
# C4 · 1834 阵位间距：stances 加 def hold（两处 gapAt）
# ============================================================
rep('C4 阵位 stances', p_smoke,
    "stances: { atk: { gongjian: { s: s, t: '' } } }",
    "stances: { atk: { gongjian: { s: s, t: '' } }, def: { changqiang: { s: 'hold', t: '' } } }",
    "}, def: { changqiang: { s: 'hold', t: '' } } }", cnt=2)

rep('C4b 阵位标题', p_smoke,
    "check('实测：前进推进 / 防御不动 / 后退拉大间距（间距是真在变，不是只改了个字段）'",
    "check('实测：前进推进 / 防御不动 / 后退拉大间距（间距是真在变，不是只改了个字段 · 守方固定 hold[^v89.203]）'",
    "不是只改了个字段 · 守方固定 hold")

# ============================================================
# C5 · 2090 箭塔火力：opts 加 stances.def hold（两处）
# ============================================================
rep('C5 箭塔火力 opts', p_smoke,
    "{ sieging: true, wallLv: 6, towers: tw }",
    "{ sieging: true, wallLv: 6, towers: tw, stances: { def: { yibing: { s: 'hold', t: '' } } } }",
    "stances: { def: { yibing: { s: 'hold', t: '' } } }", cnt=2)

rep('C5b 箭塔火力标题', p_smoke,
    "check('实测：造的箭塔真的提升城头火力（座数越多、攻方损失越大）'",
    "check('实测：造的箭塔真的提升城头火力（座数越多、攻方损失越大 · 守方固定 hold[^v89.203]）'",
    "攻方损失越大 · 守方固定 hold")

print('批次C 完成')
