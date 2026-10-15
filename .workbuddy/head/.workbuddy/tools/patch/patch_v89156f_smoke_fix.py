# -*- coding: utf-8 -*-
# v89.156 patch F：smoke 侦察用例摆前置（v89.156 侦察可失败 → 验别处的用例固定随机为成功）
#   + v89.66 出征四块断言升级（2×2 → 单列 + 可用道具入列 + 预估右列）
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

def rep(old, new, tag):
    global s
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        s = s.replace(old, new)
        print(tag + ' OK')
        return True
    if new[:80] in s:
        print(tag + ' skip（已落盘）')
        return False
    raise AssertionError(tag + ' anchor missing')

# ---------- ① 2830：首个 expedition scout（验"不带兵/耗体力"）----------
rep(
u"""  var rScout = G.battle.expedition({ kind: 'wild', x: 60, y: 60 }, 'scout', {}, gScout.id);
  check('侦查成功且不需带兵', rScout.ok === true && rScout.mode === 'scout', rScout.msg);""",
u"""  /* v89.156（老板 4）：侦察可失败 → 本用例验的是「不带兵 / 耗体力 / 回报守军」，
     摆前置：固定随机为**成功**（失败路径由 §156④ 专门验）。 */
  var rScout = withFixedRandom([0.001], function () {
    return G.battle.expedition({ kind: 'wild', x: 60, y: 60 }, 'scout', {}, gScout.id);
  });
  check('侦查成功且不需带兵', rScout.ok === true && rScout.mode === 'scout', rScout.msg);""",
'① 2830 摆前置')

# ---------- ② 4558：技巧满级 10 级（tgt 带守将甲 → 固定随机为成功）----------
rep(
u"""    var tgt = { kind: 'city', id: npc.id, npc: npc, lv: npc.level, name: npc.name,
      def: 20, dropType: 'county', guard: { name: '守将甲', tong: 80, yw: 70, zm: 60, nz: 50, level: 10 },
      garrison: { yibing: 100, changqiang: 40 } };
    var sc = G.battle.scoutTarget(tgt, stS.generals[0]);""",
u"""    var tgt = { kind: 'city', id: npc.id, npc: npc, lv: npc.level, name: npc.name,
      def: 20, dropType: 'county', guard: { name: '守将甲', tong: 80, yw: 70, zm: 60, nz: 50, level: 10 },
      garrison: { yibing: 100, changqiang: 40 } };
    /* v89.156：带守将 → 侦察可能失败 → 本用例验"分层全开"，固定随机为成功 */
    var sc = withFixedRandom([0.001], function () { return G.battle.scoutTarget(tgt, stS.generals[0]); });""",
'② 4558 摆前置')

# ---------- ③ 12254：v89.80 端到端（验"面板无锁定行"）----------
rep(
u"""        r = G.battle.expedition({ kind: 'city', id: npc.id }, 'scout', { changqiang: 50 }, gen.id);""",
u"""        /* v89.156（老板 4）：侦察可失败 → 本用例验"科技满级 → 面板无锁定行"，
           摆前置：固定随机为成功（失败路径不产出面板，与本用例无关）。 */
        r = withFixedRandom([0.001], function () {
          return G.battle.expedition({ kind: 'city', id: npc.id }, 'scout', { changqiang: 50 }, gen.id);
        });""",
'③ 12254 摆前置')

# ---------- ④ 13271：验"面板不出现 undefined"（真野地可能带守将）----------
rep(
u"""    var r = G.battle.expedition({ kind: 'wild', x: 34, y: 34 }, 'scout', {}, g.id);""",
u"""    /* v89.156：侦察可失败 → 固定随机为成功（本用例验的是"gNum 有值、面板不出 undefined"） */
    var r = withFixedRandom([0.001], function () {
      return G.battle.expedition({ kind: 'wild', x: 34, y: 34 }, 'scout', {}, g.id);
    });""",
'④ 13271 摆前置')

# ---------- ① ~ ④ 完成后立即落盘（防"后段失败 → 前段全丢"§53.3）----------
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke patch F ①~④ done, len', orig, '->', len(s))
# （⑤ v89.66 升级见 patch_v89156f2 —— 程序化抓段版）
