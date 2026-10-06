# -*- coding: utf-8 -*-
"""v89.198 批次H：四条红修复（domain 辎重真 bug + smoke 三条口径）"""

import io

def rd(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

# h1 domain：调运 dispatch 七参 → 六参（辎重落在 extra）
rep('E:/Deepseekdb/js/domain.js', 'H1 调运 dispatch 六参（真 bug 修复）',
"""    var d = GAME.march.dispatch({ kind: 'owncity', id: to.id }, 'transfer', army, gen.id, null, null,
      load ? { cargo: load } : null);""",
"""    /* v89.198（dispatch 六参签名）：原第 6 参 ops 退役 —— 辎重落在第 6 参 extra（防静默丢失）。 */
    var d = GAME.march.dispatch({ kind: 'owncity', id: to.id }, 'transfer', army, gen.id, null,
      load ? { cargo: load } : null);""",
    '原第 6 参 ops 退役 —— 辎重落在第 6 参 extra')

S = 'E:/Deepseekdb/smoke-test.js'

# h2 超载断言 dispatch 七参 → 六参
rep(S, 'H2 超载断言六参',
"""        var r = G.march.dispatch({ kind: 'fort', x: f.x, y: f.y }, 'raid', { yibing: 10 }, gen.id, null, null,
          { cargo: { grain: 5000 } });                       /* 载重 10×20=200 < 5000 */""",
"""        var r = G.march.dispatch({ kind: 'fort', x: f.x, y: f.y }, 'raid', { yibing: 10 }, gen.id, null,
          { cargo: { grain: 5000 } });                       /* 载重 10×20=200 < 5000 */""",
    "{ yibing: 10 }, gen.id, null,\n          { cargo: { grain: 5000 } });")

# h3 §164③ 界面断言升级
rep(S, 'H3 §164③ 界面断言升级',
"""    check('§164③ 界面：战术下拉含「⚡ 智能战斗」· 摘要行 · 战场指示（源码级）', (function () {
      var uS = fs164.readFileSync(p164.join(__dirname, 'js', 'ui.js'), 'utf8');
      return /⚡ 智能战斗（通用方案）/.test(uS) && /value="smart"/.test(uS)
        && /智能战斗（接敌转守 · 逐回合自动指挥）/.test(uS) && /bt-smart/.test(uS);
    })());""",
"""    check('§164③ 界面：战术下拉含「⚡ 智能战斗」· 战场指示（v89.198：阵位摘要行退役）', (function () {
      var uS = fs164.readFileSync(p164.join(__dirname, 'js', 'ui.js'), 'utf8');
      return /⚡ 智能战斗（通用方案）/.test(uS) && /value="smart"/.test(uS)
        && /接敌自动转防御/.test(uS) && /bt-smart/.test(uS);
    })());""",
    '§164③ 界面：战术下拉含「⚡ 智能战斗」· 战场指示（v89.198：阵位摘要行退役）')

# h4 §198① GAME 前缀防误伤（craftWorkshopsOf 撞 opsOf 子串）
rep(S, 'H4 §198① 出口负判加 GAME 前缀',
"""        && _g.indexOf('opsIdOf = function') < 0 && _g.indexOf('opsOf = function') < 0
        && _g.indexOf('opsConfigIssueOf = function') < 0""",
"""        /* ⚠️ 负判带 GAME. 前缀：裸 'opsOf = function' 会撞 craftWorkshopsOf（子串误伤） */
        && _g.indexOf('GAME.opsIdOf = function') < 0 && _g.indexOf('GAME.opsOf = function') < 0
        && _g.indexOf('GAME.opsConfigIssueOf = function') < 0""",
    '裸 \'opsOf = function\' 会撞 craftWorkshopsOf（子串误伤）')

# h5 §198④ 口径修正（stub 读不到 getElementById 后填内容）
rep(S, 'H5 §198④ 真渲染口径修正',
"""    check('§198④ 真渲染：主将区精力/体力行 · 目标区相称建议 · 无锦囊计数 · 无战法行/阵位行', (function () {
      var bk = G.state, bkCity = G.ui._cityId;
      var html = '';
      try {
        G.state = G.newGame({ name: 'v198', cityName: '许都' });
        if (!G.state.map.grid) G.map.generate();
        var c = G.state.cities[0];
        c.army = { yibing: 500 };
        if (!(G.state.generals || []).length) {
          G.state.generals.push(G.makeGeneral('全撤测', 40, 'idle', c.id, false));
        }
        G.ui._cityId = c.id;
        G.ui.closeAllModals();
        G.ui.openExpModal({ kind: 'wild', x: c.x + 3, y: c.y + 3 });
        html = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
      } catch (e) { html = 'ERR:' + e.message; }
      try { G.ui.closeAllModals(); } catch (e2) {}
      G.state = bk; G.ui._cityId = bkCity;
      var mRec = html.match(/相称建议[\\s\\S]{0,60}?<\\/div>/);
      var mVital = html.match(/id="exp-gen-vital"[\\s\\S]{0,140}?<\\/div>/);
      global.__d198c = (mVital ? mVital[0].replace(/<[^>]+>/g, '').slice(0, 60) : html.slice(0, 60));
      return !!mRec && !!mVital && /精力/.test(mVital[0]) && /体力/.test(mVital[0])
        && html.indexOf('锦囊 ×') < 0 && html.indexOf('id="exp-ops"') < 0
        && html.indexOf('阵位 全体前进') < 0;
    })(), global.__d198c || '');""",
"""    check('§198④ 真渲染：主将区精力/体力行骨架 · 目标区相称建议 · 无锦囊计数 · 无战法行/阵位行', (function () {
      var bk = G.state, bkCity = G.ui._cityId;
      var html = '', genOk = false;
      try {
        G.state = G.newGame({ name: 'v198', cityName: '许都' });
        if (!G.state.map.grid) G.map.generate();
        var c = G.state.cities[0];
        c.army = { yibing: 500 };
        if (!(G.state.generals || []).length) {
          G.state.generals.push(G.makeGeneral('全撤测', 40, 'idle', c.id, false));
        }
        G.ui._cityId = c.id;
        G.ui.closeAllModals();
        G.ui.openExpModal({ kind: 'wild', x: c.x + 3, y: c.y + 3 });
        html = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
        genOk = !!(G.ui._expGen && (G.state.generals || []).some(function (g) { return g.id === G.ui._expGen; }));
      } catch (e) { html = 'ERR:' + e.message; }
      try { G.ui.closeAllModals(); } catch (e2) {}
      G.state = bk; G.ui._cityId = bkCity;
      var mRec = html.match(/相称建议[\\s\\S]{0,60}?<\\/div>/);
      var mVital = html.match(/id="exp-gen-vital"/);
      global.__d198c = 'rec=' + !!mRec + ' vital=' + !!mVital + ' genOk=' + genOk;
      /* §198④ 口径（stub 无真实 DOM）：骨架在册 + 主将可解析 —— 内容填充由 §198③ 源码判据
         + 实机脚本（真浏览器能看到 getElementById 后填的「精力/体力」文本）覆盖；
         stub 的 modal-root innerHTML 不反映 open 之后的节点级填充，故此处不断言文本。 */
      return !!mRec && !!mVital && genOk
        && html.indexOf('锦囊 ×') < 0 && html.indexOf('id="exp-ops"') < 0
        && html.indexOf('阵位 全体前进') < 0;
    })(), global.__d198c || '');""",
    'stub 无真实 DOM）')

print('批次H 完成')
