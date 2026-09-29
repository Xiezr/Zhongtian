# v89180b 补丁：风筝（kite）—— 智能战斗 v3 的"远程保持距离"（老板 3/4）
# 变更：data.js（SMART_PLAN.kiteLead）/ battle.js（smartStanceOf 第5参 ctx + smartApply 团队条件）
import io

P = 'E:/Deepseekdb/'
def read(p):
    return io.open(P + p, 'r', encoding='utf-8', newline='').read()
def write(p, s):
    io.open(P + p, 'w', encoding='utf-8', newline='').write(s)
def rep(tag, s, old, new, cnt=1):
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    return s.replace(old, new)

# ============================================================
# 1. data.js —— SMART_PLAN 加 kiteLead
# ============================================================
s = read('js/data.js')
s = rep('D1 kiteLead', s,
    "    rangeK: 1.0,        /* 远程：进自身射程（× rangeK）→ 转防御（站桩输出） */",
    """    rangeK: 1.0,        /* 远程：进自身射程（× rangeK）→ 转防御（站桩输出） */
    /* v89.180（老板 3「距离难道不是弓兵的生命线吗」+4「不够智能」）：
       **风筝预判步数** —— 撤退触发线 = 敌射程 + 敌速度 × kiteLead（"它下回合能不能打到我"）。
       1 = 预判一步。标定见 probe_v89180b（突骑 2000 vs 长枪 4000：我损 39.9% → 1.8%）。 */
    kiteLead: 1,""")
write('js/data.js', s)
print('data.js OK')

# ============================================================
# 2. battle.js —— smartStanceOf 五参 + echelon 远程 kite 分支
# ============================================================
s = read('js/battle.js')

s = rep('B1 签名', s,
    "  GAME.battle.smartStanceOf = function (u, gap, plan, mode) {",
    "  GAME.battle.smartStanceOf = function (u, gap, plan, mode, ctx) {")

s = rep('B2 echelon 远程分支', s,
    """    /* echelon 错落有致（默认 · v89.164 标定 —— 与此前逐字一致） */
    if ((u.range || 0) >= 500) {
      return (gap <= u.range * (plan.rangeK || 1)) ? 'hold' : 'advance';
    }""",
    """    /* echelon 错落有致（默认 · v89.164 标定） */
    if ((u.range || 0) >= 500) {
      if (gap > u.range * (plan.rangeK || 1)) return 'advance';
      /* v89.180（老板 3/4「距离难道不是弓兵的生命线吗……那是还不够智能」）：
         **风筝** —— 进射程后不再无条件站桩：处于威胁线内（敌下回合能打到我）、
         且存在"我打得到 / 它够不着"的窗口（敌射程 < 我）、且退一步后仍在射程内
         （退出去打不着 → 原地打）→ **后撤一步**（引擎的 retreat 可退到 −D，
         后退回合照常开火 = 边退边射）；否则站桩输出（受创减半）。
         ctx 由 smartApply 按**团队条件**构造（我方最慢远程 > 敌最前速度才给 ctx.kite ——
         混编里最慢那支决定整条远程线是否风筝；probe_v89180b 的 S3 实测"部分退、部分留"
         反而更差）。**无 ctx（旧调用 / 旧断言）→ 行为与 v89.164 逐字一致。** */
      if (ctx && ctx.kite && gap <= ctx.threat && ctx.eRange < _er - 1
          && gap + ctx.back <= _er + 1) return 'retreat';
      return 'hold';
    }""")

s = rep('B3 themFront+团队条件', s,
    """    var D = env.field || 1, themFront = 0;
    theirs.forEach(function (x) { if (x.count > 0 && x.adv > themFront) themFront = x.adv; });""",
    """    var D = env.field || 1, themFront = 0, _eF180 = null;
    theirs.forEach(function (x) {
      if (x.count > 0 && x.adv > themFront) { themFront = x.adv; _eF180 = x; }
    });
    /* v89.180（老板 3/4）：风筝（kite）**团队条件**与威胁线 —— 唯一出口
       （开战赛马与实战执行共用本函数）。团队条件：我方存活远程（射程 ≥ 500）的
       最小速度 > 敌最前单位速度（跑不动就别退）；威胁线 = 敌射程 + 敌速度 × kiteLead。 */
    var kiteOn180 = false, kiteThreat180 = 0, kiteER180 = 0;
    if (_eF180) {
      var _eSpd180 = _eF180.spd || 0;
      var _minRSpd180 = Infinity, _hasR180 = false;
      mine.forEach(function (x) {
        if (x.count > 0 && (x.range || 0) >= 500) {
          _hasR180 = true;
          if ((x.spd || 0) < _minRSpd180) _minRSpd180 = (x.spd || 0);
        }
      });
      kiteOn180 = _hasR180 && _eSpd180 > 0 && _minRSpd180 > _eSpd180;
      kiteER180 = (_eF180.er != null ? _eF180.er : (_eF180.range || 0));
      kiteThreat180 = kiteER180 + _eSpd180 * (plan.kiteLead == null ? 1 : plan.kiteLead);
    }""")

s = rep('B4 循环传入', s,
    """      var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
      var wantS = GAME.battle.smartStanceOf(u, D - u.adv - themFront, planX, mode);""",
    """      var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
      var kctx180 = null;
      if (kiteOn180 && (u.range || 0) >= 500) {
        var _bk180 = Math.min(u.spd || 0, u.adv + D);   /* 与引擎 retreat 的退量同尺 */
        if (_bk180 > 0) kctx180 = { kite: true, threat: kiteThreat180, eRange: kiteER180, back: _bk180 };
      }
      var wantS = GAME.battle.smartStanceOf(u, D - u.adv - themFront, planX, mode, kctx180);""")

write('js/battle.js', s)
print('battle.js OK')
print('ALL DONE')
