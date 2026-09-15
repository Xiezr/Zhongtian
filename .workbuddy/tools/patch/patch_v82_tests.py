# -*- coding: utf-8 -*-
"""v82 · 测试补丁：老守卫跟进（征收退役 / 文案 / 字体共享规则）+ 新增 §67 + e2e 两处。

- smoke：P2-8 征收块 / CORE_API / #16 君主列表 / 字体两条 / v24 面板两条 /
  冷却独立 / GOLD_GATE / inn-avatar —— 共 8 处跟进 + 新增 §67（v82 四条）。
- e2e：征收全流程整段退役（改防回魂）+ 新增 v82 真实 DOM 小段。
"""
import io
import sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new and new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


def replace_span(path, start, end_marker, block, tag, done):
    """把 [start, end_marker] 整段替换为 block；done = 幂等完成标记。"""
    t = io.open(path, encoding='utf-8', newline='').read()
    if done in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if t.count(start) != 1:
        print('  ✗ %s：起点命中 %d 次' % (tag, t.count(start)))
        sys.exit(1)
    i = t.find(start)
    j = t.find(end_marker, i + len(start))
    if j < 0:
        print('  ✗ %s：找不到段尾' % tag)
        sys.exit(1)
    jj = j + len(end_marker)
    io.open(path, 'w', encoding='utf-8', newline='').write(t[:i] + block + t[jj:])
    print('  ✓ %s（整段替换）' % tag)


print('===== A. smoke-test.js =====')

# A1 · P2-8 征收块 → 退役判据
replace_span(
    SMOKE,
    "  check('P2-8 征收已实现（冷却 1 游戏小时）'",
    "    return ra > 0 && rb === 0;\n  })());",
    r'''  /* v82（老板）：「官府不需要征收物质这个功能去除」——征收整段退役（防回魂判据） */
  check('v82：征收已退役（levy / levyPlan / levyReady / LEVY_CD 全清）',
    typeof G.levy === 'undefined' && typeof G.levyPlan === 'undefined'
    && typeof G.levyReady === 'undefined' && typeof G.LEVY_CD === 'undefined');
  check('v82：特产口径保留（specialtyOf / stateOfCity 仍在 —— 岁贡与州治加成的依赖）',
    typeof G.specialtyOf === 'function' && typeof G.stateOfCity === 'function');
''',
    'A1 P2-8 征收块',
    done='v82：征收已退役',
)
# A1 的段尾 end_marker 只覆盖到「冷却按城独立」的收尾，校验一下后缀没被误伤
_t = io.open(SMOKE, encoding='utf-8', newline='').read()
assert "check('P2-9 科技改耗黄金'" in _t, 'A1 段尾收口异常'

# A2 · CORE_API 去 GAME.levy
# ⚠️ 新文本是旧行的**前缀** —— 幂等判定必须 old 优先（`new in t` 会被旧行里的前缀骗过）
_t2 = io.open(SMOKE, encoding='utf-8', newline='').read()
_old_a2 = "    ['GAME.storeCap', G.storeCap], ['GAME.wallCost', G.wallCost], ['GAME.levy', G.levy],"
_new_a2 = "    ['GAME.storeCap', G.storeCap], ['GAME.wallCost', G.wallCost],"
if _old_a2 in _t2:
    if _t2.count(_old_a2) != 1:
        print('  ✗ A2 CORE_API：锚点命中 %d 次' % _t2.count(_old_a2))
        sys.exit(1)
    io.open(SMOKE, 'w', encoding='utf-8', newline='').write(_t2.replace(_old_a2, _new_a2, 1))
    print('  ✓ A2 CORE_API 去 levy')
else:
    print('  · A2 CORE_API 去 levy：已改过（跳过）')

# A3 · #16 君主列表去档位括注
patch(
    SMOKE,
    r"""  check('#16 君主面板城池列表区分档位', /DATA\.CITY_TIER/.test(rd16('data')) && /DATA\.CITY_TIER\[c\.type\]/.test(uS16));""",
    r"""  /* v82（老板）：「不要显示（自建城）这种文字」——君主面板城池列表去档位括注（坐标与人口保留） */
  check('#16 君主面板城池列表（v82：去档位括注）',
    /ls-meta">\[' \+ c2\.x \+ ',' \+ c2\.y \+ '\] · 人口上限 '/.test(uS16)
    && !/DATA\.CITY_TIER\[c2\.type\]/.test(uS16));""",
    'A3 #16 君主列表',
)

# A4a · 三层标题（共享规则含 .q-det-title）
patch(
    SMOKE,
    r"""  check('三层标题同一规格（字号取自同一变量）',
    /\.gold-heading, \.m-title \{[\s\S]{0,220}font-size: var\(--fs-h2\)/.test(css34)""",
    r"""  check('三层标题同一规格（字号取自同一变量；v82 扩至 .q-det-title）',
    /\.gold-heading, \.m-title, \.q-det-title \{[\s\S]{0,220}font-size: var\(--fs-h2\)/.test(css34)""",
    'A4a 三层标题',
)

# A4b · 分区小标题（共享规则扩员）
patch(
    SMOKE,
    r"""  check('分区小标题同一规格',
    /\.q-sec-t, \.bag-sec, \.gd-sec, \.forge-q, \.m-sec, \.side-title, \.wb-t \{[\s\S]{0,220}font-size: var\(--fs-h3\)/.test(css34));""",
    r"""  check('分区小标题同一规格（v82 扩员：q-det-sec/gp-sec/fsn-t/op-zone-t/ledger-sec/seal-h）',
    /\.q-sec-t, \.q-det-sec, \.bag-sec, \.gd-sec, \.forge-q, \.m-sec, \.side-title, \.wb-t,[\s\S]{0,140}\.gp-sec, \.fsn-t, \.op-zone-t, \.ledger-sec, \.seal-h \{[\s\S]{0,260}font-size: var\(--fs-h3\)/.test(css34));""",
    'A4b 分区小标题',
)

# A5 · v24 面板两条 → 退役判据
replace_span(
    SMOKE,
    "  check('征收面板列出 5 大资源或州特产'",
    "&& /③ 州治加成/.test(uS37));",
    r'''  /* v82（老板）：「官府不需要征收物质这个功能去除」——面板不再挂征收（防回魂） */
  check('v82：官府面板不再挂征收（openGuanfu 无 levyPlan）', /ui\.openGuanfu = function/.test(uS37)
    && !/GAME\.levyPlan/.test(uS37));
  check('特产两条收集途径写进面板（岁贡/州治；征收随退役撤下）',
    /① 州郡岁贡/.test(uS37) && /② 州治加成/.test(uS37) && !/官府征收/.test(uS37));
''',
    'A5 v24 面板',
    done='官府面板不再挂征收',
)

# A6 · v24 冷却独立实测 → 退役注记
patch(
    SMOKE,
    r"""  check('实测：征收冷却按城独立（A 冷却不影响 B）', (function () {
    var st = G.state;
    var a = st.cities[0];
    var b = G.makeCity({ id: 'tmpLevyB', name: 'tmpB', type: 'self' });
    st.cities.push(b);
    a.lastLevy = (st.world && st.world.elapsed) || 0;
    var ra = G.levyReady(a), rb = G.levyReady(b);
    st.cities.pop();
    return ra > 0 && rb === 0;
  })());""",
    r"""  /* v82：征收退役 —— 冷却按城独立的实测随 levyReady 一并退役。 */""",
    'A6 冷却独立',
)

# A7 · GOLD_GATE 四口 → 三口
patch(
    SMOKE,
    r"""  check('结构：四个黄金出口全部挂到 DATA.GOLD_GATE（税收/俸禄/岁贡 + 征收系数）', (function () {
    return /DATA\.GOLD_GATE\.tax/.test(stS73) && /DATA\.GOLD_GATE\.salary/.test(stS73)
      && /DATA\.GOLD_GATE\.yield/.test(dS73)
      && /LEVY_RES_RATE = \{ grain: 0\.30, wood: 0\.22, stone: 0\.16, iron: 0\.10, gold: 0\.02 \}/.test(dS73);
  })(), 'GATE=' + JSON.stringify(DATA.GOLD_GATE));""",
    r"""  check('结构：三个黄金出口全部挂到 DATA.GOLD_GATE（税收/俸禄/岁贡；v82 征收退役）', (function () {
    return /DATA\.GOLD_GATE\.tax/.test(stS73) && /DATA\.GOLD_GATE\.salary/.test(stS73)
      && /DATA\.GOLD_GATE\.yield/.test(dS73)
      && !/LEVY_RES_RATE/.test(dS73);
  })(), 'GATE=' + JSON.stringify(DATA.GOLD_GATE));""",
    'A7 GOLD_GATE',
)

# A8 · inn-avatar 两条同名规则 → 合并后的单条
patch(
    SMOKE,
    r"""  check('⑤ 紧凑几何：内衬 3px 覆盖共用基线 + 头像列 28px（两处一致）', (function () {
    var compact = cssBlock(hS1, '.inn-card { padding:');
    return /padding: 3px 10px/.test(compact) && /margin-bottom: 3px/.test(compact)
      && /width: 28px/.test(cssBlock(hS1, '.inn-avatar {'))
      && /width: 28px/.test(cssBlock(hS1, '.inn-avatar { width: 28px;'));
  })());""",
    r"""  check('⑤ 紧凑几何：内衬 3px 覆盖共用基线 + 头像列 28px（v82 两条同名规则已合并）', (function () {
    var compact = cssBlock(hS1, '.inn-card { padding:');
    var iav = cssBlock(hS1, '.inn-avatar {');
    return /padding: 3px 10px/.test(compact) && /margin-bottom: 3px/.test(compact)
      && /font-size: 20px/.test(iav) && /width: 28px/.test(iav);
  })());""",
    'A8 inn-avatar 守卫',
)

# A9 · 新增 §67（插在最终 console.log 之前）
SEC67 = r'''  /* ============================================================
   * 67. v82（老板四条）：君主凡品开局 / 官府·君主文案清理 / 征收退役 / 字体三档
   * ============================================================ */
  console.log('\n===== 67. v82 四条（君主资质 · 文案 · 征收 · 字体） =====');
  (function () {
    var rd82 = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u82 = stripComment(rd82('ui'));
    var d82 = stripComment(rd82('domain'));
    var m82 = stripComment(rd82('main'));
    var st82 = stripComment(rd82('state'));
    var da82 = stripComment(rd82('data'));
    var h82 = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8'));

    check('① 君主开局凡品（最低档 lvCap 60）—— 需逐步升档', (function () {
      var lord = G.makeLordGeneral({ name: '甲' }, 1, null);
      return DATA.LORD_GEN.rankId === 'fan' && DATA.GEN_RANKS[0].id === 'fan'
        && lord.rank === 'fan' && DATA.GEN_RANK_BY_ID['fan'].lvCap === 60;
    })(), 'rank=' + DATA.LORD_GEN.rankId + ' lvCap=' + DATA.GEN_RANK_BY_ID['fan'].lvCap);
    check('① 升档链在（凡→良→英→名→天，四株灵草，唯一出口 rankUpUse）', (function () {
      var chain = (DATA.ITEMS || []).filter(function (x) { return x.type === 'rank_up'; })
        .map(function (x) { return x.from + '>' + x.to; });
      return typeof G.rankUpUse === 'function' && chain.length === 4
        && chain[0] === 'fan>liang' && chain[3] === 'ming>tian';
    })());

    check('② 官府面板：城名居中行（.city-title / .city-sub），无原名样式残留', (function () {
      return /class="city-title"/.test(u82) && /\.city-title \{/.test(h82)
        && /class="city-sub"/.test(u82) && !/cs-orig/.test(u82) && !/cs-orig/.test(h82);
    })());
    check('② 官府面板不再标「附属野地 / 城外空地」（显示与数据副本双退役）',
      !/附属野地 \/ 城外空地/.test(u82) && !/extraLand/.test(da82));
    check('② 君主面板城池列表去档位括注（坐标与人口保留）',
      /ls-meta">\[' \+ c2\.x \+ ',' \+ c2\.y \+ '\] · 人口上限 '/.test(u82)
      && !/DATA\.CITY_TIER\[c2\.type\]/.test(u82));
    check('② 改名弹窗不再写「原名」（域层 origName 照记）',
      !/原名：/.test(u82) && /origName/.test(d82));

    check('③ 征收退役：域 / 界面 / 分发 / 状态 / 数据 五处全清', (function () {
      return typeof G.levy === 'undefined' && typeof G.levyPlan === 'undefined'
        && typeof G.levyReady === 'undefined' && typeof G.LEVY_CD === 'undefined'
        && !/levyPlan|levyReady|LEVY_RES_RATE|LEVY_MAT_QTY|LEVY_HEARTS/.test(d82)
        && !/do-levy/.test(m82) && !/levy-btn/.test(u82)
        && !/lastLevy/.test(st82) && !/LEVY_RES_RATE|LEVY_CD/.test(da82);
    })());

    check('④ 字重只剩三档（400 正文 / 700 强调 / 800 标题）', (function () {
      var seen = {};
      (h82.match(/font-weight:\s*\d+/g) || []).forEach(function (m) { seen[m.replace(/\D/g, '')] = 1; });
      return Object.keys(seen).sort().join(',') === '400,700,800';
    })());
    check('④ 备注族一处共享（12px · 常规 · 次要色 · 行高 1.65）',
      /\.note, \.ui-sub, \.nt-info, \.op-hint, \.m-sub, \.gb-empty, \.q-empty,[\s\S]{0,180}line-height: 1\.65/.test(h82));
    check('④ 分区标题共享扩员（漏网六处收编：q-det-sec/gp-sec/fsn-t/op-zone-t/ledger-sec/seal-h）',
      /\.q-sec-t, \.q-det-sec, \.bag-sec[\s\S]{0,240}\.gp-sec, \.fsn-t, \.op-zone-t, \.ledger-sec, \.seal-h \{/.test(h82));
    check('④ 标题外观共享含 .q-det-title（三层标题一处定义）',
      /\.gold-heading, \.m-title, \.q-det-title \{[\s\S]{0,200}font-size: var\(--fs-h2\)/.test(h82));
  })();

'''
patch(
    SMOKE,
    "\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    '\n' + SEC67 + "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    'A9 新增 §67',
)

print()
print('===== B. e2e-test.js =====')

# B1 · 征收全流程 → 退役判据
replace_span(
    E2E,
    "  const c24levy = G.currentCity();",
    "  G.state.cities.forEach((c, i) => { if (bkArmies24[i] != null) c.army = JSON.parse(bkArmies24[i]); });",
    r'''  /* v82（老板）：「官府不需要征收物质这个功能去除」——
     原「征收全流程」整段退役，改验**退役本身**（防回魂）+ 面板不被误伤。 */
  G.ui.openGuanfu();
  await sleep(80);
  const gm24 = document.querySelector('#modal-root').innerHTML;
  check('v82：官府弹窗已无征收区（物资表 / 征收按钮退役）',
    gm24.indexOf('官府') >= 0 && gm24.indexOf('征收物资') < 0
    && !document.querySelector('#levy-btn'));
  check('v82：官府仍在办事项（退役不误伤面板）', gm24.indexOf('在办事项') >= 0);
  G.ui.closeModal();
  await sleep(60);
''',
    'B1 征收流程 → 退役',
    done='v82：官府弹窗已无征收区',
)

# B2 · 末尾插 v82 真实 DOM 小段
V82E2E = r'''  /* ============================================================
   * v82（老板四条）真实 DOM：城名居中 / 文案清理 / 征收退役 / 字体三档
   * ============================================================ */
  console.log('\n--- v82. 文案清理 / 征收退役 / 字体（真实 DOM） ---');
  G.ui.openGuanfu();
  await sleep(100);
  (function () {
    const root = document.querySelector('#modal-root');
    const title = root.querySelector('.city-title');
    check('v82：官府面板城名居中行（.city-title 含城名）',
      !!title && title.textContent.indexOf(G.currentCity().name) >= 0);
    const ks = Array.prototype.map.call(root.querySelectorAll('.attr .k'), (x) => x.textContent.trim());
    check('v82：官府面板无「本城」/「附属野地」标签行',
      ks.indexOf('本城') < 0 && ks.join('|').indexOf('附属野地') < 0);
    check('v82：征收退役（面板无征收按钮）', !root.querySelector('#levy-btn'));
    check('v82：分区标题统一 800 字重（计算样式）', (function () {
      const h = root.querySelector('.gold-heading');
      return !!h && window.getComputedStyle(h).fontWeight === '800';
    })());
    G.ui.closeModal();
  })();
  await sleep(60);

'''
patch(
    E2E,
    "\n  G.ui.setView('city');\n  await sleep(60);\n  return finish();\n}",
    '\n' + V82E2E + "  G.ui.setView('city');\n  await sleep(60);\n  return finish();\n}",
    'B2 e2e v82 段',
)

print()
print('完成。')
