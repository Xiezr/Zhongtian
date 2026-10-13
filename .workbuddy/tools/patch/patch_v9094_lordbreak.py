# -*- coding: utf-8 -*-
"""v90.94 批次D：练功移位 + 突破改爵位门槛
① js/data.js      DATA.LORD_BREAK：修为三项退役 → rankStep:3
② js/domain.js    lordCultivNeed→lordRankNeed / doLordTrain 去修为 / doLordBreak 改爵位门槛 / expBlockOf 文案
③ js/ui.js        君主面板：修行行改爵位 + 练功条移到面板最下方
④ smoke-test.js   四条用例按新口径重写（练功×3 + 突破×2）
用法：python patch_v9094_lordbreak.py [--apply]
安全：两阶段 —— 先全量校验锚点唯一性，再统一落盘（原子写 + os.replace）。
"""
import io, os, sys

ROOT = r'E:\Deepseekdb'
EDITS = []


def add(path, tag, old, new):
    EDITS.append((path, tag, old, new))


# ============ ① js/data.js ============
add('js/data.js', 'D1 注释块',
    '''   * 君主「练功 → 突破」（v89.65 · 老板：「君主练功然后突破，这很合理」）
   * ------------------------------------------------------------
   * 两个动作，各一个唯一出口：
   *   练功 GAME.doLordTrain —— 花**体力**（+ 少量粮），产**修为**（常产）与
   *        **经验**（只在没到段顶时给）。体力靠时间恢复，故练功天然限速，
   *        不必另设冷却字段。
   *   突破 GAME.doLordBreak —— 段顶且修为够 → 跨段：等级上限 +60、境界进一阶、
   *        发自由属性点（走既有 freePts 加点体系，不另造一套成长口径）。
   * 修为与突破次数存在**君主英雄身上**（g.cultiv / g.breaks）：
   * 老档读不到即视为 0（`g.breaks || 0`），所以**不需要迁移脚本**。''',
    '''   * 君主「练功 / 突破」（v89.65 立 · v90.94 解耦）
   * ------------------------------------------------------------
   * 两个动作，各一个唯一出口：
   *   练功 GAME.doLordTrain —— 花**体力**（+ 少量粮），产**经验**（只在没到段顶时给）。
   *        体力靠时间恢复，故练功天然限速，不必另设冷却字段。
   *   突破 GAME.doLordBreak —— 段顶 + 爵位够 + 四关过 → 跨段：等级上限 +60、
   *        境界进一阶、发自由属性点（走既有 freePts 加点体系，不另造一套成长口径）。
   * v90.94（老板「去除练功与君主突破之间的关联……每升高三个爵位可以突破一次」）：
   *   ① 练功**不再产修为**，也不再是突破门槛 —— 两件事彻底解耦；
   *   ② 突破门槛 = **爵位（威望档 s.rank）**：第 n 次突破须 `s.rank ≥ rankStep × n`
   *      （rankStep=3 → 3 / 6 / 9 档）；原「修为」门槛（needs）整条退役。
   *   `g.breaks`（已突破次数）仍是唯一进度字段；`g.cultiv` 为老档遗留，
   *   读不到即视为 0，**不再写出**（不需要迁移脚本）。''')

add('js/data.js', 'D2 字段',
    '''    cultivBase: 8,                // 修为 = base + 等级 × perLv
    cultivPerLv: 0.4,
    expPct: 0.10,                 // 练功给经验 = 本级所需 × 10%（未到段顶才给）
    /* 第 n 次突破所需修为（下标 = 已突破次数）—— 每段递增，越上层越难 */
    needs: [0, 320, 1100, 3600],''',
    '''    expPct: 0.10,                 // 练功给经验 = 本级所需 × 10%（未到段顶才给）
    /* ⛔ v90.94 退役：原「修为」口径三项（cultivBase / cultivPerLv / needs）随
       练功-突破解耦整体撤除 —— 突破门槛改读**爵位（威望档）**。 */
    rankStep: 3,                  // 每 3 个爵位（威望档 = s.rank）解锁一次突破''')

# ============ ② js/domain.js ============
add('js/domain.js', 'D3 lordRankNeed',
    '''  /* 下一次突破所需修为；null = 已至顶（天启体 240 之上无更上层） */
  GAME.lordCultivNeed = function (g) {
    var B = DATA.LORD_BREAK, n = GAME.lordBreaksOf(g);
    return (n < B.needs.length - 1) ? B.needs[n + 1] : null;
  };''',
    '''  /* 下一次突破所需爵位（威望档 = s.rank 索引）；null = 已至顶（天启体 240 之上无更上层） */
  GAME.lordRankNeed = function (g) {
    var B = DATA.LORD_BREAK, n = GAME.lordBreaksOf(g);
    return (n < B.realms.length - 1) ? (B.rankStep * (n + 1)) : null;
  };''')

add('js/domain.js', 'D4 doLordTrain 头注释',
    '''  /* 练功一次：扣体力 + 粮 → 产修为（常产）+ 经验（未到段顶才给） */
  GAME.doLordTrain = function () {''',
    '''  /* 练功一次：扣体力 + 粮 → 产经验（未到段顶才给）
     · v90.94：不再产「修为」（练功与突破已解耦 · 见 DATA.LORD_BREAK 注释） */
  GAME.doLordTrain = function () {''')

add('js/domain.js', 'D5 doLordTrain 去修为产出',
    '''    var gain = Math.round(B.cultivBase + (g.level || 1) * B.cultivPerLv);
    g.cultiv = (g.cultiv || 0) + gain;
    var tail;''',
    '''    var tail;''')

add('js/domain.js', 'D6 doLordTrain 收尾',
    '''    GAME.log('🧘 ' + g.name + ' 练功：修为 +' + gain + '（现 ' + g.cultiv + '）' + tail, 'sys', 'staff');
    return { ok: true, gain: gain, cultiv: g.cultiv,
      msg: '练功完成：修为 +' + gain + '（现 ' + g.cultiv + '）' + tail };''',
    '''    var say = tail.replace(/^　/, '');
    GAME.log('🧘 ' + g.name + ' 练功（耗体力 ' + B.trainSta + '）：' + say, 'sys', 'staff');
    return { ok: true, msg: '练功完成：' + say };''')

add('js/domain.js', 'D7 doLordBreak 头注释',
    '''  /* 突破：须在段顶且修为够 → 上限 +60、境界进一阶、发自由点 */''',
    '''  /* 突破：须在段顶 + 爵位够 + 四关过 → 上限 +60、境界进一阶、发自由点
     （v90.94：门槛由「修为」改为「爵位（威望档）」） */''')

add('js/domain.js', 'D8 need 出口',
    '''    var B = DATA.LORD_BREAK, cap = GAME.genLevelCap(g), need = GAME.lordCultivNeed(g);''',
    '''    var B = DATA.LORD_BREAK, cap = GAME.genLevelCap(g), need = GAME.lordRankNeed(g);''')

add('js/domain.js', 'D9 考验注释',
    '''    /* v89.177（老板「君主的突破要求更高……综合考验」）：修为之外，还须过
       "政/城/军/资/宝"五关（DATA.LORD_BREAK.trials）——缺哪关提示哪关。 */''',
    '''    /* v89.177（老板「君主的突破要求更高……综合考验」）：爵位之外，还须过
       "城/军/资/宝"四关（DATA.LORD_BREAK.trials）——缺哪关提示哪关。 */''')

add('js/domain.js', 'D9b 修为判定 → 爵位判定',
    '''    var cur = g.cultiv || 0;
    if (cur < need) {
      return { ok: false, msg: '修为不足（需 ' + need + '，现 ' + cur + '），继续练功' };
    }''',
    '''    var curRank = (GAME.state && GAME.state.rank) || 0;
    if (curRank < need) {
      return { ok: false, msg: '爵位不足（需 ' + need + ' 档，现 ' + curRank + ' 档）—— 先晋升威望' };
    }''')

add('js/domain.js', 'D10 扣修为 → 去掉',
    '''    g.cultiv = cur - need;
    g.breaks = GAME.lordBreaksOf(g) + 1;''',
    '''    g.breaks = GAME.lordBreaksOf(g) + 1;''')

add('js/domain.js', 'D11 expBlockOf 文案',
    '''        + DATA.LORD_BREAK.step + ' 级一段）—— 须在君主面板「练功」攒够修为后「突破」方可续升'
        + (GAME.lordCultivNeed(g) == null ? '；已至天启体上限，无更高境界' : '');''',
    '''        + DATA.LORD_BREAK.step + ' 级一段）—— 须在君主面板「突破」方可续升'
        + (GAME.lordRankNeed(g) == null ? '；已至天启体上限，无更高境界' : '');''')

# ============ ③ js/ui.js ============
add('js/ui.js', 'D12 修行行变量',
    '''            var bCap = GAME.genLevelCap(lg), bNeed = GAME.lordCultivNeed(lg);
            var bCur = Math.round(lg.cultiv || 0), atTop = (lg.level || 1) >= bCap;
            var canBreak = atTop && bNeed != null && bCur >= bNeed;''',
    '''            var bCap = GAME.genLevelCap(lg), bNeed = GAME.lordRankNeed(lg);
            var bRank = (s.rank || 0), atTop = (lg.level || 1) >= bCap;
            var canBreak = atTop && bNeed != null && bRank >= bNeed;''')

add('js/ui.js', 'D13 修行行正文',
    '''              '<tr><td class="k">君主修行</td><td>境界 <b>' + GAME.lordRealmOf(lg) + '</b>' +
              '　修为 <b>' + U.fmt(bCur) + '</b>' + (bNeed == null ? '（已至顶）' : ' / ' + U.fmt(bNeed)) +
              '　<button class="btn sm' + (atTop ? '' : ' gold') + '" data-action="lord-train">🧘 练功</button>' +
              ' <button class="btn sm' + (canBreak ? ' gold' : '') + '" data-action="lord-break">⚡ 突破</button>' +
              '<div class="ui-sub">每 ' + DATA.LORD_BREAK.step + ' 级一段：练功攒修为，段顶须突破方可续升' +
              (bNeed == null ? '　·　已至天启体上限' : ('（下一段 Lv' + (bCap + DATA.LORD_BREAK.step) + ' 需修为 ' + U.fmt(bNeed) + '）')) +
              '</div>' + _trialHTML177 +
              '</td></tr>';''',
    '''              '<tr><td class="k">君主修行</td><td>境界 <b>' + GAME.lordRealmOf(lg) + '</b>' +
              '　爵位 <b>' + bRank + '</b>' + (bNeed == null ? '（已至顶）' : ' / ' + bNeed + ' 档') +
              '　<button class="btn sm' + (canBreak ? ' gold' : '') + '" data-action="lord-break">⚡ 突破</button>' +
              '<div class="ui-sub">每 ' + DATA.LORD_BREAK.step + ' 级一段：每升高 ' + DATA.LORD_BREAK.rankStep
              + ' 个爵位可突破一次，段顶须突破方可续升' +
              (bNeed == null ? '　·　已至天启体上限' : ('（下一段 Lv' + (bCap + DATA.LORD_BREAK.step) + ' 需爵位 ' + bNeed + ' 档）')) +
              '</div>' + _trialHTML177 +
              '</td></tr>';''')

add('js/ui.js', 'D14 练功条（移到面板最下方）',
    """          '<tr><td class="k">状态</td><td>正常</td></tr>' +
        '</tbody></table></div>' +
      '</div>',""",
    """          '<tr><td class="k">状态</td><td>正常</td></tr>' +
        '</tbody></table>' +
        /* v90.94（老板「给君主界面的最下方加一条练功菜单」）：练功条独立到面板最下方 ——
           与突破解耦（练功只涨经验，不再是突破门槛）。按不按得成由出口判（doLordTrain）。 */
        (lg ? (function () {
          var st = Math.round(GAME.staNow(lg));
          var stMax = Math.round((GAME.genAttrs(lg) || {}).staMax || 0);
          return '<div class="m-sec">🧘 练功</div>' +
            '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
            '<span>君主 Lv' + (lg.level || 1) + '　体力 <b>' + st + '</b> / ' + stMax + '</span>' +
            '<button class="btn sm gold" data-action="lord-train">🧘 练功一次</button>' +
            '<span class="ui-sub">耗体力 ' + DATA.LORD_BREAK.trainSta + ' + 少量净水：涨经验，助君主升级</span>' +
            '</div>';
        })() : '') +
        '</div>' +
      '</div>',""")

# ============ ④ smoke-test.js ============
add('smoke-test.js', 'D15 练功产修为 → 产经验',
    """      check('v89.65：练功产修为 + 经验（未到段顶）', function () {
        return withLord(function (lord, city) {
          if (!lord || !city) return false;
          lord.level = 10; lord.breaks = 0; lord.exp = 0; lord.cultiv = 0;
          G.setStaNow(lord, 100);
          city.res.grain = 1e9;
          var grain0 = city.res.grain, sta0 = G.staNow(lord);
          var r = G.doLordTrain();
          return r.ok === true && lord.cultiv > 0 && lord.exp > 0
            && city.res.grain < grain0          /* 真扣了粮 */
            && G.staNow(lord) === sta0 - DATA.LORD_BREAK.trainSta;
        });
      }());""",
    """      check('v90.94：练功产经验（练功与突破已解耦 · 不再产修为）', function () {
        return withLord(function (lord, city) {
          if (!lord || !city) return false;
          lord.level = 10; lord.breaks = 0; lord.exp = 0; lord.cultiv = 0;
          G.setStaNow(lord, 100);
          city.res.grain = 1e9;
          var grain0 = city.res.grain, sta0 = G.staNow(lord);
          var r = G.doLordTrain();
          return r.ok === true && lord.exp > 0
            && !(lord.cultiv > 0)               /* v90.94：修为不再产出 */
            && city.res.grain < grain0          /* 真扣了粮 */
            && G.staNow(lord) === sta0 - DATA.LORD_BREAK.trainSta;
        });
      }());""")

add('smoke-test.js', 'D16 段顶练功',
    """      check('v89.65：到段顶后练功只产修为（经验不再累积）', function () {
        return withLord(function (lord, city) {
          if (!lord || !city) return false;
          lord.breaks = 0; lord.level = G.genLevelCap(lord);   /* = 60 */
          lord.exp = 0; lord.cultiv = 0;
          G.setStaNow(lord, 100); city.res.grain = 1e9;
          var r = G.doLordTrain();
          return r.ok === true && lord.cultiv > 0 && lord.exp === 0;
        });
      }());""",
    """      check('v90.94：到段顶后练功不给经验（且仍不产修为）', function () {
        return withLord(function (lord, city) {
          if (!lord || !city) return false;
          lord.breaks = 0; lord.level = G.genLevelCap(lord);   /* = 60 */
          lord.exp = 0; lord.cultiv = 0;
          G.setStaNow(lord, 100); city.res.grain = 1e9;
          var r = G.doLordTrain();
          return r.ok === true && lord.exp === 0 && !(lord.cultiv > 0);
        });
      }());""")

add('smoke-test.js', 'D17 体力不足（去修为判据）',
    """          G.setStaNow(lord, 0);
          city.res.grain = 1e9;
          var r = G.doLordTrain();
          return r.ok === false && lord.cultiv === 0 && /体力/.test(r.msg);""",
    """          G.setStaNow(lord, 0);
          city.res.grain = 1e9;
          var r = G.doLordTrain();
          return r.ok === false && /体力/.test(r.msg);""")

add('smoke-test.js', 'D18 突破门槛（修为→爵位）',
    """      check('v89.65：突破须"段顶 + 修为够"（未到顶拒 / 修为不足拒 / 满足则跨段）', function () {
        return withLord(function (lord, city) {
          if (!lord) return false;
          /* ① 未到段顶：拒 */
          lord.breaks = 0; lord.level = 10; lord.cultiv = 1e9; lord.exp = 0;
          if (G.doLordBreak().ok !== false) return false;
          /* ② 段顶但修为不足：拒 */
          lord.level = 60; lord.cultiv = 0;
          if (G.doLordBreak().ok !== false) return false;
          /* ③ v89.177（老板「综合考验」）：段顶 + 修为够，但五关不过 → **拒**（提示综合考验） */
          var need = G.lordCultivNeed(lord);
          lord.cultiv = need;
          var r0 = G.doLordBreak();
          if (r0.ok !== false || !/综合考验/.test(r0.msg)) return false;
          /* ③b 灌满五关（政务 3 / 城池 2 / 兵力 5k / 持金 5w / 珠宝 2 种）→ 跨段。
                 ⚠️ 用例改状态要还原（§131 纪律）——失败前也要恢复。 */
          var bk = {
            done: G.state.quests.done,
            cities: G.state.cities.slice(),
            army: G.state.cities.map(function (c) { return c.army; }),
            items: JSON.parse(JSON.stringify(G.state.items || {})),
            gold: G.goldOf(),
          };
          var ok = false;
          try {
            G.state.quests.done = { qa: 1, qb: 1, qc: 1 };
            var c2 = JSON.parse(JSON.stringify(G.state.cities[0]));
            c2.id = 'p2-test'; c2.army = { buxingji: 3000 };
            G.state.cities.forEach(function (c) { c.army = { buxingji: 3000 }; });
            G.state.cities.push(c2);
            G.goldAdd(bk.gold >= 50000 ? 0 : (50000 - bk.gold));
            G.state.items.bengzhu = 2;
            G.state.items.mila = 1;
            var fp0 = lord.freePts || 0;
            var r = G.doLordBreak();
            ok = r.ok === true && lord.breaks === 1 && lord.cultiv === 0
              && G.genLevelCap(lord) === 120 && (lord.freePts || 0) > fp0;
          } finally {
            G.state.quests.done = bk.done;
            G.state.cities = bk.cities;
            bk.cities.forEach(function (c, i2) { c.army = bk.army[i2]; });
            G.state.items = bk.items;
            G.goldAdd(bk.gold - G.goldOf());
          }
          return ok;
        });
      }());""",
    """      check('v90.94：突破须"段顶 + 爵位够"（未到顶拒 / 爵位不足拒 / 满足则跨段）', function () {
        return withLord(function (lord, city) {
          if (!lord) return false;
          var bkRank = G.state.rank;
          /* ① 未到段顶：拒 */
          lord.breaks = 0; lord.level = 10; lord.exp = 0; G.state.rank = 9;
          if (G.doLordBreak().ok !== false) return false;
          /* ② 段顶但爵位不足：拒（第 1 次突破需 3 档威望 · rankStep=3） */
          lord.level = 60; G.state.rank = 2;
          if (G.doLordBreak().ok !== false) return false;
          /* ③ v89.177（老板「综合考验」）：段顶 + 爵位够，但四关不过 → **拒**（提示综合考验） */
          G.state.rank = G.lordRankNeed(lord);
          var r0 = G.doLordBreak();
          if (r0.ok !== false || !/综合考验/.test(r0.msg)) return false;
          /* ③b 灌满四关（城池 2 / 兵力 5k / 持金 5w / 珠宝 2 种）→ 跨段。
                 ⚠️ 用例改状态要还原（§131 纪律）——失败前也要恢复。 */
          var bk = {
            cities: G.state.cities.slice(),
            army: G.state.cities.map(function (c) { return c.army; }),
            items: JSON.parse(JSON.stringify(G.state.items || {})),
            gold: G.goldOf(),
          };
          var ok = false;
          try {
            var c2 = JSON.parse(JSON.stringify(G.state.cities[0]));
            c2.id = 'p2-test'; c2.army = { buxingji: 3000 };
            G.state.cities.forEach(function (c) { c.army = { buxingji: 3000 }; });
            G.state.cities.push(c2);
            G.goldAdd(bk.gold >= 50000 ? 0 : (50000 - bk.gold));
            G.state.items.bengzhu = 2;
            G.state.items.mila = 1;
            var fp0 = lord.freePts || 0;
            var r = G.doLordBreak();
            ok = r.ok === true && lord.breaks === 1
              && G.genLevelCap(lord) === 120 && (lord.freePts || 0) > fp0;
          } finally {
            G.state.rank = bkRank;
            G.state.cities = bk.cities;
            bk.cities.forEach(function (c, i2) { c.army = bk.army[i2]; });
            G.state.items = bk.items;
            G.goldAdd(bk.gold - G.goldOf());
          }
          return ok;
        });
      }());""")

add('smoke-test.js', 'D19 三次突破封顶',
    """      check('v89.65：三突破到天启体上限后不再有突破（needs 用尽 → null）', function () {
        return withLord(function (lord) {
          if (!lord) return false;
          lord.breaks = 3; lord.level = 240; lord.cultiv = 1e9;
          if (G.lordCultivNeed(lord) !== null) return false;""",
    """      check('v90.94：三突破到天启体上限后不再有突破（爵位门槛用尽 → null）', function () {
        return withLord(function (lord) {
          if (!lord) return false;
          lord.breaks = 3; lord.level = 240;
          if (G.lordRankNeed(lord) !== null) return false;""")


def main():
    apply = '--apply' in sys.argv

    # ---- 阶段一：全量校验 ----
    cache = {}
    bad = 0
    for path, tag, old, new in EDITS:
        if path not in cache:
            cache[path] = io.open(os.path.join(ROOT, path), encoding='utf-8', newline='').read()
        c = cache[path].count(old)
        flag = 'OK ' if c == 1 else 'FAIL'
        if c != 1:
            bad += 1
        print('[%s] %-28s %-14s count=%d' % (flag, path, tag, c))
    if bad:
        print('\n%d 处锚点未通过 —— 拒绝落盘。' % bad)
        return 1
    print('\n全部 %d 处锚点唯一 ✓' % len(EDITS))
    if not apply:
        print('DRY-RUN（未写盘）。加 --apply 落盘。')
        return 0

    # ---- 阶段二：统一落盘 ----
    byfile = {}
    for path, tag, old, new in EDITS:
        byfile.setdefault(path, []).append((old, new, tag))
    for path, subs in byfile.items():
        p = os.path.join(ROOT, path)
        s = io.open(p, encoding='utf-8', newline='').read()
        n0 = len(s)
        for old, new, tag in subs:
            s = s.replace(old, new, 1)
        tmp = p + '.tmp'
        io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
        os.replace(tmp, p)
        print('WROTE %-18s %d → %d chars' % (path, n0, len(s)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
