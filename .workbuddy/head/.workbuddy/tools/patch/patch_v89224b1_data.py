# -*- coding: utf-8 -*-
"""v89.224b 结构补丁：建筑→基因实验室 · 实验室去播种化 · 血清/项目更名 · 种子体系退役。
锚点全部经 repr 逐字节核过。用法：DRY=1 预检 / 直接跑落盘。"""
import io, os, sys

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
LOG = []

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)

def rep(f, old, new, cnt=1):
    s = rd(f)
    c = s.count(old)
    assert c == cnt, '[%s] 锚点计数 %d != %d :: %r' % (f, c, cnt, old[:70])
    wr(f, s.replace(old, new))
    LOG.append('%s ×%d :: %s' % (f, cnt, old[:50].replace('\n', '⏎')))

def span(f, start, end, new, must_contain=None):
    s = rd(f)
    i = s.find(start); j = s.find(end, i + 1) if i >= 0 else -1
    assert i >= 0 and j > i, '[%s] span 锚点缺失 start=%r end=%r' % (f, start[:40], end[:40])
    if must_contain:
        assert must_contain in s[i:j], '[%s] span 体内未见 %r' % (f, must_contain[:40])
    wr(f, s[:i] + new + s[j:])
    LOG.append('%s span×1 :: %s … %s' % (f, start[:36], end[:30]))

# ================= data.js =================
rep('js/data.js', '交易站买卖 / 寄售 / 募兵提速 / 基因实验室', '交易站买卖 / 寄售 / 募兵提速')

rep('js/data.js',
    '       前置沿用酒馆 Lv3（原为"鸿胪寺主迎来送往"，现读作"开山收徒，须先有安置门人的酒馆"）。 */',
    '       前置沿用酒馆 Lv3。\n'
    '       v89.224（老板 1）：本建筑**改为基因实验室** —— 「现政务厅的基因实验室」的建筑载体\n'
    '       （实验室入口从政务厅要务段迁到本格）；显示名 / 图标 / 说明换新，「⚔️ 派系」入口保留在同格面板。 */')

rep('js/data.js', "id: 'honglusi', series: 'gov', name: '派系驻地', icon: '🗡️',",
    "id: 'honglusi', series: 'gov', name: '基因实验室', icon: '🧬',")
rep('js/data.js', "desc: '派系会所，议事论道 —— 加入派系、结交同道；五阶声望由派系任务累积。',",
    "desc: '旧世研究设施残存 —— 立项研发材料、调试基因序列；派系也在此聚议。',")

# 血清评论 + 4 血清道具 + 种子道具删除（墓碑）
rep('js/data.js',
    '    /* 药草（v73 · 基因实验室产）：把英雄资质**升一档**。药草与档位一一对应\n'
    '       （from → to），price 0 = 不进货架 —— 唯一来源是遗迹灵田，\n'
    '       高资质英雄因此从"酒馆直取"转向"养成"。 */',
    '    /* 血清（v73 · 基因实验室产；v89.224 更名）：把英雄资质**升一档**。血清与档位一一对应\n'
    '       （from → to），price 0 = 不进货架 —— 唯一来源是基因实验室的「基因调试」项目，\n'
    '       高资质英雄因此从"酒馆直取"转向"养成"。 */')
rep('js/data.js',
    "    { id: 'yunlingcao', name: '活性血清', type: 'rank_up', from: 'fan', to: 'liang', price: 0, desc: '英雄资质：凡品 → 良材（基因实验室产）' },\n"
    "    { id: 'xisuizhi', name: '强化血清', type: 'rank_up', from: 'liang', to: 'ying', price: 0, desc: '英雄资质：良材 → 英杰（基因实验室产）' },\n"
    "    { id: 'hualongshen', name: '跃迁血清', type: 'rank_up', from: 'ying', to: 'ming', price: 0, desc: '英雄资质：英杰 → 名世（基因实验室产）' },\n"
    "    { id: 'tianshouguo', name: '天选血清', type: 'rank_up', from: 'ming', to: 'tian', price: 0, desc: '英雄资质：名世 → 天授（基因实验室产）' },",
    "    { id: 'yunlingcao', name: '激活血清', type: 'rank_up', from: 'fan', to: 'liang', price: 0, desc: '英雄资质：凡人 → 突变体（基因调试 I 产物）' },\n"
    "    { id: 'xisuizhi', name: '蜕变血清', type: 'rank_up', from: 'liang', to: 'ying', price: 0, desc: '英雄资质：突变体 → 进化体（基因调试 II 产物）' },\n"
    "    { id: 'hualongshen', name: '觉醒血清', type: 'rank_up', from: 'ying', to: 'ming', price: 0, desc: '英雄资质：进化体 → 觉醒体（基因调试 III 产物）' },\n"
    "    { id: 'tianshouguo', name: '天启血清', type: 'rank_up', from: 'ming', to: 'tian', price: 0, desc: '英雄资质：觉醒体 → 天启体（基因调试 IV 产物）' },")

span('js/data.js',
     "    /* v78（老板需求 1）：**种子** —— 基因实验室专用。",
     "    /* 座驾 */",
     "    /* ⛔ v89.224（老板 2：「不要播种 / 种子」）：种子体系**整体退役** ——\n"
     "       5 种种子道具、DATA.SEED_DROP 掉落表、播种动作与游商「种子」货架一并删除；\n"
     "       实验室改「立项研发」（见 DATA.FARM），老档背包里的种子由 adoptState 清出。 */\n",
     must_contain='seed_tianshou')

# FARM 块重写
span('js/data.js',
     "  /* ============================================================\n   * 基因实验室（v73 · 老板需求 3）",
     "  DATA.FARM_CROP_BY_ID = {};",
     "  /* ============================================================\n"
     "   * 基因实验室（v73 · 老板需求 3；v89.224 去播种化）\n"
     "   * ------------------------------------------------------------\n"
     "   * v89.224（老板 2）：「不要播种 / 种子」—— 六座培养舱直接**立项研发**：\n"
     "   *   立项（不消耗道具）→ 游戏时间研发 → 提取产物。\n"
     "   *        ├─ 材料研发 ×6 → 3 阶主产（有机率出 4 阶）→ 锻造间打造\n"
     "   *        └─ 基因调试 ×4 → 激活 / 蜕变 / 觉醒 / 天启血清 → 英雄资质逐档提升\n"
     "   *\n"
     "   * 数值全表化（加项目 = 加一行；调时长只改本表）：\n"
     "   *   · hours = **游戏小时**（吃时间倍率，与建造 / 研究同一把尺）\n"
     "   *   · mat   = 3 阶主产材料 + 产出区间 qty；rare / rareP = 4 阶副产与几率\n"
     "   *   · herb  = 基因调试项目：得 1 支对应血清（道具 id 与项目 id 同名）\n"
     "   *   ⚠ 字段名沿用 crops（历史 id 不动，语义 = 研发项目）。\n"
     "   * ============================================================ */\n"
     "  DATA.FARM = {\n"
     "    plots: 6,\n"
     "    crops: [\n"
     "      { id: 'tieying',     name: '铁系熔炼', icon: '⚙️', hours: 6,  mat: 'bintie',  rare: 'yuntie',  rareP: 0.15, qty: [2, 4], desc: '回收钢铁重熔精炼 —— 得钢锭，偶出陨铁' },\n"
     "      { id: 'tanxiangshu', name: '木质改性', icon: '🪵', hours: 6,  mat: 'tanmu',   rare: 'jianmu',  rareP: 0.15, qty: [2, 4], desc: '旧木浸渍改性 —— 得铁木，偶出复合材' },\n"
     "      { id: 'xipiteng',    name: '皮层再生', icon: '🧫', hours: 6,  mat: 'xige',    rare: 'jiaoge',  rareP: 0.15, qty: [2, 4], desc: '生物皮层再生培养 —— 得硬甲皮，偶出变异皮' },\n"
     "      { id: 'jiaojinteng', name: '肌腱培育', icon: '🦴', hours: 6,  mat: 'jiaojin', rare: 'longjin', rareP: 0.15, qty: [2, 4], desc: '肌腱纤维培育 —— 得巨兽筋，偶出泰坦筋' },\n"
     "      { id: 'yusuihua',    name: '晶体重构', icon: '💎', hours: 6,  mat: 'yangzhi', rare: 'kunshan', rareP: 0.15, qty: [2, 4], desc: '硅晶重构 —— 得羊脂玉，偶出昆山玉' },\n"
     "      { id: 'yunjinsang',  name: '纤维合成', icon: '🧵', hours: 6,  mat: 'shujin',  rare: 'yunjin',  rareP: 0.15, qty: [2, 4], desc: '高分子纤维合成 —— 得织锦，偶出云缎' },\n"
     "      { id: 'yunlingcao',  name: '基因调试 I',   icon: '🧪', hours: 12, herb: 'yunlingcao',  desc: '基础序列调试 —— 得 激活血清（凡人 → 突变体）' },\n"
     "      { id: 'xisuizhi',    name: '基因调试 II',  icon: '⚗️', hours: 24, herb: 'xisuizhi',    desc: '序列强化调试 —— 得 蜕变血清（突变体 → 进化体）' },\n"
     "      { id: 'hualongshen', name: '基因调试 III', icon: '🧬', hours: 48, herb: 'hualongshen', desc: '序列重组调试 —— 得 觉醒血清（进化体 → 觉醒体）' },\n"
     "      { id: 'tianshouguo', name: '基因调试 IV',  icon: '☢️', hours: 96, herb: 'tianshouguo', desc: '终极序列调试 —— 得 天启血清（觉醒体 → 天启体）' },\n"
     "    ],\n"
     "  };\n",
     must_contain='tianshouguo')

# SEED_DROP 删除（墓碑）+ ESSENCE_DROP 加 cityLv
span('js/data.js',
     "  /* v78（老板需求 1）：种子掉落表 —— **唯一出口** GAME.grantSeedDrop。",
     "  /* v89.51（老板「物品的产生和消耗路径打通」）：辐能核心掉落表",
     "  /* ⛔ v89.224：DATA.SEED_DROP 退役（种子体系删除）。\n"
     "     原表里的 cityLv（城池档 → 来源等级折算）随迁 DATA.ESSENCE_DROP —— 辐能核心\n"
     "     掉落仍在用这个口径，别丢。 */\n\n",
     must_contain='seed_tianshou')
rep('js/data.js',
    "  DATA.ESSENCE_DROP = {\n    battleMult: 0.6,    /* 战事结算折扣（采集是主渠道） */\n    base: 0.30,\n    perLv: 0.02,\n    qty: [1, 2],\n  };",
    "  DATA.ESSENCE_DROP = {\n    battleMult: 0.6,    /* 战事结算折扣（采集是主渠道） */\n    base: 0.30,\n    perLv: 0.02,\n    qty: [1, 2],\n    /* v89.224：城池档 → 来源等级折算（随 SEED_DROP 退役迁入；缴获结算在用） */\n    cityLv: { fort: 4, county: 3, jun: 5, zhou: 7, capital: 9 },\n  };")

# data.js 其余注释
rep('js/data.js',
    '     v82 那套「凡品开局 + 药草逐档升」对**君主**退役；药草仍可用于其余英雄，',
    '     v82 那套「凡人开局 + 血清逐档升」对**君主**退役；血清仍可用于其余英雄，')
rep('js/data.js', '`ascend` = 药草升档时四维**各加**的点数', '`ascend` = 血清升档时四维**各加**的点数')
rep('js/data.js', '（「低资质英雄通过药草提升资质时，能比直接招募获得额外提升」）——', '（「低资质英雄通过血清提升资质时，能比直接招募获得额外提升」）——')
rep('js/data.js', '高资质英雄从此以**基因实验室药草养成**为主路（见 DATA.FARM）。', '高资质英雄从此以**基因实验室血清养成**为主路（见 DATA.FARM）。')
rep('js/data.js', '（药草 / 辐能核心）无购买价 → 不可寄售', '（血清 / 辐能核心）无购买价 → 不可寄售')

print('[b-struct] data.js 完成，共 %d 处' % len(LOG))
for l in LOG: print('  ' + l)
