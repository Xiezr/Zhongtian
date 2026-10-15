# -*- coding: utf-8 -*-
"""v89.99-A 主补丁：人口经济四件套（幂等；锚点缺失即报错退出）
  1) data.js   : DATA.POP_CFG / DATA.DISBAND / DATA.CAPTIVE + 增民令（民生类）
  2) domain.js : popGrowthOf 四杠杆化 + 三乘数出口 + popSourcesOf + GAME.disbandAt
  3) state.js  : （tick 已有"上限外不回落"语义，不动）
  4) systems.js: useItem 新增 pop_boost 分支（取最强 + 真到期）
  5) battle.js : GAME.battle.captiveGain + 胜战落账钩子
  6) ui.js     : SHOP_CATS 民生页 + 军队面板「解散」按钮 + 人口三段条来源悬停
  7) main.js   : troop-disband 动作分发
"""
import io, sys

R = 'E:/Deepseekdb/'
N = [0]
def rep(path, old, new, tag, must=True):
    p = R + path
    s = io.open(p, encoding='utf-8').read()
    if new in s:
        print('SKIP ' + tag)
        return
    if old not in s:
        if must:
            print('MISS ' + tag); sys.exit(1)
        print('miss(soft) ' + tag); return
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    N[0] += 1
    print('OK   ' + tag)

# ============ 1) data.js ============
rep('js/data.js',
"""  DATA.SPD_CAP = { perLevels: 5, base: 10 };
""",
"""  DATA.SPD_CAP = { perLevels: 5, base: 10 };

  /* ============================================================
   * v89.99（老板：「开发增加人口增长的其他路径」·「设计兵种解散」）
   * **人口经济四件套**配置 —— 全部唯一来源，别处不许再写第二份。
   * ------------------------------------------------------------
   * · POP_CFG —— 增速公式的三条杠杆（基数仍是民房上限）：
   *     守将内政（安置流民）/ 增民令（道具 buff）/ 税制（轻徭薄赋）。
   *     保底 1/时**也吃杠杆**（否则小城期道具与税制形同虚设）。
   * · DISBAND —— 兵种解散：人口 100% 归农；**军资不退**（那是"仓储费"，
   *     退了就能"募→散"刷资源，闭环会漏）。人口可超上限（见 tickOnce：
   *     上限只是增长线，超了不增长也不回落）——这就是"人口银行"的前提。
   * · CAPTIVE —— 俘获迁民：打胜据点/名城，按敌军损失比例收编为人口
   *     （野地无民可俘；小仗不收编，避免"刷麻了"）。
   * ============================================================ */
  DATA.POP_CFG = {
    base: 0.0005,        /* 每小时 = 民房上限 × 0.05% */
    minPerHour: 1,       /* 保底 1/时 */
    govPerNz: 0.0005,    /* 守将内政 1 点 → 增速 +0.05% */
    govCap: 0.5,         /* 内政加成封顶 +50% */
    taxPivot: 0.5,       /* 税制杠杆支点：50% 税率 = 不增不减 */
    taxCoef: 0.6,        /* 税率每低 10% → 增速 +6%（轻徭薄赋则户口滋殖） */
    taxFloor: 0.6, taxCeil: 1.4,
  };
  DATA.DISBAND = { popReturn: 1 };
  DATA.CAPTIVE = { rate: 0.06, min: 15, cap: 500, kinds: ['fort', 'city'] };
""",
'data: POP_CFG/DISBAND/CAPTIVE')

rep('js/data.js',
"""    { id: 'shuilibian', name: '税吏鞭', type: 'prod_buff', res: 'gold', eff: 0.25, dur: 24, price: 10, desc: '黄金收入+25%（24h）' },
""",
"""    { id: 'shuilibian', name: '税吏鞭', type: 'prod_buff', res: 'gold', eff: 0.25, dur: 24, price: 10, desc: '黄金收入+25%（24h）' },
    /* v89.99（老板「增加道具如增民令」）：**民生类** —— 人口增速道具。
       与生产类同纪律：同类只取最强（不叠加）+ 到期真消费（popBoostMult 读 until）。 */
    { id: 'zengminling', name: '增民令', type: 'pop_boost', eff: 2.0, dur: 24, price: 30,
      desc: '人口增速 +200%（24h）—— 轻徭薄赋、劝课农桑，流民闻风来归' },
""",
'data: 增民令')

# ============ 2) domain.js ============
rep('js/domain.js',
"""  GAME.popGrowthOf = function (city) {
    var maxPop = GAME.maxPopOf(city);
    return Math.max(1, maxPop * 0.0005);
  };
""",
"""  GAME.popGrowthOf = function (city) {
    /* v89.99（老板「开发增加人口增长的其他路径」）：增速吃**三条杠杆** ——
       ② 守将内政（安置流民）· ③ 增民令（商城道具）· ④ 税制（轻徭薄赋）；
       基数仍是民房上限。分解走 GAME.popSourcesOf（界面悬停可见，不搞黑箱）。 */
    var cfg = DATA.POP_CFG || {};
    var base = Math.max(cfg.minPerHour == null ? 1 : cfg.minPerHour,
      GAME.maxPopOf(city) * (cfg.base == null ? 0.0005 : cfg.base));
    return base * (1 + GAME.popGovBonus(city)) * GAME.popBoostMult() * GAME.popTaxMul();
  };
  /* ② 守将内政 → 人口增速（本城守将；封顶见 DATA.POP_CFG.govCap） */
  GAME.popGovBonus = function (city) {
    var g = GAME.guardGeneralOf(city);
    if (!g) return 0;
    var cfg = DATA.POP_CFG || {};
    var a = GAME.genAttrs(g);
    return Math.min(cfg.govCap == null ? 0.5 : cfg.govCap,
      (a.nz || 0) * (cfg.govPerNz == null ? 0.0005 : cfg.govPerNz));
  };
  /* ③ 增民令 → 增速乘数（1 + eff；**每次读 until** —— 到期自动失效，
     绝不重蹈"写进去没人读"的死字段覆辙） */
  GAME.popBoostMult = function () {
    var s = GAME.state;
    var b = s && s.buffs && s.buffs.popBoost;
    if (!b || !(b.until > U.now())) return 1;
    return 1 + (b.mult || 0);
  };
  /* ④ 税制 → 增速乘数（轻徭薄赋 / 横征暴敛；夹在 [floor, ceil]） */
  GAME.popTaxMul = function () {
    var s = GAME.state;
    var cfg = DATA.POP_CFG || {};
    var tax = (s && s.tax != null) ? s.tax : 0.5;
    var m = 1 + ((cfg.taxPivot == null ? 0.5 : cfg.taxPivot) - tax) * (cfg.taxCoef == null ? 0.6 : cfg.taxCoef);
    return Math.max(cfg.taxFloor == null ? 0.6 : cfg.taxFloor,
      Math.min(cfg.taxCeil == null ? 1.4 : cfg.taxCeil, m));
  };
  /* 增速来源分解（界面悬停唯一出口；也是"加成显性化"的边界） */
  GAME.popSourcesOf = function (city) {
    return [
      { name: '守将内政', v: GAME.popGovBonus(city) },
      { name: '增民令', v: GAME.popBoostMult() - 1 },
      { name: '税制', v: GAME.popTaxMul() - 1 },
    ];
  };

  /* ============================================================
   * v89.99（老板「设计兵种解散」）：**解散归农** —— 唯一出口
   * ------------------------------------------------------------
   * 人口 100% 返还（比例见 DATA.DISBAND）；军资不退。
   * 用途：① 人口银行——顶到上限的增长先存成义兵，要人时解散归农；
   *       ② 兵种转型——解散旧兵种、腾人口改募目标兵种。
   * ============================================================ */
  GAME.disbandAt = function (cityId, troopId, count) {
    var s = GAME.state;
    var city = GAME.cityById(cityId) || GAME.currentCity();
    if (!city || (s.cities || []).indexOf(city) < 0) return { ok: false, msg: '只能在自己的城池解散部队' };
    var t = DATA.TROOPS[troopId];
    if (!t) return { ok: false, msg: '未知兵种' };
    count = Math.floor(Number(count));
    if (!count || count <= 0 || !isFinite(count)) return { ok: false, msg: '解散数量无效（请填写大于 0 的整数）' };
    city.army = city.army || {};
    var have = city.army[troopId] || 0;
    if (have <= 0) return { ok: false, msg: '本城没有' + t.name + '可解散' };
    var n = Math.min(have, count);
    city.army[troopId] = have - n;
    if (city.army[troopId] <= 0) delete city.army[troopId];
    var cfg = DATA.DISBAND || {};
    var back = Math.floor(n * (t.pop || 0) * (cfg.popReturn == null ? 1 : cfg.popReturn));
    var Rr = GAME.res(city);
    Rr.pop = (Rr.pop || 0) + back;
    GAME.log('🕊 ' + city.name + '：解散 ' + t.name + ' ×' + U.fmt(n) + '，归农 +' + U.fmt(back) + ' 人（军资不退）');
    return { ok: true, msg: '解散 ' + t.name + ' ×' + U.fmt(n) + '　归农 +' + U.fmt(back) + ' 人口', n: n, pop: back };
  };
""",
'domain: 增长四杠杆 + 解散出口')

# ============ 4) systems.js ============
rep('js/systems.js',
"""    } else if (item.type === 'build_cost') {
      s.buffs = s.buffs || {}; s.buffs.buildCost = { until: U.now() + (item.dur || 24) * 3600 * 1000, eff: item.eff };""",
"""    } else if (item.type === 'pop_boost') {
      /* v89.99（老板「增民令」）：人口增速道具 —— 与生产类同纪律：
         **同类只取最强**（不叠加）+ **到期真消费**（popBoostMult 每次读 until）。 */
      s.buffs = s.buffs || {};
      var pEff = item.eff || 1;
      var pCur = s.buffs.popBoost;
      var pStrong = !!(pCur && pCur.until > U.now() && (pCur.mult || 0) > pEff);
      s.buffs.popBoost = { mult: pStrong ? pCur.mult : pEff,
        until: U.now() + (item.dur || 24) * 3600 * 1000 };
      ok = true;
      msg = item.name + ' 生效：' + item.desc + (pStrong ? '（已有更强效果，本次仅刷新时长）' : '');
    } else if (item.type === 'build_cost') {
      s.buffs = s.buffs || {}; s.buffs.buildCost = { until: U.now() + (item.dur || 24) * 3600 * 1000, eff: item.eff };""",
'systems: pop_boost 分支')

# ============ 5) battle.js ============
rep('js/battle.js',
"""  GAME.onConquer = function (npcCity, result, gen, fromCity) {""",
"""  /* ============================================================
   * v89.99（老板：「人口不足就开发其他路径」）：**俘获迁民** —— 唯一出口
   * 打胜据点/名城时，按敌军损失比例把溃卒收编为「出征城」的人口。
   * 参数全在 DATA.CAPTIVE（kinds 白名单：野地不俘、小仗不收、有上限）。
   * ============================================================ */
  GAME.battle.captiveGain = function (city, result, target) {
    var cfg = DATA.CAPTIVE || {};
    if (!city || !result) return { gain: 0 };
    var kinds = cfg.kinds || ['fort', 'city'];
    if (kinds.indexOf(target && target.kind) < 0) return { gain: 0 };
    var defLoss = result.defLoss || 0;
    if (!(defLoss > 0)) return { gain: 0 };
    var gain = Math.round(defLoss * (cfg.rate == null ? 0.06 : cfg.rate));
    if (gain < (cfg.min == null ? 15 : cfg.min)) return { gain: 0 };
    gain = Math.min(cfg.cap == null ? 500 : cfg.cap, gain);
    var Rc = GAME.res(city);
    Rc.pop = (Rc.pop || 0) + gain;
    return { gain: gain, city: city.name };
  };

  GAME.onConquer = function (npcCity, result, gen, fromCity) {""",
'battle: captiveGain')

rep('js/battle.js',
"""    if (win) {
      /* v63（老板）：「野外城每天只能被掠夺一次」——**得手才计数**。""",
"""    if (win) {
      /* v89.99：俘获迁民 —— 攻破据点/名城，溃卒收编为民（唯一出口 captiveGain） */
      var _capt99 = GAME.battle.captiveGain(city, result, t);
      if (_capt99 && _capt99.gain > 0) {
        result.captives = _capt99;
        GAME.log('🪶 俘获迁民：' + _capt99.city + ' +' + U.fmt(_capt99.gain) + ' 人（溃卒收编）');
      }
      /* v63（老板）：「野外城每天只能被掠夺一次」——**得手才计数**。""",
'battle: 胜战钩子')

# ============ 6) ui.js ============
rep('js/ui.js',
"""    seed: '种子',
  };""",
"""    seed: '种子',
    /* v89.99（老板「增加道具如增民令」）：民生 —— 人口类道具。 */
    pop_boost: '民生',
  };""",
'ui: SHOP_CATS 民生')

rep('js/ui.js',
"""    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;""",
"""    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;
    var ownN = (sel && c.army && c.army[sel.id]) || 0;   /* v89.99：本城驻军（解散的门槛） */""",
'ui: ownN')

rep('js/ui.js',
"""        '<span class="ui-sub">上限 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(maxN, 0) + '</b></span>' +""",
"""        '<span class="ui-sub">上限 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(maxN, 0) + '</b></span>' +
        '<span class="ui-sub">驻军 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(ownN, 0) + '</b></span>' +""",
'ui: 驻军数')

rep('js/ui.js',
"""        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +
          (slotsLeft > 0 ? '' : ' disabled') + '>' + (ui._trainFilter === 'siege' ? '制造' : '训练') + '</button>' +""",
"""        /* v89.99（老板「设计兵种解散」）：解散 = 归农（人口返还、军资不退）。
           与募兵同栏（选中兵种 + 数量即用）—— 人口银行 / 兵种转型都从这里走。 */
        '<button class="btn" data-action="troop-disband" data-troop="' + ui._trainSel + '"' +
          (ownN > 0 ? '' : ' disabled') + ' title="解散本城驻军并归农（返还人口，不返还军资）">解散</button>' +
        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +
          (slotsLeft > 0 ? '' : ' disabled') + '>' + (ui._trainFilter === 'siege' ? '制造' : '训练') + '</button>' +""",
'ui: 解散按钮')

rep('js/ui.js',
"""          var pct = capP > 0 ? Math.min(100, Math.round(avail / capP * 100)) : 0;
          return '<span class="pop-3" title="可征＝当前可用人口（募兵从此扣）· 上限＝民房决定 · 增势＝每小时自然增长">' +
            '<span class="p3-k">人口</span>' +
            '<span class="p3-seg ok">可征 <b>' + U.numText(avail, 0) + '</b></span>' +
            '<span class="p3-seg">上限 <b>' + U.numText(capP, 0) + '</b></span>' +
            '<span class="p3-seg">增势 <b>+' + grow + '/时</b></span>' +
            '<span class="p3-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="p3-note">每兵占人口 ' + sel.pop + '</span>' +
            '</span>';""",
"""          var pct = capP > 0 ? Math.min(100, Math.round(avail / capP * 100)) : 0;
          /* v89.99：增势的来源分解（内政 / 增民令 / 税制）进悬停 —— 加成显性化 */
          var srcTxt = '';
          try {
            (GAME.popSourcesOf(c) || []).forEach(function (x) {
              if (Math.abs(x.v) > 1e-9) srcTxt += '　· ' + x.name + ' ' + (x.v > 0 ? '+' : '') + Math.round(x.v * 100) + '%';
            });
          } catch (e) {}
          return '<span class="pop-3" title="可征＝当前可用人口（募兵从此扣）· 上限＝民房决定 · 增势＝每小时自然增长' + srcTxt + '">' +
            '<span class="p3-k">人口</span>' +
            '<span class="p3-seg ok">可征 <b>' + U.numText(avail, 0) + '</b></span>' +
            '<span class="p3-seg">上限 <b>' + U.numText(capP, 0) + '</b></span>' +
            '<span class="p3-seg">增势 <b>+' + grow + '/时</b></span>' +
            '<span class="p3-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="p3-note">每兵占人口 ' + sel.pop + (capP > 0 && avail > capP ? '　· 超上限不增长' : '') + '</span>' +
            '</span>';""",
'ui: 人口条来源')

# ============ 7) main.js ============
rep('js/main.js',
"""      case 'confirm-train': GAME.doTrain(el.dataset.troop); break;""",
"""      case 'confirm-train': GAME.doTrain(el.dataset.troop); break;
      /* v89.99（老板「设计兵种解散」）：解散归农 —— 数量取同一输入框 */
      case 'troop-disband': {
        var dBc = GAME.currentCity();
        var dBn = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
        var dBr = GAME.disbandAt(dBc && dBc.id, el.dataset.troop, dBn);
        ui.toast((dBr.ok ? '🕊 ' : '') + dBr.msg);
        if (dBr.ok) { GAME.refreshAll(); ui.renderTroopsModal(); }
        break;
      }""",
'main: troop-disband')

print('--- A 补丁完成：%d 处 ---' % N[0])
