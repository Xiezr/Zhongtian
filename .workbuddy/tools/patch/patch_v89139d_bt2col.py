# -*- coding: utf-8 -*-
"""v89.139 批四-1：ui.js —— 战场侧栏 2 列（全兵种列出·参战亮/未战灰）+ 去掉副标题备注"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'ui.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


# ── ① btSideHTML：2 列网格 + 全兵种 + 灰暗未参战 ──
rep("""  ui.btSideHTML = function (snap, side) {
    var foeList = (side === 'atk') ? (snap.def || []) : (snap.atk || []);
    var mine = (side === 'atk');
    var rows = ((side === 'atk') ? (snap.atk || []) : (snap.def || [])).map(function (u) {
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
      return '<div class="bt-rrow' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        /* v89.137（老板 2）：悬停兵种 → 最终属性（唯一出口 ui.btUnitTip） */
        '<span class="bt-ric" title="' + U.escape(ui.btUnitTip(u, side)) + '">' +
          '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
          '<b class="bt-rn" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
          '<i class="bt-rnm">' + U.escape(u.name) + '</i></span>' +
        (mine
          ? '<select class="bt-sel" data-action="bt-stance" data-troop="' + u.id + '" id="bt-s-' + u.id + '">'
              + stOpts + '</select>' +
            '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '" id="bt-t-' + u.id + '">'
              + tOpts + '</select>'
          : '<span class="bt-ro">' + (ui.btStanceName[u.stance] || u.stance) + '</span>' +
            '<span class="bt-ro">' + (u.target === DATA.TARGET_WALL ? '目标：城头箭塔'
              : (u.target ? ('目标：' + U.escape(((foeList.filter(function (x) { return x.id === u.target; })[0] || {}).name || u.target)))
                : '目标：任意')) + '</span>') +
        '</div>';
    }).join('');
    return '<div class="bt-side ' + (mine ? 'mine' : 'foe') + '" id="bt-side-' + side + '">' +
      '<div class="bt-side-h">' + ui.btSideName(side) + '（' + ((side === 'atk') ? (snap.atk || []) : (snap.def || [])).length + ' 队）</div>' +
      /* v89.136（老板 2）：「我军和敌军上方显示双方将领，悬停可显示将领六维」 */
      ui.btGenLine(side) +
      (rows || '<div class="q-empty">无</div>') + '</div>';
  };""",
"""  ui.btSideHTML = function (snap, side) {
    var foeList = (side === 'atk') ? (snap.def || []) : (snap.atk || []);
    var mine = (side === 'atk');
    var myList = mine ? (snap.atk || []) : (snap.def || []);
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
    'btSideHTML 2 列')

# ── ② 去掉副标题备注 ──
rep("""    ui.openShell({
      title: '⚔ 战场 · ' + U.escape((rec.target && rec.target.name) || '目标'),
      sub: '战斗待指挥 · 每回合 ' + sec + ' 秒（可提前完成 · 右上角 ✕ 转后台，战斗继续进行）',
      size: 'xxl',""",
"""    /* v89.139（老板 1）：副标题备注整条去掉（「这个备注去掉：战斗待指挥 · 每回合 60 秒…」）——
       回合秒数与"转后台"语义改由读秒行/底栏按钮自身表达（见 btTopHTML 的倒计时与底栏）。 */
    ui.openShell({
      title: '⚔ 战场 · ' + U.escape((rec.target && rec.target.name) || '目标'),
      size: 'xxl',""",
    '去掉竞技场副标题')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'bt-cards' in chk and 'bt-card' in chk, '落盘校验失败'
assert '战斗待指挥 · 每回合' not in chk, '备注残留'
print('✅ ui.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
