# -*- coding: utf-8 -*-
"""v89.137 补丁 B：domain.js —— 建筑专精三档唯一出口 + 消费点升级"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'domain.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次（须为 1）' % (tag, s.count(old)))
        sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ 1. 出口重写：masteryTierOf / masteryOf / mastery ══════════
rep(
"""  /* ============================================================
   * 满级专精（v28 · 需求 1）
   * ------------------------------------------------------------
   * 建筑达到等级上限（DATA.MAX_BLEVEL）时，按 DATA.MASTERY 给一条加成。
   * 加成一律**按当前城**判定 —— "这座城的民房满级" 与 "别城的仓库满级" 是两回事；
   * 只有全局口径的量（如建造队列、仓储存量）由调用方决定用全境还是本城，
   * 所以这里只提供"取值"这一件事，不给默认口径。
   * ============================================================ */
  GAME.masteryOf = function (city, bid) {
    if (!city) return false;
    var b = DATA.BUILDINGS[bid];
    if (!b) return false;
    return (GAME.buildingLevel(city, bid) || 0) >= b.maxLevel;
  };""",
"""  /* ============================================================
   * 建筑专精（v28 建 · v89.137 三档）
   * ------------------------------------------------------------
   * 原"满级专精"：建筑到 12 级（当时的上限）给一条加成。
   * v89.137（老板 5）：改名"建筑专精" + **三档阶梯** ——
   *   Lv12 / Lv24 / Lv36 各记一档（`DATA.MASTERY_TIERS`），
   *   效果 = `DATA.MASTERY[].val × 档数`（第一档保持原值，不推翻已上线数值）。
   * 加成一律**按当前城**判定 —— "这座城的民房满级" 与 "别城的仓库满级" 是两回事；
   * 只有全局口径的量（如建造队列、仓储存量）由调用方决定用全境还是本城，
   * 所以这里只提供"取值"这一件事，不给默认口径。
   *
   * 三个出口的分工（消费点只用这三个，别自己数档）：
   *   masteryTierOf(city, bid) → 0/1/2/3（该建筑在**这座城**的专精档数）
   *   masteryOf(city, bid)     → boolean（tier > 0；兼容旧"满级判定"语义）
   *   mastery(key, city)       → val × 档数（同 key 多建筑累加；city=null 走全境）
   * ============================================================ */
  GAME.masteryTierOf = function (city, bid) {
    if (!city) return 0;
    var b = DATA.BUILDINGS[bid];
    if (!b) return 0;
    var lv = GAME.buildingLevel(city, bid) || 0;
    var tiers = DATA.MASTERY_TIERS || [DATA.MAX_BLEVEL];
    var n = 0;
    for (var i = 0; i < tiers.length; i++) if (lv >= tiers[i]) n++;
    return n;
  };
  GAME.masteryOf = function (city, bid) {
    return GAME.masteryTierOf(city, bid) > 0;
  };""",
'出口重写')

# ══════════ 2. mastery：val → val × 档数 ══════════
rep(
"""  /* 取某一专精键的合计值。city 传 null 时表示**全境**（任一城满级即计入）。
     ⚠️ v89.107 性能告警：`city === null` 是 **O(城×格)** 的重活。别在逐城/逐资源的
     循环里调它 —— 实测 100 城时它被 prodFactors 每 tick 叫 400 次，
     占了 tickOnce 的 97%（10.2ms/tick）。正确姿势 = **在循环外算一次再传进去**
     （见 state.js 的 cityProdPerSec(city, opt.mpGlobal) 与 productionPerSec）。 */
  GAME.mastery = function (key, city) {
    var sum = 0, list = DATA.MASTERY || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.key !== key) continue;
      if (city === null) {
        var ok = false;
        ((GAME.state && GAME.state.cities) || []).forEach(function (ct) {
          if (GAME.masteryOf(ct, m.bid)) ok = true;
        });
        if (ok) sum += m.val;
      } else {
        var c = city || (GAME.currentCity ? GAME.currentCity() : null);
        if (GAME.masteryOf(c, m.bid)) sum += m.val;
      }
    }
    return sum;
  };""",
"""  /* 取某一专精键的合计值（**已含档数**：val × 档数）。city 传 null 时表示**全境** ——
     口径 = "**任一城**到档即计入，取该建筑在全境的最优档数"（同原"任一城满级即计入"
     的延伸：按城**不累加**；同 key 的多座建筑之间仍累加，如三座 +6% 产量的建筑）。
     ⚠️ v89.107 性能告警：`city === null` 是 **O(城×格)** 的重活。别在逐城/逐资源的
     循环里调它 —— 实测 100 城时它被 prodFactors 每 tick 叫 400 次，
     占了 tickOnce 的 97%（10.2ms/tick）。正确姿势 = **在循环外算一次再传进去**
     （见 state.js 的 cityProdPerSec(city, opt.mpGlobal) 与 productionPerSec）。 */
  GAME.mastery = function (key, city) {
    var sum = 0, list = DATA.MASTERY || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.key !== key) continue;
      if (city === null) {
        var t = 0;
        ((GAME.state && GAME.state.cities) || []).forEach(function (ct) {
          var x = GAME.masteryTierOf(ct, m.bid);
          if (x > t) t = x;
        });
        sum += m.val * t;
      } else {
        var c = city || (GAME.currentCity ? GAME.currentCity() : null);
        sum += m.val * GAME.masteryTierOf(c, m.bid);
      }
    }
    return sum;
  };""",
'mastery 含档')

# ══════════ 3. 消费点：训练队列位（军营） ══════════
rep(
"""    /* v28（需求 1）：军营满级专精再 +1 位。
       city 可选 —— 不传时按"当前城"判定；调用方若已知是哪座城，务必传进来。
       v60（需求 5）：**名城档位优势**再 +troopSlot（帝都 +1）——
       perks 里"募兵队列 +1"那项的落地点（不加这句它就是死属性）。 */
    var bonus = city ? (GAME.masteryOf(city, 'junying') ? 1 : 0) : GAME.mastery('trainSlot', null);""",
"""    /* v28（需求 1）：军营建筑专精再 +1 位/档（v89.137：12/24/36 三档 = +1/+2/+3）。
       city 可选 —— 不传时按"当前城"判定；调用方若已知是哪座城，务必传进来。
       v60（需求 5）：**名城档位优势**再 +troopSlot（帝都 +1）——
       perks 里"募兵队列 +1"那项的落地点（不加这句它就是死属性）。 */
    var bonus = city ? GAME.mastery('trainSlot', city) : GAME.mastery('trainSlot', null);""",
'训练队列位')

# ══════════ 4. 消费点：工匠作坊（器械耗时） ══════════
rep(
"""    /* v28（需求 1）：工匠作坊满级专精 —— 器械（craft 兵种）打造耗时 −15% */
    if (t.craft && GAME.masteryOf(city, 'gongjiangzuofang')) totalTime = Math.round(totalTime * 0.85);""",
"""    /* v28（需求 1）：工匠作坊建筑专精 —— 器械（craft 兵种）打造耗时 −15%/档
       （v89.137：三档 = −15% / −30% / −45%，上限 0.9 兜底） */
    var _ct137 = GAME.mastery('craftTimePct', city);
    if (t.craft && _ct137 > 0) totalTime = Math.round(totalTime * (1 - Math.min(0.9, _ct137)));""",
'工匠作坊')

# ══════════ 5. 消费点：招贤馆（将领席位） ══════════
rep(
"""    /* v28：招贤馆满级专精 —— 房间 +2
       v79：+ 爵位 / 主城 的将领席位加成（cityBonusNum 汇总口） */
    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)
      + (GAME.masteryOf(city, 'zhaoxianguan') ? 2 : 0)""",
"""    /* v28：招贤馆建筑专精 —— 房间 +2/档（v89.137：三档 = +2/+4/+6）
       v79：+ 爵位 / 主城 的将领席位加成（cityBonusNum 汇总口） */
    return (GAME.buildingLevel(city, 'zhaoxianguan') || 0)
      + GAME.mastery('genRoom', city)""",
'招贤馆席位')

# ══════════ 6. 消费点：客栈候选位 ══════════
rep(
"""  /* 客栈候选位数（v28）：**该城**客栈等级 + 满级专精 +2 */
  GAME.innSlots = function (city) {
    city = city || GAME.currentCity();
    var lv = GAME.innLevel(city);          /* v89.108 修：原来漏传 city，拿的是当前城 */
    if (lv <= 0) return 0;
    return lv + (GAME.masteryOf(city, 'kezhan') ? 2 : 0);
  };""",
"""  /* 客栈候选位数（v28）：**该城**客栈等级 + 建筑专精 +2/档（v89.137：三档 = +2/+4/+6） */
  GAME.innSlots = function (city) {
    city = city || GAME.currentCity();
    var lv = GAME.innLevel(city);          /* v89.108 修：原来漏传 city，拿的是当前城 */
    if (lv <= 0) return 0;
    return lv + GAME.mastery('innSlot', city);
  };""",
'客栈候选位')

# ══════════ 7. 消费点：城防（城墙） ══════════
rep(
"""    /* v28（需求 1）：城墙满级专精 —— 城防 +25% */
    if (GAME.masteryOf(city, 'chengqiang')) base = Math.round(base * 1.25);""",
"""    /* v28（需求 1）：城墙建筑专精 —— 城防 +25%/档（v89.137：三档 = ×1.25 / ×1.5 / ×1.75） */
    var _dm137 = GAME.mastery('defPct', city);
    if (_dm137 > 0) base = Math.round(base * (1 + _dm137));""",
'城墙城防')

# ══════════ 8. 注释更名（其余"满级专精"提及） ══════════
cnt = s.count('满级专精')
s = s.replace('满级专精', '建筑专精')
ok.append('注释更名×%d' % cnt)

# ══════════ 写盘 + 自检 ══════════
assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'GAME.masteryTierOf = function' in chk, 'TierOf 未落盘'
assert chk.count('{') == chk.count('}'), '花括号不配平 %d/%d' % (chk.count('{'), chk.count('}'))
# 残留检查：masteryOf( 的**调用**只允许出现在注释/兼容出口里
import re
calls = re.findall(r'GAME\.masteryOf\(', chk)
print('   GAME.masteryOf 调用点剩 %d 处（应只在定义与兼容注释里）' % len(calls))
print('✅ domain.js 补丁完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
