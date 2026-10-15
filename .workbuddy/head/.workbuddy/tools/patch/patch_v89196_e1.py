# -*- coding: utf-8 -*-
"""v89.196 批次E1：DATA.COLLECT 18 系加成就解锁条件（老板 7）
条件设计（系列级模板 { type, base, step }；件 n = base + step×件序）：
  名将系（军事）→ win/conquer/wild/gather/scout/fort/rank/bldg/lordLv
  佳人系（人文）→ rep/itemKind/recruited/trades
  器物系（建设）→ forged/trained/conquer/buildDone
"""
import io, re

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

s = rd('js/data.js')
if "cond: { type: 'win', base: 2, step: 2 }" in s:
    print('[skip] E1 已落盘'); raise SystemExit

CONDS = [
    ("wei5",      "win",       2,    2),      # 2/4/6/8/10 胜
    ("shu5",      "win",       12,   2),      # 12/14/16/18/20
    ("wu4",       "conquer",   2,    2),      # 2/4/6/8 占城
    ("hebei",     "wild",      5,    5),      # 5/10/15/20 占野地
    ("liangzhou", "gather",    10,   10),     # 10/20/30/40 采集
    ("jingxiang", "scout",     5,    5),      # 5/10/15/20 侦察
    ("huchen",    "fort",      1,    1),      # 1/2/3/4/5 前哨
    ("caozong",   "rank",      1,    1),      # 1/2/3/4 爵位
    ("shuxiang",  "bldg",      3,    3),      # 官府 3/6/9/12
    ("qunxiong",  "lordLv",    20,   20),     # 20/40/60/80/100 君主等级
    ("simei",     "rep",       300,  300),    # 300/600/900/1200 声望
    ("erqiao",    "itemKind",  3,    3),      # 3/6 藏品种类
    ("qinv",      "recruited", 5,    5),      # 5/10/15/20 招募
    ("hanjiaren", "trades",    10,   10),     # 10/20/30 市易
    ("shenbing",  "forged",    5,    5),      # 5/10/15/20 打造
    ("mingju",    "trained",   5000, 5000),   # 5000/10000/15000/20000 练兵
    ("zhongqi",   "conquer",   20,   10),     # 20/30/40/50（高阶征服）
    ("huaxiang",  "buildDone", 10,   10),     # 10/20/30/40 建成
]
n_ok = 0
for sid, typ, base, step in CONDS:
    pat = re.compile(r"(      \{ id: '" + re.escape(sid) + r"', name: '[^']*', icon: '[^']*', rep: \d+,)")
    m = pat.search(s)
    assert m, 'series not found: ' + sid
    ins = ("\n        /* v89.196（老板 7）：成就型解锁条件 —— 件 n = base + step×件序（唯一消费 = "
           "GAME.collectCondOf） */\n        cond: { type: '" + typ + "', base: " + str(base) + ", step: " + str(step) + " },")
    s = s[:m.end()] + ins + s[m.end():]
    n_ok += 1
wr('js/data.js', s)
print('[ok] E1 18 系 cond 注入（' + str(n_ok) + ' 系）')
