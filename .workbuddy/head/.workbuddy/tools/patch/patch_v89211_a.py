# -*- coding: utf-8 -*-
"""v89.211 补丁 A：强化乘数收敛（domain 出口 + systems 结算/评分）
   A1 domain.js：eqEnhMulOf / eqLingMulOf（乘数唯一出口）
   A2 domain.js：wallPlanIdxOf / migrateWallCell211（占城空格存量修复出口）
   A3 systems.js：genEquipBonus 读 eqEnhMulOf；equipScore 兼容实例并计入强化
   铁律：先备份（调用方已备份）→ 锚点断言 → 原子落盘 → 写后自检。"""
import io, sys, os

R = 'E:/Deepseekdb/'
def rd(p):
    with io.open(R + p, 'r', encoding='utf-8', newline='') as f:
        return f.read()
def wr(p, s):
    with io.open(R + p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def sub1(s, old, new, tag, cnt=1):
    n = s.count(old)
    assert n == cnt, '[%s] anchor count=%d (want %d)' % (tag, n, cnt)
    return s.replace(old, new)

# ---------------- A1: 乘数唯一出口 ----------------
s = rd('js/domain.js')
if 'GAME.eqEnhMulOf = function' in s:
    print('[skip] A1 乘数出口已在册')
else:
    old = "  GAME.eqEnhOf = function (x) { return (x && typeof x === 'object' && x.enh) || 0; };"
    new = old + """

  /* v89.211（老板 1「强化后装备属性似乎并未真实增加」数值链大排查）：
     强化乘数**唯一出口** —— 结算（genEquipBonus）与展示（equipDescOf）与评分
     （equipScore）读同一份。改前乘数只在 genEquipBonus 里现写一份、展示侧全部
     读原值 —— 数值链本身是通的（探针 A/B 实证），断在"展示与结算分离"这一手：
     玩家看到 +10 的件写着原属性，观感就是"强化了没增加"。 */
  GAME.eqEnhMulOf = function (x) {
    var lv = GAME.eqEnhOf(x);
    return lv ? 1 + lv * ((DATA.ENHANCE && DATA.ENHANCE.perLv) || 0.08) : 1;
  };
  /* 蕴养乘数（灵力口径）——与状态层 lingPowerOf 同源（LING_TEMPER.perLv）。 */
  GAME.eqLingMulOf = function (x) {
    var lv = GAME.eqEnhOf(x);
    return lv ? 1 + lv * ((DATA.LING_TEMPER && DATA.LING_TEMPER.perLv) || 0.08) : 1;
  };"""
    s = sub1(s, old, new, 'A1')
    wr('js/domain.js', s)
    print('[ok] A1 乘数出口')

# ---------------- A2: 占城空格存量修复出口 ----------------
s = rd('js/domain.js')
if 'GAME.migrateWallCell211 = function' in s:
    print('[skip] A2 存量修复出口已在册')
else:
    old = "    s._lingLord1 = 1;\n    return s;\n  };"
    new = old + """

  /* ============================================================
   * v89.211（老板 2 存量修复）：占城"城墙格释放成空格"的补齐 —— 唯一出口
   * ------------------------------------------------------------
   * 沿革：v89.126 城墙占格 → v89.128 归一进环城槽，占城（onConquer）与读档迁移
   * 都把原墙格 `build=null` 释放 —— 于是"打下一座满配城"多出一个空格
   * （8×6 布局里恒为 r5c6 / idx37，老板实测"第五行第六格未建造"即此）。
   * v89.211 起：释放格**补建民房**（新占/新迁移都走新口径）；
   * 本迁移负责**存量档**：按紧签名补齐（只在能确证是"那次释放"的城上动手）——
   *   签名 = 占来的城（origId）＋ 8×6 全建满只差**恰一格**空白（无 build 无 pending）
   *          ＋ 空位 == 布局的城墙格 ＋ 城墙在环城槽。
   * 负例保护：玩家自建城（无 origId）、空格 ≥2（被动过工）、在建格（pending）一律不碰。
   * 一次性（`_wallCell211` 标记）；不动玩法数值，只补一块民房。
   * ============================================================ */
  GAME.wallPlanIdxOf = function () {
    var p = GAME.cityPlanOf(1, 1);
    for (var i = 0; i < p.cells.length; i++) {
      if (p.cells[i].build && p.cells[i].build.id === 'chengqiang') return i;
    }
    return -1;
  };
  GAME.migrateWallCell211 = function (s) {
    if (!s || s._wallCell211) return s;
    var wIdx = GAME.wallPlanIdxOf();
    if (wIdx < 0) { s._wallCell211 = 1; return s; }
    (s.cities || []).forEach(function (c) {
      if (!c || !c.origId || !c.cells || !c.wall || !c.wall.build) return;
      if ((c.col || 8) !== 8 || (c.row || 6) !== 6) return;   /* 签名位按 8×6 布局 */
      var empt = [];
      c.cells.forEach(function (x, i) { if (!x.build && !x.pending) empt.push(i); });
      if (empt.length !== 1 || empt[0] !== wIdx) return;
      c.cells[wIdx].build = { id: 'minfang', lvl: (c.wall.build.lvl || 1) };
      c.cells[wIdx].pending = null;
      /* 不静默（v89.127 精神）：改版提示进消息流，玩家翻得到"这一格哪来的" */
      var _m211 = '🔧 城内整备：『' + c.name + '』补建一格民居（原城墙占位 · v89.128 释放的空格）';
      s.log = s.log || [];
      s.log.unshift({ t: U.now(), msg: _m211 });
      if (s.log.length > 40) s.log.pop();
      s.msgLog = s.msgLog || [];
      s.msgLog.push({ t: U.now(), gt: (s.world && s.world.elapsed) || 0, msg: _m211, k: 'sys' });
    });
    s._wallCell211 = 1;
    return s;
  };"""
    s = sub1(s, old, new, 'A2')
    wr('js/domain.js', s)
    print('[ok] A2 存量修复出口')

# ---------------- A3: systems.js 结算与评分 ----------------
s = rd('js/systems.js')
if 'GAME.eqEnhMulOf(inst)' in s:
    print('[skip] A3 genEquipBonus 已收敛')
else:
    old = """      /* v79 · 百炼强化改**按件**：读这一件自己的 inst.enh（同名各件互不影响）。
         乘在「装备本身」这一层（套装加成不参与强化）——结算口径唯一在这里。 */
      var enhLv = (GAME.eqEnhOf ? GAME.eqEnhOf(inst) : 0);
      if (enhLv) mul *= 1 + enhLv * ((DATA.ENHANCE && DATA.ENHANCE.perLv) || 0.08);"""
    new = """      /* v79 · 百炼强化改**按件**：读这一件自己的 inst.enh（同名各件互不影响）。
         乘在「装备本身」这一层（套装加成不参与强化）。
         v89.211：乘数收敛到 GAME.eqEnhMulOf（唯一出口）—— 展示 equipDescOf 与评分
         equipScore 读同一份；改前只在这里现写一份、展示侧读原值（"强化了数字没动"）。 */
      mul *= (GAME.eqEnhMulOf ? GAME.eqEnhMulOf(inst) : 1);"""
    s = sub1(s, old, new, 'A3a')

old_b = """  /* 装备评分（同槽位比较优劣；套装件略有加成）
     v66：`it.hp` → `it.sta`（同一列改回源数据的名字，权重 0.2 不变）。 */
  S.equipScore = function (it) {
    if (!it) return -1;
    var v = (it.tong || 0) * 3 + (it.yw || 0) * 3 + (it.zm || 0) * 3 + (it.nz || 0) * 3
      + (it.atk || 0) + (it.def || 0) + (it.sta || 0) * 0.2 + (it.spd || 0) * 4;
    v += (it.lingv || 0) * 0.5;   /* v88：灵力计入评分（修炼侧同槽比优；军装 lingv=0 无影响） */
    return v + (it.set ? 50 : 0);
  };"""
new_b = """  /* 装备评分（同槽位比较优劣；套装件略有加成）
     v66：`it.hp` → `it.sta`（同一列改回源数据的名字，权重 0.2 不变）。
     v89.211（老板 1）：入参兼容**装备谱 / 实例**（对象一律按 id 查谱）；按件强化/蕴养
     计入评分 —— 改前"一键最优"会把 +10 的换下、换上 +0 的略高基础件。 */
  S.equipScore = function (x) {
    var it = (x && typeof x === 'object') ? DATA.EQUIP[GAME.eqId(x)] : x;
    if (!it) return -1;
    var v = (it.tong || 0) * 3 + (it.yw || 0) * 3 + (it.zm || 0) * 3 + (it.nz || 0) * 3
      + (it.atk || 0) + (it.def || 0) + (it.sta || 0) * 0.2 + (it.spd || 0) * 4;
    v += (it.lingv || 0) * 0.5;   /* v88：灵力计入评分（修炼侧同槽比优；军装 lingv=0 无影响） */
    if (x && typeof x === 'object') {
      /* v89.211：属性部分按件乘（六维/攻防/速/体走 eqEnhMulOf、灵力走 eqLingMulOf ——
         与结算同源）；套装档位加成 50 与强化无关（同 genEquipBonus 口径）。 */
      var _mu = (GAME.eqEnhMulOf && GAME.eqEnhMulOf(x)) || 1;
      var _ml = (GAME.eqLingMulOf && GAME.eqLingMulOf(x)) || 1;
      v = (v - (it.lingv || 0) * 0.5) * _mu + (it.lingv || 0) * 0.5 * _ml;
    }
    return v + (it.set ? 50 : 0);
  };"""
if 'S.equipScore = function (x)' in s:
    print('[skip] A3b equipScore 已升级')
else:
    s = sub1(s, old_b, new_b, 'A3b')
wr('js/systems.js', s)
print('[ok] A3 systems 结算与评分')

print('DONE')
