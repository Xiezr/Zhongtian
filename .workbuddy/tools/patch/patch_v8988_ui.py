# -*- coding: utf-8 -*-
"""v89.88（老板需求 5）：界面打磨（审计先行 —— 只补真缺口）。
① .tip-layer 对比度修复（浅色主题下 deep-on-dark 发闷，低于 AA）；
② #mapCanvas 光标（可点地图却用默认箭头）；
③ 追加「手感统一块」：focus-visible / 弹窗入场 / 页签图标过渡 / 全局动效降级。
"""
import io

P = r'E:\Deepseekdb\index.html'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    assert s.count(old) == 1, (tag, s.count(old))
    s = s.replace(old, new, 1)


# ① 浮层对比度 + 入场位移
rep("""  .tip-layer {
    position: fixed; left: 0; top: 0; z-index: 9000;
    min-width: 150px; max-width: 300px; padding: 8px 10px; border-radius: 7px;
    background: #12110c; border: 1px solid var(--gold-dark);
    box-shadow: 0 12px 28px rgba(var(--sh-rgb),.75);
    opacity: 0; visibility: hidden; transition: opacity .12s;
    pointer-events: none; text-align: left; white-space: pre-line;
  }
  .tip-layer.on { opacity: 1; visibility: visible; }
  .tip-layer .tip-t { font-size: var(--fs-sub); font-weight: 800; color: var(--gold-light); margin-bottom: 4px; }
  .tip-layer .tip-l { font-size: var(--fs-sub); color: var(--text-dim); line-height: 1.65; }""",
"""  .tip-layer {
    position: fixed; left: 0; top: 0; z-index: 9000;
    min-width: 150px; max-width: 300px; padding: 8px 10px; border-radius: 7px;
    background: #12110c; border: 1px solid var(--gold-dark);
    box-shadow: 0 12px 28px rgba(var(--sh-rgb),.75);
    opacity: 0; visibility: hidden;
    transform: translateY(2px);                    /* v89.88：入场微位移（反馈"浮层出现"） */
    transition: opacity .12s ease-out, transform .12s ease-out;
    pointer-events: none; text-align: left; white-space: pre-line;
  }
  .tip-layer.on { opacity: 1; visibility: visible; transform: none; }
  /* v89.88（界面审计修复 · 对比度）：浮层正文/标题**钉死为高对比暖色** ——
     原读 `--gold-light` / `--text-dim`，而浅色主题（素绢/青竹）里这两个令牌是
     **深色**，压在 #12110c 深底上的对比度掉到 ~3.6:1（低于 WCAG AA 4.5:1，小字发闷）。
     浮层是全主题共用的"深色卡"：文字色跟卡片走、不跟主题走。 */
  .tip-layer .tip-t { font-size: var(--fs-sub); font-weight: 800; color: #e8ce88; margin-bottom: 4px; }
  .tip-layer .tip-l { font-size: var(--fs-sub); color: #cdc8ba; line-height: 1.65; }
  .tip-layer .tip-l b { color: #f2e8ca; font-weight: 700; }""", 'tip')

# ② 地图光标
rep("""  #mapCanvas { display: block; margin: 0 auto; max-width: 100%; border: 3px solid var(--gold-dark); border-radius: 8px;
    background: #84a050; box-shadow: 0 6px 18px rgba(var(--sh-rgb),.5), inset 0 0 0 1px rgba(var(--sh-rgb),.45); }""",
"""  #mapCanvas { display: block; margin: 0 auto; max-width: 100%; border: 3px solid var(--gold-dark); border-radius: 8px;
    background: #84a050; box-shadow: 0 6px 18px rgba(var(--sh-rgb),.5), inset 0 0 0 1px rgba(var(--sh-rgb),.45);
    /* v89.88：大地图整块可点（点城池/据点/野地都会出面板）——
       原来用的是默认箭头光标，"能不能点"全靠猜。 */
    cursor: pointer; }""", 'canvas')

# ③ 追加「手感统一块」（style 末尾之前）
tail = """</style>"""
assert s.count(tail) == 1, ('tail', s.count(tail))
block = """
  /* ============================================================
   * v89.88（老板需求 5）：界面手感统一 —— 焦点可见 / 弹窗入场 / 动效降级
   * ------------------------------------------------------------
   * 审计先行（只补真缺口，不动既有令牌体系）：
   *   · 全站只有 2 处自定义焦点样式 → 键盘走查时按钮/页签"看不出焦点在哪"；
   *   · 弹窗无入场反馈（瞬开瞬关，层级变化没有"出现感"）；
   *   · prefers-reduced-motion 只覆盖了公文徽标闪烁 —— 减少动态的用户
   *     不该被任何入场/过渡打扰。
   * ============================================================ */
  /* ① 键盘焦点：全站统一金色焦点环（鼠标点击不显示，键盘/读屏才显示） */
  :focus { outline: none; }
  :focus-visible { outline: 2px solid var(--gold-light); outline-offset: 1px; }
  input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--gold-light); outline-offset: 0;
  }
  /* ② 弹窗入场：遮罩淡入 + 面板 7px 上浮（只动 opacity/transform，GPU 合成） */
  .modal-mask { animation: mModalIn .13s ease-out; }
  @keyframes mModalIn { from { opacity: 0; } }
  .modal-mask > * { animation: mModalRise .15s cubic-bezier(.16,1,.3,1); }
  @keyframes mModalRise { from { opacity: 0; transform: translateY(7px) scale(.985); } }
  /* ③ 页签图标：透明度过渡（原来只有 hover/选中两态硬切） */
  .topnav .tab .nav-ico { transition: opacity .15s; }
  /* ④ 动效降级：系统偏好"减少动态效果"→ 全站过渡/动画归零 */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .001ms !important;
    }
  }
</style>"""
s = s.replace(tail, block, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK index.html 界面打磨')
