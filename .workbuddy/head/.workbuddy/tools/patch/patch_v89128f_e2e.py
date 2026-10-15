# -*- coding: utf-8 -*-
"""v89.128 补丁 F：e2e 城墙断言升级（环城视觉=建筑外观 / 环城槽面板 / 自动升级）
   ⚠ newline='' 保持 LF
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    assert s.count(old) == 1, '%s 锚点 %d 个' % (tag, s.count(old))
    s = s.replace(old, new)
    n += 1
    print('  ✓ ' + tag)


# ── ① 前段三连（未建不画 + 摆上验结构）──
rep("""  check('城墙为环形 SVG 且四角有角楼',
    !!vc.querySelector('svg.iso-wall')
    && vc.querySelectorAll('svg.iso-wall polygon').length >= 3
    && vc.querySelectorAll('svg.iso-wall .wtower').length === 4);""",
    """  /* v89.128：环城视觉 = **城墙建筑的外观**（修了才画）—— 先验"未建不画"，再摆上验结构 */
  check('未修建城墙时不画环（v89.128：环城是城墙建筑的外观）', !vc.querySelector('svg.iso-wall'));
  G.wallSlotOf(G.currentCity()).build = { id: 'chengqiang', lvl: 1 };
  G.refreshAll();
  await sleep(90);
  check('城墙为环形 SVG 且四角有角楼',
    !!vc.querySelector('svg.iso-wall')
    && vc.querySelectorAll('svg.iso-wall polygon').length >= 3
    && vc.querySelectorAll('svg.iso-wall .wtower').length === 4);""",
    '① 前段三连')

# ── ② v25 段：摆上再验角楼 ──
rep("""  /* ① 城墙：点墙环打开城墙面板 */
  G.ui.setView('city');
  await sleep(90);
  check('墙环有角楼（4 座）', vc.querySelectorAll('svg.iso-wall .wtower').length === 4);""",
    """  /* ① 城墙：点墙环打开面板（v89.128：环城视觉是城墙建筑的外观） */
  G.wallSlotOf(G.currentCity()).build = { id: 'chengqiang', lvl: 3 };   /* 摆上（该城未建） */
  G.ui.setView('city');
  await sleep(90);
  check('墙环有角楼（4 座）', vc.querySelectorAll('svg.iso-wall .wtower').length === 4);""",
    '② v25 段角楼')

# ── ③ 点墙环两场景（未建→修建；已建→建筑面板）──
rep("""  /* v89.126：城墙占格 —— 点墙环 = 打开**通用建筑/建造面板**。
     摆前置（先于取引用：refreshAll 会重建 DOM，旧引用会脱离）：已有城墙格 → 走建筑面板；
     没有则腾出一格空地（走建造菜单，「城墙」在册）。 */
  let wallRemoved64 = null;
  (function () {
    const cW = G.currentCity();
    if (G.wallCellIdxOf(cW) >= 0) return;
    let free = -1;
    cW.cells.forEach((x, i) => { if (free < 0 && !x.build && !x.pending && !x.official) free = i; });
    if (free < 0) {
      for (let i = 0; i < cW.cells.length; i++) {
        const x = cW.cells[i];
        if (x.build && !x.official && x.build.id !== 'chengqiang') {
          wallRemoved64 = { i: i, save: Object.assign({}, x) };
          cW.cells[i].build = null; cW.cells[i].pending = null;
          break;
        }
      }
    }
    G.refreshAll();
  })();
  const wallHit = vc.querySelector('.wall-hit[data-action="open-wall"]');
  click(wallHit);
  await sleep(90);
  /* v89.126：点墙环 = 打开通用建筑/建造面板。
     未建城墙 → 建造菜单（「城墙」在册、位于第 2 页）—— 真点「下一页」验证。 */
  const mrWall = document.querySelector('#modal-root');
  let wallTxt = (mrWall.innerHTML || '').replace(/<[^>]+>/g, ' ');
  const openedMenu = wallTxt.indexOf('选择要建造的建筑') >= 0;
  if (openedMenu && wallTxt.indexOf('城墙') < 0) {
    const btnsW = Array.from(mrWall.querySelectorAll('[data-action="mpage"]'))
      .filter((b) => (b.className || '').indexOf('off') < 0);
    if (btnsW.length) { click(btnsW[btnsW.length - 1]); await sleep(90); }
    wallTxt = (mrWall.innerHTML || '').replace(/<[^>]+>/g, ' ');
  }
  check('点墙环打开建造/城墙面板（需求 1 · v89.126 并入通用面板）',
    (openedMenu || wallTxt.indexOf('城墙') >= 0) && wallTxt.indexOf('城墙') >= 0,
    'modal=' + wallTxt.replace(/\\s+/g, ' ').slice(0, 96));
  G.ui.closeAllModals();
  await sleep(40);
  if (wallRemoved64) {
    G.currentCity().cells[wallRemoved64.i] = wallRemoved64.save;
    G.refreshAll();
  }""",
    """  /* v89.128：点墙环 = 打开**环城槽**的面板（未建 → 「修建城墙」；已建 → 通用建筑面板）。
     先用"未建"场景验修建入口，再摆上验升级入口。 */
  G.wallSlotOf(G.currentCity()).build = null;   /* 未建场景 */
  G.refreshAll();
  const wallHit = vc.querySelector('.wall-hit[data-action="open-wall"]');
  click(wallHit);
  await sleep(90);
  const mrWall = document.querySelector('#modal-root');
  let wallTxt = (mrWall.innerHTML || '').replace(/<[^>]+>/g, ' ');
  check('点墙环（未建）→ 打开「修建城墙」面板（修建按钮在册）',
    wallTxt.indexOf('城墙') >= 0 && !!mrWall.querySelector('[data-build="chengqiang"]'),
    'modal=' + wallTxt.replace(/\\s+/g, ' ').slice(0, 96));
  G.ui.closeAllModals();
  await sleep(40);
  /* 已建场景：点墙环 → 通用建筑面板（升级键带 data-idx="wall"） */
  G.wallSlotOf(G.currentCity()).build = { id: 'chengqiang', lvl: 3 };
  G.refreshAll();
  click(vc.querySelector('.wall-hit[data-action="open-wall"]'));
  await sleep(90);
  const mrWall2 = document.querySelector('#modal-root');
  check('点墙环（已建）→ 通用建筑面板（升级键在册 · data-idx="wall"）',
    !!mrWall2.querySelector('[data-action="confirm-upgrade"][data-idx="wall"]'),
    (mrWall2.textContent || '').replace(/\\s+/g, ' ').slice(0, 80));
  G.ui.closeAllModals();
  await sleep(40);""",
    '③ 点墙环两场景')

# ── ④ 自动升级段（槽版本）──
rep("""    const keepCells64 = JSON.parse(JSON.stringify(c64.cells));
    /* v89.126：城墙占格 —— 摆一格 Lv1 城墙（最低），其余建筑抬高（含官府，解"官府总闸"） */
    c64.cells.forEach((x) => {
      if (x.build && !x.official) x.build.lvl = Math.min(5, G.DATA.BUILDINGS[x.build.id].maxLevel);
    });
    c64.cells.forEach((x) => { if (x.official && x.build) x.build.lvl = 12; });
    let idxW64 = -1;
    for (let i = 0; i < c64.cells.length; i++) {
      const x = c64.cells[i];
      if (!x.build && !x.official && !x.pending) { idxW64 = i; break; }
    }
    if (idxW64 >= 0) c64.cells[idxW64].build = { id: 'chengqiang', lvl: 1 };""",
    """    const keepCells64 = JSON.parse(JSON.stringify(c64.cells));
    const keepWall64 = JSON.parse(JSON.stringify(c64.wall));
    /* v89.128：城墙摆进**环城槽** Lv1（最低），其余建筑抬高（含官府，解"官府总闸"） */
    c64.cells.forEach((x) => {
      if (x.build && !x.official) x.build.lvl = Math.min(5, G.DATA.BUILDINGS[x.build.id].maxLevel);
    });
    c64.cells.forEach((x) => { if (x.official && x.build) x.build.lvl = 12; });
    G.wallSlotOf(c64).build = { id: 'chengqiang', lvl: 1 };""",
    '④a 自动升级摆场')

rep("""    check('自动升级把城墙纳入候选（城墙格 Lv1 最低时被选中）',
      !!(r64 && r64.target && r64.target.kind === 'city') && idxW64 >= 0
      && c64.cells[r64.target.idx] && c64.cells[r64.target.idx].build
      && c64.cells[r64.target.idx].build.id === 'chengqiang',
      r64 && r64.target ? (r64.target.name + ' Lv' + r64.target.lv) : '无动作');""",
    """    check('自动升级把城墙纳入候选（城墙槽 Lv1 最低时被选中）',
      !!(r64 && r64.target && r64.target.kind === 'city' && String(r64.target.idx) === 'wall')
      && !!(c64.wall && c64.wall.build && c64.wall.build.id === 'chengqiang'),
      r64 && r64.target ? (r64.target.name + ' Lv' + r64.target.lv) : '无动作');""",
    '④b 自动升级断言')

rep("""    c64.cells = keepCells64;
    G.state.settings.autoUpgrade = keepAuto;""",
    """    c64.cells = keepCells64;
    c64.wall = keepWall64;
    G.state.settings.autoUpgrade = keepAuto;""",
    '④c 自动升级还原')

assert s != orig and n == 6


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(orig), '括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch F(e2e) OK · %d 处（LF 保持）' % n)
