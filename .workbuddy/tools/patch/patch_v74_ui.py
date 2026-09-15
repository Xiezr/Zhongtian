# -*- coding: utf-8 -*-
"""v74 UI 层补丁：③④⑤⑥ 将领档案改造 + ⑦ 出征界面完善 + ② 固定像素画布

【③ 将领简介两行化】姓名 + 资质★（悬停=上限/成长）+ 类型 / 资质描述；
   撤下 Lv·状态·装备 行；Lv 挪进经验行；非空闲状态挂小签。
【④ 六维表】每点作用 → 名称悬停；原列位 → ＋ 加点按钮（六维皆有）；
   「属性与装备栏对半分配」（.gp-body 1fr 1fr）。
【⑤ 自由属性点】表格末行 + 加点弹窗（自由点 / 道具 二选一）。
【⑥ 删备注块】带兵/人口上限/本城产量/速度 四行整块撤除。
【⑦ 出征界面】兵力总览（总兵/耗粮）+ 战力对比（估算）+ 全带/清空。
【② 固定画布】#screen-game 定 1440×900；弹窗尺寸定 px（留极小窗口兜底）；
   全部视口断点（宽/高媒体查询）撤除。
"""
import io, sys, os

ROOT = r'E:\Deepseekdb'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    total = t.count('\n')
    crlf = t.count('\r\n') > (total - t.count('\r\n'))

    def to_dom(s):
        return s.replace('\n', '\r\n') if crlf else s.replace('\r\n', '\n')

    def to_alt(s):
        return s.replace('\r\n', '\n') if crlf else s.replace('\n', '\r\n')

    pairs = [(to_dom(old), to_dom(new))]
    if to_alt(old) != to_dom(old):
        pairs.append((to_alt(old), to_alt(new)))
    for o2, n2 in pairs:
        if n2 in t:
            print('  · %s：已改过（跳过）' % tag)
            return
    hit = [(o, n) for o, n in pairs if t.count(o) == 1]
    if not hit:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(pairs[0][0])))
        sys.exit(1)
    o2, n2 = hit[0]
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(o2, n2, 1))
    print('  ✓ %s' % tag)


UI = os.path.join(ROOT, 'js', 'ui.js')
MAIN = os.path.join(ROOT, 'js', 'main.js')
HTML = os.path.join(ROOT, 'index.html')

print('========== ③ 将领简介两行化 ==========')
patch(
    UI,
    """    var html = '<div class="gen-pane">' +
      '<div class="gp-head">' +
        '<span class="gp-face">' + ui.faceOf(g, 84) + '</span>' +
        '<span class="gp-id">' +
          '<b class="gp-name">' + ui.rankBadge(g) + ' ' + U.escape(g.name) +
            (g.hero ? '<span class="gcard-tag hero">史实名将</span>' : '') +
            (g.beauty ? '<span class="gcard-tag beauty">美人</span>' : '') + '</b>' +
          '<span class="gp-sub">Lv' + g.level + ' / ' + capLv + '　·　' + rk.name + '　·　' +
            ui.genStatusName(g) +
            (g.cityId && GAME.cityById(g.cityId) ? '（' + U.escape(GAME.cityById(g.cityId).name) + '）' : '') +
            '　·　装备 ' + eqCnt + '/12</span>' +
          '<span class="gp-sub">' + U.escape(rk.desc || '') +
            '　每级成长 <b>+' + rk.grow + '</b>' +
            (atCap ? '　<span class="gd-warn">已达资质上限</span>' : '') + '</span>' +
          '<span class="gp-exprow">' +
            '<span class="gd-expbar" title="经验 ' + U.numText(g.exp || 0, 0) + ' / ' +
              U.numText(expNeed, 0) + '"><i style="width:' + pct + '%;"></i></span>' +
            '<span class="gd-exptext">经验 <b>' + U.numText(g.exp || 0, 0) + '</b> / ' +
              U.numText(expNeed, 0) + '　（' + pct + '%）</span>' +""",
    """    /* v74（老板需求 3）：「将领的简介…太啰嗦：赵子龙 良材 ★★ 均衡 / 可当一郡之任」
       —— 头部收成两行：
         ① 姓名 + 资质★（悬停 = 等级上限 / 每级成长）+ 类型（均衡 / 猛将…）
         ② 资质描述（截掉"等级上限 N。"那半句 —— 它已进悬停）
       撤下：Lv 行、状态与城池、装备 n/12（装备数在右栏标题里）。
       Lv 挪进经验行；状态非空闲时以小签挂在名字后（出征中 / 守将 这类需要一眼看到）。 */
    var styleName74 = '';
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) styleName74 = x.name; });
    var rkDesc74 = String(rk.desc || '').replace(/等级上限 \\d+。?/, '').trim();
    var statusTag74 = (g.status && g.status !== 'idle')
      ? '<span class="gp-stag">' + U.escape(ui.genStatusName(g)) +
        (g.cityId && GAME.cityById(g.cityId) ? '·' + U.escape(GAME.cityById(g.cityId).name) : '') + '</span>'
      : '';
    var html = '<div class="gen-pane">' +
      '<div class="gp-head">' +
        '<span class="gp-face">' + ui.faceOf(g, 84) + '</span>' +
        '<span class="gp-id">' +
          '<b class="gp-name">' + U.escape(g.name) +
            (g.hero ? '<span class="gcard-tag hero">史实名将</span>' : '') +
            (g.beauty ? '<span class="gcard-tag beauty">美人</span>' : '') + statusTag74 + '</b>' +
          '<span class="gp-sub">' +
            '<span class="rank-badge r-' + rk.id + '" title="等级上限 ' + capLv +
              '，每级属性成长 +' + rk.grow + '">' + rk.name + ' ' + '★'.repeat(rk.star) + '</span>' +
            (styleName74 ? '<span class="gp-style">' + U.escape(styleName74) + '</span>' : '') +
          '</span>' +
          '<span class="gp-sub">' + U.escape(rkDesc74) +
            (atCap ? '　<span class="gd-warn">已达资质上限</span>' : '') + '</span>' +
          '<span class="gp-exprow">' +
            '<span class="gd-expbar" title="经验 ' + U.numText(g.exp || 0, 0) + ' / ' +
              U.numText(expNeed, 0) + '"><i style="width:' + pct + '%;"></i></span>' +
            '<span class="gd-exptext">Lv<b>' + g.level + '</b>　经验 <b>' + U.numText(g.exp || 0, 0) + '</b> / ' +
              U.numText(expNeed, 0) + '　（' + pct + '%）</span>' +""",
    'U1 简介两行化（名字+资质+类型 / 描述）',
)

print()
print('========== ④⑤⑥ 六维表改造 ==========')
patch(
    UI,
    """    html += '<div class="gp-sec">六维</div>' +
      /* v65：表头「作用（每点）」改「每点作用」—— 少两个字，"六维"列就宽一分 */
      '<table class="tbl gd-dims"><thead><tr><th>六维</th><th class="ctr">数值</th><th>每点作用</th></tr></thead><tbody>' +
        ui.GEN_DIMS.map(function (d) {
          var extra = (gbNow && d.guardUse) ? d.guardUse(gbNow) : '';
          return '<tr><td><b style="color:' + d.color + ';">' + d.n + '</b></td>' +
            '<td class="ctr gd-v">' + (a[d.val || d.k] || 0) + '</td>' +
            '<td class="gd-u">' + d.use + extra + '</td></tr>';
        }).join('') +
      '</tbody></table>' +
      '<div class="gd-effect">' +
        '<span>带兵 <b>' + U.fmt(a.tong * 100) + '</b></span>' +
        '<span>人口上限 <b>+' + U.fmt(a.tong * (DATA.POP_PER_TONG || 1000)) + '</b></span>' +
        /* v54：**全军攻击 / 全军防御从这里撤掉** —— 它们已经进「状态」区（攻击/防御两行），
           同一组数字两个出口就是本项目最经典的失效模式（改一处忘一处）。 */
        '<span>本城产量 <b>+' + a.nz + '%</b></span>' +
        '<span>行军 / 战斗速度 <b>+' + (a.spd || 0) + '</b></span>' +
      '</div>';""",
    """    /* v74（老板需求 4/6）：
       ①「每点作用也作为六维名称的鼠标悬停备注」—— 作用文案进名称格 title
         （守将加成同进 title —— 它原本并排显示在作用列里）；
       ②「就在原来每点作用这一列」放 **＋ 加点按钮**（六维都有：道具或自由点二选一）；
       ③「不要这个备注」—— 下方 带兵 / 人口上限 / 本城产量 / 速度 四行整块撤除
         （人口上限那半条随需求 1 一并下线；其余三行的数字在「状态」区与侧栏已有出口）。 */
    var PLUS_STATS74 = ['tong', 'nz', 'yw', 'zm', 'spd', 'sta'];
    html += '<div class="gp-sec">六维</div>' +
      '<table class="tbl gd-dims"><thead><tr><th>六维</th><th class="ctr">数值</th><th class="ctr">加点</th></tr></thead><tbody>' +
        ui.GEN_DIMS.map(function (d) {
          var tip74 = '每点作用：' + d.use;
          var extra = (gbNow && d.guardUse) ? d.guardUse(gbNow) : '';
          if (extra) tip74 += '\\n' + extra;
          var plus74 = (PLUS_STATS74.indexOf(d.k) >= 0)
            ? '<button class="btn sm gd-plus" data-action="gen-stat-plus" data-gen="' + genId +
              '" data-stat="' + d.k + '" title="' + U.escape('用自由属性点或道具提升' + d.n) + '">＋</button>'
            : '';
          return '<tr><td title="' + U.escape(tip74) + '"><b style="color:' + d.color + ';">' + d.n + '</b></td>' +
            '<td class="ctr gd-v">' + (a[d.val || d.k] || 0) + '</td>' +
            '<td class="ctr gd-u gd-plus-c">' + plus74 + '</td></tr>';
        }).join('') +
        /* v74（老板需求 5）：「增加一行自由属性点，用于玩家自行决定加点」 */
        '<tr class="gd-freep"><td colspan="3">自由属性点 <b class="fp-n">' +
          Math.round(g.freePts || 0) + '</b><span class="gd-free-hint">升级获得（每级 = 成长值）　' +
          '点右侧 ＋ 逐点分配，或用道具</span></td></tr>' +
      '</tbody></table>';""",
    'U2 六维表：悬停 + 加点列 + 自由点行 + 删备注块',
)

# guardUse 改纯文本（只用于 title）
patch(
    UI,
    """    { k: 'tong', n: '统率', color: '#d8b04e', use: '带兵 +100 · 人口上限 +1000' },""",
    """    /* v74（老板需求 1）：「带兵 +100 · 人口上限 +1000」里的**人口上限那半条已撤**
       （人口只由民房决定）；作用文案现在走六维名称的悬停。 */
    { k: 'tong', n: '统率', color: '#d8b04e', use: '带兵 +100' },""",
    'U3a 统率作用文案去人口',
)
patch(
    UI,
    """      guardUse: function (gb) {
        return gb.train ? '<span class="gd-guard">守将 征兵 +' + Math.round(gb.train * 100) + '%</span>' : '';
      } },""",
    """      guardUse: function (gb) {
        return gb.train ? '守将加成：征兵 +' + Math.round(gb.train * 100) + '%' : '';
      } },""",
    'U3b 勇武 guardUse 纯文本',
)
patch(
    UI,
    """      guardUse: function (gb) {
        var p2 = [];
        if (gb.research) p2.push('研究 +' + Math.round(gb.research * 100) + '%');
        if (gb.def) p2.push('城防 +' + Math.round(gb.def * 100) + '%');
        return p2.length ? '<span class="gd-guard">守将 ' + p2.join(' ') + '</span>' : '';
      } },""",
    """      guardUse: function (gb) {
        var p2 = [];
        if (gb.research) p2.push('研究 +' + Math.round(gb.research * 100) + '%');
        if (gb.def) p2.push('城防 +' + Math.round(gb.def * 100) + '%');
        return p2.length ? '守将加成：' + p2.join(' ') : '';
      } },""",
    'U3c 智谋 guardUse 纯文本',
)
patch(
    UI,
    """      guardUse: function (gb) {
        var p2 = [];
        if (gb.prod) p2.push('产量 +' + Math.round(gb.prod * 100) + '%');
        if (gb.build) p2.push('建造 +' + Math.round(gb.build * 100) + '%');
        return p2.length ? '<span class="gd-guard">守将 ' + p2.join(' ') + '</span>' : '';
      } },""",
    """      guardUse: function (gb) {
        var p2 = [];
        if (gb.prod) p2.push('产量 +' + Math.round(gb.prod * 100) + '%');
        if (gb.build) p2.push('建造 +' + Math.round(gb.build * 100) + '%');
        return p2.length ? '守将加成：' + p2.join(' ') : '';
      } },""",
    'U3d 内政 guardUse 纯文本',
)

print()
print('========== ⑤ 加点弹窗 ==========')
patch(
    UI,
    """  /* 切换出征方式（只更新界面，不重开弹窗） */
  ui.setExpMode = function (m) {""",
    """  /* ============================================================
   * 加点弹窗（v74 · 老板需求 4/5）：自由属性点 或 道具，二选一
   * ------------------------------------------------------------
   * 入口 = 六维表「加点」列的 ＋ 按钮。六维都开放：
   *   · 四项主属性 —— 自由点 g[stat]+1；道具走 systems.useItem（perm 型，沿用 50 上限）
   *   · 速度 / 体力 —— 只有自由点（无对应道具；分别落到 spdAdd / staAdd，
   *     由 genAttrs 与 staBaseMax 吃进），**只能加、不能减**（老板明示）。
   * ============================================================ */
  ui.STAT_NAMES74 = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' };
  ui.openStatPlus = function (genId, stat) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var nm = ui.STAT_NAMES74[stat] || stat;
    var a = GAME.genAttrs(g);
    var fp = Math.round(g.freePts || 0);
    var curVal = (stat === 'spd') ? (a.spd || 0) : (stat === 'sta') ? (a.staMax || 0) : (a[stat] || 0);
    var items = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'perm' && it.attr === stat;
    });
    var rows = items.length ? items.map(function (it) {
      var have = (s.items || {})[it.id] || 0;
      var used = (g.perm || {})[it.attr] || 0;
      var capped = used >= 50;
      return '<div class="stat-row"><span class="sr-name">' + GAME.itemIcon(it) + ' ' + U.escape(it.name) +
        ' <i class="gd-sub">×' + have + '</i></span>' +
        '<span class="sr-sub">已用 ' + used + ' / 50</span>' +
        '<button class="btn sm' + (have > 0 && !capped ? ' gold' : ' dim') + '" data-action="stat-plus-item"' +
          ' data-gen="' + genId + '" data-stat="' + stat + '" data-item="' + it.id + '"' +
          (have > 0 && !capped ? '' : ' disabled') +
          ' title="' + (capped ? '该将领此项丹药已达上限 50'
            : (have > 0 ? '使用 1 个：' + nm + ' +1（永久）' : '背包中没有该道具（商城有售）')) + '">＋1</button></div>';
    }).join('') : '<div class="q-empty">此属性暂无对应道具（用自由属性点即可）。</div>';
    ui.openShell({
      title: '＋ ' + nm + ' · ' + U.escape(g.name),
      sub: '自由属性点 ' + fp + '　·　' + nm + ' 现 ' + curVal +
        ui.help('自由属性点：每升 1 级获得 = 资质成长值（凡品 +1 … 天授 +8）。\\n' +
          '只能加、不能减；四项主属性另有永久丹药（商城 · 丹药），每将每项上限 50。'),
      size: 'sm',
      body:
        '<div class="ui-sub">自由属性点</div>' +
        '<div class="stat-row"><span class="sr-name">🎯 消耗 1 点</span>' +
          '<span class="sr-sub">剩 ' + fp + ' 点</span>' +
          '<button class="btn sm' + (fp > 0 ? ' gold' : ' dim') + '" data-action="stat-plus-free"' +
            ' data-gen="' + genId + '" data-stat="' + stat + '"' + (fp > 0 ? '' : ' disabled') +
            ' title="' + (fp > 0 ? nm + ' +1（只增不减）' : '自由属性点不足：升级获得，每级 = 资质成长值') + '">＋1</button></div>' +
        '<div class="ui-sub" style="margin-top:10px;">道具</div>' + rows,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* 切换出征方式（只更新界面，不重开弹窗） */
  ui.setExpMode = function (m) {""",
    'U4 openStatPlus 加点弹窗',
)

print()
print('========== ⑦ 出征界面完善 ==========')
patch(
    UI,
    """    ui._expTarget = target;
    ui._expMode = ui._expMode || 'occupy';
    if (target.kind === 'city') ui._attackNpc = t.npc;""",
    """    ui._expTarget = target;
    /* v74：把**已解析的目标**存一份 —— 兵力总览/战力对比要用守军与城防，
       同一份 resolveTarget 结果直接读，不再各算一遍（两个出口必漂移）。 */
    ui._expRes = t;
    ui._expMode = ui._expMode || 'occupy';
    if (target.kind === 'city') ui._attackNpc = t.npc;""",
    'U5a 出征：存解析目标',
)
patch(
    UI,
    """    /* v18：行军预估（随兵力输入实时更新 —— 由最慢兵种决定，所以填兵后才准） */
    html += '<div class="exp-info" id="exp-march"></div>';""",
    """    /* v18：行军预估（随兵力输入实时更新 —— 由最慢兵种决定，所以填兵后才准）
       v74（老板：完善出征界面）：紧跟两行 ——
         · #exp-sum   兵力总览：共派遣 N 兵 · 耗粮 X/时
         · #exp-power 战力对比：我方 vs 守军（估算，同一套 troopPower 口径） */
    html += '<div class="exp-info" id="exp-march"></div>';
    html += '<div class="exp-info" id="exp-sum"></div>';
    html += '<div class="exp-info" id="exp-power"></div>';""",
    'U5b 出征：总览与战力行',
)
patch(
    UI,
    """    html += '<div class="exp-troops">';
    html += '<div class="ui-sub" style="margin-bottom:6px;">派遣兵力</div>';
    html += troopRows + '</div></div>';""",
    """    html += '<div class="exp-troops">';
    /* v74：全带 / 清空 —— 一格一格点「全」太慢；这两个按钮只改输入框的值，
       统一走 updateExpMarch 的实时口径（不藏第二份状态）。 */
    html += '<div class="ui-sub" style="margin-bottom:6px;display:flex;align-items:center;gap:8px;">派遣兵力' +
      '<button class="btn sm" data-action="exp-fill-all">全带</button>' +
      '<button class="btn sm" data-action="exp-clear-all">清空</button></div>';
    html += troopRows + '</div></div>';""",
    'U5c 出征：全带/清空',
)
patch(
    UI,
    """    var real = GAME.march.travelTime(from, to, army, null, eGen) / GAME.timeScale();
    box.innerHTML = '🛫 行军 <b>' + dist + '</b> 格　速度系数 <b>' + GAME.march.speedText(army, from, to, eGen) + '</b>　'
      + '预计 <b style="color:var(--gold-light)">' + U.durExact(real) + '</b>'
      + (fallback ? '<span style="opacity:.6;">（按城内现有兵种估算）</span>' : '');
  };""",
    """    var real = GAME.march.travelTime(from, to, army, null, eGen) / GAME.timeScale();
    box.innerHTML = '🛫 行军 <b>' + dist + '</b> 格　速度系数 <b>' + GAME.march.speedText(army, from, to, eGen) + '</b>　'
      + '预计 <b style="color:var(--gold-light)">' + U.durExact(real) + '</b>'
      + (fallback ? '<span style="opacity:.6;">（按城内现有兵种估算）</span>' : '');
    /* v74（老板：完善出征界面）：兵力总览 + 战力对比（估算）。
       战力走 STORY.troopPower（与来袭/家底评估同一出口）；
       守军侧对城池/据点吃城防系数（与 defensePowerOf 同一个 defDivisor 常量）。 */
    var sum73 = $('#exp-sum'), pow73 = $('#exp-power');
    if (sum73 || pow73) {
      var tp74 = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
      var n74 = 0, feed74 = 0, mine74 = 0;
      Object.keys(city.army || {}).forEach(function (id) {
        var inp74 = document.getElementById('exp-' + id);
        var v74 = inp74 ? Number(inp74.value) || 0 : 0;
        var tr74 = DATA.TROOPS[id];
        n74 += v74;
        if (tr74) feed74 += v74 * (tr74.food || 0);
        if (tp74) mine74 += v74 * tp74(id);
      });
      if (sum73) {
        sum73.innerHTML = '👥 共派遣 <b>' + U.numText(n74, 0) + '</b> 兵　' +
          '耗粮 <b>' + U.numText(feed74, 0) + '</b>/时' +
          (fallback ? '<span style="opacity:.6;">（未填兵力，按现有兵种展示守军对比）</span>' : '');
      }
      if (pow73) {
        var res74 = ui._expRes;
        var def74 = 0;
        if (res74 && tp74) {
          var div74 = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
          var wall74 = (res74.def || 0) / div74;
          for (var k74 in (res74.garrison || {})) def74 += tp74(k74) * (res74.garrison[k74] || 0);
          def74 = Math.round(def74 * (1 + wall74));
        }
        if (def74 > 0 && mine74 > 0) {
          var ratio74 = mine74 / def74;
          var lv74 = ratio74 >= 1.6 ? ['兵力充足', 'var(--green-ok)']
            : ratio74 >= 1.0 ? ['势均力敌', 'var(--gold-light)']
            : ratio74 >= 0.6 ? ['兵力偏少', 'var(--amber, #e0a83c)']
            : ['兵力悬殊', 'var(--red-light)'];
          pow73.innerHTML = '⚔️ 战力估算　我方 <b style="color:var(--blue-info)">' + U.numText(mine74, 0) +
            '</b>　vs　守军 <b style="color:var(--red-light)">' + U.numText(def74, 0) + '</b>' +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '（' +
            (Math.round(ratio74 * 100) / 100) + ' : 1）</span>' +
            '<span style="opacity:.6;">　估算口径：兵种属性加权，守方含城防</span>';
        } else {
          pow73.innerHTML = '⚔️ 战力估算　' + (mine74 > 0 ? '守军兵力未知' : '填入兵力后显示对比');
        }
      }
    }
  };""",
    'U5d 出征：总览与战力实时计算',
)

print()
print('========== ⑦+ 动作分发（main.js） ==========')
patch(
    MAIN,
    """  /* 募兵加速（v28 · 需求 8）：消费宝物 → 缩短该营当前批次 */""",
    """  /* v74（老板需求 5）：自由属性点分配（唯一出口 GAME.addFreePoint）；分配后留在弹窗里刷新 */
  GAME.doStatPlusFree = function (genId, stat) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var r = GAME.addFreePoint(g, stat);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openStatPlus(genId, stat); }
  };
  /* v74：用永久丹药加点（复用 useItem 的 perm 分支与 50 上限） */
  GAME.doStatPlusItem = function (itemId, genId, stat) {
    var r = GAME.systems.useItem(itemId, genId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openStatPlus(genId, stat); }
  };
  /* 募兵加速（v28 · 需求 8）：消费宝物 → 缩短该营当前批次 */""",
    'M1 doStatPlus* 实现',
)
patch(
    MAIN,
    """      case 'gen-exp-pick': ui.openExpPick(el.dataset.gen); break;""",
    """      case 'gen-exp-pick': ui.openExpPick(el.dataset.gen); break;
      /* v74（老板需求 4/5）：六维「加点」＋ —— 自由属性点或道具 */
      case 'gen-stat-plus': ui.openStatPlus(el.dataset.gen, el.dataset.stat); break;
      case 'stat-plus-free': GAME.doStatPlusFree(el.dataset.gen, el.dataset.stat); break;
      case 'stat-plus-item': GAME.doStatPlusItem(el.dataset.item, el.dataset.gen, el.dataset.stat); break;
      /* v74（老板：完善出征界面）：全带 / 清空（只改输入框值，刷新仍走 updateExpMarch） */
      case 'exp-fill-all': (function () {
        var c74 = GAME.currentCity();
        Object.keys((c74 && c74.army) || {}).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (i74) i74.value = i74.max;
        });
        ui.updateExpMarch();
      })(); break;
      case 'exp-clear-all': (function () {
        var c74 = GAME.currentCity();
        Object.keys((c74 && c74.army) || {}).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (i74) i74.value = 0;
        });
        ui.updateExpMarch();
      })(); break;""",
    'M2 分发：加点与全带/清空',
)

print()
print('========== ② 固定像素画布（index.html） ==========')
patch(
    HTML,
    """  body {
    font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "SimSun", serif;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(201,162,75,.10), transparent 55%),
      linear-gradient(180deg, var(--bg-dark) 0%, var(--bg-2) 60%, var(--bg-3) 100%);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }""",
    """  /* v74（老板需求 2）：「规定大界面像素，推动浏览器边框时，界面内容不要随之移动。
     作为一个整体界面」——大界面即**固定像素画布**：
       · 画布尺寸 = --app-w × --app-h（改尺寸只改这两个数，其余派生布局自动跟着走）；
       · 窗口更大 → 画布水平居中、垂直靠上（留边，不拉伸）；
       · 窗口更小 → 页面滚动，画布内部一格不重排（v27/v43 的视口断点已全部撤除）。
     原 `min-height: 100vh` 与 `overflow-x: hidden` 一并撤除 ——
     前者让 body 高度随窗口走；后者会把窄窗口下的画布右半边**裁掉**（够不着）。 */
  html { --app-w: 1440px; --app-h: 900px; }

  body {
    font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "SimSun", serif;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(201,162,75,.10), transparent 55%),
      linear-gradient(180deg, var(--bg-dark) 0%, var(--bg-2) 60%, var(--bg-3) 100%);
    color: var(--text);
  }""",
    'H1 固定画布变量 + body 撤 vh/hidden',
)
patch(
    HTML,
    """  #screen-game { height: 100%; display: flex; flex-direction: column; }""",
    """  /* v74：游戏画布 = 固定像素（见 --app-w / --app-h 注释）；水平居中、垂直靠上 */
  #screen-game { width: var(--app-w); height: var(--app-h); margin: 0 auto;
    display: flex; flex-direction: column; }""",
    'H2 #screen-game 固定尺寸',
)
patch(
    HTML,
    """  .modal {
    width: 660px; height: 620px; max-width: 96vw; max-height: 86vh;
    position: relative; overflow: hidden;
  }
  /* v25（需求 4）：弹窗宽度按平板收（1024 宽下 lg 不再贴边） */
  .modal-sm { width: 440px; height: 420px; }
  .modal-lg { width: 860px; max-width: 94vw; height: 600px; max-height: 88vh; }""",
    """  /* v74（老板需求 2）：弹窗尺寸**改成固定像素**（不再随视口 vw/vh 缩放）——
     画布是死的，弹窗在画布里就应该是死的。
     仅保留一道**极小窗口兜底**（100vw/vh − 20px）：窗口比画布还小时不至于被裁到够不着。
     原先的「视口不足自动降档」@media (max-height: 860px) 一并撤除。 */
  .modal {
    width: 660px; height: 620px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px);
    position: relative; overflow: hidden;
  }
  .modal-sm { width: 440px; height: 420px; }
  .modal-lg { width: 860px; height: 600px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }""",
    'H3 弹窗尺寸固定（md/lg）',
)
patch(
    HTML,
    """  .modal-xl { width: 960px; max-width: 94vw; height: min(700px, 88vh); max-height: 90vh; }
  /* 视口不够高时自动降档（「不超界」是硬约束） */
  @media (max-height: 860px) {
    .modal, .modal-lg { height: 78vh; }
    /* v51：88vh → 90vh（与 `.modal-xl` 的 max-height 对齐）。
       768 高的屏上 88vh = 676 → 正文 509，而打造面板两行卡片的内容高 515：
       **差 6px 就又出滚动条**。90vh = 691 → 正文 524，留出 9px 余量。
       90vh 仍是"不超出视口"，硬约束没破（弹窗居中后上下各留 ~38px）。 */
    .modal-xl { height: 90vh; }
    .modal-sm { height: 62vh; }
  }""",
    """  /* v74：xl 也改固定 960×700（画布 1440×900 内稳装）；兜底同 md/lg */
  .modal-xl { width: 960px; height: 700px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }""",
    'H4 弹窗尺寸固定（xl）+ 撤降档',
)
patch(
    HTML,
    """  @media (max-width: 900px) { .q-grid { grid-template-columns: 1fr; } }""",
    """  /* v74：视口断点已撤（@media (max-width: 900px) .q-grid）——画布固定，不做窄窗重排 */""",
    'H5 撤断点 q-grid',
)
patch(
    HTML,
    """  @media (max-width: 820px) { .eq-doll-wrap { grid-template-columns: 1fr; } }""",
    """  /* v74：视口断点已撤（@media (max-width: 820px) .eq-doll-wrap） */""",
    'H6 撤断点 eq-doll-wrap',
)
patch(
    HTML,
    """  @media (max-width: 900px) { .story-grid { grid-template-columns: 1fr; } }""",
    """  /* v74：视口断点已撤（@media (max-width: 900px) .story-grid） */""",
    'H7 撤断点 story-grid',
)
patch(
    HTML,
    """  @media (max-width: 860px) { .gdet-grid { grid-template-columns: 1fr; } }""",
    """  /* v74：视口断点已撤（@media (max-width: 860px) .gdet-grid） */""",
    'H8 撤断点 gdet-grid',
)
patch(
    HTML,
    """  @media (max-width: 1300px) {
    .gp-doll { grid-template-columns: minmax(0, 1fr); }
  }
  @media (max-width: 1100px) {
    .gen-split { grid-template-columns: 1fr; }      /* 左清单挪到档案上方，各占整宽 */
  }
  @media (max-width: 900px) {
    .gen-split { grid-template-columns: 1fr; }
    .gp-body { grid-template-columns: 1fr; }
    .gp-doll { grid-template-columns: 1fr; }
  }""",
    """  /* v74：将领档案的 1300/1100/900 三档视口断点全部撤除 ——
     画布固定后，这些"窄窗重排"永不触发（留着反而是随窗口移动的隐患）。 */
  .gp-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }""",
    'H9 撤将领断点 + 属性/装备对半',
)
patch(
    HTML,
    """  @media (max-width: 900px) {
    .main { grid-template-columns: 1fr; }
    .auth-side { position: static; }
    .city-grid { grid-template-columns: repeat(4, 1fr); }
    .troop-grid { grid-template-columns: repeat(2, 1fr); }
    .create-inner { grid-template-columns: 1fr; }
    .topnav .tab { padding: 6px 9px; font-size: var(--fs-body); }
  }""",
    """  /* v74：主布局的 900px 断点已撤（.main 1fr / .auth-side static / 各网格降列）——
     画布固定 1440 宽，这些"窄窗降列"规则不再需要，留着只会随窗口挪动内容。 */""",
    'H10 撤主布局断点',
)

print()
print('========== ④⑤⑥ 新增样式（index.html） ==========')
patch(
    HTML,
    """  .gd-dims .gd-u { color: var(--text-dim); font-size: var(--fs-sub); line-height: 1.5; }

  .gd-effect { display: flex; flex-wrap: wrap; gap: 5px 16px;
    font-size: var(--fs-sub); color: var(--text-dim); }
  .gd-effect b { color: var(--gold-light); font-variant-numeric: tabular-nums; margin-left: 3px; }
""",
    """  .gd-dims .gd-u { color: var(--text-dim); font-size: var(--fs-sub); line-height: 1.5; }
  /* v74（老板需求 4）：加点列的 ＋ 按钮（原来这里是"每点作用"文字列；
     作用文案已进六维名称的悬停）。 */
  .gd-dims .gd-plus-c { padding-right: 4px; }
  .gd-dims .gd-plus { padding: 0 8px; line-height: 1.5; }
  /* v74（老板需求 5）：自由属性点行（表末整行） */
  .gd-freep td { border-top: 1px dashed var(--line-strong); color: var(--text-dim);
    font-size: var(--fs-sub); padding: 5px 6px 5px 8px; }
  .gd-freep .fp-n { color: var(--gold-light); font-size: var(--fs-lead); font-weight: 800;
    margin: 0 6px; font-variant-numeric: tabular-nums; }
  .gd-freep .gd-free-hint { margin-left: 6px; opacity: .75; }
  /* v74（老板需求 3）：类型签（均衡 / 猛将…）与非空闲状态小签 */
  .gp-style { display: inline-block; margin-left: 8px; color: var(--text-dim); font-size: var(--fs-cap); }
  .gp-stag { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 4px;
    font-size: var(--fs-cap); color: var(--gold-light); background: rgba(var(--gold-rgb),.14); }
  /* v74（老板需求 5）：加点弹窗行（自由点 / 道具） */
  .stat-row { display: flex; align-items: center; gap: 8px; justify-content: space-between;
    background: rgba(var(--sh-rgb),.22); border: 1px solid var(--line-strong);
    border-radius: var(--r-md); padding: 8px 10px; margin: 6px 0; }
  .stat-row .sr-name { font-weight: 700; color: var(--gold-light); }
  .stat-row .sr-sub { color: var(--text-dim); font-size: var(--fs-sub); flex: 1; }

  /* v74：`.gd-effect`（带兵/人口/产量/速度 四行备注）随老板需求 6 整块撤除 —— 样式同步下线。 */
""",
    'H11 加点/自由点样式 + gd-effect 样式下线',
)

print()
print('========== UI 层补丁完成 ==========')
