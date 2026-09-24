# -*- coding: utf-8 -*-
"""v89.116 补丁 I：测试适配（10 处旧口径）+ 新增 §96（九条需求各一条断言）

只改【必须改】的旧断言（口径真的变了），其余一律不动；新增断言放在末尾 §96。
"""
import io, os, sys

R = 'E:/Deepseekdb/'


def main():
    # ============================================================
    # ① smoke-test.js
    # ============================================================
    p = R + 'smoke-test.js'
    s = io.open(p, encoding='utf-8').read()
    edits = []

    # -- 1) 下拉框白名单：新增战场动作下拉（bt-s-）
    edits.append((
        """        || /id="bt-t-/.test(tag)                         /* 战场界面逐兵种目标（v89.87） */""",
        """        || /id="bt-t-/.test(tag)                         /* 战场界面逐兵种目标（v89.87） */
        || /id="bt-s-/.test(tag)                         /* v89.116：战场界面动作下拉（前进/驻守/后退） */""",
        '白名单加 bt-s-'))

    # -- 2) 伤兵块：降级为"指引行"
    edits.append((
        """  check('实测：伤兵块含数量 / 治疗费 / 治疗按钮', (function () {
    var s = G.state, bk = s.wounded;
    s.wounded = 1234;
    var h = G.ui.woundedBlock('xiaochang');
    s.wounded = bk;
    return /伤兵营/.test(h) && /1,234/.test(h) && /12,340/.test(h)
      && /data-action="heal-wounded"/.test(h) && /data-heal-host="xiaochang"/.test(h);
  })());
  check('实测：伤兵为 0 时按钮禁用（不给空白操作）', (function () {
    var s = G.state, bk = s.wounded;
    s.wounded = 0;
    var h = G.ui.woundedBlock('view');
    s.wounded = bk;
    return /disabled/.test(h) && /dim/.test(h);
  })());""",
        """  /* v89.116（老板「伤兵营放在军务处下」）：伤兵营**唯一落点 = 军务·军务处**——
     校场 / 行军 / 行军弹窗只剩一行**指引**（数量 + 治疗费 + 去军务处的按钮），
     治疗按钮本体在军务处那张卡里（见 §96 的军务处断言）。 */
  check('实测：伤兵块含数量 / 治疗费 / 去军务处的指引按钮（治疗本体已收归军务处）', (function () {
    var s = G.state, bk = s.wounded;
    s.wounded = 1234;
    var h = G.ui.woundedBlock('xiaochang');
    s.wounded = bk;
    return /伤兵营/.test(h) && /1,234/.test(h) && /12,340/.test(h)
      && /data-action="go-affairs"/.test(h) && /data-heal-host="xiaochang"/.test(h)
      && h.indexOf('data-action="heal-wounded"') < 0;   /* 不再各摆一套治疗按钮 */
  })());
  check('实测：伤兵为 0 时也给指引（不再需要"禁用态按钮"）', (function () {
    var s = G.state, bk = s.wounded;
    s.wounded = 0;
    var h = G.ui.woundedBlock('view');
    s.wounded = bk;
    return /data-action="go-affairs"/.test(h) && /伤兵营/.test(h);
  })());""",
        '伤兵块两条升级'))

    # -- 3) 守城俘获：多行调用（enemyLossBy 显式）
    edits.append((
        """        return /captiveGain\\(city, result, \\{ kind: 'defense' \\}, result\\.atkLoss/.test(seg);""",
        """        /* v89.116：多传一个"敌军逐兵种损失表"（俘虏营要按兵种列清单）——
           断言放宽到"同一批参数 + result.atkLossBy 也在" */
        return /captiveGain\\(city, result, \\{ kind: 'defense' \\}/.test(seg)
          && /result\\.atkLoss \\|\\| 0, result\\.atkLossBy\\)/.test(seg);""",
        '守城俘获断言'))

    # -- 4) D：俘获口径 → 入营（不再直接加人口）
    edits.append((
        """    check('D：俘获口径（8% · 上限 3000 · 不足 10 不收 · **全战斗**含野地/防御战）', (function () {
      var Rr = G.res(c99); Rr.pop = 1000;
      var tF = { kind: 'fort', name: '测点' };
      var tW = { kind: 'wild', name: '野地' };
      var tD = { kind: 'defense', name: '守城' };
      var r1 = G.battle.captiveGain(c99, { defLoss: 1000 }, tF);
      var r2 = G.battle.captiveGain(c99, { defLoss: 1000 }, tW);            /* v89.113：野地也俘 */
      var r3 = G.battle.captiveGain(c99, { defLoss: 100 }, tF);
      var r4 = G.battle.captiveGain(c99, { defLoss: 100000 }, tF);
      var r5 = G.battle.captiveGain(c99, { defLoss: 0 }, tD, 1000);         /* v89.113：防御战显式口径 */
      return r1.gain === 80 && r2.gain === 80 && r3.gain === 0 && r4.gain === 3000 && r5.gain === 80
        && Rr.pop === 1000 + 80 + 80 + 3000 + 80;
    })());""",
        """    /* v89.116（老板「俘虏营也是…列出具体兵种及数量」）：俘获**不再当场加人口**，
       改为按兵种入 `s.captives`（俘虏营），由玩家在军务处「收编为民」或「释放」。
       折算口径（8% · 上限 3000 · 不足 10 不收 · 全战斗）一字未动。 */
    check('D：俘获口径（8% · 上限 3000 · 不足 10 不收 · 全战斗）→ 入**俘虏营**（逐兵种）', (function () {
      var Rr = G.res(c99); Rr.pop = 1000;
      var bkCap = JSON.parse(JSON.stringify(S99.captives || {}));
      S99.captives = {};
      var tF = { kind: 'fort', name: '测点' };
      var tW = { kind: 'wild', name: '野地' };
      var tD = { kind: 'defense', name: '守城' };
      var r1 = G.battle.captiveGain(c99, { defLoss: 1000 }, tF, null, { yibing: 600, changqiang: 400 });
      var r2 = G.battle.captiveGain(c99, { defLoss: 1000 }, tW);            /* v89.113：野地也俘 */
      var r3 = G.battle.captiveGain(c99, { defLoss: 100 }, tF);
      var r4 = G.battle.captiveGain(c99, { defLoss: 100000 }, tF);
      var r5 = G.battle.captiveGain(c99, { defLoss: 0 }, tD, 1000);         /* v89.113：防御战显式口径 */
      var camp = GAME.captivesTotalOf();
      /* r1 逐兵种拆分：80 按 600:400 分 → 义兵 48 / 长枪 32；r2/r4/r5 无明细 → unknown 桶 */
      var split = (r1.byType.yibing === 48 && r1.byType.changqiang === 32);
      var ok = r1.gain === 80 && r2.gain === 80 && r3.gain === 0 && r4.gain === 3000 && r5.gain === 80
        && Rr.pop === 1000                       /* ← 人口**不动**（改期到"收编"那一刻） */
        && split && camp === 80 + 80 + 3000 + 80 && (S99.captives.unknown || 0) === 80 + 3000 + 80;
      /* 收编为民：一次加人口（与旧口径同一笔账） */
      var cons = GAME.doConscriptCaptives(c99.id);
      ok = ok && cons.ok && Rr.pop === 1000 + camp && GAME.captivesTotalOf() === 0;
      S99.captives = bkCap;
      return ok;
    })());""",
        'D 俘获口径升级'))

    # -- 5) D：实战集成 → 战报写"入营"、人口在收编那一刻增加
    edits.append((
        """      var r = G.battle.expedition({ kind: 'fort', x: fD.x, y: fD.y }, 'occupy', { gongjian: 40000 }, gD.id);""",
        """      S99.captives = {};
      var r = G.battle.expedition({ kind: 'fort', x: fD.x, y: fD.y }, 'occupy', { gongjian: 40000 }, gD.id);""",
        'D 实战集成准备'))

    # -- 6) 待阅逸闻：6×5 + 翻页 + 字号
    edits.append((
        """    check('⑨ 待阅逸闻固定 4 列 × 5 行（20 格）· 空格子占位', (function () {
      return /ui\\.SG_GRID_SLOTS = 20/.test(u4) && /class="sg-grid"/.test(u4)
        && /sg-cell empty/.test(u4)
        && /\\.sg-grid \\{ display: grid; grid-template-columns: repeat\\(4,/.test(h4);
    })());""",
        """    /* v89.116（老板「设计更紧凑，如5行*6列，增加翻页，全部列出」）：
       6 列 × 5 行 = 30 格一页 + 底部条翻页（旧口径是固定 20 格、多的不列出）。 */
    check('⑨ 待阅逸闻 6 列 × 5 行（30 格/页）· 空格子占位 · 翻页列全', (function () {
      return /ui\\.SG_GRID_COLS = 6/.test(u4) && /ui\\.SG_GRID_ROWS = 5/.test(u4)
        && /ui\\.SG_PER_PAGE = ui\\.SG_GRID_COLS \\* ui\\.SG_GRID_ROWS/.test(u4)
        && /ui\\.pagerHTML\\('sg', list\\.length, PER\\)/.test(u4)
        && /class="sg-grid"/.test(u4) && /sg-cell empty/.test(u4)
        && /\\.sg-grid \\{ display: grid; grid-template-columns: repeat\\(6,/.test(h4);
    })());""",
        '待阅逸闻断言升级'))

    # ---------------- 应用 ----------------
    for old, new, tag in edits:
        n = s.count(old)
        if n != 1:
            print('!! [%s] smoke 锚点匹配 %d 次 → 中止' % (tag, n))
            return 1
        s = s.replace(old, new, 1)
        print('  ✓ smoke: %s' % tag)

    bak = R + '.workbuddy/backup/v89116/'
    b = io.open(bak + 'smoke-test.js', encoding='utf-8').read()
    d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
    if d0 != 0:
        print('!! smoke 花括号净变化 %+d → 中止' % d0)
        return 1
    tmp = p + '.tmp116i'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, p)
    print('  → 落盘 smoke-test.js（净 %+d）' % d0)

    # ============================================================
    # ② e2e-test.js：校场伤兵营 → 指引 + 军务处治疗
    # ============================================================
    p2 = R + 'e2e-test.js'
    t = io.open(p2, encoding='utf-8').read()
    OLD = """  check('校场弹窗渲染伤兵营与治疗按钮',
    xc21_v21.indexOf('data-heal-host="xiaochang"') >= 0
    && xc21_v21.indexOf('data-action="heal-wounded"') >= 0);"""
    NEW = """  /* v89.116（老板「伤兵营放在军务处下，俘虏营也是」）：校场只留**指引**，
     治疗按钮收归「军务 · 军务处」—— 这里先验指引，治疗在下面跳过去再点。 */
  check('校场弹窗渲染伤兵营指引（去军务处；治疗本体已收归军务处）',
    xc21_v21.indexOf('data-heal-host="xiaochang"') >= 0
    && xc21_v21.indexOf('data-action="go-affairs"') >= 0
    && xc21_v21.indexOf('data-action="heal-wounded"') < 0);"""
    if t.count(OLD) != 1:
        print('!! e2e 校场断言匹配 %d 次 → 中止' % t.count(OLD))
        return 1
    t = t.replace(OLD, NEW, 1)

    OLD2 = """  /* 点治疗：兵员归队 + 弹窗原地刷新（不再「点了没反应」） */
  const armyBefore21_v21 = JSON.parse(JSON.stringify(c21_v21.army || {}));
  s21_v21.res.gold = 1e7;
  const healBtn21_v21 = document.querySelector('#modal-root [data-action="heal-wounded"]');
  check('治疗按钮可点击（伤兵 > 0 时不禁用）', !!healBtn21_v21 && !healBtn21_v21.disabled);
  click(healBtn21_v21);
  await sleep(140);
  check('治疗伤兵后兵员入城且伤兵归零',
    s21_v21.wounded === 0 && (c21_v21.army.yibing || 0) === (armyBefore21_v21.yibing || 0) + 777,
    (armyBefore21_v21.yibing || 0) + ' → ' + (c21_v21.army.yibing || 0));
  check('弹窗原地刷新（仍在校场面板且伤兵显示为 0）',
    document.querySelector('#modal-root').innerHTML.indexOf('data-heal-host="xiaochang"') >= 0
    && document.querySelector('#modal-root').innerHTML.indexOf('7,770') < 0);
  G.ui.closeModal();"""
    NEW2 = """  /* 点指引 → 军务·军务处 → 在那里治疗（兵员归队 + 面板原地刷新） */
  const armyBefore21_v21 = JSON.parse(JSON.stringify(c21_v21.army || {}));
  s21_v21.res.gold = 1e7;
  const goAff21 = document.querySelector('#modal-root [data-action="go-affairs"]');
  check('校场指引按钮可点（跳军务处）', !!goAff21);
  if (goAff21) { click(goAff21); await sleep(160); }
  check('跳到军务 · 军务处（页签正确）', G.ui.view === 'march' && G.ui._marchTab === 'affairs',
    (G.ui.view || '-') + '/' + (G.ui._marchTab || '-'));
  const affHtml21 = vc.innerHTML;
  check('军务处列出伤兵营（逐兵种明细 + 治疗按钮）',
    affHtml21.indexOf('伤兵营') >= 0 && affHtml21.indexOf('data-action="heal-wounded"') >= 0
    && affHtml21.indexOf('俘虏营') >= 0);
  const healBtn21_v21 = document.querySelector('#view-container [data-action="heal-wounded"]');
  check('治疗按钮可点击（伤兵 > 0 时不禁用）', !!healBtn21_v21 && !healBtn21_v21.disabled);
  if (healBtn21_v21) { click(healBtn21_v21); await sleep(160); }
  check('治疗伤兵后兵员入城且伤兵归零',
    s21_v21.wounded === 0 && (c21_v21.army.yibing || 0) === (armyBefore21_v21.yibing || 0) + 777,
    (armyBefore21_v21.yibing || 0) + ' → ' + (c21_v21.army.yibing || 0));
  check('面板原地刷新（军务处仍开着且伤兵显示为 0）',
    vc.innerHTML.indexOf('伤兵营') >= 0
    && vc.innerHTML.indexOf('7,770') < 0);
  G.ui.setView('city');
  await sleep(60);"""
    if t.count(OLD2) != 1:
        print('!! e2e 治疗段匹配 %d 次 → 中止' % t.count(OLD2))
        return 1
    t = t.replace(OLD2, NEW2, 1)

    # 公文页签：五类 → 四类（烽火移出）
    OLD3 = """  check('公文页含五类页签', document.querySelectorAll('.doc-tabs [data-action="doc-tab"]').length === 5,
    document.querySelectorAll('.doc-tabs [data-action="doc-tab"]').length + ' 个页签');"""
    NEW3 = """  /* v89.116（老板「公文里不要烽火这个板块」）：烽火移出公文 → 页签 5 → **4**。
     断言同时钉住"烽火页签不存在"（防回退），以及它仍能在军务·烽火里看流水。 */
  check('公文页含四类页签（烽火已移出）',
    document.querySelectorAll('.doc-tabs [data-action="doc-tab"]').length === 4,
    document.querySelectorAll('.doc-tabs [data-action="doc-tab"]').length + ' 个页签');
  check('公文页签里没有烽火（烽火流水在军务 · 烽火）',
    !document.querySelector('.doc-tabs [data-v="beacon"]'));"""
    if t.count(OLD3) != 1:
        print('!! e2e 页签数匹配 %d 次 → 中止' % t.count(OLD3))
        return 1
    t = t.replace(OLD3, NEW3, 1)

    OLD4 = """  /* 切页签：正文真的换（烽火页 ≠ 战报页），且动作走 ui.setDocTab */
  const bcTab = document.querySelector('.doc-tabs [data-v="beacon"]');
  if (bcTab) {
    click(bcTab); await sleep(80);
    const bh = G.ui.docBodyHTML('beacon');
    check('可切换公文页签（切换到烽火页）', G.ui._docTab === 'beacon'
      && document.querySelector('#doc-body') !== null
      && bh.indexOf('烽火未起') >= 0 || bh.indexOf('bb-line beacon') >= 0, '页签=' + G.ui._docTab);
    G.ui.setDocTab('war'); await sleep(60);
  }"""
    NEW4 = """  /* 切页签：正文真的换（侦查页 ≠ 战报页），且动作走 ui.setDocTab；
     另验"烽火直调 → 给一句已移出的指引"（老档 _docTab 残留也不会渲染旧板块）。 */
  const scTab = document.querySelector('.doc-tabs [data-v="scout"]');
  if (scTab) {
    click(scTab); await sleep(80);
    check('可切换公文页签（切换到侦查页）', G.ui._docTab === 'scout'
      && document.querySelector('#doc-body') !== null, '页签=' + G.ui._docTab);
    const bh = G.ui.docBodyHTML('beacon');
    check('公文直调烽火 → 只给"已移出"指引（不再渲染烽火流水）',
      bh.indexOf('已移出公文') >= 0 && bh.indexOf('bb-line beacon') < 0);
    G.ui.setDocTab('beacon'); await sleep(60);       /* 不在页签里的类别：拒绝并回落战报 */
    check('切换被移出的类别会被拒（回落战报页）', G.ui._docTab === 'war');
    G.ui.setDocTab('war'); await sleep(60);
  }"""
    if t.count(OLD4) != 1:
        print('!! e2e 页签切换匹配 %d 次 → 中止' % t.count(OLD4))
        return 1
    t = t.replace(OLD4, NEW4, 1)

    b2 = io.open(bak + 'e2e-test.js', encoding='utf-8').read()
    d2 = (t.count('{') - t.count('}')) - (b2.count('{') - b2.count('}'))
    if d2 != 0:
        print('!! e2e 花括号净变化 %+d → 中止' % d2)
        return 1
    tmp2 = p2 + '.tmp116i'
    io.open(tmp2, 'w', encoding='utf-8', newline='\n').write(t)
    os.replace(tmp2, p2)
    print('  → 落盘 e2e-test.js（净 %+d）' % d2)
    print('补丁 I 完成')
    return 0


sys.exit(main())
