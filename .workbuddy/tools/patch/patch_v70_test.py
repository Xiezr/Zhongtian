# -*- coding: utf-8 -*-
"""v70 测试：smoke 第 58 节（五项需求的断言）+ e2e 追加（真实 DOM 走查）。

用法：python patch_v70_test.py     （幂等）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
SMOKE = os.path.join(ROOT, 'smoke-test.js')
E2E = os.path.join(ROOT, 'e2e-test.js')

SMOKE_ANCHOR = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');\n"

SMOKE_SEC = r"""  console.log('\n--- 第 58 节：州郡县 · 满配数量表 · 坐标迁址 · 君主将领 · 出生州（v70） ---');
  (function () {
    var fs58 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u58 = stripComment(fs58('ui'));
    var d58 = stripComment(fs58('data'));
    var dm58 = stripComment(fs58('domain'));
    var h58 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
    /* 本地造档 helper（其它节的 withState 在各自的 IIFE 里，跨节不可见） */
    var withState58 = function (name, fn) {
      var keep = G.state;
      try {
        var st = G.newGame({ name: name });
        G.state = st;
        if (G.map.generate) G.map.generate();
        return fn(st);
      } finally { G.state = keep; }
    };

    /* ================= ① 州 · 郡 · 县 ================= */
    console.log('  --- ① 州郡县标识 ---');
    check('行政区划只有一个出口（regionOf 定义 1 处 + 郡/县名规范化）',
      (dm58.match(/GAME\.regionOf = function/g) || []).length === 1
      && /GAME\.junNameOf = function/.test(dm58)
      && /GAME\.countyNameOf = function/.test(dm58));

    check('★ 每个县城都归属到一个郡（且同州）', (function () {
      var bad = 0, n = 0;
      (DATA.NPC_CITIES || []).forEach(function (c) {
        if (c.type !== 'county') return;
        n++;
        var rg = G.regionOf(c.x, c.y);
        if (!rg || !rg.jun || rg.state !== c.state) bad++;
      });
      return n >= 60 && bad === 0;
    })());

    check('★ 任意坐标都能归属到一个县（采样 40 点）', (function () {
      for (var i = 0; i < 40; i++) {
        var rg = G.regionOf((i * 97) % 500, (i * 53) % 500);
        if (!rg || !rg.county || !rg.state) return false;
      }
      return true;
    })());

    check('★ 名城全称 = 州 · 郡 · 县（都城/州城/郡城/县城各一例）', (function () {
      function byType(t) { var hit = null; DATA.NPC_CITIES.forEach(function (c) { if (!hit && c.type === t) hit = c; }); return hit; }
      var cap = G.cityFullName(byType('capital'));
      var zhou = G.cityFullName(byType('zhou'));
      var jun = G.cityFullName(byType('jun'));
      var cty = G.cityFullName(byType('county'));
      return cap.split(' · ').length === 2 && zhou.split(' · ').length === 2
        && jun.split(' · ').length === 2 && cty.split(' · ').length === 3
        && /[郡国县道]$/.test(jun.split(' · ')[1]) && /县$/.test(cty.split(' · ')[2]);
    })(), (function () {
      var hit = null; DATA.NPC_CITIES.forEach(function (c) { if (!hit && c.type === 'county') hit = c; });
      return G.cityFullName(hit);
    })());

    check('★ 野外城池标识带所在县（fortLabelOf）', (function () {
      var lbl = G.fortLabelOf({ x: 120, y: 300, name: '青石营', level: 5 });
      var rg = G.regionOf(120, 300);
      return lbl.indexOf(G.countyNameOf(rg.county)) === 0 && lbl.indexOf('青石营') > 0;
    })());

    check('行政区划确定性（同坐标两次同结果）', (function () {
      var a = G.regionOf(200, 200), b = G.regionOf(200, 200);
      return a.county === b.county && a.jun === b.jun && a.state === b.state;
    })());

    /* ================= ② 满配：仓库 4 + 城外数量表 ================= */
    console.log('  --- ② 满配数量（城内仓库 4 / 城外数量表）---');
    check('★ 城外数量表逐档合计 == 上限表（1..MAX_LEVEL_ABS 全档）', (function () {
      for (var lv = 1; lv <= (DATA.MAX_LEVEL_ABS || 24); lv++) {
        var row = DATA.EXT_PLAN_BY_LV[lv - 1];
        var sum = row.reduce(function (a, b) { return a + b; }, 0);
        if (sum !== DATA.EXT_CAP_BY_LV[lv - 1]) return false;
      }
      return true;
    })());

    check('城外数量表：四类各 ≥2、逐档单调不降', (function () {
      var prev = null;
      for (var lv = 1; lv <= (DATA.MAX_LEVEL_ABS || 24); lv++) {
        var row = DATA.EXT_PLAN_BY_LV[lv - 1];
        if (row.some(function (n) { return n < 2; })) return false;
        if (prev && !row.every(function (n, i) { return n >= prev[i]; })) return false;
        prev = row;
      }
      return true;
    })());

    check('★ extPlanOf 铺法与数量表一致（轮转、长度 = 块数、顺序固定）', (function () {
      var list = G.extPlanOf(6);
      var cnt = {};
      list.forEach(function (t) { cnt[t] = (cnt[t] || 0) + 1; });
      var want = DATA.EXT_PLAN_BY_LV[5];
      return list.length === DATA.EXT_CAP_BY_LV[5]
        && cnt.farm === want[0] && cnt.forest === want[1]
        && cnt.quarry === want[2] && cnt.mine === want[3]
        && list[0] === 'farm' && list[1] === 'forest';
    })());

    check('★ 系统城的城外地块也走同一出口（影子城数量=数量表）', (function () {
      return withState58('v70plan', function (st) {
        var npc = null;
        (st.map.cities || []).forEach(function (c) { if (!npc && c.level === 9) npc = c; });
        if (!npc) return false;
        var sh = G.npcCityShadow(npc);
        var cnt = {};
        sh.extGrid.forEach(function (e) { cnt[e.type] = (cnt[e.type] || 0) + 1; });
        var want = DATA.EXT_PLAN_BY_LV[8];       /* 州城 Lv9 → 第 9 档 */
        return sh.extGrid.length === DATA.EXT_CAP_BY_LV[8]
          && cnt.farm === want[0] && cnt.mine === want[3];
      });
    })());

    check('城内满配里仓库恰好 4 座（v70 老板）', (function () {
      for (var lv = 1; lv <= 10; lv++) {
        var c = 0;
        G.cityPlanOf(lv).cells.forEach(function (x) { if (x.build && x.build.id === 'cangku') c++; });
        if (c !== 4) return false;
      }
      return true;
    })());

    /* ================= ③ 坐标与迁址 ================= */
    console.log('  --- ③ 城池坐标与迁址 ---');
    check('坐标口径：500×500 → 0~499；coordText 形如 (x, y)',
      G.COORD_MAX === 499 && G.coordText({ x: 3, y: 4 }) === '(3, 4)');

    check('★ 可迁判据：自建城可迁 / 名城（含攻占来的）不可迁', (function () {
      return G.isMovableCity({ type: 'self' }) === true
        && G.isMovableCity({ type: 'county', origId: 'cty_9' }) === false
        && G.isMovableCity({ type: 'jun' }) === false
        && G.isMovableCity({ type: 'capital' }) === false;
    })());

    check('★ 迁址：旧格还平原、新格变城池、坐标落定', (function () {
      return withState58('v70move', function (st) {
        var c = st.cities[0];
        var from = { x: c.x, y: c.y };
        var dst = null;
        for (var x = 5; x < 140 && !dst; x++) for (var y = 5; y < 140 && !dst; y++) {
          if (G.canCityMoveTo(c, x, y).ok) dst = { x: x, y: y };
        }
        if (!dst) return false;
        var r = G.moveCityTo(c.id, dst.x, dst.y);
        return r.ok === true && c.x === dst.x && c.y === dst.y
          && G.map.tile(dst.x, dst.y).terrain === 'city'
          && G.map.tile(from.x, from.y).terrain === 'plain';
      });
    })());

    check('★ 迁址拒绝：越界 / 原地 / 名城 / 非平原', (function () {
      return withState58('v70deny', function (st) {
        var c = st.cities[0];
        var b1 = G.canCityMoveTo(c, -1, 5).ok === false;
        var b2 = G.canCityMoveTo(c, 999, 5).ok === false;
        var b3 = G.canCityMoveTo(c, c.x, c.y).ok === false;
        var npc = (st.map.cities || [])[0];
        var b4 = G.canCityMoveTo(c, npc.x, npc.y).ok === false;
        var nonPlain = null;
        for (var x = 0; x < 80 && !nonPlain; x++) for (var y = 0; y < 80 && !nonPlain; y++) {
          var t = G.map.tile(x, y);
          if (t && t.terrain !== 'plain' && t.terrain !== 'city') nonPlain = { x: x, y: y };
        }
        var b5 = !nonPlain || G.canCityMoveTo(c, nonPlain.x, nonPlain.y).ok === false;
        return b1 && b2 && b3 && b4 && b5;
      });
    })());

    check('★ 一键随机：落点必可迁（注入 rnd → 确定性）+ 真迁成功', (function () {
      return withState58('v70rand', function (st) {
        var c = st.cities[0];
        var seq = 7;
        var fake = function () { seq = (seq * 48271) % 2147483647; return seq / 2147483647; };
        var pt = G.randomCityCoord(c, fake);
        if (!pt || !G.canCityMoveTo(c, pt.x, pt.y).ok) return false;
        var r = G.randomMoveCity(c.id);
        return r.ok === true && G.isMovableCity(c);
      });
    })());

    check('迁址写日志（可追溯）', /📍 迁址/.test(dm58) && /GAME\.log\('📍 迁址/.test(dm58));

    /* ================= ④ 君主将领 ================= */
    console.log('  --- ④ 君主将领（老板：玩家角色本人）---');
    check('★ 新档名单含君主（id=lord / isLord / 同君名同脸同城）', (function () {
      var st = G.newGame({ name: '君主测试', region: '司隶', portraitSeed: 7 });
      var lord = null;
      (st.generals || []).forEach(function (g) { if (g.isLord) lord = g; });
      return !!lord && lord.id === 'lord' && lord.name === '君主测试'
        && lord.portraitSeed === 7 && lord.loyalty === 100
        && lord.cityId === st.cities[0].id
        && st.generals[0].name === '赵子龙';       /* 既有索引口径不动 */
    })());

    check('★ 君主不可解雇（域层拒绝）', (function () {
      return withState58('v70lord1', function (st) {
        var lord = G.lordGeneralOf();
        var r = G.dismissGeneral(lord.id);
        return r.ok === false && (st.generals || []).some(function (g) { return g.isLord; });
      });
    })());

    check('★ 君主永不离去（忠诚归零 + 骰子必然触发，仍在帐下；对照的普通将领已被带走）', (function () {
      return withState58('v70lord2', function (st) {
        var lord = G.lordGeneralOf();
        lord.loyalty = 0;
        var other = null;
        st.generals.forEach(function (g) { if (!g.isLord && !other) other = g; });
        if (other) other.loyalty = 0;
        var real = Math.random;
        Math.random = function () { return 0; };
        try { for (var i = 0; i < 3; i++) G.tickOnce(); }
        finally { Math.random = real; }
        var lordsLeft = (st.generals || []).filter(function (g) { return g.isLord; }).length;
        var othersLeft = (st.generals || []).filter(function (g) { return !g.isLord; }).length;
        return lordsLeft === 1 && (other ? othersLeft === 0 : true);
      });
    })());

    check('★ 君主特权框架：数据表 + 只给君主（普通将领为空）', (function () {
      var lord = G.lordGeneralOf();
      var normal = G.makeGeneral('普通将', 1, 'idle', null);
      var tr = G.lordTraitsOf(lord);
      return tr.length >= 1 && !!tr[0].name && !!tr[0].desc
        && G.lordTraitsOf(normal).length === 0
        && (DATA.LORD_TRAITS || []).length === tr.length;
    })());

    check('君主六维取资质中值（确定性，不掷骰）', (function () {
      var a = G.makeLordGeneral({ name: '甲' }, 1, null);
      var b = G.makeLordGeneral({ name: '乙' }, 2, null);
      var rk = DATA.GEN_RANK_BY_ID[DATA.LORD_GEN.rankId];
      var mid = Math.round((rk.base[0] + rk.base[1]) / 2);
      return a.tong === mid && a.nz === mid && a.yw === mid && a.zm === mid && a.tong === b.tong;
    })());

    check('★ 老档迁移：无君主的档补一位（二次读档不重复添人）', (function () {
      var keep = G.state;
      try {
        var st = G.newGame({ name: '迁移测试', region: '兖州', portraitSeed: 3 });
        st.generals = st.generals.filter(function (g) { return !g.isLord; });
        st.savedAt = U.now();
        var out = G.adoptState(st);
        var lords = (out.generals || []).filter(function (g) { return g.isLord; });
        G.adoptState(out);
        var again = (out.generals || []).filter(function (g) { return g.isLord; });
        return lords.length === 1 && again.length === 1
          && lords[0].name === '迁移测试' && lords[0].portraitSeed === 3;
      } finally { G.state = keep; }
    })());

    check('解雇守卫在域层读唯一出口（isLordGeneral）',
      /isLordGeneral/.test(codeOf(dm58, 'GAME.dismissGeneral = function')));

    /* ================= ⑤ 创建：头像池 + 出生州 ================= */
    console.log('  --- ⑤ 创建界面：头像同源 + 出生州 ---');
    check('★ 创建头像 = 将领同一套池子（ui.avatarPool / paintCreateAvatar）',
      /ui\.avatarPool = function/.test(u58) && /P\.POOL\[/.test(u58)
      && /paintCreateAvatar/.test(u58) && /GAME\.portraits\.DIR/.test(u58));

    check('★ 出生州：十三州逐个验证「落点归属 == 所选州」', (function () {
      var list = DATA.START_STATES || [];
      for (var i = 0; i < list.length; i++) {
        var pt = G.pickStartPos(list[i], 1000 + i * 7);
        if (!pt || pt.state !== list[i]) return false;
        if (G.stateOfCity({ x: pt.x, y: pt.y }) !== list[i]) return false;
      }
      return list.length === 13;
    })());

    check('★ 出生点确定性（同种子同落点）', (function () {
      var a = G.pickStartPos('凉州', 4242), b = G.pickStartPos('凉州', 4242);
      return a.x === b.x && a.y === b.y && a.state === b.state;
    })());

    check('★ 出生点不压任何系统城（±2 缓冲）', (function () {
      var list = DATA.START_STATES || [];
      for (var i = 0; i < list.length; i++) {
        var pt = G.pickStartPos(list[i], 77 + i);
        var clash = false;
        DATA.NPC_CITIES.forEach(function (c) {
          if (Math.abs(c.x - pt.x) <= 2 && Math.abs(c.y - pt.y) <= 2) clash = true;
        });
        if (clash) return false;
      }
      return true;
    })());

    check('★ 新档出生城：坐标 / 归属 / 州三者一致 + map.startPos 同步', (function () {
      var st = G.newGame({ name: '落位', region: '益州' });
      var c = st.cities[0];
      return c.state === '益州' && G.stateOfCity(c) === '益州'
        && st.map.startPos && st.map.startPos.x === c.x && st.map.startPos.y === c.y;
    })());

    check('random 也会记成解析后的州', (function () {
      var st = G.newGame({ name: '随机州', region: 'random' });
      return (DATA.START_STATES || []).indexOf(st.ruler.region) >= 0;
    })());

    check('创建界面硬检查：13 州 chips + 随机；旧「北方/中原/江南」已撤',
      (h58.match(/data-target="create-region"/g) || []).length === 14
      && !/data-v="north"/.test(h58) && !/data-v="south"/.test(h58));

    check('头像位改用画像（.avatar-big img 规则在位）',
      /\.avatar-big img \{[^}]*object-fit: cover/.test(h58));

    check('doCreate 把头像下标当 portraitSeed 传下去', /portraitSeed: avatarIdx/.test(u58));
  })();

"""

# ---------------- e2e ----------------
E2E_CREATE_ANCHOR = """  const startBtn = document.querySelector('[data-action="create-start"]') || document.querySelector('#create-start');
  check('找到开始按钮', !!startBtn);"""

E2E_CREATE_NEW = """  const startBtn = document.querySelector('[data-action="create-start"]') || document.querySelector('#create-start');
  check('找到开始按钮', !!startBtn);

  /* v70（老板需求 5）：创建界面 —— 头像与将领同源（头像池）、归属改十三州 */
  const regChips = document.querySelectorAll('#screen-create [data-target="create-region"]');
  check('★ 归属选项 = 随机 + 十三州（14 枚）', regChips.length === 14, regChips.length + ' 枚');
  check('★ 归属选项是州名（旧「北方/中原/江南」已撤）', (function () {
    const vals = Array.from(regChips).map((el) => el.dataset.v);
    return vals.indexOf('random') >= 0 && vals.indexOf('青州') >= 0 && vals.indexOf('north') < 0;
  })());
  const avImg = document.querySelector('#create-avatar img');
  check('★ 头像预览走头像池（<img> 指向 assets/portraits/pool）',
    !!avImg && /portraits\\/pool\\/[mf]\\d\\d\\.webp/.test(avImg.getAttribute('src') || ''),
    avImg ? avImg.getAttribute('src') : '（无）');"""

E2E_BIRTH_ANCHOR = """  const s = G.state;
  const city = s.cities[0];"""

E2E_BIRTH_NEW = """  const s = G.state;
  const city = s.cities[0];
  /* v70（老板需求 5）：出生城归属所选州 + 君主将领入册 */
  check('★ 出生城落在所选州（就近归属一致）', (function () {
    const rg = s.ruler.region;
    return (DATA.START_STATES || []).indexOf(rg) >= 0 && G.stateOfCity(city) === rg;
  })(), s.ruler.region + ' @ ' + city.x + ',' + city.y);
  check('★ 名单含君主将领（id=lord / 与君同名同脸）', (function () {
    const lord = G.lordGeneralOf();
    return !!lord && lord.id === 'lord' && lord.isLord === true
      && lord.name === s.ruler.name && lord.portraitSeed === s.ruler.portraitSeed;
  })());"""

E2E_TAIL_ANCHOR = """  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

E2E_TAIL_NEW = """  /* ---- v70（老板需求 3/4）：城池坐标 —— 显示 / 一键随机 / 坐标切换 ---- */
  G.ui.setView('city');
  await sleep(90);
  check('★ 城池属性栏显示坐标（500×500）与两个入口', (function () {
    const h = document.querySelector('#city-attrs').innerHTML;
    const c0 = G.currentCity();
    return h.indexOf('500×500') >= 0 && h.indexOf(G.coordText(c0)) >= 0
      && h.indexOf('data-action="city-random"') >= 0 && h.indexOf('data-action="city-move-ask"') >= 0;
  })());
  {
    const c70 = G.currentCity();
    const from70 = { x: c70.x, y: c70.y };
    click(document.querySelector('#city-attrs [data-action="city-random"]'));
    await sleep(200);
    check('★ 一键随机：坐标已变、旧格归还平原、新格是城池',
      (c70.x !== from70.x || c70.y !== from70.y)
      && G.map.tile(from70.x, from70.y).terrain === 'plain'
      && G.map.tile(c70.x, c70.y).terrain === 'city',
      '(' + from70.x + ',' + from70.y + ') → (' + c70.x + ',' + c70.y + ')');
  }
  {
    const c71 = G.currentCity();
    click(document.querySelector('#city-attrs [data-action="city-move-ask"]'));
    await sleep(90);
    const mh70 = document.querySelector('#modal-root').innerHTML;
    check('★ 迁址弹窗：坐标输入 + 确认按钮（按弹窗规范）',
      mh70.indexOf('迁往') >= 0 && mh70.indexOf('id="move-x"') >= 0
      && mh70.indexOf('data-action="city-move-do"') >= 0 && mh70.indexOf('取消') >= 0);
    let dst70 = null;
    for (let x = 5; x < 160 && !dst70; x++) for (let y = 5; y < 160 && !dst70; y++) {
      if (G.canCityMoveTo(c71, x, y).ok) dst70 = { x: x, y: y };
    }
    check('夹具：找到一处可迁坐标', !!dst70, dst70 ? dst70.x + ',' + dst70.y : '无');
    if (dst70) {
      document.querySelector('#move-x').value = dst70.x;
      document.querySelector('#move-y').value = dst70.y;
      click(document.querySelector('#modal-root [data-action="city-move-do"]'));
      await sleep(200);
      check('★ 手输坐标迁址生效（坐标更新 + 弹窗关闭）',
        c71.x === dst70.x && c71.y === dst70.y
        && document.querySelector('#modal-root').innerHTML.indexOf('迁往') < 0);
    }
  }
  check('★ 名城固定（判据层：只有自建城可迁）',
    G.isMovableCity({ type: 'self' }) === true && G.isMovableCity({ type: 'county' }) === false);

  /* ---- v70（老板需求 1）：君主将领在将领页 ---- */
  G.ui.setView('generals');
  await sleep(140);
  check('★ 将领页名单标出「君主」', vc.innerHTML.indexOf('gcard-tag lord') >= 0);
  {
    const lord70 = G.lordGeneralOf();
    G.ui._genSel = lord70.id;
    G.ui.renderView('generals');
    await sleep(90);
    check('★ 君主档案：无解雇按钮 + 有「君主特权」块',
      vc.innerHTML.indexOf('data-action="dismiss-gen"') < 0
      && vc.innerHTML.indexOf('君主特权') >= 0);
    const normal70 = s.generals.filter((g) => !g.isLord)[0];
    if (normal70) {
      G.ui._genSel = normal70.id;
      G.ui.renderView('generals');
      await sleep(90);
      check('★ 普通将领仍可解雇（入口只对君主隐藏）',
        vc.innerHTML.indexOf('data-action="dismiss-gen"') >= 0);
    }
  }

  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def save_lf(p, s, tag):
    if '\r' in s:
        print('!! %s：含 CR，拒绝写盘' % tag)
        return False
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    return b'\r' not in io.open(p, 'rb').read()


def cut(src, old, new, tag):
    n = src.count(old)
    if n == 0:
        print('  · %s：已改过（跳过）' % tag)
        return src
    if n > 1:
        print('!! %s：锚点 %d 次，拒绝写盘' % (tag, n))
        return None
    print('  ✓ %s' % tag)
    return src.replace(old, new, 1)


def main():
    fails = []
    sm = read(SMOKE)
    if '第 58 节' in sm:
        print('· smoke：已改过（幂等跳过）')
    else:
        if sm.count(SMOKE_ANCHOR) != 1:
            print('!! smoke 结果行锚点 %d 次' % sm.count(SMOKE_ANCHOR))
            return 1
        sm = sm.replace(SMOKE_ANCHOR, SMOKE_SEC + SMOKE_ANCHOR, 1)
        if not save_lf(SMOKE, sm, 'smoke'):
            fails.append('smoke')

    e2 = read(E2E)
    if '归属选项 = 随机 + 十三州' in e2:
        print('· e2e：已改过（幂等跳过）')
    else:
        for old, new, tag in [
            (E2E_CREATE_ANCHOR, E2E_CREATE_NEW, 'e2e 创建界面'),
            (E2E_BIRTH_ANCHOR, E2E_BIRTH_NEW, 'e2e 出生州 + 君主'),
            (E2E_TAIL_ANCHOR, E2E_TAIL_NEW, 'e2e 坐标迁址 + 君主页'),
        ]:
            res = cut(e2, old, new, tag)
            if res is None:
                fails.append(tag)
                continue
            e2 = res
        if not save_lf(E2E, e2, 'e2e'):
            fails.append('e2e')

    print('')
    if fails:
        print('✗ 未完成：' + ', '.join(fails))
        return 1
    print('✓ 全部完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())
