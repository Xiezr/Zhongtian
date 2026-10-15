# -*- coding: utf-8 -*-
"""v89174b · 测试与档案：v89.174 断言（读秒 ceil / 弹窗 live / 在建队列 / 脏标记）+ 需求档案
红单预防：改参数后 grep 数值本体（§85.5）——durExact 断言（smoke 648/649）整数输入不受 ceil 影响。
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

# ============================================================
# S. smoke §174 节（插在文件尾「结果：」行前）
# ============================================================
print('== smoke-test.js ==')

edit('smoke-test.js', 'S1 §174 节',
  r'''  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();''',
  r'''  /* ============================================================
   * 174. v89.174（老板）：「在城池的官方界面，官府要务的下方，显示本城在建的建筑队列和
   *      剩余时间。目前大界面上建筑的建造时间仍然不对，读秒完成后，状态还是在建造中。」
   *   —— 复现双根因：① 显示 round（"00:00 但未完成"窗口）；② 施工中弹窗没接 live。
   * ============================================================ */
  console.log('\n===== 174. v89.174 读秒 ceil + 建造弹窗 live + 官府「在建队列」 =====');
  (function () {
    var fs174 = require('fs'), p174 = require('path');

    /* ① durExact：ceil 语义（"至少还需"—— 显示 0 只在真完成时） */
    console.log('  --- ① 读秒口径（ceil） ---');
    check('§174① ★ durExact 改向上取整（0.2 → 00:01 · 0 → 00:00 · 59.001 → 01:00 · 整数不变）',
      G.utils.durExact(0.2) === '00:01' && G.utils.durExact(0) === '00:00'
      && G.utils.durExact(59.001) === '01:00' && G.utils.durExact(3995) === '1:06:35',
      [G.utils.durExact(0.2), G.utils.durExact(0), G.utils.durExact(59.001)].join(' / '));

    /* ② buildProgressOf：唯一出口 + 真调（剩 0.4 现实秒 → 00:01 不再是 00:00） */
    console.log('  --- ② 进度唯一出口 ---');
    check('§174② ★ buildProgressOf 抽取（buildProgress 与在建队列共用同一算式）', (function () {
      var dm = fs174.readFileSync(p174.join(__dirname, 'js', 'domain.js'), 'utf8');
      var bp = codeOf(dm, 'GAME.buildProgress = function');
      return /GAME\.buildProgressOf = function/.test(dm) && /return GAME\.buildProgressOf\(q\)/.test(bp);
    })());
    check('§174②b ★ 真调：剩 0.4 现实秒的 label 以 00:01 结尾（旧口径 00:00 → 修掉"读完还在建"）', (function () {
      var ts = GAME.timeScale();
      var pr = GAME.buildProgressOf({ elapsed: 120 - 0.4 * ts, totalTime: 120 });
      return !!pr && /00:01$/.test(pr.label) && pr.pct >= 0;
    })());
    check('§174②c 完成后 buildProgressOf(null) 为 null（列表行不会残留）',
      GAME.buildProgressOf(null) === null);

    /* ③ 弹窗 live：城内两处 + 城外两处（完成瞬间换形态） */
    console.log('  --- ③ 弹窗 live（完成即换态） ---');
    (function () {
      var uS = fs174.readFileSync(p174.join(__dirname, 'js', 'ui.js'), 'utf8');
      var ob = codeOf(uS, 'ui.openBuildModal = function');
      var ox = codeOf(uS, 'ui.openExtModal = function');
      check('§174③ ★ 城内：锁城签名 + 两处 live（施工中 / 正常态）',
        /ui\.openBuildModal = function \(idx, cityId\)/.test(uS)
        && /liveFn174/.test(ob)
        && (ob.match(/\{ live: liveFn174 \}/g) || []).length === 2,
        'liveFn174×' + ((ob.match(/liveFn174/g) || []).length));
      check('§174③b ★ 城外：同构（锁城 + 施工/正常两处 live）',
        /ui\.openExtModal = function \(idx, cityId\)/.test(uS)
        && /liveFnE174/.test(ox)
        && (ox.match(/\{ live: liveFnE174 \}/g) || []).length === 2);
      check('§174③c live 回调锁城（重开带 cityId）+ 城池失效自动关闭',
        /ui\.openBuildModal\(idx, c\.id\)/.test(ob) && /ui\.openExtModal\(idx, c\.id\)/.test(ox)
        && /if \(!GAME\.cityById\(c\.id\)\) \{ ui\.closeModal\(\); return; \}/.test(ob));
    })());

    /* ④ 官府格「在建队列」段 */
    console.log('  --- ④ 官府「在建队列」（官府要务下方） ---');
    (function () {
      var uS = fs174.readFileSync(p174.join(__dirname, 'js', 'ui.js'), 'utf8');
      check('§174④ ★ 在建队列段在册（官府要务下方 · 行内挂进度 attr · 城内/城外两态）',
        /queueBox174 = '<div class="op-zone"><div class="op-zone-t">在建队列（/.test(uS)
        && /guanfuBox \+ queueBox174 \+/.test(uS)
        && /data-build-progress="city:' \+ q\.gridIndex/.test(uS)
        && /data-ext-progress="ext:' \+ q\.extIdx/.test(uS));
      check('§174④b 空态文案在册（本城暂无在建工程）', /本城暂无在建工程/.test(uS));
      check('§174④c updateProgress 非数字槽位原样传（city:wall 可解析）',
        /pv174 = \/\^\\d\+\$\/\.test\(p\[1\]\) \? Number\(p\[1\]\) : p\[1\]/.test(uS));
    })());

    /* ⑤ 完成脏标记（主循环重绘不再只比条数） */
    console.log('  --- ⑤ 完成脏标记 ---');
    (function () {
      var sS = fs174.readFileSync(p174.join(__dirname, 'js', 'state.js'), 'utf8');
      var mS6 = fs174.readFileSync(p174.join(__dirname, 'js', 'main.js'), 'utf8');
      check('§174⑤ ★ tickOnce 完成处置 _buildDirty · 主循环判据含它 · 初始化在册',
        /GAME\._buildDirty = true;/.test(sS)
        && /GAME\._lastBuildCount !== bc \|\| GAME\._buildDirty/.test(mS6)
        && /GAME\._buildDirty = false;/.test(mS6));
    })());

    var arc174 = fs174.readFileSync(p174.join(__dirname, '需求档案.md'), 'utf8');
    check('§174⑥ 需求档案在册（v89.174 · 老板原文关键句逐字）',
      arc174.indexOf('v89.174') >= 0
      && arc174.indexOf('官府要务的下方') >= 0
      && arc174.indexOf('读秒完成后，状态还是在建造中') >= 0);
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();''')

# ============================================================
# E. e2e §174 段（插在 return finish(); 前）
# ============================================================
print('== e2e-test.js ==')

edit('e2e-test.js', 'E1 §174 段',
  r'''  return finish();
}''',
  r'''  /* ============================================================
   * 174. v89.174（老板）：建造完成 → 施工弹窗 live 换态（真实 DOM）
   *   + 官府「在建队列」段 + city:wall 宽容解析。
   * ============================================================ */
  console.log('\n--- §174. 建造完成即换态 + 官府在建队列（v89.174 · 真实 DOM） ---');
  await (async function () {
    const s174 = G.state;
    const c174 = G.currentCity();
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { G.res(c174)[k] = 1e8; });
    const empties174 = [];
    c174.cells.forEach(function (cc, i) { if (!cc.build && !cc.pending && !cc.official) empties174.push(i); });
    const idx174 = empties174[0], idx174b = empties174[1];
    const r174 = G.buildAt(c174.id, idx174, 'minfang');
    check('v89.174 造局：城内开工一处', r174.ok === true, r174.msg);
    const q174 = s174.queues.build[s174.queues.build.length - 1];
    try {
      G.ui.closeAllModals();
      G.ui.openBuildModal(idx174);
      await sleep(80);
      let h174 = document.querySelector('#modal-root').innerHTML;
      check('v89.174 施工中弹窗打开（含「建造中」）', h174.indexOf('建造中') >= 0);
      q174.elapsed = q174.totalTime;          /* 推满 → 下一 tick 结算 */
      G.tickOnce();
      check('v89.174 队列已结算（splice + pending 清）',
        s174.queues.build.indexOf(q174) < 0 && !c174.cells[idx174].pending);
      G.ui.liveModalTick();                   /* 模拟主循环每秒 live 重开 */
      await sleep(90);
      h174 = document.querySelector('#modal-root').innerHTML;
      check('★ v89.174 完成后 live 换态：不再「建造中」· 换出功能面板（民房 · Lv1）',
        h174.indexOf('建造中') < 0 && /民房 · Lv1/.test(h174),
        (h174.match(/建造中|民房 · Lv1/) || [''])[0]);
      G.ui.closeAllModals();
      /* 官府格弹窗：在建队列段 */
      let gIdx = -1;
      c174.cells.forEach(function (cc, i) { if (gIdx < 0 && cc.build && cc.build.id === 'guanfu') gIdx = i; });
      const r2 = G.buildAt(c174.id, idx174b, 'minfang');
      G.ui.closeAllModals();
      G.ui.openBuildModal(gIdx);
      await sleep(90);
      const h2 = document.querySelector('#modal-root').textContent;
      check('★ v89.174 官府弹窗「在建队列」段（含在建民房行）',
        r2.ok === true && h2.indexOf('在建队列') >= 0 && h2.indexOf('民房') >= 0,
        (h2.match(/在建队列（\d+）/) || [''])[0]);
      G.ui.closeAllModals();
      /* city:wall 宽容解析（非数字槽位） */
      s174.queues.build.push({ cityId: c174.id, gridIndex: 'wall', buildId: 'chengqiang',
        type: 'build', elapsed: 0, totalTime: 600 });
      const spy174 = document.createElement('span');
      spy174.setAttribute('data-build-progress', 'city:wall');
      document.querySelector('#view-container').appendChild(spy174);
      G.ui.updateProgress();
      check('★ v89.174 updateProgress 解析 city:wall（旧写法 Number("wall")=NaN → 永远 …）',
        /^\d+% · /.test(spy174.textContent || ''), spy174.textContent);
      spy174.remove();
    } finally {
      s174.queues.build = s174.queues.build.filter(function (q) {
        return q.gridIndex !== idx174 && q.gridIndex !== idx174b && q.gridIndex !== 'wall';
      });
      c174.cells[idx174].build = null; c174.cells[idx174].pending = null;
      c174.cells[idx174b].build = null; c174.cells[idx174b].pending = null;
    }
  })();

  return finish();
}''')

# ============================================================
# A. 需求档案
# ============================================================
print('== 需求档案.md ==')

edit('需求档案.md', 'A1 总览表加行',
  r'''| 已完成（详见 docs/v89173-道具面额与出征经验.md） |''',
  r'''| 已完成（详见 docs/v89173-道具面额与出征经验.md） |
| v89.174 | 2026-09-28 | 2 | **建造读秒与弹窗 + 官府「在建队列」**（老板：「在城池的官方界面，官府要务的下方，显示本城在建的建筑队列和剩余时间。目前大界面上建筑的建造时间仍然不对，读秒完成后，状态还是在建造中。」+「全面复核代码」）—— 实机复现出**双根因**：① 倒计时显示 `round` → "剩 0.4 秒显示 00:00 但仍在建造"（实测 5/60 帧）；② **施工中弹窗没接 live**（正常态 v89.135 已接）→ 完成后弹窗**永久**停在"建造中 + …"；改：`durExact` 改 **ceil** · 城内/城外施工+正常**四态弹窗全接 live**（回调**锁城**防切城跳格）· 完成**脏标记**（`_buildDirty`，治"完成 1 条+自动升级同 tick 补 1 条"的漏刷）· 官府面板新增**在建队列段**（官府要务下方，逐行"名称·动作·进度·剩余"）· `buildProgressOf` 唯一出口 · 顺修 `city:wall` 被 `Number()` 洗成 NaN | 已完成（详见 docs/v89174-建造读秒与弹窗.md） |''')

edit('需求档案.md', 'A2 明细追加',
  r'''- 下架 7 档的冻结面额为"就近代整"（±3% 内），若将来重新上架需先与老板对一遍阶梯。''',
  r'''- 下架 7 档的冻结面额为"就近代整"（±3% 内），若将来重新上架需先与老板对一遍阶梯。

---

## v89.174（建造读秒与弹窗 + 官府「在建队列」 · 老板 2 条）

### ① 老板原文（逐字）

> 1.在城池的官方界面，官方要务的下方，显示本城在建的建筑队列和剩余时间。目前大界面上建筑的建造时间仍然不对，读秒完成后，状态还是在建造中。
> 2.全面复核代码

### ② 复现（实机三支 · 双根因实锤）

- **"读秒完成后还在建造中"是两个独立根因**：
  1. **"00:00 窗口"**：倒计时显示 `U.durExact` 走 `Math.round` —— 剩 0.4 秒被显示成
     `00:00`，但 tick 未到（`elapsed < totalTime`）→ "00:00 却仍在施工"（非整除时长必现；
     `repro_v89174c` 200ms 采样 **5/60 帧**命中"98% · 00:00 + busy"）；
  2. **施工中弹窗没接 live**：正常态弹窗 v89.135 已接 live（"完成即变"），**施工中分支漏了**
     → 完成后弹窗**永久**停在"🏗️ 建造中 + 进度 …"（`repro_v89174b`：t=5s 起队列已清、
     格子已正常、弹窗一直"建造中"）。城外 `openExtModal` 两处同样漏（一并修）；
  3. **隐患**（第三处）：主循环重绘只比队列条数 —— 完成 1 条 + 自动升级同 tick 补 1 条时
     length 不变 → 漏刷（脏标记 `_buildDirty` 补齐）。

### ③ 落地

| 项 | 改法 |
|---|---|
| 读秒 | `U.durExact` round → **ceil**（"至少还需"语义；全站 15 处倒计时同源：建造/行军/成熟） |
| 弹窗 | 城内/城外 × 施工中/正常态 **四态全接 live**；回调**锁城**（`cityId`——防切城后重开跳格；城池失效自动关闭） |
| 重绘 | `tickOnce` 完成处置 `GAME._buildDirty`；主循环判据 `条数变化 \|\| _buildDirty` |
| 在建队列（老板 1） | 官府格弹窗「官府要务」**下方**新增段：本城全部在建（城内/城墙/城外）逐行"名称 · 动作 · 百分比 · 剩余"；倒计时挂 `data-build-progress`/`data-ext-progress`（每秒刷）+ live 跟随完成/新增；无在建时一行"本城暂无在建工程" |
| 唯一出口 | 抽 `GAME.buildProgressOf(q)`（按队列取进度）—— `buildProgress` 与列表共用 |
| 顺修 | `updateProgress` 非数字槽位原样传（`city:wall` 曾被 `Number()` 洗成 NaN → 城墙行永远 '…'） |

### ④ 全面复核（老板 2）的范围与结论

- **读秒显示面**：全站 `durExact` 15 处逐点核对（建造/行军/队列/成熟/供奉）——全部"剩余"语义，ceil 同源受益；
- **队列完成刷新面**：城内格子（主循环重绘）· 城内弹窗×2（本轮 live）· 城外弹窗×2（本轮 live）·
  troops/tech/ext 面板（v89.165 live）· 种田/供奉/烽火/行军（v89.165 + updateProgress）——**全覆盖**；
- `renderView('troops'/'tech')` 为**无入口的备用渲染**（入口一律走 openPanel 弹窗）——记录在案；
- audit（死函数/孤儿/重复/零引用）**全 0** · 三闸门全绿 · 数据表四查过。

### ⑤ 验证与复现

- 复现：`repro_v89174_builddone.js`（双场景）/ `repro_v89174b_window.js`（120x · 弹窗永久建造中）/
  `repro_v89174c_zero.js`（00:00 窗口 5/60 帧）；
- 门禁：`python .workbuddy/tools/git/gate.py --full`；
- 实机截图：施工弹窗完成即换态 + 官府弹窗在建队列。

### ⑥ 诚实缺口

- live 每秒重开在**悬停弹窗期间**让位（v89.158 悬停保护）—— 读秒冻结、移开即恢复；
- "建造时间"显示口径 = **现实时间**（游戏秒 ÷ 倍速）：同一建筑换倍速会看到时长变化
  （游戏秒恒定）——设计口径，不是 bug；若想显示游戏时长另说。''')

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
