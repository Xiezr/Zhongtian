# v89.142 A2：domain.js —— extCap 注释/兜底 + 新增 extSlotOrder（中心扩散序，唯一出口）
# 跑法：python .workbuddy/tools/patch/v89142_a2_domain.py
import io
P = 'E:/Deepseekdb/js/domain.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/domain.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ① extCap 注释与兜底
rep(
    """    /* v24（需求 7）：按官府等级查表。
       v89.141（老板 0）：「城外地块最多为 12×9 块，后续官府升级不再增加」——
       表在 DATA.EXT_CAP_MAX(108) 平顶（约官府 Lv27 到顶），此后官府再升不加地。 */
    var t = DATA.EXT_CAP_BY_LV || [];
    var n = t[Math.max(0, Math.min(lv - 1, t.length - 1))];
    return n != null ? n : Math.min(DATA.EXT_CAP_MAX || 108, 12 + (lv - 1) * 3);""",
    """    /* v24（需求 7）：按官府等级查表。
       v89.142（老板 1）：上限定稿 **12×8 = 96**（老板实机比对：「12*8 似乎好看一点」）——
       表在 DATA.EXT_CAP_MAX(96) 平顶（约官府 Lv24 到顶），此后官府再升不加地。 */
    var t = DATA.EXT_CAP_BY_LV || [];
    var n = t[Math.max(0, Math.min(lv - 1, t.length - 1))];
    return n != null ? n : Math.min(DATA.EXT_CAP_MAX || 96, 12 + (lv - 1) * 3);""",
    'extCap')

# ② 新增 extSlotOrder（插在 ensureExtGrid 之后）
old_ins = """  /* 外城地块全境统计（多城经营展示用）：返回 { towns, used, cap, byType, maxLv } */"""
new_ins = """  /* ============================================================
   * v89.142（老板 1）：「设置新增地块的形成顺序，尽量从界面中间向周边新增，尽量有序」
   * ------------------------------------------------------------
   * **地块落位的唯一出口**（界面渲染 / 探针 / 断言都读它，不许各排一份）：
   *   返回 `[rows × cols]` 个 `{row, col}` 位置，第 k 项 = 第 k 个地块该放哪。
   * 顺序 = 以棋盘中心为起点的**同心环扩散**：
   *   ① 先中心 2×2（12 列 × 8 行时中心恰是 2×2 —— 偶数网格，天然四格对称）；
   *   ② 再一圈一圈向外；环内"离中心更近者先"（曼哈顿距离），再按行、列
   *      （从上到下、从左到右）—— 同一环内的生成次序永远一致。
   * 也就是说：官府每升一级新增的地块，总是贴着已有地块从**中间向周边**长；
   * 序号（存档里的第 k 块）与视觉位置稳定绑定 —— 升级只多不长乱。
   * ============================================================ */
  GAME.extSlotOrder = function () {
    var cols = DATA.EXT_COLS || 12, rows = DATA.EXT_ROWS || 8;
    var cr = (rows - 1) / 2, cc = (cols - 1) / 2;
    var out = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        out.push({ row: r, col: c,
          ring: Math.max(Math.abs(r - cr), Math.abs(c - cc)),
          md: Math.abs(r - cr) + Math.abs(c - cc) });
      }
    }
    out.sort(function (a, b) {
      if (a.ring !== b.ring) return a.ring - b.ring;
      if (a.md !== b.md) return a.md - b.md;
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    return out;
  };

  /* 外城地块全境统计（多城经营展示用）：返回 { towns, used, cap, byType, maxLv } */"""
rep(old_ins, new_ins, 'extSlotOrder')

# ③ 自检 + 落盘
assert s.count('GAME.extSlotOrder = function ()') == 1
assert s.count('DATA.EXT_CAP_MAX || 96') == 1
assert 'DATA.EXT_CAP_MAX || 108' not in s, '旧兜底 108 残留'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE domain.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
