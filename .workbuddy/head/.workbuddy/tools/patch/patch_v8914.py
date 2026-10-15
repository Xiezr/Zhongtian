# -*- coding: utf-8 -*-
"""patch_v8914.py — v89.14：卷 09~18 接线（60 篇）+ 残留清理 + 校验器判据 11/12

操作（每条：命中数断言 + 落盘回查）：
  A. story/vol-01.js   reward.item "talis" → "jingtie"（非法物品清理，防幽灵物品入档）
  B. story/vol-05.js   英文残留 timing → 时机
  C. story/vol-18.js   英文残留 itself → 本身 · risk → 风险
  D. index.html        装载 story/vol-09 ~ vol-18
  E. smoke-test.js     追加 10 个 require + 10 条卷断言（v89.14~v89.23）
  F. e2e-test.js       追加 v89.14 真实点击块（官府第 5~7 篇在列 · 开卷即读）
  G. story/tools/check.py  新增判据 11（英文残留）/ 判据 12（reward 白名单）
  H. story/README.md   「判据 10 条」→「判据 12 条」
"""
import io
import sys

R = r'E:\Deepseekdb'


def _read(path):
    return io.open(R + '\\' + path, encoding='utf-8', newline='').read()


def _write(path, s):
    io.open(R + '\\' + path, 'w', encoding='utf-8', newline='').write(s)


def fix(path, old, new, tag):
    """精确替换（EOL 自适应），命中数必须为 1，落盘回查。"""
    src = _read(path)
    eol = '\r\n' if '\r\n' in src else '\n'
    o = old.replace('\n', eol)
    nw = new.replace('\n', eol)
    n = src.count(o)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    _write(path, src.replace(o, nw, 1))
    back = _read(path)
    assert nw in back, tag
    print('OK  ' + tag)


# ---------------------------------------------------------------- A/B/C 残留清理
fix('story/vol-01.js',
    '"reward": { "gold": 1500, "rep": 80, "item": "talis", "count": 1 }',
    '"reward": { "gold": 1500, "rep": 80, "item": "jingtie", "count": 1 }',
    'vol-01 · kezhan-01 非法物品 talis → jingtie')

fix('story/vol-05.js',
    ' timing ',
    '时机',
    'vol-05 · 英文残留 timing → 时机')

fix('story/vol-18.js',
    '铁 itself 不净',
    '铁本身不净',
    'vol-18 · 英文残留 itself → 本身')

fix('story/vol-18.js',
    '绕道的risk他不想担',
    '绕道的风险他不想担',
    'vol-18 · 英文残留 risk → 风险')

# ---------------------------------------------------------------- D index.html
OLD_IDX = '<script src="story/vol-08.js"></script>\n<script src="js/ui.js"></script>'
NEW_IDX = ('<script src="story/vol-08.js"></script>\n'
           + ''.join('<script src="story/vol-%02d.js"></script>\n' % n for n in range(9, 19))
           + '<script src="js/ui.js"></script>')
fix('index.html', OLD_IDX, NEW_IDX, 'index.html · 装载 vol-09~18（10 卷）')

# ---------------------------------------------------------------- E smoke-test.js
OLD_REQ = ("  /* v89.13：铺量五批（卷 08 · 6 篇 · 招贤馆/鸿胪寺/铁匠铺/工匠作坊/民房/书院）随卷加载 */\n"
           "  require('./story/vol-08.js');\n")
NEW_REQ = (OLD_REQ
           + "  /* v89.14：铺量六批（卷 09~18 · 60 篇 · 城内/城外/野地/城池）随卷加载 */\n"
           + ''.join("  require('./story/vol-%02d.js');\n" % n for n in range(9, 19)))
fix('smoke-test.js', OLD_REQ, NEW_REQ, 'smoke-test.js · 追加 vol-09~18 require')

VOLS = [
    (9, 53,
     ['ext-farm-02', 'ext-forest-02', 'ext-quarry-02', 'ext-mine-02', 'wild-forest-01', 'wild-lake-02'],
     [('ext', 'farm', 2), ('ext', 'forest', 2), ('ext', 'quarry', 2), ('ext', 'mine', 2),
      ('wild', 'forest', 1), ('wild', 'lake', 2)],
     ['ext-forest-02', 'wild-forest-01'], '城外×4 + 野地×2（二轮）'),
    (10, 59,
     ['wild-hill-02', 'wild-caoyuan-02', 'wild-zhaoze-02', 'wild-desert-02', 'city-capital-01', 'city-county-01'],
     [('wild', 'hill', 2), ('wild', 'caoyuan', 2), ('wild', 'zhaoze', 2), ('wild', 'desert', 2),
      ('city', 'capital', 1), ('city', 'county', 1)],
     ['wild-zhaoze-02', 'city-capital-01'], '野地×4 + 都城/县城首访'),
    (11, 65,
     ['city-jun-02', 'city-zhou-02', 'bld-guanfu-05', 'bld-kezhan-03', 'bld-minfang-04', 'bld-shuyuan-04'],
     [('city', 'jun', 2), ('city', 'zhou', 2), ('building', 'guanfu', 5), ('building', 'kezhan', 3),
      ('building', 'minfang', 4), ('building', 'shuyuan', 4)],
     ['bld-minfang-04', 'bld-shuyuan-04'], '郡城/州城二访 + 建筑×4'),
    (12, 71,
     ['bld-junying-03', 'bld-xiaochang-03', 'bld-shichang-03', 'bld-cangku-03', 'bld-chengqiang-03', 'bld-yizhan-03'],
     [('building', 'junying', 3), ('building', 'xiaochang', 3), ('building', 'shichang', 3),
      ('building', 'cangku', 3), ('building', 'chengqiang', 3), ('building', 'yizhan', 3)],
     ['bld-chengqiang-03', 'bld-cangku-03'], '建筑×6（军/校/市/仓/墙/驿）'),
    (13, 77,
     ['bld-fenghuotai-03', 'bld-majiu-03', 'bld-zhaoxianguan-03', 'bld-honglusi-03', 'bld-tiejiangpu-03',
      'bld-gongjiangzuofang-03'],
     [('building', 'fenghuotai', 3), ('building', 'majiu', 3), ('building', 'zhaoxianguan', 3),
      ('building', 'honglusi', 3), ('building', 'tiejiangpu', 3), ('building', 'gongjiangzuofang', 3)],
     ['bld-honglusi-03', 'bld-tiejiangpu-03'], '建筑×6（烽/马/馆/寺/铁/匠）'),
    (14, 83,
     ['bld-guanfu-06', 'bld-kezhan-04', 'bld-minfang-05', 'bld-shuyuan-05', 'bld-junying-04', 'bld-xiaochang-04'],
     [('building', 'guanfu', 6), ('building', 'kezhan', 4), ('building', 'minfang', 5),
      ('building', 'shuyuan', 5), ('building', 'junying', 4), ('building', 'xiaochang', 4)],
     ['bld-shuyuan-05', 'bld-guanfu-06'], '建筑×6（官/客/民/学/军/校）'),
    (15, 89,
     ['bld-shichang-04', 'bld-cangku-04', 'bld-chengqiang-04', 'bld-yizhan-04', 'bld-fenghuotai-04', 'bld-majiu-04'],
     [('building', 'shichang', 4), ('building', 'cangku', 4), ('building', 'chengqiang', 4),
      ('building', 'yizhan', 4), ('building', 'fenghuotai', 4), ('building', 'majiu', 4)],
     ['bld-yizhan-04', 'bld-majiu-04'], '建筑×6（市/仓/墙/驿/烽/马）'),
    (16, 95,
     ['bld-zhaoxianguan-04', 'bld-honglusi-04', 'bld-tiejiangpu-04', 'bld-gongjiangzuofang-04', 'bld-guanfu-07',
      'bld-kezhan-05'],
     [('building', 'zhaoxianguan', 4), ('building', 'honglusi', 4), ('building', 'tiejiangpu', 4),
      ('building', 'gongjiangzuofang', 4), ('building', 'guanfu', 7), ('building', 'kezhan', 5)],
     ['bld-tiejiangpu-04', 'bld-guanfu-07'], '建筑×6（馆/寺/铁/匠/官/客）'),
    (17, 101,
     ['bld-minfang-06', 'bld-shuyuan-06', 'bld-junying-05', 'bld-xiaochang-05', 'bld-shichang-05', 'bld-cangku-05'],
     [('building', 'minfang', 6), ('building', 'shuyuan', 6), ('building', 'junying', 5),
      ('building', 'xiaochang', 5), ('building', 'shichang', 5), ('building', 'cangku', 5)],
     ['bld-junying-05', 'bld-shuyuan-06'], '建筑×6（民/学/军/校/市/仓）'),
    (18, 107,
     ['bld-chengqiang-05', 'bld-yizhan-05', 'bld-fenghuotai-05', 'bld-majiu-05', 'bld-zhaoxianguan-05',
      'bld-honglusi-05'],
     [('building', 'chengqiang', 5), ('building', 'yizhan', 5), ('building', 'fenghuotai', 5),
      ('building', 'majiu', 5), ('building', 'zhaoxianguan', 5), ('building', 'honglusi', 5)],
     ['bld-fenghuotai-05', 'bld-chengqiang-05'], '建筑×6（墙/驿/烽/马/馆/寺）'),
]


def gen_check(v, total, ids, anch, walks, desc):
    tag = 'v89.%d' % (v + 5)
    L = []
    L.append("  /* %s：卷 %02d 铺量（6 篇 · %s）—— 就位 · 段数 · 结局 · 抽 2 篇走满 */" % (tag, v, desc))
    L.append("  check('故事库：卷 %02d（6 篇就位 · 段数 5~7 · 可走满至结局）', (function () {" % v)
    L.append("    var NEW = [" + ', '.join("'%s'" % i for i in ids) + "];")
    L.append("    if (GAME.SG.list().length < %d) return false;" % total)
    a = "    var okA = GAME.SG.anchor('%s', '%s').length >= %d" % anch[0]
    for k, i, c in anch[1:]:
        a += "\n      && GAME.SG.anchor('%s', '%s').length >= %d" % (k, i, c)
    L.append(a + ";")
    L.append("    var okAll = true;")
    L.append("    NEW.forEach(function (sid) {")
    L.append("      var st = GAME.SG.one(sid);")
    L.append("      if (!st) { okAll = false; return; }")
    L.append("      var rk = GAME.SG.rankCount(st);")
    L.append("      if (rk < 5 || rk > 7) okAll = false;")
    L.append("      if ((st.endings || []).length !== 3) okAll = false;")
    L.append("    });")
    L.append("    var walk = function (sid) {")
    L.append("      var r = GAME.SG.begin(sid);")
    L.append("      if (!r.ok) return null;")
    L.append("      var g = 0;")
    L.append("      while (GAME.SG._run.phase === 'node' && g++ < 20) GAME.SG.choose(0);")
    L.append("      return GAME.SG._run;")
    L.append("    };")
    w1, w2 = walks
    L.append("    var w1 = walk('%s');" % w1)
    L.append("    var w2 = walk('%s');" % w2)
    L.append("    var okW = w1 && w1.phase === 'end' && w1.path.length === GAME.SG.rankCount(GAME.SG.one('%s'))" % w1)
    L.append("      && !!(w1.got && w1.got.got)")
    L.append("      && w2 && w2.phase === 'end' && w2.path.length === GAME.SG.rankCount(GAME.SG.one('%s'))" % w2)
    L.append("      && !!(w2.got && w2.got.got);")
    L.append("    return okA && okAll && okW;")
    L.append("  })());")
    return '\n'.join(L)


GEN = '\n\n'.join(gen_check(*v) for v in VOLS)

OLD_SM = "    return okA && okAll && okW;\n  })());\n})();\n"
NEW_SM = "    return okA && okAll && okW;\n  })());\n\n" + GEN + "\n\n})();\n"
fix('smoke-test.js', OLD_SM, NEW_SM, 'smoke-test.js · 追加 v89.14~23 卷断言（10 条）')

# ---------------------------------------------------------------- F e2e-test.js
OLD_E = ("      check('★ v89.13：掩卷退出（跳过）', true);\n"
         "    }\n"
         "    /* 空态（动态选锚点）：找一座尚无故事的建筑 */")
NEW_E = ("      check('★ v89.13：掩卷退出（跳过）', true);\n"
         "    }\n"
         "    /* v89.14：卷 09~18 新篇（真实点击 · 官府第 5~7 篇在列 · 开卷即读） */\n"
         "    var s9Mi = -1;\n"
         "    city.cells.forEach(function (cell, i) { if (s9Mi < 0 && cell.build && cell.build.id === 'guanfu') s9Mi = i; });\n"
         "    if (s9Mi >= 0) {\n"
         "      G.ui.openBuildModal(s9Mi);\n"
         "      await sleep(30);\n"
         "      var s9Entry = document.querySelector('#modal-root [data-action=\"story-list\"][data-kind=\"building\"][data-id=\"guanfu\"]');\n"
         "      check('★ v89.14：官府锚点出现逸闻入口', !!s9Entry);\n"
         "      if (s9Entry) {\n"
         "        click(s9Entry);\n"
         "        await sleep(30);\n"
         "        var s9a = document.querySelector('#modal-root [data-action=\"story-open\"][data-sid=\"bld-guanfu-05\"]');\n"
         "        var s9b = document.querySelector('#modal-root [data-action=\"story-open\"][data-sid=\"bld-guanfu-07\"]');\n"
         "        check('★ v89.14：卷 09~18 新篇在列（官府第 5~7 篇）', !!s9a && !!s9b);\n"
         "        if (s9a) {\n"
         "          click(s9a);\n"
         "          await sleep(40);\n"
         "          var fx9 = document.querySelector('#story-fx');\n"
         "          check('★ v89.14：新篇阅读器（壁画两层 · 段进度就位 · 选项≥2）', !!fx9\n"
         "            && fx9.querySelectorAll('.sgr-bg').length === 2\n"
         "            && fx9.textContent.indexOf('第 1 段') >= 0 && /共 [5-7] 段/.test(fx9.textContent)\n"
         "            && fx9.querySelectorAll('[data-action=\"story-pick\"]').length >= 2);\n"
         "          var ex9 = fx9 ? fx9.querySelector('[data-action=\"story-exit\"]') : null;\n"
         "          if (ex9) { click(ex9); await sleep(30); }\n"
         "          check('★ v89.14：掩卷退出（阅读器收起）', !!fx9 && fx9.style.display === 'none');\n"
         "        } else {\n"
         "          check('★ v89.14：新篇阅读器（跳过）', true);\n"
         "          check('★ v89.14：掩卷退出（跳过）', true);\n"
         "        }\n"
         "      } else {\n"
         "        check('★ v89.14：卷 09~18 新篇在列（跳过）', true);\n"
         "        check('★ v89.14：新篇阅读器（跳过）', true);\n"
         "        check('★ v89.14：掩卷退出（跳过）', true);\n"
         "      }\n"
         "    } else {\n"
         "      check('★ v89.14：官府锚点入口（城中无对应地格，跳过）', true);\n"
         "      check('★ v89.14：卷 09~18 新篇在列（跳过）', true);\n"
         "      check('★ v89.14：新篇阅读器（跳过）', true);\n"
         "      check('★ v89.14：掩卷退出（跳过）', true);\n"
         "    }\n"
         "    /* 空态（动态选锚点）：找一座尚无故事的建筑 */")
fix('e2e-test.js', OLD_E, NEW_E, 'e2e-test.js · 追加 v89.14 真实点击块')

# ---------------------------------------------------------------- G check.py
OLD_C1 = ('  10 文本不含字面反斜杠字符（防「双转义」——显示层不露出转义字样）\n'
          '"""')
NEW_C1 = ('  10 文本不含字面反斜杠字符（防「双转义」——显示层不露出转义字样）\n'
          '  11 中文正文不含英文残留（幕文 / 幕题 / 选项 / 结局中不得出现 3 个及以上连续 ASCII 字母）\n'
          '  12 reward 白名单（键仅 grain/wood/stone/iron/gold/pop/rep/item/count；\n'
          '     item 仅 "jingtie" / "lingsui"，且必须带正整数 count）\n'
          '"""')
fix('story/tools/check.py', OLD_C1, NEW_C1, 'check.py · 判据 11/12 写入头注')

OLD_C2 = ("    for x in ends:\n"
          "        if chr(92) in (x.get('t') or ''):\n"
          "            e('结局 %s 文本含字面反斜杠（疑似双转义）' % x.get('id'))\n"
          "\n"
          "    # 8 grade 覆盖")
NEW_C2 = ("    for x in ends:\n"
          "        if chr(92) in (x.get('t') or ''):\n"
          "            e('结局 %s 文本含字面反斜杠（疑似双转义）' % x.get('id'))\n"
          "\n"
          "    # 11 中文正文不含英文残留（3+ 连续 ASCII 字母；键名 / 锚点 id 不在扫描范围）\n"
          "    _en = re.compile(r'[A-Za-z]{3,}')\n"
          "    for n in nodes:\n"
          "        for fld in ('t', 's'):\n"
          "            m = _en.search(n.get(fld) or '')\n"
          "            if m:\n"
          "                e('幕 %s 的 %s 含英文残留「%s」' % (n.get('id'), fld, m.group()))\n"
          "        for op in n.get('o') or []:\n"
          "            for fld in ('l', 'd'):\n"
          "                m = _en.search(op.get(fld) or '')\n"
          "                if m:\n"
          "                    e('幕 %s 选项 %s 含英文残留「%s」' % (n.get('id'), fld, m.group()))\n"
          "    for x in ends:\n"
          "        m = _en.search(x.get('t') or '')\n"
          "        if m:\n"
          "            e('结局 %s 含英文残留「%s」' % (x.get('id'), m.group()))\n"
          "\n"
          "    # 12 reward 白名单（键 / item 值 / count 正整数）\n"
          "    _rwk = set(['grain', 'wood', 'stone', 'iron', 'gold', 'pop', 'rep', 'item', 'count'])\n"
          "    _rwi = set(['jingtie', 'lingsui'])\n"
          "    for x in ends:\n"
          "        rw = x.get('reward') or {}\n"
          "        badk = set(rw.keys()) - _rwk\n"
          "        if badk:\n"
          "            e('结局 %s reward 含非法键：%s' % (x.get('id'), sorted(badk)))\n"
          "        if 'item' in rw:\n"
          "            if rw.get('item') not in _rwi:\n"
          "                e('结局 %s reward.item 非法：%r' % (x.get('id'), rw.get('item')))\n"
          "            c = rw.get('count')\n"
          "            if not isinstance(c, int) or c <= 0:\n"
          "                e('结局 %s reward.item 缺正整数 count' % x.get('id'))\n"
          "\n"
          "    # 8 grade 覆盖")
fix('story/tools/check.py', OLD_C2, NEW_C2, 'check.py · 判据 11/12 实现')

# ---------------------------------------------------------------- H story/README.md
fix('story/README.md',
    '| `tools/check.py` | 校验（判据 10 条 · v2，唯一判据出口） |',
    '| `tools/check.py` | 校验（判据 12 条 · v2，唯一判据出口） |',
    'story/README.md · 判据条数 10 → 12')

print()
print('ALL DONE')
