# -*- coding: utf-8 -*-
"""v89.173c · 测试与档案：smoke/e2e 断言随口径升级 + 需求档案在册
- smoke：数据层断言（面额固定）· §170① 更新 · §171 整节 → §173 节 · 两处注释
- e2e：选择窗卡面判据（+X万）· §171 段 → §173 段（Lv60 仍可用）
- 需求档案：总览表 + 逐轮明细追加 v89.173
纪律：先全部内存替换（任一锚点不命中即中断，不落盘）；再统一写回；写后跑 node --check。
"""
import io, os, sys, subprocess

ROOT = 'E:/Deepseekdb'
FILES = {}

def load(p):
    if p not in FILES:
        FILES[p] = io.open(os.path.join(ROOT, p), 'r', encoding='utf-8', newline='').read()
    return FILES[p]

def save(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)

def edit(path, tag, old, new, count=1):
    s = load(path)
    n = s.count(old)
    assert n == count, '[%s] 锚点命中 %d 次（要求 %d）' % (tag, n, count)
    FILES[path] = s.replace(old, new, count)
    print('  ok  ' + tag)

def edit_range(path, tag, start, end, new):
    s = load(path)
    assert s.count(start) == 1, '[%s] start 锚 %d 次' % (tag, s.count(start))
    assert s.count(end) == 1, '[%s] end 锚 %d 次' % (tag, s.count(end))
    i = s.index(start)
    j = s.index(end, i) + len(end)
    FILES[path] = s[:i] + new + s[j:]
    print('  ok  ' + tag + '  (区间 %d 字符 → %d 字符)' % (j - i, len(new)))

# ============================================================
# S. smoke-test.js
# ============================================================
print('== smoke-test.js ==')

edit('smoke-test.js', 'S1 total 注释',
  r'''    /* total 必须等于 Σ need（v89.171：经验道具按 expCumOf(capLv) 取额，两处不许各算各的） */''',
  r'''    /* total 必须等于 Σ need（两处不许各算各的） */''')

edit('smoke-test.js', 'S2 数据层断言（面额固定）',
  r'''check('v89.171 经验道具按 capLv 累计取额（量 = expCumOf(上限) · 全族 10~60 · desc 带上限）', (function () {
  var bad = [];
  (DATA.EXP_ITEM_SPEC || []).forEach(function (sp) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === sp.id) it = x; });
    if (!it) return;
    if (!(it.capLv > 0) || it.capLv !== sp.capLv) bad.push(sp.id + ':cap');
    if (it.amount !== Math.max(1, DATA.expCumOf(sp.capLv))) bad.push(sp.id + ':amount');
    if (String(it.desc || '').indexOf('最多培养至 Lv' + it.capLv) < 0) bad.push(sp.id + ':desc');
  });
  var caps = (DATA.EXP_ITEM_SPEC || []).map(function (sp) { return sp.capLv; });
  var mono = caps.every(function (c, i) { return i === 0 || c > caps[i - 1]; });
  return bad.length === 0 && mono && caps.every(function (c) { return c <= 60; })
    && DATA.expCumOf(241) === DATA.EXP_CURVE.total;       /* 与 total 同源 */
})());''',
  r'''check('v89.173 经验道具面额固定（在售 4 档 = 10/100/300/450 万 · 无 capLv · 整数万 · desc 无旧上限文案）', (function () {
  var bad = [];
  var want = { lianbing_jingyan: 100000, zhijun_zhidao: 1000000, bingxian_yipian: 3000000, bingsheng: 4500000 };
  (DATA.EXP_ITEM_SPEC || []).forEach(function (sp) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === sp.id) it = x; });
    if (!it) return;
    if (it.amount !== sp.amount) bad.push(sp.id + ':amount');
    if (it.capLv) bad.push(sp.id + ':capLv残留');
    if (sp.amount % 10000 !== 0) bad.push(sp.id + ':非整数万');
    if (String(it.desc || '') !== '将领经验+' + it.amount) bad.push(sp.id + ':desc');
    if (/最多培养至|最多至/.test(String(it.desc || ''))) bad.push(sp.id + ':旧上限文案');
  });
  Object.keys(want).forEach(function (id) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
    if (!it || it.amount !== want[id]) bad.push(id + ':非老板值');
  });
  return bad.length === 0;
})());''')

edit('smoke-test.js', 'S3 till 用例注释',
  r'''    /* v89.171：面额 = expCumOf(10)（~7.4 万/个）—— 1 个即到该档上限（Lv10）→ till 停。
       数量给 3 个是为了验"用不完不白扣"（used=1、剩 2）。 */''',
  r'''    /* v89.173：面额 = 固定 10 万/个 —— 1 个即从 Lv1 连升过 Lv11 → till 停。
       数量给 3 个是为了验"用不完不白扣"（used=1、剩 2）。 */''')

edit('smoke-test.js', 'S4 用 1 个用例注释',
  r'''    /* v89.171：额度走**闸门**核对（含到线折算）；gain 与出口同源（含神器加成 —— 与 gainExp 同一算式，
       不再用"面额"直比，防"入口改了、判据没跟"） */''',
  r'''    /* v89.173：额度走**闸门**核对（= 固定面额全额）；gain 与出口同源（含神器加成 ——
       与 gainExp 同一算式，防"入口改了、判据没跟"） */''')

edit('smoke-test.js', 'S5 §170① 用例更新',
  r'''      /* v89.171：走**真实闸门**（额度折算 + 到线上限），不再直接喂面额 ——
         兵仙遗篇现在"到线即止"（培养上限 Lv50 · 全族 60 封顶）。 */
      var gt = G.expItemGrantOf(g, it);
      var r = G.battle.gainExp(g, gt.grant, '§170');
      check('§170①（v89.171 更新）兵仙遗篇从 Lv1 → Lv' + g.level + '（到线即止 · 培养上限 Lv50）',
        gt.ok === true && gt.capped === true && g.level === 50 && it.capLv === 50,
        'Lv' + g.level + '（入账 ' + (r && r.gain) + ' · 面额 ' + it.amount + '）');''',
  r'''      /* v89.173：走**真实闸门**（= 固定面额全额），兵仙遗篇 = +300 万经验（无等级限制）。 */
      var gt = G.expItemGrantOf(g, it);
      var r = G.battle.gainExp(g, gt.grant, '§170');
      check('§170①（v89.173 更新）兵仙遗篇从 Lv1 → Lv' + g.level + '（固定面额 300 万 · 无等级限制）',
        gt.ok === true && gt.grant === 3000000 && g.level === 49 && !it.capLv,
        'Lv' + g.level + '（入账 ' + (r && r.gain) + ' · 面额 ' + it.amount + '）');''')

edit_range('smoke-test.js', 'S6 §171 整节 → §173 节',
  '  /* ============================================================\n   * 171. v89.171（老板）：「经验道具的经验值设置基于什么考虑',
  "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
  r'''  /* ============================================================
   * 173. v89.173（老板）：「已下架的就不要拿出来讨论了。那就这样，不作等级限制，
   *      对道具经验取整，练兵10W，治军100W，兵仙300W，兵圣450W。
   *      出征带来的经验体验调高一点，出征上限不变，但出征对象的等级和所得的经验
   *      可以要求低一点，尽量拿满0.8级经验」
   *   —— ① 道具：撤 capLv / 固定整数面额；② 出征：perResource 减半 + 惩罚放宽。
   * ============================================================ */
  console.log('\n===== 173. v89.173 道具固定面额（撤等级限制） + 出征经验调高 =====');
  (function () {
    var fs173 = require('fs'), p173 = require('path');
    var itBx = null, it10 = null, it30 = null, it60 = null;
    (DATA.ITEMS || []).forEach(function (x) {
      if (x.id === 'bingxian_yipian') itBx = x;
      if (x.id === 'lianbing_jingyan') it10 = x;
      if (x.id === 'zhijun_zhidao') it30 = x;
      if (x.id === 'bingsheng') it60 = x;
    });

    /* ① 数据层：4 档 = 老板数字 · capLv 零残留 · 全族整数万 */
    console.log('  --- ① 数据层（固定面额 · capLv 退役） ---');
    (function () {
      check('§173① ★ 在售 4 档 = 老板拍板数字（练兵10万/治军100万/兵仙300万/兵圣450万）',
        it10.amount === 100000 && it30.amount === 1000000
        && itBx.amount === 3000000 && it60.amount === 4500000,
        [it10.amount, it30.amount, itBx.amount, it60.amount].join('/'));
      var bad = [];
      (DATA.EXP_ITEM_SPEC || []).forEach(function (sp) {
        var it2 = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === sp.id) it2 = x; });
        if (!it2) return;
        if (it2.amount !== sp.amount) bad.push(sp.id + ':amount');
        if (it2.capLv) bad.push(sp.id + ':capLv');
        if (sp.amount % 10000 !== 0) bad.push(sp.id + ':wan');
      });
      check('§173①b 全族 11 档无 capLv 残留 · 面额全为整数万', bad.length === 0, bad.join(','));
      check('§173①c desc 统一「将领经验+N」（旧上限文案零残留）',
        String(itBx.desc) === '将领经验+3000000'
        && !/最多培养至|最多至/.test(String(itBx.desc) + String(it10.desc)));
      check('§173①d ★ expCumOf / expItemCapOf 出口退役（无死代码）', (function () {
        var dS = fs173.readFileSync(p173.join(__dirname, 'js', 'data.js'), 'utf8');
        var dmS = fs173.readFileSync(p173.join(__dirname, 'js', 'domain.js'), 'utf8');
        var dmExec = dmS.replace(/\/\*[\s\S]*?\*\//g, '');
        return !/DATA\.expCumOf\s*=/.test(dS) && !/GAME\.expItemCapOf\s*=/.test(dmS)
          && !/expCumOf/.test(dmExec);
      })());
    })();

    /* ② 闸门（真调）：无等级限制 —— Lv60 / Lv200 都能用；资质闸仍在 */
    console.log('  --- ② 闸门（真调 expItemGrantOf） ---');
    (function () {
      var gg = { id: 'g173x', name: '样本', rank: 'tian', level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40,
        speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {} };
      var t1 = G.expItemGrantOf(gg, itBx);
      check('§173② Lv1 + 兵仙遗篇 → grant = 面额全额（300 万）· 无 capped 字段',
        t1.ok === true && t1.grant === 3000000 && t1.capped === undefined);
      gg.level = 60;
      check('§173②b ★ Lv60 → 仍可用（v89.171 的"只服务前期"已退役）',
        G.expItemGrantOf(gg, itBx).ok === true);
      gg.level = 200;
      check('§173②c Lv200 → 仍可用（不设等级限制）', G.expItemGrantOf(gg, it60).ok === true);
      var gFan = { id: 'g173f', name: '凡品样本', rank: 'fan', level: 60, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40,
        speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {} };
      var t4 = G.expItemGrantOf(gFan, itBx);
      check('§173②d 资质闸保留：凡品 Lv60 → 拒绝（与"道具限制"是两码事）',
        !t4.ok && /上限/.test(t4.msg || ''), t4.msg);
    })();

    /* ③ 全链路（真调 useItem / gainExpByItem）：Lv1 兵仙遗篇 → Lv49；再用一本继续涨 */
    console.log('  --- ③ 全链路（真调 useItem） ---');
    (function () {
      var st = G.state;
      var bkItems = st.items;
      var g0 = { id: 'g173c', name: '样本173', rank: 'tian', level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40,
        speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {},
        status: 'idle', cityId: null };
      st.generals.push(g0);
      try {
        st.items = { bingxian_yipian: 3 };
        var r1 = G.systems.useItem('bingxian_yipian', g0.id, {});
        check('§173③ ★ 真调 useItem：Lv1 用兵仙遗篇 → Lv' + g0.level + '（+300 万）· 道具 -1',
          r1.ok === true && g0.level === 49 && st.items.bingxian_yipian === 2,
          (r1.msg || '').slice(0, 90));
        var r2 = G.systems.useItem('bingxian_yipian', g0.id, {});
        check('§173③b 再用一本 → 继续涨（无"到线拒绝"）',
          r2.ok === true && g0.level > 49 && st.items.bingxian_yipian === 1,
          (r2.msg || '').slice(0, 90));
        var r3 = G.systems.gainExpByItem('bingxian_yipian', g0.id, 'one');
        check('§173③c 批量口同闸（one：ok 且消息无旧上限文案）',
          r3.ok === true && !/培养上限|只服务前期/.test(r3.msg || ''), (r3.msg || '').slice(0, 90));
      } finally {
        st.generals.pop();
        st.items = bkItems;
      }
    })();

    /* ④ 出征经验（真调 battleExp / expPenaltyOf）：perResource=500 · decay=0.8 · capPct 不动 */
    console.log('  --- ④ 出征经验（真调） ---');
    (function () {
      check('§173④ 参数拍板：perResource=500 · decay=0.8 · capPct=0.8（上限不变）',
        DATA.EXP_RULE.perResource === 500 && DATA.EXP_PENALTY.decay === 0.8
        && DATA.EXP_RULE.capPct === 0.8);
      var army10 = {};
      (DATA.WILD_DEFENSE[10] || []).forEach(function (e) { army10[e.id] = (e.min + e.max) / 2; });
      var r = G.battle.battleExp(army10, { level: 100 });
      var pct = r.cap > 0 ? Math.round(r.gain / r.cap * 100) : 0;
      check('§173④b ★ Lv100 打 Lv10 野地 → 拿满 0.8 级（实测 ' + pct + '%）',
        r.capped === true && r.gain === r.cap, 'gain=' + r.gain + ' cap=' + r.cap);
      var pen1 = G.battle.expPenaltyOf(120, 9);
      check('§173④c 惩罚放宽：差 1 档 ×0.8（旧 0.65）', Math.abs(pen1.mul - 0.8) < 1e-9, 'mul=' + pen1.mul);
      var pen3 = G.battle.expPenaltyOf(120, 7);
      check('§173④d 差 3 档 ×0.512（0.8³；旧 0.2746）',
        Math.abs(pen3.mul - Math.pow(0.8, 3)) < 1e-9, 'mul=' + pen3.mul);
    })();

    /* ⑤ 源码：唯一出口在册 · 旧形态零残留 */
    console.log('  --- ⑤ 源码（唯一出口 · 旧形态零残留） ---');
    (function () {
      var dS = fs173.readFileSync(p173.join(__dirname, 'js', 'data.js'), 'utf8');
      var dmS = fs173.readFileSync(p173.join(__dirname, 'js', 'domain.js'), 'utf8');
      var syS = fs173.readFileSync(p173.join(__dirname, 'js', 'systems.js'), 'utf8');
      var uS = fs173.readFileSync(p173.join(__dirname, 'js', 'ui.js'), 'utf8');
      check('§173⑤ 唯一出口：单用/批量/界面三处仍问 expItemGrantOf',
        /expItemGrantOf/.test(codeOf(syS, 'S.useItem = function'))
        && /expItemGrantOf/.test(codeOf(syS, 'S.gainExpByItem = function'))
        && /expItemGrantOf/.test(codeOf(uS, 'ui.setExpItem = function')));
      var dExec = dS.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
        .map(function (l) { return l.split('//')[0]; }).join('\n');
      check('§173⑤b data.js 可执行形态：capLv 零残留 · expCumOf 零残留',
        !/capLv/.test(dExec) && !/expCumOf/.test(dExec));
      check('§173⑤c ui.js：旧上限文案零残留（最多至 / 只服务前期 / dim 态）',
        !/最多至 Lv|只服务前期|btn sm dim/.test(uS));
    })();

    var arc173 = fs173.readFileSync(p173.join(__dirname, '需求档案.md'), 'utf8');
    check('§173⑥ 需求档案在册（v89.173 · 老板原文关键句逐字）',
      arc173.indexOf('v89.173') >= 0
      && arc173.indexOf('不作等级限制') >= 0
      && arc173.indexOf('尽量拿满0.8级经验') >= 0);
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');''')

# ============================================================
# E. e2e-test.js
# ============================================================
print('== e2e-test.js ==')

edit('e2e-test.js', 'E1 选择窗卡面判据',
  r'''  check('「＋」开出选择窗，列出道具的持有数与本档培养上限（v89.171：「最多至 LvN」）',
    !!expModal.querySelector('[data-action="exp-pick-item"]')
    && expModal.textContent.indexOf('练兵经验') >= 0
    /* v89.171：卡面改印「最多至 LvN」（面额不再上卡 —— 老板嫌"看起来很高"）；
       期望值从 DATA 现读，别写死（调阶梯时会假红；旧判据查「+面额」已随卡面改版退役）。 */
    && !!lianbing26 && expModal.textContent.indexOf('最多至 Lv' + lianbing26.capLv) >= 0,
    '练兵经验 最多至 Lv' + (lianbing26 ? lianbing26.capLv : '?'));''',
  r'''  check('「＋」开出选择窗，列出道具的持有数与面额（v89.173：「+X万」）',
    !!expModal.querySelector('[data-action="exp-pick-item"]')
    && expModal.textContent.indexOf('练兵经验') >= 0
    /* v89.173：卡面印「+X万」（整数万短写）；期望值从 DATA 现读，别写死
       （调面额时会假红；旧判据查「最多至 LvN」已随 capLv 退役）。 */
    && !!lianbing26 && expModal.textContent.indexOf('+' + Math.round(lianbing26.amount / 10000) + '万') >= 0,
    '练兵经验 +' + (lianbing26 ? Math.round(lianbing26.amount / 10000) : '?') + '万');''')

edit_range('e2e-test.js', 'E2 §171 段 → §173 段',
  '  /* ============================================================\n   * 171. v89.171（老板）：「经验道具…最多能只能前期升级，不然后边纯买道具了」',
  '      s171.items = JSON.parse(bk171.items);\n    }\n  })();',
  r'''  /* ============================================================
   * 173. v89.173（老板）：「不作等级限制…尽量拿满0.8级经验」
   *   —— 道具撤上限（真实 DOM）：Lv60 天授将也能用；卡面 = +X万。
   * ============================================================ */
  console.log('\n--- §173. 经验道具撤等级限制（v89.173 · 真实 DOM） ---');
  await (async function () {
    const s173 = G.state;
    const g173 = s173.generals.filter(function (x) { return !x.isLord; })[0] || s173.generals[0];
    const bk173 = { lv: g173.level, exp: g173.exp, rank: g173.rank, items: JSON.stringify(s173.items || {}) };
    try {
      s173.items = { bingxian_yipian: 2, lianbing_jingyan: 2 };
      g173.rank = 'tian'; g173.level = 1; g173.exp = 0;
      G.ui.closeAllModals();
      G.ui.openExpPick(g173.id);
      await sleep(80);
      let html173 = document.querySelector('#modal-root').innerHTML;
      check('v89.173 选择窗卡面印面额（「+300万」/「+10万」）',
        html173.indexOf('+300万') >= 0 && html173.indexOf('+10万') >= 0);
      check('v89.173 卡面旧上限文案零残留（「最多至」/「只服务前期」）',
        html173.indexOf('最多至') < 0 && html173.indexOf('只服务前期') < 0);
      /* ★ 核心：Lv60 也能用（v89.171 时代这里是"全族变暗 + 无按钮"） */
      G.ui.closeAllModals();
      g173.level = 60;
      G.ui.openExpPick(g173.id);
      await sleep(80);
      html173 = document.querySelector('#modal-root').innerHTML;
      check('v89.173 ★ Lv60 天授将 → 仍给使用按钮（不设等级限制）',
        html173.indexOf('data-action="gen-exp-item"') >= 0);
      check('v89.173 Lv60 无变暗态（btn sm dim 零残留）', html173.indexOf('btn sm dim') < 0);
      G.ui.closeAllModals();
    } finally {
      g173.level = bk173.lv; g173.exp = bk173.exp; g173.rank = bk173.rank;
      s173.items = JSON.parse(bk173.items);
    }
  })();''')

# ============================================================
# A. 需求档案.md
# ============================================================
print('== 需求档案.md ==')

edit('需求档案.md', 'A1 总览表加行',
  r'''| v89.171 | 2026-09-28 | 1 | **经验道具前期化**（老板：「经验道具的经验值设置基于什么考虑，看起来很高，建议最多能只能前期升级，不然后边纯买道具了」）—— 旧口径 = 占**全曲线总量百分比**取额（v89.73 立的"曲线一改自动跟随"锚）+ **全族无等级闸**：实测千古兵圣（40 万金）用在 Lv100 还能涨 **48 级**、Lv150 涨 33 级（"后边纯买道具"实锤）；改后 = 每档绑定**培养上限 capLv（10~60 · 全族 ≤ 凡品段）**：低于上限才能用、效果**到线即止**，量 = `expCumOf(capLv)`（从 Lv1 培养到上限的累计）—— 兵仙遗篇 24 万金 Lv1→**Lv50**（旧 86）、千古兵圣 Lv1→**Lv60**（旧 118）；闸门唯一出口 `expItemGrantOf`（单用/批量/界面三处同源），价格未动 | 已完成（详见 docs/v89171-经验道具前期化.md） |''',
  r'''| v89.171 | 2026-09-28 | 1 | **经验道具前期化**（老板：「经验道具的经验值设置基于什么考虑，看起来很高，建议最多能只能前期升级，不然后边纯买道具了」）—— 旧口径 = 占**全曲线总量百分比**取额（v89.73 立的"曲线一改自动跟随"锚）+ **全族无等级闸**：实测千古兵圣（40 万金）用在 Lv100 还能涨 **48 级**、Lv150 涨 33 级（"后边纯买道具"实锤）；改后 = 每档绑定**培养上限 capLv（10~60 · 全族 ≤ 凡品段）**：低于上限才能用、效果**到线即止**，量 = `expCumOf(capLv)`（从 Lv1 培养到上限的累计）—— 兵仙遗篇 24 万金 Lv1→**Lv50**（旧 86）、千古兵圣 Lv1→**Lv60**（旧 118）；闸门唯一出口 `expItemGrantOf`（单用/批量/界面三处同源），价格未动 | 已完成（详见 docs/v89171-经验道具前期化.md） |
| v89.173 | 2026-09-28 | 3 | **道具撤等级限制 + 领取面额取整 + 出征经验放宽**（老板：「已下架的就不要拿出来讨论了。那就这样，不作等级限制，对道具经验取整，练兵10W，治军100W，兵仙300W，兵圣450W。出征带来的经验体验调高一点，出征上限不变，但出征对象的等级和所得的经验可以要求低一点，尽量拿满0.8级经验」）—— ① 撤 v89.171 的 capLv / 到线即止（`expItemCapOf` 删除 · `expCumOf` 退役），道具改**固定整数面额**（10/100/300/450 万）、任何等级可用（资质上限闸保留）；② 战斗经验 `perResource` 1000→500 · 越级惩罚 `decay` 0.65→0.8（capPct 0.8 不变）——实测满格 26/140→**34/140**，Lv100/120/150 打 Lv10 野地 86%/68%/52%→**100%** | 已完成（详见 docs/v89173-道具面额与出征经验.md） |''')

# 明细节追加（文件末尾）
edit('需求档案.md', 'A2 明细节追加',
  r'''- 已下架档（裨将手记等 7 档）仍可能从奖励渠道获得，同样受各自上限约束。''',
  r'''- 已下架档（裨将手记等 7 档）仍可能从奖励渠道获得，同样受各自上限约束。

---

## v89.173（道具撤等级限制 + 出征经验放宽 · 老板 1 条合 3 事）

### ① 老板原文（逐字）

> 已下架的就不要拿出来讨论了。那就这样，不作等级限制，对道具经验取整，练兵10W，治军100W，兵仙300W，兵圣450W。出征带来的经验体验调高一点，出征上限不变，但出征对象的等级和所得的经验可以要求低一点，尽量拿满0.8级经验

### ② 落地（覆盖 v89.171 的 capLv 口径）

- **道具（撤限制 + 取整）**：
  - 撤 v89.171 的 `capLv`（培养上限 10~60）与「到线即止」——`expItemCapOf` 整条删除、
    `expCumOf` 退役（无消费者）；闸门 `expItemGrantOf` 只剩**资质上限闸**（凡品 60 …
    天授 240 —— 将领自身的养成口径，与"道具限制"是两码事）；
  - 面额改**固定整数**：练兵 **10 万** / 治军 **100 万** / 兵仙 **300 万** / 兵圣 **450 万**；
    商城下架 7 档（老板「不要拿出来讨论」）按同口径就近代整为整数万冻结（不再联动曲线）；
  - 界面：撤「最多至 LvN」/ 变暗 / toast，卡面改印「+X万」（整数万短写）；
  - 折算（探针实测）：练兵 10 万 → Lv1→**Lv11** · 治军 100 万 → **Lv30** ·
    兵仙 300 万 → **Lv49** · 兵圣 450 万 → **Lv59**。
- **出征经验（上限不变 · capPct 0.8）**：
  - `perResource` 1000 → **500**（拿满 0.8 级所需的歼灭量减半）；
  - `EXP_PENALTY.decay` 0.65 → **0.8**（打低档野地惩罚放宽：1 档 80% · 2 档 64% · 3 档 51%）；
  - 实测（探针 probe_v89173a · 14 将级 × 10 野地矩阵）：**满格 26/140 → 34/140**；
    Lv100/120/150 打 Lv10 野地从 86%/68%/52% → **100%**；Lv50/60 拿满起点 Lv10 → **Lv9**；
    Lv10 打 Lv6 从 38.8% → 77.6%。

### ③ 验证与复现

- `node .workbuddy/tools/probe/probe_v89173a_battle_exp.js`（新旧矩阵 + 道具折算 + 面额对账）；
- `node smoke-test.js`（§173 六组 · §170① 随口径升级）；
- e2e：`NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node e2e-test.js`；
- 实机：商城/选择窗截图。

### ④ 诚实缺口

- 出征经验提的是"绝对口径"（每场实得）——升级节奏（练功/战斗相对口径）本就封顶
  0.8 级/场，本次只是让更多组合"摸到封顶"；Lv200+ 天授将打 Lv10 野地仍不满（72%），
  后期路径是打城池（守军规模更大）；
- 下架 7 档的冻结面额为"就近代整"（±3% 内），若将来重新上架需先与老板对一遍阶梯。''')

# ============================================================
print('== 落盘 ==')
for p, s in FILES.items():
    save(p, s)
    print('  saved ' + p)

print('== 语法哨兵 ==')
ok = True
for p in ['smoke-test.js', 'e2e-test.js']:
    r = subprocess.run(['node', '--check', os.path.join(ROOT, p)], capture_output=True, text=True)
    print(('  PASS ' if r.returncode == 0 else '  FAIL ') + p + ' ' + (r.stderr.strip()[:200] if r.returncode else ''))
    ok = ok and r.returncode == 0
sys.exit(0 if ok else 1)
