# -*- coding: utf-8 -*-
"""v89.160 补丁 A：数据表（DATA.OVERFLOW）
补丁 B：域层（逾溢折损四出口 + 自动升级取消城内优先 & 顺延试下一项）
补丁 C：状态层（默认字段 / 老档迁移 / tickOnce + simulateBulk 挂钩）
补丁 D：界面（侧栏悬停 / 仓库面板 / 自动升级说明）+ main.js 文案
分段落盘 + 幂等守卫 + 写后自检（node --check）。"""
import io, sys

R = 'E:/Deepseekdb/'


def rep(path, tag, old, new, guard):
    s = io.open(R + path, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %-44s 已落盘' % tag); sys.stdout.flush(); return
    n = s.count(old)
    assert n == 1, '%s 锚点命中 %d 次' % (tag, n)
    io.open(R + path, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
    print('  [ ok ] %-44s （1/1 · 已写盘）' % tag); sys.stdout.flush()


# ══════════════ A. data.js ══════════════
rep('js/data.js', 'data · DATA.OVERFLOW',
    """  DATA.BASE_STORE = 2000000;
  DATA.TECH_MAX_LV = 10;""",
    """  DATA.BASE_STORE = 2000000;
  DATA.TECH_MAX_LV = 10;

  /* ============================================================
   * v89.160（老板 1）：**逾溢折损** —— 超出仓容的部分会被"天灾"慢慢吃掉
   * ------------------------------------------------------------
   * 老板原话：「资源超过容量上限，设计每隔一段时间，扣减超出部分的百分之25%，
   *   系统提示鼠灾，火灾，风化，腐蚀，损失XX资源XXX」
   * 口径（**唯一出口** `GAME.settleOverflowRot`；调平衡只动这张表）：
   *   · 周期走**游戏时间**（锚点 `s.overflowAt` = 游戏秒，与月俸 `salaryAt` 同一手法）——
   *     产出本身是按游戏时间走的，折损也必须按游戏时间走；否则高倍速下"现实 30 分钟
   *     才折一次"，等于没有折损（v89.115 的入侵之所以改用现实时间，是因为玩家
   *     用现实感官体验"被打"；而仓廪折损是**经济压力**，必须与产出的时间刻度一致）。
   *   · 只吃 **有上限的资源**（见 keys）—— 黄金是货币、不受仓容约束，天然不参与。
   *   · 超出 ≥ 1 至少损 1（否则小额溢出永远"折"不动，机制成摆设）。
   *   · 一次结算只发**一条**公文（随机灾种 + 逐项损失；同一池子的量合并报），
   *     无损失则完全静默（不掉链、不刷屏）。
   *   · `maxPeriods`：离线很久也最多折算这么多期（防"一夜清零"式暴击）。
   * ============================================================ */
  DATA.OVERFLOW = {
    keys: ['grain', 'wood', 'stone', 'iron'],   /* 只有这些资源吃仓容上限 */
    periodGameHours: 24,   /* 每 1 游戏日结算一次（= 12 现实分钟 @120× · 24 分钟 @1×） */
    ratio: 0.25,           /* 老板定的 25%：扣"超出上限部分"的 25% */
    maxPeriods: 20,        /* 一次最多折算 20 期 */
    events: [              /* 老板点名的四种损耗（图标 + 名，随机取一） */
      { name: '鼠灾', icon: '🐭' }, { name: '火灾', icon: '🔥' },
      { name: '风化', icon: '💨' }, { name: '腐蚀', icon: '🦠' }
    ]
  };""",
    'DATA.OVERFLOW = {')

# ══════════════ B1. domain.js · 逾溢折损四出口 ══════════════
rep('js/domain.js', 'domain · 逾溢折损四出口',
    """    return { base: base, ext: ext, total: base + ext, lv: lv };
  };""",
    """    return { base: base, ext: ext, total: base + ext, lv: lv };
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
    var cap = GAME.storeCapOf(ct);
    if (!(cap > 0)) return out;
    var R = GAME.res(ct);
    (C.keys || []).forEach(function (k) {
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
  };""",
    'GAME.settleOverflowRot = function')

# ══════════════ B2. domain.js · 自动升级：取消城内优先 + 顺延 ══════════════
rep('js/domain.js', 'domain · 自动升级排序（取消城内优先）',
    """    /* 等级从低到高；同级**城内建筑（含城墙）→ 城外资源地块** */
    var KIND_ORD = { city: 0, ext: 2 };
    cands.sort(function (a, b) {
      if (a.lv !== b.lv) return a.lv - b.lv;
      if (a.kind !== b.kind) return KIND_ORD[a.kind] - KIND_ORD[b.kind];
      return a.idx - b.idx;
    });""",
    """    /* v89.160（老板 2）：「取消城内优先」—— `KIND_ORD` 的城内/城外分档**整条退役**：
       现在只按**等级从低到高**排；同级沿用**候选收集序**（城内格 → 城墙 → 城外格）——
       它是"遍历顺序"，不是"城内优先"这类优先级规则（改前同级时城内建筑一定先上）。
       同级若要再定一条规则（如"便宜的先"），加一个键即可。 */
    cands.forEach(function (c, i) { c.ord = i; });
    cands.sort(function (a, b) {
      if (a.lv !== b.lv) return a.lv - b.lv;
      return a.ord - b.ord;
    });""",
    'cands.forEach(function (c, i) { c.ord = i; })')

# （顺延段的落盘见下方 —— 单独一段，避免长锚点嵌套）
s = io.open(R + 'js/domain.js', 'r', encoding='utf-8', newline='').read()
if 'blocked160' in s:
    print('  [skip] %-44s 已落盘' % 'domain · 自动升级顺延试下一项'); sys.stdout.flush()
else:
    rep('js/domain.js', 'domain · 自动升级顺延试下一项',
        """      if (r && !r.ok && /不足/.test(r.msg)) {
        /* 资源不足 → 暂停，等待资源恢复后自动继续 */
        s.autoState = { paused: true, reason: r.msg, want: c.name, msg: '资源不足，暂停中（待升级 ' + c.name + '）' };
        return { paused: true, reason: r.msg, target: c };
      }
    }
    s.autoState = { paused: false, msg: '暂无可升级项' };
    return null;""",
        """      /* v89.160（老板 2）：「某建筑资源不足时，**顺延升级下一个建筑**，
         直至所有可升级建筑均无法升级，或所有建筑均达到当前等级上限」——
         改前：第一项不足就 return（暂停）→ 后面明明升得起的项永远轮不到。
         改后：不足项**记下来继续试**；只有**全部试遍仍无一可动**才置暂停态（并说明原因）。
         （"试遍"= 真调一次升级入口，所以前置未满足 / 施工中 / 队列满等原因也一并顺延。） */
      if (r && !r.ok && /不足/.test(r.msg) && !blocked160) blocked160 = { reason: r.msg, target: c };
      if (r && !r.ok) lastFail160 = r.msg || '';
    }
    if (blocked160) {
      s.autoState = { paused: true, reason: blocked160.reason, want: blocked160.target.name,
        msg: '资源不足，暂停中（' + cands.length + ' 项试遍 · 待升级 ' + blocked160.target.name + '）' };
      return { paused: true, reason: blocked160.reason, target: blocked160.target };
    }
    s.autoState = { paused: false, msg: lastFail160 ? ('暂无可升级项（' + lastFail160 + '）') : '暂无可升级项' };
    return null;""",
        'blocked160')

# 变量声明（在试建循环之前）
rep('js/domain.js', 'domain · 顺延变量声明',
    """    /* v89.104（老板）：「不要这个功能组件」—— 预算闸门与它的 gated 收集一并退役：
       现在**逐个试**（资源不足 → 暂停并说明；珠宝不足同判），不再有"跳过线"这一层。 */
    for (var i = 0; i < cands.length; i++) {""",
    """    /* v89.104（老板）：「不要这个功能组件」—— 预算闸门与它的 gated 收集一并退役：
       现在**逐个试**；v89.160 起"资源不足"不再当场暂停，而是**顺延**（见循环内注释）。 */
    var blocked160 = null;   /* 第一处"资源不足"（全部试遍后用它做暂停文案） */
    var lastFail160 = '';    /* 最后一个失败原因（非资源类，供状态行显示） */
    for (var i = 0; i < cands.length; i++) {""",
    'var blocked160 = null;')

# ══════════════ C. state.js ══════════════
rep('js/state.js', 'state · 默认字段 overflowAt',
    """      salaryAt: 0,                              // v77：将领月俸上次结算锚点（游戏秒）""",
    """      salaryAt: 0,                              // v77：将领月俸上次结算锚点（游戏秒）
      overflowAt: 0,                            // v89.160：逾溢折损上次结算锚点（游戏秒）""",
    'overflowAt: 0,')

rep('js/state.js', 'state · 老档迁移 overflowAt',
    """      /* v77 补字段：月俸锚点（老档锚点=当前游戏时刻，首期 7 游戏日后到来） */
      if (st.salaryAt == null) st.salaryAt = (st.world && st.world.elapsed) || 0;""",
    """      /* v77 补字段：月俸锚点（老档锚点=当前游戏时刻，首期 7 游戏日后到来） */
      if (st.salaryAt == null) st.salaryAt = (st.world && st.world.elapsed) || 0;
      /* v89.160 补字段：逾溢折损锚点（同款：老档从"当前时刻"起算，首期 1 游戏日后到） */
      if (st.overflowAt == null) st.overflowAt = (st.world && st.world.elapsed) || 0;""",
    'if (st.overflowAt == null) st.overflowAt = (st.world')

rep('js/state.js', 'state · tickOnce 挂钩',
    """    /* 10) 历法天时推进 + 史册记账 + 年号纪元（story.js） */
    if (GAME.story) GAME.story.tick(ts);

    GAME.checkProgressQuests();""",
    """    /* 10) 历法天时推进 + 史册记账 + 年号纪元（story.js） */
    if (GAME.story) GAME.story.tick(ts);

    /* 11) 逾溢折损（v89.160 · 老板 1）——**放在历法推进之后**：锚点读的是刚推进过的
       `world.elapsed`（游戏秒），与产出同一时间刻度；离线补算走 simulateBulk 的同名调用。 */
    if (GAME.settleOverflowRot) GAME.settleOverflowRot();

    GAME.checkProgressQuests();""",
    '11) 逾溢折损（v89.160 · 老板 1）')

rep('js/state.js', 'state · simulateBulk 挂钩',
    """    /* 历法：整段一次性推进（内部只触发一次换季/换年检查，不会涌出大量史书） */
    if (GAME.story) GAME.story.tick(secReal * ts);
  };""",
    """    /* 历法：整段一次性推进（内部只触发一次换季/换年检查，不会涌出大量史书） */
    if (GAME.story) GAME.story.tick(secReal * ts);
    /* v89.160：逾溢折损 —— 与在线**同一个**结算函数（历法已推进 → 锚点能对上） */
    if (GAME.settleOverflowRot) GAME.settleOverflowRot();
  };""",
    '逾溢折损 —— 与在线**同一个**结算函数')

print('\nA~C 段完成。')
