# -*- coding: utf-8 -*-
"""v74 测试补丁：守卫翻转（16 处）+ 新增第 60 节（v74 七条）

翻转口径总览：
  · 人口加成（守将统率×1000）→ 守将不影响人口
  · 六维表头「每点作用」→「加点」；备注块 gd-effect → 已撤
  · 守将加成从"作用列可见" → 名称 title（悬停）
  · 视口自适应族（撑满视口 / vw·vh 上限 / 860 降档 / 窄屏断点）→ 固定像素画布
  · gp-body 0.92/1.08 → 对半 1fr 1fr
"""
import io, sys, os

ROOT = r'E:\Deepseekdb'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    total = t.count('\n')
    crlf = t.count('\r\n') > (total - t.count('\r\n'))

    def to_dom(s):
        return s.replace('\n', '\r\n') if crlf else s.replace('\r\n', '\n')

    def to_alt(s):
        return s.replace('\r\n', '\n') if crlf else s.replace('\n', '\r\n')

    pairs = [(to_dom(old), to_dom(new))]
    if to_alt(old) != to_dom(old):
        pairs.append((to_alt(old), to_alt(new)))
    for o2, n2 in pairs:
        if n2 in t:
            print('  · %s：已改过（跳过）' % tag)
            return
    hit = [(o, n) for o, n in pairs if t.count(o) == 1]
    if not hit:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(pairs[0][0])))
        sys.exit(1)
    o2, n2 = hit[0]
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(o2, n2, 1))
    print('  ✓ %s' % tag)


SMOKE = os.path.join(ROOT, 'smoke-test.js')

print('========== S1：守将人口守卫 → v74 翻转为"不影响" ==========')
patch(
    SMOKE,
    """    /* 3.2 统率 ×1000 人口 */
    var cityP = G.currentCity();
    G.state.generals.forEach(function (x) { if (x.status === 'guard') { x.status = 'idle'; x.cityId = null; } });
    var popNoGuard = G.maxPopOf(cityP, true);
    var gGu = G.state.generals[1] || G.state.generals[0];
    gGu.status = 'guard'; gGu.cityId = cityP.id;
    var popWithGuard = G.maxPopOf(cityP);
    check('守将统率 → 人口上限（统率×1000）', popWithGuard === popNoGuard + Math.round(G.genAttrs(gGu).tong * DATA.POP_PER_TONG),
      U.fmt(popNoGuard) + ' → ' + U.fmt(popWithGuard) + '（统率 ' + G.genAttrs(gGu).tong + '）');
    check('无守将时不加人口', G.maxPopOf(cityP, true) === popNoGuard);""",
    """    /* 3.2 人口上限（v74 · 老板需求 1：「取消将领对人口上限的加成」）——
       统率 ×1000 那半条已整段撤除：守将有无，人口上限必须一模一样。 */
    var cityP = G.currentCity();
    G.state.generals.forEach(function (x) { if (x.status === 'guard') { x.status = 'idle'; x.cityId = null; } });
    var popNoGuard = G.maxPopOf(cityP, true);
    var gGu = G.state.generals[1] || G.state.generals[0];
    gGu.status = 'guard'; gGu.cityId = cityP.id;
    var popWithGuard = G.maxPopOf(cityP);
    check('v74：守将不再影响人口上限（统率×1000 已撤）', popWithGuard === popNoGuard,
      U.fmt(popNoGuard) + ' → ' + U.fmt(popWithGuard) + '（统率 ' + G.genAttrs(gGu).tong + '）');
    check('人口上限只由民房决定（加一座民房即上升）', (function () {
      var before = G.maxPopOf(cityP, true);
      var cell = null;
      (cityP.cells || []).forEach(function (c) { if (!cell && !c.official && !c.build) cell = c; });
      if (!cell) return true;      /* 没空格子就跳过（夹具限制，不算失败面） */
      cell.build = { id: 'minfang', lvl: 1 };
      var after = G.maxPopOf(cityP, true);
      cell.build = null;
      return after > before;
    })());
    check('DATA 不再有 POP_PER_TONG（零引用字段同步下线）',
      DATA.POP_PER_TONG === undefined);""",
    'S1 人口守卫翻转',
)

print()
print('========== S2：六维表头守卫 ×2（830 / 1620） ==========')
patch(
    SMOKE,
    """    /* v65：「作用（每点）」→「每点作用」（少两个字，给"六维"列腾宽度） */
    return /<th class="ctr">数值<\\/th>/.test(head) && /每点作用/.test(head)
      && head.indexOf('装备/丹') < 0 && head.indexOf('合计') < 0
      && (head.match(/<th/g) || []).length === 3;
  })());""",
    """    /* v74：「每点作用」列改「加点」＋（作用文案进六维名称的悬停） */
    return /<th class="ctr">数值<\\/th>/.test(head) && /<th class="ctr">加点<\\/th>/.test(head)
      && head.indexOf('装备/丹') < 0 && head.indexOf('合计') < 0
      && (head.match(/<th/g) || []).length === 3;
  })());""",
    'S2a 六维表头（第一处）',
)
patch(
    SMOKE,
    """  check('六维表只有一个数值列', (function () {
    var i = uS39.indexOf('<th>六维</th>');
    var head = i < 0 ? '' : uS39.slice(i, uS39.indexOf('</thead>', i));
    return (head.match(/<th/g) || []).length === 3 && /每点作用/.test(head)
      && head.indexOf('合计') < 0 && head.indexOf('装备/丹') < 0;
  })());
  check('计算值集中在「当前效果」一栏', /gd-effect/.test(uS39) && /当前效果/.test(uS39));""",
    """  check('六维表只有一个数值列（v74：作用列改「加点」＋）', (function () {
    var i = uS39.indexOf('<th>六维</th>');
    var head = i < 0 ? '' : uS39.slice(i, uS39.indexOf('</thead>', i));
    return (head.match(/<th/g) || []).length === 3 && /<th class="ctr">加点<\\/th>/.test(head)
      && head.indexOf('合计') < 0 && head.indexOf('装备/丹') < 0;
  })());
  /* v74（老板需求 6）：「不要这个备注（带兵 / 人口上限 / 本城产量 / 速度）」—— 整块撤除 */
  check('计算值备注块整块撤除（gd-effect 与「带兵 <b>」行都不在）',
    !/gd-effect/.test(uS39) && uS39.indexOf("'<span>带兵 <b>'") < 0);""",
    'S2b 六维表头 + 备注块（第二处）',
)

print()
print('========== S3：尺寸/画布族守卫 ==========')
patch(
    SMOKE,
    """  check('#11 尺寸档位固定（sm/lg/xl 三档）',
    /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS16)
    && /\\.modal-lg \\{ width: \\d+px; max-width: 9\\dvw; height: \\d+px; max-height: 8\\dvh; \\}/.test(hS16)
    /* v51：xl 的高度改成了 `min(Npx, Mvh)` —— 它现在装的是"两行物品行 + 分页条"，
       固定 px 在矮屏上放不下。断言只查"有宽度/有上限/高度是数值或 min(px,vh)"，
       **不写死具体数**（尺寸是视觉调参项，写死会让每次微调都假红）。 */
    && /\\.modal-xl \\{ width: \\d+px; max-width: 9\\dvw; height: (min\\(\\d+px, \\d+vh\\)|\\d+px); max-height: 9\\dvh; \\}/.test(hS16));""",
    """  /* v74（老板需求 2）：弹窗尺寸改**固定 px**（画布固定 1440×900）；
     仅留极小窗口兜底 calc(100vw/vh − 20px)。断言只查"三档都在 + 有兜底"，不写死数值。 */
  check('#11 尺寸档位固定（sm/lg/xl 三档，固定 px + 极小窗口兜底）',
    /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS16)
    && /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\); max-height: calc\\(100vh - 20px\\); \\}/.test(hS16)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\); max-height: calc\\(100vh - 20px\\); \\}/.test(hS16));""",
    'S3a 尺寸档位（第一处）',
)
patch(
    SMOKE,
    """  check('页面撑满视口（不写死宽度）', !/#screen-game \\{ width: \\d+px/.test(hS30)
    && /#screen-game \\{ height: 100%/.test(hS30));""",
    """  /* v74（老板需求 2）：「规定大界面像素…作为一个整体界面」——
     画布改**固定像素**（--app-w × --app-h），v27 的"撑满视口"被取代。 */
  check('v74：页面为固定像素画布（1440×900）', /#screen-game \\{ width: var\\(--app-w\\); height: var\\(--app-h\\)/.test(hS30)
    && /--app-w: 1440px/.test(hS30) && /--app-h: 900px/.test(hS30));""",
    'S3b 页面撑满 → 固定画布',
)
patch(
    SMOKE,
    """  check('布局撑满视口 + 两栏同高（修掉"侧栏比中央长"）', (function () {
    /* 判据必须先剥 CSS 注释：说明文字里会引用旧规则的原文 */
    var css = hS30.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /#screen-game \\{ height: 100%; display: flex/.test(css)
      && /\\.main \\{[\\s\\S]{0,220}flex: 1;[\\s\\S]{0,220}align-items: stretch/.test(css)
      && /\\.view-box \\{ flex: 1; min-height: 0/.test(css)
      && !/\\.view-box \\{ height: \\d+px/.test(css)
      && !/\\.auth-side \\{ max-height: \\d+px/.test(css);
  })());
  /* v19：四档尺寸都受 vw/vh 上限约束，视口不足时自动降档 —— 「不超界」是硬约束 */
  check('弹窗不超出视口（vw/vh 双上限）',
    /\\.modal \\{[\\s\\S]{0,200}max-width: 96vw; max-height: 86vh/.test(hS30));
  check('视口不足时高度自动降档', /@media \\(max-height: 860px\\)/.test(hS30));""",
    """  check('v74：画布固定 + 两栏同高（"侧栏比中央长"的修法保留）', (function () {
    /* 判据必须先剥 CSS 注释：说明文字里会引用旧规则的原文 */
    var css = hS30.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /#screen-game \\{ width: var\\(--app-w\\); height: var\\(--app-h\\)[\\s\\S]{0,120}display: flex/.test(css)
      && /\\.main \\{[\\s\\S]{0,220}flex: 1;[\\s\\S]{0,220}align-items: stretch/.test(css)
      && /\\.view-box \\{ flex: 1; min-height: 0/.test(css)
      && !/\\.view-box \\{ height: \\d+px/.test(css)
      && !/\\.auth-side \\{ max-height: \\d+px/.test(css);
  })());
  /* v74：弹窗尺寸固定 px；「视口不足自动降档」@media (max-height: 860px) 与 vw/vh 上限一并撤除 */
  check('v74：弹窗固定 px + 仅留极小窗口兜底（不再随视口缩、不再降档）', (function () {
    var css = hS30.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /\\.modal \\{[\\s\\S]{0,220}max-width: calc\\(100vw - 20px\\); max-height: calc\\(100vh - 20px\\)/.test(css)
      && !/@media \\(max-height: 860px\\)/.test(css)
      && !/max-width: 96vw/.test(css);
  })());""",
    'S3c 弹窗不超界 → 固定 px + 兜底',
)
patch(
    SMOKE,
    """  check('主容器撑满视口（不再写死 1024 宽）', (function () {
    var css = hS38.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /#screen-game \\{ height: 100%; display: flex/.test(css)
      && !/#screen-game \\{ width: \\d+px/.test(css);
  })());""",
    """  /* v74（老板需求 2）：主容器改**固定像素画布**（v27 的"撑满视口"被取代）。 */
  check('v74：主容器为固定像素画布（var(--app-w/--app-h)，拖窗口不动）', (function () {
    var css = hS38.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /#screen-game \\{ width: var\\(--app-w\\); height: var\\(--app-h\\)/.test(css)
      && /\\.main \\{[\\s\\S]{0,120}grid-template-columns: 283px 1fr/.test(css);
  })());""",
    'S3d 主容器（第二处）',
)
patch(
    SMOKE,
    """  check('弹窗宽度受视口约束（lg/xl 都带 max-width）',
    /\\.modal-lg \\{ width: \\d+px; max-width: 9\\dvw/.test(hS38)
    && /\\.modal-xl \\{ width: \\d+px; max-width: 9\\dvw/.test(hS38));""",
    """  /* v74：宽度固定 px + 极小窗口兜底（lg / xl 同规格） */
  check('v74：弹窗宽度固定 px + 极小窗口兜底（lg/xl 同规格）',
    /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS38)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS38));""",
    'S3e 弹窗宽度（第二处）',
)
patch(
    SMOKE,
    """  check('四档固定尺寸齐备（默认/sm/lg/xl）',
    /\\.modal \\{[\\s\\S]{0,200}width: 660px; height: 620px/.test(hS31)
    && /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS31)
    && /\\.modal-lg \\{ width: \\d+px; max-width: 9\\dvw/.test(hS31)
    && /\\.modal-xl \\{ width: \\d+px; max-width: 9\\dvw/.test(hS31));
  check('所有档位受 vw/vh 上限约束（不超界）', /\\.modal \\{[\\s\\S]{0,200}max-width: 96vw; max-height: 86vh/.test(hS31));
  check('视口不足时自动降档', /@media \\(max-height: 860px\\)/.test(hS31));""",
    """  check('四档固定尺寸齐备（默认/sm/lg/xl；v74 起全部固定 px）',
    /\\.modal \\{[\\s\\S]{0,200}width: 660px; height: 620px/.test(hS31)
    && /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS31)
    && /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS31)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS31));
  check('v74：固定 px + 兜底（vw/vh 上限与 860 降档均已撤）', (function () {
    var css = hS31.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /max-width: calc\\(100vw - 20px\\)/.test(css)
      && !/@media \\(max-height: 860px\\)/.test(css) && !/max-width: 96vw/.test(css);
  })());""",
    'S3f 四档尺寸 + 兜底（第二处）',
)

print()
print('========== S4：v46/v51 分栏与弹窗守卫 ==========')
patch(
    SMOKE,
    """  check('v46 需求 2：三块的分栏规则在 CSS 里（窄屏退单列）',
    /\\.gp-body \\{ display: grid; grid-template-columns: minmax\\(0, 0\\.92fr\\) minmax\\(0, 1\\.08fr\\)/.test(hS46)
    && /@media \\(max-width: 900px\\) \\{[\\s\\S]{0,120}\\.gp-body \\{ grid-template-columns: 1fr/.test(hS46)
    /* 装备栏独占右栏；其内部仍是「人形 | 属性套装」并排
       （堆叠会让人形把档案顶到 870px，整页多出一条滚动条） */
    && /\\.gp-doll \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\)/.test(hS46));""",
    """  /* v74（老板需求 4）：「属性跟右边装备栏固定对半空间分配，固定界面」——
     0.92/1.08 改 1fr/1fr；窄屏退单列的断点随固定画布一并撤除。 */
  check('v74：属性与装备栏对半分配；断点已撤（画布固定）',
    /\\.gp-body \\{ grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\)/.test(hS46)
    && !/@media \\(max-width: 900px\\) \\{[\\s\\S]{0,200}\\.gp-body/.test(hS46)
    /* 装备栏独占右栏；其内部仍是「人形 | 属性套装」并排
       （堆叠会让人形把档案顶到 870px，整页多出一条滚动条） */
    && /\\.gp-doll \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\)/.test(hS46));""",
    'S4a gp-body 对半',
)
patch(
    SMOKE,
    """  check('v46：窄视口有降级路径，且方槽不会因框变窄而重叠', (function () {
    /* 断点必须按**视口宽**定（视图区 = 视口 − 侧栏 ~300px），
       否则 1024 视口下右栏只剩 167px，人形框被压到 212px 高而 5 行方槽要 270px
       —— 实测重叠 19 对。现在：1300 让装备栏内部改堆叠、1100 让清单与档案上下排。
       min-width 是最后一道保险：宽低于 230 时框高 = 宽×19/15 < 292，行距会被压没。 */
    return /@media \\(max-width: 1300px\\) \\{[\\s\\S]{0,80}\\.gp-doll \\{ grid-template-columns: minmax\\(0, 1fr\\)/.test(hS46)
      && /@media \\(max-width: 1100px\\) \\{[\\s\\S]{0,80}\\.gen-split \\{ grid-template-columns: 1fr/.test(hS46)
      && /\\.doll \\{[^}]*min-width: 230px/.test(hS46);
  })());""",
    """  check('v74：窄视口断点已撤（画布固定不再重排）；方槽 min-width 保险仍在', (function () {
    /* v46 曾在 1300/1100 视口做"装备栏堆叠 / 清单上下排"降级 ——
       v74 画布固定 1440×900 后这些断点永不触发（留着反而是"随窗口挪动"的隐患）。
       `.doll` 的 min-width 是方槽不重叠的最后一道保险，保留。 */
    return !/@media \\(max-width: 1300px\\)/.test(hS46)
      && !/@media \\(max-width: 1100px\\)/.test(hS46)
      && /\\.doll \\{[^}]*min-width: 230px/.test(hS46);
  })());""",
    'S4b 窄屏降级 → 断点已撤',
)
patch(
    SMOKE,
    """  check('弹窗提到 xl，且矮屏给足高度（正文够放两行卡片）', (function () {
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    return /size: 'xl'/.test(fnBody(uS38, 'ui.openForge = function'))
      && /\\.modal-xl \\{ width: 960px; max-width: 94vw; height: min\\(700px, 88vh\\)/.test(h)
      /* 768 高的屏上 78vh=599 会让正文只剩 509，而两行卡片要 515 —— 差 6px 就又出滚动条。
         窗口给到 600 字符：media 块里这段注释本身就有百来字（注释也算内容，别为省字数删它）。 */
      && /@media \\(max-height: 860px\\)[\\s\\S]{0,600}\\.modal-xl \\{ height: 90vh; \\}/.test(h);
  })());""",
    """  check('弹窗提到 xl，正文高度固定够放两行卡片（v74：700px 定死）', (function () {
    var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    return /size: 'xl'/.test(fnBody(uS38, 'ui.openForge = function'))
      && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(h)
      && /height: 700px/.test(h)
      /* v74：860 降档已撤 —— 画布固定后矮屏不再改弹窗高度（正文 700−帧高仍是短屏最优解） */
      && !/@media \\(max-height: 860px\\)/.test(h);
  })());""",
    'S4c openForge xl 弹窗',
)

print()
print('========== S5：守将加成守卫（title 口径） ==========')
patch(
    SMOKE,
    """check('守将效果已并入六维"作用"列（不再有独立分区）', (function () {
  var u = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
  if (/gp-sec">守将效果/.test(u)) return false;          /* 独立分区必须已删 */
  if (!/guardUse: function/.test(u)) return false;       /* 六维项要带 guardUse */
  /* 行为：把该将设为守将后，六维表里必须出现"守将："那截实际加成 */
  var g = G.state.generals[0];
  var bak = { status: g.status, cityId: g.cityId };
  g.status = 'guard';
  g.cityId = G.currentCity().id;
  G.ui._genSel = g.id;
  /* v65：守将附加文案从「守将：产量 +x%」压成「守将 产量 +x%」（去掉冒号与全角空格，
     否则这行会被撑到折行 —— 正是老板说的"占空间"）。 */
  var has = /gd-guard">守将 /.test(G.ui.generalsHTML());
  g.status = bak.status; g.cityId = bak.cityId;          /* 还原，别污染后续 */
  return has;
})());""",
    """check('守将效果并入六维（v74：进名称悬停；不再有独立分区、不再占作用列）', (function () {
  var u = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
  if (/gp-sec">守将效果/.test(u)) return false;          /* 独立分区必须已删 */
  if (!/guardUse: function/.test(u)) return false;       /* 六维项要带 guardUse */
  /* 行为：把该将设为守将后，六维名称的悬停里必须出现"守将加成："那截实际加成 */
  var g = G.state.generals[0];
  var bak = { status: g.status, cityId: g.cityId };
  g.status = 'guard';
  g.cityId = G.currentCity().id;
  G.ui._genSel = g.id;
  var has = /守将加成：/.test(G.ui.generalsHTML());
  g.status = bak.status; g.cityId = bak.cityId;          /* 还原，别污染后续 */
  return has;
})());""",
    'S5 守将加成 title 口径',
)

print()
print('========== S6：新增第 60 节（v74 七条） ==========')

NEW_SEC = """
/* ============================================================
 * ===== 60. v74：人口加成取消 / 固定画布 / 将领档案 / 出征界面（老板七条） =====
 * ============================================================ */
console.log('\\n===== 60. v74 七条（人口 · 画布 · 简介 · 六维 · 加点 · 备注 · 出征） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uS = stripComment(rd('ui'));
  var stS = stripComment(rd('state'));
  var dS = stripComment(rd('domain'));
  var mS = stripComment(rd('main'));
  var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');
  var hSc = stripComment(hS);

  /* ---------- ① 人口 ---------- */
  check('① 结构：maxPopOf 不再读统率（源里无 POP_PER_TONG / guardGeneralOf 那段）',
    dS.indexOf('POP_PER_TONG') < 0 && !/genAttrs\\(g\\)\\.tong \\*/.test(codeOf(dS, 'GAME.maxPopOf = function')));

  /* ---------- ② 固定画布 ---------- */
  console.log('  --- ② 固定像素画布 ---');
  check('② 画布固定 1440×900（--app-w/--app-h），水平居中',
    /--app-w: 1440px/.test(hSc) && /--app-h: 900px/.test(hSc)
      && /#screen-game \\{ width: var\\(--app-w\\); height: var\\(--app-h\\); margin: 0 auto/.test(hSc));
  check('② 视口断点全撤（宽 900/1100/1300/860/820 + 高 860 一个不留）', (function () {
    return !/@media \\(max-width: (900|1100|1300|860|820)px\\)/.test(hSc)
      && !/@media \\(max-height: 860px\\)/.test(hSc);
  })());
  check('② 弹窗尺寸固定 px（不再 vw/vh 缩放）；仅留极小窗口兜底',
    !/max-width: 9\\dvw/.test(hSc) && !/max-height: 8\\dvh/.test(hSc)
      && (hSc.match(/calc\\(100vw - 20px\\)/g) || []).length >= 2);

  /* ---------- ③④⑤⑥ 将领档案 ---------- */
  console.log('  --- ③④⑤⑥ 将领档案（简介 / 六维 / 加点 / 备注） ---');
  var st74 = G.newGame({ name: '档案验收', region: '司隶' });
  var g74 = st74.generals[0];
  G.ui._genSel = g74.id;
  var h74 = G.ui.generalsHTML();
  check('③ 简介两行化：名字在前 + 资质★（悬停 = 上限/成长）+ 类型 + 描述（去上限句）', (function () {
    var i = h74.indexOf('class="gp-name"');
    if (i < 0) return false;
    var seg = h74.slice(i, i + 1200);
    return /class="gp-name">[^<]/.test(seg)
      && /rank-badge r-\\w+" title="等级上限 \\d+，每级属性成长 \\+\\d+"/.test(seg)
      && /class="gp-style">/.test(seg)
      && /class="gp-sub">[^<]*(可|之才|之资)/.test(seg);
  })());
  check('③ 旧行已撤：Lv N / M 行、装备 n/12、每级成长小字（改为悬停）',
    !/Lv\\d+ \\/ \\d+　·/.test(h74) && !/装备 \\d+\\/12/.test(h74)
      && h74.indexOf('　每级成长 <b>') < 0);
  check('③ Lv 挪进经验行', /Lv<b>\\d+<\\/b>　经验/.test(h74));
  check('④ 六维：每点作用进名称悬停（title=每点作用：…）',
    /<td title="[^"]*每点作用：/.test(h74));
  check('④ 六维：加点列 6 个 ＋ 按钮（六位都有）',
    (h74.match(/data-action="gen-stat-plus"/g) || []).length === 6);
  check('⑤ 自由属性点行在位（含数值）', /class="gd-freep"/.test(h74) && /fp-n/.test(h74));
  check('⑥ 备注块（带兵/人口上限/本城产量/速度）整块撤除',
    h74.indexOf('gd-effect') < 0 && h74.indexOf('>人口上限 <b>') < 0);
  check('④ 属性与装备栏对半分配（1fr / 1fr）',
    /\\.gp-body \\{ grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\)/.test(hSc));

  console.log('  --- ⑤ 类型化成长 + 自由点（实测） ---');
  var cid74 = st74.cities[0].id;
  var gWar = G.makeGeneral('猛将甲', 1, 'idle', cid74, false, 'liang', 'war');
  var gBal = G.makeGeneral('均衡乙', 1, 'idle', cid74, false, 'liang', 'balance');
  gWar.tong = 50; gWar.yw = 50; gWar.zm = 50; gWar.nz = 50;
  gBal.tong = 50; gBal.yw = 50; gBal.zm = 50; gBal.nz = 50;
  for (var k74 = 1; k74 <= 10; k74++) { G.applyLevelGrowth(gWar); G.applyLevelGrowth(gBal); }
  var sumWar = (gWar.tong - 50) + (gWar.yw - 50) + (gWar.zm - 50) + (gWar.nz - 50);
  var sumBal = (gBal.tong - 50) + (gBal.yw - 50) + (gBal.zm - 50) + (gBal.nz - 50);
  check('⑤ 猛将勇武涨得比均衡快（类型化自动加点）', gWar.yw > gBal.yw + 1,
    '猛将勇武 ' + gWar.yw.toFixed(1) + ' vs 均衡 ' + gBal.yw.toFixed(1));
  check('⑤ 均衡与旧口径逐点一致（每级四维各 +成长值）', Math.abs(gBal.tong - (50 + 2 * 10)) < 0.01,
    '50 → ' + gBal.tong);
  check('⑤ 两类总成长量一致（每级 4×成长值，只是分配不同）', Math.abs(sumWar - sumBal) < 0.01,
    sumWar.toFixed(1) + ' vs ' + sumBal.toFixed(1));
  check('⑤ 自由点按 成长值/级 发放（良材 10 级 = 20 点）',
    Math.abs(gBal.freePts - 20) < 0.01 && Math.abs(gWar.freePts - 20) < 0.01,
    '均衡 ' + gBal.freePts + ' / 猛将 ' + gWar.freePts);
  check('⑤ 旧档补发：缺 freePts 的将领按 已过等级×成长值 一次性补', (function () {
    var gg = G.makeGeneral('旧档将', 6, 'idle', cid74, false, 'ying', 'balance');
    delete gg.freePts;
    G.rankOf(gg);
    return Math.abs(gg.freePts - (6 - 1) * 3) < 0.01;
  })());
  check('⑤ addFreePoint：只增不减（点数 -1、属性 +1）', (function () {
    var g2 = G.makeGeneral('加点甲', 1, 'idle', cid74, false, 'liang', 'balance');
    g2.freePts = 3; g2.tong = 40;
    var r1 = G.addFreePoint(g2, 'tong');
    var r2 = G.addFreePoint(g2, 'tong');
    var r3 = G.addFreePoint(g2, 'tong');
    var r4 = G.addFreePoint(g2, 'tong');   /* 第 4 次：点已用完，拒绝 */
    return r1.ok && r2.ok && r3.ok && !r4.ok && g2.tong === 43 && g2.freePts === 0;
  })());
  check('⑤ 自由点可投放速度/体力（独立加法位，不污染基础值）', (function () {
    var g3 = G.makeGeneral('加点乙', 1, 'idle', cid74, false, 'liang', 'balance');
    g3.freePts = 2;
    var before = G.genAttrs(g3).spd, beforeSta = G.staMax(g3);
    G.addFreePoint(g3, 'spd');
    G.addFreePoint(g3, 'sta');
    return G.genAttrs(g3).spd === before + 1 && G.staMax(g3) === beforeSta + 1
      && g3.spdAdd === 1 && g3.staAdd === 1;
  })());
  check('⑤ 结构：升级日志口径 =（自动加点 +X · 自由点 +X）', /自由点 \\+' \\+ step/.test(rd('battle').replace(/\\s+/g, ' ')));

  /* ---------- ⑦ 出征界面 ---------- */
  console.log('  --- ⑦ 出征界面 ---');
  check('⑦ 结构：总览/战力行 + 全带/清空按钮 + 动作注册', (function () {
    return /id="exp-sum"/.test(uS) && /id="exp-power"/.test(uS)
      && /data-action="exp-fill-all"/.test(uS) && /data-action="exp-clear-all"/.test(uS)
      && /case 'exp-fill-all'/.test(mS) && /case 'exp-clear-all'/.test(mS)
      && /ui\\._expRes = t/.test(uS);
  })());
  check('⑦ 战力口径复用 troopPower + defDivisor（不另造第二个出口）',
    /GAME\\.story && GAME\\.story\\.troopPower/.test(uS) && /DATA\\.INVASION && DATA\\.INVASION\\.defDivisor/.test(uS));

  /* ---------- 加点弹窗结构 ---------- */
  check('④⑤ 加点弹窗：自由点 + 道具双入口、检查上限与库存', (function () {
    return /ui\\.openStatPlus = function/.test(uS) && /data-action="stat-plus-free"/.test(uS)
      && /data-action="stat-plus-item"/.test(uS) && /case 'stat-plus-free'/.test(mS)
      && /case 'stat-plus-item'/.test(mS) && /GAME\\.doStatPlusFree = function/.test(mS);
  })());
})();

"""

patch(
    SMOKE,
    """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""",
    NEW_SEC + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""",
    'S6 新增第 60 节',
)

print()
print('========== 测试补丁完成 ==========')
