# -*- coding: utf-8 -*-
"""v90.93 批次C2：e2e 剧本用例段 → 一次性结算 + 退役守卫
三处边界替换：
  A) v88.1 场景整合：点「废墟探访」→ 一次性结算（不再进 #scene-fx）
  B) v88 荒野行动：点「静修」→ 一次性结算
  C) v89 君主专属：② 讨伐 / ③ 地宫探险 / ④ 视觉层零残留（整段重写）
纪律：备份 → 内存替换 → 边界唯一性 → 原子写回 → 幂等重跑
"""
import io, os, sys, shutil

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'e2e-test.js')
BK = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.93C')
os.makedirs(BK, exist_ok=True)

src = io.open(P, 'r', encoding='utf-8', newline='').read()
n0 = len(src)

bk = os.path.join(BK, 'e2e-test.js')
if not os.path.exists(bk):
    shutil.copy2(P, bk)
    print('[backup] %s' % bk)
else:
    print('[backup] 已存在，跳过')

# ============ A) v88.1 场景整合 ============
A_S = "    click(document.querySelector('#modal-root [data-action=\"do-jianghu\"][data-act=\"hill_scene\"]'));\n"
A_E = "    /* 已占分支同样只有新区块 */"

A_NEW = """    const eBef1 = G.lordGeneralOf().energy;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="hill_scene"]'));
    await sleep(260);
    /* v90.93（老板「去掉纪事剧本」中的「全屏剧本」）：荒野活动按钮 → **一次性结算**（one-shot）。
       原「进入全屏剧本（第 1 幕 + 选择项 + 退出钮）/ 终幕结算屏 / 剧本收尾回显」三层的正向断言，
       按 §0.7 翻转为**零残留守卫 + 结算实证**。 */
    check('v90.93：「废墟探访」不再进全屏剧本（#scene-fx 零残留 · sxf-* 动作全清）', (function () {
      const el = document.getElementById('scene-fx');
      return (!el || el.style.display === 'none')
        && !document.querySelector('[data-action="sxf-choice"]')
        && !document.querySelector('[data-action="sxf-escape"]')
        && !document.querySelector('[data-action="sxf-stop"]')
        && !document.querySelector('[data-action="sxf-exit"]');
    })());
    check('v90.93：「废墟探访」一次性结算 —— 君主精力实扣', (function () {
      return G.lordGeneralOf().energy < eBef1 - 0.01;
    })());
    check('v88.1：结算 → 回野地弹窗原地回显（今日已做 · 不可再入）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('今日已做') >= 0
        && !G.jianghuCheck(hp.x, hp.y, G.lordGeneralOf().id, 'hill_scene').ok;
    })());
"""

# ============ B) v88 荒野行动（静修） ============
B_S = "    const before88 = G.state.items.lingsui || 0;\n"
B_E = ("    G.ui.closeAllModals();\n    await sleep(60);\n  }\n\n"
       "  /* ============================================================\n"
       "   * v89（老板）：君主专属改造 + 全屏荒野剧本（真实 DOM）")

B_NEW = """    const before88 = G.state.items.lingsui || 0;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="xiu"]'));
    await sleep(260);
    /* v90.93：静修同样改走一次性结算（原「进入全屏剧本 / 结算屏含辐能核心与专属退出」
       两条正向断言 → 零残留守卫 + 收益实证）。 */
    check('v90.93：静修不再进全屏剧本（#scene-fx 零残留）', (function () {
      const el = document.getElementById('scene-fx');
      return !el || el.style.display === 'none';
    })());
    check('v88：一次性结算后得精华 + 弹窗回显「今日已做」', (function () {
      const root = document.querySelector('#modal-root');
      const gained = (G.state.items.lingsui || 0) - before88;
      return gained > 0 && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());
"""

# ============ C) v89 君主专属：②③④ 整段重写 ============
C_S = "    /* \u2461 \u5168\u5c4f\u5267\u672c\uff1a\u9003\uff08\u672a\u52a8\u8eab\u514d\u8d39 / \u52a8\u8eab\u540e\u8ba1\u5165\uff09 */"
C_E = ("  await sleep(30);\n\n"
       "  /* v89.4\uff1a\u91ce\u5730\u751f\u6001\uff08\u8352\u50fb\u7a7a\u6001 \u00b7 \u6709\u4e8b\u683c 1~3 \u00b7 \u7b49\u7ea7\u6536\u76ca\u884c\uff09 */")

C_NEW = """    /* \u2461 荒野活动\u300c\u4e00\u6b21\u6027\u7ed3\u7b97\u300d\uff08v90.93\uff1a\u5168\u5c4f\u5267\u672c\u9000\u5f79\uff09
       \u539f\u4e09\u5c42\u8bed\u4e49\uff08\u8fdb\u5165\u5168\u5c4f\u7b2c 1 \u5e55 / \u672a\u52a8\u8eab\u514d\u8d39\u9000\u51fa / \u52a8\u8eab\u540e\u9000\u51fa\u8ba1\u5165\uff09
       \u968f\u5267\u672c\u6574\u6761\u9000\u5f79 \u2014\u2014 \u4e00\u6b21\u6027\u7ed3\u7b97 = \u70b9\u5373 commit\uff0c\u4e0d\u5b58\u5728\u53ef\u53cd\u6094\u7684\u4e2d\u95f4\u6001\u3002 */
    let hp89 = null;
    for (let y = 3; y < 200 && !hp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'tao')) { hp89 = { x, y }; break; }
      }
    }
    G.state.jianghu = {};
    G.ui._jhGen = null;
    G.ui.openLandModal(hp89.x, hp89.y);
    await sleep(200);
    const e089 = lg89.energy;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="tao"]'));
    await sleep(240);
    check('v90.93\uff1a\u8ba8\u4f10\u4e0d\u518d\u8fdb\u5168\u5c4f\u5267\u672c\uff08#scene-fx \u96f6\u6b8b\u7559 \u00b7 sxf-* \u56db\u5c42\u52a8\u4f5c\u5168\u6e05\uff09', (function () {
      const el = document.getElementById('scene-fx');
      return (!el || el.style.display === 'none')
        && !document.querySelector('[data-action="sxf-choice"]')
        && !document.querySelector('[data-action="sxf-escape"]')
        && !document.querySelector('[data-action="sxf-stop"]')
        && !document.querySelector('[data-action="sxf-exit"]');
    })());
    check('v90.93\uff1a\u4e00\u6b21\u6027\u7ed3\u7b97\u5373 commit\uff08\u541b\u4e3b\u7cbe\u529b\u5b9e\u6263 \u00b7 \u4eca\u65e5\u843d\u9501\uff09', (function () {
      return lg89.energy < e089 - 0.01
        && !G.jianghuCheck(hp89.x, hp89.y, lg89.id, 'tao').ok;
    })());
    check('v89\uff1a\u7ed3\u7b97\u540e\u56de\u91ce\u5730\u5f39\u7a97\u539f\u5730\u56de\u663e\uff08\u4eca\u65e5\u5df2\u505a\uff09', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('\u4eca\u65e5\u5df2\u505a') >= 0;
    })());

    /* \u2462 \u5730\u5bab\u63a2\u9669\uff08\u5730\u5f62\u4e13\u5c5e\u6d3b\u52a8\uff09\uff1a\u540c\u6837\u4e00\u6b21\u6027\u7ed3\u7b97 + \u573a\u666f\u89c6\u89c9\u5c42\u96f6\u6b8b\u7559 */
    let fp89 = null;
    for (let y = 3; y < 200 && !fp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'desert' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'desert_scene')) { fp89 = { x, y }; break; }
      }
    }
    G.ui.closeAllModals();
    await sleep(80);
    G.ui.openLandModal(fp89.x, fp89.y);
    await sleep(200);
    const eFp89 = lg89.energy;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="desert_scene"]'));
    await sleep(260);
    check('v90.93\uff1a\u5730\u5bab\u63a2\u9669\u4e00\u6b21\u6027\u7ed3\u7b97\uff08\u4e0d\u518d\u8fdb\u5168\u5c4f \u00b7 \u7cbe\u529b\u5b9e\u6263\uff09', (function () {
      const el = document.getElementById('scene-fx');
      return (!el || el.style.display === 'none') && lg89.energy < eFp89 - 0.01;
    })());
    check('v90.93\uff1a\u573a\u666f\u89c6\u89c9\u5c42\u6574\u65cf\u9000\u5f79\uff08\u753b\u5e03 / \u6a2a\u5e45 / \u65f6\u673a\u6761 / \u7ed3\u7b97\u5361 零残留\uff09', (function () {
      return !document.querySelector('canvas.sxf-canvas')
        && !document.querySelector('.sxf-spot') && !document.querySelector('.sxf-hero')
        && !document.querySelector('.sxf-tk') && !document.querySelector('.sxf-mark')
        && !document.querySelector('.sxf-emblem') && !document.querySelector('.sxf-loot')
        && !document.querySelector('.sxf-tl-item') && !document.querySelector('.sxf-hero-alias')
        && document.body.textContent.indexOf('\u70b9\u753b\u4e2d\u4e4b\u5904') < 0;
    })());
    check('v90.93\uff1a\u5267\u672c\u6d88\u8d39\u70b9\u96f6\u6b8b\u7559\uff08GAME.scene* / DATA.SCENE_FLOW / map.paintScene\uff09', (function () {
      return typeof G.sceneFx === 'undefined' && typeof G.sceneBegin === 'undefined'
        && typeof G.sceneStart === 'undefined' && typeof G.scenePick === 'undefined'
        && typeof G.sceneEscape === 'undefined' && typeof G.DATA.SCENE_FLOW === 'undefined'
        && typeof G.map.paintScene === 'undefined' && typeof G.map.SCENE_KEYS === 'undefined'
        && typeof G.ui.openSceneFx === 'undefined' && typeof G.ui.renderSceneFx === 'undefined';
    })());
    G.ui.closeAllModals();
    await sleep(60);
  }

"""

reps = [('A', A_S, A_E, A_NEW), ('B', B_S, B_E, B_NEW), ('C', C_S, C_E, C_NEW)]
changed = 0
for name, s_mark, e_mark, new in reps:
    cs = src.count(s_mark)
    ce = src.count(e_mark)
    if cs == 0 or ce == 0:
        if new in src:
            print('[%s] 已是新口径，幂等跳过' % name); continue
        print('[%s] !! 边界未命中  start=%d end=%d —— 中止' % (name, cs, ce)); sys.exit(2)
    if cs != 1 or ce != 1:
        print('[%s] !! 边界不唯一  start=%d end=%d —— 中止' % (name, cs, ce)); sys.exit(3)
    i = src.index(s_mark)
    j = src.index(e_mark)
    if j <= i:
        print('[%s] !! 边界顺序异常 —— 中止' % name); sys.exit(4)
    src = src[:i] + new + src[j:]
    changed += 1
    print('[%s] 重写 %d 字节 -> %d 字节' % (name, j - i, len(new)))

if changed == 0:
    print('无改动，退出'); sys.exit(0)

tmp = P + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
    f.write(src)
os.replace(tmp, P)
print('[write] ok  %d -> %d 字节' % (n0, len(src)))
