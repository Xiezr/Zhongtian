# -*- coding: utf-8 -*-
"""v89.2 UI：sceneFxHTML 场景化改造 —— 场景画布 + 热点点选（spot）+ 时机条（timing）+ 选项图标。
   另：renderSceneFx 挂绘制与计时器、closeSceneFx 清计时器、main.js 加 sxf-stop。探针幂等。"""
import io

def sub(path, old, new, tag, probe):
    d = io.open(path, encoding='utf-8', newline='').read()
    if probe in d:
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, '%s 锚点命中 %d 处' % (tag, c)
    d = d.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(d)
    print('OK ' + tag)

# ============ ① 辅助函数（锚点/模式/时机/图标/绘制） ============
HELPERS = r'''  /* v89.2（老板「纯选择，缺少场景交互 …… 我想看见个湖，而不是一行字」）——
     两个新交互原语（数据驱动、引擎零改动）：
       · spot   —— 第 1 幕变成**场景热点**：在画里点地点，而不是读三个按钮；
       · timing —— 关键一幕变成**时机条**：看准了再停手，命中三档（正中/不错/脱手）。
     选项编号仍是 scenePick(i) 的 i，三档即三个选项 —— 可复现不变式保持。 */
  ui.SXF_ANCHORS = {
    lake:    [[0.13, 0.62], [0.53, 0.56], [0.86, 0.60]],
    fort:    [[0.31, 0.62], [0.62, 0.50], [0.86, 0.58]],
    array:   [[0.27, 0.60], [0.52, 0.54], [0.76, 0.58]],
    meadow:  [[0.22, 0.54], [0.52, 0.68], [0.80, 0.56]],
    grove:   [[0.28, 0.62], [0.55, 0.52], [0.78, 0.60]],
    cottage: [[0.37, 0.60], [0.56, 0.50], [0.80, 0.62]],
    road:    [[0.30, 0.62], [0.50, 0.54], [0.80, 0.60]],
    marsh:   [[0.22, 0.58], [0.52, 0.50], [0.80, 0.62]],
    ruin:    [[0.42, 0.58], [0.62, 0.58], [0.82, 0.64]],
    hunt:    [[0.25, 0.62], [0.52, 0.54], [0.80, 0.64]],
    steppe:  [[0.26, 0.58], [0.55, 0.50], [0.80, 0.60]],
    yard:    [[0.28, 0.60], [0.55, 0.52], [0.78, 0.62]]
  };
  /* 一幕用哪种交互：时机 > 场景热点（第 1 幕，2~3 个选项）> 常规按钮 */
  ui.sxfStageMode = function (fly, idx, st) {
    if (st && st.t2) return 'timing';
    if (idx === 0 && st && st.o && st.o.length >= 2 && st.o.length <= 3
        && ui.SXF_ANCHORS[fly.scene]) return 'spot';
    return 'choice';
  };
  /* 时机判定（纯函数）：正中 / 不错 / 脱手 → 选项 0 / 1 / 2 */
  ui.sxfTimingGrade = function (pos) {
    if (pos >= 0.44 && pos <= 0.56) return 0;
    if (pos >= 0.28 && pos <= 0.72) return 1;
    return 2;
  };
  ui._sxfTick = null; ui._sxfT0 = 0; ui._sxfPos = 0;
  /* 指针位置：三角波 0→1→0，周期 1.6 秒 */
  ui.sxfTimingPos = function () {
    var per = 1600, t = (Date.now() - ui._sxfT0) % (per * 2);
    if (t < 0) t += per * 2;
    return t <= per ? t / per : (per * 2 - t) / per;
  };
  ui.sxfTimingStart = function () {
    ui._sxfT0 = Date.now(); ui._sxfPos = 0;
    if (ui._sxfTick) return;
    ui._sxfTick = setInterval(function () {
      var el = document.getElementById('sxf-mark');
      if (!el) return;
      ui._sxfPos = ui.sxfTimingPos();
      el.style.left = (4 + ui._sxfPos * 92) + '%';
    }, 40);
  };
  ui.sxfTimingClear = function () {
    if (ui._sxfTick) { clearInterval(ui._sxfTick); ui._sxfTick = null; }
  };
  /* 停手 → 按命中档选对应选项（pos 可注入：测试用） */
  ui.sxfTimingStop = function (pos) {
    var p = (typeof pos === 'number') ? pos : ui.sxfTimingPos();
    ui.sxfTimingClear();
    GAME.doScenePick(ui.sxfTimingGrade(p));
  };
  /* 选项图标：由修正系数派生，让同一幕几个选项一眼不同 */
  ui.sxfOptIcon = function (e) {
    e = e || {};
    if (e.wound && e.wound > 1) return '🔥';
    if (e.wound && e.wound < 1) return '🛡️';
    if (e.pow && e.pow > 1) return '⚔️';
    if (e.reward && e.reward > 1) return '🎁';
    if (e.luck) return '🍀';
    return '·';
  };
  /* 把当前场景画到画布上（ctx 缺失时静默跳过：测试桩环境安全） */
  ui.paintSceneFx = function () {
    var el = document.getElementById('scene-fx');
    var fx = ui._sceneFx;
    if (!el || !fx || !GAME.map || !GAME.map.paintScene) return;
    var cv = el.querySelector ? el.querySelector('canvas.sxf-canvas') : null;
    if (!cv || !cv.getContext) return;
    var ctx = null;
    try { ctx = cv.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return;
    GAME.map.paintScene(ctx, fx.fly.scene || 'meadow', fx.chk.x * 31 + fx.chk.y * 17);
  };
'''
sub(r'E:\Deepseekdb\js\ui.js',
    """  /* 对白高亮：先转义、再把「……」独立成段（避免注入） */
  ui.sxfQuote = function (t) {
    return U.escape(t).replace(/「[^」]*」/g, '<span class="sxf-q">$&</span>');
  };
""",
    """  /* 对白高亮：先转义、再把「……」独立成段（避免注入） */
  ui.sxfQuote = function (t) {
    return U.escape(t).replace(/「[^」]*」/g, '<span class="sxf-q">$&</span>');
  };
""" + HELPERS, 'v89.2 辅助函数', 'ui.SXF_ANCHORS = {')

# ============ ② sceneFxHTML 全量替换 ============
NEW_SFX = r'''  ui.sceneFxHTML = function (fx) {
    var a = fx.chk.act;
    var fly = fx.fly;
    var gen = fx.chk.gen;
    var tile = GAME.map.tile(fx.chk.x, fx.chk.y) || {};
    var tdef = DATA.TERRAIN[tile.terrain] || {};
    var total = fly.stages.length;
    var dayN = (fx.chk.day || 0) + 1;
    /* 幕景横幅底纹：地形染色（hex → rgba；无颜色定义时退回面板色） */
    var tint = '';
    if (tdef.color) {
      var v = parseInt(tdef.color.slice(1), 16);
      var rgb = (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255);
      tint = 'background:linear-gradient(135deg,rgba(' + rgb + ',.24),rgba(' + rgb + ',.04) 62%),var(--panel-bg);';
    }
    /* 天时（story 缺席时静默省略） */
    var we = (GAME.story && GAME.story.currentWeather) ? GAME.story.currentWeather() : null;
    var se = (GAME.story && GAME.story.currentSeason) ? GAME.story.currentSeason() : null;
    var meta = [];
    if (tdef.name) meta.push(U.escape(tdef.name) + '（' + fx.chk.x + ',' + fx.chk.y + '）');
    meta.push('野地 Lv' + fx.chk.lv);
    meta.push('第 ' + dayN + ' 日' + (se && se.name ? ' · ' + U.escape(se.name) : ''));
    if (we) meta.push(we.icon + U.escape(we.name || ''));
    var st = (fx.phase === 'stage') ? fly.stages[fx.stage] : null;
    var mode = st ? ui.sxfStageMode(fly, fx.stage, st) : '';

    var h = '<div class="sxf-wrap">';
    /* —— 顶栏：活动 / 门类 / 君主 / 天时 —— */
    h += '<div class="sxf-hero"' + (tint ? ' style="' + tint + '"' : '') + '>';
    h += '<span class="sxf-hero-art" aria-hidden="true">' + (fly.art || '📜') + '</span>';
    h += '<div class="sxf-hero-top">';
    h += '<span class="sxf-act-ic">' + a.icon + '</span>';
    h += '<span class="sxf-hero-name">' + U.escape(a.name) + '</span>';
    h += '<span class="sxf-hero-kind">' + U.escape(ui.SXF_KIND[a.kind] || '江湖') + '</span>';
    h += '<span class="sxf-hero-lord">' + ui.faceOf(gen, 44) +
      '<span class="sxf-lord-meta"><b>' + U.escape(gen.name) + '</b>' +
      '<span class="sxf-lord-sub">灵力 ' + GAME.lingPowerOf(gen) + ' · 精力 ' + Math.round(gen.energy || 0) +
      ' · 体力 ' + Math.round(GAME.staNow(gen)) + '</span></span></span>';
    h += '</div>';
    h += '<div class="sxf-hero-meta">' + meta.join('　·　') + '</div>';
    if (fx.phase === 'stage') {
      var dots = '';
      for (var i = 0; i < total; i++) dots += '<span class="sxf-dot' + (i <= fx.stage ? ' on' : '') + '">' + (i <= fx.stage ? '◆' : '◇') + '</span>';
      h += '<div class="sxf-hero-foot"><span class="sxf-dots">' + dots + '</span>' +
        '<button class="btn sm" data-action="sxf-escape">' + U.escape(fly.escLabel || '就此离去') + '</button></div>';
    }
    h += '</div>';
    /* —— v89.2 场景插画（看见湖，而不是一行字；第 1 幕直接点画选点）—— */
    h += '<div class="sxf-scene' + (fx.phase === 'result' ? ' is-done' : '') + '">';
    h += '<canvas class="sxf-canvas" width="1720" height="520" aria-hidden="true"></canvas>';
    if (mode === 'spot') {
      var anchors = ui.SXF_ANCHORS[fly.scene] || [];
      h += '<div class="sxf-spots">';
      for (var si = 0; si < st.o.length; si++) {
        var op0 = st.o[si];
        var pt = anchors[si] || [0.25 + si * 0.25, 0.62];
        h += '<button class="btn sxf-opt sxf-spot" data-action="sxf-choice" data-i="' + si + '"' +
          ' style="left:' + (pt[0] * 100).toFixed(1) + '%;top:' + (pt[1] * 100).toFixed(1) + '%;"' +
          ' title="' + U.escape(op0.d || op0.l) + '">' +
          '<span class="sxf-spot-hit" aria-hidden="true"></span>' +
          '<span class="sxf-spot-lb"><b>' + U.escape(op0.l) + '</b>' + ui.sxfBadges(op0.e) + '</span>' +
          '</button>';
      }
      h += '</div>';
      h += '<div class="sxf-sc-tip">点画中之处 —— 落子于此</div>';
    }
    h += '</div>';
    /* —— 行程时间线（已走过的幕题与当时抉择）—— */
    if (fx.picks.length) {
      h += '<div class="sxf-timeline"><span class="sxf-tl-cap">行程</span>';
      for (var pi = 0; pi < fx.picks.length; pi++) {
        var stDef = fly.stages[pi] || {};
        h += '<span class="sxf-tl-item">' + U.escape(stDef.s || ('第' + (pi + 1) + '幕')) +
          '<span class="sxf-tl-l">' + U.escape(fx.picks[pi].l) + '</span></span>';
        if (pi < fx.picks.length - 1) h += '<span class="sxf-tl-sep">›</span>';
      }
      h += '</div>';
    }
    if (fx.phase === 'stage') {
      /* —— 当前幕：幕题条 + 叙事卡 + 交互区（热点 / 时机 / 按钮）—— */
      h += '<div class="sxf-stage">';
      h += '<div class="sxf-stage-tag"><span class="sxf-stage-no">第 ' + (fx.stage + 1) + ' / ' + total + ' 幕</span>' +
        (st.s ? '<span class="sxf-stage-tt">' + U.escape(st.s) + '</span>' : '') + '</div>';
      h += '<div class="sxf-narr">' + ui.sxfQuote(st.t) + '</div>';
      if (mode === 'timing') {
        h += '<div class="sxf-timing">' +
          '<div class="sxf-tk"><span class="sxf-zone sxf-zone-g" aria-hidden="true"></span>' +
          '<span class="sxf-zone sxf-zone-p" aria-hidden="true"></span>' +
          '<span class="sxf-mark" id="sxf-mark" aria-hidden="true"></span></div>' +
          '<div class="sxf-tm-row">' +
          '<span class="sxf-tm-hint">看准时机 —— 正中者事半功倍，脱手者得不偿失</span>' +
          '<button class="btn gold lg" data-action="sxf-stop">' + U.escape(st.t2 || '就是现在！') + '</button>' +
          '</div></div>';
      } else if (mode === 'choice') {
        h += '<div class="sxf-opts">' + st.o.map(function (op, oi) {
          return '<button class="btn sxf-opt" data-action="sxf-choice" data-i="' + oi + '">' +
            '<span class="sxf-opt-ic" aria-hidden="true">' + ui.sxfOptIcon(op.e) + '</span>' +
            '<span class="sxf-opt-l"><b>' + U.escape(op.l) + '</b>' +
            (op.d ? '<span class="sxf-opt-d">' + U.escape(op.d) + '</span>' : '') + '</span>' +
            '<span class="sxf-opt-b">' + ui.sxfBadges(op.e) + '</span></button>';
        }).join('') + '</div>';
      }
      h += '<div class="sxf-note">' +
        (fx.spent ? '已动身 —— 中途罢手，所耗精力体力不返；此地此事今日即算已过。'
                  : '尚未动身 —— 此时离去，无任何消耗。') + '</div>';
      h += '</div>';
    } else {
      /* —— 专属退出结算卡 —— */
      var ex = fly.exits[fx.grade] || fly.exits.win || fly.exits.escape;
      var res = fx.result || {};
      var gcol = fx.grade === 'win' ? 'var(--gold)' : (fx.grade === 'lose' ? 'var(--red-light)' : 'var(--text-dim)');
      h += '<div class="sxf-result">';
      h += '<div class="sxf-emblem" style="color:' + gcol + ';">' + ex.ic + '</div>';
      h += '<div class="sxf-exit-t" style="color:' + gcol + ';">' + U.escape(ex.t) + '</div>';
      h += '<div class="sxf-exit-s">' + U.escape(ex.s || '') + '</div>';
      h += '<div class="sxf-loot">';
      if (res.escaped) {
        h += '<div class="sxf-loot-row' + (fx.spent ? ' bad' : '') + '">' +
          (fx.spent ? '审时度势，中途罢手 —— 所耗不返，此地此事今日已计入。'
                    : '尚未动身，转身离去 —— 未有任何消耗。') + '</div>';
      } else if (res.ok) {
        if (res.name) h += '<div class="sxf-loot-hd">' + U.escape(res.name) + '</div>';
        if (res.text) h += res.text.split('、').map(function (t2) {
          return '<div class="sxf-loot-row' + (res.bad ? ' bad' : '') + '">' + U.escape(t2) + '</div>';
        }).join('');
      }
      h += '</div>';
      if (!res.escaped || fx.spent) {
        h += '<div class="sxf-cost">耗：精力 -' + a.energy + ' · 体力 -' + a.stam +
          '　│　余：精力 ' + Math.round(gen.energy || 0) + ' · 体力 ' + Math.round(GAME.staNow(gen)) +
          (res.escaped ? '　（所耗不返）' : '') + '</div>';
      }
      h += '<div class="sxf-exit-row"><button class="btn gold lg" data-action="sxf-exit">' + U.escape(fly.backLabel || '打道回府') + '</button></div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  };
'''

d = io.open(r'E:\Deepseekdb\js\ui.js', encoding='utf-8', newline='').read()
if 'sxf-spots' in d:
    print('SKIP v89.2 sceneFxHTML')
else:
    a = d.find('  ui.sceneFxHTML = function (fx) {')
    b = d.find('  ui.closeSceneFx = function () {', a)
    assert a > 0 and b > a, '锚点 a=%d b=%d' % (a, b)
    d = d[:a] + NEW_SFX + d[b:]
    io.open(r'E:\Deepseekdb\js\ui.js', 'w', encoding='utf-8', newline='').write(d)
    print('OK v89.2 sceneFxHTML 已替换')

# ============ ③ renderSceneFx 挂绘制与计时器 ============
sub(r'E:\Deepseekdb\js\ui.js',
"""    el.style.display = 'block';
    el.innerHTML = ui.sceneFxHTML(fx);
    el.scrollTop = 0;
  };""",
"""    el.style.display = 'block';
    el.innerHTML = ui.sceneFxHTML(fx);
    el.scrollTop = 0;
    /* v89.2：把场景画到画布上；时机幕启动指针计时器 */
    ui.paintSceneFx();
    ui.sxfTimingClear();
    if (fx.phase === 'stage') {
      var st0 = fx.fly.stages[fx.stage];
      if (st0 && st0.t2) ui.sxfTimingStart();
    }
  };""", 'v89.2 renderSceneFx 绘制挂点', 'ui.paintSceneFx();\n    ui.sxfTimingClear();')

# ============ ④ closeSceneFx 清计时器 ============
sub(r'E:\Deepseekdb\js\ui.js',
"""  ui.closeSceneFx = function () {
    var fx = ui._sceneFx;
    ui._sceneFx = null;
    GAME.sceneFx = null;""",
"""  ui.closeSceneFx = function () {
    var fx = ui._sceneFx;
    ui._sceneFx = null;
    GAME.sceneFx = null;
    ui.sxfTimingClear();          /* v89.2：时机条计时器随层关闭清零 */""",
    'v89.2 closeSceneFx 清计时器', '时机条计时器随层关闭清零')

# ============ ⑤ main.js：sxf-stop 接线 ============
sub(r'E:\Deepseekdb\js\main.js',
"""      case 'sxf-escape': GAME.doSceneEscape(); break;""",
"""      case 'sxf-escape': GAME.doSceneEscape(); break;
      case 'sxf-stop': ui.sxfTimingStop(); break;   /* v89.2：时机条停手 */""",
    'v89.2 main.js sxf-stop', "case 'sxf-stop'")

# —— 复查 ——
d2 = io.open(r'E:\Deepseekdb\js\ui.js', encoding='utf-8', newline='').read()
import re
print('sceneFxHTML:', d2.count('ui.sceneFxHTML = function'), '| sxf-spot:', d2.count('sxf-spot'),
      '| sxf-timing:', d2.count('sxf-timing'), '| mode 分支:', d2.count("mode === '")) 
px = re.findall(r'font-size:\s*[0-9.]+px', d2)
print('ui.js 裸像素字号:', len(px), px)
