# -*- coding: utf-8 -*-
"""v89.137 补丁 N：smoke-test.js —— 派驻三条断言改走新唯一入口（march.dispatch）
     + 界面出征 dispatch 正则跟随（提交端变量改名）"""
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

# ══════════ 1. 界面出征走 dispatch 正则（提交端变量随 v89.137 改名） ══════════
rep(
"""  check('界面出征走 dispatch（不是即刻 expedition）', /GAME\\.march\\.dispatch\\(target, mode, atk, genSel\\.value(, ui\\._expScheme \\|\\| null)?(, _ops94)?\\)/.test(mS30));""",
"""  /* v89.137：提交端先把「己方野地增援不带将/不带计」解析进 _genSend137 / _schemeSend137
     （值同源：genSel.value / ui._expScheme），再交 dispatch —— 仍走 dispatch，不是即刻 expedition。 */
  check('界面出征走 dispatch（不是即刻 expedition）',
    /GAME\\.march\\.dispatch\\(target, mode, atk, _genSend137, _schemeSend137, _ops94\\)/.test(mS30));""",
'dispatch 正则')

# ══════════ 2. 「驻军走行军通道」—— 唯一入口改为 march.dispatch ══════════
rep(
"""  check('实测：驻军走行军通道（出发扣兵入队 · 抵达写入野地）', (function () {
    /* v89.87（需求 2）：驻守改走行军 —— 出发扣兵入 marches，抵达才写野地 */""",
"""  check('实测：驻军走行军通道（出发扣兵入队 · 抵达写入野地 · v89.137 唯一入口 = dispatch）', (function () {
    /* v89.87（需求 2）：驻守改走行军 —— 出发扣兵入 marches，抵达才写野地。
       v89.137（老板 7）：`GAME.doWildGarrison` 退役 —— 唯一入口 = `GAME.march.dispatch(...,'station')`
       （与出征界面同一条链路；prepare 做上限预检与无将硬闸）。 */""",
'驻军通道名')

rep(
"""    var r = G.doWildGarrison(wt2.x, wt2.y, { yibing: 400 }, c.id, gen.id);
    var stage1 = r.ok && c.army.yibing === 600 && s.marches.length === 1""",
"""    var r = G.march.dispatch({ kind: 'wild', x: wt2.x, y: wt2.y }, 'station', { yibing: 400 }, gen.id);
    var stage1 = r.ok && c.army.yibing === 600 && s.marches.length === 1""",
'驻军通道调用')

# ══════════ 3. 「兵力不足拒绝」—— 改 dispatch（目标仍是己方野地 -9,-9） ══════════
rep(
"""    s.wilds = [{ x: -9, y: -9, type: 'lake', level: 5 }];
    c.army = { yibing: 100 };
    var r = G.doWildGarrison(-9, -9, { yibing: 500 }, c.id);
    var ok = !r.ok && c.army.yibing === 100 && !s.wilds[0].garrison;""",
"""    s.wilds = [{ x: -9, y: -9, type: 'lake', level: 5 }];
    c.army = { yibing: 100 };
    var _g3 = s.generals[0]; _g3.status = 'idle'; _g3.cityId = c.id;
    var r = G.march.dispatch({ kind: 'wild', x: -9, y: -9 }, 'station', { yibing: 500 }, _g3.id);
    var ok = !r.ok && c.army.yibing === 100 && !s.wilds[0].garrison && (s.marches || []).length === 0;""",
'兵力不足调用')

# ══════════ 4. 「超上限拒绝 / 上限内成功」—— 改 dispatch（prepare 预检拦） ══════════
rep(
"""  var over = G.doWildGarrison(wt.x, wt.y, { yibing: 30001 }, c.id, _g.id);
  var ok = G.doWildGarrison(wt.x, wt.y, { yibing: 30000 }, c.id, _g.id);""",
"""  /* v89.137：出发前预检由 prepare 承担（超限**不发兵**）；抵达侧仍由 wildGarrisonAdd 的
     overflow 兜底（两层都在，见 battle.js 的 station 段） */
  var over = G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'station', { yibing: 30001 }, _g.id);
  var ok = G.march.dispatch({ kind: 'wild', x: wt.x, y: wt.y }, 'station', { yibing: 30000 }, _g.id);""",
'超限调用')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'G.doWildGarrison(' not in chk, '旧调用残留'
assert len(ok) == 5, '段数 %d' % len(ok)
print('✅ smoke-test.js 补丁N 完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
