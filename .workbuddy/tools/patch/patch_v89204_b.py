# -*- coding: utf-8 -*-
"""v89.204 批次 B：state.js —— 玩家城"战争创伤"民心出口组（唯一出口）
插入点：heartsComfortAdd 之后、goldBind 之前。
"""
import io

P = 'E:/Deepseekdb/js/state.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

NEW_BLOCK = """  /* ============================================================
   * v89.204（老板 1）：「占领以民心为基础…（如为我方，除主城不可被占领外，
   *   别的城池将会被敌方占领）」—— 玩家城的**战争创伤**（城级民心的减项 · 唯一出口组）
   * ------------------------------------------------------------
   *   heartsWarOf(city)    = 战争创伤现值（含**每现实日恢复** repairPerDay，读＝算，惰性）
   *   heartsWarAdd(city,d) = 战争创伤累加（敌方破城得手 +20；d 可负；clamp ≥ 0）
   *   cityHeartsOf(city)   = clamp(全境民心(heartsOf) − 战争创伤, 0, 100) —— **城级民心**
   *
   * 存储：`city.warHearts = { loss, day }`（随档走；day = 现实日号 —— 与
   *   siegeStateOf 的"每整日恢复"同一把尺、同一个 DATA.SIEGE.repairPerDay）。
   * ⚠️ 失城判定与一切"该城民心"的显示一律读 cityHeartsOf（城级）；
   *   heartsOf 只是它的**全境基准**（税率 + 安抚）——无战争创伤时两者相等。
   * ============================================================ */
  GAME.heartsWarOf = function (city) {
    if (!city) return 0;
    var rec = city.warHearts;
    if (!rec || !(rec.loss > 0)) return 0;
    var day = GAME.questDayIndex();
    var rep = ((DATA.SIEGE || {}).repairPerDay || 0) * Math.max(0, day - (rec.day == null ? day : rec.day));
    if (rep > 0) {
      rec.loss = Math.max(0, rec.loss - rep);
      rec.day = day;
      if (rec.loss <= 0) { delete city.warHearts; return 0; }
    }
    return rec.loss;
  };
  GAME.heartsWarAdd = function (city, d) {
    if (!city || !d) return 0;
    d = Number(d) || 0;
    if (!d) return 0;
    var cur = GAME.heartsWarOf(city);          /* 先结清惰性恢复（同一口径），再加 */
    if (d < 0 && !city.warHearts) return 0;
    if (!city.warHearts) city.warHearts = { loss: 0, day: GAME.questDayIndex() };
    var rec = city.warHearts;
    rec.loss = Math.max(0, cur + d);
    rec.day = GAME.questDayIndex();
    if (rec.loss <= 0) { delete city.warHearts; return 0; }
    return rec.loss;
  };
  GAME.cityHeartsOf = function (city) {
    var base = GAME.heartsOf();
    var w = GAME.heartsWarOf(city);
    return Math.max(0, Math.min(100, base - w));
  };

"""

ANCHOR = """  /* 给一份 res 对象挂上 gold 访问器（幂等：已是访问器则原样返回，**不重复并池**） */"""

s = rd(P)
if 'GAME.heartsWarOf = function' in s:
    print('[skip] B heartsWar 组')
else:
    c = s.count(ANCHOR)
    assert c == 1, 'anchor count=' + str(c)
    s = s.replace(ANCHOR, NEW_BLOCK + ANCHOR)
    wr(P, s)
    print('[ok] B heartsWar 组')

print('patch B done')
