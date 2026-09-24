# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119d_checkfn.py — 修「把函数当布尔传」的恒真断言（v89.119）
# ----------------------------------------------------------------
# 病根：smoke 的 `check(name, cond, extra)` 里 `if (cond)` 不调用函数 ——
#   把 `function () { return X; }` 当第二参传进去 → 函数对象恒 truthy → **断言恒过**。
# 本仓的正确写法是 **IIFE**：`check('…', (function () { … })(), extra)`。
#
# 处置：
#   ① 上轮（v89.118）§98 的"保真度/对照"两条 → 改 IIFE（修完若变红就是抓到了假绿背后的真问题）；
#   ② 本轮 §100 的 ③④⑤⑦ → 直接传求值后的 cX.ok；
#   ③ §100 ④ 的"独立段"负向正则原来会把**括号内的**反击也命中（误报）——
#      改成"按分号分段、段内不含（ 才算独立"。
# ================================================================
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
BAK = 'E:/Deepseekdb/.workbuddy/backup/v89119/smoke-test.js'
s = io.open(P, encoding='utf-8').read()

FIX = [
    # ① §98 保真度（v89.118 遗留的恒真）
    ("""      check('④ 保真度：原始 verify=true；**篡改全局后带着快照重跑仍 true**', function () {
        return !!v0 && v0.verify === true && !!v1 && v1.verify === true;
      }, dbg || '未取到战报');""",
     """      check('④ 保真度：原始 verify=true；**篡改全局后带着快照重跑仍 true**', (function () {
        return !!v0 && v0.verify === true && !!v1 && v1.verify === true;
      })(), dbg || '未取到战报');"""),
    # ② §98 对照
    ("""      check('④ 对照：**清掉快照**后同一批篡改使 verify=false（证明快照在起作用）', function () {
        return !!v2 && v2.verify === false;
      }, dbg || '未取到战报');""",
     """      check('④ 对照：**清掉快照**后同一批篡改使 verify=false（证明快照在起作用）', (function () {
        return !!v2 && v2.verify === false;
      })(), dbg || '未取到战报');"""),
    # ③ §100 ③
    ("""    check('③ 实测：counter 事件数 == 行内反击数（配对无遗漏·无独立段）', function () { return c3.ok; }, c3.dbg);""",
     """    check('③ 实测：counter 事件数 == 行内反击数（配对无遗漏·无独立段）', c3.ok, c3.dbg);"""),
    # ④ §100 ④（判据 + 正则）
    ("""        var lone = joined.match(/；[^；\\n]*?反击 [^；\\n]*?杀伤/g) || [];""",
     """        /* ⚠️ 负向正则不能只查"；…反击…杀伤" —— 那会把**括号里**的反击也命中（误报）。
           正确口径：按分号分段，**段内不含"（"** 才算独立反击段（兜底路径才会长这样）。 */
        var lone = joined.split('；').filter(function (x) { return /反击 杀伤/.test(x) && x.indexOf('（') < 0; });"""),
    ("""    check('④ 引擎纪要：反击与出手段同段（无独立反击段）', function () { return c4.ok; }, c4.dbg);""",
     """    check('④ 引擎纪要：反击与出手段同段（无独立反击段）', c4.ok, c4.dbg);"""),
    # ⑤ §100 ⑤
    ("""    check('⑤ 回放帧：反击并入出手段（若有反击必为括号配对；帧非空）', function () { return c5.ok; }, c5.dbg);""",
     """    check('⑤ 回放帧：反击并入出手段（若有反击必为括号配对；帧非空）', c5.ok, c5.dbg);"""),
    # ⑥ §100 ⑦
    ("""    check('⑦ 同名兵种互射不串台（配对键带阵营）', function () { return c7.ok; }, c7.dbg);""",
     """    check('⑦ 同名兵种互射不串台（配对键带阵营）', c7.ok, c7.dbg);"""),
]

for i, (a, b) in enumerate(FIX):
    n = s.count(a)
    if n != 1:
        print('!! 修 %d 匹配 %d 次 → 中止' % (i + 1, n))
        i0 = s.find(a.split('\n')[0][:50])
        print('   实际上下文: ' + repr(s[max(0, i0 - 30):i0 + 120]))
        sys.exit(1)
    s = s.replace(a, b, 1)
    print('  ✓ 修 %d' % (i + 1))

b = io.open(BAK, encoding='utf-8').read()
d = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
print('花括号净变化 %+d（IIFE 增加 ( ) 不涉及花括号）' % d)
tmp = P + '.tmp119d'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('七处已修')
