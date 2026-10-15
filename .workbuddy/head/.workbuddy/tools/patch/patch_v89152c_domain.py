# -*- coding: utf-8 -*-
# v89.152c：domain.js —— 新增 GAME.migrateJewels152（老档珠宝换算，幂等）+ 更新 collect 注释
import io

P = 'E:/Deepseekdb/js/domain.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

MIG = u"""  /* ============================================================
   * v89.152：珠宝体系重设 —— **老档库存等值换算**（唯一出口 · 幂等）
   * ------------------------------------------------------------
   * 老板：「目前的珠宝体系更换掉（实际上就是换掉名字）」—— 旧 15 种珠宝整批退役，
   * 新体系 18 种（见 data.js 珠宝段）。老档 s.items 里的旧 id 按 `DATA.JEWEL_MIG152`
   * （price 一一对应的**等值**换算表）搬到新 id —— 玩家资产零损耗。
   * 算法：**先把旧键全部摘下（读出 + 删除），再统一写入目标键** ——
   *   新旧 id 有同名者（旧夜明珠 48 -> 蛋白石；新夜明珠 150 是另一颗），
   *   摘与写分两步就天然安全（不会自我叠加）。
   * 幂等：处理完置 `s.jewelMig152 = 1`（入档）；重复调用零成本。
   * 调用：loadGame 之后 + tickOnce 兜底（与 migrateLegacyGathers 同款双保险）。
   * ============================================================ */
  GAME.migrateJewels152 = function () {
    var s = GAME.state;
    if (!s || s.jewelMig152) return 0;
    var map = DATA.JEWEL_MIG152 || {};
    var carried = {}, n = 0;
    s.items = s.items || {};
    Object.keys(map).forEach(function (oldId) {
      var v = Math.floor(s.items[oldId] || 0);
      if (!v) return;
      delete s.items[oldId];
      var to = map[oldId];
      carried[to] = (carried[to] || 0) + v;
      n += v;
    });
    Object.keys(carried).forEach(function (to) { s.items[to] = (s.items[to] || 0) + carried[to]; });
    s.jewelMig152 = 1;
    if (n > 0) GAME.log('💎 老档珠宝换算：' + n + ' 颗旧珠宝已按等值换成新体系珠宝');
    return n;
  };
"""

ANCHOR = u"""  /* ============================================================
   * v89.136（老板报「驻军丢失」）—— **老档采集队迁移**（唯一出口）"""

if u'GAME.migrateJewels152 = function' not in s:
    assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))
    s = s.replace(ANCHOR, MIG + ANCHOR)
    print('inserted migrateJewels152')
else:
    print('skip (already)')

# 更新 gatherJewelPick 头注释（口径不变，标注数据表已重设）
OLD_C = u"""  /* 珠宝挑选（**唯一出口**，v89.139 老板 4）——地形表三档（常见/少见/稀有）里"""
NEW_C = u"""  /* 珠宝挑选（**唯一出口**，v89.139 老板 4；v89.152 体系重设后口径不变、数据换新）——
     地形表三档（常见/少见/稀有）里"""
if u'v89.152 体系重设后口径不变' not in s:
    assert s.count(OLD_C) == 1
    s = s.replace(OLD_C, NEW_C)
    print('comment updated')
else:
    print('comment skip (already)')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'GAME.migrateJewels152 = function') == 1
print('OK len %d -> %d' % (orig, len(chk)))
