# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119a2_battle_fix.py — 补上 battle.js evLine 的函数收尾（v89.119）
# ----------------------------------------------------------------
# 主补丁 patch_v89119a 的 NEW_C 段**漏了函数自身的收尾 `}`**
# （切片 [i0,i1) 含原函数的收尾，新段只写到 forEach 的 `});`）→ node --check 报
# `Unexpected token ')'`。
# 教训（已写进项目技能）：整段替换的自检不能只比"净变化是否等于新旧段差值"，
# **还要断言新段自身配平**（d_new == 0）——否则"新旧段都欠一个 }"也会通过。
# ================================================================
import io, os, sys

R = 'E:/Deepseekdb/'
P = R + 'js/battle.js'
BAK = R + '.workbuddy/backup/v89119/battle.js'


def pc(s):
    return s.count('{') - s.count('}')


s = io.open(BAK, encoding='utf-8').read()          # 从干净备份出发
i0 = s.index("    function evLine(rr) {")
i1 = s.index("\n    }\n", i0) + len("\n    }")
old_seg = s[i0:i1]
assert 'parts.length >= 3' in old_seg and "e.kind === 'counter'" in old_seg, '锚点错'
assert pc(old_seg) == 0, '旧段自身不配平 %+d' % pc(old_seg)

NEW_C = '''    function evLine(rr) {
      var parts = [], hostOf = {};
      /* v89.119（老板「反击应该在敌方出手后…反击和对方出手记录在同一行」）：
         反击并入**引发它的那次出手**同一段，口径与回合记录/战报纪要一致
         （唯一配对规则：counter.targetId === 该出手的 id，且阵营相反）。 */
      (rr.events || []).forEach(function (e) {
        if (parts.length >= 3) return;
        if (e.kind === 'attack') {
          parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '→' + (e.target || '')
            + ' 杀 ' + U.numText(e.kill || 0, 0));
          if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = parts.length - 1;
        } else if (e.kind === 'counter') {
          var hk = (e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId;
          var hi = hostOf[hk];
          if (hi != null) parts[hi] += '（' + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0) + '）';
          else parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0));
        } else if (e.kind === 'tower') {
          parts.push('破塔 ' + (e.destroy || 0) + ' 座（余 ' + (e.left || 0) + '）');
        } else if (e.kind === 'wall') {
          parts.push('城头→' + (e.target || '') + ' 杀 ' + U.numText(e.kill || 0, 0));
        }
      });
      var s0 = parts.join('；');
      if (s0.length > maxEv) s0 = s0.slice(0, maxEv - 1) + '…';
      return s0;
    }'''

# ⚠️ 新段自身必须配平（这就是上一次漏掉收尾 } 的直接判据）
assert pc(NEW_C) == 0, '新段自身不配平 %+d' % pc(NEW_C)
s2 = s[:i0] + NEW_C + s[i1:]
assert pc(s2) == pc(s) == 0, '文件层面不配平 %+d / %+d' % (pc(s2), pc(s))
assert s2.count('function evLine(rr) {') == 1
tmp = P + '.tmp119a2'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s2)
os.replace(tmp, P)
print('  ✓ battle.js evLine 配对（新段自身配平 %+d · 文件配平 %+d）' % (pc(NEW_C), pc(s2)))
