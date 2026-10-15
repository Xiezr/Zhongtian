# -*- coding: utf-8 -*-
"""v89.131 补丁 A：data.js
1) 新增 DATA.ENERGY（精力上限公式：基准 + 六维加权）
2) DATA.GEN_COST：staPerHour/enePerHour 退役 → recoverHours: 24（现实小时 · 百分比回复）
3) 新增 4 档精力道具（type 'energy'，与体力族同构；清心丸修复悬空引用）
用法：python patch_v89131a_data.py
"""
import io, sys

P = 'E:/Deepseekdb/js/data.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    c = s.count(old)
    assert c == 1, '[%s] 锚点 %d 处（需 1）' % (tag, c)
    s = s.replace(old, new)
    n += 1
    print('  OK ' + tag)


# ---------- ① DATA.ENERGY（插在 DATA.STAMINA 定义之后） ----------
anchor1 = """  DATA.GEN_RANK_BY_ID = {};"""
new1 = """  /* ============================================================
   * 精力上限（v89.131 · 老板「精力的数值设定基于六维设计一个公式」）
   * ------------------------------------------------------------
   * 精力是"统筹调度"的资源（远征/计略/游历都烧它），所以上限由**六维**派生：
   *
   *     精力上限 = base + 统帅×per.tong + 勇武×per.yw + 智谋×per.zm
   *                     + 内政×per.nz + 速度×per.spd + 体力上限×per.sta
   *
   * 权重设计的来由（探针 probe_v89131_energy_domain.js 实测数值域）：
   *   · 智谋（0.5）权重最高 —— 运筹帷幄最耗心力，与它已承担的"研究/城防"角色同族；
   *   · 统帅 / 勇武 / 内政（各 0.25）次之；速度（0.5）体现"奔波"的体力开销；
   *   · 第六维"体力上限"（0.03）贡献最小 —— 它是 161~2245 的大数池，
   *     只取零头才不会被它一项吃满（否则精力变成体力的复制品）。
   * 数值域（实测）：开局基准将 ≈104 · 凡品 Lv60 ≈102 · 良材 Lv100 ≈133 ·
   *   英杰 Lv140 ≈168 · 名世 Lv180 ≈215 · 天授 Lv240 ≈288。
   * 消耗侧（同轮取证）：远征 5~9 · 计略 8~18 · 游历 6~20 —— 高低资质差 2.8 倍，
   *   与"名将能连轴转、新兵跑两趟就得歇"的设计意图一致。
   * ⚠️ 所有数值只在本表调（唯一来源）；上限出口 = GAME.energyMaxOf（domain.js）。
   * ============================================================ */
  DATA.ENERGY = {
    base: 40,
    per: { tong: 0.25, yw: 0.25, zm: 0.5, nz: 0.25, spd: 0.5, sta: 0.03 },
  };

  DATA.GEN_RANK_BY_ID = {};"""
rep(anchor1, new1, 'DATA.ENERGY 新表')

# ---------- ② GEN_COST：回复口径改现实时间百分比 ----------
old2 = """    staPerHour: 3,         // 每游戏小时恢复体力
    enePerHour: 2,         // 每游戏小时恢复精力"""
new2 = """    /* v89.131（老板「体力精力应随现实时间百分比回复，按现实时间24h可恢复满值设计速率」）：
       `staPerHour/enePerHour`（游戏小时 · 固定点数）退役 —— 固定点数在 600× 下
       = 每现实小时回 1800 点（小池子几十秒满、大池子按比例失衡）；
       改为**百分比口径**：满值 = 100%，24 现实小时回满 → 速率 = 上限 ÷ 86400 /秒。
       好处：① 与倍速解耦（任何倍速下都是"一天养满一个将"）；
             ② 大小池子同体验（新兵与天授都是 24h 一循环）；
             ③ 道具（体力族 14 档 / 精力族 4 档）成为"加速的快捷车道"。
       实现在 state.js 两处（在线 tickOnce / 离线 simulateBulk），数值只改这里。 */
    recoverHours: 24,      // 满回复所需**现实小时**（体力与精力同一口径）"""
rep(old2, new2, 'GEN_COST 回复口径')

# ---------- ③ 4 档精力道具（插在体力族 还魂露 之后） ----------
old3 = """    { id: 'huanhun_lu', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '还魂露', type: 'stamina', amount: 0.95, price: 70, desc: '恢复将领体力95%' },"""
new3 = """    { id: 'huanhun_lu', noShop: true, /* v89.104：商城下架（族内已有 4 档） */ name: '还魂露', type: 'stamina', amount: 0.95, price: 70, desc: '恢复将领体力95%' },
    /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）：
       **精力族**（type 'energy'）—— 此前精力只有自然回复，一点道具都没有；
       而 battle/state/ui 里四处"精力不足…可服**清心丸**"的提示**引用了不存在的道具**
       （悬空引用，v89.121 'chest' 同族）。本批一次补齐 4 档（v89.104 每族 ≤4 档）：
       清心丸（20%，正是提示里点名的那个）→ 提神散 → 养神丹 → 凝神玉露（100%）。
       价格与体力族同锚（约 0.6~0.8 金/%）：小档便宜跑量，大档贵在"关键时刻一键满"。 */
    { id: 'qingxin_wan', name: '清心丸', type: 'energy', amount: 0.2, price: 12, desc: '恢复将领精力20%' },
    { id: 'tishen_san', name: '提神散', type: 'energy', amount: 0.4, price: 24, desc: '恢复将领精力40%' },
    { id: 'yangshen_dan', name: '养神丹', type: 'energy', amount: 0.7, price: 48, desc: '恢复将领精力70%' },
    { id: 'ningshen_yulu', name: '凝神玉露', type: 'energy', amount: 1.0, price: 80, desc: '恢复将领精力100%' },"""
rep(old3, new3, '精力道具 4 档')

# ---------- 写前自检 ----------
assert s != orig and n == 3, '替换数 %d' % n
assert "DATA.ENERGY = {" in s and "recoverHours: 24" in s
assert "qingxin_wan" in s and "type: 'energy'" in s
assert s.count("staPerHour:") == 0, '旧字段残留（含墓碑注释）'
assert s.count("enePerHour:") == 0, '旧字段残留（含墓碑注释）'
assert (s.count('{') - s.count('}')) == (orig.count('{') - orig.count('}')), '花括号盈亏被改变'
assert (s.count('(') - s.count(')')) == (orig.count('(') - orig.count(')')), '圆括号盈亏被改变'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch A(data) OK · %d 处（LF 保持）' % n)
