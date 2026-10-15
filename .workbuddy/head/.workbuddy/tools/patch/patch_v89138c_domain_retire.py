# -*- coding: utf-8 -*-
"""v89.138 补丁 C：domain.js 退役（度支归集 / 将领派遣域函数）+ battle.js 席位守卫迁移"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

def patch_file(path, repl, tag):
    s = io.open(path, 'r', encoding='utf-8', newline='').read()
    for old, new, sub in repl:
        if s.count(old) != 1:
            print('❌ [%s/%s] 锚点命中 %d 次' % (tag, sub, s.count(old))); sys.exit(1)
        s = s.replace(old, new)
    assert '\r\n' not in s, '行尾混入 CRLF'
    tmp = path + '.tmp138'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, path)
    ok.append(tag)
    print('  ✓ ' + tag)

D = os.path.join(ROOT, 'js', 'domain.js')
B = os.path.join(ROOT, 'js', 'battle.js')

# ══════════ ① domain：度支归集整段墓碑 ══════════
patch_file(D, [(
"""  /* ============================================================
   * v89.93（整改 E11）：**度支归集**（跨城资金调剂 —— 唯一出口）
   * ------------------------------------------------------------
   * 改前：研究/建造只花「当前城」府库 → 主城被建造耗干、新城囤金干看着
   * （实测终态三城府库 26 万 / 222 万 / 185 万，末级科技因此被资本闸门搁置）。
   * 现在：一键把各城**结余**（高于保留线）的黄金汇入指定城。
   * 黄金是货币 —— 不走「资源运输」的损耗与仓容（那条规矩管粮木石铁）。
   * 保留线 `keep` 可调：默认每城留 5 万（够发俸禄与应急），其余归集。 */
  GAME.budgetKeep = 50000;
  GAME.budgetGather = function (toId, keep) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var to = toId ? GAME.cityById(toId) : GAME.currentCity();
    if (!to) return { ok: false, msg: '城池不存在' };
    if ((s.cities || []).length < 2) return { ok: false, msg: '只有一座城，无需归集' };
    keep = Math.max(0, Math.floor(keep == null ? GAME.budgetKeep : keep));
    var moved = 0, froms = [];
    (s.cities || []).forEach(function (c) {
      if (c.id === to.id) return;
      var R = GAME.res(c);
      var over = Math.floor((R.gold || 0) - keep);
      if (over <= 0) return;
      R.gold = (R.gold || 0) - over;
      moved += over;
      froms.push(c.name + ' ' + U.fmt(over));
    });
    if (!moved) return { ok: false, msg: '各城结余均不足（每城保留 ' + U.fmt(keep) + ' 金）' };
    var R2 = GAME.res(to);
    R2.gold = (R2.gold || 0) + moved;
    var msg = '度支归集：' + froms.join('、') + ' → ' + to.name + '（合计 ' + U.fmt(moved) + ' 金）';
    GAME.log('🏛 ' + msg);
    return { ok: true, msg: msg, moved: moved, to: to.name };
  };
  /* 可派遣的将领：本城、且不在出征/采集途中 */
  GAME.dispatchableGensOf = function (city) {
    var s = GAME.state;
    city = city || GAME.currentCity();
    if (!s || !city) return [];
    return (s.generals || []).filter(function (g) {
      var gc = GAME.genCityOf(g);
      return gc && gc.id === city.id && g.status !== 'march' && g.status !== 'gather';
    });
  };""",
"""  /* ============================================================
   * ⛔ v89.138（老板 2）：「去掉度支归集这个菜单功能」——整条退役。
   * 删净：`GAME.budgetKeep` + `GAME.budgetGather`（跨城资金调剂）+
   * 城池面板按钮 + `case 'budget-gather'`。
   * 资金调剂未丢：**运输**（出征界面 · 本境调运）可随军押运黄金以外的资源；
   * 黄金是货币、不走运输 —— 各城府库独立经营（这本就是"分城发展"的一部分）。
   * 如需恢复：本段代码见 `backup/v89138/domain.js`（判据：`GAME.budgetGather = function`）。
   * ============================================================ */
  /* ⛔ v89.138（老板 2）：`GAME.dispatchableGensOf`（可派遣将领名单）随
     「将领派遣」面板一并退役 —— 出征界面的主将下拉（expGeneralsOf）已覆盖
     "谁可出征/可调防"的同一判据。 */""",
'度支归集退役')], 'domain 度支归集')

# ══════════ ② domain：doDispatch 墓碑 ══════════
patch_file(D, [(
"""  GAME.doDispatch = function (genId, toCityId) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var to = GAME.cityById(toCityId);
    if (!to) return { ok: false, msg: '目标城池不存在' };
    if (g.cityId === to.id) return { ok: false, msg: g.name + ' 已在' + to.name };
    if (g.status === 'guard') {
      var fc = GAME.cityById(g.cityId);
      return { ok: false, msg: '需先解除 ' + g.name + ' 在' + (fc ? fc.name : '原城') + '的守将职务' };
    }
    if (g.status === 'march') return { ok: false, msg: g.name + ' 正在出征途中' };
    if (g.status === 'gather') return { ok: false, msg: g.name + ' 正在采集，暂不可派遣' };
    /* v64（老板）：「也可其他自己的城池派遣」——但目标城得有位置：
       将领是**归属城市**的，席位就是该城招贤馆的房间数。
       不拦的话人到了 B 城却住不下，B 城的名册会静默超编。 */
    var slotsT = GAME.genSlotsOf(to), usedT = GAME.generalsIn(to).length;
    if (usedT >= slotsT) {
      return { ok: false, msg: slotsT <= 0
        ? (to.name + ' 尚无招贤馆（0 席）—— 先在该城建造招贤馆才能安置将领')
        : (to.name + ' 招贤馆无空位（' + usedT + '/' + slotsT + '），请先升级该城招贤馆') };
    }
    var fromC = GAME.cityById(g.cityId);
    g.cityId = to.id;
    var msg = g.name + ' 自' + (fromC ? fromC.name : '外') + '调往' + to.name;
    GAME.log('🎖 ' + msg);
    return { ok: true, msg: msg };
  };""",
"""  /* ⛔ v89.138（老板 2）：`GAME.doDispatch`（将领调防 · 即时到账）整条退役 ——
     老板「将领派遣…合并成"派遣"和"运输"，均进入出征界面」。
     将领调防现在走**出征界面（本境调运）**：主将随军 → `march.dispatch('transfer')`，
     抵达入城（`gen.cityId = 目标城`，见 expedition 的 owncity 分支）。
     ⚠️ 原函数里的两道闸**已迁移，不是丢掉**：
       · 「守将/城主先解任」→ `prepare` 的 `GAME.marchBlockOf(gen)`（同一出口）；
       · 「目标城招贤馆席位」→ `prepare` 的 transfer 分支（v89.138 新增，见 battle.js）。
     如需恢复：本段代码见 `backup/v89138/domain.js`。 */""",
'doDispatch 退役')], 'domain doDispatch')

# ══════════ ③ battle.js：transfer 的席位守卫迁移 ══════════
patch_file(B, [(
"""    /* v89.87（老板需求 2）：调兵 / 驻守 / 采集的前置校验（统一出口的口子） */
    if (mode.id === 'transfer' && t.kind !== 'owncity') return { ok: false, msg: '调兵目标须为本境城池' };""",
"""    /* v89.87（老板需求 2）：调兵 / 驻守 / 采集的前置校验（统一出口的口子） */
    if (mode.id === 'transfer' && t.kind !== 'owncity') return { ok: false, msg: '调兵目标须为本境城池' };
    /* ============================================================
     * v89.138（老板 2）：「将领派遣」并进出征界面后，原 `GAME.doDispatch` 的
     * **目标城席位预检**迁移到这道唯一闸口（入场即拦，比"到了再发现住不下"好）——
     * 将领是**归属城市**的，席位 = 该城招贤馆房间数；不拦的话目标城名册会静默超编。
     * （「守将/城主不可出征」由下方 `GAME.marchBlockOf` 同一出口负责。）
     * ============================================================ */
    if (mode.id === 'transfer' && t.kind === 'owncity' && gen) {
      var _to138 = t.city;
      if (_to138 && gen.cityId !== _to138.id) {
        var _slots138 = GAME.genSlotsOf(_to138), _used138 = GAME.generalsIn(_to138).length;
        if (_used138 >= _slots138) {
          return { ok: false, msg: _slots138 <= 0
            ? (_to138.name + ' 尚无招贤馆（0 席）—— 先在该城建造招贤馆才能安置将领')
            : (_to138.name + ' 招贤馆无空位（' + _used138 + '/' + _slots138 + '），请先升级该城招贤馆') };
        }
      }
    }""",
'transfer 席位守卫')], 'battle transfer 守卫')

print('✅ 补丁C 完成 · 段: ' + ' / '.join(ok))
