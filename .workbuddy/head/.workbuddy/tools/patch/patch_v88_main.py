# -*- coding: utf-8 -*-
"""v88 main.js：事件分发 4 条 + do* 包装 2 个。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\main.js'
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

# ---- M1) 事件分发 ----
sub(
"""      case 'do-wild-scene': ui.doWildScene(Number(el.dataset.x), Number(el.dataset.y)); break;""",
"""      case 'do-wild-scene': ui.doWildScene(Number(el.dataset.x), Number(el.dataset.y)); break;
      /* v88：双轨切换 / 蕴养 / 江湖游历 */
      case 'toggle-equip-set': GAME.doToggleEquipSet(el.dataset.gen, el.dataset.set); break;
      case 'ling-temper-open': ui.openLingTemper(); break;
      case 'ling-temper-item': GAME.doLingTemper(el.dataset.key); break;
      case 'do-jianghu': ui.doJianghu(Number(el.dataset.x), Number(el.dataset.y), el.dataset.act); break;""",
    'M1 事件分发', "case 'toggle-equip-set': GAME.doToggleEquipSet(el.dataset.gen, el.dataset.set); break;",
)

# ---- M2) do* 包装 ----
sub(
"""  GAME.doGenUnequipAll = function (genId) {
    var r = GAME.systems.unequipAll(genId);
    ui.toast(r.msg);
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };""",
"""  GAME.doGenUnequipAll = function (genId) {
    var r = GAME.systems.unequipAll(genId);
    ui.toast(r.msg);
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };
  /* v88：双轨切换（改生效套 → 唯一出口分流 → 六维/体力/战斗/界面全链自动同步） */
  GAME.doToggleEquipSet = function (genId, want) {
    var r = GAME.toggleEquipSet(genId, want);
    ui.toast(r.msg);
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };
  /* v88：蕴养（修炼装备强化；面板原地重开显示新等级与精华余额） */
  GAME.doLingTemper = function (key) {
    var r = GAME.lingTemper(key);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLingTemper(); }
  };""",
    'M2 do* 包装', 'GAME.doToggleEquipSet = function (genId, want)',
)

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')
