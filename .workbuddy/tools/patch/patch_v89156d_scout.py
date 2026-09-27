# -*- coding: utf-8 -*-
# v89.156 patch D：侦察可能失败（老板 4「视双方将领资质和等级差设计」）
#   · DATA.SCOUT_RULE：成功率参数（唯一旋钮）
#   · GAME.battle.scoutChanceOf：成功率的唯一出口（无守将 = 必成）
#   · scoutTarget：失败早退（无情报/无拾获/无宝物）
#   · expedition scout 分支：失败公文（"侦查失败 · X"，不带 scout 字段 → 不可展开）
import io

def rep(path, old, new, tag, marks):
    s = io.open(path, encoding='utf-8', newline='').read()
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        s = s.replace(old, new)
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        print(tag + ' OK')
    elif any(mk in s for mk in marks):
        print(tag + ' skip（已落盘）')
    else:
        raise AssertionError(tag + ' anchor missing')

# ---------- D1：data.js 参数表 ----------
PD = 'E:/Deepseekdb/js/data.js'
OLD1 = u"""    { id: 'spoils', unlock: 10, name: '可图之利',
      hint: '可获珠宝、材料、军械、可采资源与占领后的产量加成' },
  ];"""
NEW1 = u"""    { id: 'spoils', unlock: 10, name: '可图之利',
      hint: '可获珠宝、材料、军械、可采资源与占领后的产量加成' },
  ];

  /* ============================================================
   * v89.156（老板 4）：「侦察可能失败，视双方将领资质和等级差设计」
   * ------------------------------------------------------------
   * 成功率 P = base + perLv×(我方等级 − 守将等级) + perStar×(我方资质星 − 守将资质星)，
   * clamp 到 [lo, hi]；**目标无守将 → 必成**（没有"对方将领"，不掷骰）。
   * 参数标定（探针实测打表见 docs/v89156）：
   *   · 势均力敌（同资质同等级）≈ 85% —— 侦察是常用动作，失败率过高会变"反复重试"的负担；
   *   · 弱将探强敌明显吃亏：差 10 级 2 星 → 60%；差 20 级 3 星 → 40%（下限）；
   *   · 强将探弱敌近必成：+10 级 +2 星 → 97%（上限）。
   * 调平衡只改这张表（scoutChanceOf 是唯一消费点）。 */
  DATA.SCOUT_RULE = { base: 0.85, perLv: 0.015, perStar: 0.05, lo: 0.40, hi: 0.97 };"""
rep(PD, OLD1, NEW1, 'D1 SCOUT_RULE', [u'DATA.SCOUT_RULE = {'])

# ---------- D2+D3：battle.js ----------
PB = 'E:/Deepseekdb/js/battle.js'
s = io.open(PB, encoding='utf-8', newline='').read()
orig = len(s)

# D2：scoutChanceOf（插在 scoutTarget 定义前）
if u'GAME.battle.scoutChanceOf = function' not in s:
    anchor = u"  GAME.battle.scoutTarget = function (t, gen) {"
    assert s.count(anchor) == 1
    NEW2 = (u"  /* ============================================================\n"
        u"   * v89.156（老板 4）：「侦察可能失败，视双方将领资质和等级差设计」\n"
        u"   * ------------------------------------------------------------\n"
        u"   * **侦察成功率的唯一出口**（结算 / 公文 / 探针 / 断言都读它）：\n"
        u"   *   P = base + perLv×(我方等级 − 守将等级) + perStar×(我方资质星 − 守将资质星)，\n"
        u"   *   clamp 到 [lo, hi]；**目标无守将 → p=1（必成，不掷骰）**。\n"
        u"   * 参数在 DATA.SCOUT_RULE（标定见 data.js 注释）。\n"
        u"   * ============================================================ */\n"
        u"  GAME.battle.scoutChanceOf = function (gen, t) {\n"
        u"    var R = DATA.SCOUT_RULE || { base: 0.85, perLv: 0.015, perStar: 0.05, lo: 0.40, hi: 0.97 };\n"
        u"    var foe = (t && t.guard) || null;\n"
        u"    var myLv = (gen && gen.level) || 1;\n"
        u"    var myStar = ((gen && GAME.rankOf) ? (GAME.rankOf(gen).star || 1) : 1);\n"
        u"    if (!foe) return { p: 1, foe: null, myLv: myLv, foeLv: 0, myStar: myStar, foeStar: 0 };\n"
        u"    var foeLv = foe.level || 1;\n"
        u"    var foeStar = ((GAME.rankOf ? GAME.rankOf(foe).star : 1) || 1);\n"
        u"    var p = R.base + R.perLv * (myLv - foeLv) + R.perStar * (myStar - foeStar);\n"
        u"    p = Math.max(R.lo, Math.min(R.hi, p));\n"
        u"    return { p: p, foe: foe, myLv: myLv, foeLv: foeLv, myStar: myStar, foeStar: foeStar };\n"
        u"  };\n\n")
    s = s.replace(anchor, NEW2 + anchor)
    print('D2 scoutChanceOf OK')
else:
    print('D2 skip（已落盘）')

# D3：scoutTarget 头插失败早退
anchor3 = (u"    var tiers = GAME.battle.intelTiersOf();\n"
           u"    var got = tiers.got;\n"
           u"    out.intel = tiers;\n")
NEW3 = (u"    var tiers = GAME.battle.intelTiersOf();\n"
        u"    var got = tiers.got;\n"
        u"    out.intel = tiers;\n"
        u"    /* v89.156（老板 4）：侦察可能失败 —— 视双方将领资质与等级差（唯一出口 scoutChanceOf）。\n"
        u"       失败 = 一无所获：无情报（连\"约略\"也不给）、无顺手所得、无宝物线索；\n"
        u"       成功后的分层/大雾逻辑不变（大雾是\"降级\"，失败是\"没成\"，两回事）。 */\n"
        u"    var _ch156 = GAME.battle.scoutChanceOf(gen, t);\n"
        u"    out.chance = _ch156;\n"
        u"    if (_ch156.foe && Math.random() >= _ch156.p) {\n"
        u"      out.fail = true;\n"
        u"      out.detail.fail = true;\n"
        u"      return out;\n"
        u"    }\n")
if anchor3 in s:
    assert s.count(anchor3) == 1
    s = s.replace(anchor3, NEW3)
    print('D3 失败早退 OK')
elif u'_ch156 = GAME.battle.scoutChanceOf' in s:
    print('D3 skip（已落盘）')
else:
    raise AssertionError('D3 anchor missing')

# D4a：lines 构造包装 if/else
A4A = (u"      /* 日志也按分层：没解锁的项不写\"守将：无\"（那是误导 —— 不是没有，是看不见），\n"
       u"         改写\"未解锁\"。 */\n"
       u"      var lines = [sc.totalExact\n")
if A4A in s:
    i = s.index(A4A)
    j = s.index(u"if (itL.next) lines.push", i)
    j = s.index(u"\n", j) + 1
    SEG4A = s[i:j]
    NEW4A = (u"      /* v89.156（老板 4）：侦察失败 → 只报失手（缘由 = 守将资质/等级压过我方斥候），\n"
        u"         不再走成功路径的分层日志。 */\n"
        u"      var lines;\n"
        u"      if (sc.fail) {\n"
        u"        var _chF = sc.chance || {};\n"
        u"        var _foeF = _chF.foe || null;\n"
        u"        lines = ['【侦查失败】守军戒备森严，此行未得任何情报。'];\n"
        u"        if (_foeF) {\n"
        u"          lines.push('缘由：守将 ' + _foeF.name + '（' + GAME.rankOf(_foeF).name + ' Lv' + (_foeF.level || 1)\n"
        u"            + '）机警过人 —— 我方斥候（' + (gen ? (GAME.rankOf(gen).name + ' Lv' + (gen.level || 1)) : '无将')\n"
        u"            + '）未能应付。');\n"
        u"        }\n"
        u"        lines.push('建言：改派资质更高、等级更高的将领带队，成功率随之提高。');\n"
        u"      } else {\n"
        u"      /* 日志也按分层：没解锁的项不写\"守将：无\"（那是误导 —— 不是没有，是看不见），\n"
        u"         改写\"未解锁\"。 */\n"
        u"      lines = [sc.totalExact\n")
    # 捕获原段（从 var lines = 到 if (itL.next)…行），整体包进 else { … }
    body = SEG4A[len(A4A):]   # 从 '        ? (' 开始的余下部分
    NEW4A_FULL = NEW4A + body + u"      }\n"
    s = s.replace(SEG4A, NEW4A_FULL)
    print('D4a lines 包装 OK')
elif u'if (sc.fail) {\n        var _chF = sc.chance' in s:
    print('D4a skip（已落盘）')
else:
    raise AssertionError('D4a anchor missing')

# D4b：公文 IIFE 头插失败分支
A4B = u"      (function () {\n        var rp = [lines.join('<br>')];"
NEW4B = (u"      (function () {\n"
        u"        /* v89.156（老板 4）：失败公文 —— 不带 `scout` 字段（公文列表的\"展开侦查面板\"\n"
        u"           只认它 → 失败没有面板可展开）；正文就是 lines（失败缘由 / 建言）。 */\n"
        u"        if (sc.fail) {\n"
        u"          s.reports.unshift({\n"
        u"            t: U.now(), type: 'scout',\n"
        u"            title: '侦查失败 · ' + t.name,\n"
        u"            body: lines.join('<br>'), loot: [], win: false,\n"
        u"            intel: { lv: itL.lv, target: t.name },\n"
        u"          });\n"
        u"          while (s.reports.length > (DATA.REPORT_MAX || 60)) {\n"
        u"            var _dropF = -1;\n"
        u"            for (var _riF = s.reports.length - 1; _riF >= 0; _riF--) {\n"
        u"              if (!s.reports[_riF].fav) { _dropF = _riF; break; }\n"
        u"            }\n"
        u"            if (_dropF < 0) break;\n"
        u"            s.reports.splice(_dropF, 1);\n"
        u"          }\n"
        u"          s.repUnread = (s.repUnread || 0) + 1;\n"
        u"          return;\n"
        u"        }\n"
        u"        var rp = [lines.join('<br>')];")
if A4B in s:
    assert s.count(A4B) == 1
    s = s.replace(A4B, NEW4B)
    print('D4b 失败公文 OK')
elif u"'侦查失败 · ' + t.name" in s:
    print('D4b skip（已落盘）')
else:
    raise AssertionError('D4b anchor missing')

# D4c：return msg 定制
A4C = u"        msg: '侦查完成：' + lines[0] + (sc.loot.length ? '，顺手得 ' + sc.loot.join('、') : ''),"
NEW4C = (u"        /* v89.156（老板 4）：失败给独立的 msg（行军抵达的 toast / 军务读它） */\n"
         u"        fail: !!sc.fail,\n"
         u"        msg: sc.fail\n"
         u"          ? ('侦查失败：' + t.name + ' 守军戒备森严，斥候未得情报'\n"
         u"              + (sc.chance && sc.chance.foe ? '（守将 ' + sc.chance.foe.name + ' 坐镇）' : ''))\n"
         u"          : ('侦查完成：' + lines[0] + (sc.loot.length ? '，顺手得 ' + sc.loot.join('、') : '')),")
if A4C in s:
    assert s.count(A4C) == 1
    s = s.replace(A4C, NEW4C)
    print('D4c return msg OK')
elif u"fail: !!sc.fail," in s:
    print('D4c skip（已落盘）')
else:
    raise AssertionError('D4c anchor missing')

io.open(PB, 'w', encoding='utf-8', newline='').write(s)
print('battle.js patch D done, len', orig, '->', len(s))

# ---------- 自检 ----------
d = io.open(PD, encoding='utf-8', newline='').read()
b = io.open(PB, encoding='utf-8', newline='').read()
assert d.count(u'DATA.SCOUT_RULE = {') == 1
assert b.count(u'GAME.battle.scoutChanceOf = function') == 1
assert b.count(u'out.fail = true;') == 1
assert b.count(u"'侦查失败 · ' + t.name") == 1
assert b.count(u'fail: !!sc.fail,') == 1
print('SELF-CHECK PASS')
