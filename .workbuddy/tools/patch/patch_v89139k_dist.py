# -*- coding: utf-8 -*-
"""v89.139 批九：tactic.js 距离口径修正（MARCH_ROUNDS_MIN 3→2 + FIELD_MIN 恢复 1400）
   论证：×3（=速度和×3）会让**所有配兵都恰好 3 回合接敌** —— 速度差异被抹平，
   与老板「考虑兵种速度」的意图相反；×2 只抬高"快 vs 快"的下限（防 1 回合贴脸），
   慢组合仍由 FIELD_MIN 1400 兜底 → 快者（2 回合）仍先于慢者（3~5 回合）接敌。"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'tactic.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []


def rep(old, new, tag):
    global s
    cnt = s.count(old)
    assert cnt == 1, '%s 锚点命中 %d 次' % (tag, cnt)
    s = s.replace(old, new)
    ok.append(tag)


rep("""     新口径 = **两个下限取大**：
       ① 最远射程 + MARGIN（原版规则，保证远程方的"进入射程"过程）；
       ② (双方最快单位速度之和) × MARCH_ROUNDS_MIN —— 让接敌**至少走 N 回合**，
          跑的兵终于按自己的脚程说话（民夫 vs 民夫 3 回合、铁骑 vs 铁骑 3 回合）。
     速度口径与引擎推进**同一把尺**（`t.spd × spdMult(t)`，见 unitsOf 的 spd 字段），
     所以"几步接敌"的推算与实战逐回合记录一致。 */
  T.FIELD_MARGIN = 299;
  /* 最少接敌回合（v89.139）：接敌回合 = ⌈D ÷ (vA+vD)⌉ ≥ 本值。
     v89.95 老板要求"接敌要走 3~5 回合" —— 这里把它量化成公式的一部分。 */
  T.MARCH_ROUNDS_MIN = 3;
  /* 绝对保底（防极端小速度配兵把 D 压到"一步贴脸"）——
     v89.139 从 1400 调到 600：真正的保底不再是常数值，而是上面 ② 那条速度下限。 */
  T.FIELD_MIN = 600;""",
"""     新口径 = **三个下限取大**：
       ① 最远射程 + MARGIN（原版规则，保证远程方的"进入射程"过程）；
       ② (双方最快单位速度之和) × MARCH_ROUNDS_MIN —— **快 vs 快**时把纵深撑开，
          防"两个精锐骑兵第 1 回合互撞"（老板 v89.95 抱怨的"一步到面前"）；
       ③ FIELD_MIN 1400 保底（慢速组合：民夫互殴也不至于 1 回合贴脸）。
     速度口径与引擎推进**同一把尺**（`t.spd × spdMult(t)`，见 unitsOf 的 spd 字段），
     所以"几步接敌"的推算与实战逐回合记录一致。
     ⚠️ MARCH_ROUNDS_MIN 为什么是 2 而不是 3：
       接敌回合 R = ⌈D ÷ (vA+vD)⌉；若 ②用 ×3，则 D ≥ 3(vA+vD) → **所有配兵都恰好
       3 回合接敌**（速度差异被完全抹平，与"考虑兵种速度"的意图相反）。
       ×2 只抬高快组合的下限：轻骑 vs 义兵 2 回合、长枪 vs 义兵 3 回合、
       民夫互殴 4 回合、投石压阵 5 回合 —— 快者仍先接敌，慢者不再 1 回合贴脸。 */
  T.FIELD_MARGIN = 299;
  /* 快 vs 快的最少接敌回合（接敌回合 = ⌈D ÷ (vA+vD)⌉ ≥ 本值），见上方 ⚠️ 论证 */
  T.MARCH_ROUNDS_MIN = 2;
  /* 绝对保底（v89.95 立的规矩：接敌要走几回合）——慢速组合由它兜底 */
  T.FIELD_MIN = 1400;""",
    'FIELD_MIN/MARCH_ROUNDS_MIN 修正')

assert '\r\n' not in s
assert s.count('{') == s.count('}'), '花括号不配平'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert 'T.MARCH_ROUNDS_MIN = 2;' in chk and 'T.FIELD_MIN = 1400;' in chk, '落盘校验失败'
print('✅ tactic.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
