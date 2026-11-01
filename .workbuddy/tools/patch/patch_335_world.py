# -*- coding: utf-8 -*-
"""改 §335⑤：世界账本入口从顶栏迁到「行政」页，有事件时按钮呼吸。

这是「老板改主意」的改动，按项目规矩 **翻红不删不宽**：
  旧口径钉"顶栏必须有 #nav-ev"，新口径钉"顶栏不能有 + 行政页必须有 + 有事件要闪"。
三条缺一不可，尤其第三条 —— 只删不加会让"有事件时看得见"这个能力悄悄消失。
"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='\n').read()

if 'v156.31' in s:
    print('SKIP：已经改过')
    raise SystemExit(0)

# ---------- ① 段注释里的 ③ ----------
old_doc = """   *   ③ 世界账本入口**常驻顶栏**右侧（#nav-ev，data-action=open-world，常显标签），
   *      不再仅事件时临时弹出。"""
new_doc = """   *   ③ 世界账本入口**常驻顶栏**右侧（#nav-ev）—— 【v156.31 已推翻，见下】
   *
   * v156.31（老板 2026-11-02「把世界账本去掉，放行政里边就行，我看到已经有了，
   *   那就里边图标闪烁」）：
   *   顶栏 #nav-ev **整条退役**；入口只留「行政」页那一个按钮（js/ui-view.js 的 _admDetailHTML），
   *   有事件时它自己 `.btn.ev-on` 呼吸 + 文案换成「⚡ 事件名」。
   *   所以 ③ 的实际口径变成：**顶栏不许有，行政页必须有，有事件必须闪**。"""
assert old_doc in s, 'doc anchor'
s = s.replace(old_doc, new_doc, 1)

# ---------- ② 断言本体 ----------
old_chk = """    check('§335⑤ 世界账本**常驻顶栏**（#nav-ev 入口常显，不再是事件才弹）', (function () {
      return html.indexOf('id="nav-ev"') >= 0
        && html.indexOf('data-action="open-world"') >= 0
        && !/id="nav-ev"[^>]*style="display\\s*:\\s*none/.test(html)
        && html.indexOf('🌍 世界账本') >= 0;
    })(), (function () { return 'nav-ev 常驻 · 标签「🌍 世界账本」'; })());"""

new_chk = """    check('§335⑤ 世界账本入口在「行政」页（顶栏 #nav-ev 已退役；有事件时按钮呼吸）', (function () {
      /* v156.31 新口径，三条一起验：
         ① 顶栏**不再有** #nav-ev（老板要求去掉，留着就是没改）；
         ② 行政页入口**在**（js/ui-view.js 里的 data-action="open-world" 按钮）；
         ③ 有事件时**会闪**（渲染时按 evLive 给 .btn.ev-on，且样式表里有这条动画）。
         ⚠️ ③ 是反平凡解：只删不加的人会过①②，但会让"有事件看得见"这个能力静默消失。 */
      var uv = fs.readFileSync(path.join(__dirname, 'js', 'ui-view.js'), 'utf8');
      return html.indexOf('id="nav-ev"') < 0
        && uv.indexOf('data-action="open-world"') >= 0
        && /\\.btn\\.ev-on\\s*\\{/.test(html)
        && uv.indexOf('evLive') >= 0
        && uv.indexOf("' ev-on'") >= 0;
    })(), (function () {
      return '顶栏已移除 · 入口在行政页 · 有事件 .btn.ev-on 呼吸';
    })());"""

assert old_chk in s, 'check anchor'
s = s.replace(old_chk, new_chk, 1)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('✓ §335⑤ 已改为新口径（3 条一起验）')
