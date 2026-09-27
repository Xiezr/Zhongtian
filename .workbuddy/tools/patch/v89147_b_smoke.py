# -*- coding: utf-8 -*-
"""v89.147 —— smoke：更新 §97⑤ 名字 + 新增 §127 门禁节"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ---------- §97⑤ 名字更新（三排 → 一行 4 主类） ----------
rep(
"""    check('⑤ 三排筛选（类别/状态/品质）+ 唯一状态出口 ui._bagEq / setBagEqFilter', (function () {""",
"""    check('⑤/§147 装备页筛选（v89.147：一行 4 主类 状态/品质/散件/全部）+ 唯一状态出口 ui._bagEq / setBagEqFilter', (function () {""",
    '§97⑤ 名字更新',
    done_when='v89.147：一行 4 主类')

# ---------- §127 新增 ----------
ANCHOR = """    check('§126② 需求档案在册（v89.146 · 4 行均分 / 留空 / 巨卡修正）', (function () {
      var a = fs126.readFileSync(p126.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.146') >= 0
        && a.indexOf('4 行均分') >= 0
        && a.indexOf('留空') >= 0;
    })());
  })();
"""
assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))

SECTION = """    check('§126② 需求档案在册（v89.146 · 4 行均分 / 留空 / 巨卡修正）', (function () {
      var a = fs126.readFileSync(p126.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.146') >= 0
        && a.indexOf('4 行均分') >= 0
        && a.indexOf('留空') >= 0;
    })());
  })();

  /* ═══════════════════════════════════════════════════════════
   * §127（v89.147）：老板 3 条 —— 装备页分类栏**一行 4 主类 · 左起** /
   *   宝物页分类条左起 / 两页排序框**同一位置**（行高一致）
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs127 = require('fs'), p127 = require('path');
    var uS127 = fs127.readFileSync(p127.join(__dirname, 'js', 'ui.js'), 'utf8');
    var strip127 = function (x) { return x.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''); };
    var u127 = strip127(uS127);
    var m127 = strip127(fs127.readFileSync(p127.join(__dirname, 'js', 'main.js'), 'utf8'));
    var h127 = fs127.readFileSync(p127.join(__dirname, 'index.html'), 'utf8');

    /* ---- ① 装备页：一行 4 主类（状态/品质/散件/全部）· 左起 ---- */
    check('§127① 装备页分类栏 = **一行 4 主类**（状态 / 品质 / 散件 / 全部）· 左侧起', (function () {
      var h = G.ui.bagEqChipsHTML();
      var nRow = (h.match(/class="chips chips-xs bag-filterrow"/g) || []).length;
      /* 4 个主类按老板点名的顺序（状态 → 品质 → 散件 → 全部）依次出现 */
      var iState = h.indexOf('>状态<'), iQ = h.indexOf('>品质<'), iSolo = h.indexOf('>散件<');
      var iReset = h.indexOf('data-k="reset"');
      var okOrder = iState >= 0 && iState < iQ && iQ < iSolo && iSolo < iReset;
      var okNoOld = !/justify-content:center/.test(h)                    /* 不再居中 */
        && (h.match(/chips-xs/g) || []).length === 1;                    /* 只有一行 */
      return nRow === 1 && okOrder && okNoOld
        && h.indexOf('data-k="state"') >= 0 && h.indexOf('data-k="q"') >= 0
        && h.indexOf('data-k="cls"') >= 0;
    })());

    /* ---- ① 「全部」主类 = 一键重置（真调） ---- */
    check('§127① 第 4 主类「全部」真调：三维度一键还原（reset 分支）', (function () {
      var bak = G.ui._bagEq;
      try {
        G.ui._bagEq = { cls: 'solo', set: '', state: 'worn', q: 3 };
        G.ui.setBagEqFilter('reset', 'all');
        var ok = G.ui._bagEq.cls === 'all' && G.ui._bagEq.state === 'all'
          && G.ui._bagEq.q === 'all' && !G.ui._bagEq.set;
        var h = G.ui.bagEqChipsHTML();
        return ok && /data-k="reset"[^>]*class="chip on"|class="chip on"[^>]*data-k="reset"/.test(h.replace(/<i>\\d+<\\/i>/g, ''));
      } finally { G.ui._bagEq = bak; }
    })());

    /* ---- ② 宝物页：分类条左起（同款行容器） ---- */
    check('§127② 宝物页分类条 = 同款 bag-filterrow（左起 · 不再居中）', (function () {
      var h = G.ui.bagSubChipsHTML();
      return /class="chips chips-xs bag-filterrow"/.test(h)
        && h.indexOf('justify-content:center') < 0
        && /data-action="bag-sub"/.test(h);
    })());

    /* ---- ③ 两页行高一致（排序框同位置）---- */
    check('§127③ 两页分类行同款 + 固定行高（排序框落同一位置）· 单一 CSS 出口', (function () {
      return /\\.chips\\.bag-filterrow \\{ display: flex; width: 100%; justify-content: flex-start;/.test(h127)
        && /flex-wrap: nowrap; overflow-x: auto; align-items: center;/.test(h127)
        && /min-height: 32px; margin-bottom: 4px; \\}/.test(h127)
        /* 两页渲染都挂同一个类（结构层保证同高） */
        && /class="chips chips-xs bag-filterrow"/.test(u127)
        && (u127.match(/bag-filterrow/g) || []).length >= 2;
    })());

    /* ---- ④ 档案在册 ---- */
    check('§127④ 需求档案在册（v89.147 · 一行 4 主类 / 左侧 / 排序框同一位置）', (function () {
      var a = fs127.readFileSync(p127.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.147') >= 0
        && a.indexOf('一行 4 主类') >= 0
        && a.indexOf('排序框') >= 0;
    })());
  })();
"""

s = s.replace(ANCHOR, SECTION)
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('§127 inserted · len ' + str(orig_len) + ' -> ' + str(len(s)))
