# -*- coding: utf-8 -*-
"""v89.87 需求4a：战斗引擎会话步进 API（机械重构，行为一致）

T.simulate 拆分：
  T.begin(...)  → 建立会话 env（初始化逻辑原样保留）
  env.step()    → 推进一回合，返回 { r, a, d, gap, events, over, snap }
  env.runAll()  → 跑到结束（≡ 原 while 循环）
  env.finish()  → 收尾组装 result（原收尾段原样）
  T.simulate    → 包装为 begin + runAll + finish（行为逐字节一致）
"""
import io

P = r'E:\Deepseekdb\js\tactic.js'
src = io.open(P, encoding='utf-8', newline='').read()

# ---------- ① 函数改名 + 说明 ----------
old1 = '  T.simulate = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {'
new1 = """  /* ============================================================
   * v89.87：T.begin —— 建立战斗**会话**（观战界面用）
   * ------------------------------------------------------------
   * 初始化逻辑与旧 T.simulate 完全同一套。返回 env：
   *   env.step()                        → 推进一回合（返回该回合 events/双方数量/间距/快照）
   *   env.runAll()                      → 跑到结束（≡ 旧 while 循环）
   *   env.finish()                      → 收尾组装 result（与旧返回结构完全一致）
   *   env.snap()                        → 双方部队状态快照（UI 画战场用）
   *   env.setCmd(side, troopId, {s,t})  → 为该兵种下达动作/目标指令
   *   env.units                         → { atk, def } 单位数组（内部引用）
   * 引擎**完全确定**（无随机）→ 会话可由「输入 + 逐回合指令」重放重建（存档恢复）。
   * ============================================================ */
  T.begin = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {"""
assert src.count(old1) == 1, ('sim-head', src.count(old1))
src = src.replace(old1, new1, 1)

# ---------- ② while → stepRound 函数头 ----------
old2 = """    while (alive(atk).length && alive(def).length && round < T.MAX_ROUNDS) {
      round++;
      var events = [];"""
new2 = """    /* v89.87：原 `while (…round < MAX_ROUNDS)` 循环体抽成 stepRound()，由 env.step 调用 */
    function stepRound() {
      if (env.over) return null;
      round++;
      var events = [];"""
assert src.count(old2) == 1, ('while', src.count(old2))
src = src.replace(old2, new2, 1)

# ---------- ③ 循环体尾 → 返回值 + env 构造 + finish 开头 ----------
old3 = """      roundsLog.push({
        r: round,
        a: alive(atk).reduce(function (n, u) { return n + u.count; }, 0),
        d: alive(def).reduce(function (n, u) { return n + u.count; }, 0),
        gap: Math.round(gapOf({ adv: front(atk) }, front(def))),
        events: events,
      });
      strips.push(T.strip(front(atk), front(def), D));
    }"""
new3 = """      var _rA = alive(atk).reduce(function (n, u) { return n + u.count; }, 0);
      var _rD = alive(def).reduce(function (n, u) { return n + u.count; }, 0);
      var _rG = Math.round(gapOf({ adv: front(atk) }, front(def)));
      roundsLog.push({ r: round, a: _rA, d: _rD, gap: _rG, events: events });
      strips.push(T.strip(front(atk), front(def), D));
      if (!alive(atk).length || !alive(def).length || round >= T.MAX_ROUNDS) env.over = true;
      return { r: round, a: _rA, d: _rD, gap: _rG, events: events, over: env.over, snap: snapUnits() };
    }

    /* ---------- 会话对象（v89.87） ---------- */
    function snapUnits() {
      function cp(u) {
        return { side: u.side, id: u.id, name: u.name, count: u.count, adv: Math.round(u.adv),
                 spd: u.spd, range: u.range, stance: u.stance, target: u.target || '', vsCity: !!u.vsCity };
      }
      return { round: round, field: D, atk: atk.map(cp), def: def.map(cp) };
    }
    var env = {
      field: D, over: false,
      units: { atk: atk, def: def },
      setCmd: function (side, troopId, patch) {
        var list = (side === 'def') ? def : atk;
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === troopId) {
            if (patch && patch.s) list[i].stance = patch.s;
            if (patch && patch.t !== undefined) list[i].target = patch.t;
          }
        }
      },
      snap: snapUnits,
    };
    env.over = !(alive(atk).length && alive(def).length);
    env.step = stepRound;
    env.runAll = function () { while (!env.over) stepRound(); };
    var _fin = null;
    env.finish = function () {
      if (_fin) return _fin;"""
assert src.count(old3) == 1, ('loop-tail', src.count(old3))
src = src.replace(old3, new3, 1)

# ---------- ④ 收尾 return 头 ----------
old4 = """    return {
      winner: winner,
      atkLoss: aStart - aRemain, defLoss: dStart - dRemain,"""
new4 = """    _fin = {
      winner: winner,
      atkLoss: aStart - aRemain, defLoss: dStart - dRemain,"""
assert src.count(old4) == 1, ('fin-head', src.count(old4))
src = src.replace(old4, new4, 1)

# ---------- ⑤ 收尾 return 尾 + 新 T.simulate ----------
old5 = """      atkRemainBy: aBy.remain, defRemainBy: dBy.remain,
    };
  };"""
new5 = """      atkRemainBy: aBy.remain, defRemainBy: dBy.remain,
    };
    return _fin;
    };
    return env;
  };

  /* v89.87：T.simulate 包装为会话（begin → runAll → finish）——
     与旧实现逐字节同行为；观战界面改用 env.step 逐回合推进。 */
  T.simulate = function (atkArmy, atkGen, defArmy, defVal, defGen, opts) {
    var env = T.begin(atkArmy, atkGen, defArmy, defVal, defGen, opts);
    env.runAll();
    return env.finish();
  };"""
assert src.count(old5) == 1, ('fin-tail', src.count(old5))
src = src.replace(old5, new5, 1)

io.open(P, 'w', encoding='utf-8', newline='').write(src)
print('OK tactic.js 会话步进 API 落盘')
