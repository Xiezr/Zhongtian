# -*- coding: utf-8 -*-
"""v85 · 测试补丁：e2e 两处旧断言改判（12×6 → 13×11 / 动态）+ e2e v85 段 + smoke §70。

- fitMapCell 搜索式自适应后：jsdom（无布局，基准框 869×758）输出 13×11@63；
  真机 1440 输出 13×7@104（真机验收脚本另行断言）。
- 旧断言 12×6 与 cell≤104 属"语义变更"（地图自适应口径重写），按新值改判。
"""
import io
import sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
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


print('== T1. e2e 旧断言改判（2 处） ==')
patch(
    E2E,
    """  /* v50：地块改为菱形等距 —— 画布切成 12×6 个格距（菱形只有半格高），
     可见菱形是 12 宽 × 12 高。格距按窗口算，上限随菱形目标格距抬到 104。 */
  check('观察框为 12×6（v50 菱形），格距在合理区间',
    G.map._view && G.map._view.spanX === 12 && G.map._view.spanY === 6
    && G.map._view.cell >= 34 && G.map._view.cell <= 104,
    G.map._view.spanX + '×' + G.map._view.spanY + ' cell=' + G.map._view.cell);""",
    """  /* v85（老板「占满 + 放大」）：fitMapCell 改**搜索式自适应** —— 行列不再固定 12×6，
     取"覆盖率最优、格距次优"的解；格距上限 104 → 128。
     jsdom（无布局，基准框 869×758）下确定输出 13×11@63。 */
  check('观察框为搜索式自适应（jsdom 基准 13×11），格距在合理区间',
    G.map._view && G.map._view.spanX === 13 && G.map._view.spanY === 11
    && G.map._view.cell >= 34 && G.map._view.cell <= 128,
    G.map._view.spanX + '×' + G.map._view.spanY + ' cell=' + G.map._view.cell);""",
    'T1a 观察框断言改判',
    probe='观察框为搜索式自适应',
)
patch(
    E2E,
    """  /* ④ 观察框（v50：菱形等距 12×6 格距） */
  G.ui.setView('map');
  await sleep(140);
  const cv26 = document.querySelector('#mapCanvas');
  check('画布按 12×6 渲染（宽高不等）', cv26 && G.map._view
    && cv26.width === 12 * G.map._view.cell && cv26.height === 6 * G.map._view.cell,
    cv26 ? cv26.width + '×' + cv26.height + ' cell=' + G.map._view.cell : 'n/a');""",
    """  /* ④ 观察框（v85：搜索式自适应 —— 画布 = 当前观察框 × 格距，行列不再写死） */
  G.ui.setView('map');
  await sleep(140);
  const cv26 = document.querySelector('#mapCanvas');
  check('画布按当前观察框渲染（宽高不等）', cv26 && G.map._view
    && cv26.width === G.map._view.spanX * G.map._view.cell
    && cv26.height === G.map._view.spanY * G.map._view.cell,
    cv26 ? cv26.width + '×' + cv26.height + ' cell=' + G.map._view.cell : 'n/a');""",
    'T1b 画布尺寸断言改动态',
    probe='画布按当前观察框渲染',
)

print()
print('== T2. e2e 新增 v85 段 ==')
V85SEC = r'''  /* ============================================================
   * v85（老板）：民房去人口统计 / 底部缩略地图 → 天下大势
   * ============================================================ */
  console.log('\n--- v85. 民房 · 缩略地图 · 天下大势（真实 DOM） ---');
  {
    /* ① 民房弹窗无「人口统计」入口 */
    const c85 = G.state.cities[0];
    let m85 = c85.cells.findIndex((x) => x.build && x.build.id === 'minfang');
    if (m85 < 0) {
      m85 = c85.cells.findIndex((x) => !x.build && !x.official);
      if (m85 >= 0) c85.cells[m85] = { build: { id: 'minfang', lvl: 2 }, pending: null };
    }
    G.ui.openBuildModal(m85 < 0 ? undefined : m85);
    await sleep(140);
    check('v85：民房弹窗无「人口统计」按钮', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('民房') >= 0
        && root.textContent.indexOf('人口统计') < 0;
    })());
    G.ui.closeModal();
    await sleep(60);

    /* ② 底部导航栏缩略图 → 天下大势面板 */
    G.ui.paintBottom();
    await sleep(40);
    check('v85：底部条固定拼缩略图（38px canvas）',
      !!document.querySelector('#bottom-bar .bb-mini #mini-canvas'));
    click(document.querySelector('#bottom-bar .bb-mini'));
    await sleep(160);
    check('v85：点击展开「天下大势」（缩略图 + 州郡界图例）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && !!root.querySelector('#mini-big')
        && root.textContent.indexOf('天下大势') >= 0
        && root.textContent.indexOf('州界') >= 0 && root.textContent.indexOf('郡界') >= 0;
    })());
    check('v85：缩略数据（13 州 · 25 万格 · 边界线存在）', (function () {
      const d = G.map.miniBuild();
      if (!d || d.stName.length !== 13 || d.state.length !== 250000) return false;
      let e1 = 0, e2 = 0;
      for (let y = 0; y < 500; y += 7) {
        for (let x = 0; x < 499; x += 7) {
          const i = y * 500 + x;
          if (d.state[i] !== d.state[i + 1]) e1++;
          else if (d.jun[i] !== d.jun[i + 1]) e2++;
        }
      }
      return e1 > 10 && e2 > 10;
    })());
    G.ui.closeModal();
    await sleep(60);
  }

'''
patch(
    E2E,
    "    G.ui.closeModal();\n    await sleep(60);\n  }\n\n  await sleep(30);\n\n  G.ui.setView('city');",
    "    G.ui.closeModal();\n    await sleep(60);\n  }\n\n" + V85SEC + "  await sleep(30);\n\n  G.ui.setView('city');",
    'T2 e2e v85 段',
    probe='v85. 民房 · 缩略地图 · 天下大势',
)

print()
print('== T3. smoke 新增 §70 ==')
SEC70 = r'''/* ============================================================
 * 70. v85（老板）：民房入口 · 地图自适应 · 缩略地图数据
 * ============================================================ */
console.log('\n===== 70. v85 地图自适应 · 缩略地图 =====');
(function () {
  var uS85 = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
  var mS85 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'map.js'), 'utf8');

  console.log('  --- ① 民房去「人口统计」入口 ---');
  check('v85：BLDG_FUNC 无 minfang 条目（面板与城防入口保留）', (function () {
    var i = uS85.indexOf('var BLDG_FUNC = {');
    var j = uS85.indexOf('};', i);
    var block = uS85.slice(i, j);
    return i > 0 && block.indexOf('minfang') < 0 && block.indexOf('chengqiang') >= 0
      && block.indexOf('junying') >= 0;
  })());

  console.log('  --- ② 地图自适应（搜索式） ---');
  check('v85：fitMapCell 为搜索式（枚举 + 覆盖率 + 上限 128）', (function () {
    var fn = codeOf(uS85, 'ui.fitMapCell = function');
    return /MAP_SPAN_MAX_X/.test(fn) && /cov/.test(fn) && /MAP_CELL_MAX = 128/.test(uS85);
  })());
  check('实测：基准框（869×758）输出 13×11@63（确定性）', (function () {
    var cell = G.ui.fitMapCell();
    var fr = G.ui.mapFrame;
    return fr.spanX === 13 && fr.spanY === 11 && cell === 63
      && cell >= 34 && cell <= 128;
  })());

  console.log('  --- ③ 缩略地图数据层 ---');
  check('v85：miniBuild 派生 + 缓存（结构）',
    /GAME\.map\.miniBuild = function/.test(mS85) && /GAME\.map\._mini/.test(mS85));
  check('实测：归属 25 万格 · 13 州 · 洛阳格=司隶 · 边界存在 · 缓存命中', (function () {
    var d = G.map.miniBuild();
    if (!d || d.state.length !== 250000 || d.stName.length !== 13) return false;
    if (d.state[215 * 500 + 265] !== 0) return false;      /* 洛阳（265,215）→ 司隶 id=0 */
    var edgeN = 0, jedgeN = 0;
    for (var y = 0; y < 500; y++) {
      for (var x = 0; x < 499; x++) {
        var i = y * 500 + x;
        if (d.state[i] !== d.state[i + 1]) edgeN++;
        else if (d.jun[i] !== d.jun[i + 1]) jedgeN++;
      }
    }
    return edgeN > 500 && jedgeN > 500 && G.map.miniBuild() === d;
  })());

  console.log('  --- ④ 渲染层与底部条 ---');
  check('v85：渲染层齐备（离屏/绘制/面板/底部小图）',
    /ui\.miniOff = function/.test(uS85) && /ui\.drawMini = function/.test(uS85)
    && /ui\.openMinimap = function/.test(uS85) && /ui\.paintMiniBottom = function/.test(uS85));
  check('v85：界线两档样式（州界金 / 郡界灰）', /0xf0d060/.test(uS85) && /0xcfcfc0/.test(uS85));
  check('v85：paintBottom 固定拼装缩略图（不被 _bottom 覆盖）', (function () {
    var fn = codeOf(uS85, 'ui.paintBottom = function');
    return fn.indexOf('open-minimap') >= 0 && fn.indexOf('mini-canvas') >= 0;
  })());
  check('实测：paintBottom 后底部条含缩略图按钮（stub DOM）', (function () {
    G.ui.paintBottom();
    var el = global.document.querySelector('#bottom-bar');
    return !!el && String(el.innerHTML || '').indexOf('open-minimap') >= 0
      && String(el.innerHTML || '').indexOf('mini-canvas') >= 0;
  })());
})();


'''
patch(
    SMOKE,
    "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    SEC70 + "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    'T3 smoke §70',
    probe='70. v85 地图自适应',
)

print()
print('全部完成。')
