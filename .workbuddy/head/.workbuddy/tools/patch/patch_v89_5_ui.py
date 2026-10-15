# -*- coding: utf-8 -*-
"""v89.5 UI 补丁：mapPickText 补江湖事后缀（有事报数/灵机加标/荒僻明示）"""
import io

P = r'E:\Deepseekdb\js\ui.js'
d = io.open(P, encoding='utf-8', newline='').read()

OLD = """  ui.mapPickText = function () {
    var p = ui.mapPick;
    if (!p) return '点选 —';
    var tag = ({ player: '我城', npc: '名城', wild: '野地', fort: '据点', land: '空地' })[p.kind] || '';
    return '点选 ' + tag + ' (' + p.x + ',' + p.y + ')';
  };"""

NEW = """  ui.mapPickText = function () {
    var p = ui.mapPick;
    if (!p) return '点选 —';
    var tag = ({ player: '我城', npc: '名城', wild: '野地', fort: '据点', land: '空地' })[p.kind] || '';
    var out = '点选 ' + tag + ' (' + p.x + ',' + p.y + ')';
    /* v89.5：野地补一句江湖事 —— 有事报数（灵机者加标），无事报荒僻；
       非野地地形（平原 / 城）没有江湖活动之说，不补后缀。 */
    var tl = GAME.map.tile(p.x, p.y);
    if (tl && GAME.jianghuCands(tl.terrain).length > 0) {
      var jm = GAME.jianghuSpotInfo(p.x, p.y);
      out += jm ? (' · 江湖事 ×' + jm.n + (jm.mark ? ' · 灵机' : '')) : ' · 荒僻';
    }
    return out;
  };"""

assert d.count(OLD) == 1, ('ui 锚点', d.count(OLD))
d = d.replace(OLD, NEW, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK ui.js: mapPickText 已扩展')
