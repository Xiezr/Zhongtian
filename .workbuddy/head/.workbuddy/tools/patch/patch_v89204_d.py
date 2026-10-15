# -*- coding: utf-8 -*-
"""v89.204 批次 D：battle.js —— 围攻段改制（仅胜扣 20 / 文案民心）
  D1 围攻段整段重写（切片法）：仅"本战获胜"推进；战败/撤退不折损；动态 ratio 计算退役
  D2 未果 log 两处（fort/city）：城垣未破（守备余 -> 民心未尽（余
  D3 战报【撤退】【围攻】行
  D4 返回 msg（围攻得势/受挫）
  D5 scNote（围攻已成 · 守备仅余 -> 民心仅余）+ 注释里的"守备值"
"""
import io

P = 'E:/Deepseekdb/js/battle.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def cut(tag, start, end, new, mark):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    i = s.find(start)
    assert i >= 0, tag + ' start not found'
    j = s.find(end, i)
    assert j >= 0, tag + ' end not found'
    j += len(end)
    wr(P, s[:i] + new + s[j:])
    print('[ok] ' + tag)

def rep(tag, old, new, mark, cnt=1):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(P, s.replace(old, new))
    print('[ok] ' + tag)

# ── D1 围攻段整段（切片法：从注释头到 log 尾）──
cut('D1 围攻段',
    "    /* ============================================================\n     * v89.94（B2 · E1）：围攻破防 —— **占领**打据点/县城时，每战都推进守备值",
    "+ (siegeOut.broke ? ' —— 城垣已破，再胜一阵即可拔城' : ''));\n    }",
    """    /* ============================================================
     * v89.204（老板 1）：围攻 —— **占领以民心为基础**（旧"守备值"口径改制）
     * ------------------------------------------------------------
     * · **战斗成功，败方失去 20 点民心**（固定 · DATA.SIEGE.heartsLoss）——
     *   仅"本战获胜"推进；战败 / 主动撤退**不折损民心**（旧"不论胜负都破防"退役）；
     * · 民心归零 + 本战获胜 = 拔城；否则"守军退守内城"，整军再来；
     * · 民心越低守军/城防越弱（siegeScaleAt 不变 —— 民心涣散，抵抗自弱）。
     * ============================================================ */
    var siegeOut = null;
    if (mode.occupy && GAME.siegeScopeOf(t)) {
      if (win && !result.retreat) {
        siegeOut = GAME.siegeChipApply(t, GAME.siegeChipOf());
        result.siege = { chip: siegeOut.chip, hold: siegeOut.hold, waves: siegeOut.waves,
          broke: siegeOut.broke, retreat: false };
        GAME.log.war('\u2694\ufe0f 得胜：' + t.name + ' 民心 −' + siegeOut.chip + ' → 余 '
          + Math.round(siegeOut.hold) + '%（第 ' + siegeOut.waves + ' 波）'
          + (siegeOut.broke ? ' —— 民心已尽，城垣垂危' : ''));
      } else {
        /* 战败 / 主动撤退：民心未动（给一句交代，但不折损 —— "得胜方可夺其民心"） */
        var _st204 = GAME.siegeStateOf(t);
        if (_st204 && !_st204.fresh) {
          GAME.log.war((result.retreat ? '\U0001f3f3\ufe0f 主动撤退' : '\u2694\ufe0f 受挫') + '：' + t.name
            + ' 民心未动（余 ' + Math.round(_st204.hold) + '%）—— 得胜方可夺其民心');
        }
      }
    }""",
    '民心 −\' + siegeOut.chip')

# ── D2 未果 log 两处 ──
rep('D2 未果 log',
    """            GAME.log.war('\U0001f3ef ' + t.name + ' 城垣未破（守备余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝围攻，多波次磨）');""",
    """            GAME.log.war('\U0001f3ef ' + t.name + ' 民心未尽（余 ' + Math.round(siegeOut.hold)
              + '%）：守军退守内城，可整军再攻（占领＝夺其民心 · 胜者每战 −20）');""",
    '民心未尽（余 ', cnt=2)

# ── D3 战报【撤退】【围攻】行 ──
rep('D3 战报行',
    """        + (result.retreat ? '<br>【撤退】主动撤退：残部带回，本波破防按半计（围攻进度保留）。' : '')
        + (result.siege ? '<br>【围攻】' + (result.siege.retreat ? '撤退收兵 · ' : '')
          + '破防 ' + result.siege.chip + '% → 守备余 ' + Math.round(result.siege.hold) + '%（第 '
          + result.siege.waves + ' 波' + (result.siege.broke ? ' · 城垣已破' : ' · 守军退守内城') + '）' : '')""",
    """        + (result.retreat ? '<br>【撤退】主动撤退：残部带回，民心未动（围攻进度保留）。' : '')
        + (result.siege ? '<br>【围攻】民心 −' + result.siege.chip + ' → 余 '
          + Math.round(result.siege.hold) + '%（第 '
          + result.siege.waves + ' 波' + (result.siege.broke ? ' · 民心已尽，城垣垂危' : ' · 守军退守内城') + '）' : '')""",
    '【围攻】民心 −')

# ── D4 返回 msg ──
rep('D4 返回 msg',
    """        ? ((siegeOut && !siegeOut.broke)
          ? '围攻得势：' + t.name + ' 守备余 ' + Math.round(siegeOut.hold) + '%（未下城）'
          : mode.name + '成功：' + t.name)
        : ((siegeOut && siegeOut.chip)
          ? '围攻受挫：' + t.name + ' 守备余 ' + Math.round(siegeOut.hold) + '%（战果已入账）'
          : mode.name + '失败：' + t.name)),""",
    """        ? ((siegeOut && !siegeOut.broke)
          ? '围攻得势：' + t.name + ' 民心余 ' + Math.round(siegeOut.hold) + '%（未下城）'
          : mode.name + '成功：' + t.name)
        : (mode.name + '失败：' + t.name)),""",
    '民心余 \' + Math.round(siegeOut.hold)')

# ── D5 scNote + 注释 ──
rep('D5a scNote',
    """          scNote = (scNote ? scNote + '；' : '') + '围攻已成 · 守备仅余 ' + Math.round(_sgS.hold)""",
    """          scNote = (scNote ? scNote + '；' : '') + '围攻已成 · 民心仅余 ' + Math.round(_sgS.hold)""",
    '围攻已成 · 民心仅余')

rep('D5b 注释',
    """     *   随玩法全撤退役；本段只剩**围攻**（据点/县城）：守军与城防按**当前守备值**缩放 ——
     *   破防越多越好打。""",
    """     *   随玩法全撤退役；本段只剩**围攻**（据点/城池）：守军与城防按**当前民心**缩放 ——
     *   民心越失、抵抗越弱（v89.204：民心口径 · 全部城池纳入）。""",
    '民心越失、抵抗越弱')

print('patch D done')
