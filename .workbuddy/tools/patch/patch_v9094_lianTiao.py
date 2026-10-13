# -*- coding: utf-8 -*-
"""v90.94 补丁2：练功条从「右栏最下方」挪到「整个面板最下方（横贯）」"""
import io, os

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'js', 'ui.js')

OLD = """          '<tr><td class="k">状态</td><td>正常</td></tr>' +
        '</tbody></table>' +
        /* v90.94（老板「给君主界面的最下方加一条练功菜单」）：练功条独立到面板最下方 ——
           与突破解耦（练功只涨经验，不再是突破门槛）。按不按得成由出口判（doLordTrain）。 */
        (lg ? (function () {
          var st = Math.round(GAME.staNow(lg));
          var stMax = Math.round((GAME.genAttrs(lg) || {}).staMax || 0);
          return '<div class="m-sec">🧘 练功</div>' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<span>君主 Lv' + (lg.level || 1) + '　体力 <b>' + st + '</b> / ' + stMax + '</span>' +
            '<button class="btn sm gold" data-action="lord-train">🧘 练功一次</button>' +
            '<span class="ui-sub">耗体力 ' + DATA.LORD_BREAK.trainSta + ' + 少量净水：涨经验，助君主升级</span>' +
            '</div>';
        })() : '') +
        '</div>' +
      '</div>',"""

NEW = """          '<tr><td class="k">状态</td><td>正常</td></tr>' +
        '</tbody></table>' +
        '</div>' +
      '</div>' +
      /* v90.94（老板「给君主界面的最下方加一条练功菜单」）：练功条独立到**面板最下方**（横贯）——
         与突破解耦（练功只涨经验，不再是突破门槛）。按不按得成由出口判（doLordTrain）。 */
      (lg ? (function () {
        var st = Math.round(GAME.staNow(lg));
        var stMax = Math.round((GAME.genAttrs(lg) || {}).staMax || 0);
        return '<div class="m-sec" style="margin-top:10px;">🧘 练功</div>' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
          '<span>君主 Lv' + (lg.level || 1) + '　体力 <b>' + st + '</b> / ' + stMax + '</span>' +
          '<button class="btn sm gold" data-action="lord-train">🧘 练功一次</button>' +
          '<span class="ui-sub">耗体力 ' + DATA.LORD_BREAK.trainSta + ' + 少量净水：涨经验，助君主升级</span>' +
          '</div>';
      })() : ''),"""

s = io.open(P, encoding='utf-8', newline='').read()
c = s.count(OLD)
assert c == 1, 'anchor count=%d' % c
s = s.replace(OLD, NEW, 1)
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('ui.js patched: %d chars' % len(s))
