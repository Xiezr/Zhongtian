# -*- coding: utf-8 -*-
"""v89.137 补丁 K：battle.js —— station 出发前预检（驻军上限）+ 无将硬闸 + 计谋护栏"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'battle.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

rep(
"""    /* v89.87（老板需求 2）：调兵 / 驻守 / 采集的前置校验（统一出口的口子） */
    if (mode.id === 'transfer' && t.kind !== 'owncity') return { ok: false, msg: '调兵目标须为本境城池' };
    if (mode.id === 'station' && !(t.kind === 'wild' && GAME.map.wildAt(t.x, t.y))) {
      return { ok: false, msg: '驻守目标须是已属我方的野地' };
    }""",
"""    /* v89.87（老板需求 2）：调兵 / 驻守 / 采集的前置校验（统一出口的口子） */
    if (mode.id === 'transfer' && t.kind !== 'owncity') return { ok: false, msg: '调兵目标须为本境城池' };
    if (mode.id === 'station') {
      if (!(t.kind === 'wild' && GAME.map.wildAt(t.x, t.y))) {
        return { ok: false, msg: '驻守目标须是已属我方的野地' };
      }
      /* ============================================================
       * v89.137（老板 7）：驻守（增援）的三道出发前判据 —— 入口统一到出征界面后的补全。
       * ① 驻军上限预检：超限**不发兵**（比"到了再折返"少一趟白跑）。
       *    真正的硬判仍在 `GAME.wildGarrisonAdd` 的 overflow（抵达时兜底，兵不丢）；
       *    上限口径与 ui / domain 同一把尺（GAME.wildGarrisonCap）。
       * ② **无将硬闸**：野地已有驻将 → 增援一律不带将（界面传什么都不会把将带走、
       *    也不会白扣体力）—— 与 `wildGarrisonAdd` 的"genId 只在空位写入"同规。
       * ③ 计谋护栏：不带将不能施计（schemePrepare 会报"需要主将施计"，
       *    这里提前给更清楚的文案；界面在"已有驻将"时也不会带计谋提交）。
       * ============================================================ */
      var _w137b = GAME.map.wildAt(t.x, t.y);
      var _cap137b = GAME.wildGarrisonCap(_w137b.level);
      var _have137b = GAME.wildGarrisonTotal(_w137b.garrison);
      var _men137b = 0;
      for (var _k137b in (atkArmy || {})) _men137b += Math.floor(atkArmy[_k137b] || 0);
      if (_cap137b > 0 && _have137b + _men137b > _cap137b) {
        return { ok: false, msg: '驻军上限 ' + U.numText(_cap137b, 0) + '（' + _w137b.level + ' 级野地 ×'
          + U.numText(DATA.WILD_GARRISON.perLevel, 0) + '）：现有 ' + U.numText(_have137b, 0)
          + '，本次 ' + U.numText(_men137b, 0) + ' 将超出' };
      }
      if (_w137b.garrison && _w137b.garrison.genId) {
        if (gen) gen = null;                       /* ② 无将硬闸（已有驻将） */
        else if (opts && opts.scheme) {
          return { ok: false, msg: '不带将的增援不能施计（计谋须主将施展）' };
        }
      }
    }""",
'station 预检/硬闸')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert '_cap137b' in chk and '_w137b.garrison.genId' in chk, '未落盘'
assert chk.count('{') == chk.count('}'), '花括号不配平 %d/%d' % (chk.count('{'), chk.count('}'))
print('✅ battle.js 补丁K 完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))
