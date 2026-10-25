/* ============================================================
 * ui.js — 把状态画出来
 * ------------------------------------------------------------
 * 只读状态，不改状态。所有动作都通过 ENGINE 走。
 *
 * 一格 = 三层：地形照片（底）→ 地点立绘（中）→ 队伍图标（上）
 * 全部用原有素材，不另画。
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.DATA;
  var ST = global.STATE;
  var EN = global.ENGINE;

  var selTeam = null;
  var el = {};

  function $(id) { return document.getElementById(id); }
  function S() { return ST.S(); }

  function h(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function toast(msg) {
    var t = h('div', 'toast', msg);
    document.body.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 320);
    }, 1600);
  }

  /* 同一时间只让一个弹窗出现，避免叠在一起 */
  function closeModals(except) {
    ['eventModal', 'storyModal', 'compModal', 'duelModal', 'envoyModal'].forEach(function (id) {
      if (id === except) return;
      var m = document.getElementById(id);
      if (m) m.hidden = true;
    });
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ============================================================
   * 顶栏
   * ============================================================ */
  function renderTop() {
    var s = S();
    var year = Math.floor(s.hour / DATA.CONFIG.winterEvery) + 1;
    var inYear = s.hour % DATA.CONFIG.winterEvery;
    var day = Math.floor(inYear / 24) + 1;
    $('dayLabel').textContent = year;
    $('clockLabel').textContent = '第 ' + year + ' 年 · 第 ' + day + ' 天 ' + pad(inYear % 24) + ':00';

    var res = $('resBar');
    res.innerHTML = '';
    [{ ico: '粮', k: 'food' }, { ico: '铁', k: 'iron' }, { ico: '料', k: 'scrap' }, { ico: '人', k: 'pop' }]
      .forEach(function (it) {
        var d = h('div', 'res-item');
        d.appendChild(h('span', 'ico', it.ico));
        d.appendChild(h('b', null, Math.floor(s.city[it.k] || 0)));
        res.appendChild(d);
      });
    if (s.city.seed) {
      var d2 = h('div', 'res-item seed');
      d2.appendChild(h('span', 'ico', '种'));
      d2.appendChild(h('b', null, s.city.seed));
      res.appendChild(d2);
    }
    if (s.city.tech) {
      var d3 = h('div', 'res-item');
      d3.appendChild(h('span', 'ico', '图'));
      d3.appendChild(h('b', null, s.city.tech));
      res.appendChild(d3);
    }
  }

  /* ============================================================
   * 城市
   * ============================================================ */
  function renderCity() {
    var s = S();
    var box = $('cityPanel');
    box.innerHTML = '';

    box.appendChild(h('div', 'city-name', s.city.name));
    var alive = s.teams.filter(function (t) { return t.status !== 'dead'; }).length;
    box.appendChild(h('div', 'city-sub', '灯还亮着 · 队伍 ' + alive + ' 支'));

    [{ k: '粮', v: s.city.food, max: 400, cls: 'food' },
     { k: '人口', v: s.city.pop, max: DATA.CONFIG.popCap, cls: 'pop' }].forEach(function (r) {
      var row = h('div', 'bar-row');
      row.appendChild(h('span', 'k', r.k));
      var bar = h('div', 'bar ' + r.cls);
      var i = h('i');
      i.style.width = Math.min(100, (r.v / r.max) * 100) + '%';
      bar.appendChild(i);
      row.appendChild(bar);
      row.appendChild(h('span', 'v', Math.floor(r.v)));
      box.appendChild(row);
    });

    /* 过冬：城里唯一的死线 */
    var left = Math.max(0, (s.nextWinter != null ? s.nextWinter : DATA.CONFIG.winterEvery) - s.hour);
    var need = DATA.CONFIG.winterSeedNeed;
    var have = s.city.seed || 0;
    var wr = h('div', 'winter');
    if (have >= need) wr.classList.add('ok');
    else if (left <= 24) wr.classList.add('urgent');
    wr.innerHTML = '<span class="wk">过冬</span>' +
      '<span class="wv">种子 ' + have + ' / ' + need + '</span>' +
      '<span class="wt">' + (left > 0 ? left + ' 时' : '就是现在') + '</span>';
    box.appendChild(wr);

    if (s.factions.some(function (f) { return f.atGate; })) {
      var w = h('div', 'city-sub');
      w.style.color = 'var(--red)';
      w.textContent = '势力已抵城下';
      box.appendChild(w);
    }
  }

  /* ============================================================
   * 队伍
   * ============================================================ */
  function renderTeams() {
    var s = S();
    var box = $('teamList');
    box.innerHTML = '';

    var list = s.teams.filter(function (t) { return t.status !== 'dead'; });
    if (!list.length) box.appendChild(h('div', 'mem-empty', '没有队伍了。'));

    list.forEach(function (t) {
      var card = h('div', 'team' + (selTeam === t.id ? ' sel' : ''));
      card.dataset.team = t.id;

      var head = h('div', 'team-head');
      head.appendChild(h('span', 'team-name', t.name + '小队'));
      var tile = ST.tileAt(t.x, t.y);
      var locName = t.status === 'home' ? '城内' : (tile && tile.note ? tile.note.split('（')[0] : '野外');
      head.appendChild(h('span', 'team-loc', locName));
      card.appendChild(head);

      /* 编成一行 */
      var st = ST.teamStats(t, tile);
      var comp = h('div', 'team-comp');
      comp.textContent = EN.composeText(t.army);
      card.appendChild(comp);

      var stats = h('div', 'team-stats');
      var m1 = h('span'); m1.innerHTML = '人 <b>' + t.men + '</b>';
      var m2 = h('span'); m2.innerHTML = '老兵 <b>' + t.vets + '</b>';
      var m3 = h('span', t.supply <= 1 ? 'low' : ''); m3.innerHTML = '补给 <b>' + t.supply + '</b>';
      stats.appendChild(m1); stats.appendChild(m2); stats.appendChild(m3);
      card.appendChild(stats);

      /* 四个轴：火力 / 装甲 / 侦察 / 运输 */
      var axes = h('div', 'team-axes');
      [['火', st.fire], ['甲', st.armor], ['侦', st.scout], ['运', st.haul]].forEach(function (a) {
        var sp = h('span', a[1] > 0 ? 'ax on' : 'ax');
        sp.innerHTML = a[0] + ' <b>' + (Math.round(a[1] * 10) / 10) + '</b>';
        axes.appendChild(sp);
      });
      card.appendChild(axes);

      var dots = h('div', 'supply-dots');
      for (var i = 0; i < Math.max(6, t.supply); i++) {
        dots.appendChild(h('div', 'dot' + (i < t.supply ? ' on' : '')));
      }
      card.appendChild(dots);

      var acts = h('div', 'team-acts');
      if (t.status === 'home') {
        var b1 = h('button', 'btn', '补给 +' + DATA.CONFIG.resupplyAmount);
        b1.onclick = function (e) {
          e.stopPropagation();
          var r = EN.resupply(t.id);
          if (!r.ok) toast(r.msg);
          renderAll();
        };
        acts.appendChild(b1);
        var b3 = h('button', 'btn', '编成');
        b3.onclick = function (e) {
          e.stopPropagation();
          openComp(t.id);
        };
        acts.appendChild(b3);
      } else {
        var b2 = h('button', 'btn', '撤回');
        b2.onclick = function (e) {
          e.stopPropagation();
          EN.retreatHome(t);
          selTeam = null;
          renderAll();
        };
        acts.appendChild(b2);
      }
      card.appendChild(acts);

      card.onclick = function () {
        selTeam = (selTeam === t.id) ? null : t.id;
        renderAll();
      };

      box.appendChild(card);
    });
  }

  /* ============================================================
   * 地图
   * ============================================================ */
  function renderMap() {
    var s = S();
    var map = $('map');
    map.innerHTML = '';

    var team = selTeam ? s.teams.filter(function (t) { return t.id === selTeam; })[0] : null;
    var targets = {};     /* 只在「能来回」的圈里上色 */
    var reach = {};       /* 能不能派（八方向对齐就够，不看补给） */
    if (team && !s.event && team.status !== 'dead') {
      for (var yy = 0; yy < DATA.MAP_H; yy++) {
        for (var xx = 0; xx < DATA.MAP_W; xx++) {
          var p = ST.linePath(team.x, team.y, xx, yy);
          if (!p) continue;
          var cost = 0;
          p.forEach(function (q) {
            var t = ST.tileAt(q.x, q.y);
            cost += t ? ST.tileSupply(t) : 1;
          });
          var back = 0;
          for (var k = p.length - 1; k >= 0; k--) {
            var t2 = ST.tileAt(p[k].x, p[k].y);
            back += t2 ? ST.tileSupply(t2) : 1;
          }
          reach[yy * DATA.MAP_W + xx] = cost + back;
          if (cost + back <= team.supply) targets[yy * DATA.MAP_W + xx] = true;
        }
      }
    }

    var occupied = {};
    s.teams.forEach(function (t) {
      if (t.status !== 'dead') occupied[t.y * DATA.MAP_W + t.x] = t;
    });

    s.tiles.forEach(function (tile, i) {
      var x = i % DATA.MAP_W, y = Math.floor(i / DATA.MAP_W);
      var c = h('div', 'cell');
      var def = DATA.TILES[tile.type];

      /* 底层：地形照片 */
      if (tile.lit) {
        c.classList.add('lit');
        var bg = h('div', 'bg');
        bg.style.backgroundImage = 'url(' + def.img + ')';
        c.appendChild(bg);
        if (tile.type === 'swamp') c.classList.add('slow');
      } else if (tile.hint) {
        c.classList.add('hint');
      } else {
        c.classList.add('hidden');
      }

      if (tile.site === 'home') c.classList.add('home');
      if (tile.owner) {
        c.classList.add('owned');
        var fac = DATA.FACTIONS.filter(function (f) { return f.id === tile.owner; })[0];
        if (fac) c.style.setProperty('--fac', fac.color);
      }
      if (tile.deadHere) c.classList.add('grave');
      if (targets[i]) c.classList.add('target', 'target-safe');
      if (occupied[i]) c.classList.add('team-here');
      if (occupied[i] && occupied[i].id === selTeam) c.classList.add('sel');

      /* 中层：地点立绘 */
      if (tile.lit && tile.site) {
        var sd = DATA.TILES[tile.site];
        var im = document.createElement('img');
        im.className = 'site' + (sd.tint ? ' tint-' + sd.tint : '');
        im.src = sd.img;
        im.alt = '';
        c.appendChild(im);
      }

      /* 上层：队伍 */
      if (occupied[i]) {
        var u = document.createElement('img');
        u.className = 'unit';
        u.src = ST.leadUnitOf(occupied[i].army);
        u.alt = '';
        c.appendChild(u);
      }

      /* 可走但还没点亮的格子：给个问号，否则是个空框 */
      if (!tile.lit && targets[i]) {
        var q = h('span', 'ink q');
        q.textContent = '?';
        c.appendChild(q);
      }

      /* 半信息：只有痕迹 */
      if (!tile.lit && tile.hint) {
        var ink = h('span', 'ink', shortHint(tile.hint));
        c.appendChild(ink);
      }

      c.title = titleOf(tile, x, y);

      c.onclick = function () {
        if (!team) { toast('先点左边选一支队伍'); return; }
        if (s.event) { toast('先处理当前事件'); return; }
        if (reach[i] == null) { toast('只能沿八个方向直线派遣'); return; }
        if (!targets[i]) {
          toast('这一趟回不来：往返要 ' + reach[i] + ' 补给，队里只有 ' + team.supply);
        }
        var r = EN.dispatch(team.id, x, y);
        if (!r.ok) toast(r.msg);
        renderAll();
        if (!maybeShowDuel()) maybeShowEvent();
      };

      map.appendChild(c);
    });
  }

  function shortHint(hit) {
    var m = {
      '铁皮反光': '铁', '白雾': '雾', '烟': '烟', '高墙': '墙', '灯光': '光',
      '旗': '旗', '灯': '灯', '风声': '声', '草动': '草', '树影': '影',
      '石头': '石', '水光': '水', '热浪': '热', '水汽': '汽'
    };
    return m[hit] || hit.charAt(0);
  }

  function titleOf(tile, x, y) {
    if (!tile.lit) {
      return (tile.hint ? '有什么东西（' + tile.hint + '）' : '未知') + '｜' + x + ',' + y;
    }
    var def = DATA.TILES[tile.type];
    var sd = tile.site ? DATA.TILES[tile.site] : null;
    var lines = [];
    lines.push((tile.note || (sd && sd.name) || (def && def.name) || '?') + '｜' + x + ',' + y);
    if (def) lines.push('地形 ' + def.name + (def.supply > 1 ? '（走一格耗 ' + def.supply + ' 补给）' : ''));
    if (sd) lines.push('地点 ' + sd.name);
    lines.push('危险 ' + ST.tileDanger(tile));
    var ys = ST.tileYield(tile);
    var parts = Object.keys(ys).map(function (k) {
      return ({ food: '粮', iron: '铁', scrap: '料', pop: '人', tech: '图', seed: '种', water: '水' }[k] || k) + '+' + ys[k];
    });
    if (parts.length) lines.push('产出 ' + parts.join(' '));
    if (tile.deadHere) lines.push(tile.deadHere + ' 在这里没了');
    return lines.join('\n');
  }

  /* ============================================================
   * 日志 / 纪念碑
   * ============================================================ */
  function renderLog() {
    var box = $('logList');
    box.innerHTML = '';
    S().log.slice(0, 60).forEach(function (l) {
      var d = h('div', 'log-line ' + (l.kind || 'info'));
      d.appendChild(h('span', 't', String(l.h).padStart(3, '0') + 'h'));
      d.appendChild(document.createTextNode(l.text));
      box.appendChild(d);
    });
  }

  function renderMemorial() {
    var s = S();
    var box = $('memList');
    box.innerHTML = '';
    $('memCount').textContent = s.memorial.length ? s.memorial.length + ' 人' : '';

    if (!s.memorial.length) {
      box.appendChild(h('div', 'mem-empty', '还没有人没回来。'));
      return;
    }

    s.memorial.slice(0, 14).forEach(function (m) {
      var card = h('div', 'mem-card');
      var yr = Math.floor(m.hour / DATA.CONFIG.winterEvery) + 1;
      card.appendChild(h('div', 'n', m.name));
      card.appendChild(h('div', 'p', m.team + '小队 · ' + m.place + ' · 第 ' + yr + ' 年'));
      card.appendChild(h('div', 'q', '「' + m.last + '」'));
      box.appendChild(card);
    });
    if (s.memorial.length > 14) {
      box.appendChild(h('div', 'mem-empty', '……还有 ' + (s.memorial.length - 14) + ' 个名字没刻上'));
    }
  }

  /* ============================================================
   * 事件卡
   * ============================================================ */
  function maybeShowEvent() {
    var s = S();
    var modal = $('eventModal');
    if (!s.event) { modal.hidden = true; return; }

    var ev = s.event;
    var team = s.teams.filter(function (t) { return t.id === ev.teamId; })[0];
    var def = DATA.TILES[ev.key];

    $('evKind').textContent = (def ? def.name : '') + ' · ' + (team ? team.name + '小队' : '');
    $('evTitle').textContent = ev.title;
    $('evBody').textContent = ev.body;

    var hint = document.getElementById('evHint');
    if (!hint) {
      hint = h('p', 'modal-hint');
      hint.id = 'evHint';
      $('evBody').parentNode.insertBefore(hint, $('evBody').nextSibling);
    }
    hint.textContent = ev.hint || '';

    var choices = $('evChoices');
    choices.innerHTML = '';
    ev.choices.forEach(function (ch) {
      var b = h('button', 'choice' + (ch.id === 'assault' || ch.id === 'enter' ? ' danger' : ''));
      b.appendChild(h('span', null, ch.label));
      b.appendChild(h('span', 'note', ch.note || ''));
      b.onclick = function () {
        EN.resolveEvent(ch.id);
        modal.hidden = true;
        selTeam = ev.teamId;
        renderAll();
        if (S().event) maybeShowEvent();
      };
      choices.appendChild(b);
    });

    var left = DATA.CONFIG.eventWindow - (s.hour - ev.createdAt);
    $('evTimer').textContent = '你还有 ' + Math.max(0, left) + ' 小时。超时他们自己会撤。';

    if (team) selTeam = team.id;
    closeModals('eventModal');
    modal.hidden = false;
  }

  /* ============================================================
   * 势力来使
   * ============================================================ */
  function maybeShowEnvoy() {
    var s = S();
    var m = document.getElementById("envoyModal");
    if (!s.envoy) { m.hidden = true; return null; }
    var e = s.envoy;
    var fac = DATA.FACTIONS.filter(function (f) { return f.id === e.faction; })[0];
    document.getElementById("ev2Kind").textContent = "来 使 · " + (fac ? fac.name : "");
    document.getElementById("ev2Title").textContent = e.title;
    document.getElementById("ev2Body").textContent = e.body;

    var box = document.getElementById("ev2Choices");
    box.innerHTML = "";
    e.choices.forEach(function (c) {
      var b = h("button", "choice");
      b.appendChild(h("span", null, c.label));
      b.appendChild(h("span", "note", c.note || ""));
      b.onclick = function () {
        var r = EN.resolveEnvoy(c.id);
        if (!r.ok) { toast("办不到"); return; }
        m.hidden = true;
        renderAll();
      };
      box.appendChild(b);
    });

    closeModals("envoyModal");
    m.hidden = false;
    return e;
  }

  /* ============================================================
   * 斗将
   * ============================================================ */
  function maybeShowDuel() {
    var s = S();
    var modal = $('duelModal');
    if (!s.duel) { modal.hidden = true; return null; }
    var d = s.duel;
    var team = s.teams.filter(function (t) { return t.id === d.teamId; })[0];
    var DU = DATA.DUEL;

    $('duKind').textContent = '斗 将 · ' + (DATA.TILES[d.key] || {}).name + ' · 第 ' + (d.round + 1) + ' / ' + DU.rounds + ' 回合';
    $('duPName').textContent = (team ? team.name + '小队' : '我方');
    $('duEName').textContent = d.styleName || '守将';
    $('duPBar').style.width = (100 * d.pHp / DU.hp) + '%';
    $('duEBar').style.width = (100 * d.eHp / DU.hp) + '%';

    /* 历史 */
    var log = $('duLog');
    log.innerHTML = '';
    for (var i = 0; i < d.ph.length; i++) {
      var mv = DU.moves.filter(function (m) { return m.id === d.ph[i]; })[0];
      var ev = DU.moves.filter(function (m) { return m.id === d.eh[i]; })[0];
      var good = DU.damage[d.ph[i]][d.eh[i]] > DU.damage[d.eh[i]][d.ph[i]];
      var line = h('div');
      line.innerHTML = '<span class=\'r\'>R' + (i + 1) + '</span> 你出' + (mv ? mv.name : '?') +
        '，他出' + (ev ? ev.name : '?') +
        '　→ <span class=\'' + (good ? 'w' : 'l') + '\'>他 −' + DU.damage[d.ph[i]][d.eh[i]] +
        ' / 你 −' + DU.damage[d.eh[i]][d.ph[i]] + '</span>';
      log.appendChild(line);
    }
    if (!d.ph.length) {
      log.appendChild(h('div', null, '他站在门口，等你先动。'));
    }

    /* 招式 */
    var box = $('duMoves');
    box.innerHTML = '';
    if (!d.over) {
      DU.moves.forEach(function (m) {
        var b = h('button', 'choice');
        b.appendChild(h('span', 'mv', m.icon + ' ' + m.name));
        b.appendChild(h('span', 'hint', m.hint));
        b.onclick = function () {
          EN.duelMove(m.id);
          renderDuelOnly();
        };
        box.appendChild(b);
      });
      $('duTimer').textContent = '他前几回合的习惯：' + (d.eh.length ? d.eh.slice(-3).map(function (x) {
        var mm = DU.moves.filter(function (m) { return m.id === x; })[0];
        return mm ? mm.name : '?';
      }).join(' → ') : '还不清楚');
    } else {
      var win = d.result === 'win';
      var b2 = h('button', 'choice');
      b2.appendChild(h('span', null, win ? '他退了。继续。' : '你被抬下去了。继续。'));
      b2.appendChild(h('span', 'note', win ? '这一仗火力 +15%，危险 −1' : '这一仗危险 +1'));
      b2.onclick = function () {
        EN.finishDuel();
        modal.hidden = true;
        renderAll();
        maybeShowEvent();
      };
      box.appendChild(b2);
      $('duTimer').textContent = (win ? '胜' : '败') + ' · 你剩 ' + d.pHp + '，他剩 ' + d.eHp;
    }

    /* 拒绝应战 */
    if (!d.over) {
      var r = h('button', 'btn btn-ghost', '不应战（这一仗危险 +1）');
      r.style.marginTop = '10px';
      r.onclick = function () {
        EN.refuseDuel();
        modal.hidden = true;
        renderAll();
        maybeShowEvent();
      };
      box.appendChild(r);
      box.lastChild.style.gridColumn = '1 / -1';
    }

    closeModals('duelModal');
    modal.hidden = false;
    return d;
  }

  function renderDuelOnly() { maybeShowDuel(); }

  /* ============================================================
   * 编成
   * ============================================================ */
  function openComp(teamId) {
    var t = S().teams.filter(function (x) { return x.id === teamId; })[0];
    if (!t) return;
    $('cpKind').textContent = '编 成 · ' + t.name + '小队';
    $('cpTitle').textContent = '带什么，就放弃什么';
    renderCompList(t);
    closeModals('compModal');
    $('compModal').hidden = false;
  }

  function renderCompList(t) {
    var s = S();
    var st = ST.armyStats(t.army);
    var cap = ST.capacityNow();
    var pop = ST.armyPop(t.army);
    var box = $('cpStats');
    box.innerHTML = '';
    box.appendChild(h('span', null, '容量 ')).className = 'cp-k';
    var p = h('span');
    p.innerHTML = '<b class=\'' + (pop > cap ? 'over' : '') + '\'>' + pop + ' / ' + cap + '</b>';
    box.appendChild(p);
    [['火力', st.fire], ['装甲', st.armor], ['侦察', st.scout], ['运输', st.haul],
     ['补给上限', ST.maxSupplyOf(t.army)]].forEach(function (a) {
      var sp = h('span');
      sp.innerHTML = a[0] + ' <b>' + a[1] + '</b>';
      box.appendChild(sp);
    });

    var list = $('cpList');
    list.innerHTML = '';
    Object.keys(DATA.UNITS).forEach(function (id) {
      var u = DATA.UNITS[id];
      var n = t.army[id] || 0;
      var row = h('div', 'cp-row');
      var im = document.createElement('img');
      im.src = u.img; im.alt = '';
      row.appendChild(im);
      row.appendChild(h('div', 'cp-name', u.name));
      var tags = h('div', 'cp-tags');
      tags.innerHTML = '火<b>' + u.fire + '</b> 甲<b>' + u.armor + '</b>' +
        (u.scout ? ' 侦<b>' + u.scout + '</b>' : '') +
        (u.haul ? ' 运<b>' + u.haul + '</b>' : '') +
        ' · 占<b>' + u.pop + '</b>';
      row.appendChild(tags);
      var minus = h('button', 'cp-btn', '−');
      if (!n) minus.disabled = true;
      minus.onclick = function () {
        var r = EN.swapUnit(t.id, id, -1);
        if (!r.ok) toast(r.msg);
        renderCompList(t); renderAll();
      };
      row.appendChild(minus);
      row.appendChild(h('div', 'cp-n', String(n)));
      var plus = h('button', 'cp-btn', '+');
      plus.onclick = function () {
        var r = EN.swapUnit(t.id, id, 1);
        if (!r.ok) toast(r.msg);
        renderCompList(t); renderAll();
      };
      row.appendChild(plus);
      list.appendChild(row);
    });
  }

  /* ============================================================
   * 纪事（每年冬天一页）
   * ============================================================ */
  function maybeShowStory() {
    var s = S();
    var modal = $('storyModal');
    if (!s.story && !s.ending) { modal.hidden = true; return null; }
    if (s.ending) { modal.hidden = true; return null; }

    var st = s.story;
    $('stKind').textContent = '纪 事 · 第 ' + st.y + ' 年';
    $('stTitle').textContent = st.title;

    var body = $('stBody');
    body.innerHTML = '';
    st.lines.forEach(function (l) { body.appendChild(h('p', null, l)); });

    var ch = $('stChoices');
    ch.innerHTML = '';
    if (st.choices) {
      st.choices.forEach(function (c) {
        var locked = c.need === 'tech' && (s.city.tech || 0) < 1;
        var b = h('button', 'choice' + (locked ? '' : ''));
        if (locked) b.style.opacity = '0.4';
        b.appendChild(h('span', null, c.label + (locked ? '（缺图纸）' : '')));
        b.appendChild(h('span', 'note', c.note || ''));
        b.onclick = function () {
          var r = EN.resolveStory(c.id);
          if (r && !r.ok && r.msg) { toast(r.msg); return; }
          modal.hidden = true;
          renderAll();
        };
        ch.appendChild(b);
      });
    } else {
      var go = h('button', 'choice');
      go.appendChild(h('span', null, '合上'));
      go.appendChild(h('span', 'note', ''));
      go.onclick = function () {
        S().story = null;
        ST.save();
        modal.hidden = true;
        renderAll();
      };
      ch.appendChild(go);
    }

    closeModals('storyModal');
    modal.hidden = false;
    return st;
  }

  /* ============================================================
   * 总渲染
   * ============================================================ */
  function renderAll() {
    if (!S()) return;
    renderTop();
    renderCity();
    renderTeams();
    renderMap();
    renderLog();
    renderMemorial();
    var modal = $('eventModal');
    if (modal && !S().event) modal.hidden = true;
    var sm = $('storyModal');
    if (sm && !S().story) sm.hidden = true;
    var dm = $('duelModal');
    if (dm && !S().duel) dm.hidden = true;
  }

  var cpClose = $('cpClose');
  if (cpClose) cpClose.onclick = function () { $('compModal').hidden = true; };

  global.UI = {
    renderAll: renderAll,
    maybeShowEvent: maybeShowEvent,
    maybeShowStory: maybeShowStory,
    maybeShowDuel: maybeShowDuel,
    maybeShowEnvoy: maybeShowEnvoy,
    openComp: openComp,
    selectTeam: function (id) { selTeam = id; renderAll(); },
    toast: toast
  };
})(window);
