# -*- coding: utf-8 -*-
"""v89.210 补丁 B —— ui.js：
   ① 环境状态条（skyBadgesOf / skyBadgeHTML / durRealOf + syncHeader 渲染）
   ② 弹窗键盘流（modalFocusables / modalFocusInit / modalKeyNav / 焦点描述回找）
   ③ 快照/回填加焦点、openModal/closeModal 接线、栈层快照
   ④ 出征面板「🎬 推演」键 + openExpSim / expSimHTML
   ⑤ 设置页键盘帮助行
   读一次 → 内存逐段改（每段幂等 guard）→ 一次性写盘（原子）→ 写后自检。
"""
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()
n0 = len(s)


def sec(tag, old, new, mark, cnt=1):
    global s
    if mark in s:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    s = s.replace(old, new)
    print('[ok] ' + tag)


# ---------------- B1a: 状态条函数组（插在 syncHeader 之前） ----------------
B1A_OLD = '  ui.syncHeader = function () {'
B1A_NEW = (
    '  /* ============================================================\n'
    '   * v89.210（老板「按建议执行」· 规划三）：**环境状态条**（至多 3 枚 · 仅"非默认态"）\n'
    '   * ------------------------------------------------------------\n'
    '   * 目标（v89.208 梳理点名的"0 动作面系统"可发现性）：把"由环境驱动、玩家不会\n'
    '   * 主动去玩"的四类状态显示在顶栏天时块右侧：来犯 / 民心低 / 天候 / 逾溢折损。\n'
    '   * 规则：**默认 / 正常态不显示**（没有消息就是正常 —— 防信息噪音）；只读现成\n'
    '   * 唯一出口、零新状态；点 chip = 跳到对应页 / 面板（data-action=sky-go）。\n'
    '   * 优先级（超 3 枚按此截断）：① 来犯 ② 民心低 ③ 天候 ④ 逾溢。\n'
    '   * 「离线补偿」明确**不做常驻 chip**（发生时已有「归来报告 / 离线纪要」弹窗）。\n'
    '   * ============================================================ */\n'
    '  ui.durRealOf = function (ms) {\n'
    '    var sec = Math.max(0, Math.round((ms || 0) / 1000));\n'
    "    if (sec < 60) return sec + '秒';\n"
    "    if (sec < 3600) return Math.floor(sec / 60) + '分';\n"
    '    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);\n'
    "    return m ? (h + '时' + m + '分') : (h + '时');\n"
    '  };\n'
    '  ui.skyBadgesOf = function () {\n'
    '    var s = GAME.state;\n'
    '    var out = [];\n'
    '    if (!s) return out;\n'
    '    /* ① 来犯：最近一场的倒计时（现实时间 —— invasionDueAt 已含 开关/解锁/轮转 全部口径） */\n'
    '    try {\n'
    '      if (GAME.invasionDueAt) {\n'
    '        var best = null;\n'
    '        (s.cities || []).forEach(function (ct) {\n'
    '          var due = GAME.invasionDueAt(ct);\n'
    '          if (due && (!best || due < best.due)) best = { due: due, city: ct };\n'
    '        });\n'
    '        if (best) {\n'
    '          var leftMs = best.due - GAME.realNow();\n'
    '          if (leftMs > 0) {\n'
    "            out.push({ id: 'inv', cls: 'sky-war', go: 'marches',\n"
    "              txt: '⚔ ' + ui.durRealOf(leftMs),\n"
    "              tip: '外敌来犯：' + best.city.name + ' 约 ' + ui.durRealOf(leftMs)\n"
    "                + '后遇袭（现实时间）· 点击到军务 · 烽火页布防' });\n"
    '          }\n'
    '        }\n'
    '      }\n'
    '    } catch (e1) { }\n'
    '    /* ② 民心低：任一城 ≤ 40（再败即尽） */\n'
    '    try {\n'
    '      var worst = null;\n'
    '      (s.cities || []).forEach(function (ct) {\n'
    '        var h = GAME.cityHeartsOf(ct);\n'
    '        if (h <= 40 && (!worst || h < worst.h)) worst = { h: h, city: ct };\n'
    '      });\n'
    '      if (worst) {\n'
    "        out.push({ id: 'hearts', cls: 'sky-hearts', go: 'city', city: worst.city.id,\n"
    "          txt: '💔 ' + worst.city.name + ' ' + Math.round(worst.h) + '%',\n"
    "          tip: '民心低：' + worst.city.name + ' 民心仅 ' + Math.round(worst.h)\n"
    "            + '%，再败即尽 · 点击查看该城' });\n"
    '      }\n'
    '    } catch (e2) { }\n'
    '    /* ③ 天候非晴：战斗 / 生产有修正（详细口径见悬停） */\n'
    '    try {\n'
    '      var we = (GAME.story && GAME.story.currentWeather) ? GAME.story.currentWeather() : null;\n'
    "      if (we && we.id !== 'clear') {\n"
    "        out.push({ id: 'weather', cls: 'sky-weather', go: '',\n"
    '          txt: we.icon + ' + "' '" + ' + we.name,\n'
    "          tip: '天候：' + we.name + ' —— ' + (we.desc || '') });\n"
    '      }\n'
    '    } catch (e3) { }\n'
    '    /* ④ 逾溢折损：任一城有资源超出仓容（正在被天灾慢慢吃掉） */\n'
    '    try {\n'
    '      var rotCity = null;\n'
    '      (s.cities || []).forEach(function (ct) {\n'
    '        if (rotCity) return;\n'
    '        var rows = GAME.overflowRotOf ? GAME.overflowRotOf(ct) : [];\n'
    '        if (rows && rows.length) rotCity = ct;\n'
    '      });\n'
    '      if (rotCity) {\n'
    "        out.push({ id: 'rot', cls: 'sky-rot', go: 'store',\n"
    "          txt: '🔥 逾溢折损',\n"
    "          tip: '仓廪逾溢：' + rotCity.name + ' 有资源超出仓容上限 —— 超出部分每游戏日折损 25%'\n"
    "            + '（现实约 ' + ui.rotPeriodRealText() + '）· 点击打开仓库' });\n"
    '      }\n'
    '    } catch (e4) { }\n'
    '    return out.slice(0, 3);\n'
    '  };\n'
    '  ui.skyBadgeHTML = function (b) {\n'
    "    if (!b) return '';\n"
    '    var act = b.go ? (\' data-action="sky-go" data-go="\' + b.go + \'"\'\n'
    "      + (b.city ? ' data-city=\"' + b.city + '\"' : '')) : '';\n"
    '    return \'<span class="sky-badge \' + (b.cls || \'\') + (b.go ? \'\' : \' sky-none\') + \'"\' + act\n'
    "      + ' title=\"' + U.escape(b.tip || b.txt) + '\">' + b.txt + '</span>';\n"
    '  };\n'
    '  ui.syncHeader = function () {'
)
sec('B1a 状态条函数组', B1A_OLD, B1A_NEW, 'ui.skyBadgesOf = function')

# ---------------- B1b: syncHeader 天空渲染段 ----------------
B1B_OLD = (
    "    var sky = $('#nav-sky');\n"
    '    if (sky) {\n'
    "      var line = GAME.story ? GAME.story.skyLine() : '';\n"
    '      /* v89.158：内容不变不重建（同头像 —— 内容变（换季/换天候）才重画） */\n'
    "      if (sky._sig !== (line || '')) {\n"
    "        sky._sig = (line || '');\n"
    "        sky.innerHTML = '<span class=\"ns-k\">天时</span>' + U.escape(line || '—');\n"
    '      }\n'
    '    }\n'
)
B1B_NEW = (
    "    var sky = $('#nav-sky');\n"
    '    if (sky) {\n'
    "      var line = GAME.story ? GAME.story.skyLine() : '';\n"
    '      /* v89.210（规划三）：环境状态条 —— 天时块右侧追加至多 3 枚「非默认态」chips\n'
    '         （数据走唯一出口 ui.skyBadgesOf；默认态为零枚 = 无消息即正常）。 */\n'
    '      var _bg210 = ui.skyBadgesOf ? ui.skyBadgesOf() : [];\n'
    "      var _bgSig = (line || '') + '|' + _bg210.map(function (b) { return b.txt; }).join('|');\n"
    '      /* v89.158：内容不变不重建（同头像 —— 内容变（换季/换天候/状态变）才重画） */\n'
    '      if (sky._sig !== _bgSig) {\n'
    '        sky._sig = _bgSig;\n'
    "        sky.innerHTML = '<span class=\"ns-k\">天时</span>' + U.escape(line || '—')\n"
    "          + _bg210.map(function (b) { return ui.skyBadgeHTML(b); }).join('');\n"
    '      }\n'
    '    }\n'
)
sec('B1b 天时渲染段', B1B_OLD, B1B_NEW, '_bg210')

# ---------------- B2: 弹窗键盘流函数组（插在 closeAllModals 之后） ----------------
B2_OLD = (
    '  ui.closeAllModals = function () {\n'
    '    ui._modalStack = [];\n'
    '    ui._modalCloseAll = false;     /* v89.135：防"closeAll 层调 closeModal"递归 */\n'
    '    ui._liveReopen = null;\n'
    '    ui.closeModal();\n'
    '  };\n'
)
B2_NEW = B2_OLD + (
    '  /* ============================================================\n'
    '   * v89.210（规划二 · 键盘流闭环）：弹窗内 Tab 焦点圈 / Enter 激活 / 开窗给焦点。\n'
    '   * ------------------------------------------------------------\n'
    '   * 三个具名出口（唯一出口纪律）：\n'
    '   *   ui.modalFocusables()  收集顶层弹窗内可交互元素（可见、未禁用）——\n'
    '   *                         div[data-action] 现场补 tabindex=-1 才能被 .focus()；\n'
    '   *   ui.modalFocusInit()   开窗 / 弹栈 / 回层时给焦点（焦点已在窗内则不动）；\n'
    '   *   ui.modalKeyNav(e)     main.js keydown 转发：Tab 手动循环（末→首回卷）·\n'
    '   *                         Enter 只激活 div[data-action]（真 button 交给浏览器默认；\n'
    '   *                         输入框内 Enter 不劫持；IME 组词不触发）。\n'
    '   * 桩环境（无 document.activeElement / querySelectorAll 恒空）自然空转 —— 零影响。\n'
    '   * ============================================================ */\n'
    '  ui.modalFocusables = function () {\n'
    '    var out = [];\n'
    '    try {\n'
    "      var root = $('#modal-root');\n"
    '      if (!root || !root.querySelectorAll) return out;\n'
    "      var box = root.querySelector('.modal') || root;\n"
    '      if (!box || !box.querySelectorAll) return out;\n'
    "      var list = box.querySelectorAll('button, input, select, textarea, [data-action]');\n"
    '      for (var i = 0; i < list.length; i++) {\n'
    '        var el = list[i];\n'
    '        if (!el || el.disabled === true) continue;\n'
    "        if (el.classList && el.classList.contains('hidden')) continue;\n"
    "        if (el.style && (el.style.display === 'none' || el.style.visibility === 'hidden')) continue;\n"
    "        if (el.getAttribute && el.getAttribute('type') === 'hidden') continue;\n"
    '        /* 非原生可聚焦元素（div[data-action]）补 tabindex，使其可被 .focus() */\n'
    "        var tag = el.tagName || '';\n"
    "        if (tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA' && tag !== 'A'\n"
    "            && el.setAttribute && !el.getAttribute('tabindex')) {\n"
    "          try { el.setAttribute('tabindex', '-1'); } catch (eT) { }\n"
    '        }\n'
    '        out.push(el);\n'
    '      }\n'
    '    } catch (e) { }\n'
    '    return out;\n'
    '  };\n'
    '  ui.modalFocusInit = function () {\n'
    '    try {\n'
    '      var ae = document.activeElement;\n'
    '      if (ae && ae !== document.body && ui._maskEl && ui._maskEl.isConnected\n'
    '          && ui._maskEl.contains && ui._maskEl.contains(ae)) return;   /* 焦点已在弹窗内：不动 */\n'
    '      var list = ui.modalFocusables();\n'
    '      if (!list.length) return;\n'
    '      if (list[0].focus) list[0].focus();\n'
    '    } catch (e) { }\n'
    '  };\n'
    '  ui.modalKeyNav = function (e) {\n'
    '    if (!e || e.isComposing) return false;\n'
    '    if (e.ctrlKey || e.metaKey || e.altKey) return false;\n'
    '    if (!(ui._maskEl && ui._maskEl.isConnected)) return false;\n'
    "    if (e.key === 'Tab') {\n"
    '      var list = ui.modalFocusables();\n'
    '      if (!list.length) return false;\n'
    '      var cur = null;\n'
    '      try { cur = document.activeElement; } catch (e0) { cur = null; }\n'
    '      var idx = -1;\n'
    '      for (var i = 0; i < list.length; i++) if (list[i] === cur) { idx = i; break; }\n'
    '      var next = idx < 0 ? 0 : ((idx + (e.shiftKey ? -1 : 1)) % list.length + list.length) % list.length;\n'
    '      try { if (list[next].focus) list[next].focus(); } catch (e1) { return false; }\n'
    '      if (e.preventDefault) e.preventDefault();\n'
    '      return true;\n'
    '    }\n'
    "    if (e.key === 'Enter') {\n"
    '      var ae = null;\n'
    '      try { ae = document.activeElement; } catch (e2) { ae = null; }\n'
    '      if (!ae || !ae.getAttribute) return false;\n'
    "      var tag = ae.tagName || '';\n"
    "      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A') return false;\n"
    "      if (!ae.getAttribute('data-action')) return false;\n"
    '      if (ae.click) {\n'
    '        ae.click();\n'
    '        if (e.preventDefault) e.preventDefault();\n'
    '        return true;\n'
    '      }\n'
    '    }\n'
    '    return false;\n'
    '  };\n'
    '  /* 焦点描述 / 回找（v89.210 · live 重建与弹栈回填共用）——按"稳定描述"重查：\n'
    '     优先 id；否则 tag + data-action + 同类序号（不赌节点引用，重建后仍可寻回）。 */\n'
    '  ui._focusDescOf = function () {\n'
    '    try {\n'
    '      var ae = document.activeElement;\n'
    '      if (!ae || ae === document.body || !ae.getAttribute) return null;\n'
    "      var root = $('#modal-root');\n"
    '      if (!root || !root.contains || !root.contains(ae)) return null;\n'
    '      if (ae.id) return { id: ae.id };\n'
    "      var act = ae.getAttribute('data-action');\n"
    "      if (!act) return null;\n"
    "      var tag = ae.tagName || '';\n"
    "      var sel = tag + '[data-action=\"' + act + '\"]';\n"
    '      var all = root.querySelectorAll(sel);\n'
    '      var idx = 0;\n'
    '      for (var i = 0; i < all.length; i++) if (all[i] === ae) { idx = i; break; }\n'
    '      return { sel: sel, idx: idx };\n'
    '    } catch (e) { return null; }\n'
    '  };\n'
    '  ui._focusFindOf = function (d) {\n'
    '    try {\n'
    '      if (!d) return null;\n'
    "      var root = $('#modal-root');\n"
    '      if (!root || !root.querySelector) return null;\n'
    '      var el = null;\n'
    '      if (d.id) {\n'
    "        try { el = root.querySelector('[id=\"' + d.id + '\"]'); } catch (e1) { el = null; }\n"
    '      } else if (d.sel) {\n'
    '        var all = root.querySelectorAll(d.sel);\n'
    '        el = all[d.idx] || all[0] || null;\n'
    '      }\n'
    '      if (el && el.focus) { el.focus(); return el; }\n'
    '      return null;\n'
    '    } catch (e2) { return null; }\n'
    '  };\n'
)
sec('B2 弹窗键盘流函数组', B2_OLD, B2_NEW, 'ui.modalKeyNav = function')

# ---------------- B3a: _liveSnap 焦点字段 ----------------
sec('B3a-1 快照 out 结构',
    '    var out = { vals: {}, scrolls: [] };',
    '    var out = { vals: {}, scrolls: [], focus: null };',
    '    var out = { vals: {}, scrolls: [], focus: null };')
sec('B3a-2 快照记焦点',
    '      for (var j = 0; j < scs.length; j++) out.scrolls.push(scs[j].scrollTop || 0);\n'
    '    } catch (e) { }\n'
    '    return out;\n'
    '  };',
    '      for (var j = 0; j < scs.length; j++) out.scrolls.push(scs[j].scrollTop || 0);\n'
    '      out.focus = ui._focusDescOf();   /* v89.210：焦点描述（重建后回填） */\n'
    '    } catch (e) { }\n'
    '    return out;\n'
    '  };',
    'out.focus = ui._focusDescOf();')

# ---------------- B3b: _liveRestore 焦点回填 ----------------
sec('B3b 回填焦点',
    '      for (var j = 0; j < scs.length && j < (snap.scrolls || []).length; j++) {\n'
    '        if (snap.scrolls[j]) scs[j].scrollTop = snap.scrolls[j];\n'
    '      }\n'
    '    } catch (e) { }\n'
    '  };',
    '      for (var j = 0; j < scs.length && j < (snap.scrolls || []).length; j++) {\n'
    '        if (snap.scrolls[j]) scs[j].scrollTop = snap.scrolls[j];\n'
    '      }\n'
    '      if (snap.focus) ui._focusFindOf(snap.focus);   /* v89.210：焦点回填（键盘流） */\n'
    '    } catch (e) { }\n'
    '  };',
    'ui._focusFindOf(snap.focus)')

# ---------------- B4a: openModal 尾部给焦点 ----------------
sec('B4a openModal 尾部',
    '    ui.softenBlocked(root);                   /* v89.189：分支 1/2 统一收口 */\n'
    '    ui._paintModalX();\n'
    '    root._visible = true;\n'
    '  };',
    '    ui.softenBlocked(root);                   /* v89.189：分支 1/2 统一收口 */\n'
    '    ui._paintModalX();\n'
    '    root._visible = true;\n'
    '    ui.modalFocusInit();   /* v89.210：开窗即给焦点（键盘流）——焦点已在窗内则不动 */\n'
    '  };',
    'ui.modalFocusInit();   /* v89.210：开窗即给焦点')

# ---------------- B4b: 回到已存在层给焦点 ----------------
sec('B4b 回层给焦点',
    '          ui.softenBlocked(root);               /* v89.189：受阻按钮转「可点+说明」 */\n'
    '          ui._paintModalX();\n'
    '          root._visible = true;\n'
    '          return;',
    '          ui.softenBlocked(root);               /* v89.189：受阻按钮转「可点+说明」 */\n'
    '          ui._paintModalX();\n'
    '          root._visible = true;\n'
    '          ui.modalFocusInit();   /* v89.210：回到该层也给焦点（键盘流） */\n'
    '          return;',
    'ui.modalFocusInit();   /* v89.210：回到该层也给焦点')

# ---------------- B4c: 压栈记快照 ----------------
sec('B4c 压栈记快照',
    "        ui._modalStack.push({ html: inner0 ? inner0.innerHTML : '', cls: box.className,\n"
    '          title: curTitle, marks: ui._modalMarks(),\n'
    '          live: ui._liveReopen, closeAll: ui._modalCloseAll });   /* v89.135 */',
    "        ui._modalStack.push({ html: inner0 ? inner0.innerHTML : '', cls: box.className,\n"
    '          title: curTitle, marks: ui._modalMarks(),\n'
    '          /* v89.210：栈层记"输入值 / 滚动位 / 焦点"快照 —— 弹栈时回填（键盘流手感连续） */\n'
    '          snap: ui._liveSnap(),\n'
    '          live: ui._liveReopen, closeAll: ui._modalCloseAll });   /* v89.135 */',
    'snap: ui._liveSnap(),')

# ---------------- B5: 弹栈回填 ----------------
sec('B5 弹栈回填',
    '        if (ui._liveReopen) {\n'
    '          try { ui._liveRedraw = true; ui._liveReopen(); }\n'
    '          catch (e2) { /* 重绘失败：保留旧快照（与 v89.117 的诚实缺口同口径） */ }\n'
    '          finally { ui._liveRedraw = false; }\n'
    '        }\n'
    '        return;',
    '        if (ui._liveReopen) {\n'
    '          try { ui._liveRedraw = true; ui._liveReopen(); }\n'
    '          catch (e2) { /* 重绘失败：保留旧快照（与 v89.117 的诚实缺口同口径） */ }\n'
    '          finally { ui._liveRedraw = false; }\n'
    '        }\n'
    '        /* v89.210：弹栈回填 —— 输入值 / 滚动位 / 焦点（回上一层手感连续；键盘流） */\n'
    '        try { ui._liveRestore(lv.snap); } catch (eSnap210) { }\n'
    '        ui.modalFocusInit();\n'
    '        return;',
    'ui._liveRestore(lv.snap)')

# ---------------- B6: 出征面板「🎬 推演」键 ----------------
sec('B6 出征面板推演键',
    "      + (ui._expOwn ? '🚚 起运（兵 + 辎重）' : (cur.icon + ' ' + cur.name)) + '</button>' +\n"
    '      /* v89.186（老板 2）：「出征界面提供快购按钮（专用于战役）」——',
    "      + (ui._expOwn ? '🚚 起运（兵 + 辎重）' : (cur.icon + ' ' + cur.name)) + '</button>' +\n"
    '      /* v89.210（老板拍板）：🎬 战前推演 —— 仅战斗方式显示（本境调运 / 侦查无战役需求）。 */\n'
    "      ((ui._expOwn || !cur.battle) ? '' : '<button class=\"btn\" data-action=\"exp-sim\" title=\"沙盘推演：按当前选择预演一场（与实战同一引擎 · 不扣兵不落账）\">🎬 推演</button>') +\n"
    '      /* v89.186（老板 2）：「出征界面提供快购按钮（专用于战役）」——',
    'data-action="exp-sim"')

# ---------------- B7: openExpSim / expSimHTML ----------------
B7_OLD = '  ui.expCargoHTML = function (c) {'
B7_NEW = (
    '  /* ============================================================\n'
    '   * v89.210（老板拍板 · 不留遗留）：**战前推演** —— 出征前预演一场。\n'
    '   * ------------------------------------------------------------\n'
    '   * 全部口径走 GAME.battle.previewOf（与实战同一引擎 / 同一输入构造，见 battle.js）；\n'
    '   * 本段只做"读选择 → 调推演 → 渲染结果"，**不落任何账**（不扣兵、不发兵）。\n'
    '   * ============================================================ */\n'
    '  ui.openExpSim = function () {\n'
    '    var target = ui._expTarget;\n'
    "    if (!target) { ui.toast('请先选择目标'); return; }\n"
    "    var mode = ui._expMode || 'occupy';\n"
    "    var genSel = document.getElementById('exp-gen');\n"
    '    var atk = ui.expArmyOf ? ui.expArmyOf() : {};\n'
    "    if (!Object.keys(atk).length) { ui.toast('请先选择推演兵力'); return; }\n"
    '    /* v89.137 同款：己方野地已有驻将 → 不带将（与出发口径一致） */\n'
    '    var _stGen = false;\n'
    "    if (ui._expRes && ui._expRes.kind === 'wild') {\n"
    '      var _wm = GAME.map.wildAt(ui._expRes.x, ui._expRes.y);\n'
    '      _stGen = !!(_wm && _wm.garrison && _wm.garrison.genId);\n'
    '    }\n'
    '    var pv = GAME.battle.previewOf(target, mode, atk,\n'
    "      _stGen ? '' : (genSel ? genSel.value : ''),\n"
    '      { scheme: _stGen ? null : (ui._expScheme || null) });\n'
    "    if (!pv.ok) { ui.toast(pv.msg || '无法推演'); return; }\n"
    '    ui.openModal(ui.expSimHTML(pv));\n'
    '  };\n'
    '  /* 推演结果面板（纯展示；关闭走右上角 ✕ / Esc —— 弹栈即回出征面板，输入值不丢） */\n'
    '  ui.expSimHTML = function (pv) {\n'
    '    var r = pv.result || {};\n'
    '    var t = pv.t || {};\n'
    "    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');\n"
    "    var win = r.winner === 'atk';\n"
    "    var rows = '';\n"
    '    rows += \'<div class="res-line"><span class="lbl">⚔ 推演结果</span><span class="val">\'\n'
    "      + (win ? '胜' : '负') + ' · ' + (r.rounds || 0) + ' 回合'\n"
    "      + (win ? '' : '（此战不利 —— 建议增兵 / 易将 / 改日再战）') + '</span></div>';\n"
    '    rows += \'<div class="res-line"><span class="lbl">我方损失</span><span class="val">\'\n'
    "      + U.fmt(r.atkLoss || 0) + ' · 尚存 ' + U.fmt(r.atkRemain || 0) + '</span></div>';\n"
    '    rows += \'<div class="res-line"><span class="lbl">敌方损失</span><span class="val">\'\n'
    "      + U.fmt(r.defLoss || 0) + ' · 尚存 ' + U.fmt(r.defRemain || 0) + '</span></div>';\n"
    '    if (mode.occupy && GAME.siegeScopeOf && GAME.siegeScopeOf(t)) {\n'
    '      var st = GAME.siegeStateOf(t);\n'
    '      var hold0 = st ? (st.hold == null ? 100 : st.hold) : 100;\n'
    '      if (win) {\n'
    '        var chip = GAME.siegeChipOf();\n'
    '        var hold1 = Math.max(0, hold0 - chip);\n'
    '        rows += \'<div class="res-line"><span class="lbl">围攻推进</span><span class="val">民心 \'\n'
    "          + Math.round(hold0) + '% → ' + Math.round(hold1) + '%（第 '\n"
    "          + ((st ? (st.waves || 0) : 0) + 1) + ' 波）'\n"
    "          + (hold1 <= 0 ? ' · 民心已尽，下一胜可拔城' : '') + '</span></div>';\n"
    '      } else {\n'
    '        rows += \'<div class="res-line"><span class="lbl">围攻进度</span><span class="val">民心 \'\n'
    "          + Math.round(hold0) + '% 未动（得胜方可夺其民心）</span></div>';\n"
    '      }\n'
    '    }\n'
    '    if (pv.def && pv.def.scNote) {\n'
    '      rows += \'<div class="res-line"><span class="lbl">计略</span><span class="val">\'\n'
    '        + U.escape(pv.def.scNote) + \'</span></div>\';\n'
    '    }\n'
    '    return \'<div class="gold-heading">🎬 沙盘推演 —— \' + U.escape(t.name || \'\') + \'</div>\' +\n'
    '      \'<div class="set-card">\' + rows + \'</div>\' +\n'
    '      \'<div class="ui-sub" style="margin-top:8px;">推演与实战采用<b>同一战斗引擎</b>\'\n'
    "      + '（同输入同结果 · 不扣兵、不落账）；未计入行军期间的天时 / 科技变化与战前斗将'\n"
    "      + '（随机触发，胜者全军 +10%）。</div>';\n"
    '  };\n'
    '  ui.expCargoHTML = function (c) {'
)
sec('B7 推演 UI', B7_OLD, B7_NEW, 'ui.openExpSim = function')

# ---------------- B8: 设置页键盘帮助行 ----------------
sec('B8 设置页帮助行',
    "          ui.help('页面运行的是\"打开那一刻\"的代码；本行为运行时版本（GAME.VERSION）。') + '</div>' +\n"
    "      '</div>' +\n",
    "          ui.help('页面运行的是\"打开那一刻\"的代码；本行为运行时版本（GAME.VERSION）。') + '</div>' +\n"
    "        '<div class=\"ui-sub\" style=\"margin-top:6px;\">键盘：<b>1-9</b> 切页 · <b>Shift+1-5</b> 续号（史册 / 故事集 / 公文 / 自动 / 设置）· <b>Esc</b> 关弹窗 · 弹窗内 <b>Tab / Enter</b> 导航</div>' +\n"
    "      '</div>' +\n",
    '键盘：<b>1-9</b> 切页')

# ---------------- 写盘 + 自检 ----------------
for mk in ['ui.skyBadgesOf = function', 'ui.modalKeyNav = function', 'ui.openExpSim = function',
           'out.focus = ui._focusDescOf();', 'ui._focusFindOf(snap.focus)',
           'snap: ui._liveSnap(),', 'ui._liveRestore(lv.snap)', 'data-action="exp-sim"',
           '_bg210', '键盘：<b>1-9</b> 切页']:
    assert mk in s, '缺标记：' + mk
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('写入完成 ' + str(n0) + ' -> ' + str(len(s)) + ' 字节')
print('done')
