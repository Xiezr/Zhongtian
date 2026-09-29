# -*- coding: utf-8 -*-
"""v89.165d：e2e 插入 §165（指挥战斗清单 live 的真 DOM 验证）。
   运行：python .workbuddy/tools/patch/patch_v89165d_e2e.py"""
import io

R = 'E:/Deepseekdb/'
p = R + 'e2e-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

if 'v89.165 liveModalTick 后读秒跳到 36%' in s:
    print('  [skip] §165 e2e 已插')
    raise SystemExit(0)

ANCHOR = "  return finish();\n}"
assert s.count(ANCHOR) == 1, '锚点计数=%d' % s.count(ANCHOR)

NEW = '''  /* ============================================================
   * v89.165（老板）：「指挥战斗界面的行军读秒和进度条不动」—— live 接入的真 DOM 验证
   * 【场景直接复现】打开清单 → 推进 elapsed → 走真链 liveModalTick → DOM 读秒必须变
   * ============================================================ */
  console.log('\\n--- §165. 实时读秒（指挥战斗清单 · live 每秒重开） ---');
  await (async function () {
    const st = G.state;
    G.ui.closeAllModals();
    await sleep(40);
    const bkMarches = st.marches.slice(), bkBattles = st.battles.slice();
    let gen0 = null, bkG = null;                     /* ⚠️ 前置变量放外层（§55.3：finally 要还原） */
    try {
      const c0 = G.currentCity();
      gen0 = st.generals.filter((g) => g.status !== 'march')[0] || st.generals[0];
      bkG = { status: gen0.status, cityId: gen0.cityId };
      gen0.status = 'march'; gen0.cityId = c0.id;    /* 造局三件套（§77.1）：大 totalTime + 真将领 */
      const m = { id: 'M165e', cityId: c0.id, genId: gen0.id, modeId: 'raid',
        target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: 'A165', kind: 'wild',
        army: { yibing: 100 }, elapsed: 96000, totalTime: 600000, scheme: null, ops: 'assault', cargo: null };
      st.marches.push(m);
      st.battles.length = 0;

      G.ui.openBattleList();
      await sleep(80);
      const read165 = () => {
        const el = document.querySelector('#modal-root .war-list');
        return el ? (el.textContent || '') : '';
      };
      check('v89.165 指挥战斗清单已打开（.war-list 在）', !!document.querySelector('#modal-root .war-list'));
      check('v89.165 首屏含 16% 读秒（渲染就绪）', read165().indexOf('16%') >= 0, read165().slice(0, 70));

      m.elapsed += 120000;                           /* 推进 120000 游戏秒 = 20% */
      G.ui.liveModalTick();                          /* 真链路：主循环每秒调的就是它 */
      await sleep(50);
      const t2 = read165();
      check('v89.165 ★ liveModalTick 后读秒跳到 36%（真实 DOM 更新 · 老板报的场景）',
        t2.indexOf('36%') >= 0 && t2.indexOf('16%') < 0,
        (t2.slice(0, 70) || '(空)').replace(/\\s+/g, ' '));
      check('v89.165 live 重绘不误压栈（层级栈长度不增）',
        (G.ui._modalStack || []).length === 0,
        'stack=' + ((G.ui._modalStack || []).length));
    } finally {
      st.marches.length = 0; bkMarches.forEach((x) => st.marches.push(x));
      st.battles.length = 0; bkBattles.forEach((x) => st.battles.push(x));
      if (gen0 && bkG) { gen0.status = bkG.status; gen0.cityId = bkG.cityId; }
      G.ui.closeAllModals();
      await sleep(40);
    }
    check('v89.165 收尾：关闭后无残留弹窗', !document.querySelector('#modal-root .inner-panel'));
  })();

'''

s = s.replace(ANCHOR, NEW + ANCHOR)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  [ ok ] e2e §165 已插 · 新长度', len(s))
