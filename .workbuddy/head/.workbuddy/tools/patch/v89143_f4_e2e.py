# v89.143 F4：e2e-test.js —— 材料页分页（28/页）+ 宝物页按"实际类型"切分类（无「全部」）
# 跑法：python .workbuddy/tools/patch/v89143_f4_e2e.py
import io
P = 'E:/Deepseekdb/e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open('E:/Deepseekdb/backup/v89143/e2e-test.js.before', encoding='utf-8', newline='').read()

def rep(old, new, tag):
    global s
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)

# ① 材料页分页（28/页 · 24 种一页装下）
rep("""  check('材料页按格分页（首屏 16 格 · 总数 24）', (function () {
    var n = bagH.querySelectorAll('.bag-cell').length;
    var bar = document.querySelector('#bottom-bar').textContent;
    return n === 16 && bar.indexOf('共 24 项') >= 0;
  })(), bagH.querySelectorAll('.bag-cell').length + ' 格 / ' + document.querySelector('#bottom-bar').textContent.trim());""",
"""  /* v89.143（老板 1）：每页 16 → **28**（7 列 × 4 行 · 整行不截）—— 本局 24 种材料恰一页装下 */
  check('材料页按格分页（28/页 = 7×4 · 本局 24 种一页装下）', (function () {
    var n = bagH.querySelectorAll('.bag-cell').length;
    var bar = document.querySelector('#bottom-bar').textContent;
    return G.ui.BAG_PER_PAGE === 28 && n === 24 && bar.indexOf('共 24 项') >= 0;
  })(), bagH.querySelectorAll('.bag-cell').length + ' 格 / ' + document.querySelector('#bottom-bar').textContent.trim());""",
 '①材料分页')

# ② 第二页 → 单页铺满（24 ≤ 28）
rep("""  check('材料页可翻到第 2 页并看到其余系列', (function () {
    var btn = document.querySelector('#bottom-bar [data-action="page"][data-n="2"]');
    if (!btn) return false;
    btn.click();
    var n = document.querySelectorAll('#view-container .bag-cell').length;
    document.querySelector('#view-container');
    return n === 8;   /* v39：24 项 / 每页 16 → 第 2 页 8 格 */
  })());""",
"""  /* v89.143（老板 1）：24 项 ≤ 28/页 → 只剩 1 页；且 7 列网格 = 3 整行 + 3 格（材料页按系列分组，
     末组不满行是数据本身如此）—— 判据改为"一页装下 + 无第 2 页按钮"。 */
  check('材料页一页装下（24 ≤ 28 · 无多余页码）', (function () {
    var btn2 = document.querySelector('#bottom-bar [data-action="page"][data-n="2"]');
    var n = document.querySelectorAll('#view-container .bag-cell').length;
    return n === 24 && !btn2;
  })(), document.querySelectorAll('#view-container .bag-cell').length + ' 格');""",
 '②单页')

# ③ 右键批量：按道具**实际类型**切分类（legacy 'item' 已归一，不再落到"全部"）
rep("""  const _bulkBk5 = G.state.items.shennongchu;
  G.state.items.shennongchu = 5;
  G.ui.closeAllModals();
  G.ui.setView('bag');
  if (G.ui.setBagTab) G.ui.setBagTab('item');
  else { G.ui._bagTab = 'item'; G.ui.renderBag(); }
  await sleep(80);""",
"""  const _bulkBk5 = G.state.items.shennongchu;
  G.state.items.shennongchu = 5;
  G.ui.closeAllModals();
  G.ui.setView('bag');
  /* v89.143（老板 1）：「全部」分类退役 —— 旧的 setBagTab('item') 会归一到**第一个有货分类**
     （本局 = 材料），神农锄不在那页 → 找不到格子。改为**按道具实际类型**切分类。 */
  (function () {
    var it5 = null;
    (G.DATA.ITEMS || []).forEach(function (x) { if (x.id === 'shennongchu') it5 = x; });
    G.ui._bagTab = 'treasure';
    G.ui.setBagSub(it5 ? it5.type : 'material');
  })();
  await sleep(80);""",
 '③右键切类')

# ④ 点击使用：同样按实际类型切分类
rep("""  if (_bulkBk5 == null) delete G.state.items.shennongchu; else G.state.items.shennongchu = _bulkBk5;
  G.ui.setView('bag');
  if (G.ui.setBagTab) G.ui.setBagTab('item');
  else { G.ui._bagTab = 'item'; G.ui.renderBag(); }
  await sleep(60);""",
"""  if (_bulkBk5 == null) delete G.state.items.shennongchu; else G.state.items.shennongchu = _bulkBk5;
  G.ui.setView('bag');
  (function () {
    var it5b = null;
    (G.DATA.ITEMS || []).forEach(function (x) { if (x.id === 'shennongchu') it5b = x; });
    G.ui._bagTab = 'treasure';
    G.ui.setBagSub(it5b ? it5b.type : 'material');   /* v89.143：同 ③ —— 按实际类型切类 */
  })();
  await sleep(60);""",
 '④点击切类')

assert '\r\n' not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('WROTE e2e-test.js len ' + str(len(bak)) + ' -> ' + str(len(s)))
