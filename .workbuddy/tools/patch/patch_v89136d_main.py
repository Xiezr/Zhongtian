# -*- coding: utf-8 -*-
# v89.136 批0-d：main.js —— 采集相关 case 清理 + doStartGather 退役 + doFinish/doAbandon 改刷新方式
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

m = rd('js/main.js')

# ============================================================
# ① cases：gather-open / open-gathers / gather-start 删
# ============================================================
old_cases = """      case 'gather-open': ui.openGatherModal(Number(el.dataset.x), Number(el.dataset.y)); break;
      case 'open-gathers': ui.openGathers(); break;
      case 'gather-start': GAME.doStartGather(); break;
"""
new_cases = """      /* ⛔ v89.136 移除：'gather-open'（派军采集面板）/ 'open-gathers'（野地采集弹窗）/
         'gather-start'（其提交端）—— 采集已合并为「带将驻军原地开工」，
         全部操作收敛到地块界面的「采集」区（见 ui.openLandModal 的 gatherBox）。 */
"""
assert m.count(old_cases) == 1, 'cases 锚点 = ' + str(m.count(old_cases))
m = m.replace(old_cases, new_cases)

# ============================================================
# ② doStartGather → 墓碑
# ============================================================
old_dsg = """  GAME.doStartGather = function () {
    var xy = ui._gatherXY;
    if (!xy) { ui.toast('未指定野地'); return; }
    var genEl = document.getElementById('gather-gen');
    var cntEl = document.getElementById('gather-troops');
    var genId = genEl ? genEl.value : ui._gatherGen;
    var count = cntEl ? Number(cntEl.value) : 0;
    if (!count || count <= 0) { ui.toast('请填写派兵数量'); return; }
    var army = GAME.autoPickTroops(count);
    var total = 0;
    for (var k in army) total += army[k];
    if (total <= 0) { ui.toast('城中无兵可派（请先募兵）'); return; }
    /* v89.87（需求 2）：采集改走**行军通道**（出发扣兵，抵达后开始采） */
    var r = GAME.dispatchGather(xy.x, xy.y, genId, army);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openGathers(); }
  };
"""
new_dsg = """  /* ⛔ v89.136 移除：`GAME.doStartGather`（派军采集的提交端）—— 随 openGatherModal 退役，
     采集唯一形态 = 带将驻军原地开工（GAME.startGather，由地块界面 / 自动采集调用）。 */
"""
assert m.count(old_dsg) == 1, 'doStartGather 锚点 = ' + str(m.count(old_dsg))
m = m.replace(old_dsg, new_dsg)

# ============================================================
# ③ doFinishGather / doAbandonGather：去 openGathers，改 liveModalTick
# ============================================================
old_fin = """    if (r.ok) ui.sgTryAct('gather-done', { terrain: _rec31 ? _rec31.type : null });
    GAME.refreshAll();
    ui.openGathers();
  };"""
new_fin = """    if (r.ok) ui.sgTryAct('gather-done', { terrain: _rec31 ? _rec31.type : null });
    GAME.refreshAll();
    /* v89.136：不再重开"野地采集"弹窗（已退役）—— 若当前开着地块面板，
       liveModalTick 立即重开一次（状态当场刷新；从军务点则靠其逐秒重绘）。 */
    ui.liveModalTick();
  };"""
assert m.count(old_fin) == 1, 'doFinishGather 锚点 = ' + str(m.count(old_fin))
m = m.replace(old_fin, new_fin)

old_ab = """  GAME.doAbandonGather = function (id) {
    var r = GAME.abandonGather(id);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openGathers(); }
  };"""
new_ab = """  GAME.doAbandonGather = function (id) {
    var r = GAME.abandonGather(id);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.liveModalTick(); }   /* v89.136：同上 */
  };"""
assert m.count(old_ab) == 1, 'doAbandonGather 锚点 = ' + str(m.count(old_ab))
m = m.replace(old_ab, new_ab)

# ============================================================
# ④ wild-garrison-gather：新签名
# ============================================================
old_wg = "        var _gr = GAME.startGather(_gx, _gy, null, U.deep(_gg.troops), { from: 'garrison' });"
new_wg = "        var _gr = GAME.startGather(_gx, _gy, U.deep(_gg.troops), {});   /* v89.136：新签名 */"
assert m.count(old_wg) == 1, 'wild-garrison-gather 锚点 = ' + str(m.count(old_wg))
m = m.replace(old_wg, new_wg)

# ---------- 写后自检 ----------
for sent in ['⛔ v89.136 移除：', 'ui.liveModalTick();', 'v89.136：新签名']:
    assert m.count(sent) >= 1, '丢失哨兵: ' + sent
assert "case 'gather-open'" not in m, 'gather-open case 未删净'
assert "case 'open-gathers'" not in m, 'open-gathers case 未删净'
assert 'GAME.doStartGather = function' not in m, 'doStartGather 未删净'
assert 'GAME.dispatchGather' not in m, 'dispatchGather 引用残留'

import re, io as _io
_before = _io.open(ROOT + 'js/main.js', 'r', encoding='utf-8', newline='').read()
def _bd(x):
    return (len(re.findall(r'(?<![\^\\])\{', x)) - len(re.findall(r'(?<![\^\\])\}', x)))
print('braces diff before/after =', _bd(_before), _bd(m))
assert _bd(_before) == _bd(m), '花括号净差变了'

wr('js/main.js', m)
print('OK · main.js', len(m))
