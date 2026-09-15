# -*- coding: utf-8 -*-
"""v77 · 核心层：月俸体系（7 游戏日结算）+ 百炼强化 + 内功 + 宝箱/徭役令数据。
老板原文（需求档案 v77）：
  2. 为将领设计俸禄体系，根据属性值？等级？或其他因素，设计维持将领所需月俸，
     经过 7 个游戏日结算 1 次（注意不要搞崩经济，但是将领越多，经济负担越重）
  7. 丰富商场道具（各级宝箱，将领技能学习书——内功修炼体系，徭役令）
  8. 铁匠铺加入装备强化系统，装备可进行强化
"""
import io, sys

D = r'E:\Deepseekdb\js\data.js'
S = r'E:\Deepseekdb\js\systems.js'
M = r'E:\Deepseekdb\js\domain.js'
T = r'E:\Deepseekdb\js\state.js'


def patch(path, old, new, tag):
    """先看 old 在不在（在→替换）；不在才看 new（幂等跳过）。行尾按文件现状自动匹配。"""
    t = io.open(path, encoding='utf-8', newline='').read()
    old_c = old.replace('\n', '\r\n'); new_c = new.replace('\n', '\r\n')
    if old in t:
        if t.count(old) != 1:
            print('  ✗ %s：锚点命中 %d 次，拒绝写盘' % (tag, t.count(old))); sys.exit(1)
        t = t.replace(old, new, 1)
    elif old_c in t:
        if t.count(old_c) != 1:
            print('  ✗ %s：锚点(CRLF)命中 %d 次' % (tag, t.count(old_c))); sys.exit(1)
        t = t.replace(old_c, new_c, 1)
    elif (new in t) or (new_c in t):
        print('  · %s：已改过（跳过）' % tag); return
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag); sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s' % tag)


# =====================================================================
# ① data.js：GEN_SALARY（月俸表）
# =====================================================================
patch(D,
"""DATA.GEN_BASE = { tong: 45, nz: 45, yw: 45, zm: 45, attack: 10, defense: 10, speed: 10, hp: 100, stamina: 100, energy: 100, loyalty: 70, salary: 20 };""",
"""DATA.GEN_BASE = { tong: 45, nz: 45, yw: 45, zm: 45, attack: 10, defense: 10, speed: 10, hp: 100, stamina: 100, energy: 100, loyalty: 70, salary: 20 };

  /* ============================================================
   * 将领月俸（v77 · 老板「为将领设计俸禄体系……经过 7 个游戏日结算 1 次」）
   * ------------------------------------------------------------
   * 口径：**每 7 游戏日**结算一期，从各将所在城的府库扣除。
   *   月俸 =（base + 等级×perLevel + 四维和×perAttr）× 资质系数
   * 设计意图（老板原话）：「不要搞崩经济，但是将领越多，经济负担越重」——
   *   · 线性于将领数量：一两名将不痛，上规模的将领团才是真负担；
   *   · 等级与四维定价：练得越强，俸禄越贵（养成有维持成本）；
   *   · 资质系数：高资质将领身价高，但资质是稀缺品，负担可控。
   * 参考量级（默认 120× 时间倍率，1 游戏日 = 12 现实分钟）：
   *   良材 Lv1 约 490 金/期（≈3 金/游戏时）；名世 Lv30 约 2.1 万/期。
   * 前端展示与结算同源：GAME.genSalaryOf（唯一出口）。
   * ⚠️ 调平衡只动这张表；结算入口唯一（GAME.settleGenSalary）。
   * ============================================================ */
  DATA.GEN_SALARY = {
    periodDays: 7,       // 结算周期：7 游戏日
    base: 120,           // 每将每期底俸
    perLevel: 150,       // 每级 +150
    perAttr: 1.2,        // 四维（统率+内政+勇武+智谋）每点 +1.2
    rankMul: { fan: 1, liang: 1.6, ying: 2.6, ming: 4.2, tian: 7 },
    maxPeriods: 30,      // 离线补结上限（期）：防止长挂后一把扣穿
  };""",
'D1 GEN_SALARY')

# =====================================================================
# ② data.js：ENHANCE（百炼强化表）
# =====================================================================
patch(D,
"""    slotMulDef: 1.0,
  };""",
"""    slotMulDef: 1.0,
  };

  /* ============================================================
   * 铁匠铺 · 百炼强化（v77 · 老板「装备可进行强化」）
   * ------------------------------------------------------------
   * 模型：强化等级记在**装备谱**上（s.forgeEnh[itemId] = 0..max）——
   *   本项目装备是"同一图纸的量产件"（背包/穿戴都存 id、不存实例），
   *   因此强化按"种"累计：同种装备共享等级，日后新打造的也继承。
   * 效果：每级 全部装备属性 +perLv（在 genEquipBonus 里乘上去，唯一出口；
   *   套装加成不参与强化，避免"叠上叠"）。
   * 成本：随强化等级线性上升，取该品质打造基准成本的一个系数。
   * ============================================================ */
  DATA.ENHANCE = {
    max: 10,             // 最高 +10
    perLv: 0.08,         // 每级：装备全属性 +8%
    goldMul: 0.35,       // 单级成本 = 打造基准 × 系数 × (当前等级 + 1)
    ironMul: 0.22,
    stoneMul: 0.22,
  };""",
'D2 ENHANCE')

# =====================================================================
# ③ data.js：NEIGONG（内功数据，插在 GEN_STYLES 之后）
# =====================================================================
patch(D,
"""    { id: 'gov', name: '能臣', w: 18, mul: { tong: 0.96, nz: 1.50, yw: 0.58, zm: 1.10 } },
  ];""",
"""    { id: 'gov', name: '能臣', w: 18, mul: { tong: 0.96, nz: 1.50, yw: 0.58, zm: 1.10 } },
  ];

  /* ============================================================
   * 内功（v77 · 老板「将领技能学习书……设计将领内功修炼体系，
   *                可增加将领特性（根据功法和等级）」）
   * ------------------------------------------------------------
   * 每将同时只修**一门**内功（换书＝转修，旧功散去重头计）；
   * 每门 10 重（maxLv），第 N 重提供 attr +per×N 的属性特性（trait 名）。
   * 加成在 GAME.genAttrs 里统一并入（唯一出口）——与装备/丹药同层求和，
   * 战斗、生产、界面全走同一条链。书在商城购得（type 'neigong'）。
   * ============================================================ */
  DATA.NEIGONG = [
    { id: 'sunzi',  name: '孙子兵法', trait: '庙算', attr: 'zm',  per: 4, maxLv: 10, desc: '未战先算，多算胜少算。智谋 +4/重。' },
    { id: 'liutao', name: '太公六韬', trait: '将略', attr: 'tong', per: 4, maxLv: 10, desc: '文韬武略，驭众之要。统率 +4/重。' },
    { id: 'wuqin',  name: '五禽戏',   trait: '养生', attr: 'nz',  per: 4, maxLv: 10, desc: '导引吐纳，形神俱养。内政 +4/重。' },
    { id: 'yuenv',  name: '越女剑经', trait: '剑心', attr: 'yw',  per: 4, maxLv: 10, desc: '越女论剑，一人当百。勇武 +4/重。' },
  ];""",
'D3 NEIGONG')

# =====================================================================
# ④ data.js：新商品（宝箱 / 秘籍 / 徭役令）
# =====================================================================
patch(D,
"""    { id: 'hanxue_mabian', name: '汗血马鞭', type: 'mount_buff', amount: 5, price: 80, desc: '将领速度+5（1h，需紫坐骑）' },
  ];""",
"""    { id: 'hanxue_mabian', name: '汗血马鞭', type: 'mount_buff', amount: 5, price: 80, desc: '将领速度+5（1h，需紫坐骑）' },
    /* ============================================================
     * v77 新货（老板「丰富商场道具（符合时代背景和游戏背景），包括不限于……」）
     * ============================================================ */
    /* 宝箱：开启随机获得资源 / 黄金 / 珠宝 / 材料 / 图纸（见 S._openChest） */
    { id: 'chest_tong', name: '青铜宝箱', type: 'chest', tier: 1, price: 25, desc: '开启随机获得：资源 / 黄金 / 珠宝 / 一阶材料' },
    { id: 'chest_yin', name: '白银宝箱', type: 'chest', tier: 2, price: 70, desc: '开启随机获得：丰厚资源 / 黄金 / 二阶材料（小概率图纸）' },
    { id: 'chest_jin', name: '鎏金宝箱', type: 'chest', tier: 3, price: 180, desc: '开启随机获得：高阶材料 / 图纸 / 珠宝（小概率徭役令）' },
    /* 内功秘籍：修习后随重数提供属性特性（每将一门，见 DATA.NEIGONG） */
    { id: 'book_sunzi', name: '《孙子兵法》', type: 'neigong', teach: 'sunzi', price: 80, desc: '修习内功「庙算」：智谋随重数增长（最高 10 重）' },
    { id: 'book_liutao', name: '《太公六韬》', type: 'neigong', teach: 'liutao', price: 80, desc: '修习内功「将略」：统率随重数增长（最高 10 重）' },
    { id: 'book_wuqin', name: '《五禽戏》', type: 'neigong', teach: 'wuqin', price: 80, desc: '修习内功「养生」：内政随重数增长（最高 10 重）' },
    { id: 'book_yuenv', name: '《越女剑经》', type: 'neigong', teach: 'yuenv', price: 80, desc: '修习内功「剑心」：勇武随重数增长（最高 10 重）' },
    /* 徭役令：征发徭役，短时扩充营造队列（与官府专精/名城 perk 叠加） */
    { id: 'corvee', name: '徭役令', type: 'corvee', dur: 24, add: 3, price: 120, desc: '24 小时内同时建造队列 +3' },
  ];""",
'D4 新商品')

# =====================================================================
# ⑤ systems.js：genEquipBonus 挂强化乘数
# =====================================================================
patch(S,
"""      var mul = (slot === 'mount') ? horseMul : 1;
      b.tong += (item.tong || 0) * mul; b.nz += (item.nz || 0) * mul;""",
"""      var mul = (slot === 'mount') ? horseMul : 1;
      /* v77 · 百炼强化：同种装备共享强化等级（s.forgeEnh），每级全属性 +perLv。
         乘在「装备本身」这一层（套装加成不参与强化）——结算口径唯一在这里。 */
      var enhLv = (GAME.enhOf ? GAME.enhOf(g.equip[slot]) : 0);
      if (enhLv) mul *= 1 + enhLv * ((DATA.ENHANCE && DATA.ENHANCE.perLv) || 0.08);
      b.tong += (item.tong || 0) * mul; b.nz += (item.nz || 0) * mul;""",
'S1 genEquipBonus 强化')

# =====================================================================
# ⑥ systems.js：useItem 三个新分支（宝箱 / 内功 / 徭役令）
# =====================================================================
patch(S,
"""      ok = true; msg = g6.name + ' 速度+' + item.amount + '（1h）';
    } else {
      return { ok: false, msg: '该宝物暂不可直接使用' };
    }""",
"""      ok = true; msg = g6.name + ' 速度+' + item.amount + '（1h）';
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
    }""",
'S2 useItem 新分支')

# =====================================================================
# ⑦ systems.js：_openChest + _neigongUse（插在募兵加速段之前）
# =====================================================================
patch(S,
"""  /* ============================================================
   * 募兵加速（v28 · 需求 8）""",
"""  /* ============================================================
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
   * 募兵加速（v28 · 需求 8）""",
'S3 宝箱与内功函数')

# =====================================================================
# ⑧ domain.js：月俸三件套（genSalaryOf / genSalaryTotal / settleGenSalary）
# =====================================================================
patch(M,
"""  /* 距下次岁贡结算的剩余现实毫秒 */""",
"""  /* ============================================================
   * 将领月俸（v77 · 老板「经过 7 个游戏日结算 1 次」）
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
    return Math.round(v * mul);
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
    var paid = 0, short = 0;
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
      else { R.gold = 0; paid += have; short += amount - have; }
    });
    if (!paid && !short) return { periods: capped, paid: 0, short: 0 };
    var line = '💰 将领月俸结算（' + capped + ' 期）：金 −' + U.fmt(paid);
    if (short > 0) line += '；⚠️ 府库不足，欠俸 ' + U.fmt(short) + ' 金';
    GAME.log(line);
    return { periods: capped, paid: paid, short: short };
  };

  /* 距下次岁贡结算的剩余现实毫秒 */""",
'M1 月俸三件套')

# =====================================================================
# ⑨ domain.js：百炼强化 + 君主改名（插在解雇将领之前）
# =====================================================================
patch(M,
"""  /* --------- 解雇将领（装备全数归还；名将离去损声望） --------- */""",
"""  /* ============================================================
   * 铁匠铺 · 百炼强化（v77）
   * ------------------------------------------------------------
   * 强化等级按**装备种**记（s.forgeEnh[itemId]）—— 装备是量产件模型
   * （背包存 id 不存实例），同种共享、新造的继承。
   * 效果并入 genEquipBonus（唯一出口），这里只管"能不能升、花多少"。
   * ============================================================ */
  GAME.enhOf = function (itemId) {
    var s = GAME.state;
    return (s && s.forgeEnh && s.forgeEnh[itemId]) || 0;
  };
  GAME.enhMax = function () { return (DATA.ENHANCE && DATA.ENHANCE.max) || 10; };
  /* 下一级成本（唯一出口；UI 与扣费读同一份） */
  GAME.enhCost = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (!it) return null;
    var base = (DATA.FORGE.costByQ || {})[it.q] || DATA.FORGE.costByQ[1];
    var lv = GAME.enhOf(itemId);
    var C = DATA.ENHANCE || {};
    return {
      gold: Math.round((base.gold || 0) * (C.goldMul || 0.35) * (lv + 1)),
      iron: Math.round((base.iron || 0) * (C.ironMul || 0.22) * (lv + 1)),
      stone: Math.round((base.stone || 0) * (C.stoneMul || 0.22) * (lv + 1)),
    };
  };
  /* 可强化清单：背包 + 已穿戴里的全部装备种（去重；品质高、已强化者在前） */
  GAME.enhList = function () {
    var s = GAME.state, seen = {}, ids = [];
    ((s && s.inventory) || []).forEach(function (id) {
      if (!seen[id] && DATA.EQUIP[id]) { seen[id] = 1; ids.push(id); }
    });
    ((s && s.generals) || []).forEach(function (g) {
      for (var sl in (g.equip || {})) {
        var id = g.equip[sl];
        if (!seen[id] && DATA.EQUIP[id]) { seen[id] = 1; ids.push(id); }
      }
    });
    ids.sort(function (a, b) {
      return (DATA.EQUIP[b].q - DATA.EQUIP[a].q) || (GAME.enhOf(b) - GAME.enhOf(a));
    });
    return ids;
  };
  GAME.enhance = function (itemId) {
    var s = GAME.state, it = DATA.EQUIP[itemId];
    if (!it) return { ok: false, msg: '未知装备' };
    if (GAME.forgeLevel() <= 0) return { ok: false, msg: '需先建造铁匠铺' };
    var lv = GAME.enhOf(itemId);
    if (lv >= GAME.enhMax()) return { ok: false, msg: '「' + it.name + '」已至 +' + GAME.enhMax() + '（满级）' };
    /* 至少得拥有这件（或在穿）—— 没拥有过的种类不给强化 */
    var owned = ((s.inventory) || []).indexOf(itemId) >= 0;
    if (!owned) {
      ((s.generals) || []).forEach(function (g) {
        for (var sl in (g.equip || {})) if (g.equip[sl] === itemId) owned = true;
      });
    }
    if (!owned) return { ok: false, msg: '尚未拥有「' + it.name + '」（先打造或缴获）' };
    var cost = GAME.enhCost(itemId);
    if (!GAME.canAfford(cost)) return { ok: false, msg: '资材不足（需 ' + GAME.costString(cost) + '）' };
    GAME.payCost(cost);
    s.forgeEnh = s.forgeEnh || {};
    s.forgeEnh[itemId] = lv + 1;
    GAME.log('铁匠铺百炼：' + it.name + ' → +' + (lv + 1));
    return { ok: true, msg: '「' + it.name + '」强化 +' + (lv + 1)
      + '（装备属性 +' + Math.round((lv + 1) * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%）' };
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
    if (lg) lg.name = name;   // 君主本人也是将领（v70）：两处同源
    GAME.log('君主更名：' + name);
    return { ok: true, msg: '君主已更名为 ' + name };
  };

  /* --------- 解雇将领（装备全数归还；名将离去损声望） --------- */""",
'M2 百炼与改名')

# =====================================================================
# ⑩ domain.js：genAttrs 并入内功加成（插在 v52 派生之前）
# =====================================================================
patch(M,
"""    /* ---------- v52 派生：攻防值 → 全军加成 ----------""",
"""    /* v77 · 内功（DATA.NEIGONG）：每重 +per 到对应维（与装备/丹药同层求和）。
       修习/精进走 systems.useItem → S._neigongUse；这里只管把加成算进去。 */
    if (g.ng && g.ng.id) {
      var ngD = null;
      (DATA.NEIGONG || []).forEach(function (x) { if (x.id === g.ng.id) ngD = x; });
      if (ngD && ngD.attr && a[ngD.attr] != null) a[ngD.attr] += (ngD.per || 0) * (g.ng.lv || 0);
    }

    /* ---------- v52 派生：攻防值 → 全军加成 ----------""",
'M3 genAttrs 内功')

# =====================================================================
# ⑪ state.js：模板字段（forgeEnh / salaryAt）
# =====================================================================
patch(T,
"""      wilds: [],                                // 已占领野地""",
"""      forgeEnh: {},                             // v77：装备百炼强化等级 {itemId: lv}
      salaryAt: 0,                              // v77：将领月俸上次结算锚点（游戏秒）
      wilds: [],                                // 已占领野地""",
'T1 模板字段')

# =====================================================================
# ⑫ state.js：迁移补字段
# =====================================================================
patch(T,
"""      if (!st.workRate) st.workRate = { grain: 100, wood: 100, stone: 100, iron: 100 };""",
"""      if (!st.workRate) st.workRate = { grain: 100, wood: 100, stone: 100, iron: 100 };
      /* v77 补字段：百炼强化表 / 月俸锚点（老档锚点=当前游戏时刻，首期 7 游戏日后到来） */
      if (!st.forgeEnh) st.forgeEnh = {};
      if (st.salaryAt == null) st.salaryAt = (st.world && st.world.elapsed) || 0;""",
'T2 迁移字段')

# =====================================================================
# ⑬ state.js：逐秒俸禄 → 月俸结算
# =====================================================================
patch(T,
"""    /* 3) 将领俸禄（等级×20金/h）—— 从**该将所在城**扣。
       黄金不足则欠俸，忠诚额外下滑 */
    var gc = DATA.GEN_COST, lo = DATA.LOYALTY;
    var unpaidAny = false;
    s.cities.forEach(function (ct) {
      var sal = 0;
      (s.generals || []).forEach(function (g) { if (g.cityId === ct.id) sal += g.level * 20; });
      if (!sal) return;
      var due = sal / 3600 * ts;
      var R = GAME.res(ct);
      if ((R.gold || 0) >= due) R.gold -= due;
      else { R.gold = 0; unpaidAny = true; }
    });""",
"""    /* 3) 将领月俸（v77 · 老板「经过 7 个游戏日结算 1 次」）——
       不再逐秒扣款：每 7 游戏日一次结清（GAME.settleGenSalary，
       定价见 DATA.GEN_SALARY / GAME.genSalaryOf）。欠俸时置 unpaidAny
       （供 s._unpaid 标记；不损忠诚 —— v14.1 拍板）。 */
    var gc = DATA.GEN_COST, lo = DATA.LOYALTY;
    var unpaidAny = false;
    var _salSettle = GAME.settleGenSalary();
    if (_salSettle && _salSettle.short > 0) unpaidAny = true;""",
'T3 月俸结算')

print('\n核心层 v77 补丁执行完毕。')
