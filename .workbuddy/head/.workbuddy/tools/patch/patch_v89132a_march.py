# -*- coding: utf-8 -*-
"""v89.132 补丁 A：军务处重构（老板需求 0/1/2）
- ui.js：
  ① 军务总览删除 ⑤ 两营区 + 顶部统计行去「伤兵」项（两营信息只在军务处）
  ② ui.campCard 重写：单一形态（camp-card 卡片，compact 档退役）+ 两营均列逐兵种
  ③ ui.marchAffairsHTML 重写：两营左右分列（.camp-cards），兵源与征募 / 军心两卡退役
  ④ 建筑面板「出征」行改读唯一出口 marchCapOf（口径统一，节钺扩编才跟得上）
- index.html：新增 .camp-cards / .camp-card / .camp-rule 样式（类名此前从未定义 = 静默失效）
跑：python .workbuddy/tools/patch/patch_v89132a_march.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ': 锚点命中 ' + str(n) + ' 次'
    return s.replace(old, new)

def func_span(s, sig, tag):
    """从 sig 起按大括号配平切出整个函数（返回 [i, end) 区间）"""
    i = s.find(sig)
    assert i >= 0, tag + ' 未找到'
    assert s.count(sig) == 1, tag + ' 签名不唯一'
    j = s.find('{', i)
    depth = 0
    k = j
    while k < len(s):
        c = s[k]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                break
        k += 1
    end = s.find(';', k)
    assert end > 0 and s[k:end + 1].strip() == '};', tag + ' 尾部异常: ' + repr(s[k:end + 1])
    return i, end + 1

# ============ 1) ui.js ============
ui = rd('js/ui.js')
before_len = len(ui)

# --- ①a 军务总览：删除 ⑤ 两营区 ---
old5 = (
    "      /* v89.117（老板「还是没有俘虏营或者降兵营…要让玩家看得到」）：\n"
    "         ⑤ 区从\"只有伤兵\"改成**两营并列**（伤兵营 + 俘虏营），各带逐兵种明细、\n"
    "         可见的规则行与操作键 —— 军务的默认页签上就能看见两营，不必先切到军务处。 */\n"
    "      '<div class=\"q-sec\" style=\"margin-top:18px;\"><span class=\"q-sec-t\">⑤ 两营（伤兵 · 俘虏）</span>' +\n"
    "        '<span class=\"q-sec-n\">' + U.numText(ui.campBadgeN(), 0) + ' 待处理</span></div>' +\n"
    "      ui.campCard('wounded', { compact: true }) +\n"
    "      ui.campCard('captive', { compact: true }) +\n"
    "      '</div>';\n"
    "  };\n"
)
new5 = (
    "      /* v89.132（老板「军务总览里边，不需要两营（伤兵·俘虏）这个菜单，只在军务处即可」）：\n"
    "         ⑤ 两营区整体退役 —— 两营（含逐兵种清单与操作）的**唯一落点** = 军务 · 军务处；\n"
    "         军务处页签角标（campBadgeN）仍提示待处理数，点进军务一眼就知道有没有活。 */\n"
    "      '</div>';\n"
    "  };\n"
)
ui = rep1(ui, old5, new5, '①a 总览⑤区')

# --- ①b 军务总览：统计行去「伤兵」 ---
oldstat = (
    "        '　·　采集 ' + U.numText(gatherTot, 0) + '　·　行军 ' + U.numText(marchTot, 0) +\n"
    "        '　·　征战 ' + (btPend ? btPend.n : 0) +\n"
    "        '　·　伤兵 ' + U.numText(s.wounded || 0, 0) + '</div>' +\n"
)
newstat = (
    "        '　·　采集 ' + U.numText(gatherTot, 0) + '　·　行军 ' + U.numText(marchTot, 0) +\n"
    "        '　·　征战 ' + (btPend ? btPend.n : 0) +\n"
    "        /* v89.132：统计行的「伤兵」一并撤（两营信息只在军务处；角标仍提示待处理数） */\n"
    "        '</div>' +\n"
)
ui = rep1(ui, oldstat, newstat, '①b 统计行伤兵')

# --- ② campCard 重写 ---
i, e = func_span(ui, 'ui.campCard = function (kind, opts) {', 'campCard')
old_body = ui[i:e]
assert "compact" in old_body and "camp-rule" in old_body, 'campCard 切片异常'
new_card = r'''ui.campCard = function (kind) {
    var s = GAME.state;
    var C = DATA.CAPTIVE || {};
    var ratePct = Math.round((C.rate == null ? 0.08 : C.rate) * 100);
    var capN = C.cap == null ? 3000 : C.cap;
    var srcNames = { wild: '野地', fort: '据点', city: '名城', defense: '守城得手' };
    var srcTxt = (C.kinds || []).map(function (k) { return srcNames[k] || k; }).join(' / ');
    if (kind === 'wounded') {
      var wn = s.wounded || 0;
      var fee = GAME.healFeeOf ? GAME.healFeeOf(wn) : wn * 10;
      var wr = Math.round(((DATA.EXPEDITION || {}).woundedRate || 0.45) * 100);
      return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(wn, 0) + ' 名</span></div>' +
        ui.armyBreakdownRows(s.woundedArmy, '伤兵营已空 —— 打完仗有了伤兵会列在这里') +
        '<div class="camp-rule"><b>规则</b>　来源：战斗阵亡者按 <b>' + wr + '%</b> 折为伤兵（受伤者不当场消失）　·　' +
          '归队：花黄金一次性治疗，按兵种加回本城　·　' +
          '自动化：「自动化 · 治疗伤兵」可托管</div>' +
        '<div class="auto-line"><button class="btn' + (wn ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
          (wn ? '' : ' disabled') + '>治疗伤兵（归队）</button>' +
          '<span class="ui-sub">治疗费 ' + U.numText(fee, 0) + ' 金</span></div></div>';
    }
    /* 俘虏营 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    var cPop = (GAME.captivePopOf ? GAME.captivePopOf(s.captives) : cn);
    var rep = Math.max(1, Math.round(cn / 50));
    return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
      '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里', null, { textOnly: true }) +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) +
        ' 人 —— 营中<b>不限量</b>）　·　' +
        '<b>收编为民</b>：收编这一刻才加人口，增量 = 俘虏总人口（兵种人数 × 兵种人口）　·　' +
        '<b>释放</b>：不添人口，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (cn ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (cn ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cPop, 0) + '）</button>' +
        '<button class="btn' + (cn ? '' : ' dim') + '" data-action="release-captives"' +
        (cn ? '' : ' disabled') + '>释放（声望 +' + rep + '）</button>' +
        '</div></div>';
  };'''
ui = ui[:i] + new_card + ui[e:]

# 更新 campCard 上方的说明注释（旧的"两种密度"表述已过时 → 改为本轮口径）
old_hdr = (
    "   * 改：本函数收成**唯一组件** —— 军务处 full / 总览 compact 两种密度，\n"
    "   *     规则一律**可见文字**，数字读唯一出口（DATA.CAPTIVE / healFeeOf），不抄文案。\n"
)
new_hdr = (
    "   * 改：本函数收成**唯一组件**（军务处唯一形态 = camp-card 卡片），\n"
    "   *     规则一律**可见文字**，数字读唯一出口（DATA.CAPTIVE / healFeeOf），不抄文案。\n"
    "   * v89.132（老板）：「军务总览里边，不需要两营这个菜单，只在军务处即可」——\n"
    "   *     总览页的 compact 档与 ⑤ 区一并退役（不留第二个形态 = 不留第二个出口）。\n"
)
ui = rep1(ui, old_hdr, new_hdr, '②b campCard 注释')

# --- ③ marchAffairsHTML 重写 ---
i, e = func_span(ui, 'ui.marchAffairsHTML = function () {', 'marchAffairsHTML')
new_aff = r'''ui.marchAffairsHTML = function () {
    /* v89.132（老板「军务处伤兵营和俘虏营左右分列，均列出详细兵种。
       兵源与征募这个菜单不要，军心这个菜单也不要」）——
       军务处 = 两营左右分列（.camp-cards），其余卡片一概不留。 */
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '两营的唯一落点：逐兵种清单、治疗归队、收编 / 释放都在这里</div>' +
      '<div class="camp-cards">' + ui.campCard('wounded') + ui.campCard('captive') + '</div>';
  };'''
ui = ui[:i] + new_aff + ui[e:]

# --- ③b 页签说明注释与 ④ 段落前的注释同步新口径 ---
old_cmt = ("   *   · 军务处 = 伤病营（治疗走既有 heal-wounded）+ 兵源征募额度 + 军心（逃兵风险）。\n")
new_cmt = ("   *   · 军务处 = 两营左右分列（伤兵营 + 俘虏营，逐兵种清单；\n"
           "   *     治疗 / 收编 / 释放都在这里）—— v89.132 起「兵源与征募」「军心」两卡退役。\n")
ui = rep1(ui, old_cmt, new_cmt, '③b 页签注释')

old_cmt2 = "  /* —— 军务处：伤病 / 兵源 / 军心（老板点名的三件事，全部接既有出口） —— */\n"
new_cmt2 = "  /* —— 军务处：两营并列（v89.132 起只此两块；动作全部复用既有出口） —— */\n"
ui = rep1(ui, old_cmt2, new_cmt2, '③b 军务处注释')

# --- ④ 建筑面板校场「出征」行改读唯一出口 ---
old_xc = ("      if (b.id === 'xiaochang') extra = '<div class=\"attr\"><span class=\"k\">出征</span><span class=\"v\">' + cell.build.lvl + '队 ×' + (cell.build.lvl * GAME.battle.MARCH_MEN_PER_LV).toLocaleString() + '人马</span></div>';\n")
new_xc = ("      /* v89.132：改读 marchCapOf（唯一出口）—— 节钺校场扩编后，这里与校场面板同数 */\n"
          "      if (b.id === 'xiaochang') extra = '<div class=\"attr\"><span class=\"k\">出征容量</span><span class=\"v\">' + U.numText(GAME.battle.marchCapOf(c), 0) + ' 人马</span></div>';\n")
ui = rep1(ui, old_xc, new_xc, '④ 校场建筑行')

# 写后自检：结构哨兵（防"切早/切坏"），比长度断言可靠
for sent in ['ui.campCard = function (kind) {', 'ui.campBadgeN = function () {',
             'ui.marchAffairsHTML = function () {', 'ui.marchBeaconHTML = function () {',
             'ui.updateProgress = function () {', "if (tab === 'affairs') return",
             "① 城内", "④ 行军", 'camp-cards']:
    assert ui.count(sent) >= 1, '丢失哨兵: ' + sent
assert 'compact: true' not in ui, 'compact 残留'
assert ui.count("campCard('wounded', { compact: true })") == 0, '⑤区 compact 调用未删净'
assert ui.count('🧾 兵源与征募') == 0 and ui.count('🚩 军心（逃兵风险）') == 0, '两卡未删净'
assert ui.count('军心（逃兵风险）') == 0, '军心文案残留（含注释）'
assert ui.count("ui.campCard('wounded') + ui.campCard('captive')") == 1, '军务处两营串异常'
wr('js/ui.js', ui)

# ============ 2) index.html：补 CSS ============
html = rd('index.html')
anchor = "  .wounded-box .wb-act { margin-top: var(--sp-3); text-align: center; }\n"
css = anchor + (
    "\n"
    "  /* ============ v89.132（老板）：军务处两营左右分列 ============\n"
    "     ⚠️ 此前 .camp-card / .camp-rule 两个类名**从未定义**（v89.117 起就是裸 div）——\n"
    "     本轮补齐，并把两营收成 .camp-cards 两列网格。 */\n"
    "  .camp-cards { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); align-items: start; }\n"
    "  .camp-card {\n"
    "    background: linear-gradient(180deg, rgba(var(--gold-rgb), .10), rgba(var(--sh-rgb), .18));\n"
    "    border: 1px solid rgba(var(--gold-rgb), .30);\n"
    "    border-radius: var(--r-lg);\n"
    "    padding: var(--sp-4);\n"
    "  }\n"
    "  .camp-card .wb-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--sp-2); }\n"
    "  .camp-card .wb-t { color: var(--gold-light); }\n"
    "  .camp-card .wb-n { font-size: var(--fs-lead); font-weight: 800; color: var(--parchment); font-variant-numeric: tabular-nums; }\n"
    "  .camp-card .camp-rule {\n"
    "    margin-top: var(--sp-3); padding-top: var(--sp-2);\n"
    "    border-top: 1px dashed rgba(var(--gold-rgb), .20);\n"
    "    font-size: var(--fs-sub); color: var(--text-dim); line-height: var(--lh-body);\n"
    "  }\n"
    "  .camp-cards .auto-line { margin: var(--sp-3) 0 0; }\n"
)
html = rep1(html, anchor, css, 'CSS 插入')
wr('index.html', html)

print('OK · ui.js', before_len, '->', len(ui))
print('OK · index.html', len(rd('index.html')))
