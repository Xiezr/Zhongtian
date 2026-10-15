# -*- coding: utf-8 -*-
"""v89.146 —— smoke：§125④ CSS 串更新 + 新增 §126（行高 = 按 4 行均分口径）"""
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

# ---------- §125④ CSS 串更新 ----------
rep(
r"""    check('§125④ 商城物品区**内部滚动**（分类条/标题不动 · 窗口矮时只有它滚）',
      /\.ui-page\.shop-page \.shop-rows\.shop-fill \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/.test(h125)
      && /scrollbar-gutter: stable; align-content: stretch; grid-auto-rows: minmax\(116px, 1fr\); \}/.test(h125));""",
r"""    check('§125④ 商城物品区**内部滚动**（分类条/标题不动 · 窗口矮时只有它滚）+ 行高 = 按 4 行均分（v89.146 修正）',
      /\.ui-page\.shop-page \.shop-rows\.shop-fill \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/.test(h125)
      && /align-content: start;/.test(h125)
      && /grid-auto-rows: minmax\(116px, calc\(\(100% - var\(--sp-3\) \* 3\) \/ 4\)\);/.test(h125)
      /* ⛔ v89.146：旧口径（按现有行拉满）不得复活 */
      && !/align-content: stretch; grid-auto-rows: minmax\(116px, 1fr\)/.test(h125));""",
    '§125④ CSS 串更新',
    done_when='行高 = 按 4 行均分（v89.146 修正）')

# ---------- §126 新增 ----------
ANCHOR = """    /* ---- ⑤ 档案在册 ---- */
    check('§125⑤ 需求档案在册（v89.145 · 撑满 / 不要「最多」/ 冻结）', (function () {
      var a = fs125.readFileSync(p125.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.145') >= 0
        && a.indexOf('撑满') >= 0
        && a.indexOf('最多') >= 0
        && a.indexOf('冻结') >= 0;
    })());
  })();
"""
assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))

SECTION = """    /* ---- ⑤ 档案在册 ---- */
    check('§125⑤ 需求档案在册（v89.145 · 撑满 / 不要「最多」/ 冻结）', (function () {
      var a = fs125.readFileSync(p125.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.145') >= 0
        && a.indexOf('撑满') >= 0
        && a.indexOf('最多') >= 0
        && a.indexOf('冻结') >= 0;
    })());
  })();

  /* ═══════════════════════════════════════════════════════════
   * §126（v89.146）：撑满口径修正 —— **行高 = "按 4 行均分"**（不足 4 行留空），
   *   不是"把现有行拉满"（老板：经验/体力这种数量不足的页码，
   *   是让你按 4 行均分高度的方式填满界面，不是当个商品高度拉满）
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs126 = require('fs'), p126 = require('path');
    var h126 = fs126.readFileSync(p126.join(__dirname, 'index.html'), 'utf8');

    check('§126① 商城行高 = `calc((100% - 行距×3) / 4)`（按 4 行均分）：4 行铺满 · 不足 4 行行高不变、下方留空', (function () {
      return /grid-auto-rows: minmax\\(116px, calc\\(\\(100% - var\\(--sp-3\\) \\* 3\\) \\/ 4\\)\\);/.test(h126)
        && /align-content: start;/.test(h126)
        && /v89\\.146（口径修正）/.test(h126)
        && /不是当个商品高度拉满\\.没有商品的空间留空即可/.test(h126);
    })());

    check('§126② 需求档案在册（v89.146 · 4 行均分 / 留空 / 巨卡修正）', (function () {
      var a = fs126.readFileSync(p126.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.146') >= 0
        && a.indexOf('4 行均分') >= 0
        && a.indexOf('留空') >= 0;
    })());
  })();
"""

s = s.replace(ANCHOR, SECTION)
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('§126 inserted · len ' + str(orig_len) + ' -> ' + str(len(s)))
