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
  S.techLevel = function (id) {
    var s = GAME.state;
    return (s && s.techs[id]) || 0;
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

  S.canResearch = function (techId) {
    var s = GAME.state, t = S.techInfo(techId);
    if (!t) return { ok: false, msg: '未知科技' };
    if (S.researching()) return { ok: false, msg: '书院正在研究其他科技' };
    var city = GAME.currentCity() || s.cities[0];
    var shuyuanLv = GAME.buildingLevel(city, 'shuyuan');
    if (shuyuanLv < t.lv) return { ok: false, msg: '需要书院 Lv' + t.lv };
    var cur = S.techLevel(techId);
    if (cur >= 10) return { ok: false, msg: '已满级' };
    var cost = DATA.techCost(t, cur + 1);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资源不足' };
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
    var chk = S.canResearch(techId);
    if (!chk.ok) return chk;
    var cur = S.techLevel(techId);
    var cost = DATA.techCost(t, cur + 1);
    GAME.payCost(cost);
    var time = Math.round(60 * Math.pow(2, cur) * (1 - S.studyMult())); // 游戏秒
    /* v28（需求 1）：书院满级专精 —— 研究速度 +25% */
    var _mt = GAME.mastery ? GAME.mastery('techPct', null) : 0;
    if (_mt > 0) time = Math.round(time / (1 + _mt));
    if (GAME.story) time = Math.round(time / GAME.story.researchMult()); // 名将羁绊/年号加速
    if (GAME.guardBonus) {
      var _gcity = (cityId ? GAME.cityById(cityId) : null) || GAME.currentCity();
      var _gb = GAME.guardBonus(_gcity);
      if (_gb.research) time = Math.round(time / (1 + Math.min(1.5, _gb.research))); // 守将智谋：研究加速
    }
    s.queues.tech.push({ techId: techId, elapsed: 0, totalTime: Math.max(5, time) });
    return { ok: true, msg: '开始研究 ' + t.name };
  };

  /* 研究技巧：-5%/级 */
  S.studyMult = function () {
    return Math.min(0.6, S.techLevel('yanjiu') * 0.05);
  };

  /* 科技累计加成查询（供战斗/生产/建造调用） */
  S.techBonus = function (type) {
    var sum = 0;
    DATA.TECH.forEach(function (t) {
      if (t.type !== type) return;
      sum += S.techLevel(t.id) * (t.per || 0);
    });
    return sum;
  };

  /* ============================================================
   * 装备（16槽位 · 套装）
   * ============================================================ */
  /* 某将装备总加成 */
  S.genEquipBonus = function (g) {
    /* v52：**加上 sta（体力）** —— 老板：「体力都没加上套装的体力」。
       改前这个返回对象里没有 sta，也不读 item.sta，而 staMax() 只由
       「基础 + 等级×资质 + 内政」派生 → 装备与套装写多少体力都无处生效（静默丢弃）。
       这是一条"数据里有、消费点缺"的断链，属于本项目最典型的失效模式。 */
    var b = { tong: 0, nz: 0, yw: 0, zm: 0, atk: 0, def: 0, spd: 0, sta: 0 };
    if (!g || !g.equip) return b;
    /* 驯马技巧：坐骑装备属性 +5%/级 */
    var horseMul = 1 + S.techBonus('horse');
    for (var slot in g.equip) {
      var item = DATA.EQUIP[g.equip[slot]];
      if (!item) continue;
      var mul = (slot === 'mount') ? horseMul : 1;
      /* v77 · 百炼强化：同种装备共享强化等级（s.forgeEnh），每级全属性 +perLv。
         乘在「装备本身」这一层（套装加成不参与强化）——结算口径唯一在这里。 */
      var enhLv = (GAME.enhOf ? GAME.enhOf(g.equip[slot]) : 0);
      if (enhLv) mul *= 1 + enhLv * ((DATA.ENHANCE && DATA.ENHANCE.perLv) || 0.08);
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
    if (!g || !g.equip) return out;
    var counts = {};
    for (var slot in g.equip) {
      var item = DATA.EQUIP[g.equip[slot]];
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
    for (var slot in ((g && g.equip) || {})) {
      var it = DATA.EQUIP[g.equip[slot]];
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

  S.canEquip = function (gen, itemId) {
    var item = DATA.EQUIP[itemId];
    if (!item) return { ok: false, msg: '未知装备' };
    var inv = GAME.state.inventory || [];
    if (inv.indexOf(itemId) < 0) return { ok: false, msg: '背包中没有该装备' };
    /* 坐骑需马厩/马鞭等条件简化：等级不做硬约束 */
    return { ok: true, item: item };
  };

  S.equipItem = function (genId, itemId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var chk = S.canEquip(g, itemId);
    if (!chk.ok) return chk;
    var item = chk.item;
    /* 同槽位旧装备回背包 */
    if (g.equip[item.slot]) s.inventory.push(g.equip[item.slot]);
    g.equip[item.slot] = itemId;
    var idx = s.inventory.indexOf(itemId);
    if (idx >= 0) s.inventory.splice(idx, 1);
    GAME.log('装备 ' + item.name + ' 给 ' + g.name);
    return { ok: true, msg: '已装备 ' + item.name };
  };

  /* 装备评分（同槽位比较优劣；套装件略有加成）
     v66：`it.hp` → `it.sta`（同一列改回源数据的名字，权重 0.2 不变）。 */
  S.equipScore = function (it) {
    if (!it) return -1;
    var v = (it.tong || 0) * 3 + (it.yw || 0) * 3 + (it.zm || 0) * 3 + (it.nz || 0) * 3
      + (it.atk || 0) + (it.def || 0) + (it.sta || 0) * 0.2 + (it.spd || 0) * 4;
    return v + (it.set ? 50 : 0);
  };

  /* 一键最优：逐槽位从背包中挑最强，旧件自动回背包 */
  S.autoEquipBest = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    g.equip = g.equip || {};
    s.inventory = s.inventory || [];
    var changed = [];
    DATA.EQUIP_SLOTS.forEach(function (slot) {
      var curId = g.equip[slot] || null;
      var bestId = curId, bestScore = S.equipScore(curId ? DATA.EQUIP[curId] : null);
      s.inventory.forEach(function (id) {
        var it = DATA.EQUIP[id];
        if (!it || it.slot !== slot) return;
        var sc = S.equipScore(it);
        if (sc > bestScore) { bestScore = sc; bestId = id; }
      });
      if (bestId && bestId !== curId) {
        if (curId) s.inventory.push(curId);
        var idx = s.inventory.indexOf(bestId);
        if (idx >= 0) s.inventory.splice(idx, 1);
        g.equip[slot] = bestId;
        changed.push(DATA.EQUIP[bestId].name);
      }
    });
    if (!changed.length) return { ok: true, msg: '已是最优配置（无可换之件）' };
    GAME.statBump('autoEquip', 1);
    GAME.log(g.name + ' 换装：' + changed.join('、'));
    return { ok: true, msg: '已换装 ' + changed.length + ' 件：' + changed.join('、') };
  };

  /* 全部卸下（装备回背包） */
  S.unequipAll = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var cnt = 0;
    for (var slot in (g.equip || {})) {
      s.inventory.push(g.equip[slot]);
      delete g.equip[slot];
      cnt++;
    }
    if (!cnt) return { ok: false, msg: '该将领未着装备' };
    GAME.log(g.name + ' 卸下全部装备（' + cnt + ' 件）');
    return { ok: true, msg: '已卸下 ' + cnt + ' 件' };
  };

  S.unequipItem = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g || !g.equip[slot]) return { ok: false, msg: '该槽位无装备' };
    s.inventory.push(g.equip[slot]);
    var itemName = DATA.EQUIP[g.equip[slot]] ? DATA.EQUIP[g.equip[slot]].name : '';
    delete g.equip[slot];
    GAME.log('卸下 ' + itemName);
    return { ok: true, msg: '已卸下' };
  };

  /* ============================================================
   * 宝物使用
   * ============================================================ */
  S.itemInfo = function (id) {
    for (var i = 0; i < DATA.ITEMS.length; i++) if (DATA.ITEMS[i].id === id) return DATA.ITEMS[i];
    return null;
  };

  /* opts.silent：批量消耗时只在最后写一条汇总，不要每条道具刷一行日志 */
  S.useItem = function (itemId, targetGenId, opts) {
    var s = GAME.state, item = S.itemInfo(itemId);
    if (!item) return { ok: false, msg: '未知宝物' };
    if (!s.items[itemId] || s.items[itemId] <= 0) return { ok: false, msg: '背包中没有该宝物' };

    var ok = false, msg = '';
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
      s.buffs.gens[g2.id][item.id] = { until: U.now() + (item.dur || 24) * 3600 * 1000 };
      ok = true; msg = g2.name + ' 获得 ' + item.name + '（' + item.desc + '）';
    } else if (item.type === 'prod_buff') {
      s.buffs = s.buffs || {}; s.buffs.prod = s.buffs.prod || {};
      s.buffs.prod[item.res] = (s.buffs.prod[item.res] || 0) + (item.eff || 0.25);
      if (!s.buffs.prodUntil) s.buffs.prodUntil = {};
      s.buffs.prodUntil[item.res] = U.now() + (item.dur || 24) * 3600 * 1000;
      ok = true; msg = item.name + ' 生效：' + item.desc;
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
      /* v66（老板）：「将领等级到上限后不能再使用经验道具」——
         到上限时经验只会堆着不升级，道具却在减少，等于白烧。
         判据走唯一出口 GAME.expBlockOf。 */
      var blk = GAME.expBlockOf ? GAME.expBlockOf(g3) : '';
      if (blk) return { ok: false, msg: blk };
      /* v26（需求 1）：走唯一入口 gainExp（含升级日志与等级结算） */
      GAME.battle.gainExp(g3, item.amount, '使用 ' + item.name);
      ok = true; msg = g3.name + ' 经验 +' + item.amount;
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
      return { ok: false, msg: '该宝物暂不可直接使用' };
    }

    if (ok) {
      s.items[itemId] -= 1;
      if (s.items[itemId] <= 0) delete s.items[itemId];
      if (!(opts && opts.silent)) GAME.log('使用宝物：' + item.name);
    }
    return { ok: ok, msg: msg };
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
    var add = item.pct ? q.totalTime * item.pct : (item.amount || 15) * GAME.timeScale();
    q.elapsed = Math.min(q.totalTime, (q.elapsed || 0) + add);
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
       外面只会看到一句含糊的"未能使用 XX"）。 */
    var blk = GAME.expBlockOf ? GAME.expBlockOf(g) : '';
    if (blk) return { ok: false, msg: blk };
    var have = (s.items && s.items[itemId]) || 0;
    if (have <= 0) return { ok: false, msg: '背包中没有 ' + item.name };
    var lv0 = g.level, used = 0;
    var limit = (mode === 'one') ? 1 : have;
    while (used < limit) {
      var r = S.useItem(itemId, genId, { silent: true });
      if (!r.ok) break;
      used++;
      if (mode === 'till' && g.level > lv0) break;   // 只在"用到升级"时提前收手
    }
    if (!used) return { ok: false, msg: '未能使用 ' + item.name };
    var gain = used * item.amount, up = g.level - lv0;
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

  /* 加速道具：对指定队列生效 */
  S._boost = function (item) {
    var s = GAME.state;
    var target = item.target;
    if (target === 'research') {
      var q = s.queues.tech[0];
      if (!q) return { ok: false, msg: '没有进行中的研究' };
      q.elapsed += item.pct ? q.totalTime * item.pct : (item.amount || 15) * GAME.timeScale();
      return { ok: true, msg: '研究时间缩短' };
    }
    if (target === 'build') {
      if (!s.queues.build.length) return { ok: false, msg: '没有进行中的建造' };
      var q2 = s.queues.build[0];
      q2.elapsed += item.pct ? q2.totalTime * item.pct : (item.amount || 15) * GAME.timeScale();
      return { ok: true, msg: '建造时间缩短' };
    }
    if (target === 'train') {
      if (!s.queues.train.length) return { ok: false, msg: '没有进行中的训练' };
      var q3 = s.queues.train[0];
      q3.elapsed += item.pct ? q3.totalTime * item.pct : (item.amount || 15) * GAME.timeScale();
      return { ok: true, msg: '训练时间缩短' };
    }
    if (target === 'march') {
      /* 急行军令：立即完成全部行军。
         此前只是把 m.elapsed 改成 totalTime，而 s.marches 恒为空数组 → 静默失效。 */
      if (GAME.march && GAME.march.rushAll) {
        var rr = GAME.march.rushAll();
        if (!rr.ok) return rr;
        return { ok: true, msg: rr.msg };
      }
      return { ok: false, msg: '行军系统不可用' };
    }
    if (target === 'trade') {
      /* 交易加速：市场折损临时降低（此前落入兜底分支，提示"暂不可用"） */
      s.buffs = s.buffs || {};
      s.buffs.tradeCut = { until: U.now() + 30 * 60 * 1000, cut: (item.pct || 0.05) };
      return { ok: true, msg: '市场折损降低 ' + Math.round((item.pct || 0.05) * 100) + '%（30 分钟内）' };
    }
    return { ok: false, msg: '该加速暂不可用' };
  };

  /* 宝物有效期检查（产buff/military） */
  S.buffActive = function (type) {
    var s = GAME.state;
    if (!s || !s.buffs) return false;
    if (type === 'buildCost') return s.buffs.buildCost && s.buffs.buildCost.until > U.now();
    if (type === 'military') return s.buffs.military && s.buffs.militaryUntil > U.now();
    if (type === 'prod') return s.buffs.prod;
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
    if (s.cities.length < next.city) return { ok: false, msg: '需要 ' + next.city + ' 座城池' };
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
    GAME.log('晋升爵位：' + DATA.RANK[s.rank].name);
    return { ok: true, msg: '晋升 ' + DATA.RANK[s.rank].name + '！俸禄 ' + U.fmt(DATA.RANK[s.rank].salary) + '/h' };
  };

  /* 爵位俸禄（每小时黄金收入） */
  S.salary = function () {
    var s = GAME.state;
    return DATA.RANK[s.rank || 0].salary || 0;
  };
})();
