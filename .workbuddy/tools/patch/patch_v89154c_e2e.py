# -*- coding: utf-8 -*-
"""v89.154 e2e 补丁：附属野地（排序行序 / 放弃按钮两段确认+上膛）+ 改建完成回大界面。
插在末尾「return finish();」之前（前置/还原同一作用域）。"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

P = 'e2e-test.js'
s = rd(P)

SEC = u"""
  /* ============================================================
   * v89.154（老板 1/2/3）：附属野地（放弃按钮 / 排序）· 改建回大界面
   * ============================================================ */
  await (async function () {
    const s = G.state;
    const c154 = G.currentCity();
    const keepW154 = s.wilds.slice(), keepG154 = (s.gathers || []).slice();
    const gen154 = s.generals[0];
    const keepGen154 = { status: gen154.status, cityId: gen154.cityId };
    const keepRes154 = { grain: s.res.grain, wood: s.res.wood, stone: s.res.stone, iron: s.res.iron, gold: s.res.gold };
    const grid154 = G.extGridOf(c154);
    const keepCell154 = grid154[0] ? JSON.parse(JSON.stringify(grid154[0])) : null;
    try {
      /* ---- ① 排序（真 DOM 行序） + ② 放弃按钮（两段确认 + 上膛） ---- */
      /* ⚠ 造局序**倒置**（942→938）：若出口退化成"不排序直接返回"，输出会是倒序 —— 判据能抓 */
      s.wilds = [
        { x: 942, y: 942, type: 'desert', level: 7, day: 0, startDay: 0 },
        { x: 941, y: 941, type: 'hill', level: 4, day: 0, startDay: 0 },
        { x: 940, y: 940, type: 'hill', level: 9, day: 0, startDay: 0 },
        { x: 939, y: 939, type: 'caoyuan', level: 5, day: 0, startDay: 0 },
        { x: 938, y: 938, type: 'lake', level: 3, day: 0, startDay: 0 }
      ];
      s.gathers = [];
      gen154.status = 'garrison';
      s.wilds[4].garrison = { troops: { changqiang: 5000 }, cityId: c154.id, genId: gen154.id };
      G.startGather(938, 938, { changqiang: 5000 }, { cityId: c154.id });      /* 938 = 采集中 */
      s.wilds[3].garrison = { troops: { changqiang: 500 }, cityId: c154.id };  /* 939 = 有驻军 */
      const gatherOk154 = !!G.gatherAt(938, 938);
      G.ui.closeAllModals();
      G.ui.openWilds();
      await sleep(150);
      const coords154 = Array.from(document.querySelectorAll('#modal-root table tbody tr'))
        .map(function (tr) { return (tr.children[1] || {}).textContent || ''; });
      check('v89.154①：附属野地排序 = 采集 → 驻军 → 无驻军（地形序 → 等级降序）',
        gatherOk154 && coords154.slice(0, 5).join('|') === '938,938|939,939|942,942|940,940|941,941',
        'gatherOk=' + gatherOk154 + ' seq=' + coords154.slice(0, 5).join('|'));

      let askBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
      check('v89.154①：操作列末位有「放弃」按钮（防误触类 wild-drop）',
        !!askBtn154 && !!askBtn154.closest('.wild-drop'), askBtn154 ? askBtn154.className : '(无)');
      if (askBtn154) askBtn154.click();
      await sleep(160);
      /* live 重绘的极小竞态兜底：重查一次再点（§65.2：跨操作不持有节点引用） */
      if (document.querySelector('#modal-root').innerHTML.indexOf('wild-abandon-arm') < 0) {
        askBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
        if (askBtn154) askBtn154.click();
        await sleep(160);
      }
      const askHtml154 = document.querySelector('#modal-root').innerHTML;
      check('v89.154①：放弃 → 二次确认窗（上膛按钮 + 明写「不可撤销」）',
        askHtml154.indexOf('data-action="wild-abandon-arm"') >= 0 && askHtml154.indexOf('不可撤销') >= 0);
      let armBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-arm"]');
      if (armBtn154) armBtn154.click();
      await sleep(140);
      const armTxt154 = (document.querySelector('#modal-root [data-action="wild-abandon-arm"]') || {}).textContent || '';
      check('v89.154①：第一次点击只「上膛」（文案变「再点一次」· 野地仍在）',
        /再点一次/.test(armTxt154) && !!G.map.wildAt(938, 938), armTxt154.slice(0, 40));
      armBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-arm"]');
      if (armBtn154) armBtn154.click();
      await sleep(200);
      check('v89.154①：第二次点击才执行（野地消失）', !G.map.wildAt(938, 938));
      G.ui.closeAllModals();
      await sleep(60);

      /* ---- ③ 改建完成 → 直接回城外大界面 ---- */
      grid154[0] = { type: 'nongchang', lv: 2 };
      s.res.grain = 5e5; s.res.wood = 5e5; s.res.stone = 5e5; s.res.iron = 5e5; s.res.gold = 5e5;
      G.ui.closeAllModals();
      G.ui.openExtModal(0);
      await sleep(140);
      const cvtAsk154 = document.querySelector('#modal-root [data-action="ext-convert-ask"]');
      if (cvtAsk154) cvtAsk154.click();
      await sleep(160);
      const cvtDo154 = document.querySelector('#modal-root [data-action="ext-convert"]:not([disabled])');
      check('v89.154②：改建面板可打开（含可执行的「改建」按钮）', !!cvtDo154);
      if (cvtDo154) cvtDo154.click();
      await sleep(200);
      check('v89.154②：改建完成 → 弹窗一次关净（直接回城外大界面）',
        (G.ui._modalStack || []).length === 0
        && document.querySelector('#modal-root').innerHTML.indexOf('inner-panel') < 0,
        'stack=' + (G.ui._modalStack || []).length);
      check('v89.154②：地块真被改建（换类型 · 等级保留 Lv2）',
        grid154[0].type !== 'nongchang' && grid154[0].lv === 2, JSON.stringify(grid154[0]));
    } finally {
      s.wilds = keepW154; s.gathers = keepG154;
      gen154.status = keepGen154.status; gen154.cityId = keepGen154.cityId;
      grid154[0] = keepCell154;
      s.res.grain = keepRes154.grain; s.res.wood = keepRes154.wood; s.res.stone = keepRes154.stone;
      s.res.iron = keepRes154.iron; s.res.gold = keepRes154.gold;
      G.ui.closeAllModals();
    }
  })();
"""

ANCH = u"  return finish();\n}"
if u'v89.154①：附属野地排序' in s:
    print('skip (already)')
else:
    assert s.count(ANCH) == 1, 'anchor count=' + str(s.count(ANCH))
    s = s.replace(ANCH, SEC + u"\n  return finish();\n}")
    wr(P, s)
    s2 = rd(P)
    _bk = io.open(R + 'backup/v89154/e2e-test.js.before', encoding='utf-8', newline='').read()
    assert (s2.count(u'{') - s2.count(u'}')) == (_bk.count(u'{') - _bk.count(u'}')), 'brace imbalance'
    print('e2e done, len', len(_bk), '->', len(s2))
