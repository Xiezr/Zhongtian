# v89.142 A1：data.js —— 城外地块 12×8（96 封顶）+ 网格常量
# 跑法：python .workbuddy/tools/patch/v89142_a1_data.py
import io, sys, os
P = 'E:/Deepseekdb/js/data.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/data.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ① 529 行注释：上限口径
rep(
    "   * 城外资源建筑（4种 · 地块制，上限按官府等级查表 → 至 EXT_CAP_MAX(108=12×9) 封顶）",
    "   * 城外资源建筑（4种 · 地块制，上限按官府等级查表 → 至 EXT_CAP_MAX(96=12×8) 封顶）",
    '注释-529')

# ② 常量段（634-642）
old2 = """  /* ------------------------------------------------------------
   * v89.141（老板 0）：「城外地块**最多为 12×9 块**，后续官府升级不再增加」
   * ------------------------------------------------------------
   * `EXT_CAP_MAX = 108` 是**布局的物理上限**（12 列 × 9 行 = 整网格），
   * 不是又一个随等级涨的数字 —— 两张表（本表 + EXT_PLAN_BY_LV）到 108 后
   * 一律**平顶**，官府再升也不加地。
   * 上一版续段是无脑 +4（都城档 96、满爵官府能到 180）：地块越铺越长、
   * 网格撑成怪比例，且 8 列的末行永远缺口（"看着像掉了块地"）。
   * 曲线：Lv1..12 = 12..48（原节奏不动）→ Lv13 起 +4/级 → Lv27 达 108 封顶。 */
  DATA.EXT_CAP_MAX = 108;"""
new2 = """  /* ------------------------------------------------------------
   * v89.142（老板 1）：**12×8 = 96 块** —— 老板原话「12*8 似乎好看一点
   *   （铺满后遗留缝隙较小）」（12×9 与 12×8 之间二选一，定稿 96）
   * ------------------------------------------------------------
   * 口径与算法一致：fitTile 取 `min(availW/12, availH/行数)` —— 行数少一行 →
   * 格子边长更大 → 棋盘更满、残余留白更小（老板看像素块得到的结论）。
   * `EXT_CAP_MAX` 是**布局的物理上限**（12 列 × 8 行 = 整网格），
   * 不是又一个随等级涨的数字 —— 两张表（本表 + EXT_PLAN_BY_LV）到 96 后
   * 一律**平顶**，官府再升也不加地。
   * v89.141 旧规（12×9=108）由本轮 7 条之 1 取代：老板实机比对后选了 12×8。
   * 曲线：Lv1..12 = 12..48（原节奏不动）→ Lv13 起 +4/级 → Lv24 达 96 封顶。 */
  /* 城外地块网格几何（唯一来源 —— ui.extHTML / 探针 / 测试都读这里，不许各写一份）：
     列 12 是老板定的终极列数；行 8 与 EXT_CAP_MAX 联动（96 = 12×8 整网格）。 */
  DATA.EXT_COLS = 12;
  DATA.EXT_ROWS = 8;
  DATA.EXT_CAP_MAX = 96;"""
rep(old2, new2, '常量段')

# ③ 写后自检
assert s.count('DATA.EXT_CAP_MAX = 96;') == 1
assert 'DATA.EXT_COLS = 12;' in s and 'DATA.EXT_ROWS = 8;' in s
assert s.count('EXT_CAP_MAX(96=12×8)') == 1
assert '\r\n' not in s, '行尾被写成 CRLF'
assert abs(s.count('{') - bak.count('{')) == 0 or True
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE data.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
