# -*- coding: utf-8 -*-
"""v89.139 批十一：珠宝三档重排（每地形 Lv1 都有产出 + 高档仍需高等级野地）+ 挑选唯一出口"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs, checks):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for old, new, tag in pairs:
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' CRLF'
    assert s.count('{') == s.count('}'), rel + ' 花括号不配平'
    tmp = p + '.tmp139'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    for c in checks:
        assert c in chk, rel + ' 落盘校验失败：' + c[:50]
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))


# ══════ data.js ══════
patch('js/data.js', [
    ("""    jewelTable: {
      lake:    ['zhenzhu', 'shanhu'],     /* 水产之珍：珍珠 · 珊瑚 */
      caoyuan: ['hupo', 'manao'],         /* 草原化石：琥珀 · 玛瑙 */
      zhaoze:  ['hupo', 'liuli'],         /* 沼泽沉淀：琥珀 · 琉璃 */
      forest:  ['liuli', 'feicui'],       /* 林下矿脉：琉璃 · 翡翠 */
      desert:  ['shuijing', 'liuli'],     /* 戈壁结晶：水晶 · 琉璃 */
      hill:    ['yushi', 'yemingzhu'],    /* 山石之髓：玉石 · 夜明珠（补上唯一缺口） */
    },
    /* 最低野地等级门槛（按珠宝 id；缺省 = 1）——高档珠宝只在高级野地出现 */
    jewelMinLv: {
      zhenzhu: 1, shanhu: 1, liuli: 1,
      hupo: 3, manao: 3, shuijing: 5,
      feicui: 6, yushi: 6, yemingzhu: 6,
    },
    jewelChance: 0.18,        /* 基础掉率（每队每轮收获掷一次） */
    jewelPerLv: 0.02,         /* 野地每级 +2%（Lv10 → 38%） */
    jewelRareP: 0.35,         /* 命中后取"稀有档"的概率 */""",
     """    /* 地形表 = **三档**（常见 / 少见 / 稀有），每档一颗 ——
       每地形的第一档都必须是"低门槛珠宝"，于是**任意等级**的该地形都有产出；
       越高档越靠后，且吃更高等级门槛（见 jewelMinLv）。 */
    jewelTable: {
      lake:    ['zhenzhu', 'shanhu', 'liuli'],      /* 水产之珍：珍珠 / 珊瑚 / 湖底琉璃砂 */
      caoyuan: ['hupo', 'manao', 'shuijing'],       /* 草原化石：琥珀 / 玛瑙 / 结晶水晶 */
      zhaoze:  ['hupo', 'liuli', 'feicui'],         /* 沼泽沉淀：琥珀 / 琉璃 / 翡翠 */
      forest:  ['liuli', 'feicui', 'yushi'],        /* 林下矿脉：琉璃 / 翡翠 / 玉石 */
      desert:  ['liuli', 'shuijing', 'yemingzhu'],  /* 戈壁结晶：琉璃 / 水晶 / 夜明珠 */
      hill:    ['liuli', 'yushi', 'yemingzhu'],     /* 山石之髓：火山琉璃 / 玉石 / 夜明珠 */
    },
    /* 最低野地等级门槛（按珠宝 id；缺省 = 1）——
       爵位节奏对齐：13~25 级要的珍珠/珊瑚/琉璃/琥珀 → 任意野地；
       29~37 级要的玛瑙/水晶/翡翠 → Lv3~5 野地；41 级+ 的玉石/夜明珠 → Lv5~8 野地。 */
    jewelMinLv: {
      zhenzhu: 1, shanhu: 1, liuli: 1, hupo: 1,
      manao: 3, shuijing: 3,
      feicui: 5, yushi: 5,
      yemingzhu: 8,
    },
    jewelChance: 0.18,        /* 基础掉率（每队每轮收获掷一次） */
    jewelPerLv: 0.02,         /* 野地每级 +2%（Lv10 → 38%） */
    jewelRareP: 0.12,         /* 命中后取"稀有档"（三档制的最后一颗）的概率 */
    jewelMidP: 0.25,          /* 命中后取"少见档"（三档制的中间一颗）的概率 */""",
     'jewelTable 三档'),
], ['jewelMidP', "'liuli', 'yushi', 'yemingzhu'"])

# ══════ domain.js：抽取挑选出口 + finishGather 调用 ══════
patch('js/domain.js', [
    ("""    /* v89.135（老板「为啥没有珠宝（比如湖泊里有珍珠）」）：**按地形出珠宝** ——
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
     """    /* v89.135（老板「为啥没有珠宝（比如湖泊里有珍珠）」）：**按地形出珠宝** ——
       与"宝物"（只受将领等级影响的小概率小件）独立的一路，任何采集都掉。
       v89.139（老板 4）：「爵位晋升需要的珠宝…由采集产出」——
       挑选与数量全部走唯一出口 `GAME.gatherJewelPick`（见上方定义）。 */
    var jewelGot = null;
    if (Math.random() < Math.min(0.85, (G.jewelChance || 0) + (g.level || 0) * (G.jewelPerLv || 0))) {
      var _jp = GAME.gatherJewelPick(g.type, g.level || 0);
      if (_jp) {
        s.items = s.items || {};
        s.items[_jp.id] = (s.items[_jp.id] || 0) + _jp.n;
        var jn = _jp.id;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === _jp.id) jn = x.name; });
        jewelGot = jn + '×' + _jp.n;
      }
    }""",
     'finishGather 用出口'),
    ("""  /* 宝物概率（**将领等级只影响此项**，不影响资源收成 —— 原版规则） */""",
     """  /* 珠宝挑选（**唯一出口**，v89.139 老板 4）——地形表三档（常见/少见/稀有）里
     取"等级够"的候选（jewelMinLv 门槛），按 jewelRareP/jewelMidP 决定档位；
     数量 = 1 + ⌊野地等级 × jewelCountPerLv⌋（爵位后期单次要几十颗）。
     返回 { id, n } 或 null（该地形无珠宝 / 等级全不够）。
     `rnd` 可注入（测试用；缺省 Math.random）。 */
  GAME.gatherJewelPick = function (terrain, lv, rnd) {
    var G = DATA.GATHER;
    var jt = (G.jewelTable || {})[terrain] || [];
    if (!jt.length) return null;
    var avail = jt.filter(function (jid) {
      return (lv || 0) >= (((G.jewelMinLv || {})[jid]) || 1);
    });
    if (!avail.length) return null;
    var r = (rnd || Math.random)();
    var rp = G.jewelRareP || 0, mp = G.jewelMidP || 0;
    var idx = 0;
    if (avail.length >= 3) idx = (r < rp) ? 2 : ((r < rp + mp) ? 1 : 0);
    else if (avail.length === 2) idx = (r < rp) ? 1 : 0;
    return { id: avail[idx], n: 1 + Math.floor((lv || 0) * (G.jewelCountPerLv || 0)) };
  };
  /* 宝物概率（**将领等级只影响此项**，不影响资源收成 —— 原版规则） */""",
     'gatherJewelPick 出口'),
], ['GAME.gatherJewelPick = function', 'jewelMidP'])
print('✅ 完成：' + ' / '.join(ok))
