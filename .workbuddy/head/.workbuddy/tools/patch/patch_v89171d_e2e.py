# -*- coding: utf-8 -*-
"""v89.171 补丁 D（e2e）：
  ① 选择窗卡面判据升级（+面额 → 最多至 LvN）
  ② 新增 §171 真实 DOM 三段态（Lv1 有卡·可用 / Lv60 全到线·变暗·无按钮 / 点到线档位 toast）"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, old, new, guard):
    s = rd('e2e-test.js')
    if guard in s:
        print('  [skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, '锚点失配 %s count=%d' % (tag, c)
    wr('e2e-test.js', s.replace(old, new))
    print('  [ ok ] ' + tag)

# E1. 卡面判据（+面额 → 最多至 LvN）
rep('E1 卡面判据',
    """  /* ⚠️ 界面用 `U.numText(amount, 0)` 渲染（会加千分位），所以期望值也必须走**同一个出口** ——
     直接拼 '+5610' 会假红（实际印的是 '+5,610'）。 */
  const lianbingTxt = lianbing26 ? G.utils.numText(lianbing26.amount, 0) : '?';
  check('「＋」开出选择窗，列出道具的持有数与每份经验',
    !!expModal.querySelector('[data-action="exp-pick-item"]')
    && expModal.textContent.indexOf('练兵经验') >= 0
    /* v89.82：面额 = pct × EXP_CURVE.total（曲线一改自动跟随），所以从 DATA **现读** ——
       写死 "+200" 会在每次调曲线时假红（v89.73 就是这么写的，本轮曲线换了就撞上）。 */
    && !!lianbing26 && expModal.textContent.indexOf('+' + lianbingTxt) >= 0,
    '练兵经验 +' + lianbingTxt);""",
    """  check('「＋」开出选择窗，列出道具的持有数与本档培养上限（v89.171：「最多至 LvN」）',
    !!expModal.querySelector('[data-action="exp-pick-item"]')
    && expModal.textContent.indexOf('练兵经验') >= 0
    /* v89.171：卡面改印「最多至 LvN」（面额不再上卡 —— 老板嫌"看起来很高"）；
       期望值从 DATA 现读，别写死（调阶梯时会假红；旧判据查「+面额」已随卡面改版退役）。 */
    && !!lianbing26 && expModal.textContent.indexOf('最多至 Lv' + lianbing26.capLv) >= 0,
    '练兵经验 最多至 Lv' + (lianbing26 ? lianbing26.capLv : '?'));""",
    guard='最多至 LvN')

# E2. 新增 §171 真实 DOM 段（插在 return finish(); 之前）
H171 = """  /* ============================================================
   * 171. v89.171（老板）：「经验道具…最多能只能前期升级，不然后边纯买道具了」
   *   —— 培养上限（10~60）· 到线即止：真实 DOM 三态（可用 / 全到线 / 点到线档位）。
   * ============================================================ */
  console.log('\\n--- §171. 经验道具培养上限（v89.171 · 真实 DOM） ---');
  await (async function () {
    const s171 = G.state;
    const g171 = s171.generals.filter(function (x) { return !x.isLord; })[0] || s171.generals[0];
    const bk171 = { lv: g171.level, exp: g171.exp, rank: g171.rank, items: JSON.stringify(s171.items || {}) };
    try {
      s171.items = { bingxian_yipian: 2, lianbing_jingyan: 2 };
      g171.rank = 'tian'; g171.level = 1; g171.exp = 0;
      G.ui.closeAllModals();
      G.ui.openExpPick(g171.id);
      await sleep(80);
      let html171 = document.querySelector('#modal-root').innerHTML;
      check('v89.171 选择窗逐档写明培养上限（「最多至 Lv50」/「最多至 Lv10」）',
        html171.indexOf('最多至 Lv50') >= 0 && html171.indexOf('最多至 Lv10') >= 0);
      check('v89.171 未到线的档位给使用按钮', html171.indexOf('data-action="gen-exp-item"') >= 0);
      /* 到线（Lv60）→ 全族变暗、无使用按钮、写明「只服务前期」 */
      G.ui.closeAllModals();
      g171.level = 60;
      G.ui.openExpPick(g171.id);
      await sleep(80);
      html171 = document.querySelector('#modal-root').innerHTML;
      check('v89.171 Lv60 → 无使用按钮 + 写明「只服务前期」',
        html171.indexOf('data-action="gen-exp-item"') < 0 && html171.indexOf('只服务前期') >= 0);
      check('v89.171 Lv60 → 卡面到线变暗（btn sm dim）', html171.indexOf('btn sm dim') >= 0);
      /* 真点一个到线档位 → toast 说明原因（不是静默） */
      const dimBtn = document.querySelector('#modal-root [data-action="exp-pick-item"]');
      click(dimBtn);
      await sleep(90);
      const tst171 = (document.querySelector('#toast') || {}).textContent || '';
      check('v89.171 点到线的档位 → toast 说明原因（不静默）',
        tst171.indexOf('只服务前期') >= 0, tst171.slice(0, 60));
      G.ui.closeAllModals();
    } finally {
      g171.level = bk171.lv; g171.exp = bk171.exp; g171.rank = bk171.rank;
      s171.items = JSON.parse(bk171.items);
    }
  })();

  return finish();"""

rep('E2 §171 段',
    "  return finish();",
    H171,
    guard='§171. 经验道具培养上限（v89.171')

print('OK')
