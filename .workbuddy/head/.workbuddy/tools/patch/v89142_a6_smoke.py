# v89.142 A6：smoke-test.js —— 升级 12×9 旧断言到 12×8（含"末行居中"退役重写）
# 跑法：python .workbuddy/tools/patch/v89142_a6_smoke.py
import io
P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89142/smoke-test.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ① 5733：12 列 → 12×8 常量唯一来源
rep(
    """  /* v89.141（老板 0）：8 列 → **12 列**（108 = 12×9 整网格；8 列下 96 块要 12 行，高度爆掉） */
  check('城外 12 列（Lv1=12 块 1 整行 · 96 块 8 整行 · 满 108 块 9 整行）', /var COLS = 12;/.test(uS33));""",
    """  /* v89.142（老板 1）：棋盘固定 **12 列 × 8 行 = 96**（整网格）——
     几何常量唯一来源 = DATA.EXT_COLS / DATA.EXT_ROWS（界面不许各写一份）。 */
  check('城外棋盘 12×8（96 整网格 · 常量唯一来源 DATA.EXT_COLS/ROWS）',
    /var COLS = DATA\\.EXT_COLS \\|\\| 12, ROWS = DATA\\.EXT_ROWS \\|\\| 8;/.test(uS33)
    && DATA.EXT_COLS === 12 && DATA.EXT_ROWS === 8
    && DATA.EXT_COLS * DATA.EXT_ROWS === DATA.EXT_CAP_MAX);""",
    '①12列')

# ② 6556：征收上限表（96 封顶 + 两表联动）
rep(
    """  check('征收上限表按官府等级（10 级 = 40 块，12 级 = 48 块，之后 +4/级至 108 封顶）',
    JSON.stringify(DATA.EXT_CAP_BY_LV.slice(0, 10)) === JSON.stringify([12, 15, 18, 21, 24, 27, 30, 33, 36, 40])
    && DATA.EXT_CAP_BY_LV[11] === 48
    /* v54：官府在名城能盖更高，表跟着长到 MAX_LEVEL_ABS
       v89.141（老板 0）：「城外地块最多为 12×9 块，后续官府升级不再增加」——
       末项 = EXT_CAP_MAX(108) 平顶（Lv27 到顶），不再是无脑 +4 公式。 */
    && DATA.EXT_CAP_BY_LV.length === DATA.MAX_LEVEL_ABS
    && DATA.EXT_CAP_BY_LV[25] === 104 && DATA.EXT_CAP_BY_LV[26] === 108
    && DATA.EXT_CAP_BY_LV[DATA.MAX_LEVEL_ABS - 1] === DATA.EXT_CAP_MAX
    && DATA.EXT_CAP_MAX === 108);
  check('实测：官府 Lv10 城外上限 40（8 列正好 5 整行）', (function () {
    var c = G.state.cities[0], bk = G.buildingLevel(c, 'guanfu');
    c.cells.forEach(function (x) { if (x.official) x.build.lvl = 10; });
    var n = G.extCap(c);
    c.cells.forEach(function (x) { if (x.official) x.build.lvl = bk || 1; });
    return n === 40 && n % 8 === 0;
  })());""",
    """  check('征收上限表按官府等级（10 级 = 40 块，12 级 = 48 块，之后 +4/级至 96 封顶）',
    JSON.stringify(DATA.EXT_CAP_BY_LV.slice(0, 10)) === JSON.stringify([12, 15, 18, 21, 24, 27, 30, 33, 36, 40])
    && DATA.EXT_CAP_BY_LV[11] === 48
    /* v54：官府在名城能盖更高，表跟着长到 MAX_LEVEL_ABS
       v89.142（老板 1）：上限定稿 **12×8 = 96** —— 末项 = EXT_CAP_MAX(96) 平顶
       （Lv24 到顶），不再是无脑 +4 公式。 */
    && DATA.EXT_CAP_BY_LV.length === DATA.MAX_LEVEL_ABS
    && DATA.EXT_CAP_BY_LV[22] === 92 && DATA.EXT_CAP_BY_LV[23] === 96
    && DATA.EXT_CAP_BY_LV[DATA.MAX_LEVEL_ABS - 1] === DATA.EXT_CAP_MAX
    && DATA.EXT_CAP_MAX === 96
    /* 两表联动：任一级"满建筑"合计 = 该级上限（一块不空、一块不多），且不超 96 */
    && (function () {
      for (var lv142 = 1; lv142 <= DATA.MAX_LEVEL_ABS; lv142++) {
        var row142 = DATA.EXT_PLAN_BY_LV[lv142 - 1];
        var sum142 = 0;
        for (var i142 = 0; i142 < row142.length; i142++) sum142 += row142[i142];
        if (sum142 !== DATA.EXT_CAP_BY_LV[lv142 - 1] || sum142 > DATA.EXT_CAP_MAX) return false;
      }
      return true;
    })());
  check('实测：官府 Lv10 上限 40 / Lv24 达 96（12×8 整网格封顶 · 再升不加地）', (function () {
    var c = G.state.cities[0], bk = G.buildingLevel(c, 'guanfu');
    function setLv142(n) { c.cells.forEach(function (x) { if (x.official) x.build.lvl = n; }); }
    setLv142(10); var n10142 = G.extCap(c);
    setLv142(24); var n24142 = G.extCap(c);
    setLv142(30); var n30142 = G.extCap(c);       /* 官府再升不加地（平顶） */
    setLv142(bk || 1);
    return n10142 === 40 && n24142 === 96 && n30142 === 96
      && n24142 === DATA.EXT_COLS * DATA.EXT_ROWS;
  })());""",
    '②征收上限表')

# ③ 6592-6611：末行居中 → 中心扩散 + 暗格（重写）
rep(
    """  /* ---- 需求 7：城外地块末行居中 ---- */
  console.log('  --- ⑦ 城外地块补足与居中 ---');
  check('城外棋盘末行水平居中（不满一行时不再左挤）',
    /var colOff = lastRowN < COLS \\? \\(COLS - lastRowN\\) \\/ 2 : 0;/.test(uS37));
  /* v89.141：12 列下 Lv1（12 块）= 1 整行、无偏移 —— 改用 **Lv2 = 15 块**
     （1 整行 + 3 格，末行居中偏移 (12-3)/2 = 4.5 格）来验证居中逻辑。 */
  check('实测：15 块时末行 3 格右移 4.5 格居中（12 列 · Lv2=15 块）', (function () {
    var st = G.state, bkId = G.ui._cityId;
    var tmp = G.makeCity({ id: 'tmpExtCap', name: 'tmpExt', col: 6, row: 6 });
    st.cities.push(tmp);
    /* 官府抬到 2 级 → 上限 15 块 */
    tmp.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 2; });
    G.ui._cityId = tmp.id;
    var html = G.ui.extHTML();
    G.ui._cityId = bkId;
    st.cities.pop();
    var M = G.ui.isoMetrics(12, 2);
    var want = 'left:' + Math.round(M.x(4.5, 1)) + 'px;top:' + Math.round(M.y(4.5, 1)) + 'px';
    return tmp.extGrid.length === 15 && html.indexOf(want) >= 0;
  })());""",
    """  /* ---- 需求 7（v89.142 老板 1 重写）：城外地块**中心扩散** + 未解锁暗格 ----
     旧版"末行水平居中"随"行数可变的棋盘"一并退役（棋盘现在固定 12×8，
     居中不再有意义）；判据换成"落位序 + 暗格"两件事。 */
  console.log('  --- ⑦ 城外地块中心扩散与暗格 ---');
  check('城外落位唯一出口 extSlotOrder（中心扩散螺旋：第 1 格在中心 2×2 内 · 环序单调）', (function () {
    var ord = G.extSlotOrder();
    var cr = (DATA.EXT_ROWS - 1) / 2, cc = (DATA.EXT_COLS - 1) / 2;
    var okLen = ord.length === DATA.EXT_COLS * DATA.EXT_ROWS;
    var ringAsc = true;
    for (var i = 1; i < ord.length; i++) {
      var r0 = Math.max(Math.abs(ord[i - 1].row - cr), Math.abs(ord[i - 1].col - cc));
      var r1 = Math.max(Math.abs(ord[i].row - cr), Math.abs(ord[i].col - cc));
      if (r1 < r0 - 1e-9) { ringAsc = false; break; }
    }
    var first = ord[0];
    var inCenter = Math.abs(first.row - cr) <= 0.5 + 1e-9 && Math.abs(first.col - cc) <= 0.5 + 1e-9;
    var last = ord[ord.length - 1];
    var corner = Math.max(Math.abs(last.row - cr), Math.abs(last.col - cc)) === Math.max(cr, cc);
    var doSrc142 = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8'));
    return okLen && ringAsc && inCenter && corner && /GAME\\.extSlotOrder = function/.test(doSrc142);
  })());
  check('实测：15 块按中心扩散落位（首块在中心 · 未解锁 81 格是暗格 ext-locked）', (function () {
    var st = G.state, bkId = G.ui._cityId;
    var tmp = G.makeCity({ id: 'tmpExtCap', name: 'tmpExt', col: 6, row: 6 });
    st.cities.push(tmp);
    /* 官府抬到 2 级 → 上限 15 块 */
    tmp.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 2; });
    G.ui._cityId = tmp.id;
    var html = G.ui.extHTML();
    G.ui._cityId = bkId;
    st.cities.pop();
    var M = G.ui.isoMetrics(DATA.EXT_COLS, DATA.EXT_ROWS);
    var ord = G.extSlotOrder();
    var want0 = 'left:' + Math.round(M.x(ord[0].col, ord[0].row)) + 'px;top:' + Math.round(M.y(ord[0].col, ord[0].row)) + 'px';
    var lockedN = (html.match(/iso-tile locked/g) || []).length;
    return tmp.extGrid.length === 15 && html.indexOf(want0) >= 0
      && lockedN === DATA.EXT_CAP_MAX - 15
      && html.indexOf('data-action="ext-locked"') >= 0;
  })());""",
    '③居中→扩散')

# ④ §122① 12×9 → 12×8
rep(
    """    /* ---- ① 12×9 封顶（表平顶 + 两表联动 + MAX 常量） ---------- */
    check('§122① 城外地块 12×9=108 封顶（Lv27 到顶 · 两表联动 · 官府再升不加地）', (function () {
      var D = DATA, okAll = true;
      for (var lv = 1; lv <= D.MAX_LEVEL_ABS; lv++) {
        var cap = D.EXT_CAP_BY_LV[lv - 1];
        var sum = D.EXT_PLAN_BY_LV[lv - 1].reduce(function (a, b) { return a + b; }, 0);
        if (cap > D.EXT_CAP_MAX || sum !== cap) { okAll = false; break; }
      }
      return D.EXT_CAP_MAX === 108 && okAll
        && D.EXT_CAP_BY_LV[25] === 104 && D.EXT_CAP_BY_LV[26] === 108
        && D.EXT_CAP_BY_LV[D.MAX_LEVEL_ABS - 1] === 108
        && /\\bDATA\\.EXT_CAP_MAX = 108\\b/.test(d122)
        && /Math\\.min\\(DATA\\.EXT_CAP_MAX, prevCap \\+ 4\\)/.test(d122);
    })());""",
    """    /* ---- ① 12×8 封顶（表平顶 + 两表联动 + MAX 常量 · v89.142 老板 1） ---------- */
    check('§122① 城外地块 12×8=96 封顶（Lv24 到顶 · 两表联动 · 官府再升不加地）', (function () {
      var D = DATA, okAll = true;
      for (var lv = 1; lv <= D.MAX_LEVEL_ABS; lv++) {
        var cap = D.EXT_CAP_BY_LV[lv - 1];
        var sum = D.EXT_PLAN_BY_LV[lv - 1].reduce(function (a, b) { return a + b; }, 0);
        if (cap > D.EXT_CAP_MAX || sum !== cap) { okAll = false; break; }
      }
      return D.EXT_CAP_MAX === 96 && D.EXT_COLS === 12 && D.EXT_ROWS === 8 && okAll
        && D.EXT_CAP_BY_LV[22] === 92 && D.EXT_CAP_BY_LV[23] === 96
        && D.EXT_CAP_BY_LV[D.MAX_LEVEL_ABS - 1] === 96
        && /\\bDATA\\.EXT_CAP_MAX = 96\\b/.test(d122)
        && /Math\\.min\\(DATA\\.EXT_CAP_MAX, prevCap \\+ 4\\)/.test(d122);
    })());""",
    '④§122①')

# ⑤ §122⑥ 12 列 → 12×8 棋盘 + 扩散 + 暗格
rep(
    """    /* ---- ⑥ 12 列 ---------- */
    check('§122⑥ 城外地块 12 列（108 = 12×9 整网格）', /var COLS = 12;/.test(u122));""",
    """    /* ---- ⑥ 12×8 棋盘（常量唯一来源 + 中心扩散落位 + 暗格 · v89.142 老板 1） ---------- */
    check('§122⑥ 城外棋盘 12×8（96 整网格 · 唯一来源 DATA.EXT_COLS/ROWS · 中心扩散 · 暗格）', (function () {
      return /var COLS = DATA\\.EXT_COLS \\|\\| 12, ROWS = DATA\\.EXT_ROWS \\|\\| 8;/.test(u122)
        && /GAME\\.extSlotOrder \\? GAME\\.extSlotOrder\\(\\) : null/.test(u122)
        && /class="iso-tile locked"/.test(u122)
        && /data-action="ext-locked"/.test(u122)
        && /\\.iso-tile\\.locked \\.tile-face \\{ background: rgba\\(var\\(--sh-rgb\\),\\.14\\); \\}/.test(h122);
    })());""",
    '⑤§122⑥')

# 自检 + 落盘
assert 'D.EXT_CAP_MAX === 108' not in s, '旧 108 断言残留'
assert s.count('DATA.EXT_CAP_MAX === 96') >= 1, '新 96 断言缺失'
assert s.count('D.EXT_CAP_MAX === 96') >= 1, '§122 的 96 断言缺失'
assert 'extSlotOrder' in s and 'ext-locked' in s
assert '\r\n' not in s, '行尾被写成 CRLF'
# 花括号"盈亏"守恒（本文件里字符串/正则含花括号，绝对数量本就不等；
# 用盈亏差守恒 + 紧随其后的 node --check 双保险）
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE smoke-test.js  len ' + str(len(bak)) + ' -> ' + str(len(s)))
