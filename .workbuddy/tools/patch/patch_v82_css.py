# -*- coding: utf-8 -*-
"""v82 · 字体统一（老板④）：各级标题 / 文字 / 备注的格式（族）、大小（七档）、粗细（三档）。

- 共享规则：L2 标题族补 .q-det-title；分区标题族补五处漏网（.q-det-sec/.gp-sec/.fsn-t/
  .op-zone-t/.ledger-sec/.seal-h）；新增备注族共享规则（12px/400/dim/1.65）。
- 字重三档化：500→400、600→700、900→800（全站只剩 400/700/800）。
- 同名重复定义合并（.inn-avatar ×2、.ia.q1-4 ×2）。
- 新增 .city-title / .city-sub（官府面板城名行，v82 ②）。
"""
import io
import sys

HTML = r'E:\Deepseekdb\index.html'


def patch(old, new, tag):
    t = io.open(HTML, encoding='utf-8', newline='').read()
    if new and new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(HTML, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== C1. L2 标题族：补 .q-det-title（含源头瘦身）==')
patch(
"""  .gold-heading {
    text-align: center;
    color: var(--gold-light);
    font-weight: 800;
    font-size: var(--fs-h2);
    letter-spacing: 1px;
    padding: var(--sp-1) 0 var(--sp-4);
    text-shadow: 0 2px 4px rgba(var(--sh-rgb),.6);
    background:
      linear-gradient(90deg, transparent, var(--sep-gold), transparent);
  }""",
"""  .gold-heading {
    /* v82：字号/字重/字距/影由文末「标题外观共享」统一供给（同层级一处定义） */
    text-align: center;
    color: var(--gold-light);
    padding: var(--sp-1) 0 var(--sp-4);
    background:
      linear-gradient(90deg, transparent, var(--sep-gold), transparent);
  }

  /* v82（老板）：「城市名称居中，字体稍大即可」—— 官府面板的城名行
     （档位括注 / 「本城」标签 / 原名标注全撤，只留居中放大的城名）。 */
  .city-title { text-align: center; font-size: var(--fs-h2); font-weight: 800;
    color: var(--gold-light); letter-spacing: 1px; padding: 2px 0 4px; }
  .city-sub { display: flex; justify-content: center; align-items: center; gap: 8px;
    padding-bottom: 8px; }""",
'C1a gold-heading 瘦身 + city-title 新增')

patch(
"""  .q-det-title { font-size: var(--fs-h2); font-weight: 800; color: var(--gold-light); }""",
"""  .q-det-title { color: var(--gold-light); }   /* v82：字号/字重走文末「标题外观共享」 */""",
'C1b q-det-title 瘦身')

print()
print('== C2. 分区标题族：补五处漏网 ==')
patch(
"""  /* 三层界面的分区小标题同样只有一处定义 */
  .q-sec-t, .bag-sec, .gd-sec, .forge-q, .m-sec, .side-title, .wb-t {
    font-size: var(--fs-h3);
    font-weight: 800;
    color: var(--gold-light);
    letter-spacing: .5px;
  }""",
"""  /* 三层界面的分区小标题同样只有一处定义；
     v82（老板「统一各级标题」）：把漏网的六处收进来 —— 任务详情 .q-det-sec /
     将领档案 .gp-sec / 时装 .fsn-t / 操作分区 .op-zone-t（原 12px 灰字）/
     史册 .ledger-sec / 简牍 .seal-h —— 全站分区标题同规格（13px / 800 / 金色 / 字距 .5px）。 */
  .q-sec-t, .q-det-sec, .bag-sec, .gd-sec, .forge-q, .m-sec, .side-title, .wb-t,
  .gp-sec, .fsn-t, .op-zone-t, .ledger-sec, .seal-h {
    font-size: var(--fs-h3);
    font-weight: 800;
    color: var(--gold-light);
    letter-spacing: .5px;
  }""",
'C2a 分区族扩员')

patch(
"""  .side-title {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 10px; font-size: var(--fs-h3); font-weight: 700; letter-spacing: 1px;
    color: var(--gold-light);
    background: linear-gradient(90deg, rgba(201,162,75,.18), transparent);
  }""",
"""  .side-title {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 10px;
    color: var(--gold-light);
    background: linear-gradient(90deg, rgba(201,162,75,.18), transparent);
  }""",
'C2b side-title 瘦身')

patch(
"""  .q-sec-t { font-size: var(--fs-h3); font-weight: 800; color: var(--gold-light); letter-spacing: 1px; }""",
"""  .q-sec-t { color: var(--gold-light); }   /* v82：字号/字重/字距走分区标题共享 */""",
'C2c q-sec-t 瘦身')

patch(
"""  .bag-sec { display: flex; align-items: center; gap: 10px; margin: 12px 0 8px; padding-bottom: 4px;
    border-bottom: 1px solid var(--sep-gold); font-size: var(--fs-h3); font-weight: 800; color: var(--gold-light); }""",
"""  .bag-sec { display: flex; align-items: center; gap: 10px; margin: 12px 0 8px; padding-bottom: 4px;
    border-bottom: 1px solid var(--sep-gold); color: var(--gold-light); }""",
'C2d bag-sec 瘦身')

patch(
"""  .m-sec { color: var(--gold-light); font-weight: 700; font-size: var(--fs-h3); margin: 12px 0 6px; }""",
"""  .m-sec { color: var(--gold-light); margin: 12px 0 6px; }   /* v82：字号/字重走分区标题共享 */""",
'C2e m-sec 瘦身')

patch(
"""  .gd-sec {
    color: var(--gold-light); font-size: var(--fs-h3); font-weight: 700; letter-spacing: 1px;
    margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 1px dashed var(--line-strong);
  }""",
"""  .gd-sec {
    color: var(--gold-light);
    margin: 12px 0 6px; padding-bottom: 4px; border-bottom: 1px dashed var(--line-strong);
  }""",
'C2f gd-sec 瘦身')

patch(
"""  .gp-sec { margin-top: 12px; padding-bottom: 4px; font-size: var(--fs-h3); font-weight: 700;
    color: var(--gold-light); letter-spacing: 1px; border-bottom: 1px solid var(--sep-gold); }""",
"""  .gp-sec { margin-top: 12px; padding-bottom: 4px;
    color: var(--gold-light); border-bottom: 1px solid var(--sep-gold); }""",
'C2g gp-sec 瘦身')

patch(
"""  .fsn-t { font-size: var(--fs-h3); font-weight: 800; color: var(--gold-light); margin-bottom: 6px; }""",
"""  .fsn-t { color: var(--gold-light); margin-bottom: 6px; }   /* v82：字号/字重走分区标题共享 */""",
'C2h fsn-t 瘦身')

patch(
"""  .op-zone-t { color: var(--text-dim); font-size: var(--fs-sub); letter-spacing: 1px; margin-bottom: 8px; }""",
"""  .op-zone-t { margin-bottom: 8px; }   /* v82：字色/字号/字距走分区标题共享（原 12px 灰字） */""",
'C2i op-zone-t 瘦身')

patch(
"""  .ledger-sec { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px;
    margin: 10px 0 2px; font-size: var(--fs-sub); letter-spacing: 2px; color: var(--gold-light); font-weight: 700; }""",
"""  .ledger-sec { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px;
    margin: 10px 0 2px; color: var(--gold-light); }""",
'C2j ledger-sec 瘦身')

patch(
"""  .seal-h {
    display: flex; align-items: center; gap: 7px; margin: 16px 0 8px;
    font-size: var(--fs-h3); font-weight: 800; color: var(--gold-light); letter-spacing: 1px;
  }""",
"""  .seal-h {
    display: flex; align-items: center; gap: 7px; margin: 16px 0 8px;
    color: var(--gold-light);
  }""",
'C2k seal-h 瘦身')

patch(
"""  .q-det-sec { font-size: var(--fs-h3); font-weight: 800; color: var(--gold-light);
    margin: 12px 0 5px; letter-spacing: 1px; }""",
"""  .q-det-sec { color: var(--gold-light); margin: 12px 0 5px; }   /* v82：字号/字重/字距走分区标题共享 */""",
'C2l q-det-sec 瘦身')

patch(
"""  .wounded-box .wb-t {
    font-size: var(--fs-h3); font-weight: 800; color: var(--gold-light); letter-spacing: .5px;
  }""",
"""  .wounded-box .wb-t { color: var(--gold-light); }   /* v82：字号/字重/字距走分区标题共享 */""",
'C2m wb-t 瘦身')

print()
print('== C3. 字重三档化（500→400 / 600→700 / 900→800）==')
patch("border-radius: 3px; font-size: var(--fs-body); font-weight: 900; cursor: pointer;",
      "border-radius: 3px; font-size: var(--fs-body); font-weight: 800; cursor: pointer;",
      'C3a plus-btn 900→800')
patch(".res-line .val .num-frac { font-size: var(--fs-cap); font-weight: 500; color: var(--text-dim); letter-spacing: .3px; }",
      ".res-line .val .num-frac { font-size: var(--fs-cap); font-weight: 400; color: var(--text-dim); letter-spacing: .3px; }",
      'C3b num-frac 500→400')
patch(".res-line .val .num-rate { font-size: var(--fs-cap); font-weight: 600; color: var(--green-ok); }",
      ".res-line .val .num-rate { font-size: var(--fs-cap); font-weight: 700; color: var(--green-ok); }",
      'C3c num-rate 600→700')
patch(".res-line .val .item-badge { color: var(--gold-light); font-size: var(--fs-cap); font-weight: 600; }",
      ".res-line .val .item-badge { color: var(--gold-light); font-size: var(--fs-cap); font-weight: 700; }",
      'C3d item-badge 600→700')
patch(".res-line .val .cap { color: var(--text-dim); font-size: var(--fs-cap); font-weight: 500; }",
      ".res-line .val .cap { color: var(--text-dim); font-size: var(--fs-cap); font-weight: 400; }",
      'C3e val.cap 500→400')
patch(".store-row .cap { color: var(--text-dim); font-size: var(--fs-cap); font-weight: 500; }",
      ".store-row .cap { color: var(--text-dim); font-size: var(--fs-cap); font-weight: 400; }",
      'C3f store cap 500→400')
patch(".q-log-t { color: var(--text); font-weight: 600; }",
      ".q-log-t { color: var(--text); font-weight: 700; }",
      'C3g q-log-t 600→700')
patch("    font-size: var(--fs-cap); font-weight: 600; line-height: 1.5;",
      "    font-size: var(--fs-cap); font-weight: 700; line-height: 1.5;",
      'C3h tile-label 600→700')
patch("    font-style: normal; font-size: var(--fs-cap); font-weight: 600;",
      "    font-style: normal; font-size: var(--fs-cap); font-weight: 700;",
      'C3i amt-u 600→700')

print()
print('== C4. 备注族：一处定义 ==')
patch(
"""  .note b { color: var(--parchment); font-weight: 700; }""",
"""  .note b { color: var(--parchment); font-weight: 700; }
  /* v82（老板「统一各级标题，文字，备注」）：
     备注族一处定义 —— 说明 / 空态 / 提示类文字统一 12px · 常规字重 · 次要色 · 行高 1.65。 */
  .note, .ui-sub, .nt-info, .op-hint, .m-sub, .gb-empty, .q-empty,
  .gd-hint, .farm-sub, .auto-note, .create-save-note {
    font-size: var(--fs-sub);
    color: var(--text-dim);
    line-height: 1.65;
  }""",
'C4a 备注族共享规则')
patch("""  .note {
    font-size: var(--fs-sub);
    color: var(--text-dim);
    line-height: 1.75;""",
"""  .note {
    font-size: var(--fs-sub);
    color: var(--text-dim);""",
'C4b note 去行高')
patch("  .ui-sub { font-size: var(--fs-sub); color: var(--text-dim); line-height: 1.6; }",
      "  .ui-sub { font-size: var(--fs-sub); color: var(--text-dim); }",
      'C4c ui-sub 去行高')
patch("  .nt-info { font-size: var(--fs-sub); color: var(--text-dim); line-height: 1.6; }",
      "  .nt-info { font-size: var(--fs-sub); color: var(--text-dim); }",
      'C4d nt-info 去行高')
patch("""  .m-sub { display: block; text-align: center; color: var(--text-dim); font-size: var(--fs-sub);
    margin-top: 4px; line-height: 1.6; }""",
"""  .m-sub { display: block; text-align: center; color: var(--text-dim); font-size: var(--fs-sub);
    margin-top: 4px; }""",
'C4e m-sub 去行高')
patch("  .create-save-note { text-align: center; font-size: var(--fs-sub); color: var(--text-dim); margin-top: 10px; line-height: 1.8; }",
      "  .create-save-note { text-align: center; font-size: var(--fs-sub); color: var(--text-dim); margin-top: 10px; }",
      'C4f create-save-note 去行高')
patch("  .auto-note { color: var(--text-dim); font-size: var(--fs-sub); line-height: 1.7; margin-top: 8px; }",
      "  .auto-note { color: var(--text-dim); font-size: var(--fs-sub); margin-top: 8px; }",
      'C4g auto-note 去行高')

print()
print('== C5. 同名重复定义合并 ==')
patch("  .inn-avatar { font-size: 20px; width: 28px; text-align: center; }\n", "", 'C5a inn-avatar 旧条退役')
patch("  .inn-avatar { width: 28px; display: flex; align-items: center; justify-content: center; }",
      "  .inn-avatar { font-size: 20px; width: 28px; display: flex; align-items: center; justify-content: center; }   /* v82：两条同名规则合并为一 */",
      'C5b inn-avatar 合并')
patch(
"""  .ia.q1 { border-color: var(--q1); }
  .ia.q2 { border-color: var(--q2); }
  .ia.q3 { border-color: var(--q3); }
  .ia.q4 { border-color: var(--q4); }
  .ia.q1 { background: linear-gradient(180deg, rgba(154,154,140,.16), #1a1d24); }
  .ia.q2 { background: linear-gradient(180deg, rgba(90,160,110,.20), #1a1d24); }
  .ia.q3 { background: linear-gradient(180deg, rgba(74,140,200,.22), #1a1d24); }
  .ia.q4 { background: linear-gradient(180deg, rgba(190,140,60,.26), #1a1d24); }""",
"""  /* v82：同名两条规则合并（描边 + 底色各归一处） */
  .ia.q1 { border-color: var(--q1); background: linear-gradient(180deg, rgba(154,154,140,.16), #1a1d24); }
  .ia.q2 { border-color: var(--q2); background: linear-gradient(180deg, rgba(90,160,110,.20), #1a1d24); }
  .ia.q3 { border-color: var(--q3); background: linear-gradient(180deg, rgba(74,140,200,.22), #1a1d24); }
  .ia.q4 { border-color: var(--q4); background: linear-gradient(180deg, rgba(190,140,60,.26), #1a1d24); }""",
'C5c ia.qN 合并')

print()
print('== C6. 字号表头注释：记录字重三档纪律 ==')
patch(
"""     * 图标/装饰字形（emoji 头像、"+"/"★" 等符号）不属排版层级，
     * 仍按图形尺寸直接写 px，不受此表约束。""",
"""     * 图标/装饰字形（emoji 头像、"+"/"★" 等符号）不属排版层级，
     * 仍按图形尺寸直接写 px，不受此表约束。
     *
     * v82（老板「统一各级标题，文字，备注的字体格式，大小，粗细」）：
     *   · 字重只留**三档**：400 正文 / 700 强调（按钮·数值·名字）/ 800 标题；
     *   · 分区标题族与备注族各只有**一处共享定义**（见文末两段共享规则）；
     *   · 字体族全局一处（body 的 PingFang SC 族），等宽例外仅 .bt-strip 一处。""",
'C6 注释更新')

print()
print('CSS 统一完成。')
