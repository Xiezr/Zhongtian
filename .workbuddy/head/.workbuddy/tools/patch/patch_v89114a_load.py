# -*- coding: utf-8 -*-
"""
patch_v89114a_load.py — 需求 1（一）：兵种负重（load）数值重排
------------------------------------------------------------
只改 js/data.js 里 18 条 TROOPS 的 load 值 + 补一段标定说明。
做法：按 `id: 'xxx'` 定位兵种行，替换该行内的 `load: N`。
三件套：先备份 → 原子落盘 → 写后自检。
"""
import io, os, re, shutil, sys

ROOT = 'E:/Deepseekdb'
P = os.path.join(ROOT, 'js/data.js')
BAK = os.path.join(ROOT, '.workbuddy/backup/v89114/data.js')

# id -> 新 load
NEW = {
    'minfu': 500, 'yibing': 50, 'chihou': 30, 'changqiang': 60, 'daodun': 50,
    'gongjian': 45, 'qingji': 250, 'tieji': 200, 'zhouche': 20000,
    'chuangnu': 20, 'chongche': 25, 'toudan': 30,
    'qingzhoubing': 80, 'tengjiabing': 55, 'tuqibing': 120, 'hubaoqi': 150,
    'xiliangtieqi': 220, 'nanjiangxiangbing': 800,
}

s = io.open(P, encoding='utf-8').read()
orig = s

for tid, nv in NEW.items():
    pat = re.compile(r"(id: '" + re.escape(tid) + r"'.*?\bload: )(\d+)", re.S)
    m = pat.search(s)
    if not m:
        print('!! 未找到兵种行: ' + tid); sys.exit(1)
    line_end = s.find('\n', m.start())
    line = s[m.start():line_end]
    if line.count('load:') != 1:
        print('!! 行内 load 不唯一: ' + tid); sys.exit(1)
    old_val = m.group(2)
    s = s[:m.start(2)] + str(nv) + s[m.end(2):]
    print('  %-16s load %s -> %s' % (tid, old_val, nv))

# ---- 标定说明块（挂在 v89.96 耐久标定之后）----
ANCHOR = "  DATA.TROOPS = {\n"
NOTE = """  /* v89.114（老板「为兵种增加负重属性，战斗所能携带的物资 / 掠夺返回的物资数量，
     与军队总负重有关；探索适用各兵种的负重数值」）——**负重标定**。
     ------------------------------------------------------------
     load 从本轮起吃**两条线**：① 出征随军辎重的运力（v89.103）；
     ② **掠夺战利品的搬运上限**（本轮新增：战利品总重 > 随军载重时，
     只能搬走载重范围内的部分，余留库中 —— 见 battle.haulPlanOf）。
     标定基准（让"打得起就搬得走"成立，复核数据见 probe_v89114_load.js）：
       · **基准：一名步兵 = 50**（随身干粮与水之外的余量）；
       · 步战主力 45~60 —— 甲械越重、能背回的越少（刀盾 50 / 弓箭 45 / 长枪 60）；
       · 骑兵 = 步兵 ×4~5（一人一马）：轻骑 250 / 铁骑 200（人马具甲）/ 突骑 120 / 虎豹 150；
       · 战象 = 步兵 ×16（驮载之王）：800；
       · 后勤专精：民夫 = 步兵 ×10（500）；辎重车 = 步兵 ×400（**20000**，一车顶 40 人挑）；
       · 器械（床弩 20 / 冲车 25 / 投石车 30）：自身就是"被运的货"，无携行余力；
       · 斥候 30（不列阵，但能背）。
     标定效果：纯战兵编队可搬同级战利品约 1/4~1/3；**编入约 1% 辎重车（或 5% 民夫）
     即可全数搬回** —— "带不带后勤"从此是一道真题，而不是一句空话。 */
"""
if '**负重标定**' in s:
    print('!! 说明块已存在，跳过'); 
else:
    if ANCHOR not in s:
        print('!! 未找到 DATA.TROOPS 锚点'); sys.exit(1)
    s = s.replace(ANCHOR, NOTE + ANCHOR, 1)
    print('  已插入负重标定说明块')

# ---- 原子落盘 ----
tmp = P + '.tmp89114'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)

# ---- 写后自检 ----
chk = io.open(P, encoding='utf-8').read()
ok = True
for tid, nv in NEW.items():
    m = re.search(r"id: '" + re.escape(tid) + r"'.*?\bload: (\d+)", chk, re.S)
    if not m or int(m.group(1)) != nv:
        print('!! 落盘校验失败: ' + tid); ok = False
if '**负重标定**' not in chk:
    print('!! 说明块缺失'); ok = False
# 括号配平（快检）
if chk.count('{') != chk.count('}'):
    print('!! 花括号不配平'); ok = False
print('DONE ok=' + str(ok) + '  len ' + str(len(orig)) + ' -> ' + str(len(chk)))
sys.exit(0 if ok else 1)
