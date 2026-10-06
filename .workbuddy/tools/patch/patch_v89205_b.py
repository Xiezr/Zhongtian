# -*- coding: utf-8 -*-
# v89.205 批次 B：测试升级（§191⑦b / §194⑥ 两条连带翻红）+ 新增 §205 段（smoke + e2e）
#                  + 版本号 v89.205（main.js + smoke §199④）
import io

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    assert '\r\n' not in s, 'CRLF leak!'
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

SMOKE = 'E:/Deepseekdb/smoke-test.js'
E2E = 'E:/Deepseekdb/e2e-test.js'
MAIN = 'E:/Deepseekdb/js/main.js'

# ---------------- B1: §191⑦b 升级（挂件行退役 → 选择窗承担回显/卸下） ----------------
s = rd(SMOKE)
if '§191⑦b（v89.205 口径）' in s:
    print('[skip] B1 §191⑦b 已升级')
else:
    old = """    check('§191⑦b 宝具按钮高亮跟随已佩 + 选择窗沿用既有出口（合成区随窗）', (function () {
      var u = stripComment(uS191);
      return /GAME\\.attachOf\\(g, 'bao'\\) \\? ' gold' : ''/.test(u)
        && /GAME\\.attachOf\\(g, slot\\.id\\)/.test(u);
    })());"""
    assert s.count(old) == 1, 'B1 count=' + str(s.count(old))
    new = """    /* v89.205（老板）规则变更：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」——
       挂件行整行退役：面板侧 `<span class="gp-sub gp-attach186">` 零残留；已佩回显与卸下
       全部迁入选（attach-pick）择窗。本条由"选择窗沿用既有出口"升级为"选择窗承担回显/卸下"。 */
    check('§191⑦b（v89.205 口径）宝具按钮高亮跟随已佩 + 选择窗承担回显/卸下（合成区随窗）', (function () {
      var u = stripComment(uS191);
      return /GAME\\.attachOf\\(g, 'bao'\\) \\? ' gold' : ''/.test(u)     /* 装备栏入口高亮（仍在） */
        && /GAME\\.attachOf\\(g, slotId\\)/.test(u)                       /* v89.205：选择窗「当前件」回显 */
        && u.indexOf('data-action="attach-off"') >= 0                 /* v89.205：卸下迁入选择窗 */
        && u.indexOf('gp-attach186') < 0;                             /* v89.205：挂件行退役 */
    })());"""
    s = s.replace(old, new)
    wr(SMOKE, s)
    print('[ok] B1 §191⑦b 升级')

# ---------------- B2: §194⑥ 升级（pool186 退出 → 新形态判据） ----------------
s = rd(SMOKE)
if '§194⑥（v89.205 口径）' in s:
    print('[skip] B2 §194⑥ 已升级')
else:
    old = """    check('§194⑥ 城主标签退役（mayor 不渲染）· 月俸行 · 宝具备注行退役（源码级）', (function () {
      return uS194.indexOf("g.status !== 'mayor'") >= 0
        && uS194.indexOf('gp-sal194') >= 0
        && uS194.indexOf("'月俸：' + (GAME.isLordGeneral(g)") >= 0
        && /if \\(!pool186\\.length\\) return '';/.test(uS194)
        && uS194.indexOf('未佩宝具（打据点/名城有几率缴获）') < 0;
    })());"""
    assert s.count(old) == 1, 'B2 count=' + str(s.count(old))
    new = """    /* v89.205（老板）规则变更：挂件行**整行退役** —— 原"未佩备注行"判据（pool186 分支）
       由"整行零残留 + 来源说明职责移交选择窗空态"取代。 */
    check('§194⑥（v89.205 口径）城主标签退役（mayor 不渲染）· 月俸行 · 挂件行整行退役（源码级）', (function () {
      var u194s = stripComment(uS194);
      return uS194.indexOf("g.status !== 'mayor'") >= 0
        && uS194.indexOf('gp-sal194') >= 0
        && uS194.indexOf("'月俸：' + (GAME.isLordGeneral(g)") >= 0
        && u194s.indexOf('gp-attach186') < 0                          /* v89.205：挂件行整行退役（剥注释） */
        && uS194.indexOf('库存中没有可佩的') >= 0                      /* 来源说明职责移交选择窗空态 */
        && uS194.indexOf('未佩宝具（打据点/名城有几率缴获）') < 0;
    })());"""
    s = s.replace(old, new)
    wr(SMOKE, s)
    print('[ok] B2 §194⑥ 升级')

# ---------------- B3: 新增 smoke §205 段（插在结果行之前） ----------------
s = rd(SMOKE)
if '§205（v89.205）' in s:
    print('[skip] B3 §205 段已插')
else:
    anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    assert s.count(anchor) == 1, 'B3 anchor count=' + str(s.count(anchor))
    frag = """  /* ============================================================
   * §205（v89.205）：挂件行退役 + 卸下迁入选择窗
   *   老板：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」
   *   ① 挂件行零残留（剥注释）· ② 卸下迁入选择窗「当前件」行 · ③ doDetach 重开刷新
   *   ④ 真调链路（genPane 无挂件行 · 选择窗含卸下 · 清空 + 库存守恒）· ⑤ 档案在册
   * ============================================================ */
  (function () {
    var fs205 = require('fs'), p205 = require('path');
    var uSrc205 = fs205.readFileSync(p205.join(__dirname, 'js', 'ui.js'), 'utf8');
    var mSrc205 = fs205.readFileSync(p205.join(__dirname, 'js', 'main.js'), 'utf8');
    var uStrip205 = stripComment(uSrc205);

    /* ① 退役零残留 + 入口/选择窗体在册（源码级） */
    check('§205①（老板）挂件行整行退役（剥注释后 attachLines186 / gp-attach186 零残留）· 装备栏入口与选择窗在册', (function () {
      return uStrip205.indexOf('attachLines186') < 0
        && uStrip205.indexOf('gp-attach186') < 0
        && uStrip205.indexOf('ui.openAttachPick = function') >= 0
        && uStrip205.indexOf('data-action="attach-pick"') >= 0;
    })());

    /* ② 卸下迁入选择窗「当前件」行（源码级：段内三件） */
    check('§205②（老板）选择窗「当前件」行承载卸下（当前：X + attach-off + 卸下按钮）', (function () {
      var seg = codeOf(uSrc205, 'ui.openAttachPick = function');
      return seg.indexOf('当前：') >= 0
        && seg.indexOf('data-action="attach-off"') >= 0
        && seg.indexOf('>卸下</button>') >= 0;
    })());

    /* ③ doDetach：选择窗来源 → 重开刷新（与 doBaoFuse 同款） */
    check('§205③ doDetach 选择窗来源 → 重开刷新（源码级）', (function () {
      var seg = codeOf(mSrc205, 'GAME.doDetach = function');
      return seg.indexOf('ui.openAttachPick(genId, slotId)') >= 0
        && seg.indexOf('ui._attachGen186 === genId') >= 0;
    })());

    /* ④ 真调链路（桩 DOM）：genPane 无挂件行 · 选择窗含卸下 · 真调卸下 清空/库存守恒/重开 */
    check('§205④ 真调链路：genPane 无挂件行 · 选择窗含卸下 · doDetach 清空 + 库存守恒 + 重开', (function () {
      var bk = G.state;
      try {
        var st = G.newGame({ name: 'v205s', cityName: '许都', mapSeed: 20261007 });
        G.state = st;
        var g = st.generals[0];
        var bao = null;
        (DATA.ITEMS || []).forEach(function (x) { if (!bao && x.type === 'bao') bao = x; });
        if (!bao) return false;
        st.items[bao.id] = 1;
        var rEq = G.attachEquip(g, 'bao', bao.id);
        var html = G.ui.genPane(g);
        var ok1 = rEq.ok === true
          && html.indexOf('gp-attach186') < 0
          && html.indexOf('data-action="attach-pick"') >= 0
          && html.indexOf('data-slot="bao"') >= 0;
        G.ui.openAttachPick(g.id, 'bao');
        var h4 = global.document.querySelector('#modal-root').innerHTML;
        var ok2 = h4.indexOf('data-action="attach-off"') >= 0
          && h4.indexOf('当前：') >= 0
          && h4.indexOf('当前：') < h4.indexOf('data-action="attach-off"');
        var n0 = st.items[bao.id] || 0;
        G.doDetach(g.id, 'bao');
        var h5 = global.document.querySelector('#modal-root').innerHTML;
        var ok3 = !(g.attach && g.attach.bao)
          && (st.items[bao.id] || 0) === n0 + 1
          && h5.indexOf('当前未佩') >= 0
          && h5.indexOf('data-action="attach-off"') < 0;
        return ok1 && ok2 && ok3;
      } finally { G.state = bk; }
    })());

    /* ⑤ 需求档案在册 */
    check('§205⑤ 需求档案在册（v89.205 · 老板原文关键句）', (function () {
      var a = fs205.readFileSync(p205.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.205') >= 0 && a.indexOf('将领名称信息下的这行去掉') >= 0;
    })());
  })();

"""
    s = s.replace(anchor, frag + anchor)
    wr(SMOKE, s)
    print('[ok] B3 §205 段已插')

# ---------------- B4: 新增 e2e §205 段（插在 return finish 之前） ----------------
s = rd(E2E)
if '§205（v89.205）' in s:
    print('[skip] B4 e2e §205 已插')
else:
    anchor = '\n  return finish();'
    assert s.count(anchor) == 1, 'B4 anchor count=' + str(s.count(anchor))
    frag = """

  /* ============================================================
   * §205（v89.205）：将领面板挂件行退役 + 卸下迁入选择窗（真实 DOM）
   *   老板：「将领名称信息下的这行去掉，只保留装备栏的即可：🔮 宝具」
   * ============================================================ */
  {
    console.log('\\n--- §205. v89.205 挂件行退役 + 卸下迁入选择窗（真实 DOM） ---');
    const g205 = G.lordGeneralOf();
    const it205 = (G.DATA.ITEMS || []).find((x) => x.type === 'bao');
    if (g205 && it205) {
      const bkItems205 = G.state.items[it205.id] || 0;
      const bkOn205Id = (g205.attach || {}).bao || null;
      try {
        G.state.items[it205.id] = bkItems205 + 1;
        const rEq205 = G.attachEquip(g205, 'bao', it205.id);
        G.ui._genSel = g205.id;
        G.ui.setView('generals');
        await sleep(260);
        /* ① 面板信息区不再是挂件行 */
        check('§205① 将领面板信息区不再渲染挂件行（gp-attach186 无节点）',
          document.querySelectorAll('#view-container .gp-attach186').length === 0,
          rEq205 && rEq205.msg);
        /* ② 装备栏「🔮 宝具」是唯一入口 → 真点开选择窗 */
        const baoBtn205 = document.querySelector('#view-container [data-action="attach-pick"][data-slot="bao"]');
        check('§205② 装备栏「🔮 宝具」入口在（挂件行退役后的唯一入口）', !!baoBtn205);
        if (baoBtn205) {
          baoBtn205.click();
          await sleep(280);
          const offBtn205 = document.querySelector('#modal-root [data-action="attach-off"]');
          check('§205③ 选择窗：卸下按钮在册（卸下入口无丢失）', !!offBtn205);
          if (offBtn205) {
            offBtn205.click();
            await sleep(280);
            const txt205 = (document.querySelector('#modal-root').textContent || '');
            check('§205④ 真点卸下：attach 清空 + 库存守恒（+1）+ 窗重开（当前未佩）',
              !(g205.attach && g205.attach.bao)
              && (G.state.items[it205.id] || 0) === bkItems205 + 1
              && txt205.indexOf('当前未佩') >= 0,
              'items=' + (G.state.items[it205.id] || 0) + ' has=' + !!(g205.attach && g205.attach.bao));
          }
          G.ui.closeAllModals();
          await sleep(60);
        }
      } finally {
        /* 还原：原佩回装 / 原空卸净 + 库存回填（后续用例依赖原状） */
        if (bkOn205Id) { G.attachEquip(g205, 'bao', bkOn205Id); }
        else if (g205.attach && g205.attach.bao) { G.attachUnequip(g205, 'bao'); }
        G.state.items[it205.id] = bkItems205;
        G.ui.closeAllModals();
      }
    } else {
      check('§205① 造局（宝具 / 君主在册）', false, 'no-bao-or-lord');
    }
  }"""
    s = s.replace(anchor, frag + anchor)
    wr(E2E, s)
    print('[ok] B4 e2e §205 已插')

# ---------------- B5: 版本号 v89.205（main.js + smoke §199④） ----------------
s = rd(MAIN)
if "GAME.VERSION = 'v89.205'" in s:
    print('[skip] B5 main 版本号已更新')
else:
    old = "GAME.VERSION = 'v89.204';"
    assert s.count(old) == 1, 'B5m count=' + str(s.count(old))
    s = s.replace(old, "GAME.VERSION = 'v89.205';")
    wr(MAIN, s)
    print('[ok] B5 main 版本号')

s = rd(SMOKE)
old = "/GAME\\.VERSION = 'v89\\.204'/.test(mS199)   /* v89.204：版本号每轮迭代更新（本条随轮升级） */"
if "v89\\.205'/.test(mS199)" in s:
    print('[skip] B5 smoke 版本断言已更新')
else:
    assert s.count(old) == 1, 'B5s count=' + str(s.count(old))
    s = s.replace(old, "/GAME\\.VERSION = 'v89\\.205'/.test(mS199)   /* v89.205：版本号每轮迭代更新（本条随轮升级） */")
    wr(SMOKE, s)
    print('[ok] B5 smoke 版本断言')

print('=== B 批完成 ===')
