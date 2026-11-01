# -*- coding: utf-8 -*-
"""改 §338①②③：世界账本从「顶栏常驻」改为「行政页入口」的同一组守卫。

v2026-10-31 老板要求账本常驻顶栏；v156.31（2026-11-02）老板又要求去掉、放行政页。
守卫**不删**，改成新口径 —— 否则"有事件时看得见"这件事再没人守。
"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='\n').read()

if '世界账本入口（v2026-10-31 顶栏' in s:
    print('SKIP：已经改过')
    raise SystemExit(0)

# ---------- 段注释 ----------
old_doc = """   * §338 · v2026-10-31（老板）：世界账本**常驻顶栏**（原 v122 待办提醒位升级）
   * ------------------------------------------------------------
   * 原 v122：事件挂在「行政 → 世界的账本」二级弹窗，玩家看不见。
   * 修法是在顶栏加一个**事件时**才显示的入口位（nav-ev）。
   * v2026-10-31 老板：「上边菜单不要收缩，把那个世界账本找个合适地方」——
   *   nav-ev 从"事件时才弹出"升级为**常驻的世界账本入口**：
   *   无事件也显示「🌍 世界账本」；有事件时加 .ev-on 呼吸 + 改文案「⚡ 事件名」。
   * 可达性更强，且不上新页签（顶栏不收缩、不加 tab）。"""
new_doc = """   * §338 · 世界账本入口（v2026-10-31 顶栏 → **v156.31 已推翻，改到行政页**）
   * ------------------------------------------------------------
   * 沿革（三次变动，都留着，别再绕回去）：
   *   v122        ：事件挂在「行政 → 世界的账本」二级弹窗 —— 玩家看不见。
   *   v2026-10-31 ：老板「把那个世界账本找个合适地方」→ 顶栏加常驻位 #nav-ev。
   *   v156.31     ：老板「把世界账本去掉，放行政里边就行，我看到已经有了，
   *                  那就里边图标闪烁」→ **顶栏 #nav-ev 整条退役**，
   *                  入口回到行政页那个按钮，有事件时它自己 .btn.ev-on 呼吸。
   * 守卫据此改成新口径（不删）：入口在行政页 / 一点即开 / 有事件必须闪。"""
assert old_doc in s, 'doc anchor'
s = s.replace(old_doc, new_doc, 1)

# ---------- ① ----------
old1 = """    check('§338① 顶栏有世界账本位（nav-ev），常驻可见、默认带「🌍 世界账本」标签、点即开账本', (function () {
      return html.indexOf('id="nav-ev"') >= 0
        && /id="nav-ev"[^>]*data-action="open-world"/.test(html)
        && html.indexOf('🌍 世界账本') >= 0;
    })(), (function () { return 'nav-ev 常驻 · 开账本'; })());"""
new1 = """    check('§338① 世界账本入口在「行政」页（顶栏 #nav-ev 已退役），默认文案「🌍 世界的账本」', (function () {
      var uv = fs.readFileSync(path.join(__dirname, 'js', 'ui-view.js'), 'utf8');
      return html.indexOf('id="nav-ev"') < 0                 /* 顶栏真的删了 */
        && uv.indexOf('data-action="open-world"') >= 0        /* 入口还在 */
        && uv.indexOf('🌍 世界的账本') >= 0;                  /* 默认文案 */
    })(), (function () { return '行政页入口 · 默认「🌍 世界的账本」'; })());"""
assert old1 in s, 'chk1 anchor'
s = s.replace(old1, new1, 1)

# ---------- ② ----------
old2 = """    check('§338② 它点一下就是「开账本」（不是又一个要点两次的入口）', (function () {
      var i = html.indexOf('id="nav-ev"');
      var seg = html.slice(Math.max(0, i - 260), i + 240);
      return seg.indexOf('data-action="open-world"') >= 0;
    })(), (function () { return 'data-action="open-world"'; })());"""
new2 = """    check('§338② 它点一下就是「开账本」（按钮自带 data-action，且有接收它的 case）', (function () {
      var uv = fs.readFileSync(path.join(__dirname, 'js', 'ui-view.js'), 'utf8');
      var mj = fs.readFileSync(path.join(__dirname, 'js', 'main.js'), 'utf8');
      /* 按钮上挂 data-action，action 表里有 case —— 两样都在才算"点得动"。
         只查按钮不查 case 的话，按钮点下去会静默无反应（本项目踩过这类"死按钮"）。 */
      return uv.indexOf('data-action="open-world"') >= 0
        && mj.indexOf("case 'open-world'") >= 0;
    })(), (function () { return 'data-action + main.js case 都在'; })());"""
assert old2 in s, 'chk2 anchor'
s = s.replace(old2, new2, 1)

# ---------- ③ ----------
old3 = """    check('§338③ 有事件时加 .ev-on 呼吸 + 写明事件名；无事件常显「🌍 世界账本」（不再靠 display:none 藏）', (function () {
      return ui.indexOf("getElementById('nav-ev')") >= 0
        && ui.indexOf("evEl.classList.add('ev-on')") >= 0
        && ui.indexOf("evEl.classList.remove('ev-on')") >= 0
        && ui.indexOf("'⚡ ' + (evCur.def.name") >= 0
        && ui.indexOf("'🌍 世界账本'") >= 0;
    })(), (function () { return '⚡ + 事件名；否则常显「🌍 世界账本」'; })());"""
new3 = """    check('§338③ 有事件时按钮 .ev-on 呼吸 + 写明事件名；无事件回默认文案（两处同步）', (function () {
      /* 两处都要有，缺一处就有一半场景失效：
         · ui-view.js 渲染时算（切进去就亮，不会先灭后亮）；
         · ui-modal.js 的 syncBadges 补（行政页不随 tick 重绘，停留时来事件也亮）。 */
      var uv = fs.readFileSync(path.join(__dirname, 'js', 'ui-view.js'), 'utf8');
      return ui.indexOf("getElementById('nav-ev')") < 0                 /* 旧实现清干净（注释里提历史不算） */
        && uv.indexOf('evLive') >= 0
        && uv.indexOf("' ev-on'") >= 0
        && ui.indexOf("'#view-container [data-action=\\\"open-world\\\"]'") >= 0
        && ui.indexOf("evEl.classList.add('ev-on')") >= 0
        && ui.indexOf("'⚡ '") >= 0
        && /\\.btn\\.ev-on\\s*\\{/.test(html);
    })(), (function () { return '渲染时 + syncBadges 双路；.btn.ev-on 呼吸'; })());"""
assert old3 in s, 'chk3 anchor'
s = s.replace(old3, new3, 1)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('✓ §338①②③ 已改为行政页口径')
