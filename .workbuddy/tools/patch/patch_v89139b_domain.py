# -*- coding: utf-8 -*-
"""v89.139 批二：domain.js —— 采集收成关联负重（唯一出口）+ 珠宝按等级门槛/数量产出"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'domain.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ── ① _rawGatherYield：加负重闸 + 新增 gatherLoadOf 出口 ──
rep("""  GAME._rawGatherYield = function (g) {
    var G = DATA.GATHER;
    if (!g) return null;
    var hours = (g.elapsed || 0) / 3600;
    var capped = Math.min(hours, G.maxHours);
    var res = GAME.gatherResOf(g.type);
    var ready = hours >= G.minHours;
    var amount = 0;
    var rawPower = GAME.gatherPowerOf(g);
    var power = Math.min(rawPower, G.powerCap);
    if (ready && res) {
      amount = Math.round(power * (1 + (g.level || 0) * G.levelBonus) * capped);
    }
    return {
      hours: hours, capped: capped, res: res, amount: amount, ready: ready,
      power: power, powerFull: rawPower, powerCap: G.powerCap,
      pct: Math.min(100, Math.floor(capped / G.maxHours * 100)),
      capReached: hours >= G.maxHours,
    };
  };""",
"""  /* 驻军总负重（v89.139 老板 5）——「采集的产出…建议关联驻军的总负重」。
     与 gatherPowerOf 同一形状（驻军开采时**动态读驻军**，不读记录里那份副本）。 */
  GAME.gatherLoadOf = function (g) {
    var army = g && g.army;
    if (g && g.origin === 'garrison') {
      var _gl = GAME.wildGarrisonAt(g.x, g.y);
      army = (_gl && GAME.wildGarrisonTotal(_gl) > 0) ? _gl.troops : null;
    }
    var L = 0;
    for (var id in (army || {})) {
      var t = DATA.TROOPS[id];
      if (t && army[id] > 0) L += army[id] * (t.load || 0);
    }
    return L;
  };
  GAME._rawGatherYield = function (g) {
    var G = DATA.GATHER;
    if (!g) return null;
    var hours = (g.elapsed || 0) / 3600;
    var capped = Math.min(hours, G.maxHours);
    var res = GAME.gatherResOf(g.type);
    var ready = hours >= G.minHours;
    var amount = 0;
    var rawPower = GAME.gatherPowerOf(g);
    var power = Math.min(rawPower, G.powerCap);
    /* v89.139（老板 5）：收成 = min(采力产出, 负重上限)。
       采力（gather）决定"每小时采多少"，负重（load）决定"一次能带回多少" ——
       满载的辎重车/民夫不触顶，纯精锐骑兵会被负重节制（补辎重车即可解锁采力）。 */
    var loadCap = Math.round(GAME.gatherLoadOf(g) * (G.loadMul || 0));
    var loadLimited = false;
    if (ready && res) {
      amount = Math.round(power * (1 + (g.level || 0) * G.levelBonus) * capped);
      if (loadCap > 0 && amount > loadCap) { amount = loadCap; loadLimited = true; }
    }
    return {
      hours: hours, capped: capped, res: res, amount: amount, ready: ready,
      power: power, powerFull: rawPower, powerCap: G.powerCap,
      load: GAME.gatherLoadOf(g), loadCap: loadCap, loadLimited: loadLimited,
      pct: Math.min(100, Math.floor(capped / G.maxHours * 100)),
      capReached: hours >= G.maxHours,
    };
  };""",
    '_rawGatherYield 负重闸')

# ── ② finishGather 珠宝段：等级门槛 + 数量 ──
rep("""    /* v89.135（老板「为啥没有珠宝（比如湖泊里有珍珠）」）：**按地形出珠宝** ——
       与"宝物"（只受将领等级影响的小概率小件）独立的一路，任何采集都掉。 */
    var jewelGot = null;
    (function () {
      var jt = (G.jewelTable || {})[g.type];
      if (!jt || !jt.length) return;
      var ch = Math.min(0.85, (G.jewelChance || 0) + (g.level || 0) * (G.jewelPerLv || 0));
      if (Math.random() >= ch) return;
      var jid = (jt.length > 1 && Math.random() < (G.jewelRareP || 0)) ? jt[1] : jt[0];
      s.items = s.items || {};
      s.items[jid] = (s.items[jid] || 0) + 1;
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      jewelGot = jn;
    })();""",
"""    /* v89.135（老板「为啥没有珠宝（比如湖泊里有珍珠）」）：**按地形出珠宝** ——
       与"宝物"（只受将领等级影响的小概率小件）独立的一路，任何采集都掉。
       v89.139（老板 4）：「爵位晋升需要的珠宝…由采集产出」——两条补强：
         ① 候选取"地形表两档"里**等级够**的（jewelMinLv 门槛，高档要 Lv6+ 野地）；
         ② 命中数量 = 1 + ⌊野地等级 × jewelCountPerLv⌋（爵位后期单次要几十颗）。 */
    var jewelGot = null;
    (function () {
      var jt = (G.jewelTable || {})[g.type] || [];
      if (!jt.length) return;
      var jlv = g.level || 0;
      var avail = jt.filter(function (jid) {
        return jlv >= (((G.jewelMinLv || {})[jid]) || 1);
      });
      if (!avail.length) return;         /* 等级不够：本档全被门槛挡住 */
      var ch = Math.min(0.85, (G.jewelChance || 0) + jlv * (G.jewelPerLv || 0));
      if (Math.random() >= ch) return;
      var jid = (avail.length > 1 && Math.random() < (G.jewelRareP || 0))
        ? avail[avail.length - 1] : avail[0];
      var jcnt = 1 + Math.floor(jlv * (G.jewelCountPerLv || 0));
      s.items = s.items || {};
      s.items[jid] = (s.items[jid] || 0) + jcnt;
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      jewelGot = jn + '×' + jcnt;
    })();""",
    'finishGather 珠宝')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'GAME.gatherLoadOf = function' in chk and 'loadLimited' in chk, '落盘校验失败'
assert 'jewelCountPerLv' in chk, '落盘校验失败2'
print('✅ domain.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
