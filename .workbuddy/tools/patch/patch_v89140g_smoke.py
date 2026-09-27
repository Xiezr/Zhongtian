# -*- coding: utf-8 -*-
"""v89.140 批六：smoke 断言跟随（23 条：口径变更 / 结构重排 / 退役件）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag, exp=1):
    global s
    cnt = s.count(old)
    assert cnt == exp, '%s 锚点命中 %d 次（期望 %d）' % (tag, cnt, exp)
    s = s.replace(old, new)
    ok.append(tag)


# ① 铁匠铺入口（数组）
rep("""    check('铁匠铺入口指向打造', /tiejiangpu: \\{ label: "⚒️ 打造", act: "open-forge" \\}/.test(uiSrc24));""",
"""    check('铁匠铺入口 = 打造 + 百炼强化（v89.140 老板 4：双按钮）',
      /tiejiangpu: \\[\\{ label: "⚒️ 打造", act: "open-forge" \\}/.test(uiSrc24)
      && /"⚒️ 百炼强化", act: "open-enhance"/.test(uiSrc24));""",
    '铁匠铺入口')

# ② 背包 7 格
rep("""  check('背包为每行 4 格', /\\.bag-grid \\{ display: grid; grid-template-columns: repeat\\(4, minmax\\(0, 1fr\\)\\)/.test(htmlSrc24b));""",
"""  /* v89.140（老板 7）：每行 7 格（"按每行可为 7 个物品并列的宽度设计"） */
  check('背包为每行 7 格', /\\.bag-grid \\{ display: grid; grid-template-columns: repeat\\(7, minmax\\(0, 1fr\\)\\)/.test(htmlSrc24b));""",
    '背包 7 格')

# ③ open-xiaochang 关菜单（2 处）
rep("""/case 'open-xiaochang': ui\\.setView\\('marches'\\); ui\\._marchTab = 'over';/""",
"""/case 'open-xiaochang': ui\\.closeAllModals\\(\\); ui\\.setView\\('marches'\\); ui\\._marchTab = 'over';/""",
    '校场关菜单')
rep("""/case 'open-xiaochang': ui\\.setView\\('marches'\\)/""",
"""/case 'open-xiaochang': ui\\.closeAllModals\\(\\); ui\\.setView\\('marches'\\)/""",
    '§114⑥ 校场关菜单')

# ④ 下拉白名单：am-troops → am-a-<tid>
rep("""      && /bind\\('am-troops', 'troops'\\)/.test(all) && /bind\\('am-radius', 'radius'\\)/.test(all)""",
"""      /* v89.140（老板 7'）：单次兵力退役 → 逐兵种输入框（am-a-<tid>） */
      && /id="am-a-' \\+ id \\+ '"/.test(all) && /bind\\('am-radius', 'radius'\\)/.test(all)""",
    '白名单 am-a-')

# ⑤ 距离公式：MARGIN → ×FIELD_RANGE_K
rep("""    var eff = function (a, b) {
      return Math.max(T.FIELD_MIN, Math.max(raw(a), raw(b)) + T.FIELD_MARGIN,
        Math.round((spd(a) + spd(b)) * T.MARCH_ROUNDS_MIN));
    };""",
"""    var eff = function (a, b) {
      /* v89.140：射程项 = maxR × FIELD_RANGE_K（比例式，取代 +MARGIN） */
      return Math.max(T.FIELD_MIN, Math.round(Math.max(raw(a), raw(b)) * T.FIELD_RANGE_K),
        Math.round((spd(a) + spd(b)) * T.MARCH_ROUNDS_MIN));
    };""",
    '距离 eff 比例式')
rep("""  check('战场距离 = max(最远射程+MARGIN, (双方最快速度和)×MARCH_ROUNDS_MIN, FIELD_MIN)（v89.139 速度参与）', (function () {""",
"""  check('战场距离 = max(最远射程×FIELD_RANGE_K, (双方最快速度和)×MARCH_ROUNDS_MIN, FIELD_MIN)（v89.140 比例式）', (function () {""",
    '距离断言标题')

# ⑥ 抛射：原版公开值 → 新口径
rep("""  var w = (G.story && G.story.combatMod) ? G.story.combatMod().archerRange : 1;
  var eff = function (id) { return Math.round(DATA.TROOPS[id].range * k * w) + G.tactic.FIELD_MARGIN; };
  var ok = t.per === 0.05 && Math.abs(k - 1.5) < 1e-9
    && D('gongjian') === eff('gongjian') && D('chuangnu') === eff('chuangnu')
    && D('toudan') === eff('toudan')
    /* 与原版公开实测值对上（不含天气修正的纯算术）：
       满抛射弓 1999 / 床弩 2299 / 投石 2599 */
    && Math.round(1200 * k) + 199 === 1999
    && Math.round(1400 * k) + 199 === 2299
    && Math.round(1600 * k) + 199 === 2599;""",
"""  var w = (G.story && G.story.combatMod) ? G.story.combatMod().archerRange : 1;
  var K0 = G.tactic.FIELD_RANGE_K;
  /* v89.140（老板 1）：射程项由"+199"改为"×1.25"（比例式） */
  var eff = function (id) {
    return Math.max(G.tactic.FIELD_MIN, Math.round(Math.round(DATA.TROOPS[id].range * k * w) * K0));
  };
  var ok = t.per === 0.05 && Math.abs(k - 1.5) < 1e-9 && K0 === 1.25
    && D('gongjian') === eff('gongjian') && D('chuangnu') === eff('chuangnu')
    && D('toudan') === eff('toudan')
    /* 新口径下的满抛射量级（与旧公开值同阶）：弓 2250 / 床弩 2625 / 投石 3000 */
    && Math.round(Math.round(1200 * k) * K0) === 2250
    && Math.round(Math.round(1400 * k) * K0) === 2625
    && Math.round(Math.round(1600 * k) * K0) === 3000;""",
    '抛射新口径')
rep("""  var txt = '满抛射 ×' + k.toFixed(2) + '（天气 ×' + w + '）：弓 ' + D('gongjian') + ' / 床弩 ' +
    D('chuangnu') + ' / 投石 ' + D('toudan') + '　无天气时 = 1999 / 2299 / 2599（原版公开值）';""",
"""  var txt = '满抛射 ×' + k.toFixed(2) + '（天气 ×' + w + '）：弓 ' + D('gongjian') + ' / 床弩 ' +
    D('chuangnu') + ' / 投石 ' + D('toudan') + '　无天气时 = 2250 / 2625 / 3000（×1.25 口径）';""",
    '抛射诊断文案')

# ⑦ 箭塔：+MARGIN → ×K
rep("""    return city >= melee && city0 === melee
      && city === Math.max(melee, Math.round(T.wallFireRangeRaw(200, 8)) + T.FIELD_MARGIN);""",
"""    return city >= melee && city0 === melee
      && city === Math.max(melee, Math.round(T.wallFireRangeRaw(200, 8) * T.FIELD_RANGE_K));""",
    '箭塔比例式')

# ⑧ 两处列表 4 列 → 7 列
rep("""    && (css.match(/\\.bag-grid \\{ display: grid; grid-template-columns: repeat\\(4,/g) || []).length === 1);""",
"""    && (css.match(/\\.bag-grid \\{ display: grid; grid-template-columns: repeat\\(7,/g) || []).length === 1);""",
    '两处列表 7 列')

# ⑨ 宝物说明只出现一次（商城 desc 已悬停 → 查整段）
rep("""    var st = G.newGame({ name: '去重' });
    G.ui._shopCat = 'jewel';
    var h = G.ui.shopHTML();
    var seg = h.slice(h.indexOf('珍珠'));
    seg = seg.slice(0, seg.indexOf('item-row'));
    var n = (seg.match(/赏赐忠诚 \\+5/g) || []).length;
    return n === 1;""",
"""    var st = G.newGame({ name: '去重' });
    G.ui._shopCat = 'jewel';
    var h = G.ui.shopHTML();
    /* v89.140（老板 6）：简介改悬停（title）后，卡片里该文案**恰好一次**（title 里那一次）；
       改前"卡面 desc + 别处"出现 3 次。整段数最稳（不再依赖卡内切片位置）。 */
    var n = (h.match(/赏赐忠诚 \\+5/g) || []).length;
    return n === 1;""",
    '宝物说明一次')

# ⑩ openAutoMarch 渲染：10 → 9 下拉 + 兵种输入框
rep("""      /* v89.83：八项 → 十项（新增 距离 / 计略 / 出征战术；退役 留守） */
      ok = nSel === 10
        && has('am-gen') && has('am-target') && has('am-level') && has('am-radius')
        && has('am-mode') && has('am-scheme') && has('am-tactic')
        && has('am-troops') && has('am-freq') && has('am-daily')""",
"""      /* v89.83：八项 → 十项（距离 / 计略 / 出征战术；退役 留守）
         v89.140：退役 单次兵力（am-troops）→ **九项** + 逐兵种输入框（am-a-<tid>） */
      ok = nSel === 9
        && has('am-gen') && has('am-target') && has('am-level') && has('am-radius')
        && has('am-mode') && has('am-scheme') && has('am-tactic')
        && has('am-a-changqiang') && has('am-freq') && has('am-daily')""",
    'openAutoMarch 九项')
rep("""        /* 编成表必须把**全部**兵种列上（不是只列城里有兵的） */
        && Object.keys(DATA.TROOPS).every(function (id) {
          var t = DATA.TROOPS[id];
          return html.indexOf(U.escape(t.name || id)) >= 0;
        });""",
"""        /* 编成表列出全部**可编入**兵种（v89.140：与 autoMarchPickArmy 同口径过滤器械/斥候/辎重） */
        && Object.keys(DATA.TROOPS).filter(function (id) {
          var t = DATA.TROOPS[id];
          return t && !t.nocombat && !t.craft;
        }).every(function (id) {
          var t = DATA.TROOPS[id];
          return html.indexOf(U.escape(t.name || id)) >= 0;
        });""",
    'openAutoMarch 编成过滤')

# ⑪ 宝物页：qtyInput 退役 → bagCell + route 分流
rep("""      return seg.indexOf('genChips') < 0 && /ui\\.ITEM_USE_ROUTE = \\{/.test(u4)
        && /route\\.direct \\? ui\\.qtyInput/.test(seg) && /bag-go/.test(seg);""",
"""      /* v89.140（老板 7）：行卡片退役 → 统一 bagCell（7 列）；动作仍按 ITEM_USE_ROUTE 分流 */
      return seg.indexOf('genChips') < 0 && /ui\\.ITEM_USE_ROUTE = \\{/.test(u4)
        && /ui\\.bagCell\\(cell\\)/.test(seg) && /cell\\.act = 'use-bag-item'/.test(seg)
        && /cell\\.act = 'bag-go'/.test(seg);""",
    '宝物页 bagCell')

# ⑫ 战场列宽（2 处）
rep("""/\\.bt-board \\{ display: grid; grid-template-columns: 1\\.5fr 3fr 1\\.5fr;/""",
"""/\\.bt-board \\{ display: grid; grid-template-columns: 1\\.1fr 3\\.8fr 1\\.1fr;/""",
    '战场列宽 x2', exp=2)
rep("""    check('⑧ 上部分三列：v89.139 两侧改 2 列网格 → 列宽 1.5fr 3fr 1.5fr（v89.117 曾为 1fr 4fr 1fr）', (function () {""",
"""    check('⑧ 上部分三列：v89.140 侧栏去图标后改 1.1fr 3.8fr 1.1fr（战场更宽）', (function () {""",
    '⑧ 列宽标题')
rep("""    check('⑦ 三列 1.5fr 3fr 1.5fr（v89.139：两侧 2 列网格，各占 1/4）',""",
"""    check('⑦ 三列 1.1fr 3.8fr 1.1fr（v89.140：侧栏收窄、战场放宽）',""",
    '⑦ 列宽标题')

# ⑬ 战场"只画图标"：bt-ric 退役 → bt-l1/bt-l2
rep("""      return /class="bt-unit /.test(tok) && tok.indexOf('bt-n') < 0 && tok.indexOf('bt-nm') < 0
        && /class="bt-ric"/.test(u96) && /id="bt-n-' \\+ side \\+ '-' \\+ u\\.id/.test(u96);""",
"""      /* v89.140（老板 1）：侧栏去图标 → 两行制（名称+动作 / 数量+目标），数量仍在 bt-n-<side>-<id> */
      return /class="bt-unit /.test(tok) && tok.indexOf('bt-n') < 0 && tok.indexOf('bt-nm') < 0
        && /class="bt-l1"/.test(u96) && /class="bt-l2"/.test(u96)
        && /id="bt-n-' \\+ side \\+ '-' \\+ u\\.id/.test(u96);""",
    '战场两行制')

# ⑭ 底部打造键：百炼已搬走
rep("""    check('④ 底部**唯一**打造键（动作名仍 forge-item）+ 与百炼强化同栏', (function () {
      var h = G.ui.openForge, s2 = u97.slice(u97.indexOf('ui.openForge = function'));
      s2 = s2.slice(0, s2.indexOf('ui.openForgeSetInfo = function'));
      var n = (s2.match(/data-action="forge-item"/g) || []).length;
      return n === 1 && /open-enhance/.test(s2) && /先在下方点选一件/.test(s2);
    })());""",
"""    check('④ 底部**唯一**打造键（动作名仍 forge-item）· v89.140 百炼已搬去建筑菜单 · 分页在底部', (function () {
      var s2 = u97.slice(u97.indexOf('ui.openForge = function'));
      s2 = s2.slice(0, s2.indexOf('ui.openForgeSetInfo = function'));
      var n = (s2.match(/data-action="forge-item"/g) || []).length;
      return n === 1 && s2.indexOf('data-action="open-enhance"') < 0
        && /先在下方点选一件/.test(s2)
        && /foot: '<div class="m-foot">' \\+ \\(rows\\.length \\? pg\\.pager : ''\\)/.test(s2);
    })());""",
    '底部打造键')

# ⑮ §113①：军务三段
rep("""        return h.indexOf('⑤ 两营') < 0 && h.indexOf('伤兵营') < 0 && h.indexOf('俘虏营') < 0
          && h.indexOf('① 城内') >= 0 && h.indexOf('② 驻守野地') >= 0
          && h.indexOf('③ 采集队') >= 0 && h.indexOf('④ 行军') >= 0""",
"""        /* v89.140（老板 2）：驻守野地 / 采集队两块退役 → 三段（① 城内 / ② 征战中 / ③ 行军），
           且顶部统计行整体撤除（在城/驻守/采集/行军/征战那一行） */
        return h.indexOf('⑤ 两营') < 0 && h.indexOf('伤兵营') < 0 && h.indexOf('俘虏营') < 0
          && h.indexOf('① 城内') >= 0 && h.indexOf('② 驻守野地') < 0
          && h.indexOf('③ 采集队') < 0 && h.indexOf('行军') >= 0
          && h.indexOf('在城 ') < 0""",
    '军务三段')

# ⑯ §118③ / §119⑥：log 高度 336→250、min 140→130
rep("""        && /\\.bt-log \\{ flex: 1 1 336px; max-height: none; min-height: 140px;/.test(h118)""",
"""        && /\\.bt-log \\{ flex: 1 1 250px; max-height: none; min-height: 130px;/.test(h118)""",
    '§118③ log 高度')
rep("""        && /\\.bt-log \\{ flex: 1 1 336px; max-height: none; min-height: 140px;/.test(h);""",
"""        && /\\.bt-log \\{ flex: 1 1 250px; max-height: none; min-height: 130px;/.test(h);""",
    '§119⑥ log 高度')

# ⑰ §120②：新结构（只在场 · 两行制）
rep("""    check('§120② 战场侧栏 2 列：全兵种列出（nocombat 除外）· 参战亮/未战 off · 去掉副标题', (function () {
      var body = uc.slice(uc.indexOf('ui.btSideHTML = function'), uc.indexOf('ui.btSideHTML = function') + 4200);
      return /Object\\.keys\\(DATA\\.TROOPS\\)\\.filter/.test(body)
        && /!DATA\\.TROOPS\\[k\\]\\.nocombat/.test(body)
        && /class="bt-card off"/.test(body)
        && /class="bt-cards"/.test(body)
        && /ui\\.btSideName\\(side\\) \\+ '（' \\+ myList\\.length \\+ ' \\/ ' \\+ ALL\\.length/.test(body)
        && /_openToast/.test(body) === false""",
"""    check('§120② 战场侧栏：v89.140 只列**在场**兵种 · 两行制（名+动作 / 数+目标）· 无图标', (function () {
      var body = uc.slice(uc.indexOf('ui.btSideHTML = function'), uc.indexOf('ui.btSideHTML = function') + 4200);
      return /var rows = myList\\.map\\(function \\(u\\)/.test(body)     /* 只遍历在场 */
        && /class="bt-l1"/.test(body) && /class="bt-l2"/.test(body)
        && /ui\\.btSideName\\(side\\) \\+ '（' \\+ myList\\.length \\+ ' 队）'/.test(body)
        && /bt-ico/.test(body) === false                                /* 图标退役 */
        && /_openToast/.test(body) === false""",
    '§120② 新结构')
rep("""      var snap = {
        field: 1800, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance' },
          { id: 'gongjian', name: '弓箭手', count: 50, stance: 'advance' }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance' }]
      };
      var html = G.ui.btSideHTML(snap, 'atk');
      var nOff = (html.match(/class="bt-card off"/g) || []).length;
      var nOn = (html.match(/class="bt-card"/g) || []).length
        + (html.match(/class="bt-card dead"/g) || []).length;
      var all = Object.keys(DATA.TROOPS).filter(function (k) { return !DATA.TROOPS[k].nocombat; }).length;
      return nOn === 2 && nOff === all - 2 && html.indexOf('2 / ' + all + ' 兵种参战') >= 0;""",
"""      var snap = {
        field: 1800, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance' },
          { id: 'gongjian', name: '弓箭手', count: 50, stance: 'advance' }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance' }]
      };
      var html = G.ui.btSideHTML(snap, 'atk');
      /* v89.140：只列在场（2 格 = 长枪 + 弓）· 无 off 灰暗格 · 表头 N 队 */
      var nOn = (html.match(/class="bt-card"/g) || []).length
        + (html.match(/class="bt-card dead"/g) || []).length;
      return nOn === 2 && html.indexOf('class="bt-card off"') < 0
        && html.indexOf('（2 队）') >= 0;""",
    '§120② 实测')

# ⑱ §120③：比例式
rep("""    check('§120③ 距离三下限：射程+MARGIN · (速度和)×MARCH_ROUNDS_MIN · FIELD_MIN(=1400)', (function () {
      var T = G.tactic;
      return T.MARCH_ROUNDS_MIN === 2 && T.FIELD_MIN === 1400 && T.FIELD_MARGIN === 299
        && /var fastA = 0, fastD = 0;/.test(tc)
        && /var spdFloor = Math\\.round\\(\\(fastA \\+ fastD\\) \\* T\\.MARCH_ROUNDS_MIN\\);/.test(tc)
        && /Math\\.max\\(T\\.FIELD_MIN, Math\\.round\\(maxR\\) \\+ T\\.FIELD_MARGIN, spdFloor\\)/.test(tc);
    })());""",
"""    check('§120③ 距离三下限：射程×K · (速度和)×MARCH_ROUNDS_MIN · FIELD_MIN(=1400)（v89.140 比例式）', (function () {
      var T = G.tactic;
      return T.MARCH_ROUNDS_MIN === 2 && T.FIELD_MIN === 1400 && T.FIELD_RANGE_K === 1.25
        && /var fastA = 0, fastD = 0;/.test(tc)
        && /var spdFloor = Math\\.round\\(\\(fastA \\+ fastD\\) \\* T\\.MARCH_ROUNDS_MIN\\);/.test(tc)
        && /Math\\.max\\(T\\.FIELD_MIN, Math\\.round\\(maxR \\* T\\.FIELD_RANGE_K\\), spdFloor\\)/.test(tc);
    })());""",
    '§120③ 比例式')

assert '\r\n' not in s
tmp = p + '.tmp140'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
print('✅ smoke-test.js：%d → %d 字节' % (n0, len(chk)))
print('段：' + ' / '.join(ok))
