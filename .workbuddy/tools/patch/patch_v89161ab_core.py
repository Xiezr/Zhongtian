# -*- coding: utf-8 -*-
"""v89.161 补丁 A：黄金上收**玩家层级**（唯一存储 s.gold + 各城 res.gold 访问器）
补丁 B：建造花费按"谁的建筑用谁的城"（canAffordIn/payCostIn 唯一收支出口 + 4 条建造路径 + 3 条返还路径）
补丁 C：城市入库唯一出口 registerCity（3 个新城点）
补丁 D：界面出口（金"全境通用"悬停 + 费用悬停注 + 折损周期的现实时间换算）+ 折损现实时间提示
分段落盘 + 幂等守卫 + node --check。"""
import io, sys

R = 'E:/Deepseekdb/'


def rep(path, tag, old, new, guard):
    s = io.open(R + path, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-46s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 锚点命中 %d 次' % (tag, n)
    io.open(R + path, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-46s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ══════════════ A. state.js · 黄金池 ══════════════
rep('js/state.js', 'state · 黄金池四出口',
    """        enumerable: false,
        configurable: true,
      });
    } catch (e) { console.warn('attachRes 失败：', e); }
    return st;
  };""",
    """        enumerable: false,
        configurable: true,
      });
    } catch (e) { console.warn('attachRes 失败：', e); }
    return st;
  };

  /* ============================================================
   * v89.161（老板 5）：「**只有黄金是玩家层级通用的**」——
   *   金从"每城一份"上收为**玩家层级唯一存储 `s.gold`**；
   *   各城 `res.gold` 变成**同一口池子的访问器**（读/写都落在这一个数上）。
   * ------------------------------------------------------------
   * 为什么用访问器、而不是逐处改调用点：全仓 ~100 处读写 `res.gold`
   *   （市场买卖 / 月俸 / 缴获 / 治疗 / 提速 / 神器 / 爵位…）。逐处改必漏，
   *   漏掉的那一处就是"某条路仍按城扣款"的静默错账（本项目最经典的失效模式）。
   *   物理上只有一份数据，getter 就是唯一出口。
   * 口径：
   *   · 金**不受仓容上限**（既有口径；storePartsOf 只算粮木石铁）；
   *   · 老档迁移：各城 res.gold **相加**迁入池子（总量不变，只是从此通用）；
   *   · 开局库存 / 攻占缴获自带的金：`registerCity` 时**并进池子**（不留在城里）。
   * ⚠️ 访问器必须 `enumerable: true` —— `for..in res` / `Object.keys(res)` 这类遍历
   *   （资源栏账目、扁平化存档、断言核对）仍要看见 gold，否则金会"凭空消失"。
   * ============================================================ */
  GAME.goldOf = function () {
    var s = GAME.state;
    return Math.max(0, Math.round((s && s.gold) || 0));
  };
  /* 金收支的唯一出口（n 可负；钳到 ≥0） */
  GAME.goldAdd = function (n) {
    var s = GAME.state;
    if (!s) return 0;
    s.gold = Math.max(0, Math.round(((s.gold || 0) + (Number(n) || 0))));
    return s.gold;
  };
  /* 给一份 res 对象挂上 gold 访问器（幂等：已是访问器则原样返回，**不重复并池**） */
  GAME.goldBind = function (r) {
    if (!r) return r;
    var d = null;
    try { d = Object.getOwnPropertyDescriptor(r, 'gold'); } catch (e) { d = null; }
    if (d && d.get) return r;
    try {
      Object.defineProperty(r, 'gold', {
        get: function () { return GAME.goldOf(); },
        set: function (v) {
          var s = GAME.state;
          if (s) s.gold = Math.max(0, Math.round(Number(v) || 0));
        },
        enumerable: true, configurable: true,
      });
    } catch (e) { return r; }
    return r;
  };
  /* 把访问器挂到**所有城**的 res 上（newGame / 读档 / 新城入库后各调一次）。
     opts.keepCityGold = true：把各城**尚未入池**的普通字段值并进池子
     （只用于"新城自带金"这一路；读档走 st.gold 权威值，绝不并池 —— 否则 ×城数）。 */
  GAME.attachGold = function (st, opts) {
    st = st || GAME.state;
    if (!st) return st;
    var keep = !!(opts && opts.keepCityGold);
    var sum = 0;
    (st.cities || []).forEach(function (c) {
      if (!c.res) c.res = GAME.emptyRes();
      var d = null;
      try { d = Object.getOwnPropertyDescriptor(c.res, 'gold'); } catch (e) { d = null; }
      if (!(d && d.get)) {
        sum += (d && d.value) || 0;      /* 还是普通字段（新城/老档）→ 记下待并池 */
        GAME.goldBind(c.res);
      }
    });
    if (keep && sum) st.gold = Math.max(0, ((st.gold || 0) + sum));
    return st;
  };
  /* 城市入库的**唯一出口**（push + 黄金池接线）——
     新城 / 攻占城 / 据点转正都必须经它；否则那座城的金会变成"私房钱"
     （与"金全境通用"相悖，且玩家在别的城花不到它）。 */
  GAME.registerCity = function (city) {
    var s = GAME.state;
    if (!s || !city) return city;
    s.cities.push(city);
    GAME.attachGold(s, { keepCityGold: true });   /* 自带金（缴获 / 预置）并进池子 */
    return city;
  };""",
    'GAME.goldOf = function')

rep('js/state.js', 'state · newGame 挂金池',
    """    GAME.attachRes(GAME.state);   // v60：挂上「当前城池库存」访问器（必须在 story.init 之前）
    if (GAME.story) GAME.story.init();""",
    """    GAME.attachRes(GAME.state);   // v60：挂上「当前城池库存」访问器（必须在 story.init 之前）
    /* v89.161（老板 5）：黄金上收玩家池 —— 开局库存里的金（INITIAL_RES.gold）并进 s.gold */
    GAME.attachGold(GAME.state, { keepCityGold: true });
    if (GAME.story) GAME.story.init();""",
    'attachGold(GAME.state, { keepCityGold: true })')

rep('js/state.js', 'state · 读档迁移金池',
    """      delete st.res;
      GAME.attachRes(st);""",
    """      delete st.res;
      /* v89.161（老板 5）：**黄金上收玩家层级** —— 老档把各城 res.gold 相加迁入 s.gold；
         新档以 st.gold 为权威（各城那份只是冗余副本，**不再累加**，否则 ×城数）。 */
      if (st.gold == null) {
        var _g161 = 0;
        (st.cities || []).forEach(function (c) { _g161 += (c.res && c.res.gold) || 0; });
        st.gold = Math.max(0, Math.round(_g161));
      }
      GAME.attachGold(st);
      GAME.attachRes(st);""",
    'if (st.gold == null) {')

rep('js/state.js', 'state · 归来快照金不按城累加',
    """      (s.cities || []).forEach(function (ct) {
        GAME.RES_KEYS.forEach(function (k) { res[k] += (ct.res && ct.res[k]) || 0; });
      });
      return {
        res: res,""",
    """      (s.cities || []).forEach(function (ct) {
        GAME.RES_KEYS.forEach(function (k) { res[k] += (ct.res && ct.res[k]) || 0; });
      });
      /* v89.161：金是**玩家层级唯一池**（各城那份是同一口池子的访问器）——
         上面按城累加会把金算成 ×城数，这里改读池子。 */
      res.gold = GAME.goldOf();
      return {
        res: res,""",
    'res.gold = GAME.goldOf();')

# ══════════════ B. domain.js · 收支出口（唯一收支出口 canAffordIn/payCostIn） ══════════════
s = io.open(R + 'js/domain.js', 'r', encoding='utf-8', newline='').read()
if 'GAME.canAffordIn = function' in s:
    print('  [skip] %-46s 已落盘' % 'domain · canAffordIn/payCostIn'); sys.stdout.flush()
else:
    OLD = """  GAME.canAfford = function (cost) {
    var s = GAME.state; if (!s) return false;
    for (var k in cost) {
      if (k === 'time') continue;
      if (k === 'jewel') {                    /* v89.104：珠宝需求查 s.items（宝物库存） */
        var need = GAME.jewelNeedOf(cost);
        for (var jid in need) if (((s.items || {})[jid] || 0) < need[jid]) return false;
        continue;
      }
      if ((s.res[k] || 0) < cost[k]) return false;
    }
    return true;
  };
  GAME.payCost = function (cost) {
    var s = GAME.state; if (!s) return;
    for (var k in cost) {
      if (k === 'time') continue;
      if (k === 'jewel') {
        var need = GAME.jewelNeedOf(cost);
        s.items = s.items || {};
        for (var jid in need) s.items[jid] = Math.max(0, (s.items[jid] || 0) - need[jid]);
        continue;
      }
      s.res[k] = (s.res[k] || 0) - cost[k];
    }
  };"""
    NEW = """  /* ============================================================
   * v89.161（老板 5）：「**什么城池的建筑就用对应城池的**，不可跨城消耗资源，需要转运；
   *   只有黄金是玩家层级通用的」——
   * ------------------------------------------------------------
   * 改前：`canAfford/payCost` 读 `s.res`（= **当前城** 的 getter）——
   *   于是"在甲城界面升级/建造乙城的建筑"会**用甲城的粮木石铁付款**（跨城挪用，无声无息）。
   * 现在：
   *   · `canAffordIn(city, cost)` / `payCostIn(city, cost)` = **唯一收支出口**：
   *       货品（粮木石铁）查/扣**该城**库存；黄金查/扣玩家池；珠宝查 `s.items`（宝物）。
   *   · `canAfford/payCost`（不传城）= 当前城 —— 留给"当前城语境"的流程（募兵 / 科技 / 门派…）。
   *   · 跨城要资源 → 走「本境调运」（资源运输）—— 这正是它的存在意义。
   * 判据唯一：界面提示（费用悬停）与内核拦截都读同一份 cost 对象，不另算一遍。
   * ============================================================ */
  GAME.canAffordIn = function (city, cost) {
    var s = GAME.state; if (!s) return false;
    var ct = city || GAME.currentCity();
    var R = GAME.res(ct);
    for (var k in cost) {
      if (k === 'time') continue;
      if (k === 'jewel') {                    /* v89.104：珠宝需求查 s.items（宝物库存） */
        var need = GAME.jewelNeedOf(cost);
        for (var jid in need) if (((s.items || {})[jid] || 0) < need[jid]) return false;
        continue;
      }
      if (k === 'gold') {                     /* v89.161：金 = 玩家层级通用（唯一池） */
        if (GAME.goldOf() < cost[k]) return false;
        continue;
      }
      if ((R[k] || 0) < cost[k]) return false;
    }
    return true;
  };
  GAME.payCostIn = function (city, cost) {
    var s = GAME.state; if (!s) return;
    var ct = city || GAME.currentCity();
    var R = GAME.res(ct);
    for (var k in cost) {
      if (k === 'time') continue;
      if (k === 'jewel') {
        var need = GAME.jewelNeedOf(cost);
        s.items = s.items || {};
        for (var jid in need) s.items[jid] = Math.max(0, (s.items[jid] || 0) - need[jid]);
        continue;
      }
      if (k === 'gold') { GAME.goldAdd(-cost[k]); continue; }
      R[k] = (R[k] || 0) - cost[k];
    }
  };
  /* 当前城语境的两个薄转发（既有调用点语义不变） */
  GAME.canAfford = function (cost) { return GAME.canAffordIn(GAME.currentCity(), cost); };
  GAME.payCost = function (cost) { return GAME.payCostIn(GAME.currentCity(), cost); };"""
    rep('js/domain.js', 'domain · canAffordIn/payCostIn', OLD, NEW, 'GAME.canAffordIn = function')

# ══════════════ B2. 建造路径改 city-aware ══════════════
rep('js/domain.js', 'domain · buildExt 花费按本城',
    """    var cost = GAME.extBuildCost(eid, 0);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源不足' };
    GAME.payCost(cost);
    e.pending = eid;""",
    """    var cost = GAME.extBuildCost(eid, 0);
    /* v89.161：花费按**该地块所属城**结算（本函数本就只服务当前城，改的是口径显式化） */
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    e.pending = eid;""",
    '本城资源不足（跨城需走「本境调运」）')

s = io.open(R + 'js/domain.js', 'r', encoding='utf-8', newline='').read()
if 'cityId 可指向**非当前城**' in s:
    print('  [skip] %-46s 已落盘' % 'domain · upgradeExt 花费按本城')
else:
    rep('js/domain.js', 'domain · upgradeExt 花费按本城',
        """    var cost = GAME.extBuildCost(e.type, e.lv);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源不足' };
    GAME.payCost(cost);
    e.pending = e.type;""",
        """    var cost = GAME.extBuildCost(e.type, e.lv);
    /* v89.161（老板 5）：cityId 可指向**非当前城** —— 花费必须按那座城扣
       （改前 `canAfford/payCost` 读当前城 → 跨城挪用）。 */
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    e.pending = e.type;""",
        'cityId 可指向**非当前城**')

rep('js/domain.js', 'domain · buildAt 花费按该城',
    """    if (!GAME.canAfford(cost)) return { ok: false, msg: '材料不足，无法建造' };
    GAME.payCost(cost);
    cell.pending = { buildId: buildId, targetLevel: 1 };""",
    """    /* v89.161（老板 5）：**谁的城用谁的货** —— buildAt 的 cityId 可指向非当前城 */
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    cell.pending = { buildId: buildId, targetLevel: 1 };""",
    'buildAt 的 cityId 可指向非当前城')

rep('js/domain.js', 'domain · upgradeAt 花费按该城',
    """    if (!GAME.canAfford(cost)) {
      /* v89.104：高等级升级的拦路虎可能是**珠宝**而不是资源 —— 报清楚缺哪种
         （原在 upgradeWall 里，城墙并入通用路径后迁到此，全建筑受益）。 */
      var _jt126 = (cost.jewel && GAME.costJewelText) ? GAME.costJewelText(cost) : '';
      return { ok: false, msg: cost.jewel ? ('珠宝不足（' + _jt126 + '）') : '材料不足' };
    }
    GAME.payCost(cost);""",
    """    /* v89.161（老板 5）：**谁的建筑用谁的城** —— upgradeAt 的 cityId 可指向非当前城
       （自动升级会遍历所有城；改前一律用当前城的货，等于跨城挪用）。 */
    if (!GAME.canAffordIn(city, cost)) {
      /* v89.104：高等级升级的拦路虎可能是**珠宝**而不是资源 —— 报清楚缺哪种
         （原在 upgradeWall 里，城墙并入通用路径后迁到此，全建筑受益）。 */
      var _jt126 = (cost.jewel && GAME.costJewelText) ? GAME.costJewelText(cost) : '';
      return { ok: false, msg: cost.jewel ? ('珠宝不足（' + _jt126 + '）') : '本城资源不足（跨城需走「本境调运」）' };
    }
    GAME.payCostIn(city, cost);""",
    'upgradeAt 的 cityId 可指向非当前城')

rep('js/domain.js', 'domain · convertExt 花费按该城',
    """    var cost = GAME.extConvertCost(extIdx, newType, city.id);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '改建材料不足' };
    GAME.payCost(cost);""",
    """    var cost = GAME.extConvertCost(extIdx, newType, city.id);
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: '本城改建材料不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);""",
    '本城改建材料不足（跨城需走「本境调运」）')

rep('js/domain.js', 'domain · 募兵花费按该城',
    """    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源不足' };
    GAME.payCost(cost);
    /* 训练时间：单个训练秒×数量（练兵技巧/韩信三篇减时） */""",
    """    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    /* 训练时间：单个训练秒×数量（练兵技巧/韩信三篇减时） */""",
    '募兵花费按该城')

# ══════════════ B3. 返还路径 ══════════════
rep('js/domain.js', 'domain · refundCert 可按城返还',
    """  GAME.refundCert = function (cost, ratio) {
    ratio = ratio == null ? 0.5 : ratio;
    var s = GAME.state; if (!s) return;
    for (var k in cost) {
      if (k === 'jewel') continue;            /* 同上：珠宝不返还 */
      s.res[k] = (s.res[k] || 0) + Math.floor(cost[k] * ratio);
    }
  };""",
    """  GAME.refundCert = function (cost, ratio, city) {
    ratio = ratio == null ? 0.5 : ratio;
    var s = GAME.state; if (!s) return;
    /* v89.161（老板 5）：返还进**该城**（谁的建筑拆了就还给谁）；不传 = 当前城。
       金例外：进玩家唯一池（金全境通用）。 */
    var R = GAME.res(city || null);
    for (var k in cost) {
      if (k === 'jewel') continue;            /* 同上：珠宝不返还 */
      if (k === 'gold') { GAME.goldAdd(Math.floor(cost[k] * ratio)); continue; }
      R[k] = (R[k] || 0) + Math.floor(cost[k] * ratio);
    }
  };""",
    'GAME.refundCert = function (cost, ratio, city)')

rep('js/domain.js', 'domain · 拆除返还进该城（城内）',
    """    GAME.refundCert(step, DATA.DEMOLISH_RATE);""",
    """    GAME.refundCert(step, DATA.DEMOLISH_RATE, city);   /* v89.161：还给**这座城** */""",
    'GAME.refundCert(step, DATA.DEMOLISH_RATE, city)')

rep('js/domain.js', 'domain · 拆除返还进该城（城外）',
    """    GAME.refundCert(out, DATA.DEMOLISH_RATE);""",
    """    GAME.refundCert(out, DATA.DEMOLISH_RATE, city);   /* v89.161：还给**这座城** */""",
    'GAME.refundCert(out, DATA.DEMOLISH_RATE, city)')

rep('js/domain.js', 'domain · 取消建造返还进队列所属城',
    """    for (var k2 in refund) s.res[k2] = (s.res[k2] || 0) + refund[k2];""",
    """    /* v89.161（老板 5）：返还进**队列项所属城** —— 改前用当前城，
       在甲城取消乙城的工程会把材料还到甲城（跨城挪用）。金进玩家唯一池。 */
    var _rd161 = GAME.cityById(q.cityId) || GAME.currentCity();
    var _RR161 = GAME.res(_rd161);
    for (var k2 in refund) {
      if (k2 === 'gold') { GAME.goldAdd(refund[k2]); continue; }
      _RR161[k2] = (_RR161[k2] || 0) + refund[k2];
    }""",
    '返还进**队列项所属城**')

# ══════════════ C. 城市入库唯一出口 ══════════════
rep('js/domain.js', 'domain · 筑城走 registerCity',
    """      initialExt: 'new',   /* v89.93（整改 E12）：自建城预置 6 块城外资源地，落地即可产 */
    });
    s.cities.push(city);""",
    """      initialExt: 'new',   /* v89.93（整改 E12）：自建城预置 6 块城外资源地，落地即可产 */
    });
    GAME.registerCity(city);   /* v89.161：入库唯一出口（含黄金池接线） */""",
    'GAME.registerCity(city);   /* v89.161：入库唯一出口')

rep('js/battle.js', 'battle · 攻占城走 registerCity',
    """    s.cities.push(newCity);""",
    """    GAME.registerCity(newCity);   /* v89.161：入库唯一出口（缴获的金并进玩家池） */""",
    'GAME.registerCity(newCity);')

rep('js/battle.js', 'battle · 据点转正走 registerCity',
    """    s.cities.push(city);""",
    """    GAME.registerCity(city);   /* v89.161：入库唯一出口（含黄金池接线） */""",
    'GAME.registerCity(city);   /* v89.161：入库唯一出口（含黄金池接线）')

print('\nA~C 段完成。')
