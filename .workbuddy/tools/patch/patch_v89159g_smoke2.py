# -*- coding: utf-8 -*-
"""v89.159 补丁 G：smoke §159 追加"奖励入账唯一出口"三条断言（复核轮真 bug 的回归守卫）。"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'smoke-test.js'
s = io.open(R + P, 'r', encoding='utf-8', newline='').read()
GUARD = '§159⑤ 奖励入账唯一出口 addResCapped'
if GUARD in s:
    print('  [skip] §159⑤ 已落盘'); sys.stdout.flush()
else:
    ANCHOR = "    /* ---- ④ 档案在册 ---- */\n    check('§159④ 需求档案在册"
    assert s.count(ANCHOR) == 1
    ADD = """    /* ---- ⑤ 奖励入账唯一出口（v89.159 复核轮真 bug） ---- */
    check('§159⑤ addResCapped 三态：超上限不加不削 / 低于上限补满 / 记账被截量', (function () {
      var st = G.state, c = G.currentCity();
      var bkCity159c = G.ui._cityId, bkGrain = st.res.grain;
      try {
        G.ui._cityId = c.id;
        var cap = G.storeCapOf(c);
        st.res.grain = cap + 123456;
        var r1 = G.addResCapped('grain', 1000, c);
        var keep = st.res.grain === cap + 123456;
        st.res.grain = cap - 300;
        var r2 = G.addResCapped('grain', 1000, c);
        var fill = r2.added === 300 && r2.trimmed === 700 && Math.round(st.res.grain) === Math.round(cap);
        return cap > 0 && keep && r1.added === 0 && r1.trimmed === 1000 && fill;
      } finally {
        st.res.grain = bkGrain;
        G.ui._cityId = bkCity159c;
      }
    })(), '旧写法"先加再截回 cap"会把超上限的存量削回去');
    check('§159⑤ 采集收获：满仓不削存量 + 装不下写进收获明细（真调 finishGather）', (function () {
      var st = G.state, c = G.currentCity();
      var bkCity159d = G.ui._cityId, bkGrain = st.res.grain;
      var t5 = null, tp5 = null;
      if (!st.map.grid) G.map.generate();
      for (var y = 1; y < DATA.MAP_H - 1 && !tp5; y++) {
        for (var x = 1; x < DATA.MAP_W - 1 && !tp5; x++) {
          var tl = G.map.tile(x, y);
          if (tl && tl.terrain !== 'city' && G.gatherResOf(tl.terrain)) { t5 = { x: x, y: y }; tp5 = tl.terrain; }
        }
      }
      if (!t5) return false;
      try {
        G.ui._cityId = c.id;
        st.gathers = st.gathers || [];
        st.gathers.push({ id: 'smoke159g', x: t5.x, y: t5.y, type: tp5, level: 5,
          elapsed: 999999, army: { minfu: 5000 }, genId: null, cityId: c.id });
        var cap = G.storeCapOf(c);
        st.res.grain = cap + 50000;
        var before = st.res.grain;
        var fin = G.finishGather('smoke159g');
        return fin.ok === true && st.res.grain >= before - 0.001
          && fin.trimmed === fin.amount && fin.amount > 0
          && /仓容已满/.test(fin.rewardText || '');
      } finally {
        st.gathers = (st.gathers || []).filter(function (x) { return x.id !== 'smoke159g'; });
        st.res.grain = bkGrain;
        G.ui._cityId = bkCity159d;
      }
    })());
    check('§159⑤ 全站不再有"先加再截回 cap"的奖励入账（源码零残留）',
      !/if \\(cap > 0 && s\\.res\\[[^\\]]+\\] > cap\\) s\\.res\\[/.test(dS159)
      && /GAME\\.addResCapped = function/.test(dS159));

"""
    s = s.replace(ANCHOR, ADD + ANCHOR)
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s)
    print('  [ ok ] §159⑤ 三条断言已插入'); sys.stdout.flush()
print('补丁 G 完成。')
