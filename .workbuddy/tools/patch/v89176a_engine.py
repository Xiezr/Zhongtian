# v89.176 补丁 A：引擎层 —— ① SMART_PLAN 扩展（阵型模式库 + 撤退线）
#                  ② tactic.contactForecast（接敌预测唯一出口）
# 纪律：先读入内存 → 逐段替换（每段带幂等 guard）→ 原子写盘 → 写后自检。
import io, sys, re

ROOT = 'E:/Deepseekdb/'
def read(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def write(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(f, tag, old, new):
    s = read(f)
    if new.split('\n')[0].strip() and new in s:
        print('[skip] ' + tag + '（已在）'); return
    c = s.count(old)
    assert c == 1, tag + ' 锚点命中 ' + str(c) + ' 次'
    s = s.replace(old, new)
    write(f, s)
    print('[ok] ' + tag)

# ============================================================
# 1) data.js —— SMART_PLAN 扩展
# ============================================================
rep('js/data.js', 'A1 SMART_PLAN 扩展',
"""    rules: ['static', 'dmg', 'eff', 'front'],
    ruleCN: { static: '静态表', dmg: '伤害最优', eff: '清除效率', front: '清前排' },
  };""",
"""    rules: ['static', 'dmg', 'eff', 'front'],
    ruleCN: { static: '静态表', dmg: '伤害最优', eff: '清除效率', front: '清前排' },
    /* ============================================================
     * v89.176（老板「总体策略是齐头并进，针尖麦芒，还是退守底线消耗，一波冲锋。
     *   还是错落有致，进退有据逐一消灭，伺机全军出动」）
     * ------------------------------------------------------------
     * **阵型模式库** —— 与目标规则正交的第二维；开战赛马在 modes × rules
     * 的全部组合里选（同一把引擎全速模拟，见 battle.smartArbitrate）。
     *   · echelon 错落有致 = v89.164 标定（近战到 250 转防御 / 远程进射程转防御）——**默认**
     *   · line    齐头并进 = 全体推进到**射程边缘**才转防御（近战也贴到 er，不在 250 停）
     *   · spear   针尖麦芒 = 最快一档（spd 最高）不转防御持续前压，其余照 echelon
     *   · turtle  退守消耗 = 全体原地防御（受创减半），等敌来攻
     *   · charge  一波冲锋 = 全体全速推进、永不转防御
     * 标定（probe_v89176d_modes · 5 模式 × 4 场景）：mirror/cavHeavy/infHeavy → echelon
     * 最优；bowHeavy → spear 交换比 2.70W 明显优于 echelon 2.19W（+23%）——
     * 「联合赛马按局选组合」由此成立（单固定阵型会被场景打脸）。
     * ============================================================ */
    modes: ['echelon', 'line', 'spear', 'turtle', 'charge'],
    modeCN: { echelon: '错落有致', line: '齐头并进', spear: '针尖麦芒', turtle: '退守消耗', charge: '一波冲锋' },
    /* ============================================================
     * v89.176（老板「减少伤亡很重要，或者最重要……损伤 30% 的局面，宁愿撤退。
     *   除非是有非拿下不可的目标比如名城」）
     * ------------------------------------------------------------
     * 保兵闸（唯一数值出口）：stepBattle 的托管段与界面读数都读这里。
     *   · retreatAt：我方损失率 ≥ 它 → 托管下**自动撤退**（残部带回 · 走 retreatBattle）
     *   · warnAt：损失率 ≥ 它（且未到撤退线）→ 顶栏预警 + 首次越线记一条战报日志
     * 例外（不撤退）：名城（县城及以上系统城 —— GAME.isFamousCity 唯一出口）；
     *   野地 / 据点 / 自建城 → 到线即撤（"损伤 30% 宁愿撤退"的主体场景）。
     * ============================================================ */
    retreatAt: 0.30,
    warnAt: 0.22,
  };""")

# ============================================================
# 2) tactic.js —— contactForecast（接敌预测唯一出口）
# ============================================================
rep('js/tactic.js', 'A2 contactForecast',
"""      mid: mid,                            // 接触线位置
    };
  };
""",
"""      mid: mid,                            // 接触线位置
    };
  };

  /* ============================================================
   * v89.176（老板「谁在下一回合接敌」）：**接敌预测**（唯一出口）
   * ------------------------------------------------------------
   * 复刻 stepRound 的行动语义，对**当前快照**预演"本回合结束时各支走到哪"，
   * 再判定"下一回合谁将与敌交手"：
   *   · 行动顺序：速度降序、同速守方先（与 stepRound 的 order 同规）；
   *   · 目标选择：指定目标（在场）优先 → 否则"最近"（与 actSide 同规）；
   *   · 推进：free = gap − er（能开火就停）、每回合 ≤ spd、全局封顶 advanceCapOf(D)；
   *   · 开火：预演后 gap ≤ er（与 actSide 的 `if (gap <= effRange)` 同判据）。
   * 返回：
   *   fire     下一回合将开火的支 [{side, id, tgt, gap}]
   *   incoming 下一回合将挨打的支 [{side, id, by, gap}]（fire 的对偶）
   *   engage   合并集合 { 'atk|id': true, ... }（UI 角标按它标记）
   *   contact  两军前沿在预演后是否接触（frontsOf 同口径）/ gapAfter
   * ⚠️ 它是**预测**（给界面预警用），不参与任何结算：攻击造成的减员不在预演里
   *    （探针 probe_v89176e 逐回合对账，属于"预告"不是"保证"）。
   * ============================================================ */
  T.contactForecast = function (atkUnits, defUnits, D) {
    D = D || T.FIELD_MIN;
    var cap = T.advanceCapOf(D);
    var atk = (atkUnits || []).filter(function (u) { return u && u.count > 0; });
    var def = (defUnits || []).filter(function (u) { return u && u.count > 0; });
    function kk(side, id) { return side + '|' + id; }
    function erOf(u) { return (u.er != null ? u.er : (u.range || 0)) || 0; }
    var adv = {};
    atk.forEach(function (u) { adv[kk('atk', u.id)] = u.adv || 0; });
    def.forEach(function (u) { adv[kk('def', u.id)] = u.adv || 0; });
    var list = [];
    atk.forEach(function (u) { list.push({ u: u, side: 'atk' }); });
    def.forEach(function (u) { list.push({ u: u, side: 'def' }); });
    list.sort(function (x, y) {
      if ((y.u.spd || 0) !== (x.u.spd || 0)) return (y.u.spd || 0) - (x.u.spd || 0);
      return x.side === 'def' ? -1 : 1;      /* 同速守方先（与 stepRound 同规） */
    });
    function foesOf(side) { return side === 'atk' ? def : atk; }
    function posOf(side, id) {
      return side === 'atk' ? adv[kk('atk', id)] : D - adv[kk('def', id)];
    }
    function gapOf(side, id, foeSide, foeId) {
      return Math.max(0, posOf(foeSide, foeId) - posOf(side, id));
    }
    function recOf(ent) {
      var foes = foesOf(ent.side);
      var pref = null;
      if (ent.u.target) {
        foes.forEach(function (e) { if (e.id === ent.u.target) pref = e; });
      }
      var best = null, bg = Infinity;
      (pref ? [pref] : foes).forEach(function (e) {
        var g = gapOf(ent.side, ent.u.id, ent.side === 'atk' ? 'def' : 'atk', e.id);
        if (g < bg) { bg = g; best = e; }
      });
      return best ? { e: best, gap: bg } : null;
    }
    /* 逐支预演推进（速度序 —— 与 stepRound 的逐支行动一致） */
    list.forEach(function (ent) {
      if ((ent.u.stance || 'advance') !== 'advance') return;
      var r = recOf(ent);
      if (!r) return;
      var free = r.gap - erOf(ent.u);
      if (free <= 0) return;
      var step = Math.min(ent.u.spd || 0, free, cap);
      if (step > 0) adv[kk(ent.side, ent.u.id)] += step;
    });
    /* 预演后的开火/挨打判定（用最终位置） */
    var fire = [], incoming = [], engage = {};
    list.forEach(function (ent) {
      var r = recOf(ent);
      if (!r) return;
      var foeSide = ent.side === 'atk' ? 'def' : 'atk';
      var g = gapOf(ent.side, ent.u.id, foeSide, r.e.id);
      if (g <= erOf(ent.u)) {
        fire.push({ side: ent.side, id: ent.u.id, tgt: r.e.id, gap: Math.round(g) });
        engage[kk(ent.side, ent.u.id)] = true;
        incoming.push({ side: foeSide, id: r.e.id, by: ent.u.id, gap: Math.round(g) });
        engage[kk(foeSide, r.e.id)] = true;
      }
    });
    /* 接触判定：用预演后的位置重算前沿（frontsOf 同口径） */
    var arrA = [], arrD = [];
    atk.forEach(function (u) { arrA.push({ count: 1, id: u.id, adv: adv[kk('atk', u.id)], er: erOf(u) }); });
    def.forEach(function (u) { arrD.push({ count: 1, id: u.id, adv: adv[kk('def', u.id)], er: erOf(u) }); });
    var fr = T.frontsOf(arrA, arrD, D);
    return { fire: fire, incoming: incoming, engage: engage,
      contact: fr.contact, gapAfter: fr.gap, reach: fr.reach, field: D };
  };
""")

print('DONE-A')
