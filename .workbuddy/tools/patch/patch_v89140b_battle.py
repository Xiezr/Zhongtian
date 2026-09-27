# -*- coding: utf-8 -*-
"""v89.140 批二：战场（距离 × 系数 / 侧栏去图标两行制只列在场 / 战场放宽 / log 降高）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
ok = []


def patch(rel, pairs, checks):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:30]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(tag)
    assert '\r\n' not in s, rel + ' CRLF'
    assert s.count('{') == s.count('}'), rel + ' 花括号不配平'
    tmp = p + '.tmp140'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    for c in checks:
        assert c in chk, rel + ' 落盘校验失败：' + c[:60]
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))


# ══════ tactic.js：距离改"最远射程 × 系数" ══════
patch('js/tactic.js', [
    ("""  T.FIELD_MARGIN = 299;""",
     """  /* v89.140（老板 1）：「战场距离是否考虑基于在场兵种**最远射程乘以某个系数**？合理设计」——
     采纳：从"+MARGIN（绝对量）"改为"× FIELD_RANGE_K（比例量）"。
     系数 1.25 的来由：原版口径 maxR+299 在主流射程段与 ×1.25 几乎重合
     （弓 1200 → 1499 vs 1500；投石 1600 → 1899 vs 2000），
     但比例式在**任意射程**下都成立（低射程交给 FIELD_MIN/速度项，高射程自然成比例放大），
     不用再问"为什么是 299 而不是别的数"。 */
  T.FIELD_RANGE_K = 1.25;
  T.FIELD_MARGIN = 299;""",
     'FIELD_RANGE_K 常量'),
    ("""    var spdFloor = Math.round((fastA + fastD) * T.MARCH_ROUNDS_MIN);
    return Math.max(T.FIELD_MIN, Math.round(maxR) + T.FIELD_MARGIN, spdFloor);""",
     """    var spdFloor = Math.round((fastA + fastD) * T.MARCH_ROUNDS_MIN);
    /* v89.140：射程项改 `maxR × FIELD_RANGE_K`（比例式）——三下限取大不变 */
    return Math.max(T.FIELD_MIN, Math.round(maxR * T.FIELD_RANGE_K), spdFloor);""",
     'battlefieldOf 比例式'),
], ['T.FIELD_RANGE_K = 1.25'])

# ══════ ui.js：战场侧栏 ══════
patch('js/ui.js', [
    ("""    var myList = mine ? (snap.atk || []) : (snap.def || []);
    var byId = {};
    myList.forEach(function (u) { byId[u.id] = u; });
    /* v89.139（老板 1）：「压缩战场界面兵种显示，内容更紧凑，**默认兵种全部列出**呈 2 列，
       本次包含的兵种亮色，没有的兵种图标灰暗」——
       列出全部可战兵种（nocombat 的斥候不列，它不上阵），参战者给数量与下拉、
       未参战者灰暗占位（只留图标 + 名称）。每侧 2 列，行数减半、整体更矮更紧凑。 */
    var ALL = Object.keys(DATA.TROOPS).filter(function (k) { return !DATA.TROOPS[k].nocombat; });
    var rows = ALL.map(function (tid) {
      var t = DATA.TROOPS[tid] || {};
      var ico = '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(tid)) || '') + '</span>';
      var u = byId[tid];
      if (!u) {
        return '<div class="bt-card off" title="' + U.escape((t.name || tid) + '（本次未出征）') + '">' +
          '<span class="bt-ric">' + ico + '<i class="bt-rnm">' + U.escape(t.name || tid) + '</i></span></div>';
      }
      var alive = u.count > 0;
      var stOpts = ['advance', 'hold', 'retreat'].map(function (s) {
        return '<option value="' + s + '"' + ((u.stance || 'advance') === s ? ' selected' : '') + '>'
          + ui.btStanceName[s] + '</option>';
      }).join('');
      var tOpts = '<option value="">目标：任意</option>';
      foeList.forEach(function (d) {
        tOpts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>目标：'
          + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        tOpts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '')
          + '>目标：城防箭塔</option>';
      }
      return '<div class="bt-card' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        /* v89.137（老板 2）：悬停兵种 → 最终属性（唯一出口 ui.btUnitTip） */
        '<span class="bt-ric" title="' + U.escape(ui.btUnitTip(u, side)) + '">' +
          ico +
          '<b class="bt-rn" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
          '<i class="bt-rnm">' + U.escape(u.name) + '</i></span>' +
        (mine
          ? '<span class="bt-u2">' +
              '<select class="bt-sel" data-action="bt-stance" data-troop="' + u.id + '" id="bt-s-' + u.id + '">'
                + stOpts + '</select>' +
              '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '" id="bt-t-' + u.id + '">'
                + tOpts + '</select></span>'
          : '<span class="bt-u2"><span class="bt-ro">' + (ui.btStanceName[u.stance] || u.stance) + '</span>' +
            '<span class="bt-ro">' + (u.target === DATA.TARGET_WALL ? '目标：城头箭塔'
              : (u.target ? ('目标：' + U.escape(((foeList.filter(function (x) { return x.id === u.target; })[0] || {}).name || u.target)))
                : '目标：任意')) + '</span></span>') +
        '</div>';
    }).join('');
    return '<div class="bt-side ' + (mine ? 'mine' : 'foe') + '" id="bt-side-' + side + '">' +
      '<div class="bt-side-h">' + ui.btSideName(side) + '（' + myList.length + ' / ' + ALL.length + ' 兵种参战）</div>' +
      /* v89.136（老板 2）：「我军和敌军上方显示双方将领，悬停可显示将领六维」 */
      ui.btGenLine(side) +
      '<div class="bt-cards">' + rows + '</div></div>';
  };""",
     """    var myList = mine ? (snap.atk || []) : (snap.def || []);
    /* v89.140（老板 1）：「左右的兵种设置这里建议不要图标了，直接**第一行是兵种名称+行动，
       第二行是数量+目标**。然后还是**只显示在场的兵种**吧，没有的就不要了」——
       于是：① 去掉 `.bt-ico`；② 每格两行（名+动作 / 数+目标）；③ 只遍历**参战**列表
       （v89.139 的"全兵种 + 灰暗占位"整段退役）。 */
    var rows = myList.map(function (u) {
      var alive = u.count > 0;
      var stOpts = ['advance', 'hold', 'retreat'].map(function (s) {
        return '<option value="' + s + '"' + ((u.stance || 'advance') === s ? ' selected' : '') + '>'
          + ui.btStanceName[s] + '</option>';
      }).join('');
      var tOpts = '<option value="">目标：任意</option>';
      foeList.forEach(function (d) {
        tOpts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>目标：'
          + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        tOpts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '')
          + '>目标：城防箭塔</option>';
      }
      /* 悬停"最终属性"移到**名称**上（图标没了，名称即靶心） */
      return '<div class="bt-card' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        '<span class="bt-l1">' +
          '<i class="bt-rnm" title="' + U.escape(ui.btUnitTip(u, side)) + '">' + U.escape(u.name) + '</i>' +
          (mine
            ? '<select class="bt-sel" data-action="bt-stance" data-troop="' + u.id + '" id="bt-s-' + u.id + '">'
                + stOpts + '</select>'
            : '<span class="bt-ro">' + (ui.btStanceName[u.stance] || u.stance) + '</span>') +
        '</span>' +
        '<span class="bt-l2">' +
          '<b class="bt-rn" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
          (mine
            ? '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '" id="bt-t-' + u.id + '">'
                + tOpts + '</select>'
            : '<span class="bt-ro">' + (u.target === DATA.TARGET_WALL ? '目标：城头箭塔'
              : (u.target ? ('目标：' + U.escape(((foeList.filter(function (x) { return x.id === u.target; })[0] || {}).name || u.target)))
                : '目标：任意')) + '</span>') +
        '</span></div>';
    }).join('');
    return '<div class="bt-side ' + (mine ? 'mine' : 'foe') + '" id="bt-side-' + side + '">' +
      '<div class="bt-side-h">' + ui.btSideName(side) + '（' + myList.length + ' 队）</div>' +
      /* v89.136（老板 2）：「我军和敌军上方显示双方将领，悬停可显示将领六维」 */
      ui.btGenLine(side) +
      '<div class="bt-cards">' + (rows || '<div class="q-empty">无</div>') + '</div></div>';
  };""",
     'btSideHTML 两行制'),
], ['bt-l1', 'bt-l2'])

# ══════ index.html：战场 CSS ══════
patch('index.html', [
    ("""  .bt-board { display: grid; grid-template-columns: 1.5fr 3fr 1.5fr; gap: var(--sp-2); align-items: start; }""",
     """  /* v89.140（老板 1）：侧栏去图标 + 只列在场兵种 → 侧栏可更窄、中间战场更宽：
     1.1fr : 3.8fr : 1.1fr（实测侧栏 ~222px / 战场 ~760px，较 v89.139 的 576px 放宽 32%） */
  .bt-board { display: grid; grid-template-columns: 1.1fr 3.8fr 1.1fr; gap: var(--sp-2); align-items: start; }""",
     'bt-board 列宽'),
    ("""  .bt-card { display: flex; flex-direction: column; gap: 1px; padding: 1px var(--sp-1);
    border-radius: var(--r-md); background: rgba(var(--sh-rgb), .26); border: 1px solid var(--line);
    min-width: 0; }""",
     """  .bt-card { display: flex; flex-direction: column; gap: 1px; padding: 2px var(--sp-1);
    border-radius: var(--r-md); background: rgba(var(--sh-rgb), .26); border: 1px solid var(--line);
    min-width: 0; }
  /* v89.140（老板 1）：每格两行 —— ① 名称 + 动作　② 数量 + 目标 */
  .bt-l1, .bt-l2 { display: flex; align-items: center; gap: 3px; min-width: 0; }
  .bt-l1 .bt-rnm { flex: 1 1 auto; min-width: 0; font-size: var(--fs-cap); color: var(--text-dim);
    font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: help; }
  .bt-l2 .bt-rn { flex: none; min-width: 34px; font-size: var(--fs-cap); }
  .bt-l1 .bt-sel, .bt-l2 .bt-sel { flex: 1 1 0; min-width: 0; height: 18px; padding: 0 1px; font-size: var(--fs-cap); }
  .bt-l1 .bt-ro, .bt-l2 .bt-ro { flex: 1 1 0; min-width: 0; font-size: var(--fs-cap); color: var(--text-dim);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }""",
     'bt-card 两行 CSS'),
    ("""  .bt-log { flex: 1 1 336px; max-height: none; min-height: 140px; overflow-y: auto;""",
     """  /* v89.140（老板 1）：「底部的回合记录的记录框高度**稍降低**，为上方腾出空间」——
     理想高 336 → **250**（min 130 保底），腾出的 ~86px 归上方战场区。 */
  .bt-log { flex: 1 1 250px; max-height: none; min-height: 130px; overflow-y: auto;""",
     'bt-log 降高'),
], ['1.1fr 3.8fr 1.1fr', 'bt-l1, .bt-l2', 'flex: 1 1 250px'])
print('✅ 完成：' + ' / '.join(ok))
