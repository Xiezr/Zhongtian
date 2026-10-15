# -*- coding: utf-8 -*-
"""v89.159 补丁 F：复核轮抓出的真 bug —— 采集收获是**唯一 clamp 的奖励入账**，
且"先加再截回 cap"在**存量已超上限**时会把库存**削回**（与 v89.158 的
「只封增长、不削存量」相悖）。
修法：新增奖励入账的唯一出口 `GAME.addResCapped`（只封增长 · 记账被截量）+
finishGather 改走它 + 收获明细写明"装不下" (不再静默)。"""
import io, sys

R = 'E:/Deepseekdb/'
P = 'js/domain.js'


def rep(tag, old, new, guard):
    s = io.open(R + P, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-40s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 命中 %d 次' % (tag, n)
    io.open(R + P, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-40s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ── ① 新增唯一出口（放在 storeCap 附近） ──
OLD1 = """  /* 指定城的仓储上限（唯一出口，别处不要再自己乘一遍） */
  GAME.storeCapOf = function (city) {"""
NEW1 = """  /* ============================================================
   * v89.159（复核轮抓出的真 bug）：**奖励式资源入账的唯一出口**
   * ------------------------------------------------------------
   * 病根：采集收获是全站**唯一** clamp 的奖励入账，写法是"先加满再截回 cap" ——
   *   在**存量已被奖励顶到上限之上**（v89.158 起允许的既成事实）时，
   *   这次收获会把库存**削回** cap（与「只封增长、不削存量」相悖；
   *   实测：500 万 → 366.7 万那种"平白少一截"）。
   * 口径（与 tick 的生产口径同一把尺）：存量 ≥ 上限 → 一点都不加；
   *   否则加到上限为止；**装不下的部分不算入账，但要能被报出来**（返回值带 trimmed）。
   * 返回 { added, trimmed, cur } —— 调用方（收获明细/公文）读它，不再自己算一遍。
   * ============================================================ */
  GAME.addResCapped = function (key, amount, city) {
    var s = GAME.state;
    if (!s || !key) return { added: 0, trimmed: 0, cur: 0 };
    var ct = city || GAME.currentCity();
    var R = GAME.res(ct);
    var cap = GAME.storeCapOf(ct);
    var cur = R[key] || 0;
    var amt = Math.max(0, amount || 0);
    if (!(cap > 0) || key === 'gold') {          /* 黄金不设上限（既有口径） */
      R[key] = cur + amt;
      return { added: amt, trimmed: 0, cur: R[key] };
    }
    if (cur >= cap) return { added: 0, trimmed: amt, cur: cur };
    var add = Math.min(amt, cap - cur);
    R[key] = cur + add;
    return { added: add, trimmed: amt - add, cur: R[key] };
  };
  /* 指定城的仓储上限（唯一出口，别处不要再自己乘一遍） */
  GAME.storeCapOf = function (city) {"""
rep('domain · 新增 addResCapped 唯一出口', OLD1, NEW1, 'GAME.addResCapped = function')

# ── ② finishGather 改走唯一出口 + 记账 ──
OLD2 = """    var cap = GAME.storeCap ? GAME.storeCap() : 0;
    if (y.res && y.amount > 0) {
      s.res[y.res] = (s.res[y.res] || 0) + y.amount;
      if (cap > 0 && s.res[y.res] > cap) s.res[y.res] = cap;
    }"""
NEW2 = """    /* v89.159：改走**奖励入账唯一出口**（只封增长、不削存量；装不下的量记下来报给玩家） */
    var trimmed159 = 0;
    if (y.res && y.amount > 0) {
      var _add159 = GAME.addResCapped(y.res, y.amount, city159 || GAME.cityById(g.cityId));
      trimmed159 = _add159.trimmed || 0;
    }"""
rep('domain · finishGather 走唯一出口', OLD2, NEW2, 'trimmed159')

# city159 变量：在 finishGather 里"入账在前、city 变量在后" —— 提前取一次城，后面复用
OLD3 = """    var gen = null;
    s.generals.forEach(function (x) { if (x.id === g.genId) gen = x; });
    /* v89.159：改走**奖励入账唯一出口**"""
NEW3 = """    var gen = null;
    s.generals.forEach(function (x) { if (x.id === g.genId) gen = x; });
    /* v89.159：入账要按**这支采集队所属城池**的仓容（唯一出口的参数是城对象）——
       原先的 `GAME.storeCap()` 取的是"当前城"，与入账用的 `s.res`（也是当前城）虽然自洽，
       但队列归属城才是有语义的那一座；这里显式取一次，后面归还兵将也复用。 */
    var city159 = GAME.cityById(g.cityId) || GAME.currentCity();
    /* v89.159：改走**奖励入账唯一出口**"""
rep('domain · 取所属城', OLD3, NEW3, 'var city159 = GAME.cityById(g.cityId)')

# ── ③ 收获明细写明"装不下" ──
OLD4 = """    var _gains153 = [(resName || '资源') + ' +' + U.fmt(y.amount)];"""
NEW4 = """    var _gains153 = [(resName || '资源') + ' +' + U.fmt(y.amount)
      + (trimmed159 > 0 ? '（仓容已满，' + U.fmt(trimmed159) + ' 未入库）' : '')];"""
rep('domain · 收获明细写入库缺口', OLD4, NEW4, '仓容已满，')

# ── ④ 返回体带 trimmed（工具/测试可读） ──
OLD5 = """    return { ok: true, msg: msg, rewardText: rewardText, res: y.res, amount: y.amount,
      treasure: got, jewel: jewelGot, seeds: seedGot, essence: essGot };"""
NEW5 = """    return { ok: true, msg: msg, rewardText: rewardText, res: y.res, amount: y.amount,
      trimmed: trimmed159, cur: GAME.res(city159)[y.res], cityId: city159 ? city159.id : null,
      treasure: got, jewel: jewelGot, seeds: seedGot, essence: essGot };"""
rep('domain · 返回体带 trimmed', OLD5, NEW5, 'trimmed: trimmed159')

print('\n补丁 F 完成。')
