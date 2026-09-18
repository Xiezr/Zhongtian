# -*- coding: utf-8 -*-
"""v89.31 测试补丁：smoke（引擎 + 接线）· e2e（战事触发链 + 动作触发块）"""
import io
import os
import sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(R + '\\' + p, encoding='utf-8', newline='').read()


def write(p, src):
    full = R + '\\' + p
    tmp = full + '.tmp8931t'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, full)


def nl_of(src):
    return '\r\n' if '\r\n' in src[:4000] else '\n'


def edit(p, pairs, tag):
    src = read(p)
    nl = nl_of(src)
    for old, new, name in pairs:
        o2 = old.replace('\n', nl)
        n2 = new.replace('\n', nl)
        c = src.count(o2)
        if c != 1:
            print('FAIL [%s -> %s] 命中 %d 次' % (tag, name, c))
            sys.exit(1)
        src = src.replace(o2, n2, 1)
    write(p, src)
    back = read(p)
    for old, new, name in pairs:
        assert new.replace('\n', nl) in back, '%s / %s 回查失败' % (tag, name)
    print('OK  ' + tag)


# ================================================================
# 1) smoke-test.js
# ================================================================
SMOKE_OLD = """    return okTag && okBook;
  })());


})();"""

SMOKE_NEW = """    return okTag && okBook;
  })());

  /* v89.31：动作触发（逸闻奇遇 · 因果线）—— 14 动作键 · 相关建筑池 · 动态池 · 掷骰三态 */
  check('故事库：动作触发引擎（14 动作键 · 相关建筑池 · 动态池 · 掷骰三态）', (function () {
    var T = GAME.SG.TRIG;
    if (!T || !GAME.SG.ACT || typeof GAME.SG.rollAct !== 'function'
        || typeof GAME.SG.actPool !== 'function' || typeof GAME.SG.preferRows !== 'function') return false;
    if (!(T.actCooldownMs > 0) || !T._actAt) return false;
    var keys = ['battle-win', 'battle-lose', 'occupy-city', 'occupy-wild', 'build-done',
                'train-done', 'tech-done', 'heal-wounded', 'recruit-hero', 'market-trade',
                'gather-done', 'move-city', 'build-city', 'promote'];
    var ctxAll = { id: 'junying', type: 'build', terrain: 'hill', cityType: 'county' };
    var okK = true;
    keys.forEach(function (k) {
      var p = GAME.SG.actPool(k, ctxAll);
      if (!p.total || !(p.act && p.act.chance > 0 && p.act.chance <= 1)) okK = false;
    });
    if (!okK) return false;
    var anchorsOf = function (p) {
      return p.fresh.concat(p.done).map(function (r) { return (r.st.anchor || {}).kind + '/' + (r.st.anchor || {}).id; });
    };
    /* 相关建筑核验：战事池 6 座军务建筑齐备（军营/校场/城墙/烽火台/马厩/驿站） */
    var pw = GAME.SG.actPool('battle-win');
    var aW = anchorsOf(pw);
    var okA = ['building/junying', 'building/xiaochang', 'building/chengqiang',
               'building/fenghuotai', 'building/majiu', 'building/yizhan']
      .every(function (x) { return aW.indexOf(x) >= 0; });
    /* 动态池：占城（按档）· 据地（按地形）· 营造（按建筑/城外/城墙） */
    var aC = anchorsOf(GAME.SG.actPool('occupy-city', { type: 'zhou' }));
    var okC = aC.indexOf('city/zhou') >= 0 && aC.indexOf('building/guanfu') >= 0 && aC.indexOf('building/honglusi') >= 0;
    var aW2 = anchorsOf(GAME.SG.actPool('occupy-wild', { terrain: 'lake' }));
    var okW = aW2.indexOf('wild/lake') >= 0 && aW2.indexOf('building/fenghuotai') >= 0;
    var aB = anchorsOf(GAME.SG.actPool('build-done', { id: 'junying', type: 'build' }));
    var aB2 = anchorsOf(GAME.SG.actPool('build-done', { id: 'farm', type: 'ext_build' }));
    var aB3 = anchorsOf(GAME.SG.actPool('build-done', { id: 'wall', type: 'wall' }));
    var okB = aB.indexOf('building/junying') >= 0 && aB.indexOf('building/gongjiangzuofang') >= 0
      && aB2.indexOf('ext/farm') >= 0 && aB3.indexOf('building/chengqiang') >= 0;
    if (!(okA && okC && okW && okB)) return false;
    /* prefer 收窄：只减不增；命中档要么全带标签、要么原样返回 */
    var narrow = GAME.SG.preferRows(pw.fresh, GAME.SG.ACT['battle-win']);
    var pref = GAME.SG.ACT['battle-win'].prefer;
    var hasHit = function (r) {
      var tg = r.st.tags || [];
      for (var i = 0; i < tg.length; i++) if (pref.indexOf(tg[i]) >= 0) return true;
      return false;
    };
    var okP = narrow.length <= pw.fresh.length
      && (narrow.length === pw.fresh.length || narrow.every(hasHit));
    /* 掷骰三态：pin 必中 · 同类冷却 · 空池 */
    var keepRng = T.rng, keepPin = T.pin, keepAt = T._actAt;
    var ok = true;
    var e0 = GAME.SG.rollAct('__none__');
    ok = ok && e0.fire === false && e0.why === 'empty';
    var pinSid = (pw.fresh[0] || pw.done[0]).st.id;
    T._actAt = {}; T.pin = pinSid;
    var e1 = GAME.SG.rollAct('battle-win');
    ok = ok && e1.fire === true && e1.sid === pinSid;
    var e2 = GAME.SG.rollAct('battle-win');
    ok = ok && e2.fire === false && e2.why === 'cool';
    T._actAt = {}; T.pin = null; T.rng = function () { return 0.999; };
    var e3 = GAME.SG.rollAct('battle-win');
    ok = ok && e3.fire === false && e3.why === 'roll';
    T._actAt = {}; T.rng = function () { return 0; };
    var e4 = GAME.SG.rollAct('battle-win');
    ok = ok && e4.fire === true && !!e4.sid;
    T.rng = keepRng; T.pin = keepPin; T._actAt = keepAt;
    return okP && ok;
  })());

  /* v89.31：动作接线（引擎回调 ×6 · 桥 · 界面动作 ×10 · sgTryAct 出口） */
  check('故事库：动作触发接线（营造/训练/研习回调 · 战事与民生挂点 · 引擎桥）', (function () {
    var fs = require('fs'), path = require('path');
    var S = fs.readFileSync(path.join(__dirname, 'js', 'state.js'), 'utf8');
    var M = fs.readFileSync(path.join(__dirname, 'js', 'main.js'), 'utf8');
    var U = fs.readFileSync(path.join(__dirname, 'js', 'ui.js'), 'utf8');
    var nS = (S.match(/GAME\\.onActionDone/g) || []).length;
    var nM = (M.match(/sgTryAct\\(/g) || []).length;
    return nS >= 6 && nM >= 11
      && M.indexOf('GAME.onActionDone = function') >= 0
      && U.indexOf('ui.sgTryAct = function') >= 0
      && S.indexOf('GAME.SG.rollAct = function') >= 0;
  })());


})();"""

edit('smoke-test.js', [(SMOKE_OLD, SMOKE_NEW, '§81 追加两条')], 'smoke-test.js')

# ================================================================
# 2) e2e-test.js —— 行军块扩展
# ================================================================
E2E_MARCH_OLD = """      /* 再出发一次 → 用真实主循环推进到抵达 */
      c23.army = Object.assign({}, c23.army, { yibing: 20000 });
      const gen2 = G.state.generals.filter((g) => g.id !== g23.id)[0] || g23;
      gen2.stamina = 100; gen2.energy = 100;
      const r23b = G.march.dispatch({ kind: 'wild', x: w23.x, y: w23.y }, 'raid', { yibing: 20000 }, gen2.id);
      if (r23b.ok) {
        await sleep(60);
        let n = 0;
        while (G.state.marches.length && n < 120) { G.tickOnce(); n++; await sleep(8); }
        check('主循环推进后大军抵达', G.state.marches.length === 0, '推进 ' + n + ' tick');
        /* 断言「没有凭空消失」：幸存者回城 + 伤兵入营，二者之和必须 > 0
           （全歼时幸存者为 0 是正常的，不能据此判定失败） */
        check('抵达后兵力去向明确（幸存归营 / 阵亡入伤兵营）',
          G.armyTotal(c23) + (G.state.wounded || 0) > 0,
          '归营 ' + G.armyTotal(c23) + ' · 伤兵 ' + (G.state.wounded || 0));
        check('抵达后将领恢复空闲', G.state.generals.every((g) => g.status !== 'march'));
      }"""

E2E_MARCH_NEW = """      /* 再出发一次 → 用真实主循环推进到抵达 */
      c23.army = Object.assign({}, c23.army, { yibing: 20000 });
      const gen2 = G.state.generals.filter((g) => g.id !== g23.id)[0] || g23;
      gen2.stamina = 100; gen2.energy = 100;
      /* v89.31：战事奇遇 —— pin 取「胜/败两池交集」指定必中（无论胜负都能命中） */
      const _pw31 = G.SG.actPool('battle-win');
      const _pl31 = G.SG.actPool('battle-lose');
      const _set31 = {};
      _pl31.fresh.concat(_pl31.done).forEach((r) => { _set31[r.st.id] = 1; });
      const _ov31 = _pw31.fresh.concat(_pw31.done).filter((r) => _set31[r.st.id]);
      const _pin31 = ((_ov31[0] || _pw31.fresh[0] || _pw31.done[0]).st || {}).id;
      G.SG.TRIG.pin = _pin31; G.SG.TRIG._actAt = {};
      const r23b = G.march.dispatch({ kind: 'wild', x: w23.x, y: w23.y }, 'raid', { yibing: 20000 }, gen2.id);
      if (r23b.ok) {
        await sleep(60);
        let n = 0;
        while (G.state.marches.length && n < 120) { G.tickOnce(); n++; await sleep(8); }
        check('主循环推进后大军抵达', G.state.marches.length === 0, '推进 ' + n + ' tick');
        /* 断言「没有凭空消失」：幸存者回城 + 伤兵入营，二者之和必须 > 0
           （全歼时幸存者为 0 是正常的，不能据此判定失败） */
        check('抵达后兵力去向明确（幸存归营 / 阵亡入伤兵营）',
          G.armyTotal(c23) + (G.state.wounded || 0) > 0,
          '归营 ' + G.armyTotal(c23) + ' · 伤兵 ' + (G.state.wounded || 0));
        check('抵达后将领恢复空闲', G.state.generals.every((g) => g.status !== 'march'));
        /* v89.31：战事触发链（抵达结算 → 相关建筑池开卷 → 掩卷） */
        const fx31 = document.querySelector('#story-fx');
        check('★ v89.31：战事触发 · 抵达后开卷（相关建筑池 · ' + _pin31 + '）',
          !!fx31 && fx31.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === _pin31);
        const ex31 = fx31 && fx31.querySelector('[data-action="story-exit"]');
        if (ex31) { click(ex31); await sleep(30); }
        check('★ v89.31：战事触发 · 掩卷收起', !!fx31 && fx31.style.display === 'none');
        G.SG.TRIG.pin = null; G.SG.TRIG._actAt = {};
      }"""

E2E_BLOCKF_OLD = """      check('★ ' + tag9 + '：进度入档 · 掩卷收起（' + sid9 + '）',
        save9 && fx.style.display === 'none');
    }
    /* 收尾：恢复测试默认（随机永不触发） */
    sgOff89();"""

E2E_BLOCKF_NEW = """      check('★ ' + tag9 + '：进度入档 · 掩卷收起（' + sid9 + '）',
        save9 && fx.style.display === 'none');
    }

    /* 块 F：动作触发（v89.31）—— 动作完成 → 相关建筑池 → 开卷 / 默认阈值不打扰 */
    var pF1 = G.SG.actPool('tech-done');
    var pinF1 = (pF1.fresh[0] || pF1.done[0]).st.id;
    sgPin89(pinF1); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.31：动作触发 · 研习完成 → 相关建筑池开卷（' + pinF1 + '）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === pinF1);
    var exF1 = fx.querySelector('[data-action="story-exit"]');
    if (exF1) { click(exF1); await sleep(30); }
    check('★ v89.31：动作触发 · 掩卷收起', fx.style.display === 'none');
    sgOff89(); G.SG.TRIG._actAt = {};
    G.onActionDone('train-done');
    await sleep(30);
    check('★ v89.31：动作触发 · 默认阈值下不打扰（rng 恒 0.999）', fx.style.display === 'none');

    /* 收尾：恢复测试默认（随机永不触发） */
    sgOff89();"""

edit('e2e-test.js', [
    (E2E_MARCH_OLD, E2E_MARCH_NEW, '行军块扩展'),
    (E2E_BLOCKF_OLD, E2E_BLOCKF_NEW, '块 F'),
], 'e2e-test.js')

print('ALL OK')
