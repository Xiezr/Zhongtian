# -*- coding: utf-8 -*-
"""v89.151 批 B：tactic.js —— snapUnits 的 cp() 补全引擎消费字段（血 NaN 根因）"""
import io

P = 'E:/Deepseekdb/js/tactic.js'
s = io.open(P, encoding='utf-8', newline='').read()

OLD = """    function snapUnits() {
      function cp(u) {
        return { side: u.side, id: u.id, name: u.name, count: u.count, adv: Math.round(u.adv),
                 spd: u.spd, range: u.range, er: Math.round(effRangeFor(u)),   /* v89.104：有效射程 */
                 stance: u.stance, target: u.target || '', vsCity: !!u.vsCity };
      }"""

NEW = """    function snapUnits() {
      /* ============================================================
       * v89.151（老板 5）：「战中兵种悬停显示的血都是零」——病根：本函数**手写字段清单**，
       *   只抄了 11 个，漏了引擎结算与悬停都要读的 6 个
       *   （`hpPer` / `atkPct` / `defPct` / `cover` / `start` / `sortie`）——
       *   `perHp()` 读 `u.hpPer` 得 undefined → `Math.max(1, NaN)` = **NaN** →
       *   悬停显示"血 0（基础 1800）"、全军血量 0，攻/防也丢了全部加成
       *   （显示的是无加成的兵种基础值）。语法过、测试过、零报错。
       *   ⚠️ 与 v89.142 的 `rec.sim` 漏存 duel/genSim 是**同族事故**（§56.1）——
       *     "手写字段清单的打包函数"必须逐字段核对（smoke §131 有对账断言）。
       *   ⛔ 快照只服务 UI（战场渲染/悬停/沙盘起点），多带字段零副作用；
       *     但**字段清单从此以引擎 unitsInit 为准** —— 加字段要同步这里与断言。
       * ============================================================ */
      function cp(u) {
        return { side: u.side, id: u.id, name: u.name, count: u.count, adv: Math.round(u.adv),
                 spd: u.spd, range: u.range, er: Math.round(effRangeFor(u)),   /* v89.104：有效射程 */
                 stance: u.stance, target: u.target || '', vsCity: !!u.vsCity,
                 /* v89.151：以下 6 项 = 引擎结算链（perAtk/perDef/perHp）的输入 —— 缺一即静默失真 */
                 hpPer: u.hpPer, cover: u.cover || 0, atkPct: u.atkPct || 0, defPct: u.defPct || 0,
                 start: u.start || 0, sortie: !!u.sortie };
      }"""

assert s.count(OLD) == 1, 'count=' + str(s.count(OLD))
s = s.replace(OLD, NEW)
assert '\r\n' not in s
assert s.count('hpPer: u.hpPer, cover: u.cover') == 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('tactic.js 落盘 OK · len=' + str(len(s)))
