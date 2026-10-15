# -*- coding: utf-8 -*-
"""patch_v89115i_bag_e2e.py — ① ui.openBag / bagHTML 支持旧页签值迁移；② e2e 断言升级"""
import io, os, sys
R = 'E:/Deepseekdb/'
def read(p): return io.open(R + p, encoding='utf-8').read()
def write(p, s):
    tmp = R + p + '.tmp115i'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
def sub1(s, old, new, label):
    n = s.count(old)
    if n != 1:
        print('!! [%s] 匹配 %d\n   首行: %s' % (label, n, old.split('\n')[0][:90])); sys.exit(1)
    return s.replace(old, new, 1)

# ============ ① ui.js：迁移（openBag + bagHTML 兜底） ============
U = read('js/ui.js')
OLD1 = """  ui.openBag = function (tab) {
    if (tab) ui._bagTab = tab;
    ui.setView('bag');
  };"""
NEW1 = """  ui.openBag = function (tab) {
    /* v89.115：旧值（'mat'/'item'/'bp'）自动迁移到「宝物 + 二级分类」—— 深链与脚本不炸 */
    if (tab) {
      if (BAG_LEGACY_TAB[tab]) {
        ui._bagTab = BAG_LEGACY_TAB[tab][0];
        ui._bagSub = BAG_LEGACY_TAB[tab][1];
      } else {
        ui._bagTab = (tab === 'treasure') ? 'treasure' : 'equip';
      }
    }
    ui.setView('bag');
  };"""
U = sub1(U, OLD1, NEW1, 'openBag 迁移')

OLD2 = """    var t = ui._bagTab || 'equip';
    if (t !== 'equip' && t !== 'treasure') t = 'equip';       /* 脏值兜底（旧档深链） */"""
NEW2 = """    var t = ui._bagTab || 'equip';
    /* 旧值兜底（v89.115）：直接赋内部变量（老脚本/老用例）也走得通 —— 一次迁移到位 */
    if (BAG_LEGACY_TAB[t]) { ui._bagSub = BAG_LEGACY_TAB[t][1]; t = BAG_LEGACY_TAB[t][0]; ui._bagTab = t; }
    if (t !== 'equip' && t !== 'treasure') t = 'equip';"""
U = sub1(U, OLD2, NEW2, 'bagHTML 兜底迁移')
write('js/ui.js', U)
print('  ✓ ui.js')

# ============ ② e2e：助手函数 ============
E = read('e2e-test.js')
OLD3 = """  const click = (el) => {
    if (!el) return false;
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  };"""
NEW3 = """  const click = (el) => {
    if (!el) return false;
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  };
  /* v89.115：背包顶层改「装备 / 宝物」两类 + 宝物二级分类条 ——
     "切到某一类"统一走这个助手（先切宝物页，再点分类条）。 */
  const bagTabTo = async (sub) => {
    const t = document.querySelector('#view-container [data-action="bag-tab"][data-v="treasure"]');
    if (t) { click(t); await sleep(70); }
    if (sub) {
      const c = document.querySelector('#view-container [data-action="bag-sub"][data-v="' + sub + '"]');
      if (c) { click(c); await sleep(70); }
    }
  };"""
E = sub1(E, OLD3, NEW3, 'e2e bagTabTo 助手')

# ============ ③ e2e：逐处替换 ============
EDITS = [
# 496：三类页签 → 两类 + 二级分类条
("""  check('背包含三类页签', bagModal.indexOf('data-v="equip"') >= 0 && bagModal.indexOf('data-v="item"') >= 0 && bagModal.indexOf('data-v="mat"') >= 0);""",
 """  check('背包分「装备 / 宝物」两类 + 宝物二级分类（v89.115）',
    bagModal.indexOf('data-v="equip"') >= 0 && bagModal.indexOf('data-v="treasure"') >= 0
    && bagModal.indexOf('bag-sub') >= 0);"""),
# 1691 段：材料页切法
("""  /* 材料页签 */
  click(bagH.querySelector('[data-action="bag-tab"][data-v="mat"]'));
  await sleep(80);
  bagH = document.querySelector('#view-container');""",
 """  /* 材料（宝物 · 材料分类）—— v89.115：两类页签 + 二级分类条 */
  await bagTabTo('material');
  bagH = document.querySelector('#view-container');"""),
# 1719 段：宝物页切法
("""  /* 宝物页签 */
  click(bagH.querySelector('[data-action="bag-tab"][data-v="item"]'));
  await sleep(80);
  bagH = document.querySelector('#view-container');""",
 """  /* 宝物（全部） */
  await bagTabTo('all');
  bagH = document.querySelector('#view-container');"""),
# 1991：四个页签 → 两类
("""  check('背包含四个页签', bag22.querySelectorAll('[data-action="bag-tab"]').length === 4);""",
 """  check('背包含两类页签（装备 / 宝物）', bag22.querySelectorAll('[data-action="bag-tab"]').length === 2);"""),
# 2002 段：材料切法
("""  click(document.querySelector('#view-container [data-action="bag-tab"][data-v="mat"]'));
  await sleep(90);
  const matHtml22 = document.querySelector('#view-container').innerHTML;""",
 """  await bagTabTo('material');
  const matHtml22 = document.querySelector('#view-container').innerHTML;"""),
# 2010 段：图纸切法
("""  click(document.querySelector('#view-container [data-action="bag-tab"][data-v="bp"]'));
  await sleep(80);
  check('图纸页可访问', document.querySelector('#view-container').innerHTML.indexOf('装备图纸') >= 0);""",
 """  await bagTabTo('blueprint');
  check('图纸分类可访问', document.querySelector('#view-container').innerHTML.indexOf('装备图纸') >= 0);"""),
# 3017：自动菜单四开关 → 左名单六项
("""  check('自动菜单含四个开关（升级 / 研究 / 出征 / 练功）', (function () {
    /* v89.83：新增第 4 条自动化「🧘 自动练功」（君主修行最该自动化）。 */
    return vc.querySelectorAll('.auto-switches .btn').length === 4
      && !!vc.querySelector('[data-action="toggle-auto-lord"]');
  })());""",
 """  check('自动化界面：左名单六项 + 右详情（v89.115 左右分栏）', (function () {
    /* v89.115：整合成「左 1/3 名单 + 右 2/3 详情」，并新增「🏥 自动治疗」。 */
    var items = vc.querySelectorAll('.auto-item');
    return items.length === 6 && !!vc.querySelector('.auto-pane')
      && !!vc.querySelector('[data-action="auto-pick"][data-key="heal"]');
  })());"""),
# 3024：自动出征两个入口（先选中 march）
("""  check('自动出征：本页只有「详细配置」+「立即出征」两个入口，参数行已撤', (function () {
    var card = null;
    var cards = Array.prototype.slice.call(vc.querySelectorAll('.auto-card'));
    cards.forEach(function (c) { if (!card && /自动出征/.test(c.textContent)) card = c; });
    return !!vc.querySelector('[data-action="open-auto-march"]')
      && !!vc.querySelector('[data-action="auto-march-once"]')
      && !!card && card.querySelectorAll('.al-k').length === 0;
  })());""",
 """  check('自动出征：右侧详情只有「详细配置」+「立即出征」两个入口，参数行已撤', (function () {
    /* v89.115：先点左侧名单选中「自动出征」，详情才渲染它的正文 */
    click(vc.querySelector('[data-action="auto-pick"][data-key="march"]'));
    var pane = vc.querySelector('.auto-pane');
    return !!vc.querySelector('[data-action="open-auto-march"]')
      && !!vc.querySelector('[data-action="auto-march-once"]')
      && !!pane && pane.querySelectorAll('.al-k').length === 0;
  })());"""),
# 3032：点开启自动出征（先选中 march）
("""  check('点「开启自动出征」真能开（并自动挑一位空闲将领）', (function () {
    var btn = vc.querySelector('[data-action="toggle-auto-march"]');
    if (!btn) return false;
    btn.click();
    var cfg = G.autoMarchCfg();
    return cfg.on === true && !!cfg.genId;
  })());""",
 """  check('点「开启自动出征」真能开（并自动挑一位空闲将领）', (function () {
    /* v89.115：开关在右侧详情里 —— 先选中「自动出征」 */
    click(vc.querySelector('[data-action="auto-pick"][data-key="march"]'));
    var btn = vc.querySelector('[data-action="toggle-auto-march"]');
    if (!btn) return false;
    btn.click();
    var cfg = G.autoMarchCfg();
    return cfg.on === true && !!cfg.genId;
  })());"""),
# 6012：宝箱 → 切到 chest 分类（一页装得下）
("""    const bagGold0 = G.state.res.gold;
    G.ui.openBag('item');
    await sleep(90);
    const bagHtml = document.querySelector('#view-container').innerHTML;""",
 """    const bagGold0 = G.state.res.gold;
    G.ui.openBag('item');
    G.ui.setBagSub('chest');       /* v89.115：单类分类条，宝箱必在第 1 页 */
    await sleep(90);
    const bagHtml = document.querySelector('#view-container').innerHTML;"""),
# 6038：精华 → 切到 essence 分类
("""    G.ui.openBag('item');
    await sleep(90);
    const bag2 = document.querySelector('#view-container').innerHTML;""",
 """    G.ui.openBag('item');
    G.ui.setBagSub('essence');     /* v89.115：切到「精华」分类（该行必在第 1 页） */
    await sleep(90);
    const bag2 = document.querySelector('#view-container').innerHTML;"""),
]
for i, (old, new) in enumerate(EDITS):
    E = sub1(E, old, new, 'e2e 段 %d' % (i + 1))
write('e2e-test.js', E)
print('  ✓ e2e-test.js（%d 段）' % len(EDITS))
print('ALL DONE')
