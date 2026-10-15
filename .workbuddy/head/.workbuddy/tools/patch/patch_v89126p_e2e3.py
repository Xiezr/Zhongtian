# -*- coding: utf-8 -*-
"""v89.126 补丁 P：e2e 点墙环断言定稿（打开建造菜单 + 翻页见「城墙」）"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'e2e-test.js')
s = io.open(P, encoding='utf-8').read()
old = """  check('点墙环打开建造/城墙面板（需求 1 · v89.126 并入通用面板）',
    document.querySelector('#modal-root').innerHTML.indexOf('城墙') >= 0,
    'DBG wallCell=' + (G.wallCellIdxOf(G.currentCity()) >= 0)
      + ' toasts=' + Array.from(document.querySelectorAll('#toast .toast-line')).map((x) => x.textContent).join('|').slice(0, 60)
      + ' modal=' + (document.querySelector('#modal-root').innerHTML || '').replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').slice(0, 90));"""
new = """  /* v89.126：点墙环 = 打开通用建筑/建造面板。
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
    'modal=' + wallTxt.replace(/\\s+/g, ' ').slice(0, 96));"""
assert s.count(old) == 1, '锚点计数 %d' % s.count(old)
s = s.replace(old, new)
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ e2e 补丁 P 完成（点墙环定稿断言）')
