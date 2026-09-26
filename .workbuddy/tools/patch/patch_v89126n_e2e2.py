# -*- coding: utf-8 -*-
"""v89.126 补丁 N：e2e 点墙环 —— 前置先跑、再取 wallHit（防 refreshAll 重建 DOM 后引用失效）"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'e2e-test.js')
s = io.open(P, encoding='utf-8').read()

old = """  const wallHit = vc.querySelector('.wall-hit[data-action="open-wall"]');
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
  click(wallHit);"""
new = """  /* v89.126：城墙占格 —— 点墙环 = 打开**通用建筑/建造面板**。
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
  click(wallHit);"""
assert s.count(old) == 1, '锚点计数 %d' % s.count(old)
s = s.replace(old, new)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ e2e 补丁 N 完成')
