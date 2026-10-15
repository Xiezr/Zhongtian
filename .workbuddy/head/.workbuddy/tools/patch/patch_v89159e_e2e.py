# -*- coding: utf-8 -*-
"""v89.159 补丁 E：e2e 新增 §159 节（真实 DOM）
① 升级回满（真环境 + 公文行）
② 建筑面板：多座民房混级 → 本座给「升级」键（真渲染）
③ 上限行"受官府 LvN 限制"（真渲染 · 主城 + 爵位解锁场景）"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'e2e-test.js'
s = io.open(R + P, 'r', encoding='utf-8', newline='').read()
GUARD = '§159. 升级回满 / 本座门槛 / 严格总闸（v89.159'
if GUARD in s:
    print('  [skip] e2e §159 已落盘'); sys.stdout.flush()
else:
    ANCHOR = "  return finish();\n}"
    assert s.count(ANCHOR) == 1, s.count(ANCHOR)
    BLOCK = r"""  console.log('\n--- §159. 升级回满 / 本座门槛 / 严格总闸（v89.159 · 真实 DOM） ---');
  {
    /* ① 升级即回满（真环境 · 走唯一升级出口 gainExp） */
    const g159 = (G.state.generals || []).filter((x) => !x.isLord)[0];
    if (!g159) {
      check('v89.159① 找到非君主将领（前置）', false);
    } else {
      const bk159 = { lv: g159.level, exp: g159.exp, sta: g159.stamina, ene: g159.energy };
      try {
        G.setStaNow(g159, Math.round(G.staMax(g159) * 0.2));
        G.setEnergyNow(g159, Math.round(G.energyMaxOf(g159) * 0.2));
        G.battle.gainExp(g159, G.expNeedOf(g159) + 1, 'e2e159');
        check('v89.159① 升级 → 体力/精力双双回满（真环境）',
          G.staNow(g159) === G.staMax(g159) && G.energyNowOf(g159) === G.energyMaxOf(g159),
          'sta ' + G.staNow(g159) + '/' + G.staMax(g159));
        const hitMsg = (G.state.msgLog || []).some((r) => String((r && r.msg) || '').indexOf('升级刷新') >= 0);
        check('v89.159① 公文留痕「升级刷新…已回满」', hitMsg);
      } finally {
        g159.level = bk159.lv; g159.exp = bk159.exp; g159.stamina = bk159.sta; g159.energy = bk159.ene;
      }
    }

    /* ② 建筑面板：多座民房 Lv4 + Lv3 混存（官府 4）→ 本座按自己的等级给键 */
    const c159 = G.makeCity({ id: 'e2e159', name: 'e2e159城', x: 610, y: 610, type: 'self' });
    const bkQ159 = (G.state.queues.build || []).slice();
    const bkCity159 = G.ui._cityId, bkRes159 = {};
    G.state.cities.push(c159);
    try {
      G.ui._cityId = c159.id;                      /* s.res 是**当前城**的 getter */
      ['grain', 'wood', 'stone', 'iron'].forEach((k) => { bkRes159[k] = G.state.res[k]; G.state.res[k] = 1e9; });
      const cells159 = [];
      c159.cells.forEach((x, i) => { if (x.build && x.build.id === 'minfang') cells159.push(i); });
      c159.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
      if (cells159.length >= 2) {
        c159.cells[cells159[0]].build.lvl = 4;
        c159.cells[cells159[1]].build.lvl = 3;
        G.ui.openBuildModal(cells159[1]);           /* 点 Lv3 那座 */
        let m = document.querySelector('#modal-root').innerHTML;
        check('v89.159② 面板（Lv3 那座）给「升级」键（不再误报需官府）',
          m.indexOf('confirm-upgrade') >= 0 && m.indexOf('需官府') < 0);
        G.ui.openBuildModal(cells159[0]);           /* 点 Lv4 那座 */
        m = document.querySelector('#modal-root').innerHTML;
        check('v89.159② 面板（Lv4 那座）如实报「需官府 Lv5」', m.indexOf('需官府 Lv5') >= 0);
      } else {
        check('v89.159② 城里有 ≥2 座民房（前置）', false);
      }
    } finally {
      G.state.cities = G.state.cities.filter((x) => x.id !== 'e2e159');
      G.state.queues.build = bkQ159.slice();
      ['grain', 'wood', 'stone', 'iron'].forEach((k) => { if (bkRes159[k] != null) G.state.res[k] = bkRes159[k]; });
      G.ui._cityId = bkCity159;
      G.ui.closeAllModals();
    }

    /* ③ 上限行：主城 + 爵位解锁 + 官府没跟上 → 写「受官府 LvN 限制」 */
    const c159b = G.makeCity({ id: 'e2e159b', name: 'e2e159b城', x: 611, y: 611, type: 'self' });
    const bkMain159 = G.state.mainCityId, bkRank159 = G.state.rank;
    G.state.cities.push(c159b);
    try {
      G.ui._cityId = c159b.id;
      G.state.mainCityId = c159b.id; G.state.rank = 5;
      c159b.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 8; });
      const mi159 = c159b.cells.findIndex((x) => x.build && x.build.id === 'minfang');
      G.ui.openBuildModal(mi159 >= 0 ? mi159 : 0);
      const m3 = document.querySelector('#modal-root').innerHTML;
      check('v89.159③ 上限行写明「受官府 Lv8 限制 · 升官府可提升」（真渲染）',
        m3.indexOf('受官府 Lv') >= 0 && m3.indexOf('升官府可提升') >= 0);
    } finally {
      G.state.cities = G.state.cities.filter((x) => x.id !== 'e2e159b');
      G.state.mainCityId = bkMain159; G.state.rank = bkRank159;
      G.ui._cityId = bkCity159;
      G.ui.closeAllModals();
    }
  }

"""
    s = s.replace(ANCHOR, BLOCK + ANCHOR)
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s)
    print('  [ ok ] e2e §159 已插入（4 条断言）'); sys.stdout.flush()
print('补丁 E 完成。')
