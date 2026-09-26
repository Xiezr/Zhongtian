# -*- coding: utf-8 -*-
"""v89.126 补丁 C：smoke 断言升级
① 「配置表齐备」：POP_CFG.base → fillHours
② 「募兵面板三段条」：行为判据改「上限 ÷ fillHours」（新公式无保底）
③ 新增 §105（人口固定时间速率：补满 = fillHours 小时、tick 真推进）
安全：读→改→原子写→node --check。
"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()

# ── ① ──
old1 = ("        && !!DATA.POP_CFG && DATA.POP_CFG.base === 0.0005 && DATA.POP_CFG.govCap === 0.5")
new1 = ("        /* v89.126：base/minPerHour 退役 → fillHours（现实小时补满） */\n"
        "        && !!DATA.POP_CFG && DATA.POP_CFG.fillHours === 2 && DATA.POP_CFG.govCap === 0.5")
assert s.count(old1) == 1, '锚点①计数 %d' % s.count(old1)
s = s.replace(old1, new1)

# ── ② ──
old2 = ("      /* 行为：出口值 = max(1, 上限×0.0005) ——\n"
        "         ⚠️ 小城会撞保底 1（系数不可辨：0.05% 与 0.08% 同为 1）——\n"
        "         必须用**大城**（民房 Lv12 → 上限 9360）越过保底，才测得出系数本体。\n"
        "         （破坏测试 v8989 实测教训：小城版判据对系数漂移\"零反应\"。） */\n"
        "      var fakeBig = { cells: [{ build: { id: 'minfang', lvl: 12 } }] };\n"
        "      var mpBig = G.maxPopOf(fakeBig);\n"
        "      var okG = mpBig * 0.0005 > 1 && G.popGrowthOf(fakeBig) === mpBig * 0.0005;")
new2 = ("      /* 行为：出口值 = 上限 ÷ fillHours（v89.126 固定时间速率；旧\"保底 1\"已退役）。 */\n"
        "      var fakeBig = { cells: [{ build: { id: 'minfang', lvl: 12 } }] };\n"
        "      var mpBig = G.maxPopOf(fakeBig);\n"
        "      var okG = G.popGrowthOf(fakeBig) === mpBig / (DATA.POP_CFG.fillHours || 2);")
assert s.count(old2) == 1, '锚点②计数 %d' % s.count(old2)
s = s.replace(old2, new2)

# ── ③ 插入 §105（在 §104 收尾之后、结果输出之前） ──
anchor3 = ("  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');")
assert s.count(anchor3) == 1, '锚点③计数 %d' % s.count(anchor3)
block = r'''  /* ═══════════════════════════════════════════════════════════
   * §105（v89.126）人口增速：固定时间速率（每 fillHours 现实小时补满）
   * ------------------------------------------------------------
   * 老板令：「人口增长速度总是"每 2 小时即可补充人口至上限"，即按固定时间速率」
   * —— 旧公式（上限×0.05%/游戏时 + 保底 1）下，8 间 1 级民房（上限 800）
   * 补满要 800 游戏小时，玩家体感"根本没增加"。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var keep105 = G.state;
    var st105 = G.newGame({ name: 'v126p', cityName: '许都' });
    G.state = st105;
    var c105 = st105.cities[0];
    /* ① 老板原场景：8 间 1 级民房（上限 800）——增速 = 上限 ÷ fillHours */
    c105.cells.forEach(function (x, i) { if (i < 8) x.build = { id: 'minfang', lvl: 1 }; });
    var cap105 = G.maxPopOf(c105);
    var g105 = G.popGrowthOf(c105);
    var hours105 = cap105 / g105;
    var cfg105 = DATA.POP_CFG || {};
    check('§105① 增速 = 上限 ÷ fillHours（补满时长恒定，与上限大小无关）',
      Math.abs(hours105 - (cfg105.fillHours || 2)) < 1e-9,
      'cap=' + cap105 + ' 增速=' + g105 + '/时 → 补满 ' + hours105.toFixed(2) + ' 现实小时');
    /* ② tick 真推进：1 现实小时（3600 tick）→ 增量 ≈ 上限的一半 */
    c105.res.pop = 0;
    for (var k105 = 0; k105 < 3600; k105++) G.tickOnce();
    var got105 = Math.round(G.res(c105).pop || 0);
    check('§105② tick 真推进 1 现实小时：pop ≈ 上限/2',
      Math.abs(got105 - cap105 / 2) <= Math.max(2, cap105 * 0.01),
      'pop=' + got105 + '（期望 ' + Math.round(cap105 / 2) + '）');
    /* ③ 上限大 40 倍，补满时长仍然相同（固定时间速率的核心语义） */
    var big105 = { cells: [{ build: { id: 'minfang', lvl: 12 } }, { build: { id: 'minfang', lvl: 12 } },
      { build: { id: 'minfang', lvl: 12 } }, { build: { id: 'minfang', lvl: 12 } }] };
    var capBig105 = G.maxPopOf(big105);
    var hoursBig105 = capBig105 / G.popGrowthOf(big105);
    check('§105③ 更大上限（' + capBig105 + '）补满时长同为 ' + hoursBig105.toFixed(2) + ' 小时',
      Math.abs(hoursBig105 - hours105) < 1e-9);
    G.state = keep105;
  })();

'''
s = s.replace(anchor3, block + anchor3)

tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:300]
print('✓ smoke 补丁 C 完成（① 配置表 ② 三段条判据 ③ 新增 §105 三条）')
