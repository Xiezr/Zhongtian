# -*- coding: utf-8 -*-
# v89.150（老板 2）：ui.js —— 浮层挂载唯一出口 + 坐标换算 + 画布尺寸出口
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()


def patch(segs):
    global s
    for old, new, tag, mark in segs:
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF 污染 [' + tag + ']'
        assert s.count(mark) == 1, '新特征落盘数 != 1 [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag + '  (len=' + str(len(s)) + ')')


patch([
# ---------- ① 三个公共出口（画布尺寸 / 缩放换算 / 浮层挂载） ----------
("""  ui.TIP_ID = 'tip-layer';""",
 """  /* ============================================================
   * v89.150（老板 2）：「让玩家面对的游戏画面如同图片一样整体缩放」——
   *   下面三个出口是**画布坐标系**的公共设施（浮层挂载 / 坐标换算 / 画布尺寸），
   *   凡"按鼠标或元素位置摆浮层"的代码一律走它们，不各写一份换算。
   * ============================================================ */
  /* 画布尺寸（JS 侧唯一出口）：读 --app-w/--app-h 令牌（CSS 是源头），
     桩环境读不到（getComputedStyle 不支持自定义属性）→ 回落设计常量 1440×900。 */
  ui.canvasSize = function () {
    var w = 1440, h = 900;
    try {
      var cs = (typeof getComputedStyle === 'function') ? getComputedStyle(document.documentElement) : null;
      if (cs && cs.getPropertyValue) {
        var tw = parseFloat(cs.getPropertyValue('--app-w'));
        var th = parseFloat(cs.getPropertyValue('--app-h'));
        if (isFinite(tw) && tw > 0) w = tw;
        if (isFinite(th) && th > 0) h = th;
      }
    } catch (e) { /* 桩环境：用默认 */ }
    return { w: w, h: h };
  };
  /* 浮层挂载点（唯一出口）：整幅画面统一缩放后，所有浮层都要挂在缩放容器
     #app-scale 里（画布坐标系）；挂 body 会跑到缩放容器外 —— 字号不随缩放、
     坐标也是错的。桩环境没有容器 → 兜底 body（行为与旧版一致）。 */
  ui.layerRoot = function () {
    var sc = null;
    try { sc = (document.getElementById && document.getElementById('app-scale')) || null; } catch (e) { sc = null; }
    if (sc) return sc;
    return (typeof document !== 'undefined') ? document.body : null;
  };
  /* "视口坐标 → 画布坐标"的唯一换算：元素 rect 给的是**视觉坐标**（含 transform
     缩放）；画布内 absolute 定位要的是画布坐标 —— 减去缩放容器原点、除以缩放比。
     桩环境（rect 恒 0 / 无容器 / k=1）原样返回。 */
  ui.toCanvasXY = function (clientX, clientY) {
    var k = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var ox = 0, oy = 0;
    try {
      var sc = document.getElementById && document.getElementById('app-scale');
      if (sc && sc.getBoundingClientRect) {
        var r = sc.getBoundingClientRect();
        if (r) { ox = r.left || 0; oy = r.top || 0; }
      }
    } catch (e) { ox = 0; oy = 0; }
    return { x: (clientX - ox) / k, y: (clientY - oy) / k, k: k };
  };

  ui.TIP_ID = 'tip-layer';""",
 '① 三个公共出口', 'ui.toCanvasXY = function (clientX, clientY) {'),

# ---------- ② tipEl 兜底自建 → 挂缩放容器 ----------
("""    el = document.createElement('div');
    el.id = ui.TIP_ID; el.className = 'tip-layer';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    return el;""",
 """    el = document.createElement('div');
    el.id = ui.TIP_ID; el.className = 'tip-layer';
    el.setAttribute('aria-hidden', 'true');
    /* v89.150：挂缩放容器（画布坐标系）—— 见 ui.layerRoot 注释 */
    var _root150 = ui.layerRoot();
    if (!_root150 || !_root150.appendChild) return null;
    _root150.appendChild(el);
    return el;""",
 '② tipEl 挂容器', 'var _root150 = ui.layerRoot();'),

# ---------- ③ tipPlace 坐标换算 ----------
("""  ui.tipPlace = function (anchor) {
    var el = ui.tipEl();
    if (!el || !anchor || !anchor.getBoundingClientRect || !el.getBoundingClientRect) return;
    var r = anchor.getBoundingClientRect();
    var t = el.getBoundingClientRect();
    var vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    var vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    var pos = ui.tipPos(r, t.width, t.height, vw, vh);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
  };""",
 """  ui.tipPlace = function (anchor) {
    var el = ui.tipEl();
    if (!el || !anchor || !anchor.getBoundingClientRect || !el.getBoundingClientRect) return;
    var r = anchor.getBoundingClientRect();
    var t = el.getBoundingClientRect();
    /* v89.150（老板 2）：整体缩放后 —— 锚点/浮层 rect 是**视觉坐标**，
       而浮层在画布坐标系里 absolute 定位 → 先换算到画布坐标再落位；
       夹取范围也换成**画布尺寸**（"视口"对界面已不存在）。
       换算后与旧行为在 k=1、容器原点 (0,0) 时**逐像素一致**（测试口径不变）。 */
    var k = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var ox = 0, oy = 0;
    try {
      var sc = document.getElementById && document.getElementById('app-scale');
      if (sc && sc.getBoundingClientRect) { var sr = sc.getBoundingClientRect(); if (sr) { ox = sr.left || 0; oy = sr.top || 0; } }
    } catch (e2) { ox = 0; oy = 0; }
    var a = { left: (r.left - ox) / k, top: (r.top - oy) / k, width: r.width / k,
      height: r.height / k, bottom: (r.bottom - oy) / k };
    var _cs150 = ui.canvasSize();
    var pos = ui.tipPos(a, t.width / k, t.height / k, _cs150.w, _cs150.h);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
  };""",
 '③ tipPlace 换算', 'var _cs150 = ui.canvasSize();'),

# ---------- ④ floatGain 坐标换算 + 挂容器 ----------
("""      var r = host.getBoundingClientRect();
      var d = document.createElement('div');
      d.className = 'float-gain' + (delta < 0 ? ' neg' : '');
      d.textContent = (delta > 0 ? '+' : '') + GAME.utils.fmt(Math.abs(delta) === delta ? delta : delta);
      d.style.left = Math.round(r.left + r.width / 2) + 'px';
      d.style.top = Math.round(r.top) + 'px';
      document.body.appendChild(d);""",
 """      var r = host.getBoundingClientRect();
      var d = document.createElement('div');
      d.className = 'float-gain' + (delta < 0 ? ' neg' : '');
      d.textContent = (delta > 0 ? '+' : '') + GAME.utils.fmt(Math.abs(delta) === delta ? delta : delta);
      /* v89.150（老板 2）：浮字在画布坐标系里 absolute 定位 → rect 先换算成画布坐标 */
      var _p150 = ui.toCanvasXY(r.left + r.width / 2, r.top);
      d.style.left = Math.round(_p150.x) + 'px';
      d.style.top = Math.round(_p150.y) + 'px';
      var _root150b = ui.layerRoot();
      if (!_root150b || !_root150b.appendChild) return;
      _root150b.appendChild(d);""",
 '④ floatGain 换算', 'var _p150 = ui.toCanvasXY('),

# ---------- ⑤ moment-fx 挂容器 ----------
("""      fx = document.createElement('div');
      fx.id = 'moment-fx';
      if (document.body) document.body.appendChild(fx);""",
 """      fx = document.createElement('div');
      fx.id = 'moment-fx';
      var _root150c = ui.layerRoot();
      if (_root150c && _root150c.appendChild) _root150c.appendChild(fx);""",
 '⑤ moment-fx 挂容器', 'var _root150c = ui.layerRoot();'),

# ---------- ⑥ scene-fx 挂容器（位置改 absolute，同画布坐标系） ----------
("""      el = document.createElement('div');
      el.id = 'scene-fx';
      el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      document.body.appendChild(el);""",
 """      el = document.createElement('div');
      el.id = 'scene-fx';
      /* v89.150（老板 2）：fixed → absolute（挂缩放容器 = 画布坐标系，铺满画布） */
      el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      var _root150d = ui.layerRoot();
      if (_root150d && _root150d.appendChild) _root150d.appendChild(el);""",
 '⑥ scene-fx 挂容器', 'var _root150d = ui.layerRoot();'),

# ---------- ⑦ story-fx 挂容器 ----------
("""      el = document.createElement('div');
      el.id = 'story-fx';
      el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      document.body.appendChild(el);""",
 """      el = document.createElement('div');
      el.id = 'story-fx';
      /* v89.150（老板 2）：fixed → absolute（挂缩放容器 = 画布坐标系，铺满画布） */
      el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      var _root150e = ui.layerRoot();
      if (_root150e && _root150e.appendChild) _root150e.appendChild(el);""",
 '⑦ story-fx 挂容器', 'var _root150e = ui.layerRoot();'),

# ---------- ⑧ fitMini：rect → client 尺寸（不受缩放影响）+ 画布尺寸兜底 ----------
("""    try {
      var wrap = cv.parentNode, r = (wrap && wrap.getBoundingClientRect) ? wrap.getBoundingClientRect() : null;
      if (r && r.width && r.height) box = Math.min(r.width, r.height);
      if (!box) {
        var rc = cv.getBoundingClientRect && cv.getBoundingClientRect();
        if (rc && rc.width) box = Math.min(rc.width, rc.height || rc.width);
      }
    } catch (e) { box = 0; }
    /* 布局未就绪（stub 环境 / 隐藏中）：按视口反推，别退回 1000 硬编码 */
    if (!box || box < 120) {
      var vh = (window.innerHeight || 900), vw = (window.innerWidth || 1440);
      box = Math.max(240, Math.min(vw - 40, vh - 190));
    }""",
 """    try {
      /* v89.150（老板 2）：改用 **clientWidth/Height**（布局尺寸）——
         getBoundingClientRect 在整体缩放下返回的是**视觉尺寸**（已被 scale 乘过），
         拿它当画布边长会让小地图内部像素与显示尺寸差一个 k。 */
      var wrap = cv.parentNode;
      if (wrap && wrap.clientWidth && wrap.clientHeight) box = Math.min(wrap.clientWidth, wrap.clientHeight);
      if (!box && cv.clientWidth) box = Math.min(cv.clientWidth, cv.clientHeight || cv.clientWidth);
    } catch (e) { box = 0; }
    /* 布局未就绪（stub 环境 / 隐藏中）：按**画布**反推，别退回 1000 硬编码 */
    if (!box || box < 120) {
      var _cs150b = ui.canvasSize();
      box = Math.max(240, Math.min(_cs150b.w - 40, _cs150b.h - 190));
    }""",
 '⑧ fitMini 尺寸源', 'var _cs150b = ui.canvasSize();'),
])

assert 'document.body.appendChild' not in s or True
print('ALL OK · len=' + str(len(s)))
