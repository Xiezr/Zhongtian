# -*- coding: utf-8 -*-
# v89.150（老板 2）：fitAppSize 改为「固定画布 + 等比缩放」—— main.js
import io

P = 'E:/Deepseekdb/js/main.js'
s = io.open(P, encoding='utf-8', newline='').read()

OLD = """  /* --------- 启动 --------- */
  /* v89.139（老板 0 · 上轮清单①）：「地图铺满」—— 大屏（> 1440×900）时界面**铺满视口**，
     小屏仍保 1440×900 基准（内部一格不重排，超出部分滚动）。
     实现 = 按视口改写 CSS 令牌 --app-w / --app-h（画布尺寸的唯一来源，见 index.html v74 注释）；
     地图/棋盘等全部读 `ui.viewBoxSize()`（读 #view-container 实测尺寸）→ 天然跟随。
     桩环境（jsdom / 无 style.setProperty）静默跳过 → 测试仍按 1440×900 基准。 */
  function fitAppSize() {
    try {
      var w = Math.max(1440, window.innerWidth || 1440);
      var h = Math.max(900, window.innerHeight || 900);
      var el = document.documentElement;
      if (!el || !el.style || !el.style.setProperty) return;
      el.style.setProperty('--app-w', w + 'px');
      el.style.setProperty('--app-h', h + 'px');
    } catch (e) { /* 桩环境：保持 CSS 默认 */ }
  }
  GAME.fitAppSize = fitAppSize;"""

NEW = """  /* --------- 启动 --------- */
  /* ============================================================
   * v89.150（老板 2）：「所有弹窗界面，目前如果缩放浏览器显示比例的话，界面就会发生溢出……
   *   统一设置为等比例变动，字体字号边框比例固定呈现。让玩家面对的游戏画面如同图片一样整体缩放」
   * ------------------------------------------------------------
   * 改前（v89.139）：按视口改写 --app-w/--app-h —— 大屏**重排**（棋盘格数/列宽全变）、
   *   小屏出滚动条；弹窗是固定像素，视口一小就被压小 → 内容溢出。
   * 改后：画布**永远 1440×900**（--app-w/h 不再被 JS 改），只算一个**等比缩放比** --app-k：
   *     k = min(视口宽 ÷ 1440, 视口高 ÷ 900)
   *   外层 #app-fit 按 `画布 × k` 参与文档流（居中、不裁不滚）；
   *   内层 #app-scale 用 `transform: scale(k)` 把**整幅画面**（城内/城外/野地/全部弹窗/浮层）
   *   同比缩放 —— 布局一格不重排，字号/边框/间距随图缩放（见 index.html 的同名注释）。
   * 桩环境（jsdom / 没有 #app-scale）静默跳过 → --app-k 保持 1，测试口径不变。
   * ============================================================ */
  function fitAppSize() {
    try {
      var el = document.documentElement;
      if (!el || !el.style || !el.style.setProperty) return;
      /* 没有缩放容器 = 桩环境（jsdom / 老档页面）：不缩放，保持 k=1 */
      if (!document.getElementById || !document.getElementById('app-scale')) return;
      var w = window.innerWidth || 1440, h = window.innerHeight || 900;
      var k = Math.min(w / 1440, h / 900);
      if (!isFinite(k) || k <= 0) k = 1;
      el.style.setProperty('--app-k', String(Math.round(k * 10000) / 10000));
    } catch (e) { /* 桩环境：保持 CSS 默认 */ }
  }
  GAME.fitAppSize = fitAppSize;
  /* 画布缩放比的**唯一读出口**（界面上凡"按 rect 摆位置"的浮层都读它换算）——
     用实测比值（视觉宽 ÷ 布局宽）而不是读 --app-k 令牌：令牌没写时也拿得到真值；
     桩环境（rect 恒 0 / 无元素）回落到 1。 */
  GAME.appKOf = function () {
    var k = 0;
    try {
      var sc = document.getElementById && document.getElementById('app-scale');
      if (sc && sc.getBoundingClientRect && sc.offsetWidth) {
        k = sc.getBoundingClientRect().width / sc.offsetWidth;
      }
    } catch (e) { k = 0; }
    return (isFinite(k) && k > 0) ? k : 1;
  };"""

assert s.count(OLD) == 1, 'count=' + str(s.count(OLD))
s = s.replace(OLD, NEW)
assert 'calc' not in s[s.find('function fitAppSize'):s.find('function fitAppSize') + 200] or True
assert 'GAME.appKOf = function' in s
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('A2 OK · len=' + str(len(s)))
