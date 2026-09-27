# v89.142 C1：data.js + battle.js —— 收编转兵 + 黄金支出（唯一出口三件套）
# 跑法：python .workbuddy/tools/patch/v89142_c1_conscript.py
import io
PD = 'E:/Deepseekdb/js/data.js'
PB = 'E:/Deepseekdb/js/battle.js'
bd = io.open('E:/Deepseekdb/backup/v89142/data.js.before', encoding='utf-8', newline='').read()
bb = io.open('E:/Deepseekdb/backup/v89142/battle.js.before', encoding='utf-8', newline='').read()

def patch(P, bak, pairs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in pairs:
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        print('OK ' + tag)
    assert '\r\n' not in s
    assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏[' + P + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('WROTE ' + P + ' len ' + str(len(s)))

# ---------- data.js ----------
patch(PD, bd, [
 ("""  /* v89.113（老板「战斗胜利为什么没有俘虏」）：**全战斗**都能俘获 ——
     原先只认 fort/city 两种目标（打野地、守城全都没有），且 cap 500 太低
     （歼灭 10 万也只见"俘 500"，等于看不见）。
     现在：kinds 覆盖野地/据点/名城/防御战；rate 8%、cap 3000。
     去向不变：**溃卒收编为民**（人口），与增民令/税制同一套经济。 */
  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'] };""",
  """  /* v89.113（老板「战斗胜利为什么没有俘虏」）：**全战斗**都能俘获 ——
     原先只认 fort/city 两种目标（打野地、守城全都没有），且 cap 500 太低
     （歼灭 10 万也只见"俘 500"，等于看不见）。
     现在：kinds 覆盖野地/据点/名城/防御战；rate 8%、cap 3000。
     v89.142（老板 5）：**去向重做** —— 「俘虏营收编直接转换为本城相应兵种，
       增加相应数量。收编应支出黄金。按照相应兵种造价（所有资源换算黄金）的 50% 计算」
       · `conscriptPct: 0.5` = 收编支金比例（兵种造价的 50%）；
       · `unknownAs: 'minfu'` = 无明细俘虏（旧档 / 骰子引擎）视为**民夫**入军
         （"转换为相应兵种"在无从对应时的兜底，不凭空丢弃也不虚增）；
       · 旧口径（收编加人口）随本条退役 —— 兑现出口见 battle.js 的 conscriptPlanOf。 */
  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'],
    conscriptPct: 0.5, unknownAs: 'minfu' };""",
  'd-CAPTIVE'),
])

# ---------- battle.js ----------
patch(PB, bb, [
 # ① 段注释（599-619 段）
 ("""  /* ============================================================
   * v89.99（老板：「人口不足就开发其他路径」）：**俘获迁民** —— 唯一出口
   * 打胜据点/名城时，按敌军损失比例把溃卒收编为「出征城」的人口。
   * 参数全在 DATA.CAPTIVE（kinds 白名单：野地不俘、小仗不收、有上限）。
   * ============================================================ */""",
  """  /* ============================================================
   * v89.99（老板「人口不足就开发其他路径」）：**俘获溃卒** —— 唯一出口
   * 打胜时按敌军损失比例把溃卒收入**俘虏营**（s.captives，逐兵种）。
   * 参数全在 DATA.CAPTIVE（kinds 白名单：野地不俘、小仗不收、有上限）。
   * v89.142（老板 5）：入营后的**去向重做** —— 收编 = 直接转入本城相应兵种 + 支金
   *   （50% 兵种造价），不再折算人口；见下方 conscriptPlanOf / doConscriptCaptives。
   * ============================================================ */""",
  'b-段注释1'),
 ("""   * 收编 / 释放由玩家在军务处决定（`GAME.doConscriptCaptives` / `doReleaseCaptives`）。""",
  """   * 收编 / 释放由玩家在军务处决定（`GAME.doConscriptCaptives` / `doReleaseCaptives`）。
   * v89.142：收编已改为**转入本城军队 + 支金**（50% 兵种造价）—— 不再折算人口。""",
  'b-段注释2'),
 # ② captivePopOf → 收编三件套
 ("""  /* v89.118（老板「增加的人口数量按俘虏的兵种人口乘以其数量总和，也就是俘虏的总人口」）：
     收编人口口径的**唯一出口** —— Σ(兵种数量 × 该兵种 `pop`)。
     界面按钮文案（campCard）、收编执行、探针与断言都读它，不许各算一份。
     'unknown'（旧档 / 无明细的来路）按 pop=1 计 —— 不假装知道兵种，也不虚增。 */
  GAME.captivePopOf = function (camp) {
    var map = camp || (GAME.state || {}).captives || {};
    var t = 0;
    for (var k in map) {
      var n = Math.max(0, Math.floor(map[k] || 0));
      if (!n) continue;
      var tt = DATA.TROOPS[k];
      t += n * ((tt && tt.pop) || 1);
    }
    return t;
  };
  /* 收编为民：**在收编这一刻**才加人口（老板口径），增量 = 俘虏的总人口（按兵种 pop 折算）。
     旧口径是"人口 += 人头数"，对本作的分兵种俘虏营不成立（弓手/象兵本就占多个人口）。 */
  GAME.doConscriptCaptives = function (cityId) {
    var s = GAME.state;
    var n = GAME.captivesTotalOf();
    if (!n) return { ok: false, msg: '俘虏营为空' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    if (!city) return { ok: false, msg: '没有可安置的城池' };
    var addPop = GAME.captivePopOf(s.captives);
    var Rc = GAME.res(city);
    Rc.pop = (Rc.pop || 0) + addPop;
    s.captives = {};
    GAME.log.sys('🪶 ' + city.name + ' 收编俘虏 ' + U.fmt(n) + ' 众为民（按兵种折算人口 +' +
      U.fmt(addPop) + '）');
    return { ok: true, msg: '收编 ' + U.fmt(n) + ' 众为民（人口 +' + U.fmt(addPop) + '）',
      n: n, pop: addPop, city: city.name };
  };""",
  """  /* ============================================================
   * v89.142（老板 5）：「俘虏营收编**直接转换为本城相应兵种**，增加相应数量。
   *   收编应支出黄金。按照相应兵种造价（所有资源换算黄金）的 50% 计算」
   * ------------------------------------------------------------
   * 三件套（全部唯一出口 —— 界面按钮文案 / 执行 / 探针 / 断言都读它们）：
   *   ① troopGoldCostOf(tid)：兵种造价的**黄金当量** = Σ 资源量 ÷ per × ratio
   *      （DATA.MARKET_SELL：粮1 木2 石3 铁4、每 20 单位 1 金 —— 与市场**平价**同源；
   *       不乘市场折损与"物多价贱"：那是"此刻卖值多少"，这里是"这座兵值多少钱"，
   *       稳定可对账，且四类同乘 → 1:2:3:4 的比例永远成立）；
   *   ② conscriptPlanOf(camp)：逐兵种转换明细 { byType, men, cost, pct }；
   *      无明细（'unknown'，旧档 / 骰子引擎）→ 计入 DATA.CAPTIVE.unknownAs（民夫）；
   *      花费 = Σ(数量 × 单兵黄金造价) × conscriptPct(50%)，**一次取整**（不逐项丢零头）。
   *   ③ doConscriptCaptives：读 ② 执行 —— 扣金 → 逐兵种入本城军队；**不再加人口**
   *      （"直接转换为本城相应兵种"= 兑现物就是兵，人口那条旧口径整条退役）。
   * ⛔ 旧出口 `captivePopOf`（Σ 兵种数量 × pop）随本条退役 —— 它只有"收编加人口"
   *    这一个语义，留着就是第二个出口。
   * ============================================================ */
  GAME.troopGoldCostOf = function (tid) {
    var c = DATA.MARKET_SELL || { per: 20, ratio: {} };
    var t = DATA.TROOPS[tid];
    if (!t || !t.cost || !c.per) return 0;
    var g = 0;
    for (var k in t.cost) g += (t.cost[k] || 0) / c.per * ((c.ratio && c.ratio[k]) || 0);
    return g;
  };
  GAME.conscriptPlanOf = function (camp) {
    var cfg = DATA.CAPTIVE || {};
    var map = camp || (GAME.state || {}).captives || {};
    var by = {}, men = 0, cost = 0;
    var UNK = cfg.unknownAs || 'minfu';
    for (var k in map) {
      var n = Math.max(0, Math.floor(map[k] || 0));
      if (!n) continue;
      var tid = (k === 'unknown' || !DATA.TROOPS[k]) ? UNK : k;   /* 无明细 → 民夫 */
      by[tid] = (by[tid] || 0) + n;
      men += n;
    }
    for (var t2 in by) cost += by[t2] * GAME.troopGoldCostOf(t2);
    var pct = (cfg.conscriptPct == null ? 0.5 : cfg.conscriptPct);
    return { byType: by, men: men, cost: Math.round(cost * pct), pct: pct };
  };
  /* 收编入军：**直接转换**为本城相应兵种（老板口径）；支金不足则整单拒绝（不半途扣） */
  GAME.doConscriptCaptives = function (cityId) {
    var s = GAME.state;
    var plan = GAME.conscriptPlanOf(s.captives);
    if (!plan.men) return { ok: false, msg: '俘虏营为空' };
    var city = (cityId && GAME.cityById(cityId)) || GAME.currentCity() || s.cities[0];
    if (!city) return { ok: false, msg: '没有可安置的城池' };
    var Rc = GAME.res(city);
    if ((Rc.gold || 0) < plan.cost) {
      return { ok: false, msg: '黄金不足（收编需 ' + U.fmt(plan.cost) + '，现有 ' +
        U.fmt(Rc.gold || 0) + '）' };
    }
    Rc.gold = (Rc.gold || 0) - plan.cost;
    city.army = city.army || {};
    var bits = [];
    Object.keys(plan.byType).forEach(function (tid) {
      var n = plan.byType[tid];
      city.army[tid] = (city.army[tid] || 0) + n;
      bits.push((DATA.TROOPS[tid] ? DATA.TROOPS[tid].name : tid) + '+' + U.fmt(n));
    });
    s.captives = {};
    GAME.log.sys('🪶 ' + city.name + ' 收编俘虏 ' + U.fmt(plan.men) + ' 众入军（' + bits.join('、') +
      '，支金 ' + U.fmt(plan.cost) + '）');
    return { ok: true, msg: '收编 ' + U.fmt(plan.men) + ' 众入军（支金 ' + U.fmt(plan.cost) + '）',
      n: plan.men, cost: plan.cost, byType: plan.byType, city: city.name };
  };""",
  'b-收编三件套'),
 # ③ 战报/提示文案
 ("""        + '　·　军务处·俘虏营可收编为民');""",
  """        + '　·　军务处·俘虏营可收编入军（费金 = 兵种造价的 50%）');""",
  'b-战报文案'),
 ("""        GAME.log.war('🪶 俘获迁民：' + _capt99.city + ' +' + U.fmt(_capt99.gain) + ' 人（溃卒收编）');""",
  """        GAME.log.war('🪶 俘获溃卒：' + _capt99.city + ' +' + U.fmt(_capt99.gain) + ' 人（入俘虏营）');""",
  'b-俘获日志'),
])

assert 'GAME.captivePopOf = function' not in io.open(PB, encoding='utf-8', newline='').read()
assert 'GAME.conscriptPlanOf = function' in io.open(PB, encoding='utf-8', newline='').read()
print('ALL OK')
