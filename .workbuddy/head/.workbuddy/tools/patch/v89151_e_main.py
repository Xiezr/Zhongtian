# -*- coding: utf-8 -*-
"""v89.151 批 E：main.js —— battle-list-open case / 主循环闪烁 / 缩放限幅"""
import io

P = 'E:/Deepseekdb/js/main.js'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag); return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 底栏「指挥战斗」的 case ----------
rep(
    """      case 'bt-open': ui.openBattlefield(el.dataset.id); break;""",
    """      case 'bt-open': ui.openBattlefield(el.dataset.id); break;
      /* v89.151（老板 3）：底栏「⚔ 指挥战斗」→ 战斗待指挥清单
         （与 v89.150 抵达时自动弹的**同一个出口** —— 两处入口一份清单）。 */
      case 'battle-list-open': ui.openBattleList(); break;""",
    '① battle-list-open case')

# ---------- ② 主循环：闪烁态每秒刷新（只切 class） ----------
rep(
    """        /* v89.132（老板「当前玩家所在城池的点出现闪烁…提示当前所在位置」）：
           底部条缩略图每秒重绘 —— 我城红点随秒交替明暗（1Hz 闪烁）。 */
        ui.paintMiniBottom();""",
    """        /* v89.132（老板「当前玩家所在城池的点出现闪烁…提示当前所在位置」）：
           底部条缩略图每秒重绘 —— 我城红点随秒交替明暗（1Hz 闪烁）。 */
        ui.paintMiniBottom();
        /* v89.151（老板 3）：底栏「⚔ 指挥战斗」的闪烁态每秒核对一次 ——
           只切 class（不重建 DOM），有 state==='live' 的战斗即闪烁。 */
        ui.paintWarBeacon();""",
    '② 主循环 paintWarBeacon')

# ---------- ③ 缩放限幅（DATA.APP_SCALE） ----------
rep(
    """      var w = window.innerWidth || 1440, h = window.innerHeight || 900;
      var k = Math.min(w / 1440, h / 900);
      if (!isFinite(k) || k <= 0) k = 1;
      el.style.setProperty('--app-k', String(Math.round(k * 10000) / 10000));""",
    """      var w = window.innerWidth || 1440, h = window.innerHeight || 900;
      var k = Math.min(w / 1440, h / 900);
      if (!isFinite(k) || k <= 0) k = 1;
      /* v89.151（老板 1）：「缩放加幅按你建议」—— 限幅一档（DATA.APP_SCALE，唯一旋钮）：
         4K 屏（k≈2.4）不再无限放大、超小窗口不无限缩小；限幅后画布居中（#app-fit margin auto）。 */
      var _sc151 = (GAME.DATA && GAME.DATA.APP_SCALE) || { min: 0.6, max: 1.6 };
      k = Math.max(_sc151.min, Math.min(_sc151.max, k));
      el.style.setProperty('--app-k', String(Math.round(k * 10000) / 10000));""",
    '③ 缩放限幅')

assert '\r\n' not in s
assert s.count("case 'battle-list-open'") == 1
assert s.count('ui.paintWarBeacon();') == 1
assert s.count('_sc151') == 3   # var 声明 1 + .min/.max 各 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('main.js 落盘 OK · len=' + str(len(s)))
