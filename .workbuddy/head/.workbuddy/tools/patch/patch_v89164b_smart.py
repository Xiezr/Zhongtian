# -*- coding: utf-8 -*-
"""v89.164 补丁 B（智能战斗 · 核心）：
   data.js：DATA.SMART_PLAN（通用战斗方案表 · 扫参标定）
   battle.js：smart 组（smartPlanOf/smartOnOf/setSmartBattle/smartStanceOf/smartApply）+ stepBattle 接入"""
import io

R = 'E:/Deepseekdb/'
LOG = []

def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, guard=None):
    s = rd(path)
    g = guard if guard is not None else new
    if g in s:
        LOG.append('  [skip] %s（新内容已在）' % tag)
        return
    c = s.count(old)
    assert c == 1, '%s 锚点数=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    wr(path, s)
    LOG.append('  [ ok ] %s' % tag)

# ══════════ ① data.js · DATA.SMART_PLAN ══════════
rep('js/data.js', 'data · DATA.SMART_PLAN（通用战斗方案表）',
"""  DATA.TARGET_ANY = '_any';""",
"""  DATA.TARGET_ANY = '_any';

  /* ============================================================
   * v89.164（老板 3）：**智能战斗 · 通用战斗方案**（"兵种全满 · 常规距离"标定）
   * ------------------------------------------------------------
   * 老板原话：「能否按兵种全满，战场距离常规的情况，设计一套通用的战斗方式，
   *   具体表现为回合n（兵种 I，行动a，目标兵种 IV；……）；回合 n+1（……）」。
   * 本方案 = **静态目标表 + 逐回合姿态规则**（每回合 step 前由 `battle.smartApply` 应用）：
   *   · 目标表（targets）：按相克表把火力引到"最该打的目标"（枪找骑 ×3、骑切后排…）；
   *   · 姿态规则：距敌前军 ≤ `gapInf`/`gapCav`（远程：进自身射程）→ **转防御**
   *     （受创减半、照常开火）；拉开后自动转回前进 —— 这就是"逐回合"的动态表现。
   * 标定（probe_v89164_smart 系列 · 全兵种镜像对局 · 常规纵深）：
   *   基线（无指令）交换比 1.06 → 本方案 **9.36**（敌全灭 · 我损 10.7%）；
   *   三场景全部优于基线：敌骑重 0.53→0.69 · 敌弓重 2.68→3.53 ·
   *   敌步重 0.39→**1.84**（从全灭翻盘为胜）；双智能对撞 = 均衡（各损 ~9.5%）。
   *   ⚠️ 目标各指一个**代表兵种**（"骑"= 轻骑兵）——敌方缺该兵种时引擎自动回落
   *   "射程内任意"，无需为缺阵另行处理；动态选靶（按敌阵人数实时挑）实测反倒更差
   *   （目标漂移扰动推进队形，交换比 2.88 < 9.36），故定稿为静态表。
   * 开关：`settings.smartBattle`（默认开）——出征 / 自动出征面板的「战术」下拉，
   *   选「⚡ 智能战斗」开、选任何其他项关；执行点在 `battle.stepBattle`（唯一推进出口）。
   * ============================================================ */
  DATA.SMART_PLAN = {
    gapInf: 250,        /* 步近战：距敌前军 ≤ 250 → 转防御（结阵 · 受创减半） */
    gapCav: 250,        /* 骑兵：冲到位（≤ 250）→ 转防御（缠斗） */
    rangeK: 1.0,        /* 远程：进自身射程（× rangeK）→ 转防御（站桩输出） */
    /* 目标指派（我方兵种 → 敌方代表兵种）——依据相克表 + "切后排"常识，扫参确定 */
    targets: {
      changqiang: 'qingji',        /* 长枪 → 轻骑（打骑 ×3 · 挨骑 ×5 防御） */
      daodun: 'gongjian',          /* 刀盾 → 弓（防射 ×3 顶箭冲锋 · 弓防最低） */
      tengjiabing: 'changqiang',   /* 藤甲 → 长枪（防高扛枪阵） */
      gongjian: 'gongjian',        /* 弓 → 弓（对射 · 两边都防 50，先手定胜负） */
      toudan: 'gongjian',          /* 投石 → 弓（高攻打最软目标） */
      chuangnu: 'chuangnu',        /* 床弩 → 器械（×3 反器械） */
      qingji: 'gongjian', tieji: 'gongjian', tuqibing: 'gongjian',
      hubaoqi: 'gongjian', xiliangtieqi: 'gongjian', nanjiangxiangbing: 'gongjian',
      /* 骑族 → 弓（骑防远程 ×2~×4 · 冲散后排火力） */
    },
  };""")

# ══════════ ② battle.js · smart 组（插在 stepBattle 之前） ══════════
rep('js/battle.js', 'battle · smart 组（唯一执行器）',
"""  /* 推进一回合：指令先落会话、快照进 history（重放一致），再 step */
  GAME.battle.stepBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    var snapCmd = U.deep(rec.cmd || {});""",
"""  /* ============================================================
   * v89.164（老板 3）：**智能战斗**（通用战斗方案的执行器 · 规则表 DATA.SMART_PLAN）
   * ------------------------------------------------------------
   * 开关 `settings.smartBattle`（默认开）；执行点 = stepBattle（推进的唯一出口）：
   *   本回合指令改写 → 落 rec.cmd（界面下拉即读它）→ 照常进 history 快照，
   *   于是重放 / 读档 / 沙盘校验全部逐回合一致（与玩家手改指令同一条链）。
   * 只托管**我方攻方**（rec.side === 'atk'）——守城侧有城墙/固守逻辑，不掺和。
   * ============================================================ */
  GAME.battle.smartPlanOf = function () {
    return DATA.SMART_PLAN || { gapInf: 250, gapCav: 250, rangeK: 1, targets: {} };
  };
  GAME.battle.smartOnOf = function () {
    var s = GAME.state;
    return !(s && s.settings && s.settings.smartBattle === false);   /* 默认开 */
  };
  GAME.battle.setSmartBattle = function (on) {
    var s = GAME.state;
    if (!s) return;
    s.settings = s.settings || {};
    s.settings.smartBattle = !!on;
  };
  /* 单个单位的姿态决策（纯函数 · 执行与断言共用）：
     u = 内部单位（读 range/spd）；gap = 到敌前军间距（field − 双方前出）。 */
  GAME.battle.smartStanceOf = function (u, gap, plan) {
    plan = plan || GAME.battle.smartPlanOf();
    if ((u.range || 0) >= 500) {
      return (gap <= u.range * (plan.rangeK || 1)) ? 'hold' : 'advance';
    }
    var isCav = (u.spd || 0) >= 400;
    var k = isCav ? (plan.gapCav != null ? plan.gapCav : 250)
                  : (plan.gapInf != null ? plan.gapInf : 250);
    return (gap <= k) ? 'hold' : 'advance';
  };
  /* 应用：把方案写进本场战斗（env.setCmd + rec.cmd）。
     只托管攻方；返回"本回合改了几支部队"（探针/断言用）。 */
  GAME.battle.smartApply = function (rec, env) {
    if (!rec || rec.side !== 'atk' || !env || !env.setCmd) return 0;
    var plan = GAME.battle.smartPlanOf();
    var mine = (env.units && env.units.atk) || [];
    var theirs = (env.units && env.units.def) || [];
    var D = env.field || 1, themFront = 0;
    theirs.forEach(function (x) { if (x.count > 0 && x.adv > themFront) themFront = x.adv; });
    rec.cmd = rec.cmd || {};
    var n = 0;
    mine.forEach(function (u) {
      if (!(u.count > 0)) return;
      var c = rec.cmd[u.id] = rec.cmd[u.id] || {};
      var wantS = GAME.battle.smartStanceOf(u, D - u.adv - themFront, plan);
      var wantT = plan.targets[u.id];
      var patch = {};
      if (wantS && c.s !== wantS) { c.s = wantS; patch.s = wantS; }
      if (wantT != null && c.t !== wantT) { c.t = wantT; patch.t = wantT; }
      if (patch.s || patch.t !== undefined) { env.setCmd('atk', u.id, patch); n++; }
    });
    return n;
  };
  /* 推进一回合：指令先落会话、快照进 history（重放一致），再 step */
  GAME.battle.stepBattle = function (id) {
    var ses = GAME._bsess && GAME._bsess[id];
    var rec = GAME.battle._recOf(id);
    if (!ses || !rec || rec.state !== 'live') return null;
    /* v89.164：智能战斗（默认开）——本回合先改写我方指令（姿态+目标），
       改写落 rec.cmd → 随后照常进 history 快照（重放/读档逐回合一致）。 */
    if (GAME.battle.smartOnOf()) GAME.battle.smartApply(rec, ses);
    var snapCmd = U.deep(rec.cmd || {});""")

print('\n'.join(LOG))
print('补丁 B 完成')
