# -*- coding: utf-8 -*-
"""v76 · 四条 —— 测试补丁（smoke 8 处 + e2e 3 处翻转/重做）

smoke-1  §25 拆毁：逐级断言（本步 50% / Lv3→Lv2→空）
smoke-2  §25 之后：v45 分页断言 → v76（12 席/页 + 底栏翻页）
smoke-3  §31 v28：将领分页断言更新
smoke-4  §31：30 将领实测 → 12/页 + 翻页
smoke-5  §28 附近：12 席 label 更新
smoke-6  #12 建筑动线三段 → 功能/操作行/关闭吸底
smoke-7  v56 底栏三格 → 三键同排；op-row-between ≥3 → ≥2
smoke-8  需求 7 拆毁/移动按钮 → 三键同排
smoke-9  地图：浮标水平居中 → 迁入底部条
e2e-1    地图段（vc → #bottom-bar）
e2e-2    v24 地图块（vc → #bottom-bar）
e2e-3    ⑦ 拆毁流程（逐级）+ v28 底栏（acts 行）
"""
import io, sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t or new.replace('\n', '\r\n') in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    cands = []
    if old in t:
        cands.append((old, new))
    else:
        old_c, new_c = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
        if old_c in t:
            cands.append((old_c, new_c))
    if not cands:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    old2, new2 = cands[0]
    c = t.count(old2)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, c))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


# ============================================================
# smoke-1 · §25 拆毁块
# ============================================================
patch(
    SMOKE,
    """  check('返还 = 累计投入的 50%', (function () {
    var b = DATA.BUILDINGS.minfang;
    var inv = G.investedIn(b, 3);
    return refS.grain === Math.floor(inv.grain * DATA.DEMOLISH_RATE) && DATA.DEMOLISH_RATE === 0.5;
  })());""",
    """  check('返还 = 本步投入的 50%（v76 逐级：Lv2→Lv3 那一步）', (function () {
    var b = DATA.BUILDINGS.minfang;
    var inv = G.investedIn(b, 3), prev = G.investedIn(b, 2);
    return refS.grain === Math.floor((inv.grain - prev.grain) * DATA.DEMOLISH_RATE) && DATA.DEMOLISH_RATE === 0.5;
  })());""",
    'smoke-1a 返还口径',
)
patch(
    SMOKE,
    """  check('城内拆毁执行成功', rDem.ok === true, rDem.msg);
  check('拆毁后资源确实返还', gS.res.grain > grain0, Math.round(grain0) + ' → ' + Math.round(gS.res.grain));
  check('拆毁后地块变为空地', !cS.cells[idxS].build);""",
    """  check('城内拆毁执行成功', rDem.ok === true, rDem.msg);
  check('拆毁后资源确实返还', gS.res.grain > grain0, Math.round(grain0) + ' → ' + Math.round(gS.res.grain));
  check('v76 逐级：Lv3 拆一次 → Lv2（不整座移除）',
    !!(cS.cells[idxS].build && cS.cells[idxS].build.lvl === 2),
    '现在 Lv' + (cS.cells[idxS].build ? cS.cells[idxS].build.lvl : '空'));
  G.demolishAt(cS.id, idxS);
  G.demolishAt(cS.id, idxS);
  check('拆到 Lv1 再拆 → 整座移除、地块变空地（v76）', !cS.cells[idxS].build);""",
    'smoke-1b 逐级拆除',
)

# ============================================================
# smoke-2 · v45 分页块 → v76
# ============================================================
patch(
    SMOKE,
    """  check('v45：左清单取消分页，改为整段可滚（老板 v52 又要求"不要没排满还挂着下拉"）',
    !/ui\\.GEN_PER_PAGE/.test(uiS.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')) && !/ui\\.pageOf\\('gens'/.test(uiS)
    && !/ui\\.pagerHTML\\('gens'/.test(uiS)
    /* v52：高度不再写死 68vh（写死 → 将领少时清单也被撑满、滚动条常驻，老板："没排满整什么下拉"），
       改成吃满可用高度、内容少就矮。这里查**块内容**而不是 160 字符窗口（注释会把窗口挤爆）。 */
    && /overflow-y: auto/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && /max-height: 100%/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && !/max-height: 68vh/.test(cssBlock(htmlSrc25, '.gen-list {')));""",
    """  check('v76：左清单 12 席/页 + 底部条翻页（v45 曾整段滚动）',
    /ui\\.GEN_PER = 12/.test(uiS) && /ui\\.pageOf\\('gen', pool\\.length, ui\\.GEN_PER\\)/.test(uiS)
    && /ui\\.pagerHTML\\('gen', pool\\.length, ui\\.GEN_PER\\)/.test(uiS)
    && !/ui\\.GEN_PER_PAGE/.test(uiS.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''))
    /* v52 保留：高度不写死 68vh；v76：12 行平分高度（行可伸缩 + 最小行高兜底） */
    && /overflow-y: auto/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && /max-height: 100%/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && !/max-height: 68vh/.test(cssBlock(htmlSrc25, '.gen-list {'))
    && /flex: 1 1 0/.test(cssBlock(htmlSrc25, '.gen-list > .gen-row {')));""",
    'smoke-2 v45→v76',
)

# ============================================================
# smoke-3 · §31 v28 分页断言
# ============================================================
patch(
    SMOKE,
    """  check('将领左清单整段滚动（v45：取消每页 6 席的分页）',
    /ui\\.GEN_SLOTS = 12/.test(uS31)
    && !/ui\\.GEN_PER_PAGE/.test(uS31.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''))
    && !/ui\\.pagerHTML\\('gens'/.test(uS31)
    && /for \\(var i = 0; i < total; i\\+\\+\\) rows\\.push\\(ui\\.genRow/.test(uS31));""",
    """  check('将领左清单 12 席/页 + 底栏翻页（v76；v45 曾取消分页）',
    /ui\\.GEN_SLOTS = 12/.test(uS31) && /ui\\.GEN_PER = 12/.test(uS31)
    && !/ui\\.GEN_PER_PAGE/.test(uS31.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''))
    && /ui\\.pagerHTML\\('gen', pool\\.length, ui\\.GEN_PER\\)/.test(uS31)
    && /for \\(var i = 0; i < ui\\.GEN_PER; i\\+\\+\\)/.test(uS31));""",
    'smoke-3 v28 分页断言',
)

# ============================================================
# smoke-4 · §31 30 将领实测
# ============================================================
patch(
    SMOKE,
    """  check('实测：30 位将领时**全部渲染**（v45：不再截断到 6 席）', (function () {
    var s = G.state, backup = s.generals;
    var proto = backup[0] || G.makeGeneral('样本', 1);
    var many = [];
    for (var i = 0; i < 30; i++) {
      var g = JSON.parse(JSON.stringify(proto));
      g.id = 'pgtest' + i; g.name = '测试将' + i;
      many.push(g);
    }
    s.generals = many;
    var html = G.ui.generalsHTML();
    /* 清单行是 .gen-row（v41 起；容器 .gen-list 前缀不撞） */
    var rows = (html.match(/<div class="gen-row[\\s"']/g) || []).length;
    var hasLast = html.indexOf('测试将29') >= 0;
    s.generals = backup;
    return rows >= 30 && hasLast;
  })());""",
    """  check('实测：30 位将领 → 每页 12 席、底部条出现翻页（v76）', (function () {
    var s = G.state, backup = s.generals;
    var proto = backup[0] || G.makeGeneral('样本', 1);
    var many = [];
    for (var i = 0; i < 30; i++) {
      var g = JSON.parse(JSON.stringify(proto));
      g.id = 'pgtest' + i; g.name = '测试将' + i;
      many.push(g);
    }
    s.generals = many;
    G.ui._pages['gen'] = 1;
    G.ui._bottom.length = 0;
    var html = G.ui.generalsHTML();
    var rows = (html.match(/<div class="gen-row[\\s"']/g) || []).length;
    var pager = G.ui._bottom.join('');
    G.ui._pages['gen'] = 2;                       /* 翻到第 2 页：应出现 测试将12 */
    var html2 = G.ui.generalsHTML();
    s.generals = backup;
    G.ui._pages['gen'] = 1;
    G.ui._bottom.length = 0;
    return rows === 12 && html.indexOf('测试将0') >= 0 && html.indexOf('测试将12') < 0
      && html2.indexOf('测试将12') >= 0 && pager.indexOf('data-key="gen"') >= 0;
  })());""",
    'smoke-4 30 将领',
)

# ============================================================
# smoke-5 · 12 席 label
# ============================================================
patch(
    SMOKE,
    """check('将领左清单渲染全部席位（v45：不再每页 6 席），空席写明原因', (function () {""",
    """check('将领左清单渲染整页 12 席，空席写明原因（v76）', (function () {""",
    'smoke-5 12 席 label',
)

# ============================================================
# smoke-6 · #12 动线三段
# ============================================================
patch(
    SMOKE,
    """  check('#12 建筑面板动线三段（功能 / 升级 / 底栏）', /class="op-zone-t">功能</.test(uS16) && /class="op-zone-t">升级</.test(uS16) && /class="bldg-foot"/.test(uS16));""",
    """  check('#12 建筑面板动线（功能 / 操作三键同排 / 关闭吸底；v76 更新）',
    /class="op-zone-t">功能</.test(uS16) && /class="bldg-acts"/.test(uS16) && /class="bldg-foot"/.test(uS16));""",
    'smoke-6 动线三段',
)

# ============================================================
# smoke-7 · v56 底栏三格 + op-row-between 计数
# ============================================================
patch(
    SMOKE,
    """    check('★ 底栏三格：拆毁（左）· 关闭（中）· 移动（右）', (function () {
      /* 首个 bldg-foot 是"施工中"的底栏（只有取消+关闭）——
         取**含拆毁按钮**的那段（城内建筑分支）来验三格摆位 */
      var i = u56.indexOf('data-action="demolish-ask" data-kind="city');
      if (i < 0) return false;
      var a = u56.lastIndexOf('class="bldg-foot"', i);
      if (a < 0) return false;
      var seg = u56.slice(a, i + 900);
      return seg.indexOf('close-modal') >= 0 && seg.indexOf('move-ask') >= 0
        && seg.indexOf('demolish-ask') < seg.indexOf('close-modal')
        && seg.indexOf('close-modal') < seg.indexOf('move-ask');
    })());

    check('★ 升级行统一：费用与按钮同行（op-row-between 至少三处）',
      (u56.match(/op-row op-row-between/g) || []).length >= 3,
      (u56.match(/op-row op-row-between/g) || []).length + ' 处');""",
    """    check('★ v76：操作三键同排（升级 · 拆 1 级 · 移动/交换），关闭单独吸底', (function () {
      /* 取**含城内拆毁按钮**的那段，从 .bldg-acts 起验三键顺序与底栏关闭 */
      var i = u56.indexOf('data-action="demolish-ask" data-kind="city');
      if (i < 0) return false;
      var a = u56.lastIndexOf('class="bldg-acts"', i);
      if (a < 0) return false;
      var seg = u56.slice(a, i + 1200);
      return seg.indexOf('confirm-upgrade') >= 0
        && seg.indexOf('confirm-upgrade') < seg.indexOf('demolish-ask')
        && seg.indexOf('demolish-ask') < seg.indexOf('move-ask')
        && seg.indexOf('close-modal') > seg.indexOf('move-ask');
    })());

    check('★ 升级行统一：费用与按钮同行（op-row-between 余 2 处：城外/城墙）',
      (u56.match(/op-row op-row-between/g) || []).length >= 2,
      (u56.match(/op-row op-row-between/g) || []).length + ' 处');""",
    'smoke-7 v56 底栏',
)

# ============================================================
# smoke-8 · 需求 7 拆毁/移动按钮
# ============================================================
patch(
    SMOKE,
    """check('拆毁在左下、移动在右下，且都是小按钮', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  return /class="bldg-foot"/.test(u)
    && /class="btn sm red" data-action="demolish-ask"/.test(u)
    && /class="btn sm" data-action="move-ask"/.test(u)
    && /\\.bldg-foot \\{ display: flex; justify-content: space-between/.test(h);
})());""",
    """check('v76：升级/拆除/移动同排（.bldg-acts），关闭单独吸底', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  return /class="bldg-acts"/.test(u)
    && /data-action="confirm-upgrade"/.test(u)
    && /data-action="demolish-ask"/.test(u)
    && /data-action="move-ask"/.test(u)
    && /\\.bldg-foot \\{ display: flex; justify-content: center/.test(h);
})());""",
    'smoke-8 三键同排',
)

# ============================================================
# smoke-9 · 地图浮标 → 底部条
# ============================================================
patch(
    SMOKE,
    """  /* v45（需求 2）：浮标由右下角改为**水平居中**。
     为什么不用 `left:50% + translateX(-50%)`：abspos 的 shrink-to-fit 拿
     「left 到包含块右缘」当可用宽度，left:50% 只给半幅 → 浮标被挤窄、按钮文字折行，
     整条从 44px 胖成 60px（实测踩过）。所以断言直接认这个写法。 */
  check('地图导航浮标水平居中（v45：原为右下角）',
    /class="map-dock"/.test(uS37)
    && /\\.map-dock \\{[\\s\\S]{0,600}position: absolute; left: 0; right: 0;[\\s\\S]{0,200}margin: 0 auto;[\\s\\S]{0,120}width: fit-content/.test(hS37));""",
    """  /* v76（老板）：「把地图的导航栏（上下左右，坐标之类）放到这个导航范围内」——
     导航不再是地图页浮标（v24 右下角 → v45 居中），改**登记到底部固定导航条**
     （ui._bottom.push → paintBottom）；.map-dock 改为条内静态排布。 */
  check('地图导航迁入底部导航条（v76）',
    /ui\\._bottom\\.push\\('<div class="map-dock">'/.test(uS37)
    && /\\.map-dock \\{[\\s\\S]{0,200}display: flex; align-items: center; gap: 8px/.test(hS37)
    && !/\\.map-dock \\{[\\s\\S]{0,300}position: absolute/.test(hS37));""",
    'smoke-9a 导航居中→底栏',
)
patch(
    SMOKE,
    """  check('实测：地图 HTML 只剩棋盘 + 浮标', (function () {
    var h = G.ui.mapHTML();
    return h.indexOf('map-dock') >= 0 && h.indexOf('mapCanvas') >= 0
      && h.indexOf('天下大势') < 0 && h.indexOf('湖泊') < 0 && h.indexOf('已占野地') < 0
      && h.indexOf('观察框') < 0;
  })());""",
    """  check('实测：地图 HTML 只剩棋盘；导航登记到底部条（v76）', (function () {
    var h = G.ui.mapHTML();
    var bar = G.ui._bottom.join('');
    return h.indexOf('mapCanvas') >= 0 && h.indexOf('map-dock') < 0
      && bar.indexOf('map-dock') >= 0 && bar.indexOf('map-pad') >= 0
      && h.indexOf('天下大势') < 0 && h.indexOf('湖泊') < 0 && h.indexOf('已占野地') < 0
      && h.indexOf('观察框') < 0;
  })());""",
    'smoke-9b 实测地图 HTML',
)

# ============================================================
# e2e-1 · 地图段（19.）
# ============================================================
patch(
    E2E,
    """  const mapHtml = vc.innerHTML;
  check('地图含方向导航栏', mapHtml.indexOf('map-pad') >= 0 && mapHtml.indexOf('map-btn') >= 0);
  const padBtns = vc.querySelectorAll('[data-action="map-pan"]');
  check('方向按钮共 4 个', padBtns.length === 4, padBtns.length + ' 个');
  check('含坐标输入框', !!vc.querySelector('#map-gx') && !!vc.querySelector('#map-gy'));
  check('含视野信息', !!vc.querySelector('#map-info'), (vc.querySelector('#map-info') || {}).textContent);""",
    """  const mapHtml = vc.innerHTML;
  /* v76（老板）：地图导航迁入底部固定导航条 —— 相关元素改从 #bottom-bar 取 */
  const bb19 = document.querySelector('#bottom-bar').innerHTML;
  check('地图含方向导航栏（v76：在底部导航条）', bb19.indexOf('map-pad') >= 0 && bb19.indexOf('map-btn') >= 0);
  const padBtns = document.querySelectorAll('#bottom-bar [data-action="map-pan"]');
  check('方向按钮共 4 个', padBtns.length === 4, padBtns.length + ' 个');
  check('含坐标输入框', !!document.querySelector('#map-gx') && !!document.querySelector('#map-gy'));
  check('含视野信息', !!document.querySelector('#map-info'), (document.querySelector('#map-info') || {}).textContent);""",
    'e2e-1a 地图头部',
)
patch(
    E2E,
    """  check('地图导航浮标内（含方向键）', /map-dock/.test(mapHtml) && /map-pad/.test(mapHtml));""",
    """  check('地图导航在底部条内（含方向键；v76）', bb19.indexOf('map-dock') >= 0 && bb19.indexOf('map-pad') >= 0);""",
    'e2e-1b 导航位置',
)
patch(
    E2E,
    """  vc.querySelector('#map-gx').value = '265';
  vc.querySelector('#map-gy').value = '215';
  click(vc.querySelector('[data-action="map-goto"]'));""",
    """  document.querySelector('#map-gx').value = '265';
  document.querySelector('#map-gy').value = '215';
  click(document.querySelector('[data-action="map-goto"]'));""",
    'e2e-1c 坐标跳转',
)
patch(
    E2E,
    """  const pc19 = G.map.playerCity();
  click(vc.querySelector('[data-action="map-center"]'));""",
    """  const pc19 = G.map.playerCity();
  click(document.querySelector('[data-action="map-center"]'));""",
    'e2e-1d 回主城',
)

# ============================================================
# e2e-2 · v24 地图块
# ============================================================
patch(
    E2E,
    """  /* ①②③ 地图：只留棋盘 + 右下角浮标 */
  G.ui.setView('map');
  await sleep(90);
  const m24 = vc.innerHTML;
  check('地图只渲染棋盘与右下角浮标',
    !!vc.querySelector('.map-dock') && !!vc.querySelector('#mapCanvas')
    && m24.indexOf('天下大势') < 0 && m24.indexOf('湖泊') < 0
    && m24.indexOf('已占野地') < 0 && m24.indexOf('点击城池可出征') < 0);
  check('导航在浮标内（方向键 + 坐标框）',
    vc.querySelectorAll('.map-dock [data-action="map-pan"]').length === 4
    && !!vc.querySelector('.map-dock #map-gx') && !!vc.querySelector('.map-dock #map-gy'));""",
    """  /* ①②③ 地图：只留棋盘；导航迁入底部导航条（v76） */
  G.ui.setView('map');
  await sleep(90);
  const m24 = vc.innerHTML;
  check('地图只渲染棋盘；导航在底部导航条（v76）',
    !!document.querySelector('#bottom-bar .map-dock') && !!vc.querySelector('#mapCanvas')
    && m24.indexOf('天下大势') < 0 && m24.indexOf('湖泊') < 0
    && m24.indexOf('已占野地') < 0 && m24.indexOf('点击城池可出征') < 0);
  check('导航在底部条内（方向键 + 坐标框）',
    document.querySelectorAll('#bottom-bar .map-dock [data-action="map-pan"]').length === 4
    && !!document.querySelector('#map-gx') && !!document.querySelector('#map-gy'));""",
    'e2e-2a v24 地图块',
)
patch(
    E2E,
    """  click(Array.prototype.slice.call(vc.querySelectorAll('.map-dock [data-action="map-pan"]'))
    .filter((b) => b.dataset.dx === String(G.ui.MAP_STEP_X))[0]);
  await sleep(60);
  check('浮标方向键生效（一次右移一屏 = 12 格）',""",
    """  click(Array.prototype.slice.call(document.querySelectorAll('#bottom-bar .map-dock [data-action="map-pan"]'))
    .filter((b) => b.dataset.dx === String(G.ui.MAP_STEP_X))[0]);
  await sleep(60);
  check('底栏方向键生效（一次右移一屏 = 12 格）',""",
    'e2e-2b 方向键',
)
patch(
    E2E,
    """    const dock = vc.querySelector('.map-dock');
    const wrap = vc.querySelector('.map-wrap');
    if (!dock || !wrap) { check('导航条在版面内水平居中', false); return; }
    const d = dock.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    const off = Math.abs((d.left + d.right) / 2 - (w.left + w.right) / 2);
    check('导航条在版面内水平居中（v45：原为右下角）', off <= 2, '偏离中线 ' + off.toFixed(1) + 'px');""",
    """    const dock = document.querySelector('#bottom-bar .map-dock');
    if (!dock) { check('导航条挂在底部导航条内（v76）', false); return; }
    check('导航条挂在底部导航条内（v76：原为地图页右下浮标）', true);""",
    'e2e-2c 居中→挂底栏',
)

# ============================================================
# e2e-3 · ⑦ 拆毁流程（逐级）
# ============================================================
patch(
    E2E,
    """  check('找到可拆毁建筑', bIdx22 >= 0, 'idx=' + bIdx22);
  if (bIdx22 >= 0) {
    G.ui.openBuildModal(bIdx22);
    await sleep(80);
    const bHtml22 = document.querySelector('#modal-root').innerHTML;
    check('建筑面板有拆毁按钮', !!document.querySelector('#modal-root [data-action="demolish-ask"]'));
    check('建筑面板显示返还预览', bHtml22.indexOf('返还累计投入的 50%') >= 0);
    check('建筑面板不再显示升级耗时', bHtml22.indexOf('耗时') < 0);
    click(document.querySelector('#modal-root [data-action="demolish-ask"]'));
    await sleep(90);
    check('拆毁确认弹窗出现', !!document.querySelector('#modal-root [data-action="demolish-do"]'));
    click(document.querySelector('#modal-root [data-action="demolish-do"]'));
    await sleep(100);
    check('确认后建筑被拆毁', !s.cities[0].cells[bIdx22].build);
    check('拆毁后地块变为空地', !!document.querySelector('.iso-tile.empty'), 'iso-tile.empty 存在');
  } else {
    check('建筑面板有拆毁按钮', false, '无建筑');
    check('建筑面板显示返还预览', false, '无建筑');
    check('建筑面板不再显示升级耗时', false, '无建筑');
    check('拆毁确认弹窗出现', false, '无建筑');
    check('确认后建筑被拆毁', false, '无建筑');
    check('拆毁后地块变为空地', false, '无建筑');
  }""",
    """  check('找到可拆毁建筑', bIdx22 >= 0, 'idx=' + bIdx22);
  if (bIdx22 >= 0) {
    s.cities[0].cells[bIdx22].build.lvl = 2;   /* v76：设 Lv2，验证"逐级"（拆一次 → Lv1） */
    G.ui.openBuildModal(bIdx22);
    await sleep(80);
    const bHtml22 = document.querySelector('#modal-root').innerHTML;
    check('建筑面板有拆毁按钮', !!document.querySelector('#modal-root [data-action="demolish-ask"]'));
    check('v76：面板不再写返还长备注；操作三键同排',
      bHtml22.indexOf('返还累计投入的 50%') < 0 && bHtml22.indexOf('class="bldg-acts"') >= 0);
    check('建筑面板不再显示升级耗时', bHtml22.indexOf('耗时') < 0);
    click(document.querySelector('#modal-root [data-action="demolish-ask"]'));
    await sleep(90);
    check('拆毁确认弹窗出现', !!document.querySelector('#modal-root [data-action="demolish-do"]'));
    click(document.querySelector('#modal-root [data-action="demolish-do"]'));
    await sleep(100);
    check('v76 逐级：确认后只降 1 级（Lv2 → Lv1）',
      !!(s.cities[0].cells[bIdx22].build && s.cities[0].cells[bIdx22].build.lvl === 1));
    /* 拆到 Lv1 再拆一次 → 整座移除、地块腾空 */
    G.ui.openBuildModal(bIdx22);
    await sleep(80);
    click(document.querySelector('#modal-root [data-action="demolish-ask"]'));
    await sleep(90);
    click(document.querySelector('#modal-root [data-action="demolish-do"]'));
    await sleep(100);
    check('拆到 Lv1 再拆 → 整座移除', !s.cities[0].cells[bIdx22].build);
    check('拆毁后地块变为空地', !!document.querySelector('.iso-tile.empty'), 'iso-tile.empty 存在');
  } else {
    check('建筑面板有拆毁按钮', false, '无建筑');
    check('v76：面板不再写返还长备注；操作三键同排', false, '无建筑');
    check('建筑面板不再显示升级耗时', false, '无建筑');
    check('拆毁确认弹窗出现', false, '无建筑');
    check('v76 逐级：确认后只降 1 级（Lv2 → Lv1）', false, '无建筑');
    check('拆到 Lv1 再拆 → 整座移除', false, '无建筑');
    check('拆毁后地块变为空地', false, '无建筑');
  }""",
    'e2e-3a 拆毁流程',
)
patch(
    E2E,
    """    const foot28 = document.querySelector('#modal-root .bldg-foot');
    check('建筑面板有左下/右下分居的操作行（拆毁 · 移动）', !!foot28
      && !!foot28.querySelector('[data-action="demolish-ask"]')
      && !!foot28.querySelector('[data-action="move-ask"]'));
    check('拆毁与移动都是小按钮（btn sm）',
      /btn sm red/.test(foot28.innerHTML) && /btn sm"/.test(foot28.innerHTML));""",
    """    const acts28 = document.querySelector('#modal-root .bldg-acts');
    check('v76：操作三键同排（升级 · 拆 1 级 · 移动/交换）', !!acts28
      && !!(acts28.querySelector('[data-action="confirm-upgrade"]') || acts28.querySelector('.dim'))
      && !!acts28.querySelector('[data-action="demolish-ask"]')
      && !!acts28.querySelector('[data-action="move-ask"]'));
    check('v76：关闭按钮单独吸底', !!document.querySelector('#modal-root .bldg-foot [data-action="close-modal"]'));""",
    'e2e-3b v28 底栏',
)

print('\n测试补丁落盘完成。')
