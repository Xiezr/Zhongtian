# -*- coding: utf-8 -*-
"""v89.164 补丁 C（界面）：
   expTacticOptionsHTML 加「⚡ 智能战斗」选项 · expApplyTactic 开关分支 ·
   syncExpTacticRow 摘要 · btTopHTML 战场指示"""
import io

R = 'E:/Deepseekdb/'
LOG = []

def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, guard=None):
    s = rd(path)
    g = guard if guard is not None else new
    if g in s:
        LOG.append('  [skip] %s（新内容已在）' % tag)
        return
    c = s.count(old)
    assert c == 1, '%s 锚点数=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    wr(path, s)
    LOG.append('  [ ok ] %s' % tag)

# ══════════ ① 选项列表加「⚡ 智能战斗」 ══════════
rep('js/ui.js', 'ui · 战术下拉加「⚡ 智能战斗」选项',
"""  ui.expTacticOptionsHTML = function () {
    return '<option value="">默认（全体前进）</option>' +
      (DATA.STANCES || []).map(function (st) {
        return '<option value="u:' + st.id + '">' + st.icon + ' 全体' + st.name + '</option>';
      }).join('') +
      ui.tacticSetsOf().map(function (t) {
        return '<option value="s:' + t.id + '">📋 ' + U.escape(t.name) + '</option>';
      }).join('');
  };""",
"""  ui.expTacticOptionsHTML = function () {
    /* v89.164（老板 3）：首项 = 「⚡ 智能战斗（通用方案）」——选中即开智能托管；
       选中任何其他项 = 关（回到手动战术）。选中态由 settings.smartBattle 决定。 */
    var smartOn = !!(GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf());
    return '<option value="smart"' + (smartOn ? ' selected' : '') + '>⚡ 智能战斗（通用方案）</option>' +
      '<option value=""' + (smartOn ? '' : ' selected') + '>默认（全体前进）</option>' +
      (DATA.STANCES || []).map(function (st) {
        return '<option value="u:' + st.id + '">' + st.icon + ' 全体' + st.name + '</option>';
      }).join('') +
      ui.tacticSetsOf().map(function (t) {
        return '<option value="s:' + t.id + '">📋 ' + U.escape(t.name) + '</option>';
      }).join('');
  };""")

# ══════════ ② expApplyTactic 开关分支 ══════════
rep('js/ui.js', 'ui · expApplyTactic 智能分支（选其他项即关）',
"""  ui.expApplyTactic = function (v) {
    if (!v) { GAME.clearTactics(); }
    else if (v.indexOf('u:') === 0) {""",
"""  ui.expApplyTactic = function (v) {
    /* v89.164（老板 3）：「⚡ 智能战斗」= 开智能托管（逐回合自动指挥）；
       选中任何其他项 = 关智能（回到原手动战术逻辑）。 */
    if (v === 'smart') {
      if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(true);
      ui.syncExpTacticRow();
      ui.toast('⚡ 智能战斗已开启：接敌自动转防御 · 按克制逐回合指派目标');
      return;
    }
    if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(false);
    if (!v) { GAME.clearTactics(); }
    else if (v.indexOf('u:') === 0) {""")

# ══════════ ③ 摘要行 ══════════
rep('js/ui.js', 'ui · syncExpTacticRow 智能摘要',
"""  ui.syncExpTacticRow = function () {
    var sum = document.getElementById('exp-tac-sum');
    if (sum) sum.textContent = GAME.tacticSummary();
  };""",
"""  ui.syncExpTacticRow = function () {
    var sum = document.getElementById('exp-tac-sum');
    if (!sum) return;
    /* v89.164：智能开启时摘要行直接写"智能战斗"（手动战术表另存着，随时可切回） */
    sum.textContent = (GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf())
      ? '⚡ 智能战斗（接敌转守 · 逐回合自动指挥）'
      : GAME.tacticSummary();
  };""")

# ══════════ ④ 战场顶栏指示 ══════════
rep('js/ui.js', 'ui · 战场顶栏「⚡ 智能」指示',
"""    return '<div class="bt-top">' +
      '<span class="bt-left">' +
        '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
        '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
        ui.btGapTextOf(rec, snap) +
      '</span>' +""",
"""    return '<div class="bt-top">' +
      '<span class="bt-left">' +
        '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
        '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
        /* v89.164（老板 3）：智能战斗指示 —— 开着时玩家能看出"为什么接敌自动变防御"；
           切换入口在出征 / 自动出征面板的「战术」下拉。守城战不受托管（不显示）。 */
        ((GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf() && rec.side === 'atk')
          ? '<span class="bt-smart" title="智能战斗中：接敌自动转防御、按克制指派目标。切换在「出征 / 自动出征 · 战术」下拉。">⚡ 智能</span>' : '') +
        ui.btGapTextOf(rec, snap) +
      '</span>' +""")

print('\n'.join(LOG))
print('补丁 C 完成')
