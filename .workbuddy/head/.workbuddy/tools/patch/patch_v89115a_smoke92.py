# -*- coding: utf-8 -*-
"""
patch_v89115a_smoke92.py — 把 smoke §92（来袭每日 9 时）整节重写为 v89.115 现实时间口径。
做法：定位 `===== 92. ` 那行 与 其后 `  console.log('  --- 第 53 节` 之间，整段替换。
三件套：先备份 → 原子落盘 → 写后自检。
"""
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
BAK = 'E:/Deepseekdb/.workbuddy/backup/v89114/smoke-test.js'

s = io.open(P, encoding='utf-8').read()          # ① 先整读进变量

A_MARK = "  console.log('\\n===== 92. v89.111 "
B_MARK = "  console.log('  --- 第 53 节"
ia = s.find(A_MARK)
ib = s.find(B_MARK)
if ia < 0 or ib < 0 or ib <= ia:
    print('!! 锚点未找到  ia=%d ib=%d' % (ia, ib)); sys.exit(1)
old = s[ia:ib]
print('原 §92 长度 %d 字符' % len(old))
if 'invasionDayOf' not in old and 'invasionTick' not in old:
    print('!! 待替换段看起来不对（不含 invasion*）'); sys.exit(1)

NEW = r"""  console.log('\n===== 92. v89.115 来袭：现实时间节奏（30 分钟一场 · 轮转 · 单次预警） =====');
  (function () {
    var bak92 = G.state, bkNow92 = G._realNowOf;
    try {
      var st92 = G.newGame({ name: '烽火92', cityName: '许都', mapSeed: 20260923 });
      if (!st92.map.grid) G.map.generate();
      G.state = st92;
      st92.cities.push(G.makeCity({ id: 'v92b', name: '二城', x: 265, y: 215 }));
      st92.cities.push(G.makeCity({ id: 'v92c', name: '三城', x: 266, y: 216 }));
      st92.cities.forEach(function (cc) { cc.army = { yibing: 8000 }; });
      var T92 = 1700000000000;                       /* 固定基准时刻（可读） */
      function setT92(ms) { G._realNowOf = function () { return ms; }; }
      function nMsg92() { return (G.msgsOf('beacon') || []).length; }
      function last92() { var m = G.msgsOf('beacon') || []; return m.length ? m[0].msg : ''; }

      check('① 结构：每 30 现实分钟一场 · 提前 5 分钟预警 · 离线最多补 3 场；旧口径全退役', (function () {
        return DATA.INVASION.realMin === 30 && DATA.INVASION.warnMin === 5
          && DATA.INVASION.catchUpMax === 3
          && DATA.INVASION.attackHour === undefined && DATA.INVASION.warnHours === undefined
          && typeof G.invasionSlotOf === 'function' && typeof G.invasionDueOfSlot === 'function'
          && typeof G.invasionTargetOfSlot === 'function'
          && typeof G.invasionDayOf === 'undefined' && typeof G.invasionDueOfDay === 'undefined';
      })());

      /* 首 tick = 只排期（进城不立刻挨打） */
      setT92(T92);
      G.invasionTick(0);
      var slot0 = G.invasionSlotOf(T92);
      check('②-1 首 tick 只排期（lastSlot = 当前场，不在进城瞬间结算）',
        st92.inv.lastSlot === slot0 && nMsg92() === 0, 'lastSlot=' + st92.inv.lastSlot);

      /* 进窗报一条（提前 5 分钟） */
      setT92(G.invasionDueOfSlot(slot0 + 1) - 3 * 60000);
      var n0 = nMsg92();
      G.invasionTick(0);
      var n1 = nMsg92(), w1 = last92();
      var tgt1 = G.invasionTargetOfSlot(slot0 + 1);
      check('②-2 提前 5 分钟内报一条（含 势力 + 剩余 + 现实时间口径）',
        n1 - n0 === 1 && w1.indexOf('现实时间') >= 0 && w1.indexOf('后') >= 0
        && w1.indexOf(G.invasionSrcOf(tgt1, slot0 + 1)) >= 0, w1.slice(0, 80));

      /* 同场不重复 */
      setT92(G.invasionDueOfSlot(slot0 + 1) - 60000);
      G.invasionTick(0);
      check('②-3 同一场不重复报（去"频繁报告"）', nMsg92() === n1);

      /* 到点结算一场；同一场内再 tick 不重复结算 */
      setT92(G.invasionDueOfSlot(slot0 + 1) + 1000);
      var f1 = G.invasionTick(0);
      setT92(G.invasionDueOfSlot(slot0 + 1) + 5000);
      var f2 = G.invasionTick(0);
      check('②-4 到点结算一场（目标=轮转第二城）· 同场不重复结算',
        f1 === 1 && f2 === 0 && tgt1 === st92.cities[1]);

      /* ③ 预警势力 == 结算势力 */
      var r1 = last92();
      var src1 = G.invasionSrcOf(st92.cities[1], slot0 + 1);
      check('③ 预警报的势力 == 结算打的势力（唯一出口 invasionSrcOf）',
        w1.indexOf(src1) >= 0 && r1.indexOf(src1) >= 0);

      /* ④ 离线补算：跨 10 场 → 只补 3 场 + "自行散去"提示 */
      var nb = nMsg92();
      setT92(G.invasionDueOfSlot(slot0 + 11) + 1000);
      var fB = G.invasionTick(0);
      var txtB = (G.msgsOf('beacon') || []).slice(0, 4).map(function (m) { return m.msg; }).join('|');
      check('④ 离线跨 10 场：只补 3 场，其余"自行散去"（不翻旧账）',
        fB === 3 && /散去/.test(txtB), 'fired=' + fB + ' 新增 ' + (nMsg92() - nb) + ' 条');

      /* ⑤ 情报等级 */
      var t92 = G.invasionTargetOfSlot(slot0 + 20);
      var t0txt = G.invasionIntelTextOf(t92, slot0 + 20);
      var cell92 = null;
      (t92.cells || []).forEach(function (x, i) { if (!x.build && !x.official && cell92 == null) cell92 = i; });
      if (cell92 != null) t92.cells[cell92].build = { id: 'fenghuotai', lvl: 2 };
      var t2txt = G.invasionIntelTextOf(t92, slot0 + 20);
      check('⑤ 烽火台情报：Lv0 只报势力 → Lv2 加战力与兵种明细',
        t0txt.indexOf('战力') < 0 && t2txt.indexOf('战力') >= 0 && t2txt.indexOf('×') >= 0,
        t2txt.slice(0, 60));

      /* ⑥ 烽火页（规则块与预警表都改现实时间口径） */
      var pg92 = G.ui.marchBeaconHTML();
      check('⑥ 烽火页：规则块含"每 30 分钟"与"现实时间"',
        pg92.indexOf('来犯 · 触发与规则') >= 0 && pg92.indexOf('每 <b>30 分钟</b>') >= 0
        && pg92.indexOf('现实时间') >= 0);
    } finally { G._realNowOf = bkNow92; G.state = bak92; }
  })();

"""

s2 = s[:ia] + NEW + s[ib:]
tmp = P + '.tmp89115'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s2)
os.replace(tmp, P)

chk = io.open(P, encoding='utf-8').read()
ok = ('v89.115 来袭：现实时间节奏' in chk
      and chk.count('===== 92. ') == 1
      and 'invasionDueOfDay(' not in chk.split("===== 92. ")[1].split('--- 第 53 节')[0]
      and chk.count('{') == chk.count('}'))
print('DONE ok=%s  len %d -> %d' % (ok, len(s), len(chk)))
sys.exit(0 if ok else 1)
