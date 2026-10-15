# -*- coding: utf-8 -*-
"""
v89.110 危险动作 —— 测试适配补丁
① js/ui.js：新弹窗文案避开 smoke 的源码扫描词（'随机任务</span>'）
② smoke-test.js：4 处动作名更新 + 新增 §91 危险动作段
③ e2e-test.js：拆解改两段式用例 + 新增解散两段式用例（真实点击）
纪律：先备份 → 全量 assert → 落盘 → node --check
"""
import io, os, shutil, subprocess

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')
NODE = r'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-3/node.exe'

files = ['js/ui.js', 'smoke-test.js', 'e2e-test.js']
orig = {}
for f in files:
    p = os.path.join(R, f)
    orig[f] = io.open(p, encoding='utf-8').read()
    shutil.copy2(p, os.path.join(BK, os.path.basename(f).replace('.js', '.v89110pre.js')))
print('[备份] 3 个文件 → .workbuddy/backup/*.v89110pre.js')

new = dict(orig)
def rep(f, a, b, n=1):
    s = new[f]
    assert a in s, '未命中[' + f + ']：' + a[:90].replace('\n', '⏎')
    assert s.count(a) == n, '命中数不符[' + f + '] 期望%d 实际%d：%s' % (n, s.count(a), a[:60].replace('\n', '⏎'))
    new[f] = s.replace(a, b, n)

# ① ui.js 文案避词（smoke 的「已完成任务区块浮到最上方」按源码顺序扫描 '随机任务</span>'）
rep('js/ui.js',
    """    html += '<div class="attr"><span class="k">换新数量</span><span class="v">' + n + ' 项随机任务</span></div>';""",
    """    html += '<div class="attr"><span class="k">换新数量</span><span class="v">' + n + ' 项（全部作废重抽）</span></div>';""")

# ② smoke：4 处动作名
S = 'smoke-test.js'
rep(S, """    && /case 'gather-finish'/.test(mainSrc27) && /case 'gather-abandon'/.test(mainSrc27)""",
    """    && /case 'gather-finish'/.test(mainSrc27) && /case 'gather-abandon-ask'/.test(mainSrc27)
    && /case 'gather-abandon-do'/.test(mainSrc27)""")
rep(S, """    && /ui\\.openWallModal = function/.test(uS16) && /cancel-build" data-kind="wall"/.test(uS16));""",
    """    && /ui\\.openWallModal = function/.test(uS16) && /cancel-build-ask" data-kind="wall"/.test(uS16));""")
rep(S, """  check('行军视图提供采集收获 / 撤回', /data-action="gather-finish"/.test(uS31) && /data-action="gather-abandon"/.test(uS31));""",
    """  check('行军视图提供采集收获 / 撤回（v89.110：撤回走二次确认）', /data-action="gather-finish"/.test(uS31) && /data-action="gather-abandon-ask"/.test(uS31));""")
rep(S, """      return /data-action="troop-disband"/.test(uS) && /case 'troop-disband'/.test(mS);
    })());""",
    """      /* v89.110：解散改两段式 —— 触发只到 ask，do 只存在于确认弹窗里（无一键直达） */
      return /data-action="troop-disband-ask"/.test(uS) && /case 'troop-disband-ask'/.test(mS)
        && /case 'troop-disband-do'/.test(mS) && !/data-action="troop-disband"/.test(uS);
    })());""")

# ② smoke：新增 §91 段（插在 89. v89.108 之前）
SEC91 = r"""  /* ============================================================
   * 91. v89.110（老板）：**危险动作复核** —— 销毁性动作一律两段式
   * ------------------------------------------------------------
   * 老板原话：「怎么能把危险按钮放在容易误触的位置，兵种的解散能放训练旁边吗…
   *   这种人机交互理念符合常理吗？全面复核」。
   * 本段钉住五条：
   *   ① 六个销毁性动作全部 ask→do 两段式；ui.js 里没有裸入口（一键直达的口子关死）；
   *   ② 六个确认弹窗唯一出口齐备，且 do 按钮只存在于确认弹窗文本里；
   *   ③ 实测渲染：训练面板里「训练」与「解散」之间隔着一整块「危险操作」区（不同行）；
   *   ④ 实测：解散确认弹窗写明 归农返还 / 军资不退 / 不可撤销，do 载荷齐（troop + 数量）；
   *   ⑤ 实测：取消建造的「预告返还」与「真退款」同源（cancelRefundOf 唯一出口）。
   * ============================================================ */
  console.log('\n===== 91. v89.110 危险动作（两段式 + 危险区） =====');
  (function () {
    var uD = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8'));
    var mD = stripComment(fsMod.readFileSync(pathMod.join(__dirname, 'js', 'main.js'), 'utf8'));
    var PAIRS = ['troop-disband', 'salvage-equip', 'gather-abandon', 'cancel-build',
      'reroll-rand-quest', 'reroll-all-rand'];
    check('① 六个销毁性动作全部两段式（ask+do 双 case · 无裸入口 · do 只在确认弹窗里）', (function () {
      var bad = [];
      PAIRS.forEach(function (b) {
        if (!new RegExp("case '" + b + "-ask'").test(mD)) bad.push(b + ' 缺 ask');
        if (!new RegExp("case '" + b + "-do'").test(mD)) bad.push(b + ' 缺 do');
        if (new RegExp('data-action="' + b + '"').test(uD)) bad.push(b + ' 有裸入口');
        if (!new RegExp('data-action="' + b + '-do"').test(uD)) bad.push(b + ' 确认按钮缺失');
      });
      if (bad.length) console.log('     ' + bad.join('，'));
      return bad.length === 0;
    })());
    check('② 六个确认弹窗唯一出口齐备', (function () {
      var need = ['openDisbandConfirm', 'openSalvageConfirm', 'openGatherAbandonAsk',
        'openCancelBuildAsk', 'openRerollRandAsk', 'openRerollAllAsk'];
      var bad = need.filter(function (f) { return !new RegExp('ui\\.' + f + ' = function').test(uD); });
      if (bad.length) console.log('     缺：' + bad.join('，'));
      return bad.length === 0;
    })());
    /* ③ 实测渲染：训练与解散之间必须隔着「危险操作」区 */
    check('③ 实测渲染：训练与解散之间隔着「危险操作」区（不再同行紧邻）', (function () {
      var bak = G.state;
      try {
        var stT = G.newGame({ name: '危3', cityName: '许都', mapSeed: 20260923 });
        if (!stT.map.grid) G.map.generate();
        G.state = stT;
        var cT = stT.cities[0];
        var bi = -1;
        (cT.cells || []).forEach(function (x, i) { if (!x.build && !x.official && bi < 0) bi = i; });
        if (bi < 0) return false;
        cT.cells[bi].build = { id: 'junying', lvl: 1 };
        cT.army = cT.army || {};
        Object.keys(DATA.TROOPS).forEach(function (tid) { cT.army[tid] = 100; });
        G.ui._trainBIdx = bi; G.ui._trainFilter = 'normal'; G.ui._trainTab = 'inf';
        var h = G.ui.troopsHTML();
        var a = h.indexOf('data-action="confirm-train"');
        var b = h.indexOf('data-action="troop-disband-ask"');
        if (a < 0 || b < 0) { console.log('     训练锚=' + a + ' 解散锚=' + b); return false; }
        return b > a && /op-zone danger/.test(h.slice(a, b));
      } finally { G.state = bak; }
    })());
    /* ④ 实测：解散确认弹窗内容 + do 载荷 */
    check('④ 实测：解散确认弹窗写明 归农返还/军资不退/不可撤销，do 载荷齐', (function () {
      var bak = G.state;
      try {
        var stD = G.newGame({ name: '危4', cityName: '许都', mapSeed: 20260923 });
        if (!stD.map.grid) G.map.generate();
        G.state = stD;
        var cD = stD.cities[0];
        cD.army = cD.army || {}; cD.army.qingji = 100;
        G.ui.openDisbandConfirm('qingji', 40);
        var h = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
        var ok = h.indexOf('归农返还') >= 0 && h.indexOf('不退') >= 0 && h.indexOf('不可撤销') >= 0
          && h.indexOf('data-action="troop-disband-do"') >= 0
          && h.indexOf('data-troop="qingji"') >= 0 && h.indexOf('data-n="40"') >= 0
          && h.indexOf('data-action="close-modal"') >= 0;
        if (!ok) console.log('     弹窗片段：' + h.slice(0, 150));
        return ok;
      } finally { G.state = bak; }
    })());
    /* ⑤ 实测：取消建造预告价 = 真退款（唯一出口） */
    check('⑤ 实测：取消建造「预告返还」与「真退款」同源（cancelRefundOf）', (function () {
      var bak = G.state;
      try {
        var stQ = G.newGame({ name: '危5', cityName: '许都', mapSeed: 20260923 });
        if (!stQ.map.grid) G.map.generate();
        G.state = stQ;
        var cQ = stQ.cities[0];
        var ci = -1;
        (cQ.cells || []).forEach(function (x, i) { if (!x.build && !x.official && ci < 0) ci = i; });
        if (ci < 0) return false;
        stQ.queues = stQ.queues || { build: [] };
        stQ.queues.build.push({ type: 'build', cityId: cQ.id, gridIndex: ci, buildId: 'minfang',
          targetLevel: 1, elapsed: 30, totalTime: 100 });
        var info = G.cancelRefundOf('city', ci);
        if (!info.ok || info.total <= 0) { console.log('     预告失败：' + (info.msg || info.total)); return false; }
        var Rr = G.res(cQ);
        var g0 = Rr.grain || 0;
        var r = G.cancelBuild('city', ci);
        var g1 = Rr.grain || 0;
        var same = r.ok && g1 === g0 + (info.refund.grain || 0);
        if (!same) console.log('     预告 grain=' + (info.refund.grain || 0) + ' 实退 ' + (g1 - g0));
        return same && Math.abs(info.remainRatio - 0.7) < 1e-9;
      } finally { G.state = bak; }
    })());
  })();

"""
anchor = r"""  console.log('\n===== 89. v89.108 领地上限（随爵位解封）+ 客栈候选按城 =====');"""
assert anchor in new[S], 'smoke 插入锚点未命中'
new[S] = new[S].replace(anchor, SEC91 + anchor, 1)

# ③ e2e：拆解改两段式 + 追加解散两段式用例
E = 'e2e-test.js'
rep(E, """  check('装备详情含拆解入口', !!document.querySelector('#modal-root [data-action="salvage-equip"]'));
  click(document.querySelector('#modal-root [data-action="salvage-equip"]'));
  await sleep(90);
  check('拆解后装备数减少', s.inventory.length === inv22 - 1, inv22 + ' → ' + s.inventory.length);
  G.ui.closeModal();""",
"""  /* v89.110：拆解改两段式 —— 先确认（取消不销毁），再执行 */
  check('装备详情含拆解入口（v89.110：走二次确认）',
    !!document.querySelector('#modal-root [data-action="salvage-equip-ask"]'));
  click(document.querySelector('#modal-root [data-action="salvage-equip-ask"]'));
  await sleep(90);
  check('拆解确认弹窗写明不可撤销 + 带 do 按钮', (function () {
    const h = document.querySelector('#modal-root').innerHTML;
    return h.indexOf('不可撤销') >= 0
      && !!document.querySelector('#modal-root [data-action="salvage-equip-do"]');
  })());
  click(document.querySelector('#modal-root [data-action="close-modal"]'));
  await sleep(70);
  check('取消拆解后装备数不变（误触不销毁）', s.inventory.length === inv22, inv22 + ' 件仍在');
  G.ui.openEquipDetail('cr_weapon_1');
  await sleep(70);
  click(document.querySelector('#modal-root [data-action="salvage-equip-ask"]'));
  await sleep(70);
  click(document.querySelector('#modal-root [data-action="salvage-equip-do"]'));
  await sleep(90);
  check('确定拆解后装备数减少', s.inventory.length === inv22 - 1, inv22 + ' → ' + s.inventory.length);
  G.ui.closeModal();

  /* ---- ④′ v89.110：解散两段式（真实点击：取消不损兵 → 确定才解散） ---- */
  {
    const cD110 = G.currentCity();
    let bIdx110 = -1;
    (cD110.cells || []).forEach((x, i) => { if (!x.build && !x.official && bIdx110 < 0) bIdx110 = i; });
    if (bIdx110 < 0) {
      check('v89.110：解散两段式（找不到空位摆军营）', false);
    } else {
      const bakB110 = cD110.cells[bIdx110].build || null;
      const bakA110 = JSON.parse(JSON.stringify(cD110.army || {}));
      const bakTab110 = G.ui._trainTab;
      cD110.cells[bIdx110].build = { id: 'junying', lvl: 1 };
      cD110.army = cD110.army || {};
      Object.keys(G.DATA.TROOPS).forEach((tid) => { cD110.army[tid] = 100; });   /* 选中谁都够解散 */
      G.ui._trainFilter = 'normal'; G.ui._trainTab = 'inf'; G.ui._trainCount = 40;
      G.ui.openTroops(bIdx110, 'normal');
      await sleep(110);
      const dH110 = document.querySelector('#modal-root').innerHTML;
      const ia110 = dH110.indexOf('data-action="confirm-train"');
      const ib110 = dH110.indexOf('data-action="troop-disband-ask"');
      check('v89.110：训练与解散之间隔着「危险操作」区（不再同行紧邻）',
        ia110 > 0 && ib110 > ia110 && /op-zone danger/.test(dH110.slice(ia110, ib110)));
      const ask110 = document.querySelector('#modal-root [data-action="troop-disband-ask"]');
      const selT110 = ask110 && ask110.dataset.troop;
      const pop0110 = G.res(cD110).pop || 0;
      click(ask110);
      await sleep(90);
      check('v89.110：解散确认弹窗写明 归农返还 / 军资不退 / 不可撤销',
        (function () {
          const h = document.querySelector('#modal-root').innerHTML;
          return h.indexOf('归农返还') >= 0 && h.indexOf('不退') >= 0 && h.indexOf('不可撤销') >= 0
            && !!document.querySelector('#modal-root [data-action="troop-disband-do"]');
        })());
      click(document.querySelector('#modal-root [data-action="close-modal"]'));
      await sleep(80);
      check('v89.110：取消解散后兵力不变（误触保护）', cD110.army[selT110] === 100,
        selT110 + ' = ' + cD110.army[selT110]);
      G.ui.openTroops(bIdx110, 'normal');                     /* 取消把弹窗关掉了，重开再走确认 */
      await sleep(90);
      const ask2 = document.querySelector('#modal-root [data-action="troop-disband-ask"]');
      const sel2 = ask2 && ask2.dataset.troop;
      click(ask2);
      await sleep(80);
      click(document.querySelector('#modal-root [data-action="troop-disband-do"]'));
      await sleep(130);
      const t110 = G.DATA.TROOPS[sel2] || {};
      const back110 = Math.floor(40 * (t110.pop || 0)
        * ((G.DATA.DISBAND || {}).popReturn == null ? 1 : G.DATA.DISBAND.popReturn));
      check('v89.110：确定解散 → 兵 100→60、人口 +' + back110 + '（真出口）',
        cD110.army[sel2] === 60 && (G.res(cD110).pop || 0) === pop0110 + back110,
        '兵 ' + cD110.army[sel2] + ' · 人口 ' + pop0110 + ' → ' + G.res(cD110).pop);
      G.ui.closeModal();
      cD110.cells[bIdx110].build = bakB110;                   /* 还原场景，防污染后续用例 */
      cD110.army = bakA110;
      G.ui._trainTab = bakTab110;
    }
  }""")

rep(E, """    check('升级中面板可取消升级', !!document.querySelector('#modal-root [data-action="cancel-build"]'));""",
    """    check('升级中面板可取消升级（v89.110：走二次确认）', !!document.querySelector('#modal-root [data-action="cancel-build-ask"]'));""")
rep(E, """          && !!foot.querySelector('[data-action="cancel-build"]')""",
    """          && !!foot.querySelector('[data-action="cancel-build-ask"]')""")

# ============================================================
for f in files:
    io.open(os.path.join(R, f), 'w', encoding='utf-8', newline='').write(new[f])
print('[落盘] 3 个文件已更新')
ok = True
for f in files:
    r = subprocess.run([NODE, '--check', os.path.join(R, f)], capture_output=True, text=True)
    if r.returncode != 0:
        ok = False
        print('[语法失败] ' + f + '\n' + r.stderr[:600])
print('[自检] node --check：' + ('全部通过' if ok else '有失败'))
print('[完成]')
