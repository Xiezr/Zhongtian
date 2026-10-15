# -*- coding: utf-8 -*-
# v89.229 批 a4：smoke-test.js —— 既有断言口径更新 + 新增 §229a 段（城视图文字色块）
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
P = 'smoke-test.js'

def rd(): return io.open(BASE + P, encoding='utf-8', newline='').read()
def rep(s, old, new, tag, cnt=1):
    c = s.count(old)
    assert c == cnt, '[%s] count=%d' % (tag, c)
    return s.replace(old, new)

s = rd(); s0 = s

# ---------- ① §36③ badge 位置断言（绝对定位 → 并入名称行） ----------
s = rep(s,
"""  check('角标定位在格内右上', /\\.tile-badge \\{[\\s\\S]{0,140}right: 4px; top: 3px/.test(css36));""",
"""  /* v89.229 规则变更（老板「建筑名称和等级都放顶部」）：角标从"绝对定位右上角"
     并入名称行（格顶 · flex 行内）—— 判据按新口径重写（§0.7：不删、不放宽）。 */
  check('角标并入名称行（v89.229：格顶 · flex 行内 · 不再绝对定位右上角）',
    /\\.tile-badge \\{[\\s\\S]{0,80}position: static; flex: none;/.test(css36));""",
'badge36')

# ---------- ② §106 段 plot 色矩阵：新地面 + 新阈值 ----------
s = rep(s,
"""  /* 判据从"色相步进"→"三选一"→（v89.106）CIEDE2000 →（v89.107）测旗色 →
     **v89.225：测"地块染色"**（族色编码从旗迁到城内地块；flag 字段删除，值读 plot）。
     门槛：族间 ≥10（实测默认主题最小 12.8 biz/live）· 与地面 ≥10（实测 13.7 gov）；
     CSS 的 --ser-* 必须与 plot 一致（见 §225③ 逐值对齐）。 */
  check('实测：四族地块色两两可分（ΔE00 ≥10 · 实测 13.0）+ 与地面「可辨而不刺眼」（8~30 · v89.227 降对比）', (function () {""",
"""  /* 判据从"色相步进"→"三选一"→（v89.106）CIEDE2000 →（v89.107）测旗色 →
     （v89.225）测"地块染色" → **v89.229：测"名称文字色块"**（族色编码从地块迁到
     名称色块；值仍读 plot，语义 = 色块目标色）。
     门槛（v89.229 重定）：族间 ≥15（实测 23.5）· 与浅废土地面 ≥10（实测 15.2）——
     上限撤除：色块是小面积（12 字底），鲜明即目的（v89.227 的 30 上限是"大面积
     地块"时代定的；老板本轮正式开工前反馈"各系颜色晦暗，不好区分"）。
     CSS 的 --ser-* 必须与 plot 一致（见 §225③ 逐值对齐）。 */
  check('实测：四族名称色块两两可分（ΔE00 ≥15 · 实测 23.5）+ 都跳得出浅废土地面（≥10 · 实测 15.2）', (function () {""",
'c106-title')
s = rep(s,
"    var GROUND225 = [0x8b, 0x9a, 0x78];",
"    var GROUND225 = [0xa8, 0xa0, 0x8b];   /* v89.229：浅废土地面（原 [0x8b,0x9a,0x78] 灰绿） */",
'ground225')
s = rep(s,
"""        if (d < 10) bad.push(ks[i] + '/' + ks[j] + ' ΔE00=' + d.toFixed(1));""",
"""        if (d < 15) bad.push(ks[i] + '/' + ks[j] + ' ΔE00=' + d.toFixed(1));""",
'pair-thr')
s = rep(s,
"""      /* v89.227：下限 8 防「糊在地里」· 上限 30 防回潮到高对比（旧 8 族最高 45.9） */
      if (dg < 8) bad.push(ks[i] + '/地面 ΔE00=' + dg.toFixed(1) + '（太糊）');
      if (dg > 30) bad.push(ks[i] + '/地面 ΔE00=' + dg.toFixed(1) + '（太跳）');""",
"""      /* v89.229：下限 10 防「糊在地里」；上限撤除（色块小面积 → 鲜明即目的） */
      if (dg < 10) bad.push(ks[i] + '/地面 ΔE00=' + dg.toFixed(1) + '（太糊）');""",
'ground-thr')
s = rep(s,
"  })(), '地块色是族色编码的唯一载体（旗已退役）');",
"  })(), '名称色块是族色编码的唯一载体（地块染色已退役）');",
'c106-tail')

# ---------- ③ §106 段"素材 vs 地面"：地面值更新 ----------
s = rep(s,
"""  check('实测：各族都跳得出城内地面（与 #8b9a78 的 ΔE00 ≥12，防"糊在地里"）', (function () {
    var GROUND = [0x8b, 0x9a, 0x78], bad = [], mn = 999, who = '';""",
"""  check('实测：各族素材都跳得出城内地面（与 #a8a08b 的 ΔE00 ≥12，防"糊在地里"）', (function () {
    var GROUND = [0xa8, 0xa0, 0x8b], bad = [], mn = 999, who = '';""",
'c106-mat')

# ---------- ④ §225②：地块染色 → 名称色块 ----------
s = rep(s,
"""    /* ② 地块染色 4 条 CSS 规则在册（可执行形态，防注释误命中/防回退） */
    var miss225 = [];
    RULES225.forEach(function (k) {
      if (htmlFlat225.indexOf('.iso-tile.built.ser-' + k + ' .tile-face { background: var(--ser-' + k + '); }') < 0) miss225.push(k);
    });
    check('§225② 地块染色 4 条规则在册（.iso-tile.built.ser-x .tile-face → var(--ser-x)）',
      miss225.length === 0, miss225.join(' ') || '4/4');""",
"""    /* ② 名称色块 4 条 CSS 规则在册（v89.229：族色编码从"地块染色"迁到"名称文字色块"；
       可执行形态，防注释误命中/防回退）+ 地块染色零残留（负向） */
    var miss225 = [];
    RULES225.forEach(function (k) {
      if (htmlFlat225.indexOf('.iso-tile.built.ser-' + k + ' .tile-label .nm { background: var(--ser-' + k + '); }') < 0) miss225.push(k);
    });
    check('§225② 名称色块 4 条规则在册（.iso-tile.built.ser-x .tile-label .nm → var(--ser-x)）· 地块染色零残留',
      miss225.length === 0 && htmlFlat225.indexOf('.tile-face { background: var(--ser-') < 0,
      miss225.join(' ') || '4/4 · 地块染色已退役');""",
's225b')

# ---------- ⑤ §225③b：变换 → 设计表锁定 ----------
s = rep(s,
"""    /* ③b 其余三主题逐字节对齐（v89.226 复核补齐：light/bamboo/dark2 主题变换锁定。
       上一轮挂账项②「其余三主题未做逐字节断言」就此清掉 —— 变换由应用值反推、
       经独立 Python 路径全量验证（check_v89226_themes.py 32/32 逐值复现）。 */
    var THEME_X225 = {
      light:  function (p) { return [p.h, p.s / 100 * 0.95, Math.min(0.85, p.l / 100 * 1.15)]; },
      bamboo: function (p) { return [p.h, p.s / 100 * 0.88, Math.min(0.85, p.l / 100 * 1.19)]; },
      dark2:  function (p) { return [p.h, p.s / 100 * 1.00, p.l / 100 * 0.76]; }
    };
    var badB225 = [], okB225 = 0;
    RULES225.forEach(function (k) {
      var p2 = DATA.SERIES[k] && DATA.SERIES[k].plot;
      if (!p2) { badB225.push(k + ' 无 plot'); return; }
      var hexAll = (html225.match(new RegExp('--ser-' + k + ':\\\\s*(#[0-9a-f]{6});', 'g')) || [])
        .map(function (seg) { return seg.match(/#[0-9a-f]{6}/)[0]; });
      if (hexAll.length !== 4) { badB225.push(k + ' 块数=' + hexAll.length); return; }
      [['light', hexAll[1]], ['bamboo', hexAll[2]], ['dark2', hexAll[3]]].forEach(function (tt) {
        var v = THEME_X225[tt[0]](p2);
        var rgb = rgbOfHsl225(v[0], v[1], v[2]).map(function (x) { return Math.round(x); });
        var hex = '#' + rgb.map(function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
        if (hex !== tt[1]) badB225.push(k + '/' + tt[0] + ' 期望' + hex + ' 实得' + tt[1]);
        else okB225++;
      });
    });
    check('§225③b 其余三主题逐值对齐（light s×0.95/l×1.15cap85 · bamboo s×0.88/l×1.19cap85 · dark2 l×0.76）',
      badB225.length === 0, badB225.slice(0, 4).join(' ') || (okB225 + '/12 对齐'));""",
"""    /* ③b 其余三主题逐字节对齐（v89.229：色值重设计后，从"变换公式"改为**设计表锁定** ——
       silk/bamboo/night 的三份设计值逐字节核对，防漂移；原 v89.226 的变换反推断言
       随色值体系更替退役（那套只适用于"由 plot 变换生成"的旧体系）。 */
    var THEME_TBL229 = {
      silk:   { gov: '#897024', live: '#904c37', mil: '#3d5794', ops: '#347f70' },
      bamboo: { gov: '#897024', live: '#904c37', mil: '#3d5794', ops: '#347f70' },
      night:  { gov: '#8c742c', live: '#9a5642', mil: '#47619e', ops: '#397f71' }
    };
    var badB225 = [], okB225 = 0;
    RULES225.forEach(function (k) {
      var hexAll = (html225.match(new RegExp('--ser-' + k + ':\\\\s*(#[0-9a-f]{6});', 'g')) || [])
        .map(function (seg) { return seg.match(/#[0-9a-f]{6}/)[0]; });
      if (hexAll.length !== 4) { badB225.push(k + ' 块数=' + hexAll.length); return; }
      [['silk', hexAll[1]], ['bamboo', hexAll[2]], ['night', hexAll[3]]].forEach(function (tt) {
        if (THEME_TBL229[tt[0]][k] !== tt[1]) badB225.push(k + '/' + tt[0] + ' 期望' + THEME_TBL229[tt[0]][k] + ' 实得' + tt[1]);
        else okB225++;
      });
    });
    check('§225③b 其余三主题逐值对齐（silk/bamboo/night 设计表锁定 · 12 值逐字节）',
      badB225.length === 0, badB225.slice(0, 4).join(' ') || (okB225 + '/12 对齐'));""",
's225b3')

# ---------- ⑥ §225⑦ 之后插入 §229a 小节（⑧⑨⑩） ----------
s = rep(s,
"""    check('§225⑦ 四族齐备（gov/live/mil/ops 全在用）且无编外族', (function () {
      var fam = {};
      Object.keys(DATA.BUILDINGS).forEach(function (b) {
        var k = DATA.BUILDINGS[b].series;
        (fam[k] = fam[k] || []).push(b);
      });
      var need = ['gov', 'live', 'mil', 'ops'];
      var bad = need.filter(function (k) { return !fam[k] || !fam[k].length; });
      var extra = Object.keys(fam).filter(function (k) { return need.indexOf(k) < 0; });
      return bad.length === 0 && extra.length === 0;
    })(), (function () {
      var fam = {};
      Object.keys(DATA.BUILDINGS).forEach(function (b) {
        (fam[DATA.BUILDINGS[b].series] = fam[DATA.BUILDINGS[b].series] || []).push(b);
      });
      return Object.keys(fam).sort().map(function (k) { return k + ':' + fam[k].length; }).join(' ');
    })());
  })();""",
"""    check('§225⑦ 四族齐备（gov/live/mil/ops 全在用）且无编外族', (function () {
      var fam = {};
      Object.keys(DATA.BUILDINGS).forEach(function (b) {
        var k = DATA.BUILDINGS[b].series;
        (fam[k] = fam[k] || []).push(b);
      });
      var need = ['gov', 'live', 'mil', 'ops'];
      var bad = need.filter(function (k) { return !fam[k] || !fam[k].length; });
      var extra = Object.keys(fam).filter(function (k) { return need.indexOf(k) < 0; });
      return bad.length === 0 && extra.length === 0;
    })(), (function () {
      var fam = {};
      Object.keys(DATA.BUILDINGS).forEach(function (b) {
        (fam[DATA.BUILDINGS[b].series] = fam[DATA.BUILDINGS[b].series] || []).push(b);
      });
      return Object.keys(fam).sort().map(function (k) { return k + ':' + fam[k].length; }).join(' ');
    })());

    /* ============================================================
     * §229a（v89.229 批 a）：城视图 —— 地块去族色（统一浅废土底）·
     * 名称与等级都在格顶 · 名称文字色块承载族色编码（鲜明档）
     * ------------------------------------------------------------
     * 老板原话：「去掉城内地块颜色，统一废土底色（浅一点），建筑名称和等级都放顶部，
     *   建筑名称的文字色块行高调高，并以此此文字色块区分各系建筑。目前各系颜色晦暗，
     *   不好区分」。
     * ============================================================ */
    console.log('\\n===== §229a 城视图：统一底 + 名称/等级顶部色块 =====');
    var u225 = fs225.readFileSync(path225.join(__dirname, 'js', 'ui.js'), 'utf8');

    /* ⑧ 名称与等级都在格顶（源码级布局判据） */
    var ok8 = [], miss8 = [];
    if (!/\\.tile-label \\{[\\s\\S]{0,220}top: var\\(--sp-0\\);/.test(html225)) miss8.push('label 无 top');
    if (!/\\.tile-label \\{[\\s\\S]{0,220}left: var\\(--sp-1\\); right: var\\(--sp-1\\); top:/.test(html225)) miss8.push('label 顶部定位不全');
    if (/\\.tile-label \\{[\\s\\S]{0,220}bottom:/.test(html225)) miss8.push('label 仍有 bottom');
    if (!/\\.tile-label \\.nm \\{[\\s\\S]{0,160}padding: var\\(--sp-1\\) var\\(--sp-2\\);/.test(html225)) miss8.push('色块行高未调');
    if (!/\\.tile-label \\{[\\s\\S]{0,260}font-size: var\\(--fs-sub\\);/.test(html225)) miss8.push('字号未升档');
    if (!/tile-label"><span class="nm">' \\+ o\\.name \\+ '<\\/span>' \\+ badge/.test(u225)) miss8.push('badge 未并入名称行');
    check('§229a⑧ 名称与等级都在格顶：label 顶部定位（无 bottom）· 色块行高（--sp-1 上下 + --fs-sub）· badge 并入名称行',
      miss8.length === 0, miss8.join(' · ') || '6/6');

    /* ⑨ 地块去族色 + 统一浅废土底（四主题 ground 新值 + 地块染色零残留） */
    var GROUNDS229 = ['--ground: #a8a08b;', '--ground: #d3ccb6;', '--ground: #cfcab3;', '--ground: #6f6957;'];
    var miss9 = GROUNDS229.filter(function (g) { return html225.indexOf(g) < 0; });
    check('§229a⑨ 统一浅废土底：四主题 --ground 新值在册（浅废土化）· 地块族色规则零残留',
      miss9.length === 0 && htmlFlat225.indexOf('ser-gov  .tile-face') < 0,
      miss9.join(' ') || '4/4 · 地块染色已退役');

    /* ⑩ 16 色块 × 白字对比 ≥4.5（WCAG AA · 小字号可读性）—— 从 CSS 实测值独立复算 */
    var lum229 = function (hex) {
      var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
      var f = function (c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    var bad10 = [], ok10 = 0;
    RULES225.forEach(function (k) {
      var hexAll = (html225.match(new RegExp('--ser-' + k + ':\\\\s*(#[0-9a-f]{6});', 'g')) || [])
        .map(function (seg) { return seg.match(/#[0-9a-f]{6}/)[0]; });
      hexAll.forEach(function (hx) {
        var cw = (1 + 0.05) / (lum229(hx) + 0.05);   /* 白字对比 = (L_white+0.05)/(L+0.05) */
        if (cw < 4.5) bad10.push(k + hx + '=' + cw.toFixed(2));
        else ok10++;
      });
    });
    check('§229a⑩ 四主题 16 个名称色块 × 白字对比 ≥4.5（WCAG AA · 从 CSS 实测值独立复算）',
      bad10.length === 0, bad10.join(' ') || (ok10 + '/16 ≥4.5'));
  })();""",
's229a')

assert s != s0
if DRY:
    print('[DRY] smoke 6 处命中')
else:
    tmp = BASE + P + '.tmp229a'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd()
    assert '§229a⑧' in t and '§229a⑩' in t, '新段未落盘'
    assert 'position: static; flex: none' in t
    print('[OK] smoke 已更新（6 处）+ 自检通过')
print('A4 DONE%s' % ('（DRY）' if DRY else ''))
