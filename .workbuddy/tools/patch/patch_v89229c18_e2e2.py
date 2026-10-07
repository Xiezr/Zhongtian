# -*- coding: utf-8 -*-
"""v89.229c18：e2e 尾批（标题两处 / §163 时长口径 / §211e② 缩进）"""
import io, os, sys

ROOT = r'E:\Deepseekdb'
E = os.path.join(ROOT, 'e2e-test.js')


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


LOG = []


def rep(tag, old, new, cnt=1):
    s = rd(E)
    if new in s:
        LOG.append('[skip] ' + tag); return True
    c = s.count(old)
    if c != cnt:
        LOG.append('[FAIL] ' + tag + ' count=' + str(c) + '/' + str(cnt)); return False
    wr(E, s.replace(old, new)); LOG.append('[ok]   ' + tag); return True


rep('F1 标题计数（v80 段）',
    "      && (tm24.match(/兵营招募/g) || []).length === 1);",
    "      && (tm24.match(/兵种整备/g) || []).length === 1);")

rep('F2 标题（点击后打开的是该训练营的面板）',
    """    check('点击后打开的是该训练营的募兵面板',
      G.ui._trainBIdx === junI24
      && document.querySelector('#modal-root').innerHTML.indexOf('兵营招募') >= 0);""",
    """    check('点击后打开的是该训练营的募兵面板',
      G.ui._trainBIdx === junI24
      && document.querySelector('#modal-root').innerHTML.indexOf('兵种整备') >= 0);""")

rep('F3 §163 时长口径（常备兵 ≤60 / 机车 ≤300 · cat 退役）',
    """    const over163 = [];
    Object.keys(G.DATA.TROOPS).forEach((k) => {
      const t = G.DATA.TROOPS[k];
      if (t.cat === 'inf' && t.time > 60) over163.push(t.name + '=' + t.time);
      if (t.cat === 'cav' && t.time > 300) over163.push(t.name + '=' + t.time);
    });
    check('v89.163 征兵时长：步兵 ≤1 分 / 机车 ≤5 分（单兵耗时 · 游戏秒）', over163.length === 0,""",
    """    const over163 = [];
    Object.keys(G.DATA.TROOPS).forEach((k) => {
      const t = G.DATA.TROOPS[k];
      /* v89.229（兵种重构）**规则变更**：cat 退役 → 口径改为"常备兵 ≤60 / 机车 ≤300"，
         器械（craft · 制造品）不属征兵范畴（自行火炮 5830 / 无人轰炸机 2910 本就超线）。 */
      if (t.craft) return;
      if (!t.ride && t.time > 60) over163.push(t.name + '=' + t.time);
      if (t.ride && t.time > 300) over163.push(t.name + '=' + t.time);
    });
    check('v89.229 征兵时长：常备兵 ≤1 分 / 机车 ≤5 分（单兵耗时 · 游戏秒 · 器械豁免）', over163.length === 0,""")

rep('F4 §211e② 标题（缩进 6 空格）',
    "    check('§211e② 自行火炮卡可选（无灰）', !!card211 && !card211.classList.contains('disabled'));",
    "    check('§229c-e② 自行火炮卡可选（无灰）', !!card211 && !card211.classList.contains('disabled'));")

for tag in ['兵营招募', "t.cat === 'inf'", "t.cat === 'cav'"]:
    LOG.append('残留 %-18s = %d' % (tag, rd(E).count(tag)))

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c18_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
