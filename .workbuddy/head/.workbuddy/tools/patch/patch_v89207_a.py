# -*- coding: utf-8 -*-
# v89.207 批次 A：快赢五条 + 离线/睡眠报告化 + 战斗增速档（代码）
# 纪律：每段独立 guard（新特征计数）；写盘 newline='' 保 LF；写后 node --check。
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    assert '\r\n' not in s, 'CRLF leak!'
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

DATA = 'E:/Deepseekdb/js/data.js'
UI = 'E:/Deepseekdb/js/ui.js'
ST = 'E:/Deepseekdb/js/state.js'
MAIN = 'E:/Deepseekdb/js/main.js'

# ══════ A1 data.js：LOOP_GAP.reportSec + BATTLE_WATCH 表 ══════
rep(DATA, 'A1 数据表',
    "  DATA.LOOP_GAP = { gapSec: 5, toastSec: 300, battleAutoSec: 300 };",
    "  DATA.LOOP_GAP = { gapSec: 5, toastSec: 300, battleAutoSec: 300,\n"
    "    /* v89.207（老板 2）：睡醒/久挂（≥30 分钟）→ 主循环补算后弹「离线纪要」明细报告；\n"
    "       5 分钟~30 分钟只发轻提示（防\"浏览器切来切去\"被报告打断）。 */\n"
    "    reportSec: 1800 };\n"
    "  /* v89.207（老板 1·快赢④）：战斗观战节拍（实时战场 + 战报沙盘共用；毫秒基数）。\n"
    "     speeds = 可选档位（ui.btSpdHTML 直接渲染它）；改档位只改这里一处。 */\n"
    "  DATA.BATTLE_WATCH = { firstMs: 620, eventMs: 260, speeds: [1, 2, 4] };",
    'DATA.BATTLE_WATCH')

# ══════ A2 ui.js：toast 相邻同文案合并 ══════
rep(UI, 'A2 toast 合并',
    "    ui._notes.push({ type: type, msg: msg });\n"
    "    var keep = (opt && opt.keep) || 3;\n"
    "    while (ui._notes.length > keep) ui._notes.shift();\n"
    "    var el = $('#toast');\n"
    "    el.innerHTML = ui._notes.map(function (n) {\n"
    "      return '<div class=\"toast-line t-' + n.type + '\">' + U.escape(n.msg) + '</div>';\n"
    "    }).join('');",
    "    /* v89.207（老板 1·快赢③）：**相邻同文案合并** —— 连续同类操作（连点加兵/连点快购）\n"
    "       不再刷出多条重复行，合并为「msg（×N）」（上限 3 条队列照旧；跨类型不合并）。\n"
    "       渲染层：n.n > 1 才带计数后缀 —— 单条场景与旧观感逐字一致。 */\n"
    "    var _lastN = ui._notes[ui._notes.length - 1];\n"
    "    if (_lastN && _lastN.msg === msg && _lastN.type === type) {\n"
    "      _lastN.n = (_lastN.n || 1) + 1;\n"
    "    } else {\n"
    "      ui._notes.push({ type: type, msg: msg, n: 1 });\n"
    "    }\n"
    "    var keep = (opt && opt.keep) || 3;\n"
    "    while (ui._notes.length > keep) ui._notes.shift();\n"
    "    var el = $('#toast');\n"
    "    el.innerHTML = ui._notes.map(function (n) {\n"
    "      return '<div class=\"toast-line t-' + n.type + '\">' + U.escape(n.msg) +\n"
    "        (n.n > 1 ? '（\u00d7' + n.n + '）' : '') + '</div>';\n"
    "    }).join('');",
    '_lastN = ui._notes[ui._notes.length - 1]')

# ══════ A3 ui.js：增速档出口组（插在 btPlay 之前）══════
rep(UI, 'A3 增速出口组',
    "  ui.btPlay = function (rec, r, bt) {",
    "  /* ============================================================\n"
    "   * v89.207（老板 1·快赢④）：**战斗增速档**（1\u00d7 / 2\u00d7 / 4\u00d7）\n"
    "   * ------------------------------------------------------------\n"
    "   * 只影响**观战动画节拍**（实时战场 btPlay 的事件间隔 + 战报沙盘 sdToggle 的帧间隔）——\n"
    "   * **不影响战斗结果**（结算仍是同一份引擎数据）；也不影响\"自动结算倒计时\"\n"
    "   * （battleSec 约束的是玩家思考时间，与动画无关）。\n"
    "   * · 档位 = 会话级（ui._btSpd，重开页面回 1\u00d7）；节拍基数 = DATA.BATTLE_WATCH。\n"
    "   * · 战场（#bt-acts）与沙盘（#sd-foot-dyn）共用同一组按钮出口（btSpdHTML）与同一状态。\n"
    "   * ============================================================ */\n"
    "  ui._btSpd = 1;\n"
    "  ui.btSpdOf = function () {\n"
    "    var S = (DATA.BATTLE_WATCH && DATA.BATTLE_WATCH.speeds) || [1, 2, 4];\n"
    "    return S.indexOf(ui._btSpd) >= 0 ? ui._btSpd : 1;   /* 只认表内档位（防脏值） */\n"
    "  };\n"
    "  ui.btSpdSet = function (v) {\n"
    "    var S = (DATA.BATTLE_WATCH && DATA.BATTLE_WATCH.speeds) || [1, 2, 4];\n"
    "    var n = Number(v);\n"
    "    if (S.indexOf(n) >= 0) ui._btSpd = n;\n"
    "  };\n"
    "  ui.btSpdHTML = function () {\n"
    "    var S = (DATA.BATTLE_WATCH && DATA.BATTLE_WATCH.speeds) || [1, 2, 4];\n"
    "    var cur = ui.btSpdOf();\n"
    "    return '<span class=\"bt-spd\">' + S.map(function (v) {\n"
    "      return '<button class=\"btn sm mini' + (v === cur ? ' gold' : '') + '\" data-action=\"bt-spd\"'\n"
    "        + ' data-v=\"' + v + '\" title=\"观战动画速度 ' + v + '\u00d7（不影响战斗结果）\">' + v + '\u00d7</button>';\n"
    "    }).join('') + '</span>';\n"
    "  };\n"
    "  /* 节拍唯一出口：基准毫秒 \u00f7 当前档（下限 40ms —— 4\u00d7 下事件 65ms 仍可辨、不闪帧） */\n"
    "  ui.btWatchDelay = function (ms) {\n"
    "    return Math.max(40, Math.round((ms || 0) / ui.btSpdOf()));\n"
    "  };\n"
    "  ui.btSpdRepaint = function () {\n"
    "    var cur = ui.btSpdOf();\n"
    "    var els = [];\n"
    "    try { els = document.querySelectorAll('[data-action=\"bt-spd\"]'); } catch (e) { els = []; }\n"
    "    for (var i = 0; i < els.length; i++) {\n"
    "      var on = Number(els[i].dataset ? els[i].dataset.v : els[i].getAttribute('data-v')) === cur;\n"
    "      if (els[i].classList) els[i].classList.toggle('gold', on);\n"
    "    }\n"
    "  };\n"
    "  ui.btPlay = function (rec, r, bt) {",
    'ui.btWatchDelay = function (ms)')

# ══════ A4 ui.js：btPlay 节拍接出口 ══════
rep(UI, 'A4 btPlay 节拍',
    "      setTimeout(next, 260);\n"
    "    }\n"
    "    setTimeout(next, 620);",
    "      /* v89.207（快赢④）：节拍走唯一出口（基准在 DATA.BATTLE_WATCH；旧值 260/620 即表值） */\n"
    "      setTimeout(next, ui.btWatchDelay((DATA.BATTLE_WATCH || {}).eventMs || 260));\n"
    "    }\n"
    "    setTimeout(next, ui.btWatchDelay((DATA.BATTLE_WATCH || {}).firstMs || 620));",
    'ui.btWatchDelay((DATA.BATTLE_WATCH || {}).eventMs || 260)')

# ══════ A5 ui.js：战场命令条插增速键 ══════
rep(UI, 'A5 战场命令条',
    "      '<span class=\"bt-acts\" id=\"bt-acts\">' +\n"
    "        '<button class=\"btn sm gold\" data-action=\"bt-done\">\u2705 完成回合</button>' +",
    "      '<span class=\"bt-acts\" id=\"bt-acts\">' +\n"
    "        /* v89.207（老板 1·快赢④）：战斗增速档（1\u00d7/2\u00d7/4\u00d7）—— 只快放观战动画，不改战斗结果 */\n"
    "        ui.btSpdHTML() +\n"
    "        '<button class=\"btn sm gold\" data-action=\"bt-done\">\u2705 完成回合</button>' +",
    'ui.btSpdHTML() +')

# ══════ A6 ui.js：沙盘底条插增速键（replay 时）══════
rep(UI, 'A6 沙盘底条',
    "      '<span class=\"rp-pos\" id=\"sd-slider-pos\">' + sd.i + ' / ' + sb.frames.length + '</span>' +",
    "      '<span class=\"rp-pos\" id=\"sd-slider-pos\">' + sd.i + ' / ' + sb.frames.length + '</span>' +\n"
    "      /* v89.207（快赢④）：沙盘回放共享战斗增速档（与实时战场同一状态/同一出口） */\n"
    "      (sim ? '' : ui.btSpdHTML()) +",
    "(sim ? '' : ui.btSpdHTML()) +")

# ══════ A7 ui.js：sdToggle 节拍接出口 ══════
rep(UI, 'A7 sdToggle 节拍',
    "    var ms = (DATA.SANDBOX && DATA.SANDBOX.frameMs) || 420;   /* 权威值在 DATA.SANDBOX（v89.116），420 仅防御 */",
    "    /* v89.207（快赢④）：帧间隔并入战斗增速档（btWatchDelay 唯一出口；基数仍取 DATA.SANDBOX） */\n"
    "    var ms = ui.btWatchDelay((DATA.SANDBOX && DATA.SANDBOX.frameMs) || 420);",
    'var ms = ui.btWatchDelay((DATA.SANDBOX')

# ══════ A8 ui.js：归来报告 → 离线纪要（via 分流）══════
rep(UI, 'A8 报告标题',
    "    var head = '离城 ' + durTxt + ' \u00b7 推演 ' + (gDays >= 1 ? Math.round(gDays) + ' 游戏日' : '不足 1 游戏日');",
    "    /* v89.207（老板 2）：来源分流 —— 读档归来 = 「归来报告」；睡眠/息屏在线补算 = 「离线纪要」\n"
    "       （同一份报告数据，rp.via 标记来源；均不落档）。 */\n"
    "    var _online207 = rp.via === 'online';\n"
    "    var head = (_online207 ? '息屏 ' : '离城 ') + durTxt + ' \u00b7 推演 ' + (gDays >= 1 ? Math.round(gDays) + ' 游戏日' : '不足 1 游戏日');",
    "var _online207 = rp.via === 'online';")

rep(UI, 'A8 报告标题2',
    "    var h = '<div class=\"gold-heading\">\U0001f570\ufe0f 归来报告</div>' +",
    "    var h = '<div class=\"gold-heading\">\U0001f570\ufe0f ' + (_online207 ? '离线纪要' : '归来报告') + '</div>' +",
    "_online207 ? '离线纪要' : '归来报告'")

# ══════ A9 ui.js：qty-step 两个 title ══════
rep(UI, 'A9 qty-step −',
    "'<button class=\"qi-btn\" data-action=\"qty-step\" data-for=\"' + inputId + '\" data-d=\"-1\">\u2212</button>' +",
    "'<button class=\"qi-btn\" data-action=\"qty-step\" data-for=\"' + inputId + '\" data-d=\"-1\" title=\"减少数量\">\u2212</button>' +",
    'data-d="-1" title="减少数量"')
rep(UI, 'A9 qty-step ＋',
    "'<button class=\"qi-btn\" data-action=\"qty-step\" data-for=\"' + inputId + '\" data-d=\"1\">\uff0b</button>' +",
    "'<button class=\"qi-btn\" data-action=\"qty-step\" data-for=\"' + inputId + '\" data-d=\"1\" title=\"增加数量\">\uff0b</button>' +",
    'data-d="1" title="增加数量"')

# ══════ A10 state.js：silent 也归集（via 字段）══════
rep(ST, 'A10 归集去silent',
    "    /* v89.89（A2）：归集归来报告（快照差 → 分类数据；纯读取）\n"
    "       v89.193：静默模式（在线时间跳变补偿）跳过 —— \"归来报告\"是读档归来的语义。 */\n"
    "    if (!_silent193) {\n"
    "    var _snapB = _oRepSnap();",
    "    /* v89.89（A2）：归集归来报告（快照差 → 分类数据；纯读取）\n"
    "       v89.193：静默模式（在线时间跳变补偿）曾跳过（\"归来报告\"是读档语义）；\n"
    "       v89.207（老板 2）：**静默也归集**（via 标记来源）—— 睡眠/息屏大缺口由主循环侧\n"
    "       按 DATA.LOOP_GAP.reportSec 弹「离线纪要」（同一份数据，标题按 via 分流）。 */\n"
    "    var _snapB = _oRepSnap();",
    'v89.207（老板 2）：**静默也归集**')

rep(ST, 'A10b via 字段',
    "      autoBattles: _autoBN200,   /* v89.200（老板 2）：离线期间自动打完的挂起战斗数 */\n"
    "    };\n"
    "    }",
    "      autoBattles: _autoBN200,   /* v89.200（老板 2）：离线期间自动打完的挂起战斗数 */\n"
    "      via: _silent193 ? 'online' : 'reload',   /* v89.207：来源（离线纪要 / 归来报告） */\n"
    "    };",
    "via: _silent193 ? 'online' : 'reload'")

# ══════ A11 main.js：keydown 数字键 ══════
rep(MAIN, 'A11 数字快捷键',
    "    document.addEventListener('keydown', function (e) {\n"
    "      if (e.key === 'Escape' || e.keyCode === 27) {\n"
    "        if (ui._moveFrom != null) { ui._moveFrom = null; ui.toast('已取消移动'); }\n"
    "        if (ui.modalVisible && ui.modalVisible()) {\n"
    "          ui.closeModal();\n"
    "          if (GAME.refreshView) GAME.refreshView();\n"
    "        }\n"
    "      }\n"
    "    });",
    "    document.addEventListener('keydown', function (e) {\n"
    "      if (e.key === 'Escape' || e.keyCode === 27) {\n"
    "        if (ui._moveFrom != null) { ui._moveFrom = null; ui.toast('已取消移动'); }\n"
    "        if (ui.modalVisible && ui.modalVisible()) {\n"
    "          ui.closeModal();\n"
    "          if (GAME.refreshView) GAME.refreshView();\n"
    "        }\n"
    "        return;\n"
    "      }\n"
    "      /* v89.207（老板 1·快赢②）：数字键 1-9 快速切视图 —— 与顶栏页签同一出口 setView；\n"
    "         顺序 = 顶栏可见页签从左往右（城/外/图/将/军/任/商/包/藏）；\n"
    "         输入/选择态、组合键、弹窗打开时一律不触发（不抢输入、不抢弹窗内导航）。\n"
    "         Esc 关弹窗为 v89 既有（本轮快赢②的另一半 = 验其已生效，不重复实现）。 */\n"
    "      var _tn207 = (e.target && e.target.tagName) || '';\n"
    "      if (_tn207 === 'INPUT' || _tn207 === 'TEXTAREA' || _tn207 === 'SELECT') return;\n"
    "      if (e.ctrlKey || e.metaKey || e.altKey) return;\n"
    "      if (ui.modalVisible && ui.modalVisible()) return;\n"
    "      var _n207 = parseInt(e.key, 10);\n"
    "      if (e.key && e.key.length === 1 && _n207 >= 1 && _n207 <= 9) {\n"
    "        var _vi207 = ['city', 'ext', 'map', 'generals', 'marches', 'tasks', 'shop', 'bag', 'collection'];\n"
    "        ui.setView(_vi207[_n207 - 1]);\n"
    "        e.preventDefault();\n"
    "      }\n"
    "    });",
    '数字键 1-9 快速切视图')

# ══════ A12 main.js：helper + 两处调用点 ══════
rep(MAIN, 'A12 helper',
    "    function _gapToastSec199() { return ((DATA.LOOP_GAP || {}).toastSec) || 300; }\n"
    "    function _gapToast199(gap) {\n"
    "      ui.toast('\U0001f570\ufe0f 检测到时间跳变，已按现实时间补算 '\n"
    "        + (gap >= 3600 ? (gap / 3600).toFixed(1) + ' 时' : Math.round(gap / 60) + ' 分钟'));\n"
    "    }",
    "    function _gapToastSec199() { return ((DATA.LOOP_GAP || {}).toastSec) || 300; }\n"
    "    /* v89.207（老板 2）：「离线纪要」门槛 —— 大缺口（睡醒/久挂 ≥30 分钟）→ 弹明细报告；\n"
    "       与读档归来的「归来报告」同一份数据（GAME._offlineReport，via 分流标题）。 */\n"
    "    function _gapReportSec207() { return ((DATA.LOOP_GAP || {}).reportSec) || 1800; }\n"
    "    function _gapNotify207(gap) {\n"
    "      if (gap >= _gapToastSec199()) _gapToast199(gap);\n"
    "      if (gap >= _gapReportSec207() && GAME._offlineReport && ui.openOfflineReport) {\n"
    "        try { ui.openOfflineReport(); } catch (e207) { }\n"
    "      }\n"
    "    }\n"
    "    function _gapToast199(gap) {\n"
    "      ui.toast('\U0001f570\ufe0f 检测到时间跳变，已按现实时间补算 '\n"
    "        + (gap >= 3600 ? (gap / 3600).toFixed(1) + ' 时' : Math.round(gap / 60) + ' 分钟'));\n"
    "    }",
    'function _gapNotify207(gap)')

rep(MAIN, 'A12b 主循环调用点',
    "        } else if (_pulse199.mode === 'catchup' && _pulse199.gap >= _gapToastSec199()) {\n"
    "          _gapToast199(_pulse199.gap);\n"
    "        }",
    "        } else if (_pulse199.mode === 'catchup' && _pulse199.gap >= _gapToastSec199()) {\n"
    "          _gapNotify207(_pulse199.gap);   /* v89.207：轻提示 + 大缺口弹「离线纪要」 */\n"
    "        }",
    'v89.207：轻提示 + 大缺口弹')

rep(MAIN, 'A12c 唤醒调用点',
    "        if (r.gap >= _gapToastSec199()) _gapToast199(r.gap);",
    "        if (r.gap >= _gapToastSec199()) _gapNotify207(r.gap);   /* v89.207：同款（含离线纪要） */",
    '同款（含离线纪要）')

# ══════ A13 main.js：case 'bt-spd' ══════
rep(MAIN, 'A13 bt-spd case',
    "      case 'bt-replay': ui.sdOpenDone(); break;",
    "      case 'bt-replay': ui.sdOpenDone(); break;\n"
    "      /* v89.207（老板 1·快赢④）：战斗增速档（1\u00d7/2\u00d7/4\u00d7）—— 只重绘高亮，不重建宿主 */\n"
    "      case 'bt-spd': ui.btSpdSet(el.dataset.v); ui.btSpdRepaint();\n"
    "        ui.toast('观战速度 ' + ui.btSpdOf() + '\u00d7'); break;",
    "case 'bt-spd': ui.btSpdSet(el.dataset.v); ui.btSpdRepaint();")

print('=== A 批完成 ===')
