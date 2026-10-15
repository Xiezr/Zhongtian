# -*- coding: utf-8 -*-
"""v89.198 批次A：data.js 战法表退役 + domain.js 出口退役 + index.html CSS 退役"""

def rd(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

import io

def rep(path, tag, old, new, mark):
    """替换式：mark（新文本独有）已在 → 跳过；否则 old 必须 count==1。"""
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

def cut(path, tag, old, new):
    """缩减排除式：old 不在了 → 视为已落盘跳过；否则 count==1 替换。"""
    s = rd(path)
    c = s.count(old)
    if c == 0:
        print('[skip] ' + tag + '（已缩减/已落盘）')
        return
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

D = 'E:/Deepseekdb/js/data.js'
G = 'E:/Deepseekdb/js/domain.js'
H = 'E:/Deepseekdb/index.html'

# ---------- data.js ----------
rep(D, 'A1 SIEGE 战法系数退役',
"""    retreatChipMul: 0.5,            /* 主动撤退：本波破防按半计 */
    /* 战法系数（v89.94 · E2）：改平衡只动这四个数 */
    encircle: { marchMul: 1.5, garrisonCut: 0.12, chipMul: 1.5 },
    surprise: { schemeMul: 1.5 },
  };""",
"""    retreatChipMul: 0.5,            /* 主动撤退：本波破防按半计 */
    /* ⛔ v89.198（老板「清除战法这个玩法」· 2026-10-05）：战法系数
       （encircle / surprise）随玩法全撤退役 —— 沿革与去向见下方 DATA.OPS 墓碑；
       围攻（chipBase/上下限/恢复/保底）等其余口径不受影响。 */
  };""",
    '（encircle / surprise）随玩法全撤退役')

rep(D, 'A2 DATA.OPS 整表退役（墓碑）',
"""  /* ============================================================
   * v89.94（B2 · E2）：出兵前的**战法三选**（强攻 / 围困 / 奇袭）
   * ------------------------------------------------------------
   * 口径：三者都只作用于**战斗入参**（与计略同一条路），零引擎改动。
   *   · 强攻：无修正（默认，正面决战）；
   *   · 围困：行军 ×1.5（围师必久），守军 −12%（断粮疲敌），破防 ×1.5；
   *   · 奇袭：须先选定一门计略，本战计略效果 ×1.5（依附既有计略出口）。
   * ⚠️ 数值总闸：围困/奇袭的系数都在此表，调平衡只改这里。
   * ============================================================ */
  DATA.OPS = [
    { id: 'assault', name: '强攻', icon: '⚔️', scope: null, require: null,
      desc: '正面决战，无额外修正。战力相当时胜负由临阵决断（阵位 / 目标 / 计略）决定。' },
    { id: 'encircle', name: '围困', icon: '🧱', scope: ['fort', 'city'], require: null,
      desc: '围师必久：行军 ×1.5，守军 −12%（断粮疲敌），破防 +50%。' },
    { id: 'surprise', name: '奇袭', icon: '🗡️', scope: null, require: 'scheme',
      desc: '出敌不意：须先选定一门计略，本战计略效果 ×1.5。' },
  ];""",
"""  /* ============================================================
   * ⛔ v89.198（老板「清除战法这个玩法」· 2026-10-05）：战法三选整条退役。
   * ------------------------------------------------------------
   * 沿革：v89.94（B2 · E2）建 —— 强攻[无修正] / 围困[据点城池限定] 行军×1.5·守军−12%·破防×1.5 /
   *       奇袭[须先选计略] 计略×1.5；v89.197 修可见性（估算计入 / 战报【战法】行 / chips 组件）。
   * 撤销依据：老板拍板「清除战法这个玩法」（v89.198 需求清单第 2 条）。
   * 去向：出征一律按**无修正**结算（= 原强攻口径）；出口（opsIdOf/opsOf/opsConfigIssueOf）、
   *       出行校验、界面 chips、估算分支、战报【战法】行、行军队列「· 围困」后缀、
   *       dispatch 的 ops 参数 —— 五件套连清（详见 docs/v89198）。
   * ============================================================ */""",
    '战法三选整条退役。')

rep(D, 'A3 索引注释去战法',
""" *   ⑦ 入侵与战斗     INVASION / DUEL / AUTO_MARCH / SIEGE / OPS / 战法 / 回放""",
""" *   ⑦ 入侵与战斗     INVASION / DUEL / AUTO_MARCH / SIEGE / 回放""",
    'INVASION / DUEL / AUTO_MARCH / SIEGE / 回放\n')

# ---------- domain.js ----------
rep(G, 'B1 战法出口组退役',
"""  /* ============================================================
   * v89.94（B2 · E2）：战法（强攻/围困/奇袭）—— 唯一出口
   * ------------------------------------------------------------
   * `opsIdOf` 收敛非法值（任何脏输入 → assault）；`opsOf` 给名字/图标/说明；
   * `opsConfigIssueOf` 承载"目标/计略是否满足"的校验（prepare 与界面共用同一判据）。
   * ============================================================ */
  GAME.opsIdOf = function (id) {
    return (id === 'encircle' || id === 'surprise') ? id : 'assault';
  };
  GAME.opsOf = function (id) {
    var list = DATA.OPS || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || { id: 'assault', name: '强攻', icon: '⚔️', desc: '' };
  };
  /* 返回 null = 可用；否则返回"不可用原因"（文案直接给玩家看） */
  GAME.opsConfigIssueOf = function (id, t, schemeId) {
    var o = GAME.opsOf(id);
    if (o.require === 'scheme' && !schemeId) return '奇袭须先选定一门计略';
    if (o.scope && t && o.scope.indexOf(t.kind) < 0) return o.name + '只适用于据点与城池';
    return null;
  };
""",
"""  /* ============================================================
   * ⛔ v89.198（老板「清除战法这个玩法」）：opsIdOf / opsOf / opsConfigIssueOf
   *   三个出口随玩法全撤退役 —— 沿革与去向见 js/data.js 的 DATA.OPS 墓碑。
   * ============================================================ */
""",
    'opsIdOf / opsOf / opsConfigIssueOf\n   *   三个出口随玩法全撤退役')

rep(G, 'B2 siegeChipOf 去 ops 参数',
"""  /* 单波破防（%）：chipBase × 战力比，夹在 [chipMin, chipMax]；围困 ×1.5 */
  GAME.siegeChipOf = function (ratio, ops) {
    var cfg = DATA.SIEGE || {};
    var base = cfg.chipBase == null ? 45 : cfg.chipBase;
    var lo = cfg.chipMin == null ? 8 : cfg.chipMin;
    var hi = cfg.chipMax == null ? 55 : cfg.chipMax;
    var r = Number(ratio);
    if (!isFinite(r) || r <= 0) r = 0;
    var chip = Math.max(lo, Math.min(hi, Math.round(base * r)));
    if (ops === 'encircle') chip = Math.round(chip * (((cfg.encircle) || {}).chipMul == null ? 1.5 : cfg.encircle.chipMul));
    return Math.max(1, Math.min(100, chip));
  };""",
"""  /* 单波破防（%）：chipBase × 战力比，夹在 [chipMin, chipMax]。
     ⛔ v89.198：战法（围困 ×1.5）全撤退役 —— 只剩基准口径（老板「清除战法这个玩法」）。 */
  GAME.siegeChipOf = function (ratio) {
    var cfg = DATA.SIEGE || {};
    var base = cfg.chipBase == null ? 45 : cfg.chipBase;
    var lo = cfg.chipMin == null ? 8 : cfg.chipMin;
    var hi = cfg.chipMax == null ? 55 : cfg.chipMax;
    var r = Number(ratio);
    if (!isFinite(r) || r <= 0) r = 0;
    var chip = Math.max(lo, Math.min(hi, Math.round(base * r)));
    return Math.max(1, Math.min(100, chip));
  };""",
    '战法（围困 ×1.5）全撤退役 —— 只剩基准口径')

# ---------- index.html ----------
rep(H, 'F1 .exp-ops-cell 退役',
"""  .exp-row > .exp-ops-cell { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: var(--sp-1); flex-wrap: wrap; }""",
"""  /* ⛔ v89.198（老板「清除战法这个玩法」）：.exp-ops-cell（战法 chips 单元格）随玩法全撤退役。 */""",
    '（战法 chips 单元格）随玩法全撤退役')

print('批次A 完成')
