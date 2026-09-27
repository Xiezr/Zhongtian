# -*- coding: utf-8 -*-
# v89.150（老板 2）：map.pick 的坐标换算 —— 整体缩放后 rect 是视觉坐标，要还原成布局坐标
import io

P = 'E:/Deepseekdb/js/map.js'
s = io.open(P, encoding='utf-8', newline='').read()

OLD = """    var rect = canvas.getBoundingClientRect();
    /* ⚠️ 不能用 rect.width 直接缩放：canvas 带 3px 边框时 rect 含边框
       （实测 rect 1254 / 属性 1248），只差 0.5% —— 但菱形半宽只有 52px，
       在**靠近边界**的点上足以选到邻格，而且这种错"看起来像是手抖"，最难查。
       改用 clientWidth（布局宽，不含边框）并显式扣掉边框厚度。
       jsdom 无布局 → clientWidth 为 0，回落到 rect（旧行为，测试不受影响）。 */
    var cw = canvas.clientWidth || rect.width, ch = canvas.clientHeight || rect.height;
    var bl = Math.max(0, (rect.width - cw) / 2), bt = Math.max(0, (rect.height - ch) / 2);
    var mx = (clientX - rect.left - bl) / cw * canvas.width;
    var my = (clientY - rect.top - bt) / ch * canvas.height;"""

NEW = """    var rect = canvas.getBoundingClientRect();
    /* ⚠️ 不能用 rect.width 直接缩放：canvas 带 3px 边框时 rect 含边框
       （实测 rect 1254 / 属性 1248），只差 0.5% —— 但菱形半宽只有 52px，
       在**靠近边界**的点上足以选到邻格，而且这种错"看起来像是手抖"，最难查。
       改用 clientWidth（布局宽，不含边框）并显式扣掉边框厚度。
       jsdom 无布局 → clientWidth 为 0，回落到 rect（旧行为，测试不受影响）。
       v89.150（老板 2）再加一层：整幅画面被 `transform: scale(k)` 缩放后，
       rect 给的是**视觉尺寸**（已乘过 k）。三处都要换口径：
         · 缩放比 k = GAME.appKOf()（实测「视觉宽 ÷ 布局宽」）；
         · 边框厚度 = offsetWidth − clientWidth（**布局值**，与缩放无关）；
         · 相对偏移 = (clientX − rect.left) ÷ k（把视觉偏移还原成布局偏移）。
       k=1 时与旧式逐像素一致 —— 不引入新口径。 */
    var _k150 = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var cw = canvas.clientWidth || rect.width / _k150, ch = canvas.clientHeight || rect.height / _k150;
    var bl = Math.max(0, ((canvas.offsetWidth || cw) - cw) / 2);
    var bt = Math.max(0, ((canvas.offsetHeight || ch) - ch) / 2);
    var mx = ((clientX - rect.left) / _k150 - bl) / cw * canvas.width;
    var my = ((clientY - rect.top) / _k150 - bt) / ch * canvas.height;"""

assert s.count(OLD) == 1, 'count=' + str(s.count(OLD))
s = s.replace(OLD, NEW)
assert 'var _k150' in s
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('A4 OK · len=' + str(len(s)))
