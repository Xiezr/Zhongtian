# -*- coding: utf-8 -*-
"""v157.98 · 下线「这一带似乎有动静」痕迹体系（老板指令）

老板：「把"这一带似乎有动静"相关地块色去掉，下线相应任务体系，我记得我已经让你下线掉前传了」

它本来就是**前传（v92.6 构想 A2）**的东西：迷雾边缘按概率给未探明格泛一层暖褐色，
提示"那边有东西"。前传退役后它成了孤儿：既没有玩法承接，又让地图多出一批
"说不清是什么的色块"（老板 v157.77 就抱怨过色块没名字）。

清理范围（整条链，不留死代码）：
  · js/data.js    DATA.FOG.traceChance（概率配置）
  · js/map3d.js   涂色（_tint/_tk 写 'trace'）
                  悬停 facts（"地面泛着暖褐色…"）
                  TK_DESC.trace 条目
                  点击 toast（"这一带似乎有动静…"）
"""
import io

# ---------------- data.js ----------------
P1 = 'js/data.js'
s1 = io.open(P1, encoding='utf-8', newline='').read()
a1 = """    /* v92.6（构想 A2）：迷雾边缘的**半信息痕迹**概率 —— 紧贴已探明区的未探明格，
       有这个比例会显示一颗暗红烟点。知道"那边有东西"，但不知道是什么。
       纯视觉：不给地形、不给等级、点不开。只回答"往哪走"。 */
    traceChance: 0.28,
"""
assert s1.count(a1) == 1, 'd1'
s1 = s1.replace(a1, "")
assert 'traceChance' not in s1
assert '\r\n' not in s1
io.open(P1, 'w', encoding='utf-8', newline='').write(s1)
print('data.js: traceChance removed')

# ---------------- map3d.js ----------------
P2 = 'js/map3d.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()

# ① 悬停 facts：去掉 trace 分支，统一走"还没有记载"
a2 = """      var _tkH = null;
      try { _tkH = (GAME.map3d && GAME.map3d._tintKind) ? GAME.map3d._tintKind[ci] : null; } catch (e5) { _tkH = null; }
      if (_tkH === 'trace') {
        out.facts.push('地面泛着暖褐色：这一带似乎有动静（不知是什么）');
        out.tasks.push('派一队过去探明 —— 抵达后才知道是什么');
      } else {
        out.facts.push('这一带还没有记载');
        out.tasks.push('派一队过去（点它 = 派队），抵达后周围显现');
      }
      return out;"""
b2 = """      out.facts.push('这一带还没有记载');
      out.tasks.push('派一队过去（点它 = 派队），抵达后周围显现');
      return out;"""
assert s2.count(a2) == 1, 'm1'
s2 = s2.replace(a2, b2)

# ② TK_DESC 去掉 trace，并把"6 类"改成"5 类"
a3 = """     * 整格涂色有 6 类来源（痕迹 / 营地 / 村社 / 遗迹 / 我方占领 / 阵亡纪念）。"""
b3 = """     * 整格涂色有 5 类来源（营地 / 村社 / 遗迹 / 我方占领 / 阵亡纪念）。
     * ⚠️ v157.98：「迷雾边缘的动静痕迹」已整条退役（老板指令）—— 它是前传
     *    （v92.6 构想 A2）的遗留，前传下线后既没有玩法承接，又让地图多出一批
     *    "说不清是什么的色块"。别再把它加回来。"""
assert s2.count(a3) == 1, 'm2'
s2 = s2.replace(a3, b3)

a4 = """      trace: '迷雾边缘的动静痕迹',
"""
assert s2.count(a4) == 1, 'm3'
s2 = s2.replace(a4, "")

# ③ 点击 toast 整段删除
a5 = """    /* ============================================================
     * v157.77（老板：「要么悬停显示，要么点击显示」）
     * ------------------------------------------------------------
     * 未探明 + 有动静痕迹的格子，点击后给一句说明再照常开面板：
     * 不改变任何流程（该派队还是派队），只回答"这块褐色是什么"。
     * 仍然不说"是什么"——v92.6 的半信息口径。
     * ============================================================ */
    try {
      var _hidC = !!(GAME.fog && GAME.fog.get && GAME.fog.get(ci) === 0);
      var _tkC = (M._tintKind) ? M._tintKind[ci] : null;
      if (_hidC && _tkC === 'trace' && ui.toast) {
        ui.toast('这一带似乎有动静（未探明）—— 派一队过去才知道是什么');
      }
    } catch (e7) { /* 提示失败不挡面板 */ }
"""
assert s2.count(a5) == 1, 'm4'
s2 = s2.replace(a5, "")

# ④ 涂色块整段删除
start = s2.index("    /* ============================================================\n     * v92.6（构想 A2：半信息痕迹）")
end = s2.index("    /* v92.4：已发现的幸存者营地")
assert 0 < start < end, 'm5'
s2 = s2[:start] + "    /* ⛔ v157.98：「迷雾边缘的动静痕迹」涂色已退役（见 §586q 相关注释）——\n       它属于已下线的前传（v92.6 构想 A2），删除后未探明区只剩「干净未探明」一种长相。 */\n" + s2[end:]

assert "traceChance" not in s2
assert "_tk[_ti] = 'trace'" not in s2
assert '这一带似乎有动静' not in s2
assert "'trace'" not in s2
assert '\r\n' not in s2
io.open(P2, 'w', encoding='utf-8', newline='').write(s2)
print('map3d.js: trace chain removed')
