# -*- coding: utf-8 -*-
"""v89175a · 智能战术升级（数据+战斗层）：策略库 + 开战赛马 + 每回合调整明细
老板：「要求1，每回合我要看见调整……要求2）确实采用最优策略，给兵种设置不同行进方式……
       和适当的攻击目标（是伤害计算最优，还是清除前排最优，多种最优路径比较）」
探针标定：probe_v89175b_strategy.js —— 赛马 3/4 场优于固定静态表（bowHeavy +3.02W 等）。
设计冻结：姿态规则**不动**（提前 hold 实测最优）；守方默认**不动**（v59 设计+数据）。
"""
import io, os, sys, subprocess

ROOT = 'E:/Deepseekdb'
FILES = {}

def load(p):
    if p not in FILES:
        FILES[p] = io.open(os.path.join(ROOT, p), 'r', encoding='utf-8', newline='').read()
    return FILES[p]

def save(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)

def edit(path, tag, old, new, count=1):
    s = load(path)
    n = s.count(old)
    assert n == count, '[%s] 锚点命中 %d 次（要求 %d）' % (tag, n, count)
    FILES[path] = s.replace(old, new, count)
    print('  ok  ' + tag)

def edit_range(path, tag, start, end, new):
    s = load(path)
    assert s.count(start) == 1, '[%s] start 锚 %d 次' % (tag, s.count(start))
    assert s.count(end) == 1, '[%s] end 锚 %d 次' % (tag, s.count(end))
    i = s.index(start)
    j = s.index(end, i) + len(end)
    FILES[path] = s[:i] + new + s[j:]
    print('  ok  ' + tag + '  (区间 %d 字符 → %d 字符)' % (j - i, len(new)))

# ============================================================
# A. data.js —— 策略库声明
# ============================================================
print('== data.js ==')
edit('js/data.js', 'A1 SMART_PLAN 加策略库',
  r'''      /* 骑族 → 弓（骑防远程 ×2~×4 · 冲散后排火力） */
    },
  };''',
  r'''      /* 骑族 → 弓（骑防远程 ×2~×4 · 冲散后排火力） */
    },
    /* ============================================================
     * v89.175（老板）：「确实采用最优策略……适当的攻击目标（是伤害计算最优，
     *   还是清除前排最优，**多种最优路径比较**）」
     * ------------------------------------------------------------
     * 目标策略库 + **开战赛马**：每场战斗开始时把 4 套候选**各全速模拟一遍**
     *   （引擎完全确定 · 同输入同结果 → 选出的策略可重放、可复现），
     *   按「胜 > 交换比」评出最优，**整场按它执行**（不做每回合漂移 ——
     *   v89.164 实测动态选靶 2.88 < 静态 9.36，漂移会扰动推进队形）。
     * 探针标定（probe_v89175b_strategy.js · 四场景）：
     *   mirror → 静态表 9.36W（独大）· bowHeavy → 清前排 5.27W（静态 2.24W，+3.02）
     *   infHeavy → 清除效率 +0.71 · cavHeavy → 清除效率 +0.49；**3/4 场赛马有增益**。
     * ⚠️ 姿态规则（gapInf/gapCav/rangeK）**不动**：探针实测"能打才 hold / 守方防御"
     *   两种改法在四场景均不优于现状（⑧=2.14 vs ①=2.48），保持 v89.164 标定。
     * ============================================================ */
    rules: ['static', 'dmg', 'eff', 'front'],
    ruleCN: { static: '静态表', dmg: '伤害最优', eff: '清除效率', front: '清前排' },
  };''')

# ============================================================
# B. battle.js
# ============================================================
print('== battle.js ==')

# B1. smartApply 升级（规则 + 明细 + 返回 {n, notes}）
edit_range('js/battle.js', 'B1 smartApply 升级',
  '  GAME.battle.smartApply = function (rec, env) {',
  '''      if (patch.s || patch.t !== undefined) { env.setCmd('atk', u.id, patch); n++; }
    });
    return n;
  };''',
  r'''  GAME.battle.smartApply = function (rec, env) {
    if (!rec || rec.side !== 'atk' || !env || !env.setCmd) return { n: 0, notes: [] };
    var plan = GAME.battle.smartPlanOf();
    /* v89.175：目标规则（首回合赛马选定；缺省 static = v89.164 静态表，行为不变） */
    var rule = rec.smartRule || 'static';
    var mine = (env.units && env.units.atk) || [];
    var theirs = (env.units && env.units.def) || [];
    var D = env.field || 1, themFront = 0;
    theirs.forEach(function (x) { if (x.count > 0 && x.adv > themFront) themFront = x.adv; });
    rec.cmd = rec.cmd || {};
    /* ⛔ v89.164 撤销（实测有害）：曾加"目标灭失回退"（目标兵种灭后改打敌方主力）——
       对照实验（probe diag_trace）显示：火力被引离**前线可歼灭目标**后，敌方前排
       不再减员并一路推进穿场（dFront 12160），敌损从 4435（全灭）掉到 726。
       目标灭失时**保持原值**、由引擎回落"射程内任意"反而是实测最优。 */
    var n = 0, notes = [];
    var SC = {};
    (DATA.STANCES || []).forEach(function (x) { SC[x.id] = x.name; });
    var tName = function (tid) {
      var t = DATA.TROOPS[tid];
      return t ? t.name : String(tid || '');
    };
    mine.forEach(function (u) {
      if (!(u.count > 0)) return;
      var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
      var wantS = GAME.battle.smartStanceOf(u, D - u.adv - themFront, plan);
      /* v89.175：目标 = 规则决策（静态表 / 伤害最优 / 清除效率 / 清前排） */
      var wantT = (rule === 'static')
        ? plan.targets[u.id]
        : GAME.battle.smartPickTarget(u, theirs, rule, D);
      var patch = {};
      if (wantS && c.s !== wantS) {
        notes.push(u.name + ' ' + (SC[c.s] || c.s || '—') + '→' + (SC[wantS] || wantS));
        c.s = wantS; patch.s = wantS;
      }
      if (wantT != null && c.t !== wantT) {
        notes.push(u.name + ' 目标→' + tName(wantT));
        c.t = wantT; patch.t = wantT;
      }
      if (patch.s || patch.t !== undefined) { env.setCmd('atk', u.id, patch); n++; }
    });
    return { n: n, notes: notes };
  };
  /* v89.175：目标评分器（**唯一出口** —— 赛马模拟与实战执行共用同一把尺）。
     规则：dmg = 期望实伤（perAtk×相克×防御对冲÷单兵HP）；eff = 有效杀（防溢出，
     能打满的优先）；front = 清前排（adv 大者优先 + 有效杀打底）。
     与 v89.164 静态表同源可比：static 直接读 plan.targets（代表兵种）。 */
  GAME.battle.smartPickTarget = function (u, foes, rule, D) {
    var list = (foes || []).filter(function (e) { return e.count > 0; });
    if (!list.length) return null;
    var T = GAME.tactic;
    var enemyArmy = {};
    list.forEach(function (e) { enemyArmy[e.id] = (enemyArmy[e.id] || 0) + e.count; });
    var perA = T.perAtk(u, { counterMul: T.counterAtkOf(u.id, enemyArmy) });
    var best = null, bestSc = -Infinity;
    list.forEach(function (e) {
      var cf = T.clashFactor(perA, T.perDef(e, { defMul: T.counterDefOf(e.id, u.id) }));
      var perHp = T.perHp(e, null);
      var hold = (e.stance === 'hold') ? (1 - T.HOLD_DAMAGE_CUT) : 1;
      var killF = perA * u.count * cf * hold / perHp;
      var sc;
      if (rule === 'dmg') sc = killF;
      else if (rule === 'eff') sc = Math.min(killF, e.count) * 1000 + killF * 0.001;
      else if (rule === 'front') sc = e.adv * 1000 + Math.min(killF, e.count);
      else sc = killF;
      if (sc > bestSc) { bestSc = sc; best = e; }
    });
    return best ? best.id : null;
  };
  /* v89.175：**开战赛马** —— 把候选规则各全速模拟一遍（引擎确定 → 同输入同结果），
     按「胜 > 交换比」选最优；结果 `{ rule, scores }` 存 rec.smartPick（随档往返），
     每场只跑一次。实测成本 ≈ 4 套 × 9ms（probe_v89175b 计时）。 */
  GAME.battle.smartArbitrate = function (rec) {
    var plan = GAME.battle.smartPlanOf();
    var rules = (plan.rules || ['static']).slice();
    var t0 = Date.now();
    var gen = null;
    (GAME.state.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    var genSim = (rec.sim && rec.sim.genSim) || gen;
    var scores = [];
    rules.forEach(function (rule) {
      var env = null;
      try {
        env = GAME.tactic.begin(rec.atkArmy || {}, genSim, (rec.sim && rec.sim.scArmy) || {},
          (rec.sim && rec.sim.scVal) || 0, (rec.sim && rec.sim.scGen) || null,
          (rec.sim && rec.sim.simOpts) || {});
      } catch (e) { env = null; }
      if (!env) return;
      var recX = { side: 'atk', cmd: {}, smartRule: rule };
      var g = 0;
      while (!env.over && g++ < 40) { GAME.battle.smartApply(recX, env); env.step(); }
      var aRem = 0, dRem = 0, aStart = 0, dStart = 0;
      env.units.atk.forEach(function (u) { aStart += u.start; if (u.count > 0) aRem += u.count; });
      env.units.def.forEach(function (u) { dStart += u.start; if (u.count > 0) dRem += u.count; });
      var win = aRem > 0 && dRem === 0;
      var ratio;
      if (dRem === 0) ratio = (aStart > aRem) ? (dStart / (aStart - aRem)) : 999;
      else ratio = (dStart - dRem) / Math.max(0.0001, (aStart - aRem));
      ratio = Math.round(ratio * 100) / 100;
      scores.push({ rule: rule, win: win, ratio: ratio, rounds: g });
    });
    var best = null, bestSc = -1e9;
    scores.forEach(function (s) {
      var sc = (s.win ? 10000 : 0) + s.ratio;
      if (sc > bestSc) { bestSc = sc; best = s.rule; }
    });
    return { rule: best || 'static', scores: scores, ms: Date.now() - t0 };
  };''')

# B2. stepBattle 接入赛马与明细
edit('js/battle.js', 'B2 stepBattle 接入',
  r'''    /* v89.164：智能战斗（默认开）——本回合先改写我方指令（姿态+目标），
       改写落 rec.cmd → 随后照常进 history 快照（重放/读档逐回合一致）。 */
    if (GAME.battle.smartOnOf()) GAME.battle.smartApply(rec, ses);''',
  r'''    /* v89.164：智能战斗（默认开）——本回合先改写我方指令（姿态+目标），
       改写落 rec.cmd → 随后照常进 history 快照（重放/读档逐回合一致）。
       v89.175（老板「多种最优路径比较」）：首回合**赛马**（4 套策略全速模拟 → 选最优，
       结果确定可重放）；每回合记录**调整明细**（rec.smartNote/smartLog，战报与回合
       记录渲染读它 —— 「每回合我要看见调整」）。 */
    if (GAME.battle.smartOnOf()) {
      if (!rec.smartPick) rec.smartPick = GAME.battle.smartArbitrate(rec);
      if (rec.smartPick && rec.smartPick.rule) rec.smartRule = rec.smartPick.rule;
      var _sm175 = GAME.battle.smartApply(rec, ses);
      rec.smartNote = { r: (rec.round || 0) + 1, n: _sm175.n, notes: _sm175.notes, rule: rec.smartRule };
      (rec.smartLog = rec.smartLog || []).push(rec.smartNote);
      if (rec.smartLog.length > 80) rec.smartLog.shift();
    }''')

# ============================================================
print('== 落盘 ==')
for p, s in FILES.items():
    save(p, s)
    print('  saved ' + p)

print('== 语法哨兵 ==')
ok = True
for p in ['js/data.js', 'js/battle.js']:
    r = subprocess.run(['node', '--check', os.path.join(ROOT, p)], capture_output=True, text=True)
    print(('  PASS ' if r.returncode == 0 else '  FAIL ') + p + ' ' + (r.stderr.strip()[:200] if r.returncode else ''))
    ok = ok and r.returncode == 0
sys.exit(0 if ok else 1)
