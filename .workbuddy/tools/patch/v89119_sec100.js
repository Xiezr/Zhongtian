  console.log('\n===== 100. v89.119 反击记录配对（老板「反击和对方出手记录在同一行」） =====');
  (function () {
    var G = GAME;
    var _fs99 = require('fs'), _p99 = require('path');
    var u99 = _fs99.readFileSync(_p99.join(__dirname, 'js/ui.js'), 'utf8');
    var t99 = _fs99.readFileSync(_p99.join(__dirname, 'js/tactic.js'), 'utf8');
    var b99 = _fs99.readFileSync(_p99.join(__dirname, 'js/battle.js'), 'utf8');

    /* ① 结构：counter 不再自建行 —— 并入"引发它的那次出手"（同一行、紧跟其后） */
    check('① 结构：反击并入**引发它的那次出手**（不再自建行、紧跟出手之后）', (function () {
      var snap = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 400 }],
        def: [{ id: 'yibing', name: '义兵', count: 50, adv: 100 }], towers: null };
      var r = { r: 2, gap: 60, events: [
        { kind: 'attack', side: 'atk', id: 'changqiang', name: '长枪兵', target: '义兵', targetId: 'yibing', kill: 30 },
        { kind: 'counter', side: 'def', id: 'yibing', name: '义兵', target: '长枪兵', targetId: 'changqiang', kill: 12 },
      ] };
      var lines = G.ui.btRoundLines(r, snap);
      if (lines.length !== 1) return false;                 /* 义兵不该自建行 */
      var L = lines[0].txt;
      var iKill = L.indexOf('歼 30'), iCtr = L.indexOf('反击');
      return /长枪兵/.test(L) && iKill >= 0 && iCtr > iKill   /* 反击在出手**之后** */
        && /义兵反击 歼 12/.test(L) && L.indexOf('（') >= 0;
    })());

    /* ② 对称：老板句 1/句 2 —— 我方行带"对方反击"、对方行带"我方相应反击" */
    check('② 对称：我方行 = 移动·出手·对方反击；对方行 = 移动·出手·我方反击', (function () {
      var snap = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 60 }],
        def: [{ id: 'yibing', name: '义兵', count: 50, adv: 60 }], towers: null };
      var r = { r: 3, gap: 20, events: [
        { kind: 'move', side: 'atk', id: 'changqiang', name: '长枪兵', step: 30 },
        { kind: 'attack', side: 'atk', id: 'changqiang', name: '长枪兵', target: '义兵', targetId: 'yibing', kill: 40 },
        { kind: 'counter', side: 'def', id: 'yibing', name: '义兵', target: '长枪兵', targetId: 'changqiang', kill: 9 },
        { kind: 'move', side: 'def', id: 'yibing', name: '义兵', step: 10 },
        { kind: 'attack', side: 'def', id: 'yibing', name: '义兵', target: '长枪兵', targetId: 'changqiang', kill: 8 },
        { kind: 'counter', side: 'atk', id: 'changqiang', name: '长枪兵', target: '义兵', targetId: 'yibing', kill: 7 },
      ] };
      var lines = G.ui.btRoundLines(r, snap);
      var atkLine = '', defLine = '';
      lines.forEach(function (L) { if (L.cls === 'atk') atkLine = L.txt; if (L.cls === 'def') defLine = L.txt; });
      return lines.length === 2
        && /进 30/.test(atkLine) && /→ 义兵 歼 40/.test(atkLine) && /（义兵反击 歼 9）/.test(atkLine)
        && atkLine.indexOf('进 30') < atkLine.indexOf('歼 40')
        && atkLine.indexOf('歼 40') < atkLine.indexOf('义兵反击 歼 9')
        && /进 10/.test(defLine) && /→ 长枪兵 歼 8/.test(defLine) && /（长枪兵反击 歼 7）/.test(defLine);
    })());

    /* ③ 实测：真打一场（近战互殴）—— counter 全部被配对，且"反击"不再独立成格 */
    var c3 = (function () {
      var bak = G.state, ok = false, dbg = '';
      try {
        G.newGame({ name: '配', cityName: '许都' });
        var r = G.tactic.simulate({ changqiang: 4000 }, null, { yibing: 6000 }, 0, null, { kind: 'wild' });
        var ctrN = 0, bad = 0, ctrInLine = 0;
        (r.roundsLog || []).forEach(function (rr) {
          (rr.events || []).forEach(function (e) { if (e.kind === 'counter') ctrN++; });
          var lines = G.ui.btRoundLines(rr, rr.snap);
          var txt = lines.map(function (L) { return L.txt; }).join(' ');
          ctrInLine += (txt.match(/反击/g) || []).length;
          if (/反击 →/.test(txt)) bad++;
        });
        dbg = 'counter 事件 ' + ctrN + ' · 行内"反击" ' + ctrInLine + ' · 独立段 ' + bad
          + ' · 回合 ' + (r.rounds || 0);
        ok = ctrN >= 2 && ctrInLine === ctrN && bad === 0;
      } finally { G.state = bak; }
      return { ok: ok, dbg: dbg };
    })();
    check('③ 实测：counter 事件数 == 行内反击数（配对无遗漏·无独立段）', function () { return c3.ok; }, c3.dbg);

    /* ④ 引擎纪要同口径：战报正文里反击与引发它的出手段同段 */
    var c4 = (function () {
      var bak = G.state, ok = false, dbg = '';
      try {
        G.newGame({ name: '纪', cityName: '许都' });
        var r = G.tactic.simulate({ changqiang: 4000 }, null, { yibing: 6000 }, 0, null, { kind: 'wild' });
        var joined = (r.log || []).join('\n');
        var hasPaired = /杀伤 [\d,]+（[^）]*反击 杀伤/.test(joined);
        var lone = joined.match(/；[^；\n]*?反击 [^；\n]*?杀伤/g) || [];
        dbg = '配对段=' + hasPaired + ' 疑似独立段=' + lone.length + (lone[0] ? (' [' + lone[0].slice(0, 56) + ']') : '');
        ok = hasPaired && lone.length === 0;
      } finally { G.state = bak; }
      return { ok: ok, dbg: dbg };
    })();
    check('④ 引擎纪要：反击与出手段同段（无独立反击段）', function () { return c4.ok; }, c4.dbg);

    /* ⑤ 回放帧同口径（battle.js evLine） */
    var c5 = (function () {
      var srcOK = /var hi = hostOf\[hk\];/.test(b99) && /parts\[hi\] \+= '（'/.test(b99);
      if (!srcOK) return { ok: false, dbg: '源码级不匹配' };
      var bak = G.state, ok = false, dbg = '';
      try {
        G.newGame({ name: '帧', cityName: '许都' });
        var r = G.tactic.simulate({ changqiang: 4000 }, null, { yibing: 6000 }, 0, null, { kind: 'wild' });
        var rf = G.battle.replayFramesOf(r);
        var all = (rf && rf.frames) ? rf.frames.map(function (f) { return f.ev || ''; }).join('｜') : '';
        var ctr = (all.match(/反击/g) || []).length;
        var paired = (all.match(/（[^）]*反击 杀 /g) || []).length;
        dbg = 'frames=' + (rf && rf.frames ? rf.frames.length : 0) + ' · 帧内反击=' + ctr + ' 括号配对=' + paired;
        ok = !!rf && !!rf.frames && rf.frames.length >= 4 && ctr === paired;
      } finally { G.state = bak; }
      return { ok: ok, dbg: dbg };
    })();
    check('⑤ 回放帧：反击并入出手段（若有反击必为括号配对；帧非空）', function () { return c5.ok; }, c5.dbg);

    /* ⑥ 配对键带阵营（同名兵种互射不串台）—— 三处同一规则 */
    check('⑥ 配对键带阵营（a|id / d|id）——三处同一规则（源码级）', (function () {
      var tOK = /hostOf\[\(e\.side === 'atk' \? 'a' : 'd'\) \+ '\|' \+ e\.id\]/.test(t99)
        && /hostOf\[\(e\.side === 'atk' \? 'd' : 'a'\) \+ '\|' \+ e\.targetId\]/.test(t99);
      var bOK = /hostOf\[\(e\.side === 'atk' \? 'a' : 'd'\) \+ '\|' \+ e\.id\]/.test(b99)
        && /hostOf\[\(e\.side === 'atk' \? 'd' : 'a'\) \+ '\|' \+ e\.targetId\]/.test(b99);
      var uOK = /hostOf\[row\.key\] = act/.test(u99)
        && /var hKey = \(e\.side === 'atk' \? 'def' : 'atk'\) \+ '\|'/.test(u99);
      return tOK && bOK && uOK;
    })());

    /* ⑦ 同名兵种互射（弓手 vs 弓手）：配对不串台（实测） */
    var c7 = (function () {
      var snap = { field: 1200, atk: [{ id: 'gongjian', name: '弓箭手', count: 100, adv: 100 }],
        def: [{ id: 'gongjian', name: '弓箭手', count: 100, adv: 100 }], towers: null };
      var r = { r: 1, gap: 300, events: [
        { kind: 'attack', side: 'def', id: 'gongjian', name: '弓箭手', target: '弓箭手', targetId: 'gongjian', kill: 20 },
        { kind: 'counter', side: 'atk', id: 'gongjian', name: '弓箭手', target: '弓箭手', targetId: 'gongjian', kill: 18 },
        { kind: 'attack', side: 'atk', id: 'gongjian', name: '弓箭手', target: '弓箭手', targetId: 'gongjian', kill: 16 },
        { kind: 'counter', side: 'def', id: 'gongjian', name: '弓箭手', target: '弓箭手', targetId: 'gongjian', kill: 14 },
      ] };
      var lines = G.ui.btRoundLines(r, snap);
      var atkLine = '', defLine = '';
      lines.forEach(function (L) { if (L.cls === 'atk') atkLine = L.txt; if (L.cls === 'def') defLine = L.txt; });
      var dbg = 'atk[' + atkLine + '] def[' + defLine + ']';
      /* 关键：反击不得跨行串台 —— 守方行里是"回应守方那次出手"的反击（歼 18），
         攻方行里是"回应攻方那次出手"的反击（歼 14）。 */
      var ok = lines.length === 2
        && /歼 20/.test(defLine) && /反击 歼 18/.test(defLine)
        && /歼 16/.test(atkLine) && /反击 歼 14/.test(atkLine);
      return { ok: ok, dbg: dbg };
    })();
    check('⑦ 同名兵种互射不串台（配对键带阵营）', function () { return c7.ok; }, c7.dbg);

    /* ⑧ 兜底：找不到宿主的孤立 counter 独立成格（不静默丢事件） */
    check('⑧ 兜底：孤立 counter（无宿主）独立成格，不静默丢事件', (function () {
      var snap = { field: 1200, atk: [{ id: 'changqiang', name: '长枪兵', count: 10, adv: 0 }], def: [], towers: null };
      var r = { r: 9, gap: 10, events: [
        { kind: 'counter', side: 'def', id: 'yibing', name: '义兵', target: '长枪兵', targetId: 'changqiang', kill: 3 }
      ] };
      var lines = G.ui.btRoundLines(r, snap);
      return lines.length === 1 && /义兵/.test(lines[0].txt)
        && /反击/.test(lines[0].txt) && /歼 3/.test(lines[0].txt);
    })());
  })();

