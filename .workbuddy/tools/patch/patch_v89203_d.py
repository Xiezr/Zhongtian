# -*- coding: utf-8 -*-
"""v89.203 批次D：① 弹窗打开时 toast 上浮屏幕中上部（老板 1）② onConquer 拒绝补 toast（老板 3 反馈）"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

# ============================================================
# D1 · index.html：.toast.high（弹窗打开时上浮中上部）
# ============================================================
rep('D1 toast.high CSS', R + 'index.html',
    "  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }",
    "  .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }\n"
    "  /* v89.203（老板 1）：「强化的弹窗信息放在屏幕中上部，不要挡住操作按钮」——\n"
    "     弹窗打开时提示条**上浮到屏幕中上部**（top 13% = 画布 117px，在弹窗标题行之下、\n"
    "     正文上部）：xxl 强化/蕴养面板的底部是操作键区，提示条留在底部会挡住「强化/蕴养」\n"
    "     键（点一次挡一次）。无弹窗时保持底部 30px（原习惯不变）。 */\n"
    "  .toast.high { top: 13%; bottom: auto; }\n"
    "  .toast.high:not(.show) { transform: translateX(-50%) translateY(-16px); }",
    ".toast.high { top: 13%; bottom: auto; }")

# ============================================================
# D2 · ui.js：notify 里按"弹窗是否打开"切 high 类
# ============================================================
rep('D2 notify high 类', R + 'js/ui.js',
    "    var el = $('#toast');\n"
    "    el.innerHTML = ui._notes.map(function (n) {\n"
    "      return '<div class=\"toast-line t-' + n.type + '\">' + U.escape(n.msg) + '</div>';\n"
    "    }).join('');\n"
    "    el.classList.add('show');",
    "    var el = $('#toast');\n"
    "    el.innerHTML = ui._notes.map(function (n) {\n"
    "      return '<div class=\"toast-line t-' + n.type + '\">' + U.escape(n.msg) + '</div>';\n"
    "    }).join('');\n"
    "    /* v89.203（老板 1）：弹窗打开 → 提示条上浮到屏幕中上部（不挡底部操作键）；\n"
    "       无弹窗 → 保持底部（原习惯不变）。判定 = 模态元素在册且仍在文档中。 */\n"
    "    el.classList.toggle('high', !!(ui._maskEl && ui._maskEl.isConnected));\n"
    "    el.classList.add('show');",
    "el.classList.toggle('high', !!(ui._maskEl && ui._maskEl.isConnected))")

# ============================================================
# D3 · battle.js：onConquer 满编拒绝 → 醒目 toast（与日志同文案）
# ============================================================
rep('D3 onConquer toast', R + 'js/battle.js',
    "    var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };\n"
    "    if (!_cc108.ok) {\n"
    "      GAME.log.war('⚠️ ' + npcCity.name + ' 城垣已破，但' + _cc108.msg + ' —— 此城未能纳入版图');\n"
    "      return { ok: false, msg: _cc108.msg };\n"
    "    }",
    "    var _cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };\n"
    "    if (!_cc108.ok) {\n"
    "      /* ⛔ v89.203（老板 3）：此前拒绝只进「战争日志」—— 玩家打赢后城没进来会一头雾水\n"
    "         （\"占领了名城却没有归属\"的观感来源之一）。补一条**醒目 toast**（与日志同文案）。\n"
    "         引擎尾部已有 GAME.ui 钩子先例（onBattleDone / moment / sfx），此处同款、缺 ui 时降级。 */\n"
    "      var _m203 = '⚠️ ' + npcCity.name + ' 城垣已破，但' + _cc108.msg + ' —— 此城未能纳入版图';\n"
    "      GAME.log.war(_m203);\n"
    "      if (GAME.ui && GAME.ui.notify) GAME.ui.notify('warn', _m203.slice(2));\n"
    "      return { ok: false, msg: _cc108.msg };\n"
    "    }",
    "v89.203（老板 3）：此前拒绝只进「战争日志」")

print('批次D 完成')
