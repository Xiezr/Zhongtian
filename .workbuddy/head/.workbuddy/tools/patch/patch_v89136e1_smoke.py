# -*- coding: utf-8 -*-
# v89.136 批0-e1：smoke-test.js 采集相关断言全面升级 + main.js gather-locate case 清理
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

s = rd('smoke-test.js')

# ============================================================
# ① §27 A1：头部（派军采集 → 驻军开采）
# ============================================================
old1 = """  var city15 = G.cityById(V15.cities[0].id) || V15.cities[0];
  city15.army = { yibing: 2000, minfu: 1000 };
  var gen15 = V15.generals[0];
  gen15.status = 'idle'; gen15.stamina = 100; gen15.exp = 0;

  var r27 = G.startGather(wl.x, wl.y, gen15.id, { yibing: 1000 });
  check('派军采集成功', r27.ok === true, r27.msg);
  check('兵力已从城中扣除', city15.army.yibing === 1000);
  check('将领状态置为采集中', gen15.status === 'gather');
  check('开始采集消耗体力', gen15.stamina === 100 - DATA.GATHER.stamina);
  var g15 = G.gatherAt(wl.x, wl.y);
  check('采集队已登记（含等级与兵力）', !!g15 && g15.troops === 1000 && g15.level === 8);"""
new1 = """  var city15 = G.cityById(V15.cities[0].id) || V15.cities[0];
  city15.army = { yibing: 2000, minfu: 1000 };
  var gen15 = V15.generals[0];
  gen15.status = 'idle'; gen15.stamina = 100; gen15.exp = 0;

  /* v89.136：采集唯一形态 = **带将驻军原地开工**（"将领带队"退役）—— 先摆一支带将驻军。 */
  var w15 = G.map.wildAt(wl.x, wl.y);
  w15.garrison = { troops: { yibing: 1000 }, cityId: city15.id, genId: gen15.id };
  gen15.status = 'garrison';
  var r27 = G.startGather(wl.x, wl.y, { yibing: 1000 });
  check('驻军开采成功（带将 · 新签名）', r27.ok === true, r27.msg);
  check('兵力不离开驻军（原地开工 · 城内与驻军均不扣）',
    city15.army.yibing === 2000 && G.wildGarrisonTotal(w15.garrison) === 1000);
  check('将领不被改为采集状态（仍驻守野地）', gen15.status === 'garrison');
  check('无将驻军不可开采（老板第 5 条 · 驻军须带将）', (function () {
    var keep = V15.gathers.slice();
    var bk = w15.garrison.genId;
    w15.garrison.genId = null;
    V15.gathers = [];
    var rNo = G.startGather(wl.x, wl.y, { yibing: 100 });
    w15.garrison.genId = bk;
    V15.gathers = keep;
    return rNo.ok === false && /须有将领带队/.test(rNo.msg);
  })());
  var g15 = G.gatherAt(wl.x, wl.y);
  check('采集队已登记（等级/兵力/inPlace/origin）',
    !!g15 && g15.troops === 1000 && g15.level === 8 && g15.inPlace === true && g15.origin === 'garrison');"""
assert s.count(old1) == 1, '§27 A1 锚点 = ' + str(s.count(old1))
s = s.replace(old1, new1)

# ============================================================
# ② §27 A2：收获后
# ============================================================
old2 = """  check('收获后兵力归还城中', city15.army.yibing === 2000);
  check('收获后将领回到空闲', gen15.status === 'idle');
  check('采集队已移除', !G.gatherAt(wl.x, wl.y));
  check('采集给将领经验', gen15.exp > 0);"""
new2 = """  check('收获后驻军原样（原地开工 · 不搬兵）',
    G.wildGarrisonTotal(w15.garrison) === 1000 && city15.army.yibing === 2000);
  check('收获后将领仍在驻守野地', gen15.status === 'garrison');
  check('采集队已移除', !G.gatherAt(wl.x, wl.y));"""
assert s.count(old2) == 1, '§27 A2 锚点 = ' + str(s.count(old2))
s = s.replace(old2, new2)

# ============================================================
# ③ §27 A3：再开采 + 召回 + 【驻军丢失回归】两条
# ============================================================
old3 = """  gen15.status = 'idle'; gen15.stamina = 100;
  var r27b = G.startGather(wl.x, wl.y, gen15.id, { yibing: 500 });
  check('可再次派军采集', r27b.ok === true, r27b.msg);
  var g15b = G.gatherAt(wl.x, wl.y);
  g15b.elapsed = 5 * 3600;
  var grain27b = V15.res.grain;
  var ra = G.abandonGather(g15b.id);
  check('撤回采集无收益（原版规则）', ra.ok === true && V15.res.grain === grain27b);
  check('撤回后兵力归还', city15.army.yibing === 2000);
  check('撤回后将领回到空闲', gen15.status === 'idle');"""
new3 = """  var r27b = G.startGather(wl.x, wl.y, { yibing: 1000 });
  check('可再次开采（收获后重开）', r27b.ok === true, r27b.msg);
  var g15b = G.gatherAt(wl.x, wl.y);
  g15b.elapsed = 5 * 3600;
  var grain27b = V15.res.grain;
  var ra = G.abandonGather(g15b.id);
  check('召回无收益（原版规则）', ra.ok === true && V15.res.grain === grain27b);
  check('召回后驻军原地保留（兵不搬 · 城内亦不变）',
    G.wildGarrisonTotal(w15.garrison) === 1000 && city15.army.yibing === 2000);
  check('召回后将领仍在驻守野地', gen15.status === 'garrison');

  /* =====【驻军丢失回归 · v89.136 老板实测】=====
     两条防线各一条：① 防御分支（旧式记录被直接结算）② 迁移（老档读入转新形态）。 */
  (function () {
    var beforeGar = G.wildGarrisonTotal(w15.garrison);
    V15.gathers = [{ id: 'legacy1', x: wl.x, y: wl.y, type: 'lake', level: 8, genId: gen15.id,
      troops: 400, army: { yibing: 400 }, cityId: city15.id, elapsed: 4 * 3600, origin: 'garrison' }];
    var rl = G.finishGather('legacy1');
    check('【驻军丢失回归】旧式记录收获 → 兵力回驻军（防御分支 · 不丢兵）',
      rl.ok === true && G.wildGarrisonTotal(w15.garrison) === beforeGar + 400,
      beforeGar + ' → ' + G.wildGarrisonTotal(w15.garrison));
    V15.gathers = [];
  })();
  (function () {
    var beforeGar2 = G.wildGarrisonTotal(w15.garrison);
    V15.gathers = [{ id: 'legacy2', x: wl.x, y: wl.y, type: 'lake', level: 8, genId: gen15.id,
      troops: 300, army: { yibing: 300 }, cityId: city15.id, elapsed: 2 * 3600, origin: 'garrison' }];
    var keepM = V15._gatherMigrated;
    V15._gatherMigrated = false;
    var nMig = G.migrateLegacyGathers();
    V15._gatherMigrated = keepM;
    var g2 = G.gatherAt(wl.x, wl.y);
    check('【驻军丢失回归】迁移：旧式 → inPlace + 兵力回驻军（幂等 · 一次）',
      nMig === 1 && !!g2 && g2.inPlace === true && G.wildGarrisonTotal(w15.garrison) === beforeGar2 + 300,
      'n=' + nMig + ' inPlace=' + (g2 && g2.inPlace));
    V15.gathers = [];
  })();"""
assert s.count(old3) == 1, '§27 A3 锚点 = ' + str(s.count(old3))
s = s.replace(old3, new3)

# ============================================================
# ④ §27 B：同一将领 → 同一野地不可重复
# ============================================================
old4 = """  check('同一将领不可同时采两处', (function () {
    var wf = findWildNear('forest', wl.x, wl.y, 30);
    if (!wf) return true;
    V15.wilds.push({ x: wf.x, y: wf.y, type: 'forest', level: 5, levelDay: G.questDayIndex() });
    gen15.status = 'idle'; gen15.stamina = 100;
    V15.gathers = [{ id: 'g1', x: wl.x, y: wl.y, type: 'lake', level: 8, genId: gen15.id,
      troops: 100, army: {}, cityId: city15.id, elapsed: 0 }];
    var rs = G.startGather(wf.x, wf.y, gen15.id, { yibing: 100 });
    V15.gathers = [];
    return rs.ok === false && /已在采集别处/.test(rs.msg);
  })());"""
new4 = """  check('同一野地不可开第二支采集队（v89.136：唯一形态）', (function () {
    var r1 = G.startGather(wl.x, wl.y, { yibing: 100 });
    var r2 = G.startGather(wl.x, wl.y, { yibing: 100 });
    V15.gathers = [];
    return r1.ok === true && r2.ok === false && /已有一支采集队/.test(r2.msg);
  })());"""
assert s.count(old4) == 1, '§27 B 锚点 = ' + str(s.count(old4))
s = s.replace(old4, new4)

# ============================================================
# ⑤ 入口断言段（野地弹窗入口 5 条 → 新 3 条）
# ============================================================
old5 = """  check('野地弹窗含采集入口', /data-action="gather-open"/.test(uiS));
  check('野地总览含采集队入口', /data-action="open-gathers"/.test(uiS));
  check('采集动作已注册（open/start/finish/abandon/locate）',
    /case 'gather-open'/.test(mainSrc27) && /case 'gather-start'/.test(mainSrc27)
    && /case 'gather-finish'/.test(mainSrc27) && /case 'gather-abandon-ask'/.test(mainSrc27)
    && /case 'gather-abandon-do'/.test(mainSrc27)
    && /case 'open-gathers'/.test(mainSrc27));
  check('采集面板可渲染', (function () {
    try {
      V15.gathers = [];
      G.ui.openGathers();
      var h = global.document.querySelector('#modal-root').innerHTML;
      return h.indexOf('野地采集') >= 0 && h.indexOf('当前没有采集队') >= 0;
    } catch (e) { return false; }
  })());
  check('采集派遣弹窗可渲染（含收成公式）', (function () {
    try {
      gen15.status = 'idle'; gen15.stamina = 100;
      V15.gathers = [];
      G.ui.openGatherModal(wl.x, wl.y);
      var h = global.document.querySelector('#modal-root').innerHTML;
      return h.indexOf('派军采集') >= 0 && h.indexOf('收成公式') >= 0 && h.indexOf('24 小时') >= 0;
    } catch (e) { return false; }
  })());"""
new5 = """  /* v89.136（老板「'野地采集（0/3队）'这个弹窗界面不需要」+「地块界面加采集操作」）：
     旧两弹窗退役，采集区落进地块界面（与地块操作 / 危险操作并列）。 */
  check('v89.136：采集入口收敛到地块界面（开始/收获/召回 + 独立「采集」区）', (function () {
    var i = uiS.indexOf('ui.openLandModal = function');
    var land = uiS.slice(i, i + 14000);
    return /op-zone-t">采集/.test(land)
      && /data-action="wild-garrison-gather"/.test(land)
      && /data-action="gather-finish"/.test(land)
      && /data-action="gather-abandon-ask"/.test(land);
  })());
  check('v89.136：旧采集入口全退役（gather-open / open-gathers / gather-start / 两弹窗）', (function () {
    return !/data-action="gather-open"/.test(uiS) && !/data-action="open-gathers"/.test(uiS)
      && !/ui\\.openGatherModal = function/.test(uiS) && !/ui\\.openGathers = function/.test(uiS)
      && !/case 'gather-open':/.test(mainSrc27) && !/case 'open-gathers':/.test(mainSrc27)
      && !/case 'gather-start':/.test(mainSrc27) && !/case 'gather-locate':/.test(mainSrc27);
  })());
  check('采集动作已注册（地块开采 + finish/abandon）',
    /case 'wild-garrison-gather'/.test(mainSrc27) && /case 'gather-finish'/.test(mainSrc27)
    && /case 'gather-abandon-ask'/.test(mainSrc27) && /case 'gather-abandon-do'/.test(mainSrc27));
  check('v89.136：地块采集区可渲染（带将驻军 → 开始采集键）', (function () {
    try {
      V15.gathers = [];
      gen15.status = 'garrison';
      var wl15b = G.map.wildAt(wl.x, wl.y);
      wl15b.garrison = { troops: { yibing: 800 }, cityId: city15.id, genId: gen15.id };
      G.ui.openLandModal(wl.x, wl.y);
      var h = global.document.querySelector('#modal-root').innerHTML;
      return h.indexOf('op-zone-t">采集') >= 0 && h.indexOf('开始采集') >= 0
        && h.indexOf('原地开工') >= 0;
    } catch (e) { return false; }
  })());"""
assert s.count(old5) == 1, '入口断言锚点 = ' + str(s.count(old5))
s = s.replace(old5, new5)

# ============================================================
# ⑥ fns 列表
# ============================================================
old6 = "    var fns = ['openWilds', 'openGathers', 'openShop', 'openBag', 'openLordInfo'];"
new6 = "    var fns = ['openWilds', 'openShop', 'openBag', 'openLordInfo'];"
assert s.count(old6) == 1, 'fns 锚点 = ' + str(s.count(old6))
s = s.replace(old6, new6)

# ============================================================
# ⑦ v89.83 段（两条 → 升级版）
# ============================================================
old7 = """  check('v89.83：已占野地入口只留派驻（驻军开采/召回/筑城/放弃仍在）', (function () {
    /* ⚠️ 负向判据必须**限定在野地弹窗内**：gather-open 现在活在采集面板里
       （那正是本轮的搬迁目标），拿全文件去否定它必然假红。 */
    var i = uS36.indexOf('ui.openLandModal = function');
    var land = uS36.slice(i, uS36.indexOf('派驻面板（v23 起叫', i));
    return /data-action="wild-garrison-open"/.test(land)          /* 派驻（唯一入口） */
      && /🛡️ 派驻<\\/button>/.test(land) && /🛡️ 增派驻军/.test(land)
      && /📦 驻军开采/.test(land) && /🏳️ 召回驻军/.test(land)
      && /🏯 筑城/.test(land) && /🗑️ 放弃该野地/.test(land)
      /* 两条重复入口不得复活 */
      && !/data-action="exp-open" data-kind="wild">⚔️ 出兵/.test(land)
      && !/data-action="gather-open"/.test(land);
  })());
  check('v89.83：派军采集入口搬到采集面板（将领带队 · 有宝物机会的那条路没被删）', (function () {
    return /派军采集（将领带队 · 有宝物机会）/.test(uS36)
      && /data-action="gather-open" data-x="' \\+ w\\.x/.test(uS36);
  })());"""
new7 = """  check('v89.83/v89.136：地块操作只留派驻/增派/召回/筑城（采集独立成区）', (function () {
    var i = uS36.indexOf('ui.openLandModal = function');
    var land = uS36.slice(i, uS36.indexOf('派驻面板（v23 起叫', i));
    return /data-action="wild-garrison-open"/.test(land)          /* 派驻（唯一入口） */
      && /🛡️ 派驻<\\/button>/.test(land) && /🛡️ 增派驻军/.test(land)
      && /🏳️ 召回驻军/.test(land)
      && /🏯 筑城/.test(land) && /🗑️ 放弃该野地/.test(land)
      /* 采集不再挤在地块操作里（独立「采集」区），历史重复入口不得复活 */
      && /op-zone-t">采集/.test(land)
      && !/data-action="exp-open" data-kind="wild">⚔️ 出兵/.test(land)
      && !/data-action="gather-open"/.test(land)
      && !/data-action="open-gathers"/.test(land);
  })());
  check('v89.136：派军采集面板退役（openGatherModal / openGathers 无定义）', (function () {
    return !/ui\\.openGatherModal = function/.test(uS36)
      && !/ui\\.openGathers = function/.test(uS36);
  })());"""
assert s.count(old7) == 1, 'v89.83 锚点 = ' + str(s.count(old7))
s = s.replace(old7, new7)

# ============================================================
# ⑧ P-13：采集面板断言 → 地块采集区断言
# ============================================================
old8 = """    check('v89.86（P-13）：采集面板无 undefined · 采力口径 · 估算=真尺子', (function () {
      var w = null;
      for (var r = 1; r <= 40 && !w; r++) {
        for (var dy = -r; dy <= r && !w; dy++) for (var dx = -r; dx <= r && !w; dx++) {
          var tl = G8.map.tile(city8.x + dx, city8.y + dy);
          if (tl && tl.terrain === 'lake') w = { x: city8.x + dx, y: city8.y + dy, type: 'lake' };
        }
      }
      if (!w) return false;
      st8.wilds = [{ x: w.x, y: w.y, type: w.type, level: 3, levelDay: G8.questDayIndex() }];
      var gen8 = st8.generals[0]; gen8.status = 'idle'; gen8.stamina = 100;
      city8.army = { yibing: 2000 };
      G8.ui.openGatherModal(w.x, w.y);
      var h = global.document.querySelector('#modal-root').innerHTML;
      if (h.indexOf('undefined') >= 0 || h.indexOf('单队采力上限') < 0) return false;
      var mv = h.match(/id="gather-troops"[^>]*value="(\\d+)"/);
      if (!mv) return false;
      var y2 = G8.gatherYield({ type: w.type, level: 3, army: G8.autoPickTroops(Number(mv[1])), elapsed: 24 * 3600 });
      var note = h.match(/采满预计可得 <b>([\\d,]+)<\\/b>/);
      return !!note && note[1] === U8.numText(y2.amount, 0);
    })());"""
new8 = """    check('v89.86（P-13）→ v89.136：地块采集区无 undefined · 预估=真尺子', (function () {
      var w = null;
      for (var r = 1; r <= 40 && !w; r++) {
        for (var dy = -r; dy <= r && !w; dy++) for (var dx = -r; dx <= r && !w; dx++) {
          var tl = G8.map.tile(city8.x + dx, city8.y + dy);
          if (tl && tl.terrain === 'lake') w = { x: city8.x + dx, y: city8.y + dy, type: 'lake' };
        }
      }
      if (!w) return false;
      st8.wilds = [{ x: w.x, y: w.y, type: w.type, level: 3, levelDay: G8.questDayIndex() }];
      var gen8 = st8.generals[0]; gen8.status = 'garrison';
      var w8 = G8.map.wildAt(w.x, w.y);
      w8.garrison = { troops: { yibing: 1000 }, cityId: city8.id, genId: gen8.id };
      city8.army = { yibing: 2000 };
      var rS8 = G8.startGather(w.x, w.y, { yibing: 1000 });
      if (!rS8.ok) return false;
      var gTh8 = G8.gatherAt(w.x, w.y);
      gTh8.elapsed = 3 * 3600;
      G8.ui.openLandModal(w.x, w.y);
      var h = global.document.querySelector('#modal-root').innerHTML;
      st8.gathers = [];
      if (h.indexOf('undefined') >= 0 || h.indexOf('预计收成') < 0) return false;
      /* 面板报的预计收成 = GAME.gatherYield 同源（真尺子） */
      var y2 = G8.gatherYield({ type: w.type, level: 3, troops: 1000, elapsed: 3 * 3600 });
      return h.indexOf(U8.numText(y2.amount, 0)) >= 0;
    })());"""
assert s.count(old8) == 1, 'P-13 锚点 = ' + str(s.count(old8))
s = s.replace(old8, new8)

# ============================================================
# ⑨ dispatchGather 用例 → 老档在途并入断言
# ============================================================
old9 = """    check('v89.87（派兵）：采集走行军（出发留途 · 抵达成队）', (function () {
      var w87 = null;
      for (var dy = 7; dy <= 11 && !w87; dy++) for (var dx = 7; dx <= 11 && !w87; dx++) {
        var tl = G.map.tile(c87.x + dx, c87.y + dy);
        if (tl && tl.terrain !== 'city' && !G.map.wildAt(c87.x + dx, c87.y + dy)) {
          w87 = { x: c87.x + dx, y: c87.y + dy, t: tl.terrain };
        }
      }
      if (!w87) return false;
      S87.wilds = S87.wilds || [];
      S87.wilds.push({ x: w87.x, y: w87.y, type: w87.t, level: 3, day: 0, startDay: 0 });
      var gen87 = S87.generals[0];
      gen87.status = 'idle';
      S87.marches = [];
      var dg = G.dispatchGather(w87.x, w87.y, gen87.id, { yibing: 100 });
      var stage1 = dg.ok && S87.marches.length === 1 && !G.gatherAt(w87.x, w87.y);
      var gm = S87.marches[0];
      if (gm) { gm.elapsed = gm.totalTime; G.march.tick(); }
      var stage2 = !!G.gatherAt(w87.x, w87.y) && gen87.status === 'gather';
      return stage1 && stage2;
    })());"""
new9 = """    check('v89.136：老档在途采集行军抵达 → 兵并入驻军（不丢兵 · 回归）', (function () {
      var w87 = null;
      for (var dy = 7; dy <= 11 && !w87; dy++) for (var dx = 7; dx <= 11 && !w87; dx++) {
        var tl = G.map.tile(c87.x + dx, c87.y + dy);
        if (tl && tl.terrain !== 'city' && !G.map.wildAt(c87.x + dx, c87.y + dy)) {
          w87 = { x: c87.x + dx, y: c87.y + dy, t: tl.terrain };
        }
      }
      if (!w87) return false;
      S87.wilds = S87.wilds || [];
      S87.wilds.push({ x: w87.x, y: w87.y, type: w87.t, level: 3, day: 0, startDay: 0 });
      var gen87 = S87.generals[0];
      gen87.status = 'idle';
      S87.cities[0].army = S87.cities[0].army || {};
      S87.cities[0].army.yibing = (S87.cities[0].army.yibing || 0) + 1000;
      S87.marches = [];
      /* 老档式出发（v89.136 前的形态）——dispatch 通道仍在（mode 'gather' 定义保留），
         真调它复现"在途"，再由 arrive 的兼容分支并入该野地驻军。 */
      var d87 = G.march.dispatch({ kind: 'wild', x: w87.x, y: w87.y }, 'gather', { yibing: 100 }, gen87.id);
      if (!d87.ok) return false;
      var gm = S87.marches[0];
      var inWay = !!gm && !G.gatherAt(w87.x, w87.y);          /* 出发留途（不再直接成队） */
      if (!gm) return false;
      gm.elapsed = gm.totalTime;
      G.march.tick();
      var wNow = G.map.wildAt(w87.x, w87.y);
      return inWay && !S87.marches.length
        && G.wildGarrisonTotal(wNow.garrison) >= 100 && gen87.status === 'garrison';
    })());"""
assert s.count(old9) == 1, 'dispatchGather 用例锚点 = ' + str(s.count(old9))
s = s.replace(old9, new9)

wr('smoke-test.js', s)
print('OK · smoke-test.js', len(s))

# ============================================================
# ⑩ main.js：gather-locate case 清理
# ============================================================
m = rd('js/main.js')
old_c = """      case 'gather-locate': ui.mapCenterOn(Number(el.dataset.x), Number(el.dataset.y)); ui.toast('已定位 (' + el.dataset.x + ',' + el.dataset.y + ')'); break;
"""
assert m.count(old_c) == 1, 'gather-locate 锚点 = ' + str(m.count(old_c))
m = m.replace(old_c, """      /* ⛔ v89.136 移除：'gather-locate' —— 采集队总览弹窗退役（地块界面即野地本体，无需定位跳转）。 */
""")
wr('js/main.js', m)
print('OK · main.js', len(m))
