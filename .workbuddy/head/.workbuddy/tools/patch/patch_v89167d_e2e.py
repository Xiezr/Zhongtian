# -*- coding: utf-8 -*-
"""v89.167d：e2e 插入 §167（自动升级每城独立 · 真实 DOM 真调）。
   运行：python .workbuddy/tools/patch/patch_v89167d_e2e.py"""
import io

R = 'E:/Deepseekdb/'
p = R + 'e2e-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

if 'v89.167 ★ 一次调用每城都排上' in s:
    print('  [skip] §167 e2e 已插')
    raise SystemExit(0)

ANCHOR = "  return finish();\n}"
assert s.count(ANCHOR) == 1, '锚点计数=%d' % s.count(ANCHOR)

NEW = '''  /* ============================================================
   * v89.167（老板）：「自动升级建造，应该每个城池均遍历，分别升级，
   *   而不是所有城池一起，总共只升级 3 个建筑」—— 真实 DOM 真调
   * ============================================================ */
  console.log('\\n--- §167. 自动升级 · 每城独立建造位（v89.167 · 真实 DOM） ---');
  await (async function () {
    const st = G.state;
    const bkAuto167 = st.settings.autoUpgrade;
    const bkQ167 = st.queues.build.slice();
    try {
      st.rank = Math.max(st.rank || 0, 6);           /* 领地上限随爵位（已有 §166 造的第二城） */
      /* 各城：官府 lv3 + 民房×4（lv1，最便宜、必可升）+ 资源（v89.161：花费按城） */
      st.cities.forEach((c) => {
        c.cells.forEach((x) => { if (x.build && !x.official) x.build = null; });
        let gi = -1;
        for (let i = 0; i < c.cells.length; i++) { if (c.cells[i].official) { gi = i; break; } }
        if (gi < 0) return;
        c.cells[gi].build = { id: 'guanfu', lvl: 3 };
        let put = 0;
        for (let i = 0; i < c.cells.length && put < 4; i++) {
          if (c.cells[i].official || c.cells[i].build) continue;
          c.cells[i].build = { id: 'minfang', lvl: 1 };
          put++;
        }
        ['grain', 'wood', 'stone', 'iron'].forEach((k) => { G.res(c)[k] = 600000; });
      });
      G.res(G.currentCity()).gold = 300000;
      check('v89.167 造局：多城就绪（≥2 · 各城 5 候选）', st.cities.length >= 2, st.cities.length + ' 城');

      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      const r167 = G.autoUpgrade();
      const by167 = {};
      st.queues.build.forEach((q) => { by167[q.cityId] = (by167[q.cityId] || 0) + 1; });
      check('v89.167 ★ 一次调用每城都排上（逐城遍历 · 分别升级）',
        st.cities.every((c) => (by167[c.id] || 0) >= 1), JSON.stringify(by167));
      check('v89.167 ★ 各城不超各自建造位（每城独立额度）',
        st.cities.every((c) => (by167[c.id] || 0) <= G.buildSlots(c)),
        JSON.stringify(st.cities.map((c) => G.buildSlots(c))));
      check('v89.167 ★ 排入总数 > 3（改前全境上限 3 的铁证）',
        !!(r167 && r167.count > 3), 'count=' + (r167 && r167.count));
      check('v89.167 状态文案写明「各城独立建造位」',
        /各城独立建造位/.test((st.autoState || {}).msg || ''), (st.autoState || {}).msg);
    } finally {
      st.settings.autoUpgrade = bkAuto167;
      st.queues.build.length = 0;
      bkQ167.forEach((q) => st.queues.build.push(q));
    }
  })();

'''

s = s.replace(ANCHOR, NEW + ANCHOR)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  [ ok ] e2e §167 已插 · 新长度', len(s))
