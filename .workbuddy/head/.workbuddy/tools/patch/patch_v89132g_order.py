# -*- coding: utf-8 -*-
"""v89.132 补丁 G：我城（红点 + 名称）压最后一层
诊断（diag_v89132_reddot.js 实测）：许都与某州城近邻重合时，我城红点被
miniLabels 的州城方点**整个盖住**（读我城中心像素 = 州城金 #ffd76a）——
这正是老板「我城的标注不清晰」的第二重病因（第一重是金点撞色 + 无名称）。
修法：把「我城点 + 我城名称」移到 labels 层**之后**绘制（自己的位置最优先）。
跑：python .workbuddy/tools/patch/patch_v89132g_order.py
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    assert '\r' not in s, 'CR 污染: ' + p
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

ui = rd('js/ui.js')

old = (
    "    /* v89.132：底部小图的「当前城」1Hz 闪烁（主循环每秒重绘时按秒奇偶取相位） */\n"
    "    var _blink = (opts && opts.meBlink)\n"
    "      ? ((Math.floor(Date.now() / 1000) % 2 === 0) ? 1 : 0.42) : 1;\n"
    "    (s.cities || []).forEach(function (c) {\n"
    "      var p = _win(c.x, c.y);\n"
    "      if (!p) return;                       /* 窗外的我城不画 */\n"
    "      if (c.id === ui._cityId) ctx.globalAlpha = _blink;\n"
    "      ui.miniMeDot(ctx, p[0], p[1], size, !!(opts && opts.meBig));\n"
    "      ctx.globalAlpha = 1;\n"
    "    });\n"
    "    /* v89.47：满界面档才画城名与大示意点（小图比例下它们不足 1px）\n"
    "       v89.68：下钻档走自己的标注层（聚焦档统一放大 + 锚点参照） */\n"
    "    if (opts && opts.labels) {\n"
    "      if (v.level) ui.miniFocusLabels(ctx, size, v);\n"
    "      else ui.miniLabels(ctx, size);\n"
    "      ui.miniMeLabels(ctx, size, v, _win);     /* v89.132：我城名称（红点旁标城名） */\n"
    "    }\n"
    "    return true;\n"
)
new = (
    "    /* v89.47：满界面档才画城名与大示意点（小图比例下它们不足 1px）\n"
    "       v89.68：下钻档走自己的标注层（聚焦档统一放大 + 锚点参照） */\n"
    "    if (opts && opts.labels) {\n"
    "      if (v.level) ui.miniFocusLabels(ctx, size, v);\n"
    "      else ui.miniLabels(ctx, size);\n"
    "    }\n"
    "    /* v89.132：我城（红点 + 名称）**压最后一层** —— 自己的位置最优先：\n"
    "       与名城近邻重合时也不被名城点盖住。实测（diag_v89132_reddot.js）：\n"
    "       许都紧邻州城，旧顺序下红点被州城金方点整个吃掉 ——\n"
    "       这正是老板「我城的标注不清晰」的第二重病因（第一重：金点撞色、无名称）。 */\n"
    "    /* 底部小图的「当前城」1Hz 闪烁（主循环每秒重绘时按秒奇偶取相位） */\n"
    "    var _blink = (opts && opts.meBlink)\n"
    "      ? ((Math.floor(Date.now() / 1000) % 2 === 0) ? 1 : 0.42) : 1;\n"
    "    (s.cities || []).forEach(function (c) {\n"
    "      var p = _win(c.x, c.y);\n"
    "      if (!p) return;                       /* 窗外的我城不画 */\n"
    "      if (c.id === ui._cityId) ctx.globalAlpha = _blink;\n"
    "      ui.miniMeDot(ctx, p[0], p[1], size, !!(opts && opts.meBig));\n"
    "      ctx.globalAlpha = 1;\n"
    "    });\n"
    "    if (opts && opts.labels) ui.miniMeLabels(ctx, size, v, _win);   /* 我城名称（红点旁） */\n"
    "    return true;\n"
)
n = ui.count(old)
assert n == 1, '锚点命中 ' + str(n) + ' 次'
ui = ui.replace(old, new)
assert ui.count('ui.miniMeLabels(ctx, size, v, _win)') == 1
assert ui.count('ui.miniMeDot(ctx, p[0], p[1], size') == 1
wr('js/ui.js', ui)
print('OK · ui.js', len(ui))
