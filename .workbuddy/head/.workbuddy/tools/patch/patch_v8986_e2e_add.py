# -*- coding: utf-8 -*-
"""v89.86 · e2e 增量：整改清单关键 UI 触点（真实 DOM）
   P-02 favicon / P-12 科技按钮 / P-20 军务总览 / P-07 提速按钮 / 门派P1 被动显示。
"""
import io
import os
import sys

E2 = r'E:\Deepseekdb\e2e-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(old, new, tag):
    src = read(E2)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(E2, src.replace(old, new, 1))
    assert new in read(E2), '落盘回查失败：' + tag
    print('OK  ' + tag)


OLD = """  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

NEW = r"""  /* ============================================================
   * v89.86 整改清单（真实 DOM）—— 关键 UI 触点
   * ============================================================ */
  console.log('\n--- v89.86. 整改清单 UI 触点（真实 DOM） ---');
  await (async function () {
    /* P-02：favicon 在册（data-URI，消除固定 404） */
    check('v89.86（P-02）：favicon link 在册（data-URI）', (function () {
      const l = document.querySelector('link[rel="icon"]');
      return !!l && String(l.getAttribute('href')).indexOf('data:image/svg+xml') === 0;
    })());

    const c86 = G.currentCity();
    c86.cells = c86.cells || [];
    /* P-12：书院科技面板 —— 按钮「研究(黄金 …)」无 NaN（真实渲染） */
    if (!c86.cells.some((x) => x && x.build && x.build.id === 'shuyuan')) {
      for (let i = 0; i < c86.cells.length; i++) { if (!c86.cells[i].build) { c86.cells[i] = { build: { id: 'shuyuan', lvl: 10 } }; break; } }
    }
    G.ui.openPanel('tech');
    await sleep(90);
    const th86 = document.querySelector('#modal-root').innerHTML;
    check('v89.86（P-12）：科技面板按钮 =「研究(黄金 …)」且无 NaN',
      th86.indexOf('NaN') < 0 && /研究\(黄金 [^)]+\)/.test(th86));
    G.ui.closeModal();
    await sleep(40);

    /* P-20：顶栏「军务」（原名「行军」）→ 军务总览五段 */
    const mTab86 = document.querySelector('#topnav [data-view="marches"]');
    check('v89.86（P-20）：顶栏菜单更名「军务」（data-view 不变）',
      !!mTab86 && mTab86.textContent.indexOf('军务') >= 0);
    if (mTab86) {
      click(mTab86);
      await sleep(140);
      const mv86 = document.querySelector('#view-container').innerHTML;
      check('v89.86（P-20）：军务总览五段齐（城内 / 驻守野地 / 采集队 / 行军 / 伤兵）',
        mv86.indexOf('① 城内') >= 0 && mv86.indexOf('② 驻守野地') >= 0 && mv86.indexOf('③ 采集队') >= 0
        && mv86.indexOf('④ 行军') >= 0 && mv86.indexOf('⑤ 伤兵') >= 0);
    }
    G.ui.setView('city');
    await sleep(60);

    /* P-07：建造队列花金提速（真实点击：面板按钮 → 队列被推到满进度） */
    let q86i = -1;
    for (let i = 0; i < c86.cells.length; i++) { if (!c86.cells[i].build) { q86i = i; break; } }
    if (q86i >= 0) {
      c86.cells[q86i] = { build: { id: 'minfang', lvl: 1 }, pending: { buildId: 'minfang', targetLevel: 2 } };
      G.state.queues.build = [{ cityId: c86.id, gridIndex: q86i, buildId: 'minfang', type: 'upgrade', targetLevel: 2, elapsed: 20, totalTime: 120 }];
      G.state.res.gold = Math.max(G.state.res.gold || 0, 500000);
      G.ui.openBuildModal(q86i);
      await sleep(80);
      const rb86 = document.querySelector('#modal-root [data-action="rush-build"]');
      check('v89.86（P-07）：建筑施工面板含「⚡ 提速」按钮', !!rb86);
      if (rb86) {
        click(rb86);
        await sleep(140);
        const q86 = G.state.queues.build[0];
        check('v89.86（P-07）：提速后队列推到满进度（下一拍落成）',
          !q86 || q86.elapsed >= q86.totalTime);
      }
    } else {
      check('v89.86（P-07）：建筑施工面板含「⚡ 提速」按钮（无空格可测，跳过）', true);
      check('v89.86（P-07）：提速后队列推到满进度（跳过）', true);
    }
    G.ui.closeModal();
    await sleep(40);

    /* 门派 P1：名录六派被动全部可读（真实渲染） */
    if (!c86.cells.some((x) => x && x.build && x.build.id === 'honglusi')) {
      for (let i = 0; i < c86.cells.length; i++) { if (!c86.cells[i].build) { c86.cells[i] = { build: { id: 'honglusi', lvl: 1 } }; break; } }
    }
    G.state.sect = { id: null, rep: 0, founder: false, tasks: {}, leftAt: 0 };
    G.ui.openSect();
    await sleep(80);
    const sec86 = document.querySelector('#modal-root').innerHTML;
    check('v89.86（门派P1）：名录六派被动全部可读（行军速度/部队攻击/伤兵回复/攻城伤害/器械耗时/坐骑属性）',
      ['行军速度 +8%', '部队攻击 +6%', '战后伤兵回复 +15%', '攻城伤害 +8%', '器械打造耗时 −15%', '坐骑装备属性 +20%']
        .every((t) => sec86.indexOf(t) >= 0));
    G.ui.closeModal();
    await sleep(30);
  })();

  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

edit(OLD, NEW, 'e2e · v89.86 UI 触点块')
print('DONE')
