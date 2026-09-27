# -*- coding: utf-8 -*-
# v89.136 批0-e2：e2e-test.js —— 野地采集用例改写为"带将驻军原地开工 + 地块界面操作"
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

e = rd('e2e-test.js')

# ============================================================
# A 段：摆驻军 + 地块界面断言
# ============================================================
oldA = """    if (s.generals[0]) { s.generals[0].status = 'idle'; s.generals[0].stamina = 100; }
    G.ui.openLandModal(g20.x, g20.y);
    await sleep(80);
    const lm20 = document.querySelector('#modal-root').innerHTML;
    /* v89.83（老板「已占领的野地，其入口操作应只保留派驻」）：
       野地弹窗不再直接给「派军采集」（与派驻重复）—— 它搬去了采集面板。
       这里**真点一次**验证搬迁后入口仍可达（否则等于把功能删了）。 */
    check('v89.83：已占野地弹窗入口只留派驻（派军采集已搬走）',
      lm20.indexOf('data-action="wild-garrison-open"') >= 0
      && lm20.indexOf('data-action="gather-open"') < 0);
    check('野地弹窗标明可采资源', lm20.indexOf('此地可采') >= 0);"""
newA = """    /* v89.136（老板）：采集唯一形态 = 带将驻军原地开工 —— 先摆一支带将驻军 */
    if (s.generals[0]) { s.generals[0].status = 'garrison'; s.generals[0].stamina = 100; }
    const w20 = G.map.wildAt(g20.x, g20.y);
    w20.garrison = { troops: { yibing: 1000 }, cityId: s.cities[0].id, genId: s.generals[0].id };
    G.ui.openLandModal(g20.x, g20.y);
    await sleep(80);
    const lm20 = document.querySelector('#modal-root').innerHTML;
    /* v89.136：「采集」独立成区（与地块操作 / 危险操作并列），旧入口全退役 */
    check('v89.136：地块界面含独立「采集」区（开始采集键 + 原地开工说明）',
      lm20.indexOf('op-zone-t">采集') >= 0
      && lm20.indexOf('data-action="wild-garrison-gather"') >= 0
      && lm20.indexOf('原地开工') >= 0);
    check('v89.136：旧采集入口全退役（gather-open / open-gathers 不在页面）',
      lm20.indexOf('data-action="gather-open"') < 0
      && lm20.indexOf('data-action="open-gathers"') < 0);
    check('野地弹窗标明可采资源', lm20.indexOf('此地可采') >= 0);"""
assert e.count(oldA) == 1, 'A 段锚点 = ' + str(e.count(oldA))
e = e.replace(oldA, newA)

# ============================================================
# B1 段：旧弹窗流程 → 真点开始采集
# ============================================================
oldB1 = """    G.ui.openGathers();                       /* 从采集面板进入（新家） */
    await sleep(80);
    const gb20 = document.querySelector('#modal-root [data-action="gather-open"]');
    check('v89.83：采集面板给出「派军采集」入口', !!gb20);
    if (gb20) {
      click(gb20);
      await sleep(80);
      const gm20 = document.querySelector('#modal-root').innerHTML;
      check('采集派遣弹窗含收成公式', gm20.indexOf('收成公式') >= 0);
      check('采集派遣弹窗含 24 小时封顶说明', gm20.indexOf('24 小时') >= 0);
      check('采集派遣弹窗含派兵输入', !!document.querySelector('#gather-troops'));
      check('采集派遣弹窗含将领选择', !!document.querySelector('#gather-gen'));"""
newB1 = """    /* 真点「开始采集」→ 原地开工（v89.136：唯一形态） */
    const sg20 = document.querySelector('#modal-root [data-action="wild-garrison-gather"]');
    check('开始采集键可点', !!sg20);
    if (sg20) {
      click(sg20);
      await sleep(140);
      const rec = G.gatherAt(g20.x, g20.y);
      check('采集队已开局（inPlace · 原地开工）', !!rec && rec.inPlace === true,
        rec ? ('兵力 ' + rec.troops + ' · genId ' + rec.genId) : '无');
      check('驻军原地保留（不抽空）',
        G.wildGarrisonTotal(G.map.wildAt(g20.x, g20.y).garrison) === 1000);"""
assert e.count(oldB1) == 1, 'B1 段锚点 = ' + str(e.count(oldB1))
e = e.replace(oldB1, newB1)

# ============================================================
# B2 段：备兵/行军/面板 → 地块采集区进度与收获
# ============================================================
oldB2 = """      /* 备兵并开始采集 */
      const city20 = s.cities[0];
      city20.army = city20.army || {};
      city20.army.yibing = (city20.army.yibing || 0) + 3000;
      const ti20 = document.querySelector('#gather-troops');
      if (ti20) ti20.value = '1000';
      const before20 = city20.army.yibing;
      const sb20 = document.querySelector('#modal-root [data-action="gather-start"]');
      check('采集弹窗有开始按钮', !!sb20);
      if (sb20) {
        /* v89.87（需求 2）：采集走行军 —— 将领须空闲、派兵后需推进到抵达才有采集记录 */
        const gsel20 = document.querySelector('#gather-gen') || document.querySelector('#modal-root #gather-gen');
        if (gsel20 && gsel20.value) {
          const gg20 = s.generals.find((x) => x.id === gsel20.value);
          if (gg20) { gg20.status = 'idle'; gg20.cityId = city20.id; }
        }
        click(sb20);
        await sleep(140);
        const gmr20 = (s.marches || []).find((m) => m.modeId === 'gather');
        if (gmr20) { gmr20.elapsed = gmr20.totalTime; G.march.tick(); }
        const rec = G.gatherAt(g20.x, g20.y);
        check('采集队已派出（行军抵达后成队）', !!rec, rec ? ('兵力 ' + rec.troops) : '无');
        check('城中兵力已扣除', city20.army.yibing === before20 - 1000, String(city20.army.yibing));
        G.ui.openGathers();
        await sleep(80);
        const gh20 = document.querySelector('#modal-root').innerHTML;
        check('采集队面板可见', gh20.indexOf('野地采集') >= 0);
        check('未满 1 小时时收获按钮禁用', gh20.indexOf('gather-finish') >= 0 && gh20.indexOf('disabled') >= 0);
        if (rec) {
          rec.elapsed = 3 * 3600;
          const resKey = G.gatherResOf(g20.type);
          const beforeRes = s.res[resKey] || 0;
          G.ui.openGathers();
          await sleep(80);
          const gr20 = document.querySelector('#modal-root [data-action="gather-finish"]');
          check('满 1 小时后可收获（按钮可用）', !!gr20 && !gr20.hasAttribute('disabled'));
          if (gr20) {
            click(gr20);
            await sleep(140);
            check('收获后资源入账', (s.res[resKey] || 0) > beforeRes,
              resKey + ' +' + Math.round((s.res[resKey] || 0) - beforeRes));
            check('收获后兵力归还', city20.army.yibing === before20, String(city20.army.yibing));
            check('采集队已清空', !G.gatherAt(g20.x, g20.y));
          }
        }
      }
    }
  }"""
newB2 = """      G.ui.openLandModal(g20.x, g20.y);
      await sleep(80);
      const gh20 = document.querySelector('#modal-root').innerHTML;
      check('采集区显示进度（未满 1 小时 · 收获禁用）',
        gh20.indexOf('已采') >= 0 && gh20.indexOf('gather-finish') >= 0
        && gh20.indexOf('disabled') >= 0);
      if (rec) {
        rec.elapsed = 3 * 3600;
        const resKey = G.gatherResOf(g20.type);
        const beforeRes = s.res[resKey] || 0;
        G.ui.openLandModal(g20.x, g20.y);
        await sleep(80);
        const gr20 = document.querySelector('#modal-root [data-action="gather-finish"]');
        check('满 1 小时后可收获（按钮可用）', !!gr20 && !gr20.hasAttribute('disabled'));
        if (gr20) {
          click(gr20);
          await sleep(140);
          check('收获后资源入账', (s.res[resKey] || 0) > beforeRes,
            resKey + ' +' + Math.round((s.res[resKey] || 0) - beforeRes));
          check('收获后驻军原样（原地开工不搬兵）',
            G.wildGarrisonTotal(G.map.wildAt(g20.x, g20.y).garrison) === 1000);
          check('采集队已清空', !G.gatherAt(g20.x, g20.y));
        }
      }
    }
    if (s.generals[0]) s.generals[0].status = 'idle';   /* 复位（防污染后续用例） */
  }"""
assert e.count(oldB2) == 1, 'B2 段锚点 = ' + str(e.count(oldB2))
e = e.replace(oldB2, newB2)

# ---------- 写后自检 ----------
assert 'openGathers' not in e, 'openGathers 残留'
assert 'openGatherModal' not in e, 'openGatherModal 残留'
assert 'gather-start' not in e, 'gather-start 残留'
for sent in ['data-action="wild-garrison-gather"', 'inPlace · 原地开工', '原地开工不搬兵']:
    assert e.count(sent) >= 1, '丢失哨兵: ' + sent

wr('e2e-test.js', e)
print('OK · e2e-test.js', len(e))
