# -*- coding: utf-8 -*-
"""v89.126 补丁 M：e2e 城墙断言升级
① 点墙环：摆前置（有城墙格→面板 / 无则腾一格空地把建造菜单走出来）
② 自动升级城墙：摆城墙格 Lv1 + 抬其它建筑（cells 快照还原）
"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'e2e-test.js')
s = io.open(P, encoding='utf-8').read()

# ① 点墙环
old1 = """  const wallHit = vc.querySelector('.wall-hit[data-action="open-wall"]');
  click(wallHit);
  await sleep(90);
  check('点墙环打开城墙面板（需求 1）',
    document.querySelector('#modal-root').innerHTML.indexOf('城墙') >= 0);
  G.ui.closeAllModals();
  await sleep(40);"""
new1 = """  const wallHit = vc.querySelector('.wall-hit[data-action="open-wall"]');
  /* v89.126：城墙占格 —— 点墙环 = 打开**通用建筑/建造面板**。
     摆前置：已有城墙格 → 走建筑面板；没有则腾出一格空地（走建造菜单，「城墙」在册）。 */
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
  click(wallHit);
  await sleep(90);
  check('点墙环打开建造/城墙面板（需求 1 · v89.126 并入通用面板）',
    document.querySelector('#modal-root').innerHTML.indexOf('城墙') >= 0);
  G.ui.closeAllModals();
  await sleep(40);
  if (wallRemoved64) {
    G.currentCity().cells[wallRemoved64.i] = wallRemoved64.save;
    G.refreshAll();
  }"""
assert s.count(old1) == 1, '锚点①计数 %d' % s.count(old1)
s = s.replace(old1, new1)

# ② 自动升级城墙
old2 = """  (function () {
    const c64 = G.currentCity();
    const keepWall = c64.wallLv, keepAuto = G.state.settings.autoUpgrade, keepQ = G.state.queues.build.slice();
    c64.wallLv = 0;
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { c64.res[k] = 5000000; });
    G.state.settings.autoUpgrade = true;
    G.state.queues.build.length = 0;
    const r64 = G.autoUpgrade();
    const qb64 = G.ui.queueBody ? G.ui.queueBody() : '';
    check('自动升级把城墙纳入候选（0 级城墙第一个被选中）',
      !!(r64 && r64.target && r64.target.kind === 'wall' && r64.target.lv === 0),
      r64 && r64.target ? (r64.target.name + ' Lv' + r64.target.lv) : '无动作');
    check('城墙排进建造队列（type=wall）且"在办事项"里能看到',
      G.state.queues.build.some((q) => q.type === 'wall' && q.cityId === c64.id)
      && qb64.indexOf('城墙') >= 0);
    /* 还原 */
    G.state.queues.build.length = 0; keepQ.forEach((q) => G.state.queues.build.push(q));
    c64.wallLv = keepWall; G.state.settings.autoUpgrade = keepAuto;
    G.refreshAll();
  })();"""
new2 = """  (function () {
    const c64 = G.currentCity();
    const keepAuto = G.state.settings.autoUpgrade, keepQ = G.state.queues.build.slice();
    const keepCells64 = JSON.parse(JSON.stringify(c64.cells));
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
    if (idxW64 >= 0) c64.cells[idxW64].build = { id: 'chengqiang', lvl: 1 };
    ['grain', 'wood', 'stone', 'iron'].forEach((k) => { c64.res[k] = 5000000; });
    G.state.settings.autoUpgrade = true;
    G.state.queues.build.length = 0;
    const r64 = G.autoUpgrade();
    const qb64 = G.ui.queueBody ? G.ui.queueBody() : '';
    check('自动升级把城墙纳入候选（城墙格 Lv1 最低时被选中）',
      !!(r64 && r64.target && r64.target.kind === 'city') && idxW64 >= 0
      && c64.cells[r64.target.idx] && c64.cells[r64.target.idx].build
      && c64.cells[r64.target.idx].build.id === 'chengqiang',
      r64 && r64.target ? (r64.target.name + ' Lv' + r64.target.lv) : '无动作');
    check('城墙排进建造队列（buildId=chengqiang）且"在办事项"里能看到',
      G.state.queues.build.some((q) => q.buildId === 'chengqiang' && q.cityId === c64.id)
      && qb64.indexOf('城墙') >= 0);
    /* 还原 */
    G.state.queues.build.length = 0; keepQ.forEach((q) => G.state.queues.build.push(q));
    c64.cells = keepCells64;
    G.state.settings.autoUpgrade = keepAuto;
    G.refreshAll();
  })();"""
assert s.count(old2) == 1, '锚点②计数 %d' % s.count(old2)
s = s.replace(old2, new2)

tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ e2e 补丁 M 完成（2 条断言升级）')
