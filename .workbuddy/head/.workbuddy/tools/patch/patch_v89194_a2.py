# -*- coding: utf-8 -*-
"""v89.194 批次A2：缺料提示唯一出口 GAME.costLackMsg（金加入成本后的跟进）
纪律：锚点唯一断言 · 幂等（新特征计数判据）· newline='' · 写后自检
"""
import io

R = 'E:/Deepseekdb/'
DOM = R + 'js/domain.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败：mark 未落盘'
    print('[ok] ' + tag)

# ─────────────────────────────────────────────
# A2-1. 新增 GAME.costLackMsg（唯一出口）
# ─────────────────────────────────────────────
OLD1 = "  GAME.payCostIn = function (city, cost) {"
NEW1 = '''  /* ============================================================
   * v89.194（老板 S1 跟进）：**缺料提示的唯一出口**
   * ------------------------------------------------------------
   * 建筑 Lv9 起加入"营造金"后，"本城资源不足"这句会误导 ——
   * 金是**全境通用**的玩家池，不是本城资源；缺的也未必是粮木石铁。
   * 本出口逐项对账（金 / 粮木石铁 / 珠宝），报"缺哪项、现有多少"，
   * 并把口径尾注写清（金全境通用；货品按本城结算 → 跨城走「本境调运」）。
   * 消费点：buildAt / upgradeAt / buildExt / upgradeExt / 募兵（五处同源）。
   * 返回 '' = 其实都够（调用方回落旧文案，防判据漂移）。
   * ============================================================ */
  GAME.costLackMsg = function (city, cost) {
    if (!cost) return '';
    var ct = city || GAME.currentCity();
    var R = GAME.res(ct);
    var s0 = GAME.state || {};
    var lacks = [];
    var goldShort = !!(cost.gold && GAME.goldOf() < cost.gold);
    if (goldShort) lacks.push('金 ' + U.fmt(cost.gold) + '（现 ' + U.fmt(GAME.goldOf()) + '）');
    DATA.RESOURCES.forEach(function (r) {
      if (r.key === 'gold') return;
      if (cost[r.key] && (R[r.key] || 0) < cost[r.key]) {
        lacks.push(r.name + ' ' + U.fmt(cost[r.key]) + '（现 ' + U.fmt(R[r.key] || 0) + '）');
      }
    });
    var need = GAME.jewelNeedOf(cost);
    for (var jid in need) {
      var have = ((s0.items || {})[jid] || 0);
      if (have < need[jid]) {
        var jn = jid;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
        lacks.push('💎' + jn + ' ×' + need[jid] + '（持 ' + have + '）');
      }
    }
    if (!lacks.length) return '';
    var tail = goldShort ? '（金全境通用）' : '（货品按本城结算，跨城需走「本境调运」）';
    return '缺 ' + lacks.slice(0, 4).join('、') + tail;
  };
  GAME.payCostIn = function (city, cost) {'''
rep(DOM, 'A2-1 costLackMsg 出口', OLD1, NEW1, 'GAME.costLackMsg = function (city, cost) {')

# ─────────────────────────────────────────────
# A2-2. 四处同构提示改走唯一出口（buildExt / upgradeExt / buildAt / train）
# ─────────────────────────────────────────────
OLD2 = "if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: '本城资源不足（跨城需走「本境调运」）' };"
NEW2 = """if (!GAME.canAffordIn(city, cost)) return { ok: false, msg: GAME.costLackMsg(city, cost) || '本城资源不足（跨城需走「本境调运」）' };"""
s0 = rd(DOM)
c2 = s0.count(OLD2)
if s0.count('GAME.costLackMsg(city, cost) ||') >= 1:
    print('[skip] A2-2 四处提示（已落盘）')
else:
    assert c2 == 4, 'A2-2 count=' + str(c2)
    s0 = s0.replace(OLD2, NEW2)
    wr(DOM, s0)
    c2b = rd(DOM).count('GAME.costLackMsg(city, cost) ||')
    assert c2b == 4, 'A2-2 写后自检 = ' + str(c2b)
    print('[ok] A2-2 四处提示（count=4）')

# ─────────────────────────────────────────────
# A2-3. upgradeAt 分支（含珠宝 → 统一出口；_jt126 死变量一并退役）
# ─────────────────────────────────────────────
OLD3 = """    if (!GAME.canAffordIn(city, cost)) {
      /* v89.104：高等级升级的拦路虎可能是**珠宝**而不是资源 —— 报清楚缺哪种
         （原在 upgradeWall 里，城墙并入通用路径后迁到此，全建筑受益）。 */
      var _jt126 = (cost.jewel && GAME.costJewelText) ? GAME.costJewelText(cost) : '';
      return { ok: false, msg: cost.jewel ? ('珠宝不足（' + _jt126 + '）') : '本城资源不足（跨城需走「本境调运」）' };
    }"""
NEW3 = """    if (!GAME.canAffordIn(city, cost)) {
      /* v89.104：高等级升级的拦路虎可能是**珠宝**而不是资源 —— 报清楚缺哪种。
         v89.194：珠宝/金/资源的缺料对账统一走 GAME.costLackMsg（唯一出口，
         金加入成本后"本城资源不足"会误导 —— 金是全境通用池）。 */
      return { ok: false, msg: GAME.costLackMsg(city, cost) || '本城资源不足（跨城需走「本境调运」）' };
    }"""
rep(DOM, 'A2-3 upgradeAt 提示收口', OLD3, NEW3, "v89.194：珠宝/金/资源的缺料对账统一走 GAME.costLackMsg")

print('\n批次 A2 全部完成。')
