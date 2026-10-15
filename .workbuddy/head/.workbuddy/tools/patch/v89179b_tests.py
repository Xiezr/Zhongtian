# -*- coding: utf-8 -*-
"""v89.179b —— 测试升级：克制全撤后的断言口径（smoke 多处升级 + §179 新段 + e2e 文案）
幂等：所有 edit 在已应用时按 [already] 跳过；§179 段按标记防重复。"""
import io, sys
R = 'E:/Deepseekdb/'
FAILS = []

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def E(s, name, old, new, cnt=1):
    global FAILS
    n = s.count(old)
    if n == cnt:
        return s.replace(old, new)
    if n == 0 and new and new[:36] in s:
        print('  [already] ' + name); return s
    FAILS.append(name + ' (hit=' + str(n) + ')'); print('  ❌ ' + name + ' hit=' + str(n)); return s

s = rd('smoke-test.js')
print('===== smoke-test.js =====')

# 1) 杀伤链 regex
s = E(s, 'S1 杀伤链 regex',
      '''    /* v57：杀伤里多了相克的**防御向**因子 */
    && /var cf = T\\.clashFactor\\(perA, T\\.perDef\\(tg, \\{ defMul: defMul \\}\\)\\)/.test(tS40));''',
      '''    /* v89.179：克制全撤后杀伤只剩 perAtk × 防御对冲 ÷ 生命（无对局态因子） */
    && /var cf = T\\.clashFactor\\(perA, T\\.perDef\\(tg\\)\\)/.test(tS40));''')

# 2) 枪克骑实测 → 骑兵赢面实测
old2 = """check('实测：枪克骑标定生效（同人口胜；同数量（骑2倍人口）重创敌军 ≥55%）', (function () {
  /* v89.178：克制降档后口径升级（枪×2.5 / 拒马×3）——
     同人口（6000 枪 vs 3000 骑，各 6000 pop）长枪**胜**；
     同数量（骑 2 倍人口）**败但敌损 ≥55%**（靠克制顶住人口劣势）。
     改前实测：同数量也胜（损 42%）—— 那是克制过强的证据（2 倍人口劣势还能赢）。 */
  var r1 = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 3000 }, 0, null, { kind: 'wild' });
  if (r1.winner !== 'atk') return false;
  var r2 = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 6000 }, 0, null, { kind: 'wild' });
  return r2.defLoss >= 6000 * 0.55;
})(), '同人口胜 · 同数量敌损 ≥55%');"""
new2 = """check('实测：骑兵对枪兵保有赢面（同人口骑胜 · 同数量（骑2倍人口）大胜）——无克制口径', (function () {
  /* v89.179（老板「取消所有克制关系，直接按兵种纸面数据计算」）：克制全撤后
     战斗只看 TROOPS 纸面数值 ——
       同人口（6000 枪 vs 3000 骑，各 6000 pop）骑兵**胜**（实测骑损 ~34%）；
       同数量（骑 2 倍人口）骑兵**大胜**（实测骑损 ~7%）。
     历史：v89.96（×3/×5）同数量枪胜；v89.178（×2.5/×3）同人口枪胜 ——
     都是"克制翻转胜负"；全撤后由纸面数值裁决（复核见 docs/v89179）。 */
  var r1 = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 3000 }, 0, null, { kind: 'wild' });
  if (r1.winner !== 'def') return false;
  var r2 = G.battle.simulate({ changqiang: 6000 }, null, { qingji: 6000 }, 0, null, { kind: 'wild' });
  return r2.winner === 'def' && r2.defLoss <= 6000 * 0.2 && r1.defLoss >= 3000 * 0.1 && r1.defLoss <= 3000 * 0.5;
})(), '骑胜双局（阈值：同人口骑损 10%~50% · 同数量 ≤20%）');"""
s = E(s, 'S2 骑兵赢面实测', old2, new2)

# 3) 相克查询 → 出口退役
s = E(s, 'S3 相克查询退役', """check('相克查询收的是**兵种 id**（签名不一致会让整套防御向静默失效）', (function () {
  var T = G.tactic;
  return T.counterDefOf('daodun', 'gongjian') === 2
    && T.counterDefOf('daodun', 'chuangnu') === 2
    && T.counterDefOf('qingji', 'gongjian') === 2
    && T.counterDefOf('tieji', 'toudan') === 1.5
    && T.counterDefOf('chongche', 'gongjian') === 3
    /* 原版明确：冲车只防**弓**，不防弩、不防投 */
    && T.counterDefOf('chongche', 'toudan') === 1
    && T.counterAtkOf('changqiang', { qingji: 1 }) === 2.5      /* v89.178：3→2.5 */
    && T.counterDefOf('changqiang', 'qingji') === 3             /* v89.178：拒马 5→3 */
    && T.counterAtkOf('chuangnu', { chongche: 1 }) === 3        /* v89.178：器械专项保留 */
    /* B 套明确否掉的两条：盾打枪、骑打弓 —— 都没有加成 */
    && T.counterAtkOf('daodun', { changqiang: 1 }) === 1
    && T.counterAtkOf('qingji', { gongjian: 1 }) === 1
    /* 旧的那张单向互克表与 ×1.5 必须已删（不留第二出口） */
    && DATA.COUNTER === undefined && DATA.COUNTER_MULT === undefined;
})());""",
      """check('相克查询出口已退役（v89.179 全撤；v57"签名不一致"的坑成为历史）', (function () {
  /* 历史：v57 防御向出口曾误收 army 对象 → 整套防御向静默失效（靠实测打印才发现）。
     v89.179 克制全撤后，两出口与两表一并删除 —— 结构断言见 §179①。 */
  return G.tactic.counterAtkOf === undefined && G.tactic.counterDefOf === undefined
    && DATA.COUNTER === undefined && DATA.COUNTER_MULT === undefined
    && DATA.COUNTER_ATK === undefined && DATA.COUNTER_DEF === undefined;
})());""")

# 4) 防御向相克实测 → 纸面防御排序
s = E(s, 'S4 纸面防御排序', """check('实测：防御向相克真的生效（弓打冲车 ≪ 打刀盾 ≪ 打长枪）', (function () {
  var kill = function (def) {
    var r = G.tactic.simulate({ gongjian: 1000 }, null, def, 0, null, { kind: 'wild' });
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'attack' && e.side === 'atk') n += e.kill; });
    });
    return n;
  };
  var vsQiang = kill({ changqiang: 1000 });   /* 长枪无防御向 */
  var vsDun = kill({ daodun: 1000 });         /* 刀盾防远程 ×3 */
  var vsChe = kill({ chongche: 1000 });       /* 冲车防弓 ×5 */
  return vsQiang > vsDun && vsDun > vsChe;
})()""",
      """check('实测：防守差异只由纸面防御决定（弓打长枪 > 打刀盾 > 打冲车）——无克制口径', (function () {
  /* v89.179：防御向表退役后，排序改由纸面数值决定（实测杀伤 473 / 340 / 18）：
     长枪（防150·血1800）> 刀盾（防250·血2400）> 冲车（防600·血36000 巨肉）。 */
  var kill = function (def) {
    var r = G.tactic.simulate({ gongjian: 1000 }, null, def, 0, null, { kind: 'wild' });
    var n = 0;
    (r.roundsLog || []).forEach(function (rr) {
      (rr.events || []).forEach(function (e) { if (e.kind === 'attack' && e.side === 'atk') n += e.kill; });
    });
    return n;
  };
  var vsQiang = kill({ changqiang: 1000 });
  var vsDun = kill({ daodun: 1000 });
  var vsChe = kill({ chongche: 1000 });
  return vsQiang > vsDun && vsDun > vsChe && vsChe > 0;
})()""")
s = E(s, 'S4b 展示行', """  return '弓1000 的杀伤：打长枪 ' + kill({ changqiang: 1000 }) + ' / 打刀盾 ' + kill({ daodun: 1000 }) +
    ' / 打冲车 ' + kill({ chongche: 1000 });""",
      """  return '弓1000 的杀伤：打长枪 ' + kill({ changqiang: 1000 }) + ' / 打刀盾 ' + kill({ daodun: 1000 }) +
    ' / 打冲车 ' + kill({ chongche: 1000 }) + '（纸面防御越高越难射穿）';""")

# 5) 相克补两项 → 全撤作废
s = E(s, 'S5 相克补两项', """check('相克补两项：虎豹骑同轻骑（防远程×2）、西凉铁骑同铁骑（×1.5）；突骑仍无',
  G.tactic.counterDefOf('hubaoqi', 'gongjian') === 2
  && G.tactic.counterDefOf('hubaoqi', 'toudan') === 2
  && G.tactic.counterDefOf('xiliangtieqi', 'gongjian') === 1.5
  && G.tactic.counterDefOf('tuqibing', 'gongjian') === 1
  /* 依据必须写在数据里（是"同族类比"而非原版点名，不许后人误当成原文出处） */
  && /同族类比/.test(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'data.js'), 'utf8')));""",
      """check('相克补两项（v59 · 虎豹/西凉 防远程因子）已随全撤作废 —— 判据升级为"表已退役 + 墓碑在册"',
  DATA.COUNTER_ATK === undefined && DATA.COUNTER_DEF === undefined
  && G.tactic.counterDefOf === undefined
  && /取消所有克制关系/.test(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'data.js'), 'utf8')));""")

# 6) §96 ⑨ 两条升级
s = E(s, 'S6 §96⑨a', """    check('⑨ 南疆象兵不设克制（两张相克表都无它；强度靠自身数值 —— 骑兵族 hp/pop 最高）', (function () {
      var A = D96.COUNTER_ATK.changqiang || {}, Df = D96.COUNTER_DEF.changqiang || {};
      var T = D96.TROOPS, xb = T.nanjiangxiangbing;
      var top = true;
      Object.keys(T).forEach(function (id) {
        if (id === 'nanjiangxiangbing') return;
        if ((T[id].cat || '') !== 'cav') return;         /* 只与骑兵族比（冲车等器械不算） */
        if (T[id].hp / T[id].pop > xb.hp / xb.pop) top = false;
      });
      return A.nanjiangxiangbing === undefined && Df.nanjiangxiangbing === undefined && top;
    })());""",
      """    check('⑨（v89.179 升级）全表零克制：象兵不再是孤例；骑兵族 hp/pop 最高仍成立', (function () {
      var T = D96.TROOPS, xb = T.nanjiangxiangbing;
      var top = true;
      Object.keys(T).forEach(function (id) {
        if (id === 'nanjiangxiangbing') return;
        if ((T[id].cat || '') !== 'cav') return;         /* 只与骑兵族比（冲车等器械不算） */
        if (T[id].hp / T[id].pop > xb.hp / xb.pop) top = false;
      });
      return D96.COUNTER_ATK === undefined && D96.COUNTER_DEF === undefined && top;
    })());""")
s = E(s, 'S7 §96⑨b', """    check('⑨ **高战力 + 零克制**的漏网之鱼：零（象兵那种"无弱点"的兵种不存在了）', (function () {
      /* 判据（老板要的是"没有无弱点的兵种"，不是"每支都必须在克制表里"）：
         每人口攻击 ≥170 **且** 每人口有效生命 ≥4000 = "高战力档"（铁骑/西凉铁骑/象兵这一档）——
         这一档必须至少有一条克制关系（自己克人、或被人克）。
         低战力兵种（义兵 / 民夫 / 特殊州兵）不在此判据内：它们的取舍在成本与门槛上，
         实测（probe_v89116_stats）：义兵 vs 长枪 5 回合全灭只换 17 人，本就不需要额外克制。 */
      var T = D96.TROOPS, bad = [], noRel = [];
      Object.keys(T).forEach(function (id) {
        var t = T[id];
        if (t.nocombat || t.craft) return;
        var has = !!(D96.COUNTER_ATK[id] || D96.COUNTER_DEF[id]);
        var inOther = false;
        [D96.COUNTER_ATK, D96.COUNTER_DEF].forEach(function (tbl) {
          Object.keys(tbl).forEach(function (k) { if (tbl[k][id]) inOther = true; });
        });
        if (!has && !inOther) noRel.push(id);
        var strong = (t.atk / t.pop) >= 170 && (t.hp * (1 + t.def / 300)) / t.pop >= 4000;
        if (strong && !has && !inOther) bad.push(id);
      });
      console.log('      无克制关系的兵种（低战力档，取舍在成本/门槛）：'
        + (noRel.join('、') || '无'));
      if (bad.length) console.log('      高战力却零克制：' + bad.join('、'));
      return bad.length === 0;
    })());""",
      """    check('⑨（v89.179 升级）原"高战力必须有克制关系"判据随全撤作废：制衡改由成本/门槛承担', (function () {
      /* 历史：v89.118 曾要求"高战力档至少有一条克制关系"（防"无弱点兵种"）；
         v89.179 全撤后无表可依 —— 升级为：全表零克制 + 强兵（西凉铁骑）每人口
         粮耗 ≥ 基础兵 3 倍（1350 vs 450），制衡从"克制关系"转移到"成本与解锁门槛"。
         实跑复核（probe_v89179c）：西凉/铁骑/虎豹对枪兵同人口全胜，但成本贵 3~4 倍。 */
      var T = D96.TROOPS, xl = T.xiliangtieqi, base = T.changqiang;
      return D96.COUNTER_ATK === undefined && D96.COUNTER_DEF === undefined
        && (xl.atk / xl.pop) >= 170
        && (xl.cost.grain / xl.pop) >= 3 * (base.cost.grain / base.pop);
    })());""")

# 7) §98 ② 守卫修复
s = E(s, 'S8 §98②', """    check('② 象兵不进克制表（正常攻防）；同人口对长枪「赢但可打」（损 10%~60%）', (function () {
      var A = D98.COUNTER_ATK.changqiang || {}, Df = D98.COUNTER_DEF.changqiang || {};
      if (A.nanjiangxiangbing !== undefined || Df.nanjiangxiangbing !== undefined) return false;""",
      """    check('②（v89.179 升级）全表零克制（象兵不再是孤例）；同人口对长枪「赢但可打」（损 10%~60%）', (function () {
      if (D98.COUNTER_ATK !== undefined || D98.COUNTER_DEF !== undefined) return false;""")

# 8) §118③/§151 悬停共用（去 cnt 断言）
s = E(s, 'S9 悬停共用名', "'§118③/§151 兵种悬停：ui.btUnitTip 唯一读 unitFinalOf（两处**富浮层**共用 · 绿红克制）'",
      "'§118③/§151 兵种悬停：ui.btUnitTip 唯一读 unitFinalOf（两处**富浮层**共用 · v89.179 起无克制行）'")
s = E(s, 'S10 cnt 断言反转', '        && /cnt-good/.test(uc) && /cnt-bad/.test(uc)',
      '        && !/cnt-(good|bad)/.test(uc) && !/troopCounterOf/.test(uc)')
s = E(s, 'S11 注释口径', '克制/抗性走 cnt-good（绿）、被克走 cnt-bad（红） */',
      '克制行已随全撤删除（cnt-* 与 troopCounterOf 均须零残留） */')

# 9) §131⑤ 两条
s = E(s, 'S12 §131⑤ 反查退役', """    check('§131⑤ 克制反查唯一出口 troopCounterOf（长枪克骑 / 刀盾抗箭 / 弓箭被克）', (function () {
      var cq = G.ui.troopCounterOf('changqiang');
      var dd = G.ui.troopCounterOf('daodun');
      var gj = G.ui.troopCounterOf('gongjian');
      _r131f = '枪克=' + (cq ? cq.beats.length : -1) + ' 盾抗=' + (dd ? dd.resists.length : -1)
        + ' 弓被克=' + (gj ? gj.beaten.length : -1);
      return cq && cq.beats.some(function (x) { return x.id === 'qingji' && x.mul === 2.5; })
        && dd && dd.resists.some(function (x) { return x.id === 'gongjian'; })
        && gj && gj.beaten.some(function (x) { return x.id === 'daodun'; })
        && G.ui.troopCounterOf('__nope__') === null;
    })(), _r131f);""",
      """    check('§131⑤ 克制反查出口已随全撤退役（troopCounterOf 不存在 · 源码零残骸）', (function () {
      var uc131 = stripComment(require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'));
      _r131f = 'troopCounterOf=' + typeof G.ui.troopCounterOf;
      return G.ui.troopCounterOf === undefined
        && uc131.indexOf('troopCounterOf') < 0 && uc131.indexOf('cnt-good') < 0
        && uc131.indexOf('cnt-bad') < 0 && uc131.indexOf('被克') < 0;
    })(), _r131f);""")
s = E(s, 'S13 §131⑤ 悬停名', "'§131⑤ 悬停富浮层：五段排版 + 绿红克制 + 血非零（实调 btUnitTip）'",
      "'§131⑤ 悬停富浮层：五段排版 + 血非零（实调 btUnitTip · v89.179 起无克制行）'")
s = E(s, 'S14 §131⑤ 悬停条件', '        && /cnt-good/.test(html) && /无将领带队/.test(html)',
      "        && html.indexOf('克制') < 0 && html.indexOf('cnt-') < 0 && /无将领带队/.test(html)")

# 10) §178① 升级
s = E(s, 'S15 §178①', """    check('§178① 新表锚定：攻向枪 2.5 / 弩器械 3（专项保留）；防向全线降档', (function () {
      var A = DATA.COUNTER_ATK, Df = DATA.COUNTER_DEF;
      return A.changqiang.qingji === 2.5 && A.changqiang.xiliangtieqi === 2.5
        && A.chuangnu.chongche === 3
        && Df.daodun.gongjian === 2 && Df.changqiang.qingji === 3
        && Df.qingji.gongjian === 2 && Df.tieji.gongjian === 1.5
        && Df.chongche.gongjian === 3 && Df.hubaoqi.gongjian === 2 && Df.xiliangtieqi.gongjian === 1.5;
    })());""",
      """    check('§178①（v89.179 升级）克制表已整体退役 —— 历史锚：v89.178 曾降档至枪 2.5 / 拒马 3', (function () {
      /* v89.179 全撤（老板「取消所有克制关系，直接按兵种纸面数据计算」）——
         本锚从"表值核对"升级为"表已退役 + 墓碑在册"。 */
      var raw178 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'data.js'), 'utf8');
      return DATA.COUNTER_ATK === undefined && DATA.COUNTER_DEF === undefined
        && raw178.indexOf('v89.178') >= 0 && raw178.indexOf('取消所有克制关系') >= 0;
    })());""")

# 11) §178② 重写
s = E(s, 'S16 §178②', """    check('§178② 克制不再是"打不动"：766 弓打轻骑首杀 ≥ 无克制的 55%（改前实测 43%）', (function () {
      /* 对照组：临时清空防御向表（弓不在攻表 -> 等价"无克制"）-> 同场景再跑。
         首杀 = 我方第一次 attack 事件的 kill（与手测口径一致）。
         注：绝对值受**天气**影响（雨天弓射程 −20% 改变开火时机）——
         比值口径把天气消掉（同一环境下两个数同倍变化）。 */
      function firstKill(A, B) {
        var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
        var first = 0, g = 0;
        while (!env.over && g++ < 40) {
          var st = env.step();
          (st.events || []).forEach(function (e) {
            if (e.kind === 'attack' && e.side === 'atk' && !first) first = e.kill || 0;
          });
        }
        return first;
      }
      var kept, raw;
      /* 临时清空防御向表（弓不在攻表 -> 等价"无克制"）——**原地增删键**而不是换 DATA.X 引用：
         表结构盘点器把 "DATA.X =" 形态一律视为"写点"（测试里也不许出现，否则报跨文件写）。 */
      var cd178 = G.DATA.COUNTER_DEF, snap178 = {};
      Object.keys(cd178).forEach(function (k) { snap178[k] = cd178[k]; });
      try {
        kept = firstKill({ gongjian: 766 }, { qingji: 800 });
        Object.keys(cd178).forEach(function (k) { delete cd178[k]; });
        raw = firstKill({ gongjian: 766 }, { qingji: 800 });
      } finally {
        Object.keys(snap178).forEach(function (k) { cd178[k] = snap178[k]; });
      }
      _r178b = '克制下 ' + kept + ' / 无克制 ' + raw + ' = ' + (raw > 0 ? (kept / raw).toFixed(2) : '?');
      return raw > 0 && kept / raw >= 0.55;
    })(), _r178b);""",
      """    check('§178②（v89.179 重写）无克制口径：766 弓打 800 轻骑首轮齐射走纸面值（≥20）', (function () {
      /* v89.178 时这里比"克制下 / 无克制"两臂；v89.179 全撤后只剩单一口径 ——
         判据改为**下限**（旧克制把首轮齐射压到 11~17，全撤后应回到纸面量级）。
         注：受天气影响（雨天弓射程 −20%）—— 固定晴天再跑，跑完还原。 */
      function firstKill(A, B) {
        var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(B)), 0, null, {});
        var first = 0, g = 0;
        while (!env.over && g++ < 40) {
          var st = env.step();
          (st.events || []).forEach(function (e) {
            if (e.kind === 'attack' && e.side === 'atk' && !first) first = e.kill || 0;
          });
        }
        return first;
      }
      var wBak = G.state.world.weather;
      var k179;
      G.state.world.weather = 'clear';
      try { k179 = firstKill({ gongjian: 766 }, { qingji: 800 }); }
      finally { G.state.world.weather = wBak; }
      _r178b = '首轮齐射 ' + k179;
      return k179 >= 20;
    })(), _r178b);""")

# 12) §164③ 注释补测
s = E(s, 'S17 §164③ 注释', '/* v89.178：克制降档后重测（镜像小局 0.83→1.97；我方损失 1767→671）。',
      '/* v89.178：克制降档后重测（镜像小局 0.83→1.97；我方损失 1767→671）。\n             v89.179：克制全撤后复测（off 比 1.17 → on 比 3.10；我方损失 1073→515）—— 判据仍成立。')

# 13) 小注释两处
s = E(s, 'S18 象兵注释', '老板令"不设克制、正常攻防"后按 probe_v89118_elephant 标定。',
      '老板令"不设克制、正常攻防"后按 probe_v89118_elephant 标定（v89.179 起全表同口径）。')
s = E(s, 'S19 段头注释', ' * v57（老板拍板 6 项战斗设定）：反击 / 衰减 / 相克 B 套 / 回合 30',
      ' * v57（老板拍板 6 项战斗设定）：反击 / 衰减 / 相克 B 套（v89.179 全撤）/ 回合 30')

# 14) 追加 §179 段
NA = """  /* ============================================================
   * §179（v89.179）—— 克制系统全撤 + 纸面数据机制复核
   * 老板原话：「得了，不算了，取消所有克制关系，直接按兵种纸面数据计算，
   *   复核纸面数据机制是否合理」
   * 复核证据：.workbuddy/tools/probe/probe_v89179c_paper.js（全兵种矩阵 · 双向实跑）
   * ============================================================ */
  (function () {
    console.log('  --- §179 克制全撤与纸面数据 ---');
    var fs179 = require('fs'), p179 = require('path');
    var _r179 = '';

    check('§179① 克制全撤：两表 + 三出口 + 全部消费点退役（剥注释零残骸）', (function () {
      var tS = stripComment(fs179.readFileSync(p179.join(__dirname, 'js', 'tactic.js'), 'utf8'));
      var bS = stripComment(fs179.readFileSync(p179.join(__dirname, 'js', 'battle.js'), 'utf8'));
      var uS = stripComment(fs179.readFileSync(p179.join(__dirname, 'js', 'ui.js'), 'utf8'));
      var dS = stripComment(fs179.readFileSync(p179.join(__dirname, 'js', 'data.js'), 'utf8'));
      var noRef = [tS, bS, uS, dS].every(function (src) {
        return src.indexOf('COUNTER_ATK') < 0 && src.indexOf('COUNTER_DEF') < 0
          && src.indexOf('counterAtkOf') < 0 && src.indexOf('counterDefOf') < 0
          && src.indexOf('troopCounterOf') < 0 && src.indexOf('counterMul') < 0
          && !/\\bdefMul\\b/.test(src);
      });
      return DATA.COUNTER_ATK === undefined && DATA.COUNTER_DEF === undefined
        && G.tactic.counterAtkOf === undefined && G.tactic.counterDefOf === undefined
        && G.ui.troopCounterOf === undefined && noRef;
    })());

    check('§179② 纸面主链：四种近战骑兵同人口全胜枪兵（纯数值 · 无克制）', (function () {
      var out = [];
      var ok = [['qingji', 2000], ['tieji', 1333], ['hubaoqi', 1333], ['xiliangtieqi', 1000]]
        .every(function (c) {
          var o = {}; o[c[0]] = c[1];
          var r = G.battle.simulate({ changqiang: 4000 }, null, o, 0, null, { kind: 'wild' });
          out.push(DATA.TROOPS[c[0]].name + (r.winner === 'def' ? '胜' : '负')
            + '损' + Math.round(r.defLoss / c[1] * 100) + '%');
          return r.winner === 'def' && r.defLoss <= c[1] * 0.5;
        });
      _r179 = out.join(' · ');
      return ok;
    })(), _r179);

    var arc179 = fs179.readFileSync(p179.join(__dirname, '需求档案.md'), 'utf8');
    check('§179③ 需求档案在册（v89.179 · 老板原文关键句）',
      arc179.indexOf('v89.179') >= 0
      && arc179.indexOf('取消所有克制关系') >= 0
      && arc179.indexOf('纸面数据') >= 0);
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
if '§179（v89.179）—— 克制系统全撤' in s:
    print('  [already] S20 §179 段')
else:
    s = E(s, 'S20 §179 段', "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');", NA)

if not FAILS:
    wr('smoke-test.js', s)
    print('  ✅ smoke-test.js 落盘')
else:
    print('  ⛔ smoke-test.js 有失败项，不落盘')

print('===== e2e-test.js =====')
s = rd('e2e-test.js')
s = E(s, 'E1 悬停名', "'v89.149/§151（战场）：兵种名 = 一字简称（全名/最终属性在**富浮层**里 · 绿红克制）'",
      "'v89.149/§151（战场）：兵种名 = 一字简称（全名/最终属性在**富浮层**里）'")
s = E(s, 'E2 注释', '''          /* v89.157（老板「无相克不显示」）：零相克兵种（本用例的义兵）**没有**克制行；
             有克制行时必须带 cnt-good / cnt-bad 类（旧的"无相克"占位行已退役）。 */''',
      '''          /* v89.179：克制系统全撤 —— 悬停不再有"克制/抗性/被克"三行
             （v89.157 的"无相克不显示"至此演进为"全局无相克"）。 */''')
if not FAILS:
    wr('e2e-test.js', s)
    print('  ✅ e2e-test.js 落盘')
else:
    print('  ⛔ e2e-test.js 有失败项，不落盘')

print('')
if FAILS:
    print('❌ 失败清单：')
    for f in FAILS:
        print('   - ' + f)
    sys.exit(1)
print('✅ 全部落盘完成')
