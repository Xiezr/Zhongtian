# -*- coding: utf-8 -*-
"""v89.147 老板 3 条 —— ui.js 补丁（分段落盘 · 幂等守卫）
   ① 背包装备页：分类栏**一行 4 主类**（状态 / 品质 / 散件 / 全部）· 左侧起
   ② 背包宝物页：分类条左起（原来是 inline-flex 居中）
   ③ 两页行容器同款（.bag-filterrow）→ 排序框同位置
"""
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def save(tag):
    assert '\r\n' not in s, '行尾被写成 CRLF'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag + '  len=' + str(len(s)))

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ---------- ① 装备页筛选：一行 4 主类 ----------
old_fn = """  ui.bagEqChipsHTML = function () {
    var f = ui._bagEq || {};
    var all = ui.bagEquipEntries();
    var setsIn = [];
    all.forEach(function (e) {
      var sid = (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set;
      if (sid && setsIn.indexOf(sid) < 0) setsIn.push(sid);
    });
    function chip(k, v, label, n, on) {
      return '<span class="chip' + (on ? ' on' : '') + '" data-action="bag-eq-f" data-k="' + k +
        '" data-v="' + v + '">' + label + ' <i>' + n + '</i></span>';
    }
    var cnt = function (pred) { return all.filter(pred).length; };
    var qsIn = [1, 2, 3, 4].filter(function (q) {
      return all.some(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; });
    });
    var row1 = chip('cls', 'all', '全部', all.length, f.cls === 'all') +
      chip('cls', 'set', '套装', cnt(function (e) { return !!(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'set') +
      chip('cls', 'solo', '散件', cnt(function (e) { return !(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'solo') +
      (f.cls === 'set' && setsIn.length
        ? setsIn.map(function (sid) {
            return chip('set', sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
              cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set === sid; }), f.set === sid);
          }).join('') : '');
    var row2 = '<span class="lb">状态</span>' +
      chip('state', 'all', '全部', all.length, f.state === 'all') +
      chip('state', 'free', '未穿戴', cnt(function (e) { return !e.wornBy; }), f.state === 'free') +
      chip('state', 'worn', '已穿戴', cnt(function (e) { return !!e.wornBy; }), f.state === 'worn') +
      '<span class="lb" style="margin-left:var(--sp-4);">品质</span>' +
      chip('q', 'all', '全部', all.length, f.q === 'all') +
      qsIn.map(function (q) {
        return chip('q', q, DATA.Q_NAME[q] || ('Q' + q),
          cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; }), Number(f.q) === q);
      }).join('');
    return '<div class="chips chips-xs" style="justify-content:center;margin-bottom:4px;">' + row1 + '</div>' +
      '<div class="chips chips-xs" style="justify-content:center;margin-bottom:6px;">' + row2 + '</div>';
  };"""

new_fn = """  /* ============================================================
   * v89.147（老板 1）：「背包，装备界面，**上边分类栏保持在一行，位于界面左侧**，
   *   状态，品质，散件，全部这 4 个作为**主类**，依次往右排列」
   * ------------------------------------------------------------
   * 原来 = **两排居中**（row1 类别 / row2「状态」+「品质」标签+选项）——
   * 现在合并为**一行 4 组、左侧起**：
   *   ① 状态（全部 / 未穿戴 / 已穿戴）
   *   ② 品质（全部 / Q1…，按持有情况列）
   *   ③ 散件（全部 / 套装 / 散件 + 选中「套装」时追加套名细化）
   *   ④ 全部（一键把三个维度还原 —— 激活态 = 当前即"全默认"）
   * 行容器 `.chips.bag-filterrow`（块级占满 + 左起 + 不换行）——与宝物页同款，
   *   两页行高一致（排序框同位置）。
   * ============================================================ */
  ui.bagEqChipsHTML = function () {
    var f = ui._bagEq || {};
    var all = ui.bagEquipEntries();
    var setsIn = [];
    all.forEach(function (e) {
      var sid = (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set;
      if (sid && setsIn.indexOf(sid) < 0) setsIn.push(sid);
    });
    function chip(k, v, label, n, on) {
      return '<span class="chip' + (on ? ' on' : '') + '" data-action="bag-eq-f" data-k="' + k +
        '" data-v="' + v + '">' + label + ' <i>' + n + '</i></span>';
    }
    var cnt = function (pred) { return all.filter(pred).length; };
    var qsIn = [1, 2, 3, 4].filter(function (q) {
      return all.some(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; });
    });
    /* 第 4 主类「全部」的激活态 = 三个维度都处于"全部"（即当前显示的就是全部装备） */
    var isAll = (f.state === 'all' || !f.state) && (f.q === 'all' || f.q == null)
      && (f.cls === 'all' || !f.cls);
    return '<div class="chips chips-xs bag-filterrow">' +
      '<span class="lb">状态</span>' +
      chip('state', 'all', '全部', all.length, f.state === 'all' || !f.state) +
      chip('state', 'free', '未穿戴', cnt(function (e) { return !e.wornBy; }), f.state === 'free') +
      chip('state', 'worn', '已穿戴', cnt(function (e) { return !!e.wornBy; }), f.state === 'worn') +
      '<span class="lb">品质</span>' +
      chip('q', 'all', '全部', all.length, f.q === 'all' || f.q == null) +
      qsIn.map(function (q) {
        return chip('q', q, DATA.Q_NAME[q] || ('Q' + q),
          cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; }), Number(f.q) === q);
      }).join('') +
      '<span class="lb">散件</span>' +
      chip('cls', 'all', '全部', all.length, f.cls === 'all' || !f.cls) +
      chip('cls', 'set', '套装', cnt(function (e) { return !!(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'set') +
      chip('cls', 'solo', '散件', cnt(function (e) { return !(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'solo') +
      (f.cls === 'set' && setsIn.length
        ? setsIn.map(function (sid) {
            return chip('set', sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
              cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set === sid; }), f.set === sid);
          }).join('') : '') +
      chip('reset', 'all', '全部', all.length, isAll) +
      '</div>';
  };"""

rep(old_fn, new_fn,
    '①-1 装备页一行 4 主类',
    done_when='data-k="reset" data-v="all"')

# ---------- ① setBagEqFilter 支持 reset ----------
rep(
"""  ui.setBagEqFilter = function (k, v) {
    ui._bagEq = ui._bagEq || {};
    if (k === 'q') ui._bagEq.q = (v === 'all') ? 'all' : Number(v);
    else ui._bagEq[k] = v;
    if (k === 'cls' && v !== 'set') ui._bagEq.set = '';
    ui._pages['bag-equip'] = 1;                  /* 换筛选回第一页（分页键 = bag-equip） */
    ui.renderBag();
  };""",
"""  ui.setBagEqFilter = function (k, v) {
    ui._bagEq = ui._bagEq || {};
    /* v89.147（老板 1）：第 4 主类「全部」= 一键把三个维度还原（state/q/cls → all）。
       v89.147 前这里不接受 'reset'（会把它当普通键存进 _bagEq）—— 现在显式分支。 */
    if (k === 'reset') {
      ui._bagEq = { cls: 'all', set: '', state: 'all', q: 'all' };
    } else if (k === 'q') {
      ui._bagEq.q = (v === 'all') ? 'all' : Number(v);
    } else {
      ui._bagEq[k] = v;
    }
    if (k === 'cls' && v !== 'set') ui._bagEq.set = '';
    ui._pages['bag-equip'] = 1;                  /* 换筛选回第一页（分页键 = bag-equip） */
    ui.renderBag();
  };""",
    '①-2 reset 分支',
    done_when="if (k === 'reset') {")

# ---------- ② 宝物页分类条：左起（同款行容器） ----------
rep(
"""    return '<div class="chips chips-xs" style="justify-content:center;margin-bottom:6px;">' +
      list.map(function (x) {""",
"""    /* v89.147（老板 2）：分类条从**界面左侧**开始（原来 inline-flex 居中）——
       行容器与装备页同款（.bag-filterrow：块级占满 + 左起 + 不换行）→ 两页排序框同位置。 */
    return '<div class="chips chips-xs bag-filterrow">' +
      list.map(function (x) {""",
    '②-1 宝物页左起',
    done_when="class=\"chips chips-xs bag-filterrow\">' +\n      list.map")

save('ui.js 全部')
print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))
