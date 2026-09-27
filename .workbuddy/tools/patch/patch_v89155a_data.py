# -*- coding: utf-8 -*-
"""v89.155 补丁 A：data.js —— ① EXT_BUILDINGS 补 desc（悬停 undefined 修复）
② 新增 DATA.WD_ARM_MS（野地召回上膛超时）。分段落盘 + 幂等守卫 + strip 自检。"""
import io, re

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
def strip_js(t):
    t = t.replace('\\(', '').replace('\\)', '').replace('\\{', '').replace('\\}', '')
    t = re.sub(r'/\*[\s\S]*?\*/', '', t)
    t = re.sub(r'//[^\n]*', '', t)
    t = re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", t)
    t = re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', t)
    return t

P = 'js/data.js'
s = rd(P)
done = []

# ---- ① EXT_BUILDINGS 补 desc ----
if u"desc: '辟田垦殖，粮食产地'" in s:
    done.append('1 skip')
else:
    pairs = [
        (u"    farm:   { id: 'farm', name: '农田', icon: '🌾', res: 'grain', prod: PROD_H, cost: FARM_COST,",
         u"    /* v89.155（老板 5）：补 `desc` —— 空地选建悬停原读 `eb.desc`（字段不存在）→ 悬停开头显示\n"
         u"      \"undefined｜耗…\"（老板报「悬停显示不对」的真身）。desc = 一句话产地说明。 */\n"
         u"    farm:   { id: 'farm', name: '农田', icon: '🌾', desc: '辟田垦殖，粮食产地', res: 'grain', prod: PROD_H, cost: FARM_COST,"),
        (u"    forest: { id: 'forest', name: '伐木场', icon: '🪓', res: 'wood', prod: PROD_H,",
         u"    forest: { id: 'forest', name: '伐木场', icon: '🪓', desc: '伐木取材，木材产地', res: 'wood', prod: PROD_H,"),
        (u"    quarry: { id: 'quarry', name: '采石场', icon: '⛰️', res: 'stone', prod: PROD_H,",
         u"    quarry: { id: 'quarry', name: '采石场', icon: '⛰️', desc: '凿山取石，石料产地', res: 'stone', prod: PROD_H,"),
        (u"    mine:   { id: 'mine', name: '铁矿场', icon: '⛏️', res: 'iron', prod: PROD_H,",
         u"    mine:   { id: 'mine', name: '铁矿场', icon: '⛏️', desc: '开矿冶炼，铁料产地', res: 'iron', prod: PROD_H,"),
    ]
    for old, new in pairs:
        assert s.count(old) == 1, 'desc anchor: ' + old[:50]
        s = s.replace(old, new)
    done.append('1 OK')

# ---- ② WD_ARM_MS ----
A2 = u"  DATA.WILD_GEN_CHANCE = [0, 0, 0, 0.04, 0.08, 0.14, 0.22, 0.34, 0.48, 0.64, 0.8];"
N2 = u"""  /* v89.155（老板 2）：野地「召回驻军」按钮的**上膛超时**（毫秒）——
     第一次点击变黄（上膛态），2 秒内不点第二次 → 自动回落红色（取消上膛）。
     防误触不靠弹窗：连点两次才执行 + 超时自动复位（老板点名的交互）。 */
  DATA.WD_ARM_MS = 2000;

  DATA.WILD_GEN_CHANCE = [0, 0, 0, 0.04, 0.08, 0.14, 0.22, 0.34, 0.48, 0.64, 0.8];"""
if u'DATA.WD_ARM_MS = 2000;' in s:
    done.append('2 skip')
else:
    assert s.count(A2) == 1, '2 anchor'
    s = s.replace(A2, N2)
    done.append('2 OK')

wr(P, s)
s2 = rd(P)
_bk = strip_js(io.open(R + 'backup/v89155/data.js.before', encoding='utf-8', newline='').read())
_sa = strip_js(s2)
assert (_sa.count(u'{') - _sa.count(u'}')) == (_bk.count(u'{') - _bk.count(u'}')), 'brace'
assert (_sa.count(u'(') - _sa.count(u')')) == (_bk.count(u'(') - _bk.count(u')')), 'paren'
assert s2.count(u"desc: '辟田垦殖，粮食产地'") == 1
assert s2.count(u"desc: '伐木取材，木材产地'") == 1
assert s2.count(u"desc: '凿山取石，石料产地'") == 1
assert s2.count(u"desc: '开矿冶炼，铁料产地'") == 1
assert s2.count(u'DATA.WD_ARM_MS = 2000;') == 1
print('data.js done:', done)
