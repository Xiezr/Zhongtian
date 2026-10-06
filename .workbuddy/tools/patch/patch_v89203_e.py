# -*- coding: utf-8 -*-
"""v89.203 批次E：版本号 + §203 断言段（smoke 结构/行为 · e2e 真渲染）"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

# ============================================================
# E1 · 版本号 v89.203
# ============================================================
rep('E1 版本号', R + 'js/main.js',
    "  GAME.VERSION = 'v89.202';",
    "  GAME.VERSION = 'v89.203';",
    "GAME.VERSION = 'v89.203';")

rep('E1b smoke 版本断言', R + 'smoke-test.js',
    "      return /GAME\\.VERSION = 'v89\\.202'/.test(mS199)   /* v89.202：版本号每轮迭代更新（本条随轮升级） */",
    "      return /GAME\\.VERSION = 'v89\\.203'/.test(mS199)   /* v89.203：版本号每轮迭代更新（本条随轮升级） */",
    "'v89\\.203'/.test(mS199)")

# ============================================================
# E2 · smoke §203 段
# ============================================================
D1_ANCHOR = "  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"

D1_NEW = r'''  })();

  /* ============================================================
   * §203（v89.203）防守全员前进 · 爵位管理城池数（9..30）· toast 中上 · 占领反馈
   * ============================================================ */
  (function () {
    console.log('  --- §203 防守默认 / 城池上限 / toast / 占领反馈 ---');
    var fs203 = require('fs'), path203 = require('path');
    var dS203 = fs203.readFileSync(path203.join(__dirname, 'js/data.js'), 'utf8');
    var uS203 = fs203.readFileSync(path203.join(__dirname, 'js/ui.js'), 'utf8');
    var bS203 = fs203.readFileSync(path203.join(__dirname, 'js/battle.js'), 'utf8');
    var hS203 = fs203.readFileSync(path203.join(__dirname, 'index.html'), 'utf8');

    /* ① 防守默认（v89.203 新规则：野地/据点/名城一律全员前进） */
    check('§203① 守方默认全员前进（siege 特例退役 · 三目标统一 · 真调出口）', (function () {
      return DATA.STANCE_DEFAULT.siege === undefined
        && DATA.STANCE_DEFAULT.def === 'advance'
        && G.tacticOf('def', 'changqiang', { sieging: true }).s === 'advance'
        && G.tacticOf('def', 'changqiang', { sieging: false }).s === 'advance'
        && !/'hold'/.test(JSON.stringify(DATA.STANCE_DEFAULT));
    })());
    check('§203② 守方默认文案随口径更新（summary / clearTactics / UI help）', (function () {
      var sum = codeOf(dS203, 'GAME.tacticSummary = function');
      var clr = codeOf(dS203, 'GAME.clearTactics = function');
      return /未设（默认：全员前进）/.test(sum)
        && /已恢复默认防守战术（全员前进）/.test(clr)
        && uS203.indexOf('全员前进') >= 0
        && !/攻城固守/.test(uS203) && !/攻城固守/.test(dS203)
        && !/攻城固守/.test(codeOf(uS203, 'ui.tacticBlockOf = function'));
    })());

    /* ② 爵位管理城池数（平民 9 · 每级 +1 · 封顶 30） */
    check('§203③ 爵位管理城池数逐档核验（9..30 · cap=本档 · 封顶 30）', (function () {
      var bad = [];
      for (var i = 0; i < DATA.RANK.length; i++) {
        if (DATA.RANK[i].city !== 9 + i) bad.push(i + ':' + DATA.RANK[i].city);
      }
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'cap203', cityName: '许都' });
        G.state = st;
        st.rank = 0;
        if (G.cityCapOf() !== 9) bad.push('平民cap=' + G.cityCapOf());
        st.rank = DATA.RANK.length - 1;
        if (G.cityCapOf() !== 30) bad.push('封顶=' + G.cityCapOf());
        if (bad.length) console.log('     ' + bad.join(' '));
        return bad.length === 0;
      } finally { G.state = keep; }
    })());
    check('§203④ 晋升门槛 = 打满本档（8 城拦 · 9 城放行 · 真调 canPromote）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'cap203b', cityName: '许都' });
        G.state = st;
        st.rank = 0;
        st.rep = 1e12; st.res.gold = 1e12;
        st.items = st.items || {};
        st.items.bengzhu = 999; st.items.mila = 999;
        while (st.cities.length < 9) {
          st.cities.push(G.makeCity({ id: 'cap_b' + st.cities.length, name: 'b' + st.cities.length,
            x: 500 + st.cities.length, y: 500, type: 'self' }));
        }
        while (st.cities.length > 8) st.cities.pop();
        var blocked = G.systems.canPromote();
        st.cities.push(G.makeCity({ id: 'cap_c8', name: 'c8', x: 560, y: 560, type: 'self' }));
        var pass = G.systems.canPromote();
        return blocked.ok === false && /城池/.test(blocked.msg || '')
          && pass.ok === true;
      } finally { G.state = keep; }
    })());
    check('§203⑤ 爵位面板文案（管理城池列头 + 平民 9 座说明 · 源码在册）', (function () {
      return /<th>爵位<\/th><th>管理城池<\/th>/.test(uS203)
        && uS203.indexOf('管理城池数 = 平民 9 座，每晋一档 +1（封顶 30 座）') >= 0;
    })());

    /* ③ toast 中上（弹窗打开时） */
    check('§203⑥ toast 中上：CSS .toast.high 在册 + notify 按弹窗切换', (function () {
      return /\.toast\.high \{ top: 13%; bottom: auto; \}/.test(hS203)
        && /\.toast\.high:not\(\.show\)/.test(hS203)
        && /el\.classList\.toggle\('high', !!\(ui\._maskEl && ui\._maskEl\.isConnected\)\)/.test(uS203);
    })());

    /* ④ 占领反馈：onConquer 拒 → notify warn（真调 · spy） */
    check('§203⑦ 占领满编被拒 → 醒目 toast（与日志同文案含「未能纳入版图」）', (function () {
      var keep = G.state;
      var called = [];
      var bkNotify = G.ui.notify;
      try {
        var st = G.newGame({ name: 'occ203', cityName: '许都' });
        G.state = st;
        if (!st.map.grid) G.map.generate();
        var npc = (st.map.cities || [])[0];
        if (!npc) return false;
        while (st.cities.length < 9) {
          st.cities.push(G.makeCity({ id: 'occ_b' + st.cities.length, name: 'b' + st.cities.length,
            x: 600 + st.cities.length, y: 600, type: 'self' }));
        }
        G.ui.notify = function (t2, m2) { called.push({ t: t2, m: m2 }); };
        var r = G.onConquer(npc, { winner: 'atk' }, st.generals[0] || null, st.cities[0]);
        return r.ok === false && called.length >= 1 && called[0].t === 'warn'
          && /未能纳入版图/.test(called[0].m || '') && /领地上限/.test(called[0].m || '');
      } finally { G.ui.notify = bkNotify; G.state = keep; }
    })());
    check('§203⑧ 占领正向链：cap 未满 → 城入版图（origId 在册 · 归属我管理）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: 'occ203b', cityName: '许都' });
        G.state = st;
        if (!st.map.grid) G.map.generate();
        var npc = (st.map.cities || [])[0];
        if (!npc) return false;
        var n0 = st.cities.length;
        var r = G.onConquer(npc, { winner: 'atk' }, st.generals[0] || null, st.cities[0]);
        var newCity = st.cities[st.cities.length - 1];
        return r.ok === true && st.cities.length === n0 + 1 && newCity.origId === npc.id;
      } finally { G.state = keep; }
    })());

    /* ⑤ 档案在册 */
    check('§203⑨ 需求档案在册（v89.203 · 老板原文关键句）', (function () {
      var a = fs203.readFileSync(path203.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.203') >= 0 && a.indexOf('防守方式均设置为默认全员前进') >= 0
        && a.indexOf('平民9座') >= 0 && a.indexOf('没有归属我管理') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');'''

rep('E2 smoke §203 段', R + 'smoke-test.js', D1_ANCHOR, D1_NEW, '§203① 守方默认全员前进')

# ============================================================
# E3 · e2e §203 段
# ============================================================
D2_ANCHOR = "  }\n\n  return finish();"

D2_NEW = r'''  }

  /* ============================================================
   * §203（v89.203）防守默认 / 城池上限（9..30）/ toast 中上 / 占领反馈（真实 DOM）
   * ============================================================ */
  console.log('\n--- §203. v89.203 防守 / 城池上限 / toast / 占领反馈（真实 DOM） ---');
  {
    const _bkS203 = G.state;
    /* ① toast.high：弹窗打开 → 上浮上半屏且不挡底部操作键；无弹窗 → 回底部 */
    try {
      const st203 = G.newGame({ name: 'e203a', cityName: '许都' });
      G.state = st203;
      G.ui._cityId = st203.cities[0].id;
      try { G.addEquip('lg_weapon_1'); } catch (e) { }
      st203.items = st203.items || {}; st203.items.lingsui = 500;
      G.ui.closeAllModals();
      G.ui.openLingTemper();
      await sleep(220);
      G.ui.notify('info', '测试提示（弹窗内）');
      await sleep(130);
      const t203 = document.getElementById('toast');
      const r203a = t203.getBoundingClientRect();
      const foot203 = document.querySelector('#modal-root .m-foot');
      const vh203 = window.innerHeight;
      check('§203① 弹窗打开：toast 上浮上半屏（top ' + Math.round(r203a.top) + '）且不挡底键',
        t203.classList.contains('high') && r203a.top < vh203 / 2
        && (!!foot203 ? r203a.bottom <= foot203.getBoundingClientRect().top + 2 : true),
        'top=' + Math.round(r203a.top) + ' bottom=' + Math.round(r203a.bottom) + ' vh=' + vh203);
      G.ui.closeAllModals();
      await sleep(150);
      G.ui.notify('info', '测试提示（无弹窗）');
      await sleep(130);
      const r203b = t203.getBoundingClientRect();
      check('§203② 无弹窗：toast 保持底部（top ' + Math.round(r203b.top) + ' 在下半屏）',
        !t203.classList.contains('high') && r203b.top > vh203 / 2,
        'top=' + Math.round(r203b.top));
      G.ui.closeAllModals();
    } finally { G.state = _bkS203; }

    /* ② 占领满编被拒 → warn toast 真渲染（文案含「未能纳入版图」） */
    try {
      const st203b = G.newGame({ name: 'e203b', cityName: '许都' });
      G.state = st203b;
      if (!st203b.map.grid) G.map.generate();
      while (st203b.cities.length < 9) {
        st203b.cities.push(G.makeCity({ id: 'e203b_' + st203b.cities.length, name: 'b' + st203b.cities.length,
          x: 600 + st203b.cities.length, y: 600, type: 'self' }));
      }
      const npc203 = (st203b.map.cities || [])[0];
      const rOcc = G.onConquer(npc203, { winner: 'atk' }, st203b.generals[0] || null, st203b.cities[0]);
      await sleep(130);
      const toastTxt = (document.getElementById('toast') || {}).textContent || '';
      check('§203③ 满编占领被拒：warn toast 真渲染（含「未能纳入版图」）',
        rOcc.ok === false && toastTxt.indexOf('未能纳入版图') >= 0 && toastTxt.indexOf('领地上限') >= 0,
        toastTxt.slice(0, 66));
      G.ui.closeAllModals();
    } finally { G.state = _bkS203; }

    /* ③ 爵位页：列头「管理城池」+ 说明「平民 9 座」+ 首档值 9 */
    try {
      const st203c = G.newGame({ name: 'e203c', cityName: '许都' });
      G.state = st203c;
      G.ui.setView('rank');
      await sleep(180);
      const vc203 = document.querySelector('#view-container');
      const txt203 = vc203 ? (vc203.textContent || '') : '';
      check('§203④ 爵位页：列头「管理城池」+ 说明「平民 9 座」在册',
        txt203.indexOf('管理城池') >= 0 && txt203.indexOf('平民 9 座') >= 0, '');
      const row0 = document.querySelector('#view-container .tbl tbody tr');
      check('§203⑤ 爵位表首档管理城池 = 9（渲染与数据同源）',
        !!row0 && row0.textContent.indexOf('9') >= 0 && G.DATA.RANK[0].city === 9, '');
    } finally { G.state = _bkS203; }
  }

  return finish();'''

rep('E3 e2e §203 段', R + 'e2e-test.js', D2_ANCHOR, D2_NEW, '§203① 弹窗打开：toast 上浮上半屏')

print('批次E 完成')
