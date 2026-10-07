# -*- coding: utf-8 -*-
"""v89.226 复核补丁：smoke §225③b —— 其余三主题（light/bamboo/dark2）逐字节对齐断言。

背景：v89.225 交付时 §225③ 只对默认主题做逐字节对齐，其余三主题仅验存在性
（上一轮"未完成清单②"，本轮复核已用独立 Python 路径全量复验 32/32，顺手把守卫补上）。

插入位置：§225③ 与 §225④ 之间。幂等：查 §225③b 标记。
"""
import io, os

BASE = 'E:/Deepseekdb/'
p = 'smoke-test.js'
s = io.open(BASE + p, encoding='utf-8', newline='').read()

MARK = '§225③b'
if MARK in s:
    print('[skip] §225③b 已存在')
else:
    anchor = """    check('§225③ 默认主题 --ser-* 与 data.js plot 逐值对齐（HSL→RGB 逐字节）',
      bad225.length === 0, bad225.join(' ') || (ok225 + '/8 对齐'));
"""
    assert s.count(anchor) == 1, 'anchor x%d' % s.count(anchor)
    add = anchor + """
    /* ③b 其余三主题逐字节对齐（v89.226 复核补齐：light/bamboo/dark2 主题变换锁定。
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
      badB225.length === 0, badB225.slice(0, 4).join(' ') || (okB225 + '/24 对齐'));
"""
    s = s.replace(anchor, add)
    tmp = BASE + p + '.tmp226'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)
    print('[ok] §225③b 已插入')

# 写后自检：坏值 + 计数
chk = io.open(BASE + p, encoding='utf-8', newline='').read()
assert '§225③b' in chk, '插入失败'
assert chk.count("check('§225③b") == 1, '§225③b check 计数=%d' % chk.count("check('§225③b")
assert '//s' not in chk.split('§225③b')[1][:2000], '反斜杠被吃（//s 形态）'
print('自检通过；§225 check 总数 =', chk.count("check('§225"))
