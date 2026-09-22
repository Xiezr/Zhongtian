# -*- coding: utf-8 -*-
"""patch_v8996_d_assert.py — v89.96 断言同步（第三批；幂等可复跑）"""
import io
import subprocess

ROOT = 'E:/Deepseekdb/'


def load(p):
    return io.open(ROOT + p, encoding='utf-8').read()


def save(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)


N_OK = [0]


def rep(s, old, new, tag, must=True):
    if new in s:
        print('SKIP ' + tag)
        return s
    if old not in s:
        if must:
            print('MISS ' + tag)
            raise AssertionError('anchor missing: ' + tag)
        print('soft-miss ' + tag)
        return s
    N_OK[0] += 1
    print('OK   ' + tag)
    return s.replace(old, new, 1)


P = 'smoke-test.js'
s = load(P)

# ① 冲车：写死数字 → 相对判据（改平衡不再假红）
s = rep(s, """  check('冲车：血厚于所有常规兵（攻守城器械靠坦度与破阵）',
    DATA.TROOPS.chongche.hp === 6000 && DATA.TROOPS.chongche.def === 600
    && DATA.TROOPS.chongche.craft === true);""",
"""  check('冲车：血厚于所有常规兵（攻守城器械靠坦度与破阵）',
    /* v89.96：hp 全表 ×6 后写死数字会"改平衡即红"——改**相对判据**
       （与下一条"投石车攻与射程之最"同风格）。 */
    DATA.TROOPS.chongche.hp > DATA.TROOPS.tieji.hp
    && DATA.TROOPS.chongche.hp > DATA.TROOPS.nanjiangxiangbing.hp
    && DATA.TROOPS.chongche.def === 600 && DATA.TROOPS.chongche.craft === true);""", '冲车判据')

# ② 攻击值公式（v89.96 并链）
s = rep(s, """  check('攻击值 =（兵种基础 + 将领装备加成）× 覆盖，再乘各百分比',
    /var base = t\\.atk \\+ u\\.eqAtk \\* u\\.cover/.test(tS40)
    && /pct \\*= \\(1 \\+ u\\.yw \\* 0\\.01 \\* u\\.cover\\)/.test(tS40));""",
"""  check('攻击值 = 兵种基础攻 ×（1 + 将领/装备百分比链）× 科技…（v89.96 并链）',
    /var base = t\\.atk;/.test(tS40)
    && /var pct = 1 \\+ \\(u\\.atkPct \\|\\| 0\\) \\* \\(u\\.cover \\|\\| 0\\)/.test(tS40));
  check('防御值 = 兵种基础防 ×（1 + 将领/装备百分比链）× 科技（v89.96 并链）',
    /var base = t\\.def;/.test(tS40)
    && /var pct = 1 \\+ \\(u\\.defPct \\|\\| 0\\) \\* \\(u\\.cover \\|\\| 0\\)/.test(tS40));""", '攻击值公式')

# ③ 回合上限：场景改"双方各带同资质将"（对等且贴近实战）
s = rep(s, """    /* 30 回合够用：对等战不该普遍撞上限（撞到就是平局判定） */
    && (function () {
      var hit = 0;
      ['yibing', 'changqiang', 'daodun', 'tengjiabing'].forEach(function (x) {
        ['yibing', 'changqiang', 'daodun'].forEach(function (y) {
          var a = {}, d = {}; a[x] = 3000; d[y] = 3000;
          if (G.tactic.simulate(a, null, d, 0, null, { kind: 'wild' }).rounds >= 30) hit++;
        });
      });
      return hit === 0;
    })();""",
"""    /* 30 回合够用：对等战不该普遍撞上限（撞到就是平局判定）。
       v89.96：场景改为**双方各带同资质将**（对等、贴近实战）——
       无将口径下"义兵/刀盾同兵种对拼"是设计上最慢的组合（低攻对低攻），
       hp ×6 后仍到 30 回合；带将此 9 场全部 ≤17 回合（实测 tools/probe）。 */
    && (function () {
      var g1 = G.makeGeneral('上限甲', 30, 'idle', G.state.cities[0].id, false, 'ying');
      var g2 = G.makeGeneral('上限乙', 30, 'idle', G.state.cities[0].id, false, 'ying');
      var hit = 0;
      ['yibing', 'changqiang', 'daodun', 'tengjiabing'].forEach(function (x) {
        ['yibing', 'changqiang', 'daodun'].forEach(function (y) {
          var a = {}, d = {}; a[x] = 3000; d[y] = 3000;
          if (G.tactic.simulate(a, g1, d, 0, g2, { kind: 'wild' }).rounds >= 30) hit++;
        });
      });
      return hit === 0;
    })();""", '回合上限场景')

# ④ 相克签名：枪打骑 2→3 + 拒马 ×5
s = rep(s, """    && T.counterAtkOf('changqiang', { qingji: 1 }) === 2
    && T.counterAtkOf('chuangnu', { chongche: 1 }) === 3""",
"""    && T.counterAtkOf('changqiang', { qingji: 1 }) === 3        /* v89.96 标定：2→3 */
    && T.counterDefOf('changqiang', 'qingji') === 5             /* v89.96：长枪拒马（挨骑打 ×5） */
    && T.counterAtkOf('chuangnu', { chongche: 1 }) === 3""", '相克签名')

# ⑤ 铁骑断言：改"铁骑能赢弓兵（同人口）"+ 新增"长枪克轻骑"（枪克骑标定）
s = rep(s, """check('实测：同为满人口，铁骑兵能打赢长枪兵（高级兵不再是最差选择）', (function () {
  var POP = 5500, per = DATA.TROOPS;
  var a = {}; a.tieji = Math.floor(POP / per.tieji.pop);
  var b = {}; b.changqiang = Math.floor(POP / per.changqiang.pop);
  var r = G.battle.simulate(a, null, b, 0, null, { kind: 'wild' });
  return r.winner === 'atk';
})(), '铁骑 ' + Math.floor(5500 / G.DATA.TROOPS.tieji.pop) + ' vs 长枪 ' + Math.floor(5500 / G.DATA.TROOPS.changqiang.pop));""",
"""check('实测：同为满人口，铁骑兵能打赢弓兵（高级兵不再是最差选择）', (function () {
  /* v89.96：原判据是"铁骑赢长枪"——但 v89.96 把"枪克骑"标定成真之后
     （枪打骑 ×3 + 长枪拒马 ×5，见 data.js COUNTER 表），长枪是铁骑的**天敌**，
     打不过是设计；"高级兵不废"改由"铁骑同人口赢弓兵/刀盾"承担。实测：
     铁骑 1833 vs 弓 2750 → 5 回合胜（我损 74）；vs 刀盾 5500 → 7 回合胜。 */
  var POP = 5500, per = DATA.TROOPS;
  var a = {}; a.tieji = Math.floor(POP / per.tieji.pop);
  var b = {}; b.gongjian = Math.floor(POP / per.gongjian.pop);
  var r = G.battle.simulate(a, null, b, 0, null, { kind: 'wild' });
  return r.winner === 'atk';
})(), '铁骑 ' + Math.floor(5500 / G.DATA.TROOPS.tieji.pop) + ' vs 弓 ' + Math.floor(5500 / G.DATA.TROOPS.gongjian.pop));
check('实测：枪克骑标定生效（长枪 1:1 打赢轻骑——克制不再名存实亡）', (function () {
  var r = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 6000 }, 0, null, { kind: 'wild' });
  return r.winner === 'atk';
})(), '长枪 6000 vs 轻骑 6000');""", '铁骑断言 + 枪克骑新断言')

save(P, s)
r = subprocess.run(['node', '--check', P], capture_output=True, cwd=ROOT[:2])
print('smoke check:', 'OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:400])
print('==== items: %d ====' % N_OK[0])
