# -*- coding: utf-8 -*-
"""v89.95 Patch A —— 经济：黄金兑换比递减（物多价贱）+ 通商券真通道。
① data.js  DATA.MARKET_SLIP + 通商券文案（写明真实效果）
② domain.js 折价唯一出口 mktSlipOf/mktFreeOf + marketSellPer/Sell 接入 + 文案
③ systems.js trade 加速 → 真 buff（mktFree，废掉没人读的 tradeCut）
④ ui.js 市场面板显示「今日已售 / 当前汇率 / 通商券」
"""
import io

# ============================================================ ① data.js
P = 'js/data.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(text_old, text_new, tag):
    global s, n
    if text_new in s:
        print('SKIP: ' + tag)
        return
    assert text_old in s, 'MISS: ' + tag
    s = s.replace(text_old, text_new, 1)
    n += 1
    print('OK: ' + tag)


rep("""  DATA.GOLD_GATE = { tax: 0.3, salary: 0.3, yield: 0.3, market: 1 };""",
"""  DATA.GOLD_GATE = { tax: 0.3, salary: 0.3, yield: 0.3, market: 1 };

  /* ============================================================
   * v89.95（A2 · 老板）：**物多价贱** —— 当日卖得越多，兑换比越低
   * ------------------------------------------------------------
   * 老板原话：「每日售卖获得的黄金越多，将会导致黄金兑换比越低（物多价贱，
   *   最终甚至一文不值，使得售卖资源变得无利可图）」。
   * 病根：卖资源是**无上限**的黄金入口 —— 资源换金 → 金买一切 → 玩家"无所不能"，
   *   而产量本身是指数增长（v8992 实测：满仓一轮 ≈ 1.1 亿金），于是经济失控。
   * 口径（唯一出口 GAME.mktSlipOf）：
   *   · 市场每日能"吃下"的黄金当量 = scale（默认 20 万金/游戏日）；
   *   · 当日累计换金越多，汇率乘数越低：mul = max(floor, 1 − 已换金 / scale)；
   *   · 每**游戏日**清零（隔日恢复）；floor = 0.10 → "再卖也是一折，无利可图"。
   * 通商券（free）：把"免折额度"还给玩家 —— 见 DATA.MARKET_SLIP.free。
   * ⚠️ 总闸就在这里：嫌卡得太死只改 scale/floor，别在各处写第二份。
   * ============================================================ */
  DATA.MARKET_SLIP = {
    scale: 200000,          /* 每日免折抛售额度（金当量） */
    floor: 0.10,            /* 汇率乘数下限（物多价贱 → 一折） */
    free: { item: 'tongshang_quan', quota: 500000, durMin: 30 },   /* 通商券 */
  };""",
'DATA.MARKET_SLIP')

rep("""    { id: 'tongshang_quan', name: '通商券', type: 'boost', target: 'trade', pct: 0.5, price: 30, desc: '市场折损时间-50%（30 分钟）' },""",
"""    /* v89.95（A3）：**原来这张券没有任何"通道"** —— 使用后只弹一句"折损降低"，
       而那份 buff（tradeCut）全库没人读（典型死接线，老板点名）。
       现在它接的是真通道：**免折抛售**（在"物多价贱"的折价之上开一扇窗）。 */
    { id: 'tongshang_quan', name: '通商券', type: 'boost', target: 'trade', pct: 0.5, price: 30,
      desc: '通商凭信：30 分钟内可**免折抛售**资源，免折额度 50 万金当量（来源：商城）' },""",
'通商券文案')

if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED data.js x%d' % n)

# ============================================================ ② domain.js
P2 = 'js/domain.js'
s = io.open(P2, encoding='utf-8').read()
orig = s
n = 0

rep("""  GAME.marketSellCfg = function () { return DATA.MARKET_SELL || { res: [], ratio: {}, per: 20 }; };""",
"""  GAME.marketSellCfg = function () { return DATA.MARKET_SELL || { res: [], ratio: {}, per: 20 }; };

  /* ============================================================
   * v89.95（A2/A3）：**物多价贱**的折价 + 通商券的免折额度 —— 唯一出口
   * ------------------------------------------------------------
   * · `s.mktSold = { day, gold }`：本游戏日已从市场换走的黄金（懒初始化 + 隔日清零）；
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
  };""",
'折价出口')

rep("""    var gate = (DATA.GOLD_GATE && DATA.GOLD_GATE.market != null) ? DATA.GOLD_GATE.market : 1;
    return k / c.per * GAME.marketRate() * gate;""",
"""    var gate = (DATA.GOLD_GATE && DATA.GOLD_GATE.market != null) ? DATA.GOLD_GATE.market : 1;
    /* v89.95（A2）：再乘"物多价贱"的当日折价（通商券在手时按 1.0 结算） */
    return k / c.per * GAME.marketRate() * gate * GAME.mktMulNow();""",
'sellPer 接折价')

rep("""    var gold = GAME.marketSellGold(res, amount);
    if (gold < 1) return { ok: false, msg: '数量太少 —— 至少 ' + U.fmt(GAME.marketSellMin(res)) + ' 单位才够换 1 金' };
    s.res[res] -= amount;
    s.res.gold = (s.res.gold || 0) + gold;
    GAME.statBump('trades', 1);
    GAME.log('市易：售出 ' + U.fmt(amount) + ' 得金 ' + U.fmt(gold) + '。');
    return { ok: true, msg: '售出 ' + U.fmt(amount) + ' 得金 ' + U.fmt(gold), gold: gold };""",
"""    var gold = GAME.marketSellGold(res, amount);
    if (gold < 1) return { ok: false, msg: '数量太少 —— 至少 ' + U.fmt(GAME.marketSellMin(res)) + ' 单位才够换 1 金' };
    s.res[res] -= amount;
    s.res.gold = (s.res.gold || 0) + gold;
    GAME.mktSlipRecord(gold);                  /* v89.95：物多价贱 —— 记账（通商券额度一并扣） */
    GAME.statBump('trades', 1);
    GAME.log('市易：售出 ' + U.fmt(amount) + ' 得金 ' + U.fmt(gold) + '。' + GAME.mktSlipText());
    return { ok: true, msg: '售出 ' + U.fmt(amount) + ' 得金 ' + U.fmt(gold), gold: gold };""",
'marketSell 记账')

if s != orig:
    io.open(P2, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED domain.js x%d' % n)

# ============================================================ ③ systems.js
P3 = 'js/systems.js'
s = io.open(P3, encoding='utf-8').read()
orig = s
n = 0
rep("""    if (target === 'trade') {
      /* 交易加速：市场折损临时降低（此前落入兜底分支，提示"暂不可用"） */
      s.buffs = s.buffs || {};
      s.buffs.tradeCut = { until: U.now() + 30 * 60 * 1000, cut: (item.pct || 0.05) };
      return { ok: true, msg: '市场折损降低 ' + Math.round((item.pct || 0.05) * 100) + '%（30 分钟内）' };
    }""",
"""    if (target === 'trade') {
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
    }""",
'trade → mktFree')

if s != orig:
    io.open(P3, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED systems.js x%d' % n)
