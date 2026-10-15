# -*- coding: utf-8 -*-
# v89.229 批 a3：ui.js —— isoCell：badge 并入名称行（名称/等级都在格顶）
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
P = 'js/ui.js'

def rd(): return io.open(BASE + P, encoding='utf-8', newline='').read()
def rep(s, old, new, tag, cnt=1):
    c = s.count(old)
    assert c == cnt, '[%s] count=%d' % (tag, c)
    return s.replace(old, new)

s = rd(); s0 = s

s = rep(s,
"""      /* v23（需求 2/3）：**等级只在格内右上角显示数字**，底部标签只留名字。
         原先等级挤在底部标签里（"训练营 3"），一眼扫过去分不清哪个是名字哪个是等级。 */
      var lab = '';
      if (o.name) lab = '<span class="tile-label"><span class="nm">' + o.name + '</span></span>';
      var badge = o.lvl
        ? '<span class="tile-badge' + (o.lvlMax ? ' max' : '') + '">' + o.lvl + '</span>'
        : '';
      inner = (o.icon || '') + badge + lab;""",
"""      /* v89.229（老板「建筑名称和等级都放顶部，建筑名称的文字色块行高调高」）：
         名称行移到**格顶**、族色编码由名称文字色块承载；等级角标并入名称行右端
         （同在格顶，flex 行内）——v23 的"右上角独立角标 + 底部标签"分工退役。
         无名称时角标独立显示（防御：现状两条渲染路径都带名，此为兜底）。 */
      var badge = o.lvl
        ? '<span class="tile-badge' + (o.lvlMax ? ' max' : '') + '">' + o.lvl + '</span>'
        : '';
      var lab = o.name
        ? '<span class="tile-label"><span class="nm">' + o.name + '</span>' + badge + '</span>'
        : badge;
      inner = (o.icon || '') + lab;""",
'isoCell')

assert s != s0
if DRY:
    print('[DRY] ui.js 1 处命中')
else:
    tmp = BASE + P + '.tmp229a'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd()
    assert t.count("'</span>' + badge + '</span>'") == 1, '拼接未落盘'
    print('[OK] ui.js isoCell 已更新 + 自检通过')
print('A3 DONE%s' % ('（DRY）' if DRY else ''))
