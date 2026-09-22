# -*- coding: utf-8 -*-
"""v89.100-C：推演脑 econ / loot 两模式（对 play_rush_1x.js 的增量，幂等）"""
import io, subprocess

BASE = 'E:/Deepseekdb/'
P = BASE + '.workbuddy/tools/playtest/play_rush_1x.js'
s = io.open(P, encoding='utf-8').read()
N = [0]

def rep(old, new, tag):
    global s
    if new in s:
        print('SKIP ' + tag)
        return
    assert old in s, 'MISS: ' + tag
    s = s.replace(old, new, 1)
    N[0] += 1
    print('OK   ' + tag)

# ---------- C1. MODE 注释 ----------
rep("""var MODE = ARGV[2] || 'rush';   /* gold | buff | equip | all | rush（v89.98 新增：全系统极限流） */""",
"""var MODE = ARGV[2] || 'rush';   /* gold | buff | equip | all | rush | econ（v89.100：纯经济，军事全停）
                                    | loot（v89.100：rush 全行为 + 战利品寄售变现 75%） */""",
'C1 MODE 注释')

# ---------- C2. 主循环：军事包裹 ----------
rep("""    safeCall('b.wall', tryWall);
    safeCall('b.train', tryTrain);
    safeCall('b.gather', tryGather);
    safeCall('b.gatherFin', finishRipeGathers);
    safeCall('b.occupy', keepOccupying);
    safeCall('b.withdraw', tryWithdraw);
    safeCall('b.reinforce', tryReinforce);
    safeCall('b.market', tryMarketSell);""",
"""    /* v89.100：econ（纯经济）——军事调用全跳过（城墙/征兵/采集/占领/撤援），
       只留"建设 + 市场 + 商城"这条线；其余模式照旧。 */
    if (MODE !== 'econ') {
      safeCall('b.wall', tryWall);
      safeCall('b.train', tryTrain);
      safeCall('b.gather', tryGather);
      safeCall('b.gatherFin', finishRipeGathers);
      safeCall('b.occupy', keepOccupying);
      safeCall('b.withdraw', tryWithdraw);
      safeCall('b.reinforce', tryReinforce);
    }
    safeCall('b.market', tryMarketSell);
    if (MODE === 'loot') safeCall('b.consign', consignBrain);   /* v89.100：战利品寄售变现 */""",
'C2 军事包裹 + consign')

rep("""    safeCall('b.bank', bankPop);          /* v89.99：人口银行（贴顶的增长存成义兵） */""",
"""    if (MODE !== 'econ') safeCall('b.bank', bankPop);   /* v89.100：econ 不存兵（银行=征兵的一种） */""",
'C2b bank 跳过')

rep("""    safeCall('b.autoMarch', manageAutoMarch);""",
"""    if (MODE !== 'econ') safeCall('b.autoMarch', manageAutoMarch);   /* v89.100：econ 无军事 */""",
'C2c autoMarch 跳过')

rep("""    if (MODE === 'buff' || MODE === 'all' || MODE === 'rush') {""",
"""    if (MODE === 'buff' || MODE === 'all' || MODE === 'rush' || MODE === 'econ') {   /* v89.100：econ 也要产量宝物（经济投资） */""",
'C2d buff 条件加 econ')

rep("""    safeCall('b.goldRush', goldRush);
    safeCall('b.goldTrainRush', goldTrainRush);""",
"""    if (MODE !== 'econ') {
      safeCall('b.goldRush', goldRush);
      safeCall('b.goldTrainRush', goldTrainRush);
    }""",
'C2e 金加速征兵跳过')

rep("""    /* v89.98：RUSH 五链（围攻 / 爵位 / 节钺 / 通商券 / 丹药） */
    safeCall('b.siege', siegeBrain);
    safeCall('b.promote', promoteBrain);
    safeCall('b.jieyue', jieyueBrain);
    safeCall('b.coupon', couponBrain);
    safeCall('b.perm', permBrain);""",
"""    /* v89.98：RUSH 五链（围攻 / 爵位 / 节钺 / 通商券 / 丹药）
       v89.100：econ 跳过围攻与节钺（军事），保留晋爵/通商券/丹药（经济养成）。 */
    if (MODE !== 'econ') {
      safeCall('b.siege', siegeBrain);
      safeCall('b.jieyue', jieyueBrain);
    }
    safeCall('b.promote', promoteBrain);
    safeCall('b.coupon', couponBrain);
    safeCall('b.perm', permBrain);""",
'C2f 五链分流')

# ---------- C3. 建造表：econ 排除军事建筑 ----------
rep("""function tryBuildNew() {
  st.cities.forEach(function (city) {
    var slots = G.buildSlots(city);
    for (var i = 0; i < BUILD_PRIO.length; i++) {
      var it = BUILD_PRIO[i];""",
"""function tryBuildNew() {
  /* v89.100：econ 排除军事建筑（兵营 / 烽火台）—— 不发展军事，连建造都不碰 */
  var _prio = BUILD_PRIO;
  if (MODE === 'econ') _prio = BUILD_PRIO.filter(function (x) { return x.bid !== 'junying' && x.bid !== 'fenghuotai'; });
  st.cities.forEach(function (city) {
    var slots = G.buildSlots(city);
    for (var i = 0; i < _prio.length; i++) {
      var it = _prio[i];""",
'C3 建造表过滤')

# ---------- C4. 卖资源：econ 阈值抬到 25 万 ----------
rep("""  var gold = st.res.gold || 0;
  if (gold > 150000) return;                 /* 金够用就不卖 */""",
"""  var gold = st.res.gold || 0;
  /* v89.100：econ 金主要花在经验书（大宗 40 万/本）→ 卖出阈值抬到 25 万；其余模式照旧 */
  if (gold > (MODE === 'econ' ? 250000 : 150000)) return;""",
'C4 卖资源阈值')

# ---------- C5. reserveNow：econ 低保留线 ----------
rep("""function reserveNow() {
  var must = 20000;
  if (st.cities.length < 3) must = 40000;      /* 筑城金 1 万 + 珠宝/启动 + 缓冲 */
  else if (maxGenLv() < 140) must = 30000;""",
"""function reserveNow() {
  var must = 20000;
  if (st.cities.length < 3) must = 40000;      /* 筑城金 1 万 + 珠宝/启动 + 缓冲 */
  else if (maxGenLv() < 140) must = 30000;
  /* v89.100：econ 保留线压低 —— 金的最大去处是经验书（买书预算 = 金 - 保留线） */
  if (MODE === 'econ') must = 12000;""",
'C5 econ 保留线')

# ---------- C6. consignBrain 函数（插在 permBrain 前） ----------
rep("""function permBrain() {""",
"""/* ---------- 战利品寄售（v89.100 · 老板「以购买价 75% 出售」） ----------
   语义：把背包里可售道具（珠宝/材料/种子/图纸/宝箱…）按 75% 变金。
   保留：晋爵缺口珠宝（买了再卖白亏 25%）。出口：systems.consignAll。 */
var CSG_LAST = -1e9;
var CSG = { gold: 0, kinds: 0, pieces: 0, runs: 0, tFirst: 0 };
function consignBrain() {
  if (tNow - CSG_LAST < 120) return;
  CSG_LAST = tNow;
  if (!G.systems.consignAll) return;
  var keep = [];
  try {
    var nr = G.systems.nextRank();
    if (nr && nr.jewel) {
      for (var jid in nr.jewel) {
        if ((nr.jewel[jid] || 0) - (st.items[jid] || 0) > 0) keep.push(jid);
      }
    }
  } catch (e) {}
  var rich = richCity(); setCity(rich);
  var r = safeCall('loot.consign', function () { return G.systems.consignAll({ keep: keep }); });
  if (r && r.ok) {
    if (!CSG.tFirst) CSG.tFirst = tNow;
    CSG.gold += r.gold; CSG.kinds += r.n; CSG.pieces += r.cnt; CSG.runs++;
    noteSoft('loot.consign', r.msg);
  }
}

function permBrain() {""",
'C6 consignBrain')

# ---------- C7. 输出：rush_final 加 consign ----------
rep("""      bank: { join: BANK.joined, release: BANK.released, peak: BANK.peak } },""",
"""      bank: { join: BANK.joined, release: BANK.released, peak: BANK.peak },
      consign: (MODE === 'loot') ? { gold: Math.round(CSG.gold), kinds: CSG.kinds,
        pieces: CSG.pieces, runs: CSG.runs, tFirst: CSG.tFirst } : null },""",
'C7 输出字段')

# ---------- C8. 启动日志 ----------
rep("""RUN('主循环启动：每 tick = 1 现实秒 × ' + TS + ' 倍率；快照 1/4 游戏年；脑决策 40t(前10min)→120t（现实秒语义）');""",
"""RUN('主循环启动：每 tick = 1 现实秒 × ' + TS + ' 倍率；快照 1/4 游戏年；脑决策 40t(前10min)→120t（现实秒语义）');
if (MODE === 'econ') RUN('🧪 ECON 模式：军事全停（征兵/采集/占领/出征/围攻/城墙/装备/存兵全跳过）——只看资源积累 + 商场经验道具');
if (MODE === 'loot') RUN('🧪 LOOT 模式：rush 全行为 + 战利品寄售（按购买价 75% 变现；保留晋爵缺口珠宝）');""",
'C8 启动日志')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('--- total %d ---' % N[0])

r = subprocess.run(['node', '--check', P], capture_output=True)
print('check: ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:400]))
