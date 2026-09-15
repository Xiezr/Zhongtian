"""v81 · 测试补丁：smoke 两处守卫演进 + 新增 §66；e2e 六处跟进 + v81 新段。

- smoke §7：分页判据两页 → 三页（que/inf/cav）
- smoke §38：君主名单独一行 → 名称并入信息表首行（官职行退役）
- smoke §66（新）：v81 两条（君主卡 / 兵营三页）
- e2e：君主卡断言、中央视图先切步兵页、两处募兵流程先切对应页、v80 段页签数 2→3
- e2e v81 段（新）：真 DOM 三页切换实测
"""
import io, sys

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


print('== smoke：守卫演进 ==')
patch(SMOKE,
"""  check('#7 面板含本类兵种分页（v80：步兵 / 骑兵 两页，计数行退役）', (function () {
    var th = codeOf(uS16, 'ui.troopsHTML = function');
    return /data-action="train-tab"/.test(th) && /data-page="cav"/.test(th)
      && th.indexOf('ids.filter') < 0;
  })());""",
"""  check('#7 面板含本类兵种分页（v80 两页 → v81 三页：队列 / 步兵 / 骑兵，计数行退役）', (function () {
    var th = codeOf(uS16, 'ui.troopsHTML = function');
    return /data-action="train-tab"/.test(th) && /data-page="que"/.test(th)
      && /data-page="inf"/.test(th) && /data-page="cav"/.test(th)
      && th.indexOf('ids.filter') < 0;
  })());""",
 'smoke §7 三页判据')

patch(SMOKE,
"""  check('君主名单独一行（与头像不同行）',
    /lord-name-row/.test(hS38) && /\\.lord-name-row \\{ text-align: center/.test(hS38));""",
"""  /* v81（老板）：「官职这行放玩家名称，现在的名称位置去掉」——
     名称并入信息表首行（.mrow-name），官职行与旧名称列退役。 */
  check('v81：君主名并入信息表首行（官职行与旧名称列退役）',
    /class="row mrow-name"/.test(hS38) && /id="lord-name"/.test(hS38)
    && !/lord-name-row/.test(hS38) && !/lord-office/.test(hS38));""",
 'smoke §38 君主名守卫')

print()
print('== smoke：新增 §66 ==')

SMOKE66 = """
/* ============================================================
 * ===== 66. v81：君主卡（名称并入信息表首行） / 兵营三页制（老板两条） =====
 * ============================================================ */
console.log('\\n===== 66. v81 两条（君主卡 · 兵营三页） =====');
(function () {
  var rd = function (f) { return fsMod.readFileSync(pathMod.join(__dirname, 'js', f + '.js'), 'utf8'); };
  var uRaw = rd('ui');
  var uS = stripComment(uRaw);
  var mS = stripComment(rd('main'));
  var hS = fsMod.readFileSync(pathMod.join(__dirname, 'index.html'), 'utf8');

  /* ---------- ① 君主卡 ---------- */
  console.log('  --- ① 君主卡：名称并入信息表首行 ---');
  check('v81：名称行在信息表内（.mrow-name），官职行与旧名称列退役',
    /class="row mrow-name"/.test(hS) && /id="lord-name"/.test(hS)
    && !/lord-name-row/.test(hS) && !/lord-office/.test(hS));
  check('v81：CSS —— 名称行金色 / 头像不缩 / 信息表伸缩', (function () {
    var b = cssBlock(hS, '.lord-meta .row.mrow-name span:first-child {');
    var p = cssBlock(hS, '.lord-portrait {');
    var m = cssBlock(hS, '.lord-meta {');
    return /color: var\\(--gold-light\\)/.test(b) && /flex: 0 0 auto/.test(p) && /flex: 1 1 0/.test(m);
  })());
  check('v81：syncHeader 不再写 #lord-office（名称写入照旧）', (function () {
    var fn = codeOf(uS, 'ui.syncHeader = function');
    return fn.indexOf('lord-office') < 0 && /\\$\\('#lord-name'\\)\\.textContent = s\\.ruler\\.name/.test(fn);
  })());
  check('实测：syncHeader 后 #lord-name = 君主名', (function () {
    G.ui.syncHeader();
    var el = global.document.querySelector('#lord-name');
    return !!el && el.textContent === G.state.ruler.name;
  })());

  /* ---------- ② 兵营三页 ---------- */
  console.log('  --- ② 兵营三页：队列 / 步兵 / 骑兵 ---');
  check('v81：分页初始态为 que（第一页 = 募兵队列）', /ui\\._trainTab = 'que';/.test(uS));
  check('v81：三页切换键与队列页分支齐备', (function () {
    var th = codeOf(uS, 'ui.troopsHTML = function');
    return /data-page="que"/.test(th) && /data-page="inf"/.test(th) && /data-page="cav"/.test(th)
      && /isQueueTab/.test(th) && th.indexOf('ui.trainQueueBlock(bar, c, kind)') >= 0;
  })());
  check('v81：main.js 三页白名单分发',
    /case 'train-tab': ui\\._trainTab = \\(\\['que', 'inf', 'cav'\\]\\.indexOf\\(el\\.dataset\\.page\\) >= 0\\)/.test(mS));
  check('实测：队列页只出队列 / 步兵页只出卡面与控件', (function () {
    var keep = G.state, keepCity = G.ui._cityId;
    var keepTab = G.ui._trainTab, keepFilter = G.ui._trainFilter, keepBIdx = G.ui._trainBIdx;
    var ok = false;
    try {
      var st = G.newGame({ name: 'v81' });
      G.state = st;
      var c = st.cities[0];
      G.ui._cityId = c.id;
      var ci = c.cells.findIndex(function (x) { return !x.build && !x.official; });
      if (ci >= 0) c.cells[ci] = { build: { id: 'junying', lvl: 5 }, pending: null };
      G.ui._trainFilter = 'normal';
      G.ui._trainBIdx = null;
      G.ui._trainTab = 'inf';
      var inf = G.ui.troopsHTML();
      G.ui._trainTab = 'que';
      var que = G.ui.troopsHTML();
      ok = inf.indexOf('本营募兵队列') < 0 && inf.indexOf('id="train-count"') >= 0
        && inf.indexOf('troop-grid') >= 0
        && que.indexOf('本营募兵队列') >= 0 && que.indexOf('id="train-count"') < 0
        && que.indexOf('troop-grid') < 0;
    } catch (e) { ok = false; }
    finally {
      G.ui._trainTab = keepTab; G.ui._trainFilter = keepFilter; G.ui._trainBIdx = keepBIdx;
      G.state = keep; G.ui._cityId = keepCity;
    }
    return ok;
  })(), '步兵页不带队列 / 队列页只带队列');
})();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

patch(SMOKE,
"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
SMOKE66,
 'smoke §66 新节')

print()
print('== e2e：四处流程跟进 ==')

patch(E2E,
"""  /* ② 募兵：初始就能点「训练」（原为「参数错误」） */
  G.ui.setView('troops');""",
"""  /* ② 募兵：初始就能点「训练」（原为「参数错误」） */
  /* v81：兵营三页制 —— 训练控件在步兵/骑兵页（首页为募兵队列），先切步兵页 */
  G.ui._trainTab = 'inf';
  G.ui.setView('troops');""",
 'e2e 中央视图先切步兵页')

patch(E2E,
"""    G.ui.openTroops(junI24, 'normal');
    await sleep(90);
    const tm24 = document.querySelector('#modal-root').innerHTML;""",
"""    G.ui.openTroops(junI24, 'normal');
    await sleep(90);
    /* v81：队列独立成页 —— 先切到「募兵队列」页再验 */
    click(document.querySelector('#modal-root [data-action="train-tab"][data-page="que"]'));
    await sleep(90);
    const tm24 = document.querySelector('#modal-root').innerHTML;""",
 'e2e 募兵队列段先切队列页')

patch(E2E,
"""  click(bt28);
  await sleep(100);
  const tr28 = document.querySelector('#modal-root');
  check('募兵界面有「上限」按钮', !!tr28.querySelector('[data-action="train-max"]'));""",
"""  click(bt28);
  await sleep(100);
  /* v81：默认落在「募兵队列」页 —— 训练控件在步兵页，先切页 */
  click(document.querySelector('#modal-root [data-action="train-tab"][data-page="inf"]'));
  await sleep(100);
  const tr28 = document.querySelector('#modal-root');
  check('募兵界面有「上限」按钮', !!tr28.querySelector('[data-action="train-max"]'));""",
 'e2e 上限段先切步兵页')

patch(E2E,
"""  G.ui.openTroops(ji28, 'normal');
  await sleep(80);
  const qHtml28 = document.querySelector('#modal-root').innerHTML;
  check('募兵界面显示本营队列', qHtml28.indexOf('本营募兵队列') >= 0);""",
"""  G.ui.openTroops(ji28, 'normal');
  await sleep(80);
  /* v81：队列独立成页 —— 切回队列页（上一步在步兵页） */
  click(document.querySelector('#modal-root [data-action="train-tab"][data-page="que"]'));
  await sleep(80);
  const qHtml28 = document.querySelector('#modal-root').innerHTML;
  check('募兵界面显示本营队列（v81：队列独立页）', qHtml28.indexOf('本营募兵队列') >= 0);""",
 'e2e 队列断言先切队列页')

print()
print('== e2e：君主卡与 v80 段页签数 ==')

patch(E2E,
"""  check('君主名在头像下方单独一行',
    !!document.querySelector('.lord-name-row #lord-name') && !document.querySelector('#lord-city'));""",
"""  check('v81：君主名并入信息表首行（官职行退役）',
    !!document.querySelector('.lord-meta .mrow-name #lord-name') && !document.querySelector('#lord-city'));""",
 'e2e 君主卡断言')

patch(E2E,
"""    check('v80：步兵 / 骑兵 两页切换按钮',
      mr80.querySelectorAll('[data-action="train-tab"]').length === 2);""",
"""    check('v81：三页切换按钮（募兵队列 / 步兵 / 骑兵）', (function () {
      const tabs = Array.prototype.map.call(
        mr80.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 3 && tabs[0] === 'que' && tabs.indexOf('inf') >= 0 && tabs.indexOf('cav') >= 0;
    })());""",
 'e2e v80 段页签数 2→3')

print()
print('== e2e：新增 v81 段 ==')

E2E81 = """    G.ui.closeModal();
    await sleep(60);
  }

  /* ============================================================
   * v81（老板）：君主卡名称并入信息表首行 / 兵营三页制（队列 · 步兵 · 骑兵）
   * ============================================================ */
  console.log('\\n--- v81. 君主卡与兵营三页 ---');
  {
    /* ① 君主卡：名称在信息表首行 */
    G.ui.syncHeader();
    await sleep(40);
    const lordCard81 = document.querySelector('.lord-meta .mrow-name #lord-name');
    check('v81：君主名并入信息表首行（官职行 / 旧名称列退役）',
      !!lordCard81 && lordCard81.textContent.trim().length > 0
      && !document.querySelector('#lord-office') && !document.querySelector('.lord-name-row'),
      lordCard81 ? lordCard81.textContent.trim() : '未找到');

    /* ② 兵营三页制 */
    const c81 = G.state.cities[0];
    let j81 = c81.cells.findIndex((x) => x.build && x.build.id === 'junying');
    if (j81 < 0) {
      j81 = c81.cells.findIndex((x) => !x.build && !x.official);
      if (j81 >= 0) c81.cells[j81] = { build: { id: 'junying', lvl: 8 }, pending: null };
    }
    G.ui._trainTab = 'que';                 /* 模拟新会话初始态（第一页 = 募兵队列） */
    G.ui.openTroops(j81 < 0 ? undefined : j81, 'normal');
    await sleep(140);
    const mr81 = document.querySelector('#modal-root');
    check('v81：三页切换键齐备（募兵队列 / 步兵 / 骑兵）', (function () {
      const tabs = Array.prototype.map.call(
        mr81.querySelectorAll('[data-action="train-tab"]'), (t) => t.dataset.page);
      return tabs.length === 3 && tabs[0] === 'que' && tabs.indexOf('inf') >= 0 && tabs.indexOf('cav') >= 0;
    })());
    check('v81：首页为募兵队列（队列在、兵种卡不在）',
      !!mr81.querySelector('.q-sec') && !mr81.querySelector('.troop-grid'));
    click(mr81.querySelector('[data-action="train-tab"][data-page="inf"]'));
    await sleep(140);
    const mr81b = document.querySelector('#modal-root');
    check('v81：步兵页有卡面与训练控件、队列不跟来', (function () {
      const card = mr81b.querySelector('.troop-grid .troop-card');
      const tid = card && card.getAttribute('data-troop');
      return !!tid && DATA.TROOPS[tid].cat === 'inf'
        && !!mr81b.querySelector('#train-count') && !mr81b.querySelector('.q-sec');
    })());
    click(mr81b.querySelector('[data-action="train-tab"][data-page="que"]'));
    await sleep(140);
    check('v81：切回队列页（队列重现、控件退场）', (function () {
      const m = document.querySelector('#modal-root');
      return !!m.querySelector('.q-sec') && !m.querySelector('#train-count');
    })());
    G.ui.closeModal();
    await sleep(60);
  }

  G.ui.setView('city');
  await sleep(60);
  return finish();
}"""

patch(E2E,
"""    G.ui.closeModal();
    await sleep(60);
  }

  G.ui.setView('city');
  await sleep(60);
  return finish();
}""",
E2E81,
 'e2e v81 新段')

print()
print('测试补丁完成。')
