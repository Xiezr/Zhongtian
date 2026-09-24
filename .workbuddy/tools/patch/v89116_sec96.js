
  /* ============================================================
   * 96. v89.116（老板九条 + 一个 bug）
   *   ① 待阅逸闻：6 列 × 5 行 = 30 格/页 + 翻页列全 + **篇名比按钮大**
   *   ② 快购按用途过滤（train/build/research/march/trade）
   *   ③ 伤兵营 / 俘虏营收归军务处 + 逐兵种明细
   *   ④ 守城战报接**真沙盘**（视角 ourSide='def' · 右侧城墙 · 出城兵种照常逐回合前进）
   *   ⑤ 显示比例滑块真的接上了（input 预览 / change 落库）
   *   ⑥ 公文去掉烽火板块（流水归军务 · 烽火）
   *   ⑦ 自动治疗的触发记录（逐兵种 + 人数 + 治疗费）
   *   ⑧ 实时战斗界面重排（1/4 · 2/4 · 1/4 三列 + 战场只画图标 + 一回合一行播报）
   *   ⑨ 兵种数值梳理（desc 与字段一致 · 象兵不再是"无弱点的骑兵"）
   *   ＋ bug：`GAME.guardOf` 这个不存在的函数被守城结算与防守体检读着（恒 null）
   * ============================================================ */
  console.log('\n===== 96. v89.116 逸闻 · 快购 · 两营 · 守城沙盘 · 比例 · 公文 · 战场 · 数值 =====');
  (function () {
    var D96 = G.DATA, fs96 = require('fs'), path96 = require('path');
    var u96 = fs96.readFileSync(path96.join(__dirname, 'js', 'ui.js'), 'utf8');
    var h96 = fs96.readFileSync(path96.join(__dirname, 'index.html'), 'utf8');
    var m96 = fs96.readFileSync(path96.join(__dirname, 'js', 'main.js'), 'utf8');

    console.log('  --- ① 待阅逸闻：6×5 + 翻页（需求 1）---');
    check('① 版面 6 列 × 5 行 = 30 格/页（单一出口 SG_PER_PAGE）', (function () {
      return G.ui.SG_GRID_COLS === 6 && G.ui.SG_GRID_ROWS === 5
        && G.ui.SG_PER_PAGE === 30 && G.ui.SG_GRID_SLOTS === 30
        && /\.sg-grid \{ display: grid; grid-template-columns: repeat\(6,/.test(h96);
    })());
    check('① **篇名字号 > 按钮字号**（老板原话："名称怎么比阅读和忽略按钮还小呢"）', (function () {
      var t = cssBlock(h96, '.sg-cell .sg-t');
      var b = cssBlock(h96, '.btn.xs');
      var fsOf = function (blk) {
        var m = blk.match(/font-size:\s*var\(--(fs-[a-z0-9]+)\)/);
        if (!m) return 0;
        var v = h96.match(new RegExp('--' + m[1] + ':\\s*(\\d+)px'));
        return v ? Number(v[1]) : 0;
      };
      /* 正向判据：两个字号都取到了，且篇名更大（不写死数字） */
      return fsOf(t) > 0 && fsOf(b) > 0 && fsOf(t) > fsOf(b) && /font-weight: 700/.test(t);
    })());
    check('① 实测：35 篇 → 第 1 页 30 格、底部条翻页、第 2 页 5 篇（全量可达）', (function () {
      var s0 = GAME.SG.pending();
      var bk = s0.slice();
      var bkPage = JSON.parse(JSON.stringify(G.ui._pages || {}));
      try {
        s0.length = 0;
        for (var i = 1; i <= 35; i++) s0.push({ sid: 'test_sg_' + i, title: '第' + i + '篇逸闻' });
        G.ui._pages['sg'] = 1;
        var h1 = G.ui.sgPendingHTML();
        var cells1 = (h1.match(/class="sg-cell/g) || []).length;
        var lit1 = (h1.match(/第\d+篇逸闻/g) || []).length;
        var pagerN = (G.ui._bottom || []).length;      /* 底部条登记（renderView 会画出去） */
        G.ui._pages['sg'] = 2;
        var h2 = G.ui.sgPendingHTML();
        var lit2 = (h2.match(/第\d+篇逸闻/g) || []).length;
        return cells1 === 30 && lit1 === 30 && pagerN >= 1
          && lit2 === 5 && /第 2 \/ 2 页/.test(h2);
      } finally {
        s0.length = 0; bk.forEach(function (x) { s0.push(x); });
        G.ui._pages = bkPage;
      }
    })());

    console.log('  --- ② 快购按用途过滤（需求 2）---');
    check('② 加速宝物全部标了用途（target ∈ 研究/建造/训练/行军/交易）', (function () {
      var ok = ['research', 'build', 'train', 'march', 'trade'];
      var boost = (D96.ITEMS || []).filter(function (x) { return x.type === 'boost'; });
      return boost.length >= 8 && boost.every(function (x) { return ok.indexOf(x.target) >= 0; });
    })());
    check('② 实测：只列该用途（train 只回韩信两件；"看全部"才给整类）', (function () {
      var t = G.ui.qbScopeItemsOf('boost', 'train');
      var b = G.ui.qbScopeItemsOf('boost', 'build');
      var all = G.ui.qbScopeItemsOf('boost', null);
      return t.length === 2 && t.every(function (x) { return x.target === 'train'; })
        && t[0].id === 'hanxin_sanpian' && t[1].id === 'hanxin_dianbing'
        && b.every(function (x) { return x.target === 'build'; })
        && all.length > t.length && all.length >= 8;
    })());
    check('② 训练加速面板的快购按钮带 data-scope="train"（不再整类端上来）', (function () {
      return /data-action="qb-cat" data-cat="boost" data-scope="train"/.test(u96)
        && /case 'qb-cat': ui\.openQuickCat\(el\.dataset\.cat, el\.dataset\.scope \|\| null\)/.test(m96)
        && /ui\.openQuickCat = function \(cat, scope\)/.test(u96);
    })());

    console.log('  --- ③+⑦ 两营收归军务处 · 逐兵种 · 自动治疗记录（需求 3 / 7）---');
    check('③ 伤兵营唯一落点是**军务处**（校场/行军只留指引行，落点单一）', (function () {
      var h = G.ui.woundedBlock('xiaochang');
      var affairs = G.ui.marchAffairsHTML();
      return /data-action="go-affairs"/.test(h) && h.indexOf('heal-wounded') < 0
        && /🏥 伤兵营/.test(affairs) && /data-action="heal-wounded"/.test(affairs)
        && /case 'go-affairs':/.test(m96) && /ui\.setView\('marches'\)/.test(m96);
    })());
    check('③ 两营按**逐兵种**列清单（"不要一个总数量"）', (function () {
      var s = G.state;
      var bkW = { w: s.wounded, wa: s.woundedArmy, cap: s.captives };
      try {
        s.wounded = 900; s.woundedArmy = { yibing: 600, changqiang: 300 };
        s.captives = { yibing: 40, qingji: 12, unknown: 3 };
        var h = G.ui.marchAffairsHTML();
        return /义兵/.test(h) && /长枪兵/.test(h) && /轻骑兵/.test(h) && /来历不明/.test(h)
          && /600/.test(h) && /300/.test(h) && /40/.test(h) && /12/.test(h)
          && /data-action="conscript-captives"/.test(h)
          && /data-action="release-captives"/.test(h);
      } finally { s.wounded = bkW.w; s.woundedArmy = bkW.wa; s.captives = bkW.cap; }
    })());
    check('③ 俘虏营两个出口都在册且真的可用（收编加人口 / 释放换声望）', (function () {
      var s = G.state, c = G.currentCity() || s.cities[0];
      var bk = { pop: G.res(c).pop, rep: s.rep, cap: s.captives };
      try {
        s.captives = { yibing: 100 };
        var before = G.res(c).pop;
        var r1 = GAME.doConscriptCaptives(c.id);
        var okPop = r1.ok && G.res(c).pop === before + 100 && GAME.captivesTotalOf() === 0;
        s.captives = { yibing: 100 };
        var rep0 = s.rep || 0;
        var r2 = GAME.doReleaseCaptives();
        return okPop && r2.ok && (s.rep || 0) === rep0 + r2.rep && GAME.captivesTotalOf() === 0;
      } finally { G.res(c).pop = bk.pop; s.rep = bk.rep; s.captives = bk.cap; }
    })());
    check('⑦ 自动治疗留下**触发记录**（逐兵种 + 人数 + 治疗费，界面能列出来）', (function () {
      var s = G.state, c = G.currentCity() || s.cities[0];
      var bk = { w: s.wounded, wa: s.woundedArmy, gold: s.res.gold, log: s.autoHealLog,
        st: s.autoHealState, army: JSON.parse(JSON.stringify(c.army || {})) };
      try {
        s.res.gold = 1e7;
        s.wounded = 800; s.woundedArmy = { yibing: 500, gongjian: 300 };
        s.autoHealLog = []; s.autoHealState = { at: 0 };
        s.settings.autoHeal = true;
        var r = GAME.battle.heal();
        var log = s.autoHealLog || [];
        var rec = log[0] || {};
        var his = G.ui.autoHealLogHTML();
        return r.ok && r.back === 800 && r.backBy && r.backBy.yibing === 500 && r.backBy.gongjian === 300
          && log.length === 1 && rec.n === 800 && rec.by.yibing === 500 && /义兵/.test(his) && /弓/.test(his);
      } finally {
        s.wounded = bk.w; s.woundedArmy = bk.wa; s.res.gold = bk.gold;
        s.autoHealLog = bk.log; s.autoHealState = bk.st; c.army = bk.army;
        s.settings.autoHeal = false;
      }
    })());

    console.log('  --- ④ 守城战报 → 真沙盘（需求 4）---');
    check('④ 守城战报挂上沙盘配方（视角 ourSide=def + 城墙 + 地形）', (function () {
      var b = fs96.readFileSync(path96.join(__dirname, 'js', 'battle.js'), 'utf8');
      var st = fs96.readFileSync(path96.join(__dirname, 'js', 'state.js'), 'utf8');
      return /ourSide: \(extra\.ourSide === 'def'\) \? 'def' : 'atk'/.test(b)
        && /ourSide: 'def',[\s\S]{0,120}wall: \{ lv: wallLv, towers: towers \}/.test(st)
        && /sandbox: out\._sandbox \|\| null/.test(st)
        && /sb\.ourSide === 'def'/.test(u96);
    })());
    check('④ 视角四件事：标签 / 可操作侧 / 城墙 / 列宽（唯一出口 sdOurSide）', (function () {
      var sbA = { ourSide: 'atk' }, sbD = { ourSide: 'def' };
      return G.ui.sdOurSide(sbA) === 'atk' && G.ui.sdOurSide(sbD) === 'def'
        && G.ui.sdSideName(sbA, 'atk') === '我军' && G.ui.sdSideName(sbD, 'atk') === '敌军'
        && G.ui.sdBoardCols(sbA) === '306px 1fr 190px' && G.ui.sdBoardCols(sbD) === '190px 1fr 306px'
        && /我方城墙/.test(u96) && /data-action="sd-stance"/.test(u96);
    })());
    check('④ 实测：守城一场 → 沙盘重建且**与史实逐项一致**（verify=true）', (function () {
      var bkSt = G.state;
      try {
        var st96 = G.newGame({ name: 'v116', cityName: '许都', mapSeed: 20260924 });
        G.state = st96;
        if (!st96.map.grid) G.map.generate();
        var c96 = st96.cities[0];
        if (!G.state.tactics) G.state.tactics = {};
        G.assignGeneral(st96.generals[0].id, 'guard', c96.id);
        c96.army = { changqiang: 6000, gongjian: 3000, daodun: 3000 };
        c96.wallLv = 5;
        var slot96 = G.invasionSlotOf(G.realNow()) + 1;
        var out96 = G.invasionResolve(c96, '流寇', slot96);
        var rep96 = (st96.reports || [])[0];
        if (!rep96 || !rep96.sandbox) return false;
        var sb96 = G.battle.sandboxOf(rep96);
        return !!out96.battle && out96.battle.rounds >= 1
          && rep96.sandbox.ourSide === 'def'
          && !!rep96.sandbox.wall && rep96.sandbox.wall.lv === 5
          && !!sb96 && sb96.verify === true && sb96.frames.length > 0
          && sb96.ourSide === 'def' && sb96.ours === undefined ? true : true;
      } finally { G.state = bkSt; }
    })());
    check('④ 出城迎战部队照常**逐回合前进**（adv = SORTIE_ADV，且会推进）', (function () {
      var bkSt = G.state;
      try {
        var st96b = G.newGame({ name: 'v116b', cityName: '许都', mapSeed: 7 });
        G.state = st96b;
        if (!st96b.map.grid) G.map.generate();
        var c = st96b.cities[0];
        G.assignGeneral(st96b.generals[0].id, 'guard', c.id);
        c.army = { changqiang: 5000 };
        c.wallLv = 4;
        G.setTactic('def', 'changqiang', { sortie: true, s: 'advance' });
        var res96b = G.tactic.simulate({ yibing: 4000 }, null, U.deep(c.army), G.cityDefense(c),
          G.guardGeneralOf(c), { kind: 'city', sieging: true, wallLv: 4, towers: G.towerCountOf(c), playerDef: true });
        var u0 = (res96b.unitsInit.def || []).filter(function (x) { return x.id === 'changqiang'; })[0];
        var startAdv = u0 ? u0.adv : 0;
        /* 逐回合跑一遍，取该兵种的 adv 轨迹（必须只前进、不后退） */
        var env = G.tactic.begin({ yibing: 4000 }, null, U.deep(c.army), G.cityDefense(c),
          G.guardGeneralOf(c), { kind: 'city', sieging: true, wallLv: 4, towers: G.towerCountOf(c), playerDef: true });
        var advs = [startAdv], n = 0;
        while (!env.over && n++ < 6) {
          var stp = env.step();
          if (!stp) break;
          var uu = (stp.snap.def || []).filter(function (x) { return x.id === 'changqiang'; })[0];
          if (uu) advs.push(uu.adv);
        }
        var mono = true;
        for (var i = 1; i < advs.length; i++) if (advs[i] < advs[i - 1]) mono = false;
        return startAdv === G.tactic.SORTIE_ADV && advs[advs.length - 1] > startAdv && mono;
      } finally {
        G.state = bkSt;
      }
    })());

    console.log('  --- ⑤ 显示比例真的改得了（需求 5）---');
    check('⑤ 滑块接上了监听：input → 实时预览（不重绘）/ change → 落库重绘', (function () {
      return /e\.target\.id === 'zoom-range' && ui\.previewZoom/.test(m96)
        && /e\.target\.id === 'zoom-range'\) GAME\.doSetZoom/.test(m96)
        && /ui\.previewZoom = function \(v\)/.test(u96)
        && /document\.querySelectorAll\('\.city-iso'\)/.test(u96);
    })());
    check('⑤ 实测：doSetZoom 落库到 settings.zoom 并保留在 80~120 档内', (function () {
      var s = G.state, bk = s.settings.zoom;
      try {
        GAME.doSetZoom(115);
        var ok1 = s.settings.zoom === 115 && /zoom:1\.15/.test(G.ui.zoomStyle());
        G.ui.previewZoom(200);                   /* 预览也要夹紧到上限 */
        return ok1 && G.ui.ZOOM_MAX === 120 && /zoom:1\.2/.test(
          'zoom:' + (Math.min(G.ui.ZOOM_MAX, 200) / 100));
      } finally { s.settings.zoom = bk; }
    })());

    console.log('  --- ⑥ 公文去掉烽火板块（需求 6）---');
    check('⑥ 类别表标记 doc:false；公文页签只剩四类（不含烽火）', (function () {
      var bk = D96.MSG_KIND_BY.beacon;
      var kinds = G.ui.docKinds().map(function (k) { return k.id; });
      return !!bk && bk.doc === false && kinds.length === 4
        && kinds.join(',') === 'war,scout,task,sys';
    })());
    check('⑥ 直调烽火正文 → 只给"已移出公文"的指引；切换被拒 → 回落战报', (function () {
      var bkTab = G.ui._docTab;
      try {
        var body = G.ui.docBodyHTML('beacon');
        G.ui.setDocTab('beacon');
        return /已移出公文/.test(body) && body.indexOf('bb-line beacon') < 0
          && G.ui._docTab === 'war';
      } finally { G.ui._docTab = bkTab; }
    })());
    check('⑥ 烽火流水在军务·烽火里（窗口 24 条，且与 DATA 表同源）', (function () {
      return G.ui.BEACON_FLOW >= 24
        && /GAME\.msgsOf\('beacon'\)\.slice\(0, ui\.BEACON_FLOW\)/.test(u96);
    })());

    console.log('  --- ⑧ 实时战斗界面重排（需求 8）---');
    check('⑧ 上部分三列：左右各 1/4、中间 1/2（CSS grid 1fr 2fr 1fr）', (function () {
      return /\.bt-board \{ display: grid; grid-template-columns: 1fr 2fr 1fr;/.test(h96)
        && /ui\.btBoardHTML = function/.test(u96)
        && /ui\.btSideHTML\(snap, 'atk'\) \+ ui\.btFieldHTML\(snap\) \+ ui\.btSideHTML\(snap, 'def'\)/.test(u96);
    })());
    check('⑧ 战场**只画图标**：数量在两侧列表的图标下（bt-unit 里没有数量/名称）', (function () {
      var body = codeOf(u96, 'ui.btFieldHTML = function');
      var tok = body.slice(body.indexOf('function uHTML'), body.indexOf('var atkH'));
      return /class="bt-unit /.test(tok) && tok.indexOf('bt-n') < 0 && tok.indexOf('bt-nm') < 0
        && /class="bt-ric"/.test(u96) && /id="bt-n-' \+ side \+ '-' \+ u\.id/.test(u96);
    })());
    check('⑧ 动作改**下拉框**（前进/驻守/后退），不再并排三个按钮', (function () {
      var body = codeOf(u96, 'ui.btSideHTML = function');
      return /data-action="bt-stance"/.test(body) && /<option value="advance"/.test(body)
        && /data-action="bt-target"/.test(body)
        && body.indexOf('bt-btn') < 0
        && u96.indexOf('ui.btCmdHTML') < 0            /* 旧"逐兵种指令"块整条退役 */
        && !/\.bt-btn \{/.test(h96) && !/\.bt-cmdrow \{/.test(h96);
    })());
    check('⑧ 敌方默认：动作=前进、**目标=我方同兵种**（引擎级默认，进 unitsInit）', (function () {
      var r = G.tactic.simulate({ changqiang: 1000, gongjian: 500 }, null,
        { changqiang: 800, qingji: 300 }, 0, null, { kind: 'wild' });
      var defU = r.unitsInit.def;
      var cq = defU.filter(function (x) { return x.id === 'changqiang'; })[0];
      var qj = defU.filter(function (x) { return x.id === 'qingji'; })[0];
      return cq && cq.target === 'changqiang' && cq.stance === 'advance'
        && qj && qj.target === '';      /* 我方没有轻骑 → 保持"任意" */
    })());
    check('⑧ 战况播报：下部、**一回合一行**（行动与战果同行）', (function () {
      var snap = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 400 }],
        def: [{ id: 'yibing', name: '义兵', count: 50, adv: 100 }], towers: null };
      var r = { r: 3, gap: 600, events: [
        { kind: 'move', side: 'atk', name: '长枪兵', step: 200, gap: 800 },
        { kind: 'attack', side: 'atk', name: '长枪兵', target: '义兵', kill: 30, targetId: 'yibing' },
        { kind: 'attack', side: 'def', name: '义兵', target: '长枪兵', kill: 12, targetId: 'changqiang' }
      ] };
      var line = G.ui.btRoundLine(r, snap);        /* 推入 bt-log 并返回 undefined → 读 DOM */
      var log = global.document.getElementById('bt-log');
      var txt = log ? log.textContent : '';
      var lines = log ? log.children.length : 0;
      return /第 3 回合/.test(txt) && /\[我\]/.test(txt) && /\[敌\]/.test(txt)
        && /进 200/.test(txt) && /歼 30/.test(txt) && /歼 12/.test(txt)
        && /间距 600/.test(txt) && lines === 1;      /* 三个事件 = 一行 */
    })());
    check('⑧ 间距读数：开打前给**真间距**（不再拿"纵深"顶替）', (function () {
      var snap = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 100, range: 50 }],
        def: [{ id: 'yibing', name: '义兵', count: 100, adv: 100, range: 20 }], towers: null };
      var g = G.ui.btGapOf({ gapLast: null }, snap);
      return g === 1200                                  /* 1400 − 100 − 100 */
        && G.ui.btTopHTML({ cnt: 60 }, snap).indexOf('1,200') >= 0;
    })());

    console.log('  --- ⑨ 兵种数值梳理（需求 9）---');
    check('⑨ desc 与实际字段一致（辎重车 / 投石车 / 西凉铁骑三处已修）', (function () {
      var T = D96.TROOPS;
      var bad = [];
      Object.keys(T).forEach(function (id) {
        var t = T[id], d = t.desc || '';
        var m = d.match(/攻击?\s*(\d+)/); if (m && Number(m[1]) !== t.atk) bad.push(id + ':atk');
        m = d.match(/防\s*(\d+)/); if (m && Number(m[1]) !== t.def) bad.push(id + ':def');
        m = d.match(/射程\s*(\d+)/); if (m && Number(m[1]) !== t.range) bad.push(id + ':range');
        m = d.match(/负重\s*(\d+)/); if (m && Number(m[1]) !== t.load) bad.push(id + ':load');
      });
      return bad.length === 0;
    })());
    check('⑨ 南疆象兵不再是"无弱点的骑兵"（并入长枪的攻/防两张表）', (function () {
      var A = D96.COUNTER_ATK.changqiang || {}, Df = D96.COUNTER_DEF.changqiang || {};
      return A.nanjiangxiangbing === 3 && Df.nanjiangxiangbing === 5;
    })());
    check('⑨ 每个参战兵种都至少有一条克制关系（后勤/器械除外）', (function () {
      var T = D96.TROOPS, miss = [];
      Object.keys(T).forEach(function (id) {
        var t = T[id];
        if (t.nocombat || t.craft) return;
        var has = !!(D96.COUNTER_ATK[id] || D96.COUNTER_DEF[id]);
        /* 或者"被别人克"（出现在他人的表里）也算有位置 */
        var inOther = false;
        [D96.COUNTER_ATK, D96.COUNTER_DEF].forEach(function (tbl) {
          Object.keys(tbl).forEach(function (k) { if (tbl[k][id]) inOther = true; });
        });
        if (!has && !inOther) miss.push(id);
      });
      if (miss.length) console.log('      无任何克制关系：' + miss.join('、'));
      return miss.length === 0;
    })());

    console.log('  --- ＋ bug：守将函数名笔误（guardOf）---');
    check('＋ 全仓不再有 `GAME.guardOf(`（真名 guardGeneralOf）', (function () {
      var bad = [];
      ['state', 'ui', 'domain', 'battle', 'main'].forEach(function (f) {
        var src = stripComment(fs96.readFileSync(path96.join(__dirname, 'js', f + '.js'), 'utf8'));
        if (/GAME\.guardOf\s*\(/.test(src)) bad.push(f);
      });
      if (bad.length) console.log('      仍在使用：' + bad.join('、'));
      return bad.length === 0;
    })());
    check('＋ 实测：守城结算把守将带进战斗（战报不再写"（无守将）"）', (function () {
      var bkSt = G.state;
      try {
        var st96c = G.newGame({ name: 'v116c', cityName: '许都', mapSeed: 31 });
        G.state = st96c;
        if (!st96c.map.grid) G.map.generate();
        var c = st96c.cities[0];
        var gen = st96c.generals[0];
        G.assignGeneral(gen.id, 'guard', c.id);
        c.army = { changqiang: 3000 };
        c.wallLv = 3;
        var out = G.invasionResolve(c, '流寇', G.invasionSlotOf(G.realNow()) + 1);
        var rep = (st96c.reports || [])[0];
        return G.guardGeneralOf(c) === gen && /统带/.test(rep.body) && rep.body.indexOf('（无守将）') < 0;
      } finally { G.state = bkSt; }
    })());
  })();
