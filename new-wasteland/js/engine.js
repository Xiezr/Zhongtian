/* ============================================================
 * engine.js — 世界怎么动
 * ------------------------------------------------------------
 * 三条不可动摇的规则（本作的地基，不要为了好改而破坏它们）：
 *
 *   规则一 · 地图只能靠走过去知道
 *       没有「侦察点数」，没有「买地图」。想知道一格是什么，
 *       只能派人走进去。走过就记住了，没走过就一直是黑的。
 *
 *   规则二 · 死了就记下来
 *       不扣分、不降级、不给补偿。只在纪念碑上留一个名字、
 *       一个地点、一句最后的话。不给死亡标价。
 *
 *   规则三 · 补给决定能走多远，不是战力
 *       强队可以打死任何东西，但走不回家就会饿死。
 *       地形还会吃补给（沼泽一格算两格），所以路线本身就是决策。
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.DATA;
  var ST = global.STATE;

  function S() { return ST.S(); }
  function rnd() { return ST.rng()(); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }

  /* ============================================================
   * 一、格子
   * ============================================================ */

  function keyOf(tile) { return tile.site || tile.type; }

  function placeName(x, y, tile) {
    if (tile.note) return tile.note;
    var pool = (DATA.PLACES && DATA.PLACES[keyOf(tile)]) || DATA.PLACES.default;
    tile.note = pick(pool) + '（' + x + ',' + y + '）';
    return tile.note;
  }

  /* 编成判定：四个轴各管一段
   *   侦察 → 降低危险（最多减 2 档）
   *   火力 → 决定打得动不动（ratio）
   *   装甲 → 决定每次伤亡打几折
   *   运输 → 不参与战斗，只给补给上限
   */
  function fight(team, tile) {
    var st = ST.teamStats(team, tile);
    var rawDanger = ST.tileDanger(tile);
    var cut = Math.min(2, Math.floor(st.scout / 2));   /* 2 点侦察降 1 档，最多降 2 档 */
    var danger = Math.max(1, rawDanger - cut + (team.duelDanger || 0));
    var fireMul = team.duelFire || 1;
    /* 危险按 ^1.9 放大：低危很轻松，高危必须专门配兵 */
    var ratio = (st.fire * fireMul) / (Math.pow(danger, 1.9) * 3.2) * (0.92 + rnd() * 0.16);
    var killMul = 1 / (1 + st.armor * 0.03);

    var killed = 0, level = 'clean';
    if (ratio < 0.55) { level = 'wipe'; killed = team.men; }
    else if (ratio < 1.0) { level = 'heavy'; killed = Math.min(team.men, Math.ceil(team.men * 0.5 * killMul)); }
    else if (ratio < 1.7) { level = 'light'; killed = Math.min(team.men, Math.ceil(team.men * 0.18 * killMul)); }

    team.duelFire = 1;
    team.duelDanger = 0;
    return {
      level: level, killed: Math.max(0, killed), ratio: ratio,
      fire: st.fire, armor: st.armor, danger: danger, rawDanger: rawDanger, cut: cut
    };
  }

  /* 记下死者：不写「换来了什么」，只写「他是谁、死在哪、最后说了什么」 */
  function killMen(team, n, x, y) {
    n = Math.min(n, team.men);
    if (n <= 0) return [];
    var tile = ST.tileAt(x, y);
    var place = tile ? placeName(x, y, tile) : '无名之地';
    var dead = [];
    for (var i = 0; i < n; i++) {
      var k = team.roster.findIndex(function (m) { return !m.vet; });
      if (k < 0) k = 0;
      var m = team.roster.splice(k, 1)[0];
      if (!m) break;
      var key = tile ? keyOf(tile) : 'default';
      var words = pick((DATA.LAST_WORDS[key]) || DATA.LAST_WORDS.default);
      var entry = {
        name: m.name,
        team: team.name,
        place: place,
        hour: S().hour,
        last: words
      };
      S().memorial.unshift(entry);
      S().stats.lost++;
      dead.push(entry);
      dropOne(team);                       /* 编成同步减员：先死数量最多的那一类 */
    }
    team.men = ST.countMen(team.army);
    team.vets = team.roster.filter(function (m) { return m.vet; }).length;
    return dead;
  }

  /* 从编成里拿掉一个（先拿数量最多的——肉盾先死，这也符合直觉） */
  function dropOne(team) {
    var ids = Object.keys(team.army || {});
    if (!ids.length) return false;
    ids.sort(function (a, b) { return team.army[b] - team.army[a]; });
    var id = ids[0];
    team.army[id]--;
    if (team.army[id] <= 0) delete team.army[id];
    team.men = ST.countMen(team.army);
    return true;
  }

  /* 编成调整（只能在城里）。加一个单位要铁，且不能超编。 */
  function swapUnit(teamId, unitId, delta) {
    var t = S().teams.filter(function (x) { return x.id === teamId; })[0];
    if (!t || t.status === 'dead') return { ok: false, msg: '队伍不在' };
    if (t.x !== DATA.CITY.x || t.y !== DATA.CITY.y) return { ok: false, msg: '要回城才能换装' };
    var u = DATA.UNITS[unitId];
    if (!u) return { ok: false, msg: '没有这个兵种' };

    if (delta > 0) {
      var pop = ST.armyPop(t.army) + u.pop;
      if (pop > ST.capacityNow()) return { ok: false, msg: '编制满了（' + ST.capacityNow() + ' 容量）' };
      if (S().city.iron < DATA.CONFIG.swapIron) return { ok: false, msg: '铁不够（要 ' + DATA.CONFIG.swapIron + '）' };
      S().city.iron -= DATA.CONFIG.swapIron;
      t.army[unitId] = (t.army[unitId] || 0) + 1;
      t.roster.push({ name: ST.randName(), vet: false });
    } else {
      if (!t.army[unitId]) return { ok: false, msg: '编成里没有' };
      t.army[unitId]--;
      if (t.army[unitId] <= 0) delete t.army[unitId];
      t.roster.pop();
    }
    t.men = ST.countMen(t.army);
    t.maxSupply = ST.maxSupplyOf(t.army);
    if (t.supply > t.maxSupply) t.supply = t.maxSupply;
    ST.log('【' + t.name + '小队】编成：' + composeText(t.army), 'info');
    ST.save();
    return { ok: true };
  }

  function composeText(army) {
    return Object.keys(army || {}).map(function (id) {
      var u = DATA.UNITS[id];
      return (u ? u.name : id) + '×' + army[id];
    }).join(' · ') || '空';
  }

  function teamDie(team, x, y) {
    killMen(team, team.men, x, y);
    team.men = 0;
    team.vets = 0;
    team.status = 'dead';
    var tile = ST.tileAt(x, y);
    if (tile) {
      var place = placeName(x, y, tile);
      if (!tile.deadHere) tile.deadHere = team.name + '小队';
      ST.log('【' + team.name + '小队】没有回来。最后一次信号在「' + place + '」。', 'bad');
    }
  }

  function lootOf(tile, team) {
    var src = ST.tileYield(tile);
    var out = {};
    var mul = 1 + (team.vets || 0) * 0.08;
    Object.keys(src).forEach(function (k) { out[k] = Math.round(src[k] * mul); });
    return out;
  }

  function applyLoot(loot) {
    var c = S().city;
    var parts = [];
    Object.keys(loot).forEach(function (k) {
      if (!loot[k]) return;
      if (k === 'pop') { c.pop = Math.min(DATA.CONFIG.popCap, c.pop + loot[k]); parts.push('人口 +' + loot[k]); }
      else if (k === 'tech') { c.tech = (c.tech || 0) + loot[k]; parts.push('图纸 +' + loot[k]); }
      else if (k === 'seed') { c.seed = (c.seed || 0) + loot[k]; parts.push('种子 +' + loot[k]); }
      else if (k === 'water') { c.food += loot[k] * 2; parts.push('水 +' + loot[k]); }
      else if (c[k] != null) { c[k] += loot[k]; parts.push(({ food: '粮', iron: '铁', scrap: '废料' }[k] || k) + ' +' + loot[k]); }
    });
    return parts.join(' · ');
  }

  /* 地形自动结算（地点不会走到这里：地点一定会停下来问你） */
  function autoResolve(team) {
    var x = team.x, y = team.y;
    var tile = ST.tileAt(x, y);
    if (!tile || tile.site === 'home') return;

    var r = fight(team, tile);
    if (r.killed > 0) {
      var dead = killMen(team, r.killed, x, y);
      ST.log('【' + team.name + '小队】在「' + placeName(x, y, tile) + '」少了 ' + r.killed + ' 人。',
        r.level === 'wipe' ? 'bad' : 'warn');
      if (dead.length) ST.log('　' + dead[0].name + ' 最后一句：' + dead[0].last, 'dim');
    }
    if (r.level === 'wipe' || team.men <= 0) { teamDie(team, x, y); return; }

    var txt = applyLoot(lootOf(tile, team));
    if (txt) ST.log('【' + team.name + '小队】' + txt, 'good');

    team.roster.forEach(function (m) {
      if (!m.vet && rnd() < DATA.CONFIG.vetChance) m.vet = true;
    });
    team.vets = team.roster.filter(function (m) { return m.vet; }).length;
  }

  /* ============================================================
   * 二、地点事件（只有地点会停下来）
   * ============================================================ */

  var CHOICES = {
    warehouse: [
      { id: 'assault', label: '撬开', note: '把货搬走 · 可能有住客' },
      { id: 'bypass', label: '绕开', note: '−1 补给' },
      { id: 'back', label: '撤回', note: '回城' }
    ],
    seed: [
      { id: 'enter', label: '进去', note: '冷库 · 风险高' },
      { id: 'back', label: '撤回', note: '回城' }
    ],
    town: [
      { id: 'talk', label: '交涉', note: '名声越好，越谈得成' },
      { id: 'raid', label: '抢', note: '得粮，但名声会传开' },
      { id: 'back', label: '离开', note: '不打扰' }
    ],
    bigcity: [
      { id: 'scout', label: '抵近侦察', note: '看清守备，不打' },
      { id: 'assault', label: '强攻', note: '极危 · 但粮多' },
      { id: 'back', label: '撤回', note: '回城' }
    ],
    capital: [
      { id: 'enter', label: '进城', note: '灯都亮着 · 没有人' },
      { id: 'back', label: '撤回', note: '回城' }
    ],
    fort: [
      { id: 'scout', label: '抵近侦察', note: '看清对方编成，不打' },
      { id: 'assault', label: '强攻', note: '极危' },
      { id: 'back', label: '撤回', note: '回城' }
    ]
  };

  /* ---------- 斗将 ----------
   * 进据点/重镇/旧都之前，守将会叫阵。打不打？
   * 不打也可以（直接进事件），但气势上就矮一头。
   */
  function duelStyleOf(key) {
    return DATA.DUEL.style[key] || DATA.DUEL.style.fort;
  }

  function startDuel(team, key) {
    var st = duelStyleOf(key);
    S().duel = {
      teamId: team.id,
      x: team.x, y: team.y, key: key,
      round: 0,
      pHp: DATA.DUEL.hp,
      eHp: DATA.DUEL.hp,
      ph: [], eh: [],
      styleName: st.name,
      over: false, result: null
    };
  }

  /* 守将出招：按习惯偏向，偶尔针对玩家最近常用的招 */
  function aiMove(d) {
    var st = duelStyleOf(d.key);
    var ids = ['thrust', 'guard', 'charge', 'feint'];
    var r = rnd();
    if (d.ph.length >= 2 && r < 0.2) {
      var cnt = {};
      d.ph.slice(-3).forEach(function (m) { cnt[m] = (cnt[m] || 0) + 1; });
      var used = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
      /* 找打这一招最疼的 */
      var D = DATA.DUEL.damage, best = 'thrust', bv = -1;
      ids.forEach(function (k) { if (D[k][used] > bv) { bv = D[k][used]; best = k; } });
      return best;
    }
    var v = rnd(), acc = 0;
    for (var i = 0; i < ids.length; i++) {
      acc += st[ids[i]] || 0;
      if (v <= acc) return ids[i];
    }
    return 'thrust';
  }

  function duelMove(move) {
    var d = S().duel;
    if (!d || d.over) return null;
    var em = aiMove(d);
    var myDmg = DATA.DUEL.damage[move][em];
    var eDmg = DATA.DUEL.damage[em][move];
    d.pHp = Math.max(0, d.pHp - eDmg);
    d.eHp = Math.max(0, d.eHp - myDmg);
    d.ph.push(move); d.eh.push(em);
    d.round++;

    if (d.pHp <= 0 || d.eHp <= 0 || d.round >= DATA.DUEL.rounds) {
      d.over = true;
      if (d.eHp <= 0 && d.pHp <= 0) d.result = d.pHp >= d.eHp ? 'win' : 'lose';
      else if (d.eHp <= 0) d.result = 'win';
      else if (d.pHp <= 0) d.result = 'lose';
      else d.result = d.eHp < d.pHp ? 'win' : 'lose';
    }
    return { my: move, em: em, myDmg: myDmg, eDmg: eDmg };
  }

  function refuseDuel() {
    var d = S().duel;
    if (!d) return;
    var team = S().teams.filter(function (t) { return t.id === d.teamId; })[0];
    S().duel = null;
    if (team) {
      team.duelDanger = DATA.DUEL.refuseDanger;
      ST.log('你没有应战。对面在墙上笑。', 'warn');
      openEvent(team);
    }
  }

  function finishDuel() {
    var d = S().duel;
    if (!d) return null;
    var team = S().teams.filter(function (t) { return t.id === d.teamId; })[0];
    var result = d.result;
    S().duel = null;
    if (!team) return null;
    if (result === 'win') {
      team.duelFire = DATA.DUEL.winFire;
      team.duelDanger = DATA.DUEL.winDanger;
      ST.log('斗将赢了。' + team.name + '小队的手不抖了。', 'good');
    } else {
      team.duelDanger = DATA.DUEL.loseDanger;
      ST.log('斗将输了。' + team.name + '小队的队长被人抬了下去。', 'bad');
    }
    openEvent(team);
    return result;
  }

  function openEvent(team) {
    var tile = ST.tileAt(team.x, team.y);
    var key = keyOf(tile);

    /* 据点/重镇/旧都：守将叫阵（每块地只叫一次） */
    if (['fort', 'bigcity', 'capital'].indexOf(key) >= 0 && !tile.duelDone) {
      tile.duelDone = true;
      startDuel(team, key);
      return;
    }
    var def = DATA.TILES[key];
    var ev = DATA.EVENTS[key] || { title: (def && def.name) || '前方', body: (def && def.desc) || '', hint: '' };
    S().event = {
      teamId: team.id,
      x: team.x,
      y: team.y,
      key: key,
      title: ev.title,
      body: ev.body,
      hint: ev.hint,
      choices: CHOICES[key] || CHOICES.warehouse,
      createdAt: S().hour
    };
    ST.log('【' + team.name + '小队】停在「' + placeName(team.x, team.y, tile) + '」，等你决定。', 'halt');
  }

  function resolveEvent(choiceId) {
    var ev = S().event;
    if (!ev) return;
    var team = S().teams.filter(function (t) { return t.id === ev.teamId; })[0];
    S().event = null;
    if (!team || team.status === 'dead') return;

    var x = ev.x, y = ev.y;
    var tile = ST.tileAt(x, y);

    if (choiceId === 'back') { retreatHome(team); return; }

    switch (choiceId) {
      case 'assault':
      case 'enter': {
        var r = fight(team, tile);
        if (r.killed > 0) {
          var dead = killMen(team, r.killed, x, y);
          ST.log('【' + team.name + '小队】少了 ' + r.killed + ' 人。', r.level === 'wipe' ? 'bad' : 'warn');
          if (dead.length) ST.log('　' + dead[0].name + ' 最后一句：' + dead[0].last, 'dim');
        }
        if (r.level === 'wipe' || team.men <= 0) { teamDie(team, x, y); return; }
        var txt = applyLoot(lootOf(tile, team));
        if (txt) ST.log('【' + team.name + '小队】' + txt, 'good');
        tile.raided = true;
        break;
      }

      case 'talk': {
        var rep = S().rep || 0;
        if (rep >= -1) {
          var f = 25 + Math.floor(rnd() * 15);
          var p = 4 + Math.floor(rnd() * 5);
          S().city.food += f;
          S().city.pop = Math.min(DATA.CONFIG.popCap, S().city.pop + p);
          S().rep = rep + 1;
          ST.log('【' + team.name + '小队】谈成了：粮 +' + f + '，跟他们回来 ' + p + ' 个人。', 'good');
        } else {
          ST.log('门没开。他们在墙上看着，一直看到队伍走远。', 'warn');
        }
        break;
      }

      case 'raid': {
        var gain = 40 + Math.floor(rnd() * 30);
        S().city.food += gain;
        S().rep = (S().rep || 0) - 1;
        ST.log('【' + team.name + '小队】抢了聚落：粮 +' + gain + '。名声 −1（现在 ' + S().rep + '）。', 'warn');
        break;
      }

      case 'scout': {
        var facDef = DATA.FACTIONS.filter(function (f) { return f.id === tile.owner; })[0];
        var who = facDef ? facDef.name : (DATA.TILES[keyOf(tile)] || {}).name || '守军';
        ST.log('【' + team.name + '小队】看清了「' + who + '」的守备：约 ' +
          Math.round(ST.tileDanger(tile) * 2) + ' 组哨位，重火力朝北。', 'good');
        tile.scouted = true;
        break;
      }

      case 'bypass': {
        if (team.supply <= 0) { ST.log('补给见底，绕不动了。', 'warn'); retreatHome(team); return; }
        team.supply -= 1;
        ST.log('【' + team.name + '小队】绕开了「' + placeName(x, y, tile) + '」，补给 −1。', 'info');
        break;
      }
    }

    ST.save();
  }

  /* ============================================================
   * 三、派遣与移动
   * ============================================================ */

  function dispatch(teamId, tx, ty) {
    var team = S().teams.filter(function (t) { return t.id === teamId; })[0];
    if (!team || team.status === 'dead') return { ok: false, msg: '队伍不在' };
    if (S().event) return { ok: false, msg: '先处理当前事件' };

    var path = ST.linePath(team.x, team.y, tx, ty);
    if (!path) return { ok: false, msg: '只能沿八个方向直线派遣' };
    if (team.supply <= 0) return { ok: false, msg: '补给为 0，先回城补给' };
    if (team.status === 'home') team.status = 'out';

    for (var i = 0; i < path.length; i++) {
      if (team.status === 'dead') break;
      var p = path[i];
      var tile = ST.tileAt(p.x, p.y);
      if (!tile) break;

      /* 补给：沼泽一格算两格 */
      var cost = ST.tileSupply(tile);
      if (team.supply < cost) {
        ST.log('【' + team.name + '小队】补给不够走进「' + (DATA.TILES[ST.defOf(tile).id].name) + '」，停在半路。', 'warn');
        break;
      }

      team.x = p.x; team.y = p.y;
      team.supply -= cost;
      ST.reveal(p.x, p.y);

      if (tile.site === 'home') {
        team.status = 'home';
        ST.log('【' + team.name + '小队】回到灰岗。补给 ' + team.supply + '。', 'good');
        break;
      }

      if (ST.tileHalt(tile)) { openEvent(team); break; }

      autoResolve(team);
      if (team.men <= 0 || team.status === 'dead') break;
    }

    ST.save();
    return { ok: true };
  }

  function retreatHome(team) {
    var guard = 0;
    while ((team.x !== DATA.CITY.x || team.y !== DATA.CITY.y) && guard++ < 40) {
      team.x += Math.sign(DATA.CITY.x - team.x);
      team.y += Math.sign(DATA.CITY.y - team.y);
      if (team.supply > 0) team.supply -= 1;
      else {
        var dead = killMen(team, 1, team.x, team.y);
        ST.log('【' + team.name + '小队】补给断了，' + (dead[0] ? dead[0].name : '有人') + ' 没走出来。', 'bad');
        if (team.men <= 0) { teamDie(team, team.x, team.y); return; }
      }
    }
    team.status = 'home';
    ST.log('【' + team.name + '小队】退回灰岗，还剩 ' + team.men + ' 人。', 'info');
    ST.save();
  }

  /* ============================================================
   * 四、纪事（剧情阶梯）
   * ------------------------------------------------------------
   * 每年冬天结算之后出一页。内容不是旁白，是这一年真实发生过的事：
   * 死了几个、最先没回来的是谁、死在哪个名字的地上。
   * ============================================================ */

  function fillTokens(line, ctx) {
    return line.replace(/\{(\w+)\}/g, function (m, k) {
      return ctx[k] != null ? ctx[k] : m;
    });
  }

  function storyCtx() {
    var s = S();
    var mem = s.memorial;
    var first = mem.length ? mem[mem.length - 1] : null;     /* 最早的一条 */
    var places = mem.slice(0, 3).map(function (m) { return m.place.split('（')[0]; });
    /* 死亡人数以纪念碑为准（SSOT）——stats.lost 可能与它不同步 */
    var dead = mem.length;

    /* 句子按数据长出来，不用死模板：
       没有人没回来，就不写"最先没回来的是谁"。 */
    var deadLine = dead > 0
      ? '这一年，' + dead + ' 个人没有回来。'
      : '这一年，没有人没回来。';
    var firstLine = first
      ? '最先没回来的是 ' + first.name + '，最后一次信号在' + first.place.split('（')[0] + '。'
      : '';

    return {
      teams: s.stats.teams,
      dead: dead,
      deadLine: deadLine,
      firstLine: firstLine,
      firstDead: first ? first.name : '',
      firstPlace: first ? first.place.split('（')[0] : '',
      pop: Math.floor(s.city.pop),
      lit: s.stats.lit,
      places: places.length ? places.join('、') : '还没走远'
    };
  }

  function maybeStory() {
    var s = S();
    if (s.story || s.ending) return;
    var def = DATA.STORY.filter(function (x) { return x.y === s.winters; })[0];
    if (!def) return;
    var ctx = storyCtx();
    s.story = {
      y: s.winters,
      title: def.title,
      lines: def.lines
        .map(function (l) { return fillTokens(l, ctx); })
        .filter(function (l) { return l && l.trim(); }),   /* 空句去掉 */
      choices: def.choices || null
    };
  }

  function resolveStory(choiceId) {
    var s = S();
    if (!s.story) return { ok: false };
    if (choiceId === 'partial' && (s.city.tech || 0) < 1) {
      ST.log('那沓纸你看不懂。温控的线在哪，你不知道。', 'warn');
      return { ok: false, msg: '要先在旧图书馆/旧都拿到图纸' };
    }
    s.story = null;
    var end = DATA.ENDING[choiceId];
    if (!end) return { ok: false };
    s.ending = choiceId;
    s.mod = { food: end.mod.food || 0, iron: end.mod.iron || 0 };
    ST.log('【结局 · ' + end.title + '】', 'good');
    end.lines.forEach(function (l) { ST.log(l, 'sys'); });
    ST.save();
    return { ok: true };
  }

  /* ============================================================
   * 势力来使（三家各来一次）
   * ============================================================ */
  function maybeEnvoy() {
    var s = S();
    if (s.envoy) return;
    s.envoyDone = s.envoyDone || [];
    var y = (s.winters || 0) + 1;
    var def = DATA.ENVOYS.filter(function (e) {
      return s.envoyDone.indexOf(e.id) < 0 && y >= e.year;
    })[0];
    if (!def) return;
    s.envoy = {
      id: def.id, faction: def.faction,
      title: def.title, body: def.body, choices: def.choices
    };
    ST.save();
  }

  function resolveEnvoy(choiceId) {
    var s = S();
    var ev = s.envoy;
    if (!ev) return { ok: false };
    var c = s.city;
    var ok = true;

    if (ev.id === "rust_draw") {
      var rust = s.factions.filter(function (f) { return f.id === "rust"; })[0];
      if (choiceId === "give") {
        c.iron += 60;
        if (rust) rust.pausedUntil = (s.winters || 0) + 5;
        ST.log("图纸给了。铁锈会的人当场画了一张新的，说五年内不动灰岗。", "warn");
        ST.log("铁 +60。", "good");
      } else {
        if (rust) rust.boostUntil = (s.winters || 0) + 5;
        ST.log("你没给。那三个人走了，走的时候没回头。", "warn");
        ST.log("北边的旗子开始往这边挪。", "bad");
      }
    } else if (ev.id === "ash_burn") {
      if (choiceId === "burn") {
        c.pop = Math.min(DATA.CONFIG.popCap, c.pop + 8);
        c.food += 60;
        c.tech = 0;
        ST.log("你砸了控制柜。泵还能用手摇，但精度没了。", "warn");
        ST.log("人口 +8，粮 +60。图纸全烧了。", "good");
      } else {
        ST.log("你没砸。老太太点点头，说你会后悔的，然后走了。", "warn");
      }
    } else if (ev.id === "caravan_toll") {
      if (choiceId === "pay") {
        if (c.food < 60) {
          ST.log("粮不够。车队等了一夜，走了。", "warn");
          ok = false;
        } else {
          c.food -= 60;
          var lit = 0;
          for (var i = 0; i < 300 && lit < 3; i++) {
            var rx = Math.floor(rnd() * DATA.MAP_W);
            var ry = Math.floor(rnd() * DATA.MAP_H);
            var t = ST.tileAt(rx, ry);
            if (!t || t.lit) continue;
            ST.reveal(rx, ry);
            lit++;
          }
          ST.log("粮 −60。车队在地上画了三笔，说这三个地方值得去。", "good");
        }
      } else {
        ST.log("你没交。车队绕道走了，以后再没来过。", "warn");
      }
    }

    if (ok) {
      s.envoyDone.push(ev.id);
      s.envoy = null;
    }
    ST.save();
    return { ok: ok };
  }

  /* ============================================================
   * 五、时间推进
   * ============================================================ */

  function factionTick() {
    S().factions.forEach(function (f) {
      /* 给过图纸：五年不扩张；拒绝过：五年扩张更快 */
      if (f.pausedUntil != null && S().winters < f.pausedUntil) return;
      var ep = DATA.CONFIG.factionExpandP +
        ((f.boostUntil != null && S().winters < f.boostUntil) ? 0.2 : 0);
      if (rnd() > ep) return;
      var own = [];
      S().tiles.forEach(function (t, i) {
        if (t.owner === f.id) own.push({ x: i % DATA.MAP_W, y: Math.floor(i / DATA.MAP_W) });
      });
      if (!own.length) return;
      var base = pick(own);
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      var d = pick(dirs);
      var nx = base.x + d[0], ny = base.y + d[1];
      if (!ST.inMap(nx, ny)) return;
      var nt = ST.tileAt(nx, ny);
      if (!nt || nt.site === 'home' || nt.owner) return;
      var occupied = S().teams.some(function (t) { return t.status !== 'dead' && t.x === nx && t.y === ny; });
      if (occupied) return;

      nt.owner = f.id;
      nt.site = 'fort';
      nt.note = f.name + ' 前沿';
      nt.lit = true;
      ST.revealAround(nx, ny, 1);
      f.cells++;
      if (ST.dist(nx, ny, DATA.CITY.x, DATA.CITY.y) <= 1) f.atGate = true;
    });
  }

  function advance(n) {
    for (var i = 0; i < n; i++) {
      S().hour++;

      var c = S().city;
      var md = S().mod || { food: 0, iron: 0 };
      c.food = Math.max(0, c.food + DATA.CONFIG.baseFood + (md.food || 0));
      c.iron += DATA.CONFIG.baseIron + (md.iron || 0);
      c.scrap += DATA.CONFIG.baseScrap;
      c.pop = Math.min(DATA.CONFIG.popCap, c.pop + DATA.CONFIG.basePop);

      factionTick();

      if (S().hour >= S().nextWinter) {
        var need = DATA.CONFIG.winterSeedNeed;
        var have = c.seed || 0;
        S().winters++;
        if (have >= need) {
          c.seed = have - need;
          c.pop = Math.min(DATA.CONFIG.popCap, c.pop + DATA.CONFIG.winterPopBonus);
          ST.log('第 ' + S().winters + ' 个冬天过去了。城里多了 ' + DATA.CONFIG.winterPopBonus + ' 个人。', 'good');
        } else {
          var lossRate = DATA.CONFIG.winterPopLoss;
          if (S().ending === 'partial') lossRate *= 0.5;
          var lost = Math.floor(c.pop * lossRate);
          c.pop = Math.max(10, c.pop - lost);
          ST.log('第 ' + S().winters + ' 个冬天。种子不够。城里少了 ' + lost + ' 个人。', 'bad');
          ST.log('他们不是饿死的，是没等到下一季。', 'dim');
        }
        /* 接进去之后：系统养着，人不用做事，于是越来越少 */
        if (S().ending === 'plug') {
          var fade = Math.floor(c.pop * 0.03);
          c.pop = Math.max(10, c.pop - fade);
          ST.log('这一年又有 ' + fade + ' 个人不再出门了。', 'dim');
        }
        S().nextWinter += DATA.CONFIG.winterEvery;
        maybeStory();
        maybeEnvoy();
      }

      var gate = S().factions.filter(function (f) { return f.atGate; });
      if (gate.length && c.food > 0) {
        var t = Math.min(c.food, DATA.CONFIG.factionTribute * gate.length);
        c.food -= t;
        if (S().hour % 4 === 0) ST.log('「' + gate[0].name + '」在城下征粮，每小时 ' + t + '。', 'warn');
      }

      S().teams.forEach(function (tm) {
        if (tm.status !== 'out' || tm.supply > 0) return;
        var dead = killMen(tm, 1, tm.x, tm.y);
        if (dead.length) ST.log('【' + tm.name + '小队】' + dead[0].name + ' 饿死了。', 'bad');
        if (tm.men <= 0) teamDie(tm, tm.x, tm.y);
      });

      if (S().event && S().hour - S().event.createdAt >= DATA.CONFIG.eventWindow) {
        var ev = S().event;
        var team = S().teams.filter(function (t) { return t.id === ev.teamId; })[0];
        ST.log('你在犹豫的时候，' + (team ? team.name + '小队' : '他们') + ' 等不下去，自己撤了。', 'warn');
        S().event = null;
        if (team && team.status !== 'dead') retreatHome(team);
      }
    }
    maybeEnvoy();
    ST.save();
    return S();
  }

  /* ============================================================
   * 五、操作
   * ============================================================ */

  function recruitTeam() {
    var c = S().city;
    if (c.food < DATA.CONFIG.recruitFood) return { ok: false, msg: '粮不够' };
    if (c.iron < DATA.CONFIG.recruitIron) return { ok: false, msg: '铁不够' };
    if (S().teams.filter(function (t) { return t.status !== 'dead'; }).length >= 6) return { ok: false, msg: '同时最多 6 支队' };
    c.food -= DATA.CONFIG.recruitFood;
    c.iron -= DATA.CONFIG.recruitIron;
    var t = ST.makeTeam();
    ST.log('新队成立：' + t.name + '小队（' + t.men + ' 人）。', 'good');
    ST.save();
    return { ok: true, team: t };
  }

  function resupply(teamId) {
    var t = S().teams.filter(function (x) { return x.id === teamId; })[0];
    if (!t || t.status === 'dead') return { ok: false, msg: '队伍不在' };
    if (t.x !== DATA.CITY.x || t.y !== DATA.CITY.y) return { ok: false, msg: '要回城才能补给' };
    if (S().city.food < DATA.CONFIG.resupplyFood) return { ok: false, msg: '粮不够' };
    S().city.food -= DATA.CONFIG.resupplyFood;
    t.supply += DATA.CONFIG.resupplyAmount;
    ST.log('【' + t.name + '小队】补给 +' + DATA.CONFIG.resupplyAmount + '。', 'good');
    ST.save();
    return { ok: true };
  }

  global.ENGINE = {
    advance: advance,
    dispatch: dispatch,
    retreatHome: retreatHome,
    resolveEvent: resolveEvent,
    resolveStory: resolveStory,
    swapUnit: swapUnit,
    composeText: composeText,
    _fight: fight,   /* 给平衡探针用 */
    duelMove: duelMove,
    finishDuel: finishDuel,
    refuseDuel: refuseDuel,
    resolveEnvoy: resolveEnvoy,
    maybeEnvoy: maybeEnvoy,
    startDuel: startDuel,
    recruitTeam: recruitTeam,
    resupply: resupply,
    placeName: placeName
  };
})(window);
