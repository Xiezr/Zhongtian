# -*- coding: utf-8 -*-
"""v89.87：e2e §90 战场界面（真实 DOM：挂起→界面→指令→完成→自动→战果）"""
import io

P = r'E:\Deepseekdb\e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

anchor = """  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""
assert s.count(anchor) == 1, ('anchor', s.count(anchor))

SEC = """  console.log('\\n--- v89.87. 战场界面（真实 DOM：挂起→界面→指令→完成→自动→战果） ---');
  {
    const s90 = G.state;
    const c90 = s90.cities[0];
    s90.settings.battleWatch = true;          /* 本段单独开观战 */
    const g90 = s90.generals[0];
    g90.status = 'idle'; g90.cityId = c90.id;
    G.setStaNow(g90, 1000); g90.energy = 100;
    c90.army = { changqiang: 400 };
    let wt90 = null;
    for (let dy = -9; dy <= 9 && !wt90; dy++) for (let dx = -9; dx <= 9 && !wt90; dx++) {
      const tl = G.map.tile(c90.x + dx, c90.y + dy);
      if (tl && tl.terrain !== 'city' && !G.map.wildAt(c90.x + dx, c90.y + dy)
          && !G.map.fortAt(c90.x + dx, c90.y + dy)) wt90 = { x: c90.x + dx, y: c90.y + dy };
    }
    check('v89.87（战场）：找到野地', !!wt90);
    if (wt90) {
      s90.marches = [];
      const d90 = G.march.dispatch({ kind: 'wild', x: wt90.x, y: wt90.y }, 'raid',
        { changqiang: 200 }, g90.id);
      check('v89.87（战场）：出征入队（行军通道）', d90.ok === true, d90.msg);
      const m90 = s90.marches[0];
      if (m90) { m90.elapsed = m90.totalTime; G.march.tick(); }
      await sleep(180);
      check('v89.87（战场）：抵达挂起（不再即时结算）',
        s90.battles.length === 1 && s90.battles[0].state === 'live',
        'battles=' + s90.battles.length);
      check('v89.87（战场）：界面自动打开（#bt-field + 我方单位卡）',
        !!document.querySelector('#modal-root #bt-field')
        && !!document.querySelector('#modal-root .bt-unit.atk'));
      check('v89.87（战场）：标题与倒计时在（bt-cd）',
        !!document.querySelector('#modal-root #bt-cd'));
      const stBtn = document.querySelector('#modal-root [data-action="bt-stance"][data-s="hold"]');
      check('v89.87（战场）：逐兵种指令按钮存在', !!stBtn);
      if (stBtn) { click(stBtn); await sleep(60); }
      const tgtSel = document.querySelector('#modal-root #bt-t-changqiang');
      check('v89.87（战场）：目标下拉在册（bt-t-*）', !!tgtSel);
      const doneBtn = document.querySelector('#modal-root [data-action="bt-done"]');
      check('v89.87（战场）：完成回合按钮存在', !!doneBtn);
      if (doneBtn) { click(doneBtn); await sleep(220); }
      const rdEl = document.querySelector('#bt-round');
      check('v89.87（战场）：完成回合 → 回合推进（≥1）',
        !!rdEl && Number(rdEl.textContent) >= 1, rdEl ? rdEl.textContent : '无');
      const autoBtn = document.querySelector('#modal-root [data-action="bt-auto"]');
      check('v89.87（战场）：自动战斗按钮存在', !!autoBtn);
      if (autoBtn) { click(autoBtn); await sleep(300); }
      check('v89.87（战场）：自动 → 挂起清空（落账完成）', s90.battles.length === 0,
        'battles=' + s90.battles.length);
      check('v89.87（战场）：战果面板出现',
        document.querySelector('#modal-root').innerHTML.indexOf('战果') >= 0);
      check('v89.87（战场）：将领归来（idle）', g90.status === 'idle', String(g90.status));
      G.ui.closeModal();
      await sleep(40);
    }
    s90.settings.battleWatch = false;
  }

  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

s = s.replace(anchor, SEC, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK e2e §90 段（%d 条 check）' % SEC.count('check('))
