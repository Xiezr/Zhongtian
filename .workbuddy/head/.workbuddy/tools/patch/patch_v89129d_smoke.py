# -*- coding: utf-8 -*-
"""patch_v89129d_smoke.py —— v89.129：smoke §111 断言（插在"结果："行之前）。"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s

SECT = r"""  /* ═══════════════════════════════════════════════════════════
   * §111（v89.129）城墙独立建造时间 + 野外目标带将梳理（老板两条）
   * ------------------------------------------------------------
   * 需求 1：「城墙作为建筑，理应有独立的建造时间…结合现实里耗材，耗资，耗时的特点」
   *   → T_max 24h 顶格 + 独立**线性**曲线（2h→24h）+ 资源全表之最（3481.6 万、石 66%）；
   * 需求 2：「任何野外目标（野地，城池，名城等）均应有将领带领，根据等级配备相称资质
   *   和等级的将领，梳理当前设置」
   *   → ① 据点守将（补缺口：resolveTarget.fort.guard 非空 + 确定性 + 相称）；
   *     ② 相称尺子 recGenOf（三类型逐档 + "建议等级 === 守将等级下限"交叉核对）；
   *     ③ 无将出征硬闸（真调 dispatch/expedition 全被拒、不扣兵）；
   *     ④ 出征面板真渲染"相称建议"行。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    /* ① 城墙：24h 顶格 + 线性（逐档 = 24h×(k+1)/12）+ 资源全表之最 + 石 66% + buildCost 同源 */
    var cq111 = DATA.BUILDINGS.chengqiang;
    var t0_111 = DATA.buildTimeSec('chengqiang', 0), t11_111 = DATA.buildTimeSec('chengqiang', 11);
    var linBad111 = [];
    for (var lv111 = 0; lv111 <= 11; lv111++) {
      if (DATA.buildTimeSec('chengqiang', lv111) !== Math.round(24 * 3600 * (lv111 + 1) / 12)) linBad111.push(lv111);
    }
    var r11_111 = cq111.levelCost(11);
    var res11_111 = r11_111.grain + r11_111.wood + r11_111.stone + r11_111.iron;
    var resOthers111 = 0;
    Object.keys(DATA.BUILDINGS).forEach(function (k111) {
      if (k111 === 'chengqiang') return;
      var c111x = DATA.BUILDINGS[k111].levelCost(11);
      if (c111x) resOthers111 = Math.max(resOthers111, c111x.grain + c111x.wood + c111x.stone + c111x.iron);
    });
    var c0111 = cq111.levelCost(0);
    check('§111① 城墙：24h 顶格 + 线性逐档 + 资源全表之最（石 66% · buildCost 同源）',
      DATA.BUILD_TIME_H_MAX.chengqiang === 24 && linBad111.length === 0
      && Math.abs(t0_111 / 3600 - 2) < 1e-9 && Math.abs(t11_111 / 3600 - 24) < 1e-9
      && res11_111 > resOthers111
      && Math.abs(r11_111.stone / res11_111 - 0.66) < 0.02
      && cq111.buildCost.stone === c0111.stone && cq111.buildCost.grain === c0111.grain
      && cq111.buildCost.wood === c0111.wood && cq111.buildCost.iron === c0111.iron,
      'Lv1→2 ' + (t0_111 / 3600).toFixed(2) + 'h · 11→12 ' + (t11_111 / 3600).toFixed(1) + 'h · '
      + (res11_111 / 1e4).toFixed(0) + '万 vs 次重 ' + (resOthers111 / 1e4).toFixed(0) + '万 · 石 '
      + Math.round(r11_111.stone / res11_111 * 100) + '%');

    /* ② 据点守将：带 guard + 确定性 + 相称（Lv1→英杰 / Lv6→天授） */
    var keep111 = G.state;
    var st111 = G.newGame({ name: 'v129g', cityName: '许都', region: '豫州', mapSeed: 20260926 });
    G.state = st111;
    try { if (!st111.map.grid) G.map.generate(); } catch (e) {}
    var fort111 = null;
    for (var yy111 = 0; yy111 < (DATA.MAP_H || 60) && !fort111; yy111++) {
      for (var xx111 = 0; xx111 < (DATA.MAP_W || 60) && !fort111; xx111++) {
        fort111 = G.map.fortAt(xx111, yy111);
      }
    }
    var ok111b = false, note111b = '无据点（seed 不含）';
    if (fort111) {
      var tt111 = G.battle.resolveTarget({ kind: 'fort', x: fort111.x, y: fort111.y });
      var gA111 = G.fortGuardOf(fort111), gB111 = G.fortGuardOf(fort111);
      var det111 = gA111.name === gB111.name && gA111.level === gB111.level
        && gA111.tong === gB111.tong && gA111.rank === gB111.rank && gA111.style === gB111.style;
      var idx1_111 = DATA.GEN_RANKS.indexOf(DATA.GEN_RANK_BY_ID[G.fortGuardOf({ x: 1, y: 1, level: 1 }).rank]);
      var idx6_111 = DATA.GEN_RANKS.indexOf(DATA.GEN_RANK_BY_ID[G.fortGuardOf({ x: 1, y: 1, level: 6 }).rank]);
      ok111b = !!(tt111.ok && tt111.guard && tt111.guard.name && det111 && idx1_111 === 2 && idx6_111 === 4);
      note111b = fort111.name + ' Lv' + fort111.level + ' → ' + (tt111.guard ? tt111.guard.name + ' ' + G.rankOf(tt111.guard).name + ' Lv' + tt111.guard.level : 'null')
        + ' · 确定性=' + det111 + ' · Lv1档=' + idx1_111 + '（英杰=2）/ Lv6档=' + idx6_111 + '（天授=4）';
    }
    check('§111② 据点守将：resolveTarget 带 guard + 确定性（两次全等）+ 相称（1→英杰 / 6→天授）', ok111b, note111b);

    /* ③ 相称尺子：三类型逐档 + "建议等级 === 守将等级下限"交叉核对（防两处漂移） */
    var recW10_111 = G.recGenOf({ ok: true, kind: 'wild', lv: 10 });
    var recW1_111 = G.recGenOf({ ok: true, kind: 'wild', lv: 1 });
    var recF10_111 = G.recGenOf({ ok: true, kind: 'fort', lv: 10 });
    var recCap_111 = G.recGenOf({ ok: true, kind: 'city', cityType: 'capital' });
    var recOwn_111 = G.recGenOf({ ok: true, kind: 'owncity' });
    var wildMin111 = 999, fortMin111 = 999;
    for (var i111 = 0; i111 < 150; i111++) {
      var wd111 = G.wildDefenseAt(3 + (i111 % 9), 3 + ((i111 / 9) | 0), 8);
      if (wd111.gen) wildMin111 = Math.min(wildMin111, wd111.gen.level);
    }
    for (var j111 = 0; j111 < 60; j111++) {
      fortMin111 = Math.min(fortMin111, G.fortGuardOf({ x: j111 % 10, y: (j111 / 10) | 0, level: 8 }).level);
    }
    check('§111③ 相称尺子 recGenOf：三类型逐档 + 建议等级 === 守将等级下限（同尺）',
      !!(recW1_111 && recW1_111.rankId === 'liang' && recW1_111.lv === 3)
      && !!(recW10_111 && recW10_111.rankId === 'tian' && recW10_111.lv === 20)
      && !!(recF10_111 && recF10_111.rankId === 'tian' && recF10_111.lv === 60)
      && !!(recCap_111 && recCap_111.rankId === 'tian' && recCap_111.lv === 190)
      && recOwn_111 === null
      && wildMin111 >= 16 && wildMin111 <= 20          /* 野地 Lv8：下限 16（+jitter 0~4） */
      && fortMin111 >= 52 && fortMin111 <= 57,         /* 据点 Lv8：下限 52（+jitter 0~5） */
      '野地Lv1=' + recW1_111.text + ' · 野地Lv10=' + recW10_111.text + ' · 据点Lv10=' + recF10_111.text
      + ' · 都城=' + recCap_111.text + ' · 调兵=null · 野地Lv8守将最小 ' + wildMin111 + '（建议 16）· 据点Lv8最小 ' + fortMin111 + '（建议 52）');

    /* ④ 无将出征硬闸：真调两条路，全被拒且不扣兵 */
    var c111 = st111.cities[0];
    st111.res.grain = 1e9; st111.res.wood = 1e9; st111.res.stone = 1e9; st111.res.iron = 1e9;
    c111.army = { yibing: 500 };
    var r1a111 = G.march.dispatch({ kind: 'wild', x: 3, y: 3 }, 'raid', { yibing: 100 }, '');
    var r1b111 = G.battle.expedition({ kind: 'wild', x: 3, y: 3 }, 'raid', { yibing: 100 }, null);
    check('§111④ 无将出征硬闸：dispatch / expedition 真调全被拒（且不扣兵）',
      !(r1a111 && r1a111.ok) && !(r1b111 && r1b111.ok) && c111.army.yibing === 500,
      'dispatch=「' + ((r1a111 && r1a111.msg) || '') + '」· expedition=「' + ((r1b111 && r1b111.msg) || '') + '」· 兵 ' + c111.army.yibing);

    /* ⑤ 出征面板真渲染"相称建议"行 */
    var h111 = '';
    try {
      G.ui._cityId = c111.id;
      G.ui.closeAllModals();
      G.ui.openExpModal({ kind: 'wild', x: 3, y: 3 });
      h111 = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
    } catch (e) { h111 = 'ERR:' + e.message; }
    var m111 = h111.match(/相称建议[\s\S]{0,60}?<\/div>/);
    check('§111⑤ 出征面板真渲染「相称建议」行（recGenOf → 文案）',
      !!m111 && /良材|英杰|名世|天授/.test(m111[0]),
      m111 ? m111[0].replace(/<[^>]+>/g, '').slice(0, 40) : (h111.slice(0, 60) || '未渲染'));
    try { G.ui.closeAllModals(); } catch (e2) {}
    G.state = keep111;
  })();

"""

anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, '结果行锚点 %d' % s.count(anchor)
s = s.replace(anchor, SECT + anchor)
assert s.count('{') - s.count('}') == orig.count('{') - orig.count('}'), '花括号盈亏被改变'
assert s.count('(') - s.count(')') == orig.count('(') - orig.count(')'), '圆括号盈亏被改变'
assert '\r\n' not in s, 'CRLF 混入'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patchD(smoke §111) OK')
