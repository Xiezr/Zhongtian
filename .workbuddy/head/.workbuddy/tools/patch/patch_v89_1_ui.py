# -*- coding: utf-8 -*-
"""v89.1 UI：sceneFxHTML 视觉升级（幕景横幅 / 行程时间线 / 幕题条 / 对白高亮 / 倾向徽章 / 结算卡）。
   新增辅助 ui.SXF_KIND · ui.sxfBadges · ui.sxfQuote；替换整个 sceneFxHTML。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\ui.js'
d = io.open(P, encoding='utf-8', newline='').read()

NEW = r'''  /* v89.1（老板：「只有文字，能不能再丰富一点」）——
     剧本视觉化：幕景横幅（地形染色 + 大字水印 + 活动徽记 + 君主头像 + 天时日号）、
     行程时间线、幕题条、对白高亮、选项倾向徽章、专属退出结算卡（光晕 + 战果 + 账单）。
     全部复用现有素材与主题变量（地形色 / 天气 / 头像），零新资源。 */
  ui.SXF_KIND = { fight: '征伐', trial: '试炼', gather: '采撷', cultivate: '修真', visit: '访贤', scene: '游历' };
  /* 选项倾向徽章：由修正系数直接生成（攻/获 = 增益 · 险/稳 = 负伤变化 · 缘 = 小幸运） */
  ui.sxfBadges = function (e) {
    e = e || {};
    var out = [];
    var pct = function (x) { return (x > 1 ? ' +' : ' -') + Math.abs(Math.round((x - 1) * 100)) + '%'; };
    if (e.pow && e.pow !== 1) out.push('<span class="sxf-bdg" style="color:var(--gold-light);">攻' + pct(e.pow) + '</span>');
    if (e.reward && e.reward !== 1) out.push('<span class="sxf-bdg" style="color:var(--green-ok);">获' + pct(e.reward) + '</span>');
    if (e.wound && e.wound !== 1) {
      out.push(e.wound > 1
        ? '<span class="sxf-bdg" style="color:var(--red-light);">险' + pct(e.wound) + '</span>'
        : '<span class="sxf-bdg" style="color:var(--blue-info);">稳' + pct(e.wound) + '</span>');
    }
    if (e.luck) out.push('<span class="sxf-bdg" style="color:var(--amber);">缘 +' + Math.round(e.luck * 100) + '</span>');
    return out.join('');
  };
  /* 对白高亮：先转义、再把「……」独立成段（避免注入） */
  ui.sxfQuote = function (t) {
    return U.escape(t).replace(/「[^」]*」/g, '<span class="sxf-q">$&</span>');
  };
  ui.sceneFxHTML = function (fx) {
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

    var h = '<div class="sxf-wrap">';
    /* —— 幕景横幅 —— */
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
      /* —— 当前幕：幕题条 + 叙事卡（对白高亮）+ 选项（倾向徽章）—— */
      var st = fly.stages[fx.stage];
      h += '<div class="sxf-stage">';
      h += '<div class="sxf-stage-tag"><span class="sxf-stage-no">第 ' + (fx.stage + 1) + ' / ' + total + ' 幕</span>' +
        (st.s ? '<span class="sxf-stage-tt">' + U.escape(st.s) + '</span>' : '') + '</div>';
      h += '<div class="sxf-narr">' + ui.sxfQuote(st.t) + '</div>';
      h += '<div class="sxf-opts">' + st.o.map(function (op, oi) {
        return '<button class="btn sxf-opt" data-action="sxf-choice" data-i="' + oi + '">' +
          '<span class="sxf-opt-l"><b>' + U.escape(op.l) + '</b>' +
          (op.d ? '<span class="sxf-opt-d">' + U.escape(op.d) + '</span>' : '') + '</span>' +
          '<span class="sxf-opt-b">' + ui.sxfBadges(op.e) + '</span></button>';
      }).join('') + '</div>';
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

a = d.find('  ui.sceneFxHTML = function (fx) {')
b = d.find('  ui.closeSceneFx = function () {', a)
assert a > 0 and b > a, 'sceneFxHTML 锚点未命中 a=%d b=%d' % (a, b)

if 'ui.sxfBadges = function' in d:
    print('SKIP v89.1 UI 已存在')
else:
    d = d[:a] + NEW + d[b:]
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK v89.1 UI 已写入')

# —— 幂等复查 ——
d2 = io.open(P, encoding='utf-8', newline='').read()
print('sceneFxHTML 数:', d2.count('ui.sceneFxHTML = function'), '(期望 1)',
      '| closeSceneFx 数:', d2.count('ui.closeSceneFx = function'), '(期望 1)')
print('sxf 类引用：hero', d2.count('sxf-hero'), '| bdg', d2.count('sxf-bdg'),
      '| emblem', d2.count('sxf-emblem'), '| tl-item', d2.count('sxf-tl-item'))
import re
px = re.findall(r'font-size:\s*[0-9.]+px', d2)
print('ui.js 裸像素字号:', len(px), px)
