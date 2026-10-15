# -*- coding: utf-8 -*-
"""v90.94：e2e 补一条「练功条在面板最下方 + 真点一步」真 DOM 用例（清单第 6 条）。
   插在 v89.177 段「突破考验」那条之后（同一 IIFE 内）。"""
import io
import os
import shutil

P = r'E:\Deepseekdb\e2e-test.js'
BK = r'E:\Deepseekdb\.workbuddy\backup\v90.94-lordbreak\e2e-test.js.preLordE2E'

OLD = """    return txt.indexOf('突破考验') >= 0 && txt.indexOf('宝物（珠宝）') >= 0;
  })());
})();
"""

NEW = """    return txt.indexOf('突破考验') >= 0 && txt.indexOf('宝物（珠宝）') >= 0;
  })());
  check('v90.94 君主面板「练功」条在面板最下方（真 DOM · 真点一步 · 体力与净水双降）', (function () {
    /* 老板「给君主界面的最下方加一条练功菜单」+「去除练功与君主突破之间的关联」：
       ① 位置自证：练功条必须出现在「突破考验」**之后**（面板最下方）
       ② 真点一步：体力与净水必须**都严格下降**（防平凡解：0===0 不算过） */
    if (!G.lordGeneralOf || !G.lordGeneralOf()) return 'SKIP-无条件';
    const g = G.lordGeneralOf();
    const city = (G.currentCity && G.currentCity()) || G.state.cities[0];
    if (!city) return false;
    const bak = { sta: G.staNow(g), grain: (city.res || {}).grain };
    try {
      G.ui.closeAllModals();
      G.ui.openLordInfo();
      const root = document.querySelector('#modal-root');
      const txt = root.textContent || '';
      const btn = root.querySelector('[data-action="lord-train"]');
      if (!btn) return false;
      const iTrain = txt.indexOf('练功');
      const iTrial = txt.indexOf('突破考验');
      if (!(iTrain >= 0 && iTrial >= 0 && iTrain > iTrial)) return false;
      /* 造局：体力与净水给足，确保「练得成」（否则测的是"体力不足"分支） */
      G.setStaNow(g, 999);
      city.res = city.res || {};
      city.res.grain = 999999;
      const sta0 = G.staNow(g), grain0 = city.res.grain;
      btn.click();
      const sta1 = G.staNow(g), grain1 = city.res.grain;
      return sta1 < sta0 && grain1 < grain0;
    } catch (e) { return false; }
    finally {
      G.ui.closeAllModals();
      G.setStaNow(g, bak.sta);
      if (city.res) city.res.grain = bak.grain;
    }
  })());
})();
"""

s = io.open(P, encoding='utf-8', newline='').read()
n0 = len(s)
c = s.count(OLD)
assert c == 1, '锚点计数 %d（应 1）' % c
s = s.replace(OLD, NEW, 1)
assert s.count('v90.94 君主面板「练功」条在面板最下方') == 1

if not os.path.exists(BK):
    shutil.copy2(P, BK)
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('[OK] e2e-test.js %d -> %d 字符' % (n0, len(s)))
