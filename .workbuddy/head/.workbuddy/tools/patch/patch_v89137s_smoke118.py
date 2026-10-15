# -*- coding: utf-8 -*-
"""v89.137 补丁 S：smoke-test.js 追加 §118 段（本轮七条需求的门禁断言）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
assert s.count(anchor) == 1, 'anchor %d' % s.count(anchor)

block = """  /* ============================================================
   * 118. v89.137（老板七条：建筑专精三档 / 官府 / 战场记录 / 兵种悬停 /
   *      附属野地操作列 / 派驻进出征界面 / 积压清单）
   * ============================================================ */
  console.log('\\n===== 118. v89.137（专精三档 · 官府 · 战场 · 附属野地 · 派驻统一） =====');
  (function () {
    var _fs118 = require('fs'), _p118 = require('path');
    var u118 = _fs118.readFileSync(_p118.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m118 = _fs118.readFileSync(_p118.join(__dirname, 'js', 'main.js'), 'utf8');
    var d118 = _fs118.readFileSync(_p118.join(__dirname, 'js', 'domain.js'), 'utf8');
    var b118 = _fs118.readFileSync(_p118.join(__dirname, 'js', 'battle.js'), 'utf8');
    var mp118 = _fs118.readFileSync(_p118.join(__dirname, 'js', 'map.js'), 'utf8');
    var h118 = _fs118.readFileSync(_p118.join(__dirname, 'index.html'), 'utf8');
    var uc = stripComment(u118), mc = stripComment(m118), dc = stripComment(d118);
    var bc = stripComment(b118), pc = stripComment(mp118);

    /* ---- ① 建筑专精（老板 5）：唯一出口 + 三档消费点 ---------- */
    check('§118① 建筑专精：唯二出口（masteryTierOf / mastery）× 布尔版已删（audit 零死函数协同）', (function () {
      return /GAME\\.masteryTierOf = function/.test(dc) && /GAME\\.mastery = function/.test(dc)
        && /GAME\\.masteryOf = function/.test(dc) === false
        && /DATA\\.MASTERY_TIERS = \\[12, 24, 36\\]/.test(stripComment(
          _fs118.readFileSync(_p118.join(__dirname, 'js', 'data.js'), 'utf8')));
    })());
    check('§118① 消费点全部含档数（7 处硬编码布尔已升级）', (function () {
      /* 逐个查"读点"的形态：mastery('key', ...) 或 masteryTierOf */
      return /GAME\\.mastery\\('trainSlot', city\\)/.test(dc)
        && /GAME\\.mastery\\('craftTimePct', city\\)/.test(dc)
        && /GAME\\.mastery\\('genRoom', city\\)/.test(dc)
        && /GAME\\.mastery\\('innSlot', city\\)/.test(dc)
        && /GAME\\.mastery\\('defPct', city\\)/.test(dc)
        && /GAME\\.mastery\\('marchAdd', fc\\)/.test(bc)
        && /GAME\\.mastery\\('beaconBoost', fc\\)/.test(bc);
    })());
    check('§118① 实测：三档值 = val × 档数（民房 popPct：12→1 档 / 24→2 档 / 36→3 档）', (function () {
      var c = G.makeCity({ id: 'v137b', name: 'B', x: 1, y: 1, type: 'self' });
      c.cells.forEach(function (x) { if (x.build) x.build.lvl = 0; });
      var mf = null; (DATA.MASTERY || []).forEach(function (m) { if (m.bid === 'minfang') mf = m; });
      function at(lv) {
        c.cells.forEach(function (x) { if (x.build && x.build.id === 'minfang') x.build.lvl = 0; });
        c.cells[0].build = { id: 'minfang', lvl: lv };
        return { t: G.masteryTierOf(c, 'minfang'), v: G.mastery('popPct', c) };
      }
      var a = at(12), b2 = at(24), c3 = at(36);
      return a.t === 1 && Math.abs(a.v - mf.val) < 1e-9
        && b2.t === 2 && Math.abs(b2.v - mf.val * 2) < 1e-9
        && c3.t === 3 && Math.abs(c3.v - mf.val * 3) < 1e-9;
    })());

    /* ---- ② 官府（老板 4）：主城常显 / 全境营造总览已删 / 规格统一 ---------- */
    check('§118② 官府要务：主城入口**常显**（已是主城 → 「本城即主城」状态标记）', (function () {
      return /本城即主城/.test(uc) && /isMain135\\s*\\n?\\s*\\?/.test(uc)
        && /data-action="set-main-city"/.test(uc);
    })());
    check('§118② 官府要务：四个按钮规格统一（全 btn sm · 图标全 emoji 族）+ 无全境营造总览', (function () {
      var seg = uc.slice(uc.indexOf('官府要务'), uc.indexOf('官府要务') + 2600);
      return seg.indexOf('open-build-ov') < 0 && seg.indexOf('🏗') < 0
        && seg.indexOf('📝 修改城名') >= 0 && seg.indexOf('🏛 设为主城') >= 0
        && seg.indexOf('🏛 本城即主城') >= 0 && seg.indexOf('🌾 种田秘境') >= 0
        /* 统一规格：这三颗都是 btn sm（gold 只作配色，不再是 btn gold 的尺寸档） */
        && /btn sm' \\+ \\(isMain135/.test(seg) === false
        && /class="btn sm[^"]*" data-action="open-farm"/.test(seg);
    })());

    /* ---- ③ 战场（老板 2/3）：兵种悬停最终属性 + 回合记录下移到底 ---------- */
    check('§118③ 兵种悬停：ui.btUnitTip 唯一读 GAME.battle.unitFinalOf（两处 title 共用）', (function () {
      return /ui\\.btUnitTip = function/.test(uc)
        && /GAME\\.battle\\.unitFinalOf\\(u, gen\\)/.test(uc)
        && /U\\.escape\\(ui\\.btUnitTip\\(u, side\\)\\)/.test(uc)
        && (uc.match(/ui\\.btUnitTip\\(u, side\\)/g) || []).length >= 2;
    })());
    check('§118③ 实测：unitFinalOf 输出最终属性（含科技/将领加成 · 无将↔有将 hp 不同）', (function () {
      var u = { id: 'changqiang', count: 100, cover: 1, atkPct: 0, defPct: 0,
        hpPer: DATA.TROOPS.changqiang.hp, spd: DATA.TROOPS.changqiang.spd };
      var f0 = G.battle.unitFinalOf(u, null);
      var g = G.makeGeneral('验将', 12, 'idle', null, false);
      var f1 = G.battle.unitFinalOf(u, g);
      if (!f0 || !f1) return false;
      var t = DATA.TROOPS.changqiang;
      return f0.baseAtk === t.atk && f0.atk >= t.atk
        && f0.range === t.range && f0.totalAtk === f0.atk * 100
        && f1.hp >= f0.hp
        && G.battle.unitFinalOf({ id: '__nope', count: 1 }, null) === null;
    })());
    check('§118③ 回合记录下移到底 + 16 行：CSS（flex 撑满 · min-height 336px）+ BT_LOG_MAX=64', (function () {
      return /#bt-wrap \\{ display: flex; flex-direction: column; min-height: 100%; \\}/.test(h118)
        && /\\.bt-log \\{ flex: 1 1 auto; max-height: none; min-height: 336px;/.test(h118)
        && /ui\\.BT_LOG_MAX = 64;/.test(uc);
    })());

    /* ---- ④ 附属野地（老板 6）：操作列四按钮 ---------- */
    check('§118④ 附属野地：操作列四按钮（派驻/采集/收获/召回）齐备且同一条唯一入口', (function () {
      var seg = uc.slice(uc.indexOf('ui.openWilds = function'), uc.indexOf('ui.openWilds = function') + 5200);
      return /<th class="ctr">操作<\\/th>/.test(seg)
        && seg.indexOf('data-action="wild-garrison-open"') >= 0
        && seg.indexOf('data-action="wild-garrison-gather"') >= 0
        && seg.indexOf('data-action="gather-finish"') >= 0
        && seg.indexOf('data-action="wild-withdraw"') >= 0
        && seg.indexOf('_gy137.ready') >= 0;     /* 收获判据与 gather-finish 同源 */
    })());

    /* ---- ⑤ 派驻 → 出征界面（老板 7）：三个入口一个动作 ---------- */
    check('§118⑤ 派驻统一：三入口（地块/军务/附属野地）共用 wild-garrison-open → 出征界面', (function () {
      return (uc.match(/data-action="wild-garrison-open"/g) || []).length >= 3
        && /case 'wild-garrison-open':/.test(mc)
        && /ui\\.openExpModal\\(\\{ kind: 'wild', x: Number\\(el\\.dataset\\.x\\), y: Number\\(el\\.dataset\\.y\\) \\}\\)/.test(mc);
    })());
    check('§118⑤ 出征界面：己方野地只出「驻守·增援」+ 已有驻将不带将（界面与硬闸同判据）', (function () {
      return /if \\(isOwnWild137\\) return m\\.id === 'station';/.test(uc)
        && /stGen137/.test(uc) && /本次增援<b>不带将<\\/b>/.test(uc)
        && /_cap137b/.test(bc) && /_stNoGen137/.test(bc);
    })());
    check('§118⑤ 实测：己方野地 station 三判据（空野地无将拒 / 超上限拒 / 已有驻将放行无将）', (function () {
      var st = G.state, keep = st.wilds, keepM = st.marches;
      var keepArmy = null, c = G.currentCity();
      try {
        var wt = null;
        for (var dy = 11; dy <= 16 && !wt; dy++) for (var dx = 11; dx <= 16 && !wt; dx++) {
          var tl = G.map.tile(c.x + dx, c.y + dy);
          if (tl && tl.terrain !== 'city' && !G.map.wildAt(c.x + dx, c.y + dy)) {
            wt = { x: c.x + dx, y: c.y + dy, t: tl.terrain };
          }
        }
        if (!wt) return false;
        keepArmy = JSON.parse(JSON.stringify(c.army || {}));
        st.wilds = (st.wilds || []).concat([{ x: wt.x, y: wt.y, type: wt.t, level: 2, day: 0, startDay: 0 }]);
        st.marches = [];
        c.army = { yibing: 40000 };
        var g = st.generals[0]; g.status = 'idle'; g.cityId = c.id;
        var w = G.map.wildAt(wt.x, wt.y);
        /* A：空野地 + 无将 → 拒 */
        var rA = G.battle.prepare({ kind: 'wild', x: wt.x, y: wt.y }, 'station', { yibing: 100 }, '', {});
        /* B：超上限（Lv2 → 2 万）→ 拒 */
        var rB = G.battle.prepare({ kind: 'wild', x: wt.x, y: wt.y }, 'station', { yibing: 20001 }, g.id, {});
        /* C：已有驻将 + 无将 → 放行，且 gen 被硬闸置空 */
        w.garrison = { troops: { yibing: 100 }, cityId: c.id, genId: g.id };
        var rC = G.battle.prepare({ kind: 'wild', x: wt.x, y: wt.y }, 'station', { yibing: 100 }, '', {});
        /* D：已有驻将 + 带将 → 放行但 gen 为空（不把将带走） */
        var rD = G.battle.prepare({ kind: 'wild', x: wt.x, y: wt.y }, 'station', { yibing: 100 }, g.id, {});
        return !(rA && rA.ok) && !(rB && rB.ok) && /驻军上限/.test((rB && rB.msg) || '')
          && !!(rC && rC.ok) && rC.gen === null
          && !!(rD && rD.ok) && rD.gen === null;
      } finally {
        st.wilds = keep; st.marches = keepM;
        if (keepArmy) c.army = keepArmy;
      }
    })());

    /* ---- ⑥ 积压清单：采集可见性 + 细分标记 ---------- */
    check('§118⑥ 采集可见性：资源区下拉 ⛏ 标记（签名含在采状态）+ 大地图绿点', (function () {
      return /_gatherFlag137/.test(uc) && /⛏/.test(uc)
        && /GAME\\.gatherAt\\(w\\.x, w\\.y\\)\\) \\{/.test(pc)
        && /'#3ad07a'/.test(pc) && /diaBox\\(gx, gy, el, 0\\)/.test(pc);
    })());
    check('§118⑥ 战术细分：跟随通用 / 细分 小标（ownSub137 判据 = 细分表有记录）', (function () {
      return /ownSub137/.test(uc) && /跟随通用/.test(uc)
        && /\\.tl-sub-tag/.test(h118) && /class="tl-sub-tag' \\+ \\(ownSub137 \\? ' own' : ''\\)/.test(uc);
    })());
  })();

""" + anchor

s = s.replace(anchor, block)
assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
print('✅ smoke-test.js 补丁S（§118）完成：%d → %d 字节' % (n0, len(s)))
