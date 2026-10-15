# -*- coding: utf-8 -*-
"""v89.229c17：e2e 红单按新口径重写（14 兵种 · 四页分页 · 统一面板）+ 产品侧无 idx 默认队列页"""
import io, os, re, sys

ROOT = r'E:\Deepseekdb'
E = os.path.join(ROOT, 'e2e-test.js')
U = os.path.join(ROOT, 'js', 'ui.js')


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


LOG = []


def rep(path, tag, old, new, cnt=1):
    s = rd(path)
    if new in s:
        LOG.append('[skip] ' + tag); return True
    c = s.count(old)
    if c != cnt:
        LOG.append('[FAIL] ' + tag + ' count=' + str(c) + '/' + str(cnt)); return False
    wr(path, s.replace(old, new)); LOG.append('[ok]   ' + tag); return True


# ---------------------------------------------------------------- 产品侧：无 idx → 队列页
rep(U, 'P1 openTroops 无 idx 时落队列页',
    """    if (_idx0 != null) {
      var c0 = GAME.currentCity();""",
    """    if (_idx0 == null) {
      ui._trainTab = 'que';          /* v89.229：无工位上下文（裸入口/测试）→ 默认队列页 */
    } else {
      var c0 = GAME.currentCity();""")

# ---------------------------------------------------------------- e2e
rep(E, 'E1 兵种数 18→14',
    "  check('兵种 18', Object.keys(DATA.TROOPS || {}).length === 18, Object.keys(DATA.TROOPS || {}).length + '');",
    "  check('兵种 14', Object.keys(DATA.TROOPS || {}).length === 14, Object.keys(DATA.TROOPS || {}).length + '');")

rep(E, 'E2 野地合计四类资源（读显示名出口）',
    "  check('野地合计列出四类资源', /粮/.test(wildHtml) && /木/.test(wildHtml) && /石/.test(wildHtml) && /铁/.test(wildHtml));",
    """  /* v89.229（资源四类换代）：合计行按 ui.RES_NAME 短标签渲染（水/生/电/钢）——
     判据改为**读同一出口**（改显示名不会再造假红）。 */
  check('野地合计列出四类资源', ['grain', 'wood', 'stone', 'iron'].every(function (k) {
    return wildHtml.indexOf(G.ui.RES_NAME[k]) >= 0;
  }));""")

# 标题换代（三处）
rep(E, 'E3 功能按钮开面板标题（a）',
    "      check('升级中点功能按钮真的打开募兵面板',\n        document.querySelector('#modal-root').innerHTML.indexOf('兵营招募') >= 0);",
    "      check('升级中点功能按钮真的打开募兵面板（v89.229 标题「兵种整备」）',\n        document.querySelector('#modal-root').innerHTML.indexOf('兵种整备') >= 0);")

rep(E, 'E4 openTroops 单参（v80 段）',
    "    G.ui.openTroops(j80, 'normal');",
    "    G.ui.openTroops(j80);            /* v89.229：第二参 filter 已退役 */")

rep(E, 'E5 兵营页标题计数',
    """    check('v80：兵营页只剩一处标题（重复标题 / 工位行 / 解锁计数全撤）',
      (mr80.innerHTML.match(/兵营招募/g) || []).length === 1
      && mr80.textContent.indexOf('募兵训练营') < 0 && mr80.textContent.indexOf('队列位') < 0
      && mr80.textContent.indexOf('已解锁') < 0);""",
    """    check('v80：兵营页只剩一处标题（重复标题 / 工位行 / 解锁计数全撤）',
      (mr80.innerHTML.match(/兵种整备/g) || []).length === 1
      && mr80.textContent.indexOf('募兵训练营') < 0 && mr80.textContent.indexOf('队列位') < 0
      && mr80.textContent.indexOf('已解锁') < 0);""")

rep(E, 'E6 四页切换按钮',
    """    check('v81：三页切换按钮（募兵队列 / 步兵 / 机车）', (function () {
      const tabs = Array.prototype.map.call(
        mr80.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 3 && tabs[0] === 'que' && tabs.indexOf('inf') >= 0 && tabs.indexOf('cav') >= 0;
    })());
    click(mr80.querySelector('[data-action="train-tab"][data-page="cav"]'));
    await sleep(150);
    check('v80：翻到机车页（首卡为机车）', (function () {
      const card = document.querySelector('#modal-root .troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].cat === 'cav';
    })());""",
    """    check('v89.229：四页切换按钮（募兵队列 / 后勤支援 / 主力战斗 / 尖端武装）', (function () {
      const tabs = Array.prototype.map.call(
        mr80.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 4 && tabs[0] === 'que'
        && tabs.indexOf('g1') >= 0 && tabs.indexOf('g2') >= 0 && tabs.indexOf('g3') >= 0;
    })());
    click(mr80.querySelector('[data-action="train-tab"][data-page="g2"]'));
    await sleep(150);
    check('v80：翻到主力战斗页（首卡属组 2）', (function () {
      const card = document.querySelector('#modal-root .troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].grp === 2;
    })());""")

rep(E, 'E7 训练营面板入口单参',
    "    G.ui._trainTab = 'que';                 /* 模拟新会话初始态（第一页 = 募兵队列） */\n    G.ui.openTroops(j81 < 0 ? undefined : j81, 'normal');",
    "    G.ui._trainTab = 'que';                 /* 模拟新会话初始态（第一页 = 募兵队列） */\n    G.ui.openTroops(j81 < 0 ? undefined : j81);")

rep(E, 'E8 v81 四页键 + 首页 + 组页',
    """    check('v81：三页切换键齐备（募兵队列 / 步兵 / 机车）', (function () {
      const tabs = Array.prototype.map.call(
        mr81.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 3 && tabs[0] === 'que' && tabs.indexOf('inf') >= 0 && tabs.indexOf('cav') >= 0;
    })());
    check('v81：首页为募兵队列（队列在、兵种卡不在）',
      !!mr81.querySelector('.q-sec') && !mr81.querySelector('.troop-grid'));
    click(mr81.querySelector('[data-action="train-tab"][data-page="inf"]'));
    await sleep(140);
    const mr81b = document.querySelector('#modal-root');
    check('v81：步兵页有卡面与训练控件、队列不跟来', (function () {
      const card = mr81b.querySelector('.troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].cat === 'inf'
        && !!mr81b.querySelector('#train-count') && !mr81b.querySelector('.q-sec');
    })());""",
    """    check('v89.229：四页切换键齐备（募兵队列 / 后勤支援 / 主力战斗 / 尖端武装）', (function () {
      const tabs = Array.prototype.map.call(
        mr81.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 4 && tabs[0] === 'que'
        && tabs.indexOf('g1') >= 0 && tabs.indexOf('g2') >= 0 && tabs.indexOf('g3') >= 0;
    })());
    check('v81：首页为募兵队列（队列在、兵种卡不在）',
      !!mr81.querySelector('.q-sec') && !mr81.querySelector('.troop-grid'));
    click(mr81.querySelector('[data-action="train-tab"][data-page="g1"]'));
    await sleep(140);
    const mr81b = document.querySelector('#modal-root');
    check('v81：后勤支援页有卡面与训练控件、队列不跟来', (function () {
      const card = mr81b.querySelector('.troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].grp === 1
        && !!mr81b.querySelector('#train-count') && !mr81b.querySelector('.q-sec');
    })());""")

rep(E, 'E9 v84 分页互斥（组内同源 + 跨组互斥）',
    """    click(document.querySelector('#modal-root [data-action="train-tab"][data-page="cav"]'));
    await sleep(150);
    check('v84：运输平台卡在机车页（与侦察单元两页互斥）', (function () {
      const z84 = document.querySelector('#modal-root .troop-card[data-troop="yunshu"]');
      const ch84 = document.querySelector('#modal-root .troop-card[data-troop="zhencha"]');
      return !!z84 && !ch84;
    })());""",
    """    /* v89.229（兵种重构）：侦察单元与运输平台**同归组 1**（后勤支援）——
       旧的"两页互斥"不再成立，改为"同组同页 + 跨组互斥"。 */
    click(document.querySelector('#modal-root [data-action="train-tab"][data-page="g2"]'));
    await sleep(150);
    check('v89.229：跨组互斥（组 2 页无侦察单元/运输平台 · 有步行机）', (function () {
      const m84 = document.querySelector('#modal-root');
      return !!m84.querySelector('.troop-card[data-troop="buxingji"]')
        && !m84.querySelector('.troop-card[data-troop="zhencha"]')
        && !m84.querySelector('.troop-card[data-troop="yunshu"]');
    })());""")

# §211e：统一面板下的器械路径
rep(E, 'E10 §211e 器械面板入场（统一面板 · 从作坊打开）',
    """    G.ui.openTroops(b211, 'siege');            /* 陈旧训练营格（病根场景） */
    await sleep(220);
    check('§211e① 器械面板入场归一（陈旧训练营格 → 本城作坊格）', G.ui._trainBIdx === w211,
      'got=' + G.ui._trainBIdx + ' want=' + w211);""",
    """    /* v89.229（兵种重构）：面板**统一**（器械兵与常备兵同屏，按组分页）——
       旧的"传陈旧训练营格 → 硬回落到作坊"语义随 filter 参退役：
       器械路径 = 从作坊打开（组 3 尖端武装）；工位仍由选中兵种 craft 解析。 */
    G.ui.openTroops(w211);
    await sleep(220);
    check('§229c-e① 器械面板入场：从作坊打开 → 工位=该作坊 · 落组 3 尖端武装',
      G.ui._trainBIdx === w211 && G.ui._trainTab === 'g3',
      'got=' + G.ui._trainBIdx + '/' + G.ui._trainTab + ' want=' + w211 + '/g3');""")

rep(E, 'E11 §211e② 卡可选',
    "      check('§211e② 自行火炮卡可选（无灰）', !!card211 && !card211.classList.contains('disabled'));",
    "      check('§229c-e② 自行火炮卡可选（无灰）', !!card211 && !card211.classList.contains('disabled'));")

rep(E, 'E12 §211e③ 真点提交',
    """    check('§211e③ 真点提交成功（队列+1 落在作坊 · 不再假报无作坊）',""",
    """    check('§229c-e③ 真点提交成功（队列+1 落在作坊 · 不再假报无作坊）',""")

# 旧轮标题里的"步兵/机车"措辞（v84 侦察单元断言）
rep(E, 'E13 v84 侦察单元入组 1',
    "  check('v84：侦察单元卡已入步兵页', !!document.querySelector('#modal-root .troop-card[data-troop=\"zhencha\"]'));",
    "  check('v89.229：侦察单元卡在组 1（后勤支援）', !!document.querySelector('#modal-root .troop-card[data-troop=\"zhencha\"]'));")

# ---------------------------------------------------------------- 自检
for p, name in ((E, 'e2e-test.js'), (U, 'ui.js')):
    s = rd(p)
    LOG.append('%s 长度=%d · cat 残留=%d · "兵营招募"=%d' % (name, len(s), s.count('.cat === '), s.count('兵营招募')))

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c17_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')
