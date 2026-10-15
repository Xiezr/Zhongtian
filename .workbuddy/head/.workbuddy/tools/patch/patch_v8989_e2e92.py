# -*- coding: utf-8 -*-
"""v89.89 · e2e §92 段（真实 DOM：A2 归来报告 / B1 一键全领 / C4 故事集 / D4 战报筛选收藏 / E3 三段条）"""
import io, sys

P = r'E:\Deepseekdb\e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

ANCHOR = """  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

NEW = """  /* ============================================================
   * 92. v89.89（v6 期待清单）：归来报告 / 一键全领 / 故事集 / 战报筛选 / 人口三段条
   * ------------------------------------------------------------
   * 真实 DOM：弹窗与页面渲染 + 点击链路（本段为收尾段，可放心做真实操作）。
   * ============================================================ */
  console.log('\\n--- 92. v89.89 期待清单（A2/B1/C4/D4/E3）---');
  {
    const s92 = G.state;

    /* ① A2 归来报告：塞报告 → 打开 → DOM 断言 → 关闭 */
    G._offlineReport = { secReal: 7200, applied: 7200, overflow: 0, capDays: 7,
      res: { grain: 999, wood: 0, stone: 0, iron: 0, gold: 0, pop: 0 },
      done: { build: 1, tech: 0, train: 0 },
      reports: ['E2E 归来战报'], reportsN: 1, wounded: 0, marchMsg: '' };
    G.ui.openOfflineReport();
    await sleep(60);
    const mr92 = document.querySelector('#modal-root');
    const h92 = mr92 ? mr92.textContent : '';
    check('v89.89（A2）：归来报告弹窗（DOM · 分类块）',
      h92.indexOf('归来报告') >= 0 && h92.indexOf('资源净变') >= 0
        && h92.indexOf('在办完成') >= 0 && h92.indexOf('E2E 归来战报') >= 0,
      h92.replace(/\\s+/g, ' ').slice(0, 64));
    const close92 = mr92 && mr92.querySelector('[data-action="close-modal"]');
    if (close92) click(close92);
    await sleep(40);
    G._offlineReport = null;

    /* ② B1 一键全领：任务页渲染 + 真实点击（mock 两条达标任务） */
    const og92 = G.questGoal, oa92 = G.questAmount;
    const q1_92 = G.DATA.QUESTS[0], q2_92 = G.DATA.QUESTS[1];
    G.ui.setView('tasks');
    await sleep(60);
    G.questGoal = (q) => (q === q1_92 || q === q2_92) ? 5 : og92(q);
    G.questAmount = (q) => (q === q1_92 || q === q2_92) ? 9 : oa92(q);
    G.ui.renderView('tasks');
    await sleep(60);
    const allBtn92 = document.querySelector('[data-action="quest-claim-all"]');
    check('v89.89（B1）：任务页「一键全领」按钮在场', !!allBtn92);
    if (allBtn92) {
      const before92 = Object.keys(s92.quests.done || {}).length;
      click(allBtn92);
      await sleep(80);
      const after92 = Object.keys(s92.quests.done || {}).length;
      check('v89.89（B1）：一键全领入账（done 增加 ≥ 2）', after92 - before92 >= 2,
        before92 + ' → ' + after92);
    } else {
      check('v89.89（B1）：一键全领入账（done 增加 ≥ 2）', false, '按钮缺失');
    }
    G.questGoal = og92; G.questAmount = oa92;

    /* ③ D4 战报筛选 + 收藏（真实 DOM 点击） */
    s92.reports.unshift({ t: Date.now(), title: 'E2E 胜报甲', body: 'x', win: true });
    s92.reports.unshift({ t: Date.now(), title: 'E2E 败报乙', body: 'x', win: false });
    G.ui._repFilter = 'all';
    G.ui.setView('reports');
    await sleep(80);
    const chipLose = document.querySelector('[data-action="rep-filter"][data-v="lose"]');
    check('v89.89（D4）：战报筛选 chips 在场（含 收藏）',
      !!chipLose && !!document.querySelector('[data-action="rep-filter"][data-v="fav"]'));
    if (chipLose) {
      click(chipLose);
      await sleep(80);
      const vc92 = document.querySelector('#view-container');
      const tv92 = vc92 ? vc92.textContent : '';
      check('v89.89（D4）：点击筛选「败」只显败报',
        tv92.indexOf('E2E 败报乙') >= 0 && tv92.indexOf('E2E 胜报甲') < 0,
        tv92.replace(/\\s+/g, ' ').slice(0, 56));
    } else {
      check('v89.89（D4）：点击筛选「败」只显败报', false, 'chip 缺失');
    }
    G.ui.setRepFilter('all');
    await sleep(60);
    const favBtn92 = document.querySelector('[data-action="rep-fav"]');
    check('v89.89（D4）：行内收藏星标在场', !!favBtn92);
    if (favBtn92) {
      const fi = Number(favBtn92.dataset.i);
      const beforeFav = !!s92.reports[fi].fav;
      click(favBtn92);
      await sleep(70);
      check('v89.89（D4）：点击收藏翻转（随档字段）', !!s92.reports[fi].fav === !beforeFav,
        'fav ' + beforeFav + ' → ' + s92.reports[fi].fav);
      s92.reports[fi].fav = false;
    } else {
      check('v89.89（D4）：点击收藏翻转（随档字段）', false, '星标缺失');
    }
    s92.reports = s92.reports.filter((r) => !/^E2E /.test(r.title));

    /* ④ C4 故事集：渲染 + 点击重读（真实 DOM） */
    const st0_92 = G.SG.list()[0];
    const bakRec92 = s92.stories ? s92.stories[st0_92.id] : undefined;
    if (!s92.stories) s92.stories = {};
    s92.stories[st0_92.id] = { done: ['e1'], n: 2, grade: 'good' };
    G.ui.setView('story');
    await sleep(90);
    const vc92b = document.querySelector('#view-container');
    const hs92 = vc92b ? vc92b.textContent : '';
    check('v89.89（C4）：史册页故事集区块（已读 1 / N）',
      hs92.indexOf('故事集') >= 0 && hs92.indexOf('《' + st0_92.title + '》') >= 0,
      hs92.replace(/\\s+/g, ' ').slice(0, 56));
    const rBtn92 = document.querySelector('[data-action="story-read-at"]');
    check('v89.89（C4）：已读篇目重读入口在场', !!rBtn92);
    if (rBtn92) {
      click(rBtn92);
      await sleep(90);
      const fx92 = document.querySelector('#story-fx');
      check('v89.89（C4）：点击重读 → 阅读器打开', !!fx92 && fx92.style.display === 'block');
      const exit92 = fx92 && fx92.querySelector('[data-action="story-exit"]');
      if (exit92) click(exit92); else G.SG.close();
      await sleep(60);
    } else {
      check('v89.89（C4）：点击重读 → 阅读器打开', false, '重读按钮缺失');
    }
    if (bakRec92 === undefined) delete s92.stories[st0_92.id]; else s92.stories[st0_92.id] = bakRec92;

    /* ⑤ E3 人口三段条（真实 DOM：募兵页兵种卡） */
    G.ui._trainTab = 'inf'; G.ui._trainFilter = 'normal';
    G.ui.setView('troops');
    await sleep(90);
    const pop3 = document.querySelector('.pop-3');
    check('v89.89（E3）：募兵页人口三段条在场', !!pop3,
      pop3 ? pop3.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60) : '缺失');
    check('v89.89（E3）：三段文字齐（可征/上限/增势）',
      !!pop3 && /可征/.test(pop3.textContent) && /上限/.test(pop3.textContent) && /增势/.test(pop3.textContent));
    G.ui._trainTab = 'que';
  }

  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

assert s.count(ANCHOR) == 1, ('anchor', s.count(ANCHOR))
io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(ANCHOR, NEW, 1))
print('OK e2e §92 段写入')
