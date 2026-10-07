/* ============================================================
 * domain.js  核心业务逻辑（真实数值版）
 * 建造/升级/拆除、城外资源建筑、造兵、任务、英雄、产出计算
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  /* 科技加成取值（统一入口；缺失时返回 0，保证测试环境可跑）
     v89.191（老板 3-④）：**按城** —— 传 city 读该城科技；不传 = 当前城（兼容默认）。 */
  function techB(type, city) {
    return (GAME.systems && GAME.systems.techBonus) ? GAME.systems.techBonus(type, city) : 0;
  }

  /* --------- 当前操作城池（支持多城，默认首城） --------- */
  GAME.currentCity = function () {
    var s = GAME.state;
    if (!s || !s.cities.length) return null;
    var id = (GAME.ui && GAME.ui._cityId);
    if (id) { var c = GAME.cityById(id); if (c) return c; }
    return s.cities[0];
  };

  /* --------- 资源检查/支付（time 字段不计入资源） --------- */
  /* ============================================================
   * v89.104（老板）：「某级别之后…换成需要更多其他材料如珍珠等」
   * ------------------------------------------------------------
   * 造价对象从此可能带一个 `jewel` 字段（`{ 物品id: 数量 }`，见
   * data.js 的 `DATA.jewelCostAt`）。读法只有一处：`GAME.jewelNeedOf`；
   * 校验（canAfford）/ 支付（payCost）/ 界面三处都走它 —— 不另写判断。
   * ============================================================ */
  GAME.jewelNeedOf = function (cost) {
    var out = {}, jw = cost && cost.jewel;
    if (!jw) return out;
    for (var k in jw) { var n = Math.floor(jw[k] || 0); if (n > 0) out[k] = n; }
    return out;
  };
  /* ============================================================
   * v89.161（老板 5）：「**什么城池的建筑就用对应城池的**，不可跨城消耗资源，需要转运；
   *   只有旧币是玩家层级通用的」——
   * ------------------------------------------------------------
   * 改前：`canAfford/payCost` 读 `s.res`（= **当前城** 的 getter）——
   *   于是"在甲城界面升级/建造乙城的建筑"会**用甲城的粮木石铁付款**（跨城挪用，无声无息）。
   * 现在：
   *   · `canAffordIn(city, cost)` / `payCostIn(city, cost)` = **唯一收支出口**：
   *       货品（粮木石铁）查/扣**该城**库存；旧币查/扣玩家池；珠宝查 `s.items`（宝物）。
   *   · `canAfford/payCost`（不传城）= 当前城 —— 留给"当前城语境"的流程（募兵 / 科技 / 派系…）。
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
  /* ============================================================
   * v89.194（老板 S1 跟进）：**缺料提示的唯一出口**
   * ------------------------------------------------------------
   * 建筑 Lv9 起加入"营造金"后，"本城资源不足"这句会误导 ——
   * 金是**全境通用**的玩家池，不是本城资源；缺的也未必是粮木石铁。
   * 本出口逐项对账（金 / 粮木石铁 / 珠宝），报"缺哪项、现有多少"，
   * 并把口径尾注写清（金全境通用；货品按本城结算 → 跨城走「本境调运」）。
   * 消费点：buildAt / upgradeAt / buildExt / upgradeExt / 募兵（五处同源）。
   * 返回 '' = 其实都够（调用方回落旧文案，防判据漂移）。
   * ============================================================ */
  GAME.costLackMsg = function (city, cost) {
    if (!cost) return '';
    var ct = city || GAME.currentCity();
    var R = GAME.res(ct);
    var s0 = GAME.state || {};
    var lacks = [];
    var goldShort = !!(cost.gold && GAME.goldOf() < cost.gold);
    if (goldShort) lacks.push('金 ' + U.fmt(cost.gold) + '（现 ' + U.fmt(GAME.goldOf()) + '）');
    DATA.RESOURCES.forEach(function (r) {
      if (r.key === 'gold') return;
      if (cost[r.key] && (R[r.key] || 0) < cost[r.key]) {
        lacks.push(r.name + ' ' + U.fmt(cost[r.key]) + '（现 ' + U.fmt(R[r.key] || 0) + '）');
      }
    });
    /* 珠宝段复用 costJewelText（唯一出口 · lackOnly 只列缺的） */
    var jt194 = GAME.costJewelText ? GAME.costJewelText(cost, true) : '';
    if (jt194) lacks.push(jt194);
    if (!lacks.length) return '';
    var tail = goldShort ? '（金全境通用）' : '（货品按本城结算，跨城需走「本境调运」）';
    return '缺 ' + lacks.slice(0, 4).join('、') + tail;
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
  GAME.payCost = function (cost) { return GAME.payCostIn(GAME.currentCity(), cost); };
  /* 按比例缩放一份造价对象（仅用于展示返还量，不改变资源）
     ⚠️ v89.104：`jewel` 是**对象**，按比例乘会算出 NaN 键 —— 一律跳过
     （珠宝是消耗性投入，不参与返还评估）。 */
  GAME.scaledCost = function (cost, ratio) {
    var o = {};
    for (var k in cost) {
      if (k === 'jewel') continue;
      o[k] = Math.floor((cost[k] || 0) * ratio);
    }
    return o;
  };
  GAME.refundCert = function (cost, ratio, city) {
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
  };

  /* ============================================================
   * 建筑专精（v28 建 · v89.137 三档）
   * ------------------------------------------------------------
   * 原"建筑专精"：建筑到 12 级（当时的上限）给一条加成。
   * v89.137（老板 5）：改名"建筑专精" + **三档阶梯** ——
   *   Lv12 / Lv24 / Lv36 各记一档（`DATA.MASTERY_TIERS`），
   *   效果 = `DATA.MASTERY[].val × 档数`（第一档保持原值，不推翻已上线数值）。
   * 加成一律**按当前城**判定 —— "这座城的居所满级" 与 "别城的货仓满级" 是两回事；
   * 只有全局口径的量（如建造队列、仓储存量）由调用方决定用全境还是本城，
   * 所以这里只提供"取值"这一件事，不给默认口径。
   *
   * 两个出口的分工（消费点只用这两个，别自己数档）：
   *   masteryTierOf(city, bid) → 0/1/2/3（该建筑在**这座城**的专精档数）
   *   mastery(key, city)       → val × 档数（同 key 多建筑累加；city=null 走全境）
   * ============================================================ */
  GAME.masteryTierOf = function (city, bid) {
    if (!city) return 0;
    var b = DATA.BUILDINGS[bid];
    if (!b) return 0;
    var lv = GAME.buildingLevel(city, bid) || 0;
    var tiers = DATA.MASTERY_TIERS || [DATA.MAX_BLEVEL];
    var n = 0;
    for (var i = 0; i < tiers.length; i++) if (lv >= tiers[i]) n++;
    return n;
  };
  /* ⛔ v89.137：`GAME.masteryOf`（boolean 兼容出口）已删 ——
     三档制后所有消费点都改读 `masteryTierOf`（档数）或 `mastery(key, city)`（含档数的值），
     布尔版零引用即死代码（audit 当场抓出）。
  /* 取某一专精键的合计值（**已含档数**：val × 档数）。city 传 null 时表示**全境** ——
     口径 = "**任一城**到档即计入，取该建筑在全境的最优档数"（同原"任一城满级即计入"
     的延伸：按城**不累加**；同 key 的多座建筑之间仍累加，如三座 +6% 产量的建筑）。
     ⚠️ v89.107 性能告警：`city === null` 是 **O(城×格)** 的重活。别在逐城/逐资源的
     循环里调它 —— 实测 100 城时它被 prodFactors 每 tick 叫 400 次，
     占了 tickOnce 的 97%（10.2ms/tick）。正确姿势 = **在循环外算一次再传进去**
     （见 state.js 的 cityProdPerSec(city, opt.mpGlobal) 与 productionPerSec）。 */
  GAME.mastery = function (key, city) {
    var sum = 0, list = DATA.MASTERY || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.key !== key) continue;
      if (city === null) {
        var t = 0;
        ((GAME.state && GAME.state.cities) || []).forEach(function (ct) {
          var x = GAME.masteryTierOf(ct, m.bid);
          if (x > t) t = x;
        });
        sum += m.val * t;
      } else {
        var c = city || (GAME.currentCity ? GAME.currentCity() : null);
        sum += m.val * GAME.masteryTierOf(c, m.bid);
      }
    }
    return sum;
  };
  /* v60（需求 3）：`GAME.masteryListOf` 已删 ——
     它唯一的消费点是全境汇总的「丙 · 建筑专精」那一节，而老板要求
     专精说明搬进**对应建筑**的面板里（那里直接读 masteryTierOf(bid)，不需要列表）。
     留着就是死函数（audit 会报），所以整段撤掉。 */

  /* --------- 幸存者上限（居所等级表） --------- */
  GAME.maxPopOf = function (city, ignoreGuard) {
    var cap = 0;
    city.cells.forEach(function (c) {
      if (c.build && c.build.id === 'minfang') {
        var p = DATA.BUILDINGS.minfang.pop[c.build.lvl - 1];
        if (p) cap += p;
      }
    });
    /* v28：居所建筑专精 —— 幸存者上限 +20% */
    cap = Math.round(cap * (1 + GAME.mastery('popPct', city)));
    /* v74（老板需求 1）：「取消英雄对幸存者上限的加成」——
       守将指挥的幸存者贡献整段撤除（DATA.POP_PER_TONG 一并下线）。
       幸存者上限从此**只**由居所（+ 建筑专精）决定：一个来源，一眼可查。
       （`ignoreGuard` 参数保留：历史调用点传 true 表示"不含守将加成"，
        现在本来就没有该加成 —— 不删参数是为了不动那些调用点。） */
    return cap;
  };
  /* ============================================================
   * v89.185（老板 6）：**实际幸存者上限** —— 唯一出口
   * ------------------------------------------------------------
   * 老板原话：「民心与幸存者比例挂钩，实际幸存者上限=幸存者上限*民心/100」。
   * 口径：
   *   · 基准 = GAME.maxPopOf（居所 + 专精，一个来源）；
   *   · 实际 = round(基准 × 民心% ÷ 100)（民心走唯一出口 GAME.heartsOf）；
   *   · **只封增长、不削存量**（与资源"超上限停止增长"同规）：民心下滑时幸存者停在原地。
   * 消费面（v89.185 全量）：幸存者增长爬升目标（tickOnce）· 增速基数（popGrowthOf）·
   *   城栏与统计面板显示 · 迁入令封顶 · 任务"幸存者上限"指标。
   * 不改消费面（刻意）：税收基数（已含 hearts/100 因子，别双层打折）· 劳作占用（建筑规模口径）。
   * ============================================================ */
  GAME.effPopCapOf = function (city) {
    var base = GAME.maxPopOf(city);
    var h = GAME.heartsOf ? GAME.heartsOf() : 100;
    return Math.round(base * Math.max(0, Math.min(100, h)) / 100);
  };

  /* v89.89（E3 · 100+ 轮实玩期待）：幸存者增势**唯一出口** ——
     此前公式内联在 tickOnce 里，UI 想显示就得重算一遍（本项目最经典的失效模式）。
     现在两处同源。v89.126（老板）：单位改为**人 / 现实小时**（补满 ≈ 2 小时），
     与资源产量的"游戏小时"**不是同一把尺子** —— 见 DATA.POP_CFG。 */
  GAME.popGrowthOf = function (city) {
    /* v89.99（老板「开发增加幸存者增长的其他路径」）：增速吃**三条杠杆** ——
       ② 守将治理（安置流民）· ③ 招揽令（游商道具）· ④ 税制（轻徭薄赋）；
       基数 = 居所上限（v89.185：已折算民心的**有效上限**）。分解走 GAME.popSourcesOf（界面悬停可见，不搞黑箱）。 */
    var cfg = DATA.POP_CFG || {};
    /* v89.126：增速 = 上限 ÷ fillHours（**现实小时**）—— 固定时间速率，补满时长恒定
       （旧公式"上限 × 0.05%/游戏时 + 保底 1"已退役：前期保底 1/时 补满要几百小时）。 */
    /* v89.185（老板 6）：「实际幸存者上限=幸存者上限*民心/100」——
       增速基数改走**有效上限**（民心折算）："2 小时补满"补到的是实际能到的上限。 */
    var base = GAME.effPopCapOf(city) / Math.max(0.1, cfg.fillHours == null ? 2 : cfg.fillHours);
    return base * (1 + GAME.popGovBonus(city)) * GAME.popBoostMult() * GAME.popTaxMul();
  };
  /* ② 守将治理 → 幸存者增速（本城守将；封顶见 DATA.POP_CFG.govCap） */
  GAME.popGovBonus = function (city) {
    var g = GAME.guardGeneralOf(city);
    if (!g) return 0;
    var cfg = DATA.POP_CFG || {};
    var a = GAME.genAttrs(g);
    return Math.min(cfg.govCap == null ? 0.5 : cfg.govCap,
      (a.nz || 0) * (cfg.govPerNz == null ? 0.0005 : cfg.govPerNz));
  };
  /* ③ 招揽令 → 增速乘数（1 + eff；**每次读 until** —— 到期自动失效，
     绝不重蹈"写进去没人读"的死字段覆辙） */
  GAME.popBoostMult = function () {
    var s = GAME.state;
    var b = s && s.buffs && s.buffs.popBoost;
    if (!b || !(b.until > U.now())) return 1;
    return 1 + (b.mult || 0);
  };
  /* ④ 税制 → 增速乘数（轻徭薄赋 / 横征暴敛；夹在 [floor, ceil]） */
  GAME.popTaxMul = function () {
    var s = GAME.state;
    var cfg = DATA.POP_CFG || {};
    var tax = (s && s.tax != null) ? s.tax : 0.5;
    var m = 1 + ((cfg.taxPivot == null ? 0.5 : cfg.taxPivot) - tax) * (cfg.taxCoef == null ? 0.6 : cfg.taxCoef);
    return Math.max(cfg.taxFloor == null ? 0.6 : cfg.taxFloor,
      Math.min(cfg.taxCeil == null ? 1.4 : cfg.taxCeil, m));
  };
  /* 增速来源分解（界面悬停唯一出口；也是"加成显性化"的边界） */
  GAME.popSourcesOf = function (city) {
    return [
      { name: '守将治理', v: GAME.popGovBonus(city) },
      { name: '招揽令', v: GAME.popBoostMult() - 1 },
      { name: '税制', v: GAME.popTaxMul() - 1 },
    ];
  };

  /* ============================================================
   * v89.126（老板需求 2）→ v89.189（老板 3）：**劳作占用**唯一出口组 ——
   *   除居所外的建筑按等级占用幸存者，该部分**不可征兵**。
   *   老板 v89.189 口径：「建筑占据幸存者太少了 —— 一间居所的幸存者可以照看
   *     **16 座同级资源建筑** 或 **9 座城内同级建筑**（除政务厅和围墙外）」：
   *   · 城内非居所建筑（除政务厅 / 围墙）：每座占 P_m(该级) / cityDiv(9)；
   *   · 城外资源地块：每块占 P_m(该级) / extDiv(16)；
   *   · P_m = 居所幸存者表在同等级的**单座**值（DATA.BUILDINGS.minfang.pop）。
   *   逐建筑按"它自己的等级"折算（与幸存者上限同指数 → 任何规模占比稳定，
   *   修掉 v89.126 全局式"聚落 13% / 旧都 6%"的规模漂移）。
   *   界面、守卫、探针、测试一律读 popLaborOf / popFreeOf，不许各算一份。
   *   （旧"全局 fullPct × 级数进度"两出口 popLaborLevelsOf / popLaborFullOf
   *     随口径变更一并退役 —— 不留第二算法。）
   * ============================================================ */
  GAME.popLaborOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var cfg = DATA.POP_LABOR || {};
    var table = (DATA.BUILDINGS.minfang || {}).pop || [];
    function lvlPop189(lv) {
      var i = Math.max(0, Math.min(table.length - 1, (lv || 1) - 1));
      return table[i] || 0;
    }
    var sum = 0;
    (city.cells || []).forEach(function (cl) {
      if (!cl.build) return;
      var bid = cl.build.id;
      if (bid === 'minfang' || bid === 'guanfu') return;   /* 居所自身 / 政务厅不占（老板除外项） */
      sum += lvlPop189(cl.build.lvl || 1) / (cfg.cityDiv || 9);
    });
    /* 围墙**除外**（老板明示；v89.128 起它在环城槽 city.wall，不读即不占） */
    (city.extGrid || []).forEach(function (e) {
      if (!e || !e.type) return;
      sum += lvlPop189(e.lv || 1) / (cfg.extDiv || 16);
    });
    return Math.floor(sum);
  };
  /* ④ 可征幸存者（募兵的唯一幸存者口径）：幸存者 − 劳作占用（不为负） */
  GAME.popFreeOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    return Math.max(0, Math.floor(GAME.res(city).pop || 0) - GAME.popLaborOf(city));
  };
  /* ============================================================
   * v89.99（老板「设计兵种解散」）：**解散归农** —— 唯一出口
   * ------------------------------------------------------------
   * 幸存者 100% 返还（比例见 DATA.DISBAND）；军资不退。
   * 用途：① 幸存者银行——顶到上限的增长先存成步行机，要人时解散归农；
   *       ② 兵种转型——解散旧兵种、腾幸存者改募目标兵种。
   * ============================================================ */
  GAME.disbandAt = function (cityId, troopId, count) {
    var s = GAME.state;
    var city = GAME.cityById(cityId) || GAME.currentCity();
    if (!city || (s.cities || []).indexOf(city) < 0) return { ok: false, msg: '只能在自己的城池解散部队' };
    var t = DATA.TROOPS[troopId];
    if (!t) return { ok: false, msg: '未知兵种' };
    count = Math.floor(Number(count));
    if (!count || count <= 0 || !isFinite(count)) return { ok: false, msg: '解散数量无效（请填写大于 0 的整数）' };
    city.army = city.army || {};
    var have = city.army[troopId] || 0;
    if (have <= 0) return { ok: false, msg: '本城没有' + t.name + '可解散' };
    var n = Math.min(have, count);
    city.army[troopId] = have - n;
    if (city.army[troopId] <= 0) delete city.army[troopId];
    var cfg = DATA.DISBAND || {};
    var back = Math.floor(n * (t.pop || 0) * (cfg.popReturn == null ? 1 : cfg.popReturn));
    var Rr = GAME.res(city);
    Rr.pop = (Rr.pop || 0) + back;
    GAME.log.war('🕊 ' + city.name + '：解散 ' + t.name + ' ×' + U.fmt(n) + '，归农 +' + U.fmt(back) + ' 人（军资不退）');
    return { ok: true, msg: '解散 ' + t.name + ' ×' + U.fmt(n) + '　归农 +' + U.fmt(back) + ' 幸存者', n: n, pop: back };
  };

  /* --------- 城内建筑统计 --------- */
  GAME.numBuilding = function (city, bid) {
    var n = 0;
    city.cells.forEach(function (c) { if (c.build && c.build.id === bid) n++; });
    return n;
  };
  /* 同类建筑等级**求和**（v19：货仓等多建建筑用；buildingLevel 只取最高级） */
  GAME.buildingLevelSum = function (city, bid) {
    if (!city) return 0;
    var n = 0;
    (city.cells || []).forEach(function (c) { if (c.build && c.build.id === bid) n += (c.build.lvl || 0); });
    return n;
  };

  GAME.buildingLevel = function (city, bid) {
    if (!city) return 0;
    var l = 0;
    (city.cells || []).forEach(function (c) { if (c && c.build && c.build.id === bid && c.build.lvl > l) l = c.build.lvl; });
    /* v89.128：围墙回环城槽（不占格）——等级从槽里读；NPC 影子仍在计划 cells 里，
       两个形状都认（读口合一），写口只有 `wallSlotOf` 一个。 */
    if (bid === 'chengqiang' && city.wall && city.wall.build && (city.wall.build.lvl || 0) > l) l = city.wall.build.lvl;
    return l;
  };
  /* ============================================================
   * v89.128（老板「围墙以**环城一圈的围墙结构**作为一个建筑（地位与城内建筑同），
   *   而不是占据城内一个地块」）——围墙回**环城槽**：
   * ------------------------------------------------------------
   * · 数据形状 `city.wall = { build: {id:'chengqiang', lvl}, pending }`（与 cell 同形）
   *   —— 不占 48 格中的任何一格；`cellOf` 是**槽的唯一访问器**
   *   （数字 → cells[key]；`'wall'` → city.wall），建造/升级/拆除/队列一律走它。
   * · NPC 影子的围墙仍在计划 cells 里（攻占转正时提取到槽）——`buildingLevel`
   *   两个形状都认（读口合一，写口唯一）。
   * · 旧 `wallCellIdxOf`（v89.126 占格时代的"找格"出口）**退役**。
   * ============================================================ */
  /* v89.128：槽位键的**归一出口** —— 'wall' 原样；其余一律 Number。
     （UI 的 dataset 值恒为字符串，队列里存的是数字 —— 比较与入参都走这里，
      不许散落各处的 Number()/===，那正是"某些入口静默失效"的来源。） */
  GAME.slotKey = function (v) {
    return (v === 'wall') ? 'wall' : Number(v);
  };
  /* 槽位相等：'wall' 或数字（含字符串数字形态）之间安全比较 */
  GAME.slotEq = function (a, b) {
    return a === b || String(a) === String(b);
  };
  GAME.cellOf = function (city, key) {
    if (!city) return null;
    if (key === 'wall') return city.wall || null;
    return (city.cells || [])[key];
  };
  GAME.wallSlotOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return null;
    if (!city.wall) city.wall = { build: null, pending: null };
    return city.wall;
  };
  /* v89.126：**城防技术**（citydef，−5%/级，封顶 −60%）对**围墙造价**的折扣 ——
     围墙并入通用路径后，折扣在这里挂一次（buildAt / upgradeAt 读它）；
     顺带修掉一处历史不一致：旧实现里「修建」打折、「升级」不打折，现在两头都打。 */
  GAME.cityDefCostOf = function (bid, cost, city) {
    if (bid !== 'chengqiang' || !cost) return cost;
    var disc = Math.min(0.6, techB('citydef', city));
    if (!(disc > 0)) return cost;
    var out = {};
    for (var k in cost) out[k] = (k === 'time') ? cost[k] : Math.round((cost[k] || 0) * (1 - disc));
    return out;
  };
  /* v89.126：`wallCost` / `buildWall` 退役 —— 围墙占格后走通用出口
     （buildAt / levelCost / payCost / checkBuildSlot，与其它建筑一字不差）。 */
  /* ============================================================
   * 建筑等级上限（v54 · 老板）
   * ------------------------------------------------------------
   * 基准 12（DATA.MAX_BLEVEL），**名城**另有加成：
   * 聚落 +2 / 重镇 +4 / 首府 +8 / 旧都 +12；自建城不加成。
   * **这是"一级建筑能盖到几级"的唯一出口** ——
   * 升级守卫、围墙、城外建筑、自动建造、UI 的升级按钮全部读它。
   * （不这样收口，就会出现"域层允许升到 24、UI 却在 12 级就把按钮撤掉"这种
   *  静默不一致 —— 城外建筑在 v28 就正好踩过一次：域层给到 12，UI 写死 10。）
   * ⚠️ 建筑专精（DATA.MASTERY）的门槛**仍是基准 12**，不跟着名城上限走：
   * 否则已到手的专精会因为上限提高而凭空消失。
   * ============================================================ */
  GAME.cityBuildBonus = function (city) {
    if (!city) return 0;
    var t = DATA.CITY_BUILD_BONUS || {};
    var v = t[city.type];
    return v || 0;
  };
  /* ============================================================
   * v89.191（老板 3-①②）：**配对建筑**的等级差上限（相差 ≤ DATA.PAIR_GAP_MAX）。
   * 口径 = "只能追、不能甩"：升级目标 next 不得 > 对方现等级 + gapMax（单向上限 → 无死锁，
   * 老档的大差距由落后一方自然追平）。界面（上限/提示）与内核（upgradeAt/buildAt 真拦）同读。
   * ============================================================ */
  GAME.pairGapOf = function (city, bid) {
    var other = (DATA.PAIR_GAP || {})[bid];
    if (!other || !city) return null;
    var gapMax = DATA.PAIR_GAP_MAX || 2;
    var otherLv = GAME.buildingLevel(city, other);
    return {
      bid: other, name: (DATA.BUILDINGS[other] || {}).name || other,
      otherLv: otherLv, gapMax: gapMax, cap: otherLv + gapMax,
    };
  };
  /* ============================================================
   * v89.191（老板 3-③）：**建筑升级 × 研习所科技**（研究等级不达标无法建筑）。
   * 需要等级 `floor(next / div)`（div=3 → 升到 3/4/5 级需 Lv1、6~8 需 Lv2、9~12 需 Lv3/4）。
   * 科技取**本城**（各城科技独立生效）。cap = (lv+1)×div − 1（由 need 公式反推，唯一来源）。
   * ============================================================ */
  GAME.buildTechOf = function (city, bid) {
    var r = (DATA.BUILD_TECH_REQ || {})[bid];
    if (!r || !city) return null;
    var lv = (GAME.systems && GAME.systems.techLevel) ? GAME.systems.techLevel(r.tech, city) : 0;
    var name = r.tech;
    (DATA.TECH || []).forEach(function (t) { if (t.id === r.tech) name = t.name; });
    var div = r.div || 3;
    return { tech: r.tech, name: name, lv: lv, div: div, cap: (lv + 1) * div - 1 };
  };

  /* v89.220（老板 3）：**不含科技闸**的核心上限（其余各闸取 min）—— 独立成唯一出口：
     · buildCapOf 在它之上叠科技闸（带存量宽限）；
     · buildPrereqOf 的"到不了不报"守卫也读它（科技闸只对"真能到达的目标"上报）。 */
  GAME.buildCapCoreOf = function (city, bid) {
    var b = bid ? (DATA.BUILDINGS[bid] || DATA.EXT_BUILDINGS[bid] || null) : null;
    var base = (b && b.maxLevel) || DATA.MAX_BLEVEL;
    /* v89.102（老板「主城随威望逐步解锁政务厅及其他建筑等级上限」）：
       主城多一项 —— 威望解锁的等级上限（`rankBuildCapOf`，唯一出口）。
       非主城恒为 0，所以"别城照旧被政务厅总闸卡住"这条行为一字未变。 */
    var lift = GAME.rankBuildCapOf ? GAME.rankBuildCapOf(city) : 0;
    var cap = base + GAME.cityBuildBonus(city) + lift;
    /* v68 · 逐步探索：城内建筑（含围墙）等级**不得超过政务厅等级**。
       - 政务厅自身、城外建筑、以及"没有政务厅的城"（异常数据/测试构造）不受此闸；
       - 与 DATA.BUILD_PREREQ 分工：这里管**等级上限**，那里管**建造前置**。
       v89.102：威望解锁（lift）抬的是**所有建筑的上限**（政务厅也在其中）。
       ⛔ v89.159（老板 2「关于政务厅的等级，有一条应该是其他建造等级不能超过政务厅等级吧」
         → 拍板「严格 ≤ 政务厅」）：本闸**严格 = 政务厅等级**，不再 `+ lift`。
         改前口径（其他建筑 = 政务厅 + lift）会让主城建筑**超前政务厅 N 级**，
         与这条规则相悖；威望解锁的作用改为"先抬政务厅上限、由政务厅带动
         （政务厅可升到 base + 档位 + lift，其他建筑随政务厅同步上去）"。 */
    if (bid && DATA.BUILDINGS[bid] && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      if (govLv > 0) cap = Math.min(cap, govLv);
    }
    /* v89.191（老板 3-①②）：**配对建筑**等级差 ≤ 2（与政务厅总闸同类）。
       提示文案由 buildPrereqOf 给 —— 两处同读 GAME.pairGapOf。 */
    var _pg191 = GAME.pairGapOf(city, bid);
    if (_pg191) cap = Math.min(cap, _pg191.cap);
    return cap;
  };
  GAME.buildCapOf = function (city, bid, piece) {
    var cap = GAME.buildCapCoreOf(city, bid);
    /* v89.191（老板 3-③）：建筑↔科技 —— 研究等级决定建筑上限（cap 由 need 公式反推）。
       ⛔ v89.220（老板 3）：**存量宽限**（`piece` = 本座建筑对象，可选）——
       科技闸上限不低于"本座曾达等级"（`piece.hiLv`，缺省回退现等级）：
       占领城 / 老档的满配建筑（12~24 级、本城科技 0）不会因科技从零被压到 2~3 级，
       也不会"拆 1 级就永久回不去"（恢复到曾达等级免闸，见 buildPrereqOf 同款守卫）。
       ⚠ 不传 piece = 旧行为（cap = 科技闸原值）—— 旧调用点与测试零破坏。 */
    var _bt191 = GAME.buildTechOf(city, bid);
    if (_bt191) {
      var _hi220 = piece ? Math.max(piece.hiLv || 0, piece.lvl || 0) : 0;
      cap = Math.min(cap, Math.max(_bt191.cap, _hi220));
    }
    return cap;
  };

  /* 建造前置的唯一出口（v68 · 逐步探索）：
       · 特殊前置：DATA.BUILD_PREREQ（先 X 后 Y）
       · 政务厅总闸：只有当"升政务厅真能解锁"时才报政务厅（政务厅自身到顶则交给等级硬顶去报）
     返回 { ok, list, short, msg } —— short 供卡片角标，msg 供提示条。 */
  GAME.buildPrereqOf = function (city, bid, nextLv, piece) {
    var list = [];
    if (!city || !bid) return { ok: true, list: list };
    var req = DATA.BUILD_PREREQ && DATA.BUILD_PREREQ[bid];
    if (req) {
      for (var k in req) {
        var cur = GAME.buildingLevel(city, k);
        if (cur < req[k]) list.push({ bid: k, name: (DATA.BUILDINGS[k] || {}).name || k, need: req[k], cur: cur });
      }
    }
    /* v89.224（老板 6）：**初始建造前置**（只查「新建」，不拦升级）——
       升级链由下一条 BUILD_UP_DEPS 逐级挂钩；判定同一把尺。 */
    var _rqInit224 = DATA.BUILD_PREREQ_INIT && DATA.BUILD_PREREQ_INIT[bid];
    if (_rqInit224 && (nextLv || 1) <= 1) {
      for (var k2 in _rqInit224) {
        var cur2 = GAME.buildingLevel(city, k2);
        if (cur2 < _rqInit224[k2]) list.push({ bid: k2, name: (DATA.BUILDINGS[k2] || {}).name || k2, need: _rqInit224[k2], cur: cur2 });
      }
    }
    /* v89.224（老板 6）：**升级依赖** —— 本建筑升到 N 级，依赖建筑不得低于 N − gap。
       与 v89.191 配对闸同思路（只能追、不能甩 → 天然无死锁，链条收敛于居所）；
       全表见 DATA.BUILD_UP_DEPS。hiLv 宽限：本座曾达等级 ≥ 目标时免闸（老档不倒退封死）。 */
    var _upd224 = DATA.BUILD_UP_DEPS && DATA.BUILD_UP_DEPS[bid];
    if (_upd224) {
      var _nx224 = nextLv || (GAME.buildingLevel(city, bid) + 1);
      var _need224 = _nx224 - (_upd224.gap || 2);
      var _hi224 = piece ? Math.max(piece.hiLv || 0, piece.lvl || 0) : 0;
      if (_need224 > 0 && _hi224 < _nx224) {
        var _curU224 = GAME.buildingLevel(city, _upd224.dep);
        if (_curU224 < _need224) {
          var _depNm224 = (DATA.BUILDINGS[_upd224.dep] || {}).name || _upd224.dep;
          list.push({ bid: _upd224.dep, name: _depNm224, need: _need224, cur: _curU224, upGate: true,
            why: '「' + ((DATA.BUILDINGS[bid] || {}).name || bid) + '」要升到 Lv' + _nx224
              + '，需先把「' + _depNm224 + '」升到 Lv' + _need224 + '（当前 Lv' + _curU224 + '）' });
        }
      }
    }
    var b = DATA.BUILDINGS[bid];
    if (b && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      /* v89.102：政务厅的"自己的顶"与总闸一起**随威望抬升**（主城专属，别城为 0）——
         否则主城会出现"上限已解锁、提示却仍要你把政务厅升到 45 级"的自相矛盾。 */
      var lift = GAME.rankBuildCapOf ? GAME.rankBuildCapOf(city) : 0;
      var govCap = (DATA.BUILDINGS.guanfu.maxLevel || DATA.MAX_BLEVEL)
        + GAME.cityBuildBonus(city) + lift;
      /* nextLv：本次动作要到达的等级。
         新建（buildAt）显式传 1 —— 可多建建筑（货仓/居所…）已有等级时，
         不能用 buildingLevel+1，否则"新建第二座"会被当成"升到 N+1"误拦。
         ⛔ v89.159（老板 2 的真 bug）：**升级必须传"本座的目标等级"** ——
         不传时 `buildingLevel` 取的是全城**最高**一座（居所/训练营/货仓可多建），
         于是"另一座已 Lv4、本座 Lv3"时被按 4→5 的门槛拦下（报「需政务厅 Lv5」）。 */
      var next = nextLv || (GAME.buildingLevel(city, bid) + 1);
      /* v89.159（老板 2 拍板「严格 ≤ 政务厅」）：要升到 next 级，政务厅必须 ≥ next。
         · 政务厅已到自己的顶（govLv ≥ govCap，下一句 next ≤ govCap 自动排除）；
         · next 超出政务厅可达上限（永远到不了）时**不报此闸** ——
           交给等级硬顶去报「已达最高等级」，报一个到不了的数字是误导。 */
      if (govLv > 0 && next > govLv && next <= govCap) {
        list.push({ bid: 'guanfu', name: '政务厅', need: next, cur: govLv, gate: true });
      }
    }
    /* v89.157（老板 3）：**围墙等级不能低于政务厅超过 2 级** ——
       升政务厅到 L（= next）要求围墙 ≥ L − 2（例：政务厅 3→4 需围墙 ≥ 2）。
       判据落在本函数 = 界面提示与内核拦截**同一把尺**（ui 读 pre.short / prereqText，
       upgradeAt 真拦），不另立第二出口。 */
    if (bid === 'guanfu') {
      var wl157 = GAME.buildingLevel(city, 'chengqiang');
      var nx157 = nextLv || (GAME.buildingLevel(city, 'guanfu') + 1);
      if (wl157 < nx157 - 2) {
        list.push({ bid: 'chengqiang', name: '围墙', need: nx157 - 2, cur: wl157, wallGate: true });
      }
    }
    /* v89.191（老板 3-①②）：**配对建筑**等级差 ≤ 2 —— 升级目标不得甩开对方 2 级以上
       （围墙↔机工坊 · 补给站↔车库；只能追、不能甩，老档大差距由落后一方自然收敛）。 */
    var _pgp191 = GAME.pairGapOf(city, bid);
    if (_pgp191) {
      var _nxp191 = nextLv || (GAME.buildingLevel(city, bid) + 1);
      if (_nxp191 > _pgp191.cap) {
        list.push({ bid: _pgp191.bid, name: _pgp191.name, need: _nxp191 - _pgp191.gapMax,
          cur: _pgp191.otherLv, pairGate: true,
          why: '「' + ((DATA.BUILDINGS[bid] || {}).name || bid) + '」与「' + _pgp191.name
            + '」等级相差不得超过 ' + _pgp191.gapMax + ' 级 —— 需先把' + _pgp191.name + '升到 Lv'
            + (_nxp191 - _pgp191.gapMax) + '（当前 Lv' + _pgp191.otherLv + '）' });
      }
    }
    /* v89.191（老板 3-③）：**研究等级不达标无法建筑** —— 升级目标要求本城对应科技等级
       `floor(next / div)`（本城科技口径：各城科技独立生效；表见 DATA.BUILD_TECH_REQ）。 */
    var _btp191 = GAME.buildTechOf(city, bid);
    if (_btp191) {
      var _nxt191 = nextLv || (GAME.buildingLevel(city, bid) + 1);
      /* ⛔ v89.220（老板 3）两条守卫（`piece` = 本座建筑对象，可选；不传 = 旧行为）——
         ① **存量宽限**：恢复到"本座曾达等级"（piece.hiLv）不视为新建筑 → 免科技闸
            （占领城 / 老档拆 1 级后可升回原级；**继续突破**仍需研究，突破线在 hiLv 之上）；
         ② **到不了不报**：next 超出（不含科技闸的）核心上限时不报此闸 ——
            交给"已达最高等级"（研究完也升不了的目标，不再给"需先研究 XX"的空头支票）。 */
      var _hi220 = piece ? Math.max(piece.hiLv || 0, piece.lvl || 0) : 0;
      if (_nxt191 > _hi220 && _nxt191 <= GAME.buildCapCoreOf(city, bid)) {
        var _need191 = Math.floor(_nxt191 / _btp191.div);
        if (_btp191.lv < _need191) {
          list.push({ bid: bid, name: _btp191.name, need: _need191, cur: _btp191.lv, techGate: true,
            why: '需先研究「' + _btp191.name + '」至 Lv' + _need191 + '（本城现 Lv' + _btp191.lv
              + '）—— 建筑升级与研习所科技互为条件' });
        }
      }
    }
    if (!list.length) return { ok: true, list: list };
    /* v89.191：新闸门（配对/科技）自带 why 文案 —— 比"名字 需 LvN（当前 LvM）"说得清。 */
    var parts = list.map(function (o) {
      return o.why || (o.name + ' 需 Lv' + o.need + '（当前 Lv' + o.cur + '）');
    });
    var f = list[0];
    var _short191 = f.techGate ? ('需研究' + f.name + ' Lv' + f.need) : ('需' + f.name + ' Lv' + f.need);
    return { ok: false, list: list, short: _short191, msg: '前置未满足：' + parts.join('；') };
  };

  /* v89.126：`wallPendingOf` 退役 —— 围墙占格后有 `cell.pending` 可看，
     与其它建筑同一查法（v64 那条"防重复排队"此时天然成立）。 */

  /* v89.86（整改 P-04）：前置建筑"正在升级中"的查询出口 ——
     建造菜单 / 升级按钮只写「需政务厅 Lv2」会像永久锁（老板实测误判）；
     查到这个就能改写成「政务厅升级中（剩余 X），完成后可建」。
     与 wallPendingOf 同一手法：建造队列是唯一事实来源。 */
  GAME.pendingUpgradeOf = function (city, bid) {
    var s = GAME.state;
    if (!city || !bid || !s || !s.queues) return null;
    var q = null;
    (s.queues.build || []).forEach(function (x) {
      if (q) return;
      if (x.cityId === city.id && x.buildId === bid && x.type === 'upgrade') q = x;
    });
    return q;
  };

  /* v89.126：`upgradeWall` 退役 —— 通用 `upgradeAt` 接管（含珠宝提示 / 建造成本 buff）。 */

  /* --------- 建造队列限制（原版：同时最多2个，道具可增加） --------- */
  /* 建造/升级的最小现实时长（秒）：保证进度条与倒计时可见，避免高倍率下一闪而过 */
  GAME.buildMinTime = function () { return 5 * GAME.timeScale(); };

  /* ============================================================
   * v89.95（A1）：**节钺** —— 唯一出口（读/赏/扣/用）
   * ------------------------------------------------------------
   * 存储：`s.jieyue`（数量）· `s.jieyueTaken = { 来源键: true }`（防重复领取，随档走）。
   * 所有赏赐都经 `jieyueClaim`（幂等）或 `jieyueGrant`（可重复，如威望）；
   * 所有消耗都经 `jieyueSpend` —— 上层不许直接改 s.jieyue。
   * ============================================================ */
  GAME.jieyueCfg = function () { return DATA.JIEYUE || { name: '节钺', icon: '🪓', byTier: {}, rankEvery: 4, citySlotMax: 2, tianshouCost: 1 }; };
  GAME.jieyueOf = function () {
    var s0 = GAME.state;
    return Math.max(0, (s0 && s0.jieyue) || 0);
  };
  GAME.jieyueGrant = function (cnt, why) {
    var s0 = GAME.state;
    if (!s0 || !(cnt > 0)) return 0;
    s0.jieyue = Math.max(0, (s0.jieyue || 0)) + Math.round(cnt);
    GAME.log('🪓 得节钺 ×' + Math.round(cnt) + '（' + (why || '赏赐') + '）· 现有 ' + s0.jieyue);
    return Math.round(cnt);
  };
  /* 幂等赏赐：同一来源键只给一次（首占某城 / 某次首通） */
  GAME.jieyueClaim = function (key, cnt, why) {
    var s0 = GAME.state;
    if (!s0 || !key || !(cnt > 0)) return 0;
    s0.jieyueTaken = s0.jieyueTaken || {};
    if (s0.jieyueTaken[key]) return 0;
    s0.jieyueTaken[key] = 1;
    return GAME.jieyueGrant(cnt, why);
  };
  GAME.jieyueSpend = function (cnt, why) {
    var s0 = GAME.state, need = Math.max(0, Math.round(cnt || 0));
    if (!s0) return { ok: false, msg: '无存档' };
    if (need <= 0) return { ok: true, msg: '' };
    if (GAME.jieyueOf() < need) {
      return { ok: false, msg: '节钺不足（需 ' + need + ' 枚，现有 ' + GAME.jieyueOf() + '）—— 节钺只能靠攻占名城与威望赏赐获得' };
    }
    s0.jieyue -= need;
    GAME.log('🪓 用节钺 ×' + need + '（' + (why || '') + '）· 余 ' + s0.jieyue);
    return { ok: true, msg: '用节钺 ×' + need };
  };
  GAME.jieyueTextOf = function () {
    return (GAME.jieyueCfg().icon || '🪓') + ' 节钺 ×' + GAME.jieyueOf();
  };
  /* ============================================================
   * v89.132（老板「节钺设计再开拓一下」）：**扩编族** —— 三种「编制 +1」共用一套口径。
   * ------------------------------------------------------------
   *   · 城建扩编（city）：建造位 +1（每城至多 citySlotMax）—— v89.95 既有；
   *   · 练兵场扩编（xc）  ：出征容量 +1 万人马（等效练兵场 +1 级；**只加容量口径**，
   *     募兵名额 / 练兵收益仍由建筑等级决定，不随之膨胀）—— v89.132 新增；
   *   · 招贤纳士（gen） ：本城英雄席位 +1（进 genSlotsOf 唯一出口）—— v89.132 新增。
   * 判据、消耗、进度（used/max）全走 jieyueExpandOf；界面只读它，不许各算一份。
   * 前置：xc 须有练兵场、gen 须有招募站（没建筑就谈不上"扩编"）。
   * ============================================================ */
  GAME.JIEYUE_KIND = {
    city: { field: 'jieyueSlots', max: 'citySlotMax', label: '城建扩编' },
    xc:   { field: 'jieyueXc',    max: 'xcMax',       label: '练兵场扩编' },
    gen:  { field: 'jieyueGen',   max: 'genMax',      label: '招贤纳士' }
  };
  GAME.jieyueExpandOf = function (city, kind) {
    var C = GAME.jieyueCfg();
    var K = GAME.JIEYUE_KIND[kind];
    if (!city || !K) return { ok: false, used: 0, max: 0, msg: '参数无效' };
    var max = C[K.max] || 2;
    var used = city[K.field] || 0;
    if (kind === 'xc' && !(GAME.buildingLevel(city, 'xiaochang') > 0)) {
      return { ok: false, used: used, max: max, msg: '本城尚无练兵场 —— 先建练兵场，再谈扩编' };
    }
    if (kind === 'gen' && !(GAME.buildingLevel(city, 'zhaoxianguan') > 0)) {
      return { ok: false, used: used, max: max, msg: '本城尚无招募站 —— 先建招募站，再谈纳士' };
    }
    if (used >= max) {
      return { ok: false, used: used, max: max,
        msg: city.name + ' 已扩编 ' + used + ' 次（每城上限 ' + max + ' 次）' };
    }
    if (GAME.jieyueOf() < 1) {
      return { ok: false, used: used, max: max,
        msg: '节钺不足（需 1 枚）—— 节钺只能靠攻占名城与威望赏赐获得' };
    }
    return { ok: true, used: used, max: max };
  };
  GAME.jieyueExpand = function (kind, cityId) {
    var c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var K = GAME.JIEYUE_KIND[kind];
    var chk = GAME.jieyueExpandOf(c, kind);
    if (!chk.ok) return chk;
    var sp = GAME.jieyueSpend(1, K.label + ' · ' + c.name);
    if (!sp.ok) return sp;                       /* 与前面判据同源，正常不会走到 */
    c[K.field] = (c[K.field] || 0) + 1;
    var msg = {
      city: c.name + ' 扩编成功：建造位 +1（现 ' + GAME.buildSlots(c) + ' 格，已用节钺 '
        + c[K.field] + '/' + chk.max + '）',
      xc: c.name + ' 练兵场扩编：出征容量 +1 万人马（现 ' + U.fmt(GAME.battle.marchCapOf(c))
        + '，已用节钺 ' + c[K.field] + '/' + chk.max + '）',
      gen: c.name + ' 招贤纳士：英雄席位 +1（现 ' + GAME.genSlotsOf(c) + ' 席，已用节钺 '
        + c[K.field] + '/' + chk.max + '）'
    }[kind];
    GAME.log('🪓 ' + msg);
    return { ok: true, used: c[K.field], max: chk.max, msg: msg };
  };

  GAME.buildSlots = function (city) {
    var s = GAME.state;
    /* v28：政务厅建筑专精 —— 同时建造 +1 队（全境口径：任一城政务厅满级即可）
       v60（需求 5）：**名城档位优势**再 +buildSlot（旧都 +1、首府 +1）——
       这是 perks 里"同时建造"那项的落地点（不加这句它就是死属性）。 */
    city = city || GAME.currentCity();
    /* v89.93（整改 E8）：**基础建造位 2 → 3** —— 种田玩家的第一爽点是
       "规划 → 落成"，2 格队列把爽感切成等待（实测 225 年队列从未空过）。
       其余加成（专精 / 威望 / 名城档位 / 征调令）照旧叠加。 */
    var base = 3 + GAME.mastery('buildSlot', null) + GAME.cityBonusNum(city, 'buildSlot')   /* v79：+ 威望建造位 */
      + (city.jieyueSlots || 0);   /* v89.95（A1）：节钺扩编（每城至多 +2） */
    if (s && s.buffs && s.buffs.buildQueue && s.buffs.buildQueue.until > U.now()) {
      base += (s.buffs.buildQueue.add || 0);   // 征调令 +3
    }
    return base;
  };
  GAME.buildQueueUsed = function (cityId) {
    var s = GAME.state, n = 0;
    (s.queues.build || []).forEach(function (q) { if (!cityId || q.cityId === cityId) n++; });
    return n;
  };
  GAME.checkBuildSlot = function (cityId) {
    /* v60：队列位按**该城**算（名城 perk 的 buildSlot 是城属性） */
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var used = GAME.buildQueueUsed(cityId), cap = GAME.buildSlots(city);
    if (used >= cap) return { ok: false, msg: '同时只能建造/升级 ' + cap + ' 个建筑（征调令可增加队列）' };
    return { ok: true };
  };

  /* --------- 取消建造（原版：按剩余时间比例返还部分资源） --------- */
  /* v89.110：「取消退还多少」抽成**唯一出口** —— 确认弹窗（先看退多少）与真执行共用，
     避免出现"面板报一个数、执行按另一个数"（本项目最经典的两出口病）。 */
  GAME.cancelRefundOf = function (kind, idx, cityId) {
    var s = GAME.state;
    var cur = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var qi = -1, q = null;
    for (var i = 0; i < s.queues.build.length; i++) {
      var x = s.queues.build[i];
      /* 外城地块已按城池独立，同一下标在多城间会重复，必须同时匹配 cityId */
      var hit = kind === 'city'
          ? (GAME.slotEq(x.gridIndex, idx) && (x.type === 'build' || x.type === 'upgrade') && (!cur || !x.cityId || x.cityId === cur.id))
          : (x.extIdx === idx && (x.type === 'ext_build' || x.type === 'ext_upgrade') && (!cur || !x.cityId || x.cityId === cur.id));
      if (hit) { qi = i; q = x; break; }
    }
    if (!q) return { ok: false, msg: '没有进行中的建造' };
    /* 反查成本 —— v89.179c（老板②「价值价格体系」）：**改按"实付"退款，不再按原价反查**。
       旧写法从数据表反查原价，而城内建造是**按折扣价付款**的 →
       开「建造成本-50%」buff 后"建造→立即取消"可拿回 80% 原价、净赚 30% 资源（资源泵）。
       新队列在付款时记录 `paidCost`（同一笔账）；旧档队列没这个字段 → 回落原价反查（同旧行为）。
       ⚠️ `paidCost` = `GAME.resOnlyOf(cost)`（只含资源键，不含 time）。 */
    var cost = null;
    if (q.paidCost) cost = q.paidCost;
    else if (q.type === 'build') cost = DATA.BUILDINGS[q.buildId].buildCost;
    else if (q.type === 'upgrade') cost = DATA.BUILDINGS[q.buildId].levelCost(q.targetLevel - 1);
    else if (q.type === 'ext_build') cost = GAME.extBuildCost(q.buildId, 0);
    else if (q.type === 'ext_upgrade') cost = GAME.extBuildCost(q.buildId, q.targetLevel - 1);
    /* 按剩余时间比例返还 80% */
    var remainRatio = Math.max(0, 1 - q.elapsed / q.totalTime);
    var refund = {}, total = 0;
    if (cost) {
      for (var k in cost) {
        if (k === 'time') continue;
        refund[k] = Math.floor(cost[k] * remainRatio * 0.8);
        total += refund[k];
      }
    }
    return { ok: true, qi: qi, q: q, remainRatio: remainRatio, refund: refund, total: total };
  };
  GAME.cancelBuild = function (kind, idx, cityId) {
    var s = GAME.state;
    var info = GAME.cancelRefundOf(kind, idx, cityId);
    if (!info.ok) return info;
    var q = info.q, qi = info.qi, refund = info.refund, total = info.total;
    /* v89.161（老板 5）：返还进**队列项所属城** —— 改前用当前城，
       在甲城取消乙城的工程会把材料还到甲城（跨城挪用）。金进玩家唯一池。 */
    var _rd161 = GAME.cityById(q.cityId) || GAME.currentCity();
    var _RR161 = GAME.res(_rd161);
    for (var k2 in refund) {
      if (k2 === 'gold') { GAME.goldAdd(refund[k2]); continue; }
      _RR161[k2] = (_RR161[k2] || 0) + refund[k2];
    }
    /* 清除 pending 标记 */
    if (kind === 'city') {
      var c = GAME.cityById(q.cityId);
      var _c128 = c && GAME.cellOf(c, q.gridIndex);   /* v89.128：'wall' 槽同样生效 */
      if (_c128) _c128.pending = null;
    } else {
      var qc = GAME.cityById(q.cityId);
      var qg = qc ? GAME.extGridOf(qc) : [];
      if (qg[q.extIdx]) qg[q.extIdx].pending = null;
    }
    s.queues.build.splice(qi, 1);
    GAME.log('取消建造，返还部分资源（' + Math.round(info.remainRatio * 80) + '%）');
    return { ok: true, msg: '已取消建造，返还 ' + U.fmt(total) + ' 资源' };
  };

  /* --------- 城外资源建筑（地块制 · v14 改为**按城池独立**） ---------
   * 此前 state.extGrid 是全局单份，导致多占城池不增加资源地块，攻城只剩税收。
   * 现在每城各有一份外城网格，上限 = 12 + (本城政务厅等级-1)×3。
   * 统一入口 GAME.extGridOf(city)，不要再直接读 state.extGrid。
   * ------------------------------------------------------------------ */
  GAME.extGridOf = function (city) {
    var s = GAME.state;
    if (!city) city = GAME.currentCity() || (s && s.cities && s.cities[0]);
    if (!city) return [];
    if (!city.extGrid) city.extGrid = [];
    return city.extGrid;
  };
  GAME.extCap = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;
    /* v24（需求 7）：按政务厅等级查表。
       v89.142（老板 1）：上限定稿 **12×8 = 96**（老板实机比对：「12*8 似乎好看一点」）——
       表在 DATA.EXT_CAP_MAX(96) 平顶（约政务厅 Lv24 到顶），此后政务厅再升不加地。 */
    var t = DATA.EXT_CAP_BY_LV || [];
    var n = t[Math.max(0, Math.min(lv - 1, t.length - 1))];
    return n != null ? n : Math.min(DATA.EXT_CAP_MAX || 96, 12 + (lv - 1) * 3);
  };
  /* 保证外城地块数达到上限（政务厅升级后自动补空地）。不传 city 则针对当前城 */
  GAME.ensureExtGrid = function (city) {
    var s = GAME.state;
    if (!city) city = GAME.currentCity() || (s && s.cities && s.cities[0]);
    if (!city) return [];
    var g = GAME.extGridOf(city);
    var cap = GAME.extCap(city);
    while (g.length < cap) g.push({ id: 'e' + (g.length + 1), type: null, lv: 0 });
    return g;
  };
  /* ============================================================
   * v89.142（老板 1）：「设置新增地块的形成顺序，尽量从界面中间向周边新增，尽量有序」
   * ------------------------------------------------------------
   * **地块落位的唯一出口**（界面渲染 / 探针 / 断言都读它，不许各排一份）：
   *   返回 `[rows × cols]` 个 `{row, col}` 位置，第 k 项 = 第 k 个地块该放哪。
   * 顺序 = 以棋盘中心为起点的**同心环螺旋**：
   *   ① 先中心 2×2（12 列 × 8 行时中心恰是 2×2 —— 偶数网格，天然四格对称）；
   *   ② 再一圈一圈向外；环内按**顺时针绕行**（起点 = 右上，正上偏右 0° 起算）
   *      —— 同一环内的生成次序永远一致，视觉上是一圈圈"长出来"。
   * 也就是说：政务厅每升一级新增的地块，总是贴着已有地块从**中间向周边**长；
   * 序号（存档里的第 k 块）与视觉位置稳定绑定 —— 升级只多不长乱。
   * ============================================================ */
  /* v89.142 立（中心扩散）→ **v89.157 改（老板「地块按建议」：居中矩形块）**
     ------------------------------------------------------------
     旧序 = 切比雪夫环 + 环内顺时针角 → 12 块时是"缺了左上角的 4×4 半环"（视觉偏）。
     新序 = **居中矩形逐圈扩张**：起步 = 网格中心 2×2（12×8 的中心 = 行 3~4 / 列 5~6），
     之后按「右列 → 下行 → 左列 → 上行」循环各补一整条边（矩形宽/高交替 +1）：
       4 → 6 → 9 → **12（= 4×3 居中矩形，政务厅 Lv1 首档）** → 16 → 20 → 25 → 30 → 36 →
       42 → 49 → 56 → 64 → 72 → 80 → 88 → 96（= 12×8 满）。
     政务厅逐级解锁数（12/15/18/…）都落在"整矩形"或"矩形 + 一条边的一部分"上，
     且矩形尺寸单调不减（暗格永远在外圈）。补边时**从边中点向两端**展开 ——
     部分解锁时左右/上下对称，不会"只长一半、偏在一边"。 */
  GAME.extSlotOrder = function () {
    var cols = DATA.EXT_COLS || 12, rows = DATA.EXT_ROWS || 8;
    var rr0 = Math.floor((rows - 1) / 2), cc0 = Math.floor((cols - 1) / 2);
    var rr1 = rr0 + 1, cc1 = cc0 + 1;               /* 中心 2×2 */
    var out = [];
    /* 线内次序：从该边中点向两端展开（轴 = 变化的那一维；轴心 = 当前矩形中心） */
    function orderLine(cells, axis) {
      var midH = (cc0 + cc1) / 2, midV = (rr0 + rr1) / 2;
      cells.sort(function (a, b) {
        var ka = axis === 'h' ? Math.abs(a.col - midH) : Math.abs(a.row - midV);
        var kb = axis === 'h' ? Math.abs(b.col - midH) : Math.abs(b.row - midV);
        if (ka !== kb) return ka - kb;
        return axis === 'h' ? (a.col - b.col) : (a.row - b.row);
      });
      cells.forEach(function (c) { out.push({ row: c.row, col: c.col }); });
    }
    out.push({ row: rr0, col: cc0 }, { row: rr0, col: cc1 },
             { row: rr1, col: cc0 }, { row: rr1, col: cc1 });
    var guard = 0;
    while ((rr0 > 0 || rr1 < rows - 1 || cc0 > 0 || cc1 < cols - 1) && guard++ < cols * rows) {
      var cells, i;
      if (cc1 < cols - 1) {                         /* 右列 */
        cc1++; cells = [];
        for (i = rr0; i <= rr1; i++) cells.push({ row: i, col: cc1 });
        orderLine(cells, 'v');
      }
      if (rr1 < rows - 1) {                         /* 下行 */
        rr1++; cells = [];
        for (i = cc0; i <= cc1; i++) cells.push({ row: rr1, col: i });
        orderLine(cells, 'h');
      }
      if (cc0 > 0) {                                /* 左列 */
        cc0--; cells = [];
        for (i = rr0; i <= rr1; i++) cells.push({ row: i, col: cc0 });
        orderLine(cells, 'v');
      }
      if (rr0 > 0) {                                /* 上行 */
        rr0--; cells = [];
        for (i = cc0; i <= cc1; i++) cells.push({ row: rr0, col: i });
        orderLine(cells, 'h');
      }
    }
    return out;
  };

  /* 下一档解锁所需政务厅等级（0 = 已封顶 96/96）—— 暗格提示与侧栏文案共读的唯一出口 */
  GAME.extNextLvOf = function (city) {
    var cap = GAME.extCap(city);
    var t = DATA.EXT_CAP_BY_LV || [];
    for (var i = 0; i < t.length; i++) if (t[i] > cap) return i + 1;
    return 0;
  };

  /* 外城地块全境统计（多城经营展示用）：返回 { towns, used, cap, byType, maxLv } */
  GAME.extSummary = function () {
    var s = GAME.state, out = { towns: 0, used: 0, cap: 0, byType: {}, maxLv: {} };
    ((s && s.cities) || []).forEach(function (c) {
      out.towns++;
      out.cap += GAME.extCap(c);
      (c.extGrid || []).forEach(function (e) {
        if (!e || !e.type) return;
        out.used++;
        out.byType[e.type] = (out.byType[e.type] || 0) + 1;
        out.maxLv[e.type] = Math.max(out.maxLv[e.type] || 0, e.lv || 0);
      });
    });
    return out;
  };
  GAME.extCount = function (city, eid) {
    city = city || GAME.currentCity();
    var n = 0;
    GAME.extGridOf(city).forEach(function (e) { if (e.type === eid) n++; });
    return n;
  };
  GAME.extUsed = function (city) {
    city = city || GAME.currentCity();
    var n = 0;
    GAME.extGridOf(city).forEach(function (e) { if (e.type) n++; });
    return n;
  };
  GAME.extBuildCost = function (eid, lv) {
    var eb = DATA.EXT_BUILDINGS[eid];
    if (!eb) return null;
    var r = eb.cost[lv];
    /* 越界返回 null（而不是读 r[0] 抛异常）—— 等级上限提到 12 之后，
       任何一处"按 10 级算"的旧调用都会走到这里，宁可返回"无费用"也不要崩。 */
    if (!r) return null;
    /* v89.128：时间列走**曲线**（12 级循环 + 单次 ≤24h）——与城内同一出口 */
    return { grain: r[0], wood: r[1], stone: r[2], iron: r[3],
      time: DATA.buildTimeSec ? DATA.buildTimeSec(eid, lv) : r[4] };
  };
  /* 在指定外城地块建造资源建筑 */
  GAME.buildExt = function (extIdx, eid) {
    var s = GAME.state, city = GAME.currentCity();
    var eb = DATA.EXT_BUILDINGS[eid];
    if (!eb) return { ok: false, msg: '未知建筑' };
    var e = GAME.extGridOf(city)[extIdx];
    if (!e) return { ok: false, msg: '地块不存在' };
    if (e.type || e.pending) return { ok: false, msg: '该地块已占用' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = GAME.buildCostDiscountOf(GAME.extBuildCost(eid, 0));   /* v89.179c：城外也吃建造费折扣（desc 未限定城内） */
    /* v89.161：花费按**该地块所属城**结算（本函数本就只服务当前城，改的是口径显式化） */
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: GAME.costLackMsg(city, cost) || '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    e.pending = eid;
    s.queues.build.push({ cityId: city.id, extIdx: extIdx, buildId: eid, type: 'ext_build', paidCost: GAME.resOnlyOf(cost), elapsed: 0, totalTime: Math.max(cost.time * GAME.cityBuildMult(city), GAME.buildMinTime()) });
    return { ok: true, msg: '开始建造 ' + eb.name };
  };
  GAME.upgradeExt = function (extIdx, cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return { ok: false, msg: '该地块未建造建筑' };
    var eb = DATA.EXT_BUILDINGS[e.type];
    if (e.lv >= GAME.buildCapOf(city)) return { ok: false, msg: '已达最高等级' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = GAME.buildCostDiscountOf(GAME.extBuildCost(e.type, e.lv));   /* v89.179c：同上 */
    /* v89.161（老板 5）：cityId 可指向**非当前城** —— 花费必须按那座城扣
       （改前 `canAfford/payCost` 读当前城 → 跨城挪用）。 */
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: GAME.costLackMsg(city, cost) || '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    e.pending = e.type;
    s.queues.build.push({ cityId: city.id, extIdx: extIdx, buildId: e.type, type: 'ext_upgrade', targetLevel: e.lv + 1, paidCost: GAME.resOnlyOf(cost), elapsed: 0, totalTime: Math.max(cost.time * GAME.cityBuildMult(city), GAME.buildMinTime()) });
    return { ok: true, msg: '开始升级 ' + eb.name };
  };

  /* 唯一建筑（城内只能建1座，居所/训练营/货仓可多建）。围墙不占格，已移出此表。
     v19（需求 10）：货仓移出 —— 允许多建，储量按各货仓等级求和叠加。
     ⚠ 这份表**必须唯一**：ui.js 曾自行复制一份，改 domain 却漏改 ui，
     结果后端放行、前端仍把货仓标成「已建造(唯一)」并禁用按钮。
     现在统一走 GAME.UNIQUE_BUILDINGS 单一数据源。 */
  GAME.UNIQUE_BUILDINGS = { shuyuan: 1, xiaochang: 1, shichang: 1, kezhan: 1, zhaoxianguan: 1, honglusi: 1, tiejiangpu: 1, gongjiangzuofang: 1, majiu: 1, yizhan: 1, fenghuotai: 1 };
  var UNIQUE_BUILDINGS = GAME.UNIQUE_BUILDINGS;

  /* --------- 城内建造 / 升级 / 拆除 --------- */
  GAME.buildAt = function (cityId, gridIndex, buildId) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    /* v89.128：'wall' = 环城槽（围墙不占格） */
    var cell = (gridIndex === 'wall') ? GAME.wallSlotOf(city) : city.cells[gridIndex];
    if (!cell || cell.build) return { ok: false, msg: gridIndex === 'wall' ? '围墙已修建（可升级）' : '该格已被占用' };
    if (cell.official) return { ok: false, msg: '政务厅区域不可建造' };
    if (cell.pending) return { ok: false, msg: '该格正在建设中' };
    var b = DATA.BUILDINGS[buildId];
    if (!b) return { ok: false, msg: '未知建筑' };
    if (!b.buildCost) return { ok: false, msg: '该建筑不可建造（初始自带）' };
    if (UNIQUE_BUILDINGS[buildId] && GAME.buildingLevel(city, buildId) > 0) {
      return { ok: false, msg: b.name + ' 全城唯一（已建造）' };
    }
    /* v68 · 逐步探索：建造前置（先 X 后 Y）—— 与升级共用同一判定，见 buildPrereqOf */
    var pre = GAME.buildPrereqOf(city, buildId, 1);
    if (!pre.ok) return pre;
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = GAME.buildCostDiscountOf(b.buildCost);   /* v89.179c：折扣唯一出口（成本打折 · 工期不动） */
    cost = GAME.cityDefCostOf(buildId, cost, city);   /* v89.126：围墙吃城防技术折扣（v89.191：按城读） */
    /* v89.161（老板 5）：**谁的城用谁的货** —— buildAt 的 cityId 可指向非当前城 */
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: GAME.costLackMsg(city, cost) || '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    cell.pending = { buildId: buildId, targetLevel: 1 };
    var totalTime = 60; // 默认1分钟（真实建筑1级多为此量级）
    var lc = b.levelCost(0);
    if (lc && lc.time) totalTime = lc.time;
    totalTime = Math.max(totalTime * GAME.cityBuildMult(GAME.cityById(cityId)), GAME.buildMinTime());
    s.queues.build.push({ cityId: cityId, gridIndex: gridIndex, buildId: buildId, type: 'build', paidCost: GAME.resOnlyOf(cost), elapsed: 0, totalTime: totalTime });
    return { ok: true, msg: '开始建造 ' + b.name };
  };

  GAME.applyBuildCostDiscount = function (cost) {
    var s = GAME.state, out = {};
    if (s.buffs && s.buffs.buildCost) {
      for (var k in cost) out[k] = Math.round(cost[k] * (1 - s.buffs.buildCost.eff));
    } else {
      for (var k2 in cost) out[k2] = cost[k2];
    }
    return out;
  };
  /* v89.179c（老板②「价值价格体系」· 观察项④）：**建造费折扣的唯一出口**。
     ------------------------------------------------------------
     改前 `if (buffActive('buildCost')) cost = applyBuildCostDiscount(cost)` 在
     城内两处 + 围墙面板各写一遍，而**城外（buildExt / upgradeExt）与城外面板全漏** ——
     可三件道具的 desc（规划纲要 / 工匠调度令 / 标准母尺）都写"建造成本-X%"，**没有"仅城内"**：
     描述与实现不符。
     口径（本次统一）：**成本打折 · 工期不动** ——
       `applyBuildCostDiscount` 会连 `cost.time` 一起乘折扣，而"成本"是资源不是工期；
       旧写法还造成城内自相矛盾（新建读原始 `lc.time`、升级却读了打折后的 `cost.time`）。
     落地：城内/城外 × 后端/界面 全走这一个出口。 */
  GAME.buildCostDiscountOf = function (cost) {
    if (!cost) return cost;
    if (!(GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('buildCost'))) return cost;
    var out = GAME.applyBuildCostDiscount(cost);
    if (cost.time != null) out.time = cost.time;      /* 工期不打折 */
    return out;
  };
  /* 只保留资源键（记账/退款用 —— `time` 不是资源，别混进"实付"里） */
  GAME.resOnlyOf = function (cost) {
    var out = {};
    if (!cost) return out;
    for (var k in cost) { if (k === 'time') continue; out[k] = cost[k]; }
    return out;
  };

  GAME.upgradeAt = function (cityId, gridIndex) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    var cell = (gridIndex === 'wall') ? GAME.wallSlotOf(city) : city.cells[gridIndex];
    if (!cell || !cell.build) return { ok: false, msg: gridIndex === 'wall' ? '尚未修建围墙' : '空地无法升级' };
    /* v16：升级中必须有 pending 标记 —— 否则可对同一建筑重复排队，
       且点开建筑看不到「升级中」（这正是「升级中看不到进度、无法取消」的根因） */
    if (cell.pending) return { ok: false, msg: '该建筑正在施工中（可点开查看进度或取消）' };
    var b = DATA.BUILDINGS[cell.build.id];
    /* v68 · 逐步探索：前置（含政务厅总闸）优先于等级硬顶 ——
       两者都不满足时，报"升政务厅可解锁"比报"已达最高等级"更接近玩家的下一步动作。
       v89.159（老板 2）：next 传**本座**的目标等级（cell.build.lvl + 1）——
       可多建建筑各处等级不同，"全城最高级 + 1"会把低的那座误拦
       （老板实测：居所 Lv3 · 政务厅 Lv4 却报「需政务厅 Lv5」，另一座居所已 Lv4）。 */
    /* v89.220（老板 3）：传入**本座**（piece）—— 科技闸存量宽限（拆后可升回原级）与
       "到不了不报"两条守卫读它；界面（ui.js 升级按钮/成本行）同传，保证同尺。 */
    var pre = GAME.buildPrereqOf(city, cell.build.id, cell.build.lvl + 1, cell.build);
    if (!pre.ok) return pre;
    if (cell.build.lvl >= GAME.buildCapOf(city, cell.build.id, cell.build)) return { ok: false, msg: '已达最高等级' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = b.levelCost(cell.build.lvl);
    if (!cost) return { ok: false, msg: '未知费用' };
    /* v89.179c：走折扣唯一出口 —— 顺带修掉"新建不打折工期、升级却打折工期"的自相矛盾
       （旧写法 applyBuildCostDiscount 连 cost.time 一起乘，而 buildAt 读的是原始 lc.time）。 */
    cost = GAME.buildCostDiscountOf(cost);
    cost = GAME.cityDefCostOf(cell.build.id, cost, city);   /* v89.126：围墙吃城防技术折扣（v89.191：按城读） */
    /* v89.161（老板 5）：**谁的建筑用谁的城** —— upgradeAt 的 cityId 可指向非当前城
       （自动升级会遍历所有城；改前一律用当前城的货，等于跨城挪用）。 */
    if (!GAME.canAffordIn(city, cost)) {
      /* v89.104：高等级升级的拦路虎可能是**珠宝**而不是资源 —— 报清楚缺哪种。
         v89.194：珠宝/金/资源的缺料对账统一走 GAME.costLackMsg（唯一出口，
         金加入成本后"本城资源不足"会误导 —— 金是全境通用池）。 */
      return { ok: false, msg: GAME.costLackMsg(city, cost) || '本城资源不足（跨城需走「本境调运」）' };
    }
    GAME.payCostIn(city, cost);
    cell.pending = { buildId: cell.build.id, targetLevel: cell.build.lvl + 1 };
    var totalTime = Math.max(5, cost.time || cell.build.lvl * 60);
    totalTime = Math.max(totalTime * GAME.cityBuildMult(GAME.cityById(cityId)), GAME.buildMinTime());
    s.queues.build.push({ cityId: cityId, gridIndex: gridIndex, buildId: cell.build.id, type: 'upgrade', targetLevel: cell.build.lvl + 1, paidCost: GAME.resOnlyOf(cost), elapsed: 0, totalTime: totalTime });
    return { ok: true, msg: '开始升级 ' + b.name + ' → Lv' + (cell.build.lvl + 1) };
  };

  /* 建筑累计投入（用于拆毁返还评估）：1级造价 + 各级升级造价 */
  GAME.investedIn = function (b, lvl) {
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (lvl || 1); i++) {
      var c = b.levelCost(i);
      if (!c) continue;
      out.grain += c.grain || 0; out.wood += c.wood || 0;
      out.stone += c.stone || 0; out.iron += c.iron || 0;
    }
    return out;
  };
  /* 城内建筑拆毁（v76 老板：「拆除（1级，只能逐级拆除）」）——
     每次只降 1 级：返还**本步投入**（达到当前等级的那一份造价 = 累计差）的 50%；
     Lv1 时拆除 = 整座移除（返还首级投入的 50%）。 */
  GAME.demolishRefund = function (city, gridIndex) {
    var cell = city && GAME.cellOf(city, gridIndex);   /* v89.128：'wall' 槽同样生效 */
    if (!cell || !cell.build) return null;
    var b = DATA.BUILDINGS[cell.build.id];
    if (!b) return null;
    var lv = cell.build.lvl;
    var inv = GAME.investedIn(b, lv), prev = GAME.investedIn(b, Math.max(0, lv - 1));
    var step = { grain: inv.grain - prev.grain, wood: inv.wood - prev.wood,
      stone: inv.stone - prev.stone, iron: inv.iron - prev.iron };
    return GAME.scaledCost(step, DATA.DEMOLISH_RATE);
  };
  GAME.demolishAt = function (cityId, gridIndex) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) return { ok: false, msg: '城池不存在' };
    var cell = GAME.cellOf(city, gridIndex);   /* v89.128：'wall' = 环城槽 */
    if (!cell || !cell.build) return { ok: false, msg: '空地块' };
    if (cell.official) return { ok: false, msg: '政务厅不可拆除' };
    var b = DATA.BUILDINGS[cell.build.id];
    var lv = cell.build.lvl;
    /* v76（老板）：「拆除（1级，只能逐级拆除）」—— 一级一级拆：
       Lv>1 每次只降 1 级；拆到 Lv1 再拆才整座移除（腾出地块）。
       返还 = 本步投入（累计差）的 50%。 */
    var inv = GAME.investedIn(b, lv), prev = GAME.investedIn(b, Math.max(0, lv - 1));
    var step = { grain: inv.grain - prev.grain, wood: inv.wood - prev.wood,
      stone: inv.stone - prev.stone, iron: inv.iron - prev.iron };
    var back = GAME.scaledCost(step, DATA.DEMOLISH_RATE);
    GAME.refundCert(step, DATA.DEMOLISH_RATE, city);   /* v89.161：还给**这座城** */
    if (lv > 1) {
      /* v89.220（老板 3）：降级前先固化**历史最高**（老档无 hiLv 的兜底 —— 记下原级，
         拆后仍可升回；科技闸只挡"突破历史"，不挡"恢复"。 */
      cell.build.hiLv = Math.max(cell.build.hiLv || 0, lv);
      cell.build.lvl = lv - 1;
      GAME.statBump('demolished', 1);
      GAME.log('拆 ' + b.name + ' Lv' + lv + ' → Lv' + (lv - 1) + '，返还 ' + GAME.costString(back));
      return { ok: true, msg: '已拆 1 级：' + b.name + ' Lv' + lv + ' → Lv' + (lv - 1) + '，返还 ' + GAME.costString(back), back: back };
    }
    cell.build = null;
    cell.pending = null;
    /* 清掉该格的建造/升级队列项，避免队列完成后写入已拆毁的格子 */
    s.queues.build = (s.queues.build || []).filter(function (q) {
      return !(q.cityId === cityId && GAME.slotEq(q.gridIndex, gridIndex));
    });
    GAME.statBump('demolished', 1);
    GAME.log('拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back));
    return { ok: true, msg: '已拆毁 ' + b.name + ' Lv' + lv + '，返还 ' + GAME.costString(back), back: back };
  };

  /* ============================================================
   * 城内建筑移形换位（v19 · 需求 8）
   *   规则：与空地「搬过去」、与另一个建筑「互换」；等级与状态随建筑走。
   *   限制：政务厅是城池中枢（占 4 格且等级需四格同步），不可移动；
   *         任一方在施工中也不可移动 —— 否则建造队列的 gridIndex 会指向错位的格子。
   *   不收费：材料已在城中，只是重新规划地皮。
   * ============================================================ */
  GAME.moveBuilding = function (cityId, fromIdx, toIdx) {
    var s = GAME.state, city = GAME.cityById(cityId) || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if (fromIdx === toIdx) return { ok: false, msg: '起点与终点相同' };
    var a = city.cells[fromIdx], b = city.cells[toIdx];
    if (!a || !b) return { ok: false, msg: '地块不存在' };
    if (!a.build) return { ok: false, msg: '该地块没有建筑可移动' };
    if (a.official || b.official) return { ok: false, msg: '政务厅为城池中枢，不可移动' };
    if (a.pending || b.pending) return { ok: false, msg: '有建筑正在施工，暂不可移动（可先取消施工）' };
    var moved = a.build, swapped = b.build;
    a.build = swapped;
    b.build = moved;
    var n1 = DATA.BUILDINGS[moved.id] ? DATA.BUILDINGS[moved.id].name : moved.id;
    var n2 = swapped ? (DATA.BUILDINGS[swapped.id] ? DATA.BUILDINGS[swapped.id].name : swapped.id) : null;
    GAME.log(n2
      ? '🔄 ' + n1 + ' 与 ' + n2 + ' 互换位置'
      : '🔄 ' + n1 + ' 已迁至新地块');
    return { ok: true, msg: n2 ? (n1 + ' 与 ' + n2 + ' 互换位置') : (n1 + ' 已迁至新地块') };
  };

  /* ============================================================
   * 城外资源地块「改建」（v19 · 需求 8）
   *   把已建的资源建筑改成另一种类型，**等级保留**。
   *   收费 = 目标建筑「当前等级」的累计造价 × 60%（改建折扣：
   *   地基与人力已在，只需改造）。
   * ============================================================ */
  GAME.EXT_CONVERT_RATE = 0.6;
  GAME.extConvertCost = function (extIdx, newType, cityId) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return null;
    var eb = DATA.EXT_BUILDINGS[newType];
    if (!eb) return null;
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (e.lv || 1); i++) {
      var c = eb.cost[i];
      if (!c) continue;
      out.grain += c[0] || 0; out.wood += c[1] || 0; out.stone += c[2] || 0; out.iron += c[3] || 0;
    }
    for (var k in out) out[k] = Math.round(out[k] * GAME.EXT_CONVERT_RATE);
    return out;
  };
  GAME.convertExt = function (extIdx, newType, cityId) {
    var s = GAME.state, city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return { ok: false, msg: '该地块没有建筑可改建' };
    if (e.pending) return { ok: false, msg: '施工中不可改建（可先取消施工）' };
    var eb = DATA.EXT_BUILDINGS[newType];
    if (!eb) return { ok: false, msg: '未知建筑类型' };
    if (e.type === newType) return { ok: false, msg: '与当前类型相同' };
    var cost = GAME.extConvertCost(extIdx, newType, city.id);
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: '本城改建材料不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    var old = DATA.EXT_BUILDINGS[e.type];
    var oldName = old ? old.name : e.type;
    e.type = newType;
    GAME.statBump('converted', 1);
    GAME.log('🔧 城外 ' + oldName + ' 改建为 ' + eb.name + '（Lv' + e.lv + ' 保留）');
    return { ok: true, msg: oldName + ' 已改建为 ' + eb.name + '（等级保留）' };
  };

  /* 城外资源地块拆毁（返还累计投入的 50%） */
  GAME.demolishExtRefund = function (extIdx, cityId) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var e = GAME.extGridOf(city)[extIdx];
    if (!e || !e.type) return null;
    var eb = DATA.EXT_BUILDINGS[e.type];
    if (!eb) return null;
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (e.lv || 1); i++) {
      var c = eb.cost[i];
      if (!c) continue;
      out.grain += c[0] || 0; out.wood += c[1] || 0; out.stone += c[2] || 0; out.iron += c[3] || 0;
    }
    return GAME.scaledCost(out, DATA.DEMOLISH_RATE);
  };
  GAME.demolishExt = function (extIdx, cityId) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var e = GAME.extGridOf(city)[extIdx];
    if (!e) return { ok: false, msg: '地块不存在' };
    if (e.pending) return { ok: false, msg: '该地块正在施工，请先取消建造' };
    if (!e.type) return { ok: false, msg: '该地块为荒地' };
    var eb = DATA.EXT_BUILDINGS[e.type];
    var back = GAME.demolishExtRefund(extIdx, city ? city.id : null);
    var out = { grain: 0, wood: 0, stone: 0, iron: 0 };
    for (var i = 0; i < (e.lv || 1); i++) {
      var c = eb.cost[i];
      if (!c) continue;
      out.grain += c[0] || 0; out.wood += c[1] || 0; out.stone += c[2] || 0; out.iron += c[3] || 0;
    }
    GAME.refundCert(out, DATA.DEMOLISH_RATE, city);   /* v89.161：还给**这座城** */
    var lv = e.lv;
    e.type = null; e.lv = 1; e.pending = null;
    s.queues.build = (s.queues.build || []).filter(function (q) {
      if (q.extIdx !== extIdx) return true;
      if (!city) return false;
      return q.cityId && q.cityId !== city.id;   // 只清本城该地块的队列项
    });
    GAME.statBump('demolished', 1);
    GAME.log('拆毁城外 ' + eb.name + ' Lv' + lv + '，返还 ' + GAME.costString(back));
    return { ok: true, msg: '已拆毁 ' + eb.name + ' Lv' + lv + '，返还 ' + GAME.costString(back), back: back };
  };

  /* --------- 造兵 --------- */
  /* 兵种解锁检查：一次性列出全部未满足项，便于玩家知道还缺什么 */
  GAME.canTrain = function (troopId, city) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    if (!t) return { ok: false, msg: '未知兵种' };
    /* v89.190：可选城参数（自动征兵逐城判别用：训练营/研习所等门槛按**该城**算；
       不传 = 当前城 —— 与旧口径逐字一致）。
       v89.191（老板 3-④）：`unlock.tech` 也改**按城**读 —— 各城科技独立生效，
       本城没研究出来的兵种就是本城造不了（换有该科技的城造，或先在本城研究）。
       `unlock.city`（占领某首府）仍是**全境**条件，不变。 */
    city = city || GAME.currentCity() || s.cities[0];
    var u = t.unlock || {};
    var fails = [];
    for (var k in u) {
      if (k === 'city') {
        var need = u.city;
        var STATE_NAME = { qingzhou: '盐岸', yizhou: '雾谷', hebei: '灰野', sili: '霜脊', liangzhou: '风碛' };
        var CITY_NAME = { qingzhou: '盐井', yizhou: '云栈', hebei: '灰垣', sili: '霜堡', liangzhou: '风关' };
        var has = false;
        s.cities.forEach(function (c) {
          /* v45：身份判据用 **origName**（原名）—— 玩家可以把灰烬城改名叫"灰岗"，
             但"我是否握着霜脊首府"这件事不该跟着名字变。 */
          if (c.state === need || (c.origName || c.name) === (CITY_NAME[need] || need)) has = true;
        });
        if (!has) fails.push('需占领' + (STATE_NAME[need] || need) + '首府');
      } else if (k === 'tech') {
        for (var tk in u.tech) {
          var _tl191 = (GAME.systems && GAME.systems.techLevel) ? GAME.systems.techLevel(tk, city) : 0;
          if (_tl191 < u.tech[tk]) {
            var tn = null;
            DATA.TECH.forEach(function (x) { if (x.id === tk) tn = x.name; });
            fails.push('需科技' + (tn || tk) + ' Lv' + u.tech[tk]);
          }
        }
      } else {
        /* v29（需求 13）：器械由**机工坊**制造 —— "造自行火炮要先有 8 级训练营"
           既不合逻辑，也让作坊等级形同虚设。其余门槛（研习所、作坊）照旧。 */
        if (t.craft && k === 'junying') continue;
        var lv = GAME.buildingLevel(city, k);
        if (lv < u[k]) fails.push('需' + (DATA.BUILDINGS[k] ? DATA.BUILDINGS[k].name : k) + ' Lv' + u[k]);
      }
    }
    if (fails.length) return { ok: false, msg: fails.join('　') };
    return { ok: true };
  };


  /* ============================================================
   * 训练营与募兵队列位（v24 · 需求 8）
   * ------------------------------------------------------------
   * 募兵不再"全城共用一个队列"，而是**每座训练营各一条**：
   *   · 队列位 = 1（执行）+ (Lv≥5 ? 1 : 0) + (Lv≥10 ? 1 : 0)，最多 3 条
   *   · 同一训练营只有**最早的一条**在走倒计时，其余排队等待
   *   · 执行中完成 → 下一条自动开跑
   * bIdx = 城内格子下标，旧档队列没有 bIdx 时由读档迁移补上。
   * ============================================================ */
  GAME.trainQueueSlots = function (lv, city) {
    lv = Number(lv) || 0;
    /* v28（需求 1）：训练营建筑专精再 +1 位/档（v89.137：12/24/36 三档 = +1/+2/+3）。
       city 可选 —— 不传时按"当前城"判定；调用方若已知是哪座城，务必传进来。
       v60（需求 5）：**名城档位优势**再 +troopSlot（旧都 +1）——
       perks 里"募兵队列 +1"那项的落地点（不加这句它就是死属性）。 */
    var bonus = city ? GAME.mastery('trainSlot', city) : GAME.mastery('trainSlot', null);
    return 1 + (lv >= 5 ? 1 : 0) + (lv >= 10 ? 1 : 0) + bonus
      + GAME.perkNum(city || GAME.currentCity(), 'troopSlot');
  };

  /* ============================================================
   * 募兵上限（v28 · 需求 5）
   * ------------------------------------------------------------
   * "填数量"是这个游戏里最繁琐的一步：玩家知道要募兵，但不知道该填多少，
   * 只能反复点 +10 试探，或者自己拿幸存者和四种资源去心算。
   * 这里把上限一次算出来（幸存者与四种资源各能支撑多少，取最小），
   * 界面上一个「上限」按钮直接填进去。
   *
   * 口径与 GAME.train 的校验**完全一致**（同一个幸存者消耗、同一套资源单价、
   * 同一个单次上限），否则会出现"按了上限却提示资源不足"的自相矛盾。
   * ============================================================ */
  /* v89.86（整改 P-19）：可募上限的**归因**出口 —— 上限为 0 时要说清是谁卡住：
     reason = 'pop'（幸存者耗尽）/ 'res'（资源不足，lack 列最短缺的几种）。
     maxTrainCount 收敛为它的 cap 字段（旧口径逐字保留，两处不再各算一遍）。 */
  GAME.trainLimitOf = function (troopId, city) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    if (!s || !t) return { cap: 0, popBound: Infinity, resBound: Infinity, reason: '', lack: [] };
    /* v89.190：可选城参数（自动征兵逐城判别用：幸存者与资源都按**该城**算；
       不传 = 当前城 —— 与旧口径逐字一致）。 */
    city = city || GAME.currentCity();
    var cap = 500000;                                // 与 GAME.train 的单次上限一致
    /* 幸存者：**可征幸存者**（幸存者 − 劳作占用，v89.126 唯一出口）÷ 每兵占幸存者 */
    var popBound = Infinity;
    if (t.pop > 0) popBound = Math.floor(GAME.popFreeOf(city) / t.pop);
    /* 资源：逐项余量 ÷ 单兵消耗，取最小的那一项（短板决定上限）。
       v89.190：读 **该城** 的库存（GAME.res(city)）；金是全境池（访问器），同路可读。 */
    var _R190 = GAME.res(city) || {};
    var resBound = Infinity;
    for (var k in (t.cost || {})) {
      var need = t.cost[k];
      if (need > 0) resBound = Math.min(resBound, Math.floor((_R190[k] || 0) / need));
    }
    cap = Math.max(0, Math.floor(Math.min(cap, popBound, resBound)));
    var reason = '', lack = [];
    if (cap <= 0) {
      reason = (popBound <= resBound) ? 'pop' : 'res';
      if (reason === 'res') {
        for (var k2 in (t.cost || {})) {
          if ((t.cost[k2] || 0) > 0 && (_R190[k2] || 0) < t.cost[k2]) lack.push(k2);
        }
      }
    }
    return { cap: cap, popBound: popBound, resBound: resBound, reason: reason, lack: lack };
  };
  GAME.maxTrainCount = function (troopId, cityId, bIdx) {
    /* v29（需求 13）：器械与募兵的上限口径相同（幸存者 + 资源短板），
       bIdx 只是调用方用来定位队列的，不参与上限计算。 */
    return GAME.trainLimitOf(troopId).cap;
  };

  /* 下一个等待位的解锁等级（用于"队列已满"时告诉玩家差多少） */
  GAME.trainNextSlotLv = function (lv) {
    lv = Number(lv) || 0;
    if (lv < 5) return 5;
    /* v28：10 级之后还有 12 级建筑专精 +1 位，所以"下一个等待位"是 12 而非 null */
    if (lv < 5) return 5;
    if (lv < 10) return 10;
    if (lv < DATA.MAX_BLEVEL) return DATA.MAX_BLEVEL;
    return 0;
    return 0;
  };
  GAME.barracksOf = function (city) {
    city = city || GAME.currentCity();
    var out = [];
    if (!city) return out;
    (city.cells || []).forEach(function (cell, idx) {
      if (cell.build && cell.build.id === 'junying') out.push({ idx: idx, lvl: cell.build.lvl || 1 });
    });
    return out;
  };
  GAME.barracksLevel = function (city, idx) {
    var l = 0;
    idx = Number(idx);
    GAME.barracksOf(city).forEach(function (b) { if (b.idx === idx) l = b.lvl; });
    return l;
  };
  /* 默认训练营（无 bIdx 时兜底）；本城无训练营返回 -1 */
  GAME.firstBarracksIdx = function (city) {
    var list = GAME.barracksOf(city);
    return list.length ? list[0].idx : -1;
  };
  /* ============================================================
   * 机工坊（v29 · 需求 13）
   * ------------------------------------------------------------
   * 器械（无人轰炸机 / 自行火炮 / 自行火炮）不再跟募兵挤同一条队列：
   *   · 队列位由**作坊等级**决定（与训练营同一套阶梯：1 / Lv5 +1 / Lv10 +1 / 建筑专精 +1）
   *   · 队列挂在**作坊格位**上，与训练营队列互不占位
   * 实现上仍然共用 `s.queues.train` 这一条数组，靠条目上的 `kind` 分组 ——
   * 于是推进逻辑（GAME.advanceTrainQueues）一行都不用改，
   * 也不会出现"两套推进代码各自漂移"的老问题。
   * ============================================================ */
  GAME.craftWorkshopsOf = function (city) {
    city = city || GAME.currentCity();
    var out = [];
    if (!city) return out;
    (city.cells || []).forEach(function (cell, idx) {
      if (cell.build && cell.build.id === 'gongjiangzuofang') out.push({ idx: idx, lvl: cell.build.lvl || 1 });
    });
    return out;
  };
  GAME.craftLevel = function (city, idx) {
    var l = 0;
    idx = Number(idx);
    GAME.craftWorkshopsOf(city).forEach(function (b) { if (b.idx === idx) l = b.lvl; });
    return l;
  };
  GAME.firstWorkshopIdx = function (city) {
    var list = GAME.craftWorkshopsOf(city);
    return list.length ? list[0].idx : -1;
  };
  /* 队列键：**含 kind**，于是训练营组与作坊组天然分开推进 */
  GAME.trainQueueKey = function (q) {
    return (q.kind || 'train') + '|' + (q.cityId || '') + '#' + (q.bIdx == null ? -1 : q.bIdx);
  };
  GAME.queueKindOf = function (kind) { return kind === 'craft' ? 'craft' : 'train'; };
  /* ============================================================
   * 募兵队列推进 —— **唯一实现**，在线 tickOnce 与离线 simulateBulk 共用。
   * ------------------------------------------------------------
   * 规则：按训练营分组，每组只有**最早一条**吃时间；它完成后，剩余时间
   * 结转给同组的下一条（不是重新按整段推进，否则离线补算会凭空多出兵）。
   * 曾经两处各写一份：只改了离线那份，实测仍然是"所有队列齐步走"。
   * ============================================================ */
  GAME.advanceTrainQueues = function (secGame) {
    var s = GAME.state;
    if (!s || !s.queues.train.length || !(secGame > 0)) {
      if (s) (s.queues.train || []).forEach(function (q, i) { q.waiting = i > 0; });
      return;
    }
    var groups = {}, order = [];
    s.queues.train.forEach(function (q) {
      var k = GAME.trainQueueKey(q);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(q);
    });
    order.forEach(function (k) {
      var list = groups[k], left = secGame, running = null;
      while (left > 0 && list.length) {
        var head = list[0];
        var need = head.totalTime - head.elapsed;
        running = head;                       // 这一条确实分到了时间 → 它就是"募兵中"
        if (need > left) { head.elapsed += left; left = 0; break; }
        head.elapsed = head.totalTime;
        left -= need;
        var at = s.queues.train.indexOf(head);
        if (at >= 0) s.queues.train.splice(at, 1);
        list.shift();
        running = null;                       // 已完成出队，下一条尚未开始
        GAME.applyTrainDone(head);
      }
      /* 用「这一轮到底有没有分到时间」判定，而不是用下标 ——
         时间刚好在某条上用完时，下一条虽然排在第 0 位却并没有开始，
         一刀切写 waiting=true 会把正在募兵的那条也标成"排队等待"。 */
      list.forEach(function (q) { q.waiting = (q !== running); });
    });
  };
  /* 该训练营当前的募兵队列（按入队顺序） */
  GAME.trainQueuesOf = function (city, bIdx) {
    var s = GAME.state;
    if (!s || !city) return [];
    bIdx = Number(bIdx);
    if (!isFinite(bIdx)) bIdx = -1;
    var kind = GAME.queueKindOf(arguments[2]);
    return (s.queues.train || []).filter(function (q) {
      return GAME.queueKindOf(q.kind) === kind
        && q.cityId === city.id && (q.bIdx == null ? -1 : q.bIdx) === bIdx;
    });
  };
  /* 该训练营 / 该作坊还剩几个空位 */
  GAME.trainSlotsLeft = function (city, bIdx, kind) {
    kind = GAME.queueKindOf(kind);
    var lv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
    var slots = GAME.trainQueueSlots(lv, city);
    return Math.max(0, slots - GAME.trainQueuesOf(city, bIdx, kind).length);
  };

  GAME.train = function (troopId, count, cityId, bIdx) {
    var s = GAME.state, t = DATA.TROOPS[troopId];
    var city = GAME.cityById(cityId || (s && s.cities[0] && s.cities[0].id));
    if (!t) return { ok: false, msg: '未知兵种（请先在上方选择要训练的兵种）' };
    if (!city) return { ok: false, msg: '城池不存在' };
    count = Math.floor(Number(count));
    if (!count || count <= 0 || !isFinite(count)) return { ok: false, msg: '训练数量无效（请填写大于 0 的整数）' };
    /* 单次训练上限：防止误输入超大数量把队列时长撑到天量 */
    if (count > 500000) return { ok: false, msg: '单次训练不超过 50 万（可分多次训练）' };
    var chk = GAME.canTrain(troopId, city);   /* v89.190：门槛按目标城（跨城自动征兵同源） */
    if (!chk.ok) return chk;
    /* v24（需求 8）：募兵归属**具体一座训练营**，队列位由该训练营等级决定。
       放在数量与解锁校验**之后** —— 否则填错数量时会得到"队列已满"这种驴唇不对马嘴的提示。 */
    /* v29（需求 13）：器械走**机工坊**的队列，募兵走训练营的队列 —— 两不相干 */
    var kind = t.craft ? 'craft' : 'train';
    if (bIdx == null || bIdx === '') {
      bIdx = kind === 'craft' ? GAME.firstWorkshopIdx(city) : GAME.firstBarracksIdx(city);
    }
    bIdx = Number(bIdx);
    if (!isFinite(bIdx)) bIdx = -1;
    var bLv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
    /* v89.211（老板 3）防御回落：指定工位对不上（陈旧/跨类 idx）而本城该级建筑存在时，
       回落首座 —— 与界面解析（ui.trainBarracks）同一口径。否则下面那句
       "本城尚无机工坊"就是假报（明明有作坊，只因提交带的是上次点的训练营格）。
       真无作坊的城仍走原拒绝（提示与实际情况相符）。 */
    if (bLv <= 0) {
      var _fb211 = kind === 'craft' ? GAME.firstWorkshopIdx(city) : GAME.firstBarracksIdx(city);
      if (_fb211 >= 0 && _fb211 !== bIdx) {
        bIdx = _fb211;
        bLv = kind === 'craft' ? GAME.craftLevel(city, bIdx) : GAME.barracksLevel(city, bIdx);
      }
    }
    if (bLv <= 0) {
      return { ok: false, msg: kind === 'craft'
        ? '本城尚无机工坊，无法制造器械（先建机工坊）'
        : '本城尚无训练营，无法募兵（先建训练营）' };
    }
    if (GAME.trainSlotsLeft(city, bIdx, kind) <= 0) {
      var nx = GAME.trainNextSlotLv(bLv);
      return { ok: false, msg: (kind === 'craft' ? '本作坊制造队列已满' : '本营募兵队列已满')
        + (nx ? '（' + (kind === 'craft' ? '作坊 ' : '训练营 ') + nx + ' 级解锁下一个等待位）' : '') };
    }
    /* 练兵场出征容量提示（造兵只需资源+幸存者，出征时练兵场才限制） */
    var xc = GAME.buildingLevel(city, 'xiaochang') || 0;
    var needPop = t.pop * count;
    var cost = {};
    for (var k in t.cost) cost[k] = t.cost[k] * count;
    cost.pop = needPop;
    /* v89.126（需求 2）：幸存者受**劳作占用**制约 —— 只有"可征幸存者"（幸存者−劳作）能征兵 */
    var _free126 = GAME.popFreeOf(city);
    if (needPop > _free126) {
      return { ok: false, msg: '可征幸存者不足（需 ' + U.fmt(needPop) + '，可征 ' + U.fmt(_free126)
        + '；劳作占用 ' + U.fmt(GAME.popLaborOf(city)) + ' 不可征兵）' };
    }
    if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: GAME.costLackMsg(city, cost) || '本城资源不足（跨城需走「本境调运」）' };
    GAME.payCostIn(city, cost);
    /* 训练时间：单个训练秒×数量（练兵技巧/操典残页减时） */
    var totalTime = count * t.time;
    var trainRed = GAME.systems.techBonus('train', city);   /* v89.191：按城读 */
    totalTime = Math.round(totalTime * (1 - Math.min(0.6, trainRed)));
    if (GAME.story) totalTime = Math.round(totalTime / GAME.story.trainMult()); // 年号：训练加速
    /* v63（老板）：征兵加速取**本城**守将的武力（改前吃全境守将之和） */
    var gbT = GAME.guardBonus(city);
    if (gbT.train) totalTime = Math.round(totalTime / (1 + Math.min(1.5, gbT.train))); // 守将武力：征兵加速
    /* v28（需求 1）：机工坊建筑专精 —— 器械（craft 兵种）打造耗时 −15%/档
       （v89.137：三档 = −15% / −30% / −45%，上限 0.9 兜底） */
    var _ct137 = GAME.mastery('craftTimePct', city);
    if (t.craft && _ct137 > 0) totalTime = Math.round(totalTime * (1 - Math.min(0.9, _ct137)));
    /* 派系被动（v89.86 · 玄机阁「器械打造耗时 −15%」）—— 仅器械（craft）生效 */
    if (t.craft && GAME.sectBonus) totalTime = Math.round(totalTime * (1 - Math.min(0.5, GAME.sectBonus('craftCut'))));
    if (s.buffs && s.buffs.trainRed && s.buffs.trainRed.until > U.now()) {
      totalTime = Math.round(totalTime * (1 - s.buffs.trainRed.eff));
    }
    s.queues.train.push({ kind: kind, cityId: city.id, bIdx: bIdx, troopId: troopId, count: count,
      elapsed: 0, totalTime: Math.max(2, totalTime), waiting: false });
    return { ok: true, msg: (kind === 'craft' ? '开始制造 ' : '开始训练 ') + t.name + ' ×' + count };
  };

  /* ============================================================
   * 募兵提速 · 花金买时间（v89.49 · 老板「募兵队列怎么不可加速了？」）
   * ------------------------------------------------------------
   * 病根见 DATA.TRAIN_RUSH 头部注释：加速原先只有「游商宝物」一条路，
   * 没宝物时按钮 disabled = 玩家眼里的"不可加速"。
   * **唯一出口组**（界面只读这四个，不自己算价）：
   *   trainRushCfg()      —— 读表
   *   trainBatchValue(q)  —— 该批的编制军资（计价锚点）
   *   trainRushRemain(q)  —— 剩下多少比例没走完（计价与特效上限共用）
   *   trainRushCost(q,p)  —— 按**实际能缩短的量**报价
   *   trainRush(...)      —— 结算
   * ============================================================ */
  GAME.trainRushCfg = function () { return DATA.TRAIN_RUSH || { costPct: 0.2, steps: [] }; };
  GAME.trainBatchValue = function (q) {
    var t = q && DATA.TROOPS[q.troopId];
    if (!t || !t.cost || !q.count) return 0;
    var sum = 0;
    for (var k in t.cost) sum += (t.cost[k] || 0) * q.count;
    return Math.round(sum);
  };
  /* 还剩多少比例（0~1）。已走完 = 0 —— 计价与提速都按它封顶 */
  /* v89.179c（BOOST_CAP 唯一出口）：一条队列**还能被加速跳过**的时长余量。
     道具（S._boost / S.boostTrainQueue）与花金买时间（GAME.trainRush）共用此额度：
     合并累计跳过量 q.boosted ≤ totalTime × BOOST_CAP，自然耗时至少留 (1 − BOOST_CAP)。
     ⚠️ 计 q.boosted（跳过量）而非 q.elapsed（含自然推进）——
       否则"队列自然走到一半再想提速"会被误判成额度用光（fieldset 实测口径）。 */
  GAME.boostRoomOf = function (q) {
    if (!q || !q.totalTime) return 0;
    var cap = (DATA.BOOST_CAP || 0.3) * q.totalTime;
    return Math.max(0, cap - (q.boosted || 0));
  };
  GAME.trainRushRemain = function (q) {
    if (!q || !q.totalTime) return 0;
    return Math.max(0, Math.min(1, 1 - (q.elapsed || 0) / q.totalTime));
  };
  GAME.trainRushCost = function (q, pct) {
    var cfg = GAME.trainRushCfg();
    /* 实际能削的比例 = min(还能缩短的, 该档, BOOST_CAP 余量) ——
       报价与交付同口径，不出"报价按 100% 收、实际只削 30%"的虚报。 */
    var frac = Math.min(GAME.trainRushRemain(q), Math.max(0, Number(pct) || 0),
      q && q.totalTime ? GAME.boostRoomOf(q) / q.totalTime : 0);
    if (!(frac > 0)) return 0;
    return Math.max(1, Math.ceil(GAME.trainBatchValue(q) * (cfg.costPct || 0.2) * frac));
  };
  /* 该营/该作坊**正在执行**的那一条（与宝物加速同一口径：排队的还没走表，提速它没意义） */
  GAME.trainRunningOf = function (cityId, bIdx, kind) {
    var city = GAME.cityById(cityId) || GAME.currentCity();
    if (!city) return null;
    var list = GAME.trainQueuesOf(city, bIdx, GAME.queueKindOf(kind));
    if (!list.length) return null;
    for (var i = 0; i < list.length; i++) if (!list[i].waiting) return list[i];
    return list[0];
  };
  GAME.trainRush = function (cityId, bIdx, pct, kind) {
    var s = GAME.state;
    var city = GAME.cityById(cityId) || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var q = GAME.trainRunningOf(city.id, bIdx, kind);
    if (!q) return { ok: false, msg: '本营没有募兵任务' };
    /* v89.179c（BOOST_CAP）：花金买时间与宝物加速**共用同一封顶** ——
       合并跳过量 q.boosted ≤ totalTime × BOOST_CAP（老板拍板 30%），
       自然耗时至少留 70%。额度用满即拒（不扣金）。 */
    var _room = GAME.boostRoomOf(q);
    if (_room <= 0) {
      return { ok: false, msg: '该队列加速已达上限（最多 ' + Math.round((DATA.BOOST_CAP || 0.3) * 100) + '%）' };
    }
    var frac = Math.min(GAME.trainRushRemain(q), Math.max(0, Number(pct) || 0), _room / q.totalTime);
    if (!(frac > 0)) return { ok: false, msg: '该队列已完工' };
    var cost = GAME.trainRushCost(q, frac);
    if ((s.res.gold || 0) < cost) {
      return { ok: false, msg: '旧币不足（需 ' + U.fmt(cost) + '，现有 ' + U.fmt(s.res.gold || 0) + '）' };
    }
    var add = q.totalTime * frac;
    s.res.gold -= cost;
    q.elapsed = Math.min(q.totalTime, (q.elapsed || 0) + add);
    q.boosted = (q.boosted || 0) + add;
    var tn = (DATA.TROOPS[q.troopId] || {}).name || q.troopId;
    var done = q.elapsed >= q.totalTime;
    GAME.log.war('募兵提速：花金 ' + U.fmt(cost) + ' → ' + tn + ' ×' + q.count
      + '（缩短 ' + Math.round(add / GAME.timeScale()) + ' 秒'
      + (done ? ' · 完工' : ' · 余 ' + Math.round((q.totalTime - q.elapsed) / GAME.timeScale()) + ' 秒') + '）');
    return { ok: true, msg: '花金 ' + U.fmt(cost) + '：' + tn + ' 缩短 '
      + Math.round(add / GAME.timeScale()) + ' 秒' + (done ? '，已完工' : '') };
  };

  /* ============================================================
   * 城池重命名（v25 · 需求 8）
   * ------------------------------------------------------------
   * 只有**自己建的城**（type === 'self'）能改名 ——
   * 攻占的名城（灰烬城/泽乡…）名字是世界观的一部分，改了会让
   * 战报、岁贡、首府加成这些地方对不上号。
   * ============================================================ */
  /* 城池名 + 等级标注（v29 · 需求 9）
     ------------------------------------------------------------
     地图、侧栏、统计、政务厅、战报抬头…… 到处都在显示城池名，但"这是旧都还是聚落"
     只写在数据里 —— 玩家得自己记住"灰烬城是旧都"。统一给一个取值口：
       · 自建城不标注（"自建城"三个字没有信息量，只添乱）；
       · 名城标注 [旧都] / [首府] / [重镇] / [聚落]。
     所有引用的地方都改走这里，改名与标注就不会两处各写一份。 */
  GAME.cityTierName = function (city) {
    if (!city) return '';
    var t = city.type || 'self';
    if (t === 'self') return '';
    return DATA.CITY_TIER[t] || '';
  };
  GAME.cityLabel = function (city) {
    if (!city) return '';
    var tn = GAME.cityTierName(city);
    return city.name + (tn ? '[' + tn + ']' : '');
  };

  GAME.canRenameCity = function (city) {
    city = city || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    /* v45（需求 4）：**所有已拥有的城池都可改名**（含灰烬城这类旧都名城）。
       改前只放行 `type === 'self'`，而玩家的开局城就是灰烬城（旧都）——
       于是按钮永远置灰，老板因此以为"政务厅根本没有改名功能"。
       名城改名不会破坏任何引用：原名在第一次改名时另存 `city.origName`，
       首府判定 / 灰烬城归属判定 / 玩家可见的"原名"标注一律读 origName 而非 name。 */
    if (!city.origName) city.origName = city.name;
    return { ok: true };
  };
  GAME.renameCity = function (cityId, name) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var chk = GAME.canRenameCity(city);
    if (!chk.ok) return chk;
    name = String(name == null ? '' : name).trim();
    if (!name) return { ok: false, msg: '名字不能为空' };
    if (name.length > 12) return { ok: false, msg: '名字不超过 12 个字' };
    if (name === city.name) return { ok: false, msg: '名字未改动' };
    var dup = false;
    (GAME.state.cities || []).forEach(function (c) { if (c.id !== city.id && c.name === name) dup = true; });
    if (dup) return { ok: false, msg: '已有同名城池' };
    var old = city.name;
    /* 原名只记第一次 —— 反复改名时 origName 始终是"它本来是谁" */
    if (!city.origName) city.origName = old;
    city.name = name;
    GAME.log('🏯 城池改名：' + old + ' → ' + name, 'sys', 'admin');
    return { ok: true, msg: '已改名为「' + name + '」' };
  };

  /* --------- 部队统计 --------- */
  GAME.armyTotal = function (city) {
    var total = 0;
    for (var k in (city.army || {})) total += city.army[k];
    return total;
  };

  /* ============================================================
   * 酒馆 / 招募站 / 货仓 / 交易站（建筑功能实现）
   * 原则：每座功能建筑都要有实际作用，且其等级应构成其他玩法的门槛。
   * ============================================================ */

  /* --------- 招募站：英雄席位（**按城**，唯一出口） ---------
   * v64（老板）：「英雄归属于城市，根据**该城的招募站等级**有相应空位」。
   * 改前 `GAME.generalCap()` 读的是**当前城**的招募站等级，却拿去约束**全境总数**，
   * 于是两件事都说不通：
   *   · 多城经营时席位不随城数增加（第二座城的招募站白建）；
   *   · 切到招募站小的城，反而连一个人都不许招 —— "到底哪个城的容量"没法回答。
   * 现在席位跟着城走，且**只由一个出口给出**：
   *   `genSlotsOf(city)` = 该城招募站等级 +（该城招募站建筑专精 ? 2 : 0）。
   * 超编不会赶人走，但**不许再进人**（招募 / 派遣 / 归降之外一律拦）。 */
  GAME.genSlotsOf = function (city) {
    if (!city) return 0;
    /* v28：招募站建筑专精 —— 房间 +2/档（v89.137：三档 = +2/+4/+6）
       v79：+ 威望 / 主城 的英雄席位加成（cityBonusNum 汇总口） */
    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)
      + GAME.mastery('genRoom', city)
      + GAME.cityBonusNum(city, 'genCap')
      /* v89.132（老板「节钺设计再开拓一下」）：招贤纳士 —— 每城 +1 席（至多 genMax） */
      + Math.min(city.jieyueGen || 0, (DATA.JIEYUE || {}).genMax || 2);
  };
  /* 某城现有英雄 —— **与英雄页名单同源**（两边都走 `genCityOf`）。
     判据不一致就会出现"名单上 6 人、却提示只剩 1 个空位"这类自相矛盾。
     出征/采集途中的将**仍属原城**：人走了，位置不空。 */
  GAME.generalsIn = function (city) {
    city = city || GAME.currentCity();
    if (!city) return [];
    return ((GAME.state && GAME.state.generals) || []).filter(function (g) {
      var gc = GAME.genCityOf(g);
      return !!(gc && gc.id === city.id);
    });
  };
  /* 某城剩余席位数（负数按 0 记） */
  GAME.genFreeOf = function (city) {
    return Math.max(0, GAME.genSlotsOf(city) - GAME.generalsIn(city).length);
  };
  /* 全境席位合计（**只给"全境"视图显示**；任何判定都必须按城） */
  GAME.genSlotsTotal = function () {
    var s = GAME.state;
    return (((s && s.cities) || [])).reduce(function (a, c) { return a + GAME.genSlotsOf(c); }, 0);
  };

  /* --------- 货仓：资源容量上限 --------- */
  /* v89.81：基准常量移到 `DATA.BASE_STORE`（唯一出口）—— 名城库藏派生
     （DATA.NPC_CITY_RES.resByTier = 满配仓容）也要用它，写两份必然漂移。 */
  GAME.storeCap = function () {
    /* v60（需求 4）：仓储上限**按城**（资源既然归属城池，仓容也跟着走）。
       `storeCap` = 当前城的 cap，跨城看别人的仓容是上一版的 bug 来源。
       跨城调拨请用「资源运输」（见 GAME.doTransport）。 */
    return GAME.storeCapOf(GAME.currentCity());
  };
  /* ============================================================
   * v89.159（复核轮抓出的真 bug）：**奖励式资源入账的"封顶"出口**
   * ------------------------------------------------------------
   * 病根：采集收获是全站**唯一** clamp 的奖励入账，写法是"先加满再截回 cap" ——
   *   在**存量已被奖励顶到上限之上**（v89.158 起允许的既成事实）时，
   *   这次收获会把库存**削回** cap（与「只封增长、不削存量」相悖；
   *   实测：500 万 → 366.7 万那种"平白少一截"）。
   * 口径（与 tick 的生产口径同一把尺）：存量 ≥ 上限 → 一点都不加；
   *   否则加到上限为止；**装不下的部分不算入账，但要能被报出来**（返回值带 trimmed）。
   * 返回 { added, trimmed, cur } —— 调用方（收获明细/公文）读它，不再自己算一遍。
   * ------------------------------------------------------------
   * ⚠️ v89.179c（观察项② 核实更正）：**目前全仓只有采集收获一处调用它**
   *   （`grep -rn "addResCapped" js/` = 定义 1 + 调用 1）；
   *   岁贡 / 奇遇 / 交易站等奖励入账仍是"直接加、不封顶"。
   *   本段原先写"**奖励式资源入账的唯一出口**"属**声明超范围**，已按现状改正。
   *   是否把其余奖励入账也统一纳入封顶 = **平衡决策**（v89.158 允许存量超上限，
   *   统一封顶会把"奖励"变成"可能装不下而白给"）→ 待老板拍板，本轮不擅自改。
   * ============================================================ */
  GAME.addResCapped = function (key, amount, city) {
    var s = GAME.state;
    if (!s || !key) return { added: 0, trimmed: 0, cur: 0 };
    var ct = city || GAME.currentCity();
    var R = GAME.res(ct);
    var cap = GAME.storeCapOf(ct, key);   /* v89.212（老板 1）：按资源上限（堆场分账） */
    var cur = R[key] || 0;
    var amt = Math.max(0, amount || 0);
    if (!(cap > 0) || key === 'gold') {          /* 旧币不设上限（既有口径） */
      R[key] = cur + amt;
      return { added: amt, trimmed: 0, cur: R[key] };
    }
    if (cur >= cap) return { added: 0, trimmed: amt, cur: cur };
    var add = Math.min(amt, cap - cur);
    R[key] = cur + add;
    return { added: add, trimmed: amt - add, cur: R[key] };
  };
  /* 指定城的仓储上限（唯一出口，别处不要再自己乘一遍）
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
  };
  /* ============================================================
   * v89.158（老板 1「左侧资源统计的容量显示仍然不对」）：**仓容分账**（唯一出口）——
   *   把 storeCapOf 的算式拆成"账目自洽"的部件，供 悬停 / 货仓面板 / 建造面板 同源展示：
   *     · base  = 货仓体系部分（含储存科技 / 仓专精 / 名城·威望·主城·神器加成）
   *               —— **未建货仓时即"基础储量"（DATA.BASE_STORE）**
   *     · ext   = 城外堆场（纯加法，不吃仓储加成）
   *     · total = base + ext（= storeCapOf 的返回值）
   *     · lv    = 本城仓等级**之和**（多仓叠加口径；buildingLevel 只给"最高一座"，
   *               两把尺会出现"货仓 Lv1 却有 3 级容量"的显示错位）
   *   改前三处显示各拼各的 → 出现"上限 366.7万 / 其中堆场 +166.7万"、
   *   而另外 200 万（基础）没有出处的账目（老板原话口径："仍然不对"）。改后 = 分账相加。
   * ============================================================ */
  GAME.storePartsOf = function (city) {
    city = city || GAME.currentCity();
    var BASE = DATA.BASE_STORE || 2000000;
    if (!city) return { base: BASE, ext: 0, total: BASE, lv: 0 };
    /* v19：货仓可多建 —— 储量按**本城各仓等级之和**计（一座 Lv5 = 五座 Lv1）。
       储存技术 +5%/级；货仓建筑专精再 +50%；名城档位优势再 +storePct（旧都 +50%）。 */
    var lv = GAME.buildingLevelSum(city, 'cangku');
    var raw = lv > 0 ? BASE * lv : BASE;
    /* v89.81：建筑专精的值改读 `DATA.MASTERY` —— 原先这里硬编码 0.5，而表里写着 0.50：
       数值恰好相同所以从没暴露，但那是"两个出口"（改表不生效）。 */
    var mStore = (GAME.mastery && lv > 0) ? GAME.mastery('storePct', city) : 0;
    var base = Math.round(raw * (1 + techB('store', city))
      * (1 + mStore)
      * (1 + GAME.cityBonusNum(city, 'storePct')));   /* v79：+ 威望/主城/神器 仓储 */
    /* v89.141（老板 0）：「城外资源建筑还自带一点上限容量」——
       **纯加法**（不吃仓储加成：露天堆场与货仓体系解耦，见 DATA.EXT_STORE_PER_LV）。 */
    var ext = GAME.extStoreCapOf(city);
    /* v89.212（老板 1）：按资源分账 —— extByRes（各类堆场）/ capByRes（各类实际上限）。
       capByRes[k] = base + extByRes[k]：**哪种资源的地块多，哪种的储存上限就大**
       （老板原话「地块多的存的多」）。账目自洽：base + extByRes[k] === capByRes[k]。 */
    var extByRes = GAME.extStoreCapByResOf(city);
    var capByRes = {};
    Object.keys(extByRes).forEach(function (k) { capByRes[k] = base + extByRes[k]; });
    return { base: base, ext: ext, extByRes: extByRes, capByRes: capByRes, total: base + ext, lv: lv };
  };

  /* ============================================================
   * v89.160（老板 1）：**逾溢折损**（唯一出口群 · 见 DATA.OVERFLOW 的口径注释）
   *   overflowRotOf(city)      本城"超出上限"的资源清单 [{ k, excess }]（纯读，供界面/断言）
   *   overflowLossOf(ex, n)    n 期折损额 = ex ×(1 − (1−ratio)^n)，取整、超出≥1 至少损 1
   *   overflowEventOf()        随机灾种 { name, icon }（唯一出口：提示与断言同源）
   *   settleOverflowRot()      结算（锚点 s.overflowAt · 幂等 · 返回 { periods, total, losses, event }）
   * 挂钩：tickOnce（在线 · 历法推进之后）+ simulateBulk（离线补算末尾）——
   *   两处**同一个函数**，不各写一份。
   * ============================================================ */
  GAME.overflowRotOf = function (city) {
    var C = DATA.OVERFLOW || {};
    var ct = city || GAME.currentCity();
    var out = [];
    if (!ct) return out;
    /* v89.212（老板 1）：逾溢判定用**各资源自己的**上限（堆场分账后逐资源判定） */
    var caps = GAME.storePartsOf(ct).capByRes || {};
    var R = GAME.res(ct);
    (C.keys || []).forEach(function (k) {
      var cap = caps[k] != null ? caps[k] : GAME.storeCapOf(ct, k);
      if (!(cap > 0)) return;
      var excess = (R[k] || 0) - cap;
      if (excess > 0) out.push({ k: k, excess: excess });
    });
    return out;
  };
  GAME.overflowLossOf = function (excess, periods) {
    var C = DATA.OVERFLOW || {};
    var ratio = (C.ratio == null) ? 0.25 : C.ratio;
    var ex = Math.max(0, excess || 0);
    if (ex <= 0) return 0;
    var n = Math.max(1, Math.round(periods || 1));
    /* n 期折掉的正是"原来那份超出量"的一部分：ex − ex×(1−ratio)^n */
    var loss = Math.round(ex * (1 - Math.pow(1 - ratio, n)));
    return Math.max(1, Math.min(ex, loss));
  };
  GAME.overflowEventOf = function () {
    var list = (DATA.OVERFLOW && DATA.OVERFLOW.events) || [];
    if (!list.length) return { name: '折损', icon: '⚠️' };
    return list[Math.floor(Math.random() * list.length)];
  };
  GAME.settleOverflowRot = function () {
    var s = GAME.state;
    if (!s || !s.world) return null;
    var C = DATA.OVERFLOW;
    if (!C) return null;
    var period = (C.periodGameHours || 24) * 3600;
    if (!period) return null;
    var nowG = s.world.elapsed || 0;
    /* 旧档/首次：只登记锚点（首期在 period 之后才到，与月俸同一约定） */
    if (s.overflowAt == null) { s.overflowAt = nowG; return null; }
    var due = Math.floor((nowG - s.overflowAt) / period);
    if (due <= 0) return null;
    var capped = Math.min(due, C.maxPeriods || 20);
    s.overflowAt = s.overflowAt + due * period;
    var losses = {}, total = 0, cities = 0;
    (s.cities || []).forEach(function (ct) {
      var rows = GAME.overflowRotOf(ct);
      if (!rows.length) return;
      var R = GAME.res(ct), any = false;
      rows.forEach(function (r) {
        var loss = GAME.overflowLossOf(r.excess, capped);
        if (loss <= 0) return;
        R[r.k] = Math.max(0, (R[r.k] || 0) - loss);
        losses[r.k] = (losses[r.k] || 0) + loss;
        total += loss; any = true;
      });
      if (any) cities++;
    });
    if (!total) return { periods: capped, total: 0, losses: losses };
    var ev = GAME.overflowEventOf();
    var parts = [];
    DATA.RESOURCES.forEach(function (m) { if (losses[m.key]) parts.push(m.name + ' ' + U.fmt(losses[m.key])); });
    GAME.log(ev.icon + ' ' + ev.name + '：仓廪逾溢，损失 ' + parts.join('、')
      + '（' + cities + ' 城 · 超出上限部分每游戏日折损 ' + Math.round((C.ratio || 0.25) * 100) + '%）',
      'sys', 'admin');
    return { periods: capped, total: total, losses: losses, event: ev.name, icon: ev.icon, cities: cities };
  };
  /* 城外资源建筑的露天堆场容量（v89.141 建 · v89.148 改口径 · 唯一出口）：
     Σ（已建地块等级）× DATA.BASE_STORE ÷ DATA.EXT_STORE_DIV ——
     即**每块 = 同级货仓容量的 1/6**（老板 v89.148 口径；货仓容量 = BASE_STORE × 仓等级）。
     未建地块不计；已建地块按**当前等级**计入（v89.158 纠偏注释：升级施工期间 e.type 仍在、
     按升级前等级计 —— 等级在完工时才更新，故施工中不会提前给新等级的容量）。
     v89.212（老板 1「各资源地块数量不同，但最终储存上限一样；应该地块多的存的多」）：
     **按资源分账** —— 净化厂只堆水 / 温室只堆生物质 / 电站只堆电能 / 熔炉只堆废钢；
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
  };
  /* 单块堆场贡献（**显示用**，v89.155 老板 5）—— 城外面板「另加仓储上限 +Y」。
     口径与总量（extStoreCapOf）同尺：单块 = 等级 × BASE_STORE ÷ DIV。
     ⚠️ 总量在"总和"上取整一次、本函数逐块取整 —— 多块相加与总量可能差几（≤块数），
     只用于**展示**；结算唯一出口仍是 extStoreCapOf。 */
  GAME.extStoreCapOneOf = function (e) {
    var DIV = DATA.EXT_STORE_DIV || 0;
    if (DIV <= 0 || !e || !e.type) return 0;
    return Math.round(Math.max(0, e.lv || 0) * (DATA.BASE_STORE || 2000000) / DIV);
  };

  /* --------- 交易站：等级与交易折损（v89.62 老板「去除商队计数和限制」） ---------
     旧模型把「商队数」当成交易站等级的同义词（每级 +1 商队），并拿它当**交易门槛**
     （无交易站 → 交易全拒）。老板要求去掉这套计数与限制，于是：
       · 口径正名为 **GAME.marketLevel()**（即交易站等级）—— "商队"这个概念从代码与
         界面一并退场，不再有第二个名字指向同一个数；
       · **不再设门槛**：没有交易站也能交易，只是折损最大（marketRate 的 0.6 底）；
       · 界面同步去掉「商队 N」，改标**折损**（那才是交易站等级真正影响的东西）。
     折损公式一字未改（0.6 + 等级×0.035 + 建筑专精），既有平衡口径不变。 */
  GAME.marketLevel = function () {
    var s = GAME.state, city = GAME.currentCity() || (s && s.cities[0]);
    if (!city) return 0;
    return GAME.buildingLevel(city, 'shichang') || 0;
  };

  /* ============================================================
   * 酒馆：候选生成 / 招募（v89.188：「相亲」话术退役，全站统一为「招募」）
   * ============================================================ */
  var INN_SURNAME = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭',
    '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹', '彭', '曾', '萧', '田', '董', '潘'];
  var INN_GIVEN_M = ['武', '霸', '雄', '烈', '毅', '刚', '勇', '猛', '威', '震', '远', '达', '通', '博', '文', '彦',
    '德', '义', '信', '忠', '孝', '安', '宁', '泰', '康', '盛', '昌', '隆', '兴', '平', '靖', '桓', '峤', '琮', '玠', '绍'];
  var INN_GIVEN_F = ['娥', '婵', '环', '姬', '婉', '姝', '媛', '娴', '云', '月', '兰', '芝', '玉', '珠', '环', '瑶',
    '瑾', '琬', '莹', '翠', '秀', '英', '华', '芳', '倩', '绫', '罗', '绮', '纨', '素'];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  /* 酒馆等级（按城；不传则当前城）—— 招募的名额就在这座城的酒馆里 */
  GAME.innLevel = function (city) {
    var s = GAME.state;
    city = city || GAME.currentCity() || (s && s.cities[0]);
    if (!city) return 0;
    return GAME.buildingLevel(city, 'kezhan') || 0;
  };

  /* 这座城还能不能在酒馆招人（v64：按城判，不再拿当前城的容量卡全境） */
  GAME.canRecruitGeneral = function (city) {
    city = city || GAME.currentCity();
    if (!city) return { ok: false, msg: '无城池可招贤' };
    if (GAME.innLevel(city) <= 0) return { ok: false, msg: city.name + ' 需先建造酒馆（城内空地可建）' };
    var cap = GAME.genSlotsOf(city), used = GAME.generalsIn(city).length;
    if (cap <= 0) return { ok: false, msg: city.name + ' 需先建造招募站（每级 +1 席位）' };
    if (used >= cap) {
      return { ok: false, msg: city.name + ' 招募站已无空位（' + used + '/' + cap
        + '）—— 可升级招募站，或把英雄派往他城' };
    }
    return { ok: true, city: city, cap: cap, used: used };
  };

  /* 生成一位候选：资质分档（凡人/突变体/进化体/觉醒体/天启体），酒馆等级越高越易出高资质。
   * 高资质出现概率低，但属性区间与成长都更夸张 —— 拉开档次差异 */
  function makeCandidate(lv, owned) {
    var isBeauty = Math.random() < 0.30;
    /* v73（老板「限制高资质英雄的直接获取，概率再降 10 倍」）：名将直取
       0.30 → 0.03。池内史实名将按 HERO_RANK_LINE 皆是进化体以上的高资质，
       与 DATA.GEN_RANKS 权重再 ÷10 是一套组合拳 —— 高资质英雄从此以
       「基因实验室血清养成」为主路（见 DATA.FARM）。 */
    if (lv >= 5 && Math.random() < 0.03) {
      var pool = ((isBeauty ? DATA.BEAUTIES : DATA.HEROES) || []).filter(function (h) { return !owned[h.name]; });
      if (pool.length) {
        var h = pick(pool);
        owned[h.name] = true;
        var sum = (h.tong || 0) + (h.yw || 0) + (h.zm || 0) + (h.nz || 0);
        /* v89.73：史实名将**也过酒馆资质上限** —— 否则"李逵天启体"照样从酒馆走出来 */
        var hrk = GAME.innCapRank(GAME.heroRank(sum));
        var mul = isBeauty ? 1.25 : 1.0;
        return {
          id: 'cd' + (GAME._cndSeq = (GAME._cndSeq || 0) + 1),
          name: h.name, hero: true, beauty: isBeauty, avatar: isBeauty ? '👩' : '🧔',
          tong: Math.round((h.tong || 60) * mul), nz: Math.round((h.nz || 60) * mul),
          yw: Math.round((h.yw || 60) * mul), zm: Math.round((h.zm || 60) * mul),
          level: Math.max(1, lv + 1), loyalty: 60,
          rank: hrk.id, style: 'balance',
          cost: Math.round(800 * lv * hrk.price * (isBeauty ? 1.6 : 1.0)),
        };
      }
    }
    var rk = GAME.innCapRank(GAME.pickRank(lv));   /* v89.73：酒馆封顶进化体（觉醒体/天启体只走血清升档） */
    var st = GAME.pickStyle(rk);
    var rand = U.rng((U.now() + (GAME._cndSeq || 0) * 7919 + Math.floor(Math.random() * 1e7)) >>> 0);
    function roll() { return U.randInt(rand, rk.base[0], rk.base[1]); }
    var nm = pick(INN_SURNAME) + (isBeauty ? pick(INN_GIVEN_F) : pick(INN_GIVEN_M));
    return {
      id: 'cd' + (GAME._cndSeq = (GAME._cndSeq || 0) + 1),
      name: nm, hero: false, beauty: isBeauty, avatar: isBeauty ? '👩' : '🧔',
      tong: Math.round(roll() * st.mul.tong),
      nz: Math.round(roll() * (isBeauty ? st.mul.nz * 1.15 : st.mul.nz)),
      yw: Math.round(roll() * (isBeauty ? st.mul.yw * 0.7 : st.mul.yw)),
      zm: Math.round(roll() * (isBeauty ? st.mul.zm * 1.15 : st.mul.zm)),
      level: Math.max(1, lv + randInt(-1, 1)), loyalty: 70,
      rank: rk.id, style: st.id,
      cost: Math.round(800 * lv * rk.price * (isBeauty ? 1.4 : 1.0)),
    };
  }

  var INN_FRESH_MS = 5 * 60 * 1000;   // 候选 5 分钟自动更换一批

  /* 取候选列表（必要时自动刷新）。force=true 强制换一批。
     ⚠️ v89.108（老板）：「分城的酒馆只有 Lv2，但是有 14 个候选英雄，应该跟随建筑等级
     提供候选数量」—— 旧实现 `s.inn.candidates` 是**全局一份池**：主城刷出 14 位贤士，
     切到分城照样显示（且 5 分钟内不换批）；`innSlots()` 里还漏传 city（拿当前城算）。
     现在：**池按城独立**（`s.inn.byCity[cityId]`），候选数 = **该城酒馆等级** + 专精。 */
  /* 酒馆候选位数（v28）：**该城**酒馆等级 + 建筑专精 +2/档（v89.137：三档 = +2/+4/+6） */
  GAME.innSlots = function (city) {
    city = city || GAME.currentCity();
    var lv = GAME.innLevel(city);          /* v89.108 修：原来漏传 city，拿的是当前城 */
    if (lv <= 0) return 0;
    return lv + GAME.mastery('innSlot', city);
  };

  /* 取某城的候选池（v89.108）—— **唯一出口**：innRefresh / innRecruit / 界面都从这里拿。
     老档迁移：旧的全局 `s.inn.candidates` 归给主城（无主城 → 首城），一次性；
     不丢弃是怕玩家"看中的贤士凭空没了"（虽然 5 分钟自换一批）。 */
  GAME.innPoolOf = function (city) {
    var s = GAME.state;
    if (!s) return { candidates: [], at: 0 };
    s.inn = s.inn || {};
    if (Array.isArray(s.inn.candidates)) {
      var home = (s.mainCityId && GAME.cityById(s.mainCityId)) || (s.cities && s.cities[0]);
      s.inn.byCity = {};
      if (home) s.inn.byCity[home.id] = { candidates: s.inn.candidates, at: s.inn.at || 0 };
      delete s.inn.candidates;
      delete s.inn.at;
    }
    s.inn.byCity = s.inn.byCity || {};
    city = city || GAME.currentCity();
    if (!city) return { candidates: [], at: 0 };
    if (!s.inn.byCity[city.id]) s.inn.byCity[city.id] = { candidates: [], at: 0 };
    return s.inn.byCity[city.id];
  };

  GAME.innRefresh = function (force, city) {
    var s = GAME.state;
    city = city || GAME.currentCity();
    var lv = GAME.innSlots(city);
    if (lv <= 0) return [];
    var pool = GAME.innPoolOf(city);
    var now = U.now();
    if (!force && pool.candidates && pool.candidates.length && (now - pool.at) < INN_FRESH_MS) {
      return pool.candidates;
    }
    var owned = {};
    (s.generals || []).forEach(function (g) { owned[g.name] = true; });
    var list = [];
    for (var i = 0; i < lv; i++) list.push(makeCandidate(lv, owned));   // 酒馆 N 级 = N 位候选
    pool.candidates = list;
    pool.at = now;
    /* v89.62：新一批到手 → 立刻按「自动招募」设置过一遍（老板需求）。
       此刻 pool.at 已刷新，run 内部的 innRefresh 会走**缓存分支**（上方提前 return），
       所以在结构上不可能递归换批。 */
    if (GAME.innAutoRun) GAME.innAutoRun();
    return list;
  };

  /* 候选下次刷新剩余时间（毫秒）—— 按城 */
  GAME.innRefreshLeft = function (city) {
    var pool = GAME.innPoolOf(city);
    return Math.max(0, INN_FRESH_MS - (U.now() - (pool.at || 0)));
  };

  GAME.innRefreshCost = function (city) {
    var lv = GAME.innLevel(city || GAME.currentCity());
    return 500 * Math.max(1, lv);
  };

  /* 花金立即换一批 */
  GAME.innReroll = function () {
    var lv = GAME.innLevel();
    if (lv <= 0) return { ok: false, msg: '需先建造酒馆' };
    var s = GAME.state;
    var cost = GAME.innRefreshCost();
    if ((s.res.gold || 0) < cost) return { ok: false, msg: '旧币不足（需 ' + U.fmt(cost) + '）' };
    s.res.gold -= cost;
    GAME.innRefresh(true);
    return { ok: true, msg: '已另请一批贤士（-' + U.fmt(cost) + '金）' };
  };

  /* 招募（v89.188：「相亲」话术退役） */
  GAME.innRecruit = function (cid, cityId) {
    var s = GAME.state;
    /* v64：招贤以**酒馆所在城**为准 —— 名额按该城算、旧币从该城扣、人落在该城 */
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity();
    if (!city) return { ok: false, msg: '无城池可招贤' };
    var chk = GAME.canRecruitGeneral(city);
    if (!chk.ok) return chk;
    /* v89.108：按**这座城**取池（旧实现拿全局池 —— 主城的候选能在分城被招走） */
    var list = GAME.innRefresh(false, city);
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === cid) { idx = i; break; }
    if (idx < 0) return { ok: false, msg: '此人已离去，请刷新候选' };
    var cnd = list[idx];
    var R = GAME.res(city);
    if ((R.gold || 0) < cnd.cost) return { ok: false, msg: city.name + ' 旧币不足（需 ' + U.fmt(cnd.cost) + '）' };
    R.gold -= cnd.cost;
    var g = GAME.makeGeneral(cnd.name, cnd.level, 'idle', city.id, false, cnd.rank, cnd.style);
    g.tong = cnd.tong; g.nz = cnd.nz; g.yw = cnd.yw; g.zm = cnd.zm;
    g.avatar = cnd.avatar;
    g.loyalty = cnd.loyalty;
    g.hero = cnd.hero;
    g.beauty = cnd.beauty;
    s.generals.push(g);
    list.splice(idx, 1);
    var rkName = GAME.rankOf(g).name;
    GAME.statBump('recruited', 1);
    /* v89.188（老板 3）：招募话术全站统一（「相亲结缘 / 迎娶」退役；
       beauty 字段保留 —— 立绘性别与美人池仍在用，撤的只是「标识话术」）。 */
    GAME.log('招募成功：' + cnd.name + '（' + rkName + '）入我帐下。', 'sys', 'staff');
    return { ok: true, msg: '招募 ' + cnd.name + '·' + rkName + '（-' + U.fmt(cnd.cost) + '金）', gen: g };
  };

  /* ============================================================
   * 酒馆自动招募（v89.62 · 老板「增加自动招募按钮，可设置当酒馆刷新出什么
   *   品质的时候自动招募，直至达到招募站空位上限」）
   * ------------------------------------------------------------
   * 口径唯一：开关/门槛/执行三处都只读 `s.settings.innAuto`，界面只写这一个对象，
   *   不另存第二份状态（本项目最经典的失效模式就是"同一件事存两份"）。
   * 执行时机 = **候选换批之后**（自动 5 分钟换批与"花金另请"都经过 GAME.innRefresh），
   *   所以在 innRefresh 生成新批后统一调一次 innAutoRun ——
   *   主循环里**不加轮询**，避免每帧扫全表。
   * 择优策略：达到门槛者里**资质最高**的先招；招到招募站满位 / 金不够 / 无合格者为止。
   *   循环带硬上限（64 次），任何异常都不会死循环。
   * ============================================================ */
  GAME.innAutoCfg = function () {
    var s = GAME.state;
    if (!s.settings) s.settings = {};
    if (!s.settings.innAuto) s.settings.innAuto = { on: false, min: 'liang' };
    return s.settings.innAuto;
  };
  /* 资质序号（"是否达到门槛"的比较口径）—— 直接用 DATA.GEN_RANKS 的既有顺序，不另立表 */
  GAME.rankIndex = function (id) {
    var idx = 0;
    (DATA.GEN_RANKS || []).forEach(function (r, i) { if (r.id === id) idx = i; });
    return idx;
  };
  GAME.innAutoRun = function () {
    var s = GAME.state, c = GAME.innAutoCfg();
    if (!c.on) return { ok: false, n: 0, names: [] };
    var city = GAME.currentCity();
    if (!city || GAME.innLevel(city) <= 0) return { ok: false, n: 0, names: [] };
    var minIdx = GAME.rankIndex(c.min), n = 0, names = [];
    for (var guard = 0; guard < 64; guard++) {
      if (!GAME.canRecruitGeneral(city).ok) break;         /* 招募站满位 / 无空房 → 停 */
      var list = GAME.innRefresh(false, city) || [];       /* 命中缓存即返回同一批，不会重复换批（v89.108：按城取池） */
      var pick = null;
      for (var i = 0; i < list.length; i++) {
        var cd = list[i];
        if (GAME.rankIndex(cd.rank) < minIdx) continue;              /* 未达门槛 */
        if ((GAME.res(city).gold || 0) < cd.cost) continue;          /* 金不够 */
        if (!pick || GAME.rankIndex(cd.rank) > GAME.rankIndex(pick.rank)) pick = cd;
      }
      if (!pick) break;
      var r = GAME.innRecruit(pick.id, city.id);
      if (!r.ok) break;
      n++; names.push(pick.name);
    }
    if (n > 0) GAME.log('自动招募：' + names.join('、') + '（共 ' + n + ' 人）', 'sys', 'staff');
    return { ok: n > 0, n: n, names: names };
  };
  GAME.innAutoToggle = function () {
    var c = GAME.innAutoCfg();
    c.on = !c.on;
    var n = 0;
    if (c.on) n = GAME.innAutoRun().n || 0;      /* 刚打开就先过一遍现有候选，别等下一批 */
    var rk = (DATA.GEN_RANK_BY_ID[c.min] || {}).name || '';
    return {
      ok: true, on: c.on, n: n,
      msg: c.on ? ('自动招募已开启（' + rk + '及以上）' + (n ? '　本次招得 ' + n + ' 人' : '')) : '自动招募已关闭',
    };
  };
  GAME.innAutoMinSet = function (id) {
    if (!DATA.GEN_RANK_BY_ID[id]) return { ok: false, msg: '无此资质' };
    var c = GAME.innAutoCfg();
    c.min = id;
    var n = c.on ? (GAME.innAutoRun().n || 0) : 0;   /* 调低门槛时立刻按新门槛过一遍 */
    return {
      ok: true, msg: '自动招募门槛：' + DATA.GEN_RANK_BY_ID[id].name + '及以上' + (n ? '　本次招得 ' + n + ' 人' : ''),
    };
  };

  /* ============================================================
   * 交易站：资源互换（需交易站等级，有折损）
   * ============================================================ */
  var TRADE_RES = ['grain', 'wood', 'stone', 'iron'];
  GAME.marketRate = function () {
    var lv = GAME.marketLevel();
    if (lv <= 0) return 0.6;
    /* v28（需求 1）：交易站建筑专精 —— 交易折损再 −10 个百分点 */
    var mb = GAME.mastery ? GAME.mastery('caravanPct', null) : 0;
    return Math.min(0.98, 0.6 + lv * 0.035 + mb);
  };
  GAME.marketTrade = function (from, to, amount) {
    var s = GAME.state;
    if (TRADE_RES.indexOf(from) < 0 || TRADE_RES.indexOf(to) < 0 || from === to) {
      return { ok: false, msg: '交易资源有误' };
    }
    /* v89.62：不再设"需先建造交易站"门槛 —— 无交易站也能交易，只是折损最大（见 marketLevel 注释） */
    amount = Math.floor(amount || 0);
    if (amount <= 0) return { ok: false, msg: '数量无效' };
    if ((s.res[from] || 0) < amount) return { ok: false, msg: '库存不足' };
    var gain = Math.floor(amount * GAME.marketRate());
    s.res[from] -= amount;
    s.res[to] = (s.res[to] || 0) + gain;
    GAME.statBump('trades', 1);
    GAME.log('市易：以 ' + U.fmt(amount) + ' 换得 ' + U.fmt(gain) + '。', 'sys', 'trade');
    return { ok: true, msg: '换得 ' + U.fmt(gain) + '（折损 ' + Math.round((1 - GAME.marketRate()) * 100) + '%）' };
  };

  /* ============================================================
   * 交易站售卖：资源 → 旧币（v89.48 · 老板「售卖资源换取旧币，比例 1:2:3:4」）
   * ------------------------------------------------------------
   * 口径全部读 DATA.MARKET_SELL（比例表 / 分母）+ DATA.GOLD_GATE.market（第四条旧币入口）。
   * **唯一出口**：单价、整单价、可卖上限都从 marketSellPer 派生 ——
   * 界面别自己再算一遍（本项目最经典的失效模式就是"算第二遍"）。
   * 比例恒为 1:2:3:4：结算系数对四类资源**同乘**，故老板要的"比例呈现"永远成立。
   * ============================================================ */
  GAME.marketSellCfg = function () { return DATA.MARKET_SELL || { res: [], ratio: {}, per: 20 }; };

  /* ============================================================
   * v89.95（A2/A3）：**物多价贱**的折价 + 通商券的免折额度 —— 唯一出口
   * ------------------------------------------------------------
   * · `s.mktSold = { day, gold }`：本游戏日已从交易站换走的旧币（懒初始化 + 隔日清零）；
   * · 乘数 = max(floor, 1 − 今日已换金 / scale)；
   * · 通商券（`s.buffs.mktFree = { until, quota, used }`）在有效期内把乘数抬回 1
   *   （但额度用完即止）——这就是"通商通道"。
   * ⚠️ 界面/推演/测试一律读这两个出口，不许自己按 day 算一遍。
   * ============================================================ */
  GAME.mktSlipCfg = function () { return DATA.MARKET_SLIP || { scale: 200000, floor: 0.1 }; };
  GAME.mktSlipOf = function () {
    var s0 = GAME.state;
    var c = GAME.mktSlipCfg();
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    if (!s0) return { sold: 0, mul: 1, day: day, free: 0 };
    if (!s0.mktSold || s0.mktSold.day !== day) s0.mktSold = { day: day, gold: 0 };
    var sold = s0.mktSold.gold || 0;
    var mul = Math.max(c.floor == null ? 0.1 : c.floor, 1 - sold / (c.scale || 200000));
    return { sold: sold, mul: Math.min(1, mul), day: day, scale: c.scale || 200000,
      floor: c.floor == null ? 0.1 : c.floor };
  };
  /* 通商券免折额度（未生效 → null） */
  GAME.mktFreeOf = function () {
    var s0 = GAME.state, c = GAME.mktSlipCfg();
    var f = s0 && s0.buffs && s0.buffs.mktFree;
    if (!f) return null;
    if (!(f.until > U.now())) return null;
    var quota = f.quota == null ? ((c.free || {}).quota || 500000) : f.quota;
    var used = f.used || 0;
    if (used >= quota) return null;
    return { until: f.until, quota: quota, used: used, left: Math.max(0, quota - used) };
  };
  /* 结算用乘数：免折额度在手 → 1.0（额度内的销售不打折） */
  GAME.mktMulNow = function () {
    return GAME.mktFreeOf() ? 1 : GAME.mktSlipOf().mul;
  };
  /* 记账：卖出后累加"今日已换金"与"免折额度已用" */
  GAME.mktSlipRecord = function (gold) {
    var s0 = GAME.state;
    if (!s0) return;
    var st = GAME.mktSlipOf();                 /* 顺带完成懒初始化/隔日清零 */
    s0.mktSold.gold = (s0.mktSold.gold || 0) + Math.max(0, gold || 0);
    var f = s0.buffs && s0.buffs.mktFree;
    if (f && f.until > U.now()) f.used = (f.used || 0) + Math.max(0, gold || 0);
  };
  /* 一句话状态（界面/日志共用） */
  GAME.mktSlipText = function () {
    var st = GAME.mktSlipOf();
    var fr = GAME.mktFreeOf();
    var base = '今日已售 ' + U.fmt(st.sold) + ' 金 · 汇率 ×' + st.mul.toFixed(2)
      + (st.mul <= st.floor + 1e-9 ? '（已到底价：物多价贱，再卖无利可图）' : '');
    return fr ? (base + '　·　通商券免折额度余 ' + U.fmt(fr.left)) : base;
  };
  /* 单价（金 / 单位，未取整）—— 仅用于展示与门槛计算 */
  GAME.marketSellPer = function (res) {
    var c = GAME.marketSellCfg();
    var k = (c.ratio && c.ratio[res]) || 0;
    if (!k || !c.per) return 0;
    var gate = (DATA.GOLD_GATE && DATA.GOLD_GATE.market != null) ? DATA.GOLD_GATE.market : 1;
    /* v89.95（A2）：再乘"物多价贱"的当日折价（通商券在手时按 1.0 结算） */
    return k / c.per * GAME.marketRate() * gate * GAME.mktMulNow();
  };
  /* 整单售价（金，向下取整）—— 结算与「预计可得」共用此出口 */
  GAME.marketSellGold = function (res, amount) {
    var per = GAME.marketSellPer(res);
    if (!per) return 0;
    return Math.floor(Math.floor(amount || 0) * per);
  };
  /* 保底门槛：至少要卖多少单位才够换到 1 旧币（避免出现"卖了半天得 0 旧币"） */
  GAME.marketSellMin = function (res) {
    var per = GAME.marketSellPer(res);
    if (!per) return 0;
    return Math.max(1, Math.ceil(1 / per));
  };
  GAME.marketSell = function (res, amount) {
    var s = GAME.state, c = GAME.marketSellCfg();
    if ((c.res || []).indexOf(res) < 0) return { ok: false, msg: '此物不可售卖' };
    /* v89.62：不再设"需先建造交易站"门槛 —— 无交易站也能交易，只是折损最大（见 marketLevel 注释） */
    amount = Math.floor(amount || 0);
    if (amount <= 0) return { ok: false, msg: '数量无效' };
    if ((s.res[res] || 0) < amount) return { ok: false, msg: '库存不足' };
    var gold = GAME.marketSellGold(res, amount);
    if (gold < 1) return { ok: false, msg: '数量太少 —— 至少 ' + U.fmt(GAME.marketSellMin(res)) + ' 单位才够换 1 旧币' };
    s.res[res] -= amount;
    s.res.gold = (s.res.gold || 0) + gold;
    GAME.mktSlipRecord(gold);                  /* v89.95：物多价贱 —— 记账（通商券额度一并扣） */
    GAME.statBump('trades', 1);
    GAME.log('市易：售出 ' + U.fmt(amount) + ' 得金 ' + U.fmt(gold) + '。' + GAME.mktSlipText(), 'sys', 'trade');
    return { ok: true, msg: '售出 ' + U.fmt(amount) + ' 得金 ' + U.fmt(gold), gold: gold };
  };

  /* ============================================================
   * 交易站买入：金 → 资源（v89.59 · 老板「金换物资存在比例损耗，交易站只应急」）
   * ------------------------------------------------------------
   * 唯一出口：单位数 / 门槛 / 成交都从这里派生（界面别自己再算一遍）。
   * 买入比卖出贵（×（1 − loss））—— 这是老板要的"比例损耗"。
   * ============================================================ */
  GAME.marketBuyCfg = function () { return DATA.MARKET_BUY || { res: [], ratio: {}, per: 20, loss: 0.35 }; };
  /* 1 旧币可换多少单位（含比例损耗；交易站等级越高越划算） */
  GAME.marketBuyPerGold = function (res) {
    var c = GAME.marketBuyCfg();
    var k = (c.ratio && c.ratio[res]) || 0;
    if (!k || !c.per) return 0;
    return (c.per / k) * GAME.marketRate() * (1 - (c.loss || 0));
  };
  GAME.marketBuyUnits = function (res, gold) {
    var per = GAME.marketBuyPerGold(res);
    if (!per) return 0;
    return Math.floor(Math.floor(gold || 0) * per);
  };
  /* 保底门槛：至少要花多少金才够换到 1 单位 */
  GAME.marketBuyMin = function (res) {
    var per = GAME.marketBuyPerGold(res);
    if (!per) return 0;
    return Math.max(1, Math.ceil(1 / per));
  };
  /* 反向口径（v89.60 老板「4 资源 + 旧币可买卖」）：
     买 N 单位要花多少金 —— 界面只说"买多少单位"，单位 → 金的换算仍由这里派生
     （保证 marketBuy(res, 本值) 得货 ≥ N）。**界面别自己 ceil 一遍**：
     算第二遍 = 本项目最经典的失效模式。 */
  GAME.marketBuyGoldFor = function (res, units) {
    var per = GAME.marketBuyPerGold(res);
    if (!per) return 0;
    units = Math.floor(units || 0);
    if (units <= 0) return 0;
    return Math.max(GAME.marketBuyMin(res), Math.ceil(units / per));
  };
  GAME.marketBuy = function (res, gold) {
    var s = GAME.state, c = GAME.marketBuyCfg();
    if ((c.res || []).indexOf(res) < 0) return { ok: false, msg: '此物不可买入' };
    /* v89.62：不再设"需先建造交易站"门槛 —— 无交易站也能交易，只是折损最大（见 marketLevel 注释） */
    gold = Math.floor(gold || 0);
    if (gold <= 0) return { ok: false, msg: '数量无效' };
    if ((s.res.gold || 0) < gold) return { ok: false, msg: '旧币不足' };
    var gain = GAME.marketBuyUnits(res, gold);
    if (gain < 1) return { ok: false, msg: '金太少 —— 至少 ' + U.fmt(GAME.marketBuyMin(res)) + ' 金才够换 1 单位' };
    s.res.gold -= gold;
    s.res[res] = (s.res[res] || 0) + gain;
    GAME.statBump('trades', 1);
    GAME.log('市易：以金 ' + U.fmt(gold) + ' 购入 ' + U.fmt(res) + ' ' + U.fmt(gain) + '。', 'sys', 'trade');
    return { ok: true, msg: '购得 ' + U.fmt(gain) + '（折损 ' + Math.round((c.loss || 0) * 100) + '%）' };
  };


  /* ============================================================
   * 辖区特产 & 名城岁贡（v14）
   * 按**现实日**结算的持续收益 —— 占城不再只有一次性战利品。
   *   · 辖区特产：与地理绑定，占该辖区内城池即产该区独有材料
   *   · 岁贡：按城档位给 旧币 / 声望 / 特产材料
   *   · 首府加成：握有该区首府（烬环以旧都为治）时，本区特产 ×1.5
   * 目的：解开「三/四阶材料只在首府(12)/旧都(1) 一次掉落后占完即断供」的断层，
   *       让「打哪里」直接决定「能造什么装备」。
   * ============================================================ */
  /* 城池区属：显式字段优先；玩家自建城按坐标就近认领最近的首府/旧都 */
  GAME.stateOfCity = function (city) {
    if (!city) return null;
    if (city.state) return city.state;
    var best = null, bd = 1e9;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type !== 'zhou' && c.type !== 'capital') return;
      var d = Math.abs(c.x - (city.x || 0)) + Math.abs(c.y - (city.y || 0));
      if (d < bd) { bd = d; best = c; }
    });
    return best ? best.state : null;
  };
  /* ============================================================
   * 行政区划「区 · 镇 · 聚落」—— 唯一出口（v70 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「每个名城按「区 · 重镇 · 聚落」标识（假设：盐岸区 · 霜堡 · 冰垒）……
   *   其他野地城池的标识应写上其所在聚落」
   *
   * 判据 = **就近归属**（确定性，无随机）：
   *   · 聚落档 = 最近的**聚落**（65 座聚落铺满全图，任何坐标都归一个聚落）；
   *   · 镇档 = 该聚落**本区内**最近的重镇（重镇的从属不随问询点漂移 —— 用聚落的坐标算）；
   *   · 区档 = 该聚落数据里写死的 state。
   * 两个坐标落在同一个聚落 → 永远同一结果，可断言、可缓存。
   * ============================================================ */
  GAME.regionOf = function (x, y) {
    var best = null, bd = Infinity;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type !== 'county') return;
      var d = Math.abs(c.x - x) + Math.abs(c.y - y);
      if (d < bd) { bd = d; best = c; }
    });
    if (!best) return null;
    var jun = null, jd = Infinity;
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type !== 'jun' || c.state !== best.state) return;
      var d = Math.abs(c.x - best.x) + Math.abs(c.y - best.y);
      if (d < jd) { jd = d; jun = c; }
    });
    return {
      state: best.state, county: best.name, countyCity: best,
      jun: jun ? jun.name : null, junCity: jun,
    };
  };
  /* ⛔ v89.219：行政后缀（郡/县）随机构词退役 —— 架空城名自带辨识度（霜堡 / 冰垒），
     全称 = 「区 · [重镇 ·] 城名」，不再补后缀。
     两个出口**保留为规范化出口**（原样返回）：城名 / 全称 / 产地标签全走它们 ——
     将来若要再规范化（如统一加后缀），只改这里一处。 */
  GAME.junNameOf = function (raw) {
    return String(raw == null ? '' : raw);
  };
  GAME.countyNameOf = function (raw) {
    return String(raw == null ? '' : raw);
  };
  /* 城池全称（区 · 镇 · 城名 链）。名城三级齐备；自建城给「区 · 城名」；
     改过名的城用 origName 顶**行政层**（地名不随主公改名而变，参照 v45 的 origName 约定）。 */
  GAME.cityFullName = function (city) {
    if (!city) return '';
    var st = city.state || GAME.stateOfCity(city);
    var renamed = !!(city.origName && city.origName !== city.name);
    var parts = [];
    if (st) parts.push(st);
    /* 聚落：行政链到「镇」为止（聚落本身是末段的"名字"那一层） */
    if (city.type === 'county') {
      var rg = GAME.regionOf(city.x, city.y);
      if (rg && rg.jun) parts.push(GAME.junNameOf(rg.jun));
    }
    /* 末段 = 这座城的名字：
       未改名 → 走规范化出口（v89.219：行政后缀退役 · 原样返回）；
       改过名 → **原样**用玩家起的名字（改名也必须立刻反映在侧栏 / 城池面板上 ——
       e2e 的「侧栏城池名同步」盯着这条）。 */
    var name = city.name;
    if (!renamed) {
      if (city.type === 'jun') name = GAME.junNameOf(name);
      else if (city.type === 'county') name = GAME.countyNameOf(name);
    }
    parts.push(name);
    return parts.join(' · ');
  };
  /* 野外城池的标识（v70 老板「标识应写上其所在聚落」）：`芦塘 · 青石营` */
  GAME.fortLabelOf = function (fort) {
    if (!fort) return '';
    var rg = GAME.regionOf(fort.x, fort.y);
    return (rg && rg.county ? GAME.countyNameOf(rg.county) + ' · ' : '') + fort.name;
  };

  /* ============================================================
   * v89.94（B2 · E1 围攻战）：据点/聚落的**守备值** —— 唯一出口五件套
   * ------------------------------------------------------------
   * 存储：`s.sieges['f:x,y' | 'c:城id'] = { hold: 0~100, waves, day }`（懒初始化，随档走）。
   * 读＝算（按日恢复只发生在读取时 —— 不需要定时器，也不会随存档膨胀：
   * 同一格只有一行，攻下即清、恢复满即删）。
   * ⚠️ 全部上层（战斗 / 界面 / 探针）只读这五个出口，不许各自摸 s.sieges。
   * ============================================================ */
  GAME.siegeScopeOf = function (t) {
    if (!t) return false;
    var scope = (DATA.SIEGE && DATA.SIEGE.scope) || ['fort', 'county'];
    if (t.kind === 'fort') return scope.indexOf('fort') >= 0;
    if (t.kind === 'city' && t.cityType) return scope.indexOf(t.cityType) >= 0;
    return false;
  };
  GAME.siegeKeyOf = function (t) {
    if (!t) return '';
    if (t.kind === 'city') return 'c:' + ((t.npc && t.npc.id) || t.id || (t.x + ',' + t.y));
    return 'f:' + t.x + ',' + t.y;
  };
  GAME.siegeDayIdx = function () {
    return GAME.questDayIndex ? GAME.questDayIndex() : 0;
  };
  /* 读守备状态（含**按日恢复**）：整日未攻 → 恢复 repairPerDay/日；满 100 直接清档 */
  GAME.siegeStateOf = function (t) {
    var s = GAME.state;
    if (!s || !GAME.siegeScopeOf(t)) return null;
    s.sieges = s.sieges || {};
    var key = GAME.siegeKeyOf(t);
    var day = GAME.siegeDayIdx();
    var st = s.sieges[key];
    if (!st) return { key: key, hold: 100, waves: 0, day: day, fresh: true };
    var rep = ((DATA.SIEGE || {}).repairPerDay || 0) * Math.max(0, day - (st.day == null ? day : st.day));
    if (rep > 0) {
      st.hold = Math.min(100, (st.hold == null ? 100 : st.hold) + rep);
      st.day = day;
      if (st.hold >= 100) {                       /* 恢复满 = 围解 → 不留空档 */
        delete s.sieges[key];
        return { key: key, hold: 100, waves: st.waves || 0, day: day, fresh: true };
      }
    }
    return st;
  };
  GAME.siegeHoldOf = function (t) {
    var st = GAME.siegeStateOf(t);
    return st ? st.hold : 100;
  };
  /* 守备 → 战斗入参缩放（**纯函数**：只吃 hold，不碰状态）——
     探针 / 测试 / 离线推演都读它，公式只有这一份（抄第二份必漂移，本轮实测踩过）。
     守军 / 城防随破防同步衰减，保底见 DATA.SIEGE 的 defScale / defThr。 */
  GAME.siegeScaleAt = function (hold) {
    var cfg = DATA.SIEGE || {};
    var h = (hold == null ? 100 : hold);
    var f = Math.max(0, Math.min(1, h / 100));
    var gs = cfg.defScale == null ? 0.35 : cfg.defScale;
    var dt = cfg.defThr == null ? 0.30 : cfg.defThr;
    return { hold: h, holdF: f,
      garrison: gs + (1 - gs) * f,      /* 守军缩放：守备 0% → defScale */
      def: dt + (1 - dt) * f };         /* 城防缩放：守备 0% → defThr */
  };
  GAME.siegeScaleOf = function (t) {
    var st = GAME.siegeStateOf(t);
    return GAME.siegeScaleAt(st ? (st.hold == null ? 100 : st.hold) : 100);
  };
  /* v89.204（老板 1）：单场**获胜**推进的民心（固定 heartsLoss=20）。
     旧「chipBase × 战力比 夹在 [chipMin, chipMax]」的动态口径随本轮退役 ——
     参数保留（签名兼容，不再读 ratio）；战败/撤退不调用本出口（见 battle.js 围攻段）。 */
  GAME.siegeChipOf = function () {
    var cfg = DATA.SIEGE || {};
    var v = cfg.heartsLoss == null ? 20 : cfg.heartsLoss;
    return Math.max(1, Math.min(100, Math.round(v)));
  };
  /* 落账：扣守备、记波次。返回 { hold, waves, broke }（broke = 守备归零，下一胜即可下城） */
  GAME.siegeChipApply = function (t, chip) {
    if (!GAME.siegeScopeOf(t)) return null;
    var s = GAME.state;
    s.sieges = s.sieges || {};
    var key = GAME.siegeKeyOf(t);
    var day = GAME.siegeDayIdx();
    var rec = s.sieges[key] || { hold: 100, waves: 0, day: day };
    /* 先补结算"隔日恢复"（与 siegeStateOf 同一口径，避免跳过恢复直接打折） */
    var rep = ((DATA.SIEGE || {}).repairPerDay || 0) * Math.max(0, day - (rec.day == null ? day : rec.day));
    rec.hold = Math.min(100, (rec.hold == null ? 100 : rec.hold) + rep);
    var chipUse = Math.max(0, Math.round(chip || 0));
    rec.hold = Math.max(0, rec.hold - chipUse);
    rec.waves = (rec.waves || 0) + 1;
    rec.day = day;
    s.sieges[key] = rec;
    return { key: key, hold: rec.hold, waves: rec.waves, broke: rec.hold <= 0, chip: chipUse };
  };
  /* 攻下 / 目标消失：清掉围攻档（不留孤儿行） */
  GAME.siegeClear = function (t) {
    var s = GAME.state;
    if (!s || !s.sieges || !GAME.siegeScopeOf(t)) return;
    delete s.sieges[GAME.siegeKeyOf(t)];
  };
  /* 一句话状态（界面/日志共用，不许各拼一遍） */
  GAME.siegeTextOf = function (t) {
    var st = GAME.siegeStateOf(t);
    if (!st) return '';
    var cfg = DATA.SIEGE || {};
    return '民心 ' + Math.round(st.hold) + '%'
      + (st.waves ? '（已围攻 ' + st.waves + ' 波）' : '（未动干戈）')
      + ' · 每整日恢复 ' + (cfg.repairPerDay || 0) + '%';
  };

  /* ============================================================
   * ⛔ v89.198（老板「清除战法这个玩法」）：opsIdOf / opsOf / opsConfigIssueOf
   *   三个出口随玩法全撤退役 —— 沿革与去向见 js/data.js 的 DATA.OPS 墓碑。
   * ============================================================ */

  GAME.specialtyOf = function (city) {
    var st = GAME.stateOfCity(city);
    return st ? (DATA.STATE_SPECIALTY[st] || null) : null;
  };
  /* 该区首府是否已在我手中（烬环以旧都灰烬城为治） */
  GAME.hasStateSeat = function (stateName) {
    var s = GAME.state, has = false;
    if (!stateName) return false;
    ((s && s.cities) || []).forEach(function (c) {
      if (has) return;
      if (c.type !== 'zhou' && c.type !== 'capital') return;
      if (GAME.stateOfCity(c) === stateName) has = true;
    });
    return has;
  };
  /* 单城每日岁贡：{ gold, rep, mat, qty, seat }；自建城返回 null（靠外城地块与税收） */
  GAME.cityDailyYield = function (city) {
    if (!city) return null;
    var y = (DATA.CITY_YIELD || {})[city.type];
    if (!y) return null;
    var sp = GAME.specialtyOf(city);
    var seat = sp ? GAME.hasStateSeat(GAME.stateOfCity(city)) : false;
    var mul = seat ? (DATA.STATE_SEAT_BONUS || 1) : 1;
    return {
      /* v73（老板「限制旧币的获取」）：岁贡旧币走 DATA.GOLD_GATE.yield ——
         展示（政务厅面板）与结算（settleDailyYield）共用这一出口，不会两本账。 */
      gold: Math.round(y.gold * (DATA.GOLD_GATE.yield || 1)), rep: y.rep,
      mat: sp ? sp.mat : null,
      qty: sp ? [Math.round(y.matQty[0] * mul), Math.round(y.matQty[1] * mul)] : null,
      seat: seat,
    };
  };
  /* 全境每日岁贡汇总（UI 展示与结算共用；材料按区间中值估算） */
  GAME.dailyYieldSummary = function () {
    var s = GAME.state;
    var out = { gold: 0, rep: 0, mats: {}, cities: 0, byState: {}, seats: [] };
    ((s && s.cities) || []).forEach(function (c) {
      var d = GAME.cityDailyYield(c);
      if (!d) return;
      out.cities++;
      out.gold += d.gold;
      out.rep += d.rep;
      var st = GAME.stateOfCity(c);
      if (d.mat) {
        out.mats[d.mat] = (out.mats[d.mat] || 0) + Math.round((d.qty[0] + d.qty[1]) / 2);
        out.byState[st] = out.byState[st] || { mat: d.mat, tier: d.tier, count: 0, seat: false };
        out.byState[st].count++;
        if (d.seat) out.byState[st].seat = true;
      }
    });
    for (var k in out.byState) if (out.byState[k].seat) out.seats.push(k);
    return out;
  };
  /* 按现实日结算（主循环与离线补算均调用；同日只结一次） */
  GAME.settleDailyYield = function () {
    var s = GAME.state;
    if (!s) return null;
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    if (s.yieldDay == null) { s.yieldDay = today; return null; }   // 首日只登记，不发贡
    var days = today - s.yieldDay;
    if (days <= 0) return null;
    var capped = Math.min(days, DATA.YIELD_MAX_DAYS || 30);
    var gold = 0, rep = 0, mats = {};
    for (var d = 0; d < capped; d++) {
      (s.cities || []).forEach(function (c) {
        var y = GAME.cityDailyYield(c);
        if (!y) return;
        gold += y.gold; rep += y.rep;
        if (y.mat) {
          var n = y.qty[0] + Math.floor(Math.random() * (y.qty[1] - y.qty[0] + 1));
          mats[y.mat] = (mats[y.mat] || 0) + n;
        }
      });
    }
    /* 岁贡旧币是货币，不受货仓上限约束 */
    s.res.gold = (s.res.gold || 0) + gold;
    /* 声望（受赛季国策「人心思附」加成） */
    rep = Math.round(rep * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1));
    s.rep = (s.rep || 0) + rep;
    s.items = s.items || {};
    var got = [];
    for (var mid in mats) {
      s.items[mid] = (s.items[mid] || 0) + mats[mid];
      got.push((DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid) + '×' + mats[mid]);
    }
    s.yieldDay = today;
    var head = '岁贡入府（' + (days > capped ? '离线 ' + days + ' 日，计 ' + capped + ' 日' : days + ' 日') + '）';
    GAME.log(head + '：金 +' + U.fmt(gold) + '、声望 +' + U.fmt(rep) + (got.length ? '、' + got.join('、') : ''));
    return { days: days, capped: capped, gold: gold, rep: rep, mats: mats, got: got };
  };
  /* ============================================================
   * 英雄月俸（v77 · 老板「经过 7 个游戏日结算 1 次」）
   * ------------------------------------------------------------
   * 定价：GAME.genSalaryOf（展示与结算唯一出口）；
   * 结算：GAME.settleGenSalary —— 锚点 world.elapsed（游戏秒），
   *   离线跨期一次结清（上限 DATA.GEN_SALARY.maxPeriods 期，防长挂扣穿）。
   * 扣款：从**各将所在城**的府库扣（与旧的逐秒扣款同一路径，只是改成月结）。
   * 缺金：扣到 0 为止，余数记欠俸（进讯息；不损忠诚 —— v14.1 拍板
   *   「忠诚只在出征战败时下降」，欠俸只警示不惩罚）。
   * ============================================================ */
  GAME.genSalaryOf = function (g) {
    if (!g) return 0;
    if (g.isLord || (GAME.isLordGeneral && GAME.isLordGeneral(g))) return 0;  // 君主不领俸
    var C = DATA.GEN_SALARY || {};
    var sum = (g.tong || 0) + (g.nz || 0) + (g.yw || 0) + (g.zm || 0);
    var v = (C.base || 0) + (g.level || 1) * (C.perLevel || 0) + sum * (C.perAttr || 0);
    var mul = (C.rankMul && C.rankMul[g.rank]) || 1;
    /* v89.194（老板）：「城主、守将月俸*1.5」——在任城主/守将乘数（唯一出口）。 */
    var dutyMul = (g.status === 'mayor' || g.status === 'guard')
      ? (C.dutyMul == null ? 1.5 : C.dutyMul) : 1;
    return Math.round(v * mul * dutyMul);
  };
  /* 全境月俸合计（每期）—— 君主面板 / 侧栏悬停读它 */
  GAME.genSalaryTotal = function () {
    var s = GAME.state, t = 0;
    ((s && s.generals) || []).forEach(function (g) { t += GAME.genSalaryOf(g); });
    return t;
  };
  GAME.settleGenSalary = function () {
    var s = GAME.state;
    if (!s || !s.world) return null;
    var C = DATA.GEN_SALARY || {};
    var period = (C.periodDays || 7) * 86400;
    if (!period) return null;
    if (s.salaryAt == null) { s.salaryAt = s.world.elapsed || 0; return null; }   // 旧档只登记锚点
    var due = Math.floor(((s.world.elapsed || 0) - s.salaryAt) / period);
    if (due <= 0) return null;
    var capped = Math.min(due, C.maxPeriods || 30);
    s.salaryAt = s.salaryAt + due * period;
    var paid = 0, short = 0, owed = [];    /* owed：欠俸的城（v89.194 忠诚扣减对象） */
    (s.cities || []).forEach(function (ct) {
      var per = 0;
      ((s.generals) || []).forEach(function (g) {
        if (g.cityId === ct.id) per += GAME.genSalaryOf(g);
      });
      if (!per) return;
      var amount = per * capped;
      var R = GAME.res(ct);
      var have = R.gold || 0;
      if (have >= amount) { R.gold = have - amount; paid += amount; }
      else { R.gold = 0; paid += have; short += amount - have; owed.push(ct); }
    });
    if (!paid && !short) return { periods: capped, paid: 0, short: 0 };
    var line = '💰 英雄月俸结算（' + capped + ' 期）：金 −' + U.fmt(paid);
    if (short > 0) line += '；⚠️ 府库不足，欠俸 ' + U.fmt(short) + ' 金';
    GAME.log(line);
    /* v89.194（老板 S4）：「欠俸降低忠诚度，忠诚度为 0 时英雄无法出征」——
       口径反转（v14.1「欠俸只警示不惩罚」→ 有一害）。扣减对象 = **欠俸城**的全部英雄；
       量 = min(salaryDrop × 期数, salaryDropMax)；君主豁免（v89.40 同源）；
       归零后出征闸由 marchBlockOf 兜底（界面置灰 + 硬拦同读一个出口）；
       唯一恢复 = 珠宝赏赐（gen-gift / 赏赐忠诚 +5~+36）。 */
    var drop194 = 0;
    var L194 = DATA.LOYALTY || {};
    if (short > 0 && (L194.salaryDrop || 0) > 0) {
      drop194 = Math.min((L194.salaryDrop || 0) * capped,
        L194.salaryDropMax == null ? 20 : L194.salaryDropMax);
      var hit194 = 0;
      owed.forEach(function (ct) {
        ((s.generals) || []).forEach(function (g) {
          if (g.cityId !== ct.id) return;
          if (GAME.isLordGeneral && GAME.isLordGeneral(g)) return;   /* 君主不扣（v89.40 同源） */
          var cur194 = g.loyalty == null ? 70 : g.loyalty;
          g.loyalty = Math.max(0, cur194 - drop194);
          hit194++;
        });
      });
      if (hit194) {
        GAME.log('⚠️ 欠俸挫伤军心（' + owed.length + ' 城 · ' + hit194 + ' 将）：忠诚 −' + drop194
          + '（赏赐珠宝可安抚）', 'sys', 'staff');
      }
    }
    return { periods: capped, paid: paid, short: short, drop: drop194 };
  };

  /* ============================================================
   * v89.194（老板 S3）：**陈列馆**（收藏 · v89.227 更名，原名「藏珍阁」）—— 出口组
   * ------------------------------------------------------------
   * 数据：DATA.COLLECT.series[].items[]；状态 `s.collect = { 藏品id: 1 }`（随档）。
   *   · collectItemOf(id)        藏品定义（回填 seriesId / seriesName / icon）
   *   · collectHaveOf(id)        是否已入藏
   *   · collectSeriesDoneOf(sid) { have, total, done, rep, name }
   *   · collectStatOf()          全库 { have, total, seriesDone, seriesTotal }
   *   · collectBuy(itemId)       购买**唯一出口**（金池扣款 · 幂等 · 集齐奖声望 · 日志）
   *   · collectBuySeries(sid)    整系列一键集齐（预检总价 → 逐件走 collectBuy，同一出口）
   * 金价 = 数据表 price（**直接金价**，不走游商 ×100 体系）；金走唯一池（全境通用）。
   * 集齐奖励 = series[].rep（声望：威望门槛与任务都读它）；全 18 系集齐另给 allRep
   * （幂等标记 s.collectAllBonus —— 与各系列奖励分账，不重复发放）。
   * ============================================================ */
  /* ============================================================
   * v89.196（老板 7）：陈列馆改**成就型** —— 「完成特定任务后可获得，
   *   但必须再花旧币激活」。
   * ------------------------------------------------------------
   * 两段式：① **解锁**（条件达成，实时判定、不存档）
   *         ② **激活**（花旧币 = 原 price → 入藏，仍是 s.collect 一份状态）。
   * 条件池：COLLECT_COND_TYPES（类型 → 显示名/单位）；取值唯一出口
   *   `collectCondValOf(type)`；件级展开唯一出口 `collectCondOf(itemId)`
   *   （系列级模板 cond { type, base, step }，件 n = base + step×件序；
   *     件级 `items[i].cond` 可覆盖模板）。
   * 全部取值来自**单调累计**（stats 计数 / 幂等计数）或**历史最高**（v89.202 起统一
   *   走 collectPeakOf）—— 达到过即永久解锁：数值回落（材料用掉 / 英雄解雇 /
   *   前哨放手 / 政务厅改建）不会让已解锁的藏品重新上锁。
   * ============================================================ */
  GAME.COLLECT_COND_TYPES = {
    win: { name: '战斗胜场', unit: '场' },
    conquer: { name: '攻占告捷', unit: '次' },
    wild: { name: '占领野地', unit: '次' },
    gather: { name: '采集完成', unit: '次' },
    scout: { name: '侦察归来', unit: '次' },
    fort: { name: '设立前哨', unit: '处' },
    rank: { name: '威望等级', unit: '级' },
    lordLv: { name: '君主等级', unit: '级' },
    bldg: { name: '政务厅等级', unit: '级' },
    rep: { name: '声望', unit: '' },
    itemKind: { name: '藏品种类', unit: '种' },
    recruited: { name: '招募英雄', unit: '名' },
    trades: { name: '市易成交', unit: '次' },
    forged: { name: '打造装备', unit: '件' },
    trained: { name: '练兵总数', unit: '名' },
    buildDone: { name: '建成建筑', unit: '座' },
  };
  /* v89.202（老板 3「按建议进行」· 达到过即永久解锁）：
     取值统一走**历史最高**（collectPeakOf）——条件达成过就不会因数值回落而重新锁上
     （如：材料品种被消耗、英雄被解雇、前哨被放手、政务厅被改建）。
     读即记录（惰性）；主循环另挂 collectPeakSweep（10 游戏秒节流）扫掠。 */
  GAME.collectCondValOf = function (type) {
    var s = GAME.state;
    if (!s) return 0;
    var cur = 0;
    switch (type) {
      case 'win': cur = GAME.stat('wins'); break;
      case 'conquer': cur = GAME.stat('conquer'); break;
      case 'wild': cur = GAME.stat('wilds'); break;
      case 'gather': cur = GAME.stat('gathers'); break;
      case 'scout': cur = GAME.stat('scouts'); break;
      case 'fort': cur = GAME.stat('forts'); break;
      case 'rank': cur = (s.rank || 0); break;
      case 'lordLv': var lg = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null; cur = lg ? (lg.level || 1) : 0; break;
      case 'bldg': cur = GAME.questMetric ? GAME.questMetric('bldLevel', 'guanfu') : 0; break;
      case 'rep': cur = (s.rep || 0); break;
      case 'itemKind': cur = Object.keys(s.items || {}).length; break;
      case 'recruited': cur = GAME.stat('recruited'); break;
      case 'trades': cur = GAME.stat('trades'); break;
      case 'forged': cur = GAME.stat('forgedCount'); break;
      case 'trained': cur = GAME.stat('trained'); break;
      case 'buildDone': cur = GAME.stat('buildDone'); break;
    }
    return GAME.collectPeakOf(type, cur);
  };
  /* v89.202：峰值记录（随档 s.collectPeak）——读到更高值即写回；返回"历史最高"。 */
  GAME.collectPeakOf = function (type, cur) {
    var s = GAME.state;
    if (!s || !type) return cur || 0;
    cur = cur || 0;
    s.collectPeak = s.collectPeak || {};
    if (cur > (s.collectPeak[type] || 0)) s.collectPeak[type] = cur;
    return s.collectPeak[type] || 0;
  };
  /* v89.202：扫掠出口（tickOnce 每 10 游戏秒一次）——玩家不打开收藏页也照记峰值。
     force=true 无视节流（测试/探针用）。 */
  GAME.collectPeakSweep = function (force) {
    var s = GAME.state;
    if (!s) return;
    var now = (s.world && s.world.elapsed) || 0;
    if (!force && now - (s.collectPeakAt || 0) < 10) return;
    s.collectPeakAt = now;
    for (var k in GAME.COLLECT_COND_TYPES) GAME.collectCondValOf(k);
  };
  GAME.collectCondOf = function (itemId) {
    var it = GAME.collectItemOf(itemId);
    if (!it) return null;
    var sr = null;
    ((DATA.COLLECT || {}).series || []).forEach(function (x) { if (x.id === it.seriesId) sr = x; });
    var cond = (it.cond || (sr && sr.cond)) || null;
    if (!cond || !cond.type) return null;
    var n = cond.n;
    if (n == null && sr) {
      var idx = -1;
      (sr.items || []).forEach(function (x, i) { if (x.id === itemId) idx = i; });
      n = (cond.base || 1) + Math.max(0, idx) * (cond.step || 0);
    }
    var meta = GAME.COLLECT_COND_TYPES[cond.type] || { name: cond.type, unit: '' };
    var cur = GAME.collectCondValOf(cond.type);
    return {
      type: cond.type, n: n, cur: cur, met: cur >= n,
      name: meta.name, unit: meta.unit,
      text: meta.name + ' ≥ ' + GAME.utils.fmt(n) + (meta.unit ? ' ' + meta.unit : ''),
    };
  };
  GAME.collectCondMetOf = function (itemId) {
    var cd = GAME.collectCondOf(itemId);
    return !cd || cd.met;                 /* 无条件的藏品（老档/扩展）一律视为已解锁 */
  };
  GAME.collectItemOf = function (id) {
    var C = DATA.COLLECT || {};
    var out = null;
    (C.series || []).forEach(function (sr) {
      (sr.items || []).forEach(function (it) {
        if (it.id === id) out = { id: it.id, name: it.name, sub: it.sub || '', price: it.price || 0,
          seriesId: sr.id, seriesName: sr.name, icon: sr.icon || '🏺' };
      });
    });
    return out;
  };
  GAME.collectHaveOf = function (id) {
    var s = GAME.state;
    return !!(s && s.collect && s.collect[id]);
  };
  GAME.collectSeriesDoneOf = function (sid) {
    var C = DATA.COLLECT || {};
    var sr = null;
    (C.series || []).forEach(function (x) { if (x.id === sid) sr = x; });
    if (!sr) return { have: 0, total: 0, done: false, rep: 0, name: '' };
    var have = 0, total = (sr.items || []).length;
    (sr.items || []).forEach(function (it) { if (GAME.collectHaveOf(it.id)) have++; });
    return { have: have, total: total, done: total > 0 && have >= total, rep: sr.rep || 0, name: sr.name };
  };
  GAME.collectStatOf = function () {
    var C = DATA.COLLECT || {};
    var have = 0, total = 0, sd = 0;
    (C.series || []).forEach(function (sr) {
      var d = GAME.collectSeriesDoneOf(sr.id);
      have += d.have; total += d.total; if (d.done) sd++;
    });
    return { have: have, total: total, seriesDone: sd, seriesTotal: (C.series || []).length };
  };
  GAME.collectBuy = function (itemId) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '无游戏状态' };
    var it = GAME.collectItemOf(itemId);
    if (!it) return { ok: false, msg: '无此藏品' };
    s.collect = s.collect || {};
    if (s.collect[itemId]) return { ok: false, msg: '「' + it.name + '」已入藏' };
    /* v89.196（老板 7）：成就型 —— 未达成解锁条件不能激活（旧币与条件双闸）。 */
    var _cd196 = GAME.collectCondOf(itemId);
    if (_cd196 && !_cd196.met) {
      return { ok: false, msg: '「' + it.name + '」尚未解锁：' + _cd196.text
        + '（最高 ' + U.fmt(_cd196.cur) + '）—— 达成条件后再花金激活' };
    }
    if (GAME.goldOf() < it.price) {
      return { ok: false, msg: '金不足（需 ' + U.fmt(it.price) + '，现有 ' + U.fmt(GAME.goldOf()) + '）' };
    }
    GAME.goldAdd(-it.price);
    s.collect[itemId] = 1;
    GAME.log('🏺 陈列馆：「' + it.name + '」入藏（金 −' + U.fmt(it.price) + '）', 'sys', 'trade');
    var d = GAME.collectSeriesDoneOf(it.seriesId);
    var gotRep = 0;
    if (d.done) {
      gotRep = d.rep;
      s.rep = (s.rep || 0) + gotRep;
      GAME.log('🏆 收藏系列「' + d.name + '」集齐！声望 +' + gotRep, 'sys', 'trade');
    }
    /* 全系列集齐的额外荣耀（幂等：s.collectAllBonus） */
    var allRep194 = 0;
    var stat = GAME.collectStatOf();
    if (stat.seriesTotal > 0 && stat.seriesDone >= stat.seriesTotal && !s.collectAllBonus) {
      s.collectAllBonus = 1;
      allRep194 = (DATA.COLLECT || {}).allRep || 0;
      if (allRep194) s.rep = (s.rep || 0) + allRep194;
      GAME.log('👑 陈列馆全帙集齐（' + stat.seriesTotal + ' 系列 ' + stat.total + ' 件）！声望 +'
        + allRep194, 'sys', 'staff');
    }
    return { ok: true, item: it, seriesDone: d.done, rep: gotRep, allRep: allRep194 };
  };
  /* 整系列一键集齐：预检总价（不足即拒，不做半套）→ 逐件走同一出口 collectBuy */
  GAME.collectBuySeries = function (sid) {
    var C = DATA.COLLECT || {};
    var sr = null;
    (C.series || []).forEach(function (x) { if (x.id === sid) sr = x; });
    if (!sr) return { ok: false, msg: '无此系列' };
    var missing = (sr.items || []).filter(function (it) { return !GAME.collectHaveOf(it.id); });
    if (!missing.length) return { ok: false, msg: '「' + sr.name + '」已集齐' };
    /* v89.196（老板 7）：一键集齐 = 逐件走 collectBuy（含解锁闸）——
       预检时把"未解锁"的件先列出来（不做半套）。 */
    var _locked196 = missing.filter(function (it) {
      var cd = GAME.collectCondOf(it.id);
      return cd && !cd.met;
    });
    if (_locked196.length) {
      var _c0 = GAME.collectCondOf(_locked196[0].id);
      return { ok: false, msg: '还有 ' + _locked196.length + ' 件未解锁（如「' + _locked196[0].name
        + '」：' + _c0.text + '，当前 ' + U.fmt(_c0.cur) + '）' };
    }
    var sum = 0;
    missing.forEach(function (it) { sum += it.price || 0; });
    if (GAME.goldOf() < sum) {
      return { ok: false, msg: '金不足：集齐「' + sr.name + '」尚需 ' + U.fmt(sum)
        + ' 金（现有 ' + U.fmt(GAME.goldOf()) + '）' };
    }
    var n = 0;
    missing.forEach(function (it) { var r = GAME.collectBuy(it.id); if (r.ok) n++; });
    return { ok: true, bought: n, cost: sum };
  };

  /* 距下次岁贡结算的剩余现实毫秒 */
  GAME.dailyYieldLeft = function () {
    var s = GAME.state;
    if (!s) return 0;
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    var base = (s.yieldDay == null) ? today : s.yieldDay;
    return Math.max(0, (base + 1) * 86400000 - Date.now());
  };


  /* ============================================================
   * 野地（v15）：加成线性 / 采集 / 等级衰减
   * 原版铁律：**掠夺得资源，占领得地盘**。占领野地的回报是
   *   ① 长期产量加成（每级线性，10 级湖泊 +80%）
   *   ② 采集权（把闲置兵力转成资源，并有机会得珠宝/宝物）
   *   ③ 等级会随据守时间衰减 —— 迫使轮换争夺
   * ============================================================ */
  /* 野地加成（线性）：type + 等级 → { grain: 0.24 } */
  GAME.wildAddOf = function (type, level) {
    var t = DATA.TERRAIN[type];
    if (!t || !t.add) return null;
    var lv = Math.max(0, Math.min(10, level == null ? 0 : level));
    var out = {};
    for (var r in t.add) out[r] = t.add[r] * lv;
    return out;
  };
  /* 该地形可采资源；平原/平地不可采（原版铁律）→ 返回 null */
  GAME.gatherResOf = function (type) {
    return (DATA.GATHER.resOf || {})[type] || null;
  };
  /* ============================================================
   * 野地管理（v23 · 需求 1）：驻军 / 撤军 / 放弃
   * ------------------------------------------------------------
   * 驻军不是"摆着好看"：被占野地默认**每现实日 −1 级**（decayWilds），
   * 有驻军的野地不再衰减 —— 这就是驻军的实际价值，也是它的消费点。
   * 代价：兵力离城，不再计入城内驻军。
   * ============================================================ */
  /* ============================================================
   * 野地守军（防守方）—— v27 · 需求 3
   * ------------------------------------------------------------
   * 与上面的 `wildGarrisonAt` **不是一回事**：
   *   · wildGarrisonAt  = 我方派驻在已占野地上的**驻军**（有兵就守地不衰减）
   *   · wildDefenseAt   = 野地上原本的**守军**（打它才能占）
   * 命名特意错开，避免又一次"两个同名概念互相覆盖"。
   *
   * 生成规则：按 (x, y, 现实日) 三者的哈希确定性掷点 ——
   *   同一块地在**同一天内**多次读取结果完全一致（侦查所见即所得），
   *   每现实日换一批（"今天好打、明天未必"）。
   * ============================================================ */
  GAME.wildDefenseDay = function () {
    return GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
  };
  GAME.wildDefenseAt = function (x, y, lv) {
    if (lv == null) lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);
    lv = Math.max(0, Math.min(10, lv | 0));
    var day = GAME.wildDefenseDay();
    var hash = ((x | 0) * 73856093) ^ ((y | 0) * 19349663) ^ (day * 83492791);
    var rand = U.rng(hash >>> 0);
    var tbl = DATA.WILD_DEFENSE[lv] || [];
    var wave = DATA.WILD_DEFENSE_WAVE;
    var mul = wave[0] + (wave[1] - wave[0]) * rand();
    var army = {}, total = 0;
    tbl.forEach(function (e) {
      var n = Math.round((e.min + (e.max - e.min) * rand()) * mul);
      if (n > 0) { army[e.id] = n; total += n; }
    });
    /* 守将：等级越高越可能有。有将则整支守军吃英雄加成（战斗里真的生效）。 */
    var gen = null;
    var chance = DATA.WILD_GEN_CHANCE[lv] || 0;
    if (chance > 0 && rand() < chance) {
      var sn = DATA.WILD_LORD_SURNAME[Math.floor(rand() * DATA.WILD_LORD_SURNAME.length)];
      var gn = DATA.WILD_LORD_GIVEN[Math.floor(rand() * DATA.WILD_LORD_GIVEN.length)];
      var title = DATA.WILD_LORD_TITLE[Math.floor(rand() * DATA.WILD_LORD_TITLE.length)];
      var rk = DATA.GEN_RANKS[GAME.guardRankIdxOf('wild', lv)];   /* v89.129：唯一出口（v89.185：野地=进化体） */
      /* v89.185（老板 2）：「野地1-10级，分别设置30-120级野外英雄」——
         等级 = base + (lv−1)×perLv + rand(jit)（DATA.WILD_GUARD_LV）；
         传确定性 rand 流（第 8 参）→ 同一天侦查所见即战斗所遇（含四维）；
         生成后走 guardFillOf 补成"满状态全量将"（等级/资质真转战力）。 */
      var LG = DATA.WILD_GUARD_LV || { base: 30, perLv: 10, jit: 10 };
      var glv = LG.base + Math.max(0, lv - 1) * LG.perLv + Math.floor(rand() * LG.jit);
      var g = GAME.makeGeneral(sn + gn, glv, 'guard', null, false, rk.id, 'balance', rand);
      GAME.guardFillOf(g, DATA.GUARD_FOLD);   /* v89.185：野外守将折损（半折，见 DATA.GUARD_FOLD） */
      g.wild = true;
      g.title = title;
      gen = g;
    }
    return { lv: lv, day: day, army: army, total: total, gen: gen };
  };

  GAME.wildGarrisonAt = function (x, y) {
    var w = GAME.map.wildAt(x, y);
    return (w && w.garrison) ? w.garrison : null;
  };
  GAME.wildGarrisonTotal = function (g) {
    var n = 0, t = (g && g.troops) || {};
    for (var k in t) n += t[k] || 0;
    return n;
  };
  /* 该野地是否被驻军守住（等级不衰减） */
  GAME.wildHeld = function (w) {
    return !!(w && w.garrison && GAME.wildGarrisonTotal(w.garrison) > 0);
  };

  /* v89.63（老板「野地的出征操作增加派遣和召回，军队到达野地后成为野地驻军」）
     —— 驻军的**唯一写入出口**（只写、不扣兵；"扣兵"是"从城里派"那一步的事）。
     两个调用方共用这一份写逻辑，杜绝两份搬兵代码：
       · GAME.doWildGarrison（城内派兵驻守，先扣兵再调本函数）
       · battle 出征「派遣」到达结算（兵在 dispatch 时已离城，直接入驻军）
     超上限的部分**不硬塞**：放进 overflow 交回调用方处置（通常是回城）。 */
  GAME.wildGarrisonAdd = function (x, y, army, cityId, opts) {
    var w = GAME.map.wildAt(x, y);
    if (!w) {
      /* 写不进去时把兵力**原样退回 overflow**，由调用方决定去处 —— 绝不能凭空蒸发（兵不丢铁律） */
      var ov0 = {};
      for (var k0 in (army || {})) { var n0 = Math.floor(army[k0] || 0); if (n0 > 0) ov0[k0] = n0; }
      return { ok: false, add: 0, total: 0, overflow: ov0, msg: '该地并非我方野地' };
    }
    /* v89.135（老板 3）：占领新野地不受上限（noCap）——「10W 占领 1 级野地也能全部进去」；
       派驻 / 增援 / 驻守派遣仍走上限（野地等级 × 10000）。 */
    var cap = (opts && opts.noCap) ? Infinity
      : (GAME.wildGarrisonCap ? GAME.wildGarrisonCap(w.level) : Infinity);
    var have = GAME.wildGarrisonTotal(w.garrison);
    var room = Math.max(0, cap - have);
    w.garrison = w.garrison || { troops: {} };
    if (cityId) w.garrison.cityId = cityId;
    /* v89.135（老板 4）：驻军英雄 —— **首队**带将驻守时记下（增援不带将、不覆盖）。 */
    if (opts && opts.genId && !w.garrison.genId) w.garrison.genId = opts.genId;
    var add = 0, overflow = {};
    for (var k in (army || {})) {
      var n = Math.floor(army[k] || 0);
      if (n <= 0) continue;
      var take = Math.min(n, room);
      if (take > 0) {
        w.garrison.troops[k] = (w.garrison.troops[k] || 0) + take;
        add += take; room -= take;
      }
      if (n - take > 0) overflow[k] = (overflow[k] || 0) + (n - take);
    }
    return { ok: true, add: add, total: GAME.wildGarrisonTotal(w.garrison), cap: cap, overflow: overflow };
  };

  /* ============================================================
   * ⛔ v89.137（老板 7）：`GAME.doWildGarrison`（派军驻守 · 即时直补）整条退役 ——
   * 老板：「所有军队操作均以出征界面进行」——派驻/增援统一走
   * `march.dispatch(target, 'station')`，出发前由 `prepare` 预检驻军上限 + 无将硬闸，
   * 抵达由 expedition 的 station 分支写 `wildGarrisonAdd`（同一写入出口，兵不丢）。
   * 删净：本函数 + main.js 的 `GAME.doWildGarrisonDo` / `case 'wild-garrison-do'` +
   * ui.js 的派驻面板（同款墓碑）。
   * 如需恢复：本段代码见 `backup/v89137/domain.js`（判据：`GAME.doWildGarrison = function`）。
   * ============================================================ */

  /* 撤回驻军：兵力回城 */
  GAME.doWildWithdraw = function (x, y) {
    var s = GAME.state, w = GAME.map.wildAt(x, y);
    if (!w || !w.garrison) return { ok: false, msg: '该野地没有驻军' };
    var city = GAME.cityById(w.garrison.cityId) || GAME.currentCity() || (s.cities || [])[0];
    /* v89.135：**先停采再撤** —— 原地开工的采集队挂在驻军上（采力动态读驻军），
       直接撤军会让它变成"采力 0 的僵尸队"。已满 1 小时的先自动收获（不罚玩家），
       不足 1 小时的停止开采。 */
    var gth = GAME.gatherAt(x, y);
    if (gth) {
      var gy = GAME.gatherYield(gth);
      if (gy && gy.ready) GAME.finishGather(gth.id);
      else GAME.abandonGather(gth.id);
    }
    /* v89.135（老板 4）：驻军英雄随军回城（status='garrison' → idle）。 */
    var _wgen = null;
    if (w.garrison.genId) {
      (s.generals || []).forEach(function (g) { if (g.id === w.garrison.genId) _wgen = g; });
      /* v89.135：驻守不改 cityId（编制城一直没动）—— 召回只把 status 收成 idle */
      if (_wgen && _wgen.status === 'garrison') { _wgen.status = 'idle'; }
    }
    var n = 0;
    for (var k in w.garrison.troops) {
      var c = w.garrison.troops[k] || 0;
      if (c <= 0 || !city) continue;
      city.army[k] = (city.army[k] || 0) + c;
      n += c;
    }
    w.garrison = null;
    if (!city) return { ok: true, msg: '驻军已解散（无城池可归）' };
    GAME.log.war('撤回驻军 ' + U.fmt(n) + ' 名' + (_wgen ? '（' + _wgen.name + ' 随军）' : '') + '，已归 ' + city.name);
    return { ok: true, msg: '撤回驻军 ' + U.fmt(n) + ' 名' + (_wgen ? '（英雄随军归城）' : '') };
  };

  /* 放弃野地：先把驻军与采集队撤回（否则兵力凭空消失），再解除占领 */
  GAME.doAbandonWild = function (x, y) {
    var s = GAME.state, w = GAME.map.wildAt(x, y);
    if (!w) return { ok: false, msg: '该野地尚未占领' };
    var back = 0;
    if (w.garrison) {
      back += GAME.wildGarrisonTotal(w.garrison);
      GAME.doWildWithdraw(x, y);
    }
    var gth = GAME.gatherAt(x, y);
    if (gth) {
      back += gth.troops || 0;
      /* ⛔ v89.141（复核修复）：此处曾引 `GAME.doAbandonGather` —— 那是 v89.138
         已退役的提交端（main.js 有墓碑），**运行时 TypeError**（放弃野地时若恰好
         有采集记录就崩）；正确出口是域侧保留的 `abandonGather`（单纯停采，
         满 1h 先自动收获的语义在 doWildWithdraw 主路径已处理）。 */
      GAME.abandonGather(gth.id);
    }
    s.wilds = (s.wilds || []).filter(function (z) { return !(z.x === x && z.y === y); });
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type;
    GAME.log('放弃野地：' + tn + ' Lv' + w.level + '（产量加成与采集权一并失去' +
      (back ? '，' + U.fmt(back) + ' 名守军/采集队已归城' : '') + '）');
    return { ok: true, msg: '已放弃 ' + tn + ' Lv' + w.level + (back ? '（' + U.fmt(back) + ' 兵归城）' : '') };
  };

  /* ============================================================
   * 城池关联数据登记表（v67 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「添加放弃城池的功能，注意梳理一下一切伴随城市产生的数据，
   *   既能便于对应产生，又能伴随放弃城市批量清除（本质上是搞好数据库表）」
   * 所以这里先立一张**表**，而不是散着写几个 filter：
   *   · 凡是"按城挂载"的数据，都在 GAME.CITY_SCOPED 里登记一行；
   *   · 放弃城池**照表清理**（clean 按表顺序执行）；
   *   · 测试照表检查：放弃之后 cityRefsOf 必须返回空 —— 漏清一项就红。
   * 新增一类按城挂载的数据时，往表里加一行即可；忘加会在测试里露出来，
   * 而不是变成线上"悬空引用"（某个队列还在指向已删的城）。
   *
   * 字段：
   *   key   state 上的路径（点号），值是数组或对象
   *   path  条目上取"归属城"的字段路径（点号；如 'garrison.cityId'）
   *   label 界面上怎么说（拒绝理由与日志都用它）
   *   hard  true = 有它就不许放弃（清了会丢兵：在途行军 / 在外采集）
   *   clean 清理动作（按表的**顺序**执行；'cities' 必须在最后 —— 前面几项还要用 city/recv）
   * ============================================================ */
  GAME.CITY_SCOPED = [
    { key: 'generals', path: 'cityId', label: '英雄',
      clean: function (s, city, recv) {
        (s.generals || []).forEach(function (g) {
          if (g.cityId !== city.id) return;
          g.cityId = recv.id;
          /* 守将随城解任：城都没了，守将位自然不存在 */
          if (g.status === 'guard') g.status = 'idle';
        });
      } },
    { key: 'queues.build', path: 'cityId', label: '建造队列',
      clean: function (s, city) {
        s.queues.build = (s.queues.build || []).filter(function (q) { return q.cityId !== city.id; });
      } },
    { key: 'queues.train', path: 'cityId', label: '募兵队列',
      clean: function (s, city) {
        s.queues.train = (s.queues.train || []).filter(function (q) { return q.cityId !== city.id; });
      } },
    /* 在途部队与在外采集**不许清**：清了兵就凭空消失，所以标 hard（有它就不让放弃）。
       v89.204：`clean` = **失城路径**（GAME.cityFallen）专用 —— 改属收容城（行程与兵都不丢）；
       玩家主动弃城仍先走 hard 拒绝（clean 不会被触发）。 */
    { key: 'marches', path: 'cityId', label: '在途行军', hard: true,
      clean: function (s, city, recv) {
        (s.marches || []).forEach(function (m) { if (m.cityId === city.id) m.cityId = recv.id; });
      } },
    { key: 'gathers', path: 'cityId', label: '在外采集队', hard: true,
      clean: function (s, city, recv) {
        (s.gathers || []).forEach(function (g) { if (g.cityId === city.id) g.cityId = recv.id; });
      } },
    { key: 'wilds', path: 'garrison.cityId', label: '野地驻军',
      clean: function (s, city, recv) {
        /* 兵不丢：先把归属改到接收城，再走**既有的唯一出口**撤回
           （doWildWithdraw 自己会把兵并进那座城，不另写一份搬兵逻辑）。 */
        (s.wilds || []).forEach(function (w) {
          if (!w.garrison || w.garrison.cityId !== city.id) return;
          w.garrison.cityId = recv.id;
          GAME.doWildWithdraw(w.x, w.y);
        });
      } },
    /* ⚠️ 城池本体放最后：上面的清理还要用 city / recv */
    { key: 'cities', path: 'id', label: '城池本体',
      clean: function (s, city) {
        s.cities = (s.cities || []).filter(function (c) { return c.id !== city.id; });
      } },
  ];
  /* 按点号路径取值（登记表用；对 null/undefined 安全） */
  GAME.cityPath = function (o, p) {
    var a = p.split('.'), v = o, i;
    for (i = 0; i < a.length && v != null; i++) v = v[a[i]];
    return v;
  };
  /* 这座城身上还挂着哪些数据（只读）—— 确认框、日志与测试都读它 */
  GAME.cityRefsOf = function (cityId) {
    var s = GAME.state, out = [];
    if (!s || !cityId) return out;
    GAME.CITY_SCOPED.forEach(function (e) {
      var list = GAME.cityPath(s, e.key);
      if (!list) return;
      if (!(list instanceof Array)) list = [list];
      var n = 0;
      list.forEach(function (it) { if (GAME.cityPath(it, e.path) === cityId) n++; });
      if (n) out.push({ key: e.key, label: e.label, n: n, hard: !!e.hard });
    });
    return out;
  };
  /* 能不能放弃（真实判据的**唯一出口** —— 界面与业务共用，不许各写一份） */
  GAME.abandonCityCheck = function (cityId) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    if ((s.cities || []).length <= 1) {
      return { ok: false, msg: '这是最后一座城池 —— 放弃它就没有立足之地了' };
    }
    var refs = GAME.cityRefsOf(cityId);
    var hard = refs.filter(function (r) { return r.hard; });
    if (hard.length) {
      return { ok: false, msg: '还有 ' + hard.map(function (r) {
        return r.n + ' 支' + r.label;
      }).join('、') + '属于这座城 —— 撤回或等它们回城之后再放弃' };
    }
    var others = (s.cities || []).filter(function (c) { return c.id !== cityId; });
    return { ok: true, city: city, receiver: others[0], others: others, refs: refs };
  };
  /* 把这一格还给地图：攻占来的城 → 系统城回来；自建城 → 回到平原 */
  GAME.restoreCityTile = function (city) {
    var s = GAME.state;
    if (!s.map || !city) return;
    /* 口径与 map.generate 里的剔除**完全一致**（按各城 origId 排除已占的系统城）。
       ⚠️ 不能直接调 map.generate()：grid 已在时它开头就 return（见 map.js）。 */
    if (s.map.cities) {
      var taken = {};
      (s.cities || []).forEach(function (c) { if (c.origId) taken[c.origId] = 1; });
      s.map.cities = GAME.buildNpcCities(s.map.seed).filter(function (c) { return !taken[c.id]; });
    }
    /* 地形：攻占城的格子保持 'city'（回来的正是那座系统城，hasFort 也按 city 认）；
       自建城只可能建在平原上（canBuildCityAt 的硬约束），还回平原。 */
    var t = GAME.map.tile(city.x, city.y);
    if (t && !city.origId) t.terrain = 'plain';
  };
  /* 放弃城池（唯一入口）：照 CITY_SCOPED 表批量清理，再把格子还给地图 */
  GAME.abandonCity = function (cityId) {
    var s = GAME.state;
    var chk = GAME.abandonCityCheck(cityId);
    if (!chk.ok) return chk;
    var city = chk.city, recv = chk.receiver;
    var before = {
      army: GAME.armyTotal(city),
      gens: (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length,
      build: (s.queues.build || []).filter(function (q) { return q.cityId === city.id; }).length,
      train: (s.queues.train || []).filter(function (q) { return q.cityId === city.id; }).length,
    };
    GAME.CITY_SCOPED.forEach(function (e) { if (e.clean) e.clean(s, city, recv); });
    GAME.restoreCityTile(city);
    /* UI 指针不许指向已删城（否则侧栏/城池视图会拿到一座不存在的城） */
    if (GAME.ui && GAME.ui._cityId === city.id) GAME.ui._cityId = recv.id;
    /* 自检：清完不该再有引用 —— 有的话就是登记表漏了一项（日志里能看见） */
    var left = GAME.cityRefsOf(city.id);
    GAME.log('🗑️ 放弃城池：' + city.name + '（' + U.fmt(before.army) + ' 驻军、' + before.gens
      + ' 英雄归 ' + recv.name + '；建造 ' + before.build + ' 项、募兵 ' + before.train
      + ' 项取消）' + (left.length ? '　⚠️ 残留引用 ' + left.length + ' 类：'
        + left.map(function (x) { return x.key; }).join(',') : '　清理干净'));
    return { ok: true, receiver: recv, refs: left, before: before,
      msg: '已放弃 ' + city.name + '：' + U.fmt(before.army) + ' 驻军与 ' + before.gens
        + ' 名英雄归 ' + recv.name };
  };

  /* v89.204（老板 1）：失城 → 地图上恢复/新增一座 NPC 城（敌占）。
     · 攻占来的城（有 origId）→ 从 DATA.NPC_CITIES 恢复原记录；
     · 自建城 → 新造一条聚落档记录（敌方接管为据点级城池）。 */
  GAME.lostCityToNpc = function (city) {
    var s = GAME.state;
    if (!s || !s.map || !city) return null;
    s.map.cities = s.map.cities || [];
    var ex = null;
    s.map.cities.forEach(function (c) {
      if (!ex && (c.id === city.id || (c.x === city.x && c.y === city.y))) ex = c;
    });
    if (ex) return ex;
    var rec = null;
    if (city.origId) {
      (DATA.NPC_CITIES || []).forEach(function (c) { if (!rec && c.id === city.origId) rec = U.deep(c); });
    }
    if (!rec) {
      rec = { id: 'lost_' + city.id, name: city.name || '失地', x: city.x, y: city.y,
        type: 'county', state: city.state || '', level: (DATA.NPC_TIER_LV || {}).county || 12,
        def: 60, rep: 60 };
    }
    rec.owner = 'npc';
    rec.garrison = GAME.genGarrison(rec);
    rec.maxArmy = rec.garrison;
    s.map.cities.push(rec);
    return rec;
  };
  /* ============================================================
   * v89.204（老板 1）：**失城处置** —— 我方城池被敌方攻破（民心归零 + 城破）时，
   *   照 CITY_SCOPED 表批量清理（复用弃城框架：英雄/队列随表清，hard 项改属收容城），
   *   城池变回地图上的 NPC 城（可再打回）。
   * ------------------------------------------------------------
   * 与 abandonCity（主动弃城）的差别：
   *   · 不拒绝：战败失城不是玩家选择 —— hard 引用（在途行军/在外采集）由表内 clean**改归属**；
   *   · 城内驻军随城失陷（战败损失，不返还）；
   *   · **主城保护**（双闸）：明设主城 s.mainCityId / 缺省首城 / 最后一座城 —— 均不可能失
   *     （老板原话：「除主城不可被占领外，别的城池将会被敌方占领」）。
   * 返回 { ok, receiver, msg }。
   * ============================================================ */
  GAME.cityFallen = function (city, srcName) {
    var s = GAME.state;
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    var inList = (s.cities || []).some(function (c) { return c.id === city.id; });
    if (!inList) return { ok: false, msg: '城池已不在治下' };
    if (GAME.isMainCity && GAME.isMainCity(city)) return { ok: false, msg: '主城不可被占领' };
    var head = (s.cities || [])[0];
    if (!s.mainCityId && head && head.id === city.id) return { ok: false, msg: '主城不可被占领' };
    if ((s.cities || []).length <= 1) return { ok: false, msg: '最后一座城不可被占领' };
    var others = (s.cities || []).filter(function (c) { return c.id !== city.id; });
    var recv = (GAME.mainCityOf && GAME.mainCityOf()) || others[0];
    if (!recv) return { ok: false, msg: '无收容城' };
    var before = {
      army: GAME.armyTotal(city),
      gens: (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length,
    };
    GAME.CITY_SCOPED.forEach(function (e) { if (e.clean) e.clean(s, city, recv); });
    var back = GAME.lostCityToNpc ? GAME.lostCityToNpc(city) : null;
    if (GAME.ui && GAME.ui._cityId === city.id) GAME.ui._cityId = recv.id;
    var src = srcName || '外敌';
    var msg = city.name + ' 民心尽失，为 ' + src + ' 所据';
    GAME.log.war('🏴 ' + msg + '！驻军 ' + U.fmt(before.army) + ' 人尽没，'
      + before.gens + ' 名英雄与残部退守 ' + recv.name
      + (back ? '　（城池易主，整军可复）' : ''));
    if (GAME.ui && GAME.ui.notify) GAME.ui.notify('warn', '🏴 ' + msg + ' —— 可在出征界面讨还');
    if (GAME.ui && GAME.ui.moment) {
      GAME.ui.moment({ kind: 'card', icon: '🏴', title: '失地 · ' + city.name,
        sub: '民心尽失，为 ' + src + ' 所据　·　残部退守 ' + recv.name });
    }
    return { ok: true, receiver: recv, back: back, before: before, msg: msg };
  };

  GAME.gatherList = function () {
    var s = GAME.state;
    if (!s) return [];
    s.gathers = s.gathers || [];
    return s.gathers;
  };
  GAME.gatherAt = function (x, y) {
    var list = GAME.gatherList();
    for (var i = 0; i < list.length; i++) if (list[i].x === x && list[i].y === y) return list[i];
    return null;
  };
  GAME.gatherByGen = function (genId) {
    var list = GAME.gatherList();
    for (var i = 0; i < list.length; i++) if (list[i].genId === genId) return list[i];
    return null;
  };
  /* ============================================================
   * 采集力（v29 · 需求 0）
   * ------------------------------------------------------------
   * 收成从"数人头"改为"看采集力"：采集力 = Σ(兵种数量 × 兵种采集效率)。
   * 高级兵种单位采集效率更高（板车 2 / 步行机·盾卫 4 / 导弹车 5 / 伏击车 6 / 主战机甲 9 /
   * 狂猎·主战机甲 10 / 泰坦机甲 12），于是：
   *   · 同样 5000 人，板车产 10000 采力、主战机甲产 45000 —— 一个精锐顶四个板车；
   *   · 达到同一采力上限所需的人更少，好兵可以省下来打仗；
   *   · 器械（无人轰炸机/自行火炮/自行火炮）不善耕作，只有 2。
   * 兼容：老存档 / 只记了人数的采集队按板车基准（basePerHour）折算。
   * ============================================================ */
  GAME.gatherPowerOf = function (g) {
    var G = DATA.GATHER;
    var army = g && g.army;
    /* v89.135：**驻军开采 = 原地开工**（兵不离开驻军）—— 采力**动态**读驻军当前兵力：
       此后增援加兵，采集效率当场变高；驻军被召回则采力归零（该队应撤回）。 */
    if (g && g.origin === 'garrison') {
      var _gw = GAME.wildGarrisonAt(g.x, g.y);
      army = (_gw && GAME.wildGarrisonTotal(_gw) > 0) ? _gw.troops : null;
      if (!army) return 0;
    }
    if (army) {
      var p = 0;
      for (var id in army) {
        var t = DATA.TROOPS[id];
        if (t && army[id] > 0) p += army[id] * (t.gather != null ? t.gather : G.basePerHour);
      }
      return p;
    }
    return ((g && g.troops) || 0) * G.basePerHour;
  };
  /* ============================================================
   * v89.186（老板 3）：**据点剥离出口组**（占据 = 野外建筑 + 归属）
   * ------------------------------------------------------------
   * 采用 #1 前哨 / #2 采集增产 / #3 兵站 / #5 情报站 / #6 商旅税所（见 DATA.FORT_AURA）。
   * `GAME.fortAuraAt(x, y)` = **覆盖查询唯一出口**（切比雪夫距离 ≤ radius）——
   *   五个读点（衰减 / 采集 / 驻军上限 / 情报误差 / 税所结算）全读它，不各判一遍。
   * ============================================================ */
  GAME.fortsOf = function () {
    var s = GAME.state;
    if (!s) return {};
    s.forts = s.forts || {};
    return s.forts;
  };
  /* ============================================================
   * v89.193（老板 2）：**老档前哨归属迁移** —— 给无 cityId 的旧前哨
   *   分配"距其最近的己方城"（曼哈顿距离，平局取城 id 序——确定性）。
   * 幂等（s.fortsMig193 标记）；**不追溯上限**：若某城因此超过 5 处，
   *   照常生效（上限只管"新占据"的校验，不追溯削弱老档——项目惯例）。
   * 调用：loadGame（adoptState 迁移链）+ tickOnce 兜底（仿 migrateJewels152 双保险）。
   * ============================================================ */
  GAME.migrateForts193 = function () {
    var s = GAME.state;
    if (!s || s.fortsMig193) return false;
    var fs = s.forts || {};
    var cities = s.cities || [];
    for (var k in fs) {
      var f = fs[k];
      if (!f || f.cityId) continue;
      var best = null, bd = Infinity;
      cities.forEach(function (c) {
        var d = Math.abs((c.x || 0) - (f.x || 0)) + Math.abs((c.y || 0) - (f.y || 0));
        if (d < bd || (d === bd && best && String(c.id) < String(best.id))) { bd = d; best = c; }
      });
      if (best) f.cityId = best.id;
    }
    s.fortsMig193 = true;
    return true;
  };
  /* ============================================================
   * v89.193（老板 2）：**前哨等级 → 效果 —— 唯一出口组**
   * ------------------------------------------------------------
   * 老板：「设置同附属野地，每城最多 5 个。等级不同的前哨辐射范围和效果不同，
   *   设计一下」——等级五档表在 DATA.FORT_AURA.tiers（Lv1-10 分五档，
   *   中档 Lv5-6 = v89.187/188 原定稿值，两端拉开）。
   * fortTierOf(lv)：等级 → 档；fortEffectOf(f)：前哨实体 → 效果对象
   *   （界面/探针/断言全读它，不重算 —— "唯一出口"在效果层面的落点）。
   * 消费点：fortAuraAt（半径）· wildGarrisonCap（驻军上限）·
   *   gatherYield（采力）· gatherTreasureChance（宝物）·
   *   ui.expEstimateOf（情报 intelHalf/intelFull）· fortTaxSettle（税所 Σtax）。
   * fortsOfCity(city)：某城前哨清单（每城上限 5 处的"本城"口径；
   *   归属 = 占据时的出发城，见 GAME.claimFort）。
   * fortOwnAt(x,y)：**该格是不是我方前哨**（占据登记直接命中，不走覆盖半径）——
   *   前哨格专属面板（openLandModal 新分支）与各处判定用它。
   * ============================================================ */
  GAME.fortTierOf = function (lv) {
    var tiers = (DATA.FORT_AURA || {}).tiers || [];
    if (!tiers.length) {
      return { lv: 10, radius: 10, gatherMul: 1.35, treasureAdd: 0.15,
        garrisonCapMul: 1.5, intel: 'full', tax: 500 };
    }
    var up = Math.max(1, Math.round(lv || 1));
    for (var i = 0; i < tiers.length; i++) {
      if (up <= tiers[i].lv) return tiers[i];
    }
    return tiers[tiers.length - 1];
  };
  GAME.fortEffectOf = function (f) {
    var t = GAME.fortTierOf(f && f.lv);
    return {
      lv: (f && f.lv) || 1,
      radius: t.radius,
      gatherMul: t.gatherMul,
      treasureAdd: t.treasureAdd,
      garrisonCapMul: t.garrisonCapMul,
      intelHalf: t.intel === 'half',   /* 情报站半档：军师估算误差减半 */
      intelFull: t.intel === 'full',   /* 情报站全档：归零（"确凿"） */
      tax: t.tax,
    };
  };
  GAME.fortRadiusOf = function (f) { return GAME.fortEffectOf(f).radius; };
  GAME.fortsOfCity = function (city) {
    var fs = GAME.fortsOf(), out = [];
    if (!city) return out;
    for (var k in fs) { if (fs[k] && fs[k].cityId === city.id) out.push(fs[k]); }
    return out;
  };
  GAME.fortOwnAt = function (x, y) {
    if (x == null || y == null) return null;
    return GAME.fortsOf()[x + ',' + y] || null;
  };
  GAME.fortAuraAt = function (x, y) {
    if (x == null || y == null) return null;
    var fs = GAME.fortsOf();
    var best = null, bd = Infinity, bestKey = '';
    for (var k in fs) {
      var f = fs[k];
      /* v89.193（老板 2）：半径随前哨等级（6~14 格）—— 逐哨取自己的半径
         （旧版全境一个常数；"辐射范围随等级不同"就落在这里）。
         重叠区取**最近**的哨（切比雪夫距离；平局按 key 序——确定性）：
         旧行为是"for-in 第一个命中"，顺序对玩家不可见；等级化后重叠区
         可能取到弱哨的加成（Lv2 罩住 Lv9 的边），"离哪个近用哪个"才是
         可预期的语义。 */
      /* v89.194（老板「渲染一个圆形雷达扫描圈」）：覆盖判定由**切比雪夫（方阵）改欧氏（圆）**——
         与地图雷达圈"显示 = 判定"（圆圈画多大、覆盖就多大；旧方阵的四个角在圈外却有效）。
         ⚠️ 口径变更：同档半径的覆盖面积由 (2r+1)² 缩为 πr²（约 -29%）；半径档位数值未动。
         若要回退：把本段换回 max(|dx|,|dy|) 比较 + map.js 雷达圈改画菱形（见 docs/v89194）。 */
      var _dx194 = (f.x || 0) - x, _dy194 = (f.y || 0) - y;
      var d = _dx194 * _dx194 + _dy194 * _dy194;      /* 距离平方（整数，无浮点误差） */
      var _R194 = GAME.fortRadiusOf(f);
      if (d > _R194 * _R194) continue;
      if (d < bd || (d === bd && (best === null || k < bestKey))) { bd = d; best = f; bestKey = k; }
    }
    return best;
  };
  /* ============================================================
   * v89.195（老板 1）：「前哨可放手」—— 释放名额的唯一出口。
   * ------------------------------------------------------------
   * 场景：每城上限 5 处（v89.193）；打下一座新据点而本城已满时，旧版只能
   *   "从他城出征"或干瞪眼（claimFort 满员文案早已预告"可先放手一处"）。
   * 口径：
   *   · 删除 s.forts 记录 —— 护持 / 商税 / 名额**全部随记录走**
   *     （各消费点读同一出口 fortOwnAt / fortAuraAt / fortsOfCity，无需逐处清）；
   *   · 格子地形恢复为占据前的原值（rec.terrain0；老档无此字段 → 兜底 'plain'）；
   *   · **s.fortsTaken 一并清空（v89.196 老板 2 拍板："放手后可重新占据"）**——
   *     v89.195 原口径"保留拔除登记防刷"被推翻：该格回归**野外据点**，
   *     次日起（当日由 fortsRazed 挡）即可再打、再占 —— 天然节奏 = 每格每日至多一次；
   *     重占照常给战利品与声望（老板要的就是"完整再来"，不额外加护栏）。
   *   · 无返还（前哨没有驻军与库存；护持是"持续效果"，停即停）。
   * ============================================================ */
  GAME.abandonFort = function (x, y) {
    var s = GAME.state;
    if (!s || x == null || y == null) return { ok: false, msg: '参数不足' };
    var key = x + ',' + y;
    var rec = GAME.fortsOf()[key];
    if (!rec) return { ok: false, msg: '此处没有我方前哨' };
    var nm = rec.name || ('(' + x + ',' + y + ')');
    var lv = rec.lv || 1;
    var own = GAME.cityById(rec.cityId);
    delete s.forts[key];
    /* v89.196（老板 2）：「放手后可重新占据」—— 清拔除登记，该格回归野外据点。
       （当日不再出现由 fortsRazed 保证；次日等级表重排后即可再打。） */
    if (s.fortsTaken) delete s.fortsTaken[key];
    var t = GAME.map.tile(x, y);
    if (t && t.terrain === 'city') t.terrain = rec.terrain0 || 'plain';   /* 恢复占据前的地形 */
    var nAfter = own ? GAME.fortsOfCity(own).length : 0;
    var maxN = ((DATA.FORT_AURA || {}).maxPerCity) || 5;
    GAME.log.war('🚩 我们放弃了「' + nm + '」前哨（Lv' + lv + '）—— 护持与商税随之中止'
      + (own ? '；「' + own.name + '」名额 ' + nAfter + '/' + maxN : ''));
    return { ok: true, name: nm, lv: lv,
      msg: '已放弃「' + nm + '」前哨（Lv' + lv + '）—— 护持终止'
        + (own ? '，名额已释放（' + nAfter + '/' + maxN + '）' : '') };
  };
  /* #6 商旅税所：**v89.188（老板 2）**——「税金固定每现实时间 24h 给 500」。
     口径 = 每处 · 每**现实日** · 固定额（与岁贡 settleDailyYield 同轴：questDayIndex
     跨天结算 · 离线补结 ≤30 日 · 首日只登记；锚点 s.fortTaxDay，旧游戏秒锚点 fortTaxAt 退役）。
     v89.193（老板 2）：金额**随前哨等级**（Σ 各哨档位 tax 300~800/处，走唯一出口
     fortEffectOf）—— 旧口径"全档固定 500"与字段 fortTaxGold 一并退役
     （老板本轮"等级不同效果不同"；v89.188 的量级复核仍成立：均值 ≈ 500 量级）。
     幂等（多调无害）；量级复核见 DATA.FORT_AURA 头注。 */
  GAME.fortTaxSettle = function () {
    var s = GAME.state;
    if (!s) return null;
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    if (s.fortTaxDay == null) { s.fortTaxDay = today; return null; }   /* 首期只登记（老档同理：旧锚退役后自然过渡） */
    var days = today - s.fortTaxDay;
    if (days <= 0) return null;
    var capped = Math.min(days, 30);
    s.fortTaxDay = today;
    var fs = GAME.fortsOf(), n = 0, sumTax = 0;
    for (var k in fs) { n++; sumTax += GAME.fortEffectOf(fs[k]).tax; }
    if (!n) return { days: capped, gold: 0, forts: 0 };
    var gold = Math.round(sumTax * capped);
    if (GAME.goldAdd) GAME.goldAdd(gold);
    else s.res.gold = (s.res.gold || 0) + gold;
    GAME.log('🏪 商旅税所：' + n + ' 处前哨过境商税 +' + U.fmt(gold) + ' 金（每现实日 · 随前哨等级 · 与岁贡同轴）', 'sys', 'trade');
    return { days: capped, gold: gold, forts: n };
  };

  /* 野地驻军上限（v29 · 需求 0）：野地等级 × 10000。
     **只在派驻时校验**；野地日后掉级不会把已驻军队赶回城（见 DATA.WILD_GARRISON 注释）。
     v89.186（老板 3 · #3 兵站）：据点覆盖内上限 ×1.5；签名向后兼容（不传 x/y = 无加成）。 */
  GAME.wildGarrisonCap = function (lv, x, y) {
    var cap = Math.max(0, Math.round((lv || 0) * DATA.WILD_GARRISON.perLevel));
    /* v89.193（老板 2）：乘数随前哨等级（×1.25~1.80，走唯一出口 fortEffectOf） */
    var _f193c = (x != null && y != null && GAME.fortAuraAt) ? GAME.fortAuraAt(x, y) : null;
    if (_f193c) cap = Math.round(cap * GAME.fortEffectOf(_f193c).garrisonCapMul);
    return cap;
  };

  /* 出征体力消耗的**唯一出口**（v89.135 · 老板第 2 条：计谋「以逸待劳」体力减半）——
     校验（prepare）与三处扣除（侦查 / 出征即离城 / 行军 dispatch）一律读它，
     别处不要再写 `mode.stamina`（否则"以逸待劳"只在一半路径生效）。 */
  GAME.staCostOf = function (mode, schemeId) {
    var base = (mode && mode.stamina) || 0;
    var sc = (schemeId && GAME.schemeOf) ? GAME.schemeOf(schemeId) : null;
    var mul = 1;
    if (sc && sc.eff && sc.eff.staminaSave) mul -= sc.eff.staminaSave;
    return Math.max(0, Math.round(base * mul));
  };

  /* 采集进度与预计收成：{ hours, capped, pct, ready, res, amount, capReached } */
  GAME.gatherYield = function (g) {
    var y = GAME._rawGatherYield(g);
    if (!y) return null;
    /* 负重技巧：掠夺与采集收获 +5%/级（决定能带回多少）
       注意：返回的是**对象**，加成要作用在 amount 上，不能对整个对象取整 */
    /* v89.191（老板 3-④）：负重技巧按**采集队所属城**读（不回落当前城 ——
       玩家可能正看着别的城；与 abandonGather 读 g.cityId 同源）。 */
    var _gcity191 = (g && g.cityId && GAME.cityById) ? GAME.cityById(g.cityId) : null;
    if (y.amount > 0) y.amount = Math.round(y.amount * (1 + techB('load', _gcity191)));
    return y;
  };
  /* 驻军总负重（v89.139 老板 5）——「采集的产出…建议关联驻军的总负重」。
     与 gatherPowerOf 同一形状（驻军开采时**动态读驻军**，不读记录里那份副本）。 */
  GAME.gatherLoadOf = function (g) {
    var army = g && g.army;
    if (g && g.origin === 'garrison') {
      var _gl = GAME.wildGarrisonAt(g.x, g.y);
      army = (_gl && GAME.wildGarrisonTotal(_gl) > 0) ? _gl.troops : null;
    }
    var L = 0;
    for (var id in (army || {})) {
      var t = DATA.TROOPS[id];
      if (t && army[id] > 0) L += army[id] * (t.load || 0);
    }
    return L;
  };
  GAME._rawGatherYield = function (g) {
    var G = DATA.GATHER;
    if (!g) return null;
    var hours = (g.elapsed || 0) / 3600;
    var capped = Math.min(hours, G.maxHours);
    var res = GAME.gatherResOf(g.type);
    var ready = hours >= G.minHours;
    var amount = 0;
    var rawPower = GAME.gatherPowerOf(g);
    var power = Math.min(rawPower, G.powerCap);
    /* v89.139（老板 5）：收成 = min(采力产出, 负重上限)。
       采力（gather）决定"每小时采多少"，负重（load）决定"一次能带回多少" ——
       满载的运输平台/板车不触顶，纯精锐机车会被负重节制（补运输平台即可解锁采力）。 */
    var loadCap = Math.round(GAME.gatherLoadOf(g) * (G.loadMul || 0));
    var loadLimited = false;
    if (ready && res) {
      amount = Math.round(power * (1 + (g.level || 0) * G.levelBonus) * capped);
      /* v89.186（老板 3 · #2 采集增产）：据点覆盖内采力产出加成（仍受负重上限约束）
         v89.193（老板 2）：倍率随前哨等级（×1.20~1.55，走唯一出口 fortEffectOf） */
      var _f193g = (amount > 0 && GAME.fortAuraAt && g.x != null) ? GAME.fortAuraAt(g.x, g.y) : null;
      if (_f193g) amount = Math.round(amount * GAME.fortEffectOf(_f193g).gatherMul);
      if (loadCap > 0 && amount > loadCap) { amount = loadCap; loadLimited = true; }
    }
    return {
      hours: hours, capped: capped, res: res, amount: amount, ready: ready,
      power: power, powerFull: rawPower, powerCap: G.powerCap,
      load: GAME.gatherLoadOf(g), loadCap: loadCap, loadLimited: loadLimited,
      pct: Math.min(100, Math.floor(capped / G.maxHours * 100)),
      capReached: hours >= G.maxHours,
    };
  };
  /* 珠宝挑选（**唯一出口**，v89.139 老板 4；v89.152 体系重设后口径不变、数据换新）——
     地形表三档（常见/少见/稀有）里
     取"等级够"的候选（jewelMinLv 门槛），按 jewelRareP/jewelMidP 决定档位；
     数量 = 1 + ⌊野地等级 × jewelCountPerLv⌋（威望后期单次要几十颗）。
     返回 { id, n } 或 null（该地形无珠宝 / 等级全不够）。
     `rnd` 可注入（测试用；缺省 Math.random）。 */
  GAME.gatherJewelPick = function (terrain, lv, rnd) {
    var G = DATA.GATHER;
    var rr = rnd || Math.random;
    var n0 = 1 + Math.floor((lv || 0) * (G.jewelCountPerLv || 0));
    /* v89.140（老板 10）：**全地形珠**（夜光珠）—— 与地形表/等级门槛无关的一路：
       命中珠宝后再掷一次，按 jewelAnywhereP 直接改判（"所有野地都有几率出现"）。
       放在最前：连"该地形本无珠宝"（如平地）也能沾到这一点点运气？——**不**：
       平地保持无珠宝（原版铁律），全地形珠只在**可采地形**内生效。 */
    var jt = (G.jewelTable || {})[terrain] || [];
    if (!jt.length) return null;
    var anyList = G.jewelAnywhere || [];
    if (anyList.length && rr() < (G.jewelAnywhereP || 0)) {
      return { id: anyList[Math.floor(rr() * anyList.length) % anyList.length], n: n0 };
    }
    var avail = jt.filter(function (jid) {
      return (lv || 0) >= (((G.jewelMinLv || {})[jid]) || 1);
    });
    if (!avail.length) return null;
    var r = rr();
    var rp = G.jewelRareP || 0, mp = G.jewelMidP || 0;
    var idx = 0;
    if (avail.length >= 3) idx = (r < rp) ? 2 : ((r < rp + mp) ? 1 : 0);
    else if (avail.length === 2) idx = (r < rp) ? 1 : 0;
    return { id: avail[idx], n: n0 };
  };
  /* 宝物概率（**英雄等级只影响此项**，不影响资源收成 —— 原版规则） */
  GAME.gatherTreasureChance = function (g, genLv) {
    var G = DATA.GATHER;
    var hours = Math.min(((g && g.elapsed) || 0) / 3600, G.maxHours);
    if (hours < G.minHours) return 0;
    var c186 = (G.treasureBase + (genLv || 0) * G.treasurePerGenLv) * Math.sqrt(hours);
    /* v89.186（老板 3 · #2 采集增产）：据点覆盖内宝物概率加成（同受 treasureCap 封顶）
       v89.193（老板 2）：加成随前哨等级（+8%~+22%，走唯一出口 fortEffectOf） */
    var _f193b = (GAME.fortAuraAt && g && g.x != null) ? GAME.fortAuraAt(g.x, g.y) : null;
    if (_f193b) c186 += GAME.fortEffectOf(_f193b).treasureAdd;
    return Math.min(G.treasureCap, c186);
  };
  GAME.canStartGather = function (x, y) {
    var s = GAME.state, G = DATA.GATHER;
    var w = GAME.map.wildAt(x, y);
    if (!w) return { ok: false, msg: '需先占领该野地，方可派军采集' };
    if (!GAME.gatherResOf(w.type)) {
      var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '该地形';
      return { ok: false, msg: tn + '无可采之物（原版：平地不可采集）' };
    }
    if (GAME.gatherAt(x, y)) return { ok: false, msg: '该野地已在采集中' };
    if (GAME.gatherList().length >= G.maxActive) return { ok: false, msg: '同时最多 ' + G.maxActive + ' 支采集队' };
    return { ok: true, wild: w };
  };
  /* ============================================================
   * 采集（v89.136 合并定型）：**唯一形态 = 带将驻军原地开工**
   * ------------------------------------------------------------
   * 老板令：「'野地采集（0/3队）'这个弹窗界面不需要」「地块操作界面加一个采集操作
   *   （提供采集，收获按钮和采集进度显示）」「己方野地只有在有英雄带领驻军的时候才可采集」。
   * 于是"英雄带队从城里出发采集"（v89.87 行军通道）整条退役：
   *   · 旧入口已删 —— openGatherModal / dispatchGather / doStartGather / openGathers 弹窗
   *     （墓碑见 ui.js 与 main.js）；
   *   · 采集资格：该野地**有驻军且驻军有英雄**（garrison.genId）；
   *   · 兵**不离开驻军**（原地开工）——记录带 `inPlace:true`，采力动态读驻军；
   *   · 记录 `origin:'garrison'` 保留：老档迁移与"回城/回驻军"分流仍读它。
   * ============================================================ *  /* ⛔ v89.136 移除：`GAME.dispatchGather`（英雄带队采集 · 行军通道）——
     采集已合并为「带将驻军原地开工」（见上方说明）。旧链路清点：
     ① 本函数；② `doStartGather`（main.js）；③ `openGatherModal`（ui.js）；
     ④ `case 'gather-open' / 'gather-start'`；
     ⑤ battle.js 的 arrive gather 分支**保留**（仅服务老档在途行军 —— 抵达时兵并入驻军）。
     `mode 'gather'`（data.js）保留：老档在途行军的显示兜底，不再有新出发。 */
  GAME.startGather = function (x, y, army, opts) {
    var s = GAME.state, G = DATA.GATHER;
    opts = opts || {};
    var chk = GAME.canStartGather(x, y);
    if (!chk.ok) return chk;
    var w = chk.wild;
    var gar = GAME.wildGarrisonAt(x, y);
    if (!gar || !GAME.wildGarrisonTotal(gar)) return { ok: false, msg: '此地没有驻军可开采' };
    /* v89.135（老板第 5 条）：「己方野地只有在**有英雄带领驻军**的时候才可采集，
       否则不可采集，只可驻留军队」—— 无将驻军（纯增援叠上来的）只可驻留。 */
    if (!gar.genId) return { ok: false, msg: '驻军须有英雄带队方可开采（增派一名英雄驻守后再开采）' };
    var troops = 0;
    for (var k in (army || {})) troops += Math.floor(army[k] || 0);
    if (troops <= 0) return { ok: false, msg: '请派遣兵力（兵越多收成越高）' };
    var city = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var rec = {
      id: 'ga' + (s._gatherSeq = (s._gatherSeq || 0) + 1),
      x: x, y: y, type: w.type, level: w.level || 0,
      /* 带队英雄 = 驻军英雄（采集卡显示其名） */
      genId: gar.genId || null,
      army: U.deep(army), troops: troops,
      cityId: (gar.cityId || city.id), elapsed: 0,
      origin: 'garrison',
      /* v89.136：**兵在驻军（原地开工）** —— 收获/召回不搬兵。
         老档里"兵在队里"的旧式记录由 migrateLegacyGathers 迁移成此形态。 */
      inPlace: true,
    };
    GAME.gatherList().push(rec);
    GAME.statBump('gathers', 1);
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '';
    var _genName136 = '';
    (s.generals || []).forEach(function (g3) { if (g3.id === gar.genId) _genName136 = g3.name; });
    GAME.log('⛏️ 驻军（' + (_genName136 || '无将') + '带队）' + troops + ' 兵开采 ' + tn
      + ' Lv' + rec.level + '（满 1 小时方有收成，24 小时封顶）', 'sys', 'gather');
    return { ok: true, msg: '开始采集：' + troops + ' 兵（1 小时后可收获）', gather: rec };
  };
  /* 收获 */
  GAME.finishGather = function (id) {
    var s = GAME.state, G = DATA.GATHER;
    var list = GAME.gatherList();
    var idx = -1, g = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; g = list[i]; break; }
    if (!g) return { ok: false, msg: '采集队不存在' };
    var y = GAME.gatherYield(g);
    if (!y.ready) {
      /* 原版：不足 1 小时收获为零，**并重置计时** */
      g.elapsed = 0;
      GAME.log('采集不足 1 小时，无功而返（计时重新开始）', 'sys', 'gather');
      return { ok: false, msg: '不足 1 小时，收获为零（计时已重置）', reset: true };
    }
    var gen = null;
    s.generals.forEach(function (x) { if (x.id === g.genId) gen = x; });
    /* v89.159：入账要按**这支采集队所属城池**的仓容（唯一出口的参数是城对象）——
       原先的 `GAME.storeCap()` 取的是"当前城"，与入账用的 `s.res`（也是当前城）虽然自洽，
       但队列归属城才是有语义的那一座；这里显式取一次，后面归还兵将也复用。 */
    var city159 = GAME.cityById(g.cityId) || GAME.currentCity();
    /* v89.159：改走**奖励入账唯一出口**（只封增长、不削存量；装不下的量记下来报给玩家） */
    var trimmed159 = 0;
    if (y.res && y.amount > 0) {
      var _add159 = GAME.addResCapped(y.res, y.amount, city159 || GAME.cityById(g.cityId));
      trimmed159 = _add159.trimmed || 0;
    }
    /* 宝物：只有此项受英雄等级影响 */
    var got = null;
    if (Math.random() < GAME.gatherTreasureChance(g, gen ? gen.level : 0)) {
      var pool = (DATA.ITEMS || []).filter(function (it) {
        return it.price > 0 && it.type !== 'material' && it.type !== 'blueprint'
          && it.price <= G.treasureMaxPrice;
      });
      if (pool.length) {
        var tr = pool[Math.floor(Math.random() * pool.length)];
        s.items = s.items || {};
        s.items[tr.id] = (s.items[tr.id] || 0) + 1;
        got = tr.name;
      }
    }
    /* ⛔ v89.224：种子掉落退役（采集线）—— 播种改「立项」后不再需要种子。 */
    /* v89.51：辐能核心 —— "顺带所得"（调校基因强化件的产出主渠道） */
    var essGot = GAME.grantEssenceDrop(g.level || 1, 1, '✨ 采集所得辐能核心');
    /* v89.179c：高阶加速宝物 —— 采集归来的额外掉落（主渠道，mult=1）。
       与精华掉落同构，只在 BOOST_DROP 表里掷（pct ≥ 0.5 的高阶货，概率压低）。 */
    var boostGot = GAME.grantBoostDrop(g.level || 1, 1, '🎁 采集所得加速宝物');
    /* v89.135（老板「为啥没有珠宝（比如湖泊里有珍珠）」）：**按地形出珠宝** ——
       与"宝物"（只受英雄等级影响的小概率小件）独立的一路，任何采集都掉。
       v89.139（老板 4）：「威望晋升需要的珠宝…由采集产出」——
       挑选与数量全部走唯一出口 `GAME.gatherJewelPick`（见上方定义）。 */
    var jewelGot = null;
    if (Math.random() < Math.min(0.85, (G.jewelChance || 0) + (g.level || 0) * (G.jewelPerLv || 0))) {
      var _jp = GAME.gatherJewelPick(g.type, g.level || 0);
      if (_jp) {
        s.items = s.items || {};
        s.items[_jp.id] = (s.items[_jp.id] || 0) + _jp.n;
        var jn = _jp.id;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === _jp.id) jn = x.name; });
        jewelGot = jn + '×' + _jp.n;
      }
    }
    /* 兵力与英雄归还 —— v89.136 三态：
       ① origin==='garrison' && inPlace（新式）：兵在驻军里，什么都不搬；
       ② origin==='garrison' && !inPlace（**老档旧式**：v89.135 前"从驻军抽兵"的记录）：
          兵在队里 → **回驻军**（溢出回城）。⚠ 这正是老板报「驻军丢失」的路径 ——
          v89.135 的"不搬"逻辑撞上旧式记录 = 兵凭空消失；此分支为**防御兜底**
          （正常已被 migrateLegacyGathers 迁移为 inPlace —— 防御只为"迁移未跑到"时保命）；
       ③ 其余（英雄带队老记录）：兵回城。 */
    var city = GAME.cityById(g.cityId) || GAME.currentCity();
    if (g.origin === 'garrison') {
      if (!g.inPlace && GAME.wildGarrisonAdd) {
        var _bk136 = GAME.wildGarrisonAdd(g.x, g.y, g.army, g.cityId);
        if (_bk136 && _bk136.overflow) {
          for (var _ao136 in _bk136.overflow) {
            if (city) city.army[_ao136] = (city.army[_ao136] || 0) + _bk136.overflow[_ao136];
          }
        }
      }
    } else if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }
    if (gen && g.origin !== 'garrison') {
      /* v89.135：驻军开采的带队英雄**仍在驻守**（status='garrison' 不动）——
         只有英雄带队那条老路才在此收工回城。 */
      gen.status = 'idle';
      gen.cityId = city ? city.id : null;
      /* v26（需求 1）：统一走唯一入口 —— 顺带把这次获得的经验写进公文，
         原先裸加时玩家完全看不到采集也会涨经验。 */
      GAME.battle.gainExp(gen, Math.round(y.amount / 500) + 20, '采集归来');
    }
    list.splice(idx, 1);
    var resName = '';
    DATA.RESOURCES.forEach(function (r) { if (r.key === y.res) resName = r.name; });
    /* v89.153（老板 3）：「为啥现在的采集收获看不到珠宝数量的，按野地采集产出显示所有收获」
       —— 收获明细**逐项列出、各带数量**（资源 / 宝物 / 珠宝 / 辐能核心）。
       所有出口（toast / 公文 / 自动采集 / 试玩工具）都读这一段 —— **收获明细只有一个出口**。 */
    var _ter153 = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : '野地';
    var _gains153 = [(resName || '资源') + ' +' + U.fmt(y.amount)
      + (trimmed159 > 0 ? '（仓容已满，' + U.fmt(trimmed159) + ' 未入库）' : '')];
    if (got) _gains153.push('宝物「' + got + '」');
    if (jewelGot) _gains153.push('珠宝 ' + jewelGot);      /* jewelGot 已是「珍珠×2」形状 */
    if (essGot.length) _gains153.push(essGot.join('、'));
    /* v89.179c：高阶加速宝物（采集掉落）· 配额用尽时**明说** ——
       否则玩家看到"这次怎么没有"却没有任何解释（项目铁律：不留哑谜/死路）。 */
    if (boostGot.length) _gains153.push(boostGot.join('、'));
    else if (GAME.boostDropLeft() <= 0) _gains153.push('高阶宝物今日配额已用尽（次日重置）');
    var rewardText = _gains153.join('；');
    var msg = '采集收获（' + _ter153 + ' Lv' + (g.level || 0) + '）：' + rewardText;
    GAME.log('📦 ' + msg, 'sys', 'gather');
    return { ok: true, msg: msg, rewardText: rewardText, res: y.res, amount: y.amount,
      trimmed: trimmed159, cur: GAME.res(city159)[y.res], cityId: city159 ? city159.id : null,
      treasure: got, jewel: jewelGot, essence: essGot, boost: boostGot };
  };
  /* ============================================================
   * v89.128（老板 需求 5）：「增加自动采集和自动收获功能，每 24h 执行一次。
   *   如果野地存在驻军且可采集，所有驻军进入采集状态。」
   * ------------------------------------------------------------
   * 节奏：每 **24 游戏小时** 一轮（与采集封顶 maxHours 同轴）——轮点先**收获**
   *   （ready 的采集队结算，兵力按既有口径回驻军），再**开采集**
   *   （有驻军、可采集、且尚无采集队的野地 → 驻军**全部**转入采集）。
   * 开关 = settings.autoGather；状态 = s.autoGatherState { lastAt, msg, at }。
   * 与手动操作同一批出口（startGather / finishGather）——不另写第二套结算。
   * ============================================================ */
  GAME.autoGatherTick = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoGather) return null;
    var now = (s.world && s.world.elapsed) || 0;
    var st = s.autoGatherState = s.autoGatherState || { lastAt: now - 86400, msg: '', at: 0, lastChk: null };
    /* v89.135（老板第 9 条）：「只要有**空闲采集队**即进行自动采集，只要有采集队**采集满 24h**，
       即执行自动收获」—— 从"每 24 小时一轮"改成**事件驱动**：
       · 收获：任何队 `capReached`（满 24 游戏小时封顶）→ 立即结算；
       · 采集：队伍数未满（有空闲编制）且有"带将驻军 + 可采"的野地 → 立即开工。
       检查粒度 60 游戏秒（收的时机误差 ≤1 分钟游戏时；避免每 tick 全境遍历）。 */
    /* 首次检查必跑（lastChk=null）；此后 60 游戏秒节流 */
    if (st.lastChk != null && now - st.lastChk < 60) return null;
    st.lastChk = now;
    st.lastAt = now;
    st.at = U.now();
    var done = [];
    /* ① 收获：满 24 游戏小时（收益封顶）的采集队立即结算 */
    (GAME.gatherList() || []).slice().forEach(function (g) {
      var y = GAME.gatherYield(g);
      if (y && y.capReached) {
        var r = GAME.finishGather(g.id);
        if (r && r.ok) {
          /* v89.153（老板 3）：自动收获也**列全产出**（改前只写"收 X"——珠宝看不见） */
          var _tn153b = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : '野地';
          done.push(_tn153b + ' Lv' + (g.level || 0) + ' ' + (r.rewardText || ('+' + U.fmt(r.amount || 0))));
        }
      }
    });
    /* ② 采集：有空闲编制 + 带将驻军 + 尚未开采 → 立即开工（"有将"= 老板第 5 条） */
    (s.wilds || []).forEach(function (w) {
      if (GAME.gatherList().length >= DATA.GATHER.maxActive) return;   /* 无空闲编制 */
      if (!(GAME.wildGarrisonTotal(w.garrison) > 0)) return;
      if (!w.garrison.genId) return;                                    /* 无将驻军：只驻留不采 */
      if (GAME.gatherAt(w.x, w.y)) return;                              /* 已在采 */
      var chk = GAME.canStartGather(w.x, w.y);
      if (!chk.ok) return;
      var army = U.deep(w.garrison.troops);
      var r2 = GAME.startGather(w.x, w.y, army, { cityId: w.garrison.cityId });   /* v89.136：新签名（唯一形态） */
      if (r2 && r2.ok) done.push('采(' + w.x + ',' + w.y + ')');
    });
    if (!done.length) return null;    /* 无事不写日志（事件驱动：有事才报） */
    var msg = '本轮：' + done.join('、');
    st.msg = msg;
    /* v89.155（老板 1）：采集类消息归「采集收获」主题 —— 原先误标 'war'（军情）→
       老板在系统页看到"采集收获与军情两处重合"的根源，此处归位。 */
    GAME.log('🌾 自动采集/收获：' + msg, 'sys', 'gather');
    return { ok: true, msg: msg };
  };

  /* ============================================================
   * v89.190（老板 2）：**自动征兵** —— 配置 / 判别 / 执行（唯一出口组）
   * ------------------------------------------------------------
   * 老板原话：「自动征兵。构思界面，提供设置，包括触发条件，停止条件，
   *   目标兵种，可用栏位（与对应城池内可用兵营募兵队列相关，提供判别机制）等等」。
   * 口径（全境统一规则、逐城独立执行 —— 各用各的城池资源与训练营队列）：
   *   · 触发条件：某城某兵种（驻军 + 在训 + 排队）低于「触发线 min」→ 补单
   *     （min 设 0 = 只要低于「目标 max」就补）；
   *   · 停止条件：达到 max 即停 · 旧币低于 goldKeep / 本城粮低于 grainKeep 即停 ·
   *     训练营队列满 → 本轮跳过（消化后自动继续；开关不会自己关）；
   *   · 目标兵种：非器械全兵种（器械走机工坊队列，本系统不碰）；
   *   · 可用栏位：逐训练营判别空位（trainQueueSlots / trainQueuesOf 唯一出口），
   *     只往有空位的训练营放单；单笔数量 ≤「缺口 / 可募上限」（trainLimitOf 城版）。
   * 执行 = GAME.autoTrainTick（主循环挂钩 · 节流 DATA.AUTO_TRAIN.gapMs · 无事不写日志）。
   * ============================================================ */
  GAME.autoTrainDefault = function () {
    var o = { targets: {}, goldKeep: 0, grainKeep: 0, log: [], msg: '', at: 0 };
    Object.keys(DATA.TROOPS || {}).forEach(function (id) {
      if (!DATA.TROOPS[id].craft) o.targets[id] = { min: 0, max: 0 };
    });
    return o;
  };
  GAME.autoTrainCfg = function () {
    var s = GAME.state;
    if (!s) return null;
    s.autoTrain = s.autoTrain || GAME.autoTrainDefault();
    var c = s.autoTrain;
    if (!c.targets) c.targets = {};
    Object.keys(DATA.TROOPS || {}).forEach(function (id) {
      if (DATA.TROOPS[id].craft) return;
      if (!c.targets[id]) c.targets[id] = { min: 0, max: 0 };
      if (c.targets[id].min == null) c.targets[id].min = 0;
      if (c.targets[id].max == null) c.targets[id].max = 0;
    });
    if (!(c.goldKeep >= 0)) c.goldKeep = 0;
    if (!(c.grainKeep >= 0)) c.grainKeep = 0;
    if (!c.log) c.log = [];
    if (c.msg == null) c.msg = '';
    return c;
  };
  GAME.autoTrainSet = function (k, troopId, val) {
    var c = GAME.autoTrainCfg();
    if (!c) return null;
    var n = Math.floor(Number(val));
    if (!isFinite(n) || n < 0) n = 0;
    if (n > 9999999) n = 9999999;
    if (k === 'goldKeep' || k === 'grainKeep') { c[k] = n; return { ok: true, msg: '' }; }
    if ((k === 'min' || k === 'max') && c.targets[troopId]) {
      c.targets[troopId][k] = n;
      return { ok: true, msg: '' };
    }
    return { ok: false, msg: '未知设置项' };
  };
  /* 逐城判别（唯一出口）：训练营空位 + 各目标兵种的缺口。界面与执行共读。 */
  GAME.autoTrainPlanOf = function (city) {
    var out = { city: city, bars: [], left: 0, total: 0, needs: [] };
    if (!city) return out;
    var c = GAME.autoTrainCfg();
    GAME.barracksOf(city).forEach(function (b) {
      var slots = GAME.trainQueueSlots(b.lvl, city);
      var used = GAME.trainQueuesOf(city, b.idx, 'train').length;
      out.bars.push({ idx: b.idx, lvl: b.lvl, slots: slots, used: used, left: Math.max(0, slots - used) });
      out.total += slots;
      out.left += Math.max(0, slots - used);
    });
    /* 在训（含排队）：逐兵种汇总本城全部训练营的队列 */
    var queued = {};
    ((GAME.state || {}).queues && (GAME.state.queues.train || [])).forEach(function (q) {
      if (q.cityId !== city.id || GAME.queueKindOf(q.kind) !== 'train') return;
      queued[q.troopId] = (queued[q.troopId] || 0) + (q.count || 0);
    });
    if (!c) return out;
    Object.keys(c.targets || {}).forEach(function (id) {
      var max = Math.max(0, Math.floor((c.targets[id] || {}).max || 0));
      if (max <= 0) return;                                /* 未参与 */
      var have = (city.army && city.army[id]) || 0;
      var qn = queued[id] || 0;
      var cur = have + qn;
      var min = Math.max(0, Math.floor((c.targets[id] || {}).min || 0));
      var need = 0;
      if (cur < (min > 0 ? min : max)) need = max - cur;   /* 触发线缺省 = 目标（低于就补） */
      out.needs.push({ troopId: id, have: have, queued: qn, cur: cur, min: min, max: max, need: Math.max(0, need) });
    });
    return out;
  };
  GAME.autoTrainTick = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoTrain) return null;
    var c = GAME.autoTrainCfg();
    if (!c) return null;
    var gapMs = (DATA.AUTO_TRAIN || {}).gapMs || 10000;
    var now = U.now();
    if (c.at && now - c.at < gapMs) return null;           /* 节流（at=0 → 立即跑） */
    c.at = now;
    var hasTarget = false;
    Object.keys(c.targets || {}).forEach(function (id) { if ((c.targets[id].max || 0) > 0) hasTarget = true; });
    if (!hasTarget) { c.msg = '未设目标 —— 在下方为兵种设置「触发线 / 目标」后生效'; return null; }
    var done = 0, notes = [], acted = [];
    var gKeep = Math.max(0, Math.floor(c.goldKeep || 0));
    var rKeep = Math.max(0, Math.floor(c.grainKeep || 0));
    (s.cities || []).forEach(function (ct) {
      var plan = GAME.autoTrainPlanOf(ct);
      if (!plan.bars.length || !plan.needs.length) return;   /* 无训练营 / 无参与兵种 */
      var pending = plan.needs.filter(function (n) { return n.need > 0; });
      if (!pending.length) return;                           /* 已达标 */
      if (plan.left <= 0) { notes.push(ct.name + ' 队列已满'); return; }
      pending.forEach(function (nd) {
        var left = nd.need;
        var guard = 0;
        while (left > 0 && guard++ < 12) {
          /* 停止条件（逐单实时复核：金是全境池、粮是本城） */
          if (gKeep > 0 && (GAME.goldOf ? GAME.goldOf() : 0) < gKeep) { notes.push('旧币低于保底'); return; }
          if (rKeep > 0 && ((GAME.res(ct).grain || 0) < rKeep)) { notes.push(ct.name + ' 净水低于保底'); return; }
          var bar = null;
          for (var i = 0; i < plan.bars.length; i++) { if (plan.bars[i].left > 0) { bar = plan.bars[i]; break; } }
          if (!bar) { notes.push(ct.name + ' 队列已满'); return; }
          var lim = GAME.trainLimitOf(nd.troopId, ct);
          var cnt = Math.min(left, lim.cap);
          if (!(cnt > 0)) {
            notes.push(ct.name + ' ' + ((DATA.TROOPS[nd.troopId] || {}).name || nd.troopId) +
              (lim.reason === 'pop' ? ' 可征幸存者不足' : ' 资源不足'));
            return;
          }
          var r2 = GAME.train(nd.troopId, cnt, ct.id, bar.idx);
          if (!r2.ok) { notes.push(ct.name + '：' + r2.msg); return; }
          bar.left -= 1;
          left -= cnt;
          done++;
          acted.push({ city: ct.name, troop: (DATA.TROOPS[nd.troopId] || {}).name || nd.troopId, count: cnt });
        }
      });
    });
    /* 摘要 + 触发记录（只记「真补了单」的；无事不写日志，与自动采集同规） */
    if (done > 0) {
      var txts = acted.slice(0, 4).map(function (x) { return x.city + ' ' + x.troop + ' ×' + U.fmt(x.count); });
      c.msg = '本轮补入 ' + done + ' 单：' + txts.join('、') + (acted.length > 4 ? ' 等' : '');
      acted.forEach(function (x) { c.log.unshift({ t: U.now(), city: x.city, troop: x.troop, count: x.count }); });
      while (c.log.length > ((DATA.AUTO_TRAIN || {}).logMax || 8)) c.log.pop();
      GAME.log('🛡️ 自动征兵：' + c.msg.replace('本轮补入 ', '补入 '), 'war');
    } else if (notes.length) {
      c.msg = '暂停：' + notes[0] + (notes.length > 1 ? '（等 ' + notes.length + ' 项）' : '');
    } else {
      c.msg = '待命 —— 各城已达标';
    }
    return { done: done, acted: acted, notes: notes };
  };

  /* 放弃采集（兵力返还、无任何收益 —— 原版规则） */
  GAME.abandonGather = function (id) {
    var s = GAME.state;
    var list = GAME.gatherList();
    var idx = -1, g = null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; g = list[i]; break; }
    if (!g) return { ok: false, msg: '采集队不存在' };
    var gen = null;
    s.generals.forEach(function (x) { if (x.id === g.genId) gen = x; });
    var city = GAME.cityById(g.cityId) || GAME.currentCity();
    if (g.origin === 'garrison') {
      /* v89.136：新式（inPlace）= 兵从未离开驻军，召回只是停止开采；
         **老档旧式（!inPlace）** = 兵在队里 → 回驻军（溢出回城） ——
         与 finishGather 同一防御（老板「驻军丢失」的另一条路径）。 */
      if (!g.inPlace && GAME.wildGarrisonAdd) {
        var _bk136b = GAME.wildGarrisonAdd(g.x, g.y, g.army, g.cityId);
        if (_bk136b && _bk136b.overflow) {
          for (var _ao136b in _bk136b.overflow) {
            if (city) city.army[_ao136b] = (city.army[_ao136b] || 0) + _bk136b.overflow[_ao136b];
          }
        }
      }
    } else if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }
    if (gen && g.origin !== 'garrison') { gen.status = 'idle'; gen.cityId = city ? city.id : null; }
    list.splice(idx, 1);
    GAME.log(g.origin === 'garrison' ? '停止驻军开采（驻军原地保留）' : '撤回采集队（无收益）', 'sys', 'gather');
    return { ok: true, msg: g.origin === 'garrison' ? '已停止开采（驻军原地保留）' : '已撤回，兵力归还（放弃采集无收益）' };
  };
  /* ============================================================
   * v89.152：珠宝体系重设 —— **老档库存等值换算**（唯一出口 · 幂等）
   * ------------------------------------------------------------
   * 老板：「目前的珠宝体系更换掉（实际上就是换掉名字）」—— 旧 15 种珠宝整批退役，
   * 新体系 18 种（见 data.js 珠宝段）。老档 s.items 里的旧 id 按 `DATA.JEWEL_MIG152`
   * （price 一一对应的**等值**换算表）搬到新 id —— 玩家资产零损耗。
   * 算法：**先把旧键全部摘下（读出 + 删除），再统一写入目标键** ——
   *   新旧 id 有同名者（旧夜光珠 48 -> 蛋白石；新夜光珠 150 是另一颗），
   *   摘与写分两步就天然安全（不会自我叠加）。
   * 幂等：处理完置 `s.jewelMig152 = 1`（入档）；重复调用零成本。
   * 调用：loadGame 之后 + tickOnce 兜底（与 migrateLegacyGathers 同款双保险）。
   * ============================================================ */
  GAME.migrateJewels152 = function () {
    var s = GAME.state;
    if (!s || s.jewelMig152) return 0;
    var map = DATA.JEWEL_MIG152 || {};
    var carried = {}, n = 0;
    s.items = s.items || {};
    Object.keys(map).forEach(function (oldId) {
      var v = Math.floor(s.items[oldId] || 0);
      if (!v) return;
      delete s.items[oldId];
      var to = map[oldId];
      carried[to] = (carried[to] || 0) + v;
      n += v;
    });
    Object.keys(carried).forEach(function (to) { s.items[to] = (s.items[to] || 0) + carried[to]; });
    s.jewelMig152 = 1;
    if (n > 0) GAME.log('💎 老档珠宝换算：' + n + ' 颗旧珠宝已按等值换成新体系珠宝');
    return n;
  };
  /* ============================================================
   * v89.136（老板报「驻军丢失」）—— **老档采集队迁移**（唯一出口）
   * ------------------------------------------------------------
   * 病根：v89.135 把"驻军开采"从「从驻军抽兵、收获时还兵」改成「原地开工、不抽不还」，
   *   但**两代记录形状相同**（都是 origin:'garrison' + army）——旧档里"兵在队里"的
   *   采集队，在新代码下点收获 = 兵不回驻军 = **兵力凭空消失**（老板实测「驻军丢失」）。
   * 修法（双保险）：
   *   ① 本函数（迁移）：读档/首 tick 把旧式记录**就地转为新形态** —— 兵按 noCap 加回驻军
   *      （它们本来就是从这个驻军的编制里抽出去的；野地易主则回城），标记 `inPlace:true`；
   *   ② finishGather / abandonGather 的防御分支：万一仍有旧式记录被结算，按旧口径还兵。
   * 幂等：处理完置 `s._gatherMigrated`（入档）—— 重复调用零成本。
   * ============================================================ */
  GAME.migrateLegacyGathers = function () {
    var s = GAME.state;
    if (!s || s._gatherMigrated) return 0;
    var list = GAME.gatherList();
    var n = 0;
    list.slice().forEach(function (g) {
      if (g.origin !== 'garrison' || g.inPlace) return;   /* 只转"兵在队里"的旧式 */
      var w = (GAME.map && GAME.map.wildAt) ? GAME.map.wildAt(g.x, g.y) : null;
      var city = GAME.cityById(g.cityId) || GAME.currentCity() || (s.cities || [])[0] || null;
      if (!w) {
        /* 野地已非我方：兵回城，该队移除（不丢兵） */
        if (city) { for (var a in (g.army || {})) city.army[a] = (city.army[a] || 0) + (g.army[a] || 0); }
        var ii = list.indexOf(g);
        if (ii >= 0) list.splice(ii, 1);
        GAME.log('🧭 老档迁移：采集队（' + g.x + ',' + g.y + '）所在野地已易主，兵力已回城');
        n++;
        return;
      }
      /* 兵回驻军（noCap：占领可超上限 —— 这些兵本来就驻在这里） */
      var bk = GAME.wildGarrisonAdd(g.x, g.y, g.army, g.cityId, { noCap: true });
      if (bk && bk.overflow) {
        for (var ao in bk.overflow) {
          if (city) city.army[ao] = (city.army[ao] || 0) + bk.overflow[ao];
        }
      }
      g.inPlace = true;
      n++;
    });
    s._gatherMigrated = true;   /* 放最后：中途异常则下次重试（已转的会跳过） */
    /* v89.155（老板 1）：老档迁移提示 = 一次性系统通知 → 归「系统」（原 'war' 会混进军情） */
    if (n) GAME.log('🧭 老档采集队迁移完成：' + n + ' 支（兵力已归驻军，采集照常 · 原地开工）', 'sys');
    return n;
  };
  /* 按「由弱到强」抽调兵力（采集用；采集收益只看兵力总数，不看兵种）。
     这样玩家只需填一个数字，不必逐兵种分配。 */
  GAME.autoPickTroops = function (count, city) {
    city = city || GAME.currentCity();
    if (!city) return {};
    var avail = [];
    for (var id in (city.army || {})) {
      if (city.army[id] > 0 && DATA.TROOPS[id]) avail.push({ id: id, n: city.army[id], atk: DATA.TROOPS[id].atk });
    }
    avail.sort(function (a, b) { return a.atk - b.atk; });
    var out = {}, left = Math.max(0, Math.floor(Number(count) || 0));
    for (var i = 0; i < avail.length && left > 0; i++) {
      var take = Math.min(left, avail[i].n);
      if (take > 0) { out[avail[i].id] = take; left -= take; }
    }
    return out;
  };
  /* 采集推进（主循环每秒调用）：不满 24 游戏小时则累加 */
  GAME.tickGathers = function (ts) {
    var list = GAME.gatherList(), G = DATA.GATHER;
    var maxSec = G.maxHours * 3600;
    for (var i = 0; i < list.length; i++) {
      if (list[i].elapsed < maxSec) {
        list[i].elapsed = Math.min(maxSec, list[i].elapsed + ts);
      }
    }
  };
  /* 被占野地每现实日衰减（v89.185 起基础 2 级；有驻军减半为 1 级；最低 1 级）；
     无主野地由日盐自动 +1 级。 */
  GAME.decayWilds = function () {
    var s = GAME.state;
    if (!s || !s.wilds || !s.wilds.length) return [];
    var WD_ = DATA.WILD_DECAY || { perDay: 2, heldPerDay: 1 };
    var today = GAME.questDayIndex ? GAME.questDayIndex() : Math.floor(Date.now() / 86400000);
    var changed = [];
    s.wilds.forEach(function (w) {
      if (w.levelDay == null) { w.levelDay = today; return; }
      /* v89.185（老板 3）：「有驻军嚯嚯，等级确实应该降低更快，每个现实日降 2 级」——
         驻军不再"免衰减"（v23 旧口径：1 兵驻军即可白嫖保鲜），改为**减半**（2 → 1）；
         且**任何保护都不能把衰减降到 0** —— 老板第 5 条：「即使这样，我还是建议等级衰竭每天-1」。 */
      /* v89.186（老板 3 · #1 前哨效应）：据点覆盖内衰减**减半**（-2 → -1）——
         与驻军同档、**取档不叠加**（两者都在时仍是 -1，不为 0 —— 「至少 -1/日」口径）。 */
      var _hold186 = GAME.wildHeld(w) || (GAME.fortAuraAt && GAME.fortAuraAt(w.x, w.y));
      var step = _hold186 ? Math.max(1, WD_.heldPerDay) : Math.max(1, WD_.perDay);
      var days = today - w.levelDay;
      if (days <= 0) return;
      var nl = Math.max(1, (w.level || 1) - days * step);
      w.levelDay = today;
      if (nl !== w.level) { w.level = nl; changed.push(w); }
    });
    if (changed.length) {
      GAME.log('⚠️ 久据之下野地渐荒：' + changed.length + ' 块野地等级下降（每现实日 -' + (WD_.perDay || 2)
        + ' 级 · 有驻军/前哨覆盖 -' + (WD_.heldPerDay || 1) + ' 级 · 需轮换争夺）');
    }
    return changed;
  };


  /* ============================================================
   * 自动升级：按等级从低到高，自动升级城内/城外建筑
   * 规则：
   *   · 受建造队列上限约束（默认 2，征调令可 +3）
   *   · 同等级优先城战技能建筑，再城外资源地块
   *   · 政务厅 4 格同体，只取一格代表发起
   *   · 资源不足 → 暂停并记录原因（不关闭开关）
   *   · 全部满级 → 停止
   * ============================================================ */
  /* ⛔ v89.104（老板）：「自动界面无需预算阀门及其相关逻辑，不要这个功能组件」
     —— `autoReservePct` / `autoBudgetCheck` 两件套连同两处调用（自动升级 / 自动研究）
     整体退役。为什么不再需要：自动化现在**只做玩家点过的事**（升级候选来自建造队列、
     研究候选来自研习所），资源不足本来就只跳过当项、不掏空家底；
     阀门那层"近似保险"反而制造了"明明有钱却不干活"的困惑。
     ⚠️ `settings.autoReservePct` / `autoTechMaxLv` 两个入档字段保留（旧档可读，值为历史遗留），
     但**全库不再有人读它们** —— 见 data.js 的同名注释。 */

  /* ⛔ v89.104：`autoCostOfCandidate` 随预算闸门退役 ——
     它是"花之前先算一遍"的那层保护；现在自动化逐个**真试**（upgradeAt 自带校验），
     所以预估价这个中间量不再需要（少一个可能与真实支出漂移的口径）。 */

;

  GAME.autoUpgrade = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoUpgrade) return null;
    var city = GAME.currentCity() || s.cities[0];
    if (!city) return null;

    /* v89.167（老板）：「自动升级建造，应该每个城池均遍历，分别升级，而不是所有城池一起，
       总共只升级 3 个建筑」——
       改前闸门 = **全境队列总数** vs `buildSlots(当前城)`：全境一共只排 3 条
       （3 = 单城基础建造位）就报"队列已满"，其余城池永远轮不上。
       改后 = **每城独立**：各城在办数 vs 各城自己的建造位（buildQueueUsed / buildSlots
       两个既有出口）；一次调用把所有城的空位尽量排满（逐城遍历、各自封顶）。 */
    var cityRoomOf = function (ct) {
      return GAME.buildQueueUsed(ct.id) < GAME.buildSlots(ct);
    };
    if (!(s.cities || []).some(cityRoomOf)) {
      var totSlots167 = 0;
      (s.cities || []).forEach(function (ct) { totSlots167 += GAME.buildSlots(ct); });
      s.autoState = { paused: false, msg: '各城队列已满（合 ' + totSlots167 + ' 位在办 · 每城独立）' };
      return null;
    }

    /* 收集候选：城内 + 城外，两者均**遍历所有城池**（v14 支持多城经营） */
    var multi = (s.cities || []).length > 1;
    var cands = [];
    (s.cities || []).forEach(function (ct) {
      if (!cityRoomOf(ct)) return;   /* v89.167：该城本轮位满 → 整城跳过（不是失败） */
      var gfFirst = -1;
      for (var ci = 0; ci < ct.cells.length; ci++) {
        if (ct.cells[ci] && ct.cells[ci].official) { gfFirst = ci; break; }
      }
      ct.cells.forEach(function (cell, idx) {
        if (!cell || !cell.build || cell.pending) return;
        var b = DATA.BUILDINGS[cell.build.id];
        if (!b || cell.build.lvl >= GAME.buildCapOf(ct, b.id, cell.build)) return;   /* v89.220：本座宽限 */
        if (cell.official && idx !== gfFirst) return;   // 政务厅 4 格只取一格代表
        cands.push({ kind: 'city', idx: idx, cityId: ct.id, lv: cell.build.lvl,
          name: (multi ? ct.name + '·' : '') + b.name });
      });
      /* v89.128：环城槽的围墙也进候选（不占格，与城内建筑同列） */
      var _w128 = GAME.cellOf(ct, 'wall');
      if (_w128 && _w128.build && !_w128.pending && _w128.build.lvl < GAME.buildCapOf(ct, 'chengqiang', _w128.build)) {
        cands.push({ kind: 'city', idx: 'wall', cityId: ct.id, lv: _w128.build.lvl,
          name: (multi ? ct.name + '·' : '') + '围墙' });
      }
    });
    (s.cities || []).forEach(function (ct) {
      if (!cityRoomOf(ct)) return;   /* v89.167：同上（城外候选） */
      (ct.extGrid || []).forEach(function (e, idx) {
        if (!e || !e.type || e.pending) return;
        var eb = DATA.EXT_BUILDINGS[e.type];
        if (!eb || e.lv >= GAME.buildCapOf(ct)) return;
        cands.push({ kind: 'ext', idx: idx, cityId: ct.id, lv: e.lv,
          name: (multi ? ct.name + '·' : '') + eb.name });
      });
    });

    /* v89.126：围墙占格后**并入上面的 cells 候选扫描**（天然包含它）——
       原"围墙单独候选 + wallPendingOf 防重排"整段退役。 */

    if (!cands.length) {
      s.autoState = { paused: false, done: true, msg: '全部建筑已满级（含围墙）' };
      return null;
    }

    /* v89.160（老板 2）：「取消城内优先」—— `KIND_ORD` 的城内/城外分档**整条退役**：
       现在只按**等级从低到高**排；同级沿用**候选收集序**（城内格 → 围墙 → 城外格）——
       它是"遍历顺序"，不是"城内优先"这类优先级规则（改前同级时城内建筑一定先上）。
       同级若要再定一条规则（如"便宜的先"），加一个键即可。 */
    cands.forEach(function (c, i) { c.ord = i; });
    cands.sort(function (a, b) {
      if (a.lv !== b.lv) return a.lv - b.lv;
      return a.ord - b.ord;
    });

    /* v89.104（老板）：「不要这个功能组件」—— 预算闸门与它的 gated 收集一并退役：
       现在**逐个试**；v89.160 起"资源不足"不再当场暂停，而是**顺延**（见循环内注释）。 */
    var blocked160 = null;   /* 第一处"资源不足"（全部试遍后用它做暂停文案） */
    var lastFail160 = '';    /* 最后一个失败原因（非资源类，供状态行显示） */
    /* v89.167（老板 2 · 每城分别升级）：试建循环从"第一条成功就 return"改为**把各城空位排满** ——
       成功一项继续试下一项（upgradeAt 内部自带按城位检查 checkBuildSlot，"排满"天然按城封顶）；
       某城本轮排满后，其后续候选直接跳过（不算失败，不污染 lastFail160）。 */
    var first167 = null, last167 = null, doneN167 = 0;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var cCty167 = GAME.cityById(c.cityId);
      if (cCty167 && !cityRoomOf(cCty167)) continue;      /* 该城本轮已排满 → 跳过（非失败） */
      /* v89.104：预算闸门退役（见函数群注释）—— 资源不足只跳过当项 */
      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)
        : GAME.upgradeAt(c.cityId || city.id, c.idx);
      if (r && r.ok) {
        doneN167++;
        if (!first167) first167 = c;
        last167 = c;
        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1), 'sys', 'build');
        continue;                                          /* v89.167：继续试下一项（排满各城空位） */
      }
      /* v89.160（老板 2）：「某建筑资源不足时，**顺延升级下一个建筑**，
         直至所有可升级建筑均无法升级，或所有建筑均达到当前等级上限」——
         改前：第一项不足就 return（暂停）→ 后面明明升得起的项永远轮不到。
         改后：不足项**记下来继续试**；只有**全部试遍仍无一可动**才置暂停态（并说明原因）。
         （"试遍"= 真调一次升级入口，所以前置未满足 / 施工中 / 队列满等原因也一并顺延。） */
      /* v89.194：缺料提示统一走 costLackMsg（"缺 净水 …"/"缺 金 …"）——资源类判定跟进；
         旧的"…不足"（珠宝不足 / 本城资源不足 / 可征幸存者不足等）一并兼容。 */
      if (r && !r.ok && /(不足|缺 )/.test(r.msg) && !blocked160) blocked160 = { reason: r.msg, target: c };
      if (r && !r.ok) lastFail160 = r.msg || '';
    }
    /* v89.167：本轮有排入 → 报"本轮排入 N 项（各城独立建造位）"；
       target 仍取**第一条成功**（兼容老断言语义），新增 last / count 供界面与测试使用。 */
    if (doneN167 > 0) {
      s.autoState = { paused: false, last: last167.name,
        msg: '本轮排入 ' + doneN167 + ' 项（各城独立建造位）· 最新：' + last167.name + ' → Lv' + (last167.lv + 1) };
      return { ok: true, target: first167, last: last167, count: doneN167 };
    }
    if (blocked160) {
      s.autoState = { paused: true, reason: blocked160.reason, want: blocked160.target.name,
        msg: '资源不足，暂停中（' + cands.length + ' 项试遍 · 待升级 ' + blocked160.target.name + '）' };
      return { paused: true, reason: blocked160.reason, target: blocked160.target };
    }
    s.autoState = { paused: false, msg: lastFail160 ? ('暂无可升级项（' + lastFail160 + '）') : '暂无可升级项' };
    return null;
  };

  /* ============================================================
   * v89.86（整改 P-07）：建造 / 科技队列的**花金提速** —— 旧币消耗出口
   * ------------------------------------------------------------
   * 背景：后期旧币 30 万+闲置；v89.49 已给募兵队列开「花金买时间」，
   *       交易站有金→资源、派系有捐资 —— 这里把同一把尺子接到**建造 / 科技**队列：
   *   立即完成价 = 工程价值 × 20% × 剩余比例（不足 1 旧币按 1 旧币）。
   * 入口：建筑面板（城内 / 城外 / 围墙施工中）与科技面板「研究中」行的 ⚡。
   * ============================================================ */
  GAME.QUEUE_RUSH_PCT = 0.2;
  /* 在办工程的价值（= 该项工程的原始造价总额；按队列自身数据回算，不依赖渲染下标） */
  GAME.queueValueOf = function (q) {
    if (!q) return 0;
    var cost = null;
    if (q.type === 'build') {
      var b1 = DATA.BUILDINGS[q.buildId];
      cost = b1 ? b1.buildCost : null;
    } else if (q.type === 'upgrade') {
      var b2 = DATA.BUILDINGS[q.buildId];
      cost = b2 ? b2.levelCost((q.targetLevel || 2) - 1) : null;
    } else if (q.type === 'ext_build' || q.type === 'ext_upgrade') {
      cost = GAME.extBuildCost(q.buildId, q.type === 'ext_build' ? 0 : Math.max(0, (q.targetLevel || 2) - 1));
    } else if (q.techId) {
      var t = null;
      (DATA.TECH || []).forEach(function (x) { if (x.id === q.techId) t = x; });
      /* v89.191：按**队列条目所属城**读当前等级（提速估值与完成时同源）。 */
      var _qct191 = q.cityId ? GAME.cityById(q.cityId) : null;
      cost = t ? DATA.techCost(t, ((_qct191 && _qct191.techs && _qct191.techs[q.techId]) || 0) + 1) : null;
    }
    if (!cost) return 0;
    var v = 0;
    for (var k in cost) { if (k === 'time') continue; v += cost[k] || 0; }
    return Math.round(v);
  };
  GAME.queueRushCost = function (q) {
    if (!q || !q.totalTime) return 0;
    var remain = Math.max(0, Math.min(1, 1 - (q.elapsed || 0) / q.totalTime));
    if (!(remain > 0)) return 0;
    return Math.max(1, Math.ceil(GAME.queueValueOf(q) * GAME.QUEUE_RUSH_PCT * remain));
  };
  /* 按位置/类型找在办工程（不依赖渲染时的下标 —— 面板可能已过时） */
  GAME.queueAt = function (kind, ref) {
    var s = GAME.state;
    var out = null;
    if (kind === 'tech') return (s.queues.tech || [])[0] || null;
    (s.queues.build || []).forEach(function (q) {
      if (out) return;
      if (kind === 'city' && (q.type === 'build' || q.type === 'upgrade') && GAME.slotEq(q.gridIndex, ref)) out = q;
      if (kind === 'ext' && (q.type === 'ext_build' || q.type === 'ext_upgrade') && Number(q.extIdx) === Number(ref)) out = q;
    });
    return out;
  };
  GAME.queueRushPay = function (q, what) {
    var s = GAME.state;
    if (!q) return { ok: false, msg: '没有在办的工程' };
    if ((q.elapsed || 0) >= q.totalTime) return { ok: false, msg: '该工程已完工' };
    var cost = GAME.queueRushCost(q);
    if ((s.res.gold || 0) < cost) {
      return { ok: false, msg: '旧币不足（需 ' + U.fmt(cost) + '，现有 ' + U.fmt(s.res.gold || 0) + '）' };
    }
    s.res.gold -= cost;
    q.elapsed = q.totalTime;      /* 下一拍由既有队列推进统一结算（与在线推进同一出口） */
    GAME.log('💰 花金提速：' + (what || '工程') + '（-' + U.fmt(cost) + ' 金，立等可成）');
    return { ok: true, cost: cost, msg: (what || '工程') + ' 提速完成（-' + U.fmt(cost) + ' 金，下一拍落成）' };
  };

  /* ============================================================
   * ⛔ v89.137（老板 4）：「不要全境营造总览，重复」——整条退役
   * ------------------------------------------------------------
   * 删净清单（防死代码，一并不留）：`GAME.buildOverview` / `GAME.rushAllBuilds` /
   * `GAME.buildQueueOf`（唯一消费点是下面的 rush-ov case 与该面板本身）+
   * `ui.openBuildOverview` + 政务厅要务段的入口按钮 + 动作 `open-build-ov` /
   * `rush-ov` / `rush-ov-all`。
   * 单体提速不受影响：建筑面板的「⚡ 提速」走 `GAME.queueRushPay`（保留）。
   * 如需恢复：本段代码见 `backup/v89137/domain.js`（判据：`buildOverview` 一等公民）。
   * ============================================================ */


  /* ============================================================
   * 自动研究（v16 · 需求 #8）：与自动建造并列
   * 按「科技等级从低到高」自动排队；旧币/资源不足则暂停（不关开关）
   * ============================================================ */
  /* ============================================================
   * 自动出征（v29 · 需求 5）
   * ------------------------------------------------------------
   * 参数：英雄 / 兵力 / 目标类型 / 目标等级上限 / 出征类型 / 频率。
   * 红线（写死在实现里，不进设置）：
   *   ① 只派**空闲**英雄 —— 出征中/守将/采集中的一律跳过；
   *   ② 体力不足该出征方式的门槛就不出发（不会把将跑废）；
   *   ③ 器械（无人轰炸机/自行火炮/自行火炮）、侦察单元、辎重**不编入**自动队伍 ——
   *      它们拖慢行军且是守城家底；
   *   ④ 只从**当前城池**的驻军里取兵，不抽空别的城；
   *   ⑤ 目标必须是"离当前城最近的、符合条件的那一块"，
   *      已占野地与今日已破的据点跳过（不做重复劳动）。
   * ============================================================ */
  GAME.autoMarchCfg = function () {
    var s = GAME.state;
    if (!s || !s.settings) return null;
    var A = DATA.AUTO_MARCH;
    if (!s.settings.autoMarch) {
      s.settings.autoMarch = {
        on: false, genId: null, troops: A.troopOptions[1], target: 'wild',
        maxLevel: 3, mode: 'raid', everyMin: A.defaultFreqMin, last: 0,
        /* v89.65：自动出征特有的护栏 —— 每日次数上限（0 = 不限）
           v89.83：`keepHome`（城内留守）已退役（老板「无需兵力留守这个菜单项」）；
                 新增 `radius`（搜索距离）与 `scheme`（计略）。 */
        dailyMax: 0, radius: A.defaultRadius, scheme: null, todayKey: '', todayCount: 0,
      };

    }
    var c = s.settings.autoMarch;
    /* 旧档/手工改档的兜底：字段缺失就补默认，避免界面读到 undefined。
       v89.79：城等级改档位值后，老档存的 1~10 会**筛不到任何名城** → 归一到底档 12。
       v89.83：`station` 方式已并入占领 → 老档存的 mode=station 归一到 occupy；
               缺 radius / scheme 就补默认（scheme 允许 null = 未用计）。 */
    if (c.target == null) c.target = 'wild';
    if (c.mode == null || c.mode === 'station') c.mode = (c.mode === 'station') ? 'occupy' : (c.mode || 'raid');
    if (c.radius == null || (A.radiusOptions || []).indexOf(c.radius) < 0) c.radius = A.defaultRadius;
    if (c.scheme === undefined) c.scheme = null;
    if (c.troops == null) c.troops = A.troopOptions[1];
    /* 等级上限必须落在**当前目标类型**的候选里，否则一个目标都筛不出来 */
    var lvs = GAME.autoMarchLevelOpts(c);
    if (lvs.indexOf(Number(c.maxLevel)) < 0) c.maxLevel = lvs[lvs.length - 1];
    if (c.everyMin == null) c.everyMin = A.defaultFreqMin;
    if (c.dailyMax == null) c.dailyMax = 0;
    return c;
  };
  /* v89.83：搜索半径 —— **唯一出口**（改前这个数是写死的，弹窗与后端各引一份）。 */
  GAME.autoMarchRadius = function (cfg) {
    var A = DATA.AUTO_MARCH;
    var v = (cfg && cfg.radius) || A.defaultRadius;
    return (A.radiusOptions || []).indexOf(v) >= 0 ? v : A.defaultRadius;
  };
  /* v89.83（老板「等级的选择直接给出等级列表」）：等级候选**按目标类型**给 ——
     野地/据点是 0~10 级，名城是档位等级 12/16/20/24。
     一张通用表会在选「野地」时筛不出任何目标（选项与目标不同源）。 */
  GAME.autoMarchLevelOpts = function (cfg) {
    var M = (DATA.AUTO_MARCH && DATA.AUTO_MARCH.levelOptionsByTarget) || {};
    var tgt = (cfg && cfg.target) || 'wild';
    return M[tgt] || M.wild || [10];
  };
  /* v89.65：每日次数按**现实日**归零（与"频率按现实分钟节流"同一把尺子）。
     放在这里而不是主循环里，是为了让「立即出征一次」也吃同一个上限 —— 否则
     按钮能绕开护栏，护栏就等于没有。 */
  GAME.autoMarchRollDay = function (cfg) {
    if (!cfg) return null;
    var key = String(Math.floor(U.now() / 86400000));
    if (cfg.todayKey !== key) { cfg.todayKey = key; cfg.todayCount = 0; }
    return cfg;
  };
  GAME.autoMarchTodayLeft = function (cfg) {
    cfg = GAME.autoMarchRollDay(cfg || GAME.autoMarchCfg());
    if (!cfg) return 0;
    return cfg.dailyMax > 0 ? Math.max(0, cfg.dailyMax - (cfg.todayCount || 0)) : Infinity;
  };
  /* 附近有没有可打的目标（按切比雪夫距离取最近的一块） */
  GAME.autoMarchTargetAt = function (cfg, x, y, d) {
    var tile = GAME.map.tile(x, y);
    if (!tile || tile.terrain === 'city') return null;
    if (cfg.target === 'wild') {
      if (GAME.map.wildAt(x, y)) return null;              // 已占的野地不重复打
      var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);
      if (lv > cfg.maxLevel) return null;
      return { kind: 'wild', x: x, y: y, lv: lv, d: d };
    }
    if (cfg.target === 'fort') {
      if (!GAME.map.fortAt) return null;
      var f = GAME.map.fortAt(x, y);
      if (!f || f.level > cfg.maxLevel) return null;
      var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
      if ((GAME.state.fortsRazed || {})[x + ',' + y] === day) return null;  // 今日已破
      return { kind: 'fort', x: x, y: y, lv: f.level, d: d };
    }
    return null;
  };
  GAME.autoMarchFindTarget = function (cfg, city, opts) {
    /* v89.93（整改 E9）：`opts.skipRing` = 跳过「轮空池」里的目标（默认不跳）。
       取目标走 autoMarchFindTargetRot（两趟：先避轮空池，池子挡住全部候选时放行）。 */
    var skipRing = !!(opts && opts.skipRing);
    /* v89.83：半径走唯一出口 autoMarchRadius（老板「目标的选择可以加上距离」） */
    var rad = GAME.autoMarchRadius(cfg);
    var best = null, bestD = Infinity;
    /* 「名城」目标不在坐标里找，而是从已生成的 NPC 城池列表里挑最近的一座 */
    if (cfg.target === 'city') {
      ((GAME.state.map && GAME.state.map.cities) || []).forEach(function (npc) {
        if (!npc || npc.owner !== 'npc') return;
        /* v89.79：城等级口径 = 档位值（12/16/20/24），筛选走唯一出口 */
    if (GAME.cityLvOf(npc) > cfg.maxLevel) return;
        if (skipRing && GAME.autoMarchRingHas(cfg, npc)) return;
        var d = Math.max(Math.abs(npc.x - city.x), Math.abs(npc.y - city.y));
        if (d < bestD) { bestD = d; best = { kind: 'city', id: npc.id, x: npc.x, y: npc.y, lv: GAME.cityLvOf(npc), d: d, name: npc.name }; }
      });
      return best;
    }
    for (var dy = -rad; dy <= rad; dy++) {
      for (var dx = -rad; dx <= rad; dx++) {
        var d2 = Math.max(Math.abs(dx), Math.abs(dy));
        if (d2 >= bestD) continue;
        var x = city.x + dx, y = city.y + dy;
        if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
        var hit = GAME.autoMarchTargetAt(cfg, x, y, d2);
        if (hit && skipRing && GAME.autoMarchRingHas(cfg, hit)) continue;
        if (hit) { best = hit; bestD = d2; }
      }
    }
    return best;
  };
  /* v89.93（整改 E9）：轮空池（唯一出口）—— 记最近打过的目标，供取目标时跳过 */
  GAME.autoMarchRingSize = function () { return (DATA.AUTO_MARCH && DATA.AUTO_MARCH.ringSize) || 4; };
  GAME.autoMarchKeyOf = function (t) { return t ? (t.x + ',' + t.y) : ''; };
  GAME.autoMarchRingHas = function (cfg, t) {
    if (!cfg || !t) return false;
    return (cfg.ring || []).indexOf(GAME.autoMarchKeyOf(t)) >= 0;
  };
  GAME.autoMarchRingPush = function (cfg, t) {
    if (!cfg || !t || t.x == null) return;
    var k = GAME.autoMarchKeyOf(t);
    cfg.ring = cfg.ring || [];
    var i = cfg.ring.indexOf(k);
    if (i >= 0) cfg.ring.splice(i, 1);
    cfg.ring.push(k);
    var cap = GAME.autoMarchRingSize();
    while (cfg.ring.length > cap) cfg.ring.shift();
  };
  /* 带轮换的取目标：**两趟** —— 先避开轮空池；全被挡住时忽略池子放行（绝不停摆） */
  GAME.autoMarchFindTargetRot = function (cfg, city) {
    var t = GAME.autoMarchFindTarget(cfg, city, { skipRing: true });
    if (t) return t;
    return GAME.autoMarchFindTarget(cfg, city, { skipRing: false });
  };
  /* 编队：按优先级从当前城取够 want 人；器械/侦察单元/辎重不编入 */
  GAME.autoMarchPickArmy = function (city, want, cfgArmy) {
    var A = DATA.TROOPS, out = {}, n = 0;
    /* v89.140（老板 7'）：「兵种编成这里保留 3 列，兵种、拥有（改成驻军数量）、
       自动出征数量（**各兵种提供数量输入框**）」——
       给了 cfgArmy（{ 兵种id: 数量 }）就**逐兵种按配置取**；没有配置才退回顺位口径
       （老档与"未配置任何兵种"时行为与改前一致，不会突然不出征）。 */
    if (cfgArmy) {
      Object.keys(cfgArmy).forEach(function (id) {
        var t = A[id];
        if (!t || t.craft || t.nocombat) return;
        var have = ((city.army) || {})[id] || 0;
        var take = Math.min(have, Math.max(0, Math.floor(cfgArmy[id] || 0)));
        if (take > 0) { out[id] = take; n += take; }
      });
      if (n > 0) return { army: out, total: n };
    }
    (DATA.AUTO_MARCH.troopOrder || []).forEach(function (id) {
      if (n >= want) return;
      var have = ((city.army) || {})[id] || 0;
      var t = A[id];
      if (have <= 0 || !t || t.craft || t.nocombat) return;
      var take = Math.min(have, want - n);
      if (take > 0) { out[id] = take; n += take; }
    });
    return { army: out, total: n };
  };
  GAME.autoMarchOnce = function (cfg) {
    var s = GAME.state;
    cfg = cfg || GAME.autoMarchCfg();
    if (!cfg) return { ok: false, msg: '状态未就绪' };
    /* v89.65：护栏③ 每日次数上限（与"立即出征一次"共用同一条） */
    GAME.autoMarchRollDay(cfg);
    if (cfg.dailyMax > 0 && (cfg.todayCount || 0) >= cfg.dailyMax) {
      return { ok: false, msg: '今日已达上限 ' + cfg.dailyMax + ' 次，明日再战' };
    }
    var city = GAME.currentCity();
    if (!city) return { ok: false, msg: '无可用城池' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === cfg.genId) gen = g; });
    if (!gen) return { ok: false, msg: '请先指定执行自动出征的英雄' };
    /* 红线①：只派空闲英雄 */
    if (gen.status && gen.status !== 'idle') {
      return { ok: false, msg: gen.name + ' 正在' + (gen.status === 'guard' ? '任守将'
        : gen.status === 'march' ? '出征' : '采集') + '，本次跳过' };
    }
    var mode = GAME.battle.modeOf(cfg.mode);
    /* 红线②：体力不足不出征（v66：池子口径，与界面显示的体力是同一个数） */
    if (GAME.staNow(gen) < mode.stamina) {
      return { ok: false, msg: gen.name + ' 体力不足（需 ' + mode.stamina + '，现 '
        + Math.round(GAME.staNow(gen)) + '），休整中' };
    }
    var t = GAME.autoMarchFindTargetRot(cfg, city);   /* v89.93（E9）：带轮空池的取目标 */
    if (!t) {
      return { ok: false, msg: '「' + city.name + '」周边 ' + GAME.autoMarchRadius(cfg)
        + ' 格内没有符合条件的目标（' + mode.name + ' · 等级 ≤ ' + cfg.maxLevel + '）' };
    }
    var w = GAME.autoMarchWant(cfg, city);
    if (w.want <= 0) return { ok: false, msg: city.name + ' 城内无兵可派（现有 ' + U.fmt(w.total) + ' 兵）' };
    var pick = GAME.autoMarchPickArmy(city, w.want, cfg.army);
    if (!pick.total) return { ok: false, msg: city.name + ' 城内无兵可派（器械与侦察单元不计入编队）' };
    /* v89.83：计略 —— 与出征面板走**同一个出口**（march.dispatch 的 schemeId）。
       无人值守时**不因计略而卡住**：封存匣/精力不足或该目标不适用，则本次不用计
       （原因写进结果文案）—— 否则挂了计略又没封存匣，自动出征会一直不动，
       而玩家只看到「尚未执行」，根本不知道卡在哪。 */
    var schemeId = null, schemeNote = '';
    if (cfg.scheme) {
      var schk = GAME.schemePrepare(cfg.scheme, GAME.battle.resolveTarget(t), gen);
      if (schk && schk.ok) schemeId = cfg.scheme;
      else schemeNote = '（' + ((schk && schk.msg) || '计略不可用') + '，本次未用计）';
    }
    var r = GAME.march.dispatch(t, cfg.mode, pick.army, gen.id, schemeId);
    if (!r || !r.ok) return { ok: false, msg: (r && r.msg) || '出征未能发出' };
    cfg.todayCount = (cfg.todayCount || 0) + 1;      /* 真发出去了才计数 */
    GAME.autoMarchRingPush(cfg, t);                  /* v89.93（E9）：入轮空池，下次优先换目标 */
    var tl = t.kind === 'wild' ? ('野地 Lv' + t.lv + ' (' + t.x + ',' + t.y + ')') : (t.name || '目标');
    return {
      ok: true, target: t, gen: gen, army: pick.army, total: pick.total,
      msg: gen.name + ' 率 ' + U.fmt(pick.total) + ' 兵 ' + mode.name + ' ' + tl + schemeNote,
    };
  };
  /* 本次该派多少兵 —— **唯一出口**（单次兵力 vs 城内实有，取小者）。
     拆出来是因为它是取兵口径，必须能被单独验证：留在 autoMarchOnce 里的话，
     目标搜索失败会提前 return，这段就永远走不到（也就永远测不到）。
     v89.83（老板「无需兵力留守这个菜单项」）：`keepHome` 退役 —— 单次派 5000
     本身就意味着其余留在城内，再挂一个留守 N 是同一件事的第二种说法。 */
  GAME.autoMarchWant = function (cfg, city) {
    var total = (GAME.armyTotal && city) ? GAME.armyTotal(city) : 0;
    /* v89.140：want = Σ 各兵种自动出征数量（有配置时）；无配置退回 `troops`（单次兵力） */
    var A = cfg && cfg.army, sum = 0;
    if (A) { for (var k in A) sum += Math.max(0, Math.floor(A[k] || 0)); }
    var want = Math.min(sum > 0 ? sum : ((cfg && cfg.troops) || 0), total);
    return { total: total, avail: total, want: want > 0 ? want : 0 };
  };
  /* v89.83：自动出征的「预估」—— 与出征面板的预估**同源**（同一套 travelTime / 编队 / 守军出口），
     让玩家在开之前就知道这套策略会打到谁、要多久、对面多少兵。
     找不到目标时返回具体原因（而不是空着），与「立即出征一次」的提示保持一致。 */
  GAME.autoMarchPreview = function (cfg) {
    var s = GAME.state, city = GAME.currentCity();
    cfg = cfg || GAME.autoMarchCfg();
    if (!city || !cfg) return { ok: false, msg: '无可用城池' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === cfg.genId) gen = g; });
    var t = GAME.autoMarchFindTargetRot(cfg, city);   /* v89.93（E9）：与实发同一取目标口径 */
    if (!t) {
      return { ok: false, msg: '「' + city.name + '」周边 ' + GAME.autoMarchRadius(cfg)
        + ' 格内没有符合条件的目标（' + GAME.battle.modeOf(cfg.mode).name
        + ' · 等级 ≤ ' + cfg.maxLevel + '）' };
    }
    var w = GAME.autoMarchWant(cfg, city);
    var pick = GAME.autoMarchPickArmy(city, w.want, cfg.army);
    var from = { x: city.x, y: city.y, cityId: city.id };
    var travel = GAME.march.travelTime(from, { x: t.x, y: t.y }, pick.army, null, gen) / GAME.timeScale();
    /* 守军：野地走 wildDefenseAt（与战斗同一个来源）、据点取据点守军表、
       名城走 resolveTarget（与出征面板同一份解析结果）—— 三处都不另算第二遍。 */
    var def = 0;
    try {
      if (t.kind === 'wild') def = GAME.wildDefenseAt(t.x, t.y, t.lv).total;
      else if (t.kind === 'fort') { var fg = GAME.map.fortGarrison(t.lv); for (var kf in fg) def += fg[kf]; }
      else {
        var rt = GAME.battle.resolveTarget(t);
        if (rt && rt.ok) { for (var kc in (rt.garrison || {})) def += rt.garrison[kc]; }
      }
    } catch (e) { def = 0; }
    return {
      ok: true, target: t, gen: gen, army: pick.army, total: pick.total, def: def,
      dist: Math.max(Math.abs(city.x - t.x), Math.abs(city.y - t.y)),
      travel: travel,
      label: (t.kind === 'wild') ? ('野地 Lv' + t.lv + ' (' + t.x + ',' + t.y + ')')
        : ((t.name || '目标') + (t.kind === 'fort' ? ' Lv' + t.lv : '')),
    };
  };
  /* 主循环驱动：按"频率"（现实分钟）节流 */
  GAME.autoMarch = function () {
    var s = GAME.state;
    var cfg = GAME.autoMarchCfg();
    if (!cfg || !cfg.on) return null;
    var now = U.now();
    if (now - (cfg.last || 0) < cfg.everyMin * 60000) return null;
    cfg.last = now;
    var r = GAME.autoMarchOnce(cfg);
    s.autoMarchInfo = { ok: r.ok, msg: r.msg, at: now };
    if (r.ok) GAME.log('🤖 自动出征：' + r.msg);
    return r;
  };

  GAME.autoResearch = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoResearch) return null;
    var city = GAME.currentCity() || s.cities[0];
    if (!city) return null;
    var shuLv = GAME.buildingLevel(city, 'shuyuan');
    if (shuLv <= 0) { s.autoTechState = { paused: true, msg: '需先建造研习所' }; return null; }
    if ((s.queues.tech || []).length > 0) {
      var cur = s.queues.tech[0];
      var cn = cur.techId;
      (DATA.TECH || []).forEach(function (t) { if (t.id === cur.techId) cn = t.name; });
      s.autoTechState = { msg: '正在研究 ' + cn };
      return null;
    }
    /* v89.86（整改 P-18）：自动研究**等级上限**（settings.autoTechMaxLv，0=不限） */
    var capLv18 = (s.settings && s.settings.autoTechMaxLv) || 0;
    /* v89.191（老板 3-④）：自动研究也**按城** —— 等级读该城、上限走 techCapOf（主城 20）、
       req 建筑不满足的科技直接不进候选（研究也会被拒）。 */
    var _cap191 = GAME.techCapOf ? GAME.techCapOf(city) : 10;
    var cands = (DATA.TECH || []).filter(function (t) {
      var lv = GAME.systems.techLevel(t.id, city);
      if (shuLv < t.lv || lv >= _cap191) return false;
      if (capLv18 > 0 && lv >= capLv18) return false;
      var req = t.req || {};
      for (var rk in req) { if (GAME.buildingLevel(city, rk) < req[rk]) return false; }
      return true;
    }).sort(function (a, b) {
      var la = GAME.systems.techLevel(a.id, city), lb = GAME.systems.techLevel(b.id, city);
      return la - lb || a.lv - b.lv;
    });
    if (!cands.length) {
      s.autoTechState = { done: true, msg: capLv18 > 0
        ? '科技已到自动研究上限（Lv' + capLv18 + '）'
        : '科技已全部满级（或受研习所等级限制）' };
      return null;
    }
    /* v89.86（整改 P-18）：预算闸门（与自动升级同一条线） */
    var gatedT = 0, gatedMsgT = '';
    for (var i = 0; i < cands.length; i++) {
      /* v89.104：预算闸门退役 —— 资源不足只跳过当项 */
      var r = GAME.systems.research(cands[i].id, city.id);
      if (r && r.ok) { s.autoTechState = { msg: '正在研究 ' + cands[i].name }; GAME.log('自动研究：' + cands[i].name, 'sys', 'admin'); return r; }
      if (r && /不足/.test(r.msg)) { s.autoTechState = { paused: true, want: cands[i].name, msg: r.msg }; return r; }
    }
    if (gatedT && gatedT === cands.length) {
      s.autoTechState = { paused: true, gated: true, msg: gatedMsgT };
      return null;
    }
    s.autoTechState = { msg: '暂无可研究项' };
    return null;
  };

  /* ============================================================
   * 平原筑城（v16 · P2-10）：原版平地带资源可筑新城
   * ============================================================ */
  GAME.BUILD_CITY_COST = { grain: 10000, wood: 10000, stone: 10000, iron: 10000, gold: 10000 };
  GAME.canBuildCityAt = function (x, y) {
    var s = GAME.state;
    var w = GAME.map.wildAt(x, y);
    if (!w) return { ok: false, msg: '需先占领该野地，方可在其上筑城' };
    if (w.type !== 'plain') {
      var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : w.type;
      return { ok: false, msg: '只有**平原**可以筑城（' + tn + ' 不可）' };
    }
    for (var i = 0; i < (s.cities || []).length; i++) {
      if (s.cities[i].x === x && s.cities[i].y === y) return { ok: false, msg: '此处已是我方城池' };
    }
    /* v89.108（老板）：「可建造控制的城池数量随威望解封」。
       顺序：先地理（能不能在这建）→ 再资格（领地上限）→ 再资源 —— 逐层归因。 */
    var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
    if (!_cc108.ok) return _cc108;
    if (!GAME.canAfford(GAME.BUILD_CITY_COST)) {
      return { ok: false, msg: '资源不足（需 粮/木/石/铁/金 各 ' + U.fmt(GAME.BUILD_CITY_COST.grain) + '）' };
    }
    return { ok: true, wild: w };
  };
  GAME.buildCityAt = function (x, y) {
    var s = GAME.state;
    var chk = GAME.canBuildCityAt(x, y);
    if (!chk.ok) return chk;
    GAME.payCost(GAME.BUILD_CITY_COST);
    var stName = GAME.stateOfCity({ x: x, y: y });
    var city = GAME.makeCity({
      id: 'new_' + x + '_' + y, name: '新城' + (s.cities.length + 1),
      x: x, y: y, type: 'self', state: stName,
      initialExt: 'new',   /* v89.93（整改 E12）：自建城预置 6 块城外资源地，落地即可产 */
    });
    GAME.registerCity(city);   /* v89.161：入库唯一出口（含旧币池接线） */
    /* 筑城后该野地转为城池地块，从附属野地中移除 */
    s.wilds = (s.wilds || []).filter(function (w) { return !(w.x === x && w.y === y); });
    var tile = GAME.map.tile(x, y);
    if (tile) tile.terrain = 'city';
    GAME.log('🏯 于 (' + x + ',' + y + ') 筑新城「' + city.name + '」（耗 粮木石铁金 各 ' + U.fmt(GAME.BUILD_CITY_COST.grain) + '）', 'sys', 'admin');
    return { ok: true, msg: '筑城成功：' + city.name, city: city };
  };

  /* ============================================================
   * 城池坐标与迁址（v70 · 老板）
   * ------------------------------------------------------------
   * 老板三条：
   *   ① 「城池的主界面提供其坐标（500×500），自动确认」；
   *   ② 「一键随机当前城池坐标位置（除名城，名城固定）」；
   *   ③ 「为玩家城池提供坐标切换，移动到某坐标时，替换原地块建筑」
   *
   * 口径（唯一出口，界面与业务共用 —— 界面置灰与真执行读同一份判据）：
   *   · 可迁 = **自建城**（`type === 'self'`）。攻占来的各档名城带 origId，
   *     它的坐标是"历史上就在那里"的地理事实 → 固定（老板："除名城，名城固定"）。
   *   · 可迁入的坐标 = **平原**、界内（0~499）、且无任何占用
   *     （我方城 / 系统城 / 野外城池 / 已占野地）。与「平原筑城」同一条地形约束 ——
   *     自建城脚下必是平原，所以"旧地块还原"有确定答案：还回平原。
   *   · 「替换原地块建筑」= 旧坐标那格归还地图（恢复地形），新坐标那格成为城池。
   * ============================================================ */
  GAME.COORD_MAX = (DATA.MAP_W || 500) - 1;
  GAME.coordText = function (city) {
    if (!city) return '—';
    return '(' + city.x + ', ' + city.y + ')';
  };
  /* 可迁判据：自建城才可迁（名城 = 地理固定） */
  GAME.isMovableCity = function (city) {
    return !!(city && city.type === 'self');
  };
  /* 目标坐标是否可迁入 —— **唯一判据** */
  GAME.canCityMoveTo = function (city, x, y) {
    var s = GAME.state;
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    if (!GAME.isMovableCity(city)) {
      return { ok: false, msg: '名城地望固定 —— 只有自建城可以迁址' };
    }
    x = Math.round(Number(x)); y = Math.round(Number(y));
    if (!isFinite(x) || !isFinite(y) || x < 0 || y < 0 || x > GAME.COORD_MAX || y > GAME.COORD_MAX) {
      return { ok: false, msg: '坐标须在 0 ~ ' + GAME.COORD_MAX + ' 之间' };
    }
    if (city.x === x && city.y === y) return { ok: false, msg: '已在目标坐标上' };
    var own = GAME.map.ownCityAt(x, y);
    if (own) return { ok: false, msg: '该坐标已有我方城池「' + own.name + '」' };
    var npc = GAME.map.npcAt(x, y);
    if (npc) return { ok: false, msg: '该坐标为名城「' + npc.name + '」所据，不可占用' };
    var fort = GAME.map.fortAt(x, y);
    if (fort) return { ok: false, msg: '该坐标是野外城池「' + fort.name + '」，需先攻取' };
    var w = GAME.map.wildAt(x, y);
    if (w) return { ok: false, msg: '该坐标是已占野地，不可占用' };
    var t = GAME.map.tile(x, y);
    if (!t) return { ok: false, msg: '坐标越出地图' };
    if (t.terrain !== 'plain') {
      var tn = DATA.TERRAIN[t.terrain] ? DATA.TERRAIN[t.terrain].name : t.terrain;
      return { ok: false, msg: '只有**平原**可以立城（' + tn + ' 不可）' };
    }
    return { ok: true };
  };
  /* 迁址（唯一执行）：旧格归还地图 → 新址脚下变城池 → 坐标落定 */
  GAME.moveCityTo = function (cityId, x, y) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var chk = GAME.canCityMoveTo(city, x, y);
    if (!chk.ok) return chk;
    x = Math.round(Number(x)); y = Math.round(Number(y));
    var from = { x: city.x, y: city.y };
    /* ① 旧格归还：走「放弃城池」同一出口 restoreCityTile（自建城 → 还回平原） */
    GAME.restoreCityTile(city);
    /* ② 落新址 */
    city.x = x; city.y = y;
    var t = GAME.map.tile(x, y);
    if (t) t.terrain = 'city';
    GAME.log('📍 迁址：' + city.name + ' (' + from.x + ',' + from.y + ') → (' + x + ',' + y + ')', 'sys', 'admin');
    return { ok: true, msg: '已迁至 (' + x + ', ' + y + ')', city: city, from: from };
  };
  /* 掷一个可迁坐标（纯函数：rnd 可注入 → 测试确定；默认 Math.random） */
  GAME.randomCityCoord = function (city, rnd) {
    var rand = rnd || Math.random;
    var M = GAME.COORD_MAX;
    for (var i = 0; i < 400; i++) {
      var x = Math.floor(rand() * (M + 1)), y = Math.floor(rand() * (M + 1));
      if (GAME.canCityMoveTo(city, x, y).ok) return { x: x, y: y };
    }
    return null;
  };
  /* 一键随机（老板："一键随机当前城池坐标位置"） */
  GAME.randomMoveCity = function (cityId) {
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    if (!GAME.isMovableCity(city)) return { ok: false, msg: '名城地望固定 —— 只有自建城可以迁址' };
    var c = GAME.randomCityCoord(city);
    if (!c) return { ok: false, msg: '地图上暂无可迁的平原空地' };
    var r = GAME.moveCityTo(city.id, c.x, c.y);
    if (r.ok) r.msg = '🎲 已随机迁至 (' + c.x + ', ' + c.y + ')';
    return r;
  };

  /* v82（老板）：「政务厅不需要征收物质这个功能去除」——
     征收（GAME.levy / GAME.levyPlan / GAME.levyReady + DATA.LEVY_CD /
     LEVY_RES_RATE / LEVY_MAT_QTY / LEVY_HEARTS + city.lastLevy）整段退役。
     特产展示改读 GAME.specialtyOf / GAME.stateOfCity（岁贡与首府加成的口径不变）。 */
  /* ============================================================
   * 锻造间打造（装备获取的主要途径）
   * ① 锻造间等级决定可打造品质（1/3/5/7 级 → 凡/良/珍/神品）
   * ② 消耗旧币 + 铁 + 木 + 石；套装件成本 ×2.2
   * ③ 套装件需先持有该套「图纸」（游商购买 / 攻城缴获 / 奇遇）
   * ============================================================ */
  GAME.forgeLevel = function () {
    var c = GAME.currentCity();
    return GAME.buildingLevel(c, 'tiejiangpu') || 0;
  };
  /* 锻造间等级 → 可打造的最高品质 */
  GAME.forgeMaxQ = function () {
    var lv = GAME.forgeLevel(), t = DATA.FORGE.tierLv, out = 0;
    for (var i = 0; i < t.length; i++) if (lv >= t[i]) out = i + 1;
    return out;
  };
  GAME.forgeCost = function (itemId, city) {
    var it = DATA.EQUIP[itemId];
    if (!it) return null;
    var base = DATA.FORGE.costByQ[it.q] || DATA.FORGE.costByQ[1];
    var m = (it.set ? DATA.FORGE.setMul : 1) * (DATA.FORGE.slotMul[it.slot] || DATA.FORGE.slotMulDef);
    /* 合成技巧：打造旧币消耗 −3%/级（封顶 −50%）—— v89.191：按城读（不传 = 当前城） */
    var goldDisc = Math.min(0.5, techB('synth', city));
    return {
      gold: Math.round(base.gold * m * (1 - goldDisc)),
      iron: Math.round(base.iron * m),
      wood: Math.round(base.wood * m),
      stone: Math.round(base.stone * m),
    };
  };
  /* 该装备所需材料（按部位定种类，按品质定数量） */
  /* --------- 物品估值（背包排序与展示用） --------- */
  GAME.itemValue = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (it) {
      var base = [0, 120, 700, 4200, 24000][it.q] || 100;
      return Math.round(base * (DATA.FORGE.slotMul[it.slot] || 1) * (it.set ? 2.2 : 1));
    }
    var x = null;
    (DATA.ITEMS || []).forEach(function (v) { if (v.id === itemId) x = v; });
    if (x) return (x.price || 1) * 100;
    return 10;
  };

  /* ============================================================
   * v79（老板第 4 条）：「装备强化是针对单件装备的，同名装备搞个区分办法」
   * ------------------------------------------------------------
   * 装备从"种"升级为"件"：库存与穿戴里存**实例** { u, id, enh }——
   *   u   = 件号（s.nextEqU 递增；同名按件号排序 → 甲/乙/丙… 序号）
   *   id  = 装备谱 id（DATA.EQUIP 的键）
   *   enh = 熔铸等级（**按件**记，0..max）
   * 兼容：旧的纯 id 字符串（老档 / 测试夹具）照读不误 ——
   *   一律经 eqId / eqEnhOf 取值，读取方**不许**再直接下标。
   * ============================================================ */
  GAME.eqId = function (x) { return (x && typeof x === 'object') ? x.id : x; };
  GAME.eqEnhOf = function (x) { return (x && typeof x === 'object' && x.enh) || 0; };

  /* v89.211（老板 1「强化后装备属性似乎并未真实增加」数值链大排查）：
     强化乘数**唯一出口** —— 结算（genEquipBonus）与展示（equipDescOf）与评分
     （equipScore）读同一份。改前乘数只在 genEquipBonus 里现写一份、展示侧全部
     读原值 —— 数值链本身是通的（探针 A/B 实证），断在"展示与结算分离"这一手：
     玩家看到 +10 的件写着原属性，观感就是"强化了没增加"。 */
  GAME.eqEnhMulOf = function (x) {
    var lv = GAME.eqEnhOf(x);
    return lv ? 1 + lv * ((DATA.ENHANCE && DATA.ENHANCE.perLv) || 0.08) : 1;
  };
  /* 调校乘数（机能口径）——与状态层 lingPowerOf 同源（LING_TEMPER.perLv）。 */
  GAME.eqLingMulOf = function (x) {
    var lv = GAME.eqEnhOf(x);
    return lv ? 1 + lv * ((DATA.LING_TEMPER && DATA.LING_TEMPER.perLv) || 0.08) : 1;
  };
  GAME.eqUidOf = function (x) { return (x && typeof x === 'object') ? x.u : null; };
  GAME.eqMake = function (id, enh) {
    var s = GAME.state;
    s.nextEqU = (s.nextEqU || 0) + 1;
    return { u: s.nextEqU, id: id, enh: Math.max(0, Math.min(GAME.enhMax(), enh || 0)) };
  };
  /* 入包（**唯一出口**：打造 / 缴获 / 卸下 / 归还 都走它） */
  GAME.addEquip = function (id, enh) {
    var s = GAME.state;
    s.inventory = s.inventory || [];
    var inst = GAME.eqMake(id, enh);
    s.inventory.push(inst);
    return inst;
  };
  /* 全部件（背包 + 穿戴） */
  GAME.eqPieces = function () {
    var s = GAME.state, out = [];
    ((s && s.inventory) || []).forEach(function (x) { if (x) out.push(x); });
    ((s && s.generals) || []).forEach(function (g) {
      /* v88：两套装备袋都要收（机甲 g.equip / 基因 g.lingEquip） */
      ['equip', 'lingEquip'].forEach(function (bk) {
        for (var sl in (g[bk] || {})) if (g[bk][sl]) out.push(g[bk][sl]);
      });
    });
    return out;
  };
  /* 找一件：件号（数字）→ 实例；实例 → 自身；装备 id → 第一件（背包优先） */
  GAME.eqFind = function (ref) {
    var s = GAME.state;
    if (ref && typeof ref === 'object') return ref;
    var inv = (s && s.inventory) || [], found = null, i;
    var isNum = (typeof ref === 'number') || /^\d+$/.test(String(ref));
    if (isNum) {
      var u = Number(ref);
      for (i = 0; i < inv.length; i++) if (inv[i] && inv[i].u === u) return inv[i];
      ((s && s.generals) || []).forEach(function (g) {
        ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两袋都查 */
          for (var sl in (g[bk] || {})) if (g[bk][sl] && g[bk][sl].u === u) found = found || g[bk][sl];
        });
      });
      return found;
    }
    for (i = 0; i < inv.length; i++) if (GAME.eqId(inv[i]) === ref) return inv[i];
    ((s && s.generals) || []).forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两袋都查 */
        for (var sl in (g[bk] || {})) if (GAME.eqId(g[bk][sl]) === ref) found = found || g[bk][sl];
      });
    });
    return found;
  };
  /* 同名群（按件号升序）—— 序号（甲/乙/丙…）由此派生 */
  GAME.eqGroupOf = function (id) {
    return GAME.eqPieces().filter(function (x) { return GAME.eqId(x) === id; })
      .sort(function (a, b) { return (GAME.eqUidOf(a) || 0) - (GAME.eqUidOf(b) || 0); });
  };
  /* v89.214（老板 1）：「名称行的甲乙丙丁不需要展示」—— 内部编号保留（件号 u + 本序号），
     但**不进显示名**。同名件的区分交给两条天然差异：① 强化等级（+N，最常用）；
     ② 属性数值本身（悬停分行里逐项列出）。需要精确定位的场合（详情面板）另行注明
     「同名第 N / M 件」——序号从此只在"需要它"的地方出现。 */
  GAME.eqSerial = function (x) {
    var u = GAME.eqUidOf(x);
    if (u == null) return '';
    var g = GAME.eqGroupOf(GAME.eqId(x));
    if (g.length < 2) return '';
    var idx = -1;
    for (var i = 0; i < g.length; i++) if (GAME.eqUidOf(g[i]) === u) { idx = i; break; }
    if (idx < 0) return '';
    var STEMS = '甲乙丙丁戊己庚辛壬癸';
    return idx < STEMS.length ? STEMS.charAt(idx) : ('#' + (idx + 1));
  };
  /* 同名的**内部序号**（数字口径：1 起）—— 详情面板「同名第 N / M 件」读它；
     显示名不读（v89.214 起）。无同名群时返回 0。 */
  GAME.eqSerialNo = function (x) {
    var u = GAME.eqUidOf(x);
    if (u == null) return 0;
    var g = GAME.eqGroupOf(GAME.eqId(x));
    if (g.length < 2) return 0;
    for (var i = 0; i < g.length; i++) if (GAME.eqUidOf(g[i]) === u) return i + 1;
    return 0;
  };
  GAME.eqName = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    return it ? it.name : '（装备）';
  };
  /* v88：品质名（两套各用各的名表 —— 机甲 粗制/标准/精良/原型，基因 废件…遗世） */
  GAME.qNameOf = function (it) {
    if (!it) return '';
    return it.ling ? ((DATA.LING_Q_NAME || {})[it.q] || '')
                   : ((DATA.Q_NAME || {})[it.q] || '');
  };
  /* 显示名 = 名 + 强化等级（v89.214：**不再缀 ·甲/·乙 序号**） */
  GAME.eqLabel = function (x) {
    var lv = GAME.eqEnhOf(x);
    return GAME.eqName(x) + (lv ? ' +' + lv : '');
  };
  /* 存档迁移（唯一出口；loadGame 调用）：旧 id 串 → 实例；
     旧"按种"强化（s.forgeEnh）并入该种**第一件**，其余从 0 起。 */
  GAME.migrateEquipModel = function (s) {
    if (!s || s._eqModel2) return s;
    var legacyEnh = s.forgeEnh || {};
    var mk = function (id, enh) {
      s.nextEqU = (s.nextEqU || 0) + 1;
      return { u: s.nextEqU, id: id, enh: enh || 0 };
    };
    var take = function (id) {
      if (legacyEnh[id] > 0) { var e = legacyEnh[id]; delete legacyEnh[id]; return e; }
      return 0;
    };
    if (Array.isArray(s.inventory)) {
      s.inventory = s.inventory.map(function (x) {
        if (x && typeof x === 'object') return x;
        return mk(x, take(x));
      });
    }
    (s.generals || []).forEach(function (g) {
      if (!g || !g.equip) return;
      for (var sl in g.equip) {
        var v = g.equip[sl];
        if (v && typeof v === 'object') continue;
        g.equip[sl] = mk(v, take(v));
      }
    });
    delete s.forgeEnh;
    s._eqModel2 = 1;
    return s;
  };

  /* v89（老板「只有君主将有改造功能，以及相应装备」）：
     老档收口迁移 —— 非君主身上的辐能装备归还背包、归位机甲；君主不受影响。
     一次性（s._lingLord1 标记），在 loadFrom 里与装备单件化迁移同点调用。 */
  GAME.migrateLordLing = function (s) {
    if (!s || s._lingLord1) return s;
    s.inventory = s.inventory || [];
    (s.generals || []).forEach(function (g) {
      if (!g || GAME.isLordGeneral(g)) return;
      var bag = g.lingEquip;
      if (bag) {
        for (var sl in bag) { if (bag[sl]) s.inventory.push(bag[sl]); }
        delete g.lingEquip;
      }
      if (g.equipOn === 'ling') g.equipOn = 'sha';
    });
    s._lingLord1 = 1;
    return s;
  };

  /* ============================================================
   * v89.211（老板 2 存量修复）：占城"围墙格释放成空格"的补齐 —— 唯一出口
   * ------------------------------------------------------------
   * 沿革：v89.126 围墙占格 → v89.128 归一进环城槽，占城（onConquer）与读档迁移
   * 都把原墙格 `build=null` 释放 —— 于是"打下一座满配城"多出一个空格
   * （8×6 布局里恒为 r5c6 / idx37，老板实测"第五行第六格未建造"即此）。
   * v89.211 起：释放格**补建居所**（新占/新迁移都走新口径）；
   * 本迁移负责**存量档**：按紧签名补齐（只在能确证是"那次释放"的城上动手）——
   *   签名 = 占来的城（origId）＋ 8×6 全建满只差**恰一格**空白（无 build 无 pending）
   *          ＋ 空位 == 布局的围墙格 ＋ 围墙在环城槽。
   * 负例保护：玩家自建城（无 origId）、空格 ≥2（被动过工）、在建格（pending）一律不碰。
   * 一次性（`_wallCell211` 标记）；不动玩法数值，只补一块居所。
   * ============================================================ */
  GAME.wallPlanIdxOf = function () {
    var p = GAME.cityPlanOf(1, 1);
    for (var i = 0; i < p.cells.length; i++) {
      if (p.cells[i].build && p.cells[i].build.id === 'chengqiang') return i;
    }
    return -1;
  };
  GAME.migrateWallCell211 = function (s) {
    if (!s || s._wallCell211) return s;
    var wIdx = GAME.wallPlanIdxOf();
    if (wIdx < 0) { s._wallCell211 = 1; return s; }
    (s.cities || []).forEach(function (c) {
      if (!c || !c.origId || !c.cells || !c.wall || !c.wall.build) return;
      if ((c.col || 8) !== 8 || (c.row || 6) !== 6) return;   /* 签名位按 8×6 布局 */
      var empt = [];
      c.cells.forEach(function (x, i) { if (!x.build && !x.pending) empt.push(i); });
      if (empt.length !== 1 || empt[0] !== wIdx) return;
      c.cells[wIdx].build = { id: 'minfang', lvl: (c.wall.build.lvl || 1) };
      c.cells[wIdx].pending = null;
      /* 不静默（v89.127 精神）：改版提示进消息流，玩家翻得到"这一格哪来的" */
      var _m211 = '🔧 城内整备：『' + c.name + '』补建一格民居（原围墙占位 · v89.128 释放的空格）';
      s.log = s.log || [];
      s.log.unshift({ t: U.now(), msg: _m211 });
      if (s.log.length > 40) s.log.pop();
      s.msgLog = s.msgLog || [];
      s.msgLog.push({ t: U.now(), gt: (s.world && s.world.elapsed) || 0, msg: _m211, k: 'sys' });
    });
    s._wallCell211 = 1;
    return s;
  };

  /* --------- 装备拆解：回收部分打造材料（v79：按**件**拆） --------- */
  GAME.salvageEquip = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '背包中没有这件装备' };
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '无此装备' };
    /* v88：基因强化件不可拆解（机甲材料体系不接纳它；调校等级随件保留） */
    if (it.ling) return { ok: false, msg: '「' + it.name + '」是基因强化件，不可拆解' };
    var idx = (s.inventory || []).indexOf(inst);
    if (idx < 0) return { ok: false, msg: '该件不在背包（正穿在英雄身上，先卸下）' };
    var label = GAME.eqLabel(inst);
    var mats = GAME.forgeMaterials(itemId), got = [];
    var due = { };
    for (var k in mats) {
      var n = Math.max(1, Math.floor(mats[k] * (DATA.FORGE.salvageRate || 0.4)));
      due[k] = n;
      got.push((DATA.MATERIAL_BY_ID[k] ? DATA.MATERIAL_BY_ID[k].name : k) + '×' + n);
    }
    s.items = s.items || {};
    for (var k2 in due) s.items[k2] = (s.items[k2] || 0) + due[k2];
    s.inventory.splice(idx, 1);
    GAME.statBump('salvaged', 1);
    GAME.log('拆解 ' + label + '，回收 ' + got.join('、'), 'sys', 'admin');
    return { ok: true, msg: '已拆解 ' + label + '，回收 ' + got.join('、'), got: got };
  };

  /* 配方解析（v13）：部位 → 系列组合；品质 → 品阶（1~4）
   * 例：武器 = 铁系+木系+筋系，神品(q4) 即 陨铁×16 + 复合材×11 + 泰坦筋×6 */
  GAME.forgeMaterials = function (itemId, city) {
    var it = DATA.EQUIP[itemId];
    if (!it) return {};
    var series = DATA.FORGE.matBySlot[it.slot] || ['iron', 'leather'];
    var qty = DATA.FORGE.qtyByQ[it.q] || DATA.FORGE.qtyByQ[1];
    var mul = it.set ? (DATA.FORGE.setMatMul || 1) : 1;
    var out = {};
    /* 打造技巧：材料消耗 −3%/级（封顶 −60%，至少各 1 个）—— v89.191：按城读 */
    var matDisc = Math.min(0.6, techB('forge', city));
    for (var i = 0; i < series.length; i++) {
      var mid = DATA.MAT_OF(series[i], it.q);
      if (!mid) continue;
      out[mid] = Math.max(1, Math.round((qty[i] || 1) * mul * (1 - matDisc)));
    }
    return out;
  };
  GAME.hasMaterials = function (itemId) {
    var need = GAME.forgeMaterials(itemId), s = GAME.state, items = s.items || {};
    for (var k in need) if ((items[k] || 0) < need[k]) return false;
    return true;
  };
  GAME.payMaterials = function (itemId) {
    var need = GAME.forgeMaterials(itemId), s = GAME.state, items = s.items = s.items || {};
    for (var k in need) {
      items[k] = (items[k] || 0) - need[k];
      if (items[k] <= 0) delete items[k];
    }
  };

  /* 该装备所需图纸（套装件才有） */
  GAME.blueprintOf = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (!it || !it.set) return null;
    for (var i = 0; i < DATA.BLUEPRINTS.length; i++) if (DATA.BLUEPRINTS[i].set === it.set) return DATA.BLUEPRINTS[i];
    return null;
  };
  GAME.hasBlueprint = function (itemId) {
    var bp = GAME.blueprintOf(itemId);
    if (!bp) return true;
    var s = GAME.state;
    return !!((s.items || {})[bp.id] > 0);
  };
  /* 可打造清单（按品质分组，供 UI 渲染） */
  GAME.forgeList = function () {
    var maxQ = GAME.forgeMaxQ();
    var out = [];
    Object.keys(DATA.EQUIP).forEach(function (id) {
      var it = DATA.EQUIP[id];
      if (!it || it.craft !== true && !it.set) return;   // 只列可打造件（散件 + 套装件）
      out.push({
        id: id, item: it, q: it.q,
        tierOk: it.q <= maxQ,
        bpOk: GAME.hasBlueprint(id),
        bp: GAME.blueprintOf(id),
        cost: GAME.forgeCost(id),
        mats: GAME.forgeMaterials(id),
        matsOk: GAME.hasMaterials(id),
        forged: (GAME.state.forged || []).indexOf(id) >= 0,
      });
    });
    out.sort(function (a, b) { return a.q - b.q || (a.item.slot < b.item.slot ? -1 : 1); });
    return out;
  };
  GAME.forge = function (itemId) {
    var s = GAME.state, it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    var canCraft = it.craft === true || !!it.set;
    if (!canCraft) return { ok: false, msg: '此物非锻造间所能打造' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造锻造间' };
    var maxQ = GAME.forgeMaxQ();
    if (it.q > maxQ) {
      var needLv = DATA.FORGE.tierLv[it.q - 1] || 7;
      return { ok: false, msg: '锻造间等级不足（打造' + (DATA.Q_NAME[it.q] || '') + '需 Lv' + needLv + '）' };
    }
    var bp = GAME.blueprintOf(itemId);
    if (bp && !GAME.hasBlueprint(itemId)) return { ok: false, msg: '缺少「' + bp.name + '」（游商可购，或攻占名城缴获）' };
    var cost = GAME.forgeCost(itemId);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资材不足（需 ' + GAME.costString(cost) + '）' };
    var mats = GAME.forgeMaterials(itemId);
    if (!GAME.hasMaterials(itemId)) {
      var lack = [];
      var sItems = GAME.state.items || {};
      for (var mk in mats) {
        if ((sItems[mk] || 0) < mats[mk]) {
          var md = DATA.MATERIAL_BY_ID[mk];
          lack.push((md ? md.name : mk) + ' ' + (sItems[mk] || 0) + '/' + mats[mk]);
        }
      }
      return { ok: false, msg: '打造材料不足：' + lack.join('、') + '（攻打野地或城池可获）' };
    }
    GAME.payCost(cost);
    GAME.payMaterials(itemId);
    /* v16：套装件打造**消耗 1 张图纸**（此前为永久持有、无限打造） */
    if (bp) {
      s.items = s.items || {};
      s.items[bp.id] = (s.items[bp.id] || 0) - 1;
      if (s.items[bp.id] <= 0) delete s.items[bp.id];
    }
    GAME.addEquip(itemId);   /* v79：入包唯一出口（生成实例，件号递增） */
    s.forged = s.forged || [];
    if (s.forged.indexOf(itemId) < 0) s.forged.push(itemId);
    GAME.statBump('forgedCount', 1);
    GAME.log('锻造间打造：' + it.name + '（' + (DATA.Q_NAME[it.q] || '') + '）', 'sys', 'admin');
    return { ok: true, msg: '打造完成：' + it.name, itemId: itemId };
  };

  /* ============================================================
   * 锻造间 · 熔铸强化（v77 立项 / v79 改**按件** · v89.227 更名，原名「百炼强化」）
   * ------------------------------------------------------------
   * 老板第 4 条：「装备强化是针对单件装备的，同名装备搞个区分办法」——
   * 强化等级从 s.forgeEnh[itemId]（按种共享）迁到**实例** inst.enh（按件）：
   * 同名多件各有各的等级，靠 +N 与 甲/乙/丙 序号区分（见 GAME.eqLabel）。
   * 效果并入 genEquipBonus（唯一出口），这里只管"能不能升、花多少"。
   * ============================================================ */
  GAME.enhOf = function (x) { return GAME.eqEnhOf(x); };   /* 实例/身份证 → 该件强化级 */
  GAME.enhMax = function () { return (DATA.ENHANCE && DATA.ENHANCE.max) || 10; };
  /* 下一级成本（唯一出口；UI 与扣费读同一份） */
  GAME.enhCost = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    if (!it) return null;
    var base = (DATA.FORGE.costByQ || {})[it.q] || DATA.FORGE.costByQ[1];
    var lv = GAME.enhOf(x);
    var C = DATA.ENHANCE || {};
    return {
      gold: Math.round((base.gold || 0) * (C.goldMul || 0.35) * (lv + 1)),
      iron: Math.round((base.iron || 0) * (C.ironMul || 0.22) * (lv + 1)),
      stone: Math.round((base.stone || 0) * (C.stoneMul || 0.22) * (lv + 1)),
    };
  };
  /* 可强化清单：背包 + 穿戴里的**机甲件**（品质高、已强化者在前）
     v88：过滤掉基因强化件 —— 它们走「调校」（lingTemperList），互不越界 */
  GAME.enhList = function () {
    var out = GAME.eqPieces().filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return !(it && it.ling);
    });
    out.sort(function (a, b) {
      return (DATA.EQUIP[GAME.eqId(b)].q - DATA.EQUIP[GAME.eqId(a)].q)
        || (GAME.enhOf(b) - GAME.enhOf(a));
    });
    return out;
  };
  GAME.enhance = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '尚未拥有这件装备（先打造或缴获）' };
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    /* v88：基因强化件不熔铸（导流到「调校」——材料与体系独立） */
    if (it.ling) return { ok: false, msg: '「' + it.name + '」是基因强化件，请用调校（辐能核心）' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造锻造间' };
    var lv = GAME.enhOf(inst);
    var label0 = GAME.eqLabel(inst);
    if (lv >= GAME.enhMax()) return { ok: false, msg: '「' + label0 + '」已至 +' + GAME.enhMax() + '（满级）' };
    var cost = GAME.enhCost(inst);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资材不足（需 ' + GAME.costString(cost) + '）' };
    GAME.payCost(cost);
    if (inst && typeof inst === 'object') inst.enh = lv + 1;   /* 按件 +1 */
    GAME.log('锻造间熔铸：' + label0 + ' → +' + (lv + 1), 'sys', 'admin');
    return { ok: true, msg: '「' + GAME.eqLabel(inst) + '」强化 +' + (lv + 1)
      + '（装备属性 +' + Math.round((lv + 1) * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）' };
  };

  /* ============================================================
   * v89.219（老板 1）：**套装整体强化** —— 一次把"我拥有的该套全部件"各 +1 级。
   * ------------------------------------------------------------
   * 语义 = 「整体」：总价先行校验，任一环节不足则**整体不动**（不半升）；
   * 已满级件自动跳过（不计件数、不计成本）；基因强化件不参与（归调校）。
   * 三出口同源：enhSetPiecesOf（件集合）· enhSetInfoOf（{ all, todo, cost } 展示与执行共用）
   * · enhanceSet（执行）。界面底栏「整套」键与测试都读同一份 ——
   * 成本/上限/过滤全走既有出口（enhCost / enhMax / eqPieces / eqId），不另立口径。
   * ============================================================ */
  GAME.enhSetPiecesOf = function (setId) {
    return GAME.eqPieces().filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return !!(it && it.set === setId && !it.ling);
    }).sort(function (a, b) { return (GAME.eqUidOf(a) || 0) - (GAME.eqUidOf(b) || 0); });
  };
  GAME.enhSetInfoOf = function (setId) {
    var def = (DATA.SETS || {})[setId];
    if (!def) return null;
    var all = GAME.enhSetPiecesOf(setId);
    var maxE = GAME.enhMax();
    var todo = all.filter(function (x) { return GAME.eqEnhOf(x) < maxE; });
    var cost = { gold: 0, iron: 0, stone: 0 };
    todo.forEach(function (x) {
      var c = GAME.enhCost(x) || {};
      for (var k in c) cost[k] = (cost[k] || 0) + c[k];
    });
    return { def: def, all: all, todo: todo, cost: cost, maxE: maxE };
  };
  GAME.enhanceSet = function (setId) {
    var info = GAME.enhSetInfoOf(setId);
    if (!info) return { ok: false, n: 0, msg: '未知套装' };
    if (GAME.forgeLevel() <= 0) return { ok: false, n: 0, msg: '需先建造锻造间' };
    if (!info.all.length) return { ok: false, n: 0, msg: '「' + info.def.name + '」一件都还没有（先打造 / 缴获几件）' };
    if (!info.todo.length) return { ok: false, n: 0, msg: '「' + info.def.name + '」整套已至 +' + info.maxE + '（满级）' };
    if (!GAME.canAfford(info.cost)) {
      return { ok: false, n: info.todo.length,
        msg: '整套资材不足（' + info.todo.length + ' 件共需 ' + GAME.costString(info.cost) + '）' };
    }
    GAME.payCost(info.cost);
    info.todo.forEach(function (x) { x.enh = GAME.eqEnhOf(x) + 1; });   /* 按件 +1 */
    GAME.log('锻造间熔铸：' + info.def.name + ' 整套 +1（' + info.todo.length + ' 件，耗 ' + GAME.costString(info.cost) + '）', 'sys', 'admin');
    return { ok: true, n: info.todo.length, cost: info.cost,
      msg: '「' + info.def.name + '」整套 +1 —— ' + info.todo.length + ' 件（共耗 ' + GAME.costString(info.cost) + '）' };
  };

  /* ============================================================
   * v88 · 调校（基因强化件的强化 —— 与机甲熔铸平行的独立体系）
   * ------------------------------------------------------------
   * 材料 = 辐能核心（s.items.lingsui），与旧币/铁/石完全独立；
   * 等级存 inst.enh（与机甲共实例架构，同名各件互不影响），上限 +10、每级 +8%。
   * 效果并入 genEquipBonus（六维）与 GAME.lingPowerOf（机能）——唯一出口。
   * 不失败、不降级、不碎裂（对齐「不惩罚」铁律）。
   * ============================================================ */
  GAME.lingTemperMax = function () { return (DATA.LING_TEMPER && DATA.LING_TEMPER.max) || 10; };
  /* 下一级成本（唯一出口；UI 与扣费读同一份）：essBase + (lv+1) x essPerLv */
  GAME.lingTemperCost = function (x) {
    var lv = GAME.eqEnhOf(x);
    var C = DATA.LING_TEMPER || {};
    return Math.round((C.essBase || 10) + (lv + 1) * (C.essPerLv || 10));
  };
  GAME.lingTemper = function (ref) {
    var s = GAME.state;
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '尚未拥有这件装备' };
    /* v89：调校君主专属（基因线）；防御性：该件若在非君主身上先拒绝 */
    if (!GAME.lordGeneralOf()) return { ok: false, msg: '君主不在，无从调校' };
    var wornOther = false;
    (s.generals || []).forEach(function (g2) {
      if (!g2 || GAME.isLordGeneral(g2) || !g2.lingEquip) return;
      for (var sl2 in g2.lingEquip) { if (g2.lingEquip[sl2] === inst) wornOther = true; }
    });
    if (wornOther) return { ok: false, msg: '该件在他人身上 —— 先卸下再调校' };
    var it = DATA.EQUIP[GAME.eqId(inst)];
    if (!it || !it.ling) return { ok: false, msg: '只有基因强化件可以调校' };
    var lv = GAME.eqEnhOf(inst);
    var label0 = GAME.eqLabel(inst);
    if (lv >= GAME.lingTemperMax()) return { ok: false, msg: '「' + label0 + '」已至 +' + GAME.lingTemperMax() + '（圆满）' };
    var cost = GAME.lingTemperCost(inst);
    s.items = s.items || {};
    var own = s.items.lingsui || 0;
    if (own < cost) return { ok: false, msg: '辐能核心不足（需 ' + cost + '，现有 ' + own + '）' };
    s.items.lingsui = own - cost;
    if (inst && typeof inst === 'object') inst.enh = lv + 1;   /* 按件 +1 */
    GAME.log('调校：' + label0 + ' → +' + (lv + 1) + '（耗辐能核心 ' + cost + '）', 'sys', 'admin');
    return { ok: true, msg: '「' + GAME.eqLabel(inst) + '」调校 +' + (lv + 1)
      + '（强化属性 +' + Math.round((lv + 1) * ((DATA.LING_TEMPER || {}).perLv || 0.08) * 100) + '%）' };
  };
  /* 调校清单（背包 + 穿戴的辐能件；品质高、已调校者在前） */
  GAME.lingTemperList = function () {
    var out = GAME.eqPieces().filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return !!(it && it.ling);
    });
    out.sort(function (a, b) {
      return (DATA.EQUIP[GAME.eqId(b)].q - DATA.EQUIP[GAME.eqId(a)].q)
        || (GAME.eqEnhOf(b) - GAME.eqEnhOf(a));
    });
    return out;
  };

  /* --------- 君主改名（v77 · 君主面板） --------- */
  GAME.renameLord = function (name) {
    var s = GAME.state;
    name = String(name == null ? '' : name).trim();
    if (!name) return { ok: false, msg: '名字不能为空' };
    if (name.length > 8) return { ok: false, msg: '名字过长（8 字以内）' };
    s.ruler = s.ruler || {};
    s.ruler.name = name;
    var lg = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null;
    if (lg) lg.name = name;   // 君主本人也是英雄（v70）：两处同源
    GAME.log('君主更名：' + name);
    return { ok: true, msg: '君主已更名为 ' + name };
  };

  /* --------- 君主换头像（v89.7 · 老板「头像可更换」） ---------
   * 只改一处事实源：`s.ruler.portraitSeed`（头像池下标，一个整数）。
   * v70 口径「君主与君主英雄同脸」—— 两处同源一起改（同改名：两处同更）。
   * 可用池按性别：m / f 各 20 张；越界拒绝，不动任何字段。 */
  GAME.setLordAvatar = function (idx) {
    var s = GAME.state;
    if (!s || !s.ruler) return { ok: false, msg: '尚未开局' };
    var pool = (GAME.portraits && GAME.portraits.POOL
      && GAME.portraits.POOL[s.ruler.gender === 'female' ? 'f' : 'm']) || [];
    if (!pool.length) return { ok: false, msg: '头像池不可用（assets/portraits/pool 缺失）' };
    idx = Math.floor(Number(idx));
    if (!(idx >= 0 && idx < pool.length)) return { ok: false, msg: '头像编号越界（0 ~ ' + (pool.length - 1) + '）' };
    s.ruler.portraitSeed = idx;
    var lg = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null;
    if (lg) lg.portraitSeed = idx;   /* v70：两处同源（顶栏立绘 + 英雄页的脸） */
    return { ok: true, msg: '已更换头像（第 ' + (idx + 1) + ' 张）' };
  };

  /* --------- 解雇英雄（装备全数归还；名将离去损声望） --------- */
  GAME.dismissGeneral = function (genId) {
    var s = GAME.state;
    if ((s.generals || []).length <= 1) return { ok: false, msg: '帐下至少须留一位英雄' };
    var g = null, idx = -1;
    s.generals.forEach(function (x, i) { if (x.id === genId) { g = x; idx = i; } });
    if (!g) return { ok: false, msg: '英雄不存在' };
    /* v70（老板）：「不可解雇」—— 君主本人（框架与守卫同源：GAME.isLordGeneral） */
    if (GAME.isLordGeneral(g)) return { ok: false, msg: '君主本人不可解雇' };
    /* v89.135：在外执行任务的英雄一律不可解雇（出征 / 采集 / 驻守野地）——
       防"解雇后采集队与驻军的 genId 悬空"（那会让界面显示"（将已不在）"的假异常）。 */
    if (g.status === 'march') return { ok: false, msg: g.name + ' 正在出征，不可解雇' };
    if (g.status === 'gather') return { ok: false, msg: g.name + ' 正在采集（撤回采集队后再解雇）' };
    if (g.status === 'garrison') return { ok: false, msg: g.name + ' 正在驻守野地（召回驻军后再解雇）' };
    s.inventory = s.inventory || [];
    var back = 0;
    /* v88：两套部件都归还（机甲 + 基因） */
    ['equip', 'lingEquip'].forEach(function (bk) {
      for (var slot in (g[bk] || {})) { s.inventory.push(g[bk][slot]); back++; }
    });
    s.generals.splice(idx, 1);
    var repCost = g.hero ? 50 : 0;
    if (repCost) s.rep = Math.max(0, (s.rep || 0) - repCost);
    GAME.heartsComfortAdd(-2);      /* v89.177：民心改动统一走安抚通道（-2 解雇之伤） */
    GAME.statBump('dismissed', 1);
    GAME.log('解雇 ' + g.name + '（归还装备 ' + back + ' 件' + (repCost ? '，声望 -' + repCost : '') + '）', 'sys', 'staff');
    return { ok: true, msg: '已解雇 ' + g.name + '，归还装备 ' + back + ' 件'
      + (repCost ? '（声望 -' + repCost + '）' : '') };
  };

  /* --------- 守将加成（城守对城池经营的作用） ---------
   * 报告 9.2：治理1点 = 产量+1%、建造速度+1%；武力1点 = 征兵速度+0.5%；
   *           谋略1点 = 研究速度+0.5%、城防+0.5%
   *
   * v63（老板）：「守将属性**只对当前城池**起加成作用，不同城市有不同的守将」。
   * 改前是 `guardBonusTotal()` —— 把**全境所有守将**的加成累加起来，
   * 然后拿这个总数去算产量（`prodFactors`）、建造加速、征兵加速、研究加速。
   * 于是一个 B 城的守将也能给 A 城加成，甚至加成哪个城加起来都一样 ——
   * 这是最典型的"同一个数被当成全局用"。现在全部改成**读本城守将**：
   *   · 产量   → `GAME.prodFactors(r, city)` / `cityProdPerSec(city)`
   *   · 建造   → `GAME.cityBuildMult(city)`
   *   · 征兵   → `GAME.guardBonus(city).train`
   *   · 研究   → 研究由某城的研习所发起，取**发起城**的守将（`S.research(id, cityId)`）
   * ------------------------------------------------------------ */
  /* 城池建造加速系数（**城主**治理 1 点 → 建造速度 +1%，最多加速 60%）——
     **按城取**：传哪座城就只吃哪座城的城主。
     v89.113：原名 guardBuildMult（守将建造）—— 职能迁往城主后**改名对齐**
     （名与实不符的名字就是下一个 bug 的温床；全消费点已同步）。 */
  GAME.cityBuildMult = function (city) {
    return GAME._rawCityBuildMult(city) / (1 + techB('build', city));   // 建筑技术：耗时 −5%/级（v89.191：按城读）
  };
  GAME._rawCityBuildMult = function (city) {
    var mb = GAME.mayorBonus(city);
    return 1 / (1 + (mb.build || 0));      /* v89.164：曲线自带边界，二次截断（旧 min 1.5）退役 */
  };

  GAME.guardGeneralOf = function (city) {
    var s = GAME.state;
    if (!s || !city) return null;
    for (var i = 0; i < s.generals.length; i++) {
      var g = s.generals[i];
      if (g.cityId === city.id && g.status === 'guard') return g;
    }
    return null;
  };

  /* ============================================================
   * v89.113（老板需求 3）：**「城主」与「守将」同级分职**
   * ------------------------------------------------------------
   * 老板令：「添加一个与守将同级的职位，名为城主，城主的**治理和谋略**
   *   起当前守将的作用。后续守将的功能将会更新：1）武力对征兵速度加成；
   *   2）守城战时作为我方英雄对阵，对战斗加成。」
   *
   * 分工（一人一职，status 单值天然互斥）：
   *   · 城主（mayor）—— 文治：治理 nz → 产量 + 建造；谋略 zm → 研究 + 城防
   *   · 守将（guard）—— 武功：武力 yw → 征兵速度；战时报**对阵英雄**（defGen）
   *
   * ⚠️ 迁移口径：老档里 nz/zm 的加成原本由守将提供 —— 本版起**只有城主**提供。
   *    未任命城主 = 治理/谋略加成为零（界面会提示任命），不会静默回落给守将
   *    （那样等于两个出口，正是本项目反复修的病）。
   * ============================================================ */
  GAME.mayorGeneralOf = function (city) {
    var s = GAME.state;
    if (!s || !city) return null;
    for (var i = 0; i < s.generals.length; i++) {
      var g = s.generals[i];
      if (g.cityId === city.id && g.status === 'mayor') return g;
    }
    return null;
  };
  /* ============================================================
   * v89.164（老板 1）→ v89.185（老板「设计不封口上限」）：城主六维加成的唯一曲线出口 ——
   *   率 = r0 / min(2^k, tailDiv)（k 为段号）：前两段减半照旧（与 v89.164 逐点相同），
   *   段 2 起率恒定 r0/4 —— **不再减半、永不封顶**（治理 +0.25%/点 · 谋略 +0.125%/点）。
   *   450 点以内与旧曲线一字不差（老档体感不变）；尾段边际恒定（后期提升永不熄火）。
   * 样本（见 DATA.MAYOR_CURVE 头注）：治理 1400 → +500%（旧封顶 +299.5%）。
   * ============================================================ */
  GAME.curveBonusOf = function (pts, r0, seg) {
    var MC = DATA.MAYOR_CURVE || {};
    seg = Math.max(1, seg || MC.seg || 150);
    var tailDiv = Math.max(1, MC.tailDiv || 4);
    var total = 0, left = Math.max(0, pts || 0), k = 0;
    while (left > 0) {
      var div = Math.min(Math.pow(2, k), tailDiv);
      if (div >= tailDiv) { total += left * r0 / tailDiv; break; }   /* v89.185：尾段恒定率 —— 不封口 */
      var take = Math.min(left, seg);
      total += take * r0 / div;
      left -= take; k++;
    }
    return total;
  };
  GAME.mayorBonus = function (city) {
    var g = GAME.mayorGeneralOf(city);
    if (!g) return { name: null, prod: 0, build: 0, tax: 0, research: 0, def: 0, faint: 1 };
    var a = GAME.genAttrs(g);
    /* 忠诚低于警戒线 → 该将勤勉不足，加成打折（与守将同一条忠诚规则） */
    var faint = (g.loyalty != null && g.loyalty < DATA.LOYALTY.warnAt) ? DATA.LOYALTY.faintMul : 1;
    /* v89.164（老板 1）→ v89.185（老板「设计不封口上限」）：六维加成走 DATA.MAYOR_CURVE 曲线 ——
       前两段减半照旧、段 2 起率恒定（治理尾段 +0.25%/点 · 谋略 +0.125%/点），永不封顶。
       旧的三条"封顶"常量（1.5/1.5/1.0）**与 v89.164 的收敛边界都已下线** —— 消费端不做任何二次截断。 */
    var MB_SEG = (DATA.MAYOR_CURVE || {}).seg || 150;
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      prod: GAME.curveBonusOf(a.nz, 0.01, MB_SEG) * faint,      // 治理 → 产量（150→+150% · 尾段恒定不封口）
      build: GAME.curveBonusOf(a.nz, 0.01, MB_SEG) * faint,     // 治理 → 建造（同率同曲线）
      /* v89.162（老板「内政对税收也应有加成」）→ v89.188（老板 3）：「城主对税收的加成
         减少一点，封顶 200%」——税收通道**独立率**（MAYOR_CURVE.taxRate 0.006）且封顶
         （taxCap 2.0）；产量/建造不受影响（仍 0.01 不封口）。结算（cityProdPerSec）与
         分解（prodBreakdown）同源读它。 */
      tax: Math.min(GAME.curveBonusOf(a.nz, (DATA.MAYOR_CURVE || {}).taxRate || 0.006, MB_SEG),
                    (DATA.MAYOR_CURVE || {}).taxCap || 2) * faint,
      research: GAME.curveBonusOf(a.zm, 0.005, MB_SEG) * faint, // 谋略 → 研究（150→+75% · 尾段恒定不封口）
      def: GAME.curveBonusOf(a.zm, 0.005, MB_SEG) * faint,      // 谋略 → 城防（同率同曲线）
    };
  };

  /* 守将加成（v89.113 起**只保武功**：征兵 + 战时对阵）。
     治理/谋略的加成已迁往 mayorBonus —— 别在这里再加回来（两个出口必漂移）。 */
  GAME.guardBonus = function (city) {
    var g = GAME.guardGeneralOf(city);
    if (!g) return { name: null, train: 0, faint: 1 };
    var a = GAME.genAttrs(g);
    var faint = (g.loyalty != null && g.loyalty < DATA.LOYALTY.warnAt) ? DATA.LOYALTY.faintMul : 1;
    return {
      name: g.name, gen: g, faint: faint, loyalty: g.loyalty,
      train: a.yw * 0.005 * faint,     // 武力 1 点 → 征兵速度 +0.5%
    };
  };

  /* 全部守将加成累加（多城多守将则叠加）
   * ⛔ v63 已删 —— 它是"守将加成被当成全局数"的源头。
   * 老板：「守将属性只对当前城池起加成作用」→ 需要加成的地方一律传城，
   * 走 `GAME.guardBonus(city)`（唯一出口）。留着这个函数就等于留了个后门，
   * 顺手改回全境口径只要一行 —— 所以按项目规矩**删掉**而不是留着不用。 */
  /* --------- 城防 --------- */
  /* 城防（守备力）—— **不含自建箭塔**的基础值。
     v62：拆出 Base 是为了断开"箭塔 ↔ 城防"的循环：
       箭塔座数由城防折出（v59），若城防又把箭塔算进去，就会互相喂。
       所以：`cityDefenseBase` = 城防的本体（围墙/驻防/专精/天时/守将），
       `cityDefense` = Base + 自建箭塔的贡献（给界面与"守军减伤"用），
       而**箭塔座数**只从 Base 折出来（见 GAME.towerCountOf）。 */
  GAME.cityDefenseBase = function (city) {
    var wallLvl = GAME.buildingLevel(city, 'chengqiang');
    var base = city.def + wallLvl * 20;
    /* v28（需求 1）：围墙建筑专精 —— 城防 +25%/档（v89.137：三档 = ×1.25 / ×1.5 / ×1.75） */
    var _dm137 = GAME.mastery('defPct', city);
    if (_dm137 > 0) base = Math.round(base * (1 + _dm137));
    if (GAME.story) base = Math.round(base * GAME.story.cityDefMult()); // 名将羁绊：守御
    /* v89.113（老板需求 3）：城防的谋略项迁往**城主**（守将从此只管征兵与对阵） */
    var mbc = GAME.mayorBonus(city);
    /* v89.164：曲线自带边界，二次截断（旧 min 1.0）退役 */
    if (mbc.name) base = Math.round(base * (1 + (mbc.def || 0))); // 城主谋略：城防
    return base;
  };
  GAME.cityDefense = function (city) {
    /* v62（老板：「机工坊可以造箭塔，箭塔默认参与防守」）：
       自建箭塔按 `homeDef` 计入守备力 —— 造好即生效、无需指派。
       这也是"造箭塔"立刻看得见的回报（守备力数字 + 守军减伤 defBonus）。 */
    return GAME.cityDefenseBase(city) + GAME.towersBuiltOf(city) * TW_T().homeDef;
  };

  /* ============================================================
   * 箭塔（v62 · 老板）—— 两个来源，**一个出口**
   * ------------------------------------------------------------
   *   来源① 城防折出（v59 照搬原版：每 2 点城防 = 1 座）
   *   来源② 机工坊建造（玩家自己造的，存 `city.towers`）
   * 战斗与界面一律读 `GAME.towerCountOf(city)` ——
   * 别处不要再自己 `wallTowerCount(cityDefense(...))`（那就是第二个出口）。
   * ============================================================ */
  function TW_T() { return DATA.WALL_TOWER; }
  GAME.towersBuiltOf = function (city) {
    return Math.max(0, Math.floor((city && city.towers) || 0));
  };
  /* 城防折出的座数（不含自建） */
  GAME.towersFromDef = function (city) {
    if (!city) return 0;
    var T = GAME.tactic;
    var base = GAME.cityDefenseBase(city);
    return T ? T.wallTowerCount(base) : 0;
  };
  /* **唯一出口**：本城箭塔总座数 */
  GAME.towerCountOf = function (city) {
    if (!city) return 0;
    return GAME.towersFromDef(city) + GAME.towersBuiltOf(city);
  };
  /* 机工坊能造多少座（上限 = 作坊等级 × buildMaxPerLv） */
  GAME.towerCapOf = function (city) {
    if (!city) return 0;
    var lv = GAME.buildingLevel(city, 'gongjiangzuofang');
    return lv * TW_T().buildMaxPerLv;
  };
  /* 还能再造几座 */
  GAME.towerRoomOf = function (city) {
    return Math.max(0, GAME.towerCapOf(city) - GAME.towersBuiltOf(city));
  };
  /* 造 n 座的总价（唯一出口；界面与扣费都读它） */
  GAME.towerCostOf = function (n) {
    var c = TW_T().buildCost, out = {};
    n = Math.max(0, Math.floor(n) || 0);
    for (var k in c) out[k] = c[k] * n;
    return out;
  };
  GAME.buildTowers = function (cityId, n) {
    var s = GAME.state;
    var city = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    var lv = GAME.buildingLevel(city, 'gongjiangzuofang');
    if (lv <= 0) return { ok: false, msg: city.name + '尚无机工坊，无从制造' };
    n = Math.floor(Number(n) || 0);
    if (!(n > 0)) return { ok: false, msg: '数量必须大于 0' };
    var room = GAME.towerRoomOf(city);
    if (room <= 0) {
      return { ok: false, msg: '已达上限：作坊 Lv' + lv + ' 最多造 ' + GAME.towerCapOf(city) + ' 座箭塔' };
    }
    n = Math.min(n, room);
    /* 费用从**该城**库存扣（v60 起资源归属城池）——
       ⚠️ 不要用 `canAfford`/`payCost`：那两个绑的是**当前城**的库存，
       在 B 城的界面上建设 A 城的箭塔就会扣错城。 */
    var R = GAME.res(city);
    var unit = TW_T().buildCost;
    /* 数量请求可被资源**自动下调**：`造满`这类按钮的语义是"尽可能多"，
       点了只回一句"资源不足"等于没反应。能造几座就造几座，并在消息里写明。 */
    var affordable = n;
    for (var uk in unit) {
      if (unit[uk] > 0) affordable = Math.min(affordable, Math.floor((R[uk] || 0) / unit[uk]));
    }
    if (affordable <= 0) {
      /* 用 GAME.resName 自己拼，不走 GAME.costString ——
         那个出口挂在 ui 层（`GAME.costString = ui.costString`），
         domain 依赖 ui 会让"只加载 domain 的探针/测试"直接崩。 */
      var needStr = Object.keys(unit).map(function (k2) {
        return GAME.resName(k2) + ' ' + U.fmt(unit[k2]);
      }).join('　');
      return { ok: false, msg: '资源不足：每座' + TW_T().name + '需 ' + needStr };
    }
    var asked = n;
    n = Math.min(n, affordable);
    city.towers = GAME.towersBuiltOf(city) + n;
    for (var k in GAME.towerCostOf(n)) R[k] = (R[k] || 0) - GAME.towerCostOf(n)[k];
    var msg = city.name + ' 新筑' + TW_T().name + ' ' + n + ' 座（共 ' + city.towers + ' / ' +
      GAME.towerCapOf(city) + '）· 守备力 ' + GAME.cityDefense(city) +
      (asked > n ? '　（资源所限，未按请求的 ' + asked + ' 座）' : '');
    GAME.log('🏹 ' + msg);
    return { ok: true, msg: msg, built: n, total: city.towers };
  };

  /* --------- v53：**一城一守将** ---------
     改前：同一座城可以连任多个守将，而 guardGeneralOf 只取**第一个**匹配 ——
     于是后来任命的那位既不生效、也不报错，加成始终挂在旧将身上。
     老板观察到的现象正是这个：任命了新守将，"相应加成链条数值"却没跟着新英雄的属性走。
     现在：任命即替换（旧任自动解任），读档也做归一化，两条路都走下面这一个执行口。 */
  /* 解除某城的守将（keepId 那位除外），返回被解任者名字数组 */
  GAME.releaseGuardsOf = function (cityId, keepId) {
    var out = [];
    (((GAME.state || {}).generals) || []).forEach(function (x) {
      if (x.id === keepId) return;
      if (x.status === 'guard' && x.cityId === cityId) {
        x.status = 'idle'; x.cityId = null; out.push(x.name);
      }
    });
    return out;
  };
  /* v89.113：城主的同款释放口（与守将成对 —— 任命即替换，一城一城主） */
  GAME.releaseMayorsOf = function (cityId, keepId) {
    var out = [];
    (((GAME.state || {}).generals) || []).forEach(function (x) {
      if (x.id === keepId) return;
      if (x.status === 'mayor' && x.cityId === cityId) {
        x.status = 'idle'; x.cityId = null; out.push(x.name);
      }
    });
    return out;
  };
  /* 读档归一化：同一座城的多个守将只留**最先出现**的那位
     （= 改前 guardGeneralOf 取首个时实际生效的那位，读档不改变玩家现状），其余退回空闲。 */
  /* v64：把**没有归属城**的英雄挂到首城。
     为什么要归一化：席位是"按城"算的（`generalsIn` 走 `genCityOf`），
     而 `genCityOf` 对 cityId 为空的人会**回落到当前城** ——
     那样这个人会随"我现在在看哪座城"飘来飘去，席位统计自然跟着飘。
     实名的来源只有两处：名将归降（`battle.grantHero` 现在会带出发城）
     与老存档（v64 之前降将的 cityId 是 null）。 */
  GAME.normalizeGenCities = function () {
    var s = GAME.state;
    if (!s || !s.generals || !s.cities || !s.cities.length) return 0;
    var ids = {};
    s.cities.forEach(function (c) { ids[c.id] = 1; });
    var home = s.cities[0].id, n = 0;
    s.generals.forEach(function (g) {
      if (!g.cityId || !ids[g.cityId]) { g.cityId = home; n++; }
    });
    return n;
  };

  GAME.normalizeGuards = function () {
    var s = GAME.state;
    if (!s || !s.generals) return [];
    var keep = {}, out = [];
    s.generals.forEach(function (g) {
      if (g.status !== 'guard' || !g.cityId) return;
      if (!keep[g.cityId]) keep[g.cityId] = g.id;
    });
    Object.keys(keep).forEach(function (cid) {
      out = out.concat(GAME.releaseGuardsOf(cid, keep[cid]));
    });
    return out;
  };

  /* ============================================================
   * 战术（v59 出征 · v89.109 分侧：出征战术 + **防守战术**）
   * ------------------------------------------------------------
   * 每兵种：动作（前进/防御/后退）+ 目标（敌方兵种 id 或 `_tower` = 箭塔）
   *   + **防守侧专属**「是否出城迎战」（sortie）—— 出城迎战 = 前出到围墙之外迎敌，
   *     把前线前移、阻敌近墙（战场引擎里 adv 前移到 `T.SORTIE_ADV`）。
   * · 攻方：读玩家「军务 · 出征 / 练兵场 → 出征战术」的设置（side='atk'）；
   * · 守方：**我方城池被攻打时**读玩家「军务 · 防守」的设置（side='def'，ctx.playerDef）；
   *   NPC 守方仍用默认动作（v89.203 起：野地/据点/名城一律**全员前进**）。
   * 非法值一律回落默认 —— 否则单位行位会变成 NaN，整场战斗静默跑坏。
   * ⚠️ 老档迁移：v89.109 前 `s.tactics` 是**单一表**（只服务出征）→ 归入 atk 侧，
   *   由 `tacticsOf` 惰性完成（首次访问时迁移；不另写启动钩子）。
   * ============================================================ */
  GAME.tacticsOf = function (side) {
    var s = GAME.state;
    if (!s) return {};
    var T = s.tactics || {};
    if (!T.atk && !T.def) {                      /* 老档（{兵种:{s,t}}）→ 归 atk 侧 */
      var legacy = {};
      Object.keys(T).forEach(function (k) {
        if (T[k] && typeof T[k] === 'object') legacy[k] = T[k];
      });
      s.tactics = { atk: legacy, def: {} };
      T = s.tactics;
    }
    T.atk = T.atk || {};
    T.def = T.def || {};
    /* v89.136（老板 4）：「出征战术细分掠夺，占领，分别允许进行相应的默认战术设置」——
       新增两张**出征细分表**（空表 = 沿用通用 atk；'raid'/'occupy' 是写入/展示键）。
       战斗读取走 `GAME.tacticsFor`（细分覆盖通用 · 逐兵种回退）。 */
    T.raid = T.raid || {};
    T.occupy = T.occupy || {};
    if (side === 'raid' || side === 'occupy') return T[side];
    return side === 'def' ? T.def : T.atk;
  };
  /* ============================================================
   * v89.149（老板 3）：「为兵种设置一个**一字简称**，不要挤压行动设置和目标设置」
   * ------------------------------------------------------------
   * 战场两侧列表每格只有 ~105px（2 列 × 侧栏 211px），兵种全称（3~4 字 = 约 60px）
   * 把两个下拉挤到 31px / 57px（实测）—— 名字一字化后，两份宽度都归下拉。
   * 简称表在 `DATA.TROOPS[].ab`（数据层唯一来源，不在这里另抄一张）；
   * 缺字段时兜底取名字首字（新增兵种忘了写 ab 也不会留空）。
   * 界面用简称、`title` 悬停给全名与最终属性（信息不丢）。
   * ============================================================ */
  GAME.troopAbOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return '';
    return t.ab || (t.name || '').charAt(0);
  };
  /* ============================================================
   * v89.150（老板 1）：「战场中兵种[周]围的环形框，根据兵种，步兵窄一点，
   *   机车比目前稍窄但比步兵宽，如果是器械兵种如无人轰炸机等则维持目前方块大小，
   *   使兵种便于区分」——
   * **兵种形态的唯一出口**（战场兵牌与断言都读它，不各判一份）：
   *   · 'craft' 器械（craft = true：无人轰炸机 / 自行火炮）→ 维持原方块尺寸；
   *   · 'ride'  机车（ride = true）→ 比原稍窄、比徒步宽；
   *   · 'walk'  徒步（其余，含板车/侦察单元）→ 窄。
   * 判定只读数据表字段（`ride` / `craft`），不写死 id 名单 —— 以后加兵种自动归类。
   * v89.230：类名随兵种体系同步（原 'inf'/'cav'/'siege' 退役 —— 步兵/骑兵不再区分，
   *   与 CSS 的 .walk/.ride/.craft 三档一一对应）。
   * ============================================================ */
  GAME.troopShapeOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return 'walk';
    if (t.craft) return 'craft';
    if (t.ride) return 'ride';     /* v89.229：cat 退役 → ride 显式字段（机车族） */
    return 'walk';
  };
  /* v89.136（老板 4）：出征战斗的**唯一读口** —— 细分覆盖通用（逐兵种回退）。
     · modeId = 'raid' / 'occupy'（其余一律按占领：scout 不开战，不入此路）；
     · 返回**新对象**（只读视图 —— 写入走 tacticsOf(side)/setTactic，勿写回本对象）。 */
  GAME.tacticsFor = function (modeId) {
    var base = GAME.tacticsOf('atk');
    var sub = GAME.tacticsOf(modeId === 'raid' ? 'raid' : 'occupy');
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(sub).forEach(function (k) { out[k] = sub[k]; });
    return out;
  };
  GAME.tacticOf = function (side, troopId, ctx) {
    var d = (DATA.STANCE_DEFAULT || {})[side] || 'advance';
    if (side === 'def') {
      /* ⛔ v89.203（老板 2）：攻城守方默认「防御」的特例随口径统一退役 ——
         野地/据点/名城守方一律默认「全员前进」（STANCE_DEFAULT.def）。
         ctx.sieging 仍供引擎（箭塔射程/攻城加成）使用，不再影响默认阵位。 */
      /* v89.109：**我方城**作守方（ctx.playerDef）→ 用玩家的防守战术；
         NPC 守方仍走默认（不读玩家设置，否则"我的战术给别人用"）。 */
      var mD = (ctx && ctx.playerDef && troopId) ? GAME.tacticsOf('def')[troopId] : null;
      if (mD) {
        var sidD = null;
        (DATA.STANCES || []).forEach(function (x) { if (mD.s === x.id) sidD = x.id; });
        return { s: sidD || d, t: (typeof mD.t === 'string') ? mD.t : '', sortie: !!mD.sortie };
      }
      return { s: d, t: '', sortie: false };
    }
    /* v89.136（老板 4）：出征读"细分覆盖通用"（ctx.modeId = raid/occupy；缺省按占领） */
    var m = GAME.tacticsFor((ctx && ctx.modeId) || 'occupy')[troopId];
    var sid = null;
    (DATA.STANCES || []).forEach(function (x) { if (m && m.s === x.id) sid = x.id; });
    return { s: sid || d, t: (m && typeof m.t === 'string') ? m.t : '',
      sortie: !!(m && m.sortie) };
  };
  /* 写战术 —— 双签名（v89.109 起支持按侧；旧调用一字不改）：
       setTactic(troopId, patch)          出征战术（v59 旧签名）
       setTactic('def', troopId, patch)   按侧写入 */
  GAME.setTactic = function (a, b, c) {
    var side = 'atk', troopId, patch;
    if (a === 'atk' || a === 'def' || a === 'raid' || a === 'occupy') { side = a; troopId = b; patch = c; }
    else { troopId = a; patch = b; }
    if (!DATA.TROOPS[troopId]) return { ok: false, msg: '兵种不存在' };
    patch = patch || {};
    var T = GAME.tacticsOf(side);
    var cur = T[troopId] || {};
    if (patch.s !== undefined) {
      var ok = false;
      (DATA.STANCES || []).forEach(function (x) { if (x.id === patch.s) ok = true; });
      if (ok) cur.s = patch.s;
    }
    if (patch.t !== undefined) cur.t = String(patch.t || '');
    if (patch.sortie !== undefined) cur.sortie = !!patch.sortie;    /* v89.109：出城迎战 */
    T[troopId] = cur;
    return { ok: true };
  };
  /* 当前战术的一句话摘要（页面/弹窗用）—— 与"设了什么"一一对应，不是固定文案 */
  GAME.tacticSummary = function (side) {
    var isSub = (side === 'raid' || side === 'occupy');
    if (!isSub) side = side === 'def' ? 'def' : 'atk';
    var m = isSub ? GAME.tacticsFor(side) : GAME.tacticsOf(side);
    var ids = Object.keys(m);
    if (!ids.length) return side === 'def' ? '未设（默认：全员前进）'
      : (isSub ? '未设（沿用通用 · 默认全线前进）' : '全体前进（默认）');
    var n = {};
    var defS = (DATA.STANCE_DEFAULT || {})[side] || 'advance';
    ids.forEach(function (id) {
      var mD = m[id], sid = null;
      (DATA.STANCES || []).forEach(function (x) { if (mD && mD.s === x.id) sid = x.id; });
      var sr = sid || defS;
      n[sr] = (n[sr] || 0) + 1;
    });
    var parts = [];
    (DATA.STANCES || []).forEach(function (x) { if (n[x.id]) parts.push(n[x.id] + ' 种' + x.name); });
    if (side === 'def') {
      var sc = 0;
      ids.forEach(function (id) { if (m[id] && m[id].sortie) sc++; });
      if (sc) parts.push(sc + ' 种出城迎战');
    }
    return parts.join(' · ');
  };
  GAME.clearTactics = function (side) {
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var T = GAME.tacticsOf(side);
    /* 原地清空（别换对象 —— 别处可能持有引用） */
    Object.keys(T).forEach(function (k) { delete T[k]; });
    return { ok: true,
      msg: side === 'def' ? '已恢复默认防守战术（全员前进）'
        : side === 'raid' ? '已恢复默认掠夺战术（沿用通用 / 默认全线前进）'
        : side === 'occupy' ? '已恢复默认占领战术（沿用通用 / 默认全线前进）'
        : '已恢复默认战术（全军前进）' };
  };

  /* --------- 英雄 --------- */
  /* ============================================================
   * v89.117（老板「城主和守将不能执行出征动作」）
   * ------------------------------------------------------------
   * 出征主将的**唯一出口**：谁走不开，只有一个地方说了算（界面置灰 + 硬拦都读它）。
   *   · 城主（mayor）：驻城理政 —— 治理/谋略加成与守城加成都在本城，走不开；
   *   · 守将（guard）：镇守本城 —— 战时对阵要靠他，走不开；
   *   · 出征中（march）/ 采集中（gather）：本来就不在城里。
   * 返回 null = 可出征；返回字符串 = **不可出征的原因**（界面直接显示这句）。
   * 与 `GAME.assignGeneral`（任命）同族：一个人的 status 是单值，故互斥天然成立。
   * ============================================================ */
  GAME.marchBlockOf = function (g) {
    if (!g) return '帐下无此英雄';
    var st = g.status || 'idle';
    /* v89.194（老板 S4）：「忠诚度为 0 时英雄无法出征」——第三条硬拦。
       恢复路径 = 珠宝赏赐（+5~+36/颗，见 gen-gift-pick）；君主豁免（忠诚恒 100 本不适用，防老档脏值）。 */
    var loy194 = (g.loyalty == null ? 70 : g.loyalty);
    if (loy194 <= 0 && !(GAME.isLordGeneral && GAME.isLordGeneral(g))) return '忠诚已尽（赏赐珠宝可安抚）';
    /* 硬拦只有两条：城主 / 守将（老板原话「城主和守将不能执行出征动作」）。
       ⚠️ 「出征中 / 采集中」**不硬拦** —— 那是**本轮之前就存在**的行为（同一主将
       可以带第二支队伍），本轮不动它；界面另有软提示（marchBusyOf）。 */
    if (st === 'mayor') return '城主（驻城理政，不可出征）';
    if (st === 'guard') return '守将（镇守本城，不可出征）';
    return null;
  };
  /* 界面软提示（不硬拦）：他此刻其实不在城里 —— 置灰并写明，但不阻断既有玩法 */
  GAME.marchBusyOf = function (g) {
    if (!g) return null;
    var st = g.status || 'idle';
    if (st === 'march') return '行军中';
    if (st === 'gather') return '采集中';
    /* v89.140（老板 9）：把**已出征**的全部形态补齐 —— 此前漏了两种：
       · `garrison`（驻守野地）：英雄人在野地，若还能从城里再派一支，就"一个人在两处"；
       · `battle`（征战中）：主帅在战斗会话里，同上。
       补上后：出征面板的英雄下拉会把它们**列出来但置灰 + 写明状态**
       （老板要的"看得见"，同时不产生"一名英雄同时在两处"的数据错乱）。 */
    if (st === 'garrison') return '驻守野地';
    if (st === 'battle') return '征战中';
    return null;
  };
  /* 界面用：不可选的原因（硬拦优先） */
  GAME.marchIssueOf = function (g) { return GAME.marchBlockOf(g) || GAME.marchBusyOf(g); };
  GAME.canMarch = function (g) { return !GAME.marchIssueOf(g); };
  /* 可出征英雄（保持原顺序）—— 出征面板的缺省主将也从这里取 */
  GAME.expGeneralsOf = function () {
    return ((GAME.state && GAME.state.generals) || []).filter(function (g) { return GAME.canMarch(g); });
  };

  /* ============================================================
   * v89.129（老板：「任何野外目标（野地，城池，名城等）均应有英雄带领，
   *   根据等级配备相称资质和等级的英雄」）
   * ------------------------------------------------------------
   * 野外目标守将的**资质档位映射**（唯一出口）—— 三处共用：
   *   · GAME.wildDefenseAt（野地守将）：**进化体**（v89.185 老板：「其资质普遍设定为进化体」）
   *   · GAME.fortGuardOf（据点守将）：**觉醒体**（v89.185 老板：「据点则为觉醒体」）
   *   · GAME.recGenOf（出征面板"相称建议"）：同一张映射 —— 打谁，宜与谁同档。
   * v89.185 起资质**不再随等级抬档**（旧口径 Lv6+ 出天启体 —— 老板定调"普遍进化体"）；
   *   守将强度改由**等级**承担（见 DATA.WILD_GUARD_LV / FORT_GUARD_LV 与 GAME.guardFillOf）。
   * 以后调守将资质只改这里（界面建议自动跟）。
   * ============================================================ */
  GAME.guardRankIdxOf = function (kind, lv) {
    /* v89.185（老板 2）：资质定稿（lv 参数保留以兼容签名；强度不再经资质、改经等级） */
    var want = (kind === 'fort') ? 'ming' : 'ying';
    var idx = -1;
    (DATA.GEN_RANKS || []).forEach(function (r, i) { if (idx < 0 && r.id === want) idx = i; });
    return idx >= 0 ? idx : ((kind === 'fort') ? 3 : 2);
  };

  /* ============================================================
   * v89.185（老板 2 配套）：**守将成型（满状态）唯一出口**
   * ------------------------------------------------------------
   * 本轮取证发现（真缺陷）：`wildDefenseAt / fortGuardOf` 走 `makeGeneral` 生成守将，
   *   而 makeGeneral 的四维 = 资质区间随机（**不随等级**）、体力 = 初始 100
   *   （STA 上限虽随等级派生，但 staNow 停在 100 → hpMult 恒 ×1.089）——
   *   "等级 / 资质"在野地/据点守将身上**只是标签，不转战力**
   *   （对照：名城守将 npcCityGuard 走手写公式，四维/体力都随等级 —— 两套口径不一致）。
   * 本出口把守将补成与真实英雄同源的**全量形态**（三处守将共用同一把尺）：
   *   ① 四维 = 资质上界×特性权重 + (等级−1)×成长×特性权重×(5/Σ权重)
   *      （= v89.73 名城守将公式：自动加点 + 自由点都按特性投放）；
   *   ② 体力 = 满（setStaNow(staMax) —— 守将出战即满状态；与 v89.159"升级回满"同族）。
   * 以后调"守将强度"只改这里（野地 / 据点 / 名城三处生成全接）。
   * ============================================================ */
  GAME.guardFillOf = function (g, fold) {
    if (!g) return g;
    var rk = GAME.rankOf(g);
    var st = null;
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) st = x; });
    if (!st) st = (DATA.GEN_STYLES || [])[0] || { mul: { tong: 1, nz: 1, yw: 1, zm: 1 } };
    var m = st.mul;
    var mSum = (m.tong + m.nz + m.yw + m.zm) || 4;
    var f = 5 / mSum;
    /* v89.185：折损旋钮（传 fold 才生效；不传 = 满量，与原实现逐点等价）——
       wild/fort 传 DATA.GUARD_FOLD（半折）；npcCityGuard 不传（名城维持既有平衡）。 */
    var dimK = fold ? Math.max(0, Math.min(1, fold.dim == null ? 1 : fold.dim)) : 1;
    var staK = fold ? Math.max(0, Math.min(1, fold.staPct == null ? 1 : fold.staPct)) : 1;
    var dims = ['tong', 'yw', 'zm', 'nz'], up = Math.max(0, (g.level || 1) - 1);
    dims.forEach(function (d) {
      g[d] = Math.round(rk.base[1] * m[d] + up * (rk.grow || 1) * m[d] * f * dimK);
    });
    g.freePts = 0;
    /* v89.195（老板 3）：**攻防也"成型"** —— 旧出口只补四维与体力，攻防（全军加成的
       另一半来源，见 genAttrs 的 atkPct/defPct）遗漏，野地/据点守将恒为 base 10（+1%）。
       与四维同一把尺（同乘折损），但攻防是"全局加成"更敏感 —— 用**独立折损旋钮**
       fold.atkDim（默认 0.25 = dim 的一半）：探针（probe_v89195c）实测折 0.5 会把
       "据点 Lv10 可胜边界"从 1.4× 推到 1.5×；折 0.25 时边界与既有口径完全一致
       （1.4× 可胜），增量贡献 +3.7%~7.7% 全军攻击 —— "资质相称"可见、不破墙。
       ⚠️ 名城守将（不传 fold）**不补攻防** —— 维持 v89.73 起的既有平衡
       （其手写对象本就没有 attack/defense 字段，genAttrs 读作 0）。 */
    var _atkK195 = fold ? Math.max(0, Math.min(1, fold.atkDim == null ? 0.25 : fold.atkDim)) : 0;
    if (fold) {
      var _gb195g = DATA.GEN_BASE || { attack: 10, defense: 10 };
      g.attack = Math.round((_gb195g.attack || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
      g.defense = Math.round((_gb195g.defense || 10) + up * 0.4 * (rk.grow || 1) * _atkK195);
      /* ⚠️ atkAcc/defAcc 置 0 兼作"已处理"标记：守将（野地/据点）**不走** rankOf 的
         玩家侧欠账补发 —— 否则后续任何 rankOf 调用都会把守将攻防顶到满量标准线
         （折损 atkDim 被顶穿：实测 47 → 158）。0 折（回退档）时本段仍赋 base 10。 */
      g.atkAcc = 0; g.defAcc = 0;
    }
    if (GAME.setStaNow && GAME.staMax) {
      var mx = GAME.staMax(g);
      GAME.setStaNow(g, Math.round(100 + (mx - 100) * staK));
    }
    return g;
  };

  /* ============================================================
   * v89.186（老板 1）：**挂件体系（模块化）** —— 遗物是第一个挂件模块
   * ------------------------------------------------------------
   * 老板原话：「同步于装备的另一个增幅物品体系。设计嵌合体系，作为一个模块挂件
   * 加入到现有英雄体系中，既能加入，又能很方便拿走，还能后续参考开发类似功能模块。」
   * 形状（新增一个挂件模块 = 只在 data.js 加一张表 + 一批物品，玩法代码零改动）：
   *   · `g.attach = { <slotId>: <itemId> }`（随档序列化，天然可插拔）；
   *   · 加成汇总 attachBonusOf → genAttrs 与装备**同层相加**（公式只此一处）；
   *   · 装/卸走本出口（库存守恒：装 −1 / 卸 +1 / 更换 = 旧还新扣）。
   * ============================================================ */
  GAME.attachSlotOf = function (slotId) {
    var hit = null;
    (DATA.ATTACH_SLOTS || []).forEach(function (x) { if (x.id === slotId) hit = x; });
    return hit;
  };
  /* 当前挂件（物品对象；未挂 = null）—— 界面/加成/断言共读 */
  GAME.attachOf = function (g, slotId) {
    if (!g || !g.attach) return null;
    var id = g.attach[slotId];
    if (!id) return null;
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
    return it;
  };
  /* 挂件加成汇总（同 genEquipBonus 形状的**加数**；无挂件 = 全 0 对象）。
     genAttrs 直接与装备加成相加 —— 界面与战斗自动吃到（唯一出口）。 */
  GAME.attachBonusOf = function (g) {
    var out = { tong: 0, nz: 0, yw: 0, zm: 0, atk: 0, def: 0, spd: 0, sta: 0 };
    if (!g) return out;
    (DATA.ATTACH_SLOTS || []).forEach(function (slot) {
      var it = GAME.attachOf(g, slot.id);
      if (!it || !it.eff) return;
      Object.keys(out).forEach(function (k) { out[k] += (it.eff[k] || 0); });
    });
    return out;
  };
  /* 库存里可挂的（数量 > 0）—— 选择窗数据源 */
  GAME.attachPoolOf = function (slotId) {
    var slot = GAME.attachSlotOf(slotId);
    if (!slot) return [];
    var s = GAME.state, out = [];
    (DATA.ITEMS || []).forEach(function (x) {
      if (x.type !== slot.itemType) return;
      if ((((s || {}).items || {})[x.id] || 0) > 0) out.push(x);
    });
    return out;
  };
  /* 装上（含替换：旧件还库、新件扣库 —— 同一笔账；装同一件 = 幂等拒绝） */
  GAME.attachEquip = function (g, slotId, itemId) {
    var slot = GAME.attachSlotOf(slotId);
    if (!slot) return { ok: false, msg: '未知挂件槽位' };
    if (!g) return { ok: false, msg: '请选择英雄' };
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it || it.type !== slot.itemType) return { ok: false, msg: '该物不可作为' + slot.name };
    var s = GAME.state;
    g.attach = g.attach || {};
    if (g.attach[slotId] === itemId) return { ok: false, msg: '已佩此' + slot.name };
    var have = (s.items || {})[itemId] || 0;
    if (have <= 0) return { ok: false, msg: '库存中没有「' + it.name + '」' };
    var old = GAME.attachOf(g, slotId);
    s.items[itemId] = have - 1;                              /* 新件扣库 */
    if (old) s.items[old.id] = (s.items[old.id] || 0) + 1;   /* 旧件还库（替换守恒） */
    g.attach[slotId] = itemId;
    GAME.log('🔮 ' + g.name + ' 佩上「' + it.name + '」' + (old ? '（卸下「' + old.name + '」归库）' : ''), 'sys', 'staff');
    return { ok: true, msg: g.name + ' 佩上「' + it.name + '」' + (old ? '，' + old.name + ' 已归库' : '') };
  };
  /* 卸下（还库） */
  GAME.attachUnequip = function (g, slotId) {
    var slot = GAME.attachSlotOf(slotId);
    if (!slot) return { ok: false, msg: '未知挂件槽位' };
    if (!g) return { ok: false, msg: '请选择英雄' };
    var old = GAME.attachOf(g, slotId);
    if (!old) return { ok: false, msg: '未佩' + slot.name };
    var s = GAME.state;
    s.items[old.id] = (s.items[old.id] || 0) + 1;
    delete g.attach[slotId];
    GAME.log('🔮 ' + g.name + ' 卸下「' + old.name + '」（已归库）', 'sys', 'staff');
    return { ok: true, msg: g.name + ' 卸下「' + old.name + '」' };
  };
  /* 掉落（唯一出口）：打据点/名城缴获。档位随目标等级上抬、低档更常见。 */
  GAME.grantBaoDrop = function (t) {
    if (!t || !(DATA.BAOJU || []).length) return [];
    var D = DATA.BAOJU_DROP || {};
    var chance = (t.kind === 'fort') ? (D.chanceFort == null ? 0.55 : D.chanceFort)
      : (t.kind === 'city' ? (D.chanceCity == null ? 0.40 : D.chanceCity) : 0);
    if (chance <= 0 || Math.random() >= chance) return [];
    var lv = Math.max(1, t.lv || 1);
    var cap = Math.max(1, Math.min(4, Math.ceil(lv / (D.tierOfLv || 3))));
    var pool = DATA.BAOJU.filter(function (x) { return (x.tier || 1) <= cap; });
    if (!pool.length) return [];
    var W = D.weights || { 1: 4, 2: 3, 3: 2, 4: 1 };
    var tw = 0;
    pool.forEach(function (x) { tw += (W[x.tier] || 1); });
    var roll = Math.random() * tw, acc = 0, pick = pool[0];
    for (var i = 0; i < pool.length; i++) {
      acc += (W[pool[i].tier] || 1);
      if (roll < acc) { pick = pool[i]; break; }
    }
    var s = GAME.state;
    s.items[pick.id] = (s.items[pick.id] || 0) + 1;
    GAME.log('🔮 缴获遗物：「' + pick.name + '」（可佩于英雄身上）', 'war');
    return [pick];
  };
  /* ============================================================
   * v89.187（老板 1）：遗物**品质**与**合成**出口（唯一来源）
   *   · baojuQOf(it)       —— 品质（低/中/高 · 按 tier 归并，见 DATA.BAOJU_Q）；
   *   · baojuCountQOf(q)   —— 库存里该品质的件数与逐件明细（界面前端用）；
   *   · baojuFuse(q)       —— 执行合成：**2 件 → 1 件高一档**（老板口径）。
   * 守恒铁律：消耗 need 件、产出 1 件（总量 -1，品质 +1 档）；
   * 消耗顺序：同品质内 **tier 低优先、再按定义序**（玩家直觉"先耗凡人"）；
   * 目标 **高** 为顶阶（DATA.BAOJU_FUSE.up 里没有 high → 拒绝，不静默）。
   * ============================================================ */
  GAME.baojuQOf = function (it) {
    if (!it || !it.tier) return null;
    var hit = null;
    (Object.keys(DATA.BAOJU_Q || {})).forEach(function (k) {
      if (!hit && ((DATA.BAOJU_Q[k].tiers || []).indexOf(it.tier) >= 0)) hit = k;
    });
    return hit;
  };
  GAME.baojuCountQOf = function (q) {
    var s = GAME.state, n = 0, byId = {};
    (DATA.ITEMS || []).forEach(function (x) {
      if (x.type !== 'bao' || GAME.baojuQOf(x) !== q) return;
      var c = (((s || {}).items || {})[x.id] || 0);
      if (c > 0) { n += c; byId[x.id] = c; }
    });
    return { n: n, byId: byId };
  };
  GAME.baojuFuse = function (q) {
    var s = GAME.state;
    var F = DATA.BAOJU_FUSE || { need: 2, up: { low: 'mid', mid: 'high' } };
    var to = (F.up || {})[q];
    if (!to) return { ok: false, msg: q === 'high' ? '「高」为顶阶遗物，不可再合' : '该品质不可合成' };
    var need = F.need || 2;
    var cnt = GAME.baojuCountQOf(q);
    if (cnt.n < need) {
      var SRC = DATA.BAOJU_Q[q], DST = DATA.BAOJU_Q[to];
      return { ok: false, msg: '需 ' + need + ' 件「' + SRC.name + '」阶遗物（现有 ' + cnt.n + ' 件）→ 合 1 件「' + DST.name + '」阶' };
    }
    /* 消耗清单：tier 低优先、再按 DATA.BAOJU 定义序 */
    var pool = [];
    (DATA.BAOJU || []).forEach(function (b) {
      var c = cnt.byId[b.id] || 0;
      for (var i = 0; i < c; i++) pool.push(b);
    });
    pool.sort(function (a, b) { return (a.tier || 0) - (b.tier || 0); });
    var used = pool.slice(0, need);
    used.forEach(function (b) {
      s.items[b.id] = (s.items[b.id] || 0) - 1;
      if (s.items[b.id] <= 0) delete s.items[b.id];
    });
    /* 产出：目标品质随机一件 */
    var dstPool = (DATA.BAOJU || []).filter(function (b) { return GAME.baojuQOf(b) === to; });
    var got = dstPool[Math.floor(Math.random() * dstPool.length)];
    s.items[got.id] = (s.items[got.id] || 0) + 1;
    var usedNames = used.map(function (b) { return b.name; }).join(' + ');
    GAME.log('⚗️ 遗物合成：' + usedNames + ' → 「' + got.name + '」（' + DATA.BAOJU_Q[to].name + '阶）', 'sys', 'staff');
    return { ok: true, got: got, used: used, to: to,
      msg: '合成成功：' + usedNames + ' → 「' + got.name + '」' };
  };

  /* ============================================================
   * v89.129：**"相称"尺子**（唯一出口）—— 出征某目标"宜派"什么资质/等级的英雄。
   * ------------------------------------------------------------
   * 纯按**公开信息**（目标类型 + 等级）给建议，不含守将实情
   * （守将强弱请去侦查 —— v89.64「不然还要侦察何用」；**软提示、非门槛**）。
   * 规则 = 与守将生成同尺（打谁，宜与谁同档）：
   *   · 野地：资质 = guardRankIdxOf('wild', lv)（与 wildDefenseAt 同源）、
   *     等级 ≥ DATA.WILD_GUARD_LV 下限（v89.185：base + (lv−1)×perLv —— 与守将生成同尺）；
   *   · 据点：资质 = guardRankIdxOf('fort', lv)（与 fortGuardOf 同源）、
   *     等级 ≥ DATA.FORT_GUARD_LV 下限（v89.185：base + (lv−1)×perLv）；
   *   · 城池/名城：资质天启体、等级 ≥ NPC_GUARD_LV[type] 下限
   *     （与 npcCityGuard 同档 —— v89.64「英雄默认资质为天启体，等级根据城池级别设定范围」）。
   * 返回 { rankId, rankName, lv, text }；调兵（owncity）无建议 → null。
   * 等级建议与守将公式"下限同尺"由 smoke §112② 逐档交叉核对（防两处漂移）。
   * ============================================================ */
  GAME.recGenOf = function (t) {
    if (!t || !t.ok) return null;
    var rankIdx = null, lvMin = 0;
    if (t.kind === 'wild') {
      rankIdx = GAME.guardRankIdxOf('wild', t.lv || 0);
      /* v89.185：与守将生成同尺（DATA.WILD_GUARD_LV 的下限 = base + (lv−1)×perLv） */
      var _wg185 = DATA.WILD_GUARD_LV || { base: 30, perLv: 10 };
      lvMin = _wg185.base + Math.max(0, (t.lv || 0) - 1) * _wg185.perLv;
    } else if (t.kind === 'fort') {
      rankIdx = GAME.guardRankIdxOf('fort', t.lv || 1);
      /* v89.185：与守将生成同尺（DATA.FORT_GUARD_LV） */
      var _fg185 = DATA.FORT_GUARD_LV || { base: 60, perLv: 10 };
      lvMin = _fg185.base + Math.max(0, (t.lv || 1) - 1) * _fg185.perLv;
    } else if (t.kind === 'city') {
      rankIdx = DATA.GEN_RANKS.length - 1;           /* 天启体（同 npcCityGuard） */
      var rg = (DATA.NPC_GUARD_LV && DATA.NPC_GUARD_LV[t.cityType]) || [60, 100];
      lvMin = rg[0];
    } else {
      return null;                                    /* owncity 等：无建议 */
    }
    var rk = DATA.GEN_RANKS[rankIdx];
    return { rankId: rk.id, rankName: rk.name, lv: lvMin, text: rk.name + ' Lv' + lvMin + '+' };
  };

  GAME.assignGeneral = function (genId, role, cityId) {
    var s = GAME.state, g = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) g = s.generals[i];
    if (!g) return { ok: false, msg: '英雄不存在' };
    var cityArg = cityId || (GAME.currentCity() || {}).id || null;
    if (role !== 'guard' && role !== 'mayor') {
      g.status = role; g.cityId = cityArg;
      return { ok: true, msg: '解除任命 ' + g.name };
    }
    /* v89.113（老板需求 3）：城主与守将同级分职 —— 两条任命走同构路径：
       同城旧任自动让位；一个人只能一职（status 单值），换职即自动卸旧职。 */
    /* v89.135：在外执行任务的英雄不可任命（出征 / 采集 / 驻守野地）——
       防"驻守野地的将"被任命成守将后，野地 garrison.genId 悬空（界面显示"将已不在"）。 */
    if (g.status === 'march') return { ok: false, msg: g.name + ' 正在出征，不可任命' };
    if (g.status === 'gather') return { ok: false, msg: g.name + ' 正在采集（撤回采集队后再任命）' };
    if (g.status === 'garrison') return { ok: false, msg: g.name + ' 正在驻守野地（召回驻军后再任命）' };
    var _roleName = (role === 'mayor') ? '城主' : '守将';
    var out = (role === 'mayor') ? GAME.releaseMayorsOf(cityArg, g.id) : GAME.releaseGuardsOf(cityArg, g.id);
    g.status = role; g.cityId = cityArg;
    var cn = (GAME.cityById(cityArg) || {}).name;
    return { ok: true, msg: '任命 ' + g.name + (cn ? ' 为「' + cn + '」' : ' 为') + _roleName +
      (out.length ? '　（已自动解除 ' + out.join('、') + '）' : '') };
  };

  /* 英雄真实属性（含装备/丹药/符） */
  /* ============================================================
   * v52（老板给定）→ v89.96（老板批注「不要乱定系数」）改定：
   *   英雄属性 → 军队加成的换算链
   * ------------------------------------------------------------
   *   「攻击值」概念保留（展示用）：1 武力 = 10 攻击值、1 谋略 = 10 防御值
   *   「全军百分比」走**双刻度**（各有依据，不是拍脑袋）：
   *     · 武力/谋略 是**无上限成长**的属性（天启体 Lv240 武力 5869）——
   *       旧口径 yw/100（每点 +1%）在此尺度下 ×59.7，一击清场；
   *       新口径 yw×0.0005（**每 20 点 +1%**）→ 顶配 ×3.93 / 进化体 Lv60 ×1.30
   *       （标定：probe_v8996_dmgchain 实测"带将均势对局 8~16 回合"）。
   *     · 装备攻/防值**有天花板**（12 槽），保留 v52 口径：每 10 攻击值 +1%。
   *   换算原子**只有一份**（atkPctOf / defPctOf）——UI 展示（ui.genPane 的
   *   "全军攻击 +X%"）、战报结算（battle.calcDamage）与战斗引擎
   *   （tactic.perAtk/perDef）全部读它。v89.96 并链前，tactic 把装备当
   *   "绝对值加法"另算一份（与展示相差 4 倍）——属"显示与实战分离"，已修。
   * ============================================================ */
  GAME.ATK_PER_YW = 10;      /* 1 武力 → 10 攻击值（展示口径，v52 保留） */
  GAME.DEF_PER_ZM = 10;      /* 1 谋略 → 10 防御值（展示口径，v52 保留） */
  GAME.PCT_PER_ATK = 10;     /* 装备：每 10 攻击值 → 全军攻击 +1%（v52 保留） */
  GAME.PCT_PER_DEF = 10;     /* 装备：每 10 防御值 → 全军防御 +1%（v52 保留） */
  GAME.YW_PCT = 0.0005;      /* 武力：每点 → 全军攻击 +0.05%（每 20 点 +1%；v89.96 标定） */
  GAME.ZM_PCT = 0.0005;      /* 谋略：每点 → 全军防御 +0.05%（v89.96 标定） */

  /* 换算原子 —— **公式只有这一份**。
     ⚠️ 上一版写成 `GAME.genAtkVal(g)=genAttrs(g).atkVal` 这种"出口包装"，
     结果 audit 直接报「GAME.genDefVal 无任何引用」：包装层没有消费点，就是死代码。
     改成"原子公式 + genAttrs 内部调用"，既保住单一来源、又不留没人用的壳。 */
  GAME.atkValOf = function (yw, atkEq) { return (yw || 0) * GAME.ATK_PER_YW + (atkEq || 0); };
  GAME.defValOf = function (zm, defEq) { return (zm || 0) * GAME.DEF_PER_ZM + (defEq || 0); };
  GAME.pctOfVal = function (val, per) { return (val || 0) / (per || 1) / 100; };
  /* 全军攻/防百分比 —— **唯一换算原子**（双刻度口径见上方注释块）。
     装备部分复用 pctOfVal（v52 的 /10/100），武力部分走 YW_PCT —— 两条腿各有依据。 */
  GAME.atkPctOf = function (yw, eqAtk) { return (yw || 0) * GAME.YW_PCT + GAME.pctOfVal(eqAtk, GAME.PCT_PER_ATK); };
  GAME.defPctOf = function (zm, eqDef) { return (zm || 0) * GAME.ZM_PCT + GAME.pctOfVal(eqDef, GAME.PCT_PER_DEF); };

  GAME.genAttrs = function (g) {
    var b = GAME.systems.genEquipBonus(g);
    /* v89.186（老板 1）：挂件体系（遗物=第一个模块）——与装备**同层相加**
       （attachBonusOf 返回同形加数；公式只此一处，界面/战斗/悬停自动同源）。 */
    if (GAME.attachBonusOf) {
      var bAt = GAME.attachBonusOf(g);
      b.tong += bAt.tong; b.nz += bAt.nz; b.yw += bAt.yw; b.zm += bAt.zm;
      b.atk += bAt.atk; b.def += bAt.def; b.spd += bAt.spd; b.sta += bAt.sta;
    }
    /* v26（需求 2）：**丹药不再单独一列，也不再重复累加**。
       永久丹药在使用时已经写进 g[attr]（systems.useItem 里 `g5[attr] += 1`），
       所以 g[attr] 本身就是"已经嗑过药的基础值"；这里再加一次 perm 会变成双倍。
       perm 只留作「每将上限 50」的计数用，不参与属性求和。
       五维（指挥/武力/谋略/治理/速度）在这里一次性求和：基础 + 装备 + 战斗符。 */
    /* v65（老板）：「英雄/装备属性数值应只为整数」——
       装备与套装里有 .5 的加成（打造品质、套装档位都是半数），
       原先一路带小数进界面（统2751.5 那种），既占宽度又不好读。
       **在这里一次性取整**（唯一出口），下游任何地方都不再各 round 一遍。 */
    var a = {
      tong: Math.round((g.tong || 0) + b.tong),
      nz: Math.round((g.nz || 0) + b.nz),
      yw: Math.round((g.yw || 0) + b.yw),
      zm: Math.round((g.zm || 0) + b.zm),
      /* 速度 = 出身脚力 + 等级成长 + 装备/套装/座驾 + 自由点（全部相加，不做乘算）。
         等级成长直接**派生**而不写进 g.speed：这样老存档不用迁移也能立刻对上，
         也不会出现"升级时加一次、求和时又加一次"的双重计数。
         v74：自由点投放的 spdAdd 也走这条和（与装备同层，但来源清楚）。 */
      /* v89.95（B2）：等级成长改 **每 SPD_CAP.perLevels 级 +1**（原来是每级 +1）。
         仍是**派生**（不写进 g.speed）→ 老档不迁移也立刻对上；自由点 spdAdd 照旧相加。 */
      spd: Math.round((g.speed || 0)
        + Math.floor(Math.max(0, (g.level || 1) - 1) / (((DATA.SPD_CAP || {}).perLevels || 5)))
        + b.spd + (g.spdAdd || 0)),
      /* 装备/套装的攻防（单独留一份：UI 的"装备贡献"与旧存档兼容都要它） */
      atkEq: Math.round(b.atk),
      defEq: Math.round(b.def),
      /* v29（需求 11）：**体力升为第六维**。
         v66：装备体力并入上限后，这里给出三个口径，**界面只读它们**：
           sta    = 当前体力（战斗取值，含装备贡献）
           staMax = 上限（等级/资质/治理 + 装备与套装的体力）
           staEq  = 装备贡献了多少体力（"装备提供"清单用）
         ⚠️ `a.hp`（生命值）在 v66 已删：那个字段原本就是装备体力折算出来的
            第二套说法，现在只走"装备体力 → 体力上限"一条链。 */
      sta: Math.round(GAME.staNow(g)),
      staMax: Math.round(GAME.staMax(g)),
      staEq: Math.round(b.sta || 0),
    };
    a.atk = Math.round((g.attack || 0) + b.atk);
    a.def = Math.round((g.defense || 0) + b.def);
    /* 符类 buff（v89.93 整改 W2：**同属性只取最强**，不再逐条叠乘）
       ------------------------------------------------------------
       改前每条符各自乘一次：治粟(+100%)×安民(+75%)×玄德(+50%)×文曲星(+25%)
       = ×6.5625（实测守卫 nz 945 → 6,203）；而军事符/生产符都是"取最大值"口径。
       现在统一：同属性取最大加成，一次施加（不同属性仍可并行，如指挥符 + 治理符）。 */
    var s = GAME.state;
    if (s.buffs && s.buffs.gens && s.buffs.gens[g.id]) {
      var nowMs = U.now();
      var mx = { tong: 0, nz: 0, yw: 0, zm: 0, spd: 0 };
      for (var bid in s.buffs.gens[g.id]) {
        var buf = s.buffs.gens[g.id][bid];
        if (!(buf.until > nowMs)) continue;
        if (buf.tong_mult > mx.tong) mx.tong = buf.tong_mult;
        if (buf.nz_mult > mx.nz) mx.nz = buf.nz_mult;
        if (buf.yw_mult > mx.yw) mx.yw = buf.yw_mult;
        if (buf.zm_mult > mx.zm) mx.zm = buf.zm_mult;
        if (buf.spd > mx.spd) mx.spd = buf.spd;
      }
      if (mx.tong) a.tong = Math.round(a.tong * (1 + mx.tong));
      if (mx.nz) a.nz = Math.round(a.nz * (1 + mx.nz));
      if (mx.yw) a.yw = Math.round(a.yw * (1 + mx.yw));
      if (mx.zm) a.zm = Math.round(a.zm * (1 + mx.zm));
      if (mx.spd) a.spd += mx.spd;
    }
    /* v77 · 战技（DATA.NEIGONG）：每重 +per 到对应维（与装备/丹药同层求和）。
       修习/精进走 systems.useItem → S._neigongUse；这里只管把加成算进去。 */
    if (g.ng && g.ng.id) {
      var ngD = null;
      (DATA.NEIGONG || []).forEach(function (x) { if (x.id === g.ng.id) ngD = x; });
      if (ngD && ngD.attr && a[ngD.attr] != null) a[ngD.attr] += (ngD.per || 0) * (g.ng.lv || 0);
    }

    /* ---------- v52 派生：攻防值 → 全军加成 ----------
       **必须在 buff 之后算**（战斗芯片改的是 a.yw，派生要吃到它）。
       公式走上面那三个原子（唯一来源），一次算完、多处读
       （battle / UI 都读这几个字段），避免"每处各算一遍、某处漏了装备"。 */
    a.atkVal = GAME.atkValOf(a.yw, a.atk);                 /* 英雄攻击值（展示） */
    a.defVal = GAME.defValOf(a.zm, a.def);                 /* 英雄防御值（展示） */
    a.atkPct = GAME.atkPctOf(a.yw, a.atk);                 /* 全军攻击加成（唯一原子；v89.96 双刻度） */
    a.defPct = GAME.defPctOf(a.zm, a.def);                 /* 全军防御加成（同上） */
    return a;
  };

  /* 升级所需经验（唯一口径）。
     v26（需求 1）：原先 battle.js / ui.js 各写了一遍 `g.level*g.level*100`，
     一旦要改公式就得同时改三处 —— 收敛到这里，其余地方一律调用。
     v89.82（老板澄清）：「**239 升 240 需要 100 万**，而不是 1 级升到 240 需要 100 万」
     —— 锚点钉在 need(240)，此后不再动。
     v89.170（老板：「前期所需经验太低…曲线应该上抬一点，比直接线性低」）：
     **单段幂律**（无分段、无接缝，顺带修掉 v89.168 曲线图体检暴露的 Lv30→31 折角）：
       need(lv) = needTop × (lv / topLv)^alpha      alpha=1.25
     —— 前期上抬、全程低于"起点→锚点"的直线；形状与理由见 DATA.EXP_CURVE 的注释。 */
  GAME.expNeedOf = function (g) {
    var lv = Math.max(1, (g && g.level) || 1);
    var C = DATA.EXP_CURVE;
    return Math.round(C.needTop * Math.pow(lv / C.topLv, C.alpha));
  };
  /* v89.43：**老存档经验截断** —— 旧曲线下 Lv30 的将身上可能压着 9 万经验，
     而新曲线 Lv30 只需 490；若不处理，读档后 checkLevelUp 会一路连升到资质上限
     （等于白送几十级）。这里把超出"本级所需"的部分截掉 —— 老将停在"差一点升级"，
     既不回退等级，也不白送。新档（exp=0）不受影响。 */
  GAME.migrateExpScale = function (st) {
    var gs = ((st || GAME.state) && (st.generals || GAME.state.generals)) || [];
    var n = 0;
    for (var i = 0; i < gs.length; i++) {
      var g = gs[i];
      if (!g || g.exp == null) continue;
      var need = GAME.expNeedOf(g);
      if (g.exp > need) { g.exp = need; n++; }
    }
    return n;
  };

  /* ---------- 等级上限 & 体力（v29 · 需求 2 / 11） ---------- */
  /* ============================================================
   * 君主：练功 / 突破（v89.65）—— 考据与取舍见 data.js 的 DATA.LORD_BREAK
   * ------------------------------------------------------------
   * 三个读出口（breaks / 段顶 / 突破所需修为 / 境界名）+ 两个写出口（练功 / 突破）。
   * 界面只读这些出口，不自己推公式。
   * ============================================================ */
  GAME.lordBreaksOf = function (g) { return Math.max(0, Math.round((g && g.breaks) || 0)); };
  /* 当前段的等级上限 = 60 ×（已突破次数 + 1）—— genLevelCap 内部调它 */
  GAME.lordStageCap = function (g) {
    return DATA.LORD_BREAK.step * (1 + GAME.lordBreaksOf(g));
  };
  /* 下一次突破所需修为；null = 已至顶（天启体 240 之上无更上层） */
  GAME.lordCultivNeed = function (g) {
    var B = DATA.LORD_BREAK, n = GAME.lordBreaksOf(g);
    return (n < B.needs.length - 1) ? B.needs[n + 1] : null;
  };
  GAME.lordRealmOf = function (g) {
    var B = DATA.LORD_BREAK, n = GAME.lordBreaksOf(g);
    return B.realms[Math.min(n, B.realms.length - 1)];
  };
  /* 练功一次：扣体力 + 粮 → 产修为（常产）+ 经验（未到段顶才给） */
  GAME.doLordTrain = function () {
    var g = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null;
    if (!g) return { ok: false, msg: '君主不在帐下' };
    var B = DATA.LORD_BREAK, city = GAME.currentCity();
    if (!city) return { ok: false, msg: '无城池可供练功' };
    var cap = GAME.genLevelCap(g);
    if (GAME.staNow(g) < B.trainSta) {
      return { ok: false, msg: g.name + ' 体力不足（需 ' + B.trainSta + '，现 '
        + Math.round(GAME.staNow(g)) + '），静待恢复' };
    }
    var need0 = GAME.expNeedOf(g);
    var grain = Math.max(1, Math.round(need0 * B.trainGrainPct));
    city.res = city.res || {};
    if ((city.res.grain || 0) < grain) {
      return { ok: false, msg: '净水不足（需 ' + U.fmt(grain) + '，府库 ' + U.fmt(city.res.grain || 0) + '）' };
    }
    city.res.grain -= grain;
    GAME.setStaNow(g, GAME.staNow(g) - B.trainSta);          /* v66：体力唯一写入口 */
    var gain = Math.round(B.cultivBase + (g.level || 1) * B.cultivPerLv);
    g.cultiv = (g.cultiv || 0) + gain;
    var tail;
    if ((g.level || 1) < cap) {
      var rr = GAME.battle.gainExp(g, need0 * B.expPct, '练功');   /* v26：经验唯一入口 */
      tail = (rr && rr.up > 0) ? '　⭐ 连升 ' + rr.up + ' 级 → Lv' + g.level
        : '　经验 +' + U.fmt(need0 * B.expPct);
    } else {
      tail = '　（已在本段顶 Lv' + cap + '，经验不再累积）';
    }
    GAME.log('🧘 ' + g.name + ' 练功：修为 +' + gain + '（现 ' + g.cultiv + '）' + tail, 'sys', 'staff');
    return { ok: true, gain: gain, cultiv: g.cultiv,
      msg: '练功完成：修为 +' + gain + '（现 ' + g.cultiv + '）' + tail };
  };
  /* ============================================================
   * v89.83（老板「再加入其他自动化选项」）：自动练功 —— 君主体力过半时自动练一次
   * ------------------------------------------------------------
   * 为什么必须有**节流**与**过半门槛**（两个都不能省）：
   *   练功一次扣体力 6，若主循环每帧都试，一秒内就能把池子掏空；
   *   而君主的体力也是**出征/演武**的本钱 —— 自动化的底线是"不抢玩家的手段"，
   *   所以只在体力过半时才练（剩下的留给玩家自己安排）。
   * 判定与执行全部复用既有出口（staNow / doLordTrain），不新造第二套规则。
   * ============================================================ */
  GAME.AUTO_LORD_MIN_MS = 30000;                 /* 每 30 秒现实时间最多练一次 */
  /* ============================================================
   * v89.115（老板「自动菜单增加一个自动治疗伤兵」）：**自动治疗伤兵**
   * ------------------------------------------------------------
   * 口径（与自动练功/升级同一套写法）：
   *   · 伤兵营有伤兵、旧币够治疗费 → 立即治完全部（走既有 `battle.heal` 出口）；
   *   · 旧币不足 → **暂停但不关开关**，金恢复后自动继续；
   *   · 节流：15 **现实秒**最多尝试一次（治不了时不至于每 tick 空转）；
   *   · 状态：`s.autoHealState = { msg, at }`（at 同时充当节流时间戳）。
   * ============================================================ */
  GAME.AUTO_HEAL_GAP_MS = 15000;
  GAME.autoHeal = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoHeal) return null;
    var last = (s.autoHealState && s.autoHealState.at) || 0;
    if (U.now() - last < GAME.AUTO_HEAL_GAP_MS) return null;      /* 节流：15 现实秒 */
    var n = s.wounded || 0;
    if (n <= 0) {
      s.autoHealState = { msg: '无伤兵，待命', at: U.now() };
      return null;
    }
    /* 够不够金由 heal 自己判（同一出口，不在这里复算一份） */
    var r = GAME.battle.heal();
    s.autoHealState = {
      msg: r.ok ? (r.msg + ' · 自动') : ('暂停：' + r.msg + '（金恢复后自动继续）'),
      at: U.now(),
      /* v89.116（老板「自动治疗下放一个触发记录，如果进行了自动治疗，显示具体兵种及数量」）
         —— 明细直接读 heal 的返回值（逐兵种），界面按它列清单。 */
      detail: r.ok ? { back: r.back || 0, backBy: r.backBy || {}, gold: r.gold || 0,
        city: r.city || '' } : null,
    };
    if (r.ok) {
      s.autoHealLog = (s.autoHealLog || []);
      s.autoHealLog.unshift({ t: U.now(), n: r.back || 0, by: r.backBy || {}, gold: r.gold || 0,
        city: r.city || '' });
      while (s.autoHealLog.length > (DATA.AUTO_HEAL_LOG_MAX || 8)) s.autoHealLog.pop();
    }
    return r;
  };
  GAME.autoLordTrain = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoLordTrain) return null;
    var g = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null;
    if (!g) return null;
    var now = U.now();
    if (now - (s.lordTrainAt || 0) < GAME.AUTO_LORD_MIN_MS) return null;
    var at = GAME.genAttrs ? GAME.genAttrs(g) : null;
    var max = (at && at.staMax) || 100;
    var cur = GAME.staNow(g);
    if (cur < max * 0.5) {
      s.autoLordState = { ok: false, paused: true,
        msg: '体力 ' + Math.round(cur) + '/' + Math.round(max) + '（过半才自动练功）', at: now };
      return null;
    }
    s.lordTrainAt = now;
    var r = GAME.doLordTrain();
    s.autoLordState = { ok: r.ok, msg: r.msg, at: now };
    return r;
  };
  /* 突破：须在段顶且修为够 → 上限 +60、境界进一阶、发自由点 */
  GAME.doLordBreak = function () {
    var g = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null;
    if (!g) return { ok: false, msg: '君主不在帐下' };
    var B = DATA.LORD_BREAK, cap = GAME.genLevelCap(g), need = GAME.lordCultivNeed(g);
    if (need == null) {
      return { ok: false, msg: '已至「' + GAME.lordRealmOf(g) + '」，天启体之上再无更高境界' };
    }
    if ((g.level || 1) < cap) {
      return { ok: false, msg: '须先练至本段顶 Lv' + cap + '（现 Lv' + g.level + '）方可突破' };
    }
    var cur = g.cultiv || 0;
    if (cur < need) {
      return { ok: false, msg: '修为不足（需 ' + need + '，现 ' + cur + '），继续练功' };
    }
    /* v89.177（老板「君主的突破要求更高……综合考验」）：修为之外，还须过
       "政/城/军/资/宝"五关（DATA.LORD_BREAK.trials）——缺哪关提示哪关。 */
    var _trial = GAME.lordTrialOf(g);
    if (_trial && !_trial.ok) {
      var miss = _trial.rows.filter(function (r2) { return !r2.ok; })
        .map(function (r2) { return r2.label + '（' + U.fmt(r2.cur) + '/' + U.fmt(r2.goal) + '）'; });
      return { ok: false, msg: '综合考验未过：' + miss.join('、') + ' —— 详见君主面板' };
    }
    g.cultiv = cur - need;
    g.breaks = GAME.lordBreaksOf(g) + 1;
    var fp = B.freePts[Math.min(g.breaks, B.freePts.length - 1)] || 0;
    if (fp) g.freePts = (g.freePts || 0) + fp;
    var nCap = GAME.genLevelCap(g);
    GAME.log('⚡ ' + g.name + ' 突破成功 → 境界「' + GAME.lordRealmOf(g) + '」，等级上限 Lv'
      + cap + ' → Lv' + nCap + (fp ? '，自由点 +' + fp : ''), 'sys', 'staff');
    return { ok: true, realm: GAME.lordRealmOf(g), cap: nCap, freePts: fp,
      msg: '突破成功！境界「' + GAME.lordRealmOf(g) + '」，上限升至 Lv' + nCap
        + (fp ? '，自由点 +' + fp : '') };
  };
  /* ============================================================
   * v89.177（老板「政务厅界面增加鼓舞民心，消减民怨的措施各 1 个」）：
   * **两个安抚措施**（各每日一次 · 耗旧币 · 走 heartsComfortAdd 唯一入口）。
   *   · 鼓舞民心：轻（DATA.HEARTS.boost）
   *   · 消减民怨：重（DATA.HEARTS.soothe）—— 民怨=100−民心，抬民心即消民怨
   * 冷却按**游戏日**（questDayIndex）；花费从玩家金池（唯一货币）。
   * ============================================================ */
  GAME.heartsActionOf = function (id) {
    var HF = DATA.HEARTS || {};
    var cfg = (id === 'soothe') ? HF.soothe : (id === 'boost' ? HF.boost : null);
    if (!cfg) return null;
    var s = GAME.state;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    var usedDay = ((s.heartsDays || {})[id]);
    return { id: id, name: (id === 'soothe') ? '消减民怨' : '鼓舞民心',
      cost: cfg.cost || 0, add: cfg.add || 0, day: day, ready: usedDay !== day };
  };
  GAME.doHeartsAction = function (id) {
    var cfg = GAME.heartsActionOf(id);
    if (!cfg) return { ok: false, msg: '未知措施' };
    if (!cfg.ready) return { ok: false, msg: cfg.name + '本日已行（每日一次，明日再来）' };
    if (GAME.goldOf() < cfg.cost) {
      return { ok: false, msg: '旧币不足（需 ' + U.fmt(cfg.cost) + '，现有 ' + U.fmt(GAME.goldOf()) + '）' };
    }
    GAME.goldAdd(-cfg.cost);
    GAME.heartsComfortAdd(cfg.add);
    var s = GAME.state;
    s.heartsDays = s.heartsDays || {};
    s.heartsDays[id] = cfg.day;
    GAME.log('🕊️ ' + cfg.name + '（-' + U.fmt(cfg.cost) + ' 金）：民心 '
      + Math.round(GAME.heartsOf()) + ' / 民怨 ' + Math.round(GAME.minyuanOf()));
    return { ok: true, msg: cfg.name + '：民心 ' + Math.round(GAME.heartsOf())
      + ' / 民怨 ' + Math.round(GAME.minyuanOf()) };
  };
  /* ============================================================
   * v89.177（老板「君主的突破要求更高……综合考验」）：**综合考验唯一出口** ——
   * 返回 { n, rows:[{key,label,cur,goal,ok}], ok }；null = 未配该项（视为无考验）。
   * 五关口径见 DATA.LORD_BREAK.trials 注释（政/城/军/资/宝）。
   * ============================================================ */
  GAME.lordTrialOf = function (g) {
    var B = DATA.LORD_BREAK, n = GAME.lordBreaksOf(g) + 1;   /* 第 n 次突破 */
    var tr = (B.trials || [])[n - 1];
    if (!tr) return null;
    var s = GAME.state;
    var doneQ = Object.keys((s.quests && s.quests.done) || {}).length;
    var cities = (s.cities || []).length;
    var army = 0;
    (s.cities || []).forEach(function (c) { army += (GAME.armyTotal ? GAME.armyTotal(c) : 0); });
    var gold = GAME.goldOf();
    var jewelIds = {};
    (DATA.ITEMS || []).forEach(function (it) { if (it.type === 'jewel') jewelIds[it.id] = true; });
    var jk = 0;
    Object.keys(s.items || {}).forEach(function (k2) {
      if (jewelIds[k2] && (s.items[k2] || 0) > 0) jk++;
    });
    var rows = [
      { key: 'quests', label: '政务（任务）', cur: doneQ, goal: tr.quests, ok: doneQ >= tr.quests },
      { key: 'cities', label: '城池', cur: cities, goal: tr.cities, ok: cities >= tr.cities },
      { key: 'army', label: '军队（兵力）', cur: army, goal: tr.army, ok: army >= tr.army },
      { key: 'gold', label: '资源（持金）', cur: gold, goal: tr.gold, ok: gold >= tr.gold },
      { key: 'treasure', label: '宝物（珠宝）', cur: jk, goal: tr.treasure, ok: jk >= tr.treasure },
    ];
    return { n: n, rows: rows, ok: rows.every(function (r2) { return r2.ok; }) };
  };
  GAME.genLevelCap = function (g) {
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    var cap = (rk && rk.lvCap) || (DATA.GEN_RANKS[0] && DATA.GEN_RANKS[0].lvCap) || 60;
    /* v89.65：君主的上限被切成段（练功→突破续升）—— 这里收口，
       升级判定 / 经验道具 / 详情页 / 君主面板全都不必再判一次 */
    if (g && g.isLord) cap = Math.min(cap, GAME.lordStageCap(g));
    return cap;
  };
  /* 经验道具能不能用（唯一出口）→ 返回 '' 表示可以用，否则返回给玩家看的原因。
     v66（老板）：「英雄等级到上限后不能再使用经验道具」。
     改前 checkLevelUp 里是 `gen.level < capLv` 才升级 —— 到顶后经验照样堆、
     道具照样扣，属于"烧掉了没反应"。现在三处消费点（单个使用 / 批量使用 / 界面）
     一律先问这里。 */
  GAME.expBlockOf = function (g) {
    if (!g) return '请先选择英雄';
    var cap = GAME.genLevelCap(g);
    if ((g.level || 1) < cap) return '';
    /* v89.65：君主的"上限"是**分段**的（练功→突破续升），不是资质顶 ——
       若沿用下面那句"资质决定等级上限"，玩家会以为已经练到头了，
       实际上该去突破。同一件事的两处文案必须与真实原因一致。 */
    if (g.isLord) {
      return g.name + ' 已达本段上限 Lv' + cap + '（君主每 '
        + DATA.LORD_BREAK.step + ' 级一段）—— 须在君主面板「练功」攒够修为后「突破」方可续升'
        + (GAME.lordCultivNeed(g) == null ? '；已至天启体上限，无更高境界' : '');
    }
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    return g.name + ' 已达' + ((rk && rk.name) || '') + '上限 Lv' + cap
      + '，无法再使用经验道具（资质决定等级上限）';
  };
  GAME.expBlocked = function (g) { return !!GAME.expBlockOf(g); };
  /* ============================================================
   * 经验道具闸门（v66 立 · v89.173 收口）
   * ------------------------------------------------------------
   * **唯一出口** GAME.expItemGrantOf：界面（选择窗）与两个消费点
   * （单个使用 / 批量使用）一律走它 ——「界面与执行同一把尺」是铁律。
   *   · v89.171 曾按 capLv（培养上限 10~60）「到线即止」；
   *   · v89.173（老板拍板：「不作等级限制」）—— capLv 上限闸与额度折算
   *     **整条退役**（`expItemCapOf` 一并删除）：任何等级的英雄都能用，
   *     效果 = 面额全额（EXP_ITEM_SPEC 固定整数万）。
   *   · 保留 v66 的**资质上限闸**（expBlockOf）：英雄自身的等级上限由资质决定
   *     （凡人 60 … 天启体 240），到顶后不能再吃经验 —— 这是英雄养成口径，
   *     与"道具限制"是两码事，别混为一谈。
   * ============================================================ */
  GAME.expItemGrantOf = function (g, item) {
    if (!g || !item) return { ok: false, msg: '道具或英雄不存在' };
    var blk = GAME.expBlockOf(g);                /* 先过资质/君主段闸（既有口径，消息照旧） */
    if (blk) return { ok: false, msg: blk };
    return { ok: true, grant: item.amount || 0 };
  };
  /* 体力上限：基础 100 + 等级成长（资质成长点 × perLevel）× 治理修正。
     治理越高，同样的等级能养出更长的气力 —— 这是治理除产量/建造之外的第三个落点。 */
  /* ============================================================
   * 体力（v29 立第六维 · v52 补套装 · v66 补装备）
   * ------------------------------------------------------------
   * 口径（唯一出口，别再在别处拼这个式子）：
   *     体力上限 staMax = staBaseMax（等级/资质/治理）+ staEquipOf（装备与套装体力）
   *
   * v66（老板）：「部分英雄的体力没有加上装备的数值」——
   *   根因是装备那一列（源数据表的「体力」，原字段名 hp）**走的是另一条路**：
   *   battle 里折算成"全军生命 +N%"（封顶 25%），而六维/状态里的"体力"是出征消耗池。
   *   于是同一个数在两处说话，穿散件当然"一点都不涨"。
   *   现在装备体力 1:1 并进上限，并把 battle 那条并行路径删掉（见 hpMultOf）。
   *
   *   `g.stamina` 存的是**等级那一份的余量**（不含装备）：
   *     装备体力是"常备额度"—— 换装即得、卸装即失，不因出征被消耗，
   *     也不会出现"刚穿上装备，体力条只剩 8%"这种假象。
   *     要改这个规则只动 staNow/setStaNow 两处。
   * ============================================================ */
  GAME.staBaseMax = function (g) {
    var S = DATA.STAMINA;
    if (!g) return S.base;
    var rk = GAME.rankOf ? GAME.rankOf(g) : null;
    var grow = (rk && rk.grow) || 1;
    var nz = g.nz || 0;
    /* v74：自由点投放的 staAdd 计入上限（与等级/资质/治理同层） */
    return S.base + Math.max(0, (g.level || 1) - 1) * grow * S.perLevel * (1 + nz / S.nzDiv)
      + (g.staAdd || 0);
  };
  /* 装备与套装贡献的体力（唯一出口：散件 sta + 套装件 sta + 套装档位 sta，
     三者已在 genEquipBonus 里合并成一个 b.sta） */
  GAME.staEquipOf = function (g) {
    if (!GAME.systems || !GAME.systems.genEquipBonus) return 0;
    return GAME.systems.genEquipBonus(g).sta || 0;
  };
  /* v89.179c（观察项① 结项 · **唯一出口**）：体力/精力**回复速率**（每秒占池子的比例）。
     ------------------------------------------------------------
     旧写法在"在线（state.js tickOnce）"与"离线（state.js simulateBulk）"各写一遍同一公式 —— 收敛到这里。
     口径（v89.131 老板明示）：「体力精力应随现实时间百分比回复，按现实时间 24h 可恢复满值」
     → **现实时间**、与倍速无关（英雄面板亦已写明"与倍速无关"）。
     关于「600× 下行动被体力卡住」（旧复核文档的观察项①）：那是本口径的**设计后果**，不是 bug ——
     本次**不擅自反转老板明示的数值**，只保留一行开关备选（`GEN_COST.recoverSpeedScale`）。 */
  GAME.recoverRatePerRealSec = function () {
    var gc = DATA.GEN_COST || {};
    var base = 1 / ((gc.recoverHours || 24) * 3600);
    var mode = (gc.recoverSpeedScale || {}).mode || 'off';
    if (mode === 'off') return base;
    var ts = GAME.timeScale ? GAME.timeScale() : 1;
    if (!(ts > 1)) return base;
    return base * (mode === 'linear' ? ts : Math.sqrt(ts));
  };
  GAME.staMax = function (g) {
    return Math.round(GAME.staBaseMax(g) + GAME.staEquipOf(g));
  };
  GAME.staNow = function (g) {
    if (!g) return DATA.STAMINA.base;
    var mx = GAME.staMax(g), eq = GAME.staEquipOf(g), base = mx - eq;
    if (g.stamina == null) return mx;                     // 从未记过 = 满
    return Math.round(Math.min(mx, Math.max(0, Math.min(base, g.stamina)) + eq));
  };
  /* 体力当前值的**唯一写入口**（入参是"池子里的真实体力"，不是 g.stamina 的余量） */
  GAME.setStaNow = function (g, v) {
    var mx = GAME.staMax(g), eq = GAME.staEquipOf(g), base = mx - eq;
    var nv = Math.max(0, Math.min(mx, v));
    g.stamina = Math.max(0, Math.min(base, nv - eq));
    return GAME.staNow(g);
  };
  /* ============================================================
   * 精力（v89.131 · 老板「精力的数值设定基于六维设计一个公式」）
   * ------------------------------------------------------------
   * 口径（唯一出口，别再在别处拼这个式子）：
   *     精力上限 energyMax = DATA.ENERGY.base + Σ(六维 × DATA.ENERGY.per[维])
   *   六维取自 GAME.genAttrs（含装备/套装/丹药/战技——与面板上的六维同一份数），
   *   其中"体力"一维取 **staMax**（第六维的展示值就是体力上限）。
   *
   * 为什么不复用 staMax 当精力上限（v89.116 的临时兜底）：
   *   那个写法让"精力/上限"跟着体力涨到几千，而回复段又硬顶 100 ——
   *   显示与回复两个口径（典型的"同一数据两个出口"）。
   *   现在上限由本函数一处给出，回复段与面板都读它。
   * ============================================================ */
  /* 零件出口：把"基准 + 六维逐项贡献"摊开给界面与断言读 ——
     这样悬停分解与上限数值**同源**，界面不必自己再算一遍权重（唯一出口）。 */
  GAME.energyPartsOf = function (g) {
    var E = DATA.ENERGY || { base: 40, per: {} };
    var per = E.per || {};
    /* a 走 genAttrs（含装备等一切加成）——"六维"在面板上的含义就是这份 */
    var a = (g && GAME.genAttrs) ? GAME.genAttrs(g)
      : { tong: (g && g.tong) || 0, yw: (g && g.yw) || 0, zm: (g && g.zm) || 0,
        nz: (g && g.nz) || 0, spd: (g && g.speed) || 0,
        staMax: (g && GAME.staMax) ? GAME.staMax(g) : 100 };
    var DIMS = [['tong', '指挥'], ['yw', '武力'], ['zm', '谋略'], ['nz', '治理'],
      ['spd', '速度'], ['staMax', '体力']];
    var items = [];
    DIMS.forEach(function (d) {
      var val = (d[0] === 'staMax') ? (a.staMax != null ? a.staMax : (a.sta || 0)) : (a[d[0]] || 0);
      /* ⚠️ 权重的键是 'sta'（体力维），维名字段才叫 staMax —— 别拿显示键去查权重表 */
      var wk = (d[0] === 'staMax') ? 'sta' : d[0];
      var w = per[wk] || 0;
      if (w) items.push({ k: wk, n: d[1], val: val, v: Math.round(val * w * 100) / 100 });
    });
    return { base: E.base, items: items,
      total: Math.round(E.base + items.reduce(function (t, x) { return t + x.v; }, 0)) };
  };
  GAME.energyMaxOf = function (g) {
    return GAME.energyPartsOf(g).total;
  };
  /* 精力当前值：从未记过 = 满（与体力 staNow 的"null = 满"同一约定）；
     越界夹回 [0, 上限]（上限随六维变动——换装备/升级后不越界）。 */
  GAME.energyNowOf = function (g) {
    if (!g) return 0;
    var mx = GAME.energyMaxOf(g);
    if (g.energy == null) return mx;
    return Math.max(0, Math.min(mx, Math.round(g.energy)));
  };
  /* 精力当前值的**唯一写入口** */
  GAME.setEnergyNow = function (g, v) {
    if (!g) return 0;
    var mx = GAME.energyMaxOf(g);
    g.energy = Math.max(0, Math.min(mx, Math.round(v)));
    return g.energy;
  };

  /* 体力 → 全军生命加成（v89.184 方案A：**分段** —— 前段双曲、后段线性续增）。
     ------------------------------------------------------------
     v89.183（老板）：「渐近值（上限）曲线顶部趋于平缓 → 后期英雄再提升属性
     在战役中是不是没用了」——实证成立：满配体力 15395 时再堆 +12000（+78%），
     战场损失分毫不变（probe_v89183a/b：5837 → 5835）。
     修法（方案A，老板拍板）：
       · 前段（≤ hpKnee）：双曲 hpCap×s/(s+hpK) —— 与旧曲线**逐点相同**（新手/老档零变化）；
       · 后段（> hpKnee）：拐点值 + (s−hpKnee)/1000 × hpTail —— 每 1000 体力 +2.5%，永不熄火。
     实测：满配 +76.0% → +95.2%；临界局（1 万 vs 5.75 万守军）从"全灭"变"险胜"；
     后段无硬上限（体力来源有限，满配实际约 1.6 万）。
     拆成"按池子取值"的纯函数，界面要算"装备带来多少全军生命"时直接复用它，
     不必再让英雄对象跑一遍。 */
  GAME.staHpPct = function (pool) {
    var S = DATA.STAMINA;
    var s = Math.max(0, pool || 0);
    if (s <= S.hpKnee) return S.hpCap * s / (s + S.hpK);
    var atKnee = S.hpCap * S.hpKnee / (S.hpKnee + S.hpK);
    return atKnee + (s - S.hpKnee) / 1000 * S.hpTail;
  };
  GAME.staHpBonus = function (g) {
    return GAME.staHpPct(GAME.staNow(g));
  };

  /* --------- 任务进度（v12 指标驱动） --------- */
  /* ---------- 指标求值 ---------- */
  GAME.questMetric = function (metric, sub) {
    var s = GAME.state;
    if (!s) return 0;
    var sst = s.stats || {};
    var i, t, k;
    switch (metric) {
      case 'bldCount':
        t = 0; (s.cities || []).forEach(function (c) { t += GAME.numBuilding(c, sub); });
        return t;
      case 'bldLevel':
        t = 0; (s.cities || []).forEach(function (c) { t = Math.max(t, GAME.buildingLevel(c, sub) || 0); });
        return t;
      case 'bldTotal':
        t = 0; (s.cities || []).forEach(function (c) { t += c.cells.filter(function (x) { return x.build; }).length; });
        return t;
      case 'extCount':
        t = 0; (s.cities || []).forEach(function (c) {
          (c.extGrid || []).forEach(function (e) { if (e.type === sub) t += 1; });
        });
        return t;
      case 'extLevel':
        t = 0; (s.cities || []).forEach(function (c) {
          (c.extGrid || []).forEach(function (e) { if (e.type === sub) t = Math.max(t, e.lv); });
        });
        return t;
      case 'extTotal':
        t = 0; (s.cities || []).forEach(function (c) {
          (c.extGrid || []).forEach(function (e) { if (e.type && !e.pending) t += 1; });
        });
        return t;
      /* v89.191（老板 3-④）：科技按城 ——
         · techLevel（任务指标"某科技等级"）取**各城最高**（有一座城到了就算到）；
         · techTotal（势力总科技值）取**各城之和**（城越多、铺得越广，总值越高）。 */
      case 'techLevel':
        t = 0; (s.cities || []).forEach(function (c) { t = Math.max(t, (c.techs && c.techs[sub]) || 0); });
        return t;
      case 'techTotal':
        t = 0; (s.cities || []).forEach(function (c) {
          for (var _kk191 in (c.techs || {})) t += c.techs[_kk191];
        });
        return t;
      case 'troopCount':
        t = 0; (s.cities || []).forEach(function (c) { t += (c.army && c.army[sub]) || 0; });
        return t;
      case 'armyTotal':
        t = 0; (s.cities || []).forEach(function (c) { t += GAME.armyTotal(c); });
        return t;
      case 'genCount': return (s.generals || []).length;
      case 'heroCount': return (s.generals || []).filter(function (g) { return g.hero; }).length;
      case 'cityCount': return (s.cities || []).length;
      case 'rank': return s.rank || 0;
      case 'rep': return s.rep || 0;
      case 'hearts': return s.hearts || 0;
      case 'pop': return s.res.pop || 0;
      case 'popCap':
        /* v89.185（老板 6）：任务口径 = **实际幸存者上限**（民心折算）——"面板写 60000、实际只能到 48000"的落差不再出现 */
        t = 0; (s.cities || []).forEach(function (c) { t += (GAME.effPopCapOf ? GAME.effPopCapOf(c) : GAME.maxPopOf(c)); });
        return t;
      case 'res': return s.res[sub] || 0;
      case 'gold': return s.res.gold || 0;
      case 'itemOwn': return (s.items || {})[sub] || 0;
      case 'matTotal':
        t = 0; (DATA.MATERIAL_IDS || []).forEach(function (id) { t += (s.items || {})[id] || 0; });
        return t;
      case 'equipCount':
        /* v88：机甲 + 基因两套都计入 */
        t = 0; (s.generals || []).forEach(function (g) { t += Object.keys(g.equip || {}).length + Object.keys(g.lingEquip || {}).length; });
        return t;
      case 'invCount': return (s.inventory || []).length;
      case 'forgeKinds': return (s.forged || []).length;
      case 'wildCount': return (s.wilds || []).length;
      case 'conquerCount': return sst.conquer || 0;
      case 'winCount': return sst.wins || 0;
      case 'buildDone': return sst.buildDone || 0;
      case 'techDone': return sst.techDone || 0;
      case 'trainTotal': return sst.trained || 0;
      case 'forgeTotal': return sst.forgedCount || 0;
      case 'recruitCount': return sst.recruited || 0;
      case 'tradeCount': return sst.trades || 0;
      default: return 0;
    }
  };

  /* ============================================================
   * 指标 → 人话（v25 · 需求 11）
   * ------------------------------------------------------------
   * 任务详情要把"需求"讲清楚，而 metric 是 `bldLevel + sub` 这种机器口径。
   * 这里做一张模板表：不是给玩家看代码，而是给一句能读懂的军令。
   * ============================================================ */
  GAME.QUEST_METRIC_NEED = {
    bldCount: '城内「{x}」达到 {g} 座', bldLevel: '「{x}」达到 {g} 级', bldTotal: '城内建筑共达 {g} 座',
    extCount: '城外「{x}」达到 {g} 块', extLevel: '城外「{x}」达到 {g} 级', extTotal: '城外已开发 {g} 块',
    techLevel: '科技「{x}」达到 {g} 级', techTotal: '科技总等级达 {g} 级',
    troopCount: '「{x}」达到 {g} 名', armyTotal: '总兵力达到 {g}',
    genCount: '麾下英雄达 {g} 人', heroCount: '麾下英雄达 {g} 人',   /* v89.188（老板 3）：任务文案中性化 */ cityCount: '据有城池 {g} 座',
    rank: '威望达到「{r}」', rep: '声望达到 {g}', hearts: '民心达到 {g}', pop: '幸存者达到 {g}',
    popCap: '幸存者上限达到 {g}', res: '{x} 存量达到 {g}', gold: '旧币达到 {g}',
    itemOwn: '持有「{x}」×{g}', matTotal: '打造材料共 {g} 件', equipCount: '已穿戴装备 {g} 件',
    invCount: '背包装备达 {g} 件', forgeKinds: '打造出 {g} 种装备', wildCount: '占领野地 {g} 块',
    conquerCount: '累计攻占 {g} 座城池', winCount: '累计获胜 {g} 场', buildDone: '累计建造/升级 {g} 次',
    techDone: '累计完成 {g} 项科技', trainTotal: '累计募兵 {g} 名', forgeTotal: '累计打造 {g} 件',
    recruitCount: '累计招募英雄 {g} 人', tradeCount: '累计市易 {g} 次',
  };
  /* sub 的中文名（建筑/城外/兵种/科技/资源/材料/宝物 通查一遍） */
  GAME.subName = function (id) {
    if (!id) return '';
    var hit = null;
    function find(arr, key) {
      (arr || []).forEach(function (x) { var v = x[key]; if (v === id) hit = x.name; });
    }
    if (DATA.BUILDINGS[id]) return DATA.BUILDINGS[id].name;
    if (DATA.EXT_BUILDINGS[id]) return DATA.EXT_BUILDINGS[id].name;
    if (DATA.TROOPS[id]) return DATA.TROOPS[id].name;
    if (DATA.MATERIAL_BY_ID[id]) return DATA.MATERIAL_BY_ID[id].name;
    find(DATA.TECH, 'id'); if (hit) return hit;
    find(DATA.RESOURCES, 'key'); if (hit) return hit;
    find(DATA.ITEMS, 'id'); if (hit) return hit;
    return id;
  };
  /* 需求文案：一句"要什么"，外加当前进度 */
  GAME.questNeedText = function (def) {
    if (!def) return '';
    var tpl = GAME.QUEST_METRIC_NEED[def.metric];
    var g = GAME.questGoal(def);
    if (!tpl) return (DATA.QUEST_METRIC_DESC[def.metric] || def.metric) + ' 达到 ' + g;
    return tpl.split('{x}').join(GAME.subName(def.sub))
      .split('{g}').join(String(g))
      .split('{r}').join((DATA.RANK[g] || {}).name || String(g));
  };

  /* ---------- 成长型任务 ---------- */
  GAME.questAmount = function (q) { return GAME.questMetric(q.metric, q.sub); };
  GAME.questGoal = function (q) { return q.goal || 1; };
  GAME.questReady = function (q) {
    return !GAME.state.quests.done[q.id] && GAME.questAmount(q) >= GAME.questGoal(q);
  };
  GAME.questDone = function (q) { return !!GAME.state.quests.done[q.id]; };

  GAME.claimQuest = function (qid) {
    var s = GAME.state, q = null;
    (DATA.QUESTS || []).forEach(function (x) { if (x.id === qid) q = x; });
    if (!q) return { ok: false, msg: '未知任务' };
    if (s.quests.done[qid]) return { ok: false, msg: '任务已领取' };
    if (GAME.questAmount(q) < GAME.questGoal(q)) return { ok: false, msg: '任务尚未完成' };
    s.quests.done[qid] = true;
    GAME.grantReward(q.reward);
    s.quests.log = s.quests.log || [];
    s.quests.log.unshift({ id: q.id, title: q.title, kind: 'growth', t: U.now() });
    GAME.log.task('完成任务：' + q.title);
    return { ok: true, msg: '获得奖励！' };
  };

  GAME.grantReward = function (reward) {
    var s = GAME.state;
    if (!reward) return;
    for (var k in reward) {
      if (k === 'rep') { s.rep = (s.rep || 0) + reward[k]; continue; }
      if (DATA.MATERIAL_BY_ID && DATA.MATERIAL_BY_ID[k]) {
        s.items = s.items || {};
        s.items[k] = (s.items[k] || 0) + reward[k];
        continue;
      }
      if (!DATA.RESOURCES.some(function (r) { return r.key === k; })) {
        /* 其余视为宝物 id */
        s.items = s.items || {};
        s.items[k] = (s.items[k] || 0) + reward[k];
        continue;
      }
      s.res[k] = (s.res[k] || 0) + reward[k];
    }
  };


  /* ---------- 随机型任务 ---------- */
  var RQ_BY_ID = {};
  (DATA.RANDOM_QUESTS || []).forEach(function (q) { RQ_BY_ID[q.id] = q; });
  GAME.randomQuestDef = function (id) { return RQ_BY_ID[id] || null; };

  GAME.questDayIndex = function () { return Math.floor(Date.now() / 86400000); };

  /* 随机任务进度：abs 类读绝对值，其余读「自接取以来的增量」 */
  GAME.randQuestAmount = function (entry) {
    var def = RQ_BY_ID[entry.id];
    if (!def) return 0;
    var v = GAME.questMetric(def.metric, def.sub);
    if (def.abs) return v;
    return Math.max(0, v - (entry.base || 0));
  };
  GAME.randQuestReady = function (entry) {
    var def = RQ_BY_ID[entry.id];
    return !!def && GAME.randQuestAmount(entry) >= def.goal;
  };

  /* v89.86（整改 P-08）：随机任务的**可达性过滤** —— 目标必须落在当前进度够得着的范围内。
     实测反例：幸存者上限 200 时刷出「养兵之资 0/500」（armyTotal 500），目标脱离进度。
     判据（保守，只砍明确不可达的）：
       · armyTotal        —— 目标 ≤ 全境幸存者上限合计（拥兵上限即幸存者上限）
       · troopCount(sub)  —— 该兵种**已解锁**（未解锁的兵种刷出来只能干瞪眼）
       · bldCount(sub)    —— 唯一建筑已建成时，不再刷"再建一座"
     全部生成路径（每日刷新 / 单条换新 / 全部换新）都走 rollBatch —— 拦在这一处即可。 */
  GAME.questReachable = function (def) {
    if (!def) return true;
    var s = GAME.state;
    if (!s) return true;
    var city = GAME.currentCity() || (s.cities || [])[0];
    if (!city) return false;
    if (def.metric === 'armyTotal') {
      var popCap = 0;
      (s.cities || []).forEach(function (ct) { popCap += (GAME.effPopCapOf ? GAME.effPopCapOf(ct) : 0) || 0; });
      return (def.goal || 0) <= Math.max(1, popCap);
    }
    if (def.metric === 'troopCount' && def.sub) {
      var t = DATA.TROOPS[def.sub];
      if (!t) return false;
      var u = t.unlock || {};
      for (var k in u) {
        if ((GAME.buildingLevel(city, k) || 0) < u[k]) return false;
      }
      return true;
    }
    if (def.metric === 'bldCount' && def.sub) {
      var UNIQ = GAME.UNIQUE_BUILDINGS || {};
      if (UNIQ[def.sub]) {
        return (GAME.buildingLevel(city, def.sub) || 0) <= 0;   /* 唯一建筑已建成 → 不可达 */
      }
      return true;
    }
    return true;
  };

  /* 抽一批随机任务：同批内类型互不相同 */
  function rollBatch(count, pool) {
    var usedType = {}, usedId = {};
    pool.forEach(function (e) {
      var d = RQ_BY_ID[e.id];
      if (d) usedType[d.type] = true;
      usedId[e.id] = true;
    });
    var out = [];
    for (var i = 0; i < count; i++) {
      var cands = DATA.RANDOM_QUESTS.filter(function (q) {
        return !usedType[q.type] && !usedId[q.id] && GAME.questReachable(q);   /* v89.86（P-08） */
      });
      if (!cands.length) {
        cands = DATA.RANDOM_QUESTS.filter(function (q) { return !usedId[q.id] && GAME.questReachable(q); });
      }
      if (!cands.length) break;
      var q = cands[Math.floor(Math.random() * cands.length)];
      usedType[q.type] = true; usedId[q.id] = true;
      out.push(q);
    }
    return out;
  }

  function makeEntry(def) {
    return {
      id: def.id,
      day: GAME.questDayIndex(),
      base: GAME.questMetric(def.metric, def.sub),
      at: U.now(),
    };
  }

  /* 每日刷新（tick 内调用，幂等） */
  GAME.ensureDailyQuests = function (force) {
    var s = GAME.state;
    if (!s || !DATA.RANDOM_QUESTS) return 0;
    s.quests.pool = s.quests.pool || [];
    var today = GAME.questDayIndex();
    if (!force && s.quests.poolDay === today) return 0;
    var last = s.quests.poolDay == null ? today : s.quests.poolDay;
    var daily = DATA.QUEST_DAILY;
    /* 清理过保留期的陈年项 */
    s.quests.pool = s.quests.pool.filter(function (e) {
      return today - (e.day == null ? today : e.day) < (daily.keepDays || 7);
    });
    /* 同时在手上限（默认 5）：满则不再新增，未完成的不会被顶掉 */
    var cap = daily.maxActive || daily.perDay || 5;
    var days = Math.max(1, today - last);
    var budget = (daily.perDay || 5) * days;
    var room = Math.max(0, cap - s.quests.pool.length);
    var want = Math.min(budget, room);
    var batch = rollBatch(want, s.quests.pool);
    batch.forEach(function (d2) { s.quests.pool.push(makeEntry(d2)); });
    s.quests.poolDay = today;
    if (batch.length) GAME.log.task('📜 新增随机任务 ' + batch.length + ' 项（每日 5 项，同时在手上限 ' + cap + '）');
    return batch.length;
  };

  /* 换新：单条 3000 旧币；全部换新按条数计价（避免靠点击无限刷任务） */
  GAME.randQuestRerollCost = function () { return 3000; };
  GAME.randQuestRerollAllCost = function () {
    var s = GAME.state;
    return (s.quests.pool || []).length * GAME.randQuestRerollCost();
  };
  GAME.rerollAllRandomQuests = function () {
    var s = GAME.state;
    var pool = s.quests.pool || [];
    if (!pool.length) return { ok: false, msg: '当前没有随机任务' };
    var cost = GAME.randQuestRerollAllCost();
    if ((s.res.gold || 0) < cost) return { ok: false, msg: '旧币不足（需 ' + U.fmt(cost) + '）' };
    s.res.gold -= cost;
    var batch = rollBatch(pool.length, []);
    s.quests.pool = batch.map(function (d) { return makeEntry(d); });
    return { ok: true, msg: '已换新 ' + batch.length + ' 项随机任务（-' + U.fmt(cost) + '金）' };
  };
  GAME.rerollRandomQuest = function (entryId) {
    var s = GAME.state;
    var idx = -1;
    (s.quests.pool || []).forEach(function (e, i) { if (e.id === entryId) idx = i; });
    if (idx < 0) return { ok: false, msg: '任务不存在' };
    var cost = GAME.randQuestRerollCost();
    if ((s.res.gold || 0) < cost) return { ok: false, msg: '旧币不足（需 ' + U.fmt(cost) + '）' };
    s.res.gold -= cost;
    var batch = rollBatch(1, s.quests.pool);
    if (!batch.length) return { ok: false, msg: '暂无可换任务' };
    s.quests.pool[idx] = makeEntry(batch[0]);
    return { ok: true, msg: '已换新任务：' + batch[0].title + '（-' + U.fmt(cost) + '金）' };
  };

  GAME.claimRandomQuest = function (entryId) {
    var s = GAME.state;
    var idx = -1;
    (s.quests.pool || []).forEach(function (e, i) { if (e.id === entryId) idx = i; });
    if (idx < 0) return { ok: false, msg: '任务不存在或已过期' };
    var entry = s.quests.pool[idx], def = RQ_BY_ID[entry.id];
    if (!def) return { ok: false, msg: '未知任务' };
    if (!GAME.randQuestReady(entry)) return { ok: false, msg: '任务尚未完成' };
    s.quests.pool.splice(idx, 1);
    GAME.grantReward(def.reward);
    s.quests.log = s.quests.log || [];
    s.quests.log.unshift({ id: def.id, title: def.title, kind: 'random', t: U.now() });
    if (s.quests.log.length > 200) s.quests.log.length = 200;
    GAME.log.task('完成随机任务：' + def.title);
    return { ok: true, msg: '随机任务完成：' + def.title };
  };

  /* 兼容旧接口 */
  GAME.advanceQuestTrain = function (troopId, count) {
    var s = GAME.state;
    s.quests.stash = s.quests.stash || {};
    s.quests.stash[troopId] = (s.quests.stash[troopId] || 0) + count;
  };

  /* 供旧接口调用（攻打城池计数） */
  GAME.advanceConquer = function () {
    var s = GAME.state;
    s.quests.conquerCount = (s.quests.conquerCount || 0) + 1;
    GAME.statBump('conquer', 1);
  };
  GAME.checkProgressQuests = function () { };

  /* ---------- 汇总（UI / 侧栏红点） ---------- */
  GAME.questSummary = function () {
    var s = GAME.state;
    var growthReady = (DATA.QUESTS || []).filter(function (q) { return GAME.questReady(q); }).length;
    var growthUndone = (DATA.QUESTS || []).filter(function (q) { return !GAME.questDone(q); }).length;
    var randReady = (s.quests.pool || []).filter(function (e) { return GAME.randQuestReady(e); }).length;
    return {
      growthReady: growthReady, growthUndone: growthUndone,
      randReady: randReady, randTotal: (s.quests.pool || []).length,
      ready: growthReady + randReady,
    };
  };


  /* --------- 建造进度查询（供格子/弹窗实时刷新） --------- */
  /* kind: 'city'|'ext'，idx: 格子/地块索引；返回 {pct, left, label} 或 null */
  GAME.buildProgress = function (kind, idx, cityId) {
    var s = GAME.state;
    if (!s) return null;
    var cur = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    for (var i = 0; i < s.queues.build.length; i++) {
      var q = s.queues.build[i];
      /* v14：外城地块按城池独立，同一下标会在多城间重复，须同时匹配 cityId */
      var sameCity = !cur || !q.cityId || q.cityId === cur.id;
      var hit = kind === 'city'
          ? (GAME.slotEq(q.gridIndex, idx) && (q.type === 'build' || q.type === 'upgrade') && sameCity)
          : (q.extIdx === idx && (q.type === 'ext_build' || q.type === 'ext_upgrade') && sameCity);
      if (hit) return GAME.buildProgressOf(q);
    }
    return null;
  };
  /* v89.174：按**队列对象**取进度（唯一出口）—— 按格子查（buildProgress）与
     政务厅面板「在建队列」列表（按队列逐条列）共用，别处不许各算一份。 */
  GAME.buildProgressOf = function (q) {
    if (!q) return null;
    var pct = Math.min(100, Math.floor(q.elapsed / q.totalTime * 100));
    var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
    return { pct: pct, left: left, label: pct + '% · ' + U.durExact(left) };
  };
  /* 兼容旧接口：返回展示文本 "X% · MM:SS" */
  GAME.buildPct = function (kind, idx, cityId) {
    var p = GAME.buildProgress(kind, idx, cityId);
    return p ? p.label : '';
  };

  /* ============================================================
   * 城池间调拨（v60 · 需求 4）
   * ------------------------------------------------------------
   * 老板：「城池之间，资源需要运输，英雄需要派遣，为自己占据的城池提供相关功能按钮」。
   * 资源既然归属城池（见 GAME.res 的注释），就必须给出**搬运**的手段 ——
   * 否则多城经营会变成"每座城各自为政、资源互不相通"的死局。
   *
   *   · 运输：即时结算（不做车队动画），按**距离**抽损耗 ——
   *     让"就近布局"有意义，也让"把后方的粮运到前线"有代价。
   *     损耗可被【交易站】等级削减（城池经营对运输的回报）。
   *     目的地仓容不足时**原路带回**（不做静默丢弃）。
   *   · 派遣：一人一城，改 `g.cityId` 即可。守将必须先解任 ——
   *     否则会出现"人已被派走、守将加成还挂在原城"的静默失效（本项目老毛病）。
   * ============================================================ */
  /* 可运输的资源：幸存者不在其列（幸存者随城池自然增长，不靠搬运）。
     v89.161（老板 5）：**金也不在其列** —— 金是玩家层级通用资源（唯一池 s.gold），
     运金等于"从池子搬到池子"，途中还要白白损耗一截（改前正是这样静默漏账）。 */
  GAME.TRANSPORT_KEYS = DATA.RES_ORDER.filter(function (k) { return k !== 'gold'; });
  /* 资源名（唯一出口；数据源是 DATA.RESOURCES）—— 战报/日志/运输面板都读它，
     不要在各处自己维护一张中文名表。 */
  GAME.resName = function (key) {
    var n = key;
    (DATA.RESOURCES || []).forEach(function (r) { if (r.key === key) n = r.name; });
    return n;
  };
  /* 城距：切比雪夫距离（与地图行军的口径一致 —— 菱形网格两轴各走 N 格） */
  GAME.cityDist = function (a, b) {
    if (!a || !b) return 0;
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  };
  /* 从 from 运往 to 的损耗率（0~1）。唯一出口，界面与结算都读它。 */
  GAME.transportLossOf = function (from, to) {
    var T = DATA.TRANSPORT || {};
    if (!from || !to) return 0;
    var d = GAME.cityDist(from, to);
    var raw = Math.min(T.lossMax || 0.30, d * (T.lossPerTile || 0.004));
    var cut = Math.min(T.marketCutMax || 0.45,
      (GAME.buildingLevel(from, 'shichang') || 0) * (T.marketCutPerLv || 0.015));
    return raw * (1 - cut);
  };
  /* ============================================================
   * v89.103（老板「资源运输应当采用出征界面」）：**随军辎重** —— 唯一出口组
   * ------------------------------------------------------------
   * 玩法改动：城池之间运资源不再是"点一下就瞬移"的隔空搬运，而是**跟兵走**：
   *   出征界面选好英雄 + 兵种 + 各方资源数量 → 大军押着辎重开拔
   *   → 抵达后兵力入城、辎重按既有运输口径落账（距离损耗 + 目的地仓容）。
   *   · 载重：`DATA.TROOPS[].load` 从此**真的**是"能挑多少"（此前是死字段）——
   *     板车 200 / 运输平台 5000 / 步行机 20 …… 想运得多就得多带挑夫。
   *   · 出发就扣（在途资源不能再花第二次），抵达才落账，失败/召回原路退回。
   * 四个函数的分工（界面预估、出发校验、抵达落账**共用**，不许各算一份）：
   *   cargoCapOf / cargoLoadOf  —— 运力与载重（重量的唯一口径）
   *   transportPlanOf           —— **纯函数**：这批货能起运多少 / 掉多少 / 装不下多少
   *   transportApply            —— 把 plan 落到双方账上
   * ============================================================ */
  GAME.cargoCapOf = function (army) {
    var cap = 0;
    Object.keys(army || {}).forEach(function (id) {
      var n = Math.floor(army[id] || 0);
      var t = DATA.TROOPS[id];
      if (n <= 0 || !t) return;
      cap += n * (t.load || 0);
    });
    return cap;
  };
  /* 一批辎重有多重（粮木石铁金同权：1 单位 = 1 载重） */
  GAME.cargoLoadOf = function (cargo) {
    var w = 0;
    Object.keys(cargo || {}).forEach(function (k) {
      if (GAME.TRANSPORT_KEYS.indexOf(k) < 0) return;
      w += Math.max(0, Math.floor(cargo[k] || 0));
    });
    return w;
  };
  /* 一次运输的**账**（纯函数，不落地）：qty = 想运多少 */
  GAME.transportPlanOf = function (from, to, key, qty) {
    var loss = GAME.transportLossOf(from, to);
    var have = Math.floor(GAME.res(from)[key] || 0);
    var room = Infinity;
    if (key !== 'gold') {
      var cap = GAME.storeCapOf(to, key);   /* v89.212（老板 1）：按资源上限（堆场分账） */
      if (cap > 0) room = Math.max(0, cap - Math.floor(GAME.res(to)[key] || 0));
    }
    var ship = Math.min(Math.floor(qty || 0), have);
    if (room !== Infinity) {
      ship = Math.min(ship, Math.ceil(room / Math.max(1e-9, 1 - loss)));
      /* 浮点与取整的边界：实收不许超过剩余仓容 */
      while (ship > 0 && Math.floor(ship * (1 - loss)) > room) ship--;
    }
    if (ship < 0) ship = 0;
    var landed = Math.floor(ship * (1 - loss));
    return { key: key, loss: loss, have: have, room: room, ship: ship,
      landed: landed, lost: ship - landed, stay: Math.max(0, Math.floor(qty || 0) - ship) };
  };
  /* 落账（唯一出口）：出发城 −ship，目的地 +landed */
  GAME.transportApply = function (plan, from, to) {
    var R = GAME.res(from), R2 = GAME.res(to);
    R[plan.key] = (R[plan.key] || 0) - plan.ship;
    R2[plan.key] = (R2[plan.key] || 0) + plan.landed;
    return plan;
  };
  /* 一批辎重的抵达落账（随军运输用）：逐项结算，凑一句可读的账。
     ⚠️ 起运时**已经**从出发城扣过全量 —— 所以这里要把"装不下没起运的"
     （plan.stay）原路退回出发城，不能让它凭空消失。 */
  GAME.transportCargo = function (cargo, from, to) {
    var keys = Object.keys(cargo || {}).filter(function (k) {
      return GAME.TRANSPORT_KEYS.indexOf(k) >= 0 && Math.floor(cargo[k] || 0) > 0;
    });
    var out = { keys: keys, lines: [], landed: 0, lost: 0, back: 0 };
    if (!keys.length || !from || !to) return out;
    keys.forEach(function (k) {
      var plan = GAME.transportPlanOf(from, to, k, cargo[k]);
      GAME.transportApply(plan, from, to);
      if (plan.stay > 0) {
        var R = GAME.res(from);
        R[k] = (R[k] || 0) + plan.stay;          /* 装不下 → 原路退回（未起运，不抽损耗） */
        out.back += plan.stay;
      }
      out.landed += plan.landed;
      out.lost += plan.lost;
      out.lines.push(GAME.resName(k) + ' ' + U.fmt(plan.ship) + '→' + U.fmt(plan.landed)
        + (plan.lost > 0 ? '（途中损耗 ' + U.fmt(plan.lost) + '）' : '')
        + (plan.stay > 0 ? '；' + U.fmt(plan.stay) + ' 因' + to.name + '仓容不足未起运' : ''));
    });
    return out;
  };
  /* ⛔ v89.103 退役：`GAME.doTransport`（单资源、即时到账的隔空搬运）——
     老板「资源运输应当采用出征界面」：运输现在是**随军行军**（见 GAME.doTransferCargo），
     那套"点一下就到"的入口连同老面板一并退场；
     损耗 / 仓容 / 退回的算法全部搬进 `transportPlanOf` + `transportApply`（唯一出口）。
     界面预估、出发校验、抵达落账三处都读这一对函数。 */
  /* ============================================================
   * ⛔ v89.138（老板 2）：「去掉度支归集这个菜单功能」——整条退役。
   * 删净：`GAME.budgetKeep` + `GAME.budgetGather`（跨城资金调剂）+
   * 城池面板按钮 + `case 'budget-gather'`。
   * 资金调剂未丢：**运输**（出征界面 · 本境调运）可随军押运旧币以外的资源；
   * 旧币是货币、不走运输 —— 各城府库独立经营（这本就是"分城发展"的一部分）。
   * 如需恢复：本段代码见 `backup/v89138/domain.js`（判据：`GAME.budgetGather = function`）。
   * ============================================================ */
  /* ⛔ v89.138（老板 2）：`GAME.dispatchableGensOf`（可派遣英雄名单）随
     「英雄派遣」面板一并退役 —— 出征界面的主将下拉（expGeneralsOf）已覆盖
     "谁可出征/可调防"的同一判据。 */
  /* 英雄所在城（v60 · 需求 4）：**唯一出口**。
     `g.cityId` 为空时（历史存档 / 刚被解任 / 测试构造）归到**当前城** ——
     不兜底的话，这些英雄会从英雄页的"本城"名单里凭空消失，
     玩家会以为人丢了（这是"归属城池"改造最容易踩的坑）。 */
  GAME.genCityOf = function (g) {
    var s = GAME.state;
    if (!g) return null;
    var c = g.cityId ? GAME.cityById(g.cityId) : null;
    if (c) return c;
    return GAME.currentCity() || (s && s.cities && s.cities[0]) || null;
  };
  /* ============================================================
   * v89.59（老板需求 3）：**军队派驻** —— 己方城池间转移军队
   * ------------------------------------------------------------
   * 与「资源运输」（有损耗）/「英雄派遣」并列的第三条城池间操作。
   * 即时结算（与英雄派遣一致）：**兵士行军不损耗**，损耗只发生在物资上。
   * 校验：两城都在、非同一城、各兵种库存充足、目标城练兵场容量可容纳。
   * ============================================================ */
  /* ============================================================
   * v89.103（老板「任意自身城池向其他城池进行资源运输，应当采用出征界面」）
   * ------------------------------------------------------------
   * **本境调运**（唯一出口）：兵力 + 辎重一起走行军通道。
   *   · 校验：兵力足 → 目标城练兵场容量 → 带队英雄（人得在本城）→ **运力够不够**
   *     → 出发城库存够不够 → 目的地仓容（决定"能不能起运"，装不下就不起运）；
   *   · 出发即扣（兵 + 辎重）：在途的东西不能再花第二次；
   *   · 抵达落账在 `battle.expedition` 的 owncity 分支（同一套运输口径）；
   *   · 失败 / 召回：兵与辎重**原路退回**（在 march.arrive / march.recall 里）。
   * `doTransferTroops` = 不带辎重的薄包装（军队派驻面板仍走它）。
   * ============================================================ */
  GAME.doTransferCargo = function (fromId, toId, army, genId, cargo) {
    var s = GAME.state;
    if (!s) return { ok: false, msg: '尚未开局' };
    var from = GAME.cityById(fromId), to = GAME.cityById(toId);
    if (!from || !to) return { ok: false, msg: '城池不存在' };
    if (from.id === to.id) return { ok: false, msg: '不能派驻本城' };
    var moved = 0;
    for (var k in (army || {})) {
      var n = Math.floor(army[k] || 0);
      if (n <= 0) continue;
      if ((from.army[k] || 0) < n) {
        return { ok: false, msg: '兵力不足（' + (DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + '）' };
      }
      moved += n;
    }
    if (!moved) return { ok: false, msg: '请先选择要派驻的兵力' };
    /* ⛔ v89.220（老板 2）：「向己方城池派遣时，提示练兵场容量不足。练兵场有什么容量，
       出征才有出征兵力上限吧」——**目标城容量闸整条退役**：
       练兵场容量只作为**出征**（从本城发兵）的兵力上限（prepare 的 mode.battle 闸）；
       驻军（调兵 / 派遣）不以目标城练兵场容量为限。v89.102～v89.219 曾按"与出征同一把尺"
       给目标城设闸（当时也设了抵达复验）——撤销依据与实测见 docs/v89220。 */
    /* ---- 辎重校验（v89.103）：逐项"有货 + 能装下" ---- */
    var load = null;
    if (cargo) {
      load = {};
      for (var ck in cargo) {
        var cn = Math.floor(cargo[ck] || 0);
        if (cn <= 0) continue;
        if (GAME.TRANSPORT_KEYS.indexOf(ck) < 0) return { ok: false, msg: '该物资不可运输' };
        var have = Math.floor(GAME.res(from)[ck] || 0);
        if (have < cn) {
          return { ok: false, msg: from.name + '的' + GAME.resName(ck) + '不足（现有 ' + U.fmt(have) + '）' };
        }
        /* 目的地装不下的部分不起运（与抵达落账同一函数的口径） */
        var pl = GAME.transportPlanOf(from, to, ck, cn);
        if (pl.ship <= 0) {
          return { ok: false, msg: to.name + '的' + GAME.resName(ck) + '仓容已满（无余量可运）' };
        }
        load[ck] = cn;
      }
      if (!Object.keys(load).length) load = null;
    }
    if (load) {
      var capW = GAME.cargoCapOf(army), needW = GAME.cargoLoadOf(load);
      if (needW > capW) {
        return { ok: false, msg: '运力不足：辎重 ' + U.fmt(needW) + ' ＞ 随军载重 ' + U.fmt(capW)
          + '（多带板车 / 运输平台 —— 板车 200、运输平台 5000）' };
      }
    }
    /* ============================================================
     * v89.87（老板需求 2）：改走**行军通道**（原先瞬间到达直接改兵账）——
     * "派兵只通过出征通道"（老板拍板，含自身城池/野地/其他城池统一出口）。
     * 校验（含目标城练兵场容量）仍在出发完成；抵达时再验一次，
     * 超容则大军整体折返（见 expedition 的 owncity 分支）。
     * "一律要选将"（老板拍板）：调兵也需带队英雄（随军入驻新城）。
     * ============================================================ */
    if (!genId) return { ok: false, msg: '请选择带队英雄' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '英雄不存在' };
    if (gen.status && gen.status !== 'idle') {
      return { ok: false, msg: gen.name + ' 正在执行其他任务（' + gen.status + '）' };
    }
    var _gc2 = GAME.genCityOf ? GAME.genCityOf(gen) : null;   /* 返回城对象 */
    if (!_gc2 || _gc2.id !== from.id) {
      return { ok: false, msg: gen.name + ' 不在' + from.name };
    }
    /* v89.198（dispatch 六参签名）：原第 6 参 ops 退役 —— 辎重落在第 6 参 extra（防静默丢失）。 */
    var d = GAME.march.dispatch({ kind: 'owncity', id: to.id }, 'transfer', army, gen.id, null,
      load ? { cargo: load } : null);
    if (!d.ok) return d;
    var wTxt = load ? ('，辎重 ' + U.fmt(GAME.cargoLoadOf(load)) + '（' + Object.keys(load).length + ' 项）') : '';
    return { ok: true, msg: '大军开拔：' + U.fmt(moved) + ' 兵' + wTxt + ' → ' + to.name + '（' + d.msg + '）',
      march: d.march, cargo: load };
  };
  /* 军队派驻（不带辎重）：保留原签名（派驻面板 / 新城提示都读它） */
  GAME.doTransferTroops = function (fromId, toId, army, genId) {
    return GAME.doTransferCargo(fromId, toId, army, genId, null);
  };

  /* ⛔ v89.138（老板 2）：`GAME.doDispatch`（英雄调防 · 即时到账）整条退役 ——
     老板「英雄派遣…合并成"派遣"和"运输"，均进入出征界面」。
     英雄调防现在走**出征界面（本境调运）**：主将随军 → `march.dispatch('transfer')`，
     抵达入城（`gen.cityId = 目标城`，见 expedition 的 owncity 分支）。
     ⚠️ 原函数里的两道闸**已迁移，不是丢掉**：
       · 「守将/城主先解任」→ `prepare` 的 `GAME.marchBlockOf(gen)`（同一出口）；
       · 「目标城招募站席位」→ `prepare` 的 transfer 分支（v89.138 新增，见 battle.js）。
     如需恢复：本段代码见 `backup/v89138/domain.js`。 */

  /* ============================================================
   * 名城专属选项（v60 · 需求 5）
   * ------------------------------------------------------------
   * 老板：「设计一些名城专有的资源、优势，或者选项」——这一层是**选项**：
   * 只有名城（聚落及以上）才有的额外操作，与"档位优势"（CITY_PERK，被动加成）
   * 和"辖区特产岁贡"（专有资源）互补。
   *
   * 冷却按**游戏日**（与每日产出同一把尺子），代价从**本城**库存扣 ——
   * 资源归属城池以后，"在 B 城征调却扣 A 城的粮"是不允许出现的。
   * 数据源 DATA.CITY_OPTS：加一条新选项 = 加一行数据（不动业务代码）。
   * ============================================================ */
  GAME.cityOptsOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return [];
    return (DATA.CITY_OPTS || []).filter(function (o) {
      return (o.minType || []).indexOf(city.type) >= 0;
    });
  };
  /* 距可用的剩余天数（0 = 现在就能用） */
  GAME.cityOptCdLeft = function (city, opt) {
    if (!city || !opt) return 0;
    var day = GAME.questDayIndex();
    var last = (city.optDay || {})[opt.id];
    if (last == null) return 0;
    return Math.max(0, (opt.cdDays || 1) - (day - last));
  };
  GAME.doCityOpt = function (cityId, optId) {
    var s = GAME.state;
    var city = GAME.cityById(cityId) || GAME.currentCity();
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    var opt = null;
    (DATA.CITY_OPTS || []).forEach(function (o) { if (o.id === optId) opt = o; });
    if (!opt) return { ok: false, msg: '没有这项操作' };
    if ((opt.minType || []).indexOf(city.type) < 0) return { ok: false, msg: city.name + '不可' + opt.name };
    var cdLeft = GAME.cityOptCdLeft(city, opt);
    if (cdLeft > 0) return { ok: false, msg: opt.name + ' 尚需 ' + cdLeft + ' 日方可再用' };
    var R = GAME.res(city), k;
    for (k in (opt.cost || {})) {
      if ((R[k] || 0) < opt.cost[k]) {
        return { ok: false, msg: GAME.resName(k) + '不足（需 ' + U.fmt(opt.cost[k]) + '）' };
      }
    }
    for (k in (opt.cost || {})) R[k] = (R[k] || 0) - opt.cost[k];
    var lv = GAME.buildingLevel(city, 'guanfu') || city.level || 1;
    var gain = '';
    if (optId === 'levy') {
      /* 征调：按政务厅等级复利给一笔物资（与 NPC 城库存同一套"等级 → 量"的口径） */
      var amt = Math.round(3000 * Math.pow(1.5, lv - 1) * (1 + GAME.perkNum(city, 'prodPct')));
      ['grain', 'wood', 'stone', 'iron'].forEach(function (kk) { R[kk] = (R[kk] || 0) + amt; });
      gain = '粮木石铁各 +' + U.fmt(amt);
    } else if (optId === 'fest') {
      GAME.heartsComfortAdd(8);      /* v89.177：民心 +8 走安抚通道 */
      var g = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;
      if (g) g.loyalty = Math.min(100, (g.loyalty == null ? 70 : g.loyalty) + 5);
      gain = '民心 +8' + (g ? '，守将 ' + g.name + ' 忠诚 +5' : '');
    } else if (optId === 'summon') {
      city.def = (city.def || 0) + 3;
      gain = '城防 +3（现 ' + GAME.cityDefense(city) + '）';
    } else {
      gain = '已执行';
    }
    city.optDay = city.optDay || {};
    city.optDay[optId] = GAME.questDayIndex();
    var msg = opt.name + '（' + city.name + '）：' + gain;
    GAME.log('🏛 ' + msg);
    return { ok: true, msg: msg };
  };
  /* ⛔ v89.136 移除：**练兵场练兵**全组 —— 老板第 4 条「不要练兵 · 练兵场这个菜单和演武和阅兵，
     相应功能去除」。退役清单：
       · 域：`GAME.xcCfg / xcDay / xcSparCostOf / xcSparDoneToday / xcReviewDoneToday /
         xcSpar / xcReview`（本段整组）；
       · 界面：`ui.trainBlockHTML`（练兵块 · 墓碑见 ui.js）；
       · 动作：`case 'xc-spar' / 'xc-review' / 'xc-gen-pick'`（墓碑见 main.js）；
       · 数据：`DATA.XIAOCHANG`（墓碑见 data.js）。
     历史存档里的 `s.xcDay`（每日次数）不再被读 —— 无害残留，不做迁移（无消费点）。 */
  /* 训练进度（城） */
  /* 科技进度 */

  /* ============================================================
   * 基因实验室（v73 · 老板需求 3；v89.224 去播种化）：旧世实验室 —— 立项研发，收材料与血清
   * ------------------------------------------------------------
   * 链条（v89.224 · 老板 2：「不要播种 / 种子」）：
   *   立项（不消耗道具）→ 游戏时间研发 → 提取产物
   *      ├─ 材料研发 → 3 阶主产（有机率出 4 阶）→ 锻造间高阶打造
   *      └─ 基因调试 → 激活 / 蜕变 / 觉醒 / 天启血清 → 资质逐档提升
   * 数据全在 DATA.FARM（加项目 = 加一行）；研发吃**游戏时间**：
   * 与建造 / 研究同一把尺 —— 在线主循环与离线补算各推一次（tickFarm），
   * 调时间倍率、挂机离线都有效，不需要另起一套计时。
   * 存档：s.farm 懒初始化（旧档缺失即补），不动 SAVE_VERSION。
   * ⚠ 内部函数名沿用 farm*（历史 id 不动，语义 = 研发项目）。
   * ============================================================ */
  GAME.farmOf = function () {
    var s = GAME.state;
    if (!s.farm) s.farm = { plots: [] };
    var n = (DATA.FARM && DATA.FARM.plots) || 6;
    while (s.farm.plots.length < n) s.farm.plots.push(null);
    return s.farm;
  };
  GAME.farmCrop = function (id) { return (DATA.FARM_CROP_BY_ID || {})[id] || null; };
  /* 单块地状态：empty / growing / ripe（left = 剩余游戏秒） */
  GAME.farmPlotState = function (idx) {
    var f = GAME.farmOf(), p = f.plots[idx];
    if (!p) return { state: 'empty' };
    var total = p.totalTime || 0;
    var left = Math.max(0, total - (p.elapsed || 0));
    return {
      state: left <= 0 ? 'ripe' : 'growing',
      crop: GAME.farmCrop(p.crop), left: left,
      pct: total ? Math.min(100, Math.floor((p.elapsed || 0) / total * 100)) : 100,
    };
  };
  /* 立项 = 直接开工（v89.224 · 老板 2：「不要播种 / 种子」）——
     不消耗任何道具；种子 / 掉落 / 货架三条链已整条删除（老档种子由 adoptState 清出）。 */
  GAME.farmPlant = function (idx, cropId) {
    var f = GAME.farmOf();
    var c = GAME.farmCrop(cropId);
    if (!c) return { ok: false, msg: '未知项目' };
    if (idx < 0 || idx >= f.plots.length) return { ok: false, msg: '培养舱不存在' };
    if (f.plots[idx]) return { ok: false, msg: '这座培养舱还占着' };
    f.plots[idx] = { crop: cropId, elapsed: 0, totalTime: Math.round(c.hours * 3600) };
    GAME.log('🧬 立项研发：' + c.name);
    return { ok: true, msg: '已立项 \u300c' + c.name + '\u300d' };
  };
  /* 生长推进（在线主循环 / 离线补算共用；secGame = 游戏秒） */
  GAME.tickFarm = function (secGame) {
    var s = GAME.state;
    if (!s || !s.farm || !s.farm.plots) return;
    s.farm.plots.forEach(function (p) {
      if (p && p.elapsed < p.totalTime) p.elapsed = Math.min(p.totalTime, p.elapsed + secGame);
    });
  };
  /* ⛔ v89.224：GAME.grantSeedDrop 退役（种子体系删除）——
     采集归来 / 出征缴获两条调用点一并撤除；播种改「立项」后不再需要种子。 */
  /* v89.51（老板「物品的产生和消耗路径打通」）：辐能核心掉落 —— **唯一出口**。
     与 BOOST_DROP 同构（表在 DATA.ESSENCE_DROP，调平衡只改数据）。
     背景：辐能核心的消耗口（调校基因强化件）一直通，但产出原先只挂在
     野地「荒野行动」上 —— 探索剥离后就成了"有消耗、无产出"的死水。
     现改道到采集归来 / 出征缴获两条常驻渠道。返回 [名称×n…]（供结算文案拼接）。 */
  GAME.grantEssenceDrop = function (sourceLv, mult, label) {
    var tbl = DATA.ESSENCE_DROP;
    var s = GAME.state;
    if (!tbl || !s) return [];
    var lv = Math.max(1, Math.min(10, Math.round(sourceLv || 1)));
    var m = (mult == null ? 1 : mult);
    if (Math.random() >= (tbl.base + tbl.perLv * lv) * m) return [];
    var n = U.randInt(Math.random, tbl.qty[0], tbl.qty[1]);
    if (n <= 0) return [];
    s.items = s.items || {};
    s.items.lingsui = (s.items.lingsui || 0) + n;
    var got = ['辐能核心×' + n];
    if (label) GAME.log(label + '：' + got.join('、'));
    return got;
  };
  /* v89.179c（老板「高阶加速宝物移出游商，改采集/战役掉落」）：高阶加速道具掉落 ——
     **唯一出口**（与 grantEssenceDrop 同构，表在 DATA.BOOST_DROP）。
     采集归来（mult=1）为主渠道、出征缴获（mult=battleMult）为次渠道；调平衡只改数据表。
     注意：只掷 DATA.BOOST_DROP.table 里的 id，这些 id 已在 ITEMS 标 dropOnly（下架游商但可掉）。 */
  /* v89.179c（老板②B闸 · 周期配额）：高阶加速宝物的**现实日**配额。
     与 `GAME.autoMarchRollDay` 同一把尺子（现实日节流才是防刷；游戏日在 600× 下形同虚设）。 */
  GAME.boostDropRollDay = function () {
    var s = GAME.state;
    if (!s) return null;
    s.boostDrop = s.boostDrop || { key: '', count: 0 };
    var key = String(Math.floor(U.now() / 86400000));
    if (s.boostDrop.key !== key) { s.boostDrop.key = key; s.boostDrop.count = 0; }
    return s.boostDrop;
  };
  /* 今日还能掉几件（Infinity = 不限）。0 时 grantBoostDrop 直接空手而归。 */
  GAME.boostDropLeft = function () {
    var q = ((DATA.BOOST_DROP || {}).quota || {}).perRealDay || 0;
    if (q <= 0) return Infinity;
    var st = GAME.boostDropRollDay();
    if (!st) return q;
    return Math.max(0, q - (st.count || 0));
  };
  GAME.grantBoostDrop = function (sourceLv, mult, label) {
    var tbl = DATA.BOOST_DROP;
    var s = GAME.state;
    if (!tbl || !s || !tbl.table) return [];
    s.items = s.items || {};
    var left = GAME.boostDropLeft();                     /* 周期配额（现实日） */
    if (left <= 0) return [];
    var lv = Math.max(1, Math.min(10, Math.round(sourceLv || 1)));
    var m = (mult == null ? 1 : mult);
    var got = [], granted = 0;
    tbl.table.forEach(function (row) {
      if (granted >= left) return;                       /* 配额用满即停（已得的保留） */
      if (lv < row.minLv) return;
      if (Math.random() >= (row.base + row.perLv * lv) * m) return;
      var n = U.randInt(Math.random, row.qty[0], row.qty[1]);
      n = Math.min(n, left - granted);                   /* 单行多件也不许溢出配额 */
      if (n <= 0) return;
      s.items[row.id] = (s.items[row.id] || 0) + n;
      got.push(row.name + '×' + n);
      granted += n;
    });
    if (granted > 0) {
      var st = GAME.boostDropRollDay();
      st.count = (st.count || 0) + granted;
      var leftAfter = GAME.boostDropLeft();
      if (label) GAME.log(label + '：' + got.join('、')
        + (leftAfter === Infinity ? '' : '（今日剩余 ' + leftAfter + ' 件）'));
    }
    return got;
  };
  /* 材料 / 道具名（材料在 MATERIAL_BY_ID、血清在 ITEMS，两表各查一次） */
  function farmItemName(id) {
    var m = DATA.MATERIAL_BY_ID[id];
    if (m) return m.name;
    var nm = id;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) nm = x.name; });
    return nm;
  }
  /* 提取：研发完成才给 —— 材料项目 = 3 阶主产 ×区间 + 4 阶副产（几率）；基因项目 = 血清 ×1 */
  GAME.farmHarvest = function (idx) {
    var s = GAME.state, f = GAME.farmOf();
    var st = GAME.farmPlotState(idx);
    if (st.state === 'empty') return { ok: false, msg: '这座培养舱空着' };
    if (st.state !== 'ripe') {
      return { ok: false, msg: st.crop.name + ' 还差 ' + U.durExact(st.left / GAME.timeScale()) + ' 完成' };
    }
    var c = st.crop, items = s.items = s.items || {};
    var got = [];
    if (c.herb) {
      items[c.herb] = (items[c.herb] || 0) + 1;
      got.push(farmItemName(c.herb) + ' ×1');
    } else {
      var q = U.randInt(Math.random, c.qty[0], c.qty[1]);
      items[c.mat] = (items[c.mat] || 0) + q;
      got.push(farmItemName(c.mat) + ' ×' + q);
      if (c.rare && Math.random() < (c.rareP || 0.15)) {
        items[c.rare] = (items[c.rare] || 0) + 1;
        got.push(farmItemName(c.rare) + ' ×1');
      }
    }
    f.plots[idx] = null;
    var txt = got.join('、');
    GAME.log('🧪 产物提取：' + c.name + ' → ' + txt);
    return { ok: true, msg: '提取 ' + txt };
  };
  /* 一键提取：把完成的全提了（面板里的快捷按钮） */
  GAME.farmHarvestAll = function () {
    var f = GAME.farmOf(), got = [], any = false;
    for (var i = 0; i < f.plots.length; i++) {
      if (GAME.farmPlotState(i).state !== 'ripe') continue;
      var r = GAME.farmHarvest(i);
      if (r.ok) { any = true; got.push(r.msg.replace(/^提取 /, '')); }
    }
    if (!any) return { ok: false, msg: '没有可提取的产物' };
    return { ok: true, msg: '提取 ' + got.join('、') };
  };

  /* ============================================================
   * 派系系统（v89.74 · P0）
   * ------------------------------------------------------------
   * 数据模型 `s.sect = { id, rep, founder, tasks:{'day':n}, leftAt }`：
   *   · **读出口带兜底**（GAME.sectState）→ 老档不需要迁移脚本
   *     （与君主 breaks/cultiv 同一套办法，见 v89.65 的取舍）；
   *   · 写入只有下面这几个函数，别处不许直接改 `s.sect` 字段；
   *   · 派系声望与君主声望**分家**：这里只碰 `sect.rep`，`s.rep` 一个字都不动。
   * P0 零平衡影响：不给任何战斗/产量加成（那是 P1），所以没有"写进去不生效"的死数值。
   * 门槛/费用/任务全部读 DATA（SECT_JOIN / SECT_FOUND / SECT_LEAVE / SECT_TASKS）。
   * ============================================================ */
  GAME.sectState = function () {
    var s = GAME.state;
    if (!s) return { id: null, rep: 0, founder: false, tasks: {}, leftAt: 0 };
    if (!s.sect) s.sect = { id: null, rep: 0, founder: false, tasks: {}, leftAt: 0 };
    var t = s.sect;
    if (t.id === undefined) t.id = null;
    if (t.rep == null) t.rep = 0;
    if (t.founder == null) t.founder = false;
    if (!t.tasks) t.tasks = {};
    if (t.leftAt == null) t.leftAt = 0;
    return t;
  };
  GAME.sectOf = function () {
    var st = GAME.sectState();
    return st.id ? (DATA.SECT_BY_ID[st.id] || null) : null;
  };
  /* v89.86（派系 P1 · 老板拍板实装）：派系被动加成 —— **唯一出口**（界面只读它，消费点只调它）。
     加成全部落在既有消费链上（不新增战斗公式/资源类型）：
       marchPct  行军速度      → GAME.march.speedFactor
       atkPct    部队攻击      → battle 伤害链 atkMult（与科技/宝物/羁绊相乘）
       siegePct  攻城伤害      → battle siegeMult（仅攻城）
       woundPct  战后伤兵回复  → battle.returnArmy 的回收率
       craftCut  器械打造耗时  → GAME.train（仅 craft 器械）
       mountPct  座驾装备属性  → systems 装备汇总（与机修技巧同链相乘）
     无派系 / 无该键 → 0 —— 无派系时各链与今日**逐字节一致**（关键回归判据）。 */
  GAME.sectBonus = function (key) {
    var sc = GAME.sectOf();
    var t = sc && sc.trait;
    if (!t || !key || t.key !== key) return 0;
    return t.val || 0;
  };
  /* 派系被动文案（派系面板读取；别处不要再拼一遍） */
  GAME.sectTraitText = function (sc) {
    sc = sc || GAME.sectOf();
    return (sc && sc.trait && sc.trait.text) || '—';
  };
  /* 品阶**不存档、由声望实时推**（拍板："品阶不存档"）——
     免得出现"存档写着掌门、声望却不够"的自相矛盾。 */
  GAME.sectRankIndex = function () {
    var st = GAME.sectState(), R = DATA.SECT_RANKS || [], n = 0;
    for (var i = 0; i < R.length; i++) if (st.rep >= R[i].rep) n = i;
    return n;
  };
  GAME.sectRankOf = function () { return (DATA.SECT_RANKS || [])[GAME.sectRankIndex()] || null; };
  GAME.sectNextRankOf = function () { return (DATA.SECT_RANKS || [])[GAME.sectRankIndex() + 1] || null; };
  /* 当前城池的派系驻地等级（0 = 未建）。入口条件全都读它，别处不要自己查建筑。 */
  GAME.sectBldLv = function () {
    var c = GAME.currentCity();
    return c ? (GAME.buildingLevel(c, 'honglusi') || 0) : 0;
  };
  GAME.sectTaskLeftToday = function () {
    var st = GAME.sectState(), day = GAME.questDayIndex();
    return Math.max(0, (DATA.SECT_TASK_PER_DAY || 0) - (st.tasks[day] || 0));
  };
  /* 派系费用文案：**不走** `GAME.costString` —— 那个出口挂在 ui 层
     （`GAME.costString = ui.costString`），而冒烟测试不加载 ui.js，
     走它会在无 ui 环境下 undefined。与 domain.js:3510 的取舍一致。 */
  function sectCostText(cost) {
    var parts = [];
    for (var k in (cost || {})) {
      if (k === 'time') continue;
      parts.push((GAME.resName ? GAME.resName(k) : k) + ' ' + U.fmt(cost[k]));
    }
    return parts.length ? parts.join('　') : '无偿';
  }
  /* 入口体检：UI 与内核共用这一份（"两个出口"是本项目最经典的失效模式） */
  GAME.sectChk = function () {
    var st = GAME.sectState(), lv = GAME.sectBldLv();
    if (lv <= 0) return { ok: false, msg: '本城尚未建造派系驻地' };
    if (st.id) return { ok: false, msg: '你已身属' + ((GAME.sectOf() || {}).name || '派系') + '，须先退派' };
    var cd = GAME.sectLeaveCd();
    if (cd > 0) return { ok: false, msg: '退派未满 ' + DATA.SECT_LEAVE.cooldownDay + ' 日（余 ' + cd + ' 日）' };
    return { ok: true, lv: lv };
  };
  /* 退派冷却余日（0 = 可入派） */
  GAME.sectLeaveCd = function () {
    var st = GAME.sectState();
    if (!st.leftAt) return 0;
    var pass = GAME.questDayIndex() - st.leftAt;
    return Math.max(0, (DATA.SECT_LEAVE.cooldownDay || 0) - pass);
  };
  GAME.doSectJoin = function (id) {
    var sc = DATA.SECT_BY_ID[id];
    if (!sc) return { ok: false, msg: '没有这个派系' };
    var chk = GAME.sectChk();
    if (!chk.ok) return chk;
    if (chk.lv < (DATA.SECT_JOIN.bldLv || 1)) {
      return { ok: false, msg: '派系驻地需 Lv' + DATA.SECT_JOIN.bldLv + '（现 Lv' + chk.lv + '）' };
    }
    var st = GAME.sectState();
    st.id = sc.id; st.rep = 0; st.founder = false;
    GAME.log('入' + sc.name + '为' + (DATA.SECT_RANKS[0] || {}).name + '。');
    return { ok: true, msg: '已入' + sc.name + '（门中品阶：' + (GAME.sectRankOf() || {}).name + '）', sect: sc };
  };
  GAME.doSectFound = function (id) {
    var sc = DATA.SECT_BY_ID[id];
    if (!sc) return { ok: false, msg: '没有这个派系' };
    var chk = GAME.sectChk();
    if (!chk.ok) return chk;
    var F = DATA.SECT_FOUND;
    if (chk.lv < (F.bldLv || 1)) {
      return { ok: false, msg: '立派须派系驻地 Lv' + F.bldLv + '（现 Lv' + chk.lv + '）' };
    }
    if (!GAME.canAfford(F.cost)) return { ok: false, msg: '立派本钱不足（' + sectCostText(F.cost) + '）' };
    GAME.payCost(F.cost);
    var st = GAME.sectState();
    st.id = sc.id; st.rep = 0; st.founder = true;
    GAME.log('⚔️ 开山立派：' + sc.name + '（开山祖师）。');
    return { ok: true, msg: '已开' + sc.name + '，你是开山祖师（任务声望 ×1.5）', sect: sc };
  };
  GAME.doSectLeave = function () {
    var st = GAME.sectState();
    var sc = GAME.sectOf();
    if (!sc) return { ok: false, msg: '你尚未入派' };
    st.id = null; st.rep = 0; st.founder = false; st.leftAt = GAME.questDayIndex();
    GAME.log('退出' + sc.name + '（声望清零，' + DATA.SECT_LEAVE.cooldownDay + ' 日内不可再入派）。');
    return { ok: true, msg: '已退出' + sc.name + '：声望清零，' + DATA.SECT_LEAVE.cooldownDay + ' 日内不可再入派' };
  };
  /* v89.89（老板拍板 · C3）：派系声望**唯一发放出口** ——
     派系系统规则 §六："声望来源（全部走 sectRepGain，逐条给权重，便于审计）"。
     来源标识 src：'task'（派系任务）/ 'conquer'（开疆拓土）……
     返回 { ok, gain, rankUp }：rankUp = 本次跨过新阶门槛时的品阶名（无则 null）。
     未入派一律不给（没有派系，哪来派系声望）。 */
  GAME.sectRepGain = function (src, n) {
    var st = GAME.sectState();
    n = Math.max(0, Math.round(Number(n) || 0));
    if (!st.id || !n) return { ok: false, gain: 0, rankUp: null };
    var before = GAME.sectRankIndex();
    st.rep += n;
    var after = GAME.sectRankIndex();
    return {
      ok: true, gain: n,
      rankUp: (after > before) ? ((DATA.SECT_RANKS || [])[after] || {}).name : null,
    };
  };

  GAME.doSectTask = function (tid) {
    var st = GAME.sectState(), sc = GAME.sectOf();
    if (!sc) return { ok: false, msg: '须先入派或立派' };
    var def = null;
    (DATA.SECT_TASKS || []).forEach(function (x) { if (x.id === tid) def = x; });
    if (!def) return { ok: false, msg: '没有这项派系任务' };
    if (GAME.sectTaskLeftToday() <= 0) {
      return { ok: false, msg: '今日派系任务已满 ' + DATA.SECT_TASK_PER_DAY + ' 件，明日再来' };
    }
    if (!GAME.canAfford(def.cost)) return { ok: false, msg: '不敷所费（' + sectCostText(def.cost) + '）' };
    GAME.payCost(def.cost);
    /* 开山祖师：任务声望 ×1.5（拍板里"立派"与"入派"的唯一实质差别，P0 只此一项） */
    var gain = st.founder ? Math.round(def.rep * 1.5) : def.rep;
    var day = GAME.questDayIndex();
    /* v89.89（C3）：声望发放与晋升检测统一走 sectRepGain（与占城同一出口） */
    var g = GAME.sectRepGain('task', gain);
    st.tasks[day] = (st.tasks[day] || 0) + 1;
    var up = g.rankUp ? '　🎉 晋升「' + g.rankUp + '」' : '';
    return { ok: true, msg: def.name + '　声望 +' + gain + '（共 ' + U.fmt(st.rep) + '）' + up, rep: gain };
  };

  /* v89.86（整改 P-21）：派系任务**连做**入口 —— 复用单次出口逐次调用，
     停止条件三重：次数用尽（n）/ 日额用尽 / 资源不够（以实际结算为准，不预检保证口径一致）。
     n <= 0 视为「一键做完」= 按当前剩余日额。 */
  GAME.doSectTaskBulk = function (tid, n) {
    var left0 = GAME.sectTaskLeftToday();
    var max = (Number(n) > 0) ? Math.min(Math.floor(Number(n)), left0) : left0;
    if (max <= 0) return { ok: false, count: 0, rep: 0, msg: '今日派系任务已满 ' + DATA.SECT_TASK_PER_DAY + ' 件，明日再来' };
    var done = 0, rep = 0, stopReason = '', promo = '';
    for (var i = 0; i < max; i++) {
      var r = GAME.doSectTask(tid);
      if (!r.ok) { stopReason = r.msg; break; }
      done++; rep += (r.rep || 0);
      if (r.msg.indexOf('晋升') >= 0) {
        var pm = r.msg.match(/🎉\s*晋升「([^」]+)」/);
        if (pm) promo = '🎉 晋升「' + pm[1] + '」';
      }
    }
    var def = null;
    (DATA.SECT_TASKS || []).forEach(function (x) { if (x.id === tid) def = x; });
    var name = def ? def.name : tid;
    if (!done) return { ok: false, count: 0, rep: 0, msg: stopReason || '未能完成' };
    return { ok: true, count: done, rep: rep, stopped: !!stopReason, stopReason: stopReason,
      msg: name + ' ×' + done + '　声望 +' + rep
        + (promo ? '　' + promo : '')
        + (stopReason ? '（' + stopReason + '）' : '') };
  };

})();
