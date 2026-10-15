# -*- coding: utf-8 -*-
"""v90.87 复核：chains ③ 链抵达结算改走 march.tick（唯一推进出口 · 先出队再结算）。"""
import io

P = 'E:/Deepseekdb/.workbuddy/tools/audit/audit_v89105_chains.js'
s = io.open(P, encoding='utf-8').read()

OLD = """step('抵达结算：march.arrive 走真实抵达链（胜/负/破防）', function () {
  var m = (G.state.marches || [])[0];
  if (!m) return { ok: false, msg: '无在途档（上一步被拦）' };
  /* ⛔ v90.87（复核）：改走 **march.arrive** —— 它是真实抵达出口，内部调 expedition
     并收尾将领状态（复位 idle）。原先直调内层 expedition：将领仍处 'march'，
     被 prepare 正确拦下（"正在行军/派遣，不可另接调遣"）→ 工具假红。 */
  var r = G.march.arrive(m);
  if (r && r.ok === false) return r;
  return { note: '回合 ' + (r && r.rounds || '-') + ' · ' + String((r && r.msg) || '已抵达结算').slice(0, 46) };
});"""

NEW = """step('抵达结算：march.tick 推进到抵达（唯一推进出口 · 先出队再结算）', function () {
  var m = (G.state.marches || [])[0];
  if (!m) return { ok: false, msg: '无在途档（上一步被拦）' };
  /* ⛔ v90.87（复核）：必须走 **march.tick** —— 真实链路是"时间到 → tick 先把该档移出
     s.marches → 再调 arrive"。若直接调 arrive（条目仍在队列），将领被 marchBlockOf
     正确硬拦（"正在行军/派遣，不可另接调遣"）→ 工具假红（产品行为是对的）。 */
  m.elapsed = m.totalTime + 1;        /* 时间到（真实玩法由主循环推进） */
  G.march.tick();                     /* 唯一推进出口 */
  var rep = null;
  (G.state.reports || []).forEach(function (x) { if (!rep && x.type === 'war') rep = x; });
  if (!rep) throw new Error('抵达了但没有战报落公文');
  return { note: '战报已落公文 · 在途 ' + ((G.state.marches || []).length) + ' 支' };
});"""

MARK = 'march.tick 推进到抵达'
if MARK in s:
    print('[skip] 已改')
else:
    assert s.count(OLD) == 1, 'anchor count=' + str(s.count(OLD))
    io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(OLD, NEW))
    print('[ok] ③ 链改走 march.tick')

s2 = io.open(P, encoding='utf-8').read()
assert MARK in s2, 'selfcheck fail'
print('[selfcheck] ok')
