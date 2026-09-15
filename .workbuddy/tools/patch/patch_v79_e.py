# -*- coding: utf-8 -*-
"""v79-E · 测试新增：smoke §64（v79 四条）+ e2e v79 真实 DOM 段。"""
import io
import sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E = r'E:\Deepseekdb\e2e-test.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== S. smoke §64 ==')
SEC64 = """  /* ============================================================
   * ===== 64. v79：爵位加成 / 主城 / 神器 / 装备单件化（老板四条） =====
   * ============================================================ */
  console.log('\\n===== 64. v79 四条（爵位加成 · 主城 · 神器 · 装备单件化） =====');
  (function () {
    var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
    var dS = stripComment(rd('data'));
    var stS = stripComment(rd('state'));
    var domS = stripComment(rd('domain'));
    var sysS = stripComment(rd('systems'));
    var uS = stripComment(rd('ui'));
    var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');

    /* ---------- ① 爵位加成 ---------- */
    console.log('  --- ① 爵位加成（22 级曲线 · 六项消费点） ---');
    check('数据：RANK_BONUS 与 RANK 同序同长，六项齐全', (function () {
      var B = DATA.RANK_BONUS || [];
      return B.length === DATA.RANK.length && B.every(function (b) {
        return ['prodPct', 'taxPct', 'storePct', 'buildSlot', 'wildCap', 'genCap'].every(function (k) { return b[k] != null; });
      });
    })());
    check('数据：曲线逐级递增（产/税 +1%/级、储 +2%/级；Lv8 起建造 +1、Lv16 起 +2）', (function () {
      var B = DATA.RANK_BONUS;
      return B[0].prodPct === 0 && B[21].prodPct === 0.21 && B[21].storePct === 0.42
        && B[8].buildSlot === 1 && B[16].buildSlot === 2 && B[21].wildCap === 7 && B[21].genCap === 5;
    })());
    check('实测：爵位加成真的进经营（产/税 同口径并入 cityBonusNum）', (function () {
      var st64 = G.state;
      var bk = st64.rank;
      var city = G.currentCity();
      st64.rank = 0;
      var p0 = G.cityBonusNum(city, 'prodPct'), t0 = G.cityBonusNum(city, 'taxPct');
      st64.rank = 20;
      var p1 = G.cityBonusNum(city, 'prodPct'), t1 = G.cityBonusNum(city, 'taxPct');
      st64.rank = bk;
      return p1 > p0 && t1 > t0 && Math.abs((p1 - p0) - 0.20) < 1e-9;
    })());
    check('实测：爵位加成进仓储与席位（storeCapOf / genSlotsOf 同口径）', (function () {
      var st64 = G.state, city = G.currentCity(), bk = st64.rank;
      st64.rank = 0;
      var s0 = G.storeCapOf(city), g0 = G.genSlotsOf(city);
      st64.rank = 21;
      var s1 = G.storeCapOf(city), g1 = G.genSlotsOf(city);
      st64.rank = bk;
      return s1 > s0 && g1 > g0;
    })());
    check('结构：爵位加成消费只走 cityBonusNum（唯一汇总口）', (function () {
      return /GAME\\.rankBonusNum = function/.test(stS)
        && /rankBonusNum\\(key\\)/.test(codeOf(stS, 'GAME.cityBonusNum = function'))
        && /rankBonusText/.test(stS);
    })());
    check('界面：爵位表显示「加成」列（食邑死列退役）',
      /rankBonusText\\(i\\)/.test(uS) && uS.indexOf('<th>食邑</th>') < 0);

    /* ---------- ② 主城 ---------- */
    console.log('  --- ② 主城（设置 · 标识 · 驻跸加成） ---');
    check('数据：MAIN_CITY 五项驻跸加成 + 迁都成本', (function () {
      var M = DATA.MAIN_CITY;
      return M && M.bonus.prodPct === 0.15 && M.bonus.taxPct === 0.10 && M.bonus.storePct === 0.30
        && M.bonus.genCap === 1 && M.bonus.wildCap === 1 && M.moveCost.gold > 0;
    })());
    check('实测：首设免费、迁都收费（黄金扣减、主城易位）', (function () {
      var st64 = G.newGame({ name: '主城验收', region: '司隶' });
      var c1 = st64.cities[0];
      st64.cities.push(G.makeCity({ id: 'mc2', name: '陪都', x: c1.x + 2, y: c1.y + 2 }));
      var c2 = G.cityById('mc2');
      if (!c2) return false;
      st64.res.gold = 500000;
      var r1 = G.setMainCity(c1.id);
      var g1 = st64.res.gold;
      var r2 = G.setMainCity(c2.id);
      var g2 = st64.res.gold;
      return r1.ok && g1 === 500000 && r2.ok && g2 === 500000 - DATA.MAIN_CITY.moveCost.gold
        && G.isMainCity(c2) && !G.isMainCity(c1);
    })());
    check('实测：驻跸加成只对本城生效（他城不吃）', (function () {
      var st64 = G.state, mc = G.mainCityOf();
      var other = null;
      if (!mc) return false;
      st64.cities.forEach(function (c) { if (!other && c.id !== mc.id) other = c; });
      var ok = other && G.mainCityBonusNum(mc, 'prodPct') > 0 && G.mainCityBonusNum(other, 'prodPct') === 0;
      st64.mainCityId = null;   /* 复原（不污染后续） */
      return ok;
    })());
    check('界面：城名后有【主城】标识（cityLabelHTML 唯一出口）',
      /city-tier mt">主城/.test(uS) && /isMainCity/.test(uS));
    check('界面：官府有「设为主城」入口 + 主分发在位',
      /data-action="set-main-city"/.test(uS) && /set-main-city/.test(rd('main')));

    /* ---------- ③ 神器 ---------- */
    console.log('  --- ③ 神器（供奉养成 · 时长 + 活动） ---');
    check('数据：三件神器 · 门槛 10 档 · 时长收益与活动收益齐备', (function () {
      return (DATA.ARTIFACTS || []).length === 3 && DATA.ARTIFACT.pts.length === 10
        && DATA.ARTIFACT.perGameHour > 0 && DATA.ARTIFACT.capturePts.county > 0 && DATA.ARTIFACT.promotePts > 0;
    })());
    check('实测：供奉值攒够 → 等级点亮（0 → Lv1 → Lv3）', (function () {
      var st64 = G.state;
      var bk = st64.artifacts;
      st64.artifacts = { pts: 0 };
      var l0 = G.artLevelOf();
      G.artGain(DATA.ARTIFACT.pts[0]);
      var l1 = G.artLevelOf();
      G.artGain(DATA.ARTIFACT.pts[2] - DATA.ARTIFACT.pts[0]);
      var l3 = G.artLevelOf();
      st64.artifacts = bk;
      return l0 === 0 && l1 === 1 && l3 === 3;
    })());
    check('实测：神器加成真的进经营（Lv10 = 产 +20% / 税 +20% / 仓储 40%）', (function () {
      var st64 = G.state;
      var bk = st64.artifacts;
      st64.artifacts = { pts: DATA.ARTIFACT.pts[9] };
      var p1 = G.artifactBonusNum('prodPct'), t1 = G.artifactBonusNum('taxPct');
      var cap1 = G.artifactBonusNum('storePct');
      st64.artifacts = bk;
      return Math.abs(p1 - 0.2) < 1e-9 && Math.abs(t1 - 0.2) < 1e-9 && Math.abs(cap1 - 0.4) < 1e-9;
    })());
    check('实测：时长链挂了供奉（在线 + 离线两处时间链）',
      /GAME\\.artTick\\(secReal \\* ts\\)/.test(stS) && /GAME\\.artTick\\(dtReal \\* ts\\)/.test(stS));
    check('实测：特殊活动给供奉（占城 + 晋升均有调用）',
      /GAME\\.artGain\\(/.test(rd('battle')) && /GAME\\.artGain\\(/.test(sysS));
    check('界面：神器面板在君主菜单（入口 + 面板 + 样式）',
      /data-action="open-artifacts"/.test(uS) && /ui\\.openArtifacts = function/.test(uS)
      && /\\.art-row \\{/.test(hS));

    /* ---------- ④ 装备单件化 ---------- */
    console.log('  --- ④ 装备单件化（按件强化 · 同名区分） ---');
    check('实测：同名两件各升各的（+2 / +0，互不影响）', (function () {
      var st64 = G.newGame({ name: '单件验收', region: '司隶' });
      var city = G.currentCity();
      var i64 = city.cells.findIndex(function (x) { return !x.build && !x.official; });
      if (i64 >= 0) city.cells[i64].build = { id: 'tiejiangpu', lvl: 3 };
      st64.res.gold = 1e8; st64.res.iron = 1e8; st64.res.stone = 1e8;
      var a = G.addEquip('cr_weapon_1'), b = G.addEquip('cr_weapon_1');
      var r1 = G.enhance(a.u), r2 = G.enhance(a.u);
      return r1.ok && r2.ok && G.enhOf(a) === 2 && G.enhOf(b) === 0
        && G.eqLabel(a) !== G.eqLabel(b);
    })());
    check('实测：同名序号 甲/乙 自动排（区分办法可见）', (function () {
      var g = G.eqGroupOf('cr_weapon_1');
      if (g.length < 2) return false;
      return /甲/.test(G.eqLabel(g[0])) && /乙/.test(G.eqLabel(g[1]));
    })());
    check('实测：装备加成只吃**穿在身上那一件**自己的强化级', (function () {
      var st64 = G.state;
      var g = st64.generals[0];
      var bk = g.equip;
      var x = G.addEquip('cr_weapon_1'); x.enh = 2;
      var y = G.addEquip('cr_weapon_1'); y.enh = 0;
      g.equip = { weapon: x };
      var bx = G.systems.genEquipBonus(g);
      g.equip = { weapon: y };
      var by = G.systems.genEquipBonus(g);
      g.equip = bk;
      [x, y].forEach(function (it) { var i = st64.inventory.indexOf(it); if (i >= 0) st64.inventory.splice(i, 1); });
      return bx.atk > by.atk;
    })());
    check('结构：实例模型工具齐备（eqId / eqEnhOf / eqLabel / eqSerial / eqFind / migrateEquipModel）',
      ['GAME.eqId = function', 'GAME.eqEnhOf = function', 'GAME.eqLabel = function', 'GAME.eqSerial = function',
        'GAME.eqFind = function', 'GAME.migrateEquipModel = function']
        .every(function (k) { return domS.indexOf(k) >= 0; }));
    check('实测：老档迁移（id 串 → 实例；旧按种强化并入首件）', (function () {
      var fake = {
        inventory: ['cr_weapon_1', 'cr_weapon_1'],
        generals: [{ id: 'x1', equip: { head: 'cr_head_1' } }],
        forgeEnh: { cr_weapon_1: 3, cr_head_1: 5 },
      };
      G.migrateEquipModel(fake);
      return typeof fake.inventory[0] === 'object' && fake.inventory[0].enh === 3
        && fake.inventory[1].enh === 0 && fake.inventory[0].u !== fake.inventory[1].u
        && typeof fake.generals[0].equip.head === 'object' && fake.generals[0].equip.head.enh === 5
        && fake.forgeEnh === undefined;
    })());
    check('结构：入包唯一出口（打造 / 缴获均走 GAME.addEquip）',
      /GAME\\.addEquip\\(itemId\\)/.test(domS) && /GAME\\.addEquip\\(id\\)/.test(rd('battle')));
    check('界面：强化面板按件列（同名各一行、按钮带件号）',
      /按件/.test(uS) && /GAME\\.eqLabel\\(inst\\)/.test(uS) && /data-action="enhance-item" data-item="' \\+ key/.test(uS));
    check('界面：装备详情单件视角（同种第 N 件）', /同种第/.test(uS));

  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
"""
patch(SMOKE,
"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();
""",
SEC64,
'S1 smoke §64')

print()
print('== E. e2e v79 段 ==')
E2E79 = """  /* ============================================================
   * v79（老板四条）：爵位加成 / 主城 / 神器 / 装备单件化 —— 真实 DOM 走一遍
   * ============================================================ */
  console.log('\\n--- v79. 爵位加成 · 主城 · 神器 · 单件强化（真实 DOM） ---');
  {
    /* ② 主城：官府里设 → 标识出现 */
    const c79 = G.currentCity();
    G.state.mainCityId = null;
    G.ui.openGuanfu();
    await sleep(150);
    const setBtn79 = document.querySelector('#modal-root [data-action="set-main-city"]');
    check('v79：官府有「设为主城」入口', !!setBtn79);
    if (setBtn79) {
      click(setBtn79);
      await sleep(160);
      check('v79：设定后主城标识出现（城名标注 / 城池下拉【主城】）',
        G.isMainCity(c79) && G.ui.cityLabelHTML(c79, true).indexOf('主城') >= 0
        && (!document.querySelector('.city-select')
          || document.querySelector('.city-select').innerHTML.indexOf('【主城】') >= 0));
      G.ui.closeModal();
      await sleep(80);
    }

    /* ③ 神器：君主菜单入口 → 面板 */
    G.ui.openLordInfo();
    await sleep(160);
    check('v79：君主面板有神器行与「查看」按钮',
      document.querySelector('#modal-root').innerHTML.indexOf('data-action="open-artifacts"') >= 0);
    const artBtn79 = document.querySelector('#modal-root [data-action="open-artifacts"]');
    if (artBtn79) {
      click(artBtn79);
      await sleep(170);
      const mh79 = document.querySelector('#modal-root').innerHTML;
      check('v79：神器面板三件神器 + 供奉值 + 进度条 + 来源说明',
        (mh79.match(/art-row/g) || []).length >= 3 && mh79.indexOf('供奉值') >= 0
        && mh79.indexOf('pbar') >= 0 && mh79.indexOf('攻占城池') >= 0);
      G.ui.closeModal();
      await sleep(80);
    }

    /* ④ 装备单件化：同名两件各升各的 + 序号区分（强化面板按件） */
    const city79 = G.currentCity();
    if (G.forgeLevel() <= 0) {
      const i79 = city79.cells.findIndex((x) => !x.build && !x.official);
      if (i79 >= 0) city79.cells[i79].build = { id: 'tiejiangpu', lvl: 3 };
    }
    G.state.res.gold = 100000000; G.state.res.iron = 100000000; G.state.res.stone = 100000000;
    const pA79 = G.addEquip('cr_weapon_1'), pB79 = G.addEquip('cr_weapon_1');
    const enhA79 = G.enhance(pA79.u);
    G.ui.openEnhance();
    await sleep(190);
    const enhHtml79 = document.querySelector('#modal-root').innerHTML;
    check('v79：强化面板按件（同名各一行、标签带序号与 +N）',
      enhA79.ok && enhHtml79.indexOf('按件') >= 0
      && enhHtml79.indexOf('·甲') >= 0 && enhHtml79.indexOf('·乙') >= 0
      && enhHtml79.indexOf('+1') >= 0);
    G.ui.closeModal();
    await sleep(80);
    /* 收尾：两件试验品出包 */
    [pA79, pB79].forEach((it) => { const i = G.state.inventory.indexOf(it); if (i >= 0) G.state.inventory.splice(i, 1); });
  }

  G.ui.setView('city');
  await sleep(60);
  return finish();
}
"""
patch(E2E,
"""  G.ui.setView('city');
  await sleep(60);
  return finish();
}
""",
E2E79,
'E1 e2e v79 段')

print()
print('全部完成。')
