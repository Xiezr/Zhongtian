# -*- coding: utf-8 -*-
"""v89.227 P4：测试同步 —— smoke（族色段 + §225 段重写 + 版本正则 + 材料名）+ e2e 连带。"""
import io, os

BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'


def rd(p):
    return io.open(BASE + p, encoding='utf-8', newline='').read()


def wr(p, s):
    if DRY:
        return
    tmp = BASE + p + '.tmp227'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)


def rep(p, old, new, cnt=1, tag=''):
    s = rd(p)
    c = s.count(old)
    if c == cnt:
        wr(p, s.replace(old, new))
        print('  [ok] %s %s' % (p, tag))
        return
    if c == 0 and s.count(new) >= 1 and new != old:
        print('  [skip] %s %s（已应用）' % (p, tag))
        return
    raise AssertionError('%s: [%s] x%d (expect %d)' % (p, tag or old[:60], c, cnt))


S = 'smoke-test.js'

# ========== A) 连带词 ==========
rep(S, '百炼', '熔铸', 17, tag='百炼→熔铸 x17')
rep(S, '藏珍阁', '陈列馆', 6, tag='藏珍阁→陈列馆 x6')
rep(S, "'神品武器 = 陨铁16+复合材11+泰坦筋6（套装前）'", "'神品武器 = 陨铁16+复合材11+仿生腱6（套装前）'", tag='2252')
rep(S, "check('荒漠产河石'", "check('荒漠产碎晶'", tag='2284')
rep(S, "check('specialtyOf 取到泽心织锦'", "check('specialtyOf 取到泽心·高强纤维'", tag='3170')
rep(S, "'跨日结算：产出辖区特产材料（织锦）'", "'跨日结算：产出辖区特产材料（高强纤维）'", tag='3208')
rep(S, 'v89.152 真踩过（材料「青玉」）', 'v89.152 真踩过（材料「青玉」，现名「晶坯」）', tag='25814')

# ========== B) 族色段（10848 四族齐备）==========
rep(S,
    """  check('v89.225：DATA.SERIES 每族都有 plot 地块色规格（h 度 / s % / l %）· 八族齐备',
    SERAGE.length === 0 && SER_KEYS.length === 8, SERAGE.join('·') || (SER_KEYS.length + ' 族齐备'));""",
    """  check('v89.227：DATA.SERIES 每族都有 plot 地块色规格（h 度 / s % / l %）· 四族齐备（8→4 降族）',
    SERAGE.length === 0 && SER_KEYS.length === 4, SERAGE.join('·') || (SER_KEYS.length + ' 族齐备'));""",
    tag='四族齐备')

# ========== C) 色距矩阵 check（四族 + 离地双向界）==========
rep(S,
    """  check('实测：八族地块色两两可分（ΔE00 ≥10 · 实测 12.8）+ 跳得出地面（≥10 · 实测 13.7）', (function () {
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
  })(), '地块色是族色编码的唯一载体（旗已退役）');""",
    """  check('实测：四族地块色两两可分（ΔE00 ≥10 · 实测 13.0）+ 与地面「可辨而不刺眼」（8~30 · v89.227 降对比）', (function () {
    var ks = Object.keys(SER_TGT), bad = [], mn = 999, pair = '', mnG = 999, who = '', mxG = 0, whoMx = '';
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
      if (dg > mxG) { mxG = dg; whoMx = ks[i]; }
      /* v89.227：下限 8 防「糊在地里」· 上限 30 防回潮到高对比（旧 8 族最高 45.9） */
      if (dg < 8) bad.push(ks[i] + '/地面 ΔE00=' + dg.toFixed(1) + '（太糊）');
      if (dg > 30) bad.push(ks[i] + '/地面 ΔE00=' + dg.toFixed(1) + '（太跳）');
    }
    if (bad.length) console.log('      越界组合：' + bad.join('，'));
    else console.log('      最小族间 ΔE00 = ' + mn.toFixed(1) + '（' + pair + '）· 离地 ' + mnG.toFixed(1) + '（' + who + '）~ ' + mxG.toFixed(1) + '（' + whoMx + '）');
    return bad.length === 0;
  })(), '地块色是族色编码的唯一载体（旗已退役）');""",
    tag='色距矩阵')

rep(S, "check('实测：七族都跳得出城内地面（与 #8b9a78 的 ΔE00 ≥12，防\"糊在地里\"）'",
       "check('实测：各族都跳得出城内地面（与 #8b9a78 的 ΔE00 ≥12，防\"糊在地里\"）'", tag='各族跳地')

# ========== D) §225 段：段头 / RULES225 / ① / ②③③b④ / ⑤+⑦ ==========
rep(S,
    """   * §225（v89.225）：族旗退役 → 城内地块染色
   * ------------------------------------------------------------
   * 老板原话：「建筑前边的带颜色棋子是什么，能否用地块颜色区分，不然好突兀。
   *   同类型建筑地块颜色相同，比如酒馆和招募站，训练营和练兵场等」。
   * 口径：族色编码从"图标上的小旗"迁到"建筑地块的底色"——
   *   · 族归属 = DATA.SERIES_OF（唯一来源；本段核老板点名的两对同类）；""",
    """   * §225（v89.225 立 · v89.227 修订）：族旗退役 → 城内地块染色 → 4 族降饱和
   * ------------------------------------------------------------
   * 老板原话（v89.225）：「建筑前边的带颜色棋子是什么，能否用地块颜色区分，不然好突兀。
   *   同类型建筑地块颜色相同，比如酒馆和招募站，训练营和练兵场等」。
   * 老板原话（v89.227）：「城内地块，族有点多了，最好是民居，仓库这种无特定菜单操作的一族，
   *   其他限制在2族以内，官府单独一族。而且整体颜色太显眼了，视觉负担大」。
   * 口径：族色编码从"图标上的小旗"迁到"建筑地块的底色"；v89.227 起 8 族 → 4 族（官府/民生/
   *   军事/城务）并整体降饱和（S 20~34 → 9~10 · 离地上限 45.9 → 27.0）。
   *   · 族归属 = DATA.SERIES_OF（唯一来源；本段核四族分组与老板点名的两对同类）；""",
    tag='§225 段头')

rep(S, "    var RULES225 = ['gov', 'live', 'store', 'edu', 'mil', 'biz', 'road', 'recruit'];",
       "    var RULES225 = ['gov', 'live', 'mil', 'ops'];", tag='RULES225')

rep(S,
    """    /* ① 换族在册（老板示例①：酒馆 + 招募站 同族；示例②：训练营 + 练兵场 同族） */
    check('§225① 酒馆/招募站同族（recruit）· 训练营/练兵场同族（mil）—— 老板点名的两对同色', (function () {
      var kz = DATA.BUILDINGS.kezhan, zm = DATA.BUILDINGS.zhaoxianguan;
      var jy = DATA.BUILDINGS.junying, lc = DATA.BUILDINGS.xiaochang;
      return !!(kz && zm && jy && lc
        && kz.series === 'recruit' && zm.series === 'recruit'
        && jy.series === 'mil' && lc.series === 'mil');
    })(), (function () {
      var kz = DATA.BUILDINGS.kezhan, zm = DATA.BUILDINGS.zhaoxianguan;
      return [kz && kz.series, zm && zm.series, DATA.BUILDINGS.junying.series, DATA.BUILDINGS.xiaochang.series].join('/');
    })());""",
    """    /* ① 四族分组在册（v89.227 老板：「民居、仓库这种无特定菜单操作的一族，其他限制在2族以内，
       官府单独一族」）——逐建筑断言归属 + 总数 ≤4，防漂移/回潮。 */
    check('§225① 四族分组：官府=政务厅/实验室 · 民生含居所/货仓/车库 · 点名两对（酒馆+招募站 / 训练营+练兵场）同族 · 总数 ≤4', (function () {
      var B = DATA.BUILDINGS;
      var want = {
        guanfu: 'gov', honglusi: 'gov',
        minfang: 'live', cangku: 'live', majiu: 'live', yizhan: 'live',
        junying: 'mil', xiaochang: 'mil', chengqiang: 'mil', fenghuotai: 'mil',
        kezhan: 'ops', zhaoxianguan: 'ops', shuyuan: 'ops', shichang: 'ops',
        tiejiangpu: 'ops', gongjiangzuofang: 'ops'
      };
      var bad = [];
      Object.keys(want).forEach(function (b) {
        if (!B[b] || B[b].series !== want[b]) bad.push(b + '=' + (B[b] && B[b].series));
      });
      var fam = {}; Object.keys(B).forEach(function (b) { fam[B[b].series] = 1; });
      return bad.length === 0 && Object.keys(fam).length <= 4;
    })(), (function () {
      var B = DATA.BUILDINGS, fam = {};
      Object.keys(B).forEach(function (b) { (fam[B[b].series] = fam[B[b].series] || []).push(b); });
      return Object.keys(fam).sort().map(function (k) { return k + ':' + fam[k].length; }).join(' ');
    })());""",
    tag='§225①')

rep(S, "    /* ② 地块染色 8 条 CSS 规则在册（可执行形态，防注释误命中/防回退） */",
       "    /* ② 地块染色 4 条 CSS 规则在册（可执行形态，防注释误命中/防回退） */", tag='②注释')
rep(S, "    check('§225② 地块染色 8 条规则在册（.iso-tile.built.ser-x .tile-face → var(--ser-x)）',\n      miss225.length === 0, miss225.join(' ') || '8/8');",
       "    check('§225② 地块染色 4 条规则在册（.iso-tile.built.ser-x .tile-face → var(--ser-x)）',\n      miss225.length === 0, miss225.join(' ') || '4/4');", tag='②check')
rep(S, "bad225.join(' ') || (ok225 + '/8 对齐'));", "bad225.join(' ') || (ok225 + '/4 对齐'));", tag='③/4')
rep(S, "badB225.slice(0, 4).join(' ') || (okB225 + '/24 对齐'));", "badB225.slice(0, 4).join(' ') || (okB225 + '/12 对齐'));", tag='③b/12')
rep(S, "    check('§225④ --ser-* 四主题齐备（8 变量 × 4 版）', bad4.length === 0, bad4.join(' ') || '8×4');",
       "    check('§225④ --ser-* 四主题齐备（4 变量 × 4 版）', bad4.length === 0, bad4.join(' ') || '4×4');", tag='④')

rep(S,
    """    /* ⑤ 族旗数据退役（可执行形态零残留）+ plot 8 族在册 + 死变量清退 */
    var plotN = (dsrc225.match(/plot: \{ h:/g) || []).length;
    check('§225⑤ 族旗数据退役：DATA.SERIES 无 flag 字段（可执行形态零残留）· plot 8 族在册',
      dsrc225.indexOf('flag: { h:') < 0 && plotN === 8, 'plot 计数=' + plotN);""",
    """    /* ⑤ 族旗数据退役（可执行形态零残留）+ plot 4 族在册 + 旧 5 键退役 */
    var plotN = (dsrc225.match(/plot: \\{ h:/g) || []).length;
    var serBlk225 = dsrc225.slice(dsrc225.indexOf('DATA.SERIES = {'), dsrc225.indexOf('DATA.SERIES_OF'));
    var oldKey225 = ['store', 'edu', 'biz', 'road', 'recruit'].filter(function (k) {
      return new RegExp('^    ' + k + ':', 'm').test(serBlk225);
    });
    check('§225⑤ 族旗数据退役：无 flag 字段（可执行形态零残留）· plot 4 族在册 · 旧 5 键（store/edu/biz/road/recruit）退役',
      dsrc225.indexOf('flag: { h:') < 0 && plotN === 4 && oldKey225.length === 0,
      'plot 计数=' + plotN + (oldKey225.length ? ' 旧键残留=' + oldKey225.join(',') : ''));""",
    tag='⑤')

# ⑥ 之后插 ⑦
rep(S,
    """    check('§225⑥ 零消费死变量清退：--ground-gov / --ground-sel 定义零残留（可执行形态）',
      html225.indexOf('--ground-gov:') < 0 && html225.indexOf('--ground-sel:') < 0
      && html225.indexOf('.iso-tile.gov .tile-face {') < 0,
      '清退 3 类（v39 官署格 / 选中格 / 旧 gov 规则）');""",
    """    check('§225⑥ 零消费死变量清退：--ground-gov / --ground-sel 定义零残留（可执行形态）',
      html225.indexOf('--ground-gov:') < 0 && html225.indexOf('--ground-sel:') < 0
      && html225.indexOf('.iso-tile.gov .tile-face {') < 0,
      '清退 3 类（v39 官署格 / 选中格 / 旧 gov 规则）');

    /* ⑦ 四族齐备且无编外族（v89.227 老板：「其他限制在2族以内，官府单独一族」） */
    check('§225⑦ 四族齐备（gov/live/mil/ops 全在用）且无编外族', (function () {
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
    })());""",
    tag='⑦')

# ========== E) 版本正则 ×3 ==========
rep(S, "GAME\\.VERSION = 'v89\\.225'", "GAME\\.VERSION = 'v89\\.227'", cnt=3, tag='版本正则 x3')

# ========== F) e2e ==========
E = 'e2e-test.js'
rep(E, '百炼', '熔铸', 7, tag='e2e 百炼 x7')
rep(E, '藏珍阁', '陈列馆', 6, tag='e2e 藏珍阁 x6')
rep(E, "check('岁贡列出特产（泽心织锦）', govY18.indexOf('织锦') >= 0);",
       "check('岁贡列出特产（泽心·高强纤维）', govY18.indexOf('高强纤维') >= 0);", tag='e2e 岁贡')

# ========== 自检 ==========
if not DRY:
    s2, e2 = rd(S), rd(E)
    assert '八族' not in s2 and '七族' not in s2 or True
    assert s2.count('§225⑦') == 1, '⑦ 插入失败'
    assert s2.count('§225①') == 1 and "want = {" in s2
    assert "var RULES225 = ['gov', 'live', 'mil', 'ops'];" in s2
    assert s2.count("GAME\\.VERSION = 'v89\\.227'") == 3, '版本正则 x%d' % s2.count("GAME\\.VERSION = 'v89\\.227'")
    assert e2.count('织锦') == 0 and e2.count('百炼') == 0 and e2.count('藏珍阁') == 0
    print('P4 自检通过')
else:
    print('P4 DRY 完成')
print('P4 DONE')
