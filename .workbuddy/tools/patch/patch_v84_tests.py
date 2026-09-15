# -*- coding: utf-8 -*-
"""v84 · 测试补丁：smoke 改判 v37 卡面行数断言（2 → 1）+ 新增 §69；e2e 新增 v84 段。

- v37 起 smoke 有一条断言逐卡会计卡面 `.tstat` 行数（3→2）——v84 删「拥有」行
  后必须改判为 1，并顺带断言卡面无「拥有」（防回潮）。这是"改卡面结构先回扫
  渲染即断言"清单的一部分（备忘 §24.1 / §二十七）。
- §69 / e2e 段：静态 + 实测双口径（分类对调后两页互斥、卡面绝迹「拥有」）。
"""
import io
import sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== A. smoke：v37 断言改判（卡面行数 2 → 1） ==')
patch(
    SMOKE,
    '       ① 卡面 .tstat 由 3 行降为 2 行（成本行腾给图标）',
    '       ① 卡面 .tstat 由 3 行降为 2 行（成本行腾给图标）；v84 再降为 1 行（拥有行退役）',
    'A1 注释①行',
    probe='v84 再降为 1 行',
)
patch(
    SMOKE,
    """       注意"拥有"行的锁定原因里本来就可能出现"人口不足"这类词，
       所以只查结构化行，不做全文词命中。 */""",
    """       注意未解锁原因类词（"人口不足"等）本属浮层内容，卡面判据只查结构化行；
       v84 起卡面只剩 1 行 .tstat，"拥有"字样在卡面彻底绝迹。 */""",
    'A2 注释尾两行',
    probe='在卡面彻底绝迹',
)
patch(
    SMOKE,
    "    return stats.length === 2 && face.indexOf('耗粮') < 0;",
    "    return stats.length === 1 && face.indexOf('耗粮') < 0 && face.indexOf('拥有') < 0;",
    'A3 判据行 2 → 1',
    probe="stats.length === 1 && face.indexOf('耗粮')",
)

SEC69 = r'''/* ============================================================
 * 69. v84（老板）：兵种卡去「拥有」行 / 辎重车→骑兵、斥候→步兵
 * ============================================================ */
console.log('\n===== 69. v84 卡面去拥有行 · 步骑分类对调 =====');
(function () {
  var uS84v = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));

  console.log('  --- ① 兵种卡去「拥有」行 ---');
  check('v84：troopsHTML 源码不再输出「拥有：N」行（整行退役）', (function () {
    var th = codeOf(uS84v, 'ui.troopsHTML = function');
    return th.indexOf('拥有') < 0 && th.indexOf('tstat') >= 0;
  })());
  check('v84：未解锁原因仍在悬停浮层，读数变量退役', (function () {
    var th = codeOf(uS84v, 'ui.troopsHTML = function');
    return /tip-a/.test(th) && /chk\.msg/.test(th) && th.indexOf('var own') < 0;
  })());
  check('实测：步兵 / 骑兵页卡面 HTML 均无「拥有」', (function () {
    var bkF = G.ui._trainFilter, bkT = G.ui._trainTab, bkS = G.ui._trainSel;
    G.ui._trainFilter = 'normal';
    var ok = ['inf', 'cav'].every(function (tab) {
      G.ui._trainTab = tab;
      return G.ui.troopsHTML().indexOf('拥有') < 0;
    });
    G.ui._trainFilter = bkF; G.ui._trainTab = bkT; G.ui._trainSel = bkS;
    return ok;
  })());

  console.log('  --- ② 步骑分类对调（辎重车→骑兵 / 斥候→步兵） ---');
  check('v84：斥候归步兵、辎重车归骑兵（cat 仅决定分页归属）',
    DATA.TROOPS.chihou.cat === 'inf' && DATA.TROOPS.zhouche.cat === 'cav');
  check('实测：斥候卡在步兵页、辎重车卡在骑兵页（两页互斥）', (function () {
    var bkF = G.ui._trainFilter, bkT = G.ui._trainTab, bkS = G.ui._trainSel;
    G.ui._trainFilter = 'normal';
    G.ui._trainTab = 'inf';
    var hInf = G.ui.troopsHTML();
    G.ui._trainTab = 'cav';
    var hCav = G.ui.troopsHTML();
    G.ui._trainFilter = bkF; G.ui._trainTab = bkT; G.ui._trainSel = bkS;
    var card = function (h, id) {
      return new RegExp('<div class="troop-card[^>]*data-troop="' + id + '"').test(h);
    };
    return card(hInf, 'chihou') && !card(hCav, 'chihou')
      && card(hCav, 'zhouche') && !card(hInf, 'zhouche');
  })());
})();

'''
patch(
    SMOKE,
    "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    SEC69 + "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    'B1 追加 §69',
    probe='69. v84 卡面去拥有行',
)

E2ESEC = r'''
  /* ============================================================
   * v84（老板）：兵种卡去「拥有」行 / 辎重车→骑兵、斥候→步兵
   * ============================================================ */
  console.log('\n--- v84. 卡面去拥有行 · 步骑分类对调（真实 DOM） ---');
  {
    const c84 = G.state.cities[0];
    let j84 = c84.cells.findIndex((x) => x.build && x.build.id === 'junying');
    if (j84 < 0) {
      j84 = c84.cells.findIndex((x) => !x.build && !x.official);
      if (j84 >= 0) c84.cells[j84] = { build: { id: 'junying', lvl: 8 }, pending: null };
    }
    G.ui._trainFilter = 'normal';
    G.ui._trainTab = 'inf';
    G.ui.openTroops(j84 < 0 ? undefined : j84, 'normal');
    await sleep(160);
    check('v84：斥候卡已入步兵页', !!document.querySelector('#modal-root .troop-card[data-troop="chihou"]'));
    check('v84：全部兵种卡面无「拥有」字样', (function () {
      const cards = document.querySelectorAll('#modal-root .troop-grid .troop-card');
      if (!cards.length) return false;
      return Array.prototype.every.call(cards, (cd) => cd.textContent.indexOf('拥有') < 0);
    })());
    click(document.querySelector('#modal-root [data-action="train-tab"][data-page="cav"]'));
    await sleep(150);
    check('v84：辎重车卡在骑兵页（与斥候两页互斥）', (function () {
      const z84 = document.querySelector('#modal-root .troop-card[data-troop="zhouche"]');
      const ch84 = document.querySelector('#modal-root .troop-card[data-troop="chihou"]');
      return !!z84 && !ch84;
    })());
    G.ui.closeModal();
    await sleep(60);
  }

'''
patch(
    E2E,
    "  await sleep(30);\n\n  G.ui.setView('city');",
    E2ESEC + "  await sleep(30);\n\n  G.ui.setView('city');",
    'C1 追加 v84 段',
    probe='v84：辎重车卡在骑兵页',
)

print()
print('全部完成。')
