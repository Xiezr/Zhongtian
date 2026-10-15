# -*- coding: utf-8 -*-
"""patch_v89115g_guard.py — 需求 1：守将属性对守城全军加成（全覆盖）"""
import io, os, sys
R = 'E:/Deepseekdb/'
def read(p): return io.open(R + p, encoding='utf-8').read()
def write(p, s):
    tmp = R + p + '.tmp115g'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
def sub1(s, old, new, label):
    n = s.count(old)
    if n != 1:
        print('!! [%s] 匹配 %d\n   首行: %s' % (label, n, old.split('\n')[0][:90])); sys.exit(1)
    return s.replace(old, new, 1)

# ---- ① tactic.js：守城守方统率覆盖 → 全覆盖 ----
T = read('js/tactic.js')
OLD = """      /* 统率覆盖：统率×100 之内吃满加成，超出部分不吃（与本作既有口径一致） */
      var covered = a ? Math.min(n, a.tong * 100 * (1 + TB('command'))) : 0;
      var cover = (a && n > 0) ? covered / n : 0;"""
NEW = """      /* 统率覆盖：统率×100 之内吃满加成，超出部分不吃（与本作既有口径一致）。
         v89.115（老板「守将在守城作战中，其属性对参与守城的军队（也就是城内所有军队）
         进行属性加成」）：**守城战**（ctx.playerDef 且本方为守方）改为**全覆盖** ——
         守将的属性加成不打统率折扣（"城内所有军队"人人有份）；
         野战/攻城的口径不动（统率覆盖 = 阵前指挥半径，是既有语义）。
         ⚠️ NPC 守城不在此列（其守将为系统派生，口径保持原样，不给攻城平衡添变量）。 */
      var covered = a ? Math.min(n, a.tong * 100 * (1 + TB('command'))) : 0;
      var cover = (a && n > 0) ? covered / n : 0;
      if (ctx && ctx.playerDef && side === 'def' && a) cover = 1;"""
T = sub1(T, OLD, NEW, 'tactic 守城全覆盖')
write('js/tactic.js', T)
print('  ✓ tactic.js')

# ---- ② ui.js：城池面板守将行显示"守城全军加成" ----
U = read('js/ui.js')
OLD2 = """          '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
            (guard ? U.escape(guard.name) + ' Lv' + guard.level
                   + '　<span class="ui-sub">征兵·对阵</span>' : '<span class="ui-sub">未任命</span>') + '</span></div>'"""
NEW2 = """          '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
            (guard ? (function () {
              /* v89.115：守城全军加成就地可见（与实战同一原子 genAttrs.atkPct/defPct）——
                 守城战时**不打统率折扣**（全覆盖），界面读的就是这个数。 */
              var ga = GAME.genAttrs(guard);
              return U.escape(guard.name) + ' Lv' + guard.level +
                '　<span class="ui-sub">征兵·对阵　·　守城全军加成：攻 +' +
                Math.round((ga.atkPct || 0) * 100) + '%　防 +' + Math.round((ga.defPct || 0) * 100) +
                '%</span>';
            })() : '<span class="ui-sub">未任命</span>') + '</span></div>'"""
U = sub1(U, OLD2, NEW2, '城池面板守将加成')
write('js/ui.js', U)
print('  ✓ ui.js')
print('ALL DONE')
