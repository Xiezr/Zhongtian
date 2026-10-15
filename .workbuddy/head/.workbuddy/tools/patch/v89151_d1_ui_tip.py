# -*- coding: utf-8 -*-
"""v89.151 批 D1：ui.js —— 克制反查出口 + btUnitTip 重写为富浮层 + 兵牌/侧栏接入"""
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()

# ---------- ① btUnitTip 整函数重写（纯文本 → HTML 浮层 + 克制绿红） ----------
OLD = """  ui.btUnitTip = function (u, side) {
    if (!u) return '';
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var gen = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) gen = x; });
      } else {
        gen = (rec.sim && rec.sim.scGen) || null;
      }
    }
    var f = GAME.battle.unitFinalOf ? GAME.battle.unitFinalOf(u, gen) : null;
    if (!f) return u.name || '';
    var lines = [f.name + '\u3000' + U.fmt(f.count) + ' 名（含科技 / 将领 / 装备加成）'];
    lines.push('攻 ' + U.fmt(f.atk) + (f.atk !== f.baseAtk ? '（基础 ' + f.baseAtk + '）' : ''));
    lines.push('防 ' + U.fmt(f.def) + (f.def !== f.baseDef ? '（基础 ' + f.baseDef + '）' : ''));
    lines.push('血 ' + U.fmt(f.hp) + (f.hp !== f.baseHp ? '（基础 ' + f.baseHp + '）' : ''));
    lines.push('射程 ' + U.fmt(f.range) + '\u3000速度 ' + U.fmt(f.spd));
    lines.push('全军合计：攻 ' + U.fmt(f.totalAtk) + '\u3000血 ' + U.fmt(f.totalHp));
    if (gen) lines.push('带队：' + gen.name + '（Lv' + (gen.level || 1) + '）');
    else lines.push('（无将领带队）');
    lines.push('相克 / 攻城等对局因子随目标变化，见兵种说明');
    return lines.join('\\n');
  };"""

NEW = """  /* ============================================================
   * v89.151（老板 5）：兵种"克制 / 被克"反查 —— **唯一出口**。
   * ------------------------------------------------------------
   * 数据源 = 两张方向表（v57 B 套，见 data.js 注释），本函数只读不算：
   *   · `COUNTER_ATK[我][他] > 1` → 我打他更狠           → 克制（绿）
   *   · `COUNTER_DEF[我][他] > 1` → 我挨他打更抗（盾挡箭）→ 抗性（绿）
   *   · 两张表的**反向**命中     → 他打我狠 / 他抗我打   → 被克（红）
   * 悬停、探针、断言都读它；改相克表不用动界面。
   * ============================================================ */
  ui.troopCounterOf = function (id) {
    var T = DATA.TROOPS;
    if (!T || !T[id]) return null;
    var beats = [], resists = [], beaten = [];
    Object.keys(T).forEach(function (fid) {
      if (fid === id) return;
      var nm = T[fid].name || fid;
      var atk = (DATA.COUNTER_ATK[id] || {})[fid] || 1;     /* 我打他：我的攻 ×N */
      var def = (DATA.COUNTER_DEF[id] || {})[fid] || 1;     /* 我挨他打：我的防 ×N */
      var fAtk = (DATA.COUNTER_ATK[fid] || {})[id] || 1;    /* 他打我：他的攻 ×N */
      var fDef = (DATA.COUNTER_DEF[fid] || {})[id] || 1;    /* 他挨我打：他的防 ×N */
      if (atk > 1) beats.push({ id: fid, name: nm, mul: atk });
      if (def > 1) resists.push({ id: fid, name: nm, mul: def });
      if (fAtk > 1) beaten.push({ id: fid, name: nm, mul: fAtk, by: 'atk' });
      else if (fDef > 1) beaten.push({ id: fid, name: nm, mul: fDef, by: 'def' });
    });
    return { beats: beats, resists: resists, beaten: beaten };
  };
  ui.btUnitTip = function (u, side) {
    if (!u) return '';
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var gen = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) gen = x; });
      } else {
        gen = (rec.sim && rec.sim.scGen) || null;
      }
    }
    var f = GAME.battle.unitFinalOf ? GAME.battle.unitFinalOf(u, gen) : null;
    if (!f) return U.escape(u.name || '');
    /* v89.151（老板 5）：改成**富浮层 HTML** —— 排版按老板指定自上而下：
       兵种 → 数量 → 射程（并速度）→ 全军血量 → 全军攻击 → 全军防御 →
       克制（绿）→ 抗性（绿）→ 被克（红）；收尾一行带队与加成说明。
       ⛔ 显示"计算值"：血/攻/防都走 unitFinalOf（同一把尺，含科技/将领/装备加成）。 */
    var h = '<div class="tip-t">' + U.escape(f.name) + '</div>';
    h += '<div class="tip-l">数量 <b>' + U.fmt(f.count) + '</b> 名</div>';
    h += '<div class="tip-l">射程 <b>' + U.fmt(f.range) + '</b>　速度 <b>' + U.fmt(f.spd) + '</b></div>';
    h += '<div class="tip-l">全军血量 <b>' + U.fmt(f.totalHp) + '</b></div>';
    h += '<div class="tip-l">全军攻击 <b>' + U.fmt(f.totalAtk) + '</b></div>';
    h += '<div class="tip-l">全军防御 <b>' + U.fmt(f.totalDef) + '</b></div>';
    var c = ui.troopCounterOf(u.id);
    if (c) {
      if (c.beats.length) {
        h += '<div class="tip-l cnt-good">克制：' + c.beats.map(function (x) {
          return U.escape(x.name) + ' ×' + x.mul;
        }).join(' · ') + '（我打他更狠）</div>';
      }
      if (c.resists.length) {
        h += '<div class="tip-l cnt-good">抗性：' + c.resists.map(function (x) {
          return U.escape(x.name) + ' ×' + x.mul;
        }).join(' · ') + '（我挨他打更抗）</div>';
      }
      if (c.beaten.length) {
        h += '<div class="tip-l cnt-bad">被克：' + c.beaten.map(function (x) {
          return U.escape(x.name) + '（' + (x.by === 'atk' ? '他攻 ×' : '他防 ×') + x.mul + '）';
        }).join(' · ') + '</div>';
      }
      if (!c.beats.length && !c.resists.length && !c.beaten.length) {
        h += '<div class="tip-l">无相克（凭硬实力对拼）</div>';
      }
    }
    h += '<div class="tip-a">' + (gen ? '带队 ' + U.escape(gen.name) + '（Lv' + (gen.level || 1) + '）· ' : '（无将领带队）· ')
      + '已含科技 / 将领 / 装备加成</div>';
    return h;
  };"""

assert s.count(OLD) == 1, 'btUnitTip count=' + str(s.count(OLD))
s = s.replace(OLD, NEW)
print('OK ① btUnitTip 重写 + troopCounterOf')

# ---------- ② 兵牌 uHTML：title → data-tip-el + tip-src ----------
OLD2 = """      return '<div class="bt-unit ' + side + ' ' + _sh150 + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        /* v89.137（老板 2）：战场兵牌同享"最终属性"悬停（同一出口） */
        'title="' + U.escape(ui.btUnitTip(u, side)) + '" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;--rel:' + rel + ';">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span></div>';"""

NEW2 = """      /* v89.151（老板 5）：悬停从 title（纯文本）改**富浮层**（#tip-layer 走 data-tip-el 机制）
         —— 克制/被克要绿字红字，title 装不下颜色。文案与侧栏共用同一出口 `ui.btUnitTip`。 */
      return '<div class="bt-unit ' + side + ' ' + _sh150 + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'data-tip-el="1" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;--rel:' + rel + ';">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<span class="tip-src">' + ui.btUnitTip(u, side) + '</span></div>';"""

assert s.count(OLD2) == 1, 'uHTML count=' + str(s.count(OLD2))
s = s.replace(OLD2, NEW2)
print('OK ② 兵牌浮层')

# ---------- ③ 侧栏名称：title → data-tip-el + tip-src ----------
OLD3 = """          '<i class="bt-rnm" title="' + U.escape(ui.btUnitTip(u, side)) + '">'
            + U.escape(GAME.troopAbOf(u.id)) + '</i>' +"""

NEW3 = """          /* v89.151（老板 5）：同走富浮层（与兵牌同一出口）—— 简称是悬停靶心 */
          '<i class="bt-rnm" data-tip-el="1">' + U.escape(GAME.troopAbOf(u.id))
            + '<span class="tip-src">' + ui.btUnitTip(u, side) + '</span></i>' +"""

assert s.count(OLD3) == 1, '侧栏名称 count=' + str(s.count(OLD3))
s = s.replace(OLD3, NEW3)
print('OK ③ 侧栏名称浮层')

assert '\r\n' not in s
assert s.count('ui.troopCounterOf = function') == 1
assert s.count("data-tip-el=\"1\"") >= 2
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ui.js D1 落盘 OK · len=' + str(len(s)))
