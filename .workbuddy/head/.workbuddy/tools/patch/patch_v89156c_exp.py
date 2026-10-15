# -*- coding: utf-8 -*-
# v89.156 patch C：出征界面改造（老板 2 + 3）
#   · 标题「派遣兵力 · 兵种数量」→「派遣兵力（校场出征上限：N）」（额度随方式/目标）
#   · 「可用道具」右列顶部 → 左列，收成下拉框（不再全列）
#   · 目标区备注 → 只提示**出征限制性信息**（领地满 / 野地满 / 据点今日已掠夺）
#   · 主将标题去「· 可用道具」
#   · 计略/出征方式/方案/出征战术 + 可用道具 → 逐行（单列）
#   · 预估 → 右列（派遣兵力下方），仅战斗型任务（非己方）；己方野地/城池无预估
# 锚点策略：长段（C4/C5/C8/C10）**程序化从文件抓取**再整体替换 —— 不手抄。
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

def rep(old, new, tag, marks):
    global s
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        s = s.replace(old, new)
        print(tag + ' OK')
        return True
    if any(mk in s for mk in marks):
        print(tag + ' skip（已落盘）')
        return False
    raise AssertionError(tag + ' anchor missing')

def cut(start_mark, end_mark):
    a = s.index(start_mark)
    b = s.index(end_mark, a) + len(end_mark)
    return s[a:b]

WRITE_EACH = True
def wr():
    io.open(P, 'w', encoding='utf-8', newline='').write(s)

# ---------- C2：目标区备注 → 限制性信息容器 ----------
OLD2 = (u"    html += '<div class=\"exp-info exp-info-l\" style=\"margin-bottom:0;color:var(--text-dim);\">' +\n"
        u"      '情报（守军 / 守将 / 库藏 / 布防）请用<b>侦查</b>获取。</div>';")
NEW2 = (u"    /* v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**（领地满 / 野地满 /\n"
        u"       据点今日已掠夺……）—— 常规引导（\"情报请用侦查\"）退役；\n"
        u"       无限制时这行为空。唯一出口 ui.expLimitsHTML（与执行端判据同源）。 */\n"
        u"    html += '<div class=\"exp-info exp-info-l\" id=\"exp-limits\" style=\"margin-bottom:0;color:var(--red-light);\">' +\n"
        u"      ui.expLimitsHTML() + '</div>';")
rep(OLD2, NEW2, 'C2 目标区限制行', [u'id="exp-limits"'])

# ---------- C3：主将标题 ----------
OLD3 = u"    html += '<div class=\"exp-sec exp-a-gen\"><div class=\"exp-sec-t\">主将 · 可用道具</div>';"
NEW3 = (u"    /* v89.156（老板 3）：标题去掉「· 可用道具」（可用道具已独立成块） */\n"
        u"    html += '<div class=\"exp-sec exp-a-gen\"><div class=\"exp-sec-t\">主将</div>';")
rep(OLD3, NEW3, 'C3 主将标题', [u'<div class="exp-sec-t">主将</div>'])

# ---------- C4：左列尾（预估块 → 可用道具块 + 辎重独立） ----------
SEG4 = cut(u"    /* ⑥ 预估（整行）", u"    html += '</div>';")
assert u"exp-wildcap" in SEG4 and u"expCargoHTML" in SEG4, 'C4 seg check'
NEW4 = (u"    /* ⑨ 可用道具（v89.156 老板 2：「上方的可用菜单放在左边，做个下拉框不要全列出」）——\n"
        u"       由右列顶部挪入左列 + 收成下拉框（不再全列 chips）；\n"
        u"       信息行（锦囊 · 精力 · 体力）保留 —— 它是出征决策的关键读数。 */\n"
        u"    html += '<div class=\"exp-sec exp-a-items\"><div class=\"exp-sec-t\">可用道具</div>';\n"
        u"    html += '<div class=\"exp-sel\"><label>道具</label>' +\n"
        u"      '<select id=\"exp-item-sel\"><option value=\"\">（选择道具）</option></select>' +\n"
        u"      '<span class=\"exp-tac-link\" id=\"exp-item-use\" data-action=\"exp-use-item-pick\" title=\"使用所选道具（作用于当前主将）\">使用</span></div>';\n"
        u"    html += '<div class=\"exp-info exp-info-l\" id=\"exp-items\" style=\"margin-bottom:0;\"></div>';\n"
        u"    html += '</div>';\n"
        u"    /* ⑩ 本境调运「辎重 · 资源调配」（transfer 专用**操作区**）——\n"
        u"       v89.156 随\"预估\"挪去右列后独立成块：它不是预估、是操作，不能跟着藏。\n"
        u"       旧账（v89.112）：右列 辎重221 + 兵种655 = 876px 顶穿正文区 —— 辎重始终留左列。 */\n"
        u"    if (ui._expOwn) html += ui.expCargoHTML(c);")
rep(SEG4, NEW4, 'C4 左列尾', [u'id="exp-item-sel"'])

# ---------- C5：右列（删道具块 + 标题改 + 预估进右列） ----------
SEG5 = cut(u"    /* 右列（独占）：**只放兵种及数量**", u"    html += '</div></div>';  /* /.exp-col-r /.exp-grid */")
assert u"exp-a-items" in SEG5 and u"exp-a-troops" in SEG5, 'C5 seg check'
NEW5 = (u"    /* 右列（独占）：**兵种及数量** + （战斗型任务）预估\n"
        u"       v89.156 老板 2：可用道具整块搬去左列（下拉框形态），右列不再有它；\n"
        u"       老板 3：预估仅\"战斗型任务（非己方）\"提供，位于派遣兵力**下方** ——\n"
        u"       己方野地 / 己方城池无需预估（本境调运与驻守没有战果可估）。 */\n"
        u"    html += '</div><div class=\"exp-col-r' + (ui._expOwn ? ' exp-own' : '') + '\">';\n"
        u"    /* v89.144（老板 2）：标题栏的两枚全局键（旧「上限 / 清空」）**整条退役** ——\n"
        u"       两个操作挪进每个兵种行（见 troopBlock）。\n"
        u"       v89.156 老板 2：标题由「派遣兵力 · 兵种数量」改「派遣兵力（校场出征上限：N）」——\n"
        u"       上限数值随方式/目标变（行内「上限」按钮的总额度，同一出口 expFillCapOf）。 */\n"
        u"    html += '<div class=\"exp-sec exp-a-troops\"><div class=\"exp-sec-t\">派遣兵力（<span id=\"exp-cap-t\">' +\n"
        u"      U.escape(ui.expCapLabelOf(c, t, ui._expMode)) + '</span>）</div>';\n"
        u"    html += '<div class=\"exp-troops exp-body\" data-mode=\"' + cur.id + '\">' + troopBlock + '</div>';\n"
        u"    html += '</div>';\n"
        u"    if (!ui._expOwn && !isOwnWild137) html += ui.expEstBlockHTML();\n"
        u"    html += '</div></div>';  /* /.exp-col-r /.exp-grid */")
rep(SEG5, NEW5, 'C5 右列', [u'id="exp-cap-t"'])

# ---------- C6：打开时的调用 ----------
OLD6 = u"    ui.updateExpWildCap();          /* v89.86（P-16）：打开即评估野地上限（双保险，applyExpMode 已调一次） */"
NEW6 = u"    ui.updateExpLimits();           /* v89.156：打开即评估限制性信息（双保险，applyExpMode 已调一次） */"
rep(OLD6, NEW6, 'C6 打开调用', [u'ui.updateExpLimits();           /* v89.156：打开即评估'])

# ---------- C7：applyExpMode ----------
OLD7 = (u"  ui.applyExpMode = function () {\n"
        u"    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');\n"
        u"    var box = $('#modal-root .exp-troops');\n"
        u"    if (box) box.style.opacity = cur.battle ? '1' : '.55';\n"
        u"    ui.updateExpWildCap();          /* v89.86（P-16）：方式变更 → 重算野地上限预警 */\n"
        u"  };")
NEW7 = (u"  ui.applyExpMode = function () {\n"
        u"    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');\n"
        u"    var box = $('#modal-root .exp-troops');\n"
        u"    if (box) box.style.opacity = cur.battle ? '1' : '.55';\n"
        u"    ui.updateExpLimits();           /* v89.156：方式变更 → 重算限制性信息（原野地上限预警） */\n"
        u"    ui.refreshExpCapLabel();        /* v89.156：限额标签随方式刷新（校场 / 派驻 / 目标城余量） */\n"
        u"  };")
rep(OLD7, NEW7, 'C7 applyExpMode', [u'ui.refreshExpCapLabel();        /* v89.156'])

# ---------- C8：updateExpWildCap → expLimitsHTML + updateExpLimits ----------
SEG8 = cut(u"  /* v89.86（整改 P-16）：野地已达上限的出兵前预警", u"\n  };")
assert u"ui.updateExpWildCap = function" in SEG8, 'C8 seg check'
NEW8 = (u"  /* ============================================================\n"
        u"   * v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**——\n"
        u"   *   · 领地满（占城 / 拔据点都会产出一座新城）；\n"
        u"   *   · 野地满（占领将转为就地取材）；\n"
        u"   *   · 据点今日已掠夺（每处每日限一次）。\n"
        u"   * 判据全部读**执行端同一出口**（cityCapChk / 官府+wildCap / fortRaidedToday）——\n"
        u"   * 界面提示与真拦截不许各算一份。无限制时返回空串（该行不占位）。\n"
        u"   * ============================================================ */\n"
        u"  ui.expLimitsHTML = function () {\n"
        u"    var t = ui._expRes;\n"
        u"    var city = GAME.currentCity();\n"
        u"    if (!t || !city) return '';\n"
        u"    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');\n"
        u"    var out = [];\n"
        u"    /* ① 领地上限（占城 / 拔除据点 = 一座新城；与 battle.prepare 硬闸同一判据） */\n"
        u"    if (mode.occupy && (t.kind === 'city' || t.kind === 'fort')) {\n"
        u"      var cc = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };\n"
        u"      if (!cc.ok) out.push('⚠️ ' + U.escape(cc.msg) + ' —— 此战攻克也无法纳入版图');\n"
        u"    }\n"
        u"    /* ② 野地上限（占领未占野地；上限口径与 battle 里\"转为就地取材\"的判定同源：\n"
        u"       官府等级 + 爵位/主城加成 cityBonusNum('wildCap')） */\n"
        u"    if (mode.occupy && t.kind === 'wild' && !GAME.map.wildAt(t.x, t.y)) {\n"
        u"      var limit = (GAME.buildingLevel(city, 'guanfu') || 1) + GAME.cityBonusNum(city, 'wildCap');\n"
        u"      var have = ((GAME.state && GAME.state.wilds) || []).length;\n"
        u"      if (have >= limit) {\n"
        u"        out.push('⚠️ 野地已达上限（' + have + ' / ' + limit + '）：本次占领将<b>转为就地取材</b>' +\n"
        u"          '（不再取得产量加成与采集权）——可先放弃一处野地，或升官府提高上限。');\n"
        u"      }\n"
        u"    }\n"
        u"    /* ③ 据点今日已掠夺（每处每日限一次；与 raid 方式锁同一判据） */\n"
        u"    if (mode.raid && t.kind === 'fort' && GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(t.x, t.y)) {\n"
        u"      out.push('⚠️ 此据点今日已掠夺（每处每日限一次），明日可再来。');\n"
        u"    }\n"
        u"    return out.map(function (x) { return '<div>' + x + '</div>'; }).join('');\n"
        u"  };\n"
        u"  ui.updateExpLimits = function () {\n"
        u"    var box = document.getElementById('exp-limits');\n"
        u"    if (box) box.innerHTML = ui.expLimitsHTML();\n"
        u"  };")
rep(SEG8, NEW8, 'C8 限制出口', [u'ui.expLimitsHTML = function'])

# ---------- C9：expFillTipOf 尾插三个出口 ----------
if u'ui.expCapLabelOf = function' not in s:
    k = s.index(u"ui.expFillTipOf = function")
    k2 = s.index(u"\n  };", k) + len(u"\n  };")
    NEW9 = (u"\n\n"
        u"  /* v89.156（老板 2）：派遣兵力标题里的**额度标签**（唯一出口）——\n"
        u"     「校场出征上限」= 行内「上限」按钮的总额度（expFillCapOf），随方式/目标变：\n"
        u"       · 出征类：校场出征上限（marchCapOf × 各种加成）；\n"
        u"       · 己方野地（驻守）：派驻上限余量；己方城池（调兵）：目标城余量；\n"
        u"       · 无校场 = 不设上限。 */\n"
        u"  ui.expCapLabelOf = function (city, t, modeId) {\n"
        u"    var cap = ui.expFillCapOf(city, t, modeId);\n"
        u"    if (cap == null) return '不设上限';\n"
        u"    var md = modeId || ui._expMode || 'occupy';\n"
        u"    if (md === 'station' && t && t.kind === 'wild') return '派驻上限 ' + U.numText(cap, 0);\n"
        u"    if (t && t.kind === 'owncity') return '目标城余量 ' + U.numText(cap, 0);\n"
        u"    return '校场出征上限 ' + U.numText(cap, 0);\n"
        u"  };\n"
        u"  ui.refreshExpCapLabel = function () {\n"
        u"    var el = document.getElementById('exp-cap-t');\n"
        u"    if (el) el.textContent = ui.expCapLabelOf(GAME.currentCity(), ui._expRes, ui._expMode);\n"
        u"  };\n"
        u"  /* v89.156（老板 3）：右列」预估」块（原左列整段搬来；exp-wildcap 行退役——\n"
        u"     它的内容并入目标区「限制性信息」）。仅战斗型任务渲染（见 openExpModal）。 */\n"
        u"  ui.expEstBlockHTML = function () {\n"
        u"    var h = '<div class=\"exp-sec exp-a-est\"><div class=\"exp-sec-t\">预估</div>';\n"
        u"    h += '<div class=\"exp-info exp-info-l\" id=\"exp-march\" style=\"margin-bottom:4px;\"></div>';\n"
        u"    h += '<div class=\"exp-info exp-info-l\" id=\"exp-sum\" style=\"margin-bottom:4px;\"></div>';\n"
        u"    h += '<div class=\"exp-info exp-info-l\" id=\"exp-power\" style=\"margin-bottom:4px;\"></div>';\n"
        u"    h += '<div class=\"exp-info exp-info-l\" id=\"exp-haul\" style=\"margin-bottom:0;\"></div>';\n"
        u"    h += '</div>';\n"
        u"    return h;\n"
        u"  };")
    s = s[:k2] + NEW9 + s[k2:]
    print('C9 新出口 OK')
else:
    print('C9 skip（已落盘）')

# ---------- C10：refreshExpItems 重写（下拉框） ----------
SEG10 = cut(u"ui.refreshExpItems = function", u"\n  };")
assert u"exp-use-item" in SEG10, 'C10 seg check'
NEW10 = (u"ui.refreshExpItems = function () {\n"
        u"    /* v89.156（老板 2）：「可用道具」由右列顶部挪入左列，且**收成下拉框**（不再全列 chips）——\n"
        u"       · select：列出可对主将使用的道具（体力丹类）×数量；数量为 0 的不出现；\n"
        u"       · 信息行：锦囊 / 精力 / 体力（出征决策的关键读数，保留）。 */\n"
        u"    var box = document.getElementById('exp-items');\n"
        u"    var sel = document.getElementById('exp-item-sel');\n"
        u"    if (!box && !sel) return;\n"
        u"    var s = GAME.state;\n"
        u"    var genEl = document.getElementById('exp-gen');\n"
        u"    var gid = (genEl && genEl.value) || ui._expGen || '';\n"
        u"    var gen = null;\n"
        u"    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });\n"
        u"    var jinang = (s.items && s.items.jinang) || 0;\n"
        u"    var parts = ['<b>锦囊</b> ×' + jinang];\n"
        u"    if (gen) {\n"
        u"      parts.push('<b>精力</b> ' + Math.round(gen.energy || 0));\n"
        u"      parts.push('<b>体力</b> ' + Math.round(GAME.staNow(gen)) + '/' + Math.round(GAME.staMax(gen)));\n"
        u"    }\n"
        u"    if (box) box.innerHTML = parts.join('　·　');\n"
        u"    if (sel) {\n"
        u"      var pills = (DATA.ITEMS || []).filter(function (it) {\n"
        u"        return it.type === 'stamina' && (s.items && s.items[it.id] > 0);\n"
        u"      });\n"
        u"      var keep = sel.value;\n"
        u"      sel.innerHTML = '<option value=\"\">' + (pills.length ? '（选择道具）' : '（无可用道具）') + '</option>' +\n"
        u"        pills.map(function (it) {\n"
        u"          return '<option value=\"' + it.id + '\">' + U.escape(it.name) + ' ×' + s.items[it.id] + '</option>';\n"
        u"        }).join('');\n"
        u"      /* 保持已选项（数量变了仍在）；被用光的项自然消失 → 回落空 */\n"
        u"      if (keep && pills.some(function (it) { return it.id === keep; })) sel.value = keep;\n"
        u"    }\n"
        u"  };")
rep(SEG10, NEW10, 'C10 refreshExpItems', [u"var sel = document.getElementById('exp-item-sel');"])

wr()
print('ui.js patch C done, len', orig, '->', len(s))

# ---------- 自检 ----------
chk = io.open(P, encoding='utf-8', newline='').read()
assert u'ui.updateExpWildCap = function' not in chk, 'updateExpWildCap remains'
assert u'id="exp-wildcap"' not in chk, 'exp-wildcap DOM remains'
assert chk.count(u'ui.expLimitsHTML = function') == 1
assert chk.count(u'ui.expCapLabelOf = function') == 1
assert chk.count(u'ui.expEstBlockHTML = function') == 1
assert chk.count(u'id="exp-item-sel"') == 1 and chk.count(u'id="exp-cap-t"') == 1
assert chk.count(u'id="exp-limits"') == 1 and chk.count(u'id="exp-items"') == 1
print('SELF-CHECK PASS')
