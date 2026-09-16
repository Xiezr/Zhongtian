# -*- coding: utf-8 -*-
"""v86 · UI 改造（II）：计略选择由"子弹窗"改为**出征面板内嵌展开区**。

根因：项目弹窗是单根系统（ui.openModal 直接替换 innerHTML，无栈）——
从出征面板打开计略弹窗会替换掉出征面板，关闭后面板不回来（e2e 抓到）。
改为面板内联区：点「选择」原地展开/收起，选计后标签即时更新，面板不丢。
"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
MJ = r'E:\Deepseekdb\js\main.js'
E2 = r'E:\Deepseekdb\e2e-test.js'


def rep(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t and old not in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if t.count(old) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一）' % (tag, t.count(old)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old, new, 1))
    print('  ✓ %s' % tag)


def rep_span(path, start_m, end_m, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    i0 = t.find(start_m)
    i1 = t.find(end_m)
    if i0 < 0 or i1 < 0 or i1 <= i0:
        print('  ✗ %s：区间定位失败 i0=%d i1=%d' % (tag, i0, i1))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t[:i0] + new + t[i1:])
    print('  ✓ %s（替换 %d 字符）' % (tag, i1 - i0))


print('== V1. openExpScheme 弹窗版 → 内联区版 ==')
rep_span(
    UI,
    '  ui.openExpScheme = function () {',
    '  /* 布防计略（城池面板）——防御计布在自己城上，持续期内自动生效 */',
    """  ui.expSchemePanelHTML = function () {
    var s = GAME.state;
    var t = ui._expRes;
    if (!t) return '';
    var gen = ui.expSchemeGenOf();
    var list = (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'attack' || sc.kind === 'march'; });
    return list.map(function (sc) {
      var chk = GAME.schemePrepare(sc.id, t, gen);
      var on = ui._expScheme === sc.id;
      var extra = '';
      if (sc.id === 'tiaobo' && t.npc) {
        var n = GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'tiaobo');
        extra = '　<b style="color:var(--gold-light);font-weight:400;">该城守将忠诚 ' + Math.max(0, 100 - 25 * n) + '</b>';
      }
      var btn = chk.ok
        ? '<button class="btn sm' + (on ? '' : ' gold') + '" data-action="exp-scheme-pick" data-v="' + sc.id + '">' + (on ? '撤下' : '选择') + '</button>'
        : '<button class="btn sm" disabled title="' + U.escape(chk.msg) + '">不可用</button>';
      return '<div class="inn-card" style="margin-bottom:6px;"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">' + sc.icon + ' ' + sc.name +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">精' + sc.energy + ' · 囊' + sc.jinang + '</span>' +
          (on ? '　<span style="color:var(--green-ok);">已选</span>' : '') + extra + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(sc.tip) + '</div>' +
        (chk.ok ? '' : '<div style="color:var(--red-light);font-size:var(--fs-sub);margin-top:2px;">' + U.escape(chk.msg) + '</div>') +
        '</div>' + btn + '</div>';
    }).join('');
  };
  /* 面板内展开/收起（不用子弹窗：弹窗是单根系统，切换会丢出征面板） */
  ui.toggleExpScheme = function () {
    var box = $('#exp-scheme-box');
    if (!box) return;
    if (box.classList.contains('hidden')) {
      box.innerHTML = ui.expSchemePanelHTML();
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  };
""",
    'V1 openExpScheme→内联',
)

print()
print('== V2. doExpSchemePick 改内联刷新 ==')
rep_span(
    UI,
    '  ui.doExpSchemePick = function (sid) {',
    '  ui.doCitySchemePick = function (sid) {',
    """  ui.doExpSchemePick = function (sid) {
    ui._expScheme = (ui._expScheme === sid) ? null : sid;   /* 再点一次 = 撤下 */
    ui.setExpSchemeLabel();
    var box = $('#exp-scheme-box');
    if (box) box.innerHTML = ui.expSchemePanelHTML();       /* 原地刷新（面板不丢） */
  };
""",
    'V2 doExpSchemePick',
)

print()
print('== V3. 出征面板加内联容器 ==')
rep(
    UI,
    """    html += '<div class="exp-info">计略 <b id="exp-scheme-label">' + ui.expSchemeLabel() + '</b>' +
      '<span class="exp-tac-link" data-action="exp-scheme">选择</span></div>';
    html += '<div class="exp-modes">' + mtabs + '</div>';""",
    """    html += '<div class="exp-info">计略 <b id="exp-scheme-label">' + ui.expSchemeLabel() + '</b>' +
      '<span class="exp-tac-link" data-action="exp-scheme">选择</span></div>';
    /* v86：计略选择 = 面板内嵌展开区（复用 .exp-body 的滚动样式，不新增 CSS） */
    html += '<div id="exp-scheme-box" class="hidden exp-body" style="max-height:210px;margin:0 0 6px;"></div>';
    html += '<div class="exp-modes">' + mtabs + '</div>';""",
    'V3 内联容器',
)

print()
print('== V4. main.js 分发改 toggle ==')
rep(
    MJ,
    "      case 'exp-scheme': ui.openExpScheme(); break;",
    "      case 'exp-scheme': ui.toggleExpScheme(); break;",
    'V4 toggle',
)

print()
print('== V5. e2e 段改内联流程 ==')
rep(
    E2,
    """    G.ui.openExpModal({ kind: 'wild', x: wt.x, y: wt.y });
    await sleep(160);
    check('v86：出征面板含「计略」行', !!document.querySelector('#exp-scheme-label'));
    click(document.querySelector('#modal-root [data-action="exp-scheme"]'));
    await sleep(160);
    check('v86：计略弹窗（妖言/千里奔袭等六计可见）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('妖言惑众') >= 0
        && root.textContent.indexOf('千里奔袭') >= 0
        && root.textContent.indexOf('锦囊现有') >= 0;
    })());
    click(document.querySelector('#modal-root [data-action="exp-scheme-pick"][data-v="yaoyan"]'));
    await sleep(160);
    G.ui.closeModal();
    await sleep(100);
    check('v86：选定后出征面板标签更新', (function () {
      const lb = document.querySelector('#exp-scheme-label');
      return !!lb && lb.textContent.indexOf('妖言惑众') >= 0;
    })());
    /* 提交携计（需城内有兵） */
    const c86 = G.currentCity();
    c86.army = c86.army || {};
    c86.army.yibing = (c86.army.yibing || 0) + 100;
    G.ui.openExpModal({ kind: 'wild', x: wt.x, y: wt.y });
    await sleep(160);
    click(document.querySelector('#modal-root [data-action="exp-scheme"]'));
    await sleep(160);
    click(document.querySelector('#modal-root [data-action="exp-scheme-pick"][data-v="yaoyan"]'));
    await sleep(160);
    G.ui.closeModal();
    await sleep(100);
    const inp = document.querySelector('#exp-yibing');
    if (inp) { inp.value = '100'; }
    click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
    await sleep(200);
    check('v86：提交后行军携计（marches[].scheme = yaoyan）', (function () {
      return (G.state.marches || []).some((m) => m.scheme === 'yaoyan');
    })());""",
    """    G.ui.openExpModal({ kind: 'wild', x: wt.x, y: wt.y });
    await sleep(160);
    check('v86：出征面板含「计略」行', !!document.querySelector('#exp-scheme-label'));
    click(document.querySelector('#modal-root [data-action="exp-scheme"]'));
    await sleep(120);
    check('v86：计略区展开（妖言/千里奔袭等六计可见）', (function () {
      const box = document.querySelector('#exp-scheme-box');
      return !!box && !box.classList.contains('hidden')
        && box.textContent.indexOf('妖言惑众') >= 0
        && box.textContent.indexOf('千里奔袭') >= 0;
    })());
    click(document.querySelector('#exp-scheme-box [data-action="exp-scheme-pick"][data-v="yaoyan"]'));
    await sleep(120);
    check('v86：选定后计略标签更新（面板不丢 · 内联区选中态）', (function () {
      const lb = document.querySelector('#exp-scheme-label');
      const box = document.querySelector('#exp-scheme-box');
      return !!lb && lb.textContent.indexOf('妖言惑众') >= 0
        && !!box && box.textContent.indexOf('已选') >= 0;
    })());
    /* 提交携计（需城内有兵） */
    const c86 = G.currentCity();
    c86.army = c86.army || {};
    c86.army.yibing = (c86.army.yibing || 0) + 100;
    const inp = document.querySelector('#exp-yibing');
    if (inp) { inp.value = '100'; }
    click(document.querySelector('#modal-root [data-action="exp-confirm"]'));
    await sleep(200);
    check('v86：提交后行军携计（marches[].scheme = yaoyan）', (function () {
      return (G.state.marches || []).some((m) => m.scheme === 'yaoyan');
    })());""",
    'V5 e2e 内联流程',
)

print()
print('全部完成。')
