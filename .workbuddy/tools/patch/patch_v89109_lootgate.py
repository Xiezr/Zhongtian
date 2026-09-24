# -*- coding: utf-8 -*-
"""v89.109：battle.js —— lootGateOf（掠夺前置闸·唯一出口）+ raid 落账接线"""
import io, os, shutil
p = r'E:/Deepseekdb/js/battle.js'
BK = r'E:/Deepseekdb/.workbuddy/backup'
shutil.copy2(p, os.path.join(BK, 'battle.v89108.js'))
s = io.open(p, encoding='utf-8').read()

# ① lootGateOf 本体（挂在 genLoot 之后）
a1 = '''  /* 打造材料掉落：表 = { matId: [min, max] }，mult 为数量倍率 */'''
b1 = '''  /* ============================================================
   * v89.109（老板「只有打破城墙并杀死出城迎战的军队，才能进行资源掠夺」）
   * —— **掠夺前置闸，唯一出口**（我方掠夺 NPC 与敌方来掠夺我方，共用这一个判据）
   * ------------------------------------------------------------
   * 判定（看一场战斗的 result）：
   *   ① **破防**：城防工事（箭塔 = 城墙的具象）被拆光，**或**守军被全歼 ——
   *      两者达成其一即算"这座城已经失去抵抗"（无工事的目标视为无墙可破，恒过）；
   *   ② **出城迎战部队被歼灭**：守方若把某些兵种设为出城迎战（sortie），
   *      它们在野战军全部阵亡前挡住攻方（tactic 里连拆墙都被拦），
   *      所以"杀光他们"是破城的一部分；没有出城部队时恒过。
   * ⚠️ 只闸**掠夺资源**（战利品）—— 兵损、经验、材料/军械掉落照旧：
   *    打仗本身的代价与收益不受影响，缺的只是"搬走库藏"这一步。
   * ============================================================ */
  GAME.battle.lootGateOf = function (r, t) {
    if (!r) return { ok: true, msg: '' };
    if (r.engine !== 'tactic') return { ok: true, msg: '' };   /* 骰子引擎（旧口径回退）不受闸 */
    var wallOk = !(r.towerStart > 0) || (r.towerLeft <= 0) || (r.defRemain <= 0);
    var sortieOk = !(r.defSortieStart > 0) || (r.defSortieLeft <= 0);
    if (wallOk && sortieOk) return { ok: true, msg: '' };
    var why = [];
    if (!wallOk) {
      why.push('城墙未破（城防工事余 ' + r.towerLeft + '/' + r.towerStart + '，守军余 '
        + U.numText(r.defRemain, 0) + '）');
    }
    if (!sortieOk) {
      why.push('出城迎战的守军尚未歼灭（余 ' + U.numText(r.defSortieLeft, 0) + '）');
    }
    return { ok: false, msg: '掠夺无功而返：' + why.join('、')
      + ' —— 破墙（打箭塔）或全歼守军后，再来劫掠' };
  };

  /* 打造材料掉落：表 = { matId: [min, max] }，mult 为数量倍率 */'''
assert a1 in s, '①未命中'
s = s.replace(a1, b1, 1)

# ② raid 落账 gate：进入发资源分支前先过闸
a2 = """      if (resMul > 0) {
        /* 抢掠技巧：掠夺资源收获 +3%/级 —— 只对「掠夺」生效（占领本就不取财货） */"""
b2 = """      /* v89.109：掠夺资源**先过城防闸**（唯一出口 lootGateOf）——
         未破墙 / 未歼野战军 → 这一趟抢不到东西（战斗照打照记，兵损经验材料不受影响）。 */
      var _lg109 = (resMul > 0) ? GAME.battle.lootGateOf(result, t) : { ok: true, msg: '' };
      if (resMul > 0 && !_lg109.ok) {
        result.lootGate = _lg109;
        GAME.log.war('🧱 ' + _lg109.msg);
      }
      if (resMul > 0 && _lg109.ok) {
        /* 抢掠技巧：掠夺资源收获 +3%/级 —— 只对「掠夺」生效（占领本就不取财货） */"""
assert a2 in s, '②未命中'
s = s.replace(a2, b2, 1)

a3 = """      } else {
        gains.res = null;
        GAME.log.war('占领不取财货 —— 掠夺得资源，占领得地盘（回报在此地长久的产量加成与采集权）');
      }"""
b3 = """      } else if (resMul <= 0) {
        gains.res = null;
        GAME.log.war('占领不取财货 —— 掠夺得资源，占领得地盘（回报在此地长久的产量加成与采集权）');
      }"""
assert a3 in s, '③未命中'
s = s.replace(a3, b3, 1)

io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(p + '.tmp', p)
print('battle.js：lootGateOf + raid 接线完成')
