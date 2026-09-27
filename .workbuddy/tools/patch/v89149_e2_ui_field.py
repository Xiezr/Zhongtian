# -*- coding: utf-8 -*-
"""v89.149 批 E2：ui.js 战场版面与读数 ——
① 战场条填满 board（拉高到回合记录上方）+ 兵牌纵向铺满（--rel）② 间距读数统一为
「最近距离 / 全局」（ui.gapReadOf / ui.btGapTextOf 唯一出口）③ 删「左侧设动作/目标」备注
④ btSetCmd 重绘改读会话快照（每回合可重设的真病根）⑤ 回合头文案统一"""
import io

P = 'E:/Deepseekdb/js/ui.js'
BAK = 'E:/Deepseekdb/backup/v89149/ui.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag)
        return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 读数唯一出口（接在 btGapOf 之后） ----------
A1 = """  ui.btGapOf = function (rec, snap) {
    if (rec && rec.gapLast != null) return rec.gapLast;
    try { return GAME.tactic.frontsOf(snap.atk || [], snap.def || [], snap.field || 1).gap; }
    catch (e) { return null; }
  };
  /* ---- 顶部条 ---- */"""
N1 = """  ui.btGapOf = function (rec, snap) {
    if (rec && rec.gapLast != null) return rec.gapLast;
    try { return GAME.tactic.frontsOf(snap.atk || [], snap.def || [], snap.field || 1).gap; }
    catch (e) { return null; }
  };
  /* v89.149（老板 7）：「左上备注：间距 30，**这里的间距统一设置为最近距离/全局战场距离**」——
     读数文案**唯一出口**（战场顶栏 / 沙盘顶栏 / 实时刷新都读它，不再各写一串）：
       最近距离 = 两军最前线之间的距离（= 引擎 frontsOf 的 gap；推进到进入射程即停）
       全局     = 战场纵深（由双方配兵决定，见 tactic.battlefieldOf）
     改前只写"间距 30" —— 玩家不知道 30 是什么尺度、更不知道战场有多深。 */
  ui.gapReadOf = function (gap, D) {
    var near = (gap == null) ? '—' : U.numText(gap, 0);
    return '最近距离 <b>' + near + '</b>' + (D ? ' / 全局 <b>' + U.numText(D, 0) + '</b>' : '');
  };
  ui.btGapTextOf = function (rec, snap, rGap) {
    var gp = (rGap == null) ? ui.btGapOf(rec, snap) : rGap;
    var D = (snap && snap.field) || null;
    return '<span id="bt-gap" title="最近距离 = 两军最前线之间的距离（纵深 − 双方推进度；'
      + '推进到进入射程即停）。全局 = 战场纵深（双方配兵决定）">'
      + ui.gapReadOf(gp, D) + '</span>';
  };
  /* ---- 顶部条 ---- */"""
rep(A1, N1, 'gapReadOf/btGapTextOf')

# ---------- ② 顶栏：读数换出口 + 删备注 ----------
A2 = """  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    var gp = ui.btGapOf(rec, snap);"""
N2 = """  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;"""
rep(A2, N2, 'btTopHTML-去 gp 局部量')

A3 = """        '<span id="bt-gap" title="两军最前线之间的距离（纵深 − 双方推进度）；推进到进入射程即停">间距 '
          + (gp == null ? '—' : U.numText(gp, 0)) + '</span>' +
      '</span>' +"""
N3 = """        ui.btGapTextOf(rec, snap) +
      '</span>' +"""
rep(A3, N3, 'btTopHTML-读数')

A4 = """      '<span class="bt-hint" title="动作/目标用左侧下拉框设置；点「完成回合」立即结算，到点自动结算">左侧设动作/目标</span>' +
      '</div>';"""
N4 = """      /* ⛔ v89.149（老板 6）「不要这个备注：左侧设动作/目标」整条退役 ——
         动作/目标就在两侧下拉里（点一下就知道）；右列留空后三键仍居中（grid 1fr auto 1fr）。 */
      '</div>';"""
rep(A4, N4, 'btTopHTML-删备注')

# ---------- ③ 实时刷新用同一出口 ----------
A5 = """    var gp = document.getElementById('bt-gap');
    if (gp) gp.textContent = '间距 ' + U.numText(r.gap, 0);"""
N5 = """    var gp = document.getElementById('bt-gap');
    /* v89.149（老板 7）：实时刷新也走同一出口（最近距离 / 全局） */
    if (gp) gp.innerHTML = ui.gapReadOf(r.gap, (r.snap || rec.snapLast || {}).field);"""
rep(A5, N5, 'btAfterStep-读数')

# ---------- ④ 每回合可重设：重绘改读会话快照 ----------
A6 = """    var ses = GAME._bsess && GAME._bsess[rec.id];
    if (ses) ses.setCmd('atk', troopId, c);
    var box = document.getElementById('bt-board');
    var snap = rec.snapLast || (ses ? ses.snap() : null);
    if (box && snap) box.outerHTML = ui.btBoardHTML(snap);
  };"""
N6 = """    var ses = GAME._bsess && GAME._bsess[rec.id];
    if (ses) ses.setCmd('atk', troopId, c);
    /* v89.149（老板 2）：「动作设置……**每回合可以重新设置**，如不动，则继承上回合设置」——
       重绘棋盘必须读**会话快照**（它含刚下达的待生效指令），不能读 `rec.snapLast`
       （那是**上一回合结束时**的快照 —— 实机实测：改成"后退"后棋盘立刻跳回"前进"，
        玩家以为"改了不生效"，而会话里其实已生效、下一回合按新指令打）。
       回读顺序反过来：`ses.snap() || rec.snapLast`。播放动画期间不重绘（位移动画正在跑）。 */
    var box = document.getElementById('bt-board');
    var snap = ses ? ses.snap() : (rec.snapLast || null);
    if (box && snap && !(ui._bt && ui._bt.playing)) box.outerHTML = ui.btBoardHTML(snap);
  };"""
rep(A6, N6, 'btSetCmd-读会话快照')

# ---------- ⑤ 战场条：填满 board + 兵牌纵向铺满 ----------
A7 = """    function uHTML(u, idx, side) {
      /* v89.117（老板「兵种数量降为 0（该兵种被消灭后），战场上的兵种图标变暗」）：
         初绘就带 dead（后台推进时可能"没动过就全灭"），后续由 btSyncCounts 增删。 */
      return '<div class="bt-unit ' + side + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        /* v89.137（老板 2）：战场兵牌同享"最终属性"悬停（同一出口） */
        'title="' + U.escape(ui.btUnitTip(u, side)) + '" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;top:' + (idx * 42 + (side === 'def' ? 21 : 0)) + 'px;">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span></div>';
    }
    var atkH = (snap.atk || []).map(function (u, i) { return uHTML(u, i, 'atk'); }).join('');
    var defH = (snap.def || []).map(function (u, i) { return uHTML(u, i, 'def'); }).join('');
    var cast = snap.towers
      ? '<div class="bt-castle">🏯 箭塔 <b id="bt-tower">' + snap.towers.left + '</b> / ' + snap.towers.start + '</div>'
      : '';
    var h = Math.max(2, Math.max((snap.atk || []).length, (snap.def || []).length)) * 42 + 21 + 14;
    return '<div class="bt-field" id="bt-field" style="height:' + h + 'px;">' + atkH + defH + cast + '</div>';
  };"""
N7 = """    /* v89.149（老板 5）：「中间战场区域的下方**拉到回合记录的上方**（高度拉高）」——
       改前：高度 = 兵种行数 × 42 + 35（内容撑高）——3 队时只有 203px，而 board 行 339px
       → 战场条底边离回合记录留 **140px** 空白（实机实测）。
       改后：高度交给 CSS（`.bt-field { height: 100% }` 填满 board 行），兵牌按 `--rel` **纵向铺满**：
         atk 第 i 队 → rel = i / n；def 第 i 队 → rel = (i + 0.5) / n（错半行，与 v89.103 同规）。
       `--rel` 是无单位数，CSS 用 `top: calc((100% - 牌高) * var(--rel))`；
       兵种数 > 8 队时挂 `dense` 档（牌与图标缩一档），12 队也能一屏放下。 */
    function uHTML(u, idx, side, n) {
      /* v89.117（老板「兵种数量降为 0（该兵种被消灭后），战场上的兵种图标变暗」）：
         初绘就带 dead（后台推进时可能"没动过就全灭"），后续由 btSyncCounts 增删。 */
      var rel = ((idx + (side === 'def' ? 0.5 : 0)) / Math.max(1, n)).toFixed(4);
      return '<div class="bt-unit ' + side + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        /* v89.137（老板 2）：战场兵牌同享"最终属性"悬停（同一出口） */
        'title="' + U.escape(ui.btUnitTip(u, side)) + '" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;--rel:' + rel + ';">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span></div>';
    }
    var nA = (snap.atk || []).length, nD = (snap.def || []).length;
    var atkH = (snap.atk || []).map(function (u, i) { return uHTML(u, i, 'atk', nA); }).join('');
    var defH = (snap.def || []).map(function (u, i) { return uHTML(u, i, 'def', nD); }).join('');
    var cast = snap.towers
      ? '<div class="bt-castle">🏯 箭塔 <b id="bt-tower">' + snap.towers.left + '</b> / ' + snap.towers.start + '</div>'
      : '';
    return '<div class="bt-field' + ((Math.max(nA, nD) > 8) ? ' dense' : '') + '" id="bt-field">'
      + atkH + defH + cast + '</div>';
  };"""
rep(A7, N7, 'btFieldHTML-填满与铺满')

# ---------- ⑥ 回合头文案统一 ----------
A8 = """    frag.appendChild(ui.btLogItem('第 ' + ((r && r.r) || 0) + ' 回合　·　间距 ' + U.numText((r && r.gap) || 0, 0), 'hdr'));"""
N8 = """    frag.appendChild(ui.btLogItem('第 ' + ((r && r.r) || 0) + ' 回合　·　最近距离 '
      + U.numText((r && r.gap) || 0, 0), 'hdr'));"""
rep(A8, N8, 'btRoundLine-回合头')

# 写后哨兵
assert s.count('ui.gapReadOf = function') == 1
assert s.count('ui.btGapTextOf = function') == 1
assert s.count('ui.btSetCmd = function') == 1
assert 'var gp = ui.btGapOf(rec, snap);' not in s, '旧 gp 局部量残留'
assert s.count('var snap = ses ? ses.snap() : (rec.snapLast || null);') == 1
_bi = s.find('ui.btTopHTML = function')
_bj = s.find('ui.btFieldHTML = function')
assert 'bt-hint' not in s[_bi:_bj], 'bt-hint 残留'
assert '--rel:' in s and "'style=\"height:' + h + 'px;\"" not in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ui.js(E2) 落盘 · len=' + str(len(s)))
