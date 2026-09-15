# -*- coding: utf-8 -*-
"""v80 · 测试层：smoke 三处翻转 + 两处守卫升级 + 新增 §65；e2e 一处翻转 + 新增 v80 段。"""
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


print('== T1. smoke v16 守卫翻转（已解锁计数 → 分页）==')
patch(SMOKE,
"""  check('#7 面板显示本类已解锁数量', /已解锁 <b style="color:var\\(--gold-light\\)">' \\+ ids\\.filter/.test(uS16));""",
"""  /* v80（老板）：「『N / M 种』解锁计数这种备注也不要」—— 计数行退役；判据换成兵种分页 */
  check('#7 面板含本类兵种分页（v80：步兵 / 骑兵 两页，计数行退役）', (function () {
    var th = codeOf(uS16, 'ui.troopsHTML = function');
    return /data-action="train-tab"/.test(th) && /data-page="cav"/.test(th)
      && th.indexOf('ids.filter') < 0;
  })());""",
'T1 已解锁→分页')

print()
print('== T2. smoke v33 守卫重写（±10 → 直输）==')
patch(SMOKE,
"""  check('加减数量重绘弹窗', /GAME\\.adjustTrainQty = function[\\s\\S]{0,220}ui\\.renderTroopsModal\\(\\)/.test(mS33));""",
"""  /* v80（老板）：「数量…可以直接输入」—— ±10 退役（adjustTrainQty 同步退休），数量改纯直输 */
  check('v80：数量直输（±10 / adjustTrainQty 退役，上限保留）',
    /id="train-count"/.test(uS33) && !/train-qty/.test(stripComment(uS33)) && !/adjustTrainQty/.test(stripComment(mS33))
      && /data-action="train-max"/.test(uS33));""",
'T2 直输')

print()
print('== T3. smoke 信息型内容示例换串 ==')
patch(SMOKE,
"""    ['治疗费', '守军约', '已解锁', '累计投入的 50%', '商城价', '返还'].every(function (t) {""",
"""    /* v80：『已解锁 N/M 种』随兵营重排退役 —— 示例位换一条仍在的信息串 */
    ['治疗费', '守军约', '队列空位', '累计投入的 50%', '商城价', '返还'].every(function (t) {""",
'T3 信息串')

print()
print('== T4. smoke v76 建筑守卫升级（吸底操作区）==')
patch(SMOKE,
"""check('v76：升级/拆除/移动同排（.bldg-acts），关闭单独吸底', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  return /class="bldg-acts"/.test(u)
    && /data-action="confirm-upgrade"/.test(u)
    && /data-action="demolish-ask"/.test(u)
    && /data-action="move-ask"/.test(u)
    && /\\.bldg-foot \\{ display: flex; justify-content: center/.test(h);
})());""",
"""check('v80：三键同排收进吸底操作区（.bldg-bottom），关闭在其下方', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  var h = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');
  return /class="bldg-acts"/.test(u)
    && /data-action="confirm-upgrade"/.test(u)
    && /data-action="demolish-ask"/.test(u)
    && /data-action="move-ask"/.test(u)
    && /class="bldg-bottom"/.test(u)
    && /\\.bldg-bottom \\{ position: sticky/.test(h)
    && /\\.bldg-bottom \\.bldg-foot \\{ position: static/.test(h);
})());""",
'T4 建筑守卫')

print()
print('== T5. smoke v73 吸底守卫升级（.bldg-bottom）==')
patch(SMOKE,
"""  check('样式：底栏吸底（sticky + 出血到面板边缘 + 钉面板下沿 + 不透明底）', (function () {
    var b = cssBlock(hS73, '.bldg-foot {');
    return /position: sticky/.test(b) && /bottom: -12px/.test(b)
      && /margin: 12px -12px -12px/.test(b) && /padding: 8px 12px 22px/.test(b)
      && /background: var\\(--panel-bg\\)/.test(b);
  })(), cssBlock(hS73, '.bldg-foot {').replace(/\\s+/g, ' ').slice(0, 84));""",
"""  check('样式：吸底操作区（v80 .bldg-bottom：三键+关闭同块 + 出血到边缘 + 钉面板下沿）', (function () {
    var b = cssBlock(hS73, '.bldg-bottom {');
    var f = cssBlock(hS73, '.bldg-bottom .bldg-foot {');
    return /position: sticky/.test(b) && /bottom: -12px/.test(b)
      && /margin: 12px -12px -12px/.test(b) && /padding: 8px 12px 22px/.test(b)
      && /background: var\\(--panel-bg\\)/.test(b)
      && /position: static/.test(f);
  })(), cssBlock(hS73, '.bldg-bottom {').replace(/\\s+/g, ' ').slice(0, 84));""",
'T5 吸底守卫')

print()
print('== T6. smoke 新增 §65 ==')
SEC65 = """/* ============================================================
 * ===== 65. v80：客栈固定表 / 建筑吸底操作区 / 兵营分页直输（老板三条） =====
 * ============================================================ */
console.log('\\n===== 65. v80 三条（客栈 · 建筑底栏 · 兵营） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uRaw = rd('ui');
  var uS = stripComment(uRaw);
  var mS = stripComment(rd('main'));
  var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');

  /* ---------- ① 客栈 ---------- */
  console.log('  --- ① 客栈固定表 ---');
  check('v80：招募行去「史实名将」标（将领档案那枚保留）', (function () {
    var inn = codeOf(uS, 'ui.openInn = function');
    return inn.indexOf('tag-hero') < 0 && uRaw.indexOf('<span class="gcard-tag hero">史实名将</span>') >= 0;
  })());
  check('v80：表格固定列宽（colgroup ×10 + table-layout: fixed + 列宽表在 CSS）', (function () {
    var inn = codeOf(uS, 'ui.openInn = function');
    var b = cssBlock(hS, '.inn-tbl {');
    return /<colgroup>/.test(inn) && (inn.match(/<col class="c-/g) || []).length === 10
      && /table-layout: fixed/.test(b)
      && /width: \\d+px/.test(cssBlock(hS, '.inn-tbl col.c-name {'))
      && /width: \\d+px/.test(cssBlock(hS, '.inn-tbl col.c-act {'));
  })());

  /* ---------- ② 建筑弹窗 ---------- */
  console.log('  --- ② 建筑弹窗：吸底操作区 ---');
  check('v80：三键与关闭同处 .bldg-bottom（上排三键 / 下排关闭）', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    var a = body.indexOf('class="bldg-bottom"');
    if (a < 0) return false;
    var acts = body.indexOf('class="bldg-acts"', a);
    var foot = body.indexOf('class="bldg-foot"', a);
    return acts > a && foot > acts
      && body.indexOf('data-action="confirm-upgrade"', acts) > acts
      && body.indexOf('data-action="demolish-ask"', acts) > acts
      && body.indexOf('data-action="move-ask"', acts) > acts
      && body.indexOf('close-modal', foot) > foot;
  })());
  check('v80：吸底几何沿用 v73 校准 + 短内容贴底（:has flex + margin-top: auto）',
    /\\.modal \\.inner-panel:has\\(> \\.bldg-bottom\\) \\{ display: flex; flex-direction: column; \\}/.test(hS.replace(/\\s+/g, ' '))
    && /\\.modal \\.inner-panel:has\\(> \\.bldg-bottom\\) > \\.bldg-bottom \\{ margin-top: auto; \\}/.test(hS.replace(/\\s+/g, ' ')));

  /* ---------- ③ 兵营 ---------- */
  console.log('  --- ③ 兵营：分页 / 直输 / 不跳顶 ---');
  check('v80：常备兵全部归入步兵/骑兵两页（无遗漏、无器械混入）', (function () {
    var inf = 0, cav = 0, bad = 0;
    Object.keys(DATA.TROOPS).forEach(function (id) {
      var t = DATA.TROOPS[id];
      if (t.craft) return;
      if (t.cat === 'inf') inf++;
      else if (t.cat === 'cav') cav++;
      else bad++;
    });
    return bad === 0 && inf + cav === 15 && inf > 0 && cav > 0;
  })());
  check('v80：兵营页重排（重复标题 / 工位行 / 解锁计数全撤，空态保留）', (function () {
    var th = codeOf(uS, 'ui.troopsHTML = function');
    return th.indexOf('gold-heading') < 0 && th.indexOf('ids.filter') < 0
      && th.indexOf('q-sec-n') < 0 && th.indexOf('本城尚未建造') >= 0
      && /data-action="train-tab"/.test(th) && /data-page="inf"/.test(th) && /data-page="cav"/.test(th);
  })());
  check('v80：数量直输（±10 退役 / 上限保留 / 输入框在）', (function () {
    var th = codeOf(uS, 'ui.troopsHTML = function');
    return /id="train-count"/.test(th) && th.indexOf('train-qty') < 0
      && th.indexOf('data-action="train-max"') >= 0
      && mS.indexOf('train-qty') < 0 && mS.indexOf('adjustTrainQty') < 0
      && /case 'train-tab':/.test(mS);
  })());
  check('v80：重绘不跳顶（openTroops 存/还两级滚动位）', (function () {
    var fn = codeOf(uS, 'ui.openTroops = function');
    return (fn.match(/scrollTop/g) || []).length >= 4 && /#train-count/.test(fn);
  })());
})();

"""
patch(SMOKE,
"""  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
"""  })();

""" + SEC65 + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
'T6 §65')

print()
print('== T7. e2e v24 守卫翻转（不再标所属军营）==')
patch(E2E,
"""    check('募兵面板标出所属军营', tm24.indexOf('募兵军营') >= 0 && tm24.indexOf('队列位') >= 0);""",
"""    /* v80（老板）：「募兵军营 城内第 46 格 · Lv11 · 队列位 3 这个也不需要」——
       面板不再标所属工位；重复标题也撤除（只留弹窗标题一处） */
    check('v80：募兵面板不再标所属军营 / 重复标题',
      tm24.indexOf('募兵军营') < 0 && tm24.indexOf('队列位') < 0
      && (tm24.match(/兵营招募/g) || []).length === 1);""",
'T7 军营销毁')

print()
print('== T8. e2e 新增 v80 段 ==')
SEC80 = """  /* ============================================================
   * v80（老板三条）：客栈固定表 / 建筑吸底操作区 / 兵营分页直输（真实 DOM）
   * ============================================================ */
  console.log('\\n--- v80. 客栈固定表 · 建筑底栏 · 兵营分页（真实 DOM） ---');
  {
    const c80 = G.currentCity();
    /* ① 客栈：固定列宽 + 去「史实名将」标 */
    let inn80 = c80.cells.findIndex((x) => x.build && x.build.id === 'kezhan');
    if (inn80 < 0) {
      inn80 = c80.cells.findIndex((x) => !x.build && !x.official);
      c80.cells[inn80] = { build: { id: 'kezhan', lvl: 8 }, pending: null };
    }
    G.state.res.gold = Math.max(G.state.res.gold || 0, 50000000);
    G.ui.openInn();
    await sleep(130);
    const tbl80 = document.querySelector('#modal-root .inn-tbl');
    check('v80：客栈表固定列宽（table-layout: fixed + colgroup ×10）',
      !!tbl80 && window.getComputedStyle(tbl80).tableLayout === 'fixed'
      && tbl80.querySelectorAll('colgroup col').length === 10);
    const colsA80 = tbl80 ? Array.from(tbl80.querySelectorAll('colgroup col')).map((c) => c.getAttribute('class')).join(',') : '';
    check('v80：招募行无「史实名将」标', document.querySelectorAll('#modal-root .tag-hero').length === 0);
    G.innRefresh(true);                         /* 强制换一批 */
    G.ui.openInn();
    await sleep(130);
    const colsB80 = Array.from(document.querySelectorAll('#modal-root .inn-tbl colgroup col')).map((c) => c.getAttribute('class')).join(',');
    check('v80：换一批后列宽声明不变（框架不动；列宽只在 CSS 按类固定）',
      colsA80.length > 0 && colsA80 === colsB80, colsA80);
    G.ui.closeModal();
    await sleep(60);

    /* ② 建筑弹窗：三键+关闭 = 吸底操作区（三键在关闭上方） */
    const bi80 = c80.cells.findIndex((x) => x.build && x.build.id !== 'guanfu' && !x.pending);
    if (bi80 >= 0) {
      G.ui.openBuildModal(bi80);
      await sleep(130);
      const bo80 = document.querySelector('#modal-root .bldg-bottom');
      check('v80：三键+关闭同处吸底操作区', !!(bo80
        && bo80.querySelector('.bldg-acts')
        && bo80.querySelector('.bldg-foot [data-action="close-modal"]')));
      check('v80：操作区吸底（sticky 钉面板下沿）',
        !!bo80 && window.getComputedStyle(bo80).position === 'sticky');
      check('v80：三键在关闭上方（DOM 顺序，同块上排）', (function () {
        if (!bo80) return false;
        const acts = bo80.querySelector('.bldg-acts');
        const foot = bo80.querySelector('.bldg-foot');
        return !!(acts.compareDocumentPosition(foot) & window.Node.DOCUMENT_POSITION_FOLLOWING);
      })());
      G.ui.closeModal();
      await sleep(60);
    }

    /* ③ 兵营：两页 + 直输 + 不跳顶 */
    let j80 = c80.cells.findIndex((x) => x.build && x.build.id === 'junying');
    if (j80 < 0) {
      j80 = c80.cells.findIndex((x) => !x.build && !x.official);
      c80.cells[j80] = { build: { id: 'junying', lvl: 10 }, pending: null };
    }
    if (c80.cells[j80].build) c80.cells[j80].build.lvl = Math.max(10, c80.cells[j80].build.lvl || 1);
    G.ui.openTroops(j80, 'normal');
    await sleep(160);
    const mr80 = document.querySelector('#modal-root');
    check('v80：兵营页只剩一处标题（重复标题 / 工位行 / 解锁计数全撤）',
      (mr80.innerHTML.match(/兵营招募/g) || []).length === 1
      && mr80.textContent.indexOf('募兵军营') < 0 && mr80.textContent.indexOf('队列位') < 0
      && mr80.textContent.indexOf('已解锁') < 0);
    check('v80：步兵 / 骑兵 两页切换按钮',
      mr80.querySelectorAll('[data-action="train-tab"]').length === 2);
    click(mr80.querySelector('[data-action="train-tab"][data-page="cav"]'));
    await sleep(150);
    check('v80：翻到骑兵页（首卡为骑兵）', (function () {
      const card = document.querySelector('#modal-root .troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].cat === 'cav';
    })());
    check('v80：±10 退役（输入框直输 + 上限保留）',
      !document.querySelector('#modal-root [data-action="train-qty"]')
      && !!document.querySelector('#modal-root #train-count')
      && !!document.querySelector('#modal-root [data-action="train-max"]'));
    /* 滚到底 → 点上限 → 滚动位保持（原为跳回顶端） */
    const pbA80 = document.querySelector('#modal-root .panel-body');
    const ipA80 = document.querySelector('#modal-root .inner-panel');
    /* jsdom 无布局引擎（scrollHeight=0）—— 用显式值验证"存/还"链路本身 */
    pbA80.scrollTop = 126; ipA80.scrollTop = 67;
    const keepA80 = { pb: pbA80.scrollTop, ip: ipA80.scrollTop };
    click(document.querySelector('#modal-root [data-action="train-max"]'));
    await sleep(160);
    const keepB80 = {
      pb: document.querySelector('#modal-root .panel-body').scrollTop,
      ip: document.querySelector('#modal-root .inner-panel').scrollTop,
    };
    check('v80：点「上限」不再跳回顶端（滚动位保留）',
      keepA80.pb === 126 && keepA80.ip === 67 && keepB80.pb === 126 && keepB80.ip === 67,
      JSON.stringify(keepA80) + ' → ' + JSON.stringify(keepB80));
    /* 直输：改值 → 状态同步 */
    const cnt80 = document.querySelector('#modal-root #train-count');
    if (cnt80) {
      cnt80.value = '7';
      cnt80.dispatchEvent(new window.Event('input', { bubbles: true }));
      check('v80：数量直输同步到状态', Math.floor(Number(G.ui._trainCount)) === 7, String(G.ui._trainCount));
    }
    G.ui.closeModal();
    await sleep(60);
  }

"""
patch(E2E,
"""  G.ui.setView('city');
  await sleep(60);
  return finish();""",
SEC80 + """  G.ui.setView('city');
  await sleep(60);
  return finish();""",
'T8 v80段')

print()
print('全部测试补丁完成。')
