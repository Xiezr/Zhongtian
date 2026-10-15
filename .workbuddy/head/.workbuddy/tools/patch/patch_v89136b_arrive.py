# -*- coding: utf-8 -*-
# v89.136 批0-b：battle.js —— arrive 的 gather 分支改"老档在途并入"（不再有新的 gather 出发）
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

b = rd('js/battle.js')

# ============================================================
# ① v89.87 注释块：采集描述更新
# ============================================================
old_note = '''     * · 调兵：抵达入城（再验一次目标城校场，超容则整体折返）；
     * · 采集：调既有 startGather 的 arrived 路径（跳过重复扣减）。'''
new_note = '''     * · 调兵：抵达入城（再验一次目标城校场，超容则整体折返）；
     * · 采集：**v89.136 起仅服务老档** —— 将领带队采集已并入驻军开采（入口全撤），
     *   此处只负责把"老档在途"的采集行军并入该野地驻军（不丢兵）。'''
assert b.count(old_note) == 1, '注释锚点 = ' + str(b.count(old_note))
b = b.replace(old_note, new_note)

# ============================================================
# ② gather 分支替换
# ============================================================
old_g = '''    if (mode.id === 'gather') {
      var _gr = GAME.startGather(t.x, t.y, gen.id, atkArmy, { arrived: true, cityId: city.id });
      if (_gr.ok) _expArmySettled = true;     /* 兵已移交采集队（军账在采集记录上） */
      return { ok: _gr.ok, mode: 'gather', peaceful: true, target: t, gather: _gr,
        msg: _gr.msg };
    }'''
new_g = '''    if (mode.id === 'gather') {
      /* v89.136：将领带队采集已并入驻军开采（`dispatchGather` / `openGatherModal` /
         `openGathers` 全撤，墓碑见各文件）。此分支**仅服务老档**：
         v89.136 之前出发、仍在途的采集行军 —— 抵达时兵并入该野地驻军
         （野地非我方则整体回城），与此前"抵达开始采集"的下场等价（**不丢兵**）。 */
      var _gw136 = GAME.map.wildAt(t.x, t.y);
      var _gadd136 = 0;
      if (_gw136) {
        var _gb136 = GAME.wildGarrisonAdd(t.x, t.y, atkArmy, city.id, { noCap: true, genId: gen && gen.id });
        if (_gb136.overflow) {
          for (var _o136 in _gb136.overflow) city.army[_o136] = (city.army[_o136] || 0) + _gb136.overflow[_o136];
        }
        _gadd136 = _gb136.add || 0;
        var _wg136 = GAME.wildGarrisonAt(t.x, t.y);
        if (gen) gen.status = (_wg136 && _wg136.genId === gen.id) ? 'garrison' : 'idle';
      } else {
        for (var _k136 in atkArmy) city.army[_k136] = (city.army[_k136] || 0) + atkArmy[_k136];
        if (gen) gen.status = 'idle';
      }
      _expArmySettled = true;                 /* 军账已结（兵已并入 / 已回城） */
      return { ok: true, mode: 'gather', peaceful: true, target: t,
        msg: '（老档在途）采集队抵达：' + U.fmt(_gadd136) + ' 兵并入驻军'
          + (gen ? '，' + gen.name + ' 留驻野地' : '') };
    }'''
assert b.count(old_g) == 1, 'gather 分支锚点 = ' + str(b.count(old_g))
b = b.replace(old_g, new_g)

# ---------- 写后自检 ----------
for sent in ['（老档在途）采集队抵达', '仅服务老档', '_gadd136']:
    assert b.count(sent) >= 1, '丢失哨兵: ' + sent
assert 'startGather(t.x, t.y, gen.id, atkArmy' not in b, '旧调用残留'

import re, io as _io
_before = _io.open(ROOT + 'js/battle.js', 'r', encoding='utf-8', newline='').read()
def _bd(x):
    return (len(re.findall(r'(?<![\^\\])\{', x)) - len(re.findall(r'(?<![\^\\])\}', x)))
print('braces diff before/after =', _bd(_before), _bd(b))
assert _bd(_before) == _bd(b), '花括号净差变了'

wr('js/battle.js', b)
print('OK · battle.js', len(b))
