/* ============================================================
 * systems.js  四大玩法系统：科技研究 / 装备穿戴 / 宝物使用 / 爵位晋升
 * 挂到 window.GAME.systems
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  var S = GAME.systems = {};

  /* ============================================================
   * 科技研究（书院 · 23项）
   * ============================================================ */
  /* ============================================================
   * v89.191（老板 3-④）：**科技按城** —— 读点的唯一入口。
   * ------------------------------------------------------------
   * · 传 city → 读那座城的科技（经济/建造/征兵/研究全走这条）；
   * · 不传 → **当前城**（界面与旧调用点的兼容默认）；
   * · `S._techCtx` 优先（战斗窗口）：出征/守城结算与沙盘重跑期间，
   *   boostSnapshot 把"那一战那座城"的科技表钉进上下文 —— 史实与重跑同源
   *   （沿用 v89.118 快照机制，快照内容从"全境表"换成"该城表"）。
   * ============================================================ */
  S._techCtx = null;
  S.techLevel = function (id, city) {
    var s = GAME.state;
    if (S._techCtx) return S._techCtx[id] || 0;
    var ct = city || GAME.currentCity() || (s && s.cities && s.cities[0]);
    return (ct && ct.techs && ct.techs[id]) || 0;
  };

  S.techInfo = function (id) {
    for (var i = 0; i < DATA.TECH.length; i++) if (DATA.TECH[i].id === id) return DATA.TECH[i];
    return null;
  };

  /* 当前研究中的科技 */
  S.researching = function () {
    var s = GAME.state;
    return (s.queues.tech && s.queues.tech.length) ? s.queues.tech[0] : null;
  };

  S.canResearch = function (techId, cityId) {
    var s = GAME.state, t = S.techInfo(techId);
    if (!t) return { ok: false, msg: '未知科技' };
    if (S.researching()) return { ok: false, msg: '书院正在研究其他科技' };
    var city = (cityId ? GAME.cityById(cityId) : null) || GAME.currentCity() || s.cities[0];
    var shuyuanLv = GAME.buildingLevel(city, 'shuyuan');
    if (shuyuanLv < t.lv) return { ok: false, msg: '需要书院 Lv' + t.lv };
    /* v89.191（老板 3-③）：**建筑不达标则无法研究** —— 科技可带 req（建筑 → 等级）。 */
    var req = t.req || {};
    for (var rk in req) {
      var rl = GAME.buildingLevel(city, rk);
      if (rl < req[rk]) {
        return { ok: false, msg: '需先建「' + ((DATA.BUILDINGS[rk] || {}).name || rk) + '」至 Lv' + req[rk]
          + '（本城现 Lv' + rl + '）—— 建筑与书院科技互为条件' };
      }
    }
    var cur = S.techLevel(techId, city);
    /* v89.81：上限唯一出口；v89.191（老板 3-④）：**按城** —— 主城 20、别城 10
       （GAME.techCapOf；仓库容量"满配"口径仍读 DATA.TECH_MAX_LV，互不影响）。 */
    var cap = GAME.techCapOf ? GAME.techCapOf(city) : (DATA.TECH_MAX_LV || 10);
    if (cur >= cap) {
      return { ok: false, msg: cap > (DATA.TECH_MAX_LV || 10) ? ('已满级（主城上限 Lv' + cap + '）') : '已满级' };
    }
    var cost = DATA.techCost(t, cur + 1);
    /* v89.191：研究费按**发起城**记账（§75.1 的"这笔账属于谁"）—— 与建造/募兵同规。 */
    var okAfford = GAME.canAffordIn ? GAME.canAffordIn(city, cost) : GAME.canAfford(cost);
    if (!okAfford) return { ok: false, msg: '资源不足' };
    return { ok: true };
  };

  /* ============================================================
   * 批量使用（v28 · 需求 6）
   * ------------------------------------------------------------
   * 一次用 N 个。三个必须处理的点：
   *   ① 逐次调用 useItem，**遇到"已达上限"就停** —— 丹药每将最多 50 点、
   *      体力上限 100，硬用只会白烧（玩家不会想为这个买单）。
   *   ② 保留最后一次失败的原因，用于提示"为什么没用到 N 个"。
   *   ③ 批量时传 silent，只在整批结束后写**一条**公文 ——
   *      否则一次用 20 个会把公文页刷满、把真正的战报挤下去。
   * ============================================================ */
  S.useItemMany = function (itemId, targetGenId, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var s = GAME.state, item = S.itemInfo(itemId);
    if (!item) return { ok: false, msg: '未知宝物' };
    if (!s.items[itemId]) return { ok: false, msg: '背包中没有该宝物' };
    var got = 0, last = null;
    for (var i = 0; i < qty; i++) {
      if (!s.items[itemId] || s.items[itemId] <= 0) break;
      var r = S.useItem(itemId, targetGenId, { silent: true });
      if (!r.ok) { last = r; break; }
      got++;
    }
    if (!got) return last || { ok: false, msg: '未能使用「' + item.name + '」' };
    GAME.log('使用宝物：' + item.name + (got > 1 ? ' ×' + got : ''));
    var tail = (last && last.msg) ? '（未用完：' + last.msg + '）' : '';
    return { ok: true, msg: '「' + item.name + '」×' + got + ' 已使用' + tail, count: got };
  };

  /* 研究技巧（v63 · 老板：「守将属性只对当前城池起加成作用」）：
     研究由**某城的书院**发起，所以智谋加速取**发起城**的守将（不传则按当前城）。
     研究本身仍是全境科技（`s.queues.tech` 无 cityId、全境共享）——
     但"加成从哪来"必须能指到一座城，否则又变成全境加成。 */
  S.research = function (techId, cityId) {
    var s = GAME.state, t = S.techInfo(techId);
    var chk = S.canResearch(techId, cityId);
    if (!chk.ok) return chk;
    /* v89.191（老板 3-④）：研究按**发起城**记账与计数 —— 等级读该城、费用扣该城，
       队列条目带 cityId（完成时写回该城）。 */
    var city = (cityId ? GAME.cityById(cityId) : null) || GAME.currentCity();
    var cur = S.techLevel(techId, city);
    var cost = DATA.techCost(t, cur + 1);
    if (GAME.payCostIn) GAME.payCostIn(city, cost); else GAME.payCost(cost);
    var time = Math.round(60 * Math.pow(2, cur) * (1 - S.studyMult(city))); // 游戏秒
    /* v28（需求 1）：书院满级专精 —— 研究速度 +25% */
    var _mt = GAME.mastery ? GAME.mastery('techPct', null) : 0;
    if (_mt > 0) time = Math.round(time / (1 + _mt));
    if (GAME.story) time = Math.round(time / GAME.story.researchMult()); // 名将羁绊/年号加速
    /* v89.113（老板需求 3）：研究加速走**城主**智谋（守将不再管研究） */
    if (GAME.mayorBonus) {
      var _gcity = (cityId ? GAME.cityById(cityId) : null) || GAME.currentCity();
      var _mb = GAME.mayorBonus(_gcity);
      /* v89.164：曲线自带边界，二次截断（旧 min 1.5）退役 */
      if (_mb.research) time = Math.round(time / (1 + _mb.research)); // 城主智谋：研究加速
    }
    s.queues.tech.push({ techId: techId, cityId: city ? city.id : null,
      elapsed: 0, totalTime: Math.max(5, time) });
    return { ok: true, msg: '开始研究 ' + t.name };
  };

  /* 研究技巧：-5%/级（v89.191：按**发起城**的科技读） */
  S.studyMult = function (city) {
    return Math.min(0.6, S.techLevel('yanjiu', city) * 0.05);
  };

  /* 科技累计加成查询（供战斗/生产/建造调用） */
  S.techBonus = function (type, city) {
    var sum = 0;
    DATA.TECH.forEach(function (t) {
      if (t.type !== type) return;
      sum += S.techLevel(t.id, city) * (t.per || 0);
    });
    return sum;
  };

  /* ============================================================
   * 装备（16槽位 · 套装）
   * ============================================================ */
  /* ============================================================
   * v88 · 双轨装备（老板「修炼型装备系统」）
   * ------------------------------------------------------------
   * 「当前生效套」由 g.equipOn 决定（'sha' 军装 / 'ling' 修炼，缺省 sha）。
   * equipBagOf 是**唯一分流出口**：genEquipBonus / genSetBonus / setProgressOf /
   * 穿脱 / 一键最优 / 全部卸下全部读它 —— 切换只需改这一个键，
   * 六维（genAttrs）、体力上限（staMax）、战斗换算与界面显示自动同步。
   * ============================================================ */
  S.equipBagOf = function (g) {
    if (!g) return {};
    /* v89：非君主恒军装（修炼线君主专属 —— 闸门唯一，见 GAME.canCultivate） */
    return ((g.equipOn === 'ling' && GAME.canCultivate(g)) ? g.lingEquip : g.equip) || {};
  };

  /* 某将装备总加成（按**当前生效套**；v88 双轨分流） */
  S.genEquipBonus = function (g) {
    /* v52：**加上 sta（体力）** —— 老板：「体力都没加上套装的体力」。
       改前这个返回对象里没有 sta，也不读 item.sta，而 staMax() 只由
       「基础 + 等级×资质 + 内政」派生 → 装备与套装写多少体力都无处生效（静默丢弃）。
       这是一条"数据里有、消费点缺"的断链，属于本项目最典型的失效模式。 */
    var b = { tong: 0, nz: 0, yw: 0, zm: 0, atk: 0, def: 0, spd: 0, sta: 0 };
    if (!g) return b;
    /* v88：读**当前生效套**（双轨分流的唯一出口；修炼侧 75% 量级写在数据里） */
    var bag = S.equipBagOf(g);
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    /* 驯马技巧：坐骑装备属性 +5%/级（仅军装侧 —— 修炼装备独立体系不吃它）
       v89.86（门派 P1）：牧云庄「坐骑装备属性 +20%」并入同一条乘链（唯一出口 sectBonus） */
    var horseMul = (1 + S.techBonus('horse')) * (1 + (GAME.sectBonus ? GAME.sectBonus('mountPct') : 0));
    for (var slot in bag) {
      var inst = bag[slot];
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!item) continue;
      var mul = (slot === 'mount' && !isLing) ? horseMul : 1;
      /* v79 · 百炼强化改**按件**：读这一件自己的 inst.enh（同名各件互不影响）。
         乘在「装备本身」这一层（套装加成不参与强化）。
         v89.211：乘数收敛到 GAME.eqEnhMulOf（唯一出口）—— 展示 equipDescOf 与评分
         equipScore 读同一份；改前只在这里现写一份、展示侧读原值（"强化了数字没动"）。 */
      mul *= (GAME.eqEnhMulOf ? GAME.eqEnhMulOf(inst) : 1);
      b.tong += (item.tong || 0) * mul; b.nz += (item.nz || 0) * mul;
      b.yw += (item.yw || 0) * mul; b.zm += (item.zm || 0) * mul;
      b.atk += (item.atk || 0) * mul; b.def += (item.def || 0) * mul;
      b.spd += (item.spd || 0) * mul;
      b.sta += (item.sta || 0) * mul;
    }
    /* 套装加成 */
    var setBonus = S.genSetBonus(g);
    for (var k in setBonus) b[k] += setBonus[k];
    return b;
  };

  /* 套装计数与加成 */
  S.genSetBonus = function (g) {
    var out = {};
    if (!g) return out;
    var bag = S.equipBagOf(g);   /* v88：按当前生效套（修炼装备 MVP 无套装，自动为空） */
    var counts = {};
    for (var slot in bag) {
      var item = DATA.EQUIP[GAME.eqId ? GAME.eqId(bag[slot]) : bag[slot]];
      if (item && item.set) counts[item.set] = (counts[item.set] || 0) + 1;
    }
    for (var set in counts) {
      var def = DATA.SETS[set];
      if (!def) continue;
      var n = counts[set];
      var keys = Object.keys(def.eff).map(Number).sort(function (a, b) { return a - b; });
      for (var i = 0; i < keys.length; i++) {
        if (n >= keys[i]) {
          var e = def.eff[keys[i]];
          for (var k in e) out[k] = (out[k] || 0) + e[k];
        }
      }
    }
    return out;
  };

  /* ============================================================
   * 套装进度（v38 · 需求 3）—— **单一来源**
   * ------------------------------------------------------------
   * 件数 / 可达上限 / 已达档 / 下一档 都由这里算，UI 与测试都读它。
   * 三处各算一遍是本项目最常见的失效模式（改一处忘一处，还不报错）。
   * ============================================================ */
  S.setPiecesOf = function (setId) {
    var n = 0;
    Object.keys(DATA.EQUIP).forEach(function (id) { if (DATA.EQUIP[id].set === setId) n++; });
    return n;
  };
  S.setProgressOf = function (g) {
    var out = [], counts = {};
    var bag = S.equipBagOf(g);   /* v88：按当前生效套 */
    for (var slot in bag) {
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(bag[slot]) : bag[slot]];
      if (it && it.set) counts[it.set] = (counts[it.set] || 0) + 1;
    }
    Object.keys(DATA.SETS).forEach(function (sk) {
      var def = DATA.SETS[sk];
      var n = counts[sk] || 0;
      var tiers = Object.keys(def.eff).map(Number).sort(function (a, b) { return a - b; });
      out.push({
        set: sk, name: def.name, n: n, total: S.setPiecesOf(sk),
        tiers: tiers, bonus: def.bonus, eff: def.eff,
        reached: tiers.filter(function (t) { return n >= t; }),
        next: tiers.filter(function (t) { return n < t; })[0] || null,
      });
    });
    return out;
  };
  GAME.setProgressOf = S.setProgressOf;
  GAME.setPiecesOf = S.setPiecesOf;

  /* v79：按**件**装备 —— ref 可以是件号 / 实例 / 装备 id（旧入口兼容） */
  S.canEquip = function (gen, ref) {
    var inst = GAME.eqFind(ref);
    if (!inst) return { ok: false, msg: '背包中没有该装备' };
    var item = DATA.EQUIP[GAME.eqId(inst)];
    if (!item) return { ok: false, msg: '未知装备' };
    if ((GAME.state.inventory || []).indexOf(inst) < 0) return { ok: false, msg: '该件不在背包' };
    /* 坐骑需马厩/马鞭等条件简化：等级不做硬约束 */
    return { ok: true, item: item, inst: inst };
  };

  S.equipItem = function (genId, ref) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var chk = S.canEquip(g, ref);
    if (!chk.ok) return chk;
    var item = chk.item, inst = chk.inst;
    /* v89：修炼装备君主专属（各处 UI 已藏入口，这里是最后一道闸） */
    if (item.ling && !GAME.canCultivate(g)) return { ok: false, msg: '修炼装备乃君主专属，' + g.name + ' 无法穿戴' };
    /* v88：按装备归属选袋 —— 修炼装备入 g.lingEquip，军装入 g.equip（各自 12 槽） */
    var bag = item.ling ? (g.lingEquip = g.lingEquip || {}) : (g.equip = g.equip || {});
    /* 同槽位旧件回背包（原物原样，强化随件走） */
    if (bag[item.slot]) s.inventory.push(bag[item.slot]);
    var idx = s.inventory.indexOf(inst);
    if (idx >= 0) s.inventory.splice(idx, 1);
    bag[item.slot] = inst;
    var label = GAME.eqLabel(inst);
    GAME.log('装备 ' + label + ' 给 ' + g.name);
    return { ok: true, msg: '已装备 ' + label };
  };

  /* 装备评分（同槽位比较优劣；套装件略有加成）
     v66：`it.hp` → `it.sta`（同一列改回源数据的名字，权重 0.2 不变）。
     v89.211（老板 1）：入参兼容**装备谱 / 实例**（对象一律按 id 查谱）；按件强化/蕴养
     计入评分 —— 改前"一键最优"会把 +10 的换下、换上 +0 的略高基础件。 */
  S.equipScore = function (x) {
    var it = (x && typeof x === 'object') ? DATA.EQUIP[GAME.eqId(x)] : x;
    if (!it) return -1;
    var v = (it.tong || 0) * 3 + (it.yw || 0) * 3 + (it.zm || 0) * 3 + (it.nz || 0) * 3
      + (it.atk || 0) + (it.def || 0) + (it.sta || 0) * 0.2 + (it.spd || 0) * 4;
    v += (it.lingv || 0) * 0.5;   /* v88：灵力计入评分（修炼侧同槽比优；军装 lingv=0 无影响） */
    if (x && typeof x === 'object') {
      /* v89.211：属性部分按件乘（六维/攻防/速/体走 eqEnhMulOf、灵力走 eqLingMulOf ——
         与结算同源）；套装档位加成 50 与强化无关（同 genEquipBonus 口径）。 */
      var _mu = (GAME.eqEnhMulOf && GAME.eqEnhMulOf(x)) || 1;
      var _ml = (GAME.eqLingMulOf && GAME.eqLingMulOf(x)) || 1;
      v = (v - (it.lingv || 0) * 0.5) * _mu + (it.lingv || 0) * 0.5 * _ml;
    }
    return v + (it.set ? 50 : 0);
  };

  /* 一键最优：逐槽位从背包中挑最强，旧件自动回背包 */
  S.autoEquipBest = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    /* v88：只作用于**当前生效套**（军装模式挑军装，修炼模式挑修炼）；
       v89：非君主恒军装 */
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var bag = isLing ? (g.lingEquip = g.lingEquip || {}) : (g.equip = g.equip || {});
    s.inventory = s.inventory || [];
    var changed = [];
    DATA.EQUIP_SLOTS.forEach(function (slot) {
      var curInst = bag[slot] || null;
      var bestInst = curInst, bestScore = S.equipScore(curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null);
      s.inventory.forEach(function (inst) {
        var it = DATA.EQUIP[GAME.eqId(inst)];
        if (!it || it.slot !== slot) return;
        if (!!it.ling !== isLing) return;   /* v88：跨套不候选 */
        var sc = S.equipScore(it);
        if (sc > bestScore) { bestScore = sc; bestInst = inst; }
      });
      if (bestInst && bestInst !== curInst) {
        if (curInst) s.inventory.push(curInst);
        var idx = s.inventory.indexOf(bestInst);
        if (idx >= 0) s.inventory.splice(idx, 1);
        bag[slot] = bestInst;
        changed.push(GAME.eqLabel(bestInst));
      }
    });
    if (!changed.length) return { ok: true, msg: '已是最优配置（无可换之件）' };
    GAME.statBump('autoEquip', 1);
    GAME.log(g.name + ' 换装：' + changed.join('、'), 'sys', 'staff');
    return { ok: true, msg: '已换装 ' + changed.length + ' 件：' + changed.join('、') };
  };

  /* 全部卸下（装备回背包） */
  S.unequipAll = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var cnt = 0;
    var bag = S.equipBagOf(g);   /* v88：只卸当前生效套 */
    for (var slot in bag) {
      s.inventory.push(bag[slot]);
      delete bag[slot];
      cnt++;
    }
    if (!cnt) return { ok: false, msg: '该将领未着装备' };
    GAME.log(g.name + ' 卸下全部装备（' + cnt + ' 件）', 'sys', 'staff');
    return { ok: true, msg: '已卸下 ' + cnt + ' 件' };
  };

  S.unequipItem = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    var bag = S.equipBagOf(g);   /* v88：按当前生效套 */
    if (!g || !bag[slot]) return { ok: false, msg: '该槽位无装备' };
    var label = GAME.eqLabel(bag[slot]);
    s.inventory.push(bag[slot]);   /* 原物原样回背包（强化随件走） */
    delete bag[slot];
    GAME.log('卸下 ' + label, 'sys', 'staff');
    return { ok: true, msg: '已卸下 ' + label };
  };

  /* ============================================================
   * 宝物使用
   * ============================================================ */
  S.itemInfo = function (id) {
    for (var i = 0; i < DATA.ITEMS.length; i++) if (DATA.ITEMS[i].id === id) return DATA.ITEMS[i];
    return null;
  };

  /* ============================================================
   * v89.100：**道具寄售**（按商城购买价 75% 回收为金）
   * ------------------------------------------------------------
   * 唯一出口组（UI / 推演脑都从这里走，别处不许另算价）：
   *   S.consignCfg()        —— 读 DATA.ITEM_SELL（rate 可调）
   *   S.consignPriceOf(id)  —— 单价（price×100×rate；无价道具返回 0）
   *   S.consignList(opts)   —— 当前可寄售清单（{keep:[id]} 可指定保留）
   *   S.consignItem(id,n)   —— 寄售 n 件（n 省略 / 0 = 全部）
   *   S.consignAll(opts)    —— 一键全部寄售
   * 语义：真金入账（与市场卖货同记账口 s.res.gold），statBump('trades')。
   * ============================================================ */
  S.consignCfg = function () { return DATA.ITEM_SELL || { rate: 0.75 }; };
  S.consignPriceOf = function (id) {
    var it = S.itemInfo(id);
    if (!it || !(it.price > 0)) return 0;
    var rate = S.consignCfg().rate;
    return Math.max(1, Math.floor(it.price * 100 * (rate == null ? 0.75 : rate)));
  };
  S.consignList = function (opts) {
    var s = GAME.state, out = [];
    if (!s || !s.items) return out;
    var keep = (opts && opts.keep) || [];
    /* v89.100b：opts.only = 类型白名单（只列这些类型）。
       "攻击获得的道具变现"应只卖掉落类（jewel/material/seed/blueprint），
       别把买来的投资品（生产/体力/加速/符/内功）也卖了 —— 首测教训。 */
    var only = (opts && opts.only) || null;
    for (var id in s.items) {
      var n = s.items[id] || 0;
      if (n <= 0 || keep.indexOf(id) >= 0) continue;
      var unit = S.consignPriceOf(id);
      if (!(unit > 0)) continue;
      var it = S.itemInfo(id);
      if (only && only.indexOf(it ? (it.type || '') : '') < 0) continue;
      out.push({ id: id, name: it ? it.name : id, type: it ? (it.type || '') : '', qty: n, unit: unit, total: unit * n });
    }
    out.sort(function (a, b) { return b.total - a.total; });
    return out;
  };
  S.consignItem = function (id, qty) {
    var s = GAME.state, item = S.itemInfo(id);
    if (!item) return { ok: false, msg: '未知道具' };
    var unit = S.consignPriceOf(id);
    if (!(unit > 0)) return { ok: false, msg: '「' + item.name + '」无购买价，不可寄售（装备请用拆解）' };
    var have = (s.items[id] || 0);
    if (have <= 0) return { ok: false, msg: '背包中没有「' + item.name + '」' };
    qty = Math.max(1, Math.min(have, Math.floor(Number(qty) || have)));
    var gold = unit * qty;
    s.items[id] = have - qty;
    if (s.items[id] <= 0) delete s.items[id];
    s.res.gold = (s.res.gold || 0) + gold;
    GAME.statBump('trades', 1);
    GAME.log('🎒 寄售「' + item.name + '」×' + qty + ' → 得金 ' + U.fmt(gold) + '（购买价 75% 回收）', 'sys', 'trade');
    return { ok: true, msg: '寄售「' + item.name + '」×' + qty + '，得金 ' + U.fmt(gold), gold: gold, n: qty };
  };
  S.consignAll = function (opts) {
    var list = S.consignList(opts), sum = 0, n = 0, cnt = 0;
    for (var i = 0; i < list.length; i++) {
      var r = S.consignItem(list[i].id, list[i].qty);
      if (r && r.ok) { sum += r.gold; n++; cnt += r.n; }
    }
    return { ok: n > 0, gold: sum, n: n, cnt: cnt,
      msg: n > 0 ? ('寄售 ' + n + ' 种 / ' + cnt + ' 件，共得金 ' + U.fmt(sum)) : '没有可寄售的道具' };
  };

  /* opts.silent：批量消耗时只在最后写一条汇总，不要每条道具刷一行日志 */
  S.useItem = function (itemId, targetGenId, opts) {
    var s = GAME.state, item = S.itemInfo(itemId);
    if (!item) return { ok: false, msg: '未知宝物' };
    if (!s.items[itemId] || s.items[itemId] <= 0) return { ok: false, msg: '背包中没有该宝物' };

    var ok = false, msg = '', gain = 0;   /* v89.171：gain 供 exp 分支回传「实得」（面额可能被上限截断） */
    if (item.type === 'jewel') {
      /* 珠宝：赏赐将领忠诚 */
      var g = S._findGen(targetGenId);
      if (!g) return { ok: false, msg: '请选择将领' };
      g.loyalty = Math.min(100, g.loyalty + (item.loyalty || 5));
      ok = true; msg = g.name + ' 忠诚 +' + (item.loyalty || 5);
    } else if (item.type === 'attr_buff') {
      var g2 = S._findGen(targetGenId);
      if (!g2) return { ok: false, msg: '请选择将领' };
      s.buffs = s.buffs || {}; s.buffs.gens = s.buffs.gens || {};
      s.buffs.gens[g2.id] = s.buffs.gens[g2.id] || {};
      /* v89.50（真 bug 修复）：**必须把 item.eff 一起存进去**。
         改前这里只写 `{ until }`，而消费端（domain.genAttrs）读的是
         `buf.tong_mult / nz_mult / yw_mult / zm_mult / spd` ——
         于是虎符、文曲星符、武曲星符、智多星符**全部空转**：
         道具扣了、公文写了、属性一点没涨（"买了没效果"的典型）。
         符类与坐骑类是同一形状（坐骑那条一直是对的，因为它显式写了 spd）。 */
      var nb = { until: U.now() + (item.dur || 24) * 3600 * 1000 };
      for (var ek in (item.eff || {})) nb[ek] = item.eff[ek];
      s.buffs.gens[g2.id][item.id] = nb;
      ok = true; msg = g2.name + ' 获得 ' + item.name + '（' + item.desc + '）';
    } else if (item.type === 'prod_buff') {
      /* v89.93（整改 W1）：**同类只取最强**（不再累加）——与军事符同口径。
         改前 `+ (item.eff)` 无上限累加：实测 110 个后稷神犁 = 粮产因子 ×134；
         且 `prodUntil` 写下后全库没有任何读取方（死字段）→ "24h" 形同虚设。
         现在：取最大值 + 刷新时长 + 由 prodBuffMult 在到期时真剔除。 */
      s.buffs = s.buffs || {}; s.buffs.prod = s.buffs.prod || {};
      var effNew = item.eff || 0.25;
      var effOld = s.buffs.prod[item.res] || 0;
      s.buffs.prod[item.res] = Math.max(effOld, effNew);
      if (!s.buffs.prodUntil) s.buffs.prodUntil = {};
      s.buffs.prodUntil[item.res] = U.now() + (item.dur || 24) * 3600 * 1000;
      ok = true;
      msg = item.name + ' 生效：' + item.desc
        + (effOld > effNew ? '（已有更强效果 +' + Math.round(effOld * 100) + '%，本次仅刷新时长）' : '');
    } else if (item.type === 'pop_boost') {
      /* v89.99（老板「增民令」）：人口增速道具 —— 与生产类同纪律：
         **同类只取最强**（不叠加）+ **到期真消费**（popBoostMult 每次读 until）。 */
      s.buffs = s.buffs || {};
      var pEff = item.eff || 1;
      var pCur = s.buffs.popBoost;
      var pStrong = !!(pCur && pCur.until > U.now() && (pCur.mult || 0) > pEff);
      s.buffs.popBoost = { mult: pStrong ? pCur.mult : pEff,
        until: U.now() + (item.dur || 24) * 3600 * 1000 };
      ok = true;
      msg = item.name + ' 生效：' + item.desc + (pStrong ? '（已有更强效果，本次仅刷新时长）' : '');
    } else if (item.type === 'pop_fill') {
      /* v89.125（老板「移民令改为每次使用增加 25% 上限人口的人数」）——
         语义：**每次使用 +上限 × ratio（封顶上限）**，可多次叠加。
         旧口径（v89.104）是"补到上限的 ratio"（人口 40% 时用只剩 10% 收益，
         越早用越亏）；新口径是"增加"（任何时点都是 +ratio，与"移民来投"字面一致）。
         与增民令（加速度）分工：这张是**存量**（贵、立刻见效、用完就没）。 */
      var _c5 = GAME.currentCity();
      if (!_c5) return { ok: false, msg: '没有当前城池' };
      /* v89.185（老板 6）：封顶 = **有效人口上限**（民心折算）——
         民心低时移民来投自然也少（与人口增长目标同一把尺）。 */
      var _cap5 = GAME.effPopCapOf(_c5);
      var _ratio5 = item.ratio || 0.25;
      var _add5 = Math.floor(_cap5 * _ratio5);
      var _have = Math.floor((GAME.res(_c5).pop || 0));
      if (_add5 <= 0) return { ok: false, msg: '本城尚无人口上限（先建造民房）' };
      if (_have >= _cap5) return { ok: false, msg: '本城人口已满（无需移民）' };
      var _want = Math.min(_cap5, _have + _add5);
      GAME.res(_c5).pop = _want;
      ok = true;
      msg = item.name + ' 生效：' + _c5.name + ' 人口 ' + U.fmt(_have) + ' → ' + U.fmt(_want)
        + '（+' + U.fmt(_want - _have) + ' = 上限 ' + U.fmt(_cap5) + ' 的 ' + Math.round(_ratio5 * 100) + '%）';
    } else if (item.type === 'build_cost') {
      s.buffs = s.buffs || {}; s.buffs.buildCost = { until: U.now() + (item.dur || 24) * 3600 * 1000, eff: item.eff };
      ok = true; msg = item.name + ' 生效：建造成本-30%（24h）';
    } else if (item.type === 'military_buff') {
      s.buffs = s.buffs || {}; s.buffs.military = s.buffs.military || {};
      for (var k in (item.eff || {})) s.buffs.military[k] = item.eff[k];
      s.buffs.militaryUntil = U.now() + (item.dur || 24) * 3600 * 1000;
      ok = true; msg = item.name + ' 生效：' + item.desc;
    } else if (item.type === 'boost') {
      ok = S._boost(item);
      msg = ok.msg;
    } else if (item.type === 'exp') {
      var g3 = S._findGen(targetGenId);
      if (!g3) return { ok: false, msg: '请选择将领' };
      /* v89.173（老板「不作等级限制」）：v89.171 的 capLv 培养上限与到线折算整条退役；
         闸门仍走**唯一出口** GAME.expItemGrantOf（余资质上限闸），grant = 固定面额全额。 */
      var gt3 = GAME.expItemGrantOf ? GAME.expItemGrantOf(g3, item) : { ok: true, grant: item.amount };
      if (!gt3.ok) return { ok: false, msg: gt3.msg };
      /* v26（需求 1）：走唯一入口 gainExp（含升级日志与等级结算） */
      var rg3 = GAME.battle.gainExp(g3, gt3.grant, '使用 ' + item.name);
      var got3 = (rg3 && rg3.gain) || gt3.grant;
      gain = got3;                       /* 按**实得**累加（神器加成在 gainExp 内乘） */
      ok = true;
      msg = g3.name + ' 经验 +' + U.numText(got3, 0);
    } else if (item.type === 'stamina') {
      var g4 = S._findGen(targetGenId);
      if (!g4) return { ok: false, msg: '请选择将领' };
      /* v28（需求 6）：**已经满了就拒绝**。原先只做 Math.min(100, …) 后照样返回 ok，
         于是"批量使用"会把整叠体力药烧光却一点没加（丹药、经验都有上限判断，体力漏了）。
         v29（需求 11）：体力上限改为 GAME.staMax(g) —— 高级将领体力池更深，
         一剂止血散（10%）回的绝对量也更多。
         v66：**判据与回复量都改到"池子口径"**（staNow/staMax）——
         装备体力进上限后，`g.stamina` 存的是"等级那一份的余量"，
         再拿它跟 staMax 比就会在满体力时也判定"可服"（白烧药）。 */
      var staMx = GAME.staMax(g4);
      var staNow0 = GAME.staNow(g4);
      if (staNow0 >= staMx) {
        return { ok: false, msg: g4.name + ' 体力已满（无需服药）' };
      }
      var healed = Math.min(staMx, staNow0 + (item.amount || 0.1) * staMx) - staNow0;
      GAME.setStaNow(g4, staNow0 + healed);
      ok = true; msg = g4.name + ' 体力 +' + Math.round(healed);
    } else if (item.type === 'energy') {
      /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）：
         精力族（清心丸/提神散/养神丹/凝神玉露）——与体力分支同构：
         按**上限百分比**回复、满了拒绝（不烧道具）。
         上限走唯一出口 GAME.energyMaxOf（六维公式，domain.js）。 */
      var g8 = S._findGen(targetGenId);
      if (!g8) return { ok: false, msg: '请选择将领' };
      var enMx8 = GAME.energyMaxOf(g8);
      var enNow8 = GAME.energyNowOf(g8);
      if (enNow8 >= enMx8) {
        return { ok: false, msg: g8.name + ' 精力已满（无需服药）' };
      }
      var healed8 = Math.min(enMx8, enNow8 + (item.amount || 0.1) * enMx8) - enNow8;
      GAME.setEnergyNow(g8, enNow8 + healed8);
      ok = true; msg = g8.name + ' 精力 +' + Math.round(healed8);
    } else if (item.type === 'perm') {
      var g5 = S._findGen(targetGenId);
      if (!g5) return { ok: false, msg: '请选择将领' };
      if ((g5.perm[item.attr] || 0) >= 50) return { ok: false, msg: '该将领此属性已达上限50' };
      g5.perm[item.attr] = (g5.perm[item.attr] || 0) + 1;
      g5[item.attr] += 1;
      ok = true; msg = g5.name + ' ' + { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋' }[item.attr] + ' 永久+1';
    } else if (item.type === 'rank_up') {
      /* v73（种田秘境）：资质灵草 —— 校验与升档走唯一出口 GAME.rankUpUse */
      var g7 = S._findGen(targetGenId);
      if (!g7) return { ok: false, msg: '请选择将领' };
      var ru7 = GAME.rankUpUse(g7, item);
      if (!ru7.ok) return ru7;
      ok = true; msg = ru7.msg;
    } else if (item.type === 'seed') {
      /* v78（老板需求 1）：种子**不直接使用** —— 播种在种田秘境里（官府 → 种田秘境） */
      return { ok: false, msg: '种子要到种田秘境播种（官府 → 🌾 种田秘境）' };
    } else if (item.type === 'mount_buff') {
      var g6 = S._findGen(targetGenId);
      if (!g6) return { ok: false, msg: '请选择将领' };
      s.buffs = s.buffs || {}; s.buffs.gens = s.buffs.gens || {};
      s.buffs.gens[g6.id] = s.buffs.gens[g6.id] || {};
      s.buffs.gens[g6.id][item.id] = { until: U.now() + 3600 * 1000, spd: item.amount };
      ok = true; msg = g6.name + ' 速度+' + item.amount + '（1h）';
    } else if (item.type === 'chest') {
      /* v77 · 宝箱：奖励在 S._openChest 里掷（资源入当前城、受仓储上限约束） */
      var cr = S._openChest(item);
      if (!cr.ok) return cr;
      ok = true; msg = cr.msg;
    } else if (item.type === 'neigong') {
      /* v77 · 内功秘籍：修习 / 精进（每将一门，10 重封顶；换书＝转修） */
      var g8 = S._findGen(targetGenId);
      if (!g8) return { ok: false, msg: '请选择将领' };
      var nr = S._neigongUse(g8, item);
      if (!nr.ok) return nr;
      ok = true; msg = nr.msg;
    } else if (item.type === 'corvee') {
      /* v77 · 徭役令：24 小时建造队列 +3（复用 s.buffs.buildQueue，见 GAME.buildSlots） */
      s.buffs = s.buffs || {};
      var prevAdd = (s.buffs.buildQueue && s.buffs.buildQueue.until > U.now())
        ? (s.buffs.buildQueue.add || 0) : 0;
      s.buffs.buildQueue = {
        until: U.now() + (item.dur || 24) * 3600 * 1000,
        add: Math.max(item.add || 0, prevAdd),
      };
      ok = true;
      msg = item.name + ' 生效：' + (item.dur || 24) + ' 小时内同时建造队列 +' + s.buffs.buildQueue.add;
    } else {
      /* v89.51（老板「别买了用不了」）：不再留「暂不可直接使用」这种**死路话术** ——
         这几类都有真实消耗口，只是不在 useItem 里直扣。落到这里 = 有人从旧入口点了「使用」，
         必须告诉他去哪儿用（否则就是"买了用不了"的体验）。 */
      var HINT = {
        talis: '锦囊在出征「计略」或城中「布防」施展计谋时消耗',
        material: '材料在铁匠铺打造装备时消耗',
        blueprint: '图纸用于铁匠铺解锁打造',
        essence: '灵气精华在「蕴养 · 修炼装备」中消耗（将领面板 → 修炼装备 → ☯ 蕴养）',
        /* v89.186（老板 1）：宝具 = 将领挂件（打据点/名城缴获，在将领面板佩上） */
        bao: '宝具是将领挂件：请到「将领面板」把宝具佩到将领身上（打据点/名城缴获）',
      }[item.type];
      return { ok: false, msg: HINT || '该宝物暂不可直接使用' };
    }

    if (ok) {
      s.items[itemId] -= 1;
      if (s.items[itemId] <= 0) delete s.items[itemId];
      if (!(opts && opts.silent)) GAME.log('使用宝物：' + item.name);
    }
    return { ok: ok, msg: msg, gain: gain };
  };


  /* ============================================================
   * 宝箱开启（v77 · 老板「各级宝箱」）—— 唯一出口
   * ------------------------------------------------------------
   * 奖励按档位 tier 掷：资源（入当前城、受仓储上限约束）· 黄金（货币不受限）·
   * 珠宝 · 材料（按档取系列品阶）· 图纸（tier3 小概率）· 徭役令（tier3 小概率）。
   * 概率与区间都在这一个函数里，改平衡只改这里。
   * ============================================================ */
  S._openChest = function (item) {
    var s = GAME.state, tier = item.tier || 1;
    var R = GAME.res(GAME.currentCity());
    var parts = [];
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
    function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    var RN = { grain: '粮', wood: '木', stone: '石', iron: '铁' };
    /* 资源包（2 项随机资源） */
    var rt = { 1: [1500, 4000], 2: [4000, 12000], 3: [10000, 30000] }[tier] || [1500, 4000];
    var cap = GAME.storeCap ? GAME.storeCap() : 0;
    ['grain', 'wood', 'stone', 'iron'].sort(function () { return Math.random() - 0.5; }).slice(0, 2)
      .forEach(function (k) {
        var amt = rnd(rt[0], rt[1]);
        var before = R[k] || 0;
        R[k] = cap > 0 ? Math.min(cap, before + amt) : before + amt;
        var got = R[k] - before;
        if (got > 0) parts.push(RN[k] + ' +' + U.fmt(got));
      });
    /* 黄金 */
    var gt = { 1: [1500, 5000], 2: [5000, 15000], 3: [12000, 40000] }[tier] || [1500, 5000];
    var gAmt = rnd(gt[0], gt[1]);
    R.gold = (R.gold || 0) + gAmt;
    parts.push('金 +' + U.fmt(gAmt));
    /* 珠宝 */
    if (Math.random() < { 1: 0.35, 2: 0.5, 3: 0.6 }[tier]) {
      var jewels = DATA.ITEMS.filter(function (x) { return x.type === 'jewel'; });
      jewels.sort(function (a, b) { return a.price - b.price; });
      var jw = pick(jewels.slice(0, Math.min(jewels.length, tier * 3 + 2)));
      var jn = rnd(1, tier + 1);
      s.items[jw.id] = (s.items[jw.id] || 0) + jn;
      parts.push(jw.name + ' ×' + jn);
    }
    /* 材料（按档取品阶：t1→tier1-2 少；t2→tier2-3；t3→tier3，20% 出 tier4） */
    if (Math.random() < { 1: 0.5, 2: 0.6, 3: 0.75 }[tier]) {
      var mats = (DATA.MATERIALS || []).filter(function (m) {
        if (tier === 1) return m.tier <= 2;
        if (tier === 2) return m.tier === 2 || m.tier === 3;
        return m.tier === 3 || (m.tier === 4 && Math.random() < 0.2);
      });
      if (mats.length) {
        var md = pick(mats);
        var mn = rnd(2, 3 + tier * 2);
        s.items[md.id] = (s.items[md.id] || 0) + mn;
        parts.push(md.name + ' ×' + mn);
      }
    }
    /* 图纸（tier3 小概率） */
    if (tier >= 3 && Math.random() < 0.10) {
      var bps = DATA.ITEMS.filter(function (x) { return x.type === 'blueprint'; });
      if (bps.length) {
        var bp = pick(bps);
        s.items[bp.id] = (s.items[bp.id] || 0) + 1;
        parts.push(bp.name + ' ×1');
      }
    }
    /* 徭役令（tier3 小概率） */
    if (tier >= 3 && Math.random() < 0.08) {
      s.items.corvee = (s.items.corvee || 0) + 1;
      parts.push('徭役令 ×1');
    }
    var msg = '开启「' + item.name + '」：' + (parts.join('、') || '空空如也');
    GAME.log('🎁 ' + msg);
    return { ok: true, msg: msg };
  };

  /* 内功修习 / 精进（v77）—— 唯一出口。
     规则：每将一门；同门加 1 重（10 重封顶）；异门＝转修（旧功散去，从 1 重起）。 */
  S._neigongUse = function (g, item) {
    var def = null;
    (DATA.NEIGONG || []).forEach(function (x) { if (x.id === item.teach) def = x; });
    if (!def) return { ok: false, msg: '未知内功' };
    var ATTRS = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度' };
    var maxLv = def.maxLv || 10;
    if (g.ng && g.ng.id === def.id) {
      if ((g.ng.lv || 0) >= maxLv) {
        return { ok: false, msg: g.name + ' 的《' + def.name + '》已至 ' + maxLv + ' 重（化境）' };
      }
      g.ng.lv += 1;
      return { ok: true, msg: g.name + ' 内功精进：《' + def.name + '》' + g.ng.lv
        + ' 重　' + ATTRS[def.attr] + ' +' + (def.per * g.ng.lv) + '（特性「' + def.trait + '」）' };
    }
    var switched = !!g.ng;
    g.ng = { id: def.id, lv: 1 };
    return { ok: true, msg: g.name + (switched ? ' 转修' : ' 开始修习') + '《' + def.name + '》'
      + (switched ? '（旧功散去）' : '') + '　' + ATTRS[def.attr] + ' +' + def.per + '（特性「' + def.trait + '」）' };
  };

  /* ============================================================
   * 募兵加速（v28 · 需求 8）
   * ------------------------------------------------------------
   * 「韩信三篇 −30% / 韩信点兵术 −50%」这两件宝物的 target 一直是 train，
   * 但 S._boost 的 train 分支写的是 `s.queues.train[0]` —— **全局第一条**。
   * 在"每座军营各有自己的队列"（v24 需求 8）之后，这条就点不到玩家看着的那一条：
   * 在 B 营点加速，可能加速的是 A 营。而且界面上从来就没有加速入口，
   * 等于这两个道具的功能根本不存在。
   * 现在按「城 + 军营格」定位到该营**正在执行**的那一条。
   * ============================================================ */
  S.boostTrainQueue = function (itemId, cityId, bIdx) {
    var s = GAME.state, item = S.itemInfo(itemId);
    if (!item) return { ok: false, msg: '未知宝物' };
    if (item.target !== 'train') return { ok: false, msg: '该宝物不能加速募兵' };
    if (!s.items[itemId]) return { ok: false, msg: '背包中没有该宝物' };
    var city = GAME.cityById(cityId) || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var list = GAME.trainQueuesOf(city, bIdx);
    if (!list.length) return { ok: false, msg: '本营没有募兵任务' };
    /* 只加速"正在执行"的那条 —— 排队的还没开始走表，加速它没有意义 */
    var q = null;
    for (var i = 0; i < list.length; i++) if (!list[i].waiting) { q = list[i]; break; }
    if (!q) q = list[0];
    q.boost = q.boost || {};
    if (item.once && q.boost[item.id]) {
      return { ok: false, msg: '该队列已用过「' + item.name + '」（每队列限 1 次）' };
    }
    /* v89.179c（BOOST_CAP）：宝物与花金买时间**合并封顶** ——
       一条队列**被跳过的时长**（q.boosted）最多 = totalTime × BOOST_CAP，
       即道具/金币只能削 30%，剩下 70% 必须真等（掐死"无限募兵/一键瞬造"）。
       额度走唯一出口 GAME.boostRoomOf（与 S._boost / GAME.trainRush 同口径）。
       没余量就拒收（不消耗道具），有则按余量部分生效（超出部分作废）。 */
    var _room = GAME.boostRoomOf(q);
    if (_room <= 0) return { ok: false, msg: '该队列加速已达上限（最多 ' + Math.round((DATA.BOOST_CAP || 0.3) * 100) + '%）' };
    var add = item.pct ? q.totalTime * item.pct : (item.amount || 15) * GAME.timeScale();
    add = Math.min(add, _room);
    q.elapsed = Math.min(q.totalTime, (q.elapsed || 0) + add);
    q.boosted = (q.boosted || 0) + add;
    q.boost[item.id] = (q.boost[item.id] || 0) + 1;
    s.items[itemId] -= 1;
    if (s.items[itemId] <= 0) delete s.items[itemId];
    var tn = (DATA.TROOPS[q.troopId] || {}).name || q.troopId;
    GAME.log('募兵加速：' + item.name + ' → ' + tn + ' ×' + q.count
      + '（提前 ' + Math.round(add / GAME.timeScale()) + ' 秒）');
    return { ok: true, msg: '「' + item.name + '」生效：' + tn + ' 提前 '
      + Math.round(add / GAME.timeScale()) + ' 秒完成' };
  };

  /* 背包里可用于加速募兵的宝物（供界面列按钮） */
  S.trainBoostItems = function () {
    var s = GAME.state, out = [];
    Object.keys(s.items || {}).forEach(function (id) {
      if ((s.items[id] || 0) <= 0) return;
      var it = S.itemInfo(id);
      if (it && it.target === 'train') out.push(it);
    });
    return out;
  };

  /* ------------------------------------------------------------
   * 批量使用经验道具（v26 · 需求 1「让经验可操作」）
   * ------------------------------------------------------------
   * mode = 'one'  点一次用 1 个
   *      = 'till' 反复用到**升级为止**（够用就停，不浪费）
   * 返回本次用了几个、涨了多少、有没有升级，供界面提示与原地刷新。
   * ------------------------------------------------------------ */
  S.gainExpByItem = function (itemId, genId, mode) {
    var s = GAME.state, g = S._findGen(genId), item = S.itemInfo(itemId);
    if (!g) return { ok: false, msg: '将领不存在' };
    if (!item || item.type !== 'exp') return { ok: false, msg: '该道具不是经验道具' };
    /* v66：到资质上限时直接拦住（否则循环里 useItem 会一直拒绝，
       外面只会看到一句含糊的"未能使用 XX"）。
       v89.173：闸门仍是**唯一出口** GAME.expItemGrantOf（v89.171 的培养上限已退役）。 */
    var gt0 = GAME.expItemGrantOf ? GAME.expItemGrantOf(g, item) : null;
    if (gt0 && !gt0.ok) return { ok: false, msg: gt0.msg };
    var have = (s.items && s.items[itemId]) || 0;
    if (have <= 0) return { ok: false, msg: '背包中没有 ' + item.name };
    var lv0 = g.level, used = 0, gotSum = 0;
    var limit = (mode === 'one') ? 1 : have;
    while (used < limit) {
      var r = S.useItem(itemId, genId, { silent: true });
      if (!r.ok) break;
      used++;
      gotSum += (r.gain || 0);                       /* 按实得累加（神器加成在 gainExp 内乘） */
      if (mode === 'till' && g.level > lv0) break;   // 只在"用到升级"时提前收手
    }
    if (!used) return { ok: false, msg: '未能使用 ' + item.name };
    var gain = gotSum || (used * item.amount), up = g.level - lv0;
    var need = GAME.expNeedOf(g);
    GAME.log('📗 ' + item.name + ' ×' + used + '：' + g.name + ' 经验 +' + U.numText(gain, 0)
      + (up > 0 ? '，升至 Lv' + g.level : ''));
    return {
      ok: true, used: used, gain: gain, up: up,
      msg: item.name + ' ×' + used + '：' + g.name + ' 经验 +' + U.numText(gain, 0)
        + (up > 0 ? '，升至 Lv' + g.level : '（' + U.numText(need - g.exp, 0) + ' 后升级）'),
    };
  };

  S._findGen = function (genId) {
    var s = GAME.state;
    if (!genId) return null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) return s.generals[i];
    return null;
  };

  /* 加速道具：对指定队列生效
     v89.49：三条分支都补 **封顶**（Math.min(totalTime, …)）——
     改前 `q.elapsed += totalTime × pct` 会把 elapsed 顶过 totalTime，
     而 advanceTrainQueues 里 `need = totalTime - elapsed` 变负 → `left -= need`
     反而把左侧时间**加回去**，于是溢出的加速量会白送给本营的下一条队列。
     与 S.boostTrainQueue 的封顶口径对齐。
     v89.179c（BOOST_CAP）：封顶值不再是 totalTime，而是 totalTime × (1 − BOOST_CAP)
     的**跳过量**额度（唯一出口 GAME.boostRoomOf）—— 道具 + 花金合并最多削 30%。 */
  S._boost = function (item) {
    var s = GAME.state;
    var target = item.target;
    var addOf = function (q) {
      var room = GAME.boostRoomOf(q);
      if (room <= 0) return false;          /* 已达 BOOST_CAP 封顶，本次加速无效 */
      var add = item.pct ? q.totalTime * item.pct : (item.amount || 15) * GAME.timeScale();
      add = Math.min(add, room);
      q.elapsed = Math.min(q.totalTime, (q.elapsed || 0) + add);
      q.boosted = (q.boosted || 0) + add;
      return true;
    };
    if (target === 'research') {
      var q = s.queues.tech[0];
      if (!q) return { ok: false, msg: '没有进行中的研究' };
      if (!addOf(q)) return { ok: false, msg: '加速已达上限（最多 ' + Math.round((DATA.BOOST_CAP || 0.3) * 100) + '%）' };
      return { ok: true, msg: '研究时间缩短' };
    }
    if (target === 'build') {
      if (!s.queues.build.length) return { ok: false, msg: '没有进行中的建造' };
      if (!addOf(s.queues.build[0])) return { ok: false, msg: '加速已达上限（最多 ' + Math.round((DATA.BOOST_CAP || 0.3) * 100) + '%）' };
      return { ok: true, msg: '建造时间缩短' };
    }
    if (target === 'train') {
      if (!s.queues.train.length) return { ok: false, msg: '没有进行中的训练' };
      if (!addOf(s.queues.train[0])) return { ok: false, msg: '加速已达上限（最多 ' + Math.round((DATA.BOOST_CAP || 0.3) * 100) + '%）' };
      return { ok: true, msg: '训练时间缩短' };
    }
    if (target === 'march') {
      /* v89.179c（老板②B方案）：行军道具分两支 —— 背包路径只承接「全部」那支
         （`marchScope: 'all'`，即疾行令）：「单支」那支（急行军令）必须**指名目标**，
         而背包里没有目标可选 → 明确指路，不做静默的"顺手全催"（否则又成了免费全量）。
         道具的实际扣减由 useItem 尾部统一完成（本函数不碰库存）。 */
      if (item.marchScope === 'one') {
        return { ok: false, msg: '「' + item.name + '」用于单支行军 —— 请到「行军队列」点该行的「⚡ 急行军」' };
      }
      if (GAME.march && GAME.march.rushApply) {
        var rr = GAME.march.rushApply(null);
        if (!rr.ok) return rr;
        return { ok: true, msg: rr.msg };
      }
      return { ok: false, msg: '行军系统不可用' };
    }
    if (target === 'trade') {
      /* ============================================================
       * v89.95（A3 · 老板「通商券但是无通商通道」）：**接上真的通道**
       * ------------------------------------------------------------
       * 旧实现写了 `s.buffs.tradeCut` 但**全库没有任何读取点** ——
       * 玩家花了券只看到一句提示，实际什么也没发生（死接线）。
       * 现在改成 `s.buffs.mktFree`（免折额度）：在有效期内，市场卖出
       * **不打"物多价贱"的折**，直到额度用尽（额度与时长见 DATA.MARKET_SLIP.free）。
       * 读取点：GAME.mktFreeOf / mktMulNow（marketSellPer 唯一出口链上）。
       * ============================================================ */
      var fcfg = (DATA.MARKET_SLIP || {}).free || { quota: 500000, durMin: 30 };
      s.buffs = s.buffs || {};
      var have = s.buffs.mktFree;
      s.buffs.mktFree = {
        until: U.now() + (fcfg.durMin || 30) * 60 * 1000,
        quota: fcfg.quota || 500000,
        used: (have && have.until > U.now()) ? (have.used || 0) : 0,   /* 续用叠加额度不叠加 */
      };
      return { ok: true, msg: '🏷️ 通商凭信已生效：' + (fcfg.durMin || 30) + ' 分钟内可免折抛售，'
        + '免折额度 ' + U.fmt(s.buffs.mktFree.quota) + ' 金当量（物多价贱不打折）' };
    }
    return { ok: false, msg: '该加速暂不可用' };
  };

  /* 宝物有效期检查（产buff/military） */
  S.buffActive = function (type) {
    var s = GAME.state;
    if (!s || !s.buffs) return false;
    if (type === 'buildCost') return s.buffs.buildCost && s.buffs.buildCost.until > U.now();
    if (type === 'military') return s.buffs.military && s.buffs.militaryUntil > U.now();
    /* v89.93（整改 W1）：prod 不再"永远为真"——走 prodBuffMult 的到期过滤出口，
       过期即视为未生效（旧档无 prodUntil 的一律按生效处理，向后兼容）。 */
    if (type === 'prod') {
      var m = GAME.prodBuffMult ? GAME.prodBuffMult() : (s.buffs.prod || {});
      return Object.keys(m || {}).length > 0;
    }
    return false;
  };

  /* ============================================================
   * 爵位晋升（22级）
   * ============================================================ */
  S.rankInfo = function (idx) {
    return DATA.RANK[idx] || DATA.RANK[0];
  };

  S.nextRank = function () {
    var s = GAME.state;
    return DATA.RANK[s.rank + 1] || null;
  };

  S.canPromote = function () {
    var s = GAME.state, next = S.nextRank();
    if (!next) return { ok: false, msg: '已达最高爵位' };
    if (s.rep < next.rep) return { ok: false, msg: '声望不足（需 ' + U.fmt(next.rep) + '）' };
    /* v89.203（老板 4）：城池门槛 = **打满本档领地上限**（= 本档管理数；与 cap 同值）。 */
    var _cur203 = DATA.RANK[s.rank] || DATA.RANK[0];
    if (s.cities.length < _cur203.city) {
      return { ok: false, msg: '需要 ' + _cur203.city + ' 座城池（打满本档领地上限）' };
    }
    if ((s.res.gold || 0) < next.gold) return { ok: false, msg: '黄金不足（需 ' + U.fmt(next.gold) + '）' };
    /* 珠宝检查 */
    for (var j in next.jewel) {
      if ((s.items[j] || 0) < next.jewel[j]) return { ok: false, msg: '珠宝不足（缺' + (S.itemInfo(j) ? S.itemInfo(j).name : j) + '）' };
    }
    return { ok: true };
  };

  S.promote = function () {
    var s = GAME.state, next = S.nextRank();
    var chk = S.canPromote();
    if (!chk.ok) return chk;
    s.res.gold -= next.gold;
    for (var j in next.jewel) {
      s.items[j] = (s.items[j] || 0) - next.jewel[j];
      if (s.items[j] <= 0) delete s.items[j];
    }
    s.rank += 1;
    /* v89.95（A1）：爵位每 rankEvery 档 → 赏节钺 ×1（22 档共 5 枚） */
    var _hfE = (DATA.JIEYUE || {}).rankEvery || 4;
    if (s.rank % _hfE === 0 && GAME.jieyueGrant) {
      GAME.jieyueGrant(1, '爵位晋至 ' + DATA.RANK[s.rank].name);
    }
    /* v79（神器 · 特殊活动）：爵位晋升 → 供奉值大额入账 */
    if (GAME.artGain) GAME.artGain(((DATA.ARTIFACT || {}).promotePts) || 0, '爵位晋升 · ' + DATA.RANK[s.rank].name);
    GAME.log('晋升爵位：' + DATA.RANK[s.rank].name, 'sys', 'staff');
    if (GAME.sfx) GAME.sfx('rank');       /* v89.93（E4）：22 档爵位是仪式感最强的成长 */
    return { ok: true, msg: '晋升 ' + DATA.RANK[s.rank].name + '！俸禄 ' + U.fmt(DATA.RANK[s.rank].salary) + '/h' };
  };

  /* 爵位俸禄（每小时黄金收入） */
  S.salary = function () {
    var s = GAME.state;
    return DATA.RANK[s.rank || 0].salary || 0;
  };
})();
