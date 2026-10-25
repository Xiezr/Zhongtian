/* ============================================================
 * probe_minimap_labels.js  「天下大势」缩略图 —— 城名标注标定探针（node 直接跑）
 * ------------------------------------------------------------
 * 老板三条（v89.47）：①缩略图放大到满界面 ②增大都/州/郡城名称与示意点 ③点选跳转。
 * 本探针回答 ② 的两件事：
 *   ① 到底有几座 都/州/郡 城，名字多长（决定字号档位）；
 *   ② 在 1000px 缩略图上**标了名字会不会互相压字** ——
 *      按 CJK 字宽 ≈ 1em 估算文本框，做一次粗碰撞检测（同名/近邻）。
 *   同时给出「画不画县名」的依据：县有多少座、密度如何。
 * 用法：node tools/probe/probe_minimap_labels.js
 * ============================================================ */
(function () {
  global.window = global;
  global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] || null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  function makeEl() {
    return {
      tagName: 'DIV', textContent: '', innerHTML: '', value: '', dataset: {}, style: {}, _attrs: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } },
      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      getContext: function () { return null; }
    };
  }
  global.document = {
    createElement: function () { return makeEl(); },
    querySelector: function () { return makeEl(); },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}, readyState: 'complete'
  };
  global.requestAnimationFrame = function (f) { return f && f(); };
  global.location = { search: '', href: 'file:///index.html' };
  global.addEventListener = function () {};
  global.getComputedStyle = function () { return { getPropertyValue: function () { return ''; } }; };
  global.innerWidth = 1440; global.innerHeight = 900;

  var pathMod = require('path');
  /* 与 index.html 同序加载（stateOfCity 在 domain/systems 里定义，必须齐） */
  ['data', 'state', 'questdata', 'systems', 'domain', 'map'].forEach(function (m) {
    require(pathMod.join(__dirname, '..', '..', 'js', m + '.js'));
  });

  var G = global.GAME, DATA = G.DATA;
  G.newGame({ name: '探针', avatar: '🧔', gender: 'male', region: 'random' });
  G.map.generate();

  var W = DATA.MAP_W, P = 1000 / W;          /* 离屏 1000px：2px / 格 */
  var all = G.state.map.cities || [];
  var byType = { capital: [], zhou: [], jun: [], county: [] };
  all.forEach(function (c) { if (byType[c.type]) byType[c.type].push(c); });

  console.log('世界 ' + W + '×' + W + ' · 离屏 1000px（' + P + 'px / 格）· NPC 城 ' + all.length + ' 座');
  console.log('');
  console.log('档位   座数   名字（前 8）');
  ['capital', 'zhou', 'jun', 'county'].forEach(function (t) {
    var arr = byType[t];
    console.log('  ' + t + '  ' + String(arr.length).padStart(4) + '   ' +
      arr.slice(0, 8).map(function (c) { return c.name; }).join(' / '));
  });

  /* ---- 名字长度分布 ---- */
  console.log('');
  console.log('名字长度分布（都/州/郡）：');
  var lenHist = {};
  ['capital', 'zhou', 'jun'].forEach(function (t) {
    byType[t].forEach(function (c) {
      var n = String(c.name || '').length;
      lenHist[n] = (lenHist[n] || 0) + 1;
    });
  });
  Object.keys(lenHist).sort().forEach(function (k) { console.log('   ' + k + ' 字 × ' + lenHist[k]); });

  /* ---- 候选字号下的碰撞检测（CJK 字宽 ≈ 1em） ---- */
  /* 标注框：以城点为中心，宽 = 字号 × 字数，高 = 字号；上下各垫 2px。
     点选方块半径也要占位：取 dotW/2。 */
  function collide(fontPx, dotW, list, labelDy) {
    var boxes = list.map(function (c) {
      var cx = (c.x + 0.5) * P, cy = (c.y + 0.5) * P;
      var txt = String(c.name || '');
      var w = fontPx * txt.length, h = fontPx;
      var by = cy + (labelDy == null ? dotW / 2 + h / 2 + 3 : labelDy);
      return { cx: cx, cy: cy, x0: cx - w / 2, y0: by - h / 2, x1: cx + w / 2, y1: by + h / 2, n: txt };
    });
    var hit = 0, worst = null;
    for (var i = 0; i < boxes.length; i++) {
      for (var j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], b = boxes[j];
        if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
          hit++;
          var ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          if (!worst || ov > worst.ov) worst = { ov: ov, a: a.n, b: b.n };
        }
      }
    }
    return { hit: hit, worst: worst };
  }

  console.log('');
  console.log('标注碰撞（都/州/郡 · 共 ' + (byType.capital.length + byType.zhou.length + byType.jun.length) + ' 座 · 标签置于城点下方）：');
  console.log('  字号  点宽   重叠对数   最重重叠');
  [18, 20, 22, 26, 30].forEach(function (f) {
    [10, 14, 18].forEach(function (d) {
      var r = collide(f, d, byType.capital.concat(byType.zhou, byType.jun));
      console.log('   ' + String(f).padStart(2) + 'px  ' + String(d).padStart(3) + 'px   ' +
        String(r.hit).padStart(6) + '     ' +
        (r.worst ? (r.worst.a + '↔' + r.worst.b + ' 叠 ' + r.worst.ov.toFixed(0) + 'px') : '—'));
    });
  });

  /* ---- 「先下后上」翻转启发式：与 ui.miniLabels 内实现同构 ---- */
  /* 逐个落标签：默认在城点下方；若与已落标注重叠则翻到上方；仍叠则取重叠小的一侧。 */
  function placeFlip(fontPx, dotW, list) {
    var placed = [], flipped = 0, final = 0, worst = null;
    list.forEach(function (c) {
      var cx = (c.x + 0.5) * P, cy = (c.y + 0.5) * P;
      var txt = String(c.name || '');
      var w = fontPx * txt.length, h = fontPx;
      var dy = dotW / 2 + h / 2 + 3;
      function mk(sign) {
        var by = cy + sign * dy;
        return { x0: cx - w / 2, y0: by - h / 2, x1: cx + w / 2, y1: by + h / 2, n: txt, cx: cx, cy: cy, dot: dotW };
      }
      function ovSum(b) {
        var s = 0;
        for (var i = 0; i < placed.length; i++) {
          var a = placed[i];
          var ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          var oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (ox > 0 && oy > 0) s += Math.min(ox, oy);
        }
        return s;
      }
      var down = mk(1), up = mk(-1);
      var sd = ovSum(down), su = ovSum(up);
      var pick = (sd === 0) ? down : (su < sd ? (flipped++, up) : down);
      if (sd > 0) final++;
      if (sd > 0) {
        var pen = Math.min(sd, su);
        if (!worst || pen < worst) worst = pen;
      }
      placed.push(pick);
    });
    return { flipped: flipped, still: final, worst: worst };
  }
  console.log('');
  console.log('翻转启发式（叠则翻上方）后的残叠对数：');
  [18, 20, 22].forEach(function (f) {
    [14, 18].forEach(function (d) {
      var r = placeFlip(f, d, byType.capital.concat(byType.zhou, byType.jun));
      console.log('   ' + f + 'px 点' + d + 'px → 翻 ' + r.flipped + ' 座 · 仍叠 ' + r.still +
        ' 座' + (r.worst != null ? '（最小叠深 ' + r.worst.toFixed(0) + 'px）' : '（零叠）'));
    });
  });

  /* ---- 分级字号（都 > 州 > 郡）：各档自己的 fontK / dotK，跑同一套翻转启发式 ---- */
  function placeTiered(K, size) {
    var order = { capital: 0, zhou: 1, jun: 2 };
    var list = byType.capital.concat(byType.zhou, byType.jun).slice().sort(function (a, b) {
      return (order[a.type] - order[b.type]) || String(a.name).localeCompare(String(b.name));
    });
    var placed = [], flipped = 0, still = 0, worst = null;
    list.forEach(function (c) {
      var cx = (c.x + 0.5) * P, cy = (c.y + 0.5) * P;
      var fs = Math.max(9, Math.round(size * K.fontK[c.type]));
      var d = Math.max(5, Math.round(size * K.dotK[c.type]));
      var w = fs * String(c.name).length, h = fs, dy = d / 2 + h / 2 + Math.round(size * K.gapK);
      function mk(sign) {
        var ty = cy + sign * dy;
        return { x0: cx - w / 2, y0: ty - h / 2, x1: cx + w / 2, y1: ty + h / 2, fs: fs, d: d };
      }
      function ov(b) {
        var s = 0;
        for (var i = 0; i < placed.length; i++) {
          var a = placed[i];
          var ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          var oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (ox > 0 && oy > 0) s += Math.min(ox, oy);
        }
        return s;
      }
      var down = mk(1), up = mk(-1), sd = ov(down), su = ov(up);
      if (sd > 0) { still++; if (!worst || Math.min(sd, su) < worst) worst = Math.min(sd, su); }
      if (sd > 0 && su < sd) flipped++;
      placed.push(sd === 0 ? down : (su < sd ? up : down));
    });
    return { flipped: flipped, still: still, worst: worst };
  }
  console.log('');
  console.log('分级字号候选（size=1000 基准；都 2.7% / 州 2.3% / 郡 2.0%）：');
  [
    { name: 'A 平铺 2.0%', K: { fontK: { capital: 0.020, zhou: 0.020, jun: 0.020 }, dotK: { capital: 0.024, zhou: 0.019, jun: 0.015 }, gapK: 0.004 } },
    { name: 'B 分级 2.7/2.3/2.0', K: { fontK: { capital: 0.027, zhou: 0.023, jun: 0.020 }, dotK: { capital: 0.030, zhou: 0.022, jun: 0.015 }, gapK: 0.004 } },
    { name: 'C 分级 3.2/2.6/2.1', K: { fontK: { capital: 0.032, zhou: 0.026, jun: 0.021 }, dotK: { capital: 0.034, zhou: 0.024, jun: 0.016 }, gapK: 0.004 } }
  ].forEach(function (c) {
    var r = placeTiered(c.K, 1000);
    console.log('   ' + c.name.padEnd(18) + ' → 翻 ' + String(r.flipped).padStart(2) + ' 座 · 仍叠 ' +
      String(r.still).padStart(2) + ' 座' + (r.worst != null ? '（最小叠深 ' + r.worst.toFixed(0) + 'px）' : '（零叠）') +
      '  · 都 ' + Math.round(1000 * c.K.fontK.capital) + 'px / 州 ' + Math.round(1000 * c.K.fontK.zhou) +
      'px / 郡 ' + Math.round(1000 * c.K.fontK.jun) + 'px');
  });
  console.log('   （size=1000 基准：真机满界面约 size 880 → 字号 ×0.88；仍叠均为 0px 擦边即为可接受）');

  /* ---- 县：画不画 ---- */
  console.log('');
  var minD = 1e9, pair = null;
  var pts = byType.county.map(function (c) { return { x: (c.x + 0.5) * P, y: (c.y + 0.5) * P, n: c.name }; });
  for (var i = 0; i < pts.length; i++) {
    for (var j = i + 1; j < pts.length; j++) {
      var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < minD) { minD = dd; pair = pts[i].n + '↔' + pts[j].n; }
    }
  }
  console.log('县 ' + byType.county.length + ' 座 · 最近两县相距 ' + minD.toFixed(0) + 'px（1000px 图上）· ' + pair);
  console.log('→ 县名若 18px 字号（2 字宽 36px），相邻县名间距 ' + minD.toFixed(0) + 'px ⇒ ' +
    (minD < 40 ? '必然压字，县不标名' : '勉强可标'));

  /* ---- 满界面档的可用画布边长（按老板屏 1920×1080 估算） ---- */
  console.log('');
  console.log('可画布边长估算（100vh = 视口高）：');
  [900, 1080, 1440].forEach(function (vh) {
    var modal = vh - 16;
    var chrome = 5 * 2 + 12 * 2 + 56 + 20 + 50 + 12;   /* 框+内边距+标题+图例+页脚+间隙 */
    var room = modal - chrome;
    console.log('   vh ' + vh + ': 弹窗 ' + modal + ' → 画布可用高 ' + room +
      ' → 满界面画布 ' + Math.min(1440 - 16, room) + 'px（旧 500px 的 ' +
      (Math.min(1440 - 16, room) / 500).toFixed(1) + '×）');
  });
})();
