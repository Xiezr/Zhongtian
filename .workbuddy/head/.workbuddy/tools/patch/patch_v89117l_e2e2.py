# -*- coding: utf-8 -*-
"""v89.117 补丁 H3 —— e2e 最后两条

① 「找到凡品盔（可点选）」：前置被"切到套装类别"影响的夹具 ——
   改成**逐页找**（与玩家翻页同路：改 ui._pages['forge'] + 重开面板），
   不赌"它一定在第 1 页"（凡品不止 6 件，翻页是常态）。
② 「关闭按钮生效」：本轮起 ✕ = 弹层语义（**先回上一级**，再点一次才全关）——
   用例按新口径升级，并把"回上一级"这件事**显式断言**（e2e 覆盖真 DOM）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
P = R + 'e2e-test.js'
s = io.open(P, encoding='utf-8').read()

# ---------- ① 逐页找凡品盔 ----------
OLD1 = """  const invBefore = (G.state.inventory || []).length;
  G.ui.openForge();
  const pickRow = document.querySelector('#modal-root .item-row[data-action="forge-pick"][data-item="cr_head_1"]');
  check('找到凡品盔（可点选）', !!pickRow);
  if (pickRow) { pickRow.click(); }
  const forgeBtn = document.querySelector('#modal-root [data-action="forge-item"]');"""
NEW1 = """  const invBefore = (G.state.inventory || []).length;
  /* v89.117：先把筛选复位（前面的子用例切到过「套装」类别），再**逐页找** ——
     凡品不止 6 件，`cr_head_1` 可能在第 2 页；翻页走与玩家同一条路
     （改 ui._pages['forge'] + 重开面板）。 */
  G.ui._forgeKind = 'all'; G.ui._forgeSet = ''; G.ui._forgeQ = 1; G.ui._forgeSel = '';
  let pickRow = null;
  for (let pi = 1; pi <= 8 && !pickRow; pi++) {
    G.ui._pages['forge'] = pi;
    G.ui.openForge();
    pickRow = document.querySelector('#modal-root .item-row[data-action="forge-pick"][data-item="cr_head_1"]');
  }
  check('找到凡品盔（可点选 · 逐页可达）', !!pickRow);
  if (pickRow) { pickRow.click(); }
  const forgeBtn = document.querySelector('#modal-root [data-action="forge-item"]');"""
if s.count(OLD1) != 1:
    print('!! 段 1 匹配 %d' % s.count(OLD1)); sys.exit(1)
s = s.replace(OLD1, NEW1, 1)
print('  ✓ 段 1 逐页找凡品盔')

# ---------- ② 关闭键的两级语义 ----------
OLD2 = """  click(document.querySelector('#modal-root [data-action="close-modal"]'));
  await sleep(60);
  check('关闭按钮生效', document.querySelector('#modal-root').innerHTML.length < 20,
    document.querySelector('#modal-root').innerHTML.length + ' 字符');"""
NEW2 = """  click(document.querySelector('#modal-root [data-action="close-modal"]'));
  await sleep(60);
  /* v89.117（老板「关闭的时候不回到上一级界面…这个操作逻辑很别扭」）：
     从下级面板（军队）点 ✕ = **返回上一级**（军营面板）；再点一次才全关。
     这条断言把"层"的行为钉在真 DOM 上（smoke 里另有结构化断言）。 */
  const afterOne = document.querySelector('#modal-root').innerHTML;
  check('v89.117：下级点 ✕ → 回到上一级（军营面板，不是全关）',
    afterOne.length > 100 && afterOne.indexOf('军营') >= 0, afterOne.length + ' 字符');
  click(document.querySelector('#modal-root [data-action="close-modal"]'));
  await sleep(60);
  check('关闭按钮生效（顶层 ✕ → 全关）', document.querySelector('#modal-root').innerHTML.length < 20,
    document.querySelector('#modal-root').innerHTML.length + ' 字符');"""
if s.count(OLD2) != 1:
    print('!! 段 2 匹配 %d' % s.count(OLD2)); sys.exit(1)
s = s.replace(OLD2, NEW2, 1)
print('  ✓ 段 2 关闭键两级语义')

b = io.open(R + '.workbuddy/backup/v89117/e2e-test.js', encoding='utf-8').read()
print('  花括号净变化 %+d' % ((s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))))
tmp = P + '.tmp117h3'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('补丁 H3 完成')
