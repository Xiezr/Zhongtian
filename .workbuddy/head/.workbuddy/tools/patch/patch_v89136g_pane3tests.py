# -*- coding: utf-8 -*-
# v89.136 批2-b：smoke/e2e 三行同构断言更新（只显示当前值 · 忠诚行 ＋ · 数值定宽）
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

# ============================================================
# smoke
# ============================================================
s = rd('smoke-test.js')

# ① 忠诚行右侧入口（旧：gd-line">忠诚；新：title 形态 + ＋）
old1 = r'''  check('忠诚行右侧就是赏赐按钮（同一行，不是另一个分区）', (function () {
    var seg = codeOf(uiS, 'ui.genPane = function');
    var i = seg.indexOf("'<div class=\"gd-line\">忠诚");
    if (i < 0) return false;
    var line = seg.slice(i, seg.indexOf('</div>', i));
    return /data-action="gen-gift-pick"/.test(line);
  })());'''
new1 = r'''  check('忠诚行右端就是赏赐入口（v89.136：＋ 形态 · 同一行，不是另一个分区）', (function () {
    var seg = codeOf(uiS, 'ui.genPane = function');
    var i = seg.indexOf("'<div class=\"gd-line\" title=\"忠诚");
    if (i < 0) return false;
    var line = seg.slice(i, seg.indexOf('</div>', i));
    return /data-action="gen-gift-pick"/.test(line) && /gd-plus/.test(line);
  })());'''
assert s.count(old1) == 1, '① 锚点 = ' + str(s.count(old1))
s = s.replace(old1, new1)

# ② 君主档案不出忠诚行（gd-line">忠诚 → >忠诚 <b 子串）
old2 = """    return hL.indexOf('gd-line">忠诚') < 0 && hL.indexOf('gen-gift-pick') < 0
      && hN.indexOf('gd-line">忠诚') >= 0 && hN.indexOf('gen-gift-pick') >= 0;"""
new2 = """    return hL.indexOf('>忠诚 <b') < 0 && hL.indexOf('gen-gift-pick') < 0
      && hN.indexOf('>忠诚 <b') >= 0 && hN.indexOf('gen-gift-pick') >= 0;"""
assert s.count(old2) == 1, '② 锚点 = ' + str(s.count(old2))
s = s.replace(old2, new2)

# ③ §114⑦ 体力行（XX/XX → 只显示当前值 + 定宽 + 悬停）
old3 = """    check('§114⑦ 体力行：`体力 当前/上限` + 悬停（全军生命 / 上限构成 / 回复规则）', (function () {
      var g114 = st114.generals[0];
      var h = G.ui.genPane(g114);
      var iS = h.indexOf('体力 <b>');
      if (iS < 0) return false;
      var sS = h.slice(Math.max(0, iS - 320), iS + 220);
      return /体力 <b>[\\d,]+<\\/b>\\/[\\d,]+/.test(sS)     /* 当前/上限 两数连写 */
        && sS.indexOf('gd-hint\\">当前 ') < 0           /* 「当前 5,673」行面备注已撤（title 中的"当前 / 上限"不算） */
        && /全军生命 \\+/.test(sS);                      /* 加成在 title（悬停）里 */
    })());"""
new3 = """    check('§114⑦+§136 体力行：只显示当前值 + 定宽列 + 悬停（当前/上限 / 全军生命 / 回复）', (function () {
      var g114 = st114.generals[0];
      var h = G.ui.genPane(g114);
      var iS = h.indexOf('体力 <b class="gd-num"');
      if (iS < 0) return false;
      var sS = h.slice(Math.max(0, iS - 340), iS + 260);
      return /体力 <b class="gd-num">[\\d,]+<\\/b><div class="gd-bar">/.test(sS)  /* 只显示当前值 + 紧接等长进度条 */
        && /title="体力 [\\d,]+ \\/ [\\d,]+（当前 \\/ 上限）/.test(sS)            /* 当前/上限 进悬停 */
        && /全军生命 \\+/.test(sS);                                            /* 加成保留在悬停 */
    })());
    check('§136 三行同构：体力/精力/忠诚 均为「定宽数值 + 等长进度条 + ＋贴右」', (function () {
      var g136 = st114.generals[0];
      var h136 = G.ui.genPane(g136);
      var has = function (nm) {
        var i = h136.indexOf('>' + nm + ' <b class="gd-num"');
        if (i < 0) return false;
        var seg = h136.slice(i, h136.indexOf('</div>', i));
        return seg.indexOf('<div class="gd-bar"><i style="width:') >= 0
          && /gd-plus/.test(seg);
      };
      return has('体力') && has('精力') && has('忠诚');
    })());"""
assert s.count(old3) == 1, '③ 锚点 = ' + str(s.count(old3))
s = s.replace(old3, new3)

wr('smoke-test.js', s)
print('OK · smoke-test.js', len(s))

# ============================================================
# e2e
# ============================================================
e = rd('e2e-test.js')

# ④ 体力断言（XX/XX → 只显示当前值）
old4 = """    const m2 = txt.match(/体力\\s*([\\d,]+)\\s*\\/\\s*([\\d,]+)/);
    const cur = m2 ? parseInt(m2[1].replace(/,/g, ''), 10) : NaN;
    const cap = m2 ? parseInt(m2[2].replace(/,/g, ''), 10) : NaN;
    const rowTitle = row ? (row.getAttribute('title') || '') : '';
    check('将领页「体力」= 当前/上限 两数连写（v89.133 新口径）',
      cur === nowEq && cap === withEq && withEq > bareMax && nowEq < withEq,
      '当前 ' + nowEq + ' / 上限 ' + withEq + '；页面「' + txt.replace(/\\s+/g, ' ').trim().slice(0, 46) + '」');
    check('将领页「体力」：全军生命 +X% 进悬停；行面不再有「当前 X」备注',
      rowTitle.indexOf('全军生命 +') >= 0 && txt.indexOf('当前 ') < 0,
      'title=「' + rowTitle.replace(/\\s+/g, ' ').trim().slice(0, 40) + '」');"""
new4 = """    const m2 = txt.match(/体力\\s*([\\d,]+)/);
    const cur = m2 ? parseInt(m2[1].replace(/,/g, ''), 10) : NaN;
    const rowTitle = row ? (row.getAttribute('title') || '') : '';
    check('将领页「体力」= 只显示当前值（v89.136 新口径 · 上限进悬停）',
      cur === nowEq && withEq > bareMax && nowEq < withEq
      && rowTitle.indexOf('（当前 / 上限）') >= 0,
      '当前 ' + nowEq + ' / 上限 ' + withEq + '；页面「' + txt.replace(/\\s+/g, ' ').trim().slice(0, 46) + '」');
    check('将领页「体力」：悬停含 全军生命 +X% 与上限构成',
      rowTitle.indexOf('全军生命 +') >= 0 && rowTitle.indexOf('上限 = ') >= 0,
      'title=「' + rowTitle.replace(/\\s+/g, ' ').trim().slice(0, 40) + '」');"""
assert e.count(old4) == 1, '④ 锚点 = ' + str(e.count(old4))
e = e.replace(old4, new4)

# ⑤ 两处忠诚行形态
n5 = e.count("dhL40.indexOf('gd-line\">忠诚')")
assert n5 == 1, '⑤a 锚点 = ' + str(n5)
e = e.replace("dhL40.indexOf('gd-line\">忠诚')", "dhL40.indexOf('>忠诚 <b')")

n6 = e.count("paneN40.innerHTML.indexOf('gd-line\">忠诚')")
assert n6 == 1, '⑤b 锚点 = ' + str(n6)
e = e.replace("paneN40.innerHTML.indexOf('gd-line\">忠诚')", "paneN40.innerHTML.indexOf('>忠诚 <b')")

wr('e2e-test.js', e)
print('OK · e2e-test.js', len(e))
