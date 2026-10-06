# -*- coding: utf-8 -*-
"""v89.201 批次A：侦查报告单页化（去分页 + 四板块 + 编制三栏 + xxl/tall 档）"""
import io, re, os, sys

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

D = 'E:/Deepseekdb/'

def rep(path, tag, old, new, mark, cnt=1):
    """幂等替换：mark（新特征）已在 → skip；否则替换并校验 old 计数"""
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    wr(path, s.replace(old, new)); print('[ok] ' + tag)

# ══════════ A1 · main.js：openScoutResult 区间替换（SCOUT_PAGES 区 → 单页版） ══════════
M = D + 'js/main.js'
s = rd(M)
if '§201-frag' in s or 'sc-troops' in s:
    print('[skip] A1 单页函数')
else:
    start_a = s.index("  ui.SCOUT_PAGES = [")
    end_a = s.index("  /* 兼容旧入口：统一走三方式出征 */", start_a)
    frag = rd(D + '.workbuddy/tmp/frag201_scout.txt')
    s = s[:start_a] + frag + '\n' + s[end_a:]
    wr(M, s)
    print('[ok] A1 单页函数（区间替换）')

# ══════════ A2 · main.js：case 'scout-page' 退役（墓碑） ══════════
A2_OLD = """      /* v65：侦查回报面板分两页（满级六层内容装不进一个弹窗） */
      case 'scout-page':
        if (ui._scoutLast) {
          ui.openScoutResult(ui._scoutLast.target, ui._scoutLast.r,
            Number(el.getAttribute('data-v')) || 0);
        }
        break;
"""
A2_NEW = """      /* ⛔ v89.201（老板 1）：「直接一页显示，不用额外点一个分层」——
         侦查面板分页整体退役：分页 case（scout-page）、页签常量、页号状态、
         翻页锚点（scoutLast）四件一并清掉；面板改**单页四板块**
         （敌情 / 城中虚实 / 可图之利 / 顺手所得，见 ui.openScoutResult 头注）。 */
"""
rep(M, 'A2 scout-page 退役', A2_OLD, A2_NEW, '侦查面板分页整体退役')

# ══════════ A3 · main.js：scout-open 去第三参 ══════════
rep(M, 'A3 scout-open 去参',
    "ui.openScoutResult({ kind: _sr.scout.kind, name: _sr.scout.name }, _sr.scout, 0);",
    "ui.openScoutResult({ kind: _sr.scout.kind, name: _sr.scout.name }, _sr.scout);",
    '}, _sr.scout);')

# ══════════ A4 · main.js：arrive 注释与锚点清理 ══════════
A4_OLD = """       * `ui._scoutLast` 仍留一份（分页面板翻页用），但不再由抵达自动触发。
       * ============================================================ */
      ui._scoutLast = { target: { kind: m.kind, name: m.name }, r: r };
"""
A4_NEW = """       * v89.201：翻页锚点随面板单页化一并退役（不再需要"留一份供翻页"）。
       * ============================================================ */
"""
rep(M, 'A4 arrive 锚点清理', A4_OLD, A4_NEW, '翻页锚点随面板单页化一并退役')

# ══════════ A5 · index.html：.sc-troops 三栏点验网格 CSS ══════════
H = D + 'index.html'
A5_OLD = """  .attr .v.bad { color: var(--red-light); }   /* v89.104：珠宝/材料不足标红 */
"""
A5_NEW = """  .attr .v.bad { color: var(--red-light); }   /* v89.104：珠宝/材料不足标红 */
  /* v89.201（老板 1）：侦查单页化 —— 兵种编制三栏点验网格。
     旧两列表格在 9 兵种时高 375px，是单页装不下时最大的一块；
     三栏后 9 兵种 ~130px、极端 18 兵种 ~230px（实机实测 over=0 的依据）。 */
  .sc-troops { display: grid; grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 0 var(--sp-4); margin: var(--sp-1) 0 var(--sp-2); }
  .sc-trow { display: flex; justify-content: space-between; gap: var(--sp-2);
    padding: var(--sp-1) 0; border-bottom: 1px dashed rgba(var(--gold-rgb),.15);
    font-size: var(--fs-body); }
  .sc-trow .tn { color: var(--text-dim); }
  .sc-trow .tv { font-weight: 700; }
  .sc-trow.sc-total { grid-column: 1 / -1; border-bottom: none; padding-top: var(--sp-2); }
  .sc-trow.sc-total .tn { color: var(--text); }
"""
rep(H, 'A5 .sc-troops CSS', A5_OLD, A5_NEW, '.sc-troops { display: grid')

# ══════════ A6 · smoke：两条分页断言升级为单页四板块 + 零残留 ══════════
S = D + 'smoke-test.js'
A6_OLD = """  check('结构：侦查面板分两页（满级六层装不进一个弹窗）', (function () {
    var panel = code49(mS49, 'ui.openScoutResult = function');
    var pages = (mS49.match(/\\{ id: '(enemy|loot)'/g) || []).length;
    return /ui\\.SCOUT_PAGES = \\[/.test(mS49) && pages === 2
      && /if \\(page === 0\\)/.test(panel) && /data-action="scout-page"/.test(panel);
  })(), '「敌情与缴获」/「虚实与可图之利」');
  check('结构：页签在 main 里有接线（不是孤儿按钮）', (function () {
    return /case 'scout-page'/.test(mS49) && /ui\\._scoutLast/.test(mS49);
  })());"""
A6_NEW = """  check('§201① 侦查面板单页四板块（v89.201 老板「直接一页显示，不用额外点一个分层」）', (function () {
    var panel = code49(mS49, 'ui.openScoutResult = function');
    /* 单页版：四个板块齐备 + xxl/tall 档 + 页签/翻页在函数内零残留（codeOf 已剥注释） */
    return /sealH\\('敌情'/.test(panel) && /sealH\\('城中虚实'/.test(panel)
      && /sealH\\('可图之利'/.test(panel) && /sealH\\('顺手所得'/.test(panel)
      && /size: 'xxl', tall: true/.test(panel)
      && !/SCOUT_PAGES/.test(panel) && !/if \\(page === 0\\)/.test(panel)
      && !/data-action="scout-page"/.test(panel);
  })(), '敌情 / 城中虚实 / 可图之利 / 顺手所得');
  check('§201② 分页机制全撤：main 可执行区零残留（scout-page / 页号 / 页签常量 / 锚点）', (function () {
    var mainC = stripComment(mS49);   /* 剥注释防墓碑命中（§48.4：查可执行形态） */
    return !/case 'scout-page':/.test(mainC) && !/ui\\._scoutPage/.test(mainC)
      && !/ui\\.SCOUT_PAGES/.test(mainC) && !/ui\\._scoutLast/.test(mainC);
  })());
  check('§201③ 编制三栏网格在册（单页装得下的最大块改型）', (function () {
    var panel = code49(mS49, 'ui.openScoutResult = function');
    var css = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    return /sc-troops/.test(panel) && /sc-trow sc-total/.test(panel)
      && /\\.sc-troops \\{ display: grid/.test(css) && /repeat\\(3, minmax\\(0,1fr\\)\\)/.test(css);
  })());"""
rep(S, 'A6 分页断言升级', A6_OLD, A6_NEW, '§201① 侦查面板单页四板块')

print('批次A 完成')
