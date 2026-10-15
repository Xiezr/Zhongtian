# -*- coding: utf-8 -*-
"""v89.128 补丁 B2（state.js）：清理三处残留
   ① 破城掉级：city.wallLv 直写 → 环城槽（v89.128 唯一写口）
   ② planSummaryOf 上方的 v89.126 注释 → v89.128 口径
   ③ fortCityOf 的注释（wallLv 提法过时）
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'js/state.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    assert s.count(old) == 1, '%s 锚点 %d 个' % (tag, s.count(old))
    s = s.replace(old, new)
    n += 1
    print('  ✓ ' + tag)


# ---------- ① 破城掉级 ----------
old1 = """      var wl = GAME.buildingLevel(city, 'chengqiang') || 0;
      if (wl > 0) { city.wallLv = wl - (L.wallDrop || 1); out.wallDrop = L.wallDrop || 1; }"""
new1 = """      var wl = GAME.buildingLevel(city, 'chengqiang') || 0;
      if (wl > 0) {
        /* v89.128：城墙在环城槽（不占格）—— 掉级写回槽（唯一写口 wallSlotOf） */
        var _ws128 = GAME.wallSlotOf(city);
        var _nl128 = Math.max(0, wl - (L.wallDrop || 1));
        _ws128.build = _nl128 <= 0 ? null : { id: 'chengqiang', lvl: _nl128 };
        out.wallDrop = L.wallDrop || 1;
      }"""
rep(old1, new1, '① 破城掉级')

# ---------- ② planSummaryOf 上位注释 ----------
old2 = """   * v89.126：城墙**占格**（老板「与其它建筑并列管理」）—— 由 `CITY_PLAN.order`
   *   收录，等级 = `buildLv`（与其它建筑同一把尺子）；`plan.wallLv` 字段退役。"""
new2 = """   * v89.126 → v89.128：城墙在**NPC 计划**里仍占一格（`CITY_PLAN.order` 收录，
   *   等级 = `buildLv`）—— 这只是影子数据的形状；**攻占转正时提取到环城槽**
   *   （`city.wall`），玩家侧永不占格（老板：「以环城一圈的结构作为一个建筑」）。"""
rep(old2, new2, '② planSummaryOf 注释')

# ---------- ③ fortCityOf 注释 ----------
old3 = """   *   · 城墙不占格（`wallLv` = 城等级，与玩家城/名城同口径）；"""
new3 = """   *   · 城墙读环城槽 city.wall（据点无城墙 → 等级 0，与玩家城/名城同口径）；"""
rep(old3, new3, '③ fortCityOf 注释')

assert s != orig and n == 3


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(orig), '括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))
io.open(P, 'w', encoding='utf-8').write(s)
print('patch B2(state) OK · %d 处' % n)
