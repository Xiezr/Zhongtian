# -*- coding: utf-8 -*-
"""v89.117 补丁 H2 —— 弹窗栈引入后的 e2e 适配 + 铁匠铺新口径

背景（e2e 首跑 31 条翻红，两个根因）：
  ① `closeModal()` 现在**只弹一层**（老板要求的"关闭回上一级"）——
     测试里 99 处 `G.ui.closeModal()` 的语义是"把弹窗全关掉"，
     于是后面所有用例都以为窗关了，实际还挂着上一级 → 连环假红。
     正解：新增 `ui.closeAllModals()`（明确语义），测试改用它。
  ② 守将用例把**君主**任命成了守将且没复位 → 本轮新规"守将不可出征"
     把后续所有出征/行军用例全拦下（实测这条是 31 条里的大头）。
     正解：用例收尾**复位守将身份**（自己摆好的前置，自己收干净）。
  ③ 铁匠铺：逐卡打造键 → 点选 + 底部单键，用例按新流程重写。
"""
import io, os, re, sys

R = 'E:/Deepseekdb/'


def load(p):
    return io.open(R + p, encoding='utf-8').read()


def save(p, s):
    tmp = R + p + '.tmp117h2'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)


# ================================================================ ① ui.closeAllModals
u = load('js/ui.js')
OLD = """  ui.modalVisible = function () { return !!$('#modal-root').innerHTML; };"""
NEW = """  /* v89.117：**关掉所有层级**（closeModal 现在只弹一层 —— 见上面的弹窗栈）。
     语义明确的一个出口：脚本/测试/"一键回城"这类要"全关"的地方用它。
     （UI 里的 ✕ 保持弹一层：老板要的正是"关闭回下级"。） */
  ui.closeAllModals = function () {
    ui._modalStack = [];
    ui.closeModal();
  };
  ui.modalVisible = function () { return !!$('#modal-root').innerHTML; };"""
if u.count(OLD) != 1:
    print('!! closeAllModals 锚点 %d' % u.count(OLD)); sys.exit(1)
u = u.replace(OLD, NEW, 1)
save('js/ui.js', u)
print('  ✓ ui.closeAllModals')

# ================================================================ ② e2e：closeModal → closeAllModals
e = load('e2e-test.js')
n1 = len(re.findall(r'G\.ui\.closeModal\(\)', e))
n2 = len(re.findall(r'GAME\.ui\.closeModal\(\)', e))
e = re.sub(r'G\.ui\.closeModal\(\)', 'G.ui.closeAllModals()', e)
e = re.sub(r'GAME\.ui\.closeModal\(\)', 'GAME.ui.closeAllModals()', e)
print('  ✓ e2e closeModal → closeAllModals（%d + %d 处）' % (n1, n2))

# ================================================================ ③ e2e：守将用例收尾复位
OLD3 = """    /* 收尾：本用例造的将清掉，守住将领数不会越测越多 */
    st.generals = st.generals.filter((g) => made.indexOf(g.id) < 0);
    G.refreshAll();
  })();"""
NEW3 = """    /* 收尾：本用例造的将清掉，守住将领数不会越测越多；
       v89.117：**守将身份也要复位** —— 这条用例会把清单前两位任命成守将
       （其中很可能就是君主），而本轮起"守将不可出征"是硬规则 →
       不复位会把后面所有出征/行军用例全拦死（实测 31 条翻红的根因）。
       与本用例开头"先清空守将"对称：自己摆的前置，自己收干净。 */
    st.generals = st.generals.filter((g) => made.indexOf(g.id) < 0);
    st.generals.forEach((g) => { if (g.status === 'guard') { g.status = 'idle'; g.cityId = null; } });
    G.refreshAll();
  })();"""
if e.count(OLD3) != 1:
    print('!! 守将复位锚点 %d' % e.count(OLD3)); sys.exit(1)
e = e.replace(OLD3, NEW3, 1)
print('  ✓ e2e 守将身份复位')

# ================================================================ ④ e2e：铁匠铺用例重写（切片法）
START = "  check('被禁用的打造按钮旁边必须写明原因', (function () {"
a = e.find(START)
END = "  G.ui.closeAllModals();\n\n  /* ⑤ 装备面板：体力作用说明 + 获取指引 */"
b = e.find(END, a)
if a < 0 or b < 0:
    print('!! 铁匠铺用例定位失败 a=%d b=%d' % (a, b)); sys.exit(1)
NEW4 = """  /* v89.117（老板「太多打造按钮了，统一成一个放在底部」）：
     口径变了 —— **逐卡打造键退役**，改「点选一件 + 底部唯一打造键（与百炼强化同栏）」。 */
  check('v89.117 铁匠铺：卡片不再带打造键（整卡可点选 data-action="forge-pick"）', (function () {
    const cards = Array.prototype.slice.call(document.querySelectorAll('#modal-root .item-row[data-action="forge-pick"]'));
    const picks = document.querySelectorAll('#modal-root .ir-pick').length;
    return cards.length > 0 && picks === cards.length
      && document.querySelectorAll('#modal-root .item-row [data-action="forge-item"]').length === 0;
  })(), document.querySelectorAll('#modal-root .item-row').length + ' 张卡');
  check('v89.117 铁匠铺：底部**只有 1 个**打造键，且与百炼强化同栏', (function () {
    const btns = document.querySelectorAll('#modal-root [data-action="forge-item"]');
    const foot = document.querySelector('#modal-root .m-foot');
    return btns.length === 1 && !!foot && !!foot.querySelector('[data-action="forge-item"]')
      && !!foot.querySelector('[data-action="open-enhance"]');
  })());
  check('v89.117 铁匠铺：未选中时打造键禁用（先选一件）', (function () {
    const b = document.querySelector('#modal-root [data-action="forge-item"]');
    return !!b && b.hasAttribute('disabled') && /点选/.test(b.textContent);
  })());
  check('v89.117 铁匠铺：点选后底部键写明件名 + 缺什么写在卡上', (function () {
    /* 先造出阻塞（清空材料）→ 点选一件 → 底部键禁用且面板给出原因；验完恢复 */
    const saveItems = G.state.items;
    G.state.items = {};
    G.ui.openForge();
    const card = document.querySelector('#modal-root .item-row[data-action="forge-pick"]');
    if (card) card.click();
    const b2 = document.querySelector('#modal-root [data-action="forge-item"]');
    const hint = document.querySelector('#modal-root .m-foot .op-hint');
    const selRow = document.querySelector('#modal-root .item-row.on');
    const okBlocked = !!b2 && b2.hasAttribute('disabled')
      && !!hint && /材料不足|缺图纸|需铁匠铺|资材不足/.test(hint.textContent)
      && !!selRow && /材料不足|缺图纸|需铁匠铺|资材不足/.test(selRow.textContent);
    G.state.items = saveItems;
    G.ui.openForge();
    return okBlocked;
  })());
  check('v89.117 铁匠铺：选中件可打造时底部键启用（金色 + 写明件名）', (function () {
    /* 恢复到"哪件都能造"：补满资材与图纸，再点选凡品盔 */
    const saveItems = G.state.items, saveRes = G.state.res;
    const it = G.DATA.EQUIP.cr_head_1;
    G.state.items = Object.assign({}, saveItems);
    (G.DATA.MATERIALS || []).forEach((m) => { G.state.items[m.id] = 999; });
    G.state.res = Object.assign({}, saveRes, { gold: 9e8, iron: 9e8, wood: 9e8, stone: 9e8,
      grain: 9e8, cloth: 9e8, horse: 9e8 });
    G.ui.openForge();
    const row = document.querySelector('#modal-root .item-row[data-action="forge-pick"][data-item="cr_head_1"]');
    if (!row) { G.state.items = saveItems; G.state.res = saveRes; G.ui.openForge(); return false; }
    row.click();
    const b3 = document.querySelector('#modal-root [data-action="forge-item"]');
    const ok = !!b3 && !b3.hasAttribute('disabled') && /打造/.test(b3.textContent)
      && b3.textContent.indexOf(it.name) >= 0;
    return ok;
  })());
  check('v89.117 铁匠铺：类别条可切「套装」，且出现**具体套装**子条', (function () {
    const setCat = document.querySelector('#modal-root [data-action="forge-kind"][data-k="set"]');
    if (!setCat) return false;
    setCat.click();
    const chips = document.querySelectorAll('#modal-root [data-action="forge-set"]');
    const names = Array.prototype.map.call(chips, (c) => c.textContent.replace(/\\d+$/, ''));
    return chips.length >= 2 && names.some((x) => /套/.test(x));
  })());
  check('含打造按钮', forge20.indexOf('data-action="forge-item"') >= 0);
  check('打造面板不再写来源说明（需求 5）', forge20.indexOf('图纸来源') < 0);
  /* 真造一件：走**新流程**（点选卡片 → 底部打造键） */
  (function () {
    const saveItems = G.state.items, saveRes = G.state.res;
    (G.DATA.MATERIALS || []).forEach((m) => { G.state.items[m.id] = 999; });
    G.state.res = Object.assign({}, saveRes, { gold: 9e8, iron: 9e8, wood: 9e8, stone: 9e8 });
  })();
  const invBefore = (G.state.inventory || []).length;
  G.ui.openForge();
  const pickRow = document.querySelector('#modal-root .item-row[data-action="forge-pick"][data-item="cr_head_1"]');
  check('找到凡品盔（可点选）', !!pickRow);
  if (pickRow) { pickRow.click(); }
  const forgeBtn = document.querySelector('#modal-root [data-action="forge-item"]');
  check('点选后底部打造键启用', !!forgeBtn && !forgeBtn.hasAttribute('disabled'));
  if (forgeBtn) { forgeBtn.click(); }
  await sleep(90);
  check('点击打造后进入背包', (G.state.inventory || []).length === invBefore + 1,
    invBefore + ' → ' + (G.state.inventory || []).length);
  check('打造后记录已造', (G.state.forged || []).indexOf('cr_head_1') >= 0);
"""
e = e[:a] + NEW4 + e[b:]
print('  ✓ e2e 铁匠铺用例重写')

# 写后自检
if 'G.ui.closeModal()' in e:
    print('!! 自检：仍有裸 closeModal()'); sys.exit(1)
if 'data-action="forge-item"][data-item=' in e:
    print('!! 自检：仍有按 data-item 找打造键的旧写法')
b0 = (e.count('{') - e.count('}')) - (load('.workbuddy/backup/v89117/e2e-test.js').count('{') - load('.workbuddy/backup/v89117/e2e-test.js').count('}'))
print('  花括号净变化 %+d' % b0)
save('e2e-test.js', e)
print('补丁 H2 完成')
