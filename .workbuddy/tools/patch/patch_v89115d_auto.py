# -*- coding: utf-8 -*-
"""
patch_v89115d_auto.py — 需求 0a：自动菜单整合（左 1/3 名单 + 右 2/3 详情）+ 自动治疗伤兵
改 6 个文件，每处：断言"替换前存在且唯一"→ 替换；整体：原子落盘 + 写后自检。
"""
import io, os, sys

R = 'E:/Deepseekdb/'

def read(p):
    return io.open(R + p, encoding='utf-8').read()

def write(p, s):
    tmp = R + p + '.tmp115'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)

def sub1(s, old, new, label):
    n = s.count(old)
    if n != 1:
        print('!! [%s] 匹配数 = %d（应为 1）\n   首行: %s' % (label, n, old.split('\n')[0][:90]))
        sys.exit(1)
    return s.replace(old, new, 1)

# ============================================================
# 1) ui.js：switchRow/stateLine → 新自动化界面（名单 + 详情）
# ============================================================
U = read('js/ui.js')

OLD_A = """  ui.autoSwitchRow = function () {
    var s = GAME.state;
    var cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    return '<div class="auto-switches">' +
      ui.autoSwitchBtn('up', '🔨 自动升级', s.settings.autoUpgrade, 'toggle-auto-upgrade') +
      ui.autoSwitchBtn('tech', '📜 自动研究', s.settings.autoResearch, 'toggle-auto-research') +
      ui.autoSwitchBtn('march', '⚔️ 自动出征', !!(cfg && cfg.on), 'toggle-auto-march') +
      ui.autoSwitchBtn('lord', '🧘 自动练功', !!s.settings.autoLordTrain, 'toggle-auto-lord') +
      '</div>';
  };
  ui.autoStateLine = function () {
    var s = GAME.state;
    var parts = [];
    parts.push('升级：' + ((s.autoState && s.autoState.msg) || '未开启'));
    parts.push('研究：' + ((s.autoTechState && s.autoTechState.msg) || '未开启'));
    parts.push('出征：' + ((s.autoMarchInfo && s.autoMarchInfo.msg) || '未开启'));
    parts.push('练功：' + ((s.autoLordState && s.autoLordState.msg) || '未开启'));
    return parts.join('　｜　');
  };"""

NEW_A = """  /* ============================================================
   * v89.115（老板）：「整合界面，左三分之一为自动功能列表（简洁），
   *   右侧三分之二为介绍展示和详细设置面板（类似将领界面），
   *   通过切换左侧自动化功能浏览和设置」+「自动菜单增加一个自动治疗伤兵」
   * ------------------------------------------------------------
   * 版式 = 将领界面同款左右分栏（.auto-grid：左 1fr 名单 / 右 2fr 详情）：
   *   左 = 六项自动化的**清单**（图标 + 名称 + 开/关圆点 + 一行摘要）—— 简洁；
   *   右 = 选中项的**介绍 + 详细设置**（开关 / 参数 / 上次结果 / 入口）+ 红线说明。
   * 状态：`ui._autoSel`（当前选中项 id，界面态不落存档 —— 与 ui._trainTab 同类）。
   * 单一出口：开/关判据 `ui.autoOnOf(id)`、状态摘要 `ui.autoMsgOf(id)` —— 左右两侧同读它，
   *   不许各写一份（改一处两边一起对）。
   * ============================================================ */
  ui.AUTO_ITEMS = [
    { id: 'upgrade', icon: '🔨', name: '自动升级', act: 'toggle-auto-upgrade' },
    { id: 'research', icon: '📜', name: '自动研究', act: 'toggle-auto-research' },
    { id: 'march', icon: '⚔️', name: '自动出征', act: 'toggle-auto-march' },
    { id: 'lord', icon: '🧘', name: '自动练功', act: 'toggle-auto-lord' },
    { id: 'recruit', icon: '🧲', name: '自动招募', act: 'auto-recruit-toggle' },
    { id: 'heal', icon: '🏥', name: '自动治疗', act: 'toggle-auto-heal' },
  ];
  /* 开/关判据（唯一出口） */
  ui.autoOnOf = function (id) {
    var s = GAME.state || {};
    var cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    if (id === 'upgrade') return !!(s.settings && s.settings.autoUpgrade);
    if (id === 'research') return !!(s.settings && s.settings.autoResearch);
    if (id === 'march') return !!(cfg && cfg.on);
    if (id === 'lord') return !!(s.settings && s.settings.autoLordTrain);
    if (id === 'recruit') return !!(GAME.innAutoCfg && GAME.innAutoCfg().on);
    if (id === 'heal') return !!(s.settings && s.settings.autoHeal);
    return false;
  };
  /* 状态摘要（唯一出口） */
  ui.autoMsgOf = function (id) {
    var s = GAME.state || {};
    if (id === 'upgrade') return (s.autoState && s.autoState.msg) || '未开启';
    if (id === 'research') return (s.autoTechState && s.autoTechState.msg) || '未开启';
    if (id === 'march') return (s.autoMarchInfo && s.autoMarchInfo.msg) || '未开启';
    if (id === 'lord') return (s.autoLordState && s.autoLordState.msg) || '未开启';
    if (id === 'recruit') {
      var c = GAME.innAutoCfg ? GAME.innAutoCfg() : null;
      return (c && c.on) ? ('门槛 ' + ((DATA.GEN_RANK_BY_ID[c.min] || {}).name || c.min)) : '未开启';
    }
    if (id === 'heal') return (s.autoHealState && s.autoHealState.msg) || '未开启';
    return '';
  };
  /* 左侧清单（简洁：图标 + 名称 + 圆点 + 摘要） */
  ui.autoSideHTML = function () {
    return ui.AUTO_ITEMS.map(function (it) {
      var on = ui.autoOnOf(it.id);
      return '<div class="auto-item' + (on ? ' on' : '') + (ui._autoSel === it.id ? ' sel' : '') + '"' +
        ' data-action="auto-pick" data-key="' + it.id + '">' +
        '<span class="ai-dot"></span>' +
        '<span class="ai-ico">' + it.icon + '</span>' +
        '<span class="ai-main"><b class="ai-name">' + it.name + '</b>' +
          '<span class="ai-sub">' + U.escape(ui.autoMsgOf(it.id)) + '</span></span>' +
        '</div>';
    }).join('');
  };
  /* 右侧详情（介绍 + 详细设置） */
  ui.autoPaneHTML = function (id) {
    var s = GAME.state || {}, cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    var it = null;
    ui.AUTO_ITEMS.forEach(function (x) { if (x.id === id) it = x; });
    if (!it) it = ui.AUTO_ITEMS[0];
    var on = ui.autoOnOf(it.id);
    var head = '<div class="ap-head"><span class="ap-ico">' + it.icon + '</span>' +
      '<span class="ap-name">' + it.name + '</span>' +
      '<button class="btn sm' + (on ? ' gold' : '') + '" data-action="' + it.act + '">' +
      (on ? '已开启' : '已关闭') + '</button></div>' +
      '<div class="ap-state">' + U.escape(ui.autoMsgOf(it.id)) + '</div>';
    var body = '';
    if (it.id === 'upgrade') {
      body = '<div class="auto-note">按等级从低到高、同级城内优先；受建造队列上限约束。' +
        '资源不足时<b>暂停但不关开关</b>，资源恢复后自动继续；全部满级则停止。' +
        '只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>';
    } else if (it.id === 'research') {
      body = '<div class="auto-note">从书院当前能研究的科技里挑最便宜的一项；' +
        '资源不足则暂停等待，不影响开关状态。</div>';
    } else if (it.id === 'march') {
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<button class="btn gold" data-action="open-auto-march">⚙️ 详细配置</button>' +
          '<button class="btn" data-action="auto-march-once">⚔️ 立即出征</button>' +
          '<span class="ui-sub">距离 ' + GAME.autoMarchRadius(cfg) + ' 格　·　今日 ' +
            (cfg.todayCount || 0) + (cfg.dailyMax > 0 ? '/' + cfg.dailyMax : '（不限）') + ' 次　·　' +
            '下次 ' + (cfg.on ? ('约 ' + cfg.everyMin + ' 分钟后（或体力恢复后）') : '未开启') + '</span></div>' +
        '<div class="auto-note"><b>红线（不可关闭）</b>：' +
          '① 只派<b>空闲</b>将领，出征中/守将/采集中一律跳过；' +
          '② 体力不足以支付本次出征就不出发；' +
          '③ 器械（床弩/冲车/投石车）、斥候、辎重<b>不编入</b>自动队伍 —— ' +
          '它们拖慢行军，且是守城家底；' +
          '④ 只从<b>当前城池</b>取兵；' +
          '⑤ 已占野地与今日已攻破的据点不会被重复打。</div>';
    } else if (it.id === 'lord') {
      body = '<div class="auto-note">君主<b>体力过半</b>时自动练一次（每 30 秒最多一次）：' +
        '产修为、未到段顶还给经验。过半才练是为了<b>把体力留给玩家</b> —— ' +
        '君主的体力也是出征与演武的本钱，自动化不该把它抢光。' +
        '粮草不足或体力不足时<b>暂停但不关开关</b>，恢复后自动继续。</div>';
    } else if (it.id === 'recruit') {
      /* 招募门槛/说明的正文由 ui.autoRecruitHTML 提供（去壳版：外壳与开关由本 pane 统一给） */
      body = ui.autoRecruitHTML();
    } else if (it.id === 'heal') {
      var n0 = s.wounded || 0;
      var fee0 = GAME.healFeeOf ? GAME.healFeeOf(n0) : n0 * 10;
      var gold0 = (GAME.res(GAME.currentCity()) || {}).gold || 0;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">伤兵 <b>' + U.fmt(n0) + '</b> 名　·　治疗费 <b>' + U.fmt(fee0) +
            '</b> 金　·　现存黄金 <b>' + U.fmt(gold0) + '</b></span>' +
          '<button class="btn" data-action="heal-wounded"' + (n0 > 0 ? '' : ' disabled') +
            '>立即治疗</button></div>' +
        '<div class="auto-note">伤兵营有伤兵、黄金够治疗费 → <b>自动治完全部</b>' +
          '（花金一次结清，15 现实秒最多尝试一次）。' +
          '黄金不足时<b>暂停但不关开关</b>，金恢复后自动继续。' +
          '治疗即归队：按兵种把伤兵加回城池，不是"清个数字"。</div>';
    }
    return head + body;
  };
  /* 组装：左 1/3 名单 + 右 2/3 详情 */
  ui.autoHTML = function () {
    if (!ui._autoSel) ui._autoSel = 'upgrade';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🤖 自动化' +
        ui.help('左侧切换自动化功能，右侧看介绍与详细设置。\\n' +
          '六项彼此独立；「暂停」只发生在资源/条件不足时 —— 开关不会自己关掉。\\n' +
          '自动出征只派空闲将领、器械与斥候不编入，且只从当前城池取兵。') +
      '</div>' +
      '<div class="auto-grid">' +
        '<div class="auto-side">' + ui.autoSideHTML() + '</div>' +
        '<div class="auto-pane">' + ui.autoPaneHTML(ui._autoSel) + '</div>' +
      '</div></div>';
  };"""
U = sub1(U, OLD_A, NEW_A, 'ui.switchRow → 新界面')

# ---- 删除旧的 ui.autoHTML（12214 起，到"自动出征详细配置弹窗"注释前）----
i0 = U.find("  ui.autoHTML = function () {\n    var s = GAME.state;\n    var cfg = GAME.autoMarchCfg();")
i1 = U.find("  /* ============================================================\n   * 自动出征「详细配置」弹窗", i0)
if i0 < 0 or i1 < 0 or i1 <= i0:
    print('!! 旧 autoHTML 定位失败 i0=%d i1=%d' % (i0, i1)); sys.exit(1)
U = U[:i0] + U[i1:]
print('  ✓ 旧 autoHTML 整段删除（%d 字符）' % (i1 - i0))

# ---- autoRecruitHTML 去壳去按钮（外壳/开关由 pane 统一给）----
OLD_C = """    return '<div class="auto-card">' +
        '<div class="ac-title">🧲 自动招募' +
          '<button class="btn sm' + (c.on ? ' gold' : '') + '" data-action="auto-recruit-toggle" style="margin-left:8px;">' +
            (c.on ? '已开启' : '已关闭') + '</button></div>' +
        '<div class="auto-state">开启后：客栈每批候选到手即自动招募<b>达到门槛者</b>，资质高者优先，' +"""
NEW_C = """    /* v89.115：去外壳（.auto-card / 标题 / 开关按钮）—— 新的自动化界面由右侧详情 pane
       统一提供外壳与开关（ui.autoPaneHTML），这里只出**设置正文**，避免两个开关并排。 */
    return '<div class="auto-state">开启后：客栈每批候选到手即自动招募<b>达到门槛者</b>，资质高者优先，' +"""
U = sub1(U, OLD_C, NEW_C, 'autoRecruitHTML 去壳')

# 去掉尾部多出来的一层 </div>（原壳的收尾）
OLD_C2 = """        '<div class="auto-state">客栈候选资质上限 <b>' + capName +
          '</b>　·　名世 / 天授不直接招募，只能靠<b>灵草升档</b>。</div>' +
      '</div>';
  };"""
NEW_C2 = """        '<div class="auto-state">客栈候选资质上限 <b>' + capName +
          '</b>　·　名世 / 天授不直接招募，只能靠<b>灵草升档</b>。</div>';
  };"""
U = sub1(U, OLD_C2, NEW_C2, 'autoRecruitHTML 收尾')

write('js/ui.js', U)
print('  ✓ ui.js 写入完成')

# ============================================================
# 2) battle.js：治疗费唯一出口
# ============================================================
B = read('js/battle.js')
OLD_D = """  GAME.battle.heal = function (cityId) {
    var s = GAME.state;
    var n = s.wounded || 0;
    if (!n) return { ok: false, msg: '伤兵营为空' };
    var gold = n * 10;"""
NEW_D = """  /* 治疗费**唯一出口**（伤兵 × 10 金）—— 弹窗、自动治疗、断言共读这一处（v89.115 抽取，
     此前"n * 10"在 battle.heal 与 ui.woundedBlock 各写一份）。 */
  GAME.healFeeOf = function (n) { return Math.max(0, Math.floor(n || 0)) * 10; };
  GAME.battle.heal = function (cityId) {
    var s = GAME.state;
    var n = s.wounded || 0;
    if (!n) return { ok: false, msg: '伤兵营为空' };
    var gold = GAME.healFeeOf(n);"""
B = sub1(B, OLD_D, NEW_D, 'battle.heal 用治疗费出口')
write('js/battle.js', B)
print('  ✓ battle.js 写入完成')

# ============================================================
# 3) ui.js：woundedBlock 用治疗费出口
# ============================================================
U2 = read('js/ui.js')
OLD_E = """  ui.woundedBlock = function (host) {
    var n = GAME.state.wounded || 0;
    var fee = n * 10;"""
NEW_E = """  ui.woundedBlock = function (host) {
    var n = GAME.state.wounded || 0;
    var fee = GAME.healFeeOf ? GAME.healFeeOf(n) : n * 10;   /* v89.115：走唯一出口 */
"""
U2 = sub1(U2, OLD_E, NEW_E.rstrip('\n'), 'woundedBlock 用治疗费出口')
write('js/ui.js', U2)
print('  ✓ ui.js（治疗费）写入完成')

# ============================================================
# 4) domain.js：GAME.autoHeal（自动治疗伤兵）
# ============================================================
D = read('js/domain.js')
ANCHOR = "  GAME.autoLordTrain = function () {"
NEW_F = """  /* ============================================================
   * v89.115（老板「自动菜单增加一个自动治疗伤兵」）：**自动治疗伤兵**
   * ------------------------------------------------------------
   * 口径（与自动练功/升级同一套写法）：
   *   · 伤兵营有伤兵、黄金够治疗费 → 立即治完全部（走既有 `battle.heal` 出口）；
   *   · 黄金不足 → **暂停但不关开关**，金恢复后自动继续；
   *   · 节流：15 **现实秒**最多尝试一次（治不了时不至于每 tick 空转）；
   *   · 状态：`s.autoHealState = { msg, at }`（at 同时充当节流时间戳）。
   * ============================================================ */
  GAME.AUTO_HEAL_GAP_MS = 15000;
  GAME.autoHeal = function () {
    var s = GAME.state;
    if (!s || !s.settings || !s.settings.autoHeal) return null;
    var last = (s.autoHealState && s.autoHealState.at) || 0;
    if (U.now() - last < GAME.AUTO_HEAL_GAP_MS) return null;      /* 节流：15 现实秒 */
    var n = s.wounded || 0;
    if (n <= 0) {
      s.autoHealState = { msg: '无伤兵，待命', at: U.now() };
      return null;
    }
    /* 够不够金由 heal 自己判（同一出口，不在这里复算一份） */
    var r = GAME.battle.heal();
    s.autoHealState = {
      msg: r.ok ? (r.msg + ' · 自动') : ('暂停：' + r.msg + '（金恢复后自动继续）'),
      at: U.now(),
    };
    return r;
  };
""" + ANCHOR
D = sub1(D, ANCHOR, NEW_F, 'domain.autoHeal 新增')
write('js/domain.js', D)
print('  ✓ domain.js 写入完成')

# ============================================================
# 5) state.js：tickOnce 挂 autoHeal
# ============================================================
S = read('js/state.js')
OLD_G = """    /* v89.83：自动练功（君主修行）—— 与自动出征同一处挂钩，节流在域层里 */
    if (GAME.autoLordTrain) GAME.autoLordTrain();"""
NEW_G = """    /* v89.83：自动练功（君主修行）—— 与自动出征同一处挂钩，节流在域层里 */
    if (GAME.autoLordTrain) GAME.autoLordTrain();
    /* v89.115（老板「自动菜单增加一个自动治疗伤兵」）：伤兵满金即治（节流在域层里） */
    if (GAME.autoHeal) GAME.autoHeal();"""
S = sub1(S, OLD_G, NEW_G, 'tickOnce 挂 autoHeal')
write('js/state.js', S)
print('  ✓ state.js 写入完成')

# ============================================================
# 6) main.js：动作（auto-pick / toggle-auto-heal）
# ============================================================
M = read('js/main.js')
OLD_H = """      case 'toggle-auto-upgrade': GAME.doToggleAutoUpgrade(); break;"""
NEW_H = """      case 'toggle-auto-upgrade': GAME.doToggleAutoUpgrade(); break;
      /* v89.115：自动化界面左右分栏 —— 左名单点选（只重绘本视图，不重开面板） */
      case 'auto-pick': ui._autoSel = el.dataset.key; GAME.refreshView(); break;
      case 'toggle-auto-heal': GAME.doToggleAutoHeal(); break;"""
M = sub1(M, OLD_H, NEW_H, 'main 动作')

OLD_I = """  /* 自动升级开关 */
  GAME.doToggleAutoUpgrade = function () {"""
NEW_I = """  /* v89.115：自动治疗开关（与其它开关同形：开启即试一次，关闭只清状态） */
  GAME.doToggleAutoHeal = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoHeal = !s.settings.autoHeal;
    if (s.settings.autoHeal) {
      s.autoHealState = { msg: '已开启，待命', at: 0 };   /* at=0 → 立刻试一次 */
      var r = GAME.autoHeal();
      ui.toast(r && r.ok ? '🏥 ' + r.msg : '🏥 自动治疗已开启（有伤兵且金够时自动治）');
    } else {
      s.autoHealState = null;
      ui.toast('自动治疗已关闭');
    }
    GAME.refreshView();
  };
  /* 自动升级开关 */
  GAME.doToggleAutoUpgrade = function () {"""
M = sub1(M, OLD_I, NEW_I, 'doToggleAutoHeal')
write('js/main.js', M)
print('  ✓ main.js 写入完成')

print('ALL DONE')
