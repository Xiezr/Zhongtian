# -*- coding: utf-8 -*-
"""v89.88：e2e 增量 —— §91 大地图悬浮浮层（真实 DOM）。
插入点：主流程末尾（setView('city') 收尾之前）。
"""
import io

P = r'E:\Deepseekdb\e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

anchor = """  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""
assert s.count(anchor) == 1, ('anchor', s.count(anchor))

block = """  /* ============================================================
   * 91. v89.88（老板需求 4~5）：大地图悬浮浮层 —— 「坐标 + 等级」
   * ------------------------------------------------------------
   * 真实 DOM：断言画布事件接线、浮层内容、同格节流、移出收起。
   * ============================================================ */
  console.log('\\n--- 91. v89.88 地图悬浮（坐标 + 等级）---');
  {
    G.ui.setView('map');
    await sleep(90);
    const cv91 = document.querySelector('#mapCanvas');
    check('v89.88（悬浮）：大地图画布在场', !!cv91);
    if (cv91) {
      const v = G.map._view;
      const pc91 = G.map.playerCity();
      const oldRect = cv91.getBoundingClientRect;
      cv91.getBoundingClientRect = function () {
        return { left: 0, top: 0, width: cv91.width, height: cv91.height };
      };
      const mov = (x, y) => cv91.dispatchEvent(new window.MouseEvent('mousemove',
        { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));

      /* ① 悬停主城格：浮层出现（己方 + 坐标 + 城等级） */
      const sx91 = v.ox + (pc91.x - pc91.y) * v.HW, sy91 = v.oy + (pc91.x + pc91.y) * v.HH;
      mov(sx91, sy91);
      await sleep(40);
      const tipEl = document.querySelector('#tip-layer');
      const th1 = tipEl ? tipEl.innerHTML : '';
      check('v89.88（悬浮）：主城格浮层（己方 · 坐标 · 城等级）',
        !!tipEl && tipEl.classList.contains('on')
          && th1.indexOf('己方') >= 0 && th1.indexOf('(' + pc91.x + ', ' + pc91.y + ')') >= 0
          && th1.indexOf('Lv' + G.cityLvOf(pc91)) >= 0,
        th1.replace(/<[^>]*>/g, ' ').trim().slice(0, 80));

      /* ② 同格节流：同一格内连续移动只渲染一次（浮层不追鼠标抖） */
      let tipCalls = 0;
      const origTipShow = G.ui.tipShow;
      G.ui.tipShow = function () { tipCalls++; return origTipShow.apply(this, arguments); };
      mov(sx91 + 2, sy91 + 1);
      mov(sx91 + 4, sy91 + 2);
      G.ui.tipShow = origTipShow;
      check('v89.88（悬浮）：同格节流（两次同格移动只渲染 1 次）', tipCalls === 1, 'tipShow ×' + tipCalls);

      /* ③ 悬停空野地格：浮层含野地等级（走 wildLevelNow 唯一出口） */
      let wt91 = null;
      for (let r = 1; r <= 4 && !wt91; r++) {
        for (let dy = -r; dy <= r && !wt91; dy++) {
          for (let dx = -r; dx <= r && !wt91; dx++) {
            const x = pc91.x + dx, y = pc91.y + dy;
            if (x < 0 || y < 0 || x >= G.DATA.MAP_W || y >= G.DATA.MAP_H) continue;
            if (G.map.npcAt(x, y) || G.map.ownCityAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
            wt91 = { x: x, y: y };
          }
        }
      }
      if (wt91) {
        mov(v.ox + (wt91.x - wt91.y) * v.HW, v.oy + (wt91.x + wt91.y) * v.HH);
        await sleep(40);
        const th2 = tipEl ? tipEl.innerHTML : '';
        check('v89.88（悬浮）：野地格浮层（野地等级 · 坐标）',
          th2.indexOf('野地') >= 0 && th2.indexOf('Lv' + G.map.wildLevelNow(wt91.x, wt91.y)) >= 0
            && th2.indexOf('(' + wt91.x + ', ' + wt91.y + ')') >= 0,
          th2.replace(/<[^>]*>/g, ' ').trim().slice(0, 80));
      } else {
        check('v89.88（悬浮）：野地格浮层（野地等级 · 坐标）', false, '主城周边未找到空野地格');
      }

      /* ④ 移出画布：浮层立即收起 */
      cv91.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true, cancelable: true, view: window }));
      await sleep(20);
      check('v89.88（悬浮）：移出画布即收起', !(tipEl && tipEl.classList.contains('on')));

      cv91.getBoundingClientRect = oldRect;
    } else {
      check('v89.88（悬浮）：主城格浮层（己方 · 坐标 · 城等级）', false, '画布缺失');
      check('v89.88（悬浮）：同格节流（两次同格移动只渲染 1 次）', false, '画布缺失');
      check('v89.88（悬浮）：野地格浮层（野地等级 · 坐标）', false, '画布缺失');
      check('v89.88（悬浮）：移出画布即收起', false, '画布缺失');
    }
  }

  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

s = s.replace(anchor, block, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK e2e §91')
