# v89181a 补丁：虎豹骑"稍微加强"（hp 4800→5400 / def 250→280）+ 表头注释 + perHp 注释修正
import io

P = 'E:/Deepseekdb/'
def read(p):
    return io.open(P + p, 'r', encoding='utf-8', newline='').read()
def write(p, s):
    io.open(P + p, 'w', encoding='utf-8', newline='').write(s)
def rep(tag, s, old, new, cnt=1):
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    return s.replace(old, new)

# ============================================================
# 1. data.js —— 虎豹数值 + 表头注释
# ============================================================
s = read('js/data.js')

s = rep('D1 虎豹行', s,
    "    hubaoqi: { id: 'hubaoqi', cat: 'cav', name: '虎豹骑', ab: '虎', icon: '🪓', hp: 4800, atk: 510, def: 250, range: 70, spd: 850, gather: 10, load: 150, pop: 3, time: 70, cost: { grain: 4500, wood: 800, iron: 1200 }, unlock: { junying: 9, shuyuan: 8, majiu: 4, city: 'sili', tech: { tongshuai: 9, lianbing: 7 } }, desc: '曹魏精锐骑兵' },",
    "    hubaoqi: { id: 'hubaoqi', cat: 'cav', name: '虎豹骑', ab: '虎', icon: '🪓', hp: 5400, atk: 510, def: 280, range: 70, spd: 850, gather: 10, load: 150, pop: 3, time: 70, cost: { grain: 4500, wood: 800, iron: 1200 }, unlock: { junying: 9, shuyuan: 8, majiu: 4, city: 'sili', tech: { tongshuai: 9, lianbing: 7 } }, desc: '曹魏精锐骑兵' },")

# 表头注释（插在 v89.180 拆械注释之后、DATA.TROOPS = { 之前）
anchor = "  DATA.TROOPS = {\n    minfu:"
note = """  /* ============================================================
   * v89.181（老板「2.虎豹稍微加强」）：**虎豹骑血防 +12%**
   * ------------------------------------------------------------
   * 标定（probe_v89180f · 同人口 4000 矩阵 · 双向真跑）：
   *   hp 4800→5400（+12.5%）· def 250→280（+12%）——「稍微」档，效果：
   *   · vs 轻骑（同人口）：损 67%（惨胜）→ **50%**（稳胜）；
   *   · vs 铁骑 / 西凉（同人口）：仍负，但铁骑损 34%→42%、西凉损 23%→29%
   *     （对"上位高级骑"保持秩序，不喧宾；反超铁骑需 +50% 以上，远超"稍微"）；
   *   · vs 突骑 / 长枪：胜且更轻松（我损 20% / 23%）。
   * 每万人口：总血 1599.8万→1799.8万 · 总防 83.3万→93.3万（老板「总攻防」口径）。
   * ⚠️ 口径修正（v89.181）：v89.180 报告曾称"虎豹 vs 轻骑同人口完全平手"——实为**误读**：
   *   引擎行动序 = 速度序（轻骑 1000 恒先动），交换攻守标签后的两局是**同一场战斗的镜像**
   *   （数字天然一致）；正确读法 = **两局胜者都是虎豹**（轻骑全灭、虎豹损 67%）。
   *   本加强的语境 = "惨胜 → 稳胜"，不是"平手 → 小优"。
   * ============================================================ */
  DATA.TROOPS = {
    minfu:"""
s = rep('D2 表头注释', s, anchor, note)

write('js/data.js', s)
print('data.js OK')

# ============================================================
# 2. tactic.js —— perHp 注释修正（与实现一致：hpPer = t.hp 直读）
# ============================================================
s = read('js/tactic.js')
s = rep('T1 perHp 注释', s,
    """     v89.96：兵种生命本身 ×10（源头耐久标定，见 data.js TROOPS 注释）。 */""",
    """     v89.96：耐久标定（原值 ×6）已并入表值 —— `hpPer = t.hp` 直读（见 data.js
     TROOPS 注释）；本函数只叠科技（TB('hp')）与将领（hpMult）加成。
     ⚠️ v89.181 修正注释：原文写"×10"，与实现（unitsInit 的 `hpPer: t.hp`）不符 ——
     实测链 表 hp=1800 → hpPer=1800 → perHp=1800（无加成），见 probe_v89180e。 */""")
write('js/tactic.js', s)
print('tactic.js OK')
print('ALL DONE')
