# -*- coding: utf-8 -*-
# v89.212（老板 1）：城外堆场**按资源分账** —— domain.js 出口组与消费点
# 幂等：每段 mark = 落盘后新块独有串，重跑自动跳过（§99）。
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark and s.count(mark) >= 1:
        print('[skip] ' + tag)
        return s
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)
    return s

D = 'E:/Deepseekdb/js/domain.js'

# ---------------- A1: storeCapOf 带 key ----------------
rep(D, 'A1 storeCapOf(city,key)',
    """  /* 指定城的仓储上限（唯一出口，别处不要再自己乘一遍） */
  GAME.storeCapOf = function (city) {
    /* v89.158（老板 1）：算式整条搬进 GAME.storePartsOf（分账唯一出口）——
       本函数只做"取总值"的转发，数值与改前**逐字一致**。 */
    return GAME.storePartsOf(city).total;
  };""",
    """  /* 指定城的仓储上限（唯一出口，别处不要再自己乘一遍）
     v89.212（老板 1）：城外堆场**按资源分账** —— 带 key（grain/wood/stone/iron）
       返回**该资源自己的**上限（base + 本类地块堆场）；不带 key = 合计口径
       （展示 / 兼容，数值 = base + Σ分账）。业务判定（tick 封顶 / 逾溢 / 运输 /
       入账 / 开箱）**一律带 key** —— 换资源类型不换口径，一处收口。 */
  GAME.storeCapOf = function (city, key) {
    /* v89.158（老板 1）：算式整条搬进 GAME.storePartsOf（分账唯一出口）——
       本函数只做"取值"的转发。 */
    var sp = GAME.storePartsOf(city);
    if (!key || key === 'gold') return sp.total;
    return (sp.capByRes && sp.capByRes[key] != null) ? sp.capByRes[key] : sp.total;
  };""",
    'GAME.storeCapOf = function (city, key) {')

# ---------------- A2: storePartsOf 返回加 extByRes/capByRes ----------------
rep(D, 'A2 storePartsOf 分账字段',
    """    var ext = GAME.extStoreCapOf(city);
    return { base: base, ext: ext, total: base + ext, lv: lv };
  };""",
    """    var ext = GAME.extStoreCapOf(city);
    /* v89.212（老板 1）：按资源分账 —— extByRes（各类堆场）/ capByRes（各类实际上限）。
       capByRes[k] = base + extByRes[k]：**哪种资源的地块多，哪种的储存上限就大**
       （老板原话「地块多的存的多」）。账目自洽：base + extByRes[k] === capByRes[k]。 */
    var extByRes = GAME.extStoreCapByResOf(city);
    var capByRes = {};
    Object.keys(extByRes).forEach(function (k) { capByRes[k] = base + extByRes[k]; });
    return { base: base, ext: ext, extByRes: extByRes, capByRes: capByRes, total: base + ext, lv: lv };
  };""",
    'extByRes: extByRes, capByRes: capByRes')

# ---------------- A3: extStoreCapOf → byRes 底账 + 带 key 包装 ----------------
rep(D, 'A3 extStoreCapOf 按资源分账',
    """     未建地块不计；已建地块按**当前等级**计入（v89.158 纠偏注释：升级施工期间 e.type 仍在、
     按升级前等级计 —— 等级在完工时才更新，故施工中不会提前给新等级的容量）。
     取整在**总和**上做一次（不是逐块取整，避免误差累积）。 */
  GAME.extStoreCapOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var DIV = DATA.EXT_STORE_DIV || 0;
    if (DIV <= 0) return 0;
    var lvSum = 0;
    GAME.extGridOf(city).forEach(function (e) {
      if (e && e.type) lvSum += Math.max(0, e.lv || 0);
    });
    return Math.round(lvSum * (DATA.BASE_STORE || 2000000) / DIV);
  };""",
    """     未建地块不计；已建地块按**当前等级**计入（v89.158 纠偏注释：升级施工期间 e.type 仍在、
     按升级前等级计 —— 等级在完工时才更新，故施工中不会提前给新等级的容量）。
     v89.212（老板 1「各资源地块数量不同，但最终储存上限一样；应该地块多的存的多」）：
     **按资源分账** —— 农田只堆粮 / 林场只堆木 / 石场只堆石 / 矿场只堆铁；
     每类在"该类等级和"上取整一次（合计 = 分账相加，账目自洽，不再出现对不上的零头）。 */
  /* 按资源分账的**唯一底账**（一次遍历 extGrid，逐类累计 + 逐类取整）。 */
  GAME.extStoreCapByResOf = function (city) {
    city = city || GAME.currentCity();
    var by = { grain: 0, wood: 0, stone: 0, iron: 0 };
    if (!city) return by;
    var DIV = DATA.EXT_STORE_DIV || 0;
    if (DIV <= 0) return by;
    var lvBy = { grain: 0, wood: 0, stone: 0, iron: 0 };
    GAME.extGridOf(city).forEach(function (e) {
      if (!e || !e.type) return;
      var res = (DATA.EXT_BUILDINGS[e.type] || {}).res;   /* 地块类型 → 归属资源 */
      if (res && lvBy[res] != null) lvBy[res] += Math.max(0, e.lv || 0);
    });
    Object.keys(lvBy).forEach(function (k) {
      by[k] = Math.round(lvBy[k] * (DATA.BASE_STORE || 2000000) / DIV);
    });
    return by;
  };
  /* 城外堆场容量：无 key = 四类合计（= Σ分账）；带 key = 该类。
     未知地块类型不计入任何类（外城地块类型仅四类，防御用）。 */
  GAME.extStoreCapOf = function (city, key) {
    var by = GAME.extStoreCapByResOf(city);
    if (key) return by[key] || 0;
    var t = 0;
    Object.keys(by).forEach(function (k) { t += by[k]; });
    return t;
  };""",
    'GAME.extStoreCapByResOf = function (city) {')

# ---------------- A4: overflowRotOf 按资源 ----------------
rep(D, 'A4 overflowRotOf 按资源',
    """    var cap = GAME.storeCapOf(ct);
    if (!(cap > 0)) return out;
    var R = GAME.res(ct);
    (C.keys || []).forEach(function (k) {
      var excess = (R[k] || 0) - cap;
      if (excess > 0) out.push({ k: k, excess: excess });
    });
    return out;""",
    """    /* v89.212（老板 1）：逾溢判定用**各资源自己的**上限（堆场分账后逐资源判定） */
    var caps = GAME.storePartsOf(ct).capByRes || {};
    var R = GAME.res(ct);
    (C.keys || []).forEach(function (k) {
      var cap = caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k);
      if (!(cap > 0)) return;
      var excess = (R[k] || 0) - cap;
      if (excess > 0) out.push({ k: k, excess: excess });
    });
    return out;""",
    '逾溢判定用**各资源自己的**上限')

# ---------------- A5: addResCapped 按资源 ----------------
rep(D, 'A5 addResCapped 按资源',
    """    var cap = GAME.storeCapOf(ct);
    var cur = R[key] || 0;""",
    """    var cap = GAME.storeCapOf(ct, key);   /* v89.212（老板 1）：按资源上限（堆场分账） */
    var cur = R[key] || 0;""",
    'storeCapOf(ct, key);   /* v89.212（老板 1）：按资源上限（堆场分账） */')

# ---------------- A6: transportPlanOf 按资源 ----------------
rep(D, 'A6 transportPlanOf 按资源',
    """      var cap = GAME.storeCapOf(to);
      if (cap > 0) room = Math.max(0, cap - Math.floor(GAME.res(to)[key] || 0));""",
    """      var cap = GAME.storeCapOf(to, key);   /* v89.212（老板 1）：按资源上限（堆场分账） */
      if (cap > 0) room = Math.max(0, cap - Math.floor(GAME.res(to)[key] || 0));""",
    'storeCapOf(to, key);   /* v89.212（老板 1）：按资源上限（堆场分账） */')

print('--- A 批完成 ---')
