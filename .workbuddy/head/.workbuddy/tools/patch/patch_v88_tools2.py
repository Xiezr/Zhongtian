# -*- coding: utf-8 -*-
"""v88 工具层补充（domain.js）：军装强化/拆解对灵气件的防护。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\domain.js'
d = io.open(P, encoding='utf-8', newline='').read()
dirty = False

def sub(old, new, tag, probe):
    global d, dirty
    if probe in d:
        print('SKIP ' + tag)
        return
    assert d.count(old) == 1, tag + ' 锚点命中 %d 次' % d.count(old)
    d = d.replace(old, new, 1)
    dirty = True
    print('OK ' + tag)

# ---- 1) enhList：只列军装件 ----
sub(
"""  /* 可强化清单：背包 + 穿戴里的**全部件**（品质高、已强化者在前） */
  GAME.enhList = function () {
    var out = GAME.eqPieces().slice();""",
"""  /* 可强化清单：背包 + 穿戴里的**军装件**（品质高、已强化者在前）
     v88：过滤掉修炼装备 —— 它们走「蕴养」（lingTemperList），互不越界 */
  GAME.enhList = function () {
    var out = GAME.eqPieces().filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return !(it && it.ling);
    });""",
    '1/3 enhList 过滤', 'v88：过滤掉修炼装备')

# ---- 2) enhance：防护（灵气件导向蕴养） ----
sub(
"""    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造铁匠铺' };""",
"""    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    /* v88：修炼装备不百炼（导流到「蕴养」——材料与体系独立） */
    if (it.ling) return { ok: false, msg: '「' + it.name + '」是修炼装备，请用蕴养（灵气精华）' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造铁匠铺' };""",
    '2/3 enhance 防护', "it.ling) return { ok: false, msg: '「' + it.name + '」是修炼装备，请用蕴养（灵气精华）'",
)

# ---- 3) salvageEquip：禁止拆解灵气件 ----
sub(
"""    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '无此装备' };
    var idx = (s.inventory || []).indexOf(inst);""",
"""    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '无此装备' };
    /* v88：修炼装备不可拆解（军装材料体系不接纳它；蕴养等级随件保留） */
    if (it.ling) return { ok: false, msg: '「' + it.name + '」是修炼装备，不可拆解' };
    var idx = (s.inventory || []).indexOf(inst);""",
    '3/3 salvage 防护', "it.ling) return { ok: false, msg: '「' + it.name + '」是修炼装备，不可拆解'",
)

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')
