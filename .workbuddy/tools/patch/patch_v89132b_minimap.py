# -*- coding: utf-8 -*-
"""v89.132 补丁 B：缩略地图（老板需求 0 · v89.128 第二批第 12 条）
老板原话：「缩略地图上的字体笔画太厚了。我城的标注不清晰，那个点可以改成红点，
  并且当前玩家所在城池的点出现闪烁或者波纹状点晕，提示当前所在位置。」
- 字体：城名层 bold → normal；描边 0.18fs → 0.12fs（两处：默认层 + 下钻层）
- 我城：金点 → 红点（ui.miniMeDot 唯一出口）；底部 38px 小图专用大号（显示 ~2.4px）
- 当前城：满界面档加**波纹**（mini-pulse 动画层，100ms 重绘，面板关闭自灭）；
  底部小图加 **1Hz 闪烁**（主循环每秒重绘）
- 我城名称：满界面档在红点旁标出城名（ui.miniMeLabels）
跑：python .workbuddy/tools/patch/patch_v89132b_minimap.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag, expect=1):
    n = s.count(old)
    assert n == expect, tag + ': 锚点命中 ' + str(n) + ' 次（期望 ' + str(expect) + '）'
    return s.replace(old, new)

# ============ ui.js ============
ui = rd('js/ui.js')

# --- ① MINI_LABEL 加 meFontK ---
old_k = ("    focusFontK: 0.022, focusDotK: 0.018,\n"
         "    anchorFontK: 0.026, anchorDotK: 0.024\n"
         "  };\n")
new_k = ("    focusFontK: 0.022, focusDotK: 0.018,\n"
         "    anchorFontK: 0.026, anchorDotK: 0.024,\n"
         "    meFontK: 0.018      /* v89.132：我城名称 —— 比郡城（0.020）小一档，\n"
         "                           自己的城可能有很多座，字要轻 */\n"
         "  };\n")
ui = rep1(ui, old_k, new_k, '① MINI_LABEL 加 meFontK')

# --- ② 城名字体减细（两处：默认层 + 下钻层，同款两行连续出现 2 次） ---
old_font = ("      ctx.font = 'bold ' + fs + 'px sans-serif';\n"
            "      ctx.lineWidth = Math.max(2, fs * 0.18);\n")
new_font = ("      /* v89.132（老板「缩略地图上的字体笔画太厚了」）：bold → normal，\n"
            "         描边 0.18fs → 0.12fs（原来两样叠加，字看着是被「描粗」的） */\n"
            "      ctx.font = 'normal ' + fs + 'px sans-serif';\n"
            "      ctx.lineWidth = Math.max(1.2, fs * 0.12);\n")
ui = rep1(ui, old_font, new_font, '② 字体减细', expect=2)

# --- ③ 新增我城三个出口（插在 ui.drawMini 之前） ---
old_dm = "  ui.drawMini = function (canvas, size, opts) { /* 打底 + 动态层（我城金点）+ 可选的城名层 */\n"
new_me = r'''  /* ============================================================
   * v89.132（老板）：「缩略地图上的字体笔画太厚了。我城的标注不清晰，那个点可以
   *   改成红点，并且当前玩家所在城池的点出现闪烁或者波纹状点晕，提示当前所在位置」。
   * 三个出口（唯一来源）：
   *   · ui.miniMeDot    —— 我城的点：**红点** + 亮描边
   *     （从前是金点 #ffe9a0，与州城金色 #ffd76a 撞色 —— 这正是"标注不清晰"的一因）；
   *     `big` 档给底部条那枚 38px 小图（内部 1000px 画布 → 点要画到 size/16 才看得见）；
   *   · ui.miniMeWave   —— 波纹点晕（**当前城**专属；满界面档由 mini-pulse 动画层重绘）；
   *   · ui.miniMeLabels —— 我城名称（满界面档在红点旁标城名；当前城最后画、压最上层）。
   * 「当前城」= 玩家正在看的那座（`GAME.ui._cityId`）。
   * ============================================================ */
  ui.MINI_ME = { dot: '#ff3a2a', ring: '#ffe6c8', wave: '255,86,56' };
  ui.MINI_WAVE_MS = 1500;               /* 一圈波纹的周期（毫秒） */
  ui.miniMeDot = function (ctx, cx, cy, size, big) {
    var r = big ? Math.max(6, size / 16) : Math.max(3, size / 100);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fillStyle = ui.MINI_ME.dot; ctx.fill();
    ctx.lineWidth = Math.max(1, size / 420);
    ctx.strokeStyle = ui.MINI_ME.ring; ctx.stroke();
  };
  ui.miniMeWave = function (ctx, cx, cy, size, t) {
    var r0 = Math.max(3, size / 100), span = Math.max(10, size / 24);
    for (var i = 0; i < 2; i++) {
      var ph = ((t / ui.MINI_WAVE_MS) + i / 2) % 1;
      ctx.beginPath(); ctx.arc(cx, cy, r0 + span * ph, 0, 6.2832);
      ctx.strokeStyle = 'rgba(' + ui.MINI_ME.wave + ',' + ((1 - ph) * 0.6).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1.2, size / 360);
      ctx.stroke();
    }
  };
  ui.miniMeLabels = function (ctx, size, v, win) {
    var s = GAME.state, K = ui.MINI_LABEL;
    var list = (s.cities || []).slice().sort(function (a, b) {
      return ((a.id === ui._cityId) ? 1 : 0) - ((b.id === ui._cityId) ? 1 : 0);   /* 当前城最后画 */
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach(function (c) {
      var p = win(c.x, c.y);
      if (!p) return;                   /* 窗外的我城不标 */
      var isCur = (c.id === ui._cityId);
      var fs = Math.max(9, Math.round(size * K.meFontK));
      var d = Math.max(5, Math.round(size * K.dotK.jun));
      var dy = d / 2 + fs / 2 + Math.round(size * K.gapK);
      var txt = String(c.name || '');
      ctx.font = 'normal ' + fs + 'px sans-serif';
      ctx.lineWidth = Math.max(1.2, fs * 0.12);
      ctx.strokeStyle = 'rgba(30,8,4,.92)';
      ctx.strokeText(txt, p[0], p[1] + dy);
      ctx.fillStyle = isCur ? '#ffd9c0' : '#ffeede';
      ctx.fillText(txt, p[0], p[1] + dy);
    });
  };
  /* 波纹动画层：只清空 + 画当前城的波纹（不重绘底图/城名 —— 所以能 100ms 一跳）。
     面板一关，下一跳 `#mini-pulse` 取不到 → 定时器自灭（不钩 closeModal，少一处耦合）。 */
  ui._miniPulseTimer = null;
  ui.paintMiniPulse = function () {
    var cv = (document.getElementById && document.getElementById('mini-pulse'));
    if (!cv) {
      if (ui._miniPulseTimer) { clearInterval(ui._miniPulseTimer); ui._miniPulseTimer = null; }
      return;
    }
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx || !ctx.clearRect || !ctx.arc) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var s = GAME.state, cur = null;
    (s.cities || []).forEach(function (c) { if (c.id === ui._cityId) cur = c; });
    if (!cur) return;
    var v = ui.miniView(), side = cv.width;
    var px = (cur.x + 0.5 - v.win.x0) / v.win.side * side;
    var py = (cur.y + 0.5 - v.win.y0) / v.win.side * side;
    if (px < 0 || py < 0 || px > side || py > side) return;   /* 下钻到别处：当前城不在窗内 */
    ui.miniMeWave(ctx, px, py, side, Date.now());
  };
'''
ui = rep1(ui, old_dm, new_me + old_dm, '③ 我城出口')

# --- ④ drawMini：我城绘制替换 + 名称层调用 ---
old_me = ("    var s = GAME.state;\n"
          "    (s.cities || []).forEach(function (c) {\n"
          "      var pxx = (c.x + 0.5 - v.win.x0) / v.win.side * size;\n"
          "      var pyy = (c.y + 0.5 - v.win.y0) / v.win.side * size;\n"
          "      if (pxx < 0 || pyy < 0 || pxx > size || pyy > size) return;   /* 窗外的我城不画 */\n"
          "      ctx.beginPath();\n"
          "      ctx.arc(pxx, pyy, Math.max(3, size / 110), 0, 6.2832);\n"
          "      ctx.fillStyle = '#ffe9a0'; ctx.fill();\n"
          "      ctx.lineWidth = Math.max(1, size / 500); ctx.strokeStyle = '#7a4a12'; ctx.stroke();\n"
          "    });\n")
new_me2 = ("    var s = GAME.state;\n"
           "    var _win = function (x, y) {            /* 世界格 → 画布坐标；窗外 null */\n"
           "      var px = (x + 0.5 - v.win.x0) / v.win.side * size;\n"
           "      var py = (y + 0.5 - v.win.y0) / v.win.side * size;\n"
           "      return (px < 0 || py < 0 || px > size || py > size) ? null : [px, py];\n"
           "    };\n"
           "    /* v89.132：底部小图的「当前城」1Hz 闪烁（主循环每秒重绘时按秒奇偶取相位） */\n"
           "    var _blink = (opts && opts.meBlink)\n"
           "      ? ((Math.floor(Date.now() / 1000) % 2 === 0) ? 1 : 0.42) : 1;\n"
           "    (s.cities || []).forEach(function (c) {\n"
           "      var p = _win(c.x, c.y);\n"
           "      if (!p) return;                       /* 窗外的我城不画 */\n"
           "      if (c.id === ui._cityId) ctx.globalAlpha = _blink;\n"
           "      ui.miniMeDot(ctx, p[0], p[1], size, !!(opts && opts.meBig));\n"
           "      ctx.globalAlpha = 1;\n"
           "    });\n")
ui = rep1(ui, old_me, new_me2, '④ drawMini 我城')

old_lb = ("    if (opts && opts.labels) {\n"
          "      if (v.level) ui.miniFocusLabels(ctx, size, v);\n"
          "      else ui.miniLabels(ctx, size);\n"
          "    }\n"
          "    return true;\n")
new_lb = ("    if (opts && opts.labels) {\n"
          "      if (v.level) ui.miniFocusLabels(ctx, size, v);\n"
          "      else ui.miniLabels(ctx, size);\n"
          "      ui.miniMeLabels(ctx, size, v, _win);     /* v89.132：我城名称（红点旁标城名） */\n"
          "    }\n"
          "    return true;\n")
ui = rep1(ui, old_lb, new_lb, '④b 名称层调用')

# --- ⑤ paintMiniBottom 改传 opts（大号红点 + 闪烁） ---
old_pb = ("  ui.paintMiniBottom = function () {      /* 底部条那枚 38px 小图 */\n"
          "    var cv = $('#mini-canvas');\n"
          "    if (!cv) return;\n"
          "    try { ui.drawMini(cv, ui.MINI_PX); } catch (e) { /* 画布 stub 环境：静默跳过 */ }\n"
          "  };\n")
new_pb = ("  ui.paintMiniBottom = function () {      /* 底部条那枚 38px 小图 */\n"
          "    var cv = $('#mini-canvas');\n"
          "    if (!cv) return;\n"
          "    /* v89.132：meBig = 大号红点（38px 显示下 ~2.4px，才能看清「我在哪」）；\n"
          "       meBlink = 当前城 1Hz 闪烁（主循环每秒重绘，按秒奇偶取相位）。 */\n"
          "    try { ui.drawMini(cv, ui.MINI_PX, { meBig: true, meBlink: true }); } catch (e) { /* 画布 stub 环境：静默跳过 */ }\n"
          "  };\n")
ui = rep1(ui, old_pb, new_pb, '⑤ paintMiniBottom')

# --- ⑥ openMinimap：加 pulse 画布 + 启动动画 ---
old_om = ("      '<div class=\"mini-full\">' +\n"
          "        '<div class=\"mini-wrap\"><canvas id=\"mini-big\"></canvas></div>' +\n")
new_om = ("      '<div class=\"mini-full\">' +\n"
          "        '<div class=\"mini-wrap\"><canvas id=\"mini-big\"></canvas>' +\n"
          "          /* v89.132：波纹层（绝对定位盖在底图上，只画当前城的点晕） */\n"
          "          '<canvas id=\"mini-pulse\" class=\"mini-pulse\"></canvas></div>' +\n")
ui = rep1(ui, old_om, new_om, '⑥ openMinimap 画布')

old_om2 = ("    var big = $('#mini-big');\n"
           "    var side = ui.fitMini();\n")
new_om2 = ("    var big = $('#mini-big');\n"
           "    var side = ui.fitMini();\n"
           "    /* v89.132：波纹层与底图同尺寸（内联宽高照抄 fitMini 写好的那份），\n"
           "       启动 100ms 动画；面板一关，paintMiniPulse 取不到画布即自灭。 */\n"
           "    var pulse = document.getElementById && document.getElementById('mini-pulse');\n"
           "    if (pulse && big) {\n"
           "      pulse.style.width = big.style.width;\n"
           "      pulse.style.height = big.style.height;\n"
           "      pulse.width = big.width; pulse.height = big.height;\n"
           "    }\n"
           "    if (ui._miniPulseTimer) { clearInterval(ui._miniPulseTimer); ui._miniPulseTimer = null; }\n"
           "    ui._miniPulseTimer = setInterval(ui.paintMiniPulse, 100);\n")
ui = rep1(ui, old_om2, new_om2, '⑥b 启动动画')

# --- 自检 ---
for sent in ['ui.miniMeDot = function', 'ui.miniMeWave = function', 'ui.miniMeLabels = function',
             'ui.paintMiniPulse = function', "meFontK: 0.018", "'normal ' + fs + 'px sans-serif'",
             "ui.drawMini(cv, ui.MINI_PX, { meBig: true, meBlink: true })", "mini-pulse"]:
    assert ui.count(sent) >= 1, '丢失哨兵: ' + sent
assert ui.count("'bold ' + fs + 'px sans-serif'") == 0, 'bold 残留'
assert ui.count('_miniPulseTimer') >= 4, '_miniPulseTimer 引用异常'
wr('js/ui.js', ui)

# ============ index.html：CSS ============
html = rd('index.html')

# ① .mini-wrap 加定位上下文
old_mw = "  .mini-wrap { display: flex; justify-content: center; margin: var(--sp-3) 0 var(--sp-1); }\n"
new_mw = ("  .mini-wrap { display: flex; justify-content: center; margin: var(--sp-3) 0 var(--sp-1);\n"
          "    position: relative; }   /* v89.132：波纹层（.mini-pulse）的定位上下文 */\n")
html = rep1(html, old_mw, new_mw, 'CSS mini-wrap')

# ② .mini-pulse 覆盖层（插在 .mini-full .mini-wrap canvas 规则后）
old_cv = ("  .mini-full .mini-wrap canvas {\n"
          "    width: min(100%, calc(100vh - 190px)); height: auto; aspect-ratio: 1 / 1;\n"
          "    cursor: crosshair; border-width: 3px;\n"
          "  }\n")
new_cv = (old_cv +
          "  /* v89.132（老板）：波纹层 —— 盖在底图上、居中对称；border/背景一概去掉，\n"
          "     否则会继承上方两条 canvas 规则的金框（同特异性时本条后定义者胜）。 */\n"
          "  .mini-wrap canvas.mini-pulse {\n"
          "    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);\n"
          "    pointer-events: none; border: none; background: transparent;\n"
          "  }\n")
html = rep1(html, old_cv, new_cv, 'CSS mini-pulse')

# ③ 图例「我城」色改红（与红点同源）
old_lg = "                 --lg-zhou: #ffd76a; --lg-jun-c: #f2ead0; --lg-cty: #9fe08a; --lg-me: #ffe9a0; }\n"
new_lg = ("                 --lg-zhou: #ffd76a; --lg-jun-c: #f2ead0; --lg-cty: #9fe08a;\n"
          "                 --lg-me: #ff3a2a; }   /* v89.132：我城点金→红（与 miniMeDot 同色） */\n")
html = rep1(html, old_lg, new_lg, 'CSS 图例色')

assert html.count('#ff3a2a') >= 1
wr('index.html', html)

# ============ main.js：主循环每秒重绘底部小图 ============
mj = rd('js/main.js')
old_loop = ("        ui.syncHeader();\n"
            "        ui.syncBadges();\n"
            "        if (ui.view === 'map') ui.renderMapCanvas();\n")
new_loop = ("        ui.syncHeader();\n"
            "        ui.syncBadges();\n"
            "        /* v89.132（老板「当前玩家所在城池的点出现闪烁…提示当前所在位置」）：\n"
            "           底部条缩略图每秒重绘 —— 我城红点随秒交替明暗（1Hz 闪烁）。 */\n"
            "        ui.paintMiniBottom();\n"
            "        if (ui.view === 'map') ui.renderMapCanvas();\n")
mj = rep1(mj, old_loop, new_loop, 'main 主循环')
wr('js/main.js', mj)

print('OK · ui.js', len(ui), '· index.html', len(html), '· main.js', len(mj))
