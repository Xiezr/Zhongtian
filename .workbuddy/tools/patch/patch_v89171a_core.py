# -*- coding: utf-8 -*-
"""v89.171 补丁 A（核心）：
    经验道具「前期化」—— 数据层 capLv + expCumOf / 闸门唯一出口 / 两条消费链。

老板原文：「经验道具的经验值设置基于什么考虑，看起来很高，建议最多能只能前期升级，
          不然后边纯买道具了」

设计：
  · EXP_ITEM_SPEC 每档加 capLv（培养上限 10~60 · 全族 ≤ 凡品段 60）
  · 量 = DATA.expCumOf(capLv)（从 Lv1 培养到该上限的累计经验）——「一本到线」
  · GAME.expItemGrantOf：等级 ≥ 上限 → 不可用；低于上限 → 到线即止（超出不生效）
写盘纪律：先读 → 改 → newline='' 写；每段幂等守卫；跑完 node --check。
"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

DONE = []

def rep(path, tag, old, new, guard):
    s = rd(path)
    if guard in s:
        print('  [skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, '锚点失配 %s count=%d' % (tag, c)
    wr(path, s.replace(old, new))
    DONE.append(tag)
    print('  [ ok ] ' + tag)


# ══════════════════ A. data.js ══════════════════

# A1. 曲线注释里的"道具效果"段 → 新口径
rep('js/data.js', 'A1 曲线注释·道具效果',
    """   *   道具效果（EXP_ITEM_SPEC 按总量百分比取额，自动跟随）：
   *     练兵经验 800 金 Lv1→5 · 兵仙遗篇 24 万金 Lv1→86（旧 177）·
   *     千古兵圣 40 万金 Lv1→117（旧 196）—— 没有任何一份道具能"一步登天"。
   *     （**兵仙遗篇的等级效果**就是老板报的那件事，smoke §170 直接断言它 ≤ Lv90。）""",
    """   *   道具效果（v89.171 起：EXP_ITEM_SPEC 按 capLv 累计取额、到线即止 —— 见该表注释）：
   *     练兵经验 800 金 培养至 Lv10 · 兵仙遗篇 24 万金 至 Lv50 ·
   *     千古兵圣 40 万金 至 Lv60（全族封顶 = 凡品段）—— 道具**只服务前期**：
   *     60 级以上一整族都用不了（老板 v89.171：「不然后边纯买道具了」）。""",
    guard='v89.171 起：EXP_ITEM_SPEC 按 capLv 累计取额')

# A2. 新增 DATA.expCumOf（累计经验唯一出口，紧跟 total 的 IIFE）
rep('js/data.js', 'A2 DATA.expCumOf',
    """    C.total = Math.round(sum);
  })();""",
    """    C.total = Math.round(sum);
  })();
  /* 从 Lv1（经验 0）培养到 Lv{lv} 所需的**累计经验**（Σ need(1..lv−1)）。
     经验道具的"面额"（v89.171 按 capLv 现算）与「到线即止」判定都读它 ——
     唯一出口，别再各算一份；与上面的 total / domain 的 expNeedOf 同源（逐项 round 后累加）。 */
  DATA.expCumOf = function (lv) {
    var C = DATA.EXP_CURVE, n = Math.max(1, Math.min(C.topLv + 1, Math.round(Number(lv) || 1))), sum = 0;
    for (var i = 1; i < n; i++) sum += Math.round(C.needTop * Math.pow(i / C.topLv, C.alpha));
    return sum;
  };""",
    guard='DATA.expCumOf = function (lv)')

# A3. 11 行加 capLv（逐行替换，pct 退役）
NEW_SEG = {
    10: "price: 8,     was:", 15: "price: 19,    was:", 20: "price: 36,    was:",
    25: "price: 102,   was:", 30: "price: 192,   was:", 35: "price: 450,   was:",
    40: "price: 840, was:", 45: "price: 1560, was:", 50: "price: 2400,  was:",
    55: "price: 3300,  was:", 60: "price: 4000,  was:",
}
ROWS = [
    ('练兵经验', 10, "pct: 0.0002, price: 8,     was:"),
    ('裨将手记', 15, "pct: 0.0005, price: 19,    was:"),
    ('兵法心得', 20, "pct: 0.0010, price: 36,    was:"),
    ('校尉札记', 25, "pct: 0.0030, price: 102,   was:"),
    ('治军之道', 30, "pct: 0.0060, price: 192,   was:"),
    ('将军战录', 35, "pct: 0.0150, price: 450,   was:"),
    ('大都督兵法', 40, "pct: 0.0300, price: 840, was:"),
    ('名将心传', 45, "pct: 0.0600, price: 1560, was:"),
    ('兵仙遗篇', 50, "pct: 0.1000, price: 2400,  was:"),
    ('太公兵书', 55, "pct: 0.1500, price: 3300,  was:"),
    ('千古兵圣', 60, "pct: 0.2000, price: 4000,  was:"),
]
for nm, cap, oldseg in ROWS:
    old = "name: '%s', %s" % (nm, oldseg)
    new = "name: '%s', capLv: %d, %s" % (nm, cap, NEW_SEG[cap])
    rep('js/data.js', 'A3 行 %s capLv=%d' % (nm, cap), old, new,
        guard="name: '%s', capLv: %d" % (nm, cap))

# A3b. 取额循环：pct×total → expCumOf(capLv) + desc 带上限
rep('js/data.js', 'A3b 取额循环',
    """    (function () {
      var total = (DATA.EXP_CURVE && DATA.EXP_CURVE.total) || 1000000;
      DATA.EXP_ITEM_SPEC.forEach(function (sp) {
        var it = null;
        DATA.ITEMS.forEach(function (x) { if (x.id === sp.id) it = x; });
        if (!it) return;                       /* 表里没有就跳过（不凭空造物品） */
        it.amount = Math.max(1, Math.round(total * sp.pct));
        it.price = sp.price;
        it.desc = '将领经验+' + it.amount;
      });
    })();""",
    """    (function () {
      DATA.EXP_ITEM_SPEC.forEach(function (sp) {
        var it = null;
        DATA.ITEMS.forEach(function (x) { if (x.id === sp.id) it = x; });
        if (!it) return;                       /* 表里没有就跳过（不凭空造物品） */
        it.capLv = sp.capLv;                   /* v89.171：培养上限（低于它才能用） */
        it.amount = Math.max(1, DATA.expCumOf(sp.capLv));   /* 量 = 从 Lv1 培养到上限的累计（唯一出口） */
        it.price = sp.price;
        it.desc = '将领经验+' + it.amount + '（最多培养至 Lv' + it.capLv + '）';
      });
    })();""",
    guard="it.amount = Math.max(1, DATA.expCumOf(sp.capLv))")

# A4. 阶梯口径注释块重写（退役两条旧口径 + 新口径）
rep('js/data.js', 'A4 阶梯口径注释',
    """     * 阶梯口径（两条都刻意保住，否则"修好一个坏三个"）：
     *   ① 单价越大、**每金换到的经验越多**（大宗优惠）—— 250 → 500 经验/千金，单调递增；
     *   ② 最贵的千古兵圣也只抵曲线的 **1/5**，满级必须多份叠加，
     *      不再有任何单件道具能"一颗到 240"。
     * ⚠️ 价格（内部价 · 商城实售 = price × 100 金）同比下调：曲线缩了 32 倍，价格不缩的话最小的练兵经验
     *    会只剩 3 点经验（等于把道具变成废品）—— 那不是修 bug，是砸系统。
     * 调平衡只改这张表（pct = 占曲线比例，price = 内部价，商城实售 = price × 100 金）。""",
    """     * 阶梯口径（v89.171 重设 · 老板「看起来很高，建议最多能只能前期升级，不然后边纯买道具了」）：
     *   · 每档绑定**培养上限** capLv（10~60）：**低于上限才能用**、效果**到线即止**
     *     （最多把将领带到该档上限，超出部分不生效）；全族上限 60 = 凡品段上限 ——
     *     「经验道具只服务前期」在构造上成立（60 级以上一整族都用不了）。
     *   · 量 = `DATA.expCumOf(capLv)`（从 Lv1 培养到该上限的累计经验）——「一本到线」：
     *     从任意低于上限的等级使用，一次投入即培养到该档上限。曲线一改自动跟随。
     *   · 退役口径①「每金换到的经验单调递增（大宗优惠）」：道具从"同质替代品"
     *     变为"阶梯台阶"（各档各有窗口、同一将领每档只生效一次），跨档比效率已无意义。
     *   · 退役口径②「单件 ≤ 总量 1/5」：被硬上限取代（最大档 = 总量的 4.3%）。
     * ⚠️ 价格（内部价 · 商城实售 = price × 100 金）**未动**（延续 v89.73 / v89.104 的定价）。
     * 调平衡只改这张表（capLv = 培养上限，price = 内部价，商城实售 = price × 100 金）。""",
    guard='v89.171 重设 · 老板')


# ══════════════════ B. domain.js ══════════════════

rep('js/domain.js', 'B1 expItemCapOf / expItemGrantOf',
    "  GAME.expBlocked = function (g) { return !!GAME.expBlockOf(g); };",
    """  GAME.expBlocked = function (g) { return !!GAME.expBlockOf(g); };
  /* ============================================================
   * 经验道具的**培养上限**（v89.171 · 老板「经验值设置…看起来很高，建议最多能
   *   只能前期升级，不然后边纯买道具了」）
   * ------------------------------------------------------------
   * 每档道具带 capLv（培养上限，10~60 · 全族 ≤ 凡品段上限 60）：
   *   · 将领等级 ≥ capLv → **不可使用**（道具只服务前期，构造上杜绝"后边纯买道具"）；
   *   · 低于上限使用时，效果**到线即止**（最多带到 capLv，超出部分不生效）。
   * 界面（选择窗）与两个消费点（单个使用 / 批量使用）一律走同一出口 ——
   * 「界面与执行同一把尺」是本仓铁律（v89.73 起 expBlockOf 就是这个形状）。
   * ============================================================ */
  GAME.expItemCapOf = function (item) {
    if (!item) return 0;
    return (item.capLv > 0) ? item.capLv : 60;   /* 兜底 60（所有 exp 道具都应在 EXP_ITEM_SPEC 在册） */
  };
  GAME.expItemGrantOf = function (g, item) {
    if (!g || !item) return { ok: false, msg: '道具或将领不存在' };
    var blk = GAME.expBlockOf(g);                /* 先过资质/君主段闸（既有口径，消息照旧） */
    if (blk) return { ok: false, msg: blk };
    var cap = GAME.expItemCapOf(item);
    if ((g.level || 1) >= cap) {
      return { ok: false, cap: cap, msg: '「' + item.name + '」只服务前期（最多培养至 Lv' + cap
        + '）—— ' + g.name + ' 已 Lv' + g.level + '，无法使用' };
    }
    var rem = DATA.expCumOf(cap) - DATA.expCumOf(g.level) - (g.exp || 0);
    if (rem <= 0) {
      return { ok: false, cap: cap, msg: '「' + item.name + '」最多培养至 Lv' + cap + '，'
        + g.name + ' 已至该线' };
    }
    /* 神器经验加成（gainExp 内部乘）要换算回"入账前"，否则 1.06 倍会越过上限；
       ceil 保底 —— 入账后 ≥ rem，保证真"到线"。capped = 本次会到线（受上限约束）。 */
    var b = 1 + ((GAME.artifactBonusNum && GAME.artifactBonusNum('genExpPct')) || 0);
    var capped = (item.amount || 0) * b >= rem;
    var grant = Math.min(item.amount || 0, Math.ceil(rem / b));
    return { ok: true, cap: cap, grant: grant, capped: capped };
  };""",
    guard='GAME.expItemGrantOf = function (g, item)')


# ══════════════════ C. systems.js ══════════════════

rep('js/systems.js', 'C1 useItem 头部 gain 变量',
    "    var ok = false, msg = '';",
    "    var ok = false, msg = '', gain = 0;   /* v89.171：gain 供 exp 分支回传「实得」（面额可能被上限截断） */",
    guard="var ok = false, msg = '', gain = 0;")

rep('js/systems.js', 'C2 useItem exp 分支',
    """      /* v66（老板）：「将领等级到上限后不能再使用经验道具」——
         到上限时经验只会堆着不升级，道具却在减少，等于白烧。
         判据走唯一出口 GAME.expBlockOf。 */
      var blk = GAME.expBlockOf ? GAME.expBlockOf(g3) : '';
      if (blk) return { ok: false, msg: blk };
      /* v26（需求 1）：走唯一入口 gainExp（含升级日志与等级结算） */
      GAME.battle.gainExp(g3, item.amount, '使用 ' + item.name);
      ok = true; msg = g3.name + ' 经验 +' + item.amount;""",
    """      /* v89.171（老板「道具只能前期升级，不然后边纯买道具」）：
         闸门与额度走**唯一出口** GAME.expItemGrantOf —— 内含 v66 的资质上限闸（expBlockOf），
         并追加**培养上限**（capLv，10~60）与「到线即止」的额度折算（超出部分不生效）。 */
      var gt3 = GAME.expItemGrantOf ? GAME.expItemGrantOf(g3, item) : { ok: true, grant: item.amount };
      if (!gt3.ok) return { ok: false, msg: gt3.msg };
      /* v26（需求 1）：走唯一入口 gainExp（含升级日志与等级结算） */
      var rg3 = GAME.battle.gainExp(g3, gt3.grant, '使用 ' + item.name);
      var got3 = (rg3 && rg3.gain) || gt3.grant;
      gain = got3;                       /* v89.171：批量口按**实得**累加（面额可能被上限截断） */
      ok = true;
      msg = g3.name + ' 经验 +' + U.numText(got3, 0)
        + (gt3.capped ? '（已达「' + item.name + '」的培养上限 Lv' + gt3.cap + '）' : '');""",
    guard='闸门与额度走**唯一出口** GAME.expItemGrantOf')

rep('js/systems.js', 'C3 useItem 返回带 gain',
    "    return { ok: ok, msg: msg };",
    "    return { ok: ok, msg: msg, gain: gain };",
    guard='return { ok: ok, msg: msg, gain: gain };')

rep('js/systems.js', 'C4 gainExpByItem 闸门',
    """    /* v66：到资质上限时直接拦住（否则循环里 useItem 会一直拒绝，
       外面只会看到一句含糊的"未能使用 XX"）。 */
    var blk = GAME.expBlockOf ? GAME.expBlockOf(g) : '';
    if (blk) return { ok: false, msg: blk };""",
    """    /* v66：到资质上限时直接拦住（否则循环里 useItem 会一直拒绝，
       外面只会看到一句含糊的"未能使用 XX"）。
       v89.171：闸门升级为**唯一出口** GAME.expItemGrantOf（含资质上限 + 培养上限 capLv）。 */
    var gt0 = GAME.expItemGrantOf ? GAME.expItemGrantOf(g, item) : null;
    if (gt0 && !gt0.ok) return { ok: false, msg: gt0.msg };""",
    guard='var gt0 = GAME.expItemGrantOf ? GAME.expItemGrantOf(g, item) : null;')

rep('js/systems.js', 'C5 gainExpByItem 实得累加',
    """    var lv0 = g.level, used = 0;
    var limit = (mode === 'one') ? 1 : have;
    while (used < limit) {
      var r = S.useItem(itemId, genId, { silent: true });
      if (!r.ok) break;
      used++;
      if (mode === 'till' && g.level > lv0) break;   // 只在"用到升级"时提前收手
    }
    if (!used) return { ok: false, msg: '未能使用 ' + item.name };
    var gain = used * item.amount, up = g.level - lv0;""",
    """    var lv0 = g.level, used = 0, gotSum = 0;
    var limit = (mode === 'one') ? 1 : have;
    while (used < limit) {
      var r = S.useItem(itemId, genId, { silent: true });
      if (!r.ok) break;
      used++;
      gotSum += (r.gain || 0);                       /* v89.171：按实得累加（面额可能被培养上限截断） */
      if (mode === 'till' && g.level > lv0) break;   // 只在"用到升级"时提前收手
    }
    if (!used) return { ok: false, msg: '未能使用 ' + item.name };
    var gain = gotSum || (used * item.amount), up = g.level - lv0;""",
    guard='var lv0 = g.level, used = 0, gotSum = 0;')

rep('js/systems.js', 'C6 gainExpByItem 消息带上限',
    """      msg: item.name + ' ×' + used + '：' + g.name + ' 经验 +' + U.numText(gain, 0)
        + (up > 0 ? '，升至 Lv' + g.level : '（' + U.numText(need - g.exp, 0) + ' 后升级）'),""",
    """      msg: item.name + ' ×' + used + '：' + g.name + ' 经验 +' + U.numText(gain, 0)
        + (up > 0 ? '，升至 Lv' + g.level : '（' + U.numText(need - g.exp, 0) + ' 后升级）')
        + ((gt0 && gt0.capped) ? '（已达「' + item.name + '」的培养上限 Lv' + gt0.cap + '）' : ''),""",
    guard="(gt0 && gt0.capped) ? '（已达「' + item.name + '」的培养上限 Lv' + gt0.cap")

print('\n落盘段数：%d' % len(DONE))
print('OK')
