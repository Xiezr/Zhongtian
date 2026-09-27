# -*- coding: utf-8 -*-
"""v89.151 批 D2：ui.js —— 距离读数 / 底栏指挥战斗 / 野地面板按钮"""
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag); return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 距离读数（旧账 7：老板「读数统一，距离 XX/XX」）----------
rep(
    """  ui.gapReadOf = function (gap, D) {
    var near = (gap == null) ? '—' : U.numText(gap, 0);
    return '最近距离 <b>' + near + '</b>' + (D ? ' / 全局 <b>' + U.numText(D, 0) + '</b>' : '');
  };""",
    """  ui.gapReadOf = function (gap, D) {
    /* v89.151（老板旧账 7）：「读数统一，**距离 XX/XX**」——
       v89.149 曾作「最近距离 X / 全局 D」两段标签，现收敛为**一段双数**：
       前数 = 两军最前线距离（引擎 frontsOf 的 gap）· 后数 = 战场纵深（双方配兵决定）。
       详细解释仍走 title（btGapTextOf），读数本身只留数字。 */
    var near = (gap == null) ? '—' : U.numText(gap, 0);
    return '距离 <b>' + near + '</b>' + (D ? ' / <b>' + U.numText(D, 0) + '</b>' : '');
  };""",
    '① gapReadOf 文案')

# btGapTextOf 的 title 同步（解释两数含义）
rep(
    """    return '<span id="bt-gap" title="最近距离 = 两军最前线之间的距离（纵深 − 双方推进度；'
      + '推进到进入射程即停）。全局 = 战场纵深（双方配兵决定）">'
      + ui.gapReadOf(gp, D) + '</span>';""",
    """    return '<span id="bt-gap" title="距离 = 两军最前线之间的距离（纵深 − 双方推进度；'
      + '推进到进入射程即停）/ 后数 = 战场纵深（双方配兵决定）">'
      + ui.gapReadOf(gp, D) + '</span>';""",
    '①b btGapTextOf title')

# ---------- ② 底栏：名称文案动态 + 指挥战斗按钮 ----------
OLD2 = """  ui.paintBottom = function () {
    var bar = $('#bottom-bar');
    if (!bar) return;
    var arr = ui._bottom || [];
    /* v89.52（老板：底部导航栏最左加按钮，一键显示建筑/野地名称与等级）：
       绝对定位在底部条最左，不挤占居中的分页/地图导航。.on = 标注显示中。
       v89.67（老板「名城的名称永不消失」）：按钮**管不到城池**（也不能影响缩略图城名层），
       所以 title 必须写清"哪些能收、哪些永远在" —— 否则玩家点了半天发现城池还在，会以为坏了。 */
    var lblBtn = '<button class="bb-label-toggle' + (ui._mapShowLabels !== false ? ' on' : '') +
      '" data-action="map-toggle-labels" title="一键显示 / 隐藏：野地 · 据点 · 城内建筑 的名称与等级' +
      '（城池名称与等级永远显示，不受此开关影响）">🏷 名称</button>';
    bar.innerHTML = lblBtn + (arr.length ? arr.join('')
      : '<span class="bb-hint">—</span>')
      + '<button class="bb-mini" data-action="open-minimap" title="缩略地图：点击看天下大势">'
      + '<canvas id="mini-canvas" width="' + ui.MINI_PX + '" height="' + ui.MINI_PX + '"></canvas>'
      + '</button>';
    ui.paintMiniBottom();
  };"""

NEW2 = """  ui.paintBottom = function () {
    var bar = $('#bottom-bar');
    if (!bar) return;
    var arr = ui._bottom || [];
    /* ============================================================
     * v89.151（老板 3）：底部导航栏左侧统一为 `.bb-tools` 容器（两枚**同级图标按钮**）——
     *   ① 「名称」改名随状态走：「🏷 隐藏名称」（显示中）/「🏷 显示名称」（已隐藏）；
     *   ② 新增同级菜单「⚔ 指挥战斗」= 战斗待指挥清单入口（`ui.openBattleList`）——
     *      **有正在进行的战斗时闪烁**（`.blink`，由 ui.paintWarBeacon 每秒切换，不重建 DOM）。
     * 沿用 v89.52 的定位套路（贴底栏最左、不挤占居中的分页/地图导航），
     * v89.67 的 title 规矩照旧：写清"哪些能收、哪些永远在"。
     * ============================================================ */
    var show = ui._mapShowLabels !== false;
    var lblBtn = '<button class="bb-label-toggle' + (show ? ' on' : '') +
      '" data-action="map-toggle-labels" title="' + (show
        ? '点击隐藏：野地 · 据点 · 城内建筑 的名称与等级（城池名称与等级永远显示，不受影响）'
        : '当前已隐藏 —— 点击恢复显示：野地 · 据点 · 城内建筑 的名称与等级') +
      '">🏷 ' + (show ? '隐藏名称' : '显示名称') + '</button>';
    var warBtn = '<button class="bb-war" data-action="battle-list-open" ' +
      'title="指挥战斗：查看正在进行的战斗（有战斗待指挥时闪烁）">⚔ 指挥战斗</button>';
    bar.innerHTML = '<div class="bb-tools">' + lblBtn + warBtn + '</div>'
      + (arr.length ? arr.join('')
      : '<span class="bb-hint">—</span>')
      + '<button class="bb-mini" data-action="open-minimap" title="缩略地图：点击看天下大势">'
      + '<canvas id="mini-canvas" width="' + ui.MINI_PX + '" height="' + ui.MINI_PX + '"></canvas>'
      + '</button>';
    ui.paintMiniBottom();
    ui.paintWarBeacon();
  };
  /* v89.151（老板 3）：「指挥战斗（有正在进行的战斗时发生闪烁）」——
     只切 class（**不重建按钮**），主循环每秒调用；paintBottom 收尾也调一次（首绘即正确）。
     判据走唯一出口 ui.battleListOf（state === 'live'），与清单弹窗同源。 */
  ui.paintWarBeacon = function () {
    var btn = (document.querySelector ? document.querySelector('#bottom-bar .bb-war') : null);
    if (!btn || !btn.classList) return;
    var on = ui.battleListOf().length > 0;
    if (on !== btn.classList.contains('blink')) btn.classList.toggle('blink', on);
  };"""

rep(OLD2, NEW2, '② paintBottom + paintWarBeacon')

# ---------- ③ 野地面板：三区加等长类 + 「设置采集」→「采集」 ----------
rep(
    """    gatherBox = '<div class="op-zone"><div class="op-zone-t">采集</div>';""",
    """    gatherBox = '<div class="op-zone op-zone-eq"><div class="op-zone-t">采集</div>';""",
    '③a 采集区 eq 类')

rep(
    """    var ops = '<div class="op-zone"><div class="op-zone-t">地块操作</div><div class="op-row">' +""",
    """    var ops = '<div class="op-zone op-zone-eq"><div class="op-zone-t">地块操作</div><div class="op-row">' +""",
    '③b 地块操作区 eq 类')

rep(
    """      '<div class="op-zone danger"><div class="op-zone-t">危险操作</div><div class="op-row">' +""",
    """      '<div class="op-zone danger op-zone-eq"><div class="op-zone-t">危险操作</div><div class="op-row">' +""",
    '③c 危险区 eq 类')

rep(
    """          (setTitle139 ? ' title="' + setTitle139 + '"' : '') + '>⚙️ 设置采集</button>' +""",
    """          (setTitle139 ? ' title="' + setTitle139 + '"' : '') + '>⛏️ 采集</button>' +""",
    '③d 设置采集→采集')

assert '\r\n' not in s
assert s.count('op-zone-eq') == 3
# 「⛏️ 采集」共 3 处：附属野地弹窗 2 处（gold/disabled 两分支，原有）+ 地块面板 1 处（本轮改来）
assert s.count('>⛏️ 采集</button>') == 3
assert '⚙️ 设置采集' not in s
assert s.count('ui.paintWarBeacon = function') == 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ui.js D2 落盘 OK · len=' + str(len(s)))
