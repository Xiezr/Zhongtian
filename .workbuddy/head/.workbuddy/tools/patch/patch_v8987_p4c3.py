# -*- coding: utf-8 -*-
"""v89.87 需求4c-3：接线（closeModal 拆装 / 军务征战中段 / main 动作分发 / onMarchArrive）"""
import io

# ---------- 1) ui.js closeModal + marchesHTML ----------
P1 = r'E:\Deepseekdb\js\ui.js'
s1 = io.open(P1, encoding='utf-8', newline='').read()

old1 = """  ui.closeModal = function () {
    $('#modal-root').innerHTML = '';
    ui._visible = false;"""
new1 = """  ui.closeModal = function () {
    /* v89.87：关战场界面 = 转后台（清倒计时 timer、恢复 rec.anim 防后台停摆） */
    if (ui.btTeardown) ui.btTeardown();
    $('#modal-root').innerHTML = '';
    ui._visible = false;"""
assert s1.count(old1) == 1, ('close', s1.count(old1))
s1 = s1.replace(old1, new1, 1)

old2 = """    /* ---------- ④ 行军（**全境**队列，不只看当前城） ---------- */"""
new2 = """    /* ---------- v89.87（老板需求 4）：④′ 征战中（待指挥的观战战斗） ---------- */
    var btPend = ui.btPendingBlock();

    /* ---------- ④ 行军（**全境**队列，不只看当前城） ---------- */"""
assert s1.count(old2) == 1, ('marches marker', s1.count(old2))
s1 = s1.replace(old2, new2, 1)

old3 = """        '　·　采集 ' + U.numText(gatherTot, 0) + '　·　行军 ' + U.numText(marchTot, 0) +
        '　·　伤兵 ' + U.numText(s.wounded || 0, 0) + '</div>' +"""
new3 = """        '　·　采集 ' + U.numText(gatherTot, 0) + '　·　行军 ' + U.numText(marchTot, 0) +
        '　·　征战 ' + (btPend ? btPend.n : 0) +
        '　·　伤兵 ' + U.numText(s.wounded || 0, 0) + '</div>' +"""
assert s1.count(old3) == 1, ('sum line', s1.count(old3))
s1 = s1.replace(old3, new3, 1)

old4 = """      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">④ 行军</span><span class="q-sec-n">' + list.length + ' 队</span></div>' +
      marchBlock +"""
new4 = """      (btPend ? '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">⚔ 征战中</span><span class="q-sec-n">' + btPend.n + ' 处</span></div>' + btPend.html : '') +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">④ 行军</span><span class="q-sec-n">' + list.length + ' 队</span></div>' +
      marchBlock +"""
assert s1.count(old4) == 1, ('sec line', s1.count(old4))
s1 = s1.replace(old4, new4, 1)
io.open(P1, 'w', encoding='utf-8', newline='').write(s1)
print('OK ui.js 接线')

# ---------- 2) main.js 动作分发 + onMarchArrive ----------
P2 = r'E:\Deepseekdb\js\main.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()

old5 = """      case 'march-rush': (function () {
        var r = GAME.march.rushAll();
        ui.toast(r.msg);
        ui.closeModal();
        GAME.refreshAll();"""
new5 = """      /* v89.87（老板需求 4）：战场界面动作 —— 指令 / 完成回合 / 自动 / 军务入口 */
      case 'bt-open': ui.openBattlefield(el.dataset.id); break;
      case 'bt-stance': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) ui.btSetCmd(rec, el.dataset.troop, { s: el.dataset.s });
      })(); break;
      case 'bt-target': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) ui.btSetCmd(rec, el.dataset.troop, { t: el.value || '' });
      })(); break;
      case 'bt-done': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (!rec) return;
        if (ui._bt.playing) { ui.toast('本回合结算播放中，稍候…'); return; }
        var r = GAME.battle.stepBattle(rec.id);
        if (r && ui.btAfterStep) ui.btAfterStep(rec, r);
      })(); break;
      case 'bt-auto': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) GAME.battle.autoBattle(rec.id);   /* 结束由 ui.onBattleDone 收口 */
      })(); break;
      case 'march-rush': (function () {
        var r = GAME.march.rushAll();
        ui.toast(r.msg);
        ui.closeModal();
        GAME.refreshAll();"""
assert s2.count(old5) == 1, ('march-rush', s2.count(old5))
s2 = s2.replace(old5, new5, 1)

old6 = """  GAME.onMarchArrive = function (m, r) {
    GAME.refreshAll();
    if (!r) return;"""
new6 = """  GAME.onMarchArrive = function (m, r) {
    GAME.refreshAll();
    if (!r) return;
    /* v89.87（老板需求 4）：观战挂起 → 直接进入战场界面（不再只弹 toast） */
    if (r.pending && r.battleId) { ui.openBattlefield(r.battleId); return; }"""
assert s2.count(old6) == 1, ('arrive', s2.count(old6))
s2 = s2.replace(old6, new6, 1)
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('OK main.js 接线')
