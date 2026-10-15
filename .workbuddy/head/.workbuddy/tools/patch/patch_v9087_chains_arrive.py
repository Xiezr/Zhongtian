# -*- coding: utf-8 -*-
"""v90.87 复核：chains ③ 出征链改为走真实抵达出口 march.arrive。
（原写法直调内层 battle.expedition —— 跳过 arrive 的将领状态收尾，
 此时将领仍处 'march'，被 prepare 正确拦下 → 假红。§43.5「必须走用户真实链路」。）"""
import io

P = 'E:/Deepseekdb/.workbuddy/tools/audit/audit_v89105_chains.js'
s = io.open(P, encoding='utf-8').read()

OLD = """step('抵达结算：expedition 出结果（胜/负/破防）', function () {
  var m = (G.state.marches || [])[0];
  if (!m) return { ok: false, msg: '无在途档（上一步被拦）' };
  var r = G.battle.expedition(m.target, m.modeId, m.army, m.genId,
    { arrived: true, cityId: m.cityId, ops: 'assault' });
  if (r && r.ok === false) return r;
  return { note: '回合 ' + (r.rounds || '-') + ' · ' + String(r.msg || '').slice(0, 46) };
});"""

NEW = """step('抵达结算：march.arrive 走真实抵达链（胜/负/破防）', function () {
  var m = (G.state.marches || [])[0];
  if (!m) return { ok: false, msg: '无在途档（上一步被拦）' };
  /* ⛔ v90.87（复核）：改走 **march.arrive** —— 它是真实抵达出口，内部调 expedition
     并收尾将领状态（复位 idle）。原先直调内层 expedition：将领仍处 'march'，
     被 prepare 正确拦下（"正在行军/派遣，不可另接调遣"）→ 工具假红。 */
  var r = G.march.arrive(m);
  if (r && r.ok === false) return r;
  return { note: '回合 ' + (r && r.rounds || '-') + ' · ' + String((r && r.msg) || '已抵达结算').slice(0, 46) };
});"""

MARK = 'march.arrive 走真实抵达链'
if MARK in s:
    print('[skip] 已改')
else:
    assert s.count(OLD) == 1, 'anchor count=' + str(s.count(OLD))
    io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(OLD, NEW))
    print('[ok] ③ 链改走 march.arrive')

s2 = io.open(P, encoding='utf-8').read()
assert MARK in s2, 'selfcheck fail'
print('[selfcheck] ok')
