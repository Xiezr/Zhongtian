# -*- coding: utf-8 -*-
"""v89.224b4：e2e 实验室段改写（入口迁建筑格 + 立项制）。"""
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()
def wr(p, s):
    if DRY: return
    tmp = BASE + p + '.tmp224b4'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + p)

F = 'e2e-test.js'

old_hdr = '   * v73（老板五条）：基因实验室 / 建筑弹窗底栏 —— 真实 DOM 走一遍'
new_hdr = ('   * v73（老板五条）：基因实验室 / 建筑弹窗底栏 —— 真实 DOM 走一遍\n'
           '   * v89.224（老板 1/2）：实验室迁入「基因实验室」建筑格 + 去播种化 —— 本节重写')
s = rd(F)
assert s.count(old_hdr) == 1
s = s.replace(old_hdr, new_hdr)
wr(F, s)

old_check = ("  check('v89.135：政务厅要务三键齐（改名 / 主城 / 遗迹）· 无在办事项',\n"
             "    gm24.indexOf('在办事项') < 0 && gm24.indexOf('open-rename-city') >= 0\n"
             "    && gm24.indexOf('open-farm') >= 0);")
new_check = ("  check('v89.135 / v89.224：政务厅要务两键（改名 / 主城）· 实验室已迁建筑格',\n"
             "    gm24.indexOf('在办事项') < 0 && gm24.indexOf('open-rename-city') >= 0\n"
             "    && gm24.indexOf('open-farm') < 0 && gm24.indexOf('open-lab') < 0);")
s = rd(F)
assert s.count(old_check) == 1
s = s.replace(old_check, new_check)
wr(F, s)

start = "  console.log('\\n--- v73. 基因实验室 · 建筑弹窗底栏（真实 DOM） ---');"
end = "    /* 建筑弹窗：无顶图 + 取消升级/关闭同在吸底底栏 */"
s = rd(F)
i = s.find(start); j = s.find(end, i + 1)
assert i >= 0 and j > i and 'seed_fan' in s[i:j]

new_block = '''  console.log('\\n--- v73. 基因实验室（建筑格入口 · 立项制）· 建筑弹窗底栏（真实 DOM） ---');
  {
    G.state.res.gold = 3000000;
    /* v89.224：实验室入口在城内「基因实验室」（honglusi）建筑格 —— 临时放一座再点 */
    const pc73 = G.currentCity();
    let labCell = null, labSaved = null;
    (pc73.cells || []).forEach(function (c) { if (!labCell && !c.build) labCell = c; });
    if (labCell) { labSaved = labCell.build; labCell.build = { id: 'honglusi', lvl: 1 }; }
    check('v89.224：找到临时实验室格（找格成功）', !!labCell);
    if (labCell) {
      G.ui.openBuildModal(pc73.cells.indexOf(labCell));
      await sleep(140);
      let mh73 = document.querySelector('#modal-root').innerHTML;
      check('v73/v89.224：基因实验室建筑格面板有「🧬 基因实验室」入口',
        mh73.indexOf('data-action="open-lab"') >= 0 && mh73.indexOf('基因实验室') >= 0);
      const farmBtn73 = document.querySelector('#modal-root [data-action="open-lab"]');
      if (farmBtn73) {
        click(farmBtn73);
        await sleep(140);
        mh73 = document.querySelector('#modal-root').innerHTML;
        check('v89.224：面板六座培养舱 + 立项入口（播种已退役）',
          (mh73.match(/class="farm-cell/g) || []).length >= 6 && mh73.indexOf('data-action="farm-projects"') >= 0
          && mh73.indexOf('播种') < 0);
        click(document.querySelector('#modal-root [data-action="farm-projects"]'));
        await sleep(130);
        mh73 = document.querySelector('#modal-root').innerHTML;
        check('v89.224：立项弹窗列出 10 个项目（6 材料 + 4 基因调试）· 无种子消耗',
          (mh73.match(/data-action="farm-start"/g) || []).length === 10 && mh73.indexOf('菌种') < 0);
        const plantBtn73 = Array.from(document.querySelectorAll('#modal-root [data-action="farm-start"]'))
          .find((b) => b.getAttribute('data-crop') === 'tieying');
        if (plantBtn73) {
          click(plantBtn73);
          await sleep(170);
          mh73 = document.querySelector('#modal-root').innerHTML;
          check('v89.224：立项后留在实验室（研发中 + 倒计时元素在位）',
            mh73.indexOf('完成还需') >= 0 && !!document.querySelector('#modal-root [data-farm-left]'));
          G.tickFarm(8 * 3600);
          G.ui.openFarm();
          await sleep(130);
          const hv73 = document.querySelector('#modal-root [data-action="farm-extract"]');
          check('v89.224：完成舱出现「提取」按钮', !!hv73);
          if (hv73) {
            const beforeBintie = G.state.items['bintie'] || 0;
            click(hv73);
            await sleep(170);
            check('v89.224：提取入包（钢锭）', (G.state.items['bintie'] || 0) > beforeBintie,
              '钢锭 ×' + (G.state.items['bintie'] || 0));
          }
        }
        G.ui.closeAllModals();
        await sleep(80);
      }
    }
    if (labCell) labCell.build = labSaved;

'''
wr(F, s[:i] + new_block + s[j:])
print('[b4] e2e 段改写完成 %s' % ('(DRY)' if DRY else '✓'))
