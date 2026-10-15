# -*- coding: utf-8 -*-
"""v89.131 补丁 G：smoke-test.js 升级 8 处 + 新增 §112
用法：python patch_v89131g_smoke.py
"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    c = s.count(old)
    assert c == 1, '[%s] 锚点 %d 处（需 1）' % (tag, c)
    s = s.replace(old, new)
    n += 1
    print('  OK ' + tag)


# ---------- ① v58 操作列断言（解雇移出） ----------
rep("""  check('操作（任命守将 / 解雇）在**身份行内部**、头像与身份信息的右侧', (function () {
    var h = G.ui.generalsHTML();
    var iHead = h.indexOf('class="gp-head"');
    var iBody = h.indexOf('class="gp-body"');
    var iOps = h.indexOf('class="gp-ops"');
    var iId = h.indexOf('class="gp-id"');
    if (iHead < 0 || iOps < 0 || iBody < 0 || iId < 0) return false;
    var seg = h.slice(iHead, iBody);
    var ops = h.slice(iOps, iOps + 700);
    return iOps > iId && iOps < iBody
      && (seg.match(/<\\/div>/g) || []).length === 1
      && /data-action="assign-guard"/.test(ops) && /data-action="dismiss-gen"/.test(ops);
  })());""",
"""  /* v89.131（老板）：「解雇放在人名所在行右侧，稍带点距离」——
     解雇从 .gp-ops 移进人名行（.gp-nameops，在 gp-name 闭合之前）；
     任命守将 / 城主仍在身份行右侧操作列。 */
  check('操作（任命守将 / 城主）在身份行内部；解雇（v89.131）在人名行右侧', (function () {
    var h = G.ui.generalsHTML();
    var iHead = h.indexOf('class="gp-head"');
    var iBody = h.indexOf('class="gp-body"');
    var iOps = h.indexOf('class="gp-ops"');
    var iId = h.indexOf('class="gp-id"');
    if (iHead < 0 || iOps < 0 || iBody < 0 || iId < 0) return false;
    var seg = h.slice(iHead, iBody);
    var ops = h.slice(iOps, iOps + 700);
    var iName = h.indexOf('class="gp-name"');
    var iNameEnd = h.indexOf('</b>', iName);
    var iNameOps = h.indexOf('class="gp-nameops"');
    var nameSeg = h.slice(iName, iNameEnd);
    return iOps > iId && iOps < iBody
      && (seg.match(/<\\/div>/g) || []).length === 1
      && /data-action="assign-guard"/.test(ops) && /data-action="assign-mayor"/.test(ops)
      && !/data-action="dismiss-gen"/.test(ops)              /* 不再在操作列 */
      && iNameOps > iName && iNameOps < iNameEnd            /* 在人名行内 */
      && /data-action="dismiss-gen"/.test(nameSeg);
  })());""",
    'v58 操作列')

# ---------- ② v74 对半分配（hS46 版） ----------
rep("""  /* v74（老板需求 4）：「属性跟右边装备栏固定对半空间分配，固定界面」——
     0.92/1.08 改 1fr/1fr；窄屏退单列的断点随固定画布一并撤除。 */
  check('v74：属性与装备栏对半分配；断点已撤（画布固定）',
    /\\.gp-body \\{ grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\)/.test(hS46)
    && !/@media \\(max-width: 900px\\) \\{[\\s\\S]{0,200}\\.gp-body/.test(hS46)
    /* 装备栏独占右栏；其内部仍是「人形 | 属性套装」并排
       （堆叠会让人形把档案顶到 870px，整页多出一条滚动条） */
    && /\\.gp-doll \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\)/.test(hS46));""",
"""  /* v89.131（老板）：「六维/状态占左四分之一；装备栏占四分之三，稍微放大一点。
     其中的四分之二为装备图，另四分之一为装备属性汇总」——
     v74 的 1:1 对半改 1:3；装备栏内部再分 2:1。窄屏断点已撤（画布固定）。 */
  check('v89.131：六维/状态 1/4 · 装备栏 3/4（内部 2:1 = 装备图 | 属性汇总）',
    /\\.gp-body \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 3fr\\)/.test(hS46)
    && /\\.gp-doll \\{ display: grid; grid-template-columns: minmax\\(0, 2fr\\) minmax\\(0, 1fr\\)/.test(hS46)
    && !/@media \\(max-width: 900px\\) \\{[\\s\\S]{0,200}\\.gp-body/.test(hS46)
    /* 「底下不再留空」的结构保证：汇总列 stretch + 按钮钉底 */
    && /\\.gp-doll \\{[^}]*align-items: stretch/.test(hS46)
    && /\\.gd-dollops|.gp-dollops \\{[^}]*margin-top: auto/.test(hS46));""",
    'v74 对半分配')

# ---------- ③ 槽位 62 ----------
rep("""  check('v46 需求 3：槽位为正方形且比原来小（54×54，原为 60 宽）', (function () {
    var m = hS46.match(/\\.doll-slot \\{([^}]*)\\}/);
    if (!m) return false;
    var w = (m[1].match(/width: (\\d+)px/) || [])[1];
    var hgt = (m[1].match(/height: (\\d+)px/) || [])[1];
    var ml = parseFloat((m[1].match(/margin-left: ([\\-\\d.]+)px/) || [])[1]);
    return +w === 54 && +hgt === 54 && ml === -w / 2;      /* 正方形 + 水平居中偏移 */
  })());""",
"""  check('v46 需求 3 + v89.131：槽位为正方形且水平居中（62×62 —— 随人形框放大，原 54）', (function () {
    var m = hS46.match(/\\.doll-slot \\{([^}]*)\\}/);
    if (!m) return false;
    var w = (m[1].match(/width: (\\d+)px/) || [])[1];
    var hgt = (m[1].match(/height: (\\d+)px/) || [])[1];
    var ml = parseFloat((m[1].match(/margin-left: ([\\-\\d.]+)px/) || [])[1]);
    return +w === 62 && +hgt === 62 && ml === -w / 2;      /* 正方形 + 水平居中偏移 */
  })());""",
    '槽位 62')

# ---------- ④ 三行装得下（余量放宽） ----------
rep("""    var need = 2 + pad * 2 + fs + gap + icoH + gap + fs * lh;   /* 2 = 上下边框各 1px */
    var slack = side - need;
    return slack >= 0 && slack <= 3;""",
"""    var need = 2 + pad * 2 + fs + gap + icoH + gap + fs * lh;   /* 2 = 上下边框各 1px */
    var slack = side - need;
    /* v89.131：槽位放大到 62（图标 28）后余量放宽到 8 —— 判据守的是"装得下且不空旷"，
       具体上限随尺寸档走（54 槽时是 ≤3，本轮实算 62-58 = 4）。 */
    return slack >= 0 && slack <= 8;""",
    '三行装得下')

# ---------- ⑤ ④ 对半分配（hSc 版） ----------
rep("""  check('④ 属性与装备栏对半分配（1fr / 1fr）',
    /\\.gp-body \\{ grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\)/.test(hSc));""",
"""  check('④ v89.131：六维/状态 1/4 · 装备栏 3/4（内部 2:1）',
    /\\.gp-body \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 3fr\\)/.test(hSc)
    && /\\.gp-doll \\{ display: grid; grid-template-columns: minmax\\(0, 2fr\\) minmax\\(0, 1fr\\)/.test(hSc));""",
    '④ 对半分配')

# ---------- ⑥ CONTRACT 增 energy ----------
rep("""    /* v89.104（老板「可以加个移民令，恢复人口数量 50%」）—— 消费点 = useItem 的 pop_fill 分支 */
    pop_fill: ['ratio'],
  };""",
"""    /* v89.104（老板「可以加个移民令，恢复人口数量 50%」）—— 消费点 = useItem 的 pop_fill 分支 */
    pop_fill: ['ratio'],
    /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）——
       精力族（清心丸等）消费点 = useItem 的 energy 分支 */
    energy: ['amount'],
  };""",
    'CONTRACT energy')

# ---------- ⑦ 引用不存在的成员（精力上限判据同步） ----------
rep("""      return uu.indexOf('GAME.itemCount') < 0 && /GAME\\.state\\.items \\|\\| \\{\\}\\)\\.jinang/.test(uu)
        && uu.indexOf('GAME.energyMax') < 0 && /GAME\\.staMax \\? GAME\\.staMax\\(g\\)/.test(uu)""",
"""      return uu.indexOf('GAME.itemCount') < 0 && /GAME\\.state\\.items \\|\\| \\{\\}\\)\\.jinang/.test(uu)
        /* v89.131：精力上限已有真出口（energyMaxOf）——判据同步升级：
           「不存在成员」（GAME.energyMax 全词，不含 energyMaxOf）必须消失，真出口在岗。 */
        && !/GAME\\.energyMax\\b/.test(uu) && /GAME\\.energyMaxOf\\(g\\)/.test(uu)""",
    '引用不存在的成员')

# ---------- ⑧ 新增 §112 ----------
sect = """  /* ═══════════════════════════════════════════════════════════
   * §112（v89.131）精力公式 / 体力精力回复 / 精力道具 / 面板版面
   * ------------------------------------------------------------
   * ① 精力上限 = 六维公式（energyPartsOf 零件出口与上限同源，六项齐备 + 逐档单调）；
   * ② 现实时间 24h 百分比回复（tick 真推进 2.4 现实小时 = 上限的 10%）；
   * ③ 精力道具 4 档在售 + 真调使用（+上限20% / 满时拒绝且不扣道具）；
   * ④ 悬空引用修复：「清心丸」提示引用的道具真实存在（v89.121 'chest' 同族）；
   * ⑤ 面板行序（体力→精力→攻击→防御→忠诚）+ 两个「＋」+ 解雇在人名行 + 备注撤除。
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var keep112 = G.state;
    var keepCity112 = G.ui._cityId;
    var fs112 = require('fs'), path112 = require('path');
    var st112 = G.newGame({ name: 'v131', cityName: '许都', region: '豫州', mapSeed: 131 });
    G.state = st112;
    G.ui._cityId = st112.cities[0].id;
    var g112 = st112.generals[0];

    /* ① 精力上限 = 六维公式 */
    var p112 = G.energyPartsOf(g112);
    var sum112 = p112.base;
    p112.items.forEach(function (x) { sum112 += x.v; });
    check('§112① 精力上限 = 六维公式（基准 + 六项加权；与 energyMaxOf 同源）',
      p112.items.length === 6 && Math.abs(p112.total - Math.round(sum112)) < 1e-9
      && G.energyMaxOf(g112) === p112.total,
      '上限 ' + p112.total + ' = 基准 ' + p112.base
      + p112.items.map(function (x) { return ' +' + x.n + '×' + x.v; }).join(''));
    check('§112① 精力上限随资质单调（凡品 < 良材 < 英杰 < 名世 < 天授）', (function () {
      var vals = DATA.GEN_RANKS.map(function (rk) {
        var g = G.makeGeneral('测' + rk.id, rk.lvCap, 'idle', null, false, rk.id, 'balance');
        return G.energyMaxOf(g);
      });
      var mono = true;
      for (var i = 1; i < vals.length; i++) if (!(vals[i] > vals[i - 1])) mono = false;
      console.log('      精力上限逐档：' + DATA.GEN_RANKS.map(function (rk, i) {
        return rk.name + ' ' + vals[i];
      }).join(' · '));
      return mono;
    })(), '五档递增');

    /* ② 现实时间 24h 百分比回复：跑 8640 tick = 2.4 现实小时 → 增量应 = 上限的 10% */
    var staBase112 = G.staBaseMax(g112), enMx112 = G.energyMaxOf(g112);
    g112.stamina = 0; g112.energy = 0;
    for (var t112 = 0; t112 < 8640; t112++) G.tickOnce();
    var dSta112 = g112.stamina, dEn112 = g112.energy;
    check('§112② 体力按现实时间百分比回复（2.4h = 可用池的 10%；24h 满）',
      Math.abs(dSta112 - staBase112 * 0.1) < staBase112 * 0.01,
      '池 ' + Math.round(staBase112) + ' → 2.4h 后 ' + dSta112.toFixed(2)
      + '（期望 ' + (staBase112 * 0.1).toFixed(2) + '）');
    check('§112② 精力按现实时间百分比回复（同上口径）',
      Math.abs(dEn112 - enMx112 * 0.1) < enMx112 * 0.01,
      '上限 ' + enMx112 + ' → 2.4h 后 ' + dEn112.toFixed(2)
      + '（期望 ' + (enMx112 * 0.1).toFixed(2) + '）');

    /* ③ 精力道具：真调 useItem */
    st112.items = { qingxin_wan: 2, ningshen_yulu: 1 };
    var enBefore112 = G.energyNowOf(g112);
    var r112a = G.systems.useItem('qingxin_wan', g112.id);
    var want112 = Math.round(Math.min(enMx112, enBefore112 + 0.2 * enMx112));
    check('§112③ 清心丸：真调使用 → 精力 +上限20%（库存扣 1）',
      r112a.ok && G.energyNowOf(g112) === want112 && st112.items.qingxin_wan === 1,
      r112a.msg + '（' + enBefore112 + ' → ' + G.energyNowOf(g112) + ' / 期望 ' + want112 + '）');
    G.setEnergyNow(g112, enMx112);
    var r112b = G.systems.useItem('qingxin_wan', g112.id);
    check('§112③ 精力已满：拒绝且不扣道具（防白烧）',
      r112b.ok === false && st112.items.qingxin_wan === 1 && /已满/.test(r112b.msg), r112b.msg);
    check('§112③ 精力族 4 档齐备且都在售（在售 == 有页签 · v89.51 判据）', (function () {
      var fam = (DATA.ITEMS || []).filter(function (it) { return it.type === 'energy'; });
      return fam.length === 4
        && fam.every(function (it) { return it.price > 0 && !it.noShop && !!G.ui.SHOP_CATS[it.type]; })
        && !!G.ui.BAG_ITEM_CN.energy;
    })(), '4 档');

    /* ④ 悬空引用修复 */
    check('§112④ 「可服清心丸」提示引用的道具真实存在（悬空引用修复）', (function () {
      var hit = (DATA.ITEMS || []).filter(function (it) { return it.name === '清心丸'; });
      var src = fs112.readFileSync(path112.join(__dirname, 'js', 'battle.js'), 'utf8')
        + fs112.readFileSync(path112.join(__dirname, 'js', 'state.js'), 'utf8');
      return hit.length === 1 && hit[0].type === 'energy' && src.indexOf('可服清心丸') > 0;
    })());

    /* ⑤ 面板版面（真渲染 genPane） */
    var h112 = G.ui.genPane(g112);
    var iSta112 = h112.indexOf('体力 <b>');
    var iEn112 = h112.indexOf('精力 <b>');
    var iAtk112 = h112.indexOf('攻击 <b>');
    var iDef112 = h112.indexOf('防御 <b>');
    var iLoy112 = h112.indexOf('忠诚 <b>');
    check('§112⑤ 状态行序：体力 → 精力 → 攻击 → 防御 → 忠诚（老板口径）',
      iSta112 > 0 && iSta112 < iEn112 && iEn112 < iAtk112 && iAtk112 < iDef112 && iDef112 < iLoy112,
      [iSta112, iEn112, iAtk112, iDef112, iLoy112].join(' < '));
    check('§112⑤ 体力/精力行各带「＋」道具入口（data-action 真渲染）',
      /gen-sta-pick/.test(h112) && /gen-energy-pick/.test(h112));
    check('§112⑤ 解雇在人名行内（gp-nameops ⊆ gp-name）；操作列不再含解雇', (function () {
      var iName = h112.indexOf('class="gp-name"');
      var iEnd = h112.indexOf('</b>', iName);
      var iOps112 = h112.indexOf('class="gp-nameops"');
      if (iName < 0 || iOps112 < 0) return false;
      var opsSeg = h112.slice(h112.indexOf('class="gp-ops"'));
      return iOps112 > iName && iOps112 < iEnd
        && opsSeg.indexOf('dismiss-gen') < 0;
    })());
    check('§112⑤ 六维自由属性点行无备注（gd-free-hint 已撤，行仍在）',
      h112.indexOf('gd-free-hint') < 0 && h112.indexOf('自由属性点') > 0);
    check('§112⑤ 精力行悬停给出六维公式分解（与 energyPartsOf 同源）', (function () {
      /* 悬停 = .gd-line 的 title：内容 = '精力上限 N = 基准 40 ＋ 统率 …'
         —— 判据取"含上限数字 + 含基准字样 + 含至少一个维度名"三要素 */
      var i = h112.indexOf('精力上限 ');
      if (i < 0) return false;
      var seg = h112.slice(i, i + 400);
      return seg.indexOf('基准') > 0 && seg.indexOf('统率') > 0 && seg.indexOf('体力上限') >= 0
        || (seg.indexOf('基准') > 0 && seg.indexOf('六维公式') > 0);
    })());
    G.state = keep112;
    G.ui._cityId = keepCity112;
  })();

"""
anchor112 = """  /* ═══════════════════════════════════════════════════════════
   * §105（v89.126）人口增速：固定时间速率（每 fillHours 现实小时补满）"""
assert s.count(anchor112) == 1, '§105 锚点 %d' % s.count(anchor112)
s = s.replace(anchor112, sect + anchor112)
n += 1
print('  OK 新增 §112')

# ---------- 写前自检 ----------
assert s != orig and n == 8, 'n=%d' % n
assert '§112' in s and 'energyMaxOf' in s
# 花括号配平：排除"不是语法括号"的两种出现 —— ① 正则转义 \{ \}；
# ② 字符类取反 [^}] 里的裸 }（本轮 §112 的判据用到 /[^}]*/，第一版误报过）。
def _bal(t):
    import re as _re
    op = _re.findall(r'(?<![\\^])\{', t)
    cl = _re.findall(r'(?<![\\^])\}', t)
    return len(op) - len(cl)
assert _bal(s) == _bal(orig), '花括号盈亏 %d vs %d' % (_bal(s), _bal(orig))
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patch G(smoke) OK · %d 处（LF 保持）' % n)
