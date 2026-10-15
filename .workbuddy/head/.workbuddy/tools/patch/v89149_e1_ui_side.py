# -*- coding: utf-8 -*-
"""v89.149 批 E1：ui.js 战场侧栏 —— ① 兵种一字简称 ② 目标选项去"目标："前缀 + 默认"同兵种"
③ 目标文案唯一出口 ui.btTargetLabelOf"""
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


# ---------- ① 目标文案唯一出口（插在 btSideHTML 之前） ----------
A1 = "ui.btSideHTML = function (snap, side) {"
N1 = """  /* ============================================================
   * v89.149（老板 4）：「不要再显示"目标："这样的标识」——
   *   目标文案**唯一出口**（战场两侧只读行 + 沙盘只读行都读它）：
   *     同兵种（打对面同名兵种）/ 城头箭塔 / 兵种名 / 任意。
   *   ⚠️ "同兵种"的判定 = `target === 自己的兵种 id`（引擎的匹配规则就是按 id 找对面那支），
   *   不是界面自造的语义 —— 界面只做回显。
   * ============================================================ */
  ui.btTargetLabelOf = function (u, foeList) {
    var tg = (u && u.target) || '';
    if (!tg) return '任意';
    if (tg === DATA.TARGET_WALL) return '城头箭塔';
    if (u && tg === u.id) return '同兵种';
    var hit = (foeList || []).filter(function (x) { return x.id === tg; })[0];
    return hit ? U.escape(hit.name) : U.escape(tg);
  };
  ui.btSideHTML = function (snap, side) {"""
rep(A1, N1, 'btTargetLabelOf')

# ---------- ② 目标选项（去前缀 + 同兵种默认） ----------
A2 = """      var tOpts = '<option value="">目标：任意</option>';
      foeList.forEach(function (d) {
        tOpts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>目标：'
          + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        tOpts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '')
          + '>目标：城防箭塔</option>';
      }"""
N2 = """      /* v89.149（老板 4）：「行动和目标设置的下拉框，**默认显示前进和同兵种**……
         不要再显示'目标：'这样的标识」——选项 = 同兵种（默认）/ 任意 / 各敌兵种（只写名字）/ 城防箭塔。
         默认值不在界面造：**引擎**里给（`unitsOf`：未设目标 → 打同兵种），界面如实回显 ——
         史实与沙盘重跑才同源（§20.5 v89.116 的规矩）。 */
      var tOpts = '<option value="' + u.id + '"' + (u.target === u.id ? ' selected' : '') + '>同兵种</option>'
        + '<option value=""' + (!u.target ? ' selected' : '') + '>任意</option>';
      foeList.forEach(function (d) {
        if (d.id === u.id) return;                    /* 同兵种已在首项，不重复列 */
        tOpts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>'
          + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        tOpts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '')
          + '>城防箭塔</option>';
      }"""
rep(A2, N2, '目标选项')

# ---------- ③ 名称改一字简称 ----------
A3 = """      /* 悬停"最终属性"移到**名称**上（图标没了，名称即靶心） */
      return '<div class="bt-card' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        '<span class="bt-l1">' +
          '<i class="bt-rnm" title="' + U.escape(ui.btUnitTip(u, side)) + '">' + U.escape(u.name) + '</i>' +"""
N3 = """      /* 悬停"最终属性"移到**名称**上（图标没了，名称即靶心）；
         v89.149（老板 3）：「为兵种设置一个**一字简称**，不要挤压行动设置和目标设置」——
         名称改简称（`GAME.troopAbOf` 唯一出口），全名与最终属性都还在悬停里（信息不丢）。
         实测改前：格子 105px，名字吃掉 60px → 两个下拉只剩 31px / 57px。 */
      return '<div class="bt-card' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        '<span class="bt-l1">' +
          '<i class="bt-rnm" title="' + U.escape(ui.btUnitTip(u, side)) + '">'
            + U.escape(GAME.troopAbOf(u.id)) + '</i>' +"""
rep(A3, N3, '名称一字简称')

# ---------- ④ 只读行目标文案（敌军侧）走唯一出口 ----------
A4 = """            : '<span class="bt-ro">' + (u.target === DATA.TARGET_WALL ? '目标：城头箭塔'
              : (u.target ? ('目标：' + U.escape(((foeList.filter(function (x) { return x.id === u.target; })[0] || {}).name || u.target)))
                : '目标：任意')) + '</span>') +"""
N4 = """            : '<span class="bt-ro">' + ui.btTargetLabelOf(u, foeList) + '</span>') +"""
rep(A4, N4, '只读行目标文案')

# 写后哨兵
assert s.count('ui.btTargetLabelOf = function') == 1
# ⚠️ 判据只查**战场侧栏**块（沙盘 sd 面板的同类文案在批 E4 一起改，此处不能全局查）
_i = s.find('ui.btSideHTML = function')
_j = s.find('ui.btBoardHTML = function', _i)
_blk = s[_i:_j]
assert "'>目标：'" not in _blk, '战场侧栏"目标："前缀残留'
assert '目标：任意' not in _blk, '战场侧栏"目标：任意"残留'
assert 'GAME.troopAbOf(u.id)' in s
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ui.js(E1) 落盘 · len=' + str(len(s)))
