# -*- coding: utf-8 -*-
"""v89.87 需求2：smoke 三处断言更新（模态数 / 驻军走行军 / 上限断言补抵达）"""
import io

P = r'E:\Deepseekdb\smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

# ① 方式数 3 → 6
old1 = """  check('三种方式齐备（侦查/掠夺/占领）', DATA.EXPEDITION.modes.length === 3
    && DATA.EXPEDITION.modes.map(function (m) { return m.id; }).join(',') === 'scout,raid,occupy');"""
new1 = """  /* v89.87（需求 2）：派兵统一走行军通道 —— 三个"非战斗调派"并入方式表
     （调兵 transfer / 驻守 station / 采集 gather） */
  check('v89.87：方式齐备（侦查/掠夺/占领 + 调兵/驻守/采集）', DATA.EXPEDITION.modes.length === 6
    && DATA.EXPEDITION.modes.map(function (m) { return m.id; }).join(',') === 'scout,raid,occupy,transfer,station,gather');"""
assert s.count(old1) == 1, ('modes', s.count(old1))
s = s.replace(old1, new1, 1)

# ② 驻军扣兵断言：改两段式（出发扣兵入队 · 抵达写入野地）
old2 = """  check('实测：驻军从城内扣兵并写入野地', (function () {
    var s = G.state, c = G.currentCity();
    var bw = JSON.stringify(s.wilds), ba = JSON.stringify(c.army);
    s.wilds = [{ x: -9, y: -9, type: 'lake', level: 5, levelDay: 0 }];
    c.army = { yibing: 1000 };
    var r = G.doWildGarrison(-9, -9, { yibing: 400 }, c.id);
    var ok = r.ok && c.army.yibing === 600 && s.wilds[0].garrison && s.wilds[0].garrison.troops.yibing === 400;
    s.wilds = JSON.parse(bw); c.army = JSON.parse(ba);
    return ok;
  })());"""
new2 = """  check('实测：驻军走行军通道（出发扣兵入队 · 抵达写入野地）', (function () {
    /* v89.87（需求 2）：驻守改走行军 —— 出发扣兵入 marches，抵达才写野地 */
    var s = G.state, c = G.currentCity();
    var wt2 = null;
    for (var dy = 5; dy <= 9 && !wt2; dy++) for (var dx = 5; dx <= 9 && !wt2; dx++) {
      var tl2 = G.map.tile(c.x + dx, c.y + dy);
      if (tl2 && tl2.terrain !== 'city' && !G.map.wildAt(c.x + dx, c.y + dy)) {
        wt2 = { x: c.x + dx, y: c.y + dy, t: tl2.terrain };
      }
    }
    if (!wt2) return false;
    var bw = JSON.stringify(s.wilds), ba = JSON.stringify(c.army);
    var bm = JSON.stringify(s.marches || []);
    var gen = s.generals[0]; gen.status = 'idle'; gen.cityId = c.id;
    s.wilds = s.wilds || [];
    s.wilds.push({ x: wt2.x, y: wt2.y, type: wt2.t, level: 5, day: 0, startDay: 0 });
    c.army = { yibing: 1000 };
    s.marches = [];
    var r = G.doWildGarrison(wt2.x, wt2.y, { yibing: 400 }, c.id, gen.id);
    var stage1 = r.ok && c.army.yibing === 600 && s.marches.length === 1
      && !(G.map.wildAt(wt2.x, wt2.y).garrison || {}).troops;
    var m = s.marches[0];
    if (m) { m.elapsed = m.totalTime; G.march.tick(); }
    var g2 = G.map.wildAt(wt2.x, wt2.y).garrison;
    var stage2 = !!(g2 && g2.troops && g2.troops.yibing === 400);
    if (gen.status === 'march') gen.status = 'idle';
    s.wilds = JSON.parse(bw); c.army = JSON.parse(ba); s.marches = JSON.parse(bm);
    return stage1 && stage2;
  })());"""
assert s.count(old2) == 1, ('garrison', s.count(old2))
s = s.replace(old2, new2, 1)

# ③ 上限断言：传 genId + 抵达后才写野地
old3 = """  var over = G.doWildGarrison(wt.x, wt.y, { yibing: 30001 }, c.id);
  var ok = G.doWildGarrison(wt.x, wt.y, { yibing: 30000 }, c.id);
  var held = G.wildGarrisonTotal(G.map.wildAt(wt.x, wt.y).garrison);"""
new3 = """  /* v89.87（需求 2）：驻守走行军 —— 上限校验仍在出发（超限即拒）；
     抵达后才写入野地（此处补一次 tick 推进） */
  var _g = s.generals[0]; _g.status = 'idle'; _g.cityId = c.id;
  var over = G.doWildGarrison(wt.x, wt.y, { yibing: 30001 }, c.id, _g.id);
  var ok = G.doWildGarrison(wt.x, wt.y, { yibing: 30000 }, c.id, _g.id);
  var _m = (s.marches || [])[s.marches.length - 1];
  if (_m) { _m.elapsed = _m.totalTime; G.march.tick(); }
  s.marches = [];
  if (_g.status === 'march') _g.status = 'idle';
  var held = G.wildGarrisonTotal(G.map.wildAt(wt.x, wt.y).garrison);"""
assert s.count(old3) == 1, ('cap', s.count(old3))
s = s.replace(old3, new3, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK smoke 三处断言更新')
