# -*- coding: utf-8 -*-
"""v89.204 批次 E：state.js —— 守城结算接线
  E1 invasionResolve：我方战败 → 战争创伤 +20；民心归零 + 城破 → 失城（cityFallen）
  E2 invasionReport：战报加【民心】/【城陷】行 + 城陷标题
  E3 invasionIntelTextOf：民心警示（独立于情报等级）
"""
import io

P = 'E:/Deepseekdb/js/state.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, old, new, mark, cnt=1):
    s = rd(P)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(P, s.replace(old, new))
    print('[ok] ' + tag)

# ── E1 战争创伤 + 失城（插在 repDrop 之后、沙盘配方注释之前）──
E1_OLD = """    var repDrop = Math.round(severity * (L.repDrop || 0));
    if (repDrop > 0) { GAME.state.rep = Math.max(0, (GAME.state.rep || 0) - repDrop); out.repDrop = repDrop; }

    /* ---- v89.116（老板「守城的战报沙盘应当通用掠夺战斗的沙盘」）----"""
E1_NEW = """    var repDrop = Math.round(severity * (L.repDrop || 0));
    if (repDrop > 0) { GAME.state.rep = Math.max(0, (GAME.state.rep || 0) - repDrop); out.repDrop = repDrop; }

    /* ---- v89.204（老板 1）：**败方失去 20 点民心**（我方战败 → 本城战争创伤 +20）----
       民心归零 + 敌军得手（城破）→ 城池被敌方占领（主城 / 缺省首城 / 最后一座城由
       GAME.cityFallen 双闸保护 —— 老板原话：「除主城不可被占领外」）。
       开关：DATA.INVASION.loseCity（v89.204 起 true）。 */
    if (!held && GAME.heartsWarAdd && (DATA.INVASION || {}).loseCity !== false) {
      var _loss204 = ((DATA.SIEGE || {}).heartsLoss != null) ? DATA.SIEGE.heartsLoss : 20;
      GAME.heartsWarAdd(city, _loss204);
      out.heartsLoss = _loss204;
      out.cityHearts = GAME.cityHeartsOf ? GAME.cityHeartsOf(city)
        : (GAME.heartsOf ? GAME.heartsOf() : 100);
      if (out.cityHearts <= 0 && lootOk && GAME.cityFallen) {
        var _fall204 = GAME.cityFallen(city, srcName);
        if (_fall204 && _fall204.ok) out.cityFallen = _fall204;
      }
    }

    /* ---- v89.116（老板「守城的战报沙盘应当通用掠夺战斗的沙盘」）----"""
rep('E1 战争创伤+失城', E1_OLD, E1_NEW, 'GAME.heartsWarAdd(city, _loss204);')

# ── E2 战报行 + 标题 ──
E2A_OLD = """    if (out.wallDrop) lines.push('城墙 −' + out.wallDrop + ' 级');"""
E2A_NEW = """    /* v89.204（老板 1）：民心行 —— 战败失 20 民心；民心尽时城陷 */
    if (out.cityFallen && out.cityFallen.ok) {
      lines.push('【城陷】' + city.name + ' 民心尽失，为 ' + U.escape(src) + ' 所据！残部退守 '
        + U.escape((out.cityFallen.receiver && out.cityFallen.receiver.name) || '余城')
        + '（城池易主，整军可复）');
    } else if (out.heartsLoss) {
      lines.push('【民心】民心 −' + out.heartsLoss + '（余 ' + Math.round(out.cityHearts)
        + '）—— 民心尽时，此城将为敌方所据（得胜可夺其民心 · 每胜 20）');
    }
    if (out.wallDrop) lines.push('城墙 −' + out.wallDrop + ' 级');"""
rep('E2a 战报民心行', E2A_OLD, E2A_NEW, '【民心】民心 −')

E2B_OLD = """      title: (held ? '\U0001f6e1 守土' : (out.lootOk ? '\U0001f4a5 城破' : '\u26a0 城破未掠'))
        + ' · ' + src + '来袭 · ' + city.name,"""
E2B_NEW = """      title: ((out.cityFallen && out.cityFallen.ok) ? '\U0001f3f4 城陷'
        : (held ? '\U0001f6e1 守土' : (out.lootOk ? '\U0001f4a5 城破' : '\u26a0 城破未掠')))
        + ' · ' + src + '来袭 · ' + city.name,"""
rep('E2b 战报标题', E2B_OLD, E2B_NEW, '城陷\'\n        : (held')

# ── E3 预警民心警示 ──
E3_OLD = """  GAME.invasionIntelTextOf = function (city, slotIdx) {
    var lv = GAME.invasionIntelLvOf(city);
    var txt = '\u300c' + GAME.invasionSrcOf(city, slotIdx) + '\u300d';
    if (lv < 1) return txt;"""
E3_NEW = """  GAME.invasionIntelTextOf = function (city, slotIdx) {
    var lv = GAME.invasionIntelLvOf(city);
    var txt = '\u300c' + GAME.invasionSrcOf(city, slotIdx) + '\u300d';
    /* v89.204（老板 1）：本城**民心警示**（独立于烽火台情报等级 —— 民心是自家账） */
    if (GAME.cityHeartsOf) {
      var _h204 = GAME.cityHeartsOf(city);
      if (_h204 <= 0) txt += '\U0001f494 民心已尽·城破即失';
      else if (_h204 <= 20) txt += '\U0001f494 民心仅 ' + Math.round(_h204) + '%·再败即尽';
      else if (_h204 <= 40) txt += '\U0001f494 民心仅 ' + Math.round(_h204) + '%';
    }
    if (lv < 1) return txt;"""
rep('E3 预警民心', E3_OLD, E3_NEW, '民心已尽·城破即失')

print('patch E done')
