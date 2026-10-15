# -*- coding: utf-8 -*-
"""v89.151 批 G1：smoke 五处断言升级（悬停富浮层 / 采集按钮 / 声望封顶 / 简称同宽 / 距离读数）"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag); return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① §118③：悬停改富浮层 ----------
rep(
    """    check('§118③ 兵种悬停：ui.btUnitTip 唯一读 GAME.battle.unitFinalOf（两处 title 共用）', (function () {
      return /ui\\.btUnitTip = function/.test(uc)
        && /GAME\\.battle\\.unitFinalOf\\(u, gen\\)/.test(uc)
        && /U\\.escape\\(ui\\.btUnitTip\\(u, side\\)\\)/.test(uc)
        && (uc.match(/ui\\.btUnitTip\\(u, side\\)/g) || []).length >= 2;
    })());""",
    """    check('§118③/§151 兵种悬停：ui.btUnitTip 唯一读 unitFinalOf（两处**富浮层**共用 · 绿红克制）', (function () {
      return /ui\\.btUnitTip = function/.test(uc)
        && /GAME\\.battle\\.unitFinalOf\\(u, gen\\)/.test(uc)
        /* v89.151：title（纯文本装不下颜色）→ 富浮层（data-tip-el + .tip-src）——
           兵牌与侧栏简称两处共用同一出口；克制/抗性走 cnt-good（绿）、被克走 cnt-bad（红） */
        && /data-tip-el="1"/.test(uc) && /class="tip-src"/.test(uc)
        && /cnt-good/.test(uc) && /cnt-bad/.test(uc)
        && /ui\\.troopCounterOf = function/.test(uc)
        && (uc.match(/ui\\.btUnitTip\\(u, side\\)/g) || []).length >= 2;
    })());""",
    '① §118③')

# ---------- ② §120⑤：「设置采集」→「采集」 ----------
rep(
    """        && /canSet139/.test(seg) && /canFin139/.test(seg)               /* 两按钮常显 */
        && /⚙️ 设置采集/.test(seg) && /📦 收获/.test(seg)""",
    """        && /canSet139/.test(seg) && /canFin139/.test(seg)               /* 两按钮常显 */
        /* v89.151（老板 n+1）：「设置采集」→「⛏️ 采集」（与附属野地同图标同文案） */
        && /⛏️ 采集<\\/button>/.test(seg) && /📦 收获/.test(seg)
        && seg.indexOf('⚙️ 设置采集') < 0""",
    '② §120⑤ 采集按钮')

# ---------- ③ §129①：声望封顶 500 ----------
rep(
    """      if (!R || R.perPower !== 30000 || R.cap !== 200 || R.coefLo !== 0.4 || R.coefHi !== 2) return false;""",
    """      /* v89.151（老板旧账 1）：「封顶500声望吧」—— cap 200 → 500 */
      if (!R || R.perPower !== 30000 || R.cap !== 500 || R.coefLo !== 0.4 || R.coefHi !== 2) return false;""",
    '③ §129① cap 500')

# ---------- ④ §129③：简称富浮层 + 同宽（两下拉等长） ----------
rep(
    """    check('§129③ 侧栏名称位 = 简称（全名/最终属性仍在悬停）· 名称列不再抢宽', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance', target: 'changqiang' }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance' }] };
      var html = G.ui.btSideHTML(snap, 'atk');
      return /<i class="bt-rnm" title="[^"]*长枪兵[^"]*">枪<\\/i>/.test(html)
        && /\\.bt-l1 \\.bt-rnm \\{ flex: 0 0 auto;/.test(h129)
        && /\\.bt-card \\.bt-rnm \\{ max-width: none; flex: 0 0 auto; \\}/.test(h129);
    })());""",
    """    check('§129③/§151 侧栏名称位 = 简称（富浮层含全名/最终属性）· 简称与数量同宽 48px（两下拉等长居右）', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance', target: 'changqiang' }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance' }] };
      var html = G.ui.btSideHTML(snap, 'atk');
      /* v89.151：title → data-tip-el 富浮层（html 里仍有全名 —— 在 .tip-src 内） */
      return /<i class="bt-rnm" data-tip-el="1">枪<span class="tip-src">/.test(html)
        && html.indexOf('长枪兵') >= 0
        /* 简称与数量**同宽 48px** → 两个下拉等长且居右（老板 n） */
        && /\\.bt-l1 \\.bt-rnm \\{ flex: 0 0 48px;/.test(h129)
        && /\\.bt-l2 \\.bt-rn \\{ flex: 0 0 48px;/.test(h129)
        && /\\.bt-card \\.bt-rnm \\{ max-width: none; flex: 0 0 48px; \\}/.test(h129);
    })());""",
    '④ §129③')

# ---------- ⑤ §129⑦：距离读数「距离 XX/XX」 ----------
rep(
    """      var h = G.ui.btTopHTML({ cnt: 60, gapLast: null }, snap);
      _r129g = '读数=' + G.ui.gapReadOf(30, 2600);
      return /最近距离 <b>2,400<\\/b>/.test(h) && /全局 <b>2,600<\\/b>/.test(h)
        && G.ui.gapReadOf(30, 2600) === '最近距离 <b>30<\\/b> / 全局 <b>2,600<\\/b>'
        && G.ui.gapReadOf(null, 2600).indexOf('—') >= 0""",
    """      var h = G.ui.btTopHTML({ cnt: 60, gapLast: null }, snap);
      _r129g = '读数=' + G.ui.gapReadOf(30, 2600);
      /* v89.151（老板旧账 7）：「读数统一，**距离 XX/XX**」—— 两段标签收敛为一段双数 */
      return /距离 <b>2,400<\\/b> \\/ <b>2,600<\\/b>/.test(h)
        && G.ui.gapReadOf(30, 2600) === '距离 <b>30<\\/b> / <b>2,600<\\/b>'
        && G.ui.gapReadOf(null, 2600).indexOf('—') >= 0
        && G.ui.gapReadOf(30, null) === '距离 <b>30<\\/b>'""",
    '⑤ §129⑦')

assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke G1 落盘 OK · len=' + str(len(s)))
