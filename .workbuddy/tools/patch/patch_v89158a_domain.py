# -*- coding: utf-8 -*-
# v89.158 补丁 A：domain.js —— 仓容分账唯一出口 GAME.storePartsOf
# （老板 1「容量显示仍然不对」：悬停/仓库面板/建造面板 三处账目同源）
import io, sys

P = 'E:/Deepseekdb/js/domain.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

# ---------- 段 1：storeCapOf 拆账（新增 storePartsOf，storeCapOf 变转发） ----------
if u'GAME.storePartsOf = function' in s:
    done.append('1 skip（已落）')
else:
    OLD1 = u"""  GAME.storeCapOf = function (city) {
    city = city || GAME.currentCity();
    var BASE = DATA.BASE_STORE || 2000000;
    if (!city) return BASE;
    /* v19：仓库可多建 —— 储量按**本城各仓等级之和**计（一座 Lv5 = 五座 Lv1）。
       储存技术 +5%/级；仓库建筑专精再 +50%；名城档位优势再 +storePct（都城 +50%）。 */
    var lv = GAME.buildingLevelSum(city, 'cangku');
    var base = lv > 0 ? BASE * lv : BASE;
    /* v89.81：建筑专精的值改读 `DATA.MASTERY` —— 原先这里硬编码 0.5，而表里写着 0.50：
       数值恰好相同所以从没暴露，但那是"两个出口"（改表不生效）。 */
    var mStore = (GAME.mastery && lv > 0) ? GAME.mastery('storePct', city) : 0;
    /* v89.141（老板 0）：「城外资源建筑还自带一点上限容量」——
       **纯加法**（不吃仓储加成：露天堆场与仓库体系解耦，见 DATA.EXT_STORE_PER_LV）。 */
    return Math.round(base * (1 + techB('store'))
      * (1 + mStore)
      * (1 + GAME.cityBonusNum(city, 'storePct')))   /* v79：+ 爵位/主城/神器 仓储 */
      + GAME.extStoreCapOf(city);
  };"""
    NEW1 = u"""  GAME.storeCapOf = function (city) {
    /* v89.158（老板 1）：算式整条搬进 GAME.storePartsOf（分账唯一出口）——
       本函数只做"取总值"的转发，数值与改前**逐字一致**。 */
    return GAME.storePartsOf(city).total;
  };
  /* ============================================================
   * v89.158（老板 1「左侧资源统计的容量显示仍然不对」）：**仓容分账**（唯一出口）——
   *   把 storeCapOf 的算式拆成"账目自洽"的部件，供 悬停 / 仓库面板 / 建造面板 同源展示：
   *     · base  = 仓库体系部分（含储存科技 / 仓专精 / 名城·爵位·主城·神器加成）
   *               —— **未建仓库时即"基础储量"（DATA.BASE_STORE）**
   *     · ext   = 城外堆场（纯加法，不吃仓储加成）
   *     · total = base + ext（= storeCapOf 的返回值）
   *     · lv    = 本城仓等级**之和**（多仓叠加口径；buildingLevel 只给"最高一座"，
   *               两把尺会出现"仓库 Lv1 却有 3 级容量"的显示错位）
   *   改前三处显示各拼各的 → 出现"上限 366.7万 / 其中堆场 +166.7万"、
   *   而另外 200 万（基础）没有出处的账目（老板原话口径："仍然不对"）。改后 = 分账相加。
   * ============================================================ */
  GAME.storePartsOf = function (city) {
    city = city || GAME.currentCity();
    var BASE = DATA.BASE_STORE || 2000000;
    if (!city) return { base: BASE, ext: 0, total: BASE, lv: 0 };
    /* v19：仓库可多建 —— 储量按**本城各仓等级之和**计（一座 Lv5 = 五座 Lv1）。
       储存技术 +5%/级；仓库建筑专精再 +50%；名城档位优势再 +storePct（都城 +50%）。 */
    var lv = GAME.buildingLevelSum(city, 'cangku');
    var raw = lv > 0 ? BASE * lv : BASE;
    /* v89.81：建筑专精的值改读 `DATA.MASTERY` —— 原先这里硬编码 0.5，而表里写着 0.50：
       数值恰好相同所以从没暴露，但那是"两个出口"（改表不生效）。 */
    var mStore = (GAME.mastery && lv > 0) ? GAME.mastery('storePct', city) : 0;
    var base = Math.round(raw * (1 + techB('store'))
      * (1 + mStore)
      * (1 + GAME.cityBonusNum(city, 'storePct')));   /* v79：+ 爵位/主城/神器 仓储 */
    /* v89.141（老板 0）：「城外资源建筑还自带一点上限容量」——
       **纯加法**（不吃仓储加成：露天堆场与仓库体系解耦，见 DATA.EXT_STORE_PER_LV）。 */
    var ext = GAME.extStoreCapOf(city);
    return { base: base, ext: ext, total: base + ext, lv: lv };
  };"""
    c = s.count(OLD1)
    assert c == 1, 'A1 anchor count=' + str(c)
    s = s.replace(OLD1, NEW1)
    done.append('1 OK')

# ---------- 段 2：extStoreCapOf 注释纠偏（"在施工不计"与实际不符） ----------
OLD2 = u"""     即**每块 = 同级仓库容量的 1/6**（老板 v89.148 口径；仓库容量 = BASE_STORE × 仓等级）。
     未建 / 在施工的地块不计；取整在**总和**上做一次（不是逐块取整，避免误差累积）。 */"""
NEW2 = u"""     即**每块 = 同级仓库容量的 1/6**（老板 v89.148 口径；仓库容量 = BASE_STORE × 仓等级）。
     未建地块不计；已建地块按**当前等级**计入（v89.158 纠偏注释：升级施工期间 e.type 仍在、
     按升级前等级计 —— 等级在完工时才更新，故施工中不会提前给新等级的容量）。
     取整在**总和**上做一次（不是逐块取整，避免误差累积）。 */"""
if OLD2 in s:
    assert s.count(OLD2) == 1
    s = s.replace(OLD2, NEW2)
    done.append('2 OK')
else:
    done.append('2 skip（可能已改）')

io.open(P, 'w', encoding='utf-8', newline='').write(s)

# ---------- 自检 ----------
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'GAME.storePartsOf = function') == 1, 'storePartsOf count'
assert chk.count(u'return GAME.storePartsOf(city).total;') == 1, 'storeCapOf 转发'
assert u'buildingLevelSum(city' in chk
print('patch A done:', done, 'len', orig, '->', len(chk))
