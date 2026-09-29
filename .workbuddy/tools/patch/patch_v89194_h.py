# -*- coding: utf-8 -*-
"""v89.194 批次H：e2e §194 断言段（藏珍阁视图 + 购买 + 一键集齐 + 将领页两处）"""
import io

R = 'E:/Deepseekdb/'
E2E = R + 'e2e-test.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

MARK = u'§194 藏珍阁视图渲染'
s = rd(E2E)
if s.count(MARK) >= 1:
    print('[skip] e2e §194（已落盘）')
    raise SystemExit(0)

SECTION = u'''  /* ============================================================
   * §194（v89.194）：藏珍阁视图（tab → 真渲染 → 真点购买 → 一键集齐）
   *   + 将领页月俸行 / 城主小签 DOM 冒烟
   * ============================================================ */
  console.log('\\n===== 194. v89.194（藏珍阁 · 月俸行 · 城主标签） =====');
  {
    /* ① tab 存在（静态导航）+ 真渲染（卡 12 / chips 19：全部 + 18 系） */
    const navCol = document.querySelector('#topnav .tab[data-view="collection"]');
    G.ui.setView('collection');
    await sleep(90);
    const colCards = document.querySelectorAll('#view-container .col-card');
    const colChips = document.querySelectorAll('#view-container .col-chip');
    check('§194 藏珍阁视图渲染：导航 tab 在册 · 卡 12 · chips 19（全部+18 系）',
      !!navCol && colCards.length === 12 && colChips.length === 19,
      'nav=' + !!navCol + ' cards=' + colCards.length + ' chips=' + colChips.length);

    /* ② 真点购买：入藏 + 扣金（唯一出口） */
    const buyBtn = document.querySelector('#view-container .col-card .btn[data-action="collect-buy"]');
    let buyOk = false, buyDetail = 'no-btn';
    if (buyBtn) {
      const _bid = buyBtn.getAttribute('data-item');
      G.goldAdd(5000000 - G.goldOf());
      const g0 = G.goldOf();
      buyBtn.click();
      await sleep(220);
      const _it = G.collectItemOf(_bid);
      buyOk = G.collectHaveOf(_bid) === true && (g0 - G.goldOf()) === _it.price;
      buyDetail = _bid + ' 金 ' + g0 + '→' + G.goldOf();
    }
    check('§194 真点购买：入藏 + 扣金（走唯一出口）', buyOk, buyDetail);
    const ownedNow = document.querySelectorAll('#view-container .col-card.owned').length;
    check('§194 已藏卡片出金框（.owned）', ownedNow >= 1, 'owned=' + ownedNow);

    /* ③ 切系列 + 一键集齐（真点；预检总价 → 买齐） */
    const one = Array.from(document.querySelectorAll('#view-container .col-chip[data-c]'))
      .find((x) => x.getAttribute('data-c') !== 'all');
    let seriesOk = false, serDetail = 'no-chip';
    if (one) {
      one.click();
      await sleep(160);
      const serBtn = document.querySelector('#view-container .col-desc [data-action="collect-series"]');
      if (serBtn) {
        G.goldAdd(5000000 - G.goldOf());
        serBtn.click();
        await sleep(260);
        const _d = G.collectSeriesDoneOf(one.getAttribute('data-c'));
        seriesOk = _d.done === true;
        serDetail = one.getAttribute('data-c') + ' ' + _d.have + '/' + _d.total;
      }
    }
    check('§194 切系列 + 一键集齐（真点）：本系 done', seriesOk, serDetail);

    /* ④ 将领页：月俸行在册；城主状态不挂小签（摆选中 → 用完复位） */
    const _gSel = (G.state.generals || []).filter((x) => !G.isLordGeneral(x))[0];
    const _bkStatus = _gSel ? _gSel.status : null;
    if (_gSel) { _gSel.status = 'mayor'; G.ui._genSel = _gSel.id; }
    G.ui.setView('city');
    await sleep(40);
    G.ui.setView('generals');
    await sleep(90);
    const pane194 = document.querySelector('#view-container .gen-pane');
    const salIn = !!pane194 && pane194.innerHTML.indexOf('gp-sal194') >= 0;
    const noStag = !!pane194 && pane194.innerHTML.indexOf('gp-stag') < 0;
    if (_gSel) _gSel.status = _bkStatus;
    check('§194 将领页：月俸行在册 · 城主状态不挂小签（DOM 层）',
      salIn && noStag, 'sal=' + salIn + ' noStag=' + noStag);
  }

  return finish();'''

anchor = u'  return finish();'
c = s.count(anchor)
assert c == 1, 'anchor count=' + str(c)
s = s.replace(anchor, SECTION)
wr(E2E, s)
s2 = rd(E2E)
assert s2.count(MARK) == 1, '写后自检失败'
print('[ok] e2e §194 段已插入')
