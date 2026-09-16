# -*- coding: utf-8 -*-
"""v89.5 引擎补丁：GAME.jianghuSpotInfo（灵机之地判定，唯一出口）"""
import io

P = r'E:\Deepseekdb\js\state.js'
d = io.open(P, encoding='utf-8', newline='').read()

OLD = """    var list = cands.slice().sort(function (a2, b2) { return r('o:' + a2.id) - r('o:' + b2.id); });
    return list.slice(0, Math.min(want, list.length));
  };
  GAME.jianghuDone = function (s, x, y, actId, day) {"""

NEW = """    var list = cands.slice().sort(function (a2, b2) { return r('o:' + a2.id) - r('o:' + b2.id); });
    return list.slice(0, Math.min(want, list.length));
  };
  /* v89.5：灵机之地 —— 有事的野地中「值得专程一访」者（大地图悬青旗）。
     灵机 = 事数 × 野地等级，≥ DATA.JH_MARK.minScore 者为地标（mark）。
     返回 null = 此地无江湖事（荒僻 / 非野地地形）。地图渲染与点选信息共用此出口。 */
  GAME.jianghuSpotInfo = function (x, y) {
    var acts = GAME.jianghuActsAt(x, y);
    if (!acts.length) return null;
    var lv = GAME.map.wildLevelNow(x, y);
    var score = lv * acts.length;
    var th = (DATA.JH_MARK && DATA.JH_MARK.minScore != null) ? DATA.JH_MARK.minScore : 10;
    return { n: acts.length, lv: lv, score: score, mark: score >= th };
  };
  GAME.jianghuDone = function (s, x, y, actId, day) {"""

assert d.count(OLD) == 1, ('state 锚点', d.count(OLD))
d = d.replace(OLD, NEW, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK state.js: GAME.jianghuSpotInfo 已写入')
