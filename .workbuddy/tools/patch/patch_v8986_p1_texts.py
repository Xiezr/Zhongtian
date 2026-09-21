# -*- coding: utf-8 -*-
"""v89.86 整改 · P1 文案与前置提示四项：
   P-24 据点「占领」文案 = 拔除（打完撤军/当日移除/次日重置），与野地驻守拆开
   P-11 Lv0 野地驻军文案动态化（无驻军位）
   P-04 建造/升级前置"升级中"动态提示（不再像永久锁）
   P-16 野地上限的出兵前预警（此前只在战后提示）
"""
import io
import os
import sys

UI = r'E:\Deepseekdb\js\ui.js'
DA = r'E:\Deepseekdb\js\data.js'
DO = r'E:\Deepseekdb\js\domain.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


assert '\r\n' not in read(UI), 'ui.js 期望 LF'

# ============ P-04 · 前置升级中文案（helper + 两个调用点） ============
edit(UI, r"""  ui.openBuildModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();""",
     r"""  /* v89.86（整改 P-04）：前置未满足时的展示文案 —— 若前置建筑**正在升级中**
     且升完就够（队列 targetLevel ≥ 需求），改报「X 升级中（剩余 T），完成后可建」；
     否则回落标准 short（"需官府 Lv2"）。两个调用点共用：建造菜单卡片 / 建筑面板升级按钮。 */
  ui.prereqText = function (city, pre) {
    if (!pre || pre.ok) return '';
    var list = pre.list || [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var q = GAME.pendingUpgradeOf ? GAME.pendingUpgradeOf(city, o.bid) : null;
      if (q && (q.targetLevel || 0) >= o.need) {
        var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
        return o.name + '升级中（剩余 ' + U.durExact(left) + '），完成后可建';
      }
    }
    return pre.short;
  };

  ui.openBuildModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();""",
     'P-04 · prereqText 助手')

edit(UI, r"""            : '<button class="btn bldg-act dim" disabled>⬆ 升级<span class="ba-sub">' +
                (preUp.ok ? '已达最高等级' : U.escape(preUp.short)) + '</span></button>') +""",
     r"""            /* v89.86（P-04）：前置升级中 → 报"X 升级中（剩余 T）"，不再像永久锁 */
            : '<button class="btn bldg-act dim" disabled>⬆ 升级<span class="ba-sub">' +
                (preUp.ok ? '已达最高等级' : U.escape(ui.prereqText(c, preUp))) + '</span></button>') +""",
     'P-04 · 建筑面板升级按钮')

edit(UI, r"""        /* v68 · 逐步探索：前置不满足 → 置灰并写明原因（"需客栈 Lv2"） */
        var preB = GAME.buildPrereqOf(c, bid, 1);
        if (!preB.ok) { afford = ' disabled'; lockMsg = preB.short; tip += '｜' + preB.msg; }""",
     r"""        /* v68 · 逐步探索：前置不满足 → 置灰并写明原因（"需客栈 Lv2"）
           v89.86（P-04）：前置升级中改报动态文案（ui.prereqText），不再像永久锁。 */
        var preB = GAME.buildPrereqOf(c, bid, 1);
        if (!preB.ok) {
          afford = ' disabled';
          var preTxt = ui.prereqText(c, preB);
          lockMsg = preTxt; tip += '｜' + preTxt;
        }""",
     'P-04 · 建造菜单卡片')

# ============ P-11 · Lv0 驻军文案（野地提示 + 派驻面板头行） ============
edit(UI, r"""        /* v89.83（老板「占领后就自动驻军，直至召回；掠夺则直接撤军」）——
           两种目的在这里说清，省得点进去才发现兵回不回城是另一件事。 */
        '<div class="op-hint" style="text-align:center;">🚩 <b>占领</b>：打下来后军队就地驻守（守地不衰减，直至召回）　·　' +
          '🔥 <b>掠夺</b>：打完直接撤军</div>' +""",
     r"""        /* v89.83（老板「占领后就自动驻军，直至召回；掠夺则直接撤军」）——
           两种目的在这里说清，省得点进去才发现兵回不回城是另一件事。
           v89.86（整改 P-11）：Lv0 野地驻军上限为 0 —— 文案按等级动态，
           不能再写"就地驻守"（与实际"军队全回城"落差太大，老板实测记下）。 */
        '<div class="op-hint" style="text-align:center;">🚩 <b>占领</b>：' +
          (lv > 0
            ? '打下来后军队就地驻守（守地不衰减，直至召回）'
            : '<b style="color:var(--warn);">Lv0 无驻军位</b>（军队打完回城；升到 Lv1+ 才有驻军位）') +
          '　·　🔥 <b>掠夺</b>：打完直接撤军</div>' +""",
     'P-11 · 野地占领提示按等级动态')

edit(UI, r"""      '<div class="ui-sub" style="text-align:center;margin-bottom:6px;">出发地：' + U.escape(c.name) +
        '　·　驻军上限 ' + U.numText(cap, 0) + '（' + w.level + ' 级野地 ×' + U.numText(DATA.WILD_GARRISON.perLevel, 0) + '）' +
        '　·　现有驻军 ' + U.numText(have, 0) + '</div>' +""",
     r"""      '<div class="ui-sub" style="text-align:center;margin-bottom:6px;">出发地：' + U.escape(c.name) +
        '　·　' + (cap > 0
          ? ('驻军上限 ' + U.numText(cap, 0) + '（' + w.level + ' 级野地 ×' + U.numText(DATA.WILD_GARRISON.perLevel, 0) + '）')
          /* v89.86（整改 P-11）：Lv0 上限为 0 —— 写明"无驻军位"，不再只印一个 0 */
          : '<b style="color:var(--warn);">该等级无驻军位</b>（Lv0 野地不接驻军）') +
        '　·　现有驻军 ' + U.numText(have, 0) + '</div>' +""",
     'P-11 · 派驻面板头行')

# ============ P-24 · 据点拔除文案（弹窗按钮 + 出征面板注 + 数据 desc） ============
edit(UI, r"""        '<button class="btn gold" data-action="fort-exp" data-mode="occupy">🚩 占领</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'""",
     r"""        /* v89.86（整改 P-24）：据点"占领"实为**拔除**（打完撤军、当日移除、次日重置），
           与野地的"就地驻守"不是一回事 —— 按钮与提示拆两套文案。 */
        '<button class="btn gold" data-action="fort-exp" data-mode="occupy">🚩 拔除据点</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>' +
      '<div class="op-hint" style="text-align:center;margin-top:6px;">🚩 <b>拔除据点</b>：打完撤军，据点当日移除、次日重置（不驻守）；野地占领才会就地驻军</div>'""",
     'P-24 · 据点弹窗按钮与提示')

edit(UI, r"""    /* ④ 出征方式（2×2 右上）—— 紧凑下拉框 */
    html += '<div class="exp-sec exp-a-modes"><div class="exp-sec-t">出征方式</div>' + modeSelHTML + '</div>';""",
     r"""    /* ④ 出征方式（2×2 右上）—— 紧凑下拉框 */
    /* v89.86（整改 P-24）：据点目标的"占领"语义提示（=拔除，打完撤军；野地才会驻守） */
    var fortModeNote = (t.kind === 'fort')
      ? '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">据点：占领=拔除（打完撤军、当日移除、次日重置）；野地占领才会就地驻军。</div>'
      : '';
    html += '<div class="exp-sec exp-a-modes"><div class="exp-sec-t">出征方式</div>' + modeSelHTML + fortModeNote + '</div>';""",
     'P-24 · 出征面板据点注')

edit(DA, r"""        desc: '击溃守军并据而有之：野地归我，军队就地驻守（守地不衰减，直至召回）；名城易主，军仍班师。' },""",
     r"""        desc: '击溃守军并据而有之：野地归我，军队就地驻守（守地不衰减，直至召回）；据点被拔除（打完撤军、当日移除、次日重置）；名城易主，军仍班师。' },""",
     'P-24 · occupy 方式 desc')

# ============ P-16 · 野地上限出兵前预警 ============
edit(UI, r"""    html += '<div class="exp-info exp-info-l" id="exp-march" style="margin-bottom:4px;"></div>';
    html += '<div class="exp-info exp-info-l" id="exp-sum" style="margin-bottom:4px;"></div>';
    html += '<div class="exp-info exp-info-l" id="exp-power" style="margin-bottom:4px;"></div>';
    html += '</div>';""",
     r"""    html += '<div class="exp-info exp-info-l" id="exp-march" style="margin-bottom:4px;"></div>';
    html += '<div class="exp-info exp-info-l" id="exp-sum" style="margin-bottom:4px;"></div>';
    html += '<div class="exp-info exp-info-l" id="exp-power" style="margin-bottom:4px;"></div>';
    /* v89.86（整改 P-16）：野地上限的**出兵前**预警（此前只在战后写一句"转为就地取材"） */
    html += '<div class="exp-info exp-info-l" id="exp-wildcap" style="margin-bottom:4px;color:var(--red-light);"></div>';
    html += '</div>';""",
     'P-16 · 出征面板预警元素')

edit(UI, r"""  ui.applyExpMode = function () {
    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');
    var box = $('#modal-root .exp-troops');
    if (box) box.style.opacity = cur.battle ? '1' : '.55';
  };""",
     r"""  ui.applyExpMode = function () {
    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');
    var box = $('#modal-root .exp-troops');
    if (box) box.style.opacity = cur.battle ? '1' : '.55';
    ui.updateExpWildCap();          /* v89.86（P-16）：方式变更 → 重算野地上限预警 */
  };

  /* v89.86（整改 P-16）：野地已达上限的出兵前预警 —— 上限口径与 battle 里
     "转为就地取材"的判定同源（官府等级 + 爵位/主城加成 cityBonusNum('wildCap')）。
     只在"目标=未占野地 + 方式=占领 + 已达上限"时显示。 */
  ui.updateExpWildCap = function () {
    var box = $('#exp-wildcap');
    if (!box) return;
    box.innerHTML = '';
    var t = ui._expRes;
    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');
    if (!t || t.kind !== 'wild' || !mode.occupy) return;
    if (GAME.map.wildAt(t.x, t.y)) return;          /* 已属我方：不适用 */
    var city = GAME.currentCity();
    var limit = (GAME.buildingLevel(city, 'guanfu') || 1) + GAME.cityBonusNum(city, 'wildCap');
    var have = ((GAME.state && GAME.state.wilds) || []).length;
    if (have < limit) return;
    box.innerHTML = '⚠️ 野地已达上限（' + have + ' / ' + limit + '）：本次占领将<b>转为就地取材</b>' +
      '（不再取得产量加成与采集权）——可先放弃一处野地，或升官府提高上限。';
  };""",
     'P-16 · updateExpWildCap')

# 出征面板打开时也跑一次（applyExpMode 已在 openExpModal 尾部被调，这里补在 updateExpMarch 之后做双保险）
edit(UI, r"""    ui.openModal(html, { size: 'xl' });
    ui.applyExpMode();
    ui.refreshExpItems();
    ui.updateExpMarch();""",
     r"""    ui.openModal(html, { size: 'xl' });
    ui.applyExpMode();
    ui.refreshExpItems();
    ui.updateExpMarch();
    ui.updateExpWildCap();          /* v89.86（P-16）：打开即评估野地上限（双保险，applyExpMode 已调一次） */""",
     'P-16 · 打开面板时评估')

# ============ domain.js · pendingUpgradeOf ============
edit(DO, r"""  GAME.wallPendingOf = function (cityId) {
    var s = GAME.state;
    return (((s && s.queues && s.queues.build) || [])).some(function (q) {
      return q.type === 'wall' && q.cityId === cityId;
    });
  };""",
     r"""  GAME.wallPendingOf = function (cityId) {
    var s = GAME.state;
    return (((s && s.queues && s.queues.build) || [])).some(function (q) {
      return q.type === 'wall' && q.cityId === cityId;
    });
  };

  /* v89.86（整改 P-04）：前置建筑"正在升级中"的查询出口 ——
     建造菜单 / 升级按钮只写「需官府 Lv2」会像永久锁（老板实测误判）；
     查到这个就能改写成「官府升级中（剩余 X），完成后可建」。
     与 wallPendingOf 同一手法：建造队列是唯一事实来源。 */
  GAME.pendingUpgradeOf = function (city, bid) {
    var s = GAME.state;
    if (!city || !bid || !s || !s.queues) return null;
    var q = null;
    (s.queues.build || []).forEach(function (x) {
      if (q) return;
      if (x.cityId === city.id && x.buildId === bid && x.type === 'upgrade') q = x;
    });
    return q;
  };""",
     'P-04 · pendingUpgradeOf')

for p in (UI, DA, DO):
    src = read(p)
    print('%s : v89.86 = %d 次' % (os.path.basename(p), src.count('v89.86')))
