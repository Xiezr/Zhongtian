# -*- coding: utf-8 -*-
# v89.157 补丁 B：domain.js —— ① extSlotOrder 改"居中矩形逐圈扩张" ② 官府升级需城墙 ≥ 目标-2
import io
P = 'E:/Deepseekdb/js/domain.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

# ---------- ① extSlotOrder：居中矩形扩张 ----------
OLD1 = u"""  GAME.extSlotOrder = function () {
    var cols = DATA.EXT_COLS || 12, rows = DATA.EXT_ROWS || 8;
    var cr = (rows - 1) / 2, cc = (cols - 1) / 2;
    var TAU = Math.PI * 2;
    var out = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        /* 环内次序键 ang：以"正上"为 0、顺时针递增（0..2π）——
           atan2(dr, dc) 的正右为 0，+π/2 让正上归零；取模保持同环可比。 */
        var ang = (Math.atan2(r - cr, c - cc) + Math.PI / 2 + TAU) % TAU;
        out.push({ row: r, col: c,
          ring: Math.max(Math.abs(r - cr), Math.abs(c - cc)),
          ang: ang });
      }
    }
    out.sort(function (a, b) {
      if (a.ring !== b.ring) return a.ring - b.ring;
      if (Math.abs(a.ang - b.ang) > 1e-9) return a.ang - b.ang;
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
    return out;
  };"""
NEW1 = u"""  /* v89.142 立（中心扩散）→ **v89.157 改（老板「地块按建议」：居中矩形块）**
     ------------------------------------------------------------
     旧序 = 切比雪夫环 + 环内顺时针角 → 12 块时是"缺了左上角的 4×4 半环"（视觉偏）。
     新序 = **居中矩形逐圈扩张**：起步 = 网格中心 2×2（12×8 的中心 = 行 3~4 / 列 5~6），
     之后按「右列 → 下行 → 左列 → 上行」循环各补一整条边（矩形宽/高交替 +1）：
       4 → 6 → 9 → **12（= 4×3 居中矩形，官府 Lv1 首档）** → 16 → 20 → 25 → 30 → 36 →
       42 → 49 → 56 → 64 → 72 → 80 → 88 → 96（= 12×8 满）。
     官府逐级解锁数（12/15/18/…）都落在"整矩形"或"矩形 + 一条边的一部分"上，
     且矩形尺寸单调不减（暗格永远在外圈）。补边时**从边中点向两端**展开 ——
     部分解锁时左右/上下对称，不会"只长一半、偏在一边"。 */
  GAME.extSlotOrder = function () {
    var cols = DATA.EXT_COLS || 12, rows = DATA.EXT_ROWS || 8;
    var rr0 = Math.floor((rows - 1) / 2), cc0 = Math.floor((cols - 1) / 2);
    var rr1 = rr0 + 1, cc1 = cc0 + 1;               /* 中心 2×2 */
    var out = [];
    /* 线内次序：从该边中点向两端展开（轴 = 变化的那一维；轴心 = 当前矩形中心） */
    function orderLine(cells, axis) {
      var midH = (cc0 + cc1) / 2, midV = (rr0 + rr1) / 2;
      cells.sort(function (a, b) {
        var ka = axis === 'h' ? Math.abs(a.col - midH) : Math.abs(a.row - midV);
        var kb = axis === 'h' ? Math.abs(b.col - midH) : Math.abs(b.row - midV);
        if (ka !== kb) return ka - kb;
        return axis === 'h' ? (a.col - b.col) : (a.row - b.row);
      });
      cells.forEach(function (c) { out.push({ row: c.row, col: c.col }); });
    }
    out.push({ row: rr0, col: cc0 }, { row: rr0, col: cc1 },
             { row: rr1, col: cc0 }, { row: rr1, col: cc1 });
    var guard = 0;
    while ((rr0 > 0 || rr1 < rows - 1 || cc0 > 0 || cc1 < cols - 1) && guard++ < cols * rows) {
      var cells, i;
      if (cc1 < cols - 1) {                         /* 右列 */
        cc1++; cells = [];
        for (i = rr0; i <= rr1; i++) cells.push({ row: i, col: cc1 });
        orderLine(cells, 'v');
      }
      if (rr1 < rows - 1) {                         /* 下行 */
        rr1++; cells = [];
        for (i = cc0; i <= cc1; i++) cells.push({ row: rr1, col: i });
        orderLine(cells, 'h');
      }
      if (cc0 > 0) {                                /* 左列 */
        cc0--; cells = [];
        for (i = rr0; i <= rr1; i++) cells.push({ row: i, col: cc0 });
        orderLine(cells, 'v');
      }
      if (rr0 > 0) {                                /* 上行 */
        rr0--; cells = [];
        for (i = cc0; i <= cc1; i++) cells.push({ row: rr0, col: i });
        orderLine(cells, 'h');
      }
    }
    return out;
  };"""
if u'居中矩形逐圈扩张' in s:
    done.append('1 skip')
else:
    assert s.count(OLD1) == 1, 'B1 count=' + str(s.count(OLD1))
    s = s.replace(OLD1, NEW1)
    done.append('1 OK')

# ---------- ② buildPrereqOf：官府升级需城墙 ≥ 目标等级 − 2 ----------
ANCHOR2 = u"""    if (!list.length) return { ok: true, list: list };
    var parts = list.map(function (o) { return o.name + ' 需 Lv' + o.need + '（当前 Lv' + o.cur + '）'; });"""
NEW2 = u"""    /* v89.157（老板 3）：**城墙等级不能低于官府超过 2 级** ——
       升官府到 L（= next）要求城墙 ≥ L − 2（例：官府 3→4 需城墙 ≥ 2）。
       判据落在本函数 = 界面提示与内核拦截**同一把尺**（ui 读 pre.short / prereqText，
       upgradeAt 真拦），不另立第二出口。 */
    if (bid === 'guanfu') {
      var wl157 = GAME.buildingLevel(city, 'chengqiang');
      var nx157 = nextLv || (GAME.buildingLevel(city, 'guanfu') + 1);
      if (wl157 < nx157 - 2) {
        list.push({ bid: 'chengqiang', name: '城墙', need: nx157 - 2, cur: wl157, wallGate: true });
      }
    }
    if (!list.length) return { ok: true, list: list };
    var parts = list.map(function (o) { return o.name + ' 需 Lv' + o.need + '（当前 Lv' + o.cur + '）'; });"""
if u'wallGate: true' in s:
    done.append('2 skip')
else:
    assert s.count(ANCHOR2) == 1, 'B2 count=' + str(s.count(ANCHOR2))
    s = s.replace(ANCHOR2, NEW2)
    done.append('2 OK')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'GAME.extSlotOrder = function') == 1 and u'orderLine' in chk
assert chk.count(u'wallGate: true') == 1 and u"bid === 'guanfu'" in chk
assert chk.count(u'{') == s.count(u'{') and chk.count(u'}') == s.count(u'}')
print('patch B done:', done, 'len', orig, '->', len(s))
