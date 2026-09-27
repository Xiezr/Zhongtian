# -*- coding: utf-8 -*-
"""v89.162 补丁 E：e2e 城主段加两条（黄金分解出现「城主内政」+ 与结算对齐）"""
import io

R = 'E:/Deepseekdb/'
p = 'e2e-test.js'
s = io.open(R + p, 'r', encoding='utf-8', newline='').read()
if 'v89.162 城主在任' in s:
    print('skip：e2e 已插')
    raise SystemExit(0)

OLD = """    check('不同城市取到的是各自的城主', G.mayorBonus(b63).name === '副城城主'
      && (G.mayorBonus(a63).name || '') !== '副城城主');
    G.state.cities.pop();
    G.state.generals.pop();
  })();"""

NEW = """    check('不同城市取到的是各自的城主', G.mayorBonus(b63).name === '副城城主'
      && (G.mayorBonus(a63).name || '') !== '副城城主');
    /* v89.162（老板 2）：城主内政 → 税收 —— 黄金分解出现「城主内政」行 + 与结算同源 */
    g63.nz = 100;
    const bd162 = G.prodBreakdown('gold', b63);
    check('v89.162 城主在任 → 黄金分解出现「城主内政」行', bd162.some((x) => x.name === '城主内政'),
      bd162.map((x) => x.name).join('|'));
    check('v89.162 黄金分解与结算对齐（单城 · 含城主税加成）', (function () {
      const s162 = bd162.reduce((a, x) => a + x.val, 0);
      const sal162 = bd162.filter((x) => x.name.indexOf('爵位俸禄') === 0)
        .reduce((a, x) => a + x.val, 0);
      const p162 = G.cityProdPerSec(b63).gold;
      return Math.abs(s162 - (p162 + sal162)) <= Math.max(1e-9, Math.abs(s162) * 1e-9);
    })());
    G.state.cities.pop();
    G.state.generals.pop();
  })();"""

assert s.count(OLD) == 1, '锚点数=%d' % s.count(OLD)
s = s.replace(OLD, NEW)
io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
print('e2e 已插两条 · 新长度', len(s))
