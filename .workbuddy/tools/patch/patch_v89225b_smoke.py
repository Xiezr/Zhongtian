# -*- coding: utf-8 -*-
"""v89.225 补丁 B：smoke 断言升级（族旗退役 → 地块染色）
段 1: PIX 导出 decode
段 2: SERAGE flag→plot
段 3: 七色可分 → 八族地块色可分（+离地）
段 4: 逐张挂旗 → 逐张无旗（PIX 版）
段 5: §21505 ⑪：挂旗 → 无旗（pngWh 版 + hitsInBox 工具）
段 6: 版本正则 ×3
段 7: 新增 §225 段（换族在册 / CSS 8 条 / 对齐 / 4 主题 / flag 退役）
"""
import io, os

BASE = 'E:/Deepseekdb/'
p = 'smoke-test.js'
s = io.open(BASE + p, encoding='utf-8', newline='').read()

def rep(tag, old, new):
    global s
    c = s.count(old)
    assert c == 1, '[%s] x%d: %r' % (tag, c, old[:80])
    s = s.replace(old, new)
    print('[ok] ' + tag)

# ---------- 段 1：PIX 导出 decode ----------
rep('1 PIX.decode 导出',
    "    return { hueSat: hueSat, de00: de00, rgbOfHsl: rgbOfHsl, hueSpread: hueSpread, hasColor: hasColor };",
    "    return { hueSat: hueSat, de00: de00, rgbOfHsl: rgbOfHsl, hueSpread: hueSpread, hasColor: hasColor, decode: decode };")

# ---------- 段 2：SERAGE flag→plot ----------
rep('2a SERAGE 注释块',
    """  /* v89.106（老板「还是有些城内建筑颜色很奇怪，而且没有区分度」）：**表格全撤，改读 DATA**。
     本轮之前这里抄着一份 SER_TGT/SER_IDS，素材工具里抄着另一份 SER_OF，data.js 里
     还写着第三份 —— 三份一漂移，围墙就被染成金色（data.js 写 mil，工具表写 gov）。
     现在：归属读 `DATA.SERIES_OF`，族色读 `DATA.SERIES[族].flag`，一处改、处处跟。 */""",
    """  /* v89.106（老板「还是有些城内建筑颜色很奇怪，而且没有区分度」）：**表格全撤，改读 DATA**。
     本轮之前这里抄着一份 SER_TGT/SER_IDS，素材工具里抄着另一份 SER_OF，data.js 里
     还写着第三份 —— 三份一漂移，围墙就被染成金色（data.js 写 mil，工具表写 gov）。
     现在：归属读 `DATA.SERIES_OF`，族色读 `DATA.SERIES[族].plot`（v89.225：旗退役后
     族色编码落到"地块染色"，flag 字段删除），一处改、处处跟。 */""")

rep('2b SERAGE 本体',
    """      var p = DATA.SERIES[k].flag;
      if (!p) bad.push(k + ' 无 flag');
      else if (!(p.h >= 0 && p.h < 360)) bad.push(k + ' 色相越界');
      else if (!(p.s > 0 && p.s <= 0.7)) bad.push(k + ' 饱和越界');
      else if (!(p.l > 0 && p.l <= 100)) bad.push(k + ' 明度越界');
    });
    return bad;
  })();
  check('v89.107：DATA.SERIES 每族都有 flag 旗色规格（h 度 / s 0~1 / l %）',
    SERAGE.length === 0, SERAGE.join('·') || (SER_KEYS.length + ' 族齐备'));""",
    """      var p = DATA.SERIES[k].plot;                 /* v89.225：flag 旗色 → plot 地块色 */
      if (!p) bad.push(k + ' 无 plot');
      else if (!(p.h >= 0 && p.h < 360)) bad.push(k + ' 色相越界');
      else if (!(p.s > 0 && p.s <= 60)) bad.push(k + ' 饱和越界');   /* 单位 = %（旧 flag 是 0~1） */
      else if (!(p.l > 0 && p.l <= 100)) bad.push(k + ' 明度越界');
    });
    return bad;
  })();
  check('v89.225：DATA.SERIES 每族都有 plot 地块色规格（h 度 / s % / l %）· 八族齐备',
    SERAGE.length === 0 && SER_KEYS.length === 8, SERAGE.join('·') || (SER_KEYS.length + ' 族齐备'));""")

rep('2c SER_TGT 取值',
    "    SER_TGT[k] = DATA.SERIES[k].flag.h;",
    "    SER_TGT[k] = DATA.SERIES[k].plot.h;")

# ---------- 段 3：七色可分 → 八族地块色 ----------
rep('3 两两可分断言',
    """  /* 判据从"色相步进"→"三选一"→（v89.106）CIEDE2000 —— v89.107 起**测旗色**：
     族色编码现在由旗承担（小面积高饱和），所以拿 data.js 的 flag 值直接算，
     这是设计契约（素材必须与它一致，见下一条"逐张挂旗"）。 */
  check('实测：族旗七色两两可分（CIEDE2000 ≥15 · 实测 24.8）', (function () {
    var ks = Object.keys(SER_TGT), bad = [], mn = 999, pair = '';
    var rgbOf = function (k) {
      var f = DATA.SERIES[k].flag;
      return PIX.rgbOfHsl(f.h, f.s, f.l / 100);
    };
    for (var i = 0; i < ks.length; i++) {
      for (var j = i + 1; j < ks.length; j++) {
        var d = PIX.de00(rgbOf(ks[i]), rgbOf(ks[j]));
        if (d < mn) { mn = d; pair = ks[i] + '/' + ks[j]; }
        if (d < 15) bad.push(ks[i] + '/' + ks[j] + ' ΔE00=' + d.toFixed(1));
      }
    }
    if (bad.length) console.log('      太像的组合：' + bad.join('，'));
    else console.log('      最小 ΔE00 = ' + mn.toFixed(1) + '（' + pair + '）');
    return bad.length === 0;
  })(), '旗色是族色编码的唯一载体');""",
    """  /* 判据从"色相步进"→"三选一"→（v89.106）CIEDE2000 →（v89.107）测旗色 →
     **v89.225：测"地块染色"**（族色编码从旗迁到城内地块；flag 字段删除，值读 plot）。
     门槛：族间 ≥10（实测默认主题最小 12.8 biz/live）· 与地面 ≥10（实测 13.7 gov）；
     CSS 的 --ser-* 必须与 plot 一致（见 §225③ 逐值对齐）。 */
  check('实测：八族地块色两两可分（ΔE00 ≥10 · 实测 12.8）+ 跳得出地面（≥10 · 实测 13.7）', (function () {
    var ks = Object.keys(SER_TGT), bad = [], mn = 999, pair = '', mnG = 999, who = '';
    var rgbOf = function (k) {
      var p2 = DATA.SERIES[k].plot;
      return PIX.rgbOfHsl(p2.h, p2.s / 100, p2.l / 100);
    };
    var GROUND225 = [0x8b, 0x9a, 0x78];
    for (var i = 0; i < ks.length; i++) {
      for (var j = i + 1; j < ks.length; j++) {
        var d = PIX.de00(rgbOf(ks[i]), rgbOf(ks[j]));
        if (d < mn) { mn = d; pair = ks[i] + '/' + ks[j]; }
        if (d < 10) bad.push(ks[i] + '/' + ks[j] + ' ΔE00=' + d.toFixed(1));
      }
      var dg = PIX.de00(rgbOf(ks[i]), GROUND225);
      if (dg < mnG) { mnG = dg; who = ks[i]; }
      if (dg < 10) bad.push(ks[i] + '/地面 ΔE00=' + dg.toFixed(1));
    }
    if (bad.length) console.log('      太像的组合：' + bad.join('，'));
    else console.log('      最小族间 ΔE00 = ' + mn.toFixed(1) + '（' + pair + '）· 最小离地 = ' + mnG.toFixed(1) + '（' + who + '）');
    return bad.length === 0;
  })(), '地块色是族色编码的唯一载体（旗已退役）');""")

# ---------- 段 4：逐张挂旗 → 逐张无旗（PIX 版） ----------
rep('4 逐张无旗断言',
    """  /* 逐张"挂旗"核验：每张图都得真含着**自己族的旗色**（±容差）——
     挡住"改了 flag 忘了重画旗"与"某张图漏画"。
     为什么不用"整体色相"判据了：材质自然之后整体色相本来就该各异，
     再拿整体色相去卡族色，等于把画重新变成色块（前三轮的病根）。 */
  check('实测：16 张图标逐张挂着自己族的旗（旗色像素在册 ±容差）', (function () {
    var bad = [], n = 0;
    Object.keys(SER_IDS).forEach(function (ser) {
      var f = DATA.SERIES[ser].flag;
      var want = PIX.rgbOfHsl(f.h, f.s, f.l / 100);
      SER_IDS[ser].forEach(function (id) {
        var hit = PIX.hasColor(path.join(AIDIR, 'ai_' + id + '.png'), want, 12);
        n++;
        if (!hit) bad.push(id + '（' + ser + '）');
      });
    });
    if (bad.length) console.log('      未挂旗：' + bad.join(' '));
    console.log('      ' + (n - bad.length) + '/' + n + ' 张已挂旗');
    return bad.length === 0 && n >= 16;
  })());""",
    """  /* v89.225：族旗退役（老板：「带颜色棋子好突兀，改用地块颜色区分」）——判据**反转**：
     16 张图标**旗位区域不得再有族旗色**（防"清了素材忘了改数据"与"管线回潮"）。
     墓碑色表 = v89.107 七族旗色（RGB）；容差欧氏 15（16 张实测：无旗 ≤448px ·
     有旗 ≈4806px）；gate 侧同口径（wasteland_batch.py 的 HIST_FLAG_RGB /
     阈值 buildingNoFlagMaxPx=1500）。 */
  var HIST_FLAG_RGB = [[205, 160, 55], [231, 227, 213], [104, 76, 39], [44, 125, 100], [43, 82, 136], [196, 70, 59], [110, 155, 175]];
  var flagPxInBox = function (file, want, tol) {
    var png = PIX.decode(file);
    if (!png) return -1;
    var x0 = Math.floor(png.w * 0.62), x1 = Math.ceil(png.w * 0.87);
    var y0 = Math.floor(png.h * 0.58), y1 = Math.ceil(png.h * 0.78);
    var hit = 0;
    for (var y = y0; y < y1; y++) {
      for (var x = x0; x < x1; x++) {
        var i = (y * png.w + x) * png.bpp;
        if (png.bpp === 4 && png.data[i + 3] < 200) continue;
        var dr = png.data[i] - want[0], dg = png.data[i + 1] - want[1], db = png.data[i + 2] - want[2];
        if (dr * dr + dg * dg + db * db <= tol * tol) hit++;
      }
    }
    return hit;
  };
  check('实测：16 张图标逐张**无族旗色**（旗位区域 · 防回潮）', (function () {
    var bad = [], n = 0, worstAll = 0;
    Object.keys(SER_IDS).forEach(function (ser) {
      SER_IDS[ser].forEach(function (id) {
        var f = path.join(AIDIR, 'ai_' + id + '.png');
        if (!fs.existsSync(f)) return;                 /* 无位图的走兜底层 */
        n++;
        var worst = 0;
        HIST_FLAG_RGB.forEach(function (w) {
          var hits = flagPxInBox(f, w, 15);
          if (hits > worst) worst = hits;
        });
        if (worst > worstAll) worstAll = worst;
        if (worst >= 1500) bad.push(id + '=' + worst);
      });
    });
    if (bad.length) console.log('      仍含族旗色：' + bad.join(' '));
    console.log('      ' + n + ' 张核验 · 旗位最大命中 ' + worstAll + 'px（阈值 1500）');
    return bad.length === 0 && n >= 16;
  })());""")

# ---------- 段 5：§21505 ⑪ 挂旗 → 无旗（pngWh 版） ----------
rep('5a pngWh.hitsInBox 工具',
    """      pngWh.rgb = function (h, s, l) {""",
    """      /* v89.225：旗位区域内的"墓碑旗色"命中计数（逐张无旗判据用；全采样）。 */
      pngWh.hitsInBox = function (file, want, tol) {
        var p = decode(file);
        if (!p) return -1;
        var x0 = Math.floor(p.w * 0.62), x1 = Math.ceil(p.w * 0.87);
        var y0 = Math.floor(p.h * 0.58), y1 = Math.ceil(p.h * 0.78);
        var hit = 0;
        for (var y = y0; y < y1; y++) {
          for (var x = x0; x < x1; x++) {
            var i = (y * p.w + x) * p.bpp;
            if (p.bpp === 4 && p.data[i + 3] < 200) continue;
            var dr = p.data[i] - want[0], dg = p.data[i + 1] - want[1], db = p.data[i + 2] - want[2];
            if (dr * dr + dg * dg + db * db <= tol * tol) hit++;
          }
        }
        return hit;
      };
      pngWh.rgb = function (h, s, l) {""")

rep('5b ⑪ 断言本体',
    """    check('⑪ 素材像素：16 张建筑图标都是**图集管线产物**（512 统一裁切）+ 逐张挂旗', (function () {
      /* v89.107：判据换了三次，最后一次是被病根逼的 ——
         「逐张对齐 paint 色相」这类判据的隐含前提是"图是染出来的"，
         而 v89.107 查明的病根恰恰是**原始图是单色剪影**（色散 7°），
         染色只是给单色块换色（所以老板连说四轮"不对劲"）。
         现在图是**重绘**的（材质自然），族色由旗承担，于是这里：
           ① 尺寸 = 512×512（图集管线 split_atlas.py 的统一裁切规格，改回旧图即红）；
           ② 每张图里真的能找到**自己族的旗色**（±12 ΔE00）。 */
      var bad = [], n = 0;
      Object.keys(DATA.BUILDINGS).forEach(function (id) {
        var ser = DATA.BUILDINGS[id].series;
        if (!ser) { bad.push(id + ':BUILDINGS 缺 series'); return; }
        var flag = DATA.SERIES[ser] && DATA.SERIES[ser].flag;
        if (!flag) { bad.push(id + ':' + ser + ' 缺 flag'); return; }
        var f = _p.join(__dirname, 'assets/icons/ui/ai_' + id + '.png');
        if (!_fs.existsSync(f)) return;                       /* 无位图的走兜底层 */
        n++;
        var wh = pngWh(f);
        if (!wh) { bad.push(id + ':解码失败'); return; }
        if (wh[0] !== 512 || wh[1] !== 512) bad.push(id + ':' + wh.join('×') + '（应 512×512）');
        var want = pngWh.rgb(flag.h, flag.s, flag.l / 100);
        if (!pngWh.has(f, want, 70)) bad.push(id + ':未见族旗色');
      });
      if (bad.length) console.log('     ' + bad.join(' · '));
      return bad.length === 0 && n >= 16;
    })(), '16 张逐张核（改回旧素材/漏画旗会被当场拦下）');""",
    """    check('⑪ 素材像素：16 张建筑图标都是**图集管线产物**（512 统一裁切）+ 逐张无族旗（v89.225）', (function () {
      /* v89.225：原"逐张挂旗"判据**反转** —— 族旗退役（族色编码改城内地块染色，
         见 §225 与 index.html 的 --ser-*）。本判据守两头：
           ① 尺寸 = 512×512（图集管线统一裁切规格，改回旧图即红）；
           ② 旗位区域不得再含族旗色（墓碑色表 ± 欧氏 15；有旗 ≈4806px，无旗 ≤448px）。 */
      var bad = [], n = 0;
      var HIST = [[205, 160, 55], [231, 227, 213], [104, 76, 39], [44, 125, 100], [43, 82, 136], [196, 70, 59], [110, 155, 175]];
      Object.keys(DATA.BUILDINGS).forEach(function (id) {
        var f = _p.join(__dirname, 'assets/icons/ui/ai_' + id + '.png');
        if (!_fs.existsSync(f)) return;                       /* 无位图的走兜底层 */
        n++;
        var wh = pngWh(f);
        if (!wh) { bad.push(id + ':解码失败'); return; }
        if (wh[0] !== 512 || wh[1] !== 512) bad.push(id + ':' + wh.join('×') + '（应 512×512）');
        var worst = 0;
        HIST.forEach(function (w) { var h2 = pngWh.hitsInBox(f, w, 15); if (h2 > worst) worst = h2; });
        if (worst >= 1500) bad.push(id + ':旗位含族旗色 ' + worst);
      });
      if (bad.length) console.log('     ' + bad.join(' · '));
      return bad.length === 0 && n >= 16;
    })(), '16 张逐张核（尺寸/无旗；改回旧素材或漏清旗会被当场拦下）');""")

# ---------- 段 6：版本正则 ×3 ----------
c = s.count("/GAME\\.VERSION = 'v89\\.224'/")
assert c == 3, 'ver x%d' % c
s = s.replace("/GAME\\.VERSION = 'v89\\.224'/", "/GAME\\.VERSION = 'v89\\.225'/")
print('[ok] 6 版本正则 ×3 → v89.225')

io.open(BASE + p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(BASE + p + '.tmp', BASE + p)
print('=== smoke 段 1-6 已落盘 ===')
