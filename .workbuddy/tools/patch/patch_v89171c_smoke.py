# -*- coding: utf-8 -*-
"""v89.171 补丁 C（smoke）：
  升级 4 处旧口径断言（pct 取额 / 三消费点出口 / v26 两条 / §170①）
  + 新增 §171 段（培养上限 · 到线即止 · 全链路真调）。"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, old, new, guard):
    s = rd('smoke-test.js')
    if guard in s:
        print('  [skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, '锚点失配 %s count=%d' % (tag, c)
    wr('smoke-test.js', s.replace(old, new))
    print('  [ ok ] ' + tag)

# S1. total 注释里的取额口径
rep('S1 total 注释',
    '    /* total 必须等于 Σ need（经验道具按 pct×total 取额，两处不许各算各的） */',
    '    /* total 必须等于 Σ need（v89.171：经验道具按 expCumOf(capLv) 取额，两处不许各算各的） */',
    guard='v89.171：经验道具按 expCumOf(capLv) 取额')

# S2. pct 断言 → capLv 断言
rep('S2 capLv 断言',
    """check('经验道具按 pct × total 取额（曲线一改自动跟随，不需手改面额）', (function () {
  var total = DATA.EXP_CURVE.total, bad = [];
  (DATA.EXP_ITEM_SPEC || []).forEach(function (sp) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === sp.id) it = x; });
    if (!it) return;
    if (it.amount !== Math.max(1, Math.round(total * sp.pct))) bad.push(sp.id);
  });
  return bad.length === 0 && total > 20000000;             /* 量级：与"240 级 100 万"匹配 */
})());""",
    """check('v89.171 经验道具按 capLv 累计取额（量 = expCumOf(上限) · 全族 10~60 · desc 带上限）', (function () {
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
})());""",
    guard='v89.171 经验道具按 capLv 累计取额')

# S3. 三消费点出口 → expItemGrantOf
rep('S3 三消费点出口',
    """  check('结构：三个消费点都先问同一个出口（单个 / 批量 / 界面面板）', (function () {
    var use = codeOf(syS66, 'S.useItem = function');
    var batch = codeOf(syS66, 'S.gainExpByItem = function');
    var panel = codeOf(uS66, 'ui.openExpPick = function');
    return /expBlockOf/.test(use) && /expBlockOf/.test(batch) && /expBlockOf/.test(panel)
      && use.length > 200 && batch.length > 200 && panel.length > 200;
  })());""",
    """  check('结构：三个消费点都先问同一个出口（v89.171：资质上限 + 培养上限 = expItemGrantOf）', (function () {
    var use = codeOf(syS66, 'S.useItem = function');
    var batch = codeOf(syS66, 'S.gainExpByItem = function');
    var panel = codeOf(uS66, 'ui.openExpPick = function');
    return /expItemGrantOf/.test(use) && /expItemGrantOf/.test(batch) && /expItemGrantOf/.test(panel)
      && use.length > 200 && batch.length > 200 && panel.length > 200;
  })());""",
    guard='资质上限 + 培养上限 = expItemGrantOf')

# S4a. v26 注释 1
rep('S4a v26 注释1',
    """    /* v89.170：面额 = pct × total（现 ~2.1 万/个），1 个足够升 Lv1（~1 千）→ till 停。
       数量给 3 个是为了验"用不完不白扣"（used=1、剩 2）。 */""",
    """    /* v89.171：面额 = expCumOf(10)（~7.4 万/个）—— 1 个即到该档上限（Lv10）→ till 停。
       数量给 3 个是为了验"用不完不白扣"（used=1、剩 2）。 */""",
    guard='面额 = expCumOf(10)')

# S4b. v26 注释 2 + 断言（gain 与出口同源）
rep('S4b v26 额度断言',
    """    /* v89.82：面额 = pct × EXP_CURVE.total，从 DATA 现读（写死 1000 会在调曲线时假红） */
    var _it80 = (DATA.ITEMS || []).filter(function (x) { return x.id === 'bingfa_xinde'; })[0];
    var ok = r.ok && r.used === 1 && r.gain === (_it80 && _it80.amount) && st.items.bingfa_xinde === 4;""",
    """    /* v89.171：额度走**闸门**核对（含到线折算）；gain 与出口同源（含神器加成 —— 与 gainExp 同一算式，
       不再用"面额"直比，防"入口改了、判据没跟"） */
    var _it80 = (DATA.ITEMS || []).filter(function (x) { return x.id === 'bingfa_xinde'; })[0];
    var _gt80 = G.expItemGrantOf({ level: 1, exp: 0, name: '样本', rank: 'tian' }, _it80);
    var _bg80 = 1 + ((G.artifactBonusNum && G.artifactBonusNum('genExpPct')) || 0);
    var _exp80 = Math.round(((_gt80 && _gt80.grant) || 0) * _bg80);
    var ok = r.ok && r.used === 1 && r.gain === _exp80 && st.items.bingfa_xinde === 4;""",
    guard='var _gt80 = G.expItemGrantOf(')

# S5. §170① 升级（走真实闸门）
rep('S5 §170①',
    """      var r = G.battle.gainExp(g, it.amount, '§170');
      /* 独立算法对照（逐级扣减），并用"实际入账额"（可能含神器经验加成）：
         这样断言与"曲线形状"同源，又不受神器加成或 round 细节影响。 */
      var amt = it.amount;
      if (G.artifactBonusNum) amt = Math.round(amt * (1 + G.artifactBonusNum('genExpPct')));
      var lv = 1, e = amt;
      while (lv < 240) { var nd = G.expNeedOf({ level: lv }); if (e < nd) break; e -= nd; lv++; }
      check('§170① ★ 兵仙遗篇（24 万金）从 Lv1 → Lv' + g.level + '（旧口径 177 · 上限 Lv90）',
        g.level === lv && g.level <= 90 && g.level >= 80,
        'Lv' + g.level + '（面额 ' + amt + ' · 逐级扣减期望 Lv' + lv + '）');""",
    """      /* v89.171：走**真实闸门**（额度折算 + 到线上限），不再直接喂面额 ——
         兵仙遗篇现在"到线即止"（培养上限 Lv50 · 全族 60 封顶）。 */
      var gt = G.expItemGrantOf(g, it);
      var r = G.battle.gainExp(g, gt.grant, '§170');
      check('§170①（v89.171 更新）兵仙遗篇从 Lv1 → Lv' + g.level + '（到线即止 · 培养上限 Lv50）',
        gt.ok === true && gt.capped === true && g.level === 50 && it.capLv === 50,
        'Lv' + g.level + '（入账 ' + (r && r.gain) + ' · 面额 ' + it.amount + '）');""",
    guard='§170①（v89.171 更新）兵仙遗篇从 Lv1')

# S6. 新增 §171 段（插在最终"结果"行之前）
H171 = """  /* ============================================================
   * 171. v89.171（老板）：「经验道具的经验值设置基于什么考虑，看起来很高，建议最多能
   *      只能前期升级，不然后边纯买道具了」
   *   —— 每档绑定培养上限 capLv（10~60）：低于上限才能用、到线即止。
   * ============================================================ */
  console.log('\\n===== 171. v89.171 经验道具「前期化」（培养上限 · 到线即止） =====');
  (function () {
    var fs171 = require('fs'), p171 = require('path');
    var itBx = null, it10 = null, it60 = null;
    (DATA.ITEMS || []).forEach(function (x) {
      if (x.id === 'bingxian_yipian') itBx = x;
      if (x.id === 'lianbing_jingyan') it10 = x;
      if (x.id === 'bingsheng') it60 = x;
    });

    /* ① 数据层：全族有上限 · 表序单调 · 量 = expCumOf(上限) */
    console.log('  --- ① 数据层（EXP_ITEM_SPEC × capLv） ---');
    (function () {
      var spec = DATA.EXP_ITEM_SPEC || [], bad = [];
      spec.forEach(function (sp) {
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === sp.id) it = x; });
        if (!it) return;
        if (!(it.capLv > 0) || it.capLv !== sp.capLv) bad.push(sp.id + ':cap');
        if (it.amount !== Math.max(1, DATA.expCumOf(sp.capLv))) bad.push(sp.id + ':amount');
      });
      var caps = spec.map(function (sp) { return sp.capLv; });
      check('§171① 全族 11 档都有培养上限 · 表序单调（10→60）· 量 = expCumOf（上限）· 全族 ≤ 60',
        bad.length === 0 && caps.length === 11
        && caps.every(function (c, i) { return i === 0 || c > caps[i - 1]; })
        && caps.every(function (c) { return c <= 60; }),
        bad.join(',') || ('caps=' + caps.join(',')));
      check('§171①b expCumOf 与 total 同源（expCumOf(241) === 总量）',
        DATA.expCumOf(241) === DATA.EXP_CURVE.total);
      check('§171①c 道具描述写明「最多培养至 LvN」',
        String(itBx.desc || '').indexOf('最多培养至 Lv50') >= 0
        && String(it10.desc || '').indexOf('最多培养至 Lv10') >= 0);
    })();

    /* ② 闸门（真调）：到线拒绝 / 到线即止 / 全族同闸 */
    console.log('  --- ② 闸门（真调 expItemGrantOf） ---');
    (function () {
      var g = { id: 'g171x', name: '样本', rank: 'tian', level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40,
        speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {} };
      var t1 = G.expItemGrantOf(g, itBx);
      check('§171② Lv1 + 兵仙遗篇 → 可用 · 到线（额度 = expCumOf(50)）',
        t1.ok && t1.capped === true && t1.grant === DATA.expCumOf(50));
      g.level = 45;
      var t2 = G.expItemGrantOf(g, it60);
      check('§171②b Lv45 + 千古兵圣 → 额度 = 到 Lv60 的剩余（< 面额）',
        t2.ok && t2.grant === DATA.expCumOf(60) - DATA.expCumOf(45) && t2.grant < it60.amount,
        U.numText(t2.grant, 0) + ' / 面额 ' + U.numText(it60.amount, 0));
      g.level = 50;
      var t3 = G.expItemGrantOf(g, itBx);
      check('§171②c Lv50（= 上限）→ 拒绝 · 消息含「只服务前期」',
        !t3.ok && /只服务前期/.test(t3.msg), t3.msg);
      g.level = 60;
      check('§171②d Lv60 → 全族 11 档一个都用不了（"后边纯买道具"构造上杜绝）',
        (DATA.ITEMS || []).filter(function (x) { return x.type === 'exp'; })
          .every(function (x) { return !G.expItemGrantOf(g, x).ok; }));
    })();

    /* ③ 全链路（真调 useItem / gainExpByItem）：等级与道具数量双验证 */
    console.log('  --- ③ 全链路（真调 useItem / gainExpByItem） ---');
    (function () {
      var st = G.state;
      var bkItems = st.items;
      var g0 = { id: 'g171c', name: '样本171', rank: 'tian', level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40,
        speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {},
        status: 'idle', cityId: null };
      st.generals.push(g0);
      try {
        st.items = { bingxian_yipian: 3 };
        var r1 = G.systems.useItem('bingxian_yipian', g0.id, {});
        check('§171③ ★ 真调 useItem：Lv1 用兵仙遗篇 → Lv' + g0.level + '（到线）· 道具 -1',
          r1.ok && g0.level === 50 && st.items.bingxian_yipian === 2,
          (r1.msg || '').slice(0, 90));
        var r2 = G.systems.useItem('bingxian_yipian', g0.id, {});
        check('§171③b 到线后拒绝 · 道具**不扣**（防"白烧"）',
          !r2.ok && /只服务前期/.test(r2.msg) && st.items.bingxian_yipian === 2);
        var r3 = G.systems.gainExpByItem('bingxian_yipian', g0.id, 'till');
        check('§171③c 批量口同闸（到线时 ok=false 且消息明确）',
          !r3.ok && /只服务前期/.test(r3.msg || ''), (r3.msg || '').slice(0, 90));
      } finally {
        st.generals.pop();
        st.items = bkItems;
      }
    })();

    /* ④ 源码：闸门唯一出口 · 旧取额形态零残留 */
    console.log('  --- ④ 源码（唯一出口 · 旧形态零残留） ---');
    (function () {
      var dS171 = fs171.readFileSync(p171.join(__dirname, 'js', 'data.js'), 'utf8');
      var dmS171 = fs171.readFileSync(p171.join(__dirname, 'js', 'domain.js'), 'utf8');
      var syS171 = fs171.readFileSync(p171.join(__dirname, 'js', 'systems.js'), 'utf8');
      var uS171 = fs171.readFileSync(p171.join(__dirname, 'js', 'ui.js'), 'utf8');
      var use = codeOf(syS171, 'S.useItem = function');
      var batch = codeOf(syS171, 'S.gainExpByItem = function');
      var panel = codeOf(uS171, 'ui.openExpPick = function');
      check('§171④ 唯一出口：单用/批量/界面三处都问 expItemGrantOf',
        /expItemGrantOf/.test(use) && /expItemGrantOf/.test(batch) && /expItemGrantOf/.test(panel),
        [use.length, batch.length, panel.length].join('/'));
      var exec171 = (dS171 + '\\n' + dmS171).replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')
        .split('\\n').map(function (l) { return l.split('//')[0]; }).join('\\n');
      check('§171④b 旧 pct 取额形态零残留（可执行形态）',
        !/sp\\.pct/.test(exec171) && !/total \\* sp/.test(exec171));
      check('§171④c 出口在册（expItemCapOf / expItemGrantOf / expCumOf）',
        /GAME\\.expItemGrantOf = function/.test(dmS171) && /GAME\\.expItemCapOf = function/.test(dmS171)
        && /DATA\\.expCumOf = function/.test(dS171));
    })();

    var arc171 = fs171.readFileSync(p171.join(__dirname, '需求档案.md'), 'utf8');
    check('§171⑤ 需求档案在册（v89.171 · 老板原文关键句逐字）',
      arc171.indexOf('v89.171') >= 0
      && arc171.indexOf('经验道具的经验值设置基于什么考虑') >= 0
      && arc171.indexOf('最多能只能前期升级') >= 0
      && arc171.indexOf('后边纯买道具') >= 0);
  })();

"""
rep('S6 插入 §171 段',
    """  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
    """  })();

""" + H171 + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
    guard='171. v89.171（老板）')

print('OK')
