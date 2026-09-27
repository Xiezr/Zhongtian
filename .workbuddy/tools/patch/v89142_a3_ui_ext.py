# v89.142 A3：ui.js —— 城外地块固定 12×8 棋盘 + 中心扩散落位 + 未解锁暗格
# 跑法：python .workbuddy/tools/patch/v89142_a3_ui_ext.py
import io
P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/ui.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

old = """    /* v89.141（老板 0）：「城外地块最多为 12×9 块」——**12 列**是老板指定的终极网格
       （108 = 12×9 整整）；8 列时代 96 块要 12 行（高度爆掉）、且 Lv1=12 块时末行缺口
       看着像"掉了块地"。12 列下：Lv1（12 块）= 1 整行、都城档 96 = 8 整行、
       满 108 = 9 整行，永不缺口。fitBoard 按窗口自适应格子边长（≥40px 下限）。 */
    var COLS = 12;
    var ROWS = Math.max(1, Math.ceil(grid.length / COLS));
    ui.fitBoard(COLS, ROWS);              /* v27：按窗口算格子边长 */
    var M = ui.isoMetrics(COLS, ROWS);
    /* v24（需求 7）：末行不满时**水平居中**。
       左对齐的末行会让人以为"这里还缺几块地"，居中后一眼看出是刻意的排布。 */
    var lastRowN = grid.length - (ROWS - 1) * COLS;
    var colOff = lastRowN < COLS ? (COLS - lastRowN) / 2 : 0;
    var cells = grid.map(function (e, idx) {
      var col = idx % COLS, row = Math.floor(idx / COLS);
      if (row === ROWS - 1) col += colOff;
      if (e.pending) {"""

new = """    /* v89.142（老板 1）：棋盘固定 **12×8**（96 = 整网格；几何常量唯一来源 = DATA.EXT_COLS/ROWS），
       地块落位走 GAME.extSlotOrder（**中心扩散螺旋**）—— 新增地块总是从界面中间长出来、
       向周边有序扩散；尚未解锁的位置画**暗格**（将来会长到这里）。
       画布与格子尺寸恒定：官府升级只多"亮"几格，版式不跳、行列不折。 */
    var COLS = DATA.EXT_COLS || 12, ROWS = DATA.EXT_ROWS || 8;
    ui.fitBoard(COLS, ROWS);              /* v27：按窗口算格子边长 */
    var M = ui.isoMetrics(COLS, ROWS);
    var order = GAME.extSlotOrder ? GAME.extSlotOrder() : null;
    var cells = grid.map(function (e, idx) {
      var slot = order ? order[idx] : { col: idx % COLS, row: Math.floor(idx / COLS) };
      var col = slot.col, row = slot.row;
      if (e.pending) {"""
rep(old, new, 'extHTML-头')

old2 = """        lvl: e.lv, lvlMax: e.lv >= 10,
      });
    }).join('');
    var board = ui.isoBoard(COLS, ROWS, cells, {});"""
new2 = """        lvl: e.lv, lvlMax: e.lv >= 10,
      });
    }).join('') + (order ? order.slice(grid.length).map(function (slot) {
      /* 未解锁暗格：不占交互（点了给解锁提示），只是"预留位"的视觉表达 */
      var nxLv = GAME.extNextLvOf ? GAME.extNextLvOf(c) : 0;
      return '<div class="iso-tile locked" data-action="ext-locked" style="left:' +
        Math.round(M.x(slot.col, slot.row)) + 'px;top:' + Math.round(M.y(slot.col, slot.row)) +
        'px;width:' + M.W + 'px;height:' + M.H + 'px;" title="' +
        (nxLv ? '官府 Lv' + nxLv + ' 可解锁更多地块' : '地块已至上限（96 = 12×8 满）') +
        '"><i class="tile-face"></i></div>';
    }).join('') : '');
    var board = ui.isoBoard(COLS, ROWS, cells, {});"""
rep(old2, new2, 'extHTML-尾')

# 自检 + 落盘
assert s.count('var order = GAME.extSlotOrder ? GAME.extSlotOrder() : null;') == 1
assert s.count("data-action=\"ext-locked\"") == 1
assert 'lastRowN' not in s, '旧末行居中逻辑残留'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE ui.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
