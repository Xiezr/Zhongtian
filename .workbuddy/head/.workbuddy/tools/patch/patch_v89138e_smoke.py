# -*- coding: utf-8 -*-
"""v89.138 补丁 E：smoke-test.js —— 退役跟随（采集召回统一 / 功能标题 / 城池菜单 / 将领派遣新链路）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ 1. 采集入口（地块界面） ══════════
rep(
"""  check('v89.136：采集入口收敛到地块界面（开始/收获/召回 + 独立「采集」区）', (function () {
    var i = uiS.indexOf('ui.openLandModal = function');
    var land = uiS.slice(i, i + 14000);
    return /op-zone-t">采集/.test(land)
      && /data-action="wild-garrison-gather"/.test(land)
      && /data-action="gather-finish"/.test(land)
      && /data-action="gather-abandon-ask"/.test(land);
  })());""",
"""  check('v89.136→v89.138：采集入口收敛到地块界面（开始/收获/召回 + 独立「采集」区）', (function () {
    var i = uiS.indexOf('ui.openLandModal = function');
    var land = uiS.slice(i, i + 14000);
    /* v89.138（老板 0）：召回统一走 wild-withdraw（撤回驻军 = 停采 + 兵将回城） */
    return /op-zone-t">采集/.test(land)
      && /data-action="wild-garrison-gather"/.test(land)
      && /data-action="gather-finish"/.test(land)
      && /data-action="wild-withdraw"/.test(land);
  })());""",
'采集入口')

# ══════════ 2. 采集动作注册 ══════════
rep(
"""  check('采集动作已注册（地块开采 + finish/abandon）',
    /case 'wild-garrison-gather'/.test(mainSrc27) && /case 'gather-finish'/.test(mainSrc27)
    && /case 'gather-abandon-ask'/.test(mainSrc27) && /case 'gather-abandon-do'/.test(mainSrc27));""",
"""  check('采集动作已注册（地块开采 + finish + 召回=wild-withdraw · 旧 abandon 动作已删）',
    /case 'wild-garrison-gather'/.test(mainSrc27) && /case 'gather-finish'/.test(mainSrc27)
    && /case 'wild-withdraw'/.test(mainSrc27)
    && !/case 'gather-abandon-ask'/.test(stripComment(mainSrc27)));""",
'采集动作')

# ══════════ 3. 建筑面板动线 ══════════
rep(
"""  check('#12 建筑面板动线（功能 / 操作三键同排 / 关闭吸底；v76 更新）',
    /class="op-zone-t">功能</.test(uS16) && /class="bldg-acts"/.test(uS16) && /class="bldg-foot"/.test(uS16));""",
"""  check('#12 建筑面板动线（操作三键同排 / 关闭吸底；v89.138：删「功能」标题行）',
    /class="bldg-acts"/.test(uS16) && /class="bldg-foot"/.test(uS16)
    && uS16.indexOf('op-zone-t">功能') < 0);   /* 老板 4：「功能」两个字去掉，直接体现按钮 */""",
'建筑面板动线')

# ══════════ 4. 行军视图（采集撤回） ══════════
rep(
"""  check('行军视图提供采集收获 / 撤回（v89.110：撤回走二次确认）', /data-action="gather-finish"/.test(uS31) && /data-action="gather-abandon-ask"/.test(uS31));""",
"""  check('行军视图提供采集收获 / 撤回（v89.138：撤回 = wild-withdraw 两段确认）',
    /data-action="gather-finish"/.test(uS31) && /data-action="wild-withdraw"/.test(uS31));""",
'行军视图')

# ══════════ 5. 城池面板四动作 ══════════
rep(
"""  check('城池面板提供四项动作（进入/运输/派遣/改名）', (function () {
    var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
    var seg = codeOf(u, 'ui.openCityPanel = function');
    return /data-action="city-enter"/.test(seg) && /data-action="city-transport"/.test(seg)
      && /data-action="city-dispatch"/.test(seg) && /data-action="city-rename"/.test(seg);
  })());""",
"""  check('城池面板动作（v89.138 老板 2：进入/派遣/运输/节钺扩编，度支归集·将领派遣·改名已删）', (function () {
    var u = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
    var seg = codeOf(u, 'ui.openCityPanel = function');
    return /data-action="city-enter"/.test(seg) && /data-action="city-transport"/.test(seg)
      && /data-action="city-dispatch-exp"/.test(seg) && /data-action="jieyue-expand"/.test(seg)
      && seg.indexOf('data-action="city-dispatch"') < 0
      && seg.indexOf('data-action="city-rename"') < 0
      && seg.indexOf('data-action="budget-gather"') < 0;
  })());""",
'城池面板四动作')

# ══════════ 6. 将领派遣三条 → 新链路（march.dispatch transfer） ══════════
rep(
"""  /* ================= 需求 4：派遣 ================= */
  console.log('  --- 需求 4：将领派遣 ---');
  check('实测：派遣改 cityId（人随城走）', (function () {""",
"""  /* ================= 需求 4：派遣（v89.138：并进出征界面 · 唯一入口 = transfer）================= */
  console.log('  --- 需求 4：将领派遣（v89.138 走出征界面） ---');
  check('实测：派遣改 cityId（人随城走 · 唯一入口 march.dispatch transfer）', (function () {""",
'派遣段头')

rep(
"""    var g = V.generals[0];
    g.status = 'idle'; g.cityId = a.id;
    var r = G.doDispatch(g.id, b.id);
    return r.ok && g.cityId === b.id && G.genCityOf(g).id === b.id;
  })(), '目标城 5 级招贤馆 → 5 席');""",
"""    var g = V.generals[0];
    g.status = 'idle'; g.cityId = a.id;
    /* v89.138（老板 2）：将领派遣 = 出征界面（本境调运）—— 允许 0 兵（只派将），抵达入城 */
    var r = G.march.dispatch({ kind: 'owncity', id: b.id }, 'transfer', {}, g.id);
    var _m = (V.marches || [])[V.marches.length - 1];
    if (r.ok && _m) { _m.elapsed = _m.totalTime; G.march.tick(); }
    return r.ok && g.cityId === b.id && G.genCityOf(g).id === b.id;
  })(), '目标城 5 级招贤馆 → 5 席');""",
'派遣实测')

rep(
"""    V.generals.push(G.makeGeneral('占位将', 1, 'idle', b.id, false));
    var r = G.doDispatch(g.id, b.id);
    var blocked = (r.ok === false) && /无空位/.test(r.msg || '');""",
"""    V.generals.push(G.makeGeneral('占位将', 1, 'idle', b.id, false));
    /* v89.138：席位预检已迁到 prepare 的 transfer 分支（原 doDispatch 的 v64 规矩） */
    var r = G.march.dispatch({ kind: 'owncity', id: b.id }, 'transfer', {}, g.id);
    var blocked = (r.ok === false) && /无空位/.test(r.msg || '');""",
'无空位实测')

rep(
"""    var g = V.generals[0];
    g.cityId = b.id; g.status = 'guard';
    var r = G.doDispatch(g.id, V.cities[0].id);
    g.status = 'idle';
    return r.ok === false && /解除/.test(r.msg);""",
"""    var g = V.generals[0];
    g.cityId = b.id; g.status = 'guard';
    /* v89.138：守将/城主的硬拦走 prepare 的 GAME.marchBlockOf（同一出口） */
    var r = G.march.dispatch({ kind: 'owncity', id: V.cities[0].id }, 'transfer', {}, g.id);
    g.status = 'idle';
    return r.ok === false && /守将/.test(r.msg);""",
'守将实测')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp138'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert len(ok) == 9, '段数 %d' % len(ok)
print('✅ smoke 补丁E 完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
