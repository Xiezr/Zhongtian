# -*- coding: utf-8 -*-
"""v89.166b：e2e 插入 §166（进入城池 → 菜单全关 + 城内大界面 · 点真按钮）。
   运行：python .workbuddy/tools/patch/patch_v89166b_e2e.py"""
import io

R = 'E:/Deepseekdb/'
p = R + 'e2e-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

if 'v89.166 ★ 点「进入城池」→ 菜单全关' in s:
    print('  [skip] §166 e2e 已插')
    raise SystemExit(0)

ANCHOR = "  return finish();\n}"
assert s.count(ANCHOR) == 1, '锚点计数=%d' % s.count(ANCHOR)

NEW = '''  /* ============================================================
   * v89.166（老板）：「地图上点我方城市 → 城池面板 → 点『进入城池』→
   *   城市菜单界面应关闭，直接显示城内大界面」—— 真 DOM · 点真按钮
   * ============================================================ */
  console.log('\\n--- §166. 进入城池 = 菜单全关 + 城内大界面（v89.166 · 真实 DOM） ---');
  await (async function () {
    const st = G.state;
    G.ui.closeAllModals();
    await sleep(40);
    if (!st.map.grid) G.map.generate();
    /* 造第二城（验证"切过去"；建城成本各 10000，先补资源） */
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { G.res(G.currentCity())[k] = 200000; });
    G.res(G.currentCity()).gold = 200000;
    let c2 = null;
    for (let y = 1; y < (G.DATA.MAP_H || 40) - 1 && !c2; y++) {
      for (let x = 1; x < (G.DATA.MAP_W || 40) - 1 && !c2; x++) {
        const t = G.map.tile(x, y);
        if (!t || t.terrain !== 'plain') continue;
        if ((st.wilds || []).some((w) => w.x === x && w.y === y)) continue;
        st.wilds.push({ x, y, type: 'plain', lv: 3 });
        try { G.buildCityAt(x, y); } catch (e) { }
        if (st.cities.length >= 2) c2 = st.cities[1];
      }
    }
    check('v89.166 造局：第二城已建（用于验证"切过去"）', !!c2, c2 ? c2.name : '未建成');
    if (!c2) return;
    const bkCity166 = G.ui._cityId, bkView166 = G.ui.view;
    try {
      /* 与"地图点我城"同一入口打开城池面板 */
      G.ui.openCityPanel(c2);
      await sleep(60);
      const btn166 = document.querySelector('#modal-root [data-action="city-enter"]');
      check('v89.166 城池面板含「进入城池」（真渲染）', !!btn166);
      check('v89.166 面板打开中（弹窗在 · 栈深 ' + ((G.ui._modalStack || []).length) + '）',
        !!document.querySelector('#modal-root .inner-panel'));
      if (btn166) {
        btn166.click();
        await sleep(90);
        const hasModal166 = !!document.querySelector('#modal-root .inner-panel');
        const stack166 = (G.ui._modalStack || []).length;
        check('v89.166 ★ 点「进入城池」→ 菜单全关（无残留弹窗 · 栈清空）',
          !hasModal166 && stack166 === 0, 'modal=' + hasModal166 + ' stack=' + stack166);
        check('v89.166 ★ 视图已切到城内大界面（view=city）', G.ui.view === 'city', G.ui.view);
        check('v89.166 ★ 当前城已切为目标城', !!(G.currentCity() && G.currentCity().id === c2.id),
          G.currentCity() ? G.currentCity().name : '无');
        const vc166 = document.getElementById('view-container');
        check('v89.166 城内大界面真渲染（.city-iso 在）', !!(vc166 && vc166.querySelector('.city-iso')));
      }
    } finally {
      G.ui.setCity(bkCity166);
      G.ui.setView(bkView166);
      G.ui.closeAllModals();
      await sleep(40);
    }
  })();

'''

s = s.replace(ANCHOR, NEW + ANCHOR)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  [ ok ] e2e §166 已插 · 新长度', len(s))
