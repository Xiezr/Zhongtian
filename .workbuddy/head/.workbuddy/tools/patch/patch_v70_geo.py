# -*- coding: utf-8 -*-
"""v70 · 第 1 块：州郡县标识 + 城外满配数量表 + 城内仓库 4 座。

老板原话（2026-09-14 夜，需求 2）：
  「为名城固定坐标，每个名城按州郡县标识（假设青州琅琊郡XX县）……
    其他野地城池的标识应写上其所在县。所有野外城池应满建筑（城内所有建筑 1 个，
    但是军营 2 个，**仓库 4 个**，其他以民居填充……城外根据官府等级，也要满建筑，
    你设计一个各建筑数量对应官府等级表，使数量合理）」

改动：
  ① data.js   DATA.CITY_PLAN.order —— 仓库 1 → 4（分组在「市场」之后）
  ② data.js   DATA.EXT_PLAN_BY_LV —— 城外数量表（合计**恰等于** EXT_CAP_BY_LV）+ 13 级起续表
  ③ state.js  GAME.extPlanOf（唯一出口）+ npcCityShadow 改吃它（不再用 2:2:1:1:1 循环）
  ④ domain.js GAME.regionOf / junNameOf / countyNameOf / cityFullName / fortLabelOf（州郡县唯一出口）
  ⑤ smoke     第 46 节的 5 条旧规则断言 → 同步到新规则（仓库 4 / order 17 / 民房 27）

用法：python patch_v70_geo.py     （幂等；锚点不唯一就拒绝写盘）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
DATA = J('js', 'data.js')
STATE = J('js', 'state.js')
DOMAIN = J('js', 'domain.js')
SMOKE = J('smoke-test.js')


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def save_lf(p, s, tag):
    if '\r' in s:
        print('!! %s：内容含 CR，拒绝写盘' % tag)
        return False
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    if b'\r' in io.open(p, 'rb').read():
        print('!! %s：落盘核验失败（出现 CR）' % tag)
        return False
    return True


def cut(src, old, new, tag, optional=False):
    n = src.count(old)
    if n == 0:
        if optional:
            print('  · %s：锚点不存在（已改过？跳过）' % tag)
            return src
        print('!! %s：锚点 0 次命中，拒绝写盘' % tag)
        return None
    if n > 1:
        print('!! %s：锚点 %d 次命中（必须唯一），拒绝写盘' % (tag, n))
        return None
    print('  ✓ %s' % tag)
    return src.replace(old, new, 1)


# ============================================================
# ① 城内：仓库 1 → 4
# ============================================================
ORDER_OLD = """    order: ['junying', 'junying', 'shuyuan', 'xiaochang', 'shichang', 'cangku', 'kezhan',
      'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'],"""

ORDER_NEW = """    /* v70（老板）：「城内所有建筑 1 个，但是军营 2 个，**仓库 4 个**，其他以民居填充」——
       仓库 1 → 4（分仓：营建与养兵都吃存量，仓容是经营主线），四座挨着排、成"仓廪区"。
       民房数随之 30 → 27（人口上限按民房座数派生，见 `GAME.planPopCapOf`，自动跟着走）。 */
    order: ['junying', 'junying', 'shuyuan', 'xiaochang', 'shichang',
      'cangku', 'cangku', 'cangku', 'cangku',
      'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'],"""

# ============================================================
# ② 城外：数量表（插在 EXT_CAP 续表之后）
# ============================================================
CAP_ANCHOR = """  (function () {
    while (DATA.EXT_CAP_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      DATA.EXT_CAP_BY_LV.push(DATA.EXT_CAP_BY_LV[DATA.EXT_CAP_BY_LV.length - 1] + 4);
    }
  })();
"""

CAP_NEW = CAP_ANCHOR + """
  /* ============================================================
   * 城外地块的**数量表**（v70 · 老板）—— 唯一出口 `GAME.extPlanOf`
   * ------------------------------------------------------------
   * 老板原话：「城外根据官府等级，也要满建筑，你设计一个各建筑数量对应官府等级表，使数量合理」
   * 改前：按 ['farm','farm','forest','quarry','mine'] 循环填满上限 ——
   *   数量比恒为 2:2:1:1:1，与官府等级没有关系（等于没设计）。
   * 改后：`EXT_PLAN_BY_LV[lv-1] = [农田, 伐木场, 采石场, 铁矿场]`，
   *   **合计恰等于 `EXT_CAP_BY_LV[lv-1]`**（"满建筑"= 一块不空、一块不多）。
   *
   * 设计口径（可复算、可断言）：
   *   · 粮是养兵主线（见 AI工作备忘 §十五 阶梯复算：缺口卡在粮上）→ 农田恒占 1/3 上下；
   *   · 早期营建吃木石、装备吃铁 → 采石/铁矿从 2 长到 9，中后期追上农田的增速；
   *   · 四类各 ≥ 2 块：任何等级都不会"某资源无产地"。
   * 逐档合计：12/15/18/21/24/27/30/33/36/40/44/48 —— 与上限表逐项相等。
   * 13 级起（名城官府可到 24）按末段步长 +4 续：四类各 +1。
   * ============================================================ */
  DATA.EXT_PLAN_BY_LV = [
    [5, 3, 2, 2],   [6, 4, 2, 3],   [7, 5, 3, 3],   [8, 6, 4, 3],
    [9, 7, 4, 4],   [10, 8, 5, 4],  [11, 9, 5, 5],  [12, 10, 6, 5],
    [13, 11, 6, 6], [14, 12, 7, 7], [15, 13, 8, 8], [16, 14, 9, 9],
  ];
  (function () {
    while (DATA.EXT_PLAN_BY_LV.length < DATA.MAX_LEVEL_ABS) {
      var last = DATA.EXT_PLAN_BY_LV[DATA.EXT_PLAN_BY_LV.length - 1];
      DATA.EXT_PLAN_BY_LV.push(last.map(function (n) { return n + 1; }));
    }
  })();
"""

# ============================================================
# ③ state.js：extPlanOf（唯一出口）+ npcCityShadow 改吃它
# ============================================================
SHADOW_OLD = """    var capT = DATA.EXT_CAP_BY_LV || [];
    /* 块数按**城等级**（= 该城的官府等级，官府随城长），
       但每块地的**等级**按建筑等级上限（v65 老板「城内外建筑也达到等级上限」）——
       两者不是一回事：块数是"官府能管多少地"，等级是"这地开发到什么水平"。 */
    var ecap = capT[Math.max(0, Math.min(lv - 1, capT.length - 1))] || 12;
    var ext = [], kinds = ['farm', 'farm', 'forest', 'quarry', 'mine'];
    for (var k = 0; k < ecap; k++) ext.push({ id: 'e' + (k + 1), type: kinds[k % kinds.length], lv: bl });"""

SHADOW_NEW = """    /* 块数按**城等级**（= 该城的官府等级，官府随城长），
       但每块地的**等级**按建筑等级上限（v65 老板「城内外建筑也达到等级上限」）——
       两者不是一回事：块数是"官府能管多少地"，等级是"这地开发到什么水平"。
       v70：**种类与数量**改由数量表产出（唯一出口 `GAME.extPlanOf`，入参=等级）——
       返回数组的长度就是这级的块数（与 `EXT_CAP_BY_LV` 那一档相等，一块不空）；
       改前是 ['farm','farm','forest','quarry','mine'] 循环，数量比与官府等级无关。 */
    var kinds = GAME.extPlanOf(lv);
    var ext = [];
    kinds.forEach(function (t, k) { ext.push({ id: 'e' + (k + 1), type: t, lv: bl }); });"""

# 在 npcCityShadow 之前插入 extPlanOf 定义（挂在 GAME 上，调用时序无碍）
EXTPLAN_ANCHOR = """  /* 「建筑全满、均 N 级」的影子城 —— 只用于算派生量（人口上限 / 产量），不参与玩法。"""

EXTPLAN_NEW = """  /* ============================================================
   * 城外满配的**铺法**（v70 · 老板）—— 唯一出口
   * ------------------------------------------------------------
   * 入参是"官府能管多少块地"（即 `EXT_CAP_BY_LV` 那一档），返回**逐块的地块类型**：
   * 按 农田 → 伐木场 → 采石场 → 铁矿场 轮转铺满（同数量表 `DATA.EXT_PLAN_BY_LV`）。
   * 轮转铺法的好处：任何等级下四类地都均匀分布在区块里，不会"前 20 块全是田"。
   * 数量表本身只给**数量**，本函数负责把它变成**确定性的铺法** ——
   * 两者都是纯函数，同等级永远同一结果（"位置排布有序且固定"）。
   * ============================================================ */
  GAME.extPlanOf = function (lv) {
    /* ⚠️ 入参是**官府等级**（1 起），不是块数 —— 两者会撞车（12 级 ↔ 12 块），
       所以只认一个口径；返回数组的**长度**就是这级的块数（= EXT_CAP_BY_LV 那一档）。 */
    var n = Math.max(1, Math.min(DATA.MAX_LEVEL_ABS, Math.round(lv) || 1));
    var counts = (DATA.EXT_PLAN_BY_LV || [])[n - 1] || [0, 0, 0, 0];
    return buildList(counts);
  };
  /* 把 [农田,伐木,采石,铁矿] 的**数量**摊成**逐块类型**（轮转） */
  function buildList(counts) {
    var order = DATA.EXT_BUILD_ORDER || ['farm', 'forest', 'quarry', 'mine'];
    var out = [], i, k;
    var max = counts.reduce(function (a, b) { return Math.max(a, b); }, 0);
    for (i = 0; i < max; i++) {
      for (k = 0; k < order.length; k++) if (i < (counts[k] || 0)) out.push(order[k]);
    }
    return out;
  }

""" + EXTPLAN_ANCHOR

# ============================================================
# ④ domain.js：州郡县唯一出口（插在 specialtyOf 之前）
# ============================================================
REGION_ANCHOR = """  GAME.specialtyOf = function (city) {"""

REGION_NEW = """  /* ============================================================
   * 行政区划「州 · 郡 · 县」—— 唯一出口（v70 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「每个名城按州郡县标识（假设青州琅琊郡XX县）……
   *   其他野地城池的标识应写上其所在县」
   *
   * 判据 = **就近归属**（确定性，无随机）：
   *   · 县 = 最近的**县城**（65 座县城铺满全图，任何坐标都归一个县）；
   *   · 郡 = 该县**本州内**最近的郡城（郡城的从属不随问询点漂移 —— 用县城的坐标算）；
   *   · 州 = 该县数据里写死的 state。
   * 两个坐标问同一个县 → 永远同一结果，可断言、可缓存。
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
  /* 行政名规范化：已带后缀（郡/国/县/道）的原样保留，否则补一个 —— 不造新名 */
  GAME.junNameOf = function (raw) {
    raw = String(raw == null ? '' : raw);
    return /[郡国县道州]$/.test(raw) ? raw : raw + '郡';
  };
  GAME.countyNameOf = function (raw) {
    raw = String(raw == null ? '' : raw);
    return /[郡国县道]$/.test(raw) ? raw : raw + '县';
  };
  /* 城池全称（州 · 郡 · 县 链）。名城三级齐备；自建城给「州 · 城名」；
     改过名的城用 origName 顶**行政层**（地名不随主公改名而变，参照 v45 的 origName 约定）。 */
  GAME.cityFullName = function (city) {
    if (!city) return '';
    var place = city.origName || city.name;
    var st = city.state || GAME.stateOfCity(city);
    var parts = [];
    if (st) parts.push(st);
    if (city.type === 'jun') {
      parts.push(GAME.junNameOf(place));
    } else if (city.type === 'county') {
      var rg = GAME.regionOf(city.x, city.y);
      if (rg && rg.jun) parts.push(GAME.junNameOf(rg.jun));
      parts.push(GAME.countyNameOf(place));
    } else {
      parts.push(place);
    }
    return parts.join(' · ');
  };
  /* 野外城池的标识（v70 老板「标识应写上其所在县」）：`乐安县 · 青石营` */
  GAME.fortLabelOf = function (fort) {
    if (!fort) return '';
    var rg = GAME.regionOf(fort.x, fort.y);
    return (rg && rg.county ? GAME.countyNameOf(rg.county) + ' · ' : '') + fort.name;
  };

""" + REGION_ANCHOR

# ============================================================
# ⑤ smoke 第 46 节：旧规则断言同步到新规则
# ============================================================
SM_MAP = [
    ("""  check('配置：CITY_PLAN 用统一的 8×6（不再按等级分档）+ 落位优先序',
    !!PLACE && PLACE.size[0] === 8 && PLACE.size[1] === 6
    && PLACE.sizeByLevel === undefined
    && PLACE.maxLevel === 10 && PLACE.order.length === 14 && PLACE.filler === 'minfang');""",
     """  check('配置：CITY_PLAN 用统一的 8×6（不再按等级分档）+ 落位优先序',
    !!PLACE && PLACE.size[0] === 8 && PLACE.size[1] === 6
    && PLACE.sizeByLevel === undefined
    /* v70（老板）：仓库 1 → 4 后，优先序 14 → 17 项 */
    && PLACE.maxLevel === 10 && PLACE.order.length === 17 && PLACE.filler === 'minfang');""",
     '第46节 · order 长度 14→17'),

    ("""        var need = (want[i] === 'junying') ? 2 : 1;""",
     """        /* v70（老板）：军营 2 座、**仓库 4 座**，其余各 1 座 */
        var need = (want[i] === 'junying') ? 2 : (want[i] === 'cangku') ? 4 : 1;""",
     '第46节 · 仓库 4 座'),

    ("""      if (c.minfang !== plan.total - 4 - 14) return false;""",
     """      /* 4 = 官府 4 格；17 = 功能建筑格数（v70：军营2 + 仓库4 + 其余 11）；余下全是民房 */
      if (c.minfang !== plan.total - 4 - 17) return false;""",
     '第46节 · 民房 = 总数-21'),

    ("""        && c.junying === 2 && c.minfang === want.total - 18 && nc.wallLv === G.npcBuildLvOf(tgt);""",
     """        && c.junying === 2 && c.cangku === 4 && c.minfang === want.total - 21
        && nc.wallLv === G.npcBuildLvOf(tgt);""",
     '第46节 · 攻占转正口径 18→21'),

    ("""    return html.indexOf('军营 ×2') >= 0 && html.indexOf('民房 ×30') >= 0
      && html.indexOf('8 × 6 = 48 格') >= 0 && html.indexOf('人口上限') >= 0;""",
     """    /* v70：仓库 1→4 之后，Lv8 满配的民房 30 → 27 */
    return html.indexOf('军营 ×2') >= 0 && html.indexOf('仓库 ×4') >= 0
      && html.indexOf('民房 ×27') >= 0
      && html.indexOf('8 × 6 = 48 格') >= 0 && html.indexOf('人口上限') >= 0;""",
     '第46节 · 呈现文案 民房×27'),
]


def main():
    fails = []

    # ---------- data.js ----------
    d = read(DATA)
    if 'EXT_PLAN_BY_LV' in d:
        print('· data.js：已改过（幂等跳过）')
    else:
        d2 = cut(d, ORDER_OLD, ORDER_NEW, '① CITY_PLAN.order 仓库×4')
        if d2 is None:
            return 1
        d3 = cut(d2, CAP_ANCHOR, CAP_NEW, '② EXT_PLAN_BY_LV 数量表')
        if d3 is None:
            return 1
        if not save_lf(DATA, d3, 'data.js'):
            fails.append('data')

    # ---------- state.js ----------
    st = read(STATE)
    if 'GAME.extPlanOf' in st:
        print('· state.js：已改过（幂等跳过）')
    else:
        st2 = cut(st, EXTPLAN_ANCHOR, EXTPLAN_NEW, '③ GAME.extPlanOf 唯一出口')
        if st2 is None:
            return 1
        st3 = cut(st2, SHADOW_OLD, SHADOW_NEW, '③ npcCityShadow 改吃 extPlanOf')
        if st3 is None:
            return 1
        if not save_lf(STATE, st3, 'state.js'):
            fails.append('state')

    # ---------- domain.js ----------
    dm = read(DOMAIN)
    if 'GAME.regionOf' in dm:
        print('· domain.js：已改过（幂等跳过）')
    else:
        dm2 = cut(dm, REGION_ANCHOR, REGION_NEW, '④ 州郡县唯一出口')
        if dm2 is None:
            return 1
        if not save_lf(DOMAIN, dm2, 'domain.js'):
            fails.append('domain')

    # ---------- smoke 第 46 节 ----------
    sm = read(SMOKE)
    if '民房 ×27' in sm:
        print('· smoke：已改过（幂等跳过）')
    else:
        for old, new, tag in SM_MAP:
            sm2 = cut(sm, old, new, '⑤ ' + tag)
            if sm2 is None:
                return 1
            sm = sm2
        if not save_lf(SMOKE, sm, 'smoke'):
            fails.append('smoke')

    print('')
    if fails:
        print('✗ 未完成：' + ', '.join(fails))
        return 1
    print('✓ 全部完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
