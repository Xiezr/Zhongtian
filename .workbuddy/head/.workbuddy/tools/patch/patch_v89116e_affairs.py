# -*- coding: utf-8 -*-
"""v89.116 补丁 E：军务处「伤兵营 / 俘虏营」（逐兵种）+ 自动治疗触发记录（UI 层）

口径（老板：伤兵营放在军务处下，俘虏营也是；列出具体兵种及数量）：
  · 伤兵营 / 俘虏营**唯一落点 = 军务 · 军务处**；校场 / 行军队列 / 行军视图
    三处改为一行**指引**（不再各摆一套，避免"两处入口、两套读数"）。
  · 军务处两个营都按**逐兵种**列清单（数据来自 s.woundedArmy / s.captives）。
  · 自动化 · 治疗页给出**触发记录**（时间 + 兵种 × 数量 + 治疗费）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


# ============================================================
# ① 伤兵营：组件改为"指引行"，落点统一到军务处
# ============================================================
edit('js/ui.js',
     """  ui.woundedBlock = function (host) {
    var n = GAME.state.wounded || 0;
    var fee = GAME.healFeeOf ? GAME.healFeeOf(n) : n * 10;   /* v89.115：走唯一出口 */
    return '<div class="wounded-box"' + (host ? ' data-heal-host="' + host + '"' : '') + '>' +
      '<div class="wb-head">' +
        '<span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(n, 0) + ' 名</span></div>' +
      '<div class="attr"><span class="k">治疗费</span><span class="v">' +
        (n ? (U.numText(fee, 0) + ' 金') : '—') + '</span></div>' +
      '<div class="wb-act">' +
        '<button class="btn' + (n ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
          (n ? '' : ' disabled') + '>治疗全部伤兵</button>' +
      '</div></div>';
  };""",
     """  /* ============================================================
   * v89.116（老板「伤兵营放在军务处下，俘虏营也是。出现伤病或俘虏时，
   *   列出具体兵种及数量，不要一个总数量」）
   * ------------------------------------------------------------
   * 改前：伤兵营在**四处**各摆一套（设置→校场→行军队列弹窗→行军视图→军务处），
   *   除军务处外都只给一个总数，治疗按钮也散着放 —— 老板要的是"一个落点 + 逐兵种"。
   * 现在：**唯一落点 = 军务 · 军务处**（`ui.marchAffairsHTML` 里的两营卡片）；
   *   本函数降级为**一行指引**（保留计数 + 一键跳转），供校场 / 行军 / 行军弹窗使用。
   * ============================================================ */
  ui.WOUNDED_HOME_TXT = '伤兵营与俘虏营统一在「军务 · 军务处」——逐兵种清单、治疗归队、收编 / 释放都在那里。';
  ui.woundedBlock = function (host) {
    var n = GAME.state.wounded || 0;
    var fee = GAME.healFeeOf ? GAME.healFeeOf(n) : n * 10;   /* v89.115：走唯一出口 */
    return '<div class="wounded-box"' + (host ? ' data-heal-host="' + host + '"' : '') + '>' +
      '<div class="wb-head">' +
        '<span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(n, 0) + ' 名</span></div>' +
      '<div class="attr"><span class="k">治疗费</span><span class="v">' +
        (n ? (U.numText(fee, 0) + ' 金') : '—') + '</span></div>' +
      '<div class="wb-act">' +
        '<button class="btn' + (n ? ' gold' : '') + '" data-action="go-affairs">🏥 去军务处' +
          (n ? '（治疗 / 逐兵种清单）' : '（伤兵营）') + '</button>' +
      '</div></div>';
  };""",
     'ui.js woundedBlock 降级为指引')

# ============================================================
# ② 军务处：伤病营逐兵种 + 新增俘虏营
# ============================================================
edit('js/ui.js',
     """  ui.marchAffairsHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var wounded = s.wounded || 0;
    var parts = [];
    Object.keys(s.woundedArmy || {}).forEach(function (k) {
      if ((s.woundedArmy[k] || 0) > 0) parts.push((DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' ' + U.numText(s.woundedArmy[k], 0));
    });""",
     """  /* 逐兵种清单（两个营共用）：把 { 兵种: 数量 } 摊成若干行 ——
     老板：「列出具体兵种及数量，不要一个总数量」。行序按数量降序（多的在前）。 */
  ui.armyBreakdownRows = function (map, emptyTxt, extraOf) {
    var arr = [];
    Object.keys(map || {}).forEach(function (k) {
      var v = Math.max(0, Math.floor(map[k] || 0));
      if (v > 0) arr.push([k, v]);
    });
    if (!arr.length) return '<div class="res-line"><span class="lbl">明细</span><span class="val" ' +
      'style="color:var(--text-dim);">' + U.escape(emptyTxt || '（空）') + '</span></div>';
    arr.sort(function (a, b) { return b[1] - a[1]; });
    return arr.map(function (x) {
      var nm = DATA.TROOPS[x[0]] ? DATA.TROOPS[x[0]].name : (x[0] === 'unknown' ? '来历不明' : x[0]);
      return '<div class="res-line"><span class="lbl">' + ((GAME.icons.forTroop && GAME.icons.forTroop(x[0])) || '')
        + ' ' + U.escape(nm) + '</span><span class="val">' + U.numText(x[1], 0) + ' 人'
        + (extraOf ? (extraOf(x[0], x[1]) || '') : '') + '</span></div>';
    }).join('');
  };
  ui.marchAffairsHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var wounded = s.wounded || 0;
    var parts = [];
    Object.keys(s.woundedArmy || {}).forEach(function (k) {
      if ((s.woundedArmy[k] || 0) > 0) parts.push((DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' ' + U.numText(s.woundedArmy[k], 0));
    });
    var captN = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;""",
     'ui.js 逐兵种清单助手')

edit('js/ui.js',
     """    return '<div class="story-card"><div class="gold-heading">🏥 伤病营' +
      ui.help('伤兵随战斗产生（阵亡者按回收率折为伤兵，兵种构成也记账）。\\n' +
        '「治疗」走既有出口 heal-wounded（花黄金，一次治完归队）。') + '</div>' +
      '<div class="res-line"><span class="lbl">在营养伤</span><span class="val">' + U.numText(wounded, 0) +
        ' 人' + (parts.length ? '　<span class="ui-sub">' + U.escape(parts.join(' · ')) + '</span>' : '') + '</span></div>' +
      '<div class="auto-line"><button class="btn' + (wounded > 0 ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
        (wounded > 0 ? '' : ' disabled') + '>治疗伤兵（归队）</button>' +
        '<span class="ui-sub">无伤兵时无需治疗</span></div></div>' +""",
     """    return '<div class="story-card"><div class="gold-heading">🏥 伤兵营（本境）' +
      ui.help('伤兵随战斗产生（阵亡者按回收率折为伤兵，**兵种构成也记账**）。\\n' +
        '「治疗」走既有出口 heal-wounded（花黄金，一次治完归队 —— 逐兵种加回当前城池）。\\n' +
        '这里是伤兵营的**唯一落点**：校场 / 行军 / 行军弹窗只留一行指引。') + '</div>' +
      '<div class="res-line"><span class="lbl">在营养伤</span><span class="val">' + U.numText(wounded, 0) + ' 人</span></div>' +
      ui.armyBreakdownRows(s.woundedArmy, '伤兵营已空 —— 打完仗有了伤兵会列在这里') +
      '<div class="auto-line"><button class="btn' + (wounded > 0 ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
        (wounded > 0 ? '' : ' disabled') + '>治疗伤兵（归队）</button>' +
        '<span class="ui-sub">治疗费 ' + U.numText(GAME.healFeeOf ? GAME.healFeeOf(wounded) : wounded * 10, 0)
        + ' 金　·　无伤兵时无需治疗</span></div></div>' +
      '<div class="story-card"><div class="gold-heading">🪶 俘虏营（本境）' +
      ui.help('俘虏来源：野地 / 据点 / 名城 / 守城得手 —— 按**敌军逐兵种损失**折算（DATA.CAPTIVE：'
        + '8% · 每次上限 3000）。\\n'
        + '收编为民：全部并入住民（人口 +N）；释放：不添人口，换一点声望。\\n'
        + '两处都会清空俘虏营 —— 先看清兵种再决定。') + '</div>' +
      '<div class="res-line"><span class="lbl">在营俘虏</span><span class="val">' + U.numText(captN, 0) + ' 人</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里') +
      '<div class="auto-line"><button class="btn' + (captN > 0 ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (captN > 0 ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(captN, 0) + '）</button>' +
        '<button class="btn' + (captN > 0 ? '' : ' dim') + '" data-action="release-captives"' +
        (captN > 0 ? '' : ' disabled') + '>释放（声望 +' + Math.max(1, Math.round(captN / 50)) + '）</button>' +
        '</div></div>' +""",
     'ui.js 军务处两营卡片')

# ============================================================
# ③ 自动化 · 治疗：触发记录
# ============================================================
edit('js/ui.js',
     """        '<div class="auto-note">伤兵营有伤兵、黄金够治疗费 → <b>自动治完全部</b>' +
          '（花金一次结清，15 现实秒最多尝试一次）。' +
          '黄金不足时<b>暂停但不关开关</b>，金恢复后自动继续。' +
          '治疗即归队：按兵种把伤兵加回城池，不是"清个数字"。</div>';""",
     """        '<div class="auto-note">伤兵营有伤兵、黄金够治疗费 → <b>自动治完全部</b>' +
          '（花金一次结清，15 现实秒最多尝试一次）。' +
          '黄金不足时<b>暂停但不关开关</b>，金恢复后自动继续。' +
          '治疗即归队：按兵种把伤兵加回城池，不是"清个数字"。</div>' +
        ui.autoHealLogHTML();""",
     'ui.js 治疗页加记录')

edit('js/ui.js',
     """  ui.autoPaneHTML = function (id) {""",
     """  /* v89.116（老板「自动治疗下放一个触发记录，如果进行了自动治疗，显示具体兵种及数量」）
     —— 触发记录：每条 = 时间 + 兵种 × 数量 + 治疗费 + 归入城池。
     数据在 `s.autoHealLog`（`GAME.autoHeal` 写入，上限 DATA.AUTO_HEAL_LOG_MAX），
     本函数只负责画（不在界面里另存一份状态）。 */
  ui.autoHealLogHTML = function () {
    var s = GAME.state || {};
    var log = s.autoHealLog || [];
    if (!log.length) {
      return '<div class="auto-note" style="margin-top:var(--sp-4);"><b>触发记录</b></div>' +
        '<div class="auto-note" style="margin:0;">尚无自动治疗记录 —— 开启后每次真治成了都会记一条' +
        '（含兵种与人数）。</div></div>';
    }
    var rows = log.map(function (rec) {
      var d = new Date(rec.t || U.now());
      var by = rec.by || {};
      var items = [];
      Object.keys(by).sort(function (a, b) { return (by[b] || 0) - (by[a] || 0); }).forEach(function (k) {
        var nm = DATA.TROOPS[k] ? DATA.TROOPS[k].name : (k === 'unknown' ? '来历不明' : k);
        items.push(U.escape(nm) + ' ×' + U.numText(by[k], 0));
      });
      if (!items.length) items.push('（无兵种记录，已遣散）');
      return '<div class="res-line"><span class="lbl">🕒 ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes())
        + ':' + U.pad(d.getSeconds()) + '</span><span class="val">'
        + (items.length ? items.join('、') : '（无兵种记录，已遣散）')
        + '　<span class="ui-sub">' + U.numText(rec.n || 0, 0) + ' 人 · ' + U.numText(rec.gold || 0, 0)
        + ' 金' + (rec.city ? ' · 归入' + U.escape(rec.city) : '') + '</span></span></div>';
    }).join('');
    return '<div class="auto-note" style="margin-top:var(--sp-4);"><b>触发记录</b>（最近 ' + log.length
      + ' 次 · 逐次列出兵种与人数）</div>' + rows;
  };

  ui.autoPaneHTML = function (id) {""",
     'ui.js 治疗触发记录渲染')

# ============================================================
# ④ main.js：动作派发
# ============================================================
edit('js/main.js',
     """      /* 军务·出征：一键进**出征界面**（目标 = 据点 / 名城 / 己方城池） */""",
     """      /* v89.116：伤兵营 / 俘虏营的**唯一落点**跳转（校场 / 行军 / 行军弹窗的指引行） */
      case 'go-affairs': {
        ui._marchTab = 'affairs';
        ui.setView('march');
        ui.toast('伤兵营 / 俘虏营在「军务 · 军务处」');
        break;
      }
      /* v89.116：俘虏营的两个出口（收编为民 / 释放） */
      case 'conscript-captives': {
        var _cc = GAME.doConscriptCaptives();
        ui.toast(_cc.msg);
        if (_cc.ok) GAME.refreshAll();
        break;
      }
      case 'release-captives': {
        var _cr = GAME.doReleaseCaptives();
        ui.toast(_cr.msg);
        if (_cr.ok) GAME.refreshAll();
        break;
      }
      /* 军务·出征：一键进**出征界面**（目标 = 据点 / 名城 / 己方城池） */""",
     'main.js 派发三个动作')

# ---------------- 执行 ----------------
def main():
    files = {}
    for path, old, new, tag in EDITS:
        p = R + path
        if p not in files:
            files[p] = io.open(p, encoding='utf-8').read()
        s = files[p]
        n = s.count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次（要求 1）→ 中止' % (tag, n))
            return 1
        files[p] = s.replace(old, new, 1)
        print('  ✓ %s' % tag)
    bak = R + '.workbuddy/backup/v89116/'
    for p, s in files.items():
        b = io.open(bak + os.path.basename(p), encoding='utf-8').read()
        d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
        if d0 != 0:
            print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
            return 1
        tmp = p + '.tmp116e'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(p), d0))
    print('补丁 E 完成')
    return 0


sys.exit(main())
