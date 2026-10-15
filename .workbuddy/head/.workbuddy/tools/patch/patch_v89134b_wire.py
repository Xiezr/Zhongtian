# -*- coding: utf-8 -*-
"""v89.134 补丁 2 —— 接线：
  ① 6 处 ['grain',...,'gold'] 字面量循环 → DATA.RES_ORDER（唯一数据源）
  ② GAME.RES_KEYS（state.js）→ DATA.RES_ORDER.concat(['pop'])
  ③ GAME.TRANSPORT_KEYS（domain.js）→ DATA.RES_ORDER
  ④ state.makeExtGrid 首城模板 → 读 DATA.INITIAL_EXT（与 NEW_CITY_EXT 同构）
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ' 锚点数 = ' + str(n)
    return s.replace(old, new)

LIT = "['grain', 'wood', 'stone', 'iron', 'gold']"
NEWF = 'DATA.RES_ORDER'

# ---------- battle.js ----------
b = rd('js/battle.js')
b = rep1(b,
  "    var startRes = {};\n    " + LIT + ".forEach(function (k) {\n",
  "    var startRes = {};\n    /* v89.134：读 DATA.RES_ORDER（资源集唯一数据源） */\n    " + NEWF + ".forEach(function (k) {\n",
  'battle 继承资源')
wr('js/battle.js', b)

# ---------- state.js（3 处替换 + RES_KEYS + makeExtGrid） ----------
s = rd('js/state.js')

# ② RES_KEYS
old = "  GAME.RES_KEYS = ['grain', 'wood', 'stone', 'iron', 'gold', 'pop'];\n"
new = ("  /* v89.134：由 DATA.RES_ORDER 派生（资源集唯一数据源 = data.js）——\n"
       "     含 pop（人口随城序列化，但不属于「可结算资源」）。 */\n"
       "  GAME.RES_KEYS = DATA.RES_ORDER.concat(['pop']);\n")
s = rep1(s, old, new, 'state RES_KEYS')

# ③ 掠夺产出
s = rep1(s,
  "    var out = {};\n    " + LIT + ".forEach(function (k) {\n      var v = Math.round((base[k] || 0) * pct);\n",
  "    var out = {};\n    /* v89.134：读 DATA.RES_ORDER */\n    " + NEWF + ".forEach(function (k) {\n      var v = Math.round((base[k] || 0) * pct);\n",
  'state 掠夺产出')

# ④ 战报账目
s = rep1(s,
  "    var got = [];\n    " + LIT + ".forEach(function (k) {\n",
  "    var got = [];\n    /* v89.134：读 DATA.RES_ORDER */\n    " + NEWF + ".forEach(function (k) {\n",
  'state 战报账目')

# ⑤ makeExtGrid 模板
old = ("    var tpl = (initial === 'new') ? (DATA.NEW_CITY_EXT || null)\n"
       "      : (initial ? ['farm', 'farm', 'forest', 'quarry', 'mine'] : null);\n")
new = ("    /* v89.134：首城模板读 DATA.INITIAL_EXT（与 NEW_CITY_EXT 同构）；\n"
       "       改前是就地字面量 —— 实机行为不变，改动点收敛到数据表。 */\n"
       "    var tpl = (initial === 'new') ? (DATA.NEW_CITY_EXT || null)\n"
       "      : (initial ? (DATA.INITIAL_EXT || null) : null);\n")
s = rep1(s, old, new, 'state makeExtGrid')
wr('js/state.js', s)

# ---------- domain.js（TRANSPORT_KEYS） ----------
d = rd('js/domain.js')
old = "  GAME.TRANSPORT_KEYS = ['grain', 'wood', 'stone', 'iron', 'gold'];\n"
new = "  GAME.TRANSPORT_KEYS = DATA.RES_ORDER;   /* v89.134：派生自资源集唯一数据源 */\n"
d = rep1(d, old, new, 'domain TRANSPORT_KEYS')
wr('js/domain.js', d)

# ---------- ui.js（3 处） ----------
u = rd('js/ui.js')
u = rep1(u,
  "    var resRows = '';\n    " + LIT + ".forEach(function (k) {\n",
  "    var resRows = '';\n    " + NEWF + ".forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */\n",
  'ui ①资源净变')
u = rep1(u,
  "    var html = '';\n    " + LIT + ".forEach(function (k) {\n",
  "    var html = '';\n    " + NEWF + ".forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */\n",
  'ui 资源行')
u = rep1(u,
  "    var contrib = {};\n    " + LIT + ".forEach(function (k) {\n",
  "    var contrib = {};\n    " + NEWF + ".forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */\n",
  'ui 野地贡献')
wr('js/ui.js', u)

# ---------- 写后自检 ----------
for f, tag in [('js/battle.js', 'battle'), ('js/state.js', 'state'), ('js/domain.js', 'domain'), ('js/ui.js', 'ui')]:
    t = rd(f)
    assert LIT not in t, tag + ' 字面量残留'
    assert 'DATA.RES_ORDER' in t, tag + ' 未接线'
print('OK · 8 处接线完成（battle 1 + state 3+1 + domain 1 + ui 3）')
