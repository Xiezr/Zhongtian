# -*- coding: utf-8 -*-
"""v89.148 需求 1 —— 城外资源建筑容量改口径：等同同级仓库容量的 1/6
   data.js：EXT_STORE_PER_LV(20000) → EXT_STORE_DIV(6) + 注释重写
   domain.js：extStoreCapOf 改公式
"""
import io

def load(p): return io.open(p, encoding='utf-8', newline='').read()
def save(p, s, tag):
    assert '\r\n' not in s, 'CRLF'
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag)

PD = 'E:/Deepseekdb/js/data.js'
PN = 'E:/Deepseekdb/js/domain.js'

# ---------- data.js：注释块 + 常量 ----------
old = """  /* ============================================================
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
  DATA.EXT_STORE_PER_LV = 20000;

"""
new = """  /* ============================================================
   * 城外资源建筑自带的**露天堆场容量**（v89.141 建 · v89.148 改口径 · 老板 1）
   * ------------------------------------------------------------
   * 老板 v89.141 原话：「城外资源建筑还**自带一点上限容量**，设计各级别合理容量」；
   * 老板 v89.148 原话：「好像城外的资源建筑还没有根据等级设置一定的资源容量
   *   （提供本城资源上限），建议**等同同级仓库容量的六分之一**」。
   *
   * 现行口径（v89.148 起）：
   *   · 单块容量 = **该等级仓库容量 ÷ DATA.EXT_STORE_DIV**
   *     = `DATA.BASE_STORE × 地块等级 ÷ 6`（与 GAME.storeCapOf 同一把尺：仓库 1 级 200 万）；
   *   · 逐级：Lv1 = 33.3 万 / Lv6 = 200 万 / Lv12 = 400 万 / Lv24 = 800 万；
   *   · 全城合计 = Σ(地块等级) × BASE_STORE ÷ 6 —— 满配下约占满编仓容的一半
   *     （县 1.92 亿 / 都 7.68 亿 —— 是**能顶半边天**的经营资产，不再是零头）；
   *   · **不吃仓储加成**（储存科技 / 仓库专精 / 名城档位）—— 露天堆场与
   *     仓库体系解耦，加成的乘区只放仓库那一半（口径写在 GAME.storeCapOf）。
   *   · 消费点唯一：`GAME.extStoreCapOf(city)`（domain.js）→ 并入 storeCapOf。
   * ⚠️ 旧常量 `EXT_STORE_PER_LV = 20000`（等级×2 万）随本条**退役**——不许复活。
   * ============================================================ */
  DATA.EXT_STORE_DIV = 6;

"""
s = load(PD)
assert s.count(old) == 1, 'anchor(注释块) count=' + str(s.count(old))
s = s.replace(old, new)
save(PD, s, 'data.js 注释块 + EXT_STORE_DIV')

# ---------- domain.js：extStoreCapOf ----------
old2 = """  /* 城外资源建筑的露天堆场容量（v89.141 · 唯一出口）：
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
  };"""
new2 = """  /* 城外资源建筑的露天堆场容量（v89.141 建 · v89.148 改口径 · 唯一出口）：
     Σ（已建地块等级）× DATA.BASE_STORE ÷ DATA.EXT_STORE_DIV ——
     即**每块 = 同级仓库容量的 1/6**（老板 v89.148 口径；仓库容量 = BASE_STORE × 仓等级）。
     未建 / 在施工的地块不计；取整在**总和**上做一次（不是逐块取整，避免误差累积）。 */
  GAME.extStoreCapOf = function (city) {
    city = city || GAME.currentCity();
    if (!city) return 0;
    var DIV = DATA.EXT_STORE_DIV || 0;
    if (DIV <= 0) return 0;
    var lvSum = 0;
    GAME.extGridOf(city).forEach(function (e) {
      if (e && e.type) lvSum += Math.max(0, e.lv || 0);
    });
    return Math.round(lvSum * (DATA.BASE_STORE || 2000000) / DIV);
  };"""
s = load(PN)
assert s.count(old2) == 1, 'anchor(extStoreCapOf) count=' + str(s.count(old2))
s = s.replace(old2, new2)
save(PN, s, 'domain.js extStoreCapOf')

print('\nALL OK')
