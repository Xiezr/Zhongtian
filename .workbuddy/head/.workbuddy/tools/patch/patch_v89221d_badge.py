# -*- coding: utf-8 -*-
"""v89.221d · 任务页签：去数字徽标，改公文同款闪烁

老板令：「5.任务有完成的任务不需要加数字显示，参考公文菜单的闪烁」。
- index.html：任务页签移除 #tab-badge-task；.tab-badge 系列 CSS 整族退役（墓碑）。
- ui.js：syncBadges 里任务页签改挂 .fresh（与公文 tab 的 docBlink 同款动画）。
- 测试：smoke §24 与 e2e 的"红点元素"断言按新口径重写。"""
import io, sys

R = 'E:/Deepseekdb/'
def rd(p): return io.open(p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

bad = []
def rep(path, old, new, expect=1, tag=''):
    s = rd(R + path)
    c = s.count(old)
    if c != expect:
        bad.append('%s [%s] count=%d expect=%s | %s' % (path, tag, c, expect, old[:44]))
        return
    wr(R + path, s.replace(old, new))
    print('  [ok] %s %s' % (path.split('/')[-1], (tag or old[:22])))

# ═══ index.html：元素 + CSS 退役 ═══
rep('index.html',
    '<div class="tab" data-view="tasks"><i class="ti" data-nav="quest"></i>任务<span class="tab-badge hidden" id="tab-badge-task"></span></div>',
    '<div class="tab" data-view="tasks"><i class="ti" data-nav="quest"></i>任务</div>', 1, '任务页签')
rep('index.html',
    "  .topnav .tab .tab-badge { display: inline-block; min-width: 16px; height: 16px; line-height: 16px; padding: 0 var(--sp-1);\n    margin-left: var(--sp-1); border-radius: var(--r-lg); background: var(--tag-war); color: var(--on-accent); font-size: var(--fs-cap); font-weight: 700;\n    vertical-align: 1px; text-align: center; }\n  .topnav .tab .tab-badge.hidden { display: none; }\n",
    "  /* ⛔ v89.221（老板）：「任务有完成的任务不需要加数字显示，参考公文菜单的闪烁」——\n     .tab-badge 数字徽标随任务页签去数字化**整族退役**：任务页签改挂 .fresh\n     （与公文 tab 的 docBlink 同款动画，见上）。 */\n", 1, 'badge-css')
rep('index.html',
    '（.tab-badge 16px / .bag-worn 15px / .tile-badge 17px / .sigchip 17px /',
    '（.bag-worn 15px / .tile-badge 17px / .sigchip 17px /', 1, '字体特例注')
rep('index.html',
    '   * v41（需求 4）：公文有新战报 → 菜单**图标底色闪黄**，1.5 秒一轮',
    '   * v41（需求 4）：公文有新战报 → 菜单**图标底色闪黄**，1.5 秒一轮\n   *   （v89.221 起：任务页签「有可领取任务」复用同一套 .fresh / docBlink）', 1, 'fresh注')

# ═══ ui.js：syncBadges 重写 ═══
old_fn = """  /* 导航红点：可领取任务数 */
  ui.syncBadges = function () {
    if (!GAME.state) return;
    var el = $('#tab-badge-task');
    if (el) {
      var n = GAME.questSummary().ready;
      el.textContent = n > 99 ? '99+' : n;
      el.classList.toggle('hidden', n <= 0);
    }
    /* v41（需求 3）：行军角标**已撤**。老板原话「不要给在行军这个菜单名上产生数值」——
       顶栏徽标的语义是"有事情等你处理"（任务可领取）；行军只是"部队在外面"，
       属状态不属待办，挂在菜单名上会误导。队列数在行军菜单里本来就有。
       v41（需求 4）：公文改用**图标闪黄**（有新战报时），见下。 */
    var docTab = document.querySelector('#topnav .tab[data-view="reports"]');
    if (docTab) docTab.classList.toggle('fresh', (GAME.state.repUnread || 0) > 0);
    /* ⛔ v89.218：待阅逸闻徽标（tab-badge-story）随故事系统退役。 */
  };"""
new_fn = """  /* 导航提醒：有事情等你处理 → 页签图标闪黄 */
  ui.syncBadges = function () {
    if (!GAME.state) return;
    /* v89.221（老板）：「任务有完成的任务不需要加数字显示，参考公文菜单的闪烁」——
       数字徽标（#tab-badge-task）退役：有可领取任务时，任务页签图标闪黄
       （.fresh，与公文 tab 的 docBlink 同款；领完清零自动熄）。 */
    var taskTab = document.querySelector('#topnav .tab[data-view="tasks"]');
    if (taskTab) taskTab.classList.toggle('fresh', GAME.questSummary().ready > 0);
    /* v41（需求 3）：行军角标**已撤**。老板原话「不要给在行军这个菜单名上产生数值」——
       顶栏提醒的语义是"有事情等你处理"（任务可领取）；行军只是"部队在外面"，
       属状态不属待办，挂在菜单名上会误导。队列数在行军菜单里本来就有。
       v41（需求 4）：公文改用**图标闪黄**（有新战报时），见下。 */
    var docTab = document.querySelector('#topnav .tab[data-view="reports"]');
    if (docTab) docTab.classList.toggle('fresh', (GAME.state.repUnread || 0) > 0);
    /* ⛔ v89.218：待阅逸闻徽标（tab-badge-story）随故事系统退役。 */
  };"""
rep('js/ui.js', old_fn, new_fn, 1, 'syncBadges')

# ═══ smoke：旧"红点"断言按新口径重写（§0.7：规则变更 → 重写不删） ═══
rep('smoke-test.js',
    "  check('任务导航红点', /id=\"tab-badge-task\"/.test(htmlSrc24b) && /ui\\.syncBadges = function/.test(uiSrc24));",
    """  /* v89.221（老板）规则变更：「任务有完成的任务不需要加数字显示，参考公文菜单的闪烁」——
     数字徽标退役、任务页签改挂 .fresh。旧判据（查 tab-badge-task 元素）按新口径重写。 */
  check('任务页签闪烁（v89.221：去数字 · 仿公文 .fresh）', (function () {
    if (/tab-badge-task/.test(htmlSrc24b)) return false;
    if (!/data-view="tasks"/.test(htmlSrc24b)) return false;
    var i0 = uiSrc24.indexOf('ui.syncBadges = function');
    var i1 = uiSrc24.indexOf('ui.paintNav = function');
    if (i0 < 0 || i1 <= i0) return false;
    var blk = uiSrc24.slice(i0, i1);
    return /classList\\.toggle\\('fresh', GAME\\.questSummary\\(\\)\\.ready > 0\\)/.test(blk)
      && blk.indexOf('tab-badge') < 0;
  })());""", 1, 'smoke2429')

# ═══ e2e：红点元素断言按新口径重写 ═══
rep('e2e-test.js',
    "  check('任务导航有红点元素', !!document.querySelector('#tab-badge-task'));",
    "  check('任务页签在册且无数字徽标（v89.221：改建 .fresh 闪烁）',\n    !!document.querySelector('#topnav .tab[data-view=\"tasks\"]') && !document.querySelector('#tab-badge-task'));", 1, 'e2e-red-dot')

if bad:
    print('\n❌ 失配 %d：' % len(bad))
    for b in bad: print('   ' + b)
    sys.exit(1)
print('\n✅ v89.221d 全部落盘')
