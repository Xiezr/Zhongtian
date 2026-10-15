# -*- coding: utf-8 -*-
"""v88 状态层（state.js）：双轨切换 + 灵力出口 + 江湖游历出口组。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\state.js'
d = io.open(P, encoding='utf-8', newline='').read()
dirty = False

ANCHOR = """    var line = sc.icon + ' ' + sc.name + '：' + out.t + '（' + texts.join('、') + '）';
    GAME.log('🏕️ ' + (DATA.TERRAIN[GAME.map.tile(x, y).terrain] || {}).name + ' · ' + line);
    return { ok: true, name: out.t, text: texts.join('、'), bad: bad };
  };
})();"""

BLOCK = """    var line = sc.icon + ' ' + sc.name + '：' + out.t + '（' + texts.join('、') + '）';
    GAME.log('🏕️ ' + (DATA.TERRAIN[GAME.map.tile(x, y).terrain] || {}).name + ' · ' + line);
    return { ok: true, name: out.t, text: texts.join('、'), bad: bad };
  };

  /* ============================================================
   * v88（老板「修炼培养系统」）：灵气双轨 + 江湖游历 —— 唯一出口组
   * ------------------------------------------------------------
   * ① 双轨切换：g.equipOn = 'sha'（军装）| 'ling'（修炼）。
   *    分流唯一出口 systems.equipBagOf -> genEquipBonus；六维/体力/战斗/
   *    界面显示全部消费该出口 —— 切换后全链自动同步（零特判）。
   * ② 灵力（lingPowerOf）：修炼装备汇总（Σ lingv x 蕴养系数）。
   *    **独立于六维与战斗公式** —— 只用于江湖游历判定（与当前生效套无关）。
   * ③ 江湖游历：与 v87 地形场景并存（场景=趣味奇遇一次；江湖=修炼活动菜单，
   *    每处**每活动**每日一次，锁 s.jianghu = { 'x,y|act': day }）。
   *    消耗精力+体力；判定看灵力；风险=负伤（不损兵）；产出=灵气精华+低概率装备；
   *    结果种子化（invasionRoll，同一天同一地同一活动稳定可复现）。
   * ============================================================ */
  GAME.lingPowerOf = function (g) {
    if (!g) return 0;
    var bag = g.lingEquip || {}, t = 0;
    var perLv = (DATA.LING_TEMPER && DATA.LING_TEMPER.perLv) || 0.08;
    for (var slot in bag) {
      var inst = bag[slot];
      var it = DATA.EQUIP[GAME.eqId ? GAME.eqId(inst) : inst];
      if (!it || !it.lingv) continue;
      t += it.lingv * (1 + (GAME.eqEnhOf ? GAME.eqEnhOf(inst) : 0) * perLv);
    }
    return Math.round(t);
  };

  /* 双轨切换：want 省略 = 来回切；显式给 'sha'/'ling' 则定向 */
  GAME.toggleEquipSet = function (genId, want) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) return { ok: false, msg: '将领不存在' };
    var cur = g.equipOn || 'sha';
    var next = (want === 'sha' || want === 'ling') ? want : (cur === 'sha' ? 'ling' : 'sha');
    if (next === cur) return { ok: false, msg: '当前已是' + (next === 'ling' ? '修炼' : '军中') + '装备' };
    g.equipOn = next;
    var n = Object.keys(((next === 'ling') ? g.lingEquip : g.equip) || {}).length;
    GAME.log(g.name + ' 换装：' + (next === 'ling' ? '☯ 修炼装备' : '⚔ 军中装备') + '（' + n + ' / 12 件）');
    return { ok: true, msg: '已切换为' + (next === 'ling' ? '☯ 修炼装备' : '⚔ 军中装备'), set: next };
  };

  /* --------- 江湖游历 --------- */
  GAME.jianghuActsAt = function (terrain) {
    var out = [];
    Object.keys(DATA.LING_ACT || {}).forEach(function (id) {
      var a = DATA.LING_ACT[id];
      if (a.spots && a.spots.indexOf(terrain) >= 0) out.push({ id: id, def: a });
    });
    return out;
  };
  GAME.jianghuDone = function (s, x, y, actId, day) {
    return ((s.jianghu || {})[x + ',' + y + '|' + actId]) === day;
  };
  GAME.jianghuCheck = function (x, y, genId, actId) {
    var s = GAME.state;
    var tile = GAME.map.tile(x, y);
    if (!tile) return { ok: false, msg: '坐标越界' };
    var a = (DATA.LING_ACT || {})[actId];
    if (!a) return { ok: false, msg: '无此江湖活动' };
    if (!a.spots || a.spots.indexOf(tile.terrain) < 0) {
      return { ok: false, msg: ((DATA.TERRAIN[tile.terrain] || {}).name || '此地') + '做不了「' + a.name + '」' };
    }
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    if ((gen.energy || 0) < a.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + a.energy + '），可服清心丸' };
    }
    if (GAME.staNow(gen) < a.stam) {
      return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/' + a.stam + '），休整后再来' };
    }
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    if (GAME.jianghuDone(s, x, y, actId, day)) {
      return { ok: false, msg: '「' + a.name + '」此地今日已做过，明日再来' };
    }
    return { ok: true, act: a, gen: gen, day: day, lv: GAME.map.wildLevelNow(x, y) };
  };
  GAME.jianghuDo = function (x, y, genId, actId) {
    var s = GAME.state;
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    var a = chk.act, gen = chk.gen, day = chk.day, lv = chk.lv;
    var tile = GAME.map.tile(x, y);
    var seedBase = 'jh|' + x + ',' + y + '|' + actId + '|' + day;
    var roll = function (salt) { return GAME.invasionRoll(seedBase + '|' + salt); };
    var rnd = function (salt, lo, hi) {
      lo = Math.round(lo); hi = Math.round(hi);
      return lo + Math.floor(roll(salt) * (hi - lo + 1));
    };
    /* 扣费 + 锁 */
    gen.energy = Math.max(0, (gen.energy || 0) - a.energy);
    GAME.setStaNow(gen, GAME.staNow(gen) - a.stam);
    s.jianghu = s.jianghu || {};
    s.jianghu[x + ',' + y + '|' + actId] = day;
    /* 灵力（读修炼装备；与当前生效套无关） */
    var ling = GAME.lingPowerOf(gen);
    var texts = [];
    var bad = false;
    s.items = s.items || {};
    var ess = function (lo, hi, salt, tag) {
      var n = rnd(salt || 'ess', lo, hi);
      s.items.lingsui = (s.items.lingsui || 0) + n;
      texts.push('灵气精华 +' + n + (tag ? '（' + tag + '）' : ''));
      return n;
    };
    /* 低概率装备掉落（阶随野地等级 0-10 -> 1-6 阶） */
    var tryDrop = function (salt) {
      if (roll(salt + '|hit') >= a.drop) return;
      var q = Math.max(1, Math.min(6, 1 + Math.floor(lv / 2)));
      var slots = DATA.LING_SLOTS || [];
      if (!slots.length) return;
      var sl = slots[Math.floor(roll(salt + '|sl') * slots.length) % slots.length];
      var id = 'lg_' + sl.id + '_' + q;
      var it = DATA.EQUIP[id];
      if (!it) return;
      GAME.addEquip(id, 0);
      texts.push('拾得「' + it.name + '」（' + (DATA.LING_Q_NAME[q] || '') + '）');
    };
    var title = a.name;
    if (a.kind === 'fight') {
      /* 灵力判定：我方战力 =（灵力 + 等级 x2）x 种子波动；难度随野地等级 +35%/级 */
      var pow = (ling + (gen.level || 1) * 2) * (0.9 + roll('pow') * 0.2);
      var need = a.power * (1 + lv * 0.35);
      if (pow >= need) {
        ess(a.win.ess[0], a.win.ess[1]);
        tryDrop('drop');
        title = '旗开得胜';
      } else {
        ess(a.lose.ess[0], a.lose.ess[1], 'essL', '聊胜于无');
        if (a.lose.wound) {
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - a.lose.wound));
          texts.push(gen.name + ' 负伤，体力 −' + a.lose.wound);
        }
        bad = true;
        title = '力战不敌';
      }
    } else if (a.kind === 'trial') {
      /* 三层试炼：逐层加码；失败止步（已过层奖励保留）——「见好就收」无损 */
      var layer = 0;
      for (var i = 1; i <= 3; i++) {
        var p2 = (ling + (gen.level || 1) * 2) * (0.9 + roll('t' + i) * 0.2);
        var nd = a.power * (1 + lv * 0.35) * (1 + (i - 1) * 0.45);
        if (p2 < nd) break;
        layer = i;
      }
      if (layer > 0) {
        var tot = 0;
        for (var j = 1; j <= layer; j++) tot += rnd('te' + j, a.win.ess[0] / 3, a.win.ess[1] / 3);
        s.items.lingsui = (s.items.lingsui || 0) + tot;
        texts.push('灵气精华 +' + tot + '（过 ' + layer + ' 层）');
        if (layer >= 3) tryDrop('drop');
        title = (layer >= 3) ? '三层皆过' : ('止步第 ' + (layer + 1) + ' 层');
        bad = false;
      } else {
        ess(a.lose.ess[0], a.lose.ess[1], 'essL', '聊胜于无');
        if (a.lose.wound) {
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - a.lose.wound));
          texts.push(gen.name + ' 负伤，体力 −' + a.lose.wound);
        }
        bad = true;
        title = '第一层便受阻';
      }
    } else if (a.kind === 'gather') {
      ess(a.win.ess[0], a.win.ess[1]);
      if (roll('dbl') < 0.25) ess(a.win.ess[0], a.win.ess[1], 'ess2', '意外双收');
      title = '满载而归';
    } else if (a.kind === 'cultivate') {
      ess(a.win.ess[0], a.win.ess[1]);
      if (roll('wu') < 0.08) {
        ess(a.win.ess[0], a.win.ess[1], 'ess2', '悟道时刻');
        title = '悟道时刻';
      } else {
        title = '静修一日';
      }
    } else if (a.kind === 'visit') {
      var pool = (DATA.LING_VISITS || {})[tile.terrain] || [];
      var ev = pool.length ? pool[Math.floor(roll('ev') * pool.length) % pool.length] : null;
      ess(a.win.ess[0], a.win.ess[1]);
      var body0 = texts.join('、');
      var name0 = ev ? ev.t : '拜访';
      GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + name0 + '（' + body0 + '）');
      return { ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false };
    }
    var body = texts.join('、');
    if (!body) { body = '此行无所获'; bad = true; }
    GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + title + '（' + body + '）');
    return { ok: true, name: a.name + ' · ' + title, text: body, bad: bad };
  };
})();"""

if 'GAME.jianghuDo' in d:
    print('SKIP 江湖出口组已存在')
else:
    assert d.count(ANCHOR) == 1, '尾部锚点 %d 次' % d.count(ANCHOR)
    d = d.replace(ANCHOR, BLOCK, 1)
    dirty = True
    print('OK 切换/灵力/江湖出口组')

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')
