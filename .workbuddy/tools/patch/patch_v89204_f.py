# -*- coding: utf-8 -*-
"""v89.204 批次 F：ui.js —— 民心显示按城 + 文案（守备→民心）
  F1 侧栏民心行：cityHeartsOf(当前城) + 战争创伤悬停分解
  F2 官府段：cityHeartsOf(当前城) + 分解行加战争创伤
  F3 据点面板文案
  F4 战报围攻行
  F5 军师估算注释
"""
import io

P = 'E:/Deepseekdb/js/ui.js'

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

# ── F1 侧栏民心行 ──
rep('F1a hearts 取值',
    """    var hearts = Math.round(s.hearts || 100);
    var minyuan = Math.max(0, 100 - hearts);""",
    """    /* v89.204（老板 1）：民心显示走**城级**（含战争创伤）—— 全局基准见 heartsOf */
    var hearts = Math.round(GAME.cityHeartsOf ? GAME.cityHeartsOf(c) : (s.hearts || 100));
    var minyuan = Math.max(0, 100 - hearts);
    var _hWar204 = (GAME.heartsWarOf ? GAME.heartsWarOf(c) : 0);
    var _hTip204 = _hWar204 > 0
      ? ' title="民心 = 基准 ' + Math.round(GAME.heartsOf()) + ' − 战争创伤 ' + Math.round(_hWar204)
        + '（每现实日恢复 ' + (((DATA.SIEGE || {}).repairPerDay) || 0) + '）"'
      : '';""",
    '_hWar204 = (GAME.heartsWarOf')

rep('F1b 行挂悬停',
    """      '<div class="res-line"><span class="lbl">民心 / 民怨</span><span class="val">' +""",
    """      '<div class="res-line"><span class="lbl">民心 / 民怨</span><span class="val"' + _hTip204 + '>' +""",
    "<span class=\"val\"' + _hTip204 + '>")

# ── F2 官府段 ──
rep('F2a 官府取值',
    """      var hb177 = GAME.heartsOf(), my177 = GAME.minyuanOf();""",
    """      /* v89.204（老板 1）：官府（当前城）民心走城级（含战争创伤） */
      var hb177 = (GAME.cityHeartsOf ? GAME.cityHeartsOf(c) : GAME.heartsOf());
      var my177 = Math.max(0, 100 - hb177);""",
    'var my177 = Math.max(0, 100 - hb177);')

rep('F2b 官府分解行',
    """          + '<span class="ui-sub">　税率 ' + Math.round((s.tax || 0) * 100) + '% → 基准 '
          + Math.round(GAME.heartsBaseOf()) + '　安抚 ' + Math.round(GAME.heartsComfortOf())
          + '（随时间回落）</span></span></div>' +""",
    """          + '<span class="ui-sub">　税率 ' + Math.round((s.tax || 0) * 100) + '% → 基准 '
          + Math.round(GAME.heartsBaseOf()) + '　安抚 ' + Math.round(GAME.heartsComfortOf())
          + ((GAME.heartsWarOf && GAME.heartsWarOf(c) > 0)
            ? '　战争创伤 −' + Math.round(GAME.heartsWarOf(c)) + '（每现实日恢复 '
              + (((DATA.SIEGE || {}).repairPerDay) || 0) + '）' : '')
          + '（随时间回落）</span></span></div>' +""",
    '战争创伤 −\' + Math.round(GAME.heartsWarOf(c))')

# ── F3 据点面板文案 ──
rep('F3 据点面板',
    """🚩 <b>拔除并收为前哨</b>：围攻磨掉守备值 → 城垣一破即归我（不转城市、不占城池名额）· 本城前哨 <b>'""",
    """🚩 <b>拔除并收为前哨</b>：围攻夺其民心（胜者每战 −20）→ 民心一尽即归我（不转城市、不占城池名额）· 本城前哨 <b>'""",
    '围攻夺其民心（胜者每战 −20）')

# ── F4 战报围攻行 ──
rep('F4 战报围攻行',
    """      html += '<div class="rp-under">🧱 围攻：本波破防 ' + r.siege.chip + '% → 守备余 '
        + Math.round(r.siege.hold) + '%（第 ' + r.siege.waves + ' 波'
        + (r.siege.broke ? ' · 城垣已破' : ' · 守军退守内城') + '）</div>';""",
    """      html += '<div class="rp-under">🧱 围攻：民心 −' + r.siege.chip + ' → 余 '
        + Math.round(r.siege.hold) + '%（第 ' + r.siege.waves + ' 波'
        + (r.siege.broke ? ' · 民心已尽，城垣垂危' : ' · 守军退守内城') + '）</div>';""",
    '🧱 围攻：民心 −')

# ── F5 估算注释 ──
rep('F5 估算注释',
    """     · 围攻目标（据点/县城）：守军与城防按**当前守备值**折算（与战斗入参同一出口）；""",
    """     · 围攻目标（据点/城池）：守军与城防按**当前民心**折算（与战斗入参同一出口 · v89.204 口径）；""",
    '守军与城防按**当前民心**折算')

print('patch F done')
