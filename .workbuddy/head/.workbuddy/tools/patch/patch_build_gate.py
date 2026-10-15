# -*- coding: utf-8 -*-
"""v68 · 逐步探索：建造前置规则（老板 2026-09-14 需求）

三类改动：
  ① data.js   新增 DATA.BUILD_PREREQ（先 X 后 Y 的建造前置表）
  ② domain.js buildCapOf 加"官府总闸"（城内建筑等级 ≤ 官府等级）；
               新增 GAME.buildPrereqOf（唯一出口）；buildAt / upgradeAt 接入
  ③ ui.js     建造卡置灰写明原因；建筑弹窗把"已满级"换成准确原因

规矩（照项目既有）：
  · 幂等：重复执行不产生变化
  · 锚点必须唯一命中，否则拒绝写盘
  · 行尾保持（三文件均为 LF）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
DATA_JS = os.path.join(ROOT, 'js', 'data.js')
DOM_JS = os.path.join(ROOT, 'js', 'domain.js')
UI_JS = os.path.join(ROOT, 'js', 'ui.js')

MARK = 'DATA.BUILD_PREREQ'

# ---------------------------------------------------------------- ① data.js
A1_OLD = "DATA.BUILD_ORDER = ['minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang', 'majiu', 'yizhan', 'fenghuotai'];\n"
A1_NEW = A1_OLD + """
  /* ============================================================
   * 建造前置（v68 · 老板需求「让玩家逐步探索」）
   * ------------------------------------------------------------
   * 与 buildCapOf 的「官府总闸」分工：
   *   · 总闸（代码内）→ 等级上限：城内建筑（含城墙）等级 ≤ 官府等级
   *   · 本表（数据）  → 建造前置：先有 X 才能建 / 升 Y
   * 检查在 buildAt 与 upgradeAt 两端都生效（建造与升级同一把尺）。
   * 判定唯一出口：GAME.buildPrereqOf（UI 提示与内核拦截共用）。
   * ============================================================ */
  DATA.BUILD_PREREQ = {
    zhaoxianguan:     { kezhan: 2 },     // 先客栈后招贤馆：有安顿来客之处，方可设馆纳贤
    gongjiangzuofang: { tiejiangpu: 3 }, // 工匠作坊：器械以铁作底，铁匠铺 Lv3 起步
    xiaochang:        { junying: 2 },    // 先募兵（军营）再练兵（校场）
    yizhan:           { shichang: 2 },   // 驿传通商：先有市场（商队）才有驿路
    honglusi:         { kezhan: 3 },     // 鸿胪寺主迎来送往，客栈 Lv3 才撑得起场面
    majiu:            { junying: 3 },    // 养马为骑军基础：军营 Lv3
  };
"""

# ---------------------------------------------------------------- ② domain.js
A2_OLD = """GAME.buildCapOf = function (city, bid) {
    var b = bid ? (DATA.BUILDINGS[bid] || DATA.EXT_BUILDINGS[bid] || null) : null;
    var base = (b && b.maxLevel) || DATA.MAX_BLEVEL;
    return base + GAME.cityBuildBonus(city);
  };"""

A2_NEW = """GAME.buildCapOf = function (city, bid) {
    var b = bid ? (DATA.BUILDINGS[bid] || DATA.EXT_BUILDINGS[bid] || null) : null;
    var base = (b && b.maxLevel) || DATA.MAX_BLEVEL;
    var cap = base + GAME.cityBuildBonus(city);
    /* v68 · 逐步探索：城内建筑（含城墙）等级不得超过官府等级。
       - 官府自身、城外建筑、以及"没有官府的城"（异常数据/测试构造）不受此闸；
       - 与 DATA.BUILD_PREREQ 分工：这里管**等级上限**，那里管**建造前置**。 */
    if (bid && DATA.BUILDINGS[bid] && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      if (govLv > 0) cap = Math.min(cap, govLv);
    }
    return cap;
  };

  /* 建造前置的唯一出口（v68 · 逐步探索）：
       · 特殊前置：DATA.BUILD_PREREQ（先 X 后 Y）
       · 官府总闸：只有当"升官府真能解锁"时才报官府（官府自身到顶则交给等级硬顶去报）
     返回 { ok, list, short, msg } —— short 供卡片角标，msg 供提示条。 */
  GAME.buildPrereqOf = function (city, bid) {
    var list = [];
    if (!city || !bid) return { ok: true, list: list };
    var req = DATA.BUILD_PREREQ && DATA.BUILD_PREREQ[bid];
    if (req) {
      for (var k in req) {
        var cur = GAME.buildingLevel(city, k);
        if (cur < req[k]) list.push({ bid: k, name: (DATA.BUILDINGS[k] || {}).name || k, need: req[k], cur: cur });
      }
    }
    var b = DATA.BUILDINGS[bid];
    if (b && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      var govCap = (DATA.BUILDINGS.guanfu.maxLevel || DATA.MAX_BLEVEL) + GAME.cityBuildBonus(city);
      var next = GAME.buildingLevel(city, bid) + 1;
      /* govLv < govCap：官府还没到自己的顶，"再升官府"是真实可执行的下一步；
         官府已到顶时不报 gate，让等级硬顶去报「已达最高等级」。 */
      if (govLv > 0 && next > govLv && govLv < govCap) {
        list.push({ bid: 'guanfu', name: '官府', need: Math.min(next, govCap), cur: govLv, gate: true });
      }
    }
    if (!list.length) return { ok: true, list: list };
    var parts = list.map(function (o) { return o.name + ' 需 Lv' + o.need + '（当前 Lv' + o.cur + '）'; });
    var f = list[0];
    return { ok: false, list: list, short: '需' + f.name + ' Lv' + f.need, msg: '前置未满足：' + parts.join('；') };
  };"""

# buildAt 插入（UNIQUE 检查之后）
A3_OLD = """    if (UNIQUE_BUILDINGS[buildId] && GAME.buildingLevel(city, buildId) > 0) {
      return { ok: false, msg: b.name + ' 全城唯一（已建造）' };
    }
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = b.buildCost;"""

A3_NEW = """    if (UNIQUE_BUILDINGS[buildId] && GAME.buildingLevel(city, buildId) > 0) {
      return { ok: false, msg: b.name + ' 全城唯一（已建造）' };
    }
    /* v68 · 逐步探索：建造前置（先 X 后 Y）—— 与升级共用同一判定，见 buildPrereqOf */
    var pre = GAME.buildPrereqOf(city, buildId);
    if (!pre.ok) return pre;
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = b.buildCost;"""

# upgradeAt：前置优先于等级硬顶
A4_OLD = """    if (cell.build.lvl >= GAME.buildCapOf(city, cell.build.id)) return { ok: false, msg: '已达最高等级' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = b.levelCost(cell.build.lvl);"""

A4_NEW = """    /* v68 · 逐步探索：前置（含官府总闸）优先于等级硬顶 ——
       两者都不满足时，报"升官府可解锁"比报"已达最高等级"更接近玩家的下一步动作。 */
    var pre = GAME.buildPrereqOf(city, cell.build.id);
    if (!pre.ok) return pre;
    if (cell.build.lvl >= GAME.buildCapOf(city, cell.build.id)) return { ok: false, msg: '已达最高等级' };
    var slot = GAME.checkBuildSlot(city.id);
    if (!slot.ok) return slot;
    var cost = b.levelCost(cell.build.lvl);"""

# ---------------------------------------------------------------- ③ ui.js
A5_OLD = """        if (bid === 'guanfu') { afford = ' disabled'; lockMsg = '官府初始自带'; tip += '｜官府初始自带'; }
        var ic = GAME.icons.forBuilding(bid) || b.icon;"""

A5_NEW = """        if (bid === 'guanfu') { afford = ' disabled'; lockMsg = '官府初始自带'; tip += '｜官府初始自带'; }
        /* v68 · 逐步探索：前置不满足 → 置灰并写明原因（"需客栈 Lv2"） */
        var preB = GAME.buildPrereqOf(c, bid);
        if (!preB.ok) { afford = ' disabled'; lockMsg = preB.short; tip += '｜' + preB.msg; }
        var ic = GAME.icons.forBuilding(bid) || b.icon;"""

A6_OLD = """      var upCost = cell.build.lvl < GAME.buildCapOf(c, cell.build.id) ? b.levelCost(cell.build.lvl) : null;
      var costStr = upCost ? GAME.costString(upCost) : '已满级';"""

A6_NEW = """      /* v68 · 逐步探索：卡在官府等级上时，'已满级' 会误导 —— 用前置检查给出准确原因 */
      var preUp = GAME.buildPrereqOf(c, cell.build.id);
      var upCost = cell.build.lvl < GAME.buildCapOf(c, cell.build.id) ? b.levelCost(cell.build.lvl) : null;
      var costStr = upCost ? GAME.costString(upCost) : (preUp.ok ? '已满级' : preUp.short);"""

A7_OLD = """            (upCost ? '<button class="btn" data-action="confirm-upgrade" data-idx="' + idx + '">升级 → Lv' + (cell.build.lvl + 1) + '</button>' : '<span class="op-done">已达最高等级</span>') +"""

A7_NEW = """            (upCost ? '<button class="btn" data-action="confirm-upgrade" data-idx="' + idx + '">升级 → Lv' + (cell.build.lvl + 1) + '</button>' : '<span class="op-done">' + (preUp.ok ? '已达最高等级' : U.escape(preUp.short)) + '</span>') +"""


PLAN = [
    (DATA_JS, A1_OLD, A1_NEW, 'data.js · BUILD_PREREQ 表'),
    (DOM_JS,  A2_OLD, A2_NEW, 'domain.js · buildCapOf 总闸 + buildPrereqOf 新出口'),
    (DOM_JS,  A3_OLD, A3_NEW, 'domain.js · buildAt 接前置'),
    (DOM_JS,  A4_OLD, A4_NEW, 'domain.js · upgradeAt 前置优先'),
    (UI_JS,   A5_OLD, A5_NEW, 'ui.js · 建造卡置灰'),
    (UI_JS,   A6_OLD, A6_NEW, 'ui.js · 弹窗费用行'),
    (UI_JS,   A7_OLD, A7_NEW, 'ui.js · 升级按钮提示'),
]


def main():
    texts = {}
    for p in {DATA_JS, DOM_JS, UI_JS}:
        texts[p] = io.open(p, 'rb').read().decode('utf-8')

    # 幂等：标记已存在则跳过
    if MARK in texts[DATA_JS] and 'GAME.buildPrereqOf = function' in texts[DOM_JS] and 'preUp' in texts[UI_JS]:
        print('· v68 建造前置已存在，跳过全部修改（幂等）')
        return 0

    crlf0 = {p: texts[p].count('\r\n') for p in texts}
    done = []
    for path, old, new, tag in PLAN:
        t = texts[path]
        c = t.count(old)
        if c != 1:
            print('✗ [%s] 锚点命中 %d 次（应为 1），拒绝写盘' % (tag, c))
            return 1
        if new in t:
            print('· [%s] 已应用，跳过' % tag)
            continue
        texts[path] = t.replace(old, new, 1)
        done.append(tag)

    for path in texts:
        out = texts[path].encode('utf-8')
        if out.count(b'\r\n') != crlf0[path]:
            print('✗ 行尾被改写（%s），拒绝写盘' % path)
            return 1
        io.open(path, 'wb').write(out)

    # 落盘核验
    print('本次改动: %d 处' % len(done))
    for tag in done:
        print('  ·', tag)
    d2 = io.open(DOM_JS, encoding='utf-8', newline='').read()
    i2 = io.open(UI_JS, encoding='utf-8', newline='').read()
    ok = (MARK in io.open(DATA_JS, encoding='utf-8', newline='').read()
          and d2.count('GAME.buildPrereqOf') >= 3
          and i2.count('GAME.buildPrereqOf') >= 2)
    if not ok:
        print('✗ 核验未过')
        return 1
    print('✓ 完成（buildPrereqOf 引用：domain %d 处 / ui %d 处）'
          % (d2.count('GAME.buildPrereqOf'), i2.count('GAME.buildPrereqOf')))
    return 0


if __name__ == '__main__':
    sys.exit(main())
