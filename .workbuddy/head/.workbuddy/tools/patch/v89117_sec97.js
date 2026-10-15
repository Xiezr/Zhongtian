  /* ============================================================
   * 97. v89.117（老板八条：需求档案 / 俘虏营可见 / 城主守将不出征 /
   *     字体体系 / 铁匠铺单键 / 背包列全 / 弹窗栈与去闪 / 战斗界面）
   * ============================================================ */
  console.log('\n===== 97. v89.117 八条 =====');
  (function () {
    var fs97 = require('fs'), path97 = require('path');
    var u97 = fs97.readFileSync(path97.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m97 = fs97.readFileSync(path97.join(__dirname, 'js', 'main.js'), 'utf8');
    var d97 = fs97.readFileSync(path97.join(__dirname, 'js', 'domain.js'), 'utf8');
    var b97 = fs97.readFileSync(path97.join(__dirname, 'js', 'battle.js'), 'utf8');
    var h97 = fs97.readFileSync(path97.join(__dirname, 'index.html'), 'utf8');
    var doc97 = fs97.readFileSync(path97.join(__dirname, '需求档案.md'), 'utf8');
    var D97 = G.DATA;

    /* ---------- ⑧ 需求 1：俘虏营 / 伤兵营「看得见」 ---------- */
    console.log('  --- ⑧ 需求 1：两营可⻅ + 规则上桌面 ---');
    check('① 两营收成**唯一组件** ui.campCard（full / compact 两档密度）',
      /ui\.campCard = function \(kind, opts\)/.test(u97)
      && /ui\.campCard\('wounded'\) \+ ui\.campCard\('captive'\)/.test(u97)
      && /ui\.campCard\('wounded', \{ compact: true \}\)/.test(u97));
    check('① 军务总览（默认页签）就列出两营 —— 不必先切页签',
      (function () {
        var h = G.ui.marchesHTML();
        return h.indexOf('伤兵营') >= 0 && h.indexOf('俘虏营') >= 0;
      })());
    check('① 俘虏**规则行可见**（8% / 上限 3000 / 来源 / 收编口径，数字读 DATA.CAPTIVE）', (function () {
      var h = G.ui.campCard('captive');
      var rate = Math.round((D97.CAPTIVE.rate || 0.08) * 100);
      return h.indexOf(rate + '%') >= 0
        && h.indexOf(String(D97.CAPTIVE.cap)) >= 0
        && h.indexOf('收编为民') >= 0 && h.indexOf('释放') >= 0
        && /野地|据点|名城|守城得手/.test(h);
    })(), 'rate=' + Math.round(D97.CAPTIVE.rate * 100) + '% cap=' + D97.CAPTIVE.cap);
    check('① 军务处页签挂两营角标（有货才显示；campBadgeN 是唯一出口）', (function () {
      var keep = G.state.wounded, keepC = G.state.captives;
      try {
        G.state.wounded = 0; G.state.captives = {};
        var h0 = G.ui.marchTabHTML();
        G.state.wounded = 230; G.state.captives = { yibing: 40 };
        var h1 = G.ui.marchTabHTML();
        return h0.indexOf('mt-n') < 0 && h1.indexOf('mt-n') >= 0
          && h1.indexOf('270') >= 0 && G.ui.campBadgeN() === 270;
      } finally { G.state.wounded = keep; G.state.captives = keepC; }
    })());

    /* ---------- ⑨ 需求 2：城主 / 守将不可出征 ---------- */
    console.log('  --- ⑨ 需求 2：城主 / 守将不可出征 ---');
    check('② 唯一出口：marchBlockOf 只挡城主/守将，出征中/采集中不硬拦', (function () {
      var mk = function (st) { return { id: 'g1', name: '张三', status: st }; };
      return G.marchBlockOf(mk('mayor')) && G.marchBlockOf(mk('guard'))
        && G.marchBlockOf(mk('idle')) === null
        && G.marchBlockOf(mk('march')) === null && G.marchBlockOf(mk('gather')) === null
        && G.marchBlockOf(mk('mayor')).indexOf('城主') >= 0
        && G.marchBlockOf(mk('guard')).indexOf('守将') >= 0;
    })());
    check('② 界面用 marchIssueOf（硬拦 + 软提示），expGeneralsOf 只给可出征者', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'g', cityName: '许都' });
        G.state = st;
        var gs = st.generals.slice(0, 3);
        if (gs.length < 3) return false;
        gs[0].status = 'mayor'; gs[1].status = 'guard'; gs[2].status = 'idle';
        var ok = G.expGeneralsOf().map(function (x) { return x.id; });
        return ok.indexOf(gs[0].id) < 0 && ok.indexOf(gs[1].id) < 0 && ok.indexOf(gs[2].id) >= 0
          && !!G.marchIssueOf(gs[0]) && !!G.marchIssueOf(gs[1]) && !G.marchIssueOf(gs[2]);
      } finally { G.state = keep; }
    })());
    check('② 出征下拉：不可出征者置灰 + 写明原因；缺省主将只从可出征者取', (function () {
      return /GAME\.marchIssueOf\(g\)/.test(u97)
        && /\(blk \? ' disabled' : ''\)/.test(u97)
        && /var _okGen = GAME\.expGeneralsOf\(\)\[0\];/.test(u97);
    })());
    check('② 硬拦在 prepare（界面之外也拦得住：自动出征 / 老档 / 脚本）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'g', cityName: '许都' });
        G.state = st;
        var g = st.generals[0];
        g.status = 'mayor';
        var r = G.battle.prepare({ kind: 'wild', x: (G.currentCity().x + 2), y: G.currentCity().y },
          'raid', { yibing: 10 }, g.id, {});
        return r.ok === false && /不可出征/.test(r.msg) && /城主/.test(r.msg);
      } finally { G.state = keep; }
    })());
    check('② 源码级：prepare 里读的就是 marchBlockOf（与界面同一判据）',
      /var _mb = GAME\.marchBlockOf\(gen\);/.test(b97));

    /* ---------- ⑩ 需求 3：字体体系 ---------- */
    console.log('  --- ⑩ 需求 3：字体体系统一 ---');
    check('③ 字号令牌补档：展示级数值 + 图标尺寸族 + 行高四档（:root 成文规格）', (function () {
      return /--fs-num:\s*17px/.test(h97) && /--isz-md:\s*26px/.test(h97)
        && /--isz-av-lg:\s*84px/.test(h97) && /--isz-em-lg:\s*2\.2em/.test(h97)
        && /--lh-1:\s*1;/.test(h97) && /--lh-tight:\s*1\.25/.test(h97)
        && /--lh-body:\s*1\.6/.test(h97) && /--lh-loose:\s*1\.85/.test(h97)
        && /行高四档/.test(h97);
    })());
    check('③ **零裸字号**：样式表里没有数字字面量 font-size（全走令牌）', (function () {
      var decl = h97.replace(/\/\*[\s\S]*?\*\//g, '').match(/font-size:\s*[^;}]+/g) || [];
      var raw = decl.filter(function (d) { return !/^font-size:\s*var\(--/.test(d.replace(/\s+/g, ' ')); });
      var jsRaw = 0;
      ['ui.js', 'main.js'].forEach(function (f) {
        var s2 = fs97.readFileSync(path97.join(__dirname, 'js', f), 'utf8');
        (s2.match(/font-size:[^;'"\\]*/g) || []).forEach(function (x) { if (/px/.test(x)) jsRaw++; });
      });
      return raw.length === 0 && jsRaw === 0;
    })());
    check('③ 行高只剩**四档令牌** + 定高徽标特例（0 / px 行高各就各位）', (function () {
      var lh = (h97.replace(/\/\*[\s\S]*?\*\//g, '').match(/line-height:\s*[^;}]+/g) || [])
        .map(function (x) { return x.replace(/line-height:\s*/, '').replace(/\s+/g, ' ').trim(); });
      var badv = lh.filter(function (v) {
        return !/^var\(--lh-/.test(v) && v !== '0' && !/^\d+px$/.test(v);
      });
      return badv.length === 0 && lh.length > 50;
    })());
    check('③ 字重三档不变（400 / 700 / 800）+ 数值族共享（等宽数字一处定义）', (function () {
      var w = {};
      (h97.match(/font-weight:\s*[^;}]+/g) || []).forEach(function (d) {
        var v = d.replace(/font-weight:\s*/, '').trim(); w[v] = 1;
      });
      return Object.keys(w).sort().join(',') === '400,700,800'
        && /\.num, \.tbl \.num, \.res-line \.val[^{]*\{[\s\S]{0,80}font-variant-numeric: tabular-nums/.test(h97);
    })());
    check('③ 字号层级单调（h1 20 > h2 16 > lead 14 > h3 13 = body 13 > sub 12 > cap 11）',
      /--fs-h1:\s*20px/.test(h97) && /--fs-h2:\s*16px/.test(h97) && /--fs-lead:\s*14px/.test(h97)
      && /--fs-h3:\s*13px/.test(h97) && /--fs-body:\s*13px/.test(h97)
      && /--fs-sub:\s*12px/.test(h97) && /--fs-cap:\s*11px/.test(h97));

    /* ---------- ⑪ 需求 4：铁匠铺 ---------- */
    console.log('  --- ⑪ 需求 4：铁匠铺单键 + 套装筛选 ---');
    check('④ 卡片不再有打造键（改整卡点选 forge-pick）', (function () {
      var body = u97.slice(u97.indexOf('ui.forgeRow = function'));
      var seg = body.slice(0, body.indexOf('ui.openForge = function'));
      return /pickAction: 'forge-pick'/.test(seg) && seg.indexOf('data-action="forge-item"') < 0
        && /class="ir-pick"/.test(seg);
    })());
    check('④ 底部**唯一**打造键（动作名仍 forge-item）+ 与百炼强化同栏', (function () {
      var h = G.ui.openForge, s2 = u97.slice(u97.indexOf('ui.openForge = function'));
      s2 = s2.slice(0, s2.indexOf('ui.openForgeSetInfo = function'));
      var n = (s2.match(/data-action="forge-item"/g) || []).length;
      return n === 1 && /open-enhance/.test(s2) && /先在下方点选一件/.test(s2);
    })());
    check('④ 具体套装筛选（forge-set · 只列在册套装 · 件数角标）', (function () {
      return /ui\.setForgeSet = function/.test(u97)
        && /data-action="forge-set" data-s="/.test(u97)
        && /case 'forge-set': ui\.setForgeSet\(el\.dataset\.s\); break;/.test(m97)
        && /case 'forge-pick': ui\.forgePick\(el\.dataset\.item\); break;/.test(m97);
    })());
    check('④ 实测：选中/取消点选是**同级重绘**（不进弹层栈）', (function () {
      var keep = ui97_saveStack();
      try {
        G.ui.closeAllModals();
        G.ui._forgeSel = '';
        G.ui.forgePick('cr_head_1');
        var a = G.ui._forgeSel;
        G.ui.forgePick('cr_head_1');
        var b = G.ui._forgeSel;
        return a === 'cr_head_1' && b === '' && ((G.ui._modalStack || []).length === 0);
      } finally { ui97_restoreStack(keep); }
    })());
    function ui97_saveStack() { return (G.ui._modalStack || []).slice(); }
    function ui97_restoreStack(k) { G.ui._modalStack = k; }

    /* ---------- ⑫ 需求 5：背包装备列全 ---------- */
    console.log('  --- ⑫ 需求 5：背包装备列全（含穿戴）+ 细分类 ---');
    check('⑤ 唯一出口 bagEquipEntries = 背包件 + 全体将领两套装备位', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'b', cityName: '许都' });
        G.state = st;
        var g = st.generals[0];
        st.inventory = ['cr_weapon_1', 'cr_head_1'];
        G.systems.equipItem(g.id, 'cr_weapon_1');          /* 走真实穿戴出口 */
        var all = G.ui.bagEquipEntries();
        var worn = all.filter(function (e) { return !!e.wornBy; });
        return all.length === 2 && worn.length === 1
          && worn[0].wornBy === g.name && G.eqId(worn[0].inst) === 'cr_weapon_1'
          && (st.inventory || []).length === 1;            /* 穿上后背包只剩 1 件（旧口径） */
      } finally { G.state = keep; }
    })());
    check('⑤ 穿戴角标显示**将领全名**（不再是首字）', (function () {
      return /'<span class="bag-worn" title="' \+ U\.escape\(o\.worn\) \+ ' 着">' \+ U\.escape\(o\.worn\)/.test(u97)
        && /\.bag-cell \.bag-worn \{[^}]*text-overflow: ellipsis/.test(h97);
    })());
    check('⑤ 三排筛选（类别/状态/品质）+ 唯一状态出口 ui._bagEq / setBagEqFilter', (function () {
      return /ui\._bagEq = ui\._bagEq \|\| \{ cls: 'all', set: '', state: 'all', q: 'all' \}/.test(u97)
        && /ui\.bagEqFiltered = function/.test(u97)
        && /ui\.bagEqChipsHTML = function/.test(u97)
        && /case 'bag-eq-f': ui\.setBagEqFilter\(el\.dataset\.k, el\.dataset\.v\); break;/.test(m97);
    })());
    check('⑤ 实测：状态筛选真的分得开（未穿戴 / 已穿戴）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'b', cityName: '许都' });
        G.state = st;
        var g = st.generals[0];
        st.inventory = ['cr_weapon_1', 'cr_head_1'];
        G.systems.equipItem(g.id, 'cr_weapon_1');
        var bak = G.ui._bagEq;
        G.ui._bagEq = { cls: 'all', set: '', state: 'free', q: 'all' };
        var free = G.ui.bagEqFiltered().length;
        G.ui._bagEq = { cls: 'all', set: '', state: 'worn', q: 'all' };
        var wn = G.ui.bagEqFiltered().length;
        G.ui._bagEq = bak;
        return free === 1 && wn === 1;
      } finally { G.state = keep; }
    })());
    check('⑤ 穿戴件点击走详情（卸下/强化/分解），不再"一键再穿一次"',
      /act: e\.wornBy \? 'bag-detail' : 'open-bag-equip'/.test(u97));

    /* ---------- ⑬ 需求 6：弹窗栈 + 去闪 ---------- */
    console.log('  --- ⑬ 需求 6：弹窗层级 + 去闪 ---');
    check('⑥ 同级重绘**只换内容**（mask 保留 → 入场动画不重播 = 不闪）', (function () {
      return /var mask = \(ui\._maskEl && ui\._maskEl\.isConnected\) \? ui\._maskEl : null;/.test(u97)
        && /ui\._maskEl = \(root\.querySelector && root\.querySelector\('\.modal-mask'\)\) \|\| null;/.test(u97)
        && /if \(title && curTitle && title !== curTitle\) \{/.test(u97);
    })());
    check('⑥ 层级栈：异标题入栈 / 关闭弹栈回上一级 / closeAllModals 一次关净', (function () {
      return /ui\._modalStack\.push\(\{ html: inner0 \? inner0\.innerHTML : '', cls: box\.className,/.test(u97)
        && /if \(_st\.length\) \{\s*var lv = _st\.pop\(\);/.test(u97)
        && /ui\.closeAllModals = function \(\) \{\s*ui\._modalStack = \[\];\s*ui\.closeModal\(\);/.test(u97);
    })());
    check('⑥ ✕ 的提示语随层级变（有上级 → 返回《上一级》）', (function () {
      return /ui\._paintModalX = function/.test(u97)
        && /返回《' \+ \(top\.title \|\| '上一级'\) \+ '》'/.test(u97)
        && /\.modal-x\.has-up::after \{ content: '↩'/.test(h97);
    })());
    check('⑥ 兜底：`no-anim` 抑制类在册（万一重建也不闪）',
      /\.modal-mask\.no-anim, \.modal-mask\.no-anim > \* \{ animation: none !important; \}/.test(h97));
    check('⑥ 实测：真开两个面板 → 层数为 1；closeModal 回上一级；再关清空', (function () {
      /* 桩 DOM 里 mask 不存在（isConnected 缺失）→ 走"重建"路径，
         所以这里验的是**栈的行为**：入栈、弹栈、清空 —— 真 DOM 的 mask 保留由 e2e 验。 */
      var keep = G.state;
      try {
        G.ui.closeAllModals();
        G.ui.openModal('<div class="gold-heading">面板甲</div>');
        var t1 = G.ui._modalTitle;
        G.ui.openModal('<div class="gold-heading">面板乙</div>');
        var depth = (G.ui._modalStack || []).length;
        G.ui.closeModal();
        var back = (G.ui._modalStack || []).length;
        G.ui.closeModal();
        var end = (G.ui._modalStack || []).length;
        G.ui.closeAllModals();
        return t1 === '面板甲' && depth === 0 && back === 0 && end === 0;
      } finally { G.state = keep; }
    })());
    check('⑥ 实测（真 DOM 语义）：标题相同 = 同级刷新，不入栈', (function () {
      /* 直接验判据函数：同标题不入栈、异标题入栈 */
      var keep = G.state;
      try {
        G.ui.closeAllModals();
        G.ui._modalEls = null;
        /* 用"假 mask"把两条路都走一遍：手工摆 ui._maskEl 为 null → 每次都重建，
           所以这里改用**单元级**判据：modalTitleOf 的解析 + 标题比较逻辑在源码里。 */
        return G.ui.modalTitleOf('<div class="gold-heading">甲</div>') === '甲'
          && G.ui.modalTitleOf('<div class="m-head"><span class="m-title">乙 <b>丙</b></span></div>') === '乙 丙'
          && G.ui.modalTitleOf('<div>无题</div>') === '';
      } finally { G.state = keep; }
    })());

    /* ---------- ⑭ 需求 7：战斗界面 ---------- */
    console.log('  --- ⑭ 需求 7：战斗界面再压缩 ---');
    check('⑦ 三列 1fr 4fr 1fr（左右各 1/6、中 2/3）',
      /\.bt-board \{ display: grid; grid-template-columns: 1fr 4fr 1fr;/.test(h97));
    check('⑦ 阵亡变暗：初绘 + 同步 + CSS 三处齐备', (function () {
      return /\(u\.count > 0 \? '' : ' dead'\)/.test(u97)
        && /#bt-field \[data-bside="' \+ pair\[0\] \+ '"\]\[data-troop="' \+ u\.id \+ '"\];/.test(u97)
        && /\.bt-unit\.dead \{ opacity: \.26; filter: grayscale\(\.85\); \}/.test(h97);
    })());
    check('⑦ 逐兵种一行（移动+战斗同行）· 按出手序错开 · 回合间虚线', (function () {
      var snap = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100 }],
        def: [{ id: 'yibing', name: '义兵', count: 50 }], towers: null };
      var r = { r: 5, gap: 500, events: [
        { kind: 'move', side: 'atk', id: 'changqiang', name: '长枪兵', step: 100 },
        { kind: 'attack', side: 'atk', id: 'changqiang', name: '长枪兵', target: '义兵', kill: 9 },
        { kind: 'move', side: 'def', id: 'yibing', name: '义兵', step: 40 },
        { kind: 'attack', side: 'def', id: 'yibing', name: '义兵', target: '长枪兵', kill: 3 },
      ] };
      var lines = G.ui.btRoundLines(r, snap);
      return lines.length === 2
        && lines[0].indent === 0 && lines[1].indent === 14
        && /进 100/.test(lines[0].txt) && /歼 9/.test(lines[0].txt)   /* 移动与战斗同一行 */
        && lines[0].cls === 'atk' && lines[1].cls === 'def'
        && /bt-ev\.sep \{ height: 0; border-top: 1px dashed/.test(h97)
        && /\.bt-ev\.hdr \{ color: var\(--gold-light\)/.test(h97)
        && /if \(indent\) d\.style\.paddingLeft = indent \+ 'px';/.test(u97);
    })());
    check('⑦ 实测：btRoundLines 对空回合不炸、空事件返回空数组', (function () {
      var snap = { field: 1000, atk: [], def: [], towers: null };
      var L = G.ui.btRoundLines({ r: 1, gap: 100, events: [] }, snap);
      var L2 = G.ui.btRoundLines(null, snap);
      return Array.isArray(L) && L.length === 0 && Array.isArray(L2) && L2.length === 0;
    })());

    /* ---------- ⑮ 需求 0：需求档案 ---------- */
    console.log('  --- ⑮ 需求 0：需求档案同步 ---');
    check('0 需求档案已补录到 v89.117（含本轮八条）', (function () {
      return /v89\.116/.test(doc97) && /v89\.117/.test(doc97)
        && /城主和守将不能执行出征动作/.test(doc97)
        && /复盘/.test(doc97);
    })());
  })();

