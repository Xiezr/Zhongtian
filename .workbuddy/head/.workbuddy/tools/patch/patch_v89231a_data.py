# -*- coding: utf-8 -*-
"""v89.231 批次 a：js/data.js —— 科技 24 项术语换代 + 分组（TECH_CATS）
① 掩码受保护面（老板原话 / 原版数据引述）
② 全局词替换（20 项旧名 → 新名）
③ 恢复掩码（yiliao 沿革注带"前名"改写）
④ TECH 表 24 行插 cat 字段
⑤ TECH_CATS 定义插入
⑥ 表头沿革段
⑦ 两条 desc 微调（士兵生命→我军生命 · 士卒→部队）
"""
import io

ROOT = 'E:/Deepseekdb/'
P = 'js/data.js'

def rd(p):
    return io.open(ROOT + p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []
s = rd(P)
s_orig = s

# ---------- ① 掩码受保护面 ----------
PROT = [
    # 老板原话（三处同源引述之一，本文件内）
    '侦察技巧等级应该可以侦察出',
    # 原版数据引述（"数据照搬 4399 官方"）
    '抛射技巧 3 级',
]
masks = {}
for k, t in enumerate(PROT):
    c = s.count(t)
    assert c == 1, 'protect miss: %s count=%d' % (t, c)
    ph = '\x01P%d\x01' % k
    masks[ph] = t
    s = s.replace(t, ph)
REPORT.append('[ok] 掩码受保护面 ×%d' % len(PROT))

# yiliao 沿革注：不掩码，直接"当时名→现名+前名注"改写（先于全局替换做，避免误伤）
old_y = '改指 **维修技术（weixiu · 伤兵回收率 +3%/级）**，仍取 Lv8'
new_y = '改指 **再生技术（weixiu · 伤兵回收率 +3%/级 · v89.231 前名「维修技术」）**，仍取 Lv8'
assert s.count(old_y) == 1, 'yiliao note miss'
s = s.replace(old_y, new_y)
REPORT.append('[ok] yiliao 沿革注改写（含前名）')

# ---------- ② 全局词替换 ----------
MAP = [
    ('练兵技巧', '募兵整训'),
    ('战斗技巧', '战斗条令'),
    ('打造技巧', '锻造工艺'),
    ('侦察技巧', '侦察网络'),
    ('防护技巧', '装甲强化'),
    ('负重技巧', '载重优化'),
    ('行军技巧', '机动行军'),
    ('抛射技巧', '弹道校正'),
    ('驾驭技巧', '机车操控'),
    ('建筑技术', '废墟重建'),
    ('储存技术', '仓储扩容'),
    ('补给技巧', '生命维持'),
    ('统帅能力', '指挥链路'),
    ('城防技术', '防御工事'),
    ('维修技术', '再生技术'),
    ('抢掠技巧', '废墟搜刮'),
    ('合成技巧', '量产工艺'),
    ('车轮技术', '传动系统'),
    ('机修技巧', '座驾改装'),
    ('研究技巧', '逆向工程'),
]
cnt = {}
for old, new in MAP:
    c = s.count(old)
    cnt[old] = c
    s = s.replace(old, new)
REPORT.append('[ok] 全局词替换：' + ' · '.join('%s×%d' % (o, cnt[o]) for o, _ in MAP))

# ---------- ③ 恢复掩码 ----------
for ph, t in masks.items():
    assert s.count(ph) == 1, 'restore miss: ' + ph
    s = s.replace(ph, t)
REPORT.append('[ok] 恢复受保护面')

# ---------- ④ TECH 表 24 行插 cat ----------
CATS = [
    ('zhongzhi', '净化技术', 'res'),
    ('kanfa', '栽培技术', 'res'),
    ('lianbing', '募兵整训', 'mil'),
    ('wajue', '蓄能技术', 'res'),
    ('yelian', '熔炼技术', 'res'),
    ('zhandou', '战斗条令', 'mil'),
    ('dazao', '锻造工艺', 'eng'),
    ('zhencha', '侦察网络', 'intel'),
    ('fanghu', '装甲强化', 'mil'),
    ('fuzhong', '载重优化', 'logi'),
    ('xingjun', '机动行军', 'logi'),
    ('paoshe', '弹道校正', 'mil'),
    ('jiayu', '机车操控', 'logi'),
    ('jianzhu', '废墟重建', 'eng'),
    ('chucun', '仓储扩容', 'eng'),
    ('buji', '生命维持', 'mil'),
    ('tongshuai', '指挥链路', 'intel'),
    ('chengfang', '防御工事', 'eng'),
    ('weixiu', '再生技术', 'mil'),
    ('qianglue', '废墟搜刮', 'logi'),
    ('hecheng', '量产工艺', 'eng'),
    ('chelun', '传动系统', 'logi'),
    ('xunma', '座驾改装', 'logi'),
    ('yanjiu', '逆向工程', 'intel'),
]
for tid, tname, cat in CATS:
    old = "id: '%s', name: '%s', lv: " % (tid, tname)
    new = "id: '%s', name: '%s', cat: '%s', lv: " % (tid, tname, cat)
    c = s.count(old)
    assert c == 1, 'cat insert miss: %s count=%d' % (tid, c)
    s = s.replace(old, new)
REPORT.append('[ok] TECH 表 24 行插 cat')

# ---------- ⑤ TECH_CATS 定义 ----------
anchor = """    { id: 'yanjiu', name: '逆向工程', cat: 'intel', lv: 3, type: 'study', per: 0.05, desc: '科技研究速度 +5%/级' },
  ];
"""
add = anchor + """  /* v89.231（老板「根据废土背景和现有兵种，建筑，调整科技体系」）：
     **科技分组** —— 研习所面板按此分节展示；`DATA.TECH[*].cat` 必须 ∈ 本表 key。
     分组序 = 面板展示序（24 项 → 5 组：4/6/5/6/3）。 */
  DATA.TECH_CATS = [
    { key: 'res',   name: '资源产出' },
    { key: 'mil',   name: '军事武装' },
    { key: 'eng',   name: '工程建设' },
    { key: 'logi',  name: '机动后勤' },
    { key: 'intel', name: '情报指挥' },
  ];
"""
assert s.count(anchor) == 1, 'TECH_CATS anchor miss'
s = s.replace(anchor, add)
REPORT.append('[ok] TECH_CATS 插入')

# ---------- ⑥ 表头沿革段 ----------
old_head = """  /* ============================================================
   * 科技（24项 · 报告2.3b）
   * lv 解锁的研习所等级；type 供计算；desc 效果；"""
new_head = """  /* ============================================================
   * 科技（24项 · 报告2.3b）
   * v89.231（老板「根据废土背景和现有兵种，建筑，调整科技体系」）：**术语换代** ——
   *   20 项更名（id/type 不动 → 老档与效果链零迁移；对照见 docs/废土术语映射表.md「科技体系」节）：
   *   练兵技巧→募兵整训 · 战斗技巧→战斗条令 · 打造技巧→锻造工艺 · 侦察技巧→侦察网络 ·
   *   防护技巧→装甲强化 · 负重技巧→载重优化 · 行军技巧→机动行军 · 抛射技巧→弹道校正 ·
   *   驾驭技巧→机车操控 · 建筑技术→废墟重建 · 储存技术→仓储扩容 · 补给技巧→生命维持 ·
   *   统帅能力→指挥链路 · 城防技术→防御工事 · 维修技术→再生技术 · 抢掠技巧→废墟搜刮 ·
   *   合成技巧→量产工艺 · 车轮技术→传动系统 · 机修技巧→座驾改装 · 研究技巧→逆向工程。
   *   资源四项（净化/栽培/蓄能/熔炼）v89.229 已换代，保持；cat 分组见 DATA.TECH_CATS。
   * lv 解锁的研习所等级；type 供计算；desc 效果；"""
assert s.count(old_head) == 1, 'head miss'
s = s.replace(old_head, new_head)
REPORT.append('[ok] 表头沿革段')

# ---------- ⑦ 两条 desc 微调 ----------
old_d1 = "'士兵生命 +3%/级（同战损下活下来的人更多）'"
new_d1 = "'我军生命 +3%/级（同战损下活下来的人更多）'"
c = s.count(old_d1)
assert c == 1, 'desc1 count=%d' % c
s = s.replace(old_d1, new_d1)
old_d2 = "'英雄指挥覆盖 +1%/级（更多士卒吃满英雄加成）'"
new_d2 = "'英雄指挥覆盖 +1%/级（更多部队吃满英雄加成）'"
c = s.count(old_d2)
assert c == 1, 'desc2 count=%d' % c
s = s.replace(old_d2, new_d2)
REPORT.append('[ok] desc 微调 ×2（士兵→我军 · 士卒→部队）')

# ---------- 写盘 ----------
assert len(s) > len(s_orig) - 100, 'sanity: size'
wr(P, s)
print('\n'.join(REPORT))
print('size: %d → %d' % (len(s_orig), len(s)))
