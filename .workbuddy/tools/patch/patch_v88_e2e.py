# -*- coding: utf-8 -*-
"""v88 e2e 段：双轨切换 / 蕴养面板 / 江湖游历（真实 DOM）。探针幂等。"""
import io

P = r'E:\Deepseekdb\e2e-test.js'
d = io.open(P, encoding='utf-8', newline='').read()

ANCHOR = """    G.ui.closeModal();
    await sleep(60);
  }

  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
  return finish();"""

BLOCK = """    G.ui.closeModal();
    await sleep(60);
  }

  /* ============================================================
   * v88（老板）：灵气双轨装备 + 江湖游历（真实 DOM）
   * ============================================================ */
  console.log('\\n--- v88. 灵气双轨装备 + 江湖游历（真实 DOM） ---');
  {
    const g88 = G.state.generals[0];
    /* 备好两套装备（各一件武器）与精华 */
    const aI88 = G.addEquip('cr_weapon_4', 0);
    G.systems.equipItem(g88.id, aI88);
    const lI88 = G.addEquip('lg_weapon_4', 0);
    G.systems.equipItem(g88.id, lI88);
    G.state.items = G.state.items || {};
    G.state.items.lingsui = 500;
    G.ui._genSel = g88.id;
    G.ui.setView('generals');
    await sleep(220);

    check('v88：装备栏含双轨切换按钮（⚔军中 / ☯修炼）', (function () {
      const vc = document.querySelector('#view-container');
      return !!vc.querySelector('[data-action="toggle-equip-set"][data-set="sha"]')
        && !!vc.querySelector('[data-action="toggle-equip-set"][data-set="ling"]');
    })());
    check('v88：军装模式槽名（武器）+ 12 格', (function () {
      const vc = document.querySelector('#view-container');
      return vc.querySelectorAll('.gen-pane .doll-slot').length === 12
        && vc.querySelector('.gen-pane .doll-slot[data-slot="weapon"]').textContent.indexOf('武器') >= 0;
    })());

    click(document.querySelector('#view-container [data-action="toggle-equip-set"][data-set="ling"]'));
    await sleep(260);
    check('v88：切换后槽名变「灵剑」+ 显示赤霄剑', (function () {
      const vc = document.querySelector('#view-container');
      const slot = vc.querySelector('.gen-pane .doll-slot[data-slot="weapon"]');
      return !!slot && slot.textContent.indexOf('灵剑') >= 0 && slot.textContent.indexOf('赤霄剑') >= 0;
    })());
    check('v88：修炼面板出现（灵力 / 总蕴养 / 灵气精华）', (function () {
      const vc = document.querySelector('#view-container');
      const t = vc.textContent;
      return t.indexOf('灵力') >= 0 && t.indexOf('总蕴养') >= 0 && t.indexOf('灵气精华') >= 0;
    })());
    check('v88：修炼模式显示「☯ 蕴养」按钮', (function () {
      return !!document.querySelector('#view-container [data-action="ling-temper-open"]');
    })());

    /* 蕴养面板（打开 → 列出修炼件 → 关闭） */
    click(document.querySelector('#view-container [data-action="ling-temper-open"]'));
    await sleep(220);
    check('v88：蕴养面板打开并列出赤霄剑（含成本）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('蕴养') >= 0
        && root.textContent.indexOf('赤霄剑') >= 0
        && root.textContent.indexOf('灵气精华') >= 0
        && !!root.querySelector('[data-action="ling-temper-item"]');
    })());
    G.ui.closeModal();
    await sleep(80);

    /* 切回军装（槽名回「武器」） */
    click(document.querySelector('#view-container [data-action="toggle-equip-set"][data-set="sha"]'));
    await sleep(260);
    check('v88：切回军装（槽名回「武器」+ 套装面板在）', (function () {
      const vc = document.querySelector('#view-container');
      const slot = vc.querySelector('.gen-pane .doll-slot[data-slot="weapon"]');
      return !!slot && slot.textContent.indexOf('武器') >= 0 && slot.textContent.indexOf('神兵') >= 0;
    })());

    /* 江湖游历（野地弹窗：区块 + 执行 + 回显） */
    let fp88 = null;
    for (let y = 3; y < 200 && !fp88; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'forest' && !G.map.fortAt(x, y)) { fp88 = { x, y }; break; }
      }
    }
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });
    G.state.jianghu = {};
    G.ui._jhGen = null;
    G.ui.openLandModal(fp88.x, fp88.y);
    await sleep(200);
    check('v88：野地弹窗含江湖区块（活动按钮 ≥3）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && root.querySelectorAll('[data-action="do-jianghu"]').length >= 3;
    })());
    const before88 = G.state.items.lingsui || 0;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="xiu"]'));
    await sleep(300);
    check('v88：执行「修炼」得精华 + 弹窗回显「今日已做」', (function () {
      const root = document.querySelector('#modal-root');
      const gained = (G.state.items.lingsui || 0) - before88;
      return gained > 0 && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());
    G.ui.closeModal();
    await sleep(60);
  }

  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
  return finish();"""

if 'v88. 灵气双轨装备' in d:
    print('SKIP e2e v88 段已存在')
else:
    assert d.count(ANCHOR) == 1, 'e2e 锚点 %d 次' % d.count(ANCHOR)
    d = d.replace(ANCHOR, BLOCK, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK e2e v88 段已加')
