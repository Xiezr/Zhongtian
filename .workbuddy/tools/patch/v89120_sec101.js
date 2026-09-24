  console.log('\n===== 101. v89.120 战报身份 rid / 设定即生效 / 三键居中 / 回合倒叙 =====');
  (function () {
    var G = GAME;
    var _fs101 = require('fs'), _p101 = require('path');
    var u101 = _fs101.readFileSync(_p101.join(__dirname, 'js/ui.js'), 'utf8');
    var m101 = _fs101.readFileSync(_p101.join(__dirname, 'js/main.js'), 'utf8');
    var s101 = _fs101.readFileSync(_p101.join(__dirname, 'js/state.js'), 'utf8');
    var h101 = _fs101.readFileSync(_p101.join(__dirname, 'index.html'), 'utf8');
    var clean101 = function (x) {
      return x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    };

    /* ---------- ① 需求 1：战报身份 rid 化 ---------- */
    /* 结构层：索引口径全仓绝迹（剥注释后查 —— 防墓碑注释误伤，§7.5 的老坑） */
    check('① 结构：报告身份 rid 化（_repView 绝迹 / data-rid 在册 / repByRid 唯一出口）', (function () {
      var u = clean101(u101), m = clean101(m101);
      return /GAME\.repRidOf = function/.test(s101) && /GAME\.repByRid = function/.test(s101)
        && u.indexOf('_repView') < 0 && m.indexOf('_repView') < 0
        && /data-action="view-report" data-rid=/.test(u)
        && /ui\.viewReportText = function \(rid\)/.test(u)
        && /ui\.openSandbox = function \(rid\)/.test(u)
        && /ui\.toggleRepFav = function \(rid\)/.test(u)
        && /ui\._repId = 0;/.test(u)
        && /ui\.viewReportText\(rid\)/.test(u)                 /* rlog 回调捕获 rid */
        && /data-action="open-sandbox" data-rid=/.test(u)
        && /repByRid\(Number\(el\.dataset\.rid\)\)/.test(m);
    })());

    /* 行为层（核心 · 带对照实验）：列表渲染后 unshift 新报告（数组位移）→
       旧行携带的 rid 仍指向**原报告**；对照：旧下标此刻已指向别的报告。 */
    var r101a = (function () {
      var bak = G.state;
      var out = {}, ok = false;
      try {
        var st = G.newGame({ name: 'rid', cityName: '许都', mapSeed: 20260924 });
        if (!st.map.grid) G.map.generate();
        st.reports = [
          { t: Date.now() - 2000, title: '掠报甲', body: 'x', win: true },
          { t: Date.now() - 1000, title: '侦察乙', body: 'x', win: true, type: 'scout' },
        ];
        var rid0 = G.repRidOf(st.reports[0]);          /* 渲染前取号：唯一出口 */
        /* 渲染列表（这一行的 data-rid = 老板看列表那一刻的 DOM 身份） */
        var row = G.ui.docRepRowHTML(st.reports[0], true);
        /* 位移：来了一份新侦察报告（unshift 插到最前） */
        st.reports.unshift({ t: Date.now(), title: '新侦察丙', body: 'x', win: true, type: 'scout' });
        var byRid = G.repByRid(rid0);
        /* 真开一次：viewReportText(rid) 之后 _repId 落在 rid0、能取回原报告 */
        G.ui.viewReportText(rid0);
        var openedOk = G.ui._repId === rid0
          && !!G.repByRid(G.ui._repId) && G.repByRid(G.ui._repId).title === '掠报甲';
        G.ui.closeAllModals();
        out.has = row.indexOf('data-rid="' + rid0 + '"') >= 0;
        out.by = byRid ? byRid.title : 'null';
        out.idx0 = st.reports[0].title;
        out.open = openedOk;
        ok = out.has && out.by === '掠报甲' && out.idx0 === '新侦察丙' && openedOk;
      } finally { G.state = bak; }
      return { ok: ok, dbg: JSON.stringify(out) };
    })();
    check('① 实测：数组位移后 rid 仍指原报告（对照：旧下标已指到别的报告）', r101a.ok, r101a.dbg);

    /* ---------- ② 需求 2：回放态改设定 → 自动进推演（设定即生效） ---------- */
    var r101b = (function () {
      var bak = G.state, bakSd = G.ui._sd, bakRep = G.ui._repId;
      var okAll = false, denied = false, dbg = '';
      try {
        /* 真打一场（低等级野地 + 足兵力），拿到一份带 sandbox 的战报 */
        var st = G.newGame({ name: '演', cityName: '许都', mapSeed: 20260925 });
        if (!st.map.grid) G.map.generate();
        var c0 = st.cities[0];
        var cx = c0.x, cy = c0.y, tgt = null;
        for (var dx = -8; dx <= 8 && !tgt; dx++) {
          for (var dy = -8; dy <= 8 && !tgt; dy++) {
            if (!dx && !dy) continue;
            var xx = cx + dx, yy = cy + dy;
            if (xx < 0 || yy < 0 || xx > (G.COORD_MAX || 499) || yy > (G.COORD_MAX || 499)) continue;
            var tl = G.map.tile(xx, yy);
            if (!tl || tl.terrain === 'city') continue;
            var lv = G.map.wildLevelNow ? G.map.wildLevelNow(xx, yy) : 1;
            if (lv >= 1 && lv <= 3) tgt = { x: xx, y: yy, lv: lv };
          }
        }
        if (!tgt) { dbg = 'no wild'; return { ok: false, dbg: dbg }; }
        st.wilds = (st.wilds || []).slice();
        st.wilds.push({ x: tgt.x, y: tgt.y, type: 'plain', lv: tgt.lv, terrain: 'plain' });
        st.settings = st.settings || {}; st.settings.battleWatch = false;
        var g0 = (st.generals || [])[0];
        g0.cityId = c0.id; g0.status = 'idle';
        G.setStaNow(g0, 200); g0.energy = 200;
        c0.army = { yibing: 3000 };
        var d0 = G.march.dispatch({ kind: 'wild', x: tgt.x, y: tgt.y, name: '演武场', lv: tgt.lv },
          'raid', { yibing: 3000 }, g0.id, null, null, null);
        if (!d0 || d0.ok === false) { dbg = 'dispatch:' + ((d0 && d0.msg) || '-'); return { ok: false, dbg: dbg }; }
        (st.marches || []).forEach(function (m) { m.elapsed = m.totalTime + 1; });
        G.march.tick();
        var rep = null;
        (st.reports || []).forEach(function (r) { if (!rep && r.sandbox && r.type !== 'scout') rep = r; });
        if (!rep) { dbg = 'no sandbox report'; return { ok: false, dbg: dbg }; }
        var rid = G.repRidOf(rep);
        G.ui.openSandbox(rid);
        var sd = G.ui._sd;
        if (!sd || sd.mode !== 'replay' || !sd.sb || !sd.sb.verify) {
          dbg = 'sd未开/replay/verify=' + (sd && sd.sb ? sd.sb.verify : '-');
          return { ok: false, dbg: dbg };
        }
        var myList = (G.ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def);
        var u0 = myList[0];
        if (!u0) { dbg = 'no unit'; return { ok: false, dbg: dbg }; }
        var st0 = u0.stance;
        G.ui.sdSetCmd(u0.id, { s: 'hold' });          /* 老板点「驻守」chip 走这里 */
        dbg = 'mode=' + sd.mode + ' cmd=' + JSON.stringify(sd.sim && sd.sim.cmds)
          + ' stance=' + st0 + '→' + u0.stance;
        okAll = sd.mode === 'sim' && !!sd.sim
          && !!sd.sim.cmds[u0.id] && sd.sim.cmds[u0.id].s === 'hold'
          && u0.stance === 'hold';
        /* 反面：校验未过 → 明确拒绝（不假装成功、不写 cmds） */
        sd.sb.verify = false;
        var before = JSON.stringify(sd.sim.cmds);
        G.ui.sdSetCmd(u0.id, { s: 'retreat' });
        denied = sd.mode === 'sim' && JSON.stringify(sd.sim.cmds) === before
          && u0.stance === 'hold';               /* retreat 没写进去 */
        sd.sb.verify = true;
        G.ui.closeAllModals();
        return { ok: okAll && denied, dbg: dbg + ' denied=' + denied };
      } catch (e) { return { ok: false, dbg: dbg + ' ERR:' + (e && e.message) }; }
      finally { G.ui._sd = bakSd; G.ui._repId = bakRep; G.state = bak; }
    })();
    check('② 实测：回放态改设定 → 自动进推演且设定落库（不再静默失效）', r101b.ok, r101b.dbg);

    /* ---------- ③ 需求 3：三键在读秒行（正中间） ---------- */
    check('③ 结构：三键在读秒行 .bt-acts（左读数/中按钮/右提示）且底栏不再有', (function () {
      var snap = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 100, range: 50 }],
        def: [{ id: 'yibing', name: '义兵', count: 100, adv: 100, range: 20 }], towers: null };
      var h = G.ui.btTopHTML({ cnt: 60 }, snap);
      var okTop = /class="bt-acts"/.test(h)
        && /btn sm gold" data-action="bt-done">/.test(h)
        && /btn sm" data-action="bt-auto">/.test(h)
        && /btn sm" data-action="bt-retreat">/.test(h)
        && h.indexOf('1,200') >= 0;                        /* 间距读数照旧 */
      var iL = h.indexOf('bt-left'), iA = h.indexOf('bt-acts'), iH = h.indexOf('bt-hint');
      var okOrder = iL >= 0 && iA > iL && iH > iA;         /* 三列序：左→中→右 */
      /* 底栏不再挂三键（openBattlefield 的 foot 段内查） */
      var iF = u101.indexOf('ui.openBattlefield = function');
      var seg = u101.slice(iF, iF + 4000);
      var iFoot = seg.indexOf('foot:');
      var footSeg = iFoot >= 0 ? seg.slice(iFoot, iFoot + 400) : '';
      var okFoot = footSeg.indexOf('"bt-done"') < 0 && footSeg.indexOf('"bt-auto"') < 0
        && footSeg.indexOf('"bt-retreat"') < 0;
      var okCss = /\.bt-top \{ display: grid; grid-template-columns: 1fr auto 1fr;/.test(h101);
      return okTop && okOrder && okFoot && okCss;
    })());

    /* ---------- ④ 需求 4：回合记录倒叙（结构层；真 DOM 在 e2e） ---------- */
    check('④ 结构：回合块整块置顶（insertBefore firstChild）+ 裁剪删最旧（lastChild）', (function () {
      var u = clean101(u101);
      return /log\.insertBefore\(frag, log\.firstChild\);/.test(u)
        && /ui\.btLogTrim = function/.test(u)
        && /log\.removeChild\(log\.lastChild\)/.test(u)
        && /ui\.BT_LOG_MAX = 40;/.test(u)
        && /ui\.btLogItem = function/.test(u)
        && u.indexOf("ui.btLogPush('', 'sep')") < 0;      /* 旧写法绝迹（剥注释后查） */
    })());
  })();
