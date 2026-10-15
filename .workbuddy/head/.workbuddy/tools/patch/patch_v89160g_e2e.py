# -*- coding: utf-8 -*-
"""v89.160 补丁 G：e2e 新增 §160（真 DOM + 真 tick）"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'e2e-test.js'
s = io.open(R + P, 'r', encoding='utf-8', newline='').read()
GUARD = '§160. 逾溢折损 / 自动升级顺延（v89.160'
if GUARD in s:
    print('  [skip] e2e §160 已落盘'); sys.stdout.flush()
else:
    ANCHOR = "  return finish();\n}"
    assert s.count(ANCHOR) == 1
    BLOCK = r"""  console.log('\n--- §160. 逾溢折损 / 自动升级顺延（v89.160 · 真实 DOM） ---');
  {
    /* ① 真渲染：仓库面板给出折损规则与"当前超出上限" */
    const c160 = G.currentCity();
    const cap160 = G.storeCapOf(c160);
    const bkG160 = c160.res.grain, bkAt160 = G.state.overflowAt, bkW160 = G.state.world.elapsed;
    c160.res.grain = cap160 + 123456;
    G.ui.openStore();
    let m160 = document.querySelector('#modal-root').innerHTML;
    check('v89.160① 仓库面板真渲染「逾溢折损」规则 + 当前超出上限',
      m160.indexOf('逾溢折损') >= 0 && m160.indexOf('当前超出上限') >= 0 && m160.indexOf('游戏日折损') >= 0);
    G.ui.closeAllModals();
    /* 侧栏悬停（title）在超上限时写明折损 */
    G.ui.renderSide();
    const amt160 = document.querySelector('#res-bar .res-line .amt');
    check('v89.160① 侧栏资源悬停写明「已超上限 …每游戏日折损 25%」',
      !!amt160 && (amt160.getAttribute('title') || '').indexOf('已超上限') >= 0,
      amt160 ? (amt160.getAttribute('title') || '').slice(0, 60) : '无 .amt');
    c160.res.grain = bkG160;

    /* ② 真 tick：推 1 游戏日 → tickOnce 里结算出灾种公文 + 掉 25% */
    const c2 = G.currentCity();
    if (G.state.overflowAt == null) G.settleOverflowRot();
    G.state.overflowAt = G.state.world.elapsed;
    G.state.world.elapsed += 86400;                 /* 推进 1 游戏日（tick 会再过 1 秒） */
    c2.res.grain = G.storeCapOf(c2) + 100000;
    const bkGold160 = c2.res.gold;
    c2.res.gold = 9e9;
    const gm160 = c2.res.grain;
    G.tickOnce();
    const L160 = G.state.msgLog || [];
    const tail160 = (L160[L160.length - 1] || {}).msg || '';
    const named160 = (G.DATA.OVERFLOW.events || []).some((e) => tail160.indexOf(e.name) >= 0);
    check('v89.160① 真 tick 结算：公文出灾种行「…损失 粮食 X…」',
      named160 && tail160.indexOf('损失') >= 0, tail160.slice(0, 70));
    check('v89.160① 真 tick 后的存量 = 超出部分掉 25%（cap+100000 → cap+75000）',
      Math.abs(c2.res.grain - (G.storeCapOf(c2) + 75000)) < 5000,
      'grain ' + Math.round(c2.res.grain) + ' · cap ' + Math.round(G.storeCapOf(c2)));
    check('v89.160① 黄金豁免', c2.res.gold >= 9e9 - 1e6, 'gold ' + Math.round(c2.res.gold));
    c2.res.gold = bkGold160;

    /* ③ 自动升级：贵项在前也不挡路（真环境 · 同一个池子） */
    const st160 = G.state, city160 = G.currentCity();
    const bkQ160 = (st160.queues.build || []).slice();
    const bkAuto160 = st160.settings.autoUpgrade, bkAutoSt160 = st160.autoState;
    try {
      city160.cells.forEach((x) => { if (x.build && x.build.id !== 'guanfu') x.build = null; });
      city160.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 4; });
      G.extGridOf(city160).forEach((e) => { e.type = null; e.lv = 0; e.pending = null; });
      city160.cells[0].build = { id: 'tiejiangpu', lvl: 1 };
      city160.cells[1].build = { id: 'minfang', lvl: 1 };
      if (G.wallSlotOf(city160).build) G.wallSlotOf(city160).build = null;
      const cm160 = G.DATA.BUILDINGS.minfang.levelCost(1);
      ['grain', 'wood', 'stone', 'iron'].forEach((k) => { G.res(city160)[k] = cm160[k] || 0; });
      st160.settings.autoUpgrade = true;
      st160.queues.build = [];
      const r160 = G.autoUpgrade();
      check('v89.160② 真环境：顺延过贵的（铁匠铺）→ 命中便宜的（民房）',
        !!(r160 && r160.ok && r160.target && r160.target.idx === 1 && /民房/.test(r160.target.name || '')),
        r160 && r160.target ? r160.target.name + ' idx' + r160.target.idx : '无动作');
    } finally {
      st160.queues.build = bkQ160;
      city160.cells.forEach((x) => { x.pending = null; });
      st160.settings.autoUpgrade = bkAuto160; st160.autoState = bkAutoSt160;
      st160.overflowAt = bkAt160; st160.world.elapsed = bkW160;
    }
  }

"""
    s = s.replace(ANCHOR, BLOCK + ANCHOR)
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s)
    print('  [ ok ] e2e §160 已插入（5 条断言）'); sys.stdout.flush()
print('补丁 G 完成。')
