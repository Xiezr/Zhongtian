# -*- coding: utf-8 -*-
# v89.141 批 A1：12×9 封顶 + 城外露天容量 + FIELD_MARGIN 清理
#   · data.js：EXT_CAP_MAX=108 + 两表封顶 + EXT_STORE_PER_LV
#   · domain.js：extStoreCapOf 新出口 + storeCapOf 并入 + extCap fallback
#   · tactic.js：FIELD_MARGIN 墓碑
import io, os, sys

ROOT = 'E:/Deepseekdb/'
ok = []

def patch(rel, pairs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:40]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(rel + ':' + tag)
    assert '\r\n' not in s, rel + ' 行尾混入 CRLF'
    tmp = p + '.tmp141'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    assert len(chk) == len(s)
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))

# ══════════════ data.js ══════════════
patch('js/data.js', [
    # ① 城外容量常量（放 EXT_BUILD_ORDER 之后）
    ("  DATA.EXT_BUILD_ORDER = ['farm', 'forest', 'quarry', 'mine'];",
     """  DATA.EXT_BUILD_ORDER = ['farm', 'forest', 'quarry', 'mine'];

  /* ============================================================
   * 城外资源建筑自带的**露天堆场容量**（v89.141 · 老板 0）
   * ------------------------------------------------------------
   * 老板原话：「城外资源建筑还**自带一点上限容量**，设计各级别合理容量」。
   *
   * 设计口径（可复算、可断言）：
   *   · 单块容量 = 等级 × 本常量（**线性**，与仓库同构 —— 仓库 1 级 200 万）；
   *   · 逐级：Lv1 = 2 万 / Lv6 = 12 万 / Lv12 = 24 万 / Lv24 = 48 万；
   *   · "一点"的验收（对照满配仓容）：
   *       县档 48 块 × Lv12 = 1152 万 ≈ 县满配 2.41 亿的 **4.8%**；
   *       都档 96 块 × Lv24 = 4608 万 ≈ 都满配 9.10 亿的 **5.1%** ——
   *       全档位稳定落在"约 5%"的添头量级：早期（仓库没几座）能感知，
   *       后期是零头，**不替代仓库**（仓库仍是绝对主力）。
   *   · **不吃仓储加成**（储存科技 / 仓库专精 / 名城档位）—— 露天堆场与
   *     仓库体系解耦，加成的乘区只放仓库那一半（口径写在 GAME.storeCapOf）。
   *   · 消费点唯一：`GAME.extStoreCapOf(city)`（domain.js）→ 并入 storeCapOf。
   * ============================================================ */
  DATA.EXT_STORE_PER_LV = 20000;""",
     'EXT_STORE_PER_LV'),

    # ② EXT_CAP_BY_LV：加 MAX 常量 + 封顶续段
    ("""  DATA.EXT_CAP_BY_LV = [12, 15, 18, 21, 24, 27, 30, 33, 36, 40, 44, 48];
  /* v54：官府在名城能盖得更高（都城到 24），表要跟着长。
     末段步长沿用 +4（就是 10→12 级那一档的步长），口径唯一、可写断言。
     不续的话 `extCap` 会一直取到最后一项 48 —— 都城 20 级官府还只能占 48 块地。 */
  (function () {
    while (DATA.EXT_CAP_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      DATA.EXT_CAP_BY_LV.push(DATA.EXT_CAP_BY_LV[DATA.EXT_CAP_BY_LV.length - 1] + 4);
    }
  })();""",
     """  /* ------------------------------------------------------------
   * v89.141（老板 0）：「城外地块**最多为 12×9 块**，后续官府升级不再增加」
   * ------------------------------------------------------------
   * `EXT_CAP_MAX = 108` 是**布局的物理上限**（12 列 × 9 行 = 整网格），
   * 不是又一个随等级涨的数字 —— 两张表（本表 + EXT_PLAN_BY_LV）到 108 后
   * 一律**平顶**，官府再升也不加地。
   * 上一版续段是无脑 +4（都城档 96、满爵官府能到 180）：地块越铺越长、
   * 网格撑成怪比例，且 8 列的末行永远缺口（"看着像掉了块地"）。
   * 曲线：Lv1..12 = 12..48（原节奏不动）→ Lv13 起 +4/级 → Lv27 达 108 封顶。 */
  DATA.EXT_CAP_MAX = 108;
  DATA.EXT_CAP_BY_LV = [12, 15, 18, 21, 24, 27, 30, 33, 36, 40, 44, 48];
  /* v54：官府在名城能盖得更高（都城到 24），表要跟着长。
     末段步长沿用 +4（就是 10→12 级那一档的步长），**但以 EXT_CAP_MAX 封顶**。 */
  (function () {
    while (DATA.EXT_CAP_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      var prevCap = DATA.EXT_CAP_BY_LV[DATA.EXT_CAP_BY_LV.length - 1];
      DATA.EXT_CAP_BY_LV.push(Math.min(DATA.EXT_CAP_MAX, prevCap + 4));
    }
  })();""",
     'EXT_CAP_BY_LV 封顶'),

    # ③ EXT_PLAN_BY_LV 封顶
    ("""  (function () {
    while (DATA.EXT_PLAN_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      var last = DATA.EXT_PLAN_BY_LV[DATA.EXT_PLAN_BY_LV.length - 1];
      DATA.EXT_PLAN_BY_LV.push(last.map(function (n) { return n + 1; }));
    }
  })();""",
     """  (function () {
    /* v89.141：与 EXT_CAP_BY_LV 同步**平顶** —— 四类各 +1 直到合计 = EXT_CAP_MAX；
       到顶后逐级复制上一档（不再增长，也不再"+1 越界"）。 */
    while (DATA.EXT_PLAN_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      var last = DATA.EXT_PLAN_BY_LV[DATA.EXT_PLAN_BY_LV.length - 1].slice();
      var sum = last.reduce(function (a, b) { return a + b; }, 0);
      for (var i = 0; i < last.length && sum < DATA.EXT_CAP_MAX; i++) { last[i]++; sum++; }
      DATA.EXT_PLAN_BY_LV.push(last);
    }
  })();""",
     'EXT_PLAN_BY_LV 封顶'),

    # ④ EXT_BUILDINGS 注释头（旧公式引用）
    ("""   * 城外资源建筑（4种 · 数量制，上限=12+(官府等级-1)×3）
   * 产量统一 = 占用人口×10 /h（10级 5500/h）；消耗逐级≈×2""",
     """   * 城外资源建筑（4种 · 地块制，上限按官府等级查表 → 至 EXT_CAP_MAX(108=12×9) 封顶）
   * 产量统一 = 占用人口×10 /h（10级 5500/h）；消耗逐级≈×2
   * v89.141：每块**自带露天堆场容量**（等级 × DATA.EXT_STORE_PER_LV，见下方常量）""",
     'EXT_BUILDINGS 注释'),
])

# ══════════════ domain.js ══════════════
patch('js/domain.js', [
    # ① extCap：注释 + fallback
    ("""  GAME.extCap = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;
    /* v24（需求 7）：按官府等级查表（10 级 = 40 块，正好 8 列 × 5 整行）。
       旧公式 12+(lv-1)×3 到 10 级是 39，末行缺一格，看着像掉了块地。 */
    var t = DATA.EXT_CAP_BY_LV || [];
    var n = t[Math.max(0, Math.min(lv - 1, t.length - 1))];
    return n != null ? n : 12 + (lv - 1) * 3;
  };""",
     """  GAME.extCap = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;
    /* v24（需求 7）：按官府等级查表。
       v89.141（老板 0）：「城外地块最多为 12×9 块，后续官府升级不再增加」——
       表在 DATA.EXT_CAP_MAX(108) 平顶（约官府 Lv27 到顶），此后官府再升不加地。 */
    var t = DATA.EXT_CAP_BY_LV || [];
    var n = t[Math.max(0, Math.min(lv - 1, t.length - 1))];
    return n != null ? n : Math.min(DATA.EXT_CAP_MAX || 108, 12 + (lv - 1) * 3);
  };""",
     'extCap 封顶'),

    # ② storeCapOf：并入城外露天容量 + 新出口
    ("""    var mStore = (GAME.mastery && lv > 0) ? GAME.mastery('storePct', city) : 0;
    return Math.round(base * (1 + techB('store'))
      * (1 + mStore)
      * (1 + GAME.cityBonusNum(city, 'storePct')));   /* v79：+ 爵位/主城/神器 仓储 */
  };""",
     """    var mStore = (GAME.mastery && lv > 0) ? GAME.mastery('storePct', city) : 0;
    /* v89.141（老板 0）：「城外资源建筑还自带一点上限容量」——
       **纯加法**（不吃仓储加成：露天堆场与仓库体系解耦，见 DATA.EXT_STORE_PER_LV）。 */
    return Math.round(base * (1 + techB('store'))
      * (1 + mStore)
      * (1 + GAME.cityBonusNum(city, 'storePct')))   /* v79：+ 爵位/主城/神器 仓储 */
      + GAME.extStoreCapOf(city);
  };
  /* 城外资源建筑的露天堆场容量（v89.141 · 唯一出口）：
     Σ（已建地块等级 × DATA.EXT_STORE_PER_LV）。未建/在施工的地块不计。 */
  GAME.extStoreCapOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var per = DATA.EXT_STORE_PER_LV || 0;
    if (per <= 0) return 0;
    var n = 0;
    GAME.extGridOf(city).forEach(function (e) {
      if (e && e.type) n += Math.max(0, e.lv || 0) * per;
    });
    return n;
  };""",
     'storeCapOf + extStoreCapOf'),
])

# ══════════════ tactic.js ══════════════
patch('js/tactic.js', [
    ("""  T.FIELD_RANGE_K = 1.25;
  T.FIELD_MARGIN = 299;""",
     """  T.FIELD_RANGE_K = 1.25;
  /* ⛔ v89.141：射程**加数式**常数（FIELD_MARGIN，值 299）已删 ——
     v89.140 起纵深改**比例式**（最远射程 × FIELD_RANGE_K），加数式是历史口径；
     留着只会让人以为"哪里还有一处 +299"。纵深三段口径见 battlefieldOf。 */""",
     'FIELD_MARGIN 墓碑'),
])

print('✅ 批 A1 完成：' + ' / '.join(ok))
