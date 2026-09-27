# -*- coding: utf-8 -*-
"""v89.163 补丁 C：e2e 加 v89.163 用例（清单含行军 + 召回宿主跟走 + 时长数据）"""
import io

R = 'E:/Deepseekdb/'
p = 'e2e-test.js'
s = io.open(R + p, 'r', encoding='utf-8', newline='').read()
if 'v89.163 指挥战斗清单出现' in s:
    print('skip：已插')
    raise SystemExit(0)

ANCHOR = """  return finish();
}"""

NEW = """  /* ============================================================
   * v89.163（老板 1+2）：指挥战斗清单含「行军中的军队」（召回宿主跟走）·
   *   征兵时长压缩（步兵 ≤1 分 / 骑兵 ≤5 分 · 单兵耗时）
   * ============================================================ */
  console.log('\\n--- §163. 指挥战斗含行军 / 征兵时长压缩（v89.163 · 真实 DOM） ---');
  await (async function () {
    /* ① 数据：步兵 ≤60 / 骑兵 ≤300（游戏秒 · 单兵耗时） */
    const over163 = [];
    Object.keys(G.DATA.TROOPS).forEach((k) => {
      const t = G.DATA.TROOPS[k];
      if (t.cat === 'inf' && t.time > 60) over163.push(t.name + '=' + t.time);
      if (t.cat === 'cav' && t.time > 300) over163.push(t.name + '=' + t.time);
    });
    check('v89.163 征兵时长：步兵 ≤1 分 / 骑兵 ≤5 分（单兵耗时 · 游戏秒）', over163.length === 0,
      over163.join('/') || ('义兵 ' + G.DATA.TROOPS.yibing.time + ' · 弓箭手 ' + G.DATA.TROOPS.gongjian.time
        + ' · 象兵 ' + G.DATA.TROOPS.nanjiangxiangbing.time));

    /* ② 清单两段 + 召回宿主跟走（真 DOM · 真点击） */
    const c163 = G.currentCity();
    const keepM163 = G.state.marches;
    G.state.marches = [{
      id: 'e2e163m', cityId: c163.id, genId: '', modeId: 'raid',
      target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: '荒野·163', kind: 'wild',
      army: { yibing: 10 }, elapsed: 10, totalTime: 100, scheme: null, ops: 'assault', cargo: null,
    }];
    G.ui.openBattleList();
    await sleep(60);
    const mr163 = document.querySelector('#modal-root');
    const btn163 = mr163 ? mr163.querySelector('[data-action="march-recall"]') : null;
    check('v89.163 指挥战斗清单出现「行军中的军队」区块 + 召回按钮',
      !!(mr163 && mr163.textContent.indexOf('行军中的军队') >= 0 && btn163
        && mr163.textContent.indexOf('荒野·163') >= 0),
      mr163 ? mr163.textContent.replace(/\\s+/g, ' ').slice(0, 70) : '无弹窗');
    if (btn163) {
      btn163.click();
      await sleep(80);
      const mr2 = document.querySelector('#modal-root');
      const gone = G.state.marches.length === 0;
      const stillWar = !!(mr2 && mr2.querySelector('.war-list'));
      const notMarchesPane = !(mr2 && mr2.textContent.indexOf('行军队列（') >= 0);
      const emptyTip = !!(mr2 && mr2.textContent.indexOf('当前没有行军中军队') >= 0);
      check('v89.163 清单内召回：兵力归城 + 原地重绘（不跳行军队列弹窗 · 不留幽灵行）',
        gone && stillWar && notMarchesPane && emptyTip,
        'gone=' + gone + ' stillWar=' + stillWar + ' emptyTip=' + emptyTip);
    } else {
      check('v89.163 清单内召回：兵力归城 + 原地重绘', false, '未找到召回按钮');
    }
    G.state.marches = keepM163;
    G.ui.closeAllModals();
  })();

  return finish();
}"""

assert s.count(ANCHOR) == 1, '锚点数=%d' % s.count(ANCHOR)
s = s.replace(ANCHOR, NEW)
io.open(R + p, 'w', encoding='utf-8', newline='').write(s)
print('e2e §163 已插 · 新长度', len(s))
