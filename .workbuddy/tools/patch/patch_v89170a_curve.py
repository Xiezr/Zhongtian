# -*- coding: utf-8 -*-
"""v89.170 核心补丁：经验曲线「前期上抬 · 全程低于线性 · 单段幂律」
   · data.js：EXP_CURVE 段（注释 + 结构 + IIFE）整段替换
   · domain.js：expNeedOf 注释 + 函数体替换
   写盘用 newline='' 保 LF（§42.2）；每段带幂等守卫（落盘后特征唯一）。"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, p, old, new, guard):
    s = rd(p)
    if guard in s and old not in s:
        print('  [skip] ' + tag)
        return
    assert s.count(old) == 1, '[%s] 锚点计数=%d' % (tag, s.count(old))
    s = s.replace(old, new)
    wr(p, s)
    # 写后自检
    s2 = rd(p)
    assert guard in s2, '[%s] 写后缺新特征' % tag
    print('  [ ok ] ' + tag)

# ════════════════ A. data.js · EXP_CURVE 整段 ════════════════
OLD_A = """  /* ============================================================
   * 经验曲线（v89.82 · 老板澄清锚点：「**239 升 240 需要 100 万经验**，
   *   而不是 1 级升到 240 需要 100 万」）
   * ------------------------------------------------------------
   * ⛔ 退役口径（v89.43~v89.81）：把「100 万」当成 **1→240 的累计**，
   *    于是整条曲线被压到 1/32 —— 240 级单级只要 8982 经验，
   *    与"天授之资、百年一出"的定位完全不符（一场攻城就能顶掉好几级）。
   * ✅ 现在：把 100 万放在**曲线的锚点**上（need(240) = 1,000,000），
   *    形状沿用老板选的「前期二次起步」，但中后期从**线性改指数**：
   *      ⚠️ 线性 + 锚点在 240 会**断层** —— 210 级要涨到 100 万，平均每级 4760，
   *         于是 Lv31 会从 490 突跳到 5250（10 倍台阶）。指数则天然平滑衔接。
   *    ① Lv1~30（二次起步）：need = base + quad×Lv²        —— 41 → 490
   *    ② Lv31~240（指数递增）：need = 490 × growth^(Lv−30)  —— 508 → 1,000,000
   *       growth 由 needTop 反解 = (100万 / 490)^(1/210) ≈ 1.03696（每级 +3.7%）
   *    关键节点：Lv1 41 · Lv30 490 · Lv60 ≈1455 · Lv100 ≈6170 · Lv150 ≈3.8万
   *             Lv200 ≈23.7万 · **Lv240 = 100 万**
   *    累计（total）= Σ need(1..240)，**加载时累加算出**，供经验道具按百分比取额。
   * 与 v29 旧曲线的关系：旧曲线累计 3180 万 —— 本次（≈2800 万）与它同量级，
   *    所以那批道具的**旧面额与旧价格口径也是对的**（见 EXP_ITEM_SPEC 的 was 列）。
   * 老存档经验池仍按新曲线归一（见 domain.js migrateExpScale）——
   *    新 need **逐级都不小于旧 need**，所以截断只会更少，不会白送等级。
   * 调平衡只改这三个数：base / quad（前段形状）· seg1To（分段点）· needTop（锚点）。
   * ============================================================ */
  DATA.EXP_CURVE = {
    seg1To: 30, base: 40, quad: 0.5,
    topLv: 240,            /* 天授等级上限 —— 曲线定义的"最高一级" */
    needTop: 1000000,      /* 老板拍板：239→240 单级需 100 万 */
    growth: 0,             /* 由锚点反解，见下方 IIFE */
    total: 0,              /* Σ need(1..topLv)，同样由 IIFE 算出 */
  };
  (function () {
    var C = DATA.EXP_CURVE, s = C.seg1To;
    var seg2Base = C.base + C.quad * s * s;              /* 490 —— 与二次段末端正好衔接 */
    C.growth = Math.pow(C.needTop / seg2Base, 1 / (C.topLv - s));
    var sum = 0;
    for (var lv = 1; lv <= C.topLv; lv++) {
      sum += (lv <= s) ? (C.base + C.quad * lv * lv) : (seg2Base * Math.pow(C.growth, lv - s));
    }
    C.total = Math.round(sum);
  })();"""

NEW_A = """  /* ============================================================
   * 经验曲线（v89.170 · 老板：「前期所需经验太低…曲线应该上抬一点，
   *   比直接线性低，但低到目前的程度有点离谱了」）
   * ------------------------------------------------------------
   * ⛔ 退役口径（v89.82~v89.169）：两段式「Lv1~30 二次起步 + Lv31~240 指数
   *    （每级 ×1.037）」—— 锚点保住了，但**前段低到离谱**：
   *      · Lv100 的累计只占全曲线 **0.59%**，90% 的升级体验压在最后 40 级
   *        （Lv200 才 23.4%）；
   *      · 「兵仙遗篇」（商城 24 万金 = 曲线总量的 10%）从 Lv1 直升 **Lv177**
   *        —— 军队战斗与将领升级的体验被一个道具跳过（老板实测报的）；
   *      · Lv30→31 有折角（二次段末端每级 +29 → 指数段起点 +18，
   *        v89.168 曲线图体检时暴露的结构异常）。
   * ✅ 现在：**单段幂律**（全程平滑、无接缝）——
   *      need(lv) = 100万 × (lv/240)^1.25
   *    · 锚点不动：need(240) = 1,000,000（老板 v89.82 拍板的那条）；
   *    · 起步上抬：need(1) 41 → 1057（Lv1 也能感到"要练一练"）；
   *    · **全程低于线性**（老板要的形状）：把「Lv1 的实需 ~ Lv240 的 100 万」
   *      连成直线，曲线全程在其下方（Lv100 处约为直线的 81%）——
   *      既保持"前轻后重"的成长手感，又不再深趴在直线之下（旧口径约 1.5%）；
   *    · 折角消失：幂律单段，相邻涨幅平滑。
   *   关键节点（近似）：Lv1 1057 · Lv30 7.4万 · Lv60 17.7万 · Lv100 33.5万
   *            Lv150 55.6万 · Lv200 79.6万 · **Lv240 100 万**
   *   累计占比（体验分布）：Lv100 13.9%（旧 0.59%）· Lv150 34.7%（旧 3.8%）
   *            · Lv200 66.4%（旧 23.4%）—— 前中段的"份量"回来了。
   *   道具效果（EXP_ITEM_SPEC 按总量百分比取额，自动跟随）：
   *     练兵经验 800 金 Lv1→5 · 兵仙遗篇 24 万金 Lv1→86（旧 177）·
   *     千古兵圣 40 万金 Lv1→117（旧 196）—— 没有任何一份道具能"一步登天"。
   *     （**兵仙遗篇的等级效果**就是老板报的那件事，smoke §170 直接断言它 ≤ Lv90。）
   *   累计（total）= Σ need(1..240)，**加载时累加算出**（经验道具按百分比取额）。
   * ⚠️ 保命三条（与 v89.43/v89.82 一脉）：
   *    ① 老档经验池不白送等级 —— 新曲线 need 全程 ≥ 旧曲线（唯 Lv240 相等），
   *       故 migrateExpScale 的截断只会更少，不会白送；
   *    ② 练功（需求 ×10%）与战斗（封顶 0.8 级/场）都是**相对口径**，
   *       升级节奏不受曲线高低影响（曲线抬升只影响"绝对经验口径"：
   *       道具效果、侦察 30 固定、采集 20+ 固定）；
   *    ③ 「天授上限 240 / 239→240 需 100 万」两条拍板不变。
   * 调平衡只改这两个数：alpha（形状）· needTop（锚点）。
   * ============================================================ */
  DATA.EXP_CURVE = {
    topLv: 240,            /* 天授等级上限 —— 曲线定义的"最高一级" */
    needTop: 1000000,      /* 老板拍板：239→240 单级需 100 万 */
    alpha: 1.25,           /* v89.170：1.25 次幂 —— 上抬前期、全程低于线性 */
    total: 0,              /* Σ need(1..topLv)，由下方 IIFE 算出 */
  };
  (function () {
    var C = DATA.EXP_CURVE, sum = 0;
    for (var lv = 1; lv <= C.topLv; lv++) {
      /* 与 domain.js 的 expNeedOf **同一表达式**（逐项 round 后累加） */
      sum += Math.round(C.needTop * Math.pow(lv / C.topLv, C.alpha));
    }
    C.total = Math.round(sum);
  })();"""

rep('A · data.js EXP_CURVE 整段', 'js/data.js', OLD_A, NEW_A,
    "need(lv) = 100万 × (lv/240)^1.25")

# ════════════════ B. domain.js · expNeedOf ════════════════
OLD_B = """  /* 升级所需经验（唯一口径）。
     v26（需求 1）：原先 battle.js / ui.js 各写了一遍 `g.level*g.level*100`，
     一旦要改公式就得同时改三处 —— 收敛到这里，其余地方一律调用。
     v89.82（老板澄清）：「**239 升 240 需要 100 万**，而不是 1 级升到 240 需要 100 万」——
     锚点改到 need(240)，中后期由线性改**指数**（线性+锚点在 240 会在 Lv31 断层 10 倍）：
       Lv ≤ seg1To：base + quad×Lv²（二次起步）
       Lv > seg1To：(base + quad×seg1To²) × growth^(Lv−seg1To)（指数递增，growth 由锚点反解） */
  GAME.expNeedOf = function (g) {
    var lv = Math.max(1, (g && g.level) || 1);
    var C = DATA.EXP_CURVE, s = C.seg1To;
    if (lv <= s) return Math.round(C.base + C.quad * lv * lv);
    return Math.round((C.base + C.quad * s * s) * Math.pow(C.growth, lv - s));
  };"""

NEW_B = """  /* 升级所需经验（唯一口径）。
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
  };"""

rep('B · domain.js expNeedOf', 'js/domain.js', OLD_B, NEW_B,
    "need(lv) = needTop × (lv / topLv)^alpha")

print('\n补丁 A/B 完成。')
