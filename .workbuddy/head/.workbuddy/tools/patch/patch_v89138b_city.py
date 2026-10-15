# -*- coding: utf-8 -*-
"""v89.138 补丁 B：ui.js + main.js —— 城池菜单（老板 2）
  ui：① 底栏改造（进入城池/派遣/运输/节钺扩编[讲透]/放弃城池；删 度支归集·将领派遣·改名）
      ② openExpModal 加 opts.hint（派遣/运输差异化提示）
      ③ doExpConfirm：本境调运允许 0 兵（只派将）
      ④ openAbandonCityAsk：两段确认（上膛式）
      ⑤ openDispatch / doDispatch / setDpGen / setDpTo 整条退役
  main：⑥ city-enter 进城内界面 ⑦ 新增 city-dispatch-exp / city-abandon-arm
        ⑧ 删 budget-gather / city-dispatch / city-rename / dp-gen / dp-to / dp-do
"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

def patch_file(path, old, new, tag):
    s = io.open(path, 'r', encoding='utf-8', newline='').read()
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    assert '\r\n' not in s, '行尾混入 CRLF'
    tmp = path + '.tmp138'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, path)
    ok.append(tag)
    print('  ✓ ' + tag)

U = os.path.join(ROOT, 'js', 'ui.js')
M = os.path.join(ROOT, 'js', 'main.js')

# ══════════ ① 城池菜单底栏 ══════════
patch_file(U,
"""      foot: '<div class="m-foot">' +
        (isOwn
          ? '<button class="btn gold" data-action="city-enter" data-city="' + city.id + '">进入城池</button>' +
            '<button class="btn" data-action="city-transport" data-city="' + city.id + '"' +
              ' title="' + U.escape('本境调运：兵力 + 辎重一起走行军通道（在出征界面填兵种与资源数量）')
              + '">🚚 调兵 · 运输</button>' +
            /* v89.93（整改 E11）：度支归集 —— 一键把其他城的**结余黄金**汇到本城 */
            ((s.cities || []).length > 1
              ? '<button class="btn" data-action="budget-gather" data-city="' + city.id +
                '" title="把其他城池的结余黄金汇入本城（每城保留 ' + U.fmt(GAME.budgetKeep || 50000) +
                ' 金）。黄金是货币，不走运输损耗。">🏛 度支归集</button>'
              : '') +
            '<button class="btn" data-action="city-dispatch" data-city="' + city.id + '">将领派遣</button>' +
            /* v89.95（A1）：节钺扩编 —— 每城 +1 建造位（至多 2 次），消耗 1 枚节钺 */
            '<button class="btn" data-action="jieyue-expand" data-city="' + city.id +
              '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
                + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺扩编 · 建造位 +1（' +
              ((city.jieyueSlots || 0) >= ((DATA.JIEYUE || {}).citySlotMax || 2)
                ? '本城已满 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                : '本城 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                  + '　持符 ' + GAME.jieyueOf()) + '</button>' +
            '<button class="btn" data-action="city-rename" data-city="' + city.id + '">改名</button>'
          : '') +""",
"""      /* ============================================================
       * v89.138（老板 2）：「调兵·运输，将领派遣**合并成"派遣"和"运输"**，均进入出征界面
       *   设定将领和兵种以及携带的资源。**去掉度支归集**。…**去掉改名**菜单。
       *   放弃城池菜单**增加二次确认**。」
       * ------------------------------------------------------------
       * · 派遣 / 运输 = 同一出征界面的两个入口（带各自的操作提示，见 openExpModal 的 opts.hint）——
       *   派遣 = 兵/将随军入城（可不带货）；运输 = 押运资源（先选兵，再填辎重）；
       * · 「将领派遣」独立面板（openDispatch）与「度支归集」「改名」整条退役 ——
       *   改名在**官府面板**（open-rename-city）仍有入口，功能不丢；
       * · 节钺扩编：悬停**第一行先讲"这是干什么用的"**（老板问过一次，说明原文案没讲透）。
       * ============================================================ */
      foot: '<div class="m-foot">' +
        (isOwn
          ? '<button class="btn gold" data-action="city-enter" data-city="' + city.id + '">进入城池</button>' +
            '<button class="btn" data-action="city-dispatch-exp" data-city="' + city.id + '"' +
              ' title="' + U.escape('派遣：把兵力 / 将领调往本城 —— 在出征界面选主将 + 兵种，抵达即入城（不带货也可发）')
              + '">🛡️ 派遣</button>' +
            '<button class="btn" data-action="city-transport" data-city="' + city.id + '"' +
              ' title="' + U.escape('运输：把资源运往本城 —— 在出征界面先选押运兵力（运力随兵力涨），再到辎重区填资源')
              + '">🚚 运输</button>' +
            /* v89.95（A1）· v89.138：节钺扩编 —— 悬停第一行先答"干什么用的" */
            '<button class="btn" data-action="jieyue-expand" data-city="' + city.id +
              '" title="' + U.escape('【扩编】给本城 +1 个建造位（同时可建工程数 +1，每城至多 '
                + ((DATA.JIEYUE || {}).citySlotMax || 2) + ' 次）—— 消耗 1 枚「节钺」。\\n'
                + '节钺是君主符节（' + (GAME.jieyueTextOf ? GAME.jieyueTextOf() : '') + '）：黄金买不到，'
                + '首占名城 / 完成特定功业才得；共 4 种用法 —— 名世→天授、城建扩编（本按钮）、'
                + '校场扩编（出征容量 +1 万人马）、招贤纳士（将领席位 +1）。')
                + '">🪓 节钺扩编 · 建造位 +1（' +
              ((city.jieyueSlots || 0) >= ((DATA.JIEYUE || {}).citySlotMax || 2)
                ? '本城已满 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                : '本城 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                  + '　持符 ' + GAME.jieyueOf()) + '</button>'
          : '') +""",
'城池菜单底栏')

# ══════════ ② openExpModal 加 opts.hint ══════════
patch_file(U,
"""  ui.openExpModal = function (target) {""",
"""  ui.openExpModal = function (target, opts138) {
    /* v89.138（老板 2）：「派遣」「运输」两个入口共用本界面 ——
       opts138.hint 给一行**入口专属提示**（讲清这次要填什么），不传则不显示。 */
    ui._expHint = (opts138 && opts138.hint) || '';""",
'openExpModal 签名')

patch_file(U,
"""    var html = '<div class="gold-heading">⚔️ ' + U.escape(_tTitle) + '</div>';""",
"""    var html = '<div class="gold-heading">⚔️ ' + U.escape(_tTitle) + '</div>';
    /* v89.138：派遣 / 运输 的入口提示（同一界面，两句话说清各自要填的东西） */
    if (ui._expHint) {
      html += '<div class="exp-info exp-info-l" style="text-align:center;color:var(--gold-light);margin-bottom:6px;">'
        + (ui._expHint === 'cargo'
          ? '🚚 运输：先选<b>押运兵力</b>（运力随兵力涨），再到下方辎重区填要运的资源'
          : '🛡️ 派遣：选<b>主将</b>（随军入城）+ 兵种数量 —— 抵达即入城；不带货可直接出征')
        + '</div>';
    }""",
'exp hint 渲染')

# ══════════ ③ doExpConfirm：本境调运允许 0 兵（只派将） ══════════
patch_file(U if False else M,
"""      var _cargo5 = {};
      GAME.TRANSPORT_KEYS.forEach(function (k) {
        var el5 = document.getElementById('cg-' + k);
        var v5 = el5 ? Math.floor(Number(el5.value) || 0) : 0;
        if (v5 > 0) _cargo5[k] = v5;
      });""",
"""      var _cargo5 = {};
      GAME.TRANSPORT_KEYS.forEach(function (k) {
        var el5 = document.getElementById('cg-' + k);
        var v5 = el5 ? Math.floor(Number(el5.value) || 0) : 0;
        if (v5 > 0) _cargo5[k] = v5;
      });""",
'（占位：确认提交端在 main.js）')

# 真正的 0 兵放宽在 main.js（doExpConfirm 定义处）
patch_file(M,
"""      if (!Object.keys(atk).length) {
        /* v89.114：载重数从 DATA 读（此前硬编码 200/5000 —— 负重标定一改就成假文案） */
        ui.toast('请选择随行兵力 —— 辎重靠人挑（民夫载重 ' + DATA.TROOPS.minfu.load
          + ' / 辎重车 ' + DATA.TROOPS.zhouche.load + '）');
        return;
      }
      var _cargo5 = {};
      GAME.TRANSPORT_KEYS.forEach(function (k) {
        var el5 = document.getElementById('cg-' + k);
        var v5 = el5 ? Math.floor(Number(el5.value) || 0) : 0;
        if (v5 > 0) _cargo5[k] = v5;
      });""",
"""      /* v89.138（老板 2）：本境调运**允许 0 兵**（只派将）——
         有辎重才必须有兵押运（运力随兵力），没辎重就纯调将。 */
      var _cargo5 = {};
      GAME.TRANSPORT_KEYS.forEach(function (k) {
        var el5 = document.getElementById('cg-' + k);
        var v5 = el5 ? Math.floor(Number(el5.value) || 0) : 0;
        if (v5 > 0) _cargo5[k] = v5;
      });
      if (!Object.keys(atk).length && Object.keys(_cargo5).length) {
        /* v89.114：载重数从 DATA 读（此前硬编码 200/5000 —— 负重标定一改就成假文案） */
        ui.toast('请选择押运兵力 —— 辎重靠人挑（民夫载重 ' + DATA.TROOPS.minfu.load
          + ' / 辎重车 ' + DATA.TROOPS.zhouche.load + '）');
        return;
      }""",
'0 兵放宽')

# ══════════ ④ 弃城：两段确认（上膛式） ══════════
patch_file(U,
"""      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="city-abandon-do" data-city="' + city.id + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'""",
"""      /* v89.138（老板 2）：「放弃城池菜单**增加二次确认**」——
         按钮改上膛式：点第一次只"上膛"（变文案、变红、toast 警告），**再点一次**才执行；
         执行仍走原出口 `GAME.abandonCity`（业务侧照 CITY_SCOPED 表批量清理）。 */
      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="city-abandon-arm" data-city="' + city.id + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'""",
'弃城按钮')

# ══════════ ⑤ 将领派遣面板整条退役（结构定位） ══════════
s = io.open(U, 'r', encoding='utf-8', newline='').read()
i0 = s.find('  /* ---------- 将领派遣（v60 · 需求 4）----------')
if i0 < 0:
    print('❌ 找不到将领派遣注释头'); sys.exit(1)
j0 = s.find('ui.doDispatch = function', i0)
k0 = s.find('{', j0)
depth, m = 0, k0
while m < len(s):
    if s[m] == '{':
        depth += 1
    elif s[m] == '}':
        depth -= 1
        if depth == 0:
            break
    m += 1
e0 = s.find(';', m)
assert e0 > 0 and (e0 - m) < 4, 'doDispatch 尾异常'
print('  ✓ 将领派遣面板退役（%d 字节）' % (e0 + 1 - i0))
tomb = """  /* ============================================================
   * ⛔ v89.138（老板 2）：**「将领派遣」独立面板整条退役** ——
   * 老板：「调兵·运输，将领派遣合并成"派遣"和"运输"，均进入出征界面设定将领和兵种
   *   以及携带的资源」。
   * 本面板（openDispatch）与其助手 setDpGen / setDpTo / doDispatch 一并删除；
   * 「派遣」= 出征界面（本境调运 · 允许 0 兵只派将）——主将下拉即"派谁"、
   * 兵种表即"带多少"，抵达入城（`gen.cityId = 目标城`，见 expedition 的 owncity 分支）。
   * 域侧 `GAME.dispatchableGensOf` / `GAME.doDispatch` 随之退役（见 domain.js 同款墓碑）。
   * 如需恢复：本段代码见 `backup/v89138/ui.js`（判据：`ui.openDispatch = function`）。
   * ============================================================ */"""
s = s[:i0] + tomb + s[e0 + 1:]
assert '\r\n' not in s, '行尾混入 CRLF'
tmp = U + '.tmp138'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, U)
ok.append('将领派遣面板退役')

# ══════════ ⑥⑦⑧ main.js：case 改造 ══════════
patch_file(M,
"""      case 'city-enter': {
        var ceId = el.dataset.city, ceC = GAME.cityById(ceId);
        if (!ceC) { ui.toast('城池不存在'); break; }
        ui.setCity(ceId);
        GAME.refreshAll();
        ui.toast('已进入 ' + ceC.name);
        break;
      }""",
"""      case 'city-enter': {
        var ceId = el.dataset.city, ceC = GAME.cityById(ceId);
        if (!ceC) { ui.toast('城池不存在'); break; }
        ui.setCity(ceId);
        /* v89.138（老板 2）：「进入城池，**直接进入该城的城内界面**」——
           改前只切了"当前城"、视图还停在地图上（玩家看不出"进去了"）。 */
        ui.setView('city');
        GAME.refreshAll();
        ui.toast('已进入 ' + ceC.name);
        break;
      }""",
'city-enter 进城内')

patch_file(M,
"""      case 'budget-gather': {
        var bgR = GAME.budgetGather(el.dataset.city);
        ui.toast((bgR.ok ? '🏛 ' : '') + bgR.msg);
        if (bgR.ok) { GAME.refreshAll(); }
        break;
      }
      case 'city-dispatch': ui.openDispatch(el.dataset.city); break;""",
"""      /* ⛔ v89.138（老板 2）：case budget-gather（度支归集）与 case city-dispatch
         （将领派遣面板）整条退役 —— 见 ui.js / domain.js 的同款墓碑。 */
      case 'city-dispatch-exp':
        /* v89.138（老板 2）：「派遣」—— 与「运输」同进出征界面（本境调运），
           入口提示不同：派遣 = 兵/将随军入城（可不带货）。 */
        ui.openExpModal({ kind: 'own', id: el.dataset.city }, { hint: 'dispatch' });
        break;""",
'删度支/派遣 + 新增 dispatch-exp')

patch_file(M,
"""      case 'city-rename': {
        /* 改名弹窗作用于**当前城** —— 先切过去再开，避免改错城 */
        ui.setCity(el.dataset.city);
        ui.openRenameCity();
        break;
      }""",
"""      /* ⛔ v89.138（老板 2）：「去掉改名菜单」——城池面板的改名入口退役；
         改名功能不丢：官府格面板的「📝 修改城名」（open-rename-city）仍在。 */""",
'删 city-rename')

patch_file(M,
"""      case 'city-abandon-ask': ui.openAbandonCityAsk(el.dataset.city); break;""",
"""      case 'city-abandon-ask': ui.openAbandonCityAsk(el.dataset.city); break;
      /* v89.138（老板 2）：弃城**两段确认** —— 第一次点"上膛"（改文案 + 警告），
         再点一次才真的执行（执行仍走 GAME.abandonCity 同一出口）。 */
      case 'city-abandon-arm': {
        if (ui._abandonArm138 !== el.dataset.city) {
          ui._abandonArm138 = el.dataset.city;
          el.innerHTML = '⚠️ 再点一次 —— 永久失去该城（不可撤销）';
          ui.toast('⚠️ 危险操作：再点一次才真的放弃');
          break;
        }
        ui._abandonArm138 = null;
        var acR2 = GAME.abandonCity(el.dataset.city);
        ui.toast(acR2.msg);
        if (acR2.ok) { ui.closeModal(); GAME.refreshAll(); }
        else { ui.openAbandonCityAsk(el.dataset.city); }
        break;
      }""",
'弃城两段确认')

# 删 dp-gen / dp-to / dp-do
patch_file(M,
"""      case 'dp-gen': ui.setDpGen(el.dataset.i, el.dataset.v); break;
      case 'dp-to': ui.setDpTo(el.dataset.i, el.dataset.v); break;
      case 'dp-do': ui.doDispatch(); break;""",
"""      /* ⛔ v89.138（老板 2）：case dp-gen / dp-to / dp-do 随「将领派遣」面板整条退役。 */""",
'删 dp-* case')

# 底栏 city-transport 加 hint
patch_file(M,
"""      case 'city-transport': {
        var _ctFrom = GAME.currentCity();
        var _ctTo = el.dataset.city;
        if (!_ctFrom || !_ctTo || _ctTo === _ctFrom.id) { ui.toast('请选择另一座己方城池'); break; }
        ui.openExpModal({ kind: 'own', id: _ctTo });
        break;
      }""",
"""      case 'city-transport': {
        var _ctFrom = GAME.currentCity();
        var _ctTo = el.dataset.city;
        if (!_ctFrom || !_ctTo || _ctTo === _ctFrom.id) { ui.toast('请选择另一座己方城池'); break; }
        /* v89.138：「运输」入口 —— 同一出征界面 + 押运提示 */
        ui.openExpModal({ kind: 'own', id: _ctTo }, { hint: 'cargo' });
        break;
      }""",
'transport 加 hint')

print('✅ 补丁B 完成 · 段: ' + ' / '.join(ok))
