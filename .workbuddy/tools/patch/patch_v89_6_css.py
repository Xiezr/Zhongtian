# -*- coding: utf-8 -*-
"""v89.6 CSS 补丁：--wonder 语义色（四主题）+ 奇遇/见闻录样式"""
import io

P = r'E:\Deepseekdb\index.html'
d = io.open(P, encoding='utf-8', newline='').read()

# ① 基色（默认/夜theme 共用）
OLD1 = """    --tag-build: #7fa85a; --tag-govern: #d8c46a; --tag-forge: #c9a06a;"""
NEW1 = """    --tag-build: #7fa85a; --tag-govern: #d8c46a; --tag-forge: #c9a06a;
    --wonder: #c9a2ff; --wonder-rgb: 201,162,255;   /* v89.6 奇遇（青莲紫）：奇缘星 / 见闻录 / 线索 */"""
assert d.count(OLD1) == 1, ('css 锚点①', d.count(OLD1))
d = d.replace(OLD1, NEW1, 1)

# ② 素绢（浅色）
OLD2 = """    --tag-build: #4f7a38; --tag-govern: #8a7418; --tag-forge: #95683a;"""
NEW2 = """    --tag-build: #4f7a38; --tag-govern: #8a7418; --tag-forge: #95683a;
    --wonder: #7a53b8; --wonder-rgb: 122,83,184;"""
assert d.count(OLD2) == 1, ('css 锚点②', d.count(OLD2))
d = d.replace(OLD2, NEW2, 1)

# ③ 青竹（浅色）
OLD3 = """    --tag-build: #467334; --tag-govern: #7d6c14; --tag-forge: #8a6238;"""
NEW3 = """    --tag-build: #467334; --tag-govern: #7d6c14; --tag-forge: #8a6238;
    --wonder: #6f4aa8; --wonder-rgb: 111,74,168;"""
assert d.count(OLD3) == 1, ('css 锚点③', d.count(OLD3))
d = d.replace(OLD3, NEW3, 1)

# ④ 样式块尾部追加
OLD4 = """</style>"""
NEW4 = """  /* ============================================================
   * v89.6（老板：「探索性和趣味性」）：奇遇 · 见闻录
   * ------------------------------------------------------------
   * .wnr-*  野地弹窗里的奇遇入口 / 探察提示（青莲紫 == --wonder）
   * .sxf-clue  剧本结算屏的线索行（紫框虚线）
   * .jnl-*  见闻录面板（三档图鉴 + 待探线索）
   * ============================================================ */
  .wnr-line { margin: 6px 0; padding: 6px 10px; border-radius: var(--r-md); font-size: var(--fs-sub);
    color: var(--wonder); border: 1px solid rgba(var(--wonder-rgb),.42);
    background: rgba(var(--wonder-rgb),.10); }
  .wnr-line.wnr-new { color: var(--text); }
  .wnr-line.wnr-done { color: var(--text-dim); border-color: rgba(var(--wonder-rgb),.22);
    background: rgba(var(--wonder-rgb),.05); }
  .btn.sm.wnr-btn { color: var(--wonder); border-color: rgba(var(--wonder-rgb),.55); }
  .sxf-clue { margin-top: 8px; padding: 7px 10px; border-radius: var(--r-md); font-size: var(--fs-sub);
    color: var(--wonder); border: 1px dashed rgba(var(--wonder-rgb),.5);
    background: rgba(var(--wonder-rgb),.08); text-align: left; }
  .jnl-stat { text-align: center; color: var(--text-dim); font-size: var(--fs-sub); margin: 2px 0 8px; }
  .jnl-stat b { color: var(--gold-light); }
  .jnl-sec { color: var(--gold-light); font-size: var(--fs-h3); font-weight: 700; margin: 10px 0 6px; }
  .jnl-empty { color: var(--text-dim); font-size: var(--fs-sub); padding: 4px 0 2px; }
  .jnl-list { display: flex; flex-direction: column; gap: 4px; }
  .jnl-row { display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 4px 8px; border-radius: var(--r-sm); background: var(--surface-3); }
  .jnl-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(148px,1fr)); gap: 6px; }
  .jnl-card { display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center;
    padding: 8px 6px; border-radius: var(--r-md); background: var(--surface-3);
    border: 1px solid var(--line); }
  .jnl-card.has { border-color: rgba(var(--wonder-rgb),.45); background: rgba(var(--wonder-rgb),.07); }
  .jnl-ic { font-size: var(--fs-h1); line-height: 1; }
  .jnl-nm { color: var(--text-strong); font-weight: 700; font-size: var(--fs-body); }
  .jnl-card.has .jnl-nm { color: var(--wonder); }
  .jnl-txt { color: var(--text-dim); font-size: var(--fs-cap); line-height: 1.35; }
</style>"""
assert d.count(OLD4) == 1, ('css 锚点④', d.count(OLD4))
d = d.replace(OLD4, NEW4, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK index.html: --wonder 语义色 + 奇遇/见闻录样式 已写入')
