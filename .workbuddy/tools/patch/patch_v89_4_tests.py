# -*- coding: utf-8 -*-
"""v89.4 测试 —— smoke（找格升级 + §78）+ e2e（找格升级 + 荒僻/有事格新块）

理念：活动变为「逐地概率分布」后，测试不能再"随便找一块地形格"，
必须扫「该格确有该活动」的格子 —— 这是概率型玩法落地后测试的通用升级法。
"""
import io

applied = []

def patch_file(P, edits):
    d = io.open(P, encoding='utf-8', newline='').read()
    for tag, old, new in edits:
        if new in d:
            print('SKIP', tag)
            continue
        c = d.count(old)
        if c != 1:
            raise SystemExit('!! %s 锚点异常（出现 %d 次）' % (tag, c))
        d = d.replace(old, new, 1)
        applied.append(tag)
        print('OK', tag)
    io.open(P, 'w', encoding='utf-8', newline='').write(d)

SCAN = """    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === '%s' && !GAME.map.fortAt(xx, yy)) { p = { x: xx, y: yy }; break; }
      }
    }"""

def scan_new(ter, act):
    return ("""    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && tl.terrain === '%s' && !GAME.map.fortAt(xx, yy)
            && GAME.jianghuActsAt(xx, yy).some(function (k) { return k.id === '%s'; })) { p = { x: xx, y: yy }; break; }
      }
    }""" % (ter, act))

# ================= smoke =================
PS = r'E:\Deepseekdb\smoke-test.js'
smoke_edits = [

    ('S1 jianghuCands',
     "      var scs = GAME.jianghuActsAt(t).filter(function (x) { return x.def.kind === 'scene'; });",
     "      var scs = GAME.jianghuCands(t).filter(function (x) { return x.def.kind === 'scene'; });"),

    ('S2 hill_scene 找格',
     SCAN % 'hill' + "\n    if (!p) { hill.outcomes.forEach(function (o, i) { o.w = bakW[i]; }); return false; }",
     scan_new('hill', 'hill_scene') + "\n    if (!p) { hill.outcomes.forEach(function (o, i) { o.w = bakW[i]; }); return false; }"),

    ('S3 forest/xiu 找格',
     SCAN % 'forest' + "\n    if (!p) return false;\n    if (s.jianghu) delete s.jianghu[p.x + ',' + p.y + '|xiu'];",
     scan_new('forest', 'xiu') + "\n    if (!p) return false;\n    if (s.jianghu) delete s.jianghu[p.x + ',' + p.y + '|xiu'];"),

    ('S4 forest/cai 找格（非君主）',
     SCAN % 'forest' + "\n    if (!p) return false;\n    return okBag && !GAME.jianghuDo(p.x, p.y, ng.id, 'cai').ok && !GAME.sceneStart(p.x, p.y, ng.id, 'cai').ok;",
     scan_new('forest', 'cai') + "\n    if (!p) return false;\n    return okBag && !GAME.jianghuDo(p.x, p.y, ng.id, 'cai').ok && !GAME.sceneStart(p.x, p.y, ng.id, 'cai').ok;"),

    ('S5 forest/cai 找格（三段引擎）',
     SCAN % 'forest' + "\n    if (!p) return false;\n    s.jianghu = {};\n    lg.energy = 100; GAME.setStaNow(lg, 100);\n    var st0 = GAME.sceneStart(p.x, p.y, lg.id, 'cai');",
     scan_new('forest', 'cai') + "\n    if (!p) return false;\n    s.jianghu = {};\n    lg.energy = 100; GAME.setStaNow(lg, 100);\n    var st0 = GAME.sceneStart(p.x, p.y, lg.id, 'cai');"),

    ('S6 hill/tao 找格（可复现）',
     SCAN % 'hill' + "\n    if (!p) return false;\n    var run = function (picks) {",
     scan_new('hill', 'tao') + "\n    if (!p) return false;\n    var run = function (picks) {"),

    ('S7 hill/tao 找格（§76）',
     SCAN % 'hill' + "\n    if (!p) return false;\n    s2.jianghu = {};",
     scan_new('hill', 'tao') + "\n    if (!p) return false;\n    s2.jianghu = {};"),
]

ANCHOR_S = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
BLOCK78 = r"""console.log('\n===== 78. v89.4 野地生态（逐地分布 · 概率出现 · 等级联动） =====');
(function () {
  var sS4 = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'state.js'), 'utf8');

  console.log('  --- ① 逐地分布（确定性 · 概率 · 逐地不同） ---');
  check('v89.4：DATA.JH_SPREAD 齐全（荒僻率 / 两档 / 三系数）', (function () {
    var sp = DATA.JH_SPREAD;
    return !!sp && sp.noneP > 0 && sp.noneP < 1 && sp.p2 > sp.noneP && sp.p3 > sp.p2 && sp.p3 < 1
      && sp.lvNeed > 0 && sp.lvDmg > 0 && sp.lvRew > 0;
  })());
  check('v89.4：分布是坐标的确定性函数（同格恒同貌 · 组合各异）', (function () {
    var same = true, a = null, b = null;
    for (var yy = 3; yy < 60; yy += 7) {
      for (var xx = 3; xx < 60; xx += 7) {
        var k1 = GAME.jianghuActsAt(xx, yy).map(function (k) { return k.id; }).join(',');
        var k2 = GAME.jianghuActsAt(xx, yy).map(function (k) { return k.id; }).join(',');
        if (k1 !== k2) same = false;
        if (k1) { if (a === null) a = k1; else if (k1 !== a) b = k1; }
      }
    }
    return same && a !== null && b !== null && a !== b;
  })());
  check('v89.4：概率分布成立（0/1/2/3 事皆存在 · 荒僻率 ~30% · 上限 3）', (function () {
    var cnt = { 0: 0, 1: 0, 2: 0, 3: 0 }, tot = 0, bad = 0;
    for (var yy = 3; yy < 120; yy += 3) {
      for (var xx = 3; xx < 120; xx += 3) {
        var tl = GAME.map.tile(xx, yy);
        if (!tl || GAME.map.fortAt(xx, yy)) continue;
        if (GAME.jianghuCands(tl.terrain).length === 0) continue;
        var n = GAME.jianghuActsAt(xx, yy).length;
        tot++;
        if (n > 3) bad++;
        cnt[n] = (cnt[n] || 0) + 1;
      }
    }
    return bad === 0 && tot > 300 && cnt[0] > 0 && cnt[1] > 0 && cnt[2] > 0 && cnt[3] > 0
      && cnt[0] / tot > 0.2 && cnt[0] / tot < 0.42;
  })());
  check('v89.4：候选约束（返回活动的地形全含本格地形）', (function () {
    var okAll = true;
    for (var yy = 3; yy < 90; yy += 5) {
      for (var xx = 3; xx < 90; xx += 5) {
        var tl = GAME.map.tile(xx, yy);
        if (!tl) continue;
        GAME.jianghuActsAt(xx, yy).forEach(function (k) {
          if (!k.def.spots || k.def.spots.indexOf(tl.terrain) < 0) okAll = false;
        });
      }
    }
    return okAll;
  })());

  console.log('  --- ② 闸门（无此事之格 / 荒僻格不可行） ---');
  check('v89.4：无此事之格被拒（随缘而现）· 有此事之格放行', (function () {
    var lg = GAME.lordGeneralOf();
    var no = null, yes = null;
    for (var yy = 3; yy < 200 && (!no || !yes); yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (!tl || tl.terrain !== 'hill' || GAME.map.fortAt(xx, yy)) continue;
        var has = GAME.jianghuActsAt(xx, yy).some(function (k) { return k.id === 'tao'; });
        if (!has && !no) no = { x: xx, y: yy };
        if (has && !yes) yes = { x: xx, y: yy };
      }
    }
    if (!no || !yes) return false;
    GAME.state.jianghu = {};
    lg.energy = 100; GAME.setStaNow(lg, 100);
    var r1 = GAME.jianghuCheck(no.x, no.y, lg.id, 'tao');
    var r2 = GAME.jianghuCheck(yes.x, yes.y, lg.id, 'tao');
    return !r1.ok && /随缘而现/.test(r1.msg || '') && r2.ok === true;
  })());
  check('v89.4：荒僻格（0 事）—— 全部候选被拒 + UI 空态，且等级行仍在', (function () {
    var lg = GAME.lordGeneralOf();
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && !GAME.map.fortAt(xx, yy) && GAME.jianghuActsAt(xx, yy).length === 0
            && GAME.jianghuCands(tl.terrain).length > 0) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    GAME.state.jianghu = {};
    lg.energy = 100; GAME.setStaNow(lg, 100);
    var blocked = GAME.jianghuCands(GAME.map.tile(p.x, p.y).terrain).every(function (k) {
      return !GAME.jianghuCheck(p.x, p.y, lg.id, k.id).ok;
    });
    var h4 = GAME.ui.jianghuHTML(p.x, p.y);
    return blocked && h4.indexOf('荒僻') >= 0 && h4.indexOf('野地 Lv') >= 0;
  })());
  check('v89.4：UI 等级行数字与公式一致（收益 ×（1+lv×lvRew））', (function () {
    var p = null;
    for (var yy = 3; yy < 200 && !p; yy++) {
      for (var xx = 3; xx < 200; xx++) {
        var tl = GAME.map.tile(xx, yy);
        if (tl && !GAME.map.fortAt(xx, yy) && GAME.jianghuCands(tl.terrain).length > 0) { p = { x: xx, y: yy }; break; }
      }
    }
    if (!p) return false;
    var lv4 = GAME.map.wildLevelNow(p.x, p.y);
    var h4 = GAME.ui.jianghuHTML(p.x, p.y);
    var m = h4.match(/收益 ×([\d.]+)/);
    return !!m && m[1] === (1 + lv4 * DATA.JH_SPREAD.lvRew).toFixed(1)
      && h4.indexOf('野地 Lv' + lv4) >= 0;
  })());

  console.log('  --- ③ 等级联动（难度 / 负伤 / 收益随 lv） ---');
  check('v89.4：收益随等级（同 seed · lv0 vs lv10 → ×4.00）', (function () {
    var lg = GAME.lordGeneralOf();
    var chk = { act: DATA.LING_ACT.xiu, gen: lg, day: 1, lv: 0, x: 11, y: 22, actId: 'xiu' };
    var m0 = (GAME.jianghuRoll(chk).text || '').match(/灵气精华 \+(\d+)/);
    chk.lv = 10;
    var m1 = (GAME.jianghuRoll(chk).text || '').match(/灵气精华 \+(\d+)/);
    return !!m0 && !!m1 && Number(m1[1]) === Math.round(Number(m0[1]) * 4);
  })());
  check('v89.4：三系数接线（源码：lvN / lvR / lvW + lvN 进难度）', (function () {
    return sS4.indexOf('var lvN = 1 + lv * (sp4.lvNeed || 0);') >= 0
      && sS4.indexOf('var lvR = 1 + lv * (sp4.lvRew || 0);') >= 0
      && sS4.indexOf('var lvW = 1 + lv * (sp4.lvDmg || 0);') >= 0
      && sS4.indexOf('var need = a.power * lvN;') >= 0
      && sS4.indexOf('a.power * lvN * (1 + (i - 1) * 0.45)') >= 0
      && sS4.indexOf('GAME.jianghuCands = function') >= 0;
  })());
})();

"""
smoke_edits.append(('S8 §78 插入', ANCHOR_S, BLOCK78 + ANCHOR_S))
patch_file(PS, smoke_edits)

# ================= e2e =================
PE = r'E:\Deepseekdb\e2e-test.js'
e2e_edits = [

    ('E1 hill_scene 找格',
     """    let hp = null;
    for (let y = 3; y < 200 && !hp; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) { hp = { x, y }; break; }
      }
    }""",
     """    let hp = null;
    for (let y = 3; y < 200 && !hp; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'hill_scene')) { hp = { x, y }; break; }
      }
    }"""),

    ('E2a forest/xiu 找格',
     """    let fp88 = null;
    for (let y = 3; y < 200 && !fp88; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'forest' && !G.map.fortAt(x, y)) { fp88 = { x, y }; break; }
      }
    }""",
     """    let fp88 = null;
    for (let y = 3; y < 200 && !fp88; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'forest' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'xiu')) { fp88 = { x, y }; break; }
      }
    }"""),

    ('E2b 按钮数断言',
     """    check('v88：野地弹窗含江湖区块（活动按钮 ≥3）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && root.querySelectorAll('[data-action="do-jianghu"]').length >= 3;
    })());""",
     """    check('v88/v89.4：野地弹窗含江湖区块（按钮数 = 逐地分布 1~3）', (function () {
      const root = document.querySelector('#modal-root');
      const n4 = G.jianghuActsAt(fp88.x, fp88.y).length;
      return !!root && root.textContent.indexOf('江湖游历') >= 0
        && n4 >= 1 && n4 <= 3
        && root.querySelectorAll('[data-action="do-jianghu"]').length === n4;
    })());"""),

    ('E3 hill/tao 找格',
     """    let hp89 = null;
    for (let y = 3; y < 200 && !hp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) { hp89 = { x, y }; break; }
      }
    }""",
     """    let hp89 = null;
    for (let y = 3; y < 200 && !hp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'tao')) { hp89 = { x, y }; break; }
      }
    }"""),

    ('E4 desert_scene 找格',
     """    let fp89 = null;
    for (let y = 3; y < 200 && !fp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'desert' && !G.map.fortAt(x, y)) { fp89 = { x, y }; break; }
      }
    }""",
     """    let fp89 = null;
    for (let y = 3; y < 200 && !fp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'desert' && !G.map.fortAt(x, y)
            && G.jianghuActsAt(x, y).some(k => k.id === 'desert_scene')) { fp89 = { x, y }; break; }
      }
    }"""),

    ('E5 荒僻/有事格新块',
     "  await sleep(30);\n\n  G.ui.setView('city');",
     """  await sleep(30);

  /* v89.4：野地生态（荒僻空态 · 有事格 1~3 · 等级收益行） */
  {
    let wp4 = null;
    for (let y = 3; y < 200 && !wp4; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && !G.map.fortAt(x, y) && G.jianghuActsAt(x, y).length === 0
            && G.jianghuCands(tl.terrain).length > 0) { wp4 = { x, y }; break; }
      }
    }
    if (wp4) {
      G.ui.openLandModal(wp4.x, wp4.y);
      await sleep(200);
      check('v89.4：荒僻野地 —— 游历区块空态（随缘而现）', (function () {
        const root = document.querySelector('#modal-root');
        return !!root && root.textContent.indexOf('荒僻') >= 0
          && root.textContent.indexOf('野地 Lv') >= 0;
      })());
      G.ui.closeModal();
      await sleep(80);
    } else {
      check('v89.4：荒僻野地 —— 游历区块空态（随缘而现）', false);
    }

    let yp4 = null, yn4 = 0;
    for (let y = 3; y < 200 && !yp4; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) {
          const n4 = G.jianghuActsAt(x, y).length;
          if (n4 >= 2) { yp4 = { x, y }; yn4 = n4; break; }
        }
      }
    }
    G.state.jianghu = {};
    if (yp4) {
      G.ui.openLandModal(yp4.x, yp4.y);
      await sleep(200);
      check('v89.4：有事格 —— 按钮数=分布数（1~3）· 等级收益行在', (function () {
        const root = document.querySelector('#modal-root');
        const btns = root.querySelectorAll('[data-action="do-jianghu"]').length;
        return btns === yn4 && btns <= 3
          && root.textContent.indexOf('野地 Lv') >= 0
          && root.textContent.indexOf('收益 ×') >= 0;
      })());
      G.ui.closeModal();
      await sleep(80);
    } else {
      check('v89.4：有事格 —— 按钮数=分布数（1~3）· 等级收益行在', false);
    }
  }

  G.ui.setView('city');"""),
]
patch_file(PE, e2e_edits)

print('测试补丁完成：应用 %d 处' % len(applied))
