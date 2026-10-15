# -*- coding: utf-8 -*-
"""v89.95 Patch H —— A1 虎符：黄金买不到的稀缺资源（发展限制器）。
① data.js   DATA.HUFU
② domain.js 虎符出口 + buildSlots 接入 + 城市扩编
③ battle.js onConquer 首占赏符
④ systems.js promote 爵位赏符（每 rankEvery 档）
⑤ state.js  rankUpUse：名世→天授 须虎符（掐断"纯黄金到顶档"的闭环）
⑥ ui.js     市场折价行 + 城池面板「虎符扩编」按钮 + 资质晋升所需
⑦ main.js   hufu-expand 动作
"""
import io

# ============================================== ① data.js
P = 'js/data.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(o, nw, tag):
    global s, n
    if nw in s:
        print('SKIP: ' + tag)
        return
    assert o in s, 'MISS: ' + tag
    s = s.replace(o, nw, 1)
    n += 1
    print('OK: ' + tag)


rep("""  DATA.MARKET_SLIP = {""",
"""  /* ============================================================
   * v89.95（A1 · 老板）：**虎符** —— 黄金买不到的"不可再生"资源
   * ------------------------------------------------------------
   * 老板原话：「原游戏以充值所得的元宝和装备作为不可再生资源……我们这个既然是
   *   单机游戏，如何创造和规划一种不可再生的难以获得的资源，合理设计其获得途径，
   *   嵌入当前经济系统中，使得作为玩家的发展限制器，否则玩家将通过黄金无所不能」。
   * 定位：**不是数值，而是"开门"** —— 它不解锁强度，只解锁"再往上走"的资格：
   *   · 问鼎天授（名世 → 天授，每将 1 枚）：顶档资质从此不是"种一株天授果"就能到；
   *   · 城池扩编（每城 +1 建造位，每城最多 citySlotMax 次）：城市铺开的节奏闸。
   * 获得途径（**只能打出来 / 赐下来，绝不能买**）：
   *   · 首次攻占名城：县城 1 / 郡城 2 / 州城 3 / 都城 5（同一座城只算一次）；
   *   · 爵位每 rankEvery 档 → +1（22 档共 5 枚，赏赐性质）；
   * 与战斗玩家的关系（老板第 3 问）：**打仗是虎符的唯一大宗来源** ——
   *   不想蹲田的人靠开疆拓土换编制与顶档，这就是"替代内容"。
   * ⚠️ 总闸：数量与用途都在本表，别处不许再写一份。
   * ============================================================ */
  DATA.HUFU = {
    name: '虎符', icon: '🐯',
    byTier: { county: 1, jun: 2, zhou: 3, capital: 5 },
    rankEvery: 4,
    citySlotMax: 2,
    tianshouCost: 1,
    desc: '黄金买不到：首次攻占名城（县1/郡2/州3/都5）· 爵位每 4 档 +1。用途：名世→天授（1 枚）· 城池扩编（建造位 +1，每城至多 2 次）。',
  };

  DATA.MARKET_SLIP = {""",
'DATA.HUFU')

if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED data.js x%d' % n)

# ============================================== ② domain.js
P = 'js/domain.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0

rep("""  GAME.buildSlots = function (city) {""",
"""  /* ============================================================
   * v89.95（A1）：**虎符** —— 唯一出口（读/赏/扣/用）
   * ------------------------------------------------------------
   * 存储：`s.hufu`（数量）· `s.hufuTaken = { 来源键: true }`（防重复领取，随档走）。
   * 所有赏赐都经 `hufuClaim`（幂等）或 `hufuGrant`（可重复，如爵位）；
   * 所有消耗都经 `hufuSpend` —— 上层不许直接改 s.hufu。
   * ============================================================ */
  GAME.hufuCfg = function () { return DATA.HUFU || { name: '虎符', icon: '🐯', byTier: {}, rankEvery: 4, citySlotMax: 2, tianshouCost: 1 }; };
  GAME.hufuOf = function () {
    var s0 = GAME.state;
    return Math.max(0, (s0 && s0.hufu) || 0);
  };
  GAME.hufuGrant = function (cnt, why) {
    var s0 = GAME.state;
    if (!s0 || !(cnt > 0)) return 0;
    s0.hufu = Math.max(0, (s0.hufu || 0)) + Math.round(cnt);
    GAME.log('🐯 得虎符 ×' + Math.round(cnt) + '（' + (why || '赏赐') + '）· 现有 ' + s0.hufu);
    return Math.round(cnt);
  };
  /* 幂等赏赐：同一来源键只给一次（首占某城 / 某次首通） */
  GAME.hufuClaim = function (key, cnt, why) {
    var s0 = GAME.state;
    if (!s0 || !key || !(cnt > 0)) return 0;
    s0.hufuTaken = s0.hufuTaken || {};
    if (s0.hufuTaken[key]) return 0;
    s0.hufuTaken[key] = 1;
    return GAME.hufuGrant(cnt, why);
  };
  GAME.hufuSpend = function (cnt, why) {
    var s0 = GAME.state, need = Math.max(0, Math.round(cnt || 0));
    if (!s0) return { ok: false, msg: '无存档' };
    if (need <= 0) return { ok: true, msg: '' };
    if (GAME.hufuOf() < need) {
      return { ok: false, msg: '虎符不足（需 ' + need + ' 枚，现有 ' + GAME.hufuOf() + '）—— 虎符只能靠攻占名城与爵位赏赐获得' };
    }
    s0.hufu -= need;
    GAME.log('🐯 用虎符 ×' + need + '（' + (why || '') + '）· 余 ' + s0.hufu);
    return { ok: true, msg: '用虎符 ×' + need };
  };
  GAME.hufuTextOf = function () {
    return (GAME.hufuCfg().icon || '🐯') + ' 虎符 ×' + GAME.hufuOf();
  };
  /* 城池扩编：每城 +1 建造位，每城最多 citySlotMax 次（另扣 1 枚虎符） */
  GAME.hufuExpandCity = function (cityId) {
    var s0 = GAME.state;
    var c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!c) return { ok: false, msg: '城池不存在' };
    var C = GAME.hufuCfg();
    var used = c.hufuSlots || 0;
    if (used >= (C.citySlotMax || 2)) {
      return { ok: false, msg: c.name + ' 已扩编 ' + used + ' 次（每城上限 ' + (C.citySlotMax || 2) + ' 次）' };
    }
    var sp = GAME.hufuSpend(1, '扩编 · ' + c.name);
    if (!sp.ok) return sp;
    c.hufuSlots = used + 1;
    GAME.log('🏗️ ' + c.name + ' 扩编：建造位 +1（现 ' + GAME.buildSlots(c) + ' 格）');
    return { ok: true, msg: c.name + ' 扩编成功：建造位 +1（现 ' + GAME.buildSlots(c) + ' 格，已用虎符 '
      + c.hufuSlots + '/' + (C.citySlotMax || 2) + '）' };
  };

  GAME.buildSlots = function (city) {""",
'虎符出口')

rep("""    var base = 3 + GAME.mastery('buildSlot', null) + GAME.cityBonusNum(city, 'buildSlot');   /* v79：+ 爵位建造位 */""",
"""    var base = 3 + GAME.mastery('buildSlot', null) + GAME.cityBonusNum(city, 'buildSlot')   /* v79：+ 爵位建造位 */
      + (city.hufuSlots || 0);   /* v89.95（A1）：虎符扩编（每城至多 +2） */""",
'buildSlots 接入')

if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED domain.js x%d' % n)

# ============================================== ③ battle.js
P = 'js/battle.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0
rep("""    var s = GAME.state;
    var inherit = GAME.npcCityRes(npcCity);
    var keep = (DATA.EXPEDITION.cityInherit != null) ? DATA.EXPEDITION.cityInherit : 0.8;""",
"""    var s = GAME.state;
    /* v89.95（A1）：**首占名城 → 虎符**（黄金买不到的稀缺资源，见 DATA.HUFU）。
       同一座城只算一次（hufuClaim 幂等）；档位越高的城给得越多。 */
    var _hfCfg = DATA.HUFU || { byTier: {} };
    var _hfN = ((_hfCfg.byTier || {})[npcCity.type]) || 0;
    if (_hfN > 0 && GAME.hufuClaim) {
      GAME.hufuClaim('city:' + npcCity.id, _hfN, '首占 ' + npcCity.name);
    }
    var inherit = GAME.npcCityRes(npcCity);
    var keep = (DATA.EXPEDITION.cityInherit != null) ? DATA.EXPEDITION.cityInherit : 0.8;""",
'onConquer 赏符')
if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED battle.js x%d' % n)

# ============================================== ④ systems.js
P = 'js/systems.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0
rep("""    s.rank += 1;
    /* v79（神器 · 特殊活动）：爵位晋升 → 供奉值大额入账 */""",
"""    s.rank += 1;
    /* v89.95（A1）：爵位每 rankEvery 档 → 赏虎符 ×1（22 档共 5 枚） */
    var _hfE = (DATA.HUFU || {}).rankEvery || 4;
    if (s.rank % _hfE === 0 && GAME.hufuGrant) {
      GAME.hufuGrant(1, '爵位晋至 ' + DATA.RANK[s.rank].name);
    }
    /* v79（神器 · 特殊活动）：爵位晋升 → 供奉值大额入账 */""",
'promote 赏符')
if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED systems.js x%d' % n)

# ============================================== ⑤ state.js
P = 'js/state.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0
rep("""    g.rank = item.to;
    var nr = DATA.GEN_RANK_BY_ID[item.to] || {};""",
"""    /* v89.95（A1）：**顶档（天授）须虎符** —— 虎符只能打（首占名城）或爵位赏赐，
       黄金买不到。于是"全链 54 万金打通资质"这条闭环被掐断：
       有钱也得到战场上去挣那枚符（老板第 1 问的"发展限制器"）。 */
    if (item.to === 'tianshou') {
      var _hfC = (DATA.HUFU || {}).tianshouCost || 1;
      var _sp = GAME.hufuSpend ? GAME.hufuSpend(_hfC, '问鼎天授 · ' + g.name) : { ok: false, msg: '虎符系统不可用' };
      if (!_sp.ok) return _sp;
    }
    g.rank = item.to;
    var nr = DATA.GEN_RANK_BY_ID[item.to] || {};""",
'天授须虎符')
if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED state.js x%d' % n)

# ============================================== ⑥ ui.js
P = 'js/ui.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0
rep("""      '<div class="res-line" style="margin-top:2px;border:none;"><span class="lbl">黄金</span><span class="val">💰 ' +
        U.fmt(s.res.gold || 0) + '</span></div>' +
      '<table class="ms-table"><thead><tr>' +""",
"""      '<div class="res-line" style="margin-top:2px;border:none;"><span class="lbl">黄金</span><span class="val">💰 ' +
        U.fmt(s.res.gold || 0) + '</span></div>' +
      /* v89.95（A2/A3）：物多价贱 —— 今日已售/当前汇率/通商券免折额度 */
      '<div class="ms-note" style="margin-top:2px;">📉 ' + U.escape(GAME.mktSlipText ? GAME.mktSlipText() : '') + '</div>' +
      '<table class="ms-table"><thead><tr>' +""",
'市场折价行')

rep("""            '<button class="btn" data-action="city-dispatch" data-city="' + city.id + '">将领派遣</button>' +
            '<button class="btn" data-action="city-rename" data-city="' + city.id + '">改名</button>'""",
"""            '<button class="btn" data-action="city-dispatch" data-city="' + city.id + '">将领派遣</button>' +
            /* v89.95（A1）：虎符扩编 —— 每城 +1 建造位（至多 2 次），消耗 1 枚虎符 */
            '<button class="btn" data-action="hufu-expand" data-city="' + city.id +
              '" title="' + U.escape((DATA.HUFU || {}).desc || '') + '">🐯 虎符扩编 · 建造位 +1（' +
              ((city.hufuSlots || 0) >= ((DATA.HUFU || {}).citySlotMax || 2)
                ? '本城已满 ' + (city.hufuSlots || 0) + '/' + ((DATA.HUFU || {}).citySlotMax || 2)
                : '本城 ' + (city.hufuSlots || 0) + '/' + ((DATA.HUFU || {}).citySlotMax || 2)
                  + '　持符 ' + GAME.hufuOf()) + '</button>' +
            '<button class="btn" data-action="city-rename" data-city="' + city.id + '">改名</button>'""",
'城池面板扩编按钮')

if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED ui.js x%d' % n)

# ============================================== ⑦ main.js
P = 'js/main.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0
rep("""      case 'city-dispatch': ui.openDispatch(el.dataset.city); break;""",
"""      case 'city-dispatch': ui.openDispatch(el.dataset.city); break;
      /* v89.95（A1）：虎符扩编（每城 +1 建造位，至多 2 次）—— 结果 toast + 重开面板 */
      case 'hufu-expand': {
        var _heR = GAME.hufuExpandCity(el.dataset.city);
        ui.toast((_heR.ok ? '🐯 ' : '⚠️ ') + _heR.msg);
        if (_heR.ok) {
          GAME.refreshAll();
          var _heC = GAME.cityById(el.dataset.city);
          if (_heC) ui.openCityPanel(_heC);
        }
        break;
      }""",
'hufu-expand 动作')
if s != orig:
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('PATCHED main.js x%d' % n)

import subprocess
for f in ['js/data.js', 'js/domain.js', 'js/battle.js', 'js/systems.js', 'js/state.js', 'js/ui.js', 'js/main.js']:
    r = subprocess.run(['node', '--check', f], capture_output=True, cwd='E:/Deepseekdb')
    print(f + ': ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:220]))
