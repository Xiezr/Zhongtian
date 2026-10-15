# -*- coding: utf-8 -*-
# v89.229 批 b3：smoke / e2e —— 资源换代断言更新
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    tmp = BASE + p + '.tmp229b3'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)
def rep1(p, pairs):
    s = rd(p); s0 = s
    for old, new, tag in pairs:
        c = s.count(old)
        assert c == 1, '[%s|%s] count=%d' % (p, tag, c)
        s = s.replace(old, new)
    assert s != s0
    if not DRY:
        wr(p, s)
        print('[OK] %s %d 处' % (p, len(pairs)))
    else:
        print('[DRY] %s %d 处命中' % (p, len(pairs)))

# ================= smoke =================
rep1('smoke-test.js', [
    ("check('集水场10级产量5500/h', DATA.EXT_BUILDINGS.farm.prod[9] === 5500);",
     "check('净化厂10级产量5500/h', DATA.EXT_BUILDINGS.farm.prod[9] === 5500);", 's1'),
    ("check('空地建集水场', r.ok === true, r.msg);",
     "check('空地建净化厂', r.ok === true, r.msg);", 's2'),
    ("check('集水场地块+1', extOf(s)[emptyIdx].type === 'farm');",
     "check('净化厂地块+1', extOf(s)[emptyIdx].type === 'farm');", 's3'),
    ("check('升级集水场地块', r2.ok === true, r2.msg);",
     "check('升级净化厂地块', r2.ok === true, r2.msg);", 's4'),
    ("check('集水场地块等级+1', extOf(s)[emptyIdx].lv === 2);",
     "check('净化厂地块等级+1', extOf(s)[emptyIdx].lv === 2);", 's5'),
    ("    return ls.indexOf('净水') >= 0 && ls.indexOf('木料') >= 0 && h.indexOf('<svg') < 0;",
     "    return ls.indexOf('净水') >= 0 && ls.indexOf('生物质') >= 0 && h.indexOf('<svg') < 0;", 's6'),
    ("  check('实测：军队资源价值按兵种造价折算（口径真算一遍，含碎石）', (function () {",
     "  check('实测：军队资源价值按兵种造价折算（口径真算一遍，含电能）', (function () {", 's7'),
    ("      && two > s2.cost.grain + s2.cost.wood + s2.cost.iron      /* 碎石确实算进去了 */",
     "      && two > s2.cost.grain + s2.cost.wood + s2.cost.iron      /* 电能确实算进去了 */", 's8'),
    ("  /* 在首城地块上建集水场，新城不应受影响 */",
     "  /* 在首城地块上建净化厂，新城不应受影响 */", 's9'),
    ("    '集水场 ' + G.questMetric('extCount', 'farm') + ' 块');",
     "    '净化厂 ' + G.questMetric('extCount', 'farm') + ' 块');", 's10'),
    ("    /* 各给一块集水场，保证两城都有正的粮产 ——",
     "    /* 各给一块净化厂，保证两城都有正的净水产 ——", 's11'),
    ("""  check('结构：没有第二处「资源名表」（战报改用 GAME.resName）',
    /GAME\\.resName = function/.test(dS)
    && bS.indexOf("wood: '木料'") < 0);""",
     """  check('结构：没有第二处「资源名表」（战报改用 GAME.resName）',
    /GAME\\.resName = function/.test(dS)
    && bS.indexOf("wood: '生物质'") < 0 && bS.indexOf("wood: '木料'") < 0);""", 's12'),
    ("&& !!D96.ITEM_BY_ID && !!D96.ITEM_BY_ID.chest_tong && D96.ITEM_BY_ID.chest_tong.name === '补给箱·废铁'",
     "&& !!D96.ITEM_BY_ID && !!D96.ITEM_BY_ID.chest_tong && D96.ITEM_BY_ID.chest_tong.name === '补给箱·废钢'", 's13'),
    ("        /* v89.212（老板 1）：面板标签按归属资源（石场 → 「另加碎石上限」）；",
     "        /* v89.212（老板 1）：面板标签按归属资源（石场 → 「另加电能上限」；v89.229 资源换代）；", 's14'),
    ("        && html.indexOf('另加碎石上限') >= 0 && html.indexOf(U.fmt(one)) >= 0",
     "        && html.indexOf('另加电能上限') >= 0 && html.indexOf(U.fmt(one)) >= 0", 's15'),
    ("        && DATA.EXT_BUILDINGS.quarry.desc === '凿山取石，碎石产地';",
     "        && DATA.EXT_BUILDINGS.quarry.desc === '依山蓄能，电能产地';", 's16'),
    ("""    /* ⑤ 资源四材 */
    check('§224⑤ 资源：净水 / 木料 / 碎石 / 废铁（建材退役）', (function () {
      var rn = {};
      (DATA.RESOURCES || []).forEach(function (r) { rn[r.key] = r.name; });
      return rn.grain === '净水' && rn.wood === '木料' && rn.stone === '碎石' && rn.iron === '废铁'
        && RAW224.data.indexOf("name: '建材'") < 0;
    })());""",
     """    /* ⑤ 资源四材（v89.224 立 → v89.229 换代：生物质/净水/电能/废钢 · §0.7 按新口径重写） */
    check('§224⑤→§229b 资源四类：净水 / 生物质 / 电能 / 废钢（v89.229 换代）', (function () {
      var rn = {};
      (DATA.RESOURCES || []).forEach(function (r) { rn[r.key] = r.name; });
      return rn.grain === '净水' && rn.wood === '生物质' && rn.stone === '电能' && rn.iron === '废钢'
        && RAW224.data.indexOf("name: '建材'") < 0;
    })());""", 's17'),
])

# ================= e2e =================
rep1('e2e-test.js', [
    ("  /* 在新城开垦集水场 → 只影响新城 */",
     "  /* 在新城开垦净化厂 → 只影响新城 */", 'e1'),
    ("  check('新城可独立开垦集水场（队列已入项）',",
     "  check('新城可独立开垦净化厂（队列已入项）',", 'e2'),
    ("      return ls.indexOf('净水') >= 0 && ls.indexOf('木料') >= 0;",
     "      return ls.indexOf('净水') >= 0 && ls.indexOf('生物质') >= 0;", 'e3'),
    ("      /* ② 城外面板：标签按归属资源（idx1 = forest → 「另加木料上限」） */",
     "      /* ② 城外面板：标签按归属资源（idx1 = forest → 「另加生物质上限」） */", 'e4'),
    ("      check('§212e② 城外面板：forest 块标「另加木料上限」（按归属资源）',",
     "      check('§212e② 城外面板：forest 块标「另加生物质上限」（按归属资源）',", 'e5'),
    ("        extTxt212e.indexOf('另加木料上限') >= 0, extTxt212e.slice(0, 90));",
     "        extTxt212e.indexOf('另加生物质上限') >= 0, extTxt212e.slice(0, 90));", 'e6'),
])

print('B3 DONE%s' % ('（DRY）' if DRY else ''))
