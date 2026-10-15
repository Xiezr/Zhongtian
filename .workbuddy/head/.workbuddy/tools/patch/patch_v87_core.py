# -*- coding: utf-8 -*-
"""v87 · 数据层 + 核心层：野地专属场景（老板「2.为各类野地设计专属弹窗场景」）。

六地形各一场景：山地绿林探访 / 湖泊垂钓 / 沼泽寻宝 / 荒漠地宫探险 / 森林狩猎 / 草原牧马。
产出全部走现有物品/材料体系（不新增道具）；风险=将领负伤（体力损失，零兵损）。
"""
import io
import sys

D = r'E:\Deepseekdb\js\data.js'
S = r'E:\Deepseekdb\js\state.js'


def patch(path, old, new, tag, probe, probe_must_exist=True):
    t = io.open(path, encoding='utf-8', newline='').read()
    changed = (probe in t) if probe_must_exist else (probe not in t)
    if changed:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== W1. DATA.WILD_SCENES 六地形 ==')
patch(
    D,
    """  window.GAME.DATA = DATA;
})();""",
    """  /* ============================================================
   * v87（老板「为各类野地设计专属弹窗场景」）：野地专属场景
   * ------------------------------------------------------------
   * 六地形各一场景（平原除外——平原是主战场与筑城地）：
   *   hill 绿林探访 / lake 垂钓 / zhaoze 沼泽寻宝 / desert 地宫探险 /
   *   forest 林中狩猎 / caoyuan 草原牧马。
   * 规则：每处野地**每日一次**；消耗将领精力 + 体力；风险 = 将领负伤
   *   （体力损失，⛔ 不损兵——避免与出征体系抢平衡）。
   * 产出全部走**现有体系**：资源（粮/金）/ WILD_MATERIAL 地形材料 /
   *   珠宝（jewel 池低档）/ 道具（锦囊 jinang · 木盒 chest · 马鞭 mabian ·
   *   名将套图纸 bp_mingjiang）/ 绿林豪杰（在野将领，种子化生成）。
   * 唯一出口：GAME.wildSceneOf / wildSceneCheck / wildSceneDo（state.js）。
   * 结果种子化（invasionRoll）——同一天同一地结果稳定，测试可复现。
   * ============================================================ */
  DATA.WILD_SCENES = {
    hill: { name: '绿林探访', icon: '⚔️', energy: 12, stam: 4,
      desc: '入山访豪杰：或得好汉相赠，或得豪杰来投，或遇剪径强人负伤而归。',
      outcomes: [
        { w: 30, t: '山寨好汉赠金', gold: [800, 2400] },
        { w: 24, t: '搜得山寨存货', mats: [1, 2] },
        { w: 12, t: '豪杰相投（得在野将领）', hero: 1 },
        { w: 12, t: '得珠宝一颗', jewel: 1 },
        { w: 22, t: '遇剪径强人，负伤而归', wound: 6 },
      ] },
    lake: { name: '垂钓', icon: '🎣', energy: 6, stam: 2,
      desc: '临湖垂钓：鱼获充作军粮，偶得水中沉物。',
      outcomes: [
        { w: 44, t: '鱼获颇丰（充粮）', grain: [800, 2000] },
        { w: 22, t: '小鱼数尾', grain: [200, 600] },
        { w: 12, t: '网得沉物（锦囊）', item: 'jinang' },
        { w: 8, t: '得珠宝一颗', jewel: 1 },
        { w: 14, t: '空竿而归', none: 1 },
      ] },
    zhaoze: { name: '沼泽寻宝', icon: '🔍', energy: 14, stam: 5,
      desc: '探寻旧战场遗迹：宝物丰厚，瘴气伤身。',
      outcomes: [
        { w: 24, t: '掘得珍宝', jewel: { n: [1, 2] } },
        { w: 22, t: '拾获军资', mats: [1, 3] },
        { w: 18, t: '掘出旧钱', gold: [1500, 4000] },
        { w: 12, t: '得古朴木盒', item: 'chest' },
        { w: 24, t: '瘴气侵体，负伤而归', wound: 8 },
      ] },
    desert: { name: '地宫探险', icon: '🏛️', energy: 20, stam: 8,
      desc: '深入地下宫阙：三层遗藏一层比一层厚，险也一层比一层深。',
      outcomes: [
        { w: 30, t: '第一层便有所获', gold: [1500, 3500] },
        { w: 28, t: '第二层遗藏', mats: [2, 4] },
        { w: 16, t: '第三层秘宝（名将套图纸）', item: 'bp_mingjiang' },
        { w: 12, t: '探得珠宝', jewel: { n: [1, 3] } },
        { w: 14, t: '地宫塌方，负伤逃出', wound: 12 },
      ] },
    forest: { name: '林中狩猎', icon: '🏹', energy: 8, stam: 3,
      desc: '入林行猎：兽皮药材俱是军资，亦可得野味充粮。',
      outcomes: [
        { w: 42, t: '猎获皮毛药材', mats: [1, 2] },
        { w: 22, t: '猎得野味（充粮）', grain: [500, 1500] },
        { w: 14, t: '偶得失物（锦囊）', item: 'jinang' },
        { w: 22, t: '空手而归', none: 1 },
      ] },
    caoyuan: { name: '草原牧马', icon: '🐎', energy: 10, stam: 4,
      desc: '逐水草而行：得马市之资或牧马辎具，偶遇良马相随。',
      outcomes: [
        { w: 34, t: '马市得资', gold: [800, 2000] },
        { w: 26, t: '得牧马辎具', mats: [1, 2] },
        { w: 12, t: '良马相随（得马鞭）', item: 'mabian' },
        { w: 28, t: '风尘仆仆', none: 1 },
      ] },
  };

  window.GAME.DATA = DATA;
})();""",
    'W1 WILD_SCENES',
    probe='DATA.WILD_SCENES = {',
)

print()
print('== W2. 核心出口组（state.js 尾部） ==')
patch(
    S,
    """  /* 一次性消耗（空城计奏效时清除状态并返回 true） */
  GAME.schemeDefConsume = function (city, sid, now) {
    var act = GAME.schemeDefOf(city, sid, now);
    if (!act) return false;
    var s = GAME.state;
    var key = 'my:' + city.id;
    if (s.schemes && s.schemes[key] && s.schemes[key][sid]) {
      delete s.schemes[key][sid];
    }
    return true;
  };
})();""",
    """  /* 一次性消耗（空城计奏效时清除状态并返回 true） */
  GAME.schemeDefConsume = function (city, sid, now) {
    var act = GAME.schemeDefOf(city, sid, now);
    if (!act) return false;
    var s = GAME.state;
    var key = 'my:' + city.id;
    if (s.schemes && s.schemes[key] && s.schemes[key][sid]) {
      delete s.schemes[key][sid];
    }
    return true;
  };

  /* ============================================================
   * v87（老板「为各类野地设计专属弹窗场景」）：野地专属场景 —— 唯一出口组
   * ------------------------------------------------------------
   * 规则：每处野地**每日一次**（锁存 `s.wildScenes = { 'x,y': day }`，入档）；
   *   消耗将领精力 + 体力；风险 = 将领负伤（体力损失，⛔ 不损兵）。
   * 结果**种子化**（invasionRoll，同一天同一地稳定）——测试可复现。
   * 产出：资源入**当前城** / 材料走 WILD_MATERIAL 池 / 珠宝低四档 /
   *   道具（jinang·chest·mabian·bp_mingjiang）/ 绿林豪杰走 makeHero。
   * ============================================================ */
  GAME.wildSceneOf = function (terrain) {
    return (DATA.WILD_SCENES || {})[terrain] || null;
  };

  GAME.wildSceneCheck = function (x, y, genId) {
    var s = GAME.state;
    var tile = GAME.map.tile(x, y);
    if (!tile) return { ok: false, msg: '坐标越界' };
    var sc = GAME.wildSceneOf(tile.terrain);
    if (!sc) return { ok: false, msg: '此地平平无奇，没有可做的事' };
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === genId) gen = g; });
    if (!gen) return { ok: false, msg: '请选择带队的将领' };
    if ((gen.energy || 0) < sc.energy) {
      return { ok: false, msg: gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + sc.energy + '），可服清心丸' };
    }
    if (GAME.staNow(gen) < sc.stam) {
      return { ok: false, msg: gen.name + ' 体力不足（' + Math.round(GAME.staNow(gen)) + '/' + sc.stam + '），休整后再来' };
    }
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    if ((s.wildScenes || {})[x + ',' + y] === day) {
      return { ok: false, msg: '此地今日已探过（每处每日一次），明日再来' };
    }
    return { ok: true, sc: sc, gen: gen, day: day };
  };

  GAME.wildSceneDo = function (x, y, genId) {
    var s = GAME.state;
    var chk = GAME.wildSceneCheck(x, y, genId);
    if (!chk.ok) return chk;
    var sc = chk.sc, gen = chk.gen, day = chk.day;
    var seedBase = 'ws|' + x + ',' + y + '|' + day;
    var rnd = function (salt, lo, hi) {
      return lo + Math.floor(GAME.invasionRoll(seedBase + '|' + salt) * (hi - lo + 1));
    };
    /* 扣费 + 锁 */
    gen.energy = Math.max(0, (gen.energy || 0) - sc.energy);
    GAME.setStaNow(gen, GAME.staNow(gen) - sc.stam);
    s.wildScenes = s.wildScenes || {};
    s.wildScenes[x + ',' + y] = day;
    /* 种子化抽结果 */
    var total = sc.outcomes.reduce(function (a, o) { return a + o.w; }, 0);
    var r = GAME.invasionRoll(seedBase + '|roll') * total;
    var acc = 0, out = sc.outcomes[sc.outcomes.length - 1];
    for (var i = 0; i < sc.outcomes.length; i++) {
      acc += sc.outcomes[i].w;
      if (r < acc) { out = sc.outcomes[i]; break; }
    }
    /* 发奖 */
    var texts = [];
    var home = GAME.currentCity();
    s.items = s.items || {};
    var gift = function (id, n) {
      s.items[id] = (s.items[id] || 0) + n;
      var it = (DATA.ITEMS || []).filter(function (x2) { return x2.id === id; })[0];
      texts.push((it ? it.name : id) + '×' + n);
    };
    if (out.gold && home) {
      var gn = rnd('gold', out.gold[0], out.gold[1]);
      GAME.res(home).gold = (GAME.res(home).gold || 0) + gn;
      texts.push('黄金 +' + gn);
    }
    if (out.grain && home) {
      var gr = rnd('grain', out.grain[0], out.grain[1]);
      GAME.res(home).grain = (GAME.res(home).grain || 0) + gr;
      texts.push('粮食 +' + gr);
    }
    if (out.mats) {
      var tbl = DATA.WILD_MATERIAL[GAME.map.tile(x, y).terrain] || {};
      var keys = Object.keys(tbl);
      if (keys.length) {
        var n = rnd('matn', out.mats[0], out.mats[1]);
        for (var mi = 0; mi < n; mi++) {
          var mk = keys[Math.floor(GAME.invasionRoll(seedBase + '|mk' + mi) * keys.length) % keys.length];
          var mn = 1 + Math.floor(GAME.invasionRoll(seedBase + '|mn' + mi) * 2);
          s.items[mk] = (s.items[mk] || 0) + mn;
          var mm = DATA.MATERIAL_BY_ID[mk];
          texts.push((mm ? mm.name : mk) + '×' + mn);
        }
      }
    }
    if (out.jewel) {
      var jewels = (DATA.ITEMS || []).filter(function (x2) { return x2.type === 'jewel'; });
      var jn = (out.jewel === 1) ? 1 : rnd('jn', out.jewel.n[0], out.jewel.n[1]);
      for (var ji = 0; ji < jn; ji++) {
        var jl = jewels[Math.floor(GAME.invasionRoll(seedBase + '|jl' + ji) * Math.min(4, jewels.length)) % Math.min(4, jewels.length)];
        if (jl) gift(jl.id, 1);
      }
    }
    if (out.item) gift(out.item, 1);
    if (out.hero) {
      var sn = DATA.NPC_GUARD_SURNAME || ['王'], gv = DATA.NPC_GUARD_GIVEN || ['虎'];
      var hname = null;
      for (var hi = 0; hi < 6 && !hname; hi++) {
        var cand = sn[Math.floor(GAME.invasionRoll(seedBase + '|hn' + hi) * sn.length) % sn.length] +
          gv[Math.floor(GAME.invasionRoll(seedBase + '|hg' + hi) * gv.length) % gv.length];
        var dup = (s.generals || []).some(function (g) { return g.name === cand; });
        if (!dup) hname = cand;
      }
      if (hname) {
        var base2 = 58 + Math.floor(GAME.invasionRoll(seedBase + '|ht') * 20);
        var hh = { name: hname, tong: base2, nz: base2, yw: base2, zm: base2 };
        var gg = GAME.makeHero(hh, 30);
        gg.loyalty = 60;
        if (home) gg.cityId = home.id;
        s.generals.push(gg);
        texts.push('「' + hname + '」慕名来投，愿效犬马之劳');
      } else {
        gift('zhenzhu', 1);       /* 重名兜底：换成一枚珍珠 */
        texts.push('（豪杰名讳与麾下相重，留下贺礼一份）');
      }
    }
    var bad = false;
    if (out.wound) {
      GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - out.wound));
      texts.push(gen.name + ' 负伤，体力 −' + out.wound);
      bad = true;
    }
    if (!texts.length) { texts.push('此行无所获'); bad = true; }
    var line = sc.icon + ' ' + sc.name + '：' + out.t + '（' + texts.join('、') + '）';
    GAME.log('🏕️ ' + (DATA.TERRAIN[GAME.map.tile(x, y).terrain] || {}).name + ' · ' + line);
    return { ok: true, name: out.t, text: texts.join('、'), bad: bad };
  };
})();""",
    'W2 场景出口组',
    probe='GAME.wildSceneDo = function',
)


print()
print('== W3. 材料产出合并（后补） ==')
patch(
    S,
    r'''    if (out.mats) {
      var tbl = DATA.WILD_MATERIAL[GAME.map.tile(x, y).terrain] || {};
      var keys = Object.keys(tbl);
      if (keys.length) {
        var n = rnd('matn', out.mats[0], out.mats[1]);
        for (var mi = 0; mi < n; mi++) {
          var mk = keys[Math.floor(GAME.invasionRoll(seedBase + '|mk' + mi) * keys.length) % keys.length];
          var mn = 1 + Math.floor(GAME.invasionRoll(seedBase + '|mn' + mi) * 2);
          s.items[mk] = (s.items[mk] || 0) + mn;
          var mm = DATA.MATERIAL_BY_ID[mk];
          texts.push((mm ? mm.name : mk) + '×' + mn);
        }
      }
    }''',
    r'''    if (out.mats) {
      var tbl = DATA.WILD_MATERIAL[GAME.map.tile(x, y).terrain] || {};
      var keys = Object.keys(tbl);
      if (keys.length) {
        var n = rnd('matn', out.mats[0], out.mats[1]);
        var bag = {};                        /* 同 id 合并，避免"兽筋×2、兽筋×2" */
        for (var mi = 0; mi < n; mi++) {
          var mk = keys[Math.floor(GAME.invasionRoll(seedBase + '|mk' + mi) * keys.length) % keys.length];
          var mn = 1 + Math.floor(GAME.invasionRoll(seedBase + '|mn' + mi) * 2);
          bag[mk] = (bag[mk] || 0) + mn;
        }
        for (var bk2 in bag) {
          s.items[bk2] = (s.items[bk2] || 0) + bag[bk2];
          var mm = DATA.MATERIAL_BY_ID[bk2];
          texts.push((mm ? mm.name : bk2) + '×' + bag[bk2]);
        }
      }
    }''',
    'W3 材料合并',
    probe='同 id 合并',
)

print()
print('全部完成。')
