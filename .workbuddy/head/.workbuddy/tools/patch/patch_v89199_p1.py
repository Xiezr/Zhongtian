# -*- coding: utf-8 -*-
"""v89.199 批次 P1：自动征兵「整页逐渐放大」布局根因修复
   ① index.html：.view-box 横向滚动兜底 / .auto-grid minmax(0,·) / .auto-pane min-width:0
      / 新增 .res-line.wrap-ok 换行许可
   ② js/ui.js：autoTrainHTML 两个 res-line 挂 wrap-ok（城市行 + 触发记录行）
"""
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, path, old, new, guard):
    s = rd(path)
    if s.count(guard) >= 1:
        print('[skip] ' + tag + '（guard 命中，已落）'); return
    c = s.count(old)
    assert c == 1, tag + ' anchor count=' + str(c)
    wr(path, s.replace(old, new, 1))
    print('[ok] ' + tag)

H = 'E:/Deepseekdb/index.html'
U = 'E:/Deepseekdb/js/ui.js'

# ── A1 .view-box 横向滚动兜底 ──
rep('A1 view-box overflow-x', H,
    u"  .view-box { flex: 1; min-height: 0; overflow-y: auto; scrollbar-gutter: stable; }",
    u"""  /* v89.199（老板 2）：「整个页面逐渐放大」的**全站兜底** —— 横向溢出内容
     （如逐项累积的长文本行）此前会把 .view-box / .ui-page 一路**撑宽**
     （实测 1408 → 2383px，连锁把整页布局撑变形）。这里让它成为"横向滚动容器"：
     内容超宽时内部滚动，不再撑破祖先（视图页允许滚动 —— 同既有口径；
     正常宽度时零影响）。 */
  .view-box { flex: 1; min-height: 0; overflow-y: auto; overflow-x: auto; scrollbar-gutter: stable; }""",
    u"overflow-x: auto; scrollbar-gutter: stable; }")

# ── A2 .auto-grid 轨道 minmax(0,·) ──
rep('A2 auto-grid minmax', H,
    u"  .auto-grid { display: grid; grid-template-columns: 1fr 2fr; gap: var(--sp-mid); align-items: start; }",
    u"""  /* v89.199（老板 2）：1fr/2fr 会被列的 min-content 撑开（v89.132 老坑）——
     自动征兵面板「待补」清单逐项累积后把右列撑爆、连锁撑宽整页。
     minmax(0,·) 锁住轨道比例（与 .res-line.wrap-ok 的换行许可**成对**生效）。 */
  .auto-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: var(--sp-mid); align-items: start; }""",
    u"minmax(0, 1fr) minmax(0, 2fr)")

# ── A3 .auto-pane min-width:0（grid 项防撑） ──
rep('A3 auto-pane min-width', H,
    u"""  .auto-pane { border: 1px solid var(--gold-dark); border-radius: var(--r-lg);
    padding: var(--sp-mid); background: rgba(var(--sh-rgb),.2); min-height: 260px; }""",
    u"""  .auto-pane { border: 1px solid var(--gold-dark); border-radius: var(--r-lg);
    padding: var(--sp-mid); background: rgba(var(--sh-rgb),.2); min-height: 260px; min-width: 0; }""",
    u"min-height: 260px; min-width: 0; }")

# ── A4 新增 .res-line.wrap-ok（插在 .auto-state 之后） ──
rep('A4 wrap-ok 规则', H,
    u"""    font-size: var(--fs-sub); color: var(--text-dim); }
  /* ============ 自动化 · 左右分栏（v89.115 · 老板令） ============""",
    u"""    font-size: var(--fs-sub); color: var(--text-dim); }
  /* v89.199（老板 2）：**换行许可修饰类** —— 「待补」清单这类**随操作累积变长**的
     .res-line（每个参与的兵种追加一项），默认 .res-line .val 是 white-space:nowrap，
     内容超宽会把行的 min-content 撑到上千 px、经由 grid 列一路撑宽整页（实测
     1408 → 2383px）。加 .wrap-ok 后允许折行；正常宽度下不折 → 视觉零变化。 */
  .res-line.wrap-ok { flex-wrap: wrap; align-items: flex-start; }
  .res-line.wrap-ok .val { display: inline; white-space: normal; overflow-wrap: anywhere; }
  /* ============ 自动化 · 左右分栏（v89.115 · 老板令） ============""",
    u".res-line.wrap-ok .val { display: inline;")

# ── B1 cityLines（各城栏位与缺口）挂 wrap-ok ──
rep('B1 cityLines wrap-ok', U,
    u"""      return '<div class="res-line"><span class="lbl">' + U.escape(c0.name) + '</span><span class="val">' + slotTxt +""",
    u"""      /* v89.199（老板 2）：「待补」清单逐项累积（每个参与的兵种一项）——wrap-ok =
         换行许可；不加时 nowrap 会把本行撑到上千 px、连锁撑宽整页（实测 1408→2383）。 */
      return '<div class="res-line wrap-ok"><span class="lbl">' + U.escape(c0.name) + '</span><span class="val">' + slotTxt +""",
    u"res-line wrap-ok\"><span class=\"lbl\">' + U.escape(c0.name)")

# ── B2 logRows（触发记录）挂 wrap-ok ──
rep('B2 logRows wrap-ok', U,
    u"""      return '<div class="res-line"><span class="lbl">🕒 ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) +
        '</span><span class="val">' + U.escape(r.city || '') + '　' + U.escape(r.troop || '') +""",
    u"""      return '<div class="res-line wrap-ok"><span class="lbl">🕒 ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) +
        '</span><span class="val">' + U.escape(r.city || '') + '　' + U.escape(r.troop || '') +""",
    u"res-line wrap-ok\"><span class=\"lbl\">🕒")

print('批次 P1 完成')
